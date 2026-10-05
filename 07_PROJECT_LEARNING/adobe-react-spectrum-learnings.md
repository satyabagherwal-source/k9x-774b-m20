# Forensic Learning Record (Deep Inspection): adobe/react-spectrum

> **Canonical Artifact**: `07_PROJECT_LEARNING/adobe-react-spectrum-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/adobe/react-spectrum](https://github.com/adobe/react-spectrum))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:20:44.451Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `adobe/react-spectrum`
- **Description**: A collection of libraries and tools that help you build adaptive, accessible, and robust user experiences.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 15916 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/@internationalized/date/src/utils.ts`
```
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export function mod(amount: number, numerator: number): number {
  return amount - numerator * Math.floor(amount / numerator);
}

```

### Core Architecture Module: `packages/@react-aria/utils/src/index.ts`
```
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
export {CLEAR_FOCUS_EVENT, FOCUS_EVENT} from 'react-aria/private/utils/constants';

export {
  isMac,
  isIPhone,
  isIPad,
  isIOS,
  isAppleDevice,
  isWebKit,
  isChrome,
  isAndroid,
  isFirefox
} from 'react-aria/private/utils/platform';
export {
  openLink,
  getSyntheticLinkProps,
  useSyntheticLinkProps,
  RouterProvider,
  shouldClientNavigate,
  useRouter,
  useLinkProps,
  handleLinkClick
} from 'react-aria/private/utils/openLink';
export {useId} from 'react-aria/useId';
export {mergeIds, useSlotId} from 'react-aria/private/utils/useId';
export {chain} from 'react-aria/chain';
export {
  createShadowTreeWalker,
  ShadowTreeWalker
} from 'react-aria/private/utils/shadowdom/ShadowTreeWalker';
export {
  getActiveElement,
  getEventTarget,
  nodeContains,
  isFocusWithin
} from 'react-aria/private/utils/shadowdom/DOMFunctions';
export {getOwnerDocument, getOwnerWindow, isShadowRoot} from 'react-aria/private/utils/domHelpers';
export {mergeProps} from 'react-aria/mergeProps';
export {mergeRefs} from 'react-aria/mergeRefs';
export {filterDOMProps} from 'react-aria/filterDOMProps';
export {focusWithoutScrolling} from 'react-aria/private/utils/focusWithoutScrolling';
export {getOffset} from 'react-aria/private/utils/getOffset';
export {runAfterTransition} from 'react-aria/private/utils/runAfterTransition';
export {useDrag1D} from 'react-aria/private/utils/useDrag1D';
export {useGlobalListeners} from 'react-aria/private/utils/useGlobalListeners';
export {useLabels} from 'react-aria/private/utils/useLabels';
export {useObjectRef} from 'react-aria/useObjectRef';
export {useUpdateEffect} from 'react-aria/private/utils/useUpdateEffect';
export {useUpdateLayoutEffect} from 'react-aria/private/utils/useUpdateLayoutEffect';
export {useLayoutEffect} from 'react-aria/private/utils/useLayoutEffect';
export {useResizeObserver} from 'react-aria/private/utils/useResizeObserver';
export {useSyncRef} from 'react-aria/private/utils/useSyncRef';
export {getScrollParent} from 'react-aria/private/utils/getScrollParent';
export {getScrollParents} from 'react-aria/private/utils/getScrollParents';
export {isScrollable} from 'react-aria/private/utils/isScrollable';
export {useViewportSize} from 'react-aria/private/utils/useViewportSize';
export {useDescription} from 'react-aria/private/utils/useDescription';
export {useEvent} from 'react-aria/private/utils/useEvent';
export {useValueEffect} from 'react-aria/private/utils/useValueEffect';
export {scrollIntoView, scrollIntoViewport} from 'react-aria/private/utils/scrollIntoView';
export {isVirtualClick, isVirtualPointerEvent} from 'react-aria/private/utils/isVirtualEvent';
export {useEffectEvent} from 'react-aria/private/utils/useEffectEvent';
export {useDeepMemo} from 'react-aria/private/utils/useDeepMemo';
export {useFormReset} from 'react-aria/private/utils/useFormReset';
export {useLoadMore} from 'react-aria/private/utils/useLoadMore';
export {
  useLoadMoreSentinel,
  useLoadMoreSentinel as UNSTABLE_useLoadMoreSentinel
} from 'react-aria/private/utils/useLoadMoreSentinel';
export {inertValue} from 'react-aria/private/utils/inertValue';
export {
  isCtrlKeyPressed,
  isKeyboardOpen,
  supportsKeyboard,
  willOpenKeyboard
} from 'react-aria/private/utils/keyboard';
export {useEnterAnimation, useExitAnimation} from 'react-aria/private/utils/animation';
export {isFocusable, isTabbable} from 'react-aria/private/utils/isFocusable';
export {getNonce} from 'react-aria/private/utils/getNonce';
export type {LoadMoreSentinelProps} from 'react-aria/private/utils/useLoadMoreSentinel';
export {clamp, snapValueToStep} from 'react-stately/private/utils/number';

```

### Core Architecture Module: `packages/@react-stately/autocomplete/src/index.ts`
```
/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {useAutocompleteState} from 'react-stately/private/autocomplete/useAutocompleteState';

export type {
  AutocompleteProps,
  AutocompleteStateOptions,
  AutocompleteState
} from 'react-stately/private/autocomplete/useAutocompleteState';

```

### Core Architecture Module: `packages/@react-stately/calendar/src/index.ts`
```
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {useCalendarState} from 'react-stately/useCalendarState';

export {useRangeCalendarState} from 'react-stately/useRangeCalendarState';
export type {
  CalendarProps,
  CalendarStateOptions,
  CalendarPropsBase,
  CalendarState,
  DateValue,
  PageBehavior
} from 'react-stately/useCalendarState';
export type {
  DateRange,
  RangeCalendarProps,
  RangeCalendarState,
  RangeCalendarStateOptions
} from 'react-stately/useRangeCalendarState';

```

### Core Architecture Module: `packages/@react-stately/checkbox/src/index.ts`
```
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {useCheckboxGroupState} from 'react-stately/useCheckboxGroupState';

export type {CheckboxGroupProps, CheckboxGroupState} from 'react-stately/useCheckboxGroupState';

```

### Core Architecture Module: `packages/@react-stately/collections/src/index.ts`
```
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {Item} from 'react-stately/Item';

export {Section} from 'react-stately/Section';
export {useCollection} from 'react-stately/private/collections/useCollection';
export {getItemCount} from 'react-stately/private/collections/getItemCount';
export {
  getChildNodes,
  getFirstItem,
  getLastItem,
  getNthItem,
  compareNodeOrder
} from 'react-stately/private/collections/getChildNodes';
export {CollectionBuilder} from 'react-stately/private/collections/CollectionBuilder';
export type {PartialNode} from 'react-stately/private/collections/types';

```

### Core Architecture Module: `packages/@react-stately/color/src/index.ts`
```
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {parseColor, getColorChannels} from 'react-stately/Color';

export {useColorAreaState} from 'react-stately/useColorAreaState';
export {useColorSliderState} from 'react-stately/useColorSliderState';
export {useColorWheelState} from 'react-stately/useColorWheelState';
export {useColorFieldState, useColorChannelFieldState} from 'react-stately/useColorFieldState';
export {useColorPickerState} from 'react-stately/useColorPickerState';
export type {ColorAreaProps, ColorAreaState} from 'react-stately/useColorAreaState';
export type {
  ColorSliderProps,
  ColorSliderState,
  ColorSliderStateOptions
} from 'react-stately/useColorSliderState';
export type {ColorWheelProps, ColorWheelState} from 'react-stately/useColorWheelState';
export type {
  ColorFieldProps,
  ColorFieldState,
  ColorChannelFieldProps,
  ColorChannelFieldState,
  ColorChannelFieldStateOptions
} from 'react-stately/useColorFieldState';
export type {ColorPickerProps, ColorPickerState} from 'react-stately/useColorPickerState';
export type {
  Color,
  ColorChannel,
  ColorFormat,
  ColorSpace,
  ColorAxes,
  ColorChannelRange
} from 'react-stately/Color';

```

### Core Architecture Module: `packages/@react-stately/combobox/src/index.ts`
```
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {useComboBoxState} from 'react-stately/useComboBoxState';

export type {
  ComboBoxProps,
  ComboBoxStateOptions,
  ComboBoxState,
  ComboBoxValidationValue,
  MenuTriggerAction,
  SelectionMode
} from 'react-stately/useComboBoxState';

```

### Core Architecture Module: `packages/@react-stately/data/src/index.ts`
```
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {useAsyncList} from 'react-stately/useAsyncList';

export {useTreeData} from 'react-stately/useTreeData';
export {useListData} from 'react-stately/useListData';
export type {ListOptions, ListData} from 'react-stately/useListData';
export type {
  AsyncListOptions,
  AsyncListData,
  AsyncListLoadFunction,
  AsyncListLoadOptions,
  AsyncListStateUpdate
} from 'react-stately/useAsyncList';
export type {TreeOptions, TreeData} from 'react-stately/useTreeData';

```

### Core Architecture Module: `packages/@react-stately/datepicker/src/index.ts`
```
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {useDatePickerState} from 'react-stately/useDatePickerState';

export {useDateFieldState} from 'react-stately/useDateFieldState';
export {useDateRangePickerState} from 'react-stately/useDateRangePickerState';
export {useTimeFieldState} from 'react-stately/useTimeFieldState';
export type {
  DateFieldStateOptions,
  DateFieldProps,
  DateFieldState,
  DateSegment,
  DateSegmentType,
  DateSegmentType as SegmentType,
  DateValue,
  Granularity,
  MappedDateValue
} from 'react-stately/useDateFieldState';
export type {
  DatePickerStateOptions,
  DatePickerProps,
  DatePickerState
} from 'react-stately/useDatePickerState';
export type {
  DateRangePickerStateOptions,
  DateRangePickerProps,
  DateRangePickerState,
  DateRange
} from 'react-stately/useDateRangePickerState';
export type {
  TimeFieldStateOptions,
  TimePickerProps,
  TimeFieldState,
  TimeValue,
  MappedTimeValue
} from 'react-stately/useTimeFieldState';
export type {FormatterOptions} from 'react-stately/private/datepicker/utils';

```

### Core Architecture Module: `packages/@react-stately/disclosure/src/index.ts`
```
/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {useDisclosureState} from 'react-stately/useDisclosureState';

export {useDisclosureGroupState} from 'react-stately/useDisclosureGroupState';
export type {DisclosureState, DisclosureProps} from 'react-stately/useDisclosureState';
export type {
  DisclosureGroupState,
  DisclosureGroupProps
} from 'react-stately/useDisclosureGroupState';

```

### Core Architecture Module: `packages/@react-stately/dnd/src/index.ts`
```
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {useDraggableCollectionState} from 'react-stately/useDraggableCollectionState';

export {useDroppableCollectionState} from 'react-stately/useDroppableCollectionState';
export type {
  DraggableCollectionStateOptions,
  DraggableCollectionState
} from 'react-stately/useDraggableCollectionState';
export type {
  DroppableCollectionStateOptions,
  DroppableCollectionState
} from 'react-stately/useDroppableCollectionState';

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10663** (2026-10-03): **A Popover rendered inside a Select popover inherits the Select PopoverContext**
  *Symptoms*: ### Provide a general summary of the issue here  A standalone `Popover` rendered inside a `Select`'s popover content inherits the Select's `PopoverContext`: its render props report `trigger="Select"`.  ### 🤔 Expected Behavior?  A Popover with its own `triggerRef` and `isOpen` gets no context from an enclosing overlay, and reports `trigger` as `null` like the same Popover rendered outside any overlay.  ### 😯 Current Behavior  ```text outside any overlay:       nested trigger=null inside the Select popover: nested trigger=Select ```  ### 💁 Possible Solution  RAC's `Popover` resets only the contexts its owner passes as `clearContexts` (`react-aria-components/dist/private/Popover.mjs:143-149`). `Select`'s `CLEAR_CONTEXTS` (`Select.mjs:84-88`) is `LabelContext`, `ButtonContext` and `TextContext` (imports at `:1,6,10`), so `PopoverContext` reaches everything inside the Select's popover. Clearing `PopoverContext` for a popover's content would cover it.  ### 🔦 Context  Found while building a design system on React Aria Components. Observed in headless Chromium (Playwright 1.63, real key and mouse events) with react-aria-components 1.21.1 / react-aria 3.52.1 / react-stately 3.50.0 and no other code.  ### 🖥️ Steps to Reproduce  ```jsx import { useRef } from "react"; import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";  function Probe() {   const ref = useRef(null);   return (     <>       <button ref={ref}>anchor</button>       <Popov
  **Post-Mortem & Fix Analysis**:
  > Closing as a duplicate, however, I might suggest using the same strategy as the Menu/"sub dialog" issue you posted to work around it and move the inner Popover up and out
  > o, wait, i got confused looking at the example. yes, we should probably clear the related popover context inside itself

- **Issue #10445** (2026-08-12): **ColorField: typed value is not committed on Enter and silently discarded on Escape dismissal**
  *Symptoms*: ## Provide a general summary of the issue here  Typing a hex value into `ColorField` (inside a `ColorPicker` popover) and pressing <kbd>Enter</kbd> does not commit the typed value — the field's internal `inputValue` is only flushed to the color state on blur. If the user then closes the popover with <kbd>Escape</kbd>, the typed value is silently discarded and the previous color is restored, so users believe they picked a color they never actually committed.  ## 🤔 Expected Behavior?  Pressing <kbd>Enter</kbd> in a `ColorField` commits the typed value, the same way `NumberField` does — `useNumberField` explicitly handles <kbd>Enter</kbd> and commits via `flushSync(() => commit())` (`packages/react-aria/src/numberfield/useNumberField.ts:261-267` on `main`).  ## 😯 Current Behavior  `useColorField` wires `commit` to `onBlur` only (`packages/react-aria/src/color/useColorField.ts:147` on `main`) and has no <kbd>Enter</kbd> handling. So:  1. Type `#889096` into the hex field (previous color `#3B82F6`) 2. Press <kbd>Enter</kbd> → the input keeps displaying `#889096`, but the picker state (swatch, sliders, `onChange`) still holds `#3B82F6` 3. Press <kbd>Escape</kbd> to close the popover → color silently reverts to `#3B82F6`  Tabbing out of the field (blur) commits correctly.  This is the keyboard sibling of #9748 ("ColorPicker's color field doesn't commit its value if the popover is dismissed via outside click"). That one was fixed by #9768 (in `react-aria@3.51.0`) for the pointer-di
  **Post-Mortem & Fix Analysis**:
  > That seems like behaviour we should have and your approach looks correct. Would you like to contribute?
  > I'd be happy to take this one! The approach matches useNumberField's Enter handling. I'll mirror the pattern and submit a PR shortly.

- **Issue #10411** (2026-08-05): **Docs: Tooltip example generates placement on <Tooltip> instead of <TooltipTrigger>**
  *Symptoms*: ### 🙋 Documentation Request  The interactive example at the top of https://react-spectrum.adobe.com/Tooltip exposes controls for `placement`, `crossOffset`, `shouldFlip`, and `shouldCloseOnPress`. The live preview responds correctly, but the generated code sample places these props on `<Tooltip>` rather than `<TooltipTrigger>`.  Setting placement to `right` produces: ```tsx <TooltipTrigger>   <ActionButton aria-label="Edit name"><Edit /></ActionButton>   <Tooltip placement="right">Edit name</Tooltip> </TooltipTrigger> ``` Opening that in StackBlitz from the share menu fails to typecheck: ``` Type '{ children: string; placement: string; }' is not assignable to type 'IntrinsicAttributes & TooltipProps & RefAttributes<DOMRefValue<HTMLDivElement>>'.   Property 'placement' does not exist on type 'IntrinsicAttributes & TooltipProps & RefAttributes<DOMRefValue<HTMLDivElement>>'.(2322) (property) placement: string ``` Reproduction: https://stackblitz.com/edit/8e1sdfwh?file=src%2FExample.tsx  All four props are declared on `TooltipTriggerProps` and explicitly omitted from `TooltipProps` in `packages/@react-spectrum/s2/src/Tooltip.tsx`. The API table further down the same page also lists `children` as `Tooltip`'s only prop.  **The cause** looks like the `/* PROPS */` marker in the first render block of `packages/dev/s2-docs/pages/s2/Tooltip.mdx`, which sits on `<Tooltip>` while the block declares `docs={docs.exports.TooltipTrigger}`. The second example on the same page has it on `<Too
  **Post-Mortem & Fix Analysis**:
  > Thanks, I noticed some of the props weren't rendering correctly, so I've opened a PR to fix both https://github.com/adobe/react-spectrum/pull/10413

- **Issue #10330** (2026-08-27): **RangeCalendar inside shadow DOM commits range on first click (endDragging uses retargeted e.target)**
  *Symptoms*: ### Provide a general summary of the issue here  When a `RangeCalendar` (including the calendar inside `DateRangePicker` from react-aria-components) is rendered inside a **shadow root**, clicking a single date immediately commits a range where `start === end`. It is impossible to select a range with two separate clicks.  The `enableShadowDOM()` flag is enabled and event retargeting is handled correctly in most of the codebase, but one line in `useRangeCalendar` still reads the raw `e.target` from a window-level listener.  ### 🤔 Expected Behavior?  First click sets the anchor (start) date; second click on another day commits the range `start → end` — same behavior as in light DOM.  ### 😯 Current Behavior  First click immediately commits `{ start: clickedDate, end: clickedDate }`. Every subsequent click does the same, so a multi-day range can never be selected by clicking.  Drag-selection coincidentally still works, because the unintended commit on `pointerup` happens to be exactly what drag-selection wants.  ### 💁 Possible Solution  `useRangeCalendar` registers a **window-level** `pointerup` listener (`endDragging`) to support drag selection:  ```ts // packages/react-aria/src/calendar/useRangeCalendar.ts let endDragging = (e: PointerEvent) => {   // ...   state.setDragging(false);   if (!state.anchorDate) {     return;   }   let target = e.target as Element;   if (ref.current && isFocusWithin(ref.current) && (!nodeContains(ref.current, target) || !target.closest('button, [r
  **Post-Mortem & Fix Analysis**:
  > Screen recording of the bug (side by side, react-aria 3.50.0, `enableShadowDOM()` on): the light DOM calendar selects the range 8 → 17 normally with two clicks; the shadow DOM calendar commits `start === end` immediately on each single click (first 2026-07-08/2026-07-08, then 2026-07-17/2026-07-17), so a range can never be selected by clicking.  <img width="1568" height="569" alt="Image" src="https://github.com/user-attachments/assets/42d3a3e6-2ddb-4abd-88d7-4f32afbe08d5" />
  > Thanks for the issue, using `getEventTarget` would be the right thing to do. I suspect that the eslint didn't catch this because it can't tell the difference between our custom drag events vs the native ones. This one is native, so totally fine to use the shadow dom safe access functions.

- **Issue #10298** (2026-07-17): **Collection components lose all items when re-shown by <Activity> after having been visible (return-visit case, not covered by #9300)**
  *Symptoms*: # Provide a general summary of the issue here  React Aria Components collections (`GridList`, `TabList`, likely all collection components) render empty when their subtree is hidden via React 19.2 `<Activity mode="hidden">` after having been visible and populated, and then shown again.  This is the scenario originally reported in #9319, which was closed as a duplicate of #9173 before the fix for #9173 (#9300) was merged. #9300 fixes the starts-hidden, first-reveal case, but the visible, then hidden, then visible-again case still reproduces on the latest release (1.19.0). As far as I can tell it is currently untracked.  This affects every Next.js 16 app using Cache Components: the Next router wraps up to 3 preserved routes in `<Activity mode="hidden">` and re-shows the same instance on back-navigation (see [Preserving UI state](https://nextjs.org/docs/app/guides/preserving-ui-state)), so any collection component on a route breaks on every return visit.  # 🤔 Expected Behavior?  Items re-appear when the Activity boundary becomes visible again. The DOM and state were preserved, and the owning component re-renders with the correct items.  # 😯 Current Behavior  The collection renders empty. All `GridListItem` rows / `Tab` elements are gone from the DOM entirely (not merely hidden), while static siblings outside the collection render fine.  Things I verified while debugging:  - The #9300 fix is present in the shipped `react-aria-components@1.19.0` bundle. `dist/private/collections/
  **Post-Mortem & Fix Analysis**:
  > I reproduced locally in our test next app. Interestingly enough it doesn't reproduce in tests even when mimicking the same user flow. I think the appropriate method here is to call `queueUpdate` after the resubscription happens, but trying to figure out how best to go about that

- **Issue #10202** (2026-06-18): **Clickable label isn't clickable by a screen reader when using Firefox**
  *Symptoms*: ### Provide a general summary of the issue here  The "clickable" label of a checkbox, description of a radio button, and the label of a switch isn't clickable using VoiceOVer's click action <kbd>ctrl+option+space</kbd> when using Firefox.  https://github.com/user-attachments/assets/88309a14-a216-479e-a8f0-6d1d84a7f34a  https://github.com/user-attachments/assets/5c896a37-ad87-48d4-b064-88fe82bf6245  https://github.com/user-attachments/assets/fe4bcaf9-44e2-4868-8b1f-adb39cfe56f1  ### 🤔 Expected Behavior?  Component activates.  ### 😯 Current Behavior  Nothing happens; checkbox doesn't check, radio doesn't select, switch doesn't switch.  ### 💁 Possible Solution  The element is announced as clickable but doesn't do anything when clicked. I wonder if the solution to this is to provide a "role" on the elements? This appears to be what BaseUI do and theirs is clickable with a screen reader.   https://github.com/user-attachments/assets/ad5bc77c-b659-4e87-8afd-60583588b6e2  Could solving this also allow browser testing utilities (Vitest Browser mode) to correctly select by `role` which isn't currently possible due to the parent element being invisible.  ### 🔦 Context  This feels like it's potentially less accessible for screen reader users. I found this issue whilst trying to use `getByRole` in Vitest's Browser Mode so maybe the solution could improve testing with that utility.  ### 🖥️ Steps to Reproduce  Enable VoiceOver in macOS and attempt to click on "clickable" labels using <
  **Post-Mortem & Fix Analysis**:
  > To expand upon what I mean by the testing angle, here's what we currently have to do in RAC:  ```tsx test("should check checkbox in an uncontrolled component", async () => {   const screen = await render(<AriaCheckbox data-testid="id" label="Enable notifications" />)   const checkbox = screen.getByRole("checkbox", { name: checks[0].label })   const checkboxById = screen.getByTestId("id")   await expect.element(checkbox).toBeVisible()   await expect.element(checkbox).toBeEnabled()   await expect.element(checkbox).not.toBeChecked()   await checkboxById.click()   await expect.element(checkbox).toBeChecked() }) ```  Whereas Base UI allows for examination _and_ control via `getByRole`:  ```tsx test("should check checkbox in an uncontrolled component", async () => {   const screen = await render(<BaseCheckbox />)   const checkbox = screen.getByRole("checkbox", { name: "Enable notifications" })   await expect.element(checkbox).toBeVisible()   await expect.element(checkbox).toBeEnabled()   awa
  > 🤖 🚨  What's the policy on AI? @pupuking723 is obviously a bot or an orchestrator of bots that [likes to open duplicating PRs](https://github.com/vitejs/vite/issues/15915) 😬   <img width="1882" height="746" alt="Image" src="https://github.com/user-attachments/assets/b42feb94-1ce4-470d-a3ad-b6f56203722a" />  I'm not getting a sense that this account will have the best interests of the project at heart.
  > Due to historical Firefox and VoiceOver compatibility issues we discovered in testing, we don't actually support that combination: https://react-aria.adobe.com/quality#supported-screen-readers. That being said, we could explore the `role="checkbox"` but note that we use a [native input of "type=checkbox"](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/checkbox), meaning we don't actually need the role and adding it to the label might result in excessive/confusing announcements.  As for testing, have you tried our test utils? https://react-aria.adobe.com/CheckboxGroup/testing#checkboxgrouptester might be of help to simplify your tests, though for checkbox group specifically  As for AI contributions, I'd say we don't disqualify its usage but we greatly encourage that contributions aren't made solely in an automated manner and that AI output should be thoroughly vetted before being contributed.   

- **Issue #10184** (2026-06-25): **`isVirtualPointerEvent` false positive for Firefox with trackpad and tap-to-click on macOS**
  *Symptoms*: ### Provide a general summary of the issue here  On Firefox macOS, tapping with an external Magic Trackpad with tap-to-click enabled does not trigger press events on interactive components (Checkbox, Button, etc.). With the internal trackpad, press events are inconsistent as well.  ### 🤔 Expected Behavior?  Tapping with an internal or external trackpad should always trigger press events.  ### 😯 Current Behavior  Tapping with an external trackpad never trigger the press event. Tapping with the internal trackpad is inconsistent and sometimes don't trigger the press event.  See "steps to reproduce" below.  ### 💁 Possible Solution  Not sure, but in https://github.com/adobe/react-spectrum/blob/main/packages/react-aria/src/utils/isVirtualEvent.ts#L42-L57, adding `isAndroid()` or maybe `!isMac()` to the second condition might fix this. ```diff export function isVirtualPointerEvent(event: PointerEvent): boolean {   return (     (!isAndroid() && event.width === 0 && event.height === 0) || -   (event.width === 1 && +   (isAndroid() && +    event.width === 1 &&      event.height === 1 &&      event.pressure === 0 &&      event.detail === 0 &&      event.pointerType === 'mouse')   ); } ```  ### 🔦 Context  We're building a widget encapsulated within shadow DOM and had to update RAC to use `enableShadowDOM` from `@react-stately/flags` and discovered this very niche regression.  ### 🖥️ Steps to Reproduce  1. Open https://codesandbox.io/p/sandbox/m7zlnn in Firefox on macOS 2. Use extern
  **Post-Mortem & Fix Analysis**:
  > I'll ask the team if they have a external trackpad to test with, but would you mind sharing what `onPointerDown`'s event returns for you when using your external trackpad in Firefox? That would help us pick out the relevant event attributes when comparing against other devices. I was able to reproduce the internal trackpad tap flakiness as well, thanks for mentioning that one
  > probably related https://github.com/adobe/react-spectrum/issues/4753
  > > I'll ask the team if they have a external trackpad to test with, but would you mind sharing what `onPointerDown`'s event returns for you when using your external trackpad in Firefox? That would help us pick out the relevant event attributes when comparing against other devices. I was able to reproduce the internal trackpad tap flakiness as well, thanks for mentioning that one  Below, the `onPointerDown` events attributes used in `isVirtualPointerEvent` in Firefox 151.0.4 on macOS 26.5.1.  When **tapping** with **external** touchpad (consistent): ```js {   "width": 1,   "height": 1,   "pressure": 0,   "detail": 0,   "pointerType": "mouse" } ``` When **pressing** with **external** touchpad (consistent): ```js {   "width": 1,   "height": 1,   "pressure": 0.5,   "detail": 0,   "pointerType": "mouse" } ``` When **tapping** with **internal** touchpad (inconsistent): ```js {   "width": 1,   "height": 1,   "pressure": 0,   "detail": 0,   "pointerType": "mouse" } ``` ```js {   "width": 1,   "

- **Issue #10092** (2026-06-25): **FileTrigger inside DropZone causes scrollable ancestor to jump on click**
  *Symptoms*: ### Provide a general summary of the issue here  When `<FileTrigger>` is nested inside `<DropZone>`, clicking the FileTrigger's button focuses `DropZone`'s internal visually-hidden accessibility button. If the DropZone has any positioned (`position: relative`/`absolute`/`fixed`) ancestor that is **also** an `overflow-y: auto` scroll container; a very common pattern (modals, scrollable cards, side-panels). The browser's "scroll the focused element into view" behavior then scrolls that ancestor by hundreds of pixels to chase the hidden button. The user perceives the surrounding layout jumping far from where they clicked.  Here's a quick video demonstrating the issue (reproducer in https://github.com/dennisameling/react-aria-components-bug):  https://github.com/user-attachments/assets/f2839541-4c8b-4ee2-91a6-a02ea4a15c37  ### 🤔 Expected Behavior?  Clicking the visible `<Button>` inside `<FileTrigger>`:  1. Opens the native file picker. 2. Leaves keyboard focus on the visible FileTrigger button (or wherever it was before the click). 3. Does **not** scroll the surrounding layout.  ### 😯 Current Behavior  After the click:  - `document.activeElement` is the DropZone's visually-hidden accessibility button (`<button aria-label="DropZone">`) — **not** the visible FileTrigger button the user clicked. - The nearest scrollable ancestor's `scrollTop` jumps by hundreds of pixels (Chrome's `scrollIntoView` on the newly focused element). Magnitude scales with the in-flow position of the Dro
  **Post-Mortem & Fix Analysis**:
  > This falls into the same category as https://github.com/adobe/react-spectrum/issues/9989  However, this one is different because users cannot influence the position. The hidden element is a child of DropZone and if position relative is used on the DropZone then it has the same issue since the user cannot say "bottom: 0" or something like that.  It's also a sibling of the FileTrigger, so we can't use that to influence the position either. Maybe once anchor positioning becomes a thing. Otherwise, possibly position: fixed could work as an alternative, however, we'd need to introduce it as a prop so it doesn't change existing behaviour in other cases.  > FileTrigger stops propagation on its synthetic input click  We can't do this one, it should scroll to when it's out of view in most normal use cases.  > DropZone's onClick ignores clicks whose target is a hidden file input  We can't do this one, focus needs to go to the hidden target for accessibility  > `pointer-events: none`  I don't thi
  > Thanks for the thorough writeup; the event timeline and the walk-up trace through `DropZone`'s `onClick` make the root cause really clear.  To confirm I'm reading it correctly: `DropZone`'s click handler treats `FileTrigger`'s programmatic `input.click()` as a genuine user click, the focusability walk-up falls through to `buttonRef.current?.focus()`, and the resulting `scrollIntoView` on the visually-hidden button drags the nearest positioned + scrollable ancestor.  I'd like to take a crack at this. Of the three options you listed, my instinct is to combine (1) and (2): stopping propagation on `FileTrigger`'s synthetic input click is the most surgical, but guarding `DropZone`'s `onClick` against `display: none` (i.e. programmatic) targets feels like the more robust fix, since it protects the focus fallback regardless of what triggered the click. I'd be more cautious about (3) given the a11y/keyboard-fallback implications of repositioning the hidden button.  Happy to put up a PR with te
  > I'm not sure what three options your AI is referring to. At the moment there is only one:  > In summary, either it needs to position fixed or more likely, we'll need to allow some styles to be applied.  It's going to need some API discussion though. AI may not be best suited to this task.

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

### Incident Patch 1: `99e61023` (2026-10-03)
**Commit Message**: fix(RAC): clear PopoverContext in Popover (#10685)

* fix: clear PopoverContext in Popover, so a nested Popover doesn't inherit its parent popover's settings

* add story to verify

* lint/format

* remove story

* add to clearContexts loop instead

**File**: `packages/react-aria-components/src/Popover.tsx` (modified, +2/-4)
```diff
@@ -301,10 +301,8 @@ function PopoverInner({
 
   let children = useMemo(() => {
     let children = renderProps.children;
-    if (clearContexts) {
-      for (let Context of clearContexts) {
-        children = <Context.Provider value={null}>{children}</Context.Provider>;
-      }
+    for (let Context of [PopoverContext, ...(clearContexts ?? [])]) {
+      children = <Context.Provider value={null}>{children}</Context.Provider>;
     }
     return children;
   }, [renderProps.children, clearContexts]);
```

**File**: `packages/react-aria-components/test/Popover.test.js` (modified, +36/-0)
```diff
@@ -13,10 +13,12 @@
 import {act, fireEvent, pointerMap, render} from '@react-spectrum/test-utils-internal';
 import {Button} from '../src/Button';
 import {Dialog, DialogTrigger} from '../src/Dialog';
+import {ListBox, ListBoxItem} from '../src/ListBox';
 import {OverlayArrow} from '../src/OverlayArrow';
 import {Popover} from '../src/Popover';
 import {Pressable} from 'react-aria/Pressable';
 import React, {useRef} from 'react';
+import {Select, SelectValue} from '../src/Select';
 import {UNSAFE_PortalProvider} from 'react-aria/PortalProvider';
 import userEvent from '@testing-library/user-event';
 
@@ -150,6 +152,40 @@ describe('Popover', () => {
     expect(onOpenChange).toHaveBeenCalledWith(false);
   });
 
+  it('should not leak PopoverContext to nested popovers', () => {
+    function NestedPopover() {
+      let triggerRef = useRef(null);
+      return (
+        <>
+          <button ref={triggerRef}>anchor</button>
+          <Popover triggerRef={triggerRef} isOpen isNonModal data-testid="nested">
+            {({trigger}) => `nested trigger=${String(trigger)}`}
+          </Popover>
+        </>
+      );
+    }
+
+    let {getByTestId} = render(
+      <Select aria-label="Select" defaultOpen>
+        <Button>
+          <SelectValue />
+        </Button>
+        <Popover data-testid="outer">
+          <ListBox>
+            <ListBoxItem id="a">a</ListBoxItem>
+          </ListBox>
+          <NestedPopover />
+        </Popover>
+      </Select>
+    );
+
+    expect(getByTestId('outer')).toHaveAttribute('data-trigger', 'Select');
+    let nested = getByTestId('nested');
+    expect(nested).toHaveTextContent('nested trigger=null');
+    expect(nested).not.toHaveAttribute('data-trigger');
+    expect(nested).not.toHaveAttribute('aria-labelledby');
+  });
+
   it('isOpen and defaultOpen should override state from context', () => {
     let onOpenChange = jest.fn();
     let {getByRole} = render(
```

---

### Incident Patch 2: `4c34550a` (2026-10-02)
**Commit Message**: fix: use type-only import for StoryFn in Sheet stories (#10705)

**File**: `starters/tailwind/stories/Sheet.stories.tsx` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import {type Meta, StoryFn} from '@storybook/react';
+import {type Meta, type StoryFn} from '@storybook/react';
 import React from 'react';
 import {SheetTrigger} from 'react-aria-components/Sheet';
 import {Heading} from 'react-aria-components/Heading';
```

---

### Incident Patch 3: `b29aef44` (2026-10-02)
**Commit Message**: fix: action bar stories (#10700)

* chore: update ActionBar chromatic stories

* try AI suggestion

---------

Co-authored-by: Yihui Liao <[REDACTED_EMAIL]>

**File**: `packages/@react-spectrum/s2/chromatic/ActionBar.stories.tsx` (modified, +133/-0)
```diff
@@ -12,11 +12,25 @@
 
 import {ActionBar, ActionBarProps} from '../src/ActionBar';
 import {ActionButton} from '../src/ActionButton';
+import {
+  Cell,
+  Column,
+  Row,
+  TableBody,
+  TableHeader,
+  TableView,
+  TableViewProps
+} from '../src/TableView';
+import Copy from '../s2wf-icons/S2_Icon_Copy_20_N.svg';
+import Delete from '../s2wf-icons/S2_Icon_Delete_20_N.svg';
+import Edit from '../s2wf-icons/S2_Icon_Edit_20_N.svg';
 import {generatePowerset} from '@react-spectrum/story-utils';
+import {Key} from '@react-types/shared';
 import type {Meta, StoryObj} from '@storybook/react';
 import {ReactNode} from 'react';
 import {shortName} from './utils';
 import {style} from '../style' with {type: 'macro'};
+import {Text} from '../src/Content';
 
 const meta: Meta<typeof ActionBar> = {
   component: ActionBar,
@@ -59,3 +73,122 @@ const Template = (args: ActionBarProps): ReactNode => {
 export const Default: Story = {
   render: args => <Template {...args} />
 };
+
+let columns = [
+  {name: 'Foo', id: 'foo', isRowHeader: true},
+  {name: 'Bar', id: 'bar'},
+  {name: 'Baz', id: 'baz'}
+];
+
+let items = [
+  {id: 1, foo: 'Foo 1', bar: 'Bar 1', baz: 'Baz 1'},
+  {id: 2, foo: 'Foo 2', bar: 'Bar 2', baz: 'Baz 2'},
+  {id: 3, foo: 'Foo 3', bar: 'Bar 3', baz: 'Baz 3'},
+  {id: 4, foo: 'Foo 4', bar: 'Bar 4', baz: 'Baz 4'},
+  {id: 5, foo: 'Foo 5', bar: 'Bar 5', baz: 'Baz 5'},
+  {id: 6, foo: 'Foo 6', bar: 'Bar 6', baz: 'Baz 6'},
+  {id: 7, foo: 'Foo 7', bar: 'Bar 7', baz: 'Baz 7'},
+  {id: 8, foo: 'Foo 8', bar: 'Bar 8', baz: 'Baz 8'}
+];
+
+const narrowTable = style({width: 320, height: 240});
+const defaultTable = style({width: 500, height: 240});
+const wideTable = style({width: 800, height: 240});
+
+const actions = [
+  {label: 'Edit', icon: <Edit />},
+  {label: 'Copy', icon: <Copy />},
+  {label: 'Delete', icon: <Delete />}
+];
+
+interface ExampleProps extends Omit<ActionBarProps, 'children'> {
+  defaultSelectedKeys?: 'all' | Iterable<Key>;
+  tableStyles?: TableViewProps['styles'];
+  isIconOnly?: boolean;
+}
+
+// ActionBar is positioned relative to the scrollable collection it floats above, so these stories
+// render it through TableView's renderActionBar rather than standalone.
+const Example = ({
+  defaultSelectedKeys,
+  tableStyles = defaultTable,
+  isIconOnly,
+  ...actionBarProps
+}: ExampleProps): ReactNode => (
+  <TableView
+    aria-label="Table"
+    selectionMode="multiple"
+    defaultSelectedKeys={defaultSelectedKeys}
+    styles={tableStyles}
+    renderActionBar={() => (
+      <ActionBar {...actionBarProps}>
+        {actions.map(({label, icon}) =>
+          isIconOnly ? (
+            <ActionButton key={label} aria-label={label}>
+              {icon}
+            </ActionButton>
+          ) : (
+            <ActionButton key={label}>
+              {icon}
+              <Text>{label}</Text>
+            </ActionButton>
+          )
+        )}
+      </ActionBar>
+    )}>
+    <TableHeader columns={columns}>
+      {column => <Column isRowHeader={column.isRowHeader}>{column.name}</Column>}
+    </TableHeader>
+    <TableBody items={items}>
+      {item => (
+        <Row id={item.id} columns={columns}>
+          {column => <Cell>{item[column.id]}</Cell>}
+        </Row>
+      )}
+    </TableBody>
+  </TableView>
+);
+
+type ExampleStory = StoryObj<typeof Example>;
+
+export const InTableView: ExampleStory = {
+  render: args => (
+    <div className={style({display: 'flex', gap: 24})}>
+      <Example {...args} />
+      <Example {...args} defaultSelectedKeys={[1, 2, 3]} />
+    </div>
+  )
+};
+
+export const IsEmphasized: ExampleStory = {
+  render: args => <Example {...args} />,
+  args: {
+    isEmphasized: true,
+    defaultSelectedKeys: [1, 2, 3]
+  }
+};
+
+export const LargeWidth: ExampleStory = {
+  render: args => <Example {...args} />,
+  args: {
+    defaultSelectedKeys: [1, 2, 3],
+    tableStyles: wideTable
+  }
+};
+
+export const IconOnly: ExampleStory = {
+  render: args => <Example {...args} />,
+  args: {
+    defaultSelectedKeys: [1, 2, 3],
+    isIconOnly: true,
+    tableStyles: narrowTable
+  }
+};
+
+export const AllSelected: ExampleStory = {
+  render: args => <Example {...args} />,
+  args: {
+    isEmphasized: true,
+    defaultSelectedKeys: 'all'
+  }
+};
```

**File**: `packages/@react-spectrum/s2/src/ActionBar.tsx` (modified, +1/-1)
```diff
@@ -184,7 +184,7 @@ const ActionBarInner = forwardRef(function ActionBarInner(
   }, [stringFormatter, scrollRef]);
 
   let objectRef = useObjectRef(ref);
-  let isEntering = useEnterAnimation(objectRef, !!scrollRef);
+  let isEntering = useEnterAnimation(objectRef) && !!scrollRef;
 
   return (
     <FocusScope restoreFocus>
```

---

### Incident Patch 4: `d0110f77` (2026-10-02)
**Commit Message**: fix: datefield CLDR crash (#10698)

**File**: `packages/react-aria-components/test/DateField.test.js` (modified, +15/-0)
```diff
@@ -559,6 +559,21 @@ describe('DateField', () => {
     expect(segmentTypes).toEqual(['year', 'literal', 'month', 'day']);
   });
 
+  it('does not crash when a calendar has an era with no localized name', async () => {
+    // The Coptic 'BCE' era has no name in CLDR, so Intl omits the era part when formatting it.
+    let {getByRole} = render(
+      <I18nProvider locale="ar-EG-u-ca-coptic">
+        <DateField defaultValue={new CalendarDate(2024, 12, 31)}>
+          <Label>Birth date</Label>
+          <DateInput>{segment => <DateSegment segment={segment} />}</DateInput>
+        </DateField>
+      </I18nProvider>
+    );
+
+    let eraSegment = getByRole('group').querySelector('[data-type=era]');
+    expect(eraSegment).toHaveTextContent('AM');
+  });
+
   it('should support autofill', async () => {
     let {getByRole} = render(
       <DateField>
```

**File**: `packages/react-aria/src/datepicker/useDateSegment.ts` (modified, +3/-1)
```diff
@@ -168,7 +168,9 @@ export function useDateSegment(
     let eras = state.calendar.getEras().map(era => {
       let eraDate = date.set({year: 1, month: 1, day: 1, era}).toDate('UTC');
       let parts = eraFormatter.formatToParts(eraDate);
-      let formatted = parts.find(p => p.type === 'era')!.value;
+      // Some eras have no localized name in CLDR (e.g. the Coptic 'BCE' era), in which case
+      // Intl omits the era part entirely. Fall back to the era identifier so it stays typeable.
+      let formatted = parts.find(p => p.type === 'era')?.value ?? era;
       return {era, formatted};
     });
 
```

---

### Incident Patch 5: `4afba9a9` (2026-10-02)
**Commit Message**: fix: update links to new spectrum docs (#10687) (#10691)

* fix: update links to new spectrum docs (#10687)

* fix lint

* Apply suggestion from @LFDanLu

---------

Co-authored-by: Daniel Lu <[REDACTED_EMAIL]>
Co-authored-by: Daniel Lu <[REDACTED_EMAIL]>

**File**: `.storybook-s2/docs/Intro.jsx` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ export function Docs() {
         <P>
           <Strong>
             Introducing{' '}
-            <Link href="https://s2.spectrum.adobe.com" target="_blank">
+            <Link href="https://spectrum.adobe.com" target="_blank">
               Spectrum 2
             </Link>
           </Strong>{' '}
```

**File**: `examples/rac-spectrum-tailwind/src/spectrum-preset.js` (modified, +7/-7)
```diff
@@ -23,7 +23,7 @@ module.exports = {
       lg: '1768px',
       xl: '2160px'
     },
-    /** https://spectrum.adobe.com/page/color-system/ */
+    /** https://spectrum.adobe.com/foundations/color/colors. */
     colors: {
       white: 'var(--spectrum-global-color-static-white)',
       black: 'var(--spectrum-global-color-static-black)',
@@ -378,7 +378,7 @@ module.exports = {
         error: 'var(--spectrum-alias-icon-color-error)'
       }
     },
-    /** https://spectrum.adobe.com/page/states/#Keyboard-focus. */
+    /** https://spectrum.adobe.com/foundations/behavior/states. */
     ringColor: {
       DEFAULT: 'var(--spectrum-alias-focus-ring-color)'
     },
@@ -390,12 +390,12 @@ module.exports = {
       /** For use when next to existing blue border. */
       half: 'calc(var(--spectrum-alias-focus-ring-size) / 2)'
     },
-    /** https://spectrum.adobe.com/page/object-styles/#Drop-shadow. */
+    /** https://spectrum.adobe.com/foundations/styles/object-styles/drop-shadow. */
     dropShadow: {
       DEFAULT:
         '0 var(--spectrum-alias-dropshadow-offset-y) var(--spectrum-alias-dropshadow-blur) var(--spectrum-alias-dropshadow-color)'
     },
-    /** https://spectrum.adobe.com/page/object-styles/#Border-width. */
+    /** https://spectrum.adobe.com/foundations/styles/object-styles/border-width. */
     borderWidth: {
       DEFAULT: 'var(--spectrum-alias-border-size-thin)',
       none: '0',
@@ -404,7 +404,7 @@ module.exports = {
       thicker: 'var(--spectrum-alias-border-size-thicker)',
       thickest: 'var(--spectrum-alias-border-size-thickest)'
     },
-    /** https://spectrum.adobe.com/page/object-styles/#Rounding. */
+    /** https://spectrum.adobe.com/foundations/styles/object-styles/rounding. */
     borderRadius: {
       DEFAULT: 'var(--spectrum-alias-border-radius-regular)',
       xsmall: 'var(--spectrum-alias-border-radius-xsmall)',
@@ -414,7 +414,7 @@ module.exports = {
       large: 'var(--spectrum-alias-border-radius-large)',
       full: '9999px'
     },
-    /** https://spectrum.adobe.com/page/typography/#Font-sizes. */
+    /** https://spectrum.adobe.com/foundations/typography/typography-system#font-size. */
     fontSize: {
       DEFAULT: 'var(--spectrum-alias-font-size-default)',
       xs: 'var(--spectrum-global-dimension-font-size-50)',
@@ -458,7 +458,7 @@ module.exports = {
       medium: 'var(--spectrum-global-font-line-height-medium)',
       large: 'var(--spectrum-global-font-line-height-large)'
     },
-    /** https://spectrum.adobe.com/page/motion/ */
+    /** https://spectrum.adobe.com/foundations/behavior/motion. */
     transitionTimingFunction: {
       'ease-in-out': 'cubic-bezier(.45, 0, .40, 1)',
       'ease-in': 'cubic-bezier(.50, 0, 1, 1)',
```

**File**: `packages/@react-spectrum/ai/stories/Chat.stories.tsx` (modified, +4/-2)
```diff
@@ -738,8 +738,10 @@ StyleDictionary.extend({
       </pre>
       <p>
         Run it after every change and components import semantic values instead of literals. See the{' '}
-        <a href="https://spectrum.adobe.com/page/design-tokens/">Spectrum design tokens docs</a> for
-        the full naming conventions.
+        <a href="https://spectrum.adobe.com/foundations/design-data/design-tokens">
+          Spectrum design tokens docs
+        </a>{' '}
+        for the full naming conventions.
       </p>
     </div>
   );
```

**File**: `packages/@react-spectrum/ai/stories/prose.mdx` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ When announcing breaking renames, be explicit. <strike>`color-brand-primary`</st
 External references helped the team stay aligned:
 
 - [Design Tokens Community Group format](https://design-tokens.github.io/community-group/format/)
-- [Adobe Spectrum design tokens documentation](https://spectrum.adobe.com/page/design-tokens/)
+- [Adobe Spectrum design tokens documentation](https://spectrum.adobe.com/foundations/design-data/design-tokens)
 - Internal RFC: *"Semantic color roles for Express mobile"*
 
 ---
```

**File**: `packages/@react-spectrum/s2/src/ActionButton.tsx` (modified, +2/-2)
```diff
@@ -59,7 +59,7 @@ export interface ActionButtonStyleProps {
   staticColor?: 'black' | 'white' | 'auto';
   /**
    * Whether the button should be displayed with a [quiet
-   * style](https://spectrum.adobe.com/page/action-button/#Quiet).
+   * style](https://spectrum.adobe.com/web/rsp/components/action-button#component-options).
    */
   isQuiet?: boolean;
 }
@@ -69,7 +69,7 @@ interface ToggleButtonStyleProps {
   isSelected?: boolean;
   /**
    * Whether the button should be displayed with an [emphasized
-   * style](https://spectrum.adobe.com/page/action-button/#Emphasis).
+   * style](https://spectrum.adobe.com/web/rsp/components/action-button#component-options).
    */
   isEmphasized?: boolean;
 }
```

**File**: `packages/@react-spectrum/s2/src/ActionButtonGroup.tsx` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ export interface ActionButtonGroupProps extends AriaLabelingProps, UnsafeStyles,
   density?: 'compact' | 'regular';
   /**
    * Whether the button should be displayed with a [quiet
-   * style](https://spectrum.adobe.com/page/action-button/#Quiet).
+   * style](https://spectrum.adobe.com/web/rsp/components/action-button#component-options).
    */
   isQuiet?: boolean;
   /** Whether the buttons should divide the container width equally. */
```

**File**: `packages/@react-spectrum/s2/src/AlertDialog.tsx` (modified, +3/-1)
```diff
@@ -30,7 +30,9 @@ import {useLocalizedStringFormatter} from 'react-aria/useLocalizedStringFormatte
 
 export interface AlertDialogProps extends AriaLabelingProps, DOMProps, UnsafeStyles {
   /**
-   * The [visual style](https://spectrum.adobe.com/page/alert-dialog/#Options) of the AlertDialog.
+   * The [visual
+   * style](https://spectrum.adobe.com/web/rsp/components/alert-dialog#component-options) of the
+   * AlertDialog.
    *
    * @default 'confirmation'
    */
```

**File**: `packages/@react-spectrum/s2/src/Button.tsx` (modified, +2/-1)
```diff
@@ -42,7 +42,8 @@ import {useSpectrumContextProps} from './useSpectrumContextProps';
 
 interface ButtonStyleProps {
   /**
-   * The [visual style](https://spectrum.adobe.com/page/button/#Options) of the button.
+   * The [visual style](https://spectrum.adobe.com/web/rsp/components/button#component-options) of
+   * the button.
    *
    * @default 'primary'
    */
```

---

### Incident Patch 6: `a3b7fcf7` (2026-10-01)
**Commit Message**: fix: Prevent TokenField scroll jumps after token edits (#10676)

* fix: Prevent TokenField scroll jumps after token edits

* test: cover TokenField scrolling without Enter

**File**: `packages/react-aria-components/stories/TokenField.stories.tsx` (modified, +17/-0)
```diff
@@ -284,6 +284,23 @@ export const TagField: TokenFieldStory = () => {
   );
 };
 
+export const ScrollableTagField: TokenFieldStory = TagField.bind({});
+ScrollableTagField.decorators = [
+  Story => (
+    <div
+      ref={element => {
+        if (element) {
+          element.scrollTop = 450;
+        }
+      }}
+      style={{height: 180, overflow: 'auto', marginTop: 200}}>
+      <div style={{height: 500}} />
+      <Story />
+      <div style={{height: 500}} />
+    </div>
+  )
+];
+
 export const Search: TokenFieldStory = () => {
   let inputRef = useRef(null);
   let [value, setValue] = useState(
```

**File**: `packages/react-aria-components/test/TokenField.scroll.browser.test.tsx` (added, +155/-0)
```diff
@@ -0,0 +1,155 @@
+/*
+ * Copyright 2026 Adobe. All rights reserved.
+ * This file is licensed to you under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License. You may obtain a copy
+ * of the License at http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software distributed under
+ * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
+ * OF ANY KIND, either express or implied. See the License for the specific language
+ * governing permissions and limitations under the License.
+ */
+
+import {describe, expect, it} from 'vitest';
+import React from 'react';
+import {render} from 'vitest-browser-react';
+import {Token, TokenField, TokenInput} from '../src/TokenField';
+import {TokenFieldSegment, TokenFieldValue} from 'react-stately/useTokenFieldState';
+import {userEvent} from 'vitest/browser';
+
+// The tag-field example converts a trailing delimiter into a token with no text after it.
+class TagFieldValue extends TokenFieldValue {
+  tokenize(text: string): TokenFieldSegment[] {
+    let parts = text.split(/[, \n]/);
+    let segments: TokenFieldSegment[] = parts.map((part, index) => {
+      if (index === parts.length - 1 || part.length === 0) {
+        return {type: 'text', text: part};
+      }
+      return {type: 'token', text: part};
+    });
+
+    if (parts.at(-1)?.length === 0) {
+      segments.pop();
+    }
+    return segments;
+  }
+
+  toString(): string {
+    return this.segments.map(segment => segment.text).join(', ');
+  }
+}
+
+const describeOrSkip = parseInt(React.version, 10) < 19 ? describe.skip : describe;
+
+describeOrSkip('TokenField scrolling', () => {
+  it.each([
+    {dir: 'ltr', delimiter: 'Enter', key: '{Enter}'},
+    {dir: 'rtl', delimiter: 'Enter', key: '{Enter}'},
+    {dir: 'ltr', delimiter: 'comma', key: ','},
+    {dir: 'rtl', delimiter: 'comma', key: ','}
+  ] as const)(
+    'keeps a visible tag field in place after $delimiter and Backspace ($dir)',
+    async ({dir, key}) => {
+      let screen = await render(
+        <div
+          data-testid="scroller"
+          dir={dir}
+          style={{height: 180, overflow: 'auto', marginTop: 200}}>
+          <div style={{height: 500}} />
+          <TokenField aria-label="Tags" allowsNewlines defaultValue={new TagFieldValue([])}>
+            <TokenInput style={{minHeight: 30}}>
+              {segment => <Token>{segment.text}</Token>}
+            </TokenInput>
+          </TokenField>
+          <div style={{height: 500}} />
+        </div>
+      );
+      let scroller = screen.getByTestId('scroller').element();
+      let input = screen.getByRole('textbox', {name: 'Tags'});
+      scroller.scrollTop = 450;
+      await userEvent.click(input);
+      await userEvent.keyboard('Design');
+      let scrollTop = scroller.scrollTop;
+      expect(scrollTop).toBeGreaterThan(0);
+
+      await userEvent.keyboard(key);
+      await expect.element(input).toHaveTextContent('Design');
+      expect(input.element().querySelector('[data-react-aria-token]')).not.toBeNull();
+      expect(scroller.scrollTop).toBe(scrollTop);
+
+      await userEvent.keyboard('x{Backspace}');
+      await expect.element(input).toHaveTextContent('Design');
+      expect(scroller.scrollTop).toBe(scrollTop);
+      await expect.element(input).toHaveFocus();
+
+      await userEvent.keyboard('{Backspace}{Backspace}');
+      expect(input.element().querySelector('[data-react-aria-token]')).toBeNull();
+      expect(scroller.scrollTop).toBe(scrollTop);
+    }
+  );
+
+  it.each(['ltr', 'rtl'] as const)(
+    'keeps a visible field in place when Backspace leaves a trailing token (%s)',
+    async dir => {
+      let screen = await render(
+        <div
+          data-testid="scroller"
+          dir={dir}
+          style={{height: 180, overflow: 'auto', marginTop: 200}}>
+          <div style={{height: 500}} />
+          <TokenField
+            aria-label="Tags"
+            defaultValue={
+              new TagFieldValue([
+                {type: 'token', text: 'Design'},
+                {type: 'text', text: 'x'}
+              ])
+            }>
+            <TokenInput style={{minHeight: 30}}>
+              {segment => <Token>{segment.text}</Token>}
+            </TokenInput>
+          </TokenField>
+          <div style={{height: 500}} />
+        </div>
+      );
+      let scroller = screen.getByTestId('scroller').element();
+      let input = screen.getByRole('textbox', {name: 'Tags'});
+      scroller.scrollTop = 450;
+      await userEvent.click(input);
+      await userEvent.keyboard('{End}');
+      let scrollTop = scroller.scrollTop;
+      expect(scrollTop).toBeGreaterThan(0);
+
+      await userEvent.keyboard('{Backspace}');
+      await expect.element(input).toHaveTextContent('Design');
+      expect(input.element().querySelector('[data-react-aria-token]')).not.toBeNull();
+
```

**File**: `packages/react-aria/src/tokenfield/useTokenField.ts` (modified, +15/-2)
```diff
@@ -751,6 +751,11 @@ function scrollCaretIntoView(root: HTMLElement): void {
   }
 
   let range = selection.getRangeAt(0);
+  if (range.collapsed && range.endContainer === root) {
+    // Root-level positions around tokens have no rect. Measure the adjacent
+    // zero width space without moving the actual selection into the token.
+    range = tokenFieldPositionToDOMRange(root, {index: range.endOffset, offset: 0});
+  }
   let rect = range.getBoundingClientRect();
 
   // A collapsed range doesn't always produce a client rect. This happens for empty lines.
@@ -766,10 +771,10 @@ function scrollCaretIntoView(root: HTMLElement): void {
       rect = root.getBoundingClientRect();
     } else {
       // Otherwise find the next sibling element (e.g. trailing <br>) and use its rect in this case.
-      let nextSibling = node.nextSibling;
+      let nextSibling = node === root ? null : node.nextSibling;
       while (node && node !== root && !nextSibling) {
         node = node.parentNode as Node | null;
-        nextSibling = node ? node.nextSibling : null;
+        nextSibling = node && node !== root ? node.nextSibling : null;
       }
 
       if (nextSibling?.nodeType === Node.ELEMENT_NODE) {
@@ -809,6 +814,14 @@ export function tokenFieldPositionToDOMRange(root: Element, pos: Position): Rang
 
 function getDOMRectPosition(root: Element, pos: Position): [Node, number] {
   let child = root.childNodes[pos.index];
+  if (
+    pos.index >= root.childNodes.length &&
+    root.lastChild?.lastChild?.nodeType === Node.TEXT_NODE
+  ) {
+    // A position after the last token belongs to its trailing zero width space.
+    let text = root.lastChild.lastChild;
+    return [text, text.textContent!.length];
+  }
   if (child && child.nodeType === Node.ELEMENT_NODE) {
     // Place the position inside the zero width space wrappers around the token.
     if (pos.offset > 0) {
```

---

### Incident Patch 7: `d382ef75` (2026-10-01)
**Commit Message**: fix: browser tests failing due to browsers list data old (#10688)

* fix: browser tests failing due to browsers list data old

* futureproofing

**File**: `scripts/setupTests.js` (modified, +8/-3)
```diff
@@ -43,16 +43,21 @@ const ERROR_PATTERNS_WE_SHOULD_FIX_BUT_ALLOW = [
 
 const WARNING_PATTERNS_WE_SHOULD_FIX_BUT_ALLOW = [
   'Browserslist: caniuse-lite is outdated',
-  'Browserslist: browsers data (caniuse-lite) is 6 months old.'
+  /Browserslist: browsers data \(caniuse-lite\) is \d+ months? old\./
 ];
 
+// Patterns may be strings (substring match) or regexes.
+function matchesPattern(message, pattern) {
+  return typeof pattern === 'string' ? message.indexOf(pattern) > -1 : pattern.test(message);
+}
+
 function failTestOnConsoleError() {
   const error = console.error;
 
   console.error = function (message) {
     const allowedPattern =
       typeof message === 'string' &&
-      ERROR_PATTERNS_WE_SHOULD_FIX_BUT_ALLOW.find(pattern => message.indexOf(pattern) > -1);
+      ERROR_PATTERNS_WE_SHOULD_FIX_BUT_ALLOW.find(pattern => matchesPattern(message, pattern));
     if (allowedPattern) {
       return;
     }
@@ -68,7 +73,7 @@ function failTestOnConsoleWarn() {
   console.warn = function (message) {
     const allowedPattern =
       typeof message === 'string' &&
-      WARNING_PATTERNS_WE_SHOULD_FIX_BUT_ALLOW.find(pattern => message.indexOf(pattern) > -1);
+      WARNING_PATTERNS_WE_SHOULD_FIX_BUT_ALLOW.find(pattern => matchesPattern(message, pattern));
 
     if (allowedPattern) {
       return;
```

---

### Incident Patch 8: `ffeacba3` (2026-09-30)
**Commit Message**: fix: Side panel followup (#10678)

* fix avatar shift and remove extra code

* add more items to demonstrate animations

* Add example with nav

* fix docs lint

**File**: `packages/@react-spectrum/s2/src/SideNav.tsx` (modified, +4/-16)
```diff
@@ -744,6 +744,7 @@ const sidePanelStyle = style(
     display: 'flex',
     flexDirection: 'column',
     height: 'full',
+    minHeight: 0,
     // The expanded width is supplied by the consumer via the `styles` prop. When collapsed, SidePanel
     // applies an inline `width: var(--collapsedWidth)` (the fixed icon-rail size) which overrides that
     // class-based width.
@@ -857,7 +858,8 @@ export const SidePanel = /*#__PURE__*/ forwardRef(function SidePanel(
             flexShrink: 1,
             minHeight: 0,
             display: 'flex',
-            flexDirection: 'column'
+            flexDirection: 'column',
+            height: 'full'
           })}>
           {children}
         </div>
@@ -874,28 +876,14 @@ function ExpandButton(props: {isCollapsed: boolean; setCollapsed: (isCollapsed:
 
   let label = stringFormatter.format(`sidepanel.${props.isCollapsed ? 'expand' : 'collapse'}`);
 
-  return (
-    <PanelToggleButton
-      isCollapsed={props.isCollapsed}
-      setCollapsed={props.setCollapsed}
-      aria-label={label}
-    />
-  );
-}
-
-function PanelToggleButton(
-  props: AriaLabelingProps & {
-    isCollapsed: boolean;
-    setCollapsed: (isCollapsed: boolean) => void;
-  }
-) {
   let {isCollapsed, setCollapsed, ...otherProps} = props;
   let [isHovered, setHovered] = useState(false);
   let {hoverProps} = useHover({onHoverChange: setHovered});
   return (
     <div {...hoverProps} className={style({display: 'contents', marginBottom: 2})}>
       <ActionButton
         {...otherProps}
+        aria-label={label}
         isQuiet
         styles={style({alignSelf: 'start'})}
         onPress={() => {
```

**File**: `packages/@react-spectrum/s2/stories/SideNav.stories.tsx` (modified, +120/-8)
```diff
@@ -623,9 +623,7 @@ export const SidePanelExample = {
       <SidePanel
         defaultCollapsed
         styles={style({gridArea: 'sidebar', marginStart: '[6px]', marginEnd: '[10px]', width: 224})}
-        {...args}
-        aria-label="Side panel"
-        defaultExpandedKeys={['projects']}>
+        aria-label="Side panel">
         <SidePanelContext.Consumer>
           {({isCollapsed}) => (
             <div className={style({display: 'flex', flexDirection: 'column', gap: 2})}>
@@ -641,7 +639,11 @@ export const SidePanelExample = {
             </div>
           )}
         </SidePanelContext.Consumer>
-        <RoutedSideNav {...args} styles={style({width: 'full'})} selectedRoute="/files">
+        <RoutedSideNav
+          {...args}
+          styles={style({width: 'full'})}
+          selectedRoute="/files"
+          defaultExpandedKeys={['projects']}>
           <SideNavItem href="/files" textValue="Files">
             <SideNavItemContent>
               <SideNavItemLink>
@@ -668,7 +670,7 @@ export const SidePanelExample = {
           </SideNavItem>
           <SideNavSection>
             <SideNavHeader>Work</SideNavHeader>
-            <SideNavItem href="/projects" textValue="Projects">
+            <SideNavItem href="/projects" id="projects" textValue="Projects">
               <SideNavItemContent>
                 <SideNavItemLink>
                   <Project />
@@ -749,9 +751,7 @@ export const SidePanelExample2 = {
       <SidePanel
         defaultCollapsed
         styles={style({gridArea: 'sidebar', marginStart: '[6px]', marginEnd: '[10px]', width: 224})}
-        {...args}
-        aria-label="Side panel"
-        defaultExpandedKeys={['projects']}>
+        aria-label="Side panel">
         <RoutedSideNav {...args} selectedRoute="/files">
           <SideNavItem href="/files" textValue="Files">
             <SideNavItemContent>
@@ -794,3 +794,115 @@ export const SidePanelExample2 = {
     }
   }
 };
+
+// The SidePanel is a flex column, so the nav has to grow and let its SideNav child shrink.
+const sidePanelNav = style({
+  display: 'flex',
+  flexDirection: 'column',
+  flexGrow: 1,
+  flexShrink: 1,
+  minHeight: 0
+});
+
+export const SidePanelWithNav = {
+  render: args => (
+    <div
+      className={style({
+        width: 'full',
+        height: '100vh',
+        display: 'grid',
+        gridTemplateAreas: ['header header', 'sidebar main'],
+        gridTemplateColumns: 'auto 1fr',
+        gridTemplateRows: 'auto 1fr',
+        backgroundColor: 'layer-1'
+      })}>
+      <div
+        className={style({
+          gridArea: 'header',
+          display: 'flex',
+          alignItems: 'center',
+          paddingX: 8,
+          paddingY: 16
+        })}>
+        <AdobeLogo size={28} />
+      </div>
+      <SidePanel
+        styles={style({
+          gridArea: 'sidebar',
+          marginStart: '[6px]',
+          marginEnd: '[10px]',
+          width: 224
+        })}>
+        <nav aria-label="Main" className={sidePanelNav}>
+          <RoutedSideNav {...args} selectedRoute="/files" defaultExpandedKeys={['projects']}>
+            <SideNavItem href="/files" textValue="Files">
+              <SideNavItemContent>
+                <SideNavItemLink>
+                  <Files />
+                  <Text>Your files</Text>
+                </SideNavItemLink>
+              </SideNavItemContent>
+            </SideNavItem>
+            <SideNavItem id="your-libraries" href="/your-libraries" textValue="Your Libraries">
+              <SideNavItemContent>
+                <SideNavItemLink>
+                  <CCLibrary />
+                  <Text>Your Libraries</Text>
+                </SideNavItemLink>
+              </SideNavItemContent>
+              <SideNavItem id="photos" href="/photos" textValue="Photos">
+                <SideNavItemContent>
+                  <SideNavItemLink>
+                    <Images />
+                    <Text>Photos</Text>
+                  </SideNavItemLink>
+                </SideNavItemContent>
+              </SideNavItem>
+            </SideNavItem>
+            <SideNavSection>
+              <SideNavHeader>Work</SideNavHeader>
+              <SideNavItem href="/projects" id="projects" textValue="Projects">
+                <SideNavItemContent>
+                  <SideNavItemLink>
+                    <Project />
+                    <Text>Projects</Text>
+                  </SideNavItemLink>
+                </SideNavItemContent>
+                <SideNavItem href="/projects-2" textValue="Projects-2">
+                  <SideNavItemContent>
+                    <SideNavItemLink>
+                      <Text>Projects-2</Text>
+                    </SideNavItemLink>
+                  </SideNavItemContent>
+                </SideNavItem>
+              </SideNavItem>
+            </SideNavSection>
+          </RoutedSideNav>
+        </nav>
+        <SidePanelExtraControls />
+      </SidePanel>
+      <main
+        className={style
```

**File**: `packages/dev/s2-docs/pages/s2/SidePanel.mdx` (modified, +7/-1)
```diff
@@ -207,8 +207,9 @@ import {SidePanelApp, AccountFooter} from './SidePanelApp';
 import {style} from '@react-spectrum/s2/style' with {type: 'macro'};
 import File from '@react-spectrum/s2/icons/File';
 import Files from '@react-spectrum/s2/icons/Files';
-import Folder from '@react-spectrum/s2/icons/Folder';
 import Images from '@react-spectrum/s2/icons/Images';
+import Archive from '@react-spectrum/s2/icons/Archive';
+import Folder from '@react-spectrum/s2/icons/Folder';
 
 ///- begin collapse -///
 interface Item {
@@ -229,6 +230,11 @@ let items: Item[] = [
   {id: 5, title: 'Photos', type: 'directory', href: '/photos', icon: Images, children: [
     {id: 6, title: 'Image 1', type: 'file', href: '/image-1'},
     {id: 7, title: 'Image 2', type: 'file', href: '/image-2'}
+  ]},
+  {id: 8, title: 'Archive', type: 'directory', href: '/archive', icon: Archive, children: [
+    {id: 9, title: 'Invoices', type: 'file', href: '/invoices'},
+    {id: 10, title: 'Contracts', type: 'file', href: '/contracts'},
+    {id: 11, title: 'Receipts', type: 'file', href: '/receipts'}
   ]}
 ];
 ///- end collapse -///
```

**File**: `packages/dev/s2-docs/pages/s2/SidePanelApp.tsx` (modified, +3/-1)
```diff
@@ -62,7 +62,9 @@ export function AccountFooter(): ReactNode {
         padding: 4,
         flexShrink: 0
       })({isCollapsed})}>
-      <Avatar alt="Jordan Rivera" src="https://i.imgur.com/xIe7Wlb.png" size={24} />
+      <ActionButton isQuiet>
+        <Avatar alt="Jordan Rivera" src="https://i.imgur.com/xIe7Wlb.png" size={24} />
+      </ActionButton>
       <div
         className={style({
           display: {default: 'block', isCollapsed: 'none'},
```

---

### Incident Patch 9: `96750291` (2026-09-30)
**Commit Message**: fix: add scrollbar gutter to style macro (#10682)

* fix: add scrollbar gutter to style macro

* fix formatting

**File**: `packages/@react-spectrum/s2/style/spectrum-theme.ts` (modified, +1/-0)
```diff
@@ -1303,6 +1303,7 @@ export const style = createTheme({
       'zoom-out'
     ] as const,
     resize: ['none', 'vertical', 'horizontal', 'both'] as const,
+    scrollbarGutter: ['auto', 'stable', 'stable both-edges'] as const,
     scrollSnapType: ['x', 'y', 'both', 'x mandatory', 'y mandatory', 'both mandatory'] as const,
     scrollSnapAlign: ['start', 'end', 'center', 'none'] as const,
     scrollSnapStop: ['normal', 'always'] as const,
```

**File**: `packages/dev/s2-docs/src/styleProperties.ts` (modified, +7/-0)
```diff
@@ -518,6 +518,7 @@ const layoutPropertyValues: {[key: string]: (string | number)[]} = {
   overflowY: ['auto', 'hidden', 'clip', 'visible', 'scroll'],
   overscrollBehaviorX: ['auto', 'contain', 'none'],
   overscrollBehaviorY: ['auto', 'contain', 'none'],
+  scrollbarGutter: ['auto', 'stable', 'stable both-edges'],
   scrollBehavior: ['auto', 'smooth'],
   order: ['number']
 };
@@ -1506,6 +1507,12 @@ const mdnPropertyLinks: {[key: string]: {[value: string]: string}} = {
     right: 'https://developer.mozilla.org/en-US/docs/Web/CSS/break-after#right',
     column: 'https://developer.mozilla.org/en-US/docs/Web/CSS/break-after#column'
   },
+  scrollbarGutter: {
+    auto: 'https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter#auto',
+    stable: 'https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter#stable',
+    'stable both-edges':
+      'https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter#both-edges'
+  },
   scrollBehavior: {
     auto: 'https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-behavior#auto',
     smooth: 'https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-behavior#smooth'
```

---

### Incident Patch 10: `3d2c143e` (2026-09-29)
**Commit Message**: fix: virtualized menu divider height, submenu trigger item indentation, and other followups  (#10673)

* fix section divider height, add chromatic, and other followups

* fix submenu indent when selection enabled

* fix promptfield menu width

* remove isReadOnlyWhileGenerating prop

**File**: `packages/@react-spectrum/ai/src/PromptField.tsx` (modified, +8/-18)
```diff
@@ -95,12 +95,6 @@ export interface PromptFieldProps {
   onAttachmentsChange?: (attachments: PromptFieldAttachment[]) => void;
   onSubmit?: (prompt: PromptFieldValue, attachments: PromptFieldAttachment[]) => void;
   isGenerating?: boolean;
-  /**
-   * Whether the field should be read only while a response is generating.
-   *
-   * @default false
-   */
-  isReadOnlyWhileGenerating?: boolean;
   onStop?: () => void;
   onAddAttachments?: (attachments: PromptFieldAttachment[]) => void;
   onRemoveAttachments?: (attachments: PromptFieldAttachment[]) => void;
@@ -131,7 +125,6 @@ interface PromptFieldState {
   onSubmit?: () => void;
   onStop?: () => void;
   isGenerating: boolean;
-  isReadOnlyWhileGenerating: boolean;
   onAddAttachments?: (attachments: PromptFieldAttachment[]) => void;
   onRemoveAttachments?: (attachments: PromptFieldAttachment[]) => void;
   isListening: boolean;
@@ -257,7 +250,6 @@ const PromptFieldContext = createContext<PromptFieldState & {size: 'S' | 'M'}>({
   setPrompt: () => {},
   inputRef: createRef(),
   isGenerating: false,
-  isReadOnlyWhileGenerating: false,
   isListening: false,
   setListening: () => {},
   voiceStopRef: createRef(),
@@ -293,7 +285,6 @@ export const PromptField = forwardRef(function PromptField(
     children,
     acceptedAttachmentTypes,
     isGenerating = false,
-    isReadOnlyWhileGenerating = false,
     onStop,
     styles,
     onAddAttachments,
@@ -378,7 +369,6 @@ export const PromptField = forwardRef(function PromptField(
         inputRef,
         onSubmit,
         isGenerating,
-        isReadOnlyWhileGenerating,
         isListening,
         setListening,
         voiceStopRef,
@@ -480,6 +470,7 @@ export interface PromptTokenFieldProps {
   shouldAnimatePixelLoader?: boolean;
   placeholder?: string;
   onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
+  onKeyUp?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
   // TODO: temp api for coworker so that the weird popover shrinking behavior
   // doesn't appear when rendering near edge of page
   menuWidth?: number;
@@ -498,7 +489,8 @@ export function PromptTokenField(props: PromptTokenFieldProps) {
     shouldAnimatePixelLoader = false,
     placeholder,
     menuWidth,
-    onKeyDown: onKeyDownProp
+    onKeyDown: onKeyDownProp,
+    onKeyUp: onKeyUpProp
   } = props;
   let {
     prompt,
@@ -509,7 +501,6 @@ export function PromptTokenField(props: PromptTokenFieldProps) {
     inputRef,
     onSubmit,
     isGenerating,
-    isReadOnlyWhileGenerating,
     isListening,
     size
   } = useContext(PromptFieldContext);
@@ -646,14 +637,14 @@ export function PromptTokenField(props: PromptTokenFieldProps) {
         />
       </CenterBaseline>
       <Autocomplete>
-        <div role="presentation" onKeyDown={onKeyDownProp}>
+        <div role="presentation" onKeyDown={onKeyDownProp} onKeyUp={onKeyUpProp}>
           <TokenField
             value={prompt}
             onChange={setPrompt}
             allowsNewlines
             className={style({flexGrow: 1})}
             aria-label={stringFormatter.format('promptfield.label')}
-            isReadOnly={isListening || (isGenerating && isReadOnlyWhileGenerating)}
+            isReadOnly={isListening}
             onSubmit={onSubmit}
             onKeyDown={keyboardProps.onKeyDown}
             onFocus={e => {
@@ -846,7 +837,7 @@ function PromptTokenFieldPopover(props: PromptTokenFieldPopoverProps) {
       isNonModal
       hideArrow
       placement="bottom start"
-      // since this is now virtualized we need a fallback width and padding is controled by virtualizeer
+      // since this is now virtualized we need a fallback width and padding is controlled by virtualizeer
       padding="none"
       UNSAFE_style={{width: menuWidth ?? 150}}
       key={key}
@@ -963,9 +954,8 @@ export interface PromptFieldSubmitButtonProps {}
 /** PromptFieldSubmitButton submits the PromptField. */
 // eslint-disable-next-line @typescript-eslint/no-unused-vars
 export function PromptFieldSubmitButton(props: PromptFieldSubmitButtonProps) {
-  let {prompt, isGenerating, isReadOnlyWhileGenerating, onSubmit, onStop} =
-    useContext(PromptFieldContext);
-  let showSubmit = !isGenerating || (!isReadOnlyWhileGenerating && prompt.segments.length > 0);
+  let {prompt, isGenerating, onSubmit, onStop} = useContext(PromptFieldContext);
+  let showSubmit = !isGenerating || prompt.segments.length > 0;
   let stringFormatter = useLocalizedStringFormatter(intlMessages, '@react-spectrum/ai');
   return (
     <Button
```

**File**: `packages/@react-spectrum/ai/test/PromptField.test.tsx` (modified, +7/-17)
```diff
@@ -475,20 +475,6 @@ describeOrSkip('PromptField', () => {
       expect(onSubmit).toHaveBeenCalledTimes(1);
       expect(onStop).not.toHaveBeenCalled();
     });
-
-    it('makes the field read only while generating when enabled', async () => {
-      let {user, textbox, getValue} = renderPromptField({
-        isGenerating: true,
-        isReadOnlyWhileGenerating: true
-      });
-
-      await user.click(textbox);
-      await user.keyboard('a');
-
-      expect(getValue().toString()).toBe('');
-      expect(screen.getByRole('button', {name: 'Stop'})).toBeInTheDocument();
-      expect(textbox).toHaveAttribute('data-readonly');
-    });
   });
 
   describe('attachments', () => {
@@ -556,19 +542,23 @@ describeOrSkip('PromptField', () => {
     });
   });
 
-  it('fires onKeyDown when a key is pressed in the token field', async () => {
+  it('fires onKeyDown and onKeyUp when a key is pressed in the token field', async () => {
     let onKeyDown = jest.fn();
+    let onKeyUp = jest.fn();
     let {getByRole} = render(
       <PromptField>
-        <PromptTokenField onKeyDown={onKeyDown} />
+        <PromptTokenField onKeyDown={onKeyDown} onKeyUp={onKeyUp} />
       </PromptField>
     );
 
     let input = getByRole('textbox');
     await user.click(input);
     await user.keyboard('a');
 
-    expect(onKeyDown).toHaveBeenCalled();
+    expect(onKeyDown).toHaveBeenCalledTimes(1);
+    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({key: 'a'}));
+    expect(onKeyUp).toHaveBeenCalledTimes(1);
+    expect(onKeyUp).toHaveBeenCalledWith(expect.objectContaining({key: 'a'}));
   });
 
   it('does not fire onKeyDown when selecting a virtually focused completion', async () => {
```

**File**: `packages/@react-spectrum/ai/test/utils/promptFieldTestUtils.tsx` (modified, +0/-3)
```diff
@@ -190,7 +190,6 @@ export interface HarnessOptions {
   initialValue?: PromptFieldValue;
   attachments?: PromptFieldAttachment[];
   isGenerating?: boolean;
-  isReadOnlyWhileGenerating?: boolean;
   placeholder?: string;
   acceptedAttachmentTypes?: string[];
   /** Applied to every rendered attachment (for exercising the upload progress state). */
@@ -220,7 +219,6 @@ function ControlledPromptField(props: ControlledPromptFieldProps) {
     initialValue = new PromptFieldValue([]),
     attachments: initialAttachments = [],
     isGenerating,
-    isReadOnlyWhileGenerating,
     placeholder,
     acceptedAttachmentTypes = ['image/*'],
     uploadProgress,
@@ -250,7 +248,6 @@ function ControlledPromptField(props: ControlledPromptFieldProps) {
       attachments={attachments}
       onAttachmentsChange={setAttachments}
       isGenerating={isGenerating}
-      isReadOnlyWhileGenerating={isReadOnlyWhileGenerating}
       onStop={spies.onStop}
       onSubmit={spies.onSubmit}
       acceptedAttachmentTypes={acceptedAttachmentTypes}
```

**File**: `packages/@react-spectrum/s2/chromatic/Menu.stories.tsx` (modified, +58/-1)
```diff
@@ -19,11 +19,13 @@ import {
   UnavailableMenuItem
 } from '../stories/Menu.stories';
 import {Button} from '../src/Button';
+import Copy from '../s2wf-icons/S2_Icon_Copy_20_N.svg';
 import {expect} from '@storybook/jest';
-import {Header, Heading} from '../src/Content';
+import {Header, Heading, Keyboard, Text} from '../src/Content';
 import {Menu, MenuItem, MenuSection, MenuTrigger, SubmenuTrigger} from '../src/Menu';
 import type {Meta, StoryObj} from '@storybook/react';
 import NewIcon from '../s2wf-icons/S2_Icon_New_20_N.svg';
+import {style} from '../style' with {type: 'macro'};
 import {userEvent, within} from 'storybook/test';
 
 const meta: Meta<typeof Menu<any>> = {
@@ -275,3 +277,58 @@ export const WithSectionsVirtualized: Story = {
     await within(body).findByRole('menu');
   }
 };
+
+export const WithSlotsVirtualized: Story = {
+  render: () => (
+    <MenuTrigger>
+      <Button aria-label="Actions">
+        <NewIcon />
+      </Button>
+      <Menu styles={style({width: 200})} isVirtualized selectionMode="multiple">
+        <MenuItem>
+          <Text slot="label">Label only</Text>
+        </MenuItem>
+        <MenuItem>
+          <Copy />
+          <Text slot="label">With icon</Text>
+        </MenuItem>
+        <MenuItem>
+          <Text slot="label">With description</Text>
+          <Text slot="description">Description</Text>
+        </MenuItem>
+        <MenuSection>
+          <Header>
+            <Heading>Menu section header</Heading>
+            <Text slot="description">Menu section description</Text>
+          </Header>
+          <MenuItem>
+            <Copy />
+            <Text slot="label">With icon and description</Text>
+            <Text slot="description">Description</Text>
+          </MenuItem>
+          <MenuItem>
+            <Text slot="label">With keyboard shortcut</Text>
+            <Keyboard>⌘C</Keyboard>
+          </MenuItem>
+          <MenuItem>
+            <Copy />
+            <Text slot="label">With all slots</Text>
+            <Text slot="description">Description</Text>
+            <Keyboard>⌘C</Keyboard>
+          </MenuItem>
+          <SubmenuTrigger>
+            <MenuItem id="open-in" textValue="open a copy">
+              <Copy />
+              <Text slot="label">Open a copy</Text>
+              <Text slot="description">Illustrator for iPad or desktop</Text>
+            </MenuItem>
+            <Menu selectionMode="single">
+              <MenuItem>Filler</MenuItem>
+            </Menu>
+          </SubmenuTrigger>
+        </MenuSection>
+      </Menu>
+    </MenuTrigger>
+  ),
+  play: async context => await DefaultVirtualized.play!(context)
+};
```

**File**: `packages/@react-spectrum/s2/src/Menu.tsx` (modified, +84/-32)
```diff
@@ -96,6 +96,7 @@ import {useGlobalListeners} from 'react-aria/private/utils/useGlobalListeners';
 import {useId} from 'react-aria/useId';
 import {useLocale} from 'react-aria/I18nProvider';
 import {useLocalizedStringFormatter} from 'react-aria/useLocalizedStringFormatter';
+import {useScale} from './utils';
 import {useSpectrumContextProps} from './useSpectrumContextProps';
 // viewbox on LinkOut is super weird just because i copied the icon from designs...
 // need to strip id's from icons
@@ -339,6 +340,10 @@ export let checkbox = style({
   marginEnd: 'text-to-control'
 });
 
+let hiddenCheckbox = style({
+  visibility: 'hidden'
+});
+
 export let icon = style({
   display: 'block',
   size: '1lh',
@@ -510,10 +515,23 @@ const emptyStateText = style({
   paddingX: 'edge-to-text'
 });
 
-const virtualizedMenuLayoutOptions = {
-  estimatedRowSize: 32,
-  estimatedHeadingSize: 50,
-  padding: 8
+const ROW_HEIGHTS = {
+  S: {
+    medium: 24,
+    large: 30
+  },
+  M: {
+    medium: 32,
+    large: 40
+  },
+  L: {
+    medium: 40,
+    large: 50
+  },
+  XL: {
+    medium: 48,
+    large: 60
+  }
 };
 
 /**
@@ -544,6 +562,7 @@ export const Menu = /*#__PURE__*/ (forwardRef as forwardRefType)(function Menu<T
   let ctx = useContext(InternalMenuTriggerContext);
   let inPopover = useContext(InPopoverContext);
   let stringFormatter = useLocalizedStringFormatter(intlMessages, '@react-spectrum/s2');
+  let scale = useScale();
 
   let menuLoadingCircle = (
     <AriaMenuLoadMoreItem
@@ -585,7 +604,13 @@ export const Menu = /*#__PURE__*/ (forwardRef as forwardRefType)(function Menu<T
       {...props}
       className={menu(
         {size, isPopover, isVirtualized},
-        isPopover ? null : mergeStyles(virtualizedMenuWidth({isVirtualized}), styles)
+        isPopover
+          ? null
+          : mergeStyles(
+              // if in user provided popover use their width instead of applying a min to the menu
+              virtualizedMenuWidth({isVirtualized: isVirtualized && !inPopover}),
+              styles
+            )
       )}
       renderEmptyState={() =>
         loadingState === 'loading' ? (
@@ -608,7 +633,13 @@ export const Menu = /*#__PURE__*/ (forwardRef as forwardRefType)(function Menu<T
   );
 
   let menuWithVirtualizer = isVirtualized ? (
-    <Virtualizer layout={ListLayout} layoutOptions={virtualizedMenuLayoutOptions}>
+    <Virtualizer
+      layout={ListLayout}
+      layoutOptions={{
+        estimatedRowSize: ROW_HEIGHTS[size][scale],
+        estimatedHeadingSize: ROW_HEIGHTS[size][scale],
+        padding: 8
+      }}>
       {menuContent}
     </Virtualizer>
   ) : isParentVirtualized ? (
@@ -666,21 +697,27 @@ export const Menu = /*#__PURE__*/ (forwardRef as forwardRefType)(function Menu<T
   return content;
 });
 
-let dividerPlacement = style<{size?: 'S' | 'M' | 'L' | 'XL'; isVirtualized?: boolean}>({
+let dividerPlacement = style({
   display: 'grid',
   gridColumnStart: 2,
   gridColumnEnd: -2,
+  marginY: size(5)
+});
+
+// same approach as combobox, need a wrapper with a fixed height so virtualizer measures it properly
+let virtualizedDividerWrapper = style<{size: 'S' | 'M' | 'L' | 'XL'}>({
+  display: 'flex',
+  flexDirection: 'column',
+  justifyContent: 'center',
+  height: 12,
   marginX: {
-    isVirtualized: {
-      size: {
-        S: `[${edgeToText(24)}]`,
-        M: `[${edgeToText(32)}]`,
-        L: `[${edgeToText(40)}]`,
-        XL: `[${edgeToText(48)}]`
-      }
+    size: {
+      S: `[${edgeToText(24)}]`,
+      M: `[${edgeToText(32)}]`,
+      L: `[${edgeToText(40)}]`,
+      XL: `[${edgeToText(48)}]`
     }
-  },
-  marginY: size(5) // height of the menu separator is 12px, and the divider is 2px
+  }
 });
 
 export const Divider = /*#__PURE__*/ createLeafComponent(
@@ -693,19 +730,22 @@ export const Divider = /*#__PURE__*/ createLeafComponent(
       return null;
     }
 
+    let dividerStyles = divider({
+      size: 'M',
+      orientation: 'horizontal',
+      isStaticColor: false
+    });
+
+    if (isVirtualized) {
+      return (
+        <div className={virtualizedDividerWrapper({size: ctxSize})}>
+          <Separator {...props} ref={ref} className={dividerStyles} />
+        </div>
+      );
+    }
+
     return (
-      <Separator
-        {...props}
-        ref={ref}
-        className={mergeStyles(
-          divider({
-            size: 'M',
-            orientation: 'horizontal',
-            isStaticColor: false
-          }),
-          dividerPlacement({size: ctxSize, isVirtualized})
-        )}
-      />
+      <Separator {...props} ref={ref} className={mergeStyles(dividerStyles, dividerPlacement)} />
     );
   }
 );
@@ -831,6 +871,8 @@ export function MenuItem(props: MenuItemProps): ReactNode {
           isRequired: false
         };
         let isFocused = (renderProps.hasSubmenu && renderProps.isOpen) || renderProps.isFocused;
+        // virtualized doesnt use subgrid so always render a hidden checkbox for submenu triggers so 
```

**File**: `packages/@react-spectrum/s2/stories/Menu.stories.tsx` (modified, +5/-4)
```diff
@@ -67,9 +67,10 @@ const meta: Meta<typeof CombinedMenu> = {
   tags: ['autodocs'],
   argTypes: {
     ...categorizeArgTypes('Events', events),
-    children: {table: {disable: true}}
+    children: {table: {disable: true}},
+    isVirtualized: {control: 'boolean'}
   },
-  args: {...getActionArgs(events)},
+  args: {...getActionArgs(events), isVirtualized: false},
   title: 'Menu'
 };
 
@@ -516,7 +517,7 @@ export const HoldAffordance: Story = {
       }}>
       <MenuTrigger trigger="longPress" {...args}>
         <ActionButton size={args.size}>Copy</ActionButton>
-        <Menu>
+        <Menu isVirtualized={args.isVirtualized}>
           <MenuItem>Copy as plain text</MenuItem>
           <MenuItem>Copy as rich text</MenuItem>
           <MenuItem>Copy URL</MenuItem>
@@ -526,7 +527,7 @@ export const HoldAffordance: Story = {
         <ToggleButton aria-label="Crop" size={args.size}>
           <Crop />
         </ToggleButton>
-        <Menu>
+        <Menu isVirtualized={args.isVirtualized}>
           <MenuItem>
             <CropRotate />
             <Text>Crop Rotate</Text>
```

---

### Incident Patch 11: `17334738` (2026-09-28)
**Commit Message**: fix: React 18 does not have ViewTransition (#10675)

**File**: `packages/@react-spectrum/s2/src/SideNav.tsx` (modified, +4/-4)
```diff
@@ -63,7 +63,7 @@ import {
 } from 'react-aria-components/NavigationTree';
 import {pressScale} from './pressScale';
 import {Provider, useContextProps} from 'react-aria-components/slots';
-import * as ReactAPI from 'react';
+import React from 'react';
 import sideNavCss from './SideNav.module.css';
 import {Text, TextContext} from './Content';
 import {useControlledState} from 'react-stately/useControlledState';
@@ -79,10 +79,10 @@ import {useScale} from './utils';
 // Older React versions just render their children, so the panel collapses and expands without
 // animating.
 const ViewTransition: ComponentType<{children: ReactNode; default?: ViewTransitionClass}> =
-  ReactAPI.ViewTransition ?? (({children}) => children);
-const addTransitionType: (type: string) => void = ReactAPI.addTransitionType ?? (() => {});
+  React.ViewTransition ?? (({children}) => children);
+const addTransitionType: (type: string) => void = React.addTransitionType ?? (() => {});
 const startTransition: (scope: () => void) => void =
-  ReactAPI.startTransition ?? ((scope: () => void) => scope());
+  React.startTransition ?? ((scope: () => void) => scope());
 
 // How long the panel takes to animate between its collapsed and expanded widths. Keep in sync with
 // sidePanelStyle's transitionDuration below. SidePanel falls back to this when it has to wait for
```

---

### Incident Patch 12: `62c27d90` (2026-09-28)
**Commit Message**: fix: use layout effect for PromptField sizing (#10668)

**File**: `packages/@react-spectrum/ai/src/PromptField.tsx` (modified, +2/-1)
```diff
@@ -74,6 +74,7 @@ import {useEffectEvent} from 'react-aria/private/utils/useEffectEvent';
 import {useFocusableRef} from './useDOMRef';
 import {useFocusWithin} from 'react-aria/useFocusWithin';
 import {useKeyboard} from 'react-aria/useKeyboard';
+import {useLayoutEffect} from 'react-aria/private/utils/useLayoutEffect';
 import {useLocale} from 'react-aria/I18nProvider';
 import {useLocalizedStringFormatter} from 'react-aria/useLocalizedStringFormatter';
 import {useVoiceInput, VoiceInputErrorCode} from './useVoiceInput';
@@ -344,7 +345,7 @@ export const PromptField = forwardRef(function PromptField(
   let {onFocusChange} = useContext(PromptFocusContext);
   let {focusWithinProps} = useFocusWithin({onFocusWithinChange: onFocusChange});
   let {setPromptFieldSize} = useContext(InternalChatContext);
-  useEffect(() => {
+  useLayoutEffect(() => {
     setPromptFieldSize(size);
   }, [setPromptFieldSize, size]);
 
```

---

### Incident Patch 13: `4a4236e6` (2026-09-28)
**Commit Message**: feat: Expose submit button when streaming, S2 virtualized menu support and other fixes (#10614)

* add async spinner to initial render completions menu load

* add test, punt on chromatic cuz it complains about act

* move onKeydown up so it doesnt recieve event when autocomplete is open

* support virtualization and fix so menu closes if no matches

* remove comment from merge conflict

* update api for menu virtualization

* support steering and onOpenChange on trace for omega tracking

* add test for virtualized menu

* remove the suspense loader

tried to simplify but moving the Suspense around the Popover resulted in the popover not even appearing until the items loaded

* fix submenutrigger so they work in virtualized menu

**File**: `packages/@react-spectrum/ai/src/PromptField.tsx` (modified, +145/-126)
```diff
@@ -94,6 +94,12 @@ export interface PromptFieldProps {
   onAttachmentsChange?: (attachments: PromptFieldAttachment[]) => void;
   onSubmit?: (prompt: PromptFieldValue, attachments: PromptFieldAttachment[]) => void;
   isGenerating?: boolean;
+  /**
+   * Whether the field should be read only while a response is generating.
+   *
+   * @default false
+   */
+  isReadOnlyWhileGenerating?: boolean;
   onStop?: () => void;
   onAddAttachments?: (attachments: PromptFieldAttachment[]) => void;
   onRemoveAttachments?: (attachments: PromptFieldAttachment[]) => void;
@@ -124,6 +130,7 @@ interface PromptFieldState {
   onSubmit?: () => void;
   onStop?: () => void;
   isGenerating: boolean;
+  isReadOnlyWhileGenerating: boolean;
   onAddAttachments?: (attachments: PromptFieldAttachment[]) => void;
   onRemoveAttachments?: (attachments: PromptFieldAttachment[]) => void;
   isListening: boolean;
@@ -249,6 +256,7 @@ const PromptFieldContext = createContext<PromptFieldState & {size: 'S' | 'M'}>({
   setPrompt: () => {},
   inputRef: createRef(),
   isGenerating: false,
+  isReadOnlyWhileGenerating: false,
   isListening: false,
   setListening: () => {},
   voiceStopRef: createRef(),
@@ -283,7 +291,8 @@ export const PromptField = forwardRef(function PromptField(
   let {
     children,
     acceptedAttachmentTypes,
-    isGenerating,
+    isGenerating = false,
+    isReadOnlyWhileGenerating = false,
     onStop,
     styles,
     onAddAttachments,
@@ -363,7 +372,8 @@ export const PromptField = forwardRef(function PromptField(
         setPrompt,
         inputRef,
         onSubmit,
-        isGenerating: isGenerating ?? false,
+        isGenerating,
+        isReadOnlyWhileGenerating,
         isListening,
         setListening,
         voiceStopRef,
@@ -494,6 +504,7 @@ export function PromptTokenField(props: PromptTokenFieldProps) {
     inputRef,
     onSubmit,
     isGenerating,
+    isReadOnlyWhileGenerating,
     isListening,
     size
   } = useContext(PromptFieldContext);
@@ -563,7 +574,6 @@ export function PromptTokenField(props: PromptTokenFieldProps) {
   };
 
   let {keyboardProps} = useKeyboard({
-    onKeyDown: onKeyDownProp,
     shortcuts: {
       Tab: () => tab(1),
       'Shift+Tab': () => tab(-1)
@@ -631,127 +641,132 @@ export function PromptTokenField(props: PromptTokenFieldProps) {
         />
       </CenterBaseline>
       <Autocomplete>
-        <TokenField
-          value={prompt}
-          onChange={setPrompt}
-          allowsNewlines
-          className={style({flexGrow: 1})}
-          aria-label={stringFormatter.format('promptfield.label')}
-          isReadOnly={isListening}
-          onSubmit={onSubmit}
-          onKeyDown={keyboardProps.onKeyDown}
-          onFocus={e => {
-            if (e.isTrusted) {
-              setFocused(true);
-
-              // If shift tabbing into the prompt field, select the last placeholder if any.
-              if (
-                e.relatedTarget &&
-                getInteractionModality() === 'keyboard' &&
-                e.currentTarget.compareDocumentPosition(e.relatedTarget) &
-                  Node.DOCUMENT_POSITION_FOLLOWING
-              ) {
-                let lastPlaceholder = prompt.segments.findLastIndex(s => s.type === 'token');
-                if (lastPlaceholder >= 0) {
-                  setPrompt(value =>
-                    value.withSelectedRange(
-                      new TokenFieldValue.SelectedRange(
-                        {index: lastPlaceholder, offset: 0},
-                        {index: lastPlaceholder, offset: 1}
+        <div role="presentation" onKeyDown={onKeyDownProp}>
+          <TokenField
+            value={prompt}
+            onChange={setPrompt}
+            allowsNewlines
+            className={style({flexGrow: 1})}
+            aria-label={stringFormatter.format('promptfield.label')}
+            isReadOnly={isListening || (isGenerating && isReadOnlyWhileGenerating)}
+            onSubmit={onSubmit}
+            onKeyDown={keyboardProps.onKeyDown}
+            onFocus={e => {
+              if (e.isTrusted) {
+                setFocused(true);
+
+                // If shift tabbing into the prompt field, select the last placeholder if any.
+                if (
+                  e.relatedTarget &&
+                  getInteractionModality() === 'keyboard' &&
+                  e.currentTarget.compareDocumentPosition(e.relatedTarget) &
+                    Node.DOCUMENT_POSITION_FOLLOWING
+                ) {
+                  let lastPlaceholder = prompt.segments.findLastIndex(s => s.type === 'token');
+                  if (lastPlaceholder >= 0) {
+                    setPrompt(value =>
+                      value.withSelectedRange(
+                        new TokenFieldValue.SelectedRange(
+                          {index: lastPlaceholder, offset: 0},
+                          {index: lastPlaceholder, offset: 1}
+                        )
                       )
-                    
```

**File**: `packages/@react-spectrum/ai/src/ResponseStatus.tsx` (modified, +15/-2)
```diff
@@ -655,6 +655,10 @@ export interface ExecutionTraceItemProps extends DOMProps, AriaLabelingProps {
   icon?: ReactNode;
   /** Spectrum-defined styles, returned by the `style()` macro. */
   styles?: StyleString;
+  /**
+   * Handler that is called when the trace is expanded or collapsed.
+   */
+  onExpandedChange?: (isExpanded: boolean) => void;
 }
 
 const EXECUTION_TRACE_ITEM_TRANSITION_DURATION = 650;
@@ -730,7 +734,16 @@ export const ExecutionTraceItem = forwardRef(function ExecutionTraceItem(
   props: ExecutionTraceItemProps,
   ref: DOMRef<HTMLLIElement>
 ) {
-  let {detail, detailMaxHeight, icon, children, styles, status = 'success', ...otherProps} = props;
+  let {
+    detail,
+    detailMaxHeight,
+    icon,
+    children,
+    styles,
+    status = 'success',
+    onExpandedChange,
+    ...otherProps
+  } = props;
   let domRef = useDOMRef(ref);
   let domProps = filterDOMProps(otherProps);
   let {isFocusVisible, focusProps} = useFocusRing();
@@ -788,7 +801,7 @@ export const ExecutionTraceItem = forwardRef(function ExecutionTraceItem(
         <div role="presentation" className={executionTraceItemDividerStyles} />
       </div>
       {hasDetail ? (
-        <RACDisclosure className="">
+        <RACDisclosure className="" onExpandedChange={onExpandedChange}>
           <DetailTrigger isPending={status === 'pending'}>{children}</DetailTrigger>
           <RACDisclosurePanel className={style(panelStyle)}>
             <div className={executationTradeDetailWrapperStyle}>
```

**File**: `packages/@react-spectrum/ai/stories/PromptField.stories.tsx` (modified, +35/-22)
```diff
@@ -348,7 +348,7 @@ let prompts = [
 ];
 
 function EverythingRender(args) {
-  let {placeholder, menuWidth, ...otherArgs} = args;
+  let {placeholder, menuWidth = 200, ...otherArgs} = args;
   let [value, setValue] = useState<TokenFieldValue>(() => new PromptFieldValue([]));
   let promptFieldRef = useRef<FocusableRefValue<HTMLDivElement>>(null);
   let [attachments, setAttachments] = useState<PromptFieldAttachment[]>([]);
@@ -635,27 +635,40 @@ export const Basic: Story = {
   render: args => <BasicRender {...args} />
 };
 
-export const AsyncCompletions = () => (
-  <PromptField>
-    <div className={style({display: 'flex', gap: 16, alignItems: 'center'})}>
-      <PromptTokenField
-        shouldAnimatePixelLoader
-        completionTrigger={/(?<=^|\s)[@/]/}
-        renderCompletions={async filterValue => {
-          await new Promise(resolve => setTimeout(resolve, 500));
-          return renderCompletions(filterValue);
-        }}>
-        {token => (
-          <PromptToken token={token}>
-            {getIcon(token)}
-            {token.text}
-          </PromptToken>
-        )}
-      </PromptTokenField>
-      <PromptFieldSubmitButton />
-    </div>
-  </PromptField>
-);
+function AsyncCompletionsRender({delay}: {delay: number}) {
+  return (
+    <PromptField>
+      <div className={style({display: 'flex', gap: 16, alignItems: 'center'})}>
+        <PromptTokenField
+          menuWidth={150}
+          shouldAnimatePixelLoader
+          completionTrigger={/(?<=^|\s)[@/]/}
+          renderCompletions={async filterValue => {
+            await new Promise(resolve => setTimeout(resolve, delay));
+            return renderCompletions(filterValue);
+          }}>
+          {token => (
+            <PromptToken token={token}>
+              {getIcon(token)}
+              {token.text}
+            </PromptToken>
+          )}
+        </PromptTokenField>
+        <PromptFieldSubmitButton />
+      </div>
+    </PromptField>
+  );
+}
+
+export const AsyncCompletions: StoryObj<typeof AsyncCompletionsRender> = {
+  render: args => <AsyncCompletionsRender {...args} />,
+  args: {
+    delay: 1000
+  },
+  argTypes: {
+    delay: {control: 'number'}
+  }
+};
 
 export const CustomAIDisclaimer: Story = {
   render: args => (
```

**File**: `packages/@react-spectrum/ai/test/PromptField.test.tsx` (modified, +94/-3)
```diff
@@ -25,6 +25,7 @@ import {
   renderPromptField,
   tokenTexts
 } from './utils/promptFieldTestUtils';
+import {MenuItem} from '@react-spectrum/s2/Menu';
 import React from 'react';
 import {render} from '@react-spectrum/test-utils-internal';
 import userEvent from '@testing-library/user-event';
@@ -57,11 +58,20 @@ describeOrSkip('PromptField', () => {
   let user;
 
   beforeAll(() => {
-    user = userEvent.setup({delay: null});
+    installRangePolyfill();
+    user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
+    jest.useFakeTimers();
+    jest.spyOn(window.HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => 100);
+    jest.spyOn(window.HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => 1000);
+    jest.spyOn(window.HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => 50);
   });
 
-  beforeAll(() => {
-    installRangePolyfill();
+  afterEach(() => {
+    act(() => jest.runAllTimers());
+  });
+
+  afterAll(() => {
+    jest.restoreAllMocks();
   });
 
   describe('placeholder text', () => {
@@ -108,6 +118,34 @@ describeOrSkip('PromptField', () => {
 
       expect(screen.queryByRole('menu')).not.toBeInTheDocument();
     });
+
+    it('renders async loaded items', async () => {
+      let renderCompletions = async function (): Promise<React.ReactNode[]> {
+        await new Promise(resolve => setTimeout(resolve, 500));
+        return [<MenuItem key="blah">blah</MenuItem>];
+      };
+
+      render(
+        <PromptField>
+          <PromptTokenField
+            completionTrigger={/(?<=^|\s)[@/]/}
+            renderCompletions={renderCompletions}
+          />
+        </PromptField>
+      );
+
+      await act(async () => {
+        await user.click(screen.getByRole('textbox'));
+        await user.keyboard('@');
+      });
+      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
+
+      await act(async () => {
+        jest.advanceTimersByTime(500);
+      });
+
+      expect(await findMenuItem('blah')).toBeInTheDocument();
+    });
   });
 
   describe('autocomplete trigger: /', () => {
@@ -418,6 +456,39 @@ describeOrSkip('PromptField', () => {
       await user.click(stop);
       expect(onStop).toHaveBeenCalledTimes(1);
     });
+
+    it('switches back to submit while typing during generation', async () => {
+      let {user, textbox, onSubmit, onStop} = renderPromptField({isGenerating: true});
+      expect(screen.getByRole('button', {name: 'Stop'})).toBeInTheDocument();
+
+      await user.click(textbox);
+      await user.keyboard('a');
+
+      let submit = screen.getByRole('button', {name: 'Send'});
+      expect(submit).toBeEnabled();
+      await user.keyboard('{Backspace}');
+      expect(screen.getByRole('button', {name: 'Stop'})).toBeInTheDocument();
+
+      await user.keyboard('a');
+      submit = screen.getByRole('button', {name: 'Send'});
+      await user.click(submit);
+      expect(onSubmit).toHaveBeenCalledTimes(1);
+      expect(onStop).not.toHaveBeenCalled();
+    });
+
+    it('makes the field read only while generating when enabled', async () => {
+      let {user, textbox, getValue} = renderPromptField({
+        isGenerating: true,
+        isReadOnlyWhileGenerating: true
+      });
+
+      await user.click(textbox);
+      await user.keyboard('a');
+
+      expect(getValue().toString()).toBe('');
+      expect(screen.getByRole('button', {name: 'Stop'})).toBeInTheDocument();
+      expect(textbox).toHaveAttribute('data-readonly');
+    });
   });
 
   describe('attachments', () => {
@@ -500,6 +571,26 @@ describeOrSkip('PromptField', () => {
     expect(onKeyDown).toHaveBeenCalled();
   });
 
+  it('does not fire onKeyDown when selecting a virtually focused completion', async () => {
+    let onKeyDown = jest.fn();
+    let {getByRole} = render(
+      <PromptField>
+        <PromptTokenField
+          completionTrigger={/(?<=^|\s)@/}
+          onKeyDown={onKeyDown}
+          renderCompletions={() => [<MenuItem key="blah">blah</MenuItem>]}
+        />
+      </PromptField>
+    );
+
+    await user.click(getByRole('textbox'));
+    await user.keyboard('@{ArrowDown}');
+    onKeyDown.mockClear();
+    await user.keyboard('{Enter}');
+
+    expect(onKeyDown).not.toHaveBeenCalled();
+  });
+
   it('calls onAITermsPress when the AI User Guidelines link is pressed', async () => {
     let onAITermsPress = jest.fn();
     let {user} = renderPromptField({onAITermsPress});
```

**File**: `packages/@react-spectrum/ai/test/ResponseStatus.test.tsx` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+/*
+ * Copyright 2026 Adobe. All rights reserved.
+ * This file is licensed to you under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License. You may obtain a copy
+ * of the License at http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software distributed under
+ * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
+ * OF ANY KIND, either express or implied. See the License for the specific language
+ * governing permissions and limitations under the License.
+ */
+
+import {
+  ExecutionTraceItem,
+  ResponseStatus,
+  ResponseStatusPanel,
+  ResponseStatusTitle
+} from '../src/ResponseStatus';
+import {render, screen} from '@react-spectrum/test-utils-internal';
+import userEvent from '@testing-library/user-event';
+
+describe('ExecutionTraceItem', () => {
+  let user;
+  beforeAll(() => {
+    user = userEvent.setup({});
+  });
+
+  afterAll(() => {
+    jest.restoreAllMocks();
+  });
+
+  it('calls onExpandedChange when its detail is expanded and collapsed', async () => {
+    let onExpandedChange = jest.fn();
+    render(
+      <ResponseStatus defaultExpanded>
+        <ResponseStatusTitle>test</ResponseStatusTitle>
+        <ResponseStatusPanel>
+          <ExecutionTraceItem detail="details" onExpandedChange={onExpandedChange}>
+            trace
+          </ExecutionTraceItem>
+        </ResponseStatusPanel>
+      </ResponseStatus>
+    );
+
+    await user.click(screen.getByRole('button', {name: 'trace'}));
+    expect(onExpandedChange).toHaveBeenCalledWith(true);
+
+    await user.click(screen.getByRole('button', {name: 'trace'}));
+    expect(onExpandedChange).toHaveBeenCalledWith(false);
+  });
+});
```

**File**: `packages/@react-spectrum/ai/test/utils/promptFieldTestUtils.tsx` (modified, +3/-0)
```diff
@@ -190,6 +190,7 @@ export interface HarnessOptions {
   initialValue?: PromptFieldValue;
   attachments?: PromptFieldAttachment[];
   isGenerating?: boolean;
+  isReadOnlyWhileGenerating?: boolean;
   placeholder?: string;
   acceptedAttachmentTypes?: string[];
   /** Applied to every rendered attachment (for exercising the upload progress state). */
@@ -219,6 +220,7 @@ function ControlledPromptField(props: ControlledPromptFieldProps) {
     initialValue = new PromptFieldValue([]),
     attachments: initialAttachments = [],
     isGenerating,
+    isReadOnlyWhileGenerating,
     placeholder,
     acceptedAttachmentTypes = ['image/*'],
     uploadProgress,
@@ -248,6 +250,7 @@ function ControlledPromptField(props: ControlledPromptFieldProps) {
       attachments={attachments}
       onAttachmentsChange={setAttachments}
       isGenerating={isGenerating}
+      isReadOnlyWhileGenerating={isReadOnlyWhileGenerating}
       onStop={spies.onStop}
       onSubmit={spies.onSubmit}
       acceptedAttachmentTypes={acceptedAttachmentTypes}
```

**File**: `packages/@react-spectrum/s2/chromatic/Menu.stories.tsx` (modified, +61/-1)
```diff
@@ -21,7 +21,7 @@ import {
 import {Button} from '../src/Button';
 import {expect} from '@storybook/jest';
 import {Header, Heading} from '../src/Content';
-import {Menu, MenuItem, MenuSection, MenuTrigger} from '../src/Menu';
+import {Menu, MenuItem, MenuSection, MenuTrigger, SubmenuTrigger} from '../src/Menu';
 import type {Meta, StoryObj} from '@storybook/react';
 import NewIcon from '../s2wf-icons/S2_Icon_New_20_N.svg';
 import {userEvent, within} from 'storybook/test';
@@ -215,3 +215,63 @@ export const WithSectionsAndLoadMore: Story = {
     await within(menu).findByRole('progressbar', {hidden: true});
   }
 };
+
+export const DefaultVirtualized: Story = {
+  render: () => (
+    <MenuTrigger>
+      <Button aria-label="Actions for selected resource">
+        <NewIcon />
+      </Button>
+      <Menu isVirtualized>
+        <MenuItem>Favorite</MenuItem>
+        <MenuItem>Edit</MenuItem>
+        <MenuItem>Delete</MenuItem>
+        <SubmenuTrigger>
+          <MenuItem>Share</MenuItem>
+          <Menu isVirtualized>
+            <MenuItem>SMS</MenuItem>
+            <MenuItem>Email</MenuItem>
+          </Menu>
+        </SubmenuTrigger>
+      </Menu>
+    </MenuTrigger>
+  ),
+  play: async ({canvasElement}) => {
+    await userEvent.tab();
+    await userEvent.keyboard('{ArrowDown}');
+    let body = canvasElement.ownerDocument.body;
+    await within(body).findByRole('menu');
+  }
+};
+
+export const WithSectionsVirtualized: Story = {
+  render: () => (
+    <MenuTrigger>
+      <Button aria-label="Actions">
+        <NewIcon />
+      </Button>
+      <Menu aria-label="Test" isVirtualized>
+        <MenuSection>
+          <Header>
+            <Heading>Section 1</Heading>
+          </Header>
+          <MenuItem>Cut</MenuItem>
+          <MenuItem>Copy</MenuItem>
+        </MenuSection>
+        <MenuSection>
+          <Header>
+            <Heading>Section 2</Heading>
+          </Header>
+          <MenuItem>Paste</MenuItem>
+          <MenuItem>Delete</MenuItem>
+        </MenuSection>
+      </Menu>
+    </MenuTrigger>
+  ),
+  play: async ({canvasElement}) => {
+    await userEvent.tab();
+    await userEvent.keyboard('{ArrowDown}');
+    let body = canvasElement.ownerDocument.body;
+    await within(body).findByRole('menu');
+  }
+};
```

**File**: `packages/@react-spectrum/s2/src/Menu.tsx` (modified, +129/-38)
```diff
@@ -49,6 +49,10 @@ import {centerBaseline} from './CenterBaseline';
 import CheckmarkIcon from '../ui-icons/Checkmark';
 import ChevronRightIcon from '../ui-icons/Chevron';
 import {Collection} from 'react-aria/Collection';
+import {
+  CollectionRendererContext,
+  DefaultCollectionRenderer
+} from 'react-aria-components/CollectionBuilder';
 import {ContextValue, DEFAULT_SLOT, Provider, useSlottedContext} from 'react-aria-components/slots';
 import {
   control,
@@ -80,6 +84,7 @@ import {InPopoverContext, Popover, PopoverContext} from './Popover';
 import intlMessages from '../intl/*.json';
 import {isSeparatorHidden, SeparatorNode} from './separator-utils';
 import LinkOutIcon from '../ui-icons/LinkOut';
+import {ListLayout, Virtualizer} from 'react-aria-components/Virtualizer';
 import {mergeStyles} from '../style/runtime';
 import {Placement} from 'react-aria/useOverlayPosition';
 import {PressResponder} from 'react-aria/private/interactions/PressResponder';
@@ -140,6 +145,13 @@ export interface MenuProps<T>
    * The current loading state of the Menu.
    */
   loadingState?: LoadingState;
+  /**
+   * Whether the Menu should be virtualized. Submenus inherit this from their parent menu by
+   * default.
+   *
+   * @default false
+   */
+  isVirtualized?: boolean;
 }
 
 export const MenuContext =
@@ -154,6 +166,7 @@ const menuItemGrid = {
   }
 } as const;
 
+// TODO: this is baiscally Picker's "menu" styling now, but with maxWidths and stuff
 export let menu = style(
   {
     outlineStyle: 'none',
@@ -163,13 +176,18 @@ export let menu = style(
     maxHeight: 'inherit',
     width: 'full',
     overflow: {
-      isPopover: 'auto'
+      isPopover: 'auto',
+      // similar to Combobox/Picker, needs this for virtualized so we get scroll events for virtualizer
+      isVirtualized: 'auto'
     },
     maxWidth: {
       isPopover: 320
     },
     padding: {
-      isPopover: 8
+      isPopover: {
+        default: 8,
+        isVirtualized: 0
+      }
     },
     fontFamily: 'sans',
     fontSize: controlFont(),
@@ -178,6 +196,12 @@ export let menu = style(
   getAllowedOverrides()
 );
 
+const virtualizedMenuWidth = style<{isVirtualized?: boolean}>({
+  width: {
+    isVirtualized: 150
+  }
+});
+
 export let section = style({
   gridColumnStart: 1,
   gridColumnEnd: -1,
@@ -190,10 +214,21 @@ export let section = style({
   gridTemplateColumns: menuItemGrid
 });
 
-export let sectionHeader = style<{size?: 'S' | 'M' | 'L' | 'XL'}>({
+export let sectionHeader = style<{size?: 'S' | 'M' | 'L' | 'XL'; isVirtualized?: boolean}>({
   color: 'neutral',
   gridColumnStart: 2,
   gridColumnEnd: -2,
+  // also from Combobox/Picker, but we want to keep the non virtualized menu styling too
+  marginX: {
+    isVirtualized: {
+      size: {
+        S: `[${edgeToText(24)}]`,
+        M: `[${edgeToText(32)}]`,
+        L: `[${edgeToText(40)}]`,
+        XL: `[${edgeToText(48)}]`
+      }
+    }
+  },
   boxSizing: 'border-box',
   minHeight: controlSize(),
   paddingY: centerPadding()
@@ -212,6 +247,7 @@ export let menuitem = style<
     isLink?: boolean;
     hasSubmenu?: boolean;
     isOpen?: boolean;
+    isVirtualized?: boolean;
   }
 >(
   {
@@ -248,7 +284,11 @@ export let menuitem = style<
       '. checkmark icon label       value keyboard descriptor .',
       '. .         .    description .     .        .          .'
     ],
-    gridTemplateColumns: 'subgrid',
+    gridTemplateColumns: {
+      default: 'subgrid',
+      // cant use subgrid since virtualizer div wrapper
+      isVirtualized: menuItemGrid
+    },
     gridTemplateRows: {
       // min-content prevents second row from 'auto'ing to a size larger then 0 when empty
       default: 'auto minmax(0, min-content)',
@@ -419,10 +459,12 @@ let InternalMenuContext = createContext<{
   size: 'S' | 'M' | 'L' | 'XL';
   isSubmenu: boolean;
   hideLinkOutIcon: boolean;
+  isVirtualized: boolean;
 }>({
   size: 'M',
   isSubmenu: false,
-  hideLinkOutIcon: false
+  hideLinkOutIcon: false,
+  isVirtualized: false
 });
 
 let InternalMenuTriggerContext = createContext<Omit<MenuTriggerProps, 'children'> | null>(null);
@@ -468,6 +510,12 @@ const emptyStateText = style({
   paddingX: 'edge-to-text'
 });
 
+const virtualizedMenuLayoutOptions = {
+  estimatedRowSize: 32,
+  estimatedHeadingSize: 50,
+  padding: 8
+};
+
 /**
  * Menus display a list of actions or options that a user can choose.
  */
@@ -476,7 +524,11 @@ export const Menu = /*#__PURE__*/ (forwardRef as forwardRefType)(function Menu<T
   ref: DOMRef<HTMLDivElement>
 ) {
   [props, ref] = useSpectrumContextProps(props, ref, MenuContext);
-  let {isSubmenu, size: ctxSize} = useContext(InternalMenuContext);
+  let {
+    isSubmenu,
+    size: ctxSize,
+    isVirtualized: isParentVirtualized
+  } = useContext(InternalMenuContext);
   let {
     children,
     size = ctxSize,
@@ -486,7 +538,8 @@ export const Menu = /*#__PURE__*/ (forwardRef as forwardRefType)(function Menu<T
     hideLinkOutIcon = fal
```

---

### Incident Patch 14: `4b6356ce` (2026-09-28)
**Commit Message**: chore: Remove some old browser workarounds (#10654)

* Remove meter role fallback workaround

* Remove focus preventScroll polyfill

* Remove NumberFormatter unit polyfill

* Remove firefox openLink workaround

**File**: `packages/@adobe/react-spectrum/stories/meter/Meter.stories.tsx` (modified, +1/-9)
```diff
@@ -60,15 +60,7 @@ export default {
 
 export const Default: MeterStory = {
   args: {label: 'Meter', value: 50},
-  name: 'value: 50',
-  parameters: {
-    a11y: {
-      config: {
-        // Erroring attributes work for meter and/or progressbar, but combined role confuses aXe
-        rules: [{id: 'aria-allowed-attr', selector: '*:not([role="meter progressbar"])'}]
-      }
-    }
-  }
+  name: 'value: 50'
 };
 
 export const ValueLabel1Of4: MeterStory = {
```

**File**: `packages/@adobe/react-spectrum/test/meter/Meter.test.js` (modified, +1/-3)
```diff
@@ -18,8 +18,6 @@ describe('Meter', function () {
   it('handles defaults', function () {
     let {getByRole} = render(<Meter label="Meter" />);
     let progressBar = getByRole('meter');
-    let alsoProgressBar = getByRole('progressbar', {queryFallbacks: true});
-    expect(progressBar).toBe(alsoProgressBar);
     expect(progressBar).toHaveAttribute('aria-valuemin', '0');
     expect(progressBar).toHaveAttribute('aria-valuemax', '100');
     expect(progressBar).toHaveAttribute('aria-valuenow', '0');
@@ -65,7 +63,7 @@ describe('Meter', function () {
     let progressBar = getByRole('meter');
     expect(progressBar).toHaveAttribute('aria-valuenow', '0');
     expect(progressBar).toHaveAttribute('aria-valuetext', '50%');
-    expect(progressBar).toHaveAttribute('role', 'meter progressbar');
+    expect(progressBar).toHaveAttribute('role', 'meter');
   });
 
   it('supports aria-label', function () {
```

**File**: `packages/@internationalized/number/src/NumberFormatter.ts` (modified, +0/-53)
```diff
@@ -20,30 +20,6 @@ try {
   // eslint-disable-next-line no-empty
 } catch {}
 
-let supportsUnit = false;
-try {
-  supportsUnit =
-    new Intl.NumberFormat('de-DE', {style: 'unit', unit: 'degree'}).resolvedOptions().style ===
-    'unit';
-  // eslint-disable-next-line no-empty
-} catch {}
-
-// Polyfill for units since Safari doesn't support them yet. See https://bugs.webkit.org/show_bug.cgi?id=215438.
-// Currently only polyfilling the unit degree in narrow format for ColorSlider in our supported locales.
-// Values were determined by switching to each locale manually in Chrome.
-const UNITS = {
-  degree: {
-    narrow: {
-      default: '°',
-      'ja-JP': ' 度',
-      'zh-TW': '度',
-      'sl-SI': ' °'
-      // Arabic?? But Safari already doesn't use Arabic digits so might be ok...
-      // https://bugs.webkit.org/show_bug.cgi?id=218139
-    }
-  }
-};
-
 export interface NumberFormatOptions extends Intl.NumberFormatOptions {
   /** Overrides default numbering system for the current locale. */
   numberingSystem?: string;
@@ -74,15 +50,6 @@ export class NumberFormatter implements Intl.NumberFormat {
       res = this.numberFormatter.format(value);
     }
 
-    if (this.options.style === 'unit' && !supportsUnit) {
-      let {unit, unitDisplay = 'short', locale} = this.resolvedOptions();
-      if (!unit) {
-        return res;
-      }
-      let values = UNITS[unit]?.[unitDisplay];
-      res += values[locale] || values.default;
-    }
-
     return res;
   }
 
@@ -132,15 +99,6 @@ export class NumberFormatter implements Intl.NumberFormat {
       options = {...options, signDisplay: this.options.signDisplay};
     }
 
-    if (!supportsUnit && this.options.style === 'unit') {
-      options = {
-        ...options,
-        style: 'unit',
-        unit: this.options.unit,
-        unitDisplay: this.options.unitDisplay
-      };
-    }
-
     return options;
   }
 }
@@ -157,17 +115,6 @@ function getCachedNumberFormatter(
     locale += `-nu-${numberingSystem}`;
   }
 
-  if (options.style === 'unit' && !supportsUnit) {
-    let {unit, unitDisplay = 'short'} = options;
-    if (!unit) {
-      throw new Error('unit option must be provided with style: "unit"');
-    }
-    if (!UNITS[unit]?.[unitDisplay]) {
-      throw new Error(`Unsupported unit ${unit} with unitDisplay = ${unitDisplay}`);
-    }
-    options = {...options, style: 'decimal'};
-  }
-
   let cacheKey =
     locale +
     (options
```

**File**: `packages/react-aria/src/meter/useMeter.ts` (modified, +1/-6)
```diff
@@ -37,12 +37,7 @@ export function useMeter(props: AriaMeterProps): MeterAria {
   return {
     meterProps: {
       ...progressBarProps,
-      // Use the meter role if available, but fall back to progressbar if not
-      // Chrome currently falls back from meter automatically, and Firefox
-      // does not support meter at all. Safari 13+ seems to support meter properly.
-      // https://bugs.chromium.org/p/chromium/issues/detail?id=944542
-      // https://bugzilla.mozilla.org/show_bug.cgi?id=1460378
-      role: 'meter progressbar'
+      role: 'meter'
     },
     labelProps
   };
```

**File**: `packages/react-aria/src/utils/focusWithoutScrolling.ts` (modified, +1/-77)
```diff
@@ -12,82 +12,6 @@
 
 import {FocusableElement} from '@react-types/shared';
 
-// This is a polyfill for element.focus({preventScroll: true});
-// Currently necessary for Safari and old Edge:
-// https://caniuse.com/#feat=mdn-api_htmlelement_focus_preventscroll_option
-// See https://bugs.webkit.org/show_bug.cgi?id=178583
-//
-
-// Original licensing for the following methods can be found in the
-// NOTICE file in the root directory of this source tree.
-// See https://github.com/calvellido/focus-options-polyfill
-
-interface ScrollableElement {
-  element: HTMLElement;
-  scrollTop: number;
-  scrollLeft: number;
-}
-
 export function focusWithoutScrolling(element: FocusableElement): void {
-  if (supportsPreventScroll()) {
-    element.focus({preventScroll: true});
-  } else {
-    let scrollableElements = getScrollableElements(element);
-    element.focus();
-    restoreScrollPosition(scrollableElements);
-  }
-}
-
-let supportsPreventScrollCached: boolean | null = null;
-function supportsPreventScroll() {
-  if (supportsPreventScrollCached == null) {
-    supportsPreventScrollCached = false;
-    try {
-      let focusElem = document.createElement('div');
-      focusElem.focus({
-        get preventScroll() {
-          supportsPreventScrollCached = true;
-          return true;
-        }
-      });
-    } catch {
-      // Ignore
-    }
-  }
-
-  return supportsPreventScrollCached;
-}
-
-function getScrollableElements(element: FocusableElement): ScrollableElement[] {
-  let parent = element.parentNode;
-  let scrollableElements: ScrollableElement[] = [];
-  let rootScrollingElement = document.scrollingElement || document.documentElement;
-
-  while (parent instanceof HTMLElement && parent !== rootScrollingElement) {
-    if (parent.offsetHeight < parent.scrollHeight || parent.offsetWidth < parent.scrollWidth) {
-      scrollableElements.push({
-        element: parent,
-        scrollTop: parent.scrollTop,
-        scrollLeft: parent.scrollLeft
-      });
-    }
-    parent = parent.parentNode;
-  }
-
-  if (rootScrollingElement instanceof HTMLElement) {
-    scrollableElements.push({
-      element: rootScrollingElement,
-      scrollTop: rootScrollingElement.scrollTop,
-      scrollLeft: rootScrollingElement.scrollLeft
-    });
-  }
-
-  return scrollableElements;
-}
-
-function restoreScrollPosition(scrollableElements: ScrollableElement[]) {
-  for (let {element, scrollTop, scrollLeft} of scrollableElements) {
-    element.scrollTop = scrollTop;
-    element.scrollLeft = scrollLeft;
-  }
+  element.focus({preventScroll: true});
 }
```

**File**: `packages/react-aria/src/utils/openLink.tsx` (modified, +1/-18)
```diff
@@ -12,7 +12,7 @@
 
 import {focusWithoutScrolling} from './focusWithoutScrolling';
 import {Href, LinkDOMProps, RouterOptions} from '@react-types/shared';
-import {isFirefox, isIPad, isMac, isWebKit} from './platform';
+import {isIPad, isMac, isWebKit} from './platform';
 import React, {
   createContext,
   DOMAttributes,
@@ -106,23 +106,6 @@ export function shouldClientNavigate(link: HTMLAnchorElement, modifiers: Modifie
 export function openLink(target: HTMLAnchorElement, modifiers: Modifiers, setOpening = true): void {
   let {metaKey, ctrlKey, altKey, shiftKey} = modifiers;
 
-  // Firefox does not recognize keyboard events as a user action by default, and the popup blocker
-  // will prevent links with target="_blank" from opening. However, it does allow the event if the
-  // Command/Control key is held, which opens the link in a background tab. This seems like the best we can do.
-  // See https://bugzilla.mozilla.org/show_bug.cgi?id=257870 and https://bugzilla.mozilla.org/show_bug.cgi?id=746640.
-  if (
-    !isWebKit() &&
-    isFirefox() &&
-    window.event?.type?.startsWith('key') &&
-    target.target === '_blank'
-  ) {
-    if (isMac()) {
-      metaKey = true;
-    } else {
-      ctrlKey = true;
-    }
-  }
-
   // WebKit does not support firing click events with modifier keys, but does support keyboard events.
   // https://github.com/WebKit/WebKit/blob/c03d0ac6e6db178f90923a0a63080b5ca210d25f/Source/WebCore/html/HTMLAnchorElement.cpp#L184
   let event =
```

---

### Incident Patch 15: `8b543001` (2026-09-25)
**Commit Message**: chore: update AGENTS.md with guidance on using storybook/docs locally (#10648)

* chore: update AGENTS.md with guidance on using storybook/docs locally

* update PULL_REQUEST_TEMPLATE.md

* Revert "update PULL_REQUEST_TEMPLATE.md"

This reverts commit 265e1cda7c01be83b5f6df9bd65a41ae7a471c9d.

* update PULL_REQUEST_TEMPLATE.md

**File**: `.github/PULL_REQUEST_TEMPLATE.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ Closes <!-- Github issue # here -->
 - [ ] Updated documentation (if it already exists for this component).
 - [ ] Looked at the Accessibility Practices for this feature - [Aria Practices](https://www.w3.org/WAI/ARIA/apg/)
 - [ ] I understand every change in this PR and can explain why it's there.
-- [ ] If AI-assisted, I followed our [AI contribution guidance](https://github.com/adobe/react-spectrum/blob/main/CONTRIBUTING.md#ai-assisted-contributions) and pointed my assistant at [CLAUDE.md](https://github.com/adobe/react-spectrum/blob/main/CLAUDE.md).
+- [ ] If AI-assisted, I followed our [AI contribution guidance](https://github.com/adobe/react-spectrum/blob/main/CONTRIBUTING.md#ai-assisted-contributions) and pointed my assistant at [AGENTS.md](https://github.com/adobe/react-spectrum/blob/main/AGENTS.md).
 
 ## 📝 Test Instructions:
 
```

**File**: `AGENTS.md` (modified, +19/-0)
```diff
@@ -19,6 +19,25 @@ This repo does **not** use the conventional JS toolchain — use these, don't sw
 - **Don't run `yarn chromatic` / `yarn chromatic:forced-colors`** — maintainers run the VRT suites.
 - All commonly used commands live in the root `package.json` scripts.
 
+## Visual verification with Storybook and docs
+
+When you need to inspect a component or verify a visual/interaction change, use the Parcel 3 development commands. They start much faster than their non-Parcel-3 counterparts:
+
+- **React Spectrum v3 / React Aria Components Storybook:** `yarn start-parcel3` → <http://localhost:9003/>
+- **Spectrum 2 Storybook:** `yarn start:s2-parcel3` → <http://localhost:6006/>
+- **Spectrum 2 and React Aria docs:** `yarn start:s2-docs-parcel3` → <http://localhost:1234/>. Source pages map directly to extensionless routes, for example <http://localhost:1234/s2/Accordion> and <http://localhost:1234/react-aria/Button>.
+
+Prefer a Storybook story's isolation URL over the manager UI when verifying a specific example. It loads only the story canvas, which is faster and easier to inspect or automate:
+
+```text
+http://localhost:9003/iframe.html?id=accordion--default&viewMode=story
+http://localhost:6006/iframe.html?id=accordion--example&viewMode=story
+```
+
+Story IDs usually follow `<title>--<export-name>`, so use the obvious ID when it is clear. If the title/name is customized, the ID is uncertain, or the story does not render, look up the exact `id` in the relevant Storybook's `/index.json`. Filter the index locally instead of printing the whole file. Keep the URL quoted when passing it to a shell command because it contains `&`.
+
+Run only one of the Parcel 3 Storybooks at a time: both public Storybook servers use an internal Parcel server on port 3000. There is currently no Parcel 3 counterpart for the legacy React Spectrum docs command (`yarn start:docs`), so use that only when those legacy docs are specifically needed.
+
 ## Contributing
 
 - **Match the surrounding code** — follow the naming, structure, and patterns of neighboring files.
```

#### Recent Merged Pull Requests:
- **PR #10705** (2026-10-02): fix: use type-only import for StoryFn in tailwind Sheet stories (@yihuiliao)
- **PR #10701** (2026-10-02): chore: Translations Update (@rgeraghty)
- **PR #10700** (2026-10-02): fix: action bar stories (@snowystinger)
- **PR #10698** (2026-10-02): fix: datefield CLDR crash (@snowystinger)
- **PR #10693** (2026-10-02): chore: Update PromptField aria labels and UserMessage padding (@devongovett)
- **PR #10691** (2026-10-02): fix: update links to new spectrum docs (#10687) (@misterbrownlee)
- **PR #10688** (2026-10-01): fix: browser tests failing due to browsers list data old (@snowystinger)
- **PR #10685** (2026-10-03): fix(RAC): clear PopoverContext in Popover (@reidbarber)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
