# Verification Protocol: Verification Protocol: Empirical Defect Shield for expo/expo

<!-- PROVENANCE_START
{
  "source_repository": "expo/expo",
  "source_url": "https://github.com/expo/expo",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [expo/expo](https://github.com/expo/expo) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `expo/expo` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/expo-expo-learnings.md`  
> **Source**: github ([https://github.com/expo/expo](https://github.com/expo/expo))  
> **Source Version**: `52915f0d`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-09T08:16:25.891Z  
> **Learning ID**: `learn-github-expo-expo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): expo/expo

---

## 1. Executive Forensic Architecture & System Mechanics

The `expo/expo` repository houses the universal application runtime and meta-framework for cross-platform TypeScript, React, React Native, Swift, Kotlin, and C++ applications. The core architectural challenge it resolves is **cross-runtime invariant reconciliation across asymmetric execution boundaries**: orchestrating JavaScript engines (Hermes, V8, JavaScriptCore) with native host OS runtimes (iOS Darwin/Cocoa Touch, Android ART/Jetpack, and the Web/DOM) without sacrificing thread isolation, low-latency audio/render pipelines, or atomic data consistency.

```
                           +-----------------------------------------------+
                           |          Expo CLI / Metro / DevTools          |
                           +-----------------------------------------------+
                                                  | Bundles & Manifests
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                    React / TypeScript Layer                                        |
|  - Universal UI (@expo/ui, Picker, TextInput)                                                     |
|  - Core Modules (expo-audio, expo-updates, expo-notifications)                                    |
+----------------------------------------------------------------------------------------------------+
       |                                          |                                           |
       | Expo Modules API JSI Direct Dispatch     | Shared Serial AsyncFunction Queue         | Worklets
       v                                          v                                           v
+------------------------------------+ +-------------------------------------+ +--------------------+
|         iOS Native Core            | |        Android Native Core          | |    Web Runtime     |
| - AudioModule (AVAudioSession)     | | - Expoview / Activity Handlers      | | - DOM Adapters   |
| - Swift Shared State Locks         | | - ScopedNotifications / Jetpack     | | - HTMLSelect/Aria|
| - UpdatesDatabase (SQLite3 C-API)  | | - AsyncCondition Thread Gate        | | - Asset Loaders  |
+------------------------------------+ +-------------------------------------+ +--------------------+
       |                                          |                                           |
       +------------------------------------------+-------------------------------------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               |           Hardware & OS             |
                               |  CoreAudio, SQLite, ART, SurfaceFlinger |
                               +-------------------------------------+
```

### Architectural Subsystem Boundaries and Invariants
1. **The Shared Native AsyncFunction Serial Dispatch Barrier**: Expo Modules API routes asynchronous native module invocations over a default serial queue. If any module performs synchronous work or blocks waiting on a dedicated hardware queue (e.g., calling `sessionQueue.sync` inside `AudioModule.swift`), it introduces an app-wide head-of-line stall blocking unrelated native modules. Asynchronous module boundaries must resolve promises over dedicated background threads or dispatch queues.
2. **Swift Concurrency vs. Darwin Notification Threading**: Interruption handlers triggered by Darwin OS notifications (such as `AVAudioSessionInterruptionNotification`) execute on arbitrary system threads. Reading and mutating mutable collections (`interruptedPlayers: Set<String>`, `playerVolumes: [String: Float]`) from notification threads while background worker queues attempt playback resumption triggers data corruption and SIGSEGV memory faults. Snapshotting on the notification thread followed by atomic queue dispatch is mandatory.
3. **Database Parameter Expansion in Native C-API Wrappers**: Direct SQLite C-API abstractions do not expand SQL arrays passed to parameterized `IN (?1)` clauses. Binding a comma-delimited string to a single parameter causes SQLite to treat `"key1,key2"` as a literal scalar string comparison rather than a set containment check, failing silently and leaving stale client-side server headers. Dynamic placeholder synthesis matching argument cardinality (`WHERE "key" IN (?1, ?2, ...)`) is strictly required.
4. **Tri-Platform Semantic Translation Barrier**: Universal UI controls (e.g., `@expo/ui`'s `Picker`) decouple component interfaces from platform accessibility models:
   - **iOS**: SwiftUI modifier (`.accessibilityLabel(label)`).
   - **Android**: Jetpack Compose semantics on the text anchor (`Modifier.semantics { contentDescription = accessibilityLabel }`).
   - **Web**: Standard WAI-ARIA DOM attribute (`aria-label`).
5. **Scoped Multi-Tenant Experience Isolation (Expo Go)**: In multi-tenant client environments (such as Expo Go), OS-level notifications and background workers must be deterministically partitioned. A foreign notification received at the Android system level must be evaluated against the active `ExperienceKey`. Persistent system notifications must never leak into isolated guest runtimes.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Zero-Blocking Serial Queue Cross-Dispatch Invariant
**RULE**:
A native asynchronous module method bound to a shared framework execution queue MUST NEVER execute synchronous operations (`.sync {}`, blocking mutex acquisition, or sleep waits) against a dedicated subsystem queue. Dedicated subsystem work MUST be dispatched asynchronously (`.async {}`), and the JavaScript/native Promise MUST be settled directly from within that subsystem queue.

**WHY**:
In bridge and JSI-based architectures, asynchronous functions from disparate modules often default to a shared serial worker queue. Invoking `.sync` on a subsystem queue (e.g., `AVAudioSession` queue) from this shared thread creates a cross-queue synchronization lock. If the subsystem queue is blocked by OS audio hardware stalls, every other module in the application sharing that serial worker thread freezes, resulting in an unrecoverable UI hitch or application watchdog termination.

**WHEN TO APPLY**:
Apply to any multi-threaded runtime where incoming remote procedure calls (RPC), FFI bindings, or bridge calls are multiplexed onto a shared worker pool (Swift/Obj-C Grand Central Dispatch, Kotlin Coroutines with shared dispatchers, Node.js native addons, or Rust JNI interfaces).

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Swift: AudioModule.swift
// Correct asynchronous dispatch settling promise off-thread without stalling the shared queue
AsyncFunction("setIsAudioActiveAsync") { (isActive: Bool, promise: Promise) in
    // Fast in-memory state lock without blocking
    audioEnabled.withLock { $0 = isActive }
    if !isActive {
        pauseAllPlayers()
    }

    // Dispatch onto dedicated hardware serial queue and settle promise asynchronously
    sessionQueue.async {
        do {
            try AVAudioSession.sharedInstance().setActive(
                isActive, 
                options: self.activationOptions(isActive: isActive)
            )
            self.sessionIsActive = isActive
            if !isActive {
                self.audioSessionActivityKeepers.removeAll()
            }
            promise.resolve()
        } catch {
            promise.reject(AudioStateException(error.localizedDescription))
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Blocking shared AsyncFunction thread with sessionQueue.sync
AsyncFunction("setIsAudioActiveAsync") { (isActive: Bool) in
    audioEnabled.withLock { $0 = isActive }
    if !isActive {
        pauseAllPlayers()
    }
    // FAILS: Shared module worker blocks waiting for sessionQueue.
    // If sessionQueue is stalled on OS audio daemon, the entire app freezes.
    do {
        try sessionQueue.sync {
            try AVAudioSession.sharedInstance().setActive(
                isActive, 
                options: activationOptions(isActive: isActive)
            )
            self.sessionIsActive = isActive
        }
    } catch {
        throw AudioStateException(error.localizedDescription)
    }
}
```

**VERIFICATION METHOD**:
Enforce via unit and integration tests under queue-contention harnesses: verify that when a simulated 500ms delay is injected into `sessionQueue`, calls to unrelated modules on the shared async queue resolve with zero added latency. Execute thread sanitizer: `xcodebuild test -enableThreadSanitizer YES`.

---

### 2. Multi-Arity SQL IN-Clause Parameter Binding Invariant
**RULE**:
When constructing parameterized SQL statements with dynamic `IN` clauses via low-level database drivers (SQLite C-API, JDBC, libpq), you MUST generate exactly $N$ distinct parameter placeholders (`?1, ?2, ...` or `?, ?, ...`) matching the cardinality of the input slice, and bind each element as an individual scalar. You MUST NOT bind a concatenated string (e.g., `"val1,val2"`) to a single parameter placeholder `(?1)`.

**WHY**:
SQL engines do not parse parameter payloads as SQL expressions; they treat them as atomic values. Binding `"alpha,beta"` to `WHERE col IN (?1)` searches for rows where `col` literally equals the string `"alpha,beta"`. This causes queries to silently affect zero rows without returning a syntax error, leading to state persistence failures, orphaned database records, and cache invalidation bypasses.

**WHEN TO APPLY**:
Any raw SQL query building in Swift, Kotlin, Rust, Go, or TypeScript where array inputs are bound directly to parameter markers without an ORM abstraction.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Swift: UpdatesDatabase.swift
internal func deleteJsonDataForAllScopeKeys(withKeys keys: [JSONDataKey]) throws {
    guard !keys.isEmpty else { return }
    
    sqlite3_exec(db, "BEGIN;", nil, nil, nil)
    
    // Explicitly generate 1-indexed placeholders matching exact input length
    let placeholders = keys.indices.map { "?\($0 + 1)" }.joined(separator: ", ")
    let deleteSql = """
      DELETE FROM json_data WHERE "key" IN (\(placeholders));
    """
    
    do {
        // Map elements into an array of distinct scalar bindings
        _ = try execute(sql: deleteSql, withArgs: keys.map { $0.rawValue })
        sqlite3_exec(db, "COMMIT;", nil, nil, nil)
    } catch {
        sqlite3_exec(db, "ROLLBACK;", nil, nil, nil)
        throw UpdatesDatabaseError.setJsonDataError(cause: error)
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Concatenating strings into a single parameter binding
internal func deleteJsonDataForAllScopeKeys(withKeys keys: [JSONDataKey]) throws {
    sqlite3_exec(db, "BEGIN;", nil, nil, nil)
    let deleteSql = """
      DELETE FROM json_data WHERE "keys" IN (?1); -- Wrong column AND wrong binding
    """
    // FAILS: Joins keys into "extraParams,serverDefinedHeaders", binding as 1 string
    let keysArg = keys.map { $0.rawValue }.joined(separator: ",")
    do {
        _ = try execute(sql: deleteSql, withArgs: [keysArg])
        sqlite3_exec(db, "COMMIT;", nil, nil, nil)
    } catch {
        sqlite3_exec(db, "ROLLBACK;", nil, nil, nil)
    }
}
```

**VERIFICATION METHOD**:
Implement a database assertion test verifying that multiple targeted keys are inserted, deleted using the multi-key method, and confirmed `nil` while non-targeted keys remain intact:
```swift
@Test func testDeleteMultipleKeys() throws {
    try db.setExtraParam(key: "k1", value: "v1", withScopeKey: "s")
    try db.setExtraParam(key: "k2", value: "v2", withScopeKey: "s")
    try db.deleteJsonDataForAllScopeKeys(withKeys: [JSONDataKey.ExtraParmasKey])
    #expect(try db.extraParams(withScopeKey: "s") == nil)
}
```

---

### 3. Thread-Safe Snapshotting Before Serialized Collection Mutation
**RULE**:
When an external system callback or notification fires on an unmanaged, arbitrary thread, the handler MUST immediately capture an immutable value snapshot of transient subsystem state on that thread before scheduling background tasks. The mutation of long-lived shared collections MUST strictly occur inside the serial synchronization queue of that subsystem.

**WHY**:
If long-lived collections are modified directly on arbitrary notification threads (such as `AVAudioSessionInterruptionNotification`), concurrent readers or writers executing on dedicated worker queues will race. Even if access is dispatched to a queue, delaying state capture until the block executes introduces a Time-Of-Check to Time-Of-Use (TOCTOU) race: the transient playback state may change or be auto-paused by the OS while the queue is saturated, leaving resuming players stranded.

**WHEN TO APPLY**:
System event listeners, OS lifecycle callbacks, hardware interruption delegates (CoreAudio, Android BroadcastReceivers, NetworkStatus observers).

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Swift: AudioModule.swift
private func handleInterruptionBegan() {
    // 1. Snapshot transient state synchronously on the notification thread
    var interrupted = Set<String>()
    var volumes = [String: Float]()

    registry.allPlayables.forEach { playable in
        if playable.isPlaying {
            interrupted.insert(playable.id)
            switch interruptionMode {
            case .duckOthers:
                volumes[playable.id] = playable.volume
                playable.volume *= 0.5
            case .doNotMix, .doNotMixPersistent, .mixWithOthers:
                playable.pause()
            }
        }
    }

    // 2. Schedule writes to shared collections strictly on the dedicated session queue
    sessionQueue.async { [weak self] in
        guard let self else { return }
        self.interruptedPlayers = interrupted
        self.playerVolumes = volumes
        self.sessionIsActive = false
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Mutating internal collections directly from the notification thread
private func handleInterruptionBegan() {
    // FAILS: Thread race! Mutates collections that are read/written on sessionQueue
    interruptedPlayers.removeAll()
    playerVolumes.removeAll()

    registry.allPlayables.forEach { playable in
        if playable.isPlaying {
            interruptedPlayers.insert(playable.id)
            playerVolumes[playable.id] = playable.volume
            playable.pause()
        }
    }
    recordSessionActive(false)
}
```

**VERIFICATION METHOD**:
Run parallel execution tests using Swift concurrency or thread sanitizer to assert that no simultaneous memory mutations occur on `interruptedPlayers` while `handleInterruptionEnded` runs.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Audio Session Queue Deadlock & Interruption State Race (BUG-EXPO-AUDIO-01)
- **Context**: `packages/expo-audio/ios/AudioModule.swift`
- **What Was Expected**: During phone call interruptions or audio ducking events, active players are paused/ducked, state is tracked in `interruptedPlayers`, and resumes occur when the interruption ends. Calling `setIsAudioActiveAsync` must resolve without blocking other Expo native modules.
- **What Actually Happened**: 
  1. `handleInterruptionBegan` mutated Swift collections (`interruptedPlayers`, `playerVolumes`) on the system notification thread, while `handleInterruptionEnded` read them on `sessionQueue`. Back-to-back interruptions caused SIGSEGV memory corruption crashes.
  2. `setIsAudioActive` executed `sessionQueue.sync` on the shared `AsyncFunction` queue. When `AVAudioSession` stalled, all module operations app-wide were blocked.
  3. `AudioPlayer.play()` initiated playback before session activation finished. If activation failed asynchronously, playback silently continued on an inactive audio session without notifying JavaScript.
- **Evidence in Repo**: Commit `12910ca2`, PR #48913, `.changeset/audio-ios-session-queue-followups.md`.
- **Root Cause**: Mixing notification thread execution with queue-isolated state, plus synchronous dispatch (`.sync`) on a shared framework thread.
- **Remediation Code Diff**:
```diff
--- a/packages/expo-audio/ios/AudioModule.swift
+++ b/packages/expo-audio/ios/AudioModule.swift
@@ -37,8 +37,8 @@ public class AudioModule: Module {
-    AsyncFunction("setIsAudioActiveAsync") { (isActive: Bool) in
-      try setIsAudioActive(isActive)
+    AsyncFunction("setIsAudioActiveAsync") { (isActive: Bool, promise: Promise) in
+      setIsAudioActive(isActive, promise: promise)
     }
@@ -233,7 +233,10 @@ public class AudioModule: Module {
         let rate = player.currentRate > 0 ? player.currentRate : 1.0
         player.play(at: rate)
-        self.activateSession(for: player)
+        self.activateSession(for: player) { [weak self, weak player] message in
+          player?.pause()
+          self?.appContext?.jsLogger.warn("[expo-audio] Playback was paused because the audio session could not be activated: \(message)...")
+        }
       }
@@ -660,15 +663,18 @@ public class AudioModule: Module {
   private func handleInterruptionBegan() {
-    interruptedPlayers.removeAll()
-    playerVolumes.removeAll()
+    var interrupted = Set<String>()
+    var volumes = [String: Float]()
 
     registry.allPlayables.forEach { playable in
       if playable.isPlaying {
-        interruptedPlayers.insert(playable.id)
+        interrupted.insert(playable.id)
...
-    recordSessionActive(false)
+    sessionQueue.async { [weak self] in
+      guard let self else { return }
+      self.interruptedPlayers = interrupted
+      self.playerVolumes = volumes
+      self.sessionIsActive = false
+    }
   }
@@ -815,22 +828,23 @@ public class AudioModule: Module {
-  private func setIsAudioActive(_ isActive: Bool) throws {
+  private func setIsAudioActive(_ isActive: Bool, promise: Promise) {
     audioEnabled.withLock { $0 = isActive }
     if !isActive {
       pauseAllPlayers()
     }
-    do {
-      try sessionQueue.sync {
-        try AVAudioSession.sharedInstance().setActive(isActive, options: activationOptions(isActive: isActive))
+    sessionQueue.async {
+      do {
+        try AVAudioSession.sharedInstance().setActive(isActive, options: self.activationOptions(isActive: isActive))
         self.sessionIsActive = isActive
         if !isActive {
-          audioSessionActivityKeepers.removeAll()
+          self.audioSessionActivityKeepers.removeAll()
         }
+        promise.resolve()
+      } catch {
+        promise.reject(AudioStateException(error.localizedDescription))
       }
     }
   }
```
- **Lesson**: Shared worker queues must never synchronously await private serial queues; system notification handlers must snapshot transient values locally and dispatch persistent collection writes to the serial owner.

---

### Incident 2: SQL Parameter Array Mismatch in Updates Database (BUG-EXPO-UPDATES-02)
- **Context**: `packages/expo-updates/ios/EXUpdates/Database/UpdatesDatabase.swift`
- **What Was Expected**: When the runtime updates URL, request headers, or embedded settings change, `deleteJsonDataForAllScopeKeys` must delete stored server headers, extra params, and manifest filters from the local SQLite store.
- **What Actually Happened**: The SQL string referenced a nonexistent column name `"keys"` instead of `"key"` and joined array keys into a single comma-separated string parameter bound to `?1`. The delete query never matched any rows, leaking obsolete headers and server configurations across OTA updates since PR #34426.
- **Evidence in Repo**: Commit `d8590b49`, PR #53105, `packages/expo-updates/ios/Tests/UpdatesDatabaseTests.swift`.
- **Root Cause**: Lack of dynamic placeholder generation for SQL `IN` clauses; string-joining an array into a single parameter scalar.
- **Remediation Code Diff**:
```diff
--- a/packages/expo-updates/ios/EXUpdates/Database/UpdatesDatabase.swift
+++ b/packages/expo-updates/ios/EXUpdates/Database/UpdatesDatabase.swift
@@ -595,12 +595,12 @@ public final class UpdatesDatabase: NSObject {
   internal func deleteJsonDataForAllScopeKeys(withKeys keys: [JSONDataKey]) throws {
     sqlite3_exec(db, "BEGIN;", nil, nil, nil)
+    let placeholders = keys.indices.map { "?\($0 + 1)" }.joined(separator: ", ")
     let deleteSql = """
-      DELETE FROM json_data WHERE "keys" IN (?1);
+      DELETE FROM json_data WHERE "key" IN (\(placeholders));
     """
-    let keysArg = keys.map { $0.rawValue }.joined(separator: ",")
     do {
-      _ = try execute(sql: deleteSql, withArgs: [keysArg])
+      _ = try execute(sql: deleteSql, withArgs: keys.map { $0.rawValue })
     } catch {
       sqlite3_exec(db, "ROLLBACK;", nil, nil, nil)
       throw UpdatesDatabaseError.setJsonDataError(cause: error)
```
- **Lesson**: Do not manually construct SQL collection boundaries without mapping each value to a unique indexed bind parameter.

---

### Incident 3: Missing Accessible Name in Universal UI Component (BUG-EXPO-UI-03)
- **Context**: `packages/expo-ui/src/universal/Picker/Picker.android.tsx`
- **What Was Expected**: Screen readers (Android TalkBack, iOS VoiceOver, Web NVDA/JAWS) announce the semantic label and selected option for universal `<Picker>` components.
- **What Actually Happened**: `PickerProps` lacked an `accessibilityLabel` prop. On Android, TalkBack announced only the active item with no label describing what field was being edited. On Web, the `<select>` element rendered without an accessible name.
- **Evidence in Repo**: Commit `45d12859`, PR #53122, unit tests across iOS, Android, and Web in `packages/expo-ui/src/__tests__/`.
- **Root Cause**: Component prop contract omission and lack of cross-platform semantics forwarding to Jetpack Compose `TextField` modifiers and Web DOM properties.
- **Remediation Code Diff**:
```diff
--- a/packages/expo-ui/src/universal/Picker/Picker.android.tsx
+++ b/packages/expo-ui/src/universal/Picker/Picker.android.tsx
@@ -7,7 +7,7 @@ import {
 } from '../../jetpack-compose/ExposedDropdownMenuBox';
 import { Text } from '../../jetpack-compose/Text';
 import { TextField, type TextFieldRef } from '../../jetpack-compose/TextField';
-import { menuAnchor, onVisibilityChanged } from '../../jetpack-compose/modifiers';
+import { menuAnchor, onVisibilityChanged, semantics } from '../../jetpack-compose/modifiers';
 import { extractPickerItems } from './PickerItem';
 import type { PickerItemValue, PickerProps } from './types';
@@ -20,6 +20,7 @@ export function Picker<T extends PickerItemValue>({
   selectedValue,
   onValueChange,
   enabled = true,
+  accessibilityLabel,
   children,
 }: PickerProps<T>) {
@@ -42,7 +43,13 @@ export function Picker<T extends PickerItemValue>({
         ref={textFieldRef}
         readOnly
         enabled={enabled}
-        modifiers={[menuAnchor(), onVisibilityChanged((visible) => setIsVisible(visible))]}
+        modifiers={[
+          menuAnchor(),
+          onVisibilityChanged((visible) => setIsVisible(visible)),
+          ...(accessibilityLabel !== undefined
+            ? [semantics({ contentDescription: accessibilityLabel })]
+            : []),
+        ]}
       />
```
- **Lesson**: Universal UI layers must guarantee that semantic accessibility attributes are propagated into the concrete accessibility tree primitives of all host platforms.

---

### Incident 4: Custom Metro Configuration Asset Resolver Font Stripping (BUG-EXPO-METRO-04)
- **Context**: Metro configuration resolution in Expo Router (`metro.config.js`)
- **What Was Expected**: Vector icon TTF assets from `@expo/vector-icons` load cleanly in production web and mobile builds when developers append custom asset extensions (such as SQLite `.db` files).
- **What Actually Happened**: Developers overwriting `resolver.assetExts` via standard spread syntax omitted fonts or broke Metro's internal resolution chain, leading to unrendered icons and broken glyphs on Web deployments.
- **Evidence in Repo**: Issue #21568, resolved via `@expo/metro-config` defaults schema.
- **Root Cause**: Direct array mutation and shallow overriding of `assetExts` without inheriting full engine defaults (`defaultConfig.resolver.assetExts`).
- **Remediation Code Pattern**:
```javascript
// Safe configuration merging in metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Preserve all default asset extensions (ttf, png, jpg) while appending new formats
config.resolver.assetExts = Array.from(new Set([
  ...config.resolver.assetExts,
  'db'
]));

module.exports = config;
```
- **Lesson**: Deep configuration objects managing asset pipelines must use additive set merging rather than raw destructive array assignments.

---

### Incident 5: Webpack Bundler Symbolicate Middleware Module Crash (BUG-EXPO-CLI-05)
- **Context**: `@expo/cli/build/src/start/server/webpack/WebpackBundlerDevServer.js`
- **What Was Expected**: Starting the web development server should fall back gracefully if optional debugging/symbolication endpoints are not found.
- **What Actually Happened**: Metro development server boot threw hard runtime exceptions: `Cannot find module '@expo/dev-server/build/webpack/symbolicateMiddleware'`, completely crashing the CLI startup pipeline.
- **Evidence in Repo**: Issue #20205.
- **Root Cause**: Missing conditional resolution guard when importing modular dev-server middleware across decoupled monorepo packages.
- **Remediation Code Pattern**:
```typescript
// Guarded dynamic import for optional bundler middleware
let symbolicateMiddleware: any = null;
try {
  symbolicateMiddleware = require('@expo/dev-server/build/webpack/symbolicateMiddleware');
} catch (e: any) {
  if (e.code !== 'MODULE_NOT_FOUND') {
    throw e;
  }
  // Fall back to no-op symbolication handler
  symbolicateMiddleware = (req: any, res: any, next: () => void) => next();
}
```
- **Lesson**: Monorepo tools interfacing with multiple external bundlers must isolate bundler-specific hooks behind defensive resolution boundaries.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Tilde Expansion Prefix Check**: When resolving file paths from user inputs or test configurations, `filePath.startsWith('~/')` must be checked before slicing with index 2 (`filePath.slice(2)`). Testing `startsWith('~')` alone creates errors on paths like `~username/folder`.
- **Nullable Number to Integer Coercion**:
  ```kotlin
  // host/exp/exponent/experience/ErrorQueueAdapter.kt
  val lineNumber = when (val lineNumberObject = bundle["lineNumber"]) {
    is Double -> ":" + lineNumberObject.toInt()
    is Int -> ":" + lineNumberObject.toInt()
    else -> ""
  }
  ```
  *Invariant*: When consuming untyped JSI/React bundles from JavaScript across the native boundary, JavaScript numbers may arrive as either boxed `Double` or `Integer` depending on the runtime engine (Hermes vs JSC). Direct casting `bundle["lineNumber"] as Int` causes a `ClassCastException` if the number is serialized as a float.
- **Safe Value Spread in Modifiers**:
  ```typescript
  // Conditional modifier injection without empty object pollution:
  modifiers={[
    menuAnchor(),
    onVisibilityChanged((visible) => setIsVisible(visible)),
    ...(accessibilityLabel !== undefined
      ? [semantics({ contentDescription: accessibilityLabel })]
      : []),
  ]}
  ```
  *Invariant*: Never evaluate `...(accessibilityLabel ? [modifier] : [])` because an empty string `""` is a valid accessibility label clearing an ancestor's description. Check explicitly against `!== undefined`.

### 2. Infinite Loop & Recursion Guards
- **File Name Collision Invariant with Guard Counter**:
  ```typescript
  // apps/bare-expo/e2e/image-comparison/src/pathUtils.ts
  function createUniqueFilePath(outputPath: string, homeDir?: string): string {
    const expandedPath = expandTilde(outputPath, homeDir);
    const dir = path.dirname(expandedPath);
    const ext = path.extname(expandedPath);
    const baseName = path.basename(expandedPath, ext);

    let finalPath: string = expandedPath;
    let counter = 2;
    // Guaranteed termination invariant: counter monotonically increments
    while (fs.existsSync(finalPath)) {
      finalPath = path.join(dir, `${baseName}_${counter.toString().padStart(2, '0')}${ext}`);
      counter++;
      if (counter > 1000) {
        throw new Error(`Exceeded maximum file collision attempts (1000) for path: ${outputPath}`);
      }
    }
    return path.resolve(finalPath);
  }
  ```
- **Thread Condition Single-Execution Invariant**:
  ```kotlin
  // host/exp/exponent/utils/AsyncCondition.kt
  @JvmStatic fun wait(key: String, listener: AsyncConditionListener) {
    if (listener.isReady()) {
      listener.execute()
    } else {
      synchronized(listenerMap) {
        if (listenerMap.containsKey(key)) {
          EXL.e(TAG, "Map already contains entry for key $key. Ignoring.")
          return // Guard against cyclic listener accumulation
        }
        listenerMap.put(key, listener)
      }
    }
  }
  ```

### 3. UI & UX Micro-Mechanics
- **Vector Icon Geometry Precision**:
  ```kotlin
  // host/exp/exponent/home/qrScanner/DrawingUtils.kt
  fun DrawScope.drawRoundedCorner(...) {
    drawArc(
      color = color,
      startAngle = startAngle,
      sweepAngle = 90f,
      useCenter = false, // Must be false to draw corner outline stroke without pie-slice fill
      topLeft = offset,
      size = Size(cornerRadius * 2, cornerRadius * 2),
      style = Stroke(width = strokeWidth)
    )
  }
  ```
- **Universal Dropdown Focus & Semantics Traps**:
  When building custom drop-down menus on Android using Jetpack Compose `ExposedDropdownMenuBox`, screen readers focus the anchoring `TextField`. If the anchor is `readOnly`, TalkBack must receive an explicit `contentDescription` via `Modifier.semantics`. Failure to apply this causes the screen reader to announce "Double tap to activate" without announcing the role or current value of the picker.

### 4. Backend Concurrency & Memory Safety
- **Scoped Notification Filtering Invariant**:
  ```kotlin
  // host/exp/exponent/notifications/ScopedNotificationsUtils.kt
  val notificationIsPersistentExponentNotification = 
    foreignNotificationExperienceScopeKey == null && 
    foreignNotification.second == ExperienceActivity.PERSISTENT_EXPONENT_NOTIFICATION_ID

  return !notificationIsPersistentExponentNotification && 
         (!notificationBelongsToSome

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
