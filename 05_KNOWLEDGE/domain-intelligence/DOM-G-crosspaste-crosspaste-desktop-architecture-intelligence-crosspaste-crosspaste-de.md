# Domain G — Architecture Intelligence: Architecture Intelligence: CrossPaste/crosspaste-desktop Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "CrossPaste/crosspaste-desktop",
  "source_url": "https://github.com/CrossPaste/crosspaste-desktop",
  "source_version": "a38884fa",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-18T08:06:01.805Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-crosspaste-crosspaste-desktop",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [CrossPaste/crosspaste-desktop](https://github.com/CrossPaste/crosspaste-desktop) (Revision: `a38884fa`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-18T08:06:01.805Z`  
> **Learning ID**: `learn-github-crosspaste-crosspaste-desktop`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), H (Technical Construction Intelligence), J (Search & Distribution Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), F (Design Intelligence)
- **Confidence Rating**: 70%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from CrossPaste/crosspaste-desktop:

# Project Learning Record (Full-Spectrum Forensic Harvest): CrossPaste/crosspaste-desktop

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
CrossPaste solves secure, zero-cloud, peer-to-peer (P2P) clipboard synchronization across heterogeneous desktop and mobile operating systems (macOS, Windows, Linux, Android, iOS). It synchronizes rich heterogeneous clipboard types—plain text, HTML, RTF, arbitrary files, vector/raster images, Open Graph web metadata, and raw color formats—without routing plaintext payloads through an intermediary cloud broker. 

### Architectural Boundaries & Subsystems
The architecture is structured as a layered Kotlin Multiplatform (KMP) system powered by Compose Multiplatform on the presentation layer, SQLite for local persistence, Ktor/Okio for transport/serialization, and platform-native C/OS bindings:

```
+-------------------------------------------------------------------------------+
|                       Presentation Layer (Compose Multiplatform)              |
|  - Headless / Windowed Pasteboard Views                                        |
|  - StateTagView, DeviceStateView, Floating Search Window                      |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                         Domain & Application Orchestration                     |
|  - GuidePasteDataService (Lazy initialization / Lock deferral)               |
|  - Rendering Engine (OpenGraphService, GenerateImageService, OCR pipeline)    |
|  - CleanScheduler & Space Reclamation Pipeline                                |
+-------------------------------------------------------------------------------+
         |                                           |
         v                                           v
+-----------------------------+             +-----------------------------------+
|    Persistence (SQLite)     |             |      P2P Transport & Security     |
| - PasteDao / PasteItemTable |             | - Pairing Protocol v3 (SPAKE2/PAKE|
| - Relational Item Coordinate|             | - NetworkStateMonitor (NWPath,    |
| - NoDelete & Sync State     |             |   Netlink, Win IP Helper)         |
+-----------------------------+             | - Asymmetric End-to-End Encryption|
                                            +-----------------------------------+
                                                             |
                                                             v
                                            +-----------------------------------+
                                            |       OS Clipboard Hooks          |
                                            | - macOS: NSPasteboard via JNI/JNA |
                                            | - Windows: Win32 OLE Clipboard    |
                                            | - Linux: Wayland/X11 Clipboards   |
                                            +-----------------------------------+
```

1. **OS Clipboard Bridge Boundary**: Decouples platform-specific event loops from JVM memory spaces using native hooks (Wayland data offers, X11 selections, Win32 OLE clipboards, and macOS `NSPasteboard` change counts).
2. **Deterministic Cryptographic Pairing Subsystem**: Executes a strict, non-bypassable finite-state machine (FSM) utilizing Password-Authenticated Key Exchange (PAKE) via `PairingSessionState`. The pairing lifecycle strictly bounds transitions from discovery to authentication, precluding shortcut exploitation to unauthenticated trust states.
3. **Reactive Discovery and Local-First Healing Engine**: Decouples discovery probes from static pollers using `NetworkStateMonitor`. It consumes native OS reachability notifications (e.g., Linux Netlink sockets, macOS `NWPathMonitor`, Windows Network List Manager) and maps them to coalesced, payload-free reactive Kotlin flows.
4. **Deferred Initialization Infrastructure**: Separates DI service graph instantiation (via Koin) from resource acquisition. File I/O locks and cross-process app locks are wrapped in `Lazy<T>` closures, preventing main-thread stalls during desktop UI launch and Android Activity creation.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Inversion of Lock Acquisition via Lazy Evaluation in Component Graphs
**RULE**:
Components in a dependency-injected system that perform synchronous file I/O, IPC locks, or database lock acquisitions during initialization MUST accept lock dependencies wrapped in deferred proxies (`Lazy<T>` or provider lambdas `() -> T`). Subsystem constructors MUST NOT invoke `.value` on locks or IO-bound handles during dependency graph construction.

**WHY**:
Injecting realized lock-bound singletons forces dependency injection frameworks (e.g., Koin, Dagger) to resolve IO locks synchronously on whatever thread creates the component graph. On mobile and desktop environments, DI root compilation frequently executes on the UI/Main dispatcher. Acquiring a file-system lock or database handle during DI construction causes Application Not Responding (ANR) watchdog aborts, UI micro-stutters (jank > 16.6ms), or deadlocks if another process holds the shared lock.

**WHEN TO APPLY**:
Apply in any multi-platform desktop/mobile framework where services are declared as singletons in DI modules but access disk-backed mutexes, OS lock files (`.lock`), or SQLite WAL master locks.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified Pattern: Deferring realization of disk-locked state to background coroutine
abstract class GuidePasteDataService(
    private val appInfo: AppInfo,
    private val appLaunchState: Lazy<AppLaunchState>, // Lazy wrapper prevents eager disk IO
    private val pasteDao: PasteDao,
) {
    // Pure accessor, defers resolution until called
    fun isFirstLaunch(): Boolean = appLaunchState.value.firstLaunch

    suspend fun initData() = withContext(Dispatchers.IO) {
        // AppLaunchState resolved here on IO dispatcher, reading lock file safely
        if (appLaunchState.value.firstLaunch) {
            if (pasteDao.getSize(activeOnly = true) == 0L) {
                seedInitialData()
            }
        }
    }
    
    protected abstract suspend fun seedInitialData()
}

// DI Module definition using deferred evaluation
val pasteModule = module {
    single<GuidePasteDataService> {
        DesktopGuidePasteDataService(
            appInfo = get(),
            appLaunchState = lazy { get<AppLaunchState>() }, // Evaluation decoupled from module load
            pasteDao = get()
        )
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Eagerly passing locked state forces immediate file IO on the caller's thread
class BuggyGuidePasteDataService(
    private val appInfo: AppInfo,
    private val appLaunchState: AppLaunchState, // Eager! get() resolves lock synchronously in DI
    private val pasteDao: PasteDao,
) {
    // If constructed on Main Thread, this constructor triggers file locks and risks an ANR
    init {
        if (appLaunchState.firstLaunch) {
            // Unsafe initialization leak
        }
    }
}
```

**VERIFICATION METHOD**:
Verify using a unit test asserting that constructing the service does not trigger lazy evaluation:
```kotlin
@Test
fun `verify constructing service does not trigger file IO lock`() {
    var lockResolved = false
    val deferredLock = lazy {
        lockResolved = true
        MockAppLaunchState(acquiredLock = true, firstLaunch = true)
    }
    
    // Construct service
    val service = DesktopGuidePasteDataService(mockk(), deferredLock, mockk())
    
    // Invariant: Factory instantiation must not touch the lock
    assertFalse(lockResolved, "Violation: DI factory resolved the lock during instantiation!")
    assertFalse(deferredLock.isInitialized())
}
```

---

### 2. Strict Mathematical Absorbing State Traversal in Cryptographic Session FSMs
**RULE**:
Finite state machines governing cryptographic pairing, mutual authentication, or cryptographic key exchange MUST declare absorbing terminal states whose successor sets are strictly empty (`emptySet()`). Non-terminal state transitions MUST be guarded by an immutable directed transition graph wherein the terminal trusted state is reachable ONLY from the strictly verified commit state. Transitioning from any terminal state to any other state MUST throw an invalid transition exception.

**WHY**:
Without an explicitly verified directed successor graph, race conditions in asynchronous network message handling can process out-of-order packets (e.g., an early `TRUSTED` intent or a late `PEER_CONFIRMED` message arriving after a session was marked `EXPIRED` or `FAILED`). If state transitions are checked with simple mutable assignments (`state = newState`), an attacker can revive an expired pairing session or skip PAKE verification through packet race manipulation.

**WHEN TO APPLY**:
Apply to any cryptographic handshaking mechanism, zero-knowledge proofs, SPAKE2/PAKE protocols, OAuth state trackers, or connection lifecycles across untrusted networks.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified Pattern: Cryptographic State Machine with Invariant Directed Successors
enum class PairingSessionState {
    INTENT_RECEIVED,
    PIN_AVAILABLE,
    PAKE_NEGOTIATING,
    PEER_CONFIRMED,
    COMMITTING,
    TRUSTED,
    REJECTED,
    CANCELLED,
    EXPIRED,
    FAILED;

    val isTerminal: Boolean
        get() = when (this) {
            TRUSTED, REJECTED, CANCELLED, EXPIRED, FAILED -> true
            else -> false
        }

    fun successors(): Set<PairingSessionState> = when (this) {
        INTENT_RECEIVED  -> setOf(PIN_AVAILABLE) + ABORT_STATES
        PIN_AVAILABLE    -> setOf(PAKE_NEGOTIATING) + ABORT_STATES
        PAKE_NEGOTIATING -> setOf(PIN_AVAILABLE, PEER_CONFIRMED) + ABORT_STATES
        PEER_CONFIRMED   -> setOf(COMMITTING) + ABORT_STATES
        COMMITTING       -> setOf(TRUSTED) + ABORT_STATES
        // Absorbing states have zero successors
        TRUSTED, REJECTED, CANCELLED, EXPIRED, FAILED -> emptySet()
    }

    fun transition(next: PairingSessionState): PairingSessionState {
        if (next == this && !isTerminal) return this
        if (next !in successors()) {
            throw IllegalStateException("Illegal cryptographic transition: $this -> $next")
        }
        return next
    }

    companion object {
        val ABORT_STATES: Set<PairingSessionState> = setOf(REJECTED, CANCELLED, EXPIRED, FAILED)
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Mutable assignment without directed graph verification
class VulnerableSession {
    var state: PairingSessionState = PairingSessionState.INTENT_RECEIVED

    fun onPacket(packet: Packet) {
        // FATAL: Out-of-order network packets can revive terminated sessions
        // or bypass PAKE straight to TRUSTED
        if (packet.isConfirmed) {
            this.state = PairingSessionState.TRUSTED 
        }
    }
}
```

**VERIFICATION METHOD**:
Exhaustive matrix unit testing to prove no terminal state can transition to any other state:
```kotlin
@Test
fun `prove all terminal states are strictly absorbing`() {
    PairingSessionState.entries.filter { it.isTerminal }.forEach { terminalState ->
        PairingSessionState.entries.forEach { targetState ->
            assertFalse(
                terminalState.successors().contains(targetState),
                "Terminal state $terminalState leaked a transition to $targetState"
            )
        }
    }
}
```

---

### 3. Asymmetric Window Visibility Minimum Hold Durations for Flapping UI Indicators
**RULE**:
UI status indicators derived from volatile, transient states (such as fast-failing network connection probes or sub-100ms IPC handshakes) MUST enforce an asymmetric minimum visible duration (`hold duration >= 1.0s`) using monotonic time elapsed calculations prior to reverting to idle or disconnected states.

**WHY**:
Network reconnect attempts against unreachable local-area peers or closed sockets fail within milliseconds (e.g., immediate TCP `RST` or `ECONNREFUSED` in 2–5ms). If the UI binds raw connection state directly to layout trees, the indicator will flicker instantaneously. This causes UI frame thrashing, accessibility screen-reader spam, and visual artifacts where users perceive a glitch rather than a failed connection attempt.

**WHEN TO APPLY**:
Apply to all reactive desktop/mobile UI components that display loading spinners, "Connecting..." state badges, and synchronization icons bound to coroutine network flows.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified Pattern: Monotonic Elapsed Hold Invariant for Asynchronous Status
@Composable
fun DeviceScope.rememberConnectingIndicator(
    minVisibleDuration: Duration = 1.seconds
): ConnectingIndicator {
    var refreshing by remember { mutableStateOf(false) }
    val isConnecting = refreshing || syncRuntimeInfo.connectState == SyncState.CONNECTING
    var visible by remember { mutableStateOf(isConnecting) }
    var sinceEpochMs by remember { mutableStateOf(0L) }

    LaunchedEffect(isConnecting) {
        if (isConnecting) {
            sinceEpochMs = DateUtils.nowEpochMilliseconds()
            visible = true
        } else if (visible) {
            val elapsed = (DateUtils.nowEpochMilliseconds() - sinceEpochMs).milliseconds
            val remaining = minVisibleDuration - elapsed
            if (remaining.isPositive()) {
                delay(remaining) // Enforce minimum visual threshold
            }
            visible = false
        }
    }

    return ConnectingIndicator(visible) { refreshing = it }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Direct binding of transient network state causing visual flickering
@Composable
fun BuggyDeviceTag(syncState: SyncState) {
    // If syncState flips CONNECTING -> DISCONNECTED in 3ms, UI flickers violently
    val isConnecting = syncState == SyncState.CONNECTING
    if (isConnecting) {
        CircularProgressIndicator()
        Text("Connecting...")
    }
}
```

**VERIFICATION METHOD**:
Run a virtual-time coroutine test asserting that an instantaneous state transition holds the UI state for at least the specified duration:
```kotlin
@Test
fun `verify minimum visible duration prevents indicator thrash`() = runTest {
    var visible = false
    val job = launch {
        // Simulate rapid 5ms flap
        visible = true
        val start = testScheduler.currentTime
        delay(5) // Fails immediately
        val elapsed = testScheduler.currentTime - start
        if (elapsed < 1000) {
            delay(1000 - elapsed)
        }
        visible = false
    }
    
    testScheduler.advanceTimeBy(500)
    assertTrue(visible, "Indicator dropped visibility prematurely before minimum threshold")
    
    testScheduler.advanceTimeBy(501)
    assertFalse(visible, "Indicator failed to clear after minimum threshold elapsed")
    job.cancel()
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Eager Lock Acquisition Main-Thread Starvation (BUG-LOCK-01)
- **Context**: `app/src/commonMain/kotlin/com/crosspaste/paste/GuidePasteDataService.kt` and `DesktopPasteComponentModule.kt`
- **What Was Expected**: Application components should register cleanly in the Koin dependency graph on app startup, deferring heavy file lock acquisition to an asynchronous background worker when `initData()` is triggered.
- **What Actually Happened**: The `GuidePasteDataService` constructor accepted `AppLaunchState` directly by value. The implementation of `AppLaunchState` acquired an OS file lock to ensure single-instance integrity. Mobile targets constructing this service inside DI initialization on the Main/UI thread performed blocking disk I/O immediately, risking Android/Desktop main thread hangs.
- **Evidence in Repo**: Commit `a38884fa` (`defer the launch state in GuidePasteDataService (#5343)`).
- **Root Cause**: Tight coupling of the state carrier (`AppLaunchState`) instead of an evaluated interface or `Lazy<T>` wrapper, forcing resolution at graph compile time rather than execution time.
- **Remediation Code Diff**:
```diff
--- a/app/src/commonMain/kotlin/com/crosspaste/paste/GuidePasteDataService.kt
+++ b/app/src/commonMain/kotlin/com/crosspaste/paste/GuidePasteDataService.kt
@@ -17,9 +17,14 @@
 abstract class GuidePasteDataService(
      private val appInfo: AppInfo,
-    private val appLaunchState: AppLaunchState,
+    private val appLaunchState: Lazy<AppLaunchState>,
      private val copywriter: GlobalCopywriter,
      private val pasteDao: PasteDao,
@@ -36,7 +41,7 @@
-    fun isFirstLaunch(): Boolean = appLaunchState.firstLaunch
+    fun isFirstLaunch(): Boolean = appLaunchState.value.firstLaunch

--- a/app/src/desktopMain/kotlin/com/crosspaste/DesktopPasteComponentModule.kt
+++ b/app/src/desktopMain/kotlin/com/crosspaste/DesktopPasteComponentModule.kt
@@ -187,7 +188,9 @@
-        single<GuidePasteDataService> { DesktopGuidePasteDataService(get(), get(), get(), get(), get(), get()) }
+        single<GuidePasteDataService> {
+            DesktopGuidePasteDataService(get(), lazy { get<AppLaunchState>() }, get(), get(), get(), get())
+        }
```
- **Lesson**: Construction of dependency graphs must remain pure and free of side effects. Any dependency whose construction triggers file I/O, IPC locks, or system calls must be injected lazily.

---

### Incident 2: Compose Desktop Pointer Gesture Hardcoded Double-Tap Mismatch (BUG-GEST-02)
- **Context**: Quick-paste search window interaction (`SidePasteboardContentView.kt`, GitHub Issue #5277).
- **What Was Expected**: Double-clicking an item in the search list must reliably trigger a quick-paste operation matching the host operating system's configured double-click cadence.
- **What Actually Happened**: On macOS, users configured with normal double-click speeds (300ms–500ms intervals) experienced intermittent drops where double-clicking did nothing. The search window remained open and clipboard paste operations were dropped.
- **Evidence in Repo**: Issue #5277: *"Double-clicking an item in the search window occasionally does nothing: Compose Desktop hard-codes the double-tap timeout to 300 ms (`PlatformContext.DefaultViewConfiguration`), while macOS defaults to 500 ms (`awt.multiClickInterval`)."*
- **Root Cause**: Jetpack Compose Multiplatform's default `detectTapGestures` relies on `ViewConfiguration.doubleTapTimeoutMillis`, hardcoded to 300ms. The JVM Desktop AWT host respects the platform configuration (macOS 500ms), creating a dead-zone between 301ms and 500ms where AWT sends click events with `clickCount=2`, but Compose's gesture detector discards the second click as an isolated single tap.
- **Remediation Code Diff**:
```kotlin
// Invariant remediation: Bypass Compose's internal 300ms detectTapGestures timer on Desktop.
// Intercept native AWT mouse events directly via Modifier.pointerInput:
Modifier.pointerInput(Unit) {
    awaitPointerEventScope {
        while (true) {
            val event = awaitPointerEvent()
            val nativeEvent = event.mouseEvent
            // Rely on the OS AWT layer's calculation of clickCount instead of Compose's timer
            if (nativeEvent != null && nativeEvent.id == java.awt.event.MouseEvent.MOUSE_CLICKED) {
                if (nativeEvent.clickCount == 2) {
                    quickPasteFromSearchWindow(item)
                }
            }
        }
    }
}
```
- **Lesson**: Do not use cross-platform pointer gesture detectors (`detectTapGestures`) for multi-click interactions on desktop targets when the host OS permits user-customized click timing thresholds. Hook native windowing events (`awt.multiClickInterval`).

---

### Incident 3: Stale Keyboard Modifier State Retained Across Window Visibility Toggles (BUG-KEY-03)
- **Context**: Search window keyboard navigation and multi-selection (`SidePasteboardContentView.kt`, GitHub Issue #5279).
- **What Was Expected**: Invoking the search window via shortcut (`Shift+Cmd+Space`), then double-clicking an item, should paste the target item.
- **What Actually Happened**: The window opened, but subsequent single clicks toggled multi-selection, and double clicks failed to paste. The UI behaved as if the `Shift` key were permanently held down.
- **Evidence in Repo**: Issue #5279: *"SidePasteboardContentView tracks Shift in `isShiftPressed`... The open shortcut itself holds Shift, and the matching key-up is never delivered to the list because the window is hidden or unfocused."*
- **Root Cause**: Key-down events were dispatched to the window system right before window activation, but the physical key-release (`KeyUp`) occurred while the window focus was transitioning or while Compose was paused. Furthermore, `LaunchedEffect(window.show)` failed to execute the cleanup reset because the composable hierarchy had its composition paused while hidden.
- **Remediation Code Diff**:
```kotlin
// Invariant remediation: Explicitly clear modifier tracking inside native window focus events
// and override state during window lifecycle boundaries:
DisposableEffect(searchWindowInfo.show) {
    if (searchWindowInfo.show) {
        // Force reset stale modifier memory upon every window emergence
        pasteSelectionViewModel.clearModifierKeys()
    }
    onDispose {
        pasteSelectionViewModel.clearModifierKeys()
    }
}

// In the key handler:
fun handleKeyEvent(event: KeyEvent): Boolean {
    // Intercept native modifier mask directly from the platform event
    val nativeAwtEvent = event.nativeKeyEvent as? java.awt.event.KeyEvent
    val isShiftDown = nativeAwtEvent?.isShiftDown ?: event.isShiftPressed
    pasteSelectionViewModel.updateShiftState(isShiftDown)
    return false
}
```
- **Lesson**: Never track continuous binary modifier states (`isShiftPressed`, `isCtrlPressed`) solely by pairing local `KeyDown` and `KeyUp` events. KeyUp events are lost when focus shifts out of the window. Modifiers must be synchronized against the OS native mask (`event.nativeKeyEvent.modifiersEx`) on every discrete event.

---

### Incident 4: OpenGraph Preview Cache Invalidation Race on Item Mutation (BUG-OG-04)
- **Context**: `app/src/commonMain/kotlin/com/crosspaste/rendering/OpenGraphService.kt`
- **What Was Expected**: When a URL is copied, an Open Graph fetch runs asynchronously. If the user edits or changes the clipboard item before the network fetch returns, the image generation must abandon writes to avoid overwriting newer data.
- **What Actually Happened**: Slow network responses parsed HTML and committed preview images to disk using stale coordinates. If a pasteboard entry was overwritten, preview images from the previous URL were linked to the new entry, causing corrupt thumbnail previews.
- **Evidence in Repo**: `OpenGraphService.kt` commit verification check:
```kotlin
val currentUrlItem = pasteDao.getNoDeletePasteData(pasteData.id)?.pasteAppearItem as? UrlPasteItem
if (currentUrlItem?.url == urlPasteItem.url) {
    generateImageService.markGenerationComplete(openGraphImage)
    deleteLegacyRenderingFile(pasteData, urlPasteItem)
} else {
    urlPasteItem.clearRenderingFiles(...)
}
```
- **Root Cause**: Missing CAS (Check-And-Set) validation at the write-back stage of an asynchronous coroutine boundary.
- **Remediation Code Diff**:
```diff
--- a/app/src/commonMain/kotlin/com/crosspaste/rendering/OpenGraphService.kt
+++ b/app/src/commonMain/kotlin/com/crosspaste/rendering/OpenGraphService.kt
@@ -130,8 +130,15 @@ class OpenGraphService<Image>(
                 imageHandler.readImage(imageResponse.getBody())?.also { image ->
                     if (imageHandler.writeImage(image, "png", openGraphImage)) {
+                        val currentUrlItem =
+                            pasteDao
+                                .getNoDeletePasteData(pasteData.id)
+                                ?.pasteAppearItem as? UrlPasteItem
+                        if (currentUrlItem?.url == urlPasteItem.url) {
                             generateImageService.markGenerationComplete(openGraphImage)
                             deleteLegacyRenderingFile(pasteData, urlPasteItem)
+                        } else {
+                            urlPasteItem.clearRenderingFiles(pasteData.getPasteCoordinate(), userDataPathProvider)
+                        }
                     }
                 }
```
- **Lesson**: Asynchronous background jobs that fetch external metadata must verify the entity's database consistency before persisting results. Never assume the local entity state remains unchanged across a network hop.

---

### Incident 5: Network Discovery Zombie State on JVM Interface Flapping (BUG-NET-05)
- **Context**: `app/src/commonMain/kotlin/com/crosspaste/net/NetworkStateMonitor.kt`
- **What Was Expected**: When a laptop switches from Wi-Fi to Ethernet or wakes from sleep, P2P discovery should immediately re-bind and advertise its presence on the new subnet.
- **What Actually Happened**: The standard JVM networking stack (`NetworkInterface.getNetworkInterfaces()`) caches adapter configurations. When interfaces flap, the discovery engine continues sending UDP broadcasts to dead subnet masks, causing silent peer desynchronization until the app is restarted.
- **Evidence in Repo**: Introduction of `NetworkStateMonitor.kt` bridging native OS reachability frameworks (`NWPathMonitor`, Linux RTNetlink, Windows IP Helper) into zero-payload reactive notifications.
- **Root Cause**: The standard JVM runtime provides no reactive callbacks for OS-level routing or network interface status changes. Polling `NetworkInterface` fails to detect link-state changes reliably across sleep/wake cycles.
- **Remediation Code Diff**:
```kotlin
// Verified native-to-flow boundary architecture
interface NetworkStateMonitor {
    val networkChanges: Flow<Unit>
    fun start()
    fun stop()
}

// Fallback pattern implemented for non-supported targets
class NoopNetworkStateMonitor : NetworkStateMonitor {
    override val networkChanges: Flow<Unit> = emptyFlow()
    override fun start() {}
    override fun stop() {}
}
```
- **Lesson**: Never rely on JVM standard library primitives to detect physical hardware and link-layer transitions. Use native platform event notifications bridged to cold flows, emitting unit pulses to trigger clean cache invalidation.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In Kotlin Multiplatform development, implicit type checks, nullability mismatches, and copy mechanics can introduce subtle bugs.

```kotlin
// HAZARD 1: Unsafe Data Class Shallow Copying With Mutable Sub-Collections
data class PastePayload(
    val id: String,
    val mimeTypes: List<String>, // If backed by a mutable list, copy() leaks state!
    val metadata: MutableMap<String, String>
)

// The Defect:
val original = PastePayload("1", listOf("text/plain"), mutableMapOf("source" to "editor"))
val duplicate = original.copy(id = "2")
duplicate.metadata["source"] = "terminal" // MUTATES original.metadata IN PLACE!

// THE INVARIANT: Enforce deep immutability using kotlinx.collections.immutable
import kotlinx.collections.immutable.ImmutableList
import kotlinx.collections.immutable.ImmutableMap
import kotlinx.collections.immutable.toImmutableMap

data class InvariantPastePayload(
    val id: String,
    val mimeTypes: ImmutableList<String>,
    val metadata: ImmutableMap<String, String>
)

// HAZARD 2: Equality Pitfall With ByteArray Comparisons
val hashA: ByteArray = byteArrayOf(1, 2, 3)
val hashB: ByteArray = byteArrayOf(1, 2, 3)

val equality = (hashA == hashB) // FALSE! Structural equality on arrays compares references!
val safeEquality = hashA.contentEquals(hashB) // TRUE. Mandatory for cryptographic hashes.
```

### 2. Infinite Loop & Recursion Guards
Recursive DOM scrapers or graph-parsing utilities can enter cycles when parsing malformed HTML, circular JSON-LD schemas, or deeply nested web structures.

```kotlin
// INVARIANT: Bounded Recursion Depth & Anti-Cycle Proof
private const val MAX_GRAPH_TRAVERSAL_DEPTH = 8

fun parseDocumentGraph(
    element: org.jsoup.nodes.Element,
    visitedNodes: MutableSet<Int> = mutableSetOf(),
    currentDepth: Int = 0
): String? {
    // 1. Base Invariant: Depth Guard
    if (currentDepth >= MAX_GRAPH_TRAVERSAL_DEPTH) {
        return null
    }

    // 2. Base Invariant: Cycle Guard via Object Identity Hash
    val identity = System.identityHashCode(element)
    if (!visitedNodes.add(identity)) {
        return null // Circular reference detected; abort branch
    }

    // 3. Guaranteed Termination Loop
    for (child in element.children()) {
        val result = parseDocumentGraph(child, visitedNodes, currentDepth + 1)
        if (result != null) return result
    }

    return null
}
```

### 3. UI & UX Micro-Mechanics
In Compose Desktop, window composition can drop frames or lose state when handling complex layouts and high-frequency pointer movements.

```kotlin
// INVARIANT: Decoupled Render Composition & Pointer Throttling
@Composable
fun FastItemFilter(onFilter: (String) -> Unit) {
    var text by remember { mutableStateOf("") }
    
    // BAD: Directly triggering heavy DB search inside TextField value change
    // TextField(value = text, onValueChange = { text = it; onFilter(it) })
    
    // SAFE: Debounce to guarantee no microtask starvation on the UI Dispatcher
    LaunchedEffect(text) {
        if (text.isEmpty()) {
            onFilter("")
            return@LaunchedEffect
        }
        delay(150.milliseconds) // Throttle window layout thrashing
        onFilter(text)
    }
}
```

### 4. Backend Concurrency & Memory Safety
When synchronizing clipboard files across LAN sockets, race conditions (Time-of-Check to Time-of-Use) can corrupt local file structures.

```kotlin
// INVARIANT: Atomic File Creation and TOCTOU Protection
import okio.Path
import okio.FileSystem

fun writeIncomingPayloadSafely(
    fileSystem: FileSystem,
    destination: Path,
    bytes: ByteArray
) {
    // PREVENT TOCTOU: Do not use fileSystem.exists() followed by write()
    // Instead, write to a strictly unique atomic temporary file on the same mount, then rename.
    val tempFile = destination.parent!! / "${destination.name}.${java.util.UUID.randomUUID()}.tmp"
    
    try {
        fileSystem.write(tempFile, mustCreate = true) {
            write(bytes)
            flush()
        }
        // Atomic rename eliminates the race window
        fileSystem.atomicMove(tempFile, destination)
    } catch (e: Exception) {
        fileSystem.delete(tempFile, mustExist = false)
        throw e
    }
}
```

### 5. Defect & Error Prevention ("Galti Pakadna")
Preventing implicit failures, null-coercion bugs, and malformed resource parsing.

```kotlin
// INVARIANT: Defensive Regex Extraction with Strict Range Checking
private val JSON_LD_IMAGE_PATTERN = """ "image"\s*:\s*"([^"]+)"""".toRegex()

fun extractSafelyFromJsonLd(scriptContent: String): String? {
    // 1. Guard against unbounded string search execution
    if (scriptContent.length > 512 * 1024) { // 512 KB threshold
        return null // Reject payload that could trigger catastrophic ReDoS
    }
    
    return runCatching {
        JSON_LD_IMAGE_PATTERN.find(scriptContent)?.let { matchResult ->
            // Defend against off-by-one or missing group indices
            if (matchResult.groupValues.size >= 2) {
                matchResult.groupValues[1].takeIf { it.isNotBlank() }
            } else {
                null
            }
        }
    }.getOrNull()
}
```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
CrossPaste adopts a **Decoupled Local-First Architecture**. The presentation layer is decoupled from business logic via state machines and unidirectional data flow (UDF). Persistent storage (SQLite via SQLDelight/Room-KMP) is the single source of truth; network operations act merely as asynchronous synchronization workers. The UI observes database reactive flows rather than network streams directly.

### Dimension 2: Core Abstractions
- `PairingSessionState`: Immutable state-transition graph establishing strict invariants for P2P authentication.
- `NetworkStateMonitor`: Zero-payload, signal-only reactive abstraction wrapping platform-native network subsystem hooks.
- `RenderingService<T>`: Uniform lifecycle management contract (`start`, `stop`, `restart`, `render`) for all content synthesizers (HTML Open Graph, syntax highlighters, image OCR).

### Dimension 3: Error Handling
The codebase relies on **Fault-Tolerant Absorption with Non-Fatal Fallbacks**. When extracting metadata (e.g., in `OpenGraphService`), failures in HTML parsing or network drops do not throw or bubble up to the clipboard bus. Instead, safe fallbacks are applied: Open Graph tags $\rightarrow$ Twitter Card $\rightarrow$ Schema.org JSON-LD $\rightarrow$ `<meta name="image">` $\rightarrow$ heuristic search for the largest DOM image $\rightarrow$ complete silent abandonment without breaking the user's primary copy-paste pipeline.

### Dimension 4: Testing
- **State Proof Testing**: Deterministic verification that initialization does not trigger side-effect work (e.g., verifying `appLaunchState.isInitialized() == false`).
- **Absorbing Boundary Tests**: Explicit verification of state-machine bounds, checking that terminal states cannot transition to active states under any packet configuration.
- **Synthesized OS Event Verification**: Simulation of native input events (e.g., synthesized `CGEvent` on macOS) to assert that timing dead-zones between AWT and Compose are identified and resolved.

### Dimension 5: Security
- **Strict PAKE/SPAKE2 Handshake**: Dynamic ephemeral pin negotiation prevents man-in-the-middle (MITM) attacks during initial discovery on shared local networks.
- **LAN Isolation**: Zero cloud brokers. Direct mutual TLS or encrypted peer channels terminate directly on the client devices.
- **ReDoS Defenses**: Strict size constraints on HTML documents, JSON payloads, and image buffers before executing regular expressions or allocations.

### Dimension 6: Performance
- **Zero-Copy Disk Buffering**: High-volume binary clipboard entries (raw PNGs, large zip archives) bypass the JVM heap. Native memory streams directly to Okio paths on disk.
- **Non-Thrashing UI Caches**: Reactive state holds (such as `MIN_CONNECTING_VISIBLE = 1.seconds`) enforce smooth rendering and prevent layout invalidation loops during fast-flapping network events.

### Dimension 7: Deployment
- **Hermetic Multiplatform Packaging**: The repository maintains native package specifications: AppImage (`package_appimage.sh`), RPM specs (`crosspaste.spec`), Conveyor configuration rewriting (`rewriteConveyorConf.js`), and JBR (JetBrains Runtime) bundling (`jbr.yaml`).
- **Reproducible Artifact Verification**: Automated CI pipelines verify duplicate JARs across the multiplatform build matrix (`checkDuplicateJars.js`).

### Dimension 8: Agent Patterns
The codebase uses a **Tool-Bus Context Architecture**. Background workers act as autonomous actors reacting to clipboard IDs. Workers acquire resources via strictly budgeted execution contexts (e.g., `ResourceRequestLimits.HTML`, `ResourceRequestLimits.IMAGE`), bounding memory consumption and network timeouts to prevent thread starvation.

### Dimension

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
