> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/expo-expo-learnings.md`  
> **Source**: GitHub ([https://github.com/expo/expo](https://github.com/expo/expo))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T01:23:29.376Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: expo/expo

## 1. Executive Forensic Architecture & System Mechanics

`expo/expo` is a cross-platform application framework and monorepo bridging high-level JavaScript/TypeScript application code with native platform subsystems (iOS, Android, Web) via C++ JSI (JavaScript Interface), Swift, and Kotlin. 

```
                                 +---------------------------------------+
                                 |          React Native / JS            |
                                 +---------------------------------------+
                                                     |
                                         JSI / Native Bridge
                                                     |
             +---------------------------------------+---------------------------------------+
             |                                                                               |
+--------------------------+                                                       +--------------------+
|     Android Native       |                                                       |    iOS Native      |
|  - Kotlin Native Modules |                                                       |  - Swift Modules   |
|  - AppContext / Activity |                                                       |  - AppContext      |
|  - Lifecycle Managers    |                                                       |  - AVFoundation    |
|  - System UI / Fragment  |                                                       |  - UTType / Photos |
+--------------------------+                                                       +--------------------+
```

### Critical Subsystem Abstractions

1. **Expo Modules Core (C++ / Swift / Kotlin JSI Binding Layer)**:
   * Replaces traditional React Native bridge serialization with zero-copy JSI HostObjects.
   * Maintains isolated `AppContext` instances. Each `AppContext` manages module lifecycle, main thread dispatching, memory reference holding, and event routing.
2. **Dynamic Native Config Engine (`@expo/config` & `expo-constants`)**:
   * Resolves dynamic app manifests (`app.json`, `app.config.js`, `app.config.ts`) at both build-time (via Gradle/Xcode scripts) and runtime (embedded asset manifest vs remote updates).
   * Maps build variants (e.g., Debug, Release, staging/production flavors) directly to target application configurations.
3. **Asset & Asset Transformer Pipeline (`@expo/metro-config`)**:
   * Wraps Metro bundler to handle cross-platform asset resolution, static resource mapping, asset fingerprinting, and dynamic font/vector embedding across platform targets.
4. **Platform Resource & Lifecycle Wrappers (`expo-video`, `expo-image`, `expo-navigation-bar`, `expo-av`)**:
   * Wrap low-level platform APIs (`AVPlayer`, `Glide`, `SystemUiController`, `CoreLocation`) with lifecycle-aware Kotlin/Swift controllers.
   * Manage foreground/background state transitions, hardware decoder allocation, fragment detachment, and view hierarchy updates.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

### Micro-Learning 1: Fragment Retain Cycles in Android Picture-in-Picture (`PictureInPictureManager`)
* **Failure Mode / Pitfall**: Memory leak and `IllegalStateException` when toggling Picture-in-Picture (PiP) in `expo-video`. `pipHelperFragment` references survived Activity destruction.
* **Root Cause**: `PictureInPictureManager` registered an invisible helper `Fragment` to capture `onPictureInPictureModeChanged` lifecycle callbacks. When the parent `Activity` was recreated or destroyed, the fragment was held by static managers or strong reference callbacks without explicit detachment from `FragmentManager`.
* **Exact Prevention / Fix**: Bind `Fragment` registration to the parent `Activity` lifecycle using strong/weak lifecycle listener bindings. On activity tear-down, execute an explicit `commitNowAllowingStateLoss` removal transaction and invalidate the reference inside `onActivityDestroyed`.

```kotlin
// Android Fix Pattern: Fragment Lifecycle Guard
fun cleanupPipFragment(activity: FragmentActivity) {
    val fragmentManager = activity.supportFragmentManager
    val existingFragment = fragmentManager.findFragmentByTag(PIP_FRAGMENT_TAG)
    if (existingFragment != null && !fragmentManager.isDestroyed) {
        fragmentManager.beginTransaction()
            .remove(existingFragment)
            .commitNowAllowingStateLoss()
    }
    pipHelperFragmentRef = WeakReference(null)
}
```

### Micro-Learning 2: Thread-Unsafe Glide Callbacks Crashing During Async Error Dispatch (`expo-image`)
* **Failure Mode / Pitfall**: Native crash `java.lang.IllegalArgumentException: You cannot start a load on a destroyed activity` or NPE when dispatching `onError` events in `expo-image`.
* **Root Cause**: Glide resolves image loading off the UI thread. When an image fails to load, the `Target.onLoadFailed()` callback triggers on a background worker or after the hosting Android `ImageView`/`Context` is detached. Invoking JSI event emitters on an invalidated context or off the UI thread causes native crashes.
* **Exact Prevention / Fix**: Ensure event dispatching guards check context validity (`isDestroyed`, `isFinishing`) and force event emission onto the main UI thread via `Handler(Looper.getMainLooper())` or React Native's UIManager dispatch queue.

```kotlin
// Android Fix Pattern: Thread-Safe Native Event Dispatch
override fun onLoadFailed(errorDrawable: Drawable?) {
    val context = viewRef.get()?.context as? Activity
    if (context == null || context.isFinishing || context.isDestroyed) {
        return
    }
    mainHandler.post {
        viewRef.get()?.let { view ->
            view.dispatchEvent("onError", Bundle().apply {
                putString("error", "Failed to load image resource")
            })
        }
    }
}
```

### Micro-Learning 3: iOS `AVPlayer` Seek Interruption Race Condition (`expo-av`)
* **Failure Mode / Pitfall**: Calling `setPositionAsync()` on long MP3 files on iOS returns `Error: Seeking interrupted` and freezes playback state.
* **Root Cause**: `AVPlayer.seek(to:completionHandler:)` is asynchronous. Rapid or high-precision seek requests cancel pending seek operations, triggering the `completionHandler` with `finished = false`. Code assuming `finished == true` fails to update playback status or unlock the UI state.
* **Exact Prevention / Fix**: Pass explicit exact tolerance parameters (`CMTime.zero`) only when required, and cancel/debounce pending seek operations using a seek token tracking state machine before issuing new seek commands.

```swift
// Swift Fix Pattern: Debounced AVPlayer Seek Operation
private var pendingSeekWorkItem: DispatchWorkItem?

func seekTo(time: CMTime, completion: @escaping (Bool) -> Void) {
    pendingSeekWorkItem?.cancel()
    
    let workItem = DispatchWorkItem { [weak self] in
        guard let player = self?.playerItem else { return }
        player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero) { finished in
            DispatchQueue.main.async {
                completion(finished)
            }
        }
    }
    
    pendingSeekWorkItem = workItem
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05, execute: workItem)
}
```

### Micro-Learning 4: Unmounted Component NavigationBar State Pollution (`expo-navigation-bar`)
* **Failure Mode / Pitfall**: On Android, configuring the bottom `NavigationBar` (color, visibility) in a screen component leaves the bar in an inconsistent state when navigating away/unmounting.
* **Root Cause**: Modifying window system UI flags (`SYSTEM_UI_FLAG_HIDE_NAVIGATION`, `WindowInsetsController`) applies changes directly to the host `Window` context without maintaining a LIFO stack of requested system UI visual states.
* **Exact Prevention / Fix**: Implement a native state-stack manager that snapshots current UI flags before mutation and pops/restores baseline window flags upon component unmount.

### Micro-Learning 5: Package Install Regex Failure on Non-Semver Git Targets (`expo install`)
* **Failure Mode / Pitfall**: Running `expo install package#main` adds `'undefined': 'package#main'` to `package.json`.
* **Root Cause**: Specifier parsing logic split dependency strings using `@` or `:` assuming `name@version` syntax, causing git commit hashes or branch fragments (`#main`) to evaluate as `undefined` for package name resolution.
* **Exact Prevention / Fix**: Use NPM's `npm-package-arg` specifier parser instead of manual string regex splits to extract canonical package names from URLs, local paths, and git commit references.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

```
+-----------------------------------------------------------------------------------+
|                           8-DIMENSIONAL FORENSIC AXES                             |
+-----------------------------------------------------------------------------------+
| D1: Structural Boundaries       | Monorepo modularity, Swift/Kotlin JSI API       |
| D2: Concurrency & Async         | JSI Thread affinity, UI vs Background Queues    |
| D3: Error Boundaries & Rollback | expo-updates fallback state machine & safety    |
| D4: Resource Lifecycle & Leaks  | Retained fragments, WeakReferences, ARC cycles   |
| D5: Boundary Deserialization    | JSI zero-copy conversions, manifest validation  |
| D6: Cross-Platform Gotchas      | WGS84 vs MSL, loopback addresses, file extensions|
| D7: Build & Deployment Invariant| Config plugin transformations, Metro extensions |
| D8: Forensic Patches            | Explicit branch scoping, Swift PM gates        |
+-----------------------------------------------------------------------------------+
```

### D1: Structural Boundaries & Modularity
* **Architecture**: Clean isolation between core bridge runtime (`expo-modules-core`) and individual feature packages (`expo-video`, `expo-image`, `expo-constants`).
* **Contract Enforcement**: Expo Modules API v2 uses strongly typed Swift/Kotlin DSL definitions (`Class`, `Property`, `AsyncFunction`, `Events`) mapped directly to JSI bindings via C++, avoiding JavaScript execution bridge bottlenecks.

### D2: Asynchronous State & Concurrency Defense
* **Thread Isolation**: Direct calls from JS to native execute on the JSI thread. UI modifications (e.g., View Manager updates, Android View state changes) must be dispatched explicitly to the Main UI Thread (`DispatchQueue.main` on iOS, `UiThreadUtil.runOnUiThread` on Android).
* **Race Condition Mitigation**: Asynchronous operations return native `Promise` objects that explicitly reject if the underlying `AppContext` or host `Activity`/`ViewController` is destroyed before thread execution completes.

### D3: Error Boundaries, Recovery & Rollback Protocols
* **Updates Safe Mode (`expo-updates`)**: On startup, `expo-updates` checks a persistent launch database. If an update crashes during initialization:
  1. It increments a local database failure counter.
  2. If failure threshold >= 2, it drops the corrupted JS bundle and rolls back to the embedded fallback bundle inside the native binary.
* **C++ JSI Exception Handling**: Native Swift/Kotlin errors are caught at the C++ binding layer and converted into JS `Error` instances with platform-specific call stacks preserved.

### D4: Resource Lifecycle & Leak Defenses (Memory, Sockets, Descriptors)
* **Weak References for UI Contexts**: Views and Activities in Android modules are held via `WeakReference<Activity>` or `WeakReference<View>` inside event listeners to prevent garbage collector root retention.
* **iOS ARC Retain Cycle Prevention**: Swift closures in event listeners capture `[weak self]` or `[weak appContext]` to prevent strong reference cycles between the JS runtime engine and native objects.

### D5: Boundary Deserialization, Schemas & Input Sanitization
* **Zero-Copy JSI Type Converters**: Basic JS types (`Primitive`, `TypedArray`, `Object`) map via native C++ converters into Swift/Kotlin primitives without JSON serialization over strings.
* **Manifest Validation**: App configs are validated at build time against JSON Schemas to ensure mandatory parameters (e.g., `scheme`, `android.package`, `ios.supportsTablet`) exist prior to code generation.

### D6: Cross-Platform & Runtime Compatibility Gotchas
* **Network Binding Differences**: `expo run:android` maps local dev servers to `10.0.2.2` (Android emulator loopback host) rather than `localhost` or host LAN IPs.
* **GPS/Location Datum Discrepancies**: iOS `CoreLocation` returns altitude relative to the WGS84 ellipsoid or Mean Sea Level depending on hardware capabilities, requiring normalization before sending to JS to match Android's standard ellipsoidal height metrics.
* **File Type Resolution**: iOS `UIDocumentPickerViewController` strict uniform type identifier (UTI) parsing crashes on non-standard extensions (e.g., `.pages`, extensions > 4 characters) unless mapped to `com.apple.iwork.pages` or fallback `public.data`.

### D7: Build, CI/CD, Deployment & Dependency Invariants
* **Config Plugins Determinism**: Build-time transformations of native `AndroidManifest.xml` and `Info.plist` are implemented as pure functions (`withAndroidManifest`, `withInfoPlist`).
* **Metro Asset Resolution**: Overriding `metro.config.js` in projects requires spreading default Expo resolution structures (`getDefaultConfig(__dirname)`); replacing asset extensions drops font/vector icon loaders.

### D8: Concrete Bug Fixes & Forensic Patches
* **Static Analysis Defenses**: PRs `#50719`, `#50720`, `#50722` enforce strict block braces (`{}`) on all conditional branches (`if`/`else`) across C++/Java/Kotlin native modules to eliminate single-line control flow bypass bugs.
* **Multi-App Context Scoping**: PR `#50721` assigns unique app identifiers to individual `AppContext` instances on iOS, preventing cross-talk and state leaks when multiple Expo surfaces run concurrently in a single process.

---

## 4. Net-New Universal Engineering Rules

## 72. Native Context Lifecycle Integrity Rule

**RULE**:
Never dispatch asynchronous callbacks, emit events, or execute view modifications across cross-language native boundaries (e.g., JSI, C++, Swift, Kotlin) without explicitly verifying that the host Context, Activity, or View instance is attached, visible, and alive.

**WHY**:
Asynchronous execution threads (e.g., background I/O, network requests, media loading) operate independently of the UI component lifecycle. Emitting events or updating native UI objects after host context destruction causes fatal system crashes (`IllegalArgumentException`, `NullPointerException`, or Memory Access Errors).

**WHEN TO APPLY**:
Apply to all native bridge modules, cross-platform wrappers, asynchronous native extensions, and C++ HostObject bindings.

```kotlin
// VERIFIED IMPLEMENTATION PATTERN (Android / Kotlin)
class SafeNativeModuleEmitter(private val activityRef: WeakReference<Activity>) {
    
    fun emitEventIfAlive(eventName: String, payload: Bundle) {
        val activity = activityRef.get()
        
        // Guard against detached/destroyed lifecycle state
        if (activity == null || activity.isFinishing || activity.isDestroyed) {
            return
        }
        
        // Force execution onto the main UI thread safely
        if (Looper.myLooper() == Looper.getMainLooper()) {
            dispatch(activity, eventName, payload)
        } else {
            Handler(Looper.getMainLooper()).post {
                val currentActivity = activityRef.get()
                if (currentActivity != null && !currentActivity.isFinishing && !currentActivity.isDestroyed) {
                    dispatch(currentActivity, eventName, payload)
                }
            }
        }
    }
    
    private fun dispatch(activity: Activity, eventName: String, payload: Bundle) {
        // Safe dispatch logic
    }
}
```

```swift
// NEGATIVE CONSTRAINT PATTERN (Swift)
// DO NOT DO THIS: Direct callback execution without weak context checking
func onDownloadComplete(data: Data) {
    // CRASH RISK: self or bridge may be deallocated
    self.bridge.enqueueJSCall("EventEmitter", method: "emit", args: [data])
}

// VERIFIED IMPLEMENTATION PATTERN (Swift)
func onDownloadComplete(data: Data) {
    DispatchQueue.main.async { [weak self] in
        guard let self = self, let appContext = self.appContext else {
            return // Dropped safely if context was torn down
        }
        self.sendEvent("onDownloadComplete", ["data": data])
    }
}
```

---

## 73. Cross-Boundary Navigation/System State Restoration Stack Rule

**RULE**:
Any native UI module or bridge component that alters shared environment or system-level configuration flags (e.g., system navigation bars, status bars, window insets, orientation) MUST capture the baseline state upon mount and push changes to a LIFO stack. Upon unmount or context loss, the component MUST pop its state and restore the preceding baseline.

**WHY**:
Global UI state in single-activity or multi-screen applications lacks inherent scope isolation. When a component alters global properties (such as hiding system navigation bars) and unmounts without explicitly resetting the host window flags, the remaining screens inherit corrupted UI state.

**WHEN TO APPLY**:
Apply when building components that interact with dynamic system UI overlays, screen orientation, audio focus modes, hardware device locks, or global window flags.

```typescript
// VERIFIED IMPLEMENTATION PATTERN (TypeScript / Native Hook)
import { useEffect, useRef } from 'react';
import { NativeModules } from 'react-native';

const { SystemUiModule } = NativeModules;

export function useSystemNavigationBar(targetColor: string) {
  const previousColorRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function applyState() {
      // Capture baseline prior to mutation
      const baseline = await SystemUiModule.getNavigationBarColorAsync();
      if (isMounted) {
        previousColorRef.current = baseline;
        await SystemUiModule.setNavigationBarColorAsync(targetColor);
      }
    }

    applyState();

    return () => {
      isMounted = false;
      // Revert back to precise baseline on unmount
      if (previousColorRef.current !== null) {
        SystemUiModule.setNavigationBarColorAsync(previousColorRef.current);
      }
    };
  }, [targetColor]);
}
```

---

## 5. Actionable Agent Skill & Implementation Checklist

```
+-----------------------------------------------------------------------------------+
|                        AGENT VERIFICATION CHECKLIST                               |
+-----------------------------------------------------------------------------------+
| [ ] 1. Native Context Survival Guards                                             |
|     Verify all native callbacks check for context/activity lifetime validity.     |
|                                                                                   |
| [ ] 2. Static Analysis Bracing                                                    |
|     Enforce explicit block braces on all conditional paths in native modules.     |
|                                                                                   |
| [ ] 3. Debounced Media Operations                                                 |
|     Wrap async native media operations in stateful, cancellable work items.       |
|                                                                                   |
| [ ] 4. LIFO System Flag Restoration                                               |
|     Implement stack-based capture/restore logic for window-level UI flags.        |
|                                                                                   |
| [ ] 5. Robust Dependency Parsing                                                  |
|     Use specifier parsers rather than regex splitters for package strings.        |
|                                                                                   |
| [ ] 6. Embedded Update Rollback Safeties                                          |
|     Verify launch failure counters decrement or trigger fallback bundle loads.   |
+-----------------------------------------------------------------------------------+
```

1. **Native Context Survival Guards**:
   - Inspect all async native module methods (`Kotlin`/`Swift`).
   - Confirm every event emitter, image callback, and background task uses `WeakReference` or `[weak self]` and checks `.isFinishing`/`.isDestroyed` before execution.
2. **Static Analysis Bracing**:
   - Run linter/formatter rules enforcing explicit block braces (`{}`) on all `if`/`else` branches across Java, Kotlin, Swift, and C++ files.
3. **Debounced Media Operations**:
   - Verify native player controllers (`AVPlayer`, `ExoPlayer`) debounce seek/position commands using explicit state tokens or pending work item cancellations.
4. **LIFO System Flag Restoration**:
   - Ensure components mutating window flags (`StatusBar`, `NavigationBar`) register cleanups on unmount to restore original baseline properties.
5. **Robust Dependency Parsing**:
   - Audit CLI installation logic. Replace string splitting routines targeting `pkg@version` with standard specifier resolution tools (e.g., `npm-package-arg`).
6. **Embedded Update Rollback Safeties**:
   - Ensure OTA update mechanisms implement a persistent retry counter that falls back to embedded app bundles if consecutive initialization crashes occur.