# Forensic Learning Record (Deep Inspection): wcandillon/react-native-skia

> **Canonical Artifact**: `07_PROJECT_LEARNING/wcandillon-react-native-skia-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wcandillon/react-native-skia](https://github.com/wcandillon/react-native-skia))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:36:08.068Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wcandillon/react-native-skia`
- **Description**: High-performance React Native Graphics using Skia
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8663 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/example/src/Examples/API/WebGLLifecycle.tsx`
```
import React, {
  Component,
  StrictMode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  Button,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Canvas, Circle, Fill } from "react-native-skia";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// Exercises the lifetime of the WebGL context behind a <Canvas> on web.
// The context belongs to the <canvas> element while the renderer belongs to
// a layout effect, and the two don't line up:
// - StrictMode (DEV) re-runs the layout effect on the same element (#3976):
//   losing the context on cleanup left the canvas blank for good and made
//   CanvasKit fault inside wasm on the next construction.
// - A canvas that really unmounts must lose its context right away, since a
//   detached canvas keeps it alive until garbage collection and browsers cap
//   the number of live contexts (16 in Chrome, which then evicts the oldest,
//   visible or not) (#3349).
// - A context the browser evicted has to be picked up again once restored.
// - Switching between the live and the static renderer needs a fresh
//   element, as an element is bound to one context kind for life.
// Every action below reports on the status line; on native they are no-ops.

const SIZE = 200;
const CHURN_CYCLES = 20;

const isWeb = Platform.OS === "web" && typeof document !== "undefined";

const referenceCanvas = () =>
  isWeb
    ? document.querySelector<HTMLCanvasElement>(
        '[data-testid="reference"] canvas'
      )
    : null;

const Spinner = () => {
  const clock = useSharedValue(0);
  useEffect(() => {
    clock.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1
    );
  }, [clock]);
  const cx = useDerivedValue(
    () => SIZE / 2 + (SIZE / 3) * Math.cos(clock.value * Math.PI * 2)
  );
  const cy = useDerivedValue(
    () => SIZE / 2 + (SIZE / 3) * Math.sin(clock.value * Math.PI * 2)
  );
  return (
    <>
      <Fill color="#1c2541" />
      <Circle cx={cx} cy={cy} r={SIZE / 10} color="#5bc0be" />
    </>
  );
};

interface BoundaryProps {
  children: ReactNode;
  onError: (message: string) => void;
}

// Renderer failures throw from the layout effect that builds it, which would
// otherwise take the whole app down.
class Boundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export const WebGLLifecycle = () => {
  const [strict, setStrict] = useState(false);
  const [isStatic, setIsStatic] = useState(false);
  const [churnMounted, setChurnMounted] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [contextState, setContextState] = useState("unknown");
  const [error, setError] = useState<string | null>(null);
  const loseContextRef = useRef<{
    loseContext(): void;
    restoreContext(): void;
  } | null>(null);

  // Poll the reference canvas: a lost context is what an evicted or
  // unrestored canvas looks like from the outside.
  useEffect(() => {
    if (!isWeb) {
      return undefined;
    }
    const tick = () => {
      const canvas = referenceCanvas();
      if (!canvas) {
        setContextState("no canvas");
        return;
      }
      if (isStatic) {
        setContextState("static");
        return;
      }
      const gl = canvas.getContext("webgl2");
      if (!gl) {
        setContextState("none");
      } else {
        setContextState(gl.isContextLost() ? "LOST" : "ok");
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [isStatic, strict]);

  const remount = () => {
    setError(null);
    setCycle(0);
    let i = 0;
    const step = () => {
      setChurnMounted(true);
      setTimeout(() => {
        setChurnMounted(false);
        i++;
        setCycle(i);
        if (i < CHURN_CYCLES) {
          setTimeout(step, 50);
        }
      }, 50);
    };
    step();
  };

  const lose = () => {
    const gl = referenceCanvas()?.getContext("webgl2");
    // The extension object has to be obtained while the context is healthy:
    // getExtension() returns null on a lost context.
    loseContextRef.current = gl?.getExtension("WEBGL_lose_context") ?? null;
    loseContextRef.current?.loseContext();
  };

  const restore = () => {
    loseContextRef.current?.restoreContext();
  };

  const reference = (
    <Boundary onError={setError}>
      <Canvas style={styles.canvas} __destroyWebGLContextAfterRender={isStatic}>
        <Spinner />
      </Canvas>
    </Boundary>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>WebGL context lifecycle</Text>
      <Text style={styles.description}>
        The reference canvas below must keep spinning through every action. Web
        only.
      </Text>
      <Text style={styles.status} testID="status">
        {`cycles ${cycle}/${CHURN_CYCLES} · reference: ${contextState}` +
          ` · strict: ${strict ? "on" : "off"}` +
          ` · renderer: ${isStatic ? "static" : "live"}` +
          (error ? ` · error: ${error}` : "")}
      </Text>
      <View style={styles.row}>
        <View testID="reference">
          {strict ? (
            <StrictMode key="strict">{reference}</StrictMode>
          ) : (
            reference
          )}
        </View>
        <View testID="churn" style={styles.canvas}>
          {churnMounted && (
            <Boundary onError={setError}>
              <Canvas style={styles.canvas}>
                <Fill color={`hsl(${(cycle * 47) % 360}, 70%, 50%)`} />
              </Canvas>
            </Boundary>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          testID="remount"
          title={`Mount & unmount a canvas ${CHURN_CYCLES}×`}
          onPress={remount}
        />
        <Button
          testID="strict"
          title={strict ? "StrictMode: on" : "StrictMode: off"}
          onPress={() => setStrict((s) => !s)}
        />
        <Button testID="lose" title="Lose context" onPress={lose} />
        <Button testID="restore" title="Restore context" onPress={restore} />
        <Button
          testID="renderer"
          title={isStatic ? "Renderer: static" : "Renderer: live"}
          onPress={() => setIsStatic((s) => !s)}
        />
      </View>
      <Text style={styles.description}>
        Mount & unmount: more cycles than the browser's context limit; the
        reference canvas must not be evicted (Chrome logs "Too many active WebGL
        contexts" when it is). StrictMode: re-runs the renderer on the same
        element; the canvas must keep painting. Lose then restore: the canvas
        goes blank, then resumes. Renderer: switches between the live and the
        static renderer; both must paint.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  header: {
    fontSize: 18,
    fontWeight: "bold",
  },
  description: {
    fontSize: 13,
    color: "#666",
  },
  status: {
    fontSize: 13,
    fontFamily: Platform.select({ web: "monospace", default: undefined }),
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  actions: {
    gap: 8,
    alignItems: "flex-start",
  },
  canvas: {
    width: SIZE,
    height: SIZE,
  },
});

```

### Core Architecture Module: `apps/example/src/Examples/WebGPU/components/makeWebGPURenderer.ts`
```
import * as THREE from "three";

export interface WebGPURendererOptions {
  context: GPUCanvasContext;
  // When given, three renders on this device instead of requesting its own
  // (required when the context's texture lives on a shared device).
  device?: GPUDevice;
  antialias?: boolean;
  requiredLimits?: Record<string, number>;
}

export const makeWebGPURenderer = ({
  context,
  device,
  antialias = true,
  requiredLimits,
}: WebGPURendererOptions) =>
  new THREE.WebGPURenderer({
    antialias,
    canvas: context.canvas,
    context,
    device,
    requiredLimits,
  });

// Tears a renderer down so the GC can reclaim it and its GPU resources
// (https://github.com/wcandillon/react-native-webgpu/issues/445):
// - renderer.dispose() stops three's internal requestAnimationFrame loop.
//   setAnimationLoop(null) alone leaves that loop running, and its callback
//   roots the entire renderer graph forever.
// - three's RenderObjects.dispose() drops its chainMaps without disposing the
//   individual RenderObjects, so their 'dispose'/'release' listeners survive
//   on the module-level shared QuadMesh geometry singleton and root the
//   disposed renderer's backend. Clearing the stale listeners is safe while
//   the app has at most one live renderer (upstream fix pending).
export const disposeWebGPURenderer = (renderer: THREE.WebGPURenderer) => {
  renderer.setAnimationLoop(null);
  renderer.dispose();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quad = new (THREE as any).QuadMesh();
  const targets = [
    quad.geometry,
    quad.geometry.index,
    ...Object.values(quad.geometry.attributes),
  ];
  for (const target of targets) {
    if (target && target._listeners) {
      target._listeners = {};
    }
  }
};

```

### Core Architecture Module: `packages/skia/android/cpp/rnskia-android/AHardwareBufferUtils.cpp`
```
#if __ANDROID_API__ >= 26

#include "AHardwareBufferUtils.h"
#include <android/hardware_buffer.h>

namespace RNSkia {

uint32_t GetBufferFormatFromSkColorType(SkColorType bufferFormat) {
  switch (bufferFormat) {
  case kRGBA_8888_SkColorType:
    return AHARDWAREBUFFER_FORMAT_R8G8B8A8_UNORM;
  case kRGB_888x_SkColorType:
    return AHARDWAREBUFFER_FORMAT_R8G8B8X8_UNORM;
  case kRGBA_F16_SkColorType:
    return AHARDWAREBUFFER_FORMAT_R16G16B16A16_FLOAT;
  case kRGB_565_SkColorType:
    return AHARDWAREBUFFER_FORMAT_R5G6B5_UNORM;
  case kRGBA_1010102_SkColorType:
    return AHARDWAREBUFFER_FORMAT_R10G10B10A2_UNORM;
#if __ANDROID_API__ >= 33
  case kAlpha_8_SkColorType:
    return AHARDWAREBUFFER_FORMAT_R8_UNORM;
#endif
  default:
    return AHARDWAREBUFFER_FORMAT_R8G8B8A8_UNORM;
  }
}

} // namespace RNSkia

#endif
```

### Core Architecture Module: `packages/skia/android/cpp/rnskia-android/AHardwareBufferUtils.h`
```
#pragma once

#include "include/core/SkColorType.h"

#if __ANDROID_API__ >= 26

namespace RNSkia {

uint32_t GetBufferFormatFromSkColorType(SkColorType bufferFormat);

} // namespace RNSkia

#endif
```

### Core Architecture Module: `packages/skia/apple/MetalLayerColorSpaceUtils.h`
```
#pragma once

#import <CoreGraphics/CoreGraphics.h>
#import <QuartzCore/CAMetalLayer.h>

namespace RNSkia {

// The surface writes sRGB-encoded (SDR) values regardless of the texture
// format. With an 8-bit format a nil colorspace displays them as-is, but Core
// Animation interprets a float-format layer with a nil colorspace as extended
// linear sRGB, which displays the same values noticeably brighter. Tag the
// float layer with the matching gamma-encoded (extended) colorspace so colors
// are identical to the 8-bit path, only with more precision.
inline void setCAMetalLayerColorSpace(CAMetalLayer *layer, bool isFloatFormat,
                                      bool useP3ColorSpace) {
  if (isFloatFormat) {
    CGColorSpaceRef colorSpace = CGColorSpaceCreateWithName(
        useP3ColorSpace ? kCGColorSpaceExtendedDisplayP3
                        : kCGColorSpaceExtendedSRGB);
    layer.colorspace = colorSpace;
    CGColorSpaceRelease(colorSpace);
  } else if (useP3ColorSpace) {
    CGColorSpaceRef colorSpace =
        CGColorSpaceCreateWithName(kCGColorSpaceDisplayP3);
    layer.colorspace = colorSpace;
    CGColorSpaceRelease(colorSpace);
  } else if (layer.colorspace != nil) {
    // Restore the default (no color matching) when reconfiguring a layer
    // back to an 8-bit format.
    layer.colorspace = nil;
  }
}

} // namespace RNSkia

```

### Core Architecture Module: `packages/skia/cpp/api/third_party/SkottieUtils.cpp`
```
/*
 * Copyright 2018 Google Inc.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

#include "SkottieUtils.h"

#include "include/core/SkData.h"
#include "include/core/SkRect.h"
#include "include/core/SkSize.h"
#include "include/private/SkAssert.h"
#include "modules/skottie/include/Skottie.h"
#include "modules/skresources/include/SkResources.h"

#include <cstring>
#include <utility>

class SkCanvas;

namespace RNSkia {

class CustomPropertyManager::PropertyInterceptor final
    : public skottie::PropertyObserver {
public:
  explicit PropertyInterceptor(CustomPropertyManager *mgr) : fMgr(mgr) {}

  void
  onColorProperty(const char node_name[],
                  const LazyHandle<skottie::ColorPropertyHandle> &c) override {
    const auto key = fMgr->acceptKey(node_name, ".Color");
    if (!key.empty()) {
      fMgr->fColorMap[key].push_back(c());
    }
  }

  void onOpacityProperty(
      const char node_name[],
      const LazyHandle<skottie::OpacityPropertyHandle> &o) override {
    const auto key = fMgr->acceptKey(node_name, ".Opacity");
    if (!key.empty()) {
      fMgr->fOpacityMap[key].push_back(o());
    }
  }

  void onTransformProperty(
      const char node_name[],
      const LazyHandle<skottie::TransformPropertyHandle> &t) override {
    const auto key = fMgr->acceptKey(node_name, ".Transform");
    if (!key.empty()) {
      fMgr->fTransformMap[key].push_back(t());
    }
  }

  void
  onTextProperty(const char node_name[],
                 const LazyHandle<skottie::TextPropertyHandle> &t) override {
    const auto key = fMgr->acceptKey(node_name, ".Text");
    if (!key.empty()) {
      fMgr->fTextMap[key].push_back(t());
    }
  }

  void onEnterNode(const char node_name[],
                   PropertyObserver::NodeType node_type) override {
    if (node_name == nullptr) {
      return;
    }
    fMgr->fCurrentNode = fMgr->fCurrentNode.empty()
                             ? node_name
                             : fMgr->fCurrentNode + "." + node_name;
  }

  void onLeavingNode(const char node_name[],
                     PropertyObserver::NodeType node_type) override {
    if (node_name == nullptr) {
      return;
    }
    auto length = strlen(node_name);
    fMgr->fCurrentNode =
        fMgr->fCurrentNode.length() > length
            ? fMgr->fCurrentNode.substr(0, fMgr->fCurrentNode.length() -
                                               strlen(node_name) - 1)
            : "";
  }

private:
  CustomPropertyManager *fMgr;
};

class CustomPropertyManager::MarkerInterceptor final
    : public skottie::MarkerObserver {
public:
  explicit MarkerInterceptor(CustomPropertyManager *mgr) : fMgr(mgr) {}

  void onMarker(const char name[], float t0, float t1) override {
    // collect all markers
    fMgr->fMarkers.push_back({std::string(name), t0, t1});
  }

private:
  CustomPropertyManager *fMgr;
};

CustomPropertyManager::CustomPropertyManager(Mode mode, const char *prefix)
    : fMode(mode), fPrefix(prefix ? prefix : "$"),
      fPropertyInterceptor(sk_make_sp<PropertyInterceptor>(this)),
      fMarkerInterceptor(sk_make_sp<MarkerInterceptor>(this)) {
  // there is a bug in the ref counting here
  fPropertyInterceptor->ref();
  fMarkerInterceptor->ref();
}

CustomPropertyManager::~CustomPropertyManager() {
  // there is a bug in the ref counting here
  // ref count 0 but the raw pointer still exists
  auto rawptr1 = fPropertyInterceptor.get();
  fPropertyInterceptor = nullptr;
  delete rawptr1;

  auto rawptr2 = fMarkerInterceptor.get();
  fMarkerInterceptor = nullptr;
  delete rawptr2;
}

std::string CustomPropertyManager::acceptKey(const char *name,
                                             const char *suffix) const {
  if (!SkStrStartsWith(name, fPrefix.c_str())) {
    return std::string();
  }

  return fMode == Mode::kCollapseProperties ? std::string(name)
                                            : fCurrentNode + suffix;
}

sk_sp<skottie::PropertyObserver>
CustomPropertyManager::getPropertyObserver() const {
  return fPropertyInterceptor;
}

sk_sp<skottie::MarkerObserver>
CustomPropertyManager::getMarkerObserver() const {
  return fMarkerInterceptor;
}

template <typename T>
std::vector<CustomPropertyManager::PropKey>
CustomPropertyManager::getProps(const PropMap<T> &container) const {
  std::vector<PropKey> props;

  for (const auto &prop_list : container) {
    SkASSERT(!prop_list.second.empty());
    props.push_back(prop_list.first);
  }

  return props;
}

template <typename V, typename T>
V CustomPropertyManager::get(const PropKey &key,
                             const PropMap<T> &container) const {
  auto prop_group = container.find(key);

  return prop_group == container.end() ? V()
                                       : prop_group->second.front()->get();
}

template <typename T>
std::unique_ptr<T>
CustomPropertyManager::getHandle(const PropKey &key, size_t index,
                                 const PropMap<T> &container) const {
  auto prop_group = container.find(key);

  if (prop_group == container.end() || index >= prop_group->second.size()) {
    return nullptr;
  }

  return std::make_unique<T>(*prop_group->second[index]);
}

template <typename V, typename T>
bool CustomPropertyManager::set(const PropKey &key, const V &val,
                                const PropMap<T> &container) {
  auto prop_group = container.find(key);

  if (prop_group == container.end()) {
    return false;
  }

  for (auto &handle : prop_group->second) {
    handle->set(val);
  }

  return true;
}

std::vector<CustomPropertyManager::PropKey>
CustomPropertyManager::getColorProps() const {
  return this->getProps(fColorMap);
}

skottie::ColorPropertyValue
CustomPropertyManager::getColor(const PropKey &key) const {
  return this->get<skottie::ColorPropertyValue>(key, fColorMap);
}

std::unique_ptr<skottie::ColorPropertyHandle>
CustomPropertyManager::getColorHandle(const PropKey &key, size_t index) const {
  return this->getHandle(key, index, fColorMap);
}

bool CustomPropertyManager::setColor(const PropKey &key,
                                     const skottie::ColorPropertyValue &c) {
  return this->set(key, c, fColorMap);
}

std::vector<CustomPropertyManager::PropKey>
CustomPropertyManager::getOpacityProps() const {
  return this->getProps(fOpacityMap);
}

skottie::OpacityPropertyValue
CustomPropertyManager::getOpacity(const PropKey &key) const {
  return this->get<skottie::OpacityPropertyValue>(key, fOpacityMap);
}

std::unique_ptr<skottie::OpacityPropertyHandle>
CustomPropertyManager::getOpacityHandle(const PropKey &key,
                                        size_t index) const {
  return this->getHandle(key, index, fOpacityMap);
}

bool CustomPropertyManager::setOpacity(const PropKey &key,
                                       const skottie::OpacityPropertyValue &o) {
  return this->set(key, o, fOpacityMap);
}

std::vector<CustomPropertyManager::PropKey>
CustomPropertyManager::getTransformProps() const {
  return this->getProps(fTransformMap);
}

skottie::TransformPropertyValue
CustomPropertyManager::getTransform(const PropKey &key) const {
  return this->get<skottie::TransformPropertyValue>(key, fTransformMap);
}

std::unique_ptr<skottie::TransformPropertyHandle>
CustomPropertyManager::getTransformHandle(const PropKey &key,
                                          size_t index) const {
  return this->getHandle(key, index, fTransformMap);
}

bool CustomPropertyManager::setTransform(
    const PropKey &key, const skottie::TransformPropertyValue &t) {
  return this->set(key, t, fTransformMap);
}

std::vector<CustomPropertyManager::PropKey>
CustomPropertyManager::getTextProps() const {
  return this->getProps(fTextMap);
}

skottie::TextPropertyValue
CustomPropertyManager::getText(const PropKey &key) const {
  return this->get<skottie::TextPropertyValue>(key, fTextMap);
}

std::unique_ptr<skottie::TextPropertyHandle>
CustomPropertyManager::getTextHandle(const PropKey &key, size_t index) const {
  return this->getHandle(key, index, fTextMap);
}

bool CustomPropertyManager::setText(const PropKey &key,
                                    const skottie::TextPropertyValue &o) {
  return this->set(key, o, fTextMap);
}

namespace {

class ExternalAnimationLayer final : public skottie::ExternalLayer {
public:
  ExternalAnimationLayer(sk_sp<skottie::Animation> anim, const SkSize &size)
      : fAnimation(std::move(anim)), fSize(size) {}

private:
  void render(SkCanvas *canvas, double t) override {
    fAnimation->seekFrameTime(t);

    // The main animation will layer-isolate if needed - we don't want the
    // nested animation to override that decision.
    const auto flags = skottie::Animation::RenderFlag::kSkipTopLevelIsolation;
    const auto dst_rect = SkRect::MakeSize(fSize);
    fAnimation->render(canvas, &dst_rect, flags);
  }

  const sk_sp<skottie::Animation> fAnimation;
  const SkSize fSize;
};

} // namespace

ExternalAnimationPrecompInterceptor::ExternalAnimationPrecompInterceptor(
    sk_sp<skresources::ResourceProvider> rprovider, const char prefixp[])
    : fResourceProvider(std::move(rprovider)), fPrefix(prefixp) {}

ExternalAnimationPrecompInterceptor::~ExternalAnimationPrecompInterceptor() =
    default;

sk_sp<skottie::ExternalLayer>
ExternalAnimationPrecompInterceptor::onLoadPrecomp(const char[],
                                                   const char name[],
                                                   const SkSize &size) {
  if (0 != strncmp(name, fPrefix.c_str(), fPrefix.size())) {
    return nullptr;
  }

  auto data = fResourceProvider->load("", name + fPrefix.size());
  if (!data) {
    return nullptr;
  }

  auto anim = skottie::Animation::Builder()
                  .setPrecompInterceptor(sk_ref_sp(this))
                  .setResourceProvider(fResourceProvider)
                  .make(static_cast<const char *>(data->data()), data->size());

  return anim ? sk_make_sp<ExternalAnimationLayer>(std::
```

### Core Architecture Module: `packages/skia/cpp/api/third_party/SkottieUtils.h`
```
/*
 * Copyright 2018 Google Inc.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

#pragma once

#include "include/core/SkRefCnt.h"
#include "include/core/SkString.h"
#include "modules/skottie/include/ExternalLayer.h"
#include "modules/skottie/include/SkottieProperty.h"

#include <cstddef>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

struct SkSize;

namespace skottie {
class MarkerObserver;

inline void
PropertyObserver::onColorProperty(const char node_name[],
                                  const LazyHandle<ColorPropertyHandle> &) {}

inline void PropertyObserver::onOpacityProperty(
    const char node_name[], const LazyHandle<OpacityPropertyHandle> &) {}
inline void
PropertyObserver::onTextProperty(const char node_name[],
                                 const LazyHandle<TextPropertyHandle> &) {}
inline void PropertyObserver::onTransformProperty(
    const char node_name[], const LazyHandle<TransformPropertyHandle> &) {}
inline void PropertyObserver::onEnterNode(const char node_name[],
                                          NodeType node_type) {}
inline void PropertyObserver::onLeavingNode(const char node_name[],
                                            NodeType node_type) {}

} // namespace skottie

namespace skresources {
class ResourceProvider;
}

namespace RNSkia {

/**
 * CustomPropertyManager implements a property management scheme where
 * color/opacity/transform attributes are grouped and manipulated by name
 * (one-to-many mapping).
 *
 *   - setters apply the value to all properties in a named group
 *
 *   - getters return all the managed property groups, and the first value
 * within each of them (unchecked assumption: all properties within the same
 * group have the same value)
 *
 * Attach to an Animation::Builder using the utility methods below to intercept
 * properties and markers at build time.
 */
class CustomPropertyManager final {
public:
  enum class Mode {
    kCollapseProperties,   // keys ignore the ancestor chain and are
                           // grouped based on the local node name
    kNamespacedProperties, // keys include the ancestor node names (no grouping)
  };

  explicit CustomPropertyManager(Mode = Mode::kNamespacedProperties,
                                 const char *prefix = nullptr);
  ~CustomPropertyManager();

  using PropKey = std::string;

  std::vector<PropKey> getColorProps() const;
  skottie::ColorPropertyValue getColor(const PropKey &) const;
  std::unique_ptr<skottie::ColorPropertyHandle> getColorHandle(const PropKey &,
                                                               size_t) const;
  bool setColor(const PropKey &, const skottie::ColorPropertyValue &);

  std::vector<PropKey> getOpacityProps() const;
  skottie::OpacityPropertyValue getOpacity(const PropKey &) const;
  std::unique_ptr<skottie::OpacityPropertyHandle>
  getOpacityHandle(const PropKey &, size_t) const;
  bool setOpacity(const PropKey &, const skottie::OpacityPropertyValue &);

  std::vector<PropKey> getTransformProps() const;
  skottie::TransformPropertyValue getTransform(const PropKey &) const;
  std::unique_ptr<skottie::TransformPropertyHandle>
  getTransformHandle(const PropKey &, size_t) const;
  bool setTransform(const PropKey &, const skottie::TransformPropertyValue &);

  std::vector<PropKey> getTextProps() const;
  skottie::TextPropertyValue getText(const PropKey &) const;
  std::unique_ptr<skottie::TextPropertyHandle>
  getTextHandle(const PropKey &, size_t index) const;
  bool setText(const PropKey &, const skottie::TextPropertyValue &);

  struct MarkerInfo {
    std::string name;
    float t0, t1;
  };
  const std::vector<MarkerInfo> &markers() const { return fMarkers; }

  // Returns a property observer to be attached to an animation builder.
  sk_sp<skottie::PropertyObserver> getPropertyObserver() const;

  // Returns a marker observer to be attached to an animation builder.
  sk_sp<skottie::MarkerObserver> getMarkerObserver() const;

private:
  class PropertyInterceptor;
  class MarkerInterceptor;

  std::string acceptKey(const char *, const char *) const;

  template <typename T> using PropGroup = std::vector<std::unique_ptr<T>>;

  template <typename T>
  using PropMap = std::unordered_map<PropKey, PropGroup<T>>;

  template <typename T>
  std::vector<PropKey> getProps(const PropMap<T> &container) const;

  template <typename V, typename T>
  V get(const PropKey &, const PropMap<T> &container) const;

  template <typename T>
  std::unique_ptr<T> getHandle(const PropKey &, size_t,
                               const PropMap<T> &container) const;

  template <typename V, typename T>
  bool set(const PropKey &, const V &, const PropMap<T> &container);

  const Mode fMode;
  const SkString fPrefix;

  sk_sp<PropertyInterceptor> fPropertyInterceptor;
  sk_sp<MarkerInterceptor> fMarkerInterceptor;

  PropMap<skottie::ColorPropertyHandle> fColorMap;
  PropMap<skottie::OpacityPropertyHandle> fOpacityMap;
  PropMap<skottie::TransformPropertyHandle> fTransformMap;
  PropMap<skottie::TextPropertyHandle> fTextMap;
  std::vector<MarkerInfo> fMarkers;
  std::string fCurrentNode;
};

/**
 * A sample PrecompInterceptor implementation.
 *
 * Attempts to substitute all precomp layers matching the given pattern (name
 * prefix) with external Lottie animations.
 */
class ExternalAnimationPrecompInterceptor final
    : public skottie::PrecompInterceptor {
public:
  ExternalAnimationPrecompInterceptor(sk_sp<skresources::ResourceProvider>,
                                      const char prefix[]);
  ~ExternalAnimationPrecompInterceptor() override;

private:
  sk_sp<skottie::ExternalLayer> onLoadPrecomp(const char[], const char[],
                                              const SkSize &) override;

  const sk_sp<skresources::ResourceProvider> fResourceProvider;
  const SkString fPrefix;
};

} // namespace RNSkia

```

### Core Architecture Module: `packages/skia/cpp/rnskia/RNDawnUtils.h`
```
#pragma once

#if defined(__APPLE__)
#include <TargetConditionals.h>
#endif

#include "webgpu/webgpu_cpp.h"

#include "dawn/native/DawnNative.h"

#include "include/core/SkColorSpace.h"
#include "include/core/SkColorType.h"
#include "include/gpu/graphite/dawn/DawnBackendContext.h"
#include "utils/RNSkLog.h"

namespace DawnUtils {

#ifdef __APPLE__
static const SkColorType PreferedColorType = kBGRA_8888_SkColorType;
static const wgpu::TextureFormat PreferredTextureFormat =
    wgpu::TextureFormat::BGRA8Unorm;
#else
static const SkColorType PreferedColorType = kRGBA_8888_SkColorType;
static const wgpu::TextureFormat PreferredTextureFormat =
    wgpu::TextureFormat::RGBA8Unorm;
#endif

// On-screen format used when the view requests high bit depth. The values
// stay sRGB-encoded (SDR), only with more precision than 8 bits per channel;
// this is about banding, not HDR.
// - Apple: 16-bit float, displayed through the extended sRGB layer colorspace
//   so colors match the 8-bit path exactly.
// - Android: 10-bit unorm. SurfaceFlinger quantizes SDR float16 layers during
//   composition, but RGBA_1010102 buffers keep their precision through
//   composition, including direct scanout on 10-bit panels.
#ifdef __APPLE__
static const SkColorType HighBitDepthColorType = kRGBA_F16_SkColorType;
static const wgpu::TextureFormat HighBitDepthTextureFormat =
    wgpu::TextureFormat::RGBA16Float;
#else
static const SkColorType HighBitDepthColorType = kRGBA_1010102_SkColorType;
static const wgpu::TextureFormat HighBitDepthTextureFormat =
    wgpu::TextureFormat::RGB10A2Unorm;
#endif

// The color space a view renders in: Display P3 (with the sRGB transfer
// function) where the platform prefers it (a wide gamut display on Apple
// platforms, see RNSkPlatformContext::prefersP3ColorSpace), sRGB otherwise.
// Colors are managed either way: content looks the same in both, Display P3
// only adds the colors sRGB cannot represent.
inline sk_sp<SkColorSpace> viewColorSpace(bool useP3ColorSpace) {
  return useP3ColorSpace ? SkColorSpace::MakeRGB(SkNamedTransferFn::kSRGB,
                                                 SkNamedGamut::kDisplayP3)
                         : SkColorSpace::MakeSRGB();
}

// Usage requested for a window texture when the surface supports it (see
// DawnWindowContext::supportedSurfaceUsage), and assumed for a Graphite
// recording made before its window exists: TextureBinding lets a render pass
// reload the existing contents, CopySrc serves copy tasks.
static const wgpu::TextureUsage DefaultTargetUsage =
    wgpu::TextureUsage::RenderAttachment | wgpu::TextureUsage::TextureBinding |
    wgpu::TextureUsage::CopySrc;

// The texture format backing a surface of the given color type; the
// preferred format for color types no surface uses.
inline wgpu::TextureFormat textureFormatForColorType(SkColorType colorType) {
  switch (colorType) {
  case kBGRA_8888_SkColorType:
    return wgpu::TextureFormat::BGRA8Unorm;
  case kRGBA_8888_SkColorType:
    return wgpu::TextureFormat::RGBA8Unorm;
  case kRGBA_F16_SkColorType:
    return wgpu::TextureFormat::RGBA16Float;
  case kRGBA_1010102_SkColorType:
    return wgpu::TextureFormat::RGB10A2Unorm;
  default:
    return PreferredTextureFormat;
  }
}

// Find the best matching GPU adapter for the current platform.
// Sorts by adapter type (DiscreteGPU > IntegratedGPU > CPU) and selects the
// first adapter matching the platform backend (Metal on Apple, Vulkan on
// Android).
inline dawn::native::Adapter
getMatchedAdapter(dawn::native::Instance *instance) {
#ifdef __APPLE__
  constexpr auto kDefaultBackendType = wgpu::BackendType::Metal;
#elif __ANDROID__
  constexpr auto kDefaultBackendType = wgpu::BackendType::Vulkan;
#endif

  wgpu::RequestAdapterOptions options;
  options.backendType = kDefaultBackendType;
  options.featureLevel = wgpu::FeatureLevel::Core;

  std::vector<dawn::native::Adapter> adapters =
      instance->EnumerateAdapters(&options);
  if (adapters.empty()) {
    throw std::runtime_error("No matching adapter found");
  }

  std::sort(adapters.begin(), adapters.end(),
            [](dawn::native::Adapter a, dawn::native::Adapter b) {
              wgpu::Adapter wgpuA = a.Get();
              wgpu::Adapter wgpuB = b.Get();
              wgpu::AdapterInfo infoA;
              wgpu::AdapterInfo infoB;
              wgpuA.GetInfo(&infoA);
              wgpuB.GetInfo(&infoB);
              return std::tuple(infoA.adapterType, infoA.backendType) <
                     std::tuple(infoB.adapterType, infoB.backendType);
            });

  for (const auto &adapter : adapters) {
    wgpu::Adapter wgpuAdapter = adapter.Get();
    wgpu::AdapterInfo props;
    wgpuAdapter.GetInfo(&props);
    if (kDefaultBackendType == props.backendType) {
      return adapter;
    }
  }

  throw std::runtime_error("No matching adapter found");
}

// Create a Dawn device from the given adapter with the requested features.
// Features not supported by the adapter are silently skipped.
// Set fatalOnDeviceLost=true for primary rendering devices (SK_ABORT on loss),
// false for secondary/compute devices (log only).
inline wgpu::Device
requestDevice(dawn::native::Adapter &nativeAdapter,
              const std::vector<wgpu::FeatureName> &requestedFeatures,
              bool fatalOnDeviceLost = true) {
  wgpu::Adapter adapter = nativeAdapter.Get();

  // Filter to only features the adapter supports
  std::vector<wgpu::FeatureName> features;
  for (auto feature : requestedFeatures) {
    if (adapter.HasFeature(feature)) {
      features.push_back(feature);
    }
  }

  static constexpr const char *kToggles[] = {
#if !defined(SK_DEBUG)
      "skip_validation",
#endif
      "disable_lazy_clear_for_mapped_at_creation_buffer",
      "allow_unsafe_apis",
      "disable_robustness",
  };
  wgpu::DawnTogglesDescriptor togglesDesc;
  togglesDesc.enabledToggleCount = std::size(kToggles);
  togglesDesc.enabledToggles = kToggles;
#if defined(TARGET_OS_SIMULATOR) && TARGET_OS_SIMULATOR
  // The iOS Simulator only advertises MTLFeatureSet_iOS_GPUFamily2, so Dawn
  // defaults disable_base_instance/disable_base_vertex on and then rejects
  // every draw with a non-zero firstInstance or baseVertex, which Graphite
  // emits routinely. The simulator forwards Metal calls to the host GPU,
  // which does support base vertex/instance drawing, so force the toggles
  // off. Device builds are unaffected: Graphite-capable iPhones and iPads
  // are all GPUFamily3+. (Same override as react-native-webgpu; see
  // https://issues.chromium.org/issues/42241591.)
  static constexpr const char *kDisabledToggles[] = {"disable_base_instance",
                                                     "disable_base_vertex"};
  togglesDesc.disabledToggleCount = std::size(kDisabledToggles);
  togglesDesc.disabledToggles = kDisabledToggles;
#endif

  wgpu::DeviceDescriptor desc;
  desc.requiredFeatureCount = features.size();
  desc.requiredFeatures = features.data();
  desc.nextInChain = &togglesDesc;

  if (fatalOnDeviceLost) {
    desc.SetDeviceLostCallback(
        wgpu::CallbackMode::AllowSpontaneous,
        [](const wgpu::Device &, wgpu::DeviceLostReason reason,
           wgpu::StringView message) {
          if (reason != wgpu::DeviceLostReason::Destroyed) {
            SK_ABORT("Device lost: %.*s\n", static_cast<int>(message.length),
                     message.data);
          }
        });
    desc.SetUncapturedErrorCallback(
        [](const wgpu::Device &, wgpu::ErrorType, wgpu::StringView message) {
          SkDebugf("Device error: %.*s\n", static_cast<int>(message.length),
                   message.data);
        });
  } else {
    desc.SetDeviceLostCallback(
        wgpu::CallbackMode::AllowSpontaneous,
        [](const wgpu::Device &, wgpu::DeviceLostReason reason,
           wgpu::StringView message) {
          if (reason != wgpu::DeviceLostReason::Destroyed) {
            RNSkia::RNSkLogger::logToConsole("Device lost: %.*s",
                                             static_cast<int>(message.length),
                                             message.data);
          }
        });
    desc.SetUncapturedErrorCallback([](const wgpu::Device &, wgpu::ErrorType,
                                       wgpu::StringView message) {
      RNSkia::RNSkLogger::logToConsole(
          "Device error: %.*s", static_cast<int>(message.length), message.data);
    });
  }

  return wgpu::Device::Acquire(nativeAdapter.CreateDevice(&desc));
}

inline skgpu::graphite::DawnBackendContext
createDawnBackendContext(dawn::native::Instance *instance) {

  auto matchedAdapter = getMatchedAdapter(instance);
  wgpu::Adapter adapter = matchedAdapter.Get();

  // Log selected adapter info
  wgpu::AdapterInfo adapterInfo;
  adapter.GetInfo(&adapterInfo);
  std::string deviceName =
      adapterInfo.device.data
          ? std::string(adapterInfo.device.data, adapterInfo.device.length)
          : "Unknown";
  std::string description = adapterInfo.description.data
                                ? std::string(adapterInfo.description.data,
                                              adapterInfo.description.length)
                                : "Unknown";

  std::string backendName;
  switch (adapterInfo.backendType) {
  case wgpu::BackendType::Metal:
    backendName = "Metal";
    break;
  case wgpu::BackendType::Vulkan:
    backendName = "Vulkan";
    break;
  case wgpu::BackendType::OpenGL:
    backendName = "OpenGL";
    break;
  case wgpu::BackendType::OpenGLES:
    backendName = "OpenGLES";
    break;
  case wgpu::BackendType::WebGPU:
    backendName = "WebGPU";
    break;
  case wgpu::BackendType::Null:
    backendName = "Null";
    break;
  default:
    backendName = "Undefined (" +
                  std::to_string(static_cast<int>(adapterInfo.backendType)) +
                  ")";
    break;
  }

  RNSkia::RNSkLogger::logToConsole(
      "Selected Dawn adapter - Backend: %s, Device: %s, Description: %s",
      backendName.c_str
```

### Core Architecture Module: `packages/skia/cpp/utils/RNSkLog.h`
```
//
// Created by Christian Falch on 26/08/2021.
//

#pragma once

#include <jsi/jsi.h>
#include <string>

#if defined(ANDROID) || defined(__ANDROID__)
#include <android/log.h>
#endif

#ifdef TARGET_OS_IPHONE
#include <syslog.h>
#endif

namespace RNSkia {

namespace jsi = facebook::jsi;

class RNSkLogger {
public:
  /**
   * Logs message to console
   * @param message Message to be written out
   */
  static void logToConsole(std::string message) {
#if defined(ANDROID) || defined(__ANDROID__)
    __android_log_write(ANDROID_LOG_INFO, "RNSkia", message.c_str());
#endif

#ifdef TARGET_OS_IPHONE
    syslog(LOG_ERR, "%s\n", message.c_str());
#endif
  }

  /**
   * Logs to console
   * @param fmt Format string
   * @param ... Arguments to format string
   */
  static void logToConsole(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);

    static char buffer[512];
    vsnprintf(buffer, sizeof(buffer), fmt, args);
#if defined(ANDROID) || defined(__ANDROID__)
    __android_log_write(ANDROID_LOG_INFO, "RNSkia", buffer);
#endif
#ifdef TARGET_OS_IPHONE
    syslog(LOG_ERR, "RNSKIA: %s\n", buffer);
#endif
    va_end(args);
  }

  static void logToJavascriptConsole(jsi::Runtime &runtime,
                                     const std::string &message) {
    auto console = RNSkLogger::getJavascriptConsole(runtime).asObject(runtime);
    auto log = console.getPropertyAsFunction(runtime, "log");
    log.call(runtime, jsi::String::createFromUtf8(runtime, message));
  }

  static void warnToJavascriptConsole(jsi::Runtime &runtime,
                                      const std::string &message) {
    auto console = RNSkLogger::getJavascriptConsole(runtime).asObject(runtime);
    auto warn = console.getPropertyAsFunction(runtime, "warn");
    warn.call(runtime, jsi::String::createFromUtf8(runtime, message));
  }

private:
  static jsi::Value getJavascriptConsole(jsi::Runtime &runtime) {
    auto console = runtime.global().getProperty(runtime, "console");
    if (console.isUndefined() || console.isNull()) {
      throw jsi::JSError(runtime, "Could not find console object.");
      return jsi::Value::undefined();
    }
    return console;
  }
};
} // namespace RNSkia

```

### Core Architecture Module: `packages/skia/cpp/utils/RNSkMeasureTime.h`
```
//
// Created by Christian Falch on 24/08/2021.
//

#pragma once

#include <chrono>
#include <string>

#include "RNSkLog.h"

namespace RNSkia {

class RNSkMeasureTime {
public:
  explicit RNSkMeasureTime(const std::string &name)
      : _name(name), _start(std::chrono::high_resolution_clock::now()) {}

  ~RNSkMeasureTime() {
    auto stop = std::chrono::high_resolution_clock::now();
    auto duration =
        std::chrono::duration_cast<std::chrono::milliseconds>(stop - _start)
            .count();
    RNSkLogger::logToConsole("%s: %lld ms\n", _name.c_str(), duration);
  }

private:
  std::string _name;
  std::chrono::time_point<std::chrono::steady_clock> _start;
};

}; // namespace RNSkia

```

### Core Architecture Module: `packages/skia/cpp/utils/RNSkTimingInfo.h`
```
#pragma once

#include "RNSkLog.h"
#include <chrono>
#include <string>
#include <utility>

#define NUMBER_OF_DURATION_SAMPLES 10

namespace RNSkia {

using frame = std::chrono::duration<int32_t, std::ratio<1, 60>>;
using ms = std::chrono::duration<float, std::milli>;
using high_resolution_clock = std::chrono::high_resolution_clock;

class RNSkTimingInfo {
public:
  explicit RNSkTimingInfo(const std::string &name) : _name(std::move(name)) {
    reset();
  }

  ~RNSkTimingInfo() {}

  void reset() {
    _lastDurationIndex = 0;
    _lastDurationsCount = 0;
    _lastDuration = 0;
    _prevFpsTimer = -1;
    _frameCount = 0;
    _lastFrameCount = -1;
    _didSkip = false;
    _average = 0;
  }

  void beginTiming() { _start = high_resolution_clock::now(); }

  void stopTiming() {
    std::chrono::time_point<std::chrono::steady_clock> stop =
        high_resolution_clock::now();
    addLastDuration(
        std::chrono::duration_cast<std::chrono::milliseconds>(stop - _start)
            .count());
    tick(stop);
    if (_didSkip) {
      _didSkip = false;
      RNSkLogger::logToConsole("%s: Skipped frame. Previous frame time: %lldms",
                               _name.c_str(), _lastDuration);
    }
  }

  void markSkipped() { _didSkip = true; }

  long getAverage() { return static_cast<long>(_average); }
  long getFps() { return _lastFrameCount; }

  void addLastDuration(long duration) {
    _lastDuration = duration;

    // Average duration
    _lastDurations[_lastDurationIndex++] = _lastDuration;

    if (_lastDurationIndex == NUMBER_OF_DURATION_SAMPLES) {
      _lastDurationIndex = 0;
    }

    if (_lastDurationsCount < NUMBER_OF_DURATION_SAMPLES) {
      _lastDurationsCount++;
    }

    _average = 0;
    for (size_t i = 0; i < _lastDurationsCount; i++) {
      _average = _average + _lastDurations[i];
    }
    _average = _average / _lastDurationsCount;
  }

private:
  void tick(std::chrono::time_point<std::chrono::steady_clock> now) {
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                  now.time_since_epoch())
                  .count();

    if (_prevFpsTimer == -1) {
      _prevFpsTimer = ms;
    } else if (ms - _prevFpsTimer >= 1000) {
      _lastFrameCount = _frameCount;
      _prevFpsTimer = ms;
      _frameCount = 0;
    }
    _frameCount++;
  }

  long _lastDurations[NUMBER_OF_DURATION_SAMPLES];
  int _lastDurationIndex;
  int _lastDurationsCount;
  long _lastDuration;
  std::atomic<double> _average;
  std::chrono::time_point<std::chrono::steady_clock> _start;
  long _prevFpsTimer;
  double _frameCount;
  double _lastFrameCount;
  double _didSkip;
  std::string _name;
};

} // namespace RNSkia

```

### Core Architecture Module: `packages/skia/cpp/utils/RNSkTypedArray.h`
```
#pragma once

#include "include/core/SkImage.h"
#include <jsi/jsi.h>

namespace RNSkia {

namespace jsi = facebook::jsi;

class RNSkTypedArray {
public:
  static jsi::Value getTypedArray(jsi::Runtime &runtime,
                                  const jsi::Value &value, SkImageInfo &info) {
    auto reqSize = info.computeMinByteSize();
    if (reqSize > 0) {
      if (value.isObject()) {
        auto typedArray = value.asObject(runtime);
        auto size = static_cast<size_t>(
            typedArray.getProperty(runtime, "byteLength").asNumber());
        if (size >= reqSize) {
          return typedArray;
        }
      } else {
        if (info.colorType() == kRGBA_F32_SkColorType) {
          auto arrayCtor =
              runtime.global().getPropertyAsFunction(runtime, "Float32Array");
          return arrayCtor.callAsConstructor(runtime,
                                             static_cast<double>(reqSize / 4));
        } else {
          auto arrayCtor =
              runtime.global().getPropertyAsFunction(runtime, "Uint8Array");
          return arrayCtor.callAsConstructor(runtime,
                                             static_cast<double>(reqSize));
        }
      }
    }
    return jsi::Value::null();
  }
};

} // namespace RNSkia

```


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

### Incident Patch 1: `30774c5c` (2026-10-04)
**Commit Message**: fix(🍏): render in Display P3 on wide gamut Apple displays (#43)

v2 rendered in Display P3 by default on iOS. Since Graphite became the
backend, views were always in sRGB.

Views now record and present in Display P3 when the main screen has a wide
color gamut, and in sRGB otherwise. Colors are converted when a frame is
recorded, so a recording made in another color space than its target is
replayed through a texture of its own. Snapshots stay in sRGB.

**File**: `packages/skia/apple/MetalLayerColorSpace.mm` (modified, +10/-8)
```diff
@@ -8,20 +8,22 @@
 
 namespace RNSkia {
 
-// WebGPU canvas values are sRGB-encoded regardless of the texture format
-// (GPUCanvasConfiguration.colorSpace defaults to "srgb"), so the same shader
-// output must display identically on bgra8unorm and rgba16float surfaces.
-// Tagging the float layer as (gamma-encoded) extended sRGB matches the
-// browser behavior: identical colors, with the extra precision of float16.
+// The surface holds gamma-encoded values in the gamut the view renders in
+// (sRGB or Display P3, see DawnUtils::viewColorSpace) regardless of the
+// texture format, so the same content must display identically on bgra8unorm
+// and rgba16float surfaces. Tagging the float layer with the gamma-encoded
+// extended colorspace of that gamut gives identical colors, with the extra
+// precision of float16.
 void applyCAMetalLayerColorSpace(void *nativeSurface,
-                                 wgpu::TextureFormat format) {
+                                 wgpu::TextureFormat format,
+                                 bool useP3ColorSpace) {
   CALayer *layer = (__bridge CALayer *)nativeSurface;
   if (![layer isKindOfClass:[CAMetalLayer class]]) {
     return;
   }
   auto metalLayer = static_cast<CAMetalLayer *>(layer);
-  setCAMetalLayerColorSpace(metalLayer,
-                            format == wgpu::TextureFormat::RGBA16Float, false);
+  setCAMetalLayerColorSpace(
+      metalLayer, format == wgpu::TextureFormat::RGBA16Float, useP3ColorSpace);
   // The change must be set synchronously so the first present already sees
   // it, and it must reach the render server. On a non-main thread (RN JS or
   // worklet runtime) the property lands in that thread's implicit
```

**File**: `packages/skia/apple/RNSkApplePlatformContext.h` (modified, +12/-0)
```diff
@@ -32,10 +32,21 @@ class RNSkApplePlatformContext : public RNSkPlatformContext {
     // Create screenshot manager
     _screenshotService =
         [[ViewScreenshotService alloc] initWithViewRegistry:viewRegistry];
+    _prefersP3ColorSpace = mainScreenSupportsP3();
   }
 
   ~RNSkApplePlatformContext() = default;
 
+  /**
+   Whether the main screen has a wide color gamut (Display P3). The screen is
+   asked once and the answer is kept: RNSkiaModule asks first, on the main
+   queue it is created on, so that the context (created on the JS thread)
+   only reads the answer.
+   */
+  static bool mainScreenSupportsP3();
+
+  bool prefersP3ColorSpace() override { return _prefersP3ColorSpace; }
+
   void runOnMainThread(std::function<void()>) override;
 
   sk_sp<SkImage> takeScreenshotFromViewTag(size_t tag) override;
@@ -66,6 +77,7 @@ class RNSkApplePlatformContext : public RNSkPlatformContext {
 
 private:
   ViewScreenshotService *_screenshotService;
+  bool _prefersP3ColorSpace = false;
 };
 
 } // namespace RNSkia
```

**File**: `packages/skia/apple/RNSkApplePlatformContext.mm` (modified, +17/-0)
```diff
@@ -242,6 +242,23 @@
   RCTFatal(RCTErrorWithMessage([NSString stringWithUTF8String:err.what()]));
 }
 
+bool RNSkApplePlatformContext::mainScreenSupportsP3() {
+  static bool supportsP3 = false;
+  static dispatch_once_t onceToken;
+  dispatch_once(&onceToken, ^{
+#if !TARGET_OS_OSX
+    supportsP3 =
+        [UIScreen mainScreen].traitCollection.displayGamut == UIDisplayGamutP3;
+#else
+    NSColorSpace *screenColorSpace = [NSScreen mainScreen].colorSpace;
+    supportsP3 =
+        screenColorSpace != nil &&
+        [screenColorSpace isEqual:[NSColorSpace displayP3ColorSpace]];
+#endif // !TARGET_OS_OSX
+  });
+  return supportsP3;
+}
+
 sk_sp<SkSurface>
 RNSkApplePlatformContext::makeOffscreenSurface(int width, int height,
                                                bool useP3ColorSpace) {
```

**File**: `packages/skia/apple/RNSkMetalCanvasProvider.mm` (modified, +4/-2)
```diff
@@ -94,8 +94,9 @@ static bool appIsBackgrounded() {
   // product like 1169.9999 gives the pixel size the layout means.
   int w = static_cast<int>(std::lround(width * _context->getPixelDensity()));
   int h = static_cast<int>(std::lround(height * _context->getPixelDensity()));
-  _ctx = RNSkia::DawnContext::getInstance().MakeWindow((__bridge void *)_layer,
-                                                       w, h, _highBitDepth);
+  _ctx = RNSkia::DawnContext::getInstance().MakeWindow(
+      (__bridge void *)_layer, w, h, _highBitDepth,
+      _context->prefersP3ColorSpace());
   {
     auto *window = static_cast<RNSkia::DawnWindowContext *>(_ctx.get());
     std::lock_guard<std::mutex> lock(_targetInfoMutex);
@@ -104,6 +105,7 @@ static bool appIsBackgrounded() {
     _targetInfo.width = window->getWidth();
     _targetInfo.height = window->getHeight();
     _targetInfo.colorType = window->getColorType();
+    _targetInfo.useP3ColorSpace = window->usesP3ColorSpace();
     _targetInfo.textureInfo = window->getTextureInfo();
     _hasTargetInfo = true;
   }
```

**File**: `packages/skia/apple/RNSkiaModule.mm` (modified, +10/-0)
```diff
@@ -39,6 +39,16 @@ + (BOOL)requiresMainQueueSetup {
   return YES;
 }
 
+- (instancetype)init {
+  if (self = [super init]) {
+    // Created on the main queue (see requiresMainQueueSetup): the screen is
+    // asked for its color gamut here, where UIKit may be used. The platform
+    // context is created on the JS thread and only reads the answer.
+    RNSkia::RNSkApplePlatformContext::mainScreenSupportsP3();
+  }
+  return self;
+}
+
 - (void)
     installJSIBindingsWithRuntime:(facebook::jsi::Runtime &)runtime
                       callInvoker:
```

**File**: `packages/skia/cpp/rnskia/RNDawnContext.h` (modified, +3/-2)
```diff
@@ -406,7 +406,8 @@ class DawnContext {
 
   // Create onscreen surface with window
   std::unique_ptr<WindowContext> MakeWindow(void *window, int width, int height,
-                                            bool highBitDepth = false) {
+                                            bool highBitDepth = false,
+                                            bool useP3ColorSpace = false) {
     // 1. Create Surface
     wgpu::SurfaceDescriptor surfaceDescriptor;
 #ifdef __APPLE__
@@ -422,7 +423,7 @@ class DawnContext {
         wgpu::Instance(instance->Get()).CreateSurface(&surfaceDescriptor);
     return std::make_unique<DawnWindowContext>(
         getRecorder(), backendContext.fDevice, surface, window, width, height,
-        highBitDepth);
+        highBitDepth, useP3ColorSpace);
   }
 
   skgpu::graphite::Recorder *getRecorder() {
```

**File**: `packages/skia/cpp/rnskia/RNDawnUtils.h` (modified, +12/-0)
```diff
@@ -8,6 +8,7 @@
 
 #include "dawn/native/DawnNative.h"
 
+#include "include/core/SkColorSpace.h"
 #include "include/core/SkColorType.h"
 #include "include/gpu/graphite/dawn/DawnBackendContext.h"
 #include "utils/RNSkLog.h"
@@ -42,6 +43,17 @@ static const wgpu::TextureFormat HighBitDepthTextureFormat =
     wgpu::TextureFormat::RGB10A2Unorm;
 #endif
 
+// The color space a view renders in: Display P3 (with the sRGB transfer
+// function) where the platform prefers it (a wide gamut display on Apple
+// platforms, see RNSkPlatformContext::prefersP3ColorSpace), sRGB otherwise.
+// Colors are managed either way: content looks the same in both, Display P3
+// only adds the colors sRGB cannot represent.
+inline sk_sp<SkColorSpace> viewColorSpace(bool useP3ColorSpace) {
+  return useP3ColorSpace ? SkColorSpace::MakeRGB(SkNamedTransferFn::kSRGB,
+                                                 SkNamedGamut::kDisplayP3)
+                         : SkColorSpace::MakeSRGB();
+}
+
 // Usage requested for a window texture when the surface supports it (see
 // DawnWindowContext::supportedSurfaceUsage), and assumed for a Graphite
 // recording made before its window exists: TextureBinding lets a render pass
```

**File**: `packages/skia/cpp/rnskia/RNDawnWindowContext.cpp` (modified, +2/-1)
```diff
@@ -29,7 +29,8 @@ bool DawnWindowContext::presentRecordings(
   auto backendTex = skgpu::graphite::BackendTextures::MakeDawn(texture.Get());
   SkSurfaceProps surfaceProps;
   auto surface = SkSurfaces::WrapBackendTexture(
-      _recorder, backendTex, SkColorSpace::MakeSRGB(), &surfaceProps);
+      _recorder, backendTex, DawnUtils::viewColorSpace(_useP3ColorSpace),
+      &surfaceProps);
   if (!surface) {
     return false;
   }
```

---

### Incident Patch 2: `a2a40a64` (2026-10-03)
**Commit Message**: fix(🐛): Fix android emulator crash (#41)

**File**: `packages/skia/cpp/rnskia/RNDawnUtils.h` (modified, +0/-1)
```diff
@@ -137,7 +137,6 @@ requestDevice(dawn::native::Adapter &nativeAdapter,
 #endif
       "disable_lazy_clear_for_mapped_at_creation_buffer",
       "allow_unsafe_apis",
-      "use_user_defined_labels_in_backend",
       "disable_robustness",
   };
   wgpu::DawnTogglesDescriptor togglesDesc;
```

---

### Incident Patch 3: `32973a4b` (2026-10-03)
**Commit Message**: fix(🗿): set Graphite as the default API (#39)

**File**: `apps/docs/docs/canvas/canvas.md` (modified, +3/-4)
```diff
@@ -12,12 +12,11 @@ Behind the scenes, it is using its own React renderer.
 | Name | Type     |  Description    |
 |:-----|:---------|:-----------------|
 | style?   | `ViewStyle` | View style |
-| ref?   | `Ref<SkiaView>` | Reference to the `SkiaView` object |
+| ref?   | `Ref<CanvasRef>` | Reference to the canvas (see [canvas size](#canvas-size) and [snapshots](#getting-a-canvas-snapshot)) |
 | onSize? | `SharedValue<Size>` | Reanimated value to which the canvas size will be assigned  (see [canvas size](#canvas-size)) |
 | opaque? | `boolean` | Declares that the canvas covers every pixel of its bounds. Defaults to `false`. On Android it selects the cheapest backing view (see [Android rendering options](#android-rendering-options)) |
 | android? | `AndroidCanvasProps` | Android-only rendering options, ignored on iOS and web (see [Android rendering options](#android-rendering-options)) |
 | highBitDepth? | `boolean` | Render into a surface with more than 8 bits per channel (see [high bit depth](#high-bit-depth)) |
-| androidWarmup? | `boolean` | Draw the first frame directly on the Android compositor. Use it for static icons or fully opaque drawings—animated or translucent canvases can misrender, so it remains opt-in. |
 
 ## Canvas size
 
@@ -178,8 +177,8 @@ const Demo = () => {
 
 :::warning
 
-On Android, `highBitDepth` requires the Graphite backend; with the default OpenGL backend the canvas falls back to 8-bit.
-It also requires an opaque `SurfaceView` (the default for `opaque`): the 10-bit format only has 2 bits of alpha, and a `TextureView` composites through an 8-bit pass anyway.
+On Android, `highBitDepth` requires an opaque `SurfaceView` (the default for `opaque`): the 10-bit format only has 2 bits of alpha, and a `TextureView` composites through an 8-bit pass anyway.
+When the surface does not support the 10-bit format, the canvas falls back to 8-bit.
 
 :::
 
```

**File**: `apps/docs/docs/canvas/graphite.md` (modified, +5/-10)
```diff
@@ -5,14 +5,9 @@ sidebar_label: Graphite View
 slug: /canvas/graphite
 ---
 
-`SkiaGraphiteView` is a canvas for the [Graphite backend](/docs/getting-started/installation#graphite) that you drive frame by frame from any JavaScript runtime.
-A frame is a Graphite recording: you record it on the thread you are on (the JS thread, the Reanimated UI runtime or a dedicated worklet runtime), and the view presents it on the next display frame.
-
-:::info
-
-On native the view requires the Graphite backend; with the default backend it renders nothing and `getContext()` throws. On the web, where Skia runs on WebGL, the same API is emulated: see [Web](#web) below.
-
-:::
+`SkiaGraphiteView` is a canvas that you drive frame by frame from any JavaScript runtime.
+A frame is a [Graphite](/docs/getting-started/installation#graphite) recording: you record it on the thread you are on (the JS thread, the Reanimated UI runtime or a dedicated worklet runtime), and the view presents it on the next display frame.
+On the web, where Skia runs on WebGL, the same API is emulated: see [Web](#web) below.
 
 ## Recording a frame
 
@@ -81,7 +76,7 @@ export const Demo = () => {
 A few rules follow from this model:
 
 - One recording is open at a time per view. Finish it before starting the next one, on any runtime.
-- Recordings are presented in submission order and never dropped. A later frame may sample a texture an earlier frame uploaded, so when the main thread falls behind, the queued frames are replayed in order and only the last one stays visible.
+- Recordings are presented in submission order and never dropped. A later frame may sample a texture an earlier frame uploaded, so when the main thread falls behind, the queued frames are replayed in order and only the last one stays visible. A recording made for another size than the surface has by the time it is presented (recorded before the view had a surface, or the view was resized since) still shows, at the cost of an extra copy for that frame.
 - The producer clears the canvas. A recording draws on top of what the view shows, which also lets you record only the parts that changed.
 - GPU-backed images (offscreen surface snapshots, native buffers, video frames) can be drawn from any runtime. Their content is uploaded when they are created, so create them before the frame that uses them.
 
@@ -91,5 +86,5 @@ A few rules follow from this model:
 
 ## Web
 
-The web has no Graphite. `SkiaGraphiteView` keeps the same API there: a recording is an `SkPicture`, and the view replays the queued recordings onto its WebGL surface, using the same renderer as `SkiaPictureView` (context-loss recovery included, and `__destroyWebGLContextAfterRender` to stay under the browser's limit on live WebGL contexts).
+The web has no Graphite. `SkiaGraphiteView` keeps the same API there: a recording is an `SkPicture`, and the view replays the queued recordings onto its WebGL surface, using the same renderer as `Canvas` (context-loss recovery included, and `__destroyWebGLContextAfterRender` to stay under the browser's limit on live WebGL contexts).
 Frames are presented in submission order and never dropped, right before the browser paints. Two differences to keep in mind: the surface starts cleared on every frame, so a recording should draw the whole frame rather than a delta on top of the previous one; and a WebGL texture belongs to the context that created it, so an image snapshot taken from an offscreen surface must go through `makeNonTextureImage()` before another view can draw it.
```

**File**: `apps/example/src/Examples/API/AnimatedImages.tsx` (modified, +1/-5)
```diff
@@ -1,10 +1,6 @@
 import React from "react";
 import { Pressable, ScrollView, useWindowDimensions } from "react-native";
-import {
-  Canvas,
-  Image,
-  useAnimatedImageValue,
-} from "react-native-skia";
+import { Canvas, Image, useAnimatedImageValue } from "react-native-skia";
 import { useSharedValue } from "react-native-reanimated";
 
 export const AnimatedImages = () => {
```

**File**: `apps/example/src/Examples/API/ColorFilter.tsx` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ export const ColorFilter = () => {
           </LinearToSRGBGamma>
         </Image>
       </Canvas>
-      <Canvas style={{ width: 256, height: 256 }} colorSpace="srgb">
+      <Canvas style={{ width: 256, height: 256 }}>
         <Fill color="green" />
       </Canvas>
       <View style={{ width: 256, height: 256, backgroundColor: "green" }} />
```

**File**: `apps/example/src/Examples/API/Data.tsx` (modified, +1/-7)
```diff
@@ -1,11 +1,5 @@
 import React from "react";
-import {
-  AlphaType,
-  Canvas,
-  ColorType,
-  Image,
-  Skia,
-} from "react-native-skia";
+import { AlphaType, Canvas, ColorType, Image, Skia } from "react-native-skia";
 import { PixelRatio } from "react-native";
 
 const pixels = new Uint8Array(256 * 256 * 4);
```

**File**: `apps/example/src/Examples/API/FirstFrame.tsx` (modified, +3/-9)
```diff
@@ -8,12 +8,7 @@ import {
 } from "react-native";
 import { useNavigation } from "@react-navigation/native";
 import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
-import {
-  Canvas,
-  Circle,
-  Skia,
-  SkiaPictureView,
-} from "react-native-skia";
+import { Canvas, Circle, Skia, SkiaPictureView } from "react-native-skia";
 import { ScrollView } from "react-native-gesture-handler";
 
 import { AnimationWithTouchHandler } from "../Reanimated/AnimationWithTouchHandler";
@@ -57,9 +52,8 @@ export const FirstFrame = () => {
           key={`picture-${count}`}
           picture={picture}
           style={styles.canvas}
-          androidWarmup
-        ></SkiaPictureView>
-        <Canvas style={styles.canvas} key={`canvas-${count}`} androidWarmup>
+        />
+        <Canvas style={styles.canvas} key={`canvas-${count}`}>
           <Circle cx={100} cy={100} r={50} color="red" />
         </Canvas>
         <View style={{ width, height: 100 }}>
```

**File**: `apps/example/src/Examples/API/GlyphBounds.tsx` (modified, +1/-6)
```diff
@@ -6,12 +6,7 @@ import {
   View,
   useWindowDimensions,
 } from "react-native";
-import type {
-  Glyph,
-  SkFont,
-  SkPoint,
-  SkRect,
-} from "react-native-skia";
+import type { Glyph, SkFont, SkPoint, SkRect } from "react-native-skia";
 import {
   Canvas,
   Glyphs,
```

**File**: `apps/example/src/Examples/API/Icons/index.tsx` (modified, +3/-9)
```diff
@@ -2,13 +2,7 @@ import React, { createContext, useContext, useMemo } from "react";
 import { Text, View } from "react-native";
 import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
 import type { SkPicture } from "react-native-skia";
-import {
-  Canvas,
-  Rect,
-  SkiaPictureView,
-  Skia,
-  useSVG,
-} from "react-native-skia";
+import { Canvas, Rect, SkiaPictureView, Skia, useSVG } from "react-native-skia";
 
 import { Octocat } from "./SvgIcons/OctocatIcon";
 import { StackExchange } from "./SvgIcons/StackExchangeIcon";
@@ -74,7 +68,7 @@ interface IconProps {
 const style = { width: 48, height: 48 };
 
 const Icon = ({ icon }: IconProps) => {
-  return <SkiaPictureView picture={icon} style={style} androidWarmup />;
+  return <SkiaPictureView picture={icon} style={style} />;
 };
 
 type Props = { color: string };
@@ -96,7 +90,7 @@ const Screen: React.FC<Props> = ({ color }) => {
         <Icon icon={stackExchange} />
         <Icon icon={overflow} />
         <Text>React Native Skia Canvas</Text>
-        <Canvas style={{ width: 50, height: 50 }} androidWarmup>
+        <Canvas style={{ width: 50, height: 50 }}>
           <Rect x={0} y={0} width={50} height={50} color={color} />
         </Canvas>
       </View>
```

---

### Incident Patch 4: `dd54ffbc` (2026-10-02)
**Commit Message**: fix(📦): fix release issue (#38)

**File**: `packages/skia/android/build.gradle` (modified, +17/-0)
```diff
@@ -76,7 +76,24 @@ def skiaLibsPath = useGraphite
 // Graphite build's Dawn release tag (libs/.dawn-version) with the tag
 // react-native-webgpu declares in its package.json `dawn` field.
 if (useGraphite) {
+    // Fail early rather than with a ninja "missing and no known rule" error.
+    def missingDawn = ["armeabi-v7a", "arm64-v8a", "x86", "x86_64"].findAll {
+        !file("${skiaLibsPath}/${it}/libwebgpu_dawn.so").exists()
+    }
+    if (!missingDawn.isEmpty()) {
+        throw new GradleException(
+            "react-native-skia: libwebgpu_dawn.so not found in ${skiaLibsPath} " +
+            "for ${missingDawn.join(', ')}. The installed react-native-skia-graphite-android " +
+            "package does not ship the shared Dawn library this Graphite build links against. " +
+            "Upgrade it and rebuild.")
+    }
+
+    // In-repo builds write the marker into libs/, npm installs ship it in the
+    // react-native-skia-graphite-android package.
     def dawnMarker = file("${projectDir}/../libs/.dawn-version")
+    if (!dawnMarker.exists()) {
+        dawnMarker = file("${skiaLibsPath}/.dawn-version")
+    }
     def webgpuDir = null
     try {
         webgpuDir = resolveNodePackage('react-native-webgpu', projectDir)
```

**File**: `packages/skia/cpp/rnskia/RNDawnContext.h` (modified, +6/-0)
```diff
@@ -144,6 +144,11 @@ class DawnContext {
   }
 
   sk_sp<SkImage> MakeImageFromBuffer(void *buffer) {
+#if defined(__ANDROID__) && __ANDROID_API__ < 26
+    // AHardwareBuffer is only available from API 26
+    (void)buffer;
+    return nullptr;
+#else
 #ifdef __APPLE__
     wgpu::SharedTextureMemoryIOSurfaceDescriptor platformDesc;
     auto ioSurface = CVPixelBufferGetIOSurface((CVPixelBufferRef)buffer);
@@ -213,6 +218,7 @@ class DawnContext {
       return nullptr;
     }
     return nullptr;
+#endif
   }
 
   // Create offscreen surface
```

**File**: `packages/skia/package.json` (modified, +3/-3)
```diff
@@ -149,9 +149,9 @@
     "react-reconciler": "0.31.0"
   },
   "graphiteDependencies": {
-    "react-native-skia-graphite-android": "154.0.0",
-    "react-native-skia-graphite-apple-ios": "154.0.0",
-    "react-native-skia-graphite-apple-macos": "154.0.0"
+    "react-native-skia-graphite-android": "154.0.1",
+    "react-native-skia-graphite-apple-ios": "154.0.1",
+    "react-native-skia-graphite-apple-macos": "154.0.1"
   },
   "eslintIgnore": [
     "node_modules/",
```

**File**: `packages/skia/react-native-skia.podspec` (modified, +18/-1)
```diff
@@ -37,6 +37,11 @@ install_apple_skia_libs = lambda do |base_dir, packages|
     src = File.join(pkg_dir, 'libs')
     next unless Dir.exist?(src) && !Dir.glob(File.join(src, '*.xcframework')).empty?
 
+    # Graphite packages carry the Dawn release tag they ship (libs/.dawn-version),
+    # used below for the react-native-webgpu version check.
+    dawn_version = File.join(src, '.dawn-version')
+    FileUtils.cp(dawn_version, File.join(base_dir, 'libs', '.dawn-version')) if File.exist?(dawn_version)
+
     version = JSON.parse(File.read(File.join(pkg_dir, 'package.json')))['version'].to_s
     dest = File.join(base_dir, 'libs', platform)
     marker = File.join(dest, '.version')
@@ -110,7 +115,19 @@ if use_graphite && has_webgpu_pkg
     Pod::UI.puts "react-native-skia: Dawn versions match (#{skia_dawn})"
   end
 end
-framework_names += ['libwebgpu_dawn'] if use_graphite && !has_webgpu_pkg
+if use_graphite && !has_webgpu_pkg
+  # CocoaPods silently skips missing vendored frameworks, which would surface
+  # later as undefined dawn::native symbols at link time. Fail early instead.
+  %w[ios macos].each do |platform|
+    platform_dir = File.join(__dir__, 'libs', platform)
+    # A missing libs/<platform> is reported by the prebuilt binaries check below.
+    next if !Dir.exist?(platform_dir) || Dir.exist?(File.join(platform_dir, 'libwebgpu_dawn.xcframework'))
+    raise "react-native-skia: libwebgpu_dawn.xcframework not found in libs/#{platform}. " \
+          "The installed #{apple_skia_packages[platform]} package does not ship the shared " \
+          "Dawn library this Graphite build links against. Upgrade it, then run `pod install` again."
+  end
+  framework_names += ['libwebgpu_dawn']
+end
 
 # Verify that the prebuilt binaries are available (copied in above from the npm
 # packages, or downloaded by install-skia-graphite for in-repo Graphite builds).
```

---

### Incident Patch 5: `7e5d9b30` (2026-10-02)
**Commit Message**: chore(🐙): fix graphite release (#4108)

**File**: `.github/scripts/rename-package-tarball.sh` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+#!/usr/bin/env bash
+# Rewrites every packed tarball in the given directory so that it publishes as
+# $PACKAGE_NAME from $REPOSITORY. The rename happens on the tarball rather than
+# in the workspace because the example, docs and headless apps depend on the
+# @shopify/react-native-skia workspace, and yarn refuses to run once it is renamed.
+set -euo pipefail
+
+DIR="$1"
+: "${PACKAGE_NAME:?PACKAGE_NAME is required}"
+: "${REPOSITORY:?REPOSITORY is required}"
+
+for TARBALL in "$DIR"/*.tgz; do
+  WORK="$(mktemp -d)"
+  tar -xzf "$TARBALL" -C "$WORK"
+  node -e "
+    const fs = require('fs');
+    const file = process.argv[1];
+    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
+    pkg.name = process.env.PACKAGE_NAME;
+    pkg.repository = {
+      type: 'git',
+      url: 'git+https://github.com/' + process.env.REPOSITORY + '.git',
+      baseUrl: 'https://github.com/' + process.env.REPOSITORY,
+    };
+    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
+  " "$WORK/package/package.json"
+  sed -i "s#@shopify/react-native-skia#${PACKAGE_NAME}#g" \
+    "$WORK/package/jestSetup.js" "$WORK/package/scripts/setup-canvaskit.js"
+  VERSION="$(node -p "require(process.argv[1]).version" "$WORK/package/package.json")"
+  rm "$TARBALL"
+  tar -czf "$DIR/${PACKAGE_NAME}-${VERSION}.tgz" -C "$WORK" package
+  rm -rf "$WORK"
+  echo "Wrote $DIR/${PACKAGE_NAME}-${VERSION}.tgz"
+done
```

**File**: `.github/workflows/build-npm-react-native-skia.yml` (modified, +15/-36)
```diff
@@ -71,50 +71,28 @@ jobs:
           "
           node -p "JSON.stringify(require('./package.json').dependencies, null, 2)"
 
-      # Publish as react-native-skia (unscoped) from this repository. The
-      # repository field drives both the semantic-release remote and npm provenance.
-      - name: Rename package
-        working-directory: packages/skia
-        run: |
-          node -e "
-            const fs = require('fs');
-            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
-            pkg.name = process.env.PACKAGE_NAME;
-            pkg.repository = {
-              type: 'git',
-              url: 'git+https://github.com/' + process.env.REPOSITORY + '.git',
-              baseUrl: 'https://github.com/' + process.env.REPOSITORY,
-            };
-            fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
-          "
-          sed -i "s#@shopify/react-native-skia#${PACKAGE_NAME}#g" jestSetup.js scripts/setup-canvaskit.js
-          node -p "require('./package.json').name + ' ' + JSON.stringify(require('./package.json').repository)"
-
-      # The upstream .releaserc only knows main and next; releases from the 2.x
-      # branch are maintenance releases (>=2.0.0 <3.0.0) on the 2.x channel.
-      - name: Add 2.x maintenance branch to semantic-release
+      # Configure semantic-release for this repository. The workspace keeps its
+      # @shopify/react-native-skia name (the apps depend on it), so the packed
+      # tarball is renamed to react-native-skia right after semantic-release-yarn
+      # writes it to dist/, before it is published and attached to the release.
+      # The 2.x branch is a maintenance branch (>=2.0.0 <3.0.0) on the 2.x channel.
+      - name: Configure semantic-release
+        if: ${{ inputs.version == '' }}
         working-directory: packages/skia
         run: |
           node -e "
             const fs = require('fs');
             const rc = JSON.parse(fs.readFileSync('.releaserc', 'utf8'));
+            rc.repositoryUrl = 'https://github.com/' + process.env.REPOSITORY + '.git';
             rc.branches.unshift({ name: '2.x', range: '2.x', channel: '2.x' });
-            fs.writeFileSync('.releaserc', JSON.stringify(rc, null, 2) + '\n');
-          "
-
-      # Without npm publish, semantic-release still tags, creates the GitHub
-      # release and writes the tarball to dist/, which is uploaded below.
-      - name: Disable npm publish in semantic-release
-        if: ${{ inputs.skip_npm_publish && inputs.version == '' }}
-        working-directory: packages/skia
-        run: |
-          node -e "
-            const fs = require('fs');
-            const rc = JSON.parse(fs.readFileSync('.releaserc', 'utf8'));
-            rc.plugins = rc.plugins.filter((p) => (Array.isArray(p) ? p[0] : p) !== '@semantic-release/exec');
+            const exec = rc.plugins.find((p) => Array.isArray(p) && p[0] === '@semantic-release/exec');
+            exec[1].prepareCmd = 'bash ../../.github/scripts/rename-package-tarball.sh dist';
+            if (process.env.SKIP_NPM_PUBLISH === 'true') delete exec[1].publishCmd;
             fs.writeFileSync('.releaserc', JSON.stringify(rc, null, 2) + '\n');
           "
           cat .releaserc
+        env:
+          SKIP_NPM_PUBLISH: ${{ inputs.skip_npm_publish }}
 
       - name: Build NPM Package
         if: ${{ inputs.version == '' }}
@@ -145,7 +123,8 @@ jobs:
             fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
           " "$VERSION"
           mkdir -p dist
-          yarn pack --out "dist/%s-%v.tgz"
+          yarn pack --out dist/package.tgz
+          bash ../../.github/scripts/rename-package-tarball.sh dist
           if [ "$SKIP_NPM_PUBLISH" != "true" ]; then
             mkdir -p /tmp/npm-publish && cp dist/*.tgz /tmp/npm-publish/
             (cd /tmp/npm-publish && npm publish *.tgz --provenance --access public --tag "$NPM_DIST_TAG")
```

---

### Incident Patch 6: `55607125` (2026-10-01)
**Commit Message**: fix(🧠): remove need to use GC out of the declarative renderer (#4094)

**File**: `apps/example/src/Home/HomeScreenButton.tsx` (modified, +1/-6)
```diff
@@ -17,12 +17,7 @@ export const HomeScreenButton: React.FC<Props> = ({
 }) => {
   const navigation = useNavigation();
   const gotoRoute = useCallback(() => {
-    navigation.dispatch(
-      CommonActions.navigate({
-        name: route,
-        params: {},
-      })
-    );
+    navigation.dispatch(CommonActions.navigate(route, {}));
   }, [route, navigation]);
   return (
     <TouchableOpacity
```

**File**: `packages/skia/android/CMakeLists.txt` (modified, +2/-0)
```diff
@@ -81,8 +81,10 @@ add_library(
         "${PROJECT_SOURCE_DIR}/../cpp/jsi/JSICache.cpp"
         "${PROJECT_SOURCE_DIR}/../cpp/jsi/JsiPromises.cpp"
         "${PROJECT_SOURCE_DIR}/../cpp/jsi/Promise.cpp"
+        "${PROJECT_SOURCE_DIR}/../cpp/jsi/ViewProperty.cpp"
 
         "${PROJECT_SOURCE_DIR}/../cpp/rnskia/RNSkManager.cpp"
+        "${PROJECT_SOURCE_DIR}/../cpp/rnskia/RNSkPictureView.cpp"
 
         "${PROJECT_SOURCE_DIR}/../cpp/api/third_party/CSSColorParser.cpp"
         "${PROJECT_SOURCE_DIR}/../cpp/api/third_party/base64.cpp"
```

**File**: `packages/skia/android/cpp/jni/include/JniSkiaPictureView.h` (modified, +16/-15)
```diff
@@ -69,8 +69,8 @@ class JniSkiaPictureView : public jni::HybridClass<JniSkiaPictureView>,
                                       highBitDepth);
   }
 
-  void surfaceSizeChanged(jobject surface, int width, int height, bool isSurface,
-                          bool highBitDepth) override {
+  void surfaceSizeChanged(jobject surface, int width, int height,
+                          bool isSurface, bool highBitDepth) override {
     JniSkiaBaseView::surfaceSizeChanged(surface, width, height, isSurface,
                                         highBitDepth);
   }
@@ -83,7 +83,18 @@ class JniSkiaPictureView : public jni::HybridClass<JniSkiaPictureView>,
     JniSkiaBaseView::registerView(nativeId);
   }
 
-  void unregisterView() override { JniSkiaBaseView::unregisterView(); }
+  void unregisterView() override {
+    JniSkiaBaseView::unregisterView();
+    // React drops the Java view here, but the native view behind it (and the
+    // recording it owns) is only destroyed when the Java object is finalized.
+    // Release the content now so it does not wait for the Java garbage
+    // collector.
+    if (_skiaAndroidView != nullptr) {
+      auto renderer = std::static_pointer_cast<RNSkia::RNSkPictureRenderer>(
+          _skiaAndroidView->getSkiaView()->getRenderer());
+      renderer->clear();
+    }
+  }
 
   jni::local_ref<jni::JArrayInt> getBitmap(int width, int height) override {
     // Get the RNSkPictureView from the android view
@@ -101,9 +112,6 @@ class JniSkiaPictureView : public jni::HybridClass<JniSkiaPictureView>,
       return jni::JArrayInt::newArray(0);
     }
 
-    // Get the SkPicture from the renderer
-    sk_sp<SkPicture> picture = renderer->getPicture();
-
     const size_t pixelCount =
         static_cast<size_t>(width) * static_cast<size_t>(height);
     if (pixelCount == 0) {
@@ -126,15 +134,8 @@ class JniSkiaPictureView : public jni::HybridClass<JniSkiaPictureView>,
       return jni::JArrayInt::newArray(0);
     }
 
-    canvas->clear(SK_ColorTRANSPARENT);
-
-    if (picture) {
-      auto pd = pictureView->getPixelDensity();
-      canvas->save();
-      canvas->scale(pd, pd);
-      canvas->drawPicture(picture);
-      canvas->restore();
-    }
+    // Draws whatever the view currently shows: a picture or a recorder.
+    renderer->drawInto(canvas, pictureView->getPixelDensity());
 
     sk_sp<SkImage> snapshot = surface->makeImageSnapshot();
     if (!snapshot) {
```

**File**: `packages/skia/cpp/api/JsiSkSkottie.h` (modified, +2/-3)
```diff
@@ -34,7 +34,7 @@
 namespace RNSkia {
 namespace jsi = facebook::jsi;
 
-std::unique_ptr<SkCodec> DecodeImageData(sk_sp<SkData> data) {
+inline std::unique_ptr<SkCodec> DecodeImageData(sk_sp<SkData> data) {
   if (data == nullptr) {
     return nullptr;
   }
@@ -342,8 +342,7 @@ class JsiSkSkottie
     if (!slotID.has_value() || !scalar.has_value()) {
       return false;
     }
-    return getObject()->_slotManager->setScalarSlot(SkString(*slotID),
-                                                    *scalar);
+    return getObject()->_slotManager->setScalarSlot(SkString(*slotID), *scalar);
   }
 
   bool setVec2Slot(JsiOptional<std::string> slotID,
```

**File**: `packages/skia/cpp/api/JsiSkStrutStyle.h` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ namespace jsi = facebook::jsi;
 
 namespace para = skia::textlayout;
 
-bool asBool(jsi::Runtime &runtime, const jsi::Value &value) {
+inline bool asBool(jsi::Runtime &runtime, const jsi::Value &value) {
   if (!value.isBool()) {
     throw jsi::JSError(runtime, "Expected boolean value");
   }
```

**File**: `packages/skia/cpp/api/JsiSkSurfaceFactory.h` (modified, +3/-3)
```diff
@@ -79,9 +79,9 @@ class JsiSkSurfaceFactory : public JsiSkNativeObject<JsiSkSurfaceFactory> {
       throw std::runtime_error(
           "MakeFromNativeTexture: pointer must be non-null");
     }
-    // Borrow: AddRef so our wgpu::Texture holds its own reference; the
-    // surface retains the texture for its lifetime and the caller keeps
-    // ownership of the JS GPUTexture.
+    // AddRef so our wgpu::Texture holds its own reference: the surface keeps
+    // the texture alive for its lifetime, and the JS GPUTexture keeps its own
+    // reference, which the caller may release once the surface exists.
     wgpuTextureAddRef(raw);
     wgpu::Texture texture = wgpu::Texture::Acquire(raw);
     auto surface = DawnContext::getInstance().MakeSurfaceFromTexture(texture);
```

**File**: `packages/skia/cpp/api/recorder/Convertor.h` (modified, +152/-131)
```diff
@@ -40,7 +40,7 @@ struct GlyphData {
   std::vector<SkPoint> positions;
 };
 
-bool isSharedValue(jsi::Runtime &runtime, const jsi::Value &value) {
+inline bool isSharedValue(jsi::Runtime &runtime, const jsi::Value &value) {
   return value.isObject() &&
          value.asObject(runtime).hasProperty(runtime,
                                              "_isReanimatedSharedValue") &&
@@ -103,7 +103,8 @@ bool convertSelectorProperty(jsi::Runtime &runtime, const jsi::Value &prop,
 
     auto selected = values.getProperty(runtime, key.c_str());
     if (selected.isUndefined() || selected.isNull() ||
-        (selected.isObject() && selected.asObject(runtime).isFunction(runtime))) {
+        (selected.isObject() &&
+         selected.asObject(runtime).isFunction(runtime))) {
       return;
     }
     *target = getPropertyValue<T>(runtime, selected);
@@ -130,8 +131,9 @@ void convertPropertyImpl(jsi::Runtime &runtime, const jsi::Object &object,
 
   if (isSharedValue(runtime, prop)) {
     auto sharedValue = prop.asObject(runtime);
-    auto name =
-        sharedValue.getProperty(runtime, "name").asString(runtime).utf8(runtime);
+    auto name = sharedValue.getProperty(runtime, "name")
+                    .asString(runtime)
+                    .utf8(runtime);
     auto conv = [target = &target](jsi::Runtime &runtime,
                                    const jsi::Object &val) {
       auto value = val.getProperty(runtime, "value");
@@ -155,31 +157,33 @@ void convertProperty(jsi::Runtime &runtime, const jsi::Object &object,
 
 // Base property value getter implementations
 template <>
-float getPropertyValue(jsi::Runtime &runtime, const jsi::Value &value) {
+inline float getPropertyValue(jsi::Runtime &runtime, const jsi::Value &value) {
   if (value.isNumber()) {
     return static_cast<float>(value.asNumber());
   }
   throw std::runtime_error("Invalid float prop value received");
 }
 
 template <>
-int getPropertyValue(jsi::Runtime &runtime, const jsi::Value &value) {
+inline int getPropertyValue(jsi::Runtime &runtime, const jsi::Value &value) {
   if (value.isNumber()) {
     return static_cast<int>(value.asNumber());
   }
   throw std::runtime_error("Invalid int prop value received");
 }
 
 template <>
-std::string getPropertyValue(jsi::Runtime &runtime, const jsi::Value &value) {
+inline std::string getPropertyValue(jsi::Runtime &runtime,
+                                    const jsi::Value &value) {
   if (value.isString()) {
     return value.asString(runtime).utf8(runtime);
   }
   throw std::runtime_error("Invalid string prop value received");
 }
 
 template <>
-SkPoint getPropertyValue(jsi::Runtime &runtime, const jsi::Value &value) {
+inline SkPoint getPropertyValue(jsi::Runtime &runtime,
+                                const jsi::Value &value) {
   if (value.isObject()) {
     auto x = value.asObject(runtime).getProperty(runtime, "x").asNumber();
     auto y = value.asObject(runtime).getProperty(runtime, "y").asNumber();
@@ -189,7 +193,8 @@ SkPoint getPropertyValue(jsi::Runtime &runtime, const jsi::Value &value) {
 }
 
 template <>
-SkColor getPropertyValue(jsi::Runtime &runtime, const jsi::Value &value) {
+inline SkColor getPropertyValue(jsi::Runtime &runtime,
+                                const jsi::Value &value) {
   if (value.isNumber()) {
     return static_cast<SkColor>(value.asNumber());
   } else if (value.isString()) {
@@ -241,8 +246,8 @@ SkColor getPropertyValue(jsi::Runtime &runtime, const jsi::Value &value) {
 }
 
 template <>
-std::vector<SkColor> getPropertyValue(jsi::Runtime &runtime,
-                                      const jsi::Value &value) {
+inline std::vector<SkColor> getPropertyValue(jsi::Runtime &runtime,
+                                             const jsi::Value &value) {
   std::vector<SkColor> result;
   if (value.isObject() && value.asObject(runtime).isArray(runtime)) {
     auto array = value.asObject(runtime).asArray(runtime);
@@ -258,7 +263,8 @@ std::vector<SkColor> getPropertyValue(jsi::Runtime &runtime,
 }
 
 template <>
-SkTileMode getPropertyValue(jsi::Runtime &runtime, const jsi::Value &val) {
+inline SkTileMode getPropertyValue(jsi::Runtime &runtime,
+                                   const jsi::Value &val) {
   if (val.isString()) {
     auto value = val.asString(runtime).utf8(runtime);
     if (value == "clamp") {
@@ -275,7 +281,8 @@ SkTileMode getPropertyValue(jsi::Runtime &runtime, const jsi::Value &val) {
 }
 
 template <>
-SkColorChannel getPropertyValue(jsi::Runtime &runtime, const jsi::Value &val) {
+inline SkColorChannel getPropertyValue(jsi::Runtime &runtime,
+                                       const jsi::Value &val) {
   if (val.isString()) {
     auto value = val.asString(runtime).utf8(runtime);
     if (value == "r") {
@@ -292,8 +299,8 @@ SkColorChannel getPropertyValue(jsi::Runtime &runtime, const jsi::Value &val) {
 }
 
 template <>
-SkVertices::VertexMode getPropertyValue(jsi::Runtime &runtime,
-                                  
```

**File**: `packages/skia/cpp/api/recorder/DataTypes.h` (modified, +11/-11)
```diff
@@ -6,8 +6,8 @@ namespace RNSkia {
 
 using Uniforms = std::map<std::string, std::vector<float>>;
 
-std::vector<float> processArray(jsi::Runtime &runtime,
-                                const jsi::Array &array) {
+inline std::vector<float> processArray(jsi::Runtime &runtime,
+                                       const jsi::Array &array) {
   std::vector<float> result;
   size_t length = array.length(runtime);
   result.reserve(length);
@@ -37,18 +37,18 @@ std::vector<float> processArray(jsi::Runtime &runtime,
   return result;
 }
 
-bool isJSPoint(jsi::Runtime &runtime, const jsi::Value &value) {
+inline bool isJSPoint(jsi::Runtime &runtime, const jsi::Value &value) {
   return value.isObject() &&
          value.asObject(runtime).hasProperty(runtime, "x") &&
          value.asObject(runtime).hasProperty(runtime, "y");
 }
 
-bool isIndexable(jsi::Runtime &runtime, const jsi::Value &value) {
+inline bool isIndexable(jsi::Runtime &runtime, const jsi::Value &value) {
   return value.isObject() && value.asObject(runtime).hasProperty(runtime, "0");
 }
 
-std::shared_ptr<SkRect> processRect(jsi::Runtime &runtime,
-                                    const jsi::Value &value) {
+inline std::shared_ptr<SkRect> processRect(jsi::Runtime &runtime,
+                                           const jsi::Value &value) {
   if (value.isObject()) {
     auto object = value.asObject(runtime);
     auto ptr = tryGetJsiObject<JsiSkRect>(runtime, object);
@@ -68,7 +68,7 @@ std::shared_ptr<SkRect> processRect(jsi::Runtime &runtime,
   return nullptr;
 }
 
-SkPoint processPoint(jsi::Runtime &runtime, const jsi::Value &value) {
+inline SkPoint processPoint(jsi::Runtime &runtime, const jsi::Value &value) {
   if (value.isObject()) {
     auto object = value.asObject(runtime);
     if (object.hasProperty(runtime, "x") && object.hasProperty(runtime, "y")) {
@@ -81,8 +81,8 @@ SkPoint processPoint(jsi::Runtime &runtime, const jsi::Value &value) {
 }
 
 // TODO: return the SkRRect directly
-std::shared_ptr<SkRRect> processRRect(jsi::Runtime &runtime,
-                                      const jsi::Value &value) {
+inline std::shared_ptr<SkRRect> processRRect(jsi::Runtime &runtime,
+                                             const jsi::Value &value) {
   if (value.isObject()) {
     auto object = value.asObject(runtime);
     auto ptr = tryGetJsiObject<JsiSkRRect>(runtime, object);
@@ -119,8 +119,8 @@ std::shared_ptr<SkRRect> processRRect(jsi::Runtime &runtime,
 }
 
 // Return SkPath instead of shared_ptr<SkPath>
-std::shared_ptr<SkPath> processPath(jsi::Runtime &runtime,
-                                    const jsi::Value &value) {
+inline std::shared_ptr<SkPath> processPath(jsi::Runtime &runtime,
+                                           const jsi::Value &value) {
   if (value.isString()) {
     auto pathString = value.getString(runtime).utf8(runtime);
     SkPath result;
```

---

### Incident Patch 7: `60d52098` (2026-09-29)
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

### Incident Patch 8: `3f7cfdbb` (2026-09-29)
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

**File**: `packages/skia/cpp/api/JsiSkPathBuilder.h` (modified, +11/-4)
```diff
@@ -271,11 +271,18 @@ class JsiSkPathBuilder
             std::make_shared<SkPathBuilder>(std::move(builder))) {}
 
   size_t getMemoryPressure() override {
-    auto builder = getObject();
-    if (!builder)
+    if (isDisposed()) {
       return 0;
-    // Estimate memory usage based on snapshot
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
 
   static jsi::Value toValue(jsi::Runtime &runtime,
```

**File**: `packages/skia/cpp/api/JsiSkPictureRecorder.h` (modified, +2/-1)
```diff
@@ -58,7 +58,8 @@ class JsiSkPictureRecorder
                   &JsiSkPictureRecorder::finishRecordingAsPicture);
   }
 
-  size_t getMemoryPressure() override { return 1024 * 1024; }
+  // The recorded picture reports its own size once finished.
+  size_t getMemoryPressure() override { return kMinMemoryPressure; }
 
   static const jsi::HostFunctionType
   createCtor(std::shared_ptr<RNSkPlatformContext> context) {
```

**File**: `packages/skia/cpp/api/JsiSkShader.h` (modified, +3/-1)
```diff
@@ -29,7 +29,9 @@ class JsiSkShader
       : JsiSkWrappingSkPtrNativeObject<JsiSkShader, SkShader>(
             std::move(context), std::move(shader)) {}
 
-  size_t getMemoryPressure() override { return 1024 * 1024; }
+  // A shader node is a few hundred bytes; the images it may reference
+  // are reported by their own wrappers.
+  size_t getMemoryPressure() override { return kMinMemoryPressure; }
 
   static sk_sp<SkShader> fromValue(jsi::Runtime &runtime,
                                    const jsi::Value &obj) {
```

---

### Incident Patch 9: `75840d85` (2026-09-24)
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

### Incident Patch 10: `d2d36935` (2026-09-24)
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
-    # RN 0.71 distributes prebuilt binaries.
-    set (RUNTIMEEXECUTOR_LIB "ReactAndroid::runtimeexecutor")
-else()
-    find_library(
-            RUNTIMEEXECUTOR_LIB
-            runtimeexecutor
-            PATHS ${LIBRN_DIR}
-            NO_CMAKE_FIND_ROOT_PATH
-    )
-endif()
-message("-- RUNTIMEEXECUTOR   : " ${RUNTIMEEXECUTOR_LIB})
-
-unset(TURBOMODULES_LIB CACHE)
-if(${REACT_NATIVE_VERSION} GREATER_EQUAL 76)
-    # RN 0.76 doesn't have turbomodulejsijni
-    # DO NOTHING, we'll not link these libraries
-elseif(${REACT_NATIVE_VERSION} GREATER_EQUAL 71)
-    # RN 0.71 distributes prebuilt binaries.
-    set (TURBOMODULES_LIB "ReactAndroid::turbomodulejsijni")
-else()
-    find_library(
-            TURBOMODULES_LIB
-            turbomodulejsijni
-            PATHS ${LIBRN_DIR}
-            NO_CMAKE_FIND_ROOT_PATH
-    )
-endif()
-message("-- TURBO   : " ${TURBOMODULES_LIB})
-
-add_definitions(-DREACT_NATIVE_VERSION=${REACT_NATIVE_VERSION})
+# React Native distributes prebuilt binaries via prefab.
+find_packa
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
-    // ref: https://docs.gradle.org/current/userguide/tutorial_using_tasks.html#sec:build_script_external_dependencies
-    if (project == rootProject) {
-        repositories {
-            google()
-        }
-        dependencies {
-            // This should reflect the Gradle plugin version used by
-            // the minimum React Native version supported.
-            classpath 'com.android.tools.build:gradle:3.4.1'
-        }
-    }
-}
 
 android {
-    def agpVersion = com.android.Version.ANDROID_GRADLE_PLUGIN_VERSION
-    if (agpVersion.tokenize('.')[0].toInteger() >= 7) {
-      namespace "com.reactnative.skia"
-    }
+    namespace "com.reactnative.skia"
 
     compileSdkVersion safeExtGet('compileSdkVersion', DEFAULT_COMPILE_SDK_VERSION)
     buildToolsVersion safeExtGet('buildToolsVersion', DEFAULT_BUILD_TOOLS_VERSION)
@@ -213,17 +157,15 @@ android {
         targetSdkVersion safeExtGet('targetSdkVersion', DEFAULT_TARGET_SDK_VERSION)
         versionCode 1
         versionName "1.0"
-        buildConfigField "boolean", "IS_NEW_ARCHITECTURE_ENABLED", isNewArchitectureEnabled().t
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

**File**: `packages/skia/android/cpp/jni/include/JniSkiaManager.h` (modified, +2/-3)
```diff
@@ -5,7 +5,6 @@
 #include <fbjni/fbjni.h>
 #include <jsi/jsi.h>
 #include <memory>
-#include <react/jni/JRuntimeExecutor.h>
 
 #include "JniPlatformContext.h"
 #include "RNSkAndroidPlatformContext.h"
@@ -28,8 +27,8 @@ class JniSkiaManager : public jni::HybridClass<JniSkiaManager> {
 
   static jni::local_ref<jni::HybridClass<JniSkiaManager>::jhybriddata>
   initHybrid(jni::alias_ref<jhybridobject> jThis, jlong jsContext,
-             jni::alias_ref<facebook::react::JRuntimeExecutor::javaobject>
-                 jRuntimeExecutor,
+             jni::alias_ref<facebook::react::CallInvokerHolder::javaobject>
+                 jsCallInvokerHolder,
              JavaPlatformContext platformContext);
 
   static void registerNatives();
```

**File**: `packages/skia/android/src/latest/java/com/reactnative/skia/ReactNativeCompatible.java` (removed, +0/-11)
```diff
@@ -1,11 +0,0 @@
-package com.reactnative.skia;
-
-import com.facebook.react.bridge.ReactContext;
-import com.facebook.react.bridge.RuntimeExecutor;
-
-/* package */ final class ReactNativeCompatible {
-    public static RuntimeExecutor getRuntimeExecutor(ReactContext context) {
-        return context.getCatalystInstance().getRuntimeExecutor();
-    }
-}
-
```

**File**: `packages/skia/android/src/main/java/com/reactnative/skia/RNSkiaPackage.java` (modified, +23/-45)
```diff
@@ -9,35 +9,25 @@
 import java.util.List;
 import java.util.Map;
 
-import com.facebook.react.TurboReactPackage;
+import com.facebook.react.BaseReactPackage;
+import com.facebook.react.ReactPackage;
 import com.facebook.react.bridge.NativeModule;
 import com.facebook.react.bridge.ReactApplicationContext;
-import com.facebook.react.module.annotations.ReactModule;
-import com.facebook.react.module.annotations.ReactModuleList;
 import com.facebook.react.module.model.ReactModuleInfo;
 import com.facebook.react.module.model.ReactModuleInfoProvider;
-import com.facebook.react.turbomodule.core.interfaces.TurboModule;
 import com.facebook.react.uimanager.ViewManager;
 
-@ReactModuleList(
-        nativeModules = {
-                RNSkiaModule.class,
-        })
-public class RNSkiaPackage extends TurboReactPackage {
-    @Override
-    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
-        return Arrays.<NativeModule>asList(new RNSkiaModule(reactContext));
-    }
-
+// `implements ReactPackage` is redundant (BaseReactPackage already implements it)
+// but required: older @react-native-community/cli versions only autolink
+// classes matching `implements ReactPackage` or `extends TurboReactPackage`.
+public class RNSkiaPackage extends BaseReactPackage implements ReactPackage {
     @Nullable
     @Override
-    public NativeModule getModule(String s, ReactApplicationContext reactApplicationContext) {
-        switch (s) {
-            case RNSkiaModule.NAME:
-                return new RNSkiaModule(reactApplicationContext);
-            default:
-                return null;
+    public NativeModule getModule(String name, ReactApplicationContext reactApplicationContext) {
+        if (RNSkiaModule.NAME.equals(name)) {
+            return new RNSkiaModule(reactApplicationContext);
         }
+        return null;
     }
 
     @Override
@@ -49,31 +39,19 @@ public List<ViewManager> createViewManagers(ReactApplicationContext reactContext
 
     @Override
     public ReactModuleInfoProvider getReactModuleInfoProvider() {
-        return new ReactModuleInfoProvider() {
-            @Override
-            public Map<String, ReactModuleInfo> getReactModuleInfos() {
-                final Map<String, ReactModuleInfo> reactModuleInfoMap = new HashMap<>();
-                Class<? extends NativeModule>[] moduleList =
-                        new Class[] {
-                                RNSkiaModule.class,
-                        };
-
-                for (Class<? extends NativeModule> moduleClass : moduleList) {
-                    ReactModule reactModule = moduleClass.getAnnotation(ReactModule.class);
-
-                    reactModuleInfoMap.put(
-                            reactModule.name(),
-                            new ReactModuleInfo(
-                                    reactModule.name(),
-                                    moduleClass.getName(),
-                                    reactModule.canOverrideExistingModule(),
-                                    reactModule.needsEagerInit(),
-                                    reactModule.hasConstants(),
-                                    reactModule.isCxxModule(),
-                                    TurboModule.class.isAssignableFrom(moduleClass)));
-                }
-                return reactModuleInfoMap;
-            }
+        return () -> {
+            final Map<String, ReactModuleInfo> reactModuleInfoMap = new HashMap<>();
+            reactModuleInfoMap.put(
+                    RNSkiaModule.NAME,
+                    new ReactModuleInfo(
+                            RNSkiaModule.NAME,
+                            RNSkiaModule.class.getName(),
+                            false, // canOverrideExistingModule
+                            false, // needsEagerInit
+                            false, // isCxxModule
+                            true   // isTurboModule
+                    ));
+            return reactModuleInfoMap;
         };
     }
 }
```

---

### Incident Patch 11: `48b33020` (2026-09-23)
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
+        const count = (a: number[], b: number[]) => {
+          let mismatches = 0;
+          for (let i = 0; i < a.length; i++) {
+            if (a[i] !== b[i]) {
+              mismatches++;
+            }
+          }
+          return mismatches;
+        };
+        const reference = render(ctx.modulate);
+        return [
+          count(reference, render(null)),
+          count(reference, render(ctx.srcOver)),
+        ];
+      },
+      {
+        modulate: BlendMode.Modulate,
+        srcOver: BlendMode.SrcOver,
+        clamp: TileMode.Clamp,
+      }
+    );
+    expect(result[1]).toBeGreaterThan(0);
+    expect(result[0]).toBe(0);
+  });
 });
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

### Incident Patch 12: `172fcad1` (2026-09-15)
**Commit Message**: fix(🐯): handle invalid SVG parse results (#4065)

Co-authored-by: William Candillon <[REDACTED_EMAIL]>

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

### Incident Patch 13: `8344c6ab` (2026-09-15)
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

### Incident Patch 14: `3c27eab2` (2026-09-15)
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

### Incident Patch 15: `2de503ca` (2026-09-08)
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
+    it("keeps zero-valued enums", () => {
+      const style = JsiSkTextStyle.toTextStyle({
+        decorationStyle: 0,
+        textBaseline: 0,
+        fontStyle: { slant: 0, width: 1 },
+      });
+      expect(style.decorationStyle).toEqual({ value: 0 });
+      expect(style.textBaseline).toEqual({ value: 0 });
+      expect(style.fontStyle?.slant).toEqual({ value: 0 });
+      expect(style.fontStyle?.width).toEqual({ value: 1 });
+    });
+
+    it("leaves unset fields undefined", () => {
+      const style = JsiSkTextStyle.toTextStyle({ fontStyle: {} });
+      expect(style.decorationStyle).toBeUndefined();
+      expect(style.textBaseline).toBeUndefined();
+      expect(style.fontStyle?.slant).toBeUndefined();
+      expect(style.fontStyle?.weight).toBeUndefined();
+      expect(style.fontStyle?.width).toBeUndefined();
+    });
+  });
+
+  describe("Skottie", () => {
+    it("getTextSlot reports zero-valued numeric fields", () => {
+      const { Skia } = setupSkia();
+      
```

**File**: `packages/skia/src/skia/web/JsiSkCanvas.ts` (modified, +11/-6)
```diff
@@ -209,7 +209,9 @@ export class JsiSkCanvas
       cubics.map(({ x, y }) => [x, y]).flat(),
       colors,
       texs ? texs.flatMap((p) => Array.from(JsiSkPoint.fromValue(p))) : texs,
-      mode ? getEnum(this.CanvasKit, "BlendMode", mode) : null,
+      mode !== undefined && mode !== null
+        ? getEnum(this.CanvasKit, "BlendMode", mode)
+        : null,
       paint ? JsiSkPaint.fromValue(paint) : undefined
     );
   }
@@ -362,7 +364,9 @@ export class JsiSkCanvas
   drawColor(color: SkColor, blendMode?: BlendMode) {
     this.ref.drawColor(
       color,
-      blendMode ? getEnum(this.CanvasKit, "BlendMode", blendMode) : undefined
+      blendMode !== undefined
+        ? getEnum(this.CanvasKit, "BlendMode", blendMode)
+        : undefined
     );
   }
 
@@ -430,17 +434,18 @@ export class JsiSkCanvas
     } else if (sampling) {
       ckSampling = {
         filter: getEnum(this.CanvasKit, "FilterMode", sampling.filter),
-        mipmap: sampling.mipmap
-          ? getEnum(this.CanvasKit, "MipmapMode", sampling.mipmap)
-          : this.CanvasKit.MipmapMode.None,
+        mipmap:
+          sampling.mipmap !== undefined
+            ? getEnum(this.CanvasKit, "MipmapMode", sampling.mipmap)
+            : this.CanvasKit.MipmapMode.None,
       };
     }
     this.ref.drawAtlas(
       JsiSkImage.fromValue(atlas),
       src,
       dst,
       JsiSkPaint.fromValue(paint),
-      blendMode
+      blendMode !== undefined
         ? getEnum(this.CanvasKit, "BlendMode", blendMode)
         : this.CanvasKit.BlendMode.DstOver,
       cls,
```

**File**: `packages/skia/src/skia/web/JsiSkImage.ts` (modified, +6/-3)
```diff
@@ -107,12 +107,15 @@ export class JsiSkImage extends HostObject<Image, "Image"> implements SkImage {
 
   encodeToBytes(fmt?: ImageFormat, quality?: number) {
     let result: Uint8Array | null;
-    if (fmt && quality) {
+    if (fmt !== undefined && quality !== undefined) {
+      // CanvasKit's encodeToBytes() applies `quality || 100`, which would
+      // turn a valid quality of 0 into 100. The encoders clamp any quality
+      // below 1 up to 1 anyway, so pass 1 to get the same output as 0.
       result = this.ref.encodeToBytes(
         getEnum(this.CanvasKit, "ImageFormat", fmt),
-        quality
+        Math.max(quality, 1)
       );
-    } else if (fmt) {
+    } else if (fmt !== undefined) {
       result = this.ref.encodeToBytes(
         getEnum(this.CanvasKit, "ImageFormat", fmt)
       );
```

**File**: `packages/skia/src/skia/web/JsiSkTextStyle.ts` (modified, +20/-15)
```diff
@@ -9,23 +9,27 @@ export class JsiSkTextStyle {
       color: value.color,
       decoration: value.decoration,
       decorationColor: value.decorationColor,
-      decorationStyle: value.decorationStyle
-        ? { value: value.decorationStyle }
-        : undefined,
+      decorationStyle:
+        value.decorationStyle !== undefined
+          ? { value: value.decorationStyle }
+          : undefined,
       decorationThickness: value.decorationThickness,
       fontFamilies: value.fontFamilies,
       fontSize: value.fontSize,
       fontStyle: value.fontStyle
         ? {
-            slant: value.fontStyle.slant
-              ? { value: value.fontStyle.slant }
-              : undefined,
-            weight: value.fontStyle.weight
-              ? { value: value.fontStyle.weight }
-              : undefined,
-            width: value.fontStyle.width
-              ? { value: value.fontStyle.width }
-              : undefined,
+            slant:
+              value.fontStyle.slant !== undefined
+                ? { value: value.fontStyle.slant }
+                : undefined,
+            weight:
+              value.fontStyle.weight !== undefined
+                ? { value: value.fontStyle.weight }
+                : undefined,
+            width:
+              value.fontStyle.width !== undefined
+                ? { value: value.fontStyle.width }
+                : undefined,
           }
         : undefined,
       fontFeatures: value.fontFeatures,
@@ -44,9 +48,10 @@ export class JsiSkTextStyle {
               : undefined,
           }))
         : undefined,
-      textBaseline: value.textBaseline
-        ? { value: value.textBaseline }
-        : undefined,
+      textBaseline:
+        value.textBaseline !== undefined
+          ? { value: value.textBaseline }
+          : undefined,
       wordSpacing: value.wordSpacing,
     };
   }
```

#### Recent Merged Pull Requests:
- **PR #4128** (2026-10-05): chore(🐙): align the v2 release channel with the 2.x branch (@wcandillon)
- **PR #4127** (2026-10-05): chore(🐙): fix the v2 release channel (@wcandillon)
- **PR #4126** (2026-10-05): chore(deps): bump actions/setup-java from 6.0.0 to 6.0.1 (@dependabot[bot])
- **PR #4125** (2026-10-05): chore(deps): bump actions/upload-artifact from 7.0.0 to 7.0.1 (@dependabot[bot])
- **PR #4124** (2026-10-05): chore(deps): bump actions/setup-node from 3.9.1 to 7.0.0 (@dependabot[bot])
- **PR #4122** (closed): chore(🔎): add crawler verification (@wcandillon)
- **PR #4114** (2026-10-02): chore(🐙): sync fork (@wcandillon)
- **PR #4113** (2026-10-02): chore(🐙): make graphite the default release (@wcandillon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
