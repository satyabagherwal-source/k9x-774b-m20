# Forensic Learning Record (Deep Inspection): elrumordelaluz/reactour

> **Canonical Artifact**: `07_PROJECT_LEARNING/elrumordelaluz-reactour-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/elrumordelaluz/reactour](https://github.com/elrumordelaluz/reactour))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:46:27.253Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `elrumordelaluz/reactour`
- **Description**: Tourist Guide into your React Components
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4087 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/web/hooks.tsx`
```
import { useState, useEffect } from 'react'

export const useMousePosition = () => {
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })

  const updateMousePosition = (ev: MouseEvent) => {
    setMousePosition({ x: ev.clientX, y: ev.clientY })
  }

  useEffect(() => {
    window.addEventListener('mousemove', updateMousePosition)

    return () => window.removeEventListener('mousemove', updateMousePosition)
  }, [])

  return mousePosition
}

```

### Core Architecture Module: `apps/web/pages/utils.tsx`
```
import { useEffect, useRef, useState } from 'react'
import { inView, useRect, smoothScroll } from '@reactour/utils'

export default function Docs() {
  const [scrolled, setScrolled] = useState(false)
  const [isInView, setIsInView] = useState(false)
  // const paddingA = getPadding([10, 20])
  // const paddingB = getPadding(5)

  const ref = useRef<HTMLDivElement>(null)
  const rect = useRect(ref, scrolled)

  useEffect(() => {
    setIsInView(inView(rect))
  }, [rect])

  async function onClickScroll() {
    await smoothScroll(ref.current, {})
    setScrolled(true)
  }

  return (
    <div
      style={{
        borderWidth: 4,
        borderStyle: 'solid',
        borderColor: isInView ? 'green' : 'red',
      }}
    >
      <button onClick={onClickScroll}>scroll</button>
      <div
        ref={ref}
        style={{
          marginTop: 1000,
          width: 200,
          height: 200,
          backgroundColor: 'red',
        }}
      />
    </div>
  )
}

```

### Core Architecture Module: `apps/web/utils.js`
```
import { useTour } from '@reactour/tour'

export function Placeholder({ demoId = 'basic', ...props }) {
  const { setIsOpen } = useTour()
  return (
    <>
      <button onClick={() => setIsOpen(true)} className="open-button">
        Start Tour
      </button>
      {props.children}
      <div className={`${props.className} wrapper`} style={props.style}>
        <BeachIcon className="icon" data-tour={`step-1-${demoId}`} />
        <BoatIcon className="icon" data-tour={`step-4-${demoId}`} />
        <BallIcon className="icon" data-tour={`step-2-${demoId}`} />
        <GuideIcon className="icon" data-tour={`step-5-${demoId}`} />
        <IcecreamIcon className="icon" data-tour={`step-3-${demoId}`} />
      </div>
    </>
  )
}

export function TextPlaceholder({ demoId = 'basic', ...props }) {
  const { setIsOpen } = useTour()
  return (
    <>
      <button onClick={() => setIsOpen(true)} className="open-button">
        Start Tour
      </button>
      {props.children}
      <p>
        <span data-tour={`step-1-${demoId}`}>Lorem ipsum</span> dolor sit amet,
        consectetur adipiscing elit. Vivamus volutpat quam eu mauris euismod
        imperdiet. Nullam elementum fermentum neque a placerat. Vivamus sed dui
        nisi. Phasellus vel dolor interdum, accumsan eros ut, rutrum dolor.{' '}
        <span data-tour={`step-2-${demoId}`}>
          Pellentesque a magna enim. Pellentesque malesuada egestas urna, et
          pulvinar lorem viverra suscipit.
        </span>
        Duis sit amet mauris ante. Fusce at ante nunc. Maecenas ut leo eu erat
        porta fermentum.
      </p>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus
        volutpat quam eu mauris euismod imperdiet.{' '}
        <span data-tour={`step-3-${demoId}`}>
          Vivamus sed dui nisi. Phasellus vel dolor interdum,
        </span>
        Ut augue massa, aliquam in bibendum sed, euismod vitae magna. Nulla sit
        amet sodales augue. Curabitur in nulla in magna luctus porta et sit amet
        dolor. Pellentesque a magna enim.
      </p>
    </>
  )
}

export function doSteps(demoId) {
  return [
    {
      selector: `[data-tour="step-1-${demoId}"]`,
      content: <p>Vamos a la playa!</p>,
    },
    {
      selector: `[data-tour="step-2-${demoId}"]`,
      content: <p>Play beach ball all day long!</p>,
    },
    {
      selector: `[data-tour="step-3-${demoId}"]`,
      content: <p>Then, a deliciuos ice cream!</p>,
    },
  ]
}

export function IcecreamIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      aria-labelledby="title"
      aria-describedby="desc"
      {...props}
    >
      <path data-name="layer5" d="M54 30a22 22 0 11-44 0z" fill="#d5effb" />
      <path
        data-name="opacity"
        d="M17 30h-7a22 22 0 0022 22h.5A22.9 22.9 0 0117 30z"
        fill="#101129"
        opacity=".18"
      />
      <circle data-name="layer4" cx={32} cy={8} r={4} fill="#f0494c" />
      <path
        data-name="layer3"
        d="M31.9 30a8.8 8.8 0 00.1-1 9 9 0 10-18 .9"
        fill="#f9f6be"
      />
      <path
        data-name="opacity"
        d="M17.1 29.9a9 9 0 017.5-9.8H23a9 9 0 00-9 9.9h3z"
        fill="#101129"
        opacity=".18"
      />
      <path data-name="layer2" d="M34.2 30a8 8 0 1115.5 0" fill="#ef9bc2" />
      <path
        data-name="opacity"
        d="M43.5 20.1H42a8 8 0 00-7.7 10h3a8 8 0 016.2-9.9z"
        fill="#101129"
        opacity=".18"
      />
      <path
        data-name="layer1"
        d="M32 29a8.8 8.8 0 01-.1 1h2.3A8 8 0 0142 20h1.4a12 12 0 00-22.8.2A9 9 0 0132 29z"
        fill="#854a4a"
      />
      <path
        data-name="opacity"
        d="M32 30h2.3a8 8 0 015.6-9.7 8 8 0 00-9.2 3.9 8.9 8.9 0 011.4 4.8 8.8 8.8 0 01-.1 1z"
        fill="#101129"
        opacity=".18"
      />
      <path
        data-name="stroke"
        d="M54 30a22 22 0 11-44 0zM32 52v10m-6 0h12m-6.1-32a8.8 8.8 0 00.1-1 9 9 0 10-18 .9m20.2.1a8 8 0 1115.5 0m-29.1-9.7a12 12 0 0122.8-.2m-23.5.4L12 2"
        fill="none"
        stroke="#2f446a"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <circle
        data-name="stroke"
        cx={32}
        cy={8}
        r={4}
        fill="none"
        stroke="#2f446a"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  )
}

export function BallIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      aria-labelledby="title"
      aria-describedby="desc"
      {...props}
    >
      <path
        data-name="layer4"
        d="M2 32a29.9 29.9 0 002.6 12.3C10.7 24 30.2 15 44.9 16.1 41.2 8.4 34.3 2.9 23.6 3.2A30 30 0 002 32z"
        fill="#ed4c49"
      />
      <path
        data-name="layer3"
        d="M44.9 16.1C52.4 32 46 57.4 29 61.8h3a30 30 0 0029.4-35.9c-2.5-5.9-8.9-9.2-16.5-9.8z"
        fill="#49bcff"
      />
      <path
        data-name="layer2"
        d="M44.9 16.1C30.2 15 10.7 24 4.6 44.3A30 30 0 0029 61.8C46 57.4 52.4 32 44.9 16.1zm7-6.6a30 30 0 00-28.3-6.3c10.4-.3 17.3 5 21 12.5 1.1-3.6 4.7-6.5 7.3-6.2z"
        fill="#f2f6ff"
      />
      <path
        data-name="layer1"
        d="M61.4 25.9a30 30 0 00-9.5-16.4c-2.5-.3-6.2 2.6-7.2 6.1l.2.5c7.6.6 14 3.9 16.5 9.8z"
        fill="#fc0"
      />
      <path
        data-name="opacity"
        d="M42 52A30 30 0 0116.4 6.4a30 30 0 1041.2 41.2A29.9 29.9 0 0142 52z"
        fill="#000064"
        opacity=".15"
      />
      <path
        data-name="stroke"
        d="M23.6 3.2c32.4-1 30.7 52 5.4 58.7M4.6 44.3C13.9 13.4 54 8.7 61.4 25.9M51.9 9.5c-2.7-.3-6.5 2.8-7.3 6.6"
        fill="none"
        stroke="#2e4369"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <circle
        data-name="stroke"
        cx={32}
        cy={32}
        r={30}
        fill="none"
        stroke="#2e4369"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  )
}

export function BeachIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      aria-labelledby="title"
      aria-describedby="desc"
      {...props}
    >
      <path
        data-name="layer3"
        d="M8 62a26.8 26.8 0 0119.1-8C39.2 54 48 62 48 62z"
        fill="#e8c29d"
      />
      <path
        data-name="layer2"
        d="M34 32c.7-1.1 8-14 8-14l12 14a26.6 26.6 0 00-4-14 55.4 55.4 0 0010 6s.4-5.8-6-10c4.6-.4 6-2 6-2s-5.6-4.8-12-2c.7-3.3 2-8 2-8s-5.9 2.4-8 6c-5.7-3.3-10-2-10-2l6 6a11.9 11.9 0 00-12 6c7.3-.7 10 0 10 0s-4.5 3.8-2 14z"
        fill="#98c472"
      />
      <circle data-name="layer1" cx={12} cy={26} r={8} fill="#fc0" />
      <path
        data-name="opacity"
        d="M28 54c3.2.3 5.9 4.1 3 8h17s-8.4-7.6-20-8zm15.5-40c2.9.5 7 4.8 7.1 4.9L50 18a55.4 55.4 0 0010 6s.4-5.8-6-10c4.6-.4 6-2 6-2s-5.6-4.8-12-2c.2-1 .5-2.1.7-3.2C43.5 9.5 42 12 41 14c-6.9 0-14.7 3.8-15 4 7.3-.7 10 0 10 0s-4.5 3.8-2 14c.7-1.1 8-14 8-14l12 14c-1-2.9-8-16-10.5-18z"
        fill="#000064"
        opacity=".15"
      />
      <path
        data-name="stroke"
        d="M8 62a26.8 26.8 0 0119.1-8C39.2 54 48 62 48 62zm34-44c1.5 9.4 2.1 25.5-7.8 36.9"
        fill="none"
        stroke="#2e4369"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <path
        data-name="stroke"
        d="M34 32c.7-1.1 8-14 8-14l12 14a26.6 26.6 0 00-4-14 55.4 55.4 0 0010 6s.4-5.8-6-10c4.6-.4 6-2 6-2s-5.6-4.8-12-2c.7-3.3 2-8 2-8s-5.9 2.4-8 6c-5.7-3.3-10-2-10-2l6 6a11.9 11.9 0 00-12 6c7.3-.7 10 0 10 0s-4.5 3.8-2 14z"
        fill="none"
        stroke="#2e4369"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <circle
        data-name="stroke"
        cx={12}
        cy={26}
        r={8}
        fill="none"
        stroke="#2e4369"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  )
}

export function BoatIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      aria-labelledby="title"
      aria-describedby="desc"
      {...props}
    >
      <path
        data-name="layer2"
        d="M30 8c9.7 3.2 24 14.9 24 34H11S25.2 30.1 30 8z"
        fill="#f27e7c"
      />
      <path data-name="layer1" fill="#dde5f4" d="M58 50H6l10 12h38l4-12z" />
      <path
        data-name="opacity"
        d="M11 42h19V8c-4.8 22.1-19 34-19 34zm11 17l-7.5-9H6l10 12h38l1-3H22z"
        fill="#000064"
        opacity=".15"
      />
      <path
        data-name="stroke"
        d="M30 8c9.7 3.2 24 14.9 24 34H11S25.2 30.1 30 8zm28 42H6l10 12h38l4-12zm-28 0V2"
        fill="none"
        stroke="#2e4369"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  )
}

export function GuideIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      aria-labelledby="title"
      aria-describedby="desc"
      {...props}
    >
      <path data-name="layer3" fill="#a3b8df" d="M42 12V2L14 12v50h36V12h-8z" />
      <path
        data-name="layer2"
        d="M32 32c-.9-3.4.3-5.8 4-9.2A10 10 0 1040 38c.4-3.8-7.1-2.6-8-6z"
        fill="#7ed1ff"
      />
      <path
        data-name="layer1"
        d="M36 22.8c-3.7 3.4-4.9 5.8-4 9.2s8.4 2.2 8 6a10 10 0 00-4-15.1z"
        fill="#98c459"
      />
      <path
        data-name="opacity"
        fill="#000064"
        opacity=".15"
        d="M14 12v50h5V12h-5z"
      />
      <path
        data-name="opacity"
        fill="#000064"
        opacity=".2"
        d="M42 12V2L14 12h28z"
      />
      <path
        data-name="stroke"
        fill="none"
        stroke="#2e4369"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 12L42 2v10m-28 0h3
```

### Core Architecture Module: `packages/tour/hooks.tsx`
```
import { useEffect, useCallback, useState } from 'react'
import { inView, smoothScroll, getWindow, getRect } from '@reactour/utils'
import { StepType } from './types'

let initialState = {
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  windowWidth: 0,
  windowHeight: 0,
  x: 0,
  y: 0,
}

type ScrollLogicalPosition = 'center' | 'end' | 'nearest' | 'start'
type ScrollBehavior = 'auto' | 'smooth'

type ScrollIntoViewOptions = {
  behavior?: ScrollBehavior
  block?: ScrollLogicalPosition
  inline?: ScrollLogicalPosition
}

export function useSizes(
  step: StepType,
  scrollOptions: ScrollIntoViewOptions & {
    inViewThreshold?: number | { x?: number; y?: number }
  } = {
    block: 'center',
    behavior: 'smooth',
    inViewThreshold: 0,
  }
) {
  const [transition, setTransition] = useState(false)
  const [observing, setObserving] = useState(false)
  const [isHighlightingObserved, setIsHighlightingObserved] = useState(false)
  const [refresher, setRefresher] = useState(null as any)
  const [dimensions, setDimensions] = useState(initialState)
  const target =
    step?.selector instanceof Element
      ? step?.selector
      : document.querySelector(step?.selector)

  const handleResize = useCallback(() => {
    const { hasHighligtedElems, ...newDimensions }: any = getHighlightedRect(
      target,
      step?.highlightedSelectors,
      step?.bypassElem
    )
    if (
      Object.entries(dimensions).some(
        ([key, value]) => newDimensions[key] !== value
      )
    ) {
      setDimensions(newDimensions)
    }
  }, [target, step?.highlightedSelectors, dimensions])

  useEffect(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [target, step?.highlightedSelectors, refresher])

  useEffect(() => {
    const isInView = inView({
      ...dimensions,
      threshold: scrollOptions.inViewThreshold,
    })
    // TODO: - Solve cases when no target but highlightedSelectors
    if (!isInView && target) {
      setTransition(true)
      smoothScroll(target, scrollOptions)
        .then(() => {
          if (!observing) setRefresher(Date.now())
        })
        .finally(() => {
          setTransition(false)
        })
    }
  }, [dimensions])

  const observableRefresher = useCallback(() => {
    setObserving(true)
    const { hasHighligtedElems, ...dimesions } = getHighlightedRect(
      target,
      step?.highlightedSelectors,
      step?.bypassElem
    )
    setIsHighlightingObserved(hasHighligtedElems)
    setDimensions(dimesions)
    setObserving(false)
  }, [target, step?.highlightedSelectors, dimensions])

  return {
    sizes: dimensions,
    transition,
    target,
    observableRefresher,
    isHighlightingObserved,
  }
}

function getHighlightedRect(
  node: Element | null,
  highlightedSelectors: string[] = [],
  bypassElem = true
) {
  let hasHighligtedElems = false
  const { w: windowWidth, h: windowHeight } = getWindow()
  if (!highlightedSelectors) {
    return {
      ...getRect(node),
      windowWidth,
      windowHeight,
      hasHighligtedElems: false,
    }
  }

  let attrs = getRect(node)
  let altAttrs = {
    bottom: 0,
    height: 0,
    left: windowWidth,
    right: 0,
    top: windowHeight,
    width: 0,
  }

  for (const selector of highlightedSelectors) {
    const element = document.querySelector(selector) as HTMLElement
    if (
      !element ||
      element.style.display === 'none' ||
      element.style.visibility === 'hidden'
    ) {
      continue
    }

    const rect = getRect(element)
    hasHighligtedElems = true
    if (bypassElem || !node) {
      if (rect.top < altAttrs.top) {
        altAttrs.top = rect.top
      }

      if (rect.right > altAttrs.right) {
        altAttrs.right = rect.right
      }

      if (rect.bottom > altAttrs.bottom) {
        altAttrs.bottom = rect.bottom
      }

      if (rect.left < altAttrs.left) {
        altAttrs.left = rect.left
      }

      altAttrs.width = altAttrs.right - altAttrs.left
      altAttrs.height = altAttrs.bottom - altAttrs.top
    } else {
      if (rect.top < attrs.top) {
        attrs.top = rect.top
      }

      if (rect.right > attrs.right) {
        attrs.right = rect.right
      }

      if (rect.bottom > attrs.bottom) {
        attrs.bottom = rect.bottom
      }

      if (rect.left < attrs.left) {
        attrs.left = rect.left
      }

      attrs.width = attrs.right - attrs.left
      attrs.height = attrs.bottom - attrs.top
    }
  }

  const bypassable =
    bypassElem || !node ? altAttrs.width > 0 && altAttrs.height > 0 : false

  return {
    left: (bypassable ? altAttrs : attrs).left,
    top: (bypassable ? altAttrs : attrs).top,
    right: (bypassable ? altAttrs : attrs).right,
    bottom: (bypassable ? altAttrs : attrs).bottom,
    width: (bypassable ? altAttrs : attrs).width,
    height: (bypassable ? altAttrs : attrs).height,
    windowWidth,
    windowHeight,
    hasHighligtedElems,
    x: attrs.x,
    y: attrs.y,
  }
}

```

### Core Architecture Module: `packages/utils/Observables.tsx`
```
import React, { useRef, useEffect, useState } from 'react'
import useMutationObserver from '@rooks/use-mutation-observer'
import ResizeObserver from 'resize-observer-polyfill'

const Observables: React.FC<ObservablesProps> = ({
  mutationObservables,
  resizeObservables,
  refresh,
}) => {
  const [mutationsCounter, setMutationsCounter] = useState(0)
  const ref = useRef(document.documentElement || document.body)

  function refreshHighlightedRegionIfObservable(nodes: NodeList) {
    const posibleNodes = Array.from(nodes)
    for (const node of posibleNodes) {
      if (mutationObservables) {
        if (!(node as Element).attributes) {
          continue
        }
        const found = mutationObservables.find((observable: string) =>
          (node as Element).matches(observable)
        )

        if (found) {
          refresh(true)
        }
      }
    }
  }

  function incrementMutationsCounterIfObservable(nodes: NodeList) {
    const posibleNodes = Array.from(nodes)
    for (const node of posibleNodes) {
      if (resizeObservables) {
        if (!(node as Element).attributes) {
          continue
        }
        const found = resizeObservables.find((observable: string) =>
          (node as Element).matches(observable)
        )

        if (found) setMutationsCounter(mutationsCounter + 1)
      }
    }
  }

  useMutationObserver(
    ref,
    (mutationList: MutationRecord[]) => {
      for (const mutation of mutationList) {
        if (mutation.addedNodes.length !== 0) {
          refreshHighlightedRegionIfObservable(mutation.addedNodes)
          incrementMutationsCounterIfObservable(mutation.addedNodes)
        }

        if (mutation.removedNodes.length !== 0) {
          refreshHighlightedRegionIfObservable(mutation.removedNodes)
          incrementMutationsCounterIfObservable(mutation.removedNodes)
        }
      }
    },
    { childList: true, subtree: true }
  )

  useEffect(() => {
    if (!resizeObservables) {
      return
    }

    const resizeObserver: ResizeObserver = new ResizeObserver(() => {
      refresh()
    })

    for (const observable of resizeObservables) {
      const element = document.querySelector(observable)
      if (element) {
        resizeObserver.observe(element)
      }
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [resizeObservables, mutationsCounter])

  return null
}

type ObservablesProps = {
  mutationObservables?: string[]
  resizeObservables?: string[]
  refresh?: any
}

export default Observables

```

### Core Architecture Module: `packages/utils/Portal.tsx`
```
import React, { useEffect, useState, useRef, PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'

const Portal: React.FC<PropsWithChildren<PortalProps>> = ({
  children,
  type = 'reactour-portal',
}) => {
  let mountNode = useRef<HTMLDivElement | null>(null)
  let portalNode = useRef<Element | null>(null)
  let [, forceUpdate] = useState({})

  useEffect(() => {
    if (!mountNode.current) return

    const ownerDocument = mountNode.current!.ownerDocument
    portalNode.current = ownerDocument?.createElement(type)!
    ownerDocument!.body.appendChild(portalNode.current)
    forceUpdate({})

    return () => {
      if (portalNode.current && portalNode.current.ownerDocument) {
        portalNode.current.ownerDocument.body.removeChild(portalNode.current)
      }
    }
  }, [type])

  return portalNode.current ? (
    createPortal(children, portalNode.current)
  ) : (
    <span ref={mountNode} />
  )
}

export type PortalProps = {
  type?: string
}

export default Portal

```

### Core Architecture Module: `packages/utils/helpers.tsx`
```
import { InViewArgs, PositionsObjectType } from './types'

export function safe(sum: number): number {
  return sum < 0 ? 0 : sum
}

export function getInViewThreshold(threshold: InViewArgs['threshold']) {
  if (typeof threshold === 'object' && threshold !== null) {
    return {
      thresholdX: threshold.x || 0,
      thresholdY: threshold.y || 0,
    }
  }
  return {
    thresholdX: threshold || 0,
    thresholdY: threshold || 0,
  }
}

export function getWindow(): { w: number; h: number } {
  const w = Math.max(
    document.documentElement.clientWidth,
    window.innerWidth || 0
  )
  const h = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight || 0
  )
  return { w, h }
}

export function inView({
  top,
  right,
  bottom,
  left,
  threshold,
}: InViewArgs): boolean {
  const { w: windowWidth, h: windowHeight } = getWindow()
  const { thresholdX, thresholdY } = getInViewThreshold(threshold)

  return top < 0 && bottom - top > windowHeight
    ? true
    : top >= 0 + thresholdY &&
        left >= 0 + thresholdX &&
        bottom <= windowHeight - thresholdY &&
        right <= windowWidth - thresholdX
}

export const isHoriz = (pos: string) => /(left|right)/.test(pos)
export const isOutsideX = (val: number, windowWidth: number): boolean => {
  return val > windowWidth
}
export const isOutsideY = (val: number, windowHeight: number): boolean => {
  return val > windowHeight
}

export function bestPositionOf(
  positions: PositionsObjectType,
  filters: string[] = []
): string[] {
  const compareFn = (a: string, b: string) =>
    filters.includes(a) ? 1 : filters.includes(b) ? -1 : 0
  return Object.keys(positions)
    .map((p) => {
      return {
        position: p,
        value: positions[p],
      }
    })
    .sort((a, b) => b.value - a.value)
    .sort((a, b) => compareFn(a.position, b.position))
    .filter((p) => p.value > 0)
    .map((p) => p.position)
}

const defaultPadding = 10

export function getPadding(
  padding: number | number[] = defaultPadding
): number[] {
  if (Array.isArray(padding)) {
    if (padding.length === 1) {
      return [padding[0], padding[0], padding[0], padding[0]]
    }
    if (padding.length === 2) {
      return [padding[1], padding[0], padding[1], padding[0]]
    }
    if (padding.length === 3) {
      return [padding[0], padding[1], padding[2], padding[1]]
    }
    if (padding.length > 3) {
      return [padding[0], padding[1], padding[2], padding[3]]
    }
    return [defaultPadding, defaultPadding]
  }
  return [padding, padding, padding, padding]
}

```

### Core Architecture Module: `packages/utils/index.tsx`
```
import Observables from './Observables'
import { useRect, useElemRect, getRect } from './useRect'
import { smoothScroll } from './smoothScroll'
import { useIntersectionObserver } from './useIntersectionObserver'
import {
  safe,
  getInViewThreshold,
  getWindow,
  inView,
  isHoriz,
  isOutsideX,
  isOutsideY,
  bestPositionOf,
  getPadding,
} from './helpers'

import {
  PositionsType,
  PositionsObjectType,
  CoordType,
  CoordsObjectType,
  RectResult,
  InViewArgs,
} from './types'

export {
  Observables,
  useRect,
  useElemRect,
  getRect,
  smoothScroll,
  useIntersectionObserver,
  safe,
  getInViewThreshold,
  getWindow,
  inView,
  isHoriz,
  isOutsideX,
  isOutsideY,
  bestPositionOf,
  getPadding,
}

export type {
  PositionsType,
  PositionsObjectType,
  CoordType,
  CoordsObjectType,
  RectResult,
  InViewArgs,
}

```

### Core Architecture Module: `packages/utils/smoothScroll.tsx`
```
// https://stackoverflow.com/questions/46795955/how-to-know-scroll-to-element-is-done-in-javascript
export function smoothScroll(
  elem: Element | null,
  // @ts-ignore
  options: any
) {
  return new Promise((resolve) => {
    if (!(elem instanceof Element)) {
      throw new TypeError('Argument 1 must be an Element')
    }
    let same = 0
    let lastPos: undefined | null | number = null
    const scrollOptions = Object.assign({ behavior: 'smooth' }, options)

    elem.scrollIntoView(scrollOptions)
    requestAnimationFrame(check)

    function check() {
      const newPos = elem?.getBoundingClientRect().top
      if (newPos === lastPos) {
        if (same++ > 2) {
          return resolve(null)
        }
      } else {
        same = 0
        lastPos = newPos
      }
      requestAnimationFrame(check)
    }
  })
}

```

### Core Architecture Module: `packages/utils/types.tsx`
```
export type PositionsType = 'left' | 'right' | 'top' | 'bottom'

export type PositionsObjectType = {
  [position: string]: number
}

export type CoordType = number[]

export type CoordsObjectType = {
  [position: string]: CoordType
}

export type RectResult = {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
  x: number
  y: number
}

export type InViewArgs = RectResult & {
  threshold?: { x?: number; y?: number } | number
}

```

### Core Architecture Module: `packages/utils/useIntersectionObserver.tsx`
```
import { RefObject, useEffect, useState } from 'react'

export function useIntersectionObserver(
  elementRef: RefObject<Element>,
  {
    threshold = 0,
    root = null,
    rootMargin = '0%',
    freezeOnceVisible = false,
  }: any
): any | undefined {
  const [entry, setEntry] = useState<any>()

  const frozen = entry?.isIntersecting && freezeOnceVisible

  const updateEntry = ([entry]: any[]): void => {
    setEntry(entry)
  }

  useEffect(() => {
    const node = elementRef?.current // DOM Ref
    const hasIOSupport = !!window.IntersectionObserver
    if (!hasIOSupport || frozen || !node) return
    const observerParams = { threshold, root, rootMargin }
    const observer = new IntersectionObserver(updateEntry, observerParams)
    observer.observe(node)
    return () => observer.disconnect()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementRef, JSON.stringify(threshold), root, rootMargin, frozen])

  return entry
}

```

### Core Architecture Module: `packages/utils/useRect.tsx`
```
import { useEffect, useCallback, useState } from 'react'

export function getRect<T extends Element>(
  element?: T | undefined | null
): RectResult {
  let rect: RectResult = initialState
  if (element) {
    const domRect: DOMRect = element.getBoundingClientRect()
    rect = domRect
  }
  return rect
}

export function useRect<T extends Element>(
  ref: React.RefObject<T | null> | undefined,
  refresher?: any
): RectResult {
  const [dimensions, setDimensions] = useState(initialState)
  const handleResize = useCallback(() => {
    if (!ref?.current) return
    setDimensions(getRect(ref?.current))
  }, [ref?.current])

  useEffect(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [ref?.current, refresher])

  return dimensions
}

export function useElemRect(
  elem: Element | undefined,
  refresher?: any
): RectResult {
  const [dimensions, setDimensions] = useState(initialState)
  const handleResize = useCallback(() => {
    if (!elem) return
    setDimensions(getRect(elem))
  }, [elem])

  useEffect(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [elem, refresher])

  return dimensions
}

const initialState = {
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
}

export type RectResult = {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
  x: number
  y: number
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #493** (2022-08-29): **Webpack fails for JS projects from trying to load index.tsx**
  *Symptoms*: **Describe the bug** Not all projects use TypeScript, and not all projects have `.ts`/`.tsx` loaders. This error occurs when using Next.js without TypeScript.  **Expected behavior** This package should not expect that TypeScript will be available out of the box.  ``` error - ./node_modules/@reactour/tour/index.tsx Module parse failed: Unexpected token (8:7) You may need an appropriate loader to handle this file type, currently no loaders are configured to process this file. See https://webpack.js.org/concepts#loaders | export default Tour | export { Tour, TourContext, TourProvider, useTour } > export type { |   StepType, |   Position, ```  
  **Post-Mortem & Fix Analysis**:
  > Hi @yanickrochon , thanks for open the _Issue_.  Just fiunding a fix for this one in the same moment you open this issue.  Let me investigate a little more and came back to you asap.
  > Is there even a way to fix this problem instantly? We can't work for hours because of this. Revert it back until the problem is fixed
  > <img width="424" alt="Ekran Resmi 2022-08-25 21 07 36" src="https://user-images.githubusercontent.com/29544960/186738028-7471790c-4a7c-476b-8126-7921a6fc2f9b.png"> Attached error appears with version 3.0.3

- **Issue #492** (2022-08-25): **Arrow demo does not work**
  *Symptoms*: the [arrow demo](https://reactour.vercel.app/) is broken using version 3.x.  <img width="758" alt="image" src="https://user-images.githubusercontent.com/2291033/186614634-74b53fce-51b6-4970-b464-c03ce123dac2.png">  I think it's caused by @reactour/mask or @reactour/popover dependency.  After lock version manually in package.json resolutions field it works well:  ``` "resolutions": {   "@reactour/mask": "0.5.1",   "@reactour/popover": "0.5.0" }, ```  <img width="1151" alt="image" src="https://user-images.githubusercontent.com/2291033/186616200-27f0e9b4-9f48-4240-ac94-265b8705cfc1.png">   But downgrade @reactour/tour to version 2.x still not work because it's dependency version is `*`  <img width="707" alt="image" src="https://user-images.githubusercontent.com/2291033/186614030-f9835976-1de0-48a2-9028-46bedd98c81a.png">     
  **Post-Mortem & Fix Analysis**:
  > Why not lock @reactour/tour dependency versions in package.json?  This leads to my previous code broken after upgrade to 3.x and still not work after downgrade to 2.x...
  > Hi @elixiao, thanks for open the _Issue_ and to catch this specific use-case!  Since `v3` @reatour/* packages doesn't use anymore a css-in-js lib (that was emotion). This results in that there is no more need to install this lib as `peerDep` and there is also a reduced bundle size. This lib was used for really tiny but handy peaces of code, like style pseudo elements using dynamic values. That is the case for the `:after` element in the arrow example. I am adding `classNames` (so ![Screenshot 2022-08-25 at 12 15 15](https://user-images.githubusercontent.com/784056/186639181-1d01a614-8dfa-4897-b312-95c2335b9296.png) on will update docs) that will be useful, to override styles on user-land, and helps as to solve those situations (like pseudo-elements and pseudo-classes) using `--css-variables`.  Here is the [updated demo](https://reactour.vercel.app/popover) which is using the last version of `@reactour/popover`.  
  > @elrumordelaluz I didn't know that variables can be used in this way. Before you told me I use another hack solution:  ```js const stepArrowDirections = ['bottom', 'right', 'left', 'top'] function ContentComponent(props) {   const { currentStep, steps, setIsOpen, setCurrentStep } = props   const isLastStep = currentStep === steps.length - 1   const content = steps[currentStep].content      return (     <div className={`user-guide-content ${stepArrowDirections[currentStep]}-arrow`}>        // code here     </div>   ) } const props = {   steps,   ContentComponent, // this is the crucial point   className: 'user-guide',   styles: {     popover: (base, state) => {       return {         ...base,         // ...doArrow(state.position, state.verticalAlign, state.horizontalAlign), // do not work here       }     },     maskArea: (base) => ({ ...base, rx: 5 }),   }, } export default function ({ children }) {   return <TourProvider {...props}>{children}</TourProvide

- **Issue #490** (2022-08-22): **Small visual bug in Safari**
  *Symptoms*: **Describe the bug**  The cross moved a little in Safari  **To Reproduce** Steps to reproduce the behavior: 1. Open Safari 2. Open tour  **Expected behavior**  The cross is fully visible  **Screenshots**  <img width="812" alt="image" src="https://user-images.githubusercontent.com/15047511/185451702-bec852d0-445c-494a-ae5d-2643011ae75e.png">  **Additional context**  Can be fixed if add `display: block` to `svg` 
  **Post-Mortem & Fix Analysis**:
  > Thank you @dartess for the point! Should be available now on `v3.0.1`
  > @elrumordelaluz Thanks for the quick reaction! Unfortunately, I'm not that fast.  Now version `v3.0.1` is not working:  ``` WARNING in ../node_modules/@reactour/tour/dist/tour.esm.js 816:36-42 export 'Portal' (imported as 'Portal') was not found in '@reactour/utils' (possible exports: Observables, bestPositionOf, getInViewThreshold, getPadding, getRect, getWindow, inView, isHoriz, isOutsideX, isOutsideY, safe, smoothScroll, useElemRect, useIntersectionObserver, useRect) ```  `v3.1.0` works, but this original problem with cross still exists:  <img width="114" alt="image" src="https://user-images.githubusercontent.com/15047511/187211317-f8115bec-a1c5-467b-87a5-142cec4ed39e.png">  p.s. in demo https://reactour.vercel.app in safari now the cross went even lower; now it is not visible at all:  <img width="1134" alt="image" src="https://user-images.githubusercontent.com/15047511/187211270-9da9f599-da37-48ac-8484-041dc308dd82.png"> 
  > Thank you for pointing this out again! Should be now solved in `v3.1.1`

- **Issue #488** (2022-08-12): **Unnecessary network requests**
  *Symptoms*: **Describe the bug** On every render there is a new network request in the Network Tab  **To Reproduce** Steps to reproduce the behavior: 1. Go to [https://reactour.vercel.app](https://reactour.vercel.app/) 2. Scroll down to "Smooth scroll" 3. Open developer tools 4. Navigate to the network tab 5. Click on "Start tour" 6. Click on the "Right arrow" of Popover  **Expected behavior** No requests are sent  **Screenshots** <img width="1787" alt="Screen Shot 2022-08-11 at 12 27 05 PM" src="https://user-images.githubusercontent.com/8925613/184095032-71859b0c-3dcd-4259-a3bd-a77bdbed01b2.png">  **Desktop (please complete the following information):**  - OS: MacOS  - Browser: Chrome  - Version 103.0.5060.134 (Official Build) (x86_64) 
  **Post-Mortem & Fix Analysis**:
  > Hi @spiderhands, thanks for open the _Issue_.  I am only getting the same result on Chrome, not in FF nor in Safari. Let's investigate which could be the source of the problem.
  > It seems that there are `img` requests.  ![Screenshot 2022-08-11 at 11 38 36](https://user-images.githubusercontent.com/784056/184106194-fd995736-eb71-4633-91ae-71c05a3bb1c4.png)   
  > Something tries to navigate to a URL with the mask hash at the end  https://emaxple.com/some-page#mask__dvybzk7rb9a

- **Issue #486** (2022-07-30): **Not working when using it for elements inside shadow root**
  *Symptoms*: First of all thanks for this great library, I have used it in several projects so far but when it comes to Microfrontend development we have found some issues:  **Describe the bug** When using shadow DOM it is just not working. I am passing an element that is inside a shadow root using the 'selector' property as an element and it is not showing the tour in the right position, it just appearing in the top left corner.  **To Reproduce** Steps to reproduce the behavior: - Usage in React 1. Create a web component with a shadow root in 'open' mode 2. Create Button element inside the shadow root 3. Try to set up the tour targeting the Button inside the shadow root  4. See error  **Expected behavior** Display the Tour Popover in the right position. It would be great to be able to provide an element where the <reactour-portal > is appended and also all the JSS styles are applied so the global scope is not polluted. Something like StyleSheetManager in styled-components.  If you know a possible workaround would be also great. For now we are disabling the Tour in some modules because of this issue.  Thanks 
  **Post-Mortem & Fix Analysis**:
  > Hi @MarcLopezAvila, thanks for open the _Issue_.  Since you closed the issue, can you share what was the solution, in order to be helpful to others?  Otherwise, if the issue persists, mind creating a minimal reproduction in a sandbox in order to allow to debug your use-case and try to find a solution? Thanks!
  > In this case I managed to always pass an Element as a selector (because with js you can querySelector the shadow root) but because the elements of the steps are not there all at once (they can be in another page or tab), I had to do a 'setSteps' execution all the time with the right step index so at the moment of the step definition the querySelector for the step element can find it.  When you pass a selector as a string it works well because you query the selector just when the step is activated but when you pass Elements, that query is not delayed until the step is activated, it must be passed when the steps are defined, so this actually is still kind of a problem because I don't want to be calling setSteps all the time just to be able to supply the Element.  It's a workaround but it works for selectors. It doesn't though for detecting mutations so I created an Issue in this repository. https://github.com/elrumordelaluz/reactour/issues/487  **Possible solution**  I think it w

- **Issue #484** (2022-07-14): **Bug with scrolling to element which is not in viewport**
  *Symptoms*: **Describe the bug** When element which needs to be highlighted is not in viewport, popover first goes to center and then to that element. If animation is fast, like it is in my example, it will look like bug.  **Expected behavior** I would like to make animation looks smooth, like it looks in the second part of video (where I unzoom window).  **Video with reproduction of bug** https://www.veed.io/view/2ddf4637-38e1-4bed-b8a4-5652752bea74?sharingWidget=true  **TourProvider code** ``` <TourProvider         steps={steps} // just steps with content and selectors         disableInteraction         styles={tourStyles} // just added borderRadius and padding to popover         padding={{ mask: 0 }}         ContentComponent={ContentComponentWrap({ type })} // custom popover with state changing functionality (currentStep +1 or -1)         afterOpen={disableBody} // disabled body scroll         beforeClose={enableBody} // enabled body scroll         inViewThreshold={isMobile ? null : threshold}         startAt={startAt}         scrollSmooth={scrollSmooth}       >         {children} </TourProvider> ``` 
  **Post-Mortem & Fix Analysis**:
  > Hi @jorgadev, thanks for open the _Issue_.  Let me investigate a little and get back to you asap.  Did you tried using `scrollSmooth={false}` or removing it at all?
  > > Hi @jorgadev, thanks for open the _Issue_. >  > Let me investigate a little and get back to you asap. >  > Did you tried using `scrollSmooth={false}` or removing it at all?  Posted example is with `scrollSmooth={false}`. Without `scrollSmooth` behaviour is similar as one with `scrollSmooth={false}`. If I put it on `true` it jumps in middle like this: https://www.veed.io/view/ff6920f9-59f3-4949-8b09-4be95a4a0931?sharingWidget=true
  > Without `scrollSmooth` or setting it as `false`, the _Tour_ not only should not go to the center when _transitioning_ but also skip at all the _scroll behavior_. If the last part doesn't happening probably is set the [css scroll-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-behavior). Since the _Tour_ is using the native way to _smooth scroll_ is sensible to this also. For example, in [this sandbox](https://codesandbox.io/s/tour-demo-using-react-router-dom-with-automatic-route-switching-forked-jezipv?file=/src/styles.css), until I override the css, the `scrollBehavior` prop on _TourProvider_ doesn't change the behavior; this is because this demo is using `bootstrap` lib, which [sets this](https://github.com/twbs/bootstrap/blob/main/dist/css/bootstrap.css#L84-L88) when `prefers-reduced-motion: no-preference)`.  Please try overriding the scroll behavior, something like: ```css html {   scroll-behavior: auto !important; } ``` and let me know if this is what you

- **Issue #471** (2022-05-02): **Tour not scrolling to view the next component**
  *Symptoms*: **Describe the bug** The tour initialization is correct and it works as expected for 1st 3 steps as all the components are in the viewport. But the 4th step is regarding the component which is not visible and here the problem arises that the tour does not scroll the page to bring that component into view. I followed the exact steps mentioned in the docs and also the code is similar to the demo.  **To Reproduce** Steps to reproduce the behavior: 1. Go to https://stackblitz.com/edit/nextjs-m696rr?file=pages/_app.js 2. Scroll down to view the issue 3. See that component does not come into view  **Expected behavior** When the component is not in view the tour should scroll the page to bring that component into view.  **Desktop (please complete the following information):**  System:     OS: Windows 10 10.0.19044     Browser: Chrome and Brave     CPU: (8) x64 Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz     Memory: 2.24 GB / 15.83 GB   Binaries:     Node: 16.14.2 - C:\Program Files\nodejs\node.EXE     Yarn: 1.22.5 - C:\Program Files (x86)\Yarn\bin\yarn.CMD     npm: 8.5.0 - C:\Program Files\nodejs\npm.CMD  **Additional context** I'm using nextjs and material UI. I'm not able to figure out the issue for 2 days. I went through all the previous issues but yet couldn't figure out anything specifically useful. Urgent help is needed. Thanks 👍
  **Post-Mortem & Fix Analysis**:
  > Hi @s-pcode, thanks for open the _Issue_.  Is it possible to you to upgrade to `@reactour/tour@2.x.x` version?  The scrolling when switching routes seems to work as expected, like in [this demo](https://codesandbox.io/s/tour-demo-using-react-router-dom-with-automatic-route-switching-forked-z8jyvg)
  > Ok, I'll have a look at v2.  Thanks 👍 
  > >   Is it possible to make that popover doesn't go do center first (like it goes in demo), and then to highlighted element, but immediately to highlighted element?

- **Issue #470** (2022-06-18): **Can not use `steps[currentStep].content` when `content` is `JSX`**
  *Symptoms*: **Describe the bug** I've added some `JSX` inside the `content` of a step. Now I want to render it inside the `ContentComponent` using `steps[currentStep].content`. I've tried everything but it doesn't show up. But as long as I comment out the `ContentComponent`, it does show up. I need to show it inside the `ContentComponent`.  **To Reproduce** 1. Go to this sandbox link: https://codesandbox.io/s/keen-kowalevski-zopbhd 2. Click on the `Start Tour` button to start the tour. It will show the `JSX` that is added inside the `content` of the step. 3. Scroll down to 'ContentComponent' and uncomment it. 4. It will no longer show the `JSX` inside the `content` of the step.  **Expected behavior** `JSX` to show up inside the `ContentComponent` by `steps[currentStep].content`.  **Screenshots** https://user-images.githubusercontent.com/33332648/165378482-51cf70b7-a8ba-46ae-a682-cab19b000910.mov  **Desktop (please complete the following information):**  - OS: MacOS  - Browser: Chrome  - Version: 12.3.1  **Additional context:** 1. I think I'm using `ContentComponent` the wrong way, please guide
  **Post-Mortem & Fix Analysis**:
  > Hi @hali241997, thanks for open the _Issue_.  The reason is that when using `ContentComponent` you are responsible to check if the `step.content` prop is a `function` or not.   You can do something like this:  ```js  function ContentComponent(props) {   const content = props.steps[props.currentStep].content;   return typeof content === "function"     ? content({ ...props, someOtherStuff: "Custom text" })     : content; } ```  [Here](https://codesandbox.io/s/pensive-moon-geyxus?file=/src/App.js) is a working example.  Will update the example in Readme to be clearer. Thanks to pointing this out!
  > @elrumordelaluz This might work in `js` but it gives typing errors in `ts`. A better approach: ``` ContentComponent={({                 steps,                 currentStep,                 setCurrentStep,                 setIsOpen,               }) => {                 const content = steps[currentStep].content;                  if (typeof content === "function") {                   return (                     <>                       {content({                         currentStep,                         setCurrentStep,                         setIsOpen,                         transition: false,                       })}                     </>                   );                 }                 return null;               }} ```  Since `ContentComponent` expect `JSX`, so we wrap the `content` with `<></>`. The `content` only needs the following: - `currentStep` - `setCurrentStep` - `setIsOpen` - `transition`  I have set `transition` to `false` becau
  > Thank you @hali241997, mind giving an eye into the codebase in order to improve typing directly?   Thanks again!

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

### Incident Patch 1: `f38832ff` (2026-05-19)
**Commit Message**: fix(tour): scope disableActions to its declaring step

When a step set `disableActions: true`, the flag carried over into every
subsequent step until one explicitly set it back to `false`. The effect
guarded the state update with `if (step?.disableActions !== undefined)`,
so omitting the field on the next step left the previous value in place
and silently disabled navigation/mask/keyboard interactions.

Drop the guard and treat a missing `disableActions` as `false`, so the
flag is re-evaluated on every step transition and only affects the step
that declares it. Added a regression test that advances past a step with
`disableActions: true` and asserts the mask click handler fires again.

Closes #683

**File**: `packages/tour/Tour.tsx` (modified, +1/-3)
```diff
@@ -113,9 +113,7 @@ const Tour: React.FC<TourProps> = ({
       step?.action(target)
     }
 
-    if (step?.disableActions !== undefined) {
-      setDisabledActions(step?.disableActions)
-    }
+    setDisabledActions(step?.disableActions ?? false)
 
     return () => {
       if (step?.actionAfter && typeof step?.actionAfter === 'function') {
```

**File**: `packages/tour/__tests__/Tour.test.tsx` (modified, +39/-1)
```diff
@@ -1,6 +1,6 @@
 import React from 'react'
 import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest'
-import { fireEvent, render } from '@testing-library/react'
+import { act, fireEvent, render } from '@testing-library/react'
 import { TourProvider } from '../Context'
 
 beforeAll(() => {
@@ -207,6 +207,44 @@ describe('Tour orchestrator', () => {
     ).not.toBeNull()
   })
 
+  it('resets disableActions when the next step omits it (issue #683)', () => {
+    const b = document.createElement('div')
+    b.id = 'b'
+    document.body.appendChild(b)
+    const customSteps = [
+      { selector: '#a', content: 'A', disableActions: true },
+      { selector: '#b', content: 'B' },
+    ]
+    const onClickMask = vi.fn()
+    let externalSetStep: ((n: number) => void) | undefined
+    const Harness: React.FC = () => {
+      const [step, setStep] = React.useState(0)
+      externalSetStep = setStep
+      return (
+        <TourProvider
+          steps={customSteps}
+          defaultOpen
+          currentStep={step}
+          setCurrentStep={setStep as any}
+          onClickMask={onClickMask}
+        >
+          <div />
+        </TourProvider>
+      )
+    }
+    render(<Harness />)
+    // Step 0 disables actions: mask click is a no-op (handler not invoked).
+    fireEvent.click(document.querySelector('.reactour__mask')!)
+    expect(onClickMask).not.toHaveBeenCalled()
+
+    // Advance to step 1 (no disableActions): the handler should fire now.
+    act(() => {
+      externalSetStep!(1)
+    })
+    fireEvent.click(document.querySelector('.reactour__mask')!)
+    expect(onClickMask).toHaveBeenCalledTimes(1)
+  })
+
   it('uses step.position when no global position is provided', () => {
     const customSteps = [
       { selector: '#a', content: 'A', position: 'top' as const },
```

---

### Incident Patch 2: `23e9a16f` (2026-05-15)
**Commit Message**: Merge pull request #687 from elrumordelaluz/test/tour-suite-expansion

test/tour suite expansion

**File**: `.github/workflows/ci.yml` (modified, +11/-2)
```diff
@@ -36,5 +36,14 @@ jobs:
       - name: Build packages
         run: pnpm turbo run build --filter=!./apps/docs --filter=!./apps/web
 
-      - name: Test
-        run: pnpm turbo run test
+      - name: Test with coverage
+        run: pnpm turbo run test:coverage
+
+      - name: Upload coverage report
+        if: always()
+        uses: actions/upload-artifact@v4
+        with:
+          name: coverage
+          path: packages/*/coverage
+          if-no-files-found: ignore
+          retention-days: 14
```

**File**: `package.json` (modified, +2/-0)
```diff
@@ -7,6 +7,7 @@
     "dev": "turbo run dev --no-cache --parallel --continue",
     "lint": "turbo run lint",
     "test": "turbo run test",
+    "test:coverage": "turbo run test:coverage",
     "test:watch": "turbo run test:watch --parallel --no-cache",
     "clean": "turbo run clean && rm -rf node_modules",
     "format": "prettier --write \"**/*.{ts,tsx,md,mdx}\"",
@@ -22,6 +23,7 @@
     "@types/react": "^19.2.14",
     "@types/react-dom": "^19.2.3",
     "@vitejs/plugin-react": "^5.0.0",
+    "@vitest/coverage-v8": "^3.2.4",
     "eslint-plugin-prettier": "^5.5.5",
     "jsdom": "^26.0.0",
     "prettier": "^3.8.1",
```

**File**: `packages/mask/__tests__/Mask.test.tsx` (modified, +96/-0)
```diff
@@ -45,4 +45,100 @@ describe('Mask', () => {
     fireEvent.click(container.querySelector('.wrapper')!)
     expect(onClick).toHaveBeenCalledOnce()
   })
+
+  it('calls onClickHighlighted when the highlighted rect is clicked', () => {
+    const onClickHighlighted = vi.fn()
+    const { container } = render(
+      <Mask
+        sizes={SIZES}
+        highlightedAreaClassName="hl"
+        onClickHighlighted={onClickHighlighted}
+      />
+    )
+    fireEvent.click(container.querySelector('.hl')!)
+    expect(onClickHighlighted).toHaveBeenCalledOnce()
+  })
+
+  it('inflates the highlighted area by numeric padding', () => {
+    const { container } = render(
+      <Mask sizes={SIZES} padding={20} highlightedAreaClassName="hl" />
+    )
+    const rect = container.querySelector('.hl') as unknown as SVGRectElement
+    // Mask applies x/y/width/height via inline style (presentation CSS).
+    expect(rect.style.width).toBe('140px')
+    expect(rect.style.height).toBe('140px')
+    expect(rect.style.x).toBe('30px')
+    expect(rect.style.y).toBe('80px')
+  })
+
+  it('accepts an array padding (top/right/bottom/left)', () => {
+    const { container } = render(
+      <Mask sizes={SIZES} padding={[5, 10, 15, 20]} highlightedAreaClassName="hl" />
+    )
+    const rect = container.querySelector('.hl') as unknown as SVGRectElement
+    expect(rect.style.width).toBe('130px')
+    expect(rect.style.height).toBe('120px')
+    expect(rect.style.x).toBe('30px')
+    expect(rect.style.y).toBe('95px')
+  })
+
+  it('clamps negative coordinates to 0 via safe()', () => {
+    const { container } = render(
+      <Mask
+        sizes={{ ...SIZES, top: 5, left: 5 }}
+        padding={50}
+        highlightedAreaClassName="hl"
+      />
+    )
+    const rect = container.querySelector('.hl') as unknown as SVGRectElement
+    expect(rect.style.x).toBe('0')
+    expect(rect.style.y).toBe('0')
+  })
+
+  it('emits the rx attribute when the style provides rx', () => {
+    const { container } = render(
+      <Mask
+        sizes={SIZES}
+        highlightedAreaClassName="hl"
+        styles={{
+          highlightedArea: (base) => ({ ...base, rx: 4 }),
+          maskArea: (base) => ({ ...base, rx: 4 }),
+        }}
+      />
+    )
+    const highlight = container.querySelector('.hl')
+    expect(highlight?.getAttribute('rx')).toBe('1')
+    // The masked rect (no class) is the second rect inside <mask>.
+    const masked = container.querySelector('mask rect:nth-of-type(2)')
+    expect(masked?.getAttribute('rx')).toBe('1')
+  })
+
+  it('omits rx when no style provides it', () => {
+    const { container } = render(
+      <Mask sizes={SIZES} highlightedAreaClassName="hl" />
+    )
+    expect(container.querySelector('.hl')?.hasAttribute('rx')).toBe(false)
+  })
+
+  it('honors a custom maskWrapper style override', () => {
+    const { container } = render(
+      <Mask
+        sizes={SIZES}
+        className="wrapper"
+        styles={{ maskWrapper: (base) => ({ ...base, opacity: 0.3 }) }}
+      />
+    )
+    const wrapper = container.querySelector('.wrapper') as HTMLDivElement
+    expect(wrapper.style.opacity).toBe('0.3')
+  })
+
+  it('generates unique mask/clip ids across instances when none are provided', () => {
+    const { container: a } = render(<Mask sizes={SIZES} />)
+    const { container: b } = render(<Mask sizes={SIZES} />)
+    const idA = a.querySelector('mask')?.getAttribute('id')
+    const idB = b.querySelector('mask')?.getAttribute('id')
+    expect(idA).toMatch(/^mask__/)
+    expect(idB).toMatch(/^mask__/)
+    expect(idA).not.toBe(idB)
+  })
 })
```

**File**: `packages/mask/package.json` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
     "dev": "tsup index.tsx --format esm,cjs --watch --dts --external react",
     "lint": "TIMING=1 eslint **/*.ts* --fix",
     "test": "vitest run",
+    "test:coverage": "vitest run --coverage",
     "test:watch": "vitest",
     "clean": "rm -rf .turbo && rm -rf node_modules && rm -rf dist"
   },
```

**File**: `packages/popover/__tests__/Popover.test.tsx` (modified, +156/-1)
```diff
@@ -1,5 +1,5 @@
 import React from 'react'
-import { describe, it, expect, beforeAll } from 'vitest'
+import { describe, it, expect, beforeAll, vi } from 'vitest'
 import { render } from '@testing-library/react'
 import { Popover } from '../index'
 
@@ -67,4 +67,159 @@ describe('Popover', () => {
     const wrapper = container.firstChild as HTMLElement
     expect(wrapper.style.transform).toMatch(/^translate\(/)
   })
+
+  it('calls the function position with positional context', () => {
+    const positionFn = vi.fn(() => 'right' as const)
+    render(
+      <Popover sizes={SIZES} position={positionFn}>
+        <span>x</span>
+      </Popover>
+    )
+    // useRect's mount setState triggers a re-render so the spy is called more
+    // than once; we only care that the first invocation gets the expected shape.
+    expect(positionFn).toHaveBeenCalled()
+    const args = positionFn.mock.calls[0]
+    expect(args[0]).toMatchObject({
+      windowWidth: 1000,
+      windowHeight: 800,
+      // padding=10 default → targetTop = 100 - 10 = 90.
+      top: 90,
+      left: 40,
+      right: 160,
+      bottom: 210,
+    })
+  })
+
+  it('forwards arbitrary props (aria-*) to the popover element', () => {
+    const { container } = render(
+      <Popover sizes={SIZES} aria-labelledby="step-title">
+        <span>x</span>
+      </Popover>
+    )
+    const wrapper = container.firstChild as HTMLElement
+    expect(wrapper.getAttribute('aria-labelledby')).toBe('step-title')
+  })
+
+  it('renders explicit center position centered on the window', () => {
+    const { container } = render(
+      <Popover sizes={SIZES} position="center">
+        <span>x</span>
+      </Popover>
+    )
+    const wrapper = container.firstChild as HTMLElement
+    // helperRect width/height start at 0 in jsdom, so center = (windowWidth/2, windowHeight/2).
+    expect(wrapper.style.transform).toBe('translate(500px, 400px)')
+  })
+
+  it('clamps a tuple position whose coords lie outside the window', () => {
+    const { container } = render(
+      <Popover sizes={SIZES} position={[5000, 5000]}>
+        <span>x</span>
+      </Popover>
+    )
+    const wrapper = container.firstChild as HTMLElement
+    // Both axes are outside → falls back to window center.
+    expect(wrapper.style.transform).toBe('translate(500px, 400px)')
+  })
+
+  it('honors a custom popover style override', () => {
+    const { container } = render(
+      <Popover
+        sizes={SIZES}
+        styles={{ popover: (base) => ({ ...base, padding: 0 }) }}
+      >
+        <span>x</span>
+      </Popover>
+    )
+    const wrapper = container.firstChild as HTMLElement
+    expect(wrapper.style.padding).toBe('0px')
+  })
+
+  it('falls back to auto-position when the requested side cannot fit', () => {
+    // Target way off the right edge → available.right is negative, so
+    // couldPositionAt('right', ...) returns false and we hit autoPosition.
+    const farRight = { ...SIZES, left: 1500, right: 1600, x: 1500 }
+    const { container } = render(
+      <Popover sizes={farRight} position="right">
+        <span>x</span>
+      </Popover>
+    )
+    const wrapper = container.firstChild as HTMLElement
+    // No throw and a sensible translate(...) result is enough — the exact
+    // coordinates depend on the fallback that autoPosition picks.
+    expect(wrapper.style.transform).toMatch(/^translate\(/)
+  })
+
+  it('exercises the helper-outside-X axis path without throwing', () => {
+    const farRight = { ...SIZES, left: 1500, right: 1600, x: 1500 }
+    const { container } = render(
+      <Popover sizes={farRight} position="bottom">
+        <span>x</span>
+      </Popover>
+    )
+    const wrapper = container.firstChild as HTMLElement
+    // The `!isHelperOutsideX` guard makes the explicit position fall back to
+    // autoPosition; we only verify the resulting translate is finite.
+    expect(wrapper.style.transform).toMatch(/^translate\(-?\d+px, -?\d+px\)$/)
+  })
+
+  it('clamps the helper y when the target overflows vertically', () => {
+    const farBottom = { ...SIZES, top: 750, bottom: 900, y: 750 }
+    const { container } = render(
+      <Popover sizes={farBottom} position="bottom">
+        <span>x</span>
+      </Popover>
+    )
+    const wrapper = container.firstChild as HTMLElement
+    // isHelperOutsideY branch produces a deterministic translate.
+    expect(wrapper.style.transform).toMatch(/^translate\(/)
+  })
+
+  it('falls back to window center when no side has room', () => {
+    // A target that fills nearly the entire viewport leaves no side with
+    // enough room for the helper, so autoPosition lands on 'center'.
+    const filling = {
+      top: 5,
+      left: 5,
+      right: 995,
+      bottom: 795,
+      width: 990,
+      height: 790,
+      x: 5,
+      y: 5,
+    }
+    const { container } = render(
+      <Popover sizes={filling} position="right">
+        <span>x</span>
+      </Popover>
+    )
+    const wrapper =
```

**File**: `packages/popover/package.json` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
     "dev": "tsup index.tsx --format esm,cjs --watch --dts --external react",
     "lint": "TIMING=1 eslint **/*.ts* --fix",
     "test": "vitest run",
+    "test:coverage": "vitest run --coverage",
     "test:watch": "vitest",
     "clean": "rm -rf .turbo && rm -rf node_modules && rm -rf dist"
   },
```

**File**: `packages/tour/__tests__/Badge.test.tsx` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+import React from 'react'
+import { describe, it, expect } from 'vitest'
+import { render } from '@testing-library/react'
+import Badge from '../components/Badge'
+
+describe('Badge', () => {
+  it('renders children inside a span', () => {
+    const { container } = render(<Badge>1</Badge>)
+    const span = container.querySelector('span')
+    expect(span).not.toBeNull()
+    expect(span).toHaveTextContent('1')
+  })
+
+  it('honors a custom badge style override', () => {
+    const { container } = render(
+      <Badge styles={{ badge: (base) => ({ ...base, color: 'red' }) }}>
+        7
+      </Badge>
+    )
+    const span = container.querySelector('span') as HTMLSpanElement
+    expect(span.style.color).toBe('red')
+  })
+})
```

**File**: `packages/tour/__tests__/Close.test.tsx` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import React from 'react'
+import { describe, it, expect, vi } from 'vitest'
+import { render, fireEvent, screen } from '@testing-library/react'
+import Close from '../components/Close'
+
+describe('Close', () => {
+  it('renders a button with the reactour close class', () => {
+    render(<Close onClick={() => {}} />)
+    const button = screen.getByRole('button')
+    expect(button).toHaveClass('reactour__close-button')
+  })
+
+  it('fires onClick when clicked', () => {
+    const onClick = vi.fn()
+    render(<Close onClick={onClick} />)
+    fireEvent.click(screen.getByRole('button'))
+    expect(onClick).toHaveBeenCalledTimes(1)
+  })
+
+  it('passes through aria-label', () => {
+    render(<Close onClick={() => {}} aria-label="Close Tour" />)
+    expect(screen.getByLabelText('Close Tour')).toBeInTheDocument()
+  })
+})
```

---

### Incident Patch 3: `076af597` (2026-05-15)
**Commit Message**: test: expand mask and popover suites beyond the seed cases

The mask and popover packages each had a single seed test file from the
scaffold PR, leaving padding math, position fallbacks, prop forwarding,
and style overrides uncovered.

Add 8 cases to Mask (onClickHighlighted, numeric/array padding, safe()
clamping, opt-in rx, custom wrapper styles, unique id generation) and 6
to Popover (function-position arg shape, aria-* forwarding, explicit
center, out-of-window tuple clamping, custom style override, padding
shifts the transform). Assert SVG x/y/width/height via inline style
since the library writes them as presentation CSS, not attributes.

**File**: `packages/mask/__tests__/Mask.test.tsx` (modified, +96/-0)
```diff
@@ -45,4 +45,100 @@ describe('Mask', () => {
     fireEvent.click(container.querySelector('.wrapper')!)
     expect(onClick).toHaveBeenCalledOnce()
   })
+
+  it('calls onClickHighlighted when the highlighted rect is clicked', () => {
+    const onClickHighlighted = vi.fn()
+    const { container } = render(
+      <Mask
+        sizes={SIZES}
+        highlightedAreaClassName="hl"
+        onClickHighlighted={onClickHighlighted}
+      />
+    )
+    fireEvent.click(container.querySelector('.hl')!)
+    expect(onClickHighlighted).toHaveBeenCalledOnce()
+  })
+
+  it('inflates the highlighted area by numeric padding', () => {
+    const { container } = render(
+      <Mask sizes={SIZES} padding={20} highlightedAreaClassName="hl" />
+    )
+    const rect = container.querySelector('.hl') as unknown as SVGRectElement
+    // Mask applies x/y/width/height via inline style (presentation CSS).
+    expect(rect.style.width).toBe('140px')
+    expect(rect.style.height).toBe('140px')
+    expect(rect.style.x).toBe('30px')
+    expect(rect.style.y).toBe('80px')
+  })
+
+  it('accepts an array padding (top/right/bottom/left)', () => {
+    const { container } = render(
+      <Mask sizes={SIZES} padding={[5, 10, 15, 20]} highlightedAreaClassName="hl" />
+    )
+    const rect = container.querySelector('.hl') as unknown as SVGRectElement
+    expect(rect.style.width).toBe('130px')
+    expect(rect.style.height).toBe('120px')
+    expect(rect.style.x).toBe('30px')
+    expect(rect.style.y).toBe('95px')
+  })
+
+  it('clamps negative coordinates to 0 via safe()', () => {
+    const { container } = render(
+      <Mask
+        sizes={{ ...SIZES, top: 5, left: 5 }}
+        padding={50}
+        highlightedAreaClassName="hl"
+      />
+    )
+    const rect = container.querySelector('.hl') as unknown as SVGRectElement
+    expect(rect.style.x).toBe('0')
+    expect(rect.style.y).toBe('0')
+  })
+
+  it('emits the rx attribute when the style provides rx', () => {
+    const { container } = render(
+      <Mask
+        sizes={SIZES}
+        highlightedAreaClassName="hl"
+        styles={{
+          highlightedArea: (base) => ({ ...base, rx: 4 }),
+          maskArea: (base) => ({ ...base, rx: 4 }),
+        }}
+      />
+    )
+    const highlight = container.querySelector('.hl')
+    expect(highlight?.getAttribute('rx')).toBe('1')
+    // The masked rect (no class) is the second rect inside <mask>.
+    const masked = container.querySelector('mask rect:nth-of-type(2)')
+    expect(masked?.getAttribute('rx')).toBe('1')
+  })
+
+  it('omits rx when no style provides it', () => {
+    const { container } = render(
+      <Mask sizes={SIZES} highlightedAreaClassName="hl" />
+    )
+    expect(container.querySelector('.hl')?.hasAttribute('rx')).toBe(false)
+  })
+
+  it('honors a custom maskWrapper style override', () => {
+    const { container } = render(
+      <Mask
+        sizes={SIZES}
+        className="wrapper"
+        styles={{ maskWrapper: (base) => ({ ...base, opacity: 0.3 }) }}
+      />
+    )
+    const wrapper = container.querySelector('.wrapper') as HTMLDivElement
+    expect(wrapper.style.opacity).toBe('0.3')
+  })
+
+  it('generates unique mask/clip ids across instances when none are provided', () => {
+    const { container: a } = render(<Mask sizes={SIZES} />)
+    const { container: b } = render(<Mask sizes={SIZES} />)
+    const idA = a.querySelector('mask')?.getAttribute('id')
+    const idB = b.querySelector('mask')?.getAttribute('id')
+    expect(idA).toMatch(/^mask__/)
+    expect(idB).toMatch(/^mask__/)
+    expect(idA).not.toBe(idB)
+  })
 })
```

**File**: `packages/popover/__tests__/Popover.test.tsx` (modified, +94/-1)
```diff
@@ -1,5 +1,5 @@
 import React from 'react'
-import { describe, it, expect, beforeAll } from 'vitest'
+import { describe, it, expect, beforeAll, vi } from 'vitest'
 import { render } from '@testing-library/react'
 import { Popover } from '../index'
 
@@ -67,4 +67,97 @@ describe('Popover', () => {
     const wrapper = container.firstChild as HTMLElement
     expect(wrapper.style.transform).toMatch(/^translate\(/)
   })
+
+  it('calls the function position with positional context', () => {
+    const positionFn = vi.fn(() => 'right' as const)
+    render(
+      <Popover sizes={SIZES} position={positionFn}>
+        <span>x</span>
+      </Popover>
+    )
+    // useRect's mount setState triggers a re-render so the spy is called more
+    // than once; we only care that the first invocation gets the expected shape.
+    expect(positionFn).toHaveBeenCalled()
+    const args = positionFn.mock.calls[0]
+    expect(args[0]).toMatchObject({
+      windowWidth: 1000,
+      windowHeight: 800,
+      // padding=10 default → targetTop = 100 - 10 = 90.
+      top: 90,
+      left: 40,
+      right: 160,
+      bottom: 210,
+    })
+  })
+
+  it('forwards arbitrary props (aria-*) to the popover element', () => {
+    const { container } = render(
+      <Popover sizes={SIZES} aria-labelledby="step-title">
+        <span>x</span>
+      </Popover>
+    )
+    const wrapper = container.firstChild as HTMLElement
+    expect(wrapper.getAttribute('aria-labelledby')).toBe('step-title')
+  })
+
+  it('renders explicit center position centered on the window', () => {
+    const { container } = render(
+      <Popover sizes={SIZES} position="center">
+        <span>x</span>
+      </Popover>
+    )
+    const wrapper = container.firstChild as HTMLElement
+    // helperRect width/height start at 0 in jsdom, so center = (windowWidth/2, windowHeight/2).
+    expect(wrapper.style.transform).toBe('translate(500px, 400px)')
+  })
+
+  it('clamps a tuple position whose coords lie outside the window', () => {
+    const { container } = render(
+      <Popover sizes={SIZES} position={[5000, 5000]}>
+        <span>x</span>
+      </Popover>
+    )
+    const wrapper = container.firstChild as HTMLElement
+    // Both axes are outside → falls back to window center.
+    expect(wrapper.style.transform).toBe('translate(500px, 400px)')
+  })
+
+  it('honors a custom popover style override', () => {
+    const { container } = render(
+      <Popover
+        sizes={SIZES}
+        styles={{ popover: (base) => ({ ...base, padding: 0 }) }}
+      >
+        <span>x</span>
+      </Popover>
+    )
+    const wrapper = container.firstChild as HTMLElement
+    expect(wrapper.style.padding).toBe('0px')
+  })
+
+  it('respects padding when computing the transform', () => {
+    const { container: a } = render(
+      <Popover sizes={SIZES} position="bottom">
+        <span>x</span>
+      </Popover>
+    )
+    const { container: b } = render(
+      <Popover sizes={SIZES} position="bottom" padding={40}>
+        <span>x</span>
+      </Popover>
+    )
+    // Larger padding pushes the popover further away from the target.
+    expect(a.firstChild).not.toEqual(b.firstChild)
+    const aY = parseInt(
+      ((a.firstChild as HTMLElement).style.transform.match(/(-?\d+)px\)$/) ||
+        [])[1] || '0',
+      10
+    )
+    const bY = parseInt(
+      ((b.firstChild as HTMLElement).style.transform.match(/(-?\d+)px\)$/) ||
+        [])[1] || '0',
+      10
+    )
+    expect(bY).toBeGreaterThan(aY)
+  })
 })
```

---

### Incident Patch 4: `af2e766a` (2026-05-15)
**Commit Message**: test(tour): expand tour package suite to 41 cases

The tour package only had seed tests for Context and Keyboard (10 cases),
leaving the core navigation, close, badge, and PopoverContent flows
uncovered on top of the recently-landed vitest+RTL scaffold.

Add three new component test files (Navigation, Close, Badge) and a
PopoverContent integration test, plus extend Context with controlled
state, setSteps/setMeta/setDisabledActions, and Tour mount/unmount on
isOpen toggle.

**File**: `packages/tour/__tests__/Badge.test.tsx` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+import React from 'react'
+import { describe, it, expect } from 'vitest'
+import { render } from '@testing-library/react'
+import Badge from '../components/Badge'
+
+describe('Badge', () => {
+  it('renders children inside a span', () => {
+    const { container } = render(<Badge>1</Badge>)
+    const span = container.querySelector('span')
+    expect(span).not.toBeNull()
+    expect(span).toHaveTextContent('1')
+  })
+
+  it('honors a custom badge style override', () => {
+    const { container } = render(
+      <Badge styles={{ badge: (base) => ({ ...base, color: 'red' }) }}>
+        7
+      </Badge>
+    )
+    const span = container.querySelector('span') as HTMLSpanElement
+    expect(span.style.color).toBe('red')
+  })
+})
```

**File**: `packages/tour/__tests__/Close.test.tsx` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import React from 'react'
+import { describe, it, expect, vi } from 'vitest'
+import { render, fireEvent, screen } from '@testing-library/react'
+import Close from '../components/Close'
+
+describe('Close', () => {
+  it('renders a button with the reactour close class', () => {
+    render(<Close onClick={() => {}} />)
+    const button = screen.getByRole('button')
+    expect(button).toHaveClass('reactour__close-button')
+  })
+
+  it('fires onClick when clicked', () => {
+    const onClick = vi.fn()
+    render(<Close onClick={onClick} />)
+    fireEvent.click(screen.getByRole('button'))
+    expect(onClick).toHaveBeenCalledTimes(1)
+  })
+
+  it('passes through aria-label', () => {
+    render(<Close onClick={() => {}} aria-label="Close Tour" />)
+    expect(screen.getByLabelText('Close Tour')).toBeInTheDocument()
+  })
+})
```

**File**: `packages/tour/__tests__/Context.test.tsx` (modified, +107/-1)
```diff
@@ -1,5 +1,5 @@
 import React from 'react'
-import { describe, it, expect, beforeAll } from 'vitest'
+import { describe, it, expect, beforeAll, vi } from 'vitest'
 import { render, act } from '@testing-library/react'
 import { TourProvider, useTour } from '../Context'
 
@@ -74,4 +74,110 @@ describe('TourProvider + useTour', () => {
     })
     expect(snapshot?.currentStep).toBe(1)
   })
+
+  it('setSteps replaces the steps array', () => {
+    let snapshot: ReturnType<typeof useTour> | undefined
+    function Probe() {
+      snapshot = useTour()
+      return null
+    }
+    render(
+      <TourProvider steps={steps}>
+        <Probe />
+      </TourProvider>
+    )
+    const next = [{ selector: '#c', content: 'Step C' }]
+    act(() => {
+      snapshot?.setSteps?.(next)
+    })
+    expect(snapshot?.steps).toEqual(next)
+  })
+
+  it('setMeta updates exposed meta', () => {
+    let snapshot: ReturnType<typeof useTour> | undefined
+    function Probe() {
+      snapshot = useTour()
+      return null
+    }
+    render(
+      <TourProvider steps={steps}>
+        <Probe />
+      </TourProvider>
+    )
+    act(() => {
+      snapshot?.setMeta?.('hello')
+    })
+    expect(snapshot?.meta).toBe('hello')
+  })
+
+  it('setDisabledActions toggles disabledActions', () => {
+    let snapshot: ReturnType<typeof useTour> | undefined
+    function Probe() {
+      snapshot = useTour()
+      return null
+    }
+    render(
+      <TourProvider steps={steps}>
+        <Probe />
+      </TourProvider>
+    )
+    expect(snapshot?.disabledActions).toBe(false)
+    act(() => {
+      snapshot?.setDisabledActions?.(true)
+    })
+    expect(snapshot?.disabledActions).toBe(true)
+  })
+
+  it('honors a custom controlled setCurrentStep', () => {
+    const customSetCurrentStep = vi.fn()
+    let snapshot: ReturnType<typeof useTour> | undefined
+    function Probe() {
+      snapshot = useTour()
+      return null
+    }
+    render(
+      <TourProvider
+        steps={steps}
+        currentStep={1}
+        setCurrentStep={customSetCurrentStep}
+      >
+        <Probe />
+      </TourProvider>
+    )
+    expect(snapshot?.currentStep).toBe(1)
+    expect(snapshot?.setCurrentStep).toBe(customSetCurrentStep)
+    act(() => {
+      snapshot?.setCurrentStep(2)
+    })
+    expect(customSetCurrentStep).toHaveBeenCalledWith(2)
+  })
+
+  it('mounts Tour only when isOpen is true', () => {
+    const target = document.createElement('div')
+    target.id = 'a'
+    document.body.appendChild(target)
+
+    let snapshot: ReturnType<typeof useTour> | undefined
+    function Probe() {
+      snapshot = useTour()
+      return null
+    }
+    const { container } = render(
+      <TourProvider steps={steps}>
+        <Probe />
+      </TourProvider>
+    )
+    // Tour mounts a Mask <div>; while closed nothing extra is rendered.
+    expect(container.querySelectorAll('div').length).toBe(0)
+    act(() => {
+      snapshot?.setIsOpen(true)
+    })
+    expect(document.querySelector('.reactour__mask')).not.toBeNull()
+    act(() => {
+      snapshot?.setIsOpen(false)
+    })
+    expect(document.querySelector('.reactour__mask')).toBeNull()
+
+    document.body.removeChild(target)
+  })
 })
```

**File**: `packages/tour/__tests__/Navigation.test.tsx` (added, +160/-0)
```diff
@@ -0,0 +1,160 @@
+import React from 'react'
+import { describe, it, expect, vi } from 'vitest'
+import { render, fireEvent, screen } from '@testing-library/react'
+import Navigation from '../components/Navigation'
+
+const steps = [
+  { selector: '#a', content: 'A' },
+  { selector: '#b', content: 'B' },
+  { selector: '#c', content: 'C' },
+]
+
+const baseProps = {
+  steps,
+  setCurrentStep: vi.fn(),
+  setIsOpen: vi.fn(),
+  currentStep: 0,
+}
+
+describe('Navigation', () => {
+  it('renders one button per step as a dot plus prev/next', () => {
+    render(<Navigation {...baseProps} />)
+    // 3 dots + prev + next = 5 buttons.
+    expect(screen.getAllByRole('button')).toHaveLength(5)
+    expect(screen.getByLabelText('Go to next step')).toBeInTheDocument()
+    expect(screen.getByLabelText('Go to prev step')).toBeInTheDocument()
+  })
+
+  it('advances on next click', () => {
+    const setCurrentStep = vi.fn()
+    render(
+      <Navigation
+        {...baseProps}
+        setCurrentStep={setCurrentStep}
+        currentStep={0}
+      />
+    )
+    fireEvent.click(screen.getByLabelText('Go to next step'))
+    expect(setCurrentStep).toHaveBeenCalledWith(1)
+  })
+
+  it('goes back on prev click', () => {
+    const setCurrentStep = vi.fn()
+    render(
+      <Navigation
+        {...baseProps}
+        setCurrentStep={setCurrentStep}
+        currentStep={2}
+      />
+    )
+    fireEvent.click(screen.getByLabelText('Go to prev step'))
+    expect(setCurrentStep).toHaveBeenCalledWith(1)
+  })
+
+  it('caps next at last step', () => {
+    const setCurrentStep = vi.fn()
+    render(
+      <Navigation
+        {...baseProps}
+        setCurrentStep={setCurrentStep}
+        currentStep={2}
+      />
+    )
+    fireEvent.click(screen.getByLabelText('Go to next step'))
+    // Math.min(2 + 1, 3 - 1) === 2; still called, but stays at 2.
+    expect(setCurrentStep).toHaveBeenCalledWith(2)
+  })
+
+  it('floors prev at 0', () => {
+    const setCurrentStep = vi.fn()
+    render(
+      <Navigation
+        {...baseProps}
+        setCurrentStep={setCurrentStep}
+        currentStep={0}
+      />
+    )
+    fireEvent.click(screen.getByLabelText('Go to prev step'))
+    expect(setCurrentStep).toHaveBeenCalledWith(0)
+  })
+
+  it('jumps to a step when a dot is clicked', () => {
+    const setCurrentStep = vi.fn()
+    render(
+      <Navigation {...baseProps} setCurrentStep={setCurrentStep} />
+    )
+    fireEvent.click(screen.getByLabelText('Go to step 3'))
+    expect(setCurrentStep).toHaveBeenCalledWith(2)
+  })
+
+  it('uses navDotAriaLabel when provided', () => {
+    const labeledSteps = [
+      { selector: '#a', content: 'A', navDotAriaLabel: 'Intro dot' },
+      { selector: '#b', content: 'B' },
+    ]
+    render(<Navigation {...baseProps} steps={labeledSteps} />)
+    expect(screen.getByLabelText('Intro dot')).toBeInTheDocument()
+    expect(screen.getByLabelText('Go to step 2')).toBeInTheDocument()
+  })
+
+  it('hides nav buttons when hideButtons is set', () => {
+    render(<Navigation {...baseProps} hideButtons />)
+    expect(screen.queryByLabelText('Go to next step')).toBeNull()
+    expect(screen.queryByLabelText('Go to prev step')).toBeNull()
+    // Dots remain.
+    expect(screen.getAllByRole('button')).toHaveLength(3)
+  })
+
+  it('hides dots when hideDots is set', () => {
+    render(<Navigation {...baseProps} hideDots />)
+    expect(screen.queryByLabelText('Go to step 1')).toBeNull()
+    expect(screen.getAllByRole('button')).toHaveLength(2)
+  })
+
+  it('disableDots blocks dot clicks but not buttons', () => {
+    const setCurrentStep = vi.fn()
+    render(
+      <Navigation
+        {...baseProps}
+        disableDots
+        setCurrentStep={setCurrentStep}
+      />
+    )
+    fireEvent.click(screen.getByLabelText('Go to step 2'))
+    expect(setCurrentStep).not.toHaveBeenCalled()
+    fireEvent.click(screen.getByLabelText('Go to next step'))
+    expect(setCurrentStep).toHaveBeenCalledWith(1)
+  })
+
+  it('disableAll blocks every interaction', () => {
+    const setCurrentStep = vi.fn()
+    render(
+      <Navigation
+        {...baseProps}
+        disableAll
+        setCurrentStep={setCurrentStep}
+      />
+    )
+    fireEvent.click(screen.getByLabelText('Go to next step'))
+    fireEvent.click(screen.getByLabelText('Go to prev step'))
+    fireEvent.click(screen.getByLabelText('Go to step 2'))
+    expect(setCurrentStep).not.toHaveBeenCalled()
+  })
+
+  it('rtl flips the container direction', () => {
+    const { container } = render(<Navigation {...baseProps} rtl />)
+    expect(container.firstChild).toHaveAttribute('dir', 'rtl')
+  })
+
+  it('lets a custom nextButton render prop replace the next button', () => {
+    const nextButton = vi.fn(({ currentStep, stepsLength }) => (
+      <button aria-label="custom-next">
+        {currentStep + 1}/{stepsLength}
+      </button>
+    ))
+    render(<Navigation {...baseProps} nextButton={nextButton} />)
+   
```

**File**: `packages/tour/__tests__/PopoverContent.test.tsx` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+import React from 'react'
+import { describe, it, expect, vi } from 'vitest'
+import { render, fireEvent, screen } from '@testing-library/react'
+import PopoverContent from '../components/PopoverContent'
+
+const steps = [
+  { selector: '#a', content: 'Welcome' },
+  { selector: '#b', content: 'Second step' },
+  { selector: '#c', content: 'Last step' },
+]
+
+const baseProps = {
+  styles: {},
+  steps,
+  setCurrentStep: vi.fn(),
+  setIsOpen: vi.fn(),
+  currentStep: 0,
+  setSteps: vi.fn(),
+  setMeta: vi.fn(),
+  meta: '',
+}
+
+describe('PopoverContent', () => {
+  it('renders the current step content, badge, close, and nav by default', () => {
+    render(<PopoverContent {...baseProps} />)
+    // Step text.
+    expect(screen.getByText('Welcome')).toBeInTheDocument()
+    // Default badge = currentStep + 1.
+    expect(screen.getByText('1')).toBeInTheDocument()
+    // Close button + 2 nav buttons + 3 dots = 6.
+    expect(screen.getAllByRole('button')).toHaveLength(6)
+  })
+
+  it('supports a function content render-prop', () => {
+    const content = vi.fn(({ currentStep }) => (
+      <div>step is {currentStep}</div>
+    ))
+    const dynamicSteps = [{ selector: '#a', content }]
+    render(
+      <PopoverContent {...baseProps} steps={dynamicSteps} currentStep={0} />
+    )
+    expect(screen.getByText('step is 0')).toBeInTheDocument()
+    expect(content).toHaveBeenCalled()
+  })
+
+  it('renders a custom badgeContent function', () => {
+    const badgeContent = vi.fn(
+      ({ currentStep, totalSteps }) => `${currentStep + 1} of ${totalSteps}`
+    )
+    render(
+      <PopoverContent
+        {...baseProps}
+        currentStep={1}
+        badgeContent={badgeContent}
+      />
+    )
+    expect(screen.getByText('2 of 3')).toBeInTheDocument()
+    expect(badgeContent).toHaveBeenCalledWith(
+      expect.objectContaining({ currentStep: 1, totalSteps: 3 })
+    )
+  })
+
+  it('hides badge, close, and navigation when their show* flags are false', () => {
+    render(
+      <PopoverContent
+        {...baseProps}
+        showBadge={false}
+        showCloseButton={false}
+        showNavigation={false}
+      />
+    )
+    expect(screen.queryByText('1')).toBeNull()
+    // No buttons at all once everything optional is hidden.
+    expect(screen.queryAllByRole('button')).toHaveLength(0)
+    // Content still renders.
+    expect(screen.getByText('Welcome')).toBeInTheDocument()
+  })
+
+  it('clicking the close button calls setIsOpen(false) by default', () => {
+    const setIsOpen = vi.fn()
+    const { container } = render(
+      <PopoverContent {...baseProps} setIsOpen={setIsOpen} />
+    )
+    fireEvent.click(container.querySelector('.reactour__close-button')!)
+    expect(setIsOpen).toHaveBeenCalledWith(false)
+  })
+
+  it('calls a custom onClickClose handler with clickProps', () => {
+    const onClickClose = vi.fn()
+    const setIsOpen = vi.fn()
+    const { container } = render(
+      <PopoverContent
+        {...baseProps}
+        setIsOpen={setIsOpen}
+        onClickClose={onClickClose}
+      />
+    )
+    fireEvent.click(container.querySelector('.reactour__close-button')!)
+    expect(onClickClose).toHaveBeenCalledWith(
+      expect.objectContaining({
+        currentStep: 0,
+        steps,
+        setIsOpen,
+      })
+    )
+    // Custom handler replaces the default close, so setIsOpen isn't auto-called.
+    expect(setIsOpen).not.toHaveBeenCalled()
+  })
+
+  it('disabledActions blocks the close click handler', () => {
+    const onClickClose = vi.fn()
+    const setIsOpen = vi.fn()
+    const { container } = render(
+      <PopoverContent
+        {...baseProps}
+        disabledActions
+        onClickClose={onClickClose}
+        setIsOpen={setIsOpen}
+      />
+    )
+    fireEvent.click(container.querySelector('.reactour__close-button')!)
+    expect(onClickClose).not.toHaveBeenCalled()
+    expect(setIsOpen).not.toHaveBeenCalled()
+  })
+
+  it('uses accessibilityOptions.closeButtonAriaLabel', () => {
+    render(
+      <PopoverContent
+        {...baseProps}
+        accessibilityOptions={{
+          closeButtonAriaLabel: 'Dismiss tour',
+          showNavigationScreenReaders: true,
+        }}
+      />
+    )
+    expect(screen.getByLabelText('Dismiss tour')).toBeInTheDocument()
+  })
+})
```

---

### Incident Patch 5: `34ec5321` (2025-08-27)
**Commit Message**: Merge branch 'A-Veereshwar-bugFix_by_veereshwar'

**File**: `apps/docs/app/mask/props/page.mdx` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ Type: `number | number[]`
 
 Extra space to add between viewport with and height.
 
-<ToggleBox title="Sapce calculation">
+<ToggleBox title="Space calculation">
   Calculation is based on [padding shorthand
   syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/padding#syntax)
   <OptionTable
```

**File**: `apps/docs/app/popover/props/page.mdx` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ Type: `number | number[]`
 
 Extra space to add in _Popover_ calculations. Useful when calculating space from _Element_ bounding rect and want to add more space.
 
-<ToggleBox title="Sapce calculation">
+<ToggleBox title="Space calculation">
   Calculation is based on [padding shorthand
   syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/padding#syntax)
   <OptionTable
```

---

### Incident Patch 6: `7106182a` (2025-08-26)
**Commit Message**: [ bugFix] - docs: fix typo 'Sapce' -> 'Space' in mask props section

**File**: `apps/docs/app/mask/props/page.mdx` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ Type: `number | number[]`
 
 Extra space to add between viewport with and height.
 
-<ToggleBox title="Sapce calculation">
+<ToggleBox title="Space calculation">
   Calculation is based on [padding shorthand
   syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/padding#syntax)
   <OptionTable
```

**File**: `apps/docs/app/popover/props/page.mdx` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ Type: `number | number[]`
 
 Extra space to add in _Popover_ calculations. Useful when calculating space from _Element_ bounding rect and want to add more space.
 
-<ToggleBox title="Sapce calculation">
+<ToggleBox title="Space calculation">
   Calculation is based on [padding shorthand
   syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/padding#syntax)
   <OptionTable
```

---

### Incident Patch 7: `67bc62c3` (2025-07-28)
**Commit Message**: Fix ads styles

**File**: `apps/docs/app/globals.css` (modified, +25/-1)
```diff
@@ -4,4 +4,28 @@
 @import 'nextra-theme-docs/style.css';
 /* or nextra-theme-blog/style.css */
 
-@variant dark (&:where(.dark *));
\ No newline at end of file
+@variant dark (&:where(.dark *));
+
+#carbon-responsive {
+    position: fixed;
+    max-inline-size: 70px !important;
+    bottom: 0;
+    left: 2px;
+    font-size: 10px !important;
+}
+
+@media (width >=40rem) {
+    #carbon-responsive {
+        bottom: 70px;
+        left: 10px;
+        max-inline-size: 240px !important;
+        font-size: 14px !important;
+    }
+}
+
+@media (width >=80rem) {
+    #carbon-responsive {
+        right: 10px;
+        left: auto;
+    }
+}
\ No newline at end of file
```

**File**: `apps/docs/app/layout.js` (modified, +11/-5)
```diff
@@ -97,10 +97,6 @@ const footer = (
 export default async function RootLayout({ children }) {
   return (
     <html lang="en" dir="ltr" suppressHydrationWarning>
-      <Script
-        src="//cdn.carbonads.com/carbon.js?serve=CWYI623E&placement=wwwreacttours&format=responsive"
-        id="_carbonads_js"
-      />
       <Script src="https://www.googletagmanager.com/gtag/js?id=G-ZQ9SP2F9PW" />
       <Script id="google-analytics">
         {`
@@ -118,7 +114,17 @@ export default async function RootLayout({ children }) {
           pageMap={await getPageMap()}
           docsRepositoryBase="https://github.com/elrumordelaluz/reactour/tree/main/apps/docs"
           footer={footer}
-          toc={{ backToTop: true }}
+          toc={{
+            backToTop: true,
+            extraContent: (
+              <>
+                <Script
+                  src="//cdn.carbonads.com/carbon.js?serve=CWYI623E&placement=wwwreacttours&format=responsive"
+                  id="_carbonads_js"
+                />
+              </>
+            ),
+          }}
           sidebar={{ toggleButton: true, defaultMenuCollapseLevel: 1 }}
           feedback={{
             content: 'Question? Give us feedback →',
```

---

### Incident Patch 8: `bc52b569` (2025-05-26)
**Commit Message**: Fix search

closes #671

**File**: `apps/docs/package.json` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     "dev": "next --turbopack",
     "build": "next build && pnpm postbuild",
     "start": "next start",
-    "postbuild": "pagefind --site .next/server/app --output-path out/_pagefind"
+    "postbuild": "pagefind --site .next/server/app --output-path public/_pagefind"
   },
   "devDependencies": {
     "pagefind": "^1.3.0"
```

---

### Incident Patch 9: `a2fe08bd` (2025-05-15)
**Commit Message**: Fix words.

Closes #667 #668

**File**: `apps/docs/app/popover/quickstart/page.mdx` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# Install and use the Mask
+# Install and use the Popover
 
 A popover positioned based on certain values
 
```

**File**: `apps/docs/app/tour/quickstart/page.mdx` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# Install and use the Mask
+# Install and use the Tour
 
 Tourist Guide into your React Components
 
```

---

### Incident Patch 10: `d48d3c7e` (2025-05-07)
**Commit Message**: (temp) Avoid build /apps/docs

**File**: `package.json` (modified, +2/-2)
```diff
@@ -7,14 +7,14 @@
     "packages/*"
   ],
   "scripts": {
-    "build": "turbo run build --filter=!./apps/docs",
+    "build": "turbo run build",
     "dev": "turbo run dev --no-cache --parallel --continue",
     "lint": "turbo run lint",
     "clean": "turbo run clean && rm -rf node_modules",
     "format": "prettier --write \"**/*.{ts,tsx,md,mdx}\"",
     "changeset": "changeset",
     "version-packages": "changeset version",
-    "release": "turbo run build && changeset publish"
+    "release": "turbo run build --filter=!./apps/docs && changeset publish"
   },
   "devDependencies": {
     "eslint-plugin-prettier": "^5.4.0",
```

---

### Incident Patch 11: `d0d71c70` (2025-05-07)
**Commit Message**: (temp) Avoid build /apps/docs

**File**: `apps/docs/next-env.d.ts` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 /// <reference types="next/image-types/global" />
 
 // NOTE: This file should not be edited
-// see https://nextjs.org/docs/pages/building-your-application/configuring/typescript for more information.
+// see https://nextjs.org/docs/pages/api-reference/config/typescript for more information.
```

**File**: `apps/web/next-env.d.ts` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 /// <reference types="next/image-types/global" />
 
 // NOTE: This file should not be edited
-// see https://nextjs.org/docs/pages/building-your-application/configuring/typescript for more information.
+// see https://nextjs.org/docs/pages/api-reference/config/typescript for more information.
```

**File**: `apps/web/package.json` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
     "body-scroll-lock": "^4.0.0-beta.0",
     "framer-motion": "^12.10.0",
     "modaaals": "^1.1.2",
-    "next": "14.2.15",
+    "next": "15.3.2",
     "react": "19.1.0",
     "react-device-detect": "^2.2.3",
     "react-dom": "19.1.0"
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
     "packages/*"
   ],
   "scripts": {
-    "build": "turbo run build",
+    "build": "turbo run build --filter=!./apps/docs",
     "dev": "turbo run dev --no-cache --parallel --continue",
     "lint": "turbo run lint",
     "clean": "turbo run clean && rm -rf node_modules",
```

**File**: `packages/config/package.json` (modified, +2/-2)
```diff
@@ -7,8 +7,8 @@
     "eslint-preset.js"
   ],
   "dependencies": {
-    "eslint-config-next": "^14.2.15",
-    "eslint-config-prettier": "^9.1.0",
+    "eslint-config-next": "^15.3.2",
+    "eslint-config-prettier": "^10.1.3",
     "eslint-plugin-react": "7.37.5"
   }
 }
```

**File**: `yarn.lock` (modified, +116/-203)
```diff
@@ -1958,112 +1958,57 @@
     "@emnapi/runtime" "^1.4.0"
     "@tybys/wasm-util" "^0.9.0"
 
-"@next/env@14.2.15":
-  version "14.2.15"
-  resolved "https://registry.yarnpkg.com/@next/env/-/env-14.2.15.tgz#06d984e37e670d93ddd6790af1844aeb935f332f"
-  integrity sha512-S1qaj25Wru2dUpcIZMjxeMVSwkt8BK4dmWHHiBuRstcIyOsMapqT4A4jSB6onvqeygkSSmOkyny9VVx8JIGamQ==
-
-"@next/env@14.2.28":
-  version "14.2.28"
-  resolved "https://registry.yarnpkg.com/@next/env/-/env-14.2.28.tgz#4bfeac21949743bfc8d09cfc223439112bcd2538"
-  integrity sha512-PAmWhJfJQlP+kxZwCjrVd9QnR5x0R3u0mTXTiZDgSd4h5LdXmjxCCWbN9kq6hkZBOax8Rm3xDW5HagWyJuT37g==
-
-"@next/eslint-plugin-next@14.2.28":
-  version "14.2.28"
-  resolved "https://registry.yarnpkg.com/@next/eslint-plugin-next/-/eslint-plugin-next-14.2.28.tgz#831aa5955c96503bf515561cf7b307097b65bbd8"
-  integrity sha512-GQUPA1bTZy5qZdPV5MOHB18465azzhg8xm5o2SqxMF+h1rWNjB43y6xmIPHG5OV2OiU3WxuINpusXom49DdaIQ==
-  dependencies:
-    glob "10.3.10"
-
-"@next/swc-darwin-arm64@14.2.15":
-  version "14.2.15"
-  resolved "https://registry.yarnpkg.com/@next/swc-darwin-arm64/-/swc-darwin-arm64-14.2.15.tgz#6386d585f39a1c490c60b72b1f76612ba4434347"
-  integrity sha512-Rvh7KU9hOUBnZ9TJ28n2Oa7dD9cvDBKua9IKx7cfQQ0GoYUwg9ig31O2oMwH3wm+pE3IkAQ67ZobPfEgurPZIA==
-
-"@next/swc-darwin-arm64@14.2.28":
-  version "14.2.28"
-  resolved "https://registry.yarnpkg.com/@next/swc-darwin-arm64/-/swc-darwin-arm64-14.2.28.tgz#b65bdd4f95eb883ca621d96563baa54ac7df6e3c"
-  integrity sha512-kzGChl9setxYWpk3H6fTZXXPFFjg7urptLq5o5ZgYezCrqlemKttwMT5iFyx/p1e/JeglTwDFRtb923gTJ3R1w==
-
-"@next/swc-darwin-x64@14.2.15":
-  version "14.2.15"
-  resolved "https://registry.yarnpkg.com/@next/swc-darwin-x64/-/swc-darwin-x64-14.2.15.tgz#b7baeedc6a28f7545ad2bc55adbab25f7b45cb89"
-  integrity sha512-5TGyjFcf8ampZP3e+FyCax5zFVHi+Oe7sZyaKOngsqyaNEpOgkKB3sqmymkZfowy3ufGA/tUgDPPxpQx931lHg==
-
-"@next/swc-darwin-x64@14.2.28":
-  version "14.2.28"
-  resolved "https://registry.yarnpkg.com/@next/swc-darwin-x64/-/swc-darwin-x64-14.2.28.tgz#1dc7d4a27927043ec3259b88044f11cce1219be4"
-  integrity sha512-z6FXYHDJlFOzVEOiiJ/4NG8aLCeayZdcRSMjPDysW297Up6r22xw6Ea9AOwQqbNsth8JNgIK8EkWz2IDwaLQcw==
-
-"@next/swc-linux-arm64-gnu@14.2.15":
-  version "14.2.15"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-14.2.15.tgz#fa13c59d3222f70fb4cb3544ac750db2c6e34d02"
-  integrity sha512-3Bwv4oc08ONiQ3FiOLKT72Q+ndEMyLNsc/D3qnLMbtUYTQAmkx9E/JRu0DBpHxNddBmNT5hxz1mYBphJ3mfrrw==
-
-"@next/swc-linux-arm64-gnu@14.2.28":
-  version "14.2.28"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-14.2.28.tgz#a4c6a805a821bb59fc66baa18236ddcfdb62e515"
-  integrity sha512-9ARHLEQXhAilNJ7rgQX8xs9aH3yJSj888ssSjJLeldiZKR4D7N08MfMqljk77fAwZsWwsrp8ohHsMvurvv9liQ==
-
-"@next/swc-linux-arm64-musl@14.2.15":
-  version "14.2.15"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-14.2.15.tgz#30e45b71831d9a6d6d18d7ac7d611a8d646a17f9"
-  integrity sha512-k5xf/tg1FBv/M4CMd8S+JL3uV9BnnRmoe7F+GWC3DxkTCD9aewFRH1s5rJ1zkzDa+Do4zyN8qD0N8c84Hu96FQ==
-
-"@next/swc-linux-arm64-musl@14.2.28":
-  version "14.2.28"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-14.2.28.tgz#1b8cd8c9acdba9e591661f36dc3e04ef805c6701"
-  integrity sha512-p6gvatI1nX41KCizEe6JkF0FS/cEEF0u23vKDpl+WhPe/fCTBeGkEBh7iW2cUM0rvquPVwPWdiUR6Ebr/kQWxQ==
-
-"@next/swc-linux-x64-gnu@14.2.15":
-  version "14.2.15"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-14.2.15.tgz#5065db17fc86f935ad117483f21f812dc1b39254"
-  integrity sha512-kE6q38hbrRbKEkkVn62reLXhThLRh6/TvgSP56GkFNhU22TbIrQDEMrO7j0IcQHcew2wfykq8lZyHFabz0oBrA==
-
-"@next/swc-linux-x64-gnu@14.2.28":
-  version "14.2.28"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-14.2.28.tgz#ba796651b1214b3e8a8aa34398c432b8defbe325"
-  integrity sha512-nsiSnz2wO6GwMAX2o0iucONlVL7dNgKUqt/mDTATGO2NY59EO/ZKnKEr80BJFhuA5UC1KZOMblJHWZoqIJddpA==
-
-"@next/swc-linux-x64-musl@14.2.15":
-  version "14.2.15"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-14.2.15.tgz#3c4a4568d8be7373a820f7576cf33388b5dab47e"
-  integrity sha512-PZ5YE9ouy/IdO7QVJeIcyLn/Rc4ml9M2G4y3kCM9MNf1YKvFY4heg3pVa/jQbMro+tP6yc4G2o9LjAz1zxD7tQ==
-
-"@next/swc-linux-x64-musl@14.2.28":
-  version "14.2.28"
-  resolved "https://registry.yarnpkg.com/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-14.2.28.tgz#d1127560ca2aec303daded021b51d9cd49f9f5ca"
-  integrity sha512-+IuGQKoI3abrXFqx7GtlvNOpeExUH1mTIqCrh1LGFf8DnlUcTmOOCApEnPJUSLrSbzOdsF2ho2KhnQoO0I1RDw==
-
-"@next/swc-win32-arm64-msvc@14.2.15":
-  version "14.2.15"
-  resolved "https://registry.yarnpkg.com/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-14.2.15.tgz#fb812cc4ca0042868e32a6a021da91943bb08b98"
-  integrity sha512-2raR16703kBvYEQD9HNLyb0/394yfqzmIeyp2nDzcPV4yPjqNUG3ohX6jX00WryXz6s1FXpVhsCo3i+g4RUX+g==
-
-"@
```

---

### Incident Patch 12: `4d822cb8` (2024-12-19)
**Commit Message**: fix(docs): carbon ads overlapping entire screen on desktop

**File**: `apps/docs/style.css` (modified, +2/-1)
```diff
@@ -29,9 +29,10 @@ code.text-\[\.9em\] {
 @media (min-width: 768px) {
   #carbonads {
     top: 80px;
+    height: fit-content;
   }
 
   nav.nextra-toc .nextra-scrollbar {
     top: 200px;
   }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 13: `6e1907d4` (2024-09-21)
**Commit Message**: [Issue-643] Fix the text in Step 12 demo

**File**: `apps/web/components/config.tsx` (modified, +2/-2)
```diff
@@ -127,15 +127,15 @@ const tourConfig: StepType[] = [
   {
     selector: '[data-tut="reactour__highlighted"]',
     content:
-      'Moreover you can highlight multiple elements and adjust highlighted region depending on DOM resizes and mutations. Try clicking the "?" tooltip and playing with tabs...',
+      'Moreover you can highlight multiple elements and adjust highlighted region depending on DOM resizes and mutations. Try clicking the "Open Modal" button and playing with tabs...',
     highlightedSelectors: ['[data-tut="reactour__highlighted-absolute-child"]'],
     mutationObservables: ['[data-tut="reactour__highlighted-absolute-child"]'],
     resizeObservables: ['[data-tut="reactour__highlighted-absolute-child"]'],
   },
   {
     selector: '[data-tour="open_modal"]',
     content:
-      'Moreover you can highlight multiple elements and adjust highlighted region depending on DOM resizes and mutations. Try clicking the "?" tooltip and playing with tabs...',
+      'Moreover you can highlight multiple elements and adjust highlighted region depending on DOM resizes and mutations. Try clicking the "Open Modal" button and playing with tabs...',
     highlightedSelectors: ['.modaaals-modal'],
     mutationObservables: ['#portaaal'],
   },
```

---

### Incident Patch 14: `bcd512c9` (2024-07-22)
**Commit Message**: Fix recurring typo (change "Exmple" to "Example")

**File**: `apps/docs/pages/tour/props.mdx` (modified, +4/-4)
```diff
@@ -111,7 +111,7 @@ Available Components and its `props`
 />
 </ToggleBox>
 
-<ToggleBox title="Exmple">
+<ToggleBox title="Example">
 
 ```js
 import { components } from '@reactour/tour'
@@ -384,7 +384,7 @@ Click handler for highlighted area. Only works when `disableInteraction` is acti
 
 Useful in case is needed to avoid `onClickMask` when clicking the highlighted element.
 
- <ToggleBox title="Exmple">
+ <ToggleBox title="Example">
 
 ```js
 <TourProvider
@@ -431,7 +431,7 @@ Function to handle keyboard events in a custom way.
   Type: `(e: KeyboardEvent, clickProps?: ClickProps, status?: { isEscDisabled?: boolean, isRightDisabled?: boolean, isLeftDisabled?: boolean }) => void`
 </ToggleBox>
 
-<ToggleBox title="Exmple">
+<ToggleBox title="Example">
 
 ```js
 <TourProvider
@@ -594,7 +594,7 @@ Completelly custom component to render inside the [Popover](/popover/quickstart)
   />
 </ToggleBox>
 
-<ToggleBox title="Exmple">
+<ToggleBox title="Example">
 
 ```js
 function ContentComponent(props) {
```

---

### Incident Patch 15: `78a6c8f3` (2024-06-20)
**Commit Message**: Fix issue with padding calculations

**File**: `apps/docs/package.json` (modified, +6/-6)
```diff
@@ -10,13 +10,13 @@
     "start": "next start"
   },
   "dependencies": {
-    "@codesandbox/sandpack-react": "^2.13.10",
+    "@codesandbox/sandpack-react": "^2.14.4",
     "@codesandbox/sandpack-themes": "^2.0.21",
     "@vercel/og": "^0.6.2",
     "body-scroll-lock": "^4.0.0-beta.0",
     "clsx": "^2.1.1",
-    "framer-motion": "^11.2.6",
-    "next": "^14.2.3",
+    "framer-motion": "^11.2.11",
+    "next": "^14.2.4",
     "nextra": "2.13.4",
     "nextra-theme-docs": "2.13.4",
     "react": "^18.3.1",
@@ -26,11 +26,11 @@
   "devDependencies": {
     "@svgr/webpack": "^8.0.1",
     "@types/body-scroll-lock": "^3.1.2",
-    "@types/node": "^20.12.12",
+    "@types/node": "^20.14.6",
     "@types/react": "^18.3.3",
     "autoprefixer": "^10.4.19",
-    "eslint": "^9.3.0",
+    "eslint": "^9.5.0",
     "postcss": "^8.4.38",
-    "tailwindcss": "^3.4.3"
+    "tailwindcss": "^3.4.4"
   }
 }
```

**File**: `apps/web/components/config.tsx` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ const tourConfig: StepType[] = [
     selector: '[data-tut="reactour__iso"]',
     content:
       "Ok, let's start with the name of the Tour that is about to begin.",
+    position: 'right',
   },
   {
     selector: '[data-tut="reactour__logo"]',
```

**File**: `apps/web/package.json` (modified, +5/-5)
```diff
@@ -10,7 +10,7 @@
     "export": "rm -rf ../../docs && next build && next export  -o ../../docs"
   },
   "dependencies": {
-    "@codesandbox/sandpack-react": "^2.13.10",
+    "@codesandbox/sandpack-react": "^2.14.4",
     "@codesandbox/sandpack-themes": "^2.0.21",
     "@emotion/react": "^11.11.4",
     "@emotion/styled": "^11.11.5",
@@ -19,20 +19,20 @@
     "@reactour/tour": "*",
     "@reactour/utils": "*",
     "body-scroll-lock": "^4.0.0-beta.0",
-    "framer-motion": "^11.2.6",
+    "framer-motion": "^11.2.11",
     "modaaals": "^1.1.2",
-    "next": "14.2.3",
+    "next": "14.2.4",
     "react": "18.3.1",
     "react-device-detect": "^2.2.3",
     "react-dom": "18.3.1"
   },
   "devDependencies": {
     "@reactour/tsconfig": "*",
     "@types/body-scroll-lock": "^3.1.2",
-    "@types/node": "^20.12.12",
+    "@types/node": "^20.14.6",
     "@types/react": "18.3.3",
     "config": "3.3.11",
-    "eslint": "9.3.0",
+    "eslint": "9.5.0",
     "eslint-plugin-prettier": "^5.1.3",
     "next-transpile-modules": "10.0.1",
     "typescript": "^5.4.5"
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -18,8 +18,8 @@
   },
   "devDependencies": {
     "eslint-plugin-prettier": "^5.1.3",
-    "prettier": "^3.2.5",
-    "turbo": "^1.13.3"
+    "prettier": "^3.3.2",
+    "turbo": "^2.0.4"
   },
   "engines": {
     "npm": ">=7.0.0",
```

**File**: `packages/config/package.json` (modified, +2/-2)
```diff
@@ -7,8 +7,8 @@
     "eslint-preset.js"
   ],
   "dependencies": {
-    "eslint-config-next": "^14.2.3",
+    "eslint-config-next": "^14.2.4",
     "eslint-config-prettier": "^9.1.0",
-    "eslint-plugin-react": "7.34.1"
+    "eslint-plugin-react": "7.34.3"
   }
 }
```

**File**: `packages/mask/package.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
     "@types/react-dom": "^18.3.0",
     "config": "3.3.11",
     "react": "^18.3.1",
-    "tsup": "^8.0.2",
+    "tsup": "^8.1.0",
     "typescript": "^5.4.5"
   },
   "dependencies": {
```

**File**: `packages/popover/CHANGELOG.md` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 # @reactour/popover
 
+## 1.1.2
+
+### Patch Changes
+
+- Fix issue with padding calculations
+
 ## 1.1.1
 
 ### Patch Changes
```

**File**: `packages/popover/Popover.tsx` (modified, +7/-7)
```diff
@@ -33,10 +33,11 @@ const Popover: React.FC<PopoverProps> = ({
   const helperRect = useRect(helperRef, refresher)
   const { width: helperWidth, height: helperHeight } = helperRect
 
-  const targetLeft = sizes?.left
-  const targetTop = sizes?.top
-  const targetRight = sizes?.right
-  const targetBottom = sizes?.bottom
+  const [pt, pr, pb, pl] = getPadding(padding)
+  const targetLeft = sizes?.left - pl
+  const targetTop = sizes?.top - pt
+  const targetRight = sizes?.right + pr
+  const targetBottom = sizes?.bottom + pb
 
   const position =
     providedPosition && typeof providedPosition === 'function'
@@ -64,8 +65,6 @@ const Popover: React.FC<PopoverProps> = ({
     bottom: windowHeight - targetBottom,
   }
 
-  const [pt, pr, pb, pl] = getPadding(padding)
-
   const couldPositionAt = (
     position: string,
     isOutsideX: boolean,
@@ -126,7 +125,7 @@ const Popover: React.FC<PopoverProps> = ({
       targetBottom + helperHeight,
       windowHeight
     )
-
+    console.log({ isHelperOutsideX, isHelperOutsideY })
     const x = isHelperOutsideX
       ? Math.min(targetLeft, windowWidth - helperWidth)
       : Math.max(targetLeft, 0)
@@ -136,6 +135,7 @@ const Popover: React.FC<PopoverProps> = ({
         ? Math.max(targetBottom - helperHeight, 0)
         : Math.max(targetTop, 0)
       : targetTop
+    console.log(y)
 
     if (isHelperOutsideY) {
       if (helperHeight > available.bottom) {
```

#### Recent Merged Pull Requests:
- **PR #687** (2026-05-15): test/tour suite expansion (@elrumordelaluz)
- **PR #686** (2026-05-15): chore: migrate workspace from yarn 1 to pnpm (@elrumordelaluz)
- **PR #685** (2026-05-15): test: add vitest + rtl scaffold with PR ci workflow (@elrumordelaluz)
- **PR #681** (2025-08-27): [ bugFix] - docs: fix typo 'Sapce' -> 'Space' in mask props section (@A-Veereshwar)
- **PR #680** (2025-08-14): Add missed ClickProps type export (@Andrii256)
- **PR #668** (closed): Update quickstart.mdx (@0xA-10)
- **PR #667** (closed): Update quickstart.mdx (@0xA-10)
- **PR #660** (2024-12-20): fix(docs): carbon ads overlapping entire screen on small desktop (@D3kion)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
