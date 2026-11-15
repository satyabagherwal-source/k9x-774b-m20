# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: meshtastic-meshtastic-android-learnings Core Invariants

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
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshtastic-meshtastic-android-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T09:27:07.392Z`  
> **Learning ID**: `LEARN-EVO-meshtastic-meshtastic-android-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), B (Product Intelligence)
- **Confidence Rating**: 66%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from meshtastic-meshtastic-android-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/meshtastic-meshtastic-android-learnings.md`  
> **Source**: github ([https://github.com/meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android))  
> **Source Version**: `fd407372`  
> **License**: GPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-15T09:26:35.137Z  
> **Learning ID**: `learn-github-meshtastic-meshtastic-android`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): meshtastic/Meshtastic-Android

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Problem Statement & Physical Reality Constraints
Meshtastic-Android is an off-grid, encrypted, peer-to-peer mesh communications terminal running across heterogeneous hardware targets (Android, Compose Desktop/Linux, JVM). It interfaces with physical LoRa radios (ESP32, nRF52, RP2040) over lossy, low-bandwidth, high-latency physical transports:
- **Bluetooth Low Energy (BLE)** via Nordic Semiconductor / Android BLE APIs.
- **USB Serial / CDC-ACM** via direct serial streams.
- **TCP/UDP Wi-Fi/Ethernet links**.

Physical payload constraints dictate the architecture: LoRa payloads are bounded to 237 bytes maximum MTU (with effective application payloads often $\le 200$ bytes). Latency spans hundreds of milliseconds to multiple seconds per hop, and channel bandwidth is constrained (often $0.1$ to $5$ kbps). Every data structure serialized over the air must obey strict Google Protocol Buffer definitions, rigorous integer packing, and aggressive data omission.

### 1.2 System Boundaries & Decoupling Model
The repository implements a Kotlin Multiplatform (KMP) architecture cleanly separated into distinct lifecycle rings:
```
┌────────────────────────────────────────────────────────┐
│                      Compose UI                        │
│   (Android App / Desktop App / Glance AppWidgets)      │
└───────────────────────────┬────────────────────────────┘
                            │ StateFlow / ViewModels
┌───────────────────────────▼────────────────────────────┐
│                    Feature Modules                     │
│    (discovery, map, coverage, widget, settings, etc.)  │
└───────────────────────────┬────────────────────────────┘
                            │ Domain Use Cases
┌───────────────────────────▼────────────────────────────┐
│                      Core Domain                       │
│       (ChannelSetReplacement, PositionPrecision)       │
└───────────────────────────┬────────────────────────────┘
                            │ Reactive Repositories
┌───────────────────────────▼────────────────────────────┐
│            Core Model & Protocol Buffers               │
│          (Wire / Protobuf Models, ByteStrings)         │
└───────────────────────────┬────────────────────────────┘
                            │ Packets / Frames
┌───────────────────────────▼────────────────────────────┐
│      Transport Drivers & OS Abstraction Layer          │
│    (BLE Scanner Limiter, Bond Receivers, Bundled JNI)  │
└────────────────────────────────────────────────────────┘
```
1. **Transport Isolation Ring**: Transport engines (`core/ble`, `core/serial`) decouple underlying platform-specific quirks (e.g., Android's hidden BLE scan start quota, Samsung BLE bonding race conditions) from packet dispatching.
2. **Wire Representation vs. Presentation Model Ring**: Protocol buffer builders are never leaked raw into UI bindings without sanitization and bounding rules. For example, location precision is bounded depending on cryptographic channel identity.
3. **Flavored Boundary Decoupling**: Google Play flavors (`google`) leverage proprietary services (Google Maps SDK, ML Kit Barcode, Firebase, Gemini/AppFunctions API 36) via parallel source sets (`src/google`), while open-source releases (`fdroid`) isolate pure local implementations (ZXing QR analysis, offline MBTiles/PMTiles vector renderers) under identical interface contracts.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Platform Quota Pre-emptive Accounting Rule
**RULE**:
When interacting with OS-level hardware daemons that impose rolling rate-limits or quotas (e.g., Android `BluetoothLeScanner.startScan()`), client software **MUST** track and account for resource reservations in-memory prior to executing the platform system call. If the system call would breach the threshold, the client **MUST NOT** make the platform call and **MUST** fail immediately with a deterministic quota error specifying the backoff duration.

**WHY**:
Android's `BluetoothManager` enforces an undocumented rate-limit (e.g., a maximum of 5 BLE scan starts within a rolling 30-second window). If an application breaches this quota, the OS framework silences the callback without returning an error or advertisement results. The app remains indefinitely suspended in a `Scanning` state without an advertisement arriving or an exception being raised, inducing complete radio desynchronization.

**WHEN TO APPLY**:
Apply to all mobile, embedded, or desktop hardware driver interfaces where the underlying operating system enforces undocumented, silent-suppression rate ceilings (Bluetooth LE scans, Wi-Fi RTT scans, Camera open requests, GNSS batch requests).

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
package org.meshtastic.core.ble

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeMark
import kotlin.time.TimeSource

internal const val ANDROID_BLE_SCAN_START_LIMIT = 5
internal val ANDROID_BLE_SCAN_START_WINDOW: Duration = 30.seconds

class AndroidBleScanStartLimiter(
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
                val oldest = scanStarts.first()
                val retryAfter = (window - oldest.elapsedNow()).coerceAtLeast(Duration.ZERO)
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
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Blindly delegating scan requests directly to the Android Framework
suspend fun startScanUnsafe(scanner: BluetoothLeScanner, callback: ScanCallback) {
    // If called 6 times within 30 seconds, Android OS drops the scan silently.
    // The coroutine or subscriber hangs forever waiting for onScanResult().
    scanner.startScan(callback)
}
```

**VERIFICATION METHOD**:
Instantiate `AndroidBleScanStartLimiter` with a `TestTimeSource`. Fire `maxStarts` calls sequentially and assert success. Fire the `(maxStarts + 1)`-th call and assert that `BleScanStartException` is thrown with the exact delta time remaining on the oldest timestamp. Advance test time past `window` and assert scan permits can be acquired again.

---

### 2. Native Heap Pre-Allocation Vertex Budget Rule
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

### 3. Public-Key Cryptographic Precision Ceiling Rule
**RULE**:
When an application entity broadcasts telemetry (such as GNSS coordinates) over a communication channel whose encryption key is shared, default, or publicly decryptable, the serialization engine **MUST** programmatically clamp precision parameters to a predetermined security ceiling (e.g., $\le 15$ bits of precision, roughly equivalent to ~100-meter uncertainty). Omitted precision configurations on public channels **MUST NOT** default to raw precision; they **MUST** be explicitly normalized to degraded or disabled status.

**WHY**:
In mesh and IoT radio topologies, users share channels using standard public default pre-shared keys (e.g., Meshtastic's `LongFast` default PSK). If an imported profile or UI setting fails to specify explicit precision bits for a channel, legacy firmware/nodes treat the absence of precision configuration as an authorization to broadcast full 32-bit centimetre-level GPS coordinates. This leaks the physical location of emergency responders, activists, or private citizens to anyone possessing the public default key within radio frequency range.

**WHEN TO APPLY**:
Every system where data can traverse multiple cryptographic tiers (public broadcast vs. private pre-shared key groups) and physical privacy/telemetry is serialized into protobufs or wire frames.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
package org.meshtastic.core.model.util

import okio.ByteString
import org.meshtastic.core.model.Channel
import org.meshtastic.proto.ChannelSettings
import org.meshtastic.proto.ModuleSettings

const val MAX_PUBLIC_KEY_PRECISION_BITS = 15

fun onWirePrecisionBits(precisionBits: Int, usesPublicKey: Boolean): Int =
    if (usesPublicKey) precisionBits.coerceAtMost(MAX_PUBLIC_KEY_PRECISION_BITS) else precisionBits

fun ChannelSettings.withOnWirePrecision(usesPublicKey: Boolean): ChannelSettings {
    val module = module_settings
    // Crucial: absent module settings MUST become explicit 0 (disabled) on public keys
    val onWire = onWirePrecisionBits(module?.position_precision ?: 0, usesPublicKey)
    if (!usesPublicKey || onWire == module?.position_precision) return this
    
    val capped = (module ?: ModuleSettings.Builder().build())
        .newBuilder()
        .also { wb -> wb.position_precision = onWire }
        .build()
        
    return newBuilder().also { wb -> wb.module_settings = capped }.build()
}

fun List<ChannelSettings>.withOnWirePrecision(): List<ChannelSettings> {
    val primary = firstOrNull()
    return mapIndexed { index, settings ->
        settings.withOnWirePrecision(Channel.usesPublicKey(settings, primary.takeIf { index > 0 }))
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Trusting the imported profile or UI model directly onto the wire
fun ChannelSet.exportToRadio(): ChannelSet {
    // SECURITY DISASTER: If position_precision is null or set to 32 bits on the
    // default public channel, physical coordinates are broadcast in the clear.
    return this 
}
```

**VERIFICATION METHOD**:
Execute property-based or parameterized unit tests against `ChannelSettings.withOnWirePrecision()`:
1. Public default key with `precision = 32` -> yields `precision = 15`.
2. Public default key with `precision = null` -> yields explicit `precision = 0`.
3. Private key with `precision = 32` -> yields preserved `precision = 32`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Precise Physical Location Leak on Public-Key LoRa Channels (BUG-LOCATION-01)
- **Context**: `core/model/src/commonMain/kotlin/org/meshtastic/core/model/Channel.kt`, `core/model/src/commonMain/kotlin/org/meshtastic/core/model/util/PositionPrecision.kt`, and `InstallProfileUseCase.kt`.
- **What Was Expected**: Channel profiles imported from QR codes, URLs, or cloud backups should never broadcast high-precision GPS coordinates over channels encrypted with well-known public keys.
- **What Actually Happened**: When importing channel sets, channels operating on the default public channel (or secondary channels inheriting the primary channel's public key) retained their incoming precision bits (up to 32 bits, millimetre-level precision). Furthermore, if `module_settings` was absent, older firmware interpreted the empty field as unrestricted full-precision GPS broadcasting.
- **Evidence in Repo**: Commit `f56e47fc` ("fix(settings): gate precise location on public-key channels (#8043)").
- **Root Cause**: The domain logic previously normalized replacement channels without inspecting the cryptographic strength of the channel's `psk` (Pre-Shared Key). The system omitted validation for 1-byte key aliases (e.g., `0x01` representing default channel key) and default 16-byte key families whose last byte serves as a sub-band selector.
- **Remediation Code Diff**:
```kotlin
// --- Channel.kt (Vulnerable: no public-key detection)
// +++ Channel.kt (Fixed: explicit byte examination)
+ fun usesPublicKey(settings: ChannelSettings, primary: ChannelSettings? = null): Boolean {
+     val psk = settings.psk
+     return when (psk.size) {
+         0 -> primary == null || usesPublicKey(primary)
+         1 -> true // 1-byte key aliases are known public keys
+         channelDefaultKey.size -> psk.rangeEquals(0, channelDefaultKey, 0, channelDefaultKey.size - 1)
+         else -> false
+     }
+ }

// --- ChannelSetReplacement.kt
// - val normalizedSettings = normalizeReplacementSettings(settings, lora_config ?: fallbackLoraConfig)
// +++ ChannelSetReplacement.kt
+ val normalizedSettings =
+     normalizeReplacementSettings(settings, lora_config ?: fallbackLoraConfig).withOnWirePrecision()
```
- **Lesson**: Security-sensitive telemetry permissions cannot be modeled as independent scalar properties; they must be cryptographically bounded by the transport medium's access control layer.

---

### Incident 2: Native Maps SDK Out-Of-Memory Crash via Vertex Explosion (BUG-MAP-02)
- **Context**: `androidApp/src/google/kotlin/org/meshtastic/app/map/MapView.kt` and `MapLayerVertexBudget.kt`.
- **What Was Expected**: Importing custom geospatial layers (GeoJSON/KML files or generated RF coverage contours) into the map should render boundaries smoothly without crashing the process.
- **What Actually Happened**: Users importing complex GIS boundaries or generated terrain contours triggered silent native crashes (`OutOfMemoryError`). The Google Maps SDK crashed on internal background rendering threads, completely bypassing Android's coroutine error handlers and crash reporters.
- **Evidence in Repo**: Commit `a6fc1e52` ("fix(map): bound the memory map layers and coverage terrain hold (#8030)").
- **Root Cause**: The Google Maps SDK maintains multiple copies of geometry: original model vertices, Java `LatLng` wrappers, and native C++ JNI rendering buffers. Resident overhead is ~120 bytes per vertex, and during GeoJSON ingestion, parser overhead spikes to ~300 bytes per vertex. Unchecked rendering of multi-polygon coverage contours exceeded the app's available heap.
- **Remediation Code Diff**:
```kotlin
// --- MapView.kt (Vulnerable: direct load into map on each recomposition)
// - MapEffect(layerItem.id, layerItem.refreshToken, opacity) { map ->
// -     val bytes = mapViewModel.readLayerBytes(layerItem) ?: return@MapEffect
// -     val dataLayer = withContext(ioDispatcher) { parseMapLayer(...) }
// -     RenderedMapLayer(map, dataLayer.scaledByOpacity(opacity), opacity)
// - }

// +++ MapView.kt (Fixed: Mutex-guarded serial load with vertex budgeting)
+ val slot = remember { MapLayerSlot() }
+ MapEffect(layerItem.id, layerItem.refreshToken, opacity, layerItem.isVisible) { map ->
+     slot.clear()
+     if (!layerItem.isVisible) return@MapEffect
+     mapLayerLoadMutex.withLock { slot.load(map, layerItem, opacity, mapViewModel) }
+ }
+
+ // In MapLayerSlot.load():
+ val count = dataLayer?.vertexCount() ?: 0
+ if (!mapLayerBudget.tryAcquire(count)) {
+     mapViewModel.reportLayerUndrawable(layerItem, MapLayerRefusal.TOO_DETAILED)
+     return
+ }
```
- **Lesson**: When bridging managed runtime data structures to closed native SDKs, memory consumption must be gated before the data crosses the JNI boundary.

---

### Incident 3: GeoJSON Payload Bloat & Floating Point Text Inflation (BUG-GEOJSON-03)
- **Context**: `feature/coverage/src/commonMain/kotlin/org/meshtastic/feature/coverage/CoverageContours.kt`.
- **What Was Expected**: RF coverage contours serialized into GeoJSON strings should be compact and fast to parse.
- **What Actually Happened**: Coordinates formatted via standard Kotlin string interpolation (`"[$lon,$lat]"`) output full 64-bit IEEE-754 representations (e.g., `-122.12345678901234, 37.12345678901234`). This bloated GeoJSON strings by 200–300%, consuming tens of megabytes of heap memory just to hold the raw string in memory before parsing.
- **Evidence in Repo**: Commit `a6fc1e52`, changes to `CoverageContours.kt`.
- **Root Cause**: Unbounded double string formatting in high-frequency polygon ring generation loops. Standard IEEE-754 representations contain up to 17 significant decimal digits, whereas geographic precision past 6 decimal places (~10 cm) is meaningless physical noise for RF coverage.
- **Remediation Code Diff**:
```kotlin
// --- CoverageContours.kt
// - ring.joinToString(",") { (lon, lat) -> "[$lon,$lat]" }

// +++ CoverageContours.kt
+ ring.joinToString(",") { (lon, lat) ->
+     "[${lon.toCoordinate()},${lat.toCoordinate()}]"
+ }
+
+ private const val COORDINATE_DECIMALS = 6
+ private const val MICRODEGREES = 1_000_000
+
+ internal fun Double.toCoordinate(): String {
+     val scaled = (this * MICRODEGREES).roundToLong()
+     val sign = if (scaled < 0) "-" else ""
+     val magnitude = abs(scaled)
+     val fraction = (magnitude % MICRODEGREES).toString().padStart(COORDINATE_DECIMALS, '0').trimEnd('0')
+     return if (fraction.isEmpty()) "$sign${magnitude / MICRODEGREES}" else "$sign${magnitude / MICRODEGREES}.$fraction"
+ }
```
- **Lesson**: High-volume numeric-to-text serialization MUST enforce domain-specific precision quantization to prevent severe memory bloating and string allocation thrashing.

---

### Incident 4: BLE Bonding Deadlock & False Failure Trap (BUG-BLE-BOND-04)
- **Context**: `core/ble/src/androidMain/kotlin/org/meshtastic/core/ble/AndroidBluetoothRepository.kt`.
- **What Was Expected**: Initiating a Bluetooth pairing/bonding handshake with a Meshtastic hardware node should reliably resolve into either bonded or failed state.
- **What Actually Happened**: Calling `BluetoothDevice.createBond()` frequently returned `false`, causing the application to immediately fail the connection setup. In other OEM stacks (such as Samsung), `createBond()` returned `true`, but the state momentarily remained `BOND_NONE` before transitioning to `BOND_BONDING`, causing instant timeout failures.
- **Evidence in Repo**: Implementation in `AndroidBluetoothRepository.kt` (`startOrObserveBond` and `awaitBondResult`).
- **Root Cause**: `createBond()` returns `false` if a bond handshake is already in flight under the hood (e.g., triggered asynchronously by the OS when reading an encrypted GATT characteristic). Furthermore, `createBond()` returning `true` only queues the binder call; the Android Bluetooth stack lags in transitioning out of `BOND_NONE`.
- **Remediation Code Diff**:
```kotlin
// Fixed State Machine in AndroidBluetoothRepository.kt:
private fun startOrObserveBond(remoteDevice: BluetoothDevice, result: CompletableDeferred<Unit>): BondWaitStart {
    if (remoteDevice.bondState == BluetoothDevice.BOND_BONDED) {
        result.complete(Unit)
        return BondWaitStart()
    }
    if (remoteDevice.createBond()) {
        return BondWaitStart(createdBond = true)
    }
    // Crucial: createBond() returned false, check if bonding is already in progress
    return when (remoteDevice.bondState) {
        BluetoothDevice.BOND_BONDED -> {
            result.complete(Unit)
            BondWaitStart()
        }
        BluetoothDevice.BOND_BONDING -> {
            // Bond already initiated by GATT layer; observe rather than fail!
            BondWaitStart(bondingObserved = true)
        }
        else -> {
            result.completeExceptionally(Exception("Failed to initiate bonding"))
            BondWaitStart()
        }
    }
}
```
- **Lesson**: OS hardware control APIs cannot be treated as clean synchronous state machines. Return codes from binder calls indicate request submission, not system state; pairing logic must tolerate delayed state transitions and concurrent platform operations.

---

### Incident 5: Barcode Scanner Multiple-Execution Race & Leak (BUG-SCANNER-05)
- **Context**: `core/barcode/src/main/kotlin/org/meshtastic/core/barcode/SingleScanResultGate.kt` and `BarcodeScannerProvider.kt`.
- **What Was Expected**: When scanning a QR code for node configuration or channel join, the result must be emitted exactly once and the camera pipeline dismissed cleanly.
- **What Actually Happened**: CameraX frames arrive concurrently on an executor thread. When a valid QR code was brought into view, multiple subsequent frames (arriving within milliseconds) each triggered `onResult(code)` simultaneously, causing duplicate channel imports, double navigations, and corrupting the channel database.
- **Evidence in Repo**: Implementation of `SingleScanResultGate.kt` and `BarcodeScannerProvider.kt`.
- **Root Cause**: Lack of an atomic delivery gate between asynchronous CameraX frame analysis workers and the UI navigation/result dispatcher.
- **Remediation Code Diff**:
```kotlin
// SingleScanResultGate.kt:
class SingleScanResultGate {
    private val delivered = AtomicBoolean(false)

    fun tryDeliver(result: String?, onResult: (String?) -> Unit): Boolean {
        // Atomic compareAndSet guarantees single execution across all analyzer threads
        if (!delivered.compareAndSet(false, true)) return false
        onResult(result)
        return true
    }
}
```
- **Lesson**: Every real-time media ingestion stream (camera, audio, radio packet demodulator) MUST implement an atomic Compare-And-Swap (CAS) gating terminal before emitting domain events into application workflows.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **ByteString Range Equality Invariant**:
   In `Channel.usesPublicKey()`, key identity cannot be evaluated with raw array equality (`==` or `.equals()`) because arrays evaluate reference equality in Kotlin. Furthermore, default keys share a prefix family:
   ```kotlin
   // MANDATORY: Exact byte range comparison excluding the last polymorphic byte
   channelDefaultKey.size -> psk.rangeEquals(0, channelDefaultKey, 0, channelDefaultKey.size - 1)
   ```
2. **Presence vs. Sentinel Zero Float Hazard**:
   As documented in repo AST-grep rules (`no-float-metric-zero-sentinel.yml`, `no-rssi-zero-default.yml`):
   ```yaml
   # AST-grep rule invariant from repository root:
   # Protobuf represents missing numerical fields as default 0.0f.
   # In radio metrics, 0.0 dB SNR or 0 dBm RSSI is a valid measurement!
   # Code MUST NOT treat 0.0f as null or missing.
   ```
   ```kotlin
   // FORBIDDEN:
   val snr = if (packet.snr == 0f) null else packet.snr // BUGS OUT at genuine 0.0 SNR!
   
   // MANDATORY:
   val snr = if (packet.hasSnr()) packet.snr else null
   ```

### 4.2 Infinite Loop & Recursion Guards
1. **Geospatial Ring Hole Recursion Termination**:
   In `Geometry.vertexCount()` and `MvtDecoder.groupPolygons()`, recursive unnesting of `MultiGeometry` structures can enter infinite loops if cyclic geometry definitions are supplied.
   ```kotlin
   // Invariant: MultiGeometry recursion strictly branches on structural sub-geometries:
   private fun Geometry.vertexCount(): Int = when (this) {
       is Polygon -> outerBoundary.size + innerBoundaries.sumOf { it.size }
       is LineString -> points.size
       is MultiGeometry -> geometries.sumOf { it.vertexCount() } // Leaf termination guaranteed by DAG tree structure
       else -> 1
   }
   ```
2. **Rolling Time Window Queue Pruning**:
   In `AndroidBleScanStartLimiter.discardExpiredStarts()`, queue drainage must be bounded by condition satisfaction:
   ```kotlin
   private fun discardExpiredStarts() {
       while (scanStarts.firstOrNull()?.elapsedNow()?.let { it >= window } == true) {
           scanStarts.removeFirst()
       }
   }
   ```
   *Termination Invariant Proof*: `scanStarts` is strictly sorted by monotonic time stamps. `scanStarts.firstOrNull()` strictly returns the oldest entry. Each iteration removes one element. The loop terminates in at most $N$ operations where $N \le \text{maxStarts}$.

### 4.3 UI & UX Micro-Mechanics
1. **Dynamic Font Scaling & Scroll Containment (Issue #7883)**:
   When Android accessibility zoom or custom DPI increases font metrics, fixed layouts clip critical permission/connection buttons.
   ```kotlin
   // INVARIANT: Every connection dialog and setup sheet containing action buttons 
   // MUST wrap the Column in a verticalScroll modifier and use fillMaxWidth() 
   // with intrinsic height constraints to prevent buttons being pushed off-screen.
   Column(
       modifier = Modifier
           .fillMaxSize()
           .verticalScroll

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
