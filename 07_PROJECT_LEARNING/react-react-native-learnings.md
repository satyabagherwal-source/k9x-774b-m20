> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/react-react-native-learnings.md`  
> **Source**: GitHub ([https://github.com/react/react-native](https://github.com/react/react-native))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T18:55:16.397Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: react/react-native

## 1. Executive Forensic Architecture & System Mechanics
React Native (RN) functions as a **Bridge-to-Native-Renderer Orchestrator**. Its core architecture has shifted from a serialized asynchronous bridge (Legacy) to a direct C++ JSI (JavaScript Interface) layer (Fabric/TurboModules). 
- **Fabric (Renderer):** A C++ based UI manager that maintains a shadow tree of UI components, synchronizing state with native platforms (Android/iOS) via JNI and Objective-C++ respectively.
- **Hermes:** A custom VM optimized for mobile, utilizing bytecode pre-compilation and JSI to minimize the overhead of cross-language boundary crossing.
- **System Boundary:** The critical path is the **Shadow Tree**, where layout calculations (Yoga) and state updates must remain consistent across three distinct memory spaces: JS (Hermes), C++ (Fabric), and Native (Java/Obj-C).

## 2. Deep Micro-Learnings & Runtime Gotchas
1. **JNI Mapping Mismatch:**
   - **Pitfall:** Incorrect JNI method registration (e.g., mapping `disable` to `enable`).
   - **Root Cause:** Manual JNI boilerplate is error-prone; lack of compile-time validation between Java method signatures and C++ implementations.
   - **Fix:** Use automated JNI binding generators (e.g., `fbjni`) to enforce signature parity.

2. **View Flattening Side-Effects:**
   - **Pitfall:** Incorrectly flattening views with specific `rgba` backgrounds.
   - **Root Cause:** The renderer optimization logic assumes that views without children or specific properties can be merged, but it fails to account for alpha-blending math in the compositor.
   - **Fix:** Implement a "Flattening Exclusion List" for nodes with non-opaque background colors or specific blending modes.

3. **Nondeterministic `requestAnimationFrame` (rAF):**
   - **Pitfall:** Callbacks executing in non-web-compliant order.
   - **Root Cause:** The event loop implementation in the C++ scheduler does not strictly enforce the queue order during high-load frame drops.
   - **Fix:** Use a strictly ordered `std::deque` for rAF callbacks and ensure the scheduler drains the queue before the next frame commit.

4. **Node Path/Space Sensitivity in Build Scripts:**
   - **Pitfall:** Xcode build failures when `$NODE_BINARY` contains spaces.
   - **Root Cause:** Shell script interpolation failing to quote variables in build phases.
   - **Fix:** Always wrap environment variables in double quotes (`"$NODE_BINARY"`) in all `.sh` build scripts.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
- **D1: Structural Boundaries:** Heavy reliance on C++ "Umbrella Includes" to reduce header bloat and compilation times.
- **D2: Asynchronous State:** The transition from "queued work" to "active callbacks" in the scheduler is critical to prevent race conditions during layout updates.
- **D3: Error Boundaries:** RN struggles with Web-spec compliance for `setTimeout` error handling; native-side exceptions often crash the bridge rather than bubbling to JS.
- **D4: Resource Lifecycle:** Memory leaks in `Animated` string interpolation occur when temporary objects are allocated per-frame. **Fix:** Use object pooling for frequently mutated strings.
- **D5: Deserialization:** JNI calls are expensive. **Fix:** Batch multiple UI operations into a single JNI call (e.g., `executeMount`) to reduce context switching.
- **D6: Cross-Platform:** RTL (Right-to-Left) layout clipping on Android 15+ highlights the fragility of native text rendering APIs when bridged.
- **D7: Build Invariants:** CocoaPods resource bundles require strict deployment target alignment; mismatch causes silent runtime asset loading failures.
- **D8: Forensic Patches:** Recent fixes emphasize "Avoid allocations" in hot paths—a clear indicator that the C++ layer is hitting GC/Memory pressure limits.

## 4. Net-New Universal Engineering Rules

## 72. The JNI-Boundary Parity Rule

**RULE**:
Every JNI method signature must be defined in a single source-of-truth header file, and the C++ implementation must use a static assertion or a generated registration table to verify the signature against the Java class definition at compile time.

**WHY**:
Manual string-based JNI mapping (e.g., `env->GetMethodID(clazz, "methodName", "()V")`) is a silent failure vector. Typo-induced mismatches lead to `NoSuchMethodError` at runtime, which is notoriously difficult to debug in cross-language stacks.

**WHEN TO APPLY**:
Any system utilizing JNI, C++/CLI, or FFI (Foreign Function Interface) between managed and unmanaged memory.

---

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **JNI Verification:** Scan all `native` method declarations in Java/Kotlin and cross-reference with C++ `JNINativeMethod` arrays.
- [ ] **Path Sanitization:** Audit all build scripts (`.sh`, `.gradle`, `.podspec`) for unquoted variables that could contain spaces.
- [ ] **Allocation Profiling:** In C++ hot paths, replace `std::string` or `std::vector` allocations with pre-allocated buffers or `std::string_view`.
- [ ] **Layout Consistency:** When implementing custom renderers, verify that `display: contents` nodes do not trigger stale layout cache hits.
- [ ] **Event Loop Audit:** Ensure that all asynchronous callbacks (rAF, timers) are processed via a single, ordered queue to guarantee deterministic execution.