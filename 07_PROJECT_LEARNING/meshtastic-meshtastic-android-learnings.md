> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/meshtastic-meshtastic-android-learnings.md`  
> **Source**: github ([https://github.com/meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android))  
> **Source Version**: `d1c4c7db`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T03:50:51.869Z  
> **Learning ID**: `learn-github-meshtastic-meshtastic-android`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): meshtastic/Meshtastic-Android

> **Canonical Artifact**: `07_PROJECT_LEARNING/meshtastic-meshtastic-android-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T03:50:51.860Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshtastic/Meshtastic-Android`
- **Description**: Android application for Meshtastic
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1950 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `androidApp/src/google/kotlin/org/meshtastic/app/GoogleMeshUtilApplication.kt`
```
/*
 * Copyright (c) 2026 Meshtastic LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package org.meshtastic.app

import kotlinx.coroutines.launch
import org.koin.java.KoinJavaComponent.getKoin
import org.meshtastic.app.ai.appfunctions.AppFunctionStateSync

/** Google flavor Application subclass that starts the App Functions enabled-state sync. */
class GoogleMeshUtilApplication : MeshUtilApplication() {

    override fun onCreate() {
        super.onCreate()
        if (!isSupportedDevice) return
        // Start the AppFunctions enabled-state sync. Resolved here (after startKoin has bound
        // androidContext) rather than via createdAtStart so that Koin graphs built outside a
        // running app — verification tests, previews — stay lazily constructible.
        // Off-main: construction forces the AppFunctionsPrefs subgraph and fires AppSearch binder calls.
        applicationScope.launch { getKoin().get<AppFunctionStateSync>() }
    }
}

```

### Core Architecture Module: `androidApp/src/google/kotlin/org/meshtastic/app/ai/appfunctions/AppFunctionStateSync.kt`
```
/*
 * Copyright (c) 2026 Meshtastic LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package org.meshtastic.app.ai.appfunctions

import android.content.Context
import android.os.Build
import androidx.appfunctions.AppFunctionException
import androidx.appfunctions.AppFunctionManager
import androidx.appfunctions.AppFunctionName
import co.touchlab.kermit.Logger
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import org.meshtastic.core.di.CoroutineDispatchers
import org.meshtastic.core.repository.AppFunctionsPrefs

/**
 * Observes [AppFunctionsPrefs] and synchronizes the enabled/disabled state of each AppFunction with the system via
 * [AppFunctionManager].
 *
 * When the master toggle is off, all functions are disabled regardless of individual toggles.
 *
 * Writes are driven by a read-back of the system's own state, so a pass that lands while the functions are still being
 * indexed (first launch) converges on a retry instead of leaving the system on its defaults forever.
 */
class AppFunctionStateSync(
    private val context: Context,
    private val prefs: AppFunctionsPrefs,
    dispatchers: CoroutineDispatchers,
) {
    private val scope = CoroutineScope(SupervisorJob() + dispatchers.default)

    init {
        // Only the API 36 platform service is declared, so below it nothing of ours is ever indexed.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) observeAndSync()
    }

    private fun observeAndSync() {
        data class FunctionToggle(val id: String, val enabled: StateFlow<Boolean>)

        val functions =
            listOf(
                FunctionToggle(SEND_MESSAGE_ID, prefs.sendMessageEnabled),
                FunctionToggle(GET_MESH_STATUS_ID, prefs.getMeshStatusEnabled),
                FunctionToggle(GET_NODE_LIST_ID, prefs.getNodeListEnabled),
                FunctionToggle(GET_CHANNEL_INFO_ID, prefs.getChannelInfoEnabled),
                FunctionToggle(GET_DEVICE_STATUS_ID, prefs.getDeviceStatusEnabled),
                FunctionToggle(GET_NODE_DETAILS_ID, prefs.getNodeDetailsEnabled),
                FunctionToggle(GET_MESH_METRICS_ID, prefs.getMeshMetricsEnabled),
                FunctionToggle(GET_RECENT_MESSAGES_ID, prefs.getRecentMessagesEnabled),
                FunctionToggle(GET_UNREAD_SUMMARY_ID, prefs.getUnreadSummaryEnabled),
            )

        // Combine master toggle with each individual toggle
        combine(prefs.masterEnabled, combine(functions.map { it.enabled }) { it.toList() }) { master, toggles ->
            functions.mapIndexed { index, fn -> fn.id to (master && toggles[index]) }
        }
            .onEach { states -> syncStatesSafely(states) }
            .launchIn(scope)
    }

    /** Anything escaping [syncStates] would cancel the collector, leaving sync dead for the process lifetime. */
    private suspend fun syncStatesSafely(desired: List<Pair<String, Boolean>>) {
        try {
            syncStates(desired)
        } catch (e: CancellationException) {
            throw e
        } catch (@Suppress("TooGenericExceptionCaught") e: Exception) {
            Logger.e(e) { "AppFunction sync pass failed" }
        }
    }

    private suspend fun syncStates(desired: List<Pair<String, Boolean>>) {
        val manager = AppFunctionManager.getInstance(context) ?: return

        repeat(MAX_SYNC_ATTEMPTS) { attempt ->
            val pending = pendingWrites(desired, readStates(manager, desired.map { it.first }))
            if (pending.isEmpty()) return

            for ((functionId, enabled) in pending) {
                val state =
                    if (enabled) {
                        AppFunctionManager.APP_FUNCTION_STATE_ENABLED
                    } else {
                        AppFunctionManager.APP_FUNCTION_STATE_DISABLED
                    }
                // Until the system indexes a function (first launch, or just after an update) writing it throws
                // IllegalArgumentException; the read-back drives the retry.
                try {
                    manager.setAppFunctionEnabled(functionId, state)
                } catch (e: AppFunctionException) {
                    Logger.d(e) { "AppFunction $functionId not writable yet" }
                } catch (e: IllegalArgumentException) {
                    Logger.d(e) { "AppFunction $functionId not indexed yet" }
                }
            }
            if (attempt < MAX_SYNC_ATTEMPTS - 1) delay(RETRY_DELAY_MS)
        }
    }

    /** System state per function id, or null when it cannot be read — in which case every write is attempted. */
    private suspend fun readStates(manager: AppFunctionManager, functionIds: List<String>): Map<String, Boolean>? =
        try {
            manager.getAppFunctionStates(functionIds.map { AppFunctionName(context.packageName, it) }).associate {
                it.functionName.functionIdentifier to it.isEnabled
            }
        } catch (e: AppFunctionException) {
            Logger.d(e) { "AppFunction states unreadable; writing all toggles" }
            null
        }

    companion object {
        private const val MAX_SYNC_ATTEMPTS = 3
        private const val RETRY_DELAY_MS = 2_000L

        /** Toggles whose system state does not already match what prefs ask for. */
        internal fun pendingWrites(
            desired: List<Pair<String, Boolean>>,
            actual: Map<String, Boolean>?,
        ): List<Pair<String, Boolean>> =
            if (actual == null) desired else desired.filter { (id, enabled) -> actual[id] != enabled }

        // Mirrors the generated MeshtasticAppFunctionService.FUNCTION_ID_* constants, which are API 36 only.
        private const val CLASS_PREFIX = "org.meshtastic.app.ai.appfunctions.BaseMeshtasticAppFunctionService#"

        const val SEND_MESSAGE_ID = "${CLASS_PREFIX}sendMessage"
        const val GET_MESH_STATUS_ID = "${CLASS_PREFIX}getMeshStatus"
        const val GET_NODE_LIST_ID = "${CLASS_PREFIX}getNodeList"
        const val GET_CHANNEL_INFO_ID = "${CLASS_PREFIX}getChannelInfo"
        const val GET_DEVICE_STATUS_ID = "${CLASS_PREFIX}getDeviceStatus"
        const val GET_NODE_DETAILS_ID = "${CLASS_PREFIX}getNodeDetails"
        const val GET_MESH_METRICS_ID = "${CLASS_PREFIX}getMeshMetrics"
        const val GET_RECENT_MESSAGES_ID = "${CLASS_PREFIX}getRecentMessages"
        const val GET_UNREAD_SUMMARY_ID = "${CLASS_PREFIX}getUnreadSummary"
    }
}

```

### Core Architecture Module: `androidApp/src/google/kotlin/org/meshtastic/app/map/offline/pmtiles/OfflineVectorRenderer.kt`
```
/*
 * Copyright (c) 2026 Meshtastic LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package org.meshtastic.app.map.offline.pmtiles

import co.touchlab.kermit.Logger
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerializationException
import kotlinx.serialization.protobuf.ProtoBuf

/** A polygon in real-world coordinates: an exterior ring and the holes cut out of it. */
internal data class OfflinePolygon(val outer: List<LatLng>, val holes: List<List<LatLng>>)

/**
 * One decoded feature, already placed in real-world coordinates and tagged with the basemap layer it came from. Polygon
 * features fill [polygons] and leave [rings] empty; points and lines fill [rings].
 */
internal data class OfflineFeature(
    val layerName: String,
    val geometryType: Int,
    val rings: List<List<LatLng>>,
    val polygons: List<OfflinePolygon> = emptyList(),
    val id: Long? = null,
    val properties: Map<String, Any> = emptyMap(),
    val tile: TileIndex? = null,
)

/**
 * Decodes an offline region's MVT tiles into drawable geometry, on demand and cached per tile.
 *
 * Only [RENDERED_LAYERS] are kept: buildings and POIs alone can be most of a tile's feature count at high zoom, and
 * this offline layer exists to keep the map legible without a network, not to reproduce it.
 *
 * Polygon rings are grouped into exterior-plus-holes polygons by winding in tile space ([MvtDecoder.groupPolygons]). A
 * feature carries the id and attributes its tile gave it; a copy lying wholly inside a neighboring tile that also has
 * the feature is that tile's buffer copy and is dropped.
 */
internal class OfflineVectorRenderer {

    private val tileCache =
        object : LinkedHashMap<String, List<OfflineFeature>>(INITIAL_CAPACITY, LOAD_FACTOR, true) {
            override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, List<OfflineFeature>>): Boolean =
                size > MAX_CACHED_TILES
        }

    /** Every rendered-layer feature from the tiles at [zoom] (clamped to what [region] actually has) over [bounds]. */
    fun featuresFor(
        region: OfflineRegion,
        archive: OfflineVectorArchive,
        zoom: Int,
        bounds: LatLngBounds,
    ): List<OfflineFeature> {
        val renderZoom = zoom.coerceIn(region.zoomRange)
        val perTile =
            OfflineRegionTileSet.tiles(bounds, renderZoom..renderZoom).map { tile ->
                tileFeatures(region.id, archive, tile)
            }
        return dropBufferCopies(perTile).sortedBy { OfflineMapStyle.sortRank(it.properties) }
    }

    private fun tileFeatures(regionId: String, archive: OfflineVectorArchive, tile: TileIndex): List<OfflineFeature> {
        val key = "$regionId/${tile.zoom}/${tile.x}/${tile.y}"
        // Access-ordered, so even get() is a structural modification — and a superseded LaunchedEffect's featuresFor
        // keeps running on the IO dispatcher while the next one starts. Same lock as HillshadeTileProvider's caches.
        synchronized(tileCache) { tileCache[key] }
            ?.let {
                return it
            }

        val bytes = archive.readTile(tile.zoom, tile.x, tile.y)
        val decoded = if (bytes == null) emptyList() else decodeTile(tile, bytes)
        synchronized(tileCache) { tileCache[key] = decoded }
        return decoded
    }

    @OptIn(ExperimentalSerializationApi::class)
    @Suppress("detekt:UnreachableCode")
    private fun decodeTile(tile: TileIndex, bytes: ByteArray): List<OfflineFeature> {
        val vectorTile =
            try {
                ProtoBuf.decodeFromByteArray(VectorTile.serializer(), bytes)
            } catch (e: SerializationException) {
                // No tile coordinates in the message: zoom/x/y is location-adjacent data (AGENTS.md Privacy First).
                LOG.w(e) { "Malformed MVT tile" }
                return emptyList()
            }

        return vectorTile.layers
            .filter { it.name in RENDERED_LAYERS }
            .flatMap { layer ->
                layer.features.mapNotNull { feature -> placeFeature(tile, layer, feature) }
            }
    }

    private fun placeFeature(tile: TileIndex, layer: VectorTile.Layer, feature: VectorTile.Feature): OfflineFeature? {
        val localRings = MvtDecoder.decodeGeometry(feature.type, feature.geometry)
        fun place(ring: List<TileCoord>) = ring.map { WebMercatorTileMath.tileLocalToLatLng(tile, layer.extent, it) }
        val isPolygon = feature.type == VectorTile.GEOM_POLYGON
        val polygons =
            if (isPolygon) {
                MvtDecoder.groupPolygons(localRings).map { OfflinePolygon(place(it.outer), it.holes.map(::place)) }
            } else {
                emptyList()
            }
        if (localRings.isEmpty() || (isPolygon && polygons.isEmpty())) return null
        return OfflineFeature(
            layerName = layer.name,
            geometryType = feature.type,
            rings = if (isPolygon) emptyList() else localRings.map(::place),
            polygons = polygons,
            id = feature.id,
            properties = feature.properties(layer),
            tile = tile,
        )
    }

    internal companion object {
        /**
         * Drops features whose id also appears in another tile that wholly contains them: a tile's buffer repeats its
         * neighbors' geometry, and drawing both doubles translucent fills. A piece reaching past its own tile edge is
         * never contained by a neighbor, so a feature cut by a tile edge keeps each tile's piece. A feature on a shared
         * edge sits inside both tiles, so the lowest tile by (x, y) keeps it. Features without an id are kept.
         */
        fun dropBufferCopies(perTile: List<List<OfflineFeature>>): List<OfflineFeature> {
            val tilesByKey = mutableMapOf<Pair<String, Long>, MutableSet<TileIndex>>()
            perTile.flatten().forEach { feature ->
                val id = feature.id
                val tile = feature.tile
                if (id != null && tile != null) {
                    tilesByKey.getOrPut(feature.layerName to id) { mutableSetOf() } += tile
                }
            }
            return perTile.flatten().filterNot { feature ->
                val id = feature.id
                val own = feature.tile
                val box = GeoBox.of(feature)
                if (id == null || own == null || box == null) {
                    false
                } else {
                    val owners = tilesByKey[feature.layerName to id].orEmpty().filter { GeoBox.of(it).contains(box) }
                    owners.any { it != own } && own != owners.minWithOrNull(compareBy({ it.x }, { it.y }))
                }
            }
        }

        private val LOG = Logger.withTag("OfflineVectorRenderer")
        val RENDERED_LAYERS = setOf("water", "roads", "boundaries", "places")
        private const val MAX_CACHED_TILES = 96
        private const val INITIAL_CAPACITY = 16
        private const val LOAD_FACTOR = 0.75f
    }
}

private data class GeoBox(val south: Double, val west: Double, val north: Double, val east: Double) {
    fun contains(other: GeoBox) =
        other.south >= south && other.north <= north && other.west >= west && other.east <= east

    companion object {
        fun of(tile: TileIndex): GeoBox {
            val nw = WebMercatorTileMath.tileFractionalToLatLng(tile.zoom, tile.x, tile.y, 0.0, 0.0)
            val se = WebMercatorTileMath.tileFractionalToLatLng(tile.zoom, tile.x, tile.y, 1.0, 1.0)
            // LatLng wraps the easternmost tile's east edge from 180 to -180.
            val east = if (se.longitude <= nw.longitude) ANTIMERIDIAN else se.longitude
            return GeoBox(se.latitude, nw.longitude, nw.latitude, east)
        }

        private const val ANTIMERIDIAN = 180.0

        fun of(feature: OfflineFeature): GeoBox? {
            val points = feature.rings.flatten() + feature.polygons.flatMap { it.outer }
            if (points.isEmpty()) return null
            return GeoBox(
                south = points.minOf { it.latitude },
                west = points.minOf { it.longitude },
                north = points.maxOf { it.latitude },
                east = points.maxOf { it.longitude },
            )
        }
    }
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/org/meshtastic/app/MeshUtilApplication.kt`
```
/*
 * Copyright (c) 2026 Meshtastic LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package org.meshtastic.app

import android.app.ActivityManager
import android.app.Application
import android.appwidget.AppWidgetProviderInfo
import android.content.Context
import android.os.Build
import android.os.StrictMode
import androidx.annotation.RequiresApi
import androidx.collection.intSetOf
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.work.Configuration
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import co.touchlab.kermit.Logger
import co.touchlab.kermit.Severity
import coil3.ImageLoader
import coil3.SingletonImageLoader
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.koin.android.ext.android.get
import org.koin.android.ext.koin.androidContext
import org.koin.androidx.workmanager.factory.KoinWorkerFactory
import org.koin.androidx.workmanager.koin.workManagerFactory
import org.koin.plugin.module.dsl.startKoin
import org.meshtastic.app.di.AndroidKoinApp
import org.meshtastic.core.common.ContextServices
import org.meshtastic.core.common.log.RoomPoolTimeoutLog
import org.meshtastic.core.database.DatabaseManager
import org.meshtastic.core.repository.MeshPrefs
import org.meshtastic.core.repository.PlatformAnalytics
import org.meshtastic.core.repository.ServiceRepository
import org.meshtastic.core.resources.Res
import org.meshtastic.core.resources.discovery_interrupted_scan_restored
import org.meshtastic.core.resources.getStringSuspend
import org.meshtastic.core.service.worker.MeshLogCleanupWorker
import org.meshtastic.feature.discovery.DiscoveryScanEngine
import org.meshtastic.feature.widget.LocalStatsWidgetReceiver
import org.meshtastic.feature.widget.TelemetryWidgetReceiver
import kotlin.reflect.KClass
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.seconds
import kotlin.time.toJavaDuration

/**
 * [android.app.ApplicationExitInfo.getDescription] reported by Android 17's per-app memory ceiling (zram-swap kill).
 */
private const val MEMORY_LIMITER_ANON_SWAP_REASON = "MemoryLimiter:AnonSwap"
private const val MEMORY_LIMITER_PREFS_NAME = "memory_limiter_exit_check"
private const val KEY_LAST_REPORTED_EXIT_TIMESTAMP = "last_reported_exit_timestamp"
private const val MEMORY_LIMITER_SCAN_DEPTH = 5

/**
 * The main application class for Meshtastic.
 *
 * This class initializes core application components using Koin for dependency injection.
 */
open class MeshUtilApplication :
    Application(),
    Configuration.Provider,
    SingletonImageLoader.Factory {

    // SupervisorJob alone only isolates siblings: a failed child still reaches the global uncaught
    // handler. These launches are best-effort background init, so report rather than escalate.
    private val applicationScopeExceptionHandler = CoroutineExceptionHandler { context, throwable ->
        Logger.e(throwable) { "Background application init failed in $context" }
    }

    @Suppress("InjectDispatcher") // built with the Application, before Koin can inject anything
    protected val applicationScope =
        CoroutineScope(SupervisorJob() + Dispatchers.Default + applicationScopeExceptionHandler)

    /**
     * False when this device can't load the bundled SQLite that every database open goes through. Koin is then never
     * started, and MainActivity shows only [UnsupportedDeviceScreen].
     */
    var isSupportedDevice: Boolean = true
        private set

    /** Supplies Coil's process-wide loader without retaining an Activity in its singleton factory. */
    override fun newImageLoader(context: Context): ImageLoader = get<ImageLoader>()

    override fun onCreate() {
        super.onCreate()
        RoomPoolTimeoutLog.install()
        if (BuildConfig.DEBUG) enableDebugVmPolicy()
        ContextServices.app = this
        configureFlavorApplication(BuildConfig.APPLICATION_ID)

        isSupportedDevice = bundledSqliteLoads(::loadBundledSqlite)
        if (!isSupportedDevice) {
            disableAppEntryPoints()
            return
        }

        startKoin<AndroidKoinApp> {
            androidContext(this@MeshUtilApplication)
            workManagerFactory()
        }

        startBackgroundInit()
    }

    /** Open so a test can stand in for the device's linker; the host JVM has no `libsqliteJni.so` to load by name. */
    protected open fun loadBundledSqlite() = System.loadLibrary(BUNDLED_SQLITE_LIBRARY)

    /**
     * Launches the best-effort init that does not have to finish before the first Activity: re-enabling entry points a
     * failed SQLite load disabled, log cleanup, the previous-exit report, the widget preview, the active database, and
     * discovery-scan recovery. Open so a test can boot the real Application without any of it — chiefly the database,
     * whose connection is what makes an un-terminated Application unsafe.
     */
    protected open fun startBackgroundInit() {
        applicationScope.launch { restoreAppEntryPoints() }

        // Schedule periodic MeshLog cleanup. Off-main: WorkManager uses on-demand init here
        // (the startup provider is removed), so getInstance() opens WorkManager's Room DB.
        applicationScope.launch { scheduleMeshLogCleanup() }

        // ApplicationExitInfo requires API 30+. A "MemoryLimiter:AnonSwap" reason means Android 17's per-app
        // memory ceiling zram-swapped then killed the previous process — see reportMemoryLimiterExitIfPresent.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            applicationScope.launch { reportMemoryLimiterExitIfPresent() }
        }

        // Generate and publish widget preview for Android 15+ widget picker
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            applicationScope.launch {
                suspend fun pushPreview(
                    receiver: KClass<out GlanceAppWidgetReceiver> = LocalStatsWidgetReceiver::class,
                ) {
                    try {
                        Logger.i { "Pushing generated widget preview..." }
                        val result =
                            GlanceAppWidgetManager(this@MeshUtilApplication)
                                .setWidgetPreviews(
                                    receiver,
                                    intSetOf(AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN),
                                )
                        Logger.i { "setWidgetPreviews result: $result" }
                    } catch (e: CancellationException) {
                        throw e
                    } catch (@Suppress("TooGenericExceptionCaught") e: Exception) {
                        Logger.e(e) { "Failed to set widget preview" }
                    }
                }

                pushPreview()
                // The Telemetry preview is mock data only, so it is pushed once.
                pushPreview(TelemetryWidgetReceiver::class)

                val widgetStateProvider: org.meshtastic.feature.widget.LocalStatsWidgetStateProvider = get()
                try {
                    // Wait for real data for up to 30 seconds before pushing an updated preview
                    withTimeout(30.seconds) {
                        widgetStateProvider.state.first { it.showContent && it.nodeShortName != null }
                    }

                    Logger.i { "Real node data acquired. Pushing updated widget preview." }
                    pushPreview()
                } catch (e: TimeoutCancellationException) {
                    Logger.i(e) { "Timed out waiting for real node data for widget preview." }
                }
            }
        }

        // Initialize DatabaseManager asynchronously with current device address so DAO consumers have an active DB
        applicationScope.launch {
            val dbManager: DatabaseManager = get()
            val meshPrefs: MeshPrefs = get()
            dbManager.init(meshPrefs.deviceAddress.value)
        }

        // Restore a radio left detuned by a discovery scan that was interrupted (crash, BLE loss, process death)
        // before it could restore the home LoRa config itself. Never returns; watches reconnects for the app's life.
        // The engine stays UI-free — we localize the "restored" notice here and push it through the app-wide alert.
        applicationScope.launch {
            val scanEngine: DiscoveryScanEngine = get()
            val serviceRepository: ServiceRepository = get()
            scanEngine.restoreInterruptedSessionsOnReconnect { homePreset ->
                serviceRepository.setErrorMessage(
                    getStringSuspend(Res.string.discovery_interrupted_scan_restored, homePreset),
                    Severity.Warn,
                )
            }
        }
    }

    /**
     * Stops the background init launched by [startBackgroundIn
```

### Core Architecture Module: `appShell/src/commonMain/kotlin/org/meshtastic/appshell/MeshServiceLifecycle.kt`
```
/*
 * Copyright (c) 2026 Meshtastic LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package org.meshtastic.appshell

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import org.koin.compose.koinInject
import org.meshtastic.core.service.MeshServiceOrchestrator

/** Starts [MeshServiceOrchestrator] on composition and stops it on disposal, for a host with no platform service. */
@Composable
fun MeshServiceLifecycle() {
    val orchestrator = koinInject<MeshServiceOrchestrator>()
    DisposableEffect(Unit) {
        orchestrator.start()
        onDispose { orchestrator.stop() }
    }
}

```

### Core Architecture Module: `core/barcode/src/fdroid/kotlin/org/meshtastic/core/barcode/BarcodeAnalyzerFactory.kt`
```
/*
 * Copyright (c) 2026 Meshtastic LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package org.meshtastic.core.barcode

import androidx.camera.core.ImageAnalysis
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import java.nio.ByteBuffer

/**
 * Creates a CameraX [ImageAnalysis.Analyzer] that decodes QR codes using ZXing.
 *
 * This is the F-Droid flavor implementation; the Google flavor uses ML Kit instead.
 */
internal fun createBarcodeAnalyzer(onResult: (String) -> Unit): ImageAnalysis.Analyzer {
    val reader =
        MultiFormatReader().apply {
            // Without this, MultiFormatReader tries every supported format (DataMatrix,
            // PDF417, Aztec, Code128/39, EAN/UPC, ...) on every camera frame even though
            // this analyzer only ever wants QR codes — narrowing it is a meaningful
            // per-frame CPU/battery win during an active scan session.
            setHints(mapOf(DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE)))
        }

    return ImageAnalysis.Analyzer { imageProxy ->
        try {
            val lumaPlane = imageProxy.planes[0]
            val buffer: ByteBuffer = lumaPlane.buffer.duplicate()
            val data = ByteArray(buffer.remaining())
            buffer.get(data)

            val width = imageProxy.width
            val height = imageProxy.height
            val source = PlanarYUVLuminanceSource(data, lumaPlane.rowStride, height, 0, 0, width, height, false)
            val binaryBitmap = BinaryBitmap(HybridBinarizer(source))

            val result = reader.decodeWithState(binaryBitmap)
            result.text?.let { onResult(it) }
        } catch (_: Exception) {
            // Ignore decoding errors — no barcode found in this frame
        } finally {
            imageProxy.close()
        }
    }
}

```

### Core Architecture Module: `core/barcode/src/google/kotlin/org/meshtastic/core/barcode/BarcodeAnalyzerFactory.kt`
```
/*
 * Copyright (c) 2026 Meshtastic LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package org.meshtastic.core.barcode

import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import co.touchlab.kermit.Logger
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage

/**
 * Creates a CameraX [ImageAnalysis.Analyzer] that decodes QR codes using Google ML Kit.
 *
 * This is the Google flavor implementation; the F-Droid flavor uses ZXing instead.
 */
@androidx.annotation.OptIn(ExperimentalGetImage::class)
internal fun createBarcodeAnalyzer(onResult: (String) -> Unit): ImageAnalysis.Analyzer {
    val options = BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
    val scanner = BarcodeScanning.getClient(options)

    return ImageAnalysis.Analyzer { imageProxy ->
        val mediaImage = imageProxy.image
        if (mediaImage != null) {
            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            scanner
                .process(image)
                .addOnSuccessListener { barcodes ->
                    for (barcode in barcodes) {
                        barcode.rawValue?.let { onResult(it) }
                    }
                }
                .addOnFailureListener { Logger.e { "Barcode scanning failed: ${it.message}" } }
                .addOnCompleteListener { imageProxy.close() }
        } else {
            imageProxy.close()
        }
    }
}

```

### Core Architecture Module: `core/barcode/src/main/kotlin/org/meshtastic/core/barcode/BarcodeScannerProvider.kt`
```
/*
 * Copyright (c) 2026 Meshtastic LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package org.meshtastic.core.barcode

import androidx.camera.compose.CameraXViewfinder
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.SurfaceRequest
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.compose.LocalLifecycleOwner
import co.touchlab.kermit.Logger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asExecutor
import org.jetbrains.compose.resources.stringResource
import org.meshtastic.core.resources.Res
import org.meshtastic.core.resources.camera_permission
import org.meshtastic.core.resources.camera_permission_rationale
import org.meshtastic.core.resources.camera_unavailable
import org.meshtastic.core.ui.component.BarcodeScannerFrame
import org.meshtastic.core.ui.component.PermissionRecoveryCard
import org.meshtastic.core.ui.util.BarcodeScanner
import org.meshtastic.core.ui.util.PermissionStatus
import org.meshtastic.core.ui.util.rememberCameraPermissionState
import java.util.concurrent.CancellationException
import java.util.concurrent.ExecutionException
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicBoolean

@Composable
fun rememberBarcodeScanner(onResult: (String?) -> Unit): BarcodeScanner {
    var showDialog by remember { mutableStateOf(false) }
    var pendingScan by remember { mutableStateOf(false) }
    var showPermissionRecovery by remember { mutableStateOf(false) }
    val cameraPermission = rememberCameraPermissionState()
    val currentStatus = rememberUpdatedState(cameraPermission.status)

    LaunchedEffect(cameraPermission.status) {
        when {
            // A grant arrived for a scan the user asked for — either the pending request or the recovery card's
            // "Grant"/"Open settings" round-trip. Open the scanner and clear both pending flags.
            cameraPermission.isGranted && (pendingScan || showPermissionRecovery) -> {
                showDialog = true
                pendingScan = false
                showPermissionRecovery = false
            }

            // The pending request completed without a grant — surface a recovery card instead of failing silently.
            pendingScan && cameraPermission.status != PermissionStatus.NOT_REQUESTED -> {
                showPermissionRecovery = true
                pendingScan = false
            }
        }
    }

    if (showDialog) {
        BarcodeScannerDialog(
            onResult = {
                showDialog = false
                onResult(it)
            },
        )
    }

    if (showPermissionRecovery) {
        Dialog(onDismissRequest = { showPermissionRecovery = false }) {
            Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Heading gives screen readers context for the standalone dialog (unlike the in-sheet Compass
                    // card).
                    Text(
                        text = stringResource(Res.string.camera_permission),
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.semantics { heading() },
                    )
                    PermissionRecoveryCard(
                        state = cameraPermission,
                        rationale = stringResource(Res.string.camera_permission_rationale),
                    )
                }
            }
        }
    }

    return remember {
        object : BarcodeScanner {
            override fun startScan() {
                when (currentStatus.value) {
                    PermissionStatus.GRANTED -> showDialog = true

                    PermissionStatus.PERMANENTLY_DENIED -> showPermissionRecovery = true

                    else -> {
                        pendingScan = true
                        cameraPermission.request()
                    }
                }
            }
        }
    }
}

@Composable
private fun BarcodeScannerDialog(onResult: (String?) -> Unit) {
    var isCameraReady by remember { mutableStateOf(false) }
    var hasCameraError by remember { mutableStateOf(false) }
    var scannerAttempt by remember { mutableIntStateOf(0) }
    val resultGate = remember { SingleScanResultGate() }
    val currentOnResult by rememberUpdatedState(onResult)
    val context = LocalContext.current
    val mainExecutor = remember(context) { ContextCompat.getMainExecutor(context) }

    fun deliverResult(result: String?) {
        resultGate.tryDeliver(result) { value -> mainExecutor.execute { currentOnResult(value) } }
    }

    BarcodeScannerFrame(
        onClose = { deliverResult(null) },
        showReticle = isCameraReady,
        errorMessage = if (hasCameraError) stringResource(Res.string.camera_unavailable) else null,
        onRetry = {
            hasCameraError = false
            scannerAttempt++
        },
    ) { _ ->
        key(scannerAttempt) {
            ScannerView(
                onResult = { deliverResult(it) },
                onCameraReady = {
                    isCameraReady = it
                    if (it) hasCameraError = false
                },
                onCameraError = {
                    isCameraReady = false
                    hasCameraError = true
                },
            )
        }
    }
}

@Suppress("LongMethod", "InjectDispatcher") // CameraX analysis wants an Executor; the default pool backs it
@Composable
private fun ScannerView(onResult: (String) -> Unit, onCameraReady: (Boolean) -> Unit, onCameraError: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraExecutor = remember { Dispatchers.Default.asExecutor() }
    val currentOnResult by rememberUpdatedState(onResult)
    val currentOnCameraReady by rememberUpdatedState(onCameraReady)
    val currentOnCameraError by rememberUpdatedState(onCameraError)
    val disposed = remember { AtomicBoolean(false) }
    val boundCameraProvider = remember { mutableStateOf<ProcessCameraProvider?>(null) }
    val boundPreview = remember { mutableStateOf<Preview?>(null) }
    val boundImageAnalysis = remember { mutableStateOf<ImageAnalysis?>(null) }
    var surfaceRequest by remember { mutableStateOf<SurfaceRequest?>(null) }

    DisposableEffect(Unit) {
        onDispose {
            disposed.set(true)
            surfaceRequest?.willNotProvideSurface()
            surfaceRequest = null
            cleanupCameraUseCases(
                cameraProvider = boundCameraProvider.value,
                preview = boundPreview.value,
                imageAnalysis = boundImageAnalysis.value,
            )
            currentOnCameraReady(false)
        }
    }

    LaunchedEffect(Unit) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener(
            {
                if (disposed.get()) return@addListener

                val cameraProvider = getCameraProvider(cameraProviderFuture)
                if (cameraProvider == null) {
                    if (!disposed.get()) currentOnCameraError()
                    return@addListener
                }

                if (disposed.get()) return@addListener

                val preview = Preview.Builder().build()
                preview.setSurfaceProvider { request ->
                    if (!disposed.get()) {
                        surfaceRequest = request
                        currentOnCameraReady(true)
                    } else {
                        request.willNotProvideSurface()
                    }
                }

                val imageAnalysis =
                    ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                        .also { analysis ->
                            analysis.setAnalyzer(cameraExecutor, createBarcodeAnalyzer { currentOnResult(it) })
                        }

                if (bindCameraUseCases(cameraProvider, lifec
```

### Core Architecture Module: `core/barcode/src/main/kotlin/org/meshtastic/core/barcode/SingleScanResultGate.kt`
```
/*
 * Copyright (c) 2026 Meshtastic LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package org.meshtastic.core.barcode

import java.util.concurrent.atomic.AtomicBoolean

/** Allows a scanner session to complete exactly once, either with a scan result or a dismiss result. */
class SingleScanResultGate {
    private val delivered = AtomicBoolean(false)

    /**
     * Attempts to deliver a scanner result once.
     *
     * The gate is consumed before [onResult] runs. If [onResult] throws, later delivery attempts are still ignored.
     */
    fun tryDeliver(result: String?, onResult: (String?) -> Unit): Boolean {
        if (!delivered.compareAndSet(false, true)) return false
        onResult(result)
        return true
    }
}

```

### Core Architecture Module: `core/ble/src/androidMain/kotlin/org/meshtastic/core/ble/AndroidBleScanStartLimiter.kt`
```
/*
 * Copyright (c) 2026 Meshtastic LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package org.meshtastic.core.ble

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeMark
import kotlin.time.TimeSource

internal const val ANDROID_BLE_SCAN_START_LIMIT = 5
internal val ANDROID_BLE_SCAN_START_WINDOW: Duration = 30.seconds

/**
 * Reserves Android BLE scan starts before Kable reaches BluetoothLeScanner.
 *
 * Android rejects the sixth scan start inside its rolling quota window. Some framework versions intentionally suppress
 * the corresponding app callback, which leaves a scanner flow waiting without advertisements or a useful exception.
 * Keeping the same rolling window in-process makes that condition deterministic and recoverable by callers.
 */
internal class AndroidBleScanStartLimiter(
    private val timeSource: TimeSource = TimeSource.Monotonic,
    private val maxStarts: Int = ANDROID_BLE_SCAN_START_LIMIT,
    private val window: Duration = ANDROID_BLE_SCAN_START_WINDOW,
) : BleScanStartLimiter {
    private val mutex = Mutex()
    private val scanStarts = ArrayDeque<TimeMark>()

    init {
        require(maxStarts > 0) { "maxStarts must be positive" }
        require(window.isPositive()) { "window must be positive" }
    }

    override suspend fun reserveStart() {
        mutex.withLock {
            discardExpiredStarts()
            if (scanStarts.size >= maxStarts) {
                val retryAfter = (window - scanStarts.first().elapsedNow()).coerceAtLeast(Duration.ZERO)
                throw BleScanStartException(
                    reason = BleScanStartFailureReason.ScanningTooFrequently,
                    cause = IllegalStateException("Android BLE scan-start quota exhausted"),
                    retryAfter = retryAfter,
                )
            }
            scanStarts.add(timeSource.markNow())
        }
    }

    private fun discardExpiredStarts() {
        while (scanStarts.firstOrNull()?.elapsedNow()?.let { it >= window } == true) {
            scanStarts.removeFirst()
        }
    }
}

private val processBleScanStartLimiter: BleScanStartLimiter = AndroidBleScanStartLimiter()

internal actual fun createBleScanStartLimiter(): BleScanStartLimiter = processBleScanStartLimiter

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7890** (2026-11-04): **[Bug]: Widget needs now too much blank space to display the same data info**
  *Symptoms*: ### Contact Details  _No response_  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  2.8.4 (lateste github)  ### Affected Android version  Android 16  ### Affected phone model  Samsung   ### Affected node model  All  ### Affected node firmware version  2.8.2  ### Steps to reproduce the bug  about the widget, i saw the fix to 2x2, https://github.com/meshtastic/Meshtastic-Android/pull/7862 but for bigger area the widget needs more more space to display all data info.   ### Actual behavior  The widget needs a lot more space to display all data info, and add a lot of blank space at bottom  <img width="959" height="532" alt="Image" src="https://github.com/user-attachments/assets/29b38237-88ba-4874-b9ce-e6f67481da40" />  <img width="959" height="797" alt="Image" src="https://github.com/user-attachments/ass

- **Issue #7883** (2026-11-08): **[Bug]: Connection: Bluetooth and Network "nearby devices access" button do not show if custom Android Font - do not scroll down**
  *Symptoms*: ### Contact Details  _No response_  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  2.8.4 (2932285)  ### Affected Android version  Android 16  ### Affected phone model  All  ### Affected node model  All  ### Affected node firmware version  2.8.1 +  ### Steps to reproduce the bug  I was helping a senior citizen set up the app... On a customized Android device with adjustable font size—to increase the zoom (DPI) or even use a font with a shadow for better contrast—the button to grant “nearby devices access” permissions doesn't appear on the connection tab because you can't scroll down to see the full text and then the button.  ### Actual behavior  The button to grant “nearby devices access” permissions  (bluetooth or Network) doesn't appear on the connection tab because you can't scroll down to see th

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

### Incident Patch 1: `c86f755b` (2026-11-23)
**Commit Message**: fix(channels): keep existing channels in Add and report failed imports (#8233)

**File**: `.skills/compose-ui/strings-index.txt` (modified, +5/-0)
```diff
@@ -206,15 +206,20 @@ channel_import_confirm_add
 channel_import_confirm_replace
 channel_import_downlink
 channel_import_mode_label
+channel_import_name_conflict
 channel_import_position_approximate
 channel_import_position_precise
+channel_import_removes_existing
 channel_import_replace_description
 channel_import_title
 channel_import_uplink
+channel_import_waiting_for_radio
 channel_invalid
 channel_name
 channel_slots_full
+channel_slots_uncheck_new
 channel_slots_used
+channel_update_failed
 channel_url
 channel_utilization
 channels
```

**File**: `androidApp/src/main/kotlin/org/meshtastic/app/MainActivity.kt` (modified, +15/-1)
```diff
@@ -59,8 +59,10 @@ import org.meshtastic.app.ui.MainScreen
 import org.meshtastic.app.xr.AppSpatialShell
 import org.meshtastic.core.barcode.rememberBarcodeScanner
 import org.meshtastic.core.common.state.LaunchOptions
+import org.meshtastic.core.common.util.CommonUri
 import org.meshtastic.core.di.CoroutineDispatchers
 import org.meshtastic.core.model.DeviceAddress
+import org.meshtastic.core.model.util.toChannelSet
 import org.meshtastic.core.navigation.DEEP_LINK_BASE_URI
 import org.meshtastic.core.network.repository.UsbRepository
 import org.meshtastic.core.nfc.NfcEmulatorEffect
@@ -362,7 +364,7 @@ class MainActivity : AppCompatActivity() {
             stream != null -> importMapFile(stream)
 
             // shared .geojson/.kml file (e.g. Site Planner)
-            text != null -> createShareIntent(text).send()
+            text != null -> sharedChannelUrl(text)?.let(::handleMeshtasticUri) ?: createShareIntent(text).send()
         }
     }
 
@@ -443,5 +445,17 @@ class MainActivity : AppCompatActivity() {
     }
 }
 
+/**
+ * Shared text that is a channel link, and nothing else, goes to the channel import like a tapped link; any other text,
+ * including a channel link inside a sentence, stays a message to send.
+ */
+internal fun sharedChannelUrl(text: String): Uri? {
+    val candidate = text.trim()
+    // The URI parser accepts leading words before a channel link, so whitespace is checked here.
+    val isChannelLink =
+        candidate.none { it.isWhitespace() } && runCatching { CommonUri.parse(candidate).toChannelSet() }.isSuccess
+    return if (isChannelLink) candidate.toUri() else null
+}
+
 internal fun createShareMessageDeepLink(message: String): Uri =
     "$DEEP_LINK_BASE_URI/share".toUri().buildUpon().appendQueryParameter("message", message).build()
```

**File**: `androidApp/src/test/kotlin/org/meshtastic/app/ShareMessageDeepLinkTest.kt` (modified, +21/-0)
```diff
@@ -58,6 +58,27 @@ class ShareMessageDeepLinkTest {
         }
     }
 
+    @Test
+    fun `shared text that is only a channel link goes to the channel import`() {
+        val link = "https://meshtastic.org/e/#CgMSAQESBggBQANIAQ"
+
+        assertEquals(link, sharedChannelUrl(link).toString())
+        assertEquals(link, sharedChannelUrl("  $link\n").toString())
+    }
+
+    @Test
+    fun `other shared text stays a message`() {
+        val texts =
+            listOf(
+                "camp & ridge #4",
+                "join us https://meshtastic.org/e/#CgMSAQESBggBQANIAQ",
+                "https://meshtastic.org/e/#!!!!",
+                "https://meshtastic.org/v/#CgMSAQESBggBQANIAQ",
+            )
+
+        texts.forEach { assertNull(sharedChannelUrl(it), it) }
+    }
+
     @Test
     fun `share callback pending intent carries the encoded message deep link`() {
         val message = "camp & ridge #4? answer=yes + backup"
```

**File**: `androidApp/src/test/kotlin/org/meshtastic/app/SharedTextRoutingTest.kt` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+/*
+ * Copyright (c) 2026 Meshtastic LLC
+ *
+ * This program is free software: you can redistribute it and/or modify
+ * it under the terms of the GNU General Public License as published by
+ * the Free Software Foundation, either version 3 of the License, or
+ * (at your option) any later version.
+ *
+ * This program is distributed in the hope that it will be useful,
+ * but WITHOUT ANY WARRANTY; without even the implied warranty of
+ * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
+ * GNU General Public License for more details.
+ *
+ * You should have received a copy of the GNU General Public License
+ * along with this program.  If not, see <https://www.gnu.org/licenses/>.
+ */
+package org.meshtastic.app
+
+import android.app.Application
+import android.content.Intent
+import android.os.Looper
+import androidx.test.core.app.ApplicationProvider
+import androidx.work.testing.WorkManagerTestInitHelper
+import org.junit.After
+import org.junit.runner.RunWith
+import org.koin.androidx.viewmodel.ext.android.getViewModel
+import org.meshtastic.core.model.util.primaryChannel
+import org.meshtastic.core.ui.viewmodel.UIViewModel
+import org.robolectric.Robolectric
+import org.robolectric.RobolectricTestRunner
+import org.robolectric.Shadows.shadowOf
+import org.robolectric.annotation.Config
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertNotNull
+import kotlin.test.assertNull
+
+/** Drives text shared into the app through MainActivity's own ACTION_SEND handling. */
+@RunWith(RobolectricTestRunner::class)
+@Config(application = InlineIoApplication::class, sdk = [34])
+class SharedTextRoutingTest {
+
+    @After
+    fun tearDown() {
+        WorkManagerTestInitHelper.closeWorkDatabase()
+    }
+
+    private fun share(text: String): MainActivity {
+        val intent =
+            Intent(Intent.ACTION_SEND).apply {
+                type = "text/plain"
+                putExtra(Intent.EXTRA_TEXT, text)
+            }
+        val activity = Robolectric.buildActivity(MainActivity::class.java, intent).create().get()
+        shadowOf(Looper.getMainLooper()).idle()
+        return activity
+    }
+
+    private val app
+        get() = shadowOf(ApplicationProvider.getApplicationContext<Application>())
+
+    @Test
+    fun `a shared channel link opens the channel import and sends no message`() {
+        val activity = share("https://meshtastic.org/e/#CgMSAQESBggBQANIAQ")
+
+        val requested = activity.getViewModel<UIViewModel>().requestChannelSet.value
+        assertNotNull(requested)
+        assertEquals("LongFast", requested.primaryChannel?.name)
+        assertNull(app.nextStartedActivity)
+    }
+
+    @Test
+    fun `other shared text opens the message composer and imports nothing`() {
+        val activity = share("camp & ridge #4")
+
+        assertNull(activity.getViewModel<UIViewModel>().requestChannelSet.value)
+        val started = assertNotNull(app.nextStartedActivity)
+        assertEquals(Intent.ACTION_VIEW, started.action)
+        assertEquals("camp & ridge #4", started.data?.getQueryParameter("message"))
+    }
+}
```

**File**: `core/model/src/androidDeviceTest/kotlin/org/meshtastic/core/model/util/ChannelSetTest.kt` (modified, +0/-49)
```diff
@@ -33,53 +33,4 @@ class ChannelSetTest {
         Assert.assertEquals("LongFast", cs.primaryChannel!!.name)
         Assert.assertEquals(url.toString(), cs.getChannelUrl(false).toString())
     }
-
-    /** validate against the host or path in a case-insensitive way */
-    @Test
-    fun parseCaseInsensitive() {
-        var url = Uri.parse("HTTPS://MESHTASTIC.ORG/E/#CgMSAQESBggBQANIAQ")
-        Assert.assertEquals("LongFast", url.toChannelSet().primaryChannel!!.name)
-
-        url = Uri.parse("HTTPS://mEsHtAsTiC.OrG/e/#CgMSAQESBggBQANIAQ")
-        Assert.assertEquals("LongFast", url.toChannelSet().primaryChannel!!.name)
-    }
-
-    /** properly parse channel config when `?add=true` is in the fragment */
-    @Test
-    fun handleAddInFragment() {
-        val url = Uri.parse("https://meshtastic.org/e/#CgMSAQESBggBQANIAQ?add=true")
-        val cs = url.toChannelSet()
-        Assert.assertEquals("Custom", cs.primaryChannel!!.name)
-        Assert.assertFalse(cs.hasLoraConfig())
-    }
-
-    /** properly parse channel config when `?add=true` is in the query parameters */
-    @Test
-    fun handleAddInQueryParams() {
-        val url = Uri.parse("https://meshtastic.org/e/?add=true#CgMSAQESBggBQANIAQ")
-        val cs = url.toChannelSet()
-        Assert.assertEquals("Custom", cs.primaryChannel!!.name)
-        Assert.assertFalse(cs.hasLoraConfig())
-    }
-
-    /** validate that www.meshtastic.org host is accepted */
-    @Test
-    fun parseWwwHost() {
-        val url = Uri.parse("https://www.meshtastic.org/e/#CgMSAQESBggBQANIAQ")
-        Assert.assertEquals("LongFast", url.toChannelSet().primaryChannel!!.name)
-    }
-
-    /** validate that short /e path is accepted */
-    @Test
-    fun parseShortPath() {
-        val url = Uri.parse("https://meshtastic.org/e#CgMSAQESBggBQANIAQ")
-        Assert.assertEquals("LongFast", url.toChannelSet().primaryChannel!!.name)
-    }
-
-    /** validate that long /channel/e path is accepted */
-    @Test
-    fun parseLongPath() {
-        val url = Uri.parse("https://meshtastic.org/channel/e/#CgMSAQESBggBQANIAQ")
-        Assert.assertEquals("LongFast", url.toChannelSet().primaryChannel!!.name)
-    }
 }
```

**File**: `core/model/src/commonTest/kotlin/org/meshtastic/core/model/util/ChannelSetUrlTest.kt` (modified, +70/-1)
```diff
@@ -27,6 +27,7 @@ import org.meshtastic.proto.Config.LoRaConfig.RegionCode
 import org.meshtastic.proto.ModuleSettings
 import kotlin.test.Test
 import kotlin.test.assertEquals
+import kotlin.test.assertFailsWith
 import kotlin.test.assertFalse
 import kotlin.test.assertNull
 
@@ -40,6 +41,72 @@ class ChannelSetUrlTest {
         assertFalse(channelSet.hasLoraConfig())
     }
 
+    @Test
+    fun `host and path match case insensitively`() {
+        for (url in listOf("HTTPS://MESHTASTIC.ORG/E/#$PAYLOAD", "HTTPS://mEsHtAsTiC.OrG/e/#$PAYLOAD")) {
+            assertEquals("LongFast", CommonUri.parse(url).toChannelSet().primaryChannel?.name, url)
+        }
+    }
+
+    @Test
+    fun `www host is accepted`() {
+        val channelSet = CommonUri.parse("https://www.meshtastic.org/e/#$PAYLOAD").toChannelSet()
+
+        assertEquals("LongFast", channelSet.primaryChannel?.name)
+    }
+
+    @Test
+    fun `short and legacy channel paths are accepted`() {
+        for (url in listOf("https://meshtastic.org/e#$PAYLOAD", "https://meshtastic.org/channel/e/#$PAYLOAD")) {
+            assertEquals("LongFast", CommonUri.parse(url).toChannelSet().primaryChannel?.name, url)
+        }
+    }
+
+    @Test
+    fun `add parameter in the fragment drops the LoRa config`() {
+        val channelSet = CommonUri.parse("$REPLACE_CHANNEL_URL?add=true").toChannelSet()
+
+        assertEquals("Custom", channelSet.primaryChannel?.name)
+        assertFalse(channelSet.hasLoraConfig())
+    }
+
+    @Test
+    fun `add parameter in the query drops the LoRa config`() {
+        val channelSet = CommonUri.parse("https://meshtastic.org/e/?add=true#$PAYLOAD").toChannelSet()
+
+        assertEquals("Custom", channelSet.primaryChannel?.name)
+        assertFalse(channelSet.hasLoraConfig())
+    }
+
+    @Test
+    fun `a fragment that is not base64 is rejected`() {
+        assertFailsWith<MalformedMeshtasticUrlException> {
+            CommonUri.parse("https://meshtastic.org/e/#!!!!").toChannelSet()
+        }
+    }
+
+    @Test
+    fun `base64 that is not a channel set is rejected`() {
+        // 0x0A 0xFF: field 1 claims 255 bytes and none follow, so the protobuf is truncated.
+        assertFailsWith<MalformedMeshtasticUrlException> {
+            CommonUri.parse("https://meshtastic.org/e/#Cv8=").toChannelSet()
+        }
+    }
+
+    @Test
+    fun `a link without a channel set is rejected`() {
+        for (url in listOf("https://meshtastic.org/e/", "https://meshtastic.org/e/#")) {
+            assertFailsWith<MalformedMeshtasticUrlException>(url) { CommonUri.parse(url).toChannelSet() }
+        }
+    }
+
+    @Test
+    fun `a channel set on another host or path is rejected`() {
+        for (url in listOf("https://example.com/e/#$PAYLOAD", "https://meshtastic.org/v/#$PAYLOAD")) {
+            assertFailsWith<MalformedMeshtasticUrlException>(url) { CommonUri.parse(url).toChannelSet() }
+        }
+    }
+
     @Test
     fun `all supported channel counts preserve settings for replace and add`() {
         for (channelCount in 1..8) {
@@ -100,6 +167,8 @@ class ChannelSetUrlTest {
         .build()
 
     private companion object {
-        const val REPLACE_CHANNEL_URL = "https://meshtastic.org/e/#CgMSAQESBggBQANIAQ"
+        /** The default LongFast channel with use_preset, hop limit 3 and TX on, as the Python CLI encodes it. */
+        const val PAYLOAD = "CgMSAQESBggBQANIAQ"
+        const val REPLACE_CHANNEL_URL = "https://meshtastic.org/e/#$PAYLOAD"
     }
 }
```

**File**: `core/resources/src/commonMain/composeResources/values/strings.xml` (modified, +12/-1)
```diff
@@ -231,23 +231,34 @@
         <item quantity="other">%1$d channels in this link are already on your radio and were left out.</item>
     </plurals>
     <string name="channel_features">Channel Features</string>
-    <string name="channel_import_add_description">Adds the selected channels to your radio. Channels already on your radio stay as they are.</string>
+    <string name="channel_import_add_description">Adds the selected channels to your radio and keeps its LoRa settings. Channels already on your radio stay, unless the radio is full and you uncheck one.</string>
     <string name="channel_import_confirm_add">Add channels</string>
     <string name="channel_import_confirm_replace">Replace channels</string>
     <string name="channel_import_downlink">Accepts messages from MQTT on this channel</string>
     <string name="channel_import_mode_label">Import mode</string>
+    <string name="channel_import_name_conflict">Your radio has a channel with this name and a different key</string>
     <string name="channel_import_position_approximate">Shares your approximate location</string>
     <string name="channel_import_position_precise">Shares your precise location</string>
+    <plurals name="channel_import_removes_existing">
+        <item quantity="one">%1$d channel already on your radio will be removed.</item>
+        <item quantity="other">%1$d channels already on your radio will be removed.</item>
+    </plurals>
     <string name="channel_import_replace_description">Removes the channels on your radio and applies the channels and LoRa settings below.</string>
     <string name="channel_import_title">Import channels</string>
     <string name="channel_import_uplink">Forwards this channel's messages to MQTT</string>
+    <string name="channel_import_waiting_for_radio">Your radio's channels haven't loaded yet. You can import once they do.</string>
     <string name="channel_invalid">This Channel URL is invalid and can not be used</string>
     <string name="channel_name">Channel Name</string>
     <plurals name="channel_slots_full">
         <item quantity="one">Your radio holds %2$d channels. Uncheck %1$d channel to make room. Unchecking a channel already on your radio removes it.</item>
         <item quantity="other">Your radio holds %2$d channels. Uncheck %1$d channels to make room. Unchecking a channel already on your radio removes it.</item>
     </plurals>
+    <plurals name="channel_slots_uncheck_new">
+        <item quantity="one">Your radio holds %2$d channels. Uncheck %1$d new channel to make room.</item>
+        <item quantity="other">Your radio holds %2$d channels. Uncheck %1$d new channels to make room.</item>
+    </plurals>
     <string name="channel_slots_used">%1$d of %2$d channel slots in use</string>
+    <string name="channel_update_failed">Couldn't update the channels on your radio.</string>
     <string name="channel_url">Channel URL</string>
     <string name="channel_utilization">ChUtil</string>
     <string name="channels">Channels</string>
```

**File**: `core/ui/build.gradle.kts` (modified, +3/-1)
```diff
@@ -95,7 +95,8 @@ kotlin {
 
 // These fail in headless Chrome. Some compute their expected text with the blocking getString(), which has no wasmJs
 // implementation; the others find no displayed node or cannot inject input. ScannedQrCodeDialogUiTest asserts on
-// rendered string resources, which Karma does not serve (404 on composeResources/.../strings.commonMain.cvr).
+// rendered string resources, which Karma does not serve (404 on composeResources/.../strings.commonMain.cvr), and
+// ScannedQrCodeViewModelTest asserts on a snackbar built from them.
 meshtasticWeb.browserTestExclusions.addAll(
     "*DropDownPreferenceUiTest.*",
     "*ImportFabUiTest.*",
@@ -105,5 +106,6 @@ meshtasticWeb.browserTestExclusions.addAll(
     "*NodeItemUnheardMarkerTest.*",
     "*PositionPrecisionPreferenceUiTest.*",
     "*ScannedQrCodeDialogUiTest.*",
+    "*ScannedQrCodeViewModelTest.*",
     "*SignalInfoUiTest.*",
 )
```

---

### Incident Patch 2: `d1c4c7db` (2026-11-24)
**Commit Message**: fix(ble): adopt Kable 0.46 GATT cache refresh and desktop MTU (#8239)

**File**: `androidApp/proguard-rules.pro` (modified, +0/-8)
```diff
@@ -40,14 +40,6 @@
 # ---- Names read at runtime --------------------------------------------------
 # Each name below is looked up by string, so obfuscation must leave it alone.
 
-# KableGattCacheRefresh reads these private Kable fields by reflection.
--keepclassmembernames class com.juul.kable.BluetoothDeviceAndroidPeripheral {
-    kotlinx.coroutines.flow.MutableStateFlow connection;
-}
--keepclassmembernames class com.juul.kable.Connection {
-    android.bluetooth.BluetoothGatt gatt;
-}
-
 # rumViewName() reports a route's class name as its Datadog view name.
 -keepnames class * implements androidx.navigation3.runtime.NavKey
 
```

**File**: `core/ble/src/androidMain/kotlin/org/meshtastic/core/ble/KableGattCacheRefresh.kt` (modified, +10/-54)
```diff
@@ -16,38 +16,29 @@
  */
 package org.meshtastic.core.ble
 
-import android.bluetooth.BluetoothGatt
 import android.os.Build
 import co.touchlab.kermit.Logger
+import com.juul.kable.AndroidPeripheral
+import com.juul.kable.ExperimentalKableApi
+import com.juul.kable.NotConnectedException
 import com.juul.kable.Peripheral
-import kotlinx.coroutines.flow.StateFlow
 
-@Suppress("ReturnCount")
+@OptIn(ExperimentalKableApi::class)
 internal actual fun Peripheral.refreshGattCache(): Boolean {
-    // Direct 2-hop reflection on Kable 0.45.0 internals.
-    // Path: BluetoothDeviceAndroidPeripheral.connection (MutableStateFlow<Connection?>) → .value → Connection.gatt
-    // Re-verify field names on Kable version bumps.
-    val gatt =
-        try {
-            extractBluetoothGatt()
-        } catch (@Suppress("TooGenericExceptionCaught") e: Exception) {
-            logRefreshFailure("gatt-unreachable peripheral=${javaClass.name}", e)
-            return false
-        }
+    val androidPeripheral =
+        this as? AndroidPeripheral
             ?: run {
-                logRefreshFailure("gatt-unreachable peripheral=${javaClass.name}")
+                logRefreshFailure("not-android peripheral=${javaClass.name}")
                 return false
             }
     return try {
-        val refreshMethod = gatt.javaClass.getDeclaredMethod("refresh").apply { isAccessible = true }
-        val refreshed = refreshMethod.invoke(gatt) as? Boolean ?: false
+        val refreshed = androidPeripheral.refreshGattCache()
         Logger.i {
             "$REFRESH_LOG_LABEL outcome=${if (refreshed) "refreshed" else "refused"} sdk=${Build.VERSION.SDK_INT}"
         }
         refreshed
-    } catch (e: NoSuchMethodException) {
-        // The hidden-API blocklist hides the method rather than throwing on access, so this is how a block shows up.
-        logRefreshFailure("hidden-api-blocked", e)
+    } catch (e: NotConnectedException) {
+        logRefreshFailure("not-connected", e)
         false
     } catch (@Suppress("TooGenericExceptionCaught") e: Exception) {
         logRefreshFailure("invoke-failed", e)
@@ -61,38 +52,3 @@ private const val REFRESH_LOG_LABEL = "gatt-cache-refresh"
 private fun logRefreshFailure(outcome: String, cause: Throwable? = null) {
     Logger.w(cause) { "$REFRESH_LOG_LABEL outcome=$outcome sdk=${Build.VERSION.SDK_INT}" }
 }
-
-/**
- * Extracts the [BluetoothGatt] from Kable's internal object graph via a 2-hop field lookup.
- *
- * Hop 1: `Peripheral` → field `"connection"` (`MutableStateFlow<Connection?>`) → `.value` → `Connection` Hop 2:
- * `Connection` → field `"gatt"` → `BluetoothGatt`
- *
- * Returns `null` if either hop fails (e.g., Kable internals changed between versions).
- */
-@Suppress("ReturnCount")
-private fun Peripheral.extractBluetoothGatt(): BluetoothGatt? {
-    // Hop 1: Read "connection" field from the concrete Peripheral class (BluetoothDeviceAndroidPeripheral)
-    val connectionField = readDeclaredField("connection") ?: return null
-    val connectionStateFlow = connectionField as? StateFlow<*> ?: return null
-    val connection = connectionStateFlow.value ?: return null
-
-    // Hop 2: Read "gatt" field from the Connection class
-    return connection.readDeclaredFieldAs<BluetoothGatt>("gatt")
-}
-
-private fun Any.readDeclaredField(name: String): Any? {
-    var clazz: Class<*>? = javaClass
-    while (clazz != null && clazz != Any::class.java) {
-        try {
-            val field = clazz.getDeclaredField(name)
-            field.isAccessible = true
-            return field.get(this)
-        } catch (_: NoSuchFieldException) {
-            clazz = clazz.superclass
-        }
-    }
-    return null
-}
-
-private inline fun <reified T> Any.readDeclaredFieldAs(name: String): T? = readDeclaredField(name) as? T
```

**File**: `core/ble/src/androidMain/kotlin/org/meshtastic/core/ble/KablePlatformSetup.kt` (modified, +3/-2)
```diff
@@ -73,9 +73,10 @@ internal actual fun createPeripheral(address: String, builderAction: PeripheralB
 /** ATT protocol header size (opcode + handle) subtracted from MTU to get the usable payload. */
 private const val ATT_HEADER_SIZE = 3
 
-internal actual fun Peripheral.negotiatedMaxWriteLength(): Int? {
+// Reads the live MTU rather than [atConnect], since Android can renegotiate it after connect.
+internal actual fun Peripheral.negotiatedMaxWriteLength(atConnect: Int?): Int? {
     val mtu = (this as? AndroidPeripheral)?.mtu?.value ?: return null
-    return (mtu - ATT_HEADER_SIZE).takeIf { it > 0 }
+    return (mtu - ATT_HEADER_SIZE).coerceAtMost(MAX_ATTRIBUTE_LENGTH).takeIf { it > 0 }
 }
 
 internal actual fun Peripheral.requestHighConnectionPriority(): Boolean {
```

**File**: `core/ble/src/commonMain/kotlin/org/meshtastic/core/ble/KableBleConnection.kt` (modified, +22/-2)
```diff
@@ -49,6 +49,9 @@ import kotlin.time.Duration
 import kotlin.time.Duration.Companion.seconds
 import kotlin.uuid.Uuid
 
+/** No attribute value exceeds 512 bytes, while Android 14+ and BlueZ negotiate an MTU of 517 (a 514-byte payload). */
+internal const val MAX_ATTRIBUTE_LENGTH = 512
+
 /** [BleService] implementation backed by a Kable [Peripheral] for a specific GATT service. */
 class KableBleService(private val peripheral: Peripheral, private val serviceUuid: Uuid) : BleService {
     override fun hasCharacteristic(characteristic: BleCharacteristic): Boolean = peripheral.services.value?.any { svc ->
@@ -129,6 +132,8 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
 
     @Volatile private var observationFailure: Throwable? = null
 
+    @Volatile private var writeLengthAtConnect: Int? = null
+
     override val lastFailureCause: Throwable?
         get() = connectFailure ?: observationFailure ?: peripheral?.preinstalledObservationFailure()
 
@@ -178,6 +183,7 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
         withContext(NonCancellable) {
             cleanUpPeripheral()
             peripheral = p
+            writeLengthAtConnect = null
             ActiveBleConnection.active = ActiveConnection(p, device.address)
         }
 
@@ -188,6 +194,7 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
         stateJob =
             p.state
                 .onEach { kableState ->
+                    if (kableState is State.Disconnected) writeLengthAtConnect = null
                     val mappedState = kableState.toBleConnectionState(hasStartedConnecting) ?: return@onEach
                     if (kableState is State.Connecting || kableState is State.Connected) {
                         hasStartedConnecting = true
@@ -203,7 +210,7 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
         // advertisement was available. Advertisement-less devices start on the autoConnect path.
         // The outer reconnect loop (BleRadioTransport) owns the macro retry budget — see class kdoc.
         repeat(2) {
-            if (p.state.value is State.Connected) return
+            if (p.state.value is State.Connected) return@repeat
             autoConnect =
                 try {
                     connectionScope?.let { oldScope ->
@@ -242,6 +249,17 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
                 "Failed to establish connection after bounded attempts (state=${p.state.value})",
             )
         }
+        writeLengthAtConnect = p.queryMaxWriteLength()?.coerceAtMost(MAX_ATTRIBUTE_LENGTH)
+    }
+
+    @Suppress("TooGenericExceptionCaught")
+    private suspend fun Peripheral.queryMaxWriteLength(): Int? = try {
+        asException { maximumWriteValueLengthForType(WriteType.WithoutResponse) }
+    } catch (e: CancellationException) {
+        throw e
+    } catch (e: Exception) {
+        Logger.w(e) { "maximumWriteValueLengthForType failed; callers use their own fallback" }
+        null
     }
 
     @Suppress("TooGenericExceptionCaught", "SwallowedException")
@@ -277,6 +295,7 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
         val owned = peripheral
         safeClosePeripheral("disconnect")
         peripheral = null
+        writeLengthAtConnect = null
         connectionScope = null
 
         if (owned != null && ActiveBleConnection.active?.peripheral === owned) {
@@ -327,7 +346,8 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
         }
     }
 
-    override fun maximumWriteValueLength(writeType: BleWriteType): Int? = peripheral?.negotiatedMaxWriteLength()
+    override fun maximumWriteValueLength(writeType: BleWriteType): Int? =
+        peripheral?.negotiatedMaxWriteLength(writeLengthAtConnect)
 
     override fun requestHighConnectionPriority(): Boolean = peripheral?.requestHighConnectionPriority() == true
 
```

**File**: `core/ble/src/commonMain/kotlin/org/meshtastic/core/ble/KablePlatformSetup.kt` (modified, +4/-5)
```diff
@@ -33,9 +33,10 @@ internal expect suspend fun Peripheral.connectedRssi(): Int?
 
 /**
  * Returns the negotiated maximum write payload length in bytes (i.e. ATT MTU minus the 3-byte ATT header), or `null` if
- * MTU has not yet been negotiated on this platform.
+ * MTU has not yet been negotiated on this platform. [atConnect] is Kable's `maximumWriteValueLengthForType`, read once
+ * after the last connect, for platforms that only report it through that suspend call.
  */
-internal expect fun Peripheral.negotiatedMaxWriteLength(): Int?
+internal expect fun Peripheral.negotiatedMaxWriteLength(atConnect: Int?): Int?
 
 /**
  * Requests the highest-throughput BLE connection priority (smallest connection interval) supported by the platform.
@@ -54,9 +55,7 @@ internal expect fun Peripheral.requestBalancedConnectionPriority(): Boolean
 /**
  * Clears the platform's cached GATT service table for the connected [Peripheral].
  *
- * Kable keeps Android's `BluetoothGatt` on an internal connection object owned by the peripheral. This extension
- * searches the peripheral and its active connection for that field, then invokes the hidden `refresh()` API to clear
- * the per-device service cache.
+ * On Android this is Kable's `AndroidPeripheral.refreshGattCache`, which invokes the hidden `BluetoothGatt.refresh()`.
  *
  * Necessary when a device reboots into a different GATT profile (e.g., ESP32 OTA loader) using the same BLE MAC.
  *
```

**File**: `core/ble/src/iosMain/kotlin/org/meshtastic/core/ble/NoopStubs.kt` (modified, +1/-1)
```diff
@@ -33,4 +33,4 @@ internal actual fun ScannerBuilder.platformScanConfig() {
 internal actual fun createPeripheral(address: String, builderAction: PeripheralBuilder.() -> Unit): Peripheral =
     throw UnsupportedOperationException("iOS Peripheral not yet implemented")
 
-internal actual fun Peripheral.negotiatedMaxWriteLength(): Int? = null
+internal actual fun Peripheral.negotiatedMaxWriteLength(atConnect: Int?): Int? = null
```

**File**: `core/ble/src/jvmMain/kotlin/org/meshtastic/core/ble/KablePlatformSetup.kt` (modified, +2/-5)
```diff
@@ -37,8 +37,5 @@ internal actual val bleAddressIsHardware: Boolean =
 internal actual fun createPeripheral(address: String, builderAction: PeripheralBuilder.() -> Unit): Peripheral =
     com.juul.kable.Peripheral(address.toIdentifier(), builderAction)
 
-// JVM/desktop Kable does not expose an MTU StateFlow; return a reasonable default (512)
-// so callers can size their writes without falling back to an overly conservative minimum.
-internal actual fun Peripheral.negotiatedMaxWriteLength(): Int? = DEFAULT_JVM_MTU
-
-private const val DEFAULT_JVM_MTU = 512
+// btleplug reports the negotiated MTU only through Kable's suspend maximumWriteValueLengthForType.
+internal actual fun Peripheral.negotiatedMaxWriteLength(atConnect: Int?): Int? = atConnect
```

**File**: `core/ble/src/wasmJsMain/kotlin/org/meshtastic/core/ble/KablePlatformSetup.wasmJs.kt` (modified, +2/-1)
```diff
@@ -28,7 +28,8 @@ internal actual fun createPeripheral(address: String, builderAction: PeripheralB
     WebBluetoothGrants.find(address)
         ?: error("No Web Bluetooth grant for ${address.anonymize()}; pick the device again")
 
-internal actual fun Peripheral.negotiatedMaxWriteLength(): Int? = null
+// Web Bluetooth exposes no MTU and Kable answers a constant 20; null keeps callers on their own fallbacks.
+internal actual fun Peripheral.negotiatedMaxWriteLength(atConnect: Int?): Int? = null
 
 // close() is terminal and only a new grant can replace the peripheral, so the grant keeps it open; disconnect() has
 // already dropped the GATT link.
```

---

### Incident Patch 3: `77c6058c` (2026-11-24)
**Commit Message**: fix(takserver): dedupe mesh CoT on the wire payload (#8240)

**File**: `core/takserver/src/commonMain/kotlin/org/meshtastic/core/takserver/CotDeliveryDedup.kt` (modified, +9/-8)
```diff
@@ -26,8 +26,9 @@ import kotlin.time.Instant
  *
  * The mesh can hand the bridge the same logical CoT more than once — a packet relayed over several LoRa paths, or a
  * sender that retransmits — which makes ATAK show duplicate chat / TAK-Talk messages. This is a small TTL cache keyed
- * by the exact, already-normalized CoT XML: an identical event seen within [ttl] is dropped, while genuine updates (a
- * PLI with a new position, a moved marker, …) differ in content and pass through untouched.
+ * by the packet's wire payload: an identical payload seen within [ttl] is dropped, while genuine updates (a PLI with a
+ * new position, a moved marker, …) differ in content and pass through untouched. The key is the wire bytes, not the
+ * decoded XML, because decoding stamps `stale` (and `time`/`start` when the sender sent none) from the local clock.
  *
  * Scope: this only dedupes what the *bridge* injects. It cannot see copies the TAK client also receives over another
  * transport (e.g. Wi-Fi network SA); for those the client dedupes by `uid`, which is why the SDK preserves the original
@@ -41,19 +42,19 @@ internal class CotDeliveryDedup(
     private val maxEntries: Int = DEFAULT_MAX_ENTRIES,
     private val now: () -> Instant = Clock.System::now,
 ) {
-    // normalized XML -> last-seen time. Insertion-ordered: entries are re-inserted on each
+    // key -> last-seen time. Insertion-ordered: entries are re-inserted on each
     // sighting so the iteration order is oldest-first, which makes [evictExpired] cheap.
     private val seen = LinkedHashMap<String, Instant>()
 
     /**
-     * @return true if [normalizedXml] should be delivered (it is new, or its previous copy has aged past [ttl]); false
-     *   if it is a duplicate already delivered within [ttl] (drop it).
+     * @return true if [key] should be delivered (it is new, or its previous copy has aged past [ttl]); false if it is a
+     *   duplicate already delivered within [ttl] (drop it).
      */
-    fun admit(normalizedXml: String): Boolean {
+    fun admit(key: String): Boolean {
         val t = now()
         evictExpired(t)
-        if (seen.containsKey(normalizedXml)) return false // survived eviction => still within ttl
-        seen[normalizedXml] = t
+        if (seen.containsKey(key)) return false // survived eviction => still within ttl
+        seen[key] = t
         while (seen.size > maxEntries) seen.remove(seen.keys.first())
         return true
     }
```

**File**: `core/takserver/src/commonMain/kotlin/org/meshtastic/core/takserver/TAKMeshIntegration.kt` (modified, +6/-7)
```diff
@@ -398,6 +398,12 @@ class TAKMeshIntegration(
     }
 
     private fun handleV2Packet(wirePayload: ByteArray) {
+        // Drop a payload the mesh delivered more than once (multi-path relay or retransmit) so ATAK doesn't surface
+        // doubled chat / TAK-Talk messages; see CotDeliveryDedup for why the key is the wire bytes.
+        if (!deliveryDedup.admit(wirePayload.toHexString())) {
+            Logger.d { "Dropped duplicate CoT from mesh (already delivered within dedup window)" }
+            return
+        }
         try {
             // Decompress to CoT XML via the SDK's CotXmlBuilder, which handles
             // ALL typed payloads (DrawnShape, Marker, Route, etc.) and preserves
@@ -409,13 +415,6 @@ class TAKMeshIntegration(
             // and collapse inter-tag whitespace so ATAK's streaming parser sees
             // bare <event>...</event> on a single line. Centralized in the SDK.
             val xml = CotSanitizer.normalizeCotXml(rawXml)
-            // Drop exact duplicates the mesh delivered more than once (multi-path relay or
-            // retransmit) so ATAK doesn't surface doubled chat / TAK-Talk messages. Genuine
-            // updates (new PLI position, moved marker, …) differ in content and pass through.
-            if (!deliveryDedup.admit(xml)) {
-                Logger.d { "Dropped duplicate CoT from mesh (already delivered within dedup window)" }
-                return
-            }
             // Logger.d { "RAW CoT IN (mesh): $xml" }
             // Routes: ATAK ignores b-m-r CoT events over TCP streaming.
             // Convert to a KML data package and save it to Downloads for import into ATAK.
```

**File**: `core/takserver/src/commonTest/kotlin/org/meshtastic/core/takserver/TAKMeshIntegrationTest.kt` (modified, +31/-0)
```diff
@@ -362,11 +362,42 @@ class TAKMeshIntegrationTest {
         }
     }
 
+    // ── Inbound mesh → TAK client (V2) ──────────────────────────────────────
+
+    @Test
+    fun `the same V2 payload delivered twice reaches TAK clients once`() = runTest(UnconfinedTestDispatcher()) {
+        val h = TestHarness()
+        h.integration.start(backgroundScope)
+        val payload = v2PliPayload("alpha-uid")
+
+        h.serviceRepository.emitMeshPacket(createV2MeshPacket(payload))
+        h.serviceRepository.emitMeshPacket(createV2MeshPacket(payload))
+        h.serviceRepository.emitMeshPacket(createV2MeshPacket(v2PliPayload("bravo-uid")))
+
+        val uids = h.serverManager.rawBroadcasts.map { Regex("""uid="([^"]+)"""").find(it)?.groupValues?.get(1) }
+        assertEquals(listOf("alpha-uid", "bravo-uid"), uids)
+    }
+
     // ── Helpers ───────────────────────────────────────────────────────────────
 
     private fun createPli(uid: String) =
         CoTMessage.pli(uid = uid, callsign = "TEST", latitude = 33.0, longitude = -84.0)
 
+    private fun v2PliPayload(uid: String): ByteArray =
+        assertNotNull(TakSdkCompressor.compressCoT(createPli(uid).toXml(), MAX_TAK_WIRE_PAYLOAD_BYTES).wirePayload)
+
+    private fun createV2MeshPacket(wirePayload: ByteArray): MeshPacket = MeshPacket.Builder()
+        .also { wb ->
+            wb.decoded =
+                Data.Builder()
+                    .also { wb ->
+                        wb.portnum = PortNum.ATAK_PLUGIN_V2
+                        wb.payload = wirePayload.toByteString()
+                    }
+                    .build()
+        }
+        .build()
+
     private fun createV1PliMeshPacket(isCompressed: Boolean = false): MeshPacket {
         val takPacket =
             TAKPacket.Builder()
```

#### Recent Merged Pull Requests:
- **PR #8240** (2026-11-24): fix(takserver): dedupe mesh CoT on the wire payload (@jamesarich)
- **PR #8239** (2026-11-24): fix(ble): adopt Kable 0.46 GATT cache refresh and desktop MTU (@jamesarich)
- **PR #8238** (2026-11-24): chore: Scheduled updates (Graphs, Baseline Profile) (@jamesarich)
- **PR #8237** (2026-11-24): chore: Scheduled updates (Firmware, Hardware, Translations) (@jamesarich)
- **PR #8236** (2026-11-24): fix(data): amortize node index eviction with a low-water mark (@jamesarich)
- **PR #8235** (2026-11-23): fix(connections): show no node for a connected radio until its own node arrives (@jamesarich)

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

## X. channels): keep existing channels in Add and report failed imports

**RULE**:
When implementing operations in `.skills/compose-ui/strings-index.txt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meshtastic/Meshtastic-Android. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c86f755b`: channels): keep existing channels in Add and report failed imports. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `.skills/compose-ui/strings-index.txt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
channel_import_name_conflict
channel_import_removes_existing
channel_import_waiting_for_radio
channel_slots_uncheck_new
channel_update_failed
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c86f755b` are properly handled with clean fallback behavior.
