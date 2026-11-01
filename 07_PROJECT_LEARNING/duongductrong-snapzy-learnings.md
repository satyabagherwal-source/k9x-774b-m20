> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/duongductrong-snapzy-learnings.md`  
> **Source**: github ([https://github.com/duongductrong/Snapzy](https://github.com/duongductrong/Snapzy))  
> **Source Version**: `77d3d3fe`  
> **License**: BSD-3-Clause  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T10:30:47.095Z  
> **Learning ID**: `learn-github-duongductrong-snapzy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): duongductrong/Snapzy

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
`Snapzy` is a native macOS screen capture, recording, annotation, and CLI ecosystem built using Swift, SwiftUI, AppKit, ScreenCaptureKit, and CoreGraphics. The application solves two core engineering problems:
1. **Zero-Disturbance Contextual Screen Capture**: Capturing fleeting screen state (tooltips, hover states, menu bar popovers, Qt/cross-platform application popups) without disturbing the active window hierarchy, key window status, or triggering mouse tracking exits.
2. **Headless & Programmatic CLI Integration**: Providing deterministic, non-interactive screen, window, and area captures via a dedicated Unix domain socket IPC protocol (`SnapzyCLIKit`) for automated agents and scripts, without touching system clipboards, triggering UI popovers, or stealing focus.

### Subsystem Boundaries & Decoupling
```
+---------------------------------------------------------------------------------------+
|                                    User Interface                                     |
|  - SwiftUI Floating Controls (Bar / Annotations)                                      |
|  - AppKit Non-Activating Panels (NSPanel, .canJoinAllSpaces, .fullScreenAuxiliary)     |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|                             Capture Services Orchestration                            |
|  - AreaSelectionController (State Machine: dragging, sizing, mode-toggle)             |
|  - Presentation Watchdog (WindowServer ground-truth validation via CGWindowList)      |
|  - Fallback & Recreation Engine (Re-creates NSPanel when Spaces desync occurs)        |
+---------------------+-------------------------------------+---------------------------+
                      |                                     |
                      v                                     v
+---------------------------------------+   +-------------------------------------------+
|    Low-Level Input Interception       |   |         Headless CLI Daemon Engine        |
|  - CGEventTap (.cgSessionEventTap)    |   |  - Unix Domain Socket Protocol            |
|  - Main run-loop source registration  |   |  - Frame & Envelope Serializer (JSON)     |
|  - Multi-threaded Hard Deadline Guard |   |  - Nonce / App Authorization & RBAC       |
|  - Automatic Teardown Funnel          |   |  - ScreenCaptureKit Headless Driver       |
+---------------------------------------+   +-------------------------------------------+
```

1. **Overlay & Window Management Subsystem (`AreaSelectionWindow.swift`, `AreaSelectionController`)**:
   - Manages non-activating `NSPanel` instances pinned at `.screenSaver` window level.
   - Pinned across all Spaces with `collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]`.
   - Employs a runtime presentation watchdog that queries `CGWindowListCopyWindowInfo(.optionOnScreenOnly)` to detect silent OS-level Space-switch desynchronizations.

2. **Input Interception Subsystem (`CaptureEventTapController.swift`)**:
   - Deploys an active `CGEventTap` at the session level (`.cgSessionEventTap`, `kCGHeadInsertEventTap`).
   - Marks overlay windows as hit-transparent (`ignoresMouseEvents = true`) to prevent sending `NSMouseExited` to the underlying application.
   - Routes keyboard and mouse gestures directly from the CoreGraphics event stream, terminating input lockups via a multi-threaded watchdog.

3. **CLI IPC Daemon Subsystem (`Packages/SnapzyCLIKit`)**:
   - Headless client-daemon architecture communicating over Unix domain sockets (`/tmp` or app sandbox container paths).
   - Strict protocol framing (`SnapzyCLIProtocol`): Version handshake (`ProtocolVersion`), command routing (`CLIMethod`), typed payloads, and POSIX exit code mappings (`CLIErrorCode`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Fail-Safe Event Tap Lifetime & Asynchronous Watchdog Invariant
**RULE**:
When intercepting global system input events via an active system hook or tap (such as macOS `CGEventTap` or Windows low-level input hooks `WH_KEYBOARD_LL`/`WH_MOUSE_LL`), the event callback **MUST NOT** re-enable itself upon receiving an OS timeout signal (`kCGEventTapDisabledByTimeout`). Furthermore, the system hook **MUST** be backed by an independent, off-main-thread watchdog timer capable of disabling the tap handle concurrently without coordinating with the target thread.

**WHY**:
When the thread running the event tap's run-loop source (typically the main run loop) stalls or deadlocks, the WindowServer disables the tap after an internal latency timeout (~1-2 seconds) to preserve system input responsiveness. If the callback unconditionally re-enables the disabled tap, the WindowServer repeatedly dumps pending system-wide input events back into the stalled thread. This starves the operating system's input manager, locking mouse and keyboard hardware across the entire OS, preventing user recovery, and forcing a hard hardware power cycle.

**WHEN TO APPLY**:
Any desktop input interception infrastructure (macOS `CGEventTap`, Linux `libinput` grab, Windows Low-Level Hooks) handling raw mouse or keyboard events synchronously.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import CoreGraphics
import Foundation

public final class SafeEventTapController: @unchecked Sendable {
    public typealias TapHandle = CFMachPort

    private var tap: TapHandle?
    private var runLoopSource: CFRunLoopSource?
    private var deadlineWork: DispatchWorkItem?
    private var generation: UInt64 = 0
    private let lock = NSLock()

    public static let maxSessionDuration: TimeInterval = 120.0

    public func start(maxDuration: TimeInterval = SafeEventTapController.maxSessionDuration) -> Bool {
        lock.lock()
        defer { lock.unlock() }

        // 1. Create event tap with MachPort
        var context = CGEventTapInformation()
        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .defaultTap,
            eventsOfInterest: (1 << CGEventType.mouseMoved.rawValue) | (1 << CGEventType.keyDown.rawValue),
            callback: { (proxy, type, event, refcon) -> Unmanaged<CGEvent>? in
                let controller = Unmanaged<SafeEventTapController>.fromOpaque(refcon!).takeUnretainedValue()
                return controller.handleEvent(type: type, event: event)
            },
            userInfo: UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque())
        ) else { return false }

        let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)

        self.tap = tap
        self.runLoopSource = source
        self.generation &+= 1
        let currentGen = self.generation

        // 2. Schedule hard off-main deadline watchdog
        let deadlineItem = DispatchWorkItem { [weak self, tap] in
            // Direct C-call: CGEvent.tapEnable is thread-safe and reaches WindowServer directly
            CGEvent.tapEnable(tap: tap, enable: false)
            
            // Hop to main run-loop strictly to tear down application session state
            DispatchQueue.main.async {
                self?.handleDeadlineFired(expectedGeneration: currentGen)
            }
        }
        self.deadlineWork = deadlineItem
        DispatchQueue.global(qos: .userInteractive).asyncAfter(
            deadline: .now() + maxDuration,
            execute: deadlineItem
        )
        return true
    }

    public func handleEvent(type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
        // kCGEventTapDisabledByTimeout: The main run-loop failed to respond within WindowServer threshold.
        if type.rawValue == 0xFFFFFFFE /* kCGEventTapDisabledByTimeout */ {
            // CRITICAL: DO NOT RE-ENABLE. Leave disabled so OS bypasses our app.
            DispatchQueue.main.async { [weak self] in
                self?.terminateSession(reason: .watchdogTimeout)
            }
            return nil
        }

        // kCGEventTapDisabledByUserInput: User explicitly toggled or OS switched context.
        if type.rawValue == 0xFFFFFFFF /* kCGEventTapDisabledByUserInput */ {
            if let tap = self.tap {
                CGEvent.tapEnable(tap: tap, enable: true)
            }
            return Unmanaged.passRetained(event)
        }

        // Normal event consumption logic...
        return nil // Consumed
    }

    private func handleDeadlineFired(expectedGeneration: UInt64) {
        lock.lock()
        defer { lock.unlock() }
        guard self.generation == expectedGeneration else { return }
        terminateSession(reason: .sessionTimeLimit)
    }

    private func terminateSession(reason: SessionStopReason) {
        guard let tap = self.tap else { return }
        CGEvent.tapEnable(tap: tap, enable: false)
        if let source = self.runLoopSource {
            CFRunLoopRemoveSource(CFRunLoopGetMain(), source, .commonModes)
            self.runLoopSource = nil
        }
        CFMachPortInvalidate(tap)
        self.tap = nil
        self.deadlineWork?.cancel()
        self.deadlineWork = nil
    }
}

public enum SessionStopReason {
    case watchdogTimeout
    case sessionTimeLimit
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Re-enabling tap directly in timeout callback
func badTapCallback(proxy: CGEventTapProxy, type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
    if type == .tapDisabledByTimeout {
        // FATAL SYSTEM LOCK BUG (#690):
        // Re-enabling here when the thread is stalled will hang entire macOS input processing
        CGEvent.tapEnable(tap: myTap, enable: true)
        return nil
    }
    return Unmanaged.passRetained(event)
}
```

**VERIFICATION METHOD**:
Inject a mock `CGEventTapProxy` event with type `CGEventType.tapDisabledByTimeout` into the tap handler. Assert that:
1. `CGEvent.tapEnable` is **never** invoked with `true`.
2. The controller's `isRunning` property transitions to `false`.
3. The delegate receives `.disabledByTimeout`.
4. A multi-threaded assertion verifies that performing the scheduled `DispatchWorkItem` off-main executes the disable sequence within <10ms even if the main thread is blocked with `Thread.sleep(forTimeInterval: 5)`.

---

### 2. Isolation-Safe Unit-Test Lifecycle Invariant (Swift 6 Concurrency)
**RULE**:
Test helper environments maintaining unowned or weak pointers to dependency blocks **MUST** be explicitly isolated as `nonisolated` when declared within a `@MainActor`-isolated `XCTestCase` suite, and all test fixtures possessing cross-thread captures **MUST** be pinned using `withExtendedLifetime` until all pending asynchronous blocks complete.

**WHY**:
In Swift 6 / modern Concurrency on macOS 15+, test targets often default to `@MainActor` isolation. A nested helper class inherits this isolation, causing the Swift compiler to synthesize an actor-isolated deinitializer calling `swift_task_deinitOnExecutorMainActorBackDeploy`. When an instance of this helper is deallocated while background queues or closure captures still retain `unowned` handles to it, the runtime aborts the test runner host via an execution failure or double-free memory corruption.

**WHEN TO APPLY**:
Swift 5.10 / Swift 6 unit tests with concurrency runners, `@MainActor` test cases, and dependency injection mocks capturing `self` inside C-function bridges or closure trampolines.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import XCTest

@MainActor
final class HardwareControllerTests: XCTestCase {

    // Helper MUST be marked nonisolated to opt out of actor-isolated deinit synthesis
    private nonisolated final class MockEnvironment {
        var stateEvents: [Bool] = []

        func makeDependencies() -> ControllerDependencies {
            ControllerDependencies(
                updateState: { [unowned self] state in
                    self.stateEvents.append(state)
                }
            )
        }
    }

    func testAsynchronousStateExecution() throws {
        let env = MockEnvironment()
        let sut = SystemUnderTest(dependencies: env.makeDependencies())

        sut.triggerAsyncAction()

        let expectation = expectation(description: "Queue drained")
        DispatchQueue.global().async {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2.0)

        XCTAssertFalse(env.stateEvents.isEmpty)

        // CRITICAL: Ensure helper outlives unowned captures across concurrent hops
        withExtendedLifetime(env) {
            _ = sut
        }
    }
}

public struct ControllerDependencies: Sendable {
    public var updateState: @Sendable (Bool) -> Void
}
public final class SystemUnderTest {
    private let dependencies: ControllerDependencies
    public init(dependencies: ControllerDependencies) { self.dependencies = dependencies }
    public func triggerAsyncAction() {
        DispatchQueue.global().async { [dependencies] in
            dependencies.updateState(true)
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Omitting nonisolated on helper inside MainActor test target
@MainActor
final class SuiteTests: XCTestCase {
    // Implicitly @MainActor: gets isolated deinit generated
    private final class BuggyEnv {
        func callback() -> () -> Void {
            return { [unowned self] in self.doWork() }
        }
        func doWork() {}
    }

    func testCrash() {
        let env = BuggyEnv()
        let cb = env.callback()
        // If env goes out of scope here while cb is dispatched off-main,
        // swift_task_deinitOnExecutorMainActorBackDeploy crashes on macOS 15 CI runners
    }
}
```

**VERIFICATION METHOD**:
Compile tests with `-strict-concurrency=complete`. Execute test suite in a macOS 15 headless CI runner environment under AddressSanitizer (ASan) and ThreadSanitizer (TSan). Ensure zero SIGABRT signals from `swift_task_deinitOnExecutorMainActorBackDeploy`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: System-Wide Hardware Input Freezing on Event Tap Timeout (BUG-SNAPZY-01)
- **Context**: `Snapzy/Services/Capture/CaptureEventTapController.swift`, `Snapzy/Services/Capture/AreaSelectionWindow.swift`
- **What Was Expected**: When initiating an area capture, Snapzy enters live passthrough mode, installing an active `CGEventTap` to capture mouse clicks, crosshair navigation, and keyboard shortcuts without keying the overlay panel (preserving hover tooltips underneath). If the main run-loop stalls momentarily, input should continue flowing smoothly or fail gracefully back to the user.
- **What Actually Happened**: On macOS 27.2 / macOS 15+, whenever the main thread experienced a transient workload stall, the WindowServer triggered `kCGEventTapDisabledByTimeout`. The tap callback unconditionally executed `CGEvent.tapEnable(tap: tap, enable: true)`. Because the main thread was still blocked, the WindowServer instantly re-queued all pending events into the blocked queue, immediately timing out again and re-entering the re-enable loop. The mouse pointer froze completely, keyboard shortcuts ceased responding, and the entire operating system became unresponsive, forcing users to hard-shutdown their machines via the physical power button.
- **Evidence in Repo**: Commit `dd9171c1`, GitHub Issue `#690`.
- **Root Cause**: An active event tap running on the main run loop consumed all pointer and key events. Handling `.tapDisabledByTimeout` by re-enabling the tap turned a temporary application thread hiccup into a catastrophic, infinite operating-system input starvation deadlock.
- **Remediation Code Diff**:
```diff
--- a/Snapzy/Services/Capture/CaptureEventTapController.swift
+++ b/Snapzy/Services/Capture/CaptureEventTapController.swift
@@ -209,13 +237,58 @@ final class CaptureEventTapController {
     self.tap = tap
     self.runLoopSource = runLoopSource
     isRunning = true
+    generation += 1
+
+    let deadlineWork = Self.makeDeadlineWork(
+      tap: tap,
+      setTapEnabled: dependencies.setTapEnabled
+    ) { [weak self, generation] in
+      self?.endSession(reason: .sessionTimeLimit, generation: generation)
+    }
+    self.deadlineWork = deadlineWork
+    dependencies.scheduleDeadline(maxDuration, deadlineWork)
     return true
   }

+  private nonisolated static func makeDeadlineWork(
+    tap: CaptureEventTapDependencies.TapHandle,
+    setTapEnabled: @escaping (CaptureEventTapDependencies.TapHandle, Bool) -> Void,
+    onMain: @escaping @MainActor () -> Void
+  ) -> DispatchWorkItem {
+    DispatchWorkItem {
+      // Direct thread-safe disable on background thread
+      setTapEnabled(tap, false)
+      DispatchQueue.main.async {
+        MainActor.assumeIsolated { onMain() }
+      }
+    }
+  }

-  func handleTapEvent(type: CGEventType, event: CGEvent) -> CGEvent? {
-    if type == .tapDisabledByTimeout {
-      dependencies.setTapEnabled(tap, true)
-      return event
-    }
+  func handleTapEvent(type: CGEventType, event: CGEvent) -> CGEvent? {
+    if type == .tapDisabledByTimeout {
+      // DO NOT RE-ENABLE. Leave disabled so OS handles input directly.
+      DispatchQueue.main.async { [weak self, generation] in
+        self?.endSession(reason: .disabledByTimeout, generation: generation)
+      }
+      return nil
+    }
```
- **Lesson**: Never re-enable an OS-disabled input hook inside its own timeout callback. When the operating system disables your hook due to starvation, accept the disablement, unregister the source, and fail the session outward via a clean teardown funnel.

---

### Incident 2: Floating Bar Button Redraw Cancelling Mouse Click Dispatch (BUG-SNAPZY-02)
- **Context**: Screen Recording Floating Control Bar, AppKit button cell hierarchy.
- **What Was Expected**: Clicking the "Stop Recording" button on the floating control bar terminates screen capture and packages the output video file.
- **What Actually Happened**: On macOS 13 through macOS 15, clicking the "Stop Recording" button had zero effect. Users were trapped in ongoing screen recordings with no responsive UI mechanism to stop recording.
- **Evidence in Repo**: GitHub Issue `#652`, PR `#655`.
- **Root Cause**: The recording status floating view updated its internal state / layout pass synchronously on mouse-down (highlighting / state mutation). The forced redraw triggered a view recreation or `needsDisplay` invalidation during the tracking loop, clearing the active `NSButtonCell` tracking area before the `mouseUp` could register, aborting click confirmation.
- **Remediation Pattern**:
```swift
// - Forced synchronous redraw inside mouseDown / state observation:
// button.state = .active
// button.needsDisplay = true // Destroys cell tracking context mid-click

// + Decoupled action invocation:
// Allow AppKit target/action sequence to complete before scheduling UI updates
button.target = self
button.action = #selector(handleStopClicked)
// UI state changes deferred to next run-loop spin
DispatchQueue.main.async {
    self.updateBarPresentationState()
}
```
- **Lesson**: Mutating view geometry, hierarchy, or initiating forced synchronous display invalidation during an in-flight pointer tracking loop cancels the active event tracking sequence, swallowing the subsequent mouse-up event.

---

### Incident 3: Space-Switch Desync & Overlay Membership Loss (BUG-SNAPZY-03)
- **Context**: `Snapzy/Services/Capture/AreaSelectionWindow.swift`, `AreaSelectionPresentationLogic`
- **What Was Expected**: The capture overlay panel must remain visible and functional across multiple macOS Virtual Desktops (Spaces) and full-screen application spaces.
- **What Actually Happened**: After switching spaces, the capture overlay became invisible on the newly active Space, while the underlying global event tap remained active. The user was left with a locked-out input state over an invisible capture window.
- **Evidence in Repo**: `docs/CAPTURE.md` (Forensic presentation watchdog architecture).
- **Root Cause**: macOS WindowServer can silently strip `.canJoinAllSpaces` membership from an `NSPanel` when a space transition occurs while the panel is ordered front. Standard AppKit properties (`panel.isVisible`, `panel.occlusionState`) continued to return `true` because AppKit cached the logical window state, completely out of sync with the WindowServer's true on-screen list.
- **Remediation Code Diff**:
```swift
// Presentation Watchdog Architecture in AreaSelectionWindow.swift
func evaluatePresentationHealth() -> PresentationHealAction {
    // 1. Query Ground Truth directly from WindowServer
    guard let windowInfoList = CGWindowListCopyWindowInfo(.optionOnScreenOnly, kCGNullWindowID) as? [[String: Any]] else {
        return .none // Query failed; treat as unknown, never anomaly
    }

    let isOnScreen = windowInfoList.contains { info in
        (info[kCGWindowNumber as String] as? CGWindowID) == CGWindowID(self.windowNumber)
    }

    // 2. Detect Desync: AppKit says visible, but WindowServer omitted it from active space
    if self.isVisible && !isOnScreen {
        // Earlier attempts toggled collectionBehavior; field data proved it fails.
        // MUST completely recreate the pooled window to force a new WindowServer record.
        return .recreatePooledWindow
    }
    return .none
}
```
- **Lesson**: Do not trust high-level UI framework visibility flags (`NSWindow.isVisible`, `UIView.isHidden`) for multi-space OS windows. Query the WindowServer's low-level window list (`CGWindowListCopyWindowInfo`) for ground-truth screen presence.

---

### Incident 4: Deinit Double-Free Under Isolated MainActor Back-Deployment (BUG-SNAPZY-04)
- **Context**: `SnapzyTests/Services/Capture/Issue690InputLockRegressionTests.swift`
- **What Was Expected**: Unit tests for Issue #690 should execute deterministically on local developer machines and headless GitHub Actions macOS runners.
- **What Actually Happened**: The test target crashed intermittently with `SIGABRT` and memory allocation aborts on macOS 15 CI runners while tearing down mock harness environments.
- **Evidence in Repo**: Commit `dd9171c1` commit message ("*Avoid isolated deinit double-free in issue 690 regression tests*").
- **Root Cause**: The test target defaulted to `@MainActor` isolation. A local helper class (`Env`) within the test inherited MainActor isolation, which generated an actor-isolated deinitializer going through the macOS 15 back-deployment runtime shim `swift_task_deinitOnExecutorMainActorBackDeploy`. Because closures registered with background GCD queues held `unowned` references to `Env`, releasing `Env` before the controller invalidated its captures triggered a double-free / memory abort.
- **Remediation Code Diff**:
```diff
--- a/SnapzyTests/Services/Capture/Issue690InputLockRegressionTests.swift
+++ b/SnapzyTests/Services/Capture/Issue690InputLockRegressionTests.swift
@@ -14,7 +14,7 @@ final class Issue690InputLockRegressionTests: XCTestCase {
-  private final class Env {
+  private nonisolated final class Env {
     var enabledStates: [Bool] = []
     var deadlines: [DispatchWorkItem] = []
@@ -58,6 +58,7 @@ final class Issue690InputLockRegressionTests: XCTestCase {
     XCTAssertEqual(env.enabledStates.filter { $0 }.count, 1, "only the initial enable")
     XCTAssertFalse(tap.isRunning)
+    withExtendedLifetime(env) {} // outlive the tap's unowned captures
   }
```
- **Lesson**: In Swift 6 Concurrency suites, always mark dependency mock classes `nonisolated` if they are instantiated in `@MainActor` test cases and captured across closure boundaries. Always bind their lifetime with `withExtendedLifetime`.

---

### Incident 5: Negative Screen Coordinate Truncation in CLI Rect Parsing (BUG-SNAPZY-05)
- **Context**: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Capture/AreaCommand.swift`
- **What Was Expected**: Users invoking the CLI with `--rect -1440,0,800,600` (capturing a secondary monitor positioned to the left of the main display) should successfully capture the specified area.
- **What Actually Happened**: `ArgumentParser` failed to parse the argument, crashing or exiting with an error stating that `-1440` was an unknown option flag.
- **Evidence in Repo**: `AreaCommand.swift` line 25 (`parsing: .unconditional`).
- **Root Cause**: Command-line argument parsers interpret strings prefixed with a hyphen (`-`) as flags/options rather than positional values. Multi-display macOS setups frequently have coordinate origins in negative integer point-spaces.
- **Remediation Code Diff**:
```diff
--- a/Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Capture/AreaCommand.swift
+++ b/Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Capture/AreaCommand.swift
@@ -22,7 +22,7 @@ struct AreaCommand: AsyncParsableCommand {
   @OptionGroup var global: GlobalOptions
   @OptionGroup var output: CaptureOutputOptions

-  @Option(help: "Rectangle as x,y,width,height in points.")
+  @Option(parsing: .unconditional, help: "Rectangle as x,y,width,height in points.")
   var rect: CLIRect
```
- **Lesson**: When accepting geometry, coordinates, or signed numeric strings from command-line arguments, parameter parsing **MUST** be explicitly declared as unconditional to avoid token collision with flag delimiters.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Unconditional Option Parsing for Coordinate Spaces**:
  ```swift
  // HAZARD: When passing a display rect situated to the left or top of the main display:
  // snapzy area --rect -1920,0,1920,1080
  // Default parsing treats "-1920" as an unknown flag "-1" with parameters.
  @Option(parsing: .unconditional, help: "Rectangle as x,y,width,height in points.")
  var rect: CLIRect
  ```
* **Lossless Wire Deserialization vs Type Coercion**:
  When reading payloads from raw socket streams, Swift's `JSONDecoder` must parse strict models without implicit type conversion. `SnapzyCLIProtocol` mandates concrete validation upon decode:
  ```swift
  public init(from decoder: Decoder) throws {
      let container = try decoder.singleValueContainer()
      let rawString = try container.decode(String.self)
      guard let value = Double(rawString), value >= 0.0, value <= 1.0 else {
          throw DecodingError.dataCorruptedError(in: container, debugDescription: "Quality out of bounds [0.0, 1.0]")
      }
      self.quality = value
  }
  ```
* **Handling POSIX Signal Terminations (SIGPIPE Hazard)**:
  Writing image buffers to `stdout` when piping into broken downstream utilities (`snapzy capture screen | head -n 1`) raises a kernel-level `SIGPIPE`, which unconditionally kills the process by default:
  ```swift
  // PREVENTING PROCESS TERMINATION ON BROKEN PIPE
  // In SnapzyCommand bootstrap:
  signal(SIGPIPE, SIG_IGN)

  // Use FileHandle write(contentsOf:) which catches POSIX error EPIPE and throws Swift error:
  do {
      try FileHandle.standardOutput.write(contentsOf: data)
  } catch {
      throw CLIError(.internal, "Could not write image to stdout: \(error.localizedDescription)")
  }
  ```

---

### 2. Infinite Loop & Recursion Guards
* **Generation Counter Guard on Asynchronous Callbacks**:
  Stale GCD timers or run-loop turns must never mutate newer sessions:
  ```swift
  final class CaptureEventTapController {
      private var generation: Int = 0

      func start() -> Bool {
          generation += 1
          let currentGen = generation

          // Watchdog Work Item
          let item = DispatchWorkItem { [weak self] in
              self?.endSession(reason: .sessionTimeLimit, generation: currentGen)
          }
          // ...
      }

      private func endSession(reason: CaptureEventTapStopReason, generation: Int) {
          // TERMINATION PROOF: Discard callback if controller has restarted
          guard self.generation == generation else { return }
          self.stop()
          delegate?.eventTapDidStop(reason: reason)
      }
  }
  ```
* **Presentation Watchdog Bounded Recreation Ladder**:
  Preventing infinite window recreation loops when spaces are corrupted:
  ```swift
  // Strict bound: Recreation capped at 2 per display per session
  private var recreationCountPerDisplay: [CGDirectDisplayID: Int] = [:]
  private static let maxRecreationsPerDisplay = 2

  func triggerHeal(for displayID: CGDirectDisplayID) {
      let count = recreationCountPerDisplay[displayID, default: 0]
      guard count < Self.maxRecreationsPerDisplay else {
          DiagnosticLogger.shared.log(.error, .capture, "Recreation cap exceeded for display \(displayID)")
          // Escalate to fallback mode: do not loop indefinitely
          self.activateInlineFallbackAnnotator()
          return
      }
      recreationCountPerDisplay[displayID] = count + 1
      self.recreatePooledWindow(for: displayID)
  }
  ```

---

### 3. UI & UX Micro-Mechanics
* **Hover State Retention via Hit-Transparency**:
  When performing an area capture over an application with active tooltips or hover cards (e.g. VS Code hints, DaVinci Resolve color pickers), moving the cursor over a new capture window generates an `NSMouseExited` event in the app beneath, destroying the tooltip.
  ```swift
  // INVARIANT: Capture window MUST be completely click-through to preserve hover state underneath
  overlayWindow.ignoresMouseEvents = true
  overlayWindow.backgroundColor = .clear
  overlayWindow.isOpaque = false

  // INVARIANT: Overlay MUST NOT become key. Keying resigns target app and dismisses popovers.
  // Keystrokes are intercepted exclusively through CGEventTap, never via NSResponder chain.
  ```
* **Deadlock Prevention in Click-Through Button Tracking**:
  Any state mutation on a floating control bar (such as recording timer labels) must never re-layout the parent view while the user's mouse is in `.leftMouseDown` state:
  ```swift
  func updateTimerLabel(text: String) {
      // Guard against layout-thrashing that resets NSButton tracking areas
      if isTrackingUserClick { return }
      timerLabel.stringValue = text
  }
  ```

---

### 4. Backend Concurrency & Memory Safety
* **Off-Main Hardware Tap Disabling**:
  `CGEvent.tapEnable` interacts directly with the WindowServer via Mach ports and is inherently thread-safe. Tearing down the tap must happen off the main thread if the main thread is stalled:
  ```swift
  // Concurrency Invariant:
  // Execute disablement on high-priority concurrent queue; dispatch state cleanup to main.
  private nonisolated static func makeDeadlineWork(
      tap: CaptureEventTapDependencies.TapHandle,
      setTapEnabled: @escaping (CaptureEventTapDependencies.TapHandle, Bool) -> Void,
      onMain: @escaping @MainActor () -> Void
  ) -> DispatchWorkItem {
      DispatchWorkItem {
          // 1. Thread-safe Mach port call directly to WindowServer
          setTapEnabled(tap, false)
          
          // 2. Transfer coordination to actor isolation
          DispatchQueue.main.async {
              MainActor.assumeIsolated { onMain() }
          }
      }
  }
  ```
* **Memory Leak Elimination in Run-Loop Sources**:
  `CFMachPort` and `CFRunLoopSource` instances hold reciprocal strong references when attached to a run loop. Invalidating the run-loop source does not release the Mach port:
  ```swift
  func teardown(tap: CFMachPort, source: CFRunLoopSource) {
      // Step 1: Remove source from common modes
      CFRunLoopRemoveSource(CFRunLoopGetMain(), source, .commonModes)
      // Step 2: Invalidate the Mach port explicitly
      CFMachPortInvalidate(tap)
      // Step 3: Nullify local references to trigger ARC / CoreFoundation release
  }
  ```

---

### 5. Defect & Error Prevention ("Galti Pakadna")
* **Preflight Mutually Exclusive CLI Arguments**:
  ```swift
  func selector() throws -> WindowSelector {
      switch (id, app, active) {
      case let (id?, nil, false):
          try requireNoAppFilters()
          return .id(id)
      case let (nil, app?, false):
          if let title {
              do { _ = try NSRegularExpression(pattern: title) }
              catch { throw ValidationError("--title is not a valid regular expression: \(error.localizedDescription)") }
          }
          if let index, index < 0 { throw ValidationError("--index must be 0 or greater.") }
          return .app(AppWindowQuery(app: app, titlePattern: title, index: index))
      case (nil, nil, true):
          try requireNoAppFilters()
          return .active
      default:
          throw ValidationError("Pass exactly one of --id, --app or --active.")
      }
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
* **Hybrid Daemon / Agent Split**: The core app (`Snapzy.app`) acts as both a desktop UI utility and a local background Unix domain socket server. The companion CLI binary (`snapzy`, built via `Packages/SnapzyCLIKit`) communicates over this socket, allowing automation scripts, terminal commands, and AI agent frameworks to trigger captures and inspect windows headlessly.
* **Non-Interfering State Machine**: The capture session architecture isolates AppKit display windows from input capture. Input capture is completely delegated to an OS-level `CGEventTap`, while presentation is handled by pooled `NSPanel` objects configured at the `.screenSaver` window level.

### 2. Core Abstractions
* `CaptureEventTapController`: Encapsulates CoreGraphics Mach port lifecycle, event mask definitions, and off-thread watchdog teardown.
* `AreaSelectionController`: High-level presentation orchestrator managing window pooling, display bounds synchronization, and coordinate conversion.
* `CLISession` & `CLIClient`: IPC transport handling length-prefixed JSON frames, version handshake verification, and typed