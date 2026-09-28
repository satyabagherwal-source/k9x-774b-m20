> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tusen-ai-naive-ui-learnings.md`  
> **Source**: GitHub ([https://github.com/tusen-ai/naive-ui](https://github.com/tusen-ai/naive-ui))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T18:55:19.747Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: tusen-ai/naive-ui

## 1. Executive Forensic Architecture & System Mechanics
`naive-ui` is a high-performance Vue 3 component library built on a **Config-Provider-driven architecture**. It relies heavily on `provide/inject` for global theme and locale propagation. The system architecture is defined by:
*   **Decoupled Theming**: CSS variables are injected via a `NConfigProvider`, which acts as the root dependency injection container.
*   **Functional Preset Pattern**: Complex components (Modal, Dialog, Notification) utilize a functional API that dynamically mounts components to the DOM, creating a secondary lifecycle outside the standard template hierarchy.
*   **Reactive State Synchronization**: Heavy reliance on `ref` and `computed` for prop-to-DOM mapping, with specific focus on handling `keep-alive` cache states.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

1.  **The "Double-Handler" Injection Trap**:
    *   **Failure**: Event handlers (e.g., `positive-click`) were being registered multiple times in functional presets.
    *   **Root Cause**: Improper merging of user-provided props with internal default handlers during the functional component mount phase.
    *   **Fix**: Implement a strict `once` registration pattern or a handler-deduplication wrapper before passing props to the internal component instance.

2.  **The `keep-alive` Reactivation Race**:
    *   **Failure**: Components (e.g., `data-table`) throw errors when reactivated inside `keep-alive`.
    *   **Root Cause**: Lifecycle hooks (`onMounted`) execute, but internal DOM references or reactive state are stale or partially unmounted.
    *   **Fix**: Use `onActivated` to re-validate DOM state and reset scroll/positional offsets explicitly.

3.  **Optional Event Handler Null-Pointer**:
    *   **Failure**: `TypeError: handler is not a function` when an optional event prop is undefined.
    *   **Root Cause**: Direct invocation of props without checking for existence or providing a no-op default.
    *   **Fix**: Always use `props.handler?.()` or `(props.handler || (() => {}))()`.

4.  **IME Composition Interference**:
    *   **Failure**: `input-number` triggers `Enter` key logic while the user is still typing in a non-Latin language (IME).
    *   **Root Cause**: Keydown events are captured before the composition session ends.
    *   **Fix**: Guard keydown handlers with a `isComposing` flag (via `compositionstart`/`compositionend` events).

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

*   **D1: Structural Boundaries**: The library suffers from "Prop-Drilling" via `provide/inject`. When the root `NConfigProvider` is missing, components fail silently or throw injection errors.
*   **D2: Asynchronous State**: Functional components (Dialog/Modal) create "detached" lifecycles. State must be explicitly cleaned up to avoid memory leaks.
*   **D3: Error Boundaries**: The library lacks a global error boundary for user-provided callbacks, leading to unhandled exceptions in the event loop.
*   **D4: Resource Lifecycle**: Drag-and-drop features in Modals were leaking event listeners. **Rule**: Always pair `addEventListener` with `onBeforeUnmount` cleanup.
*   **D5: Deserialization**: The library struggles with `VNode` type validation in slots.
*   **D6: Compatibility**: Reliance on `Katex` and other heavy deps requires optional peer-dependency handling to prevent runtime crashes in minimal environments.
*   **D7: Build Invariants**: `d.ts` files are often leaked into production builds, increasing bundle size and causing type-resolution conflicts.
*   **D8: Forensic Patches**: Recent fixes emphasize "Defensive Prop Forwarding"—ensuring that props passed to presets are sanitized before being spread onto child components.

---

## 4. Net-New Universal Engineering Rules

## 72. The "Functional Preset" Lifecycle Invariant

**RULE**:
Any component mounted via a functional API (imperative mount) MUST implement a `cleanup` function that explicitly nullifies all DOM references and removes global event listeners (window/document) upon component destruction.

**WHY**:
Imperative mounts bypass the standard Vue component tree lifecycle, meaning standard garbage collection may fail to reclaim listeners attached to the `document` or `body` during `Modal` or `Dialog` operations.

**WHEN TO APPLY**:
Any library implementing imperative UI patterns (Modals, Toasts, Dialogs, Tooltips).

---

## 5. Actionable Agent Skill & Implementation Checklist

- [ ] **Prop Sanitization**: Before spreading props to a child component, filter out `undefined` or `null` event handlers.
- [ ] **Composition Guard**: Ensure all `keydown` handlers for input components check `event.isComposing`.
- [ ] **Injection Safety**: Always provide a default value for `inject()` calls to prevent "Injection not found" warnings.
- [ ] **Lifecycle Audit**: Verify that every `addEventListener` on `window` or `document` has a corresponding `removeEventListener` in `onBeforeUnmount`.
- [ ] **Type-Only Exports**: Ensure `package.json` `exports` map strictly separates types from runtime code to prevent `d.ts` leakage.