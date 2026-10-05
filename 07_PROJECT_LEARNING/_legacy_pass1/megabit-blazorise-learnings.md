> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/megabit-blazorise-learnings.md`  
> **Source**: GitHub ([https://github.com/Megabit/Blazorise](https://github.com/Megabit/Blazorise))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T16:23:46.785Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: Megabit/Blazorise

## 1. Executive Forensic Architecture & System Mechanics
Blazorise is a **Provider-Agnostic Component Abstraction Layer** for Blazor. It decouples UI component logic (C#) from CSS framework implementations (Bootstrap, Tailwind, Bulma, AntDesign, Material). 
- **Core Abstraction**: Uses a "Provider" pattern where the component library defines the contract (e.g., `BaseNumericPicker`), and specific providers implement the rendering logic.
- **System Mechanics**: Relies heavily on `IJSRuntime` for DOM manipulation, necessitating a bridge between Blazor’s component lifecycle and the underlying JS framework’s state.
- **Critical Boundary**: The "Interop Bridge"—the synchronization point between C# state and JS DOM state—is the primary source of race conditions and state desynchronization.

## 2. Deep Micro-Learnings & Runtime Gotchas
1. **Browser Autofill Desync**:
   - **Pitfall**: `NumericPicker` values updated via browser autofill bypass Blazor’s `oninput` events.
   - **Root Cause**: Native browser events do not trigger Blazor's `ChangeEventArgs` consistently.
   - **Fix**: Implement a `MutationObserver` in JS to detect value changes on the input element and manually trigger a C# callback.
2. **Race Conditions in Reordering (DropZone)**:
   - **Pitfall**: Rapid reordering triggers multiple JS interop calls before the previous one completes.
   - **Root Cause**: Lack of a request queue or "busy" flag in the JS interop layer.
   - **Fix**: Implement a `TaskCompletionSource` or a sequential promise chain in JS to ensure operations are processed in order.
3. **DataGrid ScrollToRow Visibility**:
   - **Pitfall**: `ScrollToRow` fails if the target element is not yet rendered or is inside a collapsed container.
   - **Root Cause**: DOM element existence does not guarantee layout visibility (height > 0).
   - **Fix**: Use `requestAnimationFrame` to wait for the next paint cycle after DOM injection before executing the scroll command.
4. **Initialization Update Loss (Charts)**:
   - **Pitfall**: Updates sent to a chart component during its JS initialization phase are dropped.
   - **Root Cause**: Asynchronous JS initialization is not awaited by the C# component lifecycle.
   - **Fix**: Implement an `InitializationQueue` in the component that buffers updates until the `OnAfterRenderAsync` confirms the JS object is ready.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
- **D1: Structural Boundaries**: High abstraction via `ComponentBase` inheritance. Logic is separated into `Base` classes, while rendering is delegated to `RenderFragment` providers.
- **D2: Asynchronous State**: Heavy reliance on `Task` chains. The primary risk is "Fire-and-Forget" JS calls that lack error handling or completion tracking.
- **D3: Error Boundaries**: Lacks granular `ErrorBoundary` implementation for individual components, leading to full-page crashes on JS interop failures.
- **D4: Resource Lifecycle**: JS object references (e.g., Chart instances) are often leaked if `Dispose` is not explicitly called to nullify JS references.
- **D5: Deserialization**: Input sanitization is delegated to the underlying CSS framework, creating a potential vulnerability if the framework doesn't handle XSS in custom attributes.
- **D6: Cross-Platform**: The "Provider" pattern is the only thing keeping this cross-platform; however, JS interop behavior varies significantly between Blazor Server (SignalR latency) and Blazor WASM (Direct memory).
- **D7: Build/CI**: High dependency on `IJSRuntime` makes unit testing difficult without a headless browser (Playwright/Puppeteer).
- **D8: Forensic Patches**: Recent patches focus on "Rapid Editing" (debouncing) and "Autofill" (event interception), indicating a shift toward hardening against non-deterministic user input.

## 4. Net-New Universal Engineering Rules

## 72. The Interop-State Synchronization Invariant

**RULE**:
Any C# component that wraps a JS-based UI library must implement a "Pending-Update-Queue" and a "Ready-State-Flag" to buffer state changes during the asynchronous JS initialization window.

**WHY**:
JS initialization is non-blocking in Blazor. If a component receives a state update (e.g., `Value` change) before the JS library has finished mounting, the update is lost, leading to a permanent desync between the C# model and the DOM.

**WHEN TO APPLY**:
Any Blazor, React, or Vue component wrapping third-party JS libraries (Charts, Editors, DataGrids).

---

## 73. The DOM-Visibility-Before-Action Constraint

**RULE**:
Never execute DOM-manipulation commands (Scroll, Focus, Measure) immediately upon component render; always wrap in `requestAnimationFrame` or a `MutationObserver` callback.

**WHY**:
Blazor's `OnAfterRender` triggers when the DOM is updated, but not necessarily when the layout is calculated. Attempting to scroll to an element that has 0px height (due to CSS transitions or parent containers) will fail silently.

**WHEN TO APPLY**:
UI components involving scrolling, focus management, or dynamic layout calculations.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Audit Interop**: Scan all `IJSRuntime.InvokeVoidAsync` calls. Are they wrapped in a `try-catch`? Are they awaited?
- [ ] **Lifecycle Check**: Verify `IDisposable` implementation. Does it explicitly call `JS.InvokeVoidAsync("destroy")` on the JS object?
- [ ] **Race Condition Test**: Simulate rapid input (e.g., 10ms intervals) on all input components to check for state consistency.
- [ ] **Autofill Verification**: Test all `Input` components with browser-native autofill to ensure the C# `Value` property updates.
- [ ] **Queue Implementation**: If the component is stateful (Charts/Editors), ensure an `IsInitialized` boolean prevents premature updates.