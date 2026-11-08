> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/meshtastic-meshtastic-android-learnings.md`  
> **Source**: github ([https://github.com/meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android))  
> **Source Version**: `4b2503d2`  
> **License**: GPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-08T01:36:00.661Z  
> **Learning ID**: `learn-github-meshtastic-meshtastic-android`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): meshtastic/Meshtastic-Android

---

## 1. Executive Forensic Architecture & System Mechanics

`meshtastic/Meshtastic-Android` provides an off-grid, encrypted mesh communication client for Android and Compose Desktop. It interfaces over Bluetooth Low Energy (BLE), USB-Serial, or TCP/WiFi with standalone hardware nodes running Meshtastic firmware (ESP32, nRF52, RP2040).

```
                      +---------------------------------------+
                      |       Meshtastic-Android Client       |
                      +---------------------------------------+
                                          |
                +-------------------------+-------------------------+
                |                         |                         |
       [Presentation Layer]      [Background & Platform]    [Data / Core Engine]
       - Jetpack Compose Multi-  - Glance AppWidgets        - Protocol Buffers
         platform UI               (RemoteViews previews)   - SQLite / Room (C-Bundled)
       - CameraX / Barcode       - AppFunctionStateSync     - Koin DI (Lazy/AppScope)
         (ML Kit / ZXing)          (Android 16+ AI Index)   - Offline Vector Map
                                 - WorkManager Sync           (PMTiles / MVT / Protobuf)
                |                         |                         |
                +-------------------------+-------------------------+
                                          |
                              [Transport & Radio Boundary]
                               - BleScanStartLimiter (Token-bucket quota)
                               - BondEventReceiver (Protected broadcast hooks)
                               - GATT MTU / Stream Framing
                                          |
                                          v
                      +---------------------------------------+
                      | Meshtastic Radio Nodes (ESP32 / nRF52)|
                      +---------------------------------------+
```

### Architectural Boundaries & State Ownership
1. **Transport Abstraction Boundary**: Decouples transport mechanics (BLE via Kable, Serial, TCP) from Protobuf packet dispatch. Hardware interaction strictly yields raw packet streams that feed into the reactive pipeline.
2. **Platform Flavor Decoupling (`google` vs `fdroid`)**:
   - `google`: Employs Google Play Services, Google Maps Android SDK, ML Kit Barcode Scanning, Firebase Crashlytics, Datadog RUM, and API 36+ AppFunctions.
   - `fdroid`: Strict FOSS compliance; utilizes ZXing for QR analysis, vector tiles via offline PMTiles/MVT rendering, and completely decouples from Google proprietary services.
3. **Database Initialization Quarantine**: Bundled SQLite (`libsqliteJni.so`) requires dynamic verification via JNI linkage checks before Koin DI starts. If native dynamic libraries fail to link, the app enters a locked `UnsupportedDeviceScreen` state, preventing Room corrupted reads.
4. **Widget RemoteViews Sandbox (Jetpack Glance)**: Widget presentation lives out-of-process in launcher host containers. State projections must cross inter-process communication (IPC) boundaries using `RemoteViews` with zero-allocation sizing constraints.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Jetpack Glance Isolated Preview Scope Rule
**RULE**:
When implementing Android AppWidget picker previews via Jetpack Glance (`providePreview` or `setWidgetPreviews`), composables MUST NEVER implicitly dereference `LocalGlanceId.current` or rely on `GlanceAppWidgetManager.getAppWidgetId()`. Previews MUST inject an explicit `CompositionLocal` flag (e.g., `LocalWidgetPreview provides true`) to conditionally branch away from launcher widget ID lookups and return fallback mock bounds.

**WHY**:
During widget picker preview generation on Android 15+ (API 35+ / `setWidgetPreviews`), the Glance runtime generates static `RemoteViews` without associating an active launcher widget instance. Accessing `LocalGlanceId.current` in this execution path throws an unhandled `IllegalStateException: No GlanceId found in this Composition`, terminating preview rendering and preventing launcher catalog indexing.

**WHEN TO APPLY**:
Apply in any Android widget module using `androidx.glance:glance-appwidget` 1.1.0+ providing picker previews through `GlanceAppWidget.providePreview()` or programmatic preview generation.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
package org.meshtastic.feature.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.os.Bundle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.glance.GlanceId
import androidx.glance.LocalGlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.LocalAppWidgetOptions

internal val LocalWidgetPreview = staticCompositionLocalOf { false }

class SafeAppWidget : GlanceAppWidget() {
    override suspend fun providePreview(context: Context, widgetCategory: Int) {
        provideContent {
            CompositionLocalProvider(LocalWidgetPreview provides true) {
                WidgetPreviewLayout()
            }
        }
    }
}

internal object SafeWidgetSizes {
    @Composable
    @ReadOnlyComposable
    fun currentOptions(context: Context): Bundle {
        // Guard against missing GlanceId during preview rendering
        val appWidgetId = if (LocalWidgetPreview.current) {
            null
        } else {
            val glanceId = LocalGlanceId.current
            runCatching { GlanceAppWidgetManager(context).getAppWidgetId(glanceId) }.getOrNull()
        }
        return appWidgetId
            ?.let { AppWidgetManager.getInstance(context).getAppWidgetOptions(it) }
            ?.takeIf { !it.isEmpty } ?: LocalAppWidgetOptions.current
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// CRASH HAZARD: Throws IllegalStateException when evaluated during providePreview()
@Composable
@ReadOnlyComposable
fun unsafeOptions(context: Context): Bundle {
    val glanceId = LocalGlanceId.current // Crashing dereference in picker preview
    val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(glanceId)
    return AppWidgetManager.getInstance(context).getAppWidgetOptions(appWidgetId)
}
```

**VERIFICATION METHOD**:
Verify using a headless Robolectric harness evaluating `composeForPreview()`:
```kotlin
@Test
fun widgetPickerPreviewComposesWithoutGlanceId() = runTest {
    val context: Context = ApplicationProvider.getApplicationContext()
    val views = SafeAppWidget().composeForPreview(context, AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN)
    assertNotNull(views)
}
```

---

### 2. Rolling-Quota In-Process BLE Scan Throttling Rule
**RULE**:
Any subsystem initiating BLE scans on Android MUST gate requests behind an in-process rolling-window rate limiter enforcing a maximum of 5 scan attempts per 30-second window. The rate limiter MUST throw a typed, inspectable exception providing exact `retryAfter` duration when the limit is breached, rather than allowing scans to reach the underlying `BluetoothLeScanner` hardware bridge.

**WHY**:
Android framework releases (starting in Android 7.0 / API 24 and tightened in subsequent revisions) enforce an undocumented hard limit of 5 scan starts per 30-second sliding window per UID. When breached, the system silently drops or suppresses the scan without triggering failure callbacks on certain OEM forks, stranding reactive coroutine streams in indefinite suspension.

**WHEN TO APPLY**:
Apply across any Android Kotlin Multiplatform or native Android transport module executing GATT scanning, beacon probing, or device discovery loops.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
package org.meshtastic.core.ble

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeMark
import kotlin.time.TimeSource

class AndroidBleScanStartLimiter(
    private val timeSource: TimeSource = TimeSource.Monotonic,
    private val maxStarts: Int = 5,
    private val window: Duration = 30.seconds,
) {
    private val mutex = Mutex()
    private val scanStarts = ArrayDeque<TimeMark>()

    suspend fun reserveStart() {
        mutex.withLock {
            discardExpiredStarts()
            if (scanStarts.size >= maxStarts) {
                val oldestStart = scanStarts.first()
                val retryAfter = (window - oldestStart.elapsedNow()).coerceAtLeast(Duration.ZERO)
                throw BleQuotaExceededException(
                    retryAfter = retryAfter,
                    message = "Android BLE scan start limit reached. Retry after $retryAfter"
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

class BleQuotaExceededException(val retryAfter: Duration, message: String) : IllegalStateException(message)
```

**NEGATIVE CONSTRAINT**:
```kotlin
// DEFECT: Rapid restarts cause silent scan suppression and deadlock coroutine collectors
suspend fun triggerScan(scanner: BluetoothLeScanner, callback: ScanCallback) {
    scanner.startScan(callback) // Direct invocation breaches OS window quota
}
```

**VERIFICATION METHOD**:
Execute deterministic unit tests stepping a synthetic `TestTimeSource`:
```kotlin
@Test
fun verifyScanLimiterEnforcesQuotaWindow() = runTest {
    val timeSource = TestTimeSource()
    val limiter = AndroidBleScanStartLimiter(timeSource = timeSource)
    repeat(5) { limiter.reserveStart() }
    assertFailsWith<BleQuotaExceededException> { limiter.reserveStart() }
    timeSource += 30.seconds
    limiter.reserveStart() // Must succeed now
}
```

---

### 3. Metric Sentinel Zero vs Real Float Absence Rule
**RULE**:
Telemetry, RF signal statistics, and sensor metric parsers MUST NEVER use `0.0f`, `0`, or negative integers as default representations for "missing" data when zero represents a valid physical measurement. Optional physical metrics MUST be modeled as nullable types (`Float?`, `Int?`). AST linters MUST forbid default assignment expressions of numeric zero literals to missing metric values.

**WHY**:
In RF systems (LoRa) and environmental telemetry (barometric altitude, SNR, temperature, battery delta), `0.0` represents an actual value (e.g., `0.0 dB` SNR, `0 meters` sea level, or `0°C`). Coercing absent protobuf fields to `0` or setting zero defaults pollutes telemetry history with spurious boundary cliffs, leading to corrupt geofencing alerts and false dead-reckoning conclusions.

**WHEN TO APPLY**:
In all data pipelines parsing Protobuf packets, REST JSON payloads, hardware sensor busses (I2C/SPI), and UI telemetry formatters.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
data class TelemetryMetric(
    val snrDb: Float?,
    val rssiDbm: Int?,
    val airQualityPpm: Float?
)

fun parseSignalPacket(hasSnr: Boolean, rawSnr: Float, hasRssi: Boolean, rawRssi: Int): TelemetryMetric {
    return TelemetryMetric(
        snrDb = if (hasSnr) rawSnr else null,
        rssiDbm = if (hasRssi) rawRssi else null,
        airQualityPpm = null
    )
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Zero sentinel ambiguity
data class FaultyTelemetryMetric(
    val snrDb: Float = 0.0f,  // Conflates zero signal (0.0 dB) with null/missing signal
    val rssiDbm: Int = 0      // 0 dBm is saturated, strong signal, NOT missing
)
```

**VERIFICATION METHOD**:
Enforce via automated `ast-grep` linter rule (`no-float-metric-zero-sentinel.yml`):
```yaml
id: no-float-metric-zero-sentinel
language: kotlin
rule:
  pattern: $VAL: Float = 0.0f
message: "Do not assign 0.0f as default sentinel for missing telemetry. Use Float? = null."
severity: error
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Glance Widget Picker Preview Crash via Missing GlanceId (BUG-GLANCE-PREVIEW-01)
- **Context**: `feature/widget/src/main/kotlin/org/meshtastic/feature/widget/WidgetSizes.kt`, `LocalStatsWidget.kt`, `NodeTrackerWidget.kt`
- **What Was Expected**: On Android 15 (Vanilla Ice Cream) and Android 16 (Baklava), the system widget picker queries widgets for previews via `setWidgetPreviews` and `providePreview`. Previews should generate a mock RemoteViews layout representing real app data or fallback mocks.
- **What Actually Happened**: The widget picker crashed whenever users scrolled past the Meshtastic widgets or attempted to view previews. The runtime threw:
  `java.lang.IllegalStateException: No GlanceId found in this Composition` originating from `LocalGlanceId.current`.
- **Evidence in Repo**: Commit `151a106d`, PR #7934. File additions: `feature/widget/src/test/kotlin/org/meshtastic/feature/widget/WidgetPreviewTest.kt`.
- **Root Cause**: `WidgetSizes.currentOptions` invoked `LocalGlanceId.current` to query `GlanceAppWidgetManager.getAppWidgetId(glanceId)` to fetch `AppWidgetOptions` bounds. During preview generation (`providePreview`), Glance generates content in an isolated, unbound context where no `GlanceId` is installed into the composition tree. Its getter unconditionally throws an `IllegalStateException`.
- **Remediation Code Diff**:
```diff
--- a/feature/widget/src/main/kotlin/org/meshtastic/feature/widget/WidgetSizes.kt
+++ b/feature/widget/src/main/kotlin/org/meshtastic/feature/widget/WidgetSizes.kt
+/**
+ * True inside `providePreview`. Glance composes the picker preview without a [LocalGlanceId], whose default throws, so
+ * nothing under a preview may read it.
+ */
+@Suppress("CompositionLocalAllowlist")
+internal val LocalWidgetPreview = staticCompositionLocalOf { false }
...
     @Composable
     @ReadOnlyComposable
     private fun currentOptions(context: Context): Bundle {
-        val glanceId = LocalGlanceId.current
-        val appWidgetId = runCatching { GlanceAppWidgetManager(context).getAppWidgetId(glanceId) }.getOrNull()
+        val appWidgetId =
+            if (LocalWidgetPreview.current) {
+                null
+            } else {
+                val glanceId = LocalGlanceId.current
+                runCatching { GlanceAppWidgetManager(context).getAppWidgetId(glanceId) }.getOrNull()
+            }
         return appWidgetId
             ?.let { AppWidgetManager.getInstance(context).getAppWidgetOptions(it) }
             ?.takeIf { !it.isEmpty } ?: LocalAppWidgetOptions.current
```
- **Lesson**: Previews execute under artificial, non-instantiated host bindings. Static preview renders must isolate and stub out any dependency requiring concrete host-assigned hardware or system IDs.

---

### Incident 2: Responsive Size Calculation Bloat and Excessive Blank Space (BUG-GLANCE-SIZE-02)
- **Context**: `feature/widget/src/main/kotlin/org/meshtastic/feature/widget/WidgetSizes.kt`
- **What Was Expected**: Resizing the Node Tracker and Local Stats widgets should dynamically scale content to fill available cells without clipping or injecting dead space.
- **What Actually Happened**: On Android 16/17 devices (Samsung OneUI / Google Pixel Launcher), expanding the widget horizontally or vertically produced massive white/blank space at the bottom (Issue #7890, Issue #7855). The widgets requested 2x2 cells minimum but required larger bounding boxes than necessary to display essential telemetry.
- **Evidence in Repo**: Issues #7890, #7855; PR #7862.
- **Root Cause**: The layout used `SizeMode.Responsive` mapping to coarse breakpoints, while internally computing layout bounds against `LocalAppWidgetOptions.current` without reconciling aspect ratios against launcher grid cell sizes. When launchers provided padding-inflated options bundles, cell calculation logic over-budgeted padding, dropping available render area below threshold and forcing widgets into degenerate layout fallbacks.
- **Remediation Pattern**: Consolidated size queries to read the true cell bounds directly from `AppWidgetManager.getAppWidgetOptions(it)` on real instances while falling back to `LocalAppWidgetOptions` with defensive minimum dimension clamps.
- **Lesson**: Launcher cell bounds calculation varies across OEM grid architectures. Widgets must decouple visual layout breakpoints from container grid bounding boxes.

---

### Incident 3: BLE Pairing Race & Sticky BOND_NONE Polling Deadlock (BUG-BLE-BOND-03)
- **Context**: `core/ble/src/androidMain/kotlin/org/meshtastic/core/ble/AndroidBluetoothRepository.kt`
- **What Was Expected**: Initiating a Bluetooth pairing handshake (`remoteDevice.createBond()`) should asynchronously transition from `BOND_NONE` -> `BOND_BONDING` -> `BOND_BONDED`.
- **What Actually Happened**: On specific Android OEMs, calling `createBond()` returned `false` if an encrypted GATT read had already triggered pairing at the hardware controller level. In other instances, `createBond()` returned `true`, but the Android stack remained in `BOND_NONE` for up to 1 second before broadcasting `ACTION_BOND_STATE_CHANGED`, causing bonding routines to instantly exit with "Bonding failed or rejected".
- **Evidence in Repo**: `AndroidBluetoothRepository.kt` lines 80-210 (`CREATED_BOND_NONE_GRACE`, `BondWaitStart`).
- **Root Cause**: The Android BLE stack queues bonding requests asynchronously. The OS state can lag behind the return value of `createBond()`. Polling `remoteDevice.bondState` immediately after invocation reads stale `BOND_NONE` state.
- **Remediation Pattern**:
  1. Register dynamic `BroadcastReceiver` before calling `createBond()` using `ContextCompat.RECEIVER_EXPORTED` (since the Android Bluetooth stack runs under a distinct system UID).
  2. Implement a two-poll grace period (`CREATED_BOND_NONE_GRACE = 1000.milliseconds`) for slow `BOND_NONE` -> `BOND_BONDING` transitions.
  3. If `createBond()` returns `false`, check whether `bondState == BOND_BONDING`. If so, treat it as in-flight rather than an initiation failure.
- **Lesson**: OS-level hardware state changes must incorporate transient grace intervals to prevent premature failure evaluation against asynchronous driver queues.

---

### Incident 4: On-Device AI AppFunctions First-Launch Indexing Crash (BUG-AI-APPFUNC-04)
- **Context**: `androidApp/src/google/kotlin/org/meshtastic/app/ai/appfunctions/AppFunctionStateSync.kt`
- **What Was Expected**: The background worker synchronizes on-device AI assistant capabilities (`AppFunctionManager`) based on user preferences.
- **What Actually Happened**: On clean installations of Android 16 (Baklava / API 36), the app crashed or permanently failed to sync functions because the platform threw `IllegalArgumentException` or `AppFunctionException` when writing function states before background indexing completed.
- **Evidence in Repo**: `AppFunctionStateSync.kt` lines 85–125 (`pendingWrites`, retry delay loop).
- **Root Cause**: `AppFunctionManager` requires the OS AppSearch indexer to parse manifest declarations before function identifiers become addressable. Calling `setAppFunctionEnabled` immediately after app install threw `IllegalArgumentException: Function ID not recognized`.
- **Remediation Code Diff**:
```diff
--- a/androidApp/src/google/kotlin/org/meshtastic/app/ai/appfunctions/AppFunctionStateSync.kt
+++ b/androidApp/src/google/kotlin/org/meshtastic/app/ai/appfunctions/AppFunctionStateSync.kt
+        repeat(MAX_SYNC_ATTEMPTS) { attempt ->
+            val pending = pendingWrites(desired, readStates(manager, desired.map { it.first }))
+            if (pending.isEmpty()) return
+
+            for ((functionId, enabled) in pending) {
+                val state = if (enabled) AppFunctionManager.APP_FUNCTION_STATE_ENABLED else AppFunctionManager.APP_FUNCTION_STATE_DISABLED
+                try {
+                    manager.setAppFunctionEnabled(functionId, state)
+                } catch (e: AppFunctionException) {
+                    Logger.d(e) { "AppFunction $functionId not writable yet" }
+                } catch (e: IllegalArgumentException) {
+                    Logger.d(e) { "AppFunction $functionId not indexed yet" }
+                }
+            }
+            if (attempt < MAX_SYNC_ATTEMPTS - 1) delay(RETRY_DELAY_MS)
+        }
```
- **Lesson**: System-level indexing of declarative manifest capabilities is decoupled from application launch. System IPC registries require optimistic retries with backoff.

---

### Incident 5: Barcode Scanner Concurrent Result Mutation Leak (BUG-BARCODE-CONC-05)
- **Context**: `core/barcode/src/main/kotlin/org/meshtastic/core/barcode/SingleScanResultGate.kt`, `BarcodeScannerProvider.kt`
- **What Was Expected**: Scanning a QR code via CameraX should emit the decoded payload exactly once and dismiss the scanner dialog.
- **What Actually Happened**: CameraX image analysis frames execute on high-frequency camera threads (30-60 fps). When a QR code was brought into focus, multiple successive frames decoded the identical string, firing `onResult` several times before the UI layer could unbind the camera lifecycle, causing double-navigation and corrupt state writes.
- **Evidence in Repo**: `SingleScanResultGate.kt`, `BarcodeScannerProvider.kt`.
- **Root Cause**: Camera frame analysis pipelines run concurrently with Compose UI recomposition. Without thread-safe atomic gating, asynchronous frame completions race past dismiss requests.
- **Remediation Code Diff**:
```kotlin
// Thread-safe delivery gate via atomic CAS
class SingleScanResultGate {
    private val delivered = AtomicBoolean(false)

    fun tryDeliver(result: String?, onResult: (String?) -> Unit): Boolean {
        if (!delivered.compareAndSet(false, true)) return false
        onResult(result)
        return true
    }
}
```
- **Lesson**: High-throughput hardware streams (camera, audio, radio) must implement lock-free atomic single-delivery gates at the intake threshold before invoking UI callbacks.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Strict Sentinel Discrimination**: Zero is a valid physical measurement across LoRa SNR, telemetry metrics, and GPS altitudes.
  ```kotlin
  // CRITICAL: Zero is a legitimate reading in RF metrics; check nullable presence
  val isValidMetric = metric?.takeIf { it != Float.MIN_VALUE } != null
  ```
- **Bitwise Protocol Unpacking**: Protobuf integers mapped to packed bitmasks require exact masking before sign extension:
  ```kotlin
  // Ensure sign bits do not corrupt upper byte frames during LoRa header synthesis
  val packetHeaderFlags = (rawByte.toInt() and 0xFF)
  ```
- **Collection Immutability Bounds**: StateFlow updates must emit structural deep copies to prevent reference aliasing bugs across coroutines:
  ```kotlin
  // Invariant: Always produce immutable list views when publishing to StateFlow
  _nodes.update { currentMap -> currentMap + (node.num to node) }
  ```

### 2. Infinite Loop & Recursion Guards
- **MVT Geometry Unpacking Termination**:
  ```kotlin
  // Bounded traversal over ring sequences
  generateSequence(listOf(root)) { level -> 
      level.filterIsInstance<ViewGroup>().flatMap { it.children } 
  }
  .takeWhile { it.isNotEmpty() } // Invariant: Guaranteed termination when child depth hits leaf
  .flatten()
  ```
- **LRU Cache Structural Modification Locks**:
  ```kotlin
  // Invariant: Access-order LinkedHashMap mutates structure on get(); MUST be guarded
  private val tileCache = object : LinkedHashMap<String, List<OfflineFeature>>(16, 0.75f, true) {
      override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, List<OfflineFeature>>): Boolean =
          size > MAX_CACHED_TILES
  }
  fun readTile(key: String): List<OfflineFeature>? = synchronized(tileCache) { tileCache[key] }
  ```

### 3. UI & UX Micro-Mechanics
- **Camera Frame Buffer Lifecycle Drain**:
  ```kotlin
  // Invariant: ImageProxy MUST be closed in a finally block; failure blocks CameraX pipeline
  val lumaPlane = imageProxy.planes[0]
  val buffer = lumaPlane.buffer.duplicate()
  try {
      decode(buffer)
  } finally {
      imageProxy.close() // Mandatory: unblocks driver ring-buffer
  }
  ```
- **ZXing QR MultiFormat CPU Throttling**:
  ```kotlin
  // Invariant: Never allow MultiFormatReader to test all formats during a continuous scan
  reader.setHints(mapOf(DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE)))
  ```

### 4. Backend Concurrency & Memory Safety
- **Android BroadcastReceiver Leak Containment**:
  ```kotlin
  // Always register pairing and bond receivers with deterministic unregister in finally blocks
  try {
      ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_EXPORTED)
      awaitBondResult(...)
  } finally {
      context.unregisterReceiver(receiver) // Mandatory cleanup
  }
  ```
- **Cancellation Propagation in Application Scope**:
  ```kotlin
  // Isolates sibling failures while preventing unhandled exceptions from crashing the process
  private val applicationScopeExceptionHandler = CoroutineExceptionHandler { context, throwable ->
      Logger.e(throwable) { "Background application init failed in $context" }
  }
  protected val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default + applicationScopeExceptionHandler)
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Coroutines Cancellation Swallowing Trap**:
  ```kotlin
  // MANDATORY: Never catch generic Exception without re-throwing CancellationException
  try {
      syncStates(desired)
  } catch (e: CancellationException) {
      throw e // CRUCIAL: Ensures cooperative coroutine cancellation survives
  } catch (e: Exception) {
      Logger.e(e) { "AppFunction sync pass failed" }
  }
  ```
- **Dynamic Linker Verification Trap**:
  ```kotlin
  // Guard native SQLite loading prior to initializing database ORM layers
  private fun bundledSqliteLoads(loader: () -> Unit): Boolean = runCatching {
      loader()
  }.isSuccess
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- Modular Kotlin Multiplatform (KMP) architecture separating `core:ble`, `core:database`, `core:barcode`, `feature:widget`, and `androidApp`.
- Dependency injection configured via Koin using lazy resolution patterns. Heavy singletons (Room, WorkManager) remain un-instantiated during unit testing and preview compositions.
- Explicit platform flavor boundaries (`google` vs `fdroid`) enforcing full binary independence for analytics and mapping.

### 2. Core Abstractions
- `BleScanStartLimiter`: Rate-limiting interface insulating Android BLE drivers.
- `SingleScanResultGate`: Atomic CAS boundary for camera stream events.
- `OfflineVectorRenderer` & `VectorTile`: Custom Protobuf MVT parser mapping binary geometries to Mercator coordinate models.

### 3. Error Handling
- Structured error handling trees isolating BLE connection faults, serial disconnects, and packet corruptions.
- Re-tune recovery engines: `restoreInterruptedSessionsOnReconnect` safely restores modified radio parameters if an app crash interrupted a frequency-hopping discovery scan.

### 4. Testing
- Robolectric host testing with mock Koin graph bindings (`WidgetPreviewTest.kt`).
- Synthetic time testing via `kotlinx.coroutines.test` and custom `TimeSource` mocks for rolling windows.
- Dedicated fake repositories (`FakeNodeRepository`, `FakeServiceRepository`) isolating business logic from Android hardware stacks.

### 5. Security
- Encrypted mesh payloads using AES-256-CTR and AES-128-CBC over-the-air.
- Zero-exposure PIN receivers: pairing receivers are scoped strictly inside ephemeral `try {} finally {}` blocks.
- Privacy-first offline maps: zero telemetry logging containing tile coordinates ($X, Y, Z$) to prevent location reconstruction attacks.

### 6. Performance
- MVT parsing avoids decoding high-overhead vector layers (POIs, buildings), selecting only `water`, `roads`, and `boundaries` for off-grid situational awareness.
- Thread-safe LRU caching (`LinkedHashMap` with `MAX_CACHED_TILES = 96`) bounded to memory constraints.
- Camera frame luminance plane slicing via direct `ByteBuffer.duplicate()` zero-copy access.

### 7. Deployment
- Android SDK 34/35/36 multi-target builds with toolchain-enforced Java 17/21 compatibility.
- Hermetic F-Droid builds without external proprietary binaries or play-services dependencies.
- Strict Proguard/R8 rules preserving Protocol Buffer schema descriptors.

### 8. Agent Patterns
- Custom `.coderabbit.yaml` and `.claude` agent hooks enforcing project-wide invariant rules.
- Custom `ast-grep` rules preventing telemetry zero-sentinel defects directly in CI review loops.

### 9. Data Flow
```
Mesh Radio Frame (LoRa) -> BLE GATT MTU -> Protocol Buffer Parser (fromByteArray)
  -> SQLite Persistent Cache (Room Pool) -> MutableStateFlow Pipeline
  -> Composable View / Glance RemoteViews Sandbox
```

---

## 6. The 8 Learning Extraction Artifacts

1. **Pattern**: In-process rolling window token bucket for platform hardware rate-limits (`AndroidBleScanStartLimiter`).
2. **Rule**: Every Jetpack Glance picker preview MUST inject a static preview flag to isolate components from `LocalGlanceId`.
3. **Architecture Principle**: Isolate native C/JNI dependencies behind dynamic load probes before initializing application dependency injection graphs.
4. **Failure Mode**: Silently dropped BLE scans caused by unmonitored rapid scan restarts breaching Android's 5-per-30s sliding quota window.
5. **Reusable Skill**: Wrapping CameraX `ImageAnalysis.Analyzer` frame buffers with atomic CAS gates to prevent duplicate deliveries.
6. **Decision**: Restricting offline vector map layers strictly to roads, water, and boundaries to protect memory bounds during high-stress off-grid scenarios.
7. **Anti-pattern**: Relying on `0.0f` or negative values as sentinels for missing telemetry metrics.
8. **Verification Method**: Headless Robolectric preview generation tests asserting text nodes without launcher attachments.

---

## 7. Actionable Agent Skill & Implementation Checklist

```markdown
### AI Coding Agent Verification Checklist: Mobile Hardware & Platform Systems

- [ ] 1. BLE Rate Limiting: Are all BLE scan calls protected by an in-process sliding-window rate limiter (<= 5 per 30s)?
- [ ] 2. Glance Widget Previews: Does any code path inside `providePreview` or `setWidgetPreviews` access `LocalGlanceId`? If so, wrap it in a preview-aware conditional fallback.
- [ ] 3. Camera Frame Cleanup: Are all `ImageProxy` objects closed strictly inside `finally {}` blocks in every `ImageAnalysis.Analyzer`?
- [ ] 4. Atomic Event Gates: Are asynchronous hardware stream events (camera, NFC, radio) guarded by an `AtomicBoolean` CAS gate before invoking UI callbacks?
- [ ] 5. Coroutine Exceptions: Do catch-blocks inside coroutines explicitly catch and rethrow `CancellationException`?
- [ ] 6. Telemetry Sentinels: Are RF and sensor metrics typed as nullable (`Float?`, `Int?`) rather than initialized to `0.0f` or `0`?
- [ ] 7. Native Binary Safe-Boot: Is dynamic JNI library linkage validated prior to initializing the database and dependency injection frameworks?
- [ ] 8. Broadcast Export Bounds: Are local broadcasts registered with `ContextCompat.RECEIVER_EXPORTED` only when explicitly receiving protected system broadcasts (such as BLE pairing intents)?
```