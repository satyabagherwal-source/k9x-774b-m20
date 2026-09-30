# Forensic Learning Record (Deep Inspection): mrkai77/Loop

> **Canonical Artifact**: `07_PROJECT_LEARNING/mrkai77-loop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mrkai77/Loop](https://github.com/mrkai77/Loop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:52:02.125Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mrkai77/Loop`
- **Description**: Window management made elegant.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11705 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1165** (2026-09-30): **🐞 Gesture reliability fixes**
  *Symptoms*: This PR includes a few stability fixes for trackpad gestures:  1. Always re-enables event taps disabled by the system, including by secure input, and pauses briefly instead of tearing a tap down when it keeps timing out, 1. Makes the gesture blocker a single long-lived tap gated by a reference count, which only blocks trackpad input. Mouse wheel scrolls now pass through, and scroll/gesture end phases are always delivered so apps don't get stuck mid-scroll, 1. Logs why gestures are rejected, errors that were previously swallowed when opening Loop, and gestures disabled due to conflicts, 1. Clears `SystemGestureFilter`'s finger counts when a device stops or is removed, and keeps touch IDs unique across restarts, 1. Only resumes cycle progress for gestures, and so the radial menu goes back to its previous behavior, 1. Makes gestures respect "Resize window under cursor". When disabled, gestures target the focused window, and titlebar-only gestures only activate on its titlebar.  Also includes some Subsurface fixes, which include retrying devices that fail to start, rebuilding devices after wake, and correctly detecting the trackpad on Intel MacBook Pros with a Touch Bar (it was previously treated as the Touch Bar itself!)

- **Issue #1160** (2026-09-29): **🐞 Fix wallpaper capture on macOS 27**
  *Symptoms*: ## Description  The wallpaper window is not owned by the Dock process, so wallpaper capture always used the fallback method, which requests screen recording permissions. This method doesn't check the window owner but the `kCGWindowLayer` instead, which for the wallpaper window is always below 0. Additional advantage of the intended method is that it doesn't request screen recording permissions.  ## How has this been tested?  Tested on both macOS 27 and macOS 14(VM) with different wallpaper types like aerial, dynamic, photo.  ## Checklist:  - [x] I have performed a self-review of my own code - [x] I have made corresponding changes to the documentation if applicable - [x] I have no unrelated changes in this PR.  ## Please describe to which degree, if any, an LLM was used in creating this pull request.  N/A 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your feedback. I added your suggestions in `5282cbe`.  I actually didn't check the `kCGWindowOwnerName` on other versions than 27.0 since i had the screen recording popup appear before too, but I guess this would be from an old method you used to get the wallpaper?

- **Issue #1147** (2026-09-07): **🐞 Media key presses incorrectly trigger window snapping**
  *Symptoms*: ### Bug Description  When pressing any of the media keys located at the top of the keyboard, the key does not need to be held down, a single press is sufficient to activate the function. After pressing a media key, pressing any arrow key unexpectedly triggers the window-snapping behavior.  ### Affected Scope  User interface  ### Steps to Reproduce  1. First Step, press any media keys, don't need to hold it. 2. Second step, press any arrow keys, it will trigger window snapping.  ### Reproducibility  Always  ### Expected vs Actual Behavior  Expected behavior: Media keys should only perform their assigned function and should not affect subsequent keyboard input.  Actual behavior: After a single media key press, subsequent arrow-key presses trigger window snapping unexpectedly.  ### Screen Recordings / Screenshots  _No response_  ### Severity  Blocker (cannot proceed)  ### macOS Version  Tahoe 26.6.2  ### Loop Version  Version 🧪 1.4.3 (1763)  ### Did You Try the Development Build?  Yes  ### Additional Context  _No response_  ### Final Checks  - [x] My issue is written in English. - [x] My issue title is descriptive. - [x] This is a single bug (multiple bugs should be reported individually). - [x] I have looked to see if this is a duplicate of another bug report. - [ ] I can help with further investigation. - [ ] I can help with developing a fix for this issue.
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this! I’m closing this issue since it’s a duplicate of another one. That said, I’ve been able to reproduce the issue on my end and will be looking into possible fixes :)

- **Issue #1142** (2026-08-29): **🐞 Harden window focus sequence**
  *Symptoms*: Updates Loop's window focus behavior. The previous sequence raised and keyed the window multiple times. It now:  1. Makes the target process and window frontmost, 1. Posts one mouse-down event to make the target window key without completing a click, 1. Raises the window once through Accessibility, 1. Falls back to `NSRunningApplication.activate` if private fronting fails, 1. Uses a far bottom-right event point to avoid Chromium's NaN handling and the window's resize region.  Previously, Loop sent two synthetic clicks at `(-1, -1)` to raise a window. On macOS 27, these could register as a double-click on the title bar and expand the window (interestingly, this did not happen on macOS 26). Moving the point to `(300000, 300000)` and omitting mouse-up prevents the synthetic event from triggering either behavior. The updated focus sequence and coordinate are based on AltTab's current implementation :)

- **Issue #1134** (2026-08-31): **🐞 Two-key cycles do not advance when both action keys are released between presses**
  *Symptoms*: ### Bug Description  A cycle assigned to a two-key action binding such as ↑ + ← does not advance when I release both action keys and press the same combination again.  The first item in the cycle fires, but repeating the full two-key combination repeats the first item of the cycle instead of advancing. If I keep one arrow held and repeatedly tap the other arrow, the cycle advances correctly.  Single-arrow cycles continue to work normally.  ### Affected Scope  Other  ### Steps to Reproduce  1. Keep the standard single-arrow cycles assigned to ↑, ↓, ←, and →. 2. Create a custom cycle with at least two actions. 3. Assign that cycle to a two-arrow combination, such as ↑ + ←. 4. Hold Loop’s trigger key so that Loop remains active. 5. Press ↑ + ←, then release both arrows. The first cycle action fires. 6. Press and release ↑ + ← again while continuing to hold the trigger. 7. Observe that the corner cycle remains on its first action instead of advancing. 8. As a workaround, press both arrows, keep one arrow held, and repeatedly tap the other. The cycle then advances correctly.  ### Reproducibility  Always  ### Expected vs Actual Behavior  Expected: Repeatedly pressing and releasing the same two-key combination should advance through the configured cycle, just as repeatedly pressing a single-key cycle binding does.  Actual: The first cycle action fires, but releasing both action keys and pressing the combination again does not advance the cycle. Keeping one arrow held and tapping the
  **Post-Mortem & Fix Analysis**:
  > This issue should be fixed now! Please test it by updating to the latest development build. You can enable development builds by turning on "Include development versions" in Loop's About tab.  If it still doesn't work as expected, please let us know here :)
  > Wow, that was fast! Works great, thanks so much! :)  One very minor thing I noticed while testing, probably doesn't need to be fixed since it ends up working correctly and it doesn't affect usability at all, but just wanted to flag it for thoroughness.  On the second press of a two-key binding, the preview often, but not always briefly flashes the single-key action before settling on the correct one. For example, pressing ↑ + ← the first time almost always shows the correct preview immediately. Pressing ↑ + ← again frequently flashes the ↑-only preview for an instant, then resolves to the second item of the ↑ + ← cycle.  
  > Happy to hear that it's working well!  As for your concern, I did notice that too, but ultimately ended up keeping that behavior, so it is intentional. The other option would have been to introduce a minuscule delay before processing the keys, giving a bit of buffer time to press additional keys before activating an action. In testing, though, that ended up making everything feel noticeably more laggy, so I preferred the current behavior :)

- **Issue #1132** (2026-08-09): **🐞 Fix makeKeyWindow NaN coords that terminate Chromium PWA shims**
  *Symptoms*: ## Description  Loop’s synthetic `makeKeyWindow` focus event filled `windowLocation` with `0xFF` bytes, which decode as **NaN** doubles. A Chromium regression caused Mojo to terminate the PWA app-shim connection when those values were received (`app_shim_controller.mm:679` Channel error), so installed Chromium/Brave/Edge PWAs quit when Loop focused them before resize.  This ports [AltTab’s fix](https://github.com/lwouis/alt-tab-macos/commit/782f1fe2e7272f185526e3e69eadd08c241fe050): - Use a finite off-content point `CGPoint(x: -1, y: -1)` instead of `0xFF` fill - Widen the event buffer to `0x100` (record length stays `0xf8`)  The earlier Chromium-PWA-only resize workaround was removed in favor of this general fix.  Upstream: - Chromium sanitization: https://chromium.googlesource.com/chromium/src.git/+/72561e6e2170a66a9b41e8ca31838b9f6bc0b3a4 - Public report: https://issues.chromium.org/issues/539984770 - Canonical (restricted): https://issues.chromium.org/issues/537448007  Fixes #1131  ## How has this been tested?  Tested on macOS Tahoe 26.6 with a local Debug build.  - [x] Brave Google Keep / Chat PWAs — keybind snaps no longer quit the app - [x] Chrome / Brave browser windows — still focus/resize normally - [x] Safari Keep PWA / TextEdit — still fine - [x] Re-verify after this AltTab-style revision (author): Keep/Chat PWA snap + focus still healthy  <details><summary><h2>Screencast</h2></summary>  Screencast of Chromium PWA snapping successfully 
  **Post-Mortem & Fix Analysis**:
  > Updated per @mrkai77’s feedback on #1131:  - Replaced the Chromium-specific resize workaround with AltTab’s `makeKeyWindow` fix (`CGPoint(x: -1, y: -1)` + `0x100` buffer) in `SkyLightToolBelt.makeKeyWindow` - Removed `ChromiumPWAResizeWorkaround` entirely  Net diff vs `develop` is now only `SkyLightToolBelt.swift`. Please re-test Keep/Chat PWA snaps on this revision.

- **Issue #1131** (2026-08-09): **🐞 PWA Crashes when Using Loop**
  *Symptoms*: ### Bug Description  I notice if I use any PWA and try to vertically snap via Loop, the application I am resizing crashes.  ### Affected Scope  Crash / Freeze  ### Steps to Reproduce  1. Get a PWA (e.g., Google Keep, Google Chat, etc.) 2. Drag application vertically for vertical snapping  ### Reproducibility  Often (≥70%)  ### Expected vs Actual Behavior  ## Expected  Vertically snaps just fine  ## Actual  Application crashes  ### Screen Recordings / Screenshots  https://github.com/user-attachments/assets/c8bad617-fa13-4f1f-94d5-82531332d842  ### Severity  Major (workaround exists)  ### macOS Version  Tahoe 26.6 (25G72)  ### Loop Version  Version 🧪 1.4.3 (1755)  ### Did You Try the Development Build?  Yes  ### Additional Context  _No response_  ### Final Checks  - [x] My issue is written in English. - [x] My issue title is descriptive. - [x] This is a single bug (multiple bugs should be reported individually). - [x] I have looked to see if this is a duplicate of another bug report. - [x] I can help with further investigation. - [x] I can help with developing a fix for this issue.
  **Post-Mortem & Fix Analysis**:
  > I’m currently unable to reproduce this bug on my machine, but since you mentioned you might be able to help develop a fix, I was wondering if you have any ideas what could be causing it? Or if you already have a fix in mind, I’d be happy to hear your thoughts!  If not, it may also be worth trying to toggle window animations, since that changes how windows are handled slightly.
  > @mrkai77 I will spend some time today to see if I can isolate the root cause of the issue. Thanks for being super responsive!  OOC, when are you guys planning on officially releasing the latest binary? There are a lot of updates in the pipeline already and I would hate for non-beta users to be surprised by the amount of updates.
  > ## Investigation update  Root cause appears to be on the **Chromium PWA shim** side under Loop's non-animated AX resize path — not Loop crashing, and not all PWAs.  ### Isolation results | Case | Result | | --- | --- | | Chrome / Brave **PWA** (Keep, Chat, ...) + any snap (top / side / corner) | Crash | | Keybind / radial (no drag) | Crash | | Animate window resize **off** | Still crashes | | Chrome / Brave **browser** windows | OK | | Safari Keep PWA | OK | | TextEdit | OK |  ### Loop path `WindowActionEngine` → `WindowEngine.resizeWindow` (non-animated) does `setFrame`, then a **second** `setFrame` when the frame doesn't stick, then `handleSizeConstrainedWindow` may `setPosition` again. Chromium `*.app.<id>` shims (e.g. `com.brave.Browser.app.…`, `com.google.Chrome.app.…`) appear fragile under that AX flood.  ### Loop fix (in progress on `fix/1131-pwa-vertical-snap-crash`) For Chromium PWA shims only: single `sizeFirst` `setFrame`, skip the retry; still one constrained-origin correct

- **Issue #1128** (2026-07-23): **🐞 Keyboard shortcuts stop working while OS X Secure Input is active**
  *Symptoms*: ### Bug Description  Loop shortcuts completely stop working while OS X Secure Input is active. The radial menu still opens, but the regular key event never reaches Loop and the window doesn't move.  This started out of nowhere after a reboot for me. Re-adding Accessibility permissions, logging out, rebooting, and even upgrading OS X made no difference. Rectangle worked immediately with the same shortcuts though. I can now reproduce it every time with the helper below :)  ### Affected Scope  Other  ### Steps to Reproduce  1. Configure a Loop shortcut such as `⌘⌥←`. 2. Confirm that it moves the focused window. 3. Run this in Terminal:  ```bash swift -e ' import Carbon.HIToolbox import Darwin import Foundation  func stopSecureInput(_: Int32) {     _ = DisableSecureEventInput()     exit(0) }  signal(SIGINT, stopSecureInput) signal(SIGTERM, stopSecureInput)  let status: OSStatus = EnableSecureEventInput() guard status == noErr else {     fputs("EnableSecureEventInput failed: \(status)\n", stderr)     exit(1) }  print("Secure Input enabled: \(IsSecureEventInputEnabled())") print("Press Control-C to disable it and exit.") fflush(stdout) RunLoop.current.run() ' ```  4. Confirm that it prints `Secure Input enabled: true`. 5. Retry the Loop shortcut. 6. Stop the helper with Control-C and retry it once more.  ### Reproducibility  Always  ### Expected vs Actual Behavior  Expected: the shortcut moves the window, just like it does in Rectangle.  Actual: Loop sees the modifiers and can show
  **Post-Mortem & Fix Analysis**:
  > Secure Input is a system-wide privacy feature that prevents other apps from reading certain keyboard input while it is enabled. It is not intended to be readable by application key events or by anything trying to sniff out a password. It is typically used in terminal apps such as Ghostty, where you can enable Secure Input because it stops all apps from reading keyboard input (a-z).  Loop will not work while Secure Input is active, and this is by design. However, we also have gestures and, soon, trackpads. That gives you two backups, and I can confirm that both work as a workaround. Bypassing Secure Input is not something we wish to do, as this seems to be isolated to Bitwarden. I tested 1Password and Proton, and they do not exhibit this behaviour. It would be best to wait for an update from Bitwarden’s side instead of us adding a manual way to bypass Secure Input.  I know this is not what you want, but as it’s not a specific Loop issue and because of the nature of the request, we will 
  > Even if it's broken by design, it would still be very useful if loop would indicate why it's suddenly broken instead of not indicating anything. So perhaps there should be an indicator on the about page or a separate debug page so you can see what's going wrong?  As I said, Rectangle still worked like a charm and there was no clear indication that something was broken and why it was broken, odds are that I never would have found the cause without having AI to debug the issue since diving deep into the Loop code is something that would take too much time otherwise. So the alternative options were creating a (most likely) useless bug report or it would take both of us a lot of back-and-forth time to diagnose the cause. Or... I would have switched to a different app that does work.  I fully understand you apprehension of AI generated pull requests... the difference in quality between pull requests that all look great at first glance is huge and it takes a lot of time and effort to differe
  > Loop normally displays a failure or notification explaining why it failed, and full logs are generated for all builds. Developer builds should expose them in the console. If it does not return anything, you would typically investigate from there. However, due to how Secure Input is controlled by macOS, it may fail to output anything meaningful and simply return nothing. As this is an extremely rare test case, only now seen in Bitwarden after they changed something, I don’t see a reason to add a UI indicator for this. It might be better handled in documentation or in a file, like we have with defaults, to indicate that it won’t work. That would make it clearer, and I agree with that.  Kai and I have also spoken about adding debug options to test and validate things. But it always comes back to how much we want to add to Loop for cases like these, because the average user will use it and call it a day. And we’re not anti-AI; it’s a very helpful tool. When used, reviewed, and acted upon w

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

### Incident Patch 1: `61e9b091` (2026-09-30)
**Commit Message**: 🐞 Gesture reliability fixes (#1165)

**File**: `Loop/Core/LoopManager.swift` (modified, +12/-1)
```diff
@@ -112,7 +112,12 @@ final class LoopManager {
         },
         changeAction: { [weak self] action, reverse, canAdvanceCycle in
             Task {
-                await self?.changeAction(action, canAdvanceCycle: canAdvanceCycle, reverse: reverse)
+                await self?.changeAction(
+                    action,
+                    canAdvanceCycle: canAdvanceCycle,
+                    resumeCycleProgress: true,
+                    reverse: reverse
+                )
             }
         },
         checkIfLoopOpen: { [weak self] in
@@ -393,12 +398,14 @@ extension LoopManager {
     ///   - triggeredFromScreenChange: If this action was triggered from a screen change, this will prevent cycle keybinds from infinitely changing screens.
     ///   - disableHapticFeedback: This will prevent haptic feedback.
     ///   - canAdvanceCycle: This will prevent the cycle from advancing if set to false. This is currently used when changing actions via the radial menu.
+    ///   - resumeCycleProgress: When the cycle can't advance, resumes its stored progress instead of restarting it. Used by gestures.
     ///   - reverse: Steps a cycle backwards, or performs the opposite of any other action, such as smaller for larger.
     private func changeAction(
         _ newAction: WindowAction,
         triggeredFromScreenChange: Bool = false,
         disableHapticFeedback: Bool = false,
         canAdvanceCycle: Bool = true,
+        resumeCycleProgress: Bool = false,
         reverse: Bool = false
     ) async {
         var newAction = newAction
@@ -439,6 +446,7 @@ extension LoopManager {
             cycleProposal = proposeCycleAction(
                 newAction,
                 canAdvance: canAdvanceCycle,
+                resumeProgress: resumeCycleProgress,
                 reverse: reverse
             )
             if let cycleProposal {
@@ -642,6 +650,7 @@ extension LoopManager {
     private func proposeCycleAction(
         _ action: WindowAction,
         canAdvance: Bool,
+        resumeProgress: Bool,
         reverse: Bool
     ) -> CycleActionCoordinator.Proposal? {
         // Allow cycling backwards only if:
@@ -656,6 +665,8 @@ extension LoopManager {
             reverse || (allowReverseCycle && keybindTrigger.effectiveEventFlags.contains(.maskShift))
                 ? .advance(.backward)
                 : .advance(.forward)
+        } else if resumeProgress {
+            .resumeCurrent
         } else {
             .selectCurrent
         }
```

**File**: `Loop/Core/Multitouch/MultitouchGestureBlocker.swift` (modified, +130/-26)
```diff
@@ -6,55 +6,159 @@
 //
 
 import AppKit
+import os
 import Scribe
 
-/// Reference-counted because the blocker is shared across in-flight
-/// gestures: one gesture ending mustn't disable blocking for others still
-/// active. `start()` is also idempotent so duplicate calls don't leak the
-/// previous `ActiveEventMonitor` (it self-retains via `Unmanaged.passRetained`).
+/// Stops trackpad scrolls and gestures from reaching apps while a Loop gesture is active.
+/// Reference-counted, so one gesture ending doesn't stop blocking for another.
 @Loggable
 final class MultitouchGestureBlocker {
     private var monitor: ActiveEventMonitor?
-    private var activeCount: Int = 0
+
+    private let activeCount = OSAllocatedUnfairLock<Int>(initialState: 0)
+
+    /// `magnify` is left out, as its raw value (30) collides with `dockControl`
+    private static let gestureEventTypes: Set<UInt32> = [
+        UInt32(NSEvent.EventType.gesture.rawValue),
+        UInt32(NSEvent.EventType.rotate.rawValue),
+        UInt32(NSEvent.EventType.swipe.rawValue),
+        UInt32(NSEvent.EventType.smartMagnify.rawValue)
+    ]
+
+    private static let scrollPhaseEnded: Int64 = 4
+    private static let scrollPhaseCancelled: Int64 = 8
+    private static let momentumPhaseEnd: Int64 = 3
+    private static let scrollDeltaFields: [CGEventField] = [
+        .scrollWheelEventDeltaAxis1,
+        .scrollWheelEventDeltaAxis2,
+        .scrollWheelEventDeltaAxis3,
+        .scrollWheelEventPointDeltaAxis1,
+        .scrollWheelEventPointDeltaAxis2,
+        .scrollWheelEventPointDeltaAxis3
+    ]
+
+    private static let scrollFixedDeltaFields: [CGEventField] = [
+        .scrollWheelEventFixedPtDeltaAxis1,
+        .scrollWheelEventFixedPtDeltaAxis2,
+        .scrollWheelEventFixedPtDeltaAxis3
+    ]
 
     func start() {
-        if monitor != nil {
-            activeCount += 1
-            return
-        }
+        guard monitor == nil else { return }
 
         log.info("Starting gesture blocker")
+        startMonitor()
+    }
+
+    /// Also resets the reference count, as every gesture has been stopped by then. This clears any leaked `acquire()`.
+    func stop() {
+        activeCount.withLock { $0 = 0 }
+
+        guard let monitor else { return }
+
+        monitor.stop()
+        self.monitor = nil
+
+        log.info("Stopped gesture blocker")
+    }
+
+    func acquire() {
+        let count = activeCount.withLock { count in
+            count += 1
+            return count
+        }
+
+        if count == 1 {
+            if monitor == nil {
+                log.warn("Gesture blocker activated without an event tap; trackpad events won't be suppressed")
+            }
+            log.debug("Gesture blocker activated")
+        }
+    }
 
-        let eventTypes: [CGEventType] = [
-            .scrollWheel,
-            CGEventType(rawValue: UInt32(NSEvent.EventType.gesture.rawValue)),
-            CGEventType(rawValue: UInt32(NSEvent.EventType.rotate.rawValue)),
-            CGEventType(rawValue: UInt32(NSEvent.EventType.swipe.rawValue)),
-            CGEventType(rawValue: UInt32(NSEvent.EventType.smartMagnify.rawValue))
-        ].compactMap(\.self)
+    func release() {
+        let count = activeCount.withLock { count in
+            count = max(0, count - 1)
+            return count
+        }
+
+        if count == 0 {
+            log.debug("Gesture blocker deactivated")
+        }
+    }
+
+    private func startMonitor() {
+        let eventTypes: [CGEventType] = [.scrollWheel] + Self.gestureEventTypes.compactMap(CGEventType.init(rawValue:))
+
+        let newMonitor = ActiveEventMonitor(
+            "gesture_blocker",
+            events: eventTypes,
+            callback: Self.makeEventHandler(activeCount: activeCount)
+        )
 
-        let newMonitor = ActiveEventMonitor("gesture_blocker", events: eventTypes) { _ in .ignore }
         newMonitor.start()
 
+        // Left unset on failure, so the next `start()` tries again
```

**File**: `Loop/Core/Multitouch/MultitouchRecognizerRegistry.swift` (modified, +23/-0)
```diff
@@ -5,8 +5,11 @@
 //  Created by Kai Azim on 2026-07-06.
 //
 
+import Foundation
+import Scribe
 import Subsurface
 
+@Loggable
 @MainActor
 final class MultitouchRecognizerRegistry {
     typealias EventHandler = @MainActor (SubsurfaceGestureEvent, Int) async -> ()
@@ -40,6 +43,8 @@ final class MultitouchRecognizerRegistry {
     private let gestureMonitor: SubsurfaceMonitor
     private let handleEvent: EventHandler
     private var entries: [Int: Entry] = [:]
+    /// Logged only when they change, as rebuilds also follow unrelated keybind edits
+    private var conflictingGestureIDs: Set<UUID> = []
 
     init(
         gestureMonitor: SubsurfaceMonitor,
@@ -58,6 +63,8 @@ final class MultitouchRecognizerRegistry {
     }
 
     func rebuild(with gestures: [GestureBinding]) -> [StopResult] {
+        logConflictingGestures(in: gestures)
+
         let gesturesByFingerCount = Dictionary(grouping: GestureBinding.activeGestures(in: gestures), by: \.fingerCount)
         let neededFingerCounts = Set(gesturesByFingerCount.keys)
 
@@ -103,6 +110,22 @@ final class MultitouchRecognizerRegistry {
         !entries.isEmpty
     }
 
+    private func logConflictingGestures(in gestures: [GestureBinding]) {
+        let conflictingIDs = GestureBinding.conflictingActionableIDs(in: gestures)
+        guard conflictingIDs != conflictingGestureIDs else { return }
+        conflictingGestureIDs = conflictingIDs
+
+        guard !conflictingIDs.isEmpty else {
+            log.info("No gestures are disabled by finger count conflicts")
+            return
+        }
+
+        let conflictingGestures = gestures
+            .filter { conflictingIDs.contains($0.id) }
+            .map { "\($0.fingerCount)-finger \($0.kind)" }
+        log.warn("Disabled gestures that conflict on the same finger count: \(conflictingGestures.joined(separator: ", "))")
+    }
+
     private func startRecognizer(
         for fingerCount: Int,
         radial: GestureBinding?,
```

**File**: `Loop/Core/Multitouch/MultitouchTargetResolver.swift` (modified, +44/-16)
```diff
@@ -25,7 +25,14 @@ final class MultitouchTargetResolver {
     /// Lets shrinking/growing continue after the cursor falls off the resized frame.
     private var lastRepeatableWindow: Window?
     /// Resolved once per touch and shared by every gesture in it, so they all agree on the window
-    private var touchTarget: (touchID: Int, window: Window?, isInTitlebar: Bool)?
+    private var touchTarget: TouchTarget?
+
+    private struct TouchTarget {
+        let touchID: Int
+        /// The window under the cursor, or the focused window without "Resize window under cursor"
+        let window: Window?
+        let startedInTitlebar: Bool
+    }
 
     func reset() {
         lastRepeatableWindow = nil
@@ -37,41 +44,62 @@ final class MultitouchTargetResolver {
         touchID: Int,
         allowsRapidRepeat: Bool
     ) -> MultitouchGestureActivationContext {
-        let (windowAtCursor, startedInTitlebar) = windowUnderCursor(touchID: touchID)
+        let target = touchTarget(touchID: touchID)
 
-        let targetWindow: Window? = if let windowAtCursor {
-            windowAtCursor
-        } else if allowsRapidRepeat, gesture.effectiveActivationZone == .anywhere {
-            lastRepeatableWindow
-        } else {
-            nil
+        let targetWindow: Window? = switch gesture.effectiveActivationZone {
+        case .titlebar:
+            target.startedInTitlebar ? target.window : nil
+        case .anywhere:
+            target.window ?? fallbackWindow(allowsRapidRepeat: allowsRapidRepeat)
         }
 
         return MultitouchGestureActivationContext(
             targetWindow: targetWindow,
-            startedInTitlebar: startedInTitlebar
+            startedInTitlebar: target.startedInTitlebar
         )
     }
 
     func isCursorInTitlebar(touchID: Int) -> Bool {
-        windowUnderCursor(touchID: touchID).isInTitlebar
+        touchTarget(touchID: touchID).startedInTitlebar
     }
 
     func rememberRepeatableWindow(_ window: Window?, allowsRapidRepeat: Bool) {
         guard let window, allowsRapidRepeat else { return }
         lastRepeatableWindow = window
     }
 
-    private func windowUnderCursor(touchID: Int) -> (window: Window?, isInTitlebar: Bool) {
+    /// Used when there's no window under the cursor, matching the rest of Loop's fallback to the focused window
+    private func fallbackWindow(allowsRapidRepeat: Bool) -> Window? {
+        if allowsRapidRepeat, let lastRepeatableWindow {
+            return lastRepeatableWindow
+        }
+        return try? WindowUtility.frontmostWindow()
+    }
+
+    private func touchTarget(touchID: Int) -> TouchTarget {
         if let touchTarget, touchTarget.touchID == touchID {
-            return (touchTarget.window, touchTarget.isInTitlebar)
+            return touchTarget
         }
 
         let cursorPosition = NSEvent.mouseLocation.flipY(screen: NSScreen.screens[0])
-        let window = WindowUtility.windowAtPosition(cursorPosition)
-        let inTitlebar = window.map { isInTitlebar(cursorPosition, of: $0) } ?? false
-        touchTarget = (touchID, window, inTitlebar)
-        return (window, inTitlebar)
+
+        let window: Window?
+        let startedInTitlebar: Bool
+        if Defaults[.resizeWindowUnderCursor] {
+            window = WindowUtility.windowAtPosition(cursorPosition)
+            startedInTitlebar = window.map { isInTitlebar(cursorPosition, of: $0) } ?? false
+        } else {
+            window = try? WindowUtility.frontmostWindow()
+            // Only counts where the focused window is the topmost window under the cursor
+            startedInTitlebar = window.map {
+                SkyLightToolBelt.windowIDAtPosition(cursorPosition) == $0.cgWindowID
+                    && isInTitlebar(cursorPosition, of: $0)
+            } ?? false
+        }
+
+        let target = TouchTarget(touchID: touchID, window: window, startedInTitlebar: startedInTitlebar)
+        touchTarget = target
+        return target
     }
 
     p
```

**File**: `Loop/Core/Multitouch/MultitouchTrigger.swift` (modified, +18/-3)
```diff
@@ -103,6 +103,7 @@ final class MultitouchTrigger {
             closeDebugOverlay(force: true)
         #endif
         handleStopResults(recognizerRegistry.stopAll())
+        gestureBlocker.stop()
         targetResolver.reset()
     }
 
@@ -126,8 +127,10 @@ final class MultitouchTrigger {
         handleStopResults(recognizerRegistry.rebuild(with: Defaults[.gestures]))
         if recognizerRegistry.hasRecognizers {
             gestureMonitor.start()
+            gestureBlocker.start()
         } else {
             gestureMonitor.stop()
+            gestureBlocker.stop()
         }
         updateSystemGestureFilter()
     }
@@ -143,7 +146,7 @@ final class MultitouchTrigger {
                 closeCallback(false)
             }
             if stopResult.didAcquireGestureBlocker {
-                gestureBlocker.stop()
+                gestureBlocker.release()
             }
         }
     }
@@ -188,6 +191,7 @@ final class MultitouchTrigger {
         releaseGestureBlocker(for: session)
 
         guard systemGestureFilter.canClaimCurrentTouch(fingerCount: fingerCount) else {
+            log.info("Rejected \(fingerCount)-finger \(gesture.kind) gesture: \(dockOwnershipRejectionReason)")
             session.abandonStroke()
             return false
         }
@@ -197,13 +201,19 @@ final class MultitouchTrigger {
             gesture: gesture,
             loopWasAlreadyOpen: loopWasAlreadyOpen
         ) else {
+            if !activationContext.allows(gesture) {
+                log.info("Rejected \(fingerCount)-finger \(gesture.kind) gesture: titlebar-only gesture started outside a titlebar")
+            } else {
+                log.info("Rejected \(fingerCount)-finger \(gesture.kind) gesture: no target window")
+            }
             systemGestureFilter.releaseCurrentTouch(fingerCount: fingerCount)
             // Keep the DEBUG overlay alive, as it follows the physical stroke
             return false
         }
 
         // Claimed only once accepted, so the filter never sees Loop own a stroke it's about to reject
         guard systemGestureFilter.claimCurrentTouch(fingerCount: fingerCount) else {
+            log.info("Rejected \(fingerCount)-finger \(gesture.kind) gesture: failed to claim the touch, \(dockOwnershipRejectionReason)")
             session.reject()
             return false
         }
@@ -217,11 +227,15 @@ final class MultitouchTrigger {
             allowsRapidRepeat: allowsRapidRepeat
         )
 
-        gestureBlocker.start()
+        gestureBlocker.acquire()
         session.acquireGestureBlocker()
         return true
     }
 
+    private var dockOwnershipRejectionReason: String {
+        MissionControl.isShowing ? "Mission Control is showing" : "the Dock already owns this stroke"
+    }
+
     private func handleEarlyRadialMenuGesture(
         phase: SubsurfaceGesturePhase,
         fingerCount: Int
@@ -361,6 +375,7 @@ final class MultitouchTrigger {
                 let result = try await openCallback(.init(.noSelection), window)
                 openedLoop = result == .opened
             } catch {
+                log.info("Failed to open Loop for \(fingerCount)-finger gesture: \(error.localizedDescription)")
                 if recognizerRegistry.contains(session: session, for: fingerCount) {
                     session.reject()
                     releaseGestureBlocker(for: session)
@@ -428,7 +443,7 @@ final class MultitouchTrigger {
 
     private func releaseGestureBlocker(for session: MultitouchGestureSession) {
         if session.releaseGestureBlocker() {
-            gestureBlocker.stop()
+            gestureBlocker.release()
         }
     }
 }
```

---

### Incident Patch 2: `0ac6d834` (2026-09-29)
**Commit Message**: 🐞 Fix wallpaper capture on macOS 27 (#1160)

**File**: `Loop/Accent Color/WallpaperImageFetcher.swift` (modified, +27/-12)
```diff
@@ -8,12 +8,19 @@
 import SwiftUI
 
 final class WallpaperImageFetcher {
+    /// Bundle identifier for the wallpaper window process
+    /// On macOS 27 and later, the wallpaper window is not owned by the dock but rather the window manager.
+    private static let wallpaperOwnerBundleIDs: Set<String> = [
+        "com.apple.dock",
+        "com.apple.WindowManager"
+    ]
+
     /// Takes a screenshot of the main display.
     /// - Returns: An NSImage of the screenshot or nil if the operation fails.
     ///
     /// This method attempts to capture the desktop wallpaper using three approaches:
-    /// 1. First, it tries to find and capture the Dock's wallpaper window directly that matches our screen dimensions
-    /// 2. If that fails, it tries to capture any wallpaper window from the Dock (even if not on our exact screen)
+    /// 1. First, it tries to find and capture the system wallpaper window directly that matches our screen dimensions
+    /// 2. If that fails, it tries to capture any system wallpaper window  (even if not on our exact screen)
     /// 3. As a last resort, it falls back to capturing the entire screen
     ///
     /// The direct wallpaper capture is preferred as it gets only the wallpaper without desktop icons,
@@ -24,13 +31,13 @@ final class WallpaperImageFetcher {
         let screen = NSScreen.screenWithMouse ?? NSScreen.main ?? NSScreen.screens[0]
         let screenFrame = screen.displayBounds
 
-        // First try to get the wallpaper window from the Dock app that matches our screen dimensions
-        if let wallpaperImage = try? await captureWallpaperFromDock(screenFrame: screenFrame, matchFrame: true) {
+        // First try to get the wallpaper window from the system that matches our screen dimensions
+        if let wallpaperImage = try? await captureSystemWallpaper(screenFrame: screenFrame, matchFrame: true) {
             return wallpaperImage
         }
 
-        // Second fallback: try to get any wallpaper window from the Dock, regardless of screen dimensions
-        if let anyWallpaperImage = try? await captureWallpaperFromDock(screenFrame: screenFrame, matchFrame: false) {
+        // Second fallback: try to get any wallpaper window, regardless of screen dimensions
+        if let anyWallpaperImage = try? await captureSystemWallpaper(screenFrame: screenFrame, matchFrame: false) {
             return anyWallpaperImage
         }
 
@@ -42,22 +49,30 @@ final class WallpaperImageFetcher {
         throw WallpaperProcessorError.screenshotFailed
     }
 
-    /// Attempts to capture the wallpaper window from the Dock app.
+    /// Attempts to capture the wallpaper window from the Dock or WindowManager.
     /// - Parameters:
     ///   - screenFrame: The frame of the screen to capture.
     ///   - matchFrame: Whether to match the exact screen frame dimensions or get any wallpaper window.
     /// - Returns: An NSImage of the wallpaper or nil if the operation fails.
     ///
-    /// This approach uses window capturing APIs to specifically target the Dock's wallpaper window.
+    /// This approach uses window capturing APIs to specifically target the systems wallpaper window.
     /// It requires appropriate permissions, but provides the cleanest capture of just the wallpaper.
-    /// The method identifies the wallpaper window by filtering window properties from the Dock process.
-    private func captureWallpaperFromDock(screenFrame: CGRect, matchFrame: Bool) async throws -> NSImage? {
-        // Get all windows and filter for the Dock's wallpaper windows
+    /// The method identifies the wallpaper window by filtering window properties from the Dock/WindowManager process.
+    private func captureSystemWallpaper(screenFrame: CGRect, matchFrame: Bool) async throws -> NSImage? {
+        // Get all windows and filter for the wallpaper windows
         let windows = CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID) as! [[CFString: Any]]
         var wallpaperWindows = windows
-  
```

---

### Incident Patch 3: `a1e33281` (2026-08-31)
**Commit Message**: 🐞 Fix Golden Gate icon blocking releases in macOS Tahoe CI

**File**: `Loop/Resources/AppIcon-Developer.icon/icon.json` (modified, +3/-12)
```diff
@@ -1,7 +1,4 @@
 {
-  "features" : [
-    "refractivity"
-  ],
   "fill" : {
     "linear-gradient" : [
       "display-p3:0.29000,0.64300,1.00000,1.00000",
@@ -118,11 +115,6 @@
           "value" : 1
         }
       ],
-      "refractivity" : {
-        "depth" : 0.14,
-        "enabled" : true,
-        "strength" : 0.38
-      },
       "shadow" : {
         "kind" : "neutral",
         "opacity" : 0.75
@@ -200,9 +192,8 @@
     }
   ],
   "supported-platforms" : {
-    "circles" : [
-      "watchOS"
-    ],
-    "squares" : "shared"
+    "squares" : [
+      "macOS"
+    ]
   }
 }
\ No newline at end of file
```

---

### Incident Patch 4: `a7a8e5fa` (2026-08-09)
**Commit Message**: 🐞 Fix makeKeyWindow NaN coords that terminate Chromium PWA shims (#1132)

**File**: `Loop/Private APIs/SkyLightToolBelt.swift` (modified, +35/-15)
```diff
@@ -92,11 +92,34 @@ enum SkyLightToolBelt {
     }
 
     ///
+    /// Byte layout for the synthetic `CGSEventRecord` posted by `makeKeyWindow`.
+    /// Offsets match CGSInternal's CGSEvent.h / yabai / AltTab.
+    private enum MakeKeyWindowEvent {
+        /// Allocated buffer size. The record's declared length stays `recordLength`;
+        /// we allocate a little more because newer macOS WindowServer encoding can
+        /// read past the record (see AltTab / paneru#123).
+        static let bufferSize = 0x100
+        static let lengthOffset = 0x04
+        static let recordLength: UInt8 = 0xF8
+        static let eventTypeOffset = 0x08
+        static let leftMouseDown: UInt8 = 0x01
+        static let leftMouseUp: UInt8 = 0x02
+        /// Window-relative click point. Just outside the frame so the window becomes
+        /// key without hitting content. Must be finite — `0xFF` fill decodes as NaN
+        /// and can terminate Chromium PWA app-shim Mojo connections (#1131).
+        static let windowLocationOffset = 0x20
+        static let offContentPoint = CGPoint(x: -1, y: -1)
+        static let unknownFlagOffset = 0x3A
+        static let unknownFlagValue: UInt8 = 0x10
+        static let windowIdOffset = 0x3C
+    }
+
     /// Focuses a window. This will attempt to bring the window to the front and make it the active window.
     /// Note that this first sets the process as frontmost, *then* sends a left click event to the window itself.
     ///
-    /// This method uses a private API to focus the window.
-    /// The code for this method is derived from the Amethyst source code. Details of its implementation can be found [here](https://github.com/Hammerspoon/hammerspoon/issues/370#issuecomment-545545468)
+    /// Uses a private API. Derived from Hammerspoon / yabai / AltTab
+    /// (https://github.com/Hammerspoon/hammerspoon/issues/370#issuecomment-545545468,
+    /// https://github.com/lwouis/alt-tab-macos/commit/782f1fe2e7272f185526e3e69eadd08c241fe050).
     ///
     /// - Parameters:
     ///   - windowID: The `CGWindowID` of the window to focus.
@@ -117,19 +140,16 @@ enum SkyLightToolBelt {
             return false
         }
 
-        // `0x01` is left click down, `0x02` is left click up (see `CGEventType`)
-        for byte in [0x01, 0x02] {
-            // Create raw `SLSEvent` data.
-            // Future consideration: instead of manually creating the bytes here, investigate:
-            // - Creating a `SLSEvent` (likely analogous to `CGEvent`)
-            // - Apply an identifier to the event to help Loop differentiate events that originate from itself
-            // - Converting the `SLSEvent` to data using `SLEventCreateData` in SkyLight
-            var bytes = [UInt8](repeating: 0, count: 0xF8)
-            bytes[0x04] = 0xF8
-            bytes[0x08] = UInt8(byte)
-            bytes[0x3A] = 0x10
-            memcpy(&bytes[0x3C], &wid, MemoryLayout<UInt32>.size)
-            memset(&bytes[0x20], 0xFF, 0x10)
+        var offContentPoint = MakeKeyWindowEvent.offContentPoint
+
+        for eventType in [MakeKeyWindowEvent.leftMouseDown, MakeKeyWindowEvent.leftMouseUp] {
+            var bytes = [UInt8](repeating: 0, count: MakeKeyWindowEvent.bufferSize)
+            bytes[MakeKeyWindowEvent.lengthOffset] = MakeKeyWindowEvent.recordLength
+            bytes[MakeKeyWindowEvent.eventTypeOffset] = eventType
+            bytes[MakeKeyWindowEvent.unknownFlagOffset] = MakeKeyWindowEvent.unknownFlagValue
+            memcpy(&bytes[MakeKeyWindowEvent.windowIdOffset], &wid, MemoryLayout<UInt32>.size)
+            memcpy(&bytes[MakeKeyWindowEvent.windowLocationOffset], &offContentPoint, MemoryLayout<CGPoint>.size)
+
             let cgStatus = bytes.withUnsafeMutableBufferPointer { pointer in
                 SLPSPostEventRecordTo(&psn, &pointer.baseAddress!.pointee)
             }
```

---

### Incident Patch 5: `2467291f` (2026-08-07)
**Commit Message**: 🐞 Fix crash when a cycle action has an empty cycle (#1115)

**File**: `Loop/Core/LoopManager.swift` (modified, +2/-1)
```diff
@@ -474,7 +474,8 @@ extension LoopManager {
     }
 
     private func getNextCycleAction(_ action: WindowAction) async -> WindowAction {
-        guard let currentCycle = action.cycle else {
+        // `currentCycle[0]` below would trap on an empty cycle.
+        guard let currentCycle = action.cycle, !currentCycle.isEmpty else {
             return action
         }
 
```

---

### Incident Patch 6: `6e2b1d00` (2026-07-01)
**Commit Message**: 🐞 Fix stack overflow crash on window-move actions (#1113)

**File**: `Loop/Window Management/Window Manipulation/ResizeContext.swift` (modified, +7/-1)
```diff
@@ -131,6 +131,13 @@ final class ResizeContext {
     }
 
     private func recomputeTargetFrame() {
+        // Clear the recompute guard *before* resolving so this method is re-entrancy safe:
+        // if `WindowFrameResolver.getFrame` ever reads `getTargetFrame()` on this same
+        // context while it is still being computed, the guard is already clear and the
+        // re-entrant call returns the cached frame instead of recomputing and recursing
+        // until the stack overflows.
+        needsRecompute = false
+
         let result = WindowFrameResolver.getFrame(resizeContext: self)
 
         let normalized = CGRect(
@@ -152,7 +159,6 @@ final class ResizeContext {
             normalized: normalized,
             padded: paddedFrame
         )
-        needsRecompute = false
 
         log.info("Computed target frame - raw: \(cachedTargetFrame.raw), normalized: \(cachedTargetFrame.normalized) padded: \(cachedTargetFrame.padded), for action: \(action)")
     }
```

**File**: `Loop/Window Management/Window Manipulation/WindowFrameResolver.swift` (modified, +6/-1)
```diff
@@ -201,7 +201,12 @@ extension WindowFrameResolver {
             )
 
         } else if direction.willMove {
-            let frameToResizeFrom = context.getTargetFrame().raw
+            // Read the last applied frame (falling back to the cached target) instead of
+            // `context.getTargetFrame()`. `getTargetFrame()` would recompute this very
+            // context and re-enter here, recursing until the stack overflows. Matching the
+            // grow/shrink branches above also keeps moves anchored to the window's actual
+            // position rather than a theoretical (possibly clamped-away) target frame.
+            let frameToResizeFrom = context.lastAppliedFrame ?? context.cachedTargetFrame.raw
 
             result = calculatePositionAdjustment(for: action, frameToResizeFrom: frameToResizeFrom)
 
```

---

### Incident Patch 7: `821a174e` (2026-05-12)
**Commit Message**: 🐞 Fix Loop not terminating

**File**: `Loop/App/AppDelegate.swift` (modified, +3/-54)
```diff
@@ -13,7 +13,6 @@ import UserNotifications
 @Loggable
 final class AppDelegate: NSObject, NSApplicationDelegate {
     private let urlCommandHandler = URLCommandHandler()
-    private var shutdownTask: Task<(), Never>?
 
     private var launchedAsLoginItem: Bool {
         guard let event = NSAppleEventManager.shared().currentAppleEvent else { return false }
@@ -134,68 +133,18 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
         return true
     }
 
-    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
-        if shutdownTask != nil {
-            return .terminateLater
-        }
-
+    func applicationShouldTerminate(_: NSApplication) -> NSApplication.TerminateReply {
         // LoopManager and WindowDragManager are explicitly shut down so that their
         // event monitors are stopped immediately (in case they are active)
         LoopManager.shared.shutdown()
         WindowDragManager.shared.shutdown()
-
-        shutdownTask = Task { @MainActor in
-            let didFinishStashShutdown = await runStashShutdownWithTimeout(.seconds(3))
-            if !didFinishStashShutdown {
-                log.warn("Timed out while restoring stashed windows during termination. Continuing shutdown.")
-            }
-
-            self.shutdownTask = nil
-            sender.reply(toApplicationShouldTerminate: true)
-        }
-
-        return .terminateLater
+        StashManager.shared.shutdown()
+        return .terminateNow
     }
 
     func application(_: NSApplication, open urls: [URL]) {
         for url in urls {
             urlCommandHandler.handle(url)
         }
     }
-
-    private func runStashShutdownWithTimeout(_ duration: Duration) async -> Bool {
-        await withCheckedContinuation { continuation in
-            let reply = OneShotContinuation(continuation)
-
-            let shutdownTask = Task { @MainActor in
-                await StashManager.shared.shutdown()
-                reply.resume(returning: true)
-            }
-
-            Task {
-                try? await Task.sleep(for: duration)
-                shutdownTask.cancel()
-                reply.resume(returning: false)
-            }
-        }
-    }
-}
-
-private final class OneShotContinuation<T>: @unchecked Sendable {
-    private let lock = NSLock()
-    private var didResume = false
-    private let continuation: CheckedContinuation<T, Never>
-
-    init(_ continuation: CheckedContinuation<T, Never>) {
-        self.continuation = continuation
-    }
-
-    func resume(returning result: T) {
-        lock.lock()
-        defer { lock.unlock() }
-
-        guard !didResume else { return }
-        didResume = true
-        continuation.resume(returning: result)
-    }
 }
```

**File**: `Loop/Settings Window/SettingsWindowManager.swift` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ final class SettingsWindowManager: ObservableObject {
         }
 
         NSApp.setActivationPolicy(.regular)
-        
+
         if showInspector {
             startTimer()
         }
```

**File**: `Loop/Stashing/StashManager.swift` (modified, +26/-22)
```diff
@@ -90,11 +90,11 @@ final class StashManager {
     }
 
     /// Cancels all monitoring and restores every stashed window to its initial frame.
-    func shutdown() async {
+    func shutdown() {
         mouseMovedTask?.cancel()
         mouseMovedTask = nil
         stopListeningToRevealTriggers()
-        await restoreAllStashedWindows(animate: false)
+        restoreAllStashedWindows()
     }
 
     func onConfigurationChanged() async {
@@ -242,33 +242,44 @@ extension StashManager {
         log.info("unstash \(window.window.description)")
 
         if resetFrame {
-            let action = WindowAction(.initialFrame)
-            let initialFrame = await WindowFrameResolver.getFrame(
-                for: action,
-                window: window.window,
-                bounds: window.screen.cgSafeScreenFrame
-            )
-
             if resetFrameAnimated {
                 try? await window.window.setFrameAnimated(
-                    initialFrame,
+                    window.restoreFrame,
                     bounds: .zero
                 )
             } else {
-                await window.window.setFrame(initialFrame)
+                await window.window.setFrame(window.restoreFrame)
             }
         }
 
         unmanage(windowID: window.window.cgWindowID)
     }
 
-    func restoreAllStashedWindows(animate: Bool) async {
+    func restoreAllStashedWindows() {
         let stashedWindowIDs = Array(store.stashed.keys)
 
         for stashedWindowID in stashedWindowIDs {
-            await unstash(stashedWindowID, resetFrame: true, resetFrameAnimated: animate)
+            unstashSynchronously(stashedWindowID, resetFrame: true)
+        }
+    }
+
+    private func unstashSynchronously(_ windowID: CGWindowID, resetFrame: Bool) {
+        if let windowToUnstash = store.stashed[windowID] {
+            unstashSynchronously(windowToUnstash, resetFrame: resetFrame)
+        } else {
+            unmanage(windowID: windowID)
         }
     }
+
+    private func unstashSynchronously(_ window: StashedWindowInfo, resetFrame: Bool) {
+        log.info("unstash \(window.window.description)")
+
+        if resetFrame {
+            window.window.setFrameSynchronously(window.restoreFrame)
+        }
+
+        unmanage(windowID: window.window.cgWindowID)
+    }
 }
 
 // MARK: - Reveal and Hide
@@ -452,17 +463,10 @@ private extension StashManager {
         frontmostAppMonitor?.cancel()
         frontmostAppMonitor = nil
 
-        // Stop and release the monitor
-        // The monitor's deinit will handle cleanup of the event tap
-        mouseMonitor?.stop()
-
-        // Delay the release to allow the run loop to process the stop
         let monitor = mouseMonitor
         mouseMonitor = nil
-
-        DispatchQueue.main.async {
-            _ = monitor // Keep alive until run loop processes the removal
-        }
+        monitor?.stop()
+        withExtendedLifetime(monitor) {}
     }
 
     /// Handles mouse movement events with a debounce to avoid excessive processing.
```

**File**: `Loop/Stashing/StashedWindowInfo.swift` (modified, +4/-0)
```diff
@@ -14,19 +14,22 @@ struct StashedWindowInfo: Equatable {
     let window: Window
     let screen: NSScreen
     let action: WindowAction
+    let restoreFrame: CGRect
     let revealedFrame: CGRect
     let stashedFrame: CGRect
 
     // MARK: - Frame computation
 
     static func create(window: Window, screen: NSScreen, action: WindowAction, peekSize: CGFloat) async -> StashedWindowInfo {
+        let restoreFrame = await WindowRecords.shared.getInitialFrame(for: window) ?? window.frame
         let revealedFrame = await WindowFrameResolver.getRevealedFrame(for: action, window: window, screen: screen)
         let stashedFrame = await WindowFrameResolver.getStashedFrame(for: action, window: window, screen: screen, peekSize: peekSize)
 
         return StashedWindowInfo(
             window: window,
             screen: screen,
             action: action,
+            restoreFrame: restoreFrame,
             revealedFrame: revealedFrame,
             stashedFrame: stashedFrame
         )
@@ -39,6 +42,7 @@ struct StashedWindowInfo: Equatable {
             window: window,
             screen: screen,
             action: action,
+            restoreFrame: restoreFrame,
             revealedFrame: revealedFrame,
             stashedFrame: stashedFrame
         )
```

**File**: `Loop/Window Management/Window Action/WindowAction.swift` (modified, +2/-2)
```diff
@@ -116,9 +116,9 @@ struct WindowAction: Codable, Identifiable, Hashable, Equatable, Defaults.Serial
 
     var iconResolvedAction: WindowAction {
         if direction == .cycle, let first = cycle?.first {
-            return first
+            first
         } else {
-            return self
+            self
         }
     }
 
```

---

### Incident Patch 8: `9ad1b7d3` (2026-05-11)
**Commit Message**: 🐞 Fix settings inspector timer delays

**File**: `Loop/Settings Window/SettingsContentView.swift` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ struct SettingsContentView: View {
                 LuminareSidebarSection("Settings", selection: $model.currentTab, items: SettingsTab.settingsTabs)
                 LuminareSidebarSection("\(Bundle.main.appName)", selection: $model.currentTab, items: SettingsTab.loopTabs)
             }
-            .frame(width: 240)
+            .frame(width: 230)
             .padding(.top, titleBarHeight)
             .luminareBackground()
 
```

**File**: `Loop/Settings Window/SettingsWindowManager.swift` (modified, +9/-3)
```diff
@@ -95,6 +95,10 @@ final class SettingsWindowManager: ObservableObject {
         }
 
         NSApp.setActivationPolicy(.regular)
+        
+        if showInspector {
+            startTimer()
+        }
 
         controller?.showWindow(self)
         window?.orderFrontRegardless()
@@ -127,13 +131,15 @@ final class SettingsWindowManager: ObservableObject {
         guard showInspector else { return }
 
         stopTimer()
-        startTimer()
+        startTimer(immediatelySelectNext: true)
     }
 
-    private func startTimer() {
+    private func startTimer(immediatelySelectNext: Bool = false) {
         previewActionTimerTask?.cancel()
         previewActionTimerTask = Task(priority: .utility) {
-            try await Task.sleep(for: .seconds(1))
+            if !immediatelySelectNext {
+                try await Task.sleep(for: .seconds(1))
+            }
 
             while !Task.isCancelled {
                 if NSApp.isActive {
```

---

### Incident Patch 9: `61326788` (2026-05-11)
**Commit Message**: 🐞 Fix Safari AutoFill OTP window briefly showing up on macOS 26+

https://developer.apple.com/documentation/bundleresources/information-property-list/nsautofillrequirestextcontenttypeforonetimecodeonmac

**File**: `Loop/Info.plist` (modified, +2/-0)
```diff
@@ -13,6 +13,8 @@
 			</array>
 		</dict>
 	</array>
+	<key>NSAutoFillRequiresTextContentTypeForOneTimeCodeOnMac</key>
+	<true/>
 	<key>NSDockTilePlugIn</key>
 	<string>LoopDockTile.plugin</string>
 </dict>
```

**File**: `Loop/Settings Window/Settings/Keybinds/DirectionPickerView.swift` (modified, +9/-3)
```diff
@@ -10,6 +10,7 @@ import SwiftUI
 struct DirectionPickerView: View {
     @State private var searchText = ""
     @State private var searchResults: [WindowDirection] = []
+    @FocusState private var isSearchFocused: Bool
 
     @Binding private var direction: WindowDirection
     private let isInCycle: Bool
@@ -40,10 +41,12 @@ struct DirectionPickerView: View {
 
     var body: some View {
         VStack(spacing: 0) {
-            CustomTextField(
-                $searchText,
-                placeholder: .init(localized: "Search for a window action", defaultValue: "Search…")
+            TextField(
+                String(localized: "Search for a window action", defaultValue: "Search…"),
+                text: $searchText
             )
+            .textFieldStyle(.plain)
+            .focused($isSearchFocused)
             .padding(12)
 
             Divider()
@@ -71,6 +74,9 @@ struct DirectionPickerView: View {
         .onAppear {
             searchText = ""
             computeSearchResults()
+            Task { @MainActor in
+                isSearchFocused = true
+            }
         }
         .onDisappear {
             searchText = ""
```

**File**: `Loop/Settings Window/Settings/Keybinds/KeybindItemView.swift` (modified, +18/-20)
```diff
@@ -122,27 +122,25 @@ struct KeybindItemView: View {
             .foregroundStyle(isHovering ? .primary : .secondary)
         }
         .background(alignment: .leading) {
-            if isDirectionPickerPresented || isHovering {
-                Color.clear
-                    .frame(width: 300 - 24)
-                    .luminarePopover(
-                        isPresented: $isDirectionPickerPresented,
-                        arrowEdge: .top,
-                        shouldHideAnchor: true,
-                        shouldAnimate: false
-                    ) {
-                        DirectionPickerView(
-                            direction: $action.direction,
-                            isInCycle: cycleIndex != nil
-                        )
-                        .frame(width: 300, height: 300)
-                    }
-                    .onChange(of: isDirectionPickerPresented) { _ in
-                        if !isDirectionPickerPresented {
-                            PickerListEventMonitorManager.shared.removeAllMonitors()
-                        }
+            Color.clear
+                .frame(width: 300 - 24)
+                .luminarePopover(
+                    isPresented: $isDirectionPickerPresented,
+                    arrowEdge: .top,
+                    shouldHideAnchor: true,
+                    shouldAnimate: false
+                ) {
+                    DirectionPickerView(
+                        direction: $action.direction,
+                        isInCycle: cycleIndex != nil
+                    )
+                    .frame(width: 300, height: 300)
+                }
+                .onChange(of: isDirectionPickerPresented) { _ in
+                    if !isDirectionPickerPresented {
+                        PickerListEventMonitorManager.shared.removeAllMonitors()
                     }
-            }
+                }
         }
     }
 
```

**File**: `Loop/Settings Window/Theming/Radial Menu/RadialMenuActionItemView.swift` (modified, +15/-17)
```diff
@@ -86,24 +86,22 @@ struct RadialMenuActionItemView: View {
     private var label: some View {
         actionIndicator
             .background(alignment: .leading) {
-                if isHovering || isPickerPresented {
-                    Color.clear
-                        .frame(width: 300 - 24)
-                        .luminarePopover(
-                            isPresented: $isPickerPresented,
-                            arrowEdge: .top,
-                            shouldHideAnchor: true,
-                            shouldAnimate: false
-                        ) {
-                            RadialMenuActionPickerView(selection: $action.type)
-                                .frame(width: 300, height: 300)
-                        }
-                        .onChange(of: isPickerPresented) { _ in
-                            if !isPickerPresented {
-                                PickerListEventMonitorManager.shared.removeAllMonitors()
-                            }
+                Color.clear
+                    .frame(width: 300 - 24)
+                    .luminarePopover(
+                        isPresented: $isPickerPresented,
+                        arrowEdge: .top,
+                        shouldHideAnchor: true,
+                        shouldAnimate: false
+                    ) {
+                        RadialMenuActionPickerView(selection: $action.type)
+                            .frame(width: 300, height: 300)
+                    }
+                    .onChange(of: isPickerPresented) { _ in
+                        if !isPickerPresented {
+                            PickerListEventMonitorManager.shared.removeAllMonitors()
                         }
-                }
+                    }
             }
     }
 
```

**File**: `Loop/Settings Window/Theming/Radial Menu/RadialMenuActionPickerView.swift` (modified, +9/-3)
```diff
@@ -13,6 +13,7 @@ struct RadialMenuActionPickerView: View {
 
     @State private var searchText = ""
     @State private var searchResults: [RadialMenuAction.ActionType] = []
+    @FocusState private var isSearchFocused: Bool
 
     @Binding private var selection: RadialMenuAction.ActionType
 
@@ -56,10 +57,12 @@ struct RadialMenuActionPickerView: View {
 
     var body: some View {
         VStack(spacing: 0) {
-            CustomTextField(
-                $searchText,
-                placeholder: .init(localized: "Search for a window action", defaultValue: "Search…")
+            TextField(
+                String(localized: "Search for a window action", defaultValue: "Search…"),
+                text: $searchText
             )
+            .textFieldStyle(.plain)
+            .focused($isSearchFocused)
             .padding(12)
 
             Divider()
@@ -102,6 +105,9 @@ struct RadialMenuActionPickerView: View {
         .onAppear {
             searchText = ""
             computeSearchResults()
+            Task { @MainActor in
+                isSearchFocused = true
+            }
         }
         .onDisappear {
             searchText = ""
```

---

### Incident Patch 10: `2ea35615` (2026-05-11)
**Commit Message**: 🐞 Fix stale isLoopOpen check causing action keys to leak to focused app (#1096)

**File**: `Loop/Core/Observers/KeybindTrigger.swift` (modified, +1/-1)
```diff
@@ -192,7 +192,7 @@ final class KeybindTrigger {
 
                     // Only consume the event if the last command actually opened Loop.
                     // The main reason Loop *wouldn't* open after an `openLoop` call would be because the user has enabled a trigger delay.
-                    return isLoopOpen ? .consume : .opening
+                    return checkIfLoopOpen() ? .consume : .opening
                 }
 
                 // Only trigger Loop without an action if the only pressed keys perfectly matches the trigger key.
```

#### Recent Merged Pull Requests:
- **PR #1165** (2026-09-30): 🐞 Gesture reliability fixes (@mrkai77)
- **PR #1163** (2026-09-30): 💄 Remove Tahoe shine from sidebar icons (@mrkai77)
- **PR #1162** (2026-09-30): 🐞 Stop Loop from leaving Dock swipes unfinished (@mrkai77)
- **PR #1161** (2026-09-29): 🌐 Update translations from Crowdin (@github-actions[bot])
- **PR #1160** (2026-09-29): 🐞 Fix wallpaper capture on macOS 27 (@Noah-Johann)
- **PR #1157** (closed): Personal defaults (@itsNotMyUsername)
- **PR #1150** (closed): feat: Add option to trigger Loop via right-click while dragging a window (@atimoda)
- **PR #1144** (2026-08-31): 💄 Update developer icon background grid (@mrkai77)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
