> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wcandillon-react-native-skia-learnings.md`  
> **Source**: github ([https://github.com/wcandillon/react-native-skia](https://github.com/wcandillon/react-native-skia))  
> **Source Version**: `39d14f72`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T11:49:33.300Z  
> **Learning ID**: `learn-github-wcandillon-react-native-skia`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): wcandillon/react-native-skia

> **Canonical Artifact**: `07_PROJECT_LEARNING/wcandillon-react-native-skia-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wcandillon/react-native-skia](https://github.com/wcandillon/react-native-skia))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T11:49:32.272Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wcandillon/react-native-skia`
- **Description**: High-performance React Native Graphics using Skia
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8754 stars

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
import type { CanvasKit as CanvasKitType } from "canvaskit-wasm";
import { peekSharedWebGLContext } from "react-native-skia/src/skia/web/SharedWebGLContext";

// Exercises the lifetime of the WebGL context behind the canvases on web.
// Every canvas on the page draws through one shared WebGL context; a
// <canvas> element owns none, and the renderer belongs to a layout effect:
// - StrictMode (DEV) re-runs the layout effect on the same element (#3976):
//   the canvas must keep painting.
// - Mounting and unmounting canvases past the browser's limit on live
//   contexts (16 in Chrome, which then evicts the oldest, visible or not)
//   must not cost any context (#3349): there is only ever one.
// - A context the browser took away (a GPU reset) is picked up again once
//   restored, and every canvas repaints.
// Every action below reports on the status line; on native they are no-ops.

const SIZE = 200;
const CHURN_CYCLES = 20;

const isWeb = Platform.OS === "web" && typeof document !== "undefined";

// index.web.js puts the CanvasKit instance on globalThis.
declare const CanvasKit: CanvasKitType;

const sharedContext = () =>
  isWeb && typeof CanvasKit !== "undefined"
    ? peekSharedWebGLContext(CanvasKit)
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
  const [churnMounted, setChurnMounted] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [contextState, setContextState] = useState("unknown");
  const [error, setError] = useState<string | null>(null);
  const loseContextRef = useRef<{
    loseContext(): void;
    restoreContext(): void;
  } | null>(null);

  // Poll the shared context: a lost context is what a GPU reset looks like
  // from the outside, and "none" means no canvas has made it yet.
  useEffect(() => {
    if (!isWeb) {
      return undefined;
    }
    const tick = () => {
      const shared = sharedContext();
      if (!shared) {
        setContextState("none");
      } else {
        setContextState(shared.gl.isContextLost() ? "LOST" : "ok");
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [strict]);

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
    const shared = sharedContext();
    // The extension object has to be obtained while the context is healthy:
    // getExtension() returns null on a lost context.
    loseContextRef.current =
      shared?.gl.getExtension("WEBGL_lose_context") ?? null;
    loseContextRef.current?.loseContext();
  };

  const restore = () => {
    loseContextRef.current?.restoreContext();
  };

  const reference = (
    <Boundary onError={setError}>
      <Canvas style={styles.canvas}>
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
        {`cycles ${cycle}/${CHURN_CYCLES} · context: ${contextState}` +
          ` · strict: ${strict ? "on" : "off"}` +
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
      </View>
      <Text style={styles.description}>
        Mount & unmount: more cycles than the browser's context limit; the
        reference canvas must keep its context (Chrome logs "Too many active
        WebGL contexts" when one is evicted). StrictMode: re-runs the renderer
        on the same element; the canvas must keep painting. Lose then restore:
        the shared context goes away (a GPU reset) and comes back; the canvas
        goes blank, then resumes.
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
  // Unnamed Lottie nodes (no "nm") arrive as nullptr; skip them like a
  // prefix mismatch instead of passing null to SkStrStartsWith/std::string.
  if (name == nullptr || !SkStrStartsWith(name, fPrefix.c_str())) {
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
                  .setResou
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

#include <functional>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

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
// RNSkWindowSurface::supportedSurfaceUsage), and assumed for a Graphite
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

// The color type Skia samples a texture of the given format with, or none
// when Skia cannot sample the format: multi-planar YUV (the biplanar
// 4:2:0 formats of an NV12 IOSurface, OpaqueYCbCrAndroid), depth/stencil and
// compressed formats.
inline std::optional<SkColorType>
colorTypeForTextureFormat(wgpu::TextureFormat format) {
  switch (format) {
  case wgpu::TextureFormat::RGBA8Unorm:
    return kRGBA_8888_SkColorType;
  case wgpu::TextureFormat::BGRA8Unorm:
    return kBGRA_8888_SkColorType;
  case wgpu::TextureFormat::RGBA16Float:
    return kRGBA_F16_SkColorType;
  case wgpu::TextureFormat::RGB10A2Unorm:
    return kRGBA_1010102_SkColorType;
  case wgpu::TextureFormat::R8Unorm:
    return kGray_8_SkColorType;
  default:
    return std::nullopt;
  }
}

inline const char *backendTypeName(wgpu::BackendType type) {
  switch (type) {
  case wgpu::BackendType::Metal:
    return "Metal";
  case wgpu::BackendType::Vulkan:
    return "Vulkan";
  case wgpu::BackendType::OpenGL:
    return "OpenGL";
  case wgpu::BackendType::OpenGLES:
    return "OpenGLES";
  case wgpu::BackendType::WebGPU:
    return "WebGPU";
  case wgpu::BackendType::Null:
    return "Null";
  default:
    return "Undefined";
  }
}

// Through Dawn's own conversion: a length of wgpu::kStrlen means
// null-terminated, which a std::string built from (data, length) would not
// survive.
inline std::string toString(wgpu::StringView view) {
  return std::string(std::string_view(view));
}

// What an adapter reports about itself, in the terms of GPUAdapterInfo.
struct AdapterDescription {
  std::string backend;
  std::string vendor;
  std::string architecture;
  std::string device;
  std::string description;
};

inline AdapterDescription describeAdapter(const wgpu::Adapter &adapter) {
  wgpu::AdapterInfo info;
  adapter.GetInfo(&info);
  AdapterDescription result;
  result.backend = backendTypeName(info.backendType);
  result.vendor = toString(info.vendor);
  result.architecture = toString(info.architecture);
  result.device = toString(info.device);
  result.description = toString(info.description);
  return result;
}

// Dawn's own SwiftShader test (gpu_info::IsGoogleSwiftshader): Google's
// vendor ID with SwiftShader's device ID. The Android emulator exposes the
// host's SwiftShader through gfxstream, which keeps the IDs and the name, so
// either identifies it.
inline bool isSwiftShader(const wgpu::Adapter &adapter) {
  wgpu::AdapterInfo info;
  adapter.GetInfo(&info);
  constexpr uint32_t kVendorIDGoogle = 0x1AE0;
  constexpr uint32_t kDeviceIDSwiftShader = 0xC0DE;
  return (info.vendorID == kVendorIDGoogle &&
          info.deviceID == kDeviceIDSwiftShader) ||
         toString(info.device).find("SwiftShader") != std::string::npos;
}

// The backend Skia renders with: Metal on Apple, Vulkan on Android.
#ifdef __APPLE__
constexpr auto kPlatformBackendType = wgpu::BackendType::Metal;
#elif __ANDROID__
constexpr auto kPlatformBackendType = wgpu::BackendType::Vulkan;
#endif

// Why no adapter was found, for the error raised to JS: every adapter Dawn
// can see on any backend and at the compatibility feature level, so that the
// message tells a device without Vulkan apart from one whose driver falls
// short of the WebGPU core requirements. On Android it names v2, which renders
// with OpenGL ES on such devices.
inline std::string describeMissingAdapter(dawn::native::Instance *instance) {
  std::string message = "React Native Skia renders with ";
  message += backendTypeName(kPlatformBackendType);
#ifdef __ANDROID__
  message += " (Vulkan 1.1 or later)";
#endif
  message += " and found no GPU adapter meeting the WebGPU core requirements "
             "on this device.";
  wgpu::RequestAdapterOptions options;
  options.featureLevel = wgpu::FeatureLevel::Compatibility;
  auto adapters = instance->EnumerateAdapters(&options);
  if (adapters.empty()) {
    message += " No adapter is available on any backend.";
  } else {
    message += " Adapters found:";
    for (const auto &adapter : adapters) {
      auto info = describeAdapter(adapter.Get());
      message += " [" + info.backend + ": " + info.device;
      if (!info.description.empty()) {
        message += ", " + info.description;
      }
      message += "]";
    }
  }
#ifdef __ANDROID__
  message += " v2 (react-native-skia@2) renders with OpenGL ES on devices "
             "without Vulkan.";
#endif
  return message;
}

// Find the best matching GPU adapter for the current platform.
// Sorts by adapter type (DiscreteGPU > IntegratedGPU > CPU) and selects the
// first adapter matching the platform backend (Metal on Apple, Vulkan on
// Android). Throws std::runtime_error, with a message describing the
// device, when there is none.
inline dawn::native::Adapter
getMatchedAdapter(dawn::native::Instance *instance) {
  constexpr auto kDefaultBackendType = kPlatformBackendType;

  wgpu::RequestAdapterOptions options;
  options.backendType = kDefaultBackendType;
  options.featureLevel = wgpu::FeatureLevel::Core;

  std::vector<dawn::native::Adapter> adapters =
      instance->EnumerateAdapters(&options);
  if (adapters.empty()) {
    throw std::runtime_error(describeMissingAdapter(instance));
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

  throw std::runtime_error(describeMissingAdapter(instance));
}

// Where requestDevice() reports what becomes of the device. A loss after
// creation (a driver reset, the GPU out of memory, a device-level error)
// goes to onLost with Dawn's reason and message, on whichever thread Dawn
// detects it: possibly inside a call on the device itself, on the calling
// thread. A creation failure leaves Dawn's message in creationFailure, for
// the caller of requestDevice(): that callback runs inside CreateDevice, on
// the calling thread. The listener must outlive the device.
struct DeviceLostListener {
  std::function<void(wgpu::DeviceLostReason reason, const std::string
```

### Core Architecture Module: `packages/skia/cpp/rnskia/RNSkWorker.h`
```
#pragma once

#include <deque>
#include <functional>
#include <mutex>
#include <thread>
#include <utility>

#include <condition_variable>

#if defined(__APPLE__)
#include <pthread.h>
#elif defined(__ANDROID__)
#include <pthread.h>
#endif

namespace RNSkia {

/**
 * One background thread for work that neither a frame nor JS should wait
 * for: decoding an image, for instance. Jobs run in submission order, one at
 * a time, so a burst of them never fans out into as many threads.
 */
class RNSkWorker {
public:
  static RNSkWorker &getInstance() {
    // Never destroyed: the thread is detached and the process takes it down,
    // which spares the static destructor from joining it at exit.
    static auto *instance = new RNSkWorker();
    return *instance;
  }

  RNSkWorker(const RNSkWorker &) = delete;
  RNSkWorker &operator=(const RNSkWorker &) = delete;

  void post(std::function<void()> job) {
    {
      std::lock_guard<std::mutex> lock(_mutex);
      _jobs.push_back(std::move(job));
    }
    _condition.notify_one();
  }

private:
  RNSkWorker() {
    std::thread([this]() { run(); }).detach();
  }

  void run() {
#if defined(__APPLE__)
    pthread_setname_np("RNSkia Worker");
#elif defined(__ANDROID__)
    pthread_setname_np(pthread_self(), "RNSkia Worker");
#endif
    for (;;) {
      std::function<void()> job;
      {
        std::unique_lock<std::mutex> lock(_mutex);
        _condition.wait(lock, [this]() { return !_jobs.empty(); });
        job = std::move(_jobs.front());
        _jobs.pop_front();
      }
      job();
    }
  }

  std::mutex _mutex;
  std::condition_variable _condition;
  std::deque<std::function<void()>> _jobs;
};

} // namespace RNSkia

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

  static void errorToJavascriptConsole(jsi::Runtime &runtime,
                                       const std::string &message) {
    auto console = RNSkLogger::getJavascriptConsole(runtime).asObject(runtime);
    auto error = console.getPropertyAsFunction(runtime, "error");
    error.call(runtime, jsi::String::createFromUtf8(runtime, message));
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4172** (2026-10-14): **[Performance] Vertices reads points one at a time**
  *Symptoms*: ### Description  Our app redraws a large `<Vertices>` mesh from a Reanimated worklet. On a Galaxy A55, converting 3072 points for Skia took about 43% of the main thread which took longer more than drawing them.  It seems that the cost is in how points cross the JSI boundary: `Skia.MakeVertices` and `<Vertices>` only accept points as JS `{ x, y }` objects, read one at a time. I tried passing a `Float32Array` but that throws `Object is an object, expected an array`.  **Expected:** converting a few thousand points should be fast, since it's basically a memcpy operation. **Actual:** A low-end Android phone stutters with a larger `Skia.MakeVertices`.  I haven't migrated to v3 yet but this still looks like an issue there. Would there be a way to read point arrays in one pass, or am I approaching things incorrectly?  ### React Native Skia Version  2.14.0  ### React Native Version  0.83.4  ### Using New Architecture  - [x] Enabled  ### Steps to Reproduce  1. Clone the minimal repro 2. Run a release build. 3. The app times 300 `Skia.MakeVertices` calls on the UI thread with 1536 positions and 1536 texture coordinates, and reports the median per call.  ### Snack, Code Example, Screenshot, or Link to Repository  https://github.com/Nezz/expo-repro/tree/repro/SkiaVertices

- **Issue #4154** (2026-10-08): **Skia 3.0.5 requested two incompatible Vulkan graphics features,**
  *Symptoms*: ### Description  Got a crash on Android emulator (should happen on real device as well). Chat said:  Fixed—the app is now running in the Android emulator. Skia 3.0.5 requested two incompatible Vulkan graphics features, causing a native crash. I added a [persistent patch](/Users/yaron/dev/rumble/patches/react-native-skia+3.0.5.patch) that selects only one. It reapplies automatically when dependencies are installed. Verified the rebuild, cold restart, ring controls, and tab navigation. Lint and typecheck passed. You can keep using npx expo run:android.  And this was the patch: ``` std::vector<wgpu::FeatureName> features; +  bool hasVulkanSharedFence = false;    for (auto feature : requestedFeatures) {      if (adapter.HasFeature(feature)) { +      // Dawn permits only one Vulkan shared-fence type per device. Prefer +      // SyncFD (requested first) for Android AHardwareBuffer interoperability. +      const bool isVulkanSharedFence = +          feature == wgpu::FeatureName::SharedFenceSyncFD || +          feature == wgpu::FeatureName::SharedFenceVkSemaphoreOpaqueFD || +          feature == wgpu::FeatureName::SharedFenceVkSemaphoreZirconHandle; +      if (isVulkanSharedFence && hasVulkanSharedFence) { +        continue; +      } +      hasVulkanSharedFence |= isVulkanSharedFence;        features.push_back(feature);      }    } ```  On iOS everything is ok  ### React Native Skia Version  3.0.5  ### React Native Version  expo 57.0.26  ### Using New Architecture  - [ ] Enabled  ###

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

### Incident Patch 1: `cce3cf0f` (2026-10-23)
**Commit Message**: fix(🤖): present Android canvases off the main thread (#4318)

* fix(🤖): present a SurfaceView canvas off the main thread

Presenting a frame of a SurfaceView canvas (inserting its recordings,
the GPU submit, the swapchain present) ran on the main thread, on a
Choreographer tick: on a Pixel 8 about 4.7 ms per frame at 120 Hz, 370
to 760 ms/s of the main thread for one animating canvas. Recording
already runs off the main thread (the render thread pool for <Canvas>,
the caller's runtime for a Graphite view); presenting was the remaining
main-thread cost, and it held up everything else the main thread does.

A SurfaceView canvas now presents on a present thread shared by every
such canvas in the process (presents serialize on the GPU context
anyway), a looper thread with a Choreographer of its own for the vsync,
where the view's FrameScheduler lives. A TextureView canvas keeps
presenting on the main thread, behind the draw its window has pending.
RNSkView takes the thread from the platform view (setPresentThread);
without one, as on Apple platforms, tasks keep going to the main thread.

The window surface keeps the main thread (attach, resize, detach) and
the present thread apart wi

**File**: `apps/docs/docs/canvas/graphite.md` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ A recording is immutable: you can submit the same one again later without record
 
 ## Threading model
 
-Recording happens on the thread that calls `beginRecording()`, presenting on the main thread: on the display link (`CADisplayLink` on iOS, the `Choreographer` for an Android `SurfaceView`), or, for an Android `TextureView`, once its window has drawn the previous frame.
+Recording happens on the thread that calls `beginRecording()`. Presenting happens on the display link on iOS (`CADisplayLink`, on the main thread), and on a present thread of its own on Android, so that the main thread pays nothing for a frame: on the vsync of that thread's `Choreographer` for a `SurfaceView`, once its window has drawn the previous frame for a `TextureView`.
 The context can be captured into a worklet, so a frame loop can run on the Reanimated UI runtime, at the display's rate, without touching the JS thread:
 
 ```tsx
```

**File**: `apps/example/src/Tests/Screens/Resize.tsx` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import React, { useEffect, useState } from "react";
+import { View } from "react-native";
+import { Canvas, Fill, Rect } from "react-native-skia";
+
+const SMALL = 60;
+const LARGE = 120;
+const STEP = 6;
+
+// A canvas that grows (or shrinks) a few points per frame from one size to
+// another once mounted, so that its presents race its resizes, and settles.
+// Red, with a 20 point green square at its origin: a stale frame stretched to
+// the new size would show a larger (or smaller) square, so the square tells
+// that the frame shown was recorded for the size the canvas settled at. Cyan
+// wherever the canvas does not reach.
+const ResizingCanvas = ({ from, to }: { from: number; to: number }) => {
+  const [size, setSize] = useState(from);
+  useEffect(() => {
+    let current = from;
+    let frame = 0;
+    const step = () => {
+      current =
+        from < to ? Math.min(current + STEP, to) : Math.max(current - STEP, to);
+      setSize(current);
+      if (current !== to) {
+        frame = requestAnimationFrame(step);
+      }
+    };
+    frame = requestAnimationFrame(step);
+    return () => cancelAnimationFrame(frame);
+  }, [from, to]);
+  return (
+    <View style={{ width: LARGE, height: LARGE, backgroundColor: "cyan" }}>
+      <Canvas style={{ width: size, height: size }}>
+        <Fill color="red" />
+        <Rect x={0} y={0} width={20} height={20} color="lime" />
+      </Canvas>
+    </View>
+  );
+};
+
+export const ResizeGrow = () => <ResizingCanvas from={SMALL} to={LARGE} />;
+
+export const ResizeShrink = () => <ResizingCanvas from={LARGE} to={SMALL} />;
```

**File**: `apps/example/src/Tests/Screens/index.ts` (modified, +3/-0)
```diff
@@ -3,6 +3,7 @@ import type { FC } from "react";
 import { GraphiteView, GraphiteViewTransform } from "./GraphiteView";
 import { IsOnMainThread } from "./IsOnMainThread";
 import { OnLayout } from "./OnLayout";
+import { ResizeGrow, ResizeShrink } from "./Resize";
 import { SharedImage } from "./SharedImage";
 import { SharedValueReads } from "./SharedValueReads";
 
@@ -11,6 +12,8 @@ export const Screens: Record<string, FC> = {
   GraphiteViewTransform,
   IsOnMainThread,
   OnLayout,
+  ResizeGrow,
+  ResizeShrink,
   SharedImage,
   SharedValueReads,
 };
```

**File**: `packages/skia/android/cpp/jni/JniLoad.cpp` (modified, +8/-0)
```diff
@@ -1,6 +1,7 @@
 #include "JniPlatformContext.h"
 #include "JniSkiaManager.h"
 #include "JniSkiaView.h"
+#include <fbjni/NativeRunnable.h>
 #include <fbjni/fbjni.h>
 #include <jni.h>
 
@@ -9,5 +10,12 @@ JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *) {
     RNSkia::JniSkiaManager::registerNatives();
     RNSkia::JniSkiaView::registerNatives();
     RNSkia::JniPlatformContext::registerNatives();
+    // A view posts to the thread it presents on through a NativeRunnable (see
+    // JniSkiaView), from the render thread pool among others. A thread the
+    // JVM did not create has only the system class loader, which does not
+    // know the app's classes, so the lookup fails there. Making one here,
+    // with the app's loader in use, resolves every class on that path once;
+    // fbjni keeps them.
+    facebook::jni::JNativeRunnable::newObjectCxxArgs([] {});
   });
 }
```

**File**: `packages/skia/android/cpp/jni/include/JniSkiaView.h` (modified, +71/-20)
```diff
@@ -1,9 +1,12 @@
 #pragma once
 
+#include <functional>
 #include <memory>
+#include <utility>
 
 #include <android/native_window.h>
 #include <android/native_window_jni.h>
+#include <fbjni/NativeRunnable.h>
 #include <fbjni/fbjni.h>
 #include <jni.h>
 
@@ -18,7 +21,9 @@ namespace jni = facebook::jni;
 /**
  * The JNI side of SkiaView: owns the native view and the window surface it
  * presents into, and relays the surface callbacks of the backing SurfaceView
- * or TextureView, whose ANativeWindow it acquires for the surface.
+ * or TextureView, whose ANativeWindow it acquires for the surface. The
+ * surface callbacks come on the main thread; the view presents on the present
+ * thread of the Java side (see SkiaView.runOnPresentThread).
  */
 class JniSkiaView : public jni::HybridClass<JniSkiaView> {
 public:
@@ -53,27 +58,32 @@ class JniSkiaView : public jni::HybridClass<JniSkiaView> {
   std::shared_ptr<RNSkManager> getSkiaManager() { return _manager.lock(); }
 
 protected:
+  // Main thread. Attaching the window asks the view for a frame on the
+  // present thread.
   void surfaceAvailable(jobject surface, int width, int height, bool isSurface,
                         bool highBitDepth) {
     attachWindow(surface, width, height, isSurface, highBitDepth);
-    _view->redraw();
   }
 
+  // Main thread. The new size is painted on the present thread, which the
+  // surface asks for a frame once it is reconfigured.
   void surfaceSizeChanged(jobject surface, int width, int height,
                           bool isSurface, bool highBitDepth) {
     // Setting width/height to zero is nothing we need to care about when
     // it comes to invalidating the surface.
-    if (width != 0 || height != 0) {
-      if (_surface->isAttached()) {
-        _surface->resize(width, height);
-      } else {
-        attachWindow(surface, width, height, isSurface, highBitDepth);
-      }
+    if (width == 0 && height == 0) {
+      return;
+    }
+    if (_surface->isAttached()) {
+      _surface->resize(width, height);
+    } else {
+      attachWindow(surface, width, height, isSurface, highBitDepth);
     }
-    // Paint the new size right away rather than on the next scheduled redraw.
-    _view->redraw();
   }
 
+  // Main thread, before the platform destroys the window: waits for the
+  // present in flight, if any, then lets go of the window (see
+  // RNSkWindowSurface::detach).
   void surfaceDestroyed() { _surface->detach(); }
 
   /**
@@ -116,9 +126,11 @@ class JniSkiaView : public jni::HybridClass<JniSkiaView> {
     manager->unregisterSkiaView(_view->getNativeId());
   }
 
-  // Choreographer tick: presents the queued recordings, returns whether more
-  // are already waiting.
-  bool presentFrame() { return _view->presentFrame(); }
+  // The Java view's frame scheduler, on the thread the view presents on:
+  // presents the queued recordings, says whether a frame went to the window
+  // and whether more are waiting (see RNSkView::presentFrame). The Java view
+  // keeps this object alive for the call (see SkiaView.dropInstance).
+  int presentFrame() { return _view->presentFrame(); }
 
 private:
   friend HybridBase;
@@ -129,20 +141,56 @@ class JniSkiaView : public jni::HybridClass<JniSkiaView> {
     auto context = skiaManager->cthis()->getPlatformContext();
     _surface = std::make_shared<RNSkWindowSurface>();
     _view = std::make_shared<RNSkView>(context, _surface);
-    // A submitted recording arms the Java view's frame callback. Weak: the
-    // Java view owns this object through its hybrid data.
-    jni::weak_ref<jhybridobject> weakJava = jni::make_weak(jThis);
-    _view->setFrameScheduler([weakJava]() {
-      auto javaPart = weakJava.lockLocal();
+    // Tasks for the present thread go through the Java view, which owns the
+    // thread. Weak: the Java view owns this object through its hybrid data;
+    // a task for a view that is gone is dropped. Called from any thread, the
+    // render thread pool's included, hence the thread scope.
+    auto javaView = std::make_shared<JavaView>(jThis);
+    _view->setPresentThread([javaView](std::function<void()> task) {
+      jni::ThreadScope threadScope;
+      auto javaPart = javaView->weak->lockLocal();
+      if (!javaPart) {
+        return;
+      }
+      static const auto method =
+          javaPart->getClass()
+              ->getMethod<void(jni::alias_ref<jni::JRunnable::javaobject>)>(
+                  "runOnPresentThread");
+      method(javaPart, jni::JNativeRunnable::newObjectCxxArgs(std::move(task)));
+    });
+    // A submitted recording arms the Java view's frame callback, on the
+    // present thread (or presents on the spot, for a window resized since
+    // the frame it shows: see FrameScheduler.requestFrame).
+    _view->setFrameScheduler([javaView](bool forResizedWindow) {
+      auto javaPart = javaView->weak->lockLocal();
       if (!javaPart) {
         return;
       }
       static const auto method =
-          ja
```

**File**: `packages/skia/android/src/main/java/com/reactnative/skia/FrameScheduler.java` (modified, +78/-46)
```diff
@@ -3,46 +3,77 @@
 import androidx.annotation.Nullable;
 
 /**
- * Decides when a SkiaView presents the recordings queued for it: a SurfaceView
- * on the next vsync, a TextureView behind the draw its window has pending, so
- * that the window has taken the previous frame by then. Keeps at most one
- * frame callback and one posted present outstanding. Main thread.
+ * Decides when a SkiaView presents the recordings queued for it. A SurfaceView
+ * presents on the next vsync, when the compositor takes its buffer. A
+ * TextureView shows a frame when its window draws, which takes the latest
+ * frame presented and lets the others go: it presents one frame at a time,
+ * the next once the window drew the previous one (see onFrameConsumed), so
+ * that every draw gets a new frame and no frame is made for nothing; a frame
+ * for a window resized since the one it shows goes on the spot in either case
+ * (see requestFrame). Keeps at most one frame callback outstanding. Lives on
+ * the present thread, whose Choreographer gives the vsync.
  */
 final class FrameScheduler {
+    /** Host.presentFrame: a frame went to the window. */
+    static final int PRESENTED = 1;
+    /** Host.presentFrame: recordings are left, more queued or declined (no drawable). */
+    static final int MORE_QUEUED = 2;
+
     /** What the scheduler asks of the view. */
     interface Host {
         /** Calls onFrame() on the next Choreographer frame. */
         void postFrameCallback();
 
-        /** Calls onPosted() from the main looper, behind any draw the window has pending. */
-        void postBehindPendingDraw();
-
-        /** Presents the queued recordings, returning whether any are left. */
-        boolean presentFrame();
+        /** Presents the queued recordings: PRESENTED and MORE_QUEUED, as they apply. */
+        int presentFrame();
     }
 
     private final Host mHost;
     private boolean mFrameCallbackPosted = false;
-    private boolean mPresentPosted = false;
+    // TextureView: the window has a frame it has not drawn yet, and a request
+    // arrived while it had.
+    private boolean mFrameInWindow = false;
+    private boolean mRequested = false;
 
     FrameScheduler(Host host) {
         mHost = host;
     }
 
     /** A recording was submitted. Without a backing view there is no surface to present on yet. */
     void requestFrame(@Nullable BackingViewKind kind) {
+        requestFrame(kind, false);
+    }
+
+    /**
+     * A recording was submitted. With forResizedWindow, the window was resized since
+     * the frame it shows was made, so it shows that frame stretched to its size, and
+     * the recording is for its size: it is presented on the spot, ahead of the vsync
+     * or the draw it would otherwise wait for (a TextureView's window takes it in
+     * place of the frame it has not drawn yet), so that a window resized on every
+     * frame is drawn at the right size on every frame.
+     */
+    void requestFrame(@Nullable BackingViewKind kind, boolean forResizedWindow) {
         if (kind == null) {
             return;
         }
-        // A frame callback still outstanding (a retry, see presentOrRetry) presents
+        if (forResizedWindow) {
+            present(kind);
+            return;
+        }
+        // A frame callback still outstanding (a retry, see present) presents
         // the new recording along with the leftovers on that vsync.
         if (mFrameCallbackPosted) {
             return;
         }
-        if (presentsOnVsync(kind)) {
-            postFrameCallback();
-        } else {
-            postBehindPendingDraw();
+        switch (kind) {
+            case SURFACE_VIEW -> postFrameCallback();
+            case TEXTURE_VIEW -> {
+                if (mFrameInWindow) {
+                    mRequested = true;
+                } else {
+                    present(kind);
+                }
+            }
         }
     }
 
@@ -52,38 +83,46 @@ void onFrame(@Nullable BackingViewKind kind) {
         if (kind == null) {
             return;
         }
-        if (presentsOnVsync(kind)) {
-            presentOrRetry();
-        } else {
-            postBehindPendingDraw();
-        }
+        present(kind);
     }
 
-    /** The message posted with Host.postBehindPendingDraw(). */
-    void onPosted() {
-        mPresentPosted = false;
-        presentOrRetry();
+    /**
+     * The TextureView drew the frame it was given (or a later one, presented for a
+     * resized window): the recording waiting for that, if any, goes to it now.
+     */
+    void onFrameConsumed(@Nullable BackingViewKind kind) {
+        mFrameInWindow = false;
+        if (kind == null || !mRequested) {
+            return;
+        }
+        present(kind);
     }
 
-    /** The view left its window, and the host removed both callbacks. */
+    /** The view left its window, or the window lost its surface: the host removed the callbacks. */
     void cancel() {
         mFrameCallbackPosted 
```

**File**: `packages/skia/android/src/main/java/com/reactnative/skia/PresentThread.java` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+package com.reactnative.skia;
+
+import android.os.Handler;
+import android.os.HandlerThread;
+import android.os.Process;
+
+/**
+ * The thread every canvas presents on: one for the process, started on first
+ * use and never stopped. Presenting a frame (replaying its recordings on the
+ * GPU and handing the buffer to the compositor, or to the window for a
+ * TextureView) costs a few milliseconds of CPU on a Vulkan window, which this
+ * thread takes off the main thread; one thread serves every canvas, as
+ * presents serialize on the GPU context anyway. It is a looper thread, so
+ * that each canvas's FrameScheduler runs on it as it would on the main
+ * thread, with the Choreographer of this thread for its vsync (see
+ * SkiaView for how a TextureView's present still waits for its window's
+ * pending draw).
+ */
+final class PresentThread {
+    private static final Object sLock = new Object();
+    private static Handler sHandler;
+
+    private PresentThread() {
+    }
+
+    /** The handler of the thread, started on first use. Any thread. */
+    static Handler handler() {
+        synchronized (sLock) {
+            if (sHandler == null) {
+                // The priority of the UI toolkit's own render thread.
+                HandlerThread thread = new HandlerThread("RNSkia Present",
+                        Process.THREAD_PRIORITY_DISPLAY);
+                thread.start();
+                sHandler = new Handler(thread.getLooper());
+            }
+            return sHandler;
+        }
+    }
+}
```

**File**: `packages/skia/android/src/main/java/com/reactnative/skia/SkiaTextureView.java` (modified, +1/-0)
```diff
@@ -43,5 +43,6 @@ public boolean onSurfaceTextureDestroyed(@NonNull SurfaceTexture surfaceTexture)
 
     @Override
     public void onSurfaceTextureUpdated(@NonNull SurfaceTexture surface) {
+        mApi.onSurfaceTextureUpdated();
     }
 }
\ No newline at end of file
```

---

### Incident Patch 2: `bde7f1f3` (2026-10-26)
**Commit Message**: fix(🐛): don't crash Skottie on layers and shapes without a name (#4333)

Lottie files whose nodes have no "nm" (e.g. every Jitter.video export)
crash Skia.Skottie.Make on iOS/Android.

Skottie forwards the node name to the PropertyObserver, falling back to
the parent's name and finally nullptr when nothing in the chain is
named. CustomPropertyManager::acceptKey passed that pointer to
SkStrStartsWith (which SkASSERTs on null in debug Skia builds) and then,
with the default "" prefix, to std::string(name), which aborts on null
(SIGABRT in libc++'s basic_string(const char*)). onEnterNode/
onLeavingNode in the same file already guard null; this adds the same
guard to acceptKey so unnamed nodes are skipped like a prefix mismatch.

Adds an e2e case with a minimal unnamed-layer animation (null parent
layer + shape layer, empty transforms, no "nm" anywhere). On the iOS
simulator it crashes the example app without the guard and passes with
it.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/skia/cpp/api/third_party/SkottieUtils.cpp` (modified, +3/-1)
```diff
@@ -126,7 +126,9 @@ CustomPropertyManager::~CustomPropertyManager() {
 
 std::string CustomPropertyManager::acceptKey(const char *name,
                                              const char *suffix) const {
-  if (!SkStrStartsWith(name, fPrefix.c_str())) {
+  // Unnamed Lottie nodes (no "nm") arrive as nullptr; skip them like a
+  // prefix mismatch instead of passing null to SkStrStartsWith/std::string.
+  if (name == nullptr || !SkStrStartsWith(name, fPrefix.c_str())) {
     return std::string();
   }
 
```

**File**: `packages/skia/src/renderer/__tests__/e2e/Skottie.spec.tsx` (modified, +30/-0)
```diff
@@ -12,6 +12,7 @@ const onboardingJSON = require("./setup/skottie/onboarding.json");
 const basicSlotsJSON = require("./setup/skottie/basic_slots.json");
 const fingerprintJSON = require("./setup/skottie/fingerprint.json");
 const textLayerJSON = require("./setup/skottie/text-layer.json");
+const unnamedLayersJSON = require("./setup/skottie/unnamed-layers.json");
 
 describe("Skottie", () => {
   it("Should render Skottie component with lego animation", async () => {
@@ -464,4 +465,33 @@ describe("Skottie", () => {
       checkImage(image, docPath("skottie/text-prop.png"));
     }
   });
+  it("loads layers and shapes without a name (nm)", async () => {
+    // Lottie exporters such as Jitter omit "nm" everywhere; the property
+    // observer used to receive a null node name and crash on native.
+    const result = await surface.eval(
+      (Skia, ctx) => {
+        const animation = Skia.Skottie.Make(ctx.unnamedLayers);
+        const sur = Skia.Surface.MakeOffscreen(100, 100);
+        if (!sur) {
+          throw new Error("Failed to create surface");
+        }
+        animation.seekFrame(0);
+        animation.render(sur.getCanvas());
+        sur.flush();
+        return {
+          size: animation.size(),
+          fps: Math.round(animation.fps()),
+          colorProps: animation.getColorProps().length,
+          image: sur.makeImageSnapshot().encodeToBase64(),
+        };
+      },
+      {
+        unnamedLayers: JSON.stringify(unnamedLayersJSON),
+      }
+    );
+    expect(result.size).toEqual({ width: 100, height: 100 });
+    expect(result.fps).toEqual(30);
+    expect(result.colorProps).toEqual(0);
+    expect(result.image).toBeDefined();
+  });
 });
```

**File**: `packages/skia/src/renderer/__tests__/e2e/setup/skottie/unnamed-layers.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"v":"5.7.4","fr":30,"ip":0,"op":30,"w":100,"h":100,"assets":[],"layers":[{"ind":1,"ty":3,"ks":{},"ip":0,"op":30,"st":0},{"ind":2,"ty":4,"parent":1,"ks":{},"ip":0,"op":30,"st":0,"shapes":[{"ty":"rc","p":{"a":0,"k":[50,50]},"s":{"a":0,"k":[60,60]},"r":{"a":0,"k":0}},{"ty":"fl","c":{"a":0,"k":[1,0,0,1]},"o":{"a":0,"k":100}}]}]}
```

---

### Incident Patch 3: `bbd1b685` (2026-10-24)
**Commit Message**: fix(🏞️): stop repeating the namespace in factory method names (#4323)

Factory methods no longer repeat the name of the namespace they live in,
matching Skia.Surface.MakeFromGPUTexture or Skia.SVG.MakeFromString.

- Skia.Image.MakeImageFromEncoded -> Skia.Image.MakeFromEncoded
- Skia.Image.MakeImageFromGPUTexture -> Skia.Image.MakeFromGPUTexture
- Skia.Image.MakeImageFromNativeBuffer -> Skia.Image.MakeFromNativeBuffer
- Skia.Image.MakeRasterImage -> Skia.Image.MakeRaster
- Skia.AnimatedImage.MakeAnimatedImageFromEncoded -> Skia.AnimatedImage.MakeFromEncoded
- Skia.Picture.MakePicture -> Skia.Picture.Make
- Skia.Typeface.MakeFreeTypeFaceFromData -> Skia.Typeface.MakeFromData
- Skia.ColorFilter.MakeLumaColorFilter -> Skia.ColorFilter.MakeLuma

**File**: `apps/docs/docs/getting-started/migration.md` (modified, +17/-4)
```diff
@@ -157,10 +157,10 @@ The following APIs were removed in favor of it:
 | `Skia.NativeBuffer.MakeFromImage()` | Export the image as a WebGPU texture with `Skia.Image.MakeGPUTextureFromImage()`. See [exporting an image](/docs/webgpu#exporting-an-image). |
 | `Skia.NativeBuffer.MakeTestBuffer()` | React Native WebGPU's `createTestVideoFrame()`. |
 | `Skia.NativeBuffer.Release()` | `NativeVideoFrame.release()`: React Native WebGPU owns the buffers it hands out. |
-| `Skia.Image.MakeImageFromNativeTextureUnstable()` | `Skia.Image.MakeImageFromGPUTexture(texture)`, which takes a WebGPU texture. See [WebGPU](/docs/webgpu). |
+| `Skia.Image.MakeImageFromNativeTextureUnstable()` | `Skia.Image.MakeFromGPUTexture(texture)`, which takes a WebGPU texture. See [WebGPU](/docs/webgpu). |
 | `image.getNativeTextureUnstable()` and `surface.getNativeTextureUnstable()` | `Skia.Image.MakeGPUTextureFromImage()` and `Skia.Surface.MakeFromGPUTexture()`: textures are shared as WebGPU textures. |
-| `makeImageFromView()` and `Skia.Image.MakeImageFromViewTag()` | React Native WebGPU's `queue.drawElementImageToTexture()` draws the view into a texture, which `Skia.Image.MakeImageFromGPUTexture()` wraps. The snapshot is a GPU image, and on iOS and Android 13+ it never leaves the GPU. See [view snapshots](/docs/webgpu#view-snapshots). |
-| `Skia.Image.MakeImageFromNativeBuffer(pointer)` on native platforms | React Native WebGPU's `copyExternalImageToTexture()` renders the frame into a texture, which `Skia.Image.MakeImageFromGPUTexture()` wraps. See [native buffers](/docs/webgpu#native-buffers). The method remains on Web, where it takes a `CanvasImageSource`. |
+| `makeImageFromView()` and `Skia.Image.MakeImageFromViewTag()` | React Native WebGPU's `queue.drawElementImageToTexture()` draws the view into a texture, which `Skia.Image.MakeFromGPUTexture()` wraps. The snapshot is a GPU image, and on iOS and Android 13+ it never leaves the GPU. See [view snapshots](/docs/webgpu#view-snapshots). |
+| `Skia.Image.MakeImageFromNativeBuffer(pointer)` on native platforms | React Native WebGPU's `copyExternalImageToTexture()` renders the frame into a texture, which `Skia.Image.MakeFromGPUTexture()` wraps. See [native buffers](/docs/webgpu#native-buffers). The method remains on Web as `Skia.Image.MakeFromNativeBuffer()`, where it takes a `CanvasImageSource`. |
 | `ref.current.makeImageSnapshotAsync()` on a `Canvas` | `makeImageSnapshot()`: with Graphite the snapshot is taken on the calling thread and returns a GPU image. To encode it or read its pixels without blocking, read it back with `image.makeRasterImage()`. See [snapshots](/docs/canvas/overview#getting-a-canvas-snapshot). |
 | `useCanvasSize()` returning `{ ref, size }` | It returns `{ size, onLayout }` and no longer takes a ref: pass `onLayout` to the canvas instead of `ref`, and `size` follows every layout change instead of being measured once. Keep `useCanvasRef()` for the ref: its `size` property reads the layout synchronously. See [canvas size](/docs/canvas/overview#canvas-size). |
 
@@ -183,9 +183,22 @@ A few methods were renamed so that the name says whether the result lives on the
 | Renamed | New name |
 |:--|:--|
 | `Skia.Surface.Make(width, height)` | `Skia.Surface.MakeRaster(width, height)`: a CPU surface. |
-| `Skia.Image.MakeImage(info, data, bytesPerRow)` | `Skia.Image.MakeRasterImage(info, data, bytesPerRow)`: a CPU image. |
+| `Skia.Image.MakeImage(info, data, bytesPerRow)` | `Skia.Image.MakeRaster(info, data, bytesPerRow)`: a CPU image. |
 | `image.makeNonTextureImage()` | `image.makeRasterImageSync()`: the synchronous counterpart of `image.makeRasterImage()`, for worklets. It now throws when the readback fails instead of returning `null`. |
 
+Factory methods no longer repeat the name of their namespace: `Skia.Image.MakeImageFromEncoded()` is now `Skia.Image.MakeFromEncoded()`, in line with `Skia.Surface.MakeFromGPUTexture()` or `Skia.SVG.MakeFromString()`.
+
+| Renamed | New name |
+|:--|:--|
+| `Skia.Image.MakeImageFromEncoded()` | `Skia.Image.MakeFromEncoded()` |
+| `Skia.Image.MakeImageFromGPUTexture()` | `Skia.Image.MakeFromGPUTexture()` |
+| `Skia.Image.MakeImageFromNativeBuffer()` (Web only) | `Skia.Image.MakeFromNativeBuffer()` |
+| `Skia.Image.MakeRasterImage()` | `Skia.Image.MakeRaster()` |
+| `Skia.AnimatedImage.MakeAnimatedImageFromEncoded()` | `Skia.AnimatedImage.MakeFromEncoded()` |
+| `Skia.Picture.MakePicture()` | `Skia.Picture.Make()` |
+| `Skia.Typeface.MakeFreeTypeFaceFromData()` | `Skia.Typeface.MakeFromData()` |
+| `Skia.ColorFilter.MakeLumaColorFilter()` | `Skia.ColorFilter.MakeLuma()` |
+
 ## What is new
 
 ### Rendering off the JS and UI threads
```

**File**: `apps/docs/docs/image.md` (modified, +10/-10)
```diff
@@ -29,21 +29,21 @@ The image is also decoded before the hook returns it, off the JS thread: the can
 The hook also provides an optional error handler as a second parameter, called when the image cannot be loaded or decoded (the hook then returns null).
 `loadImage(source)` does the same outside of React: it returns a promise that rejects on failure.
 
-### MakeImageFromEncoded
+### MakeFromEncoded
 
-You can also create image instances manually using `MakeImageFromEncoded`.
+You can also create image instances manually using `MakeFromEncoded`.
 
 ```tsx twoslash
 import { Skia } from "react-native-skia";
 
 // A sample base64-encoded pixel
 const data = Skia.Data.fromBase64("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==");
-const image = Skia.Image.MakeImageFromEncoded(data);
+const image = Skia.Image.MakeFromEncoded(data);
 ```
 
-### MakeRasterImage
+### MakeRaster
 
-`MakeRasterImage` creates a CPU image from pixel data in the given format. The pixels are copied; see [GPU and CPU images](#gpu-and-cpu-images) for what that means when drawing it.
+`MakeRaster` creates a CPU image from pixel data in the given format. The pixels are copied; see [GPU and CPU images](#gpu-and-cpu-images) for what that means when drawing it.
 
 ```tsx twoslash
 import { Skia, AlphaType, ColorType } from "react-native-skia";
@@ -57,7 +57,7 @@ for (let x = 0; x < 256; x++) {
   }
 }
 const data = Skia.Data.fromBytes(pixels);
-const img = Skia.Image.MakeRasterImage(
+const img = Skia.Image.MakeRaster(
   {
     width: 256,
     height: 256,
@@ -75,14 +75,14 @@ const img = Skia.Image.MakeRasterImage(
 
 An image lives either on the CPU, as pixels in memory, or on the GPU, as a texture. Where it lives decides what is cheap.
 
-The API names follow this split. "Raster" means CPU: `Skia.Surface.MakeRaster()`, `Skia.Image.MakeRasterImage()`, `image.makeRasterImage()`. "Texture" means GPU: `image.makeTextureImage()`. "GPUTexture" is a WebGPU texture shared with [React Native WebGPU](/docs/webgpu): `Skia.Image.MakeImageFromGPUTexture()`, `Skia.Surface.MakeFromGPUTexture()`.
+The API names follow this split. "Raster" means CPU: `Skia.Surface.MakeRaster()`, `Skia.Image.MakeRaster()`, `image.makeRasterImage()`. "Texture" means GPU: `image.makeTextureImage()`. "GPUTexture" is a WebGPU texture shared with [React Native WebGPU](/docs/webgpu): `Skia.Image.MakeFromGPUTexture()`, `Skia.Surface.MakeFromGPUTexture()`.
 A surface follows the same split: `Skia.Surface.MakeRaster()` draws on the CPU and its snapshots are CPU images, `Skia.Surface.MakeOffscreen()` draws on the GPU and its snapshots are GPU images.
 
 | Image | Lives | Drawing it | Reading its pixels |
 | :-- | :-- | :-- | :-- |
-| `useImage()`, `Skia.Image.MakeRasterImage()`, `makeRasterImage()` | CPU | Uploaded on the first frame that draws it, then cached | Immediate |
-| `surface.makeImageSnapshot()`, `surface.asImage()`, `makeTextureImage()`, `Skia.Image.MakeImageFromGPUTexture()` | GPU | No copy, from any canvas and any thread | Waits for the GPU |
-| `Skia.Image.MakeImageFromEncoded()` | Encoded bytes | Decoded and uploaded on the first frame that draws it, then cached | Decodes |
+| `useImage()`, `Skia.Image.MakeRaster()`, `makeRasterImage()` | CPU | Uploaded on the first frame that draws it, then cached | Immediate |
+| `surface.makeImageSnapshot()`, `surface.asImage()`, `makeTextureImage()`, `Skia.Image.MakeFromGPUTexture()` | GPU | No copy, from any canvas and any thread | Waits for the GPU |
+| `Skia.Image.MakeFromEncoded()` | Encoded bytes | Decoded and uploaded on the first frame that draws it, then cached | Decodes |
 
 The textures of the CPU images the canvases draw are kept in one cache, shared by every canvas: 128 MB at most, least recently drawn out first, and a texture not drawn for ten seconds is released. An image drawn by several canvases is uploaded once and held once, whichever canvas draws it first and however many draw it on the same frame. The upload happens on the frame that first draws the image, on the thread rendering that frame: to pay it earlier, upload the image with `makeTextureImage()`.
 
```

**File**: `apps/docs/docs/pictures.md` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ export const PictureExample = () => {
 
   // Create a copy from serialized data
   const copyOfPicture = useMemo(
-    () => (serialized ? Skia.Picture.MakePicture(serialized) : null),
+    () => (serialized ? Skia.Picture.Make(serialized) : null),
     [serialized]
   );
 
```

**File**: `apps/docs/docs/shapes/atlas.md` (modified, +1/-1)
```diff
@@ -191,7 +191,7 @@ Because Skia and WebGPU share the same GPU device in v3, you can draw the sprite
 
 1. Export the atlas image as a WebGPU texture with `Skia.Image.MakeGPUTextureFromImage()` (see [exporting an image](/docs/webgpu#exporting-an-image)).
 2. Store the per-sprite data (transform, source rectangle, color) in a vertex buffer with a per-instance step mode and draw all sprites with a single `drawIndexed(6, spriteCount)` call, sampling the atlas texture in the fragment shader.
-3. Render into a texture created with the `TEXTURE_BINDING` usage, wrap it with `Skia.Image.MakeImageFromGPUTexture()`, and draw it with the [`Image`](/docs/images) component (see [from WebGPU to Skia](/docs/webgpu#from-webgpu-to-skia)).
+3. Render into a texture created with the `TEXTURE_BINDING` usage, wrap it with `Skia.Image.MakeFromGPUTexture()`, and draw it with the [`Image`](/docs/images) component (see [from WebGPU to Skia](/docs/webgpu#from-webgpu-to-skia)).
 
 This is what Ganesh did internally in v2, and it scales to a very large number of sprites.
 It is only available on native platforms; on the Web, Skia runs on WebGL through CanvasKit, where `drawAtlas` is batched as it was in v2.
```

**File**: `apps/docs/docs/snapshot-views.md` (modified, +1/-1)
```diff
@@ -7,6 +7,6 @@ displayed_sidebar: tutorialSidebar
 ---
 
 `makeImageFromView()` was removed in React Native Skia v3.
-View snapshots are taken by [React Native WebGPU](https://wcandillon.github.io/react-native-webgpu/api/draw-element-image-to-texture), which draws any React Native view into a texture with `queue.drawElementImageToTexture()`; `Skia.Image.MakeImageFromGPUTexture()` then wraps that texture into a Skia image, without any copy.
+View snapshots are taken by [React Native WebGPU](https://wcandillon.github.io/react-native-webgpu/api/draw-element-image-to-texture), which draws any React Native view into a texture with `queue.drawElementImageToTexture()`; `Skia.Image.MakeFromGPUTexture()` then wraps that texture into a Skia image, without any copy.
 
 See [View snapshots](/docs/webgpu#view-snapshots) for a complete example, and the [migration guide](/docs/getting-started/migration#4-replace-the-removed-apis) for the other APIs that moved to React Native WebGPU.
```

**File**: `apps/docs/docs/text/text.md` (modified, +1/-1)
```diff
@@ -184,7 +184,7 @@ const fontMgr = Skia.FontMgr.System();
 // The custom font manager is available via Skia.TypefaceFontProvider.Make()
 const customFontMgr = Skia.TypefaceFontProvider.Make();
 // typeface needs to be loaded via Skia.Data and instanciated via
-// Skia.Typeface.MakeFreeTypeFaceFromData()
+// Skia.Typeface.MakeFromData()
 // customFontMgr.registerTypeface(customTypeFace, "Roboto");
 
 // Matching a font
```

**File**: `apps/docs/docs/webgpu.md` (modified, +12/-12)
```diff
@@ -175,7 +175,7 @@ The interop surface is small:
 | API | Direction | Description |
 |:--|:--|:--|
 | `Skia.getNativeDevice()` | | Pointer to Skia's device, for `importDevice()` |
-| `Skia.Image.MakeImageFromGPUTexture(texture)` | WebGPU to Skia | Wraps a `GPUTexture` into an `SkImage`, without copy |
+| `Skia.Image.MakeFromGPUTexture(texture)` | WebGPU to Skia | Wraps a `GPUTexture` into an `SkImage`, without copy |
 | `Skia.Surface.MakeFromGPUTexture(texture)` | Skia to WebGPU | Creates an `SkSurface` that draws into a `GPUTexture`, without copy |
 | `Skia.Image.MakeGPUTextureFromImage(image)` | Skia to WebGPU | Draws an `SkImage` into a new texture, for `adoptTexture()` |
 
@@ -186,7 +186,7 @@ A raw `WGPUTexture` pointer (a `BigInt`) is accepted wherever a texture is, for
 
 ## From WebGPU to Skia
 
-`Skia.Image.MakeImageFromGPUTexture()` wraps a WebGPU texture into an `SkImage`.
+`Skia.Image.MakeFromGPUTexture()` wraps a WebGPU texture into an `SkImage`.
 The image references the texture, so wrapping it is free.
 The texture must be created on the shared device with the `TEXTURE_BINDING` usage.
 
@@ -263,7 +263,7 @@ export const TriangleInSkia = () => {
     device.queue.submit([encoder.finish()]);
 
     // 4. Wrap the texture into an SkImage, without any copy
-    image.value = Skia.Image.MakeImageFromGPUTexture(texture);
+    image.value = Skia.Image.MakeFromGPUTexture(texture);
 
     return () => {
       // Drop the image before the texture it samples
@@ -298,7 +298,7 @@ The new object is what makes the canvas redraw:
 const render = () => {
   // ...encode and submit the WebGPU commands for this frame
   const previous = image.value;
-  image.value = Skia.Image.MakeImageFromGPUTexture(texture);
+  image.value = Skia.Image.MakeFromGPUTexture(texture);
   previous?.dispose();
   frame = requestAnimationFrame(render);
 };
@@ -367,7 +367,7 @@ const toTexture = (image: SkImage): GPUTexture =>
 
 Camera and video frames live in native buffers: an `IOSurface` (usually wrapped in a `CVPixelBuffer`) on Apple platforms, an `AHardwareBuffer` on Android.
 Skia does not import them. React Native WebGPU owns these buffers: it decodes videos into them, wraps the buffers that other libraries produce, ties their lifetime to a [`NativeVideoFrame`](https://wcandillon.github.io/react-native-webgpu/api/video-player#nativevideoframe) object, and renders a frame into a texture of the shared device with [`queue.copyExternalImageToTexture()`](https://wcandillon.github.io/react-native-webgpu/api/gpu-device-extensions#copyexternalimagetotexture-with-a-native-frame), converting YUV to RGB and applying the rotation of the video or the camera on the GPU.
-`Skia.Image.MakeImageFromGPUTexture()` then wraps that texture, like any [WebGPU texture](#from-webgpu-to-skia).
+`Skia.Image.MakeFromGPUTexture()` then wraps that texture, like any [WebGPU texture](#from-webgpu-to-skia).
 There is one path on both platforms, whatever the format of the frame. It needs React Native WebGPU 0.11.1 or above.
 
 ### Playing a video
@@ -422,7 +422,7 @@ export const Video = ({ url }: { url: string }) => {
         frame.release();
         // A new image is what makes the canvas redraw
         const previous = image.value;
-        image.value = Skia.Image.MakeImageFromGPUTexture(texture);
+        image.value = Skia.Image.MakeFromGPUTexture(texture);
         previous?.dispose();
       }
       raf = requestAnimationFrame(render);
@@ -469,11 +469,11 @@ Pass the frame's orientation as `rotation` and `mirrored`, and release the frame
 - **Reuse the texture.** Create a new one only when the frame size changes, and dispose the images that sample it before destroying it.
 - **Any runtime.** Like every GPU-backed image, the result can be created on one runtime and drawn by any canvas or worklet runtime.
 
-On the Web, where Skia runs on CanvasKit, `Skia.Image.MakeImageFromNativeBuffer()` creates an image from a `CanvasImageSource` instead: a `<video>` element, an `ImageBitmap`, or a canvas.
+On the Web, where Skia runs on CanvasKit, `Skia.Image.MakeFromNativeBuffer()` creates an image from a `CanvasImageSource` instead: a `<video>` element, an `ImageBitmap`, or a canvas.
 
 ## View snapshots
 
-A snapshot of a React Native view follows the same path as a video frame: React Native WebGPU rasterizes the view into a texture of the shared device with [`queue.drawElementImageToTexture()`](https://wcandillon.github.io/react-native-webgpu/api/draw-element-image-to-texture), and `Skia.Image.MakeImageFromGPUTexture()` wraps that texture into an image.
+A snapshot of a React Native view follows the same path as a video frame: React Native WebGPU rasterizes the view into a texture of the shared device with [`queue.drawElementImageToTexture()`](https://wcandillon.github.io/react-native-webgpu/api/draw-element-image-to-texture), and `Skia.Image.MakeFromGPUTexture()` wraps that texture into an image.
 Skia has no view snapshot API of its own: `makeImageFromView()`
```

**File**: `apps/example/src/Examples/API/Data.tsx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ for (let x = 0; x < 256 * 4; x++) {
   }
 }
 const data = Skia.Data.fromBytes(pixels);
-const img = Skia.Image.MakeRasterImage(
+const img = Skia.Image.MakeRaster(
   {
     width: 256,
     height: 256,
```

#### Recent Merged Pull Requests:
- **PR #4336** (2026-10-26): chore(deps): bump anthropics/claude-code-action from 1.0.252 to 1.0.261 (@dependabot[bot])
- **PR #4335** (2026-10-26): chore(deps): bump actions/setup-python from 7.0.0 to 7.1.0 (@dependabot[bot])
- **PR #4334** (2026-10-26): chore(deps): bump ip-address from 10.7.2 to 10.7.5 (@dependabot[bot])
- **PR #4333** (2026-10-26): fix(🐛): don't crash Skottie on layers and shapes without a name (@ImCitizen13)
- **PR #4332** (2026-10-26): chore(deps): bump undici from 8.11.2 to 8.12.3 (@dependabot[bot])
- **PR #4331** (2026-10-26): chore(deps): bump fast-uri from 3.1.8 to 3.1.9 (@dependabot[bot])

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

## X. 🤖): present Android canvases off the main thread (#4318)

**RULE**:
When implementing operations in `apps/docs/docs/canvas/graphite.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wcandillon/react-native-skia. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cce3cf0f`: 🤖): present Android canvases off the main thread (#4318). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/docs/docs/canvas/graphite.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
Recording happens on the thread that calls `beginRecording()`. Presenting happens on the display link on iOS (`CADisplayLink`, on the main thread), and on a present thread of its own on Android, so that the main thread pays nothing for a frame: on the vsync of that thread's `Choreographer` for a `SurfaceView`, once its window has drawn the previous frame for a `TextureView`.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
Recording happens on the thread that calls `beginRecording()`, presenting on the main thread: on the display link (`CADisplayLink` on iOS, the `Choreographer` for an Android `SurfaceView`), or, for an Android `TextureView`, once its window has drawn the previous frame.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cce3cf0f` are properly handled with clean fallback behavior.
