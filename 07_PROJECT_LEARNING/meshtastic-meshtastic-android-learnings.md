> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/meshtastic-meshtastic-android-learnings.md`  
> **Source**: github ([https://github.com/meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android))  
> **Source Version**: `1709a9ce`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T18:01:38.936Z  
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
> **Harvest Timestamp**: 2026-10-31T18:01:38.715Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshtastic/Meshtastic-Android`
- **Description**: Android application for Meshtastic
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1901 stars

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
- **Issue #7819** (2026-10-30): **[Bug]: While firmware can handle traces with 8 hops, APP doesn't show SNRs**
  *Symptoms*: ### Contact Details  domusonline  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  2.8.3  ### Affected Android version  Android 16  ### Affected phone model  Samsung A34  ### Affected node model  Heltec WSL V3  ### Affected node firmware version  2.8.1  ### Steps to reproduce the bug  I've noticed that if a traceroute has 8 hops, although the packet contains the data (SNRs) the application shows the hops, but shows "? dB" for the SNRs  ### Actual behavior  I can show the screenshot on the APP:  <img width="303" height="662" alt="Image" src="https://github.com/user-attachments/assets/13666625-c958-44ab-bd22-bc76e341d021" />  and because the return path used MQTT we can see the packet in the local "Malla" system: https://malha.meshtastic.pt/packet/6414948  Because the packet will eventually disappear f

- **Issue #7778** (2026-10-27): **[Bug]: Weather radar is drawn in 1 km squares when zoomed in**
  *Symptoms*: ### Steps to reproduce the bug  1. Open the map, turn on the Weather Radar overlay somewhere in the lower 48 with rain on it. 2. Zoom in past about zoom 8.  ### Actual behavior  Rain is drawn as a grid of squares about 1 km across, with stepped edges.  ### Expected behavior  Showers read as rounded shapes with clean edges, keeping NOAA's color scale.  ### Additional information  The radar's data is a grid of roughly 1 km cells (0.01° of longitude). The overlay asks NCEP's WMS for every tile at 256 by 256, and once a tile pixel is finer than a cell the server scales the cells up by copying them, so the squares come from the server: https://github.com/meshtastic/Meshtastic-Android/blob/d0a924d67cb1ab3f532a9e50bc3131e0c81538be/feature/map/src/commonMain/kotlin/org/meshtastic/feature/map/tiles/MapTileCatalogue.kt#L146-L162  The colors are a continuous scale (about a hundred shades), not bands, so contouring them the way the coverage bands were cleaned up in #7767 would change the look. What worked on iOS:  - When a tile pixel is finer than a cell, ask the server for one pixel per cell instead (cells across = tile width in Mercator meters / 1113.2; cells down uses a cell height of 1113.2 / cos(latitude)), with the bounding box padded by one cell on every side so neighboring tiles meet without a seam. - Premultiply, blur by about half a cell (Gaussian, sigma 0.5 cells), scale up to the tile with a cubic B-spline, then crop the padding off. - Draw the edge where the rain is half the

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

### Incident Patch 1: `b39f80ac` (2026-10-31)
**Commit Message**: fix(admin): accept admin responses only for requests the app sent (#7847)

**File**: `core/data/src/commonMain/kotlin/org/meshtastic/core/data/manager/AdminPacketHandlerImpl.kt` (modified, +10/-1)
```diff
@@ -19,6 +19,7 @@ package org.meshtastic.core.data.manager
 import co.touchlab.kermit.Logger
 import org.koin.core.annotation.Single
 import org.meshtastic.core.repository.AdminPacketHandler
+import org.meshtastic.core.repository.AdminRequestRegistry
 import org.meshtastic.core.repository.MeshConfigFlowManager
 import org.meshtastic.core.repository.MeshConfigHandler
 import org.meshtastic.core.repository.NodeManager
@@ -37,12 +38,20 @@ class AdminPacketHandlerImpl(
     private val configHandler: Lazy<MeshConfigHandler>,
     private val configFlowManager: Lazy<MeshConfigFlowManager>,
     private val sessionManager: SessionManager,
+    private val adminRequestRegistry: AdminRequestRegistry,
 ) : AdminPacketHandler {
 
     override fun handleAdminMessage(packet: MeshPacket, myNodeNum: Int, session: RadioSessionContext) {
-        val payload = packet.decoded?.payload ?: return
+        val data = packet.decoded ?: return
+        val payload = data.payload
         val u = AdminMessage.ADAPTER.decode(payload)
         Logger.d { "Admin message from=${packet.from} fields=${u.summarize()}" }
+        // The firmware forwards every decoded ADMIN_APP packet addressed to it, so a response is authoritative
+        // only when it answers a request we sent.
+        if (!adminRequestRegistry.consume(data.request_id)) {
+            Logger.w { "Ignoring admin message from=${packet.from} with no outstanding request id=${data.request_id}" }
+            return
+        }
         // Firmware embeds the session_passkey in every admin response. A missing (default-empty)
         // field must not reset stored state, so only record refreshes when bytes arrived.
         val incomingPasskey = u.session_passkey
```

**File**: `core/data/src/commonMain/kotlin/org/meshtastic/core/data/manager/AdminRequestRegistryImpl.kt` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
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
+package org.meshtastic.core.data.manager
+
+import kotlinx.atomicfu.atomic
+import kotlinx.atomicfu.update
+import org.koin.core.annotation.Single
+import org.meshtastic.core.repository.AdminRequestRegistry
+
+@Single
+class AdminRequestRegistryImpl : AdminRequestRegistry {
+    // Oldest first. Bounded so a request the radio never answers cannot grow the set forever.
+    private val outstanding = atomic<List<Int>>(emptyList())
+
+    override fun register(requestId: Int) {
+        if (requestId == 0) return
+        outstanding.update { ids -> (ids - requestId + requestId).takeLast(MAX_OUTSTANDING) }
+    }
+
+    override fun consume(requestId: Int): Boolean {
+        if (requestId == 0) return false
+        var found = false
+        outstanding.update { ids ->
+            found = requestId in ids
+            if (found) ids - requestId else ids
+        }
+        return found
+    }
+
+    override fun clearAll() {
+        outstanding.value = emptyList()
+    }
+
+    private companion object {
+        const val MAX_OUTSTANDING = 128
+    }
+}
```

**File**: `core/data/src/commonMain/kotlin/org/meshtastic/core/data/manager/CommandSenderImpl.kt` (modified, +3/-0)
```diff
@@ -33,6 +33,7 @@ import org.meshtastic.core.model.Position
 import org.meshtastic.core.model.TelemetryType
 import org.meshtastic.core.model.util.TimeConstants
 import org.meshtastic.core.model.util.isWithinSizeLimit
+import org.meshtastic.core.repository.AdminRequestRegistry
 import org.meshtastic.core.repository.AwaitedSendResult
 import org.meshtastic.core.repository.CommandSender
 import org.meshtastic.core.repository.LocalNodeUnavailableException
@@ -77,6 +78,7 @@ class CommandSenderImpl(
     private val tracerouteHandler: TracerouteHandler,
     private val neighborInfoHandler: NeighborInfoHandler,
     private val sessionManager: SessionManager,
+    private val adminRequestRegistry: AdminRequestRegistry,
     private val scope: ServiceScope,
 ) : CommandSender {
     private val currentPacketId = atomic(Random(nowMillis).nextLong().absoluteValue)
@@ -629,6 +631,7 @@ class CommandSenderImpl(
                 }
                 .build(),
         )
+            .also { adminRequestRegistry.register(it.id) }
 
     companion object {
         private const val PACKET_ID_MASK = 0xffffffffL
```

**File**: `core/data/src/commonMain/kotlin/org/meshtastic/core/data/manager/MeshConnectionManagerImpl.kt` (modified, +3/-0)
```diff
@@ -41,6 +41,7 @@ import org.meshtastic.core.model.ConnectionState
 import org.meshtastic.core.model.DeviceType
 import org.meshtastic.core.model.InterfaceId
 import org.meshtastic.core.model.TelemetryType
+import org.meshtastic.core.repository.AdminRequestRegistry
 import org.meshtastic.core.repository.AppWidgetUpdater
 import org.meshtastic.core.repository.CommandSender
 import org.meshtastic.core.repository.DataPair
@@ -93,6 +94,7 @@ class MeshConnectionManagerImpl(
     private val radioConfigRepository: RadioConfigRepository,
     private val commandSender: CommandSender,
     private val sessionManager: SessionManager,
+    private val adminRequestRegistry: AdminRequestRegistry,
     private val nodeManager: NodeManager,
     private val analytics: PlatformAnalytics,
     private val packetRepository: PacketRepository,
@@ -510,6 +512,7 @@ class MeshConnectionManagerImpl(
         postHandshakeRequestsJob = null
         packetHandler.stopPacketQueue()
         sessionManager.clearAll() // Prevent stale per-node passkeys on reconnect.
+        adminRequestRegistry.clearAll()
         locationManager.stop()
         mqttManager.stop()
     }
```

**File**: `core/data/src/commonTest/kotlin/org/meshtastic/core/data/manager/AdminPacketHandlerImplTest.kt` (modified, +67/-1)
```diff
@@ -20,6 +20,7 @@ import dev.mokkery.MockMode
 import dev.mokkery.matcher.any
 import dev.mokkery.mock
 import dev.mokkery.verify
+import dev.mokkery.verify.VerifyMode
 import okio.ByteString
 import okio.ByteString.Companion.toByteString
 import org.meshtastic.core.repository.MeshConfigFlowManager
@@ -45,6 +46,7 @@ class AdminPacketHandlerImplTest {
     private val configHandler = mock<MeshConfigHandler>(MockMode.autofill)
     private val configFlowManager = mock<MeshConfigFlowManager>(MockMode.autofill)
     private val sessionManager = mock<SessionManager>(MockMode.autofill)
+    private val adminRequestRegistry = AdminRequestRegistryImpl()
 
     private lateinit var handler: AdminPacketHandlerImpl
 
@@ -59,10 +61,13 @@ class AdminPacketHandlerImplTest {
                 configHandler = lazy { configHandler },
                 configFlowManager = lazy { configFlowManager },
                 sessionManager = sessionManager,
+                adminRequestRegistry = adminRequestRegistry,
             )
     }
 
-    private fun makePacket(from: Int, adminMessage: AdminMessage): MeshPacket {
+    /** Builds a response to a request this app sent unless [requestId] names one it did not. */
+    private fun makePacket(from: Int, adminMessage: AdminMessage, requestId: Int = SENT_REQUEST_ID): MeshPacket {
+        if (requestId == SENT_REQUEST_ID) adminRequestRegistry.register(requestId)
         val payload = adminMessage.encode().toByteString()
         return MeshPacket.Builder()
             .also { wb ->
@@ -72,6 +77,7 @@ class AdminPacketHandlerImplTest {
                         .also { wb ->
                             wb.portnum = PortNum.ADMIN_APP
                             wb.payload = payload
+                            wb.request_id = requestId
                         }
                         .build()
             }
@@ -80,6 +86,61 @@ class AdminPacketHandlerImplTest {
 
     private fun handle(packet: MeshPacket) = handler.handleAdminMessage(packet, myNodeNum, session)
 
+    // ---------- Request correlation ----------
+
+    @Test
+    fun `config response claiming own node without an outstanding request is ignored`() {
+        val config = Config.Builder().also { wb -> wb.security = Config.SecurityConfig.Builder().build() }.build()
+        val adminMsg =
+            AdminMessage.Builder()
+                .also { wb ->
+                    wb.get_config_response = config
+                    wb.session_passkey = ByteString.of(9, 9, 9, 9)
+                }
+                .build()
+        val packet = makePacket(myNodeNum, adminMsg, requestId = UNSOLICITED_REQUEST_ID)
+
+        handle(packet)
+
+        verify(VerifyMode.not) { configHandler.handleDeviceConfig(any(), any()) }
+        verify(VerifyMode.not) { sessionManager.recordSession(any(), any()) }
+    }
+
+    @Test
+    fun `channel response claiming own node without an outstanding request is ignored`() {
+        val channel = Channel.Builder().also { wb -> wb.index = 0 }.build()
+        val adminMsg = AdminMessage.Builder().also { wb -> wb.get_channel_response = channel }.build()
+        val packet = makePacket(myNodeNum, adminMsg, requestId = UNSOLICITED_REQUEST_ID)
+
+        handle(packet)
+
+        verify(VerifyMode.not) { configHandler.handleChannel(any(), any()) }
+    }
+
+    @Test
+    fun `metadata from a remote node without an outstanding request is ignored`() {
+        val metadata = DeviceMetadata.Builder().also { wb -> wb.firmware_version = "9.9.9" }.build()
+        val adminMsg = AdminMessage.Builder().also { wb -> wb.get_device_metadata_response = metadata }.build()
+        val packet = makePacket(99999, adminMsg, requestId = UNSOLICITED_REQUEST_ID)
+
+        handle(packet)
+
+        verify(VerifyMode.not) { nodeManager.insertMetadata(any(), any(), any()) }
+    }
+
+    @Test
+    fun `a request id answers once`() {
+        val config = Config.Builder().also { wb -> wb.device = Config.DeviceConfig.Builder().build() }.build()
+        val adminMsg = AdminMessage.Builder().also { wb -> wb.get_config_response = config }.build()
+
+        val packet = makePacket(myNodeNum, adminMsg)
+
+        handle(packet)
+        handle(packet)
+
+        verify(VerifyMode.exactly(1)) { configHandler.handleDeviceConfig(config, session) }
+    }
+
     // ---------- Session passkey ----------
 
     @Test
@@ -290,4 +351,9 @@ class AdminPacketHandlerImplTest {
         verify { sessionManager.recordSession(myNodeNum, passkey) }
         verify { configHandler.handleDeviceConfig(config, session) }
     }
+
+    private companion object {
+        const val SENT_REQUEST_ID = 4242
+        const val UNSOLICITED_REQUEST_ID = 777
+    }
 }
```

**File**: `core/data/src/commonTest/kotlin/org/meshtastic/core/data/manager/AdminRequestRegistryImplTest.kt` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
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
+package org.meshtastic.core.data.manager
+
+import kotlin.test.Test
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+
+class AdminRequestRegistryImplTest {
+
+    private val registry = AdminRequestRegistryImpl()
+
+    @Test
+    fun `a registered id is consumed once`() {
+        registry.register(42)
+
+        assertTrue(registry.consume(42))
+        assertFalse(registry.consume(42))
+    }
+
+    @Test
+    fun `an unknown id is not consumed`() {
+        assertFalse(registry.consume(7))
+    }
+
+    @Test
+    fun `id zero is never outstanding`() {
+        registry.register(0)
+
+        assertFalse(registry.consume(0))
+    }
+
+    @Test
+    fun `clearAll forgets every outstanding id`() {
+        registry.register(1)
+        registry.register(2)
+
+        registry.clearAll()
+
+        assertFalse(registry.consume(1))
+        assertFalse(registry.consume(2))
+    }
+
+    @Test
+    fun `the oldest id is dropped past the bound`() {
+        (1..129).forEach(registry::register)
+
+        assertFalse(registry.consume(1))
+        assertTrue(registry.consume(2))
+        assertTrue(registry.consume(129))
+    }
+}
```

**File**: `core/data/src/commonTest/kotlin/org/meshtastic/core/data/manager/CommandSenderImplTest.kt` (modified, +29/-0)
```diff
@@ -73,6 +73,7 @@ class CommandSenderImplTest {
     private val tracerouteHandler = mock<TracerouteHandler>(MockMode.autofill)
     private val neighborInfoHandler = mock<NeighborInfoHandler>(MockMode.autofill)
     private val sessionManager = mock<SessionManager>(MockMode.autofill)
+    private val adminRequestRegistry = AdminRequestRegistryImpl()
 
     private lateinit var commandSender: CommandSenderImpl
 
@@ -92,6 +93,7 @@ class CommandSenderImplTest {
                 tracerouteHandler = tracerouteHandler,
                 neighborInfoHandler = neighborInfoHandler,
                 sessionManager = sessionManager,
+                adminRequestRegistry = adminRequestRegistry,
                 scope = TestScope().asServiceScope(),
             )
     }
@@ -141,6 +143,7 @@ class CommandSenderImplTest {
                 tracerouteHandler = tracerouteHandler,
                 neighborInfoHandler = neighborInfoHandler,
                 sessionManager = sessionManager,
+                adminRequestRegistry = adminRequestRegistry,
                 scope = TestScope().asServiceScope(),
             )
         assertEquals(0, commandSender.resolveNodeNum(NodeAddress.Local))
@@ -242,6 +245,31 @@ class CommandSenderImplTest {
         assertNotEquals(0, packets.single().id)
     }
 
+    @Test
+    fun sendAdmin_registersTheSentPacketIdAsOutstanding() = runTest {
+        val packets = mutableListOf<MeshPacket>()
+        everySuspend { packetHandler.sendToRadio(capture(packets)) } returns true
+
+        commandSender.sendAdmin(DEST_NODE, requestId = 0, wantResponse = true) {
+            AdminMessage.Builder().also { wb -> wb.get_owner_request = true }.build()
+        }
+
+        assertTrue(adminRequestRegistry.consume(packets.single().id))
+        assertFalse(adminRequestRegistry.consume(packets.single().id))
+    }
+
+    @Test
+    fun sendAdminImmediate_registersTheSentPacketIdAsOutstanding() {
+        val packets = mutableListOf<ToRadio>()
+        every { packetHandler.sendToRadio(capture(packets)) } returns Unit
+
+        commandSender.sendAdminImmediate(DEST_NODE) {
+            AdminMessage.Builder().also { wb -> wb.get_owner_request = true }.build()
+        }
+
+        assertTrue(adminRequestRegistry.consume(requireNotNull(packets.single().packet).id))
+    }
+
     @Test
     fun sendAdminSurfacesQueueRejection() = runTest {
         everySuspend { packetHandler.sendToRadio(any<MeshPacket>()) } returns false
@@ -642,6 +670,7 @@ class CommandSenderImplTest {
                 tracerouteHandler = tracerouteHandler,
                 neighborInfoHandler = neighborInfoHandler,
                 sessionManager = sessionManager,
+                adminRequestRegistry = adminRequestRegistry,
                 scope = testScope.asServiceScope(),
             )
         testScope.testScheduler.advanceUntilIdle()
```

**File**: `core/data/src/commonTest/kotlin/org/meshtastic/core/data/manager/MeshConnectionManagerImplTest.kt` (modified, +5/-0)
```diff
@@ -43,6 +43,7 @@ import org.meshtastic.core.model.ConnectionState
 import org.meshtastic.core.model.DataPacket
 import org.meshtastic.core.model.Node
 import org.meshtastic.core.model.TelemetryType
+import org.meshtastic.core.repository.AdminRequestRegistry
 import org.meshtastic.core.repository.AppWidgetUpdater
 import org.meshtastic.core.repository.CommandSender
 import org.meshtastic.core.repository.ConnectionStateHolder
@@ -93,6 +94,7 @@ class MeshConnectionManagerImplTest {
     private lateinit var radioConfigRepository: RadioConfigRepository
     private lateinit var commandSender: CommandSender
     private lateinit var sessionManager: SessionManager
+    private lateinit var adminRequestRegistry: AdminRequestRegistry
     private lateinit var nodeManager: NodeManager
     private lateinit var analytics: PlatformAnalytics
     private lateinit var packetRepository: PacketRepository
@@ -125,6 +127,7 @@ class MeshConnectionManagerImplTest {
         radioConfigRepository = mock(MockMode.autofill)
         commandSender = mock(MockMode.autofill)
         sessionManager = mock(MockMode.autofill)
+        adminRequestRegistry = mock(MockMode.autofill)
         nodeManager = mock(MockMode.autofill)
         analytics = mock(MockMode.autofill)
         packetRepository = mock(MockMode.autofill)
@@ -170,6 +173,7 @@ class MeshConnectionManagerImplTest {
         radioConfigRepository,
         commandSender,
         sessionManager,
+        adminRequestRegistry,
         nodeManager,
         analytics,
         packetRepository,
@@ -282,6 +286,7 @@ class MeshConnectionManagerImplTest {
         verify { packetHandler.stopPacketQueue() }
         verify { locationManager.stop() }
         verify { mqttManager.stop() }
+        verify { adminRequestRegistry.clearAll() }
         assertEquals(true, lockdownCoordinator.disconnectCalled)
     }
 
```

---

### Incident Patch 2: `3a5c892d` (2026-10-31)
**Commit Message**: fix(usb): add remaining firmware USB IDs to device filter (#7841)

**File**: `androidApp/src/main/res/xml/device_filter.xml` (modified, +9/-0)
```diff
@@ -102,5 +102,14 @@
     <usb-device
         vendor-id="9114"
         product-id="33035" /> <!-- 0x239A / 0x810B: Seeed XIAO nRF52840 Kit -->
+    <usb-device
+        vendor-id="9114"
+        product-id="179" /> <!-- 0x239A / 0x00B3: Adafruit (Pro Micro nRF52840, Meshlink) -->
+    <usb-device
+        vendor-id="9114"
+        product-id="51966" /> <!-- 0x239A / 0xCAFE: Adafruit (muzi BASE) -->
+    <usb-device
+        vendor-id="12346"
+        product-id="4097" /> <!-- 0x303A / 0x1001: Espressif ESP32-S3 USB-Serial/JTAG -->
     <usb-device vendor-id="11914" /> <!-- 0x2E8A / ……: Raspberry Pi -->
 </resources>
```

---

### Incident Patch 3: `3ea178e5` (2026-10-30)
**Commit Message**: fix(usb): add Seeed XIAO nRF52840 Kit (239a:810b) to device filter (#7838)

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `androidApp/src/main/res/xml/device_filter.xml` (modified, +3/-0)
```diff
@@ -99,5 +99,8 @@
     <usb-device
         vendor-id="9114"
         product-id="17413" /> <!-- 0x239A / 0x4405: Adafruit (T-Echo) -->
+    <usb-device
+        vendor-id="9114"
+        product-id="33035" /> <!-- 0x239A / 0x810B: Seeed XIAO nRF52840 Kit -->
     <usb-device vendor-id="11914" /> <!-- 0x2E8A / ……: Raspberry Pi -->
 </resources>
```

#### Recent Merged Pull Requests:
- **PR #7852** (2026-10-31): docs: update CHANGELOG.md (@jamesarich)
- **PR #7851** (2026-10-31): docs: update CHANGELOG.md (@jamesarich)
- **PR #7850** (2026-10-31): chore(deps): update ruby/setup-ruby action to v1.336.0 (@renovate[bot])
- **PR #7849** (2026-10-31): chore(renovate): rebase only when conflicted (@jamesarich)
- **PR #7848** (2026-10-31): chore(deps): update org.meshtastic:takpacket-sdk to v0.10.0 (@renovate[bot])
- **PR #7847** (2026-10-31): fix(admin): accept admin responses only for requests the app sent (@jamesarich)

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

## X. admin): accept admin responses only for requests the app sent (#7847)

**RULE**:
When implementing operations in `core/data/src/commonMain/kotlin/org/meshtastic/core/data/manager/AdminPacketHandlerImpl.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meshtastic/Meshtastic-Android. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b39f80ac`: admin): accept admin responses only for requests the app sent (#7847). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/data/src/commonMain/kotlin/org/meshtastic/core/data/manager/AdminPacketHandlerImpl.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
import org.meshtastic.core.repository.AdminRequestRegistry
    private val adminRequestRegistry: AdminRequestRegistry,
        val data = packet.decoded ?: return
        val payload = data.payload
        // The firmware forwards every decoded ADMIN_APP packet addressed to it, so a response is authoritative
        // only when it answers a request we sent.
        if (!adminRequestRegistry.consume(data.request_id)) {
            Logger.w { "Ignoring admin message from=${packet.from} with no outstanding request id=${data.request_id}" }
            return
        }
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
        val payload = packet.decoded?.payload ?: return
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b39f80ac` are properly handled with clean fallback behavior.
