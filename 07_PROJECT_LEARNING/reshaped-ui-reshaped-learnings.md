> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/reshaped-ui-reshaped-learnings.md`  
> **Source**: github ([https://github.com/reshaped-ui/reshaped](https://github.com/reshaped-ui/reshaped))  
> **Source Version**: `bf8a1e44`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-22T20:15:49.891Z  
> **Learning ID**: `learn-github-reshaped-ui-reshaped`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): reshaped-ui/reshaped

---

## 1. Executive Forensic Architecture & System Mechanics

`reshaped-ui/reshaped` is a multi-tier design system architecture built for enterprise React applications. It decouples design primitives, headless layout state, coordinate geometry, and hardware-accelerated CSS mechanics across three monorepo packages:
1. `reshaped`: High-level accessible React UI component library (compound architecture, CSS modules, design tokens).
2. `@reshaped/headless`: Logic primitives managing DOM geometry, accessibility attributes (ARIA), and transient interactions.
3. `@reshaped/utilities`: Pure TypeScript viewport calculations, scrolling physics, coordinate math, and DOM listener optimizations.

```
+---------------------------------------------------------------------------------------+
|                                    reshaped (UI)                                      |
|  [ContextMenu]  [Modal]  [Select]  [Autocomplete]  [Flyout]  [Slider]  [Calendar]     |
+-------------------------------------------+-------------------------------------------+
                                            |
       +------------------------------------+------------------------------------+
       | Hook Abstractions & Physics Layer                                       |
       | - useSingletonHotkeys (Global event dispatcher & Mac/Win normalization) |
       | - useOnClickOutside (Capture-phase outside click & contextmenu sync)    |
       | - useDrag (Pointer compensation, coordinate clamping, scroll locking)   |
       | - useFadeSide (RTL-aware scroll boundary detection via rafThrottle)    |
       +------------------------------------+------------------------------------+
                                            |
       +------------------------------------+------------------------------------+
       | Headless Geometric Engines & Utilities                                  |
       | - safeArea.ts (Barycentric coordinate point-in-triangle hit testing)    |
       | - cooldown.ts (State machine: cold -> warming -> warm -> cooling)       |
       | - Slider.utilities (Float epsilon precision & input property descriptor)|
       | - Calendar.utils (Leap year, ISO dates, Tab focus roving indexing)      |
       +------------------------------------+------------------------------------+
                                            |
       +------------------------------------+------------------------------------+
       | Hardware Compositor & CSS Variable Engine                               |
       | - Non-inherited CSS Custom Properties (@property)                       |
       | - GPU Compositor Offloading (transform3d, opacity vs layout/paint)     |
       +-------------------------------------------------------------------------+
```

### Critical Subsystem Abstractions:
- **Geometry & Collision Detection Engine (`safeArea.ts`)**: Implements barycentric coordinates over triangles (`[origin, corner1, corner2]`) to create an invisible triangular safe corridor between cursor origin and floating popover menus, preventing flyouts from prematurely closing when cursors traverse diagonally over dead space.
- **Global Event Dispatcher & Input Method Engine (`useSingletonHotkeys.tsx`)**: Replaces disparate DOM listeners with a single reference-counted window listener and `HotkeyStore`. Features modifier sorting, keyup normalization for macOS `Cmd` key masking, and early-exit filters for CJK Input Method Editor (IME) composition phases.
- **Event Phase Coordination (`useOnClickOutside.ts`)**: Bypasses React's synthetic event bubbling phase by operating on native document capture-phase handlers (`{ capture: true }`), resolving race conditions where newly rendered menus receive their own triggers' bubbled events and instantly self-terminate.
- **Hardware Compositor-Boundary Execution (`@property` + CSS Variables)**: Offloads high-frequency layout updates (modal swipe gestures, scroll thumbs) from React state renders to CSS custom properties marked `@property { inherits: false }`, preventing whole-tree style recalcs and paint invalidation on mobile viewports.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Capture-Phase Document Subscriptions for Transient Floating Overlays
**RULE**:
Document-level dismissal handlers for context menus and transient overlays MUST attach during the native DOM capture phase (`{ capture: true }`) and MUST NOT rely on bubbling phase checks or `event.defaultPrevented` flags to discriminate ownership between competing menus.

**WHY**:
When a pointer action initiates a new context menu, React re-renders and attaches document listeners within the same microtask. If document dismissals are bound in the bubble phase, two defects occur:
1. A newly mounted overlay attaches its bubbling document listener before the opening event finishes bubbling up to `document`, causing the new overlay to immediately close itself.
2. If `event.defaultPrevented` is used as a workaround to ignore the trigger event, right-clicking *another* menu trigger calls `preventDefault()` on the event, which suppresses the dismissal check and leaves the previously open menu permanently stuck on screen. Capture-phase listeners fire top-down *before* local target handlers, dismissing any stale overlay before the new overlay registers its listeners.

**WHEN TO APPLY**:
Context menus, cascading dropdowns, popovers, tooltips, and any floating layer dismissed via outside clicks where multiple distinct triggers exist simultaneously in the DOM.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import React from "react";

export const useOnClickOutside = (
  refs: Array<React.RefObject<HTMLElement | null>>,
  handler: (event: MouseEvent | TouchEvent) => void,
  disabled: boolean = false
) => {
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  const checkInside = (event: Event): boolean => {
    const path = event.composedPath();
    return refs.some((ref) => {
      const el = ref.current;
      return el && (path.includes(el) || el.contains(event.target as Node));
    });
  };

  React.useEffect(() => {
    if (disabled) return;

    // Capture phase guarantees the existing active menu closes BEFORE
    // a competing trigger processes the event and mounts a new menu.
    const handleContextMenu = (event: MouseEvent) => {
      if (checkInside(event)) return;
      handlerRef.current(event);
    };

    const handleClick = (event: MouseEvent | TouchEvent) => {
      if (checkInside(event)) return;
      handlerRef.current(event);
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("contextmenu", handleContextMenu, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
    };
  }, [disabled, ...refs]);
};
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Never swallow dismissals based on defaultPrevented in bubble phase!
React.useEffect(() => {
  const handleClick = (e: MouseEvent) => {
    // BUG: If another trigger calls e.preventDefault() on right-click,
    // this check aborts, leaving the current menu permanently orphaned.
    if (e.defaultPrevented) return;
    if (!containerRef.current?.contains(e.target as Node)) {
      onClose();
    }
  };
  document.addEventListener("contextmenu", handleClick); // Missing capture!
  return () => document.removeEventListener("contextmenu", handleClick);
}, []);
```

**VERIFICATION METHOD**:
Automated integration test using Storybook Test Runner / Vitest Playwright:
1. Render two sibling context menu triggers: `Trigger A` and `Trigger B`.
2. Right-click `Trigger A`. Assert `Menu A` is visible.
3. Without left-clicking, right-click `Trigger B`.
4. Assert `Menu A` is detached from DOM and `Menu B` is visible.
5. Right-click `Trigger B` again at a 100px offset. Assert `Menu B` repositioned, `onClose` fired with `{ reason: 'outside-click' }`, and `onOpen` fired.

---

### 2. IME Composition Guard with Safari KeyCode 229 Trap
**RULE**:
Global hotkey, shortcut, and keydown handlers MUST abort execution whenever `e.isComposing === true` OR `e.keyCode === 229`.

**WHY**:
During CJK (Chinese, Japanese, Korean) text input via an Input Method Editor (IME), users hit `Enter`, `Space`, or numeric keys to select ideographic candidates from a floating composition window. Browsers emit standard `keydown` events for these strokes. 
- In Chromium and Firefox, `event.isComposing` is `true`.
- In WebKit (Safari), `compositionend` fires *before* the final confirmation `keydown`, meaning `isComposing` is already mutated to `false` when the confirming `Enter` keydown reaches the window. However, Safari sets `e.keyCode = 229` (the standard RFC 229 composite keycode sentinel). 
Failing to test both flags causes input handlers (such as modal submission, autocomplete selection, or command palettes) to prematurely submit forms or select incomplete phonetic tokens.

**WHEN TO APPLY**:
All text inputs, autocomplete fields, command palettes (`Cmd+K`), custom hotkey managers, and form submission listeners.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export const handleWindowKeyDown = (e: KeyboardEvent): boolean => {
  // 1. Browsers trigger synthetic keyboard events without e.key during form autofill
  if (!e.key) return false;

  // 2. Full-spectrum IME composition guard:
  // e.isComposing covers modern spec (Blink/Gecko)
  // e.keyCode === 229 handles WebKit/Safari composition confirmation race conditions
  if (e.isComposing || e.keyCode === 229) {
    return false;
  }

  return true; // Safe to proceed to shortcut dispatcher
};
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Checking only e.key === "Enter" or relying exclusively on e.isComposing
const onKeyDown = (e: React.KeyboardEvent) => {
  // BUG: In Safari, confirming Japanese Kanji conversion sets isComposing=false,
  // firing Enter down and prematurely closing the modal / picking wrong candidate!
  if (e.isComposing) return;
  if (e.key === "Enter") {
    selectOption();
  }
};
```

**VERIFICATION METHOD**:
Simulate an IME synthetic sequence via Playwright / Vitest:
```typescript
const eventComposing = new KeyboardEvent("keydown", {
  key: "Enter",
  code: "Enter",
  isComposing: true,
  bubbles: true
});
const eventSafariIME = new KeyboardEvent("keydown", {
  key: "Enter",
  code: "Enter",
  keyCode: 229,
  isComposing: false,
  bubbles: true
});

window.dispatchEvent(eventComposing);
window.dispatchEvent(eventSafariIME);
// Assert registered hotkey callback count === 0
```

---

### 3. Non-Inherited Custom Property Containment for Main-Thread Animation Offloading
**RULE**:
High-frequency gesture offsets, scroll tracking positions, or drag coordinates written to the DOM as CSS variables MUST be registered using `@property` with `inherits: false`, and animated elements MUST separate static layout properties from transformed compositor layers.

**WHY**:
When a CSS custom property (e.g., `--rs-drag-y`) is set on a root element during touch/pointer interactions, the browser default behavior is to cascade and inherit that variable across every child DOM node in the subtree. On mobile viewports with complex nested cards, setting a CSS variable on every `requestAnimationFrame` forces style recalculations and repaints over hundreds of nodes on the main thread. Registering `inherits: false` restricts style invalidation exclusively to the root boundary. Furthermore, transitioning static backgrounds (like modal backdrops) via `background-color` triggers full-screen rasterization on every frame; splitting the backdrop into an independent DOM layer and animating `opacity` allows the GPU compositor thread to execute animations at 120 FPS without waking the JavaScript thread.

**WHEN TO APPLY**:
Touch swipe gestures, sheet drawers, pull-to-refresh, custom scroll area thumbs, and range slider thumbs.

**VERIFIED IMPLEMENTATION PATTERN**:
```css
/* packages/reshaped/src/components/Modal/Modal.module.css */
@property --rs-modal-drag-offset {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}

.root {
  transform: translateY(var(--rs-modal-drag-offset));
  will-change: transform;
}

/* Backdrop separated into dedicated layer to avoid repainting viewport */
.backdrop {
  position: fixed;
  inset: 0;
  background-color: var(--rs-color-overlay);
  opacity: var(--rs-backdrop-opacity, 1);
  will-change: opacity;
  pointer-events: none;
}
```

```typescript
// DOM Mutation pattern: Single-node write, bypassing React reconciliation
export const applyModalDragOffset = (element: HTMLElement, offsetPx: number) => {
  element.style.setProperty("--rs-modal-drag-offset", `${offsetPx}px`);
};
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Mutating React state during touchmove or driving viewport layout styles
const [dragY, setDragY] = useState(0);

const onTouchMove = (e: TouchEvent) => {
  // BUG: Triggers full React reconciliation on every touch coordinate change!
  setDragY(e.touches[0].clientY);
};

return (
  <div style={{ top: `${dragY}px`, backgroundColor: `rgba(0,0,0,${1 - dragY/500})` }}>
    {/* Entire heavy children tree re-renders and forces GPU rasterization */}
  </div>
);
```

**VERIFICATION METHOD**:
Execute Chrome DevTools Performance Profiler (or Puppeteer trace inspection):
1. Assert zero `Layout` and `Update Layer Tree` events during continuous touch-drag gestures.
2. Verify in CSS Computed Style pane that `--rs-modal-drag-offset` does not invalidate children styles.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Competing Context Menu Deadlock & Self-Termination (BUG-CONTEXTMENU-01)
- **Context**: `packages/reshaped/src/hooks/useOnClickOutside.ts` & `packages/reshaped/src/components/ContextMenu`
- **What Was Expected**: Right-clicking an active context menu trigger in a new location should reposition the menu. Right-clicking a *different* context menu trigger should immediately close the first menu and open the second.
- **What Actually Happened**: Right-clicking a second trigger left the first menu rendered on screen, creating floating phantom overlays. Furthermore, right-clicking the same trigger at a new coordinate caused the menu to stay locked at the old coordinate.
- **Evidence in Repo**: Commit `4d8b937f`, PR #678, Changeset `.changeset/context-menu-close-on-another-menu.md`.
- **Root Cause**:
  1. Commit `1060733` had previously introduced `if (event.defaultPrevented) return;` into `useOnClickOutside` to prevent freshly opened menus from closing themselves when the opening right-click event bubbled to `document`. However, all context menus call `e.preventDefault()` to stop native OS context menus. Thus, clicking another menu trigger tripped `event.defaultPrevented === true`, suppressing the outside-click callback and leaving the old menu open.
  2. In `FlyoutControlled`, when right-clicking the same trigger, React batched the coordinate update within a single frame where `status` remained `"rendered"`. Because `status` didn't change from `"closed"` to `"rendered"`, the positioning effect was never re-triggered, leaving the flyout stranded at old coordinates.
- **Remediation Code Diff**:
```diff
--- a/packages/reshaped/src/hooks/useOnClickOutside.ts
+++ b/packages/reshaped/src/hooks/useOnClickOutside.ts
@@ -58,26 +58,25 @@ const useOnClickOutside = (
 		if (disabled) return;
 
 		const handleClick = (event: MouseEvent | TouchEvent) => {
-			if (event.type === "contextmenu") {
-				/**
-				 * Context menu events can be claimed by a handler that opens a menu of its own,
-				 * which prevents the default browser behavior. Such events open a new flyout
-				 * instead of dismissing the current one, so they're not outside clicks
-				 */
-				if (event.defaultPrevented) return;
-
-				isMouseDownInsideRef.current = checkEventInsideRefs(event);
-			}
-
 			if (isMouseDownInsideRef.current) return;
 			handlerRef.current?.(event);
 		};
 
+		/**
+		 * Capture phase closes the content before another context menu opens on the same event,
+		 * while the content opened by this event subscribes too late to get closed by it.
+		 * Target is checked directly since the context menu key doesn't trigger mousedown
+		 */
+		const handleContextMenu = (event: MouseEvent) => {
+			if (checkEventInsideRefs(event)) return;
+			handlerRef.current?.(event);
+		};
+
 		document.addEventListener("click", handleClick);
-		document.addEventListener("contextmenu", handleClick);
+		document.addEventListener("contextmenu", handleContextMenu, { capture: true });
 		return () => {
 			document.removeEventListener("click", handleClick);
-			document.removeEventListener("contextmenu", handleClick);
+			document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
 		};
```
```diff
--- a/packages/reshaped/src/components/Flyout/FlyoutControlled.tsx
+++ b/packages/reshaped/src/components/Flyout/FlyoutControlled.tsx
@@ -370,6 +370,13 @@ const FlyoutControlled: React.FC<T.ControlledProps & T.DefaultProps> = (props) =>
 		if (status === "rendered") show();
 	}, [status, show]);
 
+	// Content can be reopened at new coordinates without closing in between
+	useIsomorphicLayoutEffect(() => {
+		if (!originCoordinates || !isRendered) return;
+		updatePosition();
+		// oxlint-disable-next-line react-hooks/exhaustive-deps
+	}, [originCoordinates?.x, originCoordinates?.y]);
```
- **Lesson**: Never use bubbling-phase `defaultPrevented` checks to manage modal lifecycle dismissal. Capture phase allows ancestral listeners to execute prior to consumer actions, cleanly serializing dismissal and mount operations.

---

### Incident 2: IME Composition Premature Form Submission in Safari (BUG-HOTKEYS-02)
- **Context**: `packages/reshaped/src/hooks/_internal/useSingletonHotkeys.tsx` & `Autocomplete`
- **What Was Expected**: Pressing `Enter` to confirm a Japanese, Chinese, or Korean ideogram conversion should commit the characters to the input field and do nothing else.
- **What Actually Happened**: Hitting `Enter` to confirm conversion in `Autocomplete` immediately triggered the hotkey listener, selecting whatever option was currently highlighted in the dropdown list or submitting the form with partial text.
- **Evidence in Repo**: Commit `6150f4fc`, PR #676, Issue #671, Changeset `.changeset/hotkeys-ime-composition.md`.
- **Root Cause**: WebKit (Safari) fires `compositionend` *prior* to emitting the `keydown` event for the confirming `Enter` key stroke. As a consequence, `e.isComposing` has already reverted to `false` when the event hits the window handler. The hotkey engine treated the keydown as a literal `Enter` command.
- **Remediation Code Diff**:
```diff
--- a/packages/reshaped/src/hooks/_internal/useSingletonHotkeys.tsx
+++ b/packages/reshaped/src/hooks/_internal/useSingletonHotkeys.tsx
@@ -216,6 +216,9 @@ const HotkeysProvider: React.FC<{ children: React.ReactNode }> = (props) => {
 	const handleWindowKeyDown = React.useCallback(
 		(e: KeyboardEvent) => {
 			if (!e.key) return;
+			// Keys handled by an IME are not hotkeys. Safari fires the Enter that confirms
+			// a composition after compositionend, so only keyCode 229 marks it
+			if (e.isComposing || e.keyCode === 229) return;
 
 			const nextPressedMap = addPressedKey(e) ?? pressedMapRef.current;
 			globalHotkeyStore.handleKeyDown(nextPressedMap, e);
```
- **Lesson**: Cross-browser keyboard handling requires guarding against browser-specific event ordering quirks. Never rely solely on `e.isComposing`; test `e.keyCode === 229` to defend against WebKit's early `compositionend` dispatch.

---

### Incident 3: Frozen Exit State Desynchronization during Flyout Unmount (BUG-FLYOUT-03)
- **Context**: `packages/reshaped/src/components/Flyout` & `Select`
- **What Was Expected**: When closing a `Select` or `Autocomplete` flyout with an exit animation, the popover should fade out smoothly displaying its last active state.
- **What Actually Happened**: When a user selected a value, the component updated its state, causing the animating flyout to abruptly mutate its DOM contents, flicker, or shift layout mid-animation. If closed immediately after opening, the unmount transition failed to trigger, leaving the DOM node permanently mounted. Furthermore, pointer events on exit-animating menus allowed phantom double-clicks.
- **Evidence in Repo**: PR #675, Commit `d9770c54`, Changeset `.changeset/flyout-frozen-exit-animation.md`.
- **Root Cause**: The unmount pipeline did not snapshot/freeze the VNode render tree upon initiating the exit phase (`status === "cooling"`), allowing upstream re-renders to mutate child components during the CSS transition window. Additionally, canceling an opening transition did not invoke `transitionend`, hanging the unmount state machine.
- **Remediation Architecture**:
  1. Introduced a frozen render boundary: when closing starts, cache `props.children` in a ref and render the frozen cached tree until unmount.
  2. Applied `pointer-events: none` via CSS when `status !== "entered"` to deactivate pointer collision during exit animations.
  3. Added an explicit short-circuit in `FlyoutControlled`: closing before the opening transition begins immediately transitions `status` to unmounted without awaiting a non-existent `transitionend` event.
- **Lesson**: Animated exits in React compound components require snapshotting the render tree and suppressing pointer events until DOM unmounting completes.

---

### Incident 4: Main-Thread Viewport Invalidation via CSS Custom Property Inheritance (BUG-MODAL-04)
- **Context**: `packages/reshaped/src/components/Modal` & `packages/reshaped/src/components/Overlay`
- **What Was Expected**: Modal swipe-to-close gestures on mobile devices should track finger movement at a sustained 60–120 FPS.
- **What Actually Happened**: Significant frame drops, jank, and thermal throttling occurred on iOS Safari and mobile Chrome when dragging bottom-sheet modals.
- **Evidence in Repo**: PR #667 (`3d94de2`), PR #669 (`9c58807`), Changesets `.changeset/modal-drag-property.md` and `.changeset/overlay-backdrop-compositor.md`.
- **Root Cause**:
  1. The drag translation variable `--rs-modal-drag-offset` was implicitly inherited. Updating `--rs-modal-drag-offset` on the root element on every touchmove event forced the CSS engine to recalculate computed styles across all child DOM elements in the modal tree on the main thread.
  2. The backdrop was rendered on the modal root and animated via `background-color`. Every change in touch offset recomputed color interpolation and triggered a full-viewport paint.
- **Remediation Architecture**:
  1. Defined `@property --rs-modal-drag-offset { syntax: '<length>'; inherits: false; initial-value: 0px; }` to isolate style recalculations to the root element.
  2. Decoupled the backdrop into a dedicated stacking layer (`position: fixed; inset: 0; will-change: opacity;`) transitioning exclusively via `opacity`, delegating the entire gesture composition to the GPU thread.
- **Lesson**: High-frequency CSS custom properties must be scoped with `inherits: false`, and opacity transitions must be preferred over background-color mutations.

---

### Incident 5: ScrollArea RTL Layout Inversion and Reflow Thrashing (BUG-SCROLL-05)
- **Context**: `packages/reshaped/src/components/ScrollArea`
- **What Was Expected**: Custom scrollbar thumb tracks the scroll position accurately in both LTR and RTL reading directions without degrading scroll performance.
- **What Actually Happened**: Horizontal scrollbar thumbs in RTL layouts detached from the track and moved beyond the visible scroll container. Rapid scrolling caused severe frame hitching.
- **Evidence in Repo**: PR #668, Commit `3c21d21e`, Changeset `.changeset/scroll-area-thumb-compositor.md`.
- **Root Cause**:
  1. Scroll thumb positioning was managed by writing to `style.insetInlineStart` (or `left`/`top`), which forces the browser to execute synchronous layout calculations (reflow) on every scroll tick.
  2. In RTL mode, browser implementations of `scrollLeft` vary (some return negative coordinates, others return inverted positive values starting at zero). Directly translating `scrollLeft` to `left` caused arithmetic overflow outside the track bounding box.
- **Remediation Architecture**:
  1. Replaced `inset` with hardware-accelerated `transform: translate3d(var(--rs-scroll-x), var(--rs-scroll-y), 0)`.
  2. Bypassed React state by writing the calculated offset directly to the element's CSS custom properties within a `requestAnimationFrame` loop.
  3. Integrated normalized RTL offsets: `scrollLeft * (rtl ? -1 : 1)` to handle browser coordinate variances.
- **Lesson**: Never position custom scroll indicators using layout attributes (`top`/`left`/`inset`). Use `transform3d` coupled directly with direct-to-DOM CSS custom property mutations.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
- **IEEE 754 Floating-Point Clamping in Range Sliders**:
  In `Slider.utilities.ts`, step calculation cannot use naive modulo arithmetic (`value % step === 0`) due to floating-point rounding errors (e.g., `0.3 - 0.2 = 0.09999999999999998`).
  ```typescript
  export const getPrecision = (value: number) => {
    const floatPart = value.toString().split(".")[1];
    return floatPart?.length || 0;
  };

  export const applyStepToValue = (value: number, step: number) => {
    const isStepFloat = step % 1 !== 0;
    const result = Math.round(value / step) * step;

    if (isStepFloat) {
      const precision = getPrecision(step);
      // Number(val.toFixed(p)) eliminates precision drift without external big-number libs
      return Number(result.toFixed(precision));
    }
    return result;
  };
  ```
- **React Synthetic Prototype Value Setter Bypass**:
  When synchronizing React state with a hidden native `<input type="range">`, assigning `el.value = nextVal` fails to trigger React's synthetic `onChange` because React overrides the property setter on `HTMLInputElement.prototype`. Reshaped extracts the original native descriptor:
  ```typescript
  export const triggerChangeEvent = (el: HTMLInputElement, value: string) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    nativeInputValueSetter?.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  ```

### 2. Infinite Loop & Recursion Guards
- **DOM Hierarchy Traversal Base Condition Proof**:
  In `Theme.utilities.ts`, recursive upward DOM traversal to find the root theme boundary (`getRootThemeEl`) must enforce structural termination bounds:
  ```typescript
  export const getRootThemeEl = (scopeEl?: HTMLElement | null): HTMLElement => {
    // 1. Guard against null, undefined, or detached nodes
    if (!scopeEl) return document.documentElement;

    // 2. Base case: target attribute found OR document boundary reached
    if (
      scopeEl.hasAttribute("data-rs-root") ||
      scopeEl === document.documentElement ||
      !scopeEl.parentElement // Handles Shadow DOM or unparented DocumentFragments
    ) {
      return scopeEl;
    }

    // 3. Inductive step: strictly moves up the DOM tree, guaranteeing termination
    return getRootThemeEl(scopeEl.parentElement);
  };
  ```
- **Key Normalization Sorting Proof**:
  In `useSingletonHotkeys.tsx`, hotkeys can be registered in any arbitrary order (e.g., `"shift+cmd+k"` vs `"cmd+shift+k"`). Naive string matching leads to unbounded state divergence. Normalization sorts key fragments alphabetically:
  ```typescript
  const getHotkeyId = (hotkey: string) => {
    return formatHotkey(hotkey)
      .split(COMBINATION_DELIMETER) // "+"
      .sort()                        // Canonical alphabetical sort guarantees bijection
      .join(COMBINATION_DELIMETER);
  };
  ```

### 3. UI & UX Micro-Mechanics
- **Barycentric Coordinate Triangle Collision (`safeArea.ts`)**:
  When a user moves the pointer from a trigger element toward a floating flyout, moving diagonally exits the trigger boundary before entering the content boundary. Reshaped constructs an invisible triangle connecting the cursor coordinates with the two closest bounding box vertices of the flyout:
  ```typescript
  function isPointInTriangle(
    point: Coordinates,
    triangle: [Coordinates, Coordinates, Coordinates]
  ): boolean {
    const [p1, p2, p3] = triangle;
    const denominator = (p2.y - p3.y) * (p1.x - p3.x) + (p3.x - p2.x) * (p1.y - p3.y);

    if (denominator === 0) return false; // Guard against collinear points/division by zero

    const a = ((p2.y - p3.y) * (point.x - p3.x) + (p3.x - p2.x) * (point.y - p3.y)) / denominator;
    const b = ((p3.y - p1.y) * (point.x - p3.x) + (p1.x - p3.x) * (point.y - p3.y)) / denominator;
    const c = 1 - a - b;

    return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
  }
  ```
- **RTL-Aware Scroll Boundary Math (`useFadeSide.ts`)**:
  Detecting whether a horizontal scroll container overflows at the start or end requires accounting for RTL mode, where `scrollLeft` is inverted:
  ```typescript
  const scrollLeft = elScrollable.scrollLeft * (rtl ? -1 : 1);
  // Boundary delta > 1 compensates for sub-pixel fractional rounding on high-DPI displays
  const cutOffStart = scrollLeft > 1;
  const cutOffEnd = scrollLeft + elScrollable.clientWidth < elScrollable.scrollWidth - 1;

  if (cutOffEnd && cutOffStart) return setFadeSide("both");
  if (cutOffStart) return setFadeSide("start");
  if (cutOffEnd) return setFadeSide("end");
  ```

### 4. Backend & Concurrency Micro-Mechanics (Client-Side Async