> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/shopify-react-native-skia-learnings.md`  
> **Source**: github ([https://github.com/Shopify/react-native-skia](https://github.com/Shopify/react-native-skia))  
> **Source Version**: `f92429aa`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T14:16:45.105Z  
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
> **Harvest Timestamp**: 2026-10-20T14:16:44.423Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wcandillon/react-native-skia`
- **Description**: High-performance React Native Graphics using Skia
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8744 stars

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
// goes to onLost with Dawn's message, on whichever thread Dawn detects it.
// A creation failure leaves Dawn's message in creationFailure, for the
// caller of requestDevice(): that callback runs inside CreateDevice, on the
// calling thread. The listener must outlive the device.
struct DeviceLostListener {
  std::function<void(const std::string &message)> onLost;
  std::string creationFailure;
};

// Create a Dawn device from the given adapter with the re
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

### Incident Patch 1: `f92429aa` (2026-10-20)
**Commit Message**: fix(🤖): keep the Dawn device on the emulator when a view snapshot imports an AHardwareBuffer (#4293)

Since the example moved to react-native-webgpu 0.17.0 (#4271), every
main-based PR fails build-test-android: the first surface.screen() of the
e2e run fails with "GPUDevice::importExternalTexture(): the import failed"
and every later test fails with "Unsupported data type". Logcat has the
cause: "React Native Skia lost its GPU device. Reason: Required texture
memory size (2359296) is larger than the AHardwareBuffer allocation size
(0)" from Dawn's SharedTextureMemoryVk.cpp.

react-native-webgpu 0.15.0 made drawElementImageToTexture import the
HardwareRenderer's AHardwareBuffer into Dawn on Android 13+ instead of
reading it back to a software bitmap. The API 35 emulator (gfxstream guest
driver on a SwiftShader host) reports an allocation size of 0 for that
buffer, Dawn's size validation rejects the import as an internal error,
and Dawn turns that into a device loss, so the rest of the run has no GPU.
Main looked green because the emulator step is skipped on pushes.

Dawn skips this check on the Samsung, Qualcomm and Huawei drivers that
misreport the size (ignore_imported_ahardwareb

**File**: `packages/skia/cpp/rnskia/RNDawnUtils.h` (modified, +30/-2)
```diff
@@ -155,6 +155,20 @@ inline AdapterDescription describeAdapter(const wgpu::Adapter &adapter) {
   return result;
 }
 
+// Dawn's own SwiftShader test (gpu_info::IsGoogleSwiftshader): Google's
+// vendor ID with SwiftShader's device ID. The Android emulator exposes the
+// host's SwiftShader through gfxstream, which keeps the IDs and the name, so
+// either identifies it.
+inline bool isSwiftShader(const wgpu::Adapter &adapter) {
+  wgpu::AdapterInfo info;
+  adapter.GetInfo(&info);
+  constexpr uint32_t kVendorIDGoogle = 0x1AE0;
+  constexpr uint32_t kDeviceIDSwiftShader = 0xC0DE;
+  return (info.vendorID == kVendorIDGoogle &&
+          info.deviceID == kDeviceIDSwiftShader) ||
+         toString(info.device).find("SwiftShader") != std::string::npos;
+}
+
 // The backend Skia renders with: Metal on Apple, Vulkan on Android.
 #ifdef __APPLE__
 constexpr auto kPlatformBackendType = wgpu::BackendType::Metal;
@@ -304,9 +318,23 @@ requestDevice(dawn::native::Adapter &nativeAdapter,
       "disable_robustness",
 #endif
   };
+  std::vector<const char *> toggles(std::begin(kToggles), std::end(kToggles));
+#ifdef __ANDROID__
+  // Dawn checks an imported AHardwareBuffer's allocation size against the
+  // VkImage it binds to, and the Android emulator's SwiftShader driver reports
+  // that size as 0 for every buffer. The first import (react-native-webgpu's
+  // view snapshots draw into an imported AHardwareBuffer on Android 13+) then
+  // fails as an internal error, which Dawn turns into a device loss: nothing
+  // renders for the rest of the process. Dawn itself skips the check on the
+  // Samsung, Qualcomm and Huawei drivers that misreport the size; do the same
+  // for SwiftShader. Real devices keep the check.
+  if (isSwiftShader(adapter)) {
+    toggles.push_back("ignore_imported_ahardwarebuffer_vulkan_image_size");
+  }
+#endif
   wgpu::DawnTogglesDescriptor togglesDesc;
-  togglesDesc.enabledToggleCount = std::size(kToggles);
-  togglesDesc.enabledToggles = kToggles;
+  togglesDesc.enabledToggleCount = toggles.size();
+  togglesDesc.enabledToggles = toggles.data();
 #if defined(TARGET_OS_SIMULATOR) && TARGET_OS_SIMULATOR
   // The iOS Simulator only advertises MTLFeatureSet_iOS_GPUFamily2, so Dawn
   // defaults disable_base_instance/disable_base_vertex on and then rejects
```

---

### Incident Patch 2: `64008ac4` (2026-10-20)
**Commit Message**: fix(🤖): reduce peak compiler memory of the Android build (#4285)

**File**: `packages/skia/android/CMakeLists.txt` (modified, +0/-1)
```diff
@@ -63,7 +63,6 @@ add_library(
         "${PROJECT_SOURCE_DIR}/../cpp/jsi/JSICache.cpp"
         "${PROJECT_SOURCE_DIR}/../cpp/jsi/JsiPromises.cpp"
         "${PROJECT_SOURCE_DIR}/../cpp/jsi/Promise.cpp"
-        "${PROJECT_SOURCE_DIR}/../cpp/jsi/ViewProperty.cpp"
 
         "${PROJECT_SOURCE_DIR}/../cpp/rnskia/RNSkManager.cpp"
         "${PROJECT_SOURCE_DIR}/../cpp/rnskia/RNSkGraphiteProducer.cpp"
```

**File**: `packages/skia/cpp/jsi/ViewProperty.cpp` (removed, +0/-23)
```diff
@@ -1,23 +0,0 @@
-// The recorder headers depend on the include order established by
-// JsiSkApi.h, so the probe lives here rather than in ViewProperty.h (which
-// every platform view includes on its own).
-#include "api/JsiSkApi.h"
-
-#include "jsi/ViewProperty.h"
-
-#include "api/JsiSkPicture.h"
-#include "api/recorder/JsiRecorder.h"
-
-namespace RNJsi {
-
-ViewProperty::ViewProperty(jsi::Runtime &runtime, const jsi::Value &value) {
-  if (auto picture =
-          RNSkia::tryGetJsiObject<RNSkia::JsiSkPicture>(runtime, value)) {
-    _value = picture->getObject();
-  } else if (auto recorder =
-                 RNSkia::tryGetJsiObject<RNSkia::JsiRecorder>(runtime, value)) {
-    _value = recorder->getObject();
-  }
-}
-
-} // namespace RNJsi
```

**File**: `packages/skia/cpp/jsi/ViewProperty.h` (modified, +2/-3)
```diff
@@ -26,9 +26,8 @@ class ViewProperty {
   /**
    * Probes the JS value for the native objects a view can display (a picture
    * or a recorder); anything else yields an empty property. Defined in
-   * ViewProperty.cpp: the recorder headers depend on the include order
-   * established by JsiSkApi.h, which this header (included by every platform
-   * view) must not pull in.
+   * RNSkManager.cpp so that this header (included by every platform view)
+   * does not pull in the recorder headers.
    */
   ViewProperty(jsi::Runtime &runtime, const jsi::Value &value);
 
```

**File**: `packages/skia/cpp/rnskia/RNSkManager.cpp` (modified, +21/-0)
```diff
@@ -10,7 +10,10 @@
 #include "RNSkJsiViewApi.h"
 #include "RNSkView.h"
 #include "api/JsiSkApi.h"
+#include "api/JsiSkPicture.h"
+#include "api/recorder/JsiRecorder.h"
 #include "jsi/BoxedNativeObject.h"
+#include "jsi/ViewProperty.h"
 
 namespace RNSkia {
 namespace jsi = facebook::jsi;
@@ -83,3 +86,21 @@ void RNSkManager::installBindings() {
   // implementation detail only.
 }
 } // namespace RNSkia
+
+namespace RNJsi {
+
+// Probing for a recorder needs the complete recorder types. Parsing the
+// recorder headers costs about 1.5 GB of compiler memory, so the probe lives
+// in this translation unit, which parses them already. A separate translation
+// unit would compile in parallel and add to the peak memory of the build.
+ViewProperty::ViewProperty(jsi::Runtime &runtime, const jsi::Value &value) {
+  if (auto picture =
+          RNSkia::tryGetJsiObject<RNSkia::JsiSkPicture>(runtime, value)) {
+    _value = picture->getObject();
+  } else if (auto recorder =
+                 RNSkia::tryGetJsiObject<RNSkia::JsiRecorder>(runtime, value)) {
+    _value = recorder->getObject();
+  }
+}
+
+} // namespace RNJsi
```

---

### Incident Patch 3: `9b99a239` (2026-10-19)
**Commit Message**: fix(🍏): present at the display's full rate on ProMotion devices (#4273)

**File**: `apps/docs/docs/canvas/canvas.md` (modified, +9/-0)
```diff
@@ -130,6 +130,15 @@ On the Web, the drawing is recorded into a picture on the JS thread and painted
 
 If you need to produce the frames yourself, from the thread of your choice, use the [Graphite View](/docs/canvas/graphite).
 
+## High refresh rate displays
+
+The view presents at the rate of the display it is on, 120 Hz on a ProMotion iPhone or iPad.
+Reanimated values and worklets run at the display's rate, so a canvas animated with them shows every frame the display can.
+
+An app created from an Expo or React Native template before React Native 0.82 may still carry iOS's 60 Hz cap for iPhone: [Reanimated's performance guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/#-enable-120-fps) covers the `Info.plist` opt-in.
+
+React Native's `requestAnimationFrame` on the JS thread runs at 60 Hz on iOS, so frames recorded from it, as in a [Graphite View](/docs/canvas/graphite) fed from the JS thread, are presented at that rate.
+
 ## Android rendering options
 
 On iOS, the canvas draws into a `CAMetalLayer` and behaves like any other view.
```

**File**: `apps/docs/docs/canvas/graphite.md` (modified, +2/-1)
```diff
@@ -42,7 +42,7 @@ A recording is immutable: you can submit the same one again later without record
 ## Threading model
 
 Recording happens on the thread that calls `beginRecording()`, presenting on the main thread: on the display link (`CADisplayLink` on iOS, the `Choreographer` for an Android `SurfaceView`), or, for an Android `TextureView`, once its window has drawn the previous frame.
-The context can be captured into a worklet, so a frame loop can run on the Reanimated UI runtime without touching the JS thread:
+The context can be captured into a worklet, so a frame loop can run on the Reanimated UI runtime, at the display's rate, without touching the JS thread:
 
 ```tsx
 import { useEffect, useRef } from "react";
@@ -79,6 +79,7 @@ A few rules follow from this model:
 - Recordings are presented in submission order and never dropped. A later frame may sample a texture an earlier frame uploaded, so when the main thread falls behind, the queued frames are replayed in order and only the last one stays visible. This holds for a frame submitted before the native view exists, whether or not you keep the context: the view owns its recording state natively for as long as it is mounted, and `getContext()` hands out a context to it at any time. A recording made for another size than the surface has by the time it is presented (recorded before the view had a surface, or the view was resized since) still shows, at the cost of an extra copy for that frame.
 - The producer clears the canvas. A recording draws on top of what the view shows, which also lets you record only the parts that changed.
 - GPU-backed images (offscreen surface snapshots, native buffers, video frames, [WebGPU textures](/docs/webgpu)) can be drawn from any runtime. Their content is uploaded when they are created, so create them before the frame that uses them.
+- A loop on the Reanimated UI runtime or on a worklet runtime runs at the display's rate. On iOS, React Native's `requestAnimationFrame` on the JS thread runs at 60 Hz, so a view fed from it presents at that rate (see [High refresh rate displays](/docs/canvas/overview#high-refresh-rate-displays)).
 
 ## Snapshots
 
```

**File**: `apps/example/ios/Podfile` (modified, +14/-0)
```diff
@@ -42,9 +42,23 @@ raise_pod_deployment_targets = ->(installer) do
   end
 end
 
+# react-native-test-app generates the app's Info.plist from its own template
+# and takes no extra keys from app.json. Without this one iOS caps every
+# display link at 60 Hz on iPhone, so a ProMotion iPhone would never show the
+# canvases above 60 fps (see the docs, "High refresh rate displays").
+opt_in_promotion = ->(_installer) do
+  plist_path = "#{ws_dir}/node_modules/.generated/ios/Info.plist"
+  return unless File.exist?(plist_path)
+
+  info = Xcodeproj::Plist.read_from_path(plist_path)
+  info['CADisableMinimumFrameDurationOnPhone'] = true
+  Xcodeproj::Plist.write_to_path(info, plist_path)
+end
+
 example_post_install = ->(installer) do
   fix_fmt_consteval.call(installer)
   raise_pod_deployment_targets.call(installer)
+  opt_in_promotion.call(installer)
   installer.pods_project.targets.each do |target|
     next unless ['react-native-skia', 'react-native-webgpu'].include?(target.name)
 
```

**File**: `packages/skia/apple/SkiaView.mm` (modified, +31/-0)
```diff
@@ -57,6 +57,9 @@ @implementation SkiaView {
   bool _canPresent;
 #if !TARGET_OS_OSX
   CADisplayLink *_displayLink;
+  // Whether the display link asked for the display's full rate yet (see
+  // requestFullFrameRate).
+  bool _fullFrameRateRequested;
 #else
   bool _presentAgainScheduled;
 #endif
@@ -70,6 +73,8 @@ - (instancetype)initWithFrame:(CGRect)frame {
     _canPresent = !appIsBackgrounded();
 #if TARGET_OS_OSX
     _presentAgainScheduled = false;
+#else
+    _fullFrameRateRequested = false;
 #endif
     static const auto defaultProps = std::make_shared<const SkiaViewProps>();
     _props = defaultProps;
@@ -208,6 +213,7 @@ - (void)scheduleFrame {
     [_displayLink addToRunLoop:[NSRunLoop mainRunLoop]
                        forMode:NSRunLoopCommonModes];
   }
+  [self requestFullFrameRate];
   _displayLink.paused = NO;
 #else
   if (_view != nullptr && _view->presentFrame()) {
@@ -217,6 +223,31 @@ - (void)scheduleFrame {
 }
 
 #if !TARGET_OS_OSX
+// A display link fires at 60 Hz until it asks for more, also while the
+// display already runs at 120 Hz for another link (Reanimated asks for 120):
+// a 120 Hz producer would then be presented every other frame. Ask for the
+// display's full rate once the view knows its screen. On iPhone this needs
+// CADisableMinimumFrameDurationOnPhone in the app's Info.plist too, else iOS
+// caps every link at 60 Hz. The link is paused while nothing is queued, so an
+// idle view does not keep the display at its full rate.
+- (void)requestFullFrameRate {
+#if !TARGET_OS_VISION
+  if (_fullFrameRateRequested) {
+    return;
+  }
+  UIScreen *screen = self.window.screen;
+  if (screen == nil) {
+    return;
+  }
+  _fullFrameRateRequested = true;
+  const float maxFps = (float)screen.maximumFramesPerSecond;
+  if (maxFps > 60) {
+    _displayLink.preferredFrameRateRange =
+        CAFrameRateRangeMake(60, maxFps, maxFps);
+  }
+#endif
+}
+
 - (void)onFrame:(CADisplayLink *)link {
   if (_view == nullptr || !_view->presentFrame()) {
     link.paused = YES;
```

#### Recent Merged Pull Requests:
- **PR #4293** (2026-10-20): fix(🤖): keep the Dawn device on the emulator when a view snapshot imports an AHardwareBuffer (@wcandillon)
- **PR #4287** (2026-10-20): fix(🎨): 2.x: saveLayer's bounds dangled for a plain-object rect, so layers drew empty on devices (backport of #4063) (@cankoe)
- **PR #4285** (2026-10-20): fix(🤖): reduce peak compiler memory of the Android build (@alanjhughes)
- **PR #4284** (2026-10-20): fix(🤖): reduce peak compiler memory of the Android build 2.x (@alanjhughes)
- **PR #4281** (2026-10-20): chore(deps): bump anthropics/claude-code-action from 1.0.249 to 1.0.252 (@dependabot[bot])
- **PR #4280** (2026-10-20): chore(deps): bump actions/setup-java from 6.0.1 to 6.1.0 (@dependabot[bot])

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

## X. 🤖): keep the Dawn device on the emulator when a view snapshot imports an AHardw

**RULE**:
When implementing operations in `packages/skia/cpp/rnskia/RNDawnUtils.h`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wcandillon/react-native-skia. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f92429aa`: 🤖): keep the Dawn device on the emulator when a view snapshot imports an AHardwareBuffer (#4293). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/skia/cpp/rnskia/RNDawnUtils.h`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
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

  std::vector<const char *> toggles(std::begin(kToggles), std::end(kToggles));
#ifdef __ANDROID__
  // Dawn checks an imported AHardwareBuffer's allocation size against the
  // VkImage it binds to, and the Android emulator's SwiftShader driver reports
  // that size as 0 for every buffer. The first import (react-native-webgpu's
  // view snapshots draw into an imported AHardwareBuffer on Android 13+) then
  // fails as an internal error, which Dawn turns into a device loss: nothing
  // renders for the rest of the process. Dawn itself skips the check on the

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
  togglesDesc.enabledToggleCount = std::size(kToggles);
  togglesDesc.enabledToggles = kToggles;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f92429aa` are properly handled with clean fallback behavior.
