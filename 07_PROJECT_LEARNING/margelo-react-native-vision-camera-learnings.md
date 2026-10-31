> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/margelo-react-native-vision-camera-learnings.md`  
> **Source**: github ([https://github.com/margelo/react-native-vision-camera](https://github.com/margelo/react-native-vision-camera))  
> **Source Version**: `6624e8cd`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T05:14:16.073Z  
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
> **Harvest Timestamp**: 2026-10-31T05:14:15.927Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `margelo/react-native-vision-camera`
- **Description**: 📸 A powerful, high-performance React Native Camera library.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9650 stars

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

### Incident Patch 1: `6624e8cd` (2026-10-29)
**Commit Message**: chore: update generated camera specs

**File**: `packages/react-native-vision-camera/nitrogen/generated/android/kotlin/com/margelo/nitro/camera/HybridTapToFocusGestureControllerSpec.kt` (modified, +2/-2)
```diff
@@ -37,9 +37,9 @@ abstract class HybridTapToFocusGestureControllerSpec: HybridGestureControllerSpe
     val __result = addOnTapListener(onTap)
     return __result
   }
-
+  
   abstract fun addOnFocusCompletedListener(onFocusCompleted: (point: HybridMeteringPointSpec) -> Unit): ListenerSubscription
-
+  
   @DoNotStrip
   @Keep
   private fun addOnFocusCompletedListener_cxx(onFocusCompleted: Func_void_std__shared_ptr_HybridMeteringPointSpec_): ListenerSubscription {
```

**File**: `packages/react-native-vision-camera/nitrogen/generated/ios/VisionCamera-Swift-Cxx-Bridge.cpp` (modified, +2/-2)
```diff
@@ -465,7 +465,7 @@ namespace margelo::nitro::camera::bridge::swift {
     VisionCamera::HybridNativeThreadFactorySpec_cxx& swiftPart = swiftWrapper->getSwiftPart();
     return swiftPart.toUnsafe();
   }
-
+  
   // pragma MARK: std::function<void(const std::shared_ptr<HybridMeteringPointSpec>& /* point */)>
   Func_void_std__shared_ptr_HybridMeteringPointSpec_ create_Func_void_std__shared_ptr_HybridMeteringPointSpec_(void* NON_NULL swiftClosureWrapper) noexcept {
     auto swiftClosure = VisionCamera::Func_void_std__shared_ptr_HybridMeteringPointSpec_::fromUnsafe(swiftClosureWrapper);
@@ -481,7 +481,7 @@ namespace margelo::nitro::camera::bridge::swift {
       swiftClosure.call(zoom);
     };
   }
-
+  
   // pragma MARK: std::function<void(const std::vector<std::shared_ptr<HybridCameraDeviceSpec>>& /* newDevices */)>
   Func_void_std__vector_std__shared_ptr_HybridCameraDeviceSpec__ create_Func_void_std__vector_std__shared_ptr_HybridCameraDeviceSpec__(void* NON_NULL swiftClosureWrapper) noexcept {
     auto swiftClosure = VisionCamera::Func_void_std__vector_std__shared_ptr_HybridCameraDeviceSpec__::fromUnsafe(swiftClosureWrapper);
```

**File**: `packages/react-native-vision-camera/nitrogen/generated/ios/VisionCamera-Swift-Cxx-Bridge.hpp` (modified, +2/-2)
```diff
@@ -1346,7 +1346,7 @@ namespace margelo::nitro::camera::bridge::swift {
   inline Func_void_std__shared_ptr_HybridMeteringPointSpec__Wrapper wrap_Func_void_std__shared_ptr_HybridMeteringPointSpec_(Func_void_std__shared_ptr_HybridMeteringPointSpec_ value) noexcept {
     return Func_void_std__shared_ptr_HybridMeteringPointSpec__Wrapper(std::move(value));
   }
-
+  
   // pragma MARK: std::function<void(double /* zoom */)>
   /**
    * Specialized version of `std::function<void(double)>`.
@@ -1368,7 +1368,7 @@ namespace margelo::nitro::camera::bridge::swift {
   inline Func_void_double_Wrapper wrap_Func_void_double(Func_void_double value) noexcept {
     return Func_void_double_Wrapper(std::move(value));
   }
-
+  
   // pragma MARK: std::vector<std::shared_ptr<HybridCameraDeviceSpec>>
   /**
    * Specialized version of `std::vector<std::shared_ptr<HybridCameraDeviceSpec>>`.
```

**File**: `packages/react-native-vision-camera/nitrogen/generated/ios/swift/PhotoFile.swift` (modified, +7/-7)
```diff
@@ -26,37 +26,37 @@ public extension PhotoFile {
   var filePath: String {
     return String(self.__filePath)
   }
-
+  
   @inline(__always)
   var width: Double {
     return self.__width
   }
-
+  
   @inline(__always)
   var height: Double {
     return self.__height
   }
-
+  
   @inline(__always)
   var orientation: CameraOrientation {
     return self.__orientation
   }
-
+  
   @inline(__always)
   var isMirrored: Bool {
     return self.__isMirrored
   }
-
+  
   @inline(__always)
   var timestamp: Double {
     return self.__timestamp
   }
-
+  
   @inline(__always)
   var isRawPhoto: Bool {
     return self.__isRawPhoto
   }
-
+  
   @inline(__always)
   var containerFormat: PhotoContainerFormat {
     return self.__containerFormat
```

---

### Incident Patch 2: `cd95a93a` (2026-10-29)
**Commit Message**: chore: release 5.2.4

**File**: `apps/simple-camera/ios/Podfile.lock` (modified, +10/-10)
```diff
@@ -2344,7 +2344,7 @@ PODS:
     - ReactCommon/turbomodule/core
     - ReactNativeDependencies
     - Yoga
-  - VisionCamera (5.2.3):
+  - VisionCamera (5.2.4):
     - hermes-engine
     - NitroImage
     - NitroModules
@@ -2369,7 +2369,7 @@ PODS:
     - ReactCommon/turbomodule/core
     - ReactNativeDependencies
     - Yoga
-  - VisionCameraBarcodeScanner (5.2.3):
+  - VisionCameraBarcodeScanner (5.2.4):
     - GoogleMLKit/BarcodeScanning (= 9.0.0)
     - hermes-engine
     - NitroImage
@@ -2396,7 +2396,7 @@ PODS:
     - ReactNativeDependencies
     - VisionCamera
     - Yoga
-  - VisionCameraLocation (5.2.3):
+  - VisionCameraLocation (5.2.4):
     - hermes-engine
     - NitroModules
     - RCTRequired
@@ -2421,7 +2421,7 @@ PODS:
     - ReactNativeDependencies
     - VisionCamera
     - Yoga
-  - VisionCameraResizer (5.2.3):
+  - VisionCameraResizer (5.2.4):
     - hermes-engine
     - NitroModules
     - RCTRequired
@@ -2446,7 +2446,7 @@ PODS:
     - ReactNativeDependencies
     - VisionCamera
     - Yoga
-  - VisionCameraWorklets (5.2.3):
+  - VisionCameraWorklets (5.2.4):
     - hermes-engine
     - NitroModules
     - RCTRequired
@@ -2872,11 +2872,11 @@ SPEC CHECKSUMS:
   RNScreens: 991cc417cd396602a6cf59a42139e5a9d91462a9
   RNVectorIcons: 97f26211c07d69e45b189f9dd0dbbe5e2d2b0b92
   RNWorklets: 04a35c45bd72d24914cbaf24bdfa4e30e1eab2df
-  VisionCamera: f84550cffbbf23f3cac7a3d1d2e66e5098a4e8eb
-  VisionCameraBarcodeScanner: 20cca2d99425546548511a95980bb8b1117fb830
-  VisionCameraLocation: 8b23e0c80d722a090590d99b738d2fcc78e5ef3e
-  VisionCameraResizer: ff4f3c9bd01f23392b367a65e16c18cc17b94e31
-  VisionCameraWorklets: b6de1b4f950e958236366987750ed0b3c86228b9
+  VisionCamera: bd275acfc8307bfadc8f320880a14d196c243ef7
+  VisionCameraBarcodeScanner: f323ff15285506ab428226fd03ddfb7add98cbad
+  VisionCameraLocation: 7381650de6fce6386e555cbf0cd4d414e1b077ad
+  VisionCameraResizer: f887ca7660580dad0d0da536d75aa77908f572f6
+  VisionCameraWorklets: 02b8a518be01168864acef59e39bc9031bcf0567
   Yoga: 77dfa8673de2874e1855002ae59c68b8be9b007b
 
 PODFILE CHECKSUM: 225e4ff5bb6719c47fa66724251c4ad2098c76da
```

**File**: `apps/simple-camera/package.json` (modified, +1/-1)
```diff
@@ -64,5 +64,5 @@
   "trustedDependencies": [
     "@shopify/react-native-skia"
   ],
-  "version": "5.2.3"
+  "version": "5.2.4"
 }
```

**File**: `bun.lock` (modified, +7/-7)
```diff
@@ -20,7 +20,7 @@
     },
     "apps/simple-camera": {
       "name": "simple-camera",
-      "version": "5.2.3",
+      "version": "5.2.4",
       "dependencies": {
         "@react-native-community/blur": "^4.4.1",
         "@react-native-menu/menu": "^2.0.0",
@@ -103,7 +103,7 @@
     },
     "packages/react-native-vision-camera": {
       "name": "react-native-vision-camera",
-      "version": "5.2.3",
+      "version": "5.2.4",
       "devDependencies": {
         "@types/react": "19.2.15",
         "nitrogen": "0.37.0",
@@ -125,7 +125,7 @@
     },
     "packages/react-native-vision-camera-barcode-scanner": {
       "name": "react-native-vision-camera-barcode-scanner",
-      "version": "5.2.3",
+      "version": "5.2.4",
       "devDependencies": {
         "@types/react": "19.2.15",
         "nitrogen": "0.37.0",
@@ -149,7 +149,7 @@
     },
     "packages/react-native-vision-camera-location": {
       "name": "react-native-vision-camera-location",
-      "version": "5.2.3",
+      "version": "5.2.4",
       "devDependencies": {
         "@types/react": "19.2.15",
         "nitrogen": "0.37.0",
@@ -171,7 +171,7 @@
     },
     "packages/react-native-vision-camera-resizer": {
       "name": "react-native-vision-camera-resizer",
-      "version": "5.2.3",
+      "version": "5.2.4",
       "devDependencies": {
         "@types/react": "19.2.15",
         "nitrogen": "0.37.0",
@@ -193,7 +193,7 @@
     },
     "packages/react-native-vision-camera-skia": {
       "name": "react-native-vision-camera-skia",
-      "version": "5.2.3",
+      "version": "5.2.4",
       "devDependencies": {
         "@shopify/react-native-skia": "2.6.4",
         "@types/react": "19.2.15",
@@ -218,7 +218,7 @@
     },
     "packages/react-native-vision-camera-worklets": {
       "name": "react-native-vision-camera-worklets",
-      "version": "5.2.3",
+      "version": "5.2.4",
       "devDependencies": {
         "@types/react": "19.2.15",
         "nitrogen": "0.37.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -128,5 +128,5 @@
   "patchedDependencies": {
     "react-native@0.85.3": "patches/react-native@0.85.3.patch"
   },
-  "version": "5.2.3"
+  "version": "5.2.4"
 }
```

**File**: `packages/react-native-vision-camera-barcode-scanner/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-vision-camera-barcode-scanner",
-  "version": "5.2.3",
+  "version": "5.2.4",
   "description": "Barcode scanning plugin for react-native-vision-camera powered by ML Kit.",
   "main": "lib/index",
   "module": "lib/index",
```

**File**: `packages/react-native-vision-camera-location/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-vision-camera-location",
-  "version": "5.2.3",
+  "version": "5.2.4",
   "description": "Location tagging plugin for react-native-vision-camera for photo EXIF and video metadata.",
   "main": "lib/index",
   "module": "lib/index",
```

**File**: `packages/react-native-vision-camera-resizer/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-vision-camera-resizer",
-  "version": "5.2.3",
+  "version": "5.2.4",
   "description": "High-performance image and frame resizing plugin using Metal/Vulkan for react-native-vision-camera.",
   "main": "lib/index",
   "module": "lib/index",
```

**File**: `packages/react-native-vision-camera-skia/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-vision-camera-skia",
-  "version": "5.2.3",
+  "version": "5.2.4",
   "description": "Skia rendering plugin for react-native-vision-camera for drawing camera frames in React Native.",
   "main": "lib/index",
   "module": "lib/index",
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
