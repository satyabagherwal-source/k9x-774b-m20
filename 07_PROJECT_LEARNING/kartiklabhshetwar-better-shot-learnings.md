> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kartiklabhshetwar-better-shot-learnings.md`  
> **Source**: github ([https://github.com/KartikLabhshetwar/better-shot](https://github.com/KartikLabhshetwar/better-shot))  
> **Source Version**: `7b7d0077`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T00:51:42.221Z  
> **Learning ID**: `learn-github-kartiklabhshetwar-better-shot`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): KartikLabhshetwar/better-shot

---

## 1. Executive Forensic Architecture & System Mechanics

`KartikLabhshetwar/better-shot` is a native macOS application written in Swift that unifies screen capture, viewport recording, real-time live transcription, vector/canvas annotation, and post-production video editing into a single privacy-first architecture. It solves the performance and security overhead of multi-process capture suites by utilizing direct in-process bindings to Apple frameworks (`ScreenCaptureKit`, `AVFoundation`, `CoreGraphics`, `CoreImage`, and `Speech`).

### Subsystem Boundaries & Decoupling

```
┌────────────────────────────────────────────────────────────────────────┐
│                        App Layer & Lifecycle                           │
│     BetterShotDelegate ──> ScreenCapturePermission ──> OnboardingState  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌───────────────────────────────┐         ┌───────────────────────────────┐
│     Capture Engine (SCK)      │         │   Annotation & Canvas Engine  │
│  CaptureOrchestrator          │         │  AnnoShapeRenderer            │
│  ScreenCaptureKit Streams     │         │  AnnotationBackgroundRenderer │
│  PointerStreamSanitizer       │         │  AnnotationMockupEffects      │
│  TeleprompterSpeechEngine     │         │  BeautifierRenderer           │
└──────────────┬────────────────┘         └──────────────┬────────────────┘
               │                                         │
               ▼                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│            Recording Studio & Compositing Pipeline (AVF/CI)            │
│  StudioFrameCompositor ──> Recording3DBlurRenderer (Metal stitchables) │
│  RecordingStudioExporter ──> EditorCloseGuard ──> Atomic Staging / I/O │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Capture Engine & Permission Guarding**:
   - `CaptureOrchestrator` governs region, window, and fullscreen capture sessions.
   - Screen access validation is decoupled through `ScreenCapturePermission` using `CGPreflightScreenCaptureAccess()` and atomic state flags to handle macOS Transparency, Consent, and Control (TCC) synchronization failures across login launches.
   - Microphones and audio sample buffers are teed directly from `SCStream` into a lock-guarded `TeleprompterSpeechEngine` leveraging macOS 26 `SpeechAnalyzer` with zero-copy stream redirection.

2. **Annotation, Geometry & Vector Rasterization**:
   - Canvas graphics operate on an immutable intermediate representation (`AnnoShape` $\to$ `RenderElement`).
   - Text rasterization calculates direct CoreText glyph paths (`TextMeasure.glyphPath`), rendering them through non-zero winding rules to prevent overlap holes on heavy font weights.
   - Complex path styling (hand-drawn jitter, dashed segments with localized corners) is managed through deterministic PRNGs (`makeRng` with UTF-16 code-unit hashing).

3. **Core Image & Metal Pipeline**:
   - `Recording3DBlurRenderer` compiles stitchable Metal kernels (`bettershotPerspective`, `bettershotFocusBlur`, `bettershotBokeh`) directly into a static array of `CIKernel` instances.
   - Custom inverse projective transformations map 3D homographies via inverse transpose $3 \times 3$ matrices (`simd_double3x3`), preserving camera view integrity when planes tilt beyond horizons.

4. **Persistence, Atomic Replacement, and Close Guarding**:
   - The export and project serialization subsystems enforce a strict staging file invariant: image and video exports are compiled to temporary dot-prefixed staging paths (`.BetterShot-[UUID].ext`) and swapped onto target URLs using `FileManager.replaceItemAt(_:withItemAt:)`.
   - `EditorCloseGuard` implements `NSWindowDelegate.windowShouldClose(_:)` as an asynchronous gate that prevents window destruction and process teardown while in-flight atomic updates run.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Independent Image Source Branching in Directed Acyclic Graph (DAG) Compositors
**RULE**:
When feeding a single pixel buffer (`CVPixelBuffer` or `CGImage`) into parallel branches of a node-based rendering graph (such as `CoreImage`, `Direct2D`, or `Vulkan` pipelines) where one branch applies non-linear or masked operations, you **MUST NOT** share a single intermediate wrapper object (`CIImage`). Each branch **MUST** instantiate an independent root image node directly from the underlying surface buffer.

**WHY**:
Compositor engines evaluate execution trees lazily and merge identical subtrees. If a source image node is shared between a pass-through/color-calibrated resample branch and a masked filter branch, the runtime merges upstream nodes and inserts implicit color-space conversions (e.g., converting to extended linear sRGB light) globally for both paths. This causes unmasked content to be resampled in linear light rather than native gamma, producing luminance shifts (up to 42 code levels) and corrupting deterministic frame-cache hash validations.

**WHEN TO APPLY**:
- In any image/video compositor pipeline where hardware surfaces (`CVPixelBufferRef`, `ID3D11Texture2D`, `EGLImage`) feed multiple downstream filters simultaneously.
- When compositing partial blur/pixelation masks over an otherwise unmodified video track.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Safe: Isolate branches by constructing distinct CIImage graph roots
// from the underlying raw CVPixelBuffer
nonisolated func renderMaskedFrame(
    screenFrame: CVPixelBuffer,
    sourceImage: CIImage,
    segment: MaskSegment
) throws -> CIImage {
    // Branch A: Cached or freshly computed mask using an isolated root
    let isolatedSource = CIImage(cvPixelBuffer: screenFrame)
    guard let filteredRegion = RecordingMaskRenderer.filteredRegion(
        source: isolatedSource,
        segment: segment
    ) else {
        throw CompositorError.filterGenerationFailed
    }
    
    // Branch B: Main canvas composition uses sourceImage without
    // inheriting Branch A's implicit linearization graph optimization
    return filteredRegion.composited(over: sourceImage)
}
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern: Sharing sourceImage across branches forces the Core Image
// compiler to hoist color space linearization to the common ancestor
nonisolated func renderMaskedFrameBuggy(
    sourceImage: CIImage,
    segment: MaskSegment
) throws -> CIImage {
    // DANGER: filteredRegion mutates the evaluation tree of sourceImage
    guard let filteredRegion = RecordingMaskRenderer.filteredRegion(
        source: sourceImage,
        segment: segment
    ) else {
        throw CompositorError.filterGenerationFailed
    }
    return filteredRegion.composited(over: sourceImage)
}
```

**VERIFICATION METHOD**:
Sample edge pixel values of sharp typography before and after enabling an adjacent blur mask. Assert luminance variation $\Delta L^* \le 0.001$ in native device RGB:
```swift
func testMaskDoesNotAlterExternalResampleLuminance() {
    let sourceBuffer = createTestPixelBuffer(pattern: .sharpHighContrastEdges)
    let baseFrame = renderPipeline(buffer: sourceBuffer, masks: [])
    let maskedFrame = renderPipeline(buffer: sourceBuffer, masks: [testMask])
    let delta = maxLuminanceDifferenceOutsideMask(baseFrame, maskedFrame, maskBounds: testMask.rect)
    XCTAssertEqual(delta, 0.0, accuracy: 1e-3, "Color space linearization leaked across filter branches")
}
```

---

### 2. Guarded Asynchronous Window Dismissal During Staging I/O
**RULE**:
When an interactive window owns an in-flight asynchronous atomic disk commit (`Task` or thread pool work), `windowShouldClose` **MUST NOT** return `true` or rely on UI flag states that clear prematurely. The delegate **MUST** intercept the close request, suspend destruction, track completion via an explicit `Task.value` barrier, and programmatically invoke dismissal only after the staging file has been finalized or prompt for retry upon failure.

**WHY**:
Premature window destruction triggers immediate view controller and model deallocation (`dealloc`). In Swift Concurrency, child tasks or detached operations that touch deallocated controller properties or perform cooperative teardown are canceled. When an atomic write pipeline is terminated mid-flight, temporary staging files are left orphaned and the user's target file is either unmodified or left in an inconsistent state without error visibility.

**WHEN TO APPLY**:
- In any desktop or document-based UI (`AppKit`, `UIKit`, `WinUI`, `Qt`) where `Save` (`⌘S`) or auto-save executes asynchronously while the user can trigger immediate window close events (`⌘W` or red close button).

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
@MainActor
final class WindowCloseGuard: NSObject, NSWindowDelegate {
    var isFinishingSave: () -> Bool = { false }
    var finishSave: () async -> Bool = { true }
    
    private var isWaitingForSave = false
    private var isCloseApproved = false

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if isCloseApproved { return true }
        
        if isFinishingSave() {
            guard !isWaitingForSave else { return false }
            isWaitingForSave = true
            
            Task { [weak self, weak sender] in
                let saved = await self?.finishSave() == true
                self?.isWaitingForSave = false
                if saved {
                    self?.isCloseApproved = true
                    sender?.performClose(nil)
                } else {
                    // Window remains visible; UI prompts user with retry options
                }
            }
            return false // Reject immediate destruction
        }
        return true
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern: Relying on unsaved changes flag that clears at initiation
func windowShouldClose(_ sender: NSWindow) -> Bool {
    // If hasUnsavedChanges was set to false when saveTask was spawned,
    // window closes immediately and deallocates the model while save runs!
    return !model.hasUnsavedChanges
}
```

**VERIFICATION METHOD**:
Simulate an asynchronous save with a 500ms latency injected into disk writes. Trigger `window.performClose(nil)` at $T = 50\text{ms}$. Assert that the window remains alive at $T = 100\text{ms}$ and closes cleanly at $T = 550\text{ms}$ with the file verified on disk.

---

### 3. TCC Permission Cache Invalidation via External Relaunch
**RULE**:
When a desktop platform security subsystem (e.g., macOS TCC for Screen Recording) requires process termination to pick up a runtime entitlement or granted permission, client software **MUST** maintain an internal atomic granted flag in persistent storage, cross-check it against live preflight APIs (`CGPreflightScreenCaptureAccess`), and, upon detecting an unapplied grant, trigger an out-of-process detached shell relaunch (`Process` calling `/bin/sh` or `open`) followed by clean termination (`NSApp.terminate`).

**WHY**:
Operating system security daemons frequently update persistent permissions in internal SQLite databases while failing to propagate mach-port or kernel-level authorization tokens to processes that were spawned before or during the permission grant (especially common during login items launch). Polling or continuing execution inside the existing PID results in silent empty capture frames or uncatchable hardware exceptions.

**WHEN TO APPLY**:
- macOS applications utilizing `ScreenCaptureKit`, `CoreGraphics` display stream APIs, or Accessibility APIs where grants made while the application is launching do not attach dynamically.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
@MainActor
enum SafeScreenAccessBootstrap {
    private static let grantedKey = "bs_screenCaptureGranted"
    private static var hasOfferedRestart = false

    static func isReadyToCapture() -> Bool {
        let defaults = UserDefaults.standard
        if CGPreflightScreenCaptureAccess() {
            defaults.set(true, forKey: grantedKey)
            return true
        }
        
        // If system recorded grant previously, but preflight fails, token is stale
        guard defaults.bool(forKey: grantedKey), !hasOfferedRestart else { return true }
        hasOfferedRestart = true
        
        let alert = NSAlert()
        alert.messageText = "Restart Required"
        alert.informativeText = "Permission updated. Application must restart to apply security tokens."
        alert.addButton(withTitle: "Restart")
        alert.addButton(withTitle: "Cancel")
        
        if alert.runModal() == .alertFirstButtonReturn {
            defaults.set(false, forKey: grantedKey)
            relaunch()
        }
        return false
    }

    static func relaunch() {
        let task = Process()
        task.launchPath = "/bin/sh"
        // Sleep briefly to allow current process to exit cleanly before open fires
        task.arguments = ["-c", "sleep 0.5; open \"$0\"", Bundle.main.bundlePath]
        try? task.run()
        NSApp.terminate(nil)
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern: Assuming CGPreflightScreenCaptureAccess failure simply means user denied,
// leaving login-item apps permanently broken until manual reboot
static func checkAccess() -> Bool {
    return CGPreflightScreenCaptureAccess() // Fails silently on login launches
}
```

**VERIFICATION METHOD**:
Mock `CGPreflightScreenCaptureAccess` returning `false` while `UserDefaults` holds `grantedKey = true`. Verify that the application suppresses standard capture invocation, triggers the restart alert, spawns the `/bin/sh` process, and terminates.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Core Image Filter Node Sharing Linearizes Screen Resample (BUG-COREIMAGE-01)
- **Context**: Video export pipeline in `Sources/BetterShot/RecordingStudioExporter.swift`.
- **What Was Expected**: Mask filters (such as blur/pixelation redactions) apply strictly within their defined bounded extents. Unmasked areas of the video frame must maintain identical pixel values and color gamma whether masks are active or absent.
- **What Actually Happened**: When a blur mask turned on, sharp edges outside the mask extent (window chrome, typography) shifted luminance by up to 42 code levels, causing noticeable visual flicker. Furthermore, cached raster frames built without masks failed deterministic comparison checks against fresh renders at $0.06\text{s}$.
- **Evidence in Repo**: Commit `17516129`. File: `Sources/BetterShot/RecordingStudioExporter.swift`.
- **Root Cause**: The blur mask pipeline and the main screen resample pass were provided the exact same `CIImage` reference (`sourceImage`). Core Image's optimizer recognized the common node and linearized the source once in extended linear space for both branches. Outside of mask regions, the frame was unexpectedly evaluated in linear space instead of native display gamma.
- **Remediation Code Diff**:
```diff
--- a/Sources/BetterShot/RecordingStudioExporter.swift
+++ b/Sources/BetterShot/RecordingStudioExporter.swift
@@ -908,7 +908,7 @@ nonisolated final class StudioFrameCompositor: @unchecked Sendable {
                 if let cached = cachedMasks[index] {
                     region = cached
                 } else {
-                    guard let filtered = RecordingMaskRenderer.filteredRegion(source: sourceImage, segment: segment) else {
+                    guard let filtered = RecordingMaskRenderer.filteredRegion(source: CIImage(cvPixelBuffer: screenFrame), segment: segment) else {
                         throw RecordingStudioExporter.ExportError.writerFailed(nil)
                     }
                     let bytes = Int(filtered.extent.width.rounded(.up) * filtered.extent.height.rounded(.up)) * 8
```
- **Lesson**: `CIImage` is an expression graph, not a bitmap. Sharing `CIImage` instances between distinct compositing operations permits the Core Image compiler to optimize the entire graph globally, leaking color space transforms across branches. Isolate branches by wrapping backing buffers (`CVPixelBuffer`) in dedicated `CIImage` instances.

---

### Incident 2: In-Flight Save Teardown and Window Close Race Condition (BUG-LIFECYCLE-02)
- **Context**: Studio window dismissal and project persistence in `EditorCloseGuard.swift`, `RecordingStudioModel.swift`, and `RecordingStudioWindow.swift`.
- **What Was Expected**: Executing Save (`⌘S`) followed immediately by closing the window (`⌘W`) must persist all edits to the output video file before the editor window and its underlying render models are deallocated.
- **What Actually Happened**: The `Save` command cleared the model's `hasUnsavedChanges` dirty flag immediately upon dispatching the export task. When the user pressed `⌘W`, `EditorCloseGuard.windowShouldClose` evaluated `hasUnsavedChanges()` as `false` and granted immediate window closure. The resulting window teardown canceled the asynchronous render task, abandoning the export file mid-flight.
- **Evidence in Repo**: Commit `604dcfe0`. Files: `Sources/BetterShot/EditorCloseGuard.swift`, `RecordingStudioModel.swift`, `RecordingStudioWindow.swift`.
- **Root Cause**: Separation of state representation: dirty state tracking (`hasUnsavedChanges`) was decoupled from I/O operation completion (`isFinishingSave`). Closing behavior treated state reconciliation as synchronous.
- **Remediation Code Diff**:
```diff
--- a/Sources/BetterShot/EditorCloseGuard.swift
+++ b/Sources/BetterShot/EditorCloseGuard.swift
@@ -28,10 +28,15 @@ final class EditorCloseGuard: NSObject, NSWindowDelegate {
     var offersDelete: () -> Bool = { false }
     var projectName: () -> String = { "" }
     var onDecision: (Decision, @escaping () -> Void) -> Void = { _, done in done() }
+    /// A Save still writing the saved file, which closing waits for instead of cancelling.
+    var isFinishingSave: () -> Bool = { false }
+    /// Waits for that Save and returns false when it failed, keeping the window open for Retry.
+    var finishSave: () async -> Bool = { true }
 
     private weak var attachedWindow: NSWindow?
     private nonisolated(unsafe) weak var previousDelegate: NSWindowDelegate?
     private var isPrompting = false
+    private var isWaitingForSave = false
     private var isCloseApproved = false
 
     func attach(to window: NSWindow?) {
@@ -62,6 +67,16 @@ final class EditorCloseGuard: NSObject, NSWindowDelegate {
 
     func windowShouldClose(_ sender: NSWindow) -> Bool {
         if isCloseApproved { return true }
+        if isFinishingSave() {
+            guard !isWaitingForSave else { return false }
+            isWaitingForSave = true
+            Task { [weak self, weak sender] in
+                let saved = await self?.finishSave() == true
+                self?.isWaitingForSave = false
+                if saved { sender?.performClose(nil) }
+            }
+            return false
+        }
         guard hasUnsavedChanges() else { return true }
         guard !isPrompting else { return false }
```
- **Lesson**: Never equate the *dispatch* of an asynchronous write with its *completion*. Window dismissal guards must inspect active I/O tasks and maintain an asynchronous rendezvous gate before permitting delegate deallocation.

---

### Incident 3: Stale TCC Screen Recording Permissions on Login Launch (BUG-PERM-03)
- **Context**: Capture bootstrapping during system startup in `ScreenCapturePermission.swift` and `BetterShotDelegate.swift`.
- **What Was Expected**: If screen recording permissions were previously granted by the user in macOS System Settings, launching BetterShot at login must immediately allow screen capture and source discovery.
- **What Actually Happened**: When BetterShot opened automatically at user login, `CGPreflightScreenCaptureAccess()` returned `false` even though the application was checked in System Settings. Capturing failed, catalog refreshes hung or displayed error states, and users were stuck unless they manually restarted the application.
- **Evidence in Repo**: Commit `2f35e53c` (Issue `#171`). Files: `Sources/App/BetterShotDelegate.swift`, `Sources/BetterShot/RecordingSourceCatalog.swift`, `Sources/Capture/ScreenCapturePermission.swift`.
- **Root Cause**: macOS TCC daemon synchronization race condition: applications launched as login items can spawn prior to the WindowServer/TCC daemon establishing session context for the login session, leaving process security tokens stale until the process re-executes.
- **Remediation Code Diff**:
```diff
--- /dev/null
+++ b/Sources/Capture/ScreenCapturePermission.swift
@@ -0,0 +1,32 @@
+import AppKit
+import CoreGraphics
+
+/// Offers a restart when macOS has not applied an earlier Screen Recording grant to this launch.
+@MainActor
+enum ScreenCapturePermission {
+    private static let grantedKey = "bs_screenCaptureGranted"
+    private static var hasOfferedRestart = false
+
+    /// Returns false when BetterShot must restart before it can capture.
+    static func isReadyToCapture() -> Bool {
+        let defaults = UserDefaults.standard
+        if CGPreflightScreenCaptureAccess() {
+            defaults.set(true, forKey: grantedKey)
+            return true
+        }
+        guard defaults.bool(forKey: grantedKey), !hasOfferedRestart else { return true }
+        hasOfferedRestart = true
+        NSApp.activate(ignoringOtherApps: true)
+        let alert = NSAlert()
+        alert.alertStyle = .warning
+        alert.messageText = "Restart BetterShot to capture"
+        alert.informativeText = "macOS hasn’t applied BetterShot’s Screen Recording permission yet. This can happen when BetterShot opens at login. Restart BetterShot, then try again."
+        alert.addButton(withTitle: "Restart")
+        alert.addButton(withTitle: "Cancel")
+        if alert.runModal() == .alertFirstButtonReturn {
+            defaults.set(false, forKey: grantedKey)
+            BetterShotDelegate.relaunch()
+        }
+        return false
+    }
+}
```
- **Lesson**: Do not treat permission preflight APIs as immutable truth on process launch. Track historical grant state across launches to detect OS authorization synchronization lag and provide an automated restart path.

---

### Incident 4: Live Content Shift Race Condition in Interactive Region Capture (BUG-CAPTURE-04)
- **Context**: Interactive region screenshot selection in `CaptureOrchestrator.swift`.
- **What Was Expected**: When selecting a screen region containing fast-moving media, animations, or disappearing tooltips, the final cropped image must reflect the visual content visible at the precise moment selection initiated.
- **What Actually Happened**: The capture engine originally captured the screen buffer only *after* the user finished dragging and released the mouse pointer. By the time `CGWindowListCreateImage` or `ScreenCaptureKit` sampled the frame, tooltips had closed, video frames had advanced, and dropdown menus had dismissed.
- **Evidence in Repo**: Issue `#184`, Commit `cde3c7f`. File: `Sources/Capture/CaptureOrchestrator.swift`.
- **Root Cause**: Time-of-Selection to Time-of-Capture (TOSTOC) race condition caused by deferring bitmap rasterization until user interaction completion.
- **Remediation Architecture**:
Introduced a "Freeze screen while selecting a region" architecture:
```swift
// ScreenCaptureKit snapshots all active displays BEFORE selector overlay mounts
func beginRegionSelection() async throws {
    if AppPreferences.freezeScreenDuringSelection {
        // 1. Snapshot all displays concurrently via ScreenCaptureKit
        let displaySnapshots = try await ScreenCaptureService.snapshotAllDisplays()
        // 2. Mount full-screen selector windows presenting the frozen frames
        SelectionOverlayController.show(frozenFrames: displaySnapshots)
        // 3. User interaction crops the ALREADY CAPTURED high-res buffer
    } else {
        // Fallback: legacy live selection
    }
}
```
- **Lesson**: For time-sensitive screen capture, snapshot first into memory and make the interactive cropping UI operate over frozen rasters; never perform real-time acquisition after user interaction completes.

---

### Incident 5: Sticky Region Selection State Trap (BUG-UX-05)
- **Context**: Coordinate selector initialization in `Sources/Capture/CaptureOrchestrator.swift`.
- **What Was Expected**: Initiating a new region capture must provide an intuitive canvas for user input, respecting both repeatable workflows and fresh selections.
- **What Actually Happened**: The selector canvas loaded previously stored bounds (`AppPreferences.lastRegionRect`) by default on every capture. Users attempting to frame new ad-hoc regions suffered accidental captures of old bounding boxes upon pressing Return or dragging near previously active selection coordinates.
- **Evidence in Repo**: Issue `#185`, Commit `324a7d5`.
- **Root Cause**: Implicit persistent state coupling without explicit user opt-in configuration, turning a shortcut convenience into an operational trap.
- **Remediation**:
Decoupled persistent region reuse: separated the primary region capture workflow (`⌘⇧4`) into configurable fresh-canvas vs. sticky-canvas modes via a default setting (`startWithLastAreaSelected`), while maintaining an explicit, separate shortcut (`⌘⇧1` - *Capture Previous Region*) for repeatable captures.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Non-Zero vs. Even-Odd Path Fill Rules
When rasterizing font outlines via Core Graphics/Core Text paths, setting `usesEvenOddFill = true` corrupts overlapping vector glyph contours.
```swift
// INVARIANT (ShapeRenderer.swift):
// Non-zero winding rule MUST be used for typography and freehand ink.
// Even-odd punches holes wherever glyph outlines overlap (e.g. bold ligatures).
let textElement = RenderElement(
    content: .glyphs(TextMeasure.glyphPath(props)),
    fill: props.swatch.nsColor,
    stroke: nil,
    usesEvenOddFill: false // MANDATORY: preserves solid interiors across overlapping OpenType contours
)
```

#### Deterministic Integer Remainder in Rotation Canonicalization
Swift's `.truncatingRemainder(dividingBy:)` preserves the negative sign of the dividend. Angle normalization must correct for negative remainders:
```swift
// INVARIANT (MathUtils.swift):
func canonicalizeRotation(_ a: Double) -> Double {
    var a = a.truncatingRemainder(dividingBy: PI2)
    if a < 0 { a += PI2 } else if a == 0 { a = 0 } // Eliminates -0.0 IEEE 754 representations
    return a
}
```

#### Float Bit-Pattern Masking for Cross-Platform PRNG Determinism
When generating organic hand-drawn stroke jitter, 64-bit float math diverges across architectures. Bit-casting must force unsigned 32-bit integer shifts:
```swift
// INVARIANT (MathUtils.swift):
// Force unsigned 32-bit bitshifts to replicate standard xorshift semantics
let shiftedW = Int32(bitPattern: UInt32(bitPattern: w) >> 19)
let shiftedT = Int32(bitPattern: UInt32(bitPattern: t) >> 8)
w ^= shiftedW ^ t ^ shiftedT
let normalized = (Double(w) / 0x1_0000_0000) * 2 // Maps to [-1.0, 1.0)
```

---

### 2. Infinite Loop & Recursion Guards

#### Monotonic Teleprompter Speech Progress Guard
Volatile speech recognition results fluctuate and can emit retracted word sequences. The speech analyzer loop must enforce strict monotonic forward progression:
```swift
// INVARIANT (TeleprompterSpeechEngine.swift):
// Volatile result retractions MUST NOT scroll the prompter backwards mid-sentence.
func report(_ spoken: [String]) {
    let count = matcher.spokenDisplayWordCount(spoken: spoken)
    guard count > reported else { return } // TERMINATION INVARIANT: monotonic growth
    reported = count
    onProgress(count)
}
```

#### Collinear Center-of-Circle Singularity Trap
Determining a circumscribed circle center from three points exhibits a division-by-zero singularity when points are collinear:
```swift
// INVARIANT (MathUtils.swift):
func centerOfCircleFromThreePoints(_ a: Vec, _ b: Vec, _ c: Vec) -> Vec? {
    let u: Double = -2 * (a.x * (b.y - c.y) - a.y * (b.x - c.x) + b.x * c.y - c.x * b.y)
    // Singularity guard: u approaches zero when points are collinear
    guard abs(u) > 1e-12 else { return nil }
    let sa = a.x * a.x + a.y * a.y
    let sb = b.x * b.x + b.y * b.y
    let sc = c.x * c.x + c.y * c.y
    let x = (sa * (c.y - b.y) + sb * (a.y - c.y) + sc * (b.y - a.y)) / u
    let y = (sa * (b.x - c.x) + sb * (c.x - a.x) + sc * (a.x - b.x)) / u
    guard x.isFinite, y.isFinite else { return nil }
    return Vec(x, y)
}
```

---

### 3. UI & UX Micro-Mechanics

#### Coordinate Space Flips between CoreGraphics and CoreImage
CoreGraphics uses top-left origin ($y\text{-down}$) in AppKit flipped contexts, whereas CoreImage and Metal enforce bottom-left origin ($y\text{-up}$). Failing to invert coordinates causes perspective distortion quads to invert vertically:
```swift
// INVARIANT (AnnotationMockupEffectsRenderer.swift):
private static func coreImagePoint(_ point: CGPoint, canvasHeight: CGFloat) -> CGPoint {
    // Invert y-axis to translate AppKit coordinate space to CoreImage coordinate space
    CGPoint(x: point.x, y: canvasHeight - point.y)
}
```

#### Per-Corner Radius Arc Geometry Invariant
Building paths with variable corner radii must check for zero-radius cases to avoid generating redundant zero-length arcs that cause rendering artifacts:
```swift
// INVARIANT (BeautifierRenderer.swift):
if topRight > 0 {
    path.addArc(
        center: CGPoint(x: maxX - topRight, y: maxY - topRight),
        radius: topRight,
        startAngle: .pi / 2,
        endAngle: 0,
        clockwise: true
    )
} // If 0, path.addLine automatically establishes the sharp right-angle corner
```

---

### 4. Backend Concurrency & Memory Safety

#### Zero-Copy CMSampleBuffer Re-encoding Guard
In audio ingestion pipelines, converting audio buffers inside high-throughput audio callbacks can trigger buffer starvation. Audio conversion must reuse existing formats and handle partial frames:
```swift
// INVARIANT (TeleprompterSpeechEngine.swift):
private func convert(_ buffer: AVAudioPCMBuffer, to format: AVAudioFormat) -> AVAudioPCMBuffer? {
    if buffer.format == format { return buffer } // FAST PATH: Zero allocation
    
    let converter = lock.withLock {
        if let existing = self.converter,
           existing.inputFormat == buffer.format,
           existing.outputFormat == format {
            return existing
        }
        let fresh = AVAudioConverter(from: buffer.format, to: format)
        self.converter = fresh
        return fresh
    }
    guard let converter else { return nil }
    // ... execution within bounded frame capacity
}
```

#### Dual-Key Content Hashing for NSCache Eviction
Caching rendered PNG data must avoid stale cache hits when a source file is edited or swapped with an identical filename:
```swift
// INVARIANT (AnnotationRenderer.swift):
// Compute SHA256 over raw file bytes + JSON serialized shape descriptors
var digest = SHA256()
digest.update(data: sourceRawBytes)
digest.update(data: serializedEditDescriptors)
if case .customWallpaper(let wallpaper) = background.style {
    digest.update(data: wallpaperFileRawBytes)
}
let cacheKey = Data(digest.finalize()) as NSData
```

---

### 5. Defect & Error Prevention ("Galti Pakadna")

#### Color Space Fallback Guard
Creating an 8-bit premultiplied context using an arbitrary ICC color profile embedded in a user screenshot can throw runtime initialization failures:
```swift
// INVARIANT (AnnotationRenderer.swift):
nonisolated private static func exportColorSpace(for image: CGImage) -> CGColorSpace {
    guard let colorSpace = image.colorSpace,
          colorSpace.model == .rgb,
          CGContext(
            data: nil, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
          ) != nil else {
        return CGColorSpaceCreateDeviceRGB() // Safe fallback prevents hard export crash
    }
    return colorSpace
}
```

#### Inverse Homography Determinant Guard
Calculating a 3D perspective warp from a $4 \times 4$ transformation matrix (`CATransform3D`) can result in a singular matrix when tilted to horizontal planes:
```swift
// INVARIANT (Recording3DBlurRenderer.swift):
let forward = simd_double3x3(columns: (
    SIMD3(m.m11, m.m12, m.m14),
    SIMD3(m.m21, m.m22, m.m24),
    SIMD3(m.m41, m.m42, m.m44)
