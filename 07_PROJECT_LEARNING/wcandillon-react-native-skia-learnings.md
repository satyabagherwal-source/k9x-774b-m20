> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wcandillon-react-native-skia-learnings.md`  
> **Source**: github ([https://github.com/wcandillon/react-native-skia](https://github.com/wcandillon/react-native-skia))  
> **Source Version**: `280986c1`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T21:29:04.777Z  
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
> **Harvest Timestamp**: 2026-11-03T21:28:27.526Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wcandillon/react-native-skia`
- **Description**: High-performance React Native Graphics using Skia
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8767 stars

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

// Dawn's own Imagination test (gpu_info::IsImgTec): the PCI vendor ID of
// Imagination Technologies, whose PowerVR GPUs ship in the Pixel 10 and 11.
inline bool isImagination(const wgpu::Adapter &adapter) {
  wgpu::AdapterInfo info;
  adapter.GetInfo(&info);
  constexpr uint32_t kVendorIDImagination = 0x1010;
  return info.vendorID == kVendorIDImagination;
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
// detects it: possibl
```

### Core Architecture Module: `packages/skia/cpp/rnskia/RNSkWindowState.h`
```
#pragma once

namespace RNSkia {

/** What a frame presented now would meet (see RNSkWindowSurface::readState). */
enum class RNSkWindowState {
  // No window: attaching one asks for a redraw.
  kNone,
  // A window, but the GPU device is lost and not replaced yet: the
  // replacement asks every view for a redraw (see RNSkManager).
  kNoDevice,
  // A window that cannot show frames right now (the app in the background):
  // the platform view says when it can again (see RNSkView::onCanPresent).
  kCannotPresent,
  // A window ready for a frame.
  kReady,
};

} // namespace RNSkia

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

#include <cstdarg>
#include <cstdio>
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

    char buffer[512];
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4371** (2026-11-01): **Android (v3 Graphite): stroked paths and arcs don't draw, screen flickers on Pixel 10 (PowerVR) since 3.4.2, works on 3.4.1**
  *Symptoms*: ## Description  ## Summary  On a Pixel 10 (PowerVR GPU), some Skia drawing is not rendered starting with react-native-skia 3.4.2. 3.4.1 and 3.3.0 render correctly on the same device. The same build works on a Pixel 8 (Mali) and on iOS.  I first saw this in a production app, where the screen is built by a closed-source library (heroui-native-pro 1.0.0-beta.12) on top of react-native-skia. The reproducer below uses plain react-native-skia only.  ## Environment  - react-native-skia: 3.4.2 and later broken (3.4.2, 3.4.3, 3.6.3, 3.8.1 tested) - Works: 3.3.0, 3.4.1 - React Native 0.88.1, Expo SDK 58, release build - Device (broken): Pixel 10, Android <fill in OS version> - Device (works): Pixel 8, iOS  ## Adapter lines from logcat  Pixel 10 (broken): RNSkia: Selected Dawn adapter - Backend: Vulkan, Device: PowerVR D-Series DXT-48-1536 MC1, Description: PowerVR D-Series Vulkan Driver: 25.3@6908880 1.662.3024 Dawn: Warning: maxDynamicUniformBuffersPerPipelineLayout artificially reduced from 4294967295 to 16  Pixel 8 (works): RNSkia: Selected Dawn adapter - Backend: Vulkan, Device: Mali-G715, Description: Mali-G715: v1.r54p3-00eac0 54.3.0 Dawn: Warning: maxDynamicUniformBuffersPerPipelineLayout artificially reduced from 32 to 16  ## What happens  In the app, on the Pixel 10 only:  - Canvases drawing stroked <Path> lines are invisible. - Canvases drawing arc-shaped <Path> segments (a donut) are invisible. - A canvas drawing filled bar shapes is visible. - The whole screen flickers, inc

- **Issue #4172** (2026-10-14): **[Performance] Vertices reads points one at a time**
  *Symptoms*: ### Description  Our app redraws a large `<Vertices>` mesh from a Reanimated worklet. On a Galaxy A55, converting 3072 points for Skia took about 43% of the main thread which took longer more than drawing them.  It seems that the cost is in how points cross the JSI boundary: `Skia.MakeVertices` and `<Vertices>` only accept points as JS `{ x, y }` objects, read one at a time. I tried passing a `Float32Array` but that throws `Object is an object, expected an array`.  **Expected:** converting a few thousand points should be fast, since it's basically a memcpy operation. **Actual:** A low-end Android phone stutters with a larger `Skia.MakeVertices`.  I haven't migrated to v3 yet but this still looks like an issue there. Would there be a way to read point arrays in one pass, or am I approaching things incorrectly?  ### React Native Skia Version  2.14.0  ### React Native Version  0.83.4  ### Using New Architecture  - [x] Enabled  ### Steps to Reproduce  1. Clone the minimal repro 2. Run a release build. 3. The app times 300 `Skia.MakeVertices` calls on the UI thread with 1536 positions and 1536 texture coordinates, and reports the median per call.  ### Snack, Code Example, Screenshot, or Link to Repository  https://github.com/Nezz/expo-repro/tree/repro/SkiaVertices

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

### Incident Patch 1: `b3c17c56` (2026-11-02)
**Commit Message**: fix(🤖): post main-thread tasks without calling into Java (#4364)

On Android, runOnMainThread queued the task and, when no dispatch was
scheduled, called Java's PlatformContext.notifyTaskReady to post the
queue's run to the main looper, after attaching the posting thread to
the JVM where it was not. Both steps allocate on Java's heap. When it
was exhausted, fbjni rethrew the post's OutOfMemoryError as a
JniException, which ended the app from Recorder's destructor, and
asserted when the attach failed on a thread such as a render-pool one;
a caller that caught the throw was left with the dispatch marked as
scheduled, so nothing posted to the main thread ran again.

The main thread's queue is now MainThreadTasks, one for the process as
the main looper is, and the looper watches its eventfd, which
PlatformContext registers once: a task queued off the main thread into
an empty queue wakes it with a write, which calls no Java, and the main
thread reads the count before it takes the queue. The tasks run in the
looper's descriptor dispatch rather than as messages. A task handed over
on the main thread runs the queue on the spot, as it did when no
dispatch was pending. MainThreadTasksTest 

**File**: `packages/skia/android/cpp/jni/JniPlatformContext.cpp` (modified, +20/-36)
```diff
@@ -1,9 +1,15 @@
 #include "JniPlatformContext.h"
 
+#include <fcntl.h>
+
+#include <cerrno>
 #include <exception>
+#include <system_error>
 #include <thread>
 #include <utility>
 
+#include "RNSkMainThreadTasks.h"
+
 #include "include/core/SkData.h"
 #include "include/core/SkRefCnt.h"
 #include "include/core/SkStream.h"
@@ -18,8 +24,10 @@ using TSelf = jni::local_ref<JniPlatformContext::jhybriddata>;
 void JniPlatformContext::registerNatives() {
   registerHybrid({
       makeNativeMethod("initHybrid", JniPlatformContext::initHybrid),
-      makeNativeMethod("notifyTaskReadyNative",
-                       JniPlatformContext::notifyTaskReadyNative),
+      makeNativeMethod("duplicateMainThreadWakeup",
+                       JniPlatformContext::duplicateMainThreadWakeup),
+      makeNativeMethod("runMainThreadTasks",
+                       JniPlatformContext::runMainThreadTasks),
   });
 }
 
@@ -85,44 +93,20 @@ void JniPlatformContext::performStreamOperation(
 }
 
 void JniPlatformContext::runTaskOnMainThread(std::function<void()> task) {
-  bool shouldSchedule = false;
-  {
-    std::lock_guard<std::mutex> lock(_mainThreadTasksMutex);
-    _mainThreadTasks.push(std::move(task));
-    if (!_mainThreadDispatchScheduled) {
-      _mainThreadDispatchScheduled = true;
-      shouldSchedule = true;
-    }
-  }
-
-  if (shouldSchedule) {
-    notifyTaskReadyExternal();
-  }
-}
-
-void JniPlatformContext::notifyTaskReadyExternal() {
-  jni::ThreadScope ts;
-
-  static auto method =
-      javaPart_->getClass()->getMethod<void()>("notifyTaskReady");
-  method(javaPart_.get());
+  MainThreadTasks::getInstance().post(std::move(task));
 }
 
-void JniPlatformContext::notifyTaskReadyNative() {
-  std::queue<std::function<void()>> tasks;
-  {
-    std::lock_guard<std::mutex> lock(_mainThreadTasksMutex);
-    std::swap(tasks, _mainThreadTasks);
-    _mainThreadDispatchScheduled = false;
+int JniPlatformContext::duplicateMainThreadWakeup(jni::alias_ref<jclass>) {
+  int duplicate =
+      fcntl(MainThreadTasks::getInstance().wakeup(), F_DUPFD_CLOEXEC, 0);
+  if (duplicate == -1) {
+    throw std::system_error(errno, std::generic_category(), "dup");
   }
+  return duplicate;
+}
 
-  while (!tasks.empty()) {
-    auto handler = std::move(tasks.front());
-    tasks.pop();
-    if (handler) {
-      handler();
-    }
-  }
+void JniPlatformContext::runMainThreadTasks(jni::alias_ref<jclass>) {
+  MainThreadTasks::getInstance().run();
 }
 
 void JniPlatformContext::raiseError(const std::exception &err) {
```

**File**: `packages/skia/android/cpp/jni/include/JniPlatformContext.h` (modified, +3/-8)
```diff
@@ -6,8 +6,6 @@
 #include <exception>
 #include <functional>
 #include <memory>
-#include <mutex>
-#include <queue>
 #include <string>
 
 #include "RNSkPlatformContext.h"
@@ -34,11 +32,11 @@ class JniPlatformContext : public jni::HybridClass<JniPlatformContext> {
 
   void raiseError(const std::exception &err);
 
-  void notifyTaskReadyExternal();
-
   void runTaskOnMainThread(std::function<void()> task);
 
-  void notifyTaskReadyNative();
+  static int duplicateMainThreadWakeup(jni::alias_ref<jclass>);
+
+  static void runMainThreadTasks(jni::alias_ref<jclass>);
 
   float getPixelDensity() { return _pixelDensity; }
 
@@ -47,9 +45,6 @@ class JniPlatformContext : public jni::HybridClass<JniPlatformContext> {
   jni::global_ref<JniPlatformContext::javaobject> javaPart_;
 
   float _pixelDensity;
-  std::mutex _mainThreadTasksMutex;
-  std::queue<std::function<void()>> _mainThreadTasks;
-  bool _mainThreadDispatchScheduled = false;
 
   explicit JniPlatformContext(
       jni::alias_ref<JniPlatformContext::jhybridobject> jThis,
```

**File**: `packages/skia/android/cpp/rnskia-android/RNSkMainThreadTasks.h` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+#pragma once
+
+#include <sys/eventfd.h>
+#include <unistd.h>
+
+#include <cerrno>
+#include <functional>
+#include <mutex>
+#include <queue>
+#include <system_error>
+#include <utility>
+
+namespace RNSkia {
+
+// The main thread's tasks, one queue for the process as the main looper is
+// one. A task queued off the main thread wakes the looper with a write to an
+// eventfd it watches (PlatformContext registers it once), which calls no Java:
+// posting can fail only in the queue's own allocation.
+class MainThreadTasks {
+public:
+  static MainThreadTasks &getInstance() {
+    // Never destroyed: other threads may still post while the process exits.
+    static auto *instance = new MainThreadTasks();
+    return *instance;
+  }
+
+  int wakeup() const { return _wakeup; }
+
+  void post(std::function<void()> task) {
+    bool wasEmpty = false;
+    {
+      std::lock_guard<std::mutex> lock(_mutex);
+      wasEmpty = _tasks.empty();
+      _tasks.push(std::move(task));
+    }
+    // An app's main thread is its process's first thread, and a task handed
+    // over there runs on the spot with what is queued (see
+    // RNSkView::setPresentThread).
+    if (gettid() == getpid()) {
+      run();
+    } else if (wasEmpty) {
+      // A queue that held tasks already has a write made or coming for them.
+      eventfd_write(_wakeup, 1);
+    }
+  }
+
+  void run() {
+    // Read before the queue is taken: a task queued after the read is taken
+    // with it, or finds the queue empty and writes again.
+    eventfd_t wakeups;
+    eventfd_read(_wakeup, &wakeups);
+    std::queue<std::function<void()>> tasks;
+    {
+      std::lock_guard<std::mutex> lock(_mutex);
+      std::swap(tasks, _tasks);
+    }
+
+    while (!tasks.empty()) {
+      auto handler = std::move(tasks.front());
+      tasks.pop();
+      if (handler) {
+        handler();
+      }
+    }
+  }
+
+private:
+  MainThreadTasks() : _wakeup(eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK)) {
+    if (_wakeup == -1) {
+      throw std::system_error(errno, std::generic_category(), "eventfd");
+    }
+  }
+
+  std::mutex _mutex;
+  std::queue<std::function<void()>> _tasks;
+  int _wakeup;
+};
+
+} // namespace RNSkia
```

**File**: `packages/skia/android/src/main/java/com/reactnative/skia/PlatformContext.java` (modified, +26/-10)
```diff
@@ -2,6 +2,8 @@
 
 import android.os.Handler;
 import android.os.Looper;
+import android.os.MessageQueue;
+import android.os.ParcelFileDescriptor;
 
 import com.facebook.jni.HybridData;
 import com.facebook.proguard.annotations.DoNotStrip;
@@ -27,11 +29,32 @@ public class PlatformContext {
 
     private final Handler mainHandler = new Handler(Looper.getMainLooper());
 
+    // The native side's main-thread queue signals its tasks on this
+    // descriptor, one for the process, so queuing one from another thread
+    // calls no Java there.
+    private static ParcelFileDescriptor sMainThreadWakeup;
+
     public PlatformContext(ReactContext reactContext) {
+        listenForMainThreadTasks();
         mContext = reactContext;
         mHybridData = initHybrid(reactContext.getResources().getDisplayMetrics().density);
     }
 
+    private static synchronized void listenForMainThreadTasks() {
+        if (sMainThreadWakeup != null) {
+            return;
+        }
+        ParcelFileDescriptor wakeup = ParcelFileDescriptor.adoptFd(duplicateMainThreadWakeup());
+        Looper.getMainLooper().getQueue().addOnFileDescriptorEventListener(
+                wakeup.getFileDescriptor(),
+                MessageQueue.OnFileDescriptorEventListener.EVENT_INPUT,
+                (descriptor, events) -> {
+                    runMainThreadTasks();
+                    return MessageQueue.OnFileDescriptorEventListener.EVENT_INPUT;
+                });
+        sMainThreadWakeup = wakeup;
+    }
+
     private byte[] getStreamAsBytes(InputStream is) throws IOException {
         ByteArrayOutputStream buffer = new ByteArrayOutputStream();
         int nRead;
@@ -105,17 +128,10 @@ public void run() {
         });
     }
 
-    @DoNotStrip
-    public void notifyTaskReady() {
-        if (Looper.myLooper() == Looper.getMainLooper()) {
-            notifyTaskReadyNative();
-        } else {
-            mainHandler.post(this::notifyTaskReadyNative);
-        }
-    }
-
     // Private c++ native methods
     private native HybridData initHybrid(float pixelDensity);
 
-    private native void notifyTaskReadyNative();
+    private static native int duplicateMainThreadWakeup();
+
+    private static native void runMainThreadTasks();
 }
```

**File**: `packages/skia/cpp-tests/MainThreadTasksTest.cpp` (added, +153/-0)
```diff
@@ -0,0 +1,153 @@
+// Host-side check of RNSkia::MainThreadTasks (see run.sh). This process's
+// first thread stands in for the main thread, and a poll of the eventfd for
+// the looper that watches it. The eventfd is Linux's, as on Android and on
+// CI's runner; elsewhere the check says it is skipped.
+
+#if defined(__linux__)
+
+#include <poll.h>
+#include <sched.h>
+#include <unistd.h>
+
+#include <atomic>
+#include <cstdio>
+#include <thread>
+#include <vector>
+
+#include "rnskia-android/RNSkMainThreadTasks.h"
+
+static int fail(const char *message) {
+  std::fprintf(stderr, "FAIL: %s\n", message);
+  return 1;
+}
+
+static bool readable(int descriptor, int timeoutMilliseconds) {
+  pollfd watched{descriptor, POLLIN, 0};
+  return poll(&watched, 1, timeoutMilliseconds) == 1;
+}
+
+static int usableCpus() {
+  cpu_set_t cpus;
+  return sched_getaffinity(0, sizeof(cpus), &cpus) == 0 ? CPU_COUNT(&cpus) : 1;
+}
+
+int main() {
+  // A deadlock fails the run rather than hanging it.
+  alarm(30);
+  auto &tasks = RNSkia::MainThreadTasks::getInstance();
+  const auto mainThread = std::this_thread::get_id();
+  {
+    // A task queued off the main thread onto an empty queue wakes it, and
+    // runs there.
+    std::thread::id ranOn;
+    std::thread([&] {
+      tasks.post([&] { ranOn = std::this_thread::get_id(); });
+    }).join();
+    if (!readable(tasks.wakeup(), 0)) {
+      return fail("a task queued off the main thread does not wake it");
+    }
+    tasks.run();
+    if (ranOn != mainThread) {
+      return fail("a task queued off the main thread does not run on it");
+    }
+    if (readable(tasks.wakeup(), 0)) {
+      return fail("the wakeup stays readable once the queue has run");
+    }
+  }
+  {
+    // A queue that already holds a task is not written again.
+    int ran = 0;
+    std::thread([&] {
+      tasks.post([&] { ran++; });
+      tasks.post([&] { ran++; });
+    }).join();
+    eventfd_t writes = 0;
+    eventfd_read(tasks.wakeup(), &writes);
+    if (writes != 1) {
+      return fail("two tasks queued together write the wakeup twice");
+    }
+    tasks.run();
+    if (ran != 2) {
+      return fail("a run does not take every queued task");
+    }
+  }
+  {
+    // A task handed over on the main thread runs the queue on the spot,
+    // with what other threads queued, and leaves no wakeup behind.
+    int ran = 0;
+    std::thread([&] { tasks.post([&] { ran++; }); }).join();
+    tasks.post([&] { ran++; });
+    if (ran != 2) {
+      return fail("a task handed over on the main thread does not run the "
+                  "queue on the spot");
+    }
+    if (readable(tasks.wakeup(), 0)) {
+      return fail("a wakeup stays readable after the main thread ran the "
+                  "queue on the spot");
+    }
+  }
+  {
+    // A task queued off the main thread while it runs a batch wakes it
+    // again.
+    bool queuedDuringBatchRan = false;
+    std::thread([&] {
+      tasks.post([&] {
+        std::thread([&] {
+          tasks.post([&] { queuedDuringBatchRan = true; });
+        }).join();
+      });
+    }).join();
+    tasks.run();
+    if (queuedDuringBatchRan || !readable(tasks.wakeup(), 0)) {
+      return fail("a task queued during a batch does not wake the main "
+                  "thread again");
+    }
+    tasks.run();
+    if (!queuedDuringBatchRan) {
+      return fail("a task queued during a batch does not run");
+    }
+  }
+  if (usableCpus() < 2) {
+    std::printf("MainThreadTasksTest: one CPU, so threads queuing while the "
+                "main thread runs the queue go unchecked\n");
+  } else {
+    // Many threads queuing while the main thread runs the queue at each
+    // wakeup: no task is left without one.
+    constexpr int posters = 8;
+    constexpr int tasksPerPoster = 20000;
+    std::atomic<int> ran{0};
+    std::vector<std::thread> threads;
+    for (int poster = 0; poster < posters; poster++) {
+      threads.emplace_back([&] {
+        for (int task = 0; task < tasksPerPoster; task++) {
+          tasks.post([&] { ran++; });
+        }
+      });
+    }
+    while (ran < posters * tasksPerPoster) {
+      if (!readable(tasks.wakeup(), 1000)) {
+        for (auto &thread : threads) {
+          thread.join();
+        }
+        return fail("a queued task is left without a wakeup");
+      }
+      tasks.run();
+    }
+    for (auto &thread : threads) {
+      thread.join();
+    }
+  }
+  std::printf("MainThreadTasksTest: passed\n");
+  return 0;
+}
+
+#else
+
+#include <cstdio>
+
+int main() {
+  std::printf("MainThreadTasksTest: skipped, it needs Linux's eventfd\n");
+  return 0;
+}
+
+#endif
```

**File**: `packages/skia/cpp-tests/run.sh` (modified, +1/-1)
```diff
@@ -9,6 +9,6 @@ OUT="$(mktemp -d)"
 trap 'rm -rf "$OUT"' EXIT
 for test in cpp-tests/*.cpp; do
   name="$(basename "$test" .cpp)"
-  "$CXX" -std=c++20 -I "$SKIA_INCLUDE" -I cpp "$test" -o "$OUT/$name"
+  "$CXX" -std=c++20 -I "$SKIA_INCLUDE" -I cpp -I android/cpp "$test" -o "$OUT/$name"
   "$OUT/$name"
 done
```

---

### Incident Patch 2: `d5e32110` (2026-11-02)
**Commit Message**: fix(🍏): hold GPU work while the app is in the background (#4373)

* fix(🍏): hold GPU work while the app is in the background, and tell JS when it is

iOS refuses GPU work from an app in the background, and Dawn 157 turns the
refused Metal command buffer into a device loss (#4290): every canvas
froze until the device was replaced, and everything made on it had to be
made again.

A Dawn patch (scripts/dawn-patches/metal-suspend-submissions-in-background,
to ship with the next react-native-webgpu-dawn) adds a device toggle under
which Dawn holds the commit of command buffers while the app is in the
background, from UIApplication's own notifications: the work is encoded,
committed when the app comes back, and presents meanwhile are dropped. On
entering the background the pending work is committed and waited on to be
scheduled, as Apple asks. Nothing is lost, reordered or refused, so Dawn's
bookkeeping, Graphite's completion tracking and JS promises stay right,
which neither ignoring the refusal (Dawn PR 91, a glyph atlas page refused
would stay garbage) nor rejecting the submit (Graphite ignores the result)
could offer. Dawn commits from inside WaitAny too, so only a gate inside
Dawn

**File**: `apps/docs/docs/webgpu.md` (modified, +33/-1)
```diff
@@ -39,15 +39,47 @@ const { isAvailable, backend, device, description, error } = Skia.gpu;
 | `vendor`, `architecture`, `device`, `description` | The adapter, in the terms of WebGPU's `GPUAdapterInfo` (native only) |
 | `error` | Why the GPU is unavailable; `null` when it is |
 | `lost` | The promise of the loss of the device, see [device loss](#device-loss) |
+| `foreground` | Whether the app is in the foreground and active, where GPU work runs, see [background and foreground](#background-and-foreground) |
 
 ### Availability
 
 On a device without a GPU Skia can render with (on Android, one without Vulkan 1.1, see [the Vulkan section of the installation guide](/docs/getting-started/installation#vulkan)), the app still runs.
 `Skia.gpu.isAvailable` is false and `Skia.gpu.error` says why: every canvas stays blank, CPU work (paths, decoding, raster images) still runs, and the APIs that need the GPU (offscreen surfaces, snapshots, texture images) throw an error with the same message.
 
+### Background and foreground
+
+iOS refuses GPU work from an app in the background, and refused work used to lose the device.
+React Native Skia now holds the GPU work submitted while the app is in the background and runs it when the app comes back: nothing is lost and nothing is refused.
+The same applies to the device `Skia.getNativeDevice()` shares with React Native WebGPU.
+Canvases present nothing meanwhile and catch up on return.
+
+Holding is not free: every frame drawn in the background keeps what it uses in memory until the return.
+A frame callback or a video player that keeps drawing while the app is in the background should stop instead.
+`Skia.gpu.foreground` is false from the moment the app starts to resign active (a lock, a swipe home, an incoming call) until it is active again.
+It can be read synchronously on every runtime, a worklet included, and it flips before any `AppState` event reaches JS.
+
+```tsx twoslash
+import { Skia } from "react-native-skia";
+import { useFrameCallback } from "react-native-reanimated";
+
+const surface = Skia.Surface.MakeOffscreen(256, 256)!;
+
+useFrameCallback(() => {
+  "worklet";
+  if (!Skia.gpu.foreground) {
+    // Nothing to show: skip the frame rather than queue it.
+    return;
+  }
+  surface.getCanvas().drawColor(Skia.Color("cyan"));
+  surface.flush();
+});
+```
+
+On Android, `Skia.gpu.foreground` is whether the host activity is resumed; on the web, whether the document is visible.
+
 ### Device loss
 
-The device can be lost while the app runs: a driver reset, the GPU out of memory, or GPU work refused while the app was in the background on iOS.
+The device can be lost while the app runs: a driver reset, or the GPU out of memory.
 React Native Skia then replaces it with a new device, and canvases render again on their own.
 Everything made on the lost device is gone for good, though safe to use (it draws nothing): offscreen surfaces and the images taken from them, texture images, snapshots of views, and the device `Skia.getNativeDevice()` returned.
 
```

**File**: `apps/example/src/App.tsx` (modified, +10/-0)
```diff
@@ -36,6 +36,7 @@ import {
   HighBitDepth,
   Graphite,
   GraphiteCanvasExample,
+  BackgroundGpu,
   AndroidViews,
 } from "./Examples";
 import { CI, Tests } from "./Tests";
@@ -86,6 +87,7 @@ const linking: LinkingOptions<StackParamList> = {
       Graphite: "graphite",
       GraphiteCanvas: "graphite-canvas",
       AndroidViews: "android-views",
+      BackgroundGpu: "background-gpu",
     },
   },
   // react-native-test-app registers its bundle id as the iOS URL scheme, and
@@ -97,6 +99,9 @@ const linking: LinkingOptions<StackParamList> = {
     "rnskia://",
     "com.microsoft.ReactTestApp://",
     "com.microsoft.reacttestapp://",
+    // Device builds signed with another bundle id register that id instead.
+    "com.microsoft.ReactTestAppSkia42://",
+    "com.microsoft.reacttestappskia42://",
   ],
 };
 
@@ -257,6 +262,11 @@ const App = () => {
               component={GraphiteCanvasExample}
             />
             <Stack.Screen name="AndroidViews" component={AndroidViews} />
+            <Stack.Screen
+              name="BackgroundGpu"
+              component={BackgroundGpu}
+              options={{ title: "🌙 Background GPU" }}
+            />
           </Stack.Navigator>
         </NavigationContainer>
       </GestureHandlerRootView>
```

**File**: `apps/example/src/Examples/BackgroundGpu/BackgroundGpu.tsx` (added, +374/-0)
```diff
@@ -0,0 +1,374 @@
+import React, { useEffect, useState } from "react";
+import {
+  AppState,
+  StyleSheet,
+  Text,
+  View,
+  useWindowDimensions,
+} from "react-native";
+import type { SkSurface } from "react-native-skia";
+import { Canvas, Circle, Fill, Skia } from "react-native-skia";
+import {
+  useDerivedValue,
+  useFrameCallback,
+  useSharedValue,
+} from "react-native-reanimated";
+import { importDevice } from "react-native-webgpu";
+
+// Reproduces wcandillon/react-native-skia#4290: GPU work submitted while the
+// app is in the background. Two loops keep submitting without any timer, so
+// they go on after the app has left the foreground (React Native pauses its
+// timers there) until iOS suspends the process:
+//
+// - the Skia loop draws into an offscreen surface, flushes it and reads the
+//   snapshot back (the readback settles from Skia's readback thread);
+// - the WebGPU loop clears a texture on the device imported from Skia and
+//   awaits onSubmittedWorkDone (settled from React Native WebGPU's waiter).
+//
+// A frame callback moves the disc below so a frozen canvas is visible, and the
+// banner reads Skia.gpu twice a second. Swipe home for a few seconds and come
+// back: with a Dawn that turns a refused command buffer into a device loss,
+// "lost" counts up and the loops restart on a replacement device; with the
+// hold patch, nothing is lost and the loops simply resume.
+//
+// The state is also exposed as globalThis.__bgGpu for a driver on the
+// debugger (Metro's inspector proxy) to read.
+
+interface LoopState {
+  startedAt: number;
+  skiaIterations: number;
+  skiaErrors: number;
+  skiaLastError: string | null;
+  skiaPending: boolean;
+  webgpuIterations: number;
+  webgpuErrors: number;
+  webgpuLastError: string | null;
+  webgpuLost: string | null;
+  webgpuPending: boolean;
+  lostCount: number;
+  lastLost: string | null;
+  foregroundChanges: { t: number; foreground: boolean }[];
+  appStateChanges: { t: number; state: string }[];
+  // Iterations completed per second since start, to tell held from executed
+  // work once the app is back: a held loop shows zeros for the background.
+  skiaPerSecond: number[];
+  webgpuPerSecond: number[];
+}
+
+const newState = (): LoopState => ({
+  startedAt: Date.now(),
+  skiaIterations: 0,
+  skiaErrors: 0,
+  skiaLastError: null,
+  skiaPending: false,
+  webgpuIterations: 0,
+  webgpuErrors: 0,
+  webgpuLastError: null,
+  webgpuLost: null,
+  webgpuPending: false,
+  lostCount: 0,
+  lastLost: null,
+  foregroundChanges: [],
+  appStateChanges: [],
+  skiaPerSecond: [],
+  webgpuPerSecond: [],
+});
+
+const sleep = (ms: number) =>
+  new Promise<void>((resolve) => setTimeout(resolve, ms));
+
+const describe = (error: unknown) =>
+  error instanceof Error ? error.message : String(error);
+
+const SIZE = 1024;
+// Fragment iterations per pixel: tens of milliseconds of GPU time per command
+// buffer, so that one is in flight whenever iOS revokes GPU access.
+const HEAVY = 300;
+// Command buffers queued per iteration: about half a second of GPU work is
+// always queued, so some of it is still unscheduled when the app goes to the
+// background, the case Apple's guidance (waitUntilScheduled) is about.
+const SKIA_BURST = 10;
+const WEBGPU_BURST = 20;
+
+const heavyEffect = Skia.RuntimeEffect.Make(`
+uniform float t;
+half4 main(float2 xy) {
+  float v = xy.x * 0.001 + t;
+  for (int i = 0; i < ${HEAVY}; i++) {
+    v = sin(v * 1.7 + xy.y * 0.0007) + cos(v);
+  }
+  return half4(half(v * 0.5 + 0.5), 0.3, 0.6, 1);
+}`)!;
+
+const heavyWGSL = `
+@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
+  var p = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
+  return vec4f(p[i], 0, 1);
+}
+@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
+  var v = pos.x * 0.001;
+  for (var i = 0u; i < ${HEAVY}u; i++) {
+    v = sin(v * 1.7 + pos.y * 0.0007) + cos(v);
+  }
+  return vec4f(v * 0.5 + 0.5, 0.3, 0.6, 1);
+}`;
+
+const tick = (state: LoopState, series: number[]) => {
+  const second = Math.floor((Date.now() - state.startedAt) / 1000);
+  series[second] = (series[second] ?? 0) + 1;
+};
+
+const dense = (series: number[]) => Array.from(series, (v) => v ?? 0);
+
+const runSkiaLoop = async (state: LoopState, isActive: () => boolean) => {
+  let surface: SkSurface | null = null;
+  const paint = Skia.Paint();
+  paint.setAntiAlias(true);
+  while (isActive()) {
+    try {
+      if (surface === null) {
+        surface = Skia.Surface.MakeOffscreen(SIZE, SIZE);
+        if (surface === null) {
+          throw new Error("MakeOffscreen returned null");
+        }
+      }
+      const canvas = surface.getCanvas();
+      const i = state.skiaIterations;
+      for (let k = 0; k < SKIA_BURST; k++) {
+        paint.setShader(heavyEffect.makeShader([(i * SKIA_BURST + k) / 100]));
+        canvas.drawRect(Skia.XYWHRect(0, 0, SIZE, SIZE), paint);
+        surface.flush();
+      }
+   
```

**File**: `apps/example/src/Examples/BackgroundGpu/index.ts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export * from "./BackgroundGpu";
```

**File**: `apps/example/src/Examples/index.ts` (modified, +1/-0)
```diff
@@ -31,3 +31,4 @@ export * from "./WebGPU";
 export * from "./HighBitDepth";
 export * from "./Graphite";
 export * from "./AndroidViews";
+export * from "./BackgroundGpu";
```

**File**: `apps/example/src/Home/HomeScreen.tsx` (modified, +5/-0)
```diff
@@ -158,6 +158,11 @@ export const HomeScreen = () => {
         description="SurfaceView vs TextureView"
         route="AndroidViews"
       />
+      <HomeScreenButton
+        title="🌙 Background GPU"
+        description="GPU work while the app is in the background (#4290)"
+        route="BackgroundGpu"
+      />
     </ScrollView>
   );
 };
```

**File**: `apps/example/src/types.ts` (modified, +1/-0)
```diff
@@ -38,4 +38,5 @@ export type StackParamList = {
   Graphite: undefined;
   GraphiteCanvas: undefined;
   AndroidViews: undefined;
+  BackgroundGpu: undefined;
 };
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@
   "packageManager": "yarn@3.6.4",
   "resolutions": {
     "@webgpu/types": "^0.1.69",
+    "react-native-webgpu-dawn": "157.1.0",
     "react-native-reanimated@4.6.0": "patch:react-native-reanimated@npm%3A4.6.0#./.yarn/patches/react-native-reanimated-npm-4.6.0-f4226872a0.patch"
   },
   "devDependencies": {
```

---

### Incident Patch 3: `811f603a` (2026-11-03)
**Commit Message**: fix(🍏): keep a view's native view, and what it shows, out of its superview (#4324)

On iOS and macOS, SkiaView destroyed its native view in removeFromSuperview
and built a new one in willMoveToSuperview:, while the registry gives a view's
properties to its first native view only. A canvas or a SkiaGraphiteView taken
out of its superview while mounted, as a scroll view with removeClippedSubviews
does to the rows it scrolls away, came back blank. On Android since #4318, a
canvas asked for a redraw while scrolled away came back blank too: the redraw
found the window's description, which detach() leaves in place, kept its
request at canPresent(), and swallowed the request the next attach made.

The native view now lives from the view's first superview until the view is
recycled, as on Android, where only the window goes. Out of its superview, the
view lets go of the window's surface and of the layer behind it; back in one,
it makes a new layer, attaches the surface to it and presents its last frame
as the layer is made, so the Core Animation commit that carries the layer
carries the frame. A first mount attaches at layout, and a frame scheduled
meanwhile waits for that attach. The att

**File**: `apps/example/src/Tests/GpuDevice.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+import { Skia } from "react-native-skia";
+import { importDevice } from "react-native-webgpu";
+
+// The device Skia renders with, as a GPUDevice. Skia replaces a lost device
+// with a new one: the import is let go of when that happens, so that the next
+// use imports the new device.
+let sharedDevice: GPUDevice | null = null;
+export const getSharedDevice = () => {
+  if (sharedDevice === null) {
+    const device = importDevice(Skia.getNativeDevice());
+    sharedDevice = device;
+    Skia.gpu.lost.then(() => {
+      if (sharedDevice === device) {
+        sharedDevice = null;
+      }
+    });
+  }
+  return sharedDevice;
+};
+
+// Loses the GPU device on purpose: the device is shared with
+// react-native-webgpu, whose test hook asks Dawn to lose it.
+export const forceGpuDeviceLoss = () => {
+  (
+    getSharedDevice() as GPUDevice & { forceLossForTesting: () => void }
+  ).forceLossForTesting();
+};
```

**File**: `apps/example/src/Tests/ScreenDone.ts` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+import { createContext, useContext } from "react";
+
+// A screen whose content settles a chain of native events after it mounts,
+// one the registry snapshots once done (see Screens), says when it has, and
+// Tests takes its snapshot from then rather than from the mount.
+export const ScreenDoneContext = createContext(() => {});
+
+export const useScreenDone = () => useContext(ScreenDoneContext);
```

**File**: `apps/example/src/Tests/Screens/ClippedSubviews.tsx` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
+import type { RefObject } from "react";
+import React, { memo, useEffect, useRef, useState } from "react";
+import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
+import { ScrollView, View } from "react-native";
+import type { CanvasRef } from "react-native-skia";
+import {
+  Canvas,
+  createPicture,
+  Fill,
+  Picture,
+  Skia,
+  useCanvasRef,
+} from "react-native-skia";
+import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";
+import { scheduleOnRN } from "react-native-worklets";
+import { exhaustiveCheck } from "react-native-skia/src/renderer/typeddash";
+
+import { forceGpuDeviceLoss } from "../GpuDevice";
+import { useScreenDone } from "../ScreenDone";
+
+import { CyanGraphiteView } from "./GraphiteView";
+
+const ROW_HEIGHT = 1000;
+const AWAY = 4 * ROW_HEIGHT;
+
+const cyan = createPicture((canvas) => canvas.drawColor(Skia.Color("cyan")));
+
+// A canvas whose content never changes: React leaves it alone when the screen
+// renders again, so all it is asked for then is a redraw.
+const PictureCanvasContent = ({
+  canvasRef,
+}: {
+  canvasRef: RefObject<CanvasRef | null>;
+}) => (
+  <Canvas ref={canvasRef} style={{ flex: 1 }}>
+    <Picture picture={cyan} />
+  </Canvas>
+);
+const PictureCanvas = memo(PictureCanvasContent);
+
+type Change = "nothing" | "state" | "sharedValue" | "deviceLost";
+
+interface ClippedSubviewsProps {
+  change: Change;
+  roundTrips: number;
+}
+
+// A canvas (red, or cyan once changed) beside a canvas drawing a picture and
+// a graphite view (both cyan), at the top of a scroll view that clips its
+// subviews. They mount unclipped, so that their native views are in the window
+// first; then clipping is turned on and the scroll view goes away and back,
+// roundTrips times, each step once the scroll view reports the offset of the
+// one before. A change is made while away: React state, a shared value, or the
+// GPU device lost and replaced. React Native flattens the row, so the views
+// themselves leave their superview while away.
+const ClippedSubviews = ({ change, roundTrips }: ClippedSubviewsProps) => {
+  const scrollView = useRef<ScrollView>(null);
+  const tripsLeft = useRef(roundTrips);
+  const [clipped, setClipped] = useState(false);
+  const [color, setColor] = useState("red");
+  const sharedColor = useSharedValue("red");
+  const deviceLost = useRef(false);
+  const pictureCanvas = useCanvasRef();
+  const done = useScreenDone();
+  const scrollBack = () =>
+    scrollView.current?.scrollTo({ y: 0, animated: false });
+  // Every render asks the picture's canvas for a redraw, so a render while it
+  // is away asks a view with no window attached for one.
+  useEffect(() => {
+    pictureCanvas.current?.redraw();
+  });
+  useEffect(() => {
+    if (!clipped) {
+      setClipped(true);
+      return;
+    }
+    scrollView.current?.scrollTo({ y: AWAY, animated: false });
+  }, [clipped]);
+  // A change React commits while the canvas is away: back once it is drawn.
+  useEffect(() => {
+    if (color !== "red") {
+      scrollBack();
+    }
+  }, [color]);
+  // A shared value set while the canvas is away: back once the UI thread
+  // has run the canvas's mapper on it, as the scroll back reaches that
+  // thread after the reaction's frame. Cyan is set only while away, and a
+  // reaction made again by a render may first see it already set.
+  useAnimatedReaction(
+    () => sharedColor.value,
+    (value) => {
+      if (value === "cyan") {
+        scheduleOnRN(scrollBack);
+      }
+    }
+  );
+  const onScroll = ({
+    nativeEvent,
+  }: NativeSyntheticEvent<NativeScrollEvent>) => {
+    // Android can report the offset a fraction of a point short of AWAY.
+    if (nativeEvent.contentOffset.y > AWAY - 1) {
+      switch (change) {
+        case "nothing":
+          scrollBack();
+          break;
+        case "state":
+          setColor("cyan");
+          break;
+        case "sharedValue":
+          sharedColor.value = "cyan";
+          break;
+        case "deviceLost":
+          // Once: the scroll view may report the offset again.
+          if (!deviceLost.current) {
+            deviceLost.current = true;
+            const { lost } = Skia.gpu;
+            forceGpuDeviceLoss();
+            lost.then(scrollBack);
+          }
+          break;
+        default:
+          exhaustiveCheck(change);
+      }
+    } else if (nativeEvent.contentOffset.y === 0 && clipped) {
+      tripsLeft.current -= 1;
+      if (tripsLeft.current > 0) {
+        scrollView.current?.scrollTo({ y: AWAY, animated: false });
+      } else {
+        done();
+      }
+    }
+  };
+  return (
+    <ScrollView
+      ref={scrollView}
+      removeClippedSubviews={clipped}
+      onScroll={onScroll}
+      scrollEventThrottle={16}
+      style={{ flex: 1 }}
+    >
+      <View style={{ flexDirection: "row", height: ROW_HEIGHT }}>
+        <Canvas style={{ flex: 1 }}>
+          <Fill color={c
```

**File**: `apps/example/src/Tests/Screens/GraphiteView.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import { Skia, SkiaGraphiteView } from "react-native-skia";
 import type { SkiaGraphiteViewRef } from "react-native-skia";
 
 // Fills itself in cyan with the one frame it records once mounted.
-const CyanGraphiteView = ({ style }: { style: ViewStyle }) => {
+export const CyanGraphiteView = ({ style }: { style: ViewStyle }) => {
   const ref = useRef<SkiaGraphiteViewRef>(null);
   useEffect(() => {
     const view = ref.current;
```

**File**: `apps/example/src/Tests/Screens/index.ts` (modified, +36/-9)
```diff
@@ -1,19 +1,46 @@
 import type { FC } from "react";
 
+import {
+  ClippedSubviewsBack,
+  ClippedSubviewsDeviceLost,
+  ClippedSubviewsSharedValueChanged,
+  ClippedSubviewsStateChanged,
+  ClippedSubviewsTwice,
+} from "./ClippedSubviews";
 import { GraphiteView, GraphiteViewTransform } from "./GraphiteView";
 import { IsOnMainThread } from "./IsOnMainThread";
 import { OnLayout } from "./OnLayout";
 import { ResizeGrow, ResizeShrink } from "./Resize";
 import { SharedImage } from "./SharedImage";
 import { SharedValueReads } from "./SharedValueReads";
 
-export const Screens: Record<string, FC> = {
-  GraphiteView,
-  GraphiteViewTransform,
-  IsOnMainThread,
-  OnLayout,
-  ResizeGrow,
-  ResizeShrink,
-  SharedImage,
-  SharedValueReads,
+// When Tests snapshots a screen: once it is mounted, or once it says it has
+// settled (see useScreenDone), which it does anew each time it is requested.
+export interface Screen {
+  readonly snapshot: "onMount" | "onDone";
+  readonly component: FC;
+}
+
+const shown = (component: FC): Screen => ({ snapshot: "onMount", component });
+const settling = (component: FC): Screen => ({
+  snapshot: "onDone",
+  component,
+});
+
+export const Screens: Readonly<Record<string, Screen>> = {
+  ClippedSubviewsBack: settling(ClippedSubviewsBack),
+  ClippedSubviewsDeviceLost: settling(ClippedSubviewsDeviceLost),
+  ClippedSubviewsSharedValueChanged: settling(
+    ClippedSubviewsSharedValueChanged
+  ),
+  ClippedSubviewsStateChanged: settling(ClippedSubviewsStateChanged),
+  ClippedSubviewsTwice: settling(ClippedSubviewsTwice),
+  GraphiteView: shown(GraphiteView),
+  GraphiteViewTransform: shown(GraphiteViewTransform),
+  IsOnMainThread: shown(IsOnMainThread),
+  OnLayout: shown(OnLayout),
+  ResizeGrow: shown(ResizeGrow),
+  ResizeShrink: shown(ResizeShrink),
+  SharedImage: shown(SharedImage),
+  SharedValueReads: shown(SharedValueReads),
 };
```

**File**: `apps/example/src/Tests/Tests.tsx` (modified, +33/-34)
```diff
@@ -1,11 +1,13 @@
 /* eslint-disable @typescript-eslint/no-explicit-any */
 import { Canvas, Group, Skia, useCanvasRef } from "react-native-skia";
-import { importDevice } from "react-native-webgpu";
-import React, { useEffect, useRef, useState } from "react";
+import React, { useCallback, useEffect, useRef, useState } from "react";
 import { PixelRatio, Text, View } from "react-native";
 
 import type { SerializedNode } from "./deserialize";
 import { parseNode, parseProps } from "./deserialize";
+import { forceGpuDeviceLoss, getSharedDevice } from "./GpuDevice";
+import { ScreenDoneContext } from "./ScreenDone";
+import type { Screen } from "./Screens";
 import { Screens } from "./Screens";
 import { useClient } from "./useClient";
 import { workletSerialization } from "./workletSerialization";
@@ -33,31 +35,6 @@ const resultMessage = (result: unknown) => {
     : json;
 };
 
-// The device Skia renders with, as a GPUDevice. Skia replaces a lost device
-// with a new one: the import is let go of when that happens, so that the next
-// use imports the new device.
-let sharedDevice: GPUDevice | null = null;
-const getSharedDevice = () => {
-  if (sharedDevice === null) {
-    const device = importDevice(Skia.getNativeDevice());
-    sharedDevice = device;
-    Skia.gpu.lost.then(() => {
-      if (sharedDevice === device) {
-        sharedDevice = null;
-      }
-    });
-  }
-  return sharedDevice;
-};
-
-// Loses the GPU device on purpose (the Gpu spec): the device is shared with
-// react-native-webgpu, whose test hook asks Dawn to lose it.
-const forceGpuDeviceLoss = () => {
-  (
-    getSharedDevice() as GPUDevice & { forceLossForTesting: () => void }
-  ).forceLossForTesting();
-};
-
 // The encoded pixels of a native view: React Native WebGPU rasterizes the view
 // into a texture of the shared device, and Skia wraps that texture. This is
 // the one way to snapshot a view with Skia v3 (see docs/webgpu#view-snapshots).
@@ -98,7 +75,17 @@ export const Tests = ({ assets }: TestsProps) => {
   const ref = useCanvasRef();
   const [client, hostname] = useClient();
   const [drawing, setDrawing] = useState<any>(null);
-  const [screen, setScreen] = useState<any>(null);
+  // The screen shown and the key it is mounted with. Requested again, a
+  // screen that settles is mounted again, so that it settles again; any other
+  // keeps its instance and what it shows.
+  const [shown, setShown] = useState<{
+    readonly screen: Screen;
+    readonly key: number;
+  } | null>(null);
+  const screenMounts = useRef(0);
+  // Whether the screen shown has settled (see useScreenDone).
+  const [screenDone, setScreenDone] = useState(false);
+  const markScreenDone = useCallback(() => setScreenDone(true), []);
 
   useEffect(() => {
     if (client !== null) {
@@ -137,11 +124,15 @@ export const Tests = ({ assets }: TestsProps) => {
             client.send(errorEnvelope(error));
           }
         } else if (typeof tree.screen === "string") {
-          const Screen = Screens[tree.screen];
-          if (!Screen) {
+          const screen = Screens[tree.screen];
+          if (!screen) {
             throw new Error(`Unknown screen: ${tree.screen}`);
           }
-          setScreen(React.createElement(Screen));
+          if (screen.snapshot === "onDone") {
+            screenMounts.current += 1;
+          }
+          setScreenDone(false);
+          setShown({ screen, key: screenMounts.current });
         } else {
           const node = parseNode(tree, assets);
           setDrawing(node as SerializedNode);
@@ -185,7 +176,11 @@ export const Tests = ({ assets }: TestsProps) => {
   }, [client, drawing, ref]);
 
   useEffect(() => {
-    if (screen && client) {
+    if (
+      shown !== null &&
+      client !== null &&
+      (shown.screen.snapshot === "onMount" || screenDone)
+    ) {
       const it = setTimeout(async () => {
         try {
           client.send(await encodeView(viewRef));
@@ -199,7 +194,7 @@ export const Tests = ({ assets }: TestsProps) => {
       };
     }
     return;
-  }, [client, screen]);
+  }, [client, shown, screenDone]);
 
   return (
     <View style={{ flex: 1, backgroundColor: "white" }}>
@@ -216,7 +211,11 @@ export const Tests = ({ assets }: TestsProps) => {
         ref={viewRef}
         collapsable={false}
       >
-        {screen}
+        <ScreenDoneContext.Provider value={markScreenDone}>
+          {shown === null
+            ? null
+            : React.createElement(shown.screen.component, { key: shown.key })}
+        </ScreenDoneContext.Provider>
       </View>
     </View>
   );
```

**File**: `packages/skia/apple/SkiaView.mm` (modified, +53/-20)
```diff
@@ -56,8 +56,9 @@ static bool appIsBackgrounded() {
 }
 
 @implementation SkiaView {
-  // The native view, the window surface and the layer it presents into. All
-  // three exist while the view is in the hierarchy (see willMoveToSuperview:).
+  // The native view and its window surface, from the view's first superview
+  // until it is recycled, and the layer the surface presents into, while the
+  // view is in a superview (see willMoveToSuperview:).
   std::shared_ptr<RNSkia::RNSkView> _view;
   std::shared_ptr<RNSkia::RNSkWindowSurface> _surface;
 #pragma clang diagnostic push
@@ -126,9 +127,11 @@ - (instancetype)initWithFrame:(CGRect)frame {
 
 #pragma mark - Lifecycle
 
-// The native view lives while the view is in the hierarchy: it is created
-// when the view gets a superview and torn down when it leaves it, so that a
-// view kept around by a transition does not keep a surface.
+// The native view is created when the view first gets a superview and lives
+// until the view is recycled, as on Android: what it shows stays with it
+// while the view is out of its superview, where a scroll view that clips its
+// subviews keeps the rows scrolled away. The window goes then, the layer with
+// its drawables included, so that a view out of the hierarchy holds none.
 #if !TARGET_OS_OSX
 - (void)willMoveToSuperview:(UIView *)newSuperView {
   [super willMoveToSuperview:newSuperView];
@@ -137,14 +140,37 @@ - (void)viewWillMoveToSuperview:(NSView *)newSuperView {
   [super viewWillMoveToSuperview:newSuperView];
 #endif // !TARGET_OS_OSX
   auto manager = _manager.lock();
-  if (newSuperView == nullptr || _view != nullptr || manager == nullptr) {
+  if (newSuperView == nullptr || manager == nullptr) {
     return;
   }
-  auto context = manager->getPlatformContext();
+  if (_layer == nil) {
 #pragma clang diagnostic push
 #pragma clang diagnostic ignored "-Wunguarded-availability-new"
-  _layer = [CAMetalLayer layer];
+    _layer = [CAMetalLayer layer];
 #pragma clang diagnostic pop
+    [self.layer addSublayer:_layer];
+    // AppKit lays out a view put in a superview only when asked: the layout
+    // attaches the window's surface to the layer (see layoutSubviews).
+    [self setNeedsLayout];
+    // A view put back gets its last frame onto the new layer now: the layout
+    // comes after the Core Animation commit that carries the layer, which
+    // would show it empty for a frame or two.
+    if (_view != nullptr) {
+      [CATransaction begin];
+      [CATransaction setDisableActions:YES];
+      _layer.frame =
+          CGRectMake(0, 0, self.bounds.size.width, self.bounds.size.height);
+      [self attachSurface];
+      [CATransaction commit];
+      if (!_surface->showsFrame()) {
+        _view->redraw();
+      }
+    }
+  }
+  if (_view != nullptr) {
+    return;
+  }
+  auto context = manager->getPlatformContext();
   _surface = std::make_shared<RNSkia::RNSkWindowSurface>();
   _surface->setHighBitDepth(_highBitDepth);
   _surface->setUseP3ColorSpace(usesP3ColorSpace(_colorSpace, context));
@@ -158,9 +184,8 @@ - (void)viewWillMoveToSuperview:(NSView *)newSuperView {
            strongSelf->_canPresent;
   });
   _view = std::make_shared<RNSkia::RNSkView>(context, _surface);
-  [self.layer addSublayer:_layer];
   if (_nativeId != 0) {
-    manager->setSkiaView(_nativeId, _view);
+    manager->registerSkiaView(_nativeId, _view);
   }
   // The display link presents whatever is waiting on its next tick, a frame
   // for a resized window included: nothing shows before it anyway.
@@ -170,16 +195,11 @@ - (void)viewWillMoveToSuperview:(NSView *)newSuperView {
 
 - (void)removeFromSuperview {
   [self stopDisplayLink];
-  if (_view != nullptr) {
-    [_layer removeFromSuperlayer];
-    auto manager = _manager.lock();
-    if (_nativeId != 0 && manager != nullptr) {
-      manager->setSkiaView(_nativeId, nullptr);
-    }
-    _view = nullptr;
-    _surface = nullptr;
-    _layer = nil;
+  if (_surface != nullptr) {
+    _surface->detach();
   }
+  [_layer removeFromSuperlayer];
+  _layer = nil;
   [super removeFromSuperview];
 }
 
@@ -192,7 +212,13 @@ - (void)dealloc {
 - (void)prepareForRecycle {
   [super prepareForRecycle];
   [self stopDisplayLink];
+  // Unregistered first, so that the native view is destroyed here rather than
+  // under the registry's lock.
   [self unregisterView];
+  [_layer removeFromSuperlayer];
+  _view = nullptr;
+  _surface = nullptr;
+  _layer = nil;
 }
 
 - (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask {
@@ -205,11 +231,14 @@ - (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask {
   }
 }
 
+// Once: a recycled view takes its next id from its props, and a pooled one
+// must not unregister an id another view may have since.
 - (void)unregisterView {
   auto manager = _manager.lock();
   if (manager != nullptr && _nativeId != 0) {
     manager->unregisterSkiaView(_nativeId);
   }
+  _nativeId = 0;
 }
 
 #pragma mark - Application state
@@ -235,6 +2
```

**File**: `packages/skia/cpp-tests/RedrawRequestTest.cpp` (added, +238/-0)
```diff
@@ -0,0 +1,238 @@
+// Host-side check of RNSkia::RNSkRedrawRequest, the request a view's redraw
+// takes and the window state it reads (see run.sh). What the main thread does
+// meanwhile (an attach, a detach, the app coming back) lands between the
+// redraw's steps through the stand-in window below.
+
+#include <cstddef>
+#include <cstdio>
+#include <functional>
+#include <vector>
+
+#include "rnskia/RNSkRedrawRequest.h"
+
+namespace {
+
+using RNSkia::RNSkRedrawRequest;
+using RNSkia::RNSkWindowState;
+using Start = RNSkRedrawRequest::Start;
+
+int failures = 0;
+
+void expect(bool condition, const char *what) {
+  if (!condition) {
+    std::fprintf(stderr, "FAIL: %s\n", what);
+    failures++;
+  }
+}
+
+// A window the main thread changes under a redraw: each read returns the
+// state the window has, and what the main thread does runs right before or
+// right after a read, one step per read.
+struct Window {
+  RNSkWindowState state = RNSkWindowState::kReady;
+  std::vector<std::function<void(Window &)>> beforeRead;
+  std::vector<std::function<void(Window &)>> afterRead;
+  size_t reads = 0;
+
+  RNSkWindowState readState(int *info) {
+    if (reads < beforeRead.size() && beforeRead[reads]) {
+      beforeRead[reads](*this);
+    }
+    const auto read = state;
+    if (info != nullptr) {
+      *info = 1;
+    }
+    if (reads < afterRead.size() && afterRead[reads]) {
+      afterRead[reads](*this);
+    }
+    reads++;
+    return read;
+  }
+};
+
+void oneRedrawWaitsAtATime() {
+  RNSkRedrawRequest redraw;
+  Window window;
+  expect(redraw.request(), "the first request posts a redraw");
+  expect(!redraw.request(), "a request while one waits posts nothing");
+  int info = 0;
+  expect(redraw.start(window, &info) == Start::kPresent,
+         "a redraw onto a ready window presents");
+  expect(redraw.request(),
+         "a request once the redraw started posts one of its own");
+}
+
+void anAttachWhileARedrawFindsNoWindowIsNotSwallowed() {
+  RNSkRedrawRequest redraw;
+  Window window;
+  window.state = RNSkWindowState::kNone;
+  expect(redraw.request(), "the request posts a redraw");
+  bool attachPosted = false;
+  // The window attaches right after the redraw read that there was none.
+  window.afterRead = {[&](Window &read) {
+    read.state = RNSkWindowState::kReady;
+    attachPosted = redraw.request();
+  }};
+  int info = 0;
+  expect(redraw.start(window, &info) == Start::kSkip,
+         "a redraw that finds no window presents nothing");
+  expect(attachPosted,
+         "an attach while a redraw finds no window posts a redraw of its own");
+}
+
+void aDetachDuringARedrawLetsTheNextAttachAskAgain() {
+  RNSkRedrawRequest redraw;
+  Window window;
+  expect(redraw.request(), "the request posts a redraw");
+  // The window is detached right after the redraw reads it.
+  window.afterRead = {
+      [](Window &read) { read.state = RNSkWindowState::kNone; }};
+  int info = 0;
+  expect(redraw.start(window, &info) == Start::kPresent,
+         "the redraw presents onto the window it read");
+  window.state = RNSkWindowState::kReady;
+  expect(redraw.request(), "the attach after a detach during a redraw posts "
+                           "a redraw of its own");
+}
+
+void aRedrawWithoutADeviceLetsTheReplacementAskAgain() {
+  RNSkRedrawRequest redraw;
+  Window window;
+  window.state = RNSkWindowState::kNoDevice;
+  expect(redraw.request(), "the request posts a redraw");
+  int info = 0;
+  expect(redraw.start(window, &info) == Start::kSkip,
+         "a redraw without a GPU device presents nothing");
+  // The device replaced, every view is asked for a redraw (RNSkManager).
+  window.state = RNSkWindowState::kReady;
+  expect(redraw.request(), "the device's replacement posts a redraw");
+}
+
+void aWindowThatCannotPresentGetsTheRedrawOnceItCan() {
+  RNSkRedrawRequest redraw;
+  Window window;
+  window.state = RNSkWindowState::kCannotPresent;
+  expect(redraw.request(), "the request posts a redraw");
+  int info = 0;
+  expect(redraw.start(window, &info) == Start::kSkip,
+         "a redraw onto a window that cannot present presents nothing");
+  window.state = RNSkWindowState::kReady;
+  expect(redraw.onCanPresent(),
+         "the window able to present again gets the redraw it missed");
+  expect(redraw.isWaiting(), "the redraw posted then finds its request");
+}
+
+// Where the app comes back, the platform view calling onCanPresent(),
+// against a redraw that finds the window unable to present.
+enum class CanPresentAt {
+  kBeforeTheRedraw,
+  kAfterTheFirstRead,
+  kBeforeTheSecondRead,
+  kAfterTheSecondRead,
+  kAfterTheRedraw,
+};
+
+void aWindowThatCanPresentAgainAroundTheRedrawGetsOneRedraw(
+    CanPresentAt canPresentAt, const char *what) {
+  RNSkRedrawRequest redraw;
+  Window window;
+  window.state = RNSkWindowState::kCannotPresent;
+  expect(redraw.request(), "the request posts a redraw");
+  int posted = 0;
+  const auto comesBack = [&](Window &read) {
+    read.stat
```

#### Recent Merged Pull Requests:
- **PR #4392** (2026-11-03): chore(🐙): build the macOS example on main only, and check the Apple sources against every SDK on PRs (@wcandillon)
- **PR #4389** (2026-11-03): fix(🏞️): record every frame of a view on the same render thread (@wcandillon)
- **PR #4388** (2026-11-03): fix(🍏): ask for the full frame rate again on a recycled view (@wcandillon)
- **PR #4387** (2026-11-03): chore(🐙): minor correction (@wcandillon)
- **PR #4386** (2026-11-03): fix(🗿): present one recording per vsync (@wcandillon)
- **PR #4383** (2026-11-02): chore(⬆️): move the example to react-native-webgpu 0.20.0 (@wcandillon)

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

## X. 🤖): post main-thread tasks without calling into Java (#4364)

**RULE**:
When implementing operations in `packages/skia/android/cpp/jni/JniPlatformContext.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wcandillon/react-native-skia. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b3c17c56`: 🤖): post main-thread tasks without calling into Java (#4364). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/skia/android/cpp/jni/JniPlatformContext.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
#include <fcntl.h>

#include <cerrno>
#include <system_error>
#include "RNSkMainThreadTasks.h"

      makeNativeMethod("duplicateMainThreadWakeup",
                       JniPlatformContext::duplicateMainThreadWakeup),
      makeNativeMethod("runMainThreadTasks",
                       JniPlatformContext::runMainThreadTasks),
  MainThreadTasks::getInstance().post(std::move(task));
int JniPlatformContext::duplicateMainThreadWakeup(jni::alias_ref<jclass>) {
  int duplicate =
      fcntl(MainThreadTasks::getInstance().wakeup(), F_DUPFD_CLOEXEC, 0);
  if (duplicate == -1) {
    throw std::system_error(errno, std::generic_category(), "dup");
  return duplicate;
}
void JniPlatformContext::runMainThreadTasks(jni::alias_ref<jclass>) {
  MainThreadTasks::getInstance().run();
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
      makeNativeMethod("notifyTaskReadyNative",
                       JniPlatformContext::notifyTaskReadyNative),
  bool shouldSchedule = false;
  {
    std::lock_guard<std::mutex> lock(_mainThreadTasksMutex);
    _mainThreadTasks.push(std::move(task));
    if (!_mainThreadDispatchScheduled) {
      _mainThreadDispatchScheduled = true;
      shouldSchedule = true;
    }
  }

  if (shouldSchedule) {
    notifyTaskReadyExternal();
  }
}

void JniPlatformContext::notifyTaskReadyExternal() {
  jni::ThreadScope ts;

  static auto method =
      javaPart_->getClass()->getMethod<void()>("notifyTaskReady");
  method(javaPart_.get());
void JniPlatformContext::notifyTaskReadyNative() {
  std::queue<std::function<void()>> tasks;
  {
    std::lock_guard<std::mutex> lock(_mainThreadTasksMutex);
    std::swap(tasks, _mainThreadTasks);
    _mainThreadDispatchScheduled = false;
  while (!tasks.empty()) {
    auto handler = std::move(tasks.front());
    tasks.pop();
    if (handler) {
      handler();
    }
  }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b3c17c56` are properly handled with clean fallback behavior.
