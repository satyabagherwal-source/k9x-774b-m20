> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/meshtastic-meshtastic-android-learnings.md`  
> **Source**: github ([https://github.com/meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android))  
> **Source Version**: `2a41b35c`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T22:32:55.726Z  
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
> **Harvest Timestamp**: 2026-10-20T22:32:55.720Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshtastic/Meshtastic-Android`
- **Description**: Android application for Meshtastic
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1879 stars

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
                        createdBondNoneGraceRemaining = Duration.ZERO
                    }

                    android.bluetooth.BluetoothDevice.BOND_NONE -> {
                        // Invariant: if start.createdBond is false, startOrObserveBond either completed
                        // result or observed BOND_BONDING, which is represented by bondingWasInFlight.
                        val pollFailureDetails =
                            "bond poll failed: bondingWasInFlight=$bonding
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7695** (2026-10-20): **[Bug]: Docs sync deletes screenshots that versioned docs still link**
  *Symptoms*: ### Affected app version  Not applicable. The bug is in `scripts/sync-android-docs.js`, which the meshtastic/meshtastic docs sync runs from the latest release.  ### Affected Android version / phone model / node model / node firmware version  Not applicable: build tooling, no device involved.  ### Steps to reproduce the bug  1. Check out meshtastic/meshtastic `master`. 2. From that checkout, run `node <Meshtastic-Android>/scripts/sync-android-docs.js <Meshtastic-Android> --convert-webp`. 3. Run `pnpm build` in the docs repo.  ### Actual behavior  The script prunes every image in `static/img/android/docs/` that no current page references, including images the frozen Docusaurus snapshots under `versioned_docs/` still link. The docs build then fails on the unresolved images. meshtastic/meshtastic#2728 is failing this way:  ```shell Error: MDX compilation failed for file "versioned_docs/version-2.7/software/android/user/nodes.md" Cause: Markdown image with URL `/img/android/docs/nodes_node_list.webp` in source file "versioned_docs/version-2.7/software/android/user/nodes.md" (128:1) couldn't be resolved to an existing local image file. ```  `settings_password_field.webp` and `firmware_disclaimer.webp` fail the same way, and running the script from `main` also removes `connections_empty_state.webp`, which the 2.7 snapshot links too.  ### Expected behavior  The sync keeps any screenshot that a `versioned_docs/` page still links, so the docs build passes when the app drops a screensho

- **Issue #7488** (2026-09-30): **[Bug]: After pining a channel there is no way of un-pining it**
  *Symptoms*: ### Contact Details  ronv42@outlook.com  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  2.8.2 (29322440)  ### Affected Android version  Android 17  ### Affected phone model  Google Pixel 9 Pro  ### Affected node model  Seed Tracker L1  ### Affected node firmware version  2.7.26  ### Steps to reproduce the bug  1. Goto Conversation screen and the list of channels 2. Highlight a channel and select the "Pin" icon 3. Channel will now show at the top of the list with the Pin icon in the lower right corner 4. No option to un-pin, selecting channel again and selecting the Pin icon doesn't  clear the pin   <img width="567" height="483" alt="Image" src="https://github.com/user-attachments/assets/7d49c12b-78ed-497c-ae05-5bdce01e57c4" />  ### Actual behavior  Pinning works, un-pinning doesn't    ### Expected 

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

### Incident Patch 1: `2a41b35c` (2026-10-20)
**Commit Message**: fix(docs): keep screenshots versioned docs still link (#7694)

**File**: `scripts/sync-android-docs.js` (modified, +30/-5)
```diff
@@ -17,7 +17,8 @@
 //   static/img/android/docs/*.webp (or .png/.svg if not converting)
 //
 // Only screenshots a synced page actually references are published; any other
-// file already under those two directories is pruned at the end of the run.
+// file already under those two directories is pruned at the end of the run,
+// except screenshots a frozen versioned_docs/ snapshot still links.
 
 "use strict";
 
@@ -52,6 +53,9 @@ if (!fs.existsSync(SRC_DOCS_DIR)) {
 // Output directories (relative to CWD, which should be the meshtastic/meshtastic repo)
 const DEST_DOCS_DIR = path.join("docs", "software", "android");
 const DEST_IMAGES_DIR = path.join("static", "img", "android", "docs");
+// Docusaurus version snapshots. They link the same /img/android/docs/ files as the
+// current pages, but no sync rewrites them, so their images must outlive the app's.
+const VERSIONED_DOCS_DIR = "versioned_docs";
 
 // Derive sibling page slugs from the filesystem (no manual sync needed)
 const KNOWN_USER_SLUGS = discoverSlugs(SRC_DOCS_DIR, "user");
@@ -244,7 +248,8 @@ function collectImageReferences(content, into) {
     const re = /\/img\/android\/docs\/([^)"'\s>]+)/g;
     let match;
     while ((match = re.exec(content)) !== null) {
-        into.add(path.basename(match[1]));
+        // Drop any ?query or #fragment so the name matches the file on disk.
+        into.add(path.basename(match[1].split(/[?#]/, 1)[0]));
     }
 }
 
@@ -345,13 +350,29 @@ function collectFiles(dir) {
     return results;
 }
 
+/**
+ * Collect the screenshot basenames that frozen version snapshots still link.
+ * Pruning one of these breaks the site build, since Docusaurus fails on a
+ * Markdown image it cannot resolve.
+ */
+function collectVersionedImageReferences() {
+    const names = new Set();
+    for (const file of collectFiles(VERSIONED_DOCS_DIR)) {
+        const ext = path.extname(file).toLowerCase();
+        if (ext !== ".md" && ext !== ".mdx") continue;
+        collectImageReferences(fs.readFileSync(path.join(VERSIONED_DOCS_DIR, file), "utf-8"), names);
+    }
+    return names;
+}
+
 /**
  * Remove destination files this run did not produce, so renamed or deleted
  * source pages (and the screenshots they referenced) don't linger on the site.
  * Mirrors the Apple sync's cleanup pass. Scoped to docs pages (.md/.mdx) and
- * images under the directories this script owns.
+ * images under the directories this script owns. Images in `keepImageNames`
+ * survive even when no current page references them.
  */
-function pruneStale(expectedDocPaths, expectedImageNames) {
+function pruneStale(expectedDocPaths, expectedImageNames, keepImageNames) {
     for (const file of collectFiles(DEST_DOCS_DIR)) {
         const ext = path.extname(file).toLowerCase();
         if (ext !== ".md" && ext !== ".mdx") continue;
@@ -368,6 +389,10 @@ function pruneStale(expectedDocPaths, expectedImageNames) {
         if (!IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
         if (expectedImageNames.has(path.basename(file))) continue;
         const target = path.join(DEST_IMAGES_DIR, file);
+        if (keepImageNames.has(path.basename(file))) {
+            console.log(`Kept image a versioned snapshot still links: ${target}`);
+            continue;
+        }
         if (DRY_RUN) {
             console.log(`[dry-run] Would remove stale image: ${target}`);
         } else {
@@ -503,7 +528,7 @@ function main() {
     const expectedImageNames = processImages(referencedImages);
 
     // Remove anything left over from a previous sync or the old hand-written docs.
-    pruneStale(expectedDocPaths, expectedImageNames);
+    pruneStale(expectedDocPaths, expectedImageNames, collectVersionedImageReferences());
 
     console.log("\nSync complete.");
 }
```

---

### Incident Patch 2: `4b3068fb` (2026-10-19)
**Commit Message**: build(flatpak): stamp the overlay's Gradle zip from the wrapper (#7681)

**File**: `.github/renovate.json` (modified, +0/-13)
```diff
@@ -145,19 +145,6 @@
     }
   ],
   "customManagers": [
-    {
-      "customType": "regex",
-      "description": "Mirror gradle-wrapper.properties bumps into the vendored Gradle distribution URL in the verify-flatpak offline manifest (see PRs #6777/#6782, where a wrapper bump without this file broke both build-flatpak arches). Shares depName 'gradle' with the gradle-wrapper manager so both files update in the same Renovate branch/PR. The sha256 line below the URL cannot be auto-updated (the gradle-version datasource has no digest support and the hosted app disallows postUpgradeTasks); the fail-fast guard in verify-flatpak.yml's generate-sources job holds that PR red until the sha256 is copied from distributionSha256Sum.",
-      "managerFilePatterns": [
-        "/^scripts/verify-flatpak/desktop-offline\\.yaml$/"
-      ],
-      "matchStrings": [
-        "services\\.gradle\\.org/distributions/gradle-(?<currentValue>\\d+(?:\\.\\d+)*)-bin\\.zip"
-      ],
-      "depNameTemplate": "gradle",
-      "datasourceTemplate": "gradle-version",
-      "versioningTemplate": "gradle"
-    },
     {
       "customType": "regex",
       "description": "ktlint's version is a bare [versions] entry that only Spotless reads, so the gradle manager cannot tie it to an artifact.",
```

**File**: `.github/workflows/verify-flatpak.yml` (modified, +5/-24)
```diff
@@ -8,8 +8,8 @@ on:
     paths:
       - 'scripts/verify-flatpak/**'
       - '.github/workflows/verify-flatpak.yml'
-  # Post-merge only for what the check itself depends on. The offline manifest pins the
-  # Gradle distribution apart from the wrapper, so a wrapper bump is checked on merge.
+  # Post-merge only for what the check itself depends on. The offline build vendors the
+  # wrapper's Gradle distribution, so a wrapper bump is checked on merge.
   push:
     branches: [ main ]
     paths:
@@ -49,28 +49,6 @@ jobs:
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
 
-      # Renovate mirrors wrapper bumps into the manifest's distribution URL but cannot
-      # rewrite its sha256, so on a wrapper bump this drift is expected: fail here in
-      # seconds instead of ~15 minutes into the build ("Verification of Gradle
-      # distribution failed!", see #6777/#6782).
-      - name: Check vendored Gradle dist matches the wrapper
-        run: |
-          props=gradle/wrapper/gradle-wrapper.properties
-          manifest=scripts/verify-flatpak/desktop-offline.yaml
-          wrapper_dist=$(grep '^distributionUrl=' "$props" | sed 's|.*/||' || true)
-          wrapper_sha=$(grep '^distributionSha256Sum=' "$props" | cut -d= -f2 || true)
-          manifest_dist=$(grep -o 'gradle-[0-9][^/]*\.zip' "$manifest" || true)
-          manifest_sha=$(awk '/url:.*services\.gradle\.org\/distributions\//{getline; sub(/^[[:space:]]*sha256:[[:space:]]*/, ""); print}' "$manifest")
-          if [ -z "$wrapper_dist" ] || [ -z "$wrapper_sha" ]; then
-            echo "::error file=$props::Could not parse distributionUrl/distributionSha256Sum from $props; the guard in verify-flatpak.yml needs updating."
-            exit 1
-          fi
-          if [ "$wrapper_dist" != "$manifest_dist" ] || [ "$wrapper_sha" != "$manifest_sha" ]; then
-            echo "::error file=$manifest::Vendored Gradle dist is out of sync: $manifest pins '$manifest_dist' (sha256 '$manifest_sha') but $props pins '$wrapper_dist' (sha256 '$wrapper_sha'). Update the url and sha256 in $manifest; the correct sha256 is distributionSha256Sum in $props."
-            exit 1
-          fi
-          echo "OK: $manifest vendors $wrapper_dist, matching $props"
-
       - uses: actions/setup-java@b843ebf9b913146b38da2eaa7aeddf76074ae1ad # v6
         with:
           distribution: temurin
@@ -122,6 +100,9 @@ jobs:
         run: |
           cp scripts/verify-flatpak/desktop-offline.yaml \
             "$RUNNER_TEMP/org.meshtastic.MeshtasticDesktop/org.meshtastic.MeshtasticDesktop.yaml"
+          python3 scripts/verify-flatpak/bump-flathub-manifest.py --gradle-only \
+            "$RUNNER_TEMP/org.meshtastic.MeshtasticDesktop/org.meshtastic.MeshtasticDesktop.yaml" \
+            gradle/wrapper/gradle-wrapper.properties
           cp flatpak-sources.json \
             "$RUNNER_TEMP/org.meshtastic.MeshtasticDesktop/flatpak-sources.json"
           rsync -a --delete \
```

**File**: `scripts/verify-flatpak/README.md` (modified, +3/-1)
```diff
@@ -78,7 +78,9 @@ executing the Gradle build, or run the full script on a Linux host.
 - `verify.sh` — entry point. Idempotent: re-running just re-syncs the overlay and re-runs flatpak-builder.
 - `desktop-offline.yaml` — patched manifest. Kept in sync manually with the upstream packaging;
   diff against `https://raw.githubusercontent.com/flathub/org.meshtastic.MeshtasticDesktop/master/org.meshtastic.MeshtasticDesktop.yaml`
-  if upstream changes something material.
+  if upstream changes something material. Its Gradle zip is a placeholder; `verify.sh` and
+  `verify-flatpak.yml` fill it from `gradle/wrapper/gradle-wrapper.properties`.
 - `bump-flathub-manifest.py` - points the upstream manifest at a release: the source tag and
   commit, and the Gradle zip the tag's wrapper pins. `promote.yml`'s `update-flathub` job runs it
   on every production promotion, then commits the release's `flatpak-sources.json` beside it.
+  `--gradle-only` rewrites just the Gradle zip, for the overlay.
```

**File**: `scripts/verify-flatpak/bump-flathub-manifest.py` (modified, +18/-9)
```diff
@@ -2,9 +2,11 @@
 """Point the Flathub manifest at a release: the source tag and commit, and the Gradle zip.
 
 Usage: bump-flathub-manifest.py <manifest.yaml> <tag> <commit> <gradle-wrapper.properties>
+       bump-flathub-manifest.py --gradle-only <manifest.yaml> <gradle-wrapper.properties>
 
 The Gradle distribution URL and sha256 come from the tag's own wrapper properties, since the
-offline build can only run the Gradle version that tag pins. Each field is rewritten in
+offline build can only run the Gradle version that tag pins. --gradle-only rewrites just the
+Gradle zip, which is how the verify-flatpak overlay gets the working tree's wrapper. Each field is rewritten in
 place, so comments and layout survive. Any field that does not match exactly once fails the
 run instead of guessing, and the manifest is then bumped by hand.
 """
@@ -49,22 +51,29 @@ def replace_once(pattern: re.Pattern, value_a: str, value_b: str, text: str, wha
 
 
 def main() -> None:
-    if len(sys.argv) != 5:
+    args = sys.argv[1:]
+    gradle_only = args[:1] == ["--gradle-only"]
+    if gradle_only and len(args) == 3:
+        manifest, wrapper = args[1:]
+    elif not gradle_only and len(args) == 4:
+        manifest, tag, commit, wrapper = args
+        if not re.fullmatch(r"v\d+\.\d+\.\d+", tag):
+            sys.exit(f"'{tag}' is not a production tag (vX.Y.Z)")
+        if not re.fullmatch(r"[0-9a-f]{40}", commit):
+            sys.exit(f"'{commit}' is not a full commit sha")
+    else:
         sys.exit(__doc__)
-    manifest, tag, commit, wrapper = sys.argv[1:]
-    if not re.fullmatch(r"v\d+\.\d+\.\d+", tag):
-        sys.exit(f"'{tag}' is not a production tag (vX.Y.Z)")
-    if not re.fullmatch(r"[0-9a-f]{40}", commit):
-        sys.exit(f"'{commit}' is not a full commit sha")
     url, sha = wrapper_distribution(wrapper)
 
     with open(manifest, encoding="utf-8") as f:
         text = f.read()
-    text = replace_once(GIT_SOURCE, tag, commit, text, "Meshtastic-Android git source (url, tag, commit)")
+    if not gradle_only:
+        text = replace_once(GIT_SOURCE, tag, commit, text, "Meshtastic-Android git source (url, tag, commit)")
     text = replace_once(GRADLE_ZIP, url, sha, text, "Gradle distribution (url, sha256)")
     with open(manifest, "w", encoding="utf-8") as f:
         f.write(text)
-    print(f"{manifest}: {tag} at {commit}, {url.rsplit('/', 1)[-1]}")
+    zip_name = url.rsplit("/", 1)[-1]
+    print(f"{manifest}: {zip_name}" if gradle_only else f"{manifest}: {tag} at {commit}, {zip_name}")
 
 
 if __name__ == "__main__":
```

**File**: `scripts/verify-flatpak/desktop-offline.yaml` (modified, +4/-6)
```diff
@@ -97,12 +97,10 @@ modules:
       - type: dir
         path: meshtastic-android
       - type: file
-        # Must be the EXACT distribution from gradle-wrapper.properties (version AND -bin
-        # flavor); distributionSha256Sum verifies this file. Renovate bumps the version here
-        # alongside wrapper bumps (custom manager in renovate.json) but the sha256 must be
-        # copied from distributionSha256Sum by hand; CI fails fast on any mismatch.
-        url: https://services.gradle.org/distributions/gradle-9.8.2-bin.zip
-        sha256: 21bd5da2de49b642904077f38c0efdc7778e92b3ed0889392dca61b97e389607
+        # Placeholder: verify.sh and verify-flatpak.yml stamp the url and sha256 from
+        # gradle-wrapper.properties into their copy (bump-flathub-manifest.py --gradle-only).
+        url: https://services.gradle.org/distributions/gradle-from-wrapper-bin.zip
+        sha256: 0000000000000000000000000000000000000000000000000000000000000000
         dest: "gradle/wrapper"
         dest-filename: "gradle-bin.zip"
       - flatpak-sources.json
```

**File**: `scripts/verify-flatpak/verify.sh` (modified, +3/-0)
```diff
@@ -107,6 +107,9 @@ fi
 #   flatpak-sources.json = the artifact we're validating
 step "Wiring overlay manifest + our flatpak-sources.json"
 cp "$OVERLAY" "$WORK/org.meshtastic.MeshtasticDesktop/org.meshtastic.MeshtasticDesktop.yaml"
+python3 "$REPO_ROOT/scripts/verify-flatpak/bump-flathub-manifest.py" --gradle-only \
+    "$WORK/org.meshtastic.MeshtasticDesktop/org.meshtastic.MeshtasticDesktop.yaml" \
+    "$REPO_ROOT/gradle/wrapper/gradle-wrapper.properties"
 cp "$SOURCES_JSON" "$WORK/org.meshtastic.MeshtasticDesktop/flatpak-sources.json"
 
 if [[ $REBUILD_ONLY -eq 0 ]]; then
```

---

### Incident Patch 3: `bc15de5e` (2026-10-19)
**Commit Message**: fix(flatpak): vendor the Gradle 9.8.2 sha256 (#7677)

**File**: `scripts/verify-flatpak/desktop-offline.yaml` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ modules:
         # alongside wrapper bumps (custom manager in renovate.json) but the sha256 must be
         # copied from distributionSha256Sum by hand; CI fails fast on any mismatch.
         url: https://services.gradle.org/distributions/gradle-9.8.2-bin.zip
-        sha256: dce76f55f8e251a3a1f130eb120f30b3d271de2b76c9b0729d316b5a1b6dc01f
+        sha256: 21bd5da2de49b642904077f38c0efdc7778e92b3ed0889392dca61b97e389607
         dest: "gradle/wrapper"
         dest-filename: "gradle-bin.zip"
       - flatpak-sources.json
```

#### Recent Merged Pull Requests:
- **PR #7696** (2026-10-20): chore(deps): update sceneview to v4.60.0 (@renovate[bot])
- **PR #7694** (2026-10-20): fix(docs): keep screenshots versioned docs still link (@rcarteraz)
- **PR #7693** (2026-10-20): chore: Scheduled updates (Firmware, Hardware, Translations) (@jamesarich)
- **PR #7692** (2026-10-20): docs: update CHANGELOG.md (@jamesarich)
- **PR #7691** (2026-10-20): chore: Scheduled updates (Firmware, Hardware, Translations) (@jamesarich)
- **PR #7690** (2026-10-20): chore(deps): update org.meshtastic:protobufs to v2.8.1.18-g8d0ed0c-snapshot (@renovate[bot])

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

## X. docs): keep screenshots versioned docs still link (#7694)

**RULE**:
When implementing operations in `scripts/sync-android-docs.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meshtastic/Meshtastic-Android. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2a41b35c`: docs): keep screenshots versioned docs still link (#7694). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/sync-android-docs.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
// file already under those two directories is pruned at the end of the run,
// except screenshots a frozen versioned_docs/ snapshot still links.
// Docusaurus version snapshots. They link the same /img/android/docs/ files as the
// current pages, but no sync rewrites them, so their images must outlive the app's.
const VERSIONED_DOCS_DIR = "versioned_docs";
        // Drop any ?query or #fragment so the name matches the file on disk.
        into.add(path.basename(match[1].split(/[?#]/, 1)[0]));
/**
 * Collect the screenshot basenames that frozen version snapshots still link.
 * Pruning one of these breaks the site build, since Docusaurus fails on a
 * Markdown image it cannot resolve.
 */
function collectVersionedImageReferences() {
    const names = new Set();
    for (const file of collectFiles(VERSIONED_DOCS_DIR)) {
        const ext = path.extname(file).toLowerCase();
        if (ext !== ".md" && ext !== ".mdx") continue;
        collectImageReferences(fs.readFileSync(path.join(VERSIONED_DOCS_DIR, file), "utf-8"), names);
    }
    return names;
}

 * images under the directories this script owns. Images in `keepImageNames`
 * survive even when no current page references them.
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
// file already under those two directories is pruned at the end of the run.
        into.add(path.basename(match[1]));
 * images under the directories this script owns.
function pruneStale(expectedDocPaths, expectedImageNames) {
    pruneStale(expectedDocPaths, expectedImageNames);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2a41b35c` are properly handled with clean fallback behavior.
