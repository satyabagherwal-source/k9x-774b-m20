# Forensic Learning Record (Deep Inspection): joreilly/PeopleInSpace

> **Canonical Artifact**: `07_PROJECT_LEARNING/joreilly-peopleinspace-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/joreilly/PeopleInSpace](https://github.com/joreilly/PeopleInSpace))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:13:35.315Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `joreilly/PeopleInSpace`
- **Description**: Kotlin Multiplatform sample with SwiftUI, Jetpack Compose, Compose for Wear, Compose for Desktop, and Compose for Web clients along with Ktor backend.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3432 stars

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

sealed class PersonListUiState {
    object Loading : PersonListUiState()
    data class Error(val message: String) : PersonListUiState()
    data class Success(
        val result: List<Assignment>,
        /** True while a later synchronisation runs, so the cached list stays usable. */
        val refreshing: Boolean = false,
    ) : PersonListUiState()
}

sealed class IssPositionUiState {
    object Loading : IssPositionUiState()
    data class Success(val position: IssPosition) : IssPositionUiState()
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

### Core Architecture Module: `wearApp/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/tile/util/Extensions.kt`
```
/*
 * Copyright 2025 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package dev.johnoreilly.peopleinspace.peopleinspace.tile.util

import android.graphics.Bitmap
import androidx.annotation.DrawableRes
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.LayoutElementBuilders.Box
import androidx.wear.protolayout.LayoutElementBuilders.Column
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.ResourceBuilders.ImageResource
import androidx.wear.protolayout.ResourceBuilders.Resources
import androidx.wear.protolayout.material3.MaterialScope
import androidx.wear.tiles.RequestBuilders
import java.nio.ByteBuffer

// Resources extensions

fun resources(
    fn: Resources.Builder.() -> Unit
): (RequestBuilders.ResourcesRequest) -> Resources = {
    Resources.Builder().setVersion(it.version).apply(fn).build()
}

/**
 * Merges two [Resources] objects into a new one.
 *
 * The version of the resulting [Resources] object will be taken from the receiver (the left-hand
 * side of the +).
 *
 * If both [Resources] objects contain a resource with the same ID, the one from the [other]
 * (right-hand side) will be used in the final result.
 */
operator fun Resources.plus(other: Resources): Resources {
    val combinedImageMap = this.idToImageMapping + other.idToImageMapping
    return Resources.Builder()
        .setVersion(this.version)
        .apply {
            for ((id, resource) in combinedImageMap) {
                addIdToImageMapping(id, resource)
            }
        }
        .build()
}

// DeviceParameters extensions

fun MaterialScope.isLargeScreen() = deviceConfiguration.screenWidthDp >= 225

// Column extensions

fun column(builder: Column.Builder.() -> Unit) = Column.Builder().apply(builder).build()

fun row(builder: LayoutElementBuilders.Row.Builder.() -> Unit) =
    LayoutElementBuilders.Row.Builder().apply(builder).build()

fun box(builder: Box.Builder.() -> Unit) = Box.Builder().apply(builder).build()

// Image extensions

fun @receiver:DrawableRes Int.toImageResource(): ImageResource {
    return ImageResource.Builder()
        .setAndroidResourceByResId(
            ResourceBuilders.AndroidImageResourceByResId.Builder().setResourceId(this).build()
        )
        .build()
}

fun Bitmap.toImageResource(): ImageResource {
    val safeBitmap = this.copy(Bitmap.Config.RGB_565, false)

    val byteBuffer = ByteBuffer.allocate(safeBitmap.byteCount)
    safeBitmap.copyPixelsToBuffer(byteBuffer)
    val bytes: ByteArray = byteBuffer.array()

    return ImageResource.Builder()
        .setInlineResource(
            ResourceBuilders.InlineImageResource.Builder()
                .setData(bytes)
                .setWidthPx(this.width)
                .setHeightPx(this.height)
                .setFormat(ResourceBuilders.IMAGE_FORMAT_RGB_565)
                .build()
        )
        .build()
}
```

### Core Architecture Module: `wearApp/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/tile/util/MultiDevicePreviews.kt`
```
/*
 * Copyright 2025 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package dev.johnoreilly.peopleinspace.peopleinspace.tile.util

import androidx.wear.tiles.tooling.preview.Preview
import androidx.wear.tooling.preview.devices.WearDevices

@Preview(device = WearDevices.SMALL_ROUND, name = "Small Round")
@Preview(device = WearDevices.LARGE_ROUND, name = "Large Round")
internal annotation class MultiRoundDevicesPreviews

@Preview(device = WearDevices.SMALL_ROUND, fontScale = 0.94f, name = "Small Round 0.94f")
@Preview(device = WearDevices.SMALL_ROUND, fontScale = 1.00f, name = "Small Round 1.00f")
@Preview(device = WearDevices.SMALL_ROUND, fontScale = 1.24f, name = "Small Round 1.24f")
@Preview(device = WearDevices.LARGE_ROUND, fontScale = 0.94f, name = "Large Round 0.94f")
@Preview(device = WearDevices.LARGE_ROUND, fontScale = 1.00f, name = "Large Round 1.00f")
@Preview(device = WearDevices.LARGE_ROUND, fontScale = 1.24f, name = "Large Round 1.24f")
internal annotation class MultiRoundDevicesWithFontScalePreviews
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #541** (2026-10-04): **Maestro CI: keep debug output on failure, allow longer ISS screen wait**
  *Symptoms*: ## Summary - Run Maestro with `--debug-output maestro-debug` and upload that directory (logs, screenshots, view hierarchy) as an artifact when the job fails. Previously only the final screenshot was uploaded, and only on success. - Use `extendedWaitUntil` with a 30s timeout for the ISS Position screen instead of `assertVisible`.  Context: Maestro failed once on #540 at `Assert that "ISS Position" is visible` (the tap took 8s on a slow emulator) and passed on re-run, with no debug output available to confirm why.  ## Test plan - [ ] Maestro UI tests pass on this PR  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01HaXtEA53r3qLwkjMRLmH4g

- **Issue #540** (2026-10-04): **Batch Renovate dependency updates**
  *Symptoms*: ## Summary Combines the open Renovate PRs (Gradle wrapper excluded — it's pinned at 9.6.1) so they're built and tested together:  | Update | Supersedes | |:--|:--| | Compose Multiplatform 1.12.0 → 1.12.1 | #535 | | Ktor 3.5.2 → 3.6.0 (incl. backend) | #531 | | SQLDelight 2.3.2 → 2.4.0 | #537 | | kotlin-native-nuget 0.6.0 → 0.8.0 | #529 | | Microsoft.WindowsAppSDK 2.4.0 → 2.5.1 | #530 | | logback-classic 1.6.3 → 1.6.5 | #534 | | slf4j-simple 2.0.19 → 2.0.20 | #536 | | gradle-versions-plugin 0.62.0 → 0.64.0 | #528 | | `ubuntu-24.04` → `ubuntu-26.04` runners | #539 |  ## Test plan - [x] `common` compiles for JVM, Android, wasmJs, mingwX64; iOS simulator framework links - [x] `:app:assembleDebug`, `:wearApp:assembleDebug`, `:compose-desktop:compileKotlin`, `:compose-web:compileKotlinWasmJs`, `:backend:compileKotlinJvm`, `:mcp-server:compileKotlin` - [x] `:common:jvmTest`, `:backend:jvmTest`, `:app:testDebugUnitTest`, `:wearApp:testDebugUnitTest` - [x] iOS app builds via `xcodebuild` - [ ] CI (incl. Windows / NuGet bindings, Maestro, Compose UI tests)  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01HaXtEA53r3qLwkjMRLmH4g

- **Issue #539** (2026-10-04): **Update dependency ubuntu to v26 - autoclosed**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [ubuntu](https://redirect.github.com/actions/runner-images) | github-runner | major | `24.04` → `26.04` |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/203) for more information.  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/joreilly/PeopleInSpace). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMjUuMSIsInVwZGF0ZWRJblZlciI6IjQ0LjEyNS4xIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119--> 
  **Post-Mortem & Fix Analysis**:
  > Included in #540.

- **Issue #538** (2026-10-04): **iOS CI: save konan cache only from main, keep caches warm**
  *Symptoms*: ## Summary - Restore `~/.konan` on every run but only **save it from `main`**, so PR runs (~0.5–0.9 GB each) don't fill the 10 GB cache quota and evict main's caches. - Weekly `schedule` (+ `workflow_dispatch`) so main's caches aren't evicted after 7 days unused (a cold run spends ~10 min on Kotlin/Native setup), and runner/Xcode image changes are caught early.  Same change piloted in GalwayBus (joreilly/GalwayBus#123): "Build iOS app" went from 650s cold to 272s with warm caches.  ## Test plan - [ ] iOS CI passes on this PR - [ ] After merge, main run saves the konan cache (if not already present)  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01HaXtEA53r3qLwkjMRLmH4g

- **Issue #537** (2026-10-04): **Update sqlDelight to v2.4.0 - autoclosed**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [app.cash.sqldelight](https://redirect.github.com/sqldelight/sqldelight) | `2.3.2` → `2.4.0` | ![age](https://developer.mend.io/api/mc/badges/age/maven/app.cash.sqldelight:app.cash.sqldelight.gradle.plugin/2.4.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/app.cash.sqldelight:app.cash.sqldelight.gradle.plugin/2.3.2/2.4.0?slim=true) | | [app.cash.sqldelight:web-worker-driver](https://redirect.github.com/sqldelight/sqldelight) | `2.3.2` → `2.4.0` | ![age](https://developer.mend.io/api/mc/badges/age/maven/app.cash.sqldelight:web-worker-driver/2.4.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/app.cash.sqldelight:web-worker-driver/2.3.2/2.4.0?slim=true) | | [app.cash.sqldelight:sqlite-driver](https://redirect.github.com/sqldelight/sqldelight) | `2.3.2` → `2.4.0` | ![age](https://developer.mend.io/api/mc/badges/age/maven/app.cash.sqldelight:sqlite-driver/2.4.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/app.cash.sqldelight:sqlite-driver/2.3.2/2.4.0?slim=true) | | [app.cash.sqldelight:native-driver](https://redirect.github.com/sqldelight/sqldelight) | `2.3.2` → `2.4.0` | ![age](https://developer.mend.io/api/mc/badges/age/maven/app.cash.sqldelight:native-driver/2.4.0?sl
  **Post-Mortem & Fix Analysis**:
  > Included in #540.

- **Issue #536** (2026-10-04): **Update dependency org.slf4j:slf4j-simple to v2.0.20 - autoclosed**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [org.slf4j:slf4j-simple](http://www.slf4j.org) ([source](https://redirect.github.com/qos-ch/slf4j), [changelog](https://www.slf4j.org/news.html)) | `2.0.19` → `2.0.20` | ![age](https://developer.mend.io/api/mc/badges/age/maven/org.slf4j:slf4j-simple/2.0.20?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/org.slf4j:slf4j-simple/2.0.19/2.0.20?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/203) for more information.  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/joreilly/PeopleInSpace). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMjUuMSIsInVwZGF0ZWRJblZlciI6IjQ0LjEyNS4xIiwidGFyZ2V0QnJhbmNoIjoib
  **Post-Mortem & Fix Analysis**:
  > Included in #540.

- **Issue #535** (2026-10-04): **Update dependency org.jetbrains.compose to v1.12.1 - autoclosed**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | org.jetbrains.compose | `1.12.0` → `1.12.1` | ![age](https://developer.mend.io/api/mc/badges/age/maven/org.jetbrains.compose:org.jetbrains.compose.gradle.plugin/1.12.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/org.jetbrains.compose:org.jetbrains.compose.gradle.plugin/1.12.0/1.12.1?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/203) for more information.  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/joreilly/PeopleInSpace). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMjUuMSIsInVwZGF0ZWRJblZlciI6IjQ0LjEyNS4xIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119--> 
  **Post-Mortem & Fix Analysis**:
  > Included in #540.

- **Issue #534** (2026-10-04): **Update dependency ch.qos.logback:logback-classic to v1.6.5 - autoclosed**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [ch.qos.logback:logback-classic](http://logback.qos.ch) ([source](https://redirect.github.com/qos-ch/logback), [changelog](https://logback.qos.ch/news.html)) | `1.6.3` → `1.6.5` | ![age](https://developer.mend.io/api/mc/badges/age/maven/ch.qos.logback:logback-classic/1.6.5?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/ch.qos.logback:logback-classic/1.6.3/1.6.5?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/203) for more information.  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/joreilly/PeopleInSpace). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMjUuMSIsInVwZGF0ZWRJblZlciI6IjQ0LjEyNS4xIi
  **Post-Mortem & Fix Analysis**:
  > Included in #540.

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

### Incident Patch 1: `7bb1d208` (2026-10-04)
**Commit Message**: Maestro CI: keep debug output on failure, allow longer ISS screen wait (#541)

A Maestro run failed once on the ISS Position assertion (slow emulator; it
passed on re-run) and there was nothing to diagnose it with, as only the
final screenshot is uploaded and only on success. Write Maestro's debug
output to the workspace and upload it when the job fails, and use
extendedWaitUntil (30s) for the ISS Position screen.


Claude-Session: https://claude.ai/code/session_01HaXtEA53r3qLwkjMRLmH4g

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/maestro.yml` (modified, +8/-1)
```diff
@@ -77,9 +77,16 @@ jobs:
           avd-name: peopleinspace-api32
           emulator-options: -no-snapshot-save -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim -camera-back none
           disable-animations: true
-          script: adb install ./app/build/outputs/apk/debug/app-debug.apk && maestro test maestro/PeopleInSpace.flow
+          script: adb install ./app/build/outputs/apk/debug/app-debug.apk && maestro test --debug-output maestro-debug maestro/PeopleInSpace.flow
 
       - uses: actions/upload-artifact@v7
         with:
           name: screenshot
           path: PeopleInSpace.png
+
+      # Maestro's logs, screenshots and view hierarchy, to diagnose failures
+      - uses: actions/upload-artifact@v7
+        if: failure()
+        with:
+          name: maestro-debug
+          path: maestro-debug
```

**File**: `maestro/PeopleInSpace.flow` (modified, +4/-1)
```diff
@@ -6,7 +6,10 @@ appId: dev.johnoreilly.peopleinspace
 - assertVisible: "People in Space"
 
 - tapOn: "ISS Position"
-- assertVisible: "ISS Position"
+# Allow for slow CI emulators (the default assertVisible wait occasionally times out)
+- extendedWaitUntil:
+    visible: "ISS Position"
+    timeout: 30000
 
 - tapOn: "People"
 - assertVisible: "People in Space"
```

---

### Incident Patch 2: `7c99fd88` (2026-09-20)
**Commit Message**: revert gradle to 9.6.1 to avoid IntelliJ syncing issue + README update

**File**: `README.md` (modified, +77/-0)
```diff
@@ -21,6 +21,83 @@ project's own small Ktor backend (see `backend` module below).
 
 The project is included as sample in the official [Kotlin Multiplatform docs](https://kotlinlang.org/docs/multiplatform-samples.html) and also the [Google Dev Library](https://devlibrary.withgoogle.com/products/android)
 
+### Architecture
+
+All of the clients are thin UI layers over the same `common` module: the shared view models expose
+`StateFlow`s of UI state, backed by a single repository that treats the local SQLDelight database as
+the source of truth and refreshes it from the network.
+
+```mermaid
+flowchart TB
+    subgraph clients["Clients"]
+        direction LR
+        android["<b>app</b><br/>Android · Jetpack Compose<br/>+ Glance / Remote Compose widgets"]
+        wear["<b>wearApp</b><br/>Wear OS · Compose + Tile"]
+        ios["<b>PeopleInSpaceSwiftUI</b><br/>iOS · SwiftUI (SKIE)<br/>+ SwiftExecutablePackage"]
+        desktop["<b>compose-desktop</b><br/>JVM · Compose for Desktop"]
+        web["<b>compose-web</b><br/>Kotlin/Wasm · Compose"]
+        winui["<b>windows/WinUiApp</b><br/>.NET · WinUI 3"]
+        mcp["<b>mcp-server</b><br/>JVM · Kotlin MCP SDK"]
+    end
+
+    subgraph common["common (Kotlin Multiplatform)"]
+        direction TB
+        cmpui["Compose Multiplatform UI<br/><i>PersonList / ISSPosition / ISSMapView</i><br/>(expect/actual map per platform)"]
+        vm["View models<br/><i>PersonListViewModel · ISSPositionViewModel</i><br/>StateFlow&lt;UiState&gt;"]
+        winclient["PeopleInSpaceClient<br/><i>mingwX64, exported via NuGet</i><br/>(no Koin / AndroidX)"]
+        repo["<b>PeopleInSpaceRepository</b><br/>offline-first: DB is source of truth,<br/>ISS position polled every 10s"]
+        db[("SQLDelight<br/>PeopleInSpaceDatabase")]
+        api["Ktor client APIs<br/><i>PeopleInSpaceApi · AstroviewerApi</i>"]
+        koin{{"Koin DI<br/>(annotations + compiler plugin)"}}
+
+        cmpui --> vm
+        vm --> repo
+        winclient --> repo
+        repo --> db
+        repo --> api
+        koin -.-> repo
+    end
+
+    subgraph remote["Remote"]
+        direction LR
+        backend["<b>backend</b><br/>Ktor / Netty on App Engine<br/><i>/astros.json</i>"]
+        spacedevs["The Space Devs API<br/><i>names, bios, images</i>"]
+        wheretheiss["wheretheiss.at<br/><i>current ISS position</i>"]
+        astroviewer["astroviewer.net<br/><i>predicted ISS orbit</i>"]
+    end
+
+    android --> cmpui
+    wear --> repo
+    ios --> cmpui
+    desktop --> cmpui
+    web --> cmpui
+    winui --> winclient
+    mcp --> repo
+
+    api --> backend
+    api --> wheretheiss
+    api --> astroviewer
+    backend --> spacedevs
+
+    classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d1b2a
+    classDef shared fill:#ede7f6,stroke:#5e35b1,color:#0d1b2a
+    classDef data fill:#e8f5e9,stroke:#2e7d32,color:#0d1b2a
+    classDef service fill:#fff3e0,stroke:#ef6c00,color:#0d1b2a
+    class android,wear,ios,desktop,web,winui,mcp client
+    class cmpui,vm,winclient,koin shared
+    class repo,db,api data
+    class backend,spacedevs,wheretheiss,astroviewer service
+```
+
+Notes on a few of the edges above:
+
+* The Wear OS client and the MCP server talk to the repository directly (Wear has its own
+  Wear-specific view models, the MCP server just reads the people list).
+* The Windows client goes through `PeopleInSpaceClient`, a self-contained `mingwX64` entry point that
+  owns its own Ktor engine, SQLite driver and coroutine scope rather than using Koin.
+* Only the people list goes through this project's own Ktor backend; the ISS position and predicted
+  orbit are fetched from their services directly by the shared Ktor client code.
+
 ### Module overview
 
 | Module | Description |
```

**File**: `gradle/wrapper/gradle-wrapper.properties` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-9.7.1-bin.zip
+distributionUrl=https\://services.gradle.org/distributions/gradle-9.6.1-bin.zip
 networkTimeout=10000
 retries=0
 retryBackOffMs=500
```

**File**: `renovate.json` (modified, +7/-0)
```diff
@@ -4,6 +4,13 @@
     "config:base"
   ],
   "packageRules": [
+    {
+      "description": "Pinned to Gradle 9.6.1 — the 9.7.x bump was reverted deliberately. Re-enable when we choose to move forward again.",
+      "matchManagers": [
+        "gradle-wrapper"
+      ],
+      "enabled": false
+    },
     {
       "description": "AGP 9.3.x+ outruns what the locally installed Android Studio supports — sync fails with unsupported-AGP-version and \"could not find compile target\" errors. Hold AGP updates until Studio's bundled support catches up.",
       "matchPackageNames": [
```

---

### Incident Patch 3: `0d5cd8b0` (2026-09-13)
**Commit Message**: Update dependency Microsoft.Windows.SDK.BuildTools to 10.0.28000.2705 (#513)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `windows/WinUiApp/PeopleInSpace.Windows.WinUiApp.csproj` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 
   <ItemGroup>
     <PackageReference Include="Microsoft.WindowsAppSDK" Version="2.4.0" />
-    <PackageReference Include="Microsoft.Windows.SDK.BuildTools" Version="10.0.26100.7705" PrivateAssets="all" />
+    <PackageReference Include="Microsoft.Windows.SDK.BuildTools" Version="10.0.28000.2705" PrivateAssets="all" />
     <!-- Compiles the package's generated Interop.cs (contentFiles) and ships peopleinspace.dll. -->
     <PackageReference Include="PeopleInSpace.Kotlin" Version="$(PeopleInSpaceKotlinVersion)" />
   </ItemGroup>
```

---

### Incident Patch 4: `2c9010a5` (2026-09-12)
**Commit Message**: use OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED for iOS build

**File**: `PeopleInSpaceSwiftUI/PeopleInSpaceSwiftUI.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -253,7 +253,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "cd \"$SRCROOT/..\"\n./gradlew :common:embedAndSignAppleFrameworkForXcode\n";
+			shellScript = "if [ \"YES\" = \"$OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED\" ]; then\n  echo \"Skipping Gradle build task invocation due to OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED environment variable set to \\\"YES\\\"\"\n  exit 0\nfi\ncd \"$SRCROOT/..\"\n./gradlew :common:embedAndSignAppleFrameworkForXcode";
 		};
 		7555FFB5242A651A00829871 /* ShellScript */ = {
 			isa = PBXShellScriptBuildPhase;
@@ -270,7 +270,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "cd \"$SRCROOT/..\"\n./gradlew :common:embedAndSignAppleFrameworkForXcode\n";
+			shellScript = "if [ \"YES\" = \"$OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED\" ]; then\n  echo \"Skipping Gradle build task invocation due to OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED environment variable set to \\\"YES\\\"\"\n  exit 0\nfi\ncd \"$SRCROOT/..\"\n./gradlew :common:embedAndSignAppleFrameworkForXcode";
 		};
 /* End PBXShellScriptBuildPhase section */
 
```

---

### Incident Patch 5: `c22f7983` (2026-09-02)
**Commit Message**: Add a WinUI 3 client backed by kotlin-native-nuget (#503)

* Separate Compose UI from shared native core

* Export observable Kotlin Native client

* Add shared .NET adapter and WinUI client

* Add MAUI Mac Catalyst host

* Verify Windows and MAUI clients in CI

* Make local NuGet restores reproducible

* Make managed state projection AOT-safe

* Avoid Catalyst shutdown service race

* Keep ISS snapshots on one client instance

* Update kotlin-native-nuget to 0.3.0

0.3.0 maps `kotlin.time.Instant` to `DateTimeOffset` over a single `Int64`,
so `IssState.timestamp` crosses as a scalar and the managed adapter drops its
`FromUnixTimeSeconds` conversion. Still AOT-safe: no handle, no reflection.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01KJAtfQDQ9HpwMLh9xPMeRK

* Put androidMain back in the nonWindows source set group

`withAndroidTarget()` matches the legacy `KotlinAndroidTarget`, which
`com.android.kotlin.multiplatform.library` never creates, so androidMain sat
outside the group and lost the shared sources. `:common:compileAndroidMain`
and `:app` have been failing on unresolved `dev.johnoreilly.common.viewmodel`
since the source

**File**: `.github/workflows/windows.yml` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+name: Windows CI
+
+on:
+  pull_request:
+  push:
+    branches: [ main ]
+
+# Cancel superseded runs for the same PR/branch
+concurrency:
+  group: windows-${{ github.head_ref || github.ref }}
+  cancel-in-progress: true
+
+permissions:
+  contents: read
+
+jobs:
+  build:
+    name: Build and test WinUI
+    runs-on: windows-latest
+    timeout-minutes: 45
+    env:
+      # Keep restore packages inside the checkout so this job never touches the runner-wide cache.
+      NUGET_PACKAGES: ${{ github.workspace }}\windows\obj\packages
+
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v7
+
+      - name: Set up JDK 17
+        uses: actions/setup-java@v5
+        with:
+          distribution: 'zulu'
+          java-version: 17
+
+      - name: Set up Gradle
+        uses: gradle/actions/setup-gradle@v6
+
+      - name: Install static MinGW SQLite
+        uses: msys2/setup-msys2@v2
+        with:
+          install: mingw-w64-x86_64-sqlite3
+
+      # Only libsqlite3.a needs staging. The MSYS2 build is stack protected, and the
+      # link tasks copy libssp.a from the Kotlin/Native toolchain into the same directory.
+      - name: Stage static MinGW SQLite
+        shell: msys2 {0}
+        run: |
+          mkdir -p common/build/mingw-sqlite
+          cp /mingw64/lib/libsqlite3.a common/build/mingw-sqlite/libsqlite3.a
+
+      - name: Set up .NET 10
+        uses: actions/setup-dotnet@v5
+        with:
+          dotnet-version: '10.0.x'
+
+      - name: Pack shared NuGet package
+        run: .\gradlew.bat :common:packNuget --no-daemon --stacktrace
+
+      - name: Verify packaged Windows native library
+        shell: pwsh
+        run: |
+          $package = Get-ChildItem common\build\nuget\*.nupkg | Select-Object -First 1
+          $entries = tar -tf $package.FullName
+          if ($entries -notcontains 'runtimes/win-x64/native/peopleinspace.dll') {
+            throw 'peopleinspace.dll is missing from the NuGet package'
+          }
+
+      - name: Restore WinUI solution
+        run: dotnet restore windows\PeopleInSpace.Windows.sln
+
+      - name: Build WinUI solution
+        run: dotnet build windows\PeopleInSpace.Windows.sln --configuration Release -p:Platform=x64 --no-restore
+
+      - name: Upload shared NuGet package
+        if: always()
+        uses: actions/upload-artifact@v7
+        with:
+          name: peopleinspace-nuget
+          path: common/build/nuget/*.nupkg
+
+      - name: Upload WinUI build output
+        if: always()
+        uses: actions/upload-artifact@v7
+        with:
+          name: winui-build-output
+          path: windows/WinUiApp/bin/x64/Release/
```

**File**: `README.md` (modified, +5/-1)
```diff
@@ -10,6 +10,7 @@
 * Swift Executable Package
 * Desktop (Compose for Desktop)
 * Web (Compose for Web - Wasm based)
+* Windows (WinUI 3)
 * JVM (small Ktor back end service + `Main.kt` in `common` module)
 * MCP server (using same shared KMP code)
 
@@ -24,12 +25,13 @@ The project is included as sample in the official [Kotlin Multiplatform docs](ht
 
 | Module | Description |
 |---|---|
-| `common` | Shared KMP code (Ktor, SQLDelight, Koin, view models) and shared Compose Multiplatform UI |
+| `common` | Shared KMP code (Ktor, SQLDelight, Koin, view models), shared Compose Multiplatform UI, and the Windows NuGet API |
 | `app` | Android client (Jetpack Compose), including Glance app widget |
 | `wearApp` | Wear OS client (Compose for Wear OS) |
 | `PeopleInSpaceSwiftUI` | iOS client (SwiftUI) |
 | `compose-desktop` | Desktop client (Compose for Desktop) |
 | `compose-web` | Web client (Compose for Web, Kotlin/Wasm) |
+| `windows/WinUiApp` | Windows client (WinUI 3) |
 | `backend` | Ktor server providing the people/ISS data (deployable to Google App Engine) |
 | `mcp-server` | Model Context Protocol server exposing the shared KMP code |
 
@@ -42,6 +44,8 @@ Requirements: JDK 17, a recent version of Android Studio (for the Android/Wear c
 * **iOS**: open `PeopleInSpaceSwiftUI` in Xcode and run from there
 * **Desktop**: `./gradlew :compose-desktop:run`
 * **Web (Wasm)**: `./gradlew :compose-web:wasmJsBrowserDevelopmentRun`
+* **Windows (.NET)**: see the [WinUI 3 client guide](windows/README.md) for prerequisites and build, test, and run instructions.
+
 * **Backend**: `./gradlew :backend:run` (or run `Server.kt` directly from Android Studio). After doing that you should then for example be able to open `http://localhost:9090/astros_local.json` in a browser.
 
 Tests can be run with `./gradlew :common:jvmTest`, and there's also a [Maestro](https://maestro.mobile.dev/) UI test
```

**File**: `app/src/androidTest/java/dev/johnoreilly/peopleinspace/peopleinspace/PeopleInSpaceRepositoryFake.kt` (modified, +2/-0)
```diff
@@ -11,6 +11,8 @@ import kotlinx.coroutines.flow.flowOf
 
 class PeopleInSpaceRepositoryFake: PeopleInSpaceRepositoryInterface {
     override val initialSyncCompleted: StateFlow<Boolean> = MutableStateFlow(true)
+    override val peopleSyncLoading: StateFlow<Boolean> = MutableStateFlow(false)
+    override val peopleSyncError: StateFlow<Throwable?> = MutableStateFlow(null)
 
     val peopleList = listOf(Assignment("Apollo 11", "Neil Armstrong"),
         Assignment("Apollo 11", "Buzz Aldrin"))
```

**File**: `build.gradle.kts` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ plugins {
     alias(libs.plugins.shadowPlugin) apply false
     alias(libs.plugins.compose.compiler) apply false
     alias(libs.plugins.jetbrainsCompose) apply false
+    alias(libs.plugins.kotlin.native.nuget) apply false
 }
 
 // force patched versions of vulnerable transitive npm deps of the wasm webpack tooling
```

**File**: `common/build.gradle.kts` (modified, +126/-15)
```diff
@@ -1,12 +1,16 @@
-@file:OptIn(ExperimentalWasmDsl::class)
+@file:OptIn(ExperimentalWasmDsl::class, ExperimentalKotlinGradlePluginApi::class)
 
 import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
+import org.jetbrains.kotlin.gradle.ExperimentalKotlinGradlePluginApi
+import org.jetbrains.kotlin.gradle.plugin.mpp.NativeBuildType.DEBUG
+import org.jetbrains.kotlin.gradle.plugin.mpp.NativeBuildType.RELEASE
 
 plugins {
     alias(libs.plugins.kotlinMultiplatform)
     alias(libs.plugins.android.kotlin.multiplatform.library)
     alias(libs.plugins.kotlinx.serialization)
     alias(libs.plugins.sqlDelight)
+    alias(libs.plugins.kotlin.native.nuget)
     alias(libs.plugins.koin.compiler)
     alias(libs.plugins.jetbrainsCompose)
     alias(libs.plugins.compose.compiler)
@@ -26,6 +30,19 @@ kotlin {
         }
     }
 
+    mingwX64 {
+        binaries {
+            sharedLib(listOf(DEBUG, RELEASE)) {
+                baseName = "peopleinspace"
+                if (System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) {
+                    // Windows CI places the static MinGW SQLite archive here so the
+                    // packaged DLL has no extra SQLite runtime dependency.
+                    linkerOpts("-L${layout.buildDirectory.dir("mingw-sqlite").get().asFile.invariantSeparatorsPath}", "-lssp")
+                }
+            }
+        }
+    }
+
     android {
         namespace = "dev.johnoreilly.common"
         compileSdk = libs.versions.compileSdk.get().toInt()
@@ -42,7 +59,46 @@ kotlin {
         }
     }
 
+    applyDefaultHierarchyTemplate {
+        common {
+            group("nonWindows") {
+                // com.android.kotlin.multiplatform.library creates its own target type, which
+                // withAndroidTarget() (the legacy KotlinAndroidTarget) never matches, so androidMain
+                // would silently sit outside this group and lose the shared sources.
+                withCompilations { it.target.name == "android" }
+                withJvm()
+                withWasmJs()
+                group("apple") {
+                    withIos()
+                }
+            }
+        }
+    }
+
     sourceSets {
+        // Compose and the AndroidX ViewModels have no MinGW artifacts, so everything that needs
+        // them lives here rather than in commonMain.
+        val nonWindowsMain by getting {
+            dependencies {
+                api(libs.koin.core.viewmodel)
+                implementation(libs.androidx.lifecycle.viewmodel.kmp)
+
+                implementation(compose.ui)
+                implementation(compose.runtime)
+                implementation(compose.foundation)
+                implementation(compose.material3)
+                implementation(compose.components.resources)
+                implementation(libs.androidx.lifecycle.compose.kmp)
+            }
+        }
+
+        val nonWindowsTest by getting {
+            dependencies {
+                @OptIn(org.jetbrains.compose.ExperimentalComposeLibrary::class)
+                implementation(compose.uiTest)
+            }
+        }
+
         commonMain.dependencies {
             implementation(libs.bundles.ktor.common)
             implementation(libs.kotlinx.coroutines)
@@ -52,28 +108,14 @@ kotlin {
             implementation(libs.sqldelight.coroutines.extensions)
 
             api(libs.koin.core)
-            api(libs.koin.core.viewmodel)
-            implementation(libs.koin.compose.multiplatform)
-            implementation(libs.koin.test)
             api(libs.koin.annotations)
-
             api(libs.kermit)
-
-            implementation(compose.ui)
-            implementation(compose.runtime)
-            implementation(compose.foundation)
-            implementation(compose.material3)
-            implementation(compose.components.resources)
-            implementation(libs.androidx.lifecycle.compose.kmp)
-            implementation(libs.androidx.lifecycle.viewmodel.kmp)
         }
 
         commonTest.dependencies {
             implementation(libs.koin.test)
             implementation(libs.kotlinx.coroutines.test)
             implementation(kotlin("test"))
-            @OptIn(org.jetbrains.compose.ExperimentalComposeLibrary::class)
-            implementation(compose.uiTest)
         }
 
         androidMain.dependencies {
@@ -100,6 +142,11 @@ kotlin {
             implementation(libs.sqldelight.native.driver)
         }
 
+        mingwX64Main.dependencies {
+            implementation(libs.ktor.client.winhttp)
+            implementation(libs.sqldelight.native.driver)
+        }
+
         wasmJsMain.dependencies {
             implementation(libs.sqldelight.web.driver)
             implementation(npm("@cashapp/sqldelight-sqljs-worker", "2.1.0"))
@@ -136,3 +183,67 @@ skie {
         enableSwiftUIObservingPreview = true
     }
 }
+
+nuget {
+    publish {
+        packageId = "PeopleInSpace.Kotlin"
+        version = "0.1.0"
+        authors = "PeopleIn
```

**File**: `common/src/commonMain/kotlin/dev/johnoreilly/common/di/Dependencies.kt` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+package dev.johnoreilly.common.di
+
+import app.cash.sqldelight.db.SqlDriver
+import dev.johnoreilly.peopleinspace.db.PeopleInSpaceDatabase
+import io.ktor.client.*
+import io.ktor.client.engine.*
+import io.ktor.client.plugins.contentnegotiation.*
+import io.ktor.client.plugins.logging.*
+import io.ktor.serialization.kotlinx.json.*
+import kotlinx.serialization.json.Json
+
+// Shared by the Koin graph (nonWindows targets) and the Windows client, which builds its own graph.
+
+class PeopleInSpaceDatabaseWrapper(val driver: SqlDriver, val instance: PeopleInSpaceDatabase)
+
+fun createHttpClient(httpClientEngine: HttpClientEngine, json: Json, enableNetworkLogs: Boolean) = HttpClient(httpClientEngine) {
+    install(ContentNegotiation) {
+        json(json)
+    }
+    if (enableNetworkLogs) {
+        install(Logging) {
+            logger = Logger.DEFAULT
+            level = LogLevel.INFO
+        }
+    }
+}
```

**File**: `common/src/commonMain/kotlin/dev/johnoreilly/common/repository/PeopleInSpaceRepository.kt` (modified, +35/-7)
```diff
@@ -20,6 +20,13 @@ interface PeopleInSpaceRepositoryInterface {
     // false until the first network fetch has finished (successfully or not),
     // letting the UI distinguish "not fetched yet" from a genuinely empty result
     val initialSyncCompleted: StateFlow<Boolean>
+
+    /** True while the people list is being synchronised with the service. */
+    val peopleSyncLoading: StateFlow<Boolean>
+
+    /** The most recent people-list synchronisation failure, if any. */
+    val peopleSyncError: StateFlow<Throwable?>
+
     fun fetchPeopleAsFlow(): Flow<List<Assignment>>
     fun pollISSPosition(): Flow<IssPosition>
     suspend fun fetchISSFuturePosition(): List<OrbitPoint>
@@ -31,22 +38,36 @@ class PeopleInSpaceRepository(
     private val peopleInSpaceApi: PeopleInSpaceApi,
     private val peopleInSpaceDatabase: PeopleInSpaceDatabaseWrapper,
     private val astroviewerApi: AstroviewerApi,
+    val coroutineScope: CoroutineScope,
 ) : PeopleInSpaceRepositoryInterface {
 
-    val coroutineScope: CoroutineScope = MainScope()
     private val peopleInSpaceQueries = peopleInSpaceDatabase.instance.peopleInSpaceQueries
 
     val logger = Logger.withTag("PeopleInSpaceRepository")
 
     private val _initialSyncCompleted = MutableStateFlow(false)
     override val initialSyncCompleted: StateFlow<Boolean> = _initialSyncCompleted.asStateFlow()
 
+    private val _peopleSyncLoading = MutableStateFlow(false)
+    override val peopleSyncLoading: StateFlow<Boolean> = _peopleSyncLoading.asStateFlow()
+
+    private val _peopleSyncError = MutableStateFlow<Throwable?>(null)
+    override val peopleSyncError: StateFlow<Throwable?> = _peopleSyncError.asStateFlow()
+
     init {
         coroutineScope.launch {
-            // TODO figure out cleaner place to invoke this (needed for web implementatin)
-            PeopleInSpaceDatabase.Schema.awaitCreate(peopleInSpaceDatabase.driver)
-            fetchAndStorePeople()
-            _initialSyncCompleted.value = true
+            try {
+                // TODO figure out cleaner place to invoke this (needed for web implementatin)
+                PeopleInSpaceDatabase.Schema.awaitCreate(peopleInSpaceDatabase.driver)
+                fetchAndStorePeople()
+            } catch (e: CancellationException) {
+                throw e
+            } catch (e: Exception) {
+                _peopleSyncError.value = e
+                logger.w(e) { "Exception while creating PeopleInSpace database: $e" }
+            } finally {
+                _initialSyncCompleted.value = true
+            }
         }
     }
 
@@ -57,15 +78,20 @@ class PeopleInSpaceRepository(
                     name = name,
                     craft = craft,
                     personImageUrl = personImageUrl,
-                    personBio = personBio,
+                    personBio = personBio?.unescapeLineBreaks(),
                     nationality = nationality
                 )
             }
         ).asFlow().mapToList(Dispatchers.Default)
     }
 
+    /** Some upstream biographies contain literal `\r\n` sequences rather than line breaks. */
+    private fun String.unescapeLineBreaks() = replace("\\r\\n", "\n").replace("\\n", "\n")
+
     override suspend fun fetchAndStorePeople() {
         logger.d { "fetchAndStorePeople" }
+        _peopleSyncLoading.value = true
+        _peopleSyncError.value = null
         try {
             val result = peopleInSpaceApi.fetchPeople()
 
@@ -86,8 +112,10 @@ class PeopleInSpaceRepository(
         } catch (e: CancellationException) {
             throw e
         } catch (e: Exception) {
-            // TODO report error up to UI
+            _peopleSyncError.value = e
             logger.w(e) { "Exception during fetchAndStorePeople: $e" }
+        } finally {
+            _peopleSyncLoading.value = false
         }
     }
 
```

**File**: `common/src/commonMain/kotlin/dev/johnoreilly/common/viewmodel/PersonListViewModel.kt` (removed, +0/-41)
```diff
@@ -1,41 +0,0 @@
-package dev.johnoreilly.common.viewmodel
-
-import androidx.lifecycle.ViewModel
-import androidx.lifecycle.viewModelScope
-import dev.johnoreilly.common.remote.Assignment
-import dev.johnoreilly.common.repository.PeopleInSpaceRepositoryInterface
-import kotlinx.coroutines.flow.SharingStarted
-import kotlinx.coroutines.flow.combine
-import kotlinx.coroutines.flow.stateIn
-import kotlinx.coroutines.launch
-import org.koin.core.annotation.KoinViewModel
-
-
-sealed class PersonListUiState {
-    object Loading : PersonListUiState()
-    data class Error(val message: String) : PersonListUiState()
-    data class Success(val result: List<Assignment>) : PersonListUiState()
-}
-
-@KoinViewModel
-class PersonListViewModel(
-    private val peopleInSpaceRepository: PeopleInSpaceRepositoryInterface
-) : ViewModel() {
-
-    val uiState = combine(
-        peopleInSpaceRepository.fetchPeopleAsFlow(),
-        peopleInSpaceRepository.initialSyncCompleted
-    ) { people, initialSyncCompleted ->
-        if (people.isEmpty() && !initialSyncCompleted) {
-            PersonListUiState.Loading
-        } else {
-            PersonListUiState.Success(people)
-        }
-    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), PersonListUiState.Loading)
-
-    fun refresh() {
-        viewModelScope.launch {
-            peopleInSpaceRepository.fetchAndStorePeople()
-        }
-    }
-}
```

---

### Incident Patch 6: `64434e61` (2026-08-09)
**Commit Message**: Fix sql-wasm.wasm 404 on GitHub Pages by patching absolute locateFile path

@cashapp/sqldelight-sqljs-worker bundles sql.js with a hardcoded
locateFile: file => "/sql-wasm.wasm", which resolves against the site
root instead of the /PeopleInSpace/ project-page subpath and 404s.
GitHub then serves its 404 HTML page in place of the wasm binary,
which the loader can't parse ("expected magic word... found <!DO"),
leaving the app stuck on "Loading astronauts...". Patch the built
chunk to use a relative path so it resolves correctly regardless of
the deployment subpath. Verified locally by serving the patched dist
output under a /PeopleInSpace/ subpath.

**File**: `.github/workflows/build-and-publish-web.yml` (modified, +6/-0)
```diff
@@ -28,6 +28,12 @@ jobs:
       - name: Build web app
         run: ./gradlew :compose-web:wasmJsBrowserDistribution
 
+      - name: Fix absolute sql-wasm.wasm path for project-page subpath
+        # @cashapp/sqldelight-sqljs-worker bundles sql.js with a hardcoded
+        # locateFile: file => "/sql-wasm.wasm", which 404s once the site is
+        # served from a subpath like /PeopleInSpace/ instead of the domain root.
+        run: sed -i 's#"/sql-wasm.wasm"#"sql-wasm.wasm"#g' compose-web/build/dist/wasmJs/productionExecutable/*.js
+
       - name: Deploy to GitHub Pages
         uses: JamesIves/github-pages-deploy-action@v4.9.0
         with:
```

---

### Incident Patch 7: `74e97252` (2026-08-09)
**Commit Message**: Add manual workflow to build and deploy web app to GitHub Pages

gh-pages hasn't been updated since 2022 and still serves the old
pre-Wasm JS client. This adds a workflow_dispatch job that builds the
current wasmJs Compose target and publishes it to gh-pages.

**File**: `.github/workflows/build-and-publish-web.yml` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+name: Build and Publish Web
+
+on:
+  workflow_dispatch:
+
+permissions:
+  contents: write
+
+concurrency:
+  group: build-and-publish-web-${{ github.ref }}
+  cancel-in-progress: false
+
+jobs:
+  build-and-publish:
+    runs-on: ubuntu-latest
+    timeout-minutes: 30
+    steps:
+      - uses: actions/checkout@v7
+
+      - name: set up JDK 17
+        uses: actions/setup-java@v5
+        with:
+          distribution: 'zulu'
+          java-version: 17
+
+      - uses: gradle/actions/setup-gradle@v6
+
+      - name: Build web app
+        run: ./gradlew :compose-web:wasmJsBrowserDistribution
+
+      - name: Deploy to GitHub Pages
+        uses: JamesIves/github-pages-deploy-action@v4.9.0
+        with:
+          token: ${{ secrets.GITHUB_TOKEN }}
+          branch: gh-pages
+          folder: compose-web/build/dist/wasmJs/productionExecutable
```

---

### Incident Patch 8: `2d29ba0d` (2026-07-18)
**Commit Message**: Improve wear OS UI following Wear M3 guidelines

- Add ListHeader screen title to person list
- Move ISS map action to an EdgeButton on ScreenScaffold
- Apply scroll transformations (scale/fade at screen edges) to list items
- Circular avatars; onSurfaceVariant token instead of hardcoded gray
- Details: circular photo, craft/nationality line, image loading placeholder

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `wearApp/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/list/PersonListScreen.kt` (modified, +34/-17)
```diff
@@ -11,9 +11,9 @@ import androidx.compose.runtime.getValue
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.ExperimentalComposeUiApi
 import androidx.compose.ui.Modifier
+import androidx.compose.foundation.shape.CircleShape
 import androidx.compose.ui.draw.clip
 import androidx.compose.ui.draw.scale
-import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.platform.testTag
 import androidx.compose.ui.res.painterResource
 import androidx.compose.ui.semantics.contentDescription
@@ -24,12 +24,15 @@ import androidx.lifecycle.compose.collectAsStateWithLifecycle
 import androidx.wear.compose.foundation.lazy.TransformingLazyColumn
 import androidx.wear.compose.foundation.lazy.rememberTransformingLazyColumnState
 import androidx.wear.compose.material3.Card
+import androidx.wear.compose.material3.EdgeButton
 import androidx.wear.compose.material3.Icon
-import androidx.wear.compose.material3.IconButtonDefaults
+import androidx.wear.compose.material3.ListHeader
 import androidx.wear.compose.material3.MaterialTheme
-import androidx.wear.compose.material3.OutlinedIconButton
 import androidx.wear.compose.material3.ScreenScaffold
+import androidx.wear.compose.material3.SurfaceTransformation
 import androidx.wear.compose.material3.Text
+import androidx.wear.compose.material3.lazy.rememberTransformationSpec
+import androidx.wear.compose.material3.lazy.transformedHeight
 import androidx.wear.compose.ui.tooling.preview.WearPreviewDevices
 import com.google.android.horologist.compose.layout.AppScaffold
 import com.google.android.horologist.compose.layout.ScalingLazyColumnDefaults.ItemType
@@ -68,29 +71,40 @@ fun PersonList(
 ) {
     val columnState = rememberTransformingLazyColumnState()
     val contentPadding =
-        rememberResponsiveColumnPadding(first = ItemType.Icon, last = ItemType.BodyText)
-    ScreenScaffold(scrollState = columnState, contentPadding = contentPadding) { contentPadding ->
+        rememberResponsiveColumnPadding(first = ItemType.Text, last = ItemType.Card)
+    ScreenScaffold(
+        scrollState = columnState,
+        contentPadding = contentPadding,
+        edgeButton = {
+            EdgeButton(onClick = issMapClick) {
+                // https://www.svgrepo.com/svg/170716/international-space-station
+                Icon(
+                    modifier = Modifier.scale(0.75f),
+                    painter = painterResource(id = R.drawable.ic_iss),
+                    contentDescription = "ISS Map"
+                )
+            }
+        }
+    ) { contentPadding ->
+        val transformationSpec = rememberTransformationSpec()
         TransformingLazyColumn(
             modifier = modifier
                 .testTag(PersonListTag),
             contentPadding = contentPadding,
             state = columnState,
         ) {
             item {
-                OutlinedIconButton(
-                    onClick = issMapClick,
-                    modifier = Modifier.size(IconButtonDefaults.DefaultButtonSize)
+                ListHeader(
+                    modifier = Modifier.transformedHeight(this, transformationSpec),
+                    transformation = SurfaceTransformation(transformationSpec)
                 ) {
-                    // https://www.svgrepo.com/svg/170716/international-space-station
-                    Icon(
-                        modifier = Modifier.scale(0.75f),
-                        painter = painterResource(id = R.drawable.ic_iss),
-                        contentDescription = "ISS Map"
-                    )
+                    Text("People in Space")
                 }
             }
             items(people.size) { offset ->
                 PersonView(
+                    modifier = Modifier.transformedHeight(this, transformationSpec),
+                    transformation = SurfaceTransformation(transformationSpec),
                     person = people[offset],
                     personSelected = personSelected
                 )
@@ -108,10 +122,12 @@ fun PersonList(
 fun PersonView(
     modifier: Modifier = Modifier,
     person: Assignment,
-    personSelected: (person: Assignment) -> Unit
+    personSelected: (person: Assignment) -> Unit,
+    transformation: SurfaceTransformation? = null,
 ) {
     Card(
         onClick = { personSelected(person) },
+        transformation = transformation,
         modifier = modifier
             .testTag(PersonTag)
             .semantics(mergeDescendants = true) {
@@ -126,7 +142,7 @@ fun PersonView(
             AstronautImage(
                 modifier = Modifier
                     .size(50.dp)
-                    .clip(MaterialTheme.shapes.medium),
+                    .clip(CircleShape),
                 person = person
             )
 
@@ -137,7 +153,8 @@ fun PersonView(
                 Text(
                     text = person.craft,
                     maxLines = 1,
-                    style = MaterialTheme.typography.bodyMedium.copy(color = Color.Gray)
+             
```

**File**: `wearApp/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/person/PersonDetailsScreen.kt` (modified, +14/-2)
```diff
@@ -3,7 +3,7 @@ package dev.johnoreilly.peopleinspace.peopleinspace.person
 import androidx.compose.foundation.background
 import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.size
-import androidx.compose.foundation.shape.CutCornerShape
+import androidx.compose.foundation.shape.CircleShape
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.remember
@@ -65,7 +65,7 @@ private fun PersonDetails(
                 AstronautImage(
                     modifier = Modifier
                         .size(120.dp)
-                        .clip(CutCornerShape(30.dp)),
+                        .clip(CircleShape),
                     person = person
                 )
             }
@@ -78,6 +78,17 @@ private fun PersonDetails(
                 )
             }
 
+            if (person != null) {
+                item {
+                    Text(
+                        listOfNotNull(person.craft, person.nationality).joinToString(" · "),
+                        style = MaterialTheme.typography.bodyMedium,
+                        color = MaterialTheme.colorScheme.onSurfaceVariant,
+                        textAlign = TextAlign.Center
+                    )
+                }
+            }
+
             val personBio = person?.personBio
             if (personBio != null) {
                 item {
@@ -101,6 +112,7 @@ fun AstronautImage(
         modifier = modifier,
         model = person?.personImageUrl,
         contentDescription = person?.name,
+        placeholder = painterResource(id = R.drawable.ic_american_astronaut),
         fallback = painterResource(id = R.drawable.ic_american_astronaut),
         error = painterResource(id = R.drawable.ic_american_astronaut)
     )
```

---

### Incident Patch 9: `7374eaae` (2026-07-18)
**Commit Message**: Fix wear app images by adding Coil network fetcher

Coil 3 moved HTTP loading to a separate artifact; without it no
network images load at all. Add coil3-network-ktor and register
KtorNetworkFetcherFactory in the wear ImageLoader, with the same
"PeopleInSpace" User-Agent as the phone app so Wikimedia-hosted
images work.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `wearApp/build.gradle.kts` (modified, +1/-0)
```diff
@@ -69,6 +69,7 @@ dependencies {
     implementation(libs.androidx.tiles.tooling.preview)
     implementation(libs.androidx.tiles)
     implementation(libs.coil3.compose)
+    implementation(libs.coil3.network.ktor)
 
     implementation(libs.koin.core)
     implementation(libs.koin.android)
```

**File**: `wearApp/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/di/AppModule.kt` (modified, +14/-0)
```diff
@@ -1,13 +1,18 @@
 package dev.johnoreilly.peopleinspace.peopleinspace.di
 
 import coil3.ImageLoader
+import coil3.network.ktor3.KtorNetworkFetcherFactory
 import coil3.request.crossfade
 import coil3.util.DebugLogger
 import coil3.util.Logger
 import dev.johnoreilly.peopleinspace.peopleinspace.list.PersonListViewModel
 import dev.johnoreilly.peopleinspace.peopleinspace.map.MapViewModel
 import dev.johnoreilly.peopleinspace.peopleinspace.person.PersonDetailsViewModel
 import dev.johnoreilly.peopleinspace.BuildConfig
+import io.ktor.client.HttpClient
+import io.ktor.client.plugins.defaultRequest
+import io.ktor.client.request.header
+import io.ktor.http.HttpHeaders
 import org.koin.android.ext.koin.androidContext
 import org.koin.core.module.dsl.viewModel
 import org.koin.dsl.module
@@ -26,6 +31,15 @@ val wearAppModule = module {
 val wearImageLoader = module {
     single {
         ImageLoader.Builder(androidContext())
+            .components {
+                add(KtorNetworkFetcherFactory(HttpClient {
+                    defaultRequest {
+                        // some image hosts (e.g. Wikimedia) reject requests with a
+                        // generic library User-Agent
+                        header(HttpHeaders.UserAgent, "PeopleInSpace")
+                    }
+                }))
+            }
             .crossfade(true)
             .apply {
                 if (BuildConfig.DEBUG) {
```

---

### Incident Patch 10: `592c067d` (2026-07-18)
**Commit Message**: Migrate to Koin compiler plugin and fix first-run loading state

- Replace KSP-based Koin annotations processing with the Koin compiler
  plugin (io.insert-koin.compiler.plugin 1.0.2): drop the KSP plugin,
  koin-ksp-compiler dependencies, generated source dir wiring and
  KOIN_CONFIG_CHECK; use typed startKoin<KoinApp>() API and updated
  org.koin.core.annotation.KoinViewModel import
- Align koin-annotations with the main Koin version (4.2.2)
- Keep PersonListUiState.Loading until the initial people fetch has
  completed so a fresh install shows the loading indicator instead of
  briefly flashing "No astronauts found" while the first sync runs
- Align kotlin-test force and androidx.concurrent constraints with
  Kotlin 2.4.0 / androidx.test.ext:truth 1.7.0
- Dependency updates (Compose Multiplatform 1.11.1, AGP 9.1.1,
  Ktor 3.5.1, coil 3.5.0, okhttp 5.4.0, skie 0.10.13, etc.)

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # PeopleInSpace
 
-![kotlin-version](https://img.shields.io/badge/kotlin-2.3.21-blue?logo=kotlin)
+![kotlin-version](https://img.shields.io/badge/kotlin-2.4.0-blue?logo=kotlin)
 
 
 **Kotlin Multiplatform** project with SwiftUI, Jetpack Compose, Compose for Wear OS, Compose for Desktop and Compose for Web clients along with Ktor backend. Currently running on
```

**File**: `app/build.gradle.kts` (modified, +8/-1)
```diff
@@ -10,8 +10,8 @@ kotlin {
 }
 
 android {
-    compileSdk = libs.versions.compileSdk.get().toInt()
 
+    compileSdk = 37
     defaultConfig {
         applicationId = "dev.johnoreilly.peopleinspace"
         minSdk = libs.versions.minSdk.get().toInt()
@@ -104,6 +104,13 @@ dependencies {
     androidTestImplementation(libs.androidx.truth)
     debugImplementation(libs.androidx.compose.ui.test.manifest)
 
+    constraints {
+        // androidx.test.ext:truth 1.7.0 needs 1.2.0; align main variant so the
+        // androidTest classpath (pinned to main variant versions) can resolve
+        implementation("androidx.concurrent:concurrent-futures:1.2.0")
+        implementation("androidx.concurrent:concurrent-futures-ktx:1.2.0")
+    }
+
 
     implementation(projects.common)
 }
```

**File**: `app/src/androidTest/java/dev/johnoreilly/peopleinspace/peopleinspace/PeopleInSpaceRepositoryFake.kt` (modified, +4/-0)
```diff
@@ -5,9 +5,13 @@ import dev.johnoreilly.common.remote.IssPosition
 import dev.johnoreilly.common.remote.OrbitPoint
 import dev.johnoreilly.common.repository.PeopleInSpaceRepositoryInterface
 import kotlinx.coroutines.flow.Flow
+import kotlinx.coroutines.flow.MutableStateFlow
+import kotlinx.coroutines.flow.StateFlow
 import kotlinx.coroutines.flow.flowOf
 
 class PeopleInSpaceRepositoryFake: PeopleInSpaceRepositoryInterface {
+    override val initialSyncCompleted: StateFlow<Boolean> = MutableStateFlow(true)
+
     val peopleList = listOf(Assignment("Apollo 11", "Neil Armstrong"),
         Assignment("Apollo 11", "Buzz Aldrin"))
 
```

**File**: `build.gradle.kts` (modified, +3/-4)
```diff
@@ -1,6 +1,5 @@
 plugins {
     alias(libs.plugins.android.application) apply false
-    alias(libs.plugins.ksp) apply false
     alias(libs.plugins.android.kotlin.multiplatform.library) apply false
     alias(libs.plugins.kotlinMultiplatform) apply false
     alias(libs.plugins.kotlinx.serialization) apply false
@@ -14,9 +13,9 @@ plugins {
 allprojects {
     configurations.all {
         resolutionStrategy {
-            force("org.jetbrains.kotlin:kotlin-test:2.3.21")
-            force("org.jetbrains.kotlin:kotlin-test-common:2.3.21")
-            force("org.jetbrains.kotlin:kotlin-test-annotations-common:2.3.21")
+            force("org.jetbrains.kotlin:kotlin-test:2.4.0")
+            force("org.jetbrains.kotlin:kotlin-test-common:2.4.0")
+            force("org.jetbrains.kotlin:kotlin-test-annotations-common:2.4.0")
         }
     }
 }
```

**File**: `common/build.gradle.kts` (modified, +1/-28)
```diff
@@ -1,15 +1,13 @@
 @file:OptIn(ExperimentalWasmDsl::class)
 
 import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
-import com.google.devtools.ksp.gradle.KspAATask
-import org.jetbrains.kotlin.gradle.tasks.KotlinCompilationTask
 
 plugins {
     alias(libs.plugins.kotlinMultiplatform)
     alias(libs.plugins.android.kotlin.multiplatform.library)
     alias(libs.plugins.kotlinx.serialization)
     alias(libs.plugins.sqlDelight)
-    alias(libs.plugins.ksp)
+    alias(libs.plugins.koin.compiler)
     alias(libs.plugins.jetbrainsCompose)
     alias(libs.plugins.compose.compiler)
     alias(libs.plugins.skie)
@@ -108,12 +106,6 @@ kotlin {
             implementation(devNpm("copy-webpack-plugin", libs.versions.webPackPlugin.get()))
         }
     }
-
-    // KSP Common sourceSet
-    sourceSets.named("commonMain").configure {
-        kotlin.srcDir("build/generated/ksp/metadata/commonMain/kotlin")
-    }
-
 }
 
 sqldelight {
@@ -143,22 +135,3 @@ skie {
         enableSwiftUIObservingPreview = true
     }
 }
-
-// KSP Tasks
-dependencies {
-    add("kspCommonMainMetadata", libs.koin.ksp.compiler)
-    add("kspAndroid", libs.koin.ksp.compiler)
-    add("kspIosArm64", libs.koin.ksp.compiler)
-    add("kspIosSimulatorArm64", libs.koin.ksp.compiler)
-    add("kspJvm", libs.koin.ksp.compiler)
-    add("kspWasmJs", libs.koin.ksp.compiler)
-}
-
-// KSP Metadata Trigger
-tasks.matching { it.name.startsWith("ksp") && it.name != "kspCommonMainKotlinMetadata" }.configureEach {
-    dependsOn("kspCommonMainKotlinMetadata")
-}
-
-ksp {
-    arg("KOIN_CONFIG_CHECK","true")
-}
\ No newline at end of file
```

**File**: `common/src/androidMain/kotlin/dev/johnoreilly/common/di/Koin.android.kt` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import dev.johnoreilly.common.viewmodel.PersonListViewModel
 import dev.johnoreilly.peopleinspace.db.PeopleInSpaceDatabase
 import io.ktor.client.engine.HttpClientEngine
 import io.ktor.client.engine.android.Android
-import org.koin.android.annotation.KoinViewModel
+import org.koin.core.annotation.KoinViewModel
 import org.koin.core.annotation.Module
 import org.koin.core.annotation.Single
 import org.koin.core.scope.Scope
```

**File**: `common/src/commonMain/kotlin/dev/johnoreilly/common/di/Koin.kt` (modified, +2/-3)
```diff
@@ -16,17 +16,16 @@ import org.koin.core.annotation.Configuration
 import org.koin.core.annotation.KoinApplication
 import org.koin.core.annotation.Module
 import org.koin.core.annotation.Single
-import org.koin.core.context.startKoin
 import org.koin.core.scope.Scope
 import org.koin.dsl.KoinAppDeclaration
 import org.koin.dsl.includes
-import org.koin.ksp.generated.startKoin
+import org.koin.plugin.module.dsl.startKoin
 
 @KoinApplication
 object KoinApp
 
 fun initKoin(enableNetworkLogs: Boolean = false, appDeclaration: KoinAppDeclaration? = null) =
-    KoinApp.startKoin {
+    startKoin<KoinApp> {
         includes(appDeclaration)
     }
 
```

**File**: `common/src/commonMain/kotlin/dev/johnoreilly/common/repository/PeopleInSpaceRepository.kt` (modified, +7/-0)
```diff
@@ -17,6 +17,9 @@ import org.koin.core.annotation.Single
 
 
 interface PeopleInSpaceRepositoryInterface {
+    // false until the first network fetch has finished (successfully or not),
+    // letting the UI distinguish "not fetched yet" from a genuinely empty result
+    val initialSyncCompleted: StateFlow<Boolean>
     fun fetchPeopleAsFlow(): Flow<List<Assignment>>
     fun pollISSPosition(): Flow<IssPosition>
     suspend fun fetchISSFuturePosition(): List<OrbitPoint>
@@ -35,11 +38,15 @@ class PeopleInSpaceRepository(
 
     val logger = Logger.withTag("PeopleInSpaceRepository")
 
+    private val _initialSyncCompleted = MutableStateFlow(false)
+    override val initialSyncCompleted: StateFlow<Boolean> = _initialSyncCompleted.asStateFlow()
+
     init {
         coroutineScope.launch {
             // TODO figure out cleaner place to invoke this (needed for web implementatin)
             PeopleInSpaceDatabase.Schema.awaitCreate(peopleInSpaceDatabase.driver)
             fetchAndStorePeople()
+            _initialSyncCompleted.value = true
         }
     }
 
```

---

### Incident Patch 11: `fefa86c6` (2026-05-24)
**Commit Message**: Pin iOS CI build to arm64 simulator

The :common KMP module no longer declares an iosX64() target (dropped
when bumping Compose Multiplatform to 1.11). Without a destination,
xcodebuild builds both arm64 and x86_64 simulator slices, and the
x86_64 slice has no matching KMP target — syncComposeResourcesForIos
fails with "Unknown iOS simulator arch: 'x86_64'". macos-15 runners
are Apple Silicon, so arm64-only is sufficient.

Co-Authored-By: Claude Opus 4.7 <[REDACTED_EMAIL]>

**File**: `.github/workflows/ios.yml` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ jobs:
           java-version: 17
 
       - name: Build iOS app
-        run: xcodebuild -workspace PeopleInSpaceSwiftUI/PeopleInSpaceSwiftUI.xcodeproj/project.xcworkspace -configuration Debug -scheme PeopleInSpaceSwiftUI -sdk iphonesimulator
+        run: xcodebuild -workspace PeopleInSpaceSwiftUI/PeopleInSpaceSwiftUI.xcodeproj/project.xcworkspace -configuration Debug -scheme PeopleInSpaceSwiftUI -destination 'generic/platform=iOS Simulator,arch=arm64'
 
 
 
```

---

### Incident Patch 12: `efc98247` (2026-01-04)
**Commit Message**: Fix launch

**File**: `app/src/debug/AndroidManifest.xml` (modified, +0/-4)
```diff
@@ -6,10 +6,6 @@
                 android:name=".peopleinspace.remotecompose.RemoteComposeTestActivity"
                 android:exported="true"
                 android:label="@string/app_name">
-            <intent-filter>
-                <action android:name="android.intent.action.MAIN" />
-                <category android:name="android.intent.category.LAUNCHER" />
-            </intent-filter>
         </activity>
     </application>
 
```

**File**: `app/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/glance/Fetch.kt` (modified, +21/-17)
```diff
@@ -53,25 +53,29 @@ suspend fun fetchMapBitmap(
     )
 
     val mapTileProvider = MapTileProviderBasic(context, source, null)
-    val bitmap = withContext(Dispatchers.Main) {
-        suspendCoroutine { cont ->
-            val mapSnapshot = MapSnapshot(
-                {
-                    if (it.status == MapSnapshot.Status.CANVAS_OK) {
-                        val bitmap = Bitmap.createBitmap(it.bitmap)
-                        cont.resume(bitmap)
-                    }
-                },
-                MapSnapshot.INCLUDE_FLAG_UPTODATE or MapSnapshot.INCLUDE_FLAG_SCALED,
-                mapTileProvider,
-                if (includeStationMarker) listOf(stationMarker) else listOf(),
-                projection
-            )
+    try {
+        val bitmap = withContext(Dispatchers.Main) {
+            suspendCoroutine { cont ->
+                val mapSnapshot = MapSnapshot(
+                    {
+                        if (it.status == MapSnapshot.Status.CANVAS_OK) {
+                            val bitmap = Bitmap.createBitmap(it.bitmap)
+                            cont.resume(bitmap)
+                        }
+                    },
+                    MapSnapshot.INCLUDE_FLAG_UPTODATE or MapSnapshot.INCLUDE_FLAG_SCALED,
+                    mapTileProvider,
+                    if (includeStationMarker) listOf(stationMarker) else listOf(),
+                    projection
+                )
 
-            launch(Dispatchers.IO) {
-                mapSnapshot.run()
+                launch(Dispatchers.IO) {
+                    mapSnapshot.run()
+                }
             }
         }
+        return bitmap.asImageBitmap()
+    } finally {
+        mapTileProvider.detach()
     }
-    return bitmap.asImageBitmap()
 }
\ No newline at end of file
```

**File**: `app/src/main/java/dev/johnoreilly/peopleinspace/peopleinspace/remotecompose/util/GeoUtils.kt` (modified, +35/-31)
```diff
@@ -125,32 +125,33 @@ suspend fun fetchMapBitmapInRange(
 
     val mapTileProvider = MapTileProviderBasic(context, TileSourceFactory.DEFAULT_TILE_SOURCE, null)
 
-    // Split the list of points into segments where they cross the dateline.
-    // This allows osmdroid's Polyline to draw separate lines instead of a single line wrapping
-    // across the globe.
-    val segments = mutableListOf<MutableList<GeoPoint>>()
-    if (geoPoints.isNotEmpty()) {
-        segments.add(mutableListOf(geoPoints.first()))
-        for (i in 1 until geoPoints.size) {
-            val prev = geoPoints[i - 1]
-            val curr = geoPoints[i]
-            // If the longitude jump is > 180, it's a dateline crossing.
-            if (kotlin.math.abs(curr.longitude - prev.longitude) > 180.0) {
-                segments.add(mutableListOf())
+    try {
+        // Split the list of points into segments where they cross the dateline.
+        // This allows osmdroid's Polyline to draw separate lines instead of a single line wrapping
+        // across the globe.
+        val segments = mutableListOf<MutableList<GeoPoint>>()
+        if (geoPoints.isNotEmpty()) {
+            segments.add(mutableListOf(geoPoints.first()))
+            for (i in 1 until geoPoints.size) {
+                val prev = geoPoints[i - 1]
+                val curr = geoPoints[i]
+                // If the longitude jump is > 180, it's a dateline crossing.
+                if (kotlin.math.abs(curr.longitude - prev.longitude) > 180.0) {
+                    segments.add(mutableListOf())
+                }
+                segments.last().add(curr)
             }
-            segments.last().add(curr)
         }
-    }
 
-    val pathSegments =
+        val pathSegments =
             points.map { op ->
                 val gp = op.toGeoPoint()
                 val point = Point()
                 projection.toPixels(gp, point)
                 Pair(op.t, Offset(point.x.toFloat(), point.y.toFloat()))
             }
 
-    val overlays =
+        val overlays =
             segments.map { segment ->
                 Polyline().apply {
                     setPoints(segment)
@@ -159,29 +160,32 @@ suspend fun fetchMapBitmapInRange(
                 }
             }
 
-    val bitmap: Bitmap =
+        val bitmap: Bitmap =
             withContext(Dispatchers.Main) {
                 suspendCoroutine { cont ->
                     val mapSnapshot =
-                            MapSnapshot(
-                                    { snapshot ->
-                                        if (snapshot.status == Status.CANVAS_OK) {
-                                            val b: Bitmap = snapshot.bitmap
-                                            cont.resume(Bitmap.createBitmap(b))
-                                        }
-                                    },
-                                    MapSnapshot.INCLUDE_FLAG_UPTODATE or
-                                            MapSnapshot.INCLUDE_FLAG_SCALED,
-                                    mapTileProvider,
-                                    overlays,
-                                    projection
-                            )
+                        MapSnapshot(
+                            { snapshot ->
+                                if (snapshot.status == Status.CANVAS_OK) {
+                                    val b: Bitmap = snapshot.bitmap
+                                    cont.resume(Bitmap.createBitmap(b))
+                                }
+                            },
+                            MapSnapshot.INCLUDE_FLAG_UPTODATE or
+                                    MapSnapshot.INCLUDE_FLAG_SCALED,
+                            mapTileProvider,
+                            overlays,
+                            projection
+                        )
 
                     // Start the snapshot generation on a background thread.
                     launch(Dispatchers.IO) { mapSnapshot.run() }
                 }
             }
-    return MapResult(bitmap.asImageBitmap(), pathSegments)
+        return MapResult(bitmap.asImageBitmap(), pathSegments)
+    } finally {
+        mapTileProvider.detach()
+    }
 }
 
 fun filterRecent(positions: List<OrbitPoint>): List<OrbitPoint> {
```

---

### Incident Patch 13: `00a05b9d` (2026-01-03)
**Commit Message**: Fix

**File**: `common/src/commonTest/kotlin/com/surrus/peopleinspace/PeopleInSpaceRepositoryFake.kt` (modified, +8/-0)
```diff
@@ -2,9 +2,12 @@ package dev.johnoreilly.peopleinspace
 
 import dev.johnoreilly.common.remote.Assignment
 import dev.johnoreilly.common.remote.IssPosition
+import dev.johnoreilly.common.remote.OrbitPoint
 import dev.johnoreilly.common.repository.PeopleInSpaceRepositoryInterface
 import kotlinx.coroutines.flow.Flow
 import kotlinx.coroutines.flow.flowOf
+import kotlin.time.Clock
+import kotlin.time.ExperimentalTime
 
 class PeopleInSpaceRepositoryFake: PeopleInSpaceRepositoryInterface {
     val peopleList = listOf(
@@ -23,6 +26,11 @@ class PeopleInSpaceRepositoryFake: PeopleInSpaceRepositoryInterface {
         return flowOf(issPosition)
     }
 
+    @OptIn(ExperimentalTime::class)
+    override suspend fun fetchISSFuturePosition(): List<OrbitPoint> {
+        return listOf(OrbitPoint(Clock.System.now().epochSeconds, issPosition.latitude, issPosition.longitude))
+    }
+
     override suspend fun fetchAndStorePeople() {
         // No-op for fake
     }
```

---

### Incident Patch 14: `b9191ffa` (2025-11-11)
**Commit Message**: Merge pull request #453 from luizgrp/remotepreview

Use RemotePreview from remote-tooling-preview library.

**File**: `app/build.gradle.kts` (modified, +1/-0)
```diff
@@ -89,6 +89,7 @@ dependencies {
     implementation(libs.androidx.remote.player.view)
     implementation(libs.androidx.remote.player.core)
     implementation(libs.androidx.remote.player.compose)
+    implementation(libs.androidx.remote.tooling.preview)
     implementation(libs.androidx.wear.remote.material3)
 
     implementation(libs.koin.core)
```

**File**: `app/src/main/AndroidManifest.xml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
     xmlns:tools="http://schemas.android.com/tools">
     <uses-permission android:name="android.permission.INTERNET" />
 
-    <uses-sdk tools:overrideLibrary="androidx.compose.remote.creation,androidx.compose.remote.player.compose,androidx.compose.remote.player.core,androidx.compose.remote.player.view,androidx.compose.remote.creation.compose,androidx.wear.compose.remote.material3,androidx.wear.compose.material.core,androidx.wear.compose.foundation,androidx.wear.compose.material3"/>
+    <uses-sdk tools:overrideLibrary="androidx.compose.remote.creation,androidx.compose.remote.player.compose,androidx.compose.remote.player.core,androidx.compose.remote.player.view,androidx.compose.remote.creation.compose,androidx.compose.remote.tooling.preview,androidx.wear.compose.remote.material3,androidx.wear.compose.material.core,androidx.wear.compose.foundation,androidx.wear.compose.material3"/>
 
     <application
             android:name=".PeopleInSpaceApplication"
```

**File**: `app/src/main/java/com/surrus/peopleinspace/remotecompose/PeopleInSpaceCard.kt` (modified, +1/-1)
```diff
@@ -12,6 +12,7 @@ import androidx.compose.remote.creation.compose.layout.rotate
 import androidx.compose.remote.creation.compose.modifier.RemoteModifier
 import androidx.compose.remote.creation.compose.modifier.background
 import androidx.compose.remote.creation.compose.modifier.fillMaxSize
+import androidx.compose.remote.tooling.preview.RemotePreview
 import androidx.compose.runtime.Composable
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.graphics.ImageBitmap
@@ -24,7 +25,6 @@ import androidx.compose.ui.platform.LocalResources
 import androidx.compose.ui.tooling.preview.Preview
 import androidx.core.graphics.drawable.toBitmap
 import androidx.vectordrawable.graphics.drawable.VectorDrawableCompat
-import com.surrus.peopleinspace.remotecompose.util.RemotePreview
 import dev.johnoreilly.peopleinspace.R
 import org.osmdroid.util.GeoPoint
 
```

**File**: `app/src/main/java/com/surrus/peopleinspace/remotecompose/util/RemotePreview.kt` (removed, +0/-71)
```diff
@@ -1,71 +0,0 @@
-/*
- * Copyright (C) 2025 The Android Open Source Project
- *
- * Licensed under the Apache License, Version 2.0 (the "License");
- * you may not use this file except in compliance with the License.
- * You may obtain a copy of the License at
- *
- *      http://www.apache.org/licenses/LICENSE-2.0
- *
- * Unless required by applicable law or agreed to in writing, software
- * distributed under the License is distributed on an "AS IS" BASIS,
- * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
- * See the License for the specific language governing permissions and
- * limitations under the License.
- */
-package com.surrus.peopleinspace.remotecompose.util
-
-import android.annotation.SuppressLint
-import androidx.compose.foundation.layout.Box
-import androidx.compose.foundation.layout.fillMaxSize
-import androidx.compose.remote.creation.compose.capture.RememberRemoteDocumentInline
-import androidx.compose.remote.creation.compose.layout.RemoteComposable
-import androidx.compose.remote.player.compose.RemoteDocumentPlayer
-import androidx.compose.remote.player.core.RemoteDocument
-import androidx.compose.runtime.Composable
-import androidx.compose.runtime.getValue
-import androidx.compose.runtime.mutableStateOf
-import androidx.compose.runtime.remember
-import androidx.compose.runtime.setValue
-import androidx.compose.ui.Modifier
-import androidx.compose.ui.platform.LocalWindowInfo
-
-/**
- * Display a RemoteCompose Composable in the Android Studio Preview.
- *
- * Currently only works in single Preview mode, where previews presumably run longer.
- */
-@SuppressLint("RestrictedApi")
-@Composable
-fun RemotePreview(
-    modifier: Modifier = Modifier,
-    content: @RemoteComposable @Composable () -> Unit
-) {
-    var documentState by remember { mutableStateOf<RemoteDocument?>(null) }
-
-    Box(modifier = modifier.fillMaxSize()) {
-        RememberRemoteDocumentInline(
-            onDocument = { doc ->
-                println("Document generated: $doc")
-                if (documentState == null) {
-                    // Generate seems to get called again with a partial document
-                    // Essentially re-recording but with existing state, so document is incomplete
-                    documentState = RemoteDocument(doc)
-                }
-            }
-        ) {
-            content()
-        }
-
-        if (documentState != null) {
-            val windowInfo = LocalWindowInfo.current
-            RemoteDocumentPlayer(
-                document = documentState!!.document,
-                windowInfo.containerSize.width,
-                windowInfo.containerSize.height,
-                modifier = Modifier.fillMaxSize(),
-                debugMode = 0,
-            )
-        }
-    }
-}
```

**File**: `gradle/libs.versions.toml` (modified, +1/-0)
```diff
@@ -162,6 +162,7 @@ androidx-remote-creation-compose = { module = "androidx.compose.remote:remote-cr
 androidx-remote-player-view = { module = "androidx.compose.remote:remote-player-view", version.ref = "remoteCompose" }
 androidx-remote-player-core = { module = "androidx.compose.remote:remote-player-core", version.ref = "remoteCompose" }
 androidx-remote-player-compose = { module = "androidx.compose.remote:remote-player-compose", version.ref = "remoteCompose" }
+androidx-remote-tooling-preview = { module = "androidx.compose.remote:remote-tooling-preview", version.ref = "remoteCompose" }
 androidx-wear-remote-material3 = { module = "androidx.wear.compose.remote:remote-material3", version.ref = "remoteCompose" }
 
 [bundles]
```

**File**: `settings.gradle.kts` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ pluginManagement {
             mavenCentral()
             gradlePluginPortal()
             maven {
-                url = uri("https://androidx.dev/snapshots/builds/14405968/artifacts/repository")
+                url = uri("https://androidx.dev/snapshots/builds/14417026/artifacts/repository")
             }
         }
     }
```

---

### Incident Patch 15: `06abf5bd` (2025-10-26)
**Commit Message**: Fix previews

**File**: `gradle/libs.versions.toml` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ targetWearSdk = "33"
 [libraries]
 androidx-protolayout-material3 = { module = "androidx.wear.protolayout:protolayout-material3", version.ref = "protolayout" }
 androidx-tiles = { module = "androidx.wear.tiles:tiles", version.ref = "tiles" }
+androidx-tiles-tooling = { module = "androidx.wear.tiles:tiles-tooling", version.ref = "tiles" }
 androidx-tiles-tooling-preview = { module = "androidx.wear.tiles:tiles-tooling-preview", version.ref = "tiles" }
 androidx-ui-tooling = { module = "androidx.compose.ui:ui-tooling", version.ref = "uiToolingPreview" }
 androidx-ui-tooling-preview = { module = "androidx.compose.ui:ui-tooling-preview", version.ref = "uiToolingPreview" }
```

**File**: `wearApp/build.gradle.kts` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ dependencies {
     implementation(libs.androidx.ui.tooling)
     implementation(libs.wear.ui.tooling)
     debugImplementation(libs.androidx.ui.tooling.preview)
-    debugImplementation("androidx.wear.tiles:tiles-tooling:1.5.0")
+    implementation(libs.androidx.tiles.tooling)
 
     implementation(libs.okhttp)
     implementation(libs.loggingInterceptor)
```

**File**: `wearApp/src/main/java/com/surrus/peopleinspace/tile/PeopleInSpaceList.kt` (modified, +48/-4)
```diff
@@ -101,7 +101,12 @@ fun peopleList(
             },
             bottomSlot = {
                 val clickable = with(protoLayoutScope) {
-                    clickable(id = "home", pendingIntent = homeIntent(context))
+                    val pendingIntent = homeIntent(context)
+                    if (pendingIntent != null) {
+                        clickable(id = "home", pendingIntent = pendingIntent)
+                    } else {
+                        clickable(id = "home")
+                    }
                 }
                 textEdgeButton(
                     onClick = clickable,
@@ -119,7 +124,12 @@ fun MaterialScope.peopleButton(
     context: Context
 ): LayoutElementBuilders.LayoutElement {
     val clickable = with(protoLayoutScope) {
-        clickable(id = person.name, pendingIntent = personIntent(person, context))
+        val pendingIntent = personIntent(person, context)
+        if (pendingIntent != null) {
+            clickable(id = person.name, pendingIntent = pendingIntent)
+        } else {
+            clickable(id = person.name)
+        }
     }
     return textButton(
         onClick = clickable,
@@ -160,7 +170,7 @@ internal fun namesPreview(context: Context): TilePreviewData {
     }
 }
 
-private fun personIntent(person: Assignment, context: Context): PendingIntent {
+private fun personIntent(person: Assignment, context: Context): PendingIntent? {
     val sessionDetailIntent = Intent(
         Intent.ACTION_VIEW,
         (DEEPLINK_URI + "personList/{${person.name}}").toUri()
@@ -174,7 +184,7 @@ private fun personIntent(person: Assignment, context: Context): PendingIntent {
     )
 }
 
-private fun homeIntent(context: Context): PendingIntent {
+private fun homeIntent(context: Context): PendingIntent? {
     val sessionDetailIntent = Intent(
         Intent.ACTION_VIEW,
         ("${DEEPLINK_URI}personList").toUri()
@@ -186,4 +196,38 @@ private fun homeIntent(context: Context): PendingIntent {
         sessionDetailIntent,
         FLAG_IMMUTABLE or FLAG_UPDATE_CURRENT
     )
+}
+
+@MultiRoundDevicesWithFontScalePreviews
+internal fun twoRowsPreview(context: Context): TilePreviewData {
+    val contacts = Data(
+        people = listOf(
+            Assignment(
+                "Apollo 11",
+                "Neil Armstrong",
+                "https://www.biography.com/.image/ar_1:1%2Cc_fill%2Ccs_srgb%2Cfl_progressive%2Cq_auto:good%2Cw_1200/MTc5OTk0MjgyMzk5MTE0MzYy/gettyimages-150832381.jpg"
+            ),
+            Assignment(
+                "Apollo 11",
+                "Buzz Aldrin",
+                "https://nypost.com/wp-content/uploads/sites/2/2018/06/buzz-aldrin.jpg?quality=80&strip=all"
+            ),
+            Assignment(
+                "Vostok 1",
+                "Yuri Gagarin",
+                "https://nypost.com/wp-content/uploads/sites/2/2018/06/buzz-aldrin.jpg?quality=80&strip=all"
+            ),
+            Assignment(
+                "Sputnik 2",
+                "Laika",
+                "https://nypost.com/wp-content/uploads/sites/2/2018/06/buzz-aldrin.jpg?quality=80&strip=all"
+            )
+        ), mapOf()
+    )
+    return TilePreviewData {
+        TilePreviewHelper.singleTimelineEntryTileBuilder(
+            peopleList(context, it.deviceConfiguration, contacts, it.scope)
+        )
+            .build()
+    }
 }
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #541** (2026-10-04): Maestro CI: keep debug output on failure, allow longer ISS screen wait (@joreilly)
- **PR #540** (2026-10-04): Batch Renovate dependency updates (@joreilly)
- **PR #539** (closed): Update dependency ubuntu to v26 - autoclosed (@renovate[bot])
- **PR #538** (2026-10-04): iOS CI: save konan cache only from main, keep caches warm (@joreilly)
- **PR #537** (closed): Update sqlDelight to v2.4.0 - autoclosed (@renovate[bot])
- **PR #536** (closed): Update dependency org.slf4j:slf4j-simple to v2.0.20 - autoclosed (@renovate[bot])
- **PR #535** (closed): Update dependency org.jetbrains.compose to v1.12.1 - autoclosed (@renovate[bot])
- **PR #534** (closed): Update dependency ch.qos.logback:logback-classic to v1.6.5 - autoclosed (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
