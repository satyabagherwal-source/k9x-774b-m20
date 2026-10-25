> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/chakra-ui-zag-learnings.md`  
> **Source**: github ([https://github.com/chakra-ui/zag](https://github.com/chakra-ui/zag))  
> **Source Version**: `86add962`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T02:26:47.224Z  
> **Learning ID**: `learn-github-chakra-ui-zag`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): chakra-ui/zag

---

## 1. Executive Forensic Architecture & System Mechanics

`chakra-ui/zag` solves the fundamental impedance mismatch between reactive UI frameworks (React, Vue, Solid, Svelte, Preact) and complex, accessible WAI-ARIA interactive behavior. In standard frontend component design, state transitions, DOM event sequences, keyboard navigation models, and focus trapping are re-implemented per framework, resulting in fragmented edge-case resolution, divergent accessibility compliance, and brittle event handling.

```
+---------------------------------------------------------------------------------------+
|                                Framework Adapters                                     |
|   @zag-js/react   |   @zag-js/vue   |   @zag-js/solid   |   @zag-js/svelte   | ...    |
+---------------------------------------------------------------------------------------+
                                           |
                       Props Normalization Layer (normalizeProps)
                                           |
+------------------------------------------v--------------------------------------------+
|                          Machine Connection API (connect)                             |
|          Translates Raw Machine State & Actions to Standard DOM Attributes            |
|                (data-*, aria-*, id, role, tabIndex, onKeyDown, etc.)                  |
+------------------------------------------+--------------------------------------------+
                                           |
+------------------------------------------v--------------------------------------------+
|                      Zag Core State Machine Layer (@zag-js/core)                       |
|   - Pure Finite State Machines & Statecharts (Guards, Context, Actions, Activities)   |
|   - Single Source of Truth for Component Behavior (Transitions, Delays, Timers)       |
+------------------------------------------+--------------------------------------------+
                                           |
+------------------------------------------v--------------------------------------------+
|                             DOM / Browser Environment Scope                           |
|       @zag-js/dom-query  |  @zag-js/dismissable  |  @zag-js/focus-trap  |  ...        |
|   - Shadow DOM Boundaries  - Multi-window / iframe / Environment Querying            |
|   - Cross-browser RTL Scroll Normalization  - Outside Pointer/Focus Interception       |
+---------------------------------------------------------------------------------------+
```

### Architectural Subsystem Decoupling & Invariants

1. **Pure Behavioral Core (`@zag-js/core` & `@zag-js/machines/*`)**:
   Every component behavior is modeled as an extended finite state machine. A machine defines an immutable context schema, event contracts, transition matrices, actions, and guards. The machine runtime contains zero direct assumptions about framework reactivity systems (e.g., neither React hooks, Solid signals, Vue refs, nor Svelte stores exist inside `@zag-js/core`).

2. **The Connection / DOM Projection Contract (`connect(service, normalizeProps)`)**:
   The output of a running state machine is consumed via a domain-specific `connect` function. This function returns an API surface consisting of component parts (`getRootProps`, `getTriggerProps`, `getContentProps`, `getItemProps`). Crucially, `normalizeProps` acts as a framework-agnostic translation matrix: transforming uniform event handlers and attribute dictionaries into React-compatible camelCase (`aria-expanded`, `onClick`), Vue-compatible bindings (`v-on` structures), or Solid/Svelte-native attributes.

3. **DOM Query & Environment Isolation Scope (`Scope`)**:
   All DOM accesses avoid hardcoded global singletons (`window`, `document`). Every machine executes within a `Scope` derived from an anchor element or configured root node. This prevents failures across multiple nested browsing contexts, iframes, and Shadow DOM boundaries.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Conditional Return-Focus Suppression via Focus-Movement Verification
**RULE**:
When an overlay, popover, or dropdown menu closes, the dismissal handler MUST NOT unconditionally restore focus to the trigger element without first querying whether the user's programmatic action or intentional navigation has already moved focus to another valid focusable target outside the dismissed container. If focus has moved outside the dismissing surface to a distinct active element, focus restoration MUST be suppressed.

**WHY**:
Unconditional focus restoration causes disruptive focus thrashing. When a selection in an overlay triggers an asynchronous or synchronous navigation/focus change (e.g., selecting a color swatch or date automatically jumps focus to the "Next Step" form input via an `onValueChange` hook), an overlay that runs `triggerEl.focus()` on teardown pulls focus backward out of the user's intended target, breaking keyboard workflows and triggering double focus-in events.

**WHEN TO APPLY**:
Apply to all interactive overlays, modals, drawers, date-pickers, comboboxes, and contextual menus whenever an item selection, external tap, or keyboard interaction can simultaneously trigger downstream focus advancement and overlay dismissal.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified pattern from packages/machines/color-picker/src/color-picker.machine.ts
// and packages/machines/cascade-select/src/cascade-select.machine.ts

import { isFocusOutside } from "@zag-js/dom-query"
import { raf } from "@zag-js/dom-query"

interface FocusScopeContext {
  getActiveElement: () => HTMLElement | null
  getTriggerEl: () => HTMLElement | null
  getContentEl: () => HTMLElement | null
}

interface ReturnFocusEvent {
  restoreFocus?: boolean
  focusVisible?: boolean
  previousEvent?: {
    restoreFocus?: boolean
    focusVisible?: boolean
  }
}

function getReturnFocusOptions(event: ReturnFocusEvent): FocusOptions {
  const focusVisible = event.focusVisible ?? event.previousEvent?.focusVisible
  // Honor browser keyboard focus ring requirements while preventing scrolling
  return focusVisible ? { preventScroll: true, focusVisible: true } : { preventScroll: true }
}

function setReturnFocus(scope: FocusScopeContext, event: ReturnFocusEvent): void {
  const contentEl = scope.getContentEl()
  const focusOptions = getReturnFocusOptions(event)

  raf(() => {
    const activeEl = scope.getActiveElement()
    
    // CRITICAL GUARD: Check if focus has already migrated elsewhere
    // If activeElement is non-null, outside contentEl, AND not the document body/root,
    // user code or keyboard tabbing has intentionally placed focus elsewhere.
    if (contentEl && isFocusOutside(activeEl, [contentEl])) {
      return
    }

    const triggerEl = scope.getTriggerEl()
    triggerEl?.focus(focusOptions)
  })
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Naive unconditional restoration causing focus stealing
function badTeardown(triggerElement: HTMLElement | null): void {
  // FAILS: Steals focus back even if onValueChange moved focus to a form input
  requestAnimationFrame(() => {
    triggerElement?.focus()
  })
}
```

**VERIFICATION METHOD**:
Run an automated Playwright E2E spec verifying that when an overlay action updates a value and focuses an external element, focus remains intact:
```typescript
test("should keep focus where onValueChange moved it", async ({ page }) => {
  await page.locator("[data-part=trigger]").click()
  await page.locator("[data-part=item]").first().click()
  // Wait two animation frames to ensure machine deferred callbacks have fired
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))))
  await expect(page.locator("[data-testid=next-field]")).toBeFocused()
})
```

---

### 2. Relative Rank-Ordered Insertion for Batched Asynchronous DOM Measurements
**RULE**:
When child instances register their layout measurements (e.g., dynamic heights, widths, bounding boxes) with a centralized orchestrator/context, and where multiple components can mount or resize within the same execution flush (e.g., reactive batched microtasks in Vue, Svelte, or React 18+), the orchestrator MUST NOT append or prepend incoming measurements blindly. It MUST compute the insertion index dynamically by sorting against the canonical ordered array of unique instance identifiers.

**WHY**:
In modern UI frameworks with asynchronous flush pipelines (such as Vue's `queueJob` or React's concurrent scheduler), DOM nodes mount and execute layout effects (`requestAnimationFrame`, `ResizeObserver`, or `useLayoutEffect`) in non-deterministic, implementation-dependent orders. Prepending (`[{ id, height }, ...prev]`) or pushing to the end causes items mounted in the same render batch to invert or scramble their relative stacking offsets, leading to visually inverted accordion, toast, or cascade stacks.

**WHEN TO APPLY**:
Apply to all stacking managers, absolute-positioned virtual lists, notification containers, nested drawer coordinators, and dynamic accordion layout registries where visual layout or transform coordinates rely on preceding sibling dimensions.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified pattern from packages/machines/toast/src/toast.utils.ts

interface MeasuredItem {
  id: string
  height: number
}

interface StackingContext {
  get: (key: "items") => Array<{ id: string }>
  set: (key: "heights", updater: (prev: MeasuredItem[]) => MeasuredItem[]) => void
}

export function registerMeasuredDimension(
  context: StackingContext,
  incoming: MeasuredItem
): void {
  const { id, height } = incoming

  context.set("heights", (prevHeights: MeasuredItem[]) => {
    const existing = prevHeights.find((item) => item.id === id)
    
    // Idempotency guard: Prevent spurious re-renders if dimension did not change
    if (existing) {
      if (existing.height === height) return prevHeights
      return prevHeights.map((item) => (item.id === id ? { ...item, height } : item))
    }

    // Rank-based deterministic insertion matching canonical context array order
    const canonicalOrder = context.get("items")
    const getRank = (targetId: string): number => canonicalOrder.findIndex((t) => t.id === targetId)
    const incomingIndex = getRank(id)

    // Locate the first item in prev whose canonical rank exceeds the incoming index
    let insertAt = prevHeights.findIndex((item) => {
      const r = getRank(item.id)
      return r === -1 || r > incomingIndex
    })

    if (insertAt === -1) {
      insertAt = prevHeights.length
    }

    return [
      ...prevHeights.slice(0, insertAt),
      { id, height },
      ...prevHeights.slice(insertAt)
    ]
  })
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Naive prepending/appending assumes DOM execution order mirrors document order
function badRegisterDimension(state: MeasuredItem[], incoming: MeasuredItem): MeasuredItem[] {
  // FAILS: Under batching (e.g. Vue), child #2 may measure before child #1,
  // causing the visual layout array to be inverted: [#1, #2] becomes [#2, #1]
  const exists = state.find((i) => i.id === incoming.id)
  if (exists) return state.map((i) => (i.id === incoming.id ? incoming : i))
  return [incoming, ...state]
}
```

**VERIFICATION METHOD**:
Unit-test with arbitrary permutation inputs against a known canonical order:
```typescript
test("guarantees height order regardless of mount/measurement arrival order", () => {
  const canonical = [{ id: "toast-1" }, { id: "toast-2" }, { id: "toast-3" }]
  let heights: MeasuredItem[] = []
  const mockContext = {
    get: () => canonical,
    set: (_: string, fn: any) => { heights = fn(heights) }
  }

  // Simulate out-of-order execution flush: toast-2 mounts before toast-1
  registerMeasuredDimension(mockContext, { id: "toast-2", height: 80 })
  registerMeasuredDimension(mockContext, { id: "toast-1", height: 60 })
  registerMeasuredDimension(mockContext, { id: "toast-3", height: 100 })

  expect(heights.map((h) => h.id)).toEqual(["toast-1", "toast-2", "toast-3"])
})
```

---

### 3. Cross-Browser RTL Scroll Coordinate System Normalization
**RULE**:
Any scroll computation logic measuring or assigning `scrollLeft` on elements inside a Right-To-Left (`dir="rtl"`) container MUST query and normalize against the host browser engine's specific RTL scroll offset implementation type (`negative`, `positive-descending`, or `positive-ascending`) before performing side-reached, boundary clamping, or thumb tracking math.

**WHY**:
The CSSOM View Module specification for `scrollLeft` in RTL containers historically diverged across layout engines:
- **WebKit/Blink (Standard Chromium/Safari)**: Origin is at 0 (far right); scrolling left produces negative numbers down to `-(scrollWidth - clientWidth)`.
- **Legacy Gecko / Firefox**: Origin is at `(scrollWidth - clientWidth)` (far right) and decreases toward 0 as you scroll left (`positive-descending`).
- **IE/Legacy Trident**: Origin is at 0 (far left) and increases toward `(scrollWidth - clientWidth)` as you scroll right (`positive-ascending`).
Directly reading `node.scrollLeft <= offset` without normalization results in broken edge detection, non-responsive horizontal scrollbars, or stuck carousel items in RTL languages.

**WHEN TO APPLY**:
Apply to all virtual scroll areas, custom sliders, carousels, tabs headers, splitters, and data grids that support bi-directional (`dir="rtl"`) layouts.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified pattern from examples/next-ts/hooks/use-scroll-area.ts

export type RTLOffsetType = "negative" | "positive-descending" | "positive-ascending"

let cachedRTLResult: RTLOffsetType | null = null

export function getRTLOffsetType(doc: Document, recalculate: boolean = false): RTLOffsetType {
  if (cachedRTLResult !== null && !recalculate) {
    return cachedRTLResult
  }

  const outerDiv = doc.createElement("div")
  const outerStyle = outerDiv.style
  outerStyle.width = "50px"
  outerStyle.height = "50px"
  outerStyle.overflow = "scroll"
  outerStyle.direction = "rtl"
  outerStyle.position = "absolute"
  outerStyle.top = "-9999px"

  const innerDiv = doc.createElement("div")
  const innerStyle = innerDiv.style
  innerStyle.width = "100px"
  innerStyle.height = "100px"

  outerDiv.appendChild(innerDiv)
  doc.body.appendChild(outerDiv)

  if (outerDiv.scrollLeft > 0) {
    cachedRTLResult = "positive-descending"
  } else {
    outerDiv.scrollLeft = 1
    if (outerDiv.scrollLeft === 0) {
      cachedRTLResult = "negative"
    } else {
      cachedRTLResult = "positive-ascending"
    }
  }

  doc.body.removeChild(outerDiv)
  return cachedRTLResult
}

export function getNormalizedScrollLeft(node: HTMLElement, direction: "ltr" | "rtl"): number {
  let { scrollLeft } = node
  if (direction === "rtl") {
    const { scrollWidth, clientWidth } = node
    switch (getRTLOffsetType(node.ownerDocument)) {
      case "negative":
        scrollLeft = -scrollLeft
        break
      case "positive-descending":
        scrollLeft = scrollWidth - clientWidth - scrollLeft
        break
      case "positive-ascending":
        // Already zero-based ascending from left edge
        break
    }
  }
  return scrollLeft
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Direct comparison assuming universal LTR or WebKit negative math
function isAtLeftEdge(node: HTMLElement, dir: "ltr" | "rtl", threshold: number): boolean {
  // CRITICAL FAILURE in Firefox: scrollLeft will be scrollWidth - clientWidth at the right,
  // and 0 at the left, while Chrome will be 0 at the right and negative at the left.
  return node.scrollLeft <= threshold
}
```

**VERIFICATION METHOD**:
Validate through automated unit/headless tests inspecting synthetic elements with overridden `scrollLeft` behaviors or testing in headless Firefox and Chromium across RTL pages:
```typescript
test("detects left edge identically in LTR and RTL", async ({ page }) => {
  await page.setContent(`<div dir="rtl" id="scroll" style="width:100px;overflow:auto;"><div style="width:300px;height:10px;"></div></div>`)
  const isLeft = await page.evaluate(() => {
    const el = document.getElementById("scroll")!
    return getNormalizedScrollLeft(el, "rtl") === 0
  })
  expect(isLeft).toBe(true)
})
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Out-of-Order Toast Height Registration Under Batching (BUG-TOAST-01)
- **Context**: Dynamic toast stacking management in `packages/machines/toast/src/toast.machine.ts` and `toast.utils.ts`.
- **What Was Expected**: When multiple toasts trigger simultaneously (e.g., initial batch query or rapid API triggers), the toast group stack should position each notification card according to its explicit placement in the `toasts` array context.
- **What Actually Happened**: In frameworks utilizing batched DOM render jobs (specifically Vue 3 microtask scheduler), toasts mounted and evaluated their layout dimensions out-of-order. Because `setHeight` used a naive unshift `[{ id, height }, ...prev]`, the height coordinates inverted, causing the bottom toasts to calculate collapsed offsets based on the wrong sibling's dimensions.
- **Evidence in Repo**: Commit `86add962`, Issue `#3541`. Changeset `.changeset/toast.md`.
- **Root Cause**: Reliance on event arrival order in a distributed actor/machine system where the underlying host framework batches layout effects non-deterministically.
- **Remediation Code Diff**:
```diff
--- a/packages/machines/toast/src/toast.machine.ts
+++ b/packages/machines/toast/src/toast.machine.ts
@@ -303,15 +303,3 @@ function measureLayoutHeight(el: HTMLElement): number {
   el.style.height = prevHeight
   return height
 }
-
-function setHeight(parent: Service<ToastGroupSchema>, item: ToastHeight) {
-  const { id, height } = item
-  parent.context.set("heights", (prev) => {
-    const alreadyExists = prev.find((i) => i.id === id)
-    if (!alreadyExists) {
-      return [{ id, height }, ...prev]
-    }
-    if (alreadyExists.height === height) return prev
-    return prev.map((i) => (i.id === id ? { ...i, height } : i))\n-  })
-}

--- a/packages/machines/toast/src/toast.utils.ts
+++ b/packages/machines/toast/src/toast.utils.ts
@@ -216,3 +216,24 @@ export function getGhostAfterStyle(): Style {
     width: "100%",
   }
 }
+
+export function setHeight(parent: Service<ToastGroupSchema>, item: ToastHeight) {
+  const { id, height } = item
+  parent.context.set("heights", (prev) => {
+    const existing = prev.find((i) => i.id === id)
+    if (existing) {
+      if (existing.height === height) return prev
+      return prev.map((i) => (i.id === id ? { ...i, height } : i))
+    }
+    // Toasts mounted in the same flush measure in any order, so insert by `toasts` position
+    const toasts = parent.context.get("toasts")
+    const rank = (id: string) => toasts.findIndex((t) => t.id === id)
+    const index = rank(id)
+    let insertAt = prev.findIndex((i) => {
+      const r = rank(i.id)
+      return r === -1 || r > index
+    })
+    if (insertAt === -1) insertAt = prev.length
+    return [...prev.slice(0, insertAt), { id, height }, ...prev.slice(insertAt)]
+  })
+}
```
- **Lesson**: Centralized state that aggregates child measurements MUST use relative coordinate ranking derived from canonical data models, never temporal execution arrival.

---

### Incident 2: Focus Ring Suppression in Firefox on Keyboard Dismissal (BUG-FOCUS-02)
- **Context**: Keyboard dismissal routines in `packages/machines/cascade-select`, `color-picker`, `popover`, `select`, and `@zag-js/dismissable`.
- **What Was Expected**: Pressing `Escape` to close a floating overlay should return focus to the trigger element and display the browser's `:focus-visible` styling ring.
- **What Actually Happened**: In Gecko/Firefox, calling `element.focus({ preventScroll: true })` programmatically after an Escape key event stripped the `:focus-visible` pseudo-class from the trigger button because the programmatic focus invocation was classified as an unadorned script focus rather than keyboard-initiated.
- **Evidence in Repo**: Commit `d5973062`, PR `#3540`. Files `.changeset/dismissable.md`, `cascade-select.machine.ts`, `color-picker.machine.ts`.
- **Root Cause**: `@zag-js/dismissable` discarded the native DOM event that caused dismissal when firing `onDismiss`. The machines could not discern whether dismissal occurred via mouse click outside or keyboard `Escape`.
- **Remediation Code Diff**:
```diff
--- a/packages/machines/cascade-select/src/cascade-select.machine.ts
+++ b/packages/machines/cascade-select/src/cascade-select.machine.ts
@@ -625,8 +625,8 @@ export const machine = createMachine<CascadeSelectSchema>({
             prop("onInteractOutside")?.(event)
             restoreFocus = !(event.detail.focusable || event.detail.contextmenu)
           },
-          onDismiss() {
-            send({ type: "CLOSE", src: "interact-outside", restoreFocus })
+          onDismiss(event) {
+            send({ type: "CLOSE", src: "interact-outside", restoreFocus, focusVisible: event?.type === "keydown" })
           },
         })
       },
@@ -943,9 +943,10 @@ export const machine = createMachine<CascadeSelectSchema>({
       },
       focusTriggerEl({ event, scope }) {
         if (!restoreFocusFn(event)) return
+        const focusOptions = getReturnFocusOptions(event)
         raf(() => {
           const triggerEl = dom.getTriggerEl(scope)
-          triggerEl?.focus({ preventScroll: true })
+          triggerEl?.focus(focusOptions)
         })
       },
@@ -1104,3 +1105,9 @@ function restoreFocusFn(event: Record<string, any>) {
   const v = event.restoreFocus ?? event.previousEvent?.restoreFocus
   return v == null || !!v
 }
+
+// Show the focus ring when closed from the keyboard; leave it to the browser otherwise
+function getReturnFocusOptions(event: Record<string, any>): FocusOptions {
+  const focusVisible = event.focusVisible ?? event.previousEvent?.focusVisible
+  return focusVisible ? { preventScroll: true, focusVisible: true } : { preventScroll: true }
+}
```
- **Lesson**: Programmatic focus restore logic must propagate the initiating event modality (keyboard vs pointer) down to `FocusOptions` via `{ focusVisible: true }`.

---

### Incident 3: Focus Hijacking During Form Progression (BUG-FOCUS-03)
- **Context**: Date Picker and Color Picker selection pipelines in `packages/machines/color-picker` and `packages/machines/date-picker`.
- **What Was Expected**: Users configuring a multi-step form who provide an `onValueChange` callback that imperatively advances focus (e.g., `nextFieldRef.current?.focus()`) should have focus remain on the next field when `closeOnSelect: true` is enabled.
- **What Actually Happened**: The machine teardown action unconditionally ran `dom.getTriggerEl(scope)?.focus({ preventScroll: true })`, overriding the user's manual focus transition and pulling the cursor back to the dropdown button.
- **Evidence in Repo**: Commit `4f02aa66`, Issue `#3539`. Added `isFocusOutside` utility in `@zag-js/dom-query` and Playwright tests in `e2e/color-picker.e2e.ts`.
- **Root Cause**: Component state machine failed to verify the active DOM focus state prior to triggering default return-focus actions.
- **Remediation Code Diff**:
```diff
--- a/packages/machines/color-picker/src/color-picker.machine.ts
+++ b/packages/machines/color-picker/src/color-picker.machine.ts
@@ -621,12 +621,13 @@ export const machine = createMachine<ColorPickerSchema>({
           element.focus({ preventScroll: true })
         })
       },
-      setReturnFocus({ scope }) {
+      setReturnFocus({ scope, event }) {
         const contentEl = dom.getContentEl(scope)
+        const focusOptions = getReturnFocusOptions(event)
         raf(() => {
           // Keep focus that moved elsewhere (e.g. from `onValueChange`)
+          if (isFocusOutside(scope.getActiveElement(), [contentEl])) return
-          dom.getTriggerEl(scope)?.focus({ preventScroll: true })
+          dom.getTriggerEl(scope)?.focus(focusOptions)
         })
       },
```
- **Lesson**: Always verify that the currently focused element (`scope.getActiveElement()`) is not already outside the dismissal tree before executing automated return-focus fallbacks.

---

### Incident 4: Double-Click Title Desynchronization in Floating Panel (BUG-STATE-04)
- **Context**: Window lifecycle states in `packages/machines/floating-panel`.
- **What Was Expected**: When a floating panel is minimized, double-clicking the title bar to maximize it should clear the minimized state, correctly exposing window controls and full panel dimensions.
- **What Actually Happened**: Minimizing set `isMinimized: true`. Double-clicking invoked an unconstrained maximize action that toggled `isMaximized: true` without resetting `isMinimized: false`. The DOM projection kept the minimize button visible while cutting panel contents.
- **Evidence in Repo**: Issue `#2919`.
- **Root Cause**: Compound state representation using non-mutually-exclusive boolean flags (`isMinimized`, `isMaximized`) instead of an explicit finite state enumeration or mutual exclusion transition guards.
- **Remediation Pattern**:
```typescript
// Architectural remediation: Statechart Mutual Exclusion Invariant
on: {
  "TITLEBAR.DOUBLE_CLICK": [
    {
      guard: "isMinimized",
      target: "maximized",
      actions: ["clearMinimized", "setMaximized"]
    },
    {
      guard: "isMaximized",
      target: "restored",
      actions: ["clearMaximized"]
    },
    {
      target: "maximized",
      actions: ["setMaximized"]
    }
  ]
}
```
- **Lesson**: Never model mutually exclusive UI display modes using parallel orthogonal boolean flags. Model them as distinct atomic states or enforce symmetric resets in entry actions.

---

### Incident 5: False-Positive Outside Pointer Dismissal on Mobile Touch (BUG-TOUCH-05)
- **Context**: Touch event lifecycle inside nested portals and mobile drawers (`@zag-js/dismissable`, `dialog`, `date-picker`).
- **What Was Expected**: Tapping an interactive date cell in a nested Date Picker rendered inside a Dialog/Drawer on a touch device should select the date without closing the host Dialog/Drawer.
- **What Actually Happened**: On touch devices, tapping the date triggered a `pointerdown` / `touchstart` event sequence. Due to virtual keyboard shifts or DOM portal hierarchies, the dialog's dismissable layer evaluated the touch coordinate as outside its boundary during event propagation, prematurely terminating the drawer.
- **Evidence in Repo**: Issue `#2084`, Ark UI Issue `#2816`.
- **Root Cause**: Touch events have distinct multi-stage lifecycles (`touchstart`, `touchmove`, `touchend`). A swipe or tap that begins on an element can cause touch retargeting or portal detachments before the dismissable tracker completes validation.
- **Remediation Pattern**:
```typescript
// Verified handling in dismissable layer: Track pointerdown target and verify at release
trackInteractOutside(node, {
  onPointerDown(e) {
    initialTarget = getEventTarget(e)
  },
  onDismiss(e) {
    const currentTarget = getEventTarget(e)
    // Guard against detached portals or touch targets that started inside node
    if (node.contains(initialTarget) || node.contains(currentTarget)) {
      return
    }
    close()
  }
})
```
- **Lesson**: Outside-interaction detectors must track both interaction initiation (`pointerdown`/`touchstart`) and completion (`pointerup`/`touchend`) targets to avoid firing dismissals when elements unmount between event phases.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Falsy Coercion Hazards (`0` vs `null` / `undefined`)**:
  In UI primitives dealing with focus management, coordinate offsets, and numeric inputs, checking properties with simple truthy checks (`if (event.restoreFocus)`) breaks when `restoreFocus: false` is explicitly supplied.
  ```typescript
  // HAZARD: Fails when restoreFocus is false (coerced to undefined fallback)
  const shouldRestore = event.restoreFocus || true // Always true!

  // SAFE CANONICAL ZAG INVARIANT:
  function restoreFocusFn(event: Record<string, any>) {
    const v = event.restoreFocus ?? event.previousEvent?.restoreFocus
    return v == null || !!v // Defaults to true only if null or undefined
  }
  ```
- **Deep Immutability vs Shallow Mutation**:
  In controls and state hooks (`use-controls.tsx`), nested state trees must never be mutated in place prior to updating framework state, nor should naive spread operators be used for multi-level configs:
  ```typescript
  // INVARIANT: Structured cloning before deep property assignment
  const setState = (key: string, value: any) => {
    __setState((s) => {
      const newState = structuredClone(s)
      deepSet(newState, key, value)
      return newState
    })
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **Microtask & RequestAnimationFrame Loop Termination**:
  When deferring operations across frame boundaries (e.g., waiting for layout stability), repeated calls to `requestAnimationFrame` must be strictly bounded.
  ```typescript
  // Bounded Frame-Wait Invariant (from e2e/models/model.ts)
  waitForFrames(count = 2): Promise<void> {
    return this.page.evaluate(
      (count) =>
        new Promise<void>((resolve) => {
          const next = (n: number) => (n === 0 ? resolve() : requestAnimationFrame(() => next(n - 1)))
          next(count)
        }),
      count,
    )
  }
  ```
- **Serialization Guard for Circular DOM References**:
  When computing DOM