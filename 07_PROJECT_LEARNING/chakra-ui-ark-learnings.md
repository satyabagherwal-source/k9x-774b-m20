# Forensic Learning Record (Deep Inspection): chakra-ui/ark

> **Canonical Artifact**: `07_PROJECT_LEARNING/chakra-ui-ark-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chakra-ui/ark](https://github.com/chakra-ui/ark))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:06:13.893Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chakra-ui/ark`
- **Description**: Unstyled, accessible UI components for your design System. Works in React, Vue, Solid, and Svelte.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5407 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/react/src/components/dialog/examples/rapid-state-change.tsx`
```
import { Dialog } from '@ark-ui/react/dialog'
import { Portal } from '@ark-ui/react/portal'
import { XIcon } from 'lucide-react'
import { useState } from 'react'
import button from 'styles/button.module.css'
import styles from 'styles/dialog.module.css'

const promise1 = Promise.resolve()
const promise2 = Promise.resolve()

export const RapidStateChange = () => {
  const [open, setOpen] = useState(false)

  const handleClick = async () => {
    setOpen(true)
    await promise1
    setOpen(false)
    await promise2
    setOpen(true)
  }

  return (
    <>
      <button className={button.Root} onClick={handleClick}>
        Open Dialog {String(open)}
      </button>
      <Dialog.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop className={styles.Backdrop} />
          <Dialog.Positioner className={styles.Positioner}>
            <Dialog.Content className={styles.Content}>
              <Dialog.CloseTrigger className={styles.CloseTrigger}>
                <XIcon />
              </Dialog.CloseTrigger>
              <Dialog.Title className={styles.Title}>Rapid State Test</Dialog.Title>
              <Dialog.Description className={styles.Description}>
                This dialog tests rapid state changes (true → false → true). If working correctly, the dialog should be
                open after clicking the button.
              </Dialog.Description>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  )
}

```

### Core Architecture Module: `packages/react/src/components/json-tree-view/examples/render-value.tsx`
```
import { JsonTreeView } from '@ark-ui/react/json-tree-view'
import { ChevronRightIcon } from 'lucide-react'
import styles from 'styles/json-tree-view.module.css'

export const RenderValue = () => {
  return (
    <JsonTreeView.Root
      className={styles.Root}
      defaultExpandedDepth={2}
      data={{
        name: 'John Doe',
        age: 30,
        number: Number.NaN,
        email: 'john.doe@example.com',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zip: '12345',
        },
      }}
    >
      <JsonTreeView.Tree
        className={styles.Tree}
        arrow={<ChevronRightIcon />}
        renderValue={(node) => {
          if (node.type === 'text' && typeof node.value === 'string' && isEmail(node.value)) {
            return (
              <a href={`mailto:${node.value}`} target="_blank" rel="noreferrer">
                {node.value}
              </a>
            )
          }
        }}
      />
    </JsonTreeView.Root>
  )
}

const isEmail = (value: string) => {
  const strippedValue = value.replace(/^"(.*)"$/, '$1')
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strippedValue)
}

```

### Core Architecture Module: `packages/react/src/components/marquee/examples/finite-loops.tsx`
```
import { useState } from 'react'
import { Marquee } from '@ark-ui/react/marquee'
import styles from 'styles/marquee.module.css'

const items = [
  { name: 'Apple', logo: '🍎' },
  { name: 'Banana', logo: '🍌' },
  { name: 'Cherry', logo: '🍒' },
  { name: 'Grape', logo: '🍇' },
  { name: 'Watermelon', logo: '🍉' },
  { name: 'Strawberry', logo: '🍓' },
]

export const FiniteLoops = () => {
  const [loopCount, setLoopCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)

  return (
    <div className="stack">
      <Marquee.Root
        loopCount={3}
        onLoopComplete={() => setLoopCount((prev) => prev + 1)}
        onComplete={() => setCompletedCount((prev) => prev + 1)}
        className={styles.Root}
      >
        <Marquee.Viewport className={styles.Viewport}>
          <Marquee.Content className={styles.Content}>
            {items.map((item, i) => (
              <Marquee.Item key={i} className={styles.Item}>
                <span className={styles.ItemLogo}>{item.logo}</span>
                <span className={styles.ItemName}>{item.name}</span>
              </Marquee.Item>
            ))}
          </Marquee.Content>
        </Marquee.Viewport>
      </Marquee.Root>

      <div>
        <p>Loop completed: {loopCount} times</p>
        <p>Animation completed: {completedCount} times</p>
      </div>
    </div>
  )
}

```

### Core Architecture Module: `packages/react/src/providers/hotkeys/examples/key-state.tsx`
```
import { useHotkey, useIsKeyPressed, usePressedKeys } from '@ark-ui/react/hotkeys'
import styles from 'styles/hotkeys.module.css'

export const KeyState = () => {
  useHotkey({ hotkey: 'mod+K', action: () => {} })

  const pressedKeys = usePressedKeys()
  const isShiftPressed = useIsKeyPressed({ hotkey: 'shift' })

  return (
    <div className={styles.Panel}>
      <p className={styles.Hint}>Hold any key to see it tracked live</p>

      <div className={styles.Section}>
        <span className={styles.SectionLabel}>Currently pressed</span>
        <div className={styles.KeyStrip}>
          {pressedKeys.length === 0 ? (
            <span className={styles.Placeholder}>nothing</span>
          ) : (
            pressedKeys.map((key) => (
              <kbd className={styles.Kbd} key={key} data-active="">
                {key}
              </kbd>
            ))
          )}
        </div>
      </div>

      <div className={styles.Section}>
        <span className={styles.SectionLabel}>Shift</span>
        <span className={styles.Badge} data-state={isShiftPressed ? 'active' : undefined}>
          <span className={styles.Dot} data-pulse={isShiftPressed ? '' : undefined} />
          {isShiftPressed ? 'Precision mode' : 'Hold Shift for precision'}
        </span>
      </div>
    </div>
  )
}

```

### Core Architecture Module: `packages/react/src/utils/attr.ts`
```
export { ariaAttr, dataAttr } from '@zag-js/dom-query'

```

### Core Architecture Module: `packages/react/src/utils/compose-refs.ts`
```
import { useCallback } from 'react'
import type { Ref, RefCallback } from 'react'

type PossibleRef<T> = Ref<T | null> | undefined

export function composeRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
  return (node) => {
    const cleanUps: VoidFunction[] = []
    let hasCustomCleanUp = false

    for (const ref of refs) {
      if (typeof ref === 'function') {
        const cb = ref(node)
        if (typeof cb === 'function') {
          hasCustomCleanUp = true
          cleanUps.push(cb)
        } else {
          cleanUps.push(() => ref(null))
        }
      } else if (ref) {
        ref.current = node
        cleanUps.push(() => {
          ref.current = null
        })
      }
    }

    if (hasCustomCleanUp) {
      return () => {
        for (const cleanUp of cleanUps) {
          cleanUp()
        }
      }
    }
  }
}

export function useComposedRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs is the dependency list for the composed callback
  return useCallback(composeRefs(...refs), refs)
}

```

### Core Architecture Module: `packages/react/src/utils/create-context.ts`
```
import { hasProp, isFunction } from '@zag-js/utils'
import { createContext as createReactContext, useContext as useReactContext } from 'react'

interface CreateContextOptions<T> {
  strict?: boolean | undefined
  hookName?: string | undefined
  providerName?: string | undefined
  errorMessage?: string | undefined
  name?: string | undefined
  defaultValue?: T | undefined
}

type CreateContextReturn<T> = [React.Provider<T>, () => T, React.Context<T>]

function getErrorMessage(hook: string, provider: string) {
  return `${hook} returned \`undefined\`. Seems you forgot to wrap component within ${provider}`
}

export function createContext<T>(options: CreateContextOptions<T> = {}) {
  const {
    name,
    strict = true,
    hookName = 'useContext',
    providerName = 'Provider',
    errorMessage,
    defaultValue,
  } = options

  const Context = createReactContext<T | undefined>(defaultValue)

  Context.displayName = name

  function useContext() {
    const context = useReactContext(Context)

    if (!context && strict) {
      const error = new Error(errorMessage ?? getErrorMessage(hookName, providerName))
      error.name = 'ContextError'
      if (hasProp(Error, 'captureStackTrace') && isFunction(Error.captureStackTrace)) {
        Error.captureStackTrace(error, useContext)
      }
      throw error
    }

    return context
  }

  return [Context.Provider, useContext, Context] as CreateContextReturn<T>
}

```

### Core Architecture Module: `packages/react/src/utils/create-split-props.ts`
```
type EnsureKeys<ExpectedKeys extends (keyof Target)[], Target> = keyof Target extends ExpectedKeys[number]
  ? unknown
  : `Missing required keys: ${Exclude<keyof Target, ExpectedKeys[number]> & string}`

export const createSplitProps =
  <Target>() =>
  <Keys extends (keyof Target)[], Props extends Target = Target>(props: Props, keys: Keys & EnsureKeys<Keys, Target>) =>
    (keys as string[]).reduce<[Target, Omit<Props, Extract<(typeof keys)[number], string>>]>(
      (previousValue, currentValue) => {
        const [target, source] = previousValue
        const key = currentValue as keyof Target & keyof typeof source
        if (source[key] !== undefined) {
          target[key] = source[key]
        }
        delete source[key]
        return [target, source]
      },
      [{} as Target, { ...props }],
    )

```

### Core Architecture Module: `packages/react/src/utils/index.ts`
```
export { ariaAttr, dataAttr } from './attr.ts'
export { createContext } from './create-context.ts'
export { mergeProps } from '@zag-js/core'

```

### Core Architecture Module: `packages/react/src/utils/react-activity.ts`
```
'use client'

import * as React from 'react'
import type { ComponentType, ReactNode } from 'react'

interface ActivityProps {
  children?: ReactNode | undefined
  mode: 'visible' | 'hidden'
}

type ActivityComponent = ComponentType<ActivityProps>

export const getActivity = (react: object): ActivityComponent | undefined =>
  Reflect.get(react, 'Activity') as ActivityComponent | undefined

export const Activity = getActivity(React)
export const supportsActivity = Activity !== undefined

```

### Core Architecture Module: `packages/react/src/utils/render-strategy.ts`
```
'use client'

import { createContext } from './create-context.ts'
import { createSplitProps } from './create-split-props.ts'

export type HideMode = 'display-none' | 'activity'

export interface RenderStrategyProps {
  /**
   * Whether to enable lazy mounting
   * @default false
   */
  lazyMount?: boolean | undefined
  /**
   * Whether to unmount on exit.
   * @default false
   */
  unmountOnExit?: boolean | undefined
  /**
   * How to hide content when mounted but not present.
   * - `'display-none'`: HTML `hidden` attribute. Effects stay alive.
   * - `'activity'`: React 19 `<Activity mode="hidden">`. Effects pause. Requires React 19+.
   * @default 'display-none'
   */
  hideMode?: HideMode | undefined
}

export const [RenderStrategyPropsProvider, useRenderStrategyPropsContext] = createContext<RenderStrategyProps>({
  name: 'RenderStrategyContext',
  hookName: 'useRenderStrategyContext',
  providerName: '<RenderStrategyPropsProvider />',
})

export const splitRenderStrategyProps = <T extends RenderStrategyProps>(props: T) =>
  createSplitProps<RenderStrategyProps>()(props, ['lazyMount', 'unmountOnExit', 'hideMode'])

```

### Core Architecture Module: `packages/react/src/utils/run-if-fn.ts`
```
type AnyFunction<Arg = unknown, ReturnValue = unknown> = (...args: Arg[]) => ReturnValue

const isFunction = <T = AnyFunction>(value: unknown): value is T => typeof value === 'function'

export const runIfFn = <MaybeReturnValue, FunctionArgs>(
  valueOrFn: MaybeReturnValue | ((...fnArgs: FunctionArgs[]) => MaybeReturnValue),
  ...args: FunctionArgs[]
) =>
  isFunction<AnyFunction<FunctionArgs, MaybeReturnValue>>(valueOrFn)
    ? valueOrFn(...args)
    : (valueOrFn as unknown as MaybeReturnValue)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3304** (2025-02-16): **Fix: Field Helper Text missing data-disabled attribute when field is disabled**
  *Symptoms*: Added `data-disabled` attribute to `getHelperTextProps()` for the Field component (React, Solid and Vue). Added disabled example for the Field component (React, Solid and Vue). Added tests to check on the `data-disabled` attribute when the Field is disabled  (React, Solid and Vue).  Fixes: #3286  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #iq7RjUphO/R+P2nq5GJU+za9e/2H9wHLLNmcMYHq7Mw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJhcmstZG9jcyIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jaGFrcmEtdWkvYXJrLWRvY3MvSDlwa2NHa05SaGJYNmE3RDNrcVRFWHltaWRERSIsInByZXZpZXdVcmwiOiJhcmstZG9jcy1naXQtYi1maWVsZC1oZWxwZXItdGV4dC1kYXRhLWF0dHItY2hha3JhLXVpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJyb290RGlyZWN0b3J5Ijoid2Vic2l0ZSJ9XX0= **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated (UTC) | | :--- | :----- | :------ | :------ | | **ark-docs** | ✅ Ready ([Inspect](https://vercel.com/chakra-ui/ark-docs/H9pkcGkNRhbX6a7D3kqTEXymidDE)) | [Visit Preview](https://ark-docs-git-b-field-helper-text-data-attr-chakra-ui.vercel.app) | Feb 15, 2025 9:42pm |  
  >  [Open in Stackblitz](https://pkg.pr.new/template/f9a9877a-8fe6-4613-b99d-93c374aa61ec)   ``` npm i https://pkg.pr.new/chakra-ui/ark/@ark-ui/react@3304 ```   ``` npm i https://pkg.pr.new/chakra-ui/ark/@ark-ui/solid@3304 ```   ``` npm i https://pkg.pr.new/chakra-ui/ark/@ark-ui/vue@3304 ```   ``` npm i https://pkg.pr.new/chakra-ui/ark/@ark-ui/svelte@3304 ```   _commit: <a href="https://github.com/chakra-ui/ark/runs/37282820738"><code>941014d</code></a>_ 
  > @carwack awesome mate. thanks for your contribution

- **Issue #3174** (2024-12-28): **Inconsistent indeterminate checkbox behavior**
  *Symptoms*: ### Description  When using `indeterminate` prop in the Checkbox it behaves differently across frameworks.  In React: - With `indeterminate` on, it is impossible to toggle state by clicking  In Vue, Svelte: - Clicking on the indeterminated checkbox changes state to `checked = true`  Solid: I couldn't check because of some broken build  Zag.js: - Machine seems to be able to update state from `indeterminate` to boolean values.  In terms of design, I found that many software installers have the Vue/Svelte option - possibility to remove the intermediate state.   ### Link to Reproduction (or Detailed Explanation)  Storybook  ### Steps to Reproduce  1. Use Storybook 2. You may check on [Zag.js website ](https://zagjs.com/components/react/checkbox) too 3. Set `indeterminate` prop on the checkbox's root 4. Click on the checkbox  ### Ark UI Version  4.5.0  ### Framework  - [X] React - [X] Solid - [X] Vue  ### Browser  Brave 1.73.104  ### Additional Information  _No response_

- **Issue #3136** (2024-12-22): **Scroll Restoration in Overflowing Select Menus**
  *Symptoms*: ### Description  I had a select component which was working fine prior to 4.5.0.  Issues are there with keyboard navigation and scrolling to selected item.  I also confirmed with the official Select examples on ark-ui  ### Link to Reproduction (or Detailed Explanation)  https://stackblitz.com/edit/vitejs-vite-fpkbyy?file=src%2FApp.tsx  ### Steps to Reproduce  1. Open the repro link, select any item after the scroll and re-open it. 2. Click the select trigger and try to navigate the items using keyboard.  ### Ark UI Version  4.5.0  ### Framework  - [X] React - [ ] Solid - [ ] Vue  ### Browser  Google Chrome Dev  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > @thevipinmishra   Thanks for taking your time to report this issue. I could reproduce this in your Stackblitz and our Storybook setup.
  > This regression was introduced by https://github.com/chakra-ui/ark/pull/3081  I just pushed a fix for this. We'll release an update shortly to see if it fixes the issue.

- **Issue #3066** (2024-11-22): **NumberInput render issue**
  *Symptoms*: ### Description  When the NumberInput is rendered, the resulting UI is in disarray.   ### Link to Reproduction (or Detailed Explanation)  https://ark-ui.com/react/docs/components/number-input  ### Steps to Reproduce  Got to NumberInput in Ark component gallery and you should immediately see the issue.  ### Ark UI Version  4.4.4  ### Framework  - [X] React - [X] Solid - [X] Vue  ### Browser  Google Chrome  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > @rollercodester Thanks for taking your time to report the issue. I could fix it. Cheers

- **Issue #3065** (2024-12-04): **Component Tabs bugs with controlled mode on first change**
  *Symptoms*: ### Description  When I create a controlled tabs, during the first onValueChange call, I do not change the index and the Tabs.Content unmounts when it shouldn't.  ### Link to Reproduction  https://stackblitz.com/edit/chakra-ui-v3-o9atp5?file=src%2FApp.tsx  ### Steps to reproduce  1. Click on "Second tab" 2. The text "First panel" disappears when it shouldn't  ### Chakra UI Version  3.1.2  ### Browser  Firefox 132.0.2 (latest), Chromium 130.0.6723.116  ### Operating System  - [ ] macOS - [ ] Windows - [X] Linux  ### Additional Information  Initial render is ok :  ![image](https://github.com/user-attachments/assets/536e4696-74e8-48d6-a463-e8dca0c64655)  Click on "Second tab" (text has disappeared)  ![image](https://github.com/user-attachments/assets/1eb096c7-e467-4fe4-ae8d-938a3a997eae)
  **Post-Mortem & Fix Analysis**:
  > @PlayeurZero I transferred the issue to Ark where the underlying issue lives.
  > @segunadebayo   I debugged this a bit and machines returns the value for the second tab, and immediately the value for the first. That should not be the case. What your thoughts?

- **Issue #3043** (2024-12-28): **React Carousel forces sliding animation when using `defaultIndex`**
  *Symptoms*: ### Description  When I use `defaultIndex` prop, I expect the carousel to be rendered with that slide initially. But instead, it would render the first image then slide through all the slides inbetween with a slide animation to the chosen default image.  ### Link to Reproduction (or Detailed Explanation)  See steps.  ### Steps to Reproduce  1. Implement a basic Ark UI carousel (Reect) 2. Have more than 1 image 3. Set prop `defaultIndex` to be larger than `0`  ### Ark UI Version  4.4.0  ### Framework  - [X] React - [ ] Solid - [ ] Vue  ### Browser  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > @itsJimmyQ   Thanks for reaching out. Good catch. Will see what we can do :)
  > Hey @cschroeter  Is there any update on this bug?
  > This has been fixed in a recent PR. We’ll publish a new version shortly.

- **Issue #2680** (2024-07-20): **fix(docs): fix z-index of docs navbar to 2**
  *Symptoms*: This PR should fix: https://github.com/chakra-ui/ark/issues/2625 and is addition to this PR: #2676   Noticed the same behavior on the docs navbar on the mobile view. I bumped the z-index of the docs navbar to 2, this will be higher than the z-index of the tabs (which is 1).
  **Post-Mortem & Fix Analysis**:
  > [vc]: #BomDpcbwghXGxoWXQTnwOqtQOBg1691TVR52CJM+nWw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJhcmstZG9jcyIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jaGFrcmEtdWkvYXJrLWRvY3MvNEpvcTZLblQ3cndzU3FFY1R4YXNYMm5ocGlZNCIsInByZXZpZXdVcmwiOiJhcmstZG9jcy1naXQtZG9jcy1maXgtY29kZS10YWJzLXRleHQtZGlzcGxheXMtNWYzMWU0LWNoYWtyYS11aS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwicm9vdERpcmVjdG9yeSI6IndlYnNpdGUifV19 **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated (UTC) | | :--- | :----- | :------ | :------ | | **ark-docs** | ✅ Ready ([Inspect](https://vercel.com/chakra-ui/ark-docs/4Joq6KnT7rwsSqEcTxasX2nhpiY4)) | [Visit Preview](https://ark-docs-git-docs-fix-code-tabs-text-displays-5f31e4-chakra-ui.vercel.app) | Jul 20, 2024 9:42pm |  

- **Issue #2676** (2024-07-20): **fix(docs): fix z-index of top navigation to 2**
  *Symptoms*: This PR should fix: #2625   I bumped the z-index of the navbar to 2, this will be higher than the z-index of the tabs (which is 1).
  **Post-Mortem & Fix Analysis**:
  > [vc]: #uZQ/vu0aSU+ObnYP8C7fhMVUlffI1bHpwDbXccSZcG8=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJhcmstZG9jcyIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jaGFrcmEtdWkvYXJrLWRvY3MvOW9uUDJ4YXpmUGJ5dTFqWkZDTE44N0x4S0pyUSIsInByZXZpZXdVcmwiOiJhcmstZG9jcy1naXQtZG9jcy1maXgtY29kZS10YWJzLXRleHQtZGlzcGxheXMtNWYzMWU0LWNoYWtyYS11aS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn1dfQ== **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated (UTC) | | :--- | :----- | :------ | :------ | | **ark-docs** | ✅ Ready ([Inspect](https://vercel.com/chakra-ui/ark-docs/9onP2xazfPbyu1jZFCLN87LxKJrQ)) | [Visit Preview](https://ark-docs-git-docs-fix-code-tabs-text-displays-5f31e4-chakra-ui.vercel.app) | Jul 19, 2024 11:17pm |  

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

### Incident Patch 1: `28f20ae0` (2026-10-02)
**Commit Message**: fix(svelte): bind ref to the asChild element (#4145)

asChild parts never set bind:ref because the factory only bound refs on elements it rendered itself. Attach a ref setter to the props passed to the asChild snippet so ref points at the child element, and clear it on teardown only if it still points at that node.

**File**: `.changeset/svelte-factory-as-child-ref.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+'@ark-ui/svelte': patch
+---
+
+Fix `bind:ref` staying `null` when a component renders through `asChild`. The factory bound `ref` only on the element it
+renders itself, so in `asChild` mode the caller's element was never assigned. The props function now carries an
+attachment that sets `ref` to the child element, matching React, where the ref reaches the `asChild` child.
```

**File**: `packages/svelte/src/lib/components/factory/examples/ref.svelte` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+<script lang="ts">
+  import Ark from '../factory.svelte'
+
+  interface Props {
+    onRef?: (ref: Element | null) => void
+  }
+
+  const { onRef }: Props = $props()
+
+  let ref = $state<Element | null>(null)
+
+  $effect(() => onRef?.(ref))
+</script>
+
+<Ark as="button" bind:ref>
+  {#snippet asChild(props)}
+    <button {...props({ type: 'button' })} data-testid="child">Ark UI</button>
+  {/snippet}
+</Ark>
```

**File**: `packages/svelte/src/lib/components/factory/factory.svelte` (modified, +11/-1)
```diff
@@ -2,6 +2,7 @@
   import type { HTMLProps, PolymorphicProps, PropsFn } from '$lib/types'
   import { isVoidHTMLTag, isVoidSVGTag } from '$lib/utils/tags'
   import { mergeProps } from '@zag-js/svelte'
+  import { createAttachmentKey } from 'svelte/attachments'
   import type { SvelteHTMLElements } from 'svelte/elements'
   import Svg from './svg-factory.svelte'
 
@@ -19,7 +20,16 @@
 
   let { asChild, children, as, ref = $bindable(null), ...rest }: Props = $props()
 
-  const propsFn: PropsFn<T> = (props) => mergeProps(rest, props ?? {})
+  const refKey = createAttachmentKey()
+
+  const setRef = (node: Element) => {
+    ref = node
+    return () => {
+      if (ref === node) ref = null
+    }
+  }
+
+  const propsFn: PropsFn<T> = (props) => mergeProps(rest, props ?? {}, { [refKey]: setRef })
 </script>
 
 {#if asChild}
```

**File**: `packages/svelte/src/lib/components/factory/factory.test.ts` (modified, +8/-0)
```diff
@@ -2,6 +2,7 @@ import { render, screen } from '@testing-library/svelte'
 import user from '@testing-library/user-event'
 import { describe, expect, it, vi } from 'vitest'
 import ComponentUnderTest from './examples/basic.svelte'
+import RefComponent from './examples/ref.svelte'
 
 describe('Ark Factory', () => {
   it('should render only the child', () => {
@@ -37,4 +38,11 @@ describe('Ark Factory', () => {
     expect(onClickParent).toHaveBeenCalled()
     expect(onClickChild).toHaveBeenCalled()
   })
+
+  it('should bind ref to the child element', async () => {
+    const onRef = vi.fn()
+    render(RefComponent, { onRef })
+
+    await vi.waitFor(() => expect(onRef).toHaveBeenLastCalledWith(screen.getByTestId('child')))
+  })
 })
```

---

### Incident Patch 2: `5c6aea6c` (2026-10-02)
**Commit Message**: fix(svelte): type asChild props for any element and export the polymorphic types (#4146)

Type the handlers returned by asChild's props() for any element so they can be spread onto non-HTML elements like svg, and export HTMLProps, HTMLTag, PolymorphicProps, PropsFn and RefAttribute from @ark-ui/svelte.

**File**: `.changeset/svelte-polymorphic-types.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+'@ark-ui/svelte': patch
+---
+
+- Fix the `asChild` props function rejecting an SVG child. It returned `HTMLAttributes<HTMLElement>`, whose event
+  handlers don't accept an `SVGElement`, so `<svg {...props()}>` failed to typecheck without a cast. It now returns
+  attributes any element accepts, which keeps spreading a part's props onto a different element (a trigger rendered as
+  `<a>`) working.
+- Export `HTMLProps`, `HTMLTag`, `PolymorphicProps`, `PropsFn` and `RefAttribute`, so wrappers can type their own
+  polymorphic props the way `@ark-ui/react` exports `HTMLArkProps` and `PolymorphicProps`.
```

**File**: `packages/svelte/src/lib/components/factory/examples/svg.svelte` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+<script lang="ts">
+  import Ark from '../factory.svelte'
+</script>
+
+<Ark as="svg" aria-hidden="true">
+  {#snippet asChild(props)}
+    <svg {...props({ viewBox: '0 0 8 8' })} data-testid="child"><circle cx="4" cy="4" r="4" /></svg>
+  {/snippet}
+</Ark>
```

**File**: `packages/svelte/src/lib/index.ts` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 export * from './components/index.ts'
 export * from './providers/index.ts'
 export * from './utils/index.ts'
-export type { Assign, Optional } from './types.ts'
+export type { Assign, HTMLProps, HTMLTag, Optional, PolymorphicProps, PropsFn, RefAttribute } from './types.ts'
```

**File**: `packages/svelte/src/lib/types.ts` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>
 export type Accessor<T> = () => T
 
 export type HTMLTag = keyof SvelteHTMLElements
-export type PropsFn<T extends HTMLTag> = (props?: HTMLProps<T>) => HTMLAttributes<HTMLElement>
+export type PropsFn<T extends HTMLTag> = (props?: HTMLProps<T>) => HTMLAttributes<any>
 
 export type HTMLProps<T extends HTMLTag> = SvelteHTMLElements[T]
 
```

---

### Incident Patch 3: `3f3c38f4` (2026-10-02)
**Commit Message**: test(vue): keep Tour as a value import in the tour test fixture

**File**: `packages/vue/src/components/tour/tests/tour.test.vue` (modified, +9/-3)
```diff
@@ -1,9 +1,15 @@
 <script setup lang="ts">
-import { type Tour, type TourStepDetails, useTour } from '@ark-ui/vue/tour'
+import {
+  Tour,
+  type TourStatusChangeDetails,
+  type TourStepChangeDetails,
+  type TourStepDetails,
+  useTour,
+} from '@ark-ui/vue/tour'
 
 const props = defineProps<{
-  onStatusChange: (details: Tour.StatusChangeDetails) => void
-  onStepChange: (details: Tour.StepChangeDetails) => void
+  onStatusChange: (details: TourStatusChangeDetails) => void
+  onStepChange: (details: TourStepChangeDetails) => void
 }>()
 
 const steps: TourStepDetails[] = [
```

---

### Incident Patch 4: `a57a6519` (2026-10-02)
**Commit Message**: fix(vue): only declare the presence events on Tour.Root

Tour.Root receives a tour created by useTour, so it can only emit
enterComplete and exitComplete. Machine events like statusChange and
stepChange are delivered through the callbacks passed to useTour.
Also fixes the swapped enterComplete/exitComplete descriptions and
refreshes the affected Vue type docs.

Closes #4152

**File**: `.changeset/vue-tour-root-emits.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+'@ark-ui/vue': patch
+---
+
+- **Tour**: Fix `Tour.RootEmits` declaring `statusChange`, `stepChange` and other machine events that `Tour.Root` never
+  emits. It now only declares `enterComplete` and `exitComplete`. Pass `onStatusChange`, `onStepChange` and the other
+  callbacks to `useTour` instead.
+- **Presence**: Fix the `enterComplete` and `exitComplete` event descriptions being swapped.
```

**File**: `packages/vue/src/components/presence/presence.types.ts` (modified, +3/-3)
```diff
@@ -27,12 +27,12 @@ export interface RootProps {
 }
 
 export type RootEmits = {
-  /**
-   * Function called when the animation ends in the closed state
-   */
   /**
    * Function called when the animation ends in the open state
    */
   enterComplete: []
+  /**
+   * Function called when the animation ends in the closed state
+   */
   exitComplete: []
 }
```

**File**: `packages/vue/src/components/tour/tests/tour.test.ts` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import userEvent from '@testing-library/user-event'
+import { render, screen, waitFor } from '@testing-library/vue'
+import type { Tour } from '../index.ts'
+import ComponentUnderTest from './tour.test.vue'
+
+describe('Tour', () => {
+  beforeAll(() => {
+    if (window.visualViewport) return
+    Object.defineProperty(window, 'visualViewport', {
+      configurable: true,
+      value: Object.assign(new EventTarget(), { width: 1024, height: 768, offsetTop: 0, offsetLeft: 0, scale: 1 }),
+    })
+  })
+
+  it('should call status and step callbacks passed to useTour', async () => {
+    const onStatusChange = vi.fn()
+    const onStepChange = vi.fn()
+    render(ComponentUnderTest, { props: { onStatusChange, onStepChange } })
+
+    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
+    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'started' })))
+    expect(onStepChange).toHaveBeenLastCalledWith(expect.objectContaining({ stepId: 'one' }))
+
+    await userEvent.click(screen.getByRole('button', { name: 'Next step' }))
+    expect(onStepChange).toHaveBeenLastCalledWith(expect.objectContaining({ stepId: 'two' }))
+  })
+
+  it('should only declare the events Tour.Root emits', () => {
+    expectTypeOf<keyof Tour.RootEmits>().toEqualTypeOf<'enterComplete' | 'exitComplete'>()
+  })
+})
```

**File**: `packages/vue/src/components/tour/tests/tour.test.vue` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+<script setup lang="ts">
+import { type Tour, type TourStepDetails, useTour } from '@ark-ui/vue/tour'
+
+const props = defineProps<{
+  onStatusChange: (details: Tour.StatusChangeDetails) => void
+  onStepChange: (details: Tour.StepChangeDetails) => void
+}>()
+
+const steps: TourStepDetails[] = [
+  { id: 'one', type: 'dialog', title: 'One', description: 'First', actions: [{ label: 'Next', action: 'next' }] },
+  { id: 'two', type: 'dialog', title: 'Two', description: 'Second', actions: [{ label: 'Finish', action: 'dismiss' }] },
+]
+
+const tour = useTour({
+  steps,
+  onStatusChange: (details) => props.onStatusChange(details),
+  onStepChange: (details) => props.onStepChange(details),
+})
+</script>
+
+<template>
+  <button type="button" @click="tour.start()">Start</button>
+  <button type="button" @click="tour.next()">Next step</button>
+  <Tour.Root :tour="tour">
+    <Tour.Positioner>
+      <Tour.Content>
+        <Tour.Title />
+        <Tour.Actions v-slot="actions">
+          <Tour.ActionTrigger v-for="action in actions" :key="action.label" :action="action" />
+        </Tour.Actions>
+      </Tour.Content>
+    </Tour.Positioner>
+  </Tour.Root>
+</template>
```

**File**: `packages/vue/src/components/tour/tour-root.vue` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 <script lang="ts">
 import type { RenderStrategyProps } from '../../utils/use-render-strategy.ts'
-import type { RootEmits } from './tour.types.ts'
+import type { RootEmits as PresenceEmits } from '../presence/presence.types.ts'
 import type { UseTourReturn } from './use-tour.ts'
 
 interface RootProps {
@@ -9,7 +9,7 @@ interface RootProps {
 
 export interface TourRootBaseProps extends RootProps, RenderStrategyProps {}
 export interface TourRootProps extends TourRootBaseProps {}
-export interface TourRootEmits extends RootEmits {}
+export interface TourRootEmits extends PresenceEmits {}
 </script>
 
 <script setup lang="ts">
```

**File**: `packages/vue/src/components/tour/use-tour.ts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import { type ComputedRef, type MaybeRef, computed, toValue, useId } from 'vue'
 import { DEFAULT_ENVIRONMENT, DEFAULT_LOCALE, useEnvironmentContext, useLocaleContext } from '../../providers/index.ts'
 import type { EmitFn, Optional } from '../../types.ts'
 import { cleanProps } from '../../utils/clean-props.ts'
-import type { RootEmits } from './tour.ts'
+import type { RootEmits } from './tour.types.ts'
 
 export interface UseTourProps extends Optional<Omit<tour.Props, 'dir' | 'getRootNode'>, 'id'> {}
 export interface UseTourReturn extends ComputedRef<tour.Api<PropTypes>> {}
```

**File**: `website/src/content/types/vue/color-picker.types.json` (modified, +5/-0)
```diff
@@ -326,6 +326,11 @@
   },
   "RootProvider": {
     "emits": {
+      "enterComplete": {
+        "type": "[]",
+        "isRequired": true,
+        "description": "Function called when the animation ends in the open state"
+      },
       "exitComplete": {
         "type": "[]",
         "isRequired": true,
```

**File**: `website/src/content/types/vue/combobox.types.json` (modified, +5/-0)
```diff
@@ -295,6 +295,11 @@
   },
   "RootProvider": {
     "emits": {
+      "enterComplete": {
+        "type": "[]",
+        "isRequired": true,
+        "description": "Function called when the animation ends in the open state"
+      },
       "exitComplete": {
         "type": "[]",
         "isRequired": true,
```

---

### Incident Patch 5: `2f46d748` (2026-10-02)
**Commit Message**: fix: export zag types referenced by root props and emits

Re-export the zag types that Select, Clipboard, DateInput, ImageCropper,
QrCode and Steps root props/emits reference but didn't expose. Without
them, Vue declaration emit for components wrapping these roots fails with
TS2883 under pnpm's isolated layout, since @zag-js/* isn't resolvable
from the consumer.

Closes #4156

**File**: `.changeset/export-zag-detail-types.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+---
+'@ark-ui/react': patch
+'@ark-ui/solid': patch
+'@ark-ui/vue': patch
+'@ark-ui/svelte': patch
+---
+
+- **Select**: Export `SelectIntlTranslations`, `SelectPositioningOptions`, `SelectScrollToIndexDetails` and
+  `SelectSelectionDetails`.
+- **Clipboard**: Export `ClipboardValueChangeDetails`.
+- **DateInput**: Export `DateInputPlaceholderChangeDetails`.
+- **ImageCropper**: Export `ImageCropperRect`.
+- **QrCode**: Export `QrCodeValueChangeDetails`.
+- **Steps**: Export `StepInvalidDetails`.
+
+In Vue, this fixes TS2883 ("cannot be named without a reference to …") when emitting declarations for a component that
+wraps one of these roots, for example a generic `Select.Root` wrapper built with pnpm.
```

**File**: `packages/react/src/components/clipboard/clipboard.ts` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-export type { CopyStatusDetails } from '@zag-js/clipboard'
+export type { CopyStatusDetails, ValueChangeDetails } from '@zag-js/clipboard'
 export { ClipboardContext as Context, type ClipboardContextProps as ContextProps } from './clipboard-context.tsx'
 export {
   ClipboardControl as Control,
```

**File**: `packages/react/src/components/clipboard/index.ts` (modified, +4/-1)
```diff
@@ -1,4 +1,7 @@
-export type { CopyStatusDetails as ClipboardCopyStatusDetails } from '@zag-js/clipboard'
+export type {
+  CopyStatusDetails as ClipboardCopyStatusDetails,
+  ValueChangeDetails as ClipboardValueChangeDetails,
+} from '@zag-js/clipboard'
 export { ClipboardContext, type ClipboardContextProps } from './clipboard-context.tsx'
 export { ClipboardControl, type ClipboardControlBaseProps, type ClipboardControlProps } from './clipboard-control.tsx'
 export {
```

**File**: `packages/react/src/components/date-input/date-input.ts` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+export type { PlaceholderChangeDetails } from '@zag-js/date-input'
 export { DateInputContext as Context, type DateInputContextProps as ContextProps } from './date-input-context.tsx'
 export {
   DateInputLabel as Label,
```

**File**: `packages/react/src/components/date-input/index.ts` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 export type {
   DateValue as DateInputDateValue,
   FocusChangeDetails as DateInputFocusChangeDetails,
+  PlaceholderChangeDetails as DateInputPlaceholderChangeDetails,
   SelectionMode as DateInputSelectionMode,
   ValueChangeDetails as DateInputValueChangeDetails,
 } from '@zag-js/date-input'
```

**File**: `packages/react/src/components/image-cropper/image-cropper.ts` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ export type {
   PreviewDescriptionDetails,
   SelectionValueTextDetails,
 } from '@zag-js/image-cropper'
+export type { Rect } from '@zag-js/types'
 export { handles } from '@zag-js/image-cropper'
 export {
   ImageCropperContext as Context,
```

**File**: `packages/react/src/components/image-cropper/index.ts` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ export type {
   RotationChangeDetails as ImageCropperRotationChangeDetails,
   ZoomChangeDetails as ImageCropperZoomChangeDetails,
 } from '@zag-js/image-cropper'
+export type { Rect as ImageCropperRect } from '@zag-js/types'
 export { ImageCropperContext, type ImageCropperContextProps } from './image-cropper-context.tsx'
 export { ImageCropperGrid, type ImageCropperGridBaseProps, type ImageCropperGridProps } from './image-cropper-grid.tsx'
 export {
```

**File**: `packages/react/src/components/qr-code/index.ts` (modified, +5/-1)
```diff
@@ -1,4 +1,8 @@
-export type { QrCodeGenerateOptions, QrCodeGenerateResult } from '@zag-js/qr-code'
+export type {
+  QrCodeGenerateOptions,
+  QrCodeGenerateResult,
+  ValueChangeDetails as QrCodeValueChangeDetails,
+} from '@zag-js/qr-code'
 export { QrCodeContext, type QrCodeContextProps } from './qr-code-context.tsx'
 export {
   QrCodeDownloadTrigger,
```

---

### Incident Patch 6: `80bfdd19` (2026-10-02)
**Commit Message**: fix(vue): move tree view mutation add handler out of the template

The multi-statement inline handler fails to compile with the current Vue
compiler, and the formatter strips the separator, which broke every tree
view story.

**File**: `packages/vue/src/components/tree-view/examples/mutation-tree-node.vue` (modified, +6/-7)
```diff
@@ -23,6 +23,11 @@ const emit = defineEmits<{
 
 const tree = useTreeViewContext()
 const nodeState = tree.value.getNodeState(props)
+
+const addChild = () => {
+  emit('add', { node: props.node, indexPath: props.indexPath })
+  tree.value.expand([props.node.id])
+}
 </script>
 
 <template>
@@ -38,13 +43,7 @@ const nodeState = tree.value.getNodeState(props)
             <button :class="styles.Action" @click.stop="emit('remove', { node, indexPath })">
               <Trash />
             </button>
-            <button
-              :class="styles.Action"
-              @click.stop="
-                emit('add', { node, indexPath })
-                tree.expand([node.id])
-              "
-            >
+            <button :class="styles.Action" @click.stop="addChild">
               <Plus />
             </button>
           </div>
```

---

### Incident Patch 7: `6064a18d` (2026-10-02)
**Commit Message**: fix(tree-view): keep node types and fix checkbox indicator in vue and solid

- vue: pass the node type through RootEmits and useTreeView
- vue: remove the unrendered fallback/indeterminate props from
  NodeCheckboxIndicator in favor of the slots
- solid: make NodeCheckboxIndicator react to checked state changes
- solid: pass the node type through useTreeView
- vue: fix the mutation and checkbox tree examples that broke the
  tree view stories

Closes #4151

**File**: `.changeset/solid-tree-view-checkbox-indicator.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+'@ark-ui/solid': patch
+---
+
+- **TreeView**: Fix `TreeView.NodeCheckboxIndicator` not updating when a node is checked or becomes indeterminate.
+- **TreeView**: Fix `useTreeView` losing the node type, so `selectedNodes`, `expandedNodes` and `focusedNode` are typed
+  as `T` instead of `TreeNode`.
```

**File**: `.changeset/vue-tree-view-types.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+'@ark-ui/vue': patch
+---
+
+- **TreeView**: Fix `TreeView.RootEmits<T>` and `useTreeView` losing the node type, so `selectedNodes`, `expandedNodes`
+  and `focusedNode` are typed as `T` instead of `TreeNode`.
+- **TreeView**: Remove the `fallback` and `indeterminate` props from `TreeView.NodeCheckboxIndicator`. They were never
+  rendered; use the `#fallback` and `#indeterminate` slots instead.
```

**File**: `packages/react/src/components/tree-view/tests/checkbox-indicator.test.tsx` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+import { render, screen } from '@testing-library/react'
+import userEvent from '@testing-library/user-event'
+import { TreeView, createTreeCollection } from '../index.ts'
+
+interface Node {
+  id: string
+  name: string
+  children?: Node[]
+}
+
+const collection = createTreeCollection<Node>({
+  nodeToValue: (node) => node.id,
+  nodeToString: (node) => node.name,
+  rootNode: {
+    id: 'ROOT',
+    name: '',
+    children: [
+      {
+        id: 'src',
+        name: 'src',
+        children: [
+          { id: 'src/a', name: 'a' },
+          { id: 'src/b', name: 'b' },
+        ],
+      },
+    ],
+  },
+})
+
+const NodeCheckbox = (props: { id: string }) => (
+  <TreeView.NodeCheckbox data-testid={`checkbox-${props.id}`}>
+    <TreeView.NodeCheckboxIndicator indeterminate="partial" fallback="empty">
+      checked
+    </TreeView.NodeCheckboxIndicator>
+  </TreeView.NodeCheckbox>
+)
+
+const CheckboxTree = () => (
+  <TreeView.Root collection={collection} defaultExpandedValue={['src']} defaultCheckedValue={[]}>
+    <TreeView.Tree>
+      <TreeView.NodeProvider node={collection.rootNode.children![0]} indexPath={[0]}>
+        <TreeView.Branch>
+          <TreeView.BranchControl>
+            <NodeCheckbox id="src" />
+            <TreeView.BranchText>src</TreeView.BranchText>
+          </TreeView.BranchControl>
+          <TreeView.BranchContent>
+            {collection.rootNode.children![0].children!.map((child, index) => (
+              <TreeView.NodeProvider key={child.id} node={child} indexPath={[0, index]}>
+                <TreeView.Item>
+                  <NodeCheckbox id={child.id} />
+                  <TreeView.ItemText>{child.name}</TreeView.ItemText>
+                </TreeView.Item>
+              </TreeView.NodeProvider>
+            ))}
+          </TreeView.BranchContent>
+        </TreeView.Branch>
+      </TreeView.NodeProvider>
+    </TreeView.Tree>
+  </TreeView.Root>
+)
+
+const indicator = (id: string) => screen.getByTestId(`checkbox-${id}`)
+
+describe('TreeView / NodeCheckboxIndicator', () => {
+  it('should render the fallback when unchecked', () => {
+    render(<CheckboxTree />)
+    expect(indicator('src')).toHaveTextContent('empty')
+    expect(indicator('src/a')).toHaveTextContent('empty')
+  })
+
+  it('should render checked and indeterminate states as nodes are checked', async () => {
+    render(<CheckboxTree />)
+    await userEvent.click(indicator('src/a'))
+    expect(indicator('src/a')).toHaveTextContent('checked')
+    expect(indicator('src/b')).toHaveTextContent('empty')
+    expect(indicator('src')).toHaveTextContent('partial')
+
+    await userEvent.click(indicator('src/b'))
+    expect(indicator('src')).toHaveTextContent('checked')
+  })
+})
```

**File**: `packages/solid/src/components/tree-view/tests/checkbox-indicator.test.tsx` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+import { render, screen } from '@solidjs/testing-library'
+import userEvent from '@testing-library/user-event'
+import { For } from 'solid-js'
+import { TreeView, createTreeCollection } from '../index.tsx'
+
+interface Node {
+  id: string
+  name: string
+  children?: Node[]
+}
+
+const collection = createTreeCollection<Node>({
+  nodeToValue: (node) => node.id,
+  nodeToString: (node) => node.name,
+  rootNode: {
+    id: 'ROOT',
+    name: '',
+    children: [
+      {
+        id: 'src',
+        name: 'src',
+        children: [
+          { id: 'src/a', name: 'a' },
+          { id: 'src/b', name: 'b' },
+        ],
+      },
+    ],
+  },
+})
+
+const NodeCheckbox = (props: { id: string }) => (
+  <TreeView.NodeCheckbox data-testid={`checkbox-${props.id}`}>
+    <TreeView.NodeCheckboxIndicator indeterminate="partial" fallback="empty">
+      checked
+    </TreeView.NodeCheckboxIndicator>
+  </TreeView.NodeCheckbox>
+)
+
+const CheckboxTree = () => (
+  <TreeView.Root collection={collection} defaultExpandedValue={['src']} defaultCheckedValue={[]}>
+    <TreeView.Tree>
+      <TreeView.NodeProvider node={collection.rootNode.children![0]} indexPath={[0]}>
+        <TreeView.Branch>
+          <TreeView.BranchControl>
+            <NodeCheckbox id="src" />
+            <TreeView.BranchText>src</TreeView.BranchText>
+          </TreeView.BranchControl>
+          <TreeView.BranchContent>
+            <For each={collection.rootNode.children![0].children}>
+              {(child, index) => (
+                <TreeView.NodeProvider node={child} indexPath={[0, index()]}>
+                  <TreeView.Item>
+                    <NodeCheckbox id={child.id} />
+                    <TreeView.ItemText>{child.name}</TreeView.ItemText>
+                  </TreeView.Item>
+                </TreeView.NodeProvider>
+              )}
+            </For>
+          </TreeView.BranchContent>
+        </TreeView.Branch>
+      </TreeView.NodeProvider>
+    </TreeView.Tree>
+  </TreeView.Root>
+)
+
+const indicator = (id: string) => screen.getByTestId(`checkbox-${id}`)
+
+describe('TreeView / NodeCheckboxIndicator', () => {
+  it('should render the fallback when unchecked', () => {
+    render(() => <CheckboxTree />)
+    expect(indicator('src')).toHaveTextContent('empty')
+    expect(indicator('src/a')).toHaveTextContent('empty')
+  })
+
+  it('should render checked and indeterminate states as nodes are checked', async () => {
+    render(() => <CheckboxTree />)
+    await userEvent.click(indicator('src/a'))
+    expect(indicator('src/a')).toHaveTextContent('checked')
+    expect(indicator('src/b')).toHaveTextContent('empty')
+    expect(indicator('src')).toHaveTextContent('partial')
+
+    await userEvent.click(indicator('src/b'))
+    expect(indicator('src')).toHaveTextContent('checked')
+  })
+})
```

**File**: `packages/solid/src/components/tree-view/tests/types.test.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import type { UseTreeViewProps } from '../index.tsx'
+
+interface FileNode {
+  id: string
+  name: string
+  size: number
+}
+
+describe('TreeView types', () => {
+  it('should keep the node type in useTreeView callbacks', () => {
+    type Props = UseTreeViewProps<FileNode>
+    type SelectionDetails = Parameters<NonNullable<Props['onSelectionChange']>>[0]
+    type ExpandedDetails = Parameters<NonNullable<Props['onExpandedChange']>>[0]
+    type FocusDetails = Parameters<NonNullable<Props['onFocusChange']>>[0]
+    expectTypeOf<SelectionDetails['selectedNodes']>().toEqualTypeOf<FileNode[]>()
+    expectTypeOf<ExpandedDetails['expandedNodes']>().toEqualTypeOf<FileNode[]>()
+    expectTypeOf<FocusDetails['focusedNode']>().toEqualTypeOf<FileNode | null>()
+  })
+})
```

**File**: `packages/solid/src/components/tree-view/tree-view-node-checkbox-indicator.tsx` (modified, +10/-11)
```diff
@@ -1,4 +1,4 @@
-import { type JSX, createMemo } from 'solid-js'
+import { type JSX, Match, Switch, children } from 'solid-js'
 import { useTreeViewNodeContext } from './use-tree-view-node-context.ts'
 
 export interface TreeViewNodeCheckboxIndicatorBaseProps {
@@ -11,15 +11,14 @@ export interface TreeViewNodeCheckboxIndicatorProps extends TreeViewNodeCheckbox
 export const TreeViewNodeCheckboxIndicator = (props: TreeViewNodeCheckboxIndicatorProps) => {
   const nodeState = useTreeViewNodeContext()
 
-  const checkedState = createMemo(() => nodeState().checked)
+  const checked = children(() => props.children)
+  const indeterminate = children(() => props.indeterminate)
+  const fallback = children(() => props.fallback)
 
-  if (checkedState() === 'indeterminate' && props.indeterminate) {
-    return props.indeterminate
-  }
-
-  if (checkedState() === true && props.children) {
-    return props.children
-  }
-
-  return props.fallback
+  return (
+    <Switch fallback={fallback()}>
+      <Match when={nodeState().checked === 'indeterminate' && indeterminate()}>{indeterminate()}</Match>
+      <Match when={nodeState().checked === true && checked()}>{checked()}</Match>
+    </Switch>
+  )
 }
```

**File**: `packages/solid/src/components/tree-view/use-tree-view.ts` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ import { runIfFn } from '../../utils/run-if-fn.ts'
 import type { TreeCollection, TreeNode } from '../collection/index.tsx'
 
 export interface UseTreeViewProps<T extends TreeNode> extends Optional<
-  Omit<treeView.Props, 'dir' | 'getRootNode' | 'colllection'>,
+  Omit<treeView.Props<T>, 'dir' | 'getRootNode' | 'collection'>,
   'id'
 > {
   /**
```

**File**: `packages/svelte/src/lib/components/tree-view/tests/checkbox-indicator.test.svelte` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+<script lang="ts">
+  import { TreeView, createTreeCollection } from '../index.ts'
+
+  interface Node {
+    id: string
+    name: string
+    children?: Node[]
+  }
+
+  const collection = createTreeCollection<Node>({
+    nodeToValue: (node) => node.id,
+    nodeToString: (node) => node.name,
+    rootNode: {
+      id: 'ROOT',
+      name: '',
+      children: [
+        {
+          id: 'src',
+          name: 'src',
+          children: [
+            { id: 'src/a', name: 'a' },
+            { id: 'src/b', name: 'b' },
+          ],
+        },
+      ],
+    },
+  })
+
+  const branch = collection.rootNode.children![0]
+</script>
+
+{#snippet nodeCheckbox(id: string)}
+  <TreeView.NodeCheckbox data-testid={`checkbox-${id}`}>
+    <TreeView.NodeCheckboxIndicator>
+      checked
+      {#snippet indeterminate()}partial{/snippet}
+      {#snippet fallback()}empty{/snippet}
+    </TreeView.NodeCheckboxIndicator>
+  </TreeView.NodeCheckbox>
+{/snippet}
+
+<TreeView.Root {collection} defaultExpandedValue={['src']} defaultCheckedValue={[]}>
+  <TreeView.Tree>
+    <TreeView.NodeProvider node={branch} indexPath={[0]}>
+      <TreeView.Branch>
+        <TreeView.BranchControl>
+          {@render nodeCheckbox('src')}
+          <TreeView.BranchText>src</TreeView.BranchText>
+        </TreeView.BranchControl>
+        <TreeView.BranchContent>
+          {#each branch.children ?? [] as child, index (child.id)}
+            <TreeView.NodeProvider node={child} indexPath={[0, index]}>
+              <TreeView.Item>
+                {@render nodeCheckbox(child.id)}
+                <TreeView.ItemText>{child.name}</TreeView.ItemText>
+              </TreeView.Item>
+            </TreeView.NodeProvider>
+          {/each}
+        </TreeView.BranchContent>
+      </TreeView.Branch>
+    </TreeView.NodeProvider>
+  </TreeView.Tree>
+</TreeView.Root>
```

---

### Incident Patch 8: `879d449f` (2026-10-02)
**Commit Message**: fix(vue): forward highlight attributes to mark elements

Highlight renders a fragment, so Vue never applied fallthrough attributes.
Disable inheritAttrs and bind them onto each mark, matching the other
frameworks. Adds Highlight tests across all frameworks.

Closes #4155

**File**: `.changeset/vue-highlight-attrs.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@ark-ui/vue': patch
+---
+
+- **Highlight**: Fix `class`, `style` and other attributes not being forwarded to the rendered `<mark>` elements.
```

**File**: `packages/react/src/components/highlight/tests/highlight.test.tsx` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { render } from '@testing-library/react'
+import { Highlight } from '../index.ts'
+
+const text = 'React is great and React is fast'
+
+describe('Highlight', () => {
+  it('should wrap matches in mark elements', () => {
+    const { container } = render(<Highlight text={text} query="React" matchAll />)
+    const marks = container.querySelectorAll('mark')
+    expect(Array.from(marks, (mark) => mark.textContent)).toEqual(['React', 'React'])
+    expect(container).toHaveTextContent(text)
+  })
+
+  it('should forward attributes to every mark', () => {
+    const { container } = render(
+      <Highlight text={text} query="React" matchAll className="custom" title="match" data-testid="mark" />,
+    )
+    const marks = container.querySelectorAll('mark')
+    expect(marks).toHaveLength(2)
+    for (const mark of marks) {
+      expect(mark).toHaveClass('custom')
+      expect(mark).toHaveAttribute('title', 'match')
+      expect(mark).toHaveAttribute('data-testid', 'mark')
+    }
+  })
+
+  it('should respect ignoreCase', () => {
+    const { container } = render(<Highlight text={text} query="react" ignoreCase />)
+    expect(container.querySelector('mark')).toHaveTextContent('React')
+  })
+
+  it('should update when the query changes', () => {
+    const { container, rerender } = render(<Highlight text={text} query="great" />)
+    expect(container.querySelector('mark')).toHaveTextContent('great')
+    rerender(<Highlight text={text} query="fast" />)
+    expect(container.querySelector('mark')).toHaveTextContent('fast')
+  })
+})
```

**File**: `packages/solid/src/components/highlight/tests/highlight.test.tsx` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+import { render } from '@solidjs/testing-library'
+import { createSignal } from 'solid-js'
+import { Highlight } from '../index.tsx'
+
+const text = 'Solid is great and Solid is fast'
+
+describe('Highlight', () => {
+  it('should wrap matches in mark elements', () => {
+    const { container } = render(() => <Highlight text={text} query="Solid" matchAll />)
+    const marks = container.querySelectorAll('mark')
+    expect(Array.from(marks, (mark) => mark.textContent)).toEqual(['Solid', 'Solid'])
+    expect(container).toHaveTextContent(text)
+  })
+
+  it('should forward attributes to every mark', () => {
+    const { container } = render(() => (
+      <Highlight text={text} query="Solid" matchAll class="custom" title="match" data-testid="mark" />
+    ))
+    const marks = container.querySelectorAll('mark')
+    expect(marks).toHaveLength(2)
+    for (const mark of marks) {
+      expect(mark).toHaveClass('custom')
+      expect(mark).toHaveAttribute('title', 'match')
+      expect(mark).toHaveAttribute('data-testid', 'mark')
+    }
+  })
+
+  it('should respect ignoreCase', () => {
+    const { container } = render(() => <Highlight text={text} query="solid" ignoreCase />)
+    expect(container.querySelector('mark')).toHaveTextContent('Solid')
+  })
+
+  it('should update when the query changes', () => {
+    const [query, setQuery] = createSignal('great')
+    const { container } = render(() => <Highlight text={text} query={query()} />)
+    expect(container.querySelector('mark')).toHaveTextContent('great')
+    setQuery('fast')
+    expect(container.querySelector('mark')).toHaveTextContent('fast')
+  })
+})
```

**File**: `packages/svelte/src/lib/components/highlight/tests/highlight.test.ts` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import { render } from '@testing-library/svelte'
+import { describe, expect, it } from 'vitest'
+import Highlight from '../highlight.svelte'
+
+const text = 'Svelte is great and Svelte is fast'
+
+describe('Highlight', () => {
+  it('should wrap matches in mark elements', () => {
+    const { container } = render(Highlight, { props: { text, query: 'Svelte', matchAll: true } })
+    const marks = container.querySelectorAll('mark')
+    expect(Array.from(marks, (mark) => mark.textContent)).toEqual(['Svelte', 'Svelte'])
+    expect(container).toHaveTextContent(text)
+  })
+
+  it('should forward attributes to every mark', () => {
+    const { container } = render(Highlight, {
+      props: { text, query: 'Svelte', matchAll: true, class: 'custom', title: 'match', 'data-testid': 'mark' },
+    })
+    const marks = container.querySelectorAll('mark')
+    expect(marks).toHaveLength(2)
+    for (const mark of marks) {
+      expect(mark).toHaveClass('custom')
+      expect(mark).toHaveAttribute('title', 'match')
+      expect(mark).toHaveAttribute('data-testid', 'mark')
+    }
+  })
+
+  it('should respect ignoreCase', () => {
+    const { container } = render(Highlight, { props: { text, query: 'svelte', ignoreCase: true } })
+    expect(container.querySelector('mark')).toHaveTextContent('Svelte')
+  })
+
+  it('should update when the query changes', async () => {
+    const { container, rerender } = render(Highlight, { props: { text, query: 'great' } })
+    expect(container.querySelector('mark')).toHaveTextContent('great')
+    await rerender({ text, query: 'fast' })
+    expect(container.querySelector('mark')).toHaveTextContent('fast')
+  })
+})
```

**File**: `packages/vue/src/components/highlight/highlight.vue` (modified, +3/-1)
```diff
@@ -16,6 +16,8 @@ export interface HighlightProps
 <script lang="ts" setup>
 import { useHighlight } from './use-highlight.ts'
 
+defineOptions({ inheritAttrs: false })
+
 const props = withDefaults(defineProps<HighlightProps>(), {
   ignoreCase: undefined,
   matchAll: undefined,
@@ -31,7 +33,7 @@ const chunks = useHighlight(props)
 
 <template>
   <template v-for="chunk in chunks">
-    <mark v-if="chunk.match">{{ chunk.text }}</mark>
+    <mark v-if="chunk.match" v-bind="$attrs">{{ chunk.text }}</mark>
     <template v-else>
       {{ chunk.text }}
     </template>
```

**File**: `packages/vue/src/components/highlight/tests/highlight.test.ts` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import { render } from '@testing-library/vue'
+import { Highlight } from '../index.ts'
+
+const text = 'Vue is great and Vue is fast'
+
+describe('Highlight', () => {
+  it('should wrap matches in mark elements', () => {
+    const { container } = render(Highlight, { props: { text, query: 'Vue', matchAll: true } })
+    const marks = container.querySelectorAll('mark')
+    expect(Array.from(marks, (mark) => mark.textContent)).toEqual(['Vue', 'Vue'])
+    expect(container).toHaveTextContent(text)
+  })
+
+  it('should forward attributes to every mark', () => {
+    const { container } = render(Highlight, {
+      props: { text, query: 'Vue', matchAll: true },
+      attrs: { class: 'custom', title: 'match', 'data-testid': 'mark' },
+    })
+    const marks = container.querySelectorAll('mark')
+    expect(marks).toHaveLength(2)
+    for (const mark of marks) {
+      expect(mark).toHaveClass('custom')
+      expect(mark).toHaveAttribute('title', 'match')
+      expect(mark).toHaveAttribute('data-testid', 'mark')
+    }
+  })
+
+  it('should respect ignoreCase', () => {
+    const { container } = render(Highlight, { props: { text, query: 'vue', ignoreCase: true } })
+    expect(container.querySelector('mark')).toHaveTextContent('Vue')
+  })
+
+  it('should update when the query changes', async () => {
+    const { container, rerender } = render(Highlight, { props: { text, query: 'great' } })
+    expect(container.querySelector('mark')).toHaveTextContent('great')
+    await rerender({ text, query: 'fast' })
+    expect(container.querySelector('mark')).toHaveTextContent('fast')
+  })
+})
```

---

### Incident Patch 9: `aec33c37` (2026-10-02)
**Commit Message**: fix(json-tree-view): sync controlled values and data changes in vue and svelte

Vue dropped v-model listeners because the root declared the model props but
no emits, and read props once at setup. Svelte didn't declare the tree values
as bindable and nodes read their props once. useJsonTreeView in both ignored
data changes. Adds JsonTreeView tests across all frameworks.

Closes #4153

**File**: `.changeset/svelte-json-tree-view-reactivity.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@ark-ui/svelte': patch
+---
+
+- **JsonTreeView**: Fix `bind:expandedValue`, `bind:selectedValue`, `bind:checkedValue` and `bind:focusedValue` not
+  syncing, and the tree not re-rendering when `data` changes. `useJsonTreeView` now also reacts to `data` changes.
```

**File**: `.changeset/vue-json-tree-view-reactivity.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+'@ark-ui/vue': patch
+---
+
+- **JsonTreeView**: Fix `v-model:expanded-value`, `v-model:selected-value`, `v-model:checked-value` and
+  `v-model:focused-value` not updating, and the tree not re-rendering when `data` changes. `useJsonTreeView` now also
+  reacts to `data` changes.
```

**File**: `packages/react/src/components/json-tree-view/tests/json-tree-view.test.tsx` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+import { render, screen, waitFor } from '@testing-library/react'
+import userEvent from '@testing-library/user-event'
+import { useState } from 'react'
+import { JsonTreeView, useJsonTreeView } from '../index.ts'
+
+const getBranch = (index: number) => document.querySelectorAll<HTMLElement>('[data-part="branch"]')[index]
+const getBranchControl = (index: number) => getBranch(index).querySelector<HTMLElement>('[data-part="branch-control"]')!
+
+const Basic = (props: Omit<JsonTreeView.RootProps, 'children'>) => (
+  <JsonTreeView.Root {...props}>
+    <JsonTreeView.Tree />
+  </JsonTreeView.Root>
+)
+
+const Controlled = (props: { data: object }) => {
+  const [data, setData] = useState(props.data)
+  const [expandedValue, setExpandedValue] = useState<string[]>([])
+  const [selectedValue, setSelectedValue] = useState<string[]>([])
+  return (
+    <>
+      <JsonTreeView.Root
+        data={data}
+        expandedValue={expandedValue}
+        onExpandedChange={(details) => setExpandedValue(details.expandedValue)}
+        selectedValue={selectedValue}
+        onSelectionChange={(details) => setSelectedValue(details.selectedValue)}
+      >
+        <JsonTreeView.Tree />
+      </JsonTreeView.Root>
+      <output data-testid="expanded">{expandedValue.length}</output>
+      <output data-testid="selected">{selectedValue.length}</output>
+      <button type="button" onClick={() => setExpandedValue([])}>
+        collapse
+      </button>
+      <button type="button" onClick={() => setData({ replaced: true })}>
+        replace
+      </button>
+    </>
+  )
+}
+
+const RootProvider = () => {
+  const [data, setData] = useState<object>({ original: 1 })
+  const jsonTreeView = useJsonTreeView({ data })
+  return (
+    <>
+      <JsonTreeView.RootProvider value={jsonTreeView}>
+        <JsonTreeView.Tree />
+      </JsonTreeView.RootProvider>
+      <button type="button" onClick={() => setData({ replaced: true })}>
+        replace
+      </button>
+    </>
+  )
+}
+
+describe('JsonTreeView', () => {
+  it('should render the data', () => {
+    render(<Basic data={{ name: 'ark' }} />)
+    expect(screen.getByRole('tree')).toHaveTextContent('name')
+  })
+
+  it('should expand a branch on click', async () => {
+    render(<Basic data={{ user: { name: 'ark' } }} />)
+    expect(getBranch(0)).toHaveAttribute('aria-expanded', 'false')
+    await userEvent.click(getBranchControl(0))
+    expect(getBranch(0)).toHaveAttribute('aria-expanded', 'true')
+  })
+
+  it('should expand branches up to defaultExpandedDepth', () => {
+    render(<Basic data={{ user: { name: 'ark' } }} defaultExpandedDepth={1} />)
+    expect(getBranch(0)).toHaveAttribute('aria-expanded', 'true')
+    expect(getBranch(1)).toHaveAttribute('aria-expanded', 'false')
+  })
+
+  it('should sync controlled expandedValue in both directions', async () => {
+    render(<Controlled data={{ user: { name: 'ark' } }} />)
+    await userEvent.click(getBranchControl(0))
+    expect(screen.getByTestId('expanded')).toHaveTextContent('1')
+    expect(getBranch(0)).toHaveAttribute('aria-expanded', 'true')
+
+    await userEvent.click(screen.getByRole('button', { name: 'collapse' }))
+    await waitFor(() => expect(getBranch(0)).toHaveAttribute('aria-expanded', 'false'))
+  })
+
+  it('should sync controlled selectedValue', async () => {
+    render(<Controlled data={{ user: { name: 'ark' } }} />)
+    await userEvent.click(getBranchControl(0))
+    expect(screen.getByTestId('selected')).toHaveTextContent('1')
+  })
+
+  it('should update when data changes', async () => {
+    render(<Controlled data={{ original: 1 }} />)
+    expect(screen.getByRole('tree')).toHaveTextContent('original')
+    await userEvent.click(screen.getByRole('button', { name: 'replace' }))
+    await waitFor(() => expect(screen.getByRole('tree')).toHaveTextContent('replaced'))
+    expect(screen.getByRole('tree')).not.toHaveTextContent('original')
+  })
+
+  it('should update useJsonTreeView when data changes', async () => {
+    render(<RootProvider />)
+    expect(screen.getByRole('tree')).toHaveTextContent('original')
+    await userEvent.click(screen.getByRole('button', { name: 'replace' }))
+    await waitFor(() => expect(screen.getByRole('tree')).toHaveTextContent('replaced'))
+  })
+})
```

**File**: `packages/solid/src/components/json-tree-view/tests/json-tree-view.test.tsx` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+import { render, screen, waitFor } from '@solidjs/testing-library'
+import userEvent from '@testing-library/user-event'
+import { createSignal } from 'solid-js'
+import { JsonTreeView, useJsonTreeView } from '../index.tsx'
+
+const getBranch = (index: number) => document.querySelectorAll<HTMLElement>('[data-part="branch"]')[index]
+const getBranchControl = (index: number) => getBranch(index).querySelector<HTMLElement>('[data-part="branch-control"]')!
+
+const Basic = (props: Omit<JsonTreeView.RootProps, 'children'>) => (
+  <JsonTreeView.Root {...props}>
+    <JsonTreeView.Tree />
+  </JsonTreeView.Root>
+)
+
+const Controlled = (props: { data: object }) => {
+  const [data, setData] = createSignal<object>(props.data)
+  const [expandedValue, setExpandedValue] = createSignal<string[]>([])
+  const [selectedValue, setSelectedValue] = createSignal<string[]>([])
+  return (
+    <>
+      <JsonTreeView.Root
+        data={data()}
+        expandedValue={expandedValue()}
+        onExpandedChange={(details) => setExpandedValue(details.expandedValue)}
+        selectedValue={selectedValue()}
+        onSelectionChange={(details) => setSelectedValue(details.selectedValue)}
+      >
+        <JsonTreeView.Tree />
+      </JsonTreeView.Root>
+      <output data-testid="expanded">{expandedValue().length}</output>
+      <output data-testid="selected">{selectedValue().length}</output>
+      <button type="button" onClick={() => setExpandedValue([])}>
+        collapse
+      </button>
+      <button type="button" onClick={() => setData({ replaced: true })}>
+        replace
+      </button>
+    </>
+  )
+}
+
+const RootProvider = () => {
+  const [data, setData] = createSignal<object>({ original: 1 })
+  const jsonTreeView = useJsonTreeView({
+    get data() {
+      return data()
+    },
+  })
+  return (
+    <>
+      <JsonTreeView.RootProvider value={jsonTreeView}>
+        <JsonTreeView.Tree />
+      </JsonTreeView.RootProvider>
+      <button type="button" onClick={() => setData({ replaced: true })}>
+        replace
+      </button>
+    </>
+  )
+}
+
+describe('JsonTreeView', () => {
+  it('should render the data', () => {
+    render(() => <Basic data={{ name: 'ark' }} />)
+    expect(screen.getByRole('tree')).toHaveTextContent('name')
+  })
+
+  it('should expand a branch on click', async () => {
+    render(() => <Basic data={{ user: { name: 'ark' } }} />)
+    expect(getBranch(0)).toHaveAttribute('aria-expanded', 'false')
+    await userEvent.click(getBranchControl(0))
+    expect(getBranch(0)).toHaveAttribute('aria-expanded', 'true')
+  })
+
+  it('should expand branches up to defaultExpandedDepth', () => {
+    render(() => <Basic data={{ user: { name: 'ark' } }} defaultExpandedDepth={1} />)
+    expect(getBranch(0)).toHaveAttribute('aria-expanded', 'true')
+    expect(getBranch(1)).toHaveAttribute('aria-expanded', 'false')
+  })
+
+  it('should sync controlled expandedValue in both directions', async () => {
+    render(() => <Controlled data={{ user: { name: 'ark' } }} />)
+    await userEvent.click(getBranchControl(0))
+    expect(screen.getByTestId('expanded')).toHaveTextContent('1')
+    expect(getBranch(0)).toHaveAttribute('aria-expanded', 'true')
+
+    await userEvent.click(screen.getByRole('button', { name: 'collapse' }))
+    await waitFor(() => expect(getBranch(0)).toHaveAttribute('aria-expanded', 'false'))
+  })
+
+  it('should sync controlled selectedValue', async () => {
+    render(() => <Controlled data={{ user: { name: 'ark' } }} />)
+    await userEvent.click(getBranchControl(0))
+    expect(screen.getByTestId('selected')).toHaveTextContent('1')
+  })
+
+  it('should update when data changes', async () => {
+    render(() => <Controlled data={{ original: 1 }} />)
+    expect(screen.getByRole('tree')).toHaveTextContent('original')
+    await userEvent.click(screen.getByRole('button', { name: 'replace' }))
+    await waitFor(() => expect(screen.getByRole('tree')).toHaveTextContent('replaced'))
+    expect(screen.getByRole('tree')).not.toHaveTextContent('original')
+  })
+
+  it('should update useJsonTreeView when data changes', async () => {
+    render(() => <RootProvider />)
+    expect(screen.getByRole('tree')).toHaveTextContent('original')
+    await userEvent.click(screen.getByRole('button', { name: 'replace' }))
+    await waitFor(() => expect(screen.getByRole('tree')).toHaveTextContent('replaced'))
+  })
+})
```

**File**: `packages/svelte/src/lib/components/json-tree-view/json-tree-view-node.svelte` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@
 
   const props: JsonTreeViewNodeProps = $props()
 
-  const { node, indexPath, arrow, indentGuide, renderValue } = props
+  const { node, indexPath, arrow, indentGuide, renderValue } = $derived(props)
 
   const options = useJsonTreeViewPropsContext()
 
```

**File**: `packages/svelte/src/lib/components/json-tree-view/json-tree-view-root.svelte` (modified, +19/-2)
```diff
@@ -19,7 +19,15 @@
   export interface JsonTreeViewRootProps
     extends Omit<TreeViewRootProps<JsonNode>, 'collection'>, JsonTreeViewRootBaseProps {}
 
-  const { data, defaultExpandedDepth, ...props }: JsonTreeViewRootProps = $props()
+  let {
+    data,
+    defaultExpandedDepth,
+    expandedValue = $bindable<string[]>(),
+    selectedValue = $bindable<string[]>(),
+    focusedValue = $bindable<string>(),
+    checkedValue = $bindable<string[]>(),
+    ...props
+  }: JsonTreeViewRootProps = $props()
 
   const splitJsonTreeViewProps = createSplitProps<JsonTreeViewOptions>()
 
@@ -48,6 +56,15 @@
   JsonTreeViewPropsProvider(() => jsonTreeProps)
 </script>
 
-<TreeView.Root data-scope="json-tree-view" {collection} {defaultExpandedValue} {...localProps}>
+<TreeView.Root
+  data-scope="json-tree-view"
+  {collection}
+  {defaultExpandedValue}
+  bind:expandedValue
+  bind:selectedValue
+  bind:focusedValue
+  bind:checkedValue
+  {...localProps}
+>
   {@render props.children?.()}
 </TreeView.Root>
```

**File**: `packages/svelte/src/lib/components/json-tree-view/tests/json-tree-view-basic.test.svelte` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+<script lang="ts">
+  import { JsonTreeView, type JsonTreeViewRootProps } from '../index.ts'
+
+  const props: Omit<JsonTreeViewRootProps, 'children'> = $props()
+</script>
+
+<JsonTreeView.Root {...props}>
+  <JsonTreeView.Tree />
+</JsonTreeView.Root>
```

**File**: `packages/svelte/src/lib/components/json-tree-view/tests/json-tree-view-controlled.test.svelte` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+<script lang="ts">
+  import { JsonTreeView } from '../index.ts'
+
+  const props: { data: object } = $props()
+
+  let data = $state(props.data)
+  let expandedValue = $state<string[]>([])
+  let selectedValue = $state<string[]>([])
+</script>
+
+<JsonTreeView.Root {data} bind:expandedValue bind:selectedValue>
+  <JsonTreeView.Tree />
+</JsonTreeView.Root>
+<output data-testid="expanded">{expandedValue.length}</output>
+<output data-testid="selected">{selectedValue.length}</output>
+<button type="button" onclick={() => (expandedValue = [])}>collapse</button>
+<button type="button" onclick={() => (data = { replaced: true })}>replace</button>
```

---

### Incident Patch 10: `51c4ba0a` (2026-10-02)
**Commit Message**: fix(field): link error text via aria-describedby instead of aria-errormessage

VoiceOver on macOS and Narrator don't announce aria-errormessage, so field
errors were silent for those users. This also restores the error announcement
for inputs that read the field context (checkbox, select, etc.).

Closes #4150

**File**: `.changeset/field-error-text-describedby.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+---
+'@ark-ui/react': patch
+'@ark-ui/solid': patch
+'@ark-ui/vue': patch
+'@ark-ui/svelte': patch
+---
+
+- **Field**: Fix `Field.ErrorText` not being announced by VoiceOver and Narrator. It is now linked via `aria-describedby`
+  instead of `aria-errormessage`, since screen reader support for `aria-errormessage` is still incomplete.
+
+  ```diff
+  - expect(input).toHaveAccessibleErrorMessage('Error Info')
+  + expect(input).toHaveAccessibleDescription(expect.stringContaining('Error Info'))
+  ```
```

**File**: `packages/react/src/components/field/field.test.tsx` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ describe('Field / Input', () => {
   it('should display error text when error is present', async () => {
     render(<ComponentUnderTest invalid />)
     expect(screen.getByText('Error Info')).toBeInTheDocument()
-    expect(screen.getByRole('textbox')).toHaveAccessibleErrorMessage('Error Info')
+    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(expect.stringContaining('Error Info'))
   })
 
   it('should focus on input when label is clicked', async () => {
```

**File**: `packages/react/src/components/field/use-field.ts` (modified, +5/-4)
```diff
@@ -124,12 +124,13 @@ export const useField = (props: UseFieldProps = {}) => {
   )
 
   const errorMessageId = hasErrorText && invalid ? errorTextId : undefined
+  const describedById =
+    [errorMessageId, hasHelperText ? helperTextId : undefined].filter(Boolean).join(' ') || undefined
 
   const getControlProps = useMemo(
     () => () =>
       ({
-        'aria-describedby': hasHelperText ? helperTextId : undefined,
-        'aria-errormessage': errorMessageId,
+        'aria-describedby': describedById,
         'aria-invalid': ariaAttr(invalid),
         'data-invalid': dataAttr(invalid),
         'data-required': dataAttr(required),
@@ -139,7 +140,7 @@ export const useField = (props: UseFieldProps = {}) => {
         disabled,
         readOnly,
       }) as HTMLProps<'input'>,
-    [hasHelperText, helperTextId, invalid, required, readOnly, id, errorMessageId, disabled],
+    [describedById, invalid, required, readOnly, id, disabled],
   )
 
   const getInputProps = useMemo(
@@ -199,7 +200,7 @@ export const useField = (props: UseFieldProps = {}) => {
   )
 
   return {
-    ariaDescribedby: hasHelperText ? helperTextId : undefined,
+    ariaDescribedby: describedById,
     ids: {
       root: rootId,
       control: id,
```

**File**: `packages/solid/src/components/field/field.test.tsx` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ describe('Field / Input', () => {
   it('should display error text when error is present', async () => {
     render(() => <ComponentUnderTest invalid />)
     expect(screen.getByText('Error Info')).toBeInTheDocument()
-    expect(screen.getByRole('textbox')).toHaveAccessibleErrorMessage('Error Info')
+    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(expect.stringContaining('Error Info'))
   })
 
   it('should focus on input when label is clicked', async () => {
```

**File**: `packages/solid/src/components/field/use-field.ts` (modified, +5/-3)
```diff
@@ -108,10 +108,12 @@ export const useField = (props?: MaybeAccessor<UseFieldProps>) => {
   })
 
   const errorMessageId = createMemo(() => (hasErrorText() && fieldProps.invalid ? errorTextId : undefined))
+  const describedById = createMemo(
+    () => [errorMessageId(), hasHelperText() ? helperTextId : undefined].filter(Boolean).join(' ') || undefined,
+  )
 
   const getControlProps = () => ({
-    'aria-describedby': hasHelperText() ? helperTextId : undefined,
-    'aria-errormessage': errorMessageId(),
+    'aria-describedby': describedById(),
     'aria-invalid': ariaAttr(fieldProps.invalid),
     'data-invalid': dataAttr(fieldProps.invalid),
     'data-required': dataAttr(fieldProps.required),
@@ -155,7 +157,7 @@ export const useField = (props?: MaybeAccessor<UseFieldProps>) => {
   })
 
   return createMemo(() => ({
-    ariaDescribedby: hasHelperText() ? helperTextId : undefined,
+    ariaDescribedby: describedById(),
     ids: {
       control: id,
       label: labelId,
```

**File**: `packages/svelte/src/lib/components/field/tests/field-item.test.ts` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ describe('Field / Item', () => {
     expect(screen.getByTestId('amount-input')).toHaveAttribute('aria-invalid', 'true')
     expect(screen.getByTestId('amount-input')).toHaveAttribute('data-invalid')
     expect(screen.getByText('Invalid amount')).toBeInTheDocument()
-    expect(screen.getByTestId('amount-input')).toHaveAccessibleErrorMessage('Invalid amount')
+    expect(screen.getByTestId('amount-input')).toHaveAccessibleDescription(expect.stringContaining('Invalid amount'))
   })
 
   it('should throw when Field.Item is used outside Field.Root', () => {
```

**File**: `packages/svelte/src/lib/components/field/use-field.svelte.ts` (modified, +5/-3)
```diff
@@ -99,6 +99,9 @@ export const useField = (inProps: MaybeFunction<UseFieldProps> = {}) => {
   })
 
   const errorMessageId = $derived(hasErrorText && invalid ? errorTextId : undefined)
+  const describedById = $derived(
+    [errorMessageId, hasHelperText ? helperTextId : undefined].filter(Boolean).join(' ') || undefined,
+  )
 
   const getRootProps = () =>
     ({
@@ -125,8 +128,7 @@ export const useField = (inProps: MaybeFunction<UseFieldProps> = {}) => {
 
   const getControlProps = () =>
     ({
-      'aria-describedby': hasHelperText ? helperTextId : undefined,
-      'aria-errormessage': errorMessageId,
+      'aria-describedby': describedById,
       'aria-invalid': ariaAttr(invalid),
       'data-invalid': dataAttr(invalid),
       'data-required': dataAttr(required),
@@ -177,7 +179,7 @@ export const useField = (inProps: MaybeFunction<UseFieldProps> = {}) => {
 
   const api = $derived({
     setRootRef,
-    ariaDescribedby: hasHelperText ? helperTextId : undefined,
+    ariaDescribedby: describedById,
     ids: {
       root: rootId,
       control: controlId,
```

**File**: `packages/vue/src/components/field/tests/field.test.tsx` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ describe('Field', () => {
     render(ComponentUnderTest, { props: { invalid: true } })
     await nextTick()
     expect(screen.getByText('Error Info')).toBeInTheDocument()
-    expect(screen.getByRole('textbox')).toHaveAccessibleErrorMessage('Error Info')
+    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(expect.stringContaining('Error Info'))
   })
 
   it('should focus on input when label is clicked', async () => {
```

---

### Incident Patch 11: `5546e9d9` (2026-10-01)
**Commit Message**: fix(svelte): accept a render snippet on every Context component (#4147)

Avatar, Progress, QrCode and Timer took api, and Dialog, Drawer, Marquee
and RadioGroup took children, where the other 55 take render. The eight
now take render and keep their old names as deprecated aliases.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.changeset/svelte-context-render-snippet.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+'@ark-ui/svelte': patch
+---
+
+Accept a `render` snippet on every `Context` component. 55 of the 63 take `render`; `Avatar`, `Progress`, `QrCode` and
+`Timer` took `api`, and `Dialog`, `Drawer`, `Marquee` and `RadioGroup` took `children`. Those eight now take `render`
+too, and keep `api` / `children` as deprecated aliases, so existing code keeps working.
```

**File**: `packages/svelte/src/lib/components/avatar/avatar-context.svelte` (modified, +6/-2)
```diff
@@ -3,15 +3,19 @@
   import type { UseAvatarContext } from './use-avatar-context.ts'
 
   export interface AvatarContextProps {
+    render?: Snippet<[UseAvatarContext]>
+    /**
+     * @deprecated Use `render` instead.
+     */
     api?: Snippet<[UseAvatarContext]>
   }
 </script>
 
 <script lang="ts">
   import { useAvatarContext } from './use-avatar-context.ts'
 
-  const { api }: AvatarContextProps = $props()
+  const { render, api }: AvatarContextProps = $props()
   const avatar = useAvatarContext()
 </script>
 
-{@render api?.(avatar)}
+{@render (render ?? api)?.(avatar)}
```

**File**: `packages/svelte/src/lib/components/avatar/avatar.test.ts` (modified, +12/-0)
```diff
@@ -1,10 +1,22 @@
 import { render, screen } from '@testing-library/svelte'
 import { describe, expect, it } from 'vitest'
 import ComponentUnderTest from './examples/basic.svelte'
+import ContextComponent from './examples/context.svelte'
+import DeprecatedApiComponent from './tests/context-deprecated-api.test.svelte'
 
 describe('Avatar', async () => {
   it("should render the user's initials", async () => {
     render(ComponentUnderTest)
     expect(screen.getByText('PA')).toBeInTheDocument()
   })
+
+  it('should render the context through the render snippet', async () => {
+    render(ContextComponent)
+    expect(screen.getByText('Loading')).toBeInTheDocument()
+  })
+
+  it('should still render the context through the deprecated api snippet', async () => {
+    render(DeprecatedApiComponent)
+    expect(screen.getByText('Loading')).toBeInTheDocument()
+  })
 })
```

**File**: `packages/svelte/src/lib/components/avatar/examples/context.svelte` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 
 <Avatar.Root class={styles.Root}>
   <Avatar.Context>
-    {#snippet api(avatar)}
+    {#snippet render(avatar)}
       <Avatar.Fallback class={styles.Fallback}>
         {#if avatar().loaded}
           <p>PA</p>
```

**File**: `packages/svelte/src/lib/components/avatar/tests/context-deprecated-api.test.svelte` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+<script lang="ts">
+  import { Avatar } from '@ark-ui/svelte/avatar'
+</script>
+
+<Avatar.Root>
+  <Avatar.Context>
+    {#snippet api(avatar)}
+      <span>{avatar().loaded ? 'Loaded' : 'Loading'}</span>
+    {/snippet}
+  </Avatar.Context>
+</Avatar.Root>
```

**File**: `packages/svelte/src/lib/components/dialog/dialog-context.svelte` (modified, +7/-3)
```diff
@@ -3,16 +3,20 @@
   import type { UseDialogContext } from './use-dialog-context.ts'
 
   export interface DialogContextProps {
-    children: Snippet<[UseDialogContext]>
+    render?: Snippet<[UseDialogContext]>
+    /**
+     * @deprecated Use `render` instead.
+     */
+    children?: Snippet<[UseDialogContext]>
   }
 </script>
 
 <script lang="ts">
   import { useDialogContext } from './use-dialog-context.ts'
 
-  const { children }: DialogContextProps = $props()
+  const { render, children }: DialogContextProps = $props()
 
   const dialog = useDialogContext()
 </script>
 
-{@render children(dialog)}
+{@render (render ?? children)?.(dialog)}
```

**File**: `packages/svelte/src/lib/components/dialog/examples/context.svelte` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
         <Dialog.Title class={styles.Title}>Status</Dialog.Title>
         <Dialog.Description class={styles.Description}>
           <Dialog.Context>
-            {#snippet children(dialog)}
+            {#snippet render(dialog)}
               <span>Dialog is {dialog().open ? 'open' : 'closed'}</span>
             {/snippet}
           </Dialog.Context>
```

**File**: `packages/svelte/src/lib/components/drawer/drawer-context.svelte` (modified, +7/-3)
```diff
@@ -3,16 +3,20 @@
   import type { UseDrawerContext } from './use-drawer-context.ts'
 
   export interface DrawerContextProps {
-    children: Snippet<[UseDrawerContext]>
+    render?: Snippet<[UseDrawerContext]>
+    /**
+     * @deprecated Use `render` instead.
+     */
+    children?: Snippet<[UseDrawerContext]>
   }
 </script>
 
 <script lang="ts">
   import { useDrawerContext } from './use-drawer-context.ts'
 
-  const { children }: DrawerContextProps = $props()
+  const { render, children }: DrawerContextProps = $props()
 
   const drawer = useDrawerContext()
 </script>
 
-{@render children(drawer)}
+{@render (render ?? children)?.(drawer)}
```

---

### Incident Patch 12: `420edd21` (2026-09-30)
**Commit Message**: fix(vue): emit value changes from Progress and QrCode roots (#4142)

Closes #4133
Closes #4141

**File**: `.changeset/fix-vue-progress-qr-code-emits.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+'@ark-ui/vue': patch
+---
+
+- **Progress, QrCode**: Fix `Root` not emitting `valueChange` and `update:modelValue`, so `v-model` stayed stale after
+  `setValue()` from context.
+- **QrCode**: Fix `QrCode.Context` being undefined because it was exported under the wrong name.
```

**File**: `packages/vue/src/components/progress/progress-root.vue` (modified, +2/-1)
```diff
@@ -21,7 +21,8 @@ import { useProgress } from './use-progress.ts'
 import { ProgressProvider } from './use-progress-context.ts'
 
 const props = defineProps<ProgressRootProps>()
-const progress = useProgress(props)
+const emits = defineEmits<ProgressRootEmits>()
+const progress = useProgress(props, emits)
 
 ProgressProvider(progress)
 useForwardExpose()
```

**File**: `packages/vue/src/components/progress/tests/progress.test.ts` (modified, +10/-0)
```diff
@@ -1,4 +1,5 @@
 import { render, screen } from '@testing-library/vue'
+import user from '@testing-library/user-event'
 import { axe } from 'vitest-axe'
 import ComponentUnderTest from './progress.test.vue'
 
@@ -30,4 +31,13 @@ describe('Progress', () => {
 
     screen.getByText('100%')
   })
+
+  it('should emit value changes from context setValue', async () => {
+    const { emitted } = render(ComponentUnderTest)
+
+    await user.click(screen.getByRole('button', { name: 'Set value' }))
+
+    expect(emitted('valueChange')).toEqual([[{ value: 80 }]])
+    expect(emitted('update:modelValue')).toEqual([[80]])
+  })
 })
```

**File**: `packages/vue/src/components/progress/tests/progress.test.vue` (modified, +3/-0)
```diff
@@ -19,5 +19,8 @@ const localProps = useForwardPropsEmits(props, emits)
       <Progress.CircleTrack />
       <Progress.CircleRange />
     </Progress.Circle>
+    <Progress.Context v-slot="api">
+      <button @click="api.setValue(80)">Set value</button>
+    </Progress.Context>
   </Progress.Root>
 </template>
```

**File**: `packages/vue/src/components/qr-code/qr-code-root.vue` (modified, +2/-1)
```diff
@@ -21,7 +21,8 @@ import { QrCodeProvider } from './use-qr-code-context.ts'
 import { useForwardExpose } from '../../utils/use-forward-expose.ts'
 
 const props = defineProps<QrCodeRootProps>()
-const qrCode = useQrCode(props)
+const emits = defineEmits<QrCodeRootEmits>()
+const qrCode = useQrCode(props, emits)
 
 QrCodeProvider(qrCode)
 
```

**File**: `packages/vue/src/components/qr-code/qr-code.ts` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 export type { QrCodeGenerateOptions as GenerateOptions, QrCodeGenerateResult as GenerateResult } from '@zag-js/qr-code'
-export { default, type QrCodeContextProps } from './qr-code-context.vue'
+export { default as Context, type QrCodeContextProps as ContextProps } from './qr-code-context.vue'
 export {
   default as DownloadTrigger,
   type QrCodeDownloadTriggerBaseProps as DownloadTriggerBaseProps,
```

**File**: `packages/vue/src/components/qr-code/tests/basic.vue` (modified, +3/-0)
```diff
@@ -16,5 +16,8 @@ const localProps = useForwardPropsEmits(props, emits)
       <img src="https://ark-ui.com/icon-192.png" alt="" />
     </QrCode.Overlay>
     <QrCode.DownloadTrigger fileName="qr-code.png" mimeType="image/png">Download</QrCode.DownloadTrigger>
+    <QrCode.Context v-slot="api">
+      <button @click="api.setValue('https://example.com')">Set value</button>
+    </QrCode.Context>
   </QrCode.Root>
 </template>
```

**File**: `packages/vue/src/components/qr-code/tests/qr-code.test.ts` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+import { render, screen } from '@testing-library/vue'
+import user from '@testing-library/user-event'
+import ComponentUnderTest from './basic.vue'
+
+describe('QrCode', () => {
+  it('should emit value changes from context setValue', async () => {
+    const { emitted } = render(ComponentUnderTest)
+
+    await user.click(screen.getByRole('button', { name: 'Set value' }))
+
+    expect(emitted('valueChange')).toEqual([[{ value: 'https://example.com' }]])
+    expect(emitted('update:modelValue')).toEqual([['https://example.com']])
+  })
+})
```

---

### Incident Patch 13: `c1062eba` (2026-09-29)
**Commit Message**: fix: render default value in value text parts across frameworks (#4130)

NumberInput.ValueText rendered empty without a default slot in Vue and
without children in Solid. AngleSlider.ValueText had the same gap in
Svelte. Solid Select.ValueText ignored custom children.

Closes #4125

**File**: `.changeset/solid-value-text-fallbacks.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+'@ark-ui/solid': patch
+---
+
+- **NumberInput**: Fix `NumberInput.ValueText` rendering empty when used without children. It now displays the current
+  value.
+- **Select**: Fix `Select.ValueText` ignoring custom children.
```

**File**: `.changeset/svelte-angle-slider-value-text.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@ark-ui/svelte': patch
+---
+
+- **AngleSlider**: Fix `AngleSlider.ValueText` rendering empty when used without children. It now displays the current
+  value in degrees.
```

**File**: `.changeset/vue-number-input-value-text.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@ark-ui/vue': patch
+---
+
+- **NumberInput**: Fix `NumberInput.ValueText` rendering empty when used without a default slot. It now displays the
+  current value.
```

**File**: `packages/solid/src/components/number-input/number-input-value-text.tsx` (modified, +1/-1)
```diff
@@ -9,5 +9,5 @@ export const NumberInputValueText = (props: NumberInputValueTextProps) => {
   const numberInput = useNumberInputContext()
   const mergedProps = mergeProps(() => numberInput().getValueTextProps(), props)
 
-  return <ark.span {...mergedProps} />
+  return <ark.span {...mergedProps}>{props.children || numberInput().value}</ark.span>
 }
```

**File**: `packages/solid/src/components/number-input/tests/number-input.test.tsx` (modified, +5/-0)
```diff
@@ -149,4 +149,9 @@ describe('NumberInput / Field', () => {
       expect(input).toHaveValue('5.5')
     })
   })
+
+  it('should render the value in value text without children', async () => {
+    const { container } = render(() => <ComponentUnderTest defaultValue="42" />)
+    expect(container.querySelector('[data-part="value-text"]')).toHaveTextContent('42')
+  })
 })
```

**File**: `packages/solid/src/components/select/select-value-text.tsx` (modified, +1/-1)
```diff
@@ -14,5 +14,5 @@ export const SelectValueText = (props: SelectValueTextProps) => {
   const select = useSelectContext()
   const mergedProps = mergeProps(() => select().getValueTextProps(), props)
 
-  return <ark.span {...mergedProps}>{select().valueAsString || props.placeholder}</ark.span>
+  return <ark.span {...mergedProps}>{props.children || select().valueAsString || props.placeholder}</ark.span>
 }
```

**File**: `packages/solid/src/components/select/tests/select.test.tsx` (modified, +11/-0)
```diff
@@ -1,5 +1,6 @@
 import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
 import user from '@testing-library/user-event'
+import { Select, createListCollection } from '@ark-ui/solid/select'
 import { ComponentUnderTest } from './basic.tsx'
 import { SelectWithField } from './field.tsx'
 
@@ -124,4 +125,14 @@ describe('Select / Field', () => {
     render(() => <SelectWithField />)
     expect(screen.queryByText('Error Info')).not.toBeInTheDocument()
   })
+
+  it('should render custom children in value text', async () => {
+    const collection = createListCollection({ items: ['React', 'Solid'] })
+    render(() => (
+      <Select.Root collection={collection}>
+        <Select.ValueText placeholder="Pick one">Custom</Select.ValueText>
+      </Select.Root>
+    ))
+    expect(screen.getByText('Custom')).toBeInTheDocument()
+  })
 })
```

**File**: `packages/svelte/src/lib/components/angle-slider/angle-slider-value-text.svelte` (modified, +8/-2)
```diff
@@ -10,9 +10,15 @@
   import { Ark } from '../factory/index.ts'
   import { useAngleSliderContext } from './use-angle-slider-context.ts'
 
-  let { ref = $bindable(null), ...props }: AngleSliderValueTextProps = $props()
+  let { ref = $bindable(null), children, ...props }: AngleSliderValueTextProps = $props()
   const angleSlider = useAngleSliderContext()
   const mergedProps = $derived(mergeProps(angleSlider().getValueTextProps(), props))
 </script>
 
-<Ark as="span" bind:ref {...mergedProps} />
+<Ark as="span" bind:ref {...mergedProps}>
+  {#if children}
+    {@render children()}
+  {:else}
+    {angleSlider().valueAsDegree}
+  {/if}
+</Ark>
```

---

### Incident Patch 14: `d77e3795` (2026-09-29)
**Commit Message**: fix(vue): forward image cropper root props and keep zag boolean defaults (#4129)

ImageCropper.Root never passed its props to the machine. Several parts
also let Vue coerce omitted boolean props to false, overriding Zag
defaults (accordion item disabled, swatch respectAlpha, date picker
fixOnBlur, navigation menu link closeOnClick, toc autoScroll).

Closes #4124

**File**: `.changeset/vue-boolean-prop-defaults.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+'@ark-ui/vue': patch
+---
+
+- **ImageCropper**: Fix `ImageCropper.Root` ignoring all of its props, such as `fixedCropArea`, `aspectRatio`, and
+  `initialCrop`.
+- **Accordion**: Fix `Accordion.Item` not inheriting `disabled` from `Accordion.Root`.
+- **ColorPicker**: Fix `ColorPicker.Swatch` and `ColorPicker.ValueSwatch` dropping the alpha channel by default.
+- **DatePicker**: Fix `DatePicker.Input` not committing the typed date on blur by default.
+- **NavigationMenu**: Fix `NavigationMenu.Link` not closing the menu when clicked.
+- **Toc**: Fix `Toc.Root` not auto-scrolling to the active item by default.
```

**File**: `packages/vue/src/components/accordion/accordion-item.vue` (modified, +3/-1)
```diff
@@ -23,7 +23,9 @@ import { AccordionItemProvider } from './use-accordion-item-context.ts'
 import { AccordionItemPropsProvider } from './use-accordion-item-props-context.ts'
 
 const accordion = useAccordionContext()
-const props = defineProps<AccordionItemProps>()
+const props = withDefaults(defineProps<AccordionItemProps>(), {
+  disabled: undefined,
+})
 const item = computed(() => accordion.value.getItemState(props))
 const renderStrategyProps = useRenderStrategyProps()
 const itemContentProps = computed(() => accordion.value.getItemContentProps(props))
```

**File**: `packages/vue/src/components/accordion/tests/accordion-disabled.test.vue` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+<script setup lang="ts">
+import { Accordion } from '@ark-ui/vue/accordion'
+</script>
+
+<template>
+  <Accordion.Root disabled>
+    <Accordion.Item value="React">
+      <Accordion.ItemTrigger>React Trigger</Accordion.ItemTrigger>
+      <Accordion.ItemContent>React Content</Accordion.ItemContent>
+    </Accordion.Item>
+  </Accordion.Root>
+</template>
```

**File**: `packages/vue/src/components/accordion/tests/accordion.test.ts` (modified, +6/-0)
```diff
@@ -1,6 +1,7 @@
 import user from '@testing-library/user-event'
 import { render, screen, waitFor } from '@testing-library/vue'
 import ComponentUnderTest from './accordion.test.vue'
+import DisabledComponentUnderTest from './accordion-disabled.test.vue'
 
 describe('Accordion', () => {
   it('should not have an expanded item by default', async () => {
@@ -151,4 +152,9 @@ describe('Accordion', () => {
     await user.click(button)
     await waitFor(() => expect(screen.queryByText('React Content')).not.toBeInTheDocument())
   })
+
+  it('should inherit disabled from root when item does not set it', async () => {
+    render(DisabledComponentUnderTest)
+    expect(screen.getByRole('button', { name: 'React Trigger' })).toBeDisabled()
+  })
 })
```

**File**: `packages/vue/src/components/color-picker/color-picker-swatch.vue` (modified, +3/-1)
```diff
@@ -19,7 +19,9 @@ import { useColorPickerContext } from './use-color-picker-context.ts'
 import { ColorPickerSwatchPropsProvider } from './use-color-picker-swatch-props-context.ts'
 import { useForwardExpose } from '../../utils/use-forward-expose.ts'
 
-const props = defineProps<ColorPickerSwatchProps>()
+const props = withDefaults(defineProps<ColorPickerSwatchProps>(), {
+  respectAlpha: undefined,
+})
 const colorPicker = useColorPickerContext()
 
 ColorPickerSwatchPropsProvider(props)
```

**File**: `packages/vue/src/components/color-picker/color-picker-value-swatch.vue` (modified, +3/-1)
```diff
@@ -22,7 +22,9 @@ import { useColorPickerContext } from './use-color-picker-context.ts'
 import { ColorPickerSwatchPropsProvider } from './use-color-picker-swatch-props-context.ts'
 import { useForwardExpose } from '../../utils/use-forward-expose.ts'
 
-const props = defineProps<ColorPickerValueSwatchBaseProps>()
+const props = withDefaults(defineProps<ColorPickerValueSwatchBaseProps>(), {
+  respectAlpha: undefined,
+})
 const colorPicker = useColorPickerContext()
 const swatchProps = computed(() => ({
   value: colorPicker.value.value,
```

**File**: `packages/vue/src/components/color-picker/tests/color-picker.test.ts` (modified, +8/-1)
```diff
@@ -3,6 +3,7 @@ import { render, screen, waitFor } from '@testing-library/vue'
 import { parseColor } from '@ark-ui/vue/color-picker'
 import ComponentUnderTest from './color-picker.test.vue'
 import ColorPickerWithField from './field.test.vue'
+import SwatchComponentUnderTest from './swatch.test.vue'
 
 describe('ColorPicker', () => {
   it('should be able to lazy mount', async () => {
@@ -42,7 +43,7 @@ describe('ColorPicker', () => {
     render(ComponentUnderTest, { props: { defaultValue: parseColor('#ff00ff') } })
 
     const style = screen.getByTestId('swatch-trigger').getAttribute('style') ?? ''
-    expect(style.toLowerCase()).toContain('#ff00ff')
+    expect(style).toContain('rgba(255, 0, 255, 1)')
   })
 })
 
@@ -82,4 +83,10 @@ describe('Color Picker / Field', () => {
     render(ColorPickerWithField)
     expect(screen.queryByText('Error Info')).not.toBeInTheDocument()
   })
+
+  it('should respect alpha in swatches by default', async () => {
+    render(SwatchComponentUnderTest)
+    expect(screen.getByTestId('swatch').style.getPropertyValue('--color')).toBe('rgba(255, 0, 0, 0.5)')
+    expect(screen.getByTestId('value-swatch').style.getPropertyValue('--color')).toBe('rgba(255, 0, 0, 0.5)')
+  })
 })
```

**File**: `packages/vue/src/components/color-picker/tests/swatch.test.vue` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+<script setup lang="ts">
+import { ColorPicker, parseColor } from '@ark-ui/vue/color-picker'
+</script>
+
+<template>
+  <ColorPicker.Root :default-value="parseColor('rgba(255, 0, 0, 0.5)')">
+    <ColorPicker.Swatch value="rgba(255, 0, 0, 0.5)" data-testid="swatch" />
+    <ColorPicker.ValueSwatch data-testid="value-swatch" />
+  </ColorPicker.Root>
+</template>
```

---

### Incident Patch 15: `e3116c61` (2026-09-27)
**Commit Message**: fix(vue): emit combobox select and menu/popover requestDismiss (#4119)

useCombobox never forwarded Zag's onSelect, so @select on
Combobox.Root never fired. Menu and Popover declared a requestDismiss
emit but never forwarded onRequestDismiss either.

Closes #4115

**File**: `.changeset/vue-missing-emits.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@ark-ui/vue': patch
+---
+
+- **Combobox**: Fix `select` event not being emitted when an item is selected.
+- **Menu, Popover**: Fix `requestDismiss` event not being emitted when a parent layer closes.
```

**File**: `packages/vue/src/components/combobox/tests/combobox.test.ts` (modified, +11/-0)
```diff
@@ -34,6 +34,17 @@ describe('Combobox', () => {
     await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1))
   })
 
+  it('should emit select when item is selected', async () => {
+    const onSelect = vi.fn()
+    render(ComponentUnderTest, { props: { onSelect } })
+
+    fireEvent.click(screen.getByText('Open'))
+    await waitFor(() => expect(screen.getByRole('option', { name: 'React' })).toBeVisible())
+
+    fireEvent.click(screen.getByRole('option', { name: 'React' }))
+    await waitFor(() => expect(onSelect).toHaveBeenCalledWith({ value: ['react'], itemValue: 'react' }))
+  })
+
   it('should open menu when onOpenChange is called', async () => {
     const onOpenChange = vi.fn()
     render(ComponentUnderTest, { props: { onOpenChange } })
```

**File**: `packages/vue/src/components/combobox/use-combobox.ts` (modified, +4/-0)
```diff
@@ -68,6 +68,10 @@ export const useCombobox = <T extends CollectionItem>(
         emit?.('pointerDownOutside', details)
         localeProps.onPointerDownOutside?.(details)
       },
+      onSelect: (details) => {
+        emit?.('select', details)
+        localeProps.onSelect?.(details)
+      },
       onOpenChange: (details) => {
         emit?.('openChange', details)
         emit?.('update:open', details.open)
```

**File**: `packages/vue/src/components/menu/tests/menu-nested.test.vue` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+<script setup lang="ts">
+import { Dialog } from '@ark-ui/vue/dialog'
+import { Menu } from '@ark-ui/vue/menu'
+
+defineProps<{ dialogOpen: boolean }>()
+const emit = defineEmits<{ requestDismiss: [event: CustomEvent] }>()
+</script>
+
+<template>
+  <Dialog.Root :open="dialogOpen">
+    <Dialog.Positioner>
+      <Dialog.Content>
+        <Menu.Root @request-dismiss="emit('requestDismiss', $event)">
+          <Menu.Trigger>click me</Menu.Trigger>
+          <Menu.Positioner>
+            <Menu.Content>
+              <Menu.Item value="edit">Edit</Menu.Item>
+            </Menu.Content>
+          </Menu.Positioner>
+        </Menu.Root>
+      </Dialog.Content>
+    </Dialog.Positioner>
+  </Dialog.Root>
+</template>
```

**File**: `packages/vue/src/components/menu/tests/menu.test.ts` (modified, +11/-0)
```diff
@@ -1,6 +1,7 @@
 import { userEvent as user } from '@testing-library/user-event'
 import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
 import SeparatorAsChildComponentUnderTest from './menu-separator-as-child.test.vue'
+import NestedComponentUnderTest from './menu-nested.test.vue'
 import ComponentUnderTest from './menu.test.vue'
 
 describe('Menu', () => {
@@ -119,4 +120,14 @@ describe('Menu', () => {
     expect(separator).toHaveAttribute('data-scope', 'menu')
     expect(separator).toHaveAttribute('data-part', 'separator')
   })
+
+  it('should emit requestDismiss when the parent layer closes', async () => {
+    const onRequestDismiss = vi.fn()
+    const { rerender } = render(NestedComponentUnderTest, { props: { dialogOpen: true, onRequestDismiss } })
+    await user.click(screen.getByText('click me'))
+    await waitFor(() => expect(screen.getByText('Edit')).toBeVisible())
+
+    await rerender({ dialogOpen: false })
+    await waitFor(() => expect(onRequestDismiss).toHaveBeenCalledTimes(1))
+  })
 })
```

**File**: `packages/vue/src/components/menu/use-menu.ts` (modified, +4/-0)
```diff
@@ -57,6 +57,10 @@ export const useMenu = (props: MaybeRef<UseMenuProps> = {}, emit?: EmitFn<RootEm
         emit?.('pointerDownOutside', details)
         localeProps.onPointerDownOutside?.(details)
       },
+      onRequestDismiss: (details) => {
+        emit?.('requestDismiss', details)
+        localeProps.onRequestDismiss?.(details)
+      },
       onSelect: (details) => {
         emit?.('select', details)
         localeProps.onSelect?.(details)
```

**File**: `packages/vue/src/components/popover/tests/popover-nested.test.vue` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+<script setup lang="ts">
+import { Dialog } from '@ark-ui/vue/dialog'
+import { Popover } from '@ark-ui/vue/popover'
+
+defineProps<{ dialogOpen: boolean }>()
+const emit = defineEmits<{ requestDismiss: [event: CustomEvent] }>()
+</script>
+
+<template>
+  <Dialog.Root :open="dialogOpen">
+    <Dialog.Positioner>
+      <Dialog.Content>
+        <Popover.Root @request-dismiss="emit('requestDismiss', $event)">
+          <Popover.Trigger>click me</Popover.Trigger>
+          <Popover.Positioner>
+            <Popover.Content>popover content</Popover.Content>
+          </Popover.Positioner>
+        </Popover.Root>
+      </Dialog.Content>
+    </Dialog.Positioner>
+  </Dialog.Root>
+</template>
```

**File**: `packages/vue/src/components/popover/tests/popover.test.ts` (modified, +11/-0)
```diff
@@ -1,6 +1,7 @@
 import user from '@testing-library/user-event'
 import { render, screen, waitFor } from '@testing-library/vue'
 import ControlledComponentUnderTest from './controlled-popover.test.vue'
+import NestedComponentUnderTest from './popover-nested.test.vue'
 import ComponentUnderTest from './popover.test.vue'
 
 describe('Popover', () => {
@@ -87,4 +88,14 @@ describe('Popover', () => {
     await user.click(screen.getByRole('button', { name: 'close' }))
     await waitFor(() => expect(screen.queryByTestId('positioner')).not.toBeInTheDocument())
   })
+
+  it('should emit requestDismiss when the parent layer closes', async () => {
+    const onRequestDismiss = vi.fn()
+    const { rerender } = render(NestedComponentUnderTest, { props: { dialogOpen: true, onRequestDismiss } })
+    await user.click(screen.getByText('click me'))
+    await waitFor(() => expect(screen.getByText('popover content')).toBeVisible())
+
+    await rerender({ dialogOpen: false })
+    await waitFor(() => expect(onRequestDismiss).toHaveBeenCalledTimes(1))
+  })
 })
```

#### Recent Merged Pull Requests:
- **PR #4178** (2026-10-05): fix: backport the Oct 4–6 v5 docs fixes to v6 (@Adebesin-Cell)
- **PR #4177** (2026-10-05): docs(command-palette): use the shared backdrop token (@Adebesin-Cell)
- **PR #4176** (2026-10-05): docs(dialog): dim the whole page behind example overlays (@Adebesin-Cell)
- **PR #4175** (2026-10-05): docs(tabs): keep the example layout steady when switching tabs (@Adebesin-Cell)
- **PR #4174** (2026-10-05): chore: bump zag to 1.45.0 (@Adebesin-Cell)
- **PR #4164** (closed): fix(tour): hide the backdrop when the tour closes (@Adebesin-Cell)
- **PR #4163** (2026-10-04): docs(tour): stack the example parts with --tour-layer (@Adebesin-Cell)
- **PR #4159** (2026-10-04): docs(popover): let the positioning example fall back to top and bottom (@Adebesin-Cell)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
