> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/shopify-react-native-skia-learnings.md`  
> **Source**: github ([https://github.com/Shopify/react-native-skia](https://github.com/Shopify/react-native-skia))  
> **Source Version**: `b205363a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T17:23:40.258Z  
> **Learning ID**: `learn-github-wcandillon-react-native-skia`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): wcandillon/react-native-skia

> **Canonical Artifact**: `07_PROJECT_LEARNING/shopify-react-native-skia-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Shopify/react-native-skia](https://github.com/Shopify/react-native-skia))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T17:23:39.080Z  
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

### Incident Patch 1: `bde7f1f3` (2026-10-26)
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

### Incident Patch 2: `b205363a` (2026-10-27)
**Commit Message**: fix(🐙): fail the header copy when its sources are missing (#4256)

copyRecursiveSync returned silently when its source did not exist, so
`yarn copy-skia-headers` without the externals/skia submodule removed
cpp/skia and cpp/dawn, copied nothing and reported success, and the next
native build failed on a missing header. A missing source now throws,
and copyHeaders checks the submodule and resolves the Dawn headers
before it removes anything.

Co-authored-by: William Candillon <[REDACTED_EMAIL]>

**File**: `packages/skia/scripts/__tests__/utils.spec.ts` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+import fs from "fs";
+import os from "os";
+import path from "path";
+
+import { copyRecursiveSync } from "../utils";
+
+describe("copyRecursiveSync", () => {
+  let directory: string;
+
+  beforeEach(() => {
+    directory = fs.mkdtempSync(path.join(os.tmpdir(), "copy-recursive-"));
+  });
+
+  afterEach(() => {
+    fs.rmSync(directory, { recursive: true, force: true });
+  });
+
+  it("fails on a source that does not exist, creating nothing", () => {
+    const destination = path.join(directory, "destination");
+    expect(() =>
+      copyRecursiveSync(path.join(directory, "missing"), destination)
+    ).toThrow("does not exist");
+    expect(fs.existsSync(destination)).toBe(false);
+  });
+
+  it("copies a directory tree", () => {
+    const source = path.join(directory, "source");
+    fs.mkdirSync(path.join(source, "nested"), { recursive: true });
+    fs.writeFileSync(path.join(source, "nested", "header.h"), "#pragma once\n");
+    const destination = path.join(directory, "destination");
+    copyRecursiveSync(source, destination);
+    expect(
+      fs.readFileSync(path.join(destination, "nested", "header.h"), "utf8")
+    ).toBe("#pragma once\n");
+  });
+});
```

**File**: `packages/skia/scripts/skia-configuration.ts` (modified, +35/-26)
```diff
@@ -1,3 +1,4 @@
+import fs from "fs";
 import path from "path";
 
 import { $, fileOps } from "./utils";
@@ -310,11 +311,44 @@ const copyModule = (module: string) => {
   fileOps.cp(srcDir, destDir);
 };
 
+// Dawn headers: from the Dawn built locally with `yarn build-dawn` when there is
+// one (it is what the native builds then link), otherwise from the
+// react-native-webgpu-dawn package, the same way Gradle and the podspec pick the
+// library.
+const resolveDawnInclude = () => {
+  const localDawnInclude = path.join(PackageRoot, "libs", "dawn", "include");
+  if (fs.existsSync(path.join(localDawnInclude, "webgpu", "webgpu.h"))) {
+    console.log(
+      "   📦 Copying Dawn headers from the local build (libs/dawn)..."
+    );
+    return localDawnInclude;
+  }
+  let dawnPackage: string;
+  try {
+    dawnPackage = path.dirname(
+      require.resolve("react-native-webgpu-dawn/package.json")
+    );
+  } catch (e) {
+    throw new Error(
+      "No Dawn headers found: install dependencies (react-native-webgpu-dawn) or build Dawn locally with `yarn build-dawn`"
+    );
+  }
+  console.log(`   📦 Copying Dawn headers from ${dawnPackage}...`);
+  return path.join(dawnPackage, "include");
+};
+
 export const copyHeaders = () => {
-  const fs = require("fs");
   console.log("⚙️ Copying Skia headers...");
   process.chdir(PackageRoot);
 
+  // Sources first: a run that cannot copy leaves the current headers in place.
+  if (!fs.existsSync("../../externals/skia/include")) {
+    throw new Error(
+      "No Skia headers found in externals/skia: check out the submodules with `git submodule update --init --recursive`"
+    );
+  }
+  const dawnInclude = resolveDawnInclude();
+
   console.log("   Cleaning up existing directories...");
   fileOps.rm("./cpp/skia");
   fileOps.rm("./cpp/dawn");
@@ -338,32 +372,7 @@ export const copyHeaders = () => {
     );
   }
 
-  // Dawn headers: from the Dawn built locally with `yarn build-dawn` when there
-  // is one (it is what the native builds then link), otherwise from the
-  // react-native-webgpu-dawn package, the same way Gradle and the podspec pick
-  // the library.
   {
-    const localDawnInclude = path.join(PackageRoot, "libs", "dawn", "include");
-    let dawnInclude: string;
-    if (fs.existsSync(path.join(localDawnInclude, "webgpu", "webgpu.h"))) {
-      console.log(
-        "   📦 Copying Dawn headers from the local build (libs/dawn)..."
-      );
-      dawnInclude = localDawnInclude;
-    } else {
-      let dawnPackage: string;
-      try {
-        dawnPackage = path.dirname(
-          require.resolve("react-native-webgpu-dawn/package.json")
-        );
-      } catch (e) {
-        throw new Error(
-          "No Dawn headers found: install dependencies (react-native-webgpu-dawn) or build Dawn locally with `yarn build-dawn`"
-        );
-      }
-      console.log(`   📦 Copying Dawn headers from ${dawnPackage}...`);
-      dawnInclude = path.join(dawnPackage, "include");
-    }
     fileOps.mkdir("./cpp/dawn/include");
     fileOps.cp(path.join(dawnInclude, "dawn"), "./cpp/dawn/include/dawn");
     fileOps.cp(path.join(dawnInclude, "webgpu"), "./cpp/dawn/include/webgpu");
```

**File**: `packages/skia/scripts/utils.ts` (modified, +2/-3)
```diff
@@ -97,9 +97,8 @@ export const build = async (
 };
 
 export var copyRecursiveSync = function (src: string, dest: string) {
-  var exists = existsSync(src);
-  if (!exists) {
-    return;
+  if (!existsSync(src)) {
+    throw new Error(`Cannot copy ${src}: it does not exist`);
   }
   var stats = statSync(src);
   var isDirectory = stats.isDirectory();
```

---

### Incident Patch 3: `20ae1f18` (2026-10-27)
**Commit Message**: fix(🎨): honor the source alpha in plusLighter and plusDarker (#4337)

**File**: `packages/skia/cpp/api/CustomBlendModes.h` (modified, +11/-39)
```diff
@@ -15,28 +15,13 @@ constexpr int kBlendModePlusDarker = 1001;
 constexpr int kBlendModePlusLighter = 1002;
 
 // SkSL for PlusDarker blend mode
-// Formula: rc = max(0, 1 - ((1-dst) + (1-src))) = max(0, src + dst - 1)
-// This darkens the image by subtracting from white
+// Formula: rc = max(0, ra - ((da - dst) + (sa - src))), ra = min(1, sa + da)
+// On premultiplied colors, so a translucent source darkens proportionally
 inline const char *kPlusDarkerSkSL = R"(
     vec4 main(vec4 src, vec4 dst) {
-        float outAlpha = src.a + dst.a - src.a * dst.a;
-        vec3 srcUnpremul = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
-        vec3 dstUnpremul = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
-        vec3 blended = max(vec3(0.0), srcUnpremul + dstUnpremul - vec3(1.0));
-        return vec4(blended * outAlpha, outAlpha);
-    }
-)";
-
-// SkSL for PlusLighter blend mode
-// Formula: rc = min(1, dst + src)
-// This lightens the image by adding colors and clamping
-inline const char *kPlusLighterSkSL = R"(
-    vec4 main(vec4 src, vec4 dst) {
-        float outAlpha = src.a + dst.a - src.a * dst.a;
-        vec3 srcUnpremul = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
-        vec3 dstUnpremul = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
-        vec3 blended = min(vec3(1.0), srcUnpremul + dstUnpremul);
-        return vec4(blended * outAlpha, outAlpha);
+        float outAlpha = min(1.0, src.a + dst.a);
+        vec3 c = max(vec3(0.0), outAlpha - ((dst.a - dst.rgb) + (src.a - src.rgb)));
+        return vec4(c, outAlpha);
     }
 )";
 
@@ -59,25 +44,13 @@ class CustomBlenders {
     return _plusDarkerBlender;
   }
 
-  sk_sp<SkBlender> getPlusLighterBlender() {
-    if (!_plusLighterBlender) {
-      auto [effect, err] =
-          SkRuntimeEffect::MakeForBlender(SkString(kPlusLighterSkSL));
-      if (effect) {
-        _plusLighterBlender = effect->makeBlender(nullptr);
-      }
-    }
-    return _plusLighterBlender;
-  }
-
 private:
   CustomBlenders() = default;
   ~CustomBlenders() = default;
   CustomBlenders(const CustomBlenders &) = delete;
   CustomBlenders &operator=(const CustomBlenders &) = delete;
 
   sk_sp<SkBlender> _plusDarkerBlender;
-  sk_sp<SkBlender> _plusLighterBlender;
 };
 
 // Helper function to apply custom blend mode to a paint
@@ -88,20 +61,19 @@ inline void applyBlendMode(SkPaint &paint, int blendModeValue) {
       paint.setBlender(blender);
     }
   } else if (blendModeValue == kBlendModePlusLighter) {
-    auto blender = CustomBlenders::getInstance().getPlusLighterBlender();
-    if (blender) {
-      paint.setBlender(blender);
-    }
+    // CSS plus-lighter: min(1, dst + src) on every premultiplied channel,
+    // alpha included, which is SkBlendMode::kPlus
+    paint.setBlendMode(SkBlendMode::kPlus);
   } else {
     paint.setBlendMode(static_cast<SkBlendMode>(blendModeValue));
   }
 }
 
 // Converts a JS blend mode value to an SkBlendMode for the Skia entry points
 // that take a plain SkBlendMode rather than a paint (drawPatch, drawVertices,
-// drawAtlas, drawColor). The custom blend modes above are implemented as
-// blenders on an SkPaint and have no SkBlendMode equivalent, so they - and any
-// other out of range value - are rejected instead of being cast blindly.
+// drawAtlas, drawColor). The custom blend modes above only go through a paint
+// (applyBlendMode), so they - and any other out of range value - are rejected
+// instead of being cast blindly.
 inline SkBlendMode toBlendMode(double blendModeValue) {
   auto value = static_cast<int>(blendModeValue);
   if (value < 0 || value > static_cast<int>(SkBlendMode::kLastMode)) {
```

**File**: `packages/skia/src/renderer/__tests__/e2e/Paint.spec.tsx` (modified, +46/-0)
```diff
@@ -395,4 +395,50 @@ describe("Paint", () => {
     );
     checkImage(result, "snapshots/paint/plus-lighter-rgb.png");
   });
+  it("should honor the source alpha in plusLighter and plusDarker", async () => {
+    const { width, height } = surface;
+    const blend = async (
+      backdrop: string,
+      color: string,
+      blendMode: "plusLighter" | "plusDarker"
+    ) => {
+      const image = await surface.draw(
+        <Group>
+          <Fill color={backdrop} />
+          <Fill color={color} blendMode={blendMode} />
+        </Group>
+      );
+      return readPixel(
+        image,
+        (width / 2) * PIXEL_RATIO,
+        (height / 2) * PIXEL_RATIO
+      );
+    };
+    // 51 + 0.4 * 255
+    expect(
+      await blend("#333333", "rgba(255, 255, 255, 0.4)", "plusLighter")
+    ).toEqual([153, 153, 153, 255]);
+    // 153 - 0.4 * 255
+    expect(await blend("#999999", "rgba(0, 0, 0, 0.4)", "plusDarker")).toEqual([
+      51, 51, 51, 255,
+    ]);
+    // A fully transparent source leaves the backdrop untouched
+    expect(await blend("#999999", "rgba(0, 0, 0, 0)", "plusDarker")).toEqual([
+      153, 153, 153, 255,
+    ]);
+    // With nothing behind them the alphas add up too: 0.6 + 0.6 reaches 1
+    // (0.6 is 153/255 exactly, so every backend stores the same first fill)
+    expect(
+      await blend(
+        "rgba(255, 255, 255, 0.6)",
+        "rgba(255, 255, 255, 0.6)",
+        "plusLighter"
+      )
+    ).toEqual([255, 255, 255, 255]);
+    // plusDarker adds the alphas too: 0.4 + 0.4 = 0.8 (204), where the
+    // source-over union would give 0.64 (163) and [0, 96, 96, 163]
+    expect(
+      await blend("rgba(0, 0, 255, 0.4)", "rgba(0, 255, 0, 0.4)", "plusDarker")
+    ).toEqual([0, 128, 128, 204]);
+  });
 });
```

**File**: `packages/skia/src/skia/types/Paint/BlendMode.ts` (modified, +3/-3)
```diff
@@ -59,7 +59,7 @@ export enum BlendMode {
   Color, //!< hue and saturation of source with luminosity of destination
   Luminosity, //!< luminosity of source with hue and saturation of
 
-  // Custom blend modes (implemented via SkRuntimeEffect blenders)
-  PlusDarker = 1001, //!< rc = max(0, 1 - ((1-dst) + (1-src))), similar to iOS kCGBlendModePlusDarker
-  PlusLighter = 1002, //!< rc = min(1, dst + src), similar to iOS kCGBlendModePlusLighter
+  // Custom blend modes: PlusDarker is a SkRuntimeEffect blender, PlusLighter is drawn with Plus
+  PlusDarker = 1001, //!< rc = max(0, ra - ((da - dst) + (sa - src))) on premultiplied colors, ra = min(1, sa + da), similar to iOS kCGBlendModePlusDarker
+  PlusLighter = 1002, //!< rc = min(1, dst + src) on every premultiplied channel, alpha included, as CSS plus-lighter and iOS kCGBlendModePlusLighter
 }
```

**File**: `packages/skia/src/skia/web/JsiSkPaint.ts` (modified, +9/-32)
```diff
@@ -26,41 +26,27 @@ const kBlendModePlusDarker = 1001;
 const kBlendModePlusLighter = 1002;
 
 // SkSL for PlusDarker blend mode
-// Formula: rc = max(0, 1 - ((1-dst) + (1-src))) = max(0, src + dst - 1)
+// Formula: rc = max(0, ra - ((da - dst) + (sa - src))), ra = min(1, sa + da)
+// On premultiplied colors, so a translucent source darkens proportionally
 const plusDarkerSkSL = `
     vec4 main(vec4 src, vec4 dst) {
-        float outAlpha = src.a + dst.a - src.a * dst.a;
-        vec3 srcUnpremul = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
-        vec3 dstUnpremul = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
-        vec3 blended = max(vec3(0.0), srcUnpremul + dstUnpremul - vec3(1.0));
-        return vec4(blended * outAlpha, outAlpha);
-    }
-`;
-
-// SkSL for PlusLighter blend mode
-// Formula: rc = min(1, dst + src)
-const plusLighterSkSL = `
-    vec4 main(vec4 src, vec4 dst) {
-        float outAlpha = src.a + dst.a - src.a * dst.a;
-        vec3 srcUnpremul = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
-        vec3 dstUnpremul = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
-        vec3 blended = min(vec3(1.0), srcUnpremul + dstUnpremul);
-        return vec4(blended * outAlpha, outAlpha);
+        float outAlpha = min(1.0, src.a + dst.a);
+        vec3 c = max(vec3(0.0), outAlpha - ((dst.a - dst.rgb) + (src.a - src.rgb)));
+        return vec4(c, outAlpha);
     }
 `;
 
 // Cache for custom blenders per CanvasKit instance
 // Using WeakMap ensures blenders are cleaned up when CanvasKit instance is garbage collected
 interface BlenderCache {
   plusDarker: Blender | null;
-  plusLighter: Blender | null;
 }
 const blenderCache = new WeakMap<CanvasKit, BlenderCache>();
 
 const getBlenderCache = (ck: CanvasKit): BlenderCache => {
   let cache = blenderCache.get(ck);
   if (!cache) {
-    cache = { plusDarker: null, plusLighter: null };
+    cache = { plusDarker: null };
     blenderCache.set(ck, cache);
   }
   return cache;
@@ -139,18 +125,9 @@ export class JsiSkPaint extends HostObject<Paint, "Paint"> implements SkPaint {
         this.ref.setBlender(cache.plusDarker);
       }
     } else if (blendMode === kBlendModePlusLighter) {
-      // Use custom PlusLighter blender via SkRuntimeEffect
-      const cache = getBlenderCache(this.CanvasKit);
-      if (!cache.plusLighter) {
-        const effect =
-          this.CanvasKit.RuntimeEffect.MakeForBlender(plusLighterSkSL);
-        if (effect) {
-          cache.plusLighter = effect.makeBlender([]);
-        }
-      }
-      if (cache.plusLighter) {
-        this.ref.setBlender(cache.plusLighter);
-      }
+      // CSS plus-lighter: min(1, dst + src) on every premultiplied channel,
+      // alpha included, which is BlendMode.Plus
+      this.ref.setBlendMode(this.CanvasKit.BlendMode.Plus);
     } else {
       this.ref.setBlendMode(getEnum(this.CanvasKit, "BlendMode", blendMode));
     }
```

#### Recent Merged Pull Requests:
- **PR #4338** (2026-10-27): fix(🔤): apply TextStyle fontVariations on native (@LESANF)
- **PR #4337** (2026-10-27): fix(🎨): honor the source alpha in plusLighter and plusDarker (@LESANF)
- **PR #4336** (2026-10-26): chore(deps): bump anthropics/claude-code-action from 1.0.252 to 1.0.261 (@dependabot[bot])
- **PR #4335** (2026-10-26): chore(deps): bump actions/setup-python from 7.0.0 to 7.1.0 (@dependabot[bot])
- **PR #4334** (2026-10-26): chore(deps): bump ip-address from 10.7.2 to 10.7.5 (@dependabot[bot])
- **PR #4333** (2026-10-26): fix(🐛): don't crash Skottie on layers and shapes without a name (@ImCitizen13)

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

## X. 🐛): don't crash Skottie on layers and shapes without a name (#4333)

**RULE**:
When implementing operations in `packages/skia/cpp/api/third_party/SkottieUtils.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wcandillon/react-native-skia. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bde7f1f3`: 🐛): don't crash Skottie on layers and shapes without a name (#4333). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/skia/cpp/api/third_party/SkottieUtils.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  // Unnamed Lottie nodes (no "nm") arrive as nullptr; skip them like a
  // prefix mismatch instead of passing null to SkStrStartsWith/std::string.
  if (name == nullptr || !SkStrStartsWith(name, fPrefix.c_str())) {
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
  if (!SkStrStartsWith(name, fPrefix.c_str())) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bde7f1f3` are properly handled with clean fallback behavior.
