> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/adobe-react-spectrum-learnings.md`  
> **Source**: GitHub ([https://github.com/adobe/react-spectrum](https://github.com/adobe/react-spectrum))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T18:56:13.500Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: adobe/react-spectrum

## 1. Executive Forensic Architecture & System Mechanics
`react-spectrum` (and its core, `react-aria`) is a **headless-first UI primitive library** designed to solve the "Accessibility-Interaction Gap." It decouples UI logic (state management, keyboard navigation, screen reader semantics) from visual presentation. 

**Architectural Boundaries:**
*   **`react-stately`**: Pure state machines (hooks) managing component logic (e.g., selection, collection, focus).
*   **`react-aria`**: DOM-binding layer translating state into WAI-ARIA attributes and event listeners.
*   **`react-spectrum`**: The visual implementation layer (the "skin").

The system relies on **Collection-based architecture**, where components treat children as data structures rather than DOM nodes, allowing for virtualization and complex keyboard navigation (e.g., grid/tree traversal).

---

## 2. Deep Micro-Learnings & Runtime Gotchas

1.  **Shadow DOM Event Retargeting**:
    *   **Failure**: `RangeCalendar` inside Shadow DOM commits ranges incorrectly because `e.target` is retargeted to the host, breaking internal coordinate calculations.
    *   **Fix**: Use `e.composedPath()` to identify the actual origin of the event within the shadow root.
2.  **The "Ghost" `data-pressed` State**:
    *   **Failure**: `NumberField` buttons retain `data-pressed` when disabled during an active press.
    *   **Fix**: Always implement a `useEffect` or cleanup function that explicitly clears interaction states (pressed, hovered) when the component's `disabled` prop transitions to `true`.
3.  **Collection Hydration Mismatch**:
    *   **Failure**: Components lose items when re-rendered after being hidden (e.g., React 19 `<Activity>` or `display: none`).
    *   **Fix**: Ensure collection snapshots are persisted across hydration boundaries; do not rely on local component state for collection items if the parent can unmount/remount the subtree.
4.  **Firefox macOS Pointer Event False Positives**:
    *   **Failure**: `isVirtualPointerEvent` logic fails on Firefox/macOS due to inconsistent `pointerType` reporting during tap-to-click.
    *   **Fix**: Implement a fallback check using `event.width` and `event.height` (which are typically 0 or 1 for mouse/trackpad, but larger for touch) to disambiguate input sources.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

*   **D1: Structural Boundaries**: Strict separation between `stately` (logic) and `aria` (DOM). Never leak DOM-specific logic into `stately` hooks.
*   **D2: Async Concurrency**: Async item loading in `ComboBox` requires re-triggering menu state transitions. The system must treat "Async Data Arrival" as a first-class state transition.
*   **D3: Error Boundaries**: The repo uses "throw on invalid input" (e.g., invalid RGB strings) as a design choice to enforce strict schema adherence at the boundary.
*   **D4: Resource Lifecycle**: Focus restoration loops are a critical failure point. When a child is removed, the parent must manage focus fallback to avoid "focus loss" or "infinite focus loops."
*   **D5: Deserialization**: `filterDOMProps` is the primary defense against prop-pollution. Every component must pass props through a filter to prevent internal state attributes from leaking to the DOM.
*   **D6: Cross-Platform**: Browser-specific quirks (Firefox/VoiceOver) are handled via a centralized `isVirtualPointerEvent` utility.
*   **D7: Dependency Invariants**: Heavy reliance on `react-aria` primitives. Upgrading React versions requires deep testing of `useControlledState` effects.
*   **D8: Forensic Patches**: Recent patches emphasize "Hydration Stability"—ensuring that server-rendered HTML matches client-side state exactly to prevent layout shifts.

---

## 4. Net-New Universal Engineering Rules

## 72. The "Shadow-Aware Event" Rule

**RULE**:
All event handlers in UI components must resolve the event target via `event.composedPath()` rather than `event.target` if the component is intended to support Shadow DOM encapsulation.

**WHY**:
`event.target` is retargeted to the shadow host, causing logic that relies on DOM hierarchy (like `contains()` or coordinate mapping) to fail silently or behave unpredictably.

**WHEN TO APPLY**:
Any library or component system that interacts with DOM nodes, specifically those involving drag-and-drop, focus management, or coordinate-based interactions.

---

## 5. Actionable Agent Skill & Implementation Checklist

- [ ] **Prop Filtering**: Verify that every component has a `filterDOMProps` call to prevent internal state (e.g., `isPressed`, `isFocused`) from leaking to the DOM.
- [ ] **Focus Restoration**: Ensure that when a component unmounts, focus is programmatically moved to a valid parent or container to prevent focus from resetting to `document.body`.
- [ ] **Hydration Check**: Ensure `suppressHydrationWarning` is used only for dynamic values (like timestamps) and never for structural DOM attributes.
- [ ] **State Cleanup**: Verify that all `data-*` attributes (pressed, hover, focus) are explicitly removed in a `useEffect` cleanup block when the component is disabled.
- [ ] **Shadow DOM Safety**: Audit all `e.target` usages; replace with `e.composedPath()[0]` for cross-root compatibility.