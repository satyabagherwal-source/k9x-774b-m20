# Forensic Learning Record (Deep Inspection): Shopify/react-native-skia

> **Canonical Artifact**: `07_PROJECT_LEARNING/shopify-react-native-skia-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Shopify/react-native-skia](https://github.com/Shopify/react-native-skia))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:48:58.925Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Shopify/react-native-skia`
- **Description**: High-performance React Native Graphics using Skia
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8619 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4000** (2026-08-30): **Android `useVideo` renders a black/frozen canvas: `copyFrameOnAndroid` never copies the frame, then disposes it**
  *Symptoms*: ### Description  (Extracted from session with Devin)  ## Description  On Android, `useVideo()` decodes fine but the canvas stays **black and frozen** — frame-to-frame pixel diff is exactly 0. The copy that Android needs is commented out in `copyFrameOnAndroid`, and the source image is disposed immediately afterwards, so the renderer is handed a disposed GPU texture:  `packages/skia/src/external/reanimated/useVideo.ts`  ```ts const copyFrameOnAndroid = (currentFrame: SharedValue<SkImage | null>) => {   "worklet";   // on android we need to copy the texture before it's invalidated   if (Platform.OS === "android") {     const tex = currentFrame.value;     if (tex) {       currentFrame.value = tex; //.makeNonTextureImage();       tex.dispose();     }   } }; ```  The comment states the requirement ("we need to copy the texture before it's invalidated") but the call that performs the copy is commented out. Restoring it fixes rendering on real hardware:  ```ts currentFrame.value = tex.makeNonTextureImage(); tex.dispose(); ```  This is present in **2.6.2 through 2.12.0-next.1** (unchanged), in `src/` and in both `lib/module` and `lib/commonjs` builds.  Possibly the same underlying symptom as the black-canvas half of #3936 (that report focuses on a Qualcomm SIGABRT; this one reproduces with no crash at all).  ## Version  `@shopify/react-native-skia` 2.6.2 (verified identical up to 2.12.0-next.1), react-native 0.86, Expo SDK 57, new architecture, Reanimated/Worklets.  ## Steps to repro
  **Post-Mortem & Fix Analysis**:
  > I went digging before sending a one-line PR for this, and the commented-out call turns out not to be an oversight.  It was commented out on purpose in #3686 (`chore(🔺): add webgpu canvas to Graphite`, merged 18 Mar 2026):  ```diff -      currentFrame.value = tex.makeNonTextureImage(); +      currentFrame.value = tex; //.makeNonTextureImage(); ```  The same commit also dropped the previous-frame dispose in `setFrame`:  ```diff    const img = video.nextImage();    if (img) { -    if (currentFrame.value) { -      currentFrame.value.dispose(); -    }      currentFrame.value = img;      copyFrameOnAndroid(currentFrame); ```  So what's on main today leaves `copyFrameOnAndroid` doing nothing except dispose the frame it was handed, which lines up with the black canvas here.  For history: that copy is the thing that made the Android path work. `copyFrameOnAndroid` has had `makeNonTextureImage()` in it since video support landed, and #2510 moved the call out of its `else` so it runs on every fr
  > :tada: This issue has been resolved in version 2.11.2 :tada:  The release is available on: - `v2.11.2` - [GitHub release](https://github.com/Shopify/react-native-skia/releases/tag/v2.11.2)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:
  > :tada: This issue has been resolved in version 2.11.2-next.1 :tada:  The release is available on: - `v2.11.2-next.1` - [GitHub release](https://github.com/Shopify/react-native-skia/releases/tag/v2.11.2-next.1)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #3989** (2026-08-05): **🚨 URGENT: Pre-compiled `librnskia.so` is NOT 16KB aligned (Android 15 / Play Store Rejections)**
  *Symptoms*: ### Description  With Android 15 officially enforcing 16 KB memory page sizes, `react-native-skia` is currently causing Google Play Console to flag production apps with fatal rejection warnings.  We conducted a deep-dive static analysis on our `.aab` bundles using the `readelf -l` utility. While React Native 0.79 and Expo 53 have responsibly updated their core C++ engines to 16KB (`0x4000`) alignments, the pre-compiled `librnskia.so` binary distributed via NPM is still hardcoded and compiled at the legacy 4KB (`0x1000`) alignment.  Because you distribute these binaries pre-compiled, we cannot recompile your C++ engine on our end. Apps utilizing Skia risk crashing on Android 15 devices running 16KB page sizes. Furthermore, even if we use the official Google workaround (`android:extractNativeLibs="true"`), the Play Console static analyzer still scans your outdated 4KB files and explicitly threatens to reject our app updates.   ### React Native Skia Version  v2.0.0-next.4  ### React Native Version  0.79.6  ### Using New Architecture  - [x] Enabled  ### Steps to Reproduce  1. Create a React Native / Expo project with `@shopify/react-native-skia` installed. 2. Build an Android App Bundle (`.aab`) for production release. 3. Unzip the `.aab` and extract `librnskia.so` from the native libraries folder. 4. Run the command: `readelf -l librnskia.so | grep -m 1 "LOAD"` 5. Observe the ELF alignment is `0x1000` (4KB) instead of the required `0x4000` (16KB). 6. Upload the `.aab` to Google 
  **Post-Mortem & Fix Analysis**:
  > Unfortunately `v2.0.0-next.4` is a version of RN Skia that is more than 2 years old. Upgrading will fix the issue (and newer versions of RN Skia are much more stable and faster). I'm closing this issue since I don't think there are any actionable items on my side, but let me know if there is something I can help with.
  > I fix this 16KB Play Store rejection for $99 in 24h. Your libjingle .so is 4KB (0x1000), Play now requires 0x4000 from Nov 1 2025. I rebuild with NDK r28 + AGP 8.5.1 + -z max-page-size=16384. I deliver fixed AAB ready for Play Console. DM: botrescue.online - PayPal upfront, 24h delivery.

- **Issue #3924** (2026-07-09): **[Web] Canvas unmount doesn't release WebGL context (retains whole DOM subtree); SkiaPictureView also leaks a new context on every relayout**
  *Symptoms*: ### Description  On web, two related issues in the CanvasKit/WebGL lifecycle cause an unbounded memory leak in any app that mounts/unmounts `<Canvas>` components repeatedly (e.g. navigating between screens) or animates a container that triggers relayout (e.g. a resizing `<Canvas>`):  **1. Canvas unmount never releases its CanvasKit-registered WebGL context.**  `CanvasKit.MakeWebGLCanvasSurface` registers a WebGL context in CanvasKit's internal Emscripten GL table (`GetWebGLContext` / `MakeWebGLContext`) and creates a `GrDirectContext`. Neither is ever released when the owning `<Canvas>` unmounts. Because that retained WebGL context object holds a reference to its `<canvas>` DOM element, and DOM elements are retained via `parentNode` by their ancestors, the *entire unmounted component subtree* stays reachable from a GC root for as long as the process runs — not just the canvas, but every sibling element, image, and listener in that subtree.  In our app (a kiosk-style single-page app that never does a full page reload), this meant every screen navigation permanently pinned ~200 DOM elements and several decoded images (~6 MB) in memory. Confirmed via Chrome heap-snapshot retainer analysis (BFS from `Window`, skipping weak edges): the retainer chain runs `Window → InternalNode(s) → <canvas> → parentNode → ...entire screen tree`.  **2. `SkiaPictureView`'s web renderer recreates the WebGL context on every layout event, and never disposes the old one.**  `onLayoutEvent` in `SkiaPict
  **Post-Mortem & Fix Analysis**:
  > Thank You for reporting this and for the nicely reproducible example, I've merged a fix for this should be published tomorrow  On Tue, Jul 7, 2026 at 10:36 AM Gustav Lindqvist ***@***.***> wrote: > > Description > > On web, two related issues in the CanvasKit/WebGL lifecycle cause an unbounded memory leak in any app that mounts/unmounts <Canvas> components repeatedly (e.g. navigating between screens) or animates a container that triggers relayout (e.g. a resizing <Canvas>): > > 1. Canvas unmount never releases its CanvasKit-registered WebGL context. > > CanvasKit.MakeWebGLCanvasSurface registers a WebGL context in CanvasKit's internal Emscripten GL table (GetWebGLContext / MakeWebGLContext) and creates a GrDirectContext. Neither is ever released when the owning <Canvas> unmounts. Because that retained WebGL context object holds a reference to its <canvas> DOM element, and DOM elements are retained via parentNode by their ancestors, the entire unmounted component subtree sta
  > :tada: This issue has been resolved in version 2.7.0 :tada:  The release is available on: - `v2.7.0` - [GitHub release](https://github.com/Shopify/react-native-skia/releases/tag/v2.7.0)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #3895** (2026-07-16): **Expo SDK 56 is not able to build with Skia v`2.6.2`: 'third_party/base64.h' file not found**
  *Symptoms*: ### Description  As a developer following the Expo SDK56 [upgrade instructions](https://expo.dev/changelog/sdk-56#upgrading-your-app), I am unable to build a development `prebuild` anymore.   There is a build failure of `'third_party/base64.h' file not found`  PR #3853 was released, but requires an update from the default 2.6.2 that Expo has.  SDK 56 is fixed to `@shopify/react-native-skia: "2.6.2"` so altering the version will cause a warning in `expo-doctor`.   Will Expo ever update their versions to allow 2.6.3?  So i tested out 2.6.3 which gives the warning:  > Using 2.6.3 instead of 2.6.2 for @shopify/react-native-skia because this version was explicitly provided. Packages excluded from dependency validation should be listed in expo.install.exclude in package.json. Learn more  However, if I update to 2.6.3, it fails the Expo `prebuild` still:  ```bash > Compiling @shopify/react-native-skia Pods/react-native-skia » ViewScreenshotService.mm  ❌  (node_modules/@shopify/react-native-skia/apple/ViewScreenshotService.h:15:10)    13 | #pragma clang diagnostic ignored "-Wdocumentation"   14 | > 15 | #include "include/core/SkImage.h"      |          ^ 'include/core/SkImage.h' file not found   16 |   17 | #pragma clang diagnostic pop   18 |  › Compiling @shopify/react-native-skia Pods/react-native-skia » SkottieUtils.cpp  ❌  (node_modules/@shopify/react-native-skia/cpp/api/third_party/SkottieUtils.h:10:10)     8 | #pragma once    9 | > 10 | #include "include/core/SkRefCnt.h"      |
  **Post-Mortem & Fix Analysis**:
  > Had the same isue, upgraded to `expo@56.0.12`, `@shopify/react-native-skia@2.6.6` and it works 👌 
  > Can confirm. Upgradeing skia worked, now doctor is complaining 😅 
  > This is fixed now 🙏

- **Issue #3877** (2026-06-12): **Bug: 504 Gateway Time-out during postinstall when downloading prebuilt binaries on Expo EAS**
  *Symptoms*: ### Description  I am currently unable to build my Expo application using EAS Build. The build fails consistently during the `pnpm install` phase, specifically when `@shopify/react-native-skia` attempts to download its prebuilt binaries via the `install-skia.mjs` postinstall script.  The server returns a `504 Gateway Time-out` error when trying to fetch the `.tar.gz` assets from GitHub releases. I have retried the build multiple times over the last hour, but it keeps failing at different files (e.g., `skia-apple-macos-xcframeworks-skia-m144c.tar.gz` or `skia-android-arm-skia-m144c.tar.gz`).  ### Version `@shopify/react-native-skia`: 2.4.18  ### Environment - **Build system:** Expo EAS Build (Cloud) - **Package Manager:** pnpm 10.19.0 - **Expo SDK:** ~55.0.5 - **React Native:** 0.83.2  ### Logs Here are the relevant logs from my EAS build worker:  ```text .../@shopify/react-native-skia postinstall$ node ./scripts/install-skia.mjs .../@shopify/react-native-skia postinstall: 📦 Downloading Skia prebuilt binaries for skia-m144c .../@shopify/react-native-skia postinstall: 🧹 Clearing existing artifacts... .../@shopify/react-native-skia postinstall: ⬇️  Downloading release assets to /.../node_modules/packages/skia/artifacts .../@shopify/react-native-skia postinstall:    Downloading skia-android-arm-skia-m144c.tar.gz... .../@shopify/react-native-skia postinstall:    ✗ Failed to download skia-android-arm-skia-m144c.tar.gz: Error: Failed to download: 504 Gateway Time-out .../@shopify/
  **Post-Mortem & Fix Analysis**:
  > My apogies for the inconveniance. This has been fixed in a newer version of RN Skia, the postinstall script doesn’t do network requests anymore. We’re also looking at a plan eventually remove that postinstall step altogether. I hope this helps.  On Mon 8 Jun 2026 at 09:01, Killian HERZER ***@***.***> wrote:  > Description > > I am currently unable to build my Expo application using EAS Build. The > build fails consistently during the pnpm install phase, specifically when > @shopify/react-native-skia attempts to download its prebuilt binaries via > the install-skia.mjs postinstall script. > > The server returns a 504 Gateway Time-out error when trying to fetch the > .tar.gz assets from GitHub releases. I have retried the build multiple > times over the last hour, but it keeps failing at different files (e.g., > skia-apple-macos-xcframeworks-skia-m144c.tar.gz or > skia-android-arm-skia-m144c.tar.gz). > Version > > @shopify/react-native-skia: 2.4.18 > Environment >
  > > My apogies for the inconveniance. This has been fixed in a newer version of > RN Skia, the postinstall script doesn’t do network requests anymore. > We’re also looking at a plan eventually remove that postinstall step > altogether. I hope this helps. > […](#)  is there a temporary solution for this? 
  > @wcandillon so we are forced to install the latest version?

- **Issue #3861** (2026-07-16): **Skia run time render not loaded when app is initiated from Liveactivity in background**
  *Symptoms*: <img width="256" height="560" alt="Image" src="https://github.com/user-attachments/assets/560c20cc-f9c6-4e08-ba67-829d71f4fd88" /> <img width="256" height="560" alt="Image" src="https://github.com/user-attachments/assets/a823a6c9-0ef7-4d33-82a1-4ead6ce3b028" />  ### Description  Skia renders are broken when app is launched in the background with Live activity.  ### React Native Skia Version  2.4.14  ### React Native Version  0.81.5  ### Using New Architecture  - [x] Enabled  ### Steps to Reproduce  1. Provided with Index.js as the default entry point of the app for file based routing. 2. use the Skia shader provided in the protected stack. ``` import {     Canvas,     Fill,     Shader,     Skia,     SkRuntimeEffect,     useClock, } from "@shopify/react-native-skia"; import React, { useMemo } from "react"; import { useWindowDimensions } from "react-native"; import { useDerivedValue } from "react-native-reanimated"; import { decideGradientCondition } from "../../utils/bedroomHealth/colorGradient/decideGradient"; /* =========================    GRADIENT LOGIC    ========================= */  const skyDayTop = [0.02745, 0.29020, 0.55686]; const skyDayBottom = [0.33333, 0.58824, 0.84706]; const skyEveTop = [0.12157, 0.26275, 0.50451]; const skyEveBottom = [0.72941, 0.45882, 0.49412]; const skyNightTop = [0.00784, 0.01961, 0.09412]; const skyNightBottom = [0.15686, 0.20784, 0.33333]; const skyEarlyTop = [0.03765, 0.04078, 0.14745]; const skyEarlyBottom = [0.15686, 0.20784, 0.33333]
  **Post-Mortem & Fix Analysis**:
  > I am closing it as a duplicate of #3695

- **Issue #3842** (2026-06-18): **Android build fails with newArchEnabled=false since v2.5.3: missing paper variants of SkiaWebGPUViewManagerDelegate /   Interface**
  *Symptoms*: ### Description  `@shopify/react-native-skia` v2.5.3 added the Android WebGPU view manager (`WebGPUViewManager.java`, `WebGPUView.java`, `WebGPUSurfaceView.java`, `WebGPUTextureView.java`, `WebGPUViewAPI.java`) but did **not** ship matching prebuilt paper-architecture variants of the codegen output (`SkiaWebGPUViewManagerDelegate.java`, `SkiaWebGPUViewManagerInterface.java`). As a result, any project with `newArchEnabled=false` on Android fails to compile.  **Root cause**  `android/build.gradle` only applies the React Native gradle plugin (which runs codegen) when New Architecture is enabled:  ```gradle if (isNewArchitectureEnabled()) {     apply plugin: "com.facebook.react" } ```  `WebGPUViewManager.java` lives in `android/src/main/java/` (always compiled) and unconditionally imports codegen output from `com.facebook.react.viewmanagers`. With new arch off, codegen never runs, so those classes don't exist.  The `SkiaPictureView` flow handles this correctly — paper variants are shipped in `android/src/paper/java/com/facebook/react/viewmanagers/SkiaPictureViewManagerDelegate.java` and `…Interface.java`. The same files are missing for the WebGPU view.  It looks like the same class of bug fixed for `SkiaPictureView` in #3535 / v2.4.6, but applied to the new WebGPU view manager.  **Versions affected** (verified by extracting npm tarballs):  | Version | Has `WebGPUViewManager.java` | Builds on old arch | |---|---|---| | 2.5.2 | No | ✅ | | 2.5.3 | Yes | ❌ | | 2.5.5 | Yes | ❌ | | 2.6
  **Post-Mortem & Fix Analysis**:
  > :tada: This issue has been resolved in version 2.6.6 :tada:  The release is available on: - `v2.6.6` - [GitHub release](https://github.com/Shopify/react-native-skia/releases/tag/v2.6.6)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #3818** (2026-04-15): **iOS apps hangs after resuming for 10+ seconds with Skia**
  *Symptoms*: ### Description  When resuming an app with Skia shaders on iOS, the app will hang for a long time before it becomes responsive.  https://github.com/user-attachments/assets/cc1230bf-7292-414c-a490-e9ac4510b60d  ### React Native Skia Version  2.6.2 (latest) and 2.4.18 (expo 55 pinned)  ### React Native Version  0.83.4  ### Using New Architecture  - [x] Enabled  ### Steps to Reproduce  1. Check out minimal repro 2. `bun install` 3. `bun ios` (the issue reproduces both in the simulator and a real iOS device) 4. Open the app 5. Background the app, wait 5 seconds 6. Reopen the app 7. Press the "Tap me" button  **Expected outcome:** The alert should be displayed immediately, the animation of TouchableOpacity should play on the button  **Actual outcome:** The app is frozen for 10+ seconds, then the alert is displayed.  Note: The animations are playing without issue while the JS main thread is frozen. The hang does not happen on all launch, only resume.  ### Snack, Code Example, Screenshot, or Link to Repository  https://github.com/Nezz/expo-repro/tree/repro/Skia
  **Post-Mortem & Fix Analysis**:
  > Nevermind, the issue was in the Reacticx component I used. The `GlowBorder` component used a `setInterval(..., 16)` on the JS thread to update its shader's time uniform at ~60fps, but this interval was never paused when the app was backgrounded — so timer callbacks queued up while the JS thread was suspended, and on resume they all fired back-to-back, flooding the Reanimated and Skia pipelines with thousands of redundant shared value writes and shader redraws that blocked the JS thread.

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

### Incident Patch 1: `60d52098` (2026-09-29)
**Commit Message**: fix(🌳): make interpolatePaths fail clearly on degenerate inputs (#4091)

Throw on NaN value, empty/mismatched input and outputRange, and infinite
values with extend. Return the segment end path for zero-width segments.

**File**: `packages/skia/src/animation/functions/interpolatePaths.ts` (modified, +24/-0)
```diff
@@ -12,6 +12,12 @@ const lerp = (
   p2: SkPath
 ) => {
   "worklet";
+  // Zero-width segment (duplicate input stops): t would be NaN or Infinity.
+  // Return the segment's end path (p2), i.e. the value jumps to p2 at the stop.
+  // reanimated's interpolate has no explicit guard here, so this is our choice.
+  if (to === from) {
+    return p2;
+  }
   const t = (value - from) / (to - from);
   // interpolate returns a new path (immutable operation)
   return p2.interpolate(p1, t)!;
@@ -41,12 +47,25 @@ export const interpolatePaths = (
   _output?: SkPath
 ) => {
   "worklet";
+  if (input.length < 2 || input.length !== outputRange.length) {
+    throw new Error(
+      `interpolatePaths() requires input and outputRange to have the same length and at least 2 entries, received ${input.length} and ${outputRange.length}`
+    );
+  }
+  if (Number.isNaN(value)) {
+    throw new Error("interpolatePaths() received NaN as value");
+  }
   const extrapolation = validateInterpolationOptions(options);
   if (value < input[0]) {
     switch (extrapolation.extrapolateLeft) {
       case Extrapolate.CLAMP:
         return outputRange[0];
       case Extrapolate.EXTEND:
+        if (!Number.isFinite(value)) {
+          throw new Error(
+            "interpolatePaths() cannot extend with an infinite value, use clamp extrapolation instead"
+          );
+        }
         return lerp(value, input[0], input[1], outputRange[0], outputRange[1]);
       case Extrapolate.IDENTITY:
         throw new Error(
@@ -60,6 +79,11 @@ export const interpolatePaths = (
       case Extrapolate.CLAMP:
         return outputRange[outputRange.length - 1];
       case Extrapolate.EXTEND:
+        if (!Number.isFinite(value)) {
+          throw new Error(
+            "interpolatePaths() cannot extend with an infinite value, use clamp extrapolation instead"
+          );
+        }
         return lerp(
           value,
           input[input.length - 2],
```

**File**: `packages/skia/src/skia/__tests__/Path.spec.ts` (modified, +48/-0)
```diff
@@ -358,6 +358,54 @@ describe("Path", () => {
     const p4 = interpolatePaths(1.1, [0, 1], [p1, p2], "clamp");
     expect(p4.toCmds()).toEqual(p2.toCmds());
   });
+  describe("interpolatePaths() degenerate inputs", () => {
+    const setup = () => {
+      const { Skia } = setupSkia();
+      const p1 = makePath(Skia, (b) => b.moveTo(0, 0).lineTo(100, 100));
+      const p2 = makePath(Skia, (b) => b.moveTo(0, 100).lineTo(100, 0));
+      return { p1, p2 };
+    };
+    it("throws on NaN", () => {
+      const { p1, p2 } = setup();
+      expect(() => interpolatePaths(NaN, [0, 1], [p1, p2])).toThrow(
+        "interpolatePaths() received NaN as value"
+      );
+    });
+    it("throws on empty input", () => {
+      expect(() => interpolatePaths(0, [], [])).toThrow(/interpolatePaths\(\)/);
+    });
+    it("throws on mismatched lengths", () => {
+      const { p1, p2 } = setup();
+      expect(() => interpolatePaths(0, [0, 0.5, 1], [p1, p2])).toThrow(
+        /same length/
+      );
+    });
+    it("returns the end path for zero-width input", () => {
+      const { p1, p2 } = setup();
+      const path = interpolatePaths(0, [0, 0], [p1, p2]);
+      expect(path.toCmds()).toEqual(p2.toCmds());
+      const extended = interpolatePaths(1, [0, 0], [p1, p2]);
+      expect(extended.toCmds()).toEqual(p2.toCmds());
+    });
+    it("clamps Infinity", () => {
+      const { p1, p2 } = setup();
+      expect(
+        interpolatePaths(Infinity, [0, 1], [p1, p2], "clamp").toCmds()
+      ).toEqual(p2.toCmds());
+      expect(
+        interpolatePaths(-Infinity, [0, 1], [p1, p2], "clamp").toCmds()
+      ).toEqual(p1.toCmds());
+    });
+    it("throws on Infinity with extend", () => {
+      const { p1, p2 } = setup();
+      expect(() => interpolatePaths(Infinity, [0, 1], [p1, p2])).toThrow(
+        /infinite/
+      );
+      expect(() =>
+        interpolatePaths(-Infinity, [0, 1], [p1, p2], "extend")
+      ).toThrow(/infinite/);
+    });
+  });
   it("should be possible to call dispose on a path", () => {
     const { Skia } = setupSkia();
     using path = makePath(Skia, (b) =>
```

---

### Incident Patch 2: `3f7cfdbb` (2026-09-29)
**Commit Message**: fix(🧠): improve memory pressure reporting to the API (#4090)

**File**: `packages/skia/cpp/api/JsiSkImageFilter.h` (modified, +3/-1)
```diff
@@ -28,7 +28,9 @@ class JsiSkImageFilter
       : JsiSkWrappingSkPtrNativeObject<JsiSkImageFilter, SkImageFilter>(
             std::move(context), std::move(imageFilter)) {}
 
-  size_t getMemoryPressure() override { return 1024 * 1024; }
+  // A image filter node is a few hundred bytes; the images it may reference
+  // are reported by their own wrappers.
+  size_t getMemoryPressure() override { return kMinMemoryPressure; }
 
   static void definePrototype(jsi::Runtime &runtime, jsi::Object &prototype) {
     installCommon(runtime, prototype);
```

**File**: `packages/skia/cpp/api/JsiSkParagraph.h` (modified, +2/-1)
```diff
@@ -277,7 +277,8 @@ class JsiSkParagraph
                       &JsiSkParagraph::extendedVisit);
   }
 
-  size_t getMemoryPressure() override { return 1024 * 1024; }
+  // Shaped glyph runs and line metrics; there is no exact API for this.
+  size_t getMemoryPressure() override { return 16 * 1024; }
 
   explicit JsiSkParagraph(std::shared_ptr<RNSkPlatformContext> context,
                           para::ParagraphBuilder *paragraphBuilder)
```

**File**: `packages/skia/cpp/api/JsiSkParagraphBuilder.h` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ class JsiSkParagraphBuilder : public JsiSkNativeObject<JsiSkParagraphBuilder> {
                            &JsiSkParagraphBuilder::pop);
   }
 
-  size_t getMemoryPressure() override { return 1024 * 1024; }
+  size_t getMemoryPressure() override { return kMinMemoryPressure; }
 
   explicit JsiSkParagraphBuilder(std::shared_ptr<RNSkPlatformContext> context,
                                  para::ParagraphStyle paragraphStyle,
```

**File**: `packages/skia/cpp/api/JsiSkParagraphBuilderFactory.h` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ class JsiSkParagraphBuilderFactory
                   &JsiSkParagraphBuilderFactory::Make);
   }
 
-  size_t getMemoryPressure() override { return 1024 * 1024; }
+  size_t getMemoryPressure() override { return kMinMemoryPressure; }
 
   explicit JsiSkParagraphBuilderFactory(
       std::shared_ptr<RNSkPlatformContext> context)
```

**File**: `packages/skia/cpp/api/JsiSkPath.h` (modified, +11/-4)
```diff
@@ -640,11 +640,18 @@ class JsiSkPath
       : JsiSkPath(std::move(context), SkPathBuilder(path)) {}
 
   size_t getMemoryPressure() override {
-    auto builder = getObject();
-    if (!builder)
+    if (isDisposed()) {
       return 0;
-
-    return builder->snapshot().approximateBytesUsed();
+    }
+    auto builder = getObjectUnchecked();
+    if (!builder) {
+      return 0;
+    }
+    // The point, verb and conic weight arrays of the builder. Snapshotting
+    // the path to measure it would copy them, and this runs on every round
+    // trip of the object to JS.
+    return builder->points().size_bytes() + builder->verbs().size_bytes() +
+           builder->conicWeights().size_bytes();
   }
 
   /**
```

---

### Incident Patch 3: `75840d85` (2026-09-24)
**Commit Message**: fix(🍏): pass GrContextOptions when creating the Metal direct context (#4075)

`MetalContext::MetalContext` constructs a `GrContextOptions` with a comment
inviting configuration, then calls the single-argument
`GrDirectContexts::MakeMetal` overload, so the options are discarded. Skia
already exposes the overload that takes them:

```cpp
SK_API sk_sp<GrDirectContext> MakeMetal(const GrMtlBackendContext&, const GrContextOptions&);
SK_API sk_sp<GrDirectContext> MakeMetal(const GrMtlBackendContext&);
```

This is behaviour-preserving today, since a default-constructed
`GrContextOptions` is what `MakeMetal(backendContext)` builds internally. It
makes the existing comment true, and it is the prerequisite for setting any
option, in particular `fPersistentCache`, documented as the "cache in which to
store compiled shader binaries between runs".

Without a persistent cache every Metal pipeline is compiled from SkSL on each
cold launch, on the thread that is drawing. Profiled with Instruments on an
iPhone 15 Pro Max (iOS 26.6.2, Ganesh Metal backend): across the two largest
main-thread hangs of a 49 s capture the main thread was Blocked 150.46 ms
against 9.30 ms Running, all of it in `kevent

**File**: `packages/skia/apple/MetalContext.mm` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@
   GrContextOptions grContextOptions; // set different options here.
 
   // Create the Skia Direct Context
-  _directContext = GrDirectContexts::MakeMetal(backendContext);
+  _directContext = GrDirectContexts::MakeMetal(backendContext, grContextOptions);
   if (_directContext == nullptr) {
     RNSkia::RNSkLogger::logToConsole("Couldn't create a Skia Metal Context");
   }
```

---

### Incident Patch 4: `d2d36935` (2026-09-24)
**Commit Message**: fix(📃): remove support for the legacy architecture (#4070)

**File**: `apps/example/src/Tests/useClient.ts` (modified, +0/-3)
```diff
@@ -7,8 +7,6 @@ const ANDROID_WS_HOST = "10.0.2.2";
 const IOS_WS_HOST = "localhost";
 const HOST = OS === "android" ? ANDROID_WS_HOST : IOS_WS_HOST;
 const PORT = 4242;
-// eslint-disable-next-line @typescript-eslint/no-explicit-any
-const arch = (global as any)?.nativeFabricUIManager ? "fabric" : "paper";
 // Whether this Skia build runs the Graphite backend. Probed via
 // getNativeDevice(), which throws on Ganesh builds — checking navigator.gpu
 // would only tell us react-native-webgpu is installed, which can be true on
@@ -36,7 +34,6 @@ export const useClient = (): UseClient => {
       ws.send(
         JSON.stringify({
           OS,
-          arch,
           graphite,
         })
       );
```

**File**: `packages/skia/Package.swift` (modified, +4/-4)
```diff
@@ -86,10 +86,10 @@ let package = Package(
         .headerSearchPath("cpp/rnskia"), // apple/ uses bare "RNSkView.h"
         .headerSearchPath("cpp/utils"), // apple/ uses bare "RNSkLog.h"
 
-        // CocoaPods forces both project-wide; the SwiftPM path defines neither.
-        // Skia's Apple sources still gate on them: without them RNSkiaModule's
-        // legacy branch fails to compile and -getTurboModule: is dropped, so
-        // the JSI bindings never install.
+        // CocoaPods defines both project-wide for a New Architecture app; the
+        // SwiftPM path defines neither. Skia's own sources no longer gate on
+        // them, but React's headers do (RCT_REMOVE_LEGACY_ARCH hides the
+        // legacy bridge API), so mirror what CocoaPods does.
         .define("RCT_NEW_ARCH_ENABLED", to: "1"),
         .define("RCT_REMOVE_LEGACY_ARCH", to: "1"),
 
```

**File**: `packages/skia/android/CMakeLists.txt` (modified, +22/-177)
```diff
@@ -1,7 +1,6 @@
 project(RNSkia)
 cmake_minimum_required(VERSION 3.4.1)
 
-set (CMAKE_VERBOSE_MAKEFILE ON)
 set (CMAKE_CXX_STANDARD 20)
 
 # SKIA_LIBS_PATH is passed from Gradle (pointing at the prebuilt Skia binaries,
@@ -48,20 +47,7 @@ set (SKIA_SKSG_LIB "sksg")
 set (SKIA_JSONREADER_LIB "jsonreader")
 
 
-# Clear some variables
-unset(LIBRN_DIR CACHE)
-unset(libfbjni_link_DIRS CACHE)
-unset(libfbjni_include_DIRS CACHE)
-
-set(build_DIR ${CMAKE_SOURCE_DIR}/build)
-file(GLOB LIBRN_DIR "${PREBUILT_DIR}/${ANDROID_ABI}")
-file(GLOB libfbjni_link_DIRS "${build_DIR}/fbjni*.aar/jni/${ANDROID_ABI}")
-file(GLOB libfbjni_include_DIRS "${build_DIR}/fbjni-*-headers.jar/")
-
 message("-- ABI     : " ${ANDROID_ABI})
-message("-- PREBUILT: " ${PREBUILT_DIR})
-message("-- BUILD   : " ${build_DIR})
-message("-- LIBRN   : " ${LIBRN_DIR})
 
 link_directories(${SKIA_LIBS_PATH}/)
 
@@ -80,14 +66,6 @@ else()
     )
 endif()
 
-if(${REACT_NATIVE_VERSION} LESS 66)
-        file(
-                TO_CMAKE_PATH
-                "${NODE_MODULES_DIR}/react-native/ReactCommon/jsi/jsi/jsi.cpp"
-                INCLUDE_JSI_CPP
-        )
-endif()
-
 add_library(
         ${PACKAGE_NAME}
         SHARED
@@ -145,8 +123,6 @@ target_include_directories(
 
         # Shared JSI infrastructure (cpp/jsi) via prefix-qualified includes
         ../cpp
-
-        ${libfbjni_include_DIRS}
 )
 
 add_library(svg STATIC IMPORTED)
@@ -189,113 +165,9 @@ find_library(
 )
 message("-- LOG     : " ${LOG_LIB})
 
-if(${REACT_NATIVE_VERSION} GREATER_EQUAL 71)
-    # We need to find packages since from RN 0.71 binaries are prebuilt
-    find_package(fbjni REQUIRED CONFIG)
-    find_package(ReactAndroid REQUIRED CONFIG)
-endif()
-
-unset(JSI_LIB CACHE)
-if(${REACT_NATIVE_VERSION} LESS 66)
-    # JSI lib didn't exist on RN 0.65 and before. Simply omit it.
-    set (JSI_LIB "")
-elseif(${REACT_NATIVE_VERSION} GREATER_EQUAL 71)
-    # RN 0.71 distributes prebuilt binaries.
-    set (JSI_LIB ReactAndroid::jsi)
-else()
-    # RN 0.66 distributes libjsi.so, can be used instead of compiling jsi.cpp manually.
-    find_library(
-        JSI_LIB
-        jsi
-        PATHS ${LIBRN_DIR}
-        NO_CMAKE_FIND_ROOT_PATH
-    )
-endif()
-message("-- JSI     : " ${JSI_LIB})
-
-unset(REACT_LIB CACHE)
-if(${REACT_NATIVE_VERSION} GREATER_EQUAL 76)
-    # RN 0.76 packs react_nativemodule_core into ReactAndroid::reactnative
-    set (REACT_LIB ReactAndroid::reactnative)
-elseif(${REACT_NATIVE_VERSION} GREATER_EQUAL 71)
-    # RN 0.71 distributes prebuilt binaries.
-    set (REACT_LIB ReactAndroid::react_nativemodule_core)
-    else()
-    find_library(
-            REACT_LIB
-            react_nativemodule_core
-            PATHS ${LIBRN_DIR}
-            NO_CMAKE_FIND_ROOT_PATH
-    )
-endif()
-message("-- REACT   : " ${REACT_LIB})
-
-unset(FBJNI_LIBRARY CACHE)
-if(${REACT_NATIVE_VERSION} GREATER_EQUAL 71)
-    # RN 0.71 distributes prebuilt binaries.
-    set (FBJNI_LIBRARY fbjni::fbjni)
-else()
-    find_library(
-            FBJNI_LIBRARY
-            fbjni
-            PATHS ${libfbjni_link_DIRS}
-            NO_CMAKE_FIND_ROOT_PATH
-    )
-endif()
-message("-- FBJNI   : " ${FBJNI_LIBRARY})
-
-unset(REACTNATIVEJNI_LIB CACHE)
-if(${REACT_NATIVE_VERSION} GREATER_EQUAL 76)
-    # RN 0.76 doesn't have reactnativejni
-    # DO NOTHING, we'll not link these libraries
-elseif(${REACT_NATIVE_VERSION} GREATER_EQUAL 71)
-    # RN 0.71 distributes prebuilt binaries.
-    set (REACTNATIVEJNI_LIB "ReactAndroid::reactnativejni")
-else()
-    find_library(
-            REACTNATIVEJNI_LIB
-            reactnativejni
-            PATHS ${LIBRN_DIR}
-            NO_CMAKE_FIND_ROOT_PATH
-    )
-endif()
-message("-- REACTNATIVEJNI   : " ${REACTNATIVEJNI_LIB})
-
-unset(RUNTIMEEXECUTOR_LIB CACHE)
-if(${REACT_NATIVE_VERSION} GREATER_EQUAL 76)
-    # RN 0.76 doesn't have runtimeexecutor
-    # DO NOTHING, we'll not link these libraries
-elseif(${REACT_NATIVE_VERSION} GREATER_EQUAL 71)
-    # RN 0.71 distributes pre
```

**File**: `packages/skia/android/build.gradle` (modified, +40/-209)
```diff
@@ -2,39 +2,23 @@ import java.nio.file.Paths
 
 // android/build.gradle
 
-// based on:
-//
-// * https://github.com/facebook/react-native/blob/0.60-stable/template/android/build.gradle
-//   previous location:
-//   - https://github.com/facebook/react-native/blob/0.58-stable/local-cli/templates/HelloWorld/android/build.gradle
-//
-// * https://github.com/facebook/react-native/blob/0.60-stable/template/android/app/build.gradle
-//   previous location:
-//   - https://github.com/facebook/react-native/blob/0.58-stable/local-cli/templates/HelloWorld/android/app/build.gradle
-
 // FBJNI build is based on:
 // https://github.com/facebookincubator/fbjni/blob/main/docs/android_setup.md
 
 // These defaults should reflect the SDK versions used by
-// the minimum React Native version supported.
-def DEFAULT_COMPILE_SDK_VERSION = 28
-def DEFAULT_BUILD_TOOLS_VERSION = '28.0.3'
-def DEFAULT_MIN_SDK_VERSION = 21
-def DEFAULT_TARGET_SDK_VERSION = 28
+// the minimum React Native version supported (0.78).
+def DEFAULT_COMPILE_SDK_VERSION = 35
+def DEFAULT_BUILD_TOOLS_VERSION = '35.0.0'
+def DEFAULT_MIN_SDK_VERSION = 24
+def DEFAULT_TARGET_SDK_VERSION = 34
 
 def safeExtGet(prop, fallback) {
     rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
 }
 
-def isNewArchitectureEnabled() {
-    // To opt-in for the New Architecture, you can either:
-    // - Set `newArchEnabled` to true inside the `gradle.properties` file
-    // - Invoke gradle with `-newArchEnabled=true`
-    // - Set an environment variable `ORG_GRADLE_PROJECT_newArchEnabled=true`
-    return project.hasProperty("newArchEnabled") && project.newArchEnabled == "true"
-}
-
 apply plugin: 'com.android.library'
+// Runs codegen for the TurboModule spec and the Fabric component (src/specs).
+apply plugin: 'com.facebook.react'
 
 def reactNativeArchitectures() {
   def value = project.getProperties().get("reactNativeArchitectures")
@@ -128,10 +112,6 @@ logger.warn("react-native-skia: node_modules/ found at: ${nodeModules}")
 def sourceBuild = false
 def defaultDir
 
-if (isNewArchitectureEnabled()) {
-    apply plugin: "com.facebook.react"
-}
-
 if (rootProject.ext.has('reactNativeAndroidRoot')) {
   defaultDir = rootProject.ext.get('reactNativeAndroidRoot')
 } else if (findProject(':ReactAndroid') != null) {
@@ -147,54 +127,18 @@ if (!defaultDir.exists()) {
     )
 }
 
-def prebuiltDir = sourceBuild
-    ? "$nodeModules/react-native/ReactAndroid/src/main/jni/prebuilt/lib"
-    : "$buildDir/react-native-0*/jni"
-
-
-def buildType = "debug"
-if (gradle.startParameter.taskRequests.args[0].toString().contains("Release")) {
-    buildType = "release"
-} else if (gradle.startParameter.taskRequests.args[0].toString().contains("Debug")) {
-    buildType = "debug"
-}
-
 def reactProperties = new Properties()
 file("$nodeModules/react-native/ReactAndroid/gradle.properties").withInputStream { reactProperties.load(it) }
 def FULL_RN_VERSION =  (System.getenv("REACT_NATIVE_OVERRIDE_VERSION") ?: reactProperties.getProperty("VERSION_NAME"))
 def REACT_NATIVE_VERSION = FULL_RN_VERSION.split("\\.")[1].toInteger()
-def ENABLE_PREFAB = REACT_NATIVE_VERSION > 68
 
 logger.warn("react-native-skia: RN Version: ${REACT_NATIVE_VERSION} / ${FULL_RN_VERSION}")
 logger.warn("react-native-skia: isSourceBuild: ${sourceBuild}")
-logger.warn("react-native-skia: PrebuiltDir: ${prebuiltDir}")
-logger.warn("react-native-skia: buildType: ${buildType}")
 logger.warn("react-native-skia: buildDir: ${buildDir}")
 logger.warn("react-native-skia: node_modules: ${nodeModules}")
-logger.warn("react-native-skia: Enable Prefab: ${ENABLE_PREFAB}")
-
-buildscript {
-    // The Android Gradle plugin is only required when opening the android folder stand-alone.
-    // This avoids unnecessary downloads and potential conflicts when the library is included as a
-    // module dependency in an application project.
-    // ref: https://docs.gradle.org/current/userguide/tutorial_using_tasks.html#sec:build_script_external_de
```

**File**: `packages/skia/android/cpp/jni/JniSkiaManager.cpp` (modified, +3/-45)
```diff
@@ -7,47 +7,6 @@
 
 #include "RNSkManager.h"
 
-namespace {
-
-#if REACT_NATIVE_VERSION >= 75
-using CallFuncType = facebook::react::CallFunc;
-#else
-using CallFuncType = std::function<void()>;
-#endif
-
-// For bridgeless mode, currently we don't have a way to get the JSCallInvoker
-// from Java. Workaround to use RuntimeExecutor to simulate the behavior of
-// JSCallInvoker. In the future when bridgeless mode is a standard and no more
-// backward compatible to be considered, we could just use RuntimeExecutor to
-// run task on JS thread.
-class BridgelessJSCallInvoker : public facebook::react::CallInvoker {
-public:
-  explicit BridgelessJSCallInvoker(
-      facebook::react::RuntimeExecutor runtimeExecutor)
-      : runtimeExecutor_(std::move(runtimeExecutor)) {}
-
-  void invokeAsync(CallFuncType &&func) noexcept override {
-    runtimeExecutor_([func = std::move(func)](facebook::jsi::Runtime &runtime) {
-#if REACT_NATIVE_VERSION >= 75
-      func(runtime);
-#else
-      func();
-#endif
-    });
-  }
-
-  void invokeSync(CallFuncType &&func) override {
-    throw std::runtime_error(
-        "Synchronous native -> JS calls are currently not supported.");
-  }
-
-private:
-  facebook::react::RuntimeExecutor runtimeExecutor_;
-
-}; // class BridgelessJSCallInvoker
-
-} // namespace
-
 namespace RNSkia {
 
 namespace jsi = facebook::jsi;
@@ -65,12 +24,11 @@ void JniSkiaManager::registerNatives() {
 jni::local_ref<jni::HybridClass<JniSkiaManager>::jhybriddata>
 JniSkiaManager::initHybrid(
     jni::alias_ref<jhybridobject> jThis, jlong jsContext,
-    jni::alias_ref<facebook::react::JRuntimeExecutor::javaobject>
-        jRuntimeExecutor,
+    jni::alias_ref<facebook::react::CallInvokerHolder::javaobject>
+        jsCallInvokerHolder,
     JavaPlatformContext skiaContext) {
 
-  auto jsCallInvoker = std::make_shared<BridgelessJSCallInvoker>(
-      jRuntimeExecutor->cthis()->get());
+  auto jsCallInvoker = jsCallInvokerHolder->cthis()->getCallInvoker();
   // cast from JNI hybrid objects to C++ instances
   return makeCxxInstance(jThis, reinterpret_cast<jsi::Runtime *>(jsContext),
                          jsCallInvoker, skiaContext->cthis());
```

---

### Incident Patch 5: `48b33020` (2026-09-23)
**Commit Message**: fix(🎨): honor the optional paint and blend mode in drawPatch (#4076)

SkCanvas.drawPatch declares `mode` and `paint` as optional, but neither the
native nor the web implementation accepted their absence.

Natively, the paint was read from `arguments[4]` whenever `count >= 4`, so a
four-argument call read one slot past the end of the JSI argument array, and
the resulting null paint was then dereferenced, crashing the app. The blend
mode was read with an unconditional `arguments[3].asNumber()`, which throws
for a null or omitted mode. On web the missing paint reached CanvasKit as
`undefined` and threw a TypeError.

Both layers now fall back to a default-constructed paint and to
SkBlendMode::kModulate, matching the four-argument SkCanvas::drawPatch
overload and CanvasKit's own default.

drawAtlas had the same class of bug: its blend mode lives at index 4 but was
guarded by `count > 5`, so a five-argument call silently dropped it. Skia
ignores that blend mode when no colors are supplied, so no rendering changes,
but the guard was off by one.

**File**: `packages/skia/cpp/api/CustomBlendModes.h` (modified, +17/-0)
```diff
@@ -1,5 +1,8 @@
 #pragma once
 
+#include <stdexcept>
+#include <string>
+
 #include "include/core/SkBlender.h"
 #include "include/core/SkPaint.h"
 #include "include/core/SkString.h"
@@ -94,4 +97,18 @@ inline void applyBlendMode(SkPaint &paint, int blendModeValue) {
   }
 }
 
+// Converts a JS blend mode value to an SkBlendMode for the Skia entry points
+// that take a plain SkBlendMode rather than a paint (drawPatch, drawVertices,
+// drawAtlas, drawColor). The custom blend modes above are implemented as
+// blenders on an SkPaint and have no SkBlendMode equivalent, so they - and any
+// other out of range value - are rejected instead of being cast blindly.
+inline SkBlendMode toBlendMode(double blendModeValue) {
+  auto value = static_cast<int>(blendModeValue);
+  if (value < 0 || value > static_cast<int>(SkBlendMode::kLastMode)) {
+    throw std::invalid_argument("Unsupported blend mode: " +
+                                std::to_string(value));
+  }
+  return static_cast<SkBlendMode>(value);
+}
+
 } // namespace RNSkia
```

**File**: `packages/skia/cpp/api/JsiSkCanvas.h` (modified, +19/-10)
```diff
@@ -5,6 +5,7 @@
 #include <utility>
 #include <vector>
 
+#include "CustomBlendModes.h"
 #include "JsiSkConverters.h"
 #include "JsiSkFont.h"
 #include "JsiSkImage.h"
@@ -226,8 +227,7 @@ class JsiSkCanvas : public JsiSkNativeObject<JsiSkCanvas> {
 
   void drawVertices(sk_sp<SkVertices> vertices, double blendMode,
                     std::shared_ptr<SkPaint> paint) {
-    _canvas->drawVertices(vertices, static_cast<SkBlendMode>(blendMode),
-                          *paint);
+    _canvas->drawVertices(vertices, toBlendMode(blendMode), *paint);
   }
 
   JSI_HOST_FUNCTION(drawPatch) {
@@ -287,11 +287,19 @@ class JsiSkCanvas : public JsiSkNativeObject<JsiSkCanvas> {
       }
     }
 
-    auto paint =
-        count >= 4 ? JsiSkPaint::fromValue(runtime, arguments[4]) : nullptr;
-    auto blendMode = static_cast<SkBlendMode>(arguments[3].asNumber());
+    auto blendMode =
+        count >= 4 && !arguments[3].isNull() && !arguments[3].isUndefined()
+            ? toBlendMode(arguments[3].asNumber())
+            : SkBlendMode::kModulate;
+
+    std::shared_ptr<SkPaint> paint;
+    if (count >= 5 && !arguments[4].isNull() && !arguments[4].isUndefined()) {
+      paint = JsiSkPaint::fromValue(runtime, arguments[4]);
+    }
+    SkPaint defaultPaint;
     _canvas->drawPatch(cubics.data(), colors.empty() ? nullptr : colors.data(),
-                       texs.empty() ? nullptr : texs.data(), blendMode, *paint);
+                       texs.empty() ? nullptr : texs.data(), blendMode,
+                       paint ? *paint : defaultPaint);
     return jsi::Value::undefined();
   }
 
@@ -392,7 +400,7 @@ class JsiSkCanvas : public JsiSkNativeObject<JsiSkCanvas> {
 
   void drawColor(JsiColor cl, JsiOptional<double> mode) {
     if (mode.has_value()) {
-      _canvas->drawColor(cl, static_cast<SkBlendMode>(*mode));
+      _canvas->drawColor(cl, toBlendMode(*mode));
     } else {
       _canvas->drawColor(cl);
     }
@@ -411,9 +419,10 @@ class JsiSkCanvas : public JsiSkNativeObject<JsiSkCanvas> {
     auto rects = arguments[1].asObject(runtime).asArray(runtime);
     auto transforms = arguments[2].asObject(runtime).asArray(runtime);
     auto paint = JsiSkPaint::fromValue(runtime, arguments[3]);
-    auto blendMode = count > 5 && !arguments[4].isUndefined()
-                         ? static_cast<SkBlendMode>(arguments[4].asNumber())
-                         : SkBlendMode::kDstOver;
+    auto blendMode =
+        count > 4 && !arguments[4].isNull() && !arguments[4].isUndefined()
+            ? toBlendMode(arguments[4].asNumber())
+            : SkBlendMode::kDstOver;
 
     std::vector<SkRSXform> xforms;
     int xformsSize = static_cast<int>(transforms.size(runtime));
```

**File**: `packages/skia/src/renderer/__tests__/e2e/CoonPatch.spec.tsx` (modified, +127/-0)
```diff
@@ -4,6 +4,8 @@ import { surface } from "../setup";
 import { Fill, Patch } from "../../components";
 import * as SkiaRenderer from "../../index";
 import { checkImage } from "../../../__tests__/setup";
+import { BlendMode, TileMode } from "../../../skia/types";
+import type { SkPaint } from "../../../skia/types";
 
 describe("CoonsPatch", () => {
   it("Renderer", () => {
@@ -71,4 +73,129 @@ describe("CoonsPatch", () => {
     );
     checkImage(img, "snapshots/coons-patch/patch-with-opacity.png");
   });
+  it("should draw a patch when the optional paint and blend mode are omitted", async () => {
+    const result = await surface.eval(
+      (Skia, ctx) => {
+        const size = 64;
+        const C = size / 4;
+        const cubics = [
+          { x: 0, y: 0 },
+          { x: C, y: 0 },
+          { x: size - C, y: 0 },
+          { x: size, y: 0 },
+          { x: size, y: C },
+          { x: size, y: size - C },
+          { x: size, y: size },
+          { x: size - C, y: size },
+          { x: C, y: size },
+          { x: 0, y: size },
+          { x: 0, y: size - C },
+          { x: 0, y: C },
+        ];
+        const colors = [
+          Skia.Color("cyan"),
+          Skia.Color("magenta"),
+          Skia.Color("yellow"),
+          Skia.Color("lightblue"),
+        ];
+        const render = (paint: SkPaint | null) => {
+          const offscreen = Skia.Surface.MakeOffscreen(size, size)!;
+          const canvas = offscreen.getCanvas();
+          if (paint) {
+            canvas.drawPatch(cubics, colors, null, ctx.modulate, paint);
+          } else {
+            canvas.drawPatch(cubics, colors);
+          }
+          offscreen.flush();
+          return Array.from(offscreen.makeImageSnapshot().readPixels()!);
+        };
+        const defaultPaint = Skia.Paint();
+        defaultPaint.setAntiAlias(false);
+        const reference = render(defaultPaint);
+        const implicit = render(null);
+        let mismatches = 0;
+        for (let i = 0; i < reference.length; i++) {
+          if (reference[i] !== implicit[i]) {
+            mismatches++;
+          }
+        }
+        return [mismatches, reference.filter((value) => value !== 0).length];
+      },
+      { modulate: BlendMode.Modulate }
+    );
+    expect(result[1]).toBeGreaterThan(0);
+    expect(result[0]).toBe(0);
+  });
+  it("should blend the patch colors with modulate when no blend mode is given", async () => {
+    const result = await surface.eval(
+      (Skia, ctx) => {
+        const size = 64;
+        const C = size / 4;
+        const cubics = [
+          { x: 0, y: 0 },
+          { x: C, y: 0 },
+          { x: size - C, y: 0 },
+          { x: size, y: 0 },
+          { x: size, y: C },
+          { x: size, y: size - C },
+          { x: size, y: size },
+          { x: size - C, y: size },
+          { x: C, y: size },
+          { x: 0, y: size },
+          { x: 0, y: size - C },
+          { x: 0, y: C },
+        ];
+        const colors = [
+          Skia.Color("cyan"),
+          Skia.Color("magenta"),
+          Skia.Color("yellow"),
+          Skia.Color("lightblue"),
+        ];
+        const texs = [
+          { x: 0, y: 0 },
+          { x: size, y: 0 },
+          { x: size, y: size },
+          { x: 0, y: size },
+        ];
+        const render = (mode: BlendMode | null) => {
+          const offscreen = Skia.Surface.MakeOffscreen(size, size)!;
+          const paint = Skia.Paint();
+          paint.setAntiAlias(false);
+          paint.setShader(
+            Skia.Shader.MakeLinearGradient(
+              { x: 0, y: 0 },
+              { x: size, y: size },
+              [Skia.Color("red"), Skia.Color("blue")],
+              null,
+              ctx.clamp
+            )
+          );
+          offscreen.getCanvas().drawPatch(cubics, colors, texs, mode, paint);
+          offscreen.flush();
+          return Array.from(offscreen.makeImageSnapshot().readPixels()!);
+        };
+        const count 
```

**File**: `packages/skia/src/skia/web/JsiSkCanvas.ts` (modified, +14/-9)
```diff
@@ -205,15 +205,20 @@ export class JsiSkCanvas
     mode?: BlendMode | null,
     paint?: SkPaint
   ) {
-    this.ref.drawPatch(
-      cubics.map(({ x, y }) => [x, y]).flat(),
-      colors,
-      texs ? texs.flatMap((p) => Array.from(JsiSkPoint.fromValue(p))) : texs,
-      mode !== undefined && mode !== null
-        ? getEnum(this.CanvasKit, "BlendMode", mode)
-        : null,
-      paint ? JsiSkPaint.fromValue(paint) : undefined
-    );
+    const defaultPaint = paint ? null : new this.CanvasKit.Paint();
+    try {
+      this.ref.drawPatch(
+        cubics.map(({ x, y }) => [x, y]).flat(),
+        colors,
+        texs ? texs.flatMap((p) => Array.from(JsiSkPoint.fromValue(p))) : texs,
+        mode !== undefined && mode !== null
+          ? getEnum(this.CanvasKit, "BlendMode", mode)
+          : null,
+        paint ? JsiSkPaint.fromValue(paint) : defaultPaint!
+      );
+    } finally {
+      defaultPaint?.delete();
+    }
   }
 
   restoreToCount(saveCount: number) {
```

---

### Incident Patch 6: `172fcad1` (2026-09-15)
**Commit Message**: fix(🐯): handle invalid SVG parse results (#4065)

Co-authored-by: William Candillon <wcandillon@gmail.com>

**File**: `packages/skia/cpp/api/JsiSkSVGFactory.h` (modified, +4/-0)
```diff
@@ -116,6 +116,10 @@ class JsiSkSVGFactory : public JsiSkNativeObject<JsiSkSVGFactory> {
     builder.setResourceProvider(provider);
 
     auto svg_dom = builder.make(*stream);
+    if (!svg_dom) {
+      return jsi::Value::null();
+    }
+
     return makeJsiObject(
         runtime, std::make_shared<JsiSkSVG>(getContext(), std::move(svg_dom)));
   }
```

**File**: `packages/skia/src/renderer/__tests__/e2e/SVG.spec.tsx` (modified, +18/-0)
```diff
@@ -63,6 +63,24 @@ describe("Displays SVGs", () => {
       expect(height).toBe(20);
     }
   );
+
+  itRunsE2eOnly("should return null for malformed SVG strings", async () => {
+    const isNull = await surface.eval((Skia) => {
+      return Skia.SVG.MakeFromString("<not-svg>") === null;
+    });
+    expect(isNull).toBe(true);
+  });
+
+  itRunsE2eOnly("should return null for malformed SVG data", async () => {
+    const isNull = await surface.eval((Skia) => {
+      const data = Skia.Data.fromBytes(
+        new Uint8Array([60, 110, 111, 116, 45, 115, 118, 103, 62])
+      );
+      return Skia.SVG.MakeFromData(data) === null;
+    });
+    expect(isNull).toBe(true);
+  });
+
   itRunsE2eOnly("should render the SVG scaled properly", async () => {
     const { rect } = importSkia();
     const { width, height } = surface;
```

---

### Incident Patch 7: `8344c6ab` (2026-09-15)
**Commit Message**: chore: fix typo in emoji rendering paragraph (#4066)

**File**: `apps/docs/docs/text/paragraph.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ React Native Skia offers an API to perform text layouts using the Skia Paragraph
 ## Hello World
 
 In the example below, we create a simple paragraph based on custom fonts.
-The emojis will be renderer using the emoji font available on the platform.
+The emojis will be rendered using the emoji font available on the platform.
 Other system fonts are available as well.
 
 ```tsx twoslash
```

---

### Incident Patch 8: `3c27eab2` (2026-09-15)
**Commit Message**: fix(🗿): fix default Skia graphite texture usage (#4064)

**File**: `packages/skia/cpp/rnskia/RNDawnWindowContext.h` (modified, +22/-0)
```diff
@@ -82,6 +82,7 @@ class DawnWindowContext : public WindowContext {
     config.width = _width;
     config.height = _height;
     config.presentMode = wgpu::PresentMode::Fifo;
+    config.usage = supportedSurfaceUsage();
 #ifdef __APPLE__
     config.alphaMode = wgpu::CompositeAlphaMode::Premultiplied;
 #endif
@@ -93,6 +94,27 @@ class DawnWindowContext : public WindowContext {
 #endif
   }
 
+  // Graphite needs more than RenderAttachment on the swapchain texture:
+  // TextureBinding so a render pass can reload the existing contents through
+  // LoadOp::ExpandResolveTexture (any backdrop filter or mid-frame readback
+  // splits the pass), and CopySrc for copy tasks. Only request what the
+  // surface reports as supported.
+  wgpu::TextureUsage supportedSurfaceUsage() {
+    wgpu::TextureUsage usage = wgpu::TextureUsage::RenderAttachment;
+    wgpu::SurfaceCapabilities capabilities;
+    if (_surface.GetCapabilities(_device.GetAdapter(), &capabilities) !=
+        wgpu::Status::Success) {
+      return usage;
+    }
+    for (auto extra :
+         {wgpu::TextureUsage::TextureBinding, wgpu::TextureUsage::CopySrc}) {
+      if (capabilities.usages & extra) {
+        usage |= extra;
+      }
+    }
+    return usage;
+  }
+
   bool surfaceSupportsFormat(wgpu::TextureFormat format) {
     wgpu::SurfaceCapabilities capabilities;
     if (_surface.GetCapabilities(_device.GetAdapter(), &capabilities) !=
```

---

### Incident Patch 9: `2de503ca` (2026-09-08)
**Commit Message**: fix(🌎): fix bogus undefined tests (#4053)

**File**: `packages/skia/src/__tests__/snapshots/drawings/mask-composite-clipped-mask.svg` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
+  <defs>
+    <mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
+      <rect width="256" height="256" fill="black"/>
+      <rect x="0" y="0" width="128" height="256" fill="white"/>
+    </mask>
+  </defs>
+  <rect width="256" height="256" fill="#ffffff"/>
+  <g mask="url(#m)">
+    <circle cx="96" cy="128" r="60" fill="rgb(44,243,228)" fill-opacity="0.5"/>
+    <circle cx="160" cy="128" r="60" fill="rgb(255,181,245)" fill-opacity="0.5"/>
+  </g>
+</svg>
```

**File**: `packages/skia/src/__tests__/snapshots/drawings/mask-composite-clipped.svg` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
+  <defs>
+    <clipPath id="left"><rect x="0" y="0" width="128" height="256"/></clipPath>
+  </defs>
+  <rect width="256" height="256" fill="#ffffff"/>
+  <g clip-path="url(#left)">
+    <circle cx="96" cy="128" r="60" fill="rgb(44,243,228)" fill-opacity="0.5"/>
+    <circle cx="160" cy="128" r="60" fill="rgb(255,181,245)" fill-opacity="0.5"/>
+  </g>
+</svg>
```

**File**: `packages/skia/src/__tests__/snapshots/drawings/mask-composite-plain.svg` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
+  <rect width="256" height="256" fill="#ffffff"/>
+  <circle cx="96" cy="128" r="60" fill="rgb(44,243,228)" fill-opacity="0.5"/>
+  <circle cx="160" cy="128" r="60" fill="rgb(255,181,245)" fill-opacity="0.5"/>
+</svg>
```

**File**: `packages/skia/src/__tests__/snapshots/drawings/mask-composite-visible.svg` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
+  <defs>
+    <clipPath id="left"><rect x="0" y="0" width="128" height="256"/></clipPath>
+  </defs>
+  <rect width="256" height="256" fill="#ffffff"/>
+  <g clip-path="url(#left)">
+    <rect x="0" y="0" width="128" height="256" fill="lightblue"/>
+    <circle cx="96" cy="128" r="60" fill="rgb(44,243,228)" fill-opacity="0.5"/>
+    <circle cx="160" cy="128" r="60" fill="rgb(255,181,245)" fill-opacity="0.5"/>
+  </g>
+</svg>
```

**File**: `packages/skia/src/skia/__tests__/ZeroValues.spec.ts` (added, +162/-0)
```diff
@@ -0,0 +1,162 @@
+import fs from "fs";
+import path from "path";
+
+import { BlendMode, FontWeight, ImageFormat } from "../types";
+import type { SkCanvas, Skia, SkSurface } from "../types";
+import type { JsiSkCanvas } from "../web/JsiSkCanvas";
+import { JsiSkTextStyle } from "../web/JsiSkTextStyle";
+
+import { setupSkia } from "./setup";
+
+// Every case in this file exercises a value of 0 that is a legitimate input
+// (BlendMode.Clear, a JPEG quality of 0, FontWeight.Invisible, a zero stroke
+// width, ...). The Web implementation used to test these with a truthiness
+// check and silently treat them as "not provided".
+
+const asset = (name: string) =>
+  fs.readFileSync(path.resolve(__dirname, "assets", name));
+
+const rgbaAt = (canvasOwner: SkSurface, x = 0, y = 0) => {
+  const image = canvasOwner.makeImageSnapshot();
+  const pixels = image.readPixels() as Uint8Array;
+  const i = (y * image.width() + x) * 4;
+  return Array.from(pixels.slice(i, i + 4));
+};
+
+const makeGradientImage = (Skia: Skia, size = 64) => {
+  const surface = Skia.Surface.Make(size, size)!;
+  const canvas = surface.getCanvas();
+  const paint = Skia.Paint();
+  paint.setShader(
+    Skia.Shader.MakeLinearGradient(
+      { x: 0, y: 0 },
+      { x: size, y: size },
+      [Skia.Color("red"), Skia.Color("green"), Skia.Color("blue")],
+      null,
+      0
+    )
+  );
+  canvas.drawRect(Skia.XYWHRect(0, 0, size, size), paint);
+  surface.flush();
+  return surface.makeImageSnapshot();
+};
+
+const ckRef = (canvas: SkCanvas) => (canvas as JsiSkCanvas).ref;
+
+describe("Zero is a valid value", () => {
+  describe("Canvas", () => {
+    it("drawColor honors BlendMode.Clear", () => {
+      const { Skia, surface, canvas } = setupSkia(4, 4);
+      canvas.drawColor(Skia.Color("red"));
+      canvas.drawColor(Skia.Color("blue"), BlendMode.Clear);
+      surface.flush();
+      expect(rgbaAt(surface)).toEqual([0, 0, 0, 0]);
+    });
+
+    it("drawPatch forwards BlendMode.Clear", () => {
+      const { Skia, canvas, CanvasKit } = setupSkia(4, 4);
+      const spy = jest.spyOn(ckRef(canvas), "drawPatch");
+      const cubics = Array.from({ length: 12 }, (_, i) => ({ x: i, y: i }));
+      canvas.drawPatch(
+        cubics,
+        [
+          Skia.Color("red"),
+          Skia.Color("green"),
+          Skia.Color("blue"),
+          Skia.Color("white"),
+        ],
+        null,
+        BlendMode.Clear,
+        Skia.Paint()
+      );
+      expect(spy).toHaveBeenCalledTimes(1);
+      expect(spy.mock.calls[0][3]).toBe(CanvasKit.BlendMode.Clear);
+      spy.mockRestore();
+    });
+
+    it("drawAtlas forwards BlendMode.Clear", () => {
+      const { Skia, canvas, CanvasKit } = setupSkia(4, 4);
+      const spy = jest.spyOn(ckRef(canvas), "drawAtlas");
+      const image = makeGradientImage(Skia, 8);
+      canvas.drawAtlas(
+        image,
+        [Skia.XYWHRect(0, 0, 8, 8)],
+        [Skia.RSXform(1, 0, 0, 0)],
+        Skia.Paint(),
+        BlendMode.Clear,
+        [Skia.Color("red")]
+      );
+      expect(spy).toHaveBeenCalledTimes(1);
+      expect(spy.mock.calls[0][4]).toBe(CanvasKit.BlendMode.Clear);
+      spy.mockRestore();
+    });
+  });
+
+  describe("Image", () => {
+    it("encodeToBytes honors a quality of 0", () => {
+      const { Skia } = setupSkia();
+      const image = makeGradientImage(Skia);
+      const lowest = image.encodeToBytes(ImageFormat.JPEG, 0);
+      const highest = image.encodeToBytes(ImageFormat.JPEG, 100);
+      // Quality 0 used to be dropped and fall back to the encoder default,
+      // which produced the same bytes as quality 100.
+      expect(lowest.byteLength).toBeLessThan(highest.byteLength);
+    });
+  });
+
+  describe("TextStyle", () => {
+    it("keeps FontWeight.Invisible", () => {
+      const style = JsiSkTextStyle.toTextStyle({
+        fontStyle: { weight: FontWeight.Invisible },
+      });
+      expect(style.fontStyle?.weight).toEqual({ value: FontWeight.Invisible });
+    });
+

```

---

### Incident Patch 10: `fbff3d86` (2026-09-08)
**Commit Message**: fix(🐛): don't drop the ImageSVG offset when x or y is zero (#4050)

drawImageSVG() gated the canvas translation on `x && y`, so an offset
with a zero component was treated as absent and the SVG was drawn at
the origin instead. `<ImageSVG x={0} y={100} />` and a `rect` starting
on either axis at 0 were both affected. The native recorder already
translates in that case, so the JS player diverged from it.

Co-authored-by: William Candillon <wcandillon@gmail.com>

**File**: `packages/skia/src/sksg/Recorder/commands/Drawing.ts` (modified, +2/-1)
```diff
@@ -297,7 +297,8 @@ export const drawImageSVG = (ctx: DrawingContext, props: ImageSVGProps) => {
     return;
   }
   canvas.save();
-  if (x && y) {
+  // An offset of 0 is a valid position, so it must not be read as "unset".
+  if (x !== undefined && y !== undefined) {
     canvas.translate(x, y);
   }
   canvas.drawSvg(svg, width, height);
```

**File**: `packages/skia/src/sksg/__tests__/ImageSVG.spec.tsx` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import React from "react";
+import type { ReactElement } from "react";
+
+import { importSkia } from "../../renderer/__tests__/setup";
+import type { SkSVG } from "../../skia/types";
+import { SkiaSGRoot } from "../Reconciler";
+
+// drawSvg() rasterizes through a DOM image on Web, so it is stubbed out here:
+// these tests only check where the SVG is placed on the canvas.
+const recordTranslations = async (element: ReactElement) => {
+  const { Skia } = importSkia();
+  const root = new SkiaSGRoot(Skia);
+  await root.render(element);
+  const surface = Skia.Surface.Make(128, 128)!;
+  const canvas = surface.getCanvas();
+  const translate = jest.spyOn(canvas, "translate");
+  jest.spyOn(canvas, "drawSvg").mockImplementation(() => {});
+  root.drawOnCanvas(canvas);
+  root.unmount();
+  return translate;
+};
+
+describe("ImageSVG", () => {
+  const svg = {} as SkSVG;
+
+  it("offsets an SVG whose x is zero", async () => {
+    const translate = await recordTranslations(
+      <skImageSVG svg={svg} x={0} y={100} width={64} height={64} />
+    );
+    expect(translate).toHaveBeenCalledWith(0, 100);
+  });
+
+  it("offsets an SVG whose y is zero", async () => {
+    const translate = await recordTranslations(
+      <skImageSVG svg={svg} x={100} y={0} width={64} height={64} />
+    );
+    expect(translate).toHaveBeenCalledWith(100, 0);
+  });
+
+  it("offsets an SVG placed with a rect whose x is zero", async () => {
+    const { Skia } = importSkia();
+    const translate = await recordTranslations(
+      <skImageSVG svg={svg} rect={Skia.XYWHRect(0, 100, 64, 64)} />
+    );
+    expect(translate).toHaveBeenCalledWith(0, 100);
+  });
+});
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
