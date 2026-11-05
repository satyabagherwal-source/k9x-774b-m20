> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/meshtastic-meshtastic-android-learnings.md`  
> **Source**: github ([https://github.com/meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android))  
> **Source Version**: `9ea8d718`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T01:07:57.307Z  
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
> **Harvest Timestamp**: 2026-11-05T01:07:57.300Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshtastic/Meshtastic-Android`
- **Description**: Android application for Meshtastic
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1911 stars

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
        // cancel() not cancelAndJoin(): joining under 
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
    override suspend fun bond(device: BleDevice, pin: String?) {
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

                    var pinReceiver: android.content.BroadcastReceiver? = null
                    try {
                        // Registered before createBond() so the pairing request it triggers cannot slip past, and
                        // inside the try so the PIN never outlives this bond attempt.
                        pinReceiver = pin?.let { registerPairingPinReceiver(macAddress, it) }
                        val start = startOrObserveBond(remoteDevice, result)
                        awaitBondResult(remoteDevice, result, start)
                    } finally {
                        unregisterBondReceiver(receiver)
                        pinReceiver?.let(::unregisterBondReceiver)
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
                    // createBond() returns false when a bond is already in flight (a GATT operation on a
                    // secured characteristic starts one) or already established, so bondState decides.
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
        // createBond() returning true only queues the request: BOND_BONDING can lag it, and a request the
        // stack then fails stays BOND_NONE with no broadcast. Tolerate two polled BOND_NONE samples
        // (polls 1-2), then fail on the third persistent BOND_NONE.
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
                        createdBondNon
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7890** (2026-11-04): **[Bug]: Widget needs now too much blank space to display the same data info**
  *Symptoms*: ### Contact Details  _No response_  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  2.8.4 (lateste github)  ### Affected Android version  Android 16  ### Affected phone model  Samsung   ### Affected node model  All  ### Affected node firmware version  2.8.2  ### Steps to reproduce the bug  about the widget, i saw the fix to 2x2, https://github.com/meshtastic/Meshtastic-Android/pull/7862 but for bigger area the widget needs more more space to display all data info.   ### Actual behavior  The widget needs a lot more space to display all data info, and add a lot of blank space at bottom  <img width="959" height="532" alt="Image" src="https://github.com/user-attachments/assets/29b38237-88ba-4874-b9ce-e6f67481da40" />  <img width="959" height="797" alt="Image" src="https://github.com/user-attachments/ass

- **Issue #7855** (2026-11-01): **[Bug]: Node Tracker widget wastes a lot of space**
  *Symptoms*: ### Contact Details  _No response_  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  v2.8.4-open1  ### Affected Android version  Android 17  ### Affected phone model  Google Pixel 10 Pro XL  ### Affected node model  N/A  ### Affected node firmware version  N/A  ### Steps to reproduce the bug  Add a node tracker widget to the your home screen, observe its size and amount of empty space  ### Actual behavior  The widget works, it's just way too big at the minimum size for what it is showing  ### Expected behavior  I would expect either more info to be shown or the size allowed to be smaller. If you make the widget wider than 2x2, more data is shown but this data would easily fit on the 2x2 size  ### Screenshots/Screen recordings  <img width="1344" height="2992" alt="Image" src="https://github.com/user-a

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

### Incident Patch 1: `df139ecd` (2026-11-04)
**Commit Message**: fix(debug): run the log search off the main thread (#7891)

**File**: `feature/settings/src/commonMain/kotlin/org/meshtastic/feature/settings/debugging/DebugViewModel.kt` (modified, +11/-8)
```diff
@@ -92,8 +92,12 @@ class LogSearchManager {
     val searchState = _searchState.asStateFlow()
 
     fun setSearchText(text: String) {
+        // An unchanged query never re-emits through the StateFlow, so clearing here would hide its matches for good.
+        if (text == _searchText.value) return
         _searchText.value = text
         _currentMatchIndex.value = -1
+        // The field reads its text from here; matches follow once the off-main search finishes.
+        _searchState.value = SearchState(searchText = text)
     }
 
     fun goToNextMatch() {
@@ -118,8 +122,8 @@ class LogSearchManager {
         setSearchText("")
     }
 
-    fun updateMatches(searchText: String, filteredLogs: List<DebugViewModel.UiMeshLog>) {
-        val matches = findSearchMatches(searchText, filteredLogs)
+    fun applyMatches(searchText: String, matches: List<SearchMatch>) {
+        if (searchText != _searchText.value) return
         val hasMatches = matches.isNotEmpty()
         _searchState.value =
             _searchState.value.copy(
@@ -269,7 +273,6 @@ class DebugViewModel(
 
     fun updateFilteredLogs(logs: List<UiMeshLog>) {
         filterManager.updateFilteredLogs(logs)
-        searchManager.updateMatches(searchManager.searchText.value, logs)
     }
 
     fun setRetentionDays(days: Int) {
@@ -291,12 +294,12 @@ class DebugViewModel(
     init {
         Logger.d { "DebugViewModel created" }
         safeLaunch(tag = "searchMatchUpdater") {
-            combine(searchManager.searchText, filterManager.filteredLogs) { searchText, logs ->
-                searchManager.findSearchMatches(searchText, logs)
-            }
-                .collect {
-                    searchManager.updateMatches(searchManager.searchText.value, filterManager.filteredLogs.value)
+            // Regex over up to DEFAULT_MAX_LOGS rows per keystroke; on main it ANRs.
+            combine(searchManager.searchText, filterManager.filteredLogs, ::Pair)
+                .mapLatest { (searchText, logs) ->
+                    searchText to withContext(dispatchers.default) { searchManager.findSearchMatches(searchText, logs) }
                 }
+                .collect { (searchText, matches) -> searchManager.applyMatches(searchText, matches) }
         }
     }
 
```

**File**: `feature/settings/src/commonTest/kotlin/org/meshtastic/feature/settings/debugging/DebugViewModelTest.kt` (modified, +72/-14)
```diff
@@ -27,6 +27,7 @@ import kotlinx.coroutines.CompletableDeferred
 import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.ExperimentalCoroutinesApi
 import kotlinx.coroutines.cancel
+import kotlinx.coroutines.test.StandardTestDispatcher
 import kotlinx.coroutines.test.UnconfinedTestDispatcher
 import kotlinx.coroutines.test.resetMain
 import kotlinx.coroutines.test.runCurrent
@@ -71,22 +72,23 @@ class DebugViewModelTest {
         meshLogPrefs.setRetentionDays(7)
         meshLogPrefs.setLoggingEnabled(true)
 
-        viewModel =
-            DebugViewModel(
-                meshLogRepository = meshLogRepository,
-                nodeRepository = nodeRepository,
-                meshLogPrefs = meshLogPrefs,
-                setMeshLogSettingsUseCase =
-                SetMeshLogSettingsUseCase(
-                    meshLogRepository,
-                    meshLogPrefs,
-                    FakeApplicationCoroutineScope(testDispatcher),
-                ),
-                alertManager = alertManager,
-                dispatchers = dispatchers,
-            )
+        viewModel = newViewModel(dispatchers)
     }
 
+    private fun newViewModel(dispatchers: CoroutineDispatchers) = DebugViewModel(
+        meshLogRepository = meshLogRepository,
+        nodeRepository = nodeRepository,
+        meshLogPrefs = meshLogPrefs,
+        setMeshLogSettingsUseCase =
+        SetMeshLogSettingsUseCase(
+            meshLogRepository,
+            meshLogPrefs,
+            FakeApplicationCoroutineScope(testDispatcher),
+        ),
+        alertManager = alertManager,
+        dispatchers = dispatchers,
+    )
+
     @AfterTest
     fun tearDown() {
         Dispatchers.resetMain()
@@ -187,6 +189,62 @@ class DebugViewModelTest {
         viewModel.searchState.value.hasMatches shouldBe false
     }
 
+    @Test
+    fun `typing a search query runs the match on the default dispatcher`() = runTest {
+        val defaultDispatcher = StandardTestDispatcher(testScheduler)
+        val vm = newViewModel(CoroutineDispatchers(testDispatcher, testDispatcher, defaultDispatcher))
+        vm.updateFilteredLogs(listOf(DebugViewModel.UiMeshLog("1", "TypeA", "Date1", "Apple")))
+
+        vm.searchManager.setSearchText("Apple")
+
+        vm.searchState.value.searchText shouldBe "Apple"
+        vm.searchState.value.hasMatches shouldBe false
+
+        runCurrent()
+
+        vm.searchState.value.allMatches.size shouldBe 1
+        vm.viewModelScope.cancel()
+    }
+
+    @Test
+    fun `a search result for text that has since changed is dropped`() {
+        val manager = LogSearchManager()
+        manager.setSearchText("App")
+        manager.setSearchText("Apple")
+
+        manager.applyMatches("App", listOf(LogSearchManager.SearchMatch(0, 0, 2, "message")))
+
+        manager.searchState.value.searchText shouldBe "Apple"
+        manager.searchState.value.hasMatches shouldBe false
+    }
+
+    @Test
+    fun `a new query clears the previous matches until its own search finishes`() {
+        val manager = LogSearchManager()
+        manager.setSearchText("App")
+        manager.applyMatches("App", listOf(LogSearchManager.SearchMatch(0, 0, 2, "message")))
+        manager.goToNextMatch()
+
+        manager.setSearchText("Apple")
+
+        manager.searchState.value.searchText shouldBe "Apple"
+        manager.searchState.value.hasMatches shouldBe false
+        manager.searchState.value.allMatches shouldBe emptyList()
+        manager.searchState.value.currentMatchIndex shouldBe -1
+    }
+
+    @Test
+    fun `setting the same query again keeps its matches`() {
+        val manager = LogSearchManager()
+        manager.setSearchText("App")
+        manager.applyMatches("App", listOf(LogSearchManager.SearchMatch(0, 0, 2, "message")))
+
+        manager.setSearchText("App")
+
+        manager.searchState.value.hasMatches shouldBe true
+        manager.searchState.value.allMatches.size shouldBe 1
+    }
+
     @Test
     fun `filterManager filters logs correctly with AND and OR modes`() {
         val logs =
```

---

### Incident Patch 2: `927b3854` (2026-11-04)
**Commit Message**: fix(widget): pick the layout by breakpoint and the line budget by the reported cell (#7912)

**File**: `core/resources/src/commonMain/composeResources/values/strings.xml` (modified, +4/-4)
```diff
@@ -2243,10 +2243,10 @@
     <string name="widget_node_tracker_choose">Choose a node to track</string>
     <string name="widget_node_tracker_not_found">Node not found. Tap to choose a node.</string>
     <string name="widget_node_tracker_title">Node Tracker</string>
-    <string name="widget_packets_bad">Bad packets</string>
-    <string name="widget_packets_dropped">Dropped packets</string>
-    <string name="widget_packets_received">Packets received</string>
-    <string name="widget_packets_sent">Packets sent</string>
+    <string name="widget_packets_bad">Bad</string>
+    <string name="widget_packets_dropped">Dropped</string>
+    <string name="widget_packets_received">Received</string>
+    <string name="widget_packets_sent">Sent</string>
     <string name="widget_relays">Relayed</string>
     <string name="widget_relays_canceled">Relays canceled</string>
     <!-- WIFI -->
```

**File**: `docs/en/user/widget.md` (modified, +3/-3)
```diff
@@ -29,12 +29,12 @@ The **Meshtastic** widget displays the **connected node's** current local stats:
 - **AirUtil** — the percentage of airtime this node used transmitting in the last hour
 - **Nodes** — how many nodes are online, out of the total known
 - **Uptime** — how long the node has been running since its last reboot
-- **Packets sent** and **Packets received** — the node's traffic counters
+- **Sent** and **Received** — the node's packet counters
 - **Noise floor** — the background noise level in dBm
 - **Free memory** — memory the node has left
 - **Relayed** — packets the node relayed for others
-- **Bad packets** — corrupt packets received
-- **Dropped packets** — packets the node discarded
+- **Bad** — corrupt packets received
+- **Dropped** — packets the node discarded
 - **Relays canceled** — relays the node started and then canceled
 - **Updated** — the time the stats last refreshed, along the foot of a three-row widget
 
```

**File**: `feature/widget/README.md` (modified, +3/-3)
```diff
@@ -63,9 +63,9 @@ The widget shows the following information when connected:
 | Node identity | Short name chip with node colors, battery as the hero value |
 | Channel utilization | Percentage + progress bar |
 | Air utilization | Percentage + progress bar |
-| Readings | Nodes online / total, uptime to the minute, packets sent, packets received, noise floor, free memory, relayed, bad packets, dropped packets, relays canceled, in that order; the last-updated time at any three-row size |
+| Readings | Nodes online / total, uptime to the minute, sent, received, noise floor, free memory, relayed, bad, dropped, relays canceled, in that order; the last-updated time at any three-row size |
 
-The readings fill a grid: one column up to three cells wide, two columns from four (the width counted in font-scaled dp, so a large font keeps one column), with as many lines as the cell's real height holds once the header, identity row and bars (stacked at two cells wide) are taken out (`WidgetSizes.lines`, which scales the text rows and the lines by the font scale so a large font drops a line instead of clipping one). A cell whose lines hold every reading in one column uses one, whatever its width. Nodes online moves into the identity row from three cells wide. Whatever height is left, under a line, sits under the readings. One row shows the mark, chip, battery and channel utilization, plus nodes online when wide. The refresh button sits in the header only at two rows and two-plus cells wide, where the title leaves room for it; elsewhere tapping the widget opens the app.
+The readings fill a grid: one column up to three cells wide, two columns from four (the width counted in font-scaled dp, so a large font keeps one column), with as many lines as the cell's real height holds once the header, identity row and bars (stacked at two cells wide) are taken out (`WidgetSizes.lines`, which scales the text rows and the lines by the font scale so a large font drops a line instead of clipping one). A cell whose lines hold every reading in one column uses one, whatever its width. Nodes online moves into the identity row from three cells wide. When the readings run out before the lines do, the lines spread across the leftover height; otherwise what is left, under a line, sits under them. One row shows the mark, chip, battery and channel utilization, plus nodes online when wide. The refresh button sits in the header only at two rows and two-plus cells wide, where the title leaves room for it; elsewhere tapping the widget opens the app.
 
 Both widgets share one design: a header with the theme-tinted Meshtastic mark and the widget's name (one-row sizes lead their row with the mark instead), the node chip with battery beside it, and the same stat rows and type scale (`WidgetSizes.Type`). A stale tracked node keeps its chip colors and greys its values.
 
@@ -128,7 +128,7 @@ class LocalStatsWidget : GlanceAppWidget(), KoinComponent {
 
 ### `WidgetSizes`
 
-Both widgets compose under `SizeMode.Exact`, so `LocalSize` is the cell's real bounds: the width and height thresholds in `WidgetSizes` pick the layout (one row under 90 dp, compact under 180 dp, wide from 200 dp, two columns from 300 dp, the footnote from 260 dp), and the tall layouts count their reading lines from the height itself. Each threshold sits just under the smallest cell span it catches. On a Pixel 6a a 2x2 widget measures 179x202 dp in portrait and 394x107 dp in landscape; on the API 36 emulator's Pixel launcher 2x2 is 172x234 dp and a row is 117 dp. The picker previews cannot take `Exact`, so `previewSizeMode` is a `Responsive` set of the tiers' corners. Both providers set `targetCellWidth`/`targetCellHeight` to 2x2 and `minResizeHeight` to one row.
+Both widgets compose under `SizeMode.Responsive`: the launcher picks the breakpoint that fits the cell (three widths, 130, 200 and 320 dp, at five heights, 48, 90, 180, 260 and 350 dp, every combination, since a missing one would route a 4x3 cell to a two-row tier), and `WidgetSizes.cell` reads the cell's real bounds from the widget options as `AppWidgetManager` holds them now (Glance's own copy refreshes only on the launcher's options broadcast, which a resize does not always send) (min width by max height is the portrait cell, max width by min height the landscape one), taking the current orientation's cell when the breakpoint fits in it and the other's when it fits there, so the tall layouts count their reading lines from the height they really have. `SizeMode.Exact` would hand the real bounds over directly, but it composes only for the sizes the launcher reports, and a Pixel launcher that reported stale sizes after a resize showed the compact layout in a four-row cell. A stale option under `Responsive` costs slack, never the wrong layout, and the cell is capped at the next breakpoint in each direction, so the layout the launcher shows between a resize and the recomposition it triggers was counted for a cell of its own tier
```

**File**: `feature/widget/src/main/kotlin/org/meshtastic/feature/widget/LocalStatsLayouts.kt` (modified, +7/-3)
```diff
@@ -80,7 +80,7 @@ internal fun StatsSquare(state: LocalStatsWidgetUiState, wide: Boolean) {
 
 /**
  * Under a header [headerHeight] tall: identity, utilization, then as many readings as the height holds, in [columns],
- * most glanced-at first. Height left over, under a line, sits under the readings.
+ * most glanced-at first. Height left over spreads the lines when the readings run out, and sits under them otherwise.
  */
 @Composable
 internal fun StatsTall(state: LocalStatsWidgetUiState, wide: Boolean, columns: Int, extra: Boolean, headerHeight: Dp) {
@@ -103,8 +103,12 @@ internal fun StatsTall(state: LocalStatsWidgetUiState, wide: Boolean, columns: I
             AirUtilBar(state)
         }
         Spacer(GlanceModifier.height(4.dp))
-        StatGrid(readings(state, nodesInGrid = !wide).take(lines * columns), columns, lines)
-        Spacer(GlanceModifier.defaultWeight())
+        StatGrid(
+            readings(state, nodesInGrid = !wide).take(lines * columns),
+            columns,
+            lines,
+            GlanceModifier.defaultWeight(),
+        )
         if (extra) Footnote(updatedText(state))
     }
 }
```

**File**: `feature/widget/src/main/kotlin/org/meshtastic/feature/widget/LocalStatsWidget.kt` (modified, +1/-1)
```diff
@@ -154,7 +154,7 @@ class LocalStatsWidget :
                                     StatsTall(
                                         state,
                                         wide,
-                                        columns = WidgetSizes.columns(size),
+                                        columns = WidgetSizes.columns(),
                                         extra = WidgetSizes.isExtraTall(size),
                                         headerHeight =
                                         if (refresh) {
```

**File**: `feature/widget/src/main/kotlin/org/meshtastic/feature/widget/NodeTrackerLayouts.kt` (modified, +4/-4)
```diff
@@ -48,7 +48,7 @@ internal fun TrackerContent(state: NodeTrackerWidgetState.Tracking) {
         when {
             WidgetSizes.isOneRow(size) -> TrackerRow(state, wide)
             WidgetSizes.isCompact(size) -> TrackerSquare(state, wide)
-            else -> TrackerTall(state, columns = WidgetSizes.columns(size))
+            else -> TrackerTall(state, columns = WidgetSizes.columns())
         }
     }
 }
@@ -85,8 +85,8 @@ private fun TrackerSquare(state: NodeTrackerWidgetState.Tracking, wide: Boolean)
 }
 
 /**
- * Identity, the name, then the readings that fit in [columns]. Height left over sits under the readings: under a line
- * when the node has readings to fill it, more when it has few.
+ * Identity, the name, then the readings that fit in [columns]. Height left over spreads the lines when the node has
+ * fewer readings than lines, and sits under them otherwise.
  */
 @Composable
 private fun TrackerTall(state: NodeTrackerWidgetState.Tracking, columns: Int) {
@@ -103,7 +103,7 @@ private fun TrackerTall(state: NodeTrackerWidgetState.Tracking, columns: Int) {
         Spacer(GlanceModifier.height(2.dp))
         LongName(state, maxLines = if (linesUsed < lines) 2 else 1)
         Spacer(GlanceModifier.height(4.dp))
-        StatGrid(readings, columns, lines, state.isStale)
+        StatGrid(readings, columns, lines, GlanceModifier.defaultWeight(), state.isStale)
     }
 }
 
```

**File**: `feature/widget/src/main/kotlin/org/meshtastic/feature/widget/WidgetComponents.kt` (modified, +17/-5)
```diff
@@ -161,14 +161,26 @@ internal fun StatRow(
 /**
  * [readings] as [StatRow]s, up to [columns] to a line, in reading order across then down. A short last line keeps its
  * cells the width of the others. Readings that all fit in one column of [lines] take one, so a tall cell fills with
- * lines rather than with gaps between sections.
+ * lines rather than with gaps between sections, and when they still leave lines over, the lines spread across the
+ * height [modifier] gives the grid rather than leaving a block under them.
  */
 @Composable
-internal fun StatGrid(readings: List<Reading>, columns: Int, lines: Int, isStale: Boolean = false) {
+internal fun StatGrid(
+    readings: List<Reading>,
+    columns: Int,
+    lines: Int,
+    modifier: GlanceModifier = GlanceModifier,
+    isStale: Boolean = false,
+) {
     val perLine = if (readings.size <= lines) 1 else columns
-    Column(modifier = GlanceModifier.fillMaxWidth()) {
-        readings.chunked(perLine).forEach { line ->
-            Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
+    val chunks = readings.chunked(perLine)
+    val spread = chunks.size < lines
+    Column(modifier = modifier.fillMaxWidth()) {
+        chunks.forEach { line ->
+            Row(
+                modifier = if (spread) GlanceModifier.fillMaxWidth().defaultWeight() else GlanceModifier.fillMaxWidth(),
+                verticalAlignment = Alignment.CenterVertically,
+            ) {
                 repeat(perLine) { index ->
                     if (index > 0) Spacer(GlanceModifier.width(GRID_GUTTER))
                     val reading = line.getOrNull(index)
```

**File**: `feature/widget/src/main/kotlin/org/meshtastic/feature/widget/WidgetSizes.kt` (modified, +100/-18)
```diff
@@ -16,32 +16,46 @@
  */
 package org.meshtastic.feature.widget
 
+import android.appwidget.AppWidgetManager
+import android.content.Context
+import android.content.res.Configuration
+import android.os.Bundle
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.ReadOnlyComposable
 import androidx.compose.ui.unit.Dp
 import androidx.compose.ui.unit.DpSize
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.unit.sp
 import androidx.glance.LocalContext
+import androidx.glance.LocalGlanceId
 import androidx.glance.LocalSize
+import androidx.glance.appwidget.GlanceAppWidgetManager
+import androidx.glance.appwidget.LocalAppWidgetOptions
 import androidx.glance.appwidget.PreviewSizeMode
 import androidx.glance.appwidget.SizeMode
 
 /**
- * How both widgets read their size. They compose under [SizeMode.Exact], so `LocalSize` is the cell's real bounds and
- * each layout counts the reading lines its height holds instead of fitting a breakpoint and leaving the difference
- * blank. The thresholds sit just under the smallest cell span they catch: one row is 51dp tall in landscape and about
- * 95dp in portrait, two cells 130dp wide in portrait, four cells 340dp on a 4-column launcher. The named sizes are the
- * tiers' corners, for tests and the picker previews, which cannot take [SizeMode.Exact].
+ * How both widgets read their size. They compose under [SizeMode.Responsive], so the launcher picks the layout by the
+ * breakpoint that fits the cell, which every launcher does reliably; [cell] then reads the cell's real bounds from the
+ * widget options so the layout can fill the height it has, instead of leaving the difference between breakpoint and
+ * cell blank. [SizeMode.Exact] would hand over the real bounds directly, but composes only for the sizes the launcher
+ * reports, and a launcher that reports stale ones after a resize then shows a layout meant for another cell. The
+ * thresholds sit just under the smallest cell span they catch: one row is 51dp tall in landscape and about 95dp in
+ * portrait, two cells 130dp wide in portrait, four cells 340dp on a 4-column launcher.
  */
 internal object WidgetSizes {
     private val NARROW_WIDTH = 130.dp
     private val WIDE_WIDTH = 200.dp
-    private val TWO_COLUMN_WIDTH = 300.dp
+    private val TWO_COLUMN_WIDTH = 320.dp
     private val ONE_ROW_HEIGHT = 48.dp
     private val COMPACT_HEIGHT = 90.dp
     private val TWO_ROWS_HEIGHT = 180.dp
     private val THREE_ROWS_HEIGHT = 260.dp
+    private val FOUR_ROWS_HEIGHT = 350.dp
+
+    // Ascending, so each breakpoint knows the next: a composition for one is only ever shown under the next.
+    private val WIDTHS = listOf(NARROW_WIDTH, WIDE_WIDTH, TWO_COLUMN_WIDTH)
+    private val HEIGHTS = listOf(ONE_ROW_HEIGHT, COMPACT_HEIGHT, TWO_ROWS_HEIGHT, THREE_ROWS_HEIGHT, FOUR_ROWS_HEIGHT)
 
     val ROW = DpSize(NARROW_WIDTH, ONE_ROW_HEIGHT)
     val WIDE_ROW = DpSize(WIDE_WIDTH, ONE_ROW_HEIGHT)
@@ -58,7 +72,11 @@ internal object WidgetSizes {
     private val PIXEL_2X2 = DpSize(179.dp, 202.dp)
     private val EMULATOR_2X2 = DpSize(172.dp, 234.dp)
 
-    val sizeMode: SizeMode = SizeMode.Exact
+    /** Every width at every height: a missing combination would route a cell to a tier that wastes one dimension. */
+    val sizeMode: SizeMode =
+        SizeMode.Responsive(buildSet { for (width in WIDTHS) for (height in HEIGHTS) add(DpSize(width, height)) })
+
+    /** The picker preview has no cell to read, so it gets the breakpoints plus two measured 2x2 cells. */
     val previewSizeMode: PreviewSizeMode =
         SizeMode.Responsive(setOf(ROW, SQUARE, TALL, PIXEL_2X2, EMULATOR_2X2, BIG, TWO_COLUMNS))
 
@@ -72,30 +90,76 @@ internal object WidgetSizes {
     fun isExtraTall(size: DpSize): Boolean = size.height >= THREE_ROWS_HEIGHT
 
     /**
-     * How many reading columns a width holds: two from four cells up, where a label and value pair fits in each. The
-     * width counts in font-scaled dp, since the labels grow with the font and a column too narrow for them clips.
+     * The real bounds this composition is shown at: the cell the launcher reports for the current orientation when the
+     * current breakpoint fits in it (the launcher only shows a breakpoint where it fits), else the other orientation's
+     * when it fits there, else the breakpoint itself, so a stale or missing option costs slack, never a layout meant
+     * for another cell. Capped at the next breakpoint in each direction, from which the launcher shows that one
+     * instead: between a resize and the recomposition it triggers, the launcher shows the old composition's layout for
+     * the new size, and the cap keeps that layout counted for a cell of its own tier.
      */
     @Composable
     @ReadOnlyComposable
-    fun columns(size: DpSize): Int {
-        val fontScale = LocalContext.current.resources.configuration.fontScale
-        return if (size.width / fontScale >= TWO_COLUMN_WIDTH) 2 else 1
+    fu
```

---

### Incident Patch 3: `7c48c8ec` (2026-11-04)
**Commit Message**: chore(deps): update androidx.test.uiautomator:uiautomator to v2.4.1 (#7909)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ compose-screenshot = "0.0.1-alpha16"
 # Gradle plugin (same coordinates/version). The stable 1.4.x line predates AGP 9 support.
 benchmark = "1.6.0-alpha01"
 profileinstaller = "1.4.1"
-androidx-uiautomator = "2.4.0"
+androidx-uiautomator = "2.4.1"
 
 # Compose Multiplatform
 compose-multiplatform = "1.12.2"
```

#### Recent Merged Pull Requests:
- **PR #7916** (2026-11-05): chore: Scheduled updates (Firmware, Hardware, Translations) (@jamesarich)
- **PR #7915** (2026-11-04): docs: update CHANGELOG.md (@jamesarich)
- **PR #7914** (2026-11-04): docs: update CHANGELOG.md (@jamesarich)
- **PR #7913** (2026-11-04): chore(deps): update sceneview to v4.66.0 (@renovate[bot])
- **PR #7912** (2026-11-04): fix(widget): pick the layout by breakpoint and the line budget by the reported cell (@jamesarich)
- **PR #7911** (2026-11-04): docs: update CHANGELOG.md (@jamesarich)

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

## X. debug): run the log search off the main thread (#7891)

**RULE**:
When implementing operations in `feature/settings/src/commonMain/kotlin/org/meshtastic/feature/settings/debugging/DebugViewModel.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meshtastic/Meshtastic-Android. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `df139ecd`: debug): run the log search off the main thread (#7891). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `feature/settings/src/commonMain/kotlin/org/meshtastic/feature/settings/debugging/DebugViewModel.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
        // An unchanged query never re-emits through the StateFlow, so clearing here would hide its matches for good.
        if (text == _searchText.value) return
        // The field reads its text from here; matches follow once the off-main search finishes.
        _searchState.value = SearchState(searchText = text)
    fun applyMatches(searchText: String, matches: List<SearchMatch>) {
        if (searchText != _searchText.value) return
            // Regex over up to DEFAULT_MAX_LOGS rows per keystroke; on main it ANRs.
            combine(searchManager.searchText, filterManager.filteredLogs, ::Pair)
                .mapLatest { (searchText, logs) ->
                    searchText to withContext(dispatchers.default) { searchManager.findSearchMatches(searchText, logs) }
                .collect { (searchText, matches) -> searchManager.applyMatches(searchText, matches) }
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
    fun updateMatches(searchText: String, filteredLogs: List<DebugViewModel.UiMeshLog>) {
        val matches = findSearchMatches(searchText, filteredLogs)
        searchManager.updateMatches(searchManager.searchText.value, logs)
            combine(searchManager.searchText, filterManager.filteredLogs) { searchText, logs ->
                searchManager.findSearchMatches(searchText, logs)
            }
                .collect {
                    searchManager.updateMatches(searchManager.searchText.value, filterManager.filteredLogs.value)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `df139ecd` are properly handled with clean fallback behavior.
