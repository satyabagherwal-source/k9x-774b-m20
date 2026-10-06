# Forensic Learning Record (Deep Inspection): margelo/react-native-vision-camera

> **Canonical Artifact**: `07_PROJECT_LEARNING/margelo-react-native-vision-camera-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/margelo/react-native-vision-camera](https://github.com/margelo/react-native-vision-camera))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:57:40.344Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `margelo/react-native-vision-camera`
- **Description**: 📸 A powerful, high-performance React Native Camera library.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9642 stars

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

### Core Architecture Module: `packages/react-native-vision-camera-skia/src/render.ts`
```
import { type SkCanvas, type SkImage, Skia } from '@shopify/react-native-skia'
import type { Frame, NativeBuffer } from 'react-native-vision-camera'
import {
  normalizeRotationDegrees,
  orientationToDegrees,
} from './OrientationUtils'
import { getSurface } from './SurfacesCache'

/**
 * Represents the state for rendering
 * a Frame.
 */
export interface SkiaOnFrameState {
  /**
   * The {@linkcode Frame} wrapped as a drawable
   * GPU-texture.
   *
   * The `frameTexture` can either be drawn to
   * the {@linkcode canvas} directly in which
   * case it will just be displayed as-is, or
   * drawn with a `paint`, in which case it will
   * be used as an input texture for sampling it
   * inside a Skia Shader.
   *
   * @example
   * ```ts
   * // Draw as-is:
   * canvas.drawImage(frameTexture, 0, 0)
   * // Draw with shader:
   * const paint = ...
   * const shader = ...
   * paint.setShader(shader)
   * canvas.drawImage(frameTexture, 0, 0, paint)
   * ```
   */
  frameTexture: SkImage
  /**
   * The GPU-canvas to draw the {@linkcode frameTexture}
   * in.
   * @example
   * ```ts
   * canvas.drawImage(frameTexture, 0, 0)
   * ```
   */
  canvas: SkCanvas
}

/**
 * Renders the given {@linkcode Frame} to a {@linkcode SkImage}
 * and returns it.
 * @param frame The {@linkcode Frame} to render. It will be converted to a Texture.
 * @param onDraw A provided draw function to perform the rendering.
 * @internal
 * @worklet
 */
export function renderToTexture(
  frame: Frame,
  onDraw: (state: SkiaOnFrameState) => void,
): SkImage {
  'worklet'
  let nativeBuffer: NativeBuffer | undefined
  let frameTexture: SkImage | undefined
  try {
    // 1. Compute target dimensions
    const isLandscape =
      frame.orientation === 'left' || frame.orientation === 'right'
    const outWidth = isLandscape ? frame.height : frame.width
    const outHeight = isLandscape ? frame.width : frame.height

    // 2. Get drawable offscreen surface (cached per Thread & Size)
    const surface = getSurface(outWidth, outHeight)
    // 3. Make a Texture from the Frame (via NativeBuffer)
    nativeBuffer = frame.getNativeBuffer()
    frameTexture = Skia.Image.MakeImageFromNativeBuffer(nativeBuffer.pointer)
    // 4. Prepare a Canvas for drawing
    const canvas = surface.getCanvas()

    // 5. Apply any transforms to cancel Frame orientation/mirrored
    canvas.save()
    {
      const rotation = orientationToDegrees(frame.orientation)
      const counterRotation = normalizeRotationDegrees(rotation * -1)
      // 5.1. Move it to the center so we rotate around center origin
      canvas.translate(outWidth / 2, outHeight / 2)
      // 5.2. Mirror if needed.
      // Note: Skia concatenates transforms, so call order is reversed at draw-time.
      // Placing scale() before rotate() makes the rendered result rotate first, then mirror.
      if (frame.isMirrored) {
        // Mirror alongside the vertical axis (horizontal flip)
        canvas.scale(-1, 1)
      }
      // 5.3. Rotate the Frame
      canvas.rotate(counterRotation, 0, 0)
      // 5.4. Counter back the center origin transforms
      if (isLandscape) {
        canvas.translate(-(outHeight / 2), -(outWidth / 2))
      } else {
        canvas.translate(-(outWidth / 2), -(outHeight / 2))
      }
    }

    // 6. Draw!
    onDraw({ frameTexture, canvas })

    // 7. Restore canvas transforms
    canvas.restore()

    // 8. Snapshot the Surface contents to get it into an SkImage
    const snapshot = surface.makeImageSnapshot()
    return snapshot
  } finally {
    // 9. Dispose everything that we allocated
    frameTexture?.dispose()
    nativeBuffer?.release()
  }
}

```

### Core Architecture Module: `packages/react-native-vision-camera-worklets/cpp/HybridWorkletQueueFactory.cpp`
```
///
/// HybridWorkletQueueFactory.cpp
/// VisionCamera
/// Copyright © 2025 Marc Rousavy @ Margelo
///

#include "HybridWorkletQueueFactory.hpp"

#include "JSIConverter+AsyncQueue.hpp"
#include "NativeThreadAsyncQueue.hpp"
#include "NativeThreadDispatcher.hpp"
#include <atomic>
#include <jsi/jsi.h>

namespace margelo::nitro::camera::worklets {

HybridWorkletQueueFactory::HybridWorkletQueueFactory() : HybridObject(TAG) {}

void HybridWorkletQueueFactory::loadHybridMethods() {
  HybridWorkletQueueFactorySpec::loadHybridMethods();
  registerHybrids(this, [](Prototype& prototype) {
    //
    prototype.registerRawHybridMethod("installDispatcher", 1, &HybridWorkletQueueFactory::installDispatcher);
  });
}

std::shared_ptr<::worklets::AsyncQueue> HybridWorkletQueueFactory::wrapThreadInQueue(const std::shared_ptr<HybridNativeThreadSpec>& thread) {
  return std::make_shared<NativeThreadAsyncQueue>(thread);
}

double HybridWorkletQueueFactory::getCurrentThreadMarker() {
  static std::atomic_size_t threadCounter{1};
  static thread_local size_t thisThreadId{0};
  if (thisThreadId == 0) {
    thisThreadId = threadCounter.fetch_add(1);
  }
  return static_cast<double>(thisThreadId);
}

jsi::Value HybridWorkletQueueFactory::installDispatcher(jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* args, size_t count) {
  if (count != 1)
    throw std::runtime_error("installDispatcher(..) must be called with exactly 1 argument!");
  auto thread = JSIConverter<std::shared_ptr<HybridNativeThreadSpec>>::fromJSI(runtime, args[0]);

  auto dispatcher = std::make_shared<NativeThreadDispatcher>(thread);
  Dispatcher::installRuntimeGlobalDispatcher(runtime, dispatcher);

  return jsi::Value::undefined();
}

} // namespace margelo::nitro::camera::worklets

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4176** (2026-08-29): **chore: Update links for the move to the margelo org**
  *Symptoms*: VisionCamera moved from `mrousavy/react-native-vision-camera` to `margelo/react-native-vision-camera`. GitHub keeps the old paths redirecting, so nothing is broken today, but the metadata should point at the canonical repo.  ## What changed  | Area | Change | | --- | --- | | `packages/*/package.json` (6) | `repository.url` + `bugs.url` -> margelo | | `docs/src/lib/site-config.ts` | `repositoryUrl` -> margelo. This one feeds the "Edit on GitHub" links on every docs page and the `codeRepository`/`sameAs` fields in the JSON-LD, so it was the highest-leverage single line | | `.github/ISSUE_TEMPLATE/*.yml` (4) | Repro instructions, releases links, issue-search links | | `apps/simple-camera/__tests__/*` (2) | Issue/PR links in regression-test comments | | `packages/*/*.podspec` (5) | `s.source` pointed at `github.com/mrousavy/nitro.git` - a copy-paste leftover from the nitro podspec template. Now points at this repo | | docs + `packages/react-native-vision-camera/README.md` | Nitro links, since `mrousavy/nitro` also moved to `margelo/nitro` | | `ViewGroup+installHierarchyFitter.kt` | Declared `package com.mrousavy.camera.react.extensions` while sitting in `com/margelo/nitro/camera/extensions/`. Renamed to match the directory, and updated the one import in `HybridPreviewView.kt` |  ## Deliberately left alone  - `github.com/mrousavy/react-native-nitro-image` and `github.com/mrousavy/react-native-data-scanner` - both verified still under `mrousavy` via the GitHub API. - `nitrogen/gene
  **Post-Mortem & Fix Analysis**:
  > [vc]: #V7dUrHvYDTMbjT4i6SLnXUO8fbv9DQZzUMQyPaHp1Ic=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzL2hGN1V1ZDIxZTY1VmI2SGlKVnRRSG56Y3JycWgiLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtY2hvcmUtbWlncmF0LTI3ZWRiNS1tYXJnZWxvLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtY2hvcmUtbWlncmF0LTI3ZWRiNS1tYXJnZWxvLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6ImRvY3MifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPW1hcmdlbG8mcmVwbz1yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYSZwcj00MTc2In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

- **Issue #4175** (2026-08-29): **fix: align iOS frame coordinates with camera sensor**
  *Symptoms*: ## Summary\n\n- align iOS Frame and Depth coordinate conversion with the unrotated AVFoundation sensor space used by PreviewView\n- retain absolute buffer orientation and mirroring separately from the existing public output-relative metadata\n- preserve the legacy transform for Photo depth data, where no AVCaptureConnection is available\n\nThe regression test was already merged in #4113 and is red on main for iOS while Android passes.\n\n## Verification\n\n- bun camera typecheck\n- swift format lint on all six changed Swift files (exit 0; two pre-existing warnings)\n- xcodebuild -project Pods/Pods.xcodeproj -scheme VisionCamera -sdk iphonesimulator -destination generic/platform=iOS Simulator (arm64 and x86_64)\n- git diff --check\n- affine proof for all four buffer orientations, mirrored and unmirrored, including inverse round-trips\n\nThe full SimpleCamera build is not available locally because the installed Xcode lacks the optional Metal Toolchain required by the unrelated VisionCameraResizer shader target. The existing AWS Device Farm coordinate harness remains the end-to-end oracle for this PR.\n\nFixes #4114
  **Post-Mortem & Fix Analysis**:
  > @huytdps13400 is attempting to deploy a commit to the **Margelo** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Margelo&slug=margelo&teamId=team_NDNToN8DidHGkAb1NjLet2gV&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%228d4b1c2922e762c5dfbe30617a8098187676e24c%22%7D%2C%22id%22%3A%22QmZBmNciQq8MAkbbwTGLfYxU3HL8d7NXQD3URrXWyjdSsS%22%2C%22org%22%3A%22mrousavy%22%2C%22prId%22%3A4175%2C%22repo%22%3A%22react-native-vision-camera%22%7D).  
  > Reworked in #4177.  The fixed `.left` sensor-orientation assumption and the unnecessary converter rewrite from this PR are removed. The replacement reads each delivered buffer's actual `AVCaptureConnection.videoRotationAngle` on iOS 17+, keeps the existing fallback on older targets, and leaves public `Frame.orientation` / `isMirrored` semantics unchanged.  The replacement is limited to six iOS files. The existing converter is reused without modification. Local verification covers the old 3.16049 anisotropy versus the corrected 1.0 composition, the device-specific 180° default, typecheck, Swift formatting, and the VisionCamera simulator pod build for arm64/x86_64. 

- **Issue #4173** (2026-08-26): **feat: Add native tap-to-focus reset listener**
  *Symptoms*: ## Summary  - add `addOnFocusResetListener` to the native tap-to-focus gesture controller - emit after `MeteringTask` successfully performs its automatic reset on iOS - explicitly schedule and await CameraX focus cancellation on Android so reset completion is observable - invalidate pending automatic resets when a newer focus or manual reset supersedes the gesture  This PR is stacked on #4172. It intentionally reports automatic resets from native tap-to-focus gestures only; failed or superseded resets do not emit.  ## Test plan  - `bun camera specs` - `bun run lint-all` - `bun camera typecheck` - `bun camera build` - `./apps/simple-camera/android/gradlew -p apps/simple-camera/android :react-native-vision-camera:assembleDebug --no-daemon --console=plain` - `xcodebuild -workspace SimpleCamera.xcworkspace -scheme VisionCamera -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build -quiet` 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #7/6mdcHwysvqPqKEN9b8gX3OP6a7MdLak0lkQ8bgutw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLzRMTHBjZnlGS1VuNHkyam9yQ3JrUEFjZVpwMm0iLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZmVhdC1uYXRpdmUtMjc3YWY3LW1hcmdlbG8udmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLWdpdC1mZWF0LW5hdGl2ZS0yNzdhZjctbWFyZ2Vsby52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOiJkb2NzIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1tcm91c2F2eSZyZXBvPXJlYWN0LW5hdGl2ZS12aXNpb24tY2FtZXJhJnByPTQxNzMifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://v
  > Too overcomplicated. Let's just not have this feature now, the code got too complex to support this. We can ask the CameraX team to add a on focus reset event

- **Issue #4172** (2026-08-26): **feat: Add native tap-to-focus lifecycle listeners**
  *Symptoms*: ## Summary  - expose addOnTapListener(...) and addOnFocusCompletedListener(...) on TapToFocusGestureController - emit the native MeteringPoint immediately before focusing starts - emit focus completion after iOS MeteringTask or CameraX focus resolves - report Android tap coordinates in React Native logical units - leave focus-reset events out of this PR  ## Test plan  - bun camera specs - bun run lint-all - bun camera typecheck - bun camera build - ./apps/simple-camera/android/gradlew -p apps/simple-camera/android :react-native-vision-camera:assembleDebug --no-daemon --console=plain - bun example pods - xcodebuild -workspace SimpleCamera.xcworkspace -scheme VisionCamera -sdk iphonesimulator -configuration Debug -destination generic/platform=iOS\ Simulator -derivedDataPath build CODE_SIGNING_ALLOWED=NO build -quiet
  **Post-Mortem & Fix Analysis**:
  > [vc]: #uy96+3qdoCdfVbUDRz3vgaKZ0HtYGYXzQeTzEAMUMmI=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLzRpRFFOS3pCR0h2QUNQeXRrOVhZZ245a01WZUciLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZmVhdC1uYXRpdmUtZDNkNzdmLW1hcmdlbG8udmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLWdpdC1mZWF0LW5hdGl2ZS1kM2Q3N2YtbWFyZ2Vsby52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOiJkb2NzIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1tcm91c2F2eSZyZXBvPXJlYWN0LW5hdGl2ZS12aXNpb24tY2FtZXJhJnByPTQxNzIifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

- **Issue #4171** (2026-08-26): **feat: Add native zoom gesture change listener**
  *Symptoms*: ## Summary  - expose addOnZoomChangedListener(...) on ZoomGestureController - emit each clamped target zoom update from the native pinch recognizer on iOS and Android - regenerate the Nitro bindings for the new listener API  ## Test plan  - bun camera specs - bun run lint-all - bun camera typecheck - bun camera build - bun example build:android - xcodebuild -workspace SimpleCamera.xcworkspace -scheme VisionCamera -sdk iphonesimulator -configuration Debug -destination generic/platform=iOS\ Simulator -derivedDataPath build CODE_SIGNING_ALLOWED=NO build -quiet
  **Post-Mortem & Fix Analysis**:
  > [vc]: #toBVYc9z5ct7QpJip9CU7i+pDKV6CnbNArv/bfH6O8I=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLzR4eDJUb3RnUW11anFDNm4yaGs4RTZORlBXeHEiLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZmVhdC1uYXRpdmUtNDZmMDBlLW1hcmdlbG8udmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLWdpdC1mZWF0LW5hdGl2ZS00NmYwMGUtbWFyZ2Vsby52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOiJkb2NzIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1tcm91c2F2eSZyZXBvPXJlYWN0LW5hdGl2ZS12aXNpb24tY2FtZXJhJnByPTQxNzEifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

- **Issue #4170** (2026-08-23): **feat: expose metadata from capturePhotoToFile**
  *Symptoms*: ## Summary  - extend PhotoFile with width, height, orientation, mirroring, timestamp, RAW status, and container format - populate the same metadata on Android and iOS, with Android reading the saved file EXIF for its final dimensions and orientation - add focused Harness coverage that compares capturePhotoToFile metadata with an in-memory Photo  ## Validation  - bun camera specs - bun camera typecheck - bunx tsc -p apps/simple-camera/tsconfig.json --noEmit - bun lint-kotlin - bun lint-swift - bun lint-js (passes with 16 existing warnings) - bun example build:android - focused Android emulator Harness test (passes) - iOS SimpleCamera simulator xcodebuild (passes) - focused iOS Harness launch reached the app, but the simulator exposes no back camera, so the existing suite setup assertion stopped the test before execution
  **Post-Mortem & Fix Analysis**:
  > [vc]: #F8Rx6EKkGW7e9pp12aS8qi3IgUducQdln8lvJJL84D4=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzL0E5VFpIOVFzaldMS1VySkFTOHVUbVBYS1JUNWoiLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZmVhdC1waG90by1mLTRlMTkyMC1tYXJnZWxvLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZmVhdC1waG90by1mLTRlMTkyMC1tYXJnZWxvLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6ImRvY3MifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPW1yb3VzYXZ5JnJlcG89cmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEmcHI9NDE3MCJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

- **Issue #4167** (2026-08-21): **fix: Deep-compare `constraints` instead of `JSON.stringify`-ing them**
  *Symptoms*: ## What  `useCameraController` kept the user's `constraints` stable by putting `JSON.stringify(constraints)` into the `useMemo` dependency array:  ```ts // biome-ignore lint/correctness/useExhaustiveDependencies: It's an array of objects, we either have to deep-memo or just stringify. const stableConstraints = useMemo<Constraint[]>(() => { ... }, [JSON.stringify(constraints), stableOutputs]) ```  That works for plain constraints like `{ fps: 60 }`, but it silently breaks for `{ resolutionBias: someOutput }`.  Nitro `HybridObject`s are created via `Object.create(prototype)` and hold every property on their shared prototype, so the JS object itself has **no own keys**. `JSON.stringify(...)` therefore serializes *every* `CameraOutput` to the same string:  | build | `JSON.stringify(photoOutput)` | |---|---| | release | `{}` | | debug | `{"__type":"HybridObject<CameraPhotoOutput>"}` |  Two different outputs of the same type are indistinguishable. So this, which is the documented way to express capture priority:  ```tsx constraints={photoFirst   ? [{ resolutionBias: photoOutput }, { resolutionBias: videoOutput }]   : [{ resolutionBias: videoOutput }, { resolutionBias: photoOutput }]} ```  is invisible to the memo in release builds, and the session is never re-configured.  ## How  Replaces the stringification with an explicit deep comparison (`useMemoizedConstraints(...)`) that compares object literals and arrays by value, and everything else (i.e. `HybridObject`s) by identity. It a
  **Post-Mortem & Fix Analysis**:
  > [vc]: #K/bwXp0beN6Hpwi5EqCMOVKeEGG6dPYqeQSIyDSf/UY=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLzlHTWRKYnVtSHBmQU4ySFFpb0g3VVVRTDRiZXciLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZml4LW1lbW9pemUtODI5NGUxLW1hcmdlbG8udmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLWdpdC1maXgtbWVtb2l6ZS04Mjk0ZTEtbWFyZ2Vsby52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOiJkb2NzIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1tcm91c2F2eSZyZXBvPXJlYWN0LW5hdGl2ZS12aXNpb24tY2FtZXJhJnByPTQxNjcifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

- **Issue #4166** (2026-08-21): **fix: Memoize `targetResolution` in output hooks**
  *Symptoms*: ## What  `targetResolution` (and `previewImageTargetSize`) are `Size` objects, and users almost always write them as inline object literals:  ```tsx const photoOutput = usePhotoOutput({   targetResolution: { width: 1920, height: 1080 }, }) ```  An inline literal gets a fresh identity on every render, so the `useMemo(...)` inside `usePhotoOutput` / `useVideoOutput` / `useFrameOutput` / `useDepthOutput` misses its cache and creates a **brand new `CameraOutput` on every render**.  That isn't just wasteful, it self-perpetuates:  1. New output -> the `outputs` array changes 2. -> `useCameraController`'s effect re-runs and re-configures the `CameraSession` 3. -> `setController(...)` -> re-render 4. -> back to 1.  The session ends up in an endless reconfigure loop and takes the app down within seconds.  ## How  Adds an internal `useMemoizedSize(...)` hook that memoizes a `Size` by its `width`/`height` values instead of by object identity, and uses it in all four output hooks. Outputs are now only re-created when the requested resolution actually changes.  This also covers `<SkiaCamera targetResolution={...} />`, which forwards straight into `useFrameOutput(...)`.  ## Test  Adds a Harness test in `visioncamera.hooks.harness.tsx` that:  - renders a component whose `targetResolution`s are inline object literals, - re-renders it three times with the same values, asserting the `CameraPhotoOutput` / `CameraVideoOutput` keep their identity and that `onConfigured` fired exactly **once**, - 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #qyvPXoM752Fx337+w9f5C9/4Mxh66gWcfyPAnswkqgs=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLzdQaG5KdlRucXlZUE1IMVBEMm44Ym1pM3hmemgiLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZml4LW1lbW9pemUtMjg2MTI0LW1hcmdlbG8udmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLWdpdC1maXgtbWVtb2l6ZS0yODYxMjQtbWFyZ2Vsby52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOiJkb2NzIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1tcm91c2F2eSZyZXBvPXJlYWN0LW5hdGl2ZS12aXNpb24tY2FtZXJhJnByPTQxNjYifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

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

### Incident Patch 3: `98aef293` (2026-08-20)
**Commit Message**: fix: Mark react-native-nitro-modules peer dependency as optional (#4165)

Semver ranges never match pre-releases, so a required peer of "*" does
not match e.g. 0.37.0-beta.0. Package managers then install a second,
stable copy of Nitro next to the pre-release, and the native/JS version
guard throws "Nitro was installed twice" at runtime.

Marking the peer optional leaves the consuming app in full control of
the installed Nitro version.

**File**: `bun.lock` (modified, +15/-0)
```diff
@@ -119,6 +119,9 @@
         "react-native-nitro-image": "*",
         "react-native-nitro-modules": "*",
       },
+      "optionalPeers": [
+        "react-native-nitro-modules",
+      ],
     },
     "packages/react-native-vision-camera-barcode-scanner": {
       "name": "react-native-vision-camera-barcode-scanner",
@@ -140,6 +143,9 @@
         "react-native-nitro-modules": "*",
         "react-native-vision-camera": "*",
       },
+      "optionalPeers": [
+        "react-native-nitro-modules",
+      ],
     },
     "packages/react-native-vision-camera-location": {
       "name": "react-native-vision-camera-location",
@@ -159,6 +165,9 @@
         "react-native-nitro-modules": "*",
         "react-native-vision-camera": "*",
       },
+      "optionalPeers": [
+        "react-native-nitro-modules",
+      ],
     },
     "packages/react-native-vision-camera-resizer": {
       "name": "react-native-vision-camera-resizer",
@@ -178,6 +187,9 @@
         "react-native-nitro-modules": "*",
         "react-native-vision-camera": "*",
       },
+      "optionalPeers": [
+        "react-native-nitro-modules",
+      ],
     },
     "packages/react-native-vision-camera-skia": {
       "name": "react-native-vision-camera-skia",
@@ -224,6 +236,9 @@
         "react-native-vision-camera": "*",
         "react-native-worklets": "*",
       },
+      "optionalPeers": [
+        "react-native-nitro-modules",
+      ],
     },
   },
   "trustedDependencies": [
```

**File**: `packages/react-native-vision-camera-barcode-scanner/package.json` (modified, +5/-0)
```diff
@@ -81,6 +81,11 @@
     "react-native-nitro-modules": "*",
     "react-native-vision-camera": "*"
   },
+  "peerDependenciesMeta": {
+    "react-native-nitro-modules": {
+      "optional": true
+    }
+  },
   "release-it": {
     "npm": {
       "publish": true
```

**File**: `packages/react-native-vision-camera-location/package.json` (modified, +5/-0)
```diff
@@ -78,6 +78,11 @@
     "react-native-nitro-modules": "*",
     "react-native-vision-camera": "*"
   },
+  "peerDependenciesMeta": {
+    "react-native-nitro-modules": {
+      "optional": true
+    }
+  },
   "release-it": {
     "npm": {
       "publish": true
```

**File**: `packages/react-native-vision-camera-resizer/package.json` (modified, +5/-0)
```diff
@@ -83,6 +83,11 @@
     "react-native-nitro-modules": "*",
     "react-native-vision-camera": "*"
   },
+  "peerDependenciesMeta": {
+    "react-native-nitro-modules": {
+      "optional": true
+    }
+  },
   "release-it": {
     "npm": {
       "publish": true
```

**File**: `packages/react-native-vision-camera-worklets/package.json` (modified, +5/-0)
```diff
@@ -81,6 +81,11 @@
     "react-native-vision-camera": "*",
     "react-native-worklets": "*"
   },
+  "peerDependenciesMeta": {
+    "react-native-nitro-modules": {
+      "optional": true
+    }
+  },
   "release-it": {
     "npm": {
       "publish": true
```

**File**: `packages/react-native-vision-camera/package.json` (modified, +5/-0)
```diff
@@ -83,6 +83,11 @@
     "react-native-nitro-modules": "*",
     "react-native-nitro-image": "*"
   },
+  "peerDependenciesMeta": {
+    "react-native-nitro-modules": {
+      "optional": true
+    }
+  },
   "release-it": {
     "npm": {
       "publish": true
```

---

### Incident Patch 4: `425ce298` (2026-08-19)
**Commit Message**: fix: Migrate CameraX 1.7.0-alpha03 APIs (#4162)

fix: migrate CameraX alpha03 APIs

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/HybridCameraDeviceFactory.kt` (modified, +2/-2)
```diff
@@ -4,7 +4,6 @@ import android.content.Context
 import android.content.SharedPreferences
 import android.util.Log
 import androidx.annotation.OptIn
-import androidx.camera.camera2.adapter.CameraInfoAdapter.Companion.cameraId
 import androidx.camera.core.CameraIdentifier
 import androidx.camera.core.CameraPresenceListener
 import androidx.camera.core.CameraSelector
@@ -15,6 +14,7 @@ import androidx.camera.lifecycle.ProcessCameraProvider
 import androidx.core.content.edit
 import com.facebook.react.bridge.ReactApplicationContext
 import com.margelo.nitro.NitroModules
+import com.margelo.nitro.camera.extensions.cameraIdOrNull
 import com.margelo.nitro.camera.extensions.getDefaultCamera
 import com.margelo.nitro.camera.extensions.mapToArray
 import com.margelo.nitro.camera.hybrids.inputs.HybridCameraDevice
@@ -87,7 +87,7 @@ class HybridCameraDeviceFactory(
   override fun getCameraForId(id: String): HybridCameraDeviceSpec? {
     val cameraInfo =
       cameraProvider.availableCameraInfos.firstOrNull { cameraInfo ->
-        cameraInfo.cameraId?.value == id
+        cameraInfo.cameraIdOrNull == id
       }
     if (cameraInfo == null) {
       return null
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/Camera2CameraInfo+fromOrNull.kt` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-package com.margelo.nitro.camera.extensions
-
-import android.util.Log
-import androidx.annotation.OptIn
-import androidx.camera.camera2.interop.Camera2CameraInfo
-import androidx.camera.core.CameraInfo
-
-@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
-fun Camera2CameraInfo.Companion.fromSafe(cameraInfo: CameraInfo): Camera2CameraInfo? {
-  try {
-    return Camera2CameraInfo.from(cameraInfo)
-  } catch (e: Throwable) {
-    Log.w("VisionCamera", "Camera Device $cameraInfo is not a Camera2 device!")
-    return null
-  }
-}
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/Camera2CameraInfo+getOutputImageFormats.kt` (removed, +0/-12)
```diff
@@ -1,12 +0,0 @@
-package com.margelo.nitro.camera.extensions
-
-import android.hardware.camera2.CameraCharacteristics
-import androidx.annotation.OptIn
-import androidx.camera.camera2.interop.Camera2CameraInfo
-
-@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
-fun Camera2CameraInfo.getOutputImageFormats(): IntArray {
-  val streamMap = this.getCameraCharacteristic(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
-  if (streamMap == null) return intArrayOf()
-  return streamMap.outputFormats
-}
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/Camera2CameraInfo+getSupportedAperture.kt` (removed, +0/-20)
```diff
@@ -1,20 +0,0 @@
-package com.margelo.nitro.camera.extensions
-
-import android.hardware.camera2.CameraCharacteristics
-import androidx.annotation.OptIn
-import androidx.camera.camera2.interop.Camera2CameraInfo
-import com.margelo.nitro.camera.Range
-
-@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
-fun Camera2CameraInfo.getSupportedApertures(): FloatArray {
-  val apertures =
-    getCameraCharacteristic(CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES)
-      ?: return floatArrayOf()
-  return apertures
-}
-
-@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
-fun Camera2CameraInfo.getDefaultSimulatedAperture(): Double? {
-  val apertures = getSupportedApertures()
-  return apertures.firstOrNull()?.toDouble()
-}
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/CameraCharacteristics+getDepthSizes.kt` (renamed, +2/-5)
```diff
@@ -2,14 +2,11 @@ package com.margelo.nitro.camera.extensions
 
 import android.hardware.camera2.CameraCharacteristics
 import android.util.Size
-import androidx.annotation.OptIn
-import androidx.camera.camera2.interop.Camera2CameraInfo
 import com.margelo.nitro.camera.utils.ImageFormatUtils
 
-@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
-fun Camera2CameraInfo.getDepthSizes(): Array<Size> {
+fun CameraCharacteristics.getDepthSizes(): Array<Size> {
   val streams =
-    this.getCameraCharacteristic(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
+    this[CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP]
       ?: return emptyArray()
   val depthFormats = streams.outputFormats.filter { ImageFormatUtils.isDepthFormat(it) }
   val sizes = depthFormats.flatMap { streams.getOutputSizes(it).toListOrEmpty() }
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/CameraCharacteristics+getOutputImageFormats.kt` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+package com.margelo.nitro.camera.extensions
+
+import android.hardware.camera2.CameraCharacteristics
+
+fun CameraCharacteristics.getOutputImageFormats(): IntArray {
+  val streamMap = this[CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP]
+  if (streamMap == null) return intArrayOf()
+  return streamMap.outputFormats
+}
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/CameraCharacteristics+getPhotoSizes.kt` (renamed, +2/-5)
```diff
@@ -2,14 +2,11 @@ package com.margelo.nitro.camera.extensions
 
 import android.hardware.camera2.CameraCharacteristics
 import android.util.Size
-import androidx.annotation.OptIn
-import androidx.camera.camera2.interop.Camera2CameraInfo
 import com.margelo.nitro.camera.utils.ImageFormatUtils
 
-@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
-fun Camera2CameraInfo.getPhotoSizes(): Array<Size> {
+fun CameraCharacteristics.getPhotoSizes(): Array<Size> {
   val streams =
-    this.getCameraCharacteristic(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
+    this[CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP]
       ?: return emptyArray()
   val photoFormats = streams.outputFormats.filter { ImageFormatUtils.isPhotoFormat(it) }
   val sizes = photoFormats.flatMap { streams.getOutputSizes(it).toListOrEmpty() }
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/CameraCharacteristics+getPixelFormats.kt` (renamed, +2/-5)
```diff
@@ -1,16 +1,13 @@
 package com.margelo.nitro.camera.extensions
 
 import android.hardware.camera2.CameraCharacteristics
-import androidx.annotation.OptIn
-import androidx.camera.camera2.interop.Camera2CameraInfo
 import com.margelo.nitro.camera.PixelFormat
 import com.margelo.nitro.camera.extensions.converters.fromImageFormat
 import com.margelo.nitro.camera.utils.PixelRange
 
-@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
-fun Camera2CameraInfo.getPixelFormats(): Array<PixelFormat> {
+fun CameraCharacteristics.getPixelFormats(): Array<PixelFormat> {
   val streams =
-    this.getCameraCharacteristic(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
+    this[CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP]
       ?: return emptyArray()
   return streams.outputFormats
     .map { PixelFormat.fromImageFormat(it, PixelRange.UNKNOWN) }
```

---

### Incident Patch 5: `2cacb537` (2026-08-19)
**Commit Message**: fix: Use callback `setPreparedPhotoSettingsArray` overload to fix `EXC_BREAKPOINT` on cancel (#4161)

* fix: Use callback `setPreparedPhotoSettingsArray` overload to fix `EXC_BREAKPOINT` on cancel

* test it

* Update visioncamera.photo.harness.ts

* move into finally

**File**: `apps/simple-camera/__tests__/visioncamera.photo.harness.ts` (modified, +47/-0)
```diff
@@ -1,3 +1,4 @@
+import { Platform } from 'react-native'
 import {
   assert,
   beforeAll,
@@ -20,6 +21,7 @@ import type {
   Size,
 } from 'react-native-vision-camera'
 import { CommonResolutions, VisionCamera } from 'react-native-vision-camera'
+import { withTimeout } from './test-utils'
 
 const sleep = (ms: number) =>
   new Promise<void>((resolve) => setTimeout(resolve, ms))
@@ -789,6 +791,51 @@ describe('VisionCamera - Photo', () => {
     }
   })
 
+  it('rejects a superseded Photo settings preparation', async (context) => {
+    if (Platform.OS !== 'ios') {
+      return context.skip('Photo settings preparation cancellation: iOS only')
+    }
+
+    const session = await VisionCamera.createCameraSession(false)
+    const photoOutput = VisionCamera.createPhotoOutput({
+      targetResolution: CommonResolutions.HD_4_3,
+      containerFormat: 'jpeg',
+      quality: 0.8,
+      qualityPrioritization: 'balanced',
+    })
+    try {
+      await session.configure([
+        {
+          input: backDevice,
+          outputs: [{ output: photoOutput, mirrorMode: 'auto' }],
+          constraints: [],
+        },
+      ])
+
+      // iOS defers preparation while the session is stopped. Submitting a new
+      // request must cancel the pending request without crashing the process.
+      const firstPreparation = photoOutput.prepareSettings([{}])
+      const firstPreparationRejection = expect(
+        withTimeout(
+          firstPreparation,
+          10_000,
+          'superseded Photo settings preparation',
+        ),
+      ).rejects.toThrow('Settings preparation has been canceled!')
+      const replacementPreparation = photoOutput.prepareSettings([{}])
+
+      await session.start()
+      await firstPreparationRejection
+      await withTimeout(
+        replacementPreparation,
+        10_000,
+        'replacement Photo settings preparation',
+      )
+    } finally {
+      await session.stop()
+    }
+  })
+
   it('toggles enableShutterSound and enableRedEyeReduction without error', async () => {
     const session = await VisionCamera.createCameraSession(false)
     const photoOutput = VisionCamera.createPhotoOutput({
```

**File**: `packages/react-native-vision-camera/ios/Hybrid Objects/Outputs/HybridCameraPhotoOutput.swift` (modified, +14/-4)
```diff
@@ -185,11 +185,21 @@ final class HybridCameraPhotoOutput: HybridCameraPhotoOutputSpec, NativeCameraOu
   }
 
   func prepareSettings(settings: [CapturePhotoSettings]) throws -> Promise<Void> {
-    return Promise.async {
-      let captureSettings = try settings.map {
-        try $0.toAVCapturePhotoSettings(for: self.output, withOptions: self.options)
+    let promise = Promise<Void>()
+    let captureSettings = try settings.map {
+      try $0.toAVCapturePhotoSettings(for: self.output, withOptions: self.options)
+    }
+    self.output.setPreparedPhotoSettingsArray(captureSettings) { prepared, error in
+      if let error {
+        promise.reject(withError: error)
+      } else {
+        if prepared {
+          promise.resolve()
+        } else {
+          promise.reject(withError: RuntimeError("Settings preparation has been canceled!"))
+        }
       }
-      try await self.output.setPreparedPhotoSettingsArray(captureSettings)
     }
+    return promise
   }
 }
```

---

### Incident Patch 6: `c0374a25` (2026-08-12)
**Commit Message**: fix: Emit current orientation on subscribe (#4150)

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/hybrids/orientation/HybridDeviceOrientationManager.kt` (modified, +5/-1)
```diff
@@ -32,9 +32,11 @@ class HybridDeviceOrientationManager : HybridOrientationManagerSpec() {
 
   override fun startOrientationUpdates(onChanged: (orientation: CameraOrientation) -> Unit) {
     orientationListener?.disable()
+    currentOrientation?.let(onChanged)
     orientationListener =
       object : OrientationEventListener(context) {
         override fun onOrientationChanged(rotationDegrees: Int) {
+          if (orientationListener !== this) return
           if (rotationDegrees == ORIENTATION_UNKNOWN) {
             // phone is laying flat - orientation is unknown! Avoid sending out event.
             return
@@ -51,6 +53,8 @@ class HybridDeviceOrientationManager : HybridOrientationManagerSpec() {
   }
 
   override fun stopOrientationUpdates() {
-    orientationListener?.disable()
+    val listener = orientationListener
+    orientationListener = null
+    listener?.disable()
   }
 }
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/hybrids/orientation/HybridInterfaceOrientationManager.kt` (modified, +8/-3)
```diff
@@ -32,13 +32,19 @@ class HybridInterfaceOrientationManager : HybridOrientationManagerSpec() {
     listener?.let { listener ->
       displayManager.unregisterDisplayListener(listener)
     }
+    val defaultDisplay = displayManager.displays.firstOrNull()
+    if (defaultDisplay != null) {
+      currentOrientation = CameraOrientation.fromSurfaceRotation(defaultDisplay.rotation)
+    }
+    currentOrientation?.let(onChanged)
     val listener =
       object : DisplayManager.DisplayListener {
         override fun onDisplayAdded(displayId: Int) = Unit
 
         override fun onDisplayRemoved(displayId: Int) = Unit
 
         override fun onDisplayChanged(displayId: Int) {
+          if (this@HybridInterfaceOrientationManager.listener !== this) return
           val display = displayManager.getDisplay(displayId) ?: return
           val surfaceRotation = display.rotation
           val orientation = CameraOrientation.fromSurfaceRotation(surfaceRotation)
@@ -54,9 +60,8 @@ class HybridInterfaceOrientationManager : HybridOrientationManagerSpec() {
   }
 
   override fun stopOrientationUpdates() {
-    listener?.let { listener ->
-      displayManager.unregisterDisplayListener(listener)
-    }
+    val currentListener = listener
     listener = null
+    currentListener?.let(displayManager::unregisterDisplayListener)
   }
 }
```

**File**: `packages/react-native-vision-camera/ios/Hybrid Objects/Orientation/HybridDeviceOrientationManager.swift` (modified, +3/-0)
```diff
@@ -29,6 +29,9 @@ final class HybridDeviceOrientationManager: HybridOrientationManagerSpec {
     if motionManager.isAccelerometerActive {
       motionManager.stopAccelerometerUpdates()
     }
+    if let currentOrientation {
+      onChanged(currentOrientation)
+    }
 
     if motionManager.isAccelerometerAvailable {
       motionManager.startAccelerometerUpdates(to: operationQueue) {
```

**File**: `packages/react-native-vision-camera/ios/Hybrid Objects/Orientation/HybridInterfaceOrientationManager.swift` (modified, +8/-0)
```diff
@@ -34,6 +34,13 @@ final class HybridInterfaceOrientationManager: HybridOrientationManagerSpec {
       // Start new listener (beginGeneratingDeviceOrientationNotifications() can be nested)
       UIDevice.current.beginGeneratingDeviceOrientationNotifications()
 
+      let interfaceOrientation = UIApplication.shared.interfaceOrientation
+      if interfaceOrientation != .unknown {
+        let orientation = CameraOrientation(interfaceOrientation: interfaceOrientation)
+        self.currentOrientation = orientation
+        onChanged(orientation)
+      }
+
       self.observer = NotificationCenter.default.addObserver(
         forName: UIDevice.orientationDidChangeNotification,
         object: nil,
@@ -60,6 +67,7 @@ final class HybridInterfaceOrientationManager: HybridOrientationManagerSpec {
       if let observer = self.observer {
         logger.info("Stopping interface orientation updates...")
         NotificationCenter.default.removeObserver(observer)
+        self.observer = nil
         UIDevice.current.endGeneratingDeviceOrientationNotifications()
       }
     }
```

**File**: `packages/react-native-vision-camera/src/hooks/useOrientation.ts` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ export function useOrientation(
 ): CameraOrientation | undefined {
   const orientationManager = useOrientationManager(source)
   const currentOrientation = useRef(orientationManager?.currentOrientation)
+  currentOrientation.current = orientationManager?.currentOrientation
 
   const subscribe = useCallback(
     (onStoreChange: () => void) => {
```

---

### Incident Patch 7: `019764cb` (2026-08-12)
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

---

### Incident Patch 8: `19b7eca8` (2026-08-12)
**Commit Message**: feat: Add `onUIRotationChanged(..)` (#4147)

* feat: Add `onUIRotationChanged(..)`

* ok?

* fix logic

* animated ?

* fix: Get rotation working

* Add docs

* rename `getUIRotation`

* simplify to use `getUIRotation`

**File**: `apps/simple-camera/__tests__/README.md` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ Tests are split by domain. Each file tests one slice of the imperative `VisionCa
 | [visioncamera.constraints.harness.ts](visioncamera.constraints.harness.ts) | `VisionCamera.resolveConstraints` + `onSessionConfigSelected`, FPS / HDR / stabilization / binned / pixelFormat / resolutionBias constraints |
 | [visioncamera.controller.harness.ts](visioncamera.controller.harness.ts) | `CameraController` — zoom, torch, exposure bias, focus metering, low-light boost, subject area listener |
 | [visioncamera.hooks.harness.tsx](visioncamera.hooks.harness.tsx) | React hook reactivity for `useCameraDevice(...)` position and physical-device filter changes |
+| [visioncamera.utils.harness.ts](visioncamera.utils.harness.ts) | Pure public utilities such as `getUIRotation(...)` across every output/interface orientation pair |
 | [visioncamera.coordinates.harness.ts](visioncamera.coordinates.harness.ts) | `Frame.convertFramePointToCameraPoint` / `convertCameraPointToFramePoint`, `PreviewView.convertViewPointToCameraPoint` / `convertCameraPointToViewPoint`, `PreviewView.createMeteringPoint`, `convertScannedObjectCoordinatesToViewCoordinates`, end-to-end Frame → Camera → View round-trip |
 | [visioncamera.nativepreviewview.harness.tsx](visioncamera.nativepreviewview.harness.tsx) | Bare `NativePreviewView` lifecycle, layout-sensitive preview regression coverage, `resizeMode`, Android `implementationMode`, gesture controllers, multi-preview mounting, `PreviewView` ref methods, Android `takeSnapshot()` dimensions |
 | [visioncamera.camera-view.harness.tsx](visioncamera.camera-view.harness.tsx) | High-level `<Camera>` preview lifecycle, photo output integration, controller props, native gestures, `CameraRef` methods, `isActive`, mount / unmount / replacement behavior |
```

**File**: `apps/simple-camera/__tests__/visioncamera.utils.harness.ts` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+import { describe, expect, it } from 'react-native-harness'
+import type { CameraOrientation } from 'react-native-vision-camera'
+import { getUIRotation } from 'react-native-vision-camera'
+
+describe('VisionCamera - Utils', () => {
+  it('calculates UI rotation for every output and interface orientation', () => {
+    const expectedRotations = [
+      { output: 'up', interface: 'up', rotation: 0 },
+      { output: 'up', interface: 'right', rotation: 90 },
+      { output: 'up', interface: 'down', rotation: 180 },
+      { output: 'up', interface: 'left', rotation: -90 },
+      { output: 'right', interface: 'up', rotation: -90 },
+      { output: 'right', interface: 'right', rotation: 0 },
+      { output: 'right', interface: 'down', rotation: 90 },
+      { output: 'right', interface: 'left', rotation: 180 },
+      { output: 'down', interface: 'up', rotation: 180 },
+      { output: 'down', interface: 'right', rotation: -90 },
+      { output: 'down', interface: 'down', rotation: 0 },
+      { output: 'down', interface: 'left', rotation: 90 },
+      { output: 'left', interface: 'up', rotation: 90 },
+      { output: 'left', interface: 'right', rotation: 180 },
+      { output: 'left', interface: 'down', rotation: -90 },
+      { output: 'left', interface: 'left', rotation: 0 },
+    ] satisfies {
+      output: CameraOrientation
+      interface: CameraOrientation
+      rotation: number
+    }[]
+
+    const reportedRotations = expectedRotations.map(
+      ({ output, interface: interfaceOrientation }) => ({
+        output,
+        interface: interfaceOrientation,
+        rotation: getUIRotation(output, interfaceOrientation),
+      }),
+    )
+
+    expect(reportedRotations).toEqual(expectedRotations)
+  })
+})
```

**File**: `apps/simple-camera/src/components/CameraSelectorButton.tsx` (modified, +19/-1)
```diff
@@ -5,17 +5,20 @@ import {
 } from '@react-native-menu/menu'
 import type React from 'react'
 import { useCallback, useMemo } from 'react'
+import { Animated } from 'react-native'
 import type { CameraDevice, CameraPosition } from 'react-native-vision-camera'
 import { IconButton } from './IconButton'
 
 interface Props {
   devices: CameraDevice[]
   setDevice: (device: CameraDevice) => void
+  uiRotation: Animated.Value
 }
 
 export function CameraSelectorButton({
   devices,
   setDevice,
+  uiRotation,
 }: Props): React.ReactElement {
   const menuActions = useMemo<MenuAction[]>(() => {
     const positions = ['back', 'front', 'external'].filter<CameraPosition>(
@@ -49,9 +52,24 @@ export function CameraSelectorButton({
     [devices, setDevice],
   )
 
+  const rotate = uiRotation.interpolate({
+    inputRange: [0, 360],
+    outputRange: ['0deg', '360deg'],
+  })
+
   return (
     <MenuView actions={menuActions} onPressAction={onMenuItemPressed}>
-      <IconButton iconName="camera" onPress={() => {}} />
+      <Animated.View
+        style={{
+          transform: [
+            {
+              rotate: rotate,
+            },
+          ],
+        }}
+      >
+        <IconButton iconName="camera" onPress={() => {}} />
+      </Animated.View>
     </MenuView>
   )
 }
```

**File**: `apps/simple-camera/src/screens/CameraScreen.tsx` (modified, +17/-1)
```diff
@@ -1,6 +1,13 @@
 import { useIsFocused, useNavigation } from '@react-navigation/native'
 import { useCallback, useEffect, useRef, useState } from 'react'
-import { StatusBar, StyleSheet, Text, View } from 'react-native'
+import {
+  Animated,
+  StatusBar,
+  StyleSheet,
+  Text,
+  useAnimatedValue,
+  View,
+} from 'react-native'
 import {
   type Recorder,
   useCameraDeviceExtensions,
@@ -30,6 +37,7 @@ export function CameraScreen() {
   const [enableVideo, setEnableVideo] = useState(false)
   const [enableFrameStream, setEnableFrameStream] = useState(false)
   const [enableDepthStream, setEnableDepthStream] = useState(false)
+  const uiRotation = useAnimatedValue(0, { useNativeDriver: true })
 
   const devices = useCameraDevices()
   const defaultDevice = devices[0]
@@ -234,6 +242,13 @@ export function CameraScreen() {
         device={device}
         outputs={[photoOutput]}
         mirrorMode={device.position === 'front' ? 'on' : 'off'}
+        orientationSource="device"
+        onUIRotationChanged={(rotation) => {
+          Animated.spring(uiRotation, {
+            toValue: rotation,
+            useNativeDriver: true,
+          }).start()
+        }}
         constraints={
           [
             // Session Constraints
@@ -250,6 +265,7 @@ export function CameraScreen() {
         <Row>
           <View style={styles.flex} />
           <CameraSelectorButton
+            uiRotation={uiRotation}
             devices={devices}
             setDevice={(d) => {
               setDevice(d)
```

**File**: `docs/content/docs/orientation.mdx` (modified, +49/-3)
```diff
@@ -8,11 +8,13 @@ import { Tab, Tabs } from 'fumadocs-ui/components/tabs'
 A Camera has a fixed sensor orientation in which Frames are streamed in.
 If you rotate your phone, the Camera doesn't physically rotate alongside with it, so rotation has to be applied to the Frames dynamically - and each [`CameraOutput`](/api/react-native-vision-camera/hybrid-objects/CameraOutput) applies orientation differently.
 
-### Automatically set Orientation
+### Set Orientation
+
+#### Automatically set Orientation
 
 In most cases, your [`Orientation`](/api/react-native-vision-camera/type-aliases/CameraOrientation) should be automatically set to either the App's Interface Orientation, or your Phone's Device Orientation:
 
-- App Interface Orientation ([`'interface'`](/api/react-native-vision-camera/type-aliases/OrientationSource)): Changes output orientation only when the UI rotates. If the UI is locked to `portrait` and the phone is held sideways, the output orientation will still stick to `portrait` ([`'up'`](/api/react-native-vision-camera/type-aliases/CameraOrientation)). This is how apps like Snapchat or Instagram work.
+- App Interface Orientation ([`'interface'`](/api/react-native-vision-camera/type-aliases/OrientationSource)): Changes output orientation only when the UI rotates. If the UI is locked to `portrait` and the phone is held sideways, the output orientation will still stick to `portrait` ([`'up'`](/api/react-native-vision-camera/type-aliases/CameraOrientation)). This is how apps like Snapchat or Instagram work - they are effectively locked to `portrait`.
 - Phone Device Orientation ([`'device'`](/api/react-native-vision-camera/type-aliases/OrientationSource)): Changes output orientation when the phone physically rotates. If the UI is locked to `portrait` and the phone is held sideways, the output orientation will change to be sideways - even if the UI doesn't rotate to `landscape`. This is how most photography apps (including the stock iOS Camera app) work.
 
 VisionCamera exposes two [`OrientationManager`](/api/react-native-vision-camera/hybrid-objects/OrientationManager)s - one for monitoring [`'interface'`](/api/react-native-vision-camera/type-aliases/OrientationSource) orientation, and one for monitoring [`'device'`](/api/react-native-vision-camera/type-aliases/OrientationSource) orientation:
@@ -61,10 +63,54 @@ output.outputOrientation = orientationManager.currentOrientation
 </Tab>
 </Tabs>
 
-### Manually set Orientation
+#### Manually set Orientation
 
 For full manual control over orientation, set [`orientationSource`](/api/react-native-vision-camera/interfaces/CameraProps#orientationsource) to [`'custom'`](/api/react-native-vision-camera/type-aliases/OrientationSource) (if you are using `<Camera />` or `useCamera(...)`), and set a custom [`CameraOutput.outputOrientation`](/api/react-native-vision-camera/hybrid-objects/CameraOutput#outputorientation) for your outputs.
 
+#### Rotate UI Elements based on Camera Orientation
+
+If your Camera's [`orientationSource`](/api/react-native-vision-camera/interfaces/CameraProps#orientationsource) is set to [`'device'`](/api/react-native-vision-camera/type-aliases/OrientationSource) (or [`'custom'`](/api/react-native-vision-camera/type-aliases/OrientationSource)), your UI will not rotate alongside with the Camera pipeline.
+To then visually rotate individual Camera controls (such as the Flip Camera button, a Flash button, or other controls), listen to the [`onUIRotationChanged`](/api/react-native-vision-camera/interfaces/CameraProps#onuirotationchanged) callback and rotate accordingly:
+
+```tsx
+function App() {
+  const device = useCameraDevice('back')
+  // [!code ++]
+  const uiRotation = useAnimatedValue(0)
+  // [!code ++:4]
+  const rotate = uiRotation.interpolate({
+    inputRange: [0, 360],
+    outputRange: ['0deg', '360deg'],
+  })
+
+  return (
+    <View>
+      <Camera
+        style={StyleSheet.absoluteFill}
+        isActive={true}
+        device={device}
+        orientationSource="device"
+        // [!code ++:6]
+        onUIRotationChanged={(rotation) => {
+          Animated.spring(uiRotation, {
+            toValue: rotation,
+            useNativeDriver: true,
+          }).start()
+        }}
+      />
+      // [!code ++]
+      <Animated.View style={{ transform: [{ rotate: rotate }] }}>
+        <FlashButton />
+      // [!code ++]
+      </Animated.View>
+    </View>
+  )
+}
+```
+
+> [!TIP]
+> Use [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/) for more control over animations.
+
 ### How Orientation is handled
 
 Since Camera sensors have fixed orientations, rotation has to be applied to Frames dynamically. The Camera pipeline does not physically rotate buffers, as this is computationally expensive and would introduce latency.
```

**File**: `packages/react-native-vision-camera/src/hooks/useCamera.ts` (modified, +33/-0)
```diff
@@ -22,12 +22,14 @@ import type {
 import type { CameraSessionConfig } from '../specs/session/CameraSessionConfig.nitro'
 import type { CameraSessionConfiguration } from '../specs/session/CameraSessionConfiguration'
 import type { CameraSessionConnection } from '../specs/session/CameraSessionConnection'
+import { getUIRotation } from '../utils/getUIRotation'
 import { useCameraController } from './internal/useCameraController'
 import { useCameraControllerConfiguration } from './internal/useCameraControllerConfiguration'
 import { useCameraSession } from './internal/useCameraSession'
 import { useCameraSessionIsRunning } from './internal/useCameraSessionIsRunning'
 import { useExposureUpdater } from './internal/useExposureUpdater'
 import { useListenerSubscription } from './internal/useListenerSubscription'
+import { useStableCallback } from './internal/useStableCallback'
 import { useTorchModeUpdater } from './internal/useTorchModeUpdater'
 import { useZoomUpdater } from './internal/useZoomUpdater'
 import { useOrientation } from './useOrientation'
@@ -86,6 +88,16 @@ export interface CameraProps
    * @see {@linkcode CameraOutput.outputOrientation}
    */
   orientationSource?: OrientationSource | 'custom'
+  /**
+   * Called when the Camera Output orientation (driven
+   * by {@linkcode orientationSource}) or the interface
+   * orientation changes with a {@linkcode rotation} value
+   * that specifies the degrees needed to rotate UI elements
+   * such as Camera controls (flash button, Camera flip button)
+   * so they appear upright.
+   * @param rotation The degrees that UI elements need to be rotated by to appear up-right.
+   */
+  onUIRotationChanged?: (rotation: number) => void
   /**
    * Sets whether the {@linkcode CameraOutput}s are mirrored along
    * the vertical axis. {@linkcode MirrorMode | 'auto'} mirrors
@@ -252,6 +264,7 @@ export function useCamera({
   onInterruptionStarted,
   onInterruptionEnded,
   onSubjectAreaChanged,
+  onUIRotationChanged,
   enableDistortionCorrection,
   enableLowLightBoost,
   enableSmoothAutoFocus,
@@ -265,6 +278,12 @@ export function useCamera({
     onError: onError,
   })
 
+  // TODO: Refactor our orientation logic here because it is problematic for multiple reasons;
+  //       1. Avoid going through re-renders/React state to change orientation (2x useOrientation(..)) (slow)
+  //       2. Avoid going through multiple setter calls here in a useEffect to set output orientation (possible race condition)
+  //       3. Avoid having a static useOrientation(...) hook - instead, have a UI element (`<NativePreviewView />`) fire interface orientation listeners (multi-display support)
+  //       4. orientationSource="custom" currently resorts back to 'up', which is not true - not sure if we just skip the callback or ignore instead?
+  //       Instead, have orientation source be native/declarative so we can use `AVCaptureDevice.RotationCoordinator` and drive orientation from a preview without re-renders.
   // 2. Update output orientations
   const orientationSourceOrUndefined =
     orientationSource === 'custom' ? undefined : orientationSource
@@ -276,6 +295,20 @@ export function useCamera({
     }
   }, [orientation, outputs])
 
+  // 2.1. Call onUIRotationChanged listener
+  const interfaceOrientation = useOrientation(
+    onUIRotationChanged != null ? 'interface' : undefined,
+  )
+  const uiRotation = getUIRotation(
+    orientation ?? 'up',
+    interfaceOrientation ?? 'up',
+  )
+  const stableOnUIRotationChanged = useStableCallback(onUIRotationChanged)
+  useEffect(() => {
+    if (stableOnUIRotationChanged == null) return
+    stableOnUIRotationChanged(uiRotation)
+  }, [stableOnUIRotationChanged, uiRotation])
+
   // 4. Configure the session with the input + outputs to create a `CameraController`
   const controller = useCameraController(session, device, outputs, {
     mirrorMode: mirrorMode,
```

**File**: `packages/react-native-vision-camera/src/index.ts` (modified, +1/-0)
```diff
@@ -93,6 +93,7 @@ export * from './threading/RuntimeThreadProvider'
 export * from './utils/CommonDynamicRanges'
 export * from './utils/CommonResolutions'
 export * from './utils/FrameConverter'
+export * from './utils/getUIRotation'
 // Main factory
 export * from './VisionCamera'
 // Views
```

**File**: `packages/react-native-vision-camera/src/utils/getUIRotation.ts` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import type { CameraOrientation } from '../specs/common-types/CameraOrientation'
+
+function cameraOrientationToDegrees(
+  orientation: CameraOrientation,
+): 0 | 90 | 180 | 270 {
+  switch (orientation) {
+    case 'up':
+      return 0
+    case 'right':
+      return 90
+    case 'down':
+      return 180
+    case 'left':
+      return 270
+  }
+}
+
+/**
+ * Gets the signed rotation needed to keep UI elements upright relative to the
+ * Camera output orientation.
+ *
+ * The result is normalized to the shortest cardinal rotation, with opposite
+ * orientations represented as `180`.
+ */
+export function getUIRotation(
+  outputOrientation: CameraOrientation,
+  interfaceOrientation: CameraOrientation,
+): number {
+  // Convert to degrees
+  const outputOrientationDegrees = cameraOrientationToDegrees(outputOrientation)
+  const interfaceOrientationDegrees =
+    cameraOrientationToDegrees(interfaceOrientation)
+  // Calculate difference, not overshooting 360°
+  const rotation =
+    (interfaceOrientationDegrees - outputOrientationDegrees + 360) % 360
+  const normalizedRotation = rotation % 360
+  if (normalizedRotation > 180) {
+    // Converts 270° to -90°
+    return normalizedRotation - 360
+  } else {
+    return normalizedRotation
+  }
+}
```

---

### Incident Patch 9: `53330199` (2026-08-10)
**Commit Message**: fix: compose `Photo.toImage()` rotation before mirroring (#4143)

Matrix.preScale right-multiplies and postRotate left-multiplies, so the
mirror was applied before the rotation. A reflection conjugates a rotation
into its inverse, so that ordering leaves the Image a half turn from what
`orientation` and `isMirrored` describe, and 180 degrees away from the EXIF
file path and the live preview.

The same composition is in ImageProxy.toBitmap, which the Frame and Depth
converters go through, so both are fixed here.

Adds the harness coverage that pins it: one front-camera capture, compared
point by point against the stored frame read through the reported rotation.

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `apps/simple-camera/__tests__/visioncamera.photo.harness.ts` (modified, +123/-0)
```diff
@@ -9,6 +9,7 @@ import {
   waitUntil,
 } from 'react-native-harness'
 import type { Image } from 'react-native-nitro-image'
+import { Images } from 'react-native-nitro-image'
 import type {
   CameraDevice,
   CameraDeviceFactory,
@@ -990,4 +991,126 @@ describe('VisionCamera - Photo', () => {
       await session.stop()
     }
   })
+
+  it('renders toImage() the same way the reported orientation describes', async (context) => {
+    // Regression: `HybridPhoto.toImage()` composed the mirror with `preScale` and
+    // the rotation with `postRotate`, which applies the mirror first. A reflection
+    // conjugates a rotation into its inverse, so the two orderings differ by twice
+    // the rotation - a half turn at a quarter-turn orientation. At `up` and `down`
+    // both orderings are the same matrix, so only quarter turns expose it.
+    const frontDevice = factory.getDefaultCamera('front')
+    assert.exists(frontDevice, 'no front camera')
+
+    const session = await VisionCamera.createCameraSession(false)
+    const photoOutput = VisionCamera.createPhotoOutput({
+      targetResolution: CommonResolutions.HD_4_3,
+      containerFormat: 'jpeg',
+      quality: 1,
+      qualityPrioritization: 'balanced',
+    })
+    await session.configure([
+      {
+        input: frontDevice,
+        outputs: [{ output: photoOutput, mirrorMode: 'auto' }],
+        constraints: [],
+      },
+    ])
+    await session.start()
+
+    try {
+      // Taken as the pipeline reports it. Forcing `outputOrientation` does not help:
+      // CameraX then rotates the pixels itself and reports no rotation at all.
+      const photo = await photoOutput.capturePhoto(
+        { flashMode: 'off', enableShutterSound: false },
+        {},
+      )
+      try {
+        const quarterTurns = { left: 90, right: 270 } as const
+        const rotation =
+          quarterTurns[photo.orientation as keyof typeof quarterTurns]
+        if (rotation == null) {
+          return context.skip(
+            `photo.orientation is "${photo.orientation}": this device does not report a quarter turn, so the mirror and rotation never compose`,
+          )
+        }
+        if (!photo.isMirrored) {
+          return context.skip(
+            'photo.isMirrored is false: without a mirror both orderings are the same matrix',
+          )
+        }
+
+        const storedPath = await photo.saveToTemporaryFileAsync()
+        const storedImage = await Images.loadFromFileAsync(storedPath)
+        const renderedImage = await photo.toImageAsync()
+        try {
+          const stored = await storedImage.toRawPixelDataAsync(false)
+          const rendered = await renderedImage.toRawPixelDataAsync(false)
+          if (
+            stored.width !== rendered.height ||
+            stored.height !== rendered.width
+          ) {
+            return context.skip(
+              `stored ${stored.width}x${stored.height} against rendered ${rendered.width}x${rendered.height}: this platform's decoder already applied the orientation, so the two cannot be compared point by point`,
+            )
+          }
+
+          const readChannelAverage = (
+            pixels: typeof stored,
+            x: number,
+            y: number,
+          ) => {
+            const bytes = new Uint8Array(pixels.buffer)
+            const bytesPerPixel = Math.floor(
+              bytes.length / (pixels.width * pixels.height),
+            )
+            const offset = (y * pixels.width + x) * bytesPerPixel
+            let sum = 0
+            for (let channel = 0; channel < 3; channel++) {
+              sum += bytes[offset + channel] ?? 0
+            }
+            return sum / 3
+          }
+
+          // Where a rendered point came from in the stored frame, if the rotation
+          // the Photo reports is applied first and the mirror after it.
+          const toStoredPoint = (x: number, y: number): [number, number] => {
+            const mirroredX = rendered.width - 1 - x
+            return rotation === 90
+              ? [y, stored.height - 1 - mirroredX]
+              : [stored.width - 1 - y, mirroredX]
+          }
+
+          const steps = 16
+          let totalDifference = 0
+          let samples = 0
+          for (let row = 1; row < steps; row++) {
+            for (let column = 1; column < steps; column++) {
+              const x = Math.floor((column * rendered.width) / steps)
+              const y = Math.floor((row * rendered.height) / steps)
+              const [storedX, storedY] = toStoredPoint(x, y)
+              totalDifference += Math.abs(
+                readChannelAverage(rendered, x, y) -
+                  readChannelAverage(stored, storedX, storedY),
+              )
+              samples++
+            }
+          }
+
+          // Both images decode the same JPEG, so the rendering the Photo describes
+          // is pixel identical to the stored frame read through it - the scene in
+          // front of the camera does not 
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/ImageProxy+toBitmap.kt` (modified, +3/-3)
```diff
@@ -13,12 +13,12 @@ fun ImageProxy.toBitmap(
 
   val matrix =
     Matrix().apply {
-      if (isMirrored) {
-        preScale(-1f, 1f)
-      }
       if (orientation != CameraOrientation.UP) {
         postRotate(orientation.degrees.toFloat())
       }
+      if (isMirrored) {
+        postScale(-1f, 1f)
+      }
     }
   if (matrix.isIdentity) {
     // No transforms needed! Just return
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/hybrids/instances/HybridPhoto.kt` (modified, +3/-3)
```diff
@@ -156,13 +156,13 @@ class HybridPhoto(
 
     val matrix =
       Matrix().apply {
-        if (isMirrored) {
-          preScale(-1f, 1f)
-        }
         if (orientation != CameraOrientation.UP) {
           val orientationToApply = orientation.counterRotated()
           postRotate(orientationToApply.degrees.toFloat())
         }
+        if (isMirrored) {
+          postScale(-1f, 1f)
+        }
       }
     if (matrix.isIdentity) {
       // No transforms needed! Just return
```

---

### Incident Patch 10: `77f7aaf5` (2026-08-10)
**Commit Message**: docs: Add recommended split between Object Output and Barcode Scanner guide (#4144)

* docs: Add recommended split between Object Output and Barcode Scanner guide

* Expo tab

* links

**File**: `docs/content/docs/barcode-scanner-vs-object-output.mdx` (modified, +48/-1)
```diff
@@ -19,7 +19,54 @@ It works on both iOS and Android.
 #### Platform Agnostic
 
 Since [the Barcode Scanner](barcode-scanner) uses the same MLKit implementation on iOS and Android, the scanned codes are platform-agnostic.
-In previous versions of VisionCamera, there were some codes readable on iOS but not on Android (like `'upc-a'` vs `'ean-13'`) - this is solved by using [the Barcode Scanner](barcode-scanner) on iOS too.
+In previous versions of VisionCamera, there were some codes readable on iOS but not on Android (like [`'upc-a'`](/api/react-native-vision-camera-barcode-scanner/type-aliases/BarcodeFormat) vs [`'ean-13'`](/api/react-native-vision-camera-barcode-scanner/type-aliases/BarcodeFormat)) - this is solved by using [the Barcode Scanner](barcode-scanner) on iOS too.
+
+### Recommended Platform-Specific Setup
+
+For most apps that only need to scan QR codes and Barcodes, the leanest setup is to use [the Object Output](object-output) on iOS and [the Barcode Scanner](barcode-scanner) on Android.
+This keeps MLKit and its ~2.4 MB model out of the iOS app, and avoids iOS Simulator build failures because the MLKit Barcode Scanning dependency does not ship Simulator binaries.
+
+React Native can select the implementation automatically when you split the scanner into two platform-specific files, for example `Scanner.ios.tsx` using [`useObjectOutput(...)`](/api/react-native-vision-camera/functions/useObjectOutput) and `Scanner.android.tsx` using [`useBarcodeScannerOutput(...)`](/api/react-native-vision-camera-barcode-scanner/functions/useBarcodeScannerOutput).
+
+Since native dependencies are autolinked independently of JavaScript imports, also exclude `react-native-vision-camera-barcode-scanner` from iOS autolinking:
+
+<Tabs items={["Expo", "React Native"]} groupId="framework" persist>
+<Tab value="Expo">
+On Expo SDK 54 and newer, exclude the package through [Expo Autolinking](https://docs.expo.dev/modules/autolinking/#exclude) in your app's `package.json`:
+
+```json title="package.json"
+{
+  "expo": {
+    "autolinking": {
+      "ios": {
+        "exclude": ["react-native-vision-camera-barcode-scanner"]
+      }
+    }
+  }
+}
+```
+
+On older Expo SDK versions, use the `react-native.config.js` setup from the React Native tab instead.
+</Tab>
+<Tab value="React Native">
+Create or update `react-native.config.js` in your app's root directory:
+
+```js title="react-native.config.js"
+module.exports = {
+  dependencies: {
+    'react-native-vision-camera-barcode-scanner': {
+      platforms: {
+        ios: null,
+      },
+    },
+  },
+}
+```
+</Tab>
+</Tabs>
+
+After changing the autolinking configuration, reinstall your iOS Pods.
+This requires a little more setup than using the Barcode Scanner on both platforms, but is usually the best option when the Object Output supports all code formats and result data your app needs.
 
 ### Different Object/Code Types
 
```

---

### Incident Patch 11: `a55096f6` (2026-08-05)
**Commit Message**: fix: Remove preview layers as well in `updateOutputs(..)` (#4134)

* fix: Remove preview layers as well in `updateOutputs(..)`

* Update HybridCameraSession.swift

* fix: Do it before updateInputs/updateOutputs

* remove -> detach

* Update HybridCameraSession.swift

**File**: `packages/react-native-vision-camera/ios/Hybrid Objects/HybridCameraSession.swift` (modified, +22/-0)
```diff
@@ -66,6 +66,8 @@ final class HybridCameraSession: HybridCameraSessionSpec {
         )
       }
 
+      // Detach all unwanted preview layers before touching inputs/outputs
+      self.detachUnwantedPreviewLayers(connections)
       // Remove all unwanted inputs and add all new inputs
       try self.updateInputs(connections)
       // Remove all unwanted outputs and add all new outputs
@@ -228,6 +230,25 @@ final class HybridCameraSession: HybridCameraSessionSpec {
   }
 
   // pragma MARK: Helpers
+  /**
+   * Detach all preview layers that are not listed in the [targetConnections] array
+   * from this [AVCaptureSession].
+   * This must run before [updateInputs] or [updateOutputs], as those methods kill
+   * preview connections without unsetting the `session`.
+   */
+  private func detachUnwantedPreviewLayers(_ targetConnections: [ResolvedCameraSessionConnection]) {
+    let currentlyAttachedPreviewLayers = self.session.connections.compactMap { $0.videoPreviewLayer }
+    for currentlyAttachedPreviewLayer in currentlyAttachedPreviewLayers {
+      let containsAttachedPreviewLayer = targetConnections.contains { connection in
+        return connection.isConnectedTo(preview: currentlyAttachedPreviewLayer)
+      }
+      if !containsAttachedPreviewLayer {
+        logger.info("Removing preview \(currentlyAttachedPreviewLayer)...")
+        currentlyAttachedPreviewLayer.session = nil
+      }
+    }
+  }
+
   /**
    * Adds all inputs on the given [targetConnections] if they haven't been added yet,
    * and removes all current inputs that aren't listed in the [connections] array.
@@ -289,6 +310,7 @@ final class HybridCameraSession: HybridCameraSessionSpec {
       }
     }
   }
+
   /**
    * Adds all outputs on the given [targetConnections] if they haven't been added yet,
    * and removes all current outputs that aren't listed in the [targetConnections] array.
```

---

### Incident Patch 12: `cbcc80a6` (2026-08-05)
**Commit Message**: fix: Cap the `AHardwareBuffer` import cache at maximum 12 images (#4129)

Importing an AHardwareBuffer into Vulkan acquires a reference on it, so the
unbounded import cache pinned every camera buffer the Resizer had ever seen.
Cap it at 12 entries, evicting oldest-inserted first.

Co-authored-by: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `packages/react-native-vision-camera-resizer/android/src/main/cpp/vulkan/VulkanHardwareBufferInterop.cpp` (modified, +8/-0)
```diff
@@ -73,6 +73,14 @@ const VulkanHardwareBufferInterop::ImportedImage& VulkanHardwareBufferInterop::i
     iterator = _cachedImages.erase(iterator);
   }
 
+  // Evict the oldest entries before inserting so old camera sessions' buffers get released.
+  // Safe to destroy here: run() holds _stateMutex across import -> dispatch -> submit-and-wait,
+  // so no imported image is in flight on the GPU at this point.
+  while (_cachedImages.size() >= kMaxCachedImages) {
+    destroyImportedImage(_cachedImages.front().importedImage);
+    _cachedImages.erase(_cachedImages.begin());
+  }
+
   // No suitable ImportedImage was found in our cache - we have to create a new one.
   CachedImage cachedImage{
       .hardwareBuffer = hardwareBuffer,
```

**File**: `packages/react-native-vision-camera-resizer/android/src/main/cpp/vulkan/VulkanHardwareBufferInterop.hpp` (modified, +9/-0)
```diff
@@ -70,6 +70,15 @@ class VulkanHardwareBufferInterop final {
     ImportedImage importedImage{};
   };
 
+  /**
+   * Upper bound on cached imported images (oldest-inserted evicted first).
+   * Importing an AHardwareBuffer into Vulkan acquires a reference on it, so every cached entry
+   * pins a whole camera buffer - each camera session restart allocates a fresh buffer set, and
+   * an unbounded cache pins the old sets forever. A streaming session cycles through ~4-6
+   * buffers, so 12 leaves plenty of slack.
+   */
+  static inline constexpr size_t kMaxCachedImages = 12;
+
   static inline constexpr VkFormatFeatureFlags kRequiredExternalFormatFeatures = VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT;
   static inline constexpr VkFormatFeatureFlags kLinearFilterFeatureMask =
       VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT | VK_FORMAT_FEATURE_SAMPLED_IMAGE_YCBCR_CONVERSION_LINEAR_FILTER_BIT;
```

---

### Incident Patch 13: `1e28058e` (2026-08-03)
**Commit Message**: chore: Test Preview position regression via Harness UI (#4124)

* chore: Test Preview position regression via Harness UI

* actually tap elements

**File**: `apps/simple-camera/__tests__/visioncamera.nativepreviewview.harness.tsx` (modified, +132/-0)
```diff
@@ -1,3 +1,4 @@
+import { screen, userEvent } from '@react-native-harness/ui'
 import {
   type LayoutChangeEvent,
   PixelRatio,
@@ -219,6 +220,119 @@ describe('VisionCamera - NativePreviewView', () => {
     }
   })
 
+  it('keeps a positioned NativePreviewView at its React layout after preview starts', async () => {
+    const session = await VisionCamera.createCameraSession(false)
+    const previewOutput = VisionCamera.createPreviewOutput()
+    await session.configure([
+      {
+        input: backDevice,
+        outputs: [{ output: previewOutput, mirrorMode: 'auto' }],
+        constraints: [],
+      },
+    ])
+
+    const previewRef = deferred<PreviewView>()
+    const rootLayout = deferred<Layout>()
+    const previewLayout = deferred<Layout>()
+    const previewStarted = deferred()
+    const errorSub = session.addOnErrorListener((error) => {
+      previewRef.reject(error)
+      rootLayout.reject(error)
+      previewLayout.reject(error)
+      previewStarted.reject(error)
+    })
+    const pressedPoints: Point[] = []
+
+    try {
+      await render(
+        <View
+          testID={POSITIONED_ROOT_TEST_ID}
+          style={styles.positionedRoot}
+          onLayout={(event) => {
+            rootLayout.resolve(toLayout(event))
+          }}
+          onStartShouldSetResponderCapture={() => true}
+          onResponderRelease={(event) => {
+            pressedPoints.push({
+              x: event.nativeEvent.pageX,
+              y: event.nativeEvent.pageY,
+            })
+          }}
+        >
+          <NativePreviewView
+            testID={POSITIONED_PREVIEW_TEST_ID}
+            style={styles.positionedPreview}
+            hybridRef={callback((preview: PreviewView) => {
+              previewRef.resolve(preview)
+            })}
+            onLayout={(event) => {
+              previewLayout.resolve(toLayout(event))
+            }}
+            onPreviewStarted={callback(previewStarted.resolve)}
+          />
+        </View>,
+      )
+
+      const preview = await withTimeout(
+        previewRef.promise,
+        10_000,
+        'positioned NativePreviewView hybridRef',
+      )
+      const rootFrame = await withTimeout(
+        rootLayout.promise,
+        10_000,
+        'positioned root onLayout',
+      )
+      const previewFrame = await withTimeout(
+        previewLayout.promise,
+        10_000,
+        'positioned NativePreviewView onLayout',
+      )
+
+      // Connect only after the initial native layout so attaching the native
+      // preview cannot race with a later React layout transaction.
+      preview.previewOutput = previewOutput
+      await session.start()
+      await withTimeout(
+        previewStarted.promise,
+        15_000,
+        'positioned NativePreviewView onPreviewStarted',
+      )
+
+      // Harness element references are intentionally opaque. userEvent.press
+      // taps each element's real native center, so the delta between these two
+      // public touch events reveals the preview's actual native offset while
+      // cancelling out the root's unknown screen origin.
+      const rootElement = await screen.findByTestId(POSITIONED_ROOT_TEST_ID)
+      const previewElement = await screen.findByTestId(
+        POSITIONED_PREVIEW_TEST_ID,
+      )
+      await userEvent.press(rootElement)
+      await userEvent.press(previewElement)
+
+      expect(pressedPoints).toHaveLength(2)
+      const rootCenter = pressedPoints[0]
+      const previewCenter = pressedPoints[1]
+      if (rootCenter == null || previewCenter == null) {
+        throw new Error('positioned preview touches were not received')
+      }
+
+      const actualLeft =
+        previewCenter.x -
+        rootCenter.x +
+        (rootFrame.width - previewFrame.width) / 2
+      const actualTop =
+        previewCenter.y -
+        rootCenter.y +
+        (rootFrame.height - previewFrame.height) / 2
+      expect(actualLeft).toBeCloseTo(POSITIONED_PREVIEW_LEFT, 0)
+      expect(actualTop).toBeCloseTo(POSITIONED_PREVIEW_TOP, 0)
+    } finally {
+      errorSub.remove()
+      await session.stop()
+    }
+  })
+
   it('keeps a flex preview laid out inside a padded overflow-hidden parent', async () => {
     const session = await VisionCamera.createCameraSession(false)
     const previewOutput = VisionCamera.createPreviewOutput()
@@ -1134,12 +1248,30 @@ describe('VisionCamera - NativePreviewView', () => {
 })
 
 const PADDING_TOP = 82
+const POSITIONED_ROOT_TEST_ID = 'positioned-preview-root'
+const POSITIONED_PREVIEW_TEST_ID = 'positioned-preview'
+const POSITIONED_PREVIEW_LEFT = 37
+const POSITIONED_PREVIEW_TOP = 83
+const POSITIONED_PREVIEW_WIDTH = 160
+const POSITIONED_PREVIEW_HEIGHT = 240
 const FIXED_PREVIEW_WIDTH = 150
 const FIXED_PREVIEW_HEIGHT = 300
 const WIDE_PREVIEW_WIDTH = 260
 const WIDE_PREVIEW_HEIGHT = 180
 
 const styles = StyleSheet.create({
+  positionedRoot: {
+    flex: 1,
+    backgroundColor: 'black',
+  },
+  positionedPreview: {
+    positio
```

**File**: `apps/simple-camera/ios/Podfile.lock` (modified, +26/-0)
```diff
@@ -23,6 +23,28 @@ PODS:
     - GoogleUtilities/Logger
     - GoogleUtilities/Privacy
   - GTMSessionFetcher/Core (3.5.0)
+  - HarnessUI (1.4.0-rc.1):
+    - hermes-engine
+    - RCTRequired
+    - RCTTypeSafety
+    - React-Core
+    - React-Core-prebuilt
+    - React-debug
+    - React-Fabric
+    - React-featureflags
+    - React-graphics
+    - React-ImageManager
+    - React-jsi
+    - React-NativeModulesApple
+    - React-RCTFabric
+    - React-renderercss
+    - React-rendererdebug
+    - React-utils
+    - ReactCodegen
+    - ReactCommon/turbomodule/bridging
+    - ReactCommon/turbomodule/core
+    - ReactNativeDependencies
+    - Yoga
   - hermes-engine (250829098.0.10):
     - hermes-engine/Pre-built (= 250829098.0.10)
   - hermes-engine/Pre-built (250829098.0.10)
@@ -2454,6 +2476,7 @@ PODS:
 
 DEPENDENCIES:
   - FBLazyVector (from `../../../node_modules/react-native/Libraries/FBLazyVector`)
+  - "HarnessUI (from `../../../node_modules/@react-native-harness/ui`)"
   - hermes-engine (from `../../../node_modules/react-native/sdks/hermes-engine/hermes-engine.podspec`)
   - NitroImage (from `../../../node_modules/react-native-nitro-image`)
   - NitroModules (from `../../../node_modules/react-native-nitro-modules`)
@@ -2564,6 +2587,8 @@ SPEC REPOS:
 EXTERNAL SOURCES:
   FBLazyVector:
     :path: "../../../node_modules/react-native/Libraries/FBLazyVector"
+  HarnessUI:
+    :path: "../../../node_modules/@react-native-harness/ui"
   hermes-engine:
     :podspec: "../../../node_modules/react-native/sdks/hermes-engine/hermes-engine.podspec"
     :tag: hermes-v250829098.0.10
@@ -2755,6 +2780,7 @@ SPEC CHECKSUMS:
   GoogleToolboxForMac: d1a2cbf009c453f4d6ded37c105e2f67a32206d8
   GoogleUtilities: 00c88b9a86066ef77f0da2fab05f65d7768ed8e1
   GTMSessionFetcher: 5aea5ba6bd522a239e236100971f10cb71b96ab6
+  HarnessUI: 873456a372d247aea2e8ec9a6439a35bbb1253c9
   hermes-engine: 691752261227b9de03faf08561f47f2e2b5b52e9
   MLImage: 0de5c6c2bf9e93b80ef752e2797f0836f03b58c0
   MLKitBarcodeScanning: 39de223e7b1b8a8fbf10816a536dd292d8a39343
```

**File**: `apps/simple-camera/package.json` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@
     "@react-native-community/cli-platform-ios": "20.1.3",
     "@react-native-harness/platform-android": "1.4.0-rc.1",
     "@react-native-harness/platform-apple": "1.4.0-rc.1",
+    "@react-native-harness/ui": "1.4.0-rc.1",
     "@react-native/babel-preset": "0.85.3",
     "@react-native/metro-config": "0.85.3",
     "@react-native/typescript-config": "0.85.3",
```

**File**: `bun.lock` (modified, +3/-0)
```diff
@@ -56,6 +56,7 @@
         "@react-native-community/cli-platform-ios": "20.1.3",
         "@react-native-harness/platform-android": "1.4.0-rc.1",
         "@react-native-harness/platform-apple": "1.4.0-rc.1",
+        "@react-native-harness/ui": "1.4.0-rc.1",
         "@react-native/babel-preset": "0.85.3",
         "@react-native/metro-config": "0.85.3",
         "@react-native/typescript-config": "0.85.3",
@@ -938,6 +939,8 @@
 
     "@react-native-harness/tools": ["@react-native-harness/tools@1.4.0-rc.1", "", { "dependencies": { "@clack/prompts": "1.0.0-alpha.9", "nano-spawn": "^1.0.2", "picocolors": "^1.1.1", "tslib": "^2.3.0" }, "peerDependencies": { "react-native": "*" } }, "sha512-A/Zj865TCX2XDIiLwdkxNFEwsjbnvVjJ5vjShu0Y2wpFAlFy6d1epACfQ9EDqhJi+1v3mUavZ6vhkqWEUuoUUA=="],
 
+    "@react-native-harness/ui": ["@react-native-harness/ui@1.4.0-rc.1", "", { "dependencies": { "@react-native-harness/runtime": "1.4.0-rc.1", "tslib": "^2.3.0" }, "peerDependencies": { "react-native": "*" } }, "sha512-BoggdQuPeyg6zoc3kYq8fRtsvoNw4/wpKIRSlhCdFwzKslGOr9KFCZlxZu13JdmeByUIAseGb3aAJfPlOxEAjw=="],
+
     "@react-native-menu/menu": ["@react-native-menu/menu@2.0.0", "", { "peerDependencies": { "react": "*", "react-native": "*" } }, "sha512-hb8Mirw6aKPGONhgo52IiNpwHtISVrgCT3rMdFX1qS7eOFNzOcQh8d2UDnaH5zVpxN+QuvWtaaiRMGFpIjzdtA=="],
 
     "@react-native-vector-icons/common": ["@react-native-vector-icons/common@13.0.1", "", { "dependencies": { "find-up": "^8.0.0", "picocolors": "^1.1.1", "plist": "^3.1.0" }, "peerDependencies": { "@react-native-vector-icons/get-image": "^13.0.0", "@react-native/assets-registry": "*", "expo-font": "*", "react": "*", "react-native": "*" }, "optionalPeers": ["@react-native-vector-icons/get-image", "@react-native/assets-registry", "expo-font"], "bin": { "rnvi-update-plist": "lib/commonjs/scripts/updatePlist.js" } }, "sha512-UPC6L3tW5rXCjBn4kgw9RPURUILIg8tFpEY2uaYwU8aCjEHkywNCMcAO8+PvMCDkR6aICPeHYA0OXvMgrjsF4g=="],
```

---

### Incident Patch 14: `93deb668` (2026-08-03)
**Commit Message**: fix: Fix alignment of `<Camera />` view with `top` / `left` (#3971)

Co-authored-by: Marc Rousavy <[REDACTED_EMAIL]>

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/ViewGroup+installHierarchyFitter.kt` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ fun ViewGroup.installHierarchyFitter() {
           View.MeasureSpec.makeMeasureSpec(measuredWidth, View.MeasureSpec.EXACTLY),
           View.MeasureSpec.makeMeasureSpec(measuredHeight, View.MeasureSpec.EXACTLY),
         )
-        parent?.layout(0, 0, parent.measuredWidth, parent.measuredHeight)
+        parent?.layout(parent.left, parent.top, parent.left + parent.measuredWidth, parent.top + parent.measuredHeight)
       }
     },
   )
```

---

### Incident Patch 15: `d6996a39` (2026-08-03)
**Commit Message**: fix: Use `onError` to emit configure/start errors (#4121)

* fix: Use `onError` to emit configure/start errors

* For session too

**File**: `packages/react-native-vision-camera/src/hooks/internal/useCameraController.ts` (modified, +40/-32)
```diff
@@ -15,6 +15,7 @@ interface Config extends CameraSessionConfiguration {
   constraints?: Constraint[]
   onSessionConfigSelected?: (config: CameraSessionConfig) => void
 
+  onError: (error: Error) => void
   onConfigured?: () => void
   getInitialZoom?: () => number | undefined
   getInitialExposureBias?: () => number | undefined
@@ -38,9 +39,10 @@ export function useCameraController(
     allowBackgroundAudioPlayback,
     allowHapticsAndSystemSoundsPlayback,
     getInitialExposureBias,
+    onError,
     onConfigured,
     getInitialZoom,
-  }: Config = {},
+  }: Config,
 ): CameraController | undefined {
   const [controller, setController] = useState<CameraController>()
 
@@ -56,6 +58,7 @@ export function useCameraController(
   const stableOnSessionConfigSelected = useStableCallback(
     onSessionConfigSelected ?? (() => {}),
   )
+  const stableOnError = useStableCallback(onError)
 
   // TODO: Can we use something like useSyncExternalStore or whatever to avoid "wrong" dependencies?
   // biome-ignore lint/correctness/useExhaustiveDependencies: It's an array of objects, we either have to deep-memo or just stringify.
@@ -79,40 +82,44 @@ export function useCameraController(
 
     let isCanceled = false
     const load = async () => {
-      if (device == null) {
-        // No device, configure with empty devices
-        session.configure([], {})
-        setController(undefined)
-      } else {
-        // Device + outputs - configure session
-        const controllers = await session.configure(
-          [
+      try {
+        if (device == null) {
+          // No device, configure with empty devices
+          session.configure([], {})
+          setController(undefined)
+        } else {
+          // Device + outputs - configure session
+          const controllers = await session.configure(
+            [
+              {
+                input: device,
+                outputs: stableOutputs.map((o) => ({
+                  output: o,
+                  mirrorMode: mirrorMode,
+                })),
+                constraints: stableConstraints,
+                initialExposureBias: stableGetInitialExposureBias?.(),
+                initialZoom: stableGetInitialZoom?.(),
+                onSessionConfigSelected: stableOnSessionConfigSelected,
+              },
+            ],
             {
-              input: device,
-              outputs: stableOutputs.map((o) => ({
-                output: o,
-                mirrorMode: mirrorMode,
-              })),
-              constraints: stableConstraints,
-              initialExposureBias: stableGetInitialExposureBias?.(),
-              initialZoom: stableGetInitialZoom?.(),
-              onSessionConfigSelected: stableOnSessionConfigSelected,
+              allowBackgroundAudioPlayback: allowBackgroundAudioPlayback,
+              allowHapticsAndSystemSoundsPlayback:
+                allowHapticsAndSystemSoundsPlayback,
             },
-          ],
-          {
-            allowBackgroundAudioPlayback: allowBackgroundAudioPlayback,
-            allowHapticsAndSystemSoundsPlayback:
-              allowHapticsAndSystemSoundsPlayback,
-          },
-        )
-        if (isCanceled) {
-          controllers.forEach((c) => {
-            c.dispose()
-          })
-          return
+          )
+          if (isCanceled) {
+            controllers.forEach((c) => {
+              c.dispose()
+            })
+            return
+          }
+          stableOnConfigured?.()
+          setController(controllers[0])
         }
-        stableOnConfigured?.()
-        setController(controllers[0])
+      } catch (error) {
+        stableOnError(error as Error)
       }
     }
     load()
@@ -131,6 +138,7 @@ export function useCameraController(
     stableGetInitialZoom,
     stableOnSessionConfigSelected,
     stableConstraints,
+    stableOnError,
   ])
 
   return controller
```

**File**: `packages/react-native-vision-camera/src/hooks/internal/useCameraControllerConfiguration.ts` (modified, +9/-2)
```diff
@@ -3,10 +3,12 @@ import type {
   CameraController,
   CameraControllerConfiguration,
 } from '../../specs/CameraController.nitro'
+import { useStableCallback } from './useStableCallback'
 
 export function useCameraControllerConfiguration(
   controller: CameraController | undefined,
   config: CameraControllerConfiguration,
+  onError: (error: Error) => void,
 ): void {
   const memoizedConfig = useMemo<CameraControllerConfiguration>(
     () => ({
@@ -20,6 +22,7 @@ export function useCameraControllerConfiguration(
       config.enableSmoothAutoFocus,
     ],
   )
+  const stableOnError = useStableCallback(onError)
 
   useEffect(() => {
     if (controller == null) return
@@ -28,8 +31,12 @@ export function useCameraControllerConfiguration(
       return
     }
     const load = async () => {
-      await controller.configure(memoizedConfig)
+      try {
+        await controller.configure(memoizedConfig)
+      } catch (error) {
+        stableOnError(error as Error)
+      }
     }
     load()
-  }, [memoizedConfig, controller])
+  }, [memoizedConfig, controller, stableOnError])
 }
```

**File**: `packages/react-native-vision-camera/src/hooks/internal/useCameraSession.ts` (modified, +14/-6)
```diff
@@ -1,32 +1,40 @@
 import { useEffect, useState } from 'react'
 import type { CameraSession } from '../../specs/session/CameraSession.nitro'
 import { VisionCamera } from '../../VisionCamera'
+import { useStableCallback } from './useStableCallback'
 
 interface Props {
   enableMultiCamSupport: boolean
+  onError: (error: Error) => void
 }
 
 export function useCameraSession({
   enableMultiCamSupport,
+  onError,
 }: Props): CameraSession | undefined {
   const [session, setSession] = useState<CameraSession>()
+  const stableOnError = useStableCallback(onError)
 
   // session creation
   useEffect(() => {
     let isCanceled = false
     const load = async () => {
-      const s = await VisionCamera.createCameraSession(enableMultiCamSupport)
-      if (isCanceled) {
-        s.dispose()
-        return
+      try {
+        const s = await VisionCamera.createCameraSession(enableMultiCamSupport)
+        if (isCanceled) {
+          s.dispose()
+          return
+        }
+        setSession(s)
+      } catch (error) {
+        stableOnError(error as Error)
       }
-      setSession(s)
     }
     load()
     return () => {
       isCanceled = true
     }
-  }, [enableMultiCamSupport])
+  }, [enableMultiCamSupport, stableOnError])
 
   // session teardown
   useEffect(() => {
```

**File**: `packages/react-native-vision-camera/src/hooks/internal/useCameraSessionIsRunning.ts` (modified, +13/-5)
```diff
@@ -1,19 +1,27 @@
 import { useEffect } from 'react'
 import type { CameraSession } from '../../specs/session/CameraSession.nitro'
+import { useStableCallback } from './useStableCallback'
 
 export function useCameraSessionIsRunning(
   session: CameraSession | undefined,
   isActive: boolean,
+  onError: (error: Error) => void,
 ): void {
+  const stableOnError = useStableCallback(onError)
+
   useEffect(() => {
     if (session == null) return
     const load = async () => {
-      if (isActive) {
-        await session.start()
-      } else {
-        await session.stop()
+      try {
+        if (isActive) {
+          await session.start()
+        } else {
+          await session.stop()
+        }
+      } catch (error) {
+        stableOnError(error as Error)
       }
     }
     load()
-  }, [isActive, session])
+  }, [isActive, session, stableOnError])
 }
```

**File**: `packages/react-native-vision-camera/src/hooks/useCamera.ts` (modified, +15/-7)
```diff
@@ -261,7 +261,10 @@ export function useCamera({
   torchMode,
 }: CameraProps): CameraController | undefined {
   // 1. Create session
-  const session = useCameraSession({ enableMultiCamSupport: false })
+  const session = useCameraSession({
+    enableMultiCamSupport: false,
+    onError: onError,
+  })
 
   // 2. Update output orientations
   const orientationSourceOrUndefined =
@@ -305,18 +308,23 @@ export function useCamera({
     onSessionConfigSelected: onSessionConfigSelected,
     allowBackgroundAudioPlayback: allowBackgroundAudioPlayback,
     allowHapticsAndSystemSoundsPlayback: allowHapticsAndSystemSoundsPlayback,
+    onError: onError,
   })
 
   // 5. Configure the Controller with some settings
-  useCameraControllerConfiguration(controller, {
-    enableSmoothAutoFocus: enableSmoothAutoFocus,
-    enableDistortionCorrection: enableDistortionCorrection,
-    enableLowLightBoost: enableLowLightBoost,
-  })
+  useCameraControllerConfiguration(
+    controller,
+    {
+      enableSmoothAutoFocus: enableSmoothAutoFocus,
+      enableDistortionCorrection: enableDistortionCorrection,
+      enableLowLightBoost: enableLowLightBoost,
+    },
+    onError,
+  )
 
   // 6. Start (or stop) the Session if we have a Controller and `isActive` is true.
   const hasController = controller != null
-  useCameraSessionIsRunning(session, isActive && hasController)
+  useCameraSessionIsRunning(session, isActive && hasController, onError)
 
   // 7. Set up listeners and delegate to JS
   useListenerSubscription(session, 'addOnStartedListener', onStarted)
```

#### Recent Merged Pull Requests:
- **PR #4176** (2026-08-29): chore: Update links for the move to the margelo org (@mrousavy)
- **PR #4175** (closed): fix: align iOS frame coordinates with camera sensor (@huytdps13400)
- **PR #4173** (closed): feat: Add native tap-to-focus reset listener (@mrousavy)
- **PR #4172** (2026-08-26): feat: Add native tap-to-focus lifecycle listeners (@mrousavy)
- **PR #4171** (2026-08-26): feat: Add native zoom gesture change listener (@mrousavy)
- **PR #4170** (2026-08-23): feat: expose metadata from capturePhotoToFile (@mrousavy)
- **PR #4167** (2026-08-21): fix: Deep-compare `constraints` instead of `JSON.stringify`-ing them (@mrousavy)
- **PR #4166** (2026-08-21): fix: Memoize `targetResolution` in output hooks (@mrousavy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
