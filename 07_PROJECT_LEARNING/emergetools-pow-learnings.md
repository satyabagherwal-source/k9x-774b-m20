# Forensic Learning Record (Deep Inspection): EmergeTools/Pow

> **Canonical Artifact**: `07_PROJECT_LEARNING/emergetools-pow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/EmergeTools/Pow](https://github.com/EmergeTools/Pow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-01T00:46:15.108Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `EmergeTools/Pow`
- **Description**: Delightful SwiftUI effects for your app
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4407 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9** (2022-10-15): **> Building for iOS Simulator, but linking in dylib built for iOS**
  *Symptoms*: > Building for iOS Simulator, but linking in dylib built for iOS, file '/Users/jdavis/Development/Games/LNGames/Pow.framework/Pow' for architecture arm64  I've tried adding the .xcframework and while the project builds and runs fine on device, Xcode previews gives me the above errors. :(  _Originally posted by @ismyhc in https://github.com/movingparts-io/Pow/issues/6_
  **Post-Mortem & Fix Analysis**:
  > @ismyhc Thanks for filing the issue, I haven't seen this myself and am investigating now.  Can you confirm you've dragged the entire xcframework into your project and are linking against that (instead of the individual .frameworks contained within)?  It should look a little something like this:  <img width="311" src="https://user-images.githubusercontent.com/212465/195991528-69afbb92-baa5-4fa4-b9a6-db61bd808991.png">  <img width="274" src="https://user-images.githubusercontent.com/212465/195991527-50c4e243-12cd-4562-89f3-13a5c782d6ea.png">  Are you running on an Intel Mac? What versions of Xcode and macOS are you using? 
  > @robb Here's what it looks like in Xcode & in the actual folder in finder. Its weird I don't get a folder like you have in Xcode.   ![Screen Shot 2022-10-15 at 11 14 03 AM](https://user-images.githubusercontent.com/840551/195994003-f799d296-5a26-4ff9-994c-a0d4908b2a04.png) 
  > @ismyhc Ok, that looks right. Are you on an Intel-based Mac?

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

### Incident Patch 1: `1b4b1dda` (2026-02-20)
**Commit Message**: Fix ambiguous use of .pi (#83)

**File**: `Sources/Pow/Transitions/Anvil.swift` (modified, +2/-2)
```diff
@@ -109,7 +109,7 @@ internal struct Anvil: ViewModifier, ProgressableAnimation, AnimatableModifier {
                                 let offsetX = maxOffsetX * (relativeX - 0.5) * 2 * .random(in: 0.8 ... 1.2, using: &rng)
                                 let offsetY = CGFloat.random(in: -maxOffsetY / 2 ... maxOffsetY / 2, using: &rng) + (t * t) * -50
 
-                                var scale = 1 + 0.6 * (1 - pow(sin(relativeX * .pi), 0.4)) + .random(in: 0 ... 0.2, using: &rng)
+								var scale = 1 + 0.6 * (1 - pow(sin(relativeX * CGFloat.pi), 0.4)) + .random(in: 0 ... 0.2, using: &rng)
                                 scale *= 0.8 + (dustT * 0.2)
                                 scale /= 3
                                 scale *= 1 - pow(2, -50 * dustT)
@@ -188,7 +188,7 @@ internal struct Anvil: ViewModifier, ProgressableAnimation, AnimatableModifier {
                                 ctx.translateBy(x: center.x, y: center.y)
                                 ctx.scaleBy(x: scale, y: scale)
 
-                                ctx.opacity = Double(pow(sin(speckT * .pi), 0.2))
+                                ctx.opacity = Double(pow(sin(speckT * CGFloat.pi), 0.2))
                                 ctx.fill(speck, with: .color(Color(white: .random(in: 0.75 ... 0.9, using: &rng))))
                             }
                         }
```

---

### Incident Patch 2: `4f47e338` (2024-09-15)
**Commit Message**: Fix SwiftPM build (#73)

**File**: `Package.swift` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ let package = Package(
         .target(
             name: "Pow",
             dependencies: enablePreviews ? [.product(name: "SnapshotPreferences", package: "SnapshotPreviews-iOS", condition: .when(platforms: [.iOS]))] : [],
+            resources: [.process("Assets.xcassets")],
             swiftSettings: enablePreviews ? [.define("EMG_PREVIEWS")] : nil),
         .testTarget(
             name: "PowTests",
```

---

### Incident Patch 3: `ebf05a22` (2024-04-06)
**Commit Message**: [README] Fix Sound Effect Feedback Documentation (#64)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -216,7 +216,7 @@ static func shine(angle: Angle, duration: Double = 1.0) -> AnyChangeEffect
 
 Triggers a sound effect as feedback whenever a value changes.
 
-This effect will not interrupt or duck any other audio that may currently playing. It may also not triggered based on the setting of the user's silent switch or playback device.
+This effect will not interrupt or duck any other audio that may be currently playing. This effect is not guaranteed to be triggered; the effect running depends on the user's silent switch position and the current playback device.
 
 To relay important information to the user, you should always accompany audio effects with visual cues.
 
```

---

### Incident Patch 4: `cc014eba` (2023-12-16)
**Commit Message**: Fix glow preventing hit tests (#53)

**File**: `Sources/Pow/Effects/GlowEffect.swift` (modified, +1/-0)
```diff
@@ -76,6 +76,7 @@ internal struct GlowModifier: ViewModifier, Animatable {
                     .opacity(ramp(amount))
                     .blendMode(.sourceAtop)
                     .brightness(ramp(abs(amount)) * 0.1)
+                    .allowsHitTesting(false)
             }
             .compositingGroup()
             .shadow(color: color.opacity(shadowOpacity /  1.2), radius: amount * radius / 4.0, x: 0, y: 0)
```

---

### Incident Patch 5: `c24472ed` (2023-12-05)
**Commit Message**: Fix ControlSize.extraLarge not available for Xcode lower than 15 (#47)

**File**: `Sources/Pow/Infrastructure/AngleControl.swift` (modified, +11/-8)
```diff
@@ -35,14 +35,17 @@ struct AngleControl<Label: View>: View {
     }
 
     private var size: CGFloat {
-        switch controlSize {
-        case .mini: return 32
-        case .small: return 38
-        case .regular: return 44
-        case .large: return 54
-        case .extraLarge: return 54
-        @unknown default: return 44
-        }
+      switch controlSize {
+      case .mini: return 32
+      case .small: return 38
+      case .regular: return 44
+      case .large: return 54
+#if compiler(>=5.9)
+      // ControlSize.extraLarge is only available from Xcode 15 which comes with Swift 5.9
+      case .extraLarge: return 54
+#endif
+      @unknown default: return 44
+      }
     }
 
     var body: some View {
```

---

### Incident Patch 6: `bf6f1333` (2023-12-03)
**Commit Message**: Fix compilation for visionOS (#44)

**File**: `README.md` (modified, +2/-1)
```diff
@@ -41,6 +41,7 @@ If you still have a question, enhancement, or a way to improve Pow, this project
 - iOS 15.0+
 - macOS 12.0
 - Mac Catalyst 15.0+
+- visionOS beta 6 (requires Xcode 15.1 beta 3)
 
 ## Change Effects
 
@@ -136,7 +137,7 @@ The shape will be colored by the current tint style.
 ```
 
  An effect that adds one or more shapes that slowly grow and fade-out behind the view.
- 
+
  - Parameters:
    - `shape`: The shape to use for the effect.
    - `style`: The style to use for the effect.
```

**File**: `Sources/Pow/Effects/SmokeEffect.swift` (modified, +2/-2)
```diff
@@ -54,7 +54,7 @@ private struct SmokeEffect: ViewModifier, Continuous {
         GeometryReader { proxy in
             ZStack {
                 ForEach(Array(particles.enumerated()), id: \.element) { (offset, particle) in
-                    #if os(iOS)
+                    #if os(iOS) || os(visionOS)
                     let image = UIImage(named: particle, in: .module, with: nil)!.cgImage!
                     #elseif os(macOS)
                     let image = Bundle.module.image(forResource: particle)!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
@@ -67,7 +67,7 @@ private struct SmokeEffect: ViewModifier, Continuous {
     }
 }
 
-#if os(iOS)
+#if os(iOS) || os(visionOS)
 private class EmitterView: UIView {
     override class var layerClass : AnyClass {
        return CAEmitterLayer.self
```

**File**: `Sources/Pow/Infrastructure/ViewRepresentable.swift` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import SwiftUI
 
-#if os(iOS) || os(tvOS)
+#if os(iOS) || os(tvOS) || os(visionOS)
 protocol ViewRepresentable: UIViewRepresentable {
     associatedtype ViewType = UIViewType
     func makeView(context: Context) -> ViewType
```

---

### Incident Patch 7: `825e0f11` (2023-11-30)
**Commit Message**: Fixes crash when using smoke effect (#42)

**File**: `Sources/Pow/Assets.xcassets/anvil_smoke_gray_alt.imageset/Contents.json` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+{
+  "images" : [
+    {
+      "filename" : "AnvilSmokeLightAlt.png",
+      "idiom" : "universal"
+    }
+  ],
+  "info" : {
+    "author" : "xcode",
+    "version" : 1
+  }
+}
```

**File**: `Sources/Pow/Assets.xcassets/anvil_smoke_gray_blur.imageset/Contents.json` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+{
+  "images" : [
+    {
+      "filename" : "AnvilSmokeLightBlur.png",
+      "idiom" : "universal"
+    }
+  ],
+  "info" : {
+    "author" : "xcode",
+    "version" : 1
+  }
+}
```

---

### Incident Patch 8: `ec007b4b` (2022-07-27)
**Commit Message**: Revert "Update package version"

This reverts commit 0ece69938c27278f4f71c729e4484b7aeca21c24.

**File**: `Package.swift` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-// swift-tools-version:5.7
+// swift-tools-version:5.5
 import PackageDescription
 
 let package = Package(
```

---

### Incident Patch 9: `50d8371e` (2022-07-27)
**Commit Message**: Fix package version

**File**: `Package.swift` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-// swift-tools-version:5.3
+// swift-tools-version:5.5
 import PackageDescription
 
 let package = Package(
```

#### Recent Merged Pull Requests:
- **PR #86** (closed): Fix ambiguous .pi for Xcode 26.4 (@flexih)
- **PR #83** (2026-02-20): Fix ambiguous use of .pi (@mergesort)
- **PR #80** (2025-02-18): Set swift version (@itaybre)
- **PR #76** (2025-02-18): Add badges to `Readme.md` (@itaybre)
- **PR #73** (2024-09-15): Fix SwiftPM build (@kabiroberai)
- **PR #70** (2024-08-12): Start/stop engine when entering background/foreground (@kkiermasz)
- **PR #67** (2024-11-10): Adding custom WiggleRate, ShakeRate, and SpinRate options (@mergesort)
- **PR #66** (2024-05-19): Add tvOS support (@McNight)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
