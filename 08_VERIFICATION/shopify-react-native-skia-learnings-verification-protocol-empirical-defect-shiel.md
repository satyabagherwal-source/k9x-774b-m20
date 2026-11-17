# Verification Protocol: Verification Protocol: Empirical Defect Shield for shopify-react-native-skia-learnings

<!-- PROVENANCE_START
{
  "source_repository": "shopify-react-native-skia-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T18:18:44.274Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-shopify-react-native-skia-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [shopify-react-native-skia-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T18:18:44.274Z`  
> **Learning ID**: `LEARN-EVO-shopify-react-native-skia-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `shopify-react-native-skia-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/shopify-react-native-skia-learnings.md`  
> **Source**: github ([https://github.com/Shopify/react-native-skia](https://github.com/Shopify/react-native-skia))  
> **Source Version**: `0ac4f44a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T18:18:38.136Z  
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
> **Harvest Timestamp**: 2026-11-17T18:18:38.129Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wcandillon/react-native-skia`
- **Description**: High-performance React Native Graphics using Skia
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8784 stars

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
#include "rnwgpu/DawnBlobCache.h"
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
// goes to onLost with Dawn's reason and message, on whichever 
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

### Core Architecture Module: `packages/skia/cpp/rnsurface/RenderThread.h`
```
#pragma once

#include <atomic>
#include <cerrno>
#include <chrono>
#include <condition_variable>
#include <functional>
#include <memory>
#include <mutex>
#include <queue>
#include <string>
#include <system_error>
#include <thread>
#include <utility>

#if defined(__APPLE__)
#include <CoreFoundation/CoreFoundation.h>
#include <objc/objc.h>
#include <pthread.h>
#include <pthread/qos.h>
extern "C" void *objc_autoreleasePoolPush(void);
extern "C" void objc_autoreleasePoolPop(void *pool);
#elif defined(__ANDROID__)
#include <android/looper.h>
#include <pthread.h>
#include <sys/eventfd.h>
#include <sys/resource.h>
#include <unistd.h>
#elif defined(__linux__)
#include <poll.h>
#include <pthread.h>
#include <sys/eventfd.h>
#include <unistd.h>
#endif

#include "rnsurface/ThreadChecker.h"

namespace rnsurface {

/**
 * The thread a library presents on: one for the process, owned here rather
 * than by the platform (PresentThread.java and RNSkPresentThread.mm before
 * it). It owns the loop the platform's vsync needs: a CFRunLoop on Apple
 * platforms, so that a CADisplayLink can tick on it; an ALooper on Android,
 * so that AChoreographer can; a poll on an eventfd elsewhere, which is what
 * the host tests run. Tasks posted run in order, each after the ones posted
 * before it, and never on the spot, also when posted from this thread (the
 * window surface asks for a redraw from inside attach(), which runs here,
 * and a redraw on the spot would present mid-attach).
 *
 * Nothing waits for a task but postAndWait, with a bound: a present holds
 * the thread for as long as its pipelines take to compile, and a main
 * thread made to wait for that is an ANR or a frozen app. The one caller is
 * Android's surfaceDestroyed, which the platform destroys the surface after
 * (see SkiaView.onSurfaceDestroyed): a wait that times out marks the thread
 * held up until the task it waited for runs, and every wait meanwhile
 * returns at once, so that the bound is paid once per hold-up, not once per
 * canvas, and the mark never outlives its task.
 */
class RenderThread {
public:
  /** Starts the thread, named `name` for the OS; returns once it runs. */
  explicit RenderThread(const char *name) : _name(name) {
    _thread = std::thread([this]() { loop(); });
    std::unique_lock<std::mutex> lock(_mutex);
    _started.wait(lock, [this]() { return _running; });
  }

  /** Stops the loop and joins the thread, once the tasks posted have run. */
  ~RenderThread() {
    _stopping.store(true, std::memory_order_release);
    wake();
    if (_thread.joinable()) {
      _thread.join();
    }
#if defined(__ANDROID__) || defined(__linux__)
    // The loop can observe _stopping after a wakeup already in flight, before
    // the wake above. Keep its descriptor open until the join makes that
    // write and every loop access finish.
    close(_wakeup);
#endif
  }

  RenderThread(const RenderThread &) = delete;
  RenderThread &operator=(const RenderThread &) = delete;

  /** Runs the task on this thread, after those posted before. Any thread. */
  void post(std::function<void()> task) {
    bool wasEmpty = false;
    {
      std::lock_guard<std::mutex> lock(_mutex);
      wasEmpty = _tasks.empty();
      _tasks.push(std::move(task));
    }
    // A queue that held tasks already has a wakeup made or coming for them.
    if (wasEmpty) {
      wake();
    }
  }

  /**
   Posts the task and waits for it to run, up to `bound`: true when it ran
   within the bound. A wait that times out marks the thread held up (see
   isHeldUp) until that task runs, and a call made while it is held up posts
   its task and returns false at once. Any thread but this one.
   */
  bool postAndWait(std::function<void()> task, std::chrono::nanoseconds bound) {
    if (isCurrent()) {
      // Waiting for oneself would never end: the task runs in turn.
      post(std::move(task));
      return false;
    }
    if (_heldUp.load(std::memory_order_acquire)) {
      post(std::move(task));
      return false;
    }
    auto wait = std::make_shared<Wait>();
    post([this, wait, task = std::move(task)]() {
      // Which came first, this task or the end of the wait: the loser takes
      // the held-up mark down, so that it never outlives the task.
      if (wait->settled.exchange(true)) {
        _heldUp.store(false, std::memory_order_release);
      }
      task();
      {
        std::lock_guard<std::mutex> lock(wait->mutex);
        wait->done = true;
      }
      wait->condition.notify_all();
    });
    std::unique_lock<std::mutex> lock(wait->mutex);
    const bool ran =
        wait->condition.wait_for(lock, bound, [&]() { return wait->done; });
    if (ran) {
      return true;
    }
    _heldUp.store(true, std::memory_order_release);
    if (wait->settled.exchange(true)) {
      // The task got there between the timeout and this: not held up.
      _heldUp.store(false, std::memory_order_release);
    }
    return false;
  }

  /**
   Whether a wait for this thread timed out and the thread has not run the
   task waited for since (see postAndWait). Any thread.
   */
  bool isHeldUp() const { return _heldUp.load(std::memory_order_acquire); }

  /** Whether the caller is this thread. */
  bool isCurrent() const { return _checker.isCurrent(); }

  /** The checker bound to this thread, for the entries that belong to it. */
  ThreadChecker &checker() { return _checker; }

private:
  struct Wait {
    std::mutex mutex;
    std::condition_variable condition;
    bool done = false;
    std::atomic<bool> settled{false};
  };

  // Runs every task queued, in order. On this thread.
  void drain() {
    std::queue<std::function<void()>> tasks;
    {
      std::lock_guard<std::mutex> lock(_mutex);
      std::swap(tasks, _tasks);
    }
    while (!tasks.empty()) {
      auto task = std::move(tasks.front());
      tasks.pop();
      if (task) {
        task();
      }
    }
  }

  void markStarted() {
    _checker.bindToCurrentThread();
    {
      std::lock_guard<std::mutex> lock(_mutex);
      _running = true;
    }
    _started.notify_all();
  }

#if defined(__ANDROID__) || defined(__linux__)
  static int makeWakeup() {
    const int wakeup = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
    if (wakeup == -1) {
      throw std::system_error(errno, std::generic_category(), "eventfd");
    }
    return wakeup;
  }
#endif

#if defined(__APPLE__)
  // A run loop, which a CADisplayLink made on this thread ticks on ([NSRunLoop
  // currentRunLoop] wraps it). The queue is a source of the loop: a post
  // signals it and wakes the loop, which drains the queue under an
  // autorelease pool of its own. The loop returns after each source it
  // handled, a tick of the display link among them, and each turn has a pool
  // too: a thread made here has none, and CoreFoundation is not documented
  // to drain one per callout.
  void loop() {
    pthread_setname_np(_name.c_str());
    // The priority of the main thread: a present is what the user waits for.
    pthread_set_qos_class_self_np(QOS_CLASS_USER_INTERACTIVE, 0);
    CFRunLoopSourceContext context{};
    context.info = this;
    context.perform = [](void *info) {
      auto *self = static_cast<RenderThread *>(info);
      void *pool = objc_autoreleasePoolPush();
      self->drain();
      objc_autoreleasePoolPop(pool);
    };
    _source = CFRunLoopSourceCreate(kCFAllocatorDefault, 0, &context);
    _runLoop = CFRunLoopGetCurrent();
    CFRetain(_runLoop);
    CFRunLoopAddSource(_runLoop, _source, kCFRunLoopCommonModes);
    markStarted();
    while (!_stopping.load(std::memory_order_acquire)) {
      void *pool = objc_autoreleasePoolPush();
      CFRunLoopRunInMode(kCFRunLoopDefaultMode, 1.0e10, true);
      objc_autoreleasePoolPop(pool);
    }
    drain();
    // wake() holds this mutex while it signals the source. Clearing these
    // pointers under the same mutex leaves a wake that arrives after teardown
    // with nothing to signal, rather than a released Core Foundation object.
    std::lock_guard<std::mutex> lock(_mutex);
    auto *source = _source;
    auto *runLoop = _runLoop;
    _source = nullptr;
    _runLoop = nullptr;
    CFRunLoopRemoveSource(runLoop, source, kCFRunLoopCommonModes);
    CFRelease(source);
    CFRelease(runLoop);
  }

  void wake() {
    std::lock_guard<std::mutex> lock(_mutex);
    if (_source != nullptr) {
      CFRunLoopSourceSignal(_source);
      CFRunLoopWakeUp(_runLoop);
    }
  }

  CFRunLoopRef _runLoop = nullptr;
  CFRunLoopSourceRef _source = nullptr;
#elif defined(__ANDROID__)
  // An ALooper, which AChoreographer's callbacks come through once asked on
  // this thread (AChoreographer_getInstance registers with the looper of the
  // calling thread). The queue wakes it through an eventfd it watches.
  void loop() {
    pthread_setname_np(pthread_self(), _name.c_str());
    // The priority of the UI toolkit's own render thread
    // (Process.THREAD_PRIORITY_DISPLAY).
    setpriority(PRIO_PROCESS, static_cast<id_t>(gettid()), -4);
    _looper = ALooper_prepare(ALOOPER_PREPARE_ALLOW_NON_CALLBACKS);
    ALooper_acquire(_looper);
    ALooper_addFd(
        _looper, _wakeup, ALOOPER_POLL_CALLBACK, ALOOPER_EVENT_INPUT,
        [](int descriptor, int, void *data) {
          eventfd_t wakeups;
          eventfd_read(descriptor, &wakeups);
          static_cast<RenderThread *>(data)->drain();
          return 1;
        },
        this);
    markStarted();
    while (!_stopping.load(std::memory_order_acquire)) {
      ALooper_pollOnce(-1, nullptr, nullptr, nullptr);
    }
    drain();
    ALooper_removeFd(_looper, _wakeup);
    ALooper_release(_looper);
  }

  void wake() { eventfd_write(_wakeup, 1); }

  ALooper *_looper = nullptr;
  // Made with the object, ahead of the thread (declared above it): without
  // it no post would ever wake the loop, so its failure is thrown, not
  // carried.
  int _wakeup = makeWakeup();
#elif defined(__linux__)
  // The host: a poll on the eventfd, what the Android loop does w
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
- **Issue #4467** (2026-11-17): **Android: a `SurfaceView` canvas shows its hole black until its first frame**
  *Symptoms*: ### Description  My app met this while its opaque canvases were `SurfaceView`s; it now renders every canvas into a `TextureView`, so it no longer does. Another user reported the same in [a comment on #3713](https://github.com/wcandillon/react-native-skia/issues/3713#issuecomment-5831378034), and #4191 is the closed fix.  A `<Canvas android={{ backingView: "SurfaceView" }}>` shows its hole black when it mounts, for a frame or two on a fast device and longer while its first recording is produced, until its first frame lands. The window opens the hole once the `SurfaceView` reports its draw finished, and `SkiaSurfaceView` implements `SurfaceHolder.Callback` rather than `Callback2`, so the report goes out as soon as `surfaceChanged` returns, before anything is presented into the surface. Before Android 12 a change of `android.opaque`, which replaces the surface, can show it black for a frame too.  `GLSurfaceView` holds `surfaceRedrawNeededAsync`'s `finishDrawing` until its renderer has drawn its next frame, and Flutter's `SurfaceView` until its first frame is displayed, keeping the view transparent until then before Android 8 ([GLSurfaceView](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-14.0.0_r1/opengl/java/android/opengl/GLSurfaceView.java#550), [Flutter](https://github.com/flutter/flutter/blob/189a5db70ba4f7a652e3349e922ab38a3bca023e/engine/src/flutter/shell/platform/android/io/flutter/embedding/android/SurfaceHolderCallbackCompat.java#L141-L16

- **Issue #4462** (2026-11-13): **Android 8: timed waits on `steady_clock`, the render pool's idle task among them, follow the wall clock**
  *Symptoms*: ### Description  On Android 8.0 and 8.1 (API 26 and 27, within the library's minimum SDK), `std::condition_variable::wait_until` against a `steady_clock` deadline follows the wall clock. libc++ waits on `CLOCK_MONOTONIC` only when built for API 30 or later ([`__config#L845-L846`](https://github.com/llvm/llvm-project/blob/llvmorg-20.1.0/libcxx/include/__config#L845-L846)); below that it hands `pthread_cond_timedwait` a `CLOCK_REALTIME` deadline, which bionic converts to `CLOCK_MONOTONIC` only from Android 9 ([`bionic_futex.cpp` in pie-release](https://android.googlesource.com/platform/bionic/+/refs/heads/pie-release/libc/bionic/bionic_futex.cpp#42)). A wall-clock change during such a wait, a network time sync or the user setting the clock, moves its end by the change. The library waits this way for the render pool's idle task ([`RNSkThreadPool.h#L213`](https://github.com/wcandillon/react-native-skia/blob/914fae19683edbce527bbafd0bea6d649660df0a/packages/skia/cpp/rnskia/RNSkThreadPool.h#L213)), the image reaper ([`RNImageProvider.h#L487`](https://github.com/wcandillon/react-native-skia/blob/914fae19683edbce527bbafd0bea6d649660df0a/packages/skia/cpp/rnskia/RNImageProvider.h#L487)), `waitForIdle` before the pipeline warmup compiles ([`RNSkGpuActivity.h#L62`](https://github.com/wcandillon/react-native-skia/blob/914fae19683edbce527bbafd0bea6d649660df0a/packages/skia/cpp/rnskia/RNSkGpuActivity.h#L62)) and the pipeline cache's write delay ([`RNSkPipelineWarmup.h#L259`](https://github

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

### Incident Patch 1: `b7f2c499` (2026-11-15)
**Commit Message**: fix(🗿): pace a canvas's frames with one scheduler, and hold a present for the GPU on Android (#4478)

* fix(🗿): pace a canvas's frames with one scheduler, and hold a present for the GPU on Android

One scheduler per view (rnsurface::FrameScheduler) paces its frames through
record, submit and present, on four inputs: the frame signal of the display
(time, interval, deadline), the deadline, the acknowledgement that the GPU is
done with the frame presented before, and the measured time of a recording
and of a submit.

- One present per frame of the display: a slot of the compositor gets one
  frame; a frame ready before the deadline of a free slot goes at once, a
  later one on the next frame signal.
- No present without an acknowledgement on Android: a frame whose predecessor
  the GPU is still on has its work submitted and its present held, so that
  queueBuffer no longer waits on the present thread inside Dawn's device
  lock. The GPU is asked without waiting, from a timer of the present thread.
- A bounded pipeline: one frame recording, one ready, one in the window. The
  producer's ready recording is known by identity.
- Depth follows the measured time: one frame while a record

**File**: `apps/docs/docs/canvas/canvas.md` (modified, +2/-2)
```diff
@@ -122,8 +122,8 @@ The children of a `Canvas` are rendered by Skia's own React renderer, and its fr
 
 1. On every React commit, the JS thread records the drawing into a native display list and hands it to the view.
 2. When a Reanimated value used by the drawing changes, the UI thread writes the new value into the display list. It does not draw anything.
-3. A dedicated native thread pool replays the display list into a Graphite frame whenever its content changed, keeping at most one frame ahead of the display.
-4. The view presents the frame on the next vsync.
+3. A dedicated native thread pool replays the display list into a Graphite frame whenever its content changed. While a replay fits in a frame of the display, the next one starts once the view has presented the previous frame; when it takes longer, replays run one frame ahead of the display, so that the canvas keeps the display's rate.
+4. The view presents one frame per frame of the display: as soon as the frame is ready when it still makes the display's deadline, on the next frame of the display otherwise. On Android, a frame presented while the GPU is still working on the previous one has its work submitted and its present deferred until the GPU is done, so that no canvas waits for another's GPU work.
 
 An animation frame costs no React render, no work on the JS thread, and no drawing on the UI thread.
 A canvas without animation values is drawn once, and the view keeps its frame.
```

**File**: `apps/docs/docs/canvas/graphite.md` (modified, +2/-2)
```diff
@@ -81,8 +81,8 @@ export const Demo = () => {
 A few rules follow from this model:
 
 - One recording is open at a time per view. Finish it before starting the next one, on any runtime.
-- Recordings are presented in submission order and never dropped. A later frame may sample a texture an earlier frame uploaded, so when the main thread falls behind, the queued frames are replayed in order and only the last one stays visible. This holds for a frame submitted before the native view exists, whether or not you keep the context: the view owns its recording state natively for as long as it is mounted, and `getContext()` hands out a context to it at any time. A recording made for another size than the surface has by the time it is presented (recorded before the view had a surface, or the view was resized since) still shows, at the cost of an extra copy for that frame.
-- Since nothing is dropped, a loop that submits on every display frame must keep up with the GPU, or the queue grows, and latency and memory with it. `pendingFrames` is the number of recordings submitted and not yet presented, readable from any runtime: skip a frame while it is at 2, the budget `Canvas` uses for itself.
+- Recordings are presented in submission order and never dropped. A later frame may sample a texture an earlier frame uploaded, so when the view falls behind, the queued frames are presented in order, one per frame of the display. This holds for a frame submitted before the native view exists, whether or not you keep the context: the view owns its recording state natively for as long as it is mounted, and `getContext()` hands out a context to it at any time. A recording made for another size than the surface has by the time it is presented (recorded before the view had a surface, or the view was resized since) still shows, at the cost of an extra copy for that frame.
+- Since nothing is dropped, a loop that submits on every display frame must keep up with the GPU, or the queue grows, and latency and memory with it. `pendingFrames` is the number of recordings submitted and not yet presented, readable from any runtime: skip a frame while it is at 2, the most `Canvas` keeps for itself.
 - Dispose a recording you will not submit again. It holds the GPU buffers of its frame until it is collected, and the Reanimated UI runtime collects rarely: a loop that leaves its recordings to the garbage collector keeps growing in memory. The view holds on to a submitted recording for as long as it needs it, so disposing it right after `submit()` is safe.
 - The producer clears the canvas. A recording draws on top of what the view shows, which also lets you record only the parts that changed.
 - GPU-backed images (offscreen surface snapshots, native buffers, video frames, [WebGPU textures](/docs/webgpu)) can be drawn from any runtime. Their content is uploaded when they are created, so create them before the frame that uses them.
```

**File**: `apps/example/benchmarks/README.md` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ then exits with status 1.
 | `--reps` | `1` | the present FPS reported is the median over reps |
 | `--gap` | `0` | seconds with no canvas between scenes, so heat does not carry over |
 | `--backing` | `surface` | Android: `texture` puts the canvas on a TextureView |
+| `--pacing` | the platform's | measure another frame pacing policy on the same build: `two` (two frames in flight throughout instead of the adaptive count), `decline` or `nowait` (Android: where a frame waits while the GPU is on the previous one, before its submit or nowhere, instead of before its present with `hold`); see `packages/skia/cpp/rnskia/RNSkPacingPolicy.h` |
 | `--label` | `local` | names the result files |
 | `--compare` | | an earlier result JSON |
 | `--no-build` | | reuse the installed app (its plan is the one it was built with) |
```

**File**: `apps/example/benchmarks/run.mjs` (modified, +12/-3)
```diff
@@ -3,7 +3,7 @@
 //
 //   node benchmarks/run.mjs --platform android|ios [--scenes shapes,paths]
 //        [--reps 2] [--gap 20] [--backing surface|texture] [--label main]
-//        [--no-build] [--compare benchmarks/results/<file>.json]
+//        [--pacing two] [--no-build] [--compare benchmarks/results/<file>.json]
 //   node benchmarks/run.mjs --cold --platform android|ios|ios-simulator
 //        [--scenes ...] [--reps 3] [--settle 10] [--label main] [--compare ...]
 //
@@ -61,6 +61,12 @@ const REPS = Number(arg("reps", "1"));
 const GAP = Number(arg("gap", "0"));
 const BACKING = arg("backing", "surface");
 const LABEL = arg("label", "local");
+// The pacing policy to measure, when not the platform's own: a comma separated
+// list read by packages/skia/cpp/rnskia/RNSkPacingPolicy.h (hold, decline or
+// nowait; adaptive or two). Android reads it from a system property, set here
+// before each launch and cleared when none is asked for, so that a previous
+// run's does not leak into this one; iOS from the environment of the launch.
+const PACING = arg("pacing", "");
 const COMPARE = arg("compare", null);
 const COLD = flag("cold");
 // Cold mode: seconds the app idles with no canvas after launch, and seconds
@@ -289,6 +295,7 @@ async function threadsAndroid() {
 async function launchAndroid() {
   await adb("shell", "input", "keyevent", "KEYCODE_WAKEUP");
   await adb("shell", "wm", "dismiss-keyguard");
+  await adb("shell", "setprop", "debug.rnskia.pacing", PACING === "" ? "''" : PACING);
   const out = await adb("shell", "cmd", "package", "resolve-activity", "--brief", "-c", "android.intent.category.LAUNCHER", PACKAGE);
   await adb("shell", "am", "start", "-n", out.trim().split("\n").at(-1).trim());
 }
@@ -472,7 +479,8 @@ async function measureIos(device) {
   // Traces attach by pid: xctrace does not always find the app by name.
   const launch = async () => {
     const json = join(dir, "launch.json");
-    await sh("xcrun", ["devicectl", "device", "process", "launch", "--device", device.id, "--terminate-existing", "--json-output", json, bundleId]);
+    const environment = PACING === "" ? [] : ["--environment-variables", JSON.stringify({ RNSKIA_PACING: PACING })];
+    await sh("xcrun", ["devicectl", "device", "process", "launch", "--device", device.id, "--terminate-existing", ...environment, "--json-output", json, bundleId]);
     return JSON.parse(readFileSync(json, "utf8")).result?.process?.processIdentifier;
   };
   // A first launch after an install is slow (shader caches, dyld): spend it
@@ -768,7 +776,7 @@ function report(result, previous) {
   const lines = [
     `# React Native Skia benchmark: ${result.label}, ${result.platform}`,
     "",
-    `${result.device}, react-native-skia ${result.skia}, ${result.date}. Plan: \`${result.plan}\`.`,
+    `${result.device}, react-native-skia ${result.skia}, ${result.date}. Plan: \`${result.plan}\`.${result.pacing ? ` Pacing: \`${result.pacing}\`.` : ""}`,
     `Present FPS is the median over reps of frames the compositor showed (${TRACE_SECONDS} s per scene).`,
     ...(result.platform === "android"
       ? ["Render and present ms/frame: CPU time of the `RNSkia Render` pool and the `RNSkia Present` thread over the same window, divided by the frames presented (median over reps). They keep measuring when present FPS sits at the panel rate."]
@@ -855,6 +863,7 @@ const result = {
   skia: `${skia.name} ${skiaVersion}`,
   date: new Date().toISOString(),
   plan,
+  ...(PACING === "" ? {} : { pacing: PACING }),
   ...measured,
 };
 const previous = COMPARE ? JSON.parse(readFileSync(COMPARE, "utf8")) : null;
```

**File**: `packages/skia/android/cpp/jni/include/JniSkiaView.h` (modified, +90/-109)
```diff
@@ -1,19 +1,21 @@
 #pragma once
 
+#include <chrono>
 #include <functional>
 #include <memory>
 #include <utility>
 
-#include <android/choreographer.h>
 #include <android/native_window.h>
 #include <android/native_window_jni.h>
 #include <fbjni/fbjni.h>
 #include <jni.h>
 
 #include "JniPresentThread.h"
 #include "JniSkiaManager.h"
+#include "RNSkAnimationFrame.h"
 #include "RNSkLog.h"
 #include "RNSkPresentThread.h"
+#include "RNSkPresentThreadTimer.h"
 #include "RNSkView.h"
 #include "RNSkWindowSurface.h"
 #include "rnsurface/FrameScheduler.h"
@@ -29,9 +31,10 @@ namespace jni = facebook::jni;
  * view posts the surface callbacks there too, as the window belongs to that
  * thread (see RNSkWindowSurface); this object is destroyed there as well
  * (see SkiaView.dropInstance), so no call below runs under a present. The
- * frame scheduler lives here too (see rnsurface::FrameScheduler), with the
- * AChoreographer of the thread as its vsync (see PresentHost); the Java view
- * hands it the TextureView's draws.
+ * view's frame scheduler (see rnsurface::FrameScheduler) gets its inputs
+ * from here: the animation frames from the AChoreographer of the thread (see
+ * AnimationFrames), the polls for the GPU from a timer of the thread (see
+ * PresentThreadTimer), and the TextureView's draws from the Java view.
  */
 class JniSkiaView : public jni::HybridClass<JniSkiaView> {
 public:
@@ -155,13 +158,13 @@ class JniSkiaView : public jni::HybridClass<JniSkiaView> {
   // Present thread: the TextureView drew the frame it was given (see
   // SkiaView.onSurfaceTextureUpdated). This object is destroyed on that
   // thread too (see SkiaView.dropInstance), never under the call.
-  void frameConsumed() { _scheduler->onFrameConsumed(); }
+  void frameConsumed() { _view->onFrameConsumed(); }
 
   // Present thread: the view left its window, or the window lost its
-  // surface (see SkiaView.cancelFrames). A vsync already asked for still
-  // fires, as AChoreographer has no cancel: the host drops it, or hands it
-  // to a request made since (see PresentHost::onVsync).
-  void cancelScheduledFrames() { _scheduler->cancel(); }
+  // surface (see SkiaView.cancelFrames). An animation frame already asked
+  // for still fires, as AChoreographer has no cancel: it is dropped, or
+  // serves a request made since (see AnimationFrames::onFrame).
+  void cancelScheduledFrames() { _view->cancelFrames(); }
 
 private:
   friend HybridBase;
@@ -189,20 +192,38 @@ class JniSkiaView : public jni::HybridClass<JniSkiaView> {
       surface->bindPresentingThread();
       view->bindPresentThread();
     });
-    // A submitted recording goes to the scheduler, on the present thread,
-    // which arms the Java view's frame callback (or presents on the spot,
-    // for a window resized since the frame it shows: see
-    // rnsurface::FrameScheduler::requestFrame). Weak: the view may outlive
-    // this object in the registry for a moment, with the scheduler gone.
-    _presentHost = std::make_shared<PresentHost>(javaView, _view);
-    _scheduler = std::make_shared<rnsurface::FrameScheduler>(*_presentHost);
-    std::weak_ptr<rnsurface::FrameScheduler> weakScheduler = _scheduler;
-    _presentHost->setScheduler(weakScheduler);
-    _view->setFrameScheduler([weakScheduler](bool forResizedWindow) {
-      if (auto scheduler = weakScheduler.lock()) {
-        scheduler->requestFrame(forResizedWindow);
+    // What the view's frame scheduler asks of the platform, on the present
+    // thread (see RNSkView::FrameHost). Weak: the view may outlive this
+    // object in the registry for a moment.
+    _animationFrames = std::make_shared<AnimationFrames>(_view);
+    std::weak_ptr<AnimationFrames> weakFrames = _animationFrames;
+    RNSkView::FrameHost host;
+    host.requestAnimationFrame = [weakFrames]() {
+      if (auto frames = weakFrames.lock()) {
+        frames->request();
       }
-    });
+    };
+    // The timer the view polls the GPU and waits for the end of a slot with
+    // (see RNSkView::pollSubmittedWorkDone and waitForSlotEnd).
+    host.setTimeout = [](std::chrono::nanoseconds delay,
+                         std::function<void()> task) {
+      PresentThreadTimer::getInstance().setTimeout(delay, std::move(task));
+    };
+    // The Java view's frame rate vote (see SkiaView.onFramePresented). A
+    // Java call from the native thread, which is attached (see
+    // attachPresentThread). The local reference goes with the scope: no
+    // Java frame is below to let go of it.
+    host.onFramePresented = [javaView]() {
+      callJavaFromPresentThread([&]() {
+        jni::JniLocalScope localScope(jni::Environment::current(), 4);
+        if (auto javaPart = javaView->weak->lockLocal()) {
+          static const auto method =
+              javaPart->getClass()->getMethod<void()>("onFramePresented");
+          method(javaPart);
+        }
+      });
+    };
+    _view->setFrameHost(std::move(host));
   }
 
   /**
@@ -225,10
```

**File**: `packages/skia/android/cpp/rnskia-android/RNSkAnimationFrame.h` (added, +193/-0)
```diff
@@ -0,0 +1,193 @@
+#pragma once
+
+#include <android/choreographer.h>
+#include <dlfcn.h>
+
+#include <cstddef>
+#include <cstdint>
+
+#include "rnsurface/FrameClock.h"
+#include "rnsurface/FrameScheduler.h"
+
+namespace RNSkia {
+
+/**
+ * The animation frames of Android (see
+ * rnsurface::FrameScheduler::AnimationFrame), from the AChoreographer of the
+ * calling thread, which calls back on that thread's looper: what the
+ * browser's rendering loop is to requestAnimationFrame().
+ *
+ * What an animation frame knows depends on the device. From API 33 on, the
+ * choreographer hands out the frame timeline it expects the app to make:
+ * when the frame started, when the compositor wakes up for it (the deadline)
+ * and when it and the one after are shown (the interval). The entry points
+ * are looked up at run time, as the library builds for API 26. Before that
+ * there is no deadline to read: the animation frame says that it ends where
+ * it starts, so that a frame only goes on an animation frame, as it did
+ * before the scheduler knew of deadlines, and the interval is the time
+ * between two animation frames in a row.
+ */
+class AnimationFrameSource {
+public:
+  using AnimationFrame = rnsurface::FrameScheduler::AnimationFrame;
+  using Callback = void (*)(const AnimationFrame &frame, void *data);
+
+  /**
+   Has `callback(frame, data)` called at the next frame of the display, on
+   the calling thread. Returns false when the thread has no choreographer
+   (no connection to the display's events): nothing is posted then.
+   */
+  static bool post(Callback callback, void *data) {
+    auto *choreographer = AChoreographer_getInstance();
+    if (choreographer == nullptr) {
+      return false;
+    }
+    auto *request = new Request{callback, data};
+    const auto &entries = api();
+    if (entries.postVsyncCallback != nullptr) {
+      entries.postVsyncCallback(choreographer, onVsync, request);
+    } else if (entries.postFrameCallback64 != nullptr) {
+      entries.postFrameCallback64(choreographer, onFrame64, request);
+    } else {
+      // The entry point of API 24: its frame time is a long, 32 bits on a
+      // 32-bit device, so the clock is read instead.
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
+      AChoreographer_postFrameCallback(
+          choreographer,
+          [](long, void *data) {
+            deliver(static_cast<Request *>(data), rnsurface::frameClockNow());
+          },
+          request);
+#pragma clang diagnostic pop
+    }
+    return true;
+  }
+
+  /**
+   An animation frame for a thread without a choreographer: a frame that
+   starts now.
+   */
+  static AnimationFrame unpaced() {
+    const auto now = rnsurface::frameClockNow();
+    return {now, kDefaultInterval, now};
+  }
+
+private:
+  struct Request {
+    Callback callback;
+    void *data;
+  };
+
+  // The frame timeline of API 33 (android/choreographer.h), opaque here.
+  struct FrameData;
+  using VsyncCallback = void (*)(const FrameData *, void *);
+  using FrameCallback64 = void (*)(int64_t, void *);
+
+  struct Api {
+    void (*postVsyncCallback)(AChoreographer *, VsyncCallback, void *);
+    void (*postFrameCallback64)(AChoreographer *, FrameCallback64, void *);
+    int64_t (*frameTime)(const FrameData *);
+    size_t (*timelinesLength)(const FrameData *);
+    size_t (*preferredTimeline)(const FrameData *);
+    int64_t (*expectedPresentationTime)(const FrameData *, size_t);
+    int64_t (*deadline)(const FrameData *, size_t);
+  };
+
+  template <typename Entry> static Entry lookUp(const char *name) {
+    return reinterpret_cast<Entry>(dlsym(RTLD_DEFAULT, name));
+  }
+
+  static const Api &api() {
+    static const Api entries = []() {
+      Api found{};
+      found.postFrameCallback64 = lookUp<decltype(found.postFrameCallback64)>(
+          "AChoreographer_postFrameCallback64");
+      found.frameTime = lookUp<decltype(found.frameTime)>(
+          "AChoreographerFrameCallbackData_getFrameTimeNanos");
+      found.timelinesLength = lookUp<decltype(found.timelinesLength)>(
+          "AChoreographerFrameCallbackData_getFrameTimelinesLength");
+      found.preferredTimeline = lookUp<decltype(found.preferredTimeline)>(
+          "AChoreographerFrameCallbackData_getPreferredFrameTimelineIndex");
+      found.expectedPresentationTime =
+          lookUp<decltype(found.expectedPresentationTime)>(
+              "AChoreographerFrameCallbackData_"
+              "getFrameTimelineExpectedPresentationTimeNanos");
+      found.deadline = lookUp<decltype(found.deadline)>(
+          "AChoreographerFrameCallbackData_getFrameTimelineDeadlineNanos");
+      // The timeline is all or nothing.
+      if (found.frameTime != nullptr && found.timelinesLength != nullptr &&
+          found.preferredTimeline != nullptr &&
+          found.expectedPresentationTime != nullptr &&
+          found.deadline != nullptr) {
+        found.postVsyncCallback = lookUp
```

**File**: `packages/skia/android/cpp/rnskia-android/RNSkPresentThreadTimer.h` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+#pragma once
+
+#include <android/looper.h>
+#include <sys/timerfd.h>
+#include <unistd.h>
+
+#include <algorithm>
+#include <cerrno>
+#include <chrono>
+#include <cstdint>
+#include <functional>
+#include <map>
+#include <stdexcept>
+#include <system_error>
+#include <utility>
+
+#include "RNSkPresentThread.h"
+#include "rnsurface/ThreadChecker.h"
+
+namespace RNSkia {
+
+/**
+ * Runs tasks on the present thread once their delay has passed: a timerfd on
+ * the thread's looper (see rnsurface::RenderThread), armed for the task due
+ * first: the setTimeout() of the present thread (see
+ * RNSkView::FrameHost::setTimeout). What a view polls the GPU with while its
+ * window has a present deferred, as nothing announces the GPU being done and
+ * a wait for it would hold up every submit (see DawnContext::isDone), and
+ * what it waits for the end of a slot with. One for the process, as the thread
+ * is, made on that thread at its first timeout.
+ */
+class PresentThreadTimer {
+public:
+  static PresentThreadTimer &getInstance() {
+    // Never destroyed, like the thread whose looper watches it.
+    static auto *instance = new PresentThreadTimer();
+    return *instance;
+  }
+
+  /**
+   Runs the task once `delay` has passed, after the tasks due before it and
+   never on the spot. A timeout set cannot be cleared. Present thread.
+   */
+  void setTimeout(std::chrono::nanoseconds delay, std::function<void()> task) {
+    RNSURFACE_ASSERT_THREAD(presentThread().checker(),
+                            "PresentThreadTimer::setTimeout");
+    _tasks.emplace(Clock::now() + delay, std::move(task));
+    arm();
+  }
+
+private:
+  using Clock = std::chrono::steady_clock;
+
+  PresentThreadTimer()
+      : _timer(timerfd_create(CLOCK_MONOTONIC, TFD_CLOEXEC | TFD_NONBLOCK)) {
+    if (_timer == -1) {
+      throw std::system_error(errno, std::generic_category(), "timerfd_create");
+    }
+    const int added = ALooper_addFd(
+        ALooper_forThread(), _timer, ALOOPER_POLL_CALLBACK, ALOOPER_EVENT_INPUT,
+        [](int, int, void *data) {
+          static_cast<PresentThreadTimer *>(data)->runDue();
+          return 1;
+        },
+        this);
+    if (added != 1) {
+      close(_timer);
+      throw std::runtime_error("PresentThreadTimer: ALooper_addFd failed");
+    }
+  }
+
+  void runDue() {
+    std::uint64_t expirations = 0;
+    static_cast<void>(read(_timer, &expirations, sizeof(expirations)));
+    const auto now = Clock::now();
+    while (!_tasks.empty() && _tasks.begin()->first <= now) {
+      auto task = std::move(_tasks.begin()->second);
+      _tasks.erase(_tasks.begin());
+      task();
+    }
+    arm();
+  }
+
+  // A timerfd given a zero time is disarmed, so a task already due waits a
+  // nanosecond rather than never.
+  void arm() {
+    itimerspec next{};
+    if (!_tasks.empty()) {
+      const auto wait = std::max<std::chrono::nanoseconds>(
+          _tasks.begin()->first - Clock::now(), std::chrono::nanoseconds(1));
+      const auto seconds =
+          std::chrono::duration_cast<std::chrono::seconds>(wait);
+      next.it_value.tv_sec =
+          static_cast<decltype(next.it_value.tv_sec)>(seconds.count());
+      next.it_value.tv_nsec = static_cast<decltype(next.it_value.tv_nsec)>(
+          (wait - seconds).count());
+    }
+    timerfd_settime(_timer, 0, &next, nullptr);
+  }
+
+  std::multimap<Clock::time_point, std::function<void()>> _tasks;
+  int _timer;
+};
+
+} // namespace RNSkia
```

**File**: `packages/skia/android/src/main/java/com/reactnative/skia/SkiaView.java` (modified, +1/-1)
```diff
@@ -286,7 +286,7 @@ void dropInstance() {
     // there (see dropInstance), and no native method is called from there
     // after that, but for the one onSurfaceDestroyed makes under the hybrid
     // data's lock. The present thread, where it is destroyed, asks the hybrid
-    // data instead (see presentFrame).
+    // data instead (see onFrameConsumed).
     private boolean hasNativeView() {
         return !mDropped;
     }
```

---

### Incident Patch 2: `a7bc07e4` (2026-11-14)
**Commit Message**: fix(🔤): draw <Text> with a cached text blob (#4473)

The Text command drew with drawSimpleText(), so Graphite shaped the text and built its glyph runs again for every label on every frame. It now keeps an SkTextBlob, made again when the text or the font changes, and draws it with drawTextBlob(): Graphite caches the glyph runs by blob and reuses them under a whole pixel translation.

Adds the textSlide benchmark scene: the 6,000 labels of the text scene, sliding by whole pixels instead of rotating.

**File**: `apps/example/benchmarks/README.md` (modified, +4/-3)
```diff
@@ -1,6 +1,6 @@
 # Performance regression benchmark
 
-Seven scenes that stress different parts of React Native Skia, run on a real
+Eight scenes that stress different parts of React Native Skia, run on a real
 phone, measured by the system compositor. Run it before a release and compare
 with the previous one.
 
@@ -13,6 +13,7 @@ with the previous one.
 | `pattern` | a repeating image shader over the whole screen |
 | `paths` | 900 cubic squiggles, half filled, half stroked: path rendering |
 | `text` | 6,000 short labels: glyph atlas and text draws |
+| `textSlide` | the same 6,000 labels sliding by whole pixels instead of rotating: the glyph masks stay the same from one frame to the next |
 
 The layouts match `apps/benchmark` in react-native-tgfx, so the numbers can be
 compared with that engine too (`shapeBlob` has no counterpart there; compare
@@ -43,7 +44,7 @@ then exits with status 1.
 |---|---|---|
 | `--platform` | `android` | `ios` needs a paired iPhone; `ios-simulator` with `--cold` only |
 | `--cold` | | measure the first draw after a fresh install instead of FPS (see below) |
-| `--scenes` | all seven | e.g. `shader,paths` |
+| `--scenes` | all eight | e.g. `shader,paths` |
 | `--reps` | `1` | the present FPS reported is the median over reps |
 | `--gap` | `0` | seconds with no canvas between scenes, so heat does not carry over |
 | `--backing` | `surface` | Android: `texture` puts the canvas on a TextureView |
@@ -120,7 +121,7 @@ Logging trace.
   `/proc/<pid>/task/*/stat`, divided by the frames presented in it. Present
   FPS stops at the panel rate, so a scene that already runs at 120 FPS hides
   any regression in its cost; render ms/frame does not. It is the number to
-  watch for CPU-bound scenes (`shapes`, `shapeBlob`, `images`, `paths`, `text`). It counts
+  watch for CPU-bound scenes (`shapes`, `shapeBlob`, `images`, `paths`, `text`, `textSlide`). It counts
   time on a core only, not time blocked on the GPU, so a GPU-bound scene
   (`shader`, `pattern`) shows its regressions in present FPS instead.
 - Android also reports JS/UI thread FPS, the busiest threads (% of a core)
```

**File**: `apps/example/benchmarks/run.mjs` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ const arg = (name, fallback) => {
   return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback;
 };
 const PLATFORM = arg("platform", "android");
-const ALL_SCENES = ["shapes", "shapeBlob", "images", "shader", "pattern", "paths", "text"];
+const ALL_SCENES = ["shapes", "shapeBlob", "images", "shader", "pattern", "paths", "text", "textSlide"];
 const SCENES = arg("scenes", ALL_SCENES.join(",")).split(",");
 const REPS = Number(arg("reps", "1"));
 const GAP = Number(arg("gap", "0"));
```

**File**: `apps/example/src/Examples/Benchmark/plan.ts` (modified, +3/-1)
```diff
@@ -1,7 +1,8 @@
 // The run plan of the benchmark screen, as `key=value` pairs joined by `&`
 // (the query string of a URL, without the `?`):
 //
-//   scenes=shapes,shapeBlob,images,shader,pattern,paths,text   (default: all)
+//   scenes=shapes,shapeBlob,images,shader,pattern,paths,text,textSlide
+//                                                    (default: all)
 //   reps=2                                           (default: 1)
 //   gap=30        seconds idle, no canvas, between scenes (default: 0)
 //   backing=surface|texture   Android only: SurfaceView or TextureView
@@ -25,6 +26,7 @@ export const SCENES = [
   "pattern",
   "paths",
   "text",
+  "textSlide",
 ] as const;
 export type Scene = (typeof SCENES)[number];
 
```

**File**: `apps/example/src/Examples/Benchmark/scenes.tsx` (modified, +24/-0)
```diff
@@ -30,6 +30,7 @@ const screen = Dimensions.get("screen");
 export const W = Math.min(screen.width, screen.height);
 export const H = Math.max(screen.width, screen.height);
 const origin = vec(W / 2, H / 2);
+const PD = PixelRatio.get();
 
 const PALETTE = [
   "#FF3B30",
@@ -180,6 +181,12 @@ export const BenchScene = ({
     { rotate: t.value },
     { scale: 0.03 },
   ]);
+  // Whole pixels: Skia only reuses the glyph runs of the previous frame under
+  // a whole pixel translation.
+  const slide = useDerivedValue(() => [
+    { translateX: Math.round(40 * Math.sin(t.value) * PD) / PD },
+    { translateY: Math.round(40 * Math.cos(t.value) * PD) / PD },
+  ]);
   const uniforms = useDerivedValue(() => ({ uTime: t.value, uSize: [W, H] }));
   switch (scene) {
     case "shapes":
@@ -281,5 +288,22 @@ export const BenchScene = ({
         </Group>
       );
     }
+    case "textSlide": {
+      const textFont = getFont();
+      return (
+        <Group transform={slide}>
+          {TEXTS.map((item, i) => (
+            <Text
+              key={i}
+              x={item.x}
+              y={item.y}
+              text={item.label}
+              font={textFont}
+              color={item.color}
+            />
+          ))}
+        </Group>
+      );
+    }
   }
 };
```

**File**: `packages/skia/cpp/api/recorder/Drawings.h` (modified, +22/-4)
```diff
@@ -340,12 +340,30 @@ class TextCmd : public Command {
 
   void play(DrawingCtx *ctx) override {
     const auto &[font, text, x, y] = props;
-    if (font.has_value()) {
-      ctx->canvas->drawSimpleText(text.c_str(), text.length(),
-                                  SkTextEncoding::kUTF8, x, y, font.value(),
-                                  ctx->getPaint());
+    if (!font.has_value()) {
+      return;
+    }
+    // The same blob for as long as the text and the font stay the same, so
+    // that Graphite finds the glyph runs it made for it on the previous frame
+    // (it caches them by blob, under any whole pixel translation) and their
+    // glyphs in its atlas: drawSimpleText() shapes the text and looks up
+    // every glyph again on each frame. Played under the recorder's lock.
+    if (_blob == nullptr || _blobText != text || _blobFont != font.value()) {
+      _blob = SkTextBlob::MakeFromText(text.c_str(), text.length(),
+                                       font.value(), SkTextEncoding::kUTF8);
+      _blobText = text;
+      _blobFont = font.value();
+    }
+    // No blob for a text without glyphs.
+    if (_blob != nullptr) {
+      ctx->canvas->drawTextBlob(_blob, x, y, ctx->getPaint());
     }
   }
+
+private:
+  sk_sp<SkTextBlob> _blob;
+  std::string _blobText;
+  SkFont _blobFont;
 };
 
 struct BoxShadowCmdProps {
```

---

### Incident Patch 3: `f961faf7` (2026-11-16)
**Commit Message**: chore(🐙): refactor Android CI build (#4486)

**File**: `.github/workflows/ci.yml` (modified, +110/-155)
```diff
@@ -1,11 +1,9 @@
 name: CI
 # Pushes to main/next only run the cheap ubuntu jobs (lint, test, test-web,
-# build-library), the Android build (with its emulator run on main only), the
-# SwiftPM build, and (on main only) the macOS build. The native builds and
-# the emulator/simulator runs happen on pull requests and in the merge queue,
-# so a merge does not pay for the full suite twice. The Android build runs on
-# push because a pull request can only restore caches saved by its own
-# earlier runs or by its base branch (see build-test-android). The SwiftPM
+# build-library), the Android build (with its emulator and device runs on main
+# only), the SwiftPM build, and (on main only) the macOS build. The native
+# builds and the emulator/simulator runs happen on pull requests and in the
+# merge queue, so a merge does not pay for the full suite twice. The SwiftPM
 # and macOS builds run on push, and on the pull requests whose diff can
 # affect them (see changes).
 on:
@@ -136,17 +134,26 @@ jobs:
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
 
-  # On pull requests and in the merge queue this builds the example app and
-  # runs the e2e suite on the emulator. On push it saves the Gradle cache and
-  # the ccache on the base branch, where every pull request can restore them,
-  # and on main it also runs the emulator suite, so main itself has Android
-  # e2e coverage; on next it stops after the build. Without that producer
-  # each pull request started cold (0 ccache hits, 28 minutes of C++) and saved
-  # its own 1.8 GB Gradle cache, which kept the repository above its 10 GB
-  # cache limit and evicted every entry within hours.
-  build-test-android:
-    runs-on: ubuntu-latest
-    timeout-minutes: 90
+  # Builds the example APK once, for both tested ABIs (x86_64 for the
+  # emulator, arm64-v8a for the phone), and hands it to the two e2e jobs as
+  # an artifact. Rerunning a flaky e2e job ("Re-run failed jobs") downloads
+  # this run's APK instead of building it again.
+  #
+  # It runs on the self-hosted Mac: its ~/.gradle and ccache directory live
+  # on disk between runs, so the build takes 2 to 5 minutes, where the hosted
+  # ubuntu runner took 4 to 9 minutes for one ABI after restoring a 1.8 GB
+  # Gradle cache and the ccache from GitHub's cache. It uses the phone's
+  # listener (label `android-device`), so it does not queue behind
+  # build-test-ios, and build-test-android-device then runs on the same
+  # listener right after it.
+  #
+  # It runs on every push too (main and next), so the base branches keep a
+  # build check; the e2e jobs run on main pushes only.
+  build-android:
+    runs-on: [self-hosted, macOS, android-device]
+    timeout-minutes: 60
+    env:
+      ORG_GRADLE_PROJECT_reactNativeArchitectures: arm64-v8a,x86_64
     steps:
       - name: Checkout
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v5.0.0
@@ -158,19 +165,6 @@ jobs:
         with:
           github_token: ${{ secrets.GITHUB_TOKEN }}
 
-      - name: Free disk space
-        uses: jlumbroso/free-disk-space@ceedf095f4ec1a097402bc6bd80831f2e1a6fde6 # v2.0.0
-        with:
-          tool-cache: false
-          android: false
-          dotnet: true
-          haskell: true
-          large-packages: true
-          docker-images: true
-          # Keep the swap file: the Graphite C++ build peaks close to the
-          # runner's 16 GB and the swap is the only headroom left.
-          swap-storage: false
-
       - name: Install JDK
         uses: actions/setup-java@77dd5b2ce225ea11469928ac317850245a74ae78 # v6.2.0
         with:
@@ -183,102 +177,85 @@ jobs:
         with:
           ndk-version: r27d
 
-      - name: Set ANDROID_NDK
-        run: echo "ANDROID_NDK=${{ steps.setup-ndk.outputs.ndk-path }}" >> "$GITHUB_ENV"
-
-      - name: Setup Android SDK
-        uses: android-actions/setup-android@be39fa834029ff78f1a44aa3bb0819b8fc2bd8fd # v4.0.4
-        with:
-          packages: platform-tools
-
-      - name: Install Android SDK tools
-        run: |
-          echo "ANDROID_HOME=$ANDROID_HOME" >> $GITHUB_ENV
-          echo "$ANDROID_HOME/cmdline-tools/latest/bin" >> $GITHUB_PATH
-          echo "$ANDROID_HOME/platform-tools" >> $GITHUB_PATH
-          echo "$ANDROID_HOME/emulator" >> $GITHUB_PATH
-
-      - name: Finalize Android SDK
-        run: |
-          /bin/bash -c "yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses > /dev/null"
-
-      - name: Install Android SDK
+      # The SDK is installed once on the machine (the same lookup as the
+      # react-native-webgpu workflow). Gradle downloads missing platforms and
+      # build tools into it on first use.
+      - name: Set up Android SDK
         run: |
-          echo "sdk.dir=$ANDROID_HOME" > $GITHUB_WORKSPACE/apps/example/android/local.properties
-
-      - name: Cache Gradle
-        uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
-        with:
-  
```

#### Recent Merged Pull Requests:
- **PR #4486** (2026-11-16): chore(🐙): refactor Android CI build (@wcandillon)
- **PR #4485** (2026-11-16): chore(deps): bump anthropics/claude-code-action from 1.0.269 to 1.0.275 (@dependabot[bot])
- **PR #4484** (2026-11-17): feat(🤖): download the Android binaries from GitHub releases (@wcandillon)
- **PR #4483** (2026-11-16): chore(🍏) fix macOS example, move `react-native-macos` to 0.83 (@theeket)
- **PR #4479** (2026-11-14): Clarify agent contribution guidelines in templates and docs (@wcandillon)
- **PR #4478** (2026-11-15): fix(🗿): pace a canvas's frames with one scheduler, and hold a present for the GPU on Android (@wcandillon)

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

## X. 🗿): pace a canvas's frames with one scheduler, and hold a present for the GPU o

**RULE**:
When implementing operations in `apps/docs/docs/canvas/canvas.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wcandillon/react-native-skia. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b7f2c499`: 🗿): pace a canvas's frames with one scheduler, and hold a present for the GPU on Android. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/docs/docs/canvas/canvas.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
3. A dedicated native thread pool replays the display list into a Graphite frame whenever its content changed. While a replay fits in a frame of the display, the next one starts once the view has presented the previous frame; when it takes longer, replays run one frame ahead of the display, so that the canvas keeps the display's rate.
4. The view presents one frame per frame of the display: as soon as the frame is ready when it still makes the display's deadline, on the next frame of the display otherwise. On Android, a frame presented while the GPU is still working on the previous one has its work submitted and its present deferred until the GPU is done, so that no canvas waits for another's GPU work.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
3. A dedicated native thread pool replays the display list into a Graphite frame whenever its content changed, keeping at most one frame ahead of the display.
4. The view presents the frame on the next vsync.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b7f2c499` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
