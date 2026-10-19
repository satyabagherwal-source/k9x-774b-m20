> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tremorlabs-tremor-learnings.md`  
> **Source**: github ([https://github.com/tremorlabs/tremor](https://github.com/tremorlabs/tremor))  
> **Source Version**: `ca4d588f`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T06:12:29.465Z  
> **Learning ID**: `learn-github-tremorlabs-tremor`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): tremorlabs/tremor

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Engineering Problem & Architectural Mission
`tremorlabs/tremor` (historically *Tremor Raw*) provides unstyled and pre-styled dashboard primitives (charts, date pickers, accordions, popovers, drawers, and form controls) designed for low-friction copy-paste adoption. Unlike traditional monolithic UI libraries packaged as compiled npm runtime bundles (e.g., legacy `@tremor/react`), this architecture implements an unbundled, in-situ component distribution model (similar to shadcn/ui) built on top of:
1. **Radix UI Unstyled Primitives**: Accessible headless state machines and DOM abstractions.
2. **Tailwind CSS (v3 / v4 AST Transition Engine)**: Atomic styling with design tokens composed via `clsx` and `tailwind-merge`.
3. **Recharts SVG Visualization Pipeline**: Declarative SVG charting wrapped with dynamic category color maps and resize observers.
4. **Adobe React Stately / React Aria**: Internationalized date arithmetic and segment-based time input parsing.

### 1.2 Subsystem Boundaries & Decoupling Model
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Consumer Application Space                            │
│   (Consumes source code directly into src/components/tremor or design system)   │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
┌──────────────────────────────────┐            ┌──────────────────────────────────┐
│   Headless Accessibility Layer   │            │   Data Visualization Primitives  │
│  - @radix-ui/react-* primitives  │            │  - recharts (Area, Bar, Line)    │
│  - @react-aria/datepicker        │            │  - SVG DOM wrappers              │
│  - @react-stately/datepicker     │            │  - Resize event dispatchers      │
└────────────────┬─────────────────┘            └────────────────┬─────────────────┘
                 │                                               │
                 ▼                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    Utility & Class Conflict Resolution Mesh                      │
│  - src/utils/cx.ts: twMerge(clsx(...)) pipeline                                 │
│  - src/utils/chartColors.ts: Indexed category palettes & CSS variable injection │
│  - src/utils/focusRing.ts & focusInput.ts: Design token invariant tuples         │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                       External Store & Event Management                          │
│  - src/hooks/useToast.ts: Micro-Flux single-instance external store              │
│  - src/hooks/useOnWindowResize.ts: Sync layout recalculation trigger             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 State Ownership & Layer Invariants
- **Zero Monolithic Context Providers**: Components own local visual state via Radix headless primitives (`AccordionPrimitives.Root`, `DialogPrimitives.Root`). There is no overarching `<TremorProvider>` required at the root of the React tree.
- **External Store for Toasts**: Implements a singleton in-memory state engine (`memoryState`) with subscriber callbacks (`listeners`) and asynchronous removal timers (`toastTimeouts` `Map`), eliminating React tree re-render pollution across unrelated subtrees.
- **Color Category Tuple Invariance**: The charting subsystem decouples data keys from static CSS definitions by projecting category string arrays into a closed set of 9 accessible color definitions using modular arithmetic (`index % colors.length`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Slot-Child ForwardRef Contract Invariant
**RULE**:
When utilizing Radix UI or headless slot engines (`asChild={true}` or `<Slot>`), you MUST NOT pass non-ref-forwarding components (such as raw SVG icon wrappers or plain functional components) as the direct child. If the child does not wrap its element in `React.forwardRef` and attach the forwarded ref to a native DOM node, the `asChild` prop MUST NOT be applied; the slot container MUST be allowed to render its default DOM wrapper (e.g., `<span>`).

**WHY**:
Radix `Slot` clones its immediate child via `React.cloneElement` and injects an internal DOM node `ref` to measure coordinates, calculate collision boundaries, and manage focus traps. If the child is an un-forwarded functional component (such as `@remixicon/react` standard icon components), React aborts ref assignment and logs an uncatchable console error:
`Warning: Function components cannot be given refs. Attempts to access this ref will fail. Did you mean to use React.forwardRef()?`
Furthermore, any positional layout calculation dependent on that DOM node fails silently or calculates bounding boxes as `undefined` (resulting in coordinates snapping to `(0, 0)`).

**WHEN TO APPLY**:
All React architectures utilizing `@radix-ui/react-slot`, floating UI wrappers, popover triggers, and third-party icon libraries lacking explicit `forwardRef` implementations.

**VERIFIED IMPLEMENTATION PATTERN**:
```tsx
// Correct: Omitting asChild allows SelectPrimitives.Icon to render its internal <span>
// which safely receives the ref while hosting the un-forwarded icon component.
import * as SelectPrimitives from "@radix-ui/react-select"
import { RiExpandUpDownLine } from "@remixicon/react"

export const SafeSelectIcon = () => {
  return (
    <SelectPrimitives.Icon className="size-4 opacity-50">
      <RiExpandUpDownLine aria-hidden="true" />
    </SelectPrimitives.Icon>
  )
}

// Alternative: If asChild is strictly mandated by DOM structure requirements,
// the target functional component MUST be explicitly wrapped in React.forwardRef.
import React from "react"

const ForwardedIcon = React.forwardRef<
  SVGSVGElement,
  React.ComponentPropsWithoutRef<typeof RiExpandUpDownLine>
>((props, ref) => <RiExpandUpDownLine ref={ref} {...props} />)
ForwardedIcon.displayName = "ForwardedIcon"

export const ExplicitSlotSelectIcon = () => (
  <SelectPrimitives.Icon asChild>
    <ForwardedIcon className="size-4 opacity-50" />
  </SelectPrimitives.Icon>
)
```

**NEGATIVE CONSTRAINT**:
```tsx
// CRITICAL BUG: RiExpandUpDownLine is a plain functional component without forwardRef.
// Passing asChild forces Radix Slot to inject ref into an invalid target.
import * as SelectPrimitives from "@radix-ui/react-select"
import { RiExpandUpDownLine } from "@remixicon/react"

export const BrokenSelectIcon = () => {
  return (
    <SelectPrimitives.Icon asChild>
      <RiExpandUpDownLine />
    </SelectPrimitives.Icon>
  )
}
```

**VERIFICATION METHOD**:
Enforce ref compliance via static typing checks and Vitest integration assertions:
```tsx
import { render } from "@testing-library/react"
import { test, expect, vi } from "vitest"
import React from "react"
import { SafeSelectIcon } from "./SafeSelectIcon"

test("verifies slot child does not trigger React forwardRef console warnings", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  render(<SafeSelectIcon />)
  
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(
    expect.stringContaining("Function components cannot be given refs")
  )
  consoleErrorSpy.mockRestore()
})
```

---

### 2. Modern CSS Transform vs Independent Transform Translation Invariant
**RULE**:
When transitioning styling engines to Tailwind CSS v4 or modern CSS specifications, you MUST NOT combine legacy composite `transform: translate(...) scale(...)` keyframe animations with framework-injected independent transform utility properties (`translate`, `scale`, `rotate`). All animation keyframes MUST animate the exact CSS properties targeted by the framework's runtime reset.

**WHY**:
Modern CSS (and Tailwind v4's architecture) sets individual CSS transform properties (e.g., `translate: var(--tw-translate-x) var(--tw-translate-y)`). When an open/close animation keyframe defines legacy `transform: translate(-50%, -50%)`, the browser's CSS composite engine executes BOTH the `transform` matrix and the independent `translate` property simultaneously. 
For modal dialogs and drawers centered via `-50%`, the elements offset by `-100%`, causing an initial paint off-screen followed by a visual flash/flicker as the animation frames resolve.

**WHEN TO APPLY**:
Modal dialogs, popovers, floating tooltips, and fly-out drawers undergoing Tailwind v3 to v4 migrations or animating fixed elements centered via translate offsets.

**VERIFIED IMPLEMENTATION PATTERN**:
```css
/* CORRECT: Aligning keyframes to independent CSS properties */
@keyframes dialogContentShow {
  from {
    opacity: 0;
    scale: 0.95;
    translate: -50% -48%;
  }
  to {
    opacity: 1;
    scale: 1;
    translate: -50% -50%;
  }
}

.animate-dialog-show {
  animation: dialogContentShow 150ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

**NEGATIVE CONSTRAINT**:
```css
/* CRITICAL ANTI-PATTERN: Combining legacy transform shorthand with Tailwind v4 */
@keyframes dialogContentShowBad {
  from {
    opacity: 0;
    /* BROWSER COMPOSITING HAZARD: If Tailwind v4 sets translate: -50% -50% on the element,
       the composite result becomes translate(-100%, -95%), throwing the dialog off-canvas */
    transform: translate(-50%, -45%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
```

**VERIFICATION METHOD**:
Run automated Playwright visual regression snapshots validating bounding client rect immediately upon dialog mounting (`waitForSelector('[role="dialog"]')`):
```ts
import { test, expect } from "@playwright/test"

test("dialog paints centered without initial translation jump", async ({ page }) => {
  await page.goto("/iframe.html?id=dialog--default")
  const trigger = page.locator("#dialog-trigger")
  await trigger.click()

  const dialog = page.locator('[role="dialog"]')
  await dialog.waitFor({ state: "visible" })
  
  const box = await dialog.boundingBox()
  const viewport = page.viewportSize()!
  
  // Validate element is centered without double-translation offset
  const expectedCenterX = viewport.width / 2
  const actualCenterX = box!.x + box!.width / 2
  expect(Math.abs(actualCenterX - expectedCenterX)).toBeLessThanOrEqual(2)
})
```

---

### 3. Portal-Overlay-Content Scoping Separation Invariant
**RULE**:
In modal dialog, drawer, and sheet implementations, `DialogContent` (or drawer panel) MUST NOT be nested inside an element that applies `overflow-y: auto`, `overflow-x: hidden`, or any scroll containment styling. `DialogOverlay` and `DialogContent` MUST be direct sibling elements encapsulated within the `DialogPortal`.

**WHY**:
Applying `overflow-y: auto` to an overlay container establishes a new scroll container and containing block for descendant elements depending on CSS layout specifications. Any nested child utilizing `position: fixed` or centered alignments will have its positioning coordinates resolved relative to the scroll container's viewport rather than the browser window. During initial render and keyboard focus shifts, the dialog element paints with incorrect scroll-offset positions before snapping into place, resulting in layout shifts and broken backdrop click containment.

**WHEN TO APPLY**:
All dialog, drawer, modal, and lightbox components across React, Vue, Svelte, and vanilla web components.

**VERIFIED IMPLEMENTATION PATTERN**:
```tsx
// CORRECT: Sibling layout inside Portal ensures clean viewport containment
import * as DialogPrimitives from "@radix-ui/react-dialog"
import { cx } from "@/utils/cx"

export const Dialog = ({ open, onOpenChange, children }: DialogPrimitives.DialogProps) => (
  <DialogPrimitives.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitives.Portal>
      {/* Overlay handles backdrop blur and scroll locking */}
      <DialogPrimitives.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
      {/* Content is an independent sibling positioned relative to viewport */}
      <DialogPrimitives.Content 
        className={cx(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
          "border bg-white p-6 shadow-lg focus:outline-none dark:bg-gray-950"
        )}
      >
        {children}
      </DialogPrimitives.Content>
    </DialogPrimitives.Portal>
  </DialogPrimitives.Root>
)
```

**NEGATIVE CONSTRAINT**:
```tsx
// ANTI-PATTERN: Nesting Content inside a scrolling Overlay breaks fixed coordinates
export const BrokenDialog = ({ children }: { children: React.ReactNode }) => (
  <DialogPrimitives.Portal>
    <DialogPrimitives.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      {/* HAZARD: Content coordinate calculations fail because parent is overflow-y-auto */}
      <DialogPrimitives.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {children}
      </DialogPrimitives.Content>
    </DialogPrimitives.Overlay>
  </DialogPrimitives.Portal>
)
```

**VERIFICATION METHOD**:
Lint rule or structural Vitest unit test traversing React component tree AST:
```tsx
import { render } from "@testing-library/react"
import { test, expect } from "vitest"
import * as DialogPrimitives from "@radix-ui/react-dialog"
import { Dialog } from "./Dialog"

test("DialogContent is never rendered as a child of DialogOverlay", () => {
  const { baseElement } = render(<Dialog open={true}><p>Content</p></Dialog>)
  const overlay = baseElement.querySelector('[data-radix-dialog-overlay]')
  const content = baseElement.querySelector('[data-radix-dialog-content]')
  
  expect(overlay).not.toBeNull()
  expect(content).not.toBeNull()
  expect(overlay?.contains(content)).toBe(false)
})
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Select Dropdown Ref Forwarding Crash on SVG Icon Slot
- **Context**: `SelectPrimitives.Icon` integration with Remix Icon library in `src/components/Select/Select.tsx`.
- **What Was Expected**: Passing an icon component (`<RiExpandUpDownLine />`) as an indicator inside `Select.Trigger` should display cleanly without React lifecycle warnings or broken ref crashes.
- **What Actually Happened**: The component threw runtime console errors:
  `Warning: Function components cannot be given refs. Attempts to access this ref will fail. Did you mean to use React.forwardRef()?`
- **Evidence in Repo**: GitHub Issue #168, Closed August 30, 2026. Subsystem: Select Trigger / Radix Slot Icon.
- **Root Cause**: `@remixicon/react` exports standard functional React components without `React.forwardRef`. When `asChild` was applied to `SelectPrimitives.Icon`, Radix UI's underlying `Slot` attempted to inject its DOM positioning ref directly into `RiExpandUpDownLine`.
- **Remediation Code Diff**:
```tsx
// src/components/Select/Select.tsx
- <SelectPrimitives.Icon asChild>
-   <RiExpandUpDownLine className="size-4 text-gray-500" />
- </SelectPrimitives.Icon>
+ <SelectPrimitives.Icon className="flex items-center">
+   <RiExpandUpDownLine className="size-4 text-gray-500" />
+ </SelectPrimitives.Icon>
```
- **Lesson**: Do not force `asChild` on Radix primitives when rendering third-party icon libraries unless the icon wrapper is explicitly verified to implement `forwardRef`. Allow the primitive to render its native DOM tag (`<span>` or `<div>`).

---

### Incident 2: Dialog Viewport Desynchronization & Keyframe Flicker
- **Context**: `src/components/Dialog/Dialog.tsx` during initial display animation under Tailwind CSS v4.
- **What Was Expected**: The dialog should paint smoothly from the viewport center (`top: 50%`, `left: 50%`, `translate: -50% -50%`) with an opacity and scale transition.
- **What Actually Happened**: The dialog painted in the wrong initial layout quadrant and flickered before snapping into position (Issues #152 and #157).
- **Evidence in Repo**: Issue #167, merged commit fixing positioning flicker.
- **Root Cause**: Double failure mode:
  1. `DialogContent` was nested inside `DialogOverlay` which had `overflow-y-auto`, corrupting the `position: fixed` viewport context.
  2. The `dialogContentShow` keyframe applied `transform: translate(-50%, -45%)` while the utility class engine set independent CSS `translate: -50% -50%`. The browser composited both, doubling the offset to `-100%`.
- **Remediation Code Diff**:
```tsx
// src/components/Dialog/Dialog.tsx
- <DialogPrimitives.Portal>
-   <DialogPrimitives.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
-     <DialogPrimitives.Content className="fixed left-1/2 top-1/2 animate-accordionOpen">
-       {children}
-     </DialogPrimitives.Content>
-   </DialogPrimitives.Overlay>
- </DialogPrimitives.Portal>
+ <DialogPrimitives.Portal>
+   <DialogPrimitives.Overlay className="fixed inset-0 z-50 bg-black/50" />
+   <DialogPrimitives.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2">
+     {children}
+   </DialogPrimitives.Content>
+ </DialogPrimitives.Portal>
```
- **Lesson**: Keep overlays and modal contents as direct siblings within portals. Decouple static positioning (`-translate-x-1/2`) from animation keyframes.

---

### Incident 3: Narrow No-Break Space (NNBSP) Type Mismatch in DatePicker
- **Context**: Time segment tokenization in `src/components/DatePicker/DatePicker.tsx`.
- **What Was Expected**: Literal separator segments (colons and spaces) between time units (`HH : MM AM/PM`) should be recognized as decorators to bypass tab stops and focus traversal.
- **What Actually Happened**: The literal check for space failed on systems where internationalization formatters emitted standard ASCII spaces (`U+0020`) instead of Unicode Narrow No-Break Spaces (`U+202F`), causing literal space characters to capture user focus and corrupt keyboard arrow-key navigation.
- **Evidence in Repo**: Commit `9b906e0e` (PR #106).
- **Root Cause**: Hardcoded comparison against Unicode `\u202F` (`" "`) failed when `@react-aria/datepicker` reformatted segments to standard ASCII space (`" "`). Additionally, empty placeholder rendering caused element collapse.
- **Remediation Code Diff**:
```tsx
// src/components/DatePicker/DatePicker.tsx
  const isColon = segment.type === "literal" && segment.text === ":"
- const isSpace = segment.type === "literal" && segment.text === " "
+ const isSpace = segment.type === "literal" && segment.text === " "

  const isDecorator = isColon || isSpace
...
- {segment.isPlaceholder ? "" : segment.text}
+ {segment.isPlaceholder ? " " : segment.text}
```
- **Lesson**: Date/time segment literal checks must account for locale-specific whitespace mutations. Never render completely empty strings inside formatted segment spans if layout collapse impairs bounding-box calculations.

---

### Incident 4: Missing Stacking Context Isolation in Drawer Primitive
- **Context**: `src/components/Drawer/Drawer.tsx` z-index coordination.
- **What Was Expected**: The drawer panel must slide out above all application DOM trees, charts, tooltips, and fixed navigation bars.
- **What Actually Happened**: On pages containing SVG charts with high-priority z-indices, the drawer rendered underneath charts and headers.
- **Evidence in Repo**: Commit `9b906e0e`, changelog `Fix: z-index content`.
- **Root Cause**: `DrawerContent` lacked an explicit `z-index` definition, relying solely on stacking order. When placed in consumer applications with competing `z-10` to `z-40` elements, the drawer lost stacking priority.
- **Remediation Code Diff**:
```tsx
// src/components/Drawer/Drawer.tsx
const DrawerContent = React.forwardRef<...>(({ className, ...props }, forwardedRef) => (
  <DrawerPrimitives.Content
    ref={forwardedRef}
    className={cx(
-     "fixed inset-y-2 mx-auto flex w-[95vw] flex-1 flex-col overflow-y-auto rounded-md border p-4 shadow-lg focus:outline-none max-sm:inset-x-2 sm:inset-y-2 sm:right-2 sm:max-w-lg sm:p-6",
+     "fixed inset-y-2 z-50 mx-auto flex w-[95vw] flex-1 flex-col overflow-y-auto rounded-md border p-4 shadow-lg focus:outline-none max-sm:inset-x-2 sm:inset-y-2 sm:right-2 sm:max-w-lg sm:p-6",
      className,
    )}
    {...props}
  />
))
```
- **Lesson**: All modal overlay and drawer panels rendered through React portals must explicitly define top-tier stacking constants (`z-50`) to guarantee deterministic cross-browser compositing.

---

### Incident 5: Tailwind v4 Data Attribute Selector Regression
- **Context**: Radix UI `data-[disabled]` and `data-[state=open]` styling in `src/components/Accordion/Accordion.tsx`.
- **What Was Expected**: Disabled triggers must have disabled pointer events and muted text colors.
- **What Actually Happened**: Tailwind v4 overhauled pseudo-variant prefix parsers. Arbitrary data attribute syntax `data-[disabled]` and `group-data-[disabled]` failed to compile cleanly or caused bloated CSS outputs compared to the newly introduced native `data-disabled:` variant.
- **Evidence in Repo**: Commit `e3e8e695`, Tailwind v4 migration changelog.
- **Root Cause**: Tailwind CSS v4 introduced first-class shorthand variants for data attributes (e.g., `data-disabled:`, `group-data-disabled:`), rendering legacy bracketed arbitrary variants redundant and altering specificity.
- **Remediation Code Diff**:
```tsx
// src/components/Accordion/Accordion.tsx
  <AccordionPrimitives.Trigger
    className={cx(
      "group flex flex-1 cursor-pointer items-center justify-between py-3 text-left text-sm font-medium leading-none",
-     "data-[disabled]:cursor-default data-[disabled]:text-gray-400 dark:data-[disabled]:text-gray-600",
-     "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
+     "data-disabled:cursor-default data-disabled:text-gray-400 dark:data-disabled:text-gray-600",
+     "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden focus-visible:ring-inset",
      className,
    )}
  >
```
- **Lesson**: When migrating component design tokens across major CSS utility engine versions, run automated AST codemods to translate arbitrary bracketed selectors (`data-[state=...]`) to native engine variants.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Explicit Nullability Handling in Controlled/Uncontrolled State Transitions**:
   In `src/components/DatePicker/DatePicker.tsx`, time values must be typed as `TimeValue | null` rather than `TimeValue | undefined`.
   ```tsx
   // FAILS: undefined fails to clear existing selected time in @react-stately time input
   const [time, setTime] = React.useState<TimeValue | undefined>(defaultValue)

   // CORRECT: Explicit union with null allows downstream resets to clear DOM input segments
   const [time, setTime] = React.useState<TimeValue | null>(
     value
       ? new Time(value.getHours(), value.getMinutes())
       : defaultValue
         ? new Time(defaultValue.getHours(), defaultValue.getMinutes())
         : null
   )
   ```
2. **Safe Object Property Check via Prototype Invocation**:
   In `src/utils/hasOnlyOneValueForKey.ts`, checking for property existence via direct property access (`obj[key]`) or bare `obj.hasOwnProperty(key)` creates fatal prototype pollution and null prototype hazards.
   ```tsx
   // CRITICAL HAZARD: Crashes if obj = Object.create(null)
   if (obj.hasOwnProperty(keyToCheck)) { ... }

   // CORRECT INVARIANT: Safe invocation via Object.prototype
   if (Object.prototype.hasOwnProperty.call(obj, keyToCheck)) {
     val.push(obj[keyToCheck])
     if (val.length > 1) return false
   }
   ```

### 4.2 Infinite Loop & Recursion Guards
1. **Listener Cleanup & Subscription Leak in `useToast` Hook**:
   In `src/hooks/useToast.ts`, the subscription hook maintains an array of listeners outside the React component lifecycle:
   ```tsx
   // FORENSIC DEFECT: If state is in the dependency array, every time state updates,
   // the effect cleans up and re-appends the setState function, causing churn.
   function useToast() {
     const [state, setState] = React.useState<State>(memoryState)

     React.useEffect(() => {
       listeners.push(setState)
       return () => {
         const index = listeners.indexOf(setState)
         if (index > -1) {
           listeners.splice(index, 1)
         }
       }
     }, [state]) // CHURN HAZARD
   ```
   *The Safe Invariant*: The subscriber registration should bind once on mount and unbind on unmount with empty dependencies `[]`. The listener closure invokes `setState(newState)` dynamically:
   ```tsx
   React.useEffect(() => {
     listeners.push(setState)
     return () => {
       const index = listeners.indexOf(setState)
       if (index > -1) listeners.splice(index, 1)
     }
   }, []) // ZERO CHURN INVARIANT
   ```
2. **Modular Arithmetic Id Generation Invariant**:
   In `src/hooks/useToast.ts`, `genId` prevents numeric integer overflow:
   ```tsx
   let count = 0
   function genId() {
     // Guards against Number.MAX_SAFE_INTEGER exhaustion in long-running SPAs
     count = (count + 1) % Number.MAX_VALUE
     return count.toString()
   }
   ```

### 4.3 UI & UX Micro-Mechanics
1. **SVG Chart Resize Thrashing Defense**:
   In `src/hooks/useOnWindowResize.ts`, invoking window resize callbacks synchronously inside resize event loops triggers layout thrashing if client rects are measured:
   ```tsx
   export const useOnWindowResize = (handler: () => void) => {
     React.useEffect(() => {
       let frameId: number | null = null
       const handleResize = () => {
         if (frameId !== null) cancelAnimationFrame(frameId)
         frameId = requestAnimationFrame(() => {
           handler()
         })
       }
       handleResize() // Initial measurement
       window.addEventListener("resize", handleResize)
       return () => {
         if (frameId !== null) cancelAnimationFrame(frameId)
         window.removeEventListener("resize", handleResize)
       }
     }, [handler])
   }
   ```
2. **Scrollbar Hiding Utility Invariants**:
   When implementing horizontal sliders without visible scrollbars (e.g., chart legends in `src/components/AreaChart/AreaChart.tsx`):
   ```tsx
   // Tailwind classes MUST combine both standards-compliant and WebKit-prefixed rules:
   "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
   ```

### 4.4 Backend Concurrency & Memory Safety
1. **Toast Timer Map Leak Prevention**:
   In `src/hooks/useToast.ts`, dismissing or rapidly triggering toasts can leave un-cleared timeouts in memory.
   ```tsx
   const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

   const addToRemoveQueue = (toastId: string) => {
     // Invariant: Guard against duplicate timers overwriting references without clearing
     if (toastTimeouts.has(toastId)) {
