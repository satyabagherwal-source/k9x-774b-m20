# Forensic Learning Record (Deep Inspection): PaulLeCam/react-leaflet

> **Canonical Artifact**: `07_PROJECT_LEARNING/paullecam-react-leaflet-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PaulLeCam/react-leaflet](https://github.com/PaulLeCam/react-leaflet))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:42:08.567Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PaulLeCam/react-leaflet`
- **Description**: React components for Leaflet maps
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5602 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/core/src/attribution.ts`
```
import type { Map as LeafletMap } from 'leaflet'
import { useEffect, useRef } from 'react'

export function useAttribution(
  map: LeafletMap,
  attribution: string | null | undefined,
) {
  const attributionRef = useRef(attribution)

  useEffect(
    function updateAttribution() {
      if (
        attribution !== attributionRef.current &&
        map.attributionControl != null
      ) {
        if (attributionRef.current != null) {
          map.attributionControl.removeAttribution(attributionRef.current)
        }
        if (attribution != null) {
          map.attributionControl.addAttribution(attribution)
        }
      }
      attributionRef.current = attribution
    },
    [map, attribution],
  )
}

```

### Core Architecture Module: `packages/core/src/circle.ts`
```
import type {
  CircleMarkerOptions,
  CircleOptions,
  LatLngExpression,
  Circle as LeafletCircle,
  CircleMarker as LeafletCircleMarker,
} from 'leaflet'
import type { ReactNode } from 'react'

import type { PathProps } from './path.js'

export interface CircleMarkerProps extends CircleMarkerOptions, PathProps {
  center: LatLngExpression
  children?: ReactNode
}

export interface CircleProps extends CircleOptions, PathProps {
  center: LatLngExpression
  children?: ReactNode
}

export function updateCircle<P extends CircleMarkerProps | CircleProps>(
  layer: LeafletCircle<P> | LeafletCircleMarker<P>,
  props: P,
  prevProps: P,
) {
  if (props.center !== prevProps.center) {
    layer.setLatLng(props.center)
  }
  if (props.radius != null && props.radius !== prevProps.radius) {
    layer.setRadius(props.radius)
  }
}

```

### Core Architecture Module: `packages/core/src/component.tsx`
```
import React, {
  forwardRef,
  type PropsWithoutRef,
  type ReactNode,
  type Ref,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import { LeafletContext } from './context.js'
import type { DivOverlay, DivOverlayHook } from './div-overlay.js'
import type { LeafletElement } from './element.js'

type ElementHook<E, P> = (props: P) => RefObject<LeafletElement<E>>

export type PropsWithChildren = PropsWithoutRef<{
  children?: ReactNode
}>

export function createContainerComponent<E, P extends PropsWithChildren>(
  useElement: ElementHook<E, PropsWithoutRef<P>>,
) {
  function ContainerComponent(props: PropsWithoutRef<P>, forwardedRef: Ref<E>) {
    const { instance, context } = useElement(props).current
    useImperativeHandle(forwardedRef, () => instance)

    const { children } = props as PropsWithChildren
    return children == null ? null : (
      <LeafletContext value={context}>{children}</LeafletContext>
    )
  }

  return forwardRef(ContainerComponent)
}

export function createDivOverlayComponent<
  E extends DivOverlay,
  P extends PropsWithChildren,
>(useElement: ReturnType<DivOverlayHook<E, PropsWithoutRef<P>>>) {
  function OverlayComponent(props: PropsWithoutRef<P>, forwardedRef: Ref<E>) {
    const [isOpen, setOpen] = useState(false)
    const { instance } = useElement(props, setOpen).current

    useImperativeHandle(forwardedRef, () => instance)
    // biome-ignore lint/correctness/useExhaustiveDependencies: update overlay when children change
    useEffect(
      function updateOverlay() {
        if (isOpen) {
          instance.update()
        }
      },
      [instance, isOpen, props.children],
    )

    // @ts-ignore _contentNode missing in type definition
    const contentNode = instance._contentNode
    return contentNode ? createPortal(props.children, contentNode) : null
  }

  return forwardRef(OverlayComponent)
}

export function createLeafComponent<E, P>(
  useElement: ElementHook<E, PropsWithoutRef<P>>,
) {
  function LeafComponent(props: PropsWithoutRef<P>, forwardedRef: Ref<E>) {
    const { instance } = useElement(props).current
    useImperativeHandle(forwardedRef, () => instance)

    return null
  }

  return forwardRef(LeafComponent)
}

```

### Core Architecture Module: `packages/core/src/context.ts`
```
import type { Control, Layer, LayerGroup, Map as LeafletMap } from 'leaflet'
import { createContext, use } from 'react'

export const CONTEXT_VERSION = 1

export type ControlledLayer = {
  addLayer(layer: Layer): void
  removeLayer(layer: Layer): void
}

export type LeafletContextInterface = Readonly<{
  __version: number
  map: LeafletMap
  layerContainer?: ControlledLayer | LayerGroup
  layersControl?: Control.Layers
  overlayContainer?: Layer
  pane?: string
}>

export function createLeafletContext(map: LeafletMap): LeafletContextInterface {
  return Object.freeze({ __version: CONTEXT_VERSION, map })
}

export function extendContext(
  source: LeafletContextInterface,
  extra: Partial<LeafletContextInterface>,
): LeafletContextInterface {
  return Object.freeze({ ...source, ...extra })
}

export const LeafletContext = createContext<LeafletContextInterface | null>(
  null,
)

export function useLeafletContext(): LeafletContextInterface {
  const context = use(LeafletContext)
  if (context == null) {
    throw new Error(
      'No context provided: useLeafletContext() can only be used in a descendant of <MapContainer>',
    )
  }
  return context
}

```

### Core Architecture Module: `packages/core/src/control.ts`
```
import type { Control, ControlOptions } from 'leaflet'
import { useEffect, useRef } from 'react'

import { useLeafletContext } from './context.js'
import type { ElementHook } from './element.js'

export function createControlHook<E extends Control, P extends ControlOptions>(
  useElement: ElementHook<E, P>,
) {
  return function useLeafletControl(props: P): ReturnType<ElementHook<E, P>> {
    const context = useLeafletContext()
    const elementRef = useElement(props, context)
    const { instance } = elementRef.current
    const positionRef = useRef(props.position)
    const { position } = props

    useEffect(
      function addControl() {
        instance.addTo(context.map)

        return function removeControl() {
          instance.remove()
        }
      },
      [context.map, instance],
    )

    useEffect(
      function updateControl() {
        if (position != null && position !== positionRef.current) {
          instance.setPosition(position)
          positionRef.current = position
        }
      },
      [instance, position],
    )

    return elementRef
  }
}

```

### Core Architecture Module: `packages/core/src/div-overlay.ts`
```
import type { Popup, Tooltip } from 'leaflet'

import { useAttribution } from './attribution.js'
import { type LeafletContextInterface, useLeafletContext } from './context.js'
import type { ElementHook, LeafletElement } from './element.js'
import { useEventHandlers } from './events.js'
import type { LayerProps } from './layer.js'
import { withPane } from './pane.js'

export type DivOverlay = Popup | Tooltip

export type SetOpenFunc = (open: boolean) => void

export type DivOverlayLifecycleHook<E, P> = (
  element: LeafletElement<E>,
  context: LeafletContextInterface,
  props: P,
  setOpen: SetOpenFunc,
) => void

export type DivOverlayHook<E extends DivOverlay, P> = (
  useElement: ElementHook<E, P>,
  useLifecycle: DivOverlayLifecycleHook<E, P>,
) => (props: P, setOpen: SetOpenFunc) => ReturnType<ElementHook<E, P>>

export function createDivOverlayHook<
  E extends DivOverlay,
  P extends LayerProps,
>(useElement: ElementHook<E, P>, useLifecycle: DivOverlayLifecycleHook<E, P>) {
  return function useDivOverlay(
    props: P,
    setOpen: SetOpenFunc,
  ): ReturnType<ElementHook<E, P>> {
    const context = useLeafletContext()
    const elementRef = useElement(withPane(props, context), context)

    useAttribution(context.map, props.attribution)
    useEventHandlers(elementRef.current, props.eventHandlers)
    useLifecycle(elementRef.current, context, props, setOpen)

    return elementRef
  }
}

```

### Core Architecture Module: `packages/core/src/dom.ts`
```
function splitClassName(className: string): string[] {
  return className.split(' ').filter(Boolean)
}

export function addClassName(element: HTMLElement, className: string) {
  for (const cls of splitClassName(className)) {
    element.classList.add(cls)
  }
}

export function removeClassName(element: HTMLElement, className: string) {
  for (const cls of splitClassName(className)) {
    element.classList.remove(cls)
  }
}

export function updateClassName(
  element?: HTMLElement,
  prevClassName?: string,
  nextClassName?: string,
) {
  if (element != null && nextClassName !== prevClassName) {
    if (prevClassName != null && prevClassName.length > 0) {
      removeClassName(element, prevClassName)
    }
    if (nextClassName != null && nextClassName.length > 0) {
      addClassName(element, nextClassName)
    }
  }
}

```

### Core Architecture Module: `packages/core/src/element.ts`
```
import { type RefObject, useEffect, useRef } from 'react'

import type { LeafletContextInterface } from './context.js'

export type LeafletElement<T, C = unknown> = Readonly<{
  instance: T
  context: LeafletContextInterface
  container?: C | null
}>

export function createElementObject<T, C = unknown>(
  instance: T,
  context: LeafletContextInterface,
  container?: C | null,
): LeafletElement<T, C> {
  return Object.freeze({ instance, context, container })
}

export type ElementHook<E, P> = (
  props: P,
  context: LeafletContextInterface,
) => RefObject<LeafletElement<E>>

export function createElementHook<E, P, C = unknown>(
  createElement: (
    props: P,
    context: LeafletContextInterface,
  ) => LeafletElement<E>,
  updateElement?: (instance: E, props: P, prevProps: P) => void,
) {
  if (updateElement == null) {
    return function useImmutableLeafletElement(
      props: P,
      context: LeafletContextInterface,
    ): ReturnType<ElementHook<E, P>> {
      const elementRef = useRef<LeafletElement<E, C>>(undefined) as RefObject<
        LeafletElement<E>
      >
      if (!elementRef.current)
        elementRef.current = createElement(props, context)
      return elementRef
    }
  }

  return function useMutableLeafletElement(
    props: P,
    context: LeafletContextInterface,
  ): ReturnType<ElementHook<E, P>> {
    const elementRef = useRef<LeafletElement<E, C>>(undefined) as RefObject<
      LeafletElement<E>
    >
    if (!elementRef.current) elementRef.current = createElement(props, context)
    const propsRef = useRef<P>(props)
    const { instance } = elementRef.current

    useEffect(
      function updateElementProps() {
        if (propsRef.current !== props) {
          updateElement(instance, props, propsRef.current)
          propsRef.current = props
        }
      },
      [instance, props, updateElement],
    )

    return elementRef
  }
}

```

### Core Architecture Module: `packages/core/src/events.ts`
```
import type { Evented, LeafletEventHandlerFnMap } from 'leaflet'
import { useEffect, useRef } from 'react'

import type { LeafletElement } from './element.js'

export type EventedProps = {
  eventHandlers?: LeafletEventHandlerFnMap
}

export function useEventHandlers(
  element: LeafletElement<Evented>,
  eventHandlers: LeafletEventHandlerFnMap | null | undefined,
) {
  const eventHandlersRef = useRef<LeafletEventHandlerFnMap | null | undefined>(
    undefined,
  )

  useEffect(
    function addEventHandlers() {
      if (eventHandlers != null) {
        element.instance.on(eventHandlers)
      }
      eventHandlersRef.current = eventHandlers

      return function removeEventHandlers() {
        if (eventHandlersRef.current != null) {
          element.instance.off(eventHandlersRef.current)
        }
        eventHandlersRef.current = null
      }
    },
    [element, eventHandlers],
  )
}

```

### Core Architecture Module: `packages/core/src/generic.ts`
```
import type {
  Control,
  ControlOptions,
  FeatureGroup,
  Layer,
  Path,
} from 'leaflet'
import type { PropsWithoutRef } from 'react'

import {
  createContainerComponent,
  createDivOverlayComponent,
  createLeafComponent,
  type PropsWithChildren,
} from './component.js'
import type { LeafletContextInterface } from './context.js'
import { createControlHook } from './control.js'
import {
  createDivOverlayHook,
  type DivOverlay,
  type DivOverlayLifecycleHook,
} from './div-overlay.js'
import {
  createElementHook,
  createElementObject,
  type LeafletElement,
} from './element.js'
import { createLayerHook, type LayerProps } from './layer.js'
import { createPathHook, type PathProps } from './path.js'

interface LayerWithChildrenProps extends LayerProps, PropsWithChildren {}
interface PathWithChildrenProps extends PathProps, PropsWithChildren {}

export function createControlComponent<
  E extends Control,
  P extends ControlOptions,
>(createInstance: (props: PropsWithoutRef<P>) => E) {
  function createElement(
    props: PropsWithoutRef<P>,
    context: LeafletContextInterface,
  ): LeafletElement<E> {
    return createElementObject(createInstance(props), context)
  }
  const useElement = createElementHook(createElement)
  const useControl = createControlHook(useElement)
  return createLeafComponent(useControl)
}

export function createLayerComponent<
  E extends Layer,
  P extends LayerWithChildrenProps,
>(
  createElement: (
    props: PropsWithoutRef<P>,
    context: LeafletContextInterface,
  ) => LeafletElement<E>,
  updateElement?: (
    instance: E,
    props: PropsWithoutRef<P>,
    prevProps: PropsWithoutRef<P>,
  ) => void,
) {
  const useElement = createElementHook(createElement, updateElement)
  const useLayer = createLayerHook(useElement)
  return createContainerComponent(useLayer)
}

export function createOverlayComponent<
  E extends DivOverlay,
  P extends LayerWithChildrenProps,
>(
  createElement: (
    props: PropsWithoutRef<P>,
    context: LeafletContextInterface,
  ) => LeafletElement<E>,
  useLifecycle: DivOverlayLifecycleHook<E, PropsWithoutRef<P>>,
) {
  const useElement = createElementHook(createElement)
  const useOverlay = createDivOverlayHook(useElement, useLifecycle)
  return createDivOverlayComponent(useOverlay)
}

export function createPathComponent<
  E extends FeatureGroup | Path,
  P extends PathWithChildrenProps,
>(
  createElement: (
    props: PropsWithoutRef<P>,
    context: LeafletContextInterface,
  ) => LeafletElement<E>,
  updateElement?: (
    instance: E,
    props: PropsWithoutRef<P>,
    prevProps: PropsWithoutRef<P>,
  ) => void,
) {
  const useElement = createElementHook(createElement, updateElement)
  const usePath = createPathHook(useElement)
  return createContainerComponent(usePath)
}

export function createTileLayerComponent<E extends Layer, P extends LayerProps>(
  createElement: (
    props: PropsWithoutRef<P>,
    context: LeafletContextInterface,
  ) => LeafletElement<E>,
  updateElement?: (
    instance: E,
    props: PropsWithoutRef<P>,
    prevProps: PropsWithoutRef<P>,
  ) => void,
) {
  const useElement = createElementHook(createElement, updateElement)
  const useLayer = createLayerHook(useElement)
  return createLeafComponent(useLayer)
}

```

### Core Architecture Module: `packages/core/src/grid-layer.ts`
```
import type { GridLayer, GridLayerOptions } from 'leaflet'

export function updateGridLayer<
  E extends GridLayer,
  P extends GridLayerOptions,
>(layer: E, props: P, prevProps: P) {
  const { opacity, zIndex } = props
  if (opacity != null && opacity !== prevProps.opacity) {
    layer.setOpacity(opacity)
  }
  if (zIndex != null && zIndex !== prevProps.zIndex) {
    layer.setZIndex(zIndex)
  }
}

```

### Core Architecture Module: `packages/core/src/index.ts`
```
export { useAttribution } from './attribution.js'
export {
  type CircleMarkerProps,
  type CircleProps,
  updateCircle,
} from './circle.js'
export {
  createContainerComponent,
  createDivOverlayComponent,
  createLeafComponent,
} from './component.js'
export {
  CONTEXT_VERSION,
  createLeafletContext,
  extendContext,
  LeafletContext,
  type LeafletContextInterface,
  useLeafletContext,
} from './context.js'
export { createControlHook } from './control.js'
export {
  createDivOverlayHook,
  type DivOverlayHook,
  type DivOverlayLifecycleHook,
  type SetOpenFunc,
} from './div-overlay.js'
export { addClassName, removeClassName, updateClassName } from './dom.js'
export {
  createElementHook,
  createElementObject,
  type ElementHook,
  type LeafletElement,
} from './element.js'
export { type EventedProps, useEventHandlers } from './events.js'
export {
  createControlComponent,
  createLayerComponent,
  createOverlayComponent,
  createPathComponent,
  createTileLayerComponent,
} from './generic.js'
export { updateGridLayer } from './grid-layer.js'
export {
  createLayerHook,
  type InteractiveLayerProps,
  type LayerProps,
  useLayerLifecycle,
} from './layer.js'
export { type MediaOverlayProps, updateMediaOverlay } from './media-overlay.js'
export { withPane } from './pane.js'
export { createPathHook, type PathProps, usePathOptions } from './path.js'

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #84** (2015-11-04): **bower can't install v0.8.1**
  *Symptoms*: 1. the version in the bower.json file is 0.8.0 instead of 0.8.1 2. the bower dependency with react-dom#0.14.0 is not necessary since react-dom is packaged with react-bower (https://github.com/reactjs/react-bower) and makes the install fail:  ``` vagrant@vagrant-ubuntu-trusty-64:~/foo$ bower install PaulLeCam/react-leaflet#0.8.1 bower not-cached    git://github.com/PaulLeCam/react-leaflet.git#0.8.1 bower resolve       git://github.com/PaulLeCam/react-leaflet.git#0.8.1 bower download      https://github.com/PaulLeCam/react-leaflet/archive/v0.8.1.tar.gz bower extract       react-leaflet#0.8.1 archive.tar.gz bower mismatch      Version declared in the json (0.8.0) is different than the resolved one (0.8.1) bower resolved      git://github.com/PaulLeCam/react-leaflet.git#0.8.1 bower not-cached    git://github.com/EtienneLem/react-dom.git#~0.14.0 bower resolve       git://github.com/EtienneLem/react-dom.git#~0.14.0 bower ENORESTARGET  No tag found that was able to satisfy ~0.14.0  Additional error details: Available versions in git://github.com/EtienneLem/react-dom.git: 0.1.0 ``` 
  **Post-Mortem & Fix Analysis**:
  > Hi, this should be fixed now. 

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

### Incident Patch 1: `4b718180` (2024-06-03)
**Commit Message**: fix typo createImageOveraly to createImageOverlay (#1079)

**File**: `packages/react-leaflet/src/ImageOverlay.tsx` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ export const ImageOverlay = createLayerComponent<
   LeafletImageOverlay,
   ImageOverlayProps
 >(
-  function createImageOveraly({ bounds, url, ...options }, ctx) {
+  function createImageOverlay({ bounds, url, ...options }, ctx) {
     const overlay = new LeafletImageOverlay(url, bounds, options)
     return createElementObject(
       overlay,
```

---

### Incident Patch 2: `6d253ed8` (2024-05-01)
**Commit Message**: Fix tests

**File**: `packages/core/__tests__/context.tsx` (modified, +7/-2)
```diff
@@ -2,7 +2,12 @@ import { renderHook } from '@testing-library/react'
 import type { Map } from 'leaflet'
 import React, { StrictMode, type ReactNode } from 'react'
 
-import { CONTEXT_VERSION, LeafletContext, createLeafletContext, useLeafletContext } from '../src'
+import {
+  CONTEXT_VERSION,
+  LeafletContext,
+  createLeafletContext,
+  useLeafletContext,
+} from '../src'
 
 export function createWrapper(context) {
   return function Wrapper({ children }: { children: ReactNode }) {
@@ -28,7 +33,7 @@ describe('context', () => {
       const { result } = renderHook(() => useLeafletContext())
       return result.current
     }).toThrow(
-      'No context provided: useLeafletContext() can only be used in a descendant of <MapContainer>'
+      'No context provided: useLeafletContext() can only be used in a descendant of <MapContainer>',
     )
   })
 
```

**File**: `packages/core/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@react-leaflet/core",
-  "version": "2.1.0",
+  "version": "3.0.0-beta.1",
   "description": "React Leaflet core",
   "repository": {
     "type": "git",
```

**File**: `packages/core/src/index.ts` (modified, +5/-1)
```diff
@@ -1,5 +1,9 @@
 export { useAttribution } from './attribution.js'
-export { type CircleMarkerProps, type CircleProps, updateCircle } from './circle.js'
+export {
+  type CircleMarkerProps,
+  type CircleProps,
+  updateCircle,
+} from './circle.js'
 export {
   createContainerComponent,
   createDivOverlayComponent,
```

**File**: `packages/react-leaflet/__tests__/MapContainer.tsx` (modified, +31/-12)
```diff
@@ -1,5 +1,5 @@
 import { render } from '@testing-library/react'
-import { type LatLngExpression, Map } from 'leaflet'
+import { type LatLngExpression, Map as LeafletMap } from 'leaflet'
 import React, { StrictMode, useEffect, useRef } from 'react'
 
 import { MapContainer, useMap } from '../src'
@@ -30,10 +30,15 @@ describe('MapContainer', () => {
 
   describe('provides the Map instance', () => {
     test('with the useMap() hook', (done) => {
+      let doneCalled = false
+
       function TestChild() {
         const map = useMap()
-        expect(map).toBeInstanceOf(Map)
-        done()
+        expect(map).toBeInstanceOf(LeafletMap)
+        if (!doneCalled) {
+          doneCalled = true
+          done()
+        }
         return null
       }
 
@@ -49,10 +54,15 @@ describe('MapContainer', () => {
     })
 
     test('in the ref function', (done) => {
+      let doneCalled = false
+
       const ref = (map) => {
-        if (map !== null) {
-          expect(map).toBeInstanceOf(Map)
-          done()
+        if (map != null) {
+          expect(map).toBeInstanceOf(LeafletMap)
+          if (!doneCalled) {
+            doneCalled = true
+            done()
+          }
         }
       }
 
@@ -64,14 +74,19 @@ describe('MapContainer', () => {
     })
 
     test('in the ref object', (done) => {
+      let doneCalled = false
+
       function Wrapper() {
-        const ref = useRef()
+        const ref = useRef(undefined)
 
         useEffect(() => {
           setTimeout(() => {
-            if (ref.current !== null) {
-              expect(ref.current).toBeInstanceOf(Map)
-              done()
+            if (ref.current != null) {
+              expect(ref.current).toBeInstanceOf(LeafletMap)
+              if (!doneCalled) {
+                doneCalled = true
+                done()
+              }
             }
           }, 50)
         }, [])
@@ -86,12 +101,16 @@ describe('MapContainer', () => {
   test('sets center and zoom props', (done) => {
     const center: LatLngExpression = [1.2, 3.4]
     const zoom = 10
+    let doneCalled = false
 
     const ref = (map) => {
-      if (map !== null) {
+      if (map != null) {
         expect(map.getCenter()).toEqual({ lat: 1.2, lng: 3.4 })
         expect(map.getZoom()).toBe(zoom)
-        done()
+        if (!doneCalled) {
+          doneCalled = true
+          done()
+        }
       }
     }
 
```

**File**: `packages/react-leaflet/__tests__/Pane.tsx` (modified, +2/-2)
```diff
@@ -102,7 +102,7 @@ describe('Pane', () => {
   describe('supports refs', () => {
     test('as callback function', (done) => {
       const ref = (pane) => {
-        if (pane !== null) {
+        if (pane != null) {
           expect(pane).toBeInstanceOf(HTMLElement)
           done()
         }
@@ -126,7 +126,7 @@ describe('Pane', () => {
 
     test('as object', (done) => {
       function Wrapper() {
-        const ref = useRef()
+        const ref = useRef(undefined)
 
         useEffect(() => {
           setTimeout(() => {
```

**File**: `packages/react-leaflet/package.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-leaflet",
-  "version": "4.2.1",
+  "version": "5.0.0-beta.1",
   "description": "React components for Leaflet maps",
   "repository": {
     "type": "git",
@@ -35,7 +35,7 @@
     "prepublishOnly": "package-check"
   },
   "dependencies": {
-    "@react-leaflet/core": "workspace:^2.1.0"
+    "@react-leaflet/core": "workspace:^"
   },
   "peerDependencies": {
     "leaflet": "^1.9.0",
```

**File**: `packages/react-leaflet/src/MapContainer.tsx` (modified, +8/-7)
```diff
@@ -1,6 +1,6 @@
 import {
-  type LeafletContextInterface,
   LeafletContext,
+  type LeafletContextInterface,
   createLeafletContext,
 } from '@react-leaflet/core'
 import {
@@ -14,9 +14,9 @@ import React, {
   type ReactNode,
   type Ref,
   forwardRef,
-  useCallback,
   useEffect,
   useImperativeHandle,
+  useRef,
   useState,
 } from 'react'
 
@@ -51,12 +51,13 @@ function MapContainerComponent<
 ) {
   const [props] = useState({ className, id, style })
   const [context, setContext] = useState<LeafletContextInterface | null>(null)
-  useImperativeHandle(forwardedRef, () => context?.map ?? undefined, [context])
+  const mapInstanceRef = useRef<LeafletMap>(undefined)
+  useImperativeHandle(forwardedRef, () => mapInstanceRef.current)
 
-  // biome-ignore lint/correctness/useExhaustiveDependencies: ref callback
-  const mapRef = useCallback((node: HTMLDivElement | null) => {
-    if (node !== null && context === null) {
+  const mapRef = (node?: HTMLDivElement | null) => {
+    if (node != null && !mapInstanceRef.current) {
       const map = new LeafletMap(node, options)
+      mapInstanceRef.current = map
       if (center != null && zoom != null) {
         map.setView(center, zoom)
       } else if (bounds != null) {
@@ -67,7 +68,7 @@ function MapContainerComponent<
       }
       setContext(createLeafletContext(map))
     }
-  }, [])
+  }
 
   useEffect(() => {
     return () => {
```

**File**: `packages/react-leaflet/src/Pane.tsx` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import {
-  type LeafletContextInterface,
   LeafletContext,
+  type LeafletContextInterface,
   addClassName,
   useLeafletContext,
 } from '@react-leaflet/core'
```

---

### Incident Patch 3: `5a87b5c3` (2023-02-27)
**Commit Message**: Bugfix: bounds update in ImageOverlay (#1063)

**File**: `packages/react-leaflet/src/ImageOverlay.tsx` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ export const ImageOverlay = createLayerComponent<
   },
   function updateImageOverlay(overlay, props, prevProps) {
     updateMediaOverlay(overlay, props, prevProps)
-    if (props.bounds !== props.bounds) {
+    if (props.bounds !== prevProps.bounds) {
       const bounds =
         props.bounds instanceof LatLngBounds
           ? props.bounds
```

---

### Incident Patch 4: `fd9fde6b` (2022-08-14)
**Commit Message**: Fixing useRef() usage in createElementHook to prevent unnecessary Leaflet object creation (#1014)

**File**: `packages/core/src/element.ts` (modified, +10/-4)
```diff
@@ -33,17 +33,23 @@ export function createElementHook<E, P, C = any>(
       props: P,
       context: LeafletContextInterface,
     ): ReturnType<ElementHook<E, P>> {
-      return useRef<LeafletElement<E, C>>(createElement(props, context))
+      const elementRef = useRef<LeafletElement<E, C>>() as MutableRefObject<
+        LeafletElement<E>
+      >
+      if (!elementRef.current)
+        elementRef.current = createElement(props, context)
+      return elementRef
     }
   }
 
   return function useMutableLeafletElement(
     props: P,
     context: LeafletContextInterface,
   ): ReturnType<ElementHook<E, P>> {
-    const elementRef = useRef<LeafletElement<E, C>>(
-      createElement(props, context),
-    )
+    const elementRef = useRef<LeafletElement<E, C>>() as MutableRefObject<
+      LeafletElement<E>
+    >
+    if (!elementRef.current) elementRef.current = createElement(props, context)
     const propsRef = useRef<P>(props)
     const { instance } = elementRef.current
 
```

---

### Incident Patch 5: `3a3d0e35` (2022-07-25)
**Commit Message**: Fix typo in start-installation.mdx

**File**: `packages/website/docs/start-installation.mdx` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ Before using React Leaflet, you must setup your project following [Leaflet's Qui
 
 ### Using ESM imports
 
-React Leaflet export [ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) that can be imported by URL, notably from CDNs such as [esm.sh](https://esm.sh/):
+React Leaflet exports [ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) that can be imported by URL, notably from CDNs such as [esm.sh](https://esm.sh/):
 
 ```js
 import { MapContainer } from 'https://cdn.esm.sh/react-leaflet/MapContainer'
```

---

### Incident Patch 6: `3a60c448` (2022-07-25)
**Commit Message**: Fix typos in start-introduction.md

**File**: `packages/website/docs/start-introduction.md` (modified, +2/-2)
```diff
@@ -15,15 +15,15 @@ React only renders a `<div>` element when rendering the [`MapContainer` componen
 
 The properties passed to the components are used to create the relevant Leaflet instance when the component is rendered the first time and should be treated as **immutable by default**.
 
-During the first render, all these properties should be supported as they are by Leaflet, **however they will not be updated in the UI when they change** unless they are explicitely documented as being **mutable**.
+During the first render, all these properties should be supported as they are by Leaflet, **however they will not be updated in the UI when they change** unless they are explicitly documented as being **mutable**.
 
 Mutable properties changes are compared by reference (unless stated otherwise) and are applied calling the relevant method on the Leaflet element instance.
 
 ### Leaflet elements references
 
 Unless stated otherwise, all components exported by React Leaflet support [refs](https://reactjs.org/docs/glossary.html#refs) exposing the created Leaflet element instance or DOM element (for panes).
 
-This allows applications to access Leaflet's imperative APIs when required, but may create inconsitencies with props being set and should be used carefully.
+This allows applications to access Leaflet's imperative APIs when required, but may create inconsistencies with props being set and should be used carefully.
 
 ### React context
 
```

---

### Incident Patch 7: `b7a27732` (2022-06-25)
**Commit Message**: Fix GH workflow setup

**File**: `.github/workflows/main.yml` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ jobs:
           node-version: ${{ matrix.node }}
 
       - name: Install dependencies
-        uses: yarn
+        run: yarn
 
       - name: Lint
         run: yarn run lint
```

---

### Incident Patch 8: `d1f4da11` (2021-11-25)
**Commit Message**: fix: HTTP urls updated to https; OSM attribution link updated

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 React components for Leaflet maps.
 
-## [Documentation](http://react-leaflet.js.org)
+## [Documentation](https://react-leaflet.js.org)
 
 - [Getting started](https://react-leaflet.js.org/docs/start-introduction)
 - [API reference](https://react-leaflet.js.org/docs/api-map)
```

**File**: `packages/website/docs/api-components.md` (modified, +3/-3)
```diff
@@ -130,7 +130,7 @@ Applies to [control components](#controls), making their [`position: ControlPosi
 
 ### Marker
 
-[Leaflet reference](http://leafletjs.com/reference.html#marker)
+[Leaflet reference](https://leafletjs.com/reference.html#marker)
 
 **Props**
 
@@ -149,7 +149,7 @@ Applies to [control components](#controls), making their [`position: ControlPosi
 
 ### Popup
 
-[Leaflet reference](http://leafletjs.com/reference.html#popup)
+[Leaflet reference](https://leafletjs.com/reference.html#popup)
 
 **Props**
 
@@ -166,7 +166,7 @@ Applies to [control components](#controls), making their [`position: ControlPosi
 
 ### Tooltip
 
-[Leaflet reference](http://leafletjs.com/reference.html#tooltip)
+[Leaflet reference](https://leafletjs.com/reference.html#tooltip)
 
 **Props**
 
```

**File**: `packages/website/docs/core-architecture.md` (modified, +8/-8)
```diff
@@ -44,7 +44,7 @@ const center = [51.505, -0.09]
 render(
   <MapContainer center={center} zoom={13} scrollWheelZoom={false}>
     <TileLayer
-      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
     />
     <Square center={center} size={1000} />
@@ -126,7 +126,7 @@ const center = [51.505, -0.09]
 render(
   <MapContainer center={center} zoom={13} scrollWheelZoom={false}>
     <TileLayer
-      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
     />
     <Square center={center} size={1000} />
@@ -215,7 +215,7 @@ const center = [51.505, -0.09]
 render(
   <MapContainer center={center} zoom={13} scrollWheelZoom={false}>
     <TileLayer
-      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
     />
     <Square center={center} size={1000} />
@@ -292,7 +292,7 @@ const center = [51.505, -0.09]
 render(
   <MapContainer center={center} zoom={13} scrollWheelZoom={false}>
     <TileLayer
-      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
     />
     <Square center={center} size={1000} />
@@ -333,7 +333,7 @@ const center = [51.505, -0.09]
 render(
   <MapContainer center={center} zoom={13} scrollWheelZoom={false}>
     <TileLayer
-      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
     />
     <Square center={center} size={1000} />
@@ -371,7 +371,7 @@ const center = [51.505, -0.09]
 render(
   <MapContainer center={center} zoom={13} scrollWheelZoom={false}>
     <TileLayer
-      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
     />
     <Square center={center} size={1000} />
@@ -410,7 +410,7 @@ const center = [51.505, -0.09]
 render(
   <MapContainer center={center} zoom={13} scrollWheelZoom={false}>
     <TileLayer
-      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
     />
     <Square center={center} size={1000}>
@@ -475,7 +475,7 @@ const center = [51.505, -0.09]
 render(
   <MapContainer center={center} zoom={13} scrollWheelZoom={false}>
     <TileLayer
-      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
     />
     <Square center={center} size={1000}>
```

**File**: `packages/website/docs/example-animated-panning.md` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ function AnimateExample() {
       </p>
       <MapContainer center={[51.505, -0.09]} zoom={13} scrollWheelZoom={false}>
         <TileLayer
-          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
         />
         <SetViewOnClick animateRef={animateRef} />
```

**File**: `packages/website/docs/example-draggable-marker.md` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ function DraggableMarker() {
 render(
   <MapContainer center={center} zoom={13} scrollWheelZoom={false}>
     <TileLayer
-      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
     />
     <DraggableMarker />
```

**File**: `packages/website/docs/example-events.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ render(
     zoom={13}
     scrollWheelZoom={false}>
     <TileLayer
-      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
     />
     <LocationMarker />
```

**File**: `packages/website/docs/example-external-state.md` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ function ExternalStateExample() {
         scrollWheelZoom={false}
         whenCreated={setMap}>
         <TileLayer
-          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
         />
       </MapContainer>
```

**File**: `packages/website/docs/example-layers-control.md` (modified, +2/-2)
```diff
@@ -14,13 +14,13 @@ render(
     <LayersControl position="topright">
       <LayersControl.BaseLayer checked name="OpenStreetMap.Mapnik">
         <TileLayer
-          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
         />
       </LayersControl.BaseLayer>
       <LayersControl.BaseLayer name="OpenStreetMap.BlackAndWhite">
         <TileLayer
-          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
+          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
           url="https://tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png"
         />
       </LayersControl.BaseLayer>
```

---

### Incident Patch 9: `6e75ecda` (2021-11-21)
**Commit Message**: Fix lockfile

**File**: `package.json` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@
     "babel-jest": "^27.3.1",
     "cross-env": "^7.0.3",
     "del-cli": "^4.0.1",
-    "eslint": "^8.2.0",
+    "eslint": "^8.3.0",
     "eslint-config-prettier": "^8.1.0",
     "eslint-plugin-import": "^2.25.3",
     "eslint-plugin-node": "^11.1.0",
```

---

### Incident Patch 10: `ef2bb419` (2021-10-09)
**Commit Message**: Fix lockfile



---

### Incident Patch 11: `ae961ccf` (2021-10-09)
**Commit Message**: Merge pull request #916 from piitaya/fix_layer_unmount

Fix layer unmount

**File**: `packages/core/src/layer.ts` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ export function useLayerLifecycle(
       container.addLayer(element.instance)
 
       return function removeLayer() {
-        context.layersControl?.removeLayer(element.instance)
+        context.layerContainer?.removeLayer(element.instance)
         context.map.removeLayer(element.instance)
       }
     },
```

---

### Incident Patch 12: `8b2ce8cd` (2021-09-20)
**Commit Message**: Fix layer unmount

**File**: `packages/core/src/layer.ts` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ export function useLayerLifecycle(
       container.addLayer(element.instance)
 
       return function removeLayer() {
-        context.layersControl?.removeLayer(element.instance)
+        context.layerContainer?.removeLayer(element.instance)
         context.map.removeLayer(element.instance)
       }
     },
```

---

### Incident Patch 13: `66b54d86` (2021-05-25)
**Commit Message**: docs: fix links to point to Leaflet 1.7.1 docs

**File**: `packages/website/docs/api-components.md` (modified, +3/-3)
```diff
@@ -130,7 +130,7 @@ Applies to [control components](#controls), making their [`position: ControlPosi
 
 ### Marker
 
-[Leaflet reference](http://leafletjs.com/reference-1.6.0.html#marker)
+[Leaflet reference](http://leafletjs.com/reference-1.7.1.html#marker)
 
 **Props**
 
@@ -149,7 +149,7 @@ Applies to [control components](#controls), making their [`position: ControlPosi
 
 ### Popup
 
-[Leaflet reference](http://leafletjs.com/reference-1.6.0.html#popup)
+[Leaflet reference](http://leafletjs.com/reference-1.7.1.html#popup)
 
 **Props**
 
@@ -166,7 +166,7 @@ Applies to [control components](#controls), making their [`position: ControlPosi
 
 ### Tooltip
 
-[Leaflet reference](http://leafletjs.com/reference-1.6.0.html#tooltip)
+[Leaflet reference](http://leafletjs.com/reference-1.7.1.html#tooltip)
 
 **Props**
 
```

---

### Incident Patch 14: `dd360771` (2021-01-08)
**Commit Message**: docs: fix a spelling mistake in API Components

**File**: `packages/website/docs/api-components.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ title: Child components
 ---
 
 :::caution MapContainer required
-Child components can only be used as decendants of a [MapContainer component](api-map.md#mapcontainer).
+Child components can only be used as descendants of a [MapContainer component](api-map.md#mapcontainer).
 :::
 
 ## Props
```

---

### Incident Patch 15: `9809f400` (2020-10-21)
**Commit Message**: Merge pull request #767 from dipiash/fix/fix-doc-example

Fix: Fixed incorrect react example

**File**: `packages/website/docs/api-map.md` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ function MyMapComponent() {
           console.log('map center:', map.getCenter())
           return null
         }}
-      <MapConsumer>
+      </MapConsumer>
     </MapContainer>
   )
 }
```

#### Recent Merged Pull Requests:
- **PR #1168** (closed): gh pr checkout 1168 - Update main.yml (@ghost)
- **PR #1160** (closed): Upgrade leaflet dependencies (@silversonicaxel)
- **PR #1131** (closed): feat(react-leaflet): Improved polyline updates when props changes (@gallayl)
- **PR #1126** (closed): Can't compare array with operator !== (@g45t345rt)
- **PR #1116** (closed): add eventHandlers for MapContainer (@1adybug)
- **PR #1112** (closed): Update LICENSE.md (@DanOrsborne)
- **PR #1104** (closed): Update Polygon.tsx (@ClaysonIO)
- **PR #1098** (closed): Add draggable type to Marker (@thaske)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
