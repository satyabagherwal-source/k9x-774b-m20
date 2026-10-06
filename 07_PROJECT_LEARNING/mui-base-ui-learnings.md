# Forensic Learning Record (Deep Inspection): mui/base-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/mui-base-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mui/base-ui](https://github.com/mui/base-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:37:27.619Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mui/base-ui`
- **Description**: Unstyled UI components for building accessible web apps and design systems. From the creators of Radix, Floating UI, and Material UI.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11072 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/react/src/accordion/item/stateAttributesMapping.ts`
```
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { collapsibleOpenStateMapping as baseMapping } from '../../utils/collapsibleOpenStateMapping';
import type { AccordionItemState } from './AccordionItem';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import * as AccordionItemDataAttributes from './AccordionItemDataAttributes';

export const accordionStateAttributesMapping: StateAttributesMapping<AccordionItemState> = {
  ...baseMapping,
  index: (value) => ({ [AccordionItemDataAttributes.index]: String(value) }),
  ...transitionStatusMapping,
  value: () => null,
};

```

### Core Architecture Module: `packages/react/src/avatar/root/stateAttributesMapping.ts`
```
export const avatarStateAttributesMapping = {
  imageLoadingStatus: () => null,
};

```

### Core Architecture Module: `packages/react/src/checkbox/utils/getCheckboxStateAttributesMapping.ts`
```
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { CheckboxRootState } from '../root/CheckboxRoot';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import * as CheckboxRootDataAttributes from '../root/CheckboxRootDataAttributes';

export function getCheckboxStateAttributesMapping(
  state: CheckboxRootState,
): StateAttributesMapping<CheckboxRootState> {
  return {
    checked(value): Record<string, string> {
      if (state.indeterminate) {
        // `data-indeterminate` is already handled by the `indeterminate` prop.
        return {};
      }

      if (value) {
        return { [CheckboxRootDataAttributes.checked]: '' };
      }

      return { [CheckboxRootDataAttributes.unchecked]: '' };
    },
    ...fieldValidityMapping,
  };
}

```

### Core Architecture Module: `packages/react/src/collapsible/root/stateAttributesMapping.ts`
```
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { collapsibleOpenStateMapping as baseMapping } from '../../utils/collapsibleOpenStateMapping';
import type { CollapsibleRootState } from './CollapsibleRoot';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';

export const collapsibleStateAttributesMapping: StateAttributesMapping<CollapsibleRootState> = {
  ...baseMapping,
  ...transitionStatusMapping,
};

```

### Core Architecture Module: `packages/react/src/combobox/root/utils/constants.ts`
```
export const NO_ACTIVE_VALUE = Symbol('none');
export const INITIAL_LAST_HIGHLIGHT: { value: any; index: number } = {
  value: NO_ACTIVE_VALUE,
  index: -1,
} as const;

```

### Core Architecture Module: `packages/react/src/combobox/root/utils/index.ts`
```
import { stringifyAsLabel } from '../../../internals/resolveValueLabel';
import type { Filter } from './useFilter';

export type FilterItemToString = ((item: any) => string) & {
  selected?: ((value: any) => string) | undefined;
};

/**
 * Derives the default id assigned to `Combobox.Popup` when the input is rendered inside it.
 * Shared by the popup (which applies it) and the trigger (which references it via `aria-controls`)
 * so the convention only lives in one place.
 */
export function getComboboxPopupId(rootId: string | null | undefined) {
  return rootId == null ? undefined : `${rootId}-popup`;
}

/**
 * Enhanced filter using Intl.Collator for more robust string matching.
 * Uses the provided `itemToStringLabel` function if available, otherwise falls back to:
 * • When `item` is an object with a `value` property, that property is used.
 * • When `item` is a primitive (e.g. `string`), it is used directly.
 */
export function createCollatorItemFilter(
  collatorFilter: Filter,
  itemToStringLabel?: FilterItemToString,
) {
  return (item: any, query: string) => {
    if (item == null) {
      return false;
    }

    return collatorFilter.contains(item, query, itemToStringLabel);
  };
}

/**
 * Enhanced filter for single selection mode using Intl.Collator that shows all items
 * when query is empty or matches the current selection, making it easier to browse options.
 */
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

### Core Architecture Module: `packages/react/src/combobox/root/utils/useFilter.ts`
```
'use client';
import * as React from 'react';
import { createCollatorItemFilter, createSingleSelectionCollatorFilter } from './index';
import { getFilter } from '../../../internals/filter';
import type { Filter, GetFilterParameters as UseFilterOptions } from '../../../internals/filter';

export type { Filter, UseFilterOptions };

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 */
export const useCoreFilter = getFilter;

export interface UseComboboxFilterOptions extends UseFilterOptions {
  /**
   * Whether the combobox is in multiple selection mode.
   * @default false
   */
  multiple?: boolean | undefined;
  /**
   * The current value of the combobox, used to keep every item visible while the query still
   * matches the selection.
   */
  value?: any;
}

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 */
export function useComboboxFilter(options: UseComboboxFilterOptions = {}): Filter {
  const { multiple = false, value, ...collatorOptions } = options;

  const coreFilter = getFilter(collatorOptions);

  const contains: Filter['contains'] = React.useCallback(
    (item: any, query: string, itemToString?: (item: any) => string) => {
      if (multiple) {
        return createCollatorItemFilter(coreFilter, itemToString)(item, query);
      }
      return createSingleSelectionCollatorFilter(coreFilter, itemToString, value)(item, query);
    },
    [coreFilter, value, multiple],
  );

  return React.useMemo(() => ({ ...coreFilter, contains }), [contains, coreFilter]);
}

```

### Core Architecture Module: `packages/react/src/combobox/root/utils/useFilteredItems.ts`
```
import { useComboboxDerivedItemsContext } from '../ComboboxRootContext';

/**
 * Returns the internally filtered items.
 * Treat the result as read-only: it is internal state and may be a shared frozen array.
 */
export function useFilteredItems<T>() {
  const items = useComboboxDerivedItemsContext();
  return items.filteredItems as T[];
}

```

### Core Architecture Module: `packages/react/src/combobox/utils/ComboboxInternalDismissButton.tsx`
```
'use client';
import * as React from 'react';
import { useMergedRefs } from '@base-ui/utils/useMergedRefs';
import { visuallyHiddenInput } from '@base-ui/utils/visuallyHidden';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

type DismissEvent = React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>;

/**
 * @internal
 */
export const ComboboxInternalDismissButton = React.forwardRef<HTMLSpanElement>(
  function ComboboxInternalDismissButton(_, forwardedRef) {
    const store = useComboboxRootContext();

    const { buttonRef, getButtonProps } = useButton({
      native: false,
    });

    const mergedRef = useMergedRefs(forwardedRef, buttonRef);

    function handleDismiss(event: DismissEvent) {
      store.context.setOpen(
        false,
        createChangeEventDetails(REASONS.closePress, event.nativeEvent, event.currentTarget),
      );
    }

    const dismissProps = getButtonProps({
      onClick: handleDismiss,
    });

    return (
      <span
        ref={mergedRef}
        {...dismissProps}
        aria-label="Dismiss"
        tabIndex={undefined}
        style={visuallyHiddenInput}
      />
    );
  },
);

```

### Core Architecture Module: `packages/react/src/combobox/utils/handleInputPress.ts`
```
import { isElement } from '@floating-ui/utils/dom';
import type * as React from 'react';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getTarget, isInteractiveElement } from '../../floating-ui-react/utils/element';
import type { ComboboxStore } from '../store';

export function handleInputPress(
  event: React.MouseEvent<HTMLElement> & { baseUIHandlerPrevented?: boolean | undefined },
  store: ComboboxStore,
  disabled: boolean,
  shouldIgnoreTarget?: ((target: Element | null) => boolean) | undefined,
) {
  if (event.baseUIHandlerPrevented) {
    return;
  }

  const target = getTarget(event.nativeEvent);
  const targetElement = isElement(target) ? target : null;
  if (
    targetElement !== event.currentTarget &&
    (shouldIgnoreTarget?.(targetElement) || isInteractiveElement(targetElement))
  ) {
    return;
  }

  event.preventDefault();

  if (disabled) {
    return;
  }

  store.context.inputRef.current?.focus();

  if (store.state.openOnInputClick) {
    store.context.setOpen(true, createChangeEventDetails(REASONS.inputPress, event.nativeEvent));
  }
}

```

### Core Architecture Module: `packages/react/src/combobox/utils/parts.ts`
```
'use client';
import { useComboboxDerivedItemsContext } from '../root/ComboboxRootContext';
import type { ComboboxStore } from '../store';
import type { Side } from '../../internals/useAnchorPositioning';

/**
 * The popup side is only meaningful while the positioner is mounted, as the store retains the
 * last resolved side after the popup unmounts.
 */
export function usePopupSide(store: ComboboxStore): Side | null {
  const mounted = store.useState('mounted');
  const popupSide = store.useState('popupSide');
  const positionerElement = store.useState('positionerElement');

  return mounted && positionerElement ? popupSide : null;
}

/**
 * Whether the filtered list has no items to show.
 */
export function useListEmpty(): boolean {
  return useComboboxDerivedItemsContext().filteredItems.length === 0;
}

/**
 * The arrow keys that move the chip highlight backwards and forwards, in that order.
 */
export function getChipNavigationKeys(direction: 'ltr' | 'rtl') {
  return direction === 'rtl'
    ? (['ArrowRight', 'ArrowLeft'] as const)
    : (['ArrowLeft', 'ArrowRight'] as const);
}

/**
 * Where the highlight lands once the chip at `index` is removed, or `undefined` for no highlight.
 */
export function getIndexAfterChipRemoval(index: number, chipCount: number) {
  const nextIndex = index >= chipCount - 1 ? chipCount - 2 : index;
  return nextIndex >= 0 ? nextIndex : undefined;
}

/**
 * Commits the highlighted item by clicking it, tagging the originating event so the item's
 * handler can attribute the selection to it.
 */
export function clickHighlightedItem(
  store: ComboboxStore,
  activeIndex: number,
  nativeEvent: KeyboardEvent,
) {
  const listItem = store.context.listRef.current[activeIndex];

  if (listItem) {
    store.context.selectionEventRef.current = nativeEvent;
    listItem.click();
    store.context.selectionEventRef.current = null;
  }
}

```

### Core Architecture Module: `packages/react/src/combobox/utils/stateAttributesMapping.ts`
```
import { pressableTriggerOpenStateMapping } from '../../utils/popupStateMapping';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { Side } from '../../internals/useAnchorPositioning';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import * as ComboboxInputDataAttributes from '../input/ComboboxInputDataAttributes';

export const triggerStateAttributesMapping = {
  ...pressableTriggerOpenStateMapping,
  ...fieldValidityMapping,
  popupSide: (side: Side | null) =>
    side ? { [ComboboxInputDataAttributes.popupSide]: side } : null,
  listEmpty: (empty: boolean) => (empty ? { [ComboboxInputDataAttributes.listEmpty]: '' } : null),
} satisfies StateAttributesMapping<{
  open: boolean;
  valid: boolean | null;
  popupSide: Side | null;
  listEmpty: boolean;
  placeholder: boolean;
}>;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5885** (2026-10-05): **[docs] Replace Menu.Item link example in Composition handbook**
  *Symptoms*: The "Changing the default rendered element" section of the [Composition handbook](https://base-ui.com/react/handbook/composition#changing-the-default-rendered-element) showed rendering `<Menu.Item>` as an `<a>` so it works like a link. That's no longer the recommended approach: `<Menu.LinkItem>` is the dedicated part for menu links.  This replaces the example with `<Accordion.Header>` (an `<h3>` by default) rendered as an `<h2>` to fit the page's heading hierarchy. It's a realistic, case-by-case element change that doesn't need extra props like `nativeButton`, which matches the paragraph that follows the snippet.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/44dcb4e3-7b00-42a9-ab3e-ad914ee2901e) - [vite-css-base-ui-example](https://pkg.pr.new/template/47fdc7b7-74e5-472c-9327-59a9ffba1777)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5885   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5885   ```     _commit: <a href="https://github.com/mui/base-ui/runs/111702509830"><code>4adce7c</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react |  0B<sup>(0.00%)</sup> |  0B<sup>(0.00%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=4adce7cded818678097907e9925af6f8ba0b2a7a&base=4ba59eeb78ec54c9cc1ebfad9a1f629008054ad4&prNumber=5885&baseRef=master)  ## Performance  **Total duration:** 481.20 ms +22.53 ms<sup>(+4.9%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 894.10 ms +61.89 ms<sup>(+7.4%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Menu mount (300 instances) | 27.11 ms 🔺+5.00 ms<sup>(+22.6%)</sup> | 1 <sup>(+0)</sup> | | Combobox open — 500 items | 13.79 ms 🔺+3.74 ms<sup>(+37.1%)</sup> | 4 <sup>(+0)</sup> |  *13 tests within noise — [details](https://code-infra-dashboard.onrender.com/benchmark-details/mui/base-ui?sha=4adce7cded818678097907e9925af6f8ba0b2a7a&prNumber=5885&baseRef=master)
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 4adce7cded818678097907e9925af6f8ba0b2a7a | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6ac36fde5f406100081bfb9d | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5885--base-ui.netlify.app](https://deploy-preview-5885--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4ODUtLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.vHfGUTy0QkGi72OHRcS1UinSqOYA5yTcl5L-ckMTDzA)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes | [Run an agent on this branch](https://app.netlify

- **Issue #5871** (2026-10-05): **[field][select][combobox][slider] Fix label focus in Shadow DOM**
  *Symptoms*: Clicking `Select.Label`, `Combobox.Label`, or a non-native `Field.Label` inside a shadow root currently fails to focus its control. If the outer document contains an element with the same ID, the label can instead focus that unrelated element.  Scope the shared `useLabel` lookup to the label's root node. Document lookups retain their existing behavior, while shadow-root lookups stay within the same DOM tree. This does not change the public API or custom focus handlers.  [StackBlitz reproduction](https://stackblitz.com/edit/djkqwdgz?file=src%2FApp.tsx) demonstrates the existing Field.Label issue, including an outer-document ID collision.  Regression tests cover supported Select.Label and Combobox.Label compositions and a non-native Field.Label labeling a Select. They verify focus without opening the popup in ordinary DOM and Shadow DOM, with and without an outer matching ID, and preserve native Field.Label activation. All six new Shadow DOM trigger cases failed before the fix in both jsdom and Chromium and pass afterward.  - [x] I have followed (at least) the [PR section of the contributing guide](https://github.com/mui/base-ui/blob/HEAD/CONTRIBUTING.md#sending-a-pull-request). 
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/e8f967c8-5f34-4729-a7ec-02874cdbb9d7) - [vite-css-base-ui-example](https://pkg.pr.new/template/1a501e9d-17a1-4595-8b50-d43c0833f2f7)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5871   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5871   ```     _commit: <a href="https://github.com/mui/base-ui/runs/111637297667"><code>f56865d</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react | 🔺+20B<sup>(0.00%)</sup> | 🔺+8B<sup>(0.00%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=f56865d74356f75468f03d46e6c97599d1e956ac&base=57920487fb91b7ce4f92548e7a6c0ce95abb4907&prNumber=5871&baseRef=master)  ## Performance  **Total duration:** 551.30 ms +80.35 ms<sup>(+17.1%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 990.03 ms +118.74 ms<sup>(+13.6%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Scroll Area mount (300 instances) | 49.70 ms 🔺+15.53 ms<sup>(+45.4%)</sup> | 3 <sup>(+0)</sup> | | Menu mount (300 instances) | 30.48 ms 🔺+8.69 ms<sup>(+39.9%)</sup> | 1 <sup>(+0)</sup> | | Tooltip mount (300 contained roots) | 24.05 ms 🔺+7.15 ms<sup>(+42.3%)</sup> | 1 <sup>(+0)</sup> | | Menu open (500 items) | 26.01 ms 🔺+5.81 ms<sup>(+28.8%)</sup>
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | f56865d74356f75468f03d46e6c97599d1e956ac | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6ac33e446b9fac00085fa161 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5871--base-ui.netlify.app](https://deploy-preview-5871--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4NzEtLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.26Wz2RKY59sZm9fRE2GBFLxhX-XFFUFURPb0zrPwsOk)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes | [Run an agent on this branch](https://app.netlify

- **Issue #5870** (2026-10-02): **[docs] Use Select.Label in the grouped select demos**
  *Symptoms*: Use `Select.Label` in both grouped demo variants so the Select documentation demonstrates its own label part consistently with the other examples. Keep `Field.Root` and the existing styles.  - [x] I have followed (at least) the [PR section of the contributing guide](https://github.com/mui/base-ui/blob/HEAD/CONTRIBUTING.md#sending-a-pull-request). 
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/66bed2aa-2ae7-4076-8eb3-7293a79e9aaa) - [vite-css-base-ui-example](https://pkg.pr.new/template/48eb24ca-84d5-416a-97e1-dc94731e90f1)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5870   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5870   ```     _commit: <a href="https://github.com/mui/base-ui/runs/110859407570"><code>a04cb4e</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react |  0B<sup>(0.00%)</sup> |  0B<sup>(0.00%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=a04cb4e2232c672bd01bcdd02c315e1107b0138e&base=19511bb171f3b360b006c94cf6d07e53cb446505&prNumber=5870&baseRef=master)  ## Performance  **Total duration:** 518.31 ms +4.28 ms<sup>(+0.8%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 956.45 ms +17.76 ms<sup>(+1.9%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Menu mount (300 instances) | 29.22 ms 🔺+6.88 ms<sup>(+30.8%)</sup> | 1 <sup>(+0)</sup> |  *14 tests within noise — [details](https://code-infra-dashboard.onrender.com/benchmark-details/mui/base-ui?sha=a04cb4e2232c672bd01bcdd02c315e1107b0138e&prNumber=5870&baseRef=master)*  **Metric alarms**  | Test | Metric | Change | |:-----|:-------|-------:| | Menu mount (30
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | a04cb4e2232c672bd01bcdd02c315e1107b0138e | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6abfb2161a76d50008a71405 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5870--base-ui.netlify.app](https://deploy-preview-5870--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4NzAtLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.MTA0vvXscQSjWKbPQY63TFT4VAjwpx5zbieovvG4O48)<br /><br />_Use your smartphone cam

- **Issue #5869** (2026-10-05): **[docs][context menu] Use ContextMenu.Separator in the submenu demo**
  *Symptoms*: The CSS Modules version of the Context Menu submenu demo imported `Menu` only to render the separator inside the submenu as `<Menu.Separator>`. The rest of the demo, and the whole Tailwind version, use `<ContextMenu.Separator>`.  Both parts export the same `Separator` component, so this is a consistency fix with no visual or behavior change. It also drops the unneeded `Menu` import.  Split out of #5636 to keep that PR focused on removing demos.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/c0730c3e-02ca-4f21-9198-c55b15a82ada) - [vite-css-base-ui-example](https://pkg.pr.new/template/e6fa3ea0-8aaa-46b2-abea-b16acbe576e9)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5869   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5869   ```     _commit: <a href="https://github.com/mui/base-ui/runs/110839734770"><code>02acbba</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react |  0B<sup>(0.00%)</sup> |  0B<sup>(0.00%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=02acbbac1e0bee1c82c6bf455cbbdf5eef1fcedc&base=46f746399bc63a985157859f7568fbaf0097d528&prNumber=5869&baseRef=master)  ## Performance  **Total duration:** 482.09 ms +43.44 ms<sup>(+9.9%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 895.71 ms +87.33 ms<sup>(+10.8%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Slider mount (300 instances) | 69.53 ms 🔺+23.05 ms<sup>(+49.6%)</sup> | 2 <sup>(+0)</sup> | | Popover mount (300 instances) | 19.61 ms 🔺+5.84 ms<sup>(+42.4%)</sup> | 1 <sup>(+0)</sup> | | Dialog mount (300 instances) | 15.39 ms 🔺+3.90 ms<sup>(+33.9%)</sup> | 1 <sup>(+0)</sup> | | Tooltip mount (300 contained roots) | 19.99 ms 🔺+3.81 ms<sup>(+23.5%)</sup> |
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 02acbbac1e0bee1c82c6bf455cbbdf5eef1fcedc | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6abfa4f34fcf93000850e727 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5869--base-ui.netlify.app](https://deploy-preview-5869--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4NjktLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.MhhqZCN00L0USkYLkEAffWZY0jziaQlkQM6IopwyAIQ)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes | [Run an agent on this branch](https://app.netlify

- **Issue #5866** (2026-10-05): **[code-infra] Run React Compiler tests on master merges**
  *Symptoms*: `JSDOM tests (React Compiler)` and `Browser tests (React Compiler)` ran on every push. This moves them out of `pipeline` into a new `react-compiler` workflow that runs only on pushes to `master`, so after each merge.  Trade-off: a compiler-only regression now shows up right after the merge instead of on the PR. Each merge still gets its own run, so a failure points at the commit that caused it. In September that never happened (see below).  ## Before merging  Both jobs are required status checks in the `master` ruleset. Remove these two entries from it, or every PR will wait forever for checks that no longer run:  - `ci/circleci: JSDOM tests (React Compiler)` - `ci/circleci: Browser tests (React Compiler)`  ## Cost (2026-09-01 → 2026-09-30, all branches)  | Job | Runs | Credits | Median duration | | --- | --: | --: | --: | | `JSDOM tests (React Compiler)` | 1,227 | 118,592 | 305s | | `Browser tests (React Compiler)` | 1,232 | 100,429 | 255s | | **Total** | | **219,021** | |  That's 26% of base-ui's 827,339 credits for the month. Each job also rebuilds the packages with the compiler first: about 50–60s on top of the regular test run.  ## What they caught  I looked at every `pipeline` run where a compiler job failed but its regular counterpart (`JSDOM tests` / `Browser tests`) passed in the same pipeline, and sorted them by failing tests:  | | Runs | | --- | --: | | Compiler-only failures | 20 | | Flaky tests that also failed on 3+ other branches or on master | 11 | | Infra err
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/93fd38eb-2c8b-42d4-a091-f7b54970494f) - [vite-css-base-ui-example](https://pkg.pr.new/template/36a4a137-c3bb-461a-96fe-ea9015a4f801)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5866   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5866   ```     _commit: <a href="https://github.com/mui/base-ui/runs/111717632489"><code>71af049</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react |  0B<sup>(0.00%)</sup> |  0B<sup>(0.00%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=71af049e751ac262298478f733c037497264cb6f&base=57920487fb91b7ce4f92548e7a6c0ce95abb4907&prNumber=5866&baseRef=master)  ## Performance  **Total duration:** 432.42 ms -31.85 ms<sup>(-6.9%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 806.33 ms -33.43 ms<sup>(-4.0%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Dialog mount (300 instances) | 11.74 ms ▼-3.83 ms<sup>(-24.6%)</sup> | 1 <sup>(+0)</sup> | | Checkbox mount (500 instances) | 39.90 ms +5.79 ms<sup>(+17.0%)</sup> | 1 <sup>(+0)</sup> |  *13 tests within noise — [details](https://code-infra-dashboard.onrender.com/benchmark-details/mui/base-ui?sha=71af049e751ac262298478f733c037497264cb6f&prNumber=5866&baseRef=mas
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 71af049e751ac262298478f733c037497264cb6f | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6ac379d6d1e0260008318724 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5866--base-ui.netlify.app](https://deploy-preview-5866--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4NjYtLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.egFd7r9s9VvXREO64xaCOLnpOp0R5qmRWFRgGTHzur4)<br /><br />_Use your smartphone cam

- **Issue #5864** (2026-10-05): **[drawer] Skip touchmove listener while closed**
  *Symptoms*: A closed `<Drawer.Portal keepMounted>` keeps a document-level `touchmove` listener registered with `{ passive: false, capture: true }` for as long as the page is open. The open/mounted checks only ran inside the handler, so the listener stayed attached while the drawer was closed, and every touch scroll on the page had to wait for the main thread.  This PR registers the listener only while the drawer is open and mounted. The handler already did nothing while closed, so behavior is unchanged. It also adds a test that checks no non-passive `touchmove` listener exists while a `keepMounted` drawer is closed. 
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/78f47f14-e4b3-49e4-ac7e-bed2c76c4dee) - [vite-css-base-ui-example](https://pkg.pr.new/template/a73ae573-cb7b-480f-8713-232b641e7015)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5864   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5864   ```     _commit: <a href="https://github.com/mui/base-ui/runs/111592481335"><code>5ba8e28</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react |  0B<sup>(0.00%)</sup> | 🔺+3B<sup>(0.00%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=5ba8e289f61e34771633196768bc82b040f3ce8f&base=f15c18bbbb237934712cc644e3381939f13d3124&prNumber=5864&baseRef=master)  ## Performance  **Total duration:** 436.52 ms +11.29 ms<sup>(+2.7%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 793.33 ms +6.62 ms<sup>(+0.8%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Checkbox mount (500 instances) | 36.04 ms 🔺+6.47 ms<sup>(+21.9%)</sup> | 1 <sup>(+0)</sup> | | Select open (500 options) | 25.04 ms ▼-6.92 ms<sup>(-21.6%)</sup> | 14 <sup>(+0)</sup> | | Menu mount (300 instances) | 20.69 ms ▼-6.10 ms<sup>(-22.8%)</sup> | 1 <sup>(+0)</sup> | | Tooltip mount (300 contained roots) | 15.74 ms ▼-4.52 ms<sup>(-22.3%)</sup> | 1 <sup
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 5ba8e289f61e34771633196768bc82b040f3ce8f | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6ac30bc38469a20008e8a91c | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5864--base-ui.netlify.app](https://deploy-preview-5864--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4NjQtLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.W5rJTj06z4ApugD21ULDz7TSTDjo8ewFT3OVgjiPoeE)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes | [Run an agent on this branch](https://app.netlify

- **Issue #5863** (2026-10-05): **[select][combobox] Combine item store subscriptions**
  *Symptoms*: <!-- Thanks so much for your PR, your contribution is appreciated! ❤️ -->  - [x] I have followed (at least) the [PR section of the contributing guide](https://github.com/mui/base-ui/blob/HEAD/CONTRIBUTING.md#sending-a-pull-request).  Since #5589, each `SelectItem` reads `itemProps`, `multiple`, `disabled` and `readOnly` through four separate store subscriptions, where it previously read one context. With long lists this made opening a Select noticeably slower. `ComboboxItem` has had the same pattern for longer, with six root-wide values each read through its own subscription.  This PR combines those root-wide values into a single `itemRoot` object in each store. The object is memoized in `SelectRoot` and `AriaCombobox`, and each item reads it with one `useState('itemRoot')`. This takes Select items from 9 to 5 subscriptions and Combobox/Autocomplete items from 8 to 3. Per-item selectors like `isActive` and `isSelected` stay separate, so a highlight change still re-renders only the affected items. The object only changes when one of the root values changes, and every item re-rendered in that case before too.  
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/b9775fac-1bfa-4fda-8eb1-b43bff924eb9) - [vite-css-base-ui-example](https://pkg.pr.new/template/502f6479-45d2-43e4-bc03-7555555258c3)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5863   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5863   ```     _commit: <a href="https://github.com/mui/base-ui/runs/111603375792"><code>b46bccb</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react | 🔺+197B<sup>(+0.04%)</sup> | 🔺+55B<sup>(+0.03%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=b46bccbab85c88f53a9bae318a828570a08d0359&base=6b5da6f34a8dafd0a385a90871b06972bea746cf&prNumber=5863&baseRef=master)  ## Performance  **Total duration:** 383.49 ms -33.84 ms<sup>(-8.1%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 688.97 ms -87.86 ms<sup>(-11.3%)</sup>  *No significant changes — [details](https://code-infra-dashboard.onrender.com/benchmark-details/mui/base-ui?sha=b46bccbab85c88f53a9bae318a828570a08d0359&prNumber=5863&baseRef=master)*  <hr>  Check out the [code infra dashboard](https://code-infra-dashboard.onrender.com/repository/mui/base-ui/prs/5863) for more information about this PR.
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | b46bccbab85c88f53a9bae318a828570a08d0359 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6ac3189074f320000888a71b | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5863--base-ui.netlify.app](https://deploy-preview-5863--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4NjMtLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.uNPPOwvforT70jAIBgjpEedKEx9nFVdJizp_3No-SFQ)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes | [Run an agent on this branch](https://app.netlify

- **Issue #5862** (2026-10-05): **[composite] Fix list map tick canceling in StrictMode**
  *Symptoms*: `CompositeList` forces a map rebuild by toggling a boolean state (`setMapTick((tick) => !tick)`). Under React 19 Strict Mode, two toggles can land in the same render and cancel out. That happens when the list re-renders in the same commit that mounts new items: the flush effect clears `isDirtyRef` while the first toggle is still queued, then Strict Mode replays the new items' refs and queues a second toggle. React sees no state change and skips the render, so the flush never runs and `isDirtyRef` stays `true`. Every later `register`/`unregister` then bails out early, and `elementsRef` stops syncing, so items that later mount or unmount without the list re-rendering drop out of keyboard navigation.  This PR uses an incrementing counter instead, so queued updates can't cancel each other. This only affects Strict Mode (dev) builds. The regression test replaces the list's items under Strict Mode, then hides one item without re-rendering the list.  
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/fa41dfe6-d983-4fb9-8a93-9cab7485a73e) - [vite-css-base-ui-example](https://pkg.pr.new/template/c1c1caba-0a35-40e6-8502-a5058cc0ce6d)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5862   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5862   ```     _commit: <a href="https://github.com/mui/base-ui/runs/111597140913"><code>9741af8</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react |  0B<sup>(0.00%)</sup> | ▼-2B<sup>(0.00%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=9741af8c2d1b1ea51f5c805cf83815b247681d53&base=f7cb21ce4ea53edc613e6394bdec210201e72b56&prNumber=5862&baseRef=master)  ## Performance  **Total duration:** 674.49 ms +1.96 ms<sup>(+0.3%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 1,204.86 ms +10.61 ms<sup>(+0.9%)</sup>  *No significant changes — [details](https://code-infra-dashboard.onrender.com/benchmark-details/mui/base-ui?sha=9741af8c2d1b1ea51f5c805cf83815b247681d53&prNumber=5862&baseRef=master)*  <hr>  Check out the [code infra dashboard](https://code-infra-dashboard.onrender.com/repository/mui/base-ui/prs/5862) for more information about this PR.
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 9741af8c2d1b1ea51f5c805cf83815b247681d53 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6ac3114f258d1a0008813e20 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5862--base-ui.netlify.app](https://deploy-preview-5862--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4NjItLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.9e8ZGh5H3j0vTNLLvKBUoWrPEuXJIr714sNavT98PTU)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes | [Run an agent on this branch](https://app.netlify

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

### Incident Patch 1: `4ba59eeb` (2026-10-05)
**Commit Message**: [field][select][combobox][slider] Fix label focus in Shadow DOM (#5871)

Co-authored-by: atomiks <[REDACTED_EMAIL]>

**File**: `packages/react/src/internals/labelable-provider/useLabel.test.tsx` (modified, +129/-1)
```diff
@@ -1,12 +1,140 @@
 import * as React from 'react';
+import * as ReactDOM from 'react-dom';
 import { describe, expect, it } from 'vitest';
-import { act, screen } from '@mui/internal-test-utils';
+import { act, screen, within } from '@mui/internal-test-utils';
+import { Select } from '@base-ui/react/select';
+import { Combobox } from '@base-ui/react/combobox';
+import { Field } from '@base-ui/react/field';
 import { createRenderer } from '#test-utils';
 import { useLabel } from './useLabel';
 
 describe('useLabel', () => {
   const { render } = createRenderer();
 
+  describe.each(['Select.Label', 'Combobox.Label', 'Field.Label'])('%s', (labelType) => {
+    function TestControl() {
+      if (labelType === 'Combobox.Label') {
+        return (
+          <Field.Root name="country">
+            <Combobox.Root>
+              <Combobox.Label>Country</Combobox.Label>
+              <Combobox.Trigger id="country">Choose a country</Combobox.Trigger>
+              <Combobox.Portal>
+                <Combobox.Positioner>
+                  <Combobox.Popup>
+                    <Combobox.Input aria-label="Search countries" />
+                    <Combobox.List>
+                      <Combobox.Item value="fr">France</Combobox.Item>
+                    </Combobox.List>
+                  </Combobox.Popup>
+                </Combobox.Positioner>
+              </Combobox.Portal>
+            </Combobox.Root>
+          </Field.Root>
+        );
+      }
+
+      return (
+        <Field.Root name="country">
+          {labelType === 'Field.Label' && (
+            <Field.Label nativeLabel={false} render={<div />}>
+              Country
+            </Field.Label>
+          )}
+          <Select.Root>
+            {labelType === 'Select.Label' && <Select.Label>Country</Select.Label>}
+            <Select.Trigger id="country">Choose a country</Select.Trigger>
+            <Select.Portal>
+              <Select.Positioner>
+                <Select.Popup>
+                  <Select.List>
+                    <Select.Item value="fr">
+                      <Select.ItemText>France</Select.ItemText>
+                    </Select.Item>
+                  </Select.List>
+                </Select.Popup>
+              </Select.Positioner>
+            </Select.Portal>
+          </Select.Root>
+        </Field.Root>
+      );
+    }
+
+    it('focuses the trigger without opening the popup in the document', async () => {
+      const { user } = await render(<TestControl />);
+      const trigger = screen.getByRole('combobox', { name: 'Country' });
+
+      await user.click(screen.getByText('Country'));
+
+      expect(trigger).toHaveFocus();
+      expect(trigger).toHaveAttribute('aria-expanded', 'false');
+    });
+
+    it.each([false, true])(
+      'focuses the trigger in its shadow root without opening the popup (outer matching ID: %s)',
+      async (outerMatchingId) => {
+        const host = document.createElement('div');
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const container = document.createElement('div');
+        shadowRoot.appendChild(container);
+        document.body.appendChild(host);
+
+        try {
+          const { user, unmount } = await render(
+            <React.Fragment>
+              {outerMatchingId && <input id="country" aria-label="Unrelated control" />}
+              {ReactDOM.createPortal(<TestControl />, container)}
+            </React.Fragment>,
+          );
+
+          try {
+            const trigger = within(container).getByRole('combobox', { name: 'Country' });
+
+            await user.click(within(container).getByText('Country'));
+
+            expect(shadowRoot.activeElement).toBe(trigger);
+            expect(document.activeElement).toBe(host);
+            expect(trigger).toHaveAttribute('aria-expanded', 'false');
+          } finally {
+            unmount();
+          }
+        } finally {
+          host.remove();
+        }
+      },
+    );
+  });
+
+  it('preserves native label activation inside a shadow root', async () => {
+    const host = document.createElement('div');
+    const shadowRoot = host.attachShadow({ mode: 'open' });
+    const container = document.createElement('div');
+    shadowRoot.appendChild(container);
+    document.body.appendChild(host);
+
+    try {
+      const { user, unmount } = await render(
+        <Field.Root>
+          <Field.Label>Name</Field.Label>
+          <Field.Control />
+        </Field.Root>,
+        { container },
+      );
+
+      try {
+        const control = within(container).getByRole('textbox', { name: 'Name' });
+
+        await user.click(within(container).getByText('Name'));
+
+        expect(shadowRoot.activeElement).toBe(control);
+      } finally {
+        unmount();
+      }
+    } finally {
+      host.remove();
+    }
+  });
+
   it('does not focus the control when a composed click originates inside a nested button', async () => {
     function Test() {
       const 
```

**File**: `packages/react/src/internals/labelable-provider/useLabel.ts` (modified, +2/-2)
```diff
@@ -1,7 +1,6 @@
 'use client';
 import type * as React from 'react';
 import { isHTMLElement } from '@floating-ui/utils/dom';
-import { ownerDocument } from '@base-ui/utils/owner';
 import { useStableCallback } from '@base-ui/utils/useStableCallback';
 import { closest, getTarget } from '../../floating-ui-react/utils';
 import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
@@ -37,7 +36,8 @@ export function useLabel(params: UseLabelParameters = {}): UseLabelReturnValue {
       return;
     }
 
-    const controlElement = ownerDocument(event.currentTarget).getElementById(resolvedControlId);
+    const root = event.currentTarget.getRootNode() as Document | ShadowRoot;
+    const controlElement = root.getElementById(resolvedControlId);
     if (isHTMLElement(controlElement)) {
       focusElementWithVisible(controlElement);
     }
```

**File**: `packages/react/src/slider/label/SliderLabel.test.tsx` (modified, +46/-1)
```diff
@@ -1,7 +1,9 @@
+import * as React from 'react';
+import * as ReactDOM from 'react-dom';
 import { describe, it, expect } from 'vitest';
 import { Slider } from '@base-ui/react/slider';
 import { Field } from '@base-ui/react/field';
-import { screen } from '@mui/internal-test-utils';
+import { screen, within } from '@mui/internal-test-utils';
 import { createRenderer, describeConformance } from '#test-utils';
 
 describe('<Slider.Label />', () => {
@@ -40,6 +42,49 @@ describe('<Slider.Label />', () => {
     expect(screen.getByRole('slider', { name: 'Unrelated range' })).not.toHaveFocus();
   });
 
+  it('focuses the thumb in its shadow root when the outer document has a matching ID', async () => {
+    const host = document.createElement('div');
+    const shadowRoot = host.attachShadow({ mode: 'open' });
+    const container = document.createElement('div');
+    shadowRoot.appendChild(container);
+    document.body.appendChild(host);
+
+    try {
+      const { user, unmount } = await render(
+        <React.Fragment>
+          <input aria-label="Unrelated control" />
+          {ReactDOM.createPortal(
+            <Field.Root>
+              <Slider.Root defaultValue={50}>
+                <Slider.Label>Volume</Slider.Label>
+                <Slider.Control>
+                  <Slider.Thumb />
+                </Slider.Control>
+              </Slider.Root>
+            </Field.Root>,
+            container,
+          )}
+        </React.Fragment>,
+      );
+
+      try {
+        const thumb = within(container).getByRole('slider', { name: 'Volume' });
+        const unrelatedControl = screen.getByRole('textbox', { name: 'Unrelated control' });
+        expect(thumb.id).not.toBe('');
+        unrelatedControl.id = thumb.id;
+
+        await user.click(within(container).getByText('Volume'));
+
+        expect(shadowRoot.activeElement).toBe(thumb);
+        expect(unrelatedControl).not.toHaveFocus();
+      } finally {
+        unmount();
+      }
+    } finally {
+      host.remove();
+    }
+  });
+
   it('does nothing when a Field slider has no thumb to focus', async () => {
     const { user } = await render(
       <Field.Root>
```

**File**: `packages/react/src/slider/label/SliderLabel.tsx` (modified, +2/-2)
```diff
@@ -1,7 +1,6 @@
 'use client';
 import * as React from 'react';
 import { isHTMLElement } from '@floating-ui/utils/dom';
-import { ownerDocument } from '@base-ui/utils/owner';
 import { focusElementWithVisible, useLabel } from '../../internals/labelable-provider/useLabel';
 import type { BaseUIComponentProps } from '../../internals/types';
 import { useRenderElement } from '../../internals/useRenderElement';
@@ -28,7 +27,8 @@ export const SliderLabel = React.forwardRef(function SliderLabel(
 
   function focusControl(event: React.MouseEvent, controlId: string | undefined) {
     if (controlId) {
-      const controlElement = ownerDocument(event.currentTarget).getElementById(controlId);
+      const root = event.currentTarget.getRootNode() as Document | ShadowRoot;
+      const controlElement = root.getElementById(controlId);
       if (isHTMLElement(controlElement)) {
         focusElementWithVisible(controlElement);
         return;
```

---

### Incident Patch 2: `6b5da6f3` (2026-10-05)
**Commit Message**: [drawer] Fix release velocity on 120 Hz input (#5845)

**File**: `packages/react/src/utils/useSwipeDismiss.test.tsx` (modified, +139/-4)
```diff
@@ -1577,7 +1577,7 @@ describe('useSwipeDismiss', () => {
   });
 
   it.each([
-    { trailingTime: 1040, releaseTime: 1048, expectedVelocity: 1.25 },
+    { trailingTime: 1040, releaseTime: 1048, expectedVelocity: 2.5 },
     { trailingTime: 1040, releaseTime: 1113, expectedVelocity: 0 },
     { trailingTime: 1113, releaseTime: 1121, expectedVelocity: 0 },
   ])(
@@ -1701,7 +1701,7 @@ describe('useSwipeDismiss', () => {
 
         await flushMicrotasks();
 
-        // Keep the last moving sample (20px / 16ms), unless it is older than 80ms.
+        // Keep the last moving sample (20px / 8ms), unless it is older than 80ms.
         const details = onRelease.mock.calls[0]?.[0];
         expect(details?.releaseVelocityY).toBeCloseTo(expectedVelocity, 4);
         expect(details?.releaseVelocityX).toBeCloseTo(0, 2);
@@ -1711,6 +1711,141 @@ describe('useSwipeDismiss', () => {
     },
   );
 
+  it.each([
+    {
+      name: '60 Hz input',
+      moves: [
+        [1016, 14.4],
+        [1032, 28.8],
+        [1048, 43.2],
+        [1064, 57.6],
+      ],
+      release: [1080, 57.6],
+      expected: 0.9,
+    },
+    {
+      name: '120 Hz input',
+      moves: [
+        [1008, 7.2],
+        [1016, 14.4],
+        [1024, 21.6],
+        [1032, 28.8],
+      ],
+      release: [1040, 28.8],
+      expected: 0.9,
+    },
+    {
+      name: 'a slower final step',
+      moves: [
+        [1008, 10],
+        [1016, 20],
+        [1024, 30],
+        [1032, 31],
+      ],
+      release: [1040, 31],
+      expected: 0.125,
+    },
+    {
+      name: 'a flick after a pause',
+      moves: [
+        [1008, 10],
+        [1016, 20],
+        [1216, 30],
+        [1224, 40],
+      ],
+      release: [1232, 40],
+      expected: 1.25,
+    },
+    {
+      // 8px over 2ms is floored to 4ms.
+      name: 'near-simultaneous samples',
+      moves: [
+        [1008, 10],
+        [1010, 18],
+      ],
+      release: [1018, 18],
+      expected: 2,
+    },
+  ])(
+    'measures release velocity from the latest movement ($name)',
+    async ({ moves, release, expected }) => {
+      const onRelease = vi.fn();
+
+      function SwipeBoxLatestMovement() {
+        const ref = React.useRef<HTMLDivElement>(null);
+        const swipe = useSwipeDismiss({
+          enabled: true,
+          directions: ['down'],
+          elementRef: ref,
+          movementCssVars: { x: '--x', y: '--y' },
+          onRelease,
+        });
+
+        return (
+          <div
+            data-testid="release-velocity-latest-movement"
+            ref={ref}
+            style={swipe.getDragStyles()}
+            {...swipe.getPointerProps()}
+          />
+        );
+      }
+
+      vi.useFakeTimers();
+      try {
+        await render(<SwipeBoxLatestMovement />);
+        const element = screen.getByTestId('release-velocity-latest-movement');
+
+        firePointer.down(element, {
+          button: 0,
+          buttons: 1,
+          pointerId: 1,
+          clientX: 0,
+          clientY: 0,
+          bubbles: true,
+          pointerType: 'mouse',
+          movementX: 0,
+          movementY: 0,
+          timeStamp: 1000,
+        });
+
+        await flushMicrotasks();
+
+        let lastY = 0;
+        for (const [timeStamp, clientY] of moves) {
+          firePointer.move(element, {
+            pointerId: 1,
+            buttons: 1,
+            clientX: 0,
+            clientY,
+            bubbles: true,
+            movementX: 0,
+            movementY: clientY - lastY,
+            timeStamp,
+          });
+          lastY = clientY;
+          // eslint-disable-next-line no-await-in-loop
+          await flushMicrotasks();
+        }
+
+        firePointer.up(element, {
+          pointerId: 1,
+          clientX: 0,
+          clientY: release[1],
+          bubbles: true,
+          timeStamp: release[0],
+        });
+
+        await flushMicrotasks();
+
+        const details = onRelease.mock.calls[0]?.[0];
+        expect(details?.releaseVelocityY).toBeCloseTo(expected, 4);
+      } finally {
+        vi.useRealTimers();
+      }
+    },
+  );
+
   it('keeps release velocity when moves arrive sparsely', async () => {
     const onRelease = vi.fn();
 
@@ -1891,9 +2026,9 @@ describe('useSwipeDismiss', () => {
 
       await flushMicrotasks();
 
-      // 10px over the 16ms minimum duration. Measuring from the press would report 0.05.
+      // 10px over 8ms. Measuring from the press would report 0.05.
       const details = onRelease.mock.calls[0]?.[0];
-      expect(details?.releaseVelocityY).toBeCloseTo(0.625, 4);
+      expect(details?.releaseVelocityY).toBeCloseTo(1.25, 4);
     } finally {
       vi.useRealTimers();
     }
```

**File**: `packages/react/src/utils/useSwipeDismiss.ts` (modified, +2/-1)
```diff
@@ -32,7 +32,8 @@ type SwipeProgressDetailsInternal = {
 const DEFAULT_SWIPE_THRESHOLD = 40;
 const REVERSE_CANCEL_THRESHOLD = 10;
 const MIN_VELOCITY_DURATION_MS = 50;
-const MIN_RELEASE_VELOCITY_DURATION_MS = 16;
+// Under one frame at 240 Hz, so it only damps near-simultaneous samples.
+const MIN_RELEASE_VELOCITY_DURATION_MS = 4;
 const MAX_RELEASE_VELOCITY_AGE_MS = 80;
 const MIN_VELOCITY_SAMPLE_DISTANCE = 1;
 const DEFAULT_IGNORE_SELECTOR = 'button,a,input,select,textarea,label,[role="button"]';
```

---

### Incident Patch 3: `eb27741c` (2026-10-05)
**Commit Message**: [composite] Fix list map tick canceling in StrictMode (#5862)

**File**: `packages/react/src/internals/composite/list/CompositeList.test.tsx` (modified, +43/-0)
```diff
@@ -382,6 +382,49 @@ describe('<CompositeList />', () => {
       expect(screen.getByTestId('last')).toHaveAttribute('data-index', '1');
     });
 
+    it('keeps syncing refs after replacing items under Strict Mode', async () => {
+      const elementsRef = {
+        current: [] as Array<HTMLElement | null>,
+      };
+      let hideItem: () => void = () => {};
+
+      function HideableItem(props: { label: string }) {
+        const [hidden, setHidden] = React.useState(false);
+        hideItem = () => setHidden(true);
+        return hidden ? null : <Item label={props.label} />;
+      }
+
+      function App() {
+        const [labels, setLabels] = React.useState(['a', 'b']);
+        return (
+          <React.Fragment>
+            <button type="button" onClick={() => setLabels(['c', 'd'])}>
+              Replace
+            </button>
+            <CompositeList elementsRef={elementsRef}>
+              {labels.map((label) => (
+                <HideableItem key={label} label={label} />
+              ))}
+            </CompositeList>
+          </React.Fragment>
+        );
+      }
+
+      // The list re-renders while new items mount, then Strict Mode replays their refs.
+      const { user } = await render(<App />, { strict: true });
+
+      await user.click(screen.getByRole('button', { name: 'Replace' }));
+
+      expect(elementsRef.current).toEqual([screen.getByTestId('c'), screen.getByTestId('d')]);
+
+      // The item hides itself without re-rendering the list.
+      await act(async () => {
+        hideItem();
+      });
+
+      expect(elementsRef.current).toEqual([screen.getByTestId('c')]);
+    });
+
     it('assigns correct guessed indexes during the first render', async () => {
       const renderCounts: Record<string, number> = { a: 0, b: 0, c: 0 };
       const initialIndexes: Record<string, number> = {};
```

**File**: `packages/react/src/internals/composite/list/CompositeList.tsx` (modified, +2/-2)
```diff
@@ -25,7 +25,7 @@ export function CompositeList<Metadata>(props: CompositeList.Props<Metadata>) {
 
   const onMapChange = useStableCallback(onMapChangeProp);
 
-  const [, setMapTick] = React.useState(false);
+  const [, setMapTick] = React.useState(0);
 
   const listeners = useRefWithInit(createListeners).current;
   const map = useRefWithInit(createMap<Metadata>).current;
@@ -43,7 +43,7 @@ export function CompositeList<Metadata>(props: CompositeList.Props<Metadata>) {
     }
 
     isDirtyRef.current = true;
-    setMapTick((tick) => !tick);
+    setMapTick((tick) => tick + 1);
   });
 
   const register = useStableCallback(
```

---

### Incident Patch 4: `f15c18bb` (2026-10-05)
**Commit Message**: [popups] Fix arrow keys not entering items from popup content (#5861)

**File**: `packages/react/src/floating-ui-react/hooks/useListNavigation.ts` (modified, +5/-0)
```diff
@@ -687,6 +687,11 @@ export function useListNavigation(
           ? minIndex
           : maxIndex;
         onNavigate(event);
+        // The boundary item may already be highlighted, so `activeIndex` won't change and the
+        // effect that moves focus to the highlighted item won't run.
+        if (activeIndex === indexRef.current) {
+          focusItem();
+        }
         return;
       }
 
```

**File**: `packages/react/src/menu/popup/MenuPopup.test.tsx` (modified, +64/-0)
```diff
@@ -132,6 +132,70 @@ describe('<Menu.Popup />', () => {
     await waitFor(() => expect(one).toHaveFocus());
   });
 
+  it('moves focus into the items when the boundary item is already highlighted', async () => {
+    const { user } = await render(
+      <Menu.Root>
+        <Menu.Trigger>Open</Menu.Trigger>
+        <Menu.Portal>
+          <Menu.Positioner>
+            <Menu.Popup>
+              <a href="#profile">Profile</a>
+              <Menu.Item>One</Menu.Item>
+              <Menu.Item>Two</Menu.Item>
+              <Menu.Item>Three</Menu.Item>
+            </Menu.Popup>
+          </Menu.Positioner>
+        </Menu.Portal>
+      </Menu.Root>,
+    );
+
+    await act(async () => screen.getByRole('button', { name: 'Open' }).focus());
+    await user.keyboard('[Enter]');
+
+    const one = await screen.findByRole('menuitem', { name: 'One' });
+    await waitFor(() => expect(one).toHaveAttribute('data-highlighted'));
+    await act(async () => screen.getByRole('link', { name: 'Profile' }).focus());
+    expect(one).toHaveAttribute('data-highlighted');
+
+    await user.keyboard('[ArrowDown]');
+    await waitFor(() => expect(one).toHaveFocus());
+
+    await user.keyboard('[ArrowDown]');
+    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus());
+  });
+
+  it('moves focus into the items when the last item is already highlighted', async () => {
+    const { user } = await render(
+      <Menu.Root>
+        <Menu.Trigger>Open</Menu.Trigger>
+        <Menu.Portal>
+          <Menu.Positioner>
+            <Menu.Popup>
+              <a href="#profile">Profile</a>
+              <Menu.Item>One</Menu.Item>
+              <Menu.Item>Two</Menu.Item>
+              <Menu.Item>Three</Menu.Item>
+            </Menu.Popup>
+          </Menu.Positioner>
+        </Menu.Portal>
+      </Menu.Root>,
+    );
+
+    await act(async () => screen.getByRole('button', { name: 'Open' }).focus());
+    await user.keyboard('[ArrowUp]');
+
+    const three = await screen.findByRole('menuitem', { name: 'Three' });
+    await waitFor(() => expect(three).toHaveAttribute('data-highlighted'));
+    await act(async () => screen.getByRole('link', { name: 'Profile' }).focus());
+    expect(three).toHaveAttribute('data-highlighted');
+
+    await user.keyboard('[ArrowUp]');
+    await waitFor(() => expect(three).toHaveFocus());
+
+    await user.keyboard('[ArrowUp]');
+    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus());
+  });
+
   describe('prop: finalFocus', () => {
     it('should focus the trigger by default when closed', async () => {
       await render(
```

**File**: `packages/react/src/select/popup/SelectPopup.test.tsx` (modified, +36/-0)
```diff
@@ -87,6 +87,42 @@ describe('<Select.Popup />', () => {
     expect(screen.getByTestId('next')).not.toHaveFocus();
   });
 
+  it('moves focus into the items when the boundary item is already highlighted', async () => {
+    const { user } = await render(
+      <Select.Root defaultValue="a">
+        <Select.Trigger data-testid="trigger">
+          <Select.Value />
+        </Select.Trigger>
+        <Select.Portal>
+          <Select.Positioner>
+            <Select.Popup>
+              <button type="button">Select all</button>
+              <Select.List>
+                <Select.Item value="a">a</Select.Item>
+                <Select.Item value="b">b</Select.Item>
+                <Select.Item value="c">c</Select.Item>
+              </Select.List>
+            </Select.Popup>
+          </Select.Positioner>
+        </Select.Portal>
+      </Select.Root>,
+    );
+
+    await act(async () => screen.getByTestId('trigger').focus());
+    await user.keyboard('[Enter]');
+
+    const a = await screen.findByRole('option', { name: 'a' });
+    await waitFor(() => expect(a).toHaveAttribute('data-highlighted'));
+    await act(async () => screen.getByRole('button', { name: 'Select all' }).focus());
+    expect(a).toHaveAttribute('data-highlighted');
+
+    await user.keyboard('[ArrowDown]');
+    await waitFor(() => expect(a).toHaveFocus());
+
+    await user.keyboard('[ArrowDown]');
+    await waitFor(() => expect(screen.getByRole('option', { name: 'b' })).toHaveFocus());
+  });
+
   it('has aria attributes when no Select.List is present', async () => {
     const { user } = await render(
       <Select.Root multiple>
```

---

### Incident Patch 5: `16b533b7` (2026-10-05)
**Commit Message**: [test] Fix flaky browser tests (#5860)

**File**: `packages/react/src/avatar/image/AvatarImage.test.tsx` (modified, +4/-7)
```diff
@@ -946,16 +946,13 @@ describe('<Avatar.Image />', () => {
         );
       }
 
-      const { user } = await render(<Test />);
+      await render(<Test />);
       expect(screen.getByTestId('image')).not.toBe(null);
 
-      await user.click(screen.getByText('Hide image'));
+      // `user.click` can yield a frame, which is long enough for the 1ms animation to finish.
+      fireEvent.click(screen.getByText('Hide image'));
 
-      await waitFor(() => {
-        const image = screen.queryByTestId('image');
-        expect(image).not.toBe(null);
-        expect(image).toHaveAttribute('data-ending-style');
-      });
+      expect(screen.getByTestId('image')).toHaveAttribute('data-ending-style');
 
       await waitFor(() => {
         expect(screen.queryByTestId('image')).toBe(null);
```

**File**: `packages/react/src/checkbox/indicator/CheckboxIndicator.test.tsx` (modified, +5/-8)
```diff
@@ -2,7 +2,7 @@ import { expect, vi, describe, beforeEach, it, afterEach } from 'vitest';
 import * as React from 'react';
 import { Checkbox } from '@base-ui/react/checkbox';
 import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
-import { screen, waitFor } from '@mui/internal-test-utils';
+import { fireEvent, screen, waitFor } from '@mui/internal-test-utils';
 import { CheckboxRootContext } from '../root/CheckboxRootContext';
 
 const testContext = {
@@ -296,16 +296,13 @@ describe('<Checkbox.Indicator />', () => {
         );
       }
 
-      const { user } = await render(<Test />);
+      await render(<Test />);
       expect(screen.getByTestId('indicator')).not.toBe(null);
 
-      await user.click(screen.getByText('Uncheck'));
+      // `user.click` can yield a frame, which is long enough for the 1ms animation to finish.
+      fireEvent.click(screen.getByText('Uncheck'));
 
-      await waitFor(() => {
-        const indicator = screen.queryByTestId('indicator');
-        expect(indicator).not.toBe(null);
-        expect(indicator).toHaveAttribute('data-ending-style');
-      });
+      expect(screen.getByTestId('indicator')).toHaveAttribute('data-ending-style');
 
       await waitFor(() => {
         expect(screen.queryByTestId('indicator')).toBe(null);
```

**File**: `packages/react/src/collapsible/panel/CollapsiblePanel.test.tsx` (modified, +4/-1)
```diff
@@ -420,13 +420,16 @@ describe('<Collapsible.Panel />', () => {
     });
 
     it('keeps exit transitions working after a close is interrupted by reopening', async () => {
+      // Keep the close running long enough for a slow run to interrupt it. Without animations,
+      // `data-ending-style` only lasts a frame and `waitFor` can miss it.
+      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
       const { user } = await render(
         <React.Fragment>
           <style>{`
             .interruptible-panel {
               overflow: hidden;
               height: var(--collapsible-panel-height);
-              transition: height 100ms linear;
+              transition: height 10s linear;
             }
 
             .interruptible-panel[data-starting-style],
```

**File**: `packages/react/src/combobox/root/ComboboxRoot.test.tsx` (modified, +12/-9)
```diff
@@ -741,6 +741,7 @@ describe('<Combobox.Root />', () => {
           globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
         });
 
+        // Long enough that a slow run still reopens before the close finishes.
         const style = `
           @keyframes combobox-close-test {
             to {
@@ -749,7 +750,7 @@ describe('<Combobox.Root />', () => {
           }
 
           .animation-test-popup[data-ending-style] {
-            animation: combobox-close-test 100ms linear;
+            animation: combobox-close-test 10s linear;
           }
         `;
 
@@ -818,7 +819,7 @@ describe('<Combobox.Root />', () => {
           }
 
           .animation-test-popup[data-ending-style] {
-            animation: combobox-close-test 100ms linear;
+            animation: combobox-close-test 10s linear;
           }
         `;
 
@@ -7589,7 +7590,7 @@ describe('<Combobox.Root />', () => {
           }
 
           .animation-test-popup[data-ending-style] {
-            animation: combobox-close-test 200ms linear;
+            animation: combobox-close-test 10s linear;
           }
         `;
 
@@ -7674,7 +7675,7 @@ describe('<Combobox.Root />', () => {
           }
 
           .animation-test-popup[data-ending-style] {
-            animation: combobox-close-test 200ms linear;
+            animation: combobox-close-test 10s linear;
           }
         `;
 
@@ -7822,7 +7823,7 @@ describe('<Combobox.Root />', () => {
           }
 
           .animation-test-popup[data-ending-style] {
-            animation: combobox-close-test 100ms linear;
+            animation: combobox-close-test 10s linear;
           }
         `;
 
@@ -7879,6 +7880,8 @@ describe('<Combobox.Root />', () => {
         expect(screen.getByRole('status')).toHaveTextContent('No matches');
         expect(screen.queryByText('apple')).toBe(null);
 
+        // The close animation is long so a slow run can't finish it before the checks above.
+        popup.getAnimations().forEach((animation) => animation.finish());
         await waitFor(() => {
           expect(screen.queryByTestId('popup')).toBe(null);
         });
@@ -7908,7 +7911,7 @@ describe('<Combobox.Root />', () => {
           }
 
           .animation-test-popup[data-ending-style] {
-            animation: combobox-close-test 100ms linear;
+            animation: combobox-close-test 10s linear;
           }
         `;
 
@@ -7969,7 +7972,7 @@ describe('<Combobox.Root />', () => {
           }
 
           .animation-test-popup[data-ending-style] {
-            animation: combobox-close-test 100ms linear;
+            animation: combobox-close-test 10s linear;
           }
         `;
 
@@ -8051,7 +8054,7 @@ describe('<Combobox.Root />', () => {
           }
 
           .animation-test-popup[data-ending-style] {
-            animation: combobox-close-test 100ms linear;
+            animation: combobox-close-test 10s linear;
           }
         `;
 
@@ -10579,7 +10582,7 @@ describe('<Combobox.Root />', () => {
           }
 
           .animation-test-popup[data-ending-style] {
-            animation: combobox-close-test 100ms linear;
+            animation: combobox-close-test 10s linear;
           }
         `;
 
```

**File**: `packages/react/src/field/error/FieldError.test.tsx` (modified, +4/-7)
```diff
@@ -408,16 +408,13 @@ describe('<Field.Error />', () => {
         );
       }
 
-      const { user } = await render(<Test />);
+      await render(<Test />);
       expect(screen.getByTestId('error')).not.toBe(null);
 
-      await user.click(screen.getByText('Hide'));
+      // `user.click` can yield a frame, which is long enough for the 1ms animation to finish.
+      fireEvent.click(screen.getByText('Hide'));
 
-      await waitFor(() => {
-        const error = screen.queryByTestId('error');
-        expect(error).not.toBe(null);
-        expect(error).toHaveAttribute('data-ending-style');
-      });
+      expect(screen.getByTestId('error')).toHaveAttribute('data-ending-style');
 
       await waitFor(() => {
         expect(screen.queryByTestId('error')).toBe(null);
```

**File**: `packages/react/src/menu/filter-root/MenuFilterRoot.test.tsx` (modified, +9/-0)
```diff
@@ -5109,6 +5109,10 @@ describe('<Menu.FilterProvider><Menu.Root/></Menu.FilterProvider>', () => {
       const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
       await user.hover(submenuTrigger);
       const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
+      // Let the root popup's initial focus land first so it can't steal focus from the click below.
+      await act(async () => {
+        await waitSingleFrame();
+      });
       fireEvent.mouseMove(submenuInput);
       await waitFor(() => {
         expect(submenuInput).toHaveAttribute('data-highlighted');
@@ -5168,6 +5172,11 @@ describe('<Menu.FilterProvider><Menu.Root/></Menu.FilterProvider>', () => {
         const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
         await user.hover(submenuTrigger);
         const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
+        // The root popup's initial focus runs a frame after mounting. Let it land so it can't
+        // steal focus from the tap below.
+        await act(async () => {
+          await waitSingleFrame();
+        });
 
         firePointer.down(submenuInput, { pointerType: 'touch', timeStamp: 10 });
         await act(async () => {
```

**File**: `packages/react/src/menu/list/MenuList.test.tsx` (modified, +1/-0)
```diff
@@ -324,6 +324,7 @@ describe('filterable menu list semantics', () => {
     expect(screen.getByRole('menu')).toHaveAttribute('aria-orientation', 'horizontal');
     expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-orientation');
     await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', 'first-item'));
+    await waitFor(() => expect(input).toHaveFocus());
     await user.keyboard('[ArrowRight]');
     expect(input).toHaveAttribute('aria-activedescendant', 'second-item');
   });
```

**File**: `packages/react/src/menu/root/MenuRoot.detached-triggers.test.tsx` (modified, +9/-2)
```diff
@@ -674,6 +674,10 @@ describe('<MenuRoot />', () => {
         const trigger = screen.getByRole('button', { name: 'Trigger 1' });
         await user.click(trigger);
         await screen.findByTestId('level-1');
+        // The menu focuses itself a frame after opening; keys sent earlier go to the trigger.
+        await waitFor(() => {
+          expect(screen.getByRole('menu')).toHaveFocus();
+        });
 
         await user.keyboard('[ArrowDown]');
         await user.keyboard('[ArrowDown]');
@@ -685,6 +689,9 @@ describe('<MenuRoot />', () => {
 
         await user.keyboard('[ArrowRight]');
         await screen.findByTestId('level-2');
+        await waitFor(() => {
+          expect(screen.getByRole('menuitem', { name: 'Item 2' })).toHaveFocus();
+        });
 
         await user.keyboard('[ArrowDown]');
         const submenuTrigger2 = await screen.findByTestId('submenu-trigger-2');
@@ -698,9 +705,9 @@ describe('<MenuRoot />', () => {
         await user.click(screen.getByTestId('outside'));
         await waitFor(() => {
           expect(screen.queryByTestId('level-1')).toBe(null);
-          expect(screen.queryByTestId('level-2')).toBe(null);
-          expect(screen.queryByTestId('level-3')).toBe(null);
         });
+        expect(screen.queryByTestId('level-2')).toBe(null);
+        expect(screen.queryByTestId('level-3')).toBe(null);
       });
 
       it('allows selecting nested items via click, drag, release', async () => {
```

---

### Incident Patch 6: `19511bb1` (2026-10-02)
**Commit Message**: Bump MUI infra packages (#5828)

**File**: `.circleci/config.yml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 version: 2.1
 
 orbs:
-  code-infra: https://raw.githubusercontent.com/mui/mui-public/294ab9be74ab24116c64cd734568b8d0a9b30f18/.circleci/orbs/code-infra.yml
+  code-infra: https://raw.githubusercontent.com/mui/mui-public/4479f61e20e6fb3b1a6b8144827a66c46f01d3b8/.circleci/orbs/code-infra.yml
 
 parameters:
   browserstack-force:
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -73,8 +73,8 @@
     "@guidepup/playwright": "0.19.1",
     "@guidepup/setup": "0.29.1",
     "@microsoft/api-extractor": "7.59.3",
-    "@mui/internal-code-infra": "0.1.1-canary.1",
-    "@mui/internal-netlify-cache": "0.1.1-canary.0",
+    "@mui/internal-code-infra": "0.1.1-canary.4",
+    "@mui/internal-netlify-cache": "0.1.1-canary.1",
     "@mui/internal-test-utils": "2.1.1-canary.0",
     "@netlify/types": "3.0.0",
     "@next/eslint-plugin-next": "16.3.6",
```

**File**: `pnpm-lock.yaml` (modified, +20/-20)
```diff
@@ -206,11 +206,11 @@ importers:
         specifier: 7.59.3
         version: 7.59.3(@types/node@22.20.4)
       '@mui/internal-code-infra':
-        specifier: 0.1.1-canary.1
-        version: 0.1.1-canary.1(@next/eslint-plugin-next@16.3.6(eslint@10.11.0(jiti@2.7.0)(supports-color@7.2.0)))(@types/node@22.20.4)(@typescript-eslint/eslint-plugin@8.70.0(@typescript-eslint/parser@8.71.0(@typescript/typescript6@6.0.2)(eslint@10.11.0(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0))(@typescript/typescript6@6.0.2)(eslint@10.11.0(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0))(@typescript-eslint/parser@8.71.0(@typescript/typescript6@6.0.2)(eslint@10.11.0(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0))(@typescript/typescript6@6.0.2)(@vitest/expect@4.1.11)(bluebird@3.7.2)(eslint-import-resolver-node@0.3.10(supports-color@7.2.0))(eslint@10.11.0(jiti@2.7.0)(supports-color@7.2.0))(postcss@8.5.28)(prettier@3.9.9)(stylelint@17.15.0(@typescript/typescript6@6.0.2)(supports-color@7.2.0))(supports-color@7.2.0)(vitest@5.0.2)
+        specifier: 0.1.1-canary.4
+        version: 0.1.1-canary.4(@next/eslint-plugin-next@16.3.6(eslint@10.11.0(jiti@2.7.0)(supports-color@7.2.0)))(@types/node@22.20.4)(@typescript-eslint/eslint-plugin@8.70.0(@typescript-eslint/parser@8.71.0(@typescript/typescript6@6.0.2)(eslint@10.11.0(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0))(@typescript/typescript6@6.0.2)(eslint@10.11.0(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0))(@typescript-eslint/parser@8.71.0(@typescript/typescript6@6.0.2)(eslint@10.11.0(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0))(@typescript/typescript6@6.0.2)(@vitest/expect@4.1.11)(bluebird@3.7.2)(eslint-import-resolver-node@0.3.10(supports-color@7.2.0))(eslint@10.11.0(jiti@2.7.0)(supports-color@7.2.0))(postcss@8.5.28)(prettier@3.9.9)(stylelint@17.15.0(@typescript/typescript6@6.0.2)(supports-color@7.2.0))(supports-color@7.2.0)(vitest@5.0.2)
       '@mui/internal-netlify-cache':
-        specifier: 0.1.1-canary.0
-        version: 0.1.1-canary.0
+        specifier: 0.1.1-canary.1
+        version: 0.1.1-canary.1
       '@mui/internal-test-utils':
         specifier: 2.1.1-canary.0
         version: 2.1.1-canary.0(@playwright/test@1.63.0)(@types/react-dom@19.3.0(@types/react@19.3.0))(@types/react@19.3.0)(@vitest/utils@5.0.2)(chai@6.2.2)(react-dom@19.3.0(react@19.3.0))(react@19.3.0)(vite@8.3.1(@types/node@22.20.4)(esbuild@0.28.2)(jiti@2.7.0)(terser@5.51.2)(tsx@4.23.15)(yaml@2.9.1))(vitest@5.0.2)
@@ -763,8 +763,8 @@ importers:
         version: 19.3.0(react@19.3.0)
     devDependencies:
       '@mui/internal-benchmark':
-        specifier: 0.0.3-canary.23
-        version: 0.0.3-canary.23(@vitest/browser-playwright@5.0.2)(babel-plugin-react-compiler@1.0.0)(react-dom@19.3.0(react@19.3.0))(react@19.3.0)(vite@8.3.1(@types/node@22.20.4)(esbuild@0.28.2)(jiti@2.7.0)(terser@5.51.2)(tsx@4.23.15)(yaml@2.9.1))(vitest@5.0.2)
+        specifier: 0.1.1-canary.0
+        version: 0.1.1-canary.0(@vitest/browser-playwright@5.0.2)(babel-plugin-react-compiler@1.0.0)(react-dom@19.3.0(react@19.3.0))(react@19.3.0)(vite@8.3.1(@types/node@22.20.4)(esbuild@0.28.2)(jiti@2.7.0)(terser@5.51.2)(tsx@4.23.15)(yaml@2.9.1))(vitest@5.0.2)
       '@types/react':
         specifier: 19.3.0
         version: 19.3.0
@@ -2545,14 +2545,14 @@ packages:
     peerDependencies:
       '@babel/core': ^8.0.0
 
-  '@mui/internal-babel-plugin-resolve-imports@3.0.1-canary.0':
-    resolution: {integrity: sha512-cRzHcsdzrgRI0UmNHSkq4A+Z6LqnyXmWWu50kVd+WTQPFH/QivigkaEfvtojeeDhnNPOTNjxdnyqQuIElMPIwA==}
+  '@mui/internal-babel-plugin-resolve-imports@3.0.1-canary.1':
+    resolution: {integrity: sha512-fORciac3Y6MnLhGWU+8CcRUxMCy9jhQpLnvL7V98o/VazegIzwXZkkrYb24e+Ncxmm05+ZzyNWho4gpfG1AClQ==}
     engines: {node: '>=22.12.0'}
     peerDependencies:
       '@babel/core': ^8.0.0
 
-  '@mui/internal-benchmark@0.0.3-canary.23':
-    resolution: {integrity: sha512-YmYGDZB6+lvRw/KO2vZyo1AHrlzX+EERW2LeMWLOtinxoPivBESDj6//s8epPdUHnX5TzCnqYzBUoU8LmKQKAA==}
+  '@mui/internal-benchmark@0.1.1-canary.0':
+    resolution: {integrity: sha512-E+NnT3TGnPfwsY1SbM1pX1P3y9C4E7rIlxnlbqIF6FivUMnJR4Mb6g+sOT6KFMe1PjqxwCvdYFmuGX1uI6EZoQ==}
     peerDependencies:
       '@vitest/browser-playwright': '>=4.1'
       react: ^18.0.0 || ^19.0.0
@@ -2563,8 +2563,8 @@ packages:
     resolution: {integrity: sha512-jPAMqC6aBEnrFalmrZeGnGzk+QG9/PRr/8V8xXgEo07fyCMc4c+zrgj8SNyNww2oujo6d46ek0ZdaHldwrBV7Q==}
     hasBin: true
 
-  '@mui/internal-code-infra@0.1.1-canary.1':
-    resolution: {integrity: sha512-KFfNmlRLZfk3+QR+Vptu7seaAvLwzicQzAmcejolOtaR4vOUxHJ5Wq2BrslS7sGE2gGittNTcQwT00yKDS/UKA==}
+  '@mui/internal-code-infra@0.1.1-canary.4':
+    resolution: {integrity: sha512-roNJV7Zq8frEOw/DEp/Y3oF4o5DTaYJZUnV/Gawe1NMI1zpuVhOkk6298cKIdAk6jKKHr+TBCMS5Sv3n1HttWQ==}
     hasBin: true
     peerDependencies:
       '@next/eslint-plugin-next': '*'
@@ -2593,8 +2593,8 @@ packages:
       prettier:
         optional: true
 
-  '
```

**File**: `test/performance/package.json` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
     "react-dom": "19.3.0"
   },
   "devDependencies": {
-    "@mui/internal-benchmark": "0.0.3-canary.23",
+    "@mui/internal-benchmark": "0.1.1-canary.0",
     "@types/react": "19.3.0",
     "@vitest/browser-playwright": "5.0.2",
     "vite": "8.3.1",
```

---

### Incident Patch 7: `e8601605` (2026-10-02)
**Commit Message**: [code-infra] Cap brace-expansion override majors (#5690)

Co-authored-by: Brijesh Bittu <[REDACTED_EMAIL]>

**File**: `renovate.json` (modified, +6/-0)
```diff
@@ -17,6 +17,12 @@
       "description": "v28 is causing further performance issues and timeouts in our tests, so we will stay on v27 until the issues are resolved. https://github.com/mui/base-ui/pull/4372",
       "matchPackageNames": ["jsdom"],
       "allowedVersions": "<28"
+    },
+    {
+      "description": "The @N selector pins the major. brace-expansion 5 exports only `{ expand }`: minimatch@3 throws on brace patterns, minimatch@9 fails to import it.",
+      "matchDepNames": ["brace-expansion@1", "brace-expansion@2"],
+      "matchUpdateTypes": ["major"],
+      "enabled": false
     }
   ]
 }
```

---

### Incident Patch 8: `4c23c17a` (2026-10-02)
**Commit Message**: [drawer] Add x/y options to data-base-ui-swipe-ignore (#5808)

Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>
Co-authored-by: atomiks <[REDACTED_EMAIL]>

**File**: `docs/src/app/(docs)/react/components/drawer/page.mdx` (modified, +3/-1)
```diff
@@ -44,7 +44,9 @@ import { Drawer } from '@base-ui/react/drawer';
 </Drawer.Provider>;
 ```
 
-Drawer supports swipe gestures to dismiss. Set `swipeDirection` to control which direction dismisses the drawer. `<Drawer.Content>` allows text selection of its children without swipe interference when using a mouse pointer. Add `data-base-ui-swipe-ignore` to a descendant when you need to opt that element out of swipe dismissal for all input types.
+Drawer supports swipe gestures to dismiss. Set `swipeDirection` to control which direction dismisses the drawer. `<Drawer.Content>` allows text selection of its children without swipe interference when using a mouse pointer.
+
+Add `data-base-ui-swipe-ignore` to a descendant to opt it out of swipe dismissal for all input types. If the element only handles touch drags along one axis, such as a JavaScript carousel, set the value to `x` or `y` so touch drags along the other axis still swipe the drawer.
 
 Use `<Drawer.VirtualKeyboardProvider>` when a bottom sheet contains form fields and you want Base UI to manage keyboard-aware focus and scroll handling for software keyboards. Drawers without this provider are unaffected.
 
```

**File**: `docs/src/app/(private)/experiments/drawer/touch-ignore.module.css` (modified, +73/-0)
```diff
@@ -176,6 +176,11 @@
   justify-content: center;
 }
 
+.ViewportEnd {
+  align-items: stretch;
+  justify-content: flex-end;
+}
+
 .Popup {
   box-sizing: border-box;
   display: flex;
@@ -207,6 +212,23 @@
   }
 }
 
+.PopupHorizontal {
+  width: min(24rem, 100%);
+  max-width: none;
+  height: 100%;
+  max-height: none;
+  padding-right: 1.5rem;
+  padding-left: 1.5rem;
+  padding-top: calc(1.5rem + env(safe-area-inset-top, 0px));
+  padding-bottom: 1.5rem;
+  border-radius: 1.5rem 0 0 1.5rem;
+
+  &[data-starting-style],
+  &[data-ending-style] {
+    transform: translateX(100%);
+  }
+}
+
 .Handle {
   width: 3rem;
   height: 0.375rem;
@@ -262,6 +284,16 @@
   background: rgb(240 249 255);
 }
 
+.TileViolet {
+  border: 1px solid rgb(196 181 253);
+  background: rgb(245 243 255);
+}
+
+.TileRose {
+  border: 1px solid rgb(253 164 175);
+  background: rgb(255 241 242);
+}
+
 .TileTitle {
   font-size: 0.875rem;
   font-weight: 600;
@@ -279,6 +311,14 @@
   color: rgb(12 74 110);
 }
 
+.TileTitleViolet {
+  color: rgb(76 29 149);
+}
+
+.TileTitleRose {
+  color: rgb(136 19 55);
+}
+
 .TileDescription {
   margin-top: 0.25rem;
   font-size: 0.875rem;
@@ -296,6 +336,39 @@
   color: rgb(7 89 133);
 }
 
+.TileDescriptionViolet {
+  color: rgb(91 33 182);
+}
+
+.TileDescriptionRose {
+  color: rgb(159 18 57);
+}
+
+.DirectionToggle {
+  display: flex;
+  gap: 0.5rem;
+}
+
+.DirectionButton {
+  display: inline-flex;
+  align-items: center;
+  justify-content: center;
+  height: 2.25rem;
+  padding: 0 0.875rem;
+  border: 1px solid var(--color-gray-200);
+  border-radius: 0.5rem;
+  background: white;
+  color: var(--color-gray-700);
+  font-size: 0.8125rem;
+  font-weight: 500;
+
+  &[data-active] {
+    border-color: rgb(15 23 42);
+    background: rgb(15 23 42);
+    color: white;
+  }
+}
+
 .Actions {
   display: flex;
   gap: 0.75rem;
```

**File**: `docs/src/app/(private)/experiments/drawer/touch-ignore.tsx` (modified, +93/-6)
```diff
@@ -4,31 +4,65 @@ import clsx from 'clsx';
 import { Drawer } from '@base-ui/react/drawer';
 import styles from './touch-ignore.module.css';
 
-type EventName = 'plain div click' | 'ignored div click' | 'native button click' | 'drawer closed';
+type EventName =
+  | 'plain div click'
+  | 'ignored div click'
+  | 'x-ignored div click'
+  | 'y-ignored div click'
+  | 'native button click'
+  | 'drawer closed';
 
 export default function DrawerTouchIgnoreExperiment() {
+  const [swipeDirection, setSwipeDirection] = React.useState<'down' | 'right'>('down');
   const [plainDivClicks, setPlainDivClicks] = React.useState(0);
   const [ignoredDivClicks, setIgnoredDivClicks] = React.useState(0);
+  const [xIgnoredDivClicks, setXIgnoredDivClicks] = React.useState(0);
+  const [yIgnoredDivClicks, setYIgnoredDivClicks] = React.useState(0);
   const [buttonClicks, setButtonClicks] = React.useState(0);
   const [events, setEvents] = React.useState<EventName[]>([]);
 
   function recordEvent(eventName: EventName) {
     setEvents((previousEvents) => [eventName, ...previousEvents].slice(0, 8));
   }
 
+  const matchingAxisTile = swipeDirection === 'down' ? 'y' : 'x';
+  const crossAxisTile = swipeDirection === 'down' ? 'x' : 'y';
+
   return (
     <div className={styles.Root}>
       <div className={styles.Header}>
         <h1 className={styles.Title}>Drawer touch ignore experiment</h1>
         <p className={styles.Lead}>
           Use this to compare touch behavior inside <code>Drawer.Content</code>. The plain div
-          should still participate in swipe-to-dismiss, while the explicit{' '}
-          <code>data-base-ui-swipe-ignore</code> div should preserve taps.
+          should still participate in swipe-to-dismiss, the bare{' '}
+          <code>data-base-ui-swipe-ignore</code> div should preserve taps in every direction, and
+          the <code>x</code>/<code>y</code> variants should only block swipes along the matching
+          axis.
         </p>
       </div>
 
       <div className={styles.PanelGrid}>
         <div className={styles.InstructionsPanel}>
+          <h2 className={styles.PanelTitle}>Swipe direction</h2>
+          <div className={styles.DirectionToggle}>
+            <button
+              type="button"
+              className={styles.DirectionButton}
+              data-active={swipeDirection === 'down' ? '' : undefined}
+              onClick={() => setSwipeDirection('down')}
+            >
+              down (vertical)
+            </button>
+            <button
+              type="button"
+              className={styles.DirectionButton}
+              data-active={swipeDirection === 'right' ? '' : undefined}
+              onClick={() => setSwipeDirection('right')}
+            >
+              right (horizontal)
+            </button>
+          </div>
+
           <h2 className={styles.PanelTitle}>What to test</h2>
           <ol className={styles.InstructionsList}>
             <li>Tap the plain div on a touch device. It should still be part of swipe handling.</li>
@@ -38,6 +72,16 @@ export default function DrawerTouchIgnoreExperiment() {
             </li>
             <li>Tap the native button. It should continue to work as before.</li>
             <li>Drag from the plain div area to confirm swipe-to-dismiss still starts there.</li>
+            <li>
+              With direction <strong>{swipeDirection}</strong>, drag from the{' '}
+              <code>data-base-ui-swipe-ignore=&quot;{matchingAxisTile}&quot;</code> tile: the drawer
+              should <strong>not</strong> move, since {matchingAxisTile} matches the swipe axis.
+            </li>
+            <li>
+              Drag from the <code>data-base-ui-swipe-ignore=&quot;{crossAxisTile}&quot;</code> tile:
+              the drawer <strong>should</strong> still dismiss, since {crossAxisTile} is the cross
+              axis.
+            </li>
           </ol>
         </div>
 
@@ -46,6 +90,8 @@ export default function DrawerTouchIgnoreExperiment() {
           <div className={styles.CounterList}>
             <CounterRow label="Plain div clicks" value={plainDivClicks} />
             <CounterRow label="Ignored div clicks" value={ignoredDivClicks} />
+            <CounterRow label='Ignore="x" div clicks' value={xIgnoredDivClicks} />
+            <CounterRow label='Ignore="y" div clicks' value={yIgnoredDivClicks} />
             <CounterRow label="Native button clicks" value={buttonClicks} />
           </div>
           <div className={styles.EventLogSection}>
@@ -61,6 +107,7 @@ export default function DrawerTouchIgnoreExperiment() {
       </div>
 
       <Drawer.Root
+        swipeDirection={swipeDirection}
         onOpenChange={(open) => {
           if (!open) {
             recordEvent('drawer closed');
@@ -70,9 +117,13 @@ export default function DrawerTouchIgnoreExperiment() {
         <Drawer.Trigger className={styles.TriggerButton}>Open touch test drawer</Drawer.Trigger>
         <Drawer.Portal>
         
```

**File**: `packages/react/src/drawer/viewport/DrawerViewport.test.tsx` (modified, +204/-0)
```diff
@@ -589,6 +589,210 @@ describe('<Drawer.Viewport />', () => {
     expect(handleOpenChange).not.toHaveBeenCalled();
   });
 
+  describe('data-base-ui-swipe-ignore axis values', () => {
+    type Point = { clientX: number; clientY: number };
+
+    async function renderAxisDrawer(
+      swipeDirection: 'down' | 'right',
+      children: React.ReactNode,
+      handleOpenChange: Drawer.Root.Props['onOpenChange'],
+    ) {
+      await render(
+        <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection={swipeDirection}>
+          <Drawer.Portal>
+            <Drawer.Backdrop data-testid="backdrop" />
+            <Drawer.Viewport>
+              <Drawer.Popup data-testid="popup">{children}</Drawer.Popup>
+            </Drawer.Viewport>
+          </Drawer.Portal>
+        </Drawer.Root>,
+      );
+    }
+
+    function swipe(target: HTMLElement, points: Point[]) {
+      const originalElementFromPoint = document.elementFromPoint;
+      document.elementFromPoint = () => target;
+
+      try {
+        fireEvent.touchStart(target, {
+          touches: [createTouch(target, { clientX: 100, clientY: 100 })],
+        });
+        return points.map((point) =>
+          fireEvent.touchMove(target, { touches: [createTouch(target, point)] }),
+        );
+      } finally {
+        document.elementFromPoint = originalElementFromPoint;
+      }
+    }
+
+    function endSwipe(target: HTMLElement, point: Point) {
+      fireEvent.touchEnd(target, { changedTouches: [createTouch(target, point)] });
+    }
+
+    it.each([
+      ['down', 'y', { clientX: 100, clientY: 140 }],
+      ['right', 'x', { clientX: 140, clientY: 100 }],
+    ] as const)(
+      'ignores %s touch swipes from elements with the drawer axis value "%s"',
+      async (swipeDirection, axis, end) => {
+        const handleOpenChange = vi.fn();
+        await renderAxisDrawer(
+          swipeDirection,
+          <div data-testid="target" data-base-ui-swipe-ignore={axis}>
+            Carousel
+          </div>,
+          handleOpenChange,
+        );
+
+        const target = screen.getByTestId('target');
+        expect(swipe(target, [end])).toEqual([true]);
+        expect(screen.getByTestId('backdrop')).not.toHaveAttribute('data-swiping');
+
+        endSwipe(target, end);
+        await flushMicrotasks();
+
+        expect(handleOpenChange).not.toHaveBeenCalled();
+      },
+    );
+
+    it.each([
+      ['down', 'x', { clientX: 103, clientY: 101 }, { clientX: 140, clientY: 104 }],
+      ['right', 'y', { clientX: 101, clientY: 103 }, { clientX: 104, clientY: 140 }],
+    ] as const)(
+      'hands cross-axis drags in %s drawers to elements with the value "%s"',
+      async (swipeDirection, axis, ambiguous, crossAxis) => {
+        const handleOpenChange = vi.fn();
+        await renderAxisDrawer(
+          swipeDirection,
+          <div data-testid="target" data-base-ui-swipe-ignore={axis}>
+            Carousel
+          </div>,
+          handleOpenChange,
+        );
+
+        const target = screen.getByTestId('target');
+        const popup = screen.getByTestId('popup');
+        const handleTargetTouchMove = vi.fn();
+        target.addEventListener('touchmove', handleTargetTouchMove);
+        expect(swipe(target, [ambiguous, crossAxis])).toEqual([true, true]);
+        expect(handleTargetTouchMove).toHaveBeenCalledTimes(2);
+        expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('0px');
+        expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
+
+        endSwipe(target, crossAxis);
+        await flushMicrotasks();
+
+        expect(handleOpenChange).not.toHaveBeenCalled();
+      },
+    );
+
+    it.each(['marked', 'scrollable'] as const)(
+      'does not swipe or settle snap points while a %s cross-axis target handles the drag',
+      async (kind) => {
+        const handleSnapPointChange = vi.fn();
+        await render(
+          <Drawer.Root open snapPoints={[200, 360]} onSnapPointChange={handleSnapPointChange}>
+            <Drawer.Portal>
+              <Drawer.Backdrop data-testid="backdrop" />
+              <Drawer.Viewport>
+                <Drawer.Popup data-testid="popup">
+                  <div
+                    data-testid="target"
+                    data-base-ui-swipe-ignore={kind === 'marked' ? 'x' : undefined}
+                    style={kind === 'scrollable' ? { overflowX: 'auto' } : undefined}
+                  >
+                    Carousel
+                  </div>
+                </Drawer.Popup>
+              </Drawer.Viewport>
+            </Drawer.Portal>
+          </Drawer.Root>,
+        );
+
+        const target = screen.getByTestId('target');
+        if (kind === 'scrollable') {
+          Object.defineProperty(target, 'scrollWidth', { value: 400, configurable: true });
+          Object.defineProperty(target, 'clientWidth', { value: 100, configurable: true });
+        }
+
+        const crossAxis = { clientX: 140
```

**File**: `packages/react/src/drawer/viewport/DrawerViewport.tsx` (modified, +40/-8)
```diff
@@ -33,7 +33,10 @@ import { DrawerViewportContext } from './DrawerViewportContext';
 import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';
 import { findScrollableTouchTarget } from '../../utils/scrollable';
 import type { ScrollAxis } from '../../utils/scrollable';
-import { BASE_UI_SWIPE_IGNORE_SELECTOR } from '../../internals/constants';
+import {
+  BASE_UI_SWIPE_IGNORE_ATTRIBUTE,
+  BASE_UI_SWIPE_IGNORE_SELECTOR,
+} from '../../internals/constants';
 import { getElementAtPoint } from '../../utils/getElementAtPoint';
 import type { BaseUIComponentProps } from '../../internals/types';
 import type { TransitionStatus } from '../../internals/useTransitionStatus';
@@ -53,14 +56,18 @@ const MAX_SWIPE_RELEASE_SCALAR = 1;
 const AXIS_LOCK_SLOP = 6;
 const AXIS_LOCK_BIAS = 2;
 const DRAWER_CONTENT_SELECTOR = `[${DRAWER_CONTENT_ATTRIBUTE}]`;
+const AXIS_SWIPE_IGNORE_SELECTORS: Record<ScrollAxis, string> = {
+  horizontal: `[${BASE_UI_SWIPE_IGNORE_ATTRIBUTE}="x"]`,
+  vertical: `[${BASE_UI_SWIPE_IGNORE_ATTRIBUTE}="y"]`,
+};
 
 interface TouchScrollState {
   startX: number;
   startY: number;
   lastX: number;
   lastY: number;
   scrollTarget: HTMLElement | null;
-  hasCrossAxisScrollableContent: boolean;
+  hasCrossAxisGestureTarget: boolean;
   allowSwipe: boolean | null;
   preserveNativeCrossAxisScroll: boolean;
   drawerAxisAttributed: boolean;
@@ -364,6 +371,19 @@ export const DrawerViewport = React.forwardRef(function DrawerViewport(
         return false;
       }
 
+      // Over a cross-axis gesture target, stay pending until the drawer axis wins the gesture.
+      // Starting on touchstart would leave the drawer swiping (and settling on release) while the
+      // cross-axis target handles the drag.
+      const touchState = touchScrollStateRef.current;
+      if (
+        touchLike &&
+        touchState?.hasCrossAxisGestureTarget &&
+        !touchState.drawerAxisAttributed &&
+        touchState.allowSwipe !== true
+      ) {
+        return false;
+      }
+
       return true;
     },
     onProgress(progress, details) {
@@ -907,6 +927,8 @@ export const DrawerViewport = React.forwardRef(function DrawerViewport(
             event.clientX,
             event.clientY,
           );
+          // Pointer drags capture the pointer on press, so they can't wait to see which axis the
+          // gesture takes; any `data-base-ui-swipe-ignore` value ignores them.
           if (isSwipeIgnoredTarget(elementAtPoint) || isDrawerContentTarget(elementAtPoint)) {
             return;
           }
@@ -973,15 +995,24 @@ export const DrawerViewport = React.forwardRef(function DrawerViewport(
 
           virtualKeyboard?.onTouchStart(event);
 
-          if (isSwipeIgnoredTarget(elementAtPoint)) {
+          // `x`/`y` hand touch drags along that axis to the element. Any value other than the
+          // cross-axis one ignores the swipe outright; a cross-axis element is arbitrated like a
+          // native cross-axis scroller below.
+          if (
+            closest(
+              elementAtPoint,
+              `${BASE_UI_SWIPE_IGNORE_SELECTOR}:not(${AXIS_SWIPE_IGNORE_SELECTORS[crossScrollAxis]})`,
+            )
+          ) {
             resetTouchSwipeState(true);
             return;
           }
           ignoreTouchSwipeRef.current = false;
 
           const scrollTarget = findScrollableTouchTarget(target, rootElement, scrollAxis);
-          const hasCrossAxisScrollableContent =
-            findScrollableTouchTarget(target, rootElement, crossScrollAxis) != null;
+          const hasCrossAxisGestureTarget =
+            findScrollableTouchTarget(target, rootElement, crossScrollAxis) != null ||
+            closest(elementAtPoint, AXIS_SWIPE_IGNORE_SELECTORS[crossScrollAxis]) != null;
 
           let allowSwipe: boolean | null = null;
           if (scrollTarget) {
@@ -996,7 +1027,7 @@ export const DrawerViewport = React.forwardRef(function DrawerViewport(
             lastX: touch.clientX,
             lastY: touch.clientY,
             scrollTarget,
-            hasCrossAxisScrollableContent,
+            hasCrossAxisGestureTarget,
             allowSwipe,
             preserveNativeCrossAxisScroll: false,
             drawerAxisAttributed: false,
@@ -1129,7 +1160,8 @@ function updateTouchScrollPosition(touchState: TouchScrollState, touch: Touch):
 }
 
 /**
- * Arbitrates a touchmove between the drawer swipe and a native cross-axis scroll.
+ * Arbitrates a touchmove between the drawer swipe and a cross-axis gesture: a native scroll, or an
+ * element marked with the cross-axis `data-base-ui-swipe-ignore` value.
  * Returns `true` when the move must be left alone — either because the cross axis already won the
  * gesture, or because neither axis has passed the slop yet and the gesture cannot be attributed.
  */
@@ -1149,7 +1181,7 @@ function shouldYieldTouchMove(
   if (
     touchState.drawerAxisAttributed ||
     touchState.allowSwipe === true ||
-    !t
```

---

### Incident Patch 9: `94e0d885` (2026-10-02)
**Commit Message**: Bump next to 16.3.6 [SECURITY] (#5839)

Co-authored-by: code-infra-renovate[bot] <290386390+code-infra-renovate[bot]@users.noreply.github.com>

**File**: `docs/package.json` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
     "lucide-react": "^1.48.0",
     "lz-string": "^1.5.0",
     "match-sorter": "^8.3.0",
-    "next": "16.3.5",
+    "next": "16.3.6",
     "postcss": "^8.5.28",
     "postcss-custom-media": "^12.0.2",
     "postcss-import": "^17.0.0",
```

**File**: `pnpm-lock.yaml` (modified, +44/-44)
```diff
@@ -342,7 +342,7 @@ importers:
         version: 3.1.1(@types/react@19.3.0)(react@19.3.0)
       '@mui/internal-docs-infra':
         specifier: 0.13.1-canary.5
-        version: 0.13.1-canary.5(@types/react@19.3.0)(next@16.3.5(@babel/core@8.0.5)(@playwright/test@1.63.0)(@types/node@22.20.4)(babel-plugin-react-compiler@1.0.0)(react-dom@19.3.0(react@19.3.0))(react@19.3.0))(prettier@3.9.8)(react-dom@19.3.0(react@19.3.0))(react@19.3.0)(supports-color@10.2.2)
+        version: 0.13.1-canary.5(@types/react@19.3.0)(next@16.3.6(@babel/core@8.0.5)(@playwright/test@1.63.0)(@types/node@22.20.4)(babel-plugin-react-compiler@1.0.0)(react-dom@19.3.0(react@19.3.0))(react@19.3.0))(prettier@3.9.8)(react-dom@19.3.0(react@19.3.0))(react@19.3.0)(supports-color@10.2.2)
       '@next/mdx':
         specifier: ^16.3.5
         version: 16.3.5(@mdx-js/loader@3.1.1(supports-color@10.2.2)(webpack@5.110.3(esbuild@0.28.2)(lightningcss@1.33.0)(postcss@8.5.28)(sharp@0.35.4(@types/node@22.20.4))(uglify-js@3.19.3)))(@mdx-js/react@3.1.1(@types/react@19.3.0)(react@19.3.0))
@@ -395,8 +395,8 @@ importers:
         specifier: ^8.3.0
         version: 8.3.0
       next:
-        specifier: 16.3.5
-        version: 16.3.5(@babel/core@8.0.5)(@playwright/test@1.63.0)(@types/node@22.20.4)(babel-plugin-react-compiler@1.0.0)(react-dom@19.3.0(react@19.3.0))(react@19.3.0)
+        specifier: 16.3.6
+        version: 16.3.6(@babel/core@8.0.5)(@playwright/test@1.63.0)(@types/node@22.20.4)(babel-plugin-react-compiler@1.0.0)(react-dom@19.3.0(react@19.3.0))(react@19.3.0)
       postcss:
         specifier: ^8.5.28
         version: 8.5.28
@@ -2822,8 +2822,8 @@ packages:
     resolution: {integrity: sha512-zRCidsQgI4CZWrZB/kmwdPf0QbSNljakfNSLizFvrsSA3UcUrTWSBNMVKmZnob92/8ESeUN0ewXLOlffJU+ATQ==}
     engines: {node: '>=22.12.0'}
 
-  '@next/env@16.3.5':
-    resolution: {integrity: sha512-NWEXVDMqoEo0ktmU6u0sE2Vg0LOcsD7NnOTJNo3/fEaTfsg+F1bMIxuDmQbda4e3yTIQwVdUREF2yIuMOusKtg==}
+  '@next/env@16.3.6':
+    resolution: {integrity: sha512-x9Vblze1EbtltQYnNH38xCPWU3TVfBd1eXqA3+w9+BTpedkkdNpAaltXlGQ/nsc1+E0mVTNrtcbX3GoO09zeLQ==}
 
   '@next/eslint-plugin-next@16.3.5':
     resolution: {integrity: sha512-PGfSeItHJ12DH8t+6sEbuMe59NE5rAhCfgk06QKTH2ne9VUL1JlaXdYXY3B8RaiF2SO50rDYvd39TulP6A6xZQ==}
@@ -2839,54 +2839,54 @@ packages:
       '@mdx-js/react':
         optional: true
 
-  '@next/swc-darwin-arm64@16.3.5':
-    resolution: {integrity: sha512-pMmGgETfKvElucLHtVaeiMRbp2zUbvKx7b1yGko0liBz3cw1mKSggWN/Rp/wPz8z+E1O82u3r4L1Co+ZS5hokQ==}
+  '@next/swc-darwin-arm64@16.3.6':
+    resolution: {integrity: sha512-E/7GEqaUkt8mk/T8v9lAnrhzR06kdq1ZBkC12F8tAMkdIadwNp3H1KqHynDHrpcTlGCUdq/qu6vUL2aYVyYBdw==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [darwin]
 
-  '@next/swc-darwin-x64@16.3.5':
-    resolution: {integrity: sha512-76VaGYvf6HPa5/w12yLkE3dXTn9AfdEviI79oEL3aZoAmRLc9rWitjWqyjViVysK/ht/y9YKzFkBrUdi/wGkow==}
+  '@next/swc-darwin-x64@16.3.6':
+    resolution: {integrity: sha512-yBE893/nDWTlaiBD1p+qgt7NUen4U5R6FXyH0s67Npq1S3E0cVSef1WIXC2xBRgQvwAvJq6DnS6Y6PrY0cy4Ew==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [darwin]
 
-  '@next/swc-linux-arm64-gnu@16.3.5':
-    resolution: {integrity: sha512-zKDELJ5jSQMHeO/hmXUQsAzagX4bQD4OiMi3pQ5FbUj+yK506oLVHnKA2YXMlbg1EHHqJYtyePOgByIDXD1lqw==}
+  '@next/swc-linux-arm64-gnu@16.3.6':
+    resolution: {integrity: sha512-KJDpjBqBPYlvkivmyrp+Qys6k/7ksbqGQvRVc6ZEGfR+cjQxx+nUkJaWmNZJsmoOrqYNbaXByF8wa0lBwDhB3Q==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
     libc: [glibc]
 
-  '@next/swc-linux-arm64-musl@16.3.5':
-    resolution: {integrity: sha512-7Vql0pgzCoHagv6+FNOZoqmJqA52c6zeVbhtS/47qFozO1MSx4ms7x7GHiciY8R5CDsSMKMQjJEryoJLcsBIbA==}
+  '@next/swc-linux-arm64-musl@16.3.6':
+    resolution: {integrity: sha512-mqNg2K+hvWskSRb/QM+Ix412DvBsuSF0XV+frTSw5vmoucNnIlynFwKYew8D01bfATErMOM7Bujrf0BA5DRKFA==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
     libc: [musl]
 
-  '@next/swc-linux-x64-gnu@16.3.5':
-    resolution: {integrity: sha512-NH/xzehyHEFWE2nlcZon7TB/0+H4shfWCi7S1zka815XCOhJDYZhoeJtOYy0dh0WVRWACVXSyGNFFytoMxUhRg==}
+  '@next/swc-linux-x64-gnu@16.3.6':
+    resolution: {integrity: sha512-nFncBNGAYouRHjRVaITs9beZRfhX4ssVwpnvPIAbkZVH6LtGoAVlH4bJ8Cnf9SOo9bsXgPFer/GdHtEE3JNOkw==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [linux]
     libc: [glibc]
 
-  '@next/swc-linux-x64-musl@16.3.5':
-    resolution: {integrity: sha512-lV4+EhWMfS8jcC+EH2nn/Cm5cn6XsgbE07bU9tMH8fCo0tNAqhyzi1b5wQ/Tn6NGFTvKDY65w3ZH95EjwBRAnQ==}
+  '@next/swc-linux-x64-musl@16.3.6':
+    resolution: {integrity: sha512-5Mf3cHDGR/Iz0ng2Bj3zUR3p5QS9YK3Hn2QiAfavFmyF48zwThAjpFoiTKNIcOHLYS4zEk+gzyJ/9deQ2ZB8yQ==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [linux]
     libc: [musl]
 
-  '@next/swc-win32-arm64-msvc@16.3.5':
-    resolution: {integrity: sha512-/wKzAREX2RF++MhicjDbg8tGn2AiBIM0+EFeTFKoUEUbW5D6amCJehd5Z5G1H5/gxNdgnwoXMcHz24H/c2tGkQ==}
+  '@next/swc-win32-arm64-msvc@16.3.6':
+   
```

**File**: `pnpm-workspace.yaml` (modified, +2/-0)
```diff
@@ -65,6 +65,8 @@ minimumReleaseAgeExclude:
   - '@mui/internal-*'
   # Renovate security update: js-yaml@4.3.2
   - js-yaml@4.3.2
+  # Renovate security update: next@16.3.6
+  - next@16.3.6
 trustPolicy: no-downgrade
 # Skip trust-policy checks for packages published more than 365 days ago.
 # Several widely-used legacy packages in the current dependency tree have releases that dropped
```

---

### Incident Patch 10: `44045305` (2026-10-02)
**Commit Message**: Bump @types/luxon to 3.7.6 (#5848)

Co-authored-by: code-infra-renovate[bot] <290386390+code-infra-renovate[bot]@users.noreply.github.com>

**File**: `packages/react/package.json` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@
     "@date-fns/tz": "1.5.0",
     "@testing-library/react": "16.3.3",
     "@testing-library/user-event": "14.6.7",
-    "@types/luxon": "3.7.5",
+    "@types/luxon": "3.7.6",
     "@types/react": "19.3.0",
     "@types/react-dom": "19.3.0",
     "@types/use-sync-external-store": "1.7.0",
```

**File**: `pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -532,8 +532,8 @@ importers:
         specifier: 14.6.7
         version: 14.6.7(@testing-library/dom@10.4.2)
       '@types/luxon':
-        specifier: 3.7.5
-        version: 3.7.5
+        specifier: 3.7.6
+        version: 3.7.6
       '@types/react':
         specifier: 19.3.0
         version: 19.3.0
@@ -4280,8 +4280,8 @@ packages:
   '@types/json5@0.0.29':
     resolution: {integrity: sha512-dRLjCWHYg4oaA77cxO64oO+7JwCwnIzkZPdrrC71jQmQtlhM556pwKo5bUzqvZndkVbeFLIIi+9TC40JNF5hNQ==}
 
-  '@types/luxon@3.7.5':
-    resolution: {integrity: sha512-jJ41Q4z6ZVO260MNDdHfW7+7a5iMiX8Mr6ZJHcmgrvhZha6dz5704o/lF2kKl6URjH6ivEL97w9xS/MgpJEphg==}
+  '@types/luxon@3.7.6':
+    resolution: {integrity: sha512-6KSjliQAXK8ZLgFQO4B7iE4Rpf/B3rItzCFuXezBY/XIAGxOdLd7vRNK9/StRPwiS/yJsVbB7HKpW46B8tcEuQ==}
 
   '@types/mdast@4.0.4':
     resolution: {integrity: sha512-kGaNbPh1k7AFzgpud/gMdvIm5xuECykRR+JnWKQno9TAXVa6WIVCGTPvYGekIDL4uwCZQSYbUxNBSb1aUo79oA==}
@@ -13647,7 +13647,7 @@ snapshots:
 
   '@types/json5@0.0.29': {}
 
-  '@types/luxon@3.7.5': {}
+  '@types/luxon@3.7.6': {}
 
   '@types/mdast@4.0.4':
     dependencies:
```

---

### Incident Patch 11: `564d5dd4` (2026-10-02)
**Commit Message**: [popover][menu] Fix hover-out animations when switching between detached triggers (#4261)

**File**: `packages/react/src/internals/useTriggerSwitchTransition.ts` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+'use client';
+import * as React from 'react';
+import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
+import { useAnimationsFinished } from './useAnimationsFinished';
+
+/**
+ * Popover and Menu declare different `instantType` unions, so only the members
+ * this hook touches are typed.
+ */
+interface TriggerSwitchStore {
+  /**
+   * Read raw, because the `instantType` selector deliberately hides
+   * `trigger-change` while closed — which is exactly when it has to be cleared.
+   */
+  readonly state: { readonly instantType: string | undefined };
+  set(key: 'instantType', value: 'trigger-change' | undefined): void;
+  select(key: 'open'): boolean;
+}
+
+export interface UseTriggerSwitchTransitionParameters {
+  store: TriggerSwitchStore;
+  /**
+   * The trigger element that currently owns the popup.
+   */
+  domReference: Element | null;
+  positionerElement: HTMLElement | null;
+  open: boolean;
+}
+
+/**
+ * Lets the positioner animate while a popup moves between detached triggers.
+ *
+ * The positioner is normally marked instant, so a hand-off from one trigger to
+ * another would teleport. Clearing `instantType` for the duration of the move
+ * lets it transition, and `trigger-change` is restored once the move finishes.
+ *
+ * The restoration is deferred until the move's animations finish, so it can
+ * outlive the move that scheduled it. The trigger element is retained through
+ * the exit transition, so a close alone does not change `domReference` and
+ * nothing would otherwise re-run this effect to abort it — a popup that closes
+ * and reopens on the same trigger mid-exit would inherit the stale callback and
+ * lose its own transition. Closing therefore cancels the pending restoration
+ * explicitly.
+ *
+ * Applying `trigger-change` to a closed popup is prevented separately, by the
+ * stores' `instantType` selector, since a controlled `open={false}` commit
+ * reaches the popup without passing through `setOpen`.
+ */
+export function useTriggerSwitchTransition(parameters: UseTriggerSwitchTransitionParameters): void {
+  const { store, domReference, positionerElement, open } = parameters;
+
+  const previousTriggerRef = React.useRef<Element | null>(null);
+  const pendingSwitchRef = React.useRef<AbortController | null>(null);
+  const runOnceAnimationsFinish = useAnimationsFinished(positionerElement);
+
+  useIsoLayoutEffect(() => {
+    if (open) {
+      return;
+    }
+
+    pendingSwitchRef.current?.abort();
+    pendingSwitchRef.current = null;
+
+    // `trigger-change` belongs to the open cycle that scheduled it. The selector
+    // stops a closed popup from rendering it, but the value has to be dropped
+    // too: a controlled reopen changes only `openProp`, so neither this effect
+    // nor `setOpen` would run again to replace it, and the selector would start
+    // exposing the old value against the new cycle.
+    if (store.state.instantType === 'trigger-change') {
+      store.set('instantType', undefined);
+    }
+  }, [open, store]);
+
+  useIsoLayoutEffect(() => {
+    const currentTrigger = domReference;
+    const previousTrigger = previousTriggerRef.current;
+
+    if (currentTrigger) {
+      previousTriggerRef.current = currentTrigger;
+    }
+
+    if (!previousTrigger || !currentTrigger || currentTrigger === previousTrigger) {
+      return undefined;
+    }
+
+    // The trigger element can also change while the popup is closing, when a
+    // trigger is replaced by a new element. There is no move to animate, and
+    // the cancellation effect above has already run for this commit, so a
+    // restoration scheduled here would survive into whatever opens next.
+    if (!store.select('open')) {
+      return undefined;
+    }
+
+    store.set('instantType', undefined);
+
+    const abortController = new AbortController();
+    pendingSwitchRef.current = abortController;
+
+    runOnceAnimationsFinish(() => {
+      // The abort above covers a committed close, but the animations can finish
+      // in the same frame the close commits. Writing `trigger-change` then would
+      // leave stale state behind for the next open to inherit.
+      if (store.select('open')) {
+        store.set('instantType', 'trigger-change');
+      }
+    }, abortController.signal);
+
+    return () => {
+      abortController.abort();
+    };
+  }, [domReference, runOnceAnimationsFinish, store]);
+}
```

**File**: `packages/react/src/menu/positioner/MenuPositioner.tsx` (modified, +7/-30)
```diff
@@ -1,7 +1,6 @@
 'use client';
 import * as React from 'react';
 import { inertValue } from '@base-ui/utils/inertValue';
-import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
 import { useTimeout } from '@base-ui/utils/useTimeout';
 import { FloatingNode } from '../../floating-ui-react';
 import { MenuPositionerContext } from './MenuPositionerContext';
@@ -22,7 +21,7 @@ import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRo
 import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
 import { REASONS } from '../../internals/reasons';
 import type { MenuOpenEventDetails } from '../utils/types';
-import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
+import { useTriggerSwitchTransition } from '../../internals/useTriggerSwitchTransition';
 import { usePositioner } from '../../utils/usePositioner';
 import { useAnchoredPopupScrollLock } from '../../utils/useAnchoredPopupScrollLock';
 
@@ -76,10 +75,6 @@ export const MenuPositioner = React.forwardRef(function MenuPositioner(
   const floatingParentNodeId = store.useState('floatingParentNodeId');
   const domReference = floatingRootContext.useState('domReferenceElement');
 
-  const previousTriggerRef = React.useRef<Element | null>(null);
-
-  const runOnceAnimationsFinish = useAnimationsFinished(positionerElement);
-
   let anchor = anchorProp;
   let sideOffset = sideOffsetProp;
   let alignOffset = alignOffsetProp;
@@ -231,30 +226,12 @@ export const MenuPositioner = React.forwardRef(function MenuPositioner(
     floatingTreeRoot.events.emit('menuopenchange', eventDetails);
   }, [floatingTreeRoot.events, open, store, floatingNodeId, floatingParentNodeId]);
 
-  // Keep positioner transition behavior aligned with Popover when switching detached triggers.
-  useIsoLayoutEffect(() => {
-    const currentTrigger = domReference;
-    const previousTrigger = previousTriggerRef.current;
-
-    if (currentTrigger) {
-      previousTriggerRef.current = currentTrigger;
-    }
-
-    if (previousTrigger && currentTrigger && currentTrigger !== previousTrigger) {
-      store.set('instantType', undefined);
-
-      const abortController = new AbortController();
-      runOnceAnimationsFinish(() => {
-        store.set('instantType', 'trigger-change');
-      }, abortController.signal);
-
-      return () => {
-        abortController.abort();
-      };
-    }
-
-    return undefined;
-  }, [domReference, runOnceAnimationsFinish, store]);
+  useTriggerSwitchTransition({
+    store,
+    domReference,
+    positionerElement,
+    open,
+  });
 
   const state: MenuPositionerState = {
     open,
```

**File**: `packages/react/src/menu/root/MenuRoot.detached-triggers.test.tsx` (modified, +294/-0)
```diff
@@ -763,6 +763,300 @@ describe('<MenuRoot />', () => {
   describe.skipIf(isJSDOM)('multiple detached triggers', () => {
     type NumberPayload = { payload: number | undefined };
 
+    /**
+     * Mirrors the Popover detached-trigger hover fixture: two detached hover
+     * triggers with a real position transition on the positioner and a real exit
+     * transition on the popup, handed off from trigger 1 to trigger 2 so
+     * `instantType` is `trigger-change`.
+     */
+    async function renderHoverDetachedTriggers({
+      settleTriggerChange = true,
+    }: {
+      /**
+       * Set to `false` to return while the positioner is still animating to the
+       * new trigger, so the delayed `trigger-change` restoration is still pending.
+       */
+      settleTriggerChange?: boolean;
+    } = {}) {
+      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
+
+      const testMenu = Menu.createHandle<number>();
+      const instantsWhileEnding: (string | undefined)[] = [];
+
+      const utils = await render(
+        <div style={{ position: 'relative', width: 400, height: 200 }}>
+          <style>
+            {`
+              .positioner {
+                transition:
+                  top 120ms linear,
+                  left 120ms linear,
+                  transform 120ms linear;
+              }
+
+              .popup {
+                opacity: 1;
+                transition: opacity 250ms linear;
+              }
+
+              .popup[data-ending-style] {
+                opacity: 0;
+              }
+
+              .positioner[data-instant],
+              .popup[data-instant] {
+                transition: none;
+              }
+            `}
+          </style>
+
+          <Menu.Trigger
+            handle={testMenu}
+            payload={1}
+            openOnHover
+            delay={0}
+            style={{ position: 'absolute', top: 20, left: 20 }}
+          >
+            Trigger 1
+          </Menu.Trigger>
+          <Menu.Trigger
+            handle={testMenu}
+            payload={2}
+            openOnHover
+            delay={0}
+            style={{ position: 'absolute', top: 20, left: 220 }}
+          >
+            Trigger 2
+          </Menu.Trigger>
+
+          <Menu.Root handle={testMenu}>
+            {({ payload }: NumberPayload) => (
+              <Menu.Portal>
+                <Menu.Positioner data-testid="positioner" className="positioner">
+                  <Menu.Popup
+                    data-testid="popup"
+                    className="popup"
+                    render={(props, state) => {
+                      if (state.transitionStatus === 'ending') {
+                        instantsWhileEnding.push(state.instant);
+                      }
+                      return <div {...props} />;
+                    }}
+                  >
+                    <Menu.Item data-testid="content">{payload}</Menu.Item>
+                  </Menu.Popup>
+                </Menu.Positioner>
+              </Menu.Portal>
+            )}
+          </Menu.Root>
+        </div>,
+      );
+
+      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
+      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
+
+      await utils.user.hover(trigger1);
+      await waitFor(() => {
+        expect(screen.getByTestId('content').textContent).toBe('1');
+      });
+
+      await utils.user.hover(trigger2);
+      await waitFor(() => {
+        expect(screen.getByTestId('content').textContent).toBe('2');
+      });
+
+      if (settleTriggerChange) {
+        await waitFor(() => {
+          expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'trigger-change');
+        });
+      }
+
+      // The handoff itself legitimately renders `trigger-change` while closing
+      // the previous trigger's popup. Only the close that follows matters.
+      instantsWhileEnding.length = 0;
+
+      return {
+        ...utils,
+        trigger1,
+        trigger2,
+        instantsWhileEnding,
+        popup: screen.getByTestId('popup'),
+      };
+    }
+
+    it('does not apply the trigger-change instant to a hover close after switching triggers', async () => {
+      const { user, trigger2, popup, instantsWhileEnding } = await renderHoverDetachedTriggers();
+
+      await user.unhover(trigger2);
+      await waitFor(() => {
+        expect(popup).toHaveAttribute('data-ending-style');
+      });
+
+      expect(instantsWhileEnding).not.toContain('trigger-change');
+    });
+
+    it('does not restore the trigger-change instant when a controlled close commits late', async () => {
+      // A controlled consumer can accept the close but commit `open={false}`
+      // later. That commit goes straight through the prop without passing back
+      // through `setOpen`, so a `trigger-change` restored in the meantime would
+      // never be cleared and would collapse the exit transition.
+      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
+

```

**File**: `packages/react/src/menu/store/MenuStore.ts` (modified, +9/-1)
```diff
@@ -102,7 +102,15 @@ const selectors = {
   highlightedItemId: (state: State<unknown>) => state.highlightedItem?.id || undefined,
   isActive: (state: State<unknown>, itemIndex: number) => state.activeIndex === itemIndex,
   hoverEnabled: (state: State<unknown>) => state.hoverEnabled,
-  instantType: (state: State<unknown>) => state.instantType,
+  // `trigger-change` describes a popup moving between triggers, which only has
+  // meaning while it is open. Dropping it once closed keeps a late or stale
+  // restoration from marking a closing popup instant and skipping its exit
+  // transition, including on close paths that never reach `setOpen` — a
+  // controlled consumer committing `open={false}` goes straight through the prop.
+  instantType: (state: State<unknown>) =>
+    state.instantType === 'trigger-change' && !popupStoreSelectors.open(state)
+      ? undefined
+      : state.instantType,
   lastOpenChangeReason: (state: State<unknown>) => state.openChangeReason,
   floatingTreeRoot: (state: State<unknown>): FloatingTreeStore => {
     if (state.parent.type === 'menu') {
```

**File**: `packages/react/src/popover/positioner/PopoverPositioner.tsx` (modified, +7/-34)
```diff
@@ -1,7 +1,6 @@
 'use client';
 import * as React from 'react';
 import { inertValue } from '@base-ui/utils/inertValue';
-import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
 import { FloatingNode, useFloatingNodeId } from '../../floating-ui-react';
 import { usePopoverRootContext } from '../root/PopoverRootContext';
 import { PopoverPositionerContext } from './PopoverPositionerContext';
@@ -16,7 +15,7 @@ import { usePopoverPortalContext } from '../portal/PopoverPortalContext';
 import { InternalBackdrop } from '../../utils/InternalBackdrop';
 import { REASONS } from '../../internals/reasons';
 import { POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
-import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
+import { useTriggerSwitchTransition } from '../../internals/useTriggerSwitchTransition';
 import { usePositioner } from '../../utils/usePositioner';
 import { useAnchoredPopupScrollLock } from '../../utils/useAnchoredPopupScrollLock';
 
@@ -67,10 +66,6 @@ export const PopoverPositioner = React.forwardRef(function PopoverPositioner(
   const transitionStatus = store.useState('transitionStatus');
   const adaptiveOrigin = store.useState('adaptiveOrigin');
 
-  const prevTriggerElementRef = React.useRef<Element | null>(null);
-
-  const runOnceAnimationsFinish = useAnimationsFinished(positionerElement);
-
   const positioning = useAnchorPositioning({
     anchor,
     floatingRootContext,
@@ -93,34 +88,12 @@ export const PopoverPositioner = React.forwardRef(function PopoverPositioner(
 
   const domReference = floatingRootContext.useState('domReferenceElement');
 
-  // When the current trigger element changes, enable transitions on the
-  // positioner temporarily
-  useIsoLayoutEffect(() => {
-    const currentTriggerElement = domReference;
-    const prevTriggerElement = prevTriggerElementRef.current;
-
-    if (currentTriggerElement) {
-      prevTriggerElementRef.current = currentTriggerElement;
-    }
-
-    if (
-      prevTriggerElement &&
-      currentTriggerElement &&
-      currentTriggerElement !== prevTriggerElement
-    ) {
-      store.set('instantType', undefined);
-      const ac = new AbortController();
-      runOnceAnimationsFinish(() => {
-        store.set('instantType', 'trigger-change');
-      }, ac.signal);
-
-      return () => {
-        ac.abort();
-      };
-    }
-
-    return undefined;
-  }, [domReference, runOnceAnimationsFinish, store]);
+  useTriggerSwitchTransition({
+    store,
+    domReference,
+    positionerElement,
+    open,
+  });
 
   const trueModalNonHover = modal === true && openReason !== REASONS.triggerHover;
 
```

**File**: `packages/react/src/popover/root/PopoverRoot.detached-triggers.test.tsx` (modified, +499/-1)
```diff
@@ -2,7 +2,7 @@ import { expect, vi, describe, beforeEach, it } from 'vitest';
 import * as React from 'react';
 import type { UserEvent } from '@testing-library/user-event';
 import { createRenderer, isJSDOM } from '#test-utils';
-import { act, screen, waitFor } from '@mui/internal-test-utils';
+import { act, fireEvent, screen, waitFor } from '@mui/internal-test-utils';
 import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
 import { Popover } from '@base-ui/react/popover';
 
@@ -848,6 +848,504 @@ describe('<Popover.Root />', () => {
   describe.skipIf(isJSDOM)('multiple detached triggers', () => {
     type NumberPayload = { payload: number | undefined };
 
+    /**
+     * Renders two detached hover triggers with a real position transition on the
+     * positioner and a real exit transition on the popup, then hands the popover
+     * off from trigger 1 to trigger 2 so `instantType` is `trigger-change`.
+     *
+     * `instantsWhileEnding` records the `instant` state of every closing render,
+     * which is the only way to observe a stale value that a later render clears
+     * before the DOM can be asserted on.
+     */
+    async function renderHoverDetachedTriggers({
+      popupChildren,
+      settleTriggerChange = true,
+      switchDuration = 120,
+      exitDuration = 250,
+    }: {
+      popupChildren?: React.ReactNode;
+      /**
+       * Set to `false` to return while the positioner is still animating to the
+       * new trigger, so the delayed `trigger-change` restoration is still pending.
+       */
+      settleTriggerChange?: boolean;
+      /** How long the positioner takes to move to the new trigger. */
+      switchDuration?: number;
+      /** How long the popup takes to fade out. */
+      exitDuration?: number;
+    } = {}) {
+      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
+
+      const testPopover = Popover.createHandle<number>();
+      const instantsWhileEnding: (string | undefined)[] = [];
+
+      const utils = await render(
+        <div style={{ position: 'relative', width: 400, height: 200 }}>
+          <style>
+            {`
+              .positioner {
+                transition:
+                  top ${switchDuration}ms linear,
+                  left ${switchDuration}ms linear,
+                  transform ${switchDuration}ms linear;
+              }
+
+              .popup {
+                opacity: 1;
+                transition: opacity ${exitDuration}ms linear;
+              }
+
+              .popup[data-ending-style] {
+                opacity: 0;
+              }
+
+              .positioner[data-instant],
+              .popup[data-instant] {
+                transition: none;
+              }
+            `}
+          </style>
+
+          <Popover.Trigger
+            handle={testPopover}
+            payload={1}
+            openOnHover
+            delay={0}
+            style={{ position: 'absolute', top: 20, left: 20 }}
+          >
+            Trigger 1
+          </Popover.Trigger>
+          <Popover.Trigger
+            handle={testPopover}
+            payload={2}
+            openOnHover
+            delay={0}
+            style={{ position: 'absolute', top: 20, left: 220 }}
+          >
+            Trigger 2
+          </Popover.Trigger>
+
+          <Popover.Root handle={testPopover}>
+            {({ payload }: NumberPayload) => (
+              <Popover.Portal>
+                <Popover.Positioner data-testid="positioner" className="positioner">
+                  <Popover.Popup
+                    data-testid="popup"
+                    className="popup"
+                    render={(props, state) => {
+                      if (state.transitionStatus === 'ending') {
+                        instantsWhileEnding.push(state.instant);
+                      }
+                      return <div {...props} />;
+                    }}
+                  >
+                    <span data-testid="content">{payload}</span>
+                    {popupChildren}
+                  </Popover.Popup>
+                </Popover.Positioner>
+              </Popover.Portal>
+            )}
+          </Popover.Root>
+        </div>,
+      );
+
+      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
+      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
+
+      await utils.user.hover(trigger1);
+      await waitFor(() => {
+        expect(screen.getByTestId('content').textContent).toBe('1');
+      });
+
+      await utils.user.hover(trigger2);
+      await waitFor(() => {
+        expect(screen.getByTestId('content').textContent).toBe('2');
+      });
+
+      if (settleTriggerChange) {
+        await waitFor(() => {
+          expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'trigger-change');
+        });
+      }
+
+      // The handoff itself legitimately renders `trigger-change` while closing
+      // the previous trigger's popup. Only the close that follow
```

**File**: `packages/react/src/popover/store/PopoverStore.ts` (modified, +9/-1)
```diff
@@ -45,7 +45,15 @@ type Context = PopupStoreContext<PopoverRoot.ChangeEventDetails> & {
 const selectors = {
   ...popupStoreSelectors,
   disabled: (state: State<unknown>) => state.disabled,
-  instantType: (state: State<unknown>) => state.instantType,
+  // `trigger-change` describes a popup moving between triggers, which only has
+  // meaning while it is open. Dropping it once closed keeps a late or stale
+  // restoration from marking a closing popup instant and skipping its exit
+  // transition, including on close paths that never reach `setOpen` — a
+  // controlled consumer committing `open={false}` goes straight through the prop.
+  instantType: (state: State<unknown>) =>
+    state.instantType === 'trigger-change' && !popupStoreSelectors.open(state)
+      ? undefined
+      : state.instantType,
   openMethod: (state: State<unknown>) => state.openMethod,
   openChangeReason: (state: State<unknown>) => state.openChangeReason,
   modal: (state: State<unknown>) => state.modal,
```

---

### Incident Patch 12: `b64364e2` (2026-10-02)
**Commit Message**: Bump @mui/internal-docs-infra to 0.13.1-canary.5 (#5730)

Co-authored-by: code-infra-renovate[bot] <290386390+code-infra-renovate[bot]@users.noreply.github.com>

**File**: `docs/package.json` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
     "@base-ui/utils": "workspace:*",
     "@mdx-js/loader": "^3.1.1",
     "@mdx-js/react": "^3.1.1",
-    "@mui/internal-docs-infra": "0.13.1-canary.1",
+    "@mui/internal-docs-infra": "0.13.1-canary.5",
     "@next/mdx": "^16.3.5",
     "@react-spring/web": "^10.1.2",
     "@stefanprobst/rehype-extract-toc": "^3.0.0",
```

**File**: `pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -341,8 +341,8 @@ importers:
         specifier: ^3.1.1
         version: 3.1.1(@types/react@19.3.0)(react@19.3.0)
       '@mui/internal-docs-infra':
-        specifier: 0.13.1-canary.1
-        version: 0.13.1-canary.1(@types/react@19.3.0)(next@16.3.5(@babel/core@8.0.5)(@playwright/test@1.63.0)(@types/node@22.20.4)(babel-plugin-react-compiler@1.0.0)(react-dom@19.3.0(react@19.3.0))(react@19.3.0))(prettier@3.9.8)(react-dom@19.3.0(react@19.3.0))(react@19.3.0)(supports-color@10.2.2)
+        specifier: 0.13.1-canary.5
+        version: 0.13.1-canary.5(@types/react@19.3.0)(next@16.3.5(@babel/core@8.0.5)(@playwright/test@1.63.0)(@types/node@22.20.4)(babel-plugin-react-compiler@1.0.0)(react-dom@19.3.0(react@19.3.0))(react@19.3.0))(prettier@3.9.8)(react-dom@19.3.0(react@19.3.0))(react@19.3.0)(supports-color@10.2.2)
       '@next/mdx':
         specifier: ^16.3.5
         version: 16.3.5(@mdx-js/loader@3.1.1(supports-color@10.2.2)(webpack@5.110.3(esbuild@0.28.2)(lightningcss@1.33.0)(postcss@8.5.28)(sharp@0.35.4(@types/node@22.20.4))(uglify-js@3.19.3)))(@mdx-js/react@3.1.1(@types/react@19.3.0)(react@19.3.0))
@@ -2420,8 +2420,8 @@ packages:
       typescript:
         optional: true
 
-  '@mui/internal-docs-infra@0.13.1-canary.1':
-    resolution: {integrity: sha512-OZxEYcmb7BNUyZfUQRsTgqZFVtXs5OjkFLllBFP029t5rsgeF8/o0dQ/6nCneHOqh7my3gXcRGm5PNSlXDLrIg==}
+  '@mui/internal-docs-infra@0.13.1-canary.5':
+    resolution: {integrity: sha512-yGEAYAJOSaTAxMmp7DSuSvDv61fDdW8+i/d+R3rSti7vP9njwhm8ZUexqhPC2TcSInJPsnZl/jPZiVZwB71h4w==}
     engines: {node: '>=22.18.0'}
     hasBin: true
     peerDependencies:
@@ -11755,7 +11755,7 @@ snapshots:
       - supports-color
       - vitest
 
-  '@mui/internal-docs-infra@0.13.1-canary.1(@types/react@19.3.0)(next@16.3.5(@babel/core@8.0.5)(@playwright/test@1.63.0)(@types/node@22.20.4)(babel-plugin-react-compiler@1.0.0)(react-dom@19.3.0(react@19.3.0))(react@19.3.0))(prettier@3.9.8)(react-dom@19.3.0(react@19.3.0))(react@19.3.0)(supports-color@10.2.2)':
+  '@mui/internal-docs-infra@0.13.1-canary.5(@types/react@19.3.0)(next@16.3.5(@babel/core@8.0.5)(@playwright/test@1.63.0)(@types/node@22.20.4)(babel-plugin-react-compiler@1.0.0)(react-dom@19.3.0(react@19.3.0))(react@19.3.0))(prettier@3.9.8)(react-dom@19.3.0(react@19.3.0))(react@19.3.0)(supports-color@10.2.2)':
     dependencies:
       '@babel/runtime': 8.0.5
       '@csstools/postcss-light-dark-function': 3.0.4(postcss@8.5.28)
```

---

### Incident Patch 13: `b3bd2ca8` (2026-10-02)
**Commit Message**: [combobox] Fix flaky trigger-press autoHighlight tests (#5842)

**File**: `packages/react/src/combobox/root/ComboboxRoot.test.tsx` (modified, +14/-4)
```diff
@@ -9198,9 +9198,19 @@ describe('<Combobox.Root />', () => {
       });
 
       it('discards the request when an ignored typed open is followed by another open', async () => {
-        const { user, setProps } = await render(<AsyncCombobox items={['32']} open={false} />);
+        const onOpenChange = vi.fn();
+        const { user, setProps } = await render(
+          <AsyncCombobox items={['32']} open={false} onOpenChange={onOpenChange} />,
+        );
         await user.type(screen.getByRole('combobox'), '32');
         await user.click(screen.getByTestId('trigger'));
+        // A trigger press opens on the frame after `mousedown`, which `user.click` can beat.
+        await waitFor(() => {
+          expect(onOpenChange).toHaveBeenLastCalledWith(
+            true,
+            expect.objectContaining({ reason: REASONS.triggerPress }),
+          );
+        });
         await setProps({ open: true });
         expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
       });
@@ -9229,9 +9239,9 @@ describe('<Combobox.Root />', () => {
             await user.keyboard('{ArrowDown}');
           }
 
-          expect(screen.getByRole('option', { name: '32' })).not.toHaveAttribute(
-            'data-highlighted',
-          );
+          // A trigger press opens on the frame after `mousedown`, which `user.click` can beat.
+          const option = await screen.findByRole('option', { name: '32' });
+          expect(option).not.toHaveAttribute('data-highlighted');
           expect(input).not.toHaveAttribute('aria-activedescendant');
         },
       );
```

---

### Incident Patch 14: `b82a7d2c` (2026-10-01)
**Commit Message**: [infra] Fix package.json metadata (#5825)

**File**: `docs/package.json` (modified, +0/-2)
```diff
@@ -1,7 +1,6 @@
 {
   "name": "docs",
   "private": true,
-  "license": "MIT",
   "scripts": {
     "build": "rimraf ./export && cross-env NODE_ENV=production NODE_OPTIONS=--max_old_space_size=8192 next build --webpack && pnpm link-check",
     "build:clean": "rimraf .next && pnpm build",
@@ -68,7 +67,6 @@
     "mdast-util-mdx-jsx": "3.2.0",
     "motion": "13.2.0",
     "prettier": "3.9.8",
-    "remark-parse": "11.0.0",
     "remark-stringify": "11.0.0",
     "rimraf": "6.1.3",
     "serve": "14.2.6",
```

---

### Incident Patch 15: `a5532411` (2026-10-01)
**Commit Message**: [combobox][autocomplete] Fix `autoHighlight` for asynchronous results (#5818)

**File**: `packages/react/src/autocomplete/root/AutocompleteRoot.test.tsx` (modified, +150/-0)
```diff
@@ -1090,6 +1090,156 @@ describe('<Autocomplete.Root />', () => {
 
       expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute('data-highlighted');
     });
+
+    describe('asynchronous items', () => {
+      function AsyncAutocomplete({
+        items = [],
+        keepMounted = false,
+        ...props
+      }: Omit<Autocomplete.Root.Props<string>, 'items'> & {
+        items?: string[];
+        keepMounted?: boolean;
+      }) {
+        return (
+          <Autocomplete.Root items={items} autoHighlight filter={null} {...props}>
+            <Autocomplete.Input />
+            <Autocomplete.Trigger data-testid="trigger" />
+            <Autocomplete.Clear data-testid="clear" />
+            <Autocomplete.Portal keepMounted={keepMounted}>
+              <Autocomplete.Positioner>
+                <Autocomplete.Popup>
+                  <Autocomplete.List>
+                    {(item: string) => (
+                      <Autocomplete.Item key={item} value={item}>
+                        {item}
+                      </Autocomplete.Item>
+                    )}
+                  </Autocomplete.List>
+                </Autocomplete.Popup>
+              </Autocomplete.Positioner>
+            </Autocomplete.Portal>
+          </Autocomplete.Root>
+        );
+      }
+
+      it('highlights a candidate arriving after typing', async () => {
+        const { user, setProps } = await render(<AsyncAutocomplete />);
+        const input = screen.getByRole('combobox');
+        await user.type(input, '32');
+        await setProps({ items: ['32', '320'] });
+
+        const option = screen.getByRole('option', { name: '32' });
+        expect(option).toHaveAttribute('data-highlighted');
+        expect(input).toHaveAttribute('aria-activedescendant', option.id);
+
+        await user.keyboard('{Enter}');
+        expect(input).toHaveValue('32');
+      });
+
+      it('highlights asynchronous results while an inline input stays focused', async () => {
+        function Test({ items = [] }: { items?: string[] }) {
+          return (
+            <Autocomplete.Root inline defaultOpen autoHighlight items={items}>
+              <Autocomplete.Input />
+              <Autocomplete.List>
+                {(item: string) => (
+                  <Autocomplete.Item key={item} value={item}>
+                    {item}
+                  </Autocomplete.Item>
+                )}
+              </Autocomplete.List>
+            </Autocomplete.Root>
+          );
+        }
+
+        const { user, setProps } = await render(<Test />);
+        const input = screen.getByRole('combobox');
+        await user.type(input, '32');
+        await setProps({ items: ['32'] });
+
+        const option = screen.getByRole('option');
+        expect(option).toHaveAttribute('data-highlighted');
+        expect(input).toHaveAttribute('aria-activedescendant', option.id);
+      });
+
+      it.each([true, 'always'] as const)(
+        'handles asynchronous results after an inline input blurs with autoHighlight=%s',
+        async (autoHighlight) => {
+          function Test({ items = [] }: { items?: string[] }) {
+            return (
+              <React.Fragment>
+                <Autocomplete.Root inline defaultOpen autoHighlight={autoHighlight} items={items}>
+                  <Autocomplete.Input />
+                  <Autocomplete.List>
+                    {(item: string) => (
+                      <Autocomplete.Item key={item} value={item}>
+                        {item}
+                      </Autocomplete.Item>
+                    )}
+                  </Autocomplete.List>
+                </Autocomplete.Root>
+                <button type="button">Blur target</button>
+              </React.Fragment>
+            );
+          }
+
+          const { user, setProps } = await render(<Test />);
+          const input = screen.getByRole('combobox');
+          await user.type(input, '32');
+          await user.click(screen.getByRole('button', { name: 'Blur target' }));
+          await setProps({ items: ['32'] });
+
+          const option = screen.getByRole('option');
+          expect(option.hasAttribute('data-highlighted')).toBe(autoHighlight === 'always');
+          expect(input.getAttribute('aria-activedescendant')).toBe(
+            autoHighlight === 'always' ? option.id : null,
+          );
+        },
+      );
+
+      it('discards the request when the clear button clears the query', async () => {
+        const { user, setProps } = await render(<AsyncAutocomplete />);
+        const input = screen.getByRole('combobox');
+        await user.type(input, '32');
+        await user.click(screen.getByTestId('clear'));
+        await setProps({ items: ['32'] });
+
+        expect(input).toHaveValue('');
+        expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
+        expect(input).not.toHaveAttribute('aria-activedescendant');
+      });
+
+      it.each([false, true])(
```

**File**: `packages/react/src/combobox/root/AriaCombobox.tsx` (modified, +37/-5)
```diff
@@ -21,7 +21,7 @@ import {
 } from '../../floating-ui-react';
 import { gridNavigation } from '../../floating-ui-react/hooks/gridNavigation';
 import type { HighlightItemTarget } from '../../floating-ui-react/hooks/useListNavigation';
-import { closest, contains, getTarget } from '../../floating-ui-react/utils';
+import { activeElement, closest, contains, getTarget } from '../../floating-ui-react/utils';
 import {
   createChangeEventDetails,
   createGenericEventDetails,
@@ -772,6 +772,15 @@ export function AriaCombobox<Value = any, Mode extends SelectionMode = 'none', I
       const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(openEventDetails);
       props.onOpenChange?.(nextOpen, openEventDetails);
 
+      // A typed request must not highlight a later open: discard it when its own open is
+      // rejected, or when any other open change goes through.
+      if (
+        pendingQueryHighlightRef.current?.hasQuery &&
+        (eventDetails.reason === REASONS.inputChange) === eventDetails.isCanceled
+      ) {
+        pendingQueryHighlightRef.current = null;
+      }
+
       if (eventDetails.isCanceled) {
         return;
       }
@@ -1053,6 +1062,13 @@ export function AriaCombobox<Value = any, Mode extends SelectionMode = 'none', I
     }
   }, [items, flatFilteredValues]);
 
+  useIsoLayoutEffect(() => {
+    // Controlled closes can bypass `setOpen`, and their exit animation may be interrupted.
+    if (!open && pendingQueryHighlightRef.current?.hasQuery) {
+      pendingQueryHighlightRef.current = null;
+    }
+  }, [open]);
+
   useIsoLayoutEffect(() => {
     // A kept-mounted dialog hides its inline list on close. Discard query-clear restoration
     // before it can overwrite the cleared highlight or report an item from the unfiltered list.
@@ -1061,16 +1077,34 @@ export function AriaCombobox<Value = any, Mode extends SelectionMode = 'none', I
       return;
     }
 
+    const candidateItems =
+      hasItems || hasFilteredItemsProp ? flatFilteredValues : valuesRef.current;
     const pendingHighlight = pendingQueryHighlightRef.current;
     if (pendingHighlight) {
       // A directly rendered list remains visible when the popup state is closed, while a
       // kept-mounted Positioner is hidden and should stay inert.
       const listIsNavigable = open || inline || store.state.positionerElement?.hidden === false;
       if (pendingHighlight.hasQuery) {
-        if (autoHighlightMode && listIsNavigable) {
+        const input = inputRef.current;
+        // Keep the request while results or a controlled popup opening are pending,
+        // but do not restore an inline highlight after focus has left the input.
+        if (
+          !autoHighlightMode ||
+          String(inputValue).trim() === '' ||
+          (inline &&
+            autoHighlightMode !== 'always' &&
+            (!input || activeElement(input.ownerDocument) !== input))
+        ) {
+          pendingQueryHighlightRef.current = null;
+        } else if (
+          listIsNavigable &&
+          // Individually rendered items register without re-running this effect, and their
+          // registry has holes mid-reindex, so resolve their request immediately.
+          (candidateItems[0] !== undefined || (!hasItems && !hasFilteredItemsProp))
+        ) {
           store.set('activeIndex', 0);
+          pendingQueryHighlightRef.current = null;
         }
-        pendingQueryHighlightRef.current = null;
       } else if (String(inputValue).trim() === '') {
         // Only handle the clear once it has committed (a controlled input may reject it),
         // so a restore cannot fire while a query is still active.
@@ -1146,8 +1180,6 @@ export function AriaCombobox<Value = any, Mode extends SelectionMode = 'none', I
       return;
     }
 
-    const shouldUseFlatFilteredValues = hasItems || hasFilteredItemsProp;
-    const candidateItems = shouldUseFlatFilteredValues ? flatFilteredValues : valuesRef.current;
     const storeActiveIndex = store.state.activeIndex;
 
     if (storeActiveIndex == null) {
```

**File**: `packages/react/src/combobox/root/ComboboxRoot.test.tsx` (modified, +274/-0)
```diff
@@ -9034,6 +9034,280 @@ describe('<Combobox.Root />', () => {
   });
 
   describe('prop: autoHighlight', () => {
+    describe('asynchronous items', () => {
+      function AsyncCombobox({
+        items = [],
+        dataProp = 'items',
+        popupRef,
+        ...props
+      }: Omit<Combobox.Root.Props<string>, 'items'> & {
+        items?: string[];
+        dataProp?: 'items' | 'filteredItems';
+        popupRef?: React.Ref<HTMLDivElement>;
+      }) {
+        return (
+          <Combobox.Root
+            {...(dataProp === 'items' ? { items } : { filteredItems: items })}
+            autoHighlight
+            filter={null}
+            {...props}
+          >
+            <Combobox.Input />
+            <Combobox.Trigger data-testid="trigger" />
+            <Combobox.Portal>
+              <Combobox.Positioner>
+                <Combobox.Popup ref={popupRef}>
+                  <Combobox.Empty>No matches</Combobox.Empty>
+                  <Combobox.List>
+                    {(item: string) => (
+                      <Combobox.Item key={item} value={item}>
+                        {item}
+                      </Combobox.Item>
+                    )}
+                  </Combobox.List>
+                </Combobox.Popup>
+              </Combobox.Positioner>
+            </Combobox.Portal>
+          </Combobox.Root>
+        );
+      }
+
+      it.each(['items', 'filteredItems'] as const)(
+        'highlights a candidate arriving after typing with %s',
+        async (dataProp) => {
+          const onItemHighlighted = vi.fn();
+          const onValueChange = vi.fn();
+          const { user, setProps } = await render(
+            <AsyncCombobox
+              dataProp={dataProp}
+              onItemHighlighted={onItemHighlighted}
+              onValueChange={onValueChange}
+            />,
+          );
+          const input = screen.getByRole('combobox');
+          await user.type(input, '32');
+          onItemHighlighted.mockClear();
+          await setProps({ items: ['32', '320'] });
+
+          const option = screen.getByRole('option', { name: '32' });
+          expect(option).toHaveAttribute('data-highlighted');
+          expect(input).toHaveAttribute('aria-activedescendant', option.id);
+          expect(onItemHighlighted).toHaveBeenCalledExactlyOnceWith(
+            '32',
+            expect.objectContaining({ index: 0, reason: 'none' }),
+          );
+
+          await user.keyboard('{Enter}');
+          expect(onValueChange).toHaveBeenCalledExactlyOnceWith('32', expect.anything());
+        },
+      );
+
+      it('waits for a controlled popup to open', async () => {
+        const { user, setProps } = await render(<AsyncCombobox items={['32']} open={false} />);
+        await user.type(screen.getByRole('combobox'), '32');
+        await setProps({ open: true });
+        expect(screen.getByRole('option')).toHaveAttribute('data-highlighted');
+      });
+
+      it('discards the request when a rejected typed open is followed by a controlled open', async () => {
+        const { user, setProps } = await render(
+          <AsyncCombobox
+            items={['32']}
+            open={false}
+            onOpenChange={(nextOpen, details) => {
+              if (nextOpen && details.reason === 'input-change') {
+                details.cancel();
+              }
+            }}
+          />,
+        );
+        await user.type(screen.getByRole('combobox'), '32');
+        await setProps({ open: true });
+        expect(screen.getByRole('option')).not.toHaveAttribute('data-highlighted');
+      });
+
+      it('keeps a hovered item highlighted when individually rendered items arrive', async () => {
+        function ChildrenCombobox({ results }: { results: string[] }) {
+          return (
+            <Combobox.Root autoHighlight>
+              <Combobox.Input />
+              <Combobox.Portal>
+                <Combobox.Positioner>
+                  <Combobox.Popup>
+                    <Combobox.List>
+                      {results.map((item) => (
+                        <Combobox.Item key={item} value={item}>
+                          {item}
+                        </Combobox.Item>
+                      ))}
+                    </Combobox.List>
+                  </Combobox.Popup>
+                </Combobox.Positioner>
+              </Combobox.Portal>
+            </Combobox.Root>
+          );
+        }
+
+        const { user, setProps } = await render(<ChildrenCombobox results={[]} />);
+        await user.type(screen.getByRole('combobox'), 'a');
+        await setProps({ results: ['a1', 'a2', 'a3'] });
+
+        const option = screen.getByRole('option', { name: 'a3' });
+        await user.hover(option);
+        expect(option).toHaveAttribute('data-highlighted');
+      });
+
+      it('highlights the first result when typing filters out individually rendered items', async () => {
+        function FilteredCombobox() {
+          const [query, set
```

#### Recent Merged Pull Requests:
- **PR #5885** (2026-10-05): [docs] Replace Menu.Item link example in Composition handbook (@aarongarciah)
- **PR #5871** (2026-10-05): [field][select][combobox][slider] Fix label focus in Shadow DOM (@lyzno1)
- **PR #5870** (closed): [docs] Use Select.Label in the grouped select demos (@lyzno1)
- **PR #5869** (2026-10-05): [docs][context menu] Use ContextMenu.Separator in the submenu demo (@aarongarciah)
- **PR #5866** (2026-10-05): [code-infra] Run React Compiler tests on master merges (@brijeshb42)
- **PR #5864** (2026-10-05): [drawer] Skip touchmove listener while closed (@atomiks)
- **PR #5863** (2026-10-05): [select][combobox] Combine item store subscriptions (@atomiks)
- **PR #5862** (2026-10-05): [composite] Fix list map tick canceling in StrictMode (@atomiks)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
