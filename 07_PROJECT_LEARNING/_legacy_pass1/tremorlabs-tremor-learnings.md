# Forensic Learning Record (Deep Inspection): tremorlabs/tremor

> **Canonical Artifact**: `07_PROJECT_LEARNING/tremorlabs-tremor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tremorlabs/tremor](https://github.com/tremorlabs/tremor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T17:46:28.449Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tremorlabs/tremor`
- **Description**: Copy & Paste React components to build modern web applications. 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3646 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/hooks/useOnWindowResize.ts`
```
// Tremor useOnWindowResize [v0.0.2]

import * as React from "react"

export const useOnWindowResize = (handler: () => void) => {
  React.useEffect(() => {
    const handleResize = () => {
      handler()
    }
    handleResize()
    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
  }, [handler])
}

```

### Core Architecture Module: `src/hooks/useToast.ts`
```
// Tremor useToast [v0.0.0]

"use client"

import React from "react"

import type { ToastActionElement, ToastProps } from "../components/Toast/Toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

// Updated with https://github.com/shadcn-ui/ui/pull/1038/files
function dispatch(action: Action) {
  if (action.type === "ADD_TOAST") {
    const toastExists = memoryState.toasts.some((t) => t.id === action.toast.id)
    if (toastExists) {
      return
    }
  }
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast & { id?: string }) {
  const id = props?.id || genId()

  const update = (props: Toast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

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
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { toast, useToast }

```

### Core Architecture Module: `src/utils/chartColors.ts`
```
// Tremor chartColors [v0.1.0]

export type ColorUtility = "bg" | "stroke" | "fill" | "text"

export const chartColors = {
  blue: {
    bg: "bg-blue-500",
    stroke: "stroke-blue-500",
    fill: "fill-blue-500",
    text: "text-blue-500",
  },
  emerald: {
    bg: "bg-emerald-500",
    stroke: "stroke-emerald-500",
    fill: "fill-emerald-500",
    text: "text-emerald-500",
  },
  violet: {
    bg: "bg-violet-500",
    stroke: "stroke-violet-500",
    fill: "fill-violet-500",
    text: "text-violet-500",
  },
  amber: {
    bg: "bg-amber-500",
    stroke: "stroke-amber-500",
    fill: "fill-amber-500",
    text: "text-amber-500",
  },
  gray: {
    bg: "bg-gray-500",
    stroke: "stroke-gray-500",
    fill: "fill-gray-500",
    text: "text-gray-500",
  },
  cyan: {
    bg: "bg-cyan-500",
    stroke: "stroke-cyan-500",
    fill: "fill-cyan-500",
    text: "text-cyan-500",
  },
  pink: {
    bg: "bg-pink-500",
    stroke: "stroke-pink-500",
    fill: "fill-pink-500",
    text: "text-pink-500",
  },
  lime: {
    bg: "bg-lime-500",
    stroke: "stroke-lime-500",
    fill: "fill-lime-500",
    text: "text-lime-500",
  },
  fuchsia: {
    bg: "bg-fuchsia-500",
    stroke: "stroke-fuchsia-500",
    fill: "fill-fuchsia-500",
    text: "text-fuchsia-500",
  },
} as const satisfies {
  [color: string]: {
    [key in ColorUtility]: string
  }
}

export type AvailableChartColorsKeys = keyof typeof chartColors

export const AvailableChartColors: AvailableChartColorsKeys[] = Object.keys(
  chartColors,
) as Array<AvailableChartColorsKeys>

export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>()
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length])
  })
  return categoryColors
}

export const getColorClassName = (
  color: AvailableChartColorsKeys,
  type: ColorUtility,
): string => {
  const fallbackColor = {
    bg: "bg-gray-500",
    stroke: "stroke-gray-500",
    fill: "fill-gray-500",
    text: "text-gray-500",
  }
  return chartColors[color]?.[type] ?? fallbackColor[type]
}

```

### Core Architecture Module: `src/utils/cx.ts`
```
// Tremor cx [v0.0.0]

import clsx, { type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args))
}

```

### Core Architecture Module: `src/utils/focusInput.ts`
```
// Tremor focusInput [v0.0.2]

export const focusInput = [
  // base
  "focus:ring-2",
  // ring color
  "focus:ring-blue-200 dark:focus:ring-blue-700/30",
  // border color
  "focus:border-blue-500 dark:focus:border-blue-700",
]

```

### Core Architecture Module: `src/utils/focusRing.ts`
```
// Tremor focusRing [v0.0.1]

export const focusRing = [
  // base
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  // outline color
  "outline-blue-500 dark:outline-blue-500",
]

```

### Core Architecture Module: `src/utils/getYAxisDomain.ts`
```
// Tremor getYAxisDomain [v0.0.0]

export const getYAxisDomain = (
  autoMinValue: boolean,
  minValue: number | undefined,
  maxValue: number | undefined,
) => {
  const minDomain = autoMinValue ? "auto" : (minValue ?? 0)
  const maxDomain = maxValue ?? "auto"
  return [minDomain, maxDomain]
}

```

### Core Architecture Module: `src/utils/hasErrorInput.ts`
```
// Tremor hasErrorInput [v0.0.1]

export const hasErrorInput = [
  // base
  "ring-2",
  // border color
  "border-red-500 dark:border-red-700",
  // ring color
  "ring-red-200 dark:ring-red-700/30",
]

```

### Core Architecture Module: `src/utils/hasOnlyOneValueForKey.ts`
```
/* eslint-disable @typescript-eslint/no-explicit-any */
// Tremor hasOnlyOneValueForKey [v0.1.0]

export function hasOnlyOneValueForKey(
  array: any[],
  keyToCheck: string,
): boolean {
  const val: any[] = []

  for (const obj of array) {
    if (Object.prototype.hasOwnProperty.call(obj, keyToCheck)) {
      val.push(obj[keyToCheck])
      if (val.length > 1) {
        return false
      }
    }
  }

  return true
}

```

### Core Architecture Module: `.storybook/main.ts`
```
import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],

  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y",
  ],

  framework: {
    name: "@storybook/react-vite",
    options: {},
  },

  docs: {},

  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
}
export default config

```

### Core Architecture Module: `.storybook/manager.ts`
```
import { addons } from "@storybook/manager-api"

addons.setConfig({
  panelPosition: "bottom",
  initialActive: "canvas",
})

```

### Core Architecture Module: `.storybook/preview.ts`
```
import type { Preview } from "@storybook/react";
import { themes } from "@storybook/theming";

import "../src/globals.css";

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		docs: {
			theme: window.matchMedia("(prefers-color-scheme: dark)").matches
				? themes.dark
				: themes.light,
		},
		backgrounds: {
			default: "white",
			values: [
				{
					name: "white",
					value: "#ffffff",
				},
				{
					name: "gray 950",
					value: "#030712",
				},
				{
					name: "gray 900",
					value: "#111827",
				},
			],
		},
	},
};

export default preview;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #168** (2026-08-30): **fix(Select): remove asChild from SelectPrimitives.Icon to fix ref error**
  *Symptoms*: Fixes #141  `RiExpandUpDownLine` from `@remixicon/react` is a plain function component with no `forwardRef`. When `asChild` is set on `SelectPrimitives.Icon`, Radix tries to clone the child and forward a ref into it — React rejects this with:  ``` Warning: Function components cannot be given refs. Attempts to access this ref will fail. Did you mean to use React.forwardRef()? ```  Removing `asChild` lets `SelectPrimitives.Icon` use its own built-in `<span>` wrapper, which accepts refs without issue. The icon renders identically visually.
  **Post-Mortem & Fix Analysis**:
  > Closing — targeting higher-traffic repos. The fix itself is valid.

- **Issue #167** (2026-08-30): **fix(dialog): fix flicker and wrong position on open**
  *Symptoms*: Two issues in the Dialog component, same root cause.  `DialogContent` was nested inside `DialogOverlay` which had `overflow-y-auto`. That makes the overlay a scroll container, which breaks `fixed` positioning — so the dialog painted at the wrong spot before snapping to center. Fixed by making them siblings inside `DialogPortal` (the correct Radix pattern).  The flicker (#157) was from the `dialogContentShow` keyframe using `transform: translate(-50%, -45%)` while Tailwind v4 utility classes set the CSS `translate` property separately. Browser composites both, so the dialog starts at -100% on both axes. Rewrote the keyframe to use individual `translate`/`scale` properties instead.  Closes #152, closes #157
  **Post-Mortem & Fix Analysis**:
  > Closing — targeting higher-traffic repos.

- **Issue #164** (2026-08-30): **fix(charts): render Legend before Tooltip so tooltip appears on top**
  *Symptoms*: ## What  In Recharts, the last component declared in JSX renders on the highest layer. All four chart components declared `<RechartsLegend>` **after** `<Tooltip>`, so the legend's DOM layer sat above the tooltip — users saw tooltips hidden or clipped behind the legend on hover.  This PR moves `<RechartsLegend>` **before** `<Tooltip>` in `AreaChart`, `BarChart`, `LineChart`, and `ComboChart`, so the tooltip always renders above the legend.  ## Why  Zero-logic change — purely JSX render order. Recharts uses DOM stacking order for z-index within the SVG overlay, so declaration order is the correct fix.  ## Test  Render any of the affected charts with both `showLegend` and `showTooltip` enabled and hover over a data point near a legend item — the tooltip should now appear fully on top.  Fixes #147
  **Post-Mortem & Fix Analysis**:
  > Closing — targeting higher-traffic repos.

- **Issue #155** (2025-11-22): **Fix overflow scrollbars on Windows for date-range-picker**
  *Symptoms*: Add overflow-auto class to CalendarPrimitive to prevent unnecessary scrollbars on Windows when content fits.  Fixes #122  **Description**  This PR fixes an issue where the date-range-picker (and single date picker) components displayed unnecessary scrollbars on Windows, even when the content did not overflow. The problem was caused by the default `overflow: scroll` behavior in the underlying `react-day-picker` library, which forces scrollbars to appear on Windows.  The fix adds `className="overflow-auto"` to the `CalendarPrimitive` component in both the single and range date picker implementations. This overrides the default overflow behavior, ensuring scrollbars only appear when content actually overflows, improving the user experience on Windows.  **Related issue(s)**  - Fixes #122  **What kind of change does this PR introduce?** (check at least one)  - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [ ] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  - Ran `pnpm lint` on the tremor repository, which passed without errors for the modified file. - The change is a simple CSS class addition that does not

- **Issue #151** (2026-01-31): **[Bug]: Website broken**
  *Symptoms*: ### Tremor Raw Component Version  _No response_  ### Link to minimal reproduction  https://tremor.so/docs/visualizations/line-chart  ### Steps to reproduce  <img width="448" height="140" alt="Image" src="https://github.com/user-attachments/assets/589b152f-93f8-44ec-b337-0ec578c87543" />  ### What is expected?  the site renders  ### What is actually happening?  site shows an error  ### What browsers are you seeing the problem on?  _No response_  ### Any additional comments?  _No response_
  **Post-Mortem & Fix Analysis**:
  > That's because of the WebGL

- **Issue #145** (2026-08-04): **fix: activeIndex is not a property of Pie**
  *Symptoms*: **Description**  <!--- Describe your changes in detail -->  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [X] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [X] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  - [ ] It's submitted to the `main` branch - [ ] Add refs #XXX or fixes #XXX to the related issue section if your PR refers to or fixes an issue. - [ ] My change requires a change to the documentation. (Managed by Tremor Team) - [ ] I have 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #NGZTVaqnvxj4OjQ/hGQEtGQNqzLbt1JMRJpOGNxfQYI=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3Itc3Rvcnlib29rIiwicm9vdERpcmVjdG9yeSI6bnVsbCwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3RyZW1vci90cmVtb3Itc3Rvcnlib29rLzZqYXFha2dDSDFDS2E1a3NqVnNOcEV5Z00xTWUiLCJwcmV2aWV3VXJsIjoidHJlbW9yLXN0b3J5Ym9vay1naXQtZm9yay1kb3ByeS1wYXRjaC0zLXRyZW1vci52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6InRyZW1vci1zdG9yeWJvb2stZ2l0LWZvcmstZG9wcnktcGF0Y2gtMy10cmVtb3IudmVyY2VsLmFwcCJ9fV19 **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | **tremor-storybook** | ✅ Ready ([Inspect](https://vercel.com/tremor/tremor-storybook/6jaqakgCH1CKa5ksjVsNpEygM1Me)) | [Visit Preview](https://tremor-storybook-git-fork-dopry-p

- **Issue #144** (2026-08-04): **fix: BarChart.tsx TS errors**
  *Symptoms*: **Description**  <!--- Describe your changes in detail -->  **Related issue(s)**  <!--- Please link to the issue here: --> <!--- This project only accepts pull requests related to open issues --> <!--- If suggesting a new feature or change, please discuss it in an issue first --> <!--- If fixing a bug, there should be an issue describing it with steps to reproduce -->  **What kind of change does this PR introduce?** (check at least one)  <!-- (Update "[ ]" to "[x]" to check a box) -->  - [X] Bug fix (non-breaking change which fixes an issue) - [ ] New Feature (non-breaking change which adds functionality) - [ ] New Feature (BREAKING CHANGE which adds functionality) - [ ] Refactor - [ ] Build-related changes - [ ] Other, please describe:  **Does this PR introduce a breaking change?** (check one)  - [ ] Yes - [X] No  If yes, please describe the impact and migration path for existing applications:  **How has this been tested?**  <!--- Please describe how you tested your changes. --> <!--- Include details of your testing environment, and the tests you ran to --> <!--- see how your change affects other areas of the code, etc. -->  **Screenshots (if appropriate):**  **The PR fulfils these requirements:**  - [ ] It's submitted to the `main` branch - [ ] Add refs #XXX or fixes #XXX to the related issue section if your PR refers to or fixes an issue. - [ ] My change requires a change to the documentation. (Managed by Tremor Team) - [ ] I have 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #t9A/eFQRpSlOuBeUFzUYd8nOoaSX0dDJXKzLY4PxUqk=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ0cmVtb3Itc3Rvcnlib29rIiwicm9vdERpcmVjdG9yeSI6bnVsbCwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3RyZW1vci90cmVtb3Itc3Rvcnlib29rL0dCckE2N04zMXJMUnBXaUFEZVdEUGNwWHl3c0EiLCJwcmV2aWV3VXJsIjoiIiwibmV4dENvbW1pdFN0YXR1cyI6IkZBSUxFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifX1dfQ== **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | **tremor-storybook** | ❌ Failed ([Inspect](https://vercel.com/tremor/tremor-storybook/GBrA67N31rLRpWiADeWDPcpXywsA)) |  |  | Jul 22, 2025 2:48am |  

- **Issue #137** (2025-05-05): **How to control width of the bar  in bar chart?**
  *Symptoms*: I'm unable to find a way to control the width of the bar in bar chart. When data is very less, bars are extremely wide and looking very ugly.  <img width="1932" alt="Image" src="https://github.com/user-attachments/assets/688bb461-0b71-4368-bf84-1c83cccbbbd1" />  ```           <BarChart           data={data.trend}           index="date"           categories={[             "6a888935-199a-4b18-b9b2-8b9d88e8564a",             "4bd0a5f5-e821-48cf-ac01-b4acfc649d53",           ]}           colors={["blue", "violet", "fuchsia"]}           className="mt-10"          /> ```   What is best way to tackle this?
  **Post-Mortem & Fix Analysis**:
  > You are looking for the `barCategoryGap`, which is percentage or number value.  _The gap between two bar categories, which can be a percent value (string) or a fixed value._

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

### Incident Patch 1: `e3e8e695` (2025-04-12)
**Commit Message**: Revert Update to tailwind v4

**File**: `.storybook/preview.ts` (modified, +35/-35)
```diff
@@ -1,39 +1,39 @@
-import type { Preview } from "@storybook/react"
-import { themes } from "@storybook/theming"
+import type { Preview } from "@storybook/react";
+import { themes } from "@storybook/theming";
 
-import "../src/index.css"
+import "../src/globals.css";
 
 const preview: Preview = {
-  parameters: {
-    controls: {
-      matchers: {
-        color: /(background|color)$/i,
-        date: /Date$/i,
-      },
-    },
-    docs: {
-      theme: window.matchMedia("(prefers-color-scheme: dark)").matches
-        ? themes.dark
-        : themes.light,
-    },
-    backgrounds: {
-      default: "white",
-      values: [
-        {
-          name: "white",
-          value: "#ffffff",
-        },
-        {
-          name: "gray 950",
-          value: "#030712",
-        },
-        {
-          name: "gray 900",
-          value: "#111827",
-        },
-      ],
-    },
-  },
-}
+	parameters: {
+		controls: {
+			matchers: {
+				color: /(background|color)$/i,
+				date: /Date$/i,
+			},
+		},
+		docs: {
+			theme: window.matchMedia("(prefers-color-scheme: dark)").matches
+				? themes.dark
+				: themes.light,
+		},
+		backgrounds: {
+			default: "white",
+			values: [
+				{
+					name: "white",
+					value: "#ffffff",
+				},
+				{
+					name: "gray 950",
+					value: "#030712",
+				},
+				{
+					name: "gray 900",
+					value: "#111827",
+				},
+			],
+		},
+	},
+};
 
-export default preview
+export default preview;
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -58,21 +58,21 @@
     "@storybook/blocks": "^8.6.11",
     "@storybook/react": "^8.6.11",
     "@storybook/react-vite": "^8.6.11",
+    "@tailwindcss/postcss": "^4.1.3",
     "@types/node": "^22.13.14",
     "@types/react": "^18.3.20",
     "@types/react-dom": "^18.3.5",
     "@typescript-eslint/eslint-plugin": "^8.28.0",
     "@typescript-eslint/parser": "^8.28.0",
     "@vitejs/plugin-react": "^4.3.4",
-    "autoprefixer": "^10.4.21",
     "eslint": "^8.57.1",
     "eslint-plugin-react-hooks": "^4.6.2",
     "eslint-plugin-react-refresh": "^0.4.19",
     "eslint-plugin-storybook": "^0.11.6",
     "postcss": "^8.5.3",
     "prettier": "3.3.3",
     "storybook": "^8.6.11",
-    "tailwindcss": "^3.4.17",
+    "tailwindcss": "^4.1.3",
     "typescript": "^5.8.2",
     "vite": "^5.4.15",
     "vite-tsconfig-paths": "^5.1.4",
```

**File**: `pnpm-lock.yaml` (modified, +310/-343)
```diff
@@ -112,7 +112,7 @@ importers:
         version: 2.6.0
       tailwind-variants:
         specifier: ^0.3.1
-        version: 0.3.1(tailwindcss@3.4.17)
+        version: 0.3.1(tailwindcss@4.1.3)
     devDependencies:
       '@playwright/test':
         specifier: ^1.51.1
@@ -134,7 +134,10 @@ importers:
         version: 8.6.11(@storybook/test@8.6.11(storybook@8.6.11(prettier@3.3.3)))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(storybook@8.6.11(prettier@3.3.3))(typescript@5.8.2)
       '@storybook/react-vite':
         specifier: ^8.6.11
-        version: 8.6.11(@storybook/test@8.6.11(storybook@8.6.11(prettier@3.3.3)))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(rollup@4.38.0)(storybook@8.6.11(prettier@3.3.3))(typescript@5.8.2)(vite@5.4.15(@types/node@22.13.14))
+        version: 8.6.11(@storybook/test@8.6.11(storybook@8.6.11(prettier@3.3.3)))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(rollup@4.38.0)(storybook@8.6.11(prettier@3.3.3))(typescript@5.8.2)(vite@5.4.15(@types/node@22.13.14)(lightningcss@1.29.2))
+      '@tailwindcss/postcss':
+        specifier: ^4.1.3
+        version: 4.1.3
       '@types/node':
         specifier: ^22.13.14
         version: 22.13.14
@@ -152,10 +155,7 @@ importers:
         version: 8.28.0(eslint@8.57.1)(typescript@5.8.2)
       '@vitejs/plugin-react':
         specifier: ^4.3.4
-        version: 4.3.4(vite@5.4.15(@types/node@22.13.14))
-      autoprefixer:
-        specifier: ^10.4.21
-        version: 10.4.21(postcss@8.5.3)
+        version: 4.3.4(vite@5.4.15(@types/node@22.13.14)(lightningcss@1.29.2))
       eslint:
         specifier: ^8.57.1
         version: 8.57.1
@@ -178,20 +178,20 @@ importers:
         specifier: ^8.6.11
         version: 8.6.11(prettier@3.3.3)
       tailwindcss:
-        specifier: ^3.4.17
-        version: 3.4.17
+        specifier: ^4.1.3
+        version: 4.1.3
       typescript:
         specifier: ^5.8.2
         version: 5.8.2
       vite:
         specifier: ^5.4.15
-        version: 5.4.15(@types/node@22.13.14)
+        version: 5.4.15(@types/node@22.13.14)(lightningcss@1.29.2)
       vite-tsconfig-paths:
         specifier: ^5.1.4
-        version: 5.1.4(typescript@5.8.2)(vite@5.4.15(@types/node@22.13.14))
+        version: 5.1.4(typescript@5.8.2)(vite@5.4.15(@types/node@22.13.14)(lightningcss@1.29.2))
       vitest:
         specifier: ^2.1.9
-        version: 2.1.9(@types/node@22.13.14)
+        version: 2.1.9(@types/node@22.13.14)(lightningcss@1.29.2)
 
 packages:
 
@@ -1625,6 +1625,82 @@ packages:
   '@swc/helpers@0.5.15':
     resolution: {integrity: sha512-JQ5TuMi45Owi4/BIMAJBoSQoOJu12oOk/gADqlcUL9JEdHB8vyjUSsxqeNXnmXHjYKMi2WcYtezGEEhqUI/E2g==}
 
+  '@tailwindcss/node@4.1.3':
+    resolution: {integrity: sha512-H/6r6IPFJkCfBJZ2dKZiPJ7Ueb2wbL592+9bQEl2r73qbX6yGnmQVIfiUvDRB2YI0a3PWDrzUwkvQx1XW1bNkA==}
+
+  '@tailwindcss/oxide-android-arm64@4.1.3':
+    resolution: {integrity: sha512-cxklKjtNLwFl3mDYw4XpEfBY+G8ssSg9ADL4Wm6//5woi3XGqlxFsnV5Zb6v07dxw1NvEX2uoqsxO/zWQsgR+g==}
+    engines: {node: '>= 10'}
+    cpu: [arm64]
+    os: [android]
+
+  '@tailwindcss/oxide-darwin-arm64@4.1.3':
+    resolution: {integrity: sha512-mqkf2tLR5VCrjBvuRDwzKNShRu99gCAVMkVsaEOFvv6cCjlEKXRecPu9DEnxp6STk5z+Vlbh1M5zY3nQCXMXhw==}
+    engines: {node: '>= 10'}
+    cpu: [arm64]
+    os: [darwin]
+
+  '@tailwindcss/oxide-darwin-x64@4.1.3':
+    resolution: {integrity: sha512-7sGraGaWzXvCLyxrc7d+CCpUN3fYnkkcso3rCzwUmo/LteAl2ZGCDlGvDD8Y/1D3ngxT8KgDj1DSwOnNewKhmg==}
+    engines: {node: '>= 10'}
+    cpu: [x64]
+    os: [darwin]
+
+  '@tailwindcss/oxide-freebsd-x64@4.1.3':
+    resolution: {integrity: sha512-E2+PbcbzIReaAYZe997wb9rId246yDkCwAakllAWSGqe6VTg9hHle67hfH6ExjpV2LSK/siRzBUs5wVff3RW9w==}
+    engines: {node: '>= 10'}
+    cpu: [x64]
+    os: [freebsd]
+
+  '@tailwindcss/oxide-linux-arm-gnueabihf@4.1.3':
+    resolution: {integrity: sha512-GvfbJ8wjSSjbLFFE3UYz4Eh8i4L6GiEYqCtA8j2Zd2oXriPuom/Ah/64pg/szWycQpzRnbDiJozoxFU2oJZyfg==}
+    engines: {node: '>= 10'}
+    cpu: [arm]
+    os: [linux]
+
+  '@tailwindcss/oxide-linux-arm64-gnu@4.1.3':
+    resolution: {integrity: sha512-35UkuCWQTeG9BHcBQXndDOrpsnt3Pj9NVIB4CgNiKmpG8GnCNXeMczkUpOoqcOhO6Cc/mM2W7kaQ/MTEENDDXg==}
+    engines: {node: '>= 10'}
+    cpu: [arm64]
+    os: [linux]
+
+  '@tailwindcss/oxide-linux-arm64-musl@4.1.3':
+    resolution: {integrity: sha512-dm18aQiML5QCj9DQo7wMbt1Z2tl3Giht54uVR87a84X8qRtuXxUqnKQkRDK5B4bCOmcZ580lF9YcoMkbDYTXHQ==}
+    engines: {node: '>= 10'}
+    cpu: [arm64]
+    os: [linux]
+
+  '@tailwindcss/oxide-linux-x64-gnu@4.1.3':
+    resolution: {integrity: sha512-LMdTmGe/NPtGOaOfV2HuO7w07jI3cflPrVq5CXl+2O93DCewADK0uW1ORNAcfu2YxDUS035eY2W38TxrsqngxA==}
+    engines: {node: '>= 10'}
+    cpu: [x64]
+    os: [linux]
+
+  '@tailwindcss/oxide-linux-x64-musl@4.1.3':
+    resolution: {integrity: sha512-aalNWwIi54bbFEizwl1/XpmdDrOaCjRFQRgtbv9slWjmNPuJJTIKPHf5/XXDARc9CneW9FkSTqTbyvNecYAEGw==}
+    engines: {node: '>= 10'}
+    cpu: [x64]
+    os: [linux]
+
+  '@tailwindcss/oxide-w
```

**File**: `postcss.config.js` (modified, +1/-2)
```diff
@@ -1,6 +1,5 @@
 export default {
   plugins: {
-    tailwindcss: {},
-    autoprefixer: {},
+    '@tailwindcss/postcss': {},
   },
 }
```

**File**: `src/components/Accordion/Accordion.tsx` (modified, +6/-6)
```diff
@@ -1,4 +1,4 @@
-// Tremor Accordion [v0.0.1]
+// Tremor Accordion [v1.0.0]
 
 import React from "react"
 import * as AccordionPrimitives from "@radix-ui/react-accordion"
@@ -18,13 +18,13 @@ const AccordionTrigger = React.forwardRef<
     <AccordionPrimitives.Trigger
       className={cx(
         // base
-        "group flex flex-1 cursor-pointer items-center justify-between py-3 text-left text-sm font-medium leading-none",
+        "group flex flex-1 cursor-pointer items-center justify-between py-3 text-left text-sm leading-none font-medium",
         // text color
         "text-gray-900 dark:text-gray-50",
         // disabled
-        "data-[disabled]:cursor-default data-[disabled]:text-gray-400 dark:data-[disabled]:text-gray-600",
+        "data-disabled:cursor-default data-disabled:text-gray-400 dark:data-disabled:text-gray-600",
         //focus
-        "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
+        "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden focus-visible:ring-inset",
         className,
       )}
       {...props}
@@ -38,7 +38,7 @@ const AccordionTrigger = React.forwardRef<
           // text color
           "text-gray-400 dark:text-gray-600",
           // disabled
-          "group-data-[disabled]:text-gray-300 group-data-[disabled]:dark:text-gray-700",
+          "group-data-disabled:text-gray-300 dark:group-data-disabled:text-gray-700",
         )}
         aria-hidden="true"
         focusable="false"
@@ -56,7 +56,7 @@ const AccordionContent = React.forwardRef<
   <AccordionPrimitives.Content
     ref={forwardedRef}
     className={cx(
-      "transform-gpu data-[state=closed]:animate-accordionClose data-[state=open]:animate-accordionOpen",
+      "data-[state=closed]:animate-accordion-close data-[state=open]:animate-accordion-open transform-gpu",
     )}
     {...props}
   >
```

**File**: `src/components/Accordion/accordion.stories.tsx` (modified, +3/-3)
```diff
@@ -226,7 +226,7 @@ export const DefaultValueAndCollapsibleDisabled: Story = {
         <AccordionItem value="item-2">
           <AccordionTrigger>
             <span className="flex items-center gap-2">
-              <RiArrowLeftRightLine className="size-4 text-blue-500 group-data-[disabled]:text-blue-200 dark:group-data-[disabled]:text-blue-900" />
+              <RiArrowLeftRightLine className="size-4 text-blue-500 group-data-disabled:text-blue-200 dark:group-data-disabled:text-blue-900" />
               Change Flights
             </span>
           </AccordionTrigger>
@@ -264,7 +264,7 @@ export const DefaultValueAndCollapsibleDisabled: Story = {
         <AccordionItem value="item-3" disabled>
           <AccordionTrigger>
             <span className="flex items-center gap-2">
-              <RiAddCircleFill className="size-4 text-blue-500 group-data-[disabled]:text-blue-200 dark:group-data-[disabled]:text-blue-900" />
+              <RiAddCircleFill className="size-4 text-blue-500 group-data-disabled:text-blue-200 dark:group-data-disabled:text-blue-900" />
               Add Special Requests
             </span>
           </AccordionTrigger>
@@ -279,7 +279,7 @@ export const DefaultValueAndCollapsibleDisabled: Story = {
         <AccordionItem value="item-4">
           <AccordionTrigger>
             <span className="flex items-center gap-2">
-              <RiCheckboxMultipleFill className="size-4 text-blue-500 group-data-[disabled]:text-blue-200 dark:group-data-[disabled]:text-blue-900" />
+              <RiCheckboxMultipleFill className="size-4 text-blue-500 group-data-disabled:text-blue-200 dark:group-data-disabled:text-blue-900" />
               Check-In Online
             </span>
           </AccordionTrigger>
```

**File**: `src/components/Accordion/changelog.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Tremor Accordion Changelog
 
+## 1.0.0
+
+### Changes
+
+- BREAKING CHANGE: Tailwind CSS v4
+
 ## 0.0.1
 
 ### Changes
```

**File**: `src/components/AreaChart/AreaChart.tsx` (modified, +10/-10)
```diff
@@ -1,4 +1,4 @@
-// Tremor AreaChart [v0.3.1]
+// Tremor AreaChart [v1.0.0]
 /* eslint-disable @typescript-eslint/no-explicit-any */
 
 "use client"
@@ -18,12 +18,12 @@ import {
   XAxis,
   YAxis,
 } from "recharts"
-import { AxisDomain } from "recharts/types/util/types"
+import type { AxisDomain } from "recharts/types/util/types"
 
 import { useOnWindowResize } from "../../hooks/useOnWindowResize"
 import {
   AvailableChartColors,
-  AvailableChartColorsKeys,
+  type AvailableChartColorsKeys,
   constructCategoryColors,
   getColorClassName,
 } from "../../utils/chartColors"
@@ -51,7 +51,7 @@ const LegendItem = ({
     <li
       className={cx(
         // base
-        "group inline-flex flex-nowrap items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 transition",
+        "group inline-flex flex-nowrap items-center gap-1.5 rounded-sm px-2 py-1 whitespace-nowrap transition",
         hasOnValueChange
           ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
           : "cursor-default",
@@ -72,7 +72,7 @@ const LegendItem = ({
       <p
         className={cx(
           // base
-          "truncate whitespace-nowrap text-xs",
+          "truncate text-xs whitespace-nowrap",
           // text color
           "text-gray-700 dark:text-gray-300",
           hasOnValueChange &&
@@ -120,7 +120,7 @@ const ScrollButton = ({ icon, onClick, disabled }: ScrollButtonProps) => {
       type="button"
       className={cx(
         // base
-        "group inline-flex size-5 items-center truncate rounded transition",
+        "group inline-flex size-5 items-center truncate rounded-sm transition",
         disabled
           ? "cursor-not-allowed text-gray-400 dark:text-gray-600"
           : "cursor-pointer text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-50",
@@ -265,7 +265,7 @@ const Legend = React.forwardRef<HTMLOListElement, LegendProps>((props, ref) => {
           "flex h-full",
           enableLegendSlider
             ? hasScroll?.right || hasScroll?.left
-              ? "snap-mandatory items-center overflow-auto pl-4 pr-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
+              ? "snap-mandatory items-center overflow-auto pr-12 pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
               : ""
             : "flex-wrap",
         )}
@@ -285,7 +285,7 @@ const Legend = React.forwardRef<HTMLOListElement, LegendProps>((props, ref) => {
           <div
             className={cx(
               // base
-              "absolute bottom-0 right-0 top-0 flex h-full items-center justify-center pr-1",
+              "absolute top-0 right-0 bottom-0 flex h-full items-center justify-center pr-1",
               // background color
               "bg-white dark:bg-gray-950",
             )}
@@ -429,7 +429,7 @@ const ChartTooltip = ({
                 <p
                   className={cx(
                     // base
-                    "whitespace-nowrap text-right",
+                    "text-right whitespace-nowrap",
                     // text color
                     "text-gray-700 dark:text-gray-300",
                   )}
@@ -440,7 +440,7 @@ const ChartTooltip = ({
               <p
                 className={cx(
                   // base
-                  "whitespace-nowrap text-right font-medium tabular-nums",
+                  "text-right font-medium whitespace-nowrap tabular-nums",
                   // text color
                   "text-gray-900 dark:text-gray-50",
                 )}
```

---

### Incident Patch 2: `9b906e0e` (2025-01-01)
**Commit Message**: fix: `Drawer` and `DatePicker` (#106)

* fix: drawer z index

* fix: date picker

**File**: `src/components/DatePicker/DatePicker.tsx` (modified, +8/-8)
```diff
@@ -1,4 +1,4 @@
-// Tremor Date Picker [v1.0.4]
+// Tremor Date Picker [v1.0.5]
 
 "use client"
 
@@ -56,7 +56,7 @@ const TimeSegment = ({ segment, state }: TimeSegmentProps) => {
   const { segmentProps } = useDateSegment(segment, state, ref)
 
   const isColon = segment.type === "literal" && segment.text === ":"
-  const isSpace = segment.type === "literal" && segment.text === " "
+  const isSpace = segment.type === "literal" && segment.text === " "
 
   const isDecorator = isColon || isSpace
 
@@ -99,7 +99,7 @@ const TimeSegment = ({ segment, state }: TimeSegmentProps) => {
       >
         {segment.placeholder}
       </span>
-      {segment.isPlaceholder ? "" : segment.text}
+      {segment.isPlaceholder ? " " : segment.text}
     </div>
   )
 }
@@ -500,7 +500,7 @@ const SingleDatePicker = ({
   )
   const [month, setMonth] = React.useState<Date | undefined>(date)
 
-  const [time, setTime] = React.useState<TimeValue>(
+  const [time, setTime] = React.useState<TimeValue | null>(
     value
       ? new Time(value.getHours(), value.getMinutes())
       : defaultValue
@@ -562,7 +562,7 @@ const SingleDatePicker = ({
     setDate(newDate)
   }
 
-  const onTimeChange = (time: TimeValue) => {
+  const onTimeChange = (time: TimeValue | null) => {
     setTime(time)
 
     if (!date) {
@@ -729,14 +729,14 @@ const RangeDatePicker = ({
   )
   const [month, setMonth] = React.useState<Date | undefined>(range?.from)
 
-  const [startTime, setStartTime] = React.useState<TimeValue>(
+  const [startTime, setStartTime] = React.useState<TimeValue | null>(
     value?.from
       ? new Time(value.from.getHours(), value.from.getMinutes())
       : defaultValue?.from
         ? new Time(defaultValue.from.getHours(), defaultValue.from.getMinutes())
         : new Time(0, 0),
   )
-  const [endTime, setEndTime] = React.useState<TimeValue>(
+  const [endTime, setEndTime] = React.useState<TimeValue | null>(
     value?.to
       ? new Time(value.to.getHours(), value.to.getMinutes())
       : defaultValue?.to
@@ -814,7 +814,7 @@ const RangeDatePicker = ({
     setOpen(open)
   }
 
-  const onTimeChange = (time: TimeValue, pos: "start" | "end") => {
+  const onTimeChange = (time: TimeValue | null, pos: "start" | "end") => {
     switch (pos) {
       case "start":
         setStartTime(time)
```

**File**: `src/components/DatePicker/changelog.md` (modified, +7/-0)
```diff
@@ -1,5 +1,12 @@
 # Tremor Date Picker Changelog
 
+## 1.0.5
+
+### Changes
+
+- Fix: State types
+- Fix: TimeInput visibility
+
 ## 1.0.4
 
 ### Changes
```

**File**: `src/components/Drawer/Drawer.tsx` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-// Tremor Drawer [v0.0.1]
+// Tremor Drawer [v0.0.2]
 
 import * as React from "react"
 import * as DrawerPrimitives from "@radix-ui/react-dialog"
@@ -77,7 +77,7 @@ const DrawerContent = React.forwardRef<
           ref={forwardedRef}
           className={cx(
             // base
-            "fixed inset-y-2 mx-auto flex w-[95vw] flex-1 flex-col overflow-y-auto rounded-md border p-4 shadow-lg focus:outline-none max-sm:inset-x-2 sm:inset-y-2 sm:right-2 sm:max-w-lg sm:p-6",
+            "fixed inset-y-2 z-50 mx-auto flex w-[95vw] flex-1 flex-col overflow-y-auto rounded-md border p-4 shadow-lg focus:outline-none max-sm:inset-x-2 sm:inset-y-2 sm:right-2 sm:max-w-lg sm:p-6",
             // border color
             "border-gray-200 dark:border-gray-900",
             // background color
```

**File**: `src/components/Drawer/changelog.md` (modified, +6/-0)
```diff
@@ -4,4 +4,10 @@
 
 ### Changes
 
+- Fix: `z-index` content
+
+## 0.0.1
+
+### Changes
+
 - Chore: Add `tremor-id`
```

---

### Incident Patch 3: `53c79e5d` (2024-11-12)
**Commit Message**: fix: aria alignment (#100)

* fix: aria alignment

* fix: category bar and tests

* feat: tooltip

* chore: update tailwind variants

* chore: update storybook

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -71,3 +71,4 @@ next-env.d.ts
 /playwright-report/
 /blob-report/
 /playwright/.cache/
+/storybook-static/
```

**File**: `.storybook/main.ts` (modified, +7/-2)
```diff
@@ -2,18 +2,23 @@ import type { StorybookConfig } from "@storybook/react-vite"
 
 const config: StorybookConfig = {
   stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
+
   addons: [
     "@storybook/addon-links",
     "@storybook/addon-essentials",
     "@storybook/addon-interactions",
     "@storybook/addon-a11y",
   ],
+
   framework: {
     name: "@storybook/react-vite",
     options: {},
   },
-  docs: {
-    autodocs: "tag",
+
+  docs: {},
+
+  typescript: {
+    reactDocgen: "react-docgen-typescript",
   },
 }
 export default config
```

**File**: `package.json` (modified, +19/-20)
```diff
@@ -14,7 +14,7 @@
     "test:all": "npx vitest run && npx playwright test"
   },
   "dependencies": {
-    "@ianvs/prettier-plugin-sort-imports": "^4.3.1",
+    "@ianvs/prettier-plugin-sort-imports": "^4.4.0",
     "@internationalized/date": "^3.5.6",
     "@radix-ui/react-accordion": "^1.2.1",
     "@radix-ui/react-checkbox": "^1.1.2",
@@ -35,9 +35,9 @@
     "@react-aria/datepicker": "^3.11.4",
     "@react-stately/datepicker": "^3.10.3",
     "@remixicon/react": "^4.5.0",
-    "@storybook/addon-a11y": "^8.4.1",
-    "@storybook/manager-api": "^8.4.1",
-    "@storybook/theming": "^8.4.1",
+    "@storybook/addon-a11y": "^8.4.2",
+    "@storybook/manager-api": "^8.4.2",
+    "@storybook/theming": "^8.4.2",
     "clsx": "^2.1.1",
     "date-fns": "^3.6.0",
     "prettier-plugin-tailwindcss": "^0.6.8",
@@ -46,35 +46,34 @@
     "react-dom": "^18.3.1",
     "recharts": "^2.13.3",
     "tailwind-merge": "^2.5.4",
-    "tailwind-variants": "^0.2.1"
+    "tailwind-variants": "^0.3.0"
   },
   "devDependencies": {
     "@playwright/test": "^1.48.2",
-    "@storybook/addon-essentials": "^8.4.1",
-    "@storybook/addon-interactions": "^8.4.1",
-    "@storybook/addon-links": "^8.4.1",
-    "@storybook/blocks": "^8.4.1",
-    "@storybook/react": "^8.4.1",
-    "@storybook/react-vite": "^8.4.1",
-    "@storybook/test": "^8.4.1",
-    "@types/node": "^22.8.7",
+    "@storybook/addon-essentials": "^8.4.2",
+    "@storybook/addon-interactions": "^8.4.2",
+    "@storybook/addon-links": "^8.4.2",
+    "@storybook/blocks": "^8.4.2",
+    "@storybook/react": "^8.4.2",
+    "@storybook/react-vite": "^8.4.2",
+    "@types/node": "^22.9.0",
     "@types/react": "^18.3.12",
     "@types/react-dom": "^18.3.1",
-    "@typescript-eslint/eslint-plugin": "^8.12.2",
-    "@typescript-eslint/parser": "^8.12.2",
+    "@typescript-eslint/eslint-plugin": "^8.14.0",
+    "@typescript-eslint/parser": "^8.14.0",
     "@vitejs/plugin-react": "^4.3.3",
     "autoprefixer": "^10.4.20",
     "eslint": "^8.57.1",
     "eslint-plugin-react-hooks": "^4.6.2",
     "eslint-plugin-react-refresh": "^0.4.14",
-    "eslint-plugin-storybook": "^0.10.2",
-    "postcss": "^8.4.47",
+    "eslint-plugin-storybook": "^0.11.0",
+    "postcss": "^8.4.49",
     "prettier": "3.3.3",
-    "storybook": "^8.4.1",
+    "storybook": "^8.4.2",
     "tailwindcss": "^3.4.14",
     "typescript": "^5.6.3",
-    "vite": "^5.4.10",
-    "vite-tsconfig-paths": "^5.0.1",
+    "vite": "^5.4.11",
+    "vite-tsconfig-paths": "^5.1.2",
     "vitest": "^2.1.4"
   }
 }
```

**File**: `pnpm-lock.yaml` (modified, +437/-450)
```diff
@@ -9,8 +9,8 @@ importers:
   .:
     dependencies:
       '@ianvs/prettier-plugin-sort-imports':
-        specifier: ^4.3.1
-        version: 4.3.1(prettier@3.3.3)
+        specifier: ^4.4.0
+        version: 4.4.0(prettier@3.3.3)
       '@internationalized/date':
         specifier: ^3.5.6
         version: 3.5.6
@@ -72,14 +72,14 @@ importers:
         specifier: ^4.5.0
         version: 4.5.0(react@18.3.1)
       '@storybook/addon-a11y':
-        specifier: ^8.4.1
-        version: 8.4.1(storybook@8.4.1(prettier@3.3.3))
+        specifier: ^8.4.2
+        version: 8.4.2(storybook@8.4.2(prettier@3.3.3))
       '@storybook/manager-api':
-        specifier: ^8.4.1
-        version: 8.4.1(storybook@8.4.1(prettier@3.3.3))
+        specifier: ^8.4.2
+        version: 8.4.2(storybook@8.4.2(prettier@3.3.3))
       '@storybook/theming':
-        specifier: ^8.4.1
-        version: 8.4.1(storybook@8.4.1(prettier@3.3.3))
+        specifier: ^8.4.2
+        version: 8.4.2(storybook@8.4.2(prettier@3.3.3))
       clsx:
         specifier: ^2.1.1
         version: 2.1.1
@@ -88,7 +88,7 @@ importers:
         version: 3.6.0
       prettier-plugin-tailwindcss:
         specifier: ^0.6.8
-        version: 0.6.8(@ianvs/prettier-plugin-sort-imports@4.3.1(prettier@3.3.3))(prettier@3.3.3)
+        version: 0.6.8(@ianvs/prettier-plugin-sort-imports@4.4.0(prettier@3.3.3))(prettier@3.3.3)
       react:
         specifier: ^18.3.1
         version: 18.3.1
@@ -105,54 +105,51 @@ importers:
         specifier: ^2.5.4
         version: 2.5.4
       tailwind-variants:
-        specifier: ^0.2.1
-        version: 0.2.1(tailwindcss@3.4.14)
+        specifier: ^0.3.0
+        version: 0.3.0(tailwindcss@3.4.14)
     devDependencies:
       '@playwright/test':
         specifier: ^1.48.2
         version: 1.48.2
       '@storybook/addon-essentials':
-        specifier: ^8.4.1
-        version: 8.4.1(@types/react@18.3.12)(storybook@8.4.1(prettier@3.3.3))(webpack-sources@3.2.3)
+        specifier: ^8.4.2
+        version: 8.4.2(@types/react@18.3.12)(storybook@8.4.2(prettier@3.3.3))
       '@storybook/addon-interactions':
-        specifier: ^8.4.1
-        version: 8.4.1(storybook@8.4.1(prettier@3.3.3))
+        specifier: ^8.4.2
+        version: 8.4.2(storybook@8.4.2(prettier@3.3.3))
       '@storybook/addon-links':
-        specifier: ^8.4.1
-        version: 8.4.1(react@18.3.1)(storybook@8.4.1(prettier@3.3.3))
+        specifier: ^8.4.2
+        version: 8.4.2(react@18.3.1)(storybook@8.4.2(prettier@3.3.3))
       '@storybook/blocks':
-        specifier: ^8.4.1
-        version: 8.4.1(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(storybook@8.4.1(prettier@3.3.3))
+        specifier: ^8.4.2
+        version: 8.4.2(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(storybook@8.4.2(prettier@3.3.3))
       '@storybook/react':
-        specifier: ^8.4.1
-        version: 8.4.1(@storybook/test@8.4.1(storybook@8.4.1(prettier@3.3.3)))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(storybook@8.4.1(prettier@3.3.3))(typescript@5.6.3)
+        specifier: ^8.4.2
+        version: 8.4.2(@storybook/test@8.4.2(storybook@8.4.2(prettier@3.3.3)))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(storybook@8.4.2(prettier@3.3.3))(typescript@5.6.3)
       '@storybook/react-vite':
-        specifier: ^8.4.1
-        version: 8.4.1(@storybook/test@8.4.1(storybook@8.4.1(prettier@3.3.3)))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(rollup@4.24.3)(storybook@8.4.1(prettier@3.3.3))(typescript@5.6.3)(vite@5.4.10(@types/node@22.8.7))(webpack-sources@3.2.3)
-      '@storybook/test':
-        specifier: ^8.4.1
-        version: 8.4.1(storybook@8.4.1(prettier@3.3.3))
+        specifier: ^8.4.2
+        version: 8.4.2(@storybook/test@8.4.2(storybook@8.4.2(prettier@3.3.3)))(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(rollup@4.25.0)(storybook@8.4.2(prettier@3.3.3))(typescript@5.6.3)(vite@5.4.11(@types/node@22.9.0))
       '@types/node':
-        specifier: ^22.8.7
-        version: 22.8.7
+        specifier: ^22.9.0
+        version: 22.9.0
       '@types/react':
         specifier: ^18.3.12
         version: 18.3.12
       '@types/react-dom':
         specifier: ^18.3.1
         version: 18.3.1
       '@typescript-eslint/eslint-plugin':
-        specifier: ^8.12.2
-        version: 8.12.2(@typescript-eslint/parser@8.12.2(eslint@8.57.1)(typescript@5.6.3))(eslint@8.57.1)(typescript@5.6.3)
+        specifier: ^8.14.0
+        version: 8.14.0(@typescript-eslint/parser@8.14.0(eslint@8.57.1)(typescript@5.6.3))(eslint@8.57.1)(typescript@5.6.3)
       '@typescript-eslint/parser':
-        specifier: ^8.12.2
-        version: 8.12.2(eslint@8.57.1)(typescript@5.6.3)
+        specifier: ^8.14.0
+        version: 8.14.0(eslint@8.57.1)(typescript@5.6.3)
       '@vitejs/plugin-react':
         specifier: ^4.3.3
-        version: 4.3.3(vite@5.4.10(@types/node@22.8.7))
+        version: 4.3.3(vite@5.4.11(@types/node@22.9.0))
       autoprefixer:
         specifier: ^10.4.20
-        version: 10.4.
```

**File**: `src/components/CategoryBar/CategoryBar.tsx` (modified, +11/-12)
```diff
@@ -1,4 +1,4 @@
-// Tremor CategoryBar [v0.0.2]
+// Tremor CategoryBar [v0.0.3]
 
 "use client"
 
@@ -67,6 +67,7 @@ const BarLabels = ({ values }: { values: number[] }) => {
         "text-gray-700 dark:text-gray-300",
       )}
     >
+      <div className="absolute bottom-0 left-0 flex items-center">0</div>
       {values.map((widthPercentage, index) => {
         prefixSum += widthPercentage
 
@@ -89,18 +90,16 @@ const BarLabels = ({ values }: { values: number[] }) => {
             className="flex items-center justify-end pr-0.5"
             style={{ width: `${widthPositionLeft}%` }}
           >
-            <span
-              className={cx(
-                showLabel ? "block" : "hidden",
-                "translate-x-1/2 text-sm tabular-nums",
-              )}
-            >
-              {formatNumber(prefixSum)}
-            </span>
+            {showLabel ? (
+              <span
+                className={cx("block translate-x-1/2 text-sm tabular-nums")}
+              >
+                {formatNumber(prefixSum)}
+              </span>
+            ) : null}
           </div>
         )
       })}
-      <div className="absolute bottom-0 left-0 flex items-center">0</div>
       <div className="absolute bottom-0 right-0 flex items-center">
         {formatNumber(sumValues)}
       </div>
@@ -150,7 +149,7 @@ const CategoryBar = React.forwardRef<HTMLDivElement, CategoryBarProps>(
       <div
         ref={forwardedRef}
         className={cx(className)}
-        aria-label="category bar"
+        aria-label="Category bar"
         aria-valuenow={marker?.value}
         tremor-id="tremor-raw"
         {...props}
@@ -190,7 +189,7 @@ const CategoryBar = React.forwardRef<HTMLDivElement, CategoryBarProps>(
               }}
             >
               {marker.tooltip ? (
-                <Tooltip triggerAsChild content={marker.tooltip}>
+                <Tooltip asChild content={marker.tooltip}>
                   <div
                     aria-hidden="true"
                     className={cx(
```

**File**: `src/components/CategoryBar/categorybar.spec.ts` (modified, +55/-54)
```diff
@@ -1,71 +1,72 @@
 import { expect, test } from "@playwright/test"
 
-test.describe("Expect progressbar default", () => {
-  test("to be rendered", async ({ page }) => {
-    await page.goto(
-      "http://localhost:6006/?path=/story/visualization-progressbar--default",
+test.describe("CategoryBar Component", () => {
+  const STORY_URL =
+    "http://localhost:6006/?path=/story/visualization-categorybar--default"
+
+  test("renders the category bar component", async ({ page }) => {
+    await page.goto(STORY_URL)
+    const storyFrame = page.frameLocator(
+      'iframe[title="storybook-preview-iframe"]',
     )
-    await expect(
-      page
-        .frameLocator('iframe[title="storybook-preview-iframe"]')
-        .getByTestId("progressbar"),
-    ).toBeVisible()
+
+    await expect(storyFrame.getByTestId("category-bar")).toBeVisible()
   })
 
-  test("to have a background bar", async ({ page }) => {
-    await page.goto(
-      "http://localhost:6006/?path=/story/visualization-progressbar--default",
+  test("displays correct label values", async ({ page }) => {
+    await page.goto(STORY_URL)
+    const storyFrame = page.frameLocator(
+      'iframe[title="storybook-preview-iframe"]',
     )
-    await expect(
-      page
-        .frameLocator('iframe[title="storybook-preview-iframe"]')
-        .getByTestId("progressbar"),
-    ).toBeVisible()
-    await expect(
-      page
-        .frameLocator('iframe[title="storybook-preview-iframe"]')
-        .getByLabel("progress bar"),
-    ).toBeVisible()
+    await expect(storyFrame.getByText("0").first()).toBeVisible()
+    await expect(storyFrame.getByText("70")).toBeVisible()
+    await expect(storyFrame.getByText("88")).toBeVisible()
+    await expect(storyFrame.getByText("100")).toBeVisible()
   })
 
-  test("to have a background and indicator bar", async ({ page }) => {
-    await page.goto(
-      "http://localhost:6006/?path=/story/visualization-progressbar--default",
+  test("renders all category segments", async ({ page }) => {
+    await page.goto(STORY_URL)
+    const storyFrame = page.frameLocator(
+      'iframe[title="storybook-preview-iframe"]',
     )
-    await expect(
-      page
-        .frameLocator('iframe[title="storybook-preview-iframe"]')
-        .getByTestId("progressbar"),
-    ).toBeVisible()
-    await expect(
-      page
-        .frameLocator('iframe[title="storybook-preview-iframe"]')
-        .getByLabel("progress bar"),
-    ).toBeVisible()
-    await expect(
-      page
-        .frameLocator('iframe[title="storybook-preview-iframe"]')
-        .getByLabel("progress bar")
-        .locator("div"),
-    ).toBeVisible()
+    const categoryBar = storyFrame.getByTestId("category-bar")
+    const segments = categoryBar.locator("div.h-full[style*='width']")
+
+    await expect(segments).toHaveCount(3)
   })
 
-  test("to have a label", async ({ page }) => {
+  test("renders with marker when provided", async ({ page }) => {
     await page.goto(
-      "http://localhost:6006/?path=/story/visualization-progressbar--default",
+      "http://localhost:6006/?path=/story/visualization-categorybar--with-marker",
     )
-    await expect(
-      page
-        .frameLocator('iframe[title="storybook-preview-iframe"]')
-        .getByTestId("progressbar"),
-    ).toBeVisible()
+    const storyFrame = page.frameLocator(
+      'iframe[title="storybook-preview-iframe"]',
+    )
+
+    const marker = storyFrame.locator(".absolute.w-2.-translate-x-1\\/2")
+    await expect(marker).toBeVisible()
+  })
+
+  test("handles marker tooltip interaction", async ({ page }) => {
     await page.goto(
-      "http://localhost:6006/?path=/story/visualization-progressbar--default",
+      "http://localhost:6006/?path=/story/visualization-categorybar--with-marker",
+    )
+    const storyFrame = page.frameLocator(
+      'iframe[title="storybook-preview-iframe"]',
+    )
+
+    const marker = storyFrame.locator(".absolute.w-2.-translate-x-1\\/2")
+    await marker.hover()
+  })
+
+  test("maintains accessibility attributes", async ({ page }) => {
+    await page.goto(STORY_URL)
+    const storyFrame = page.frameLocator(
+      'iframe[title="storybook-preview-iframe"]',
     )
-    await expect(
-      page
-        .frameLocator('iframe[title="storybook-preview-iframe"]')
-        .getByText("%"),
-    ).toBeVisible()
+    const categoryBar = storyFrame.getByTestId("category-bar")
+
+    await expect(categoryBar).toHaveAttribute("aria-label", "Category bar")
+    await expect(categoryBar).toHaveAttribute("tremor-id", "tremor-raw")
   })
 })
```

**File**: `src/components/CategoryBar/categorybar.stories.tsx` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ import { CategoryBar } from "./CategoryBar"
 
 const meta: Meta<typeof CategoryBar> = {
   title: "visualization/CategoryBar",
-  render: (args) => <CategoryBar {...args} data-testid="CategoryBar" />,
+  render: (args) => <CategoryBar {...args} data-testid="category-bar" />,
   component: CategoryBar,
 }
 
@@ -13,7 +13,7 @@ type Story = StoryObj<typeof CategoryBar>
 
 export const Default: Story = {
   args: {
-    values: [70, 18, 11],
+    values: [70, 18, 12],
   },
 }
 
```

**File**: `src/components/CategoryBar/changelog.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Tremor Category Bar Changelog
 
+## 0.0.3
+
+### Changes
+
+- Fix: Hidden aria elements
+
 ## 0.0.2
 
 ### Changes
```

---

### Incident Patch 4: `2291b313` (2024-11-03)
**Commit Message**: fix: tooltip defaults (#99)

* fix: tooltip defaults

* chore: update version

**File**: `src/components/Tooltip/Tooltip.tsx` (modified, +2/-4)
```diff
@@ -1,6 +1,4 @@
-// Tremor Tooltip [v0.0.2]
-
-"use client"
+// Tremor Tooltip [v0.0.3]
 
 import React from "react"
 import * as TooltipPrimitives from "@radix-ui/react-tooltip"
@@ -37,7 +35,7 @@ const Tooltip = React.forwardRef<
       showArrow = true,
       side,
       sideOffset = 10,
-      triggerAsChild = false,
+      triggerAsChild = true,
       ...props
     }: TooltipProps,
     forwardedRef,
```

**File**: `src/components/Tooltip/changelog.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Tremor Tooltip Changelog
 
+## 0.0.3
+
+### Changes
+
+- Fix: Set triggerAsChild default to `true`
+
 ## 0.0.2
 
 ### Changes
```

**File**: `storybook-static/assets/Area-DJv05xvA.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+import{R as p,r as ie}from"./index-ClcD9ViR.js";import{a as ee}from"./cx-CYgzbKIn.js";import{a as N,L as z,m as C,i as B,C as F,A as oe,b as R,c as q,d as se,e as G,h as le,j as ue,G as ce,k as J,l as Q,n as K,D as fe,u as pe}from"./generateCategoricalChart-DR9uWRoX.js";var de=["layout","type","stroke","connectNulls","isRange","ref"],he=["key"],te;function I(e){"@babel/helpers - typeof";return I=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(t){return typeof t}:function(t){return t&&typeof Symbol=="function"&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},I(e)}function re(e,t){if(e==null)return{};var n=ve(e,t),r,a;if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(a=0;a<i.length;a++)r=i[a],!(t.indexOf(r)>=0)&&Object.prototype.propertyIsEnumerable.call(e,r)&&(n[r]=e[r])}return n}function ve(e,t){if(e==null)return{};var n={};for(var r in e)if(Object.prototype.hasOwnProperty.call(e,r)){if(t.indexOf(r)>=0)continue;n[r]=e[r]}return n}function D(){return D=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e},D.apply(this,arguments)}function U(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter(function(a){return Object.getOwnPropertyDescriptor(e,a).enumerable})),n.push.apply(n,r)}return n}function S(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]!=null?arguments[t]:{};t%2?U(Object(n),!0).forEach(function(r){E(e,r,n[r])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):U(Object(n)).forEach(function(r){Object.defineProperty(e,r,Object.getOwnPropertyDescriptor(n,r))})}return e}function me(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function Z(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,ae(r.key),r)}}function ye(e,t,n){return t&&Z(e.prototype,t),n&&Z(e,n),Object.defineProperty(e,"prototype",{writable:!1}),e}function be(e,t,n){return t=T(t),Ae(e,ne()?Reflect.construct(t,n||[],T(e).constructor):t.apply(e,n))}function Ae(e,t){if(t&&(I(t)==="object"||typeof t=="function"))return t;if(t!==void 0)throw new TypeError("Derived constructors may only return object or undefined");return ge(e)}function ge(e){if(e===void 0)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function ne(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],function(){}))}catch{}return(ne=function(){return!!e})()}function T(e){return T=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(n){return n.__proto__||Object.getPrototypeOf(n)},T(e)}function xe(e,t){if(typeof t!="function"&&t!==null)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&H(e,t)}function H(e,t){return H=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(r,a){return r.__proto__=a,r},H(e,t)}function E(e,t,n){return t=ae(t),t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function ae(e){var t=Pe(e,"string");return I(t)=="symbol"?t:t+""}function Pe(e,t){if(I(e)!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t||"default");if(I(r)!="object")return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return(t==="string"?String:Number)(e)}var M=function(e){function t(){var n;me(this,t);for(var r=arguments.length,a=new Array(r),i=0;i<r;i++)a[i]=arguments[i];return n=be(this,t,[].concat(a)),E(n,"state",{isAnimationFinished:!0}),E(n,"id",pe("recharts-area-")),E(n,"handleAnimationEnd",function(){var o=n.props.onAnimationEnd;n.setState({isAnimationFinished:!0}),K(o)&&o()}),E(n,"handleAnimationStart",function(){var o=n.props.onAnimationStart;n.setState({isAnimationFinished:!1}),K(o)&&o()}),n}return xe(t,e),ye(t,[{key:"renderDots",value:function(r,a,i){var o=this.props.isAnimationActive,s=this.state.isAnimationFinished;if(o&&!s)return null;var u=this.props,l=u.dot,f=u.points,c=u.dataKey,d=N(this.props,!1),A=N(l,!0),g=f.map(function(m,O){var y=S(S(S({key:"dot-".concat(O),r:3},d),A),{},{index:O,cx:m.x,cy:m.y,dataKey:c,value:m.value,payload:m.payload,points:f});return t.renderDotItem(l,y)}),x={clipPath:r?"url(#clipPath-".concat(a?"":"dots-").concat(i,")"):null};return p.createElement(z,D({className:"recharts-area-dots"},x),g)}},{key:"renderHorizontalRect",value:function(r){var a=this.props,i=a.baseLine,o=a.points,s=a.strokeWidth,u=o[0].x,l=o[o.length-1].x,f=r*Math.abs(u-l),c=C(o.map(function(d){return d.y||0}));return B(i)&&typeof i=="number"?c=Math.max(i,c):i&&Array.isArray(i)&&i.length&&(c=Math.max(C
```

**File**: `storybook-static/assets/AreaChart-iRocy0Pi.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+import{g as a,f as r}from"./generateCategoricalChart-DR9uWRoX.js";import{A as s}from"./Area-DJv05xvA.js";import{X as i,Y as o}from"./getYAxisDomain-G3OsYyu1.js";var e=a({chartName:"AreaChart",GraphicalChild:s,axisComponents:[{axisType:"xAxis",AxisComp:i},{axisType:"yAxis",AxisComp:o}],formatAxisMap:r});export{e as A};
```

**File**: `storybook-static/assets/Badge-CRZPK1pY.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+import{j as g}from"./jsx-runtime-CfatFE5O.js";import{R as i}from"./index-ClcD9ViR.js";import{c as l}from"./index-CF-iJ_jy.js";import{c as r}from"./cx-CYgzbKIn.js";const o=l({base:r("inline-flex items-center gap-x-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"),variants:{variant:{default:["bg-blue-50 text-blue-900 ring-blue-500/30","dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30"],neutral:["bg-gray-50 text-gray-900 ring-gray-500/30","dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20"],success:["bg-emerald-50 text-emerald-900 ring-emerald-600/30","dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20"],error:["bg-red-50 text-red-900 ring-red-600/20","dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20"],warning:["bg-yellow-50 text-yellow-900 ring-yellow-600/30","dark:bg-yellow-400/10 dark:text-yellow-500 dark:ring-yellow-400/20"]}},defaultVariants:{variant:"default"}}),e=i.forwardRef(({className:a,variant:t,...d},n)=>g.jsx("span",{ref:n,className:r(o({variant:t}),a),"tremor-id":"tremor-raw",...d}));e.displayName="Badge";e.__docgenInfo={description:"",methods:[],displayName:"Badge",composes:["VariantProps"]};export{e as B,o as b};
```

**File**: `storybook-static/assets/BarChart-qGzaN6dC.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+import{g as a,B as i,f as s}from"./generateCategoricalChart-DR9uWRoX.js";import{X as t,Y as r}from"./getYAxisDomain-G3OsYyu1.js";var p=a({chartName:"BarChart",GraphicalChild:i,defaultTooltipEventType:"axis",validateTooltipEventTypes:["axis","item"],axisComponents:[{axisType:"xAxis",AxisComp:t},{axisType:"yAxis",AxisComp:r}],formatAxisMap:s});export{p as B};
```

**File**: `storybook-static/assets/Button-BKBEGp9E.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+import{j as r}from"./jsx-runtime-CfatFE5O.js";import{R as m}from"./index-ClcD9ViR.js";import{S as p}from"./index-ClVxAquS.js";import{P as y}from"./index-BWmfHM-C.js";import{c as u}from"./index-CF-iJ_jy.js";import{c}from"./cx-CYgzbKIn.js";import{f as h}from"./focusRing-49zpLVVu.js";const x=u({base:["relative inline-flex items-center justify-center whitespace-nowrap rounded-md border px-3 py-2 text-center text-sm font-medium shadow-sm transition-all duration-100 ease-in-out","disabled:pointer-events-none disabled:shadow-none",h],variants:{variant:{primary:["border-transparent","text-white dark:text-white","bg-blue-500 dark:bg-blue-500","hover:bg-blue-600 dark:hover:bg-blue-600","disabled:bg-blue-300 disabled:text-white","disabled:dark:bg-blue-800 disabled:dark:text-blue-400"],secondary:["border-gray-300 dark:border-gray-800","text-gray-900 dark:text-gray-50","bg-white dark:bg-gray-950","hover:bg-gray-50 dark:hover:bg-gray-900/60","disabled:text-gray-400","disabled:dark:text-gray-600"],light:["shadow-none","border-transparent","text-gray-900 dark:text-gray-50","bg-gray-200 dark:bg-gray-900","hover:bg-gray-300/70 dark:hover:bg-gray-800/80","disabled:bg-gray-100 disabled:text-gray-400","disabled:dark:bg-gray-800 disabled:dark:text-gray-600"],ghost:["shadow-none","border-transparent","text-gray-900 dark:text-gray-50","bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800/80","disabled:text-gray-400","disabled:dark:text-gray-600"],destructive:["text-white","border-transparent","bg-red-600 dark:bg-red-700","hover:bg-red-700 dark:hover:bg-red-600","disabled:bg-red-300 disabled:text-white","disabled:dark:bg-red-950 disabled:dark:text-red-400"]}},defaultVariants:{variant:"primary"}}),d=m.forwardRef(({asChild:s,isLoading:a=!1,loadingText:e,className:i,disabled:o,variant:n,children:t,...b},g)=>{const l=s?p:"button";return r.jsx(l,{ref:g,className:c(x({variant:n}),i),disabled:o||a,"tremor-id":"tremor-raw",...b,children:a?r.jsxs("span",{className:"pointer-events-none flex shrink-0 items-center justify-center gap-1.5",children:[r.jsx(y,{className:"size-4 shrink-0 animate-spin","aria-hidden":"true"}),r.jsx("span",{className:"sr-only",children:e||"Loading"}),e||t]}):t})});d.displayName="Button";d.__docgenInfo={description:"",methods:[],displayName:"Button",props:{asChild:{required:!1,tsType:{name:"boolean"},description:""},isLoading:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},loadingText:{required:!1,tsType:{name:"string"},description:""}},composes:["VariantProps"]};export{d as B,x as b};
```

**File**: `storybook-static/assets/Calendar-Bs0M0WIi.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+import{j as u}from"./jsx-runtime-CfatFE5O.js";import{r as _}from"./index-ClcD9ViR.js";import{b as Te,r as Fe,Y as pt,_ as xt}from"./index-BWmfHM-C.js";import{c as A}from"./cx-CYgzbKIn.js";import{f as $e}from"./focusRing-49zpLVVu.js";function Q(e){return(n={})=>{const t=n.width?String(n.width):e.defaultWidth;return e.formats[t]||e.formats[e.defaultWidth]}}function L(e){return(n,t)=>{const a=t!=null&&t.context?String(t.context):"standalone";let r;if(a==="formatting"&&e.formattingValues){const i=e.defaultFormattingWidth||e.defaultWidth,s=t!=null&&t.width?String(t.width):i;r=e.formattingValues[s]||e.formattingValues[i]}else{const i=e.defaultWidth,s=t!=null&&t.width?String(t.width):e.defaultWidth;r=e.values[s]||e.values[i]}const o=e.argumentCallback?e.argumentCallback(n):n;return r[o]}}function E(e){return(n,t={})=>{const a=t.width,r=a&&e.matchPatterns[a]||e.matchPatterns[e.defaultMatchWidth],o=n.match(r);if(!o)return null;const i=o[0],s=a&&e.parsePatterns[a]||e.parsePatterns[e.defaultParseWidth],l=Array.isArray(s)?Dt(s,f=>f.test(i)):Mt(s,f=>f.test(i));let c;c=e.valueCallback?e.valueCallback(l):l,c=t.valueCallback?t.valueCallback(c):c;const d=n.slice(i.length);return{value:c,rest:d}}}function Mt(e,n){for(const t in e)if(Object.prototype.hasOwnProperty.call(e,t)&&n(e[t]))return t}function Dt(e,n){for(let t=0;t<e.length;t++)if(n(e[t]))return t}function Je(e){return(n,t={})=>{const a=n.match(e.matchPattern);if(!a)return null;const r=a[0],o=n.match(e.parsePattern);if(!o)return null;let i=e.valueCallback?e.valueCallback(o[0]):o[0];i=t.valueCallback?t.valueCallback(i):i;const s=n.slice(r.length);return{value:i,rest:s}}}function D(e){const n=Object.prototype.toString.call(e);return e instanceof Date||typeof e=="object"&&n==="[object Date]"?new e.constructor(+e):typeof e=="number"||n==="[object Number]"||typeof e=="string"||n==="[object String]"?new Date(e):new Date(NaN)}let kt={};function ne(){return kt}function R(e,n){var s,l,c,d;const t=ne(),a=(n==null?void 0:n.weekStartsOn)??((l=(s=n==null?void 0:n.locale)==null?void 0:s.options)==null?void 0:l.weekStartsOn)??t.weekStartsOn??((d=(c=t.locale)==null?void 0:c.options)==null?void 0:d.weekStartsOn)??0,r=D(e),o=r.getDay(),i=(o<a?7:0)+o-a;return r.setDate(r.getDate()-i),r.setHours(0,0,0,0),r}const _t={lessThanXSeconds:{one:"less than a second",other:"less than {{count}} seconds"},xSeconds:{one:"1 second",other:"{{count}} seconds"},halfAMinute:"half a minute",lessThanXMinutes:{one:"less than a minute",other:"less than {{count}} minutes"},xMinutes:{one:"1 minute",other:"{{count}} minutes"},aboutXHours:{one:"about 1 hour",other:"about {{count}} hours"},xHours:{one:"1 hour",other:"{{count}} hours"},xDays:{one:"1 day",other:"{{count}} days"},aboutXWeeks:{one:"about 1 week",other:"about {{count}} weeks"},xWeeks:{one:"1 week",other:"{{count}} weeks"},aboutXMonths:{one:"about 1 month",other:"about {{count}} months"},xMonths:{one:"1 month",other:"{{count}} months"},aboutXYears:{one:"about 1 year",other:"about {{count}} years"},xYears:{one:"1 year",other:"{{count}} years"},overXYears:{one:"over 1 year",other:"over {{count}} years"},almostXYears:{one:"almost 1 year",other:"almost {{count}} years"}},Nt=(e,n,t)=>{let a;const r=_t[e];return typeof r=="string"?a=r:n===1?a=r.one:a=r.other.replace("{{count}}",n.toString()),t!=null&&t.addSuffix?t.comparison&&t.comparison>0?"in "+a:a+" ago":a},Pt={lastWeek:"'last' eeee 'at' p",yesterday:"'yesterday at' p",today:"'today at' p",tomorrow:"'tomorrow at' p",nextWeek:"eeee 'at' p",other:"P"},Ct=(e,n,t,a)=>Pt[e],jt={narrow:["B","A"],abbreviated:["BC","AD"],wide:["Before Christ","Anno Domini"]},Ot={narrow:["1","2","3","4"],abbreviated:["Q1","Q2","Q3","Q4"],wide:["1st quarter","2nd quarter","3rd quarter","4th quarter"]},Wt={narrow:["J","F","M","A","M","J","J","A","S","O","N","D"],abbreviated:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],wide:["January","February","March","April","May","June","July","August","September","October","November","December"]},St={narrow:["S","M","T","W","T","F","S"],short:["Su","Mo","Tu","We","Th","Fr","Sa"],abbreviated:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],wide:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]},Tt={narrow:{am:"a",pm:"p",midnight:"mi",noon:"n",morning:"morning",afternoon:"afternoon",evening:"evening",night:"night"},abbreviated:{am:"AM",pm:"PM",midnight:"midnight",noon:"noon",morning:"morning",afternoon:"afternoon",evening:"evening",night:"night"},wide:{am:"a.m.",pm:"p.m.",midnight:"midnight",noon:"noon",morning:"morning",afternoon:"afternoon",evening:"evening",night:"night"}},Ft={narrow:{am:"a",pm:"p",midnight:"mi",noon:"n",morning:"in the morning",afternoon:"in the afternoon",evening:"in the evening",night:"at night"},abbreviated:{am:"AM",pm:"PM",midnight:"midnight",noon:"noon",morning:"in the morning",afternoon:"in the afternoon",evening:"in the evening",night:"at night"},wide:{am:"a.m.",pm:"p.m.",midnight:"midnight",noon:"noon",morni
```

---

### Incident Patch 5: `869fb8e7` (2024-10-06)
**Commit Message**: fix: floating point `Categorybar` (#94)

* fix: floating point issues

* add storues

* update story

* interger display

**File**: `src/components/CategoryBar/CategoryBar.tsx` (modified, +10/-3)
```diff
@@ -1,4 +1,4 @@
-// Tremor CategoryBar [v0.0.1]
+// Tremor CategoryBar [v0.0.2]
 
 "use client"
 
@@ -46,6 +46,13 @@ const getPositionLeft = (
 const sumNumericArray = (arr: number[]) =>
   arr.reduce((prefixSum, num) => prefixSum + num, 0)
 
+const formatNumber = (num: number): string => {
+  if (Number.isInteger(num)) {
+    return num.toString()
+  }
+  return num.toFixed(1)
+}
+
 const BarLabels = ({ values }: { values: number[] }) => {
   const sumValues = React.useMemo(() => sumNumericArray(values), [values])
   let prefixSum = 0
@@ -88,14 +95,14 @@ const BarLabels = ({ values }: { values: number[] }) => {
                 "translate-x-1/2 text-sm tabular-nums",
               )}
             >
-              {prefixSum}
+              {formatNumber(prefixSum)}
             </span>
           </div>
         )
       })}
       <div className="absolute bottom-0 left-0 flex items-center">0</div>
       <div className="absolute bottom-0 right-0 flex items-center">
-        {sumValues}
+        {formatNumber(sumValues)}
       </div>
     </div>
   )
```

**File**: `src/components/CategoryBar/categorybar.stories.tsx` (modified, +7/-1)
```diff
@@ -13,7 +13,13 @@ type Story = StoryObj<typeof CategoryBar>
 
 export const Default: Story = {
   args: {
-    values: [60, 10, 20, 10],
+    values: [70, 18, 11],
+  },
+}
+
+export const WithFloatingPointValues: Story = {
+  args: {
+    values: [70.1, 18.3, 11.6],
   },
 }
 
```

**File**: `src/components/CategoryBar/changelog.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Tremor Category Bar Changelog
 
+## 0.0.2
+
+### Changes
+
+- Fix: Long floating point issues with labels
+
 ## 0.0.1
 
 ### Changes
```

---

### Incident Patch 6: `d694c6eb` (2024-09-18)
**Commit Message**: fix: radio card group color (#91)

**File**: `src/components/RadioCardGroup/RadioCardGroup.tsx` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-// Tremor Radio Card [v0.0.2]
+// Tremor Radio Card [v0.0.3]
 
 import React from "react"
 import * as RadioGroupPrimitives from "@radix-ui/react-radio-group"
@@ -64,7 +64,7 @@ const RadioCardIndicator = React.forwardRef<
         // base
         "relative flex size-4 shrink-0 appearance-none items-center justify-center rounded-full border shadow-sm outline-none",
         // border color
-        "border-gray-200 dark:border-gray-800",
+        "border-gray-300 dark:border-gray-800",
         // background color
         "bg-white dark:bg-gray-950",
         // checked
```

**File**: `src/components/RadioCardGroup/changelog.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Tremor Radio Card Group Changelog
 
+## 0.0.3
+
+### Changes
+
+- fix: RadioCard border color
+
 ## 0.0.2
 
 ### Changes
```

---

### Incident Patch 7: `2846f157` (2024-09-11)
**Commit Message**: fix combochart

**File**: `src/components/ComboChart/ComboChart.tsx` (modified, +1/-0)
```diff
@@ -737,6 +737,7 @@ const ComboChart = React.forwardRef<HTMLDivElement, ComboChartProps>(
         setActiveDot(undefined)
         onValueChange?.(null)
       } else {
+        setActiveBar(undefined)
         setActiveLegend(itemData.dataKey)
         setActiveDot({
           index: itemData.index,
```

---

### Incident Patch 8: `8e83c842` (2024-09-06)
**Commit Message**: fix: input webkit css (#85)

**File**: `src/components/Input/Input.tsx` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-// Tremor Input [v1.0.4]
+// Tremor Input [v1.0.5]
 
 import React from "react"
 import { RiEyeFill, RiEyeOffFill, RiSearchLine } from "@remixicon/react"
@@ -36,7 +36,7 @@ const inputStyles = tv({
     // invalid (optional)
     // "aria-[invalid=true]:dark:ring-red-400/20 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-200 aria-[invalid=true]:border-red-500 invalid:ring-2 invalid:ring-red-200 invalid:border-red-500"
     // remove search cancel button (optional)
-    "[&::--webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
+    "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
   ],
   variants: {
     hasError: {
```

**File**: `src/components/Input/changelog.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Tremor Input Changelog
 
+## 1.0.5
+
+### Changes
+
+- fix: Remove redundant input css
+
 ## 1.0.4
 
 ### Changes
```

---

### Incident Patch 9: `269b64ac` (2024-09-04)
**Commit Message**: fix: click events combo chart (#84)

**File**: `src/components/ComboChart/ComboChart.tsx` (modified, +20/-2)
```diff
@@ -752,17 +752,28 @@ const ComboChart = React.forwardRef<HTMLDivElement, ComboChartProps>(
 
     function onCategoryClick(dataKey: string) {
       if (!hasOnValueChange) return
+
       if (dataKey === activeLegend && !activeBar && !activeDot) {
         setActiveLegend(undefined)
         onValueChange?.(null)
+      } else if (
+        activeBar &&
+        activeBar.tooltipPayload?.[0]?.dataKey === dataKey
+      ) {
+        setActiveLegend(dataKey)
+        onValueChange?.({
+          eventType: "category",
+          categoryClicked: dataKey,
+        })
       } else {
         setActiveLegend(dataKey)
+        setActiveBar(undefined)
+        setActiveDot(undefined)
         onValueChange?.({
           eventType: "category",
           categoryClicked: dataKey,
         })
       }
-      setActiveBar(undefined)
     }
 
     return (
@@ -776,9 +787,10 @@ const ComboChart = React.forwardRef<HTMLDivElement, ComboChartProps>(
           <RechartsComposedChart
             data={data}
             onClick={
-              hasOnValueChange && (activeLegend || activeBar)
+              hasOnValueChange && (activeLegend || activeBar || activeDot)
                 ? () => {
                     setActiveBar(undefined)
+                    setActiveDot(undefined)
                     setActiveLegend(undefined)
                     onValueChange?.(null)
                   }
@@ -1048,6 +1060,7 @@ const ComboChart = React.forwardRef<HTMLDivElement, ComboChartProps>(
                     ) as AvailableChartColorsKeys,
                     "stroke",
                   ),
+                  hasOnValueChange && "cursor-pointer",
                 )}
                 strokeOpacity={
                   activeDot || (activeLegend && activeLegend !== category)
@@ -1145,6 +1158,11 @@ const ComboChart = React.forwardRef<HTMLDivElement, ComboChartProps>(
                 strokeLinecap="round"
                 isAnimationActive={false}
                 connectNulls={mergedLineSeries.connectNulls}
+                onClick={(props: any, event) => {
+                  event.stopPropagation()
+                  const { name } = props
+                  onCategoryClick(name)
+                }}
               />
             ))}
           </RechartsComposedChart>
```

---

### Incident Patch 10: `982b88d4` (2024-08-31)
**Commit Message**: fix: DropDown asChild, DatePicker scroll styles (#80)

* fix: asChild Dropdown

* Update version name

* fix: date picker overflow styles

* update packages

* fix: versioning

**File**: `package.json` (modified, +3/-3)
```diff
@@ -48,7 +48,7 @@
     "tailwind-variants": "^0.2.1"
   },
   "devDependencies": {
-    "@chromatic-com/storybook": "^1.7.0",
+    "@chromatic-com/storybook": "^1.8.0",
     "@playwright/test": "^1.46.1",
     "@storybook/addon-essentials": "^8.2.9",
     "@storybook/addon-interactions": "^8.2.9",
@@ -58,7 +58,7 @@
     "@storybook/react-vite": "^8.2.9",
     "@storybook/test": "^8.2.9",
     "@types/node": "^22.5.1",
-    "@types/react": "^18.3.4",
+    "@types/react": "^18.3.5",
     "@types/react-dom": "^18.3.0",
     "@typescript-eslint/eslint-plugin": "^8.3.0",
     "@typescript-eslint/parser": "^8.3.0",
@@ -74,7 +74,7 @@
     "tailwindcss": "^3.4.10",
     "typescript": "^5.5.4",
     "vite": "^5.4.2",
-    "vite-tsconfig-paths": "^4.3.2",
+    "vite-tsconfig-paths": "^5.0.1",
     "vitest": "^2.0.5"
   }
 }
```

**File**: `pnpm-lock.yaml` (modified, +332/-332)
```diff
@@ -16,52 +16,52 @@ importers:
         version: 3.5.5
       '@radix-ui/react-accordion':
         specifier: ^1.2.0
-        version: 1.2.0(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 1.2.0(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-checkbox':
         specifier: ^1.1.1
-        version: 1.1.1(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 1.1.1(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-dialog':
         specifier: ^1.1.1
-        version: 1.1.1(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 1.1.1(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-dropdown-menu':
         specifier: ^2.1.1
-        version: 2.1.1(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 2.1.1(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-hover-card':
         specifier: ^1.1.1
-        version: 1.1.1(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 1.1.1(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-label':
         specifier: ^2.1.0
-        version: 2.1.0(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 2.1.0(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-navigation-menu':
         specifier: ^1.2.0
-        version: 1.2.0(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 1.2.0(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-popover':
         specifier: ^1.1.1
-        version: 1.1.1(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 1.1.1(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-radio-group':
         specifier: ^1.2.0
-        version: 1.2.0(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 1.2.0(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-select':
         specifier: ^2.1.1
-        version: 2.1.1(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 2.1.1(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-slider':
         specifier: ^1.2.0
-        version: 1.2.0(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 1.2.0(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-slot':
         specifier: ^1.1.0
-        version: 1.1.0(@types/react@18.3.4)(react@18.3.1)
+        version: 1.1.0(@types/react@18.3.5)(react@18.3.1)
       '@radix-ui/react-switch':
         specifier: ^1.1.0
-        version: 1.1.0(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 1.1.0(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-tabs':
         specifier: ^1.1.0
-        version: 1.1.0(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 1.1.0(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-toast':
         specifier: ^1.2.1
-        version: 1.2.1(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 1.2.1(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@radix-ui/react-tooltip':
         specifier: ^1.1.2
-        version: 1.1.2(@types/react-dom@18.3.0)(@types/react@18.3.4)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 1.1.2(@types/react-dom@18.3.0)(@types/react@18.3.5)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       '@react-aria/datepicker':
         specifier: ^3.11.2
         version: 3.11.2(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
@@ -106,8 +106,8 @@ importers:
         version: 0.2.1(tailwindcss@3.4.10)
     devDependencies:
       '@chromatic-com/storybook':
-        specifier: ^1.7.0
-        version: 1.7.0(react@18.3.1)
+        specifier: ^1.8.0
+    
```

**File**: `src/components/Accordion/Accordion.tsx` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-// Tremor Raw Accordion [v0.0.1]
+// Tremor Accordion [v0.0.1]
 
 import React from "react"
 import * as AccordionPrimitives from "@radix-ui/react-accordion"
```

**File**: `src/components/Accordion/changelog.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# Tremor Raw Accordion Changelog
+# Tremor Accordion Changelog
 
 ## 0.0.1
 
```

**File**: `src/components/AreaChart/AreaChart.tsx` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-// Tremor Raw AreaChart [v0.3.1]
+// Tremor AreaChart [v0.3.1]
 /* eslint-disable @typescript-eslint/no-explicit-any */
 
 "use client"
```

**File**: `src/components/AreaChart/changelog.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# Tremor Raw AreaChart Changelog
+# Tremor AreaChart Changelog
 
 ## 0.3.1
 
```

**File**: `src/components/Badge/Badge.tsx` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-// Tremor Raw Badge [v0.0.1]
+// Tremor Badge [v0.0.1]
 
 import React from "react"
 import { tv, type VariantProps } from "tailwind-variants"
```

**File**: `src/components/Badge/changelog.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# Tremor Raw Badge Changelog
+# Tremor Badge Changelog
 
 ## 0.0.1
 
```

---

### Incident Patch 11: `c65fcde6` (2024-07-30)
**Commit Message**: fix: typos (#65)

**File**: `src/components/Calendar/Calendar.tsx` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-// Tremor Raw Calendar [v0.0.3]
+// Tremor Raw Calendar [v0.0.4]
 
 "use client"
 
@@ -109,7 +109,7 @@ const Calendar = ({
       weekStartsOn={weekStartsOn}
       numberOfMonths={numberOfMonths}
       locale={locale}
-      showOutsideDays={numberOfMonths === 1 ? true : false}
+      showOutsideDays={numberOfMonths === 1}
       className={cx(className)}
       classNames={{
         months: "flex space-y-0",
```

**File**: `src/components/Calendar/changelog.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Tremor Raw Calendar Changelog
 
+## 0.0.4
+
+### Changes
+
+- Fix: showOutsideDays logic
+
 ## 0.0.3
 
 ### Changes
```

**File**: `src/components/Divider/Divider.tsx` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-// Tremor Raw Divider [v0.0.0]
+// Tremor Raw Divider [v0.0.1]
 
 import React from "react"
 
@@ -44,7 +44,7 @@ const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
           className={cx(
             // base
             "h-[1px] w-full",
-            // backround color
+            // background color
             "bg-gray-200 dark:bg-gray-800",
           )}
         />
```

**File**: `src/components/Divider/changelog.md` (modified, +3/-1)
```diff
@@ -1,5 +1,7 @@
 # Tremor Raw Divider Changelog
 
-## 0.0.0
+## 0.0.1
 
 ### Changes
+
+- Fix: Typo
```

**File**: `src/components/Table/Table.tsx` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-// Tremor Raw Table [v0.0.1]
+// Tremor Raw Table [v0.0.2]
 
 import React from "react"
 
@@ -10,7 +10,7 @@ const TableRoot = React.forwardRef<
 >(({ className, children, ...props }, forwardedRef) => (
   <div
     ref={forwardedRef}
-    // Activate if table is used in a float enironment
+    // Activate if table is used in a float environment
     // className="flow-root"
   >
     <div
```

**File**: `src/components/Table/changelog.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Tremor Raw Table Changelog
 
+## 0.0.2
+
+### Changes
+
+- Fix: Typo
+
 ## 0.0.1
 
 ### Changes
```

**File**: `src/components/Toast/Toast.tsx` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-// Tremor Raw Toast [v0.0.2]
+// Tremor Raw Toast [v0.0.3]
 
 import React from "react"
 import * as ToastPrimitives from "@radix-ui/react-toast"
@@ -62,7 +62,7 @@ const Toast = React.forwardRef<
     }: ToastProps,
     forwardedRef,
   ) => {
-    let Icon: React.ReactNode = null
+    let Icon: React.ReactNode
 
     switch (variant) {
       case "success":
```

**File**: `src/components/Toast/Toaster.tsx` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 "use client"
 
 import { useToast } from "../../hooks/useToast"
-import { Toast, ToastProvider, ToastViewport } from "../Toast/Toast"
+import { Toast, ToastProvider, ToastViewport } from "./Toast.tsx"
 
 const Toaster = () => {
   const { toasts } = useToast()
```

---

### Incident Patch 12: `fcbe6383` (2024-07-20)
**Commit Message**: fix: enablestepper input (#62)

**File**: `package.json` (modified, +37/-37)
```diff
@@ -14,65 +14,65 @@
     "test:all": "npx vitest run && npx playwright test"
   },
   "dependencies": {
-    "@ianvs/prettier-plugin-sort-imports": "^4.2.1",
+    "@ianvs/prettier-plugin-sort-imports": "^4.3.1",
     "@internationalized/date": "^3.5.4",
-    "@radix-ui/react-accordion": "^1.1.2",
-    "@radix-ui/react-checkbox": "^1.0.4",
-    "@radix-ui/react-dialog": "^1.0.5",
-    "@radix-ui/react-dropdown-menu": "^2.0.6",
-    "@radix-ui/react-hover-card": "^1.0.7",
-    "@radix-ui/react-label": "^2.0.2",
-    "@radix-ui/react-navigation-menu": "^1.1.4",
-    "@radix-ui/react-popover": "^1.0.7",
-    "@radix-ui/react-radio-group": "^1.1.3",
-    "@radix-ui/react-select": "^2.0.0",
-    "@radix-ui/react-slot": "^1.0.2",
-    "@radix-ui/react-switch": "^1.0.3",
-    "@radix-ui/react-tabs": "^1.0.4",
-    "@radix-ui/react-toast": "^1.1.5",
-    "@radix-ui/react-tooltip": "^1.0.7",
+    "@radix-ui/react-accordion": "^1.2.0",
+    "@radix-ui/react-checkbox": "^1.1.1",
+    "@radix-ui/react-dialog": "^1.1.1",
+    "@radix-ui/react-dropdown-menu": "^2.1.1",
+    "@radix-ui/react-hover-card": "^1.1.1",
+    "@radix-ui/react-label": "^2.1.0",
+    "@radix-ui/react-navigation-menu": "^1.2.0",
+    "@radix-ui/react-popover": "^1.1.1",
+    "@radix-ui/react-radio-group": "^1.2.0",
+    "@radix-ui/react-select": "^2.1.1",
+    "@radix-ui/react-slot": "^1.1.0",
+    "@radix-ui/react-switch": "^1.1.0",
+    "@radix-ui/react-tabs": "^1.1.0",
+    "@radix-ui/react-toast": "^1.2.1",
+    "@radix-ui/react-tooltip": "^1.1.2",
     "@react-aria/datepicker": "^3.10.1",
     "@react-stately/datepicker": "^3.9.4",
     "@remixicon/react": "^4.2.0",
-    "@storybook/addon-a11y": "^8.1.10",
-    "@storybook/theming": "^8.1.10",
+    "@storybook/addon-a11y": "^8.2.5",
+    "@storybook/theming": "^8.2.5",
     "clsx": "^2.1.1",
     "date-fns": "^3.6.0",
     "prettier-plugin-tailwindcss": "^0.6.5",
     "react": "^18.3.1",
     "react-day-picker": "^8.10.1",
     "react-dom": "^18.3.1",
     "recharts": "^2.12.7",
-    "tailwind-merge": "^2.3.0",
+    "tailwind-merge": "^2.4.0",
     "tailwind-variants": "^0.2.1"
   },
   "devDependencies": {
-    "@chromatic-com/storybook": "^1.5.0",
-    "@playwright/test": "^1.44.1",
-    "@storybook/addon-essentials": "^8.1.10",
-    "@storybook/addon-interactions": "^8.1.10",
-    "@storybook/addon-links": "^8.1.10",
-    "@storybook/blocks": "^8.1.10",
-    "@storybook/react": "^8.1.10",
-    "@storybook/react-vite": "^8.1.10",
-    "@storybook/test": "^8.1.10",
-    "@types/node": "^20.14.2",
+    "@chromatic-com/storybook": "^1.6.1",
+    "@playwright/test": "^1.45.2",
+    "@storybook/addon-essentials": "^8.2.5",
+    "@storybook/addon-interactions": "^8.2.5",
+    "@storybook/addon-links": "^8.2.5",
+    "@storybook/blocks": "^8.2.5",
+    "@storybook/react": "^8.2.5",
+    "@storybook/react-vite": "^8.2.5",
+    "@storybook/test": "^8.2.5",
+    "@types/node": "^20.14.11",
     "@types/react": "^18.3.3",
     "@types/react-dom": "^18.3.0",
-    "@typescript-eslint/eslint-plugin": "^7.13.1",
-    "@typescript-eslint/parser": "^7.13.1",
+    "@typescript-eslint/eslint-plugin": "^7.16.1",
+    "@typescript-eslint/parser": "^7.16.1",
     "@vitejs/plugin-react": "^4.3.1",
     "autoprefixer": "^10.4.19",
     "eslint": "^8.57.0",
     "eslint-plugin-react-hooks": "^4.6.2",
-    "eslint-plugin-react-refresh": "^0.4.7",
+    "eslint-plugin-react-refresh": "^0.4.8",
     "eslint-plugin-storybook": "^0.8.0",
-    "postcss": "^8.4.38",
+    "postcss": "^8.4.39",
     "prettier": "3.3.2",
-    "storybook": "^8.1.10",
-    "tailwindcss": "^3.4.4",
-    "typescript": "^5.4.5",
-    "vite": "^5.3.1",
+    "storybook": "^8.2.5",
+    "tailwindcss": "^3.4.6",
+    "typescript": "^5.5.3",
+    "vite": "^5.3.4",
     "vite-tsconfig-paths": "^4.3.2",
     "vitest": "^1.6.0"
   }
```

**File**: `src/components/Input/Input.tsx` (modified, +4/-3)
```diff
@@ -1,4 +1,4 @@
-// Tremor Raw Input [v1.0.2]
+// Tremor Raw Input [v1.0.3]
 
 import React from "react"
 import { RiEyeFill, RiEyeOffFill, RiSearchLine } from "@remixicon/react"
@@ -44,7 +44,8 @@ const inputStyles = tv({
     },
     // number input
     enableStepper: {
-      true: "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
+      false:
+        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
     },
   },
 })
@@ -61,7 +62,7 @@ const Input = React.forwardRef<HTMLInputElement, InputProps>(
       className,
       inputClassName,
       hasError,
-      enableStepper,
+      enableStepper = true,
       type,
       ...props
     }: InputProps,
```

**File**: `src/components/Input/changelog.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Tremor Raw Input Changelog
 
+## 1.0.3
+
+### Changes
+
+- Fix: enableStepper logic
+
 ## 1.0.2
 
 ### Changes
```

**File**: `src/components/Input/input.stories.tsx` (modified, +1/-1)
```diff
@@ -77,7 +77,6 @@ export const RequiredAndPattern: Story = {
 export const TypeFile: Story = {
   render: () => (
     <div className="flex gap-1">
-      {/* <Label htmlFor="upload">Search</Label> */}
       <Input id="upload" name="upload" type="file" />
       <Input id="upload" name="upload" />
       <Input id="upload" name="upload" type="password" />
@@ -104,6 +103,7 @@ export const HasError: Story = {
         id="full_name"
         name="full_name"
         type="text"
+        enableStepper
       />
     </div>
   ),
```

---

### Incident Patch 13: `3537cdea` (2024-07-14)
**Commit Message**: fix: border color drawer

**File**: `src/components/Drawer/Drawer.tsx` (modified, +1/-1)
```diff
@@ -172,7 +172,7 @@ const DrawerFooter = ({
   return (
     <div
       className={cx(
-        "flex flex-col-reverse border-t pt-4 sm:flex-row sm:justify-end sm:space-x-2",
+        "flex flex-col-reverse border-t border-gray-200 pt-4 sm:flex-row sm:justify-end sm:space-x-2 dark:border-gray-900",
         className,
       )}
       {...props}
```

---

### Incident Patch 14: `7f5a729f` (2024-07-08)
**Commit Message**: fix: payload item type

**File**: `src/components/AreaChart/AreaChart.tsx` (modified, +1/-1)
```diff
@@ -371,7 +371,7 @@ type PayloadItem = {
   value: number
   index: string
   color: AvailableChartColorsKeys
-  type: string
+  type?: string
   payload: any
 }
 
```

**File**: `src/components/BarChart/BarChart.tsx` (modified, +1/-1)
```diff
@@ -430,7 +430,7 @@ type PayloadItem = {
   value: number
   index: string
   color: AvailableChartColorsKeys
-  type: string
+  type?: string
   payload: any
 }
 
```

**File**: `src/components/LineChart/LineChart.tsx` (modified, +1/-1)
```diff
@@ -370,7 +370,7 @@ type PayloadItem = {
   value: number
   index: string
   color: AvailableChartColorsKeys
-  type: string
+  type?: string
   payload: any
 }
 
```

---

### Incident Patch 15: `948be384` (2024-07-08)
**Commit Message**: Fix/linechart (#56)

* Update LineChart.tsx

* fix type none

* add changelog

* update types

**File**: `src/components/AreaChart/AreaChart.tsx` (modified, +3/-1)
```diff
@@ -371,6 +371,7 @@ type PayloadItem = {
   value: number
   index: string
   color: AvailableChartColorsKeys
+  type: string
   payload: any
 }
 
@@ -744,14 +745,15 @@ const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>(
               offset={20}
               position={{ y: 0 }}
               content={({ active, payload, label }) => {
-                const cleanPayload = payload
+                const cleanPayload: TooltipProps["payload"] = payload
                   ? payload.map((item: any) => ({
                       category: item.dataKey,
                       value: item.value,
                       index: item.payload[index],
                       color: categoryColors.get(
                         item.dataKey,
                       ) as AvailableChartColorsKeys,
+                      type: item.type,
                       payload: item.payload,
                     }))
                   : []
```

**File**: `src/components/BarChart/BarChart.tsx` (modified, +3/-1)
```diff
@@ -430,6 +430,7 @@ type PayloadItem = {
   value: number
   index: string
   color: AvailableChartColorsKeys
+  type: string
   payload: any
 }
 
@@ -787,14 +788,15 @@ const BarChart = React.forwardRef<HTMLDivElement, BarChartProps>(
                 x: layout === "horizontal" ? undefined : yAxisWidth + 20,
               }}
               content={({ active, payload, label }) => {
-                const cleanPayload = payload
+                const cleanPayload: TooltipProps["payload"] = payload
                   ? payload.map((item: any) => ({
                       category: item.dataKey,
                       value: item.value,
                       index: item.payload[index],
                       color: categoryColors.get(
                         item.dataKey,
                       ) as AvailableChartColorsKeys,
+                      type: item.type,
                       payload: item.payload,
                     }))
                   : []
```

**File**: `src/components/LineChart/LineChart.tsx` (modified, +10/-6)
```diff
@@ -1,4 +1,4 @@
-// Tremor Raw LineChart [v0.3.0]
+// Tremor Raw LineChart [v0.3.1]
 /* eslint-disable @typescript-eslint/no-explicit-any */
 
 "use client"
@@ -332,7 +332,7 @@ const ChartLegend = (
     setLegendHeight(calculateHeight(legendRef.current?.clientHeight))
   })
 
-  const filteredPayload = payload.filter((item: any) => item.type !== "none")
+  const legendPayload = payload.filter((item: any) => item.type !== "none")
 
   const paddingLeft =
     legendPosition === "left" && yAxisWidth ? yAxisWidth - 8 : 0
@@ -349,8 +349,8 @@ const ChartLegend = (
       )}
     >
       <Legend
-        categories={filteredPayload.map((entry: any) => entry.value)}
-        colors={filteredPayload.map((entry: any) =>
+        categories={legendPayload.map((entry: any) => entry.value)}
+        colors={legendPayload.map((entry: any) =>
           categoryColors.get(entry.value),
         )}
         onClickLegendItem={onClick}
@@ -370,6 +370,7 @@ type PayloadItem = {
   value: number
   index: string
   color: AvailableChartColorsKeys
+  type: string
   payload: any
 }
 
@@ -387,6 +388,7 @@ const ChartTooltip = ({
   valueFormatter,
 }: ChartTooltipProps) => {
   if (active && payload && payload.length) {
+    const legendPayload = payload.filter((item: any) => item.type !== "none")
     return (
       <div
         className={cx(
@@ -411,7 +413,7 @@ const ChartTooltip = ({
           </p>
         </div>
         <div className={cx("space-y-1 px-4 py-2")}>
-          {payload.map(({ value, category, color }, index) => (
+          {legendPayload.map(({ value, category, color }, index) => (
             <div
               key={`id-${index}`}
               className="flex items-center justify-between space-x-8"
@@ -695,14 +697,15 @@ const LineChart = React.forwardRef<HTMLDivElement, LineChartProps>(
               offset={20}
               position={{ y: 0 }}
               content={({ active, payload, label }) => {
-                const cleanPayload = payload
+                const cleanPayload: TooltipProps["payload"] = payload
                   ? payload.map((item: any) => ({
                       category: item.dataKey,
                       value: item.value,
                       index: item.payload[index],
                       color: categoryColors.get(
                         item.dataKey,
                       ) as AvailableChartColorsKeys,
+                      type: item.type,
                       payload: item.payload,
                     }))
                   : []
@@ -735,6 +738,7 @@ const LineChart = React.forwardRef<HTMLDivElement, LineChartProps>(
                 ) : null
               }}
             />
+
             {showLegend ? (
               <RechartsLegend
                 verticalAlign="top"
```

**File**: `src/components/LineChart/changelog.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # Tremor Raw LineChart Changelog
 
+## 0.3.1
+
+### Changes
+
+- Fix: tooltip payload
+
 ## 0.3.0
 
 ### Changes
```

#### Recent Merged Pull Requests:
- **PR #168** (closed): fix(Select): remove asChild from SelectPrimitives.Icon to fix ref error (@okxint)
- **PR #167** (closed): fix(dialog): fix flicker and wrong position on open (@okxint)
- **PR #164** (closed): fix(charts): render Legend before Tooltip so tooltip appears on top (@okxint)
- **PR #155** (closed): Fix overflow scrollbars on Windows for date-range-picker (@jeelpansheriya)
- **PR #145** (closed): fix: activeIndex is not a property of Pie (@dopry)
- **PR #144** (closed): fix: BarChart.tsx TS errors (@dopry)
- **PR #135** (2025-04-12): BREAKING CHANGE: Update to tailwind v4 (@severinlandolt)
- **PR #133** (closed): feat: support rounded curves on area chart (@lauhon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
