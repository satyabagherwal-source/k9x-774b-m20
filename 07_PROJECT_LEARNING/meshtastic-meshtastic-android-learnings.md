# Forensic Learning Record (Deep Inspection): meshtastic/Meshtastic-Android

> **Canonical Artifact**: `07_PROJECT_LEARNING/meshtastic-meshtastic-android-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:15:29.424Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshtastic/Meshtastic-Android`
- **Description**: Android application for Meshtastic
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1862 stars

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
import androidx.appfunctions.metadata.AppFunctionName
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

/** One decoded feature, already placed in real-world coordinates and tagged with the basemap layer it came from. */
internal data class OfflineFeature(val layerName: String, val geometryType: Int, val rings: List<List<LatLng>>)

/**
 * Decodes an offline region's MVT tiles into drawable geometry, on demand and cached per tile.
 *
 * Only [RENDERED_LAYERS] are kept — Protomaps' basemap ships ten (boundaries, buildings, earth, landcover, landuse,
 * places, pois, roads, transit, water; docs.protomaps.com/basemaps/layers). Buildings and POIs alone can be most of a
 * tile's feature count at high zoom, and this offline layer exists to keep the map legible without a network, not to
 * reproduce it — water and roads (plus boundaries, cheap and useful for context) are what a evacuation-planning glance
 * actually needs.
 *
 * Every ring MVT hands back — hole or exterior — is drawn as its own independent
 * [com.google.maps.android.compose.Polygon]. A real multi-ring-with-holes lake therefore double-draws over its islands
 * rather than cutting them out; grouping rings by winding direction into proper polygon/hole sets is deferred (see the
 * module README) rather than risked for this pass.
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
        return OfflineRegionTileSet.tiles(bounds, renderZoom..renderZoom).flatMap { tile ->
            tileFeatures(region.id, archive, tile)
        }
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
                layer.features.mapNotNull { feature ->
                    val localRings = MvtDecoder.decodeGeometry(feature.type, feature.geometry)
                    if (localRings.isEmpty()) {
                        null
                    } else {
                        OfflineFeature(
                            layerName = layer.name,
                            geometryType = feature.type,
                            rings =
                            localRings.map { ring ->
                                ring.map { local ->
                                    WebMercatorTileMath.tileLocalToLatLng(tile, layer.extent, local)
                                }
                            },
                        )
                    }
                }
            }
    }

    internal companion object {
        private val LOG = Logger.withTag("OfflineVectorRenderer")
        val RENDERED_LAYERS = setOf("water", "roads", "boundaries")
        private const val MAX_CACHED_TILES = 96
        private const val INITIAL_CAPACITY = 16
        private const val LOAD_FACTOR = 0.75f
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
                suspend fun pushPreview() {
                    try {
                        Logger.i { "Pushing generated widget preview..." }
                        val result =
                            GlanceAppWidgetManager(this@MeshUtilApplication)
                                .setWidgetPreviews(
                                    LocalStatsWidgetReceiver::class,
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
     * Stops the background init launched by [startBackgroundInit]. Cancellation is not a join: work already inside an
     * uninterruptible native call (a database open) runs on past this, which is why [onTerminate] still has to close
     * the database afterwards.
     */
    private fun cancelBackgroundInit() {
        applicationScope.cancel()
    }

    override fun onTerminate() {
        // cancel() not cancelAndJoin(): joining under runBlocking on the main thread can deadlock.
        cancelBackgroundInit()
        if (!isSup
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
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
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
import org.meshtastic.core.resources.close
import org.meshtastic.core.resources.error
import org.meshtastic.core.resources.retry
import org.meshtastic.core.ui.component.PermissionRecoveryCard
import org.meshtastic.core.ui.icon.Close
import org.meshtastic.core.ui.icon.MeshtasticIcons
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

    Dialog(onDismissRequest = { deliverResult(null) }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(modifier = Modifier.fillMaxSize()) {
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
            if (isCameraReady) {
                ScannerReticule()
            }
            if (hasCameraError) {
                ScannerErrorContent(
                    onRetry = {
                        hasCameraError = false
                        scannerAttempt++
                    },
                    onClose = { deliverResult(null) },
                    modifier = Modifier.align(Alignment.Center),
                )
            }
            IconButton(
                onClick = { deliverResult(null) },
                modifier = Modifier.align(Alignment.TopStart).padding(16.dp),
            ) {
                Icon(
                    imageVector = MeshtasticIcons.Close,
                    contentDescription = stringResource(Res.string.close),
                    tint = Color.White,
                )
            }
        }
    }
}

@Composable
private fun ScannerErrorContent(onRetry: () -> Unit, onClose: () -> Unit, modifier: Modifier = Modifier) {
    Surface(modifier = modifier.padding(24.dp), shape = MaterialTheme.shapes.large) {
        Column(
            modifier = Modifier.padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(Res.string.error),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() },
            )
            Text(text = stringResource(Res.string.camera_unavailable), style = MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onClose) { Text(text = stringResource(Res.string.close)) }
                FilledTonalButton(onClick = onRetry) { Text(text = stringResource(Res.string.retry)) }
            }
        }
    }
}

@Suppress("MagicNumber")
@Composable
private fun ScannerReticule() {
    Canvas(modifier = Modifier.f
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

### Core Architecture Module: `core/ble/src/androidMain/kotlin/org/meshtastic/core/ble/AndroidBluetoothRepository.kt`
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

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.coroutineScope
import co.touchlab.kermit.Logger
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.plus
import kotlinx.coroutines.withTimeoutOrNull
import org.koin.core.annotation.Named
import org.koin.core.annotation.Single
import org.meshtastic.core.common.di.PROCESS_LIFECYCLE
import org.meshtastic.core.common.hasBluetoothLe
import org.meshtastic.core.di.CoroutineDispatchers
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

private val BOND_TIMEOUT = 30.seconds
private val BOND_STATE_POLL_INTERVAL = 500.milliseconds

// Fixed two-poll grace for slow BOND_NONE -> BOND_BONDING transitions after createBond() returns true.
// Tune this or track observed transition latency if a specific OEM needs a longer window.
private val CREATED_BOND_NONE_GRACE = BOND_STATE_POLL_INTERVAL + BOND_STATE_POLL_INTERVAL
internal const val BOND_FAILED_OR_REJECTED_MESSAGE = "Bonding failed or rejected"

/** Android implementation of [BluetoothRepository]. */
@Suppress("TooManyFunctions")
@Single
class AndroidBluetoothRepository(
    private val context: Context,
    private val dispatchers: CoroutineDispatchers,
    @Named(PROCESS_LIFECYCLE) private val processLifecycle: Lifecycle,
) : BluetoothRepository {
    private val bluetoothAdapter: BluetoothAdapter? =
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    override val isSupported: Boolean = context.hasBluetoothLe()

    private val _state = MutableStateFlow(BluetoothState(hasPermissions = hasBluetoothPermissions()))
    override val state: StateFlow<BluetoothState> = _state.asStateFlow()

    private val deviceCache = mutableMapOf<String, MeshtasticBleDevice>()

    private val bondEvents = BondEventReceiver(context, processLifecycle.coroutineScope + dispatchers.default)

    init {
        processLifecycle.coroutineScope.launch(dispatchers.default) { updateBluetoothState() }
    }

    private fun hasBluetoothPermissions(): Boolean = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val hasConnect =
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
                PackageManager.PERMISSION_GRANTED
        val hasScan =
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) ==
                PackageManager.PERMISSION_GRANTED
        hasConnect && hasScan
    } else {
        // Pre-Android 12: classic Bluetooth permissions are install-time.
        true
    }

    override fun refreshState() {
        processLifecycle.coroutineScope.launch(dispatchers.default) { updateBluetoothState() }
    }

    override fun isValid(bleAddress: String): Boolean = BluetoothAdapter.checkBluetoothAddress(bleAddress)

    @Suppress("TooGenericExceptionThrown", "TooGenericExceptionCaught", "SwallowedException")
    @SuppressLint("MissingPermission")
    override suspend fun bond(device: BleDevice) {
        val macAddress = device.address
        bondEvents.watch(macAddress)
        val remoteDevice =
            bluetoothAdapter?.getRemoteDevice(macAddress) ?: throw Exception("Bluetooth adapter unavailable")

        if (remoteDevice.bondState == android.bluetooth.BluetoothDevice.BOND_BONDED) {
            updateBluetoothState()
            return
        }

        try {
            val bonded =
                withTimeoutOrNull(BOND_TIMEOUT) {
                    val result = CompletableDeferred<Unit>()
                    val receiver = createBondReceiver(macAddress, result)

                    val filter =
                        android.content.IntentFilter(android.bluetooth.BluetoothDevice.ACTION_BOND_STATE_CHANGED)
                    // The Bluetooth app sends this under its own uid, which a NOT_EXPORTED receiver refuses. It is a
                    // protected broadcast, so exporting admits no other sender.
                    ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_EXPORTED)

                    try {
                        val start = startOrObserveBond(remoteDevice, result)
                        awaitBondResult(remoteDevice, result, start)
                    } finally {
                        unregisterBondReceiver(receiver)
                    }
                    // Reaching here means the suspended bond wait completed before BOND_TIMEOUT.
                    true
                } ?: (remoteDevice.bondState == android.bluetooth.BluetoothDevice.BOND_BONDED)

            if (!bonded) {
                throw Exception("Timed out waiting for bonding to complete")
            }
        } finally {
            updateBluetoothState()
        }
    }

    @Suppress("TooGenericExceptionCaught")
    @SuppressLint("MissingPermission")
    private fun startOrObserveBond(
        remoteDevice: android.bluetooth.BluetoothDevice,
        result: CompletableDeferred<Unit>,
    ): BondWaitStart {
        var start = BondWaitStart()
        try {
            if (!result.isCompleted) {
                if (remoteDevice.bondState == android.bluetooth.BluetoothDevice.BOND_BONDED) {
                    result.complete(Unit)
                } else if (remoteDevice.createBond()) {
                    start = BondWaitStart(createdBond = true)
                } else {
                    // createBond() returns false when a bond is already in flight, triggered by a GATT
                    // operation hitting a secured characteristic, or already established.
                    // ACTION_BOND_STATE_CHANGED is unreliable on some devices (see Kable #111), so
                    // re-check bondState directly rather than failing the whole flow.
                    when (remoteDevice.bondState) {
                        android.bluetooth.BluetoothDevice.BOND_BONDED -> {
                            result.complete(Unit)
                        }

                        android.bluetooth.BluetoothDevice.BOND_BONDING -> {
                            // Bond already in progress; leave the receiver registered to resolve it on
                            // the terminal BOND_BONDED / BOND_NONE transition instead of treating this
                            // as a failure.
                            Logger.d { "createBond() returned false but bonding is already in progress" }
                            start = BondWaitStart(bondingObserved = true)
                        }

                        else -> {
                            result.completeExceptionally(Exception("Failed to initiate bonding"))
                        }
                    }
                }
            }
        } catch (e: Exception) {
            result.completeExceptionally(e)
        }
        return start
    }

    private data class BondWaitStart(val bondingObserved: Boolean = false, val createdBond: Boolean = false)

    @SuppressLint("MissingPermission")
    private suspend fun awaitBondResult(
        remoteDevice: android.bluetooth.BluetoothDevice,
        result: CompletableDeferred<Unit>,
        start: BondWaitStart,
    ) {
        var bondingWasInFlight = start.bondingObserved
        // createBond() can return true before Android reports BOND_BONDING. Tolerate two polled
        // BOND_NONE samples (polls 1-2), then fail on the third persistent BOND_NONE.
        var createdBondNoneGraceRemaining =
            if (start.createdBond) {
                CREATED_BOND_NONE_GRACE
            } else {
                Duration.ZERO
            }

        while (!result.isCompleted) {
            val completedFromReceiver =
                withTimeoutOrNull(BOND_STATE_POLL_INTERVAL) {
                    result.await()
                    true
                } == true

            if (!completedFromReceiver) {
                when (remoteDevice.bondState) {
                    android.bluetooth.BluetoothDevice.BOND_BONDED -> {
                        result.complete(Unit)
                    }

                    android.bluetooth.BluetoothDevice.BOND_BONDING -> {
                        // Once polling observes BOND_BONDING, a later BOND_NONE is terminal. Keep this
                        // defensive for any path that observes in-flight bonding outside the start state.
                        bondingWasInFlight = true
                        createdBondNoneGraceRemaining = Duration.ZERO
                    }

                    android.bluetooth.BluetoothDevice.BOND_NONE -> {
                        // Invariant: if start.createdBond is false, startOrObserveBond either completed
                        // result or observed BOND_BONDING, which is represented by bondingWasInFlight.
                        val pollFailureDetai
```

### Core Architecture Module: `core/ble/src/androidMain/kotlin/org/meshtastic/core/ble/BondEventLog.kt`
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

import android.bluetooth.BluetoothDevice
import android.os.Build
import co.touchlab.kermit.Severity
import org.meshtastic.core.model.util.anonymize

/** HCI Encryption Change status for success, as carried by `EXTRA_ENCRYPTION_STATUS`. */
private const val HCI_SUCCESS = 0

/** A Bluetooth bond broadcast for one device, reduced to the fields worth recording. */
internal sealed interface BondEvent {
    val address: String

    /** `ACTION_KEY_MISSING`. [lossReason] is `EXTRA_BOND_LOSS_REASON`, which only newer releases send. */
    data class KeyMissing(override val address: String, val lossReason: Int?) : BondEvent

    /** `ACTION_ENCRYPTION_CHANGE`. [status] is the controller's HCI status. */
    data class EncryptionChange(override val address: String, val encrypted: Boolean, val status: Int) : BondEvent

    /** `ACTION_BOND_STATE_CHANGED`, as `BluetoothDevice.BOND_*` values. */
    data class BondStateChanged(override val address: String, val previous: Int, val current: Int) : BondEvent
}

internal data class BondEventLogLine(val severity: Severity, val message: String)

/** The bond broadcasts worth registering for on [sdkInt]; KEY_MISSING and ENCRYPTION_CHANGE exist from API 36. */
internal fun bondEventActions(sdkInt: Int): List<String> = buildList {
    add(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
    if (sdkInt >= Build.VERSION_CODES.BAKLAVA) {
        add(BluetoothDevice.ACTION_KEY_MISSING)
        add(BluetoothDevice.ACTION_ENCRYPTION_CHANGE)
    }
}

/**
 * Warn when the radio is left without a bond or an encrypted link, Info otherwise. A lost bond is the user's radio, not
 * a defect, so it never logs at Error. The device is named only by [anonymize].
 */
internal fun BondEvent.toLogLine(sdk: String): BondEventLogLine {
    val device = address.anonymize
    return when (this) {
        is BondEvent.KeyMissing -> {
            val reason = lossReason?.let { " lossReason=$it" }.orEmpty()
            BondEventLogLine(Severity.Warn, "BLE bond event key-missing sdk=$sdk$reason device=$device")
        }

        is BondEvent.EncryptionChange -> {
            val severity = if (encrypted && status == HCI_SUCCESS) Severity.Info else Severity.Warn
            BondEventLogLine(
                severity,
                "BLE bond event encryption-change sdk=$sdk encrypted=$encrypted status=$status device=$device",
            )
        }

        is BondEvent.BondStateChanged -> {
            val severity = if (current == BluetoothDevice.BOND_NONE) Severity.Warn else Severity.Info
            BondEventLogLine(
                severity,
                "BLE bond event bond-state ${previous.bondStateName()}->${current.bondStateName()} " +
                    "sdk=$sdk device=$device",
            )
        }
    }
}

private fun Int.bondStateName(): String = when (this) {
    BluetoothDevice.BOND_NONE -> "NONE"
    BluetoothDevice.BOND_BONDING -> "BONDING"
    BluetoothDevice.BOND_BONDED -> "BONDED"
    else -> toString()
}

```

### Core Architecture Module: `core/ble/src/androidMain/kotlin/org/meshtastic/core/ble/BondEventReceiver.kt`
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

import android.Manifest
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import co.touchlab.kermit.Logger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Logs Bluetooth bond broadcasts for the radios the app bonds to or connects to, so field data can show how often bonds
 * are lost and what follows. It changes nothing about bonding or reconnection.
 *
 * The receiver registers on the first [watch] made while BLUETOOTH_CONNECT is granted, and stays registered until
 * [scope] is cancelled.
 */
internal class BondEventReceiver(
    private val context: Context,
    private val scope: CoroutineScope,
    private val connectingAddress: () -> String? = { ActiveBleConnection.active?.address },
    private val sdkInt: Int = Build.VERSION.SDK_INT,
) {
    private val watched: MutableSet<String> = ConcurrentHashMap.newKeySet()
    private val registered = AtomicBoolean(false)

    private val receiver =
        object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val event = intent.toBondEvent() ?: return
                if (!isRadio(event.address)) return
                val line = event.toLogLine(sdkLabel())
                Logger.log(line.severity, Logger.tag, null, line.message)
            }
        }

    /** Marks [address] as a radio whose bond events are logged, registering the receiver if it can now. */
    fun watch(address: String) {
        watched += address.uppercase()
        if (!registered.get() && hasConnectPermission() && registered.compareAndSet(false, true)) {
            // Undispatched so the receiver is registered before a bond() that follows can broadcast.
            scope.launch(start = CoroutineStart.UNDISPATCHED) { receiveUntilCancelled() }
        }
    }

    private suspend fun receiveUntilCancelled() {
        val filter = IntentFilter().apply { bondEventActions(sdkInt).forEach(::addAction) }
        // The Bluetooth app sends these under its own uid, which a NOT_EXPORTED receiver refuses. All three are
        // protected broadcasts, so exporting admits no other sender.
        ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_EXPORTED)
        try {
            awaitCancellation()
        } finally {
            context.unregisterReceiver(receiver)
        }
    }

    private fun isRadio(address: String): Boolean {
        val normalized = address.uppercase()
        return normalized in watched || normalized == connectingAddress()?.uppercase()
    }

    private fun hasConnectPermission(): Boolean = sdkInt < Build.VERSION_CODES.S ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
        PackageManager.PERMISSION_GRANTED
}

internal fun Intent.toBondEvent(): BondEvent? {
    val address =
        IntentCompat.getParcelableExtra(this, BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)?.address
            ?: return null
    return when (action) {
        BluetoothDevice.ACTION_BOND_STATE_CHANGED ->
            BondEvent.BondStateChanged(
                address = address,
                previous = getIntExtra(BluetoothDevice.EXTRA_PREVIOUS_BOND_STATE, BluetoothDevice.ERROR),
                current = getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.ERROR),
            )

        BluetoothDevice.ACTION_KEY_MISSING ->
            BondEvent.KeyMissing(
                address = address,
                lossReason =
                if (hasExtra(BluetoothDevice.EXTRA_BOND_LOSS_REASON)) {
                    getIntExtra(BluetoothDevice.EXTRA_BOND_LOSS_REASON, BluetoothDevice.ERROR)
                } else {
                    null
                },
            )

        BluetoothDevice.ACTION_ENCRYPTION_CHANGE ->
            BondEvent.EncryptionChange(
                address = address,
                encrypted = getBooleanExtra(BluetoothDevice.EXTRA_ENCRYPTION_ENABLED, false),
                status = getIntExtra(BluetoothDevice.EXTRA_ENCRYPTION_STATUS, BluetoothDevice.ERROR),
            )

        else -> null
    }
}

/** `36.1` style from API 36, where `SDK_INT_FULL` carries the minor release; the plain API level before it. */
private fun sdkLabel(): String = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) {
    val full = Build.VERSION.SDK_INT_FULL
    "${Build.getMajorSdkVersion(full)}.${Build.getMinorSdkVersion(full)}"
} else {
    Build.VERSION.SDK_INT.toString()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7488** (2026-09-30): **[Bug]: After pining a channel there is no way of un-pining it**
  *Symptoms*: ### Contact Details  ronv42@outlook.com  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  2.8.2 (29322440)  ### Affected Android version  Android 17  ### Affected phone model  Google Pixel 9 Pro  ### Affected node model  Seed Tracker L1  ### Affected node firmware version  2.7.26  ### Steps to reproduce the bug  1. Goto Conversation screen and the list of channels 2. Highlight a channel and select the "Pin" icon 3. Channel will now show at the top of the list with the Pin icon in the lower right corner 4. No option to un-pin, selecting channel again and selecting the Pin icon doesn't  clear the pin   <img width="567" height="483" alt="Image" src="https://github.com/user-attachments/assets/7d49c12b-78ed-497c-ae05-5bdce01e57c4" />  ### Actual behavior  Pinning works, un-pinning doesn't    ### Expected 

- **Issue #7414** (2026-09-28): **Waypoint Notifications do respect app settings**
  *Symptoms*: ### Contact Details somenice  ### Affected app version 2.8.2  ### Affected Android version 17  ### Affected phone model Google Pixel 11  ### Affected node model Seeed T-1000E  ### Affected node firmware version 2.8.1  ### Steps to reproduce the bug Settings > Notifications > App notifications > Mestastic  Under Notification Categories > Other Toggle Waypoint notifications OFF  ### Actual behavior Notifications arrive on phone when another Node creates a waypoint.  ### Expected behavior Waypoint notification should not appear on phone after turning off specific app notification.  ### Relevant log output User 'LiQuiD' indicated a waypoint notification is using a Direct Message notification, rather than a seperate Waypoint notification.  ### Additional information The notification itself is not clickable. (Perhaps a separate issue to be created?) As a user I'd expect clicking the notification, if connected to the Node that created said notification, would open the app to the map, centred on created waypoint.   --- Submitted via Discord by: somenice (462694143861456896)
  **Post-Mortem & Fix Analysis**:
  > Additionally, long pressing the Waypoint Notification, then click Settings gear, takes you right to Application Notifications in Meshtastic and **HIGHLIGHTS** the Direct Message setting instead of Waypoint notifications.
  > Fixed in #7415 - waypoints now post on the Waypoint notifications channel and open the map at the waypoint.

- **Issue #7407** (2026-09-28): **[Bug]: F-Droid can't build**
  *Symptoms*: ### Contact Details  _No response_  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  2.8.2  ### Affected Android version  -  ### Affected phone model  -  ### Affected node model  -  ### Affected node firmware version  -  ### Steps to reproduce the bug  https://gitlab.com/fdroid/fdroiddata/-/jobs/16777277512/viewer#L1515  was the APK built from the tagged commit after cleaning cache and gradle cache?  ### Actual behavior  _No response_  ### Expected behavior  _No response_  ### Screenshots/Screen recordings  _No response_  ### Relevant log output  ```shell  ```  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > The MR compares against the wrong APK - `binary:` in fdroiddata!50257 still points at `v2.8.1`. Swapped to `v2.8.2`, `apksigcopier compare` against the unsigned APK from that job's artifacts passes. 
  > @licaon-kter - compare the build against it's actual version?
  > my bad, this is why we've asked you to help this be "auto" matic... I'll retry 🤦 

- **Issue #7365** (2026-09-26): **[Bug]: Android App stuck if try to load own GPS Positions**
  *Symptoms*: ### Contact Details  Dtrieb  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  Version 2.8.2 (29322435)  ### Affected Android version  Android 17  ### Affected phone model  Pixel 7 pro  ### Affected node model  T 1000-3  ### Affected node firmware version  2.8.1  ### Steps to reproduce the bug  If I try to load my own GPS Positions the App hang nothing happens.  Then this message comes:  <img width="1440" height="2848" alt="Image" src="https://github.com/user-attachments/assets/b206700c-37b7-4f49-b575-11f23d2493d3" />  ### Actual behavior  _No response_  ### Expected behavior  _No response_  ### Screenshots/Screen recordings  <img width="1440" height="2848" alt="Image" src="https://github.com/user-attachments/assets/b6c6ab1a-25f7-436e-aa04-184fac16ea51" />  ### Relevant log output  ```shell  ```  ### 
  **Post-Mortem & Fix Analysis**:
  > Its because every minute a new position point gets logged to your local node's database and causes a large number of packets. Systematically clearing it or purging the debug log fixes it. If its not too big, it just takes a while to load and doesnt crash.  Position log points should only be added at the smart position rate/distance.

- **Issue #7358** (2026-09-25): **[Bug]: [Pre-release] The app stores/reads LOC_UNSET location entries into/from the database and displays them as actual location entries**
  *Symptoms*: ### Contact Details  I'll reply in this issue.  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  snapshot 29322435, possibly started in 29322394 but have not confirmed  ### Affected Android version  Windows build  ### Affected phone model  Irrelevant  ### Affected node model  PRIVATE_HW/PORTDUINO  ### Affected node firmware version  develop  ### Steps to reproduce the bug  1. Receive position packet from target node 2. Disconnect our app from our node 3. Reconnect 4. Position entries for packets with LOC_UNSET are displayed as actual location entries in the front end  ### Actual behavior  As far as I can tell, the entries with LOC_UNSET are loaded from the database and are displayed in the front end when they shouldn't. Of course this might also mean that they are not stored correctly in the first pl

- **Issue #7309** (2026-09-23): **[Bug]: Filtering on the node list page cuts off number of online nodes, show less info**
  *Symptoms*:   ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  2.8.2 (29322389) google  ### Affected Android version  17  ### Affected phone model  Pixel 9a  ### Steps to reproduce the bug  1. go to node list page 2. start filtering for a key word like "base" 3. notice the search takes over the whole page and you lose relevant online/filtered node info  New (current filter):  <img width="336" height="157" alt="Image" src="https://github.com/user-attachments/assets/388be45b-125e-4d1f-8154-ff5e4ef0feca" />    Old (better?) filter:  <img width="342" height="205" alt="Image" src="https://github.com/user-attachments/assets/07151e83-826c-43ab-b161-69c3203f8b5e" />

- **Issue #7301** (2026-09-22): **[Bug]: Android 2.8.2 - Can switch ON or OFF of [range test]**
  *Symptoms*: ### Contact Details  nicolas.kerspern@gmail.com  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  v2.8.2-open.3 (29322358)  ### Affected Android version  Android 16  ### Affected phone model  Xiaomi 14 and U15  ### Affected node model  T-Desk, T-Beam, RAK4631 and Heltec V3  ### Affected node firmware version  2.7.26  ### Steps to reproduce the bug  I cannot switch ON or OFF (grey statut) on smartphone a range test but I can under [client.meshtastic](https://client.meshtastic.org/messages/broadcast/0) an reboot normally.  ### Actual behavior  no affect  ### Expected behavior  _No response_  ### Screenshots/Screen recordings  _No response_  ### Relevant log output  ```shell  ```  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Public range test has been deprecated. It is no longer in the 2.8 firmware and the 2.8 apps reflect that.

- **Issue #7300** (2026-09-22): **[Bug]: Android v2.8.2 - cannot change slot of LoRa**
  *Symptoms*: ### Contact Details  nicolas.kerspern@gmail.com  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  v2.8.2-open.3 (29322358)  ### Affected Android version  Android 16  ### Affected phone model  Xiaomi 14 and U15  ### Affected node model  T-Desk, T-Beam, RAK4631 and Heltec V3  ### Affected node firmware version  2.7.26  ### Steps to reproduce the bug  I cannot change on smartphone a slot number but I can under [client.meshtastic](https://client.meshtastic.org/messages/broadcast/0) an reboot normally.  ### Actual behavior  I cannot change on smartphone a slot number but I can under [client.meshtastic](https://client.meshtastic.org/messages/broadcast/0) an reboot normally.  ### Expected behavior  no affect  ### Screenshots/Screen recordings  _No response_  ### Relevant log output  ```shell  ```  ### Addit
  **Post-Mortem & Fix Analysis**:
  > You indicated above that you tried the latest alpha firmware but listed 2.7.26. Can you confirm this is still an issue in the latest alpha firmware?  Show what slots you are trying to change to.  EU868 only has a single slot. Newer 2.8 alpha firmware adds new slots that were previously unavailable. https://meshtastic.org/docs/overview/radio-settings/#frequency-slot-calculator  <img width="1127" height="347" alt="Image" src="https://github.com/user-attachments/assets/7132623e-1efc-40a8-b9bc-50bf61ae2c8a" />
  > okay, I note : EU868 only has a single slot. Newer 2.8 alpha firmware adds new slots that were previously unavailable. Thanks
  > Regarding the slot issue I discovered: the setting had been changed inadvertently set to 2 instead of 1 or 0 (for EU868). This change stemmed from a "Local Mesh Discovery" test; out of curiosity, I had tried various "LoRa Presets," and the test was interrupted while the slot was set to 2. Consequently, I couldn't change the slot back to 1 via the smartphone, a paradoxical situation where message transmission still worked, but telemetry and traceroute did not.

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

### Incident Patch 1: `e3f6ab36` (2026-10-03)
**Commit Message**: fix(settings): stop calling Balanced packet authenticity recommended (#7535)

**File**: `core/resources/src/commonMain/composeResources/values/strings.xml` (modified, +1/-1)
```diff
@@ -1396,7 +1396,7 @@
     <!-- PACKET -->
     <string name="packet_authenticity">Packet authenticity</string>
     <string name="packet_authenticity_balanced">Balanced — Prefer authenticated</string>
-    <string name="packet_authenticity_balanced_summary">Recommended. Reject unsigned downgrade attempts from nodes known to sign.</string>
+    <string name="packet_authenticity_balanced_summary">Reject unsigned downgrade attempts from nodes known to sign.</string>
     <string name="packet_authenticity_compatible">Compatible — Accept unsigned</string>
     <string name="packet_authenticity_compatible_summary">Accept unsigned traffic for maximum compatibility. A signature that can be checked and is wrong still drops the packet.</string>
     <string name="packet_authenticity_level">Protection level</string>
```

**File**: `feature/settings/settings-validation.md` (modified, +0/-20)
```diff
@@ -40,7 +40,6 @@ configuration settings screen. Constraints are sourced from two layers:
   - [Detection Sensor](#detection-sensor-moduleconfigdetectionsensorconfig)
   - [Paxcounter](#paxcounter-moduleconfigpaxcounterconfig)
   - [Status Message](#status-message-moduleconfigstatusmessageconfig)
-  - [Traffic Management](#traffic-management-moduleconfigtrafficmanagementconfig)
   - [TAK](#tak-moduleconfigtakconfig)
   - [Mesh Beacon](#mesh-beacon-moduleconfigmeshbeaconconfig)
 - [Channel Config](#channel-config)
@@ -351,25 +350,6 @@ configuration settings screen. Constraints are sourced from two layers:
 |-------|------|------------|-------|
 | `node_status` | String | maxSize: 80 bytes | Clearable; requires `supportsStatusMessage` capability. Edited on the User screen, not a module screen |
 
-### Traffic Management (`ModuleConfig.TrafficManagementConfig`)
-
-| Field | Type | Validation | Notes |
-|-------|------|------------|-------|
-| `enabled` | Boolean | Toggle | Requires `supportsTrafficManagementConfig` capability |
-| `position_dedup_enabled` | Boolean | Toggle | — |
-| `position_precision_bits` | Integer | Numeric input | — |
-| `position_min_interval_secs` | Integer | Numeric input (seconds) | — |
-| `nodeinfo_direct_response` | Boolean | Toggle | — |
-| `nodeinfo_direct_response_max_hops` | Integer | Numeric input | — |
-| `rate_limit_enabled` | Boolean | Toggle | — |
-| `rate_limit_window_secs` | Integer | Numeric input (seconds) | — |
-| `rate_limit_max_packets` | Integer | Numeric input | — |
-| `drop_unknown_enabled` | Boolean | Toggle | — |
-| `unknown_packet_threshold` | Integer | Numeric input | — |
-| `exhaust_hop_telemetry` | Boolean | Toggle | — |
-| `exhaust_hop_position` | Boolean | Toggle | — |
-| `router_preserve_hops` | Boolean | Toggle | — |
-
 ### TAK (`ModuleConfig.TAKConfig`)
 
 | Field | Type | Validation | Notes |
```

---

### Incident Patch 2: `cb11a43b` (2026-10-03)
**Commit Message**: fix(node): keep verified contacts verified (#7531)

**File**: `core/data/src/commonMain/kotlin/org/meshtastic/core/data/manager/NodeManagerImpl.kt` (modified, +10/-7)
```diff
@@ -176,18 +176,18 @@ class NodeManagerImpl(
          * map read Room, not this index, so eviction is not visible in the UI.
          *
          * Eviction order is least-valuable-first: bare-packet placeholders before nodes that have sent a real NodeInfo,
-         * and within each group the least recently heard. Nodes the user has marked (favourite, ignored) are never
-         * evicted, since that is user data rather than observed mesh state.
+         * and within each group the least recently heard. Nodes the user has marked (favourite, ignored, verified) are
+         * never evicted, since that is user data rather than observed mesh state.
          *
          * The cap is therefore best-effort rather than absolute: if protected entries alone exceed [maxNodes] the index
-         * stays above it. That is deliberate — favourite and ignored are set only by the local user, so no remote party
-         * can inflate them, and silently discarding user data to satisfy a memory bound would be the worse trade.
+         * stays above it. That is deliberate — these marks are set only by the local user, so no remote party can
+         * inflate them, and silently discarding user data to satisfy a memory bound would be the worse trade.
          */
         fun evictedToFit(maxNodes: Int, keep: Set<Int>): NodeIndex {
             if (byNum.size <= maxNodes) return this
             val evictable =
                 byNum.values
-                    .filterNot { it.num in keep || it.isFavorite || it.isIgnored }
+                    .filterNot { it.num in keep || it.isFavorite || it.isIgnored || it.manuallyVerified }
                     // Placeholders first, then oldest-heard, then node num so the outcome is deterministic.
                     .sortedWith(
                         compareByDescending<Node> { isDefaultIdentityPlaceholder(it) }
@@ -842,6 +842,7 @@ class NodeManagerImpl(
             isIgnored = info.is_ignored,
             isMuted = info.is_muted,
             signsPackets = info.has_xeddsa_signed,
+            manuallyVerified = next.manuallyVerified || info.is_key_manually_verified,
         )
     }
 
@@ -1157,8 +1158,10 @@ class NodeManagerImpl(
      */
     private fun transformUserNode(node: Node, p: User, channel: Int, manuallyVerified: Boolean): Node {
         val shouldPreserve = shouldPreserveExistingUser(node.user, p)
+        // A mesh NodeInfo carries no verification, so it never clears one an import set.
+        val verified = node.manuallyVerified || manuallyVerified
         return if (shouldPreserve) {
-            node.copy(channel = channel, manuallyVerified = manuallyVerified)
+            node.copy(channel = channel, manuallyVerified = verified)
         } else {
             val incomingKey = resolveValidatedPublicKeyHint(p.public_key)
             // Prefer node.publicKey when valid (the authoritative stored key); fall back to node.user.public_key.
@@ -1177,7 +1180,7 @@ class NodeManagerImpl(
                 keyMatch = node.keyMatch && !keyMismatch,
                 newPublicKey = if (keyMismatch) incomingKey else node.newPublicKey,
                 channel = channel,
-                manuallyVerified = manuallyVerified,
+                manuallyVerified = verified,
             )
         }
     }
```

**File**: `core/data/src/commonTest/kotlin/org/meshtastic/core/data/manager/NodeManagerImplTest.kt` (modified, +117/-0)
```diff
@@ -162,13 +162,16 @@ class NodeManagerImplTest {
     fun `eviction never drops user-marked nodes`() {
         val favourite = 5150
         val ignored = 5151
+        val verified = 5152
         nodeManager.updateNode(favourite) { it.copy(isFavorite = true) }
         nodeManager.updateNode(ignored) { it.copy(isIgnored = true) }
+        nodeManager.updateNode(verified) { it.copy(manuallyVerified = true) }
 
         floodPastCapAndAssertEvicted()
 
         assertNotNull(nodeManager.nodeDBbyNodeNum[favourite], "a favourite must never be evicted")
         assertNotNull(nodeManager.nodeDBbyNodeNum[ignored], "an ignored node must never be evicted")
+        assertNotNull(nodeManager.nodeDBbyNodeNum[verified], "a verified contact must never be evicted")
     }
 
     @Test
@@ -889,6 +892,120 @@ class NodeManagerImplTest {
         assertTrue(result.mismatchKey)
     }
 
+    private fun verifiedContactUser(longName: String) = User.Builder()
+        .also { wb ->
+            wb.id = "!12345678"
+            wb.long_name = longName
+            wb.short_name = "VC"
+            wb.hw_model = HardwareModel.HELTEC_V3
+            wb.public_key = ByteArray(32) { (it + 1).toByte() }.toByteString()
+        }
+        .build()
+
+    @Test
+    fun `a NodeInfo heard over the mesh keeps a manually verified contact verified`() {
+        val nodeNum = 1234
+        nodeManager.updateNode(nodeNum) {
+            it.copy(user = verifiedContactUser("Before"), manuallyVerified = true)
+        }
+
+        nodeManager.handleReceivedUser(nodeNum, verifiedContactUser("After"))
+
+        val result = nodeManager.nodeDBbyNodeNum[nodeNum]!!
+        assertEquals("After", result.user.long_name)
+        assertTrue(result.manuallyVerified)
+    }
+
+    @Test
+    fun `a default-name NodeInfo heard over the mesh keeps a manually verified contact verified`() {
+        val nodeNum = 1234
+        nodeManager.updateNode(nodeNum) {
+            it.copy(user = verifiedContactUser("Custom"), manuallyVerified = true)
+        }
+
+        val defaultUser =
+            User.Builder()
+                .also { wb ->
+                    wb.id = "!12345678"
+                    wb.long_name = "Meshtastic 5678"
+                    wb.short_name = "5678"
+                    wb.hw_model = HardwareModel.UNSET
+                }
+                .build()
+        nodeManager.handleReceivedUser(nodeNum, defaultUser)
+
+        assertTrue(nodeManager.nodeDBbyNodeNum[nodeNum]!!.manuallyVerified)
+    }
+
+    @Test
+    fun `a verified contact stays verified on its own key when a different key arrives`() {
+        val nodeNum = 1234
+        val verifiedUser = verifiedContactUser("Contact")
+        nodeManager.updateNode(nodeNum) {
+            it.copy(user = verifiedUser, publicKey = verifiedUser.public_key, manuallyVerified = true)
+        }
+
+        val substitute =
+            verifiedUser
+                .newBuilder()
+                .also { wb -> wb.public_key = ByteArray(32) { (it + 10).toByte() }.toByteString() }
+                .build()
+        nodeManager.handleReceivedUser(nodeNum, substitute)
+
+        val result = nodeManager.nodeDBbyNodeNum[nodeNum]!!
+        assertEquals(verifiedUser.public_key, result.user.public_key)
+        assertTrue(result.manuallyVerified)
+        assertTrue(result.mismatchKey)
+    }
+
+    @Test
+    fun `importing a verified contact marks it verified`() {
+        val nodeNum = 1234
+        nodeManager.updateNode(nodeNum) { it.copy(user = verifiedContactUser("Contact")) }
+
+        nodeManager.handleReceivedUser(nodeNum, verifiedContactUser("Contact"), manuallyVerified = true)
+
+        assertTrue(nodeManager.nodeDBbyNodeNum[nodeNum]!!.manuallyVerified)
+    }
+
+    @Test
+    fun `installNodeInfo takes the manually verified flag from the radio`() {
+        val nodeNum = 5678
+        val info =
+            ProtoNodeInfo.Builder()
+                .also { wb ->
+                    wb.num = nodeNum
+                    wb.user = verifiedContactUser("Remote")
+                    wb.last_heard = 1000
+                    wb.is_key_manually_verified = true
+                }
+                .build()
+
+        nodeManager.installNodeInfo(info)
+
+        assertTrue(nodeManager.nodeDBbyNodeNum[nodeNum]!!.manuallyVerified)
+    }
+
+    @Test
+    fun `installNodeInfo keeps a contact verified when the radio has not recorded it`() {
+        val nodeNum = 5678
+        nodeManager.updateNode(nodeNum) {
+            it.copy(user = verifiedContactUser("Remote"), manuallyVerified = true)
+        }
+        val info =
+            ProtoNodeInfo.Builder()
+                .also { wb ->
+                    wb.num = nodeNum
+                    wb.user = verifiedContactUser("Remote")
+                    wb.last_heard = 1000
+                }
+                .build()
+
+        nodeManager.installNodeInfo(info)
+
+        assertTrue(nodeManager.nodeDBbyNodeNum[nodeNum]!!.manuallyVer
```

**File**: `core/database/src/commonMain/kotlin/org/meshtastic/core/database/dao/NodeInfoDao.kt` (modified, +2/-1)
```diff
@@ -246,7 +246,7 @@ interface NodeInfoDao {
                 newPublicKey = existingNode.newPublicKey,
                 longName = existingNode.longName,
                 shortName = existingNode.shortName,
-                manuallyVerified = existingNode.manuallyVerified,
+                manuallyVerified = incomingNode.manuallyVerified || existingNode.manuallyVerified,
                 notes = resolvedNotes,
                 powerChannelLabels = resolvedPowerChannelLabels,
             )
@@ -266,6 +266,7 @@ interface NodeInfoDao {
             publicKey = resolved.key,
             keyMatch = resolved.keyMatch,
             newPublicKey = resolved.newPublicKey,
+            manuallyVerified = incomingNode.manuallyVerified || existingNode.manuallyVerified,
             notes = resolvedNotes,
             powerChannelLabels = resolvedPowerChannelLabels,
         )
```

**File**: `core/database/src/commonTest/kotlin/org/meshtastic/core/database/dao/CommonNodeInfoDaoTest.kt` (modified, +50/-0)
```diff
@@ -116,6 +116,56 @@ abstract class CommonNodeInfoDaoTest {
         assertEquals(null, result)
     }
 
+    @Test
+    fun `an update that does not carry verification keeps a stored verified contact verified`() = runTest {
+        createDb()
+        val user =
+            User.Builder()
+                .also { wb ->
+                    wb.id = "!1"
+                    wb.long_name = "Contact"
+                    wb.hw_model = org.meshtastic.proto.HardwareModel.TBEAM
+                    wb.public_key = ByteArray(32) { 1 }.toByteString()
+                }
+                .build()
+        dao.upsert(NodeEntity(num = 1, user = user, manuallyVerified = true))
+
+        dao.upsert(NodeEntity(num = 1, user = user.newBuilder().also { wb -> wb.long_name = "Renamed" }.build()))
+
+        val stored = dao.getNodeByNum(1)?.node
+        assertEquals("Renamed", stored?.longName)
+        assertTrue(stored?.manuallyVerified ?: false)
+    }
+
+    @Test
+    fun `a verified placeholder upsert marks a stored known node verified`() = runTest {
+        createDb()
+        val user =
+            User.Builder()
+                .also { wb ->
+                    wb.id = "!1"
+                    wb.long_name = "Contact"
+                    wb.hw_model = org.meshtastic.proto.HardwareModel.TBEAM
+                    wb.public_key = ByteArray(32) { 1 }.toByteString()
+                }
+                .build()
+        dao.upsert(NodeEntity(num = 1, user = user))
+
+        val placeholder =
+            User.Builder()
+                .also { wb ->
+                    wb.id = "!1"
+                    wb.long_name = "Meshtastic 0001"
+                    wb.hw_model = org.meshtastic.proto.HardwareModel.UNSET
+                }
+                .build()
+        dao.upsert(NodeEntity(num = 1, user = placeholder, manuallyVerified = true))
+
+        val stored = dao.getNodeByNum(1)?.node
+        assertEquals("Contact", stored?.longName)
+        assertTrue(stored?.manuallyVerified ?: false)
+    }
+
     @Test
     fun `a remote node changing its key keeps the stored key and records the refusal`() = runTest {
         createDb()
```

---

### Incident Patch 3: `7590547f` (2026-10-02)
**Commit Message**: refactor(ui): share the remote shell's keyboard sink from core/ui (#7526)

**File**: `core/ui/src/commonMain/kotlin/org/meshtastic/core/ui/input/RemoteKey.kt` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
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
+package org.meshtastic.core.ui.input
+
+/** Keys a soft keyboard lacks that a remote session sends itself; each feature maps them to its own wire form. */
+enum class RemoteKey {
+    ESCAPE,
+    TAB,
+    UP,
+    DOWN,
+    LEFT,
+    RIGHT,
+    HOME,
+    END,
+    PAGE_UP,
+    PAGE_DOWN,
+    DELETE,
+}
```

**File**: `core/ui/src/commonMain/kotlin/org/meshtastic/core/ui/input/RemoteKeyboardSink.kt` (added, +196/-0)
```diff
@@ -0,0 +1,196 @@
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
+package org.meshtastic.core.ui.input
+
+import androidx.compose.foundation.ExperimentalFoundationApi
+import androidx.compose.foundation.layout.size
+import androidx.compose.foundation.text.BasicTextField
+import androidx.compose.foundation.text.KeyboardOptions
+import androidx.compose.foundation.text.input.InputTransformation
+import androidx.compose.foundation.text.input.rememberTextFieldState
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.rememberUpdatedState
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.focus.FocusRequester
+import androidx.compose.ui.focus.focusRequester
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.graphics.SolidColor
+import androidx.compose.ui.input.key.Key
+import androidx.compose.ui.input.key.KeyEvent
+import androidx.compose.ui.input.key.KeyEventType
+import androidx.compose.ui.input.key.isAltPressed
+import androidx.compose.ui.input.key.isCtrlPressed
+import androidx.compose.ui.input.key.key
+import androidx.compose.ui.input.key.onPreviewKeyEvent
+import androidx.compose.ui.input.key.type
+import androidx.compose.ui.text.TextStyle
+import androidx.compose.ui.text.input.KeyboardCapitalization
+import androidx.compose.ui.text.input.KeyboardType
+import androidx.compose.ui.unit.dp
+import androidx.compose.ui.unit.sp
+
+/**
+ * Zero-size field that holds keyboard focus so both hardware keys and the soft keyboard reach a remote session.
+ *
+ * It never holds what was typed. Each edit - a typed character, an IME commit, a soft-keyboard backspace, a paste - is
+ * read as input and reverted in the same transformation, so the field stays at [SINK_SENTINEL] with the caret at its
+ * end; the sentinel is there so a soft backspace has something to delete. Keys the session sends itself are taken in
+ * the preview pass, before the field could move its caret or edit with them.
+ */
+@OptIn(ExperimentalFoundationApi::class)
+@Composable
+fun RemoteKeyboardSink(focusRequester: FocusRequester, handler: RemoteKeyHandler, modifier: Modifier = Modifier) {
+    val state = rememberTextFieldState(SINK_SENTINEL)
+    val currentHandler by rememberUpdatedState(handler)
+    val transformation = remember {
+        InputTransformation {
+            val text = asCharSequence()
+            val edit =
+                sinkEdit(
+                    (0 until changes.changeCount).map { i ->
+                        val range = changes.getRange(i)
+                        SinkChange(
+                            changes.getOriginalRange(i).length,
+                            text.subSequence(range.min, range.max).toString(),
+                        )
+                    },
+                )
+            revertAllChanges()
+            repeat(edit.deleted) { currentHandler.onBackspace() }
+            deliverText(edit.inserted, currentHandler)
+        }
+    }
+    BasicTextField(
+        state = state,
+        inputTransformation = transformation,
+        modifier =
+        modifier.size(1.dp).focusRequester(focusRequester).onPreviewKeyEvent { handleKey(it, currentHandler) },
+        textStyle = TextStyle(color = Color.Transparent, fontSize = 1.sp),
+        cursorBrush = SolidColor(Color.Transparent),
+        // No suggestions or composing: an IME rewriting a word in place would replay it as keystrokes.
+        keyboardOptions =
+        KeyboardOptions(
+            capitalization = KeyboardCapitalization.None,
+            autoCorrectEnabled = false,
+            keyboardType = KeyboardType.Password,
+        ),
+    )
+}
+
+/**
+ * Callbacks from [RemoteKeyboardSink]. Typed text arrives through [onText] without line breaks, which come through
+ * [onEnter]. A null [onChord] leaves Ctrl/Alt+letter chords to the host instead of consuming them.
+ */
+class RemoteKeyHandler(
+    val onText: (String) -> Unit,
+    val onEnter: () -> Unit,
+    val onBackspace: () -> Unit,
+    val onKey: (RemoteKey) -> Unit,
+    val onChord: ((Char, ctrl: Boolean, alt: Boolean) -> Unit)? = null,
+)
+
+/** What the keyboard sink always holds between edits. */
+private const val SINK_SENTINEL = " "
+
+/** Hands typed text over in runs, split
```

**File**: `core/ui/src/commonMain/kotlin/org/meshtastic/core/ui/input/SinkEdit.kt` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
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
+package org.meshtastic.core.ui.input
+
+/** What one edit to the keyboard sink typed: [deleted] backspaces, then [inserted] text. */
+internal data class SinkEdit(val deleted: Int, val inserted: String)
+
+/** One changed range of the keyboard sink: [replacedLength] characters of the old text gave way to [inserted]. */
+internal class SinkChange(val replacedLength: Int, val inserted: String)
+
+/**
+ * The input a set of sink changes amounts to. A change that only removes text is a backspace; one that inserts text
+ * types exactly what it inserted, so an IME replacing the sentinel, or a paste over it, sends no stray backspace and
+ * keeps a leading space.
+ */
+internal fun sinkEdit(changes: List<SinkChange>): SinkEdit {
+    var deleted = 0
+    val inserted = StringBuilder()
+    for (change in changes) {
+        if (change.inserted.isEmpty()) deleted += change.replacedLength else inserted.append(change.inserted)
+    }
+    return SinkEdit(deleted, inserted.toString())
+}
```

**File**: `core/ui/src/commonTest/kotlin/org/meshtastic/core/ui/input/RemoteKeyboardSinkTest.kt` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
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
+package org.meshtastic.core.ui.input
+
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+class RemoteKeyboardSinkTest {
+
+    @Test
+    fun aTypedCharacterIsInsertedText() {
+        assertEquals(SinkEdit(deleted = 0, inserted = "a"), sinkEdit(listOf(SinkChange(0, "a"))))
+        assertEquals(SinkEdit(deleted = 0, inserted = "ls -l\n"), sinkEdit(listOf(SinkChange(0, "ls -l\n"))))
+    }
+
+    @Test
+    fun aDeletionWithNothingInsertedIsABackspace() {
+        assertEquals(SinkEdit(deleted = 1, inserted = ""), sinkEdit(listOf(SinkChange(1, ""))))
+    }
+
+    @Test
+    fun replacingTheSentinelSendsNoBackspaceAndKeepsALeadingSpace() {
+        assertEquals(SinkEdit(deleted = 0, inserted = "x"), sinkEdit(listOf(SinkChange(1, "x"))))
+        assertEquals(SinkEdit(deleted = 0, inserted = " foo"), sinkEdit(listOf(SinkChange(1, " foo"))))
+    }
+
+    @Test
+    fun noChangesTypeNothing() {
+        assertEquals(SinkEdit(deleted = 0, inserted = ""), sinkEdit(emptyList()))
+    }
+
+    @Test
+    fun lineBreaksBecomeEnterBetweenTextRuns() {
+        assertEquals(listOf("text:ls -l", "enter", "text:pwd"), delivered("ls -l\npwd"))
+    }
+
+    @Test
+    fun aCrlfPairIsOneEnter() {
+        assertEquals(listOf("text:a", "enter", "text:b"), delivered("a\r\nb"))
+        assertEquals(listOf("enter"), delivered("\r\n"))
+    }
+
+    @Test
+    fun loneLineBreaksAreEachAnEnter() {
+        assertEquals(listOf("enter"), delivered("\n"))
+        assertEquals(listOf("text:a", "enter", "enter", "text:b"), delivered("a\n\rb"))
+        assertEquals(listOf("enter", "enter"), delivered("\r\r"))
+    }
+
+    private fun delivered(text: String): List<String> {
+        val calls = mutableListOf<String>()
+        deliverText(
+            text,
+            RemoteKeyHandler(
+                onText = { calls += "text:$it" },
+                onEnter = { calls += "enter" },
+                onBackspace = { calls += "backspace" },
+                onKey = { calls += "key:$it" },
+            ),
+        )
+        return calls
+    }
+}
```

**File**: `feature/node/src/commonMain/kotlin/org/meshtastic/feature/node/metrics/terminal/RemoteShellScreen.kt` (modified, +8/-5)
```diff
@@ -110,6 +110,9 @@ import org.meshtastic.core.ui.icon.MeshtasticIcons
 import org.meshtastic.core.ui.icon.More
 import org.meshtastic.core.ui.icon.Remove
 import org.meshtastic.core.ui.icon.Send
+import org.meshtastic.core.ui.input.RemoteKey
+import org.meshtastic.core.ui.input.RemoteKeyHandler
+import org.meshtastic.core.ui.input.RemoteKeyboardSink
 import org.meshtastic.core.ui.util.plainText
 import org.meshtastic.feature.node.metrics.terminal.RemoteShellViewModel.InputMode
 import org.meshtastic.feature.node.metrics.terminal.RemoteShellViewModel.SessionState
@@ -221,11 +224,11 @@ fun RemoteShellScreen(viewModel: RemoteShellViewModel, onNavigateUp: () -> Unit,
                     onTap = { if (inputMode == InputMode.CHARACTER) focusRequester.requestFocus() },
                 )
                 if (inputMode == InputMode.CHARACTER) {
-                    KeyboardSink(
+                    RemoteKeyboardSink(
                         focusRequester = focusRequester,
                         handler =
-                        TerminalKeyHandler(
-                            onChar = viewModel::typeKey,
+                        RemoteKeyHandler(
+                            onText = { text -> text.forEach(viewModel::typeKey) },
                             onEnter = viewModel::typeEnter,
                             onBackspace = viewModel::typeBackspace,
                             onKey = viewModel::sendKey,
@@ -259,8 +262,8 @@ fun RemoteShellScreen(viewModel: RemoteShellViewModel, onNavigateUp: () -> Unit,
                 modifiers = modifiers,
                 onKey = { key ->
                     when {
-                        inputMode == InputMode.LINE && key == TerminalKey.UP -> viewModel.recallHistory(older = true)
-                        inputMode == InputMode.LINE && key == TerminalKey.DOWN -> viewModel.recallHistory(older = false)
+                        inputMode == InputMode.LINE && key == RemoteKey.UP -> viewModel.recallHistory(older = true)
+                        inputMode == InputMode.LINE && key == RemoteKey.DOWN -> viewModel.recallHistory(older = false)
                         else -> viewModel.sendKey(key)
                     }
                     refocus()
```

**File**: `feature/node/src/commonMain/kotlin/org/meshtastic/feature/node/metrics/terminal/RemoteShellViewModel.kt` (modified, +2/-1)
```diff
@@ -54,6 +54,7 @@ import org.meshtastic.core.resources.remote_shell_no_reply
 import org.meshtastic.core.resources.remote_shell_no_reply_reason
 import org.meshtastic.core.resources.remote_shell_session_closed
 import org.meshtastic.core.resources.remote_shell_session_closed_reason
+import org.meshtastic.core.ui.input.RemoteKey
 import org.meshtastic.core.ui.viewmodel.safeLaunch
 import org.meshtastic.proto.PortNum
 import org.meshtastic.proto.RemoteShell
@@ -261,7 +262,7 @@ class RemoteShellViewModel(
     }
 
     /** An extra-keys or hardware key. Pending typing goes first so the bytes reach the PTY in the order pressed. */
-    fun sendKey(key: TerminalKey) {
+    fun sendKey(key: RemoteKey) {
         val mods = _modifiers.value
         _modifiers.value = mods.consumed()
         val sequence = key.sequence(screenState.value.applicationCursorKeys)
```

**File**: `feature/node/src/commonMain/kotlin/org/meshtastic/feature/node/metrics/terminal/TerminalKeys.kt` (modified, +13/-46)
```diff
@@ -16,20 +16,7 @@
  */
 package org.meshtastic.feature.node.metrics.terminal
 
-/** Keys a soft keyboard lacks and a shell needs. */
-enum class TerminalKey {
-    ESCAPE,
-    TAB,
-    UP,
-    DOWN,
-    LEFT,
-    RIGHT,
-    HOME,
-    END,
-    PAGE_UP,
-    PAGE_DOWN,
-    DELETE,
-}
+import org.meshtastic.core.ui.input.RemoteKey
 
 /** Sticky modifiers from the extra-keys row: each applies to the next key, then releases unless locked. */
 data class Modifiers(val ctrl: ModifierState = ModifierState.OFF, val alt: ModifierState = ModifierState.OFF) {
@@ -60,41 +47,21 @@ private const val ESC = "\u001b"
 private const val CTRL_MASK = 0x1f
 private const val DEL = '\u007f'
 
-/** What one edit to the keyboard sink typed: [deleted] backspaces, then [inserted] text. */
-internal data class SinkEdit(val deleted: Int, val inserted: String)
-
-/** One changed range of the keyboard sink: [replacedLength] characters of the old text gave way to [inserted]. */
-internal class SinkChange(val replacedLength: Int, val inserted: String)
-
-/**
- * The input a set of sink changes amounts to. A change that only removes text is a backspace; one that inserts text
- * types exactly what it inserted, so an IME replacing the sentinel, or a paste over it, sends no stray backspace and
- * keeps a leading space.
- */
-internal fun sinkEdit(changes: List<SinkChange>): SinkEdit {
-    var deleted = 0
-    val inserted = StringBuilder()
-    for (change in changes) {
-        if (change.inserted.isEmpty()) deleted += change.replacedLength else inserted.append(change.inserted)
-    }
-    return SinkEdit(deleted, inserted.toString())
-}
-
 /** The bytes a VT100-family terminal sends for a key, honouring DECCKM for the cursor keys. */
-internal fun TerminalKey.sequence(applicationCursorKeys: Boolean): String {
+internal fun RemoteKey.sequence(applicationCursorKeys: Boolean): String {
     val cursorPrefix = if (applicationCursorKeys) "${ESC}O" else "$ESC["
     return when (this) {
-        TerminalKey.ESCAPE -> ESC
-        TerminalKey.TAB -> "\t"
-        TerminalKey.UP -> "${cursorPrefix}A"
-        TerminalKey.DOWN -> "${cursorPrefix}B"
-        TerminalKey.RIGHT -> "${cursorPrefix}C"
-        TerminalKey.LEFT -> "${cursorPrefix}D"
-        TerminalKey.HOME -> "${cursorPrefix}H"
-        TerminalKey.END -> "${cursorPrefix}F"
-        TerminalKey.PAGE_UP -> "$ESC[5~"
-        TerminalKey.PAGE_DOWN -> "$ESC[6~"
-        TerminalKey.DELETE -> "$ESC[3~"
+        RemoteKey.ESCAPE -> ESC
+        RemoteKey.TAB -> "\t"
+        RemoteKey.UP -> "${cursorPrefix}A"
+        RemoteKey.DOWN -> "${cursorPrefix}B"
+        RemoteKey.RIGHT -> "${cursorPrefix}C"
+        RemoteKey.LEFT -> "${cursorPrefix}D"
+        RemoteKey.HOME -> "${cursorPrefix}H"
+        RemoteKey.END -> "${cursorPrefix}F"
+        RemoteKey.PAGE_UP -> "$ESC[5~"
+        RemoteKey.PAGE_DOWN -> "$ESC[6~"
+        RemoteKey.DELETE -> "$ESC[3~"
     }
 }
 
```

**File**: `feature/node/src/commonMain/kotlin/org/meshtastic/feature/node/metrics/terminal/TerminalKeysUi.kt` (modified, +13/-166)
```diff
@@ -16,7 +16,6 @@
  */
 package org.meshtastic.feature.node.metrics.terminal
 
-import androidx.compose.foundation.ExperimentalFoundationApi
 import androidx.compose.foundation.background
 import androidx.compose.foundation.clickable
 import androidx.compose.foundation.layout.Box
@@ -26,40 +25,18 @@ import androidx.compose.foundation.layout.RowScope
 import androidx.compose.foundation.layout.fillMaxWidth
 import androidx.compose.foundation.layout.height
 import androidx.compose.foundation.layout.padding
-import androidx.compose.foundation.layout.size
-import androidx.compose.foundation.text.BasicTextField
-import androidx.compose.foundation.text.KeyboardOptions
-import androidx.compose.foundation.text.input.InputTransformation
-import androidx.compose.foundation.text.input.rememberTextFieldState
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.Text
 import androidx.compose.runtime.Composable
-import androidx.compose.runtime.getValue
-import androidx.compose.runtime.remember
-import androidx.compose.runtime.rememberUpdatedState
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
-import androidx.compose.ui.focus.FocusRequester
-import androidx.compose.ui.focus.focusRequester
 import androidx.compose.ui.graphics.Color
-import androidx.compose.ui.graphics.SolidColor
-import androidx.compose.ui.input.key.Key
-import androidx.compose.ui.input.key.KeyEvent
-import androidx.compose.ui.input.key.KeyEventType
-import androidx.compose.ui.input.key.isAltPressed
-import androidx.compose.ui.input.key.isCtrlPressed
-import androidx.compose.ui.input.key.key
-import androidx.compose.ui.input.key.onPreviewKeyEvent
-import androidx.compose.ui.input.key.type
 import androidx.compose.ui.semantics.Role
 import androidx.compose.ui.semantics.contentDescription
 import androidx.compose.ui.semantics.semantics
 import androidx.compose.ui.semantics.stateDescription
-import androidx.compose.ui.text.TextStyle
 import androidx.compose.ui.text.font.FontFamily
 import androidx.compose.ui.text.font.FontWeight
-import androidx.compose.ui.text.input.KeyboardCapitalization
-import androidx.compose.ui.text.input.KeyboardType
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.unit.sp
 import org.jetbrains.compose.resources.StringResource
@@ -79,16 +56,14 @@ import org.meshtastic.core.resources.remote_shell_key_tab
 import org.meshtastic.core.resources.remote_shell_key_up
 import org.meshtastic.core.resources.remote_shell_modifier_locked
 import org.meshtastic.core.resources.remote_shell_modifier_once
+import org.meshtastic.core.ui.input.RemoteKey
 
 private val KEY_HEIGHT = 48.dp
 private val KEY_SPACING = 2.dp
 private val KEY_LABEL_SIZE = 13.sp
 
-/** What the keyboard sink always holds between edits. */
-private const val SINK_SENTINEL = " "
-
 private sealed interface ExtraKey {
-    data class Special(val key: TerminalKey, val label: String, val description: StringResource) : ExtraKey
+    data class Special(val key: RemoteKey, val label: String, val description: StringResource) : ExtraKey
 
     data class Typed(val char: Char) : ExtraKey
 
@@ -101,22 +76,22 @@ private sealed interface ExtraKey {
 private val EXTRA_KEY_ROWS: List<List<ExtraKey>> =
     listOf(
         listOf(
-            ExtraKey.Special(TerminalKey.ESCAPE, "ESC", Res.string.remote_shell_key_escape),
+            ExtraKey.Special(RemoteKey.ESCAPE, "ESC", Res.string.remote_shell_key_escape),
             ExtraKey.Typed('/'),
             ExtraKey.Typed('-'),
-            ExtraKey.Special(TerminalKey.HOME, "HOME", Res.string.remote_shell_key_home),
-            ExtraKey.Special(TerminalKey.UP, "↑", Res.string.remote_shell_key_up),
-            ExtraKey.Special(TerminalKey.END, "END", Res.string.remote_shell_key_end),
-            ExtraKey.Special(TerminalKey.PAGE_UP, "PGUP", Res.string.remote_shell_key_page_up),
+            ExtraKey.Special(RemoteKey.HOME, "HOME", Res.string.remote_shell_key_home),
+            ExtraKey.Special(RemoteKey.UP, "↑", Res.string.remote_shell_key_up),
+            ExtraKey.Special(RemoteKey.END, "END", Res.string.remote_shell_key_end),
+            ExtraKey.Special(RemoteKey.PAGE_UP, "PGUP", Res.string.remote_shell_key_page_up),
         ),
         listOf(
-            ExtraKey.Special(TerminalKey.TAB, "TAB", Res.string.remote_shell_key_tab),
+            ExtraKey.Special(RemoteKey.TAB, "TAB", Res.string.remote_shell_key_tab),
             ExtraKey.Ctrl,
             ExtraKey.Alt,
-            ExtraKey.Special(TerminalKey.LEFT, "←", Res.string.remote_shell_key_left),
-            ExtraKey.Special(TerminalKey.DOWN, "↓", Res.string.remote_shell_key_down),
-            ExtraKey.Special(TerminalKey.RIGHT, "→", Res.string.remote_shell_key_right),
-            ExtraKey.Special(TerminalKey.PAGE_DOWN, "PGDN", Res.string.remote_shell_key_page_down),
+            ExtraKey.Special(RemoteKey.LEFT, "←", Res.string.remote_shell_key_left),
+            ExtraKey.Special(RemoteKey.DOWN, "↓
```

---

### Incident Patch 4: `5fc82d5e` (2026-10-02)
**Commit Message**: fix(analytics): drop the package from RUM view names (#7525)

**File**: `core/navigation/src/commonMain/kotlin/org/meshtastic/core/navigation/RumViewName.kt` (modified, +15/-7)
```diff
@@ -19,11 +19,19 @@ package org.meshtastic.core.navigation
 import androidx.navigation3.runtime.NavKey
 
 /**
- * Derives the analytics view name for a navigation destination.
- *
- * The name is the route's fully-qualified class name (e.g. `org.meshtastic.core.navigation.NodesRoute.Nodes`), matching
- * the convention historically recorded by Datadog RUM before the Navigation 3 migration, so new per-screen data lines
- * up with existing dashboards. Falls back to the simple name (and finally `toString()`) on the rare platform where
- * [kotlin.reflect.KClass.qualifiedName] is unavailable.
+ * Derives the analytics view name for a navigation destination: the route's class name without its package, keeping the
+ * enclosing route interface so leaf names stay unique (e.g. `NodesRoute.Nodes`, `SettingsRoute.Bluetooth`).
+ */
+fun NavKey.rumViewName(): String = rumViewName(this::class.qualifiedName ?: this::class.simpleName ?: toString())
+
+/**
+ * Strips the package from [className], treating leading lowercase segments as the package. Minified builds can report
+ * the JVM binary name (`NodesRoute$Nodes`), so `$` is normalised to `.` to give every build type the same name.
  */
-fun NavKey.rumViewName(): String = this::class.qualifiedName ?: this::class.simpleName ?: toString()
+internal fun rumViewName(className: String): String = className
+    .split('.', '$')
+    .dropWhile { it.firstOrNull()?.isLowerCase() == true }
+    .joinToString(".")
+    .ifEmpty {
+        className
+    }
```

**File**: `core/navigation/src/commonTest/kotlin/org/meshtastic/core/navigation/RumViewNameTest.kt` (modified, +23/-8)
```diff
@@ -16,25 +16,40 @@
  */
 package org.meshtastic.core.navigation
 
+import androidx.navigation3.runtime.NavKey
 import kotlin.test.Test
 import kotlin.test.assertEquals
 
-/**
- * Guards the RUM view-name convention consumed by the analytics layer. View names must be the route's fully-qualified
- * class name so per-screen RUM data lines up with historical Datadog dashboards. A rename of a route interface or the
- * package would break cross-platform data continuity, so this test pins the format.
- */
+/** Pins the RUM view-name format that Datadog dashboards and monitors filter `@view.name` on. */
 class RumViewNameTest {
 
     @Test
-    fun `rumViewName is the fully qualified route name for data objects`() {
-        assertEquals("org.meshtastic.core.navigation.NodesRoute.Nodes", NodesRoute.Nodes.rumViewName())
+    fun `rumViewName drops the package and keeps the enclosing route`() {
+        assertEquals("NodesRoute.Nodes", NodesRoute.Nodes.rumViewName())
+        assertEquals("SettingsRoute.Bluetooth", SettingsRoute.Bluetooth.rumViewName())
     }
 
     @Test
     fun `rumViewName is stable across argument values for data classes`() {
-        val expected = "org.meshtastic.core.navigation.NodeDetailRoute.DeviceMetrics"
+        val expected = "NodeDetailRoute.DeviceMetrics"
         assertEquals(expected, NodeDetailRoute.DeviceMetrics(destNum = 1).rumViewName())
         assertEquals(expected, NodeDetailRoute.DeviceMetrics(destNum = 2).rumViewName())
     }
+
+    @Test
+    fun `rumViewName of a top level key is its simple name`() {
+        assertEquals("TopLevelKey", TopLevelKey.rumViewName())
+    }
+
+    @Test
+    fun `binary names from minified builds match the qualified form`() {
+        assertEquals("NodesRoute.Nodes", rumViewName("org.meshtastic.core.navigation.NodesRoute\$Nodes"))
+    }
+
+    @Test
+    fun `a name with no uppercase segment is kept whole`() {
+        assertEquals("a.b", rumViewName("a.b"))
+    }
 }
+
+private data object TopLevelKey : NavKey
```

**File**: `core/repository/src/commonMain/kotlin/org/meshtastic/core/repository/PlatformAnalytics.kt` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ interface PlatformAnalytics {
      * [stopScreenView] using the same [key] when the screen is left.
      *
      * @param key A stable identifier that pairs this start with its matching [stopScreenView].
-     * @param name The route-derived view name (e.g. `org.meshtastic.core.navigation.NodesRoute.Nodes`).
+     * @param name The route-derived view name (e.g. `NodesRoute.Nodes`).
      */
     fun startScreenView(key: String, name: String) {
         // Default no-op for platforms that don't support RUM (fdroid, desktop)
```

**File**: `core/ui/src/commonTest/kotlin/org/meshtastic/core/ui/component/ScreenViewTrackerTest.kt` (modified, +8/-10)
```diff
@@ -35,9 +35,9 @@ class ScreenViewTrackerTest {
 
         assertEquals(
             listOf(
-                "start:org.meshtastic.core.navigation.NodesRoute.Nodes:name=org.meshtastic.core.navigation.NodesRoute.Nodes",
-                "stop:org.meshtastic.core.navigation.NodesRoute.Nodes",
-                "start:org.meshtastic.core.navigation.NodeDetailRoute.DeviceMetrics:name=org.meshtastic.core.navigation.NodeDetailRoute.DeviceMetrics",
+                "start:NodesRoute.Nodes:name=NodesRoute.Nodes",
+                "stop:NodesRoute.Nodes",
+                "start:NodeDetailRoute.DeviceMetrics:name=NodeDetailRoute.DeviceMetrics",
             ),
             analytics.events,
         )
@@ -54,8 +54,8 @@ class ScreenViewTrackerTest {
 
         assertEquals(
             listOf(
-                "start:org.meshtastic.core.navigation.NodesRoute.Nodes:name=org.meshtastic.core.navigation.NodesRoute.Nodes",
-                "stop:org.meshtastic.core.navigation.NodesRoute.Nodes",
+                "start:NodesRoute.Nodes:name=NodesRoute.Nodes",
+                "stop:NodesRoute.Nodes",
             ),
             analytics.events,
         )
@@ -70,9 +70,7 @@ class ScreenViewTrackerTest {
         tracker.onCurrentKeyChanged(NodeDetailRoute.DeviceMetrics(destNum = 2))
 
         assertEquals(
-            listOf(
-                "start:org.meshtastic.core.navigation.NodeDetailRoute.DeviceMetrics:name=org.meshtastic.core.navigation.NodeDetailRoute.DeviceMetrics",
-            ),
+            listOf("start:NodeDetailRoute.DeviceMetrics:name=NodeDetailRoute.DeviceMetrics"),
             analytics.events,
         )
     }
@@ -87,8 +85,8 @@ class ScreenViewTrackerTest {
 
         assertEquals(
             listOf(
-                "start:org.meshtastic.core.navigation.NodesRoute.Nodes:name=org.meshtastic.core.navigation.NodesRoute.Nodes",
-                "stop:org.meshtastic.core.navigation.NodesRoute.Nodes",
+                "start:NodesRoute.Nodes:name=NodesRoute.Nodes",
+                "stop:NodesRoute.Nodes",
             ),
             analytics.events,
         )
```

---

### Incident Patch 5: `274f6f43` (2026-09-30)
**Commit Message**: fix(metrics): break power chart lines across gaps in readings (#7505)

**File**: `feature/node/src/commonMain/kotlin/org/meshtastic/feature/node/metrics/ChartGaps.kt` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
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
+package org.meshtastic.feature.node.metrics
+
+import kotlin.time.Duration.Companion.minutes
+
+private const val GAP_MEDIAN_MULTIPLIER = 3
+private val MIN_GAP_SECONDS = 5.minutes.inWholeSeconds
+
+/**
+ * Splits [items] into runs that a chart should draw as separate lines, cutting wherever consecutive readings are more
+ * than the gap threshold apart. [items] must be sorted ascending by [timeSeconds].
+ *
+ * The threshold is [GAP_MEDIAN_MULTIPLIER] times the median spacing, never below [MIN_GAP_SECONDS], so it follows the
+ * node's own reporting interval.
+ */
+internal fun <T> splitAtGaps(items: List<T>, timeSeconds: (T) -> Int): List<List<T>> {
+    if (items.size < 2) return listOf(items).filter { it.isNotEmpty() }
+    val deltas = items.zipWithNext { a, b -> (timeSeconds(b) - timeSeconds(a)).toLong() }
+    val sorted = deltas.sorted()
+    val mid = sorted.size / 2
+    val median = if (sorted.size % 2 == 0) (sorted[mid - 1] + sorted[mid]) / 2 else sorted[mid]
+    val threshold = maxOf(median * GAP_MEDIAN_MULTIPLIER, MIN_GAP_SECONDS)
+    val runs = mutableListOf(mutableListOf(items.first()))
+    items.zipWithNext().forEachIndexed { index, (_, next) ->
+        if (deltas[index] > threshold) runs.add(mutableListOf(next)) else runs.last().add(next)
+    }
+    return runs
+}
```

**File**: `feature/node/src/commonMain/kotlin/org/meshtastic/feature/node/metrics/PowerMetrics.kt` (modified, +8/-8)
```diff
@@ -274,18 +274,18 @@ private fun PowerMetricsChart(
             modelProducer.runTransaction {
                 if (currentData.isNotEmpty()) {
                     lineModel {
-                        series(
-                            x = currentData.map { it.time },
-                            y = currentData.map { retrieveCurrent(selectedChannel, it) },
-                        )
+                        splitAtGaps(currentData) { it.time }
+                            .forEach { run ->
+                                series(x = run.map { it.time }, y = run.map { retrieveCurrent(selectedChannel, it) })
+                            }
                     }
                 }
                 if (voltageData.isNotEmpty()) {
                     lineModel {
-                        series(
-                            x = voltageData.map { it.time },
-                            y = voltageData.map { retrieveVoltage(selectedChannel, it) },
-                        )
+                        splitAtGaps(voltageData) { it.time }
+                            .forEach { run ->
+                                series(x = run.map { it.time }, y = run.map { retrieveVoltage(selectedChannel, it) })
+                            }
                     }
                 }
             }
```

**File**: `feature/node/src/commonTest/kotlin/org/meshtastic/feature/node/metrics/ChartGapsTest.kt` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
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
+package org.meshtastic.feature.node.metrics
+
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+class ChartGapsTest {
+    private fun split(vararg times: Int) = splitAtGaps(times.toList()) { it }
+
+    @Test
+    fun emptyAndSingleInputsYieldNoGapSplit() {
+        assertEquals(emptyList(), split())
+        assertEquals(listOf(listOf(100)), split(100))
+    }
+
+    @Test
+    fun evenlySpacedReadingsStayOneRun() {
+        assertEquals(listOf(listOf(0, 900, 1800, 2700)), split(0, 900, 1800, 2700))
+    }
+
+    @Test
+    fun longSilenceBreaksTheRun() {
+        assertEquals(
+            listOf(listOf(0, 900, 1800), listOf(30_000, 30_900)),
+            split(0, 900, 1800, 30_000, 30_900),
+        )
+    }
+
+    @Test
+    fun thresholdScalesWithMedianSpacing() {
+        assertEquals(listOf(listOf(0, 1800, 3600, 9000)), split(0, 1800, 3600, 9000))
+        assertEquals(listOf(listOf(0, 1800, 3600), listOf(9100)), split(0, 1800, 3600, 9100))
+    }
+
+    @Test
+    fun evenSpacingCountUsesTheTrueMedian() {
+        assertEquals(listOf(listOf(0, 60, 120, 720), listOf(2220)), split(0, 60, 120, 720, 2220))
+    }
+
+    @Test
+    fun denseReadingsUseTheFiveMinuteFloor() {
+        assertEquals(listOf(listOf(0, 30, 60, 360)), split(0, 30, 60, 360))
+        assertEquals(listOf(listOf(0, 30, 60), listOf(361)), split(0, 30, 60, 361))
+    }
+
+    @Test
+    fun isolatedReadingBetweenGapsIsItsOwnRun() {
+        assertEquals(
+            listOf(listOf(0, 60, 120), listOf(10_000), listOf(20_000, 20_060)),
+            split(0, 60, 120, 10_000, 20_000, 20_060),
+        )
+    }
+}
```

---

### Incident Patch 6: `0c9d007d` (2026-09-30)
**Commit Message**: perf(store-screenshots): wait for the map to draw instead of a fixed 45 seconds (#7501)

**File**: `androidApp/src/google/kotlin/org/meshtastic/app/map/MapView.kt` (modified, +5/-1)
```diff
@@ -706,7 +706,11 @@ fun MapView(
                 mapType = effectiveGoogleMapType,
                 isMyLocationEnabled = isLocationTrackingEnabled && locationPermission.isGranted,
             ),
-            onMapLoaded = { isMapLoaded = true },
+            onMapLoaded = {
+                isMapLoaded = true
+                // The store-screenshot capture waits for this tag instead of a fixed delay.
+                Logger.withTag("MapDrawn").d { "tiles drawn" }
+            },
             onMapClick = { latLng ->
                 if (isMainMode && boxAuthoringDraft != null) {
                     val first = boxAuthoringFirstCorner
```

**File**: `feature/map-maplibre/src/commonMain/kotlin/org/meshtastic/feature/map/maplibre/MeshMap.kt` (modified, +11/-0)
```diff
@@ -31,8 +31,11 @@ import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.platform.LocalLayoutDirection
 import androidx.compose.ui.unit.dp
 import androidx.lifecycle.compose.collectAsStateWithLifecycle
+import co.touchlab.kermit.Logger
 import kotlinx.coroutines.CoroutineScope
 import kotlinx.coroutines.delay
+import kotlinx.coroutines.flow.dropWhile
+import kotlinx.coroutines.flow.filterIsInstance
 import kotlinx.coroutines.flow.filterNotNull
 import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.launch
@@ -51,6 +54,7 @@ import org.maplibre.compose.location.updateCamera
 import org.maplibre.compose.map.CameraConstraints
 import org.maplibre.compose.map.LocalMapState
 import org.maplibre.compose.map.LocalViewport
+import org.maplibre.compose.map.MapEvent
 import org.maplibre.compose.map.MapState
 import org.maplibre.compose.map.MaplibreMap
 import org.maplibre.compose.map.rememberMapState
@@ -228,6 +232,13 @@ fun MeshMap(
     // thrown by the time this is reached.
     if (!LocalMapLibreRuntimeProbe.current()) return MapEngineUnavailable(modifier)
 
+    // The store-screenshot capture waits for this tag instead of a fixed delay.
+    LaunchedEffect(mapState) {
+        // Idle can arrive before the first render session; only an idle after a drawn frame means tiles are on screen.
+        mapState.events.dropWhile { it !is MapEvent.FrameRendered }.filterIsInstance<MapEvent.Idle>().first()
+        Logger.withTag("MapDrawn").d { "tiles drawn" }
+    }
+
     val zoomRange = basemap.zoomRange()
     MaplibreMap(
         modifier = modifier,
```

**File**: `store-screenshots/src/main/kotlin/org/meshtastic/storescreenshots/StoreScreenshots.kt` (modified, +26/-3)
```diff
@@ -132,7 +132,7 @@ class StoreScreenshots {
             open(Shot.Nodes.path)
             SystemClock.sleep(READ_WARM_UP_MS)
         }
-        open(shot.path)
+        if (shot.waitsForMapDrawn) openAndAwaitMapDrawn(shot) else open(shot.path)
         SystemClock.sleep(shot.minimumWaitMs)
         val stable =
             waitForStableInActiveWindow(
@@ -150,6 +150,22 @@ class StoreScreenshots {
         save(bitmap, name)
     }
 
+    /**
+     * Waits for the map to log that its tiles are drawn: Google Maps' onMapLoaded, MapLibre's first idle. The stability
+     * check after it still covers the camera settling on the mesh.
+     */
+    private fun UiAutomatorTestScope.openAndAwaitMapDrawn(shot: Shot) {
+        // A time boundary, not a line count: logcat is a ring buffer and older matches rotate out.
+        val since = System.currentTimeMillis().let { "%d.%03d".format(it / MILLIS_PER_SECOND, it % MILLIS_PER_SECOND) }
+        open(shot.path)
+        val deadline = SystemClock.uptimeMillis() + MAP_DRAWN_TIMEOUT_MS
+        while (SystemClock.uptimeMillis() < deadline) {
+            if (MAP_DRAWN_MESSAGE in shell("logcat -d -T $since -s $MAP_DRAWN_TAG")) return
+            SystemClock.sleep(POLL_MS)
+        }
+        Log.w(TAG, "${shot.fileName} never logged $MAP_DRAWN_TAG; capturing after the timeout")
+    }
+
     /** Launches through the debug build's shell-only alias, the one launch the app honours the switches on. */
     private fun UiAutomatorTestScope.open(path: String, clearTask: Boolean = false) {
         val flags = if (clearTask) "--activity-clear-task " else ""
@@ -189,19 +205,20 @@ class StoreScreenshots {
         TenInch("tenInchScreenshots", 2560, 1440, 320),
     }
 
-    /** The five listing shots, named as fastlane lays them out. The map loads tiles for a while before it settles. */
+    /** The five listing shots, named as fastlane lays them out. The map waits for its tiles before it settles. */
     private enum class Shot(
         val fileName: String,
         val path: String,
         val minimumWaitMs: Long = 2_000,
         val stableTimeoutMs: Long = 30_000,
         val stableIntervalMs: Long = 2_000,
         val readFirst: Boolean = false,
+        val waitsForMapDrawn: Boolean = false,
     ) {
         // The primary channel's contact key, raw: `am start` takes it literally and Uri.parse accepts the caret.
         Messages("1_messages", "messages/0^all", readFirst = true),
         Nodes("2_nodes", "nodes"),
-        Map("3_map", "map", minimumWaitMs = 45_000, stableTimeoutMs = 120_000, stableIntervalMs = 8_000),
+        Map("3_map", "map", stableTimeoutMs = 120_000, stableIntervalMs = 8_000, waitsForMapDrawn = true),
         NodeDetail("4_node_detail", "nodes/$RIDGE_TOP_NUM"),
         Channels("5_channels", "channels"),
     }
@@ -230,6 +247,12 @@ class StoreScreenshots {
 
         const val READ_WARM_UP_MS = 3_000L
 
+        /** Logged by both flavors' maps (MapView.kt, MeshMap.kt) once the tiles are drawn. */
+        const val MAP_DRAWN_TAG = "MapDrawn"
+        const val MAP_DRAWN_MESSAGE = "tiles drawn"
+        const val MAP_DRAWN_TIMEOUT_MS = 45_000L
+        const val MILLIS_PER_SECOND = 1_000L
+
         const val CONNECT_ATTEMPTS = 3
         const val CONNECT_TIMEOUT_MS = 60_000L
         const val POLL_MS = 500L
```

---

### Incident Patch 7: `7d16a65e` (2026-09-30)
**Commit Message**: fix(app): restore the Apache HTTP legacy library for Google Maps (#7499)

**File**: `androidApp/src/google/AndroidManifest.xml` (modified, +9/-0)
```diff
@@ -39,6 +39,15 @@
         <meta-data
             android:name="com.google.android.geo.API_KEY"
             android:value="${MAPS_API_KEY}" />
+
+        <!--
+          Google Maps' Play services module loads into this app's classloader and, on older Play services, resolves
+          org.apache.http from it. Nothing here references it, but without this the map screen crashes.
+        -->
+        <uses-library
+            android:name="org.apache.http.legacy"
+            android:required="false" />
+
         <property
             android:name="android.app.appfunctions.app_metadata"
             android:resource="@xml/app_metadata" />
```

**File**: `androidApp/src/testGoogle/kotlin/org/meshtastic/app/GoogleMapsManifestTest.kt` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
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
+import org.w3c.dom.Element
+import java.io.File
+import java.util.Properties
+import javax.xml.parsers.DocumentBuilderFactory
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * Google Maps' Play services module loads into the app's classloader and, on older Play services, resolves
+ * org.apache.http from it, so the map screen crashes unless the merged manifest keeps the legacy library.
+ */
+class GoogleMapsManifestTest {
+
+    @Test
+    fun `the merged manifest keeps the Apache HTTP legacy library as optional`() {
+        val config = Properties()
+        requireNotNull(javaClass.classLoader?.getResourceAsStream(TEST_CONFIG)) { "$TEST_CONFIG missing" }
+            .use(config::load)
+        val manifest = File(requireNotNull(config.getProperty(MERGED_MANIFEST)) { "$MERGED_MANIFEST missing" })
+
+        val factory = DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true }
+        val libraries = factory.newDocumentBuilder().parse(manifest).getElementsByTagName("uses-library")
+        val required =
+            (0 until libraries.length)
+                .map { libraries.item(it) as Element }
+                .associate { it.getAttributeNS(ANDROID_NS, "name") to it.getAttributeNS(ANDROID_NS, "required") }
+
+        assertEquals("false", required[APACHE_HTTP_LEGACY], "$APACHE_HTTP_LEGACY must be declared, not required")
+    }
+
+    private companion object {
+        const val TEST_CONFIG = "com/android/tools/test_config.properties"
+        const val MERGED_MANIFEST = "android_merged_manifest"
+        const val ANDROID_NS = "http://schemas.android.com/apk/res/android"
+        const val APACHE_HTTP_LEGACY = "org.apache.http.legacy"
+    }
+}
```

---

### Incident Patch 8: `2c075e29` (2026-09-30)
**Commit Message**: build(r8): obfuscate google release builds (#7493)

**File**: `.github/workflows/release.yml` (modified, +30/-7)
```diff
@@ -28,6 +28,8 @@ on:
         required: true
       DATADOG_CLIENT_TOKEN:
         required: true
+      DATADOG_API_KEY:
+        required: false
       GOOGLE_MAPS_API_KEY:
         required: true
       GOOGLE_PLAY_JSON_KEY:
@@ -106,17 +108,25 @@ jobs:
             echo "MAPS_API_KEY=$GOOGLE_MAPS_API_KEY"
           } >> ./secrets.properties
 
-      # Build only: publish-play uploads the bundle once every leg has built.
+      # Build only: publish-play uploads the bundle once every leg has built. The Datadog
+      # mapping upload runs in the same invocation so its build ID matches the bundle's.
       - name: Build the Google release
         env:
           VERSION_NAME: ${{ inputs.version_name }}
           VERSION_CODE: ${{ inputs.version_code }}
-        run: >
-          ./gradlew :androidApp:bundleGoogleRelease :androidApp:assembleGoogleRelease
-          -Pandroid.injected.version.name="$VERSION_NAME"
-          -Pandroid.injected.version.code="$VERSION_CODE"
-          -PaboutLibraries.release=true
-          -Pmeshtastic.disableAbiSplits=true
+          DD_API_KEY: ${{ secrets.DATADOG_API_KEY }}
+        run: |
+          tasks=(:androidApp:bundleGoogleRelease :androidApp:assembleGoogleRelease)
+          if [ -n "$DD_API_KEY" ]; then
+            tasks+=(:androidApp:uploadMappingGoogleRelease)
+          else
+            echo "::warning::DATADOG_API_KEY is not set, so Datadog gets no R8 mapping for this release"
+          fi
+          ./gradlew "${tasks[@]}" \
+            -Pandroid.injected.version.name="$VERSION_NAME" \
+            -Pandroid.injected.version.code="$VERSION_CODE" \
+            -PaboutLibraries.release=true \
+            -Pmeshtastic.disableAbiSplits=true
 
       - name: List outputs
         run: ls -R androidApp/build/outputs/
@@ -137,6 +147,19 @@ jobs:
           path: androidApp/build/outputs/apk/google/release/*.apk
           retention-days: 1
 
+      # github-release attaches it, so anyone can retrace a pasted google-flavor stack.
+      - name: Compress the R8 mapping
+        env:
+          VERSION_CODE: ${{ inputs.version_code }}
+        run: gzip -c androidApp/build/outputs/mapping/googleRelease/mapping.txt > "mapping-google-$VERSION_CODE.txt.gz"
+
+      - name: Upload the R8 mapping artifact
+        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
+        with:
+          name: google-mapping
+          path: mapping-google-*.txt.gz
+          retention-days: 1
+
       - name: Attest Google AAB provenance
         if: success()
         uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4
```

**File**: `androidApp/build.gradle.kts` (modified, +3/-12)
```diff
@@ -172,6 +172,9 @@ configure<ApplicationExtension> {
                 // what a real build carries comes from the plugin. See #6883.
                 manifestPlaceholders["MAPS_API_KEY"] = "dummy"
             }
+            if (name == "fdroid") {
+                proguardFile("proguard-rules-fdroid.pro")
+            }
         }
     }
 
@@ -211,18 +214,6 @@ androidComponents {
     onVariants(selector().withBuildType("debug")) { variant ->
         variant.flavorName?.let { flavor -> variant.applicationId.set("com.geeksville.mesh.$flavor.debug") }
     }
-
-    onVariants(selector().withBuildType("release")) { variant ->
-        if (variant.flavorName == "google") {
-            val variantNameCapped = variant.name.replaceFirstChar { it.uppercase() }
-            val minifyTaskName = "minify${variantNameCapped}WithR8"
-            val uploadTaskName = "uploadMapping$variantNameCapped"
-            // Use tasks.names to check existence without eagerly realizing tasks
-            if (tasks.names.contains(uploadTaskName) && tasks.names.contains(minifyTaskName)) {
-                tasks.named(minifyTaskName).configure { finalizedBy(uploadTaskName) }
-            }
-        }
-    }
 }
 
 dependencies {
```

**File**: `androidApp/proguard-rules-fdroid.pro` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# F-Droid has no crash backend to retrace an obfuscated stack, so its builds keep
+# their names. Play's DEX optimization check only sees the google flavor.
+-dontobfuscate
```

**File**: `androidApp/proguard-rules.pro` (modified, +28/-7)
```diff
@@ -1,8 +1,10 @@
 # ============================================================================
 # Meshtastic Android — ProGuard / R8 rules for release minification
 # ============================================================================
-# Open-source project: obfuscation is disabled (readable stack traces). We rely
-# on R8 optimization + tree-shaking (unused code removal) for APK size reduction.
+# Release builds are shrunk and optimized. The google flavor is also
+# obfuscated; its mapping goes to Crashlytics and Datadog and is attached to
+# each GitHub release. The fdroid flavor adds proguard-rules-fdroid.pro, which
+# keeps it unobfuscated.
 #
 # Cross-platform library rules (Koin, kotlinx-serialization, Wire, Room,
 # Ktor, Coil, Kable, Kermit, Okio, DataStore, Paging, Lifecycle, Navigation 3,
@@ -14,11 +16,7 @@
 
 # ---- General ----------------------------------------------------------------
 
-# Open-source — no need to obfuscate
--dontobfuscate
-
-# R8 optimization is ENABLED. Obfuscation stays off (-dontobfuscate above), so
-# stack traces remain readable; tree-shaking plus the full optimization pass
+# R8 optimization is ENABLED: tree-shaking plus the full optimization pass
 # (method inlining, class merging, Composer/ComposerImpl devirtualization,
 # unused-argument removal) all run.
 #
@@ -39,6 +37,29 @@
 # for auditing. Inspect this file after a release build to see what libraries inject.
 -printconfiguration build/outputs/mapping/r8-merged-config.txt
 
+# ---- Names read at runtime --------------------------------------------------
+# Each name below is looked up by string, so obfuscation must leave it alone.
+
+# KableGattCacheRefresh reads these private Kable fields by reflection.
+-keepclassmembernames class com.juul.kable.BluetoothDeviceAndroidPeripheral {
+    kotlinx.coroutines.flow.MutableStateFlow connection;
+}
+-keepclassmembernames class com.juul.kable.Connection {
+    android.bluetooth.BluetoothGatt gatt;
+}
+
+# rumViewName() reports a route's class name as its Datadog view name.
+-keepnames class * implements androidx.navigation3.runtime.NavKey
+
+# isDeprecatedEnumEntry() finds each constant's field by name to read @Deprecated.
+-keepclassmembernames enum org.meshtastic.** {
+    <fields>;
+}
+
+# GooglePlatformAnalytics drops logging frames from Crashlytics stacks by class-name prefix.
+-keepnames class org.meshtastic.app.analytics.GooglePlatformAnalytics*
+-keepnames class co.touchlab.kermit.**
+
 # ---- Networking (transitive references from Ktor on Android) ----------------
 
 -dontwarn org.conscrypt.**
```

---

### Incident Patch 9: `700ff601` (2026-09-30)
**Commit Message**: fix(messaging): let a pinned conversation be unpinned (#7492)

**File**: `feature/messaging/src/commonMain/kotlin/org/meshtastic/feature/messaging/ui/contact/Contacts.kt` (modified, +3/-3)
```diff
@@ -184,9 +184,9 @@ fun ContactsScreen(
         }
     }
 
-    // Derived state for selected contacts and count
-    val selectedContacts =
-        remember(contacts, selectedContactKeys) { contacts.filter { it.contactKey in selectedContactKeys } }
+    // selectedContactKeys is mutated in place, so as a remember key it never changes; read it as state instead.
+    val selectedContacts by
+        remember(contacts) { derivedStateOf { contacts.filter { it.contactKey in selectedContactKeys } } }
     // Get message count directly from repository for selected contacts
     var selectedCount by remember { mutableIntStateOf(0) }
     LaunchedEffect(selectedContactKeys.size, selectedContactKeys.joinToString(",")) {
```

**File**: `feature/messaging/src/commonTest/kotlin/org/meshtastic/feature/messaging/ui/contact/ContactsSelectionToolbarTest.kt` (added, +143/-0)
```diff
@@ -0,0 +1,143 @@
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
+package org.meshtastic.feature.messaging.ui.contact
+
+import androidx.compose.material3.MaterialTheme
+import androidx.compose.ui.test.ComposeUiTest
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.longClick
+import androidx.compose.ui.test.onNodeWithContentDescription
+import androidx.compose.ui.test.onNodeWithText
+import androidx.compose.ui.test.performClick
+import androidx.compose.ui.test.performTouchInput
+import androidx.compose.ui.test.v2.runComposeUiTest
+import androidx.lifecycle.SavedStateHandle
+import dev.mokkery.MockMode
+import dev.mokkery.answering.calls
+import dev.mokkery.answering.returns
+import dev.mokkery.every
+import dev.mokkery.everySuspend
+import dev.mokkery.matcher.any
+import dev.mokkery.mock
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.ExperimentalCoroutinesApi
+import kotlinx.coroutines.flow.MutableStateFlow
+import kotlinx.coroutines.flow.update
+import kotlinx.coroutines.test.UnconfinedTestDispatcher
+import kotlinx.coroutines.test.resetMain
+import kotlinx.coroutines.test.setMain
+import org.meshtastic.core.model.ConnectionState
+import org.meshtastic.core.model.ContactKey
+import org.meshtastic.core.model.ContactSettings
+import org.meshtastic.core.repository.ConnectionStateProvider
+import org.meshtastic.core.repository.PacketRepository
+import org.meshtastic.core.repository.RadioConfigRepository
+import org.meshtastic.core.testing.FakeNodeRepository
+import org.meshtastic.core.testing.TestDataFactory
+import org.meshtastic.core.ui.util.SnackbarManager
+import org.meshtastic.proto.ChannelSet
+import org.meshtastic.proto.ChannelSettings
+import kotlin.test.AfterTest
+import kotlin.test.BeforeTest
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * The toolbar derives pin and mute state from the conversations currently selected, so it has to follow the selection
+ * as rows are long-pressed rather than the list as it stood when the selection was last empty.
+ */
+@OptIn(ExperimentalTestApi::class, ExperimentalCoroutinesApi::class)
+class ContactsSelectionToolbarTest {
+
+    private val channelKey = ContactKey.broadcast(0).value
+    private val nodeRepository = FakeNodeRepository()
+    private val packetRepository: PacketRepository = mock(MockMode.autofill)
+    private val radioConfigRepository: RadioConfigRepository = mock(MockMode.autofill)
+    private val connectionStateProvider: ConnectionStateProvider = mock(MockMode.autofill)
+    private val pinWrites = MutableStateFlow(emptyList<Boolean>())
+
+    @BeforeTest
+    fun setUp() {
+        Dispatchers.setMain(UnconfinedTestDispatcher())
+        nodeRepository.setMyNodeInfo(TestDataFactory.createMyNodeInfo())
+        every { connectionStateProvider.connectionState } returns MutableStateFlow(ConnectionState.Disconnected)
+        every { packetRepository.getUnreadCountTotal() } returns MutableStateFlow(0)
+        every { packetRepository.getContacts() } returns MutableStateFlow(emptyMap())
+        every { radioConfigRepository.channelSetFlow } returns
+            MutableStateFlow(
+                ChannelSet.Builder().settings(listOf(ChannelSettings.Builder().name(CHANNEL_NAME).build())).build(),
+            )
+        everySuspend { packetRepository.setPinned(any(), true) } calls { pinWrites.update { it + true } }
+        everySuspend { packetRepository.setPinned(any(), false) } calls { pinWrites.update { it + false } }
+    }
+
+    @AfterTest
+    fun tearDown() {
+        Dispatchers.resetMain()
+    }
+
+    private fun ComposeUiTest.showContacts(settings: ContactSettings) {
+        every { packetRepository.getContactSettings() } returns MutableStateFlow(mapOf(channelKey to settings))
+        val viewModel =
+            ContactsViewModel(
+                savedStateHandle = SavedStateHandle(),
+                nodeRepository = nodeRepository,
+                packetRepository = packetRepository,
+                snackbarManager = SnackbarManager(),
+                radioConfigRepository = radioConfigRepository,
+                connectionStateProvider = connectionStateProvider,
+            )
+        setContent {
+            MaterialTheme {
+                ContactsScreen(
+                    onNavigateToShare
```

---

### Incident Patch 10: `047b8e9e` (2026-09-30)
**Commit Message**: build: make build-logic pass validatePlugins and run it in CI (#7486)

**File**: `.github/workflows/reusable-check.yml` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ jobs:
       - name: Spotless, Detekt & Android Lint
         # The root spotlessCheck and detekt do not reach the included build-logic build.
         # detektTypeResolved runs the rules that need a classpath, which plain detekt skips.
-        run: ./gradlew spotlessCheck detekt detektTypeResolved :build-logic:convention:spotlessCheck :build-logic:convention:detekt androidApp:lintFdroidDebug androidApp:lintGoogleDebug core:barcode:lintFdroidDebug core:barcode:lintGoogleDebug -Pci=true -Pkotlin.daemon.useFallbackStrategy=false --continue
+        run: ./gradlew spotlessCheck detekt detektTypeResolved :build-logic:convention:spotlessCheck :build-logic:convention:detekt :build-logic:convention:validatePlugins androidApp:lintFdroidDebug androidApp:lintGoogleDebug core:barcode:lintFdroidDebug core:barcode:lintGoogleDebug -Pci=true -Pkotlin.daemon.useFallbackStrategy=false --continue
 
   # ── Screenshot Test Validation ──────────────────────────────────────
   screenshot-check:
```

**File**: `build-logic/convention/src/main/kotlin/org/meshtastic/buildlogic/DocsTasks.kt` (modified, +17/-3)
```diff
@@ -22,13 +22,17 @@ import org.gradle.api.Project
 import org.gradle.api.file.DirectoryProperty
 import org.gradle.api.file.RegularFileProperty
 import org.gradle.api.provider.Property
+import org.gradle.api.tasks.CacheableTask
 import org.gradle.api.tasks.Input
 import org.gradle.api.tasks.InputDirectory
 import org.gradle.api.tasks.InputFile
 import org.gradle.api.tasks.Optional
 import org.gradle.api.tasks.OutputDirectory
+import org.gradle.api.tasks.PathSensitive
+import org.gradle.api.tasks.PathSensitivity
 import org.gradle.api.tasks.TaskAction
 import org.gradle.kotlin.dsl.register
+import org.gradle.work.DisableCachingByDefault
 import java.io.File
 
 private const val DEFAULT_NAV_ORDER = 999
@@ -99,8 +103,11 @@ private data class IndexEntry(
     val charCount: Int,
 )
 
+@CacheableTask
 abstract class GenerateDocsBundleTask : DefaultTask() {
-    @get:InputDirectory abstract val sourceDir: DirectoryProperty
+    @get:InputDirectory
+    @get:PathSensitive(PathSensitivity.RELATIVE)
+    abstract val sourceDir: DirectoryProperty
 
     @get:OutputDirectory abstract val generatedOutputDir: DirectoryProperty
 
@@ -311,11 +318,15 @@ private fun generateCss(): String =
     """
         .trimMargin()
 
+@DisableCachingByDefault(because = "Checks the bundle and produces no output")
 abstract class ValidateDocsBundleTask : DefaultTask() {
-    @get:InputDirectory @get:Optional
+    @get:InputDirectory
+    @get:Optional
+    @get:PathSensitive(PathSensitivity.RELATIVE)
     abstract val bundleDir: DirectoryProperty
 
     @get:InputFile @get:Optional
+    @get:PathSensitive(PathSensitivity.NONE)
     abstract val schemaFile: RegularFileProperty
 
     @TaskAction
@@ -362,8 +373,11 @@ abstract class ValidateDocsBundleTask : DefaultTask() {
     }
 }
 
+@DisableCachingByDefault(because = "Copies files, which is no slower than restoring them from a cache")
 abstract class PublishDocsSiteTask : DefaultTask() {
-    @get:InputDirectory abstract val sourceDir: DirectoryProperty
+    @get:InputDirectory
+    @get:PathSensitive(PathSensitivity.RELATIVE)
+    abstract val sourceDir: DirectoryProperty
 
     @get:OutputDirectory abstract val siteOutputDir: DirectoryProperty
 
```

---

### Incident Patch 11: `25d923bd` (2026-09-30)
**Commit Message**: fix(firmware): show the percent while a maintenance UF2 downloads (#7485)

**File**: `feature/firmware/src/commonMain/kotlin/org/meshtastic/feature/firmware/UsbUpdateSupport.kt` (modified, +1/-0)
```diff
@@ -302,6 +302,7 @@ internal class UsbPassWriter(
                                     ProgressState(
                                         message = UiText.DynamicString(downloadingMsg),
                                         progress = progress,
+                                        details = formatTransferPercent(progress),
                                     ),
                                 ),
                             )
```

**File**: `feature/firmware/src/commonTest/kotlin/org/meshtastic/feature/firmware/CommonUsbPassWriterTest.kt` (modified, +18/-1)
```diff
@@ -23,6 +23,9 @@ import org.meshtastic.core.model.DeviceHardware
 import org.meshtastic.core.model.MaintenanceUf2Manifest
 import org.meshtastic.core.model.SoftDeviceVariant
 import org.meshtastic.core.repository.MaintenanceUf2Repository
+import org.meshtastic.core.resources.Res
+import org.meshtastic.core.resources.UiText
+import org.meshtastic.core.resources.firmware_update_transfer_percent
 import kotlin.test.Test
 import kotlin.test.assertEquals
 import kotlin.test.assertTrue
@@ -109,7 +112,8 @@ abstract class CommonUsbPassWriterTest {
             UsbPassWriter(
                 fileHandler = WritableVolume(info),
                 maintenanceUf2Repository = FixedManifest(manifest),
-                retrieveMaintenanceUf2 = { asset, _ ->
+                retrieveMaintenanceUf2 = { asset, onProgress ->
+                    onProgress(0.5f)
                     written += asset.fileName
                     FirmwareArtifact(uri = CommonUri.parse("file:///tmp/${asset.fileName}"), fileName = asset.fileName)
                 },
@@ -136,6 +140,19 @@ abstract class CommonUsbPassWriterTest {
         assertEquals(1, h.unblockCalls.size, "The sketch blocks on while(!Serial) until DTR is asserted")
     }
 
+    @Test
+    fun `the maintenance image download shows its percent`() = runTest {
+        val h = harness(sketchInfo)
+        val states = mutableListOf<FirmwareUpdateState>()
+
+        h.writer.write(erasePass, treeUri, rak) { states += it }
+
+        assertEquals(
+            listOf<UiText?>(UiText.Resource(Res.string.firmware_update_transfer_percent, 50)),
+            states.filterIsInstance<FirmwareUpdateState.Downloading>().map { it.progressState.details },
+        )
+    }
+
     @Test
     fun `the bootloader erase image never has its cdc port opened`() = runTest {
         // After the bootloader consumes the block the only CDC port present is the bootloader's own; opening it would
```

---

### Incident Patch 12: `c925ef87` (2026-09-30)
**Commit Message**: fix(ble): export the bond wait receiver so bond broadcasts reach it (#7484)

**File**: `core/ble/src/androidHostTest/kotlin/org/meshtastic/core/ble/AndroidBluetoothRepositoryBondTest.kt` (modified, +25/-0)
```diff
@@ -17,6 +17,7 @@
 package org.meshtastic.core.ble
 
 import android.bluetooth.BluetoothDevice
+import android.content.Context
 import androidx.lifecycle.Lifecycle
 import androidx.lifecycle.LifecycleOwner
 import androidx.lifecycle.LifecycleRegistry
@@ -408,6 +409,30 @@ class AndroidBluetoothRepositoryBondTest {
         assertFalse(repo.isBonded(otherMac))
     }
 
+    @Test
+    fun `every bond receiver is exported so the Bluetooth app can reach it`() = runTest(UnconfinedTestDispatcher()) {
+        val mac = "AA:BB:CC:DD:EE:12"
+        RobolectricBleBonding.grantBluetoothConnectPermission()
+        RobolectricBleBonding.primeBond(mac, bondState = BluetoothDevice.BOND_NONE, createBondReturns = true)
+        val repo = newRepository(UnconfinedTestDispatcher(testScheduler))
+
+        val failure = launchBond(repo, mac)
+        // The parked bond's wait receiver and the bond event log both listen while bond() waits.
+        val bondReceivers =
+            shadowOf(RuntimeEnvironment.getApplication()).registeredReceivers.filter {
+                it.intentFilter.hasAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
+            }
+        assertEquals(2, bondReceivers.size)
+        assertTrue(bondReceivers.all { (it.flags and Context.RECEIVER_EXPORTED) == Context.RECEIVER_EXPORTED })
+
+        RobolectricBleBonding.sendBondStateChanged(
+            mac,
+            newState = BluetoothDevice.BOND_BONDED,
+            previousState = BluetoothDevice.BOND_BONDING,
+        )
+        assertNull(failure.await())
+    }
+
     @Test
     fun `isValid accepts a well-formed MAC and rejects garbage`() = runTest(UnconfinedTestDispatcher()) {
         val repo = newRepository(UnconfinedTestDispatcher(testScheduler))
```

**File**: `core/ble/src/androidMain/kotlin/org/meshtastic/core/ble/AndroidBluetoothRepository.kt` (modified, +3/-1)
```diff
@@ -115,7 +115,9 @@ class AndroidBluetoothRepository(
 
                     val filter =
                         android.content.IntentFilter(android.bluetooth.BluetoothDevice.ACTION_BOND_STATE_CHANGED)
-                    ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
+                    // The Bluetooth app sends this under its own uid, which a NOT_EXPORTED receiver refuses. It is a
+                    // protected broadcast, so exporting admits no other sender.
+                    ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_EXPORTED)
 
                     try {
                         val start = startOrObserveBond(remoteDevice, result)
```

---

### Incident Patch 13: `4763623b` (2026-09-30)
**Commit Message**: chore: say kmpSmokeCompile builds device-test APKs, fix cleanup log tag (#7482)

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ Meshtastic-Android uses unit tests, Robolectric JVM tests, and instrumented UI t
 - Ensure all tests pass by running:
   - `./gradlew test` for unit and Robolectric tests (pure-Android modules)
   - `./gradlew allTests` for KMP module tests (`core:*`, `feature:*`) — neither `test` nor `allTests` alone is sufficient; both must pass.
-  - `./gradlew kmpSmokeCompile` when touching any KMP module — compiles the non-Android targets the unit tests don't cover
+  - `./gradlew kmpSmokeCompile` when touching any KMP module, to compile the non-Android targets the unit tests don't cover and assemble the device-test APKs
   - `./gradlew connectedAndroidTest` for instrumented tests
 - For UI components, write Robolectric Compose tests where possible for faster execution.
 - If your change is difficult to test, explain why in your pull request.
```

**File**: `build-logic/convention/src/main/kotlin/RootConventionPlugin.kt` (modified, +2/-2)
```diff
@@ -53,15 +53,15 @@ class RootConventionPlugin : Plugin<Project> {
 
 /**
  * Registers a `kmpSmokeCompile` lifecycle task that depends on `compileKotlinJvm` and `compileKotlinIosSimulatorArm64`
- * tasks from all KMP modules using task path strings.
+ * tasks from all KMP modules, plus `assembleAndroidDeviceTest` for [DEVICE_TEST_MODULES], using task path strings.
  *
  * Non-KMP modules simply won't have these tasks, so the path-based dependencies will be silently ignored.
  */
 private fun Project.registerKmpSmokeCompileTask() {
     val kmp = kmpModules()
     tasks.register("kmpSmokeCompile") {
         group = "verification"
-        description = "Compile all KMP modules for JVM and iOS Simulator ARM64 targets."
+        description = "Compile all KMP modules for JVM and iOS Simulator ARM64, and assemble the device-test APKs."
 
         kmp.forEach { path ->
             dependsOn("$path:compileKotlinJvm")
```

**File**: `core/ble/src/commonMain/kotlin/org/meshtastic/core/ble/KableBleConnection.kt` (modified, +3/-3)
```diff
@@ -154,7 +154,7 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
         // _deviceFlow.emit() is intentionally outside this block — making it
         // non-cancellable could hang teardown on a slow collector.
         withContext(NonCancellable) {
-            cleanUpPeripheral(device)
+            cleanUpPeripheral()
             peripheral = p
             ActiveBleConnection.active = ActiveConnection(p, device.address)
         }
@@ -312,8 +312,8 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
     override fun invalidateServiceCache(): Boolean = peripheral?.refreshGattCache() == true
 
     /** Ensures the previous peripheral's GATT resources are fully released. */
-    private suspend fun cleanUpPeripheral(device: BleDevice) {
-        withContext(NonCancellable) { safeClosePeripheral(device.address.anonymize()) }
+    private suspend fun cleanUpPeripheral() {
+        withContext(NonCancellable) { safeClosePeripheral("replace") }
     }
 
     /**
```

**File**: `docs/en/developer/codebase.md` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ block rather than assuming a plugin does or does not exist.
 ### Key Gradle Tasks
 
 ```shell
-# Compile check of every KMP module for JVM and iosSimulatorArm64 (excludes :desktopApp)
+# Compile check of every KMP module for JVM and iosSimulatorArm64 (excludes :desktopApp), plus the device-test APKs
 ./gradlew kmpSmokeCompile
 
 # Run all tests: allTests covers KMP modules, test covers Android/JVM-only modules; run both
```

---

### Incident Patch 14: `364fd9d9` (2026-09-30)
**Commit Message**: fix: audit leftovers (neighbor-info interval unit, shared constants) (#7481)

**File**: `.skills/testing-ci/SKILL.md` (modified, +1/-1)
```diff
@@ -139,7 +139,7 @@ The tiers are named here and the workflows carry the label versions.
 - `org.gradle.isolated-projects=true` for better parallelism
 
 ### CI Conventions
-- **KMP Smoke Compile:** `./gradlew kmpSmokeCompile` is a lifecycle task (registered in `RootConventionPlugin`) that depends on `compileKotlinJvm` + `compileKotlinIosSimulatorArm64` for every KMP module in the hand-maintained `ALL_MODULES_FULL` list, plus `compileAndroidDeviceTest` for `:core:database` and `:core:model`. `scripts/check-module-list.py` fails the PR when that list drifts from `settings.gradle.kts`. CI runs it in `shard-core`.
+- **KMP Smoke Compile:** `./gradlew kmpSmokeCompile` is a lifecycle task (registered in `RootConventionPlugin`) that depends on `compileKotlinJvm` + `compileKotlinIosSimulatorArm64` for every KMP module in the hand-maintained `ALL_MODULES_FULL` list, plus `assembleAndroidDeviceTest` for `:core:database` and `:core:model`, so a device-test APK that fails to dex or package fails here. `scripts/check-module-list.py` fails the PR when that list drifts from `settings.gradle.kts`. CI runs it in `shard-core`.
 - **Kotlin warnings fail the test shards:** they pass `-PwarningsAsErrors=true`, which sets `allWarningsAsErrors` on every Kotlin compilation (`KotlinAndroid.kt`, plus `desktopApp` and `schema-strings`). The shards don't run the `compile*MainKotlinMetadata` tasks, so a warning only those report doesn't fail CI (today they warn about duplicate KLIB names). Reproduce locally with the same flag on the compile or test tasks you touched.
 - **`maxParallelForks` CI logic:** `ProjectExtensions.kt` reads the `ci` Gradle property (`providers.gradleProperty("ci")`) and uses full available processors in CI (4 forks on std runners) vs. half locally. All CI invocations pass `-Pci=true`.
 - **Detekt report formats:** Detekt.kt checks `project.findProperty("ci") == "true"` and disables html, txt, md reports in CI; only xml + sarif are retained for GitHub annotations.
```

**File**: `androidApp/src/google/kotlin/org/meshtastic/app/map/offline/pmtiles/OfflineRegionExtractor.kt` (modified, +2/-2)
```diff
@@ -28,6 +28,7 @@ import kotlinx.coroutines.flow.flowOn
 import kotlinx.coroutines.sync.Mutex
 import kotlinx.coroutines.sync.withLock
 import org.meshtastic.core.common.util.ioDispatcher
+import org.meshtastic.core.common.util.nowSeconds
 import java.io.IOException
 import java.util.zip.GZIPInputStream
 import kotlin.uuid.Uuid
@@ -121,7 +122,7 @@ internal class OfflineRegionExtractor(private val store: OfflineRegionStore) {
                         maxZoom = zoomRange.last,
                         tileCount = tiles.size.toLong(),
                         byteSize = archiveFile.length(),
-                        createdAtEpochSeconds = System.currentTimeMillis() / MILLIS_PER_SECOND,
+                        createdAtEpochSeconds = nowSeconds,
                     )
                         .also { store.add(it) }
                 } catch (e: IOException) {
@@ -171,7 +172,6 @@ internal class OfflineRegionExtractor(private val store: OfflineRegionStore) {
         const val MAX_REGIONS = 10
         const val MAX_TOTAL_BYTES = 300L * 1024 * 1024
         private const val PROGRESS_STRIDE = 10
-        private const val MILLIS_PER_SECOND = 1_000L
 
         /** Both the Protomaps build and the MVT layers it packages (OpenStreetMap) require attribution. */
         const val ATTRIBUTION = "© OpenStreetMap contributors, © Protomaps"
```

**File**: `build-logic/convention/src/main/kotlin/RootConventionPlugin.kt` (modified, +4/-4)
```diff
@@ -68,13 +68,13 @@ private fun Project.registerKmpSmokeCompileTask() {
             dependsOn("$path:compileKotlinIosSimulatorArm64")
         }
 
-        // Compile androidDeviceTest sources so instrumented test breakages are caught early.
-        // These tests require a device/emulator to *run*, but compilation alone is cheap.
-        DEVICE_TEST_MODULES.forEach { path -> dependsOn("$path:compileAndroidDeviceTest") }
+        // Assemble, not just compile, the androidDeviceTest APKs: dexing and packaging failures only show up there.
+        // Running them still needs a device.
+        DEVICE_TEST_MODULES.forEach { path -> dependsOn("$path:assembleAndroidDeviceTest") }
     }
 }
 
-/** KMP modules that declare `withDeviceTest {}` and therefore have `compileAndroidDeviceTest` tasks. */
+/** KMP modules that declare `withDeviceTest {}` and therefore have `assembleAndroidDeviceTest` tasks. */
 private val DEVICE_TEST_MODULES = listOf(":core:database", ":core:model")
 
 /**
```

**File**: `core/ble/src/commonMain/kotlin/org/meshtastic/core/ble/KableBleConnection.kt` (modified, +3/-3)
```diff
@@ -154,7 +154,7 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
         // _deviceFlow.emit() is intentionally outside this block — making it
         // non-cancellable could hang teardown on a slow collector.
         withContext(NonCancellable) {
-            cleanUpPeripheral(tag = device.address.anonymize())
+            cleanUpPeripheral(device)
             peripheral = p
             ActiveBleConnection.active = ActiveConnection(p, device.address)
         }
@@ -312,8 +312,8 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
     override fun invalidateServiceCache(): Boolean = peripheral?.refreshGattCache() == true
 
     /** Ensures the previous peripheral's GATT resources are fully released. */
-    private suspend fun cleanUpPeripheral(tag: String) {
-        withContext(NonCancellable) { safeClosePeripheral(tag) }
+    private suspend fun cleanUpPeripheral(device: BleDevice) {
+        withContext(NonCancellable) { safeClosePeripheral(device.address.anonymize()) }
     }
 
     /**
```

**File**: `core/data/src/commonMain/kotlin/org/meshtastic/core/data/manager/CommandSenderImpl.kt` (modified, +1/-2)
```diff
@@ -66,7 +66,6 @@ import org.meshtastic.proto.Telemetry
 import org.meshtastic.proto.ToRadio
 import kotlin.math.absoluteValue
 import kotlin.random.Random
-import kotlin.time.Duration.Companion.hours
 import org.meshtastic.proto.Position as ProtoPosition
 
 @Suppress("TooManyFunctions", "CyclomaticComplexMethod", "LongParameterList")
@@ -435,7 +434,7 @@ class CommandSenderImpl(
                 val neighborInfoToSend =
                     neighborInfoHandler.lastNeighborInfo
                         ?: run {
-                            val oneHour = 1.hours.inWholeMinutes.toInt()
+                            val oneHour = TimeConstants.SECONDS_PER_HOUR
                             Logger.d { "No stored neighbor info from connected radio, sending dummy data" }
                             NeighborInfo.Builder()
                                 .also { wb ->
```

**File**: `core/data/src/commonMain/kotlin/org/meshtastic/core/data/manager/NodeManagerImpl.kt` (modified, +3/-2)
```diff
@@ -650,8 +650,9 @@ class NodeManagerImpl(
         updateNodeAndSchedulePersistence(nodeNum, channel, session, transform)
     }
 
-    override suspend fun updateNodeAndPersist(nodeNum: Int, channel: Int, transform: (Node) -> Node) {
-        val result = updateNodeState(nodeNum, channel, transform)?.next ?: return
+    /** [transform] may run more than once under compare-and-set contention, so it must be side-effect free. */
+    private suspend fun updateNodeAndPersist(nodeNum: Int, transform: (Node) -> Node) {
+        val result = updateNodeState(nodeNum, channel = 0, transform)?.next ?: return
         if (shouldPersist(result)) persistLatestNode(nodeNum)
     }
 
```

**File**: `core/data/src/commonTest/kotlin/org/meshtastic/core/data/manager/CommandSenderImplTest.kt` (modified, +13/-0)
```diff
@@ -450,6 +450,19 @@ class CommandSenderImplTest {
         verify { neighborInfoHandler.recordStartTime(1) }
     }
 
+    @Test
+    fun requestNeighborInfo_localNode_dummyReportsAnHourBroadcastIntervalInSeconds() = runTest {
+        every { neighborInfoHandler.lastNeighborInfo } returns null
+        val packets = mutableListOf<MeshPacket>()
+        everySuspend { packetHandler.sendToRadio(capture(packets)) } returns true
+
+        commandSender.requestNeighborInfo(requestId = 1, destNum = MY_NODE_NUM)
+
+        val sent = NeighborInfo.ADAPTER.decode(requireNotNull(packets.single().decoded).payload)
+        assertEquals(3600, sent.node_broadcast_interval_secs)
+        assertEquals(listOf(3600), sent.neighbors.map { it.node_broadcast_interval_secs })
+    }
+
     @Test
     fun requestNeighborInfo_remoteNode_sendsRequest() = runTest {
         everySuspend { packetHandler.sendToRadio(any<MeshPacket>()) } returns true
```

**File**: `core/data/src/commonTest/kotlin/org/meshtastic/core/data/manager/MeshMessageProcessorImplTest.kt` (modified, +0/-1)
```diff
@@ -260,7 +260,6 @@ class MeshMessageProcessorImplTest {
             advanceUntilIdle()
 
             assertEquals(listOf(myNodeNum, 999), updatedNodes)
-            verifySuspend(mode = VerifyMode.exactly(0)) { nodeManager.updateNodeAndPersist(any(), any(), any()) }
         }
 
     @Test
```

---

### Incident Patch 15: `017de61a` (2026-09-30)
**Commit Message**: build: keep the JUnit Platform launcher off device-test APKs (#7480)

**File**: `build-logic/convention/src/main/kotlin/org/meshtastic/buildlogic/ProjectExtensions.kt` (modified, +7/-5)
```diff
@@ -65,12 +65,14 @@ val Project.configProperties: Properties
 
 /** Configure common test options like parallel execution and logging. */
 internal fun Project.configureTestOptions() {
-    // Gradle 9 requires junit-platform-launcher on every test runtime classpath when
-    // useJUnitPlatform() is active.  Add it lazily to all *UnitTestRuntimeClasspath and
-    // *TestRuntimeClasspath configurations so all Android and JVM test tasks get it
-    // without requiring per-module declarations.
+    // Only JUnit Platform test tasks need the launcher. Instrumented test APKs run under AndroidJUnitRunner, and a KMP
+    // device-test APK fails to dex and package the JUnit Platform jars.
     configurations
-        .matching { it.name.endsWith("UnitTestRuntimeClasspath") || it.name.endsWith("TestRuntimeClasspath") }
+        .matching {
+            it.name.endsWith("TestRuntimeClasspath") &&
+                !it.name.contains("DeviceTest") &&
+                !it.name.contains("AndroidTest")
+        }
         .configureEach {
             val launcher = libs.library("junit-platform-launcher")
             project.dependencies.add(name, launcher)
```

#### Recent Merged Pull Requests:
- **PR #7543** (2026-10-05): chore: Scheduled updates (Graphs, Baseline Profile) (@jamesarich)
- **PR #7542** (2026-10-04): docs: update CHANGELOG.md (@jamesarich)
- **PR #7541** (2026-10-04): chore: Scheduled updates (Firmware, Hardware, Translations) (@jamesarich)
- **PR #7540** (2026-10-04): chore: Scheduled updates (Graphs, Baseline Profile) (@jamesarich)
- **PR #7539** (2026-10-04): chore: Scheduled updates (Firmware, Hardware, Translations) (@jamesarich)
- **PR #7538** (2026-10-04): docs(release): add the 2.8.3 features that landed after the highlights (@jamesarich)
- **PR #7537** (2026-10-04): docs: update CHANGELOG.md (@jamesarich)
- **PR #7536** (2026-10-03): chore(deps): update takpacket-sdk to 0.9.3 (@jamesarich)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
