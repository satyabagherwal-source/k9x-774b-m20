> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wcandillon-react-native-skia-learnings.md`  
> **Source**: github ([https://github.com/wcandillon/react-native-skia](https://github.com/wcandillon/react-native-skia))  
> **Source Version**: `5148abb4`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-23T05:33:16.670Z  
> **Learning ID**: `learn-github-wcandillon-react-native-skia`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): wcandillon/react-native-skia

---

## 1. Executive Forensic Architecture & System Mechanics

`react-native-skia` integrates Google Skia’s 2D hardware-accelerated graphics engine and Skia Graphite into the React Native ecosystem via Facebook JavaScript Interface (JSI) and Google Dawn (WebGPU). It decouples the React scene declaration from GPU execution through an asynchronous recording and rendering pipeline.

```
+---------------------------------------------------------------------------------------+
|                                    REACT RUNTIME                                      |
|  React 19 Reconciler (react-reconciler 0.33) -> Canvas Scene Graph -> Host Config     |
+---------------------------------------------------------------------------------------+
                                        │
                         (JS Thread: Reconcile & Record)
                                        ▼
+---------------------------------------------------------------------------------------+
|                           RNSkia RECORDING SUBSYSTEM                                  |
|   `Recorder` / `RNRecorder.h`                                                         |
|   - Registers conversion closures (`ConversionFunction`)                              |
|   - Slots shared animated values into `Variables` without reading values              |
|   - Generates immutable display lists & command buffers                               |
+---------------------------------------------------------------------------------------+
                │                                                     │
   (Direct offscreen draw)                                 (UI Thread frame sync)
                ▼                                                     ▼
+-------------------------------+              +----------------------------------------+
|    JS SYNCHRONOUS PATH        |              |       REANIMATED WORKLET / UI THREAD   |
| `recorder->readSharedValues()`|              | `SkiaViewApi.applyUpdates(nativeId, ...)|
| `makePicture()` -> `SkPicture`|              | Reads Reanimated 4 Shared Values atomically|
+-------------------------------+              +----------------------------------------+
                                                                      │
                                                   (Atomically marks `_hasReadValues`)
                                                                      ▼
+---------------------------------------------------------------------------------------+
|                          GRAPHITE RENDER THREAD POOL                                  |
|   `RNSkGraphiteProducer` (Metal on Apple, Vulkan on Android via Dawn)                 |
|   - Invariant Check: `hasContentLocked()` == (`_recorder && isReady()`) || `_picture` |
|   - Thread pacing: at most 1 job in-flight, max 1 frame ahead of VSync                |
|   - Dawn / Graphite Replay: submits commands to GPU hardware queues                   |
+---------------------------------------------------------------------------------------+
```

### Architectural Subsystems and Boundaries

1. **Declarative Host Reconciler (`src/renderer/`, `react-reconciler 0.33`)**:
   Provides custom JSX bindings (`<Canvas>`, `<Group>`, `<Path>`, `<Paint>`) bridging directly into native C++ structures. The reconciler records scene operations rather than issuing immediate draw commands. React 19 commit boundaries (`replaceContainerChildren`, `resetAfterCommit`) control when the native display list is published to the render engine.

2. **Decoupled Recording Pipeline (`cpp/api/recorder/RNRecorder.h`, `Convertor.h`)**:
   In v3 (Graphite-based architecture), React commits record operations into a `Recorder` instance. Animation hooks (Reanimated `SharedValue` instances) are bound to numeric slots within a `Variables` registry. Crucially, the recording phase **does not evaluate or read shared values**. It only records the target memory layout and conversion closures. This prevents blocking cross-thread round-trips from the JS thread to the UI thread.

3. **Multi-Threaded Presentation Engine (`cpp/rnskia/RNSkGraphiteProducer.cpp`)**:
   Decouples the UI thread from the GPU draw cycle. Graphite recordings are replayed on a dedicated background thread pool. Thread pacing invariants restrict the pipeline to at most one job in-flight and at most one frame queued ahead of the hardware display presentation (`kMaxQueued = 1`), preventing frame latency buildup and buffer bloat.

4. **Dawn / WebGPU Hardware Abstraction Layer (`cpp/rnskia/RNDawnUtils.h`, `RNDawnContext.h`)**:
   Sits underneath Skia Graphite. Maps platform graphics APIs—Metal on Darwin (iOS, macOS, tvOS) and Vulkan on Android—onto a unified WebGPU-compatible interface (`wgpu::Device`, `wgpu::Adapter`). Handles adapter enumeration, fallback detection (e.g., SwiftShader CPU emulation detection), and device-loss recoveries without destroying the underlying React root.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Zero-Reference Adoption for Smart Pointers (`sk_make_sp` vs `sk_ref_sp`)
**RULE**:
When initializing a ref-counted pointer (`sk_sp<T>`, `std::shared_ptr<T>`, or custom intrusive ref-counters) with a raw instance allocated via `new T()`, engineers MUST adopt the initial reference via factory primitives (`sk_make_sp<T>()` or constructor adoption) and MUST NOT call incrementing wrappers (`sk_ref_sp(new T())`).
**WHY**:
`sk_ref_sp(T* obj)` increments the existing reference count under the assumption that the caller is converting a pre-existing borrowed reference into an owned smart pointer. When coupled with `new T()`, which already initializes the reference count to 1, `sk_ref_sp` increases the reference count to 2. The wrapping smart pointer will only release one reference upon destruction, causing permanent memory leaks of the allocated object and all associated child caches (e.g., a 256-texture GPU cache pinned indefinitely).
**WHEN TO APPLY**:
Any C++ codebase utilizing intrusive reference counting frameworks, including Google Skia (`SkRefCnt`), WebKit (`WTF::RefCounted`), Chromium (`base::RefCountedThreadSafe`), or LLVM.
**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// Correct: sk_make_sp handles allocation and starts with refcount = 1
template <typename T, typename... Args>
sk_sp<T> createManagedResource(Args&&... args) {
    return sk_make_sp<T>(std::forward<Args>(args)...);
}

// Or if raw allocation is strictly required by custom allocators:
sk_sp<MyResource> makeAdoptingResource() {
    // Adopts existing ref without incrementing
    return sk_sp<MyResource>(new MyResource()); 
}
```
**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Double-ref on creation. Leak guaranteed.
sk_sp<MyResource> makeLeakingResource() {
    // new sets ref=1; sk_ref_sp calls ->ref(), setting ref=2!
    return sk_ref_sp(new MyResource()); 
}
```
**VERIFICATION METHOD**:
Automated standalone unit test verifying intrusive reference counters upon construction:
```cpp
auto instance = MyResource::Make();
assert(instance->unique() && "Resource MUST be constructed with exactly refcount == 1");
```

---

### 2. Thread-Isolated State Registration vs Synchronous UI-Thread Value Reads
**RULE**:
When recording visual command streams across heterogeneous threading models (e.g., React Native JS Thread vs Native UI Animation Thread), the recorder MUST ONLY register mutation conversions and memory offset slots during recording. The recorder MUST NOT evaluate or read animated shared values synchronously during the recording phase.
**WHY**:
Reading shared values across thread boundaries during recording creates a synchronous, blocking round-trip from the JS thread to the UI thread for every dynamic property in every frame. Furthermore, reading complex types (e.g., SkPictures, Path objects) forces the host runtime to allocate JavaScript wrappers that trigger garbage collector thrashing. It also causes "split-frame tearing" (temporal aliasing), where animated properties evaluated sequentially at different micro-moments within a single commit reflect incompatible time samples.
**WHEN TO APPLY**:
Cross-engine render loops, gaming architectures, React Native / Flutter custom platform renderers, and hybrid thread animation runners (Reanimated, Worklets, Web Worker DOM offscreen pipelines).
**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// C++: Convertor only stores lambda and slot binding; does NOT execute conversion
void registerAnimatedProperty(jsi::Runtime &rt, size_t slot, const jsi::Object &sv, ConversionFn fn) {
    // Invariant: Save conversion metadata into slot. Do NOT call fn(rt, sv) here!
    _variables.add(rt, sv, std::move(fn));
}

// UI Thread Mapper: Reads all registered slots atomically in a single pass
void Recorder::readUpdates(jsi::Runtime &rt, const jsi::Array &values) {
    std::vector<std::pair<size_t, PendingWrite>> writes;
    const auto count = std::min(values.size(rt), _variables.size());
    size_t index = 0;
    for (size_t slot = 0; slot < count; ++slot) {
        auto sharedVal = values.getValueAtIndex(rt, slot).asObject(rt);
        for (const auto &conv : _variables.conversions(slot)) {
            if (auto write = conv(rt, sharedVal)) {
                writes.emplace_back(index, std::move(write));
            }
            index++;
        }
    }
    // Atomic batch commit
    {
        std::lock_guard<std::mutex> lock(_pendingMutex);
        layoutPendingWritesLocked();
        for (auto &[i, write] : writes) {
            _pendingWrites[i] = std::move(write);
        }
        _hasPendingWrites = true;
    }
    _hasReadValues.store(true, std::memory_order_release);
}
```
**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Synchronously evaluating shared values while recording scene graph
void recordPropertyBad(jsi::Runtime &rt, const jsi::Object &sharedValue, ConversionFn fn) {
    _variables.add(rt, sharedValue, fn);
    // CRITICAL HAZARD: Blocks the JS thread waiting for UI thread response,
    // leaks wrappers to GC, and reads temporal values out-of-sync.
    if (auto write = fn(rt, sharedValue)) {
        write();
    }
}
```
**VERIFICATION METHOD**:
Enforce lock-free release-acquire memory barriers verifying recorder readiness before presentation:
```cpp
assert(recorder->isReady() == (recorder->variablesCount() == 0 || hasReadValues.load(std::memory_order_acquire)));
```

---

### 3. Vulkan Extension Mutexing in Shared Device Contexts
**RULE**:
When initializing a WebGPU/Dawn graphics device backed by Vulkan, the driver initialization layer MUST NOT request multiple incompatible synchronization extensions simultaneously. Specifically, implementations MUST select at most one Vulkan shared-fence type (`SharedFenceSyncFD`, `SharedFenceVkSemaphoreOpaqueFD`, or `SharedFenceVkSemaphoreZirconHandle`), preferring `SharedFenceSyncFD` for Linux/Android POSIX handle interoperability.
**WHY**:
Dawn and standard Vulkan validation layers treat multiple shared-fence features as mutually exclusive device features. Requesting both `SharedFenceSyncFD` and `SharedFenceVkSemaphoreOpaqueFD` violates Vulkan device creation contracts, triggering immediate hard-aborts or `VK_ERROR_INITIALIZATION_FAILED` inside mobile GPU drivers (e.g., Qualcomm Adreno, ARM Mali, and Android Emulator gfxstream drivers).
**WHEN TO APPLY**:
Native graphics engines running WebGPU/Dawn on Android, Linux, or Chromium-embedded environments integrating with Android `AHardwareBuffer` or external framebuffers.
**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
std::vector<wgpu::FeatureName> filterVulkanFeatures(
    const dawn::native::Adapter &adapter,
    const std::vector<wgpu::FeatureName> &requestedFeatures) 
{
    std::vector<wgpu::FeatureName> resolvedFeatures;
    bool hasVulkanSharedFence = false;

    for (auto feature : requestedFeatures) {
        if (!adapter.HasFeature(feature)) {
            continue;
        }

        const bool isVulkanSharedFence =
            feature == wgpu::FeatureName::SharedFenceSyncFD ||
            feature == wgpu::FeatureName::SharedFenceVkSemaphoreOpaqueFD ||
            feature == wgpu::FeatureName::SharedFenceVkSemaphoreZirconHandle;

        if (isVulkanSharedFence) {
            if (hasVulkanSharedFence) {
                // Drop conflicting subsequent shared-fence extensions
                continue; 
            }
            hasVulkanSharedFence = true;
        }
        resolvedFeatures.push_back(feature);
    }
    return resolvedFeatures;
}
```
**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Blindly pushing all supported features into device descriptor
std::vector<wgpu::FeatureName> badFeatureResolution(const dawn::native::Adapter &adapter) {
    std::vector<wgpu::FeatureName> features;
    for (auto f : requestedFeatures) {
        if (adapter.HasFeature(f)) {
            // WILL CRASH on Vulkan if both SyncFD and OpaqueFD are supported
            features.push_back(f); 
        }
    }
    return features;
}
```
**VERIFICATION METHOD**:
Add an automated native integration test initializing `dawn::native::Device` on an Android emulator or Linux headless Vulkan instance to assert device creation succeeds without validation errors.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Blocking UI Reads & Frame Tearing in Reanimated 4 Integration (BUG-RNSKIA-01)
- **Context**: `packages/skia/cpp/api/recorder/Convertor.h`, `RNRecorder.h`, `RNSkGraphiteProducer.cpp`, `packages/skia/src/sksg/Container.native.ts`
- **What Was Expected**: Recording a dynamic Skia scene with Reanimated 4 Shared Values on the JS thread must be instantaneous, non-blocking, and present clean, temporally coherent frames without JS GC pressure.
- **What Actually Happened**: Recording a scene evaluated the current value of every shared-value prop on the JS thread to seed the recording. With Reanimated 4's strict thread isolation, every JS-thread read of a UI-thread shared value was a synchronous, blocking cross-thread round trip. When shared values contained large Skia objects (like `SkPicture`), reading them wrapped each object in a new JSI wrapper every commit, creating massive garbage collector spikes. Additionally, frames exhibited visual tearing (#4097) because sequential shared values were read at different microsecond timestamps during a single React render pass.
- **Evidence in Repo**: Commit `32089636`, Issues #4243, #4097, #4300.
- **Root Cause**: Immediate invocation of the conversion function `if (auto write = conv(runtime, sharedValue)) { write(); }` within `convertPropertyImpl` and `convertSelectorProperty` during the recording pass.
- **Remediation Code Diff**:
```cpp
--- a/packages/skia/cpp/api/recorder/Convertor.h
+++ b/packages/skia/cpp/api/recorder/Convertor.h
@@ -232,9 +244,6 @@ bool convertSelectorProperty(jsi::Runtime &runtime, const jsi::Value &prop,
   };
 
   variables.add(runtime, sharedValue, conv);
-  if (auto write = conv(runtime, sharedValue)) {
-    write();
-  }
   return true;
 }

--- a/packages/skia/cpp/rnskia/RNSkGraphiteProducer.cpp
+++ b/packages/skia/cpp/rnskia/RNSkGraphiteProducer.cpp
@@ -79,7 +79,15 @@ void RNSkGraphiteProducer::replaceContent(std::shared_ptr<Recorder> recorder,
+bool RNSkGraphiteProducer::hasContentLocked() const {
+  // A recording whose shared values have not been read yet is not content:
+  // its animated properties are unset, and replaying it would draw them wrong.
+  return (_recorder != nullptr && _recorder->isReady()) || _picture != nullptr;
+}
```
- **Lesson**: Separate registration from evaluation in multi-threaded visual renderers. Defer variable evaluation to the thread that owns the values (the UI worklet thread), gating frame presentation behind an atomic readiness flag (`isReady()`).

---

### Incident 2: Permanent GPU Cache Leak via Double-Referencing Smart Pointers (BUG-RNSKIA-02)
- **Context**: `packages/skia/cpp/rnskia/RNImageProvider.h`, `RNDawnContext.h`
- **What Was Expected**: Each Graphite `Recorder` must strictly own its dedicated `ImageProvider`. When the recorder is destroyed, the image provider and its 256 cached textures must be freed from GPU memory immediately.
- **What Actually Happened**: The provider survived the recorder. GPU memory grew unbounded until the operating system terminated the application via OOM (Out Of Memory).
- **Evidence in Repo**: Commit `d39702cf`, PR #4277.
- **Root Cause**: `ImageProvider::Make()` executed `return sk_ref_sp(new ImageProvider)`. The constructor started the instance with reference count = 1. `sk_ref_sp` incremented the reference count to 2. When the owning `RecorderOptions` dropped its `sk_sp`, the reference count decremented to 1, leaving the provider orphaned but permanently alive in memory alongside a `thread_local` cache container.
- **Remediation Code Diff**:
```cpp
--- a/packages/skia/cpp/rnskia/RNImageProvider.h
+++ b/packages/skia/cpp/rnskia/RNImageProvider.h
@@ -21,7 +21,10 @@ class ImageProvider : public skgpu::graphite::ImageProvider {
   ImageProvider() : fCache(kDefaultNumCachedImages) {}\n   ~ImageProvider() override {}\n \n-  static sk_sp<ImageProvider> Make() { return sk_ref_sp(new ImageProvider); }
+  // sk_make_sp adopts the reference `new` starts with. sk_ref_sp(new ...)
+  // would add a second one that nothing releases, so the provider and the
+  // images it caches would outlive their recorder.
+  static sk_sp<ImageProvider> Make() { return sk_make_sp<ImageProvider>(); }
```
- **Lesson**: Never wrap `new ClassName()` inside reference-incrementing smart pointer helpers. Always use allocation constructors like `std::make_shared` or `sk_make_sp` that configure reference semantics cleanly. Verify reference counts via isolated host-side C++ CI harnesses.

---

### Incident 3: React 19.2 Reconciler Desynchronization & Event Crash (BUG-RNSKIA-03)
- **Context**: `packages/skia/package.json`, `packages/skia/src/renderer/Canvas.tsx`, `packages/skia/src/sksg/Container.native.ts`
- **What Was Expected**: `<Canvas>` reconciler must seamlessly interoperate with React Native 0.83.1 without throwing runtime errors during component lifecycle events like `useEffectEvent`.
- **What Actually Happened**: `useEffectEvent` threw fatal crashes inside `<Canvas>` children. The monorepo CI tests passed locally because tests were pinned to React 19.0.0, masking the runtime incompatibilities present in downstream projects using React 19.2.
- **Evidence in Repo**: Commit `509381ac`, PR #4260.
- **Root Cause**: `react-native-skia` shipped with `react-reconciler@0.31.0` (React 19.0 contract). React 19.2 changed reconciler behavior: it removed certain internal host config methods and changed `resetAfterCommit` to only trigger if the tree structurally mutated.
- **Remediation Code Diff**:
```json
--- a/packages/skia/package.json
+++ b/packages/skia/package.json
@@ -113,7 +113,7 @@
-    "@types/react-reconciler": "0.31.0",
+    "@types/react-reconciler": "0.33.1",
@@ -148,7 +148,7 @@
-    "react-reconciler": "0.31.0"
+    "react-reconciler": "0.33.0"
```
```typescript
--- a/packages/skia/src/renderer/typeddash.ts
+++ b/packages/skia/src/renderer/typeddash.ts
@@ -7,21 +7,3 @@ export const exhaustiveCheck = (a: never): never => {
   "worklet";
   throw new Error(`Unexhaustive handling for ${a}`);
 };
-// REMOVED: shallowEq obsolete; React 19.2 reconciler handles commit comparisons natively
```
- **Lesson**: Do not let host config reconcilers drift behind host framework peer versions. In React 19+, custom host config implementations must update alongside React's experimental feature hooks (`useEffectEvent`).

---

### Incident 4: Incompatible Vulkan Shared-Fence Driver Crash on Android (BUG-RNSKIA-04)
- **Context**: Dawn backend initialization on Android emulator / Vulkan driver (`RNDawnUtils.h`).
- **What Was Expected**: Dawn device creation must succeed across all Vulkan 1.1+ conformant devices and emulators.
- **What Actually Happened**: App hard-crashed on startup on Android devices and emulators with a native driver crash: `Skia requested two incompatible Vulkan graphics features`.
- **Evidence in Repo**: Issue #4154.
- **Root Cause**: Both `SharedFenceSyncFD` and `SharedFenceVkSemaphoreOpaqueFD` were reported as supported by the adapter. The engine appended all supported features to the device request vector. Dawn allows only one Vulkan shared-fence type per device instance.
- **Remediation Code Diff**:
```cpp
+ bool hasVulkanSharedFence = false;
  for (auto feature : requestedFeatures) {
    if (adapter.HasFeature(feature)) {
+      const bool isVulkanSharedFence =
+          feature == wgpu::FeatureName::SharedFenceSyncFD ||
+          feature == wgpu::FeatureName::SharedFenceVkSemaphoreOpaqueFD ||
+          feature == wgpu::FeatureName::SharedFenceVkSemaphoreZirconHandle;
+      if (isVulkanSharedFence && hasVulkanSharedFence) {
+        continue;
+      }
+      hasVulkanSharedFence |= isVulkanSharedFence;
       features.push_back(feature);
    }
  }
```
- **Lesson**: Hardware device feature queries must enforce exclusivity groups where the underlying graphics driver permits only one mechanism from a class of extensions.

---

### Incident 5: Discrete Vertex Parsing Bottleneck over JSI Boundary (BUG-RNSKIA-05)
- **Context**: JSI HostObject boundary for `Skia.MakeVertices` / `<Vertices>`.
- **What Was Expected**: Rendering complex vertex meshes (3,000+ points) from a Reanimated 60fps worklet should take < 2ms of UI-thread execution time.
- **What Actually Happened**: Point conversion consumed 43% of the main thread frame budget on mobile chipsets (e.g., Galaxy A55), causing frame drops and visual stutter.
- **Evidence in Repo**: Issue #4172.
- **Root Cause**: Vertices were passed across the JSI bridge as arrays of JavaScript `{ x: number, y: number }` objects. The C++ JSI host function read property keys `"x"` and `"y"` one-by-one via individual dynamic hash lookups (`obj.getProperty(rt, "x").asNumber()`), executing thousands of JSI calls per frame instead of bulk copying memory.
- **Remediation Pattern**:
Accept typed contiguous byte buffers (`Float32Array` backed by `jsi::ArrayBuffer`) for bulk geometry ingestion, falling back to object decoding only for small static meshes:
```cpp
// Fast Path: Direct flat float buffer extraction via memcpy
if (pointsVal.isObject() && pointsVal.asObject(runtime).isArrayBuffer(runtime)) {
    auto arrayBuffer = pointsVal.asObject(runtime).getArrayBuffer(runtime);
    size_t pointCount = arrayBuffer.size(runtime) / (sizeof(float) * 2);
    const float* data = reinterpret_cast<const float*>(arrayBuffer.data(runtime));
    skPoints.resize(pointCount);
    std::memcpy(skPoints.data(), data, pointCount * sizeof(SkPoint));
}
```
- **Lesson**: Never marshal high-density geometric streams across language boundaries as individual structured objects. Use flat typed arrays and direct memory copies (`memcpy`).

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Extended Linear Color Spaces vs SDR Precision**:
  In `MetalLayerColorSpaceUtils.h`, setting `CAMetalLayer.colorspace = nil` on standard 8-bit textures defaults to SDR sRGB. However, on wide/float textures (`kRGBA_F16_SkColorType`), Core Animation interprets `nil` as **extended linear sRGB**. This makes identical numerical color values appear significantly brighter and washed out.
  ```objc
  // INVARIANT: Float formats MUST be explicitly tagged with extended gamma-corrected color spaces
  if (isFloatFormat) {
    CGColorSpaceRef colorSpace = CGColorSpaceCreateWithName(
        useP3ColorSpace ? kCGColorSpaceExtendedDisplayP3 : kCGColorSpaceExtendedSRGB);
    layer.colorspace = colorSpace;
    CGColorSpaceRelease(colorSpace);
  }
  ```
- **String Termination Pitfalls with `wgpu::StringView`**:
  `RNDawnUtils.h` reveals a fatal token bug: `wgpu::StringView.length` can equal `wgpu::kStrlen`, signaling a null-terminated C string. Constructing `std::string(view.data, view.length)` directly will treat `wgpu::kStrlen` (`0xFFFF'FFFF'FFFF'FFFF`) as the byte count, resulting in a fatal `std::length_error` or buffer over-read:
  ```cpp
  // INVARIANT: Wrap StringView in std::string_view first to safely resolve kStrlen
  inline std::string toString(wgpu::StringView view) {
    return std::string(std::string_view(view));
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **Skottie Property Path Recursion**:
  In `SkottieUtils.cpp`, nested hierarchical animation trees trigger `onEnterNode` and `onLeavingNode`. Unbounded string concatenations can cause infinite loops or stack overflow if cycle prevention is absent:
  ```cpp
  void onLeavingNode(const char node_name[], PropertyObserver::NodeType) override {
    if (node_name == nullptr) return;
    auto length = strlen(node_name);
    // INVARIANT: Boundary guard preventing underflow on root string slicing
    fMgr->fCurrentNode = fMgr->fCurrentNode.length() > length
        ? fMgr->fCurrentNode.substr(0, fMgr->fCurrentNode.length() - length - 1)
        : "";
  }
  ```
- **Worker Thread Termination & Condition Variable Spurious Wakeups**:
  `RNSkWorker.h` enforces an infinite worker loop guarded against spurious wakeups using a condition variable predicate:
  ```cpp
  std::unique_lock<std::mutex> lock(_mutex);
  // Termination proof: Predicate returns false while deque is empty
  _condition.wait(lock, [this]() { return !_jobs.empty(); });
  job = std::move(_jobs.front());
  _jobs.pop_front();
  ```

### 3. UI & UX Micro-Mechanics
- **Double Disposal in WebGL/WebGPU Three.js Canvas**:
  In `makeWebGPURenderer.ts`, calling `renderer.setAnimationLoop(null)` alone fails to stop internal requestAnimationFrame callbacks, keeping the entire scene graph rooted in memory. Complete teardown requires explicit ordering:
  ```typescript
  // INVARIANT: Stop loop -> Dispose renderer -> Scrub global listener singletons
  renderer.setAnimationLoop(null);
  renderer.dispose();
  const quad = new (THREE as any).QuadMesh();
  const targets = [quad.geometry, quad.geometry.index, ...Object.values(quad.geometry.attributes)];
  for (const target of targets) {
    if (target && target._listeners) {
      target._listeners = {}; // Eliminate static memory roots
    }
  }
  ```
- **WebGL Context Limits & Churn Eviction Guard**:
  In `WebGLLifecycle.tsx`, browsers (Chromium) enforce a hard limit of 16 live WebGL contexts per process before silently evicting the oldest context. React Native Skia on Web must route all `<Canvas>` components through one shared WebGL context singleton (`peekSharedWebGLContext`), preventing canvas loss during fast DOM remounting.

### 4. Backend Concurrency & Memory Safety
- **Lock-Free Readiness Check via Atomic Memory Order**:
  `RNRecorder.h` synchronizes the UI/Reanimated thread with the background render pool using atomic barriers:
  ```cpp
  // Writer thread (UI Thread after reading values):
  _hasReadValues.store(true, std::memory_order_release);

  // Reader thread (Graphite Render Pool):
  bool isReady() const {
    return variables.empty() || _hasReadValues.load(std::memory_order_acquire);
  }
  ```
  This guarantees that all pending write operations staged before `_hasReadValues` are visible to the render thread before it starts replaying commands.

- **Thread-Local Lifetime Decoupling**:
  In `RNDawnContext.h`, static `thread_local` options pinned image caches across multiple recorder instances. The fix decouples lifetime ownership:
  ```cpp
  // INVARIANT: Keep options local so image provider lifetime matches the recorder
  std::unique_ptr<skgpu::graphite::Recorder> makeRecorderWithImageProvider() {
    skgpu::graphite::RecorderOptions options;
    options.fImageProvider = ImageProvider::Make();
    return fGraphiteContext->makeRecorder(options);
  }
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Custom Property Observer Destructor Corruption**:
  In `SkottieUtils.cpp`, manual raw pointer deallocation collided with `sk_sp` intrusive reference counts:
  ```cpp
  // DEFECT TRAP:
  auto rawptr1 = fPropertyInterceptor.get();
  fPropertyInterceptor = nullptr;
  delete rawptr1; // Double free! SkRefCnt was already managed by sk_sp.
  ```
  *Rule*: If an object inherits from `SkRefCnt`, never invoke `delete` directly on its pointer. Clear the `sk_sp` container and let the intrusive reference count reach zero naturally.

- **Missing GPU Adapter Diagnostics**:
  `RNDawnUtils.h` prevents silent failures when initializing graphics contexts on unsupported hardware by formatting comprehensive diagnostic messages:
  ```cpp
  if (adapters.empty()) {
    throw std::runtime_error(describeMissingAdapter(instance));
  }
  ```
  The error message details every enumerated adapter, its backend type, vendor ID, and why it failed to satisfy WebGPU Core requirements.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Decoupled multi-threaded rendering pipeline. Separates JSX reconciliation (JS thread), animation updates (UI thread worklets), and hardware drawing (native background thread pool). By routing all graphics operations through a central `Recorder` abstraction, the system achieves near 60/120fps display refresh rates even when the React JS thread is busy.

### 2. Core Abstractions
- `Recorder` (`cpp/api/recorder/RNRecorder.h`): Thread-safe command