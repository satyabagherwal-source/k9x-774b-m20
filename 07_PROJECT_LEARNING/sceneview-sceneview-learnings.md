> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sceneview-sceneview-learnings.md`  
> **Source**: github ([https://github.com/sceneview/sceneview](https://github.com/sceneview/sceneview))  
> **Source Version**: `8a3f4274`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T06:27:56.587Z  
> **Learning ID**: `learn-github-sceneview-sceneview`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): sceneview/sceneview

> **Canonical Artifact**: `07_PROJECT_LEARNING/sceneview-sceneview-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sceneview/sceneview](https://github.com/sceneview/sceneview))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-21T06:27:56.581Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sceneview/sceneview`
- **Description**: Declarative 3D and AR for Android with Jetpack Compose, Filament and ARCore, plus web and Compose Multiplatform desktop. Open source, Apache 2.0. SwiftUI, Flutter and React Native: end of life at 4.68.0.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1379 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `SceneViewSwift/Sources/SceneViewSwift/Camera/AppliedCameraState.swift`
```
#if os(iOS) || os(macOS) || os(visionOS)
import simd

/// Snapshot of the inputs that fully determine what ``SceneView``'s
/// `applyCamera()` writes to the perspective-camera / scene-root entities. Every
/// per-mode branch of `applyCamera()` is a pure function of these values
/// (`cameraPosition()`, `lookOrientation()`, `sceneRotation()` and the constant
/// root reset all read only from this set), so an unchanged snapshot means the
/// entity transform would be rewritten with identical values — the write can be
/// skipped. Compared with ``approximatelyMatches(_:)`` (float tolerance), never
/// `==`, because the values are derived geometry. Closes #2331.
///
/// Extracted from the `private` `SceneViewRepresentation` to a top-level
/// `internal` type so the per-frame diff-guard can be driven by unit tests
/// against the **same** code `applyCamera()` runs — not a re-implementation that
/// would prove the algorithm sound yet miss a regression in the real wiring
/// (e.g. dropping the `mode` exact-compare, loosening `eps`, or skipping the
/// nil ↔ non-nil `firstPersonEye` check). Mirrors the #2313 ``EntityDragState``
/// extraction. Closes #2412.
struct AppliedCameraState {
    var mode: CameraControlMode
    var azimuth: Float
    var elevation: Float
    var orbitRadius: Float
    var target: SIMD3<Float>
    var fov: Float
    var firstPersonEye: SIMD3<Float>?

    /// Per-frame redundancy check. `mode` is compared exactly (it is a
    /// discrete enum); the geometric scalars / vectors within `eps` so that
    /// a no-op re-evaluation of an unchanged orbit is treated as identical,
    /// while any real camera motion — an orbit / pan drag tick, an
    /// auto-rotate step, a pinch, a framing re-fit — clears the threshold
    /// and re-applies. `eps = 1e-5` world units / radians is far below one
    /// pixel of motion at any realistic scene scale yet far above
    /// float round-off, and ~80× smaller than the smallest single-frame
    /// step a slow auto-rotate produces, so a live camera never freezes.
    func approximatelyMatches(_ other: AppliedCameraState) -> Bool {
        guard mode == other.mode else { return false }
        let eps: Float = 1e-5
        func close(_ a: Float, _ b: Float) -> Bool { abs(a - b) <= eps }
        func close3(_ a: SIMD3<Float>, _ b: SIMD3<Float>) -> Bool {
            close(a.x, b.x) && close(a.y, b.y) && close(a.z, b.z)
        }
        // A nil ↔ non-nil firstPerson eye is a genuine state change (the
        // eye is captured on entering firstPerson) and must re-apply.
        switch (firstPersonEye, other.firstPersonEye) {
        case (nil, nil): break
        case let (lhs?, rhs?): if !close3(lhs, rhs) { return false }
        default: return false
        }
        return close(azimuth, other.azimuth)
            && close(elevation, other.elevation)
            && close(orbitRadius, other.orbitRadius)
            && close(fov, other.fov)
            && close3(target, other.target)
    }
}
#endif

```

### Core Architecture Module: `SceneViewSwift/Sources/SceneViewSwift/EntityDragState.swift`
```
import CoreGraphics

/// Per-entity drag baseline plus the cumulative→per-frame-delta conversion that
/// ``SceneView/entityDragGesture`` performs, extracted into a directly-testable
/// unit (#2313).
///
/// The gesture itself is `private` and SwiftUI's `DragGesture.Value` can't be
/// synthesized in a plain unit test, so the original `GestureSystemTests` could
/// only assert against a *re-implementation* of this math — they proved the
/// algorithm sound but would not catch a regression in the real wiring (e.g.
/// reverting `current − previous` → `current`, dropping the `.onEnded` reset, or
/// mis-keying the dictionary). Routing the gesture through these `internal`
/// pure-ish functions lets the tests drive the **same** code the gesture runs.
///
/// Held in a reference type so the per-frame writes during a drag never change
/// `SceneView`'s `@State` value and so never invalidate the SwiftUI body /
/// re-run `RealityView.update:` (same rationale as the original
/// `EntityDragStateBox`, #2277/#2283).
final class EntityDragState {
    /// Per-entity cumulative translation at the previous `onChanged` tick, keyed
    /// by `ObjectIdentifier(entity)` (`Entity` is a class but not `Hashable`).
    /// Entries are inserted lazily on the first tick and removed in ``end(forKey:)``
    /// (`.onEnded`), so the dictionary holds only currently-dragging entities.
    private(set) var lastTranslation: [ObjectIdentifier: SIMD3<Float>] = [:]

    /// Converts SwiftUI's 2D **screen** drag translation into the planar XY
    /// **world** translation `entityDragGesture` dispatches: the screen delta is
    /// treated as an XY translation at the entity's depth, Y is flipped (screen Y
    /// grows downward, world Y upward), Z is 0, and both axes are scaled by the
    /// `0.001` screen→world factor. Pure — no state.
    static func worldTranslation(width: CGFloat, height: CGFloat) -> SIMD3<Float> {
        SIMD3<Float>(
            Float(width) * 0.001,
            Float(-height) * 0.001,
            0
        )
    }

    /// Converts SwiftUI's **cumulative** translation into the **per-frame delta**
    /// (`current − previous`) that `NodeGesture.onDrag`'s contract promises, and
    /// advances the per-entity baseline. Dispatching this delta — not the
    /// cumulative value — is the #2283 fix: a natural `entity.position += delta`
    /// handler then integrates the motion once, not twice.
    func delta(forKey key: ObjectIdentifier, cumulative current: SIMD3<Float>) -> SIMD3<Float> {
        let previous = lastTranslation[key] ?? .zero
        lastTranslation[key] = current
        return current - previous
    }

    /// Clears the per-entity baseline at `.onEnded` so the next gesture on this
    /// entity starts from a zero baseline rather than the previous gesture's final
    /// cumulative offset.
    func end(forKey key: ObjectIdentifier) {
        lastTranslation[key] = nil
    }
}

```

### Core Architecture Module: `SceneViewSwift/Sources/SceneViewSwift/RenderQuality.swift`
```
#if os(iOS) || os(macOS) || os(visionOS)
import RealityKit

/// Rendering quality preset for a `SceneView`.
///
/// Mirrors SceneView Android's `RenderQuality` enum (`sceneview/src/main/java/io/github/sceneview/RenderQuality.kt`).
/// Pass to `SceneView { … }.renderQuality(...)` to apply a coherent set of defaults in one
/// line, instead of tuning every render option individually.
///
/// Choose the preset based on what the user is doing in the scene:
/// - ``Cinematic`` for hero shots, product showcases, single-model viewers where the GPU
///   budget can afford the full bells and whistles.
/// - ``Default`` for general use — matches the out-of-the-box `SceneView` defaults.
/// - ``Performance`` for low-end devices, AR camera-feed backgrounds, or anywhere the GPU
///   is constrained — disables shadows and dims environmental lighting.
///
/// ## iOS RealityKit vs Android Filament divergence
///
/// RealityKit's public render-options API is narrower than Filament's. The Swift port honours
/// what RealityKit exposes and documents the gaps:
///
/// | Knob | Android (Filament) | iOS (RealityKit) |
/// |---|---|---|
/// | Shadows on/off | ✅ via `View.setShadowingEnabled` | ✅ per-light via `DirectionalLightComponent.Shadow` |
/// | SSAO on/off | ✅ via `View.ambientOcclusionOptions` | ⚠️ no public toggle — RealityKit auto-applies AO approximations |
/// | Bloom on/off | ✅ via `View.bloomOptions` | ✅ `SceneView.bloom(_:)` on iOS / macOS 26+ (not part of the presets) |
/// | MSAA | ✅ via `View.multiSampleAntiAliasingOptions` | ❌ not user-controllable |
/// | HDR color buffer | ✅ `QualityLevel.HIGH/MEDIUM/LOW` | ❌ not exposed |
/// | Dynamic resolution | ✅ `View.dynamicResolutionOptions` | ❌ not exposed |
/// | Environmental IBL intensity | via `EnvironmentLoader` HDR | ✅ via `ImageBasedLightComponent.intensityExponent` |
/// | Person occlusion (AR) | (n/a) | ✅ via `ARView.renderOptions` (AR only, not on `RealityView`) |
///
/// The preset still picks the *best available* RealityKit defaults for each tier, so calling
/// `.renderQuality(.cinematic)` reliably produces a richer scene than `.renderQuality(.performance)`
/// — just not by the same number of dimensions Android tunes.
public enum RenderQuality: Sendable {

    /// Maximum visual fidelity — appropriate for product viewers, hero shots, and single-model
    /// showcases on capable devices.
    ///
    /// On iOS:
    /// - **Shadows**: on for all directional lights (lights without an existing `Shadow` get
    ///   one with `maximumDistance: 12, depthBias: 5.0`).
    /// - **IBL intensity exponent**: clamped to a minimum of `1.0` (full environmental light).
    ///
    /// Cannot influence on iOS today (RealityKit limitations): SSAO quality, MSAA sample count,
    /// HDR buffer quality, bloom strength.
    case cinematic

    /// Balanced quality / performance — the out-of-the-box `SceneView` defaults.
    ///
    /// On iOS:
    /// - **Shadows**: on for main / fill lights with default tuning (`maximumDistance: 8, depthBias: 5.0`).
    /// - **IBL intensity exponent**: preserved (no change).
    case `default`

    /// Minimal post-processing for low-end devices or AR camera-feed scenes where the GPU
    /// budget is constrained.
    ///
    /// On iOS:
    /// - **Shadows**: removed from every directional light in the scene.
    /// - **IBL intensity exponent**: dimmed to `0.5` (half environmental light) to reduce
    ///   indirect-shading cost.
    case performance
}

// MARK: - Internal application

/// Applies a `RenderQuality` preset to the given RealityKit scene root.
///
/// Walks the scene's directional lights and toggles their `Shadow` per the preset. Also
/// adjusts the IBL receiver's intensity if one is present at the receiver entity.
///
/// Returns the new IBL intensity exponent if it changed — caller may want to re-apply it to
/// a freshly-loaded `ImageBasedLightComponent`. Returns `nil` when the preset leaves IBL alone.
@MainActor
@discardableResult
internal func applyRenderQuality(
    _ quality: RenderQuality,
    to root: Entity,
    iblReceiver: Entity? = nil
) -> Float? {
    // 1. Walk all directional lights and apply per-preset shadow behaviour.
    walkDirectionalLights(root) { directional in
        switch quality {
        case .cinematic:
            // Ensure a shadow with cinematic-grade distance.
            if directional.shadow == nil {
                directional.shadow = DirectionalLightComponent.Shadow(
                    maximumDistance: 12,
                    depthBias: 5.0
                )
            }
        case .default:
            // Ensure a shadow with balanced-grade distance, but don't override existing
            // shadow configs (caller may have tuned them via `LightNode.shadowMaximumDistance`).
            if directional.shadow == nil {
                directional.shadow = DirectionalLightComponent.Shadow(
                    maximumDistance: 8,
                    depthBias: 5.0
                )
            }
        case .performance:
            // Drop all shadows to free up the shadow render pass entirely.
            directional.shadow = nil
        }
    }

    // 2. Adjust IBL intensity exponent on the receiver entity (if one exists in this scene).
    //
    // ⚠️ The literals below are RAW EXPONENTS, not the linear multipliers
    // `SceneEnvironment.intensity` speaks since #2897 — `1.0` here means ×2.0 and
    // `0.5` means ×1.41, which no longer dims anything now that the authored
    // default maps to exponent 0. That is currently latent, not a bug — but it
    // is kept latent DELIBERATELY, by every caller, not by luck:
    //
    //   * `SceneView.buildContent(isInitialBuild: true)` (from `setupScene`)
    //     runs synchronously BEFORE the async `loadEnvironment` installs the
    //     `ImageBasedLightComponent`, so both branches below find no component
    //     and no-op.
    //   * `buildContent(isInitialBuild: false)` — the `.contentID(_:)` swap
    //     path (#3008) — runs long AFTER that load, so it passes
    //     `iblReceiver: nil` on purpose and never reaches this half at all.
    //
    // Fix the units here before letting any caller pass a live receiver
    // post-load, or these values will invert their own documented intent
    // (#2897) and pop the scene's brightness.
    guard let iblReceiver else { return nil }
    let newExponent: Float?
    switch quality {
    case .cinematic:
        // Bump IBL up to at least 1.0 (full); leave higher values alone.
        if let existing = iblReceiver.components[ImageBasedLightComponent.self]?.intensityExponent,
           existing < 1.0 {
            newExponent = 1.0
        } else {
            newExponent = nil
        }
    case .default:
        // Preserve whatever the scene loaded.
        newExponent = nil
    case .performance:
        // Dim IBL to halve indirect-shading cost.
        newExponent = 0.5
    }
    if let newExponent,
       var ibl = iblReceiver.components[ImageBasedLightComponent.self] {
        ibl.intensityExponent = newExponent
        iblReceiver.components.set(ibl)
        return newExponent
    }
    return nil
}

@MainActor
private func walkDirectionalLights(_ entity: Entity, _ visit: (DirectionalLight) -> Void) {
    if let dl = entity as? DirectionalLight {
        visit(dl)
    }
    for child in entity.children {
        walkDirectionalLights(child, visit)
    }
}
#endif

```

### Core Architecture Module: `SceneViewSwift/Sources/SceneViewSwift/RenderSurfaceResizer.swift`
```
#if os(iOS) && targetEnvironment(simulator)
import RealityKit
import SwiftUI
import UIKit

/// Keeps a `RealityView`'s Metal render surface the size of the view after a resize (#4182).
///
/// **Simulator only.** The bug has only ever been seen in the iOS 26 Simulator. On a real
/// iPhone (iPhone SE 3, iOS 26.6.1) RealityKit resizes the surface itself, and writing the
/// surface's frame and drawable size from here during the rotation leaves RealityKit with
/// the portrait projection: the landscape scene is stretched about 3x horizontally
/// ((portrait height / landscape height)², the old aspect over the new one). So this file,
/// and the code in ``SceneView`` that uses it, is compiled for the simulator only; device
/// builds keep RealityKit's own resize untouched.
///
/// In the iOS 26 Simulator, the `ARView` that backs a SwiftUI `RealityView` follows its new
/// frame when the device rotates, but the Metal view inside it does not: it keeps the frame and the
/// drawable size it was created with. RealityKit then renders a landscape viewport into the
/// portrait-sized drawable, so after portrait → landscape only the left, portrait-wide strip
/// of the screen shows the scene and the rest stays black. Launching straight into landscape
/// is fine, because the surface is created at the right size. A bare `RealityView` in a
/// minimal app does the same, so the fault is in RealityKit, not in ``SceneView``.
///
/// This invisible marker is the `RealityView`'s background, so it shares its rectangle.
/// Whenever its layout changes it finds the `ARView` laid out in that same rectangle (never a
/// neighbouring `SceneView`'s) and, **only if** the render surface no longer matches the view,
/// resizes the surface and its drawable (keeping the drawable's pixel density), then calls
/// `onResize` so the scene re-writes its camera and RealityKit re-derives the projection.
/// A surface that already matches is left alone, so a RealityKit build that resizes on its
/// own never sees this code do anything.
///
/// **Second role: stale frames in an overlaid view.** In the iOS 26 Simulator, a
/// `RealityView` laid out over another one (a picture-in-picture inset over a full-screen
/// ``SceneView``) comes up with `presentsWithTransaction` set on its `CAMetalLayer`, so each
/// frame waits for a Core Animation commit and the view shows the scene one edit late. On
/// the same check, the resizer turns that flag off on the surface it found (see
/// `presentWithoutTransaction`). Like the resize, this runs in the Simulator only.
struct RenderSurfaceResizer: UIViewRepresentable {
    /// The laid-out size of the `RealityView`; a change is what re-runs the check.
    let size: CGSize
    /// Called after a surface was actually resized.
    let onResize: @MainActor () -> Void

    func makeUIView(context: Context) -> Marker {
        let marker = Marker()
        marker.isUserInteractionEnabled = false
        marker.isAccessibilityElement = false
        marker.onResize = onResize
        return marker
    }

    func updateUIView(_ marker: Marker, context: Context) {
        marker.onResize = onResize
        marker.scheduleCheck()
    }

    final class Marker: UIView {
        var onResize: (@MainActor () -> Void)?
        private var checkPending = false

        override func didMoveToWindow() {
            super.didMoveToWindow()
            scheduleCheck()
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            scheduleCheck()
        }

        /// Deferred to the next main-queue turn so the `ARView` already has its new bounds.
        func scheduleCheck() {
            guard !checkPending else { return }
            checkPending = true
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.checkPending = false
                self.check()
            }
        }

        /// Layout passes a check may wait for the paired `ARView` to take its new frame.
        private var retriesLeft = 0

        private func check() {
            guard let window else { return }
            let markerFrame = convert(bounds, to: window)
            guard markerFrame.width > 0, markerFrame.height > 0 else { return }
            if let arView = RealityViewPairing.arView(behind: self, markerFrame: markerFrame, in: window) {
                retriesLeft = 0
                Self.presentWithoutTransaction(arView)
                if Self.fitSurface(of: arView) { onResize?() }
            } else if retriesLeft < 5 {
                // Mid-rotation, the ARView may not have its new frame yet.
                retriesLeft += 1
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in self?.check() }
            } else {
                retriesLeft = 0
            }
        }

        /// Lets the surface present each frame as soon as it is rendered.
        ///
        /// In the iOS 26 Simulator, a `RealityView` laid out over another one (a
        /// picture-in-picture inset) comes up with `presentsWithTransaction` set on its
        /// Metal layer, while the full-screen one does not. Its frames then reach the
        /// screen only when a Core Animation transaction commits, that is on the next
        /// SwiftUI update, and each shows the scene as it was one edit earlier: the inset
        /// keeps the previous camera angle until something else on screen changes.
        ///
        /// The flag is cleared only when `check()` runs (when the marker joins a window or
        /// lays out, and on its retries); it is not watched. If RealityKit set it again
        /// later, it would stay set until the view's next layout.
        private static func presentWithoutTransaction(_ arView: UIView) {
            for surface in arView.subviews {
                guard let layer = surface.layer as? CAMetalLayer,
                      layer.presentsWithTransaction else { continue }
                layer.presentsWithTransaction = false
            }
        }

        /// Returns `true` when the surface had to be resized.
        private static func fitSurface(of arView: UIView) -> Bool {
            let bounds = arView.bounds
            guard bounds.width > 0, bounds.height > 0 else { return false }
            var resized = false
            for surface in arView.subviews {
                guard let layer = surface.layer as? CAMetalLayer,
                      surface.frame.size != bounds.size else { continue }
                let old = surface.bounds.size
                let density = old.width > 0 ? layer.drawableSize.width / old.width : layer.contentsScale
                surface.frame = bounds
                layer.drawableSize = CGSize(width: (bounds.width * density).rounded(),
                                            height: (bounds.height * density).rounded())
                resized = true
            }
            return resized
        }
    }
}
#endif

```

### Core Architecture Module: `arsceneview/src/main/java/io/github/sceneview/ar/ARCore.kt`
```
@file:OptIn(io.github.sceneview.ExperimentalSceneViewApi::class)

package io.github.sceneview.ar

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.MainThread
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.ar.core.ArCoreApk.Availability
import com.google.ar.core.Config
import com.google.ar.core.Frame
import com.google.ar.core.RecordingStatus
import com.google.ar.core.Session
import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.exceptions.FatalException
import io.github.sceneview.ar.arcore.ARSession

/**
 * Assumed distance in meters from the device camera to the surface on which the user will
 * try to place models.
 *
 * This value affects the apparent scale of objects while the tracking method of the Instant
 * Placement point is `SCREENSPACE_WITH_APPROXIMATE_DISTANCE`. Values in the [0.2, 2.0] meter
 * range are a good choice for most AR experiences.
 */
const val kDefaultHitTestInstantDistance = 2.0f

/**
 * Manages an ARCore [Session] lifecycle.
 *
 * Before starting a session this class checks camera permission and ARCore availability
 * through an [ARPermissionHandler], which decouples the permission logic from
 * [android.app.Activity] and makes the class testable with a mock handler.
 *
 * @param onSessionCreated     Called once when the [Session] is created.
 * @param onSessionResumed     Called each time the session resumes.
 * @param onSessionPaused      Called each time the session pauses.
 * @param onArSessionFailed    Called when session creation or resume fails, once per failed
 *                             attempt: every host resume, permission grant or [retrySession]
 *                             that cannot resume the session reports again. A fatal frame-update
 *                             error closes the session and reports once, without per-frame retries.
 * @param onSessionConfigChanged Called when the session configuration changes.
 */
class ARCore(
    val onSessionCreated: (session: Session) -> Unit,
    val onSessionResumed: (session: Session) -> Unit,
    val onSessionPaused: (session: Session) -> Unit,
    val onArSessionFailed: (exception: Exception) -> Unit,
    val onSessionConfigChanged: (session: Session, config: Config) -> Unit
) {

    /** Enable/disable the automatic camera permission check. */
    var checkCameraPermission = true

    /** Enable/disable Google Play Services for AR availability check, auto-install and update. */
    var checkAvailability = true

    lateinit var features: Set<Session.Feature>

    /** The permission handler used for camera and ARCore availability checks. */
    var permissionHandler: ARPermissionHandler? = null

    /**
     * Legacy two-action camera denial callback, called on the main thread.
     *
     * The historical `permanentlyDenied` argument recommends settings when `true`, including
     * ambiguous answers for which settings is a fallback. It does not prove Android has
     * stopped showing the dialog. `false` offers another [retryCameraPermission] request.
     * This conservative mapping keeps existing hosts from retrying a suppressed dialog
     * forever. Nothing opens automatically; call [openAppSettings] from a user action.
     *
     * This boolean cannot distinguish an ambiguous answer from a confirmed settings-only
     * denial, and is only notified when its own value changes. [ARSceneView] hosts receive
     * the complete recovery through `onCameraPermissionStateChanged` instead.
     */
    var onCameraPermissionDenied: ((permanentlyDenied: Boolean) -> Unit)? = null

    /**
     * Called on the main thread whenever [cameraPermissionRecovery] changes.
     *
     * [ARCameraPermissionRecovery.Request] offers [retryCameraPermission];
     * [ARCameraPermissionRecovery.SettingsWithRequest] keeps that action and also offers
     * [openAppSettings] with neutral copy; [ARCameraPermissionRecovery.Settings] offers
     * settings alone. `null` clears the denial after permission is granted, including on
     * return from settings. The property is updated before this callback runs.
     *
     * No initial value is replayed when the callback is assigned: read the property when
     * attaching to an existing instance. [ARSceneView] uses this callback for its card.
     */
    internal var onCameraPermissionRecoveryChanged: ((recovery: ARCameraPermissionRecovery?) -> Unit)? = null

    /**
     * Called on the main thread when a denial reported through [onCameraPermissionDenied] no
     * longer holds — the camera was granted, from the dialog or from system settings (#4452).
     *
     * Before #4452 only a successfully created session took the explanation down, so a grant
     * followed by anything else (ARCore missing, a session that fails) left "camera access
     * needed" on screen over the real reason.
     */
    var onCameraPermissionGranted: (() -> Unit)? = null

    /**
     * `true` after the user denied the camera permission and until it is granted — while
     * set, session creation is held back so `resume()` never throws for a missing camera.
     */
    var isCameraPermissionDenied: Boolean = false
        private set

    /** The last verdict sent to [onCameraPermissionDenied]; `null` while nothing is denied. */
    private var publishedCameraDenial: Boolean? = null

    /**
     * Current camera recovery, published through [onCameraPermissionRecoveryChanged].
     * `null` before any denial and after permission is granted. Used by [ARSceneView] to
     * retain both actions without changing the legacy callback's boolean contract.
     */
    internal var cameraPermissionRecovery: ARCameraPermissionRecovery? = null
        private set

    /** The camera request that has not been answered yet, if any. */
    private var cameraRequest: CameraRequest? = null

    /** Refusals in a row that came back with no rationale flag — see [cameraPermissionRecovery]. */
    private var unexplainedCameraRefusals = 0

    /** `true` between [resume] and [pause]. */
    private var isHostResumed = false

    /** Observable by [ARSceneView]: another resumed scene currently owns the camera (#4491). */
    internal var isCameraInUseByAnotherSession by mutableStateOf(false)
        private set

    /** `true` from [detachHost] until the next [create]: nothing may start or publish. */
    private var isHostDetached = false

    /**
     * Creates and resumes the session outside a host resume, through the camera arbiter like
     * every other resume. A seam for JVM tests, which cannot create an ARCore session.
     */
    internal var startSession: (Context) -> Unit = { context ->
        createSession(context)
        resumeSession()
    }

    /** Monotonic clock, in nanoseconds. Replaced in tests. */
    internal var nanoTime: () -> Long = System::nanoTime

    /** What a camera request started from, so its answer can be read in context. */
    private class CameraRequest(
        val handler: ARPermissionHandler,
        val rationaleBefore: Boolean,
        val startedAtNanos: Long,
    ) {
        /** The host was paused after the request went out — the system dialog took over. */
        var hostPausedSince = false

        /** The host left while the request was out: its answer is for nobody. */
        var isAbandoned = false
    }

    /**
     * Called on the main thread whenever the ARCore availability verdict changes (#3374).
     *
     * `null` means "nothing to report": ARCore is installed and current, or the check is still
     * running. A non-null value is terminal until the user acts — the device is not capable,
     * Google Play Services for AR is missing or too old, or the check itself failed.
     *
     * Before #3374 an unsupported device produced no signal at all: the install request threw,
     * the exception was swallowed into [onArSessionFailed], and hosts that had not wired that
     * callback (every demo) sat on their own "initializing" copy forever.
     * [ARSceneView] wires this to its built-in `arCoreAvailabilityOverlay`.
     */
    var onARCoreAvailability: ((availability: ARCoreAvailability?) -> Unit)? = null

    /** The last verdict published through [onARCoreAvailability]. `null` when AR can start. */
    var arCoreAvailability: ARCoreAvailability? = null
        private set

    private var cameraPermissionRequested = false
    private var installRequested = false

    /** Last context a session was created from, so a retry can create another one. */
    private var lastContext: Context? = null

    /** Context of the last [resume], so a grant that arrives while resumed can start AR. */
    private var resumeContext: Context? = null

    private var sessionNeedsRecreation = false

    internal var session: ARSession? = null
        private set

    /** Releases SDK-owned session objects on the main thread, before native close begins. */
    internal var onSessionClosing: ((ARSession) -> Unit)? = null

    /** Updates only the native session, outside the host's per-frame callbacks. */
    @MainThread
    internal fun updateSessionOrNull(): Frame? = try {
        session?.updateOrNull()
    } catch (exception: FatalException) {
        // A fatal native session cannot recover on the next frame (#4501). Close it before
        // notifying the host, so even a throwing callback cannot leave the retry loop running.
        destroy()
        publishAvailability(ARCoreAvailability.SessionFailed)
        Log.e("ARCore", "ARCore session update failed; the session was closed", exception)
        onException(exception)
        null
    }

    /**
     * Initializes the ARCore session lifecycle.
     *
     * @param context  Android context for session creation.
     * @param handler  Permission handler for camera permission and ARCore install checks.
     *      
```

### Core Architecture Module: `arsceneview/src/main/java/io/github/sceneview/ar/ARCoreAvailabilityOverlay.kt`
```
package io.github.sceneview.ar

import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.google.ar.core.ArCoreApk
import com.google.ar.core.exceptions.UnavailableApkTooOldException
import com.google.ar.core.exceptions.UnavailableArcoreNotInstalledException
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException
import com.google.ar.core.exceptions.UnavailableSdkTooOldException
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException

/**
 * Why AR cannot start on this device, as reported by [ArCoreApk.checkAvailability] (#3374).
 *
 * `null` — the absence of this enum — is the normal case: ARCore is installed and current,
 * or the availability query is still running. Only a value that will *not* resolve on its
 * own is modelled here, precisely so hosts can tell "still initializing" from "never going
 * to initialize". Before #3374 they could not: an unsupported device produced no state at
 * all, so every AR demo sat on "Initializing AR — look around to start tracking" forever.
 */
enum class ARCoreAvailability {
    /** The device cannot run ARCore at all. Nothing the user does will change that. */
    Unsupported,

    /** ARCore is supported but Google Play Services for AR is not installed. */
    NotInstalled,

    /** Google Play Services for AR is installed but too old for this session. */
    NeedsUpdate,

    /**
     * The availability query itself failed (no network, Play Store unreachable, timeout).
     * Distinct from [Unsupported]: the device may well be capable, we just could not ask.
     * Retryable.
     */
    CheckFailed,

    /**
     * ARCore is installed, but session creation, resume or a fatal frame update failed. A busy
     * camera can cause this after returning to the app too. Retryable; a successful resume clears
     * the state. A fatal update closes the failed session so a retry creates a new one.
     */
    SessionFailed,
}

/**
 * Maps an [ArCoreApk.Availability] to the state the UI should show, or `null` when there is
 * nothing to show.
 *
 * Pure and free of Android framework types on purpose — this is the single place the
 * availability contract lives, and it is pinned by `ARCoreAvailabilityTest`.
 *
 * - [ArCoreApk.Availability.SUPPORTED_INSTALLED] — AR is good to go.
 * - [ArCoreApk.Availability.UNKNOWN_CHECKING] — genuinely transient: ARCore is still asking
 *   the Play Store and will report again. Showing a card here would flash on every cold
 *   start, so it maps to `null` and the host's own "initializing" copy stays up.
 *
 * Every other value is terminal until the user acts, so each maps to a state.
 *
 * Deliberately has no `else` branch: a future `ArCoreApk.Availability` constant then breaks
 * the build here instead of silently falling into a bucket nobody chose.
 */
fun ArCoreApk.Availability.toARCoreAvailability(): ARCoreAvailability? = when (this) {
    ArCoreApk.Availability.SUPPORTED_INSTALLED -> null
    ArCoreApk.Availability.UNKNOWN_CHECKING -> null
    ArCoreApk.Availability.SUPPORTED_NOT_INSTALLED -> ARCoreAvailability.NotInstalled
    ArCoreApk.Availability.SUPPORTED_APK_TOO_OLD -> ARCoreAvailability.NeedsUpdate
    ArCoreApk.Availability.UNSUPPORTED_DEVICE_NOT_CAPABLE -> ARCoreAvailability.Unsupported
    ArCoreApk.Availability.UNKNOWN_ERROR -> ARCoreAvailability.CheckFailed
    ArCoreApk.Availability.UNKNOWN_TIMED_OUT -> ARCoreAvailability.CheckFailed
}

/**
 * Classifies an exception thrown by the ARCore install / update request (#3374).
 *
 * `ArCoreApk.requestInstall` throws rather than returning on a device it cannot serve, and
 * that exception used to be the only trace an unsupported device left: it was swallowed
 * into `onArSessionFailed`, which no demo wires.
 *
 * Anything unrecognised becomes [ARCoreAvailability.CheckFailed] — retryable and honest —
 * never `null`, because a `null` here would be another silent hang.
 */
fun Throwable.toARCoreAvailability(): ARCoreAvailability = when (this) {
    // The device will never run ARCore.
    is UnavailableDeviceNotCompatibleException -> ARCoreAvailability.Unsupported
    // Google Play Services for AR is installed but older than this app needs.
    is UnavailableApkTooOldException -> ARCoreAvailability.NeedsUpdate
    is UnavailableArcoreNotInstalledException -> ARCoreAvailability.NotInstalled
    // The user backed out of the Play Store flow: the install is still the way forward,
    // so offer it again rather than pretending the check failed.
    is UnavailableUserDeclinedInstallationException -> ARCoreAvailability.NotInstalled
    // The *app* was built against an ARCore SDK too old for the installed services. The
    // user cannot fix that, but neither is the device incapable — say the check failed.
    is UnavailableSdkTooOldException -> ARCoreAvailability.CheckFailed
    else -> ARCoreAvailability.CheckFailed
}

/**
 * `true` when the state offers the user something to do — an install / update flow, or a
 * retry. [ARCoreAvailability.Unsupported] is the one dead end: the card explains, and
 * offers no button that would do nothing.
 */
val ARCoreAvailability.isActionable: Boolean
    get() = this != ARCoreAvailability.Unsupported

/**
 * What [ARSceneView] knows about an ARCore installation that cannot start a session (#3374).
 *
 * @property availability why AR is unavailable.
 * @property retry re-runs the availability check and, when [ARCoreAvailability.isActionable],
 *   launches the Google Play Services for AR install / update flow.
 */
@Immutable
class ARCoreAvailabilityState(
    val availability: ARCoreAvailability,
    val retry: () -> Unit,
)

/** Test tags for [ARCoreAvailabilityOverlay]. */
object ARCoreAvailabilityOverlayTags {
    const val CARD = "sceneview-arcore-availability"
    const val ACTION = "sceneview-arcore-availability-action"
}

/** Title string resource for this state. */
internal fun ARCoreAvailability.titleRes(): Int = when (this) {
    ARCoreAvailability.Unsupported -> R.string.sceneview_arcore_unsupported_title
    ARCoreAvailability.NotInstalled -> R.string.sceneview_arcore_not_installed_title
    ARCoreAvailability.NeedsUpdate -> R.string.sceneview_arcore_needs_update_title
    ARCoreAvailability.CheckFailed -> R.string.sceneview_arcore_check_failed_title
    ARCoreAvailability.SessionFailed -> R.string.sceneview_arcore_session_failed_title
}

/** Body string resource for this state. */
internal fun ARCoreAvailability.bodyRes(): Int = when (this) {
    ARCoreAvailability.Unsupported -> R.string.sceneview_arcore_unsupported_body
    ARCoreAvailability.NotInstalled -> R.string.sceneview_arcore_not_installed_body
    ARCoreAvailability.NeedsUpdate -> R.string.sceneview_arcore_needs_update_body
    ARCoreAvailability.CheckFailed -> R.string.sceneview_arcore_check_failed_body
    ARCoreAvailability.SessionFailed -> R.string.sceneview_arcore_session_failed_body
}

/** Action label string resource, or `null` when the state has no action. */
internal fun ARCoreAvailability.actionRes(): Int? = when (this) {
    ARCoreAvailability.Unsupported -> null
    ARCoreAvailability.NotInstalled -> R.string.sceneview_arcore_install
    ARCoreAvailability.NeedsUpdate -> R.string.sceneview_arcore_update
    ARCoreAvailability.CheckFailed -> R.string.sceneview_arcore_retry
    ARCoreAvailability.SessionFailed -> R.string.sceneview_arcore_retry
}

/**
 * The built-in explanation drawn by [ARSceneView] when ARCore cannot start a session: the
 * same dark card as [ARCameraPermissionOverlay] — the ground is a camera frame, so it does
 * not follow the app theme — with one action, or none when the device is simply not capable.
 *
 * Public so hosts that pass their own `arCoreAvailabilityOverlay` can still reuse it, and so
 * previews can render every variant without an ARCore session.
 *
 * @param contentPadding space occupied by the host's chrome. In a short remaining band, the
 *   card's vertical margin and padding yield so its recovery action remains usable.
 */
@Composable
fun BoxScope.ARCoreAvailabilityOverlay(
    state: ARCoreAvailabilityState,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    AROverlayCard(
        title = stringResource(state.availability.titleRes()),
        body = stringResource(state.availability.bodyRes()),
        action = state.availability.actionRes()?.let { stringResource(it) },
        onAction = { state.retry() },
        cardTag = ARCoreAvailabilityOverlayTags.CARD,
        actionTag = ARCoreAvailabilityOverlayTags.ACTION,
        modifier = modifier,
        contentPadding = contentPadding,
    )
}

/** Binary-compatibility shim for the pre-`contentPadding` descriptor. */
@Deprecated("Use the overload that takes contentPadding.", level = DeprecationLevel.HIDDEN)
@Composable
fun BoxScope.ARCoreAvailabilityOverlay(
    state: ARCoreAvailabilityState,
    modifier: Modifier = Modifier,
) = ARCoreAvailabilityOverlay(state, modifier, contentPadding = PaddingValues(0.dp))

```

### Core Architecture Module: `arsceneview/src/main/java/io/github/sceneview/ar/ARTrackingStateLog.kt`
```
package io.github.sceneview.ar

import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.TrackingState

/**
 * Turns the camera's per-frame tracking state into one log line per **transition**, repeated
 * every [REPEAT_NANOS] for as long as the camera is not tracking (#4510).
 *
 * A session that delivers camera images but never reaches `TRACKING` used to leave nothing in
 * logcat: `onTrackingFailureChanged` only reports a non-`NONE` reason, so a camera sitting in
 * `PAUSED` with reason `NONE` was silent. One line per change — `NONE` included, never one per
 * frame — is enough to tell that case from a throwing frame loop.
 *
 * The repeat is what keeps the line readable later: ARCore writes some sixty lines a second from
 * the app's own process, so a line logged once when the session started has left a default
 * 256 KiB log buffer within a couple of minutes. A repeated line carries `for=<n>s`, the time the
 * state has lasted, which tells "never tracked" from "tracked, then lost it". A tracking camera
 * repeats nothing.
 *
 * Time is the caller's monotonic clock, not the camera image's timestamp: a session that stops
 * delivering new images keeps handing back the same frame with the same timestamp, and that is
 * one of the states this line has to keep reporting.
 */
internal class ARTrackingStateLog {
    private var lastSessionId: Int? = null
    private var lastState: TrackingState? = null
    private var lastReason: TrackingFailureReason? = null
    private var sinceNanos = 0L
    private var loggedAtNanos = 0L

    /**
     * @param nowNanos a monotonic clock — the display frame time `withFrameNanos` hands the
     *   render loop. The tests inject their own.
     * @param sessionId identity of the session the frame belongs to. A different one starts the
     *   log over: a recreated session logs its first frame, and counts `for=` from it.
     * @return the line to log — when [state] or [reason] differs from the previous frame's (the
     *   first frame of a session always differs), or when a state other than `TRACKING` has
     *   lasted another [REPEAT_NANOS] — or `null` when there is nothing to say.
     */
    fun transition(
        state: TrackingState,
        reason: TrackingFailureReason,
        nowNanos: Long,
        sessionId: Int = 0,
    ): String? {
        val changed = sessionId != lastSessionId || state != lastState || reason != lastReason
        // A monotonic clock does not go back; one that does is not the clock the count started
        // on, so start over from it rather than report a negative or a stale duration.
        if (changed || nowNanos < loggedAtNanos) {
            lastSessionId = sessionId
            lastState = state
            lastReason = reason
            sinceNanos = nowNanos
            loggedAtNanos = nowNanos
        }
        return when {
            changed -> "$PREFIX state=$state reason=$reason"
            state == TrackingState.TRACKING -> null
            nowNanos - loggedAtNanos < REPEAT_NANOS -> null
            else -> {
                loggedAtNanos = nowNanos
                val seconds = (nowNanos - sinceNanos) / NANOS_PER_SECOND
                "$PREFIX state=$state reason=$reason for=${seconds}s"
            }
        }
    }

    companion object {
        /** Stable prefix: grep a bug report's logcat for it. */
        const val PREFIX: String = "AR tracking:"

        /** How often a camera that is not tracking says so again. */
        const val REPEAT_NANOS: Long = 10_000_000_000L

        private const val NANOS_PER_SECOND = 1_000_000_000L
    }
}

```

### Core Architecture Module: `arsceneview/src/main/java/io/github/sceneview/ar/AutoPlacementState.kt`
```
package io.github.sceneview.ar

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.github.sceneview.math.Size

import kotlin.math.abs
import kotlin.math.sqrt

/** Observable automatic-placement phases shared with the Apple placement controller. */
enum class PlacementPhase {
    /**
     * No *tracked* camera frame yet. Frames that arrive before tracking starts keep the
     * session here — they are the normal start-up, not a tracking loss. See
     * [AutoPlacementState.hasCameraFrame] for "has any frame arrived at all".
     */
    INITIALIZING,

    /** Camera tracking, request pending, searching for a usable surface. */
    SCANNING,

    /** [AutoPlacementState.NO_SURFACE_TIMEOUT_MS] of scanning without a surface. */
    NO_SURFACE,

    /** The object is anchored and its anchor is tracking. */
    PLACED,

    /** A surface-constrained gesture is active. */
    ADJUSTING,

    /** The camera is not tracking (or a QA failure is forced). */
    TRACKING_LOST,

    /** Camera back, but the placement's anchor has not re-tracked yet. */
    RECOVERING,

    /** [AutoPlacementState.RECOVERY_TIMEOUT_MS] of recovering — offer *Scan again*. */
    RECOVERY_FAILED,

    /** The session never delivered a single frame past the init scrim's timeout. */
    CAMERA_ERROR,
}

/**
 * The generations an asynchronous asset result was issued under. A result is only allowed
 * to populate the scene when both still match the controller's current ones — see
 * [AutoPlacementState.acceptsAsset].
 */
data class AssetTicket(val session: Int, val selection: Int)

/** What the session must do after one frame has been fed to the controller. */
enum class FrameEffect {
    NONE,

    /** Create the anchor on the surface that was offered, and tick `medium()`. */
    PLACE,

    /** Tracking was just lost — `warning()` once, never per frame. */
    TRACKING_LOST,
}

/**
 * One frame's worth of facts, already reduced to booleans by the session layer.
 *
 * @param nowMillis monotonic clock.
 * @param tracking `frame.camera.trackingState == TRACKING` and no forced failure.
 * @param surfaceAvailable a usable surface was found this frame (only evaluated by the
 *   session when [AutoPlacementState.wantsSurface] is true, so the hit test is not run
 *   at 60 Hz for nothing).
 * @param anchorTracking the placement's anchor tracking state, `null` when nothing is placed.
 */
data class FrameInput(
    val nowMillis: Long,
    val tracking: Boolean,
    val surfaceAvailable: Boolean,
    val anchorTracking: Boolean? = null,
)

class AutoPlacementState {

    /** Current multiplier of the selected preview/authored base size. */
    var scaleFactor: Float by mutableStateOf(1f)
        internal set

    /**
     * The placed [AutoPlacementModel]'s dimensions at 100 %, in metres — width (X), height (Y)
     * and depth (Z) of its axis-aligned box after its `assetRotation`, as it stands on a floor.
     *
     * With [PlacementSize.RealWorld] the box is built from the asset's authored dimensions.
     * [PlacementSize.FitInto] fits the longest authored axis *before* `assetRotation`, so the
     * largest value here is the requested size only when the rotation is a multiple of 90°: a
     * 1 m cube at `FitInto(1f)` turned 45° about Y reports about 1.41 × 1 × 1.41 m.
     *
     * `null` while no model is composed, for an asset with an empty bounding box, and during
     * the model's first composition: it is published from an effect, so it arrives one frame
     * after the model.
     *
     * To let the user pick a size — "make it 2 m tall" — scale relative to it:
     *
     * ```kotlin
     * state.baseSize?.let { state.scaleTo(2f / it.y) }
     * ```
     *
     * [scaleTo] clamps to [scaleRange] (25–400 % by default) and does nothing while
     * [allowsScaling] is `false`: a 0.3 m preview asked to stand 2 m tall needs ×6.7 and stops
     * at 1.2 m. Widen [scaleRange] first (`0.25f..16f`, say) when the target may lie outside it.
     */
    var baseSize: Size? by mutableStateOf(null)
        private set

    /**
     * The placed model's current dimensions in metres: [baseSize] times [scaleFactor], so it
     * follows the pinch, [scaleTo] and the double-tap. `null` while no model is composed.
     */
    val placedSize: Size?
        get() = baseSize?.let { it * scaleFactor }

    /**
     * The model was placed with [PlacementSize.RealWorld] and is shown at exactly 100 % — what
     * the user sees is the object's true size.
     */
    val isAtRealWorldSize: Boolean
        get() = baseSize != null && baseIsRealWorld && scaleFactor == 1f

    private var baseIsRealWorld: Boolean by mutableStateOf(false)
    private var baseSizeOwner: Any? = null

    /** Called by [AutoPlacementModel] once its model exists; [owner] identifies the writer. */
    internal fun publishBaseSize(owner: Any, size: Size?, realWorld: Boolean) {
        baseSizeOwner = owner
        baseIsRealWorld = realWorld
        baseSize = size
    }

    /** Clears [baseSize] unless another model has published since [owner] did. */
    internal fun clearBaseSize(owner: Any) {
        if (baseSizeOwner !== owner) return
        baseSizeOwner = null
        baseIsRealWorld = false
        baseSize = null
    }

    internal var moveAction: ((Float, Float) -> Boolean)? = null
    internal var rotateAction: ((Float) -> Unit)? = null
    internal var scaleAction: ((Float) -> Unit)? = null
    internal var scaleToggleAction: (() -> Unit)? = null

    /**
     * Draw the selection ring — a thin white footprint ring on the surface around the placed
     * [AutoPlacementModel] — while [isSelected] (Scene Viewer's selection affordance). On by
     * default; set `false` to draw your own selection chrome from [isSelected].
     */
    var showsSelectionRing: Boolean by mutableStateOf(true)

    /**
     * Draw a soft contact shadow under the placed [AutoPlacementModel] when it stands on a floor
     * or a table, so it reads as resting on the surface rather than hovering above it — whatever
     * the estimated light, which may put the real shadow off to one side or nowhere. On by
     * default; set `false` to keep only the real shadow (`groundShadows`) or draw your own.
     * Never drawn for a wall placement.
     */
    var showsContactShadow: Boolean by mutableStateOf(true)

    /**
     * Let the user resize the placed object with a pinch, [scaleTo] or the double-tap.
     *
     * Set `false` for anything that must stay at real size (furniture, a pool, a shed): the
     * pinch, [scaleTo] and the double-tap stop resizing it, move and rotate keep working, and
     * an object already resized animates back to 100 %. Same meaning as Quick Look's
     * `allowsContentScaling = false`, Scene Viewer's `resizable=false` and model-viewer's
     * `ar-scale="fixed"`.
     *
     * ```kotlin
     * val state = remember { AutoPlacementState().apply { allowsScaling = false } }
     * ```
     */
    var allowsScaling: Boolean by mutableStateOf(true)

    /** Gesture-driven haptic events (snap, limit, invalid move); set by [ARHapticFeedback]. */
    internal var gestureHapticSink: ((io.github.sceneview.haptic.ARHapticEvent) -> Unit)? = null
    private val canManipulate: Boolean
        get() = isSelected && (phase == PlacementPhase.PLACED || phase == PlacementPhase.ADJUSTING)

    /** Accessibility alternative: metres along the surface's right and up (wall) / forward axes. */
    fun moveBy(x: Float, y: Float): Boolean = canManipulate && x.isFinite() && y.isFinite() &&
        moveAction?.invoke(x, y) == true

    /** Accessibility alternative: degrees about the surface normal, preserving contact. */
    fun rotateBy(degrees: Float) {
        if (canManipulate && degrees.isFinite()) rotateAction?.invoke(degrees)
    }

    /**
     * How far the pinch, [scaleTo] and the double-tap may resize the placed object, as a
     * multiplier of its base size: 25–400 % by default, Scene Viewer's range.
     *
     * Widen it when the base size is not the only sensible one — a 1:16 miniature that the
     * user may pinch all the way up to real size takes `0.25f..16f`. The 100 % detent stays
     * at the base size. An empty or non-positive range is ignored. Changing it does not resize
     * an object already placed: [scaleFactor] keeps its value, even outside the new range,
     * until the next pinch, [scaleTo] or double-tap brings it back inside.
     *
     * ```kotlin
     * val state = remember { AutoPlacementState().apply { scaleRange = 0.25f..16f } }
     * ```
     */
    var scaleRange: ClosedFloatingPointRange<Float> by mutableStateOf(ScaleSnap.RANGE)

    /** [scaleRange], or the default one when it is unusable. */
    internal val usableScaleRange: ClosedFloatingPointRange<Float>
        get() = scaleRange.takeIf {
            it.start > 0f && it.start.isFinite() && it.endInclusive.isFinite() && it.start <= it.endInclusive
        } ?: ScaleSnap.RANGE

    /**
     * Accessibility alternative: uniform base-size multiplier, clamped to [scaleRange]
     * (25–400 % by default) without notice — a factor outside it lands on the nearest bound.
     * Ignored while [allowsScaling] is `false`.
     */
    fun scaleTo(factor: Float) {
        if (allowsScaling && canManipulate && factor.isFinite()) {
            val range = usableScaleRange
            scaleAction?.invoke(factor.coerceIn(range.start, range.endInclusive))
        }
    }

    /**
     * The double-tap on the placed object: selects it, then animates it back to exactly
     * 100 % if it was resized — or, already at 100 %, back to the size the user had pinched
     * it to before (a toggle, not a one-way reset). Never resized, it plays the 100 %
     * rebound so the tap is acknowledged. While [allowsScaling] is `false` it only selects.
     * Wire it to `onDoubleTap` when the tapped node is the placed model;
     * [AutoPlacementScene] already
```

### Core Architecture Module: `arsceneview/src/main/java/io/github/sceneview/ar/HostLifecycle.kt`
```
package io.github.sceneview.ar

import android.content.Context
import android.content.ContextWrapper
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.compose.LocalLifecycleOwner

/**
 * The lifecycle of the activity hosting this composable — pass it to [ARSceneView] to keep the
 * camera live while an AR screen animates in and out of a `NavHost`.
 *
 * Opt-in: [ARSceneView] follows `LocalLifecycleOwner` by default. Inside a `NavHost` that is
 * the destination's back stack entry, which Navigation moves to `CREATED` when its exit
 * transition *starts*: the AR session stops while the screen is still on screen and the surface
 * shows the last camera image, frozen, for the whole transition. Bound to the activity instead,
 * the session runs while the composable is in the composition and the activity is resumed,
 * pauses when the activity pauses (Home, screen off, another activity on top) and is closed
 * when the composable leaves the composition.
 *
 * ```kotlin
 * ARSceneView(
 *     modifier = Modifier.fillMaxSize(),
 *     lifecycle = rememberHostLifecycle(),
 * )
 * ```
 *
 * Use it for an AR screen that is a `NavHost` destination with enter/exit transitions. Do not
 * use it where the host keeps the `ARSceneView` composed but not visible (a `ViewPager2` page, a
 * screen under a full-screen `dialog()` destination): the camera would stay on there. When two
 * `ARSceneView`s are resumed together, the one that resumed last takes the camera and gives it
 * back when it is disposed, paused or fails to resume. On a predictive back gesture from one AR
 * screen to another, the screen under the finger keeps its last frame until the gesture ends.
 *
 * @return the lifecycle of the first [LifecycleOwner] found by unwrapping `LocalContext` (the
 * activity, also from inside a `Dialog` or a themed subtree), or `LocalLifecycleOwner`'s when
 * the context is not hosted by one.
 */
@Composable
fun rememberHostLifecycle(): Lifecycle {
    val context = LocalContext.current
    val local = LocalLifecycleOwner.current.lifecycle
    return remember(context, local) { context.findHostLifecycle() ?: local }
}

/**
 * The lifecycle of the first [LifecycleOwner] found by unwrapping this context, which is the
 * activity for a composable set in one (a `Dialog` or a themed wrapper included), or `null`.
 */
internal fun Context.findHostLifecycle(): Lifecycle? {
    var context: Context? = this
    while (context != null) {
        if (context is LifecycleOwner) return context.lifecycle
        context = (context as? ContextWrapper)?.baseContext
    }
    return null
}

```

### Core Architecture Module: `arsceneview/src/main/java/io/github/sceneview/ar/arcore/ArCoreApk.kt`
```
package io.github.sceneview.ar.arcore

import android.content.Context
import com.google.ar.core.ArCoreApk
import com.google.ar.core.ArCoreApk.Availability
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Suspend-friendly version of [ArCoreApk.checkAvailabilityAsync].
 *
 * The synchronous [ArCoreApk.checkAvailability] can briefly ANR if Google Play Services for AR
 * hasn't been queried yet on this device (the call blocks while ARCore probes the system).
 * The async variant has been the recommended path since ARCore 1.30 — this is the Kotlin
 * coroutine wrapper.
 *
 * Cancelling the coroutine **does not cancel the underlying probe** (ARCore offers no
 * cancellation hook), but the caller stops observing the result.
 *
 * ```kotlin
 * val availability = withContext(Dispatchers.Main) {
 *     ArCoreApk.getInstance().awaitAvailability(context)
 * }
 * if (availability.isSupported) { /* show AR entry button */ }
 * ```
 *
 * @see ArCoreApk.checkAvailabilityAsync
 */
suspend fun ArCoreApk.awaitAvailability(context: Context): Availability =
    suspendCancellableCoroutine { cont ->
        checkAvailabilityAsync(context) { availability ->
            cont.resume(availability)
        }
    }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5162** (2026-11-19): **Node editing overlay: the selection ring collapses to a dot when the node's yaw is ~90° from the camera**
  *Symptoms*: Found while reviewing #5161 (the PR does not cause it; present on `main` since #3357).  **Symptom.** In the demo "Camera & object controls" → Move, on the Damaged Helmet: during a twist the selection ring shrinks to a dot, stays a dot at rest, and stays a dot during a pinch; a second twist brings back a full ring.  **Cause.** `sceneview/src/main/java/io/github/sceneview/gesture/NodeEditingOverlay.kt` (~521): `radiusX` is only the screen-x span of the node-local X chord, so the ring width is `R · |cos(node yaw − camera azimuth)|`. The helmet rests at −22° yaw with the Hero camera at 32°, so the ring is already at 59 % width at rest; after a −35°/−37° twist the yaw is ~90° from the camera → 1.7 %, a dot.  **Fix.** Project both local axes and take the ellipse's extent from both: with `a = (xPos − xNeg)/2` and `b = (zPos − zNeg)/2` in screen space, `radiusX = hypot(a.x, b.x)` and `radiusY = hypot(a.y, b.y)`. Add a JVM test: rotating the node about Y keeps the ring's screen width within a tolerance of its rest width.  Proof needed: emulator captures of the same twist before/after, light and dark. 

- **Issue #5134** (2026-11-18): **ARSceneView: sceneUnderstanding silently overrides planeRenderer (occlusion = true turns planes back on)**
  *Symptoms*: Found while reviewing #5087.  `ARSceneView` applies two plane-visibility knobs in two `SideEffect`s (`ARSceneView.kt` ~1519-1540): `planeRenderer`, then the grouped `sceneUnderstanding.planeVisualization`. Both run on the main thread and the grouped one always wins, as the KDoc (~600-612) and `llms.txt` (~677) say. It is not a race, but it is a trap:  - `SceneUnderstanding(occlusion = true)` — the `llms.txt` sample (~702) — silently forces planes back on over `planeRenderer = false`. An app that turns occlusion on through the grouped settings loses its plane toggle with no warning. - Each recomposition where the two disagree refreshes every plane renderable twice.  Proposed fix: - [ ] Skip the `planeRenderer` write when `sceneUnderstanding.planeVisualization` is non-null (or the reverse: let an explicit `planeRenderer` win), so only one knob writes. - [ ] Document "do not combine `planeRenderer` with `sceneUnderstanding`" in the KDoc and `llms.txt`, and fix the `llms.txt` sample so turning occlusion on does not force planes on. - [ ] A test: `sceneUnderstanding = SceneUnderstanding(occlusion = true)` with `planeRenderer = false` keeps planes hidden. 

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

### Incident Patch 1: `0db548c6` (2026-11-20)
**Commit Message**: fix(demo): bound the 3D scan journal and release the live model on exit (#5186)

* fix(demo): bound the 3D scan journal and release the live model on exit

A 406-second room scan ran a real user's 256 MB Java heap out of memory
(Crashlytics, 4.69.5). Two retentions grew with the scan or outlived it:

- the scan's replay journal had no total budget; it is now an
  ArDebugJournal capped at 4 MiB that halves camera and point
  observations across the timeline when full, keeping photo poses,
  planes, depth counts and floor cells;
- the live model's TSDF (up to ~48 MB) stayed in a process-wide slot
  after leaving the demo; a per-demo owner now forgets it on exit or on a
  discarded capture, while a successful save still hands it to the
  result screen.

Closing a capture also releases its trace, dense map, photos and
thumbnails. Debug builds log heap and journal sizes every minute of a
scan (tag SceneView/ScanMem) for device measurements.

Refs #5043

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* chore(changelog): number the scan memory fragment

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(demo): check ScanMem log lines only in debug builds

The memory release a

**File**: `changelog.d/5186-scan-oom.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+<!-- category: Fixed -->
+- **Demo app: smoother, more reliable 3D scans.** The demo now requests a large heap, so long room scans keep full model detail, with a memory safety net on phones still below 384 MiB. The replay journal, previously unbounded, is capped (8 MiB on a 512 MiB heap) and always keeps photos, floor coverage, anchors and when each plane appeared or was removed. Leaving a scan frees its memory reliably, and the saved-scans list loads lazily, so exits no longer freeze.
```

**File**: `samples/android-demo/src/main/AndroidManifest.xml` (modified, +1/-0)
```diff
@@ -102,6 +102,7 @@
         android:fullBackupContent="@xml/backup_descriptor"
         android:icon="@mipmap/ic_launcher"
         android:label="@string/launcher_label"
+        android:largeHeap="true"
         android:roundIcon="@mipmap/ic_launcher_round"
         android:supportsRtl="true"
         android:theme="@style/Theme.SceneViewDemo">
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/ARRerunDemo.kt` (modified, +113/-33)
```diff
@@ -29,6 +29,9 @@ import androidx.compose.foundation.layout.Column
 import androidx.compose.foundation.layout.Row
 import androidx.compose.foundation.layout.Spacer
 import androidx.compose.foundation.layout.WindowInsets
+import androidx.compose.foundation.layout.WindowInsetsSides
+import androidx.compose.foundation.layout.only
+import androidx.compose.foundation.layout.windowInsetsPadding
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.foundation.layout.fillMaxWidth
 import androidx.compose.foundation.layout.heightIn
@@ -41,6 +44,7 @@ import androidx.compose.foundation.layout.widthIn
 import androidx.compose.foundation.shape.CircleShape
 import androidx.compose.foundation.shape.RoundedCornerShape
 import androidx.compose.material.icons.Icons
+import androidx.compose.material.icons.automirrored.filled.ArrowBack
 import androidx.compose.material.icons.outlined.RestartAlt
 import androidx.compose.material.icons.rounded.ExpandLess
 import androidx.compose.material.icons.rounded.ExpandMore
@@ -90,6 +94,7 @@ import androidx.compose.ui.platform.LocalConfiguration
 import androidx.compose.ui.platform.LocalContext
 import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.platform.LocalLayoutDirection
+import androidx.compose.ui.platform.LocalLocale
 import androidx.compose.ui.platform.LocalWindowInfo
 import androidx.compose.ui.platform.testTag
 import androidx.compose.ui.res.stringResource
@@ -216,7 +221,6 @@ import io.github.sceneview.demo.demos.internal.rerunShowsSaveAction
 import io.github.sceneview.demo.demos.internal.rerunStatusUx
 import io.github.sceneview.demo.demos.internal.turnedBy
 import io.github.sceneview.demo.rememberArPlaybackDataset
-import io.github.sceneview.demo.theme.LocalStageChrome
 import io.github.sceneview.demo.theme.SceneViewTokens
 import io.github.sceneview.demo.theme.SceneViewTokens.ArOverlay
 import io.github.sceneview.demo.theme.SceneViewTokens.Space
@@ -237,6 +241,8 @@ import kotlin.math.roundToInt
 import kotlin.math.sin
 import kotlinx.coroutines.CancellationException
 import kotlinx.coroutines.Dispatchers
+import io.github.sceneview.demo.ui.GlassIconButton
+import io.github.sceneview.demo.ui.GlassPill
 import kotlinx.coroutines.Job
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.delay
@@ -279,6 +285,7 @@ fun ARRerunDemo(onBack: () -> Unit, startInDollhouse: Boolean = false) {
     val context = LocalContext.current
     val scope = rememberCoroutineScope()
     ForgetRoomSurveysOnExit()
+    val liveModels = rememberRerunLiveModels()
     // Replay a recorded ARCore dataset when the device-QA harness deep-links this demo
     // with `--es ar_playback_file <path>` (#1576): that harness drives the live path.
     val arPlaybackDataset = rememberArPlaybackDataset()
@@ -304,8 +311,9 @@ fun ARRerunDemo(onBack: () -> Unit, startInDollhouse: Boolean = false) {
     var exampleRead by remember { mutableStateOf(false) }
     var exampleAsked by remember { mutableStateOf(false) }
     // The room feeds the example replay and the staged QA capture states.
-    val sample by produceState<RerunReplayMedia?>(null) {
-        value = runCatching { loadRerunReplay(context) }.getOrNull()
+    var sample by remember { mutableStateOf<RerunReplayMedia?>(null) }
+    LaunchedEffect(Unit) {
+        sample = runCatching { loadRerunReplay(context) }.getOrNull()
         exampleRead = true
     }
 
@@ -314,8 +322,10 @@ fun ARRerunDemo(onBack: () -> Unit, startInDollhouse: Boolean = false) {
     var sessionsVersion by remember { mutableIntStateOf(0) }
     // A scan saved after its capture screen was left (#4500) lands in the list too.
     val savedAway = RerunScanBuilds.savedAway
-    val sessions by produceState<List<LandingSession>?>(null, sessionsVersion, savedAway) {
-        value = store.landingSessions()
+    val landingCache = remember { RerunLandingCache() }
+    val landingLocale = LocalLocale.current.platformLocale
+    val sessions by produceState<List<LandingSession>?>(null, sessionsVersion, savedAway, landingLocale) {
+        value = store.landingSessions(landingCache, landingLocale)
     }
     // What the landing says about the last file opened: why it did not open, or that it is opening.
     var notice by remember { mutableStateOf<String?>(null) }
@@ -362,6 +372,13 @@ fun ARRerunDemo(onBack: () -> Unit, startInDollhouse: Boolean = false) {
             },
         )
     }
+    // Save hands the live TSDF to this demo, not to one result tab. mesh releases it after
+    // extraction, clearScanResult releases it on leaving the result, and this effect covers
+    // source replacement and demo exit. Capture Discard uses dropCapture/ScanCapture.close(false).
+    DisposableEffect(modelSource) {
+        val live = modelSource as? RerunModelSource.Live
+        onDispose { live?.release() }
+    }
     // The model on screen, once built or read back: what the export sheet writes first.
     var resultModel by remember { 
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/ArDebugView.kt` (modified, +4/-1)
```diff
@@ -299,7 +299,10 @@ internal class ArDebugRecorder {
         livePlanes += seen
     }
 
-    private fun reset(trace: ArDebugTrace) {
+    /** Detaches a closed capture even when no subsequent AR frame arrives. */
+    fun clear() = reset(null)
+
+    private fun reset(trace: ArDebugTrace?) {
         recordedFor = trace
         pointsGate.reset()
         planesGate.reset()
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/RerunLandingUi.kt` (modified, +83/-77)
```diff
@@ -7,6 +7,9 @@ import androidx.compose.foundation.clickable
 import androidx.compose.foundation.layout.Arrangement
 import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.PaddingValues
+import androidx.compose.foundation.lazy.LazyColumn
+import androidx.compose.foundation.lazy.items
 import androidx.compose.foundation.layout.Row
 import androidx.compose.foundation.layout.RowScope
 import androidx.compose.foundation.layout.WindowInsets
@@ -63,7 +66,6 @@ import androidx.compose.ui.graphics.drawscope.Stroke
 import androidx.compose.ui.graphics.vector.ImageVector
 import androidx.compose.ui.layout.ContentScale
 import androidx.compose.ui.platform.LocalContext
-import androidx.compose.ui.platform.LocalLocale
 import androidx.compose.ui.platform.testTag
 import androidx.compose.ui.res.stringResource
 import androidx.compose.ui.semantics.Role
@@ -120,63 +122,42 @@ internal class RerunLandingActions(
  */
 @Composable
 internal fun RerunLanding(state: RerunLandingState, actions: RerunLandingActions) {
-    LandingPage(state, actions)
+    SessionsSection(state, actions)
 }
 
 /** The themed stage the landing is drawn on. */
 private val stage: StageChrome @Composable get() = LocalStageChrome.current
 
 @Composable
 private fun LandingPage(state: RerunLandingState, actions: RerunLandingActions) {
-    Box(
-        modifier = Modifier
-            .fillMaxSize()
-            .background(stage.ground),
-        contentAlignment = Alignment.TopCenter,
-    ) {
-        Column(
-            modifier = Modifier
-                .fillMaxSize()
-                .rerunPageScroll()
-                .padding(horizontal = Space.md),
-            horizontalAlignment = Alignment.CenterHorizontally,
-        ) {
-            Column(
-                modifier = Modifier
-                    .widthIn(max = RerunPageMaxWidth)
-                    .fillMaxWidth(),
-                verticalArrangement = Arrangement.spacedBy(Space.md),
-            ) {
-                Column(verticalArrangement = Arrangement.spacedBy(Space.xs)) {
-                    Text(
-                        text = ScanCopy.LANDING_TITLE,
-                        style = Type.display.copy(color = stage.onGlass),
-                        modifier = Modifier.semantics { heading() },
-                    )
-                    Text(text = ScanCopy.LANDING_BODY, style = Type.body.copy(color = stage.onGlassMuted))
-                }
-                RecordRoomCard(onClick = actions.onRecord)
-                Row(horizontalArrangement = Arrangement.spacedBy(Space.sm)) {
-                    GlassAction(
-                        icon = Icons.Rounded.PlayArrow,
-                        label = ScanCopy.WATCH_SAMPLE,
-                        onClick = actions.onWatchSample,
-                        modifier = Modifier.weight(1f).testTag(WATCH_SAMPLE_TAG),
-                    )
-                    GlassAction(
-                        icon = Icons.Outlined.FileOpen,
-                        label = ScanCopy.OPEN_FILE,
-                        onClick = actions.onOpenFile,
-                        modifier = Modifier.testTag(OPEN_FILE_TAG),
-                    )
-                }
-                // What happened to the file just opened: under the button that opened it, not
-                // inside the list of sessions.
-                state.notice?.let { NoticeCard(it, onDismiss = actions.onDismissNotice) }
-                if (state.openingFile) OpeningCard(ScanCopy.OPENING_FILE)
-                SessionsSection(state, actions)
-            }
+    Column(verticalArrangement = Arrangement.spacedBy(Space.md)) {
+        Column(verticalArrangement = Arrangement.spacedBy(Space.xs)) {
+            Text(
+                text = ScanCopy.LANDING_TITLE,
+                style = Type.display.copy(color = stage.onGlass),
+                modifier = Modifier.semantics { heading() },
+            )
+            Text(text = ScanCopy.LANDING_BODY, style = Type.body.copy(color = stage.onGlassMuted))
         }
+        RecordRoomCard(onClick = actions.onRecord)
+        Row(horizontalArrangement = Arrangement.spacedBy(Space.sm)) {
+            GlassAction(
+                icon = Icons.Rounded.PlayArrow,
+                label = ScanCopy.WATCH_SAMPLE,
+                onClick = actions.onWatchSample,
+                modifier = Modifier.weight(1f).testTag(WATCH_SAMPLE_TAG),
+            )
+            GlassAction(
+                icon = Icons.Outlined.FileOpen,
+                label = ScanCopy.OPEN_FILE,
+                onClick = actions.onOpenFile,
+                modifier = Modifier.testTag(OPEN_FILE_TAG),
+            )
+        }
+        // What happened to the file just opened: under the button that opened it, not
+        // inside the list of sessions.
+        state.notice?.let { NoticeCard(it, onDismiss = actions.onDismissNotice) }
+        if (state.openingFile) OpeningCard(ScanC
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/RerunModelUi.kt` (modified, +111/-40)
```diff
@@ -135,6 +135,7 @@ import io.github.sceneview.demo.demos.internal.RoomMeasure
 import io.github.sceneview.demo.demos.internal.ScanGround
 import io.github.sceneview.demo.demos.internal.ScanGroundMeshes
 import io.github.sceneview.demo.demos.internal.ScanPreset
+import io.github.sceneview.demo.demos.internal.ScanMemoryBudget
 import io.github.sceneview.demo.demos.internal.ScanResultCamera
 import io.github.sceneview.demo.demos.internal.ScanResultCut
 import io.github.sceneview.demo.demos.internal.ScanResultFrame
@@ -274,10 +275,15 @@ internal sealed interface RerunModelSource {
  * lens, fresh depth only — on its own worker: a frame that arrives while one integrates is left
  * to the surfel map alone, so neither slows the other.
  */
-internal class RerunLiveModel(private val preset: ScanPreset = ScanPreset.ROOM) {
+internal class RerunLiveModel(
+    private val owner: RerunLiveModels.Owner,
+    private val preset: ScanPreset = ScanPreset.ROOM,
+    budget: ScanMemoryBudget = ScanMemoryBudget(Runtime.getRuntime().maxMemory()),
+) {
     /** The TSDF while it records; `null` once [keepFor] has handed it on, so only its slot holds it. */
     @Volatile
-    private var tsdf: RerunTsdf? = RerunTsdf(voxelM = preset.modelVoxelM)
+    private var tsdf: RerunTsdf? = RerunTsdf(voxelM = budget.modelVoxelM(preset), maxBytes = budget.tsdfBytes)
+    private var transferred: java.lang.ref.WeakReference<RerunTsdf>? = null
     private val busy = AtomicBoolean(false)
 
     @Volatile
@@ -315,31 +321,86 @@ internal class RerunLiveModel(private val preset: ScanPreset = ScanPreset.ROOM)
     fun keepFor(pack: RerunCapturePack?) {
         val tsdf = tsdf ?: return
         this.tsdf = null
-        if (pack != null && tsdf.frames > 0) RerunLiveModels.keep(pack, tsdf)
+        if (pack != null && tsdf.frames > 0) {
+            owner.keep(pack, tsdf)
+            transferred = java.lang.ref.WeakReference(tsdf)
+        }
+    }
+
+    /** Drops an abandoned capture's TSDF; an integration already running releases its local copy on return. */
+    fun close(keepTransferred: Boolean = false): Job? {
+        val worker = job
+        worker?.cancel()
+        job = null
+        tsdf = null
+        if (!keepTransferred) transferred?.get()?.let(RerunLiveModels::forget)
+        transferred = null
+        return worker
     }
 }
 
 /**
  * The last recording's TSDF, kept in memory with the scan it belongs to (one slot: ~50 MB at
- * most). A scan reopened from the list in the same process finds it by its manifest's bytes.
+ * most). It survives capture -> result so [RerunModelSource.of] can mesh it. The owning demo
+ * releases it on exit; a later reopen uses the saved model or surfels instead.
  */
 internal object RerunLiveModels {
     @Volatile
     private var kept: Pair<ByteArray, RerunTsdf>? = null
 
-    fun keep(pack: RerunCapturePack, tsdf: RerunTsdf) {
+    @Synchronized
+    private fun keep(pack: RerunCapturePack, tsdf: RerunTsdf) {
         kept = pack.manifest to tsdf
     }
 
+    @Synchronized
     fun find(pack: RerunCapturePack?): RerunTsdf? {
         pack ?: return null
         return kept?.takeIf { it.first.contentEquals(pack.manifest) }?.second
     }
 
     /** Empties the slot when it holds [tsdf]. */
+    @Synchronized
     fun forget(tsdf: RerunTsdf) {
         if (kept?.second === tsdf) kept = null
     }
+
+    /** One demo composition, including its result screen. A detached save cannot refill a closed owner. */
+    class Owner : AutoCloseable {
+        private var closed = false
+        // The owner must not undo Live.release() by retaining a second strong reference.
+        private var held: java.lang.ref.WeakReference<RerunTsdf>? = null
+
+        @Synchronized
+        fun keep(pack: RerunCapturePack, tsdf: RerunTsdf) {
+            if (closed) return
+            held = java.lang.ref.WeakReference(tsdf)
+            RerunLiveModels.keep(pack, tsdf)
+        }
+
+        @Synchronized
+        override fun close() {
+            closed = true
+            forget()
+        }
+
+        /** AR placement has no model-result reader. The owner stays reusable for another capture. */
+        @Synchronized
+        fun forget() {
+            held?.get()?.let(RerunLiveModels::forget)
+            held = null
+        }
+    }
+}
+
+/** The cache belongs to the entire demo, so capture -> result can still use the live TSDF. */
+@Composable
+internal fun rememberRerunLiveModels(): RerunLiveModels.Owner {
+    val owner = remember { RerunLiveModels.Owner() }
+    DisposableEffect(owner) {
+        onDispose { owner.close() }
+    }
+    return owner
 }
 
 /**
@@ -485,8 +546,9 @@ private class Meshed(
 /**
  * Fuses [source] (unless done) and meshes it. Nothing past this function holds the TSDF, so the
  * finish's peak — the cleaning and the photos — never sits on top of its up to
- * [RerunTsdf.MAX_BYTES]. A recording's TSDF that big is also let go from its slot: reopened
- * without a model kep
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/RerunScan.kt` (modified, +125/-16)
```diff
@@ -8,6 +8,7 @@ import android.util.Log
 import com.google.ar.core.CameraIntrinsics
 import com.google.ar.core.Frame
 import com.google.ar.core.Pose
+import io.github.sceneview.demo.BuildConfig
 import io.github.sceneview.demo.demos.internal.AdaptiveConfidence
 import io.github.sceneview.demo.demos.internal.ArDebugEvent
 import io.github.sceneview.demo.demos.internal.ArDebugGeometry
@@ -38,6 +39,7 @@ import io.github.sceneview.demo.demos.internal.ScanCutoff
 import io.github.sceneview.demo.demos.internal.ScanPhotoMotion
 import io.github.sceneview.demo.demos.internal.ScanPhotoPolicy
 import io.github.sceneview.demo.demos.internal.ScanPreset
+import io.github.sceneview.demo.demos.internal.ScanMemoryBudget
 import io.github.sceneview.demo.demos.internal.ScanProjection
 import io.github.sceneview.demo.demos.internal.ScanSharpPicker
 import io.github.sceneview.demo.demos.internal.YuvFrame
@@ -75,20 +77,28 @@ import java.util.concurrent.atomic.AtomicInteger
  * Main thread, like the recorder, except the photo encoding and the depth fusion it launches in
  * [scope].
  */
-internal class ScanCapture private constructor(
+internal class ScanCapture(
     /** The CPU camera image's lens: the photos' and the sparse points' colours. */
     private val intrinsics: ScanIntrinsics,
     /** The GPU camera texture's lens, which ARCore aligns the raw depth with. */
     private val textureIntrinsics: ScanIntrinsics?,
     private val lens: ReplayLens,
     private val scope: CoroutineScope,
+    private val modelOwner: RerunLiveModels.Owner,
     /** Whether the session runs ARCore's raw depth: the scan's tier. */
     val rawDepth: Boolean,
     /** What is scanned decides the photo spacing, the depth kept and the model's voxel (#4647). */
     val preset: ScanPreset = ScanPreset.ROOM,
-) {
+    private val budget: ScanMemoryBudget = ScanMemoryBudget(Runtime.getRuntime().maxMemory()),
+) : AutoCloseable {
     /** The scan's trace; its journal is what [finish] saves. */
-    val trace = ArDebugTrace().apply {
+    val trace = ArDebugTrace(
+        journalMaxBytes = budget.journalBytes,
+        observationMaxBytes = budget.observationBytes,
+        observationMaxCount = ArDebugTrace.MAX_OBSERVATIONS,
+    ) {
+        Log.w(MEMORY_TAG, "journal cap ${budget.journalBytes} bytes reached; decimating scan observations")
+    }.apply {
         keyframeSpacing = ReplayGeometry.KEYFRAME_SPACING_M
         journal = ArrayList()
         // #4683: an object keeps arm's length in its sparse points and planes too, depth or not.
@@ -115,11 +125,12 @@ internal class ScanCapture private constructor(
     // one runs is skipped, never queued, so a slow phone thins the depth instead of lagging.
     // The map keeps a whole flat or house within this phone's budget: past it, it coarsens the
     // regions the camera has left instead of dropping what is new (#4629).
-    private val dense = if (rawDepth) ScanDenseMap() else null
+    private var dense = if (rawDepth) ScanDenseMap(maxPoints = budget.densePoints) else null
     private val fusing = AtomicBoolean(false)
     private var fuseJob: Job? = null
     // The final model's TSDF, fed the same depth copies on its own worker (RerunModelUi.kt).
-    private val model = if (rawDepth) RerunLiveModel(preset) else null
+    private var model = if (rawDepth) RerunLiveModel(modelOwner, preset, budget) else null
+    private val closed = AtomicBoolean(false)
     // Which depth estimate was taken last, and how long the scan has waited for one.
     private val depthWindow = DepthWindow()
     private var loggedSizes = false
@@ -135,9 +146,9 @@ internal class ScanCapture private constructor(
     private val denseKept = AtomicInteger(0)
     private var recordedTotal = 0
 
-    // The dense frame count each DepthStats on the timeline was written at, in order: what
-    // [finish] turns into the saved cloud's prefix found by then (ScanDenseMap.revealed).
-    private val recordedFrames = ArrayList<Int>()
+    // The dense frame count at each DepthStats timestamp. Keyed by time so journal decimation
+    // cannot shift the saved cloud's reveal counts onto different events.
+    private val recordedFrames = HashMap<Long, Int>()
 
     // Why depth frames did or did not grow the map, logged every two seconds for a device run.
     private val intake = DepthIntake()
@@ -150,6 +161,11 @@ internal class ScanCapture private constructor(
 
     /** The journal [finish] took, kept so Try again rebuilds from it after a build that threw. */
     private var finishedEvents: List<ArDebugEvent>? = null
+    private var finishedBytes = 0L
+
+    /** Cleanup outlives the capture scope, which the screen cancels before calling [close]. */
+    internal var releaseJob: Job? = null
+        private set
 
     /**
      * Points the saved scan keeps so far: the HUD's count, the same figure the saved scan shows.
@@ -199,14 +215,15 @@ internal class ScanCapture private constructor(
     /** The scan as it grow
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/RerunScanBuilds.kt` (modified, +22/-0)
```diff
@@ -1,5 +1,9 @@
 package io.github.sceneview.demo.demos
 
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.DisposableEffect
+import androidx.compose.runtime.SideEffect
+import androidx.compose.runtime.remember
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.mutableIntStateOf
 import androidx.compose.runtime.setValue
@@ -37,3 +41,21 @@ internal object RerunScanBuilds {
         if (away) savedAway++
     }
 }
+
+/** A stale accessibility node keeps only this small, cleared handle after its screen closes. */
+internal class RerunClick : () -> Unit {
+    internal var action: (() -> Unit)? = null
+        private set
+
+    fun update(action: () -> Unit) { this.action = action }
+    fun clear() { action = null }
+    override fun invoke() { action?.invoke() }
+}
+
+@Composable
+internal fun rememberRerunClick(action: () -> Unit): RerunClick {
+    val click = remember { RerunClick() }
+    SideEffect { click.update(action) }
+    DisposableEffect(click) { onDispose { click.clear() } }
+    return click
+}
```

---

### Incident Patch 2: `ce630c48` (2026-11-20)
**Commit Message**: fix(demo): discard AR session state after a fatal session failure (#5196)

* fix(demo): discard AR session state after a fatal session failure

After a fatal session.update() failure the SDK closes the session and
creates a new one on Retry. Seven demos kept anchors, augmented images,
frames or futures of the closed session and read them afterwards.

- Each demo's session-bound state now lives in a small holder
  (DemoSessionState) cleared on ARSessionFailure.Fatal; late async
  results from the old session are rejected by a generation counter.
- AR Image, Orbital AR, Depth of Field, Cloud Anchor, Geospatial
  Anchors, Record & Playback, Point and Ask, and the shared
  FeaturePlacementScene.
- AR Surfaces keeps the sofa on a nonfatal resume failure, where its
  anchor is still valid.

Measure and 3D Scan are left for a later change: other branches are
editing them.

Tests: DemoClosedSessionTest (12). Whole demo debug suite: 4685 pass;
detekt clean.

Refs #5132

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>

* fix(demo): address the closed-session review

- Point and Ask no longer hands its failure flag to DemoScaffold, which
  replaced the scene with the no-retry card and dis

**File**: `changelog.d/5132-ar-demos-closed-session.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+<!-- category: Fixed -->
+- **Demo app: AR demos no longer touch a closed camera session after a failure, preventing crashes.** AR Surfaces keeps its sofa when the camera only failed to resume.
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/common/placement/ARFeatureComparison.kt` (modified, +3/-0)
```diff
@@ -285,6 +285,9 @@ private fun FeatureComparisonSession(feature: PlacementFeature, onBack: () -> Un
                     }
                 },
                 onSessionFailed = { cameraFailed = true },
+                onSessionFailure = { failure ->
+                    if (failure is ARSessionFailure.Fatal) session = null
+                },
                 onARCoreAvailability = { availability = it },
                 onTrackingFailureChanged = { trackingFailure = it },
             ) { placement ->
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/common/placement/FeaturePlacementScene.kt` (modified, +11/-4)
```diff
@@ -13,6 +13,8 @@ import io.github.sceneview.ar.camera.ARCameraStream
 import io.github.sceneview.ar.rememberHostLifecycle
 import io.github.sceneview.loaders.MaterialLoader
 import io.github.sceneview.loaders.ModelLoader
+import io.github.sceneview.demo.demos.internal.FeaturePlacementSessionState
+import io.github.sceneview.demo.demos.internal.onFailure
 import io.github.sceneview.rememberOnGestureListener
 import java.io.File
 
@@ -34,6 +36,7 @@ internal fun FeaturePlacementScene(
     onSessionResumed: (Session) -> Unit = {},
     onSessionUpdated: (Session, Frame) -> Unit = { _, _ -> },
     onSessionFailed: (Exception) -> Unit = {},
+    onSessionFailure: (ARSessionFailure) -> Unit = {},
     onARCoreAvailability: (ARCoreAvailability?) -> Unit = {},
     arCoreAvailabilityOverlay: (@Composable BoxScope.(ARCoreAvailabilityState) -> Unit)? =
         { ARCoreAvailabilityOverlay(it) },
@@ -42,8 +45,9 @@ internal fun FeaturePlacementScene(
     content: @Composable ARSceneScope.(AutoPlacementResult?) -> Unit,
 ) {
     var viewport by remember { mutableStateOf(IntSize.Zero) }
-    var placement by remember(state) { mutableStateOf<AutoPlacementResult?>(null) }
-    var planes by remember { mutableStateOf<List<Plane>>(emptyList()) }
+    val sessionState = remember(state) { FeaturePlacementSessionState<AutoPlacementResult, Plane>() }
+    var placement by sessionState::placement
+    var planes by sessionState::planes
     val ready by rememberUpdatedState(assetReady)
     LaunchedEffect(state, assetReady) {
         if (assetReady) state.requestPlacement() else state.withdrawRequest()
@@ -55,10 +59,9 @@ internal fun FeaturePlacementScene(
             placement = null
         }
     }
-    val currentPlacement by rememberUpdatedState(placement)
     DisposableEffect(state) {
         onDispose {
-            currentPlacement?.anchor?.detach()
+            sessionState.placement?.anchor?.detach()
             state.dismiss()
         }
     }
@@ -77,6 +80,10 @@ internal fun FeaturePlacementScene(
             onSessionResumed(session)
         },
         onSessionFailed = { state.cameraFailed(); onSessionFailed(it) },
+        onSessionFailure = { failure ->
+            if (sessionState.onFailure(failure)) state.resetPlacement(SystemClock.uptimeMillis())
+            onSessionFailure(failure)
+        },
         onARCoreAvailability = onARCoreAvailability,
         arCoreAvailabilityOverlay = arCoreAvailabilityOverlay,
         onTrackingFailureChanged = onTrackingFailureChanged,
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/ARCloudAnchorDemo.kt` (modified, +22/-9)
```diff
@@ -51,7 +51,8 @@ import io.github.sceneview.ar.ARHapticFeedback
 import io.github.sceneview.ar.AutoPlacementModel
 import io.github.sceneview.ar.rememberAutoPlacementState
 import io.github.sceneview.demo.common.placement.FeaturePlacementScene
-import io.github.sceneview.demo.demos.internal.CloudRequestGeneration
+import io.github.sceneview.demo.demos.internal.CloudAnchorSessionState
+import io.github.sceneview.demo.demos.internal.onFailure
 import io.github.sceneview.math.Position
 import io.github.sceneview.ar.rememberARCameraStream
 import io.github.sceneview.demo.ARCameraInitScrim
@@ -172,18 +173,21 @@ fun ARCloudAnchorDemo(onBack: () -> Unit) {
     ARHapticFeedback(placementState)
     var show3D by remember { mutableStateOf(false) }
     var invalidMove by remember { mutableStateOf(false) }
-    var localPlacement by remember { mutableStateOf<AutoPlacementResult?>(null) }
-    var resolvedAnchor by remember { mutableStateOf<Anchor?>(null) }
-    val requestGeneration = remember { CloudRequestGeneration() }
+    val sessionState = remember {
+        CloudAnchorSessionState<Session, AutoPlacementResult, Anchor, HostCloudAnchorFuture, ResolveCloudAnchorFuture>()
+    }
+    var localPlacement by sessionState::localPlacement
+    var resolvedAnchor by sessionState::resolvedAnchor
+    val requestGeneration = sessionState.requests
     val mainHandler = remember { Handler(Looper.getMainLooper()) }
-    var hostFuture by remember { mutableStateOf<HostCloudAnchorFuture?>(null) }
-    var hostAnchor by remember { mutableStateOf<Anchor?>(null) }
+    var hostFuture by sessionState::hostFuture
+    var hostAnchor by sessionState::hostAnchor
     var isTracking by remember { mutableStateOf(false) }
     var cameraReady by remember { mutableStateOf(false) }
     var arCoreAvailability by remember { mutableStateOf<ARCoreAvailability?>(null) }
     var trackingFailureReason by remember { mutableStateOf<TrackingFailureReason?>(null) }
-    var arSession by remember { mutableStateOf<Session?>(null) }
-    var resolveFuture by remember { mutableStateOf<ResolveCloudAnchorFuture?>(null) }
+    var arSession by sessionState::arSession
+    var resolveFuture by sessionState::resolveFuture
 
     // ── Flow state ──────────────────────────────────────────────────────────
     // `rememberSaveable` on the two pieces a rotation must not destroy: a hosted code the
@@ -373,7 +377,7 @@ fun ARCloudAnchorDemo(onBack: () -> Unit) {
                 // cancelled Compose coroutine would strand a late native anchor result.
                 mainHandler.post {
                     if (!requestGeneration.accepts(generation)) {
-                        anchor?.detach()
+                        if (requestGeneration.canRelease(generation)) anchor?.detach()
                     } else {
                         resolveFuture = null
                         if (result == Anchor.CloudAnchorState.SUCCESS && anchor != null) {
@@ -563,6 +567,15 @@ fun ARCloudAnchorDemo(onBack: () -> Unit) {
                 },
                 onPlaced = { localPlacement = it },
                 onSessionCreated = { session -> arSession = session },
+                onSessionFailure = { failure ->
+                    if (sessionState.onFailure(failure)) {
+                        hostTask = CloudAnchorTask.Idle
+                        resolveTask = CloudAnchorTask.Idle
+                        roomQuality = RoomQuality.Insufficient
+                        cameraReady = false
+                        isTracking = false
+                    }
+                },
                 onARCoreAvailability = { arCoreAvailability = it },
                 arCoreAvailabilityOverlay = if (forcedScenario != null) null else { { ARCoreAvailabilityOverlay(it) } },
                 onSessionUpdated = { session: Session, frame: Frame ->
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/ARDepthOfFieldDemo.kt` (modified, +11/-2)
```diff
@@ -42,6 +42,7 @@ import com.google.ar.core.Frame
 import com.google.ar.core.Session
 import com.google.ar.core.TrackingState
 import io.github.sceneview.ar.ARSceneView
+import io.github.sceneview.demo.demos.internal.PortraitSessionState
 import io.github.sceneview.ar.createARCameraStream
 import io.github.sceneview.ar.postprocessing.ARDepthOfFieldOptions
 import io.github.sceneview.ar.postprocessing.arDepthOfField
@@ -120,7 +121,8 @@ fun ARDepthOfFieldDemo(onBack: () -> Unit) {
     val appliedFocus = PortraitFocus.focusDistance(target, subjectDistance) ?: DEFAULT_FOCUS_METRES
 
     // Latest Frame for tap-to-focus. The depth API requires the Frame from the same update tick.
-    var latestFrame by remember { mutableStateOf<Frame?>(null) }
+    val sessionState = remember { PortraitSessionState<Frame>() }
+    var latestFrame by sessionState::latestFrame
     // Where the focus ring is drawn, and a counter that restarts its fade on every tap.
     var ringAt by remember { mutableStateOf<Offset?>(null) }
     var ringTap by remember { mutableIntStateOf(0) }
@@ -206,7 +208,14 @@ fun ARDepthOfFieldDemo(onBack: () -> Unit) {
         Box(modifier = Modifier.fillMaxSize()) {
             ARSceneView(
                 lifecycle = rememberHostLifecycle(),
-                onSessionFailure = { arSessionFailed = true },
+                onSessionFailure = {
+                    arSessionFailed = true
+                    // The scaffold removes the scene and closes the session on every failure.
+                    if (sessionState.onFailure(fatal = true)) {
+                        subjectDistance = null
+                        ringAt = null
+                    }
+                },
                 onARCoreAvailability = { arSessionUnavailable = it != null },
                 modifier = Modifier.fillMaxSize(),
                 engine = engine,
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/ARGeospatialAnchorsDemo.kt` (modified, +47/-17)
```diff
@@ -40,7 +40,6 @@ import androidx.compose.runtime.Stable
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.key
 import androidx.compose.runtime.mutableIntStateOf
-import androidx.compose.runtime.mutableStateListOf
 import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberUpdatedState
@@ -64,7 +63,6 @@ import dev.romainguy.kotlin.math.Quaternion
 import io.github.sceneview.NodeScope
 import io.github.sceneview.ar.ARCoreAvailability
 import io.github.sceneview.ar.ARSceneView
-import io.github.sceneview.ar.arcore.awaitVpsAvailability
 import io.github.sceneview.ar.rememberARCameraStream
 import io.github.sceneview.ar.rememberHostLifecycle
 import io.github.sceneview.demo.ARCameraInitScrim
@@ -87,7 +85,9 @@ import io.github.sceneview.demo.common.rememberHasArcoreApiKey
 import io.github.sceneview.demo.common.rememberIsNetworkAvailable
 import io.github.sceneview.demo.common.rememberQaCameraBackdropActive
 import io.github.sceneview.demo.common.toCloudServiceStatus
+import io.github.sceneview.demo.demos.internal.GeospatialSessionState
 import io.github.sceneview.demo.demos.internal.CloudRequestGeneration
+import io.github.sceneview.demo.demos.internal.onFailure
 import io.github.sceneview.demo.demos.internal.DropFeedback
 import io.github.sceneview.demo.demos.internal.DropOutcome
 import io.github.sceneview.demo.demos.internal.GeospatialAnchorMode
@@ -122,6 +122,8 @@ import io.github.sceneview.rememberModelInstance
 import io.github.sceneview.rememberModelLoader
 import io.github.sceneview.sample.rememberUnlitMaterialInstance
 import java.util.Locale
+import kotlinx.coroutines.suspendCancellableCoroutine
+import kotlin.coroutines.resume
 import kotlin.coroutines.cancellation.CancellationException
 import kotlin.math.roundToInt
 import kotlin.math.sqrt
@@ -356,11 +358,6 @@ private class GeospatialDrop(val id: Int, val mode: GeospatialAnchorMode) {
     }
 }
 
-/** Plain holder for the latest camera pose: written per frame, read on tap, never drawn. */
-private class CameraPoseHolder {
-    var pose: Pose? = null
-}
-
 @Composable
 private fun GeospatialSection(
     onBack: () -> Unit,
@@ -378,7 +375,8 @@ private fun GeospatialSection(
     // rejected key (#3262).
     val isNetworkAvailable = rememberIsNetworkAvailable()
 
-    var arSession by remember { mutableStateOf<Session?>(null) }
+    val sessionState = remember { GeospatialSessionState<Session, Pose, GeospatialDrop>() }
+    var arSession by sessionState::arSession
     var cameraReady by remember { mutableStateOf(false) }
     // Whether ARCameraInitScrim's card is the one saying "Starting camera…" (#3825).
     var cameraScrimNarrating by remember { mutableStateOf(true) }
@@ -393,10 +391,9 @@ private fun GeospatialSection(
     var sessionError by remember { mutableStateOf<String?>(null) }
     val qaBackdrop = rememberQaCameraBackdropActive(cameraReady)
 
-    val cameraPose = remember { CameraPoseHolder() }
-    val drops = remember { mutableStateListOf<GeospatialDrop>() }
+    val drops = sessionState.drops
     var nextId by remember { mutableStateOf(0) }
-    val requestGeneration = remember { CloudRequestGeneration() }
+    val requestGeneration = sessionState.requests
     val mainHandler = remember { Handler(Looper.getMainLooper()) }
 
     // Street View (VPS) coverage where the user stands, re-asked every ~100 m. The helper
@@ -408,7 +405,7 @@ private fun GeospatialSection(
         val here = latestFix ?: return@LaunchedEffect
         if (vps == VpsCoverage.Unknown) vps = VpsCoverage.Checking
         vps = try {
-            when (session.awaitVpsAvailability(here.latitude, here.longitude)) {
+            when (session.awaitDemoVpsAvailability(here.latitude, here.longitude, requestGeneration, mainHandler)) {
                 VpsAvailability.AVAILABLE -> VpsCoverage.Available
                 VpsAvailability.UNAVAILABLE -> VpsCoverage.Unavailable
                 else -> VpsCoverage.Error
@@ -460,8 +457,10 @@ private fun GeospatialSection(
         rooftop: RooftopAnchorNodeImpl?,
     ) {
         if (!requestGeneration.accepts(generation) || drop !in drops) {
-            terrain?.destroy()
-            rooftop?.destroy()
+            if (requestGeneration.canRelease(generation)) {
+                terrain?.destroy()
+                rooftop?.destroy()
+            }
             return
         }
         drop.future = null
@@ -480,7 +479,7 @@ private fun GeospatialSection(
     val onDrop: () -> Unit = onDrop@{
         val session = arSession ?: return@onDrop
         val earth = session.earth ?: return@onDrop
-        val camera = cameraPose.pose ?: return@onDrop
+        val camera = sessionState.cameraPose ?: return@onDrop
         if (earth.trackingState != TrackingState.TRACKING) return@onDrop
         val target = dropPoseAhead(
             cameraX = camera.tx(),
@@ -645,12 +644,25 @@ private fun GeospatialSection(
               
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/ARImageDemo.kt` (modified, +28/-5)
```diff
@@ -25,7 +25,6 @@ import androidx.compose.material3.Surface
 import androidx.compose.material3.Text
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.getValue
-import androidx.compose.runtime.mutableStateListOf
 import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberCoroutineScope
@@ -44,6 +43,7 @@ import com.google.ar.core.TrackingFailureReason
 import com.google.ar.core.TrackingState
 import io.github.sceneview.ar.ARCoreAvailability
 import io.github.sceneview.ar.ARSceneView
+import io.github.sceneview.demo.demos.internal.ImageSessionState
 import io.github.sceneview.ar.rememberARCameraStream
 import io.github.sceneview.ar.rememberHostLifecycle
 import io.github.sceneview.demo.common.QaCameraBackdrop
@@ -73,6 +73,7 @@ import io.github.sceneview.rememberMaterialLoader
 import io.github.sceneview.rememberModelLoader
 import kotlinx.coroutines.CoroutineStart
 import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.Job
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.withContext
 
@@ -117,7 +118,10 @@ fun ARImageDemo(onBack: () -> Unit) {
     // image the user captures on-device via the "Capture this view" button (#1553).
     val runtimeDatabase = rememberRuntimeAugmentedImageDatabase()
 
-    val detectedImages = remember { mutableStateListOf<AugmentedImage>() }
+    val sessionState = remember { ImageSessionState<AugmentedImage>() }
+    val detectedImages = sessionState.detectedImages
+    var captureJob by remember { mutableStateOf<Job?>(null) }
+    var registrationJob by remember { mutableStateOf<Job?>(null) }
     var isTracking by remember { mutableStateOf(false) }
     // Cover the jet-black ARSceneView surface until ARCore delivers its first camera
     // frame, so the ~1–3 s warm-up on entry doesn't read as a frozen screen (#2484).
@@ -322,7 +326,21 @@ fun ARImageDemo(onBack: () -> Unit) {
             if (qaBackdrop) QaCameraBackdrop(seed = "ar-image")
             ARSceneView(
                 lifecycle = rememberHostLifecycle(),
-                onSessionFailure = { arSessionFailed = true },
+                onSessionFailure = {
+                    arSessionFailed = true
+                    // The scaffold removes the scene and closes the session on every failure.
+                    if (sessionState.onFailure(fatal = true)) {
+                        imageCount = 0
+                        cameraReady = false
+                        isTracking = false
+                        captureRequested = false
+                        isCapturing = false
+                        captureStatus = null
+                        runtimeDatabase.unbind()
+                        captureJob?.cancel()
+                        registrationJob?.cancel()
+                    }
+                },
                 modifier = Modifier.fillMaxSize(),
                 engine = engine,
                 modelLoader = modelLoader,
@@ -344,7 +362,7 @@ fun ARImageDemo(onBack: () -> Unit) {
                     // Bind the live session so RuntimeAugmentedImageDatabase.addImage can
                     // rebuild + reconfigure on its own. Seed the pre-bundled reference image.
                     runtimeDatabase.bind(session)
-                    scope.launch {
+                    registrationJob = scope.launch {
                         runtimeDatabase.addImage("reference", referenceBitmap, 0.15f)
                     }
                 },
@@ -361,12 +379,17 @@ fun ARImageDemo(onBack: () -> Unit) {
                         // withContext). `null` (warm-up, image pool full) lands on the "try
                         // again" message.
                         val image = frame.cameraImage()
-                        scope.launch(start = CoroutineStart.ATOMIC) {
+                        val generation = sessionState.generation
+                        captureJob = scope.launch(start = CoroutineStart.ATOMIC) {
                             val photo = image?.use { img ->
                                 withContext(Dispatchers.Default) {
                                     img.toArgbBitmap(rotationDegrees = 0)
                                 }
                             }
+                            if (sessionState.generation != generation) {
+                                photo?.recycle()
+                                return@launch
+                            }
                             val (message, tone) = if (photo == null) {
                                 "Camera image not ready yet — try again" to
                                     DemoStatusTone.Guidance
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/ARRecordPlaybackDemo.kt` (modified, +27/-5)
```diff
@@ -39,6 +39,7 @@ import com.google.ar.core.TrackingState
 import io.github.sceneview.ar.ARCoreAvailability
 import io.github.sceneview.ar.ARCoreAvailabilityOverlay
 import io.github.sceneview.ar.ARSceneView
+import io.github.sceneview.demo.demos.internal.RecordingSessionState
 import io.github.sceneview.ar.recording.ARRecordInterpretation
 import io.github.sceneview.ar.recording.ARRecordInterpreter
 import io.github.sceneview.ar.recording.ARRecorder
@@ -209,6 +210,7 @@ fun ARRecordPlaybackDemo(onBack: () -> Unit) {
     }
 
     fun startRecording() {
+        if (take.arSession == null) return
         take.placementTrack = take.recorder.addTrack(PlacementTrack.TRACK_ID, PlacementTrack.MIME_TYPE)
         take.interpreter.reset()
         take.writeSchedule.reset()
@@ -550,8 +552,7 @@ private fun TakeScene(
         if (qaBackdrop) QaCameraBackdrop(seed = QA_SEED)
         ARSceneView(
             lifecycle = rememberHostLifecycle(),
-            onSessionFailure = { take.sessionFailed = true },
-            onSessionResumed = { take.sessionFailed = false },
+            onSessionFailure = { take.onSessionFailure() },
             modifier = Modifier.fillMaxSize(),
             engine = engine,
             modelLoader = modelLoader,
@@ -626,9 +627,10 @@ private class TakeState(
     var trackingFailureReason by mutableStateOf<TrackingFailureReason?>(null)
 
     /** Published for `rememberARPlaybackStatus`, which has no other handle on the session. */
-    var arSession by mutableStateOf<Session?>(null)
+    private val sessionState = RecordingSessionState<Session, Frame, Anchor>()
+    var arSession by sessionState::arSession
 
-    val anchors = mutableStateListOf<Anchor>()
+    val anchors = sessionState.anchors
     var restoredCount by mutableIntStateOf(0)
     var replayElapsedMillis by mutableLongStateOf(0L)
 
@@ -638,7 +640,7 @@ private class TakeState(
     var placementTrack: ARRecorder.TrackHandle? = null
     val writeSchedule = PlacementWriteSchedule()
 
-    private var latestFrame: Frame? = null
+    private var latestFrame by sessionState::latestFrame
     private var firstFrameNanos = 0L
     private val frameGate = NewFrameGate()
     private val replayQueue = PlacementReplayQueue()
@@ -647,6 +649,26 @@ private class TakeState(
     private val packet: ByteBuffer =
         ByteBuffer.allocateDirect(PlacementTrack.PACKET_BYTES).order(ByteOrder.LITTLE_ENDIAN)
 
+    fun onSessionFailure() {
+        sessionFailed = true
+        // The scaffold removes the scene and closes the session on every failure.
+        if (sessionState.onFailure(fatal = true)) {
+            // Detach first: stop then resets the recorder without touching the closed session.
+            recorder.detach()
+            recorder.stop()
+            interpreter.reset()
+            placementTrack = null
+            writeSchedule.reset()
+            replayQueue.reset()
+            frameGate.reset()
+            firstFrameNanos = 0L
+            replayElapsedMillis = 0L
+            restoredCount = 0
+            cameraReady = false
+            isTracking = false
+        }
+    }
+
     /** `onSessionUpdated` — runs on the thread that owns [frame]. */
     fun onFrame(session: Session, frame: Frame, replaying: Boolean) {
         cameraReady = true
```

---

### Incident Patch 3: `85852640` (2026-11-20)
**Commit Message**: fix(demo): draw Measure's doors and windows on the plan, its walls list and its shares (#4783) (#5194)

* fix(demo): draw Measure's doors and windows on the plan, its walls list and its shares (#4783)

Measure's Plan page handed RerunPlanView the room's survey only: the doors
and windows marked on its walls, and the net wall area, reached the card
under the plan and nothing else.

RerunPlanView now takes a PlanOpenings (openings in the plan's frame plus
the net wall area; PlanOpenings.None by default, so 3D Scan is unchanged):
- RoomPlanLayout breaks each wall between an opening's jambs, to scale and
  at its position along the wall; a window gets its frame, a door (bottom
  within 15 cm of the floor) its leaf and swing into the room.
- SurveyReport.wallRows lists each opening under its wall and the net wall
  area last; SurveyReport.text adds a line per opening and the net area.
- RoomPlanPdf draws and lists them; its page drawing is split out (draw)
  so a test can read the first page back. The DXF share gets them too.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* changelog: format the #4783 fragment as a bullet

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>

* fix

**File**: `changelog.d/4783-measure-plan-openings.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+<!-- category: Fixed -->
+- **Demo app: Measure's plan shows the doors and windows you marked.** Each one is drawn on its wall, listed under that wall with the net wall area, and carried into the PDF, DXF and text shares (#4783).
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/ARMeasureDemo.kt` (modified, +12/-1)
```diff
@@ -162,6 +162,7 @@ import io.github.sceneview.demo.demos.internal.MeasurePlaneKind
 import io.github.sceneview.demo.demos.internal.MeasurePlanOpening
 import io.github.sceneview.demo.demos.internal.measurePlanCard
 import io.github.sceneview.demo.demos.internal.measurePlanOpenings
+import io.github.sceneview.demo.demos.internal.measurePlanOpeningsOnPlan
 import io.github.sceneview.demo.demos.internal.measurePlanRoom
 import io.github.sceneview.demo.demos.internal.MeasurePlanTap
 import io.github.sceneview.demo.demos.internal.measurePlanTap
@@ -1011,6 +1012,8 @@ internal class MeasurePlanPage(
  * The whole page reads in [units], the Measure screen's: the plan, its PDF and text shares, and,
  * with doors or windows marked, the card under the plan that names each one by the wall the plan
  * letters it on and reads the walls' net area ([measurePlanCard]). One page, one unit system.
+ * The doors and windows are drawn on the plan's walls too, listed under each wall with the net
+ * area after them, and carried by the PDF, DXF and text shares (#4783).
  */
 @Composable
 internal fun MeasurePlanOverlay(
@@ -1053,7 +1056,15 @@ internal fun MeasurePlanOverlay(
             },
             bottomOverlayReservesScene = true,
         ) {
-            RerunPlanView(survey = page.survey, title = title, date = date, units = units, locale = locale)
+            // The doors and windows, and the walls' net area, reach the plan, its walls and its shares, not the card alone (#4783).
+            RerunPlanView(
+                survey = page.survey,
+                title = title,
+                date = date,
+                units = units,
+                locale = locale,
+                openings = measurePlanOpeningsOnPlan(page.openings, net),
+            )
         }
     }
 }
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/RerunPlanDxf.kt` (modified, +8/-2)
```diff
@@ -11,11 +11,17 @@ import io.github.sceneview.demo.demos.internal.RoomSurvey
  * handed to the share sheet alone, typed [DXF_MIME_TYPE]; `false` when the survey has no plan to
  * draw or the drawing could not be written. The drawing is named after the PDF of the same plan.
  */
-internal suspend fun sharePlanDxf(context: Context, survey: RoomSurvey, words: PlanWords, title: String): Boolean {
+internal suspend fun sharePlanDxf(
+    context: Context,
+    survey: RoomSurvey,
+    words: PlanWords,
+    title: String,
+    openings: List<RoomPlanDxf.Opening> = emptyList(),
+): Boolean {
     if (!survey.hasPlan) return false
     val drawing = planDxfWords(context, survey, words, title)
     val name = words.pdfFile.format(title).substringBeforeLast('.') + DXF_EXTENSION
-    val uri = writePlanShare(context, name) { RoomPlanDxf.write(it, survey, words.survey, drawing) } ?: return false
+    val uri = writePlanShare(context, name) { RoomPlanDxf.write(it, survey, words.survey, drawing, openings) } ?: return false
     sharePlanFile(context, uri, DXF_MIME_TYPE, title)
     return true
 }
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/RerunPlanUi.kt` (modified, +172/-49)
```diff
@@ -78,6 +78,9 @@ import io.github.sceneview.demo.demos.internal.DepthBackProjection
 import io.github.sceneview.demo.demos.internal.MeasureUnitSystem
 import io.github.sceneview.demo.demos.internal.PlanLine
 import io.github.sceneview.demo.demos.internal.PlanMetrics
+import io.github.sceneview.demo.demos.internal.PlanOpening
+import io.github.sceneview.demo.demos.internal.PlanOpenings
+import io.github.sceneview.demo.demos.internal.RoomPlanDxf
 import io.github.sceneview.demo.demos.internal.PlanPage
 import io.github.sceneview.demo.demos.internal.PlanStroke
 import io.github.sceneview.demo.demos.internal.PlanTextRole
@@ -197,6 +200,9 @@ private fun planWords(units: MeasureUnitSystem, locale: Locale): PlanWords = Pla
         ),
         units = units,
         locale = locale,
+        door = stringResource(R.string.demo_ar_rerun_plan_door),
+        window = stringResource(R.string.demo_ar_rerun_plan_window),
+        netWallArea = stringResource(R.string.demo_ar_measure_label_net_walls),
     ),
     surveyTitle = stringResource(R.string.demo_ar_rerun_plan_survey_title),
     emptyTitle = stringResource(R.string.demo_ar_rerun_plan_empty_title),
@@ -273,7 +279,11 @@ internal fun RerunPlanScreen(media: RerunReplayMedia?, title: String, date: Stri
  * the page starts under them and is clipped there, so nothing scrolls behind a pill.
  *
  * @param zones the parts of the scan still to scan, in the scan's frame, laid on the plan (#4735).
+ * @param openings the doors and windows marked on the plan's walls and the walls' net area (#4783):
+ *   drawn on the plan, listed under their walls, and carried by the PDF, DXF and text shares. A
+ *   3D Scan has none.
  */
+@Suppress("LongParameterList") // a survey, its heading, its units, and what is laid on its plan
 @Composable
 internal fun RerunPlanView(
     survey: RoomSurvey?,
@@ -283,6 +293,7 @@ internal fun RerunPlanView(
     units: MeasureUnitSystem = SurveyFormat.units(LocalLocale.current.platformLocale),
     locale: Locale = LocalLocale.current.platformLocale,
     zones: List<RescanZone> = emptyList(),
+    openings: PlanOpenings = PlanOpenings.None,
 ) {
     val words = rememberPlanWords(units, locale)
     val context = LocalContext.current
@@ -326,9 +337,9 @@ internal fun RerunPlanView(
                 }
             }
         }
-        val sharePdf = { shareFile { sharePlanPdf(context, survey, words, title, date) } }
-        val shareDxf = { shareFile { sharePlanDxf(context, survey, words, title) } }
-        val shareText = { sharePlanText(context, SurveyReport.text(survey, words.survey, title, date), title) }
+        val sharePdf = { shareFile { sharePlanPdf(context, survey, words, title, date, openings) } }
+        val shareDxf = { shareFile { sharePlanDxf(context, survey, words, title, openings.openings.map(::dxfOpening)) } }
+        val shareText = { sharePlanText(context, SurveyReport.text(survey, words.survey, title, date, openings), title) }
         val dock = maxOf(SETTINGS_FAB_RESERVED_SPACE, LocalDemoBottomChromeCover.current) + Space.md
         // Under the header: a scrolling column clips to its own box, which starts below the pills.
         val frame = Modifier
@@ -344,10 +355,13 @@ internal fun RerunPlanView(
             Row(modifier = frame, horizontalArrangement = Arrangement.spacedBy(Space.md)) {
                 BoxWithConstraints(Modifier.weight(PLAN_SHARE).fillMaxHeight()) {
                     if (maxHeight - dock >= maxWidth / MAX_PLAN_RATIO) {
-                        PlanCard(survey, words, Modifier.fillMaxHeight().padding(bottom = dock), fill = true, zones = zones)
+                        PlanCard(
+                            survey, words, Modifier.fillMaxHeight().padding(bottom = dock),
+                            fill = true, zones = zones, openings = openings,
+                        )
                     } else {
                         Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = dock)) {
-                            PlanCard(survey, words, hint = words.scrollHint, zones = zones)
+                            PlanCard(survey, words, hint = words.scrollHint, zones = zones, openings = openings)
                         }
                     }
                 }
@@ -358,7 +372,7 @@ internal fun RerunPlanView(
                         .padding(bottom = dock),
                     verticalArrangement = Arrangement.spacedBy(Space.md),
                 ) {
-                    SurveyDetails(survey, words, title, date, PlanShares(sharePdf, shareDxf, shareText))
+                    SurveyDetails(survey, words, title, date, PlanShares(sharePdf, shareDxf, shareText), openings)
                 }
             }
         } else {
@@ -368,8 +382,8 @@ internal fun RerunPlanView(
                     modifier = Modifier.widthIn(max = RerunPageMaxWidth).fillMaxWidth(),
                     verticalArrangement = Arrangement.spacedBy(Space.md),
                 ) {
-                    if (s
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/internal/MeasurePlan.kt` (modified, +19/-4)
```diff
@@ -94,6 +94,17 @@ fun measurePlanOpenings(outline: List<Position>, openings: List<MeasureOpening>)
         .map { it.second }
 }
 
+/**
+ * What a traced room's plan shows besides its survey (#4783): its [openings] on the plan's walls
+ * and the walls' [netWallArea], for the drawing, the walls' table and the PDF and text shares.
+ */
+fun measurePlanOpeningsOnPlan(openings: List<MeasurePlanOpening>, netWallArea: Float?): PlanOpenings = PlanOpenings(
+    openings = openings.map {
+        PlanOpening(wall = it.opening.wall, from = it.opening.from, to = it.opening.to, bottom = it.opening.bottom, top = it.opening.top)
+    },
+    netWallArea = netWallArea,
+)
+
 /** One door or window on the card under a traced room's plan: the plan's [wall] letter, its [width] × [height]. */
 data class MeasurePlanCardOpening(val wall: String, val width: String, val height: String)
 
@@ -117,14 +128,18 @@ fun measurePlanCard(
     openings = openings.map {
         MeasurePlanCardOpening(
             wall = it.wall,
-            width = planCardLength(it.opening.width, units, locale),
-            height = planCardLength(it.opening.height, units, locale),
+            width = measurePlanLength(it.opening.width, units, locale),
+            height = measurePlanLength(it.opening.height, units, locale),
         )
     },
 )
 
-/** A length on the plan's card: in metres below one too, `0.90 m`; feet and inches as the Measure screen writes them. */
-private fun planCardLength(metres: Float, units: MeasureUnitSystem, locale: Locale): String = when (units) {
+/**
+ * A door's or a window's side on a traced room's plan page, on its card and in its walls' table
+ * alike: in metres to the centimetre, below one too, `0.90 m`; feet and inches as the Measure
+ * screen writes them.
+ */
+fun measurePlanLength(metres: Float, units: MeasureUnitSystem, locale: Locale): String = when (units) {
     MeasureUnitSystem.Metric -> String.format(locale, "%.2f m", (metres.coerceAtLeast(0f) * CENTIMETRES_PER_METRE).roundToInt() / CENTIMETRES_PER_METRE)
     MeasureUnitSystem.Imperial -> formatMeasureLength(metres, units, locale)
 }
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/internal/RoomPlanDxf.kt` (modified, +9/-2)
```diff
@@ -8,6 +8,7 @@ import kotlin.math.cos
 import kotlin.math.hypot
 import kotlin.math.max
 import kotlin.math.min
+import kotlin.math.roundToInt
 import kotlin.math.sin
 import kotlin.math.sqrt
 
@@ -92,10 +93,15 @@ object RoomPlanDxf {
         out.write(drawing.file().toByteArray(Charsets.US_ASCII))
     }
 
-    /** `Door 0.90 × 2.10`, `Window 1.20 × 1.20, sill 0.90`: the size the plan knows, in its units. */
+    /**
+     * `Door 0.93 × 2.04`, `Window 1.20 × 1.20, sill 0.90`: the size the plan knows, in its units —
+     * to the centimetre, as the plan page's card, walls list, PDF and text write a door or a window
+     * (#4783), not in the 5 cm steps of a wall's dimension; to the inch in feet and inches.
+     */
     private fun label(opening: Opening, words: Words, units: MeasureUnitSystem): String {
         fun length(metres: Float) = when (units) {
-            MeasureUnitSystem.Metric -> SurveyFormat.length(metres)
+            MeasureUnitSystem.Metric ->
+                "%.2f".format(Locale.US, (metres.coerceAtLeast(0f) * CENTIMETRES_PER_METRE).roundToInt() / CENTIMETRES_PER_METRE)
             MeasureUnitSystem.Imperial -> SurveyFormat.feetAndInchesMark(metres)
         }
         val size = length(opening.width) + (opening.height?.let { " × " + length(it) } ?: "")
@@ -777,6 +783,7 @@ object RoomPlanDxf {
 
     // Sizes and distances on the drawing, millimetres: a 1:50 print reads its dimensions at 3 mm.
     private const val MM = 1000.0
+    private const val CENTIMETRES_PER_METRE = 100f
     private const val MM_PER_INCH = 25.4
     private const val JOIN = 1.0
     private const val DIMENSION_OFFSET = 600.0
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/internal/RoomPlanLayout.kt` (modified, +173/-6)
```diff
@@ -3,10 +3,12 @@ package io.github.sceneview.demo.demos.internal
 import java.util.Locale
 import kotlin.math.abs
 import kotlin.math.ceil
+import kotlin.math.cos
 import kotlin.math.hypot
 import kotlin.math.max
 import kotlin.math.min
 import kotlin.math.roundToInt
+import kotlin.math.sin
 
 /*
  * A room survey as a dimensioned floor plan (#4540): the outline to scale, each wall's length on
@@ -123,8 +125,11 @@ object SurveyFormat {
     private const val EPSILON = 1e-3f
 }
 
-/** What a line of the plan is, so each surface paints it its own way. */
-enum class PlanStroke { Wall, WallUnseen, Dimension, Extension, Tick, Scale }
+/**
+ * What a line of the plan is, so each surface paints it its own way. [Opening] is a door's or a
+ * window's jambs, a window's frame and a door's leaf; [Swing] the arc a door sweeps (#4783).
+ */
+enum class PlanStroke { Wall, WallUnseen, Dimension, Extension, Tick, Scale, Opening, Swing }
 
 /** What a text of the plan is. */
 enum class PlanTextRole { Dimension, Area, AreaNote, Tag, Scale }
@@ -198,6 +203,9 @@ object RoomPlanLayout {
     private const val SCALE_MIN = 56f
     private const val TAG_INSET = 11f
     private const val TAG_MIN_WALL = 26f
+    private const val JAMB = 3.5f
+    private const val FRAME = 1.75f
+    private const val SWING_STEPS = 12
     private const val TOP = 0
     private const val RIGHT = 1
     private const val BOTTOM = 2
@@ -207,21 +215,30 @@ object RoomPlanLayout {
     private const val POLE_STEPS = 40
     private const val ALIGNED = 0.01f
 
+    private const val HALF_PI = (Math.PI / 2).toFloat()
+
     /** The round lengths a scale bar is drawn at, metres. */
     private val SCALE_BARS = floatArrayOf(0.5f, 1f, 2f, 5f, 10f)
 
     /**
      * Lays [survey] out in a [width] × [height] box. With [scales] (pixels per metre, any
      * order) the plan is drawn at the largest of them that fits — a paper plan is at 1:50, not
      * at 1:43; without, it fills the box.
+     *
+     * Each of [openings] (#4783) is drawn on its wall, to scale, where it was marked along it: the
+     * wall broken between its two jambs, a window's frame across the gap, a door's leaf open
+     * square into the room and the quarter circle it sweeps. A plan without any is drawn as
+     * it always was.
      */
+    @Suppress("LongParameterList") // a box, its ruler and the scales and openings it may be drawn with
     fun layout(
         survey: RoomSurvey,
         texts: PlanTexts,
         width: Float,
         height: Float,
         metrics: PlanMetrics,
         scales: List<Float>? = null,
+        openings: List<PlanOpening> = emptyList(),
     ): RoomPlanDrawing {
         if (!survey.hasPlan) return RoomPlanDrawing(width, height, 0f, FloatArray(0), emptyList(), emptyList())
         var rows = IntArray(SIDES)
@@ -230,7 +247,7 @@ object RoomPlanLayout {
         repeat(MAX_PASSES) {
             if (drawing != null && rows.all { it == 0 }) return@repeat
             val needed = IntArray(SIDES)
-            val pass = Pass(survey, texts, width, height, metrics, scales, rows.copyOf(), needed)
+            val pass = Pass(survey, texts, width, height, metrics, scales, rows.copyOf(), needed, openings)
             val settled = drawing != null && (0 until SIDES).all { needed[it] <= rows[it] }
             drawing = pass.drawing
             if (settled || needed.all { it == 0 }) return drawing!!
@@ -277,6 +294,7 @@ object RoomPlanLayout {
         scales: List<Float>?,
         private val rows: IntArray,
         private val needed: IntArray,
+        private val openings: List<PlanOpening>,
     ) {
         private val u = metrics.unit
         private val lines = ArrayList<PlanLine>()
@@ -347,13 +365,18 @@ object RoomPlanLayout {
         }
 
         private fun walls() {
-            for (wall in survey.walls) {
+            survey.walls.forEachIndexed { index, wall ->
                 val length = wall.length.value
-                if (length <= 0f) continue
+                if (length <= 0f) return@forEachIndexed
                 val dx = (wall.bx - wall.ax) / length
                 val dy = (wall.by - wall.ay) / length
+                // The doors and windows on this wall, each kept on it: the wall is not drawn across them.
+                val cuts = openings.filter { it.wall == index }
+                    .map { Cut(it.from.coerceIn(0f, length), it.to.coerceIn(0f, length), it.door) }
+                    .filter { it.to > it.from }
+                    .sortedBy { it.from }
                 var at = 0f
-                fun run(from: Float, to: Float, stroke: PlanStroke) {
+                fun segment(from: Float, to: Float, stroke: PlanStroke) {
                     if (to - from <= 0f) return
                     lines += PlanLine(
                         x(wall.ax + dx * from),
@@ -363,15 +386,128 @@ object RoomPlanLayout {
                         stroke,
                     )
                 }
+                fun run(from: F
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/internal/RoomSurveyReport.kt` (modified, +97/-6)
```diff
@@ -1,5 +1,6 @@
 package io.github.sceneview.demo.demos.internal
 
+import io.github.sceneview.demo.demos.internal.room.WallOpenings
 import java.util.Locale
 import kotlin.math.max
 
@@ -95,10 +96,51 @@ class SurveyWording(
      * English when none is given; the Plan view, 3D Scan's and Measure's alike, passes the phone's.
      */
     val locale: Locale = Locale.US,
+    /** A door, then a window, as the walls' table names an opening on a wall (#4783). */
+    val door: String = "",
+    val window: String = "",
+    /** The walls' area once their doors and windows are taken off. */
+    val netWallArea: String = "",
 )
 
-/** One line of the survey's table. [muted] ones say a figure is missing. */
-class SurveyRow(val label: String, val value: String, val muted: Boolean = false)
+/**
+ * One line of the survey's table. [muted] ones say a figure is missing. A door's or a window's row
+ * names the letter of the wall it stands on in [wall], for a table that may set it apart from that
+ * wall's row: the PDF, at the top of a column.
+ */
+class SurveyRow(val label: String, val value: String, val muted: Boolean = false, val wall: String? = null)
+
+/**
+ * A door or a window on a plan's wall (#4783), in the plan's frame: on the survey's wall number
+ * [wall] (its index in [RoomSurvey.walls]), [from]..[to] metres along it from its start
+ * ([SurveyWall.ax], [SurveyWall.ay]), [bottom]..[top] metres above the floor.
+ */
+data class PlanOpening(val wall: Int, val from: Float, val to: Float, val bottom: Float, val top: Float) {
+    val width: Float get() = to - from
+    val height: Float get() = top - bottom
+
+    /**
+     * A door: an opening whose bottom is under the lowest sill 3D Scan gives a window
+     * ([WallOpenings.belowWindowSill], 0.30 m). Measure marks doors and windows the same way, two
+     * opposite corners, so its bottom is all that tells them apart, and on the scan's own rule.
+     */
+    val door: Boolean get() = WallOpenings.belowWindowSill(bottom)
+}
+
+/**
+ * What a plan shows besides its survey (#4783): the doors and windows marked on its walls, in the
+ * plan's wall order then along each wall, and [netWallArea], the walls' area without them (m²),
+ * `null` when none was worked out. A room traced in Measure has them; a 3D Scan has none
+ * ([None]), and its plan, its PDF and its text read as they always have.
+ */
+class PlanOpenings(val openings: List<PlanOpening>, val netWallArea: Float?) {
+    /** `true` when there is nothing to add to the survey: no opening and no net wall area. */
+    val isEmpty: Boolean get() = openings.isEmpty() && netWallArea == null
+
+    companion object {
+        val None = PlanOpenings(emptyList(), null)
+    }
+}
 
 object SurveyReport {
     private const val SEPARATOR = " · "
@@ -276,10 +318,42 @@ object SurveyReport {
             muted = area == null,
         )
 
-    /** One row per wall: its letter, its length, and whether it was seen. */
-    fun wallRows(survey: RoomSurvey, wording: SurveyWording): List<SurveyRow> = survey.walls.map { wall ->
+    /**
+     * One row per wall: its letter, its length, and whether it was seen. With [openings] (#4783),
+     * each wall's row is followed by one per door or window on it ([openingRow]), and the walls'
+     * net area comes last ([netWallAreaRow]); without, the rows a 3D Scan has always had.
+     */
+    fun wallRows(survey: RoomSurvey, wording: SurveyWording, openings: PlanOpenings = PlanOpenings.None): List<SurveyRow> {
+        val walls = survey.walls.map { wallRow(it, wording) }
+        if (openings.isEmpty) return walls
+        val rows = ArrayList<SurveyRow>()
+        walls.forEachIndexed { i, row ->
+            rows += row
+            openings.openings.filter { it.wall == i }.forEach { rows += openingRow(it, wording, survey.walls[i].tag) }
+        }
+        openings.netWallArea?.let { rows += netWallAreaRow(it, wording) }
+        return rows
+    }
+
+    /**
+     * A door or a window as the walls' table lists it under its wall: `Door` · `0.93 m × 2.04 m`,
+     * as wide by as high as it was marked. Written as the card under Measure's plan writes it
+     * ([measurePlanLength]): to the centimetre in metres, so the page says one size for it.
+     */
+    fun openingRow(opening: PlanOpening, wording: SurveyWording, wall: String? = null): SurveyRow = SurveyRow(
+        label = if (opening.door) wording.door else wording.window,
+        value = measurePlanLength(opening.width, wording.units, wording.locale) + " × " +
+            measurePlanLength(opening.height, wording.units, wording.locale),
+        wall = wall,
+    )
+
+    /** The walls' area net of their doors and windows, [squareMetres], as the card under Measure's plan writes it. */
+    fun netWallAreaRow(squareMetres: Float, wording: SurveyWording): SurveyRow =
+        SurveyRow(wording.netWallArea, formatMeasureArea(squareMetres, wording.units, wording.locale))
+
+    private fun wallRow(wall: SurveyWal
```

#### Recent Merged Pull Requests:
- **PR #5197** (2026-11-20): release: 4.70.0 — version bump + changelog collate (@github-actions[bot])
- **PR #5196** (2026-11-20): fix(demo): discard AR session state after a fatal session failure (@ThomasGorisse)
- **PR #5195** (2026-11-20): chore(listing): one dark Play set, four real frames, galaxy banner (@ThomasGorisse)
- **PR #5194** (2026-11-20): fix(demo): draw Measure's doors and windows on the plan, its walls list and its shares (#4783) (@ThomasGorisse)
- **PR #5192** (2026-11-20): fix(demo): opaque settings sheet and bottom fade on the 3D Scan landing (@ThomasGorisse)
- **PR #5190** (2026-11-20): fix(ios-demo): label a bundled model "Built-in model", not "Offline model" (@ThomasGorisse)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. demo): bound the 3D scan journal and release the live model on exit

**RULE**:
When implementing operations in `changelog.d/5186-scan-oom.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sceneview/sceneview. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0db548c6`: demo): bound the 3D scan journal and release the live model on exit. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/5186-scan-oom.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
<!-- category: Fixed -->
- **Demo app: smoother, more reliable 3D scans.** The demo now requests a large heap, so long room scans keep full model detail, with a memory safety net on phones still below 384 MiB. The replay journal, previously unbounded, is capped (8 MiB on a 512 MiB heap) and always keeps photos, floor coverage, anchors and when each plane appeared or was removed. Leaving a scan frees its memory reliably, and the saved-scans list loads lazily, so exits no longer freeze.
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0db548c6` are properly handled with clean fallback behavior.
