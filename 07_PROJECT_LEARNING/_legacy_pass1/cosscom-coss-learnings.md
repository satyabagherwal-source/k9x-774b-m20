> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/cosscom-coss-learnings.md`  
> **Source**: GitHub ([https://github.com/cosscom/coss](https://github.com/cosscom/coss))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T20:21:01.177Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: cosscom/coss

## 1. Executive Forensic Architecture & System Mechanics
`coss` is a high-fidelity UI component library built on the **Base UI / Radix UI** primitive stack. Its architecture is defined by "Particle-based Composition," where complex UI elements (Drawers, Toasts, Input Groups) are decomposed into atomic, style-agnostic primitives. The system relies heavily on **CSS-in-JS/Tailwind hybrid orchestration** and **Portal-based rendering**. The core architectural challenge is managing the **Z-index stack and event propagation** across disparate DOM trees (portals) while maintaining strict visual consistency in a Next.js/React ecosystem.

## 2. Deep Micro-Learnings & Runtime Gotchas
*   **Failure Mode: Z-Index Collision in Portals**
    *   **Root Cause:** Toasts and Drawers rendered via portals escape the parent's stacking context, causing "later-opened" elements to be obscured by "earlier-opened" persistent elements.
    *   **Fix:** Implement a global Z-index registry or strict CSS variable-based layering (`--layer-toast`, `--layer-popover`) to ensure deterministic stacking regardless of DOM injection order.
*   **Failure Mode: Event Bubbling from Portaled Descendants**
    *   **Root Cause:** Input groups containing portaled elements (e.g., tooltips or custom dropdowns) trigger parent event listeners incorrectly because the portal is outside the parent's DOM hierarchy.
    *   **Fix:** Use `event.stopPropagation()` or check `event.target` against the component's internal ref before triggering parent-level input group logic.
*   **Failure Mode: CSS Unitless Property Regression**
    *   **Root Cause:** Passing unitless numbers to CSS variables (e.g., `--inset: 0`) in components that expect pixel/rem values causes layout engine failure in specific browsers.
    *   **Fix:** Enforce strict type-checking for CSS variable injection; always append units (`px`, `rem`) at the style-binding layer.
*   **Failure Mode: Focus Ring Animation Stalling**
    *   **Root Cause:** Typo/mismatch in `transition-shadows` property names prevents the browser from interpolating the focus ring state.
    *   **Fix:** Use CSS variable-based transition definitions to centralize animation logic and prevent string-literal typos.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
*   **D1: Structural Boundaries**: Uses "Particles" as the smallest unit of composition. Logic is decoupled from styling via Tailwind.
*   **D2: Asynchronous State**: Relies on TanStack Table v9 for data-grid state management, emphasizing controlled vs. uncontrolled component patterns.
*   **D3: Error Boundaries**: Minimal; relies on React's native error boundaries.
*   **D4: Resource Lifecycle**: Heavy use of Portals requires explicit cleanup of DOM nodes to prevent memory leaks in long-lived SPAs.
*   **D5: Input Sanitization**: Focuses on CSS-level sanitization (autofill colors in iframes) rather than data-level.
*   **D6: Runtime Compatibility**: High sensitivity to iframe-based rendering (autofill color overrides).
*   **D7: Dependency Invariants**: Strict versioning of Base UI (1.8.0) is critical; breaking changes in primitives propagate instantly to all "particles."
*   **D8: Forensic Patches**: Fixes prioritize visual hierarchy (Z-index) and layout integrity (overflow handling).

## 4. Net-New Universal Engineering Rules

## 72. The Portal Stacking Invariant

**RULE**:
Any component utilizing `ReactDOM.createPortal` must define its Z-index via a centralized CSS variable registry, never via hardcoded integers or local style overrides.

**WHY**:
Portals break the natural DOM stacking context. Without a global registry, Z-index becomes a "race condition" where the last component rendered wins, leading to unpredictable UI overlaps in complex dashboards.

**WHEN TO APPLY**:
All UI libraries, modal/toast systems, and overlay-heavy React applications.

## 73. The Unit-Safety Constraint

**RULE**:
All CSS variables representing physical dimensions (inset, margin, padding) must be validated for unit presence (`px`, `rem`, `em`) at the component boundary before injection into the `style` attribute.

**WHY**:
Modern browsers treat unitless values as invalid for specific layout properties (like `inset`), causing silent layout failures that are notoriously difficult to debug in production.

**WHEN TO APPLY**:
Dynamic style-binding systems and component libraries using CSS-in-JS or Tailwind-variable injection.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Z-Index Audit**: Verify that all overlay components (Toasts, Drawers, Modals) reference a shared `z-index` variable map.
- [ ] **Portal Event Check**: Ensure all `onClick` or `onFocus` handlers in portaled components verify the event origin to prevent parent-container interference.
- [ ] **CSS Variable Validation**: Implement a utility function `toCssUnit(value: number | string)` to ensure all style-injected numbers are cast to valid CSS strings.
- [ ] **Iframe Resilience**: Test all form inputs for `:-webkit-autofill` overrides to ensure consistent branding within embedded contexts.
- [ ] **Dependency Sync**: When upgrading Base UI or Radix, run a regression test specifically on "Particle" components that rely on internal primitive hooks.