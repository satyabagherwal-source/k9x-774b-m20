# Forensic Learning Record (Deep Inspection): tremorlabs/tremor-npm

> **Canonical Artifact**: `07_PROJECT_LEARNING/tremorlabs-tremor-npm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tremorlabs/tremor-npm](https://github.com/tremorlabs/tremor-npm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:28:39.531Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tremorlabs/tremor-npm`
- **Description**: React components to build charts and dashboards
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 16484 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/components/chart-elements/common/utils.ts`
```
import { Color } from "../../../lib/inputTypes";

export const constructCategoryColors = (
  categories: string[],
  colors: (Color | string)[],
): Map<string, Color | string> => {
  const categoryColors = new Map<string, Color | string>();
  categories.forEach((category, idx) => {
    categoryColors.set(category, colors[idx % colors.length]);
  });
  return categoryColors;
};

export const getYAxisDomain = (
  autoMinValue: boolean,
  minValue: number | undefined,
  maxValue: number | undefined,
) => {
  const minDomain = autoMinValue ? "auto" : (minValue ?? 0);
  const maxDomain = maxValue ?? "auto";
  return [minDomain, maxDomain];
};

export const constructCategories = (data: any[], color?: string): string[] => {
  if (!color) {
    return [];
  }

  const categories = new Set<string>();
  data.forEach((datum) => {
    categories.add(datum[color]);
  });
  return Array.from(categories);
};

export function deepEqual(obj1: any, obj2: any) {
  if (obj1 === obj2) return true;

  if (typeof obj1 !== "object" || typeof obj2 !== "object" || obj1 === null || obj2 === null)
    return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

// export function deepEqual(obj1: unknown, obj2: unknown): boolean {
//   if (obj1 === obj2) return true;

//   if (typeof obj1 !== "object" || typeof obj2 !== "object" || obj1 === null || obj2 === null)
//     return false;

//   if (Object.prototype.toString.call(obj1) !== Object.prototype.toString.call(obj2)) return false;

//   const keys1 = Object.keys(obj1);
//   const keys2 = new Set(Object.keys(obj2));

//   if (keys1.length !== keys2.size) return false;

//   for (const key of keys1) {
//     if (
//       !keys2.has(key) ||
//       !deepEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key])
//     )
//       return false;
//   }

//   return true;
// }

export function hasOnlyOneValueForThisKey(array: any[], keyToCheck: string) {
  const val = [];

  for (const obj of array) {
    if (Object.prototype.hasOwnProperty.call(obj, keyToCheck)) {
      val.push(obj[keyToCheck]);
      if (val.length > 1) {
        return false;
      }
    }
  }

  return true;
}

```

### Core Architecture Module: `src/components/input-elements/DatePicker/datePickerUtils.tsx`
```
import { makeClassName } from "lib";

export const makeDatePickerClassName = makeClassName("DatePicker");

```

### Core Architecture Module: `src/components/input-elements/DateRangePicker/dateRangePickerUtils.tsx`
```
import {
  format,
  isEqual,
  max,
  min,
  startOfDay,
  startOfMonth,
  startOfToday,
  startOfYear,
  sub,
  Locale,
} from "date-fns";

import { makeClassName } from "lib";

export type DateRangePickerOption = {
  value: string;
  text: string;
  from: Date;
  to?: Date;
};
export type DropdownValues = Map<string, Omit<DateRangePickerOption, "value">>;

export const makeDateRangePickerClassName = makeClassName("DateRangePicker");

export const parseStartDate = (
  startDate: Date | undefined,
  minDate: Date | undefined,
  selectedDropdownValue: string | undefined,
  selectValues: DropdownValues,
) => {
  if (selectedDropdownValue) {
    startDate = selectValues.get(selectedDropdownValue)?.from;
  }
  if (!startDate) return undefined;
  if (startDate && !minDate) return startOfDay(startDate);
  return startOfDay(max([startDate as Date, minDate as Date]));
};

export const parseEndDate = (
  endDate: Date | undefined,
  maxDate: Date | undefined,
  selectedDropdownValue: string | undefined,
  selectValues: DropdownValues,
) => {
  if (selectedDropdownValue) {
    endDate = startOfDay(selectValues.get(selectedDropdownValue)?.to ?? startOfToday());
  }
  if (!endDate) return undefined;
  if (endDate && !maxDate) return startOfDay(endDate);

  return startOfDay(min([endDate as Date, maxDate as Date]));
};

export const defaultOptions: DateRangePickerOption[] = [
  {
    value: "tdy",
    text: "Today",
    from: startOfToday(),
  },
  {
    value: "w",
    text: "Last 7 days",
    from: sub(startOfToday(), { days: 7 }),
  },
  {
    value: "t",
    text: "Last 30 days",
    from: sub(startOfToday(), { days: 30 }),
  },
  {
    value: "m",
    text: "Month to Date",
    from: startOfMonth(startOfToday()),
  },
  {
    value: "y",
    text: "Year to Date",
    from: startOfYear(startOfToday()),
  },
];

export const formatSelectedDates = (
  startDate: Date | undefined,
  endDate: Date | undefined,
  locale?: Locale,
  displayFormat?: string,
) => {
  const localeCode = locale?.code || "en-US";
  if (!startDate && !endDate) {
    return "";
  } else if (startDate && !endDate) {
    if (displayFormat) return format(startDate, displayFormat);
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    return startDate.toLocaleDateString(localeCode, options);
  } else if (startDate && endDate) {
    if (isEqual(startDate, endDate)) {
      if (displayFormat) return format(startDate, displayFormat);
      const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "short",
        day: "numeric",
      };
      return startDate.toLocaleDateString(localeCode, options);
    } else if (
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getFullYear() === endDate.getFullYear()
    ) {
      if (displayFormat)
        return `${format(startDate, displayFormat)} - ${format(endDate, displayFormat)}`;

      const optionsStartDate: Intl.DateTimeFormatOptions = {
        month: "short",
        day: "numeric",
      };
      return `${startDate.toLocaleDateString(localeCode, optionsStartDate)} - 
                    ${endDate.getDate()}, ${endDate.getFullYear()}`;
    } else {
      if (displayFormat)
        return `${format(startDate, displayFormat)} - ${format(endDate, displayFormat)}`;
      const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "short",
        day: "numeric",
      };
      return `${startDate.toLocaleDateString(localeCode, options)} - 
                    ${endDate.toLocaleDateString(localeCode, options)}`;
    }
  }
  return "";
};

```

### Core Architecture Module: `src/components/input-elements/selectUtils.ts`
```
import { tremorTwMerge } from "lib";
import React from "react";

export interface SelectItemProps {
  value: string;
  children?: React.ReactNode;
}

export const getNodeText = (node: React.ReactElement): string | React.ReactElement | undefined => {
  if (["string", "number"].includes(typeof node)) return node;
  if (node instanceof Array) return node.map(getNodeText).join("");
  if (typeof node === "object" && node) return getNodeText(node.props.children);
};

export function constructValueToNameMapping(children: React.ReactElement[] | React.ReactElement) {
  const valueToNameMapping = new Map<string, string>();
  React.Children.map(children, (child: React.ReactElement<SelectItemProps>) => {
    valueToNameMapping.set(child.props.value, (getNodeText(child) ?? child.props.value) as string);
  });
  return valueToNameMapping;
}

export function getFilteredOptions(
  searchQuery: string,
  children: React.ReactElement[],
): React.ReactElement[] {
  return React.Children.map(children, (child) => {
    const optionText = (getNodeText(child) ?? child.props.value) as string;
    if (optionText.toLowerCase().includes(searchQuery.toLowerCase())) return child;
  });
}

export const getSelectButtonColors = (
  hasSelection: boolean,
  isDisabled: boolean,
  hasError = false,
) => {
  return tremorTwMerge(
    isDisabled
      ? "bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle"
      : "bg-tremor-background dark:bg-dark-tremor-background",
    !isDisabled && "hover:bg-tremor-background-muted dark:hover:bg-dark-tremor-background-muted",
    hasSelection
      ? "text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis"
      : "text-tremor-content dark:text-dark-tremor-content",
    isDisabled && "text-tremor-content-subtle dark:text-dark-tremor-content-subtle",
    hasError &&
      "text-red-500 placeholder:text-red-500 dark:text-red-500 dark:placeholder:text-red-500",
    hasError
      ? "border-red-500 dark:border-red-500"
      : "border-tremor-border dark:border-dark-tremor-border",
  );
};

export function hasValue<T>(value: T | null | undefined) {
  return value !== null && value !== undefined && value !== "";
}

```

### Core Architecture Module: `src/components/util-elements/Tooltip/Tooltip.tsx`
```
import {
  autoUpdate,
  ExtendedRefs,
  flip,
  offset,
  ReferenceType,
  shift,
  Strategy,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { tremorTwMerge } from "lib";
import React, { useState } from "react";

export const useTooltip = (delay?: number) => {
  const [open, setOpen] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout>();

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && delay) {
      const timer = setTimeout(() => {
        setOpen(isOpen);
      }, delay);
      setTimeoutId(timer);
      return;
    }
    clearTimeout(timeoutId);
    setOpen(isOpen);
  };

  const { x, y, refs, strategy, context } = useFloating({
    open,
    onOpenChange: handleOpenChange,
    placement: "top",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(5),
      flip({
        fallbackAxisSideDirection: "start",
      }),
      shift(),
    ],
  });

  const hover = useHover(context, { move: false });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  return {
    tooltipProps: {
      open,
      x,
      y,
      refs,
      strategy,
      getFloatingProps,
    },
    getReferenceProps,
  };
};

export interface TooltipProps {
  text?: string;
  open: boolean;
  x: number | null;
  y: number | null;
  refs: ExtendedRefs<ReferenceType>;
  strategy: Strategy;
  getFloatingProps: (
    userProps?: React.HTMLProps<HTMLElement> | undefined,
  ) => Record<string, unknown>;
}

const Tooltip = ({ text, open, x, y, refs, strategy, getFloatingProps }: TooltipProps) => {
  return open && text ? (
    <div
      className={tremorTwMerge(
        // common
        "max-w-xs text-sm z-20 rounded-tremor-default opacity-100 px-2.5 py-1",
        // light
        "text-white bg-tremor-background-emphasis",
        // dark
        "dark:text-tremor-content-emphasis dark:bg-white",
      )}
      ref={refs.setFloating}
      style={{
        position: strategy,
        top: y ?? 0,
        left: x ?? 0,
      }}
      {...getFloatingProps()}
    >
      {text}
    </div>
  ) : null;
};

Tooltip.displayName = "Tooltip";

export default Tooltip;

```

### Core Architecture Module: `src/components/util-elements/Tooltip/index.ts`
```
export { default as Tooltip } from "./Tooltip";
export type { TooltipProps } from "./Tooltip";

```

### Core Architecture Module: `src/components/util-elements/index.ts`
```
export * from "./Tooltip";

```

### Core Architecture Module: `src/hooks/index.ts`
```
export { default as useInternalState } from "./useInternalState";
export { default as useOnWindowResize } from "./useOnWindowResize";

```

### Core Architecture Module: `src/hooks/useInternalState.tsx`
```
import { useState } from "react";

const useInternalState = <T,>(defaultValueProp: T, valueProp: T) => {
  const isControlled = valueProp !== undefined;
  const [valueState, setValueState] = useState(defaultValueProp);

  const value = isControlled ? valueProp : valueState;
  const setValue = (nextValue: T) => {
    if (isControlled) {
      return;
    }
    setValueState(nextValue);
  };

  return [value, setValue] as [T, React.Dispatch<React.SetStateAction<T>>];
};

export default useInternalState;

```

### Core Architecture Module: `src/hooks/useOnWindowResize.tsx`
```
import * as React from "react";

const useOnWindowResize = (handler: { (): void }) => {
  React.useEffect(() => {
    const handleResize = () => {
      handler();
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [handler]);
};

export default useOnWindowResize;

```

### Core Architecture Module: `src/lib/utils.tsx`
```
import { DeltaTypes } from "./constants";
import { Color, getIsBaseColor, ValueFormatter } from "./inputTypes";

export const mapInputsToDeltaType = (deltaType: string, isIncreasePositive: boolean): string => {
  if (isIncreasePositive || deltaType === DeltaTypes.Unchanged) {
    return deltaType;
  }
  switch (deltaType) {
    case DeltaTypes.Increase:
      return DeltaTypes.Decrease;
    case DeltaTypes.ModerateIncrease:
      return DeltaTypes.ModerateDecrease;
    case DeltaTypes.Decrease:
      return DeltaTypes.Increase;
    case DeltaTypes.ModerateDecrease:
      return DeltaTypes.ModerateIncrease;
  }
  return "";
};

export const defaultValueFormatter: ValueFormatter = (value: number) => value.toString();

export const currencyValueFormatter: ValueFormatter = (e: number) =>
  `$ ${Intl.NumberFormat("en-US").format(e)}`;

export const sumNumericArray = (arr: number[]) =>
  arr.reduce((prefixSum, num) => prefixSum + num, 0);

export const isValueInArray = (value: any, array: any[]): boolean => {
  for (let i = 0; i < array.length; i++) {
    if (array[i] === value) {
      return true;
    }
  }
  return false;
};

export function mergeRefs<T = any>(
  refs: Array<React.MutableRefObject<T> | React.LegacyRef<T>>,
): React.RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}

export function makeClassName(componentName: string) {
  return (className: string) => {
    return `tremor-${componentName}-${className}`;
  };
}

interface ColorClassNames {
  bgColor: string;
  hoverBgColor: string;
  selectBgColor: string;
  textColor: string;
  selectTextColor: string;
  hoverTextColor: string;
  borderColor: string;
  selectBorderColor: string;
  hoverBorderColor: string;
  ringColor: string;
  strokeColor: string;
  fillColor: string;
}

/**
 * Returns boolean based on a determination that a color should be considered an "arbitrary"
 * Tailwind CSS class.
 * @see {@link https://tailwindcss.com/docs/background-color#arbitrary-values | Tailwind CSS docs}
 */
const getIsArbitraryColor = (color: Color | string) =>
  color.includes("#") || color.includes("--") || color.includes("rgb");

export function getColorClassNames(color: Color | string, shade?: number): ColorClassNames {
  const isBaseColor = getIsBaseColor(color);
  if (color === "white" || color === "black" || color === "transparent" || !shade || !isBaseColor) {
    const unshadedColor = !getIsArbitraryColor(color) ? color : `[${color}]`;
    return {
      bgColor: `bg-${unshadedColor} dark:bg-${unshadedColor}`,
      hoverBgColor: `hover:bg-${unshadedColor} dark:hover:bg-${unshadedColor}`,
      selectBgColor: `data-[selected]:bg-${unshadedColor} dark:data-[selected]:bg-${unshadedColor}`,
      textColor: `text-${unshadedColor} dark:text-${unshadedColor}`,
      selectTextColor: `data-[selected]:text-${unshadedColor} dark:data-[selected]:text-${unshadedColor}`,
      hoverTextColor: `hover:text-${unshadedColor} dark:hover:text-${unshadedColor}`,
      borderColor: `border-${unshadedColor} dark:border-${unshadedColor}`,
      selectBorderColor: `data-[selected]:border-${unshadedColor} dark:data-[selected]:border-${unshadedColor}`,
      hoverBorderColor: `hover:border-${unshadedColor} dark:hover:border-${unshadedColor}`,
      ringColor: `ring-${unshadedColor} dark:ring-${unshadedColor}`,
      strokeColor: `stroke-${unshadedColor} dark:stroke-${unshadedColor}`,
      fillColor: `fill-${unshadedColor} dark:fill-${unshadedColor}`,
    };
  }
  return {
    bgColor: `bg-${color}-${shade} dark:bg-${color}-${shade}`,
    selectBgColor: `data-[selected]:bg-${color}-${shade} dark:data-[selected]:bg-${color}-${shade}`,
    hoverBgColor: `hover:bg-${color}-${shade} dark:hover:bg-${color}-${shade}`,
    textColor: `text-${color}-${shade} dark:text-${color}-${shade}`,
    selectTextColor: `data-[selected]:text-${color}-${shade} dark:data-[selected]:text-${color}-${shade}`,
    hoverTextColor: `hover:text-${color}-${shade} dark:hover:text-${color}-${shade}`,
    borderColor: `border-${color}-${shade} dark:border-${color}-${shade}`,
    selectBorderColor: `data-[selected]:border-${color}-${shade} dark:data-[selected]:border-${color}-${shade}`,
    hoverBorderColor: `hover:border-${color}-${shade} dark:hover:border-${color}-${shade}`,
    ringColor: `ring-${color}-${shade} dark:ring-${color}-${shade}`,
    strokeColor: `stroke-${color}-${shade} dark:stroke-${color}-${shade}`,
    fillColor: `fill-${color}-${shade} dark:fill-${color}-${shade}`,
  };
}

```

### Core Architecture Module: `src/stories/chart-elements/helpers/utils.ts`
```
export const valueFormatter = (number: number) => {
  return Intl.NumberFormat("us").format(number).toString() + " $";
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1150** (2025-01-13): **fix: icon imports**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor-npm/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  Clean up icon imports.  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to ask. We're here to help! --> 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #pEpB6VgqGyAu2bnePh59ldNtoctjSltCWEMPsD6BZss=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3IiLCJyb290RGlyZWN0b3J5IjpudWxsLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdHJlbW9yL3RyZW1vci8yZ0tFMVFOelduY3lEUEQ0RTJ4dDdhQ0NNanE0IiwicHJldmlld1VybCI6InRyZW1vci1naXQtZml4LWljb24tdHJlbW9yLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiUEVORElORyIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItZ2l0LWZpeC1pY29uLXRyZW1vci52ZXJjZWwuYXBwIn19LHsibmFtZSI6InRyZW1vci1ucG0tc3Rvcnlib29rIiwicm9vdERpcmVjdG9yeSI6bnVsbCwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3RyZW1vci90cmVtb3ItbnBtLXN0b3J5Ym9vay9IUkpNVHRXQWgyZzVONG51R1pxNTU0cTFMdVdFIiwicHJldmlld1VybCI6InRyZW1vci1ucG0tc3Rvcnlib29rLWdpdC1maXgtaWNvbi10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtZml4LWljb24tdHJlbW9yLnZlcmNlbC5hcHAifX1dfQ==
  > :tada: This PR is included in version 3.18.7 :tada:  The release is available on: - [npm package (@latest dist-tag)](https://www.npmjs.com/package/@tremor/react/v/3.18.7) - [GitHub release](https://github.com/tremorlabs/tremor-npm/releases/tag/v3.18.7)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1149** (2025-01-11): **chore: readme date**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor-npm/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  <!--- Describe your changes in detail -->  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to ask. We're 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #LqIUukHYvpw8ev8pObBMVFsEHLtZsoQK92K9wqIOszc=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3IiLCJyb290RGlyZWN0b3J5IjpudWxsLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdHJlbW9yL3RyZW1vci84aUViZTZndmp1RDd0Mm82aXNyQks3VnBGUFFEIiwicHJldmlld1VybCI6InRyZW1vci1naXQtY2hvcmUtcmVhZG1lLWRhdGUtdHJlbW9yLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoidHJlbW9yLWdpdC1jaG9yZS1yZWFkbWUtZGF0ZS10cmVtb3IudmVyY2VsLmFwcCJ9fSx7Im5hbWUiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vayIsInJvb3REaXJlY3RvcnkiOm51bGwsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90cmVtb3IvdHJlbW9yLW5wbS1zdG9yeWJvb2svNDVkb2l4VE11RTRVcmJhUW41RVBDcGJMNEc2TiIsInByZXZpZXdVcmwiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtY2hvcmUtcmVhZG1lLWRhdGUtdHJlbW9yLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoidHJlbW9yLW5wbS1zdG9yeWJvb2stZ2l0LWNob3Jl
  > :tada: This PR is included in version 3.18.7 :tada:  The release is available on: - [npm package (@latest dist-tag)](https://www.npmjs.com/package/@tremor/react/v/3.18.7) - [GitHub release](https://github.com/tremorlabs/tremor-npm/releases/tag/v3.18.7)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1148** (2024-12-28): **chore: update urls**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  Update repository urls.  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to ask. We're here to help! -->  -
  **Post-Mortem & Fix Analysis**:
  > [vc]: #K8vlLfWot2Nxf0TL5WSFDpGVRNTzTqr+f/bIDQCA+GE=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3IiLCJyb290RGlyZWN0b3J5IjpudWxsLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdHJlbW9yL3RyZW1vci9HRjlocG9kTENIeGdQMUdSR2l0bk14ejJ4cFp4IiwicHJldmlld1VybCI6InRyZW1vci1naXQtY2hvcmUtdXJscy10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItZ2l0LWNob3JlLXVybHMtdHJlbW9yLnZlcmNlbC5hcHAifX0seyJuYW1lIjoidHJlbW9yLW5wbS1zdG9yeWJvb2siLCJyb290RGlyZWN0b3J5IjpudWxsLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdHJlbW9yL3RyZW1vci1ucG0tc3Rvcnlib29rLzZZMTJOdVBkTjZnN3JwWXFCdEVCYkxzTDVNS0IiLCJwcmV2aWV3VXJsIjoidHJlbW9yLW5wbS1zdG9yeWJvb2stZ2l0LWNob3JlLXVybHMtdHJlbW9yLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoidHJlbW9yLW5wbS1zdG9yeWJvb2stZ2l0LWNob3JlLXVybHMtdHJlbW9yLnZlcmNlbC5h
  > :tada: This PR is included in version 3.18.7 :tada:  The release is available on: - [npm package (@latest dist-tag)](https://www.npmjs.com/package/@tremor/react/v/3.18.7) - [GitHub release](https://github.com/tremorlabs/tremor-npm/releases/tag/v3.18.7)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1147** (2024-12-22): **chore: sync remote form**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #4pEf1WUU1ClAhKEmdSZRXf7Xodjq8848q7jy278Fwrk=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3IiLCJyb290RGlyZWN0b3J5IjpudWxsLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdHJlbW9yL3RyZW1vci8zODFEWmhuN1dIS3FINjZHUEZndDF0dWJzejFwIiwicHJldmlld1VybCI6IiIsIm5leHRDb21taXRTdGF0dXMiOiJGQUlMRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19LHsibmFtZSI6InRyZW1vci1ucG0tc3Rvcnlib29rIiwicm9vdERpcmVjdG9yeSI6bnVsbCwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3RyZW1vci90cmVtb3ItbnBtLXN0b3J5Ym9vay80VW5Vd1JyUk11bXR6RW1OVkR1Y3Z4V0RRcDdZIiwicHJldmlld1VybCI6IiIsIm5leHRDb21taXRTdGF0dXMiOiJGQUlMRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19XX0= **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | **tremor** | ❌ 

- **Issue #1146** (2024-12-28): **Beta tremor v4**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  <!--- Describe your changes in detail -->  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to ask. We're here
  **Post-Mortem & Fix Analysis**:
  > [vc]: #isCFOKlEaTnn22PGIaSO50yxMPAKyir7oG2WS/CSXWc=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vayIsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtYmV0YS10cmVtb3ItdjQtdHJlbW9yLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3RyZW1vci90cmVtb3ItbnBtLXN0b3J5Ym9vay8zbWRBR1Y4V0ZXWmd1aU1ZQzVEM0tyTTdwUFZ5IiwicHJldmlld1VybCI6InRyZW1vci1ucG0tc3Rvcnlib29rLWdpdC1iZXRhLXRyZW1vci12NC10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9LHsibmFtZSI6InRyZW1vciIsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItZ2l0LWJldGEtdHJlbW9yLXY0LXRyZW1vci52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90cmVtb3IvdHJlbW9yL0hDSm1LdGp3ODZNZGp6c3F6OFM5eGI4NTZhaFgiLCJwcmV2aWV3VXJsIjoidHJlbW9yLWdpdC1iZXRhLXRyZW1vci12NC10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21t
  > :tada: This PR is included in version 4.0.0-beta-tremor-v4.4 :tada:  The release is available on: - [npm package (@beta-tremor-v4 dist-tag)](https://www.npmjs.com/package/@tremor/react/v/4.0.0-beta-tremor-v4.4) - [GitHub release](https://github.com/tremorlabs/tremor/releases/tag/v4.0.0-beta-tremor-v4.4)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1145** (2024-12-13): **chore: Tremor v4 react19**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  <!--- Describe your changes in detail -->  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to ask. We're here
  **Post-Mortem & Fix Analysis**:
  > [vc]: #cJ6joZ3tMbXtZOKJ3ZZvq2+V7Sztk6Efr+ibX3REEb8=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vayIsInJvb3REaXJlY3RvcnkiOm51bGwsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90cmVtb3IvdHJlbW9yLW5wbS1zdG9yeWJvb2svRnZFVTJIN0JIWnFMNG5RaDhFWng0a3NtbkJ2MSIsInByZXZpZXdVcmwiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtdHJlbW9yLXY0LXJlYWN0MTktdHJlbW9yLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoidHJlbW9yLW5wbS1zdG9yeWJvb2stZ2l0LXRyZW1vci12NC1yZWFjdDE5LXRyZW1vci52ZXJjZWwuYXBwIn19LHsibmFtZSI6InRyZW1vciIsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItZ2l0LXRyZW1vci12NC1yZWFjdDE5LXRyZW1vci52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90cmVtb3IvdHJlbW9yL0NuZTNDOVpEWEdGU1NCZmhXTmY5ZkpXYjh6WUQiLCJwcmV2aWV3VXJsIjoidHJlbW9yLWdpdC10cmVtb3ItdjQtcmVhY3QxOS10cmVtb3IudmVyY2VsLmFw
  > :tada: This PR is included in version 4.0.0-beta-tremor-v4.3 :tada:  The release is available on: - [npm package (@beta-tremor-v4 dist-tag)](https://www.npmjs.com/package/@tremor/react/v/4.0.0-beta-tremor-v4.3) - [GitHub release](https://github.com/tremorlabs/tremor/releases/tag/v4.0.0-beta-tremor-v4.3)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1144** (2024-12-12): **feat!: Tremor v4**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  <!--- Describe your changes in detail -->  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [ ] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to ask. We're here
  **Post-Mortem & Fix Analysis**:
  > [vc]: #+XMkrvai7kL7Xr9l+FmMdt6269OqiZlcDMIH5UuWx+s=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vayIsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtZmVhdC10cmVtb3ItdjQtdml0ZS1zdG9yeWJvb2stdHJlbW9yLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3RyZW1vci90cmVtb3ItbnBtLXN0b3J5Ym9vay81U1lXcVB4Wlg0aVZVZlFIeTk0d0cybXBTOFZ0IiwicHJldmlld1VybCI6InRyZW1vci1ucG0tc3Rvcnlib29rLWdpdC1mZWF0LXRyZW1vci12NC12aXRlLXN0b3J5Ym9vay10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9LHsibmFtZSI6InRyZW1vciIsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItZ2l0LWZlYXQtdHJlbW9yLXY0LXZpdGUtc3Rvcnlib29rLXRyZW1vci52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90cmVtb3IvdHJlbW9yLzROM1J5eVcycmRyTm1XVjNrU1JHOVVjRFJFb3UiLCJwcmV2aWV3VXJsIjoidHJlbW9yLWdp

- **Issue #1143** (2024-12-07): **fix: minimum select width**
  *Symptoms*: <!-- Please make sure to read the Contribution Guidelines: https://github.com/tremorlabs/tremor/blob/main/CONTRIBUTING.md -->  <!-- PULL REQUEST TEMPLATE -->  **Description**  This PR adds w-[var(--button-width)] to all select options. **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [x] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  <!--- If you're unsure about any of these, don't hesitate to
  **Post-Mortem & Fix Analysis**:
  > [vc]: #uuGMPgPx1wmfEo+DILjQcTkGY6fxOX/p4VsEVe5Tsrc=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vayIsInJvb3REaXJlY3RvcnkiOm51bGwsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90cmVtb3IvdHJlbW9yLW5wbS1zdG9yeWJvb2svQm45NXp6aFQ5bUF4NDZickdqQ2J3bnhHOGJ3aSIsInByZXZpZXdVcmwiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtZml4LXNlbGVjdC13aWR0aC10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItbnBtLXN0b3J5Ym9vay1naXQtZml4LXNlbGVjdC13aWR0aC10cmVtb3IudmVyY2VsLmFwcCJ9fSx7Im5hbWUiOiJ0cmVtb3IiLCJyb290RGlyZWN0b3J5IjpudWxsLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdHJlbW9yL3RyZW1vci9EZjlpVUR6SnJLWmRSa1lXcU50cUJ5ODN5emg2IiwicHJldmlld1VybCI6InRyZW1vci1naXQtZml4LXNlbGVjdC13aWR0aC10cmVtb3IudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ0cmVtb3ItZ2l0LWZpeC1zZWxl
  > :tada: This PR is included in version 3.18.6 :tada:  The release is available on: - [npm package (@latest dist-tag)](https://www.npmjs.com/package/@tremor/react/v/3.18.6) - [GitHub release](https://github.com/tremorlabs/tremor/releases/tag/v3.18.6)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

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

### Incident Patch 1: `7613bff6` (2025-01-13)
**Commit Message**: fix: icon imports (#1150)

**File**: `src/components/icon-elements/Icon/Icon.tsx` (modified, +1/-2)
```diff
@@ -2,8 +2,7 @@
 import React from "react";
 
 import Tooltip, { useTooltip } from "components/util-elements/Tooltip/Tooltip";
-import { makeClassName, mergeRefs, Sizes, tremorTwMerge } from "lib";
-import { Color, IconVariant, Size } from "../../../lib";
+import { makeClassName, mergeRefs, Sizes, tremorTwMerge, Color, IconVariant, Size } from "lib";
 import { getIconColors, iconSizes, shape, wrapperProportions } from "./styles";
 
 const makeIconClassName = makeClassName("Icon");
```

**File**: `src/components/input-elements/Textarea/Textarea.tsx` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 "use client";
+
 import { getSelectButtonColors, hasValue } from "components/input-elements/selectUtils";
 import { useInternalState } from "hooks";
 
```

---

### Incident Patch 2: `252039b4` (2024-12-07)
**Commit Message**: fix: minimum select width (#1143)

**File**: `src/components/input-elements/DatePicker/DatePicker.tsx` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 "use client";
-import React, { useMemo } from "react";
 import { tremorTwMerge } from "lib";
+import React, { useMemo } from "react";
 import { DayPickerSingleProps } from "react-day-picker";
 
 import { startOfMonth, startOfToday } from "date-fns";
```

**File**: `src/components/input-elements/MultiSelect/MultiSelect.tsx` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@ const MultiSelect = React.forwardRef<HTMLInputElement, MultiSelectProps>((props,
                   anchor="bottom start"
                   className={tremorTwMerge(
                     // common
-                    "z-10 divide-y overflow-y-auto outline-none rounded-tremor-default max-h-[228px]  border [--anchor-gap:4px]",
+                    "z-10 divide-y w-[var(--button-width)] overflow-y-auto outline-none rounded-tremor-default max-h-[228px]  border [--anchor-gap:4px]",
                     // light
                     "bg-tremor-background border-tremor-border divide-tremor-border shadow-tremor-dropdown",
                     // dark
```

**File**: `src/components/input-elements/SearchSelect/SearchSelect.tsx` (modified, +9/-9)
```diff
@@ -1,7 +1,14 @@
 "use client";
-import React, { isValidElement, useMemo, useRef } from "react";
 import { useInternalState } from "hooks";
+import React, { isValidElement, useMemo, useRef } from "react";
 
+import {
+  Combobox,
+  ComboboxButton,
+  ComboboxInput,
+  ComboboxOptions,
+  Transition,
+} from "@headlessui/react";
 import { ArrowDownHeadIcon, XCircleIcon } from "assets";
 import { makeClassName, tremorTwMerge } from "lib";
 import {
@@ -10,13 +17,6 @@ import {
   getSelectButtonColors,
   hasValue,
 } from "../selectUtils";
-import {
-  Combobox,
-  ComboboxButton,
-  ComboboxInput,
-  ComboboxOptions,
-  Transition,
-} from "@headlessui/react";
 
 const makeSearchSelectClassName = makeClassName("SearchSelect");
 
@@ -237,7 +237,7 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
                     anchor="bottom start"
                     className={tremorTwMerge(
                       // common
-                      "z-10 divide-y overflow-y-auto outline-none rounded-tremor-default text-tremor-default max-h-[228px] border [--anchor-gap:4px]",
+                      "z-10 divide-y w-[var(--button-width)] overflow-y-auto outline-none rounded-tremor-default text-tremor-default max-h-[228px] border [--anchor-gap:4px]",
                       // light
                       "bg-tremor-background border-tremor-border divide-tremor-border shadow-tremor-dropdown",
                       // dark
```

**File**: `src/components/input-elements/Select/Select.tsx` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 "use client";
 
-import React, { isValidElement, useMemo, Children, useRef } from "react";
 import { ArrowDownHeadIcon, XCircleIcon } from "assets";
 import { makeClassName, tremorTwMerge } from "lib";
+import React, { Children, isValidElement, useMemo, useRef } from "react";
 import { constructValueToNameMapping, getSelectButtonColors, hasValue } from "../selectUtils";
 
 import { Listbox, ListboxButton, ListboxOptions, Transition } from "@headlessui/react";
@@ -199,7 +199,7 @@ const Select = React.forwardRef<HTMLInputElement, SelectProps>((props, ref) => {
                   anchor="bottom start"
                   className={tremorTwMerge(
                     // common
-                    "z-10 divide-y overflow-y-auto outline-none rounded-tremor-default max-h-[228px]  border [--anchor-gap:4px]",
+                    "z-10 w-[var(--button-width)] divide-y overflow-y-auto outline-none rounded-tremor-default max-h-[228px]  border [--anchor-gap:4px]",
                     // light
                     "bg-tremor-background border-tremor-border divide-tremor-border shadow-tremor-dropdown",
                     // dark
```

---

### Incident Patch 3: `6e346fcc` (2024-12-07)
**Commit Message**: fix: Upgrade HeadlessUI, new chart tests (#1142)

* fix: bump headlessui

* fix: dialog

* test: uts for areaChart, barChart, sparkAreaChart, Legend (#1065)

* uts for areaChart, barChart, sparkAreaChart, Legend

* removed test code

* lint

---------

Co-authored-by: severinlandolt <[REDACTED_EMAIL]>

* fix: datepicker position

* fix: selects

* chore: min width date picker

---------

Co-authored-by: Wajahat5 <[REDACTED_EMAIL]>

**File**: `.storybook/main.js` (modified, +0/-1)
```diff
@@ -10,7 +10,6 @@ module.exports = {
     "@storybook/addon-styling-webpack",
     "@storybook/addon-themes",
     "@storybook/addon-a11y",
-    "storybook-source-link",
     {
       name: "@storybook/addon-styling-webpack",
       options: {
```

**File**: `package.json` (modified, +19/-20)
```diff
@@ -25,8 +25,7 @@
   "homepage": "https://github.com/tremorlabs/tremor#readme",
   "dependencies": {
     "@floating-ui/react": "^0.19.2",
-    "@headlessui/react": "1.7.19",
-    "@headlessui/tailwindcss": "^0.2.1",
+    "@headlessui/react": "2.2.0",
     "date-fns": "^3.6.0",
     "react-day-picker": "^8.10.1",
     "react-transition-state": "^2.1.2",
@@ -38,7 +37,7 @@
     "@babel/preset-env": "^7.25.4",
     "@babel/preset-react": "^7.24.7",
     "@babel/preset-typescript": "^7.24.7",
-    "@chromatic-com/storybook": "^1.9.0",
+    "@chromatic-com/storybook": "^3.2.2",
     "@mdx-js/react": "^2.3.0",
     "@rollup/plugin-commonjs": "^21.1.0",
     "@rollup/plugin-node-resolve": "^13.3.0",
@@ -47,20 +46,21 @@
     "@semantic-release/commit-analyzer": "^13.0.0",
     "@semantic-release/github": "github:semantic-release/github",
     "@semantic-release/npm": "github:semantic-release/npm",
-    "@storybook/addon-a11y": "^8.3.3",
-    "@storybook/addon-actions": "^8.3.3",
-    "@storybook/addon-essentials": "^8.3.3",
-    "@storybook/addon-interactions": "^8.3.3",
-    "@storybook/addon-links": "^8.3.3",
-    "@storybook/addon-styling-webpack": "^1.0.0",
-    "@storybook/addon-themes": "^8.3.3",
+    "@storybook/addon-a11y": "^8.4.7",
+    "@storybook/addon-actions": "^8.4.7",
+    "@storybook/addon-essentials": "^8.4.7",
+    "@storybook/addon-interactions": "^8.4.7",
+    "@storybook/addon-links": "^8.4.7",
+    "@storybook/addon-styling-webpack": "^1.0.1",
+    "@storybook/addon-themes": "^8.4.7",
     "@storybook/addon-webpack5-compiler-babel": "^3.0.3",
-    "@storybook/manager-api": "^8.3.3",
+    "@storybook/manager-api": "^8.4.7",
     "@storybook/mdx2-csf": "^1.1.0",
-    "@storybook/react": "^8.3.3",
-    "@storybook/react-webpack5": "^8.3.3",
-    "@storybook/test": "^8.3.3",
-    "@storybook/theming": "^8.3.3",
+    "@storybook/react": "^8.4.7",
+    "@storybook/react-vite": "^8.4.7",
+    "@storybook/react-webpack5": "^8.4.7",
+    "@storybook/test": "^8.4.7",
+    "@storybook/theming": "^8.4.7",
     "@tailwindcss/forms": "^0.5.9",
     "@testing-library/react": "^14.3.1",
     "@types/jest": "^29.5.13",
@@ -84,7 +84,7 @@
     "jest-environment-jsdom": "^29.7.0",
     "postcss": "^8.4.47",
     "postcss-loader": "^7.3.4",
-    "prettier": "3.3.3",
+    "prettier": "3.4.2",
     "prop-types": "^15.8.1",
     "react": "^18.3.1",
     "react-dom": "^18.3.1",
@@ -96,13 +96,12 @@
     "rollup-plugin-preserve-directives": "^0.1.1",
     "rollup-plugin-typescript-paths": "^1.5.0",
     "semantic-release": "^24.1.1",
-    "storybook": "^8.3.3",
-    "storybook-source-link": "^4.0.1",
+    "storybook": "^8.4.7",
     "style-loader": "^3.3.4",
-    "tailwindcss": "^3.4.13",
+    "tailwindcss": "^3.4.16",
     "tslib": "^2.7.0",
     "typescript": "^4.9.5",
-    "webpack": "^5.94.0"
+    "webpack": "^5.97.1"
   },
   "peerDependencies": {
     "react": "^18.0.0",
```

**File**: `src/components/input-elements/DatePicker/DatePicker.tsx` (modified, +7/-7)
```diff
@@ -6,7 +6,7 @@ import { DayPickerSingleProps } from "react-day-picker";
 import { startOfMonth, startOfToday } from "date-fns";
 import { enUS } from "date-fns/locale";
 
-import { Popover, Transition } from "@headlessui/react";
+import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
 import { CalendarIcon, XCircleIcon } from "assets";
 import { Calendar } from "components/input-elements/Calendar";
 import { makeDatePickerClassName } from "components/input-elements/DatePicker/datePickerUtils";
@@ -91,7 +91,7 @@ const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>((props, ref
       )}
       {...other}
     >
-      <Popover.Button
+      <PopoverButton
         disabled={disabled}
         className={tremorTwMerge(
           // common
@@ -116,7 +116,7 @@ const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>((props, ref
           aria-hidden="true"
         />
         <p className="truncate">{formattedSelection}</p>
-      </Popover.Button>
+      </PopoverButton>
       {isClearEnabled && selectedValue ? (
         <button
           type="button"
@@ -141,18 +141,18 @@ const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>((props, ref
         </button>
       ) : null}
       <Transition
-        className="absolute z-10 min-w-min left-0"
         enter="transition ease duration-100 transform"
         enterFrom="opacity-0 -translate-y-4"
         enterTo="opacity-100 translate-y-0"
         leave="transition ease duration-100 transform"
         leaveFrom="opacity-100 translate-y-0"
         leaveTo="opacity-0 -translate-y-4"
       >
-        <Popover.Panel
+        <PopoverPanel
+          anchor="bottom start"
           className={tremorTwMerge(
             // common
-            "divide-y overflow-y-auto outline-none rounded-tremor-default p-3 border my-1",
+            "z-10 min-w-min divide-y overflow-y-auto outline-none rounded-tremor-default p-3 border [--anchor-gap:4px]",
             // light
             "bg-tremor-background border-tremor-border divide-tremor-border shadow-tremor-dropdown",
             // dark
@@ -178,7 +178,7 @@ const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>((props, ref
               enableYearNavigation={enableYearNavigation}
             />
           )}
-        </Popover.Panel>
+        </PopoverPanel>
       </Transition>
     </Popover>
   );
```

**File**: `src/components/input-elements/DateRangePicker/DateRangePicker.tsx` (modified, +21/-13)
```diff
@@ -1,6 +1,5 @@
 "use client";
 
-import { Listbox, Popover, Transition } from "@headlessui/react";
 import { CalendarIcon, XCircleIcon } from "assets";
 import { startOfMonth, startOfToday } from "date-fns";
 import { tremorTwMerge } from "lib";
@@ -26,6 +25,15 @@ import { SelectItem } from "components/input-elements/Select";
 import { enUS } from "date-fns/locale";
 import { useInternalState } from "hooks";
 import { Color } from "../../../lib/inputTypes";
+import {
+  Popover,
+  PopoverButton,
+  Transition,
+  PopoverPanel,
+  Listbox,
+  ListboxButton,
+  ListboxOptions,
+} from "@headlessui/react";
 
 const TODAY = startOfToday();
 
@@ -177,7 +185,7 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
         )}
       >
         <div className="relative w-full">
-          <Popover.Button
+          <PopoverButton
             onFocus={() => setIsCalendarButtonFocused(true)}
             onBlur={() => setIsCalendarButtonFocused(false)}
             disabled={disabled}
@@ -205,7 +213,7 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
               aria-hidden="true"
             />
             <p className="truncate">{formattedSelection}</p>
-          </Popover.Button>
+          </PopoverButton>
           {isClearEnabled && selectedStartDate ? (
             <button
               type="button"
@@ -232,19 +240,19 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
           ) : null}
         </div>
         <Transition
-          className="absolute z-10 min-w-min left-0"
           enter="transition ease duration-100 transform"
           enterFrom="opacity-0 -translate-y-4"
           enterTo="opacity-100 translate-y-0"
           leave="transition ease duration-100 transform"
           leaveFrom="opacity-100 translate-y-0"
           leaveTo="opacity-0 -translate-y-4"
         >
-          <Popover.Panel
+          <PopoverPanel
+            anchor="bottom start"
             focus={true}
             className={tremorTwMerge(
               // common
-              "divide-y overflow-y-auto outline-none rounded-tremor-default p-3 border my-1",
+              "min-w-min divide-y overflow-y-auto outline-none rounded-tremor-default p-3 border [--anchor-gap:4px]",
               // light
               "bg-tremor-background border-tremor-border divide-tremor-border shadow-tremor-dropdown",
               // dark
@@ -280,7 +288,7 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
               weekStartsOn={weekStartsOn}
               {...props}
             />
-          </Popover.Panel>
+          </PopoverPanel>
         </Transition>
       </Popover>
       {enableSelect && (
@@ -297,7 +305,7 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
         >
           {({ value }) => (
             <>
-              <Listbox.Button
+              <ListboxButton
                 onFocus={() => setIsSelectButtonFocused(true)}
                 onBlur={() => setIsSelectButtonFocused(false)}
                 className={tremorTwMerge(
@@ -311,20 +319,20 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
                 )}
               >
                 {value ? (valueToNameMapping.get(value) ?? selectPlaceholder) : selectPlaceholder}
-              </Listbox.Button>
+              </ListboxButton>
               <Transition
-                className="absolute z-10 w-full inset-x-0 right-0"
                 enter="transition ease duration-100 transform"
                 enterFrom="opacity-0 -translate-y-4"
                 enterTo="opacity-100 translate-y-0"
                 leave="transition ease duration-100 transform"
                 leaveFrom="opacity-100 translate-y-0"
                 leaveTo="opacity-0 -translate-y-4"
               >
-                <Listbox.Options
+                <ListboxOptions
+                  anchor="bottom end"
                   className={tremorTwMerge(
                     // common
-                    "divide-y overflow-y-auto outline-none border my-1",
+                    "[--anchor-gap:4px] divide-y overflow-y-auto outline-none border min-w-44",
                     // light
                     "shadow-tremor-dropdown bg-tremor-background border-tremor-border divide-tremor-border rounded-tremor-default",
                     // dark
@@ -337,7 +345,7 @@ const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>((
                         {option.text}
                       </SelectItem>
                     ))}
-                </Listbox.Options>
+                </ListboxOptions>
               </Transition>
             </>
           )}
```

**File**: `src/components/input-elements/DateRangePicker/DateRangePickerItem.tsx` (modified, +2/-2)
```diff
@@ -3,13 +3,13 @@ import React from "react";
 
 import { SelectItem } from "../Select";
 
-export interface DateRangePickerItemProps extends React.HTMLAttributes<HTMLLIElement> {
+export interface DateRangePickerItemProps extends React.HTMLAttributes<HTMLDivElement> {
   value: string;
   from: Date;
   to?: Date;
 }
 
-const DateRangePickerItem = React.forwardRef<HTMLLIElement, DateRangePickerItemProps>(
+const DateRangePickerItem = React.forwardRef<HTMLDivElement, DateRangePickerItemProps>(
   (props, ref) => {
     const { value, className, children, ...other } = props;
 
```

**File**: `src/components/input-elements/MultiSelect/MultiSelect.tsx` (modified, +7/-7)
```diff
@@ -3,10 +3,10 @@ import React, { isValidElement, useMemo, useRef, useState } from "react";
 import { SelectedValueContext } from "contexts";
 import { useInternalState } from "hooks";
 import { ArrowDownHeadIcon, SearchIcon, XCircleIcon } from "assets";
-import { Listbox, Transition } from "@headlessui/react";
 import XIcon from "assets/XIcon";
 import { makeClassName, tremorTwMerge } from "lib";
 import { getFilteredOptions, getSelectButtonColors } from "../selectUtils";
+import { Listbox, ListboxButton, ListboxOptions, Transition } from "@headlessui/react";
 
 const makeMultiSelectClassName = makeClassName("MultiSelect");
 
@@ -133,7 +133,7 @@ const MultiSelect = React.forwardRef<HTMLInputElement, MultiSelectProps>((props,
         >
           {({ value }) => (
             <>
-              <Listbox.Button
+              <ListboxButton
                 className={tremorTwMerge(
                   // common
                   "w-full outline-none text-left whitespace-nowrap truncate rounded-tremor-default focus:ring-2 transition duration-100 border pr-8 py-1.5",
@@ -229,7 +229,7 @@ const MultiSelect = React.forwardRef<HTMLInputElement, MultiSelectProps>((props,
                     )}
                   />
                 </span>
-              </Listbox.Button>
+              </ListboxButton>
 
               {hasSelection && !disabled ? (
                 <button
@@ -254,18 +254,18 @@ const MultiSelect = React.forwardRef<HTMLInputElement, MultiSelectProps>((props,
                 </button>
               ) : null}
               <Transition
-                className="absolute z-10 w-full"
                 enter="transition ease duration-100 transform"
                 enterFrom="opacity-0 -translate-y-4"
                 enterTo="opacity-100 translate-y-0"
                 leave="transition ease duration-100 transform"
                 leaveFrom="opacity-100 translate-y-0"
                 leaveTo="opacity-0 -translate-y-4"
               >
-                <Listbox.Options
+                <ListboxOptions
+                  anchor="bottom start"
                   className={tremorTwMerge(
                     // common
-                    "divide-y overflow-y-auto outline-none rounded-tremor-default max-h-[228px] left-0 border my-1",
+                    "z-10 divide-y overflow-y-auto outline-none rounded-tremor-default max-h-[228px]  border [--anchor-gap:4px]",
                     // light
                     "bg-tremor-background border-tremor-border divide-tremor-border shadow-tremor-dropdown",
                     // dark
@@ -322,7 +322,7 @@ const MultiSelect = React.forwardRef<HTMLInputElement, MultiSelectProps>((props,
                   >
                     {filteredOptions}
                   </SelectedValueContext.Provider>
-                </Listbox.Options>
+                </ListboxOptions>
               </Transition>
             </>
           )}
```

**File**: `src/components/input-elements/MultiSelect/MultiSelectItem.tsx` (modified, +8/-8)
```diff
@@ -2,31 +2,31 @@
 import { SelectedValueContext } from "contexts";
 import React, { useContext } from "react";
 import { isValueInArray, makeClassName, tremorTwMerge } from "lib";
-import { Listbox } from "@headlessui/react";
+import { ListboxOption } from "@headlessui/react";
 
 const makeMultiSelectItemClassName = makeClassName("MultiSelectItem");
 
-export interface MultiSelectItemProps extends React.HTMLAttributes<HTMLLIElement> {
+export interface MultiSelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
   value: string;
 }
 
-const MultiSelectItem = React.forwardRef<HTMLLIElement, MultiSelectItemProps>((props, ref) => {
+const MultiSelectItem = React.forwardRef<HTMLDivElement, MultiSelectItemProps>((props, ref) => {
   const { value, className, children, ...other } = props;
 
   const { selectedValue } = useContext(SelectedValueContext);
   const isSelected = isValueInArray(value, selectedValue);
 
   return (
-    <Listbox.Option
+    <ListboxOption
       className={tremorTwMerge(
         makeMultiSelectItemClassName("root"),
         // common
         "flex justify-start items-center cursor-default text-tremor-default p-2.5",
         // light
-        // "ui-active:bg-tremor-background-muted ui-active:text-tremor-content-strong ui-selected:text-tremor-content-strong ui-selected:bg-tremor-background-muted text-tremor-content-emphasis",
-        "ui-active:bg-tremor-background-muted ui-active:text-tremor-content-strong ui-selected:text-tremor-content-strong text-tremor-content-emphasis",
+        // "data-[focus]:bg-tremor-background-muted data-[focus]:text-tremor-content-strong data-[select]ed:text-tremor-content-strong data-[select]ed:bg-tremor-background-muted text-tremor-content-emphasis",
+        "data-[focus]:bg-tremor-background-muted data-[focus]:text-tremor-content-strong data-[select]ed:text-tremor-content-strong text-tremor-content-emphasis",
         // dark
-        "dark:ui-active:bg-dark-tremor-background-muted dark:ui-active:text-dark-tremor-content-strong dark:ui-selected:text-dark-tremor-content-strong dark:ui-selected:bg-dark-tremor-background-muted dark:text-dark-tremor-content-emphasis",
+        "dark:data-[focus]:bg-dark-tremor-background-muted dark:data-[focus]:text-dark-tremor-content-strong dark:data-[select]ed:text-dark-tremor-content-strong dark:data-[select]ed:bg-dark-tremor-background-muted dark:text-dark-tremor-content-emphasis",
         className,
       )}
       ref={ref}
@@ -49,7 +49,7 @@ const MultiSelectItem = React.forwardRef<HTMLLIElement, MultiSelectItemProps>((p
         readOnly={true}
       />
       <span className="whitespace-nowrap truncate">{children ?? value}</span>
-    </Listbox.Option>
+    </ListboxOption>
   );
 });
 
```

**File**: `src/components/input-elements/SearchSelect/SearchSelect.tsx` (modified, +15/-8)
```diff
@@ -1,7 +1,7 @@
 "use client";
 import React, { isValidElement, useMemo, useRef } from "react";
 import { useInternalState } from "hooks";
-import { Combobox, Transition } from "@headlessui/react";
+
 import { ArrowDownHeadIcon, XCircleIcon } from "assets";
 import { makeClassName, tremorTwMerge } from "lib";
 import {
@@ -10,6 +10,13 @@ import {
   getSelectButtonColors,
   hasValue,
 } from "../selectUtils";
+import {
+  Combobox,
+  ComboboxButton,
+  ComboboxInput,
+  ComboboxOptions,
+  Transition,
+} from "@headlessui/react";
 
 const makeSearchSelectClassName = makeClassName("SearchSelect");
 
@@ -134,7 +141,7 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
         >
           {({ value }) => (
             <>
-              <Combobox.Button className="w-full">
+              <ComboboxButton className="w-full">
                 {Icon && (
                   <span
                     className={tremorTwMerge(
@@ -155,7 +162,7 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
                   </span>
                 )}
 
-                <Combobox.Input
+                <ComboboxInput
                   ref={comboboxInputRef}
                   className={tremorTwMerge(
                     // common
@@ -193,7 +200,7 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
                     )}
                   />
                 </div>
-              </Combobox.Button>
+              </ComboboxButton>
 
               {enableClear && selectedValue ? (
                 <button
@@ -219,26 +226,26 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
               ) : null}
               {filteredOptions.length > 0 && (
                 <Transition
-                  className="absolute z-10 w-full"
                   enter="transition ease duration-100 transform"
                   enterFrom="opacity-0 -translate-y-4"
                   enterTo="opacity-100 translate-y-0"
                   leave="transition ease duration-100 transform"
                   leaveFrom="opacity-100 translate-y-0"
                   leaveTo="opacity-0 -translate-y-4"
                 >
-                  <Combobox.Options
+                  <ComboboxOptions
+                    anchor="bottom start"
                     className={tremorTwMerge(
                       // common
-                      "divide-y overflow-y-auto outline-none rounded-tremor-default text-tremor-default max-h-[228px] left-0 border my-1",
+                      "z-10 divide-y overflow-y-auto outline-none rounded-tremor-default text-tremor-default max-h-[228px] border [--anchor-gap:4px]",
                       // light
                       "bg-tremor-background border-tremor-border divide-tremor-border shadow-tremor-dropdown",
                       // dark
                       "dark:bg-dark-tremor-background dark:border-dark-tremor-border dark:divide-dark-tremor-border dark:shadow-dark-tremor-dropdown",
                     )}
                   >
                     {filteredOptions}
-                  </Combobox.Options>
+                  </ComboboxOptions>
                 </Transition>
               )}
             </>
```

---

### Incident Patch 4: `94d9f01b` (2024-11-09)
**Commit Message**: fix: bump recharts (#1140)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@
     "date-fns": "^3.6.0",
     "react-day-picker": "^8.10.1",
     "react-transition-state": "^2.1.2",
-    "recharts": "^2.12.7",
+    "recharts": "^2.13.3",
     "tailwind-merge": "^2.5.2"
   },
   "devDependencies": {
```

**File**: `pnpm-lock.yaml` (modified, +12/-7)
```diff
@@ -27,8 +27,8 @@ importers:
         specifier: ^2.1.2
         version: 2.1.2(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       recharts:
-        specifier: ^2.12.7
-        version: 2.12.7(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        specifier: ^2.13.3
+        version: 2.13.3(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       tailwind-merge:
         specifier: ^2.5.2
         version: 2.5.2
@@ -1862,6 +1862,9 @@ packages:
   '@types/qs@6.9.16':
     resolution: {integrity: sha512-7i+zxXdPD0T4cKDuxCUXJ4wHcsJLwENa6Z3dCu8cfCK743OGy5Nu1RmAGqDPsoTDINVEcdXKRvR/zre+P2Ku1A==}
 
+  '@types/qs@6.9.17':
+    resolution: {integrity: sha512-rX4/bPcfmvxHDv0XjfJELTTr+iB+tn032nPILqHm5wbthUUUuVtNGGqzhya9XUxjTP8Fpr0qYgSZZKxGY++svQ==}
+
   '@types/range-parser@1.2.7':
     resolution: {integrity: sha512-hKormJbkJqzQGhziax5PItDUTMAM9uE2XXQmM37dyd4hVM+5aVl7oVxMVUiVQn2oCQFN/LKCZdvSM0pFRqbSmQ==}
 
@@ -5241,8 +5244,8 @@ packages:
   recharts-scale@0.4.5:
     resolution: {integrity: sha512-kivNFO+0OcUNu7jQquLXAxz1FIwZj8nrj+YkOKc5694NbjCvcT6aSZiIzNzd2Kul4o4rTto8QVR9lMNtxD4G1w==}
 
-  recharts@2.12.7:
-    resolution: {integrity: sha512-hlLJMhPQfv4/3NBSAyq3gzGg4h2v69RJh6KU7b3pXYNNAELs9kEoXOjbkxdXpALqKBoVmVptGfLpxdaVYqjmXQ==}
+  recharts@2.13.3:
+    resolution: {integrity: sha512-YDZ9dOfK9t3ycwxgKbrnDlRC4BHdjlY73fet3a0C1+qGMjXVZe6+VXmpOIIhzkje5MMEL8AN4hLIe4AMskBzlA==}
     engines: {node: '>=14'}
     peerDependencies:
       react: ^16.0.0 || ^17.0.0 || ^18.0.0
@@ -8078,7 +8081,7 @@ snapshots:
       '@storybook/csf': 0.1.11
       '@storybook/global': 5.0.0
       '@storybook/types': 7.4.6
-      '@types/qs': 6.9.16
+      '@types/qs': 6.9.17
       dequal: 2.0.3
       lodash: 4.17.21
       memoizerific: 1.11.3
@@ -8425,6 +8428,8 @@ snapshots:
 
   '@types/qs@6.9.16': {}
 
+  '@types/qs@6.9.17': {}
+
   '@types/range-parser@1.2.7': {}
 
   '@types/react-dom@18.3.0':
@@ -12204,14 +12209,14 @@ snapshots:
     dependencies:
       decimal.js-light: 2.5.1
 
-  recharts@2.12.7(react-dom@18.3.1(react@18.3.1))(react@18.3.1):
+  recharts@2.13.3(react-dom@18.3.1(react@18.3.1))(react@18.3.1):
     dependencies:
       clsx: 2.1.1
       eventemitter3: 4.0.7
       lodash: 4.17.21
       react: 18.3.1
       react-dom: 18.3.1(react@18.3.1)
-      react-is: 16.13.1
+      react-is: 18.3.1
       react-smooth: 4.0.1(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       recharts-scale: 0.4.5
       tiny-invariant: 1.3.3
```

---

### Incident Patch 5: `b1ac6981` (2024-09-24)
**Commit Message**: fix: beta workflows (#1137)

* fix: Update release.yaml (#1136)

* Update release.yaml

* semantic release

* fix: update build workflow

**File**: `.github/workflows/build.yaml` (modified, +3/-3)
```diff
@@ -17,11 +17,11 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: checkout
-        uses: actions/checkout@v2.4.2
+        uses: actions/checkout@v4
       - name: node
-        uses: actions/setup-node@v3.4.1
+        uses: actions/setup-node@v4
         with:
-          node-version: 18
+          node-version: 20
           registry-url: https://registry.npmjs.org
       - name: install react
         run: npm i react
```

**File**: `.github/workflows/release.yaml` (modified, +3/-3)
```diff
@@ -13,11 +13,11 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: checkout
-        uses: actions/checkout@v2.4.2
+        uses: actions/checkout@v4
       - name: node
-        uses: actions/setup-node@v3.4.1
+        uses: actions/setup-node@v4
         with:
-          node-version: 18
+          node-version: 20
           registry-url: https://registry.npmjs.org
       - name: install react
         run: npm i react
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -15,7 +15,7 @@
   },
   "repository": {
     "type": "git",
-    "url": "https://github.com/tremorlabs/tremor.git"
+    "url": "git+https://github.com/tremorlabs/tremor.git"
   },
   "author": "tremor",
   "license": "Apache 2.0",
@@ -44,7 +44,7 @@
     "@rollup/plugin-node-resolve": "^13.3.0",
     "@rollup/plugin-terser": "^0.4.4",
     "@rollup/plugin-typescript": "^8.5.0",
-    "@semantic-release/commit-analyzer": "^9.0.2",
+    "@semantic-release/commit-analyzer": "^13.0.0",
     "@semantic-release/github": "github:semantic-release/github",
     "@semantic-release/npm": "github:semantic-release/npm",
     "@storybook/addon-a11y": "^8.3.3",
```

**File**: `pnpm-lock.yaml` (modified, +2/-333)
```diff
@@ -64,8 +64,8 @@ importers:
         specifier: ^8.5.0
         version: 8.5.0(rollup@2.79.1)(tslib@2.7.0)(typescript@4.9.5)
       '@semantic-release/commit-analyzer':
-        specifier: ^9.0.2
-        version: 9.0.2(semantic-release@24.1.1(typescript@4.9.5))
+        specifier: ^13.0.0
+        version: 13.0.0(semantic-release@24.1.1(typescript@4.9.5))
       '@semantic-release/github':
         specifier: github:semantic-release/github
         version: https://codeload.github.com/semantic-release/github/tar.gz/b6ed55ed8636b492854bec5dabbe01ab3ef73feb(semantic-release@24.1.1(typescript@4.9.5))
@@ -1358,12 +1358,6 @@ packages:
     peerDependencies:
       semantic-release: '>=20.1.0'
 
-  '@semantic-release/commit-analyzer@9.0.2':
-    resolution: {integrity: sha512-E+dr6L+xIHZkX4zNMe6Rnwg4YQrWNXK+rNsvwOPpdFppvZO1olE2fIgWhv89TkQErygevbjsZFSIxp+u6w2e5g==}
-    engines: {node: '>=14.17'}
-    peerDependencies:
-      semantic-release: '>=18.0.0-beta.1'
-
   '@semantic-release/error@4.0.0':
     resolution: {integrity: sha512-mgdxrHTLOjOddRVYIYDo0fR3/v61GNN1YGkfbrjuIKg/uMgCd+Qzo3UAXJ+woLQQpos4pl5Esuw5A7AoNlzjUQ==}
     engines: {node: '>=18'}
@@ -1853,9 +1847,6 @@ packages:
   '@types/mime@1.3.5':
     resolution: {integrity: sha512-/pyBZWSLD2n0dcHE3hq8s8ZvcETHtEuF+3E7XVt0Ig2nvsVQXdghHVcEkIWjy9A0wKfTn97a/PSDYohKIlnP/w==}
 
-  '@types/minimist@1.2.5':
-    resolution: {integrity: sha512-hov8bUuiLiyFPGyFPE1lwWhmzYbirOXQNNo40+y3zow8aFVTeyn3VWL0VFFfdNddA8S4Vf0Tc062rzyNr7Paag==}
-
   '@types/node@22.6.1':
     resolution: {integrity: sha512-V48tCfcKb/e6cVUigLAaJDAILdMP0fUW6BidkPK4GpGjXcfbnoHasCZDwz3N3yVt5we2RHm4XTQCpv0KJz9zqw==}
 
@@ -2045,10 +2036,6 @@ packages:
   '@xtuc/long@4.2.2':
     resolution: {integrity: sha512-NuHqBY1PB/D8xU6s/thBgOAiAP7HOYDQ32+BFZILJ8ivkUkAHQnWfn6WhL79Owj1qmUnoN/YPhktdIoucipkAQ==}
 
-  JSONStream@1.3.5:
-    resolution: {integrity: sha512-E+iruNOY8VV9s4JEbe1aNEm6MiszPRr/UfcHMz0TQh1BXSxHK+ASV1R6W4HpjBhSeS+54PIsAMCBmwD06LLsqQ==}
-    hasBin: true
-
   abab@2.0.6:
     resolution: {integrity: sha512-j2afSsaIENvHZN2B8GOpF566vZ5WVk5opAiMTvWgaQT8DkbOqsTfvNAvHoRGU2zzP8cPoqys+xHTRDWW8L+/BA==}
     deprecated: Use your platform's native atob() and btoa() methods instead
@@ -2228,10 +2215,6 @@ packages:
     resolution: {integrity: sha512-bMxMKAjg13EBSVscxTaYA4mRc5t1UAXa2kXiGTNfZ079HIWXEkKmkgFrh/nJqamaLSrXO5H4WFFkPEaLJWbs3A==}
     engines: {node: '>= 0.4'}
 
-  arrify@1.0.1:
-    resolution: {integrity: sha512-3CYzex9M9FGQjCGMGyi6/31c8GJbgb0qGyrx5HWxPd0aCwh4cB2YjMb2Xf9UuoogrMrlO9cTqnB5rI5GHZTcUA==}
-    engines: {node: '>=0.10.0'}
-
   assertion-error@2.0.1:
     resolution: {integrity: sha512-Izi8RQcffqCeNVgFigKli1ssklIbpHnCYc6AknXGYoB6grJqyeby7jv12JUQgmTAnIDnbck1uxksT4dzN3PWBA==}
     engines: {node: '>=12'}
@@ -2402,10 +2385,6 @@ packages:
     resolution: {integrity: sha512-QOSvevhslijgYwRx6Rv7zKdMF8lbRmx+uQGx2+vDc+KI/eBnsy9kit5aj23AgGu3pa4t9AgwbnXWqS+iOY+2aA==}
     engines: {node: '>= 6'}
 
-  camelcase-keys@6.2.2:
-    resolution: {integrity: sha512-YrwaA0vEKazPBkn0ipTiMpSajYDSe+KjQfrjhcBMxJt/znbvlHd8Pw/Vamaz5EB4Wfhs3SUR3Z9mwRu/P3s3Yg==}
-    engines: {node: '>=8'}
-
   camelcase@5.3.1:
     resolution: {integrity: sha512-L28STB170nwWS63UjtlEOE3dldQApaJXZkOI1uMFfzf3rRuPegHaHesyee+YxQ+W6SvRDQV6UrdOdRiR153wJg==}
     engines: {node: '>=6'}
@@ -2584,10 +2563,6 @@ packages:
     resolution: {integrity: sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==}
     engines: {node: '>= 0.6'}
 
-  conventional-changelog-angular@5.0.13:
-    resolution: {integrity: sha512-i/gipMxs7s8L/QeuavPF2hLnJgH6pEZAttySB6aiQLWcX3puWDL3ACVmvBhJGxnAy52Qc15ua26BufY6KpmrVA==}
-    engines: {node: '>=10'}
-
   conventional-changelog-angular@8.0.0:
     resolution: {integrity: sha512-CLf+zr6St0wIxos4bmaKHRXWAcsCXrJU6F4VdNDrGRK3B8LDLKoX3zuMV5GhtbGkVR/LohZ6MT6im43vZLSjmA==}
     engines: {node: '>=18'}
@@ -2601,19 +2576,10 @@ packages:
     engines: {node: '>=18'}
     hasBin: true
 
-  conventional-commits-filter@2.0.7:
-    resolution: {integrity: sha512-ASS9SamOP4TbCClsRHxIHXRfcGCnIoQqkvAzCSbZzTFLfcTqJVugB0agRgsEELsqaeWgsXv513eS116wnlSSPA==}
-    engines: {node: '>=10'}
-
   conventional-commits-filter@5.0.0:
     resolution: {integrity: sha512-tQMagCOC59EVgNZcC5zl7XqO30Wki9i9J3acbUvkaosCT6JX3EeFwJD7Qqp4MCikRnzS18WXV3BLIQ66ytu6+Q==}
     engines: {node: '>=18'}
 
-  conventional-commits-parser@3.2.4:
-    resolution: {integrity: sha512-nK7sAtfi+QXbxHCYfhpZsfRtaitZLIA6889kFIouLvz6repszQDgxBu7wf2WbU+Dco7sAnNCJYERCwt54WPC2Q==}
-    engines: {node: '>=10'}
-    hasBin: true
-
   conventional-commits-parser@6.0.0:
     resolution: {integrity: sha512-TbsINLp48XeMXR8EvGjTnKGsZqBemisPoyWESlpRyR8lif0lcwzqz+NMtYSj1ooF/WYjSuu7wX0CtdeeMEQAmA==}
     engines: {node: '>=18'}
@@ -2829,14 +2795,6 @@ packages:
       supports-color:
         optional: true
 
-  decamelize-keys@1.1.1:
-    resolution: {integrity: sha512-WiPxgEirIV0/eIOMcnFBA3/IJZAZqKnwAwWyvvdi4lsr1WCN22nhdf/3db3DoZcUjTV
```

---

### Incident Patch 6: `efdaee1a` (2024-09-24)
**Commit Message**: fix: update storybook and semantic-release (#1135)

**File**: `package.json` (modified, +18/-18)
```diff
@@ -47,27 +47,27 @@
     "@semantic-release/commit-analyzer": "^9.0.2",
     "@semantic-release/github": "github:semantic-release/github",
     "@semantic-release/npm": "github:semantic-release/npm",
-    "@storybook/addon-a11y": "^8.3.2",
-    "@storybook/addon-actions": "^8.3.2",
-    "@storybook/addon-essentials": "^8.3.2",
-    "@storybook/addon-interactions": "^8.3.2",
-    "@storybook/addon-links": "^8.3.2",
+    "@storybook/addon-a11y": "^8.3.3",
+    "@storybook/addon-actions": "^8.3.3",
+    "@storybook/addon-essentials": "^8.3.3",
+    "@storybook/addon-interactions": "^8.3.3",
+    "@storybook/addon-links": "^8.3.3",
     "@storybook/addon-styling-webpack": "^1.0.0",
-    "@storybook/addon-themes": "^8.3.2",
+    "@storybook/addon-themes": "^8.3.3",
     "@storybook/addon-webpack5-compiler-babel": "^3.0.3",
-    "@storybook/manager-api": "^8.3.2",
+    "@storybook/manager-api": "^8.3.3",
     "@storybook/mdx2-csf": "^1.1.0",
-    "@storybook/react": "^8.3.2",
-    "@storybook/react-webpack5": "^8.3.2",
-    "@storybook/test": "^8.3.2",
-    "@storybook/theming": "^8.3.2",
+    "@storybook/react": "^8.3.3",
+    "@storybook/react-webpack5": "^8.3.3",
+    "@storybook/test": "^8.3.3",
+    "@storybook/theming": "^8.3.3",
     "@tailwindcss/forms": "^0.5.9",
     "@testing-library/react": "^14.3.1",
     "@types/jest": "^29.5.13",
-    "@types/node": "^22.5.5",
-    "@types/react": "^18.3.8",
-    "@typescript-eslint/eslint-plugin": "^8.6.0",
-    "@typescript-eslint/parser": "^8.6.0",
+    "@types/node": "^22.6.1",
+    "@types/react": "^18.3.9",
+    "@typescript-eslint/eslint-plugin": "^8.7.0",
+    "@typescript-eslint/parser": "^8.7.0",
     "autoprefixer": "^10.4.20",
     "babel-jest": "^27.5.1",
     "babel-loader": "^8.4.1",
@@ -95,11 +95,11 @@
     "rollup-plugin-postcss": "^4.0.2",
     "rollup-plugin-preserve-directives": "^0.1.1",
     "rollup-plugin-typescript-paths": "^1.5.0",
-    "semantic-release": "^22.0.12",
-    "storybook": "^8.3.2",
+    "semantic-release": "^24.1.1",
+    "storybook": "^8.3.3",
     "storybook-source-link": "^4.0.1",
     "style-loader": "^3.3.4",
-    "tailwindcss": "^3.4.12",
+    "tailwindcss": "^3.4.13",
     "tslib": "^2.7.0",
     "typescript": "^4.9.5",
     "webpack": "^5.94.0"
```

---

### Incident Patch 7: `59f970ec` (2024-09-24)
**Commit Message**: fix: update packages (#1134)

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ## **Contributing to Tremor**
 
-Thanks for your interest in contributing to Tremor. Please take a moment to review this document before submitting a pull request. This document will outline how to submit changes to this repository and which conventions to follow. If you are ever in doubt about anything we encourage you to reach out on [Slack](https://join.slack.com/t/tremor-community/shared_invite/zt-1u8jqmcmq-Fdr9B6MbnO7u8FkGh~2Ylg), [open a discussion](#discussions), or [shoot us an email](mailto:hello@tremor.so).
+Thanks for your interest in contributing to Tremor. Please take a moment to review this document before submitting a pull request. This document will outline how to submit changes to this repository and which conventions to follow. If you are ever in doubt about anything we encourage you to reach out on [Slack](https://tremor-community.slack.com/join/shared_invite/zt-2a95vjndc-YCKurK3HVAkYtjialnT2_A#/shared-invite/email), [open a discussion](#discussions), or [shoot us an email](mailto:hello@tremor.so).
 
 ### **Prerequisites**
 
```

**File**: `package.json` (modified, +30/-30)
```diff
@@ -31,14 +31,14 @@
     "react-day-picker": "^8.10.1",
     "react-transition-state": "^2.1.2",
     "recharts": "^2.12.7",
-    "tailwind-merge": "^1.14.0"
+    "tailwind-merge": "^2.5.2"
   },
   "devDependencies": {
     "@babel/core": "^7.25.2",
     "@babel/preset-env": "^7.25.4",
     "@babel/preset-react": "^7.24.7",
     "@babel/preset-typescript": "^7.24.7",
-    "@chromatic-com/storybook": "^1.7.0",
+    "@chromatic-com/storybook": "^1.9.0",
     "@mdx-js/react": "^2.3.0",
     "@rollup/plugin-commonjs": "^21.1.0",
     "@rollup/plugin-node-resolve": "^13.3.0",
@@ -47,43 +47,43 @@
     "@semantic-release/commit-analyzer": "^9.0.2",
     "@semantic-release/github": "github:semantic-release/github",
     "@semantic-release/npm": "github:semantic-release/npm",
-    "@storybook/addon-a11y": "^8.2.9",
-    "@storybook/addon-actions": "^8.2.9",
-    "@storybook/addon-essentials": "^8.2.9",
-    "@storybook/addon-interactions": "^8.2.9",
-    "@storybook/addon-links": "^8.2.9",
+    "@storybook/addon-a11y": "^8.3.2",
+    "@storybook/addon-actions": "^8.3.2",
+    "@storybook/addon-essentials": "^8.3.2",
+    "@storybook/addon-interactions": "^8.3.2",
+    "@storybook/addon-links": "^8.3.2",
     "@storybook/addon-styling-webpack": "^1.0.0",
-    "@storybook/addon-themes": "^8.2.9",
+    "@storybook/addon-themes": "^8.3.2",
     "@storybook/addon-webpack5-compiler-babel": "^3.0.3",
-    "@storybook/manager-api": "^8.2.9",
+    "@storybook/manager-api": "^8.3.2",
     "@storybook/mdx2-csf": "^1.1.0",
-    "@storybook/react": "^8.2.9",
-    "@storybook/react-webpack5": "^8.2.9",
-    "@storybook/test": "^8.2.9",
-    "@storybook/theming": "^8.2.9",
-    "@tailwindcss/forms": "^0.5.8",
-    "@testing-library/react": "^14.1.2",
-    "@types/jest": "^29.5.12",
-    "@types/node": "^22.5.1",
-    "@types/react": "^18.3.4",
-    "@typescript-eslint/eslint-plugin": "^8.3.0",
-    "@typescript-eslint/parser": "^8.3.0",
+    "@storybook/react": "^8.3.2",
+    "@storybook/react-webpack5": "^8.3.2",
+    "@storybook/test": "^8.3.2",
+    "@storybook/theming": "^8.3.2",
+    "@tailwindcss/forms": "^0.5.9",
+    "@testing-library/react": "^14.3.1",
+    "@types/jest": "^29.5.13",
+    "@types/node": "^22.5.5",
+    "@types/react": "^18.3.8",
+    "@typescript-eslint/eslint-plugin": "^8.6.0",
+    "@typescript-eslint/parser": "^8.6.0",
     "autoprefixer": "^10.4.20",
     "babel-jest": "^27.5.1",
-    "babel-loader": "^8.3.0",
+    "babel-loader": "^8.4.1",
     "conventional-changelog-conventionalcommits": "^5.0.0",
-    "css-loader": "^6.8.1",
-    "eslint": "^8.57.0",
+    "css-loader": "^6.11.0",
+    "eslint": "^8.57.1",
     "eslint-config-prettier": "^9.1.0",
     "eslint-plugin-prettier": "^5.2.1",
-    "eslint-plugin-react": "^7.35.0",
+    "eslint-plugin-react": "^7.36.1",
     "eslint-plugin-react-hooks": "^4.6.2",
     "html-webpack-plugin": "^5.6.0",
     "identity-obj-proxy": "^3.0.0",
     "jest": "^29.7.0",
     "jest-environment-jsdom": "^29.7.0",
-    "postcss": "^8.4.41",
-    "postcss-loader": "^7.3.3",
+    "postcss": "^8.4.47",
+    "postcss-loader": "^7.3.4",
     "prettier": "3.3.3",
     "prop-types": "^15.8.1",
     "react": "^18.3.1",
@@ -95,11 +95,11 @@
     "rollup-plugin-postcss": "^4.0.2",
     "rollup-plugin-preserve-directives": "^0.1.1",
     "rollup-plugin-typescript-paths": "^1.5.0",
-    "semantic-release": "^22.0.8",
-    "storybook": "^8.2.9",
+    "semantic-release": "^22.0.12",
+    "storybook": "^8.3.2",
     "storybook-source-link": "^4.0.1",
-    "style-loader": "^3.3.3",
-    "tailwindcss": "^3.4.10",
+    "style-loader": "^3.3.4",
+    "tailwindcss": "^3.4.12",
     "tslib": "^2.7.0",
     "typescript": "^4.9.5",
     "webpack": "^5.94.0"
```

**File**: `src/lib/tremorTwMerge.ts` (modified, +33/-31)
```diff
@@ -1,36 +1,38 @@
 import { extendTailwindMerge } from "tailwind-merge";
 
 export const tremorTwMerge = extendTailwindMerge({
-  classGroups: {
-    boxShadow: [
-      {
-        shadow: [
-          {
-            tremor: ["input", "card", "dropdown"],
-            "dark-tremor": ["input", "card", "dropdown"],
-          },
-        ],
-      },
-    ],
-    borderRadius: [
-      {
-        rounded: [
-          {
-            tremor: ["small", "default", "full"],
-            "dark-tremor": ["small", "default", "full"],
-          },
-        ],
-      },
-    ],
-    fontSize: [
-      {
-        text: [
-          {
-            tremor: ["default", "title", "metric"],
-            "dark-tremor": ["default", "title", "metric"],
-          },
-        ],
-      },
-    ],
+  extend: {
+    classGroups: {
+      shadow: [
+        {
+          shadow: [
+            {
+              tremor: ["input", "card", "dropdown"],
+              "dark-tremor": ["input", "card", "dropdown"],
+            },
+          ],
+        },
+      ],
+      rounded: [
+        {
+          rounded: [
+            {
+              tremor: ["small", "default", "full"],
+              "dark-tremor": ["small", "default", "full"],
+            },
+          ],
+        },
+      ],
+      "font-size": [
+        {
+          text: [
+            {
+              tremor: ["default", "title", "metric"],
+              "dark-tremor": ["default", "title", "metric"],
+            },
+          ],
+        },
+      ],
+    },
   },
 });
```

---

### Incident Patch 8: `891a619c` (2024-09-15)
**Commit Message**: fix: <AreaChart /> Doesn't Display Gradient in Firefox Bug (#1132)

* fix: area chart linting and firefox id issue

---------

Co-authored-by: severinlandolt <[REDACTED_EMAIL]>

**File**: `src/components/chart-elements/AreaChart/AreaChart.tsx` (modified, +84/-80)
```diff
@@ -292,6 +292,7 @@ const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, ref)
               />
             ) : null}
             {categories.map((category) => {
+              const gradientId = (categoryColors.get(category) ?? BaseColors.Gray).replace("#", "");
               return (
                 <defs key={category}>
                   {showGradient ? (
@@ -302,7 +303,7 @@ const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, ref)
                           colorPalette.text,
                         ).textColor
                       }
-                      id={categoryColors.get(category)}
+                      id={gradientId}
                       x1="0"
                       y1="0"
                       x2="0"
@@ -325,7 +326,7 @@ const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, ref)
                           colorPalette.text,
                         ).textColor
                       }
-                      id={categoryColors.get(category)}
+                      id={gradientId}
                       x1="0"
                       y1="0"
                       x2="0"
@@ -342,68 +343,22 @@ const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, ref)
                 </defs>
               );
             })}
-            {categories.map((category) => (
-              <Area
-                className={
-                  getColorClassNames(
-                    categoryColors.get(category) ?? BaseColors.Gray,
-                    colorPalette.text,
-                  ).strokeColor
-                }
-                strokeOpacity={activeDot || (activeLegend && activeLegend !== category) ? 0.3 : 1}
-                activeDot={(props: any) => {
-                  const { cx, cy, stroke, strokeLinecap, strokeLinejoin, strokeWidth, dataKey } =
-                    props;
-                  return (
-                    <Dot
-                      className={tremorTwMerge(
-                        "stroke-tremor-background dark:stroke-dark-tremor-background",
-                        onValueChange ? "cursor-pointer" : "",
-                        getColorClassNames(
-                          categoryColors.get(dataKey) ?? BaseColors.Gray,
-                          colorPalette.text,
-                        ).fillColor,
-                      )}
-                      cx={cx}
-                      cy={cy}
-                      r={5}
-                      fill=""
-                      stroke={stroke}
-                      strokeLinecap={strokeLinecap}
-                      strokeLinejoin={strokeLinejoin}
-                      strokeWidth={strokeWidth}
-                      onClick={(dotProps: any, event) => onDotClick(props, event)}
-                    />
-                  );
-                }}
-                dot={(props: any) => {
-                  const {
-                    stroke,
-                    strokeLinecap,
-                    strokeLinejoin,
-                    strokeWidth,
-                    cx,
-                    cy,
-                    dataKey,
-                    index,
-                  } = props;
-
-                  if (
-                    (hasOnlyOneValueForThisKey(data, category) &&
-                      !(activeDot || (activeLegend && activeLegend !== category))) ||
-                    (activeDot?.index === index && activeDot?.dataKey === category)
-                  ) {
+            {categories.map((category) => {
+              const gradientId = (categoryColors.get(category) ?? BaseColors.Gray).replace("#", "");
+              return (
+                <Area
+                  className={
+                    getColorClassNames(
+                      categoryColors.get(category) ?? BaseColors.Gray,
+                      colorPalette.text,
+                    ).strokeColor
+                  }
+                  strokeOpacity={activeDot || (activeLegend && activeLegend !== category) ? 0.3 : 1}
+                  activeDot={(props: any) => {
+                    const { cx, cy, stroke, strokeLinecap, strokeLinejoin, strokeWidth, dataKey } =
+                      props;
                     return (
                       <Dot
-                        key={index}
-                        cx={cx}
-                        cy={cy}
-                        r={5}
-                        stroke={stroke}
-                        fill=""
-                        strokeLinecap={strokeLinecap}
-                        strokeLinejoin={strokeLinejoin}
-                        strokeWidth={strokeWidth}
                         className={tremorTwMerge(
                           "stroke-tremor-background dark:stroke-dark-tremor-background",
                           onValueChange ? "cursor-pointer" : "",
@@ -412,26 +367,75 @@ const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, ref)
                             colorPalette.text,
        
```

---

### Incident Patch 9: `c7df68f2` (2024-09-07)
**Commit Message**: fix: remove console info (#1131)

**File**: `src/components/chart-elements/AreaChart/AreaChart.tsx` (modified, +0/-6)
```diff
@@ -139,12 +139,6 @@ const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, ref)
     }
     setActiveDot(undefined);
   }
-
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The AreaChart is also available as a copy-and-paste component. Visit https://tremor.so/docs/visualizations/area-chart (This is only shown in development)",
-    );
-  }
   return (
     <div ref={ref} className={tremorTwMerge("w-full h-80", className)} {...other}>
       <ResponsiveContainer className="h-full w-full">
```

**File**: `src/components/chart-elements/BarChart/BarChart.tsx` (modified, +0/-5)
```diff
@@ -144,11 +144,6 @@ const BarChart = React.forwardRef<HTMLDivElement, BarChartProps>((props, ref) =>
     setActiveBar(undefined);
   }
   const yAxisDomain = getYAxisDomain(autoMinValue, minValue, maxValue);
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The BarChart is also available as a copy-and-paste component. Visit https://tremor.so/docs/visualizations/bar-chart (This is only shown in development)",
-    );
-  }
   return (
     <div ref={ref} className={tremorTwMerge("w-full h-80", className)} {...other}>
       <ResponsiveContainer className="h-full w-full">
```

**File**: `src/components/chart-elements/DonutChart/DonutChart.tsx` (modified, +0/-6)
```diff
@@ -124,12 +124,6 @@ const DonutChart = React.forwardRef<HTMLDivElement, DonutChartProps>((props, ref
     }
   }, [activeIndex]);
 
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The DonutChart is also available as a copy-and-paste component. Visit https://tremor.so/docs/visualizations/donut-chart (This is only shown in development)",
-    );
-  }
-
   return (
     <div ref={ref} className={tremorTwMerge("w-full h-40", className)} {...other}>
       <ResponsiveContainer className="h-full w-full">
```

**File**: `src/components/chart-elements/LineChart/LineChart.tsx` (modified, +0/-6)
```diff
@@ -133,12 +133,6 @@ const LineChart = React.forwardRef<HTMLDivElement, LineChartProps>((props, ref)
     setActiveDot(undefined);
   }
 
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The LineChart is also available as a copy-and-paste component. Visit https://tremor.so/docs/visualizations/line-chart (This is only shown in development)",
-    );
-  }
-
   return (
     <div ref={ref} className={tremorTwMerge("w-full h-80", className)} {...other}>
       <ResponsiveContainer className="h-full w-full">
```

**File**: `src/components/icon-elements/Badge/Badge.tsx` (modified, +0/-6)
```diff
@@ -29,12 +29,6 @@ const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>((props, ref) => {
 
   const { tooltipProps, getReferenceProps } = useTooltip();
 
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The Badge is also available as a copy-and-paste component. Visit https://tremor.so/docs/ui/badge (This is only shown in development)",
-    );
-  }
-
   return (
     <span
       ref={mergeRefs([ref, tooltipProps.refs.setReference])}
```

**File**: `src/components/input-elements/Button/Button.tsx` (modified, +0/-6)
```diff
@@ -119,12 +119,6 @@ const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) =>
     toggleTransition(loading);
   }, [loading]);
 
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The Button is also available as a copy-and-paste component. Visit https://tremor.so/docs/ui/button (This is only shown in development)",
-    );
-  }
-
   return (
     // eslint-disable-next-line react/button-has-type
     <button
```

**File**: `src/components/input-elements/Calendar/Calendar.tsx` (modified, +0/-5)
```diff
@@ -29,11 +29,6 @@ function Calendar<T extends DayPickerSingleProps | DayPickerRangeProps>({
   weekStartsOn = 0,
   ...other
 }: T & { enableYearNavigation: boolean }) {
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The Calendar is also available as a copy-and-paste component. Visit https://tremor.so/docs/inputs/calendar (This is only shown in development)",
-    );
-  }
   return (
     <DayPicker
       showOutsideDays={true}
```

**File**: `src/components/input-elements/DatePicker/DatePicker.tsx` (modified, +0/-6)
```diff
@@ -80,12 +80,6 @@ const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>((props, ref
     setSelectedValue(undefined);
   };
 
-  if (process.env.NODE_ENV === "development") {
-    console.info(
-      "The DatePicker is also available as a copy-and-paste component. Visit https://tremor.so/docs/inputs/date-picker (This is only shown in development)",
-    );
-  }
-
   return (
     <Popover
       ref={ref}
```

---

### Incident Patch 10: `62c4bcc3` (2024-06-23)
**Commit Message**: fix: tab color and legend scroll (#1094)

* fix: tab color brand

* fix: colors seelct error

* fix: add input type search

* fix animations

* fix: legend scroll (#1093)

* fix legend scroll

Co-authored-by: mbauchet <[REDACTED_EMAIL]>

**File**: `src/components/input-elements/BaseInput.tsx` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ import { getSelectButtonColors, hasValue } from "components/input-elements/selec
 import { mergeRefs, tremorTwMerge } from "lib";
 
 export interface BaseInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
-  type?: "text" | "password" | "email" | "url" | "number";
+  type?: "text" | "password" | "email" | "url" | "number" | "search";
   defaultValue?: string | number;
   value?: string | number;
   icon?: React.ElementType | React.JSXElementConstructor<any>;
```

**File**: `src/components/input-elements/Tabs/Tab.tsx` (modified, +5/-5)
```diff
@@ -22,7 +22,10 @@ function getVariantStyles(tabVariant: TabVariant, color?: Color) {
         // brand
         color
           ? getColorClassNames(color, colorPalette.border).selectBorderColor
-          : "ui-selected:border-tremor-brand dark:ui-selected:border-dark-tremor-brand",
+          : [
+              "ui-selected:border-tremor-brand ui-selected:text-tremor-brand",
+              "ui-selected:dark:border-dark-tremor-brand ui-selected:dark:text-dark-tremor-brand",
+            ],
       );
     case "solid":
       return tremorTwMerge(
@@ -57,12 +60,9 @@ const Tab = React.forwardRef<HTMLButtonElement, TabProps>((props, ref) => {
         makeTabClassName("root"),
         // common
         "flex whitespace-nowrap truncate max-w-xs outline-none ui-focus-visible:ring text-tremor-default transition duration-100",
-        // brand
-        color && getColorClassNames(color, colorPalette.text).selectTextColor,
-        // solid ? "ui-selected:text-tremor-content-emphasis dark:ui-selected:text-dark-tremor-content-emphasis"
-        // : "ui-selected:text-tremor-brand dark:ui-selected:text-dark-tremor-brand",
         getVariantStyles(variant, color),
         className,
+        color && getColorClassNames(color, colorPalette.text).selectTextColor,
       )}
       {...other}
     >
```

**File**: `src/components/input-elements/Tabs/TabList.tsx` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ export interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {
 }
 
 const TabList = React.forwardRef<HTMLDivElement, TabListProps>((props, ref) => {
-  const { color = "blue", variant = "line", children, className, ...other } = props;
+  const { color, variant = "line", children, className, ...other } = props;
 
   return (
     <Tab.List
```

**File**: `src/components/input-elements/TextInput/TextInput.tsx` (modified, +0/-1)
```diff
@@ -4,7 +4,6 @@ import { makeClassName } from "lib";
 import BaseInput, { BaseInputProps } from "../BaseInput";
 
 export type TextInputProps = Omit<BaseInputProps, "stepper" | "makeInputClassName"> & {
-  type?: "text" | "password" | "email" | "url";
   defaultValue?: string;
   value?: string;
   onValueChange?: (value: string) => void;
```

**File**: `src/components/input-elements/selectUtils.ts` (modified, +5/-2)
```diff
@@ -44,8 +44,11 @@ export const getSelectButtonColors = (
       ? "text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis"
       : "text-tremor-content dark:text-dark-tremor-content",
     isDisabled && "text-tremor-content-subtle dark:text-dark-tremor-content-subtle",
-    hasError && "text-red-500 placeholder:text-red-500",
-    hasError ? "border-red-500" : "border-tremor-border dark:border-dark-tremor-border",
+    hasError &&
+      "text-red-500 placeholder:text-red-500 dark:text-red-500 dark:placeholder:text-red-500",
+    hasError
+      ? "border-red-500 dark:border-red-500"
+      : "border-tremor-border dark:border-dark-tremor-border",
   );
 };
 
```

**File**: `src/components/text-elements/Legend/Legend.tsx` (modified, +9/-1)
```diff
@@ -153,6 +153,8 @@ const Legend = React.forwardRef<HTMLOListElement, LegendProps>((props, ref) => {
     ...other
   } = props;
   const scrollableRef = React.useRef<HTMLInputElement>(null);
+  const scrollButtonsRef = React.useRef<HTMLDivElement>(null);
+
   const [hasScroll, setHasScroll] = React.useState<HasScrollProps | null>(null);
   const [isKeyDowned, setIsKeyDowned] = React.useState<string | null>(null);
   const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
@@ -170,11 +172,16 @@ const Legend = React.forwardRef<HTMLOListElement, LegendProps>((props, ref) => {
   const scrollToTest = useCallback(
     (direction: "left" | "right") => {
       const element = scrollableRef?.current;
+      const scrollButtons = scrollButtonsRef?.current;
       const width = element?.clientWidth ?? 0;
+      const scrollButtonsWith = scrollButtons?.clientWidth ?? 0;
 
       if (element && enableLegendSlider) {
         element.scrollTo({
-          left: direction === "left" ? element.scrollLeft - width : element.scrollLeft + width,
+          left:
+            direction === "left"
+              ? element.scrollLeft - width + scrollButtonsWith
+              : element.scrollLeft + width - scrollButtonsWith,
           behavior: "smooth",
         });
         setTimeout(() => {
@@ -273,6 +280,7 @@ const Legend = React.forwardRef<HTMLOListElement, LegendProps>((props, ref) => {
               // common
               "absolute flex top-0 pr-1 bottom-0 right-0 items-center justify-center h-full",
             )}
+            ref={scrollButtonsRef}
           >
             <ScrollButton
               icon={ChevronLeftFill}
```

**File**: `src/components/vis-elements/DeltaBar/DeltaBar.tsx` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ const DeltaBar = React.forwardRef<HTMLDivElement, DeltaBarProps>((props, ref) =>
               )}
               style={{
                 width: `${Math.abs(value)}%`,
-                transition: showAnimation ? "all 1s" : "",
+                transition: showAnimation ? "all duration-300" : "",
               }}
               {...getReferenceProps}
             />
```

**File**: `src/components/vis-elements/MarkerBar/MarkerBar.tsx` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ const MarkerBar = React.forwardRef<HTMLDivElement, MarkerBarProps>((props, ref)
             style={{
               left: `${minValue}%`,
               width: `${maxValue - minValue}%`,
-              transition: showAnimation ? "all 1s" : "",
+              transition: showAnimation ? "all duration-300" : "",
             }}
             {...getRangeReferenceProps}
           />
```

---

### Incident Patch 11: `3978056e` (2024-06-19)
**Commit Message**: fix: legend categories max (#1091)

* update legend

* update packages

* update

**File**: `package.json` (modified, +19/-19)
```diff
@@ -26,19 +26,19 @@
   "dependencies": {
     "@floating-ui/react": "^0.19.2",
     "@headlessui/react": "^1.7.19",
-    "@headlessui/tailwindcss": "^0.2.0",
+    "@headlessui/tailwindcss": "^0.2.1",
     "date-fns": "^3.6.0",
     "react-day-picker": "^8.10.1",
     "react-transition-state": "^2.1.1",
     "recharts": "^2.12.7",
     "tailwind-merge": "^1.14.0"
   },
   "devDependencies": {
-    "@babel/core": "^7.24.5",
-    "@babel/preset-env": "^7.24.5",
-    "@babel/preset-react": "^7.24.1",
-    "@babel/preset-typescript": "^7.24.1",
-    "@chromatic-com/storybook": "^1.4.0",
+    "@babel/core": "^7.24.7",
+    "@babel/preset-env": "^7.24.7",
+    "@babel/preset-react": "^7.24.7",
+    "@babel/preset-typescript": "^7.24.7",
+    "@chromatic-com/storybook": "^1.5.0",
     "@mdx-js/react": "^2.3.0",
     "@rollup/plugin-commonjs": "^21.1.0",
     "@rollup/plugin-node-resolve": "^13.3.0",
@@ -47,20 +47,20 @@
     "@semantic-release/commit-analyzer": "^9.0.2",
     "@semantic-release/github": "github:semantic-release/github",
     "@semantic-release/npm": "github:semantic-release/npm",
-    "@storybook/addon-a11y": "^8.1.1",
-    "@storybook/addon-actions": "^8.1.1",
-    "@storybook/addon-essentials": "^8.1.1",
-    "@storybook/addon-interactions": "^8.1.1",
-    "@storybook/addon-links": "^8.1.1",
+    "@storybook/addon-a11y": "^8.1.10",
+    "@storybook/addon-actions": "^8.1.10",
+    "@storybook/addon-essentials": "^8.1.10",
+    "@storybook/addon-interactions": "^8.1.10",
+    "@storybook/addon-links": "^8.1.10",
     "@storybook/addon-styling-webpack": "^1.0.0",
-    "@storybook/addon-themes": "^8.1.1",
+    "@storybook/addon-themes": "^8.1.10",
     "@storybook/addon-webpack5-compiler-babel": "^3.0.3",
-    "@storybook/manager-api": "^8.1.1",
+    "@storybook/manager-api": "^8.1.10",
     "@storybook/mdx2-csf": "^1.1.0",
-    "@storybook/react": "^8.1.1",
-    "@storybook/react-webpack5": "^8.1.1",
-    "@storybook/test": "^8.1.1",
-    "@storybook/theming": "^8.1.1",
+    "@storybook/react": "^8.1.10",
+    "@storybook/react-webpack5": "^8.1.10",
+    "@storybook/test": "^8.1.10",
+    "@storybook/theming": "^8.1.10",
     "@tailwindcss/forms": "^0.5.7",
     "@testing-library/react": "^14.1.2",
     "@types/jest": "^29.5.12",
@@ -96,10 +96,10 @@
     "rollup-plugin-preserve-directives": "^0.1.1",
     "rollup-plugin-typescript-paths": "^1.4.0",
     "semantic-release": "^22.0.8",
-    "storybook": "^8.1.1",
+    "storybook": "^8.1.10",
     "storybook-source-link": "^4.0.1",
     "style-loader": "^3.3.3",
-    "tailwindcss": "^3.4.3",
+    "tailwindcss": "^3.4.4",
     "tslib": "^2.6.2",
     "typescript": "^4.9.5",
     "webpack": "^5.91.0"
```

**File**: `src/components/text-elements/Legend/Legend.tsx` (modified, +1/-1)
```diff
@@ -256,7 +256,7 @@ const Legend = React.forwardRef<HTMLOListElement, LegendProps>((props, ref) => {
           <LegendItem
             key={`item-${idx}`}
             name={category}
-            color={colors[idx]}
+            color={colors[idx % colors.length]}
             onClick={onClickLegendItem}
             activeLegend={activeLegend}
           />
```

**File**: `src/stories/text-elements/Legend.stories.tsx` (modified, +31/-0)
```diff
@@ -85,6 +85,37 @@ export const ManyCategoriesWithScroll: Story = {
   },
 };
 
+export const MoreCategoriesThanColors: Story = {
+  ...LegendTemplate,
+  args: {
+    categories: [
+      "Blueberry Pie",
+      "Electric Sheep",
+      "Moonlight Sonata",
+      "Quantum Leap",
+      "Crimson Clover",
+      "Neon Mirage",
+      "Solar Flare",
+      "Velvet Thunder",
+      "Silent Echo",
+      "Shadow Dance",
+      "Silver Lining",
+      "Golden Hour",
+      "Eclipse Chaser",
+      "Starry Night",
+      "Mystic Dawn",
+      "Enchanted Forest",
+      "Aurora Borealis",
+      "Dream Weaver",
+      "Celestial Harmony",
+      "Frosted Twilight",
+      "Thunderstrike",
+      "Lunar Eclipse",
+      "Galactic Voyage",
+    ],
+  },
+};
+
 export const CustomColors: Story = {
   ...LegendTemplate,
   args: {
```

---

### Incident Patch 12: `0a6c9a08` (2024-05-20)
**Commit Message**: fix: select wrong alignment (#1053)

* add relative div for select elements

* fix searchSelect error

---------

Co-authored-by: Maxime BAUCHET <[REDACTED_EMAIL]>
Co-authored-by: severinlandolt <[REDACTED_EMAIL]>

**File**: `.github/ISSUE_TEMPLATE/bug-report.yaml` (modified, +1/-1)
```diff
@@ -75,4 +75,4 @@ body:
   - type: markdown
     attributes:
       value: |
-        This bug report template was inspired by the issue template from [vuejs](https://github.com/vuejs/core)
\ No newline at end of file
+        This bug report template was inspired by the issue template from [vuejs](https://github.com/vuejs/core)
```

**File**: `.github/ISSUE_TEMPLATE/config.yaml` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@ blank_issues_enabled: true
 contact_links:
   - name: Slack Community
     url: https://join.slack.com/t/tremor-community/shared_invite/zt-1u8jqmcmq-Fdr9B6MbnO7u8FkGh~2Ylg
-    about: Please ask and answer usage questions here.
\ No newline at end of file
+    about: Please ask and answer usage questions here.
```

**File**: `.github/workflows/build.yaml` (modified, +3/-3)
```diff
@@ -8,8 +8,8 @@ on:
       - synchronize
   push:
     branches:
-      - '**'
-      - '!main'
+      - "**"
+      - "!main"
 
 jobs:
   build:
@@ -32,4 +32,4 @@ jobs:
       - name: unit tests
         run: npm run tests
       - name: build
-        run: npm run build
\ No newline at end of file
+        run: npm run build
```

**File**: `pnpm-lock.yaml` (modified, +8/-8)
```diff
@@ -2040,14 +2040,14 @@ packages:
     peerDependencies:
       tailwindcss: '>=3.0.0 || >= 3.0.0-alpha.1'
 
-  '@tanstack/react-virtual@3.0.1':
-    resolution: {integrity: sha512-IFOFuRUTaiM/yibty9qQ9BfycQnYXIDHGP2+cU+0LrFFGNhVxCXSQnaY6wkX8uJVteFEBjUondX0Hmpp7TNcag==}
+  '@tanstack/react-virtual@3.5.0':
+    resolution: {integrity: sha512-rtvo7KwuIvqK9zb0VZ5IL7fiJAEnG+0EiFZz8FUOs+2mhGqdGmjKIaT1XU7Zq0eFqL0jonLlhbayJI/J2SA/Bw==}
     peerDependencies:
       react: ^16.8.0 || ^17.0.0 || ^18.0.0
       react-dom: ^16.8.0 || ^17.0.0 || ^18.0.0
 
-  '@tanstack/virtual-core@3.0.0':
-    resolution: {integrity: sha512-SYXOBTjJb05rXa2vl55TTwO40A6wKu0R5i1qQwhJYNDIqaIGF7D0HsLw+pJAyi2OvntlEIVusx3xtbbgSUi6zg==}
+  '@tanstack/virtual-core@3.5.0':
+    resolution: {integrity: sha512-KnPRCkQTyqhanNC0K63GBG3wA8I+D1fQuVnAvcBF8f13akOKeQp1gSbu6f77zCxhEk727iV5oQnbHLYzHrECLg==}
 
   '@testing-library/dom@9.3.3':
     resolution: {integrity: sha512-fB0R+fa3AUqbLHWyxXa2kGVtf1Fe1ZZFr0Zp6AIbIAzXb2mKbEXl+PCQNUOaq5lbTab5tfctfXRNsWXxa2f7Aw==}
@@ -8461,7 +8461,7 @@ snapshots:
 
   '@headlessui/react@1.7.19(react-dom@18.3.1(react@18.3.1))(react@18.3.1)':
     dependencies:
-      '@tanstack/react-virtual': 3.0.1(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+      '@tanstack/react-virtual': 3.5.0(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       client-only: 0.0.1
       react: 18.3.1
       react-dom: 18.3.1(react@18.3.1)
@@ -10108,13 +10108,13 @@ snapshots:
       mini-svg-data-uri: 1.4.4
       tailwindcss: 3.4.3
 
-  '@tanstack/react-virtual@3.0.1(react-dom@18.3.1(react@18.3.1))(react@18.3.1)':
+  '@tanstack/react-virtual@3.5.0(react-dom@18.3.1(react@18.3.1))(react@18.3.1)':
     dependencies:
-      '@tanstack/virtual-core': 3.0.0
+      '@tanstack/virtual-core': 3.5.0
       react: 18.3.1
       react-dom: 18.3.1(react@18.3.1)
 
-  '@tanstack/virtual-core@3.0.0': {}
+  '@tanstack/virtual-core@3.5.0': {}
 
   '@testing-library/dom@9.3.3':
     dependencies:
```

**File**: `src/components/input-elements/MultiSelect/MultiSelect.tsx` (modified, +218/-216)
```diff
@@ -80,80 +80,146 @@ const MultiSelect = React.forwardRef<HTMLInputElement, MultiSelectProps>((props,
     <div
       className={tremorTwMerge(
         // common
-        "w-full min-w-[10rem] relative text-tremor-default",
+        "w-full min-w-[10rem] text-tremor-default",
         className,
       )}
     >
-      <select
-        title="multi-select-hidden"
-        required={required}
-        className={tremorTwMerge("h-full w-full absolute left-0 top-0 -z-10 opacity-0")}
-        value={selectedValue}
-        onChange={(e) => {
-          e.preventDefault();
-        }}
-        name={name}
-        disabled={disabled}
-        multiple
-        id={id}
-        onFocus={() => {
-          const listboxButton = listboxButtonRef.current;
-          if (listboxButton) listboxButton.focus();
-        }}
-      >
-        <option className="hidden" value="" disabled hidden>
-          {placeholder}
-        </option>
-        {filteredOptions.map((child: any) => {
-          const value = child.props.value;
-          const name = child.props.children;
-          return (
-            <option className="hidden" key={value} value={value}>
-              {name}
-            </option>
-          );
-        })}
-      </select>
-      <Listbox
-        as="div"
-        ref={ref}
-        defaultValue={selectedValue}
-        value={selectedValue}
-        onChange={
-          ((values: string[]) => {
-            onValueChange?.(values);
-            setSelectedValue(values);
-          }) as any
-        }
-        disabled={disabled}
-        id={id}
-        multiple
-        {...other}
-      >
-        {({ value }) => (
-          <>
-            <Listbox.Button
-              className={tremorTwMerge(
-                // common
-                "w-full outline-none text-left whitespace-nowrap truncate rounded-tremor-default focus:ring-2 transition duration-100 border pr-8 py-1.5",
-                // light
-                "border-tremor-border shadow-tremor-input focus:border-tremor-brand-subtle focus:ring-tremor-brand-muted",
-                // dark
-                "dark:border-dark-tremor-border dark:shadow-dark-tremor-input dark:focus:border-dark-tremor-brand-subtle dark:focus:ring-dark-tremor-brand-muted",
-                Icon ? "pl-11 -ml-0.5" : "pl-3",
-                getSelectButtonColors(value.length > 0, disabled, error),
-              )}
-              ref={listboxButtonRef}
-            >
-              {Icon && (
-                <span
-                  className={tremorTwMerge(
-                    "absolute inset-y-0 left-0 flex items-center ml-px pl-2.5",
+      <div className="relative">
+        <select
+          title="multi-select-hidden"
+          required={required}
+          className={tremorTwMerge("h-full w-full absolute left-0 top-0 -z-10 opacity-0")}
+          value={selectedValue}
+          onChange={(e) => {
+            e.preventDefault();
+          }}
+          name={name}
+          disabled={disabled}
+          multiple
+          id={id}
+          onFocus={() => {
+            const listboxButton = listboxButtonRef.current;
+            if (listboxButton) listboxButton.focus();
+          }}
+        >
+          <option className="hidden" value="" disabled hidden>
+            {placeholder}
+          </option>
+          {filteredOptions.map((child: any) => {
+            const value = child.props.value;
+            const name = child.props.children;
+            return (
+              <option className="hidden" key={value} value={value}>
+                {name}
+              </option>
+            );
+          })}
+        </select>
+        <Listbox
+          as="div"
+          ref={ref}
+          defaultValue={selectedValue}
+          value={selectedValue}
+          onChange={
+            ((values: string[]) => {
+              onValueChange?.(values);
+              setSelectedValue(values);
+            }) as any
+          }
+          disabled={disabled}
+          id={id}
+          multiple
+          {...other}
+        >
+          {({ value }) => (
+            <>
+              <Listbox.Button
+                className={tremorTwMerge(
+                  // common
+                  "w-full outline-none text-left whitespace-nowrap truncate rounded-tremor-default focus:ring-2 transition duration-100 border pr-8 py-1.5",
+                  // light
+                  "border-tremor-border shadow-tremor-input focus:border-tremor-brand-subtle focus:ring-tremor-brand-muted",
+                  // dark
+                  "dark:border-dark-tremor-border dark:shadow-dark-tremor-input dark:focus:border-dark-tremor-brand-subtle dark:focus:ring-dark-tremor-brand-muted",
+                  Icon ? "pl-11 -ml-0.5" : "pl-3",
+                  getSelectButtonColors(value.length > 0, disabled, error),
+                )}
+                ref={listboxButtonRef}
+              >
+                {Icon && (
+                  <span
+       
```

**File**: `src/components/input-elements/SearchSelect/SearchSelect.tsx` (modified, +146/-142)
```diff
@@ -83,164 +83,168 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
     <div
       className={tremorTwMerge(
         // common
-        "w-full min-w-[10rem] relative text-tremor-default",
+        "w-full min-w-[10rem] text-tremor-default",
         className,
       )}
     >
-      <select
-        title="search-select-hidden"
-        required={required}
-        className={tremorTwMerge("h-full w-full absolute left-0 top-0 -z-10 opacity-0")}
-        value={selectedValue}
-        onChange={(e) => {
-          e.preventDefault();
-        }}
-        name={name}
-        disabled={disabled}
-        id={id}
-        onFocus={() => {
-          const comboboxInput = comboboxInputRef.current;
-          if (comboboxInput) comboboxInput.focus();
-        }}
-      >
-        <option className="hidden" value="" disabled hidden>
-          {placeholder}
-        </option>
-        {filteredOptions.map((child: any) => {
-          const value = child.props.value;
-          const name = child.props.children;
-          return (
-            <option className="hidden" key={value} value={value}>
-              {name}
-            </option>
-          );
-        })}
-      </select>
-      <Combobox
-        as="div"
-        ref={ref}
-        defaultValue={selectedValue}
-        value={selectedValue}
-        onChange={
-          ((value: string) => {
-            onValueChange?.(value);
-            setSelectedValue(value);
-          }) as any
-        }
-        disabled={disabled}
-        id={id}
-        {...other}
-      >
-        {({ value }) => (
-          <>
-            <Combobox.Button className="w-full">
-              {Icon && (
-                <span
+      <div className="relative">
+        <select
+          title="search-select-hidden"
+          required={required}
+          className={tremorTwMerge("h-full w-full absolute left-0 top-0 -z-10 opacity-0")}
+          value={selectedValue}
+          onChange={(e) => {
+            e.preventDefault();
+          }}
+          name={name}
+          disabled={disabled}
+          id={id}
+          onFocus={() => {
+            const comboboxInput = comboboxInputRef.current;
+            if (comboboxInput) comboboxInput.focus();
+          }}
+        >
+          <option className="hidden" value="" disabled hidden>
+            {placeholder}
+          </option>
+          {filteredOptions.map((child: any) => {
+            const value = child.props.value;
+            const name = child.props.children;
+            return (
+              <option className="hidden" key={value} value={value}>
+                {name}
+              </option>
+            );
+          })}
+        </select>
+        <Combobox
+          as="div"
+          ref={ref}
+          defaultValue={selectedValue}
+          value={selectedValue}
+          onChange={
+            ((value: string) => {
+              onValueChange?.(value);
+              setSelectedValue(value);
+            }) as any
+          }
+          disabled={disabled}
+          id={id}
+          {...other}
+        >
+          {({ value }) => (
+            <>
+              <Combobox.Button className="w-full">
+                {Icon && (
+                  <span
+                    className={tremorTwMerge(
+                      "absolute inset-y-0 left-0 flex items-center ml-px pl-2.5",
+                    )}
+                  >
+                    <Icon
+                      className={tremorTwMerge(
+                        makeSearchSelectClassName("Icon"),
+                        // common
+                        "flex-none h-5 w-5",
+                        // light
+                        "text-tremor-content-subtle",
+                        // dark
+                        "dark:text-dark-tremor-content-subtle",
+                      )}
+                    />
+                  </span>
+                )}
+
+                <Combobox.Input
+                  ref={comboboxInputRef}
                   className={tremorTwMerge(
-                    "absolute inset-y-0 left-0 flex items-center ml-px pl-2.5",
+                    // common
+                    "w-full outline-none text-left whitespace-nowrap truncate rounded-tremor-default focus:ring-2 transition duration-100 text-tremor-default pr-14 border py-2",
+                    // light
+                    "border-tremor-border shadow-tremor-input focus:border-tremor-brand-subtle focus:ring-tremor-brand-muted",
+                    // dark
+                    "dark:border-dark-tremor-border dark:shadow-dark-tremor-input dark:focus:border-dark-tremor-brand-subtle dark:focus:ring-dark-tremor-brand-muted",
+                    Icon ? "pl-10" : "pl-3",
+                    disabled
+                      ? "placeholder:text-tremor-content-subtle dark:placeholder:text-tremor-content-subtle"
+                      : "placeholder:text-tremor-content dark:placeholder:text-tremo
```

**File**: `src/components/input-elements/Select/Select.tsx` (modified, +129/-125)
```diff
@@ -63,78 +63,98 @@ const Select = React.forwardRef<HTMLInputElement, SelectProps>((props, ref) => {
     <div
       className={tremorTwMerge(
         // common
-        "w-full min-w-[10rem] relative text-tremor-default",
+        "w-full min-w-[10rem] text-tremor-default",
         className,
       )}
     >
-      <select
-        title="select-hidden"
-        required={required}
-        className={tremorTwMerge("h-full w-full absolute left-0 top-0 -z-10 opacity-0")}
-        value={selectedValue}
-        onChange={(e) => {
-          e.preventDefault();
-        }}
-        name={name}
-        disabled={disabled}
-        id={id}
-        onFocus={() => {
-          const listboxButton = listboxButtonRef.current;
-          if (listboxButton) listboxButton.focus();
-        }}
-      >
-        <option className="hidden" value="" disabled hidden>
-          {placeholder}
-        </option>
-        {childrenArray.map((child: any) => {
-          const value = child.props.value;
-          const name = child.props.children;
-          return (
-            <option className="hidden" key={value} value={value}>
-              {name}
-            </option>
-          );
-        })}
-      </select>
-      <Listbox
-        as="div"
-        ref={ref}
-        defaultValue={selectedValue}
-        value={selectedValue}
-        onChange={
-          ((value: string) => {
-            onValueChange?.(value);
-            setSelectedValue(value);
-          }) as any
-        }
-        disabled={disabled}
-        id={id}
-        {...other}
-      >
-        {({ value }) => (
-          <>
-            <Listbox.Button
-              ref={listboxButtonRef}
-              className={tremorTwMerge(
-                // common
-                "w-full outline-none text-left whitespace-nowrap truncate rounded-tremor-default focus:ring-2 transition duration-100 border pr-8 py-2",
-                // light
-                "border-tremor-border shadow-tremor-input focus:border-tremor-brand-subtle focus:ring-tremor-brand-muted",
-                // dark
-                "dark:border-dark-tremor-border dark:shadow-dark-tremor-input dark:focus:border-dark-tremor-brand-subtle dark:focus:ring-dark-tremor-brand-muted",
-                Icon ? "pl-10" : "pl-3",
-                getSelectButtonColors(hasValue(value), disabled, error),
-              )}
-            >
-              {Icon && (
+      <div className="relative">
+        <select
+          title="select-hidden"
+          required={required}
+          className={tremorTwMerge("h-full w-full absolute left-0 top-0 -z-10 opacity-0")}
+          value={selectedValue}
+          onChange={(e) => {
+            e.preventDefault();
+          }}
+          name={name}
+          disabled={disabled}
+          id={id}
+          onFocus={() => {
+            const listboxButton = listboxButtonRef.current;
+            if (listboxButton) listboxButton.focus();
+          }}
+        >
+          <option className="hidden" value="" disabled hidden>
+            {placeholder}
+          </option>
+          {childrenArray.map((child: any) => {
+            const value = child.props.value;
+            const name = child.props.children;
+            return (
+              <option className="hidden" key={value} value={value}>
+                {name}
+              </option>
+            );
+          })}
+        </select>
+        <Listbox
+          as="div"
+          ref={ref}
+          defaultValue={selectedValue}
+          value={selectedValue}
+          onChange={
+            ((value: string) => {
+              onValueChange?.(value);
+              setSelectedValue(value);
+            }) as any
+          }
+          disabled={disabled}
+          id={id}
+          {...other}
+        >
+          {({ value }) => (
+            <>
+              <Listbox.Button
+                ref={listboxButtonRef}
+                className={tremorTwMerge(
+                  // common
+                  "w-full outline-none text-left whitespace-nowrap truncate rounded-tremor-default focus:ring-2 transition duration-100 border pr-8 py-2",
+                  // light
+                  "border-tremor-border shadow-tremor-input focus:border-tremor-brand-subtle focus:ring-tremor-brand-muted",
+                  // dark
+                  "dark:border-dark-tremor-border dark:shadow-dark-tremor-input dark:focus:border-dark-tremor-brand-subtle dark:focus:ring-dark-tremor-brand-muted",
+                  Icon ? "pl-10" : "pl-3",
+                  getSelectButtonColors(hasValue(value), disabled, error),
+                )}
+              >
+                {Icon && (
+                  <span
+                    className={tremorTwMerge(
+                      "absolute inset-y-0 left-0 flex items-center ml-px pl-2.5",
+                    )}
+                  >
+                    <Icon
+                      className={tremorTwMerge(
+                        makeSe
```

**File**: `src/components/input-elements/selectUtils.ts` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ export const getSelectButtonColors = (
       ? "text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis"
       : "text-tremor-content dark:text-dark-tremor-content",
     isDisabled && "text-tremor-content-subtle dark:text-dark-tremor-content-subtle",
-    hasError && "text-red-500",
+    hasError && "text-red-500 placeholder:text-red-500",
     hasError ? "border-red-500" : "border-tremor-border dark:border-dark-tremor-border",
   );
 };
```

---

### Incident Patch 13: `61ebc667` (2024-05-20)
**Commit Message**: fix: select components (#1052)

* fix select zIndex + add autocomplete props to searchselect

Co-authored-by: Maxime BAUCHET <[REDACTED_EMAIL]>

**File**: `src/components/input-elements/MultiSelect/MultiSelect.tsx` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ const MultiSelect = React.forwardRef<HTMLInputElement, MultiSelectProps>((props,
       <select
         title="multi-select-hidden"
         required={required}
-        className={tremorTwMerge("h-full w-full absolute left-0 top-0 z-0 opacity-0")}
+        className={tremorTwMerge("h-full w-full absolute left-0 top-0 -z-10 opacity-0")}
         value={selectedValue}
         onChange={(e) => {
           e.preventDefault();
```

**File**: `src/components/input-elements/SearchSelect/SearchSelect.tsx` (modified, +9/-6)
```diff
@@ -28,6 +28,7 @@ export interface SearchSelectProps extends React.HTMLAttributes<HTMLInputElement
   errorMessage?: string;
   enableClear?: boolean;
   children: React.ReactNode;
+  autoComplete?: string;
 }
 
 const makeSelectClassName = makeClassName("SearchSelect");
@@ -50,9 +51,10 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
     children,
     className,
     id,
+    autoComplete = "off",
     ...other
   } = props;
-  const comboboxButtonRef = useRef<HTMLButtonElement | null>(null);
+  const comboboxInputRef = useRef<HTMLInputElement | null>(null);
 
   const [searchQuery, setSearchQuery] = useInternalState("", searchValue);
   const [selectedValue, setSelectedValue] = useInternalState(defaultValue, value);
@@ -88,7 +90,7 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
       <select
         title="search-select-hidden"
         required={required}
-        className={tremorTwMerge("h-full w-full absolute left-0 top-0 z-0 opacity-0")}
+        className={tremorTwMerge("h-full w-full absolute left-0 top-0 -z-10 opacity-0")}
         value={selectedValue}
         onChange={(e) => {
           e.preventDefault();
@@ -97,8 +99,8 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
         disabled={disabled}
         id={id}
         onFocus={() => {
-          const comboboxButton = comboboxButtonRef.current;
-          if (comboboxButton) comboboxButton.click();
+          const comboboxInput = comboboxInputRef.current;
+          if (comboboxInput) comboboxInput.focus();
         }}
       >
         <option className="hidden" value="" disabled hidden>
@@ -131,7 +133,7 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
       >
         {({ value }) => (
           <>
-            <Combobox.Button ref={comboboxButtonRef} className="w-full">
+            <Combobox.Button className="w-full">
               {Icon && (
                 <span
                   className={tremorTwMerge(
@@ -153,6 +155,7 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
               )}
 
               <Combobox.Input
+                ref={comboboxInputRef}
                 className={tremorTwMerge(
                   // common
                   "w-full outline-none text-left whitespace-nowrap truncate rounded-tremor-default focus:ring-2 transition duration-100 text-tremor-default pr-14 border py-2",
@@ -172,7 +175,7 @@ const SearchSelect = React.forwardRef<HTMLInputElement, SearchSelectProps>((prop
                   setSearchQuery(event.target.value);
                 }}
                 displayValue={(value: string) => valueToNameMapping.get(value) ?? ""}
-                autoComplete="off"
+                autoComplete={autoComplete}
               />
               <div className={tremorTwMerge("absolute inset-y-0 right-0 flex items-center pr-2.5")}>
                 <ArrowDownHeadIcon
```

**File**: `src/components/input-elements/Select/Select.tsx` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ const Select = React.forwardRef<HTMLInputElement, SelectProps>((props, ref) => {
       <select
         title="select-hidden"
         required={required}
-        className={tremorTwMerge("h-full w-full absolute left-0 top-0 z-0 opacity-0")}
+        className={tremorTwMerge("h-full w-full absolute left-0 top-0 -z-10 opacity-0")}
         value={selectedValue}
         onChange={(e) => {
           e.preventDefault();
```

---

### Incident Patch 14: `1846a7bc` (2024-05-15)
**Commit Message**: fix: Chart colors loop (#1046)

* fix: update deps (#1042)

* fix: Chart color logic (#1043)

* fix: chart color loop (#1041)

**File**: `.storybook/main.js` (modified, +2/-0)
```diff
@@ -37,6 +37,8 @@ module.exports = {
         ],
       },
     },
+    "@storybook/addon-webpack5-compiler-babel",
+    "@chromatic-com/storybook"
   ],
 
   framework: {
```

**File**: `.storybook/preview.js` (modified, +0/-1)
```diff
@@ -2,7 +2,6 @@ import "../src/styles.css";
 import { withThemeByDataAttribute } from "@storybook/addon-themes";
 
 export const parameters = {
-  actions: { argTypesRegex: "^on[A-Z].*" },
   controls: {
     matchers: {
       color: /(background|color)$/i,
```

**File**: `package.json` (modified, +31/-28)
```diff
@@ -27,17 +27,18 @@
     "@floating-ui/react": "^0.19.2",
     "@headlessui/react": "^1.7.19",
     "@headlessui/tailwindcss": "^0.2.0",
-    "date-fns": "^2.30.0",
-    "react-day-picker": "^8.9.1",
+    "date-fns": "^3.6.0",
+    "react-day-picker": "^8.10.1",
     "react-transition-state": "^2.1.1",
-    "recharts": "^2.12.6",
+    "recharts": "^2.12.7",
     "tailwind-merge": "^1.14.0"
   },
   "devDependencies": {
-    "@babel/core": "^7.23.5",
-    "@babel/preset-env": "^7.23.5",
-    "@babel/preset-react": "^7.23.3",
-    "@babel/preset-typescript": "^7.23.3",
+    "@babel/core": "^7.24.5",
+    "@babel/preset-env": "^7.24.5",
+    "@babel/preset-react": "^7.24.1",
+    "@babel/preset-typescript": "^7.24.1",
+    "@chromatic-com/storybook": "^1",
     "@mdx-js/react": "^2.3.0",
     "@rollup/plugin-commonjs": "^21.1.0",
     "@rollup/plugin-node-resolve": "^13.3.0",
@@ -46,24 +47,25 @@
     "@semantic-release/commit-analyzer": "^9.0.2",
     "@semantic-release/github": "github:semantic-release/github",
     "@semantic-release/npm": "github:semantic-release/npm",
-    "@storybook/addon-a11y": "^7.6.3",
-    "@storybook/addon-actions": "^7.6.3",
-    "@storybook/addon-essentials": "^7.6.3",
-    "@storybook/addon-interactions": "^7.6.3",
-    "@storybook/addon-links": "^7.6.3",
-    "@storybook/addon-styling-webpack": "^0.0.5",
-    "@storybook/addon-themes": "^7.6.3",
-    "@storybook/manager-api": "^7.6.3",
+    "@storybook/addon-a11y": "^8.0.10",
+    "@storybook/addon-actions": "^8.0.10",
+    "@storybook/addon-essentials": "^8.0.10",
+    "@storybook/addon-interactions": "^8.0.10",
+    "@storybook/addon-links": "^8.0.10",
+    "@storybook/addon-styling-webpack": "^1.0.0",
+    "@storybook/addon-themes": "^8.0.10",
+    "@storybook/addon-webpack5-compiler-babel": "^3.0.3",
+    "@storybook/manager-api": "^8.0.10",
     "@storybook/mdx2-csf": "^1.1.0",
-    "@storybook/react": "^7.6.3",
-    "@storybook/react-webpack5": "^7.6.3",
-    "@storybook/testing-library": "^0.2.2",
-    "@storybook/theming": "^7.6.3",
+    "@storybook/react": "^8.0.10",
+    "@storybook/react-webpack5": "^8.0.10",
+    "@storybook/test": "^8.0.10",
+    "@storybook/theming": "^8.0.10",
     "@tailwindcss/forms": "^0.5.7",
     "@testing-library/react": "^14.1.2",
-    "@types/jest": "^27.5.2",
-    "@types/node": "^20.12.7",
-    "@types/react": "^18.3.1",
+    "@types/jest": "^29.5.12",
+    "@types/node": "^20.12.11",
+    "@types/react": "^18.3.2",
     "@typescript-eslint/eslint-plugin": "^6.13.1",
     "@typescript-eslint/parser": "^6.13.1",
     "autoprefixer": "^10.4.19",
@@ -76,15 +78,16 @@
     "eslint-plugin-prettier": "^5.1.3",
     "eslint-plugin-react": "^7.34.1",
     "eslint-plugin-react-hooks": "^4.6.2",
-    "html-webpack-plugin": "^5.5.3",
+    "html-webpack-plugin": "^5.6.0",
     "identity-obj-proxy": "^3.0.0",
-    "jest": "^27.5.1",
+    "jest": "^29.7.0",
+    "jest-environment-jsdom": "^29.7.0",
     "postcss": "^8.4.38",
     "postcss-loader": "^7.3.3",
     "prettier": "3.2.5",
     "prop-types": "^15.8.1",
-    "react": "^18.2.0",
-    "react-dom": "^18.2.0",
+    "react": "^18.3.1",
+    "react-dom": "^18.3.1",
     "resize-observer-polyfill": "^1.5.1",
     "rollup": "^2.79.1",
     "rollup-plugin-dts": "^4.2.3",
@@ -93,13 +96,13 @@
     "rollup-plugin-preserve-directives": "^0.1.1",
     "rollup-plugin-typescript-paths": "^1.4.0",
     "semantic-release": "^22.0.8",
-    "storybook": "^7.6.3",
+    "storybook": "^8.0.10",
     "storybook-source-link": "^4.0.1",
     "style-loader": "^3.3.3",
     "tailwindcss": "^3.4.3",
     "tslib": "^2.6.2",
     "typescript": "^4.9.5",
-    "webpack": "^5.89.0"
+    "webpack": "^5.91.0"
   },
   "peerDependencies": {
     "react": "^18.0.0",
```

**File**: `src/components/chart-elements/common/utils.ts` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ export const constructCategoryColors = (
 ): Map<string, Color | string> => {
   const categoryColors = new Map<string, Color | string>();
   categories.forEach((category, idx) => {
-    categoryColors.set(category, colors[idx]);
+    categoryColors.set(category, colors[idx % colors.length]);
   });
   return categoryColors;
 };
```

---

### Incident Patch 15: `790ed0c6` (2024-04-29)
**Commit Message**: fix: update dependencies (#1027)

* fix: update packages

* fix: lint

**File**: `package.json` (modified, +11/-11)
```diff
@@ -25,12 +25,12 @@
   "homepage": "https://github.com/tremorlabs/tremor#readme",
   "dependencies": {
     "@floating-ui/react": "^0.19.2",
-    "@headlessui/react": "^1.7.18",
+    "@headlessui/react": "^1.7.19",
     "@headlessui/tailwindcss": "^0.2.0",
     "date-fns": "^2.30.0",
     "react-day-picker": "^8.9.1",
     "react-transition-state": "^2.1.1",
-    "recharts": "^2.10.3",
+    "recharts": "^2.12.6",
     "tailwind-merge": "^1.14.0"
   },
   "devDependencies": {
@@ -62,26 +62,26 @@
     "@tailwindcss/forms": "^0.5.7",
     "@testing-library/react": "^14.1.2",
     "@types/jest": "^27.5.2",
-    "@types/node": "^20.10.2",
-    "@types/react": "^18.2.41",
+    "@types/node": "^20.12.7",
+    "@types/react": "^18.3.1",
     "@typescript-eslint/eslint-plugin": "^6.13.1",
     "@typescript-eslint/parser": "^6.13.1",
-    "autoprefixer": "^10.4.16",
+    "autoprefixer": "^10.4.19",
     "babel-jest": "^27.5.1",
     "babel-loader": "^8.3.0",
     "conventional-changelog-conventionalcommits": "^5.0.0",
     "css-loader": "^6.8.1",
     "eslint": "^8.55.0",
     "eslint-config-prettier": "^9.1.0",
-    "eslint-plugin-prettier": "^5.0.1",
-    "eslint-plugin-react": "^7.33.2",
-    "eslint-plugin-react-hooks": "^4.6.0",
+    "eslint-plugin-prettier": "^5.1.3",
+    "eslint-plugin-react": "^7.34.1",
+    "eslint-plugin-react-hooks": "^4.6.2",
     "html-webpack-plugin": "^5.5.3",
     "identity-obj-proxy": "^3.0.0",
     "jest": "^27.5.1",
-    "postcss": "^8.4.32",
+    "postcss": "^8.4.38",
     "postcss-loader": "^7.3.3",
-    "prettier": "3.0.3",
+    "prettier": "3.2.5",
     "prop-types": "^15.8.1",
     "react": "^18.2.0",
     "react-dom": "^18.2.0",
@@ -96,7 +96,7 @@
     "storybook": "^7.6.3",
     "storybook-source-link": "^4.0.1",
     "style-loader": "^3.3.3",
-    "tailwindcss": "^3.4.1",
+    "tailwindcss": "^3.4.3",
     "tslib": "^2.6.2",
     "typescript": "^4.9.5",
     "webpack": "^5.89.0"
```

**File**: `src/components/input-elements/BaseInput.tsx` (modified, +4/-4)
```diff
@@ -183,10 +183,10 @@ const BaseInput = React.forwardRef<HTMLInputElement, BaseInputProps>((props, ref
               type === "password"
                 ? "mr-10"
                 : type === "number"
-                ? stepper
-                  ? "mr-20"
-                  : "mr-3"
-                : "mx-2.5",
+                  ? stepper
+                    ? "mr-20"
+                    : "mr-3"
+                  : "mx-2.5",
             )}
           />
         ) : null}
```

**File**: `src/components/input-elements/Button/Button.tsx` (modified, +2/-2)
```diff
@@ -33,8 +33,8 @@ export const ButtonIconOrSpinner = ({
   const margin = !needMargin
     ? ""
     : iconPosition === HorizontalPositions.Left
-    ? tremorTwMerge("-ml-1", "mr-1.5")
-    : tremorTwMerge("-mr-1", "ml-1.5");
+      ? tremorTwMerge("-ml-1", "mr-1.5")
+      : tremorTwMerge("-mr-1", "ml-1.5");
 
   const defaultSpinnerSize = tremorTwMerge("w-0 h-0");
   const spinnerSize: { [key: string]: any } = {
```

#### Recent Merged Pull Requests:
- **PR #1150** (2025-01-13): fix: icon imports (@severinlandolt)
- **PR #1149** (2025-01-11): chore: readme date (@severinlandolt)
- **PR #1148** (2024-12-28): chore: update urls (@severinlandolt)
- **PR #1147** (closed): chore: sync remote form (@thesergsb)
- **PR #1146** (closed): Beta tremor v4 (@severinlandolt)
- **PR #1145** (2024-12-13): chore: Tremor v4 react19 (@severinlandolt)
- **PR #1144** (closed): feat!: Tremor v4 (@severinlandolt)
- **PR #1143** (2024-12-07): fix: minimum select width (@severinlandolt)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
