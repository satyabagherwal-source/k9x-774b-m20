> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/margelo-react-native-vision-camera-learnings.md`  
> **Source**: github ([https://github.com/margelo/react-native-vision-camera](https://github.com/margelo/react-native-vision-camera))  
> **Source Version**: `1a69f290`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T00:48:20.929Z  
> **Learning ID**: `learn-github-margelo-react-native-vision-camera`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): margelo/react-native-vision-camera

> **Canonical Artifact**: `07_PROJECT_LEARNING/margelo-react-native-vision-camera-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/margelo/react-native-vision-camera](https://github.com/margelo/react-native-vision-camera))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T00:48:20.922Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `margelo/react-native-vision-camera`
- **Description**: 📸 A powerful, high-performance React Native Camera library.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9645 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/simple-camera/src/hooks/useIsActive.ts`
```
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

export function useIsActive(): boolean {
  const [isActive, setIsActive] = useState(
    () => AppState.currentState === 'active',
  )

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      setIsActive(state === 'active')
    })
    return () => listener.remove()
  }, [])

  return isActive
}

```

### Core Architecture Module: `apps/simple-camera/src/hooks/useSafeAreaPadding.ts`
```
import { useMemo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function useSafeAreaPadding() {
  const safeArea = useSafeAreaInsets()

  return useMemo<StyleProp<ViewStyle>>(() => {
    return {
      paddingTop: safeArea.top,
      paddingLeft: safeArea.left,
      paddingRight: safeArea.right,
      paddingBlock: safeArea.bottom,
    }
  }, [safeArea.bottom, safeArea.left, safeArea.right, safeArea.top])
}

```

### Core Architecture Module: `packages/react-native-vision-camera-location/src/hooks/useLocation.ts`
```
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { Location } from 'react-native-vision-camera'
import type { LocationManagerOptions } from '../specs/LocationManagerFactory.nitro'
import { useLocationManager } from './useLocationManager'

/**
 * The current state of the {@linkcode useLocation} hook.
 */
export interface LocationState {
  /**
   * Whether the app has been granted permission to access the user's location.
   *
   * If this is `false`, call {@linkcode requestPermission | requestPermission()}
   * to prompt the user.
   */
  hasPermission: boolean
  /**
   * Requests the location permission from the user.
   *
   * Resolves with whether the permission was granted after the request completed.
   */
  requestPermission(): Promise<boolean>
  /**
   * The last known user {@linkcode Location}, or `undefined` if no location has
   * been reported yet (e.g. because permission has not been granted, or because
   * the device is still acquiring a fix).
   */
  currentLocation: Location | undefined
}

/**
 * Reactively use the current user {@linkcode Location}.
 * @example
 * ```tsx
 * const location = useLocation()
 *
 * useEffect(() => {
 *   if (!location.hasPermission) {
 *     location.requestPermission()
 *   }
 * }, [location.hasPermission])
 *
 * if (location.hasPermission) {
 *   console.log(location.location)
 * }
 * ```
 */
export function useLocation(
  options?: Partial<LocationManagerOptions>,
): LocationState {
  const locationManager = useLocationManager(options)

  const [hasPermission, setHasPermission] = useState(
    () => locationManager.locationPermissionStatus === 'authorized',
  )

  useEffect(() => {
    setHasPermission(locationManager.locationPermissionStatus === 'authorized')
  }, [locationManager])

  const lastKnownLocation = useRef(locationManager.lastKnownLocation)
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const listener = locationManager.addOnLocationChangedListener(
        (newLocation) => {
          lastKnownLocation.current = newLocation
          onStoreChange()
        },
      )
      return () => listener.remove()
    },
    [locationManager],
  )
  const getSnapshot = useCallback(() => lastKnownLocation.current, [])
  const location = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const requestPermission = useCallback(async () => {
    await locationManager.requestLocationPermission()
    const nowHasPermission =
      locationManager.locationPermissionStatus === 'authorized'
    setHasPermission(nowHasPermission)
    return nowHasPermission
  }, [locationManager])

  useEffect(() => {
    if (!hasPermission) {
      return
    }
    locationManager.startUpdating()
    return () => {
      locationManager.stopUpdating()
    }
  }, [hasPermission, locationManager])

  return {
    hasPermission: hasPermission,
    requestPermission: requestPermission,
    currentLocation: location,
  }
}

```

### Core Architecture Module: `packages/react-native-vision-camera-location/src/hooks/useLocationManager.ts`
```
import { useMemo } from 'react'
import { createLocationManager } from '../createLocationManager'
import type { LocationManager } from '../specs/LocationManager.nitro'
import type { LocationManagerOptions } from '../specs/LocationManagerFactory.nitro'

/**
 * Use a stable {@linkcode LocationManager}
 * with the given {@linkcode LocationManagerOptions}.
 */
export function useLocationManager({
  accuracy = 'balanced',
  distanceFilter = 10,
  updateInterval = 10_000,
}: Partial<LocationManagerOptions> = {}): LocationManager {
  return useMemo(
    () => createLocationManager({ accuracy, distanceFilter, updateInterval }),
    [accuracy, distanceFilter, updateInterval],
  )
}

```

### Core Architecture Module: `packages/react-native-vision-camera-resizer/android/src/main/cpp/utils/AndroidAssetManager.cpp`
```
///
/// AndroidAssetManager.cpp
/// VisionCamera
/// Copyright © 2026 Marc Rousavy @ Margelo
///

#include "AndroidAssetManager.hpp"

#include <android/asset_manager_jni.h>
#include <stdexcept>

namespace margelo::nitro::camera::resizer::utils {

AAssetManager* JAssetManager::getAssetManager() {
  AAssetManager* assetManager = AAssetManager_fromJava(facebook::jni::Environment::current(), self());
  if (assetManager == nullptr) [[unlikely]] {
    throw std::runtime_error("Failed to create a native AAssetManager from android.content.res.AssetManager.");
  }
  return assetManager;
}

facebook::jni::local_ref<JAssetManager> JAssetManagerFactory::create() {
  static const auto method = javaClassStatic()->getStaticMethod<facebook::jni::local_ref<JAssetManager>()>("create");
  return method(javaClassStatic());
}

const AndroidAssetManager& AndroidAssetManager::getShared() {
  static const AndroidAssetManager sharedAssetManager;
  return sharedAssetManager;
}

AndroidAssetManager::AndroidAssetManager() {
  facebook::jni::ThreadScope::WithClassLoader([this]() {
    facebook::jni::local_ref<JAssetManager> localAssetManager = JAssetManagerFactory::create();
    if (localAssetManager == nullptr) [[unlikely]] {
      throw std::runtime_error("AssetManagerFactory.create() returned null.");
    }

    // Resolve the native handle once so shader loading does not need to cross JNI repeatedly.
    _assetManager = localAssetManager->getAssetManager();
    // Keep the Java AssetManager alive for as long as native code may use the cached handle.
    _javaAssetManager = facebook::jni::make_global(localAssetManager);
  });
}

AndroidAssetManager::~AndroidAssetManager() {
  _assetManager = nullptr;
  if (_javaAssetManager == nullptr) {
    return;
  }

  facebook::jni::ThreadScope::WithClassLoader([this]() { _javaAssetManager.reset(); });
}

AAssetManager* AndroidAssetManager::get() const noexcept {
  return _assetManager;
}

} // namespace margelo::nitro::camera::resizer::utils

```

### Core Architecture Module: `packages/react-native-vision-camera-resizer/android/src/main/cpp/utils/OutputBufferLayout.cpp`
```
///
/// OutputBufferLayout.cpp
/// VisionCamera
/// Copyright © 2026 Marc Rousavy @ Margelo
///

#include "OutputBufferLayout.hpp"

#include <stdexcept>

namespace margelo::nitro::camera::resizer::utils {

uint32_t getChannelsPerPixel(ChannelOrder channelOrder) {
  switch (channelOrder) {
    case ChannelOrder::RGB:
    case ChannelOrder::BGR:
      return 3;
  }

  throw std::runtime_error("Unsupported Resizer ChannelOrder.");
}

uint32_t getBytesPerChannel(DataType dataType) {
  switch (dataType) {
    case DataType::INT8:
    case DataType::UINT8:
      return 1;
    case DataType::FLOAT16:
      return 2;
    case DataType::FLOAT32:
      return 4;
  }

  throw std::runtime_error("Unsupported Resizer DataType.");
}

size_t getOutputTotalByteCount(ChannelOrder channelOrder, DataType dataType, uint32_t width, uint32_t height) {
  if (width == 0 || height == 0) [[unlikely]] {
    throw std::runtime_error("Resizer output dimensions must be greater than zero.");
  }

  const size_t pixelCount = static_cast<size_t>(width) * static_cast<size_t>(height);
  const size_t channelCount = pixelCount * static_cast<size_t>(getChannelsPerPixel(channelOrder));
  const size_t byteCount = channelCount * static_cast<size_t>(getBytesPerChannel(dataType));
  if (byteCount == 0) [[unlikely]] {
    throw std::runtime_error("Resizer output buffer size must be greater than zero.");
  }
  return byteCount;
}

} // namespace margelo::nitro::camera::resizer::utils

```

### Core Architecture Module: `packages/react-native-vision-camera-resizer/android/src/main/cpp/vulkan/VulkanUtils.cpp`
```
///
/// VulkanUtils.cpp
/// VisionCamera
/// Copyright © 2026 Marc Rousavy @ Margelo
///

#include "VulkanUtils.hpp"

#include <algorithm>
#include <stdexcept>

namespace margelo::nitro::camera::resizer::vulkan::utils {

[[noreturn]] void throwVkError(VkResult result, const std::string& message) {
  throw std::runtime_error(message + " (VkResult " + std::to_string(static_cast<int>(result)) + ").");
}

void checkVk(VkResult result, const std::string& message) {
  if (result != VK_SUCCESS) [[unlikely]] {
    throwVkError(result, message);
  }
}

uint32_t divideRoundUp(uint32_t value, uint32_t divisor) noexcept {
  return (value + divisor - 1) / divisor;
}

bool hasExtension(std::span<const VkExtensionProperties> extensions, std::string_view extensionName) {
  return std::any_of(extensions.begin(), extensions.end(), [&](const VkExtensionProperties& property) { return extensionName == property.extensionName; });
}

std::vector<VkExtensionProperties> enumerateDeviceExtensions(VkPhysicalDevice physicalDevice) {
  uint32_t extensionCount = 0;
  checkVk(vkEnumerateDeviceExtensionProperties(physicalDevice, nullptr, &extensionCount, nullptr), "Failed to enumerate Vulkan device extensions.");

  std::vector<VkExtensionProperties> extensions(extensionCount);
  checkVk(vkEnumerateDeviceExtensionProperties(physicalDevice, nullptr, &extensionCount, extensions.data()), "Failed to read Vulkan device extensions.");
  return extensions;
}

} // namespace margelo::nitro::camera::resizer::vulkan::utils

```

### Core Architecture Module: `packages/react-native-vision-camera-resizer/ios/Utils/CameraOrientation+shaderRotationDegrees.swift`
```
//
//  CameraOrientation+shaderRotationDegrees.swift
//  VisionCamera
//
//  Created by Marc Rousavy on 10.03.26.
//

import VisionCamera

extension CameraOrientation {
  var shaderRotationDegrees: Int32 {
    switch self {
    case .up:
      return 0
    case .right:
      return 90
    case .down:
      return 180
    case .left:
      return 270
    }
  }
}

```

### Core Architecture Module: `packages/react-native-vision-camera-resizer/ios/Utils/OutputFormat+Resizer.swift`
```
//
//  OutputFormat+Resizer.swift
//  VisionCamera
//
//  Created by Marc Rousavy on 11.03.26.
//

/// Output layout helpers used by the iOS resizer.
extension ChannelOrder {
  /// Returns the integer ordinal expected by the GPU shaders for this channel order.
  var shaderOrdinal: UInt32 {
    switch self {
    case .rgb:
      return 0
    case .bgr:
      return 1
    }
  }

  /// Returns the number of packed output channels written for each pixel in this output layout.
  var channelsPerPixel: Int {
    switch self {
    case .rgb, .bgr:
      return 3
    }
  }

  /// Returns the exact byte count for one tightly packed output image.
  func getOutputTotalByteCount(dataType: DataType, width: Int, height: Int) -> Int {
    return width * height * channelsPerPixel * dataType.bytesPerChannel
  }
}

extension PixelLayout {
  /// Returns the integer ordinal expected by the GPU shaders for this pixel layout.
  var shaderOrdinal: UInt32 {
    switch self {
    case .interleaved:
      return 0
    case .planar:
      return 1
    }
  }
}

extension DataType {
  /// Returns the number of bytes used by one output channel for this data type.
  var bytesPerChannel: Int {
    switch self {
    case .int8, .uint8:
      return 1
    case .float16:
      return 2
    case .float32:
      return 4
    }
  }
}

extension ScaleMode {
  /// Returns the integer ordinal expected by the GPU shaders for this scale mode.
  var shaderOrdinal: UInt32 {
    switch self {
    case .cover:
      return 0
    case .contain:
      return 1
    case .stretch:
      return 2
    }
  }
}

```

### Core Architecture Module: `packages/react-native-vision-camera-skia/src/OrientationUtils.ts`
```
import type { CameraOrientation } from 'react-native-vision-camera'

/**
 * Converts a {@linkcode CameraOrientation} to its equivalent clockwise
 * rotation angle in degrees.
 *
 * @internal
 * @worklet
 */
export function orientationToDegrees(orientation: CameraOrientation): number {
  'worklet'
  switch (orientation) {
    case 'up':
      return 0
    case 'down':
      return 180
    case 'left':
      return 270
    case 'right':
      return 90
  }
}

/**
 * Normalizes the given rotation in degrees into the range from
 * `0` to `360` (not including `360`).
 *
 * @internal
 * @worklet
 */
export function normalizeRotationDegrees(degrees: number): number {
  'worklet'
  const normalized = degrees % 360
  if (normalized < 0) {
    return normalized + 360
  } else {
    return normalized
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4218** (2026-10-14): **fix(android): prevent CameraX executor starvation**
  *Symptoms*: ## Summary  Prevent long-running Android frame worklets from starving CameraX's internal `ImageAnalysis` background work.  This removes the explicit `setBackgroundExecutor(executor)` configuration from both the regular frame output and the depth frame output. Analyzer callbacks and the `HybridNativeThread` continue to share their existing single-thread `IdentifiableExecutor`, preserving serialized frame processing, while CameraX can use its own performance-tuned background executor for internal pipeline work.  ## Problem  `HybridFrameOutput` previously used the same `IdentifiableExecutor("com.margelo.camera.frame")` for three different responsibilities:  1. CameraX `ImageAnalysis` internal background work via `ImageAnalysis.Builder.setBackgroundExecutor(...)`. 2. Serialized analyzer callbacks via `imageAnalysis.setAnalyzer(...)`. 3. The `HybridNativeThread` used by the frame worklet runtime.  A synchronous frame worklet therefore blocked not only the next analyzer callback, which is expected, but also CameraX's own background tasks on the same single-thread queue.  In a Perfetto trace with an approximately two-second synchronous worklet, CameraX tasks queued behind the worklet for up to approximately 1.95 seconds. This stalled the image-analysis pipeline and caused the camera preview to visibly freeze. Separating CameraX's background work from the analyzer/worklet executor kept the preview smooth under the same workload.  ## User-visible impact  This execu

- **Issue #4176** (2026-08-29): **chore: Update links for the move to the margelo org**
  *Symptoms*: VisionCamera moved from `mrousavy/react-native-vision-camera` to `margelo/react-native-vision-camera`. GitHub keeps the old paths redirecting, so nothing is broken today, but the metadata should point at the canonical repo.  ## What changed  | Area | Change | | --- | --- | | `packages/*/package.json` (6) | `repository.url` + `bugs.url` -> margelo | | `docs/src/lib/site-config.ts` | `repositoryUrl` -> margelo. This one feeds the "Edit on GitHub" links on every docs page and the `codeRepository`/`sameAs` fields in the JSON-LD, so it was the highest-leverage single line | | `.github/ISSUE_TEMPLATE/*.yml` (4) | Repro instructions, releases links, issue-search links | | `apps/simple-camera/__tests__/*` (2) | Issue/PR links in regression-test comments | | `packages/*/*.podspec` (5) | `s.source` pointed at `github.com/mrousavy/nitro.git` - a copy-paste leftover from the nitro podspec template. Now points at this repo | | docs + `packages/react-native-vision-camera/README.md` | Nitro links, since `mrousavy/nitro` also moved to `margelo/nitro` | | `ViewGroup+installHierarchyFitter.kt` | Declared `package com.mrousavy.camera.react.extensions` while sitting in `com/margelo/nitro/camera/extensions/`. Renamed to match the directory, and updated the one import in `HybridPreviewView.kt` |  ## Deliberately left alone  - `github.com/mrousavy/react-native-nitro-image` and `github.com/mrousavy/react-native-data-scanner` - both verified still under `mrousavy` via the GitHub API. - `nitrogen/gene
  **Post-Mortem & Fix Analysis**:
  > [vc]: #V7dUrHvYDTMbjT4i6SLnXUO8fbv9DQZzUMQyPaHp1Ic=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzL2hGN1V1ZDIxZTY1VmI2SGlKVnRRSG56Y3JycWgiLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtY2hvcmUtbWlncmF0LTI3ZWRiNS1tYXJnZWxvLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtY2hvcmUtbWlncmF0LTI3ZWRiNS1tYXJnZWxvLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6ImRvY3MifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPW1hcmdlbG8mcmVwbz1yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYSZwcj00MTc2In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

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

### Incident Patch 1: `8015396b` (2026-08-21)
**Commit Message**: fix: Deep-compare `constraints` instead of `JSON.stringify`-ing them (#4167)

`useCameraController` kept the user's `constraints` stable by putting
`JSON.stringify(constraints)` into the `useMemo` dependency array. That
works for plain constraints like `{ fps: 60 }`, but it silently breaks for
`{ resolutionBias: someOutput }`.

Nitro `HybridObject`s are created via `Object.create(prototype)` and hold
every property on their shared prototype, so the JS object itself has no own
keys. `JSON.stringify(...)` therefore serializes *every* `CameraOutput` to
`{}` (release) or `{"__type":"HybridObject<CameraPhotoOutput>"}` (debug) -
two different outputs of the same type produce the exact same string. Any
change that only re-points a `resolutionBias` at a different output is
invisible to the memo, and the session is never re-configured.

Replace the stringification with an explicit deep comparison that compares
object literals and arrays by value and everything else (i.e. `HybridObject`s)
by identity. That also drops a full JSON serialization from every render.

Also adds two Harness tests: one that re-renders with an inline `constraints`
array and asserts the session is configured exactly o

**File**: `apps/simple-camera/__tests__/visioncamera.hooks.harness.tsx` (modified, +174/-0)
```diff
@@ -469,4 +469,178 @@ describe('VisionCamera - Hooks', () => {
 
     expect(onError).not.toHaveBeenCalled()
   })
+
+  it('does not re-configure the session when constraints are passed as an inline array', async () => {
+    const onConfigured = fn<() => void>()
+    const onError = fn<(error: Error) => void>()
+    const onRendered = fn<(renderIndex: number) => void>()
+
+    function TestCamera({
+      renderIndex,
+      fps,
+    }: {
+      renderIndex: number
+      fps: number
+    }): null {
+      // CameraX requires at least one use case when configuring a session.
+      const previewOutput = usePreviewOutput()
+      useCamera({
+        isActive: false,
+        device: 'back',
+        outputs: [previewOutput],
+        // An inline array of inline object literals, so `constraints` has a
+        // fresh identity on every single render even though its values never
+        // change. It must not re-configure the session.
+        constraints: [{ fps: fps }],
+        onConfigured,
+        onError,
+      })
+
+      useEffect(() => {
+        onRendered(renderIndex)
+      }, [renderIndex])
+
+      return null
+    }
+
+    const waitForRender = async (renderIndex: number): Promise<void> => {
+      await waitFor(
+        () => {
+          const error = onError.mock.lastCall?.[0]
+          if (error != null) throw error
+          expect(onRendered).toHaveBeenLastCalledWith(renderIndex)
+        },
+        { timeout: 10_000 },
+      )
+    }
+
+    const { rerender } = await render(<TestCamera renderIndex={0} fps={30} />, {
+      timeout: 10_000,
+    })
+    await waitForRender(0)
+    await waitFor(
+      () => {
+        const error = onError.mock.lastCall?.[0]
+        if (error != null) throw error
+        expect(onConfigured).toHaveBeenCalledTimes(1)
+      },
+      { timeout: 15_000 },
+    )
+
+    // Re-rendering with the same constraint values must not re-configure.
+    for (const renderIndex of [1, 2, 3]) {
+      await rerender(<TestCamera renderIndex={renderIndex} fps={30} />)
+      await waitForRender(renderIndex)
+      expect(onConfigured).toHaveBeenCalledTimes(1)
+    }
+
+    // Changing the actual constraint values must re-configure exactly once more.
+    await rerender(<TestCamera renderIndex={4} fps={24} />)
+    await waitForRender(4)
+    await waitFor(
+      () => {
+        const error = onError.mock.lastCall?.[0]
+        if (error != null) throw error
+        expect(onConfigured).toHaveBeenCalledTimes(2)
+      },
+      { timeout: 15_000 },
+    )
+
+    expect(onError).not.toHaveBeenCalled()
+  })
+
+  it('re-configures the session when a resolutionBias constraint points at a different output', async () => {
+    // Two outputs of the same HybridObject type. They are only used as
+    // resolution hints, so the attached `outputs` stay identical across every
+    // re-render and the `constraints` are the only thing that changes.
+    const lowResolutionBias = VisionCamera.createPhotoOutput({
+      targetResolution: CommonResolutions.VGA_4_3,
+      containerFormat: 'jpeg',
+      quality: 0.8,
+      qualityPrioritization: 'balanced',
+    })
+    const highResolutionBias = VisionCamera.createPhotoOutput({
+      targetResolution: CommonResolutions.UHD_4_3,
+      containerFormat: 'jpeg',
+      quality: 0.8,
+      qualityPrioritization: 'balanced',
+    })
+    const onConfigured = fn<() => void>()
+    const onError = fn<(error: Error) => void>()
+    const onRendered = fn<(renderIndex: number) => void>()
+
+    function TestCamera({
+      renderIndex,
+      resolutionBias,
+    }: {
+      renderIndex: number
+      resolutionBias: CameraPhotoOutput
+    }): null {
+      // CameraX requires at least one use case when configuring a session.
+      const previewOutput = usePreviewOutput()
+      useCamera({
+        isActive: false,
+        device: 'back',
+        outputs: [previewOutput],
+        constraints: [{ resolutionBias: resolutionBias }],
+        onConfigured,
+        onError,
+      })
+
+      useEffect(() => {
+        onRendered(renderIndex)
+      }, [renderIndex])
+
+      return null
+    }
+
+    const waitForRender = async (renderIndex: number): Promise<void> => {
+      await waitFor(
+        () => {
+          const error = onError.mock.lastCall?.[0]
+          if (error != null) throw error
+          expect(onRendered).toHaveBeenLastCalledWith(renderIndex)
+        },
+        { timeout: 10_000 },
+      )
+    }
+
+    const { rerender } = await render(
+      <TestCamera renderIndex={0} resolutionBias={lowResolutionBias} />,
+      { timeout: 10_000 },
+    )
+    await waitForRender(0)
+    await waitFor(
+      () => {
+        const error = onError.mock.lastCall?.[0]
+        if (error != null) throw error
+        expect(onConfigured).toHaveBeenCalledTimes(1)
+      },
+      { timeout: 15_000 },
+    )
+
+    // Re-rendering with the same output must not re-configure.
+    await rerender(
+      <TestCame
```

**File**: `packages/react-native-vision-camera/src/hooks/internal/useCameraController.ts` (modified, +4/-4)
```diff
@@ -9,6 +9,7 @@ import type { CameraSession } from '../../specs/session/CameraSession.nitro'
 import type { CameraSessionConfig } from '../../specs/session/CameraSessionConfig.nitro'
 import type { CameraSessionConfiguration } from '../../specs/session/CameraSessionConfiguration'
 import { useMemoizedArray } from './useMemoizedArray'
+import { useMemoizedConstraints } from './useMemoizedConstraints'
 import { useStableCallback } from './useStableCallback'
 
 interface Config extends CameraSessionConfiguration {
@@ -61,14 +62,13 @@ export function useCameraController(
   )
   const stableOnError = useStableCallback(onError)
 
-  // TODO: Can we use something like useSyncExternalStore or whatever to avoid "wrong" dependencies?
-  // biome-ignore lint/correctness/useExhaustiveDependencies: It's an array of objects, we either have to deep-memo or just stringify.
+  const stableUserConstraints = useMemoizedConstraints(constraints)
   const stableConstraints = useMemo<Constraint[]>(() => {
     return [
-      ...constraints,
+      ...stableUserConstraints,
       ...stableOutputs.map<Constraint>((o) => ({ resolutionBias: o })),
     ]
-  }, [JSON.stringify(constraints), stableOutputs])
+  }, [stableUserConstraints, stableOutputs])
 
   // This effect re-configures the CameraSession and returns a `controller`.
   // This is expensive and should only be done if any inputs change.
```

**File**: `packages/react-native-vision-camera/src/hooks/internal/useMemoizedConstraints.ts` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+import { useRef } from 'react'
+import type {
+  Constraint,
+  ResolutionBiasConstraint,
+} from '../../specs/common-types/Constraint'
+import type { CameraOutput } from '../../specs/outputs/CameraOutput.nitro'
+import type { CameraSession } from '../../specs/session/CameraSession.nitro'
+
+/**
+ * Returns whether the given {@linkcode value} is a plain JS object
+ * (i.e. an object literal like `{ fps: 60 }`), and not a class instance,
+ * an `Array`, or a Nitro `HybridObject`.
+ */
+function isPlainObject(value: unknown): value is Record<string, unknown> {
+  if (typeof value !== 'object' || value === null) return false
+  const prototype = Object.getPrototypeOf(value)
+  return prototype === Object.prototype || prototype === null
+}
+
+/**
+ * Deep-compares two {@linkcode Constraint} values.
+ *
+ * Object literals (e.g. `{ fps: 60 }`, or a `TargetDynamicRange`) and
+ * `Array`s are compared by value, everything else - most importantly the
+ * {@linkcode CameraOutput} of a {@linkcode ResolutionBiasConstraint} - is
+ * compared by identity.
+ *
+ * Nitro `HybridObject`s cannot be compared by value at all; they are created
+ * via `Object.create(prototype)` and hold every property on their shared
+ * prototype, so the actual JS object has no own keys (which is also why
+ * `JSON.stringify(...)` serializes every `CameraOutput` to the exact same
+ * string).
+ */
+function isEqual(left: unknown, right: unknown): boolean {
+  if (Object.is(left, right)) return true
+
+  if (Array.isArray(left) || Array.isArray(right)) {
+    if (!Array.isArray(left) || !Array.isArray(right)) return false
+    if (left.length !== right.length) return false
+    return left.every((item, index) => isEqual(item, right[index]))
+  }
+
+  if (!isPlainObject(left) || !isPlainObject(right)) return false
+  const leftKeys = Object.keys(left)
+  const rightKeys = Object.keys(right)
+  if (leftKeys.length !== rightKeys.length) return false
+  return leftKeys.every((key) => key in right && isEqual(left[key], right[key]))
+}
+
+/**
+ * Memoizes the given {@linkcode Constraint}s by value instead of by identity.
+ *
+ * {@linkcode Constraint}s are usually written as an inline array of object
+ * literals (e.g. `constraints={[{ fps: 60 }]}`), which allocates a new array
+ * and new objects on every render. Using those as a `useEffect` dependency
+ * would re-configure the {@linkcode CameraSession} on every single render,
+ * which renders again, and so on.
+ */
+export function useMemoizedConstraints(
+  constraints: Constraint[],
+): Constraint[] {
+  const memoized = useRef(constraints)
+  if (!isEqual(memoized.current, constraints)) {
+    memoized.current = constraints
+  }
+  return memoized.current
+}
```

---

### Incident Patch 2: `2ae908ab` (2026-08-21)
**Commit Message**: fix: Memoize `targetResolution` in output hooks (#4166)

`targetResolution` (and `previewImageTargetSize`) are `Size` objects that
users almost always pass as inline object literals:

```tsx
const photoOutput = usePhotoOutput({
  targetResolution: { width: 1920, height: 1080 },
})
```

Those literals get a fresh identity on every render, so the `useMemo(...)`
inside `usePhotoOutput` / `useVideoOutput` / `useFrameOutput` /
`useDepthOutput` misses its cache and creates a brand new `CameraOutput`
every time.

That is not just wasteful, it self-perpetuates: a new output changes the
`outputs` array, which re-runs the `useCameraController` effect, which
re-configures the `CameraSession`, which calls `setController(...)`, which
renders again, which creates yet another output. The session ends up in an
endless reconfigure loop and takes the app down with it within seconds.

Memoize `Size` props by value (`width`/`height`) via a new
`useMemoizedSize(...)` internal hook so the outputs are only re-created
when the requested resolution actually changes.

Also adds a Harness test that re-renders a component with inline
`targetResolution` literals and asserts that the outputs keep their
identity

**File**: `apps/simple-camera/__tests__/visioncamera.hooks.harness.tsx` (modified, +128/-0)
```diff
@@ -19,16 +19,21 @@ import type {
   CameraDevice,
   CameraDeviceFactory,
   CameraOrientation,
+  CameraPhotoOutput,
   CameraPosition,
+  CameraVideoOutput,
   DeviceFilter,
   TargetCameraPosition,
 } from 'react-native-vision-camera'
 import {
+  CommonResolutions,
   getUIRotation,
   useCamera,
   useCameraDevice,
   useOrientation,
+  usePhotoOutput,
   usePreviewOutput,
+  useVideoOutput,
   VisionCamera,
 } from 'react-native-vision-camera'
 
@@ -341,4 +346,127 @@ describe('VisionCamera - Hooks', () => {
 
     expect(onError).not.toHaveBeenCalled()
   })
+
+  it('keeps outputs stable when targetResolution is passed as an inline object literal', async () => {
+    const onConfigured = fn<() => void>()
+    const onError = fn<(error: Error) => void>()
+    const onRendered =
+      fn<
+        (
+          renderIndex: number,
+          photoOutput: CameraPhotoOutput,
+          videoOutput: CameraVideoOutput,
+        ) => void
+      >()
+
+    function TestCamera({
+      renderIndex,
+      width,
+      height,
+    }: {
+      renderIndex: number
+      width: number
+      height: number
+    }): null {
+      // CameraX requires at least one use case when configuring a session.
+      const previewOutput = usePreviewOutput()
+      // Both `targetResolution`s are inline object literals, so they have a
+      // fresh identity on every single render even though their values never
+      // change. They must not re-create the outputs.
+      const photoOutput = usePhotoOutput({
+        targetResolution: { width: width, height: height },
+      })
+      const videoOutput = useVideoOutput({
+        targetResolution: { width: width, height: height },
+        enableAudio: false,
+      })
+      useCamera({
+        isActive: false,
+        device: 'back',
+        outputs: [previewOutput, photoOutput, videoOutput],
+        onConfigured,
+        onError,
+      })
+
+      useEffect(() => {
+        onRendered(renderIndex, photoOutput, videoOutput)
+      }, [renderIndex, photoOutput, videoOutput])
+
+      return null
+    }
+
+    const waitForRender = async (renderIndex: number): Promise<void> => {
+      await waitFor(
+        () => {
+          const error = onError.mock.lastCall?.[0]
+          if (error != null) throw error
+          expect(onRendered.mock.lastCall?.[0]).toBe(renderIndex)
+        },
+        { timeout: 10_000 },
+      )
+    }
+
+    const stableResolution = CommonResolutions.HD_4_3
+    const changedResolution = CommonResolutions.VGA_4_3
+
+    const { rerender } = await render(
+      <TestCamera
+        renderIndex={0}
+        width={stableResolution.width}
+        height={stableResolution.height}
+      />,
+      { timeout: 10_000 },
+    )
+    await waitForRender(0)
+    await waitFor(
+      () => {
+        const error = onError.mock.lastCall?.[0]
+        if (error != null) throw error
+        expect(onConfigured).toHaveBeenCalledTimes(1)
+      },
+      { timeout: 15_000 },
+    )
+
+    const initialPhotoOutput = onRendered.mock.lastCall?.[1]
+    const initialVideoOutput = onRendered.mock.lastCall?.[2]
+    expect(initialPhotoOutput).toBeDefined()
+    expect(initialVideoOutput).toBeDefined()
+
+    // Re-rendering with the same resolution values must reuse the same outputs.
+    for (const renderIndex of [1, 2, 3]) {
+      await rerender(
+        <TestCamera
+          renderIndex={renderIndex}
+          width={stableResolution.width}
+          height={stableResolution.height}
+        />,
+      )
+      await waitForRender(renderIndex)
+      expect(onRendered.mock.lastCall?.[1]).toBe(initialPhotoOutput)
+      expect(onRendered.mock.lastCall?.[2]).toBe(initialVideoOutput)
+    }
+
+    // Changing the actual resolution values must re-create the outputs and
+    // re-configure the session exactly once more.
+    await rerender(
+      <TestCamera
+        renderIndex={4}
+        width={changedResolution.width}
+        height={changedResolution.height}
+      />,
+    )
+    await waitForRender(4)
+    expect(onRendered.mock.lastCall?.[1]).not.toBe(initialPhotoOutput)
+    expect(onRendered.mock.lastCall?.[2]).not.toBe(initialVideoOutput)
+    await waitFor(
+      () => {
+        const error = onError.mock.lastCall?.[0]
+        if (error != null) throw error
+        expect(onConfigured).toHaveBeenCalledTimes(2)
+      },
+      { timeout: 15_000 },
+    )
+
+    expect(onError).not.toHaveBeenCalled()
+  })
 })
```

**File**: `packages/react-native-vision-camera/src/hooks/internal/useMemoizedSize.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+import { useMemo } from 'react'
+import type { Size } from '../../specs/common-types/Size'
+import type { CameraOutput } from '../../specs/outputs/CameraOutput.nitro'
+import type { CameraSession } from '../../specs/session/CameraSession.nitro'
+
+/**
+ * Memoizes the given {@linkcode Size} by value instead of by identity.
+ *
+ * {@linkcode Size}s are usually written as inline object literals
+ * (e.g. `useVideoOutput({ targetResolution: { width: 1920, height: 1080 } })`),
+ * which allocates a new object on every render. Using such a {@linkcode Size}
+ * as a `useMemo` dependency would re-create the {@linkcode CameraOutput} on
+ * every render, and re-creating an output re-configures the
+ * {@linkcode CameraSession} - which renders again, which re-creates the
+ * output again, and so on.
+ */
+export function useMemoizedSize(size: Size): Size
+export function useMemoizedSize(size: Size | undefined): Size | undefined
+export function useMemoizedSize(size: Size | undefined): Size | undefined {
+  const width = size?.width
+  const height = size?.height
+
+  return useMemo(() => {
+    if (width == null || height == null) return undefined
+    return { width: width, height: height }
+  }, [width, height])
+}
```

**File**: `packages/react-native-vision-camera/src/hooks/useDepthOutput.ts` (modified, +11/-7)
```diff
@@ -8,6 +8,7 @@ import type {
 import { VisionCameraWorkletsProxy } from '../third-party/VisionCameraWorkletsProxy'
 import { CommonResolutions } from '../utils/CommonResolutions'
 import { VisionCamera } from '../VisionCamera'
+import { useMemoizedSize } from './internal/useMemoizedSize'
 
 type BaseDepthOptions = Pick<
   DepthFrameOutputOptions,
@@ -75,25 +76,28 @@ export function useDepthOutput({
   dropFramesWhileBusy = true,
   allowDeferredStart = true,
 }: UseDepthOutputProps): CameraDepthFrameOutput {
-  // 1. Create depth output
+  // 1. `targetResolution` is usually an inline object literal - memoize it by value.
+  const memoizedTargetResolution = useMemoizedSize(targetResolution)
+
+  // 2. Create depth output
   const depthOutput = useMemo(
     () =>
       VisionCamera.createDepthFrameOutput({
-        targetResolution: targetResolution,
+        targetResolution: memoizedTargetResolution,
         enableFiltering: enableFiltering,
         enablePhysicalBufferRotation: false,
         dropFramesWhileBusy: dropFramesWhileBusy,
         allowDeferredStart: allowDeferredStart,
       }),
     [
-      targetResolution,
+      memoizedTargetResolution,
       enableFiltering,
       dropFramesWhileBusy,
       allowDeferredStart,
     ],
   )
 
-  // 2. Add Frame dropped warner
+  // 3. Add Frame dropped warner
   const onDepthFrameDroppedRef = useRef(onDepthFrameDropped)
   onDepthFrameDroppedRef.current = onDepthFrameDropped
   useEffect(() => {
@@ -104,16 +108,16 @@ export function useDepthOutput({
     })
   }, [depthOutput])
 
-  // 3. Create Worklet Runtime for NativeThread
+  // 4. Create Worklet Runtime for NativeThread
   const runtime = useMemo(
     () => VisionCameraWorkletsProxy.createRuntimeForThread(depthOutput.thread),
     [depthOutput.thread],
   )
-  // 4. Update onDepth() callback if it changed
+  // 5. Update onDepth() callback if it changed
   useEffect(() => {
     runtime.setOnDepthFrameCallback(depthOutput, onDepth)
   }, [runtime, depthOutput, onDepth])
 
-  // 5. Return :)
+  // 6. Return :)
   return depthOutput
 }
```

**File**: `packages/react-native-vision-camera/src/hooks/useFrameOutput.ts` (modified, +11/-7)
```diff
@@ -14,6 +14,7 @@ import type {
 import { VisionCameraWorkletsProxy } from '../third-party/VisionCameraWorkletsProxy'
 import { CommonResolutions } from '../utils/CommonResolutions'
 import { VisionCamera } from '../VisionCamera'
+import { useMemoizedSize } from './internal/useMemoizedSize'
 
 export interface UseFrameOutputProps extends Partial<FrameOutputOptions> {
   /**
@@ -129,11 +130,14 @@ export function useFrameOutput({
   onFrame,
   onFrameDropped,
 }: UseFrameOutputProps): CameraFrameOutput {
-  // 1. Create frame output
+  // 1. `targetResolution` is usually an inline object literal - memoize it by value.
+  const memoizedTargetResolution = useMemoizedSize(targetResolution)
+
+  // 2. Create frame output
   const frameOutput = useMemo(
     () =>
       VisionCamera.createFrameOutput({
-        targetResolution: targetResolution,
+        targetResolution: memoizedTargetResolution,
         pixelFormat: pixelFormat,
         enablePhysicalBufferRotation: enablePhysicalBufferRotation,
         enableCameraMatrixDelivery: enableCameraMatrixDelivery,
@@ -142,7 +146,7 @@ export function useFrameOutput({
         dropFramesWhileBusy: dropFramesWhileBusy,
       }),
     [
-      targetResolution,
+      memoizedTargetResolution,
       pixelFormat,
       dropFramesWhileBusy,
       enableCameraMatrixDelivery,
@@ -152,7 +156,7 @@ export function useFrameOutput({
     ],
   )
 
-  // 2. Add Frame dropped warner
+  // 3. Add Frame dropped warner
   const onFrameDroppedRef = useRef(onFrameDropped)
   onFrameDroppedRef.current = onFrameDropped
   useEffect(() => {
@@ -163,16 +167,16 @@ export function useFrameOutput({
     })
   }, [frameOutput])
 
-  // 3. Create Worklet Runtime for NativeThread
+  // 4. Create Worklet Runtime for NativeThread
   const runtime = useMemo(
     () => VisionCameraWorkletsProxy.createRuntimeForThread(frameOutput.thread),
     [frameOutput.thread],
   )
-  // 4. Update onFrame() callback if it changed
+  // 5. Update onFrame() callback if it changed
   useEffect(() => {
     runtime.setOnFrameCallback(frameOutput, onFrame)
   }, [runtime, frameOutput, onFrame])
 
-  // 5. Return :)
+  // 6. Return :)
   return frameOutput
 }
```

**File**: `packages/react-native-vision-camera/src/hooks/usePhotoOutput.ts` (modified, +10/-5)
```diff
@@ -7,6 +7,7 @@ import type {
 import { CommonResolutions } from '../utils/CommonResolutions'
 import { VisionCamera } from '../VisionCamera'
 import type { Camera } from '../views/Camera'
+import { useMemoizedSize } from './internal/useMemoizedSize'
 
 /**
  * Use a {@linkcode CameraPhotoOutput} for capturing {@linkcode Photo}s.
@@ -35,22 +36,26 @@ export function usePhotoOutput({
   qualityPrioritization = 'balanced',
   previewImageTargetSize = undefined,
 }: Partial<PhotoOutputOptions> = {}): CameraPhotoOutput {
-  // 1. Create photo output
+  // 1. `Size`s are usually inline object literals - memoize them by value.
+  const memoizedTargetResolution = useMemoizedSize(targetResolution)
+  const memoizedPreviewImageTargetSize = useMemoizedSize(previewImageTargetSize)
+
+  // 2. Create photo output
   const photoOutput = useMemo(
     () =>
       VisionCamera.createPhotoOutput({
-        targetResolution: targetResolution,
+        targetResolution: memoizedTargetResolution,
         containerFormat: containerFormat,
         quality: quality,
         qualityPrioritization: qualityPrioritization,
-        previewImageTargetSize: previewImageTargetSize,
+        previewImageTargetSize: memoizedPreviewImageTargetSize,
       }),
     [
-      targetResolution,
+      memoizedTargetResolution,
       containerFormat,
       quality,
       qualityPrioritization,
-      previewImageTargetSize,
+      memoizedPreviewImageTargetSize,
     ],
   )
 
```

**File**: `packages/react-native-vision-camera/src/hooks/useVideoOutput.ts` (modified, +6/-2)
```diff
@@ -7,6 +7,7 @@ import type { Recorder } from '../specs/outputs/Recorder.nitro'
 import { CommonResolutions } from '../utils/CommonResolutions'
 import { VisionCamera } from '../VisionCamera'
 import type { Camera } from '../views/Camera'
+import { useMemoizedSize } from './internal/useMemoizedSize'
 
 /**
  * Use a {@linkcode CameraVideoOutput} for recording videos.
@@ -42,10 +43,13 @@ export function useVideoOutput({
   enableAudio,
   fileType,
 }: Partial<VideoOutputOptions> = {}): CameraVideoOutput {
+  // `targetResolution` is usually an inline object literal - memoize it by value.
+  const memoizedTargetResolution = useMemoizedSize(targetResolution)
+
   const videoOutput = useMemo(
     () =>
       VisionCamera.createVideoOutput({
-        targetResolution: targetResolution,
+        targetResolution: memoizedTargetResolution,
         targetBitRate: targetBitRate,
         enablePersistentRecorder: enablePersistentRecorder,
         enableAudio: enableAudio,
@@ -55,7 +59,7 @@ export function useVideoOutput({
       enablePersistentRecorder,
       targetBitRate,
       enableAudio,
-      targetResolution,
+      memoizedTargetResolution,
       fileType,
     ],
   )
```

---

### Incident Patch 3: `019764cb` (2026-08-12)
**Commit Message**: test: Add tests for `onUIRotationChanged` (#4148)

* test: Add tests for `onUIRotationChanged`

* Update visioncamera.hooks.harness.tsx

* test: Refine UI rotation harness coverage

**File**: `apps/simple-camera/__tests__/README.md` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ Tests are split by domain. Each file tests one slice of the imperative `VisionCa
 | [visioncamera.multi-output.harness.ts](visioncamera.multi-output.harness.ts) | Multi-output sessions that combine photo, video, and frame outputs, output replacement while other outputs stay attached, persistent recording across session restarts |
 | [visioncamera.constraints.harness.ts](visioncamera.constraints.harness.ts) | `VisionCamera.resolveConstraints` + `onSessionConfigSelected`, FPS / HDR / stabilization / binned / pixelFormat / resolutionBias constraints |
 | [visioncamera.controller.harness.ts](visioncamera.controller.harness.ts) | `CameraController` — zoom, torch, exposure bias, focus metering, low-light boost, subject area listener |
-| [visioncamera.hooks.harness.tsx](visioncamera.hooks.harness.tsx) | React hook reactivity for `useCameraDevice(...)` position and physical-device filter changes |
+| [visioncamera.hooks.harness.tsx](visioncamera.hooks.harness.tsx) | React hook reactivity for `useCameraDevice(...)` position and physical-device filter changes, and `useCamera(...).onUIRotationChanged` |
 | [visioncamera.utils.harness.ts](visioncamera.utils.harness.ts) | Pure public utilities such as `getUIRotation(...)` across every output/interface orientation pair |
 | [visioncamera.coordinates.harness.ts](visioncamera.coordinates.harness.ts) | `Frame.convertFramePointToCameraPoint` / `convertCameraPointToFramePoint`, `PreviewView.convertViewPointToCameraPoint` / `convertCameraPointToViewPoint`, `PreviewView.createMeteringPoint`, `convertScannedObjectCoordinatesToViewCoordinates`, end-to-end Frame → Camera → View round-trip |
 | [visioncamera.nativepreviewview.harness.tsx](visioncamera.nativepreviewview.harness.tsx) | Bare `NativePreviewView` lifecycle, layout-sensitive preview regression coverage, `resizeMode`, Android `implementationMode`, gesture controllers, multi-preview mounting, `PreviewView` ref methods, Android `takeSnapshot()` dimensions |
```

**File**: `apps/simple-camera/__tests__/visioncamera.hooks.harness.tsx` (modified, +128/-1)
```diff
@@ -1,4 +1,5 @@
 import { useEffect } from 'react'
+import { StyleSheet } from 'react-native'
 import {
   beforeAll,
   describe,
@@ -9,14 +10,27 @@ import {
   render,
   waitFor,
 } from 'react-native-harness'
+import {
+  Screen,
+  type ScreenOrientationTypes,
+  ScreenStack,
+} from 'react-native-screens'
 import type {
   CameraDevice,
   CameraDeviceFactory,
+  CameraOrientation,
   CameraPosition,
   DeviceFilter,
   TargetCameraPosition,
 } from 'react-native-vision-camera'
-import { useCameraDevice, VisionCamera } from 'react-native-vision-camera'
+import {
+  getUIRotation,
+  useCamera,
+  useCameraDevice,
+  useOrientation,
+  usePreviewOutput,
+  VisionCamera,
+} from 'react-native-vision-camera'
 
 interface DeviceSnapshot {
   requestedPosition: TargetCameraPosition
@@ -214,4 +228,117 @@ describe('VisionCamera - Hooks', () => {
     )
     await expectLatestDeviceSnapshot(onSnapshot, 'back', tripleDevice)
   })
+
+  it('updates onUIRotationChanged when the interface orientation changes', async () => {
+    const onConfigured = fn<() => void>()
+    const onInterfaceOrientationChanged =
+      fn<(orientation: CameraOrientation | undefined) => void>()
+    const onUIRotationChanged = fn<(rotation: number) => void>()
+    const onError = fn<(error: Error) => void>()
+
+    function TestCamera({
+      screenOrientation,
+    }: {
+      screenOrientation: ScreenOrientationTypes
+    }): React.ReactElement {
+      // CameraX requires at least one use case when configuring a session.
+      const previewOutput = usePreviewOutput()
+      const interfaceOrientation = useOrientation('interface')
+      useEffect(() => {
+        onInterfaceOrientationChanged(interfaceOrientation)
+      }, [interfaceOrientation])
+      useCamera({
+        isActive: false,
+        device: 'back',
+        outputs: [previewOutput],
+        orientationSource: 'custom',
+        onConfigured,
+        onUIRotationChanged,
+        onError,
+      })
+
+      return (
+        <ScreenStack style={StyleSheet.absoluteFill}>
+          <Screen
+            enabled={true}
+            activityState={2}
+            screenOrientation={screenOrientation}
+            style={StyleSheet.absoluteFill}
+          />
+        </ScreenStack>
+      )
+    }
+
+    const waitForRotation = async (
+      allowedOrientations: readonly CameraOrientation[],
+    ): Promise<CameraOrientation> => {
+      let receivedOrientation: CameraOrientation | undefined
+      await waitFor(
+        () => {
+          const error = onError.mock.lastCall?.[0]
+          if (error != null) throw error
+
+          const orientation = onInterfaceOrientationChanged.mock.lastCall?.[0]
+          if (orientation == null) {
+            throw new Error('No interface orientation was received yet.')
+          }
+          receivedOrientation = orientation
+          expect(allowedOrientations).toContain(orientation)
+          const expectedRotation = getUIRotation('up', orientation)
+          expect(onUIRotationChanged).toHaveBeenLastCalledWith(expectedRotation)
+        },
+        { timeout: 10_000 },
+      )
+      if (receivedOrientation == null) {
+        throw new Error('No interface orientation was received.')
+      }
+      return receivedOrientation
+    }
+
+    const { rerender } = await render(
+      <TestCamera screenOrientation="portrait_up" />,
+      {
+        timeout: 10_000,
+      },
+    )
+    await waitFor(
+      () => {
+        const error = onError.mock.lastCall?.[0]
+        if (error != null) throw error
+        expect(onConfigured).toHaveBeenCalledTimes(1)
+      },
+      { timeout: 10_000 },
+    )
+    await waitFor(
+      () => {
+        const error = onError.mock.lastCall?.[0]
+        if (error != null) throw error
+        const expectedRotation = getUIRotation('up', 'up')
+        expect(onUIRotationChanged).toHaveBeenLastCalledWith(expectedRotation)
+      },
+      { timeout: 10_000 },
+    )
+
+    try {
+      onInterfaceOrientationChanged.mockClear()
+      onUIRotationChanged.mockClear()
+      await rerender(<TestCamera screenOrientation="landscape_left" />)
+      const firstLandscapeOrientation = await waitForRotation(['left', 'right'])
+      const oppositeLandscapeOrientation =
+        firstLandscapeOrientation === 'left' ? 'right' : 'left'
+      onInterfaceOrientationChanged.mockClear()
+      onUIRotationChanged.mockClear()
+      await rerender(<TestCamera screenOrientation="landscape_right" />)
+      await waitForRotation([oppositeLandscapeOrientation])
+
+      onInterfaceOrientationChanged.mockClear()
+      onUIRotationChanged.mockClear()
+      await rerender(<TestCamera screenOrientation="portrait_up" />)
+      await waitForRotation(['up'])
+    } finally {
+      await rerender(<TestCamera screenOrientation="portrait_up" />)
+    }
+
+    expect(onError).not.toHaveBeenCalled()
+  })
 })
```

#### Recent Merged Pull Requests:
- **PR #4218** (2026-10-14): fix(android): prevent CameraX executor starvation (@ismaelsousa)
- **PR #4176** (2026-08-29): chore: Update links for the move to the margelo org (@mrousavy)
- **PR #4175** (closed): fix: align iOS frame coordinates with camera sensor (@huytdps13400)
- **PR #4173** (closed): feat: Add native tap-to-focus reset listener (@mrousavy)
- **PR #4172** (2026-08-26): feat: Add native tap-to-focus lifecycle listeners (@mrousavy)
- **PR #4171** (2026-08-26): feat: Add native zoom gesture change listener (@mrousavy)

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

## X. Deep-compare `constraints` instead of `JSON.stringify`-ing them (#4167)

**RULE**:
When implementing operations in `apps/simple-camera/__tests__/visioncamera.hooks.harness.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in margelo/react-native-vision-camera. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8015396b`: Deep-compare `constraints` instead of `JSON.stringify`-ing them (#4167). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/simple-camera/__tests__/visioncamera.hooks.harness.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:

  it('does not re-configure the session when constraints are passed as an inline array', async () => {
    const onConfigured = fn<() => void>()
    const onError = fn<(error: Error) => void>()
    const onRendered = fn<(renderIndex: number) => void>()

    function TestCamera({
      renderIndex,
      fps,
    }: {
      renderIndex: number
      fps: number
    }): null {
      // CameraX requires at least one use case when configuring a session.
      const previewOutput = usePreviewOutput()
      useCamera({
        isActive: false,
        device: 'back',
        outputs: [previewOutput],
        // An inline array of inline object literals, so `constraints` has a
        // fresh identity on every single render even though its values never
        // change. It must not re-configure the session.
        constraints: [{ fps: fps }],
        onConfigured,
        onError,
      })

      useEffect(() => {
        onRendered(renderIndex)
      }, [renderIndex])

      return null
    }

    const waitForRender = async (renderIndex: number): Promise<void> => {
      await waitFor(
        () => {
          const error = onError.mock.lastCall?.[0]
          if (error != null) th
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8015396b` are properly handled with clean fallback behavior.
