> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wcandillon-react-native-skia-learnings.md`  
> **Source**: GitHub ([https://github.com/wcandillon/react-native-skia](https://github.com/wcandillon/react-native-skia))  
> **License**: MIT  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-10-05T13:46:13.131Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Personal emails/PII sanitized at ingestion.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation or use as an AI/ML training dataset is prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): wcandillon/react-native-skia

## 1. Executive Forensic Architecture & System Mechanics

The `wcandillon/react-native-skia` repository provides high-performance 2D hardware-accelerated graphics for React Native by embedding the Skia Graphics Library. It bridges the gap between declarative React code and low-level GPU rendering pipelines (Metal on Apple, Vulkan/OpenGL on Android, and WebGL/WebGPU on Web).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   JavaScript Engine                                    │
│  ┌──────────────────────────────────┐        ┌──────────────────────────────────────┐  │
│  │    React Reconciler (Fiber)      │        │     Reanimated Worklets (JS Thread)  │  │
│  └─────────────────┬────────────────┘        └──────────────────┬───────────────────┘  │
└────────────────────┼────────────────────────────────────────────┼──────────────────────┘
                     │ JSI (JavaScript Interface)                 │ Shared Values
┌────────────────────▼────────────────────────────────────────────▼──────────────────────┐
│                                     C++ JSI Layer                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │  JsiSkCanvas, JsiSkPath, JsiSkPaint, JsiSkShader, JsiSkImage                     │  │
│  └─────────────────┬────────────────────────────────────────────┬───────────────────┘  │
└────────────────────┼────────────────────────────────────────────┼──────────────────────┘
                     │ Direct C++ Calls                           │ Direct C++ Calls
┌────────────────────▼────────────────────────────────────────────▼──────────────────────┐
│                                  Skia Core Engine                                      │
│  ┌──────────────────────────────────┐        ┌──────────────────────────────────────┐  │
│  │      Ganesh Backend (Legacy)     │        │      Graphite Backend (v3+)          │  │
│  │  (OpenGL, Metal, Vulkan)         │        │  (Dawn, WebGPU, Vulkan, Metal)       │  │
│  └─────────────────┬────────────────┘        └──────────────────┬───────────────────┘  │
└────────────────────┼────────────────────────────────────────────┼──────────────────────┘
                     │ Platform Buffers                           │ Platform Buffers
┌────────────────────▼────────────────────────────────────────────▼──────────────────────┐
│                                Platform Native Layer                                   │
│  ┌──────────────────────────────────┐        ┌──────────────────────────────────────┐  │
│  │  Android: JNI, AHardwareBuffer   │        │  iOS/macOS: Metal, CVPixelBuffer     │  │
│  └──────────────────────────────────┘        └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Boundaries & Decoupling
1. **The JS/C++ Boundary (JSI)**: Unlike standard React Native modules that serialize data over the asynchronous JSON bridge, React Native Skia uses the **JavaScript Interface (JSI)**. C++ host objects are exposed directly to JavaScript. This allows synchronous, zero-copy execution of drawing commands.
2. **The Declarative/Imperative Boundary**: The React Reconciler translates declarative JSX elements (e.g., `<skCanvas>`, `<skPath>`) into an imperative command buffer (via `SkiaSGRoot` and `Recorder`).
3. **The Graphics Backend Boundary (Ganesh vs. Graphite)**:
   * **Ganesh**: The legacy backend where Skia manages its own GPU context and command submission using traditional APIs (OpenGL, Metal).
   * **Graphite**: The modern, next-generation backend designed for modern APIs (Metal, Vulkan, Dawn/WebGPU). It decouples command recording from GPU submission, allowing multi-threaded command recording.

### Critical Subsystem Abstractions
* **`RNSkManager`**: The central coordinator that initializes the JSI bindings, manages the platform-specific graphics context, and schedules frames on the JS/UI threads.
* **`JsiSkNativeObject`**: The base C++ class for all JSI wrappers. It manages the lifetime of the underlying Skia C++ objects (e.g., `SkPath`, `SkPaint`) and implements memory pressure reporting to the JS garbage collector.
* **`DawnContext` / `DawnWindowContext`**: Abstractions over Google's Dawn (WebGPU implementation) that manage device selection, adapter capabilities, swapchains, and surface configurations.
* **`SkiaPictureView` / `RNSkPictureRenderer`**: Manages offscreen recording (`SkPictureRecorder`) and playback onto the active onscreen surface.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: WebGL Context Leak on Canvas Unmount & Relayout (BUG-WEBGL-LEAK-01)
* **Context**: `packages/skia/src/views/SkiaPictureView.web.tsx`
* **What Was Expected**: Unmounting a `<Canvas>` component or triggering a layout resize should cleanly release WebGL contexts and allow the browser to garbage-collect the canvas element and its parent DOM subtree.
* **What Actually Happened**: CanvasKit retained WebGL contexts in its internal Emscripten GL table. The canvas element remained pinned in memory, keeping the entire parent DOM subtree and decoded images reachable from the GC root. Additionally, `SkiaPictureView` recreated a new WebGL context on every layout event without disposing of the old one, causing rapid context exhaustion and browser crashes.
* **Evidence in Repo**: Issue #3924, Commit `e0c208e6`.
* **Root Cause**: `CanvasKit.MakeWebGLCanvasSurface` registered WebGL contexts but never deleted them. Because the Emscripten registry held strong references to the canvas elements, unmounted subtrees were leaked.
* **Remediation Code Diff**:
```typescript
// - packages/skia/src/views/SkiaPictureView.web.tsx (Buggy)
// constructor(private canvas: HTMLCanvasElement) {
//   this.contextHandle = CanvasKit.GetWebGLContext(canvas);
//   this.grContext = CanvasKit.MakeWebGLContext(this.contextHandle);
// }

// + packages/skia/src/views/SkiaPictureView.web.tsx (Fixed)
interface CanvasWebGL {
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  loseContext: { loseContext(): void; restoreContext(): void } | null;
  lossAnnounced: boolean;
  owner: WebGLRenderer | null;
}
const canvasWebGL = new WeakMap<HTMLCanvasElement, CanvasWebGL>();

const deleteContextHandle = (handle: WebGLContextHandle) => {
  CanvasKit.deleteContext(handle);
  CanvasKit.MakeWebGLContext(handle); // Clears CanvasKit's current-context globals
};
```
* **Lesson**: When bridging WASM/Emscripten runtimes with the DOM, you must explicitly clean up registered handles. Relying on JS garbage collection to release native/WASM-registered resources will leak memory.

### Incident 2: Truthiness Check Swallowing Valid Zero Values (BUG-ZERO-VAL-02)
* **Context**: `packages/skia/src/skia/web/JsiSkCanvas.ts`, `JsiSkImage.ts`, `JsiSkTextStyle.ts`, `Drawing.ts`
* **What Was Expected**: Passing `0` as a valid domain value (e.g., `BlendMode.Clear` (0), JPEG quality `0`, `FontWeight.Invisible` (0), or an SVG offset of `x = 0`) should be honored.
* **What Actually Happened**: The Web/JS implementation used loose truthiness checks (`if (quality)`, `if (x && y)`, `if (mode)`). This caused `0` to be treated as "not provided," falling back to default values (e.g., quality 100, no offset, default blend mode).
* **Evidence in Repo**: Commit `2de503ca`, `fbff3d86`.
* **Root Cause**: JavaScript's implicit type coercion treats `0` as falsy.
* **Remediation Code Diff**:
```typescript
// - packages/skia/src/sksg/Recorder/commands/Drawing.ts (Buggy)
// if (x && y) {
//   canvas.translate(x, y);
// }

// + packages/skia/src/sksg/Recorder/commands/Drawing.ts (Fixed)
if (x !== undefined && y !== undefined) {
  canvas.translate(x, y);
}
```
* **Lesson**: Never use truthiness checks (`if (value)`) for variables that can legitimately hold `0` or empty strings. Use explicit `!== undefined` and `!== null` checks.

### Incident 3: JSI Argument Out-of-Bounds Crash in `drawPatch` (BUG-JSI-OOB-03)
* **Context**: `packages/skia/cpp/api/JsiSkCanvas.h`
* **What Was Expected**: Calling `drawPatch` with 4 arguments (omitting the optional paint) should fall back to a default paint without crashing.
* **What Actually Happened**: The C++ JSI wrapper read `arguments[4]` whenever `count >= 4`. For a 4-argument call, this read past the end of the JSI argument array, resulting in a null paint pointer dereference and an immediate native crash.
* **Evidence in Repo**: Commit `48b33020`.
* **Root Cause**: The code checked `count >= 4` to read the paint at index `4` (which is the 5th argument).
* **Remediation Code Diff**:
```cpp
// - packages/skia/cpp/api/JsiSkCanvas.h (Buggy)
// auto paint = count >= 4 ? JsiSkPaint::fromValue(runtime, arguments[4]) : nullptr;
// auto blendMode = static_cast<SkBlendMode>(arguments[3].asNumber());

// + packages/skia/cpp/api/JsiSkCanvas.h (Fixed)
auto blendMode =
    count >= 4 && !arguments[3].isNull() && !arguments[3].isUndefined()
        ? toBlendMode(arguments[3].asNumber())
        : SkBlendMode::kModulate;

std::shared_ptr<SkPaint> paint;
if (count >= 5 && !arguments[4].isNull() && !arguments[4].isUndefined()) {
  paint = JsiSkPaint::fromValue(runtime, arguments[4]);
}
SkPaint defaultPaint;
```
* **Lesson**: JSI argument arrays are zero-indexed. The argument count check must be strictly greater than the index being accessed (`count > index` or `count >= index + 1`).

### Incident 4: Main-Thread Hangs on iOS Cold Launch due to Discarded GrContextOptions (BUG-METAL-CACHE-04)
* **Context**: `packages/skia/apple/MetalContext.mm`
* **What Was Expected**: The Metal direct context should be created with `GrContextOptions` to enable persistent shader caching.
* **What Actually Happened**: The single-argument `GrDirectContexts::MakeMetal(backendContext)` overload was called. This discarded the configured `GrContextOptions` and forced SkSL (Skia Shading Language) compilation on the main thread on every cold launch, causing 150ms+ main-thread hangs.
* **Evidence in Repo**: Commit `75840d85`.
* **Root Cause**: Calling the wrong C++ overload of `MakeMetal`.
* **Remediation Code Diff**:
```objectivec
// - packages/skia/apple/MetalContext.mm (Buggy)
// _directContext = GrDirectContexts::MakeMetal(backendContext);

// + packages/skia/apple/MetalContext.mm (Fixed)
GrContextOptions grContextOptions; // set different options here.
_directContext = GrDirectContexts::MakeMetal(backendContext, grContextOptions);
```
* **Lesson**: When configuring native graphics contexts, verify that your configuration options are actually passed to the factory function.

### Incident 5: Memory Pressure Reporting Overhead (BUG-MEM-PRESSURE-05)
* **Context**: `packages/skia/cpp/api/JsiSkPath.h`, `JsiSkPathBuilder.h`
* **What Was Expected**: JSI objects should report their memory footprint to the JS garbage collector efficiently.
* **What Actually Happened**: Path and PathBuilder objects measured memory by snapshotting the entire path (`snapshot().approximateBytesUsed()`). This copied the underlying point and verb arrays on every round trip to JS, causing massive CPU overhead.
* **Evidence in Repo**: Commit `3f7cfdbb`.
* **Root Cause**: Measuring memory by performing an expensive copy operation.
* **Remediation Code Diff**:
```cpp
// - packages/skia/cpp/api/JsiSkPath.h (Buggy)
// size_t getMemoryPressure() override {
//   auto builder = getObject();
//   if (!builder) return 0;
//   return builder->snapshot().approximateBytesUsed();
// }

// + packages/skia/cpp/api/JsiSkPath.h (Fixed)
size_t getMemoryPressure() override {
  if (isDisposed()) {
    return 0;
  }
  auto builder = getObjectUnchecked();
  if (!builder) {
    return 0;
  }
  // Sum the sizes of the internal arrays directly without copying
  return builder->points().size_bytes() + builder->verbs().size_bytes() +
         builder->conicWeights().size_bytes();
}
```
* **Lesson**: Memory pressure reporting must be a fast, constant-time ($O(1)$) or lightweight linear ($O(N)$) calculation. It must never perform deep copies or allocate memory.

---

## 3. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Falsy `0` and Empty String Traps**: In JS/TS wrappers, never use loose checks for numeric or enum values.
  ```typescript
  // CRITICAL VIOLATION
  const quality = options.quality || 100; // If quality is 0, it becomes 100!
  
  // SECURE INVARIANT
  const quality = options.quality !== undefined ? options.quality : 100;
  ```
* **JSI Value Type Assertions**: Before extracting values from `jsi::Value`, you must explicitly assert their types. Accessing a type without asserting will throw a C++ exception and crash the JS runtime.
  ```cpp
  // Safe extraction pattern
  if (value.isNumber()) {
    double val = value.asNumber();
  }
  ```
* **Memory Ownership in WebGPU/Dawn**: When wrapping raw pointers from external libraries, you must manually increment the reference count to prevent use-after-free bugs.
  ```cpp
  wgpuTextureAddRef(raw);
  wgpu::Texture texture = wgpu::Texture::Acquire(raw);
  ```

### 2. Infinite Loop & Recursion Guards
* **Degenerate Path Interpolation**: When interpolating between two paths, if the interpolation factor `t` is calculated from identical input stops (`to === from`), it results in `NaN` or `Infinity`.
  ```typescript
  // Invariant Guard
  if (to === from) {
    return p2; // Jump to end path to prevent division by zero
  }
  const t = (value - from) / (to - from);
  ```
* **Reanimated Shared Value Flooding**: Avoid running unpaused background timers (`setInterval`) that update shared values. When the app is backgrounded, the JS thread is suspended, but timers can queue up. On resume, they fire back-to-back, flooding the rendering pipeline.
  ```typescript
  // Invariant Guard: Pause timers on app state change
  useEffect(() => {
    const subscription = AppState.addEventListener("change", nextAppState => {
      if (nextAppState === "active") {
        resumeTimer();
      } else {
        pauseTimer();
      }
    });
    return () => subscription.remove();
  }, []);
  ```

### 3. UI & UX Micro-Mechanics
* **WebGL Context Restoration**: Browsers can evict WebGL contexts at any time (e.g., due to memory pressure or GPU resets). The renderer must listen for `webglcontextlost` and `webglcontextrestored` events to rebuild its surface.
  ```typescript
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault(); // Tells the browser we handle restoration
    this.lossAnnounced = true;
  });
  ```
* **Color Space Matching**: When rendering with high bit-depth float formats (e.g., `RGBA16Float`), you must tag the platform layer (e.g., `CAMetalLayer`) with the matching extended colorspace. Otherwise, the OS will interpret the linear values as standard sRGB, making the output noticeably brighter.
  ```objectivec
  if (isFloatFormat) {
    CGColorSpaceRef colorSpace = CGColorSpaceCreateWithName(kCGColorSpaceExtendedSRGB);
    layer.colorspace = colorSpace;
    CGColorSpaceRelease(colorSpace);
  }
  ```

### 4. Backend Concurrency & Memory Safety
* **Java GC Bypass for Native Views**: React Native drops Java views when unmounting, but the underlying C++ view and its recorded commands are only destroyed when the Java object is finalized by the garbage collector. To prevent memory spikes, you must explicitly release the content during unregistration.
  ```cpp
  void unregisterView() override {
    JniSkiaBaseView::unregisterView();
    if (_skiaAndroidView != nullptr) {
      auto renderer = std::static_pointer_cast<RNSkia::RNSkPictureRenderer>(
          _skiaAndroidView->getSkiaView()->getRenderer());
      renderer->clear(); // Release recorded commands immediately
    }
  }
  ```
* **AHardwareBuffer API Guards**: `AHardwareBuffer` is only available on Android API level 26 (Android 8.0) and above. Any code accessing it must be guarded with preprocessor and runtime checks.
  ```cpp
  #if defined(__ANDROID__) && __ANDROID_API__ < 26
    (void)buffer;
    return nullptr;
  #else
    // Safe to use AHardwareBuffer
  #endif
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
* **SVG Parse Validation**: SVG parsing can fail if the input string or data is malformed. Always check the result of the SVG DOM builder before wrapping it in a JSI object.
  ```cpp
  auto svg_dom = builder.make(*stream);
  if (!svg_dom) {
    return jsi::Value::null(); // Prevent null pointer dereference
  }
  ```
* **Early Build-Time Assertions**: When linking against external shared libraries (like Dawn), verify their presence during the build step (Gradle/CocoaPods) to fail early with a clear error message, rather than failing later with cryptic linker errors.
  ```groovy
  def missingDawn = ["armeabi-v7a", "arm64-v8a", "x86", "x86_64"].findAll {
      !file("${skiaLibsPath}/${it}/libwebgpu_dawn.so").exists()
  }
  if (!missingDawn.isEmpty()) {
      throw new GradleException("react-native-