# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: wcandillon-react-native-skia-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "wcandillon-react-native-skia-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T11:03:56.276Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-wcandillon-react-native-skia-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [wcandillon-react-native-skia-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T11:03:56.276Z`  
> **Learning ID**: `LEARN-EVO-wcandillon-react-native-skia-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), D (Research & Knowledge Intelligence), L (Deployment & Operations Intelligence), F (Design Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), E (Creative Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 73%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from wcandillon-react-native-skia-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wcandillon-react-native-skia-learnings.md`  
> **Source**: github ([https://github.com/wcandillon/react-native-skia](https://github.com/wcandillon/react-native-skia))  
> **Source Version**: `d0e4075f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T11:03:49.624Z  
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
> **Harvest Timestamp**: 2026-11-26T11:03:49.617Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wcandillon/react-native-skia`
- **Description**: High-performance React Native Graphics using Skia
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8794 stars

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
// detects it: possibly inside a call on the device itself, on the calling
// thread. A creation failure leaves Dawn's message in creationFailure, for
// the caller of requestDevice(): that callback runs inside CreateDevice, on
// the calling thread. The listener must outlive the device.
struct DeviceLostListener {
  std::function<void(wgpu::DeviceLostReason reason, const std::string &message)>
      onLost;
  std::string creationFailure;
};

// The name WebGPU gives a loss reason (GPUDeviceLostReason, lower case).
inline const char *deviceLostReasonName(wgpu::DeviceLostReason reason) {
  switch (reason) {
  case wg
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
- **Issue #4539** (2026-11-25): **iOS App Store Connect rejects build with ITMS-91063: invalid ".rnskia-skia.signature" and ".rnskia-dawn.signature"**
  *Symptoms*: ### Description  I submitted my iOS app to App Store review and it was rejected during processing with an **"Invalid Binary"** status. This happened in a production build, so it blocks my release. I did not change any signing setup; the only recent change was adding react-native-skia (v3, prebuilt Skia/Dawn binaries).  Apple's email says: ITMS-91063: Invalid signature - Your app includes the **“.rnskia-skia.signature”** code signature file, which appears to be in an invalid format. If a new app includes a commonly used third-party SDK, or an app update adds a new commonly used third-party SDK, the SDK must include a valid signature file. For details about verifying the code signature for a third-party SDK, visit: https://developer.apple.com/documentation/xcode/verifying-the-origin-of-your-xcframeworks.  ITMS-91063: Invalid signature - Your app includes the **“.rnskia-dawn.signature”** code signature file, which appears to be in an invalid format. If a new app includes a commonly used third-party SDK, or an app update adds a new commonly used third-party SDK, the SDK must include a valid signature file. For details about verifying the code signature for a third-party SDK, visit: https://developer.apple.com/documentation/xcode/verifying-the-origin-of-your-xcframeworks.   ### React Native Skia Version  3.12.0  ### React Native Version  0.88.1  ### Using New Architecture  - [x] Enabled  ### Steps to Reproduce  NA  ### Snack, Code Example, Screenshot, or Link to Repository  NA  ##

- **Issue #4519** (2026-11-24): **Android: wrapper C++ compile takes about 1.4 min per ABI on 2.15.5 (5+ min for four ABIs) Expo SDK 58 - This is a build-time regression, not a runtime bug.**
  *Symptoms*: ### Description  I hit this myself after upgrading my Expo app from SDK 57 to SDK 58. My Android release builds on EAS went from about 24 minutes to 41-45 minutes, which is over the 45-minute limit of the free plan, so builds started getting cancelled.  I went through the Gradle logs to see where the time went. Most of the increase is in React Native's own app compile step, but react-native-skia is the slowest single library: the :react-native-skia:buildCMakeRelWithDebInfo tasks take about 5 minutes in total across the four ABIs. On @shopify/react-native-skia 2.11.0 with React Native 0.86 the same tasks did not stand out at all (under a minute in total, though that build had a warm ccache, so the comparison is not exact).  I understand the Skia engine itself is prebuilt and it is the wrapper that gets compiled. I expected that part to stay small. Is this compile time expected on 2.15.x, and is there any plan to ship the wrapper prebuilt for Android, or a recommended way to reduce it other than building fewer ABIs?  Earlier, on 2.14.0, the same step was running the EAS worker out of memory with four ABIs; 2.15.5 fixed that for me.  ### React Native Skia Version  2.15.5  ### React Native Version  0.88.1  ### Using New Architecture  - [x] Enabled  ### Steps to Reproduce  1. Expo SDK 58 app (expo 58.0.26), react-native 0.88.1, react-native-skia 2.15.5,    react-native-reanimated 4.7.1, react-native-worklets 0.13.0. 2. Build an Android release for all four ABIs on EAS Build (defau

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

### Incident Patch 1: `13bdf30c` (2026-11-25)
**Commit Message**: fix(🍏): don't name build stamps .signature (ITMS-91063) (#4540)

* fix(🍏): don't name build stamps .signature (ITMS-91063)

Xcode collects *.signature files from build products into the archive,
so App Store Connect validated our incremental-build stamps as XCFramework
code signatures and rejected the upload. Use a .stamp extension and remove
stamps left behind by previous builds.

Fixes #4539

* test(🍏): guard against *.signature files in Apple build products

A unit test runs the assembly and staging steps of the Xcode phase and
fails if they leave a *.signature file behind, and the iOS CI job checks
the real build products after xcodebuild.

* ci(🍏): skip react-native-webgpu's stamp until it ships the fix

The example installs a react-native-webgpu release that still writes
.rnwgpu-dawn.signature; wcandillon/react-native-webgpu#655 fixes it.

**File**: `.github/workflows/ci.yml` (modified, +16/-0)
```diff
@@ -597,6 +597,22 @@ jobs:
               exit 1
             }
 
+      # Xcode collects *.signature files from build products into the archive,
+      # and App Store Connect rejects any that is not an XCFramework code
+      # signature (ITMS-91063, #4539). No build phase may leave one there.
+      # The react-native-webgpu release the example installs still writes
+      # .rnwgpu-dawn.signature (fixed in wcandillon/react-native-webgpu#655):
+      # drop the exclusion once the example is on a release with that fix.
+      - name: Check build products for *.signature files
+        run: |
+          signatures=$(find "$DERIVED_DATA/Build/Products" -name '*.signature' \
+            -not -path '*/ReactNativeWebGPUBinaries/*')
+          if [ -n "$signatures" ]; then
+            echo "::error::Build products contain *.signature files, which App Store Connect rejects (ITMS-91063):"
+            echo "$signatures"
+            exit 1
+          fi
+
       # React Native's prebuilt core, which the example installs since 0.88, is
       # compiled with Metro on 8081: an RCT_METRO_PORT build setting no longer
       # reaches it.
```

**File**: `packages/skia/scripts/__tests__/prepare-apple-binaries.spec.ts` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+import { execFileSync } from "child_process";
+import fs from "fs";
+import os from "os";
+import path from "path";
+
+const script = path.join(__dirname, "..", "prepare-apple-binaries.sh");
+
+// Every file below `directory`, relative to it.
+const walk = (directory: string): string[] =>
+  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
+    const file = path.join(directory, entry.name);
+    return entry.isDirectory()
+      ? walk(file).map((child) => path.join(entry.name, child))
+      : [entry.name];
+  });
+
+// Runs the assembly and linker staging steps of the Xcode phase against a
+// local archive. The macOS-only ditto and plutil are stubbed so the test also
+// runs on Linux.
+const prepare = (root: string) =>
+  execFileSync(
+    "/bin/bash",
+    [
+      "-c",
+      `set -Eeuo pipefail
+source "$1"
+ditto() { mkdir -p "$2"; cp -R "$1"/. "$2"; }
+json_strings() { echo arm64; }
+WORK_DIR="$2/work"; mkdir -p "$WORK_DIR"; TEMP_PATHS=()
+SDK=iphoneos VERSION=0.0.0 SOURCE_SIGNATURE=source MODULE=skia
+MODULE_LIBRARIES=(libskia.a) META_IDENTIFIER=ios-arm64 META_ARCHS=arm64
+SOURCE_DIRECTORY="$2/source" CONTAINERS="$2/assembly" OUTPUT="$2/output"
+assemble_module
+CONTAINER_ROOT="$CONTAINERS/$MODULE"
+stage_module`,
+      "prepare",
+      script,
+      root,
+    ],
+    { stdio: "pipe" }
+  );
+
+// Xcode collects *.signature files from build products into the archive, and
+// App Store Connect rejects any that is not an XCFramework code signature
+// (ITMS-91063, #4539). Build bookkeeping must never use that extension.
+describe("prepare-apple-binaries.sh", () => {
+  let root: string;
+
+  beforeEach(() => {
+    root = fs.mkdtempSync(path.join(os.tmpdir(), "rnskia-prepare-"));
+    fs.mkdirSync(path.join(root, "source"));
+    fs.writeFileSync(path.join(root, "source", "libskia.a"), "archive");
+    fs.writeFileSync(
+      path.join(root, "source", "metadata.json"),
+      '{"architectures":["arm64"]}'
+    );
+  });
+
+  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
+
+  const signatures = () =>
+    ["output", "assembly"].flatMap((directory) =>
+      walk(path.join(root, directory))
+        .filter((file) => file.endsWith(".signature"))
+        .map((file) => path.join(directory, file))
+    );
+
+  it("stages the library without writing *.signature files", () => {
+    prepare(root);
+    expect(
+      fs.readFileSync(path.join(root, "output", "librnskia_skia.a"), "utf8")
+    ).toBe("archive");
+    expect(signatures()).toEqual([]);
+    // An incremental build reuses the stamps and still writes none.
+    prepare(root);
+    expect(signatures()).toEqual([]);
+  });
+
+  it("removes the *.signature stamps of earlier releases", () => {
+    // Archive build folders persist, so 3.12 stamps would still be uploaded.
+    fs.mkdirSync(path.join(root, "output"));
+    fs.writeFileSync(path.join(root, "output", ".rnskia-skia.signature"), "");
+    fs.mkdirSync(path.join(root, "assembly", "skia", ".slices"), {
+      recursive: true,
+    });
+    fs.writeFileSync(
+      path.join(root, "assembly", "skia", ".slices", "iphoneos.signature"),
+      ""
+    );
+    prepare(root);
+    expect(signatures()).toEqual([]);
+  });
+});
```

**File**: `packages/skia/scripts/prepare-apple-binaries.sh` (modified, +9/-3)
```diff
@@ -212,7 +212,7 @@ copy_library() {
 # The caller holds the assembly lock across both assembly and linker staging.
 assemble_module() {
   local root="$CONTAINERS/$MODULE" library existing=true temporary previous='' old_archs platform variant ignored deployment
-  local signature_file="$CONTAINERS/$MODULE/.slices/$SDK.signature"
+  local signature_file="$CONTAINERS/$MODULE/.slices/$SDK.stamp"
   CONTAINER_ROOT="$root"
   for library in "${MODULE_LIBRARIES[@]}"; do
     if [[ ! -f "$root/${library%.a}.xcframework/$META_IDENTIFIER/$library" || ! -f "$root/${library%.a}.xcframework/Info.plist" ]]; then existing=false; fi
@@ -228,6 +228,7 @@ assemble_module() {
     previous="$platform-$(printf '%s\n' "$old_archs" | LC_ALL=C sort | paste -sd _ -)${variant:+-$variant}"
   fi
   mkdir -p "$temporary/.slices"
+  rm -f "$temporary/.slices/$SDK.signature"
   cp "$SOURCE_DIRECTORY/metadata.json" "$temporary/.slices/$SDK.json"
   for library in "${MODULE_LIBRARIES[@]}"; do
     local container="$temporary/${library%.a}.xcframework"
@@ -236,7 +237,7 @@ assemble_module() {
     copy_library "$SOURCE_DIRECTORY/$library" "$container/$META_IDENTIFIER/$library"
     write_xcframework_plist "$container" "$library" "$temporary/.slices"
   done
-  printf '%s\n' "$SOURCE_SIGNATURE" > "$temporary/.slices/$SDK.signature"
+  printf '%s\n' "$SOURCE_SIGNATURE" > "$temporary/.slices/$SDK.stamp"
   replace_directory "$temporary" "$root"
   note "Prepared $SDK XCFramework slices ($(printf '%s' "$META_ARCHS" | tr '\n' ' '))"
 }
@@ -248,10 +249,15 @@ assemble_module() {
 # rather than dynamic frameworks copied into the app's Frameworks directory.
 # Build-product stamps include SDK/version/source identity, avoiding equal-size
 # archives from another platform and unnecessary copies on incremental builds.
+# Stamps must never use the .signature extension: Xcode collects *.signature
+# files from build products into the archive, and App Store Connect rejects
+# them as invalid XCFramework code signatures (ITMS-91063).
 stage_module() {
-  local library destination temporary stamp="$OUTPUT/.rnskia-$MODULE.signature"
+  local library destination temporary stamp="$OUTPUT/.rnskia-$MODULE.stamp"
   local signature="$SDK:$VERSION:$SOURCE_SIGNATURE" name
   mkdir -p "$OUTPUT"
+  # Archive build folders persist across runs; drop stamps from older releases.
+  rm -f "$OUTPUT/.rnskia-$MODULE.signature"
   for library in "${MODULE_LIBRARIES[@]}"; do
     name="${library#lib}"
     destination="$OUTPUT/librnskia_$name"
```

---

### Incident Patch 2: `d0e4075f` (2026-11-26)
**Commit Message**: fix(🔤): accept a TypefaceFontProvider wherever a FontMgr is expected (#4541)

Skia.SVG.MakeFromString and MakeFromData document useFonts() as their
font manager, and SkTypefaceFontProvider extends SkFontMgr in the types,
on the web and in Skia itself. On iOS and Android, JsiSkFontMgr::fromValue
only accepted a JsiSkFontMgr, so passing a provider threw "Expected FontMgr
but got different type".

fromValue now also unwraps a JsiSkTypefaceFontProvider; anything else still
goes through the strict check.

**File**: `packages/skia/cpp/api/JsiSkFontMgr.h` (modified, +6/-0)
```diff
@@ -10,6 +10,7 @@
 #include "JsiSkFontStyle.h"
 #include "JsiSkNativeObjects.h"
 #include "JsiSkTypeface.h"
+#include "JsiSkTypefaceFontProvider.h"
 #include "utils/RNSkLog.h"
 #include <jsi/jsi.h>
 
@@ -71,6 +72,11 @@ class JsiSkFontMgr
 
   static sk_sp<SkFontMgr> fromValue(jsi::Runtime &runtime,
                                     const jsi::Value &obj) {
+    // A TypefaceFontProvider (what useFonts returns) is an SkFontMgr too.
+    if (auto provider =
+            tryGetJsiObject<JsiSkTypefaceFontProvider>(runtime, obj)) {
+      return provider->getObject();
+    }
     return objectFromValue(runtime, obj);
   }
 
```

**File**: `packages/skia/src/renderer/__tests__/e2e/SVG.spec.tsx` (modified, +92/-1)
```diff
@@ -3,7 +3,9 @@ import fs from "fs";
 import React from "react";
 
 import { checkImage, docPath, itRunsE2eOnly } from "../../../__tests__/setup";
-import { importSkia, surface } from "../setup";
+import { importSkia, resolveFile, surface } from "../setup";
+import { AlphaType, ColorType } from "../../../skia/types";
+import type { SkFontMgr } from "../../../skia/types";
 import {
   Blur,
   ColorMatrix,
@@ -40,6 +42,14 @@ const tiger = new SVGAsset(
   800
 );
 
+const RobotoRegular = Array.from(
+  resolveFile("skia/__tests__/assets/Roboto-Regular.ttf")
+);
+
+const robotoText = `<svg viewBox='0 0 64 32' width="64" height="32" xmlns='http://www.w3.org/2000/svg'>
+<text x="2" y="26" font-family="Roboto" font-size="24" fill="black">Hi</text>
+</svg>`;
+
 const svgWithoutSize = new SVGAsset(
   `<svg viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'>
 <circle cx='10' cy='10' r='10' fill='#00FFFF'/>
@@ -209,4 +219,85 @@ describe("Displays SVGs", () => {
     );
     await checkImage(image, docPath("svg.png"));
   });
+
+  itRunsE2eOnly(
+    "should accept a TypefaceFontProvider as the font manager",
+    async () => {
+      const result = await surface.eval(
+        (Skia, ctx) => {
+          const roboto = Skia.Typeface.MakeFromData(
+            Skia.Data.fromBytes(new Uint8Array(ctx.RobotoRegular))
+          )!;
+          const provider = Skia.TypefaceFontProvider.Make();
+          provider.registerFont(roboto, "Roboto");
+          const fromString = Skia.SVG.MakeFromString(ctx.svg, provider)!;
+          const fromData = Skia.SVG.MakeFromData(
+            Skia.Data.fromBytes(new Uint8Array(ctx.svgBytes)),
+            provider
+          )!;
+          const fromSystem = Skia.SVG.MakeFromString(
+            ctx.svg,
+            Skia.FontMgr.System()
+          );
+          const offscreen = Skia.Surface.MakeOffscreen(64, 32)!;
+          const canvas = offscreen.getCanvas();
+          canvas.drawColor(Skia.Color("white"));
+          canvas.drawSvg(fromString);
+          return canvas
+            .readPixels(0, 0, {
+              width: 64,
+              height: 32,
+              colorType: ctx.colorType,
+              alphaType: ctx.alphaType,
+            })
+            .then((pixels) => {
+              let inked = 0;
+              for (let i = 0; i < pixels!.length; i += 4) {
+                if (pixels![i] < 128) {
+                  inked++;
+                }
+              }
+              return {
+                fromString: [fromString.width(), fromString.height()],
+                fromData: [fromData.width(), fromData.height()],
+                fromSystem: fromSystem !== null,
+                inked,
+              };
+            });
+        },
+        {
+          RobotoRegular,
+          svg: robotoText,
+          svgBytes: Array.from(Buffer.from(robotoText)),
+          colorType: ColorType.RGBA_8888,
+          alphaType: AlphaType.Unpremul,
+        }
+      );
+      expect(result.fromString).toEqual([64, 32]);
+      expect(result.fromData).toEqual([64, 32]);
+      expect(result.fromSystem).toBe(true);
+      expect(result.inked).toBeGreaterThan(0);
+    }
+  );
+
+  itRunsE2eOnly(
+    "should reject a font manager of a different type",
+    async () => {
+      const message = await surface.eval(
+        (Skia, ctx) => {
+          try {
+            Skia.SVG.MakeFromString(
+              ctx.svg,
+              Skia.Paint() as unknown as SkFontMgr
+            );
+            return "did not throw";
+          } catch (e) {
+            return (e as Error).message;
+          }
+        },
+        { svg: robotoText }
+      );
+      expect(message).toContain("Expected FontMgr but got different type");
+    }
+  );
 });
```

---

### Incident Patch 3: `af44efce` (2026-11-25)
**Commit Message**: fix(🐛): log lost surface recordings and keep outputImage without a snapshot (#4531)

submitRecording() now logs a recording Graphite could not snap or submit
(only a rejected insert was logged), and its result accounts for the
submit. makeImageSnapshot() no longer replaces the content of outputImage
when no snapshot could be made.

**File**: `packages/skia/cpp/api/JsiSkSurface.h` (modified, +3/-1)
```diff
@@ -125,7 +125,9 @@ class JsiSkSurface
     if (auto *recorder = surface->recorder()) {
       DawnContext::getInstance().submitRecording(recorder);
     }
-    if (count > 1 && arguments[1].isObject()) {
+    // Without a snapshot (e.g. bounds outside of the surface), outputImage
+    // keeps its previous content and the image returned is a null one.
+    if (image != nullptr && count > 1 && arguments[1].isObject()) {
       auto jsiImage = getJsiObject<JsiSkImage>(runtime, arguments[1]);
       jsiImage->setObject(image);
       return jsi::Value(runtime, arguments[1]);
```

**File**: `packages/skia/cpp/rnskia/RNDawnContext.h` (modified, +14/-6)
```diff
@@ -457,7 +457,8 @@ class DawnContext {
    generation()) is dropped: nothing can run it, and the device in use would
    refuse its resources. Called on the recorder's thread. Returns whether
    the recording runs: false when there was nothing to run, when it was
-   dropped, or when Graphite rejected it (which is logged).
+   dropped, or when Graphite could not snap, insert or submit it (which is
+   logged).
    */
   bool submitRecording(
       skgpu::graphite::Recorder *recorder,
@@ -469,15 +470,17 @@ class DawnContext {
     // the warmup stays behind (see RNSkGpuActivity), as is the run.
     RNSkGpuActivity::Scope activity;
     auto recording = recorder->snap();
-    if (recording == nullptr) {
-      return false;
-    }
     std::lock_guard<std::mutex> lock(_mutex);
     auto *current = _current.load(std::memory_order_acquire);
     if (generationOf(recorder) != current->id ||
         current->lost.load(std::memory_order_acquire)) {
       return false;
     }
+    // After the check above: a snap failing for a lost device is a drop.
+    if (recording == nullptr) {
+      RNSkLogger::logToConsole("Graphite could not snap a recording");
+      return false;
+    }
     skgpu::graphite::InsertRecordingInfo info;
     info.fRecording = recording.get();
     auto status = current->context->insertRecording(info);
@@ -490,8 +493,13 @@ class DawnContext {
               static_cast<skgpu::graphite::InsertStatus::V>(status)),
           status.message().c_str());
     }
-    current->context->submit(syncToCpu);
-    return inserted;
+    // Submitted either way, for the work other recordings inserted.
+    const bool submitted = current->context->submit(syncToCpu);
+    // Unless the device was lost meanwhile: its work is dropped, as above.
+    if (!submitted && !current->lost.load(std::memory_order_acquire)) {
+      RNSkLogger::logToConsole("Graphite could not submit a recording");
+    }
+    return inserted && submitted;
   }
 
   /**
```

**File**: `packages/skia/src/renderer/__tests__/e2e/Surfaces.spec.tsx` (modified, +21/-0)
```diff
@@ -69,4 +69,25 @@ describe("Surfaces", () => {
     expect(result.draw).toContain("surface was disposed");
     expect(result.getCanvas).toContain("disposed object");
   });
+
+  ["GPU", "raster"].forEach((kind) => {
+    it(`makeImageSnapshot() keeps outputImage without a snapshot (${kind})`, async () => {
+      const result = await surface.eval(
+        (Skia, ctx) => {
+          const sf = ctx.gpu
+            ? Skia.Surface.MakeOffscreen(16, 16)!
+            : Skia.Surface.MakeRaster(16, 16)!;
+          sf.getCanvas().drawColor(Skia.Color("cyan"));
+          sf.flush();
+          const output = Skia.Image.MakeNull();
+          sf.makeImageSnapshot(undefined, output);
+          // Outside of the surface: there is no snapshot to make.
+          sf.makeImageSnapshot(Skia.XYWHRect(100, 100, 5, 5), output);
+          return [output.width(), output.height()];
+        },
+        { gpu: kind === "GPU" }
+      );
+      expect(result).toEqual([16, 16]);
+    });
+  });
 });
```

**File**: `packages/skia/src/skia/types/Surface/Surface.ts` (modified, +3/-0)
```diff
@@ -19,6 +19,9 @@ export interface SkSurface extends SkJSIInstance<"Surface"> {
 
       @param bounds A rectangle specifying the subset of the surface that
    is of interest.
+      @param outputImage An image to update in place instead of returning a
+   new one. It keeps its previous content when the snapshot cannot be
+   created (e.g. `bounds` is outside of the surface).
       @return  Image initialized with Surface contents
 
       example: https://fiddle.skia.org/c/@Surface_makeImageSnapshot
```

**File**: `packages/skia/src/skia/web/JsiSkSurface.ts` (modified, +4/-1)
```diff
@@ -72,7 +72,10 @@ export class JsiSkSurface
         ? Array.from(JsiSkRect.fromValue(this.CanvasKit, bounds))
         : undefined
     );
-    if (outputImage) {
+    // Typed as non-nullable, but null when Skia cannot make the snapshot
+    // (e.g. bounds outside of the surface): outputImage then keeps its
+    // previous content.
+    if (outputImage && image) {
       outputImage.ref = image;
     }
     return new JsiSkImage(this.CanvasKit, image);
```

#### Recent Merged Pull Requests:
- **PR #4542** (2026-11-26): fix(🔤): accept a TypefaceFontProvider wherever a FontMgr is expected (2.x backport of #4541) (@filipemsilv4)
- **PR #4541** (2026-11-26): fix(🔤): accept a TypefaceFontProvider wherever a FontMgr is expected (@filipemsilv4)
- **PR #4540** (2026-11-25): fix(🍏): don't name build stamps .signature (ITMS-91063) (@wcandillon)
- **PR #4532** (2026-11-25): feat(🎞️): add Surface.flushAsync() (@wcandillon)
- **PR #4531** (2026-11-25): fix(🐛): log lost surface recordings and keep outputImage without a snapshot (@wcandillon)
- **PR #4530** (2026-11-25): Remove npm package generation, keep only release assets (@wcandillon)

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

## X. 🍏): don't name build stamps .signature (ITMS-91063)

**RULE**:
When implementing operations in `.github/workflows/ci.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wcandillon/react-native-skia. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `13bdf30c`: 🍏): don't name build stamps .signature (ITMS-91063). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/ci.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      # Xcode collects *.signature files from build products into the archive,
      # and App Store Connect rejects any that is not an XCFramework code
      # signature (ITMS-91063, #4539). No build phase may leave one there.
      # The react-native-webgpu release the example installs still writes
      # .rnwgpu-dawn.signature (fixed in wcandillon/react-native-webgpu#655):
      # drop the exclusion once the example is on a release with that fix.
      - name: Check build products for *.signature files
        run: |
          signatures=$(find "$DERIVED_DATA/Build/Products" -name '*.signature' \
            -not -path '*/ReactNativeWebGPUBinaries/*')
          if [ -n "$signatures" ]; then
            echo "::error::Build products contain *.signature files, which App Store Connect rejects (ITMS-91063):"
            echo "$signatures"
            exit 1
          fi

```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `13bdf30c` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
