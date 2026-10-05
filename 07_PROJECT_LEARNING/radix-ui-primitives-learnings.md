# Forensic Learning Record (Deep Inspection): radix-ui/primitives

> **Canonical Artifact**: `07_PROJECT_LEARNING/radix-ui-primitives-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/radix-ui/primitives](https://github.com/radix-ui/primitives))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:16:19.187Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `radix-ui/primitives`
- **Description**: Radix Primitives is an open-source UI component library for building high-quality, accessible design systems and web apps. Maintained by @workos.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 19360 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/core/number/src/index.ts`
```
export { clamp } from './number';

```

### Core Architecture Module: `packages/core/number/src/number.ts`
```
function clamp(value: number, [min, max]: [number, number]): number {
  return Math.min(max, Math.max(min, value));
}

export { clamp };

```

### Core Architecture Module: `packages/core/primitive/src/index.ts`
```
export * from './primitive';
export type * from './types';

```

### Core Architecture Module: `packages/core/primitive/src/internal/is-development.false.ts`
```
export const IS_DEVELOPMENT = false;

```

### Core Architecture Module: `packages/core/primitive/src/internal/is-development.true.ts`
```
export const IS_DEVELOPMENT = true;

```

### Core Architecture Module: `packages/core/primitive/src/primitive.tsx`
```
/* eslint-disable no-restricted-properties */

/* eslint-disable no-restricted-globals */
export const canUseDOM = !!(
  typeof window !== 'undefined' &&
  window.document &&
  window.document.createElement
);
/* eslint-enable no-restricted-globals */

export function composeEventHandlers<E extends { defaultPrevented: boolean }>(
  originalEventHandler?: (event: E) => void,
  ourEventHandler?: (event: E) => void,
  { checkForDefaultPrevented = true } = {},
) {
  return function handleEvent(event: E) {
    originalEventHandler?.(event);

    if (checkForDefaultPrevented === false || !event || !event.defaultPrevented) {
      return ourEventHandler?.(event);
    }
  };
}

export function getOwnerWindow(element: Node | null | undefined) {
  if (!canUseDOM) {
    throw new Error('Cannot access window outside of the DOM');
  }
  // eslint-disable-next-line no-restricted-globals
  return element?.ownerDocument?.defaultView ?? window;
}

export function getOwnerDocument(element: Node | null | undefined) {
  if (!canUseDOM) {
    throw new Error('Cannot access document outside of the DOM');
  }
  // eslint-disable-next-line no-restricted-globals
  return element?.ownerDocument ?? document;
}

/**
 * Lifted from https://github.com/ariakit/ariakit/blob/main/packages/ariakit-core/src/utils/dom.ts#L37
 * MIT License, Copyright (c) AriaKit.
 */
export function getActiveElement(
  node: Node | null | undefined,
  activeDescendant = false,
): HTMLElement | null {
  const { activeElement } = getOwnerDocument(node);
  if (!activeElement?.nodeName) {
    // `activeElement` might be an empty object if we're interacting with elements
    // inside of an iframe.
    return null;
  }

  if (isFrame(activeElement) && activeElement.contentDocument) {
    return getActiveElement(activeElement.contentDocument.body, activeDescendant);
  }

  if (activeDescendant) {
    const id = activeElement.getAttribute('aria-activedescendant');
    if (id) {
      const element = getOwnerDocument(activeElement).getElementById(id);
      if (element) {
        return element;
      }
    }
  }

  return activeElement as HTMLElement | null;
}

export function isFrame(element: Element): element is HTMLIFrameElement {
  return element.tagName === 'IFRAME';
}

```

### Core Architecture Module: `packages/core/primitive/src/types.ts`
```
export type Timeout = ReturnType<typeof setTimeout>;
export type Interval = ReturnType<typeof setInterval>;
export type Immediate = ReturnType<typeof setImmediate>;

```

### Core Architecture Module: `packages/core/rect/src/index.ts`
```
export { observeElementRect } from './observe-element-rect';
export type { Measurable } from './observe-element-rect';

```

### Core Architecture Module: `packages/core/rect/src/observe-element-rect.ts`
```
// Adapted from https://github.com/reach/observe-rect/tree
// MIT license, React Training

type Measurable = { getBoundingClientRect(): DOMRect };

/**
 * Observes an element's rectangle on screen (getBoundingClientRect)
 * This is useful to track elements on the screen and attach other elements
 * that might be in different layers, etc.
 */
function observeElementRect(
  /** The element whose rect to observe */
  elementToObserve: Measurable,
  /** The callback which will be called when the rect changes */
  callback: CallbackFn,
) {
  const observedData = observedElements.get(elementToObserve);

  if (observedData === undefined) {
    // add the element to the map of observed elements with its first callback
    // because this is the first time this element is observed
    observedElements.set(elementToObserve, { rect: {} as DOMRect, callbacks: [callback] });

    if (observedElements.size === 1) {
      // start the internal loop once at least 1 element is observed
      rafId = requestAnimationFrame(runLoop);
    }
  } else {
    // only add a callback for this element as it's already observed
    observedData.callbacks.push(callback);
    callback(elementToObserve.getBoundingClientRect());
  }

  return () => {
    const observedData = observedElements.get(elementToObserve);
    if (observedData === undefined) return;

    // start by removing the callback
    const index = observedData.callbacks.indexOf(callback);
    if (index > -1) {
      observedData.callbacks.splice(index, 1);
    }

    if (observedData.callbacks.length === 0) {
      // stop observing this element because there are no
      // callbacks registered for it anymore
      observedElements.delete(elementToObserve);

      if (observedElements.size === 0) {
        // stop the internal loop once no elements are observed anymore
        cancelAnimationFrame(rafId);
      }
    }
  };
}

// ========================================================================
// module internals

type CallbackFn = (rect: DOMRect) => void;

type ObservedData = {
  rect: DOMRect;
  callbacks: Array<CallbackFn>;
};

let rafId: number;
const observedElements: Map<Measurable, ObservedData> = new Map();

function runLoop() {
  const changedRectsData: Array<ObservedData> = [];

  // process all DOM reads first (getBoundingClientRect)
  observedElements.forEach((data, element) => {
    const newRect = element.getBoundingClientRect();

    // gather all the data for elements whose rects have changed
    if (!rectEquals(data.rect, newRect)) {
      data.rect = newRect;
      changedRectsData.push(data);
    }
  });

  // group DOM writes here after the DOM reads (getBoundingClientRect)
  // as DOM writes will most likely happen with the callbacks
  changedRectsData.forEach((data) => {
    data.callbacks.forEach((callback) => callback(data.rect));
  });

  rafId = requestAnimationFrame(runLoop);
}
// ========================================================================

/**
 * Returns whether 2 rects are equal in values
 */
function rectEquals(rect1: DOMRect, rect2: DOMRect) {
  return (
    rect1.width === rect2.width &&
    rect1.height === rect2.height &&
    rect1.top === rect2.top &&
    rect1.right === rect2.right &&
    rect1.bottom === rect2.bottom &&
    rect1.left === rect2.left
  );
}

export { observeElementRect };
export type { Measurable };

```

### Core Architecture Module: `packages/react/presence/src/use-state-machine.tsx`
```
import * as React from 'react';

type Machine<S> = { [k: string]: { [k: string]: S } };
type MachineState<T> = keyof T;
type MachineEvent<T> = keyof UnionToIntersection<T[keyof T]>;

// 🤯 https://fettblog.eu/typescript-union-to-intersection/
type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any
  ? R
  : never;

export function useStateMachine<M>(
  initialState: MachineState<M>,
  machine: M & Machine<MachineState<M>>,
) {
  return React.useReducer((state: MachineState<M>, event: MachineEvent<M>): MachineState<M> => {
    const nextState = (machine[state] as any)[event];
    return nextState ?? state;
  }, initialState);
}

```

### Core Architecture Module: `packages/react/scroll-area/src/use-state-machine.ts`
```
import * as React from 'react';

type Machine<S> = { [k: string]: { [k: string]: S } };
type MachineState<T> = keyof T;
type MachineEvent<T> = keyof UnionToIntersection<T[keyof T]>;

// 🤯 https://fettblog.eu/typescript-union-to-intersection/
type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any
  ? R
  : never;

export function useStateMachine<M>(
  initialState: MachineState<M>,
  machine: M & Machine<MachineState<M>>,
) {
  return React.useReducer((state: MachineState<M>, event: MachineEvent<M>): MachineState<M> => {
    const nextState = (machine[state] as any)[event];
    return nextState ?? state;
  }, initialState);
}

```

### Core Architecture Module: `packages/react/use-controllable-state/src/index.ts`
```
export { useControllableState } from './use-controllable-state';
export { useControllableStateReducer } from './use-controllable-state-reducer';

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4164** (2026-10-03): **[Menu] Keep tracking pointer direction when an item prevents pointer move**
  *Symptoms*: ### Description  Menu content tracks pointer direction in its `onPointerMove`, and the submenu grace area relies on that direction. Because the tracking handler only runs when the event isn't `defaultPrevented`, any item or sub trigger that calls `preventDefault` on pointer move freezes it, since pointer moves bubble up to the content. The next time the pointer leaves a sub trigger toward its submenu, the grace check sees a stale direction and the submenu closes as the pointer crosses a sibling item.  One case where this comes up: a sub trigger calls `preventDefault` to skip focus-on-hover, so focus can stay in a search input inside the open submenu (pairs with #4163).  Direction tracking only records where the pointer is heading, so it now runs with `checkForDefaultPrevented: false`, like `MenuRootContentModal` does for `onFocusOutside`.  - Added a test that fails before this change and passes after. - Added a changeset (patch).  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: 62a233b0eedf6464563aa6bedc48bafeff2f1a50  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 5 packages</summary>    | Name                          | Type  | | ----------------------------- | ----- | | @radix-ui/react-menu          | Patch | | @radix-ui/react-dropdown-menu | Patch | | @radix-ui/react-context-menu  | Patch | | @radix-ui/react-menubar       | Patch | | radix-ui                      | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/Rod2003/primitives/new/menu-pointer-direction-default-prevented?filename=.changeset/whole-queens-wear.md&value=---%0A%22%40radix-ui%2Freact-dropdown-menu%22%3A%20patch%0A%22%40radix-ui%2Freact-menu%22%3A%20patch%0A---%0A%0A%5BMenu%5D%20Keep%20tracking%20poin
  > Closing: we solved our use case without changing Radix. Thanks!

- **Issue #4163** (2026-10-03): **[Menu] Call SubContent onOpenAutoFocus before the default open focus**
  *Symptoms*: ### Description  `Menu.SubContent` hardcodes `onOpenAutoFocus`, so a consumer's handler is silently dropped. This affects `DropdownMenu`, `ContextMenu`, and `Menubar` sub content too. As a result, there's no way to focus a search input when a submenu opens, which is a common pattern for filter menus (see shadcn-ui/ui#8942).  This combines `props.onOpenAutoFocus` with the default handler, the same way `SubContent` already handles `onFocusOutside`, `onEscapeKeyDown`, and `onKeyDown`, and adds the prop to `MenuSubContentProps`. Nothing changes when no handler is passed or the handler doesn't call `preventDefault`.  - Added a test that fails before this change and passes after, plus one that pins the default pointer-open focus behavior. - Added a changeset (minor, since it adds a public prop).  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: dca1683905cdc6a892355873c6cb7a46f7543776  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 5 packages</summary>    | Name                          | Type  | | ----------------------------- | ----- | | @radix-ui/react-menu          | Minor | | @radix-ui/react-dropdown-menu | Minor | | @radix-ui/react-context-menu  | Minor | | @radix-ui/react-menubar       | Minor | | radix-ui                      | Minor |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/Rod2003/primitives/new/menu-sub-content-open-auto-focus?filename=.changeset/small-dingos-thank.md&value=---%0A%22%40radix-ui%2Freact-dropdown-menu%22%3A%20patch%0A%22%40radix-ui%2Freact-menu%22%3A%20patch%0A---%0A%0A%5BMenu%5D%20Call%20SubContent%20onOpenAut
  > Closing: we solved our use case without changing Radix. Thanks!

- **Issue #4154** (2026-09-24): **[Slider] onValueCommit receives the previous render's value when pointerup fires before the last pointermove has rendered**
  *Symptoms*: ## Bug report  ### Current Behavior  When `pointerup` is handled before React has rendered the last `pointermove` of a drag, `Slider` calls `onValueCommit` with the value from the previous render instead of the value `onValueChange` last reported. If the unrendered move is the only move since the slide started, `onValueCommit` is not called at all.  `pointermove` is a continuous event, so React batches and defers its state updates; a `pointerup` that arrives before that render runs `handleSlideEnd` against stale `values`. In the test below `onValueChange` is last called with `[60]` and `onValueCommit` is called with `[30]`:  ``` AssertionError: expected "vi.fn()" to be called with arguments: [ [ 60 ] ] Received:  1st vi.fn() call: [ [ 30 ] ] ```  and, for the thumb-press variant:  ``` AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times ```  Controlled and uncontrolled sliders behave the same. Keyboard steps are not affected (they commit from `nextValues` inside `updateValues`).  We first noticed this in a media seek bar rendered by a slow (software-rendered) Android WebView: a drag released at the 60 s mark committed 52 s, 57 s and 52 s in three runs, while `onValueChange` had already reported the final position. A fast device narrows the gap to the last frame of movement but does not remove it.  ### Expected behavior  `onValueCommit` receives the same value as the last `onValueChange` of the interaction (the position the pointer was released at), and it 

- **Issue #4144** (2026-10-02): **CSOAI — Radix AI governance primitives**
  *Symptoms*: Withdrawn. No action is requested from this project.

- **Issue #4135** (2026-09-22): **fix(one-time-password-field): don't clear value when a paste sanitizes to empty**
  *Symptoms*: ## Summary  `sanitizeValue` in `OneTimePasswordField` always returns an array (even when it's empty), so the `PASTE` reducer's `if (!sanitizedValue) return;` guard could never short-circuit — an empty array is truthy in JS.  As a result, pasting content that sanitizes down to nothing (e.g. pasting non-numeric text while `validationType="numeric"` (the default), or a clipboard entry with no `text/plain` data) would: - Clear out the existing value entirely - Move focus to the last input  instead of being a no-op.  ## Fix  Changed the guard to check `sanitizedValue.length === 0` instead of relying on truthiness.  ## Test plan  - [x] Added a regression test reproducing the exact scenario (typed value gets wiped by a purely alphabetic paste under the default numeric validation); verified it fails against the old guard and passes with the fix - [x] `pnpm vitest run packages/react/one-time-password-field` passes (13/13) - [x] `pnpm oxlint` / `pnpm oxfmt` clean on changed files - [x] `tsc --noEmit` passes for the package - [x] Added a changeset (`@radix-ui/react-one-time-password-field`, `radix-ui`: patch)
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: 25e411b989adc0ba4801827cbde37b52dfa32247  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 2 packages</summary>    | Name                                    | Type  | | --------------------------------------- | ----- | | @radix-ui/react-one-time-password-field | Patch | | radix-ui                                | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/koreahghg/primitives/new/fix/otp-empty-paste-clears-value?filename=.changeset/tender-bottles-follow.md&value=---%0A%22%40radix-ui%2Freact-one-time-password-field%22%3A%20patch%0A---%0A%0Afix(one-time-password-field)%3A%20don't%20clear%20value%20when%20a%20paste%20sanitizes%20to%20empty%0A)  

- **Issue #4130** (2026-09-22): **otp: Preserve value when a paste sanitizes to empty**
  *Symptoms*: ### Description  `OneTimePasswordField`'s `PASTE` action guarded against an empty sanitized paste with:  ```ts const sanitizedValue = sanitizeValue(pastedValue); if (!sanitizedValue) {   return; } ```  `sanitizeValue` always returns an array (`value.split('')`), and even an empty array is truthy in JS, so this guard never actually fires.  Concretely: with the default `validationType="numeric"`, if a field already has a value and the user pastes content that is entirely non-numeric (e.g. accidentally copied text instead of a code), every character gets stripped, `sanitizedValue` becomes `[]`, the dead guard lets execution continue, and the field's existing value is wiped out (`setValue([])`) instead of the paste being ignored.  Fixed by checking the array's length instead of truthiness:  ```ts if (sanitizedValue.length === 0) {   return; } ```  Added a regression test that pastes a valid code, then pastes non-numeric content, and asserts the original value is preserved. Verified the new test fails against the old guard and passes with the fix.
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: 7d485085e039426d5e49d683bec9dcfaeff7f988  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 2 packages</summary>    | Name                                    | Type  | | --------------------------------------- | ----- | | @radix-ui/react-one-time-password-field | Patch | | radix-ui                                | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/koreahghg/primitives/new/fix/otp-paste-empty-guard?filename=.changeset/vast-turtles-jump.md&value=---%0A%22%40radix-ui%2Freact-one-time-password-field%22%3A%20patch%0A---%0A%0Aotp%3A%20Preserve%20value%20when%20a%20paste%20sanitizes%20to%20empty%0A)  

- **Issue #4129** (2026-09-08): **fix(popover): allow tabbing out of non-modal content**
  *Symptoms*: ### Description  Fixes #4128.  Non-modal popovers now allow Tab to move focus past the last focusable element. Focus looping remains enabled for modal popovers by deriving `FocusScope`'s `loop` setting from `trapFocus`.  A regression test covers tabbing from the last control in a non-modal popover to the following page control.  ### Testing  - `pnpm exec vitest run packages/react/popover/src/popover.test.tsx` - `pnpm --filter @radix-ui/react-popover lint` - `pnpm --filter @radix-ui/react-popover typecheck` - `pnpm --filter @radix-ui/react-popover build` - `pnpm exec oxfmt --check packages/react/popover/src/popover.tsx packages/react/popover/src/popover.test.tsx .changeset/quiet-popovers-tab.md` 
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: d4a68ac44f1aa28715fb88ef665cd4653f596199  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 2 packages</summary>    | Name                    | Type  | | ----------------------- | ----- | | @radix-ui/react-popover | Patch | | radix-ui                | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/dawNotPoi/primitives/new/fix-4128-nonmodal-popover-focus-loop?filename=.changeset/polite-hairs-press.md&value=---%0A%22%40radix-ui%2Freact-popover%22%3A%20patch%0A---%0A%0Afix(popover)%3A%20allow%20tabbing%20out%20of%20non-modal%20content%0A)  

- **Issue #4124** (2026-09-24): **Popover: PopoverContent throws "Primitive.div failed to slot onto its children" on mount (React 19)**
  *Symptoms*: ## Bug report  ### Current Behavior  `PopoverContent` throws immediately on mount:  ``` Error: Primitive.div failed to slot onto its children. Expected a single React element child or `Slottable`.     at Primitive.div.Slot     at updateForwardRef     at beginWork     ... ```  This happens with a minimal, standard usage — a single valid-element child, no fragments, no arrays, nothing unusual:  ```tsx import { Popover, PopoverContent, PopoverTrigger } from "radix-ui" // (also reproduces via the standalone @radix-ui/react-popover package)  function Demo() {   return (     <Popover.Root>       <Popover.Trigger asChild>         <button type="button">Open popover</button>       </Popover.Trigger>       <Popover.Portal>         <Popover.Content>           <div>Hello</div>         </Popover.Content>       </Popover.Portal>     </Popover.Root>   ) } ```  Clicking the trigger throws the error above the moment `Popover.Content` mounts. The trigger itself renders fine before that — the crash is specifically on `Content` mount, not on `Trigger`/`Anchor` composition.  ### Expected behavior  The popover opens and renders its content, same as `Tooltip` and `Dialog` do with an equivalent structure.  ### Reproduction / isolation notes  I spent a while isolating this before filing, since I initially assumed it was a mistake in my own code:  - **Reproduces with a single child** — not a multiple-children-into-`Slot` issue (ruled out the `Slottable` scenario from #3747, which is a different patter
  **Post-Mortem & Fix Analysis**:
  > I tried the posted Popover structure with React/ReactDOM 19.2.8, `radix-ui@1.6.7` (and the standalone Popover/Slot packages) in both JSDOM and a fresh Vite app, but could not reproduce the Slot error.  Could you share a minimal reproduction repository plus its lockfile, the complete error stack, and the output of `npm ls react react-dom radix-ui @radix-ui/react-popover @radix-ui/react-primitive @radix-ui/react-slot`? If your app wraps `Popover.Content`, the wrapper source and the props passed to it (especially `asChild` and `children`) would also help isolate the failing `Primitive.div`.

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `25a1f5a7` (2026-07-30)
**Commit Message**: Fix prop forwarding for FocusScope components (#4086)

**File**: `packages/react/dialog/src/dialog.test.tsx` (modified, +93/-0)
```diff
@@ -1,8 +1,10 @@
 import * as React from 'react';
+import * as ReactDOM from 'react-dom';
 import { axe } from 'vitest-axe';
 import type { RenderResult } from '@testing-library/react';
 import { act, render, fireEvent, cleanup, screen } from '@testing-library/react';
 import { DismissableLayer } from '@radix-ui/react-dismissable-layer';
+import { useFocusScopeBranch } from '@radix-ui/react-focus-scope';
 import * as Dialog from './dialog';
 import type { MockInstance } from 'vitest';
 import { describe, it, afterEach, beforeEach, vi, expect } from 'vitest';
@@ -249,6 +251,97 @@ describe('given a modal Dialog', () => {
   });
 });
 
+describe('given a Dialog with `asChild` on the Content', () => {
+  afterEach(() => {
+    cleanup();
+    document.body.style.pointerEvents = '';
+  });
+
+  // Regression test for https://github.com/radix-ui/primitives/issues/4077
+  it.each([{ modal: true }, { modal: false }])(
+    'forwards content props and the ref to the child (modal: $modal)',
+    ({ modal }) => {
+      const contentRef = React.createRef<HTMLDivElement>();
+      const onClick = vi.fn();
+
+      render(
+        <Dialog.Root defaultOpen modal={modal}>
+          <Dialog.Portal>
+            <Dialog.Content asChild className="content" onClick={onClick} ref={contentRef}>
+              <article data-testid="content">
+                <Dialog.Title>{TITLE_TEXT}</Dialog.Title>
+                <Dialog.Close>{CLOSE_TEXT}</Dialog.Close>
+              </article>
+            </Dialog.Content>
+          </Dialog.Portal>
+        </Dialog.Root>,
+      );
+
+      const content = screen.getByTestId('content');
+      expect(content.tagName).toBe('ARTICLE');
+      expect(content).toHaveAttribute('role', 'dialog');
+      expect(content).toHaveAttribute('data-state', 'open');
+      expect(content).toHaveAttribute('aria-labelledby', screen.getByText(TITLE_TEXT).id);
+      expect(content).toHaveClass('content');
+      expect(contentRef.current).toBe(content);
+
+      fireEvent.click(content);
+      expect(onClick).toHaveBeenCalledTimes(1);
+    },
+  );
+
+  it('registers portalled descendants as focus scope branches', () => {
+    function PortalledBranch() {
+      const [node, setNode] = React.useState<HTMLElement | null>(null);
+      useFocusScopeBranch(node);
+      return ReactDOM.createPortal(
+        <div ref={setNode}>
+          <button type="button">branch</button>
+        </div>,
+        document.body,
+      );
+    }
+
+    render(
+      <Dialog.Root defaultOpen>
+        <Dialog.Portal>
+          <Dialog.Content asChild>
+            <article>
+              <Dialog.Title>{TITLE_TEXT}</Dialog.Title>
+              <Dialog.Close>{CLOSE_TEXT}</Dialog.Close>
+              <PortalledBranch />
+            </article>
+          </Dialog.Content>
+        </Dialog.Portal>
+      </Dialog.Root>,
+    );
+
+    // The branch lives outside the dialog's DOM subtree, so a trapped focus
+    // scope would normally reclaim focus from it.
+    const branch = screen.getByText('branch');
+    act(() => branch.focus());
+    expect(branch).toHaveFocus();
+  });
+
+  it('still dismisses on escape when slotted', () => {
+    const onOpenChange = vi.fn();
+    render(
+      <Dialog.Root defaultOpen onOpenChange={onOpenChange}>
+        <Dialog.Portal>
+          <Dialog.Content asChild>
+            <article>
+              <Dialog.Title>{TITLE_TEXT}</Dialog.Title>
+            </article>
+          </Dialog.Content>
+        </Dialog.Portal>
+      </Dialog.Root>,
+    );
+
+    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
+    expect(onOpenChange).toHaveBeenCalledWith(false);
+  });
+});
+
 describe('given two overlapping modal Dialogs (forceMount)', () => {
   // Forcing mount keeps the content (and its `DismissableLayer`) mounted while
   // `open` toggles, which mirrors what happens during exit animations or when
```

**File**: `packages/react/dialog/src/dialog.tsx` (modified, +5/-8)
```diff
@@ -438,17 +438,17 @@ const DialogContentImpl = /* @__PURE__ */ React.forwardRef<
       onOpenAutoFocus,
       onCloseAutoFocus,
       'aria-describedby': ariaDescribedby,
+      children,
       ...contentProps
     } = props;
-    const { children, ...layerProps } = contentProps;
     const context = useDialogContext(CONTENT_NAME, __scopeDialog);
 
     // Make sure the whole tree has focus guards as our `Dialog` will be
     // the last element in the DOM (because of the `Portal`)
     useFocusGuards();
 
     return (
-      <>
+      <FocusScopeBranchProvider registry={context.branchRegistry}>
         <FocusScope
           asChild
           loop
@@ -467,18 +467,15 @@ const DialogContentImpl = /* @__PURE__ */ React.forwardRef<
                 : ariaDescribedby
             }
             data-state={getState(context.open)}
-            {...layerProps}
+            {...contentProps}
             ref={forwardedRef}
             deferPointerDownOutside
             onDismiss={() => context.onOpenChange(false)}
           >
-            {/* Lets nested, portalled layers register themselves as branches of this Dialog. */}
-            <FocusScopeBranchProvider value={context.branchRegistry}>
-              {children}
-            </FocusScopeBranchProvider>
+            {children}
           </DismissableLayer>
         </FocusScope>
-      </>
+      </FocusScopeBranchProvider>
     );
   },
 );
```

**File**: `packages/react/focus-scope/src/focus-scope.tsx` (modified, +19/-2)
```diff
@@ -262,7 +262,24 @@ interface FocusScopeBranchRegistry {
 
 const FocusScopeBranchContext = React.createContext<FocusScopeBranchRegistry | null>(null);
 
-const FocusScopeBranchProvider = FocusScopeBranchContext.Provider;
+interface FocusScopeBranchProviderProps {
+  /**
+   * The registry nested layers should register themselves with. When nullish the provider is
+   * transparent, letting nested layers register against the next registry up the tree instead. This
+   * is the case for layers that don't trap focus or lock scroll, which have nothing to host.
+   */
+  registry: FocusScopeBranchRegistry | null | undefined;
+  children?: React.ReactNode;
+}
+
+function FocusScopeBranchProvider({ registry, children }: FocusScopeBranchProviderProps) {
+  if (!registry) {
+    return children;
+  }
+  return (
+    <FocusScopeBranchContext.Provider value={registry}>{children}</FocusScopeBranchContext.Provider>
+  );
+}
 
 function useFocusScopeBranchRegistry() {
   const [nodes, setNodes] = React.useState<HTMLElement[]>([]);
@@ -446,4 +463,4 @@ export {
   //
   FocusScope as Root,
 };
-export type { FocusScopeProps, FocusScopeBranchRegistry };
+export type { FocusScopeProps, FocusScopeBranchProviderProps, FocusScopeBranchRegistry };
```

**File**: `packages/react/menu/src/menu.tsx` (modified, +91/-97)
```diff
@@ -396,7 +396,6 @@ const MenuContentImpl = /* @__PURE__ */ React.forwardRef<
       onInteractOutside,
       onDismiss,
       disableOutsideScroll,
-      children,
       ...contentProps
     } = props;
     const context = useMenuContext(CONTENT_NAME, __scopeMenu);
@@ -512,110 +511,105 @@ const MenuContentImpl = /* @__PURE__ */ React.forwardRef<
           pointerGraceIntentRef.current = intent;
         }, [])}
       >
-        <ScrollLockWrapper {...scrollLockWrapperProps}>
-          <FocusScope
-            asChild
-            trapped={trapFocus}
-            branches={branchNodes}
-            onMountAutoFocus={composeEventHandlers(onOpenAutoFocus, (event) => {
-              // when opening, explicitly focus the content area only and leave
-              // `onEntryFocus` in  control of focusing first item
-              event.preventDefault();
-              contentRef.current?.focus({ preventScroll: true });
-            })}
-            onUnmountAutoFocus={onCloseAutoFocus}
-          >
-            <DismissableLayer
+        <FocusScopeBranchProvider registry={isModal ? branchRegistry : null}>
+          <ScrollLockWrapper {...scrollLockWrapperProps}>
+            <FocusScope
               asChild
-              disableOutsidePointerEvents={disableOutsidePointerEvents}
-              onEscapeKeyDown={onEscapeKeyDown}
-              onPointerDownOutside={onPointerDownOutside}
-              onFocusOutside={onFocusOutside}
-              onInteractOutside={onInteractOutside}
-              onDismiss={onDismiss}
+              trapped={trapFocus}
+              branches={branchNodes}
+              onMountAutoFocus={composeEventHandlers(onOpenAutoFocus, (event) => {
+                // when opening, explicitly focus the content area only and leave
+                // `onEntryFocus` in  control of focusing first item
+                event.preventDefault();
+                contentRef.current?.focus({ preventScroll: true });
+              })}
+              onUnmountAutoFocus={onCloseAutoFocus}
             >
-              <RovingFocusGroup.Root
+              <DismissableLayer
                 asChild
-                {...rovingFocusGroupScope}
-                dir={rootContext.dir}
-                orientation="vertical"
-                loop={loop}
-                currentTabStopId={currentItemId}
-                onCurrentTabStopIdChange={setCurrentItemId}
-                onEntryFocus={composeEventHandlers(onEntryFocus, (event) => {
-                  // only focus first item when using keyboard
-                  if (!rootContext.isUsingKeyboardRef.current) event.preventDefault();
-                })}
-                preventScrollOnEntryFocus
+                disableOutsidePointerEvents={disableOutsidePointerEvents}
+                onEscapeKeyDown={onEscapeKeyDown}
+                onPointerDownOutside={onPointerDownOutside}
+                onFocusOutside={onFocusOutside}
+                onInteractOutside={onInteractOutside}
+                onDismiss={onDismiss}
               >
-                <PopperPrimitive.Content
-                  role="menu"
-                  aria-orientation="vertical"
-                  data-state={getOpenState(context.open)}
-                  data-radix-menu-content=""
+                <RovingFocusGroup.Root
+                  asChild
+                  {...rovingFocusGroupScope}
                   dir={rootContext.dir}
-                  {...popperScope}
-                  {...contentProps}
-                  ref={composedRefs}
-                  style={{ outline: 'none', ...contentProps.style }}
-                  onKeyDown={composeEventHandlers(contentProps.onKeyDown, (event) => {
-                    // submenu key events bubble through portals. We only care about keys in this menu.
-                    const target = event.target as HTMLElement;
-                    const isKeyDownInside =
-                      target.closest('[data-radix-menu-content]') === event.currentTarget;
-                    const isModifierKey = event.ctrlKey || event.altKey || event.metaKey;
-                    const isCharacterKey = event.key.length === 1;
-                    if (isKeyDownInside) {
-                      // menus should not be navigated using tab key so we prevent it
-                      if (event.key === 'Tab') event.preventDefault();
-                      if (!isModifierKey && isCharacterKey) handleTypeaheadSearch(event.key);
-                    }
-                    // focus first/last item based on key pressed
-                    const content = contentRef.current;
-                    if (event.target !== content) return;
-                    if (!FIRST_LAST_KEYS.includes(event.key)) return;
-                    event.preventDefault();
-                    const items = getItems().filter((item) => !item.disabled);
-                    const candidateNodes = items.map((item) => item.ref.current!);
-                    if (LAST_KEYS.includ
```

**File**: `packages/react/popover/src/popover.test.tsx` (modified, +39/-2)
```diff
@@ -1,7 +1,7 @@
 import * as React from 'react';
 import type { RenderResult } from '@testing-library/react';
-import { cleanup, fireEvent, render } from '@testing-library/react';
-import { afterEach, describe, it, expect } from 'vitest';
+import { cleanup, fireEvent, render, screen } from '@testing-library/react';
+import { afterEach, describe, it, expect, vi } from 'vitest';
 import * as Popover from './popover';
 
 const TRIGGER_TEXT = 'Open';
@@ -115,3 +115,40 @@ describe('Title and Description', () => {
     expect(content).toHaveAttribute('aria-describedby', rendered.getByText(DESCRIPTION_TEXT).id);
   });
 });
+
+describe('given a Popover with `asChild` on the Content', () => {
+  afterEach(() => {
+    cleanup();
+    document.body.style.pointerEvents = '';
+  });
+
+  // Regression test for https://github.com/radix-ui/primitives/issues/4077
+  it.each([{ modal: true }, { modal: false }])(
+    'forwards content props and the ref to the child (modal: $modal)',
+    ({ modal }) => {
+      const contentRef = React.createRef<HTMLDivElement>();
+      const onClick = vi.fn();
+
+      render(
+        <Popover.Root defaultOpen modal={modal}>
+          <Popover.Trigger>{TRIGGER_TEXT}</Popover.Trigger>
+          <Popover.Portal>
+            <Popover.Content asChild className="content" onClick={onClick} ref={contentRef}>
+              <article data-testid="content">{CONTENT_TEXT}</article>
+            </Popover.Content>
+          </Popover.Portal>
+        </Popover.Root>,
+      );
+
+      const content = screen.getByTestId('content');
+      expect(content.tagName).toBe('ARTICLE');
+      expect(content).toHaveAttribute('role', 'dialog');
+      expect(content).toHaveAttribute('data-state', 'open');
+      expect(content).toHaveClass('content');
+      expect(contentRef.current).toBe(content);
+
+      fireEvent.click(content);
+      expect(onClick).toHaveBeenCalledTimes(1);
+    },
+  );
+});
```

**File**: `packages/react/popover/src/popover.tsx` (modified, +46/-49)
```diff
@@ -450,7 +450,6 @@ const PopoverContentImpl = /* @__PURE__ */ React.forwardRef<
       'aria-describedby': ariaDescribedby,
       branchNodes,
       branchRegistry,
-      children,
       ...contentProps
     } = props;
     const context = usePopoverContext(CONTENT_NAME, __scopePopover);
@@ -470,57 +469,55 @@ const PopoverContentImpl = /* @__PURE__ */ React.forwardRef<
     useFocusGuards();
 
     return (
-      <FocusScope
-        asChild
-        loop
-        trapped={trapFocus}
-        branches={branchNodes}
-        onMountAutoFocus={onOpenAutoFocus}
-        onUnmountAutoFocus={onCloseAutoFocus}
-      >
-        <DismissableLayer
+      <FocusScopeBranchProvider registry={branchRegistry}>
+        <FocusScope
           asChild
-          disableOutsidePointerEvents={disableOutsidePointerEvents}
-          onInteractOutside={onInteractOutside}
-          onEscapeKeyDown={onEscapeKeyDown}
-          onPointerDownOutside={onPointerDownOutside}
-          onFocusOutside={onFocusOutside}
-          onDismiss={() => context.onOpenChange(false)}
-          deferPointerDownOutside
+          loop
+          trapped={trapFocus}
+          branches={branchNodes}
+          onMountAutoFocus={onOpenAutoFocus}
+          onUnmountAutoFocus={onCloseAutoFocus}
         >
-          <PopperPrimitive.Content
-            data-state={getState(context.open)}
-            role="dialog"
-            id={context.contentId}
-            aria-labelledby={context.titlePresent ? context.titleId : undefined}
-            aria-describedby={
-              context.descriptionPresent
-                ? concatAriaDescribedby(ariaDescribedby, context.descriptionId)
-                : ariaDescribedby
-            }
-            {...popperScope}
-            {...contentProps}
-            ref={composedRefs}
-            style={{
-              ...contentProps.style,
-              // re-namespace exposed content custom properties
-              ...{
-                '--radix-popover-content-transform-origin': 'var(--radix-popper-transform-origin)',
-                '--radix-popover-content-available-width': 'var(--radix-popper-available-width)',
-                '--radix-popover-content-available-height': 'var(--radix-popper-available-height)',
-                '--radix-popover-trigger-width': 'var(--radix-popper-anchor-width)',
-                '--radix-popover-trigger-height': 'var(--radix-popper-anchor-height)',
-              },
-            }}
+          <DismissableLayer
+            asChild
+            disableOutsidePointerEvents={disableOutsidePointerEvents}
+            onInteractOutside={onInteractOutside}
+            onEscapeKeyDown={onEscapeKeyDown}
+            onPointerDownOutside={onPointerDownOutside}
+            onFocusOutside={onFocusOutside}
+            onDismiss={() => context.onOpenChange(false)}
+            deferPointerDownOutside
           >
-            {branchRegistry ? (
-              <FocusScopeBranchProvider value={branchRegistry}>{children}</FocusScopeBranchProvider>
-            ) : (
-              children
-            )}
-          </PopperPrimitive.Content>
-        </DismissableLayer>
-      </FocusScope>
+            <PopperPrimitive.Content
+              data-state={getState(context.open)}
+              role="dialog"
+              id={context.contentId}
+              aria-labelledby={context.titlePresent ? context.titleId : undefined}
+              aria-describedby={
+                context.descriptionPresent
+                  ? concatAriaDescribedby(ariaDescribedby, context.descriptionId)
+                  : ariaDescribedby
+              }
+              {...popperScope}
+              {...contentProps}
+              ref={composedRefs}
+              style={{
+                ...contentProps.style,
+                // re-namespace exposed content custom properties
+                ...{
+                  '--radix-popover-content-transform-origin':
+                    'var(--radix-popper-transform-origin)',
+                  '--radix-popover-content-available-width': 'var(--radix-popper-available-width)',
+                  '--radix-popover-content-available-height':
+                    'var(--radix-popper-available-height)',
+                  '--radix-popover-trigger-width': 'var(--radix-popper-anchor-width)',
+                  '--radix-popover-trigger-height': 'var(--radix-popper-anchor-height)',
+                },
+              }}
+            />
+          </DismissableLayer>
+        </FocusScope>
+      </FocusScopeBranchProvider>
     );
   },
 );
```

---

### Incident Patch 2: `df8f89ac` (2026-07-28)
**Commit Message**: Revert "slot: Add customizable `mergeProps`" (#4084)

This reverts commit 8d72d5f64914db82c12358a9ba9f4845b4985726 from PR #3953

**File**: `.changeset/slot-merge-props.md` (removed, +0/-54)
```diff
@@ -1,54 +0,0 @@
----
-"@radix-ui/react-slot": minor
-"radix-ui": minor
----
-
-Added entrypoints to control how `Slot` merges props with its child. You can now:
-
-1. pass a `mergeProps` function to an individual `Slot` for one-off needs, or
-2. Use the new `Slot.Provider` to apply a custom merge strategy to all nested components that use `Slot` under the hood.
-
-```tsx
-import { Slot } from "radix-ui";
-
-const mergeProps: Slot.MergePropsFunction = (slotProps, childProps) => {
-  // your custom merge strategy, optionally delegating to the default
-  const merged = Slot.mergeProps(slotProps, childProps);
-  return {
-    ...merged,
-    className: classNameProcessor(slotProps, childProps),
-    'data-custom-merge': 'true',
-  };
-};
-
-// one-off
-<Slot.Root mergeProps={mergeProps}>{child}</Slot.Root>
-
-// applies to all nested `asChild` components
-<Slot.Provider mergeProps={mergeProps}>
-  <App />
-</Slot.Provider>
-```
-
-**IMPORTANT:** The `mergeProps` function should be stable across renders to avoid excessive rendering of Slot components. We recommend defining it outside of the component scope.
-
-```tsx
-// good, mergeProps is stable across renders
-const mergeProps = (slotProps, childProps) => {
-  // ...
-};
-function Good() {
-  return <Slot.Root mergeProps={mergeProps} />;
-}
-
-// not so good, mergeProps is recreated on every render
-function LessGood() {
-  return (
-    <Slot.Root
-      mergeProps={(slotProps, childProps) => {
-        // ...
-      }}
-    />
-  );
-}
-```
```

**File**: `.github/workflows/ssr.yml` (modified, +1/-1)
```diff
@@ -30,5 +30,5 @@ jobs:
       - name: Build SSR testing app
         run: pnpm --filter @repo/ssr-testing build
 
-      - name: Assert Slot.Provider merge across the RSC boundary
+      - name: Assert primitives render across the RSC boundary
         run: pnpm --filter @repo/ssr-testing test:merge
```

**File**: `apps/ssr-testing/app/primitive-merge/page.tsx` (modified, +1/-10)
```diff
@@ -5,16 +5,7 @@ import { PrimitiveNode } from './primitive-node';
 
 // IMPORTANT: This is intentionally a Server Component authored in an RSC-safe
 // way. For every `Primitive.<node>`, it authors the `asChild` child element
-// HERE (on the server) and renders it inside a client `Slot.Provider` (see
-// `providers.tsx`).
-//
-// Because `@radix-ui/react-primitive` is a client component, each primitive's
-// internal `Slot` renders on the client under the provider and must honor the
-// consumer's custom `mergeProps`, even if the child crossed the server/client
-// boundary.
-//
-// `scripts/assert-primitive-merge.mjs` reads the prerendered HTML for this
-// route and asserts the marker landed on each primitive.
+// on the server and renders it inside a client `Providers` component.
 
 export default function Page() {
   return (
```

**File**: `apps/ssr-testing/app/primitive-merge/providers.tsx` (modified, +1/-13)
```diff
@@ -1,19 +1,7 @@
 'use client';
 
 import * as React from 'react';
-import { Slot } from 'radix-ui';
-
-// The consumer's custom merge strategy, provided via `Slot.Provider` on the
-// client. It's defined and used entirely within this "use client" module, so
-// the non-serializable function never crosses the server/client boundary.
-//
-// It delegates to the default `mergeProps` and then stamps a marker attribute
-// so the prerendered HTML can prove the custom strategy actually ran.
-const customMergeProps: Slot.MergePropsFunction = (slotProps, childProps) => ({
-  ...Slot.mergeProps(slotProps, childProps),
-  'data-provider-merged': 'true',
-});
 
 export function Providers({ children }: { children: React.ReactNode }) {
-  return <Slot.Provider mergeProps={customMergeProps}>{children}</Slot.Provider>;
+  return <>{children}</>;
 }
```

**File**: `apps/ssr-testing/app/rsc/page.tsx` (modified, +0/-17)
```diff
@@ -7,14 +7,6 @@ import { AspectRatio, Label, Separator, Slot, VisuallyHidden } from 'radix-ui';
 const ServerSlot = Slot.createSlot('SsrTest.Slot');
 const ServerSlottable = Slot.createSlottable('SsrTest.Slottable');
 
-// A consumer-defined `mergeProps` passed directly to a Slot must still work in a
-// Server Component. The per-instance prop bypasses context (which is client
-// only), so it applies during server render just like on the client.
-const serverMergeProps: Slot.MergePropsFunction = (slotProps, childProps) => ({
-  ...Slot.mergeProps(slotProps, childProps),
-  'data-server-merged': 'true',
-});
-
 export default function Page() {
   return (
     <div>
@@ -35,15 +27,6 @@ export default function Page() {
         <span>aspect ratio content</span>
       </AspectRatio.Root>
       <VisuallyHidden.Root>hidden text</VisuallyHidden.Root>
-
-      {/*
-        Rendering a Slot in a Server Component: `useComposedRefs` relies only on
-        `useCallback` (available in the server build), and the per-instance
-        `mergeProps` prop is honored without a client boundary.
-      */}
-      <ServerSlot mergeProps={serverMergeProps} className="from-slot">
-        <a href="/">consumer-defined mergeProps applied on the server</a>
-      </ServerSlot>
     </div>
   );
 }
```

**File**: `apps/ssr-testing/scripts/assert-primitive-merge.mjs` (modified, +1/-21)
```diff
@@ -1,18 +1,4 @@
 // @ts-check
-
-// Regression guard for the client/server boundary behavior of `Slot.Provider`.
-//
-// The `/primitive-merge` route is a Server Component that renders every
-// `Primitive.<node>` with `asChild` inside a client `Slot.Provider` whose
-// custom `mergeProps` stamps `data-provider-merged="true"`. Because
-// `@radix-ui/react-primitive` is a client component, each primitive's internal
-// `Slot` renders on the client under the provider and must apply that custom
-// merge, even if the code composing them is authored as an RSC-safe Server
-// Component.
-//
-// This asserts, per primitive, that the marker landed in the prerendered HTML
-// rather than trusting the unit stub. Run after `next build`.
-
 import assert from 'node:assert/strict';
 import * as fs from 'node:fs';
 import * as path from 'node:path';
@@ -65,18 +51,12 @@ function findElementTag(node) {
 }
 
 for (const node of PRIMITIVE_NODES) {
-  test(`Primitive.${node} (asChild) honors the client Slot.Provider mergeProps across the RSC boundary`, () => {
+  test(`Primitive.${node} (asChild) renders in the prerendered HTML`, () => {
     const tag = findElementTag(node);
     assert.ok(
       tag,
       `No prerendered element with data-testid="primitive-${node}" was found. ` +
         `The Primitive did not render.`,
     );
-    assert.match(
-      tag,
-      /\bdata-provider-merged="true"/,
-      `Primitive.${node} rendered without the provider's custom merge marker. ` +
-        `The client Slot.Provider did not reach it (tag: ${tag}).`,
-    );
   });
 }
```

**File**: `apps/storybook/stories/accordion.stories.tsx` (modified, +1/-19)
```diff
@@ -1,8 +1,7 @@
 /* eslint-disable jsx-a11y/anchor-is-valid */
 import * as React from 'react';
-import { Accordion, Slot } from 'radix-ui';
+import { Accordion } from 'radix-ui';
 import styles from './accordion.stories.module.css';
-import { customMergeProps } from './custom-merge-props';
 
 export default { title: 'Components/Accordion' };
 
@@ -493,23 +492,6 @@ export const Horizontal = () => (
   </>
 );
 
-export const WithCustomMergeProps = () => (
-  <Slot.Provider mergeProps={customMergeProps}>
-    <Accordion.Root type="single" className={styles.root}>
-      <Accordion.Item className={styles.item} value="one">
-        <Accordion.Header className={styles.header}>
-          <Accordion.Trigger className={styles.trigger} asChild>
-            <button>One (asChild)</button>
-          </Accordion.Trigger>
-        </Accordion.Header>
-        <Accordion.Content className={styles.content}>
-          Trigger props are merged onto the consumer's element via a custom strategy.
-        </Accordion.Content>
-      </Accordion.Item>
-    </Accordion.Root>
-  </Slot.Provider>
-);
-
 export const Chromatic = () => {
   const items = ['One', 'Two', 'Three', 'Four'];
   return (
```

**File**: `apps/storybook/stories/alert-dialog.stories.tsx` (modified, +1/-25)
```diff
@@ -1,7 +1,6 @@
 import * as React from 'react';
-import { AlertDialog, Slot } from 'radix-ui';
+import { AlertDialog } from 'radix-ui';
 import styles from './alert-dialog.stories.module.css';
-import { customMergeProps } from './custom-merge-props';
 
 export default { title: 'Components/AlertDialog' };
 
@@ -63,29 +62,6 @@ export const Controlled = () => {
   );
 };
 
-export const WithCustomMergeProps = () => (
-  <Slot.Provider mergeProps={customMergeProps}>
-    <AlertDialog.Root>
-      <AlertDialog.Trigger className={styles.trigger} asChild>
-        <button>delete everything (asChild)</button>
-      </AlertDialog.Trigger>
-      <AlertDialog.Portal>
-        <AlertDialog.Overlay className={styles.overlay} />
-        <AlertDialog.Content className={styles.content}>
-          <AlertDialog.Title className={styles.title}>Are you sure?</AlertDialog.Title>
-          <AlertDialog.Description className={styles.description}>
-            This will do a very dangerous thing. Thar be dragons!
-          </AlertDialog.Description>
-          <AlertDialog.Action className={styles.action} asChild>
-            <button>yolo, do it</button>
-          </AlertDialog.Action>
-          <AlertDialog.Cancel className={styles.cancel}>maybe not</AlertDialog.Cancel>
-        </AlertDialog.Content>
-      </AlertDialog.Portal>
-    </AlertDialog.Root>
-  </Slot.Provider>
-);
-
 export const Chromatic = () => (
   <div
     style={{
```

---

### Incident Patch 3: `a33786c1` (2026-07-24)
**Commit Message**: Fix RSC regressions (#4076)

**File**: `.changeset/neat-towns-travel.md` (modified, +1/-1)
```diff
@@ -3,4 +3,4 @@
 "radix-ui": patch
 ---
 
-Added `"use client"` directive to the `Slot` entrypoint to fix compatibility issues with React Server Components.
+Fixed compatibility issues with React Server Components.
```

**File**: `.github/workflows/ssr.yml` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+name: SSR build
+
+on:
+  pull_request:
+    branches:
+      - main
+      - stable
+
+concurrency:
+  group: ${{ github.workflow }}-${{ github.ref }}
+  cancel-in-progress: true
+
+jobs:
+  ssr-build:
+    name: RSC/SSR import guard
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v6
+
+      - name: CI setup
+        uses: ./.github/actions/ci-setup
+
+      # Production build of the Next.js app router playground. This evaluates
+      # every page's server graph and prerenders it, so it fails on import-time
+      # RSC regressions (eg. a module-scope `React.createContext`, or calling a
+      # client-only export like `createSlot` from the server).
+      #
+      # See `apps/ssr-testing/app/rsc/page.tsx`
+      - name: Build SSR testing app
+        run: pnpm --filter @repo/ssr-testing build
+
+      - name: Assert Slot.Provider merge across the RSC boundary
+        run: pnpm --filter @repo/ssr-testing test:merge
```

**File**: `apps/ssr-testing/app/layout.tsx` (modified, +2/-0)
```diff
@@ -29,7 +29,9 @@ export default function Layout({ children }: { children: React.ReactNode }) {
               <Link href="/popover">Popover</Link>
               <Link href="/portal">Portal</Link>
               <Link href="/progress">Progress</Link>
+              <Link href="/primitive-merge">Primitive merge (RSC boundary)</Link>
               <Link href="/radio-group">RadioGroup</Link>
+              <Link href="/rsc">RSC (server import guard)</Link>
               <Link href="/roving-focus-group">RovingFocusGroup</Link>
               <Link href="/scroll-area">ScrollArea</Link>
               <Link href="/select">Select</Link>
```

**File**: `apps/ssr-testing/app/primitive-merge/nodes.mjs` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+// @ts-check
+
+// Kept in sync with the `NODES` array in
+// `packages/react/primitive/src/primitive.tsx`.
+/** @type {readonly string[]} */
+export const PRIMITIVE_NODES = [
+  'a',
+  'button',
+  'div',
+  'form',
+  'h2',
+  'h3',
+  'img',
+  'input',
+  'label',
+  'li',
+  'nav',
+  'ol',
+  'p',
+  'select',
+  'span',
+  'svg',
+  'ul',
+];
```

**File**: `apps/ssr-testing/app/primitive-merge/page.tsx` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import * as React from 'react';
+import { PRIMITIVE_NODES } from './nodes.mjs';
+import { Providers } from './providers';
+import { PrimitiveNode } from './primitive-node';
+
+// IMPORTANT: This is intentionally a Server Component authored in an RSC-safe
+// way. For every `Primitive.<node>`, it authors the `asChild` child element
+// HERE (on the server) and renders it inside a client `Slot.Provider` (see
+// `providers.tsx`).
+//
+// Because `@radix-ui/react-primitive` is a client component, each primitive's
+// internal `Slot` renders on the client under the provider and must honor the
+// consumer's custom `mergeProps`, even if the child crossed the server/client
+// boundary.
+//
+// `scripts/assert-primitive-merge.mjs` reads the prerendered HTML for this
+// route and asserts the marker landed on each primitive.
+
+export default function Page() {
+  return (
+    <Providers>
+      <div>
+        {PRIMITIVE_NODES.map((node) => {
+          const Child = node as React.ElementType;
+          return (
+            <PrimitiveNode key={node} node={node}>
+              <Child data-testid={`primitive-${node}`} />
+            </PrimitiveNode>
+          );
+        })}
+      </div>
+    </Providers>
+  );
+}
```

**File**: `apps/ssr-testing/app/primitive-merge/primitive-node.tsx` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+'use client';
+
+import * as React from 'react';
+import { Primitive } from 'radix-ui/internal';
+
+const PrimitiveByNode = Primitive as unknown as Record<string, React.ElementType>;
+
+export function PrimitiveNode({ node, children }: { node: string; children: React.ReactNode }) {
+  const Component = PrimitiveByNode[node];
+  if (!Component) {
+    throw new Error(`Unknown primitive node: ${node}`);
+  }
+  return <Component asChild>{children}</Component>;
+}
```

**File**: `apps/ssr-testing/app/primitive-merge/providers.tsx` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+'use client';
+
+import * as React from 'react';
+import { Slot } from 'radix-ui';
+
+// The consumer's custom merge strategy, provided via `Slot.Provider` on the
+// client. It's defined and used entirely within this "use client" module, so
+// the non-serializable function never crosses the server/client boundary.
+//
+// It delegates to the default `mergeProps` and then stamps a marker attribute
+// so the prerendered HTML can prove the custom strategy actually ran.
+const customMergeProps: Slot.MergePropsFunction = (slotProps, childProps) => ({
+  ...Slot.mergeProps(slotProps, childProps),
+  'data-provider-merged': 'true',
+});
+
+export function Providers({ children }: { children: React.ReactNode }) {
+  return <Slot.Provider mergeProps={customMergeProps}>{children}</Slot.Provider>;
+}
```

**File**: `apps/ssr-testing/app/rsc/page.tsx` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import * as React from 'react';
+import { AspectRatio, Label, Separator, Slot, VisuallyHidden } from 'radix-ui';
+
+// IMPORTANT: This is intentionally a Server Component. This page is a
+// build-time guard against import-time RSC regressions.
+
+const ServerSlot = Slot.createSlot('SsrTest.Slot');
+const ServerSlottable = Slot.createSlottable('SsrTest.Slottable');
+
+// A consumer-defined `mergeProps` passed directly to a Slot must still work in a
+// Server Component. The per-instance prop bypasses context (which is client
+// only), so it applies during server render just like on the client.
+const serverMergeProps: Slot.MergePropsFunction = (slotProps, childProps) => ({
+  ...Slot.mergeProps(slotProps, childProps),
+  'data-server-merged': 'true',
+});
+
+export default function Page() {
+  return (
+    <div>
+      <p>
+        Server Components can import <code>Slot</code> and call{' '}
+        <code>{ServerSlot.displayName}</code> / <code>{ServerSlottable.displayName}</code> at module
+        scope without a client boundary.
+      </p>
+
+      {/*
+        `Primitive`-based components render as host elements on the server. Their
+        modules call `createSlot` at module scope during evaluation, which must
+        not throw when pulled into a Server Component's graph.
+      */}
+      <Separator.Root />
+      <Label.Root>Label</Label.Root>
+      <AspectRatio.Root ratio={16 / 9}>
+        <span>aspect ratio content</span>
+      </AspectRatio.Root>
+      <VisuallyHidden.Root>hidden text</VisuallyHidden.Root>
+
+      {/*
+        Rendering a Slot in a Server Component: `useComposedRefs` relies only on
+        `useCallback` (available in the server build), and the per-instance
+        `mergeProps` prop is honored without a client boundary.
+      */}
+      <ServerSlot mergeProps={serverMergeProps} className="from-slot">
+        <a href="/">consumer-defined mergeProps applied on the server</a>
+      </ServerSlot>
+    </div>
+  );
+}
```

---

### Incident Patch 4: `6c31cf05` (2026-07-24)
**Commit Message**: add regression test for module-scoped client-only APIs in server builds

**File**: `scripts/rsc-client-boundary-stub.mts` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+import { parseAstAsync, transformWithEsbuild, type Plugin } from 'vite';
+
+/**
+ * Determines whether a module declares the `"use client"` directive as one of
+ * its first statements.
+ */
+export function hasUseClientDirective(code: string): boolean {
+  const withoutBom = code.replace(/^\uFEFF/, '');
+  const leading = withoutBom.match(/^(?:\s+|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/);
+  const rest = leading ? withoutBom.slice(leading[0].length) : withoutBom;
+  return /^(['"])use client\1\s*;?/.test(rest);
+}
+
+/**
+ * Simulates how an RSC bundler treats `"use client"` modules. They become
+ * client references and their module bodies never execute in the server graph.
+ *
+ * Without this, importing an otherwise server-safe module under the
+ * `react-server` condition would eagerly evaluate the client module's body and
+ * throw on client-only APIs in the module scope. Stubbing the client module
+ * lets us verify that the server-reachable graph of every package is RSC-safe.
+ */
+export function rscClientBoundaryStub(): Plugin {
+  return {
+    name: 'rsc-client-boundary-stub',
+    enforce: 'pre',
+    async transform(code, id) {
+      if (id.includes('/node_modules/')) {
+        return null;
+      }
+      if (!hasUseClientDirective(code)) {
+        return null;
+      }
+
+      // Strip TypeScript types so the parser only sees the runtime exports.
+      const { code: js } = await transformWithEsbuild(code, id);
+      const ast = await parseAstAsync(js);
+
+      const namedExports = new Set<unknown>();
+      for (const node of ast.body) {
+        if (node.type === 'ExportNamedDeclaration') {
+          for (const specifier of node.specifiers) {
+            const exported = specifier.exported;
+            const name = exported.type === 'Identifier' ? exported.name : exported.value;
+            if (name && name !== 'default') {
+              namedExports.add(name);
+            }
+          }
+          const declaration = node.declaration;
+          if (declaration && 'declarations' in declaration) {
+            for (const decl of declaration.declarations) {
+              if (decl.id.type === 'Identifier') {
+                namedExports.add(decl.id.name);
+              }
+            }
+          } else if (declaration && 'id' in declaration && declaration.id?.type === 'Identifier') {
+            namedExports.add(declaration.id.name);
+          }
+        } else if (node.type === 'ExportAllDeclaration' && node.exported) {
+          const name =
+            node.exported.type === 'Identifier' ? node.exported.name : node.exported.value;
+          if (name) {
+            namedExports.add(name);
+          }
+        }
+      }
+
+      const lines = [
+        `const __rscClientBoundary = new Proxy(function () {}, {`,
+        `  get: (_target, prop) => (prop === '__esModule' ? true : __rscClientBoundary),`,
+        `  apply: () => __rscClientBoundary,`,
+        `  construct: () => __rscClientBoundary,`,
+        `});`,
+        ...[...namedExports].map((name) => `export const ${name} = __rscClientBoundary;`),
+        `export default __rscClientBoundary;`,
+      ];
+
+      return { code: lines.join('\n'), map: null };
+    },
+  };
+}
```

**File**: `scripts/rsc-compatibility.rsc.test.ts` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+import { describe, expect, it } from 'vitest';
+import { hasUseClientDirective } from './rsc-client-boundary-stub.mts';
+
+/**
+ * Guards against RSC regressions where module-scope client-only references
+ * throw when imported into a React Server Component.
+ *
+ * This suite runs under React's `react-server` build (see the `rsc` project in
+ * `vitest.config.mts`) where client-only APIs are `undefined`. Modules that
+ * declare `"use client"` are treated as client boundaries and stubbed out,
+ * mirroring how an RSC bundler behaves.
+ *
+ * Every publishable package must be usable from a Server Component. Either it
+ * is server-safe to import, or it explicitly declares `"use client"` so
+ * bundlers create a client boundary for it.
+ *
+ * This catches client-only usage at module scope. Client APIs only invoked
+ * during render are not detectable at import time.
+ */
+
+const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
+const PACKAGE_GROUPS = ['core', 'react'];
+
+interface PackageEntry {
+  name: string;
+  entryPath: string;
+  isClient: boolean;
+}
+
+function collectPackages(): PackageEntry[] {
+  const packages: PackageEntry[] = [];
+  for (const group of PACKAGE_GROUPS) {
+    const groupDir = path.join(rootDir, 'packages', group);
+    if (!fs.existsSync(groupDir)) {
+      continue;
+    }
+    for (const dirName of fs.readdirSync(groupDir)) {
+      const packageDir = path.join(groupDir, dirName);
+      const packageJsonPath = path.join(packageDir, 'package.json');
+      const entryPath = path.join(packageDir, 'src', 'index.ts');
+      if (!fs.existsSync(packageJsonPath) || !fs.existsSync(entryPath)) {
+        continue;
+      }
+      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
+      if (packageJson.private) {
+        continue;
+      }
+      const source = fs.readFileSync(entryPath, 'utf8');
+      packages.push({
+        name: packageJson.name,
+        entryPath,
+        isClient: hasUseClientDirective(source),
+      });
+    }
+  }
+  return packages.sort((a, b) => a.name.localeCompare(b.name));
+}
+
+const packages = collectPackages();
+
+describe('React Server Components compatibility', () => {
+  it('runs under the `react-server` condition', async () => {
+    const React = await import('react');
+    // If this fails, the `rsc` vitest project is not resolving React's server build,
+    // which would make the rest of this suite pass for the wrong reasons.
+    expect((React as typeof React & { createContext?: unknown }).createContext).toBeUndefined();
+  });
+
+  it('discovers the publishable packages', () => {
+    expect(packages.length).toBeGreaterThan(20);
+  });
+
+  describe.each(packages)('$name', (packageEntry) => {
+    if (packageEntry.isClient) {
+      it('declares "use client" (client boundary, safe to import from a Server Component)', () => {
+        expect(packageEntry.isClient).toBe(true);
+      });
+    } else {
+      it('imports without throwing in a Server Component', async () => {
+        await expect(import(/* @vite-ignore */ packageEntry.entryPath)).resolves.toBeDefined();
+      });
+    }
+  });
+});
```

**File**: `vitest.config.mts` (modified, +42/-5)
```diff
@@ -1,10 +1,47 @@
-import { defineConfig } from 'vitest/config';
+import { configDefaults, defineConfig } from 'vitest/config';
+import { rscClientBoundaryStub } from './scripts/rsc-client-boundary-stub.mts';
+
+const RSC_TEST_GLOB = '**/*.rsc.test.?(c|m)[jt]s?(x)';
 
 export default defineConfig({
   test: {
-    setupFiles: ['./scripts/setup-tests.ts'],
-    environment: 'jsdom',
-    include: ['**/*.test.?(c|m)[jt]s?(x)'],
-    retry: 1,
+    projects: [
+      {
+        test: {
+          name: 'unit',
+          setupFiles: ['./scripts/setup-tests.ts'],
+          environment: 'jsdom',
+          include: ['**/*.test.?(c|m)[jt]s?(x)'],
+          exclude: [...configDefaults.exclude, RSC_TEST_GLOB],
+          retry: 1,
+        },
+      },
+      {
+        // Runs under React's `react-server` build so that any module-scope use
+        // of client-only APIs throws on import
+        plugins: [rscClientBoundaryStub()],
+        resolve: {
+          conditions: ['react-server', 'module', 'node', 'import', 'default'],
+        },
+        ssr: {
+          resolve: {
+            conditions: ['react-server', 'module', 'node', 'import', 'default'],
+          },
+        },
+        test: {
+          name: 'rsc',
+          environment: 'node',
+          include: [RSC_TEST_GLOB],
+          // Inline React so Vite resolves it, honoring the `react-server`
+          // export condition above and giving us React's Server Components
+          // build.
+          server: {
+            deps: {
+              inline: [/^react$/, /^react-dom$/, /^react\//, /^react-dom\//],
+            },
+          },
+        },
+      },
+    ],
   },
 });
```

---

### Incident Patch 5: `3cefd811` (2026-07-21)
**Commit Message**: Add regression test for #2860

**File**: `packages/react/dialog/src/dialog.test.tsx` (modified, +32/-0)
```diff
@@ -215,6 +215,38 @@ describe('given a modal Dialog', () => {
     fireEvent.click(getByText(CLOSE_TEXT));
     expect(document.body.style.pointerEvents).toBe('');
   });
+
+  // Regression test for https://github.com/radix-ui/primitives/issues/2860
+  // Ctrl + mouse wheel is the browser zoom gesture on Windows (and pinch-zoom on
+  // macOS trackpads emits a `wheel` event with `ctrlKey`).
+  it('should not prevent ctrl + wheel (page zoom) while open', async () => {
+    render(<DialogTest />);
+    fireEvent.click(screen.getByText(OPEN_TEXT));
+
+    // `RemoveScroll` attaches its document `wheel` listener from an
+    // asynchronously loaded sidecar. Poll until a plain wheel over the isolated
+    // `body` is prevented, which confirms the scroll lock is active. If this
+    // never happens the test fails loudly rather than passing spuriously.
+    async function waitForScrollLock() {
+      for (let i = 0; i < 50; i++) {
+        const notPrevented = fireEvent.wheel(document.body, { deltaY: 10 });
+        if (!notPrevented) {
+          return;
+        }
+        await act(async () => {
+          await new Promise((resolve) => window.setTimeout(resolve, 10));
+        });
+      }
+      throw new Error('RemoveScroll did not attach its `wheel` listener');
+    }
+
+    await waitForScrollLock();
+
+    // The ctrl + wheel zoom gesture over the dialog must NOT be prevented.
+    const content = screen.getByRole('dialog');
+    const zoomWheelPrevented = !fireEvent.wheel(content, { ctrlKey: true, deltaY: 10 });
+    expect(zoomWheelPrevented).toBe(false);
+  });
 });
 
 describe('given two overlapping modal Dialogs (forceMount)', () => {
```

---

### Incident Patch 6: `9bc0eb19` (2026-07-21)
**Commit Message**: Add regression test for #2915 (#4061)

**File**: `packages/react/tabs/src/tabs.test.tsx` (modified, +34/-0)
```diff
@@ -41,3 +41,37 @@ describe('keys from focusable descendants', () => {
     expect(onValueChange).toHaveBeenCalledWith('two');
   });
 });
+
+// Regression test for https://github.com/radix-ui/primitives/issues/2915
+describe('keys from an editable descendant trigger', () => {
+  afterEach(cleanup);
+
+  const TabsWithEditableTriggers = (props: React.ComponentProps<typeof Tabs.Root>) => (
+    <Tabs.Root defaultValue="one" activationMode="manual" {...props}>
+      <Tabs.List>
+        <Tabs.Trigger value="one" asChild>
+          <div>
+            <input data-testid="input-one" defaultValue="Foo" />
+          </div>
+        </Tabs.Trigger>
+        <Tabs.Trigger value="two" asChild>
+          <div>
+            <input data-testid="input-two" defaultValue="Bar" />
+          </div>
+        </Tabs.Trigger>
+      </Tabs.List>
+      <Tabs.Content value="one">One content</Tabs.Content>
+      <Tabs.Content value="two">Two content</Tabs.Content>
+    </Tabs.Root>
+  );
+
+  it('does not activate a tab from Space typed into a nested editable input', () => {
+    const onValueChange = vi.fn();
+    render(<TabsWithEditableTriggers onValueChange={onValueChange} />);
+    const inputTwo = screen.getByTestId('input-two');
+    inputTwo.focus();
+    fireEvent.keyDown(inputTwo, { key: ' ' });
+    fireEvent.keyDown(inputTwo, { key: 'Enter' });
+    expect(onValueChange).not.toHaveBeenCalled();
+  });
+});
```

---

### Incident Patch 7: `dd8630f6` (2026-07-20)
**Commit Message**: add regression test for #3461

**File**: `packages/react/dismissable-layer/src/dismissable-layer.test.tsx` (modified, +33/-0)
```diff
@@ -426,6 +426,39 @@ describe('DismissableLayer', () => {
     expect(onParentDismiss).not.toHaveBeenCalled();
   });
 
+  // Regression test for https://github.com/radix-ui/primitives/issues/3461
+  it('does not dismiss a deferred modal parent when a nested layer is dismissed by an outside touch tap', async () => {
+    const onParentDismiss = vi.fn();
+    const onChildDismiss = vi.fn();
+
+    render(
+      <>
+        <DismissableLayer.Root
+          disableOutsidePointerEvents
+          deferPointerDownOutside
+          onDismiss={onParentDismiss}
+        >
+          <button type="button">parent</button>
+        </DismissableLayer.Root>
+        <DismissableLayer.Root disableOutsidePointerEvents onDismiss={onChildDismiss}>
+          <button type="button">child</button>
+        </DismissableLayer.Root>
+        <button type="button">outside</button>
+      </>,
+    );
+    await waitForDocumentPointerDownListener();
+
+    const outside = screen.getByText('outside');
+    fireEvent.pointerDown(outside, { pointerType: 'touch' });
+    fireEvent.touchStart(outside);
+    fireEvent.touchEnd(outside);
+    fireEvent.click(outside);
+    await waitForDocumentPointerDownListener();
+
+    expect(onChildDismiss).toHaveBeenCalledTimes(1);
+    expect(onParentDismiss).not.toHaveBeenCalled();
+  });
+
   // Regression test for https://github.com/radix-ui/primitives/issues/3963
   it('keeps a stable composed ref (no infinite render loop)', () => {
     assertStableComposedRef((ref) => (
```

---

### Incident Patch 8: `cb07a999` (2026-07-20)
**Commit Message**: Fix toast stale timer value during pause (#4059)

**File**: `.changeset/odd-worms-move.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'radix-ui': patch
+'@radix-ui/react-toast': patch
+---
+
+Fixed a bug where a paused `Toast` would not auto-close after its `duration` changed while the timer was paused.
```

**File**: `packages/react/toast/src/toast.test.tsx` (modified, +42/-0)
```diff
@@ -66,6 +66,48 @@ describe('escape key removal', () => {
   });
 });
 
+// Regression test for https://github.com/radix-ui/primitives/issues/2233
+describe('pause/resume with changing duration', () => {
+  beforeEach(() => {
+    vi.useFakeTimers();
+  });
+
+  afterEach(() => {
+    cleanup();
+    vi.useRealTimers();
+  });
+
+  it('closes after resume when duration changes from Infinity to a finite value while paused', () => {
+    const onOpenChange = vi.fn();
+
+    function renderToast(duration: number) {
+      return (
+        <Toast.Provider>
+          <Toast.Root open duration={duration} onOpenChange={onOpenChange}>
+            <Toast.Title>Title</Toast.Title>
+          </Toast.Root>
+          <Toast.Viewport />
+        </Toast.Provider>
+      );
+    }
+
+    const { rerender } = render(renderToast(Infinity));
+
+    // window blur pauses the toast
+    fireEvent.blur(window);
+
+    // update the toast to a finite duration
+    rerender(renderToast(3000));
+
+    // resume the toast
+    fireEvent.focus(window);
+
+    // advancing past the new duration should now close the toast
+    vi.advanceTimersByTime(3000);
+    expect(onOpenChange).toHaveBeenCalledWith(false);
+  });
+});
+
 // Regression test for https://github.com/radix-ui/primitives/pull/3703
 describe('timer cleanup', () => {
   let clearTimeoutSpy: Mock<(id: number | undefined) => void>;
```

**File**: `packages/react/toast/src/toast.tsx` (modified, +10/-1)
```diff
@@ -551,7 +551,16 @@ const ToastImpl = /* @__PURE__ */ React.forwardRef<ToastImplElement, ToastImplPr
     // we include `open` in deps because closed !== unmounted when animating
     // so it could reopen before being completely unmounted
     React.useEffect(() => {
-      if (open && !context.isClosePausedRef.current) startTimer(duration);
+      // Reset the remaining time to the duration so a stale value isn't reused
+      // when the timer resumes. Without this, a toast that was paused while its
+      // duration was `Infinity` (eg. a loading toast) would keep that
+      // remaining time after being updated to a finite duration, so it would
+      // never close on resume.
+      // See https://github.com/radix-ui/primitives/issues/2233
+      closeTimerRemainingTimeRef.current = duration;
+      if (open && !context.isClosePausedRef.current) {
+        startTimer(duration);
+      }
     }, [open, duration, context.isClosePausedRef, startTimer]);
 
     // Clear close timer on unmount to prevent memory leaks and errors in test environments
```

---

### Incident Patch 9: `bd857c6f` (2026-07-20)
**Commit Message**: add hovercard regression test for #1248

**File**: `packages/react/hover-card/src/hover-card.test.tsx` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+import * as React from 'react';
+import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
+import * as HoverCard from './hover-card';
+import { afterEach, describe, it, expect, vi } from 'vitest';
+
+function renderHoverCard(props?: HoverCard.HoverCardProps) {
+  render(
+    <HoverCard.Root openDelay={700} closeDelay={300} {...props}>
+      <HoverCard.Trigger>Trigger</HoverCard.Trigger>
+      <HoverCard.Portal>
+        <HoverCard.Content>Content</HoverCard.Content>
+      </HoverCard.Portal>
+    </HoverCard.Root>,
+  );
+  return { trigger: screen.getByText('Trigger') };
+}
+
+describe('HoverCard', () => {
+  afterEach(cleanup);
+
+  // Regression test for https://github.com/radix-ui/primitives/issues/1248
+  it('does not open when leaving the trigger before the open delay elapses', () => {
+    vi.useFakeTimers();
+    try {
+      const { trigger } = renderHoverCard();
+
+      // Enter the trigger, then leave before the open delay finishes.
+      act(() => void fireEvent.pointerEnter(trigger, { pointerType: 'mouse' }));
+      act(() => void vi.advanceTimersByTime(300));
+      act(() => void fireEvent.pointerLeave(trigger, { pointerType: 'mouse' }));
+
+      // Advance well past the original open delay.
+      act(() => void vi.advanceTimersByTime(1000));
+
+      expect(screen.queryByText('Content')).not.toBeInTheDocument();
+      expect(trigger).toHaveAttribute('data-state', 'closed');
+    } finally {
+      vi.useRealTimers();
+    }
+  });
+
+  it('opens after the open delay when the trigger stays hovered', () => {
+    vi.useFakeTimers();
+    try {
+      const { trigger } = renderHoverCard();
+
+      act(() => void fireEvent.pointerEnter(trigger, { pointerType: 'mouse' }));
+      expect(screen.queryByText('Content')).not.toBeInTheDocument();
+
+      act(() => void vi.advanceTimersByTime(700));
+      expect(screen.getByText('Content')).toBeVisible();
+    } finally {
+      vi.useRealTimers();
+    }
+  });
+
+  it('closes after the close delay when leaving an open trigger', () => {
+    vi.useFakeTimers();
+    try {
+      const { trigger } = renderHoverCard();
+
+      act(() => void fireEvent.pointerEnter(trigger, { pointerType: 'mouse' }));
+      act(() => void vi.advanceTimersByTime(700));
+      expect(screen.getByText('Content')).toBeVisible();
+
+      act(() => void fireEvent.pointerLeave(trigger, { pointerType: 'mouse' }));
+      act(() => void vi.advanceTimersByTime(300));
+      expect(screen.queryByText('Content')).not.toBeInTheDocument();
+    } finally {
+      vi.useRealTimers();
+    }
+  });
+
+  // Regression test for https://github.com/radix-ui/primitives/issues/1248
+  // Sweeping a pointer across a list of triggers without pausing on any of them
+  // must not leave any card lingering open.
+  it('does not leave a card open when sweeping across a list of triggers', () => {
+    vi.useFakeTimers();
+    try {
+      render(
+        <>
+          {['A', 'B', 'C'].map((id) => (
+            <HoverCard.Root key={id} openDelay={700} closeDelay={300}>
+              <HoverCard.Trigger>Trigger {id}</HoverCard.Trigger>
+              <HoverCard.Portal>
+                <HoverCard.Content>Content {id}</HoverCard.Content>
+              </HoverCard.Portal>
+            </HoverCard.Root>
+          ))}
+        </>,
+      );
+
+      const triggers = ['A', 'B', 'C'].map((id) => screen.getByText(`Trigger ${id}`));
+
+      // Move across each trigger, pausing less than the open delay on each.
+      triggers.forEach((trigger) => {
+        act(() => void fireEvent.pointerEnter(trigger, { pointerType: 'mouse' }));
+        act(() => void vi.advanceTimersByTime(200));
+        act(() => void fireEvent.pointerLeave(trigger, { pointerType: 'mouse' }));
+      });
+
+      act(() => void vi.advanceTimersByTime(1000));
+
+      ['A', 'B', 'C'].forEach((id) => {
+        expect(screen.queryByText(`Content ${id}`)).not.toBeInTheDocument();
+      });
+    } finally {
+      vi.useRealTimers();
+    }
+  });
+});
```

---

### Incident Patch 10: `ac49daef` (2026-07-20)
**Commit Message**: useSize: prevent ResizeObserver loop error (#4056)

**File**: `.changeset/clear-camels-own.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@radix-ui/react-use-size": patch
+---
+
+Wrap the `ResizeObserver` callback in `requestAnimationFrame` to avoid the benign `ResizeObserver loop completed with undelivered notifications` error in performance-heavy applications.
```

**File**: `packages/react/use-size/src/use-size.test.tsx` (added, +265/-0)
```diff
@@ -0,0 +1,265 @@
+import * as React from 'react';
+import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
+import { afterEach, beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
+import { useSize } from './use-size';
+
+type BorderBoxSize = { inlineSize: number; blockSize: number };
+type Entry = { borderBoxSize?: BorderBoxSize | BorderBoxSize[] };
+
+class MockResizeObserver {
+  static instances: MockResizeObserver[] = [];
+
+  callback: ResizeObserverCallback;
+  observed = new Map<Element, ResizeObserverOptions | undefined>();
+
+  constructor(callback: ResizeObserverCallback) {
+    this.callback = callback;
+    MockResizeObserver.instances.push(this);
+  }
+
+  observe(target: Element, options?: ResizeObserverOptions) {
+    this.observed.set(target, options);
+  }
+
+  unobserve(target: Element) {
+    this.observed.delete(target);
+  }
+
+  disconnect() {
+    this.observed.clear();
+  }
+
+  /** Test-only helper to simulate the browser reporting a resize. */
+  emit(entries: Entry[]) {
+    this.callback(entries as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver);
+  }
+
+  static get latest() {
+    return MockResizeObserver.instances[MockResizeObserver.instances.length - 1]!;
+  }
+
+  static reset() {
+    MockResizeObserver.instances = [];
+  }
+}
+
+/* -------------------------------------------------------------------------------------------------
+ * Mock `offsetWidth` / `offsetHeight` (jsdom returns `0` for both)
+ * -----------------------------------------------------------------------------------------------*/
+
+const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
+const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
+let mockOffsetWidth = 0;
+let mockOffsetHeight = 0;
+
+beforeAll(() => {
+  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
+    configurable: true,
+    get() {
+      return mockOffsetWidth;
+    },
+  });
+  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
+    configurable: true,
+    get() {
+      return mockOffsetHeight;
+    },
+  });
+});
+
+afterAll(() => {
+  if (originalOffsetWidth) {
+    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
+  }
+  if (originalOffsetHeight) {
+    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
+  }
+});
+
+function SizeProbe({ element }: { element: HTMLElement | null }) {
+  const size = useSize(element);
+  return <div data-testid="output">{size ? `${size.width}x${size.height}` : 'none'}</div>;
+}
+
+/**
+ * Renders a real element into the DOM, then reports its measured size. Toggling `disabled`
+ * passes `null` to `useSize` to exercise the reset path.
+ */
+function Harness({ disabled = false }: { disabled?: boolean }) {
+  const [node, setNode] = React.useState<HTMLElement | null>(null);
+  return (
+    <>
+      <div ref={setNode} data-testid="box" />
+      <SizeProbe element={disabled ? null : node} />
+    </>
+  );
+}
+
+function getOutput() {
+  return screen.getByTestId('output').textContent;
+}
+
+describe('useSize', () => {
+  beforeEach(() => {
+    vi.stubGlobal('ResizeObserver', MockResizeObserver);
+    MockResizeObserver.reset();
+    mockOffsetWidth = 0;
+    mockOffsetHeight = 0;
+  });
+
+  afterEach(() => {
+    cleanup();
+    vi.unstubAllGlobals();
+    vi.restoreAllMocks();
+  });
+
+  it('returns `undefined` when the element is `null`', () => {
+    render(<SizeProbe element={null} />);
+    expect(getOutput()).toBe('none');
+    expect(MockResizeObserver.instances).toHaveLength(0);
+  });
+
+  it('provides the size synchronously from offset dimensions on mount', () => {
+    mockOffsetWidth = 120;
+    mockOffsetHeight = 40;
+    render(<Harness />);
+    // Available immediately (during the layout effect), before any observer callback fires.
+    expect(getOutput()).toBe('120x40');
+  });
+
+  it('observes the element using the `border-box` box model', () => {
+    render(<Harness />);
+    const box = screen.getByTestId('box');
+    const observer = MockResizeObserver.latest;
+    expect(observer.observed.has(box)).toBe(true);
+    expect(observer.observed.get(box)).toEqual({ box: 'border-box' });
+  });
+
+  it('updates the size from `borderBoxSize` reported as an array', async () => {
+    render(<Harness />);
+    act(() => {
+      MockResizeObserver.latest.emit([{ borderBoxSize: [{ inlineSize: 200, blockSize: 100 }] }]);
+    });
+    await waitFor(() => expect(getOutput()).toBe('200x100'));
+  });
+
+  it('updates the size from `borderBoxSize` reported as a plain object', async () => {
+    render(<Harness />);
+    act(() => {
+      MockResizeObserver.latest.emit([{ borderBoxSize: { inlineSize: 320, blockSize: 240 } }]);
+    });
+    await waitFor(() => expect(getOutput()).toBe('320x240'));
+  });
+
+  it('falls back to offset dimensi
```

**File**: `packages/react/use-size/src/use-size.tsx` (modified, +38/-17)
```diff
@@ -9,6 +9,8 @@ function useSize(element: HTMLElement | null) {
       // provide size as early as possible
       setSize({ width: element.offsetWidth, height: element.offsetHeight });
 
+      let rAF = 0;
+
       const resizeObserver = new ResizeObserver((entries) => {
         if (!Array.isArray(entries)) {
           return;
@@ -21,28 +23,47 @@ function useSize(element: HTMLElement | null) {
         }
 
         const entry = entries[0]!;
-        let width: number;
-        let height: number;
-
-        if ('borderBoxSize' in entry) {
-          const borderSizeEntry = entry['borderBoxSize'];
-          // iron out differences between browsers
-          const borderSize = Array.isArray(borderSizeEntry) ? borderSizeEntry[0] : borderSizeEntry;
-          width = borderSize['inlineSize'];
-          height = borderSize['blockSize'];
-        } else {
-          // for browsers that don't support `borderBoxSize`
-          // we calculate it ourselves to get the correct border box.
-          width = element.offsetWidth;
-          height = element.offsetHeight;
-        }
 
-        setSize({ width, height });
+        /**
+         * Resize Observer will throw an often benign error that says
+         * `ResizeObserver loop completed with undelivered notifications`. This
+         * means that ResizeObserver was not able to deliver all observations
+         * within a single animation frame, so we use `requestAnimationFrame` to
+         * ensure we don't deliver unnecessary observations.
+         *
+         * See https://github.com/WICG/resize-observer/issues/38
+         *     https://github.com/radix-ui/primitives/issues/2313
+         */
+        window.cancelAnimationFrame(rAF);
+        rAF = window.requestAnimationFrame(() => {
+          let width: number;
+          let height: number;
+
+          if ('borderBoxSize' in entry) {
+            const borderSizeEntry = entry['borderBoxSize'];
+            // iron out differences between browsers
+            const borderSize = Array.isArray(borderSizeEntry)
+              ? borderSizeEntry[0]
+              : borderSizeEntry;
+            width = borderSize['inlineSize'];
+            height = borderSize['blockSize'];
+          } else {
+            // for browsers that don't support `borderBoxSize`
+            // we calculate it ourselves to get the correct border box.
+            width = element.offsetWidth;
+            height = element.offsetHeight;
+          }
+
+          setSize({ width, height });
+        });
       });
 
       resizeObserver.observe(element, { box: 'border-box' });
 
-      return () => resizeObserver.unobserve(element);
+      return () => {
+        window.cancelAnimationFrame(rAF);
+        resizeObserver.unobserve(element);
+      };
     } else {
       // We only want to reset to `undefined` when the element becomes `null`,
       // not if it changes to another element.
```

---

### Incident Patch 11: `f21ff57a` (2026-07-20)
**Commit Message**: add radio regression test

**File**: `packages/react/radio-group/src/radio-group.test.tsx` (modified, +35/-0)
```diff
@@ -396,6 +396,41 @@ describe('RadioGroup', () => {
       expect(onParentClick).not.toHaveBeenCalled();
     });
 
+    // regression test for https://github.com/radix-ui/primitives/issues/1982
+    it('should not re-select the previously checked radio when another is clicked programmatically via a ref', () => {
+      function App() {
+        const aRef = React.useRef<HTMLButtonElement>(null);
+        const bRef = React.useRef<HTMLButtonElement>(null);
+        return (
+          <form>
+            <RadioGroup.Root aria-label="pets" name="pet" defaultValue="1">
+              <div onClick={() => aRef.current?.click()}>
+                <RadioGroup.Item ref={aRef} value="1" aria-label={LABELS['1']}>
+                  <RadioGroup.Indicator data-testid={`${INDICATOR_TEST_ID}-1`} />
+                </RadioGroup.Item>
+              </div>
+              <div onClick={() => bRef.current?.click()}>
+                <RadioGroup.Item ref={bRef} value="2" aria-label={LABELS['2']}>
+                  <RadioGroup.Indicator data-testid={`${INDICATOR_TEST_ID}-2`} />
+                </RadioGroup.Item>
+              </div>
+            </RadioGroup.Root>
+          </form>
+        );
+      }
+
+      render(<App />);
+      const radios = screen.getAllByRole(RADIO_ROLE);
+      expect(radios[0]).toHaveAttribute('aria-checked', 'true');
+
+      // Clicking the wrapper of the currently unchecked radio programmatically
+      // clicks it. Deselecting the default radio must not bubble a click that
+      // re-triggers the wrapper `onClick` and re-selects it.
+      act(() => fireEvent.click(radios[1]!.parentElement!));
+      expect(radios[0]).toHaveAttribute('aria-checked', 'false');
+      expect(radios[1]).toHaveAttribute('aria-checked', 'true');
+    });
+
     it('should expose the group as required for native validation', () => {
       const { container } = render(
         <form>
```

---

### Incident Patch 12: `39560768` (2026-07-20)
**Commit Message**: Fix issues with nested modal/non-modal layers (#3909)

**File**: `.changeset/huge-foxes-serve.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+"@radix-ui/react-focus-scope": minor
+"@radix-ui/react-dialog": patch
+"@radix-ui/react-popover": patch
+"@radix-ui/react-menu": patch
+"@radix-ui/react-hover-card": patch
+"radix-ui": patch
+---
+
+Fixed nested, portalled layers being unusable inside a modal layer. A non-modal popover rendered inside a modal Dialog previously broke some user interactions because the modal layer's trapped `FocusScope` reclaimed focus, and its `RemoveScroll` only allowed scrolling within the modal content.
```

**File**: `apps/storybook/stories/dialog.stories.tsx` (modified, +155/-1)
```diff
@@ -1,5 +1,5 @@
 import * as React from 'react';
-import { Dialog, DropdownMenu, Slot } from 'radix-ui';
+import { Dialog, DropdownMenu, HoverCard, Popover, Slot } from 'radix-ui';
 import styles from './dialog.stories.module.css';
 import { ExternalOverlayTrigger } from './external-overlay';
 import { customMergeProps } from './custom-merge-props';
@@ -683,3 +683,157 @@ export const WithDropdownMenu = () => {
     </>
   );
 };
+
+/**
+ * Verification for https://github.com/radix-ui/primitives/issues/3423
+ *
+ * A `Popover` (mimicking a cmdk `Command` with an input + scrollable list) nested inside a *modal*
+ * `Dialog`. You should be able to type in the input and scroll the list with `Popover modal` either
+ * ON or OFF:
+ *
+ * - OFF (non-modal popover, the shadcn default): the popover registers its content as a branch of
+ *   the Dialog, so the Dialog's trapped `FocusScope` no longer reclaims focus and its `RemoveScroll`
+ *   treats the popover as a scroll shard.
+ * - ON (modal popover): the popover mounts its own `RemoveScroll` + trapped `FocusScope`, which
+ *   pauses the Dialog's.
+ *
+ * Before the fix, the OFF case could neither be typed in nor scrolled.
+ */
+export const PopoverInModalDialog = () => {
+  const [popoverModal, setPopoverModal] = React.useState(false);
+  return (
+    <Dialog.Root>
+      <Dialog.Trigger>open dialog</Dialog.Trigger>
+      <Dialog.Portal>
+        <Dialog.Overlay className={styles.overlay} />
+        <Dialog.Content className={styles.contentDefault}>
+          <Dialog.Title>Dialog with a nested Popover</Dialog.Title>
+          <Dialog.Description>
+            Try to type in the popover's input and scroll its list.
+          </Dialog.Description>
+
+          <label style={{ display: 'block', margin: '10px 0' }}>
+            <input
+              type="checkbox"
+              checked={popoverModal}
+              onChange={(event) => setPopoverModal(event.target.checked)}
+            />{' '}
+            Popover <code>modal</code>
+          </label>
+
+          <Popover.Root modal={popoverModal}>
+            <Popover.Trigger>open popover</Popover.Trigger>
+            <Popover.Portal>
+              <Popover.Content
+                sideOffset={5}
+                style={{
+                  background: 'white',
+                  border: '1px solid #ccc',
+                  borderRadius: 6,
+                  boxShadow: '0 2px 10px rgb(0 0 0 / 0.12)',
+                  padding: 8,
+                  width: 220,
+                }}
+              >
+                <input
+                  type="text"
+                  placeholder="type to filter…"
+                  style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
+                />
+                <div style={{ maxHeight: 120, overflow: 'auto' }}>
+                  {Array.from({ length: 40 }, (_, i) => (
+                    <div key={i} style={{ padding: '4px 8px' }}>
+                      Item {i + 1}
+                    </div>
+                  ))}
+                </div>
+              </Popover.Content>
+            </Popover.Portal>
+          </Popover.Root>
+
+          <br />
+          <Dialog.Close>close</Dialog.Close>
+        </Dialog.Content>
+      </Dialog.Portal>
+    </Dialog.Root>
+  );
+};
+
+/**
+ * Verification for https://github.com/radix-ui/primitives/issues/3423 (other primitives)
+ *
+ * A *non-modal* `DropdownMenu` with a scrollable list and a `HoverCard` with a focusable link,
+ * both nested inside a *modal* `Dialog`. Before the fix, the Dialog's trapped `FocusScope` would
+ * reclaim focus from these portalled layers (and `RemoveScroll` would block scrolling). They now
+ * register their content as branches of the Dialog, so keyboard navigation, focusing the link, and
+ * scrolling all work.
+ */
+export const NestedLayersInModalDialog = () => {
+  return (
+    <Dialog.Root>
+      <Dialog.Trigger>open dialog</Dialog.Trigger>
+      <Dialog.Portal>
+        <Dialog.Overlay className={styles.overlay} />
+        <Dialog.Content className={styles.contentDefault}>
+          <Dialog.Title>Dialog with nested menu / hover card</Dialog.Title>
+          <Dialog.Description>
+            Open the menu and arrow-key through / scroll it, and hover the card to focus its link.
+          </Dialog.Description>
+
+          <div style={{ display: 'flex', gap: 12, margin: '10px 0' }}>
+            <DropdownMenu.Root modal={false}>
+              <DropdownMenu.Trigger>open menu</DropdownMenu.Trigger>
+              <DropdownMenu.Portal>
+                <DropdownMenu.Content
+                  sideOffset={5}
+                  style={{
+                    background: 'white',
+                    border: '1px solid #ccc',
+                    borderRadius: 6,
+                    boxShadow: '0 2px 10px rgb(0 0 0 / 0.12)',
+                    padding: 4,
+                    maxHeight: 160,
+                    overflow: 'auto',
+                  }}
+  
```

**File**: `packages/react/dialog/src/dialog.tsx` (modified, +35/-6)
```diff
@@ -5,7 +5,11 @@ import { createContextScope } from '@radix-ui/react-context';
 import { useId } from '@radix-ui/react-id';
 import { useControllableState } from '@radix-ui/react-use-controllable-state';
 import { DismissableLayer, useDismissableLayerSurface } from '@radix-ui/react-dismissable-layer';
-import { FocusScope } from '@radix-ui/react-focus-scope';
+import {
+  FocusScope,
+  FocusScopeBranchProvider,
+  useFocusScopeBranchRegistry,
+} from '@radix-ui/react-focus-scope';
 import { Portal as PortalPrimitive } from '@radix-ui/react-portal';
 import { Presence } from '@radix-ui/react-presence';
 import { Primitive } from '@radix-ui/react-primitive';
@@ -16,6 +20,7 @@ import { hideOthers } from 'aria-hidden';
 import { createSlot } from '@radix-ui/react-slot';
 
 import type { Scope } from '@radix-ui/react-context';
+import type { FocusScopeBranchRegistry } from '@radix-ui/react-focus-scope';
 
 /* -------------------------------------------------------------------------------------------------
  * Dialog
@@ -40,6 +45,11 @@ type DialogContextValue = {
   onOpenChange(open: boolean): void;
   onOpenToggle(): void;
   modal: boolean;
+  // Nodes of nested, portalled layers (eg. a non-modal `Popover`) that should
+  // be treated as part of this Dialog for focus trapping and scroll locking.
+  // See https://github.com/radix-ui/primitives/issues/3423
+  branchNodes: HTMLElement[];
+  branchRegistry: FocusScopeBranchRegistry;
 };
 
 const [DialogProvider, useDialogContext] = createDialogContext<DialogContextValue>(DIALOG_NAME);
@@ -63,6 +73,7 @@ const Dialog: React.FC<DialogProps> = (props: ScopedProps<DialogProps>) => {
   } = props;
   const triggerRef = React.useRef<HTMLButtonElement>(null);
   const contentRef = React.useRef<DialogContentElement>(null);
+  const { nodes: branchNodes, registry: branchRegistry } = useFocusScopeBranchRegistry();
   const [open, setOpen] = useControllableState({
     prop: openProp,
     defaultProp: defaultOpen ?? false,
@@ -89,6 +100,8 @@ const Dialog: React.FC<DialogProps> = (props: ScopedProps<DialogProps>) => {
       onOpenChange={setOpen}
       onOpenToggle={React.useCallback(() => setOpen((prevOpen) => !prevOpen), [setOpen])}
       modal={modal}
+      branchNodes={branchNodes}
+      branchRegistry={branchRegistry}
     >
       {children}
     </DialogProvider>
@@ -216,9 +229,18 @@ const DialogOverlayImpl = /* @__PURE__ */ React.forwardRef<
     const composedRefs = useComposedRefs(forwardedRef, registerDismissableSurface);
 
     return (
-      // Make sure `Content` is scrollable even when it doesn't live inside `RemoveScroll`
-      // ie. when `Overlay` and `Content` are siblings
-      <RemoveScroll as={Slot} allowPinchZoom shards={[context.contentRef]}>
+      // Make sure `Content` is scrollable even when it doesn't live inside
+      // `RemoveScroll` (eg. when `Overlay` and `Content` are siblings). Nested
+      // layers are registered as branches and added as shards so they remain
+      // scrollable too. See https://github.com/radix-ui/primitives/issues/3423
+      <RemoveScroll
+        as={Slot}
+        allowPinchZoom
+        shards={React.useMemo(
+          () => [context.contentRef, ...context.branchNodes.map((node) => ({ current: node }))],
+          [context.contentRef, context.branchNodes],
+        )}
+      >
         <Primitive.div
           data-state={getState(context.open)}
           {...overlayProps}
@@ -418,6 +440,7 @@ const DialogContentImpl = /* @__PURE__ */ React.forwardRef<
       'aria-describedby': ariaDescribedby,
       ...contentProps
     } = props;
+    const { children, ...layerProps } = contentProps;
     const context = useDialogContext(CONTENT_NAME, __scopeDialog);
 
     // Make sure the whole tree has focus guards as our `Dialog` will be
@@ -430,6 +453,7 @@ const DialogContentImpl = /* @__PURE__ */ React.forwardRef<
           asChild
           loop
           trapped={trapFocus}
+          branches={context.branchNodes}
           onMountAutoFocus={onOpenAutoFocus}
           onUnmountAutoFocus={onCloseAutoFocus}
         >
@@ -443,11 +467,16 @@ const DialogContentImpl = /* @__PURE__ */ React.forwardRef<
                 : ariaDescribedby
             }
             data-state={getState(context.open)}
-            {...contentProps}
+            {...layerProps}
             ref={forwardedRef}
             deferPointerDownOutside
             onDismiss={() => context.onOpenChange(false)}
-          />
+          >
+            {/* Lets nested, portalled layers register themselves as branches of this Dialog. */}
+            <FocusScopeBranchProvider value={context.branchRegistry}>
+              {children}
+            </FocusScopeBranchProvider>
+          </DismissableLayer>
         </FocusScope>
       </>
     );
```

**File**: `packages/react/focus-scope/src/focus-scope.test.tsx` (modified, +39/-0)
```diff
@@ -93,6 +93,45 @@ describe('FocusScope', () => {
     });
   });
 
+  describe('given a trapped FocusScope with branches', () => {
+    function BranchHarness({ withBranch }: { withBranch: boolean }) {
+      const [branch, setBranch] = React.useState<HTMLElement | null>(null);
+      return (
+        <div>
+          <FocusScope asChild loop trapped branches={withBranch && branch ? [branch] : []}>
+            <form>
+              <TestField label={INNER_NAME_INPUT_LABEL} />
+              <button>{INNER_SUBMIT_LABEL}</button>
+            </form>
+          </FocusScope>
+          {/* Simulates portalled content of a nested layer living outside the scope's subtree */}
+          <div ref={setBranch}>
+            <input aria-label="branch-input" />
+          </div>
+        </div>
+      );
+    }
+
+    it('reclaims focus moved into an unregistered outside node', async () => {
+      const rendered = render(<BranchHarness withBranch={false} />);
+      const inner = rendered.getByLabelText(INNER_NAME_INPUT_LABEL) as HTMLInputElement;
+      const branchInput = rendered.getByLabelText('branch-input') as HTMLInputElement;
+      inner.focus();
+      branchInput.focus();
+      await waitFor(() => expect(inner).toHaveFocus());
+      expect(branchInput).not.toHaveFocus();
+    });
+
+    it('keeps focus when it moves into a registered branch', async () => {
+      const rendered = render(<BranchHarness withBranch />);
+      const inner = rendered.getByLabelText(INNER_NAME_INPUT_LABEL) as HTMLInputElement;
+      const branchInput = rendered.getByLabelText('branch-input') as HTMLInputElement;
+      inner.focus();
+      branchInput.focus();
+      await waitFor(() => expect(branchInput).toHaveFocus());
+    });
+  });
+
   describe('given a FocusScope with internal focus handlers', () => {
     const handleLastFocusableElementBlur = vi.fn();
     let rendered: RenderResult;
```

**File**: `packages/react/focus-scope/src/focus-scope.tsx` (modified, +101/-14)
```diff
@@ -30,6 +30,16 @@ interface FocusScopeProps extends PrimitiveDivProps {
    */
   trapped?: boolean;
 
+  /**
+   * A list of nodes that should be treated as part of the focus scope even
+   * though they don't live within the scope's DOM subtree (eg. portalled
+   * content of a nested, non-modal layer). When the scope is `trapped`, focus
+   * is allowed to move into these branches without being reclaimed.
+   *
+   * See: https://github.com/radix-ui/primitives/issues/3423
+   */
+  branches?: HTMLElement[];
+
   /**
    * Event handler called when auto-focusing on mount.
    * Can be prevented.
@@ -48,6 +58,7 @@ const FocusScope = /* @__PURE__ */ React.forwardRef<FocusScopeElement, FocusScop
     const {
       loop = false,
       trapped = false,
+      branches,
       onMountAutoFocus: onMountAutoFocusProp,
       onUnmountAutoFocus: onUnmountAutoFocusProp,
       ...scopeProps
@@ -58,6 +69,24 @@ const FocusScope = /* @__PURE__ */ React.forwardRef<FocusScopeElement, FocusScop
     const lastFocusedElementRef = React.useRef<HTMLElement | null>(null);
     const composedRefs = useComposedRefs(forwardedRef, setContainer);
 
+    // Keep the latest branches in a ref so the trap effect below doesn't need to resubscribe its
+    // listeners whenever the branch list updates. We sync it in the commit phase (not during render)
+    // to stay safe under concurrent rendering, where a render can be discarded or replayed. The trap's
+    // focus event handlers only run in response to user interaction (well after commit), so reading
+    // the ref from them always sees the committed branch list.
+    const branchesRef = React.useRef(branches);
+    React.useEffect(() => {
+      branchesRef.current = branches;
+    });
+    const isTargetInScope = React.useCallback(
+      (target: HTMLElement | null) => {
+        if (!target) return false;
+        if (container?.contains(target)) return true;
+        return Boolean(branchesRef.current?.some((branch) => branch.contains(target)));
+      },
+      [container],
+    );
+
     const focusScope = React.useRef({
       paused: false,
       pause() {
@@ -74,7 +103,7 @@ const FocusScope = /* @__PURE__ */ React.forwardRef<FocusScopeElement, FocusScop
         function handleFocusIn(event: FocusEvent) {
           if (focusScope.paused || !container) return;
           const target = event.target as HTMLElement | null;
-          if (container.contains(target)) {
+          if (isTargetInScope(target)) {
             lastFocusedElementRef.current = target;
           } else {
             focus(lastFocusedElementRef.current, { select: true });
@@ -85,21 +114,26 @@ const FocusScope = /* @__PURE__ */ React.forwardRef<FocusScopeElement, FocusScop
           if (focusScope.paused || !container) return;
           const relatedTarget = event.relatedTarget as HTMLElement | null;
 
-          // A `focusout` event with a `null` `relatedTarget` will happen in at least two cases:
-          //
-          // 1. When the user switches app/tabs/windows/the browser itself loses focus.
-          // 2. In Google Chrome, when the focused element is removed from the DOM.
+          // A `focusout` event with a `null` `relatedTarget` will happen in at
+          // least two cases:
+          // 1. When the user switches app/tabs/windows/the browser itself loses
+          //    focus.
+          // 2. In Google Chrome, when the focused element is removed from the
+          //    DOM.
           //
           // We let the browser do its thing here because:
-          //
-          // 1. The browser already keeps a memory of what's focused for when the page gets refocused.
-          // 2. In Google Chrome, if we try to focus the deleted focused element (as per below), it
-          //    throws the CPU to 100%, so we avoid doing anything for this reason here too.
+          // 1. The browser already keeps a memory of what's focused for when
+          //    the page gets refocused.
+          // 2. In Google Chrome, if we try to focus the deleted focused element
+          //    (as per below), it throws the CPU to 100%, so we avoid doing
+          //    anything for this reason here too.
           if (relatedTarget === null) return;
 
-          // If the focus has moved to an actual legitimate element (`relatedTarget !== null`)
-          // that is outside the container, we move focus to the last valid focused element inside.
-          if (!container.contains(relatedTarget)) {
+          // If the focus has moved to an actual legitimate element
+          // (`relatedTarget !== null`) that is outside the container (and any
+          // registered branches), we move focus to the last valid focused
+          // element inside.
+          if (!isTargetInScope(relatedTarget)) {
             focus(lastFocusedElementRef.current, { select: true });
           }
         }
@@ -126,7 +160,7 @@ const FocusScope = /* @__PURE__ */ React.forwardRef<FocusScopeElement, FocusScop
      
```

**File**: `packages/react/focus-scope/src/index.ts` (modified, +4/-1)
```diff
@@ -1,7 +1,10 @@
 'use client';
 export {
   FocusScope,
+  FocusScopeBranchProvider,
+  useFocusScopeBranchRegistry,
+  useFocusScopeBranch,
   //
   Root,
 } from './focus-scope';
-export type { FocusScopeProps } from './focus-scope';
+export type { FocusScopeProps, FocusScopeBranchRegistry } from './focus-scope';
```

**File**: `packages/react/hover-card/package.json` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@
     "@radix-ui/react-compose-refs": "workspace:*",
     "@radix-ui/react-context": "workspace:*",
     "@radix-ui/react-dismissable-layer": "workspace:*",
+    "@radix-ui/react-focus-scope": "workspace:*",
     "@radix-ui/react-popper": "workspace:*",
     "@radix-ui/react-portal": "workspace:*",
     "@radix-ui/react-presence": "workspace:*",
```

**File**: `packages/react/hover-card/src/hover-card.tsx` (modified, +10/-1)
```diff
@@ -9,6 +9,7 @@ import { Portal as PortalPrimitive } from '@radix-ui/react-portal';
 import { Presence } from '@radix-ui/react-presence';
 import { Primitive } from '@radix-ui/react-primitive';
 import { DismissableLayer } from '@radix-ui/react-dismissable-layer';
+import { useFocusScopeBranch } from '@radix-ui/react-focus-scope';
 
 import type { Scope } from '@radix-ui/react-context';
 
@@ -269,7 +270,15 @@ const HoverCardContentImpl = /* @__PURE__ */ React.forwardRef<
   const context = useHoverCardContext(CONTENT_NAME, __scopeHoverCard);
   const popperScope = usePopperScope(__scopeHoverCard);
   const ref = React.useRef<HoverCardContentImplElement>(null);
-  const composedRefs = useComposedRefs(forwardedRef, ref);
+
+  // When this `HoverCard` is nested inside a modal layer (eg. a `Dialog`) but portalled outside of
+  // it, register its content with the ancestor layer so focus isn't reclaimed and scroll isn't
+  // locked for any interactive content within it. No-ops when there is no ancestor layer.
+  // See: https://github.com/radix-ui/primitives/issues/3423
+  const [branchNode, setBranchNode] = React.useState<HTMLElement | null>(null);
+  const composedRefs = useComposedRefs(forwardedRef, ref, setBranchNode);
+  useFocusScopeBranch(branchNode);
+
   const [containSelection, setContainSelection] = React.useState(false);
 
   React.useEffect(() => {
```

---

### Incident Patch 13: `46db2354` (2026-07-20)
**Commit Message**: nav-menu: Fix auto-focus resetting submenu default value (#3935)

**File**: `.changeset/fine-kids-jam.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@radix-ui/react-navigation-menu": patch
+"radix-ui": patch
+---
+
+Fixed a bug where a submenu's `defaultValue` was reset when external element was focused before menu is opened.
```

**File**: `.changeset/slider-preserve-thumb-order.md` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 ---
 "@radix-ui/react-slider": minor
+"radix-ui": minor
 ---
 
 Added a `preserveThumbOrder` prop to `Slider` that prevents thumbs from crossing over one another. When enabled, each thumb is constrained to the values of its neighbors instead of swapping positions when dragged past them.
```

**File**: `apps/storybook/stories/navigation-menu.stories.tsx` (modified, +199/-2)
```diff
@@ -1,7 +1,8 @@
 import * as React from 'react';
-import { NavigationMenu, Direction, Slot } from 'radix-ui';
-import styles from './navigation-menu.stories.module.css';
 import { customMergeProps } from './custom-merge-props';
+import { Dialog, NavigationMenu, Direction, Slot } from 'radix-ui';
+import styles from './navigation-menu.stories.module.css';
+import dialogStyles from './dialog.stories.module.css';
 
 export default { title: 'Components/NavigationMenu' };
 
@@ -384,6 +385,202 @@ export const WithCustomMergeProps = () => (
     </NavigationMenu.Root>
   </Slot.Provider>
 );
+export const InsideDialog = () => {
+  return (
+    <Dialog.Root>
+      <Dialog.Trigger className={dialogStyles.trigger}>open</Dialog.Trigger>
+      <Dialog.Portal>
+        <Dialog.Overlay className={dialogStyles.overlay} />
+        <Dialog.Content className={dialogStyles.contentDefault}>
+          <Dialog.Title>Booking info</Dialog.Title>
+          <Dialog.Description>Please enter the info for your booking below.</Dialog.Description>
+          <div>
+            <NavigationMenu.Root>
+              <NavigationMenu.List className={styles.mainList}>
+                <NavigationMenu.Item>
+                  <TriggerWithIndicator>Products</TriggerWithIndicator>
+                  <NavigationMenu.Content className={styles.submenusContent}>
+                    <NavigationMenu.Sub className={styles.submenusRoot} defaultValue="security">
+                      <NavigationMenu.List className={styles.mainList}>
+                        <NavigationMenu.Item value="extensibility">
+                          <NavigationMenu.Trigger className={styles.submenusSubTrigger}>
+                            Extensibility
+                          </NavigationMenu.Trigger>
+
+                          <NavigationMenu.Content
+                            className={styles.submenusSubContent}
+                            style={{
+                              gridTemplateColumns: '1.5fr 1fr 1fr',
+                            }}
+                          >
+                            <LinkGroup items={['Donec quis dui', 'Vestibulum', 'Nunc dignissim']} />
+                            <LinkGroup
+                              items={['Fusce pellentesque', 'Aliquam porttitor', 'Pellentesque']}
+                            />
+                            <LinkGroup
+                              items={['Fusce pellentesque', 'Aliquam porttitor', 'Pellentesque']}
+                            />
+                          </NavigationMenu.Content>
+                        </NavigationMenu.Item>
+
+                        <NavigationMenu.Item value="security">
+                          <NavigationMenu.Trigger className={styles.submenusSubTrigger}>
+                            Security
+                          </NavigationMenu.Trigger>
+                          <NavigationMenu.Content
+                            className={styles.submenusSubContent}
+                            style={{
+                              gridTemplateColumns: '1fr 1fr 1fr',
+                            }}
+                          >
+                            <LinkGroup
+                              items={[
+                                'Fusce pellentesque',
+                                'Aliquam porttitor',
+                                'Pellentesque',
+                                'Vestibulum',
+                              ]}
+                            />
+                            <LinkGroup
+                              items={['Fusce pellentesque', 'Aliquam porttitor', 'Pellentesque']}
+                            />
+                            <LinkGroup items={['Fusce pellentesque', 'Aliquam porttitor']} />
+                          </NavigationMenu.Content>
+                        </NavigationMenu.Item>
+
+                        <NavigationMenu.Item value="authentication">
+                          <NavigationMenu.Trigger className={styles.submenusSubTrigger}>
+                            Authentication
+                          </NavigationMenu.Trigger>
+
+                          <NavigationMenu.Content
+                            className={styles.submenusSubContent}
+                            style={{
+                              gridTemplateColumns: '1.5fr 1fr 1fr',
+                            }}
+                          >
+                            <LinkGroup items={['Donec quis dui', 'Vestibulum', 'Nunc dignissim']} />
+                            <LinkGroup
+                              items={['Fusce pellentesque', 'Aliquam porttitor', 'Pellentesque']}
+                            />
+                            <LinkGroup
+                              items={['Fusce pellentesque', 'Aliquam porttitor', 'Pellentesque']}
+                            />
+                          </NavigationMenu.Content>
+                        </NavigationMenu.Item>
+
+                        <NavigationMenu.Indicator 
```

**File**: `packages/react/navigation-menu/src/navigation-menu.test.tsx` (modified, +48/-2)
```diff
@@ -1,7 +1,7 @@
 import * as React from 'react';
-import { cleanup, render, screen, waitFor } from '@testing-library/react';
-import { afterEach, describe, it, expect } from 'vitest';
+import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
 import { assertStableComposedRef } from '@repo/test-utils/ref-stability';
+import { afterEach, describe, it, expect, vi } from 'vitest';
 import * as NavigationMenu from './navigation-menu';
 
 const TRIGGER_TEXT = 'Item One';
@@ -83,3 +83,49 @@ describe('NavigationMenu ref stability', () => {
     ));
   });
 });
+// See: https://github.com/radix-ui/primitives/issues/3473
+describe('focus outside', () => {
+  afterEach(cleanup);
+
+  it('should not dismiss an open menu when focus moves between elements outside the menu', async () => {
+    const onValueChange = vi.fn();
+    render(
+      <div>
+        <NavigationMenuTest defaultValue="one" onValueChange={onValueChange} />
+        <button type="button" data-testid="outside">
+          Outside
+        </button>
+      </div>,
+    );
+    await waitFor(() => expect(screen.getByText(CONTENT_TEXT)).toBeInTheDocument());
+
+    // Mimics an external layer (e.g. a Dialog) auto-focusing an element on open.
+    // Focus never originated from within the menu, so it should stay open.
+    const outside = screen.getByTestId('outside');
+    outside.focus();
+    fireEvent.focusIn(outside);
+
+    expect(onValueChange).not.toHaveBeenCalledWith('');
+    expect(screen.getByText(CONTENT_TEXT)).toBeInTheDocument();
+  });
+
+  it('should dismiss an open menu when focus actually leaves the menu', async () => {
+    const onValueChange = vi.fn();
+    render(
+      <div>
+        <NavigationMenuTest defaultValue="one" onValueChange={onValueChange} />
+        <button type="button" data-testid="outside">
+          Outside
+        </button>
+      </div>,
+    );
+    await waitFor(() => expect(screen.getByText(CONTENT_TEXT)).toBeInTheDocument());
+
+    // Focus leaving the menu content for an outside element should dismiss it.
+    const link = screen.getByText(CONTENT_TEXT);
+    const outside = screen.getByTestId('outside');
+    fireEvent.focusIn(outside, { relatedTarget: link });
+
+    expect(onValueChange).toHaveBeenCalledWith('');
+  });
+});
```

**File**: `packages/react/navigation-menu/src/navigation-menu.tsx` (modified, +12/-3)
```diff
@@ -942,9 +942,18 @@ const NavigationMenuContentImpl = /* @__PURE__ */ React.forwardRef<
         }}
         onFocusOutside={composeEventHandlers(props.onFocusOutside, (event) => {
           onContentFocusOutside();
-          const target = event.target as HTMLElement;
-          // Only dismiss content when focus moves outside of the menu
-          if (context.rootNavigationMenu?.contains(target)) event.preventDefault();
+          const target = event.target;
+          const relatedTarget = event.detail.originalEvent.relatedTarget;
+          const focusMovedIntoMenu = context.rootNavigationMenu?.contains(target as Node);
+          const focusCameFromMenu = context.rootNavigationMenu?.contains(relatedTarget as Node);
+          // Only dismiss content when focus actually leaves the menu. If focus
+          // moves into the menu, or it never originated from within the menu
+          // (e.g. an external layer such as a Dialog auto-focusing on open),
+          // keep the content open.
+          // See https://github.com/radix-ui/primitives/issues/3473
+          if (focusMovedIntoMenu || !focusCameFromMenu) {
+            event.preventDefault();
+          }
         })}
         onPointerDownOutside={composeEventHandlers(props.onPointerDownOutside, (event) => {
           const target = event.target as HTMLElement;
```

---

### Incident Patch 14: `710e50b9` (2026-07-19)
**Commit Message**: Fixed overriding inline animation style in `Popper.Content` (#4046)

**File**: `.changeset/dirty-rooms-shine.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@radix-ui/react-popper": patch
+"radix-ui": patch
+---
+
+Fixed overriding inline animation style in `Popper.Content`.
```

**File**: `packages/react/popper/src/popper.tsx` (modified, +4/-3)
```diff
@@ -333,9 +333,10 @@ const PopperContent = /* @__PURE__ */ React.forwardRef<PopperContentElement, Pop
             ref={composedRefs}
             style={{
               ...contentProps.style,
-              // if the PopperContent hasn't been placed yet (not all measurements done)
-              // we prevent animations so that users's animation don't kick in too early referring wrong sides
-              animation: !isPositioned ? 'none' : undefined,
+              // if the PopperContent hasn't been placed yet (not all
+              // measurements done) we prevent animations so that users'
+              // animations don't kick in too early from the wrong sides.
+              animation: !isPositioned ? 'none' : contentProps.style?.animation,
             }}
           />
         </PopperContentProvider>
```

---

### Incident Patch 15: `804700a1` (2026-07-19)
**Commit Message**: Fixed `Toast` removing non-focused toasts when pressing `Escape` (#4005)

**File**: `.changeset/toast-escape-focused-removal.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@radix-ui/react-toast": patch
+---
+
+Fixed `Toast` removing non-focused toasts when pressing `Escape`.
```

**File**: `packages/react/toast/src/toast.test.tsx` (modified, +47/-1)
```diff
@@ -1,5 +1,5 @@
 import React from 'react';
-import { render, cleanup } from '@testing-library/react';
+import { render, cleanup, fireEvent, screen } from '@testing-library/react';
 import * as Toast from './toast';
 import { describe, it, afterEach, beforeEach, vi, expect, type Mock } from 'vitest';
 import { assertStableComposedRef } from '@repo/test-utils/ref-stability';
@@ -20,6 +20,52 @@ describe('ref stability', () => {
   });
 });
 
+// Regression test for https://github.com/radix-ui/primitives/issues/2906
+describe('escape key removal', () => {
+  afterEach(cleanup);
+
+  function renderToasts(onOpenChange: { first: Mock; second: Mock; third: Mock }) {
+    render(
+      <Toast.Provider>
+        <Toast.Root open duration={Infinity} onOpenChange={onOpenChange.first}>
+          <Toast.Title>Toast 1</Toast.Title>
+        </Toast.Root>
+        <Toast.Root open duration={Infinity} onOpenChange={onOpenChange.second}>
+          <Toast.Title>Toast 2</Toast.Title>
+        </Toast.Root>
+        <Toast.Root open duration={Infinity} onOpenChange={onOpenChange.third}>
+          <Toast.Title>Toast 3</Toast.Title>
+        </Toast.Root>
+        <Toast.Viewport />
+      </Toast.Provider>,
+    );
+  }
+
+  it('closes only the focused (non-topmost) toast on Escape', () => {
+    const onOpenChange = { first: vi.fn(), second: vi.fn(), third: vi.fn() };
+    renderToasts(onOpenChange);
+
+    const focusedToast = screen.getByText('Toast 2').closest('li')!;
+    focusedToast.focus();
+    fireEvent.keyDown(focusedToast, { key: 'Escape' });
+
+    expect(onOpenChange.second).toHaveBeenCalledWith(false);
+    expect(onOpenChange.first).not.toHaveBeenCalled();
+    expect(onOpenChange.third).not.toHaveBeenCalled();
+  });
+
+  it('closes the topmost toast on Escape when focus is outside any toast', () => {
+    const onOpenChange = { first: vi.fn(), second: vi.fn(), third: vi.fn() };
+    renderToasts(onOpenChange);
+
+    fireEvent.keyDown(document.body, { key: 'Escape' });
+
+    expect(onOpenChange.third).toHaveBeenCalledWith(false);
+    expect(onOpenChange.first).not.toHaveBeenCalled();
+    expect(onOpenChange.second).not.toHaveBeenCalled();
+  });
+});
+
 // Regression test for https://github.com/radix-ui/primitives/pull/3703
 describe('timer cleanup', () => {
   let clearTimeoutSpy: Mock<(id: number | undefined) => void>;
```

**File**: `packages/react/toast/src/toast.tsx` (modified, +14/-7)
```diff
@@ -34,7 +34,6 @@ type ToastProviderContextValue = {
   onViewportChange(viewport: ToastViewportElement): void;
   onToastAdd(): void;
   onToastRemove(): void;
-  isFocusedToastEscapeKeyDownRef: React.MutableRefObject<boolean>;
   isClosePausedRef: React.MutableRefObject<boolean>;
   announcerContainer?: Element | DocumentFragment;
 };
@@ -88,7 +87,6 @@ const ToastProvider: React.FC<ToastProviderProps> = (props: ScopedProps<ToastPro
   } = props;
   const [viewport, setViewport] = React.useState<ToastViewportElement | null>(null);
   const [toastCount, setToastCount] = React.useState(0);
-  const isFocusedToastEscapeKeyDownRef = React.useRef(false);
   const isClosePausedRef = React.useRef(false);
 
   if (!label.trim()) {
@@ -110,7 +108,6 @@ const ToastProvider: React.FC<ToastProviderProps> = (props: ScopedProps<ToastPro
         onViewportChange={setViewport}
         onToastAdd={React.useCallback(() => setToastCount((prevCount) => prevCount + 1), [])}
         onToastRemove={React.useCallback(() => setToastCount((prevCount) => prevCount - 1), [])}
-        isFocusedToastEscapeKeyDownRef={isFocusedToastEscapeKeyDownRef}
         isClosePausedRef={isClosePausedRef}
         announcerContainer={announcerContainer}
       >
@@ -486,6 +483,7 @@ const ToastImpl = /* @__PURE__ */ React.forwardRef<ToastImplElement, ToastImplPr
       ...toastProps
     } = props;
     const context = useToastProviderContext(TOAST_NAME, __scopeToast);
+    const getItems = useCollection(__scopeToast);
     const [node, setNode] = React.useState<ToastImplElement | null>(null);
     const composedRefs = useComposedRefs(forwardedRef, setNode);
     const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null);
@@ -578,9 +576,19 @@ const ToastImpl = /* @__PURE__ */ React.forwardRef<ToastImplElement, ToastImplPr
             <Collection.ItemSlot scope={__scopeToast}>
               <DismissableLayer.Root
                 asChild
-                onEscapeKeyDown={composeEventHandlers(onEscapeKeyDown, () => {
-                  if (!context.isFocusedToastEscapeKeyDownRef.current) handleClose();
-                  context.isFocusedToastEscapeKeyDownRef.current = false;
+                onEscapeKeyDown={composeEventHandlers(onEscapeKeyDown, (event) => {
+                  // Only the highest layer (most recent toast) registers the
+                  // escape listener, and it runs in the capture phase. If the
+                  // key press originated from within a focused toast, that
+                  // toast closes itself via `onKeyDown` below, so we must not
+                  // also close this (top-most) toast. Otherwise, close it.
+                  // See: https://github.com/radix-ui/primitives/issues/2906
+                  const isFocusInToast = getItems().some((item) =>
+                    item.ref.current?.contains(event.target as Node | null),
+                  );
+                  if (!isFocusInToast) {
+                    handleClose();
+                  }
                 })}
               >
                 <Primitive.li
@@ -594,7 +602,6 @@ const ToastImpl = /* @__PURE__ */ React.forwardRef<ToastImplElement, ToastImplPr
                     if (event.key !== 'Escape') return;
                     onEscapeKeyDown?.(event.nativeEvent);
                     if (!event.nativeEvent.defaultPrevented) {
-                      context.isFocusedToastEscapeKeyDownRef.current = true;
                       handleClose();
                     }
                   })}
```

#### Recent Merged Pull Requests:
- **PR #4164** (closed): [Menu] Keep tracking pointer direction when an item prevents pointer move (@Rod2003)
- **PR #4163** (closed): [Menu] Call SubContent onOpenAutoFocus before the default open focus (@Rod2003)
- **PR #4135** (closed): fix(one-time-password-field): don't clear value when a paste sanitizes to empty (@koreahghg)
- **PR #4130** (closed): otp: Preserve value when a paste sanitizes to empty (@koreahghg)
- **PR #4129** (closed): fix(popover): allow tabbing out of non-modal content (@dawNotPoi)
- **PR #4090** (closed): [Checkbox] Fix visual state not updating when `defaultChecked` changes in a form (@mdqasim786)
- **PR #4088** (2026-07-31): Add `ScrollArea.Content` part (@chaance)
- **PR #4086** (2026-07-30): Fix prop forwarding for FocusScope components (@chaance)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
