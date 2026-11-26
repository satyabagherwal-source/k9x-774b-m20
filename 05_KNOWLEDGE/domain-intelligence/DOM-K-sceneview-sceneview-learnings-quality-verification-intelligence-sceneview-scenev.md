# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: sceneview-sceneview-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "sceneview-sceneview-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T14:13:42.064Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-sceneview-sceneview-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sceneview-sceneview-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T14:13:42.064Z`  
> **Learning ID**: `LEARN-EVO-sceneview-sceneview-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), G (Architecture Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), F (Design Intelligence), B (Product Intelligence), E (Creative Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 56%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from sceneview-sceneview-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sceneview-sceneview-learnings.md`  
> **Source**: github ([https://github.com/sceneview/sceneview](https://github.com/sceneview/sceneview))  
> **Source Version**: `3adac593`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T14:13:35.646Z  
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
> **Harvest Timestamp**: 2026-11-26T14:13:35.638Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sceneview/sceneview`
- **Description**: Declarative 3D and AR for Android with Jetpack Compose, Filament and ARCore, plus web and Compose Multiplatform desktop. Open source, Apache 2.0. SwiftUI, Flutter and React Native: end of life at 4.68.0.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1388 stars

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
     * The model was placed at its authored size ([PlacementSize.RealWorld], or the default when
     * the 10 m rule does not apply) and is shown at exactly 100 % — what the user sees is the
     * object's true size.
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
    internal val usableScaleRange: ClosedFloatingPointRange<Flo
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

### Incident Patch 1: `6c866654` (2026-11-26)
**Commit Message**: fix(sceneview): a model load out of Java heap waits for abandoned loads, retries once, then fails without crashing (#5296)

* ci: rotation OOM bench on 4.73.0 with a late rotation, a larger app and a heap dump on OOM

The MAVLab retest of 4.73.0 (Android 8.0 x86_64, 16 MiB heap) still ran out of memory in
FileLoader.readFully, rotating 7-12 s after the first engine. The bench from #5273 rotated
right away, in an app with a lower baseline. It now takes a rotation delay and extra ballast,
and on an OutOfMemoryError it logs every thread's stack and dumps the heap, to read off what
still holds the first load's buffer.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(sceneview): a model read out of Java heap waits for abandoned loads, retries once, then fails without crashing

On a 16 MiB heap a rotation can leave the previous screen's cancelled load in a step that does
not suspend, still holding its whole GLB, while the new screen reads its own copy. The read now
catches the OutOfMemoryError, waits for the abandoned loads to end (ModelLoadsInFlight), reads
once more, and otherwise logs the failure and returns null. The abandoned load checks for
cancellation between preparing 

**File**: `.github/workflows/model-load-rotation-oom.yml` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+name: Model load OOM on rotation (Android 8+ emulators)
+
+# Proof for #5271 on real x86_64 emulators with a small ART heap (dalvik.vm.heapgrowthlimit),
+# which arm64 hosts cannot run for API 26-28. Not a required check: it only runs
+# when its own files change, or by hand.
+on:
+  pull_request:
+    paths:
+      - .github/workflows/model-load-rotation-oom.yml
+      - tools/model-load-rotation-oom/**
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+concurrency:
+  group: model-load-rotation-oom-${{ github.ref }}
+  cancel-in-progress: true
+
+env:
+  # Third-party asset from the public MAVLab report (Labs-Ascend/MAVLab). Fetched at run time, never committed.
+  DRONE_URL: https://raw.githubusercontent.com/Labs-Ascend/MAVLab/843fefe3fe58345609282ec4c548c811a44ac659/mavlab-android/app/src/main/assets/models/drone.glb
+  DRONE_BYTES: "5794580"
+
+jobs:
+  build:
+    name: Build repro APKs (4.73.0, this branch)
+    runs-on: ubuntu-latest
+    timeout-minutes: 40
+    steps:
+      - uses: actions/checkout@v7
+      - uses: ./.github/actions/setup-gradle
+
+      # The root build signs every publication, mavenLocal included. A throwaway key made
+      # here, used once and never stored, lets that signing run without any repository secret.
+      - name: Make a throwaway signing key
+        run: |
+          export GNUPGHOME="$RUNNER_TEMP/gnupg"; mkdir -p "$GNUPGHOME" && chmod 700 "$GNUPGHOME"
+          gpg --batch --passphrase '' --quick-gen-key "CI throwaway <ci@invalid>" rsa2048 sign 1d
+          {
+            echo "ORG_GRADLE_PROJECT_signingInMemoryKey<<KEY_EOF"
+            gpg --batch --armor --export-secret-keys
+            echo "KEY_EOF"
+          } >> "$GITHUB_ENV"
+
+      # `branch` is this checkout's sceneview; its sceneview-core is the release it is based on.
+      - name: Publish this branch's sceneview to mavenLocal as <VERSION_NAME>-branch
+        run: |
+          base=$(grep '^VERSION_NAME=' gradle.properties | cut -d= -f2)
+          echo "BASE_VERSION=$base" >> "$GITHUB_ENV"
+          ./gradlew :sceneview:publishToMavenLocal -PVERSION_NAME=$base-branch -PsigningInMemoryKeyPassword= --no-configuration-cache --stacktrace
+
+      - name: Fetch drone.glb
+        working-directory: tools/model-load-rotation-oom
+        run: |
+          mkdir -p app/src/main/assets/models
+          curl -fsSL -o app/src/main/assets/models/drone.glb "$DRONE_URL"
+          size=$(stat -c %s app/src/main/assets/models/drone.glb)
+          echo "drone.glb: $size bytes"
+          test "$size" = "$DRONE_BYTES"
+
+      - name: Assemble one APK per version
+        working-directory: tools/model-load-rotation-oom
+        run: |
+          mkdir -p apks
+          # 4.73.0 is the release the MAVLab retest crashed on (25/11).
+          ./gradlew :app:assembleDebug -Psv=4.73.0 --stacktrace
+          cp app/build/outputs/apk/debug/app-debug.apk apks/mavlab-repro-4.73.0.apk
+          ./gradlew :app:assembleDebug -Psv=$BASE_VERSION-branch -Pcore=$BASE_VERSION --stacktrace
+          cp app/build/outputs/apk/debug/app-debug.apk apks/mavlab-repro-branch.apk
+          ls -l apks
+
+      - uses: actions/upload-artifact@v7
+        with:
+          name: repro-apks
+          path: tools/model-load-rotation-oom/apks/
+          retention-days: 7
+
+  emulator:
+    name: API ${{ matrix.api }}, heap ${{ matrix.heap }} MiB, extra ${{ matrix.extra }} MiB, churn ${{ matrix.churn }} MiB/s
+    needs: build
+    runs-on: ubuntu-latest
+    timeout-minutes: 75
+    strategy:
+      fail-fast: false
+      matrix:
+        # The MAVLab retest of 4.73.0 rotated 7-12 s after the first engine, while its drone took
+        # 60-72 s to load. Here the drone shows within ~1 s, so the delays sit inside that second to
+        # land the rotation mid-load; the ballast and churn stand in for MAVLab's fuller heap.
+        include:
+          - { api: 26, heap: 16, versions: "4.73.0 branch", delays: "0.2 0.4 0.6", extra: 5, churn: 4 }
+          - { api: 26, heap: 16, versions: "4.73.0 branch", delays: "0.2 0.4 0.6", extra: 6, churn: 4 }
+          - { api: 26, heap: 16, versions: "4.73.0 branch", delays: "0.2 0.4 0.6", extra: 5, churn: 8 }
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          sparse-checkout: tools/model-load-rotation-oom
+
+      - uses: actions/download-artifact@v7
+        with:
+          name: repro-apks
+          path: apks
+
+      - name: Enable KVM
+        run: |
+          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
+          sudo udevadm control --reload-rules
+          sudo udevadm trigger --name-match=kvm
+
+      - name: Trials on the emulator
+        uses: ReactiveCircus/android-emulator-runner@v2
+        with:
+          api-level: ${{ matrix.api }}
+          target: ${{ matrix.target || 'google_apis' }}
+          arch: x86_64
+          # swiftshader_indir
```

**File**: `changelog.d/5271-late-rotation-oom.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+<!-- category: Fixed -->
+- A model load that runs out of Java heap while reading its file no longer crashes the app. It waits for the loads abandoned by a rotation to end, reads once more, and if the heap still has no room it logs the failure and the model does not show. An abandoned load also stops sooner and no longer keeps the whole GLB reachable while gltfio begins its resources (#5271, reported on Android 8 with a 16 MiB heap).
```

**File**: `sceneview/src/main/java/io/github/sceneview/loaders/ModelLoader.kt` (modified, +89/-8)
```diff
@@ -561,10 +561,28 @@ class ModelLoader(
         onUnreadable: (RuntimeException) -> Unit = {},
         unit: ModelUnit? = null,
         onLoadBegun: (Model) -> R,
+    ): R? = ModelLoadsInFlight.track {
+        loadModelThenTracked(
+            fileLocation, resourceResolver, create, onProgress, onDestroyedMeanwhile,
+            onUnsupported, onRefused, onUnreadable, unit, onLoadBegun,
+        )
+    }
+
+    /** The body of [loadModelThen], registered in [ModelLoadsInFlight] while it runs. */
+    private suspend fun <R : Any> loadModelThenTracked(
+        fileLocation: String,
+        resourceResolver: (resourceFileName: String) -> String,
+        create: (Buffer) -> Model?,
+        onProgress: ((ModelLoadProgress) -> Unit)?,
+        onDestroyedMeanwhile: () -> Unit,
+        onUnsupported: (UnsupportedGltfExtensionException) -> Unit,
+        onRefused: (GltfLimitException) -> Unit,
+        onUnreadable: (RuntimeException) -> Unit,
+        unit: ModelUnit?,
+        onLoadBegun: (Model) -> R,
     ): R? {
         onProgress?.invoke(ModelLoadProgress(Stage.Reading, 0f))
-        val buffer = FileLoader.loadFileBuffer(
-            context,
+        val buffer = readModelFile(
             fileLocation,
             onProgress?.let { report -> { read: Float -> report(ModelLoadProgress(Stage.Reading, READING_END * read)) } },
         ) ?: run {
@@ -580,11 +598,17 @@ class ModelLoader(
         // decodes and re-encodes images, and the limits check parses the JSON: all stay off the
         // main thread. The extension check runs first, so its typed refusal comes before any other.
         val (source, gltf) = try {
-            withContext(Dispatchers.Default) {
-                // The loader read these bytes itself: nobody else holds them.
-                buffer.toFilamentModelSource(fileLocation, unit, onUnsupported, ownsSource = true)
-                    .let { it to GltfLimits.parse(it.buffer) }
-            }
+            // A GLB that has to be copied to drop an extension (see GltfMaterialCompatibility) needs
+            // a second array of its size: the same heap as the read, the same recovery.
+            afterAbandonedLoadsOnOutOfMemory(fileLocation, "prepare") {
+                withContext(Dispatchers.Default) {
+                    // The loader read these bytes itself: nobody else holds them.
+                    val prepared = buffer.toFilamentModelSource(fileLocation, unit, onUnsupported, ownsSource = true)
+                    // Neither step suspends: an abandoned load would otherwise run both, holding the file.
+                    ensureActive()
+                    prepared to GltfLimits.parse(prepared.buffer)
+                }
+            } ?: return null
         } catch (unreadable: RuntimeException) {
             // An unsupported format, or a file its extension sent to a converter that cannot parse
             // it (an HTML error page saved as `.stl`): logged, then the result is `null`.
@@ -657,6 +681,9 @@ class ModelLoader(
                     val loaded = resources.toMap()
                     gltf.restPoseBounds(loaded::get) to gltf.animationData(loaded::get)
                 }
+                // Read now, detached: the Main block below then holds neither `gltf` nor `source`,
+                // which both keep the whole GLB (its BIN chunk included) reachable (#5271).
+                val emissiveStrengths = gltf.emissiveStrengths()
                 if (resources.isNotEmpty()) {
                     // The converted bytes (a PNG for an external WebP image), as gltfio gets them.
                     val loaded = resources.toMap()
@@ -694,7 +721,7 @@ class ModelLoader(
                         )
                     }
                     // The authored glow AR scales from (#4950): Filament cannot read it back.
-                    EmissiveScale.record(model, gltf.emissiveStrengths())
+                    EmissiveScale.record(model, emissiveStrengths)
                     RestPoseBounds.record(model, restPose)
                     AnimationEnvelopes.record(model, animationData)
                     onLoadBegun(model)
@@ -706,6 +733,57 @@ class ModelLoader(
         }
     }
 
+    /**
+     * Reads [fileLocation] for [loadModelThen], with the recovery of [afterAbandonedLoadsOnOutOfMemory].
+     */
+    private suspend fun readModelFile(fileLocation: String, onRead: ((Float) -> Unit)?): Buffer? =
+        afterAbandonedLoadsOnOutOfMemory(fileLocation, "read") {
+            FileLoader.loadFileBuffer(context, fileLocation, onRead)
+        }
+
+    /**
+     * Runs [step], one of the large allocations of a load ([what]: reading the file, or copying
+     * it). When the Java heap has no room for it, as on a 16 MiB Android 8 heap while the previous
+     * screen's abandoned load still holds its own copy (#5271), it waits for the abandoned loads
+     * to end, then runs [step] once more. A second failure is logged and the load fails (`null`):
+     * 
```

**File**: `sceneview/src/main/java/io/github/sceneview/loaders/ModelLoadsInFlight.kt` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+package io.github.sceneview.loaders
+
+import kotlinx.coroutines.CompletableDeferred
+import kotlinx.coroutines.Job
+import kotlinx.coroutines.currentCoroutineContext
+import kotlinx.coroutines.withTimeoutOrNull
+import java.util.Collections
+
+/**
+ * The model loads running in this process, so that a load which runs out of Java heap can wait
+ * for the ones already abandoned before it tries again (#5271).
+ *
+ * A cancelled load stops at its next suspension point. A step that does not suspend (a JSON
+ * parse, a GLB rewrite on `Dispatchers.Default`) still runs to its end first, and holds the whole
+ * file meanwhile. On a rotation that is the old screen's load, next to the new screen's own copy:
+ * on a 16 MiB heap, two copies of a 5.8 MB model do not fit.
+ */
+internal object ModelLoadsInFlight {
+    private class Entry(val job: Job?) {
+        val done = CompletableDeferred<Unit>()
+    }
+
+    private val entries: MutableSet<Entry> = Collections.synchronizedSet(LinkedHashSet())
+
+    /** Runs one load, registered as in flight until [block] returns or throws. */
+    suspend fun <T> track(block: suspend () -> T): T {
+        val entry = Entry(currentCoroutineContext()[Job])
+        entries += entry
+        try {
+            return block()
+        } finally {
+            entries -= entry
+            entry.done.complete(Unit)
+        }
+    }
+
+    /** How many loads are cancelled but still running (their file still held). */
+    val abandonedCount: Int get() = synchronized(entries) { entries.count { it.job?.isCancelled == true } }
+
+    /**
+     * Waits up to [timeoutMillis] for every load that was cancelled but is still running to end.
+     * `true` when none is left.
+     */
+    suspend fun awaitAbandoned(timeoutMillis: Long): Boolean {
+        val abandoned = synchronized(entries) { entries.filter { it.job?.isCancelled == true } }
+        if (abandoned.isEmpty()) return true
+        return withTimeoutOrNull(timeoutMillis) { abandoned.forEach { it.done.await() } } != null
+    }
+}
```

**File**: `sceneview/src/test/java/io/github/sceneview/loaders/ModelLoadsInFlightTest.kt` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+package io.github.sceneview.loaders
+
+import kotlinx.coroutines.CompletableDeferred
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.NonCancellable
+import kotlinx.coroutines.launch
+import kotlinx.coroutines.runBlocking
+import kotlinx.coroutines.withContext
+import kotlinx.coroutines.yield
+import org.junit.Assert.assertEquals
+import org.junit.Assert.assertFalse
+import org.junit.Assert.assertTrue
+import org.junit.Test
+
+class ModelLoadsInFlightTest {
+
+    @Test
+    fun `nothing abandoned returns at once`() = runBlocking {
+        assertTrue(ModelLoadsInFlight.awaitAbandoned(timeoutMillis = 1))
+    }
+
+    @Test
+    fun `a running load that was not cancelled is not waited for`() = runBlocking {
+        val inStep = CompletableDeferred<Unit>()
+        val release = CompletableDeferred<Unit>()
+        val load = launch(Dispatchers.Default) {
+            ModelLoadsInFlight.track { inStep.complete(Unit); release.await() }
+        }
+        inStep.await()
+        assertEquals(0, ModelLoadsInFlight.abandonedCount)
+        assertTrue(ModelLoadsInFlight.awaitAbandoned(timeoutMillis = 1))
+        release.complete(Unit)
+        load.join()
+    }
+
+    @Test
+    fun `a cancelled load still in a step that does not suspend is waited for until it ends`() = runBlocking {
+        val inStep = CompletableDeferred<Unit>()
+        val release = CompletableDeferred<Unit>()
+        val load = launch(Dispatchers.Default) {
+            ModelLoadsInFlight.track {
+                // Stands in for a parse on Dispatchers.Default: cancellation cannot stop it midway.
+                withContext(NonCancellable) { inStep.complete(Unit); release.await() }
+            }
+        }
+        inStep.await()
+        load.cancel()
+        yield()
+        assertEquals(1, ModelLoadsInFlight.abandonedCount)
+        // Still in its step: a short wait times out.
+        assertFalse(ModelLoadsInFlight.awaitAbandoned(timeoutMillis = 50))
+        launch { release.complete(Unit) }
+        assertTrue(ModelLoadsInFlight.awaitAbandoned(timeoutMillis = 5_000))
+        load.join()
+        assertEquals(0, ModelLoadsInFlight.abandonedCount)
+    }
+
+    @Test
+    fun `a load that throws leaves the registry`() = runBlocking {
+        val failure = runCatching { ModelLoadsInFlight.track<Unit> { error("unreadable") } }
+        assertTrue(failure.isFailure)
+        assertEquals(0, ModelLoadsInFlight.abandonedCount)
+        assertTrue(ModelLoadsInFlight.awaitAbandoned(timeoutMillis = 1))
+    }
+
+    @Test
+    fun `a cancelled scope with no load in flight waits for nothing`() = runBlocking {
+        val scopeJob = launch { ModelLoadsInFlight.track { } }
+        scopeJob.join()
+        scopeJob.cancel()
+        assertTrue(ModelLoadsInFlight.awaitAbandoned(timeoutMillis = 1))
+    }
+}
```

**File**: `tools/model-load-rotation-oom/.gitignore` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+build/
+.gradle/
+local.properties
+app/src/main/assets/models/
+/apks/
+/results/
```

**File**: `tools/model-load-rotation-oom/README.md` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+# Model load out of memory on rotation: emulator repro
+
+Reproduces the report behind #5271: on SceneView 4.72.0, rotating an Android 8.0 device with a
+16 MiB ART heap while a model loads ends in `OutOfMemoryError` (in `FileLoader.readFully` or
+`GltfMaterialCompatibility.prepare`), while 4.16.10 renders.
+
+The app is a minimal copy of the reporter's scene: `rememberEngine` + `rememberModelLoader` + one
+`rememberModelInstance("models/drone.glb")`, in an activity recreated on rotation.
+
+## Model
+
+`drone.glb` (5,794,580 bytes) is a third-party asset from the public report
+(`Labs-Ascend/MAVLab` at `843fefe3fe58345609282ec4c548c811a44ac659`). It is fetched at run time and
+never committed (`app/src/main/assets/models/` is ignored):
+
+    curl -L -o app/src/main/assets/models/drone.glb https://raw.githubusercontent.com/Labs-Ascend/MAVLab/843fefe3fe58345609282ec4c548c811a44ac659/mavlab-android/app/src/main/assets/models/drone.glb
+
+## Build
+
+    ./gradlew :app:assembleDebug -Psv=4.72.0          # from Maven Central
+    # the fix: from the repo root on the #5271 branch
+    ./gradlew :sceneview:publishToMavenLocal -PVERSION_NAME=4.72.0-oomfix   # needs a signing key, see the workflow
+    ./gradlew :app:assembleDebug -Psv=4.72.0-oomfix
+
+Only `io.github.sceneview:sceneview` takes `-Psv`; the other SceneView artifacts stay on 4.72.0.
+
+## Run
+
+    ./run-trial.sh <apk> <budgetMiB> <out.txt> [waitSeconds]
+
+`budgetMiB > 0` holds ballast so that only that much Java heap is left, to simulate a small heap on
+any emulator. `0` uses the emulator's own limit (`adb root; adb shell setprop dalvik.vm.heapgrowthlimit 16m`,
+then `adb shell stop; adb shell start`, as `ci-trials.sh` does). The script
+prints one line: OOM count, first app frame of the OOM, drain time of the old engine, when the model
+became visible for each activity, and peak heap.
+
+## CI
+
+`.github/workflows/model-load-rotation-oom.yml` builds the three APKs, then runs three trials per
+version on x86_64 emulators (API 26 to 29, 16 MiB heap; API 26 at 24 and 32 MiB with 4.72.0 to find
+the threshold). Results are in each job's summary and in the `oom-api*-heap*` artifacts. An
+out-of-memory error is a result, not a job failure.
```

**File**: `tools/model-load-rotation-oom/app/build.gradle` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+plugins {
+    id "com.android.application"
+    id "org.jetbrains.kotlin.android"
+    id "org.jetbrains.kotlin.plugin.compose"
+}
+def sv = project.findProperty("sv") ?: "4.72.0"
+// The other SceneView artifacts (sceneview-core): -Pcore, else the release sv names.
+def core = project.findProperty("core") ?: sv
+android {
+    namespace "repro.mavlab"
+    compileSdk 37
+    defaultConfig { applicationId "repro.mavlab"; minSdk 26; targetSdk 36; versionCode 1; versionName sv }
+    buildFeatures { compose true }
+}
+kotlin { jvmToolchain(17) }
+dependencies {
+    implementation "io.github.sceneview:sceneview:$sv"
+    implementation platform("androidx.compose:compose-bom:2026.09.00")
+    implementation "androidx.compose.foundation:foundation"
+    implementation "androidx.activity:activity-compose:1.13.0"
+}
+configurations.configureEach {
+    resolutionStrategy.eachDependency { d ->
+        if (d.requested.group == "io.github.sceneview" && d.requested.name != "sceneview") d.useVersion core
+    }
+}
```

---

### Incident Patch 2: `707504a6` (2026-11-25)
**Commit Message**: fix(sceneview): a model load no longer runs a small heap out of memory on rotation (#5271) (#5271)

A GLB using KHR_materials_specular, volume or dispersion was copied whole by
GltfMaterialCompatibility right after it was read: on Android a direct buffer is
a Java-heap array, so the load needed twice the file in heap. On a rotation the
abandoned load of the old screen also kept reading next to the new one, since the
deferred engine teardown (#3799) no longer blocks the main thread in between.
A 5.8 MB GLB ran out of memory on an Android 8 emulator with a 16 MiB heap.

- The loader owns the bytes it read: the JSON chunk is rewritten in place, padded
  with spaces, header and BIN untouched. A caller's buffer is still copied.
- A cancelled load stops between 64 KB chunks and before the conversions.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `changelog.d/5271-model-load-rotation-oom.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+<!-- category: Fixed -->
+- **A model load no longer runs a small heap out of memory when the screen rotates ([#5271](https://github.com/sceneview/sceneview/pull/5271)).** A GLB using `KHR_materials_specular`, `KHR_materials_volume` or `KHR_materials_dispersion` was copied whole right after it was read, and on Android that copy is Java heap, so a load needed twice the file. The JSON is now rewritten in place in the bytes the loader read, and a load cancelled by a rotation stops reading instead of running next to the new screen's load. A 5.8 MB model whose load a rotation used to kill with only 12 MiB of free heap now renders.
```

**File**: `sceneview/src/main/java/io/github/sceneview/loaders/GltfMaterialCompatibility.kt` (modified, +29/-1)
```diff
@@ -33,7 +33,17 @@ internal object GltfMaterialCompatibility {
         }
     }
 
-    fun prepare(source: Buffer): Buffer {
+    /**
+     * [source] with the unsupported extensions removed. When [ownsSource] is `true` (the loader
+     * read the file itself, so nobody else holds these bytes) and the rewritten JSON fits in the
+     * old one, the JSON is rewritten in place and padded with spaces: a 5.8 MB GLB no longer needs
+     * a second 5.8 MB copy right after it was read. On Android a direct buffer is a Java-heap
+     * array, so that copy doubled the heap a load needed and ran a 16 MiB heap out of memory on a
+     * rotation (#5271). Dropping extensions shrinks the JSON, but `org.json` rewrites numbers
+     * (`1e9` becomes `1000000000`), so a minified file can grow: it then gets the copy. A buffer
+     * the caller owns is never written to, and gets the copy as before.
+     */
+    fun prepare(source: Buffer, ownsSource: Boolean = false): Buffer {
         val bytes = (source as? ByteBuffer)?.duplicate()?.order(ByteOrder.LITTLE_ENDIAN) ?: return source
         val text = GltfBufferUris.jsonText(bytes) ?: return source
         // The common case: no affected extension, nothing parsed, the caller's buffer as is.
@@ -62,11 +72,20 @@ internal object GltfMaterialCompatibility {
         }
         val encoded = unescapeSlashes(json.toString()).toByteArray(Charsets.UTF_8)
         val start = bytes.position()
+        val writable = ownsSource && !bytes.isReadOnly
         if (bytes.remaining() < 20 || bytes.getInt(start) != 0x46546C67) {
+            // A .gltf: the JSON is the whole buffer. Trailing spaces are valid JSON.
+            if (writable && encoded.size <= bytes.remaining()) {
+                return source.also { overwrite(bytes, start, encoded, bytes.remaining()) }
+            }
             return ByteBuffer.allocateDirect(encoded.size).put(encoded).apply { flip() }
         }
         // Preserve every trailing chunk byte for byte, including BIN padding and unknown chunks.
         val oldJsonLength = bytes.getInt(start + 12)
+        // Same JSON chunk length: the header, the BIN chunk and every offset stay as they are.
+        if (writable && encoded.size <= oldJsonLength) {
+            return source.also { overwrite(bytes, start + 20, encoded, oldJsonLength) }
+        }
         val tail = bytes.duplicate().apply { position(start + 20 + oldJsonLength) }
         val paddedLength = (encoded.size + 3) and -4
         return ByteBuffer.allocateDirect(20 + paddedLength + tail.remaining())
@@ -82,4 +101,13 @@ internal object GltfMaterialCompatibility {
                 flip()
             }
     }
+
+    /** Writes [encoded] at [at] and pads it with spaces up to [length] bytes, without moving [bytes]. */
+    private fun overwrite(bytes: ByteBuffer, at: Int, encoded: ByteArray, length: Int) {
+        bytes.duplicate().apply {
+            position(at)
+            put(encoded)
+            repeat(length - encoded.size) { put(0x20.toByte()) }
+        }
+    }
 }
```

**File**: `sceneview/src/main/java/io/github/sceneview/loaders/ModelLoader.kt` (modified, +17/-3)
```diff
@@ -54,7 +54,9 @@ import kotlinx.coroutines.SupervisorJob
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.cancelChildren
 import kotlinx.coroutines.coroutineScope
+import kotlinx.coroutines.currentCoroutineContext
 import kotlinx.coroutines.delay
+import kotlinx.coroutines.ensureActive
 import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.flow.filterNotNull
 import kotlinx.coroutines.isActive
@@ -569,13 +571,19 @@ class ModelLoader(
             Log.w(TAG, "Could not read $fileLocation")
             return null
         }
+        // A load abandoned while it read (its screen rotated away) stops here and frees the file,
+        // rather than holding it through the conversions next to the new screen's load (#5271).
+        // `loadFileBuffer`'s own `withContext` already throws on return; this states it.
+        currentCoroutineContext().ensureActive()
         onProgress?.invoke(ModelLoadProgress(Stage.Creating, READING_END))
         // The extension check scans the JSON of what can be a 60 MB generated model, transcoding
         // decodes and re-encodes images, and the limits check parses the JSON: all stay off the
         // main thread. The extension check runs first, so its typed refusal comes before any other.
         val (source, gltf) = try {
             withContext(Dispatchers.Default) {
-                buffer.toFilamentModelSource(fileLocation, unit, onUnsupported).let { it to GltfLimits.parse(it.buffer) }
+                // The loader read these bytes itself: nobody else holds them.
+                buffer.toFilamentModelSource(fileLocation, unit, onUnsupported, ownsSource = true)
+                    .let { it to GltfLimits.parse(it.buffer) }
             }
         } catch (unreadable: RuntimeException) {
             // An unsupported format, or a file its extension sent to a converter that cannot parse
@@ -2002,16 +2010,22 @@ private fun Buffer.toFilamentModelSource(
     fileName: String? = null,
     unit: ModelUnit? = null,
     onUnsupported: (UnsupportedGltfExtensionException) -> Unit = ::logUnsupported,
+    ownsSource: Boolean = false,
 ): FilamentModelSource {
     val converted = toModelGlb(fileName, unit)
     // Before the transcode: a model refused here is not worth decoding its images.
     GltfRequiredExtensions.unsupported(converted)
         .takeIf { it.isNotEmpty() }
         ?.let { onUnsupported(UnsupportedGltfExtensionException(it)) }
+    // A buffer this function made (a converted mesh, a transcoded GLB) is nobody else's either:
+    // the material fix may rewrite it in place instead of copying it.
+    val source = this
+    fun prepare(buffer: Buffer) =
+        GltfMaterialCompatibility.prepare(buffer, ownsSource = ownsSource || buffer !== source)
     return (converted as? ByteBuffer)
         ?.let { WebPTextureTranscoder.transcodeModel(it) }
-        ?.let { FilamentModelSource(GltfMaterialCompatibility.prepare(it.buffer), it.externalWebP) }
-        ?: FilamentModelSource(GltfMaterialCompatibility.prepare(converted), emptySet())
+        ?.let { FilamentModelSource(prepare(it.buffer), it.externalWebP) }
+        ?: FilamentModelSource(prepare(converted), emptySet())
 }
 
 /**
```

**File**: `sceneview/src/main/java/io/github/sceneview/utils/File.kt` (modified, +18/-4)
```diff
@@ -9,6 +9,7 @@ import androidx.annotation.RawRes
 import com.github.kittinunf.fuel.core.FuelManager
 import com.github.kittinunf.fuel.coroutines.awaitByteArray
 import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.ensureActive
 import kotlinx.coroutines.withContext
 import java.io.File
 import java.io.InputStream
@@ -60,8 +61,10 @@ object FileLoader {
                         .awaitByteArray()
                 }
 
+                // Checked between chunks: a load abandoned mid-read (its screen rotated away)
+                // stops reading and frees the array instead of finishing a file nobody will use.
                 else -> {
-                    readFileBuffer(context, fileLocation, onProgress)
+                    readFileBuffer(context, fileLocation, onProgress, checkCancelled = { ensureActive() })
                 }
             }
         }
@@ -80,7 +83,12 @@ object FileLoader {
         readFileBuffer(context, fileLocation, onProgress = null)
 
     // Each stream is read into one array of its size (see `readFully`), not grown then copied.
-    internal fun readFileBuffer(context: Context, fileLocation: String, onProgress: ((Float) -> Unit)?): ByteBuffer? {
+    internal fun readFileBuffer(
+        context: Context,
+        fileLocation: String,
+        onProgress: ((Float) -> Unit)?,
+        checkCancelled: (() -> Unit)? = null,
+    ): ByteBuffer? {
         val uri = Uri.parse(fileLocation)
         val stream = when (uri.scheme) {
             ContentResolver.SCHEME_FILE -> localFileStream(context, uri)
@@ -100,7 +108,7 @@ object FileLoader {
 
             else -> context.assets.open(fileLocation)
         }
-        return stream?.use { it.readFully(onProgress = onProgress) }?.let { byteArray ->
+        return stream?.use { it.readFully(onProgress = onProgress, checkCancelled = checkCancelled) }?.let { byteArray ->
             ByteBuffer.wrap(byteArray)
         }
     }
@@ -167,9 +175,14 @@ private const val READ_CHUNK = 64 * 1024
  * held 100 MB of Java heap. A wrong hint still reads everything, at the cost of one copy.
  *
  * [onProgress] gets the fraction read so far, after each chunk, when [sizeHint] is known (> 0).
+ * [checkCancelled] runs after each chunk and stops the read by throwing.
  * Does not close the stream.
  */
-internal fun InputStream.readFully(sizeHint: Int = available(), onProgress: ((Float) -> Unit)? = null): ByteArray {
+internal fun InputStream.readFully(
+    sizeHint: Int = available(),
+    onProgress: ((Float) -> Unit)? = null,
+    checkCancelled: (() -> Unit)? = null,
+): ByteArray {
     val expected = sizeHint.coerceAtLeast(0)
     var buffer = ByteArray(if (expected > 0) expected else DEFAULT_BUFFER_SIZE)
     var size = 0
@@ -185,6 +198,7 @@ internal fun InputStream.readFully(sizeHint: Int = available(), onProgress: ((Fl
         if (n < 0) break
         size += n
         if (onProgress != null && expected > 0) onProgress(minOf(1f, size.toFloat() / expected))
+        checkCancelled?.invoke()
     }
     return if (size == buffer.size) buffer else buffer.copyOf(size)
 }
```

**File**: `sceneview/src/test/java/io/github/sceneview/loaders/GltfMaterialCompatibilityTest.kt` (modified, +84/-0)
```diff
@@ -77,6 +77,90 @@ class GltfMaterialCompatibilityTest {
             .getJSONObject("extensions").has("KHR_materials_volume"))
     }
 
+    /** A GLB with [json] as its JSON chunk and a 12-byte BIN chunk, the way a file reads from disk. */
+    private fun glb(json: String = this.json): ByteBuffer {
+        val encoded = json.toByteArray()
+        val padded = (encoded.size + 3) and -4
+        return ByteBuffer.allocate(20 + padded + 20).order(ByteOrder.LITTLE_ENDIAN).apply {
+            putInt(0x46546C67); putInt(2); putInt(capacity())
+            putInt(padded); putInt(0x4E4F534A); put(encoded)
+            repeat(padded - encoded.size) { put(32.toByte()) }
+            putInt(12); putInt(0x004E4942); putInt(0x12345678); putInt(0x0BADF00D); putInt(-1)
+            flip()
+        }
+    }
+
+    @Test
+    fun an_owned_glb_is_rewritten_in_place_without_a_second_copy() {
+        // A 5.8 MB GLB with KHR_materials_specular: the copy doubled the Java heap a load needed
+        // (a direct buffer is a Java array on ART) and ran a 16 MiB heap out of memory (#5271).
+        val source = glb()
+        val before = source.duplicate().order(ByteOrder.LITTLE_ENDIAN)
+        val jsonLength = before.getInt(12)
+        val prepared = GltfMaterialCompatibility.prepare(source, ownsSource = true) as ByteBuffer
+        assertSame(source, prepared)
+        assertEquals(0, prepared.position())
+        val glb = prepared.duplicate().order(ByteOrder.LITTLE_ENDIAN)
+        // Header, chunk lengths and the BIN chunk are untouched: only the JSON text changed.
+        assertEquals(glb.capacity(), glb.getInt(8))
+        assertEquals(jsonLength, glb.getInt(12))
+        val bin = 20 + jsonLength
+        assertEquals(12, glb.getInt(bin))
+        assertEquals(0x004E4942, glb.getInt(bin + 4))
+        assertEquals(0x12345678, glb.getInt(bin + 8))
+        assertEquals(0x0BADF00D, glb.getInt(bin + 12))
+        assertEquals(-1, glb.getInt(bin + 16))
+        val text = GltfBufferUris.jsonText(glb)!!
+        val result = JSONObject(text)
+        val extensions = result.getJSONArray("materials").getJSONObject(0).getJSONObject("extensions")
+        assertFalse(extensions.has("KHR_materials_volume"))
+        assertFalse(extensions.has("KHR_materials_specular"))
+        assertTrue(extensions.has("KHR_materials_transmission"))
+        assertTrue("cgltf must see a literal slash in mimeType", text.contains("image/png"))
+        // Idempotent: a second pass finds nothing to drop and returns the buffer as it is.
+        assertSame(prepared, GltfMaterialCompatibility.prepare(prepared, ownsSource = true))
+    }
+
+    @Test
+    fun an_owned_gltf_is_rewritten_in_place_and_padded_with_spaces() {
+        val source = ByteBuffer.wrap(json.toByteArray())
+        val prepared = GltfMaterialCompatibility.prepare(source, ownsSource = true) as ByteBuffer
+        assertSame(source, prepared)
+        assertEquals(json.toByteArray().size, prepared.remaining())
+        val result = JSONObject(GltfBufferUris.jsonText(prepared.duplicate().order(ByteOrder.LITTLE_ENDIAN))!!)
+        assertFalse(result.has("extensionsRequired"))
+    }
+
+    @Test
+    fun a_buffer_the_caller_owns_is_never_written_to() {
+        val source = glb()
+        val original = ByteArray(source.remaining()).also { source.duplicate().get(it) }
+        val prepared = GltfMaterialCompatibility.prepare(source) as ByteBuffer
+        assertTrue(prepared !== source)
+        val after = ByteArray(source.remaining()).also { source.duplicate().get(it) }
+        assertTrue(original.contentEquals(after))
+        // Read-only, even when the loader says it owns it: copied, not written.
+        val readOnly = glb().asReadOnlyBuffer()
+        assertTrue(GltfMaterialCompatibility.prepare(readOnly, ownsSource = true) !== readOnly)
+    }
+
+    @Test
+    fun json_that_grows_past_its_chunk_falls_back_to_a_copy() {
+        // Re-serialising can lengthen a number: 1e9 is written 1000000000. No room left in place.
+        val numbers = List(40) { "1e9" }.joinToString(",")
+        val grown = """{"asset":{"version":"2.0"},"extras":{"n":[$numbers]},""" +
+            """"materials":[{"extensions":{"KHR_materials_specular":{}}}]}"""
+        val source = glb(grown)
+        val prepared = (GltfMaterialCompatibility.prepare(source, ownsSource = true) as ByteBuffer)
+            .order(ByteOrder.LITTLE_ENDIAN)
+        assertTrue(prepared !== source)
+        assertTrue(prepared.isDirect)
+        assertEquals(prepared.remaining(), prepared.getInt(8))
+        val result = JSONObject(GltfBufferUris.jsonText(prepared.duplicate().order(ByteOrder.LITTLE_ENDIAN))!!)
+        assertFalse(result.getJSONArray("materials").getJSONObject(0)
+            .getJSONObject("extensions").has("KHR_materials_specular"))
+    }
+
     @Test
     fun unaffected_payload_is_returned_without_copying() {
         val source = ByteBuffer.wrap("""{"asset":{"version":"2.0"}}""".toByteArray(
```

**File**: `sceneview/src/test/java/io/github/sceneview/utils/ReadFullyTest.kt` (modified, +11/-0)
```diff
@@ -44,6 +44,17 @@ class ReadFullyTest {
         assertSame(stream.arrays.single(), read)
     }
 
+    @Test
+    fun `a cancelled read stops after the chunk it was on`() {
+        // A load abandoned mid-read (its screen rotated away) must not finish a file nobody uses.
+        val stream = Chunked(bytes, hint = bytes.size)
+        var chunks = 0
+        assertThrows(IllegalStateException::class.java) {
+            stream.readFully(checkCancelled = { if (++chunks == 2) throw IllegalStateException("cancelled") })
+        }
+        assertEquals(2, chunks)
+    }
+
     @Test
     fun `a hint too small still reads everything`() {
         assertArrayEquals(bytes, Chunked(bytes, hint = 1000).readFully())
```

---

### Incident Patch 3: `65c8eddd` (2026-11-26)
**Commit Message**: fix(sceneview): warn when two ModelNodes share one ModelInstance; depth tag clears the height line (#5299)

Two of the five AR rendering points of #5272, the ones that do not touch
AutoPlacementScene:

- ModelNode logs a warning when another live node shows the same
  ModelInstance (they move the same entities and draw a ghost). The check
  runs after the current main-thread message, so a node that replaces
  another in one recomposition is not reported. llms.txt states the rule.
- DimensionMarks: with heightOffset, the depth tag now stands outside
  whichever line is further out, so the height post no longer runs up
  through it.

Part of #5272.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `changelog.d/5272-dimension-marks-depth-tag.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+<!-- category: Fixed -->
+- `DimensionMarks`: with `heightOffset`, the height line no longer runs up through the depth tag. The tag now stands outside whichever line is further out (#5272).
```

**File**: `changelog.d/5272-one-instance-per-node.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+<!-- category: Changed -->
+- `ModelNode` logs a warning when two live nodes show the same `ModelInstance`: they move the same entities and draw a ghost. `llms.txt` now states the rule: one instance per node, `rememberModelInstance` per node or `createInstancedModel(…, count)` for copies (#5272).
```

**File**: `llms.txt` (modified, +1/-0)
```diff
@@ -1040,6 +1040,7 @@ Key behaviors:
 - `centerOrigin`: aligns the model's bounding box with the node origin — the AABB point selected by the normalized origin (`-1..1` per axis, `0` = AABB center) lands on the node origin, whatever the asset's authored pivot. `Position(0,0,0)` = center model. `Position(0,-1,0)` = center horizontal, bottom-aligned (model sits on the origin). `null` = keep the authored pivot. Composes **additively** with `position` — the alignment offset (`-(center + origin * halfExtent) * scale`) is added to `position`, so a non-zero `centerOrigin` takes effect even when `position` is left at its default, and the two can be combined (bottom-align *and* place at a point). Applied once on creation (not reactive, like `scaleToUnits`).
 - `autoAnimate = true` + `animationName = null`: plays ALL animations.
 - `animationName = "Walk"`: plays only that named animation (stops previous). Reactive to Compose state.
+- **One `ModelInstance` per `ModelNode`.** Two nodes on one instance move the same entities and draw a ghost; SceneView logs a warning when it sees it. For several copies, call `rememberModelInstance` once per node, or `modelLoader.createInstancedModel(assetFileLocation, count)` and give each node its own element of the list.
 
 Reactive animation example:
 ```kotlin
```

**File**: `sceneview/src/main/java/io/github/sceneview/DimensionMarks.kt` (modified, +14/-2)
```diff
@@ -146,8 +146,9 @@ fun SceneScope.DimensionMarks(
         widthMeters = lw, heightMeters = lh, scale = s, cameraPositionProvider = facing, apply = tag,
     )
     TagSlot(clearance, half, Position(0f, half + 0.03f, front + 0.02f)) { Tag(labels.x) }
-    // Outside the depth line by half a tag, so the object never hides it.
-    TagSlot(clearance, half, Position(right + 0.03f + lw * labelScale / 2f, half + 0.03f, 0f), Rotation(y = 90f)) {
+    // Outside the depth line by half a tag, so the object never hides it, and outside the height
+    // line too when [heightOffset] moves it out: the post ran up through the depth tag (#5272).
+    TagSlot(clearance, half, Position(g.depthTagX(right, hx, lw * labelScale / 2f), half + 0.03f, 0f), Rotation(y = 90f)) {
         Tag(labels.z)
     }
     if (heightTagSide != null) {
@@ -178,6 +179,17 @@ internal object DimensionMarksGeometry {
     const val TAG_HEIGHT = 0.085f
     const val FONT_SIZE = 82f
 
+    /** Gap between a line and the near edge of the depth tag. */
+    const val DEPTH_TAG_GAP = 0.03f
+
+    /**
+     * Centre of the depth tag on X: [DEPTH_TAG_GAP] beyond whichever stands further out, the depth
+     * line at [right] or the height line at [heightX], so neither line crosses the tag of
+     * half-width [tagHalfWidth] (#5272).
+     */
+    fun depthTagX(right: Float, heightX: Float, tagHalfWidth: Float): Float =
+        maxOf(right, heightX) + DEPTH_TAG_GAP + tagHalfWidth
+
     /**
      * Whether a tag spanning [bottom] to [top] on screen (-1 at the bottom edge, 1 at the top)
      * shows between the controls at [bottomLimit] and the top bar at [topLimit]. A shown tag hides
```

**File**: `sceneview/src/main/java/io/github/sceneview/node/ModelInstanceOwners.kt` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+package io.github.sceneview.node
+
+import java.lang.ref.WeakReference
+import java.util.WeakHashMap
+
+/**
+ * Which node shows each model instance (#5272). Two live nodes on one instance share its entities:
+ * both write their transform to the same root, and the model is drawn where neither expects it (a
+ * "ghost"). One instance per node is the rule; this only reports a breach.
+ *
+ * Weak on both sides: it never keeps an instance or a node alive. Main thread only, like the nodes.
+ */
+internal class ModelInstanceOwners<I : Any, N : Any>(private val isLive: (N) -> Boolean) {
+    private val owners = WeakHashMap<I, MutableList<WeakReference<N>>>()
+
+    /** Records that [node] shows [instance]. */
+    fun claim(instance: I, node: N) {
+        val list = owners.getOrPut(instance) { ArrayList(1) }
+        list.removeAll { it.get().let { held -> held == null || held === node || !isLive(held) } }
+        list += WeakReference(node)
+    }
+
+    /**
+     * The other live nodes that show [instance] besides [node]. Asked once the frame that created
+     * [node] is over: a node that replaces another (a recomposition that re-creates the wrapper)
+     * is created before the old one is destroyed, and must not count it.
+     */
+    fun othersThan(instance: I, node: N): List<N> =
+        owners[instance].orEmpty().mapNotNull { it.get() }.filter { it !== node && isLive(it) }
+}
```

**File**: `sceneview/src/main/java/io/github/sceneview/node/ModelNode.kt` (modified, +27/-0)
```diff
@@ -473,6 +473,7 @@ open class ModelNode(
         // A replacement wrapper starts from the loaded root, not the last placement's
         // scale/origin correction. Weak keys leave the instance's lifetime with its owner.
         transform = initialModelTransforms.getOrPut(modelInstance) { Transform(transform) }
+        warnIfInstanceShared()
         attachToParents(this, nodes)
         // Sanitize renderable entities with empty AABBs to prevent Filament crash.
         // Filament 1.70+ enforces: "AABB can't be empty, unless culling is disabled
@@ -965,6 +966,32 @@ internal fun attachToParents(
 
 private val initialModelTransforms = WeakHashMap<ModelInstance, Transform>()
 
+private val modelInstanceOwners = ModelInstanceOwners<ModelInstance, ModelNode> { !it.isDestroyed }
+
+/**
+ * One [ModelInstance] per [ModelNode] (#5272): logs a warning when another node still in use shows
+ * this instance. Checked after the current main-thread message, so a node that replaces another in
+ * the same recomposition (created before the old one is destroyed) is not reported.
+ */
+private fun ModelNode.warnIfInstanceShared() {
+    val instance = modelInstance
+    modelInstanceOwners.claim(instance, this)
+    val node = this
+    android.os.Handler(android.os.Looper.getMainLooper()).post {
+        if (node.isDestroyed) return@post
+        val others = modelInstanceOwners.othersThan(instance, node)
+        if (others.isNotEmpty()) {
+            android.util.Log.w(
+                "SceneView",
+                "This ModelInstance is shown by ${others.size + 1} ModelNodes at once. Each node needs " +
+                    "its own instance: nodes sharing one move the same entities and draw a ghost. " +
+                    "Load one per node (rememberModelInstance per node, or " +
+                    "modelLoader.createInstancedModel(..., count) for copies of one model).",
+            )
+        }
+    }
+}
+
 /**
  * The root entity of [this], checked before the [ModelNode] super constructor reads it: past
  * `ModelLoader.destroyModel`, the instance's handle points at freed memory.
```

**File**: `sceneview/src/test/java/io/github/sceneview/DimensionMarksGeometryTest.kt` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+package io.github.sceneview
+
+import org.junit.Assert.assertEquals
+import org.junit.Assert.assertTrue
+import org.junit.Test
+
+class DimensionMarksGeometryTest {
+    private val g = DimensionMarksGeometry
+    private val halfTag = g.TAG_WIDTH / 2f
+
+    @Test
+    fun `with the height line on the corner the depth tag keeps its place`() {
+        val right = 0.45f + g.OFFSET
+        // AR: heightOffset = 0, the height line stands on the depth line.
+        assertEquals(right + g.DEPTH_TAG_GAP + halfTag, g.depthTagX(right, right, halfTag), 1e-6f)
+    }
+
+    @Test
+    fun `a height line moved out never crosses the depth tag`() {
+        val right = 0.45f + g.OFFSET
+        for (offset in listOf(0.05f, 0.12f, 0.2f, 0.35f)) {
+            val heightX = right + offset
+            val centre = g.depthTagX(right, heightX, halfTag)
+            // The tag spans [centre - halfTag, centre + halfTag]: the post stays left of it.
+            assertTrue("offset $offset", centre - halfTag >= heightX + g.DEPTH_TAG_GAP - 1e-6f)
+        }
+    }
+
+    @Test
+    fun `the depth line never crosses the depth tag`() {
+        val right = 0.3f
+        assertTrue(g.depthTagX(right, right - 0.1f, halfTag) - halfTag >= right)
+    }
+}
```

**File**: `sceneview/src/test/java/io/github/sceneview/node/ModelInstanceOwnersTest.kt` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+package io.github.sceneview.node
+
+import org.junit.Assert.assertEquals
+import org.junit.Assert.assertTrue
+import org.junit.Test
+
+class ModelInstanceOwnersTest {
+    private class FakeNode(var destroyed: Boolean = false)
+
+    private val owners = ModelInstanceOwners<Any, FakeNode> { !it.destroyed }
+
+    @Test
+    fun `one node on its instance is not reported`() {
+        val instance = Any()
+        val node = FakeNode()
+        owners.claim(instance, node)
+        assertTrue(owners.othersThan(instance, node).isEmpty())
+    }
+
+    @Test
+    fun `two live nodes on one instance are reported to each other`() {
+        val instance = Any()
+        val first = FakeNode()
+        val second = FakeNode()
+        owners.claim(instance, first)
+        owners.claim(instance, second)
+        assertEquals(listOf(first), owners.othersThan(instance, second))
+        assertEquals(listOf(second), owners.othersThan(instance, first))
+    }
+
+    @Test
+    fun `a node that replaced a destroyed one is not reported`() {
+        val instance = Any()
+        val old = FakeNode()
+        owners.claim(instance, old)
+        val replacement = FakeNode()
+        owners.claim(instance, replacement)
+        // The recomposition destroys the old wrapper after creating the new one; the check runs later.
+        old.destroyed = true
+        assertTrue(owners.othersThan(instance, replacement).isEmpty())
+    }
+
+    @Test
+    fun `nodes on different instances are not reported`() {
+        val a = FakeNode()
+        val b = FakeNode()
+        val instanceA = Any()
+        val instanceB = Any()
+        owners.claim(instanceA, a)
+        owners.claim(instanceB, b)
+        assertTrue(owners.othersThan(instanceA, a).isEmpty())
+        assertTrue(owners.othersThan(instanceB, b).isEmpty())
+    }
+
+    @Test
+    fun `claiming twice with the same node keeps one entry`() {
+        val instance = Any()
+        val node = FakeNode()
+        owners.claim(instance, node)
+        owners.claim(instance, node)
+        val other = FakeNode()
+        owners.claim(instance, other)
+        assertEquals(listOf(node), owners.othersThan(instance, other))
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #5303** (2026-11-26): store(demo): Play What's new for the next release (@ThomasGorisse)
- **PR #5302** (2026-11-26): store(android-demo): Play screenshots lead with the open-source SDK (@ThomasGorisse)
- **PR #5301** (closed): feat(sceneview): auto-fit frames skinned, animated models on their clips' envelope (@ThomasGorisse)
- **PR #5300** (2026-11-26): feat(demo): analytics no longer record purchases (@ThomasGorisse)
- **PR #5299** (2026-11-26): fix(sceneview): warn on a ModelInstance shared by two ModelNodes; depth tag clears the height line (@ThomasGorisse)
- **PR #5298** (2026-11-26): docs(stores): demo privacy declarations match the 4.75.0 code (@ThomasGorisse)

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

## X. sceneview): a model load out of Java heap waits for abandoned loads, retries onc

**RULE**:
When implementing operations in `.github/workflows/model-load-rotation-oom.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sceneview/sceneview. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6c866654`: sceneview): a model load out of Java heap waits for abandoned loads, retries once, then fails without crashing. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/model-load-rotation-oom.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
name: Model load OOM on rotation (Android 8+ emulators)

# Proof for #5271 on real x86_64 emulators with a small ART heap (dalvik.vm.heapgrowthlimit),
# which arm64 hosts cannot run for API 26-28. Not a required check: it only runs
# when its own files change, or by hand.
on:
  pull_request:
    paths:
      - .github/workflows/model-load-rotation-oom.yml
      - tools/model-load-rotation-oom/**
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: model-load-rotation-oom-${{ github.ref }}
  cancel-in-progress: true

env:
  # Third-party asset from the public MAVLab report (Labs-Ascend/MAVLab). Fetched at run time, never committed.
  DRONE_URL: https://raw.githubusercontent.com/Labs-Ascend/MAVLab/843fefe3fe58345609282ec4c548c811a44ac659/mavlab-android/app/src/main/assets/models/drone.glb
  DRONE_BYTES: "5794580"

jobs:
  build:
    name: Build repro APKs (4.73.0, this branch)
    runs-on: ubuntu-latest
    timeout-minutes: 40
    steps:
      - uses: actions/checkout@v7
      - uses: ./.github/actions/setup-gradle

      # The root build signs every publication, mavenLocal included. A throwaway key made
      # here, used once and never stored, lets that signin
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6c866654` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
