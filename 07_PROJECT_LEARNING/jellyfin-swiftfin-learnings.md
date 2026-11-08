> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jellyfin-swiftfin-learnings.md`  
> **Source**: github ([https://github.com/jellyfin/Swiftfin](https://github.com/jellyfin/Swiftfin))  
> **Source Version**: `7d5b106e`  
> **License**: MPL-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-08T09:30:13.129Z  
> **Learning ID**: `learn-github-jellyfin-swiftfin`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): jellyfin/Swiftfin

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
Swiftfin serves as the native multiplatform client (iOS, iPadOS, tvOS) for the open-source Jellyfin media ecosystem. The primary engineering problem it solves is orchestrating low-latency, resilient media playback and navigation against heterogeneously transcoded remote media servers across disparate Apple platforms. The application reconciles strict Apple Human Interface Guidelines across touch, pointer, and tvOS Siri Remote focus engines while maintaining deterministic playback state synchronization, Electronic Program Guide (EPG) 2D spatial virtualization, and robust offline Core Data persistence via `CoreStore`.

### Architectural Boundaries & Subsystem Decoupling
```
+-------------------------------------------------------------------------------+
|                       Presentation Layer (SwiftUI / UIKit)                    |
|  [EPG Grid Virtualization] [VideoPlayer Overlay] [Focus Engine (tvOS/iOS)]    |
+---------------------------------------+---------------------------------------+
                                        | (State bindings, @EnvironmentObject)
                                        v
+-------------------------------------------------------------------------------+
|                         State & Coordination Engines                          |
|  [PlaybackTimeline]  [MediaPlayerQueue]  [EPGScrollState]  [LazyState<T>]     |
+---------------------------------------+---------------------------------------+
                                        | (Observation, async/await, Combine)
                                        v
+-------------------------------------------------------------------------------+
|                         Core Persistence & API Boundary                       |
|   [JellyfinAPI Client]  <--->  [CoreStore Logger / SQLite] <---> [Keychain]   |
+-------------------------------------------------------------------------------+
```

1. **Presentation vs. Playback Core Isolation**: The UI binds to `PlaybackTimeline` and `PlaybackState` value types rather than directly mutating low-level playback primitives (`AVPlayer` or `VLCKit`). This ensures that user interactions (scrubbing, seeking) update optimistic timeline projections (`displayed`) while asynchronous seeking commands (`inFlight`, `pending`) resolve deterministically without UI stutter or micro-jank.
2. **Dynamic Lazy Property Evaluation (`LazyState`)**: Swiftfin decouples heavy initialization pipelines from view instantiation via a custom `@MainActor @propertyWrapper LazyState<Value>`. This avoids the expensive cost of evaluating complex view state factories during SwiftUI view tree hierarchy evaluations.
3. **EPG Grid Virtualization Pipeline**: Swiftfin utilizes a hybrid UIKit-backed grid collection view combined with Combine publishers (`EPGScrollState`) using threshold clamping (`abs(delta) > 0.5`) to decouple high-frequency 60/120Hz scroll events from subview recalculations.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. View Modifier Hierarchy Order for SwiftUI Environment Injection
**RULE**:
When attaching custom `ViewModifier` instances that read from `@EnvironmentObject` or `@Environment`, the environment injector (`.environmentObject(...)` or `.environment(...)`) MUST wrap the modifier call from the outer scope, or the injector MUST be declared AFTER any modifier that relies on that environment in the modifier chain hierarchy evaluation order. Specifically, a custom modifier that invokes internal subviews dependent on an `EnvironmentObject` MUST NOT be chained before the `.environmentObject()` modifier is attached to that view hierarchy branch.

**WHY**:
In SwiftUI, modifiers wrap views from inside-out. If a custom modifier (e.g., `KeyCommandsModifier`) installs an underlying UIKit hosting controller or inspects an environment dependency of an embedded subview, placing `.environmentObject(target)` *before* `.modifier(KeyCommandsModifier())` results in the modifier capturing the parent environment rather than the newly injected object, or dropping the object across the hosting bridge boundary. In production, this causes a fatal assertion failure: `Fatal error: No ObservableObject of type ToastProxy found. A View.environmentObject(_:) for ToastProxy may be missing as an ancestor of this view.`

**WHEN TO APPLY**:
Applies to all SwiftUI platforms (iOS, macOS, tvOS, watchOS) whenever combining custom view modifiers (`ViewModifier`), UIKit bridging modifiers (`UIViewRepresentable`, `UIViewControllerRepresentable`), and environment injection chains.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Swiftfin Pattern: VideoPlayer overlay key handling & toast injection
struct PlaybackControlsView: View {
    @ObservedObject var viewState: VideoPlayerViewState

    var body: some View {
        ZStack {
            ControlsOverlayView()
            ToastContainerView()
        }
        // Step 1: Attach system and platform bridge modifiers first
        .modifier(VideoPlayer.KeyCommandsModifier())
        // Step 2: Ensure environment injections enclose all modifier subtrees
        .environmentObject(viewState.toastProxy)
        // Step 3: Attach animations dependent on state changes
        .animation(.linear(duration: 0.1), value: viewState.isScrubbing)
        .animation(.easeInOut(duration: 0.2), value: viewState.toastProxy.isPresenting)
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Attaching .environmentObject BEFORE custom structural modifiers
// that bridge to UIKit view controllers or evaluate inner views.
struct PlaybackControlsView: View {
    @ObservedObject var viewState: VideoPlayerViewState

    var body: some View {
        ZStack {
            ControlsOverlayView()
            ToastContainerView()
        }
        // BROKEN: KeyCommandsModifier cannot resolve toastProxy in its internal view passes,
        // triggering ASC fatal crash on production devices.
        .environmentObject(viewState.toastProxy)
        .modifier(VideoPlayer.KeyCommandsModifier())
    }
}
```

**VERIFICATION METHOD**:
Verify using an automated UI View Inspector / XCTest case that instantiates the hosting controller and exercises key commands without an ancestor environment object:
```swift
func testKeyCommandsModifierPreservesEnvironmentToastProxy() throws {
    let state = VideoPlayerViewState()
    let view = PlaybackControlsView(viewState: state)
    let hostingController = UIHostingController(rootView: view)
    
    // Force layout pass and view hierarchy extraction
    hostingController.loadViewIfNeeded()
    XCTAssertNoThrow(try hostingController.rootView.inspect().find(ToastContainerView.self))
}
```

---

### 2. Monotonic Multi-Flight Seek Reconciliation Pattern
**RULE**:
When building media scrubbing interfaces, the state engine MUST separate the `observed` engine position, the `pending` target position, and the `inFlight` request position into an atomic state structure. The UI MUST display `pending ?? observed`, and seeking completion handlers MUST NEVER clear a seek state unless the completed seek matches the unique UUID of the currently tracked `inFlight` request.

**WHY**:
Network and disk seek operations are asynchronous and variable-latency. If a user scrubs rapidly from $t=10$ to $t=20$ to $t=30$, an engine dispatch for $t=20$ might complete *after* the user has already requested $t=30$. If the completion handler blindly resets the display or sets seeking state to idle, the UI will jitter backward to $t=20$ before jumping to $t=30$, or will prematurely accept stale duration ticks, causing visual desynchronization and corrupted stream decoders.

**WHEN TO APPLY**:
All audio/video streaming, playback timeline engines, and scrubbable timeline visualizations across iOS, macOS, Android, and Web media players.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Swiftfin PlaybackTimeline Production Pattern
struct PlaybackTimeline: Sendable {
    struct Seek: Equatable, Sendable {
        let id = UUID()
        let target: Duration
    }

    private(set) var observed: Duration = .zero
    private(set) var pending: Seek?
    private(set) var inFlight: Seek?

    var displayed: Duration {
        pending?.target ?? observed
    }

    mutating func observe(_ position: Duration) {
        observed = max(.zero, position)
    }

    mutating func requestSeek(to position: Duration, duration: Duration?) {
        let target = max(.zero, duration.map { min(position, $0) } ?? position)
        guard target != displayed else { return }
        pending = Seek(target: target)
    }

    mutating func beginSeek() -> Seek? {
        guard inFlight == nil, let pending else { return nil }
        inFlight = pending
        return pending
    }

    @discardableResult
    mutating func completeSeek(_ id: UUID, position: Duration?) -> Bool {
        guard inFlight?.id == id else { return false }

        if let position {
            observe(position)
        }

        // Only clear pending if it wasn't superseded by a newer scrub
        if pending?.id == id {
            pending = nil
        }

        inFlight = nil
        return true
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Direct, unsynchronized seek dispatch with flag toggling
class BuggyTimelineManager {
    var isSeeking = false
    var currentPosition: Double = 0.0

    func seek(to target: Double) {
        self.isSeeking = true
        self.currentPosition = target
        
        // Anti-pattern: Rapid user scrubs trigger multiple concurrent async tasks.
        // Task completions arrive out of order, overwriting currentPosition with stale data.
        Task {
            let actualPosition = try await playerEngine.seek(to: target)
            self.currentPosition = actualPosition
            self.isSeeking = false
        }
    }
}
```

**VERIFICATION METHOD**:
Execute concurrency property testing simulating rapid out-of-order completions:
```swift
func testTimelineOutOfOrderSeekCompletions() {
    var timeline = PlaybackTimeline()
    timeline.observe(.seconds(10))
    
    timeline.requestSeek(to: .seconds(20), duration: .seconds(100))
    let firstSeek = timeline.beginSeek()!
    XCTAssertEqual(timeline.displayed, .seconds(20))
    
    // User drags again before first seek completes
    timeline.requestSeek(to: .seconds(50), duration: .seconds(100))
    XCTAssertEqual(timeline.displayed, .seconds(50))
    
    // Stale seek completion arrives
    let completedFirst = timeline.completeSeek(firstSeek.id, position: .seconds(20))
    XCTAssertTrue(completedFirst)
    // Displayed position MUST NOT roll back to 20; it must remain 50
    XCTAssertEqual(timeline.displayed, .seconds(50))
    XCTAssertNotNil(timeline.pending)
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: SwiftUI Modifier Evaluation Order Crash (BUG-SWIFTFIN-01)
- **Context**: `Swiftfin/Views/VideoPlayer/PlaybackControls/PlaybackControls.swift`
- **What Was Expected**: Video player overlay renders playback HUD controls with toast notifications displaying audio stream and subtitle changes.
- **What Actually Happened**: App Store Connect crash logs revealed widespread crashes during playback overlay appearance. Subviews contained inside `VideoPlayer.KeyCommandsModifier` attempted to resolve `@EnvironmentObject var toastProxy: ToastProxy` and failed, triggering an unhandled SIGABRT.
- **Evidence in Repo**: Commit `e6eaaa62`, Issue `#2410`, PR `#2410`.
- **Root Cause**: `.environmentObject(viewState.toastProxy)` was placed above `.modifier(VideoPlayer.KeyCommandsModifier())`. Because SwiftUI modifiers wrap inner views hierarchically, `KeyCommandsModifier` created an interceptor hosting context that did not receive the `toastProxy` environment object injected prior to it in the chain.
- **Remediation Code Diff**:
```diff
@@ -84,8 +84,8 @@ extension VideoPlayer {
                          .transition(.offset(y: -20).combined(with: .opacity))\n                 }\n             }
-            .environmentObject(viewState.toastProxy)
              .modifier(VideoPlayer.KeyCommandsModifier())
+            .environmentObject(viewState.toastProxy)
              .animation(.linear(duration: 0.1), value: isScrubbing)
              .animation(.bouncy(duration: 0.25), value: viewState.presentation)
              .animation(.easeInOut(duration: 0.2), value: viewState.toastProxy.isPresenting)
```
- **Lesson**: Environment modifiers must always wrap the modifier consuming them from the outside. Modifiers that mount platform hosting bridges (such as key command responders) require environment dependencies to be declared after them in the view chaining syntax.

---

### Incident 2: tvOS TestFlight Asset Catalog Compilation and Build Resolution Failure (BUG-SWIFTFIN-02)
- **Context**: `Swiftfin.xcodeproj/project.pbxproj`, `fastlane/Fastfile.swift`, `.github/workflows/testflight.yml`
- **What Was Expected**: Fastlane CI/CD pipeline builds and uploads tvOS beta builds to App Store Connect TestFlight automatically on matrix execution.
- **What Actually Happened**: The tvOS TestFlight build step failed during asset validation with `ITMS-90513: Missing App Icon`. Additionally, matrix builds failed completely if one platform failed (`fail-fast: true`), and the Fastfile build resolution logic incremented builds inconsistently against existing TestFlight numbers.
- **Evidence in Repo**: Commit `d073e383`, PR `#2402`.
- **Root Cause**:
  1. `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES` caused Xcode to bundle alternate app icon variants into tvOS packages, violating tvOS App Store submission constraints which enforce single Top Shelf and App Icon assets.
  2. Fastlane evaluated `testFlightBuild + 1` during the increment call, but left `resolvedBuild` as `testFlightBuild`, producing an off-by-one version mismatch between project settings and TestFlight metadata tags.
- **Remediation Code Diff**:
```diff
--- a/Swiftfin.xcodeproj/project.pbxproj
+++ b/Swiftfin.xcodeproj/project.pbxproj
@@ -1105,7 +1105,7 @@
 				ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = "AppIcon-dark-jellyfin AppIcon-dark-green AppIcon-dark-orange AppIcon-dark-red AppIcon-dark-yellow";
 				ASSETCATALOG_COMPILER_APPICON_NAME = "App Icon & Top Shelf Image";
 				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = "";
-				ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES;
+				ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = NO;
 				CODE_SIGN_STYLE = Automatic;
--- a/fastlane/Fastfile.swift
+++ b/fastlane/Fastfile.swift
@@ -228,10 +228,10 @@ class Fastfile: LaneFile {
             )
         } else {
             let testFlightBuild: Int = laneContextValue(for: "LATEST_TESTFLIGHT_BUILD_NUMBER") ?? 0
-            resolvedBuild = "\(testFlightBuild)"
+            resolvedBuild = "\(testFlightBuild + 1)"
 
             incrementBuildNumber(
-                buildNumber: .userDefined("\(testFlightBuild + 1)"),
+                buildNumber: .userDefined(resolvedBuild),
                 xcodeproj: .userDefined(xcodeProject)
             )
         }
--- a/.github/workflows/testflight.yml
+++ b/.github/workflows/testflight.yml
@@ -81,6 +81,7 @@ jobs:
     runs-on: xcode-27
     strategy:
+      fail-fast: false
       matrix: ${{ fromJSON(needs.resolve_platform.outputs.matrix) }}
```
- **Lesson**: Alternate icons on tvOS require explicit `CFBundleIcons` configuration in `Info.plist` paired with `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = NO` to prevent asset catalog compiler validation rejects. Build number variables must be calculated once and stored before being passed to lane contexts and Xcode targets.

---

### Incident 3: Multi-Line CJK Poster Typography Frame Collision (BUG-SWIFTFIN-03)
- **Context**: `Shared/Components/BaseItemDtoPosterLabel.swift` (Cross-referenced with Issue `#2409`)
- **What Was Expected**: Poster cards in horizontal and vertical grids dynamic-scale text metadata (titles, episode subtitles) directly below the poster image.
- **What Actually Happened**: When rendering multi-byte Simplified Chinese, Japanese, or Korean (CJK) characters with titles that span multiple lines, the title text expanded upward, rendering on top of the poster artwork and clipping thumbnail image surfaces.
- **Evidence in Repo**: Issue `#2409`: *"Title overlaps with poster"*.
- **Root Cause**: The layout container lacked an explicit vertical layout priority and positive spacing reservation. When multi-line wrapping occurred, SwiftUI resolved the item label frame by distributing remaining height upward into the `AsyncImage` / poster frame instead of pushing the bounding box downward or truncating with line limits.
- **Remediation Pattern**:
```swift
// Enforced Layout Invariant: Fixed Aspect Ratio Poster with Top-to-Bottom Vertical Stacking
VStack(alignment: .leading, spacing: 4) {
    PosterImageView(item: item)
        .aspectRatio(2/3, contentMode: .fit)
        .layoutPriority(1) // Anchor image space allocation
    
    Text(item.name ?? "")
        .font(.caption)
        .lineLimit(2)
        .fixedSize(horizontal: false, vertical: true) // Prevent vertical pushback into poster frame
        .frame(maxWidth: .infinity, alignment: .leading)
}
```
- **Lesson**: Dynamic text in card-based media grids must enforce `.fixedSize(horizontal: false, vertical: true)` paired with explicit line limits and image layout priorities to prevent child views from reflowing over media posters.

---

### Incident 4: High-Frequency EPG Scroll Event Microtask Thrashing (BUG-SWIFTFIN-04)
- **Context**: `Shared/Components/EPG/Body/Components/EPGScrollState.swift`
- **What Was Expected**: The Electronic Program Guide (EPG) coordinates horizontal scrolling across dozens of live TV channel tracks while keeping time indicator rulers aligned at 60/120fps.
- **What Actually Happened**: Raw `UIScrollViewDidScroll` delegate updates flooded Combine pipelines, causing severe frame drops, CPU spikes, and microtask queue starvation across UIKit-SwiftUI hosting boundaries.
- **Evidence in Repo**: `EPGScrollState.swift` lines 22-26: `guard abs(self.visibleLeadingOffset - visibleLeadingOffset) > 0.5 else { return }`.
- **Root Cause**: Sub-pixel floating-point delta variations ($0.0001\text{pt}$) triggered `CurrentValueSubject.send()`, forcing downstream SwiftUI observation subscribers to recompute 2D channel-program grid matrices continuously.
- **Remediation Code Diff**:
```swift
func update(visibleLeadingOffset: CGFloat) {
    // Clamping invariant: Discard any sub-half-pixel jitter
    guard abs(self.visibleLeadingOffset - visibleLeadingOffset) > 0.5 else { return }

    visibleLeadingOffsetSubject.send(visibleLeadingOffset)
}
```
- **Lesson**: High-frequency continuous gestures (scrolling, pinch, pan) bridged from UIKit to reactive publishers must implement hysteresis thresholds (minimum $0.5\text{pt}$ delta) to prevent redundant state invalidation cascades.

---

### Incident 5: CoreStore Unchecked Crash in Production Logs (BUG-SWIFTFIN-05)
- **Context**: `Shared/Logging/SwiftfinCorestoreLogger.swift`
- **What Was Expected**: Core Data / CoreStore internal assertions should log errors to unified logging (`os_log` / `SwiftLog`) without causing unhandled production termination unless fatal.
- **What Actually Happened**: Default assertion handlers terminated the process when encountering benign schema migration warnings or transient lock contentions in background storage threads.
- **Evidence in Repo**: `SwiftfinCorestoreLogger.swift` implementation of `CoreStoreLogger`.
- **Root Cause**: Lack of structured translation between CoreStore's internal logging levels (`trace`, `notice`, `warning`, `fatal`) and the Apple unified logging backend (`swift-log`), leading to missing telemetry before crash events.
- **Remediation Pattern**:
```swift
func assert(
    _ condition: @autoclosure () -> Bool,
    message: @autoclosure () -> String,
    fileName: StaticString,
    lineNumber: Int,
    functionName: StaticString
) {
    guard !condition() else { return }

    logger.critical(
        "\(message())",
        metadata: nil,
        source: "Corestore",
        file: fileName.description,
        function: functionName.description,
        line: UInt(lineNumber)
    )
}
```
- **Lesson**: Database wrapper assertion callbacks must intercept condition closures via `@autoclosure` and channel critical failures directly into platform logging subsystems with exact source-file coordinates before triggering aborts.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Duration Unit Conversions**: Media servers often transmit positions in 100-nanosecond ticks (`positionTicks`).
  ```swift
  // PlayerStateInfo.swift: Exact token-level math invariant
  var position: Duration? {
      guard let positionTicks else { return nil }
      // 1 tick = 100 ns = 0.1 µs -> divide by 10 for microseconds
      return Duration.microseconds(positionTicks / 10)
  }
  
  // DEPRECATED PITFALL: Dividing by 10_000_000 truncates sub-second precision to Int
  var positionSeconds: Int? {
      guard let positionTicks else { return nil }
      return positionTicks / 10_000_000
  }
  ```
- **Optional Unwrapping with Pattern Matching**: Never check `positionTicks != nil` and then force-unwrap `positionTicks!`. Always use `guard let positionTicks else { return nil }`.

### 2. Infinite Loop & Recursion Guards
- **Property Wrapper Initialization Loops (`LazyState`)**:
  ```swift
  @MainActor
  @propertyWrapper
  struct LazyState<Value>: @preconcurrency DynamicProperty {
      final class Box {
          private var value: Value!
          private let thunk: () -> Value
          var didThunk = false

          func setup() {
              // Termination Invariant: Prevent circular evaluation if thunk references self
              guard !didThunk else { return }
              didThunk = true
              value = thunk()
          }
      }
      
      func update() {
          guard !holder.didThunk else { return }
          holder.setup()
      }
  }
  ```
  `didThunk` MUST be flipped before or during resolution to prevent recursive calls during SwiftUI body re-renders from re-evaluating the closure.

### 3. UI & UX Micro-Mechanics
- **EPG Scroll Offsets and Layout Reflow**:
  High-frequency coordinate emission must use `CurrentValueSubject<CGFloat, Never>(0)` and enforce a strict boundary check:
  ```swift
  guard abs(self.visibleLeadingOffset - visibleLeadingOffset) > 0.5 else { return }
  ```
  This eliminates micro-reflows in parent SwiftUI views and restricts horizontal collection re-layouts to perceptible half-pixel increments.

### 4. Backend Concurrency & Memory Safety
- **Queue State Mutation under `@MainActor`**:
  `MediaPlayerQueue` enforces `@MainActor` isolation on all mutating and navigation protocols:
  ```swift
  @MainActor
  protocol MediaPlayerQueue: AnyObject, Observable, MediaSessionObserver {
      var state: MediaPlayerQueueState { get }
      func resolve(_ intent: PlaybackIntent, userSession: UserSession) async throws -> PlaybackIntent
      func next() async throws -> PlaybackIntent?
  }
  ```
  Isolating `MediaPlayerQueue` to `@MainActor` prevents data races when media events arrive from background AVFoundation threads while the UI is binding to queue properties.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Bounded Seek Target Invariant**:
  ```swift
  mutating func requestSeek(to position: Duration, duration: Duration?) {
      // INVARIANT: Seek target MUST be clamped between .zero and duration (if known)
      let target = max(.zero, duration.map { min(position, $0) } ?? position)
      guard target != displayed else { return }
      pending = Seek(target: target)
  }
  ```
  Failure to clamp against `duration` permits scrubbing past EOF (End-Of-File), causing native player engines (`AVPlayerItem`) to hang indefinitely or throw undocumented demuxer errors.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Layering**: Three distinct tiers: (a) UI Components (SwiftUI views, tvOS Focus adapters), (b) Media Player Session Managers (`MediaPlayerManager`, `PlaybackTimeline`), and (c) Remote Storage & API Client (`JellyfinAPI`, `CoreStore`).
- **State Ownership**: Playback engine state is owned by a singular state struct (`PlaybackState`), preventing dispersed boolean flags across multiple view controllers.

### 2. Core Abstractions
- `PlaybackTimeline`: Encapsulates seek state machine (`observed`, `pending`, `inFlight`).
- `LazyState<Value>`: Dynamic property wrapper delaying factory initialization until view display.
- `MediaPlayerQueue`: Protocol abstracting linear and randomized playback queues with async resolution.

### 3. Error Handling
- **Typed Network Decoupling**: Transitioning from legacy `NetworkError` enums to native Jellyfin API error responses with explicit HTTP status parsing (e.g., code 401 mapped to `L10n.unauthorized`).
- **CoreStore Logger**: Centralized routing of Core Data assertions into structured logs rather than silent swallowing or unconditional aborts.

### 4. Testing
- State machines (`PlaybackTimeline`) are pure value types devoid of UIKit/AVKit imports, enabling fast, deterministically reproducible unit tests.
- Seek tracking uses deterministic UUID matching (`Seek.id`), allowing isolated simulation of concurrent network race conditions.

### 5. Security
- Alternate App Icons must be registered explicitly in `CFBundleIcons` to comply with sandbox integrity checks.
- Session authorization tokens are encapsulated within `UserSession` and passed only via explicit dependency injection.

### 6. Performance
- Sub-pixel scroll clamping (`> 0.5` points) prevents high-frequency delegate calls from saturating the SwiftUI layout engine.
- Swift `Duration` struct primitives used instead of `Double` or `Int` allocations, avoiding floating-point rounding degradation during microsecond timeline calculations.

### 7. Deployment
- **Fastlane Automation**: Evaluates `LATEST_TESTFLIGHT_BUILD_NUMBER` and ensures atomic incrementing of `CURRENT_PROJECT_VERSION`.
- **tvOS Bundle Invariants**: `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = NO` is mandatory for multi-icon apps targeting tvOS to pass App Store validation.

### 8. Agent Patterns
- Standardized file headers with MPL-2.0 copyright notices.
- Strong conformance to `Displayable` and `SystemImageable` protocols allows UI components to render polymorphic enums (`PlaystateCommand`, `TaskState`) without switch-case duplication in view bodies.

### 9. Data Flow
```
User Scrub Gesture -> requestSeek(target) -> pending set -> displayed updates optimistically
                             |
                             v
                     beginSeek() -> inFlight set
                             |
                             v
               AVPlayer / VLCKit seek completes
                             |
                             v
               completeSeek(id) -> inFlight cleared -> observed updated
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Self-Contained Lazy Initialization Property Wrapper
```swift
@MainActor
@propertyWrapper
struct LazyState<Value>: @preconcurrency DynamicProperty {
    final class Box {
        private var value: Value!
        private let thunk: () -> Value
        var didThunk = false

        var wrappedValue: Value { value }

        func setup() {
            guard !didThunk else { return }
            value = thunk()
            didThunk = true
        }

        init(wrappedValue thunk: @autoclosure @escaping () -> Value) {
            self.thunk = thunk
        }
    }

    @State private var holder: Box

    var wrappedValue: Value { holder.wrappedValue }
    var projectedValue: Binding<Value> {
        Binding(get: { wrappedValue }, set: { _ in })
    }

    func update() {
        guard !holder.didThunk else { return }
        holder.setup()
    }

    init(wrappedValue thunk: @autoclosure @escaping () -> Value) {
        _holder = State(wrappedValue: Box(wrappedValue: thunk()))
    }
}
```

### 2. Rule
A SwiftUI environment injection modifier (`.environmentObject` / `.environment`) MUST wrap custom hosting/bridging modifiers (`.modifier(CustomModifier())`) externally to guarantee that all child contexts and bridged UIKit hosting views inherit the dependency.

### 3. Architecture Principle
**Optimistic UI with Asynchronous Monotonic Reconciliation**: The UI layer renders optimistic intent (`pending?.target ?? observed`) immediately for perceived zero-latency interaction, while background execution threads use uniquely tagged transactions (`UUID`) to discard out-of-order completions.

### 4. Failure Mode
**tvOS ITMS-90513 Submission Rejection**: Caused by setting `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES` on tvOS targets with alternate app icons, causing Xcode to compile alternate iOS-formatted icon assets into the tvOS application bundle.

### 5. Reusable Skill: CI/CD TestFlight Matrix Construction
1. Set `strategy.fail-fast: false` on cross-platform deployment matrices (iOS and tvOS) so a build error on one platform does not cancel the upload of the other.
2. In Fastlane, resolve the build increment into an explicit string variable before passing it to both `incrementBuildNumber` and the build lane context.
3. Validate `Info.plist` contains the explicit `CFBundleIcons.CFBundleAlternateIcons` array matching the exact asset names defined in Xcode.

### 6. Decision: Pure Value-Type Timeline Architecture
- **Alternative**: Manage seeking directly inside the player engine class using boolean flags (`isSeeking`).
- **Rationale**: Direct player flag mutation leads to race conditions when scrubbing rapidly over network connections. Isolating state transitions into a pure struct (`PlaybackTimeline`) enables zero-dependency unit testing and prevents state corruption.

### 7. Anti-Pattern: In-Line Floating-Point Division for Time Conversion
```swift
// WRONG: In-line integer division truncates millisecond playback intervals
let seconds = ticks / 10_000_000

// CORRECT: Leverage native Swift Duration with microsecond precision
let duration = Duration.microseconds(ticks / 10)
```

### 8. Verification Method: Layout Clamping & Scroll Threshold Test
```swift
func testScrollThresholdSuppressesJitter() {
    let scrollState = EPGScrollState()
    var emissionCount = 0
    let cancellable = scrollState.visibleLeadingOffsetPublisher
        .sink { _ in emissionCount += 1 }
    
    // First update (initial send from 0 -> 10.0)
    scrollState.update(visibleLeadingOffset: 10.0)
    XCTAssertEqual(emissionCount, 2) // 1 initial + 1 update
    
    // Sub-half-pixel jitter
    scrollState.update(visibleLeadingOffset: 10.3)
    XCTAssertEqual(emissionCount, 2) // Must NOT emit
    
    // Valid delta (> 0.5)
    scrollState.update(visibleLeadingOffset: 10.9)
    XCTAssertEqual(emissionCount, 3) // Must emit
}
```

---

## 7. Actionable Agent Skill & Implementation Checklist

### Autonomous Agent Implementation Checklist
- [ ] **Modifier Ordering Audit**: Inspect all occurrences of `.modifier(...)` paired with `.environmentObject(...)`. Verify that `.environmentObject` wraps the modifier, never precedes it.
- [ ] **Build Increment Atomicity**: In deployment scripts (Fastlane/GitHub Actions), verify that build number calculation `buildNumber = latest + 1` is evaluated once and reused consistently.
- [ ] **tvOS Icon Catalog Configuration**: Verify that all tvOS targets have `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = NO` in `project.pbxproj` and alternate icons declared in `CFBundleIcons`.
- [ ] **Scroll Threshold Guards**: Ensure every continuous scroll publisher bridging to SwiftUI implements a hysteresis filter: `guard abs(current - new) > threshold else { return }`.
- [ ] **Timeline State Isolation**: Ensure media playback managers route seeking through an atomic `PlaybackTimeline` struct utilizing monotonic `UUID` reconciliation.
- [ ] **CJK / Multilingual Text Frame Clamping**: When building poster or card grids, verify that title labels have `.fixedSize(horizontal: false, vertical: true)` and explicit `.lineLimit(...)` to prevent vertical layout collision with media frames.
- [ ] **Database Assertion Routing**: Ensure third-party database logs and assertions are channeled through unified logging (`Logger.swiftfin()`) using `@autoclosure` wrappers rather than unchecked `assert()`.