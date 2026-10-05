# Forensic Learning Record (Deep Inspection): chakra-ui/zag

> **Canonical Artifact**: `07_PROJECT_LEARNING/chakra-ui-zag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chakra-ui/zag](https://github.com/chakra-ui/zag))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:58:44.906Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chakra-ui/zag`
- **Description**: Build your design system in React, Solid, Vue, Svelte or Vanilla. Powered by finite state machines
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5221 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `e2e/_utils.ts`
```
import AxeBuilder from "@axe-core/playwright"
import { expect, type Locator, type Page } from "@playwright/test"

export async function a11y(page: Page, selector = "[data-part=root]", disableRules: string[] = []) {
  await page.waitForSelector(selector)

  const results = await new AxeBuilder({ page: page as any })
    .disableRules(["color-contrast", ...disableRules])
    .include(selector)
    .analyze()

  expect(results.violations).toEqual([])
}

export const testid = (part: string) => `[data-testid=${esc(part)}]`

export const controls = (page: Page) => {
  return {
    num: async (id: string, value: string) => {
      const el = page.locator(testid(id))
      await el.selectText()
      await page.keyboard.press("Backspace")
      await el.fill(value)
      await page.keyboard.press("Enter")
    },
    bool: async (id: string, value = true) => {
      const el = page.locator(testid(id))
      if (value) await el.check()
      else await el.uncheck()
    },
    select: async (id: string, value: string) => {
      const el = page.locator(testid(id))
      await el.selectOption(value)
    },
    date: async (id: string, value: string) => {
      const el = page.locator(testid(id))
      await el.fill(value)
    },
  }
}

export const part = (part: string) => `[data-part=${esc(part)}]`

const esc = (str: string) => str.replace(/[-[\]{}()*+?:.,\\^$|#\s]/g, "\\$&")

export const clickViz = (page: Page) => page.locator("text=Visualizer").first().click()

export const clickControls = (page: Page) =>
  page.locator(".toolbar nav > button", { hasText: "Controls" }).first().click()

export const paste = (node: HTMLElement, value: string) => {
  const clipboardData = new DataTransfer()
  clipboardData.setData("text/plain", value)
  const event = new ClipboardEvent("paste", {
    clipboardData,
    bubbles: true,
    cancelable: true,
  })
  node.dispatchEvent(event)
}

export const nativeInput = (node: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const event = new InputEvent("input", {
    bubbles: true,
    inputType: "insertFromPaste",
  })

  const __input__setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  const __textarea__setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set

  const textValue = `${node.value}${value}`

  const set = node.localName === "input" ? __input__setter : __textarea__setter
  set?.call(node, textValue)

  node.dispatchEvent(event)
}

export const clickOutside = (page: Page) => page.click("body", { force: true })

export const rect = async (el: Locator) => {
  const bbox = await el.boundingBox()

  if (!bbox) {
    throw new Error("Element not found")
  }

  return {
    ...bbox,
    midX: bbox.x + bbox.width / 2,
    midY: bbox.y + bbox.height / 2,
    maxX: bbox.x + bbox.width,
    maxY: bbox.y + bbox.height,
  }
}

export const approximatelyEqual = (a: number, b: number, tolerance = 1) => Math.abs(a - b) <= tolerance

export async function isInViewport(viewport: Locator, el: Locator) {
  const bbox = await rect(el)
  const viewportBbox = await rect(viewport)
  return (
    bbox.x >= viewportBbox.x &&
    bbox.y >= viewportBbox.y &&
    bbox.x + bbox.width <= viewportBbox.x + viewportBbox.width &&
    bbox.y + bbox.height <= viewportBbox.y + viewportBbox.height
  )
}

export const repeat = async (count: number, fn: () => unknown) => {
  await [...new Array(count)].reduce((p) => p.then(fn), Promise.resolve())
}

export const pointer = {
  down(el: Locator) {
    return el.dispatchEvent("pointerdown", { pointerType: "mouse", button: 0 })
  },
  up(el: Locator) {
    return el.dispatchEvent("pointerup", { pointerType: "mouse", button: 0 })
  },
  async move(el: Locator) {
    await el.hover()
    return el.dispatchEvent("pointermove", { button: 0 })
  },
}

export const textSelection = (page: Page) => {
  return page.evaluate(() => window.getSelection()?.toString())
}

export type SwipeDirection = "left" | "right" | "up" | "down"

const swipeDirections = new Set<SwipeDirection>(["left", "right", "up", "down"])

export async function mouseSwipe(
  page: Page,
  locator: Locator,
  direction: SwipeDirection,
  distance: number = 100,
  duration: number = 500,
  release: boolean = true,
): Promise<void> {
  if (!swipeDirections.has(direction)) {
    throw new Error("Invalid direction. Use 'left', 'right', 'up', or 'down'.")
  }

  await locator.waitFor({ state: "visible" })
  const box = await rect(locator)
  if (!box) {
    throw new Error("Could not determine the element bounding box.")
  }

  // Calculate start and end points for the swipe
  const startX = box.midX
  const startY = box.midY

  let endX = startX
  let endY = startY

  switch (direction) {
    case "left":
      endX = startX - distance
      break
    case "right":
      endX = startX + distance
      break
    case "up":
      endY = startY - distance
      break
    case "down":
      endY = startY + distance
      break
  }

  // Perform the swipe action using mouse drag
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(endX, endY, { steps: Math.max(duration / 10, 1) }) // Smoothness based on duration
  if (release) {
    await page.mouse.up()
  }
}

export async function touchSwipe(
  page: Page,
  locator: Locator,
  direction: SwipeDirection,
  distance: number = 100,
  duration: number = 500,
): Promise<void> {
  if (!swipeDirections.has(direction)) {
    throw new Error("Invalid direction. Use 'left', 'right', 'up', or 'down'.")
  }

  await locator.waitFor({ state: "visible" })
  const box = await rect(locator)

  const startX = box.midX
  const startY = box.midY

  let endX = startX
  let endY = startY

  switch (direction) {
    case "left":
      endX = startX - distance
      break
    case "right":
      endX = startX + distance
      break
    case "up":
      endY = startY - distance
      break
    case "down":
      endY = startY + distance
      break
  }

  const steps = Math.max(Math.floor(duration / 16), 1)

  await page.evaluate(
    async ({ selector, startX, startY, endX, endY, steps }) => {
      const target = document.querySelector(selector)
      if (!(target instanceof HTMLElement)) throw new Error("Swipe target not found")

      const createTouch = (x: number, y: number) =>
        new Touch({ identifier: 0, target, clientX: x, clientY: y, pageX: x, pageY: y })

      const dispatch = (type: string, x: number, y: number, active: boolean) => {
        const touch = createTouch(x, y)
        const touches = active ? [touch] : []
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches,
            targetTouches: touches,
            changedTouches: [touch],
          }),
        )
      }

      dispatch("touchstart", startX, startY, true)
      for (let index = 1; index <= steps; index++) {
        const progress = index / steps
        const x = startX + (endX - startX) * progress
        const y = startY + (endY - startY) * progress
        dispatch("touchmove", x, y, true)
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
      }
      dispatch("touchend", endX, endY, false)
    },
    {
      selector: await locator.evaluate((el) => {
        const attr = "data-zag-touch-swipe"
        if (!el.hasAttribute(attr)) el.setAttribute(attr, Math.random().toString(36).slice(2))
        return `[${attr}="${el.getAttribute(attr)}"]`
      }),
      startX,
      startY,
      endX,
      endY,
      steps,
    },
  )
}

export async function touchPointerSwipe(
  page: Page,
  locator: Locator,
  direction: SwipeDirection,
  distance: number = 100,
  duration: number = 500,
): Promise<void> {
  if (!swipeDirections.has(direction)) {
    throw new Error("Invalid direction. Use 'left', 'right', 'up', or 'down'.")
  }

  await locator.waitFor({ state: "visible" })
  const box = await rect(locator)

  const startX = box.midX
  const startY = box.midY

  let endX = startX
  let endY = startY

  switch (direction) {
    case "left":
      endX = startX - distance
      break
    case "right":
      endX = startX + distance
      break
    case "up":
      endY = startY - distance
      break
    case "down":
      endY = startY + distance
      break
  }

  const selector = await locator.evaluate((el) => {
    const attr = "data-zag-touch-pointer-swipe"
    if (!el.hasAttribute(attr)) el.setAttribute(attr, Math.random().toString(36).slice(2))
    return `[${attr}="${el.getAttribute(attr)}"]`
  })

  const steps = Math.max(Math.floor(duration / 16), 1)

  await page.evaluate(
    async ({ selector, startX, startY, endX, endY, steps }) => {
      const target = document.querySelector(selector)
      if (!(target instanceof HTMLElement)) throw new Error("Swipe target not found")

      const dispatch = (type: string, x: number, y: number, buttons: number) => {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            button: 0,
            buttons,
            clientX: x,
            clientY: y,
            pressure: buttons ? 0.5 : 0,
          }),
        )
      }

      dispatch("pointerdown", startX, startY, 1)
      for (let index = 1; index <= steps; index++) {
        const progress = index / steps
        const x = startX + (endX - startX) * progress
        const y = startY + (endY - startY) * progress
        dispatch("pointermove", x, y, 1)
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
      }
      dispatch("pointerup", endX, endY, 0)
    },
    { selector, startX, startY, endX, endY, steps },
  )
}

export function moveCaret(input: Locator, start: number, end = start) {
  return input.evaluate((el) => {
    if (el instanc
```

### Core Architecture Module: `examples/next-ts/components/state-visualizer.tsx`
```
import { MachineSchema, Service } from "@zag-js/core"
import { highlightState } from "@zag-js/stringify-state"

type StateVisualizerProps<T extends MachineSchema> = {
  state: Service<T>
  label?: string
  omit?: string[]
  context?: Array<keyof T["context"]>
}

export function StateVisualizer<T extends MachineSchema>(props: StateVisualizerProps<T>) {
  const { label, omit, context } = props
  const service = props.state
  const obj = {
    state: service.state.get(),
    event: service.event.current(),
    previousEvent: service.event.previous(),
    context: context ? Object.fromEntries(context.map((key) => [key, service.context.get(key)])) : undefined,
  }

  return (
    <div className="viz">
      <pre dir="ltr">
        <details open>
          <summary> {label || "Visualizer"} </summary>
          <div dangerouslySetInnerHTML={{ __html: highlightState(obj, omit) }} />
        </details>
      </pre>
    </div>
  )
}

```

### Core Architecture Module: `examples/next-ts/hooks/use-async-list.ts`
```
import * as asyncList from "@zag-js/async-list"
import { useMachine } from "@zag-js/react"

export function useAsyncList<T, C = string>(props: asyncList.Props<T, C>) {
  const service = useMachine(asyncList.machine as asyncList.Machine<T, C>, props)
  return asyncList.connect(service)
}

```

### Core Architecture Module: `examples/next-ts/hooks/use-controls.tsx`
```
import { ControlRecord, deepGet, deepSet, getControlDefaults, getTransformedControlValues } from "@zag-js/shared"
import { useMemo, useState } from "react"

export function useControls<T extends ControlRecord>(config: T) {
  const [state, __setState] = useState(getControlDefaults(config))
  const context = useMemo(() => getTransformedControlValues(config, state), [config, state])

  const setState = (key: string, value: any) => {
    __setState((s) => {
      const newState = structuredClone(s)
      deepSet(newState, key, value)
      return newState
    })
  }

  return {
    context,
    ui: () => (
      <div className="controls-container">
        {Object.keys(config).map((key) => {
          const { type, label = key, options, placeholder, min, max } = (config[key] ?? {}) as any
          const value = deepGet(state, key)
          switch (type) {
            case "boolean":
              return (
                <div key={key} className="checkbox">
                  <input
                    data-testid={key}
                    id={label}
                    type="checkbox"
                    defaultChecked={value}
                    onChange={(e) => {
                      setState(key, e.target.checked)
                    }}
                  />
                  <label htmlFor={label}>{label}</label>
                </div>
              )
            case "string":
              return (
                <div key={key} className="text">
                  <label style={{ marginRight: "10px" }}>{label}</label>
                  <input
                    data-testid={key}
                    type="text"
                    placeholder={placeholder}
                    defaultValue={value}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setState(key, e.currentTarget.value)
                      }
                    }}
                  />
                </div>
              )
            case "select":
              return (
                <div key={key} className="text">
                  <label htmlFor={label} style={{ marginRight: "10px" }}>
                    {label}
                  </label>
                  <select
                    data-testid={key}
                    id={label}
                    defaultValue={value}
                    onChange={(e) => {
                      setState(key, e.target.value)
                    }}
                  >
                    <option>-----</option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              )
            case "number":
              return (
                <div key={key} className="text">
                  <label htmlFor={label} style={{ marginRight: "10px" }}>
                    {label}
                  </label>
                  <input
                    data-testid={key}
                    id={label}
                    type="number"
                    min={min}
                    max={max}
                    defaultValue={value}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = parseFloat(e.currentTarget.value)
                        setState(key, isNaN(val) ? 0 : val)
                      }
                    }}
                  />
                </div>
              )
            case "date":
              return (
                <div key={key} className="text">
                  <label htmlFor={label} style={{ marginRight: "10px" }}>
                    {label}
                  </label>
                  <input
                    data-testid={key}
                    id={label}
                    type="date"
                    placeholder={placeholder}
                    defaultValue={value}
                    onChange={(e) => {
                      setState(key, e.currentTarget.value)
                    }}
                  />
                </div>
              )
            default:
              return null
          }
        })}
      </div>
    ),
  }
}

```

### Core Architecture Module: `examples/next-ts/hooks/use-effect-once.ts`
```
import { useEffect } from "react"

export function useEffectOnce(fn: VoidFunction) {
  useEffect(fn, [])
}

```

### Core Architecture Module: `examples/next-ts/hooks/use-event.ts`
```
import { useCallback, useRef } from "react"

type AnyFunction = (...args: any[]) => any

export function useEvent<T extends AnyFunction>(callback: T | undefined): T {
  const ref = useRef(callback)
  ref.current = callback
  return useCallback((...args: any[]) => ref.current?.(...args), []) as T
}

```

### Core Architecture Module: `examples/next-ts/hooks/use-focus-trap.ts`
```
import { trapFocus, type TrapFocusOptions } from "@zag-js/focus-trap"
import { useEffect, type RefObject } from "react"

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  options: TrapFocusOptions & { enabled?: boolean } = {},
) {
  const { enabled = true, ...trapOptions } = options

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    return trapFocus(el, trapOptions)
  }, [enabled])
}

```

### Core Architecture Module: `examples/next-ts/hooks/use-persistent-state.ts`
```
import { useCallback, useEffect, useRef, useState } from "react"

export interface PersistentStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface UsePersistentStateProps<T> {
  key: string
  defaultValue: T
  storage?: PersistentStorage | null
  serialize?: (value: T) => string
  deserialize?: (raw: string) => T
}

const defaultStorage: PersistentStorage | null = typeof window !== "undefined" ? window.localStorage : null

export function usePersistentState<T>(props: UsePersistentStateProps<T>) {
  const { key, defaultValue, storage = defaultStorage, serialize = JSON.stringify, deserialize = JSON.parse } = props

  const optsRef = useRef({ storage, serialize, deserialize })
  optsRef.current = { storage, serialize, deserialize }

  const [state, setState] = useState(defaultValue)
  const [hydrated, setHydrated] = useState(false)

  // No-op before hydration so mount-time callbacks can't overwrite persisted state.
  const hydratedRef = useRef(hydrated)
  hydratedRef.current = hydrated

  useEffect(() => {
    const { storage, deserialize } = optsRef.current
    if (!storage) {
      setHydrated(true)
      return
    }
    try {
      const raw = storage.getItem(key)
      if (raw != null) setState(deserialize(raw))
    } catch {
      // Ignore access errors in private browsing or restricted environments.
    } finally {
      setHydrated(true)
    }
  }, [key])

  const setPersistentState = useCallback(
    (value: T | ((previous: T) => T)) => {
      if (!hydratedRef.current) return
      setState((previous) => {
        const nextValue = typeof value === "function" ? (value as (previous: T) => T)(previous) : value
        const { storage, serialize } = optsRef.current
        if (storage) {
          try {
            storage.setItem(key, serialize(nextValue))
          } catch {
            // Ignore access errors in private browsing or restricted environments.
          }
        }
        return nextValue
      })
    },
    [key],
  )

  return [state, setPersistentState, hydrated] as const
}

export interface UsePersistentMapStateProps<T> {
  storageKey: string
  key: string
  defaultValue: T
  storage?: PersistentStorage | null
}

export function usePersistentMapState<T>(props: UsePersistentMapStateProps<T>) {
  const { storageKey, key, defaultValue, storage } = props

  const [map, setMap, hydrated] = usePersistentState<Record<string, T>>({
    key: storageKey,
    defaultValue: {},
    storage,
  })

  const value = map[key] ?? defaultValue

  const defaultValueRef = useRef(defaultValue)
  defaultValueRef.current = defaultValue

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      setMap((previousMap) => {
        const previousValue = previousMap[key] ?? defaultValueRef.current
        const resolved = typeof next === "function" ? (next as (previous: T) => T)(previousValue) : next
        return { ...previousMap, [key]: resolved }
      })
    },
    [setMap, key],
  )

  return [value, setValue, hydrated] as const
}

```

### Core Architecture Module: `examples/next-ts/hooks/use-scroll-area.ts`
```
import { addDomEvent, getComputedStyle, getEventTarget, getWindow } from "@zag-js/dom-query"
import { Direction } from "@zag-js/types"
import { useEffect, useRef } from "react"

export interface ScrollAreaProps {
  onScrollStart?: (e: Event) => void
  onScrollEnd?: (e: Event) => void
  onScroll?: (e: Event) => void
  onScrollChange?: (scrolling: boolean) => void
  onSideReached?: (sides: { top: boolean; right: boolean; bottom: boolean; left: boolean }) => void
  flush?: (fn: VoidFunction) => void
  offset?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}

function trackScrollArea(node: HTMLElement | null, props: ScrollAreaProps) {
  if (!node) return

  let { onScrollStart, onScrollEnd, onScrollChange, onSideReached, offset = {}, flush } = props
  const { top: topOffset = 0, right: rightOffset = 0, bottom: bottomOffset = 0, left: leftOffset = 0 } = offset

  const win = getWindow(node)
  const computedStyle = getComputedStyle(node)
  const direction = computedStyle.direction as Direction

  const state = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollEndTime: 0,
    scrollTimeout: null as ReturnType<typeof setTimeout> | null,
    width: 0,
    height: 0,
    isScrolling: false,
    sideReached: {
      right: false,
      bottom: false,
      top: true,
      left: true,
    },
  }

  const checkScroll = () => {
    let scrollTop = node.scrollTop
    let scrollLeft = getScrollLeft(node, direction)
    let scrollHeight = node.scrollHeight
    let scrollWidth = node.scrollWidth
    let clientHeight = node.clientHeight
    let clientWidth = node.clientWidth

    state.scrollTop = Math.max(0, Math.min(scrollTop, clientHeight - state.height))
    state.scrollLeft = Math.max(0, Math.min(scrollLeft, clientWidth - state.width))

    const sides = {
      top: scrollTop <= topOffset,
      bottom: Math.abs(scrollHeight - scrollTop - clientHeight) <= bottomOffset,
      left:
        direction === "ltr" ? scrollLeft <= leftOffset : Math.abs(scrollWidth - scrollLeft - clientWidth) <= leftOffset,
      right:
        direction === "ltr"
          ? Math.abs(scrollWidth - scrollLeft - clientWidth) <= rightOffset
          : scrollLeft <= rightOffset,
    }

    if (serializeSides(sides) !== serializeSides(state.sideReached)) {
      onSideReached?.(sides)
      state.sideReached = sides
    }
  }

  const onScroll = (e: Event) => {
    if (getEventTarget(e) !== node) {
      return
    }

    props.onScroll?.(e)

    flush(() => {
      checkScroll()

      if (!state.isScrolling) {
        state.isScrolling = true
        onScrollChange?.(true)
        onScrollStart?.(e)
      }

      let now = Date.now()
      if (state.scrollEndTime <= now + 50) {
        state.scrollEndTime = now + 300

        if (state.scrollTimeout != null) {
          clearTimeout(state.scrollTimeout)
        }

        state.scrollTimeout = setTimeout(() => {
          state.isScrolling = false
          onScrollChange?.(false)
          state.scrollTimeout = null
          onScrollEnd?.(e)
        }, 300)
      }
    })
  }

  const resizeObserver = new win.ResizeObserver((entries) => {
    if (!entries.length) return
    checkScroll()
  })
  resizeObserver.observe(node)

  const cleanupScroll = addDomEvent(node, "scroll", onScroll)
  const cleanupTimeout = () => {
    if (state.scrollTimeout != null) {
      clearTimeout(state.scrollTimeout)
    }
  }

  return () => {
    cleanupScroll()
    cleanupTimeout()
    resizeObserver.unobserve(node)
  }
}

export type RTLOffsetType = "negative" | "positive-descending" | "positive-ascending"

let cachedRTLResult: RTLOffsetType | null = null

function getRTLOffsetType(doc: Document, recalculate: boolean = false): RTLOffsetType {
  if (cachedRTLResult === null || recalculate) {
    const outerDiv = doc.createElement("div")
    const outerStyle = outerDiv.style
    outerStyle.width = "50px"
    outerStyle.height = "50px"
    outerStyle.overflow = "scroll"
    outerStyle.direction = "rtl"

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

  return cachedRTLResult
}

function serializeSides(sides: { top: boolean; right: boolean; bottom: boolean; left: boolean }) {
  return `t:${sides.top},r:${sides.right},b:${sides.bottom},l:${sides.left}`
}

function getScrollLeft(node: Element, direction: Direction): number {
  let { scrollLeft } = node
  if (direction === "rtl") {
    let { scrollWidth, clientWidth } = node
    switch (getRTLOffsetType(node.ownerDocument)) {
      case "negative":
        scrollLeft = -scrollLeft
        break
      case "positive-descending":
        scrollLeft = scrollWidth - clientWidth - scrollLeft
        break
    }
  }
  return scrollLeft
}

export function useScrollArea(props: ScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    return trackScrollArea(ref.current, props)
  }, [props])
  return ref
}

```

### Core Architecture Module: `examples/next-ts/hooks/use-sentinel-observer.ts`
```
import { useEffect, useRef } from "react"

interface UseSentinelObserverOptions {
  getSentinel: () => HTMLElement | null
  onIntersect: () => void
  rootRef?: React.RefObject<Element | null>
  threshold?: number
}

export function useSentinelObserver(options: UseSentinelObserverOptions) {
  const onIntersectRef = useRef(options.onIntersect)
  onIntersectRef.current = options.onIntersect

  useEffect(() => {
    const sentinel = options.getSentinel()
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onIntersectRef.current()
      },
      {
        root: options.rootRef?.current ?? null,
        threshold: options.threshold ?? 0.1,
      },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])
}

```

### Core Architecture Module: `examples/next-ts/machines/nested-states.machine.ts`
```
import { createMachine } from "@zag-js/core"

interface NestedStatesSchema {
  state: "idle" | "open" | "open.viewing" | "open.editing"
  context: {}
  effect: "trackOpen"
  event: { type: "OPEN" } | { type: "EDIT" } | { type: "SAVE" } | { type: "CANCEL" } | { type: "CLOSE" }
}

export const nestedStatesMachine = createMachine<NestedStatesSchema>({
  initialState() {
    return "idle"
  },

  context() {
    return {}
  },

  states: {
    idle: {
      on: {
        OPEN: {
          target: "open",
        },
      },
    },

    open: {
      initial: "viewing",
      effects: ["trackOpen"],
      states: {
        viewing: {
          on: {
            EDIT: {
              target: "editing",
            },
          },
        },
        editing: {
          on: {
            SAVE: {
              target: "viewing",
            },
            CANCEL: {
              target: "viewing",
            },
          },
        },
      },

      on: {
        CLOSE: {
          target: "idle",
        },
      },
    },
  },

  implementations: {
    effects: {
      trackOpen() {
        console.log("[nested-states] entered open state")
        return () => {
          console.log("[nested-states] cleanup: exited open state")
        }
      },
    },
  },
})

```

### Core Architecture Module: `examples/next-ts/pages/file-upload/react-hook-form.tsx`
```
import * as fileUpload from "@zag-js/file-upload"
import { mergeProps, normalizeProps, useMachine } from "@zag-js/react"
import { XIcon } from "lucide-react"
import { useId } from "react"
import { useForm } from "react-hook-form"

export default function Page() {
  const service = useMachine(fileUpload.machine, { id: useId() })

  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<{ file: File[] }>()

  const api = fileUpload.connect(service, normalizeProps)

  return (
    <main>
      <form
        onSubmit={handleSubmit((data) => {
          console.log(data)
        })}
        style={{ width: "100%" }}
      >
        <div {...api.getRootProps()}>
          <input
            {...mergeProps(
              api.getHiddenInputProps(),
              register("file", {
                validate: (value) => Boolean(value.length) || "This is required",
              }),
            )}
          />
          <div {...api.getDropzoneProps()}>
            <span>Drag your files here</span>
            <button {...api.getTriggerProps()}>Open Dialog</button>
          </div>

          <div>
            {api.acceptedFiles.map((file) => (
              <div {...api.getItemProps({ file })} key={file.name}>
                <div>
                  {file.name} {api.getFileSize(file)}
                </div>
                <button {...api.getItemDeleteTriggerProps({ file })}>
                  <XIcon />
                </button>
              </div>
            ))}
          </div>

          <button type="submit">Submit</button>

          {errors?.file?.message}
        </div>
      </form>
    </main>
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2919** (2026-01-13): **Floating panel shows minimize button even if its minimized**
  *Symptoms*: <!--- Thanks for creating an issue 😄!  Please search open/closed issues before submitting. Someone might have asked the same thing before 😉!  Please fill out all of the sections of this template marked as REQUIRED! We ask for this information because we need it in order to understand your issue and quickly diagnose it or provide a solution. Failure to provide the required information will result in your issue being closed.  We're all volunteers here, so help us help you by taking the time to accurately fill out this template. ❤️ -->  # 🐛 Bug report  When opening a Flotaing panel via the docs page without any size constraints, the minimize button is still visible and content is being cut.   <img width="1919" height="916" alt="Image" src="https://github.com/user-attachments/assets/2e3abb36-6a34-413e-a1d5-1f40e5a1e602" />  ## 💥 Steps to reproduce  1. Open a floating panel 2. Minimize the floating panel 3. Maximize floating panel by double clicking the title 4. Click on restore window icon   ## 💻 Link to reproduction https://zagjs.com/components/react/floating-panel  ## 🧐 Expected behavior  Content staying minimized and not cutted.  ## 🧭 Possible Solution  Double clicking the title removes the minimized setting from the windows  ## 🌍 System information  <!-- REQUIRED -->  | Software         | Version(s) | | ---------------- | ---------- | | Zag Version      |  1.32.0  | | Browser          |  Firefox 146.0.1 | | Operating System | Windows 11 |  
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report! 🙏  Fixed this — double-clicking the title bar when minimized now restores the panel instead of maximizing it. This aligns with the button visibility (we hide maximize when minimized) and avoids the size bug you encountered.  Will do a new release shortly.
  > Thanks @segunadebayo !!

- **Issue #2084** (2024-12-29): **Dialog unexpectedly closes on a touch device**
  *Symptoms*: ### Description  see this old issue which was closed, not fixed actually (I was able to reproduce it for all releases from 3.9 to 4.2).  https://github.com/chakra-ui/ark/issues/2816    ### Link to Reproduction (or Detailed Explanation)  https://stackblitz.com/~/github.com/dannylin108/parkui-bug-report  ### Steps to Reproduce  1. Open the page on a touch device (Chrome emulation also works) 2. Open the drawer 3. Choose a date in the date picker 4. The drawer unexpectedly closes, but should remain open showing the chosen date.   ### Ark UI Version  4.2.0  ### Framework  - [ ] React - [X] Solid - [ ] Vue  ### Browser  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > I have the same issue on Ark UI 4.1.2 for React
  > @narsiliko @dannylin108   We've released a new version. Please re-open the if the issue persist.
  > @cschroeter  > We've released a new version. Please re-open the if the issue persist.  The issue remains after the latest release (v4.3.0)  https://codesandbox.io/p/sandbox/7j72xj  Touching a combobox menu item closes the dialog. Clicking on it works with no issues. 

- **Issue #1620** (2024-06-27): **Bug: Combobox disabled states are too lazily evaluated**
  *Symptoms*: # 🐛 Bug report  When filtered out items reappear in a combobox list, they only regain their disabled value once they've been interactived with.  ## 💥 Steps to reproduce  1. Click the combobox and type z 2. Backspace to remove the z. The disabled state of Benin is now gone.  ## 💻 Link to reproduction  https://codesandbox.io/p/sandbox/youthful-nightingale-mtfjfc?file=%2Fsrc%2Fstyles.css%3A14%2C26&layout=%257B%2522sidebarPanel%2522%253A%2522EXPLORER%2522%252C%2522rootPanelGroup%2522%253A%257B%2522direction%2522%253A%2522horizontal%2522%252C%2522contentType%2522%253A%2522UNKNOWN%2522%252C%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522id%2522%253A%2522ROOT_LAYOUT%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522UNKNOWN%2522%252C%2522direction%2522%253A%2522vertical%2522%252C%2522id%2522%253A%2522clxvvabhh00062e69hn763il6%2522%252C%2522sizes%2522%253A%255B100%252C0%255D%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522EDITOR%2522%252C%2522direction%2522%253A%2522horizontal%2522%252C%2522id%2522%253A%2522EDITOR%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL%2522%252C%2522contentType%2522%253A%2522EDITOR%2522%252C%2522id%2522%253A%2522clxvvabhh00022e69gy6k1isu%2522%257D%255D%257D%252C%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522SHELLS%2522%252C%2522direction%2522%253A%2522horizontal

- **Issue #2261** (2025-03-14): **Splitter - Set-Size example buggy / crashes**
  *Symptoms*: ### Description  When I do `api().setSize("a", 10)` I expect the panel to get resized to 10% of the size.  It doesn't do that consistently, just hitting the buttons makes the UI unresponsive.  Additionally: resizing a panel to under 10% and then setting the size to 10% throws an exception that the total is over 100%: this breaks mouseover of the handle since [state.context becomes undefined](https://github.com/chakra-ui/zag/blob/83fa8f67f5bb3459c04087df7a665186c188c445/packages/machines/splitter/src/splitter.connect.ts#L82).   ### Link to Reproduction (or Detailed Explanation)  (video)  ### Steps to Reproduce  https://github.com/chakra-ui/zag/assets/719818/2dd3d1e8-f857-45cd-82f6-40cd8c31f2b7  (Code from https://ark-ui.com/react/docs/components/splitter)  ```ts import { Splitter } from '@ark-ui/solid'  export const RenderProp = () => (   <Splitter.Root     size={[       { id: 'a', size: 50 },       { id: 'b', size: 50 },     ]}   >     <Splitter.Context>       {(api) => (         <>           <Splitter.Panel id="a">             <button type="button" onClick={() => api().setSize('a', 10)}>               Set to 10%             </button>           </Splitter.Panel>           <Splitter.ResizeTrigger id="a:b" />           <Splitter.Panel id="b">             <button type="button" onClick={() => api().setSize('b', 10)}>               Set to 10%             </button>           </Splitter.Panel>         </>       )}     </Splitter.Context>   </Spli
  **Post-Mortem & Fix Analysis**:
  > This issue does mention ArkUI 3.3.0, its really old version per my opinion.
  > Oh? I may try to reproduce it this weekend with current v4.2.0.
  > Hey @segunadebayo  any update on this? We're still encountering this, which is further described in chakra-ui/ark#2967.  Still occurs on the latest version.

- **Issue #884** (2023-09-20): **[ColorPicker] ColorPickerChannelInput for alpha channel resets value to 1 when hex input loses focus**
  *Symptoms*: ### Description  The alpha `ColorPickerChannelInput`, as shown on Ark UI homepage, resets its value to 1 when the hex `ColorPickerChannelInput` loses focus.  The expected result is that the alpha channel input retains its value.  ### Link to Reproduction  https://ark-ui.com/  ### Steps to reproduce  - Go to the color picker at https://ark-ui.com/ - Change the alpha value to anything other than 1 - Click on the hex color input element - Click anywhere except for the `ColorPickerArea` or the slider tracks - The alpha value is reset to 1  ### Ark UI Version  @ark-ui/react@0.14.0  ### Framework  - [X] React - [ ] Solid - [ ] Vue  ### Browser  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Good catch @moxxuk,  I've gone ahead to fix the underlying issue in the state machine.  We'll release an update for Zag and Ark shortly.  If the issue persists after upgrading, I'll re-open it.

- **Issue #885** (2023-09-21): **Dialog closes when a toast is visible and clicked, despite closeOnOutsideClick set to false**
  *Symptoms*: ### Description  When a `toast` is triggered within the `Dialog`, any touch or click with the toast causes the `Dialog` to close, even though the `closeOnOutsideClick` prop is set to false on the Dialog component.  When I trigger a toast within the dialog, I expected the dialog to remain open until I explicitly close it, but it closes unexpectedly upon interacting with the toast.  ### Link to Reproduction  https://codesandbox.io/p/sandbox/elastic-oskar-5vnq2k  ### Steps to reproduce  1. Go to the provided CodeSandbox link. 2. Click on the `Open Dialog` button to open the dialog. 3. Within the dialog, click on the `Add Toast` button to trigger a toast. 4. Click on the toast. 5. Observe that the dialog closes unexpectedly.  ### Ark UI Version  0.14.0  ### Framework  - [X] React - [ ] Solid - [ ] Vue  ### Browser  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > I just pushed a fix for this. We'll release an update shortly.  If the issue persists after upgrading, I'll re-open it.

- **Issue #817** (2023-09-05): **[Dialog] [React] Controlled dialog unexpected behavior**
  *Symptoms*: ### Description  When using the Dialog component in controlled mode without an `onClose` listener and clicking outside the dialog, the visual state is updating even if the `open` property is still true...  The dialog should stay visible until the open property is updated  ### Link to Reproduction  https://codesandbox.io/s/heuristic-wood-fvvg2t?file=/src/App.tsx  ### Steps to reproduce  The dialog is opened by default, and the `open` property is displayed  When clicking outside the dialog, the dialog become hidden, but the `isOpen` state is still `true` Using the render children prop, we can see that the context's isOpen is different from the open property value  ### Ark UI Version  0.13.1  ### Framework  - [X] React - [ ] Solid - [ ] Vue  ### Browser  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for taking your time to report this issue. I move this to `@zag-js` because this needs to be addressed here
  > This is a current limitation of our approach with Zag.js.  The machines are modeled outside of the framework, and we need to avoid bringing in paradigms from React (controlled) since this is not how the DOM works by default. This is also crucial to get it working in other non-React frameworks (Vue, Solid, and even Vanilla JS)  Most properties (like open) are semi-controlled like the DOM and require you to listen to an event to sync it up with your code. For the most part, we recommend adding the onClose and onOpen callbacks to sync the state correctly.  Thanks for understanding.
  > Hi @segunadebayo, thanks for this explanation.  I get this, and it makes perfect sense from a headless/vanillaJS point of view, but this leads to `@ark-ui` changing the React controlled paradigm of  the React version of`@ark-ui`... maybe this issue should go back to the [chakra-ui/ark](https://github.com/chakra-ui/ark) repository? 😅 I think that this paradigm shouldn't be removed from a UI library targeting React...  To allow `@ark-ui` to handle this, maybe it would be possible to provide more granular events to the zag flow: I'm not very familiar with finite state machines, but by quickly reading the `Dialog` code, it seem that calling for the OPEN or TOGGLE action is emitting the `onClose` handler... Wouldn't it be a good idea to create several handlers: the `onClose` event would be triggered by the DOM event(s) and could be prevented the `event.preventDefault()` way, and an `onClosed` event, triggered by entering the "close" state... When not prevented, the default behavior 

- **Issue #758** (2023-08-24): **Checkbox in menu can't be selected**
  *Symptoms*: ### Description  If menu has `closeOnSelect={false}` property then every click happens twice. For radio it works but for checkbox it means it selects and deselects value  ### Link to Reproduction  https://ark-ui.com/docs/solid/components/menu  ### Steps to reproduce  Click on checkbox inside a Menu component  ### Ark UI Version  0.8.1  ### Framework  - [ ] React - [X] Solid - [ ] Vue  ### Browser  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for taking your time to reports this issue. Just moved that to the upstream repository since the issue is related there.

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

### Incident Patch 1: `a1251671` (2026-10-02)
**Commit Message**: fix(utils): compare object keys both ways in isEqual (#3372)

isEqual only walked the second argument's keys, so an object with extra keys compared equal to its subset. Return false when the two objects have a different number of own keys.

**File**: `.changeset/is-equal-symmetric-keys.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+"@zag-js/utils": patch
+---
+
+Fix `isEqual` treating an object as equal to one with extra keys when the extra keys are on the first argument. `memo`
+deps compared this way, so a progress instance whose `formatOptions` were a subset of the previous instance's reused
+that instance's formatter.
```

**File**: `packages/utilities/core/src/equal.ts` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ export const isEqual = (a: any, b: any): boolean => {
   const keys = Object.keys(b ?? Object.create(null))
   const length = keys.length
 
+  if (Object.keys(a).length !== length) return false
+
   for (let i = 0; i < length; i++) {
     const hasKey = Reflect.has(a, keys[i])
     if (!hasKey) return false
```

**File**: `packages/utilities/core/tests/equal.test.ts` (modified, +7/-0)
```diff
@@ -43,4 +43,11 @@ describe("isEqual", () => {
     const arr2 = [{ id: 2 }, { id: 1 }, { id: 3 }]
     expect(isEqual(arr1, arr2)).toBe(false)
   })
+
+  test("should return false when either object has extra keys", () => {
+    const narrow = { style: "percent" }
+    const wide = { style: "percent", maximumFractionDigits: 2 }
+    expect(isEqual(wide, narrow)).toBe(false)
+    expect(isEqual(narrow, wide)).toBe(false)
+  })
 })
```

---

### Incident Patch 2: `636e4ec9` (2026-10-02)
**Commit Message**: fix(toc): report the new value in onActiveChange (#3379)

**File**: `.changeset/toc-active-change-value.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@zag-js/toc": patch
+---
+
+Fix `onActiveChange` reporting the previous `activeIds` and `activeItems`. In controlled mode this kept the TOC stuck on
+the old section when the payload was written back to `activeIds`.
```

**File**: `packages/machines/toc/src/toc.machine.ts` (modified, +9/-13)
```diff
@@ -1,4 +1,4 @@
-import { setup, type Params } from "@zag-js/core"
+import { setup } from "@zag-js/core"
 import { resizeObserverBorderBox } from "@zag-js/dom-query"
 import type { Rect } from "@zag-js/types"
 import { callAll, first, isEqual, last } from "@zag-js/utils"
@@ -29,6 +29,13 @@ export const machine = createMachine({
       activeIds: bindable<string[]>(() => ({
         defaultValue: prop("defaultActiveIds") ?? [],
         value: prop("activeIds"),
+        isEqual,
+        onChange(value) {
+          prop("onActiveChange")?.({
+            activeIds: value,
+            activeItems: prop("items").filter((item) => value.includes(item.value)),
+          })
+        },
       })),
       indicatorRect: bindable<Rect | null>(() => ({
         defaultValue: null,
@@ -73,10 +80,8 @@ export const machine = createMachine({
 
   implementations: {
     actions: {
-      setActiveIds(params) {
-        const { context, event } = params
+      setActiveIds({ context, event }) {
         context.set("activeIds", event.value)
-        invokeOnActiveChange(params)
       },
 
       autoScrollToc({ context, scope, prop }) {
@@ -195,7 +200,6 @@ export const machine = createMachine({
           const currentActiveIds = context.get("activeIds")
           if (!isEqual(currentActiveIds, nextActiveIds)) {
             context.set("activeIds", nextActiveIds)
-            invokeOnActiveChange(params)
           }
         }, observerOptions)
 
@@ -214,11 +218,3 @@ export const machine = createMachine({
     },
   },
 })
-
-function invokeOnActiveChange(params: Params<TocSchema>) {
-  const { context, computed, prop } = params
-  prop("onActiveChange")?.({
-    activeIds: context.get("activeIds"),
-    activeItems: computed("activeItems"),
-  })
-}
```

---

### Incident Patch 3: `66882822` (2026-10-01)
**Commit Message**: fix(popper): only hoist a real z-index onto the positioner (#3344)

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>
Co-authored-by: Segun Adebayo <[REDACTED_EMAIL]>

**File**: `.changeset/popper-positioner-z-index.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@zag-js/popper": patch
+---
+
+Fix popper-based components ignoring a stylesheet `z-index` set on the positioner when the content has no stacking
+level.
```

**File**: `packages/machines/tour/src/tour.connect.ts` (modified, +1/-0)
```diff
@@ -42,6 +42,7 @@ export function connect<T extends PropTypes>(service: TourService, normalize: No
 
   const popperStyles = getPlacementStyles({
     strategy: "absolute",
+    applyStyles: false,
     placement: tooltipPositioned && isTooltipPlacement(placement) ? placement : undefined,
   })
 
```

**File**: `packages/utilities/popper/src/get-placement.ts` (modified, +38/-2)
```diff
@@ -173,6 +173,7 @@ const floatingStyleProps = [
   "--x",
   "--y",
   "--z-index",
+  "z-index",
   "--reference-width",
   "--reference-height",
   "--available-width",
@@ -182,6 +183,33 @@ const floatingStyleProps = [
 
 const arrowStyleProps = ["top", "right", "bottom", "left"]
 
+const managedZIndex = new WeakSet<HTMLElement>()
+
+function syncZIndex(floating: HTMLElement, content: Element) {
+  const inlineZIndex = floating.style.getPropertyValue("z-index")
+  const isManaged = managedZIndex.has(floating)
+  const ownsZIndex = isManaged && inlineZIndex === "var(--z-index)"
+
+  if (isManaged && !ownsZIndex) {
+    managedZIndex.delete(floating)
+  }
+
+  const zIndex = getComputedStyle(content).zIndex
+  if (zIndex === "auto") {
+    if (ownsZIndex) {
+      floating.style.removeProperty("z-index")
+      managedZIndex.delete(floating)
+    }
+    return
+  }
+
+  if (inlineZIndex && !ownsZIndex) return
+
+  floating.style.setProperty("--z-index", zIndex)
+  floating.style.setProperty("z-index", "var(--z-index)")
+  managedZIndex.add(floating)
+}
+
 function createStyleCleanup(el: HTMLElement | null, props: string[]) {
   if (!el) return noop
 
@@ -245,7 +273,15 @@ function getPlacementImpl(
     restoreArrowStyles?.()
 
     cachedMiddlewareFloating = floating
-    restoreFloatingStyles = options.restoreStyles ? createStyleCleanup(floating, floatingStyleProps) : undefined
+    if (options.restoreStyles) {
+      const restoreStyles = createStyleCleanup(floating, floatingStyleProps)
+      restoreFloatingStyles = () => {
+        restoreStyles()
+        managedZIndex.delete(floating)
+      }
+    } else {
+      restoreFloatingStyles = undefined
+    }
     const arrowEl = floating.querySelector<HTMLElement>("[data-part=arrow]")
     restoreArrowStyles = options.restoreStyles ? createStyleCleanup(arrowEl, arrowStyleProps) : undefined
 
@@ -348,7 +384,7 @@ function getPlacementImpl(
     if (!zIndexComputed) {
       const contentEl = floating.firstElementChild
       if (contentEl) {
-        floating.style.setProperty("--z-index", getComputedStyle(contentEl).zIndex)
+        syncZIndex(floating, contentEl)
         zIndexComputed = true
       }
     }
```

**File**: `packages/utilities/popper/src/get-styles.ts` (modified, +3/-3)
```diff
@@ -14,9 +14,9 @@ const ARROW_FLOATING_STYLE = {
 } as const
 
 export function getPlacementStyles(
-  options: Pick<PositioningOptions, "placement" | "sameWidth" | "fitViewport" | "strategy"> = {},
+  options: Pick<PositioningOptions, "placement" | "sameWidth" | "fitViewport" | "strategy" | "applyStyles"> = {},
 ) {
-  const { placement, sameWidth, fitViewport, strategy = "absolute" } = options
+  const { placement, sameWidth, fitViewport, strategy = "absolute", applyStyles = true } = options
 
   return {
     arrow: {
@@ -51,7 +51,7 @@ export function getPlacementStyles(
       left: "0px",
       // move off-screen if placement is not defined
       transform: placement ? "translate3d(var(--x), var(--y), 0)" : "translate3d(0, -100vh, 0)",
-      zIndex: "var(--z-index)",
+      zIndex: applyStyles === false ? "var(--z-index)" : undefined,
     } as const,
   }
 }
```

**File**: `packages/utilities/popper/src/types.ts` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ export interface PositioningOptions {
    */
   restoreStyles?: boolean | undefined
   /**
-   * Whether to apply computed position styles (`--x`, `--y`, `--z-index`) to the floating element.
+   * Whether to apply computed position styles (`--x`, `--y`, `--z-index`, `z-index`) to the floating element.
    * Set to `false` when the consumer applies these from context (e.g. for exit animations).
    * @default true
    */
```

**File**: `packages/utilities/popper/tests/get-placement.test.ts` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+// @vitest-environment jsdom
+
+import { afterEach, describe, expect, test } from "vitest"
+import { getPlacement } from "../src/get-placement"
+
+function setup(contentZIndex: string, positionerZIndex?: string) {
+  const reference = document.createElement("button")
+  const positioner = document.createElement("div")
+  const content = document.createElement("div")
+
+  content.style.zIndex = contentZIndex
+  if (positionerZIndex) positioner.style.zIndex = positionerZIndex
+
+  positioner.append(content)
+  document.body.append(reference, positioner)
+
+  return { positioner, reference }
+}
+
+async function position(reference: HTMLElement, positioner: HTMLElement) {
+  let resolvePositioned!: VoidFunction
+  const positioned = new Promise<void>((resolve) => {
+    resolvePositioned = resolve
+  })
+  const cleanup = getPlacement(reference, positioner, {
+    listeners: false,
+    onComplete() {
+      setTimeout(resolvePositioned)
+    },
+  })
+  await positioned
+  return cleanup
+}
+
+afterEach(() => {
+  document.body.innerHTML = ""
+})
+
+describe("z-index", () => {
+  test.each(["auto", "7"])("preserves a consumer inline value when content is %s", async (contentZIndex) => {
+    const { positioner, reference } = setup(contentZIndex, "777")
+
+    const cleanup = await position(reference, positioner)
+    expect(positioner.style.zIndex).toBe("777")
+    cleanup()
+  })
+
+  test("hoists a concrete content value", async () => {
+    const { positioner, reference } = setup("7")
+
+    const cleanup = await position(reference, positioner)
+    expect(positioner.style.zIndex).toBe("var(--z-index)")
+    expect(positioner.style.getPropertyValue("--z-index")).toBe("7")
+    cleanup()
+  })
+
+  test("removes a stale value owned by popper", async () => {
+    const { positioner, reference } = setup("7")
+
+    const cleanup = await position(reference, positioner)
+    expect(positioner.style.zIndex).toBe("var(--z-index)")
+    cleanup()
+
+    const nextContent = document.createElement("div")
+    nextContent.style.zIndex = "auto"
+    positioner.firstElementChild?.replaceWith(nextContent)
+
+    const cleanupNext = await position(reference, positioner)
+    expect(positioner.style.zIndex).toBe("")
+    cleanupNext()
+  })
+})
```

**File**: `packages/utilities/popper/tests/get-styles.test.ts` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+import { describe, expect, test } from "vitest"
+import { getPlacementStyles } from "../src/get-styles"
+
+describe("getPlacementStyles", () => {
+  test("leaves z-index to runtime positioning by default", () => {
+    expect(getPlacementStyles().floating.zIndex).toBeUndefined()
+  })
+
+  test("consumes the z-index variable when styles are applied manually", () => {
+    expect(getPlacementStyles({ applyStyles: false }).floating.zIndex).toBe("var(--z-index)")
+  })
+})
```

---

### Incident Patch 4: `973921ea` (2026-09-28)
**Commit Message**: fix(carousel): improve mouse drag behavior

**File**: `.changeset/carousel-vue-mouse-drag.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@zag-js/carousel": patch
+---
+
+Fix `allowMouseDrag` advancing a full page per pointer move while preserving smooth release settling in Vue.
```

**File**: `e2e/carousel.e2e.ts` (modified, +6/-1)
```diff
@@ -1,4 +1,4 @@
-import { test } from "@playwright/test"
+import { expect, test } from "@playwright/test"
 import { CarouselModel } from "./models/carousel.model"
 
 let I: CarouselModel
@@ -70,8 +70,13 @@ test.describe("carousel", () => {
 
     await I.swipeCarousel("left", 20, 120, false)
     await I.holdDrag(40)
+    await expect(I.carousel).toHaveCSS("scroll-snap-type", "none")
+
     await I.releaseDrag()
+    await expect(I.carousel).toHaveCSS("scroll-snap-type", "none")
+
     await I.waitForScrollSettle()
+    await expect(I.carousel).toHaveCSS("scroll-snap-type", "x mandatory")
 
     await I.seeIndicatorIsActive(0)
     await I.seeItemInView(0)
```

**File**: `packages/machines/carousel/src/carousel.connect.ts` (modified, +2/-1)
```diff
@@ -20,6 +20,7 @@ export function connect<T extends PropTypes>(service: CarouselService, normalize
 
   const isPlaying = state.matches("autoplay")
   const isDragging = state.matches("dragging")
+  const isSettling = state.matches("settling")
 
   const canScrollNext = computed("canScrollNext")
   const canScrollPrev = computed("canScrollPrev")
@@ -135,7 +136,7 @@ export function connect<T extends PropTypes>(service: CarouselService, normalize
         style: {
           display: autoSize ? "flex" : "grid",
           gap: "var(--slide-spacing)",
-          scrollSnapType: [horizontal ? "x" : "y", prop("snapType")].join(" "),
+          scrollSnapType: isDragging || isSettling ? "none" : [horizontal ? "x" : "y", prop("snapType")].join(" "),
           gridAutoFlow: horizontal ? "column" : "row",
           scrollbarWidth: "none",
           overscrollBehaviorX: "contain",
```

**File**: `packages/machines/carousel/src/carousel.machine.ts` (modified, +0/-14)
```diff
@@ -168,7 +168,6 @@ export const machine = createMachine<CarouselSchema>({
 
     dragging: {
       effects: ["trackPointerMove"],
-      entry: ["disableScrollSnap"],
       on: {
         DRAGGING: {
           actions: ["scrollSlides", "invokeDragging"],
@@ -489,13 +488,6 @@ export const machine = createMachine<CarouselSchema>({
         const index = clampValue(context.get("page"), 0, pageSnapPoints.length - 1)
         context.set("page", index)
       },
-      disableScrollSnap({ scope }) {
-        const el = dom.getItemGroupEl(scope)
-        if (!el) return
-        const styles = getComputedStyle(el)
-        el.dataset.scrollSnapType = styles.getPropertyValue("scroll-snap-type")
-        el.style.setProperty("scroll-snap-type", "none")
-      },
       scrollSlides({ scope, event }) {
         const el = dom.getItemGroupEl(scope)
         el?.scrollBy({ left: event.left, top: event.top, behavior: "instant" })
@@ -523,12 +515,6 @@ export const machine = createMachine<CarouselSchema>({
             top: isHorizontal ? el.scrollTop : closest,
             behavior: "smooth",
           })
-
-          const scrollSnapType = el.dataset.scrollSnapType
-          if (scrollSnapType) {
-            el.style.setProperty("scroll-snap-type", scrollSnapType)
-            delete el.dataset.scrollSnapType
-          }
         })
       },
       focusIndicatorEl({ context, event, scope }) {
```

---

### Incident Patch 5: `b68d1335` (2026-09-28)
**Commit Message**: fix(tabs): only navigate links on user activation (#3368)

Co-authored-by: CrazyBucket <[REDACTED_EMAIL]>

**File**: `.changeset/tabs-link-activation.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@zag-js/tabs": patch
+---
+
+Fix programmatic tab selection triggering link navigation. Keyboard link activation now bubbles and can be canceled by
+application click handlers, and custom navigation prevents the browser's default navigation.
```

**File**: `e2e/tabs-links.e2e.ts` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+import { expect, test, type Page } from "@playwright/test"
+
+async function goto(page: Page, query = "") {
+  await page.goto(`/tabs/with-link${query}`)
+  await expect(page.locator("main.tabs")).toHaveAttribute("data-ready", "true")
+}
+
+test.describe("tabs with links", () => {
+  test.skip(!!process.env.FRAMEWORK && process.env.FRAMEWORK !== "react", "React example")
+
+  test("API selection does not navigate", async ({ page }) => {
+    await goto(page)
+    const url = page.url()
+
+    await page.getByRole("button", { name: "Select Agnes with API" }).click()
+
+    await expect(page.getByTestId("value")).toHaveText("agnes")
+    await expect(page).toHaveURL(url)
+  })
+
+  test("controlled prop changes do not navigate", async ({ page }) => {
+    await goto(page, "?controlled=true")
+    const url = page.url()
+
+    await page.getByRole("button", { name: "Select Joke with prop" }).click()
+
+    await expect(page.getByTestId("value")).toHaveText("joke")
+    await expect(page).toHaveURL(url)
+  })
+
+  test("pointer activation selects and follows the link", async ({ page }) => {
+    await goto(page)
+
+    await page.getByRole("tab").nth(1).click()
+
+    await expect(page.getByTestId("value")).toHaveText("agnes")
+    await expect(page).toHaveURL(/#agnes$/)
+  })
+
+  test("automatic keyboard activation follows the link", async ({ page }) => {
+    await goto(page, "?automatic=true")
+    await page.getByRole("tab").first().focus()
+
+    await page.keyboard.press("ArrowRight")
+
+    await expect(page.getByTestId("value")).toHaveText("agnes")
+    await expect(page).toHaveURL(/#agnes$/)
+  })
+
+  test("automatic keyboard navigation can be canceled", async ({ page }) => {
+    await goto(page, "?automatic=true&native=true&cancel=true")
+    const url = page.url()
+    await page.getByRole("tab").first().focus()
+
+    await page.keyboard.press("ArrowRight")
+
+    await expect(page.getByTestId("value")).toHaveText("agnes")
+    await expect(page).toHaveURL(url)
+  })
+
+  test("manual keyboard navigation follows the link only on Enter", async ({ page }) => {
+    await goto(page, "?native=true")
+    const url = page.url()
+    await page.getByRole("tab").first().focus()
+
+    await page.keyboard.press("ArrowRight")
+    await expect(page.getByTestId("value")).toHaveText("nils")
+    await expect(page).toHaveURL(url)
+
+    await page.keyboard.press("Enter")
+    await expect(page.getByTestId("value")).toHaveText("agnes")
+    await expect(page).toHaveURL(/#agnes$/)
+  })
+})
```

**File**: `examples/next-ts/pages/tabs/with-link.tsx` (modified, +27/-7)
```diff
@@ -2,28 +2,48 @@ import { normalizeProps, useMachine } from "@zag-js/react"
 import { tabsData } from "@zag-js/shared"
 import * as tabs from "@zag-js/tabs"
 import { useRouter } from "next/router"
-import { useId } from "react"
+import { useId, useState } from "react"
 import { StateVisualizer } from "../../components/state-visualizer"
 import { Toolbar } from "../../components/toolbar"
 
 export default function Page() {
-  const router = useRouter()
+  const { query, isReady, push } = useRouter()
+  const [value, setValue] = useState("nils")
 
   const service = useMachine(tabs.machine, {
     id: useId(),
     defaultValue: "nils",
-    activationMode: "manual",
-    navigate(details) {
-      router.push(`#${details.value}`)
+    value: query.controlled ? value : undefined,
+    onValueChange(details) {
+      setValue(details.value)
     },
+    activationMode: query.automatic ? "automatic" : "manual",
+    ...(!query.native && {
+      navigate(details: tabs.NavigateDetails) {
+        push(`#${details.value}`)
+      },
+    }),
   })
 
   const api = tabs.connect(service, normalizeProps)
 
   return (
     <>
-      <main className="tabs">
-        <div {...api.getRootProps()}>
+      <main className="tabs" data-ready={isReady && !service.context.get("ssr")}>
+        <div>
+          <button onClick={() => api.setValue("agnes")}>Select Agnes with API</button>
+          <button onClick={() => setValue("joke")}>Select Joke with prop</button>
+        </div>
+        <p>
+          Selected: <output data-testid="value">{api.value ?? "none"}</output>
+        </p>
+        <div
+          {...api.getRootProps()}
+          onClick={(event) => {
+            if (query.cancel) event.preventDefault()
+          }}
+        >
+          <div {...api.getIndicatorProps()} />
           <div {...api.getListProps()}>
             {tabsData.map((data) => (
               <a href={`#${data.id}`} {...(api.getTriggerProps({ value: data.id }) as any)} key={data.id}>
```

**File**: `packages/machines/tabs/src/tabs.connect.ts` (modified, +15/-6)
```diff
@@ -4,6 +4,7 @@ import {
   dataAttr,
   getEventKey,
   getEventTarget,
+  isAnchorElement,
   isComposingEvent,
   isOpeningInNewTab,
   isSafari,
@@ -24,6 +25,10 @@ export function connect<T extends PropTypes>(service: Service<TabsSchema>, norma
   const isHorizontal = prop("orientation") === "horizontal"
   const composite = prop("composite")
 
+  function sendKeyboardEvent(type: string, key?: string) {
+    send({ type, key, src: "keyboard" })
+  }
+
   function getTriggerState(props: TriggerProps): TriggerState {
     return {
       selected: context.get("value") === props.value,
@@ -90,25 +95,25 @@ export function connect<T extends PropTypes>(service: Service<TabsSchema>, norma
           const keyMap: EventKeyMap = {
             ArrowDown() {
               if (isHorizontal) return
-              send({ type: "ARROW_NEXT", key: "ArrowDown" })
+              sendKeyboardEvent("ARROW_NEXT", "ArrowDown")
             },
             ArrowUp() {
               if (isHorizontal) return
-              send({ type: "ARROW_PREV", key: "ArrowUp" })
+              sendKeyboardEvent("ARROW_PREV", "ArrowUp")
             },
             ArrowLeft() {
               if (isVertical) return
-              send({ type: "ARROW_PREV", key: "ArrowLeft" })
+              sendKeyboardEvent("ARROW_PREV", "ArrowLeft")
             },
             ArrowRight() {
               if (isVertical) return
-              send({ type: "ARROW_NEXT", key: "ArrowRight" })
+              sendKeyboardEvent("ARROW_NEXT", "ArrowRight")
             },
             Home() {
-              send({ type: "HOME" })
+              sendKeyboardEvent("HOME")
             },
             End() {
-              send({ type: "END" })
+              sendKeyboardEvent("END")
             },
           }
 
@@ -168,6 +173,10 @@ export function connect<T extends PropTypes>(service: Service<TabsSchema>, norma
           if (isSafari()) {
             event.currentTarget.focus()
           }
+          const node = event.currentTarget
+          const shouldNavigate = prop("navigate") != null && isAnchorElement(node)
+
+          if (shouldNavigate) event.preventDefault()
           send({ type: "TAB_CLICK", value })
         },
       })
```

**File**: `packages/machines/tabs/src/tabs.machine.ts` (modified, +22/-15)
```diff
@@ -1,5 +1,5 @@
 import { setup } from "@zag-js/core"
-import { clickIfLink, getFocusables, isAnchorElement, raf, resizeObserverBorderBox } from "@zag-js/dom-query"
+import { getFocusables, isAnchorElement, raf, resizeObserverBorderBox } from "@zag-js/dom-query"
 import type { Rect } from "@zag-js/types"
 import { callAll, isEqual } from "@zag-js/utils"
 import * as dom from "./tabs.dom"
@@ -15,9 +15,6 @@ export const machine = createMachine({
       activationMode: "automatic",
       loopFocus: true,
       composite: true,
-      navigate(details) {
-        clickIfLink(details.node)
-      },
       defaultValue: null,
       ...props,
     }
@@ -62,7 +59,7 @@ export const machine = createMachine({
 
   watch({ context, prop, track, action }) {
     track([() => context.get("value")], () => {
-      action(["syncIndicatorAnimation", "syncIndicatorRect", "syncTabIndex", "navigateIfNeeded"])
+      action(["syncIndicatorAnimation", "syncIndicatorRect", "syncTabIndex"])
     })
     track([() => prop("dir"), () => prop("orientation")], () => {
       action(["syncIndicatorRect"])
@@ -100,14 +97,14 @@ export const machine = createMachine({
         },
         TAB_CLICK: {
           target: "focused",
-          actions: ["setFocusedValue", "setValue"],
+          actions: ["setFocusedValue", "setValue", "requestNavigation"],
         },
       },
     },
     focused: {
       on: {
         TAB_CLICK: {
-          actions: ["setFocusedValue", "setValue"],
+          actions: ["setFocusedValue", "setValue", "requestNavigation"],
         },
         ARROW_PREV: [
           {
@@ -162,12 +159,22 @@ export const machine = createMachine({
     },
 
     actions: {
-      selectFocusedTab({ context, prop }) {
+      selectFocusedTab({ context, prop, event, scope }) {
         raf(() => {
           const focusedValue = context.get("focusedValue")
           if (!focusedValue) return
           const nullable = prop("deselectable") && context.get("value") === focusedValue
           const value = nullable ? null : focusedValue
+          if (context.get("value") === value) return
+
+          if (event.src === "keyboard") {
+            const triggerEl = dom.getTriggerEl(scope, focusedValue)
+            if (isAnchorElement(triggerEl) && prop("navigate") !== null) {
+              triggerEl.click()
+              return
+            }
+          }
+
           context.set("value", value)
         })
       },
@@ -309,14 +316,14 @@ export const machine = createMachine({
 
         refs.set("indicatorCleanup", indicatorCleanup)
       },
-      navigateIfNeeded({ context, prop, scope }) {
-        const value = context.get("value")
-        if (!value) return
+      requestNavigation({ event, prop, scope }) {
+        const navigate = prop("navigate")
+        if (!navigate || event.value == null) return
 
-        const triggerEl = dom.getTriggerEl(scope, value)
-        if (isAnchorElement(triggerEl)) {
-          prop("navigate")?.({ value, node: triggerEl, href: triggerEl.href })
-        }
+        const node = dom.getTriggerEl(scope, event.value)
+        if (!isAnchorElement(node)) return
+
+        navigate({ value: event.value, node, href: node.href })
       },
     },
   },
```

**File**: `packages/machines/tabs/src/tabs.types.ts` (modified, +3/-1)
```diff
@@ -119,7 +119,9 @@ export type TabsSchema = {
   action: string
   guard: string
   effect: string
-  event: EventObject
+  event: EventObject & {
+    src?: "keyboard" | "selectNext" | "selectPrev" | undefined
+  }
 }
 
 export type TabsService = Service<TabsSchema>
```

---

### Incident Patch 6: `647e225e` (2026-09-28)
**Commit Message**: fix(core): preserve semicolons in style values (#3360)

Co-authored-by: Segun Adebayo <[REDACTED_EMAIL]>

**File**: `.changeset/merge-props-style-semicolons.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+"@zag-js/core": patch
+"@zag-js/svelte": patch
+---
+
+Fix `mergeProps` truncating inline style values that contain semicolons, including quoted CSS custom properties and data
+URLs.
```

**File**: `packages/core/src/merge-props.ts` (modified, +34/-4)
```diff
@@ -19,14 +19,44 @@ const ownedBy = (...args: (string | undefined)[]) =>
     ),
   ).join(" ")
 
-const CSS_REGEX = /((?:--)?(?:\w+-?)+)\s*:\s*([^;]*)/g
+const CSS_REGEX = /((?:--)?(?:\w+-?)+)\s*:\s*([\s\S]*)/
 
 const serialize = (style: string): Record<string, string> => {
   const res: Record<string, string> = {}
-  let match: RegExpExecArray | null
-  while ((match = CSS_REGEX.exec(style))) {
-    res[match[1]!] = match[2]!
+  const add = (declaration: string) => {
+    const match = CSS_REGEX.exec(declaration)
+    if (match) res[match[1]!] = match[2]!
   }
+  let start = 0
+  let depth = 0
+  let quote = ""
+  let comment = false
+
+  for (let i = 0; i < style.length; i++) {
+    const char = style[i]
+
+    if (comment) {
+      if (char === "*" && style[i + 1] === "/") {
+        comment = false
+        i++
+      }
+    } else if (quote) {
+      if (char === "\\") i++
+      if (char === quote) quote = ""
+    } else if (char === "\\") {
+      i++
+    } else if (char === "/" && style[i + 1] === "*") {
+      comment = true
+      i++
+    } else if (char === '"' || char === "'") quote = char
+    else if (char === "(") depth++
+    else if (char === ")" && depth) depth--
+    else if (char === ";" && !depth) {
+      add(style.slice(start, i))
+      start = i + 1
+    }
+  }
+  add(style.slice(start))
   return res
 }
 
```

**File**: `packages/core/tests/merge-props.test.ts` (modified, +50/-0)
```diff
@@ -18,4 +18,54 @@ describe("mergeProps", () => {
 
     expect(props["data-state"]).toBe("open")
   })
+
+  test("splits a style string on declaration separators", () => {
+    const props = mergeProps({ style: "color: red; margin: 0;" }, { style: { padding: "4px" } })
+
+    expect(props.style).toEqual({ color: "red", margin: "0", padding: "4px" })
+  })
+
+  test("keeps semicolons inside quoted style values", () => {
+    const props = mergeProps({ style: `--label: "a;b"; content: 'c;d'; color: red` }, { style: { display: "block" } })
+
+    expect(props.style).toEqual({ "--label": '"a;b"', content: "'c;d'", color: "red", display: "block" })
+  })
+
+  test("does not end a quoted style value at an escaped quote", () => {
+    const props = mergeProps({ style: 'content: "a\\";b"; color: red' }, { style: { display: "block" } })
+
+    expect(props.style).toEqual({ content: '"a\\";b"', color: "red", display: "block" })
+  })
+
+  test("keeps semicolons inside url() and nested functions", () => {
+    const props = mergeProps(
+      {
+        style: [
+          'background-image: url("data:image/svg+xml;base64,PHN2Zy8+")',
+          "mask-image: url(data:image/png;base64,AAA)",
+          "border-image-source: image-set(url(data:image/png;base64,BBB) 1x)",
+          "color: red",
+        ].join("; "),
+      },
+      { style: { display: "block" } },
+    )
+
+    expect(props.style).toEqual({
+      "background-image": 'url("data:image/svg+xml;base64,PHN2Zy8+")',
+      "mask-image": "url(data:image/png;base64,AAA)",
+      "border-image-source": "image-set(url(data:image/png;base64,BBB) 1x)",
+      color: "red",
+      display: "block",
+    })
+  })
+
+  test("ignores separators inside comments", () => {
+    const props = mergeProps({ style: 'color: red; /* ;(" */ display: block' }, { style: { padding: "4px" } })
+
+    expect(props.style).toEqual({
+      color: "red",
+      display: "block",
+      padding: "4px",
+    })
+  })
 })
```

**File**: `packages/frameworks/svelte/src/merge-props.ts` (modified, +34/-4)
```diff
@@ -1,16 +1,46 @@
 import { mergeProps as zagMergeProps } from "@zag-js/core"
 import { toStyleString } from "./normalize-props"
 
-const CSS_REGEX = /((?:--)?(?:\w+-?)+)\s*:\s*([^;]*)/g
+const CSS_REGEX = /((?:--)?(?:\w+-?)+)\s*:\s*([\s\S]*)/
 
 type CSSObject = Record<string, string>
 
 const serialize = (style: string): CSSObject => {
   const res: Record<string, string> = {}
-  let match: RegExpExecArray | null
-  while ((match = CSS_REGEX.exec(style))) {
-    res[match[1]!] = match[2]!
+  const add = (declaration: string) => {
+    const match = CSS_REGEX.exec(declaration)
+    if (match) res[match[1]!] = match[2]!
   }
+  let start = 0
+  let depth = 0
+  let quote = ""
+  let comment = false
+
+  for (let i = 0; i < style.length; i++) {
+    const char = style[i]
+
+    if (comment) {
+      if (char === "*" && style[i + 1] === "/") {
+        comment = false
+        i++
+      }
+    } else if (quote) {
+      if (char === "\\") i++
+      if (char === quote) quote = ""
+    } else if (char === "\\") {
+      i++
+    } else if (char === "/" && style[i + 1] === "*") {
+      comment = true
+      i++
+    } else if (char === '"' || char === "'") quote = char
+    else if (char === "(") depth++
+    else if (char === ")" && depth) depth--
+    else if (char === ";" && !depth) {
+      add(style.slice(start, i))
+      start = i + 1
+    }
+  }
+  add(style.slice(start))
   return res
 }
 
```

**File**: `packages/frameworks/svelte/tests/merge-props.test.ts` (modified, +11/-0)
```diff
@@ -64,6 +64,17 @@ describe("mergeProps for Svelte", () => {
     expect(propsFromString.style).toBe(result)
   })
 
+  it("keeps semicolons inside quoted values and url() when combining styles", () => {
+    const props = mergeProps(
+      { style: '--label:"a;b";background-image:url("data:image/svg+xml;base64,PHN2Zy8+")' },
+      { style: "mask-image:url(data:image/png;base64,AAA);color:red" },
+    )
+
+    expect(props.style).toBe(
+      '--label:"a;b";background-image:url("data:image/svg+xml;base64,PHN2Zy8+");mask-image:url(data:image/png;base64,AAA);color:red;',
+    )
+  })
+
   it("last value overwrites the event listeners", () => {
     const mockFn = vi.fn()
     const message1 = "click1"
```

---

### Incident Patch 7: `3ff61a2c` (2026-09-28)
**Commit Message**: fix(svelte): keep prop and context readable after the machine stops (#3366)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: Segun Adebayo <[REDACTED_EMAIL]>

**File**: `.changeset/svelte-reads-after-stop.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@zag-js/svelte": patch
+---
+
+Fix `derived_inert` warnings when deferred machine cleanup runs after a Svelte component unmounts.
```

**File**: `packages/frameworks/svelte/src/bindable.svelte.ts` (modified, +5/-4)
```diff
@@ -7,13 +7,14 @@ export function bindable<T>(props: () => BindableParams<T>): Bindable<T> {
   const eq = props().isEqual ?? Object.is
 
   let value = $state(initial)
-  const controlled = $derived(props().value !== undefined)
+  // Avoid a component-owned derived because bindables may be read during deferred cleanup.
+  const controlled = () => props().value !== undefined
 
   let valueRef = { current: untrack(() => value) }
   let prevValue = { current: undefined as T | undefined }
 
   $effect.pre(() => {
-    const v = controlled ? props().value : value
+    const v = controlled() ? props().value : value
     valueRef = { current: v }
     prevValue = { current: v as T }
   })
@@ -25,14 +26,14 @@ export function bindable<T>(props: () => BindableParams<T>): Bindable<T> {
       console.log(`[bindable > ${props().debug}] setValue`, { next, prev })
     }
 
-    if (!controlled) value = next
+    if (!controlled()) value = next
     if (!eq(next, prev)) {
       props().onChange?.(next, prev)
     }
   }
 
   function get(): T {
-    return (controlled ? props().value : value) as T
+    return (controlled() ? props().value : value) as T
   }
 
   return {
```

**File**: `packages/frameworks/svelte/src/machine.svelte.ts` (modified, +5/-3)
```diff
@@ -35,6 +35,8 @@ export function useMachine<T extends MachineSchema>(
   machine: Machine<T>,
   userProps: Partial<T["props"]> | (() => Partial<T["props"]>),
 ): Service<T> {
+  let status = MachineStatus.NotStarted
+
   const scope = $derived.by(() => {
     const { id, ids, getRootNode } = access(userProps) as any
     return createScope({ id, ids, getRootNode })
@@ -45,7 +47,8 @@ export function useMachine<T extends MachineSchema>(
   }
 
   const props: any = $derived(machine.props?.({ props: compact(access(userProps)), scope }) ?? access(userProps))
-  const prop = useProp(() => props)
+  let propsAtStop: any
+  const prop = useProp(() => (status === MachineStatus.Stopped ? propsAtStop : props))
 
   const context: any = machine.context?.({
     prop,
@@ -228,8 +231,6 @@ export function useMachine<T extends MachineSchema>(
     },
   }))
 
-  let status = MachineStatus.NotStarted
-
   onMount(() => {
     const started = status === MachineStatus.Started
     status = MachineStatus.Started
@@ -241,6 +242,7 @@ export function useMachine<T extends MachineSchema>(
     if (status !== MachineStatus.Started) return
 
     debug("unmounting...")
+    propsAtStop = { ...props }
     status = MachineStatus.Stopped
 
     effects.forEach((fn) => fn?.())
```

**File**: `packages/frameworks/svelte/tests/machine.test.ts` (modified, +47/-0)
```diff
@@ -401,6 +401,53 @@ describe("edge cases", () => {
     vi.useRealTimers()
   })
 
+  test("prop and context read after stop return the values at stop", async () => {
+    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
+    let label = "stopped"
+    let value = "controlled"
+    let readAfterStop!: () => unknown[]
+
+    const machine = createMachine<any>({
+      initialState() {
+        return "idle"
+      },
+      states: {
+        idle: {},
+      },
+      context({ bindable, prop }) {
+        return { value: bindable(() => ({ defaultValue: "default", value: prop("value") })) }
+      },
+      exit: ["captureRead"],
+      implementations: {
+        actions: {
+          captureRead({ prop, context }) {
+            readAfterStop = () => [prop("label"), context.get("value")]
+          },
+        },
+      },
+    })
+
+    const { cleanup } = renderMachine(machine, {
+      get label() {
+        return label
+      },
+      get value() {
+        return value
+      },
+    })
+    await Promise.resolve()
+    await cleanup()
+
+    label = "changed"
+    value = "changed"
+    const valuesAtStop = readAfterStop()
+    const warnings = [...warn.mock.calls]
+    warn.mockRestore()
+
+    expect(valuesAtStop).toEqual(["stopped", "controlled"])
+    expect(warnings).toHaveLength(0)
+  })
+
   test("state.matches() helper", async () => {
     const machine = createMachine<any>({
       initialState() {
```

---

### Incident Patch 8: `e5aaacd4` (2026-09-25)
**Commit Message**: fix(image-cropper): ignore setCrop rects with non-finite values

**File**: `packages/machines/image-cropper/src/image-cropper.connect.ts` (modified, +2/-0)
```diff
@@ -14,6 +14,7 @@ import {
   isRightHandle,
   isTopHandle,
   isBottomHandle,
+  isValidRect,
 } from "./utils/crop"
 import { getCropSourceRect, getCropSourcePoints, getImageTransformCss, getNaturalCropSize } from "./utils/transform"
 
@@ -141,6 +142,7 @@ export function connect<T extends PropTypes>(
 
     setCrop(nextCrop) {
       if (fixedCropArea) return
+      if (!isValidRect(nextCrop)) return
       send({ type: "SET_CROP", crop: nextCrop, replaces: "crop" })
     },
 
```

**File**: `packages/machines/image-cropper/src/utils/crop.ts` (modified, +2/-0)
```diff
@@ -714,6 +714,8 @@ export const isSameSize = (a: Size, b: Size): boolean => {
 
 export const isEqualRect = (a: Rect, b: Rect): boolean => a.x === b.x && a.y === b.y && isSameSize(a, b)
 
+export const isValidRect = (rect: Rect): boolean => [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
+
 /* -----------------------------------------------------------------------------
  * Point Utilities
  * ---------------------------------------------------------------------------*/
```

**File**: `packages/machines/image-cropper/tests/crop.test.ts` (modified, +7/-1)
```diff
@@ -1,5 +1,5 @@
 import { describe, expect, test } from "vitest"
-import { clampOffset, computeMoveCrop, computeResizeCrop, constrainCrop } from "../src/utils/crop"
+import { clampOffset, computeMoveCrop, computeResizeCrop, constrainCrop, isValidRect } from "../src/utils/crop"
 
 describe("@zag-js/image-cropper crop utils", () => {
   test("computeMoveCrop keeps the crop inside the viewport", () => {
@@ -60,6 +60,12 @@ describe("@zag-js/image-cropper crop utils", () => {
     })
   })
 
+  test("isValidRect rejects non-finite values", () => {
+    expect(isValidRect({ x: 0, y: 0, width: 100, height: 50 })).toBe(true)
+    expect(isValidRect({ x: Number.NaN, y: 0, width: 100, height: 50 })).toBe(false)
+    expect(isValidRect({ x: 0, y: 0, width: Infinity, height: 50 })).toBe(false)
+  })
+
   test("clampOffset accounts for the rotated image bounds", () => {
     const result = clampOffset({
       zoom: 1,
```

---

### Incident Patch 9: `63c20c2a` (2026-09-25)
**Commit Message**: fix(website): run panda codegen in build, dev and typecheck

Vercel restores node_modules from cache, so pnpm install is a no-op and the
prepare script never runs, leaving styled-system missing.

**File**: `website/package.json` (modified, +3/-4)
```diff
@@ -4,12 +4,11 @@
   "license": "MIT",
   "version": "0.0.0",
   "scripts": {
-    "build": "next build",
-    "dev": "next dev",
+    "build": "panda codegen && next build",
+    "dev": "panda codegen && next dev",
     "start": "next start",
     "lint": "eslint .",
-    "typecheck": "tsc --noEmit",
-    "prepare": "panda codegen",
+    "typecheck": "panda codegen && tsc --noEmit",
     "gen:snippet": "plop snippet",
     "gen:component": "plop component",
     "contributors:add": "all-contributors add",
```

---

### Incident Patch 10: `fca543e9` (2026-09-25)
**Commit Message**: fix(image-cropper): keep aspect ratio on keyboard resize (#3362)

Co-authored-by: Segun Adebayo <[REDACTED_EMAIL]>

**File**: `.changeset/image-cropper-keyboard-aspect-ratio.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@zag-js/image-cropper": patch
+---
+
+Fixed issue where resizing the selection with `Alt+Arrow` ignored `aspectRatio` and `cropShape: "circle"`. Keyboard
+resizing now keeps the ratio, matching handle resizing.
```

**File**: `e2e/image-cropper.e2e.ts` (modified, +35/-0)
```diff
@@ -326,6 +326,29 @@ test.describe("image-cropper / resizable", () => {
     expect(rect.y).toBe(initialRect.y)
   })
 
+  test("[keyboard] should maintain aspect ratio when resizing with Alt+Arrow keys", async () => {
+    await I.controls.num("aspectRatio", "1")
+    await I.wait(100)
+
+    const initialRect = await I.getSelectionRect()
+
+    await I.focusSelection()
+    await I.pressKeyWithModifiers("ArrowLeft", { alt: true, shift: true })
+
+    let rect = await I.getSelectionRect()
+    expect(rect.width).toBe(initialRect.width - 10)
+    expect(rect.height).toBe(rect.width)
+    expect(rect.x).toBe(initialRect.x)
+
+    const prevRect = rect
+    await I.pressKeyWithModifiers("ArrowUp", { alt: true, shift: true })
+
+    rect = await I.getSelectionRect()
+    expect(rect.height).toBe(prevRect.height - 10)
+    expect(rect.width).toBe(rect.height)
+    expect(rect.y).toBe(prevRect.y)
+  })
+
   test("[keyboard] should use larger step with shift modifier when resizing", async () => {
     const initialRect = await I.getSelectionRect()
 
@@ -814,6 +837,18 @@ test.describe("image-cropper / circle", () => {
 
     expect(newRect.width).toEqual(newRect.height)
   })
+
+  test("should keep the crop area in 1:1 aspect ratio when resizing with the keyboard", async () => {
+    const initialRect = await I.getSelectionRect()
+
+    await I.focusSelection()
+    await I.pressKeyWithModifiers("ArrowLeft", { alt: true, shift: true })
+
+    const newRect = await I.getSelectionRect()
+
+    expect(newRect.width).toBe(initialRect.width - 10)
+    expect(newRect.height).toEqual(newRect.width)
+  })
 })
 
 test.describe("image-cropper / viewport resize", () => {
```

**File**: `packages/machines/image-cropper/src/image-cropper.machine.ts` (modified, +10/-2)
```diff
@@ -11,7 +11,6 @@ import {
   clampOffset,
   clampPoint,
   computeDefaultCropDimensions,
-  computeKeyboardCrop,
   computeMoveCrop,
   computeResizeCrop,
   getCenterPoint,
@@ -696,8 +695,17 @@ export const machine = createMachine<ImageCropperSchema>({
 
         const step = getNudgeStep(prop, { shiftKey, ctrlKey, metaKey })
         const { minSize, maxSize } = getCropSizeLimits(prop)
+        const aspectRatio = resolveCropAspectRatio(prop("cropShape"), prop("aspectRatio"))
 
-        const nextCrop = computeKeyboardCrop(key, handlePosition, step, crop, viewportRect, minSize, maxSize)
+        const nextCrop = computeResizeCrop({
+          cropStart: crop,
+          handlePosition,
+          delta: getKeyboardMoveDelta(key, step),
+          viewportRect,
+          minSize,
+          maxSize,
+          aspectRatio,
+        })
 
         context.set("crop", nextCrop)
       },
```

**File**: `packages/machines/image-cropper/src/utils/crop.ts` (modified, +0/-160)
```diff
@@ -543,166 +543,6 @@ export function clampOffset(params: ClampOffsetParams): Point {
   return clampPoint(offset, minPoint, maxPoint)
 }
 
-/* -----------------------------------------------------------------------------
- * Keyboard Crop Utilities
- * ---------------------------------------------------------------------------*/
-
-const expandLeft = (crop: Rect, step: number, maxWidth: number): { x: number; width: number } => {
-  const newX = max(0, crop.x - step)
-  const newWidth = crop.width + (crop.x - newX)
-  if (newWidth <= maxWidth) {
-    return { x: newX, width: newWidth }
-  }
-  return { x: crop.x + crop.width - maxWidth, width: maxWidth }
-}
-
-const expandTop = (crop: Rect, step: number, maxHeight: number): { y: number; height: number } => {
-  const newY = max(0, crop.y - step)
-  const newHeight = crop.height + (crop.y - newY)
-  if (newHeight <= maxHeight) {
-    return { y: newY, height: newHeight }
-  }
-  return { y: crop.y + crop.height - maxHeight, height: maxHeight }
-}
-
-const shrinkFromLeft = (crop: Rect, step: number, minWidth: number): { x: number; width: number } => {
-  const newX = min(crop.x + step, crop.x + crop.width - minWidth)
-  return { x: newX, width: crop.width - (newX - crop.x) }
-}
-
-const shrinkFromTop = (crop: Rect, step: number, minHeight: number): { y: number; height: number } => {
-  const newY = min(crop.y + step, crop.y + crop.height - minHeight)
-  return { y: newY, height: crop.height - (newY - crop.y) }
-}
-
-export function computeKeyboardCrop(
-  key: string,
-  handlePosition: HandlePosition,
-  step: number,
-  crop: Rect,
-  viewportRect: Size,
-  minSize: Size,
-  maxSize: Size,
-): Rect {
-  const nextCrop = { ...crop }
-
-  const { minWidth, minHeight, maxWidth, maxHeight } = resolveSizeLimits({
-    minSize,
-    maxSize,
-    viewportSize: viewportRect,
-  })
-
-  const isCorner = isCornerHandle(handlePosition)
-
-  if (key === "ArrowLeft") {
-    if (isLeftHandle(handlePosition)) {
-      const expanded = expandLeft(crop, step, maxWidth)
-      nextCrop.x = expanded.x
-      nextCrop.width = expanded.width
-
-      if (isCorner && isTopHandle(handlePosition)) {
-        const expandedY = expandTop(crop, step, maxHeight)
-        nextCrop.y = expandedY.y
-        nextCrop.height = expandedY.height
-      } else if (isCorner && isBottomHandle(handlePosition)) {
-        const newHeight = nextCrop.height + step
-        nextCrop.height = min(viewportRect.height - nextCrop.y, min(maxHeight, newHeight))
-      }
-    } else if (isRightHandle(handlePosition)) {
-      nextCrop.width = max(minWidth, nextCrop.width - step)
-
-      if (isCorner && isTopHandle(handlePosition)) {
-        const shrunk = shrinkFromTop(crop, step, minHeight)
-        nextCrop.y = shrunk.y
-        nextCrop.height = shrunk.height
-      } else if (isCorner && isBottomHandle(handlePosition)) {
-        nextCrop.height = max(minHeight, nextCrop.height - step)
-      }
-    }
-  } else if (key === "ArrowRight") {
-    if (isLeftHandle(handlePosition)) {
-      const shrunk = shrinkFromLeft(crop, step, minWidth)
-      nextCrop.x = shrunk.x
-      nextCrop.width = shrunk.width
-
-      if (isCorner && isTopHandle(handlePosition)) {
-        const shrunkY = shrinkFromTop(crop, step, minHeight)
-        nextCrop.y = shrunkY.y
-        nextCrop.height = shrunkY.height
-      } else if (isCorner && isBottomHandle(handlePosition)) {
-        nextCrop.height = max(minHeight, nextCrop.height - step)
-      }
-    } else if (isRightHandle(handlePosition)) {
-      const newWidth = nextCrop.width + step
-      nextCrop.width = min(viewportRect.width - nextCrop.x, min(maxWidth, newWidth))
-
-      if (isCorner && isTopHandle(handlePosition)) {
-        const expanded = expandTop(crop, step, maxHeight)
-        nextCrop.y = expanded.y
-        nextCrop.height = expanded.height
-      } else if (isCorner && isBottomHandle(handlePosition)) {
-        const newHeight = nextCrop.height + step
-        nextCrop.height = min(viewportRect.height - nextCrop.y, min(maxHeight, newHeight))
-      }
-    }
-  }
-
-  if (key === "ArrowUp") {
-    if (isTopHandle(handlePosition)) {
-      const expanded = expandTop(crop, step, maxHeight)
-      nextCrop.y = expanded.y
-      nextCrop.height = expanded.height
-
-      if (isCorner && isLeftHandle(handlePosition)) {
-        const expandedX = expandLeft(crop, step, maxWidth)
-        nextCrop.x = expandedX.x
-        nextCrop.width = expandedX.width
-      } else if (isCorner && isRightHandle(handlePosition)) {
-        const newWidth = nextCrop.width + step
-        nextCrop.width = min(viewportRect.width - nextCrop.x, min(maxWidth, newWidth))
-      }
-    } else if (isBottomHandle(handlePosition)) {
-      nextCrop.height = max(minHeight, nextCrop.height - step)
-
-      if (isCorner && isLeftHandle(handlePosition)) {
-        const shrunk = shrinkFromLeft(crop, step, minWidth)
-        nextCrop.x = shrunk.x
-        nextCrop.width = shrunk.width
-
```

---

### Incident Patch 11: `53327acb` (2026-09-18)
**Commit Message**: fix(splitter): skip redundant global cursor style write on pointer move (#3353)

**File**: `.changeset/splitter-cursor-style-rewrite.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@zag-js/splitter": patch
+---
+
+Fix slow dragging in large documents. The global cursor style was rewritten on every pointer move, forcing a
+document-wide style recalculation each time. It is now only written when the cursor actually changes.
```

**File**: `packages/machines/splitter/src/splitter.dom.ts` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ export const setupGlobalCursor = (ctx: Scope, state: CursorState, x: boolean, no
   const styleEl = getGlobalCursorEl(ctx)
   const textContent = `* { cursor: ${getCursor(state, x)} !important; }`
   if (styleEl) {
-    styleEl.textContent = textContent
+    if (styleEl.textContent !== textContent) styleEl.textContent = textContent
   } else {
     const style = ctx.getDoc().createElement("style")
     if (nonce) style.nonce = nonce
```

**File**: `packages/machines/splitter/src/utils/registry.ts` (modified, +1/-1)
```diff
@@ -251,7 +251,7 @@ export class SplitterRegistry {
     let styleEl = doc.getElementById(this.globalCursorId) as HTMLStyleElement | null
     const textContent = `* { cursor: ${cursor} !important; }`
     if (styleEl) {
-      styleEl.textContent = textContent
+      if (styleEl.textContent !== textContent) styleEl.textContent = textContent
     } else {
       styleEl = doc.createElement("style")
       styleEl.id = this.globalCursorId
```

---

### Incident Patch 12: `ef6b822e` (2026-09-17)
**Commit Message**: fix(hotkeys): ignore key events without a usable key (#3351)

A store listening on `document` receives every event dispatched at that target, not just KeyboardEvents. An event without a string `key` reached `normalizeKey`, which dereferences it immediately, throwing an uncaught TypeError out of the listener.

Such events are now ignored on both the keydown and keyup paths.

**File**: `.changeset/hotkeys-invalid-key-events.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@zag-js/hotkeys": patch
+---
+
+Fix an unhandled `TypeError` when a `keyup` event without a valid `key` is dispatched at `document`. Events without a
+string `key` are now ignored instead of crashing the handler.
```

**File**: `packages/utilities/hotkeys/src/store.ts` (modified, +3/-0)
```diff
@@ -520,6 +520,8 @@ export class HotkeyStore {
   }
 
   private handleKeyUp(event: KeyboardEvent, capture: boolean): void {
+    if (typeof event.key !== "string" || event.key.length === 0) return
+
     // Execute keyup commands BEFORE removing the key from pressed state
     if (this.hasKeyupCommands) {
       this.executeMatchingCommands(event, capture, "keyup")
@@ -546,6 +548,7 @@ export class HotkeyStore {
   }
 
   private executeMatchingCommands(event: KeyboardEvent, capture: boolean, eventType: "keydown" | "keyup"): void {
+    if (typeof event.key !== "string" || event.key.length === 0) return
     if (event.key === "Dead") return
 
     const eventKey = normalizeKey(event.key)
```

**File**: `packages/utilities/hotkeys/tests/store.test.ts` (modified, +61/-0)
```diff
@@ -13,6 +13,67 @@ describe("HotkeyStore", () => {
     vi.unstubAllGlobals()
   })
 
+  describe.each([true, false])("invalid events (capture: %s)", (capture) => {
+    it.each(["keydown", "keyup"] as const)("ignores invalid keys with %s commands", (eventType) => {
+      const store = createHotkeyStore({ target: document })
+      const action = vi.fn()
+      const onError = vi.fn((event: ErrorEvent) => event.preventDefault())
+      window.addEventListener("error", onError)
+      store.register({ id: "f", hotkey: "f", action, options: { capture, eventType, requireReset: true } })
+
+      const dispatchKey = (type: string) =>
+        document.dispatchEvent(new KeyboardEvent(type, { key: "f", code: "KeyF", bubbles: true }))
+
+      try {
+        dispatchKey("keydown")
+        const calls = action.mock.calls.length
+
+        for (const type of ["keydown", "keyup"]) {
+          document.dispatchEvent(new Event(type, { bubbles: true }))
+          for (const key of [undefined, null, 42, ""]) {
+            const event = new KeyboardEvent(type, { code: "KeyF", bubbles: true })
+            Object.defineProperty(event, "key", { value: key })
+            document.dispatchEvent(event)
+          }
+        }
+
+        expect(onError).not.toHaveBeenCalled()
+        expect(action).toHaveBeenCalledTimes(calls)
+        expect(store.getCurrentlyPressed()).toEqual(["F"])
+        expect(store.getPressedCodes()).toEqual(["KeyF"])
+
+        // Invalid keyup events must not reset commands that require a real release.
+        dispatchKey("keydown")
+        expect(action).toHaveBeenCalledTimes(calls)
+        dispatchKey("keyup")
+        expect(store.getCurrentlyPressed()).toEqual([])
+        expect(store.getPressedCodes()).toEqual([])
+        expect(action).toHaveBeenCalledTimes(1)
+
+        dispatchKey("keydown")
+        dispatchKey("keyup")
+        expect(action).toHaveBeenCalledTimes(2)
+      } finally {
+        store.destroy()
+        window.removeEventListener("error", onError)
+      }
+    })
+
+    it("still accepts the space key", () => {
+      const store = createHotkeyStore({ target: document })
+      const action = vi.fn()
+      store.register({ id: "space", hotkey: "Space", action, options: { capture } })
+      try {
+        document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true }))
+        expect(action).toHaveBeenCalledTimes(1)
+        document.dispatchEvent(new KeyboardEvent("keyup", { key: " ", code: "Space", bubbles: true }))
+        expect(store.getCurrentlyPressed()).toEqual([])
+      } finally {
+        store.destroy()
+      }
+    })
+  })
+
   describe("default options", () => {
     it("applies store-level default options during registration", () => {
       const store = createHotkeyStore({
```

---

### Incident Patch 13: `dae9054a` (2026-09-17)
**Commit Message**: fix(tour): re-resolve step targets and follow layout changes (#3341)

Resolves a step's target on every position update, so a target replaced while its step is open no longer collapses the card, spotlight and backdrop cut-out.

Measures the backdrop boundary while a tooltip step is open, so a page that grows after the tour mounts stays fully dimmed.

Animates the spotlight only when moving between steps; resize, scroll and first appearance now snap.

**File**: `.changeset/tour-reresolve-target.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+"@zag-js/tour": patch
+---
+
+Fix a step staying anchored to its original element after that element is replaced. The target was
+resolved once, when the step opened, so a layout that swaps the node while the tour is running — a
+sticky header moving its buttons into a portal, a responsive branch — left the machine pointing at a
+detached node. A detached node measures zero, which collapses the step's card, its spotlight and the
+backdrop's cut-out into the top-left corner of the page. The target is now resolved on every
+position update.
```

**File**: `.changeset/tour-visual-viewport-global.md` (modified, +4/-3)
```diff
@@ -2,6 +2,7 @@
 "@zag-js/tour": patch
 ---
 
-Fix a `ReferenceError` when a tour mounts in an environment without a global `visualViewport`, such as
-jsdom. The boundary size was read from the bare global instead of the scope's window, and optional
-chaining does not guard an undeclared identifier.
+- Fix the backdrop leaving part of the page undimmed, and the spotlight sliding to its new position, when the window
+  resizes or content loads in. The spotlight now only animates between steps.
+- Fix tours in an iframe or custom root measuring the outer page, and crashing on mount in environments without
+  `visualViewport`, such as jsdom.
```

**File**: `e2e/tour.e2e.ts` (modified, +39/-0)
```diff
@@ -117,3 +117,42 @@ test.describe("tour", () => {
     expect(selection).toContain("Step 1")
   })
 })
+
+test.describe("tour / replaced target", () => {
+  test.beforeEach(async ({ page }) => {
+    I = new TourModel(page)
+    await page.goto("/tour/replaced-target")
+  })
+
+  test("should follow a target that is replaced while its step is open", async ({ page }) => {
+    await I.clickStart()
+    await I.seeSpotlight()
+
+    const originalRect = await I.getTargetRect()
+
+    // dispatched rather than clicked: the tour dims the page, so the backdrop is what a real click
+    // would land on. In an app the swap is not a click at all — a sticky header does it on scroll.
+    await page.getByRole("button", { name: "Replace target" }).dispatchEvent("click")
+
+    // the highlight moves to the element now carrying the target, and nothing is left on the old one
+    await expect(page.locator("[data-tour-highlighted]")).toHaveCount(1)
+    await expect(page.getByRole("heading", { name: "Replacement target" })).toHaveAttribute(
+      "data-tour-highlighted",
+      "",
+    )
+
+    // and the spotlight follows it rather than staying on a node that has left the document.
+    // Polled, because the position is recomputed asynchronously, on the next update.
+    await expect
+      .poll(async () => {
+        const targetRect = await I.getTargetRect()
+        const spotlightRect = await I.getSpotlightRect()
+        return (
+          targetRect.y !== originalRect.y &&
+          spotlightRect.width > targetRect.width &&
+          spotlightRect.height > targetRect.height
+        )
+      })
+      .toBe(true)
+  })
+})
```

**File**: `examples/next-ts/pages/tour/layout-shift.tsx` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+import { tourLayoutShiftData } from "@zag-js/shared"
+import { Portal, normalizeProps, useMachine } from "@zag-js/react"
+import * as tour from "@zag-js/tour"
+import { useId, useState } from "react"
+
+export default function Page() {
+  const [wide, setWide] = useState(false)
+  const [expanded, setExpanded] = useState(false)
+
+  const service = useMachine(tour.machine, { id: useId(), steps: tourLayoutShiftData })
+  const api = tour.connect(service, normalizeProps)
+
+  return (
+    <>
+      <style jsx global>
+        {layoutShiftStyles}
+      </style>
+
+      <main className="tour layout-shift">
+        <button onClick={() => api.start()}>Start tour</button>
+
+        <div className="targets">
+          <button id="layout-target" data-wide={wide || undefined}>
+            First target
+          </button>
+          <button id="other-target" data-wide={wide || undefined}>
+            Second target
+          </button>
+        </div>
+
+        <div className="filler" data-expanded={expanded || undefined}>
+          {expanded ? "Extra content is in the page." : "Use the tour controls to shift the layout."}
+        </div>
+      </main>
+
+      {api.open && (
+        <Portal>
+          <div {...api.getBackdropProps()} />
+          <div {...api.getSpotlightProps()} />
+          <div {...api.getPositionerProps()}>
+            <div {...api.getContentProps()}>
+              <p {...api.getTitleProps()}>{api.step?.title}</p>
+              <div {...api.getDescriptionProps()}>{api.step?.description}</div>
+
+              <div className="tour button__group">
+                <button onClick={() => setWide((value) => !value)}>Resize target</button>
+                <button onClick={() => setExpanded((value) => !value)}>Toggle extra content</button>
+                {api.step?.actions?.map((action) => (
+                  <button key={action.label} {...api.getActionTriggerProps({ action })}>
+                    {action.label}
+                  </button>
+                ))}
+              </div>
+
+              <button {...api.getCloseTriggerProps()}>
+                <span aria-hidden="true">×</span>
+              </button>
+            </div>
+          </div>
+        </Portal>
+      )}
+    </>
+  )
+}
+
+// A fixed-height root that gains overflow — the layout change a ResizeObserver cannot see.
+const layoutShiftStyles = `
+  html { height: 100%; }
+  body { min-height: 100%; }
+  body, .page, .page main { overflow: visible; }
+  .page { height: auto; min-height: 100vh; }
+  .page main { display: block; }
+  .nav { flex-shrink: 0; height: 100vh; }
+
+  .layout-shift { padding: 40px; }
+  .layout-shift .targets { display: flex; gap: 80px; margin-top: 40px; }
+  .layout-shift .targets button { width: 160px; }
+  .layout-shift .targets button[data-wide] { width: 280px; }
+  .layout-shift .filler { height: 100px; padding-top: 40px; }
+  .layout-shift .filler[data-expanded] { height: 2000px; }
+`
```

**File**: `examples/next-ts/pages/tour/replaced-target.tsx` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+import { Portal, normalizeProps, useMachine } from "@zag-js/react"
+import * as tour from "@zag-js/tour"
+import { X } from "lucide-react"
+import { useId, useState } from "react"
+import { StateVisualizer } from "../../components/state-visualizer"
+import { Toolbar } from "../../components/toolbar"
+
+const steps: tour.StepDetails[] = [
+  {
+    id: "step-1",
+    type: "tooltip",
+    title: "Step 1",
+    description: "This step follows its target, even when the page replaces the element.",
+    target: () => document.querySelector<HTMLElement>("#target"),
+    actions: [{ label: "Done", action: "dismiss" }],
+  },
+]
+
+export default function Page() {
+  const [replaced, setReplaced] = useState(false)
+
+  const service = useMachine(tour.machine, { id: useId(), steps })
+  const api = tour.connect(service, normalizeProps)
+
+  return (
+    <>
+      <main className="tour">
+        <div>
+          <button onClick={() => api.start()}>Start Tour</button>
+          <button onClick={() => setReplaced(true)}>Replace target</button>
+
+          <div className="steps__container">
+            {/* The same target, carried by one node or the other — what a sticky header does when it
+                moves its buttons into a portal on scroll. */}
+            {!replaced && <h3 id="target">Original target</h3>}
+            <div className="h-200px" />
+            {replaced && <h3 id="target">Replacement target</h3>}
+          </div>
+        </div>
+
+        {api.step && api.open && (
+          <Portal>
+            {api.step.backdrop && <div {...api.getBackdropProps()} />}
+            <div {...api.getSpotlightProps()} />
+            <div {...api.getPositionerProps()}>
+              <div {...api.getContentProps()}>
+                {api.step.arrow && (
+                  <div {...api.getArrowProps()}>
+                    <div {...api.getArrowTipProps()} />
+                  </div>
+                )}
+
+                <p {...api.getTitleProps()}>{api.step.title}</p>
+                <div {...api.getDescriptionProps()}>{api.step.description}</div>
+
+                <div className="tour button__group">
+                  {api.step.actions?.map((action) => (
+                    <button key={action.label} {...api.getActionTriggerProps({ action })}>
+                      {action.label}
+                    </button>
+                  ))}
+                </div>
+
+                <button {...api.getCloseTriggerProps()}>
+                  <X />
+                </button>
+              </div>
+            </div>
+          </Portal>
+        )}
+      </main>
+
+      <Toolbar viz>
+        <StateVisualizer state={service} />
+      </Toolbar>
+    </>
+  )
+}
```

**File**: `examples/nuxt-ts/app/pages/tour/layout-shift.vue` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+<script setup lang="ts">
+import { tourLayoutShiftData } from "@zag-js/shared"
+import * as tour from "@zag-js/tour"
+import { normalizeProps, useMachine } from "@zag-js/vue"
+import { computed, ref, useId } from "vue"
+
+const wide = ref(false)
+const expanded = ref(false)
+
+const service = useMachine(tour.machine, { id: useId(), steps: tourLayoutShiftData })
+const api = computed(() => tour.connect(service, normalizeProps))
+</script>
+
+<template>
+  <main class="tour layout-shift">
+    <button @click="api.start()">Start tour</button>
+
+    <div class="targets">
+      <button id="layout-target" :data-wide="wide || undefined">First target</button>
+      <button id="other-target" :data-wide="wide || undefined">Second target</button>
+    </div>
+
+    <div class="filler" :data-expanded="expanded || undefined">
+      {{ expanded ? "Extra content is in the page." : "Use the tour controls to shift the layout." }}
+    </div>
+  </main>
+
+  <Teleport to="#teleports" v-if="api.open">
+    <div v-bind="api.getBackdropProps()" />
+    <div v-bind="api.getSpotlightProps()" />
+    <div v-bind="api.getPositionerProps()">
+      <div v-bind="api.getContentProps()">
+        <p v-bind="api.getTitleProps()">{{ api.step?.title }}</p>
+        <div v-bind="api.getDescriptionProps()">{{ api.step?.description }}</div>
+
+        <div class="tour button__group">
+          <button @click="wide = !wide">Resize target</button>
+          <button @click="expanded = !expanded">Toggle extra content</button>
+          <button
+            v-for="action in api.step?.actions"
+            :key="action.label"
+            v-bind="api.getActionTriggerProps({ action })"
+          >
+            {{ action.label }}
+          </button>
+        </div>
+
+        <button v-bind="api.getCloseTriggerProps()">
+          <span aria-hidden="true">×</span>
+        </button>
+      </div>
+    </div>
+  </Teleport>
+</template>
+
+<!-- A fixed-height root that gains overflow — the layout change a ResizeObserver cannot see. -->
+<style>
+html {
+  height: 100%;
+}
+body {
+  min-height: 100%;
+}
+body,
+.page,
+.page main {
+  overflow: visible;
+}
+.page {
+  height: auto;
+  min-height: 100vh;
+}
+.page main {
+  display: block;
+}
+.nav {
+  flex-shrink: 0;
+  height: 100vh;
+}
+
+.layout-shift {
+  padding: 40px;
+}
+.layout-shift .targets {
+  display: flex;
+  gap: 80px;
+  margin-top: 40px;
+}
+.layout-shift .targets button {
+  width: 160px;
+}
+.layout-shift .targets button[data-wide] {
+  width: 280px;
+}
+.layout-shift .filler {
+  height: 100px;
+  padding-top: 40px;
+}
+.layout-shift .filler[data-expanded] {
+  height: 2000px;
+}
+</style>
```

**File**: `examples/solid-ts/src/routes/tour/layout-shift.tsx` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+import { tourLayoutShiftData } from "@zag-js/shared"
+import { normalizeProps, useMachine } from "@zag-js/solid"
+import * as tour from "@zag-js/tour"
+import { For, Show, createMemo, createSignal, createUniqueId } from "solid-js"
+import { Portal } from "solid-js/web"
+
+export default function Page() {
+  const [wide, setWide] = createSignal(false)
+  const [expanded, setExpanded] = createSignal(false)
+
+  const service = useMachine(tour.machine, { id: createUniqueId(), steps: tourLayoutShiftData })
+  const api = createMemo(() => tour.connect(service, normalizeProps))
+
+  return (
+    <>
+      <style>{layoutShiftStyles}</style>
+
+      <main class="tour layout-shift">
+        <button onClick={() => api().start()}>Start tour</button>
+
+        <div class="targets">
+          <button id="layout-target" data-wide={wide() || undefined}>
+            First target
+          </button>
+          <button id="other-target" data-wide={wide() || undefined}>
+            Second target
+          </button>
+        </div>
+
+        <div class="filler" data-expanded={expanded() || undefined}>
+          {expanded() ? "Extra content is in the page." : "Use the tour controls to shift the layout."}
+        </div>
+      </main>
+
+      <Show when={api().open}>
+        <Portal>
+          <div {...api().getBackdropProps()} />
+          <div {...api().getSpotlightProps()} />
+          <div {...api().getPositionerProps()}>
+            <div {...api().getContentProps()}>
+              <p {...api().getTitleProps()}>{api().step?.title}</p>
+              <div {...api().getDescriptionProps()}>{api().step?.description}</div>
+
+              <div class="tour button__group">
+                <button onClick={() => setWide((value) => !value)}>Resize target</button>
+                <button onClick={() => setExpanded((value) => !value)}>Toggle extra content</button>
+                <For each={api().step?.actions}>
+                  {(action) => <button {...api().getActionTriggerProps({ action })}>{action.label}</button>}
+                </For>
+              </div>
+
+              <button {...api().getCloseTriggerProps()}>
+                <span aria-hidden="true">×</span>
+              </button>
+            </div>
+          </div>
+        </Portal>
+      </Show>
+    </>
+  )
+}
+
+// A fixed-height root that gains overflow — the layout change a ResizeObserver cannot see.
+const layoutShiftStyles = `
+  html { height: 100%; }
+  body { min-height: 100%; }
+  body, .page, .page main { overflow: visible; }
+  .page { height: auto; min-height: 100vh; }
+  .page main { display: block; }
+  .nav { flex-shrink: 0; height: 100vh; }
+
+  .layout-shift { padding: 40px; }
+  .layout-shift .targets { display: flex; gap: 80px; margin-top: 40px; }
+  .layout-shift .targets button { width: 160px; }
+  .layout-shift .targets button[data-wide] { width: 280px; }
+  .layout-shift .filler { height: 100px; padding-top: 40px; }
+  .layout-shift .filler[data-expanded] { height: 2000px; }
+`
```

**File**: `packages/machines/tour/src/tour.connect.ts` (modified, +3/-0)
```diff
@@ -36,6 +36,7 @@ export function connect<T extends PropTypes>(service: TourService, normalize: No
   const placement = context.get("currentPlacement")
   const placementSide = isTooltipPlacement(placement) ? getPlacementSide(placement) : undefined
   const targetRect = context.get("targetRect")
+  const suppressTransition = context.get("suppressSpotlightTransition")
   const floatingOffset = context.get("floatingOffset")
   const tooltipPositioned = isTooltipStep(step) && floatingOffset != null
 
@@ -158,6 +159,8 @@ export function connect<T extends PropTypes>(service: TourService, normalize: No
           top: "var(--spotlight-y)",
           borderRadius: toPx(prop("spotlightRadius")),
           pointerEvents: "none",
+          transitionDuration: suppressTransition ? "0ms" : undefined,
+          transitionDelay: suppressTransition ? "0ms" : undefined,
         },
       })
     },
```

---

### Incident Patch 14: `a34b233d` (2026-09-16)
**Commit Message**: fix(tour): read visualViewport from the scope's window (#3340)

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `.changeset/tour-visual-viewport-global.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+"@zag-js/tour": patch
+---
+
+Fix a `ReferenceError` when a tour mounts in an environment without a global `visualViewport`, such as
+jsdom. The boundary size was read from the bare global instead of the scope's window, and optional
+chaining does not guard an undeclared identifier.
```

**File**: `packages/machines/tour/src/tour.machine.ts` (modified, +1/-1)
```diff
@@ -432,7 +432,7 @@ export const machine = createMachine<TourSchema>({
         const doc = scope.getDoc()
 
         const onResize = () => {
-          const width = visualViewport?.width ?? win.innerWidth
+          const width = win.visualViewport?.width ?? win.innerWidth
           const height = doc.documentElement.scrollHeight
           context.set("boundarySize", { width, height })
         }
```

---

### Incident Patch 15: `8a204a33` (2026-09-16)
**Commit Message**: fix(focus-visible): guard the prototype focus read (#3343)

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>
Co-authored-by: Segun Adebayo <[REDACTED_EMAIL]>

**File**: `.changeset/focus-visible-prototype-patch.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+"@zag-js/focus-visible": patch
+---
+
+Fix `Illegal invocation` thrown during setup when another tool has replaced `HTMLElement.prototype.focus` with an
+accessor that dereferences `this`. The throw escaped the machine's effect setup, taking the remaining effects down with
+it.
```

**File**: `packages/utilities/focus-visible/src/index.ts` (modified, +46/-31)
```diff
@@ -72,7 +72,8 @@ let currentModality: Modality | null = null
 let changeHandlers = new Set<Handler>()
 
 interface GlobalListenerData {
-  focus: VoidFunction
+  /** Unset when the prototype's `focus` could not be read, so there is nothing to restore. */
+  focus: VoidFunction | undefined
 }
 
 export let listenerMap = new Map<Window, GlobalListenerData>()
@@ -187,6 +188,39 @@ function handleWindowBlur() {
   hasBlurredWindowRecently = true
 }
 
+/**
+ * Patch `HTMLElement.prototype.focus` to mark focus as programmatic, and return the native method
+ * for teardown to restore. Returns `undefined` when the patch could not be applied - the read itself
+ * can throw when tooling has replaced `focus` with an accessor that dereferences `this` (Storybook's
+ * instrumenter does), and losing the patch must not take the caller's setup down with it.
+ */
+function patchFocusMethod(win: Window & typeof globalThis): VoidFunction | undefined {
+  try {
+    const nativeFocus = win.HTMLElement.prototype.focus
+
+    function patchedFocus(this: HTMLElement) {
+      // For programmatic focus, we set hasEventBeforeFocus so the subsequent focus event
+      // doesn't switch to virtual modality. This keeps modality as-is (e.g. "pointer" when
+      // user clicked to open a dialog), preventing focus rings on autofocus/focus-trap.
+      // When `options.focusVisible` is supported in most browsers, we can remove this.
+      // @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#focusvisible
+      hasEventBeforeFocus = true
+      nativeFocus.apply(this, arguments as unknown as [options?: FocusOptions | undefined])
+    }
+
+    // Overwrite via assignment does not work in happy dom:
+    // https://github.com/capricorn86/happy-dom/issues/1214
+    Object.defineProperty(win.HTMLElement.prototype, "focus", {
+      configurable: true,
+      value: patchedFocus,
+    })
+
+    return nativeFocus
+  } catch {
+    return undefined
+  }
+}
+
 /**
  * Setup global event listeners to control when keyboard focus style should be visible.
  */
@@ -198,28 +232,7 @@ function setupGlobalFocusEvents(root?: RootNode) {
   const win = getWindow(root)
   const doc = getDocument(root)
 
-  let focus = win.HTMLElement.prototype.focus
-  function patchedFocus(this: HTMLElement) {
-    // For programmatic focus, we set hasEventBeforeFocus so the subsequent focus event
-    // doesn't switch to virtual modality. This keeps modality as-is (e.g. "pointer" when
-    // user clicked to open a dialog), preventing focus rings on autofocus/focus-trap.
-    // When `options.focusVisible` is supported in most browsers, we can remove this.
-    // @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#focusvisible
-    hasEventBeforeFocus = true
-    focus.apply(this, arguments as unknown as [options?: FocusOptions | undefined])
-  }
-
-  // Overwrite via assignment does not work in happy dom:
-  // https://github.com/capricorn86/happy-dom/issues/1214
-  try {
-    Object.defineProperty(win.HTMLElement.prototype, "focus", {
-      configurable: true,
-      value: patchedFocus,
-    })
-  } catch {
-    // Failed to patch - property may be non-configurable or already patched
-    // The focus tracking will still work via keyboard/pointer event listeners
-  }
+  const nativeFocus = patchFocusMethod(win)
 
   doc.addEventListener("keydown", handleKeyboardEvent, true)
   doc.addEventListener("keyup", handleKeyboardEvent, true)
@@ -247,7 +260,7 @@ function setupGlobalFocusEvents(root?: RootNode) {
     { once: true },
   )
 
-  listenerMap.set(win, { focus })
+  listenerMap.set(win, { focus: nativeFocus })
 }
 
 const tearDownWindowFocusTracking = (root?: RootNode, loadListener?: () => void) => {
@@ -263,13 +276,15 @@ const tearDownWindowFocusTracking = (root?: RootNode, loadListener?: () => void)
     return
   }
 
-  try {
-    Object.defineProperty(win.HTMLElement.prototype, "focus", {
-      configurable: true,
-      value: listenerData.focus,
-    })
-  } catch {
-    // Failed to restore - ignore silently
+  if (listenerData.focus) {
+    try {
+      Object.defineProperty(win.HTMLElement.prototype, "focus", {
+        configurable: true,
+        value: listenerData.focus,
+      })
+    } catch {
+      // Failed to restore - ignore silently
+    }
   }
 
   doc.removeEventListener("keydown", handleKeyboardEvent, true)
```

**File**: `packages/utilities/focus-visible/tests/focus-visible.test.ts` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+// @vitest-environment jsdom
+
+import { afterEach, beforeEach, describe, expect, it } from "vitest"
+import { isFocusVisible, listenerMap, trackFocusVisible } from "../src"
+
+describe("focus visible", () => {
+  let descriptor: PropertyDescriptor
+
+  // The teardown `trackFocusVisible` returns only drops the change handler, so the
+  // patched prototype and the listener map outlive each test.
+  beforeEach(() => {
+    descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "focus")!
+    listenerMap.delete(window)
+  })
+
+  afterEach(() => {
+    Object.defineProperty(HTMLElement.prototype, "focus", descriptor)
+    listenerMap.delete(window)
+  })
+
+  it("should set up when the prototype's focus cannot be read", () => {
+    // Storybook's instrumenter replaces `focus` with an accessor that dereferences `this`,
+    // so reading it off the prototype throws.
+    Object.defineProperty(HTMLElement.prototype, "focus", {
+      configurable: true,
+      get(this: HTMLElement) {
+        return this.ownerDocument.defaultView!.HTMLElement.prototype.focus
+      },
+    })
+
+    expect(() => trackFocusVisible()).not.toThrow()
+
+    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
+    expect(isFocusVisible()).toBe(true)
+  })
+
+  it("should keep the prototype's own focus for teardown", () => {
+    const original = HTMLElement.prototype.focus
+
+    trackFocusVisible()
+
+    // A bare `focus` reference resolves to the global `window.focus`, which teardown
+    // would then install on every element.
+    expect(listenerMap.get(window)?.focus).toBe(original)
+    expect(listenerMap.get(window)?.focus).not.toBe(window.focus)
+  })
+
+  it("should record no focus to restore when the prototype's focus cannot be read", () => {
+    Object.defineProperty(HTMLElement.prototype, "focus", {
+      configurable: true,
+      get() {
+        throw new Error("unreadable")
+      },
+    })
+
+    trackFocusVisible()
+
+    expect(listenerMap.get(window)?.focus).toBeUndefined()
+  })
+})
```

#### Recent Merged Pull Requests:
- **PR #3389** (2026-10-05): docs: changelog for 1.45.0 (@Adebesin-Cell)
- **PR #3385** (2026-10-05): docs(select,combobox): explain when to use the list part (@Adebesin-Cell)
- **PR #3379** (2026-10-02): fix(toc): report the new value in onActiveChange (@segunadebayo)
- **PR #3372** (2026-10-02): fix(utils): compare object keys both ways in isEqual (@aaron-easygo)
- **PR #3368** (2026-09-28): fix(tabs): only navigate links on user activation (@segunadebayo)
- **PR #3366** (2026-09-28): fix(svelte): keep prop and context readable after the machine stops (@focofacofoco)
- **PR #3364** (2026-09-25): feat(image-cropper): add api.setCrop() to place the crop area programmatically (@segunadebayo)
- **PR #3362** (2026-09-25): fix(image-cropper): keep aspect ratio on keyboard resize (@lukasedw)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
