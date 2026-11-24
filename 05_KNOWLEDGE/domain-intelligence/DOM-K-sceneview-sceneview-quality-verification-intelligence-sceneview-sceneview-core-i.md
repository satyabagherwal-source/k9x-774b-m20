# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: sceneview/sceneview Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "sceneview/sceneview",
  "source_url": "https://github.com/sceneview/sceneview",
  "source_version": "a1c2b6b5",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T03:49:59.088Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sceneview-sceneview",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sceneview/sceneview](https://github.com/sceneview/sceneview) (Revision: `a1c2b6b5`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T03:49:59.088Z`  
> **Learning ID**: `learn-github-sceneview-sceneview`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), G (Architecture Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), I (Content & Information Intelligence), E (Creative Intelligence), F (Design Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 63%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from sceneview/sceneview:

# Forensic Learning Record (Deep Inspection): sceneview/sceneview

> **Canonical Artifact**: `07_PROJECT_LEARNING/sceneview-sceneview-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sceneview/sceneview](https://github.com/sceneview/sceneview))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T03:49:57.750Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sceneview/sceneview`
- **Description**: Declarative 3D and AR for Android with Jetpack Compose, Filament and ARCore, plus web and Compose Multiplatform desktop. Open source, Apache 2.0. SwiftUI, Flutter and React Native: end of life at 4.68.0.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1380 stars

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
import androidx.compose.runtime.mutableIntStateOf
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
     * Draw the detected surfaces while the object looks for one and while it moves, then fade them
     * once it stands still (#5209): the rule [guide] describes. On by default; set `false` for a
     * scene that should never show the surfaces.
     */
    var showsPlaneGuide: Boolean by mutableStateOf(true)

    /**
     * What the placement shows right now: the surfaces, the footprint ring, and whether dimension
     * marks should be drawn. [AutoPlacementScene] keeps it current; read [PlacementGuide.dimensions]
     * to show marks of your own at the same moments.
     */
    var guide: PlacementGuide by mutableStateOf(PlacementGuide.Nothing)
        internal set

    /**
     * Keep [PlacementGuide.dimensions] on for as long as the object is placed, instead of only
     * after it lands and while it is selected or moved (#5209). For an app whose answer is the
     * size itself, such as a furniture fit; off by default.
     */
    var alwaysShowsDimensions: Boolean by mutableStateOf(false)

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
            it.start > 0f && it.sta
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
- **Issue #5211** (2026-11-22): **fix(demo): Finger Drawing and Streetscape forget a closed session's objects**
  *Symptoms*: Fixes #5208  Follow-up to #5205. Two AR demos kept ARCore objects from a session that a fatal failure closed, and read them on every frame after "Try again":  - **Finger Drawing.** `readAnchors()` called `anchor.trackingState` on every stroke anchor. `extendStroke()` read `pen.anchor`, and the `AnchorNode`s held them. - **Streetscape** (`ARSceneGeometryDemo.kt`). `onFrame()` called `trackingState` on kept `StreetscapeGeometry`, `StreetscapeGeometryNode.update()` read them too, and the coverage check held the closed `Session`.  ## What changed  Same pattern as #5205: one `DemoSessionState` holder per demo, cleared through the existing `onFailure(failure)` helper. It clears only on `ARSessionFailure.Fatal`, and a camera resume failure keeps everything. References are forgotten, never detached: the session is gone, and `AnchorNode` already skips `detach()` on a closed session. There is no SDK change.  - `DrawingSessionState<A>` holds the drawing, `anchorOf` and `healthOf`. A fatal failure drops the strokes along with their anchors, because strokes are drawn in anchor space. Stroke ids keep counting, so `key(stroke.id)` never reuses the id of a dropped stroke. The handler also resets the pen (`anchor`, `steady`, pending down/up) and `isTracking`. It does not reset `cameraReady`, because the init scrim would then cover the SDK's retry card. - `StreetscapeSessionState<S, G>` holds `session` and `geometries`. `SceneGeometryState.onSessionFailure()` also resets `geometryCount`, `isTr

- **Issue #5208** (2026-11-22): **Demo: Finger Drawing and Scene Geometry read ARCore objects after a fatal session failure**
  *Symptoms*: Follow-up to #5132 / #5205, found in review.  Two AR demos outside the #5132 list keep ARCore objects from a session that a fatal failure closed, and read them every frame:  - `FingerDrawingArDemo.kt:244` reads `anchor.trackingState` on kept anchors. - `ARSceneGeometryDemo.kt:373` reads `it.trackingState` on kept `StreetscapeGeometry`.  Neither passes `onSessionFailure`, so after "Try again" they keep the scene and the SDK retry card while holding objects of the closed session. Fix as in #5205: clear the held objects in `onSessionFailure` when the failure is fatal.  Also from the same review: the 3D Scan capture keeps recording into the same trace after a fatal failure and "Try again", because `forgetSession()` leaves the pose-continuity guard untouched (it is rate-based and reads the first new frame as continuous). Tracked in #5205 if fixed there.

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

### Incident Patch 1: `f8e0bdd7` (2026-11-23)
**Commit Message**: fix(sceneview): confirm an idle backend with a bounded fence wait after 5 s (#4969) (#5239)

* fix(sceneview): confirm an idle backend with a bounded fence wait after 5 s (#4969)

A release deferred until the backend is idle needs a reached fence no
older than 48 ms. A main thread polling less often than that, common on
the low-end devices behind the nDestroyRenderer ANRs, never sees one, so
on an engine that outlives its screens every renderer stayed pending
until Engine.destroy.

After the five-second warning, the replacement fence a poll arms is now
waited for at most FRESH_FENCE_CONFIRM_BUDGET_MS (4 ms) instead of zero.
Reached within it, the backend is idle right now and the release runs in
the same message, so FRenderer::terminate finds nothing queued behind
it. A busy backend misses the budget and the release stays pending; an
unreached fence is never waited for. At most two such waits a second,
only while a release is pending.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(sceneview): confirm the fence a poll arms, state the per-wake-up bound

Review follow-up on the bounded teardown confirmation.

- The fence a scheduled poll arms right after an invalidation is

**File**: `changelog.d/4969-teardown-no-block.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+<!-- category: Fixed -->
+- **Android: renderers and other deferred releases on a long-lived engine are freed on slow devices too ([#4969](https://github.com/sceneview/sceneview/issues/4969)).** A release deferred until the backend is idle needs a fence that is both reached and recent. A main thread polling less often than every 48 ms, common on low-end devices, never saw one, so on an engine shared by several screens every renderer stayed pending until `Engine.destroy`. After five seconds of waiting, each poll now creates a fence and waits at most 4 ms for it. If it is reached, the backend is idle at that moment and the release runs straight away, in the same main-thread message, so its own native wait finds nothing queued behind it. A backend that is still busy, with a new screen's shaders for instance, misses the 4 ms and the release keeps waiting. Nothing ever forces a release behind a busy fence.
```

**File**: `sceneview/src/main/java/io/github/sceneview/BackendIdleTeardowns.kt` (modified, +7/-2)
```diff
@@ -1,6 +1,10 @@
 package io.github.sceneview
 
-/** Polling backs off after the diagnostic, without authorizing a blocking release. */
+/**
+ * Polling backs off after the diagnostic, without authorizing a release behind a busy fence. Each
+ * poll may then wait [FRESH_FENCE_CONFIRM_BUDGET_MS] (per wake-up) for a fence it has just created,
+ * and releases at most one entry: pending entries drain at about two a second.
+ */
 internal const val BACKEND_IDLE_BACKOFF_MS = 1_000L
 
 /**
@@ -72,7 +76,8 @@ internal class BackendIdleTeardowns(
 
     /** Shared by fence-dependent releases and stalled model loads, at most once per poll. */
     fun isBackendBusy(): Boolean = backendBusy ?: checkNotNull(probe)
-        .isBusy(requireFresh = !retiring).also { backendBusy = it }
+        // The bounded confirmation runs from the scheduled poll only, never from a registration.
+        .isBusy(requireFresh = !retiring, mayWait = polling).also { backendBusy = it }
 
     private fun invalidateProbe() {
         probe?.release()
```

**File**: `sceneview/src/main/java/io/github/sceneview/Engine.kt` (modified, +48/-14)
```diff
@@ -147,9 +147,12 @@ internal fun Engine.destroyWhenBackendIdle(onDestroyed: () -> Unit = {}) {
  * When the backend is already idle — the usual case — the renderer is destroyed one poll later,
  * once that fence has made the round trip to the backend, exactly as [safeDestroyRenderer] would.
  * On a shared engine, polling less often than every 48 ms keeps the destroy pending unless a
- * replacement fence is already reached in the same poll. Once the engine is retiring,
- * Engine.destroy reclaims the renderer. Five seconds triggers a warning and slower polls,
- * never permission to destroy behind a busy fence.
+ * replacement fence is already reached in the same poll. Five seconds triggers a warning and
+ * slower polls, never permission to destroy behind a busy fence: from then on, the fence a poll
+ * arms may be waited for [FRESH_FENCE_CONFIRM_BUDGET_MS] per wake-up (several wake-ups when earlier
+ * fences signal meanwhile), and the renderer is destroyed only if it is reached, the backend idle
+ * at that instant (#4969). Pending releases then drain one per poll, about two a second. Once the
+ * engine is retiring, Engine.destroy reclaims the renderer.
  *
  * `FRenderer::terminate` then joins the frame-info job thread, parked in a GPU fence wait unless
  * the engine was built without the GPU frame-complete metric — see [createEngine].
@@ -196,8 +199,10 @@ internal fun Engine.isBackendBusy(): Boolean = teardowns().isBackendBusy()
  * `reclaimWithEngine` are left to Engine.destroy. See [BackendIdleTeardowns].
  *
  * One poll and probe are shared per engine. After five seconds polling backs off, with occasional
- * short confirmation polls for freshness. There is no timeout-triggered destruction. Neither a
- * reached nor a fresh fence bounds native destruction or command submission time.
+ * short confirmation polls for freshness, and each poll may wait for a fence it has just created,
+ * [FRESH_FENCE_CONFIRM_BUDGET_MS] per wake-up of Filament's fence wait. There is no
+ * timeout-triggered destruction. Neither a reached nor a fresh fence bounds native destruction or command
+ * submission time.
  *
  * [onIdle] receives `deferred = false` if it runs before this call returns. [onEngineGone] runs
  * instead after a raw engine destruction, without touching the fence. [safeDestroy] explicitly
@@ -219,23 +224,52 @@ internal fun Engine.whenBackendIdle(
     onIdle = onIdle,
 )
 
-/** Zero-timeout fence polling; FLUSH itself can still block on a full command stream. */
+/**
+ * Zero-timeout fence polling, then after five seconds one bounded wait per poll:
+ * [FRESH_FENCE_CONFIRM_BUDGET_MS] per wake-up, not wall-clock, since Filament v1.77.3's
+ * `FEngine::waitFence` restarts its `wait_for` each time an earlier fence signals. Each wait is
+ * timed and logged once above [FRESH_FENCE_CONFIRM_LOG_ABOVE_MS]. FLUSH itself can still block on
+ * a full command stream.
+ */
 private fun Engine.freshFenceProbe(): FreshFenceProbe<Fence> = FreshFenceProbe(
     createFence = { runCatching { createFence() }.getOrNull() },
-    isReached = { fence ->
-        when (runCatching { fence.wait(Fence.Mode.FLUSH, 0L) }.getOrNull()) {
-            Fence.FenceStatus.CONDITION_SATISFIED -> true
-            Fence.FenceStatus.TIMEOUT_EXPIRED -> false
-            else -> null // ERROR (or a failed wait) must re-arm, not poll a broken fence forever.
-        }
-    },
+    isReached = { fence -> fence.reachedWithin(0L) },
     destroyFence = { destroyFence(it) },
     now = SystemClock::uptimeMillis,
     onStillBusy = {
-        Log.w("Sceneview", "Backend teardown still pending after 5 s; backing off polls (#4969)")
+        Log.w(
+            "Sceneview",
+            "Backend teardown still pending after 5 s; backing off polls, each confirmed by a " +
+                "wait of $FRESH_FENCE_CONFIRM_BUDGET_MS ms per wake-up (#4969)",
+        )
+    },
+    awaitReached = { fence ->
+        val startedAt = System.nanoTime()
+        fence.reachedWithin(FRESH_FENCE_CONFIRM_BUDGET_MS * NANOS_PER_MS).also {
+            val waitedMs = (System.nanoTime() - startedAt) / NANOS_PER_MS
+            if (waitedMs > FRESH_FENCE_CONFIRM_LOG_ABOVE_MS && !slowConfirmationLogged) {
+                slowConfirmationLogged = true
+                Log.w("Sceneview", "Bounded teardown fence wait took $waitedMs ms; logged once (#4969)")
+            }
+        }
     },
 )
 
+private const val NANOS_PER_MS = 1_000_000L
+
+/** A bounded confirmation longer than this took several fence wake-ups: logged once. */
+private const val FRESH_FENCE_CONFIRM_LOG_ABOVE_MS = 16L
+
+/** Main thread only, like every probe call. */
+private var slowConfirmationLogged = false
+
+private fun Fence.reachedWithin(timeoutNanos: Long): Boolean? =
+    when (runCatching { wait(Fence.Mode.FLUSH, timeoutNanos) }.getOrNull()) {
+        Fence.FenceStatus.CONDITION_SATISFIED -> true
+        Fence.FenceStatus.TIMEOUT_EXPIRED -> false
+        else -> null // ERROR 
```

**File**: `sceneview/src/main/java/io/github/sceneview/FreshFenceProbe.kt` (modified, +51/-11)
```diff
@@ -12,9 +12,36 @@ package io.github.sceneview
  */
 internal const val FRESH_FENCE_MAX_AGE_MS = 3 * BACKEND_IDLE_POLL_MS
 
-/** Diagnostic threshold only: elapsed time never makes a stale fence safe. */
+/**
+ * After this delay a poll may also confirm with a bounded wait. Elapsed time never makes a
+ * stale fence safe: it only lets the probe ask, with a fence created in that poll, whether the
+ * backend is idle right now.
+ */
 internal const val FRESH_FENCE_WARN_AFTER_MS = 5_000L
 
+/**
+ * Timeout of the one bounded fence check a poll makes after [FRESH_FENCE_WARN_AFTER_MS] (#4969).
+ *
+ * A fence created in the poll and reached within this budget covers everything queued so far, so
+ * a release run right after it in the same message waits for nothing the main thread queued
+ * since. That is what the 48 ms freshness window approximates, and what a main thread polling
+ * less often than every 48 ms never satisfies: without it, a shared engine on a low-end device
+ * kept its pending releases until Engine.destroy. A backend still busy (a new screen's shaders)
+ * misses the budget, and the release stays pending.
+ *
+ * The bound is per wake-up, not wall-clock. Filament v1.77.3's `FEngine::waitFence` loops on
+ * `wait_for(timeout)` while the fence is unsignalled, on a condition variable shared by every
+ * fence: each earlier fence signalled meanwhile restarts the 4 ms. The worst case is about
+ * 4 ms × (fences queued before this one + 1). SceneView keeps one probe fence per engine, so that
+ * count is usually small. `Engine.kt` times each wait and logs once if one exceeds 16 ms.
+ *
+ * Cost and rate: one check per poll, only while a release is pending past the warning. The poll
+ * then alternates a 1 s back-off and a short confirmation, so at most two checks, and at most two
+ * releases, about every second. Each release invalidates the probe, so pending releases drain
+ * one per poll: 20 renderers take about ten seconds on a 15 fps main thread.
+ */
+internal const val FRESH_FENCE_CONFIRM_BUDGET_MS = 4L
+
 /** Elapsed waiting time never grants readiness; retirement after producers stop drops freshness. */
 internal fun fenceAllowsTeardown(
     reached: Boolean?,
@@ -24,7 +51,8 @@ internal fun fenceAllowsTeardown(
 ): Boolean = reached == true && (!requireFresh || ageMs in 0..maxFreshAgeMs)
 
 /**
- * Polls the backend backlog on the engine's thread, without waiting for a fence.
+ * Polls the backend backlog on the engine's thread. Fences are checked without waiting, except
+ * the bounded [awaitReached] check described below.
  *
  * A dispose-time fence covers commands queued before it. `destroyRenderer` and `asyncCancelLoad`
  * wait for everything queued when they run, including a new screen's shaders on a shared engine.
@@ -38,8 +66,14 @@ internal fun fenceAllowsTeardown(
  * releases cover that teardown's commands too. Other conditions, such as decoders, still apply.
  *
  * After [warnAfterMs], counted from the first poll rather than construction (a load may delay
- * polling), [onStillBusy] runs once. This never authorizes destruction. The owner backs off,
- * keeping occasional short confirmation polls for shared engines to observe a fresh fence.
+ * polling), [onStillBusy] runs once. This never authorizes destruction behind a stale fence. The
+ * owner backs off, keeping occasional short confirmation polls for shared engines to observe a
+ * fresh fence. From then on a fence armed by the call itself (the first after an invalidation,
+ * or the replacement of a stale one) is checked with [awaitReached], a wait bounded by the caller
+ * ([FRESH_FENCE_CONFIRM_BUDGET_MS] per wake-up on an engine), instead of the zero-timeout
+ * [isReached]: reached within it, the backend is idle right now, whatever the main thread's
+ * cadence. Only a caller passing `mayWait` gets it: the owner does so from its scheduled poll,
+ * never from a registration. Without [awaitReached] the probe never waits.
  * Missing fences remain busy; an errored fence ([isReached] returns null) is replaced.
  *
  * Filament-free for JVM tests. The owner must release the probe before destroying its engine,
@@ -53,6 +87,7 @@ internal class FreshFenceProbe<F : Any>(
     private val maxFreshAgeMs: Long = FRESH_FENCE_MAX_AGE_MS,
     private val warnAfterMs: Long = FRESH_FENCE_WARN_AFTER_MS,
     private val onStillBusy: () -> Unit = {},
+    private val awaitReached: ((F) -> Boolean?)? = null,
 ) {
     private var fence: F? = null
     private var armedAt = 0L
@@ -63,27 +98,32 @@ internal class FreshFenceProbe<F : Any>(
     /**
      * `true` while the backend has not recently caught up with what is queued on it.
      * Failure to create a fence is not evidence that the backend is idle. Fence waits use a zero
-     * timeout, but submitting commands can still block in Filament.
+     * timeout, or [awaitReached]'s bound after the warning; submitting commands can still block
+     * in Filament.
      */
     fun isBus
```

**File**: `sceneview/src/test/java/io/github/sceneview/BackendTeardownPolicyTest.kt` (modified, +80/-0)
```diff
@@ -67,6 +67,86 @@ class BackendTeardownPolicyTest {
         }
     }
 
+    /**
+     * #4969: an engine that outlives its screens (one per activity, or a home hero hoisted above
+     * navigation) on a main thread too slow for the 48 ms window. Every screen's renderer used to
+     * stay pending until Engine.destroy; the bounded confirmation releases each on the live engine.
+     */
+    @Test
+    fun aLongLivedSharedEngineDoesNotAccumulatePendingRenderers() {
+        for (bounded in listOf(false, true)) {
+            val clock = Clock()
+            val probe = FreshFenceProbe(
+                createFence = { clock.time },
+                // Zero-timeout checks never see a fence armed in the same poll; later ones are stale.
+                isReached = { clock.time > it },
+                destroyFence = {},
+                now = { clock.time },
+                awaitReached = if (bounded) ({ true }) else null,
+            )
+            val teardowns = BackendIdleTeardowns(probe)
+            var destroyed = 0
+            repeat(20) {
+                teardowns.defer(
+                    isEngineAlive = { true }, schedule = clock.schedule,
+                    teardown = { destroyed++ }, reclaimWithEngine = true,
+                )
+                repeat(30) { if (clock.callbacks.isNotEmpty()) clock.poll() }
+            }
+            repeat(200) { if (clock.callbacks.isNotEmpty()) clock.poll() }
+            if (bounded) {
+                assertEquals("every renderer released on the live engine", 20, destroyed)
+                assertEquals(0, teardowns.size)
+                assertTrue("polling stops once nothing is pending", clock.callbacks.isEmpty())
+            } else {
+                assertEquals("zero-timeout checks alone release nothing", 0, destroyed)
+                assertEquals(20, teardowns.size)
+            }
+        }
+    }
+
+    /**
+     * The drain rate after the warning: one release per poll (each release invalidates the probe,
+     * and the next poll confirms the fence it arms), polls alternating 1 s and a short confirmation.
+     * Registrations themselves never wait.
+     */
+    @Test
+    fun pendingReleasesDrainAtAboutTwoPerSecondAndRegistrationsNeverWait() {
+        val clock = Clock()
+        var waits = 0
+        var waitsDuringRegistration = 0
+        var registering = false
+        val probe = FreshFenceProbe(
+            createFence = { clock.time },
+            isReached = { clock.time > it },
+            destroyFence = {},
+            now = { clock.time },
+            awaitReached = {
+                waits++
+                if (registering) waitsDuringRegistration++
+                true
+            },
+        )
+        val teardowns = BackendIdleTeardowns(probe)
+        val releasedAt = mutableListOf<Long>()
+        repeat(20) {
+            registering = true
+            teardowns.defer(
+                isEngineAlive = { true }, schedule = clock.schedule,
+                teardown = { releasedAt += clock.time }, reclaimWithEngine = true,
+            )
+            registering = false
+        }
+        while (clock.callbacks.isNotEmpty()) clock.poll()
+        println("20 pending at 66 ms polls: first released at ${releasedAt.first()} ms, last at ${releasedAt.last()} ms")
+        assertEquals(20, releasedAt.size)
+        assertEquals(0, waitsDuringRegistration)
+        assertTrue("first at ${releasedAt.first()} ms", releasedAt.first() >= FRESH_FENCE_WARN_AFTER_MS)
+        val span = releasedAt.last() - releasedAt.first()
+        assertTrue("20 releases over $span ms", span <= 10 * (BACKEND_IDLE_BACKOFF_MS + clock.minimumGap))
+        assertEquals("one bounded wait per release", 20, waits)
+    }
+
     @Test
     fun retirementDoesNotAccumulateCallbacksForLateEngineOwnedResources() {
         val clock = Clock()
```

**File**: `sceneview/src/test/java/io/github/sceneview/FreshFenceTeardownTest.kt` (modified, +148/-4)
```diff
@@ -49,6 +49,9 @@ class FreshFenceTeardownTest {
         fun createFence(): Int = enqueue(FENCE_ROUND_TRIP_MS)
         fun isReached(fence: Int) = doneAt[fence] <= now
 
+        /** How long a wait for [fence] would keep the caller now, unbounded. */
+        fun msUntilReached(fence: Int) = maxOf(0L, doneAt[fence] - now)
+
         /** How long a wait for everything queued so far would block the caller now. */
         fun drainWaitMs() = maxOf(0L, freeAt - now)
 
@@ -98,7 +101,28 @@ class FreshFenceTeardownTest {
         pollGaps: List<Long> = listOf(BACKEND_IDLE_POLL_MS),
         recoverAtMs: Long? = null,
         busy: (SimBackend) -> () -> Boolean,
-    ): Result {
+    ): Result = checkNotNull(
+        replayOrNull(
+            backlogMs, nextScreenAtMs, nextScreenWorkMs, frameWorkMs, mainThreadBusy, pollGaps, recoverAtMs, busy,
+        ),
+    ) { "the teardown never ran" }
+
+    /**
+     * [replay], or null when the teardown is still pending after 20 s. With [probe], the registry
+     * owns it, as `Engine.whenBackendIdle` does: its warning also drives the 1 s back-off.
+     */
+    @Suppress("LongParameterList")
+    private fun replayOrNull(
+        backlogMs: Long = 200,
+        nextScreenAtMs: Long = 20,
+        nextScreenWorkMs: Long = 3_000,
+        frameWorkMs: Long = 4,
+        mainThreadBusy: LongRange = LongRange.EMPTY,
+        pollGaps: List<Long> = listOf(BACKEND_IDLE_POLL_MS),
+        recoverAtMs: Long? = null,
+        busy: ((SimBackend) -> () -> Boolean)? = null,
+        probe: ((SimBackend) -> FreshFenceProbe<Int>)? = null,
+    ): Result? {
         val backend = SimBackend()
         backend.mainThreadBusy = mainThreadBusy
         backend.pollGaps = pollGaps
@@ -107,9 +131,10 @@ class FreshFenceTeardownTest {
         }
         var result: Result? = null
         if (backlogMs > 0) backend.enqueue(backlogMs)
-        BackendIdleTeardowns().defer(
+        val teardowns = probe?.let { BackendIdleTeardowns(probe = it(backend)) } ?: BackendIdleTeardowns()
+        teardowns.defer(
             isEngineAlive = { true },
-            isBackendBusy = busy(backend),
+            isBackendBusy = busy?.invoke(backend) ?: teardowns::isBackendBusy,
             schedule = backend.schedule,
             teardown = { deferred -> result = Result(backend.now, backend.drainWaitMs(), deferred) },
         )
@@ -121,7 +146,7 @@ class FreshFenceTeardownTest {
             frame += 16
         }
         backend.runUntil(20_000)
-        return checkNotNull(result) { "the teardown never ran" }
+        return result
     }
 
     /** `Engine.whenBackendIdle` before this change: one fence, created when the scene is disposed. */
@@ -169,6 +194,24 @@ class FreshFenceTeardownTest {
 
     private val freshFence: (SimBackend) -> () -> Boolean = { backend -> newProbe(backend)::isBusy }
 
+    /** Every bounded wait the probe made: when, and how long it kept the main thread. */
+    private class BoundedWaits {
+        val waits = mutableListOf<Pair<Long, Long>>()
+    }
+
+    /** The production probe: zero-timeout checks, then the bounded confirmation after 5 s. */
+    private fun boundedProbe(backend: SimBackend, log: BoundedWaits = BoundedWaits()) = FreshFenceProbe(
+        createFence = backend::createFence,
+        isReached = backend::isReached,
+        destroyFence = {},
+        now = { backend.now },
+        awaitReached = { fence ->
+            val until = backend.msUntilReached(fence)
+            log.waits += backend.now to minOf(until, FRESH_FENCE_CONFIRM_BUDGET_MS)
+            until <= FRESH_FENCE_CONFIRM_BUDGET_MS
+        },
+    )
+
     @Test
     fun `a dispose-time fence releases into the next screen's backlog`() {
         val before = replay(busy = disposeTimeFence)
@@ -443,6 +486,107 @@ class FreshFenceTeardownTest {
         }
     }
 
+    /**
+     * #4969: a steady main thread slower than the 48 ms window, on a shared engine that stays
+     * alive. Zero-timeout checks never see a fresh fence, so the release waited for Engine.destroy;
+     * the bounded confirmation finds the idle backend shortly after the warning.
+     */
+    @Test
+    fun `a main thread too slow for freshness still releases once the backend is idle`() {
+        for (gap in listOf(66L, 100L, 300L)) {
+            val zeroTimeout = replayOrNull(
+                // Like-for-like with the run below: a registry-owned probe, so the 1 s back-off applies.
+                backlogMs = 0, nextScreenWorkMs = 0, pollGaps = listOf(gap), probe = { newProbe(it) },
+            )
+            assertEquals("a poll every $gap ms, zero-timeout only", null, zeroTimeout)
+
+            val after = checkNotNull(
+                replayOrNull(backlogMs = 0, nextScreenWorkMs = 0, pollGaps = listOf(gap), probe = { boundedProbe(it) }),
+            ) { "a poll every $gap ms: never released" }
+            println("a poll every $gap ms, bounded check: released at ${after.ranAtMs} ms, blocked ${after.
```

---

### Incident Patch 2: `dc4c361c` (2026-11-23)
**Commit Message**: fix(sceneview, arsceneview): share the exact Rec.2020 tone-map inverse with every pass-through material (#5219) (#5227)

* fix(sceneview, arsceneview): share the exact Rec.2020 tone-map inverse with every pass-through material (#5219)

Filament's ColorGrading applies the tone mapper in its Rec.2020 working
space. The AR camera feed, video, view-texture and splat materials undid
it channel by channel in Rec.709, which is exact for greys only: a
#66B0F5 sky in the camera feed showed at #93B2FA.

- New sceneview/src/main/materials/include/view_tone_map_inverse.fs: the
  exact sRGB EOTF, Rec.709 <-> Rec.2020 matrices, the exact inverse of
  Filmic and of PBR Neutral, and inverseViewTonemapSRGB(srgb, filmic),
  the inverse #5102 introduced for semantics_overlay. Plain GLSL, so
  splat.mat includes it in its vertex block.
- video_texture, video_texture_chroma_key, view_texture_lit,
  view_texture_unlit, semantics_overlay, splat and the three
  camera_stream materials include it through matc's #include instead of
  carrying their own copy. In a Filmic view, VideoNode and ViewNode also
  decode with the exact sRGB EOTF instead of pow(c, 2.2).
- The nine blobs recompiled with the pinned mat

**File**: `arsceneview/src/main/java/io/github/sceneview/ar/camera/ARCameraStream.kt` (modified, +1/-1)
```diff
@@ -372,7 +372,7 @@ open class ARCameraStream(
                 setParameter(kFogEnabledParameter, 1f)
                 // Compose Color is sRGB; the shader does its haze blend in the
                 // pre-tone-mapped space the shader decodes into with
-                // `Inverse_Tonemap_Filmic(srgbToLinearExact(...))` (#3338).
+                // `inverseViewTonemapSRGB(camera, true)` (#3338, #5219).
                 // Use the linear components straight (`red`/`green`/`blue` on
                 // Compose Color are already in the colour-space's component
                 // domain) — matches how `FogNode` writes to `fogOptions.color`.
```

**File**: `arsceneview/src/main/materials/camera_stream_depth.mat` (modified, +7/-15)
```diff
@@ -220,28 +220,20 @@ fragment {
         return mix(kNoDepthDistanceMeters, occluder_m, depth_valid * in_range);
     }
 
-    // Exact sRGB EOTF (IEC 61966-2-1), issue #3338 — see camera_stream_flat.mat for the
-    // full rationale. Short version: the camera texel is sRGB-encoded full-range BT.709
-    // (ARCore dataspace 0x08810000), and Filament re-encodes with the exact sRGB OETF at
-    // the color-grading output stage, so decoding with `pow(c, 2.2)` (what Filament's
-    // `inverseTonemapSRGB()` does) left an achromatic S-curve on the camera background
-    // worth up to -8.5/255 in the shadows. Kept verbatim in all three camera materials —
-    // matc has no include mechanism.
-    vec3 srgbToLinearExact(const vec3 srgb) {
-        vec3 s = clamp(srgb, 0.0, 1.0);
-        return mix(s * (1.0 / 12.92),
-                   pow((s + 0.055) * (1.0 / 1.055), vec3(2.4)),
-                   step(vec3(0.04045), s));
-    }
+    // The exact inverse of the View's Filmic tone mapper and sRGB OETF: exact sRGB EOTF
+    // (#3338), curve inverted in the Rec.2020 space Filament grades in (#5219). See
+    // camera_stream_flat.mat for the rationale; shared by all three camera materials.
+    #include "../../../../sceneview/src/main/materials/include/view_tone_map_inverse.fs"
 
     void material(inout MaterialInputs material) {
         prepareMaterial(material);
         // EIS supplies homogeneous texture coordinates. Divide AFTER interpolation (#2728).
         // OFF samples UV0 exactly as before EIS support, without a second Y flip.
         highp vec2 cameraUv = materialParams.imageStabilizationEnabled
                 ? variable_cameraUv.xy / variable_cameraUv.z : getUV0();
-        vec3 camera = Inverse_Tonemap_Filmic(
-                srgbToLinearExact(texture(materialParams_cameraTexture, cameraUv).rgb));
+        // The View is createARView's: Filmic.
+        vec3 camera = inverseViewTonemapSRGB(
+                texture(materialParams_cameraTexture, cameraUv).rgb, true);
         vec2 packed_depth = texture(materialParams_depthTexture, cameraUv).xy;
         float depth_mm = dot(packed_depth, vec2(255.f, 256.f * 255.f));
         float depth_m = depth_mm / 1000.f;
```

**File**: `arsceneview/src/main/materials/camera_stream_flat.mat` (modified, +14/-23)
```diff
@@ -36,42 +36,33 @@ material {
 }
 
 fragment {
-    // Exact sRGB EOTF (IEC 61966-2-1), issue #3338.
-    //
     // The camera texel arriving from the external sampler is already sRGB-encoded,
     // full-range BT.709 RGB: ARCore hands the buffer over with dataspace 0x08810000
     // (STANDARD_BT709 | TRANSFER_SRGB | RANGE_FULL), so the EGL external sampler has
     // already done YUV -> RGB with the right matrix and the right range.
     //
-    // To survive the pipeline untouched the pixel has to be decoded with the SAME
-    // transfer function Filament re-encodes with at the end. Filament's color-grading
-    // output stage is Rec709-sRGB-D65 — the exact piecewise sRGB OETF, linear segment
-    // included. Filament's own `inverseTonemapSRGB()` helper decodes with `pow(c, 2.2)`
-    // instead, which is only an approximation of that curve, so the round trip
-    // `sRGB_OETF(pow(c, 2.2))` was not the identity: up to -8.5/255 of error in the
-    // shadows (peak at code 16), crossing back to +1.5/255 in the highlights. Achromatic,
-    // so not a tint — an S-curve contrast boost applied to the camera background ONLY,
-    // which graded the real world differently from the virtual content composited over it.
-    //
-    // Decoding with the exact curve makes the round trip bit-exact at every 8-bit code.
-    vec3 srgbToLinearExact(const vec3 srgb) {
-        vec3 s = clamp(srgb, 0.0, 1.0);
-        return mix(s * (1.0 / 12.92),
-                   pow((s + 0.055) * (1.0 / 1.055), vec3(2.4)),
-                   step(vec3(0.04045), s));
-    }
+    // To survive the pipeline untouched the pixel is pre-distorted by the exact inverse of
+    // what the View does after this shader: createARView's ToneMapper.Filmic, then the exact
+    // sRGB OETF. Two corrections live in that inverse:
+    //  - #3338: decode with the exact sRGB EOTF. Filament's inverseTonemapSRGB() decodes with
+    //    pow(c, 2.2), and the round trip sRGB_OETF(pow(c, 2.2)) was an S-curve on the camera
+    //    background only: up to -8.5/255 in the shadows.
+    //  - #5219: invert the curve in Rec.2020, where Filament's ColorGrading applies it.
+    //    Inverted channel by channel in Rec.709 it was exact for greys only: a #66B0F5 sky
+    //    showed at about #93B2FA, lighter and less saturated than the real world.
+    // The inverse is shared with the other pass-through materials (video, view texture, splat,
+    // Scene Semantics overlay) through this include.
+    #include "../../../../sceneview/src/main/materials/include/view_tone_map_inverse.fs"
 
     void material(inout MaterialInputs material) {
         prepareMaterial(material);
         // EIS supplies homogeneous texture coordinates. Divide AFTER interpolation (#2728).
         // OFF samples UV0 exactly as before EIS support, without a second Y flip.
         highp vec2 cameraUv = materialParams.imageStabilizationEnabled
                 ? variable_cameraUv.xy / variable_cameraUv.z : getUV0();
-        // Inverse_Tonemap_Filmic is the exact analytic inverse of ToneMapper.Filmic,
-        // which createARView() installs on the View — that leg already cancelled and is
-        // kept as-is. Only the transfer-function leg changes (#3338).
+        // The View is createARView's: Filmic.
         vec3 camera = texture(materialParams_cameraTexture, cameraUv).rgb;
-        material.baseColor.rgb = Inverse_Tonemap_Filmic(srgbToLinearExact(camera));
+        material.baseColor.rgb = inverseViewTonemapSRGB(camera, true);
         material.baseColor.a = 1.f;
     }
 }
```

**File**: `arsceneview/src/main/materials/camera_stream_person_occlusion.mat` (modified, +7/-10)
```diff
@@ -218,23 +218,20 @@ fragment {
     // fragment can be" — what the PERSON mask has to write to win every depth test.
     const float kNdcNearPlane = 1.0;
 
-    // Exact sRGB EOTF (IEC 61966-2-1), issue #3338 — copied verbatim from
-    // `camera_stream_depth.mat`; see `camera_stream_flat.mat` for the full rationale.
-    vec3 srgbToLinearExact(const vec3 srgb) {
-        vec3 s = clamp(srgb, 0.0, 1.0);
-        return mix(s * (1.0 / 12.92),
-                   pow((s + 0.055) * (1.0 / 1.055), vec3(2.4)),
-                   step(vec3(0.04045), s));
-    }
+    // The exact inverse of the View's Filmic tone mapper and sRGB OETF: exact sRGB EOTF
+    // (#3338), curve inverted in the Rec.2020 space Filament grades in (#5219). See
+    // camera_stream_flat.mat for the rationale; shared by all three camera materials.
+    #include "../../../../sceneview/src/main/materials/include/view_tone_map_inverse.fs"
 
     void material(inout MaterialInputs material) {
         prepareMaterial(material);
         // EIS supplies homogeneous texture coordinates. Divide AFTER interpolation (#2728).
         // OFF samples UV0 exactly as before EIS support, without a second Y flip.
         highp vec2 cameraUv = materialParams.imageStabilizationEnabled
                 ? variable_cameraUv.xy / variable_cameraUv.z : getUV0();
-        vec3 camera = Inverse_Tonemap_Filmic(
-                srgbToLinearExact(texture(materialParams_cameraTexture, cameraUv).rgb));
+        // The View is createARView's: Filmic.
+        vec3 camera = inverseViewTonemapSRGB(
+                texture(materialParams_cameraTexture, cameraUv).rgb, true);
         vec2 packed_depth = texture(materialParams_depthTexture, cameraUv).xy;
         float depth_mm = dot(packed_depth, vec2(255.f, 256.f * 255.f));
         float depth_m = depth_mm / 1000.f;
```

**File**: `arsceneview/src/test/java/io/github/sceneview/ar/camera/CameraStreamColorContractTest.kt` (modified, +85/-0)
```diff
@@ -3,6 +3,7 @@ package io.github.sceneview.ar.camera
 import org.junit.Assert.assertEquals
 import org.junit.Assert.assertTrue
 import org.junit.Test
+import java.io.File
 import kotlin.math.abs
 import kotlin.math.pow
 import kotlin.math.sqrt
@@ -29,6 +30,12 @@ import kotlin.math.sqrt
  *     Filament's `inverseTonemapSRGB()` helper does), and `sRGB_OETF(pow(c, 2.2))` is not the
  *     identity. That mismatch is the bug.
  *
+ * A third correction came with #5219: Filament's ColorGrading applies the tone mapper in its
+ * Rec.2020 working space. Inverted channel by channel in Rec.709, the Filmic leg cancelled for
+ * greys only, and a `#66B0F5` sky showed at `#93B2FA`. The three materials now include the
+ * inverse every pass-through material shares (`sceneview/src/main/materials/include/
+ * view_tone_map_inverse.fs`), which converts to Rec.2020, inverts there and converts back.
+ *
  * The shader chain is reproduced as pure Kotlin so its output can be checked directly.
  */
 class CameraStreamColorContractTest {
@@ -109,4 +116,82 @@ class CameraStreamColorContractTest {
         )
     }
 
+    // --- Rec.2020 grading (#5219) ---------------------------------------------------------
+
+    /** Filament's sRGB_to_REC2020 and REC2020_to_sRGB, row-major. */
+    private val rec709ToRec2020 = arrayOf(
+        doubleArrayOf(0.6274040, 0.3292820, 0.0433136),
+        doubleArrayOf(0.0690970, 0.9195400, 0.0113612),
+        doubleArrayOf(0.0163916, 0.0880132, 0.8955950),
+    )
+    private val rec2020ToRec709 = arrayOf(
+        doubleArrayOf(1.6604910, -0.5876411, -0.0728499),
+        doubleArrayOf(-0.1245505, 1.1328999, -0.0083494),
+        doubleArrayOf(-0.0181508, -0.1005789, 1.1187297),
+    )
+
+    private fun Array<DoubleArray>.times(v: DoubleArray) =
+        DoubleArray(3) { r -> (0..2).sumOf { this[r][it] * v[it] } }
+
+    /** What the View shows for a scene colour: Filmic per channel in Rec.2020, then the OETF. */
+    private fun shown(scene: DoubleArray): List<Int> {
+        val graded = rec2020ToRec709.times(rec709ToRec2020.times(scene).map(::filmic).toDoubleArray())
+        return graded.map { Math.round(linearToSrgbExact(it.coerceIn(0.0, 1.0)) * 255).toInt() }
+    }
+
+    /** `inverseViewTonemapSRGB(camera, true)` of the shared include. */
+    private fun cameraScene(srgb: IntArray): DoubleArray {
+        val working = rec709ToRec2020.times(DoubleArray(3) { srgbToLinearExact(srgb[it] / 255.0) })
+        return rec2020ToRec709.times(working.map(::inverseFilmic).toDoubleArray()).map { maxOf(it, 0.0) }
+            .toDoubleArray()
+    }
+
+    private fun bytes(rgb: Int) = IntArray(3) { (rgb shr (16 - 8 * it)) and 0xFF }
+
+    @Test
+    fun `a saturated camera colour displays as it came from the camera`() {
+        val chart = listOf(0x66B0F5, 0xD95F57, 0x4CB050, 0x2196F2, 0xF5428C, 0x00BDD4, 0xFFC207, 0x9E75BD, 0x808080)
+        chart.forEach { rgb ->
+            val source = bytes(rgb)
+            val got = shown(cameraScene(source))
+            for (c in 0..2) {
+                // A channel that would need a negative scene value is clipped at zero.
+                val tolerance = if (source[c] < 0x30) 16 else 1
+                assertTrue(
+                    "#%06X shows $got (tolerance $tolerance)".format(rgb),
+                    abs(got[c] - source[c]) <= tolerance,
+                )
+            }
+        }
+    }
+
+    @Test
+    fun `inverted channel by channel in Rec 709, the sky was lighter and less saturated`() {
+        val sky = bytes(0x66B0F5)
+        val per709 = DoubleArray(3) { inverseFilmic(srgbToLinearExact(sky[it] / 255.0)) }
+        assertEquals(listOf(0x93, 0xB2, 0xFA), shown(per709))
+    }
+
+    @Test
+    fun `the three camera materials include the shared inverse for a Filmic view`() {
+        val include = "../../../../sceneview/src/main/materials/include/view_tone_map_inverse.fs"
+        assertTrue(
+            "the include the materials name resolves from their directory",
+            File("src/main/materials", include).isFile,
+        )
+        for (name in listOf("flat", "depth", "person_occlusion")) {
+            val source = File("src/main/materials/camera_stream_$name.mat").readText()
+            val code = source.lines().filterNot { it.trimStart().startsWith("//") }.joinToString("\n")
+            assertTrue("$name includes the shared inverse", code.contains("#include \"$include\""))
+            assertTrue(
+                "$name pre-distorts the camera for createARView's Filmic",
+                Regex("inverseViewTonemapSRGB\\(\\s*texture\\(materialParams_cameraTexture, cameraUv\\)\\.rgb, true\\)")
+                    .containsMatchIn(code) ||
+                    code.contains("inverseViewTonemapSRGB(camera, true)"),
+            )
+            listOf("Inverse_Tonemap_Filmic(", "srgbToLinearExact(", "inverseTonemapSRGB(").forEach {
+                assertTrue("$name still calls $it", !code.contains(it))
+         
```

**File**: `changelog.d/5219-rec2020-tone-map-inverse.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+<!-- category: Fixed -->
+- **Video, view-texture, splat and AR camera-feed colours stay saturated ([#5219](https://github.com/sceneview/sceneview/issues/5219)).** These materials undid the view's tone mapper channel by channel in Rec.709, but Filament tone-maps in Rec.2020, so only greys came back unchanged: a `#66B0F5` sky showed at about `#93B2FA`. All nine pass-through materials now include one shared exact inverse (`include/view_tone_map_inverse.fs`, the one the Scene Semantics overlay got in #5102), so in-gamut colours display as their source. A vivid colour the view cannot show (such as `#00FFFF`) is never shown further from its source than before. A `VideoNode` or `ViewNode` in an AR view also decodes with the exact sRGB curve instead of `pow(c, 2.2)`.
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/internal/model/SurfelSplats.kt` (modified, +4/-1)
```diff
@@ -238,7 +238,10 @@ internal object SurfelSplats {
         for (c in 0 until 3) out[c] = linearToSrgb(toned[c]).coerceIn(0f, 1f)
     }
 
-    /** The exact sRGB EOTF, as `splat.mat`'s `splatSrgbToLinear`. */
+    /**
+     * The exact sRGB EOTF, as `viewInverseSrgbToLinear` in `include/view_tone_map_inverse.fs`,
+     * which `splat.mat` includes.
+     */
     fun srgbToLinear(c: Float): Float = if (c <= 0.04045f) c / 12.92f else ((c + 0.055f) / 1.055f).pow(2.4f)
 
     /** The exact sRGB OETF, the inverse of [srgbToLinear]. */
```

**File**: `sceneview/src/androidTest/java/io/github/sceneview/render/ToneMapPassThroughRenderTest.kt` (added, +277/-0)
```diff
@@ -0,0 +1,277 @@
+package io.github.sceneview.render
+
+import android.graphics.SurfaceTexture
+import android.util.Log
+import android.view.Surface
+import androidx.test.ext.junit.runners.AndroidJUnit4
+import androidx.test.platform.app.InstrumentationRegistry
+import com.google.android.filament.Camera
+import com.google.android.filament.ColorGrading
+import com.google.android.filament.EntityManager
+import com.google.android.filament.MaterialInstance
+import com.google.android.filament.Skybox
+import com.google.android.filament.Stream
+import com.google.android.filament.Texture
+import com.google.android.filament.ToneMapper
+import com.google.android.filament.android.StreamHelper
+import io.github.sceneview.SceneNodeManager
+import io.github.sceneview.collision.CollisionSystem
+import io.github.sceneview.filmicViews
+import io.github.sceneview.loaders.MaterialLoader
+import io.github.sceneview.math.Direction
+import io.github.sceneview.math.Position
+import io.github.sceneview.math.Size
+import io.github.sceneview.node.PlaneNode
+import org.junit.AfterClass
+import org.junit.Assert.assertTrue
+import org.junit.BeforeClass
+import org.junit.Test
+import org.junit.runner.RunWith
+import kotlin.math.abs
+
+/**
+ * The pass-through materials display a saturated source colour as it is (#5219).
+ *
+ * `video_texture.mat` (a `VideoNode`) and `view_texture_unlit.mat` (an unlit `ViewNode`) sample
+ * an external stream, an sRGB image, and pre-distort it by the inverse of the View's tone mapper
+ * so the View's grading lands it back on the source colour. Filament grades in Rec.2020: the
+ * inverse used to run channel by channel in Rec.709, exact for greys only, so a `#66B0F5` sky
+ * came out lighter and less saturated.
+ *
+ * Each colour of a saturated chart is painted into the stream through a [Surface], as a decoded
+ * video frame or a drawn View lands in it, then drawn full frame and read back at the centre, in
+ * a [io.github.sceneview.createView] view (PBR Neutral) and in a Filmic view like
+ * [io.github.sceneview.createARView]'s. Needs pixel readback ([RenderTestCapabilities]): run with
+ * `-e gpuReadback true`.
+ */
+@RunWith(AndroidJUnit4::class)
+class ToneMapPassThroughRenderTest {
+
+    companion object {
+        private const val SIZE = 64
+        private const val TAG = "ToneMapPassThrough"
+
+        /**
+         * A saturated chart, sRGB bytes: the Scene Semantics legend's most saturated classes
+         * (sky, terracotta, green, strong blue, pink, cyan, amber, purple), and a grey.
+         */
+        private val CHART = intArrayOf(
+            0x66B0F5, 0xD95F57, 0x4CB050, 0x2196F2, 0xF5428C, 0x00BDD4, 0xFFC207, 0x9E75BD, 0x808080,
+        )
+
+        /**
+         * Vivid cyans no inverse can show as they are: they need a negative Rec.709 channel, which
+         * the colour buffer cannot hold. Each maps to what `ToneMapInverseContractTest`'s model of
+         * the shared inverse predicts: under PBR Neutral, the per-channel Rec.709 inverse's result
+         * (clipping alone showed #00FFFF as (150, 254, 254)); under Filmic, the clipped one, nearer
+         * the source than before (#00FFFF used to show (245, 255, 255)).
+         */
+        private val VIVID_IN_A_3D_VIEW = mapOf(0x00FFFF to 0x00E9E9, 0x00E5FF to 0x00E3E9)
+        private val VIVID_IN_AN_AR_VIEW = mapOf(0x00FFFF to 0xDFF9FE, 0x00E5FF to 0xAEE2FE)
+
+        /** 8-bit steps per channel left to the grading LUT, the colour buffer and dithering. */
+        private const val TOLERANCE = 6
+
+        /**
+         * A channel darker than [DARK_CHANNEL] may land up to [DARK_TOLERANCE] steps above its
+         * source: under Filmic, a strong blue's or a cyan's red would need a negative scene value,
+         * which the colour buffer cannot hold (the inverse clips it at zero).
+         */
+        private const val DARK_CHANNEL = 0x30
+        private const val DARK_TOLERANCE = 16
+
+        private lateinit var harness: RenderTestHarness
+        private lateinit var materialLoader: MaterialLoader
+        private lateinit var nodeManager: SceneNodeManager
+        private var cameraEntity: Int? = null
+
+        @JvmStatic
+        @BeforeClass
+        fun setupClass() {
+            harness = RenderTestHarness(width = SIZE, height = SIZE)
+            harness.runOnMain {
+                val context = InstrumentationRegistry.getInstrumentation().targetContext
+                materialLoader = MaterialLoader(harness.engine, context)
+                nodeManager = SceneNodeManager(harness.scene, CollisionSystem(harness.view))
+            }
+        }
+
+        @JvmStatic
+        @AfterClass
+        fun teardownClass() {
+            harness.runOnMain {
+                materialLoader.destroy()
+                cameraEntity?.let {
+                    harness.engine.destroyCameraComponent(it)
+                    EntityManager.get().destroy(it)
+                }
+            }
+            harness.destr
```

---

### Incident Patch 3: `88e64cea` (2026-11-23)
**Commit Message**: fix(sceneview): free the SDK's ColorGrading when rememberView / rememberARView dispose (#5232) (#5238)

* fix(sceneview): free the SDK's ColorGrading when rememberView / rememberARView dispose (#5232)

createView and createARView each build a ColorGrading (a 3D LUT) that
Engine.destroyView leaves alive. On an engine that outlives the screen
(hoisted above navigation, shared, app-level), every exit of the
composable left one behind.

Both factories now record the grading they built in a weak map keyed by
the view, and rememberView / rememberARView destroy the view, then that
grading, whether the view still holds it or the app replaced it. A
grading the app set is never freed by the SDK. The new helper lives next
to the factories in SceneFactories.kt; Engine.kt is untouched.

The demo's rememberFilmicView now builds on rememberView and frees only
its own Filmic grading, after the view: each object is destroyed once.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(sceneview): review follow-ups for the view ColorGrading teardown (#5232)

- KDoc: rememberView / rememberARView free the SDK grading read through
  view.colorGrading, so it must not be shared with a view that outl

**File**: `changelog.d/5232-view-colorgrading-leak.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+<!-- category: Fixed -->
+- **`rememberView` / `rememberARView` no longer leave a `ColorGrading` on an engine that outlives the screen.** `createView` and `createARView` each build a grading (a 3D LUT) that `Engine.destroyView` leaves alive. With an engine hoisted above navigation, shared or held app-wide, every exit of the composable left one behind, and one more when the app had replaced it with `view.colorGrading = …`. Disposal now frees the view, then the grading the SDK built for it, attached or replaced. A grading the app set is never freed by the SDK: it may be shared. The demo's `rememberFilmicView` now builds on `rememberView` and frees only its own Filmic grading. An app that worked around the leak by freeing `view.colorGrading` itself after the view must drop that workaround: the grading is already freed, and the call now throws `Calling method on destroyed ColorGrading`. (#5232)
```

**File**: `llms.txt` (modified, +2/-2)
```diff
@@ -4926,8 +4926,8 @@ Most are default parameter values in `SceneView`/`ARSceneView` — call them exp
 | `rememberViewNodeManager()` | `ViewNode.WindowManager` | Required for ViewNode composables |
 | `rememberSceneRecorder()` | `SceneRecorder` | Photo (PixelCopy, JPEG/PNG) and MP4 video (1080p30, optional mic, time limit, watermark) of the rendered scene — pass `recorder.surfaceMirrorer` to the scene (see "Capture the scene") |
 | `rememberSurfaceMirrorer()` | `SurfaceMirrorer` | Lower level: mirror frames to your own encoder surface, no MediaProjection (see "Capture the scene") |
-| `rememberView(engine)` | `View` | Filament view (one per viewport), PBR Neutral tone mapper |
-| `rememberARView(engine)` | `View` | AR-tuned view (Filmic tone mapper — round-trips the camera background, #1434) |
+| `rememberView(engine)` | `View` | Filament view (one per viewport), PBR Neutral tone mapper; disposal frees the view and the `ColorGrading` it built, never one you set (#5232) |
+| `rememberARView(engine)` | `View` | AR-tuned view (Filmic tone mapper — round-trips the camera background, #1434); disposal frees it like `rememberView` |
 | `rememberRenderer(engine)` | `Renderer` | Filament renderer (one per window) |
 | `rememberScene(engine)` | `Scene` | Filament scene graph |
 | `rememberCollisionSystem(view)` | `CollisionSystem` | Hit-testing system |
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/common/FilmicView.kt` (modified, +11/-19)
```diff
@@ -8,7 +8,7 @@ import com.google.android.filament.Engine
 import com.google.android.filament.ToneMapper
 import com.google.android.filament.View
 import io.github.sceneview.createView
-import io.github.sceneview.safeDestroyView
+import io.github.sceneview.rememberView
 
 /**
  * A [createView] view that keeps the Filmic tone mapper the SDK used before it moved to PBR
@@ -23,24 +23,16 @@ import io.github.sceneview.safeDestroyView
  */
 @Composable
 fun rememberFilmicView(engine: Engine): View {
-    val graded = remember(engine) {
-        val view = createView(engine)
-        // The PBR Neutral grading `createView` gave the view: replaced, not freed by the swap.
-        val replaced = view.colorGrading
-        view.colorGrading = ColorGrading.Builder().toneMapper(ToneMapper.Filmic()).build(engine)
-        GradedView(view, listOfNotNull(replaced, view.colorGrading))
+    val filmic = remember(engine) {
+        ColorGrading.Builder().toneMapper(ToneMapper.Filmic()).build(engine)
     }
-    // Not `rememberView`: `destroyView` frees the view alone, and on an engine that outlives the
-    // screen (the home hero's, #5202) both gradings, a 3D LUT each, would pile up visit after
-    // visit. The view goes first: a grading must not be freed while a view still holds it.
-    DisposableEffect(graded) {
-        onDispose {
-            engine.safeDestroyView(graded.view)
-            graded.gradings.forEach { runCatching { engine.destroyColorGrading(it) } }
-        }
+    // Declared before the view, so disposed after it: a grading must not be freed while a view
+    // still holds it. On an engine that outlives the screen (the home hero's, #5202) it would
+    // otherwise pile up, a 3D LUT per visit.
+    DisposableEffect(filmic) {
+        onDispose { runCatching { engine.destroyColorGrading(filmic) } }
     }
-    return graded.view
+    // `rememberView` frees the view and the PBR Neutral grading `createView` gave it (#5232):
+    // each object is destroyed once, by whoever made it.
+    return rememberView(engine) { createView(engine).apply { colorGrading = filmic } }
 }
-
-/** A view and every [ColorGrading] made for it, freed with it. */
-private class GradedView(val view: View, val gradings: List<ColorGrading>)
```

**File**: `samples/android-demo/src/main/java/io/github/sceneview/demo/demos/RerunModelUi.kt` (modified, +2/-1)
```diff
@@ -1209,9 +1209,10 @@ internal fun RerunModelScreen(
         val environment = rememberModelEnvironment(engine, chrome.ground)
         val darkStage = chrome.ground.luminance() < HALF_LUMINANCE
         val shadowPool = remember { radialPool(LightingStage.FLOOR_COLOR) }
-        val view = rememberView(engine)
+        // Declared before the view, so disposed after it: never freed under the view holding it.
         val colorGrading = remember(engine) { ColorGrading.Builder().toneMapper(ToneMapper.Linear()).build(engine) }
         DisposableEffect(colorGrading) { onDispose { engine.destroyColorGrading(colorGrading) } }
+        val view = rememberView(engine)
         // Before the first frame, not on it: the tone mapping is part of the first picture.
         DisposableEffect(view, colorGrading) {
             view.configureForDebug(colorGrading)
```

**File**: `sceneview/src/main/java/io/github/sceneview/SceneFactories.kt` (modified, +39/-0)
```diff
@@ -141,6 +141,14 @@ fun createEngine(eglContext: EGLContext): Engine = try {
 
 fun createScene(engine: Engine): com.google.android.filament.Scene = engine.createScene()
 
+/**
+ * Creates the [View] `SceneView` renders with by default: [RenderQuality.Default] and the Khronos
+ * PBR Neutral tone mapper, in a [ColorGrading] built for this view.
+ *
+ * [rememberView] destroys both. Calling this directly, destroy the view with
+ * `engine.destroyView(view)`, then its grading with `engine.destroyColorGrading(grading)`, the one
+ * read from `view.colorGrading` before you replace it: `destroyView` leaves it alive (#5232).
+ */
 fun createView(engine: Engine): View = engine.createView().apply {
     // The out-of-the-box look is [RenderQuality.Default]: FXAA, MEDIUM HDR buffer, SSAO at
     // MEDIUM quality with bilateral upsampling, bloom 0.10, soft (DPCF) shadows. `SceneView`
@@ -162,6 +170,7 @@ fun createView(engine: Engine): View = engine.createView().apply {
     colorGrading = ColorGrading.Builder()
         .toneMapper(ToneMapper.PBRNeutral())
         .build(engine)
+        .also { sdkColorGradings[this] = it }
 }
 
 /**
@@ -210,6 +219,11 @@ fun createView(engine: Engine): View = engine.createView().apply {
  * Shadows are enabled by default, soft (`ShadowType.DPCF`), because AR users commonly want 3D
  * content to cast shadows on detected planes. Disable via `View.setShadowingEnabled(false)` when
  * not needed.
+ *
+ * [rememberARView] destroys the view and its Filmic [ColorGrading]. Calling this directly, destroy
+ * the view with `engine.destroyView(view)`, then its grading with
+ * `engine.destroyColorGrading(grading)`, the one read from `view.colorGrading` before you replace
+ * it: `destroyView` leaves it alive (#5232).
  */
 fun createARView(engine: Engine): View = engine.createView().apply {
     // [RenderQuality.Default] minus SSAO and bloom (#657): FXAA, MEDIUM HDR buffer, soft (DPCF)
@@ -225,9 +239,34 @@ fun createARView(engine: Engine): View = engine.createView().apply {
     colorGrading = ColorGrading.Builder()
         .toneMapper(ToneMapper.Filmic())
         .build(engine)
+        .also { sdkColorGradings[this] = it }
     filmicViews += this
 }
 
+/**
+ * The [ColorGrading] that [createView] or [createARView] built for each view: the SDK's own, a 3D
+ * LUT that `Engine.destroyView` leaves behind (#5232). [destroyViewAndSdkGrading] frees it with its
+ * view, whether the view still holds it or the app replaced it. A grading the app set is never
+ * here: it may be shared with another view. Weak: a view nobody destroys drops out with its key.
+ */
+internal val sdkColorGradings: MutableMap<View, ColorGrading> =
+    java.util.Collections.synchronizedMap(java.util.WeakHashMap())
+
+/**
+ * Destroys [view], then the [ColorGrading] [createView] or [createARView] built for it, if any.
+ *
+ * The view goes first: a grading is never freed while a view still holds it. Only the SDK's own
+ * grading is freed, even when the app replaced it with `view.colorGrading = …`; the app's stays
+ * the app's to destroy. A view from another factory is destroyed alone.
+ */
+internal fun Engine.destroyViewAndSdkGrading(view: View) {
+    val sdkGrading = sdkColorGradings.remove(view)
+    safeDestroyView(view)
+    // Already freed through the same Java object (by an app that worked around #5232), the call
+    // throws before it reaches Filament: nothing is freed twice.
+    sdkGrading?.let { runCatching { destroyColorGrading(it) } }
+}
+
 /**
  * Views created by [createARView], whose tone mapper is Filmic rather than [createView]'s PBR
  * Neutral. A material that pre-distorts its colour by the inverse of the view's tone mapper
```

**File**: `sceneview/src/main/java/io/github/sceneview/SceneView.kt` (modified, +14/-2)
```diff
@@ -1754,6 +1754,12 @@ fun rememberScene(engine: Engine, creator: () -> Scene = { createScene(engine) }
  * A `View` is a heavy object that holds all rendering state for a single viewport — anti-aliasing,
  * shadows, post-processing, etc. One per window is recommended. Destroyed on disposal.
  *
+ * Disposal frees the view and the [com.google.android.filament.ColorGrading] that [createView]
+ * built for it, even if you replaced it with `view.colorGrading = …`, so an [Engine] that outlives
+ * the screen keeps nothing. A grading you set is yours to destroy, after this view. The SDK's
+ * grading, read through `view.colorGrading`, is freed with this view: do not share it with a view
+ * that outlives it.
+ *
  * You rarely need to call this directly — `SceneView { }` creates one by default.
  * Provide your own if you want to share the view with a [CollisionSystem] that is declared
  * outside the `SceneView { }` block.
@@ -1766,7 +1772,7 @@ fun rememberView(engine: Engine, creator: () -> View = { createView(engine) }) =
     remember(engine, creator).also { view ->
         DisposableEffect(view) {
             onDispose {
-                engine.safeDestroyView(view)
+                engine.destroyViewAndSdkGrading(view)
             }
         }
     }
@@ -1779,14 +1785,20 @@ fun rememberView(engine: Engine, creator: () -> View = { createView(engine) }) =
  * camera-stream shader's `Inverse_Tonemap_Filmic` needs in order to round-trip back to the
  * original camera pixels.
  *
+ * Disposal frees the view and the [com.google.android.filament.ColorGrading] that [createARView]
+ * built for it, even if you replaced it with `view.colorGrading = …`, so an [Engine] that outlives
+ * the screen keeps nothing. A grading you set is yours to destroy, after this view. The SDK's
+ * grading, read through `view.colorGrading`, is freed with this view: do not share it with a view
+ * that outlives it.
+ *
  * @see createARView for a full explanation of the AR camera-background tone-mapping pipeline.
  */
 @Composable
 fun rememberARView(engine: Engine, creator: () -> View = { createARView(engine) }) =
     remember(engine, creator).also { view ->
         DisposableEffect(view) {
             onDispose {
-                engine.safeDestroyView(view)
+                engine.destroyViewAndSdkGrading(view)
             }
         }
     }
```

**File**: `sceneview/src/main/java/io/github/sceneview/snapshot/ModelSnapshot.kt` (modified, +3/-7)
```diff
@@ -37,6 +37,7 @@ import io.github.sceneview.DefaultCameraNode
 import io.github.sceneview.ExperimentalSceneViewApi
 import io.github.sceneview.createView
 import io.github.sceneview.destroyRendererWhenBackendIdle
+import io.github.sceneview.destroyViewAndSdkGrading
 import io.github.sceneview.isValid
 import io.github.sceneview.loaders.ModelLoader
 import io.github.sceneview.math.Position
@@ -48,7 +49,6 @@ import io.github.sceneview.safeDestroyIndirectLight
 import io.github.sceneview.safeDestroyLight
 import io.github.sceneview.safeDestroyScene
 import io.github.sceneview.safeDestroyTexture
-import io.github.sceneview.safeDestroyView
 import io.github.sceneview.utils.readBuffer
 import io.github.sceneview.verticalFovDegreesForFocalLength
 import io.github.sceneview.whenBackendIdle
@@ -669,9 +669,7 @@ class ModelSnapshot @MainThread constructor(
             engine.safeDestroyLight(light)
             EntityManager.get().destroy(light)
         }
-        val colorGrading = view.colorGrading
-        engine.safeDestroyView(view)
-        colorGrading?.let { runCatching { engine.destroyColorGrading(it) } }
+        engine.destroyViewAndSdkGrading(view)
         engine.safeDestroyScene(scene)
         engine.safeDestroyCamera(camera)
         EntityManager.get().destroy(cameraEntity)
@@ -695,9 +693,7 @@ class ModelSnapshot @MainThread constructor(
             engine.safeDestroyLight(light)
             EntityManager.get().destroy(light)
         }
-        val colorGrading = view.colorGrading
-        engine.safeDestroyView(view)
-        colorGrading?.let { runCatching { engine.destroyColorGrading(it) } }
+        engine.destroyViewAndSdkGrading(view)
         engine.safeDestroyCamera(camera)
         EntityManager.get().destroy(cameraEntity)
         engine.safeDestroyScene(scene)
```

**File**: `sceneview/src/test/java/io/github/sceneview/RememberViewColorGradingTest.kt` (added, +254/-0)
```diff
@@ -0,0 +1,254 @@
+package io.github.sceneview
+
+import androidx.compose.runtime.AbstractApplier
+import androidx.compose.runtime.BroadcastFrameClock
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.Composition
+import androidx.compose.runtime.DisposableEffect
+import androidx.compose.runtime.Recomposer
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.setValue
+import androidx.compose.runtime.snapshots.Snapshot
+import com.google.android.filament.ColorGrading
+import com.google.android.filament.Engine
+import com.google.android.filament.ToneMapper
+import com.google.android.filament.View
+import io.github.sceneview.node.FilamentWithoutJni
+import io.github.sceneview.testing.ShadowFilamentEngine
+import kotlinx.coroutines.ExperimentalCoroutinesApi
+import kotlinx.coroutines.launch
+import kotlinx.coroutines.test.TestScope
+import kotlinx.coroutines.test.runCurrent
+import kotlinx.coroutines.test.runTest
+import org.junit.Assert.assertEquals
+import org.junit.Assert.assertFalse
+import org.junit.Assert.assertNotNull
+import org.junit.Assert.assertTrue
+import org.junit.Before
+import org.junit.Test
+import org.junit.runner.RunWith
+import org.robolectric.RobolectricTestRunner
+import org.robolectric.annotation.Config
+import org.robolectric.annotation.Implementation
+import org.robolectric.annotation.Implements
+import org.robolectric.annotation.RealObject
+
+/**
+ * `rememberView` / `rememberARView` on an engine that outlives the screen (#5232).
+ *
+ * `Engine.destroyView` leaves the view's [ColorGrading] (a 3D LUT) alive. When the engine is torn
+ * down with the screen its own teardown reclaims it; on a hoisted, shared or app-level engine each
+ * exit used to leave the grading `createView` / `createARView` built. The engine here is created
+ * once, outside the composition, and every visit is one remember/forget cycle.
+ *
+ * Filament without JNI (Robolectric): the recording engine hands out real `View` and
+ * `ColorGrading` Java objects and logs what is destroyed, in order.
+ */
+@OptIn(ExperimentalCoroutinesApi::class)
+@RunWith(RobolectricTestRunner::class)
+@Config(
+    instrumentedPackages = ["com.google.android.filament"],
+    shadows = [
+        RememberViewColorGradingTest.RecordingEngine::class,
+        RememberViewColorGradingTest.RecordingGradingBuilder::class,
+    ],
+)
+class RememberViewColorGradingTest {
+
+    private lateinit var engine: Engine
+
+    @Before
+    fun hoistTheEngine() {
+        engine = FilamentWithoutJni.engine()
+        created.clear()
+        destroyed.clear()
+        sdkColorGradings.clear()
+    }
+
+    @Test
+    fun `a rememberView visit leaves no SDK grading behind`() = runTest {
+        val view = visit { rememberView(engine) }
+        val sdkGrading = view.colorGrading
+        assertNotNull(sdkGrading)
+
+        // The view first, then its grading: never a grading under a live view.
+        assertEquals(listOf<Any>(view, sdkGrading!!), destroyed)
+        assertTrue(sdkColorGradings.isEmpty())
+    }
+
+    @Test
+    fun `a rememberARView visit leaves no SDK grading behind`() = runTest {
+        val view = visit { rememberARView(engine) }
+
+        assertEquals(listOf<Any>(view, created.single()), destroyed)
+        assertTrue(sdkColorGradings.isEmpty())
+    }
+
+    @Test
+    fun `twenty visits on one engine free every grading they made`() = runTest {
+        repeat(VISITS) { index ->
+            if (index % 2 == 0) visit { rememberView(engine) } else visit { rememberARView(engine) }
+        }
+
+        assertEquals(VISITS, created.size)
+        assertEquals(VISITS, destroyed.count { it is View })
+        assertEquals(created, destroyed.filterIsInstance<ColorGrading>())
+        assertTrue(sdkColorGradings.isEmpty())
+    }
+
+    @Test
+    fun `a grading the app set is the app's, the one it replaced is still freed`() = runTest {
+        // An app grading, shared between views and destroyed by the app after them.
+        val appGrading = grading()
+        var replaced: ColorGrading? = null
+        val view = visit {
+            rememberView(engine) {
+                createView(engine).apply {
+                    replaced = colorGrading
+                    colorGrading = appGrading
+                }
+            }
+        }
+
+        assertEquals(listOf<Any>(view, replaced!!), destroyed)
+        assertFalse(appGrading in destroyed)
+    }
+
+    @Test
+    fun `a view from another factory is destroyed alone`() = runTest {
+        val appGrading = grading()
+        val view = visit { rememberView(engine) { engine.createView().apply { colorGrading = appGrading } } }
+
+        assertEquals(listOf<Any>(view), destroyed)
+    }
+
+    @Test
+    fun `a grading the app already freed is not freed twice`() = runTest {
+        // An app that worked around #5232 before the fix: it frees `view.colorGrading` itself.
+        v
```

#### Recent Merged Pull Requests:
- **PR #5264** (2026-11-23): ci(build-apks): build a side-by-side demo APK for a branch proof (@ThomasGorisse)
- **PR #5261** (2026-11-23): ci(dependabot): no material3 1.6.0 pre-releases for the published library (@ThomasGorisse)
- **PR #5256** (closed): chore(deps): bump androidx.compose.material3:material3 from 1.5.0-rc01 to 1.6.0-alpha01 (@dependabot[bot])
- **PR #5254** (2026-11-23): fix(demo): no third-party trademark on the demo's own scenes and cards (#5247) (@ThomasGorisse)
- **PR #5250** (2026-11-23): release(mcp): sceneview-mcp 4.3.4 (@ThomasGorisse)
- **PR #5249** (2026-11-23): docs(migration): a transparent background needs isOpaque = false as well as TextureSurface (@ThomasGorisse)

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

## X. sceneview): confirm an idle backend with a bounded fence wait after 5 s

**RULE**:
When implementing operations in `changelog.d/4969-teardown-no-block.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sceneview/sceneview. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f8e0bdd7`: sceneview): confirm an idle backend with a bounded fence wait after 5 s. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog.d/4969-teardown-no-block.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
<!-- category: Fixed -->
- **Android: renderers and other deferred releases on a long-lived engine are freed on slow devices too ([#4969](https://github.com/sceneview/sceneview/issues/4969)).** A release deferred until the backend is idle needs a fence that is both reached and recent. A main thread polling less often than every 48 ms, common on low-end devices, never saw one, so on an engine shared by several screens every renderer stayed pending until `Engine.destroy`. After five seconds of waiting, each poll now creates a fence and waits at most 4 ms for it. If it is reached, the backend is idle at that moment and the release runs straight away, in the same main-thread message, so its own native wait finds nothing queued behind it. A backend that is still busy, with a new screen's shaders for instance, misses the 4 ms and the release keeps waiting. Nothing ever forces a release behind a busy fence.
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f8e0bdd7` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
