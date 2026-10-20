> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mui-base-ui-learnings.md`  
> **Source**: github ([https://github.com/mui/base-ui](https://github.com/mui/base-ui))  
> **Source Version**: `bf66e3ad`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T13:18:45.349Z  
> **Learning ID**: `learn-github-mui-base-ui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): mui/base-ui

---

## 1. Executive Forensic Architecture & System Mechanics

`mui/base-ui` is an unstyled, headless UI component architecture for React designed to solve the structural tension between absolute DOM accessibility (WAI-ARIA 1.2/1.3 specifications), cross-browser rendering lifecycles (browser paint timings, CSS transitions, View Transitions API), and React’s concurrent reconciliation pipeline.

```
+---------------------------------------------------------------------------------------+
|                                    Base UI Core Root                                  |
|  +-------------------------+  +---------------------------+  +---------------------+  |
|  | Context & State Stores  |  | Compound Child Invariants |  | ARIA State Mapping |  |
|  | (useStore / Actions)    |  | (Trigger, Popup, Item)    |  | (Data Attributes)   |  |
|  +------------+------------+  +-------------+-------------+  +----------+----------+  |
+---------------|-----------------------------|---------------------------|-------------+
                |                             |                           |
                v                             v                           v
+---------------------------------------------------------------------------------------+
|                                 DOM & Lifecycle Layer                                 |
|  +--------------------------------+  +---------------------------------------------+  |
|  | FloatingPortal / PortalNode    |  | FloatingFocusManager                        |  |
|  | - Container Ref Resolution     |  | - Modal Boundary Trap / Guard Sentinels     |  |
|  | - createFlushBeforePaint Queue |  | - Synchronous Focus Handoff                 |  |
|  +--------------------------------+  +---------------------------------------------+  |
|  +---------------------------------------------------------------------------------+  |
|  | Event Normalization & Shadow DOM Boundary Traversal                             |  |
|  | - getTarget(event.nativeEvent) composedPath resolution                          |  |
|  | - isInteractiveElement guard filters                                            |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
```

### Architectural Subsystem Decoupling & Invariants
1. **Headless Compound Composition (`Root`, `Trigger`, `Portal`, `Positioner`, `Popup`, `Item`)**:
   - Subsystem state resides in top-level context stores or root custom hooks (`useComboboxRootContext`, `MenuRoot`).
   - Children communicate downward through tightly bounded contexts; child elements project state outward via semantic data-attributes (`[data-state]`, `[data-open]`, `[data-indeterminate]`, `[data-highlighted]`) instead of hardcoded class names or inline layout styles.
2. **Pre-Paint DOM Synchronization Engine (`createFlushBeforePaint`)**:
   - Solves the out-of-order execution hazard between React layout effects (`useIsoLayoutEffect`) and native browser paint/animation frames.
   - Decouples discrete execution batches (e.g., animation completion flushes vs. portal container ref attachments) so that asynchronous cascading renders never cause visual flash-of-unstyled-content (FOUC), layout thrashing, or cancel active browser View Transitions (`document.startViewTransition`).
3. **Modal Focus Confinement Subsystem (`FloatingFocusManager`)**:
   - Employs hidden sentinel elements (`mergedAfterGuardRef`, `beforeGuardRef`) flanking portal boundaries.
   - Enforces synchronous DOM focus handoffs during keyboard navigation (`Tab` / `Shift+Tab`) to prevent native browser focus defaults from leaking onto `document.body` or parent applications.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Pre-Paint Execution Isolation Rule
**RULE**: Any synchronous DOM layout mutation that must execute prior to the browser paint phase and outside React's passive effect pipeline MUST be scheduled inside a dedicated microtask checkpoint using `ReactDOM.flushSync()`. Furthermore, conflicting state updates (such as CSS animation terminations and portal target ref bindings) MUST utilize isolated queue instances to prevent batch-coalescing race conditions.

**WHY**: When callbacks run in a shared microtask queue, an animation completion callback committing earlier in the batch can unmount or mutate a DOM container before a subsequent portal container resolution read commits. This causes null container dereferences, intermediate single-frame flashes (FOUC), or the abortive termination of active native View Transitions (`document.startViewTransition`).

**WHEN TO APPLY**:
- React 18+ and React 19 portals reading container refs (`React.RefObject<HTMLElement>`) that mount conditionally or asynchronously.
- CSS enter/exit transition orchestrations tracking `onAnimationEnd` / `onTransitionEnd`.
- Popover, Modal, and Floating positioned elements calculating layout before the browser composites the frame.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/react/src/internals/createFlushBeforePaint.ts
'use client';
import * as ReactDOM from 'react-dom';

/**
 * Creates an isolated queue that batches callbacks to run synchronously
 * before the browser paints, avoiding intermediate frame flashes without
 * colliding with other queued updates.
 */
export function createFlushBeforePaint() {
  let pendingCallbacks: Array<() => void> | null = null;

  return function flushBeforePaint(fn: () => void) {
    if (!pendingCallbacks) {
      const callbacks: Array<() => void> = [];
      pendingCallbacks = callbacks;
      queueMicrotask(() => {
        pendingCallbacks = null;
        ReactDOM.flushSync(() => {
          for (const callback of callbacks) {
            callback();
          }
        });
      });
    }
    pendingCallbacks.push(fn);
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Shared global queue or requestAnimationFrame deferral
let globalQueue: Array<() => void> = [];
export function unsafeFlushBeforePaint(fn: () => void) {
  globalQueue.push(fn);
  // FAILS: Collides across heterogeneous consumers (e.g. animation end + portal mounting)
  // FAILS: If requestAnimationFrame is used, browser paints an unstyled/misplaced intermediate frame
  requestAnimationFrame(() => {
    while (globalQueue.length) {
      globalQueue.shift()!();
    }
  });
}
```

**VERIFICATION METHOD**:
Verify with Vitest and Playwright/Chromium that intermediate paint frames do not occur and that multiple queued callbacks in disparate subsystems maintain isolation:
```typescript
test('mounts inside an ancestor ref before the next paint without frame leaks', async () => {
  let show = () => {};
  function Test() {
    const [visible, setVisible] = React.useState(false);
    show = () => setVisible(true);
    const container = React.useRef<HTMLDivElement>(null);
    return (
      <div ref={container} data-testid="container">
        {visible && (
          <FloatingPortal container={container}>
            <div data-testid="content" />
          </FloatingPortal>
        )}
      </div>
    );
  }
  await renderPortal(<Test />, { strict: false });
  const mountedBeforePaint = await new Promise<boolean>((resolve) => {
    requestAnimationFrame(() => ReactDOM.flushSync(show));
    requestAnimationFrame(() => {
      resolve(screen.getByTestId('container').contains(screen.queryByTestId('content')));
    });
  });
  expect(mountedBeforePaint).toBe(true);
});
```

---

### 2. Modal Focus Sentinel Synchronous Capture Rule
**RULE**: Accessible modal dialog and popup boundary guard sentinels (focus traps) MUST transfer focus to the respective boundary target element *synchronously* inside the sentinel’s `onFocus` event handler. Boundary guards MUST NOT defer focus redirection to `requestAnimationFrame`, `setTimeout`, or microtasks.

**WHY**: When a user navigates via keyboard (`Tab` or `Shift+Tab`), browser focus transitions occur at hardware input speeds. If sentinel focus wrapping is deferred to `requestAnimationFrame` (~16.6ms later), rapid successive keystrokes hit the sentinel while focus redirection is pending. The subsequent native `Tab` event then advances focus out of the sentinel into the document background behind the modal, shattering the WAI-ARIA modal invariant.

**WHEN TO APPLY**:
- Floating popups, menus, alert dialogs, drawers, and modal sheets using sentinel DOM boundaries.
- Any trap component implementing WAI-ARIA modal behavior where `aria-modal="true"`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/react/src/utils/popups/focus/FloatingFocusManager.tsx
<span
  tabIndex={0}
  aria-hidden="true"
  data-floating-ui-focus-guard=""
  style={visuallyHidden}
  ref={mergedAfterGuardRef}
  onFocus={(event) => {
    if (modal) {
      const els = getTabbableContent();
      // MUST be synchronous: zero deferral ensures rapid keydown events cannot escape
      els[0]?.focus();
    } else if (portalContext?.portalNode) {
      if (closeOnFocusOut) {
        preventReturnFocusRef.current = true;
      }
    }
  }}
/>
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Deferring focus trapping via rAF or enqueueFocus
onFocus={(event) => {
  if (modal) {
    const els = getTabbableContent();
    // NEVER DO THIS: Queuing focus across frame boundaries leaks keyboard focus
    // if a second Tab keydown arrives before the next rAF tick.
    void enqueueFocus(els[0]); // Internal rAF wrapper: LEAKS FOCUS!
  }
}}
```

**VERIFICATION METHOD**:
Mock `window.requestAnimationFrame` to a no-op or stub, simulate back-to-back `userEvent.tab()` invocations within the same JavaScript execution turn, and assert that focus never leaves the modal boundary:
```typescript
test('wraps focus within the same frame as the Tab', async () => {
  render(<App modal />);
  fireEvent.click(screen.getByTestId('reference'));
  await flushMicrotasks();

  act(() => screen.getByTestId('three').focus());
  expect(screen.getByTestId('three')).toHaveFocus();

  // Sabotage rAF: must still wrap synchronously
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);

  await userEvent.tab();
  expect(screen.getByTestId('one')).toHaveFocus();

  await userEvent.tab({ shift: true });
  expect(screen.getByTestId('three')).toHaveFocus();
});
```

---

### 3. Asymmetric State Attribute Exclusivity Rule
**RULE**: Compound component data-attribute reflection mappers MUST NOT emit contradictory or mutually exclusive boolean data attributes simultaneously. For tri-state values (e.g., indeterminate, checked, unchecked), intermediate states MUST omit concrete opposing attributes (such as `data-unchecked` or `data-checked`) entirely from the DOM serialization output.

**WHY**: CSS selectors in modern design systems depend on attribute existence (e.g., `[data-checked]`, `[data-unchecked]`). If an indeterminate checkbox emits `{ 'data-unchecked': '' }` alongside `{ 'data-indeterminate': '' }`, user stylesheets applying `:where([data-unchecked])` will trigger visual conflicts, icon collisions, and incorrect accessibility reporting in screen readers.

**WHEN TO APPLY**:
- Form control state mappings (Checkboxes, Tri-state switches, Tree-view selection).
- Loading states (e.g., Avatar image status where `imageLoadingStatus` must not leak raw internal tokens).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/react/src/checkbox/utils/getCheckboxStateAttributesMapping.ts
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { CheckboxRootState } from '../root/CheckboxRoot';
import * as CheckboxRootDataAttributes from '../root/CheckboxRootDataAttributes';

export function getCheckboxStateAttributesMapping(
  state: CheckboxRootState,
): StateAttributesMapping<CheckboxRootState> {
  return {
    checked(value): Record<string, string> {
      // Invariant: When indeterminate, omit both checked and unchecked attributes
      if (state.indeterminate) {
        return {};
      }

      if (value) {
        return { [CheckboxRootDataAttributes.checked]: '' };
      }

      return { [CheckboxRootDataAttributes.unchecked]: '' };
    },
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly serializing boolean value regardless of indeterminate state
checked(value) {
  // FAILS: When state.indeterminate === true, value is false or undefined,
  // causing data-unchecked to leak onto the DOM simultaneously with data-indeterminate!
  return value
    ? { 'data-checked': '' }
    : { 'data-unchecked': '' };
}
```

**VERIFICATION METHOD**:
Unit test the mapping dictionary against every truth table state:
```typescript
expect(getCheckboxStateAttributesMapping({ indeterminate: true, checked: false }).checked(false)).toEqual({});
expect(getCheckboxStateAttributesMapping({ indeterminate: false, checked: true }).checked(true)).toEqual({ 'data-checked': '' });
expect(getCheckboxStateAttributesMapping({ indeterminate: false, checked: false }).checked(false)).toEqual({ 'data-unchecked': '' });
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Modal Focus Leak on Fast Tab Keypress (BUG-BASEUI-6036)
- **Context**: Modal popup boundary trap management (`packages/react/src/utils/popups/focus/FloatingFocusManager.tsx`).
- **What Was Expected**: Pressing `Tab` on the final focusable element in a modal popup immediately wraps focus to the first focusable element inside the modal.
- **What Actually Happened**: When users pressed `Tab` faster than the screen's refresh rate (under 16.6ms), the second keystroke escaped the modal entirely, landing on the underlying browser document background.
- **Evidence in Repo**: Commit `bd3f1494`, Issue #6036, PR #6036.
- **Root Cause**: The sentinel guard's `onFocus` handler called `enqueueFocus()`, which scheduled the focus call inside `requestAnimationFrame`. If the subsequent `Tab` arrived prior to the next rAF tick, the sentinel still held focus, causing the browser’s default tab action to select the next tabbable element in the outer document.
- **Remediation Code Diff**:
```typescript
<<<< packages/react/src/utils/popups/focus/FloatingFocusManager.tsx
           onFocus={(event) => {
             if (modal) {
               const els = getTabbableContent();
-              // enqueueFocus returns a rAF-cancel function we don't need here.
-              void enqueueFocus(els[els.length - 1]);
+              els[els.length - 1]?.focus();
             } else if (portalContext?.portalNode) {
@@ -1050,8 +1049,7 @@
           ref={mergedAfterGuardRef}
           onFocus={(event) => {
             if (modal) {
-              // enqueueFocus returns a rAF-cancel function we don't need here.
-              void enqueueFocus(getTabbableContent()[0]);
+              getTabbableContent()[0]?.focus();
             } else if (portalContext?.portalNode) {
```
- **Lesson**: Do not introduce asynchronous scheduling (rAF/timers) into DOM input focus containment guards. Focus redirection must occur synchronously within the event dispatch cycle.

---

### Incident 2: Portal Container Ref Race Condition & View Transition Cancellation (BUG-BASEUI-5963)
- **Context**: Portal mounting into unattached ancestor or sibling refs (`packages/react/src/utils/popups/portal/FloatingPortal.tsx`, `packages/react/src/internals/createFlushBeforePaint.ts`).
- **What Was Expected**: A portal passing a React ref as its target container (`<Menu.Portal container={containerRef}>`) should wait until the container DOM node is mounted, then attach seamlessly before the initial paint without intermediate fallback rendering to `document.body`.
- **What Actually Happened**: The portal evaluated `containerProp.current` inside layout effects before ancestor/sibling DOM nodes attached their refs. Falling back immediately caused temporary mounting into `document.body` or threw warnings; using a global flush queue caused animation end callbacks to run prematurely, clearing containers and canceling active browser View Transitions (`document.startViewTransition`).
- **Evidence in Repo**: Commit `bf66e3ad`, Issues #5963, #979, #5481.
- **Root Cause**: React executes layout effects from child to parent. When a portal rendered before or inside a ref target, `containerRef.current` was `null` during the portal's initial layout effect. Attempting immediate resolution forced fallbacks. Conversely, synchronous flushing aborted View Transitions because `flushSync` forces React to complete the work synchronously instead of deferring while the transition snapshot prepares.
- **Remediation Code Diff**:
```typescript
<<<< packages/react/src/utils/popups/portal/FloatingPortal.tsx
+// A separate queue: a shared batch could run an animation completion that removes the container
+// before this read commits.
+const flushContainerUpdates = createFlushBeforePaint();

+  const [containerCheck, setContainerCheck] = React.useState(0);
+  const pendingResolveRef = React.useRef<(() => void) | null>(null);
+
+  // Must run before the effect below, or a mount would consume its own pending resolve.
+  useIsoLayoutEffect(() => {
+    const resolve = pendingResolveRef.current;
+    if (resolve) {
+      pendingResolveRef.current = null;
+      // The retry committed, so refs are attached. Resolve after cascading layout updates.
+      flushContainerUpdates(resolve);
+    }
+  }, [containerCheck]);

-    const resolvedContainer =
-      (containerProp && (isNode(containerProp) ? containerProp : containerProp.current)) ??
-      parentPortalNode ??
-      document.body;
+    if (containerProp && !isNode(containerProp) && !containerProp.current) {
+      // Ancestor and later sibling refs attach after this effect. Wait for the retry to commit:
+      // React defers it while it prepares a ViewTransition, and flushSync would cancel that.
+      pendingResolveRef.current = resolveContainer;
+      setContainerCheck((value) => value + 1);
+    } else {
+      resolveContainer();
+    }
```
- **Lesson**: Coordinate unresolved DOM refs across React's bottom-up layout phase by forcing a state-driven retry (`setContainerCheck`) coupled with an isolated pre-paint queue (`createFlushBeforePaint`). This preserves View Transition preparation while guaranteeing pre-paint DOM insertion.

---

### Incident 3: Stale Escape Keydown State Freezing Initial Menu Keyboard Focus (BUG-BASEUI-6033)
- **Context**: Menu trigger keyboard handling and initial auto-focus orchestration (`packages/react/src/menu/root/MenuRoot.tsx`).
- **What Was Expected**: If an unfocused or closed trigger element receives an `Escape` keystroke, and the user subsequently presses `Enter` or `ArrowDown`, the menu must open and move focus to the first menu item.
- **What Actually Happened**: The popup opened, but focus remained stuck on the trigger button. `document.activeElement` refused to transition to the first item.
- **Evidence in Repo**: Issue #6033.
- **Root Cause**: The keyboard navigation state machine retained an unhandled `Escape` event flag in internal refs. When `Enter` opened the menu, the auto-focus logic checked whether the opening interaction was initiated by keyboard, but encountered a lingering "escape was pressed" flag that suppressed initial item selection.
- **Remediation Code Diff**:
```typescript
<<<< packages/react/src/menu/trigger/MenuTrigger.tsx
 function handleKeyDown(event: React.KeyboardEvent) {
+  if (event.key === 'Escape' && !store.state.open) {
+    // Clear transient keyboard navigation flags; closed trigger must not retain escape suppression
+    store.context.lastOpenReasonRef.current = null;
+    return;
+  }
```
- **Lesson**: Input event state machines must guard state transitions against events fired when inactive. Transient flags (e.g., last key pressed) must be cleared or ignored when the component is closed.

---

### Incident 4: Double-Fire Cascade in CSS Transition Lifecycle During StrictMode (BUG-BASEUI-5481)
- **Context**: Animation and transition state machine completion (`packages/react/src/internals/useAnimationsFinished.ts`).
- **What Was Expected**: `onOpenChangeComplete(true)` must fire exactly once after the CSS popup enter animation terminates.
- **What Actually Happened**: React 18/19 StrictMode mounting mechanics triggered multiple effect setup/cleanup cycles. When an ancestor container ref shifted or re-rendered, `onOpenChangeComplete` fired multiple times or was skipped entirely.
- **Evidence in Repo**: Commit `bf66e3ad`, Issue #5481.
- **Root Cause**: Global callbacks for finished animations were scheduled in an un-isolated flush queue. Layout effect replays in StrictMode flushed incomplete callbacks before DOM transition attributes stabilized.
- **Remediation Code Diff**:
```typescript
<<<< packages/react/src/internals/useAnimationsFinished.ts
-let pendingCallbacks: Array<() => void> | null = null;
-function flushBeforePaint(fn: () => void) { ... }
+import { createFlushBeforePaint } from './createFlushBeforePaint';
+const flushBeforePaint = createFlushBeforePaint();
```
- **Lesson**: Encapsulate lifecycle queue state in distinct factory instances (`createFlushBeforePaint()`) rather than module-level singletons to prevent cross-component race hazards and StrictMode effect replay side effects.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Sentinel Equality (`NO_ACTIVE_VALUE`)**: To distinguish between "no item is highlighted" and "an item with value `undefined` or `null` is highlighted", use a unique runtime `Symbol`.
```typescript
// packages/react/src/combobox/root/utils/constants.ts
export const NO_ACTIVE_VALUE = Symbol('none');

export const INITIAL_LAST_HIGHLIGHT: { value: any; index: number } = {
  value: NO_ACTIVE_VALUE,
  index: -1,
} as const;
```
*Hazard Prevented*: Never check `if (!highlightedValue)`. If an option item has a value of `""` (empty string) or `0`, implicit falsy conversion treats a valid selection as unselected. Check `if (highlightedValue === NO_ACTIVE_VALUE)`.

- **Ref Unwrapping & DOM Node Type Guards**:
```typescript
// packages/react/src/utils/popups/portal/FloatingPortal.tsx
const resolvedContainer =
  (containerProp && (isNode(containerProp) ? containerProp : containerProp.current)) ??
  parentPortalNode ??
  document.body;
```
*Hazard Prevented*: A prop can be a raw DOM element (`HTMLElement`), a React ref object (`{ current: HTMLElement }`), or `null`. Calling `.current` on a bare DOM node returns `undefined`, which silently falls back to `document.body` instead of throwing an error. The type guard `isNode(containerProp)` must precede ref dereferencing.

---

### 2. Infinite Loop & Recursion Guards
- **Layout Effect Re-render Loops via Conditional Check Increments**:
```typescript
// packages/react/src/utils/popups/portal/FloatingPortal.tsx
const [containerCheck, setContainerCheck] = React.useState(0);
const pendingResolveRef = React.useRef<(() => void) | null>(null);

useIsoLayoutEffect(() => {
  const resolve = pendingResolveRef.current;
  if (resolve) {
    pendingResolveRef.current = null;
    flushContainerUpdates(resolve);
  }
}, [containerCheck]);
```
*Invariant Proof*: `pendingResolveRef.current` is set to `null` immediately upon consumption inside the layout effect. Even if `flushContainerUpdates(resolve)` triggers a state re-render elsewhere, `pendingResolveRef.current` is now `null`, terminating the update cascade in exactly one hop ($O(1)$ iteration depth).

---

### 3. UI & UX Micro-Mechanics
- **Shadow DOM Event Retargeting & Event Interception**:
```typescript
// packages/react/src/combobox/utils/handleInputPress.ts
export function handleInputPress(
  event: React.MouseEvent<HTMLElement> & { baseUIHandlerPrevented?: boolean | undefined },
  store: ComboboxStore,
  disabled: boolean,
  shouldIgnoreTarget?: ((target: Element | null) => boolean) | undefined,
) {
  if (event.baseUIHandlerPrevented) {
    return;
  }

  // Crosses Shadow Root boundaries safely
  const target = getTarget(event.nativeEvent);
  const targetElement = isElement(target) ? target : null;
  if (
    targetElement !== event.currentTarget &&
    (shouldIgnoreTarget?.(targetElement) || isInteractiveElement(targetElement))
  ) {
    // Click was on a button/link inside the combobox trigger; abort opening combobox!
    return;
  }

  event.preventDefault();
  if (disabled) {
    return;
  }
  store.context.inputRef.current?.focus();
}
```
*UX Micro-Mechanic*: In complex composite triggers containing buttons or remove tags (e.g., multiselect chips), clicking a chip button must not trigger the parent combobox dropdown. Using `getTarget(event.nativeEvent)` extracts the real event target across Web Component / Shadow DOM boundaries (`composedPath()[0]`), verifying whether the click landed on an interactive element before calling `event.preventDefault()`.

---

### 4. Backend Concurrency & Memory Safety
- **Unbounded Memory Leak Prevention in Pre-Paint Microtasks**:
```typescript
// packages/react/src/internals/createFlushBeforePaint.ts
export function createFlushBeforePaint() {
  let pendingCallbacks: Array<() => void> | null = null;

  return function flushBeforePaint(fn: () => void) {
    if (!pendingCallbacks) {
      const callbacks: Array<() => void> = [];
      pendingCallbacks = callbacks;
      queueMicrotask(() => {
        // Clear reference before executing to allow GC and accept new microtasks
        pendingCallbacks = null;
        ReactDOM.flushSync(() => {
          for (const callback of callbacks) {
            callback();
          }
        });
      });
    }
    pendingCallbacks.push(fn);
  };
}
```
*Memory Invariant*: Setting `pendingCallbacks = null` *prior* to executing the array callbacks guarantees that if any callback itself enqueues an item into `flushBeforePaint`, it triggers a new microtask batch rather than mutating an active iterating array, avoiding infinite iterations and array leakages.

---

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Intl.Collator Normalization & Selection Matching Guard**:
```typescript
// packages/react/src/combobox/root/utils/index.ts
export function createSingleSelectionCollatorFilter(
  collatorFilter: Filter,
  itemToStringLabel?: FilterItemToString,
  selectedValue?: any,
) {
  return (item: any, query: string) => {
    if (item == null) {
      return false;
    }
    if (!query) {
      return true;
    }

    const selectedValueToString = itemToStringLabel?.selected ?? itemToStringLabel;
    const selectedString =
      selectedValue != null ? stringifyAsLabel(selectedValue, selectedValueToString) : '';

    // Handle case-insensitive matching consistently
    if (
      selectedString &&
      collatorFilter.contains(selectedString, query) &&
      selectedString.length === query.length
    ) {
      return true;
    }

    return collatorFilter.contains(item, query, itemToStringLabel);
  };
}
```
*Defect Prevented*: When a combobox is opened with an existing selection, the input display text equals the selected item's label. Standard filters would filter out all options except the selected one. By comparing `selectedString.length === query.length` along with collator containment, it detects that the user is viewing the current selection rather than typing a new filter query, keeping the full option list visible for browsing.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Boundary Layout**: Strict compound component structure (`Root`, `Trigger`, `Portal`, `Positioner`, `Popup`).
- **State Segregation**: Headless components use internal state machines decoupled from styling. React Context acts as an immutable transport layer for dispatch channels (`store.context`), while state mutations are emitted outward via `data-*` attributes.

### 2. Core Abstractions
- `useIsoLayoutEffect`: Polymorphic hook mapping to `React.useLayoutEffect` on the client and `React.useEffect` (or no-op) during SSR, eliminating hydration mismatch warnings.
- `createFlushBeforePaint`: Microtask batching boundary wrapping `ReactDOM.flushSync`.
- `StateAttributesMapping<T>`: Pure dictionary functional transforms mapping internal boolean/enum states into DOM data attributes.

### 3. Error Handling
- Null-Safe Ref Resolution: Defers portal mounting when user-provided container refs are not yet hydrated.
- Graceful Degradation: If `document.startViewTransition` is missing or fails, execution falls back cleanly to immediate DOM mutations without crashing.

### 4. Testing
- Double Render Test Invariant: Tests run both under standard rendering and `StrictMode` (`{ strict: true }` and `{ strict: false }`) to ensure effect cleanup/replay cycles do not break ref bindings.
- Frame-Level Testing: Virtual timer and animation frame sabotage (`vi.spyOn(window, 'requestAnimationFrame').mockImplementation(...)`) to verify frame-independent keyboard focus trapping.

### 5. Security
- Prototype Pollution & Ref Poisoning: Elements never read raw object prototypes; attribute dictionaries are constructed as clean key-value records.
- Input Sanitization: Visual label strings (`stringifyAsLabel`) are safely escaped before insertion into accessibility tree descriptions (`aria-label`, `aria-describedby`).

### 6. Performance
- Zero Layout Thrashing: Reads from the DOM (`getTabbableContent`, container checks) are grouped and executed before paint flushes.
- Memory Minimization: Shared frozen empty arrays and singleton NOOP functions (`import { NOOP } from '@base-ui/utils/empty'`) are reused across all instances to prevent GC allocations.

### 7. Deployment
- Dual ESM/CJS build outputs generated via Lerna, Rollup, and Babel.
- CI Matrix: Mandatory unit tests on Chromium headless (`vitest --project @base-ui/react`), bundle size tracking with size-limit alerts in PR comments, and automated Screen Reader validations via Guidepup and Playwright.

### 8. Agent Patterns
- Direct repository workflows leverage automated release and triage agents (`.agents/skills/base-ui-review/SKILL.md`, `.agents/skills/mui-release`).
- Continuous PR triage automates release candidate publishing (`pkg.pr.new`) to validate fixes directly in target environments.

### 9. Data Flow
```
User Event (click/keydown)
  │
  ▼
handleInputPress / onKeyDown
  │
  ▼
Store Mutation & Action Dispatch
  │
  ▼
React Layout Effect (`useIsoLayoutEffect`)
  │
  ├─► Container Ref Missing? ──► Schedule `createFlushBeforePaint` Retry
  │
  ▼
DOM Attribute Synthesis (`stateAttributesMapping`)
  │
  ▼
Synchronous Focus Guard Traps (`FloatingFocusManager`)
  │
  ▼
Native Browser Paint
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Isolated Pre-Paint Flush Queue
```typescript
export function createFlushBeforePaint() {
  let pendingCallbacks: Array<() => void> | null = null;
  return function flushBeforePaint(fn: () => void) {
    if (!pendingCallbacks) {
      const callbacks: Array<() => void> = [];
      pendingCallbacks = callbacks;
      queueMicrotask(() => {
        pendingCallbacks = null;
        ReactDOM.flushSync(() => {
          for (const callback of callbacks) {
            callback();
          }
        });
      });
    }
    pendingCallbacks.push(fn);
  };
}
```

### 2. Rule
Guard sentinels in modal dialogs MUST execute focus redirection synchronously within `onFocus`. NEVER delegate trap redirection to `requestAnimationFrame` or asynchronous microtasks.

### 3. Architecture Principle
Compound UI primitives MUST decouple visual state representation from React re-renders by projecting state transitions into declarative HTML `data-*` attributes, allowing CSS to drive layout animations without React render intervention.

### 4. Failure Mode
When portal container refs are attached to sibling or ancestor nodes that mount after the portal in React's bottom-up layout phase, reading the ref