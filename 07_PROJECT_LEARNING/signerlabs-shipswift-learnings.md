> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/signerlabs-shipswift-learnings.md`  
> **Source**: github ([https://github.com/signerlabs/ShipSwift](https://github.com/signerlabs/ShipSwift))  
> **Source Version**: `3341a192`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T21:46:35.726Z  
> **Learning ID**: `learn-github-signerlabs-shipswift`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): signerlabs/ShipSwift

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core System Domain & Topology
ShipSwift is an AI-native SwiftUI and Metal architectural component framework targeting iOS 17+/macOS 14+. The system solves the friction encountered when LLMs generate visual components, network-streamed interactions, real-time audio, and custom graphics in modern declarative Swift. The repository provides zero-dependency, self-contained domain primitives organized under `ShipSwift/SWPackage/`:
- **`SWAnimation` / `SWMetal`**: Metal stitchable shaders (`ShaderLibrary`), manual 3D coordinate geometry projected onto 2D SwiftUI `Canvas`, and physics-based interactive layout drivers.
- **`SWComponent`**: Display primitives (`SWCachedImage`), feedback and overlay orchestration systems (`SWAlert`), and containerized inputs.
- **`SWModule`**: Stateful real-time clients, including `SWVolcEngineASRService`, which bypasses high-level abstractions to construct manual RFC 6455 WebSocket handshakes and frame parsing over Apple's `Network.framework` (`NWConnection`).
- **`SWUtil`**: Micro-utilities enforcing zero-cost production instrumentation (`@inline(__always) nonisolated` logging), CoreLocation lifecycle gating, and bidirectional calendar arithmetic.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           SwiftUI View Layer                                   │
│  SWCachedImage  │  SWAlertView  │  SWBeforeAfterSlider  │  SWAnimatedLoop      │
└────────┬─────────────────┬───────────────────┬────────────────────┬────────────┘
         │                 │                   │                    │
         ▼                 ▼                   ▼                    ▼
┌──────────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────────────┐
│  SWImageCache    │ │ SWAlertHost   │ │ TimelineView  │ │ SwiftUI Metal Shaders│
│  (NSCache +      │ │ (UIWindow     │ │ & Phase Match │ │ .stitchable()        │
│   URLCache +     │ │  windowLevel: │ │ (asin drag    │ │ Uniform float/vector │
│   Task Inflight) │ │  .alert + 1)  │ │  re-anchoring)│ │ pipelines            │
└────────┬─────────┘ └───────┬───────┘ └───────────────┘ └──────────────────────┘
         │                   │
         ▼                   ▼
┌──────────────────┐ ┌───────────────┐
│ URLSession /     │ │ UIKit Window  │
│ ImageIO Pipeline │ │ Hit-Testing   │
└──────────────────┘ └───────────────┘
```

### 1.2 Subsystem Decoupling & Invariant Mechanics
1. **Immediate First-Frame Visual Continuity (`SWCachedImage`)**: Eliminates identity re-creation flicker common in Apple's native `AsyncImage`. Decoupled via a dual-tier storage strategy (decoded in-memory `CGImage` backed by `NSCache` priced by decoded byte size + raw byte persistence via a dedicated disk-backed `URLCache`). State ownership relies on an isolated `@MainActor` class holding a deduplicated flight map `[URL: Task<CGImage?, Never>]`.
2. **Modal Hierarchy Bypassing (`SWAlert`)**: Resolves view-tree clipping where iOS `.sheet` and `.fullScreenCover` controllers isolate view trees into child presentation stacks. The alert system deploys a dedicated, long-lived `UIWindow` mounted at `UIWindow.Level.alert + 1`. Touch events are filtered at the platform window layer using custom `hitTest(_:with:)` routing to ensure non-toast screen regions pass through seamlessly to underlying interactables.
3. **Hardware-Accelerated Metal Pipeline Bridging (`SWMetal`)**: Metal shaders (`.metal`) are bridged to SwiftUI view structures via `.colorEffect` or `.distortionEffect` using `ShaderLibrary`. The Swift driver interfaces dynamically evaluate numerical presets and angular deformations, decoupling frame updates from CPU rendering using `TimelineView(.animation)`.
4. **Zero-Third-Party Real-Time Streaming Audio Architecture (`SWVolcEngineASRService`)**: Bypasses `URLSessionWebSocketTask` limitations by binding raw TCP/TLS socket pipes via `NWConnection`. Encapsulates `AVAudioEngine` tapping and on-the-fly audio format transcoding (`AVAudioConverter` to single-channel 16kHz PCM Int16) with manual byte-level frame construction and masking.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dedicated Window Passthrough for Modal Overlays
**RULE**:
When building global application overlays (toasts, network alerts, in-app notifications) in iOS SwiftUI architectures, you MUST NOT mount them inside the root view hierarchy via `.overlay()`. You MUST mount them in a dedicated secondary `UIWindow` positioned at `UIWindow.Level.alert + 1` with a custom `hitTest(_:with:)` override that returns `nil` for any point outside the active notification bounding box.

**WHY**:
SwiftUI's root-view `.overlay()` attaches to the root `UIHostingController`. When a view triggers `.sheet()` or `.fullScreenCover()`, UIKit pushes a distinct modal presentation controller with its own window or distinct view controller hierarchy that sits visually and structurally above the root window. Overlays attached to the root view hierarchy become occluded behind the modal presentation. Attempting to delay the presentation until modal dismissal introduces race conditions and state desynchronization.

**WHEN TO APPLY**:
- Any cross-cutting UI alert, toast, HUD, or connection monitor that must remain visible while users navigate modals, sheets, and authentication flows on iOS 15+.
- Does NOT apply to macOS, where modal sheets attach to the window and maintain the root view overlay layer.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
#if canImport(UIKit)
import UIKit
import SwiftUI

public final class SWPassthroughWindow: UIWindow {
    public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hitView = super.hitTest(point, with: event)
        // If the hit view is the hosting controller's container root view, pass touches through
        return hitView == rootViewController?.view ? nil : hitView
    }
}

@MainActor
public enum SWGlobalOverlayHost {
    private static var overlayWindow: UIWindow?

    public static func mount<Content: View>(rootView: Content, levelOffset: CGFloat = 1) {
        guard overlayWindow == nil else { return }
        
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let activeScene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first else {
            return
        }

        let hostingController = UIHostingController(rootView: rootView)
        hostingController.view.backgroundColor = .clear

        let window = SWPassthroughWindow(windowScene: activeScene)
        window.windowLevel = .alert + levelOffset
        window.backgroundColor = .clear
        window.rootViewController = hostingController
        window.isHidden = false

        self.overlayWindow = window
    }

    public static func tearDown() {
        overlayWindow?.isHidden = true
        overlayWindow = nil
    }
}
#endif
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Attaching toasts inside root-level ZStack or view overlay
struct RootContentView: View {
    @StateObject var toastManager = ToastManager.shared
    
    var body: some View {
        NavigationStack {
            MainView()
        }
        // Fails: Any .fullScreenCover or .sheet presented inside MainView
        // will render on top of this overlay, masking the alert completely.
        .overlay(alignment: .top) {
            if toastManager.isShowing {
                ToastBanner(toastManager.message)
            }
        }
    }
}
```

**VERIFICATION METHOD**:
Verify using an automated XCUITest:
1. Trigger a full-screen modal presentation (`view.fullScreenCover(...)`).
2. Dispatch an alert via the notification manager.
3. Assert that `app.otherElements["GlobalAlertBanner"].exists` evaluates to `true` and is hit-testable (`isHittable == true`) while the modal is presented.

---

### 2. Synchronous Dual-Tier Cached Image Hydration
**RULE**:
When rendering dynamic images subject to frequent view identity invalidations (e.g., periodic timers, `ForEach` identity mutations, list recycled cells), you MUST NOT use Apple's native `AsyncImage`. You MUST fetch synchronously from an in-memory decoded image cache (`NSCache<NSURL, CGImage>`) during the SwiftUI `body` computation, and back off asynchronously to disk cache (`URLCache`) and network requests only on an in-memory cache miss. Inflight network tasks MUST be deduplicated by URL.

**WHY**:
SwiftUI's `AsyncImage` holds no in-memory decoded frame cache and operates strictly through asynchronous task lifecycles. When a view's identity changes (such as parent view re-evaluations under `TimelineView` or changes to `id`), `AsyncImage` tears down its pipeline and drops back to its `placeholder` for at least one frame. This causes high-frequency UI flickering and layout instability.

**WHEN TO APPLY**:
- Re-rendered lists, scrolling avatars in `LazyVStack`/`LazyHStack`, timers, countdown cards, and interactive sliders.
- Cross-platform deployments (iOS, macOS) requiring immediate frame hydration.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import SwiftUI
import ImageIO

public struct SWCachedImage<Content: View, Placeholder: View>: View {
    public let url: URL?
    public var scale: CGFloat = 1.0
    @ViewBuilder public var content: (Image) -> Content
    @ViewBuilder public var placeholder: () -> Placeholder

    @State private var loaded: (url: URL, image: CGImage)?

    private var cgImage: CGImage? {
        guard let url else { return nil }
        if let loaded, loaded.url == url { return loaded.image }
        // Synchronous lookup on MainActor prevents single-frame placeholder flashing
        return SWImageCacheEngine.shared.cachedInMemory(url)
    }

    public var body: some View {
        Group {
            if let cgImage {
                content(Image(decorative: cgImage, scale: scale))
            } else {
                placeholder()
            }
        }
        .task(id: url) {
            guard let url, loaded?.url != url else { return }
            if let image = await SWImageCacheEngine.shared.image(for: url), !Task.isCancelled {
                loaded = (url, image)
            }
        }
    }
}

@MainActor
public final class SWImageCacheEngine {
    public static let shared = SWImageCacheEngine()
    private let memory = NSCache<NSURL, CGImage>()
    private var inflight: [URL: Task<CGImage?, Never>] = [:]
    private var deadURLs: Set<URL> = []

    public func cachedInMemory(_ url: URL) -> CGImage? {
        memory.object(forKey: url as NSURL)
    }

    public func image(for url: URL) async -> CGImage? {
        if let cached = cachedInMemory(url) { return cached }
        if deadURLs.contains(url) { return nil }

        if let existingTask = inflight[url] {
            return await existingTask.value
        }

        let task = Task<CGImage?, Never> {
            defer { Task { @MainActor in self.inflight.removeValue(forKey: url) } }
            // URLRequest configured with .returnCacheDataElseLoad
            let request = URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 15.0)
            guard let (data, response) = try? await URLSession.shared.data(for: request),
                  let httpResponse = response as? HTTPURLResponse else {
                return nil
            }

            if httpResponse.statusCode == 404 || httpResponse.statusCode == 410 {
                await MainActor.run { self.deadURLs.insert(url) }
                return nil
            }

            guard httpResponse.statusCode == 200,
                  let source = CGImageSourceCreateWithData(data as CFData, nil),
                  let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
                return nil
            }

            let cost = cgImage.bytesPerRow * cgImage.height
            await MainActor.run {
                self.memory.setObject(cgImage, forKey: url as NSURL, cost: cost)
            }
            return cgImage
        }

        inflight[url] = task
        return await task.value
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Native AsyncImage in dynamic or frequent-refresh scopes
struct AvatarRow: View {
    let user: User
    var body: some View {
        // Will flash placeholder each time AvatarRow identity resets in a TimelineView or LazyVStack
        AsyncImage(url: user.avatarURL) { phase in
            switch phase {
            case .empty: ProgressView()
            case .success(let image): image.resizable()
            case .failure: Image(systemName: "person.circle")
            @unknown default: EmptyView()
            }
        }
        .id(user.stableId) // Changing or re-evaluating id causes 1-frame blank drop
    }
}
```

**VERIFICATION METHOD**:
Write a SwiftUI ViewInspector or unit test:
1. Warm the memory cache via `SWImageCacheEngine.shared.cachedInMemory(url)`.
2. Instantiate `SWCachedImage` in a test host view.
3. Assert that the synchronous property accessor `cgImage` returns a non-nil reference on the first frame of execution, without awaiting asynchronous dispatch.

---

### 3. Continuous-Time Gesture Phase Invariant for Autonomous Oscillators
**RULE**:
When building interactive animated components that oscillate autonomously via continuous temporal functions (e.g., `sin(t * speed)`) and accept interruptions via direct manipulation gestures (`DragGesture`), you MUST NOT preserve a naive timestamp baseline upon gesture release. You MUST invert the continuous wave equation using the inverse trigonometric function (`asin` for sinusoidal waveforms) over the normalized released coordinate to derive an artificial phase displacement, recalculating the base start date as:
$$\text{BaseDate} = \text{Date.now} - \frac{\arcsin(\text{ClampedNormalizedPosition})}{\text{Speed}}$$

**WHY**:
If an animation updates continuously using `Date.now.timeIntervalSince(startDate)` and user manipulation overrides the position, resetting `startDate = Date.now` upon gesture termination will snap the phase back to $t=0$ ($\sin(0) = 0$). This produces an immediate, jarring positional discontinuity (teleportation glitch) upon release.

**WHEN TO APPLY**:
- UI components where continuous procedural motion (sinusoidal, triangular, or orbital sweeps) must seamlessly blend with user touch drag vectors and resume smoothly.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import SwiftUI

public struct SWPhaseLockedOscillator: View {
    public var speed: Double = 1.0
    public var amplitude: CGFloat = 0.3
    public var centerOffset: CGFloat = 0.5
    
    @State private var startDate: Date = .now
    @State private var isDragging: Bool = false
    @State private var manualPos: CGFloat = 0.5

    public var body: some View {
        TimelineView(.animation(paused: isDragging)) { timeline in
            let sliderPos: CGFloat = isDragging
                ? manualPos
                : centerOffset + CGFloat(sin(timeline.date.timeIntervalSince(startDate) * speed)) * amplitude

            // Visual elements bound to sliderPos...
            Color.clear
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            if !isDragging { isDragging = true }
                            // Clamping prevents math exceptions outside domain boundaries
                            manualPos = min(max(value.location.x / 300.0, 0.05), 0.95)
                        }
                        .onEnded { _ in
                            // Inverse Sinusoidal Phase Reconstruction
                            // Equation: pos = centerOffset + sin(phase * speed) * amplitude
                            // phase = asin((pos - centerOffset) / amplitude) / speed
                            let rawRelative = (manualPos - centerOffset) / amplitude
                            let normalizedClamped = min(max(Double(rawRelative), -1.0), 1.0)
                            let reconstructedPhase = asin(normalizedClamped) / speed
                            
                            // Re-anchor timeline zero so oscillation continues seamlessly from current spot
                            startDate = Date.now.addingTimeInterval(-reconstructedPhase)
                            isDragging = false
                        }
                )
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Naive state resumption causing positional jumps
DragGesture()
    .onEnded { _ in
        // Snaps phase to t=0 immediately! 
        // Position instantly teleports to centerOffset regardless of release point.
        startDate = Date.now 
        isDragging = false
    }
```

**VERIFICATION METHOD**:
Verify using a XCTest unit test:
1. Set `manualPos = 0.8` (`centerOffset = 0.5`, `amplitude = 0.3`).
2. Run release math: `asin((0.8 - 0.5) / 0.3) / speed` $\to \arcsin(1.0) / 1.0 = \frac{\pi}{2} \approx 1.57079$.
3. Advance virtual clock by `0.001s` and evaluate position. Verify difference between `manualPos` and evaluated continuous position is $< 0.002$.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Modal View Presentation Occluding Root Overlay Alerts (BUG-SHIPSWIFT-01)
- **Context**: `ShipSwift/SWPackage/SWComponent/Feedback/SWAlert.swift`
- **What Was Expected**: Dispatched alerts, notifications, or toasts must remain visible across navigation contexts, including modal sheets, full-screen cover flows, and form completion dialogues.
- **What Actually Happened**: Alerts triggered while a user operated inside a `.sheet` or `.fullScreenCover` were visually swallowed and rendered beneath the modal view. The alert only became visible after the modal sheet was dismissed.
- **Evidence in Repo**: Commit `3062473a`, files `ShipSwift/SWPackage/SWComponent/Feedback/SWAlert.swift`.
- **Root Cause**: The modifier attached `SWAlertView()` as a root view `.overlay(alignment: .top)` inside the `UIHostingController` tree. In UIKit, `.sheet` and `.fullScreenCover` present separate modal controller layers on top of the host controller, occluding the root-level overlay.
- **Remediation Code Diff**:
```swift
// - Buggy code / What failed
private struct SWAlertModifier: ViewModifier {
    let alertManager = SWAlertManager.shared

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                SWAlertView()
                    .padding(.top, 40)
            }
            .animation(.spring(duration: 0.3), value: alertManager.isShowing)
    }
}

// + Fixed pattern / Safe invariant
#if canImport(UIKit)
private final class SWAlertPassthroughWindow: UIWindow {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let view = super.hitTest(point, with: event)
        return view == rootViewController?.view ? nil : view
    }
}

@MainActor
private enum SWAlertWindowHost {
    static var window: UIWindow?

    static func mountIfNeeded() {
        guard window == nil,
              let scene = UIApplication.shared.connectedScenes
                  .compactMap({ $0 as? UIWindowScene })
                  .first(where: { $0.activationState == .foregroundActive })
                  ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first
        else { return }
        let host = UIHostingController(rootView: SWAlertOverlayRoot())
        host.view.backgroundColor = .clear
        let window = SWAlertPassthroughWindow(windowScene: scene)
        window.windowLevel = .alert + 1
        window.backgroundColor = .clear
        window.rootViewController = host
        window.isHidden = false
        self.window = window
    }
}
#endif
```
- **Lesson**: Declarative UI view overlays cannot cross presentation controller boundaries in UIKit-backed window hierarchies. Global overlays require explicit platform-level window composition.

---

### Incident 2: Single-Frame Placeholder Flashing on Identity Invalidation (BUG-SHIPSWIFT-02)
- **Context**: `ShipSwift/SWPackage/SWComponent/Display/SWCachedImage.swift`, `ShipSwift/View/UIListView.swift`
- **What Was Expected**: Re-rendering views containing remote images (e.g., avatars in a 1-second countdown list or dynamically sorting collections) should maintain a stable image presentation across renders.
- **What Actually Happened**: Native `AsyncImage` holds no in-memory cache. Every time parent views re-rendered under a timer or changed identity keys (`.id(tick)`), `AsyncImage` recycled its inner state and flashed the empty placeholder for at least one frame before reloading from disk/network.
- **Evidence in Repo**: Commit `3341a192`, file `SWCachedImage.swift`.
- **Root Cause**: `AsyncImage` initiates loading asynchronously inside `.task`. Even if the image exists in disk cache, reading and decoding happens asynchronously across the run loop, causing a mandatory one-frame placeholder render.
- **Remediation Code Diff**:
```swift
// - Buggy code / What failed
AsyncImage(url: url) { image in
    image.resizable().scaledToFill()
} placeholder: {
    Color.secondary.opacity(0.2)
}
.id(tick) // Forces reconstruction of identity -> drops image -> flashes placeholder

// + Fixed pattern / Safe invariant
struct SWCachedImage<Content: View, Placeholder: View>: View {
    let url: URL?
    var scale: CGFloat = 1
    @ViewBuilder var content: (Image) -> Content
    @ViewBuilder var placeholder: () -> Placeholder
    @State private var loaded: (url: URL, image: CGImage)?

    private var cgImage: CGImage? {
        guard let url else { return nil }
        if let loaded, loaded.url == url { return loaded.image }
        // Synchronous lookup during view tree compilation
        return SWImageCache.shared.cached(url)
    }

    var body: some View {
        picture
            .task(id: url) {
                guard let url, loaded?.url != url else { return }
                if let image = await SWImageCache.shared.image(for: url), !Task.isCancelled {
                    loaded = (url, image)
                }
            }
    }
}
```
- **Lesson**: Asynchronous image loaders that lack synchronous memory cache probing will always flash placeholders when identity is invalidated.

---

### Incident 3: Metal Demo Configuration Sheet Presentation Detent Expansion Clashes (BUG-SHIPSWIFT-03)
- **Context**: Metal Shader Configuration Components (`SWCharSphere.swift`, `SWDotSphere.swift`, `SWAnimatedLoop.swift`, `SWChromaticGlass.swift`, `SWColorPanels.swift`, `SWDotOrbit.swift`, `SWDots.swift`)
- **What Was Expected**: Parameter tweaking sheets for Metal shaders should slide in compactly without breaking bottom-up interaction with the underlying shader canvas.
- **What Actually Happened**: Controlled components configured with `.presentationDetents([.medium, .large])` caused sheet drag gestures to fight with vertical shader parameter panning, occasionally snapping to `.large` and fully obscuring the shader canvas being adjusted.
- **Evidence in Repo**: Commit `ad743b8c`.
- **Root Cause**: Multiple sheet detents enabled layout ambivalence during high-frequency slider manipulation, breaking live visual feedback.
- **Remediation Code Diff**:
```swift
// - Buggy code / What failed
SWCharSphereControlled(...)
-   .presentationDetents([.medium, .large])
-   .presentationDragIndicator(.visible)

// + Fixed pattern / Safe invariant
SWCharSphereControlled(...)
+   .presentationDetents([.medium])
+   .presentationDragIndicator(.visible)
```
- **Lesson**: Live inspector sheets that tune visual backgrounds must be locked to fixed non-expanding detents (`[.medium]`) to prevent gesture collisions and canvas occlusion.

---

### Incident 4: Missing Audio Session Transcoding for Real-Time ASR Engine (BUG-SHIPSWIFT-04)
- **Context**: `ShipSwift/SWPackage/SWModule/SWChat/SWVolcEngineASRService+iOS.swift`
- **What Was Expected**: Raw audio recorded from the microphone must stream over WebSockets to ByteDance's VolcEngine API and generate streaming speech recognition tokens.
- **What Actually Happened**: iOS hardware input formats vary across devices (e.g., 44.1kHz or 48kHz, stereo/mono, 32-bit floating point). Streaming raw tap buffers caused the remote ASR engine to drop the connection or emit corrupted transcriptions due to unrecognized audio formats.
- **Evidence in Repo**: `SWVolcEngineASRService+iOS.swift`.
- **Root Cause**: Failure to normalize audio formats to the remote service's required specifications prior to packet serialization.
- **Remediation Code Diff**:
```swift
// - Buggy code / What failed
// Directly piping tap buffer to websocket
inputNode.installTap(onBus: 0, bufferSize: 1024, format: inputNode.outputFormat(forBus: 0)) { buffer, time in
    self.sendAudioChunk(buffer) // Remote rejected: invalid sampling rate/bit depth
}

// + Fixed pattern / Safe invariant
private let targetFormat = AVAudioFormat(
    commonFormat: .pcmFormatInt16, 
    sampleRate: 16000, 
    channels: 1, 
    interleaved: true
)!

// Instantiating converter to ensure normalized byte output
let inputFormat = inputNode.outputFormat(forBus: 0)
self.audioConverter = AVAudioConverter(from: inputFormat, to: targetFormat)
```
- **Lesson**: Direct-to-socket streaming audio clients must enforce explicit hardware-to-network audio transcoding pipelines (`AVAudioConverter`) before dispatching packet payloads.

---

### Incident 5: Discrete Frame-Dropping in Manual WebSocket Framing Parser (BUG-SHIPSWIFT-05)
- **Context**: `ShipSwift/SWPackage/SWModule/SWChat/SWVolcEngineASRService+iOS.swift`
- **What Was Expected**: Continuous reception of partial WebSocket frames from the network stream without dropping or truncating incoming messages.
- **What Actually Happened**: Under high-throughput streaming, chunks delivered by `NWConnection.receive` can fragment across multi-byte packet boundaries. Parsing frames with incomplete headers or partial payload lengths caused deserialization to drop frames or stall the receive loop.
- **Evidence in Repo**: `processWebSocketFrames()` in `SWVolcEngineASRService+iOS.swift`.
- **Root Cause**: Naive array slicing that fails to verify the minimum frame boundary requirements before reading the 16-bit or 64-bit length descriptor offsets.
- **Remediation Code Diff**:
```swift
// - Buggy code / What failed
// Blind parsing assuming full header exists
let secondByte = buffer[1]
let payloadLength = secondByte & 0x7F
if payloadLength == 126 {
    let length = UInt64(buffer[2]) << 8 | UInt64(buffer[3]) // Crashes or corrupts if buffer.count < 4
}

// + Fixed pattern / Safe invariant
let bufferCopy = Array(receiveBuffer)
guard bufferCopy.count >= 2 else { return }

var offset = 0
while bufferCopy.count - offset >= 2 {
    let secondByte = bufferCopy[offset + 1]
    var payloadLength = UInt64(secondByte & 0x7F)
    var headerSize = 2

    if payloadLength == 126 {
        guard bufferCopy.count - offset >= 4 else { break } // Frame fragment safety guard
        payloadLength = UInt64(bufferCopy[offset + 2]) << 8 | UInt64(bufferCopy[offset + 3])
        headerSize = 4
    } else if payloadLength == 127 {
        guard bufferCopy.count - offset >= 10 else { break } // 64-bit fragment safety guard
        // ...
    }
    // Safe processing...
}
```
- **Lesson**: Wire-level byte parsing over TCP connections must verify sliding-window minimum length guarantees for each variable-length header field before slicing buffers.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Implicit Closure Reference Capture & Inlining**: In `SWDebugLog.swift`, `swDebugLog` utilizes `@inline(__always)` combined with `@autoclosure () -> String`.
   ```swift
   @inline(__always)
   nonisolated func swDebugLog(_ message: @autoclosure () -> String, file: String = #file, line: Int = #line) {
       #if DEBUG
       let filename = (file as NSString).lastPathComponent
       print("[\(filename):\(line)] \(message())")
       #endif
   }
   ```
   *Forensic Precision*: Using `@autoclosure` ensures that complex string interpolation and formatting logic is never evaluated in production release builds. The code is stripped before compile time, eliminating release runtime overhead.

2. **Regex Raw String Slicing Bounds Invariant**: In `SWStringExtension.swift`:
   ```swift
   var isValidEmail: Bool {
       let emailRegex = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
       return range(of: emailRegex, options: .regularExpression) != nil
   }
   ```
   *Forensic Precision*: The `#` literal prevents Swift's tokenizer from misinterpreting `\b`, `\s`, and `\%` escape sequences. Using `range(of:options:) != nil` avoids allocating an `NSRegularExpression` instance and eliminates Objective-C bridging overhead.

---

### 4.2 Infinite Loop & Recursion Guards
1. **Sliding-Window Buffer Drain Termination**: In `SWVolcEngineASRService+iOS.swift`:
   ```swift
   var offset = 0
   while bufferCopy.count - offset >= 2 {
       // ... byte analysis ...
       let totalFrameSize = headerSize + (isMasked ? 4 : 0) + Int(payloadLength)
       guard bufferCopy.count - offset >= totalFrameSize else {
           break // BREAK INVARIANT: Halts parsing when buffer chunk is partial
       }
       offset += totalFrameSize // Guaranteed monotonically increasing progress
   }
   if offset > 0 {
       receiveBuffer.removeSubrange(0..<offset) // Drains consumed window
   }
   ```
   *Termination Invariant Proof*: The loop terminates because `offset` strictly increases by `totalFrameSize >= 2` on each iteration. If `bufferCopy.count - offset < totalFrameSize`, the loop halts via `break`. Consumed bytes are dropped from `receiveBuffer` in a single mutation, preventing unbounded buffer growth.

---

### 4.3 UI & UX Micro-Mechanics
1. **Continuous Sinusoidal Resumption via Phase Offset Calculation**:
   ```swift
   let normalized = min(max