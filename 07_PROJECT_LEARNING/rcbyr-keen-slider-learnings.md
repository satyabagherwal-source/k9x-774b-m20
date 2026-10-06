# Forensic Learning Record (Deep Inspection): rcbyr/keen-slider

> **Canonical Artifact**: `07_PROJECT_LEARNING/rcbyr-keen-slider-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rcbyr/keen-slider](https://github.com/rcbyr/keen-slider))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:09:42.851Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rcbyr/keen-slider`
- **Description**: The HTML touch slider carousel with the most native feeling you will get.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5021 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/core/animator.ts`
```
import { AnimatorInstance, SliderHooks, SliderInstance } from './types'
import { cancelFrame, getFrame } from './utils'

function Animator(
  slider: SliderInstance<{}, {}, SliderHooks>
): AnimatorInstance {
  // eslint-disable-next-line prefer-const
  let instance: AnimatorInstance
  let currentKeyframe, duration, keyframes, reqId, started

  function animate(now) {
    if (!started) started = now
    setActive(true)
    let time = now - started
    if (time > duration) time = duration
    const keyframe = keyframes[currentKeyframe]
    const endTime = keyframe[3]
    if (endTime < time) {
      currentKeyframe++
      return animate(now)
    }
    const startTime = keyframe[2]
    const easingDuration = keyframe[4]
    const startPosition = keyframe[0]
    const distance = keyframe[1]
    const easing = keyframe[5]
    const progress =
      easingDuration === 0 ? 1 : (time - startTime) / easingDuration
    const add = distance * easing(progress)
    if (add) slider.track.to(startPosition + add)
    if (time < duration) return nextFrame()
    started = null
    setActive(false)
    setTargetIdx(null)
    slider.emit('animationEnded')
  }

  function setActive(active) {
    instance.active = active
  }

  function setTargetIdx(value) {
    instance.targetIdx = value
  }

  function nextFrame() {
    reqId = getFrame(animate)
  }

  function start(_keyframes) {
    stop()
    if (!slider.track.details) return
    let sumDistance = 0
    let endPosition = slider.track.details.position
    currentKeyframe = 0
    duration = 0
    keyframes = _keyframes.map(keyframe => {
      const startPosition = Number(endPosition)
      const animationDuration = keyframe.earlyExit ?? keyframe.duration
      const easing = keyframe.easing
      const distance =
        keyframe.distance * easing(animationDuration / keyframe.duration) || 0
      endPosition += distance
      const startTime = duration
      duration += animationDuration
      sumDistance += distance
      return [
        startPosition,
        keyframe.distance,
        startTime,
        duration,
        keyframe.duration,
        easing,
      ]
    })
    setTargetIdx(slider.track.distToIdx(sumDistance))
    nextFrame()
    slider.emit('animationStarted')
  }

  function stop() {
    cancelFrame(reqId)
    setActive(false)
    setTargetIdx(null)
    if (started) slider.emit('animationStopped')
    started = null
  }

  instance = { active: false, start, stop, targetIdx: null }
  return instance
}

export default Animator

```

### Core Architecture Module: `src/core/slider.ts`
```
import Animator from './animator'
import Track from './track'
import { SliderInstance, SliderOptions, SliderPlugin } from './types'
import { getProp } from './utils'

function Slider<O, C, H extends string>(
  options: SliderOptions<O>,
  plugins?: SliderPlugin[]
): SliderInstance<O, C, H> {
  const subs = {}
  // eslint-disable-next-line prefer-const
  let instance: SliderInstance<O, C, H>

  function init() {
    instance.track = Track(instance)
    instance.animator = Animator(instance)
    if (plugins) {
      for (const plugin of plugins) {
        plugin(instance)
      }
    }
    instance.track.init(instance.options.initial || 0)
    instance.emit('created')
  }

  function moveToIdx(idx, absolute, animation) {
    const distance = instance.track.idxToDist(idx, absolute)
    if (!distance) return
    const defaultAnimation = instance.options.defaultAnimation
    instance.animator.start([
      {
        distance,
        duration: getProp(animation || defaultAnimation, 'duration', 500),
        easing: getProp(
          animation || defaultAnimation,
          'easing',
          t => 1 + --t * t * t * t * t
        ),
      },
    ])
  }

  function on(name, cb, remove = false) {
    if (!subs[name]) subs[name] = []
    const idx = subs[name].indexOf(cb)

    if (idx > -1) {
      if (remove) delete subs[name][idx]
      return
    }
    if (!remove) subs[name].push(cb)
  }

  function emit(name) {
    if (subs[name]) {
      subs[name].forEach(cb => {
        cb(instance)
      })
    }
    const optionCallBack = instance.options && instance.options[name]
    if (optionCallBack) optionCallBack(instance)
  }

  instance = {
    emit,
    moveToIdx,
    on,
    options,
  } as SliderInstance<O, C, H>

  init()

  return instance
}

export default Slider

```

### Core Architecture Module: `src/core/track.ts`
```
import {
  SliderHooks,
  SliderInstance,
  TrackDetails,
  TrackInstance,
} from './types'
import { clamp, getProp, isNumber, now, round, sign } from './utils'

export default function Track(
  slider: SliderInstance<{}, {}, SliderHooks>
): TrackInstance {
  // eslint-disable-next-line prefer-const
  let instance: TrackInstance

  const infinity = Infinity
  let measurePoints = []

  let currentIdx = null
  let length
  let trackLength
  let opts
  let slides
  let slidesCount
  let relativePositions
  let maxRelativeIdx

  let position = 0

  let minIdx, maxIdx, loopMin, loopMax, min, max

  function add(value) {
    to(position + value)
  }

  function setRange() {
    const rangeOption = slider.options.range
    const loop = slider.options.loop
    loopMin = minIdx = loop ? getProp(loop, 'min', -infinity) : 0
    loopMax = maxIdx = loop ? getProp(loop, 'max', infinity) : maxRelativeIdx
    const dragMin = getProp(rangeOption, 'min', null)
    const dragMax = getProp(rangeOption, 'max', null)
    if (dragMin !== null) minIdx = dragMin
    if (dragMax !== null) maxIdx = dragMax
    min =
      minIdx === -infinity
        ? minIdx
        : slider.track.idxToDist(minIdx || 0, true, 0)
    max = maxIdx === infinity ? maxIdx : idxToDist(maxIdx, true, 0)
    if (dragMax === null) loopMax = maxIdx
    if (
      getProp(rangeOption, 'align', false) &&
      maxIdx !== infinity &&
      slides[absToRel(maxIdx)][2] === 0
    ) {
      max = max - (1 - slides[absToRel(maxIdx)][0])
      maxIdx = distToIdx(max - position)
    }
    min = round(min)
    max = round(max)
  }

  function details(): TrackDetails {
    if (!slidesCount) return

    const loop = getLoop()
    const positionMod = loop ? position % length : position
    const positionRelative = loop
      ? ((position % length) + length) % length
      : position

    const viewportPosition = positionMod - slides[0][2]
    const slidesStart =
      0 -
      (viewportPosition < 0 && loop
        ? length - Math.abs(viewportPosition)
        : viewportPosition)
    let sumLength = 0

    let { abs, rel } = getIndexes(position)
    const activeOrigin = slides[rel][2]
    const slideDetails = slides.map((slide, idx) => {
      let distanceViewport = slidesStart + sumLength
      if (distanceViewport < 0 - slide[0] || distanceViewport > 1) {
        distanceViewport +=
          (Math.abs(distanceViewport) > length - 1 && loop ? length : 0) *
          sign(-distanceViewport)
      }

      const idxDistance = idx - rel
      const signIdxDistance = sign(idxDistance)
      let absoluteIndex = idxDistance + abs
      if (loop) {
        if (signIdxDistance === -1 && distanceViewport > activeOrigin)
          absoluteIndex += slidesCount
        if (signIdxDistance === 1 && distanceViewport < activeOrigin)
          absoluteIndex -= slidesCount
        if (loopMin !== null && absoluteIndex < loopMin)
          distanceViewport += length
        if (loopMax !== null && absoluteIndex > loopMax)
          distanceViewport -= length
      }

      const end = distanceViewport + slide[0] + slide[1]
      const viewPortPortion = Math.max(
        distanceViewport >= 0 && end <= 1
          ? 1
          : end < 0 || distanceViewport > 1
          ? 0
          : distanceViewport < 0
          ? Math.min(1, (slide[0] + distanceViewport) / slide[0])
          : (1 - distanceViewport) / slide[0],
        0
      )
      sumLength += slide[0] + slide[1]

      return {
        abs: absoluteIndex,
        distance: !isRtl()
          ? distanceViewport
          : distanceViewport * -1 + 1 - slide[0],
        portion: viewPortPortion,
        size: slide[0],
      }
    })
    abs = clampIdx(abs)
    rel = absToRel(abs)
    return {
      abs: clampIdx(abs),
      length: trackLength,
      max,
      maxIdx,
      min,
      minIdx,
      position,
      progress: loop ? positionRelative / length : position / trackLength,
      rel,
      slides: slideDetails,
      slidesLength: length,
    }
  }

  function distToIdx(distance) {
    const { abs } = getIndexes(position + distance)
    return idxInRange(abs) ? abs : null
  }

  function getIndexes(pos) {
    let factor = Math.floor(Math.abs(round(pos / length)))
    let positionRelative = round(((pos % length) + length) % length)
    if (positionRelative === length) {
      positionRelative = 0
    }
    const positionSign = sign(pos)
    const origin = relativePositions.indexOf(
      [...relativePositions].reduce((a, b) =>
        Math.abs(b - positionRelative) < Math.abs(a - positionRelative) ? b : a
      )
    )
    let idx = origin
    if (positionSign < 0) factor++
    if (origin === slidesCount) {
      idx = 0
      factor += positionSign > 0 ? 1 : -1
    }
    const abs = idx + factor * slidesCount * positionSign
    return {
      abs,
      origin,
      rel: idx,
    }
  }

  function velocity() {
    const timestampNow = now()
    const data = measurePoints.reduce(
      (acc, next) => {
        const { distance } = next
        const { timestamp } = next
        if (timestampNow - timestamp > 200) return acc
        if (sign(distance) !== sign(acc.distance) && acc.distance) {
          acc = { distance: 0, lastTimestamp: 0, time: 0 }
        }
        if (acc.time) acc.distance += distance
        if (acc.lastTimestamp) acc.time += timestamp - acc.lastTimestamp
        acc.lastTimestamp = timestamp
        return acc
      },
      { distance: 0, lastTimestamp: 0, time: 0 }
    )
    return data.distance / data.time || 0
  }

  function idxToDist(idx, absolute, fromPosition) {
    let distance

    if (absolute || !getLoop()) return absoluteIdxToDist(idx, fromPosition)
    if (!idxInRange(idx)) return null
    const { abs, rel } = getIndexes(fromPosition ?? position)
    const idxDistance = idx - rel
    const nextIdx = abs + idxDistance
    distance = absoluteIdxToDist(nextIdx)
    const otherDistance = absoluteIdxToDist(
      nextIdx - slidesCount * sign(idxDistance)
    )
    if (
      (otherDistance !== null &&
        Math.abs(otherDistance) < Math.abs(distance)) ||
      distance === null
    ) {
      distance = otherDistance
    }
    return round(distance)
  }

  function absoluteIdxToDist(idx, fromPosition?) {
    if (fromPosition == null) fromPosition = round(position)
    if (!idxInRange(idx) || idx === null) return null
    idx = Math.round(idx)
    const { abs, rel, origin } = getIndexes(fromPosition)
    const idxRelative = absToRel(idx)
    const positionRelative = ((fromPosition % length) + length) % length
    const distanceToStart = relativePositions[origin]
    const distance = Math.floor((idx - (abs - rel)) / slidesCount) * length
    return round(
      distanceToStart -
        positionRelative -
        distanceToStart +
        relativePositions[idxRelative] +
        distance +
        (origin === slidesCount ? length : 0)
    )
  }

  function idxInRange(idx) {
    return clampIdx(idx) === idx
  }

  function initSlides() {
    opts = slider.options
    slides = (opts.trackConfig || []).map(entry => [
      getProp(entry, 'size', 1),
      getProp(entry, 'spacing', 0),
      getProp(entry, 'origin', 0),
    ])
    slidesCount = slides.length
    if (!slidesCount) return
    length = round(slides.reduce((acc, val) => acc + val[0] + val[1], 0))

    const lastIdx = slidesCount - 1
    trackLength = round(
      length +
        slides[0][2] -
        slides[lastIdx][0] -
        slides[lastIdx][2] -
        slides[lastIdx][1]
    )
    let lastDistance
    relativePositions = slides.reduce((acc, val) => {
      if (!acc) return [0]
      const prev = slides[acc.length - 1]
      let distance = acc[acc.length - 1] + (prev[0] + prev[2]) + prev[1]

      distance -= val[2]
      if (acc[acc.length - 1] > distance) distance = acc[acc.length - 1]
      distance = round(distance)
      acc.push(distance)
      if (!lastDistance || lastDistance < distance)
        maxRelativeIdx = acc.length - 1
      lastDistance = distance
      return acc
    }, null)
    if (trackLength === 0) maxRelativeIdx = 0
    relativePositions.push(round(length))
  }

  function clampIdx(idx) {
    return clamp(idx, minIdx, maxIdx)
  }

  function getLoop() {
    return opts.loop
  }

  function isRtl() {
    return opts.rtl
  }

  function measure(distance) {
    measurePoints.push({
      distance,
      timestamp: now(),
    })
    if (measurePoints.length > 6) measurePoints = measurePoints.slice(-6)
  }

  function absToRel(idx) {
    return ((idx % slidesCount) + slidesCount) % slidesCount
  }

  function to(value) {
    measure(value - position)
    position = round(value)
    const idx = trackUpdate()['abs']
    if (idx !== currentIdx) {
      const emitEvent = currentIdx === null ? false : true
      currentIdx = idx
      if (emitEvent) slider.emit('slideChanged')
    }
  }

  function trackUpdate(unset?: boolean) {
    const newDetails = unset ? null : details()
    instance.details = newDetails
    slider.emit('detailsChanged')
    return newDetails
  }

  function init(index) {
    initSlides()
    if (!slidesCount) return trackUpdate(true)
    setRange()
    if (isNumber(index)) {
      add(absoluteIdxToDist(clampIdx(index)))
    } else {
      trackUpdate()
    }
  }

  instance = {
    absToRel,
    add,
    details: null,
    distToIdx,
    idxToDist,
    init,
    to,
    velocity,
  }

  return instance
}

```

### Core Architecture Module: `src/core/types.ts`
```
export type TrackDetails = {
  abs: number
  length: number
  max: number
  maxIdx: number
  min: number
  minIdx: number
  position: number
  rel: number
  progress: number
  slides: { abs: number; distance: number; portion: number; size: number }[]
  slidesLength: number
}

export type TrackSlidesConfigEntry = {
  origin?: Number
  size?: Number
  spacing?: Number
} | null

export type TrackSlidesConfigOption = TrackSlidesConfigEntry[]

export type SliderHooks =
  | HOOK_CREATED
  | HOOK_ANIMATION_ENDED
  | HOOK_ANIMATION_STARTED
  | HOOK_ANIMATION_STOPPED
  | HOOK_SLIDE_CHANGED
  | HOOK_DETAILS_CHANGED

export type SliderHookOptions<H extends string, I> = {
  [key in H]?: (slider: I) => void
}

export type SliderOptions<O = {}> = {
  defaultAnimation?: {
    duration?: number
    easing?: (t: number) => number
  }
  initial?: number
  loop?: boolean | { min?: number; max?: number }
  range?: { align?: boolean; min?: number; max?: number }
  rtl?: boolean
  trackConfig?: TrackSlidesConfigOption
} & O

export type SliderInstance<O = {}, C = {}, H extends string = string> = {
  animator: AnimatorInstance
  emit: (name: H | SliderHooks) => void
  moveToIdx: (
    idx: number,
    absolute?: boolean,
    animation?: { duration?: number; easing?: (t: number) => number }
  ) => void
  on: (
    name: H | SliderHooks,
    cb: (props: SliderInstance<O, C, H>) => void,
    remove?: boolean
  ) => void
  options: SliderOptions<O>
  track: TrackInstance
} & C

export type SliderPlugin<O = {}, C = {}, H extends string = string> = (
  slider: SliderInstance<O, C, H>
) => void

export interface AnimatorInstance {
  active: boolean
  start: (
    keyframes: {
      distance: number
      duration: number
      earlyExit?: number
      easing: (t: number) => number
    }[]
  ) => void
  stop: () => void
  targetIdx: number | null
}

export interface TrackInstance {
  absToRel: (absoluteIdx: number) => number
  add: (value: number) => void
  details: TrackDetails
  distToIdx: (distance: number) => number
  idxToDist: (idx: number, absolute?: boolean, fromPosition?: number) => number
  init: (idx?: number) => void
  to: (value: number) => void
  velocity: () => number
}

export type HOOK_ANIMATION_ENDED = 'animationEnded'
export type HOOK_ANIMATION_STARTED = 'animationStarted'
export type HOOK_ANIMATION_STOPPED = 'animationStopped'
export type HOOK_CREATED = 'created'
export type HOOK_SLIDE_CHANGED = 'slideChanged'
export type HOOK_DETAILS_CHANGED = 'detailsChanged'

```

### Core Architecture Module: `src/core/utils.ts`
```
function toArray(nodeList) {
  return Array.prototype.slice.call(nodeList)
}

function getFloatOrInt(float, int) {
  const floatFloor = Math.floor(float)
  if (floatFloor === int || floatFloor + 1 === int) return float
  return int
}

export function now(): number {
  return Date.now()
}

export function dir(element): string {
  return window.getComputedStyle(element, null).getPropertyValue('direction')
}

export function setAttr(elem: HTMLElement, name: string, value: string): void {
  const prefix = 'data-keen-slider-'
  name = prefix + name
  if (value === null) return elem.removeAttribute(name)
  elem.setAttribute(name, value || '')
}

export function elem(
  element:
    | string
    | HTMLElement
    | NodeList
    | ((
        wrapper: HTMLElement | Document
      ) => HTMLElement[] | NodeList | HTMLCollection | null),
  wrapper?: HTMLElement
): HTMLElement {
  const elements = elems(element, wrapper || document)
  return elements.length ? elements[0] : null
}

export function elems(
  elements:
    | string
    | HTMLElement
    | HTMLElement[]
    | NodeList
    | HTMLCollection
    | null
    | ((
        wrapper: HTMLElement | Document
      ) =>
        | string
        | HTMLElement
        | HTMLElement[]
        | NodeList
        | HTMLCollection
        | null),
  wrapper: HTMLElement | Document
): HTMLElement[] {
  wrapper = wrapper || document
  if (typeof elements === 'function') elements = elements(wrapper)

  return Array.isArray(elements)
    ? elements
    : typeof elements === 'string'
    ? toArray(wrapper.querySelectorAll(elements))
    : elements instanceof HTMLElement
    ? [elements]
    : elements instanceof NodeList
    ? toArray(elements)
    : []
}

export function prevent(e: any): void {
  if (e.raw) e = e.raw
  if (e.cancelable && !e.defaultPrevented) e.preventDefault()
}

export function stop(e: any): void {
  if (e.raw) e = e.raw
  if (e.stopPropagation) e.stopPropagation()
}

export function inputHandler(handler: any): any {
  return e => {
    if (e.nativeEvent) e = e.nativeEvent
    const changedTouches = e.changedTouches || []
    const touchPoints = e.targetTouches || []
    const detail = e.detail && e.detail.x ? e.detail : null
    return handler({
      id: detail
        ? detail.identifier
          ? detail.identifier
          : 'i'
        : !touchPoints[0]
        ? 'd'
        : touchPoints[0]
        ? touchPoints[0].identifier
        : 'e',
      idChanged: detail
        ? detail.identifier
          ? detail.identifier
          : 'i'
        : !changedTouches[0]
        ? 'd'
        : changedTouches[0]
        ? changedTouches[0].identifier
        : 'e',
      raw: e,
      x:
        detail && detail.x
          ? detail.x
          : touchPoints[0]
          ? touchPoints[0].screenX
          : detail
          ? detail.x
          : e.pageX,
      y:
        detail && detail.y
          ? detail.y
          : touchPoints[0]
          ? touchPoints[0].screenY
          : detail
          ? detail.y
          : e.pageY,
    })
  }
}

export function Events(): {
  add: (
    element: Element | Document | Window | MediaQueryList,
    event: string,
    handler: (event: Event) => void,
    options?: AddEventListenerOptions
  ) => void
  input: (
    element: Element | Document | Window | MediaQueryList,
    event: string,
    handler: (event: Event) => void,
    options?: AddEventListenerOptions
  ) => void
  purge: () => void
} {
  let events = []

  return {
    add(element, event, handler, options) {
      ;(element as MediaQueryList).addListener
        ? (element as MediaQueryList).addListener(handler)
        : element.addEventListener(event, handler, options)
      events.push([element, event, handler, options])
    },
    input(element, event, handler, options) {
      this.add(element, event, inputHandler(handler), options)
    },
    purge() {
      events.forEach(event => {
        event[0].removeListener
          ? event[0].removeListener(event[2])
          : event[0].removeEventListener(event[1], event[2], event[3])
      })
      events = []
    },
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function sign(x: number): number {
  return (x > 0 ? 1 : 0) - (x < 0 ? 1 : 0) || +x
}

export function getFrame(cb: FrameRequestCallback): number {
  return window.requestAnimationFrame(cb)
}

export function cancelFrame(id: number): void {
  return window.cancelAnimationFrame(id)
}

export function rect(elem: HTMLElement): { height: number; width: number } {
  const boundingRect = elem.getBoundingClientRect()

  return {
    height: getFloatOrInt(boundingRect.height, elem.offsetHeight),
    width: getFloatOrInt(boundingRect.width, elem.offsetWidth),
  }
}

export function isNumber(n: unknown): boolean {
  return Number(n) === n
}

export function getProp<R>(
  obj: {},
  key: string,
  fallback: R,
  resolve?: boolean
): R {
  const prop = obj && obj[key]
  if (typeof prop === 'undefined' || prop === null) return fallback
  return resolve && typeof prop === 'function' ? prop() : prop
}

export function style(
  elem: HTMLElement,
  style: string,
  value: string | null
): void {
  elem.style[style] = value
}

export function round(value: number): number {
  return Math.round(value * 1000000) / 1000000
}

export function equal(v1: any, v2: any): boolean {
  if (v1 === v2) return true
  const t1 = typeof v1
  const t2 = typeof v2
  if (t1 !== t2) return false
  if (t1 === 'object' && v1 !== null && v2 !== null) {
    if (
      v1.length !== v2.length ||
      Object.getOwnPropertyNames(v1).length !==
        Object.getOwnPropertyNames(v2).length
    )
      return false
    for (const prop in v1) {
      if (!equal(v1[prop], v2[prop])) return false
    }
  } else if (t1 === 'function') {
    return v1.toString() === v2.toString()
  } else {
    return false
  }
  return true
}

export function checkOptions(currentOptions, newOptions) {
  if (!equal(currentOptions.current, newOptions)) {
    currentOptions.current = newOptions
  }
  return currentOptions.current
}

```

### Core Architecture Module: `src/plugins/native/renderer.ts`
```
import { SliderInstance } from '../../core/types'
import { HOOK_UPDATED } from '../types'
import { NativeInstance, NativeOptions } from './types'

export default function Renderer(
  slider: SliderInstance<NativeOptions, NativeInstance<{}>, HOOK_UPDATED>
): void {
  function update() {
    if (!slider.track.details) return
    slider.track.details.slides.forEach((slide, idx) => {
      const width = slider.options.vertical ? '100%' : `${slide.size * 100}%`
      const height = !slider.options.vertical ? '100%' : `${slide.size * 100}%`
      const xy = slider.size
        ? slide.distance * slider.size
        : slide.distance * 100 + '%'
      const left = slider.options.vertical ? 0 : xy
      const top = !slider.options.vertical ? 0 : xy
      const position = 'absolute'
      slider.slidesProps[idx].style = { height, left, position, top, width }
      const ref = slider.slidesProps[idx].ref.current
      if (ref) {
        ref.setNativeProps({
          style: {
            height,
            left,
            position,
            top,
            width,
          },
        })
      }
    })
  }

  slider.on('detailsChanged', update)
  slider.on('created', update)
  slider.on('updated', update)
}

```

### Core Architecture Module: `src/plugins/web/renderer.ts`
```
import { SliderInstance } from '../../core/types'
import { getProp } from '../../core/utils'
import { HOOK_OPTIONS_CHANGED, HOOK_UPDATED } from '../types'
import {
  HOOK_BEFORE_OPTIONS_CHANGED,
  HOOK_DESTROYED,
  RendererOptions,
  WebInstance,
  WebOptions,
} from './types'

export default function Renderer(
  slider: SliderInstance<
    WebOptions<{}> & RendererOptions,
    WebInstance<{}>,
    | HOOK_DESTROYED
    | HOOK_BEFORE_OPTIONS_CHANGED
    | HOOK_OPTIONS_CHANGED
    | HOOK_UPDATED
  >
): void {
  let autoScale = null
  let elements
  let verticalOption

  function applyStylesInAnimationFrame(remove?, scale?, vertical?) {
    slider.animator.active
      ? applyStyles(remove, scale, vertical)
      : requestAnimationFrame(() => applyStyles(remove, scale, vertical))
  }

  function applyStylesHook() {
    applyStylesInAnimationFrame(false, false, verticalOption)
  }

  function applyStyles(remove?, scale?, vertical?) {
    let sizeSum = 0
    const size = slider.size
    const details = slider.track.details
    if (!details || !elements) return
    const slides = details.slides
    elements.forEach((element, idx) => {
      if (remove) {
        if (!autoScale && scale) scaleElement(element, null, vertical)
        positionElement(element, null, vertical)
      } else {
        if (!slides[idx]) return
        const slideSize = slides[idx].size * size
        if (!autoScale && scale) scaleElement(element, slideSize, vertical)
        positionElement(
          element,
          slides[idx].distance * size - sizeSum,
          vertical
        )
        sizeSum += slideSize
      }
    })
  }

  function roundValue(value) {
    return slider.options.renderMode === 'performance'
      ? Math.round(value)
      : value
  }

  function scaleElement(element, value, vertical) {
    const type = vertical ? 'height' : 'width'
    if (value !== null) {
      value = roundValue(value) + 'px'
    }
    element.style['min-' + type] = value
    element.style['max-' + type] = value
  }

  function positionElement(element, value, vertical) {
    if (value !== null) {
      value = roundValue(value)
      const x = vertical ? 0 : value
      const y = vertical ? value : 0
      value = `translate3d(${x}px, ${y}px, 0)`
    }
    element.style.transform = value
    element.style['-webkit-transform'] = value
  }

  function reset() {
    if (elements) {
      applyStyles(true, true, verticalOption)
      elements = null
    }
    slider.on('detailsChanged', applyStylesHook, true)
  }

  function positionAndScale() {
    applyStylesInAnimationFrame(false, true, verticalOption)
  }

  function updateBefore() {
    reset()
  }

  function update() {
    reset()
    verticalOption = slider.options.vertical
    if (slider.options.disabled || slider.options.renderMode === 'custom')
      return
    autoScale = getProp(slider.options.slides, 'perView', null) === 'auto'
    slider.on('detailsChanged', applyStylesHook)
    elements = slider.slides
    if (!elements.length) return
    positionAndScale()
  }

  slider.on('created', update)
  slider.on('optionsChanged', update)
  slider.on('beforeOptionsChanged', updateBefore)
  slider.on('updated', positionAndScale)
  slider.on('destroyed', reset)
}

```

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      { targets: '>1%, not dead, ie >= 10', modules: false },
    ],
  ],
}

```

### Core Architecture Module: `jest.config.js`
```
module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testMatch: ['**/*.(spec|test).(ts|tsx)'],
  testPathIgnorePatterns: ['./node_modules/'],
  testEnvironment: 'jest-environment-jsdom',
  verbose: true,
  setupFilesAfterEnv: ['./jest.setup.ts'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
}

```

### Core Architecture Module: `jest.setup.ts`
```
import '@testing-library/jest-dom'

```

### Core Architecture Module: `rollup.config.js`
```
import { terser } from 'rollup-plugin-terser'
import babel from '@rollup/plugin-babel'
import autoprefixer from 'autoprefixer'
import copy from 'rollup-plugin-copy'
import postcss from 'rollup-plugin-postcss'
import resolve from '@rollup/plugin-node-resolve'

const umd = {
  input: './.build/keen-slider.js',
  output: [
    {
      file: './keen-slider.js',
      format: 'umd',
      name: 'KeenSlider',
      sourcemap: false,
      strict: true,
    },
  ],
  plugins: [resolve(), babel(), terser({ output: { comments: false } })],
}

const cjs = {
  input: './.build/keen-slider.js',
  output: {
    file: './keen-slider.cjs.js',
    format: 'cjs',
    exports: 'named',
  },
  plugins: [resolve(), terser({ output: { comments: false } })],
}

const es = {
  input: './.build/keen-slider.js',
  output: {
    file: './keen-slider.es.js',
    format: 'es',
    exports: 'named',
  },
  plugins: [resolve(), terser({ output: { comments: false } })],
}

const react = {
  input: './.build/react.js',
  output: {
    file: './react.js',
    format: 'cjs',
    exports: 'named',
  },
  external: ['react'],
  plugins: [resolve(), terser({ output: { comments: false } })],
}

const react_es = {
  input: './.build/react.js',
  output: {
    file: './react.es.js',
    format: 'es',
    exports: 'named',
  },
  external: ['react'],
  plugins: [resolve(), terser({ output: { comments: false } })],
}

const vue = {
  input: './.build/vue.js',
  output: {
    file: './vue.js',
    format: 'cjs',
    exports: 'named',
  },
  external: ['vue'],
  plugins: [resolve(), terser({ output: { comments: false } })],
}

const vue_es = {
  input: './.build/vue.js',
  output: {
    file: './vue.es.js',
    format: 'es',
    exports: 'named',
  },
  external: ['vue'],
  plugins: [resolve(), terser({ output: { comments: false } })],
}

const react_native = {
  input: './.build/react-native.js',
  output: {
    file: './react-native.js',
    format: 'es',
    exports: 'named',
  },
  external: ['react', 'react-native'],
  plugins: [resolve(), terser({ output: { comments: false } })],
}

const styles = [
  {
    input: 'src/keen-slider.scss',
    output: {
      file: 'keen-slider.css',
    },
    plugins: [
      copy({
        targets: [{ dest: './', src: './src/keen-slider.scss' }],
      }),
      postcss({
        extract: true,
        plugins: [autoprefixer()],
        sourceMap: false,
      }),
    ],
  },
  {
    input: 'src/keen-slider.scss',
    output: {
      file: 'keen-slider.min.css',
    },
    plugins: [
      postcss({
        extract: true,
        minimize: true,
        plugins: [autoprefixer()],
        sourceMap: false,
      }),
    ],
  },
]

export default [
  umd,
  cjs,
  es,
  react,
  react_es,
  vue,
  vue_es,
  react_native,
  ...styles,
]

```

### Core Architecture Module: `src/keen-slider.ts`
```
import Slider from './core/slider'
import {
  SliderHooks,
  SliderInstance,
  SliderOptions,
  SliderPlugin,
} from './core/types'
import Modes from './plugins/modes'
import {
  DRAG_ANIMATION_MODE_FREE,
  DRAG_ANIMATION_MODE_FREE_SNAP,
  DRAG_ANIMATION_MODE_SNAP,
  DragAnimationOptions,
  HOOK_DRAG_CHECKED,
  HOOK_DRAG_ENDED,
  HOOK_DRAG_STARTED,
  HOOK_DRAGGED,
  HOOK_OPTIONS_CHANGED,
  HOOK_UPDATED,
} from './plugins/types'
import Drag from './plugins/web/drag'
import Renderer from './plugins/web/renderer'
import { Container } from './plugins/web/types'
import {
  DragOptions,
  HOOK_BEFORE_OPTIONS_CHANGED,
  HOOK_DESTROYED,
  RendererOptions,
  WebInstance,
  WebOptions,
} from './plugins/web/types'
import Web from './plugins/web/web'

export type KeenSliderHooks =
  | SliderHooks
  | HOOK_OPTIONS_CHANGED
  | HOOK_UPDATED
  | HOOK_DRAGGED
  | HOOK_DRAG_ENDED
  | HOOK_DRAG_STARTED
  | HOOK_DRAG_CHECKED
  | HOOK_DESTROYED
  | HOOK_BEFORE_OPTIONS_CHANGED

export type KeenSliderOptions<
  O = {},
  P = {},
  H extends string = KeenSliderHooks
> = SliderOptions<
  WebOptions<KeenSliderOptions<O, P, H>> &
    DragOptions &
    RendererOptions &
    DragAnimationOptions<
      | DRAG_ANIMATION_MODE_SNAP
      | DRAG_ANIMATION_MODE_FREE
      | DRAG_ANIMATION_MODE_FREE_SNAP
    >
> & {
  [key in Exclude<
    H | KeenSliderHooks,
    keyof SliderOptions<WebOptions<{}>> &
      DragOptions &
      RendererOptions &
      DragAnimationOptions<
        | DRAG_ANIMATION_MODE_SNAP
        | DRAG_ANIMATION_MODE_FREE
        | DRAG_ANIMATION_MODE_FREE_SNAP
      >
  >]?: (slider: KeenSliderInstance<O, P, H>) => void
} & Omit<
    O,
    keyof SliderOptions<WebOptions<{}>> &
      DragOptions &
      RendererOptions &
      DragAnimationOptions<
        | DRAG_ANIMATION_MODE_SNAP
        | DRAG_ANIMATION_MODE_FREE
        | DRAG_ANIMATION_MODE_FREE_SNAP
      >
  >

export type KeenSliderInstance<
  O = {},
  P = {},
  H extends string = KeenSliderHooks
> = SliderInstance<
  KeenSliderOptions<O, P, H>,
  WebInstance<KeenSliderOptions<O, P, H>> & P,
  KeenSliderHooks | H
>

export type KeenSliderPlugin<
  O = {},
  P = {},
  H extends string = KeenSliderHooks
> = SliderPlugin<
  KeenSliderOptions<O, P, H>,
  KeenSliderInstance<O, P, H>,
  KeenSliderHooks | H
>

export * from './plugins/types'
export * from './plugins/web/types'
export * from './core/types'

const KeenSlider = function (
  container: Container,
  options?: KeenSliderOptions,
  plugins?: KeenSliderPlugin[]
): KeenSliderInstance {
  try {
    const defOpts = {
      drag: true,
      mode: 'snap',
      renderMode: 'precision',
      rubberband: true,
      selector: '.keen-slider__slide',
    } as KeenSliderOptions
    return Slider<KeenSliderOptions, KeenSliderInstance, KeenSliderHooks>(
      options,
      [
        Web<KeenSliderOptions>(container, defOpts),
        Renderer,
        Drag,
        Modes,
        ...(plugins || []),
      ]
    )
  } catch (e) {
    console.error(e)
  }
}

export default KeenSlider as unknown as {
  new <O = {}, P = {}, H extends string = KeenSliderHooks>(
    container: Container,
    options?: KeenSliderOptions<O, P, H>,
    plugins?: KeenSliderPlugin<O, P, H>[]
  ): KeenSliderInstance<O, P, H>
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #458** (2025-12-02): **Bump validator from 13.7.0 to 13.15.20**
  *Symptoms*: Bumps [validator](https://github.com/validatorjs/validator.js) from 13.7.0 to 13.15.20. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/validatorjs/validator.js/releases">validator's releases</a>.</em></p> <blockquote> <h2>13.15.20</h2> <h3>Fixes, New Locales and Enhancements</h3> <ul> <li><a href="https://redirect.github.com/validatorjs/validator.js/pull/2556">#2556</a> <code>isMobilePhone</code>: add <code>ar-QA</code> locale <a href="https://github.com/WardKhaddour"><code>@​WardKhaddour</code></a></li> <li><a href="https://redirect.github.com/validatorjs/validator.js/pull/2576">#2576</a> <code>isAlpha</code>/<code>isAlphanuneric</code>: add Indic locales (<code>ta-IN</code>, <code>te-IN</code>, <code>kn-IN</code>, <code>ml-IN</code>, <code>gu-IN</code>, <code>pa-IN</code>, <code>or-IN</code>) <a href="https://github.com/avadootharajesh"><code>@​avadootharajesh</code></a></li> <li><a href="https://redirect.github.com/validatorjs/validator.js/pull/2574">#2574</a> <code>isBase64</code>: improve padding regex <a href="https://github.com/KrayzeeKev"><code>@​KrayzeeKev</code></a></li> <li><a href="https://redirect.github.com/validatorjs/validator.js/pull/2584">#2584</a> <code>isVAT</code>: improve <code>FR</code> locale <a href="https://github.com/iamAmer"><code>@​iamAmer</code></a></li> <li><a href="https://redirect.github.com/validatorjs/validator.js/pull/2608">#2608</a> <code>isURL</code>: improve protocol detection. Resolves CVE-202
  **Post-Mortem & Fix Analysis**:
  > Superseded by #461.

- **Issue #451** (2025-06-01): **Update type**
  *Symptoms*: 

- **Issue #429** (2025-10-06): **Bump ws from 6.2.2 to 6.2.3**
  *Symptoms*: Bumps [ws](https://github.com/websockets/ws) from 6.2.2 to 6.2.3. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/websockets/ws/releases">ws's releases</a>.</em></p> <blockquote> <h2>6.2.3</h2> <h1>Bug fixes</h1> <ul> <li>Backported e55e5106 to the 6.x release line (eeb76d31).</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/websockets/ws/commit/d87f3b6d3a00513af9bbb74f45ba9183af4e5f43"><code>d87f3b6</code></a> [dist] 6.2.3</li> <li><a href="https://github.com/websockets/ws/commit/eeb76d313e2a00dd5247ca3597bba7877d064a63"><code>eeb76d3</code></a> [security] Fix crash when the Upgrade header cannot be read (<a href="https://redirect.github.com/websockets/ws/issues/2231">#2231</a>)</li> <li>See full diff in <a href="https://github.com/websockets/ws/compare/6.2.2...6.2.3">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=ws&package-manager=npm_and_yarn&previous-version=6.2.2&new-version=6.2.3)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  --- 

- **Issue #425** (2025-10-06): **Bump braces from 3.0.2 to 3.0.3**
  *Symptoms*: Bumps [braces](https://github.com/micromatch/braces) from 3.0.2 to 3.0.3. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/micromatch/braces/commit/74b2db2938fad48a2ea54a9c8bf27a37a62c350d"><code>74b2db2</code></a> 3.0.3</li> <li><a href="https://github.com/micromatch/braces/commit/88f1429a0f47e1dd3813de35211fc97ffda27f9e"><code>88f1429</code></a> update eslint. lint, fix unit tests.</li> <li><a href="https://github.com/micromatch/braces/commit/415d660c3002d1ab7e63dbf490c9851da80596ff"><code>415d660</code></a> Snyk js braces 6838727 (<a href="https://redirect.github.com/micromatch/braces/issues/40">#40</a>)</li> <li><a href="https://github.com/micromatch/braces/commit/190510f79db1adf21d92798b0bb6fccc1f72c9d6"><code>190510f</code></a> fix tests, skip 1 test in test/braces.expand</li> <li><a href="https://github.com/micromatch/braces/commit/716eb9f12d820b145a831ad678618731927e8856"><code>716eb9f</code></a> readme bump</li> <li><a href="https://github.com/micromatch/braces/commit/a5851e57f45c3431a94d83fc565754bc10f5bbc3"><code>a5851e5</code></a> Merge pull request <a href="https://redirect.github.com/micromatch/braces/issues/37">#37</a> from coderaiser/fix/vulnerability</li> <li><a href="https://github.com/micromatch/braces/commit/2092bd1fb108d2c59bd62e243b70ad98db961538"><code>2092bd1</code></a> feature: braces: add maxSymbols (<a href="https://github.com/micromatch/braces/issues/">https://github.com/micromatch/braces/issues/</a>...</li> <li><a href="ht

- **Issue #418** (2024-04-23): **Weird Resize Happening to All Slides**
  *Symptoms*: This has happened twice now where the slides were perfectly sized and centered and then all of a sudden something begins drastically increasing the min-height and max-height of each .keen-slider__slide and overriding my CSS. There is no in-line or element styling in my code. Something is changing min/max height when the app is run. Below is a snip of my DevTools showing how large each slide is being resized to:  ![weirdResize](https://github.com/rcbyr/keen-slider/assets/68050507/e7c1add9-0351-4db0-afc0-38ac4758deeb)  Any insight on what might be causing these resizes would be much appreciated.
  **Post-Mortem & Fix Analysis**:
  > Solved.
  > how? 

- **Issue #414** (2024-03-21): **How to avoid skipping slides when mouse scrolling?**
  *Symptoms*: Does anyone know how to avoid skipping slides when scrolling with the mouse/trackpad (not dragging) and move only to the next/previous slide, regardless of the scrolling speed?   In other words, when I scroll with trackpad it skips a lot of stuff, I want my slider always to go only to the next slide, not skipping it even if I scroll fast :)
  **Post-Mortem & Fix Analysis**:
  > wow, solution from [here](https://github.com/rcbyr/keen-slider/issues/220) worked

- **Issue #411** (2024-02-28): **syncing master into fork**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > oops, meant to sync my fork, not the actual repo, sorry.

- **Issue #410** (2024-02-24): **Bump ip from 1.1.8 to 1.1.9**
  *Symptoms*: Bumps [ip](https://github.com/indutny/node-ip) from 1.1.8 to 1.1.9. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/indutny/node-ip/commit/1ecbf2fd8c0cc85e44c3b587d2de641f50dc0217"><code>1ecbf2f</code></a> 1.1.9</li> <li><a href="https://github.com/indutny/node-ip/commit/6a3ada9b471b09d5f0f5be264911ab564bf67894"><code>6a3ada9</code></a> lib: fixed CVE-2023-42282 and added unit test</li> <li>See full diff in <a href="https://github.com/indutny/node-ip/compare/v1.1.8...v1.1.9">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=ip&package-manager=npm_and_yarn&previous-version=1.1.8&new-version=1.1.9)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot merge` will merge this PR after your CI passes on it - `@dependabot squash and merge` will sq

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

### Incident Patch 1: `520c757a` (2025-10-06)
**Commit Message**: Merge pull request #425 from rcbyr/dependabot/npm_and_yarn/braces-3.0.3

Bump braces from 3.0.2 to 3.0.3

**File**: `package-lock.json` (modified, +15/-13)
```diff
@@ -4900,12 +4900,23 @@
       }
     },
     "braces": {
-      "version": "3.0.2",
-      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.2.tgz",
-      "integrity": "sha512-b8um+L1RzM3WDSzvhm6gIz1yfTbBt6YTlcEKAvsmqCZZFw46z626lVj9j1yEPW33H5H+lBQpZMP1k8l+78Ha0A==",
+      "version": "3.0.3",
+      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
+      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
       "dev": true,
       "requires": {
-        "fill-range": "^7.0.1"
+        "fill-range": "^7.1.1"
+      },
+      "dependencies": {
+        "fill-range": {
+          "version": "7.1.1",
+          "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
+          "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
+          "dev": true,
+          "requires": {
+            "to-regex-range": "^5.0.1"
+          }
+        }
       }
     },
     "browser-process-hrtime": {
@@ -6326,15 +6337,6 @@
         "flat-cache": "^3.0.4"
       }
     },
-    "fill-range": {
-      "version": "7.0.1",
-      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.0.1.tgz",
-      "integrity": "sha512-qOo9F+dMUmC2Lcb4BbVvnKJxTPjCm+RRpe4gDuGrzkL7mEVl/djYSu2OdQ2Pa302N4oqkSg9ir6jaLWJ2USVpQ==",
-      "dev": true,
-      "requires": {
-        "to-regex-range": "^5.0.1"
-      }
-    },
     "finalhandler": {
       "version": "1.1.2",
       "resolved": "https://registry.npmjs.org/finalhandler/-/finalhandler-1.1.2.tgz",
```

---

### Incident Patch 2: `5c5947ad` (2024-06-16)
**Commit Message**: Bump braces from 3.0.2 to 3.0.3

Bumps [braces](https://github.com/micromatch/braces) from 3.0.2 to 3.0.3.
- [Changelog](https://github.com/micromatch/braces/blob/master/CHANGELOG.md)
- [Commits](https://github.com/micromatch/braces/compare/3.0.2...3.0.3)

---
updated-dependencies:
- dependency-name: braces
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `package-lock.json` (modified, +15/-13)
```diff
@@ -4900,12 +4900,23 @@
       }
     },
     "braces": {
-      "version": "3.0.2",
-      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.2.tgz",
-      "integrity": "sha512-b8um+L1RzM3WDSzvhm6gIz1yfTbBt6YTlcEKAvsmqCZZFw46z626lVj9j1yEPW33H5H+lBQpZMP1k8l+78Ha0A==",
+      "version": "3.0.3",
+      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
+      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
       "dev": true,
       "requires": {
-        "fill-range": "^7.0.1"
+        "fill-range": "^7.1.1"
+      },
+      "dependencies": {
+        "fill-range": {
+          "version": "7.1.1",
+          "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
+          "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
+          "dev": true,
+          "requires": {
+            "to-regex-range": "^5.0.1"
+          }
+        }
       }
     },
     "browser-process-hrtime": {
@@ -6326,15 +6337,6 @@
         "flat-cache": "^3.0.4"
       }
     },
-    "fill-range": {
-      "version": "7.0.1",
-      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.0.1.tgz",
-      "integrity": "sha512-qOo9F+dMUmC2Lcb4BbVvnKJxTPjCm+RRpe4gDuGrzkL7mEVl/djYSu2OdQ2Pa302N4oqkSg9ir6jaLWJ2USVpQ==",
-      "dev": true,
-      "requires": {
-        "to-regex-range": "^5.0.1"
-      }
-    },
     "finalhandler": {
       "version": "1.1.2",
       "resolved": "https://registry.npmjs.org/finalhandler/-/finalhandler-1.1.2.tgz",
```

---

### Incident Patch 3: `37ced032` (2023-10-10)
**Commit Message**: Merge pull request #377 from rcbyr/dependabot/npm_and_yarn/postcss-8.4.31

Bump postcss from 8.4.12 to 8.4.31

**File**: `package-lock.json` (modified, +7/-7)
```diff
@@ -9895,9 +9895,9 @@
       "dev": true
     },
     "nanoid": {
-      "version": "3.3.2",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.2.tgz",
-      "integrity": "sha512-CuHBogktKwpm5g2sRgv83jEy2ijFzBwMoYA60orPDR7ynsLijJDqgsi4RDGj3OJpy3Ieb+LYwiRmIOGyytgITA==",
+      "version": "3.3.6",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.6.tgz",
+      "integrity": "sha512-BGcqMMJuToF7i1rt+2PWSNVnWIkGCU78jBG3RxO/bZlnZPK2Cmi2QaffxGO/2RvWi9sL+FAiRiXMgsyxQ1DIDA==",
       "dev": true
     },
     "nanomatch": {
@@ -10449,12 +10449,12 @@
       "dev": true
     },
     "postcss": {
-      "version": "8.4.12",
-      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.4.12.tgz",
-      "integrity": "sha512-lg6eITwYe9v6Hr5CncVbK70SoioNQIq81nsaG86ev5hAidQvmOeETBqs7jm43K2F5/Ley3ytDtriImV6TpNiSg==",
+      "version": "8.4.31",
+      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.4.31.tgz",
+      "integrity": "sha512-PS08Iboia9mts/2ygV3eLpY5ghnUcfLV/EXTOW1E2qYxJKGGBUtNjN76FYHnMs36RmARn41bC0AZmn+rR0OVpQ==",
       "dev": true,
       "requires": {
-        "nanoid": "^3.3.1",
+        "nanoid": "^3.3.6",
         "picocolors": "^1.0.0",
         "source-map-js": "^1.0.2"
       }
```

---

### Incident Patch 4: `42931f0f` (2023-10-06)
**Commit Message**: Bump postcss from 8.4.12 to 8.4.31

Bumps [postcss](https://github.com/postcss/postcss) from 8.4.12 to 8.4.31.
- [Release notes](https://github.com/postcss/postcss/releases)
- [Changelog](https://github.com/postcss/postcss/blob/main/CHANGELOG.md)
- [Commits](https://github.com/postcss/postcss/compare/8.4.12...8.4.31)

---
updated-dependencies:
- dependency-name: postcss
  dependency-type: direct:development
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `package-lock.json` (modified, +7/-7)
```diff
@@ -9895,9 +9895,9 @@
       "dev": true
     },
     "nanoid": {
-      "version": "3.3.2",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.2.tgz",
-      "integrity": "sha512-CuHBogktKwpm5g2sRgv83jEy2ijFzBwMoYA60orPDR7ynsLijJDqgsi4RDGj3OJpy3Ieb+LYwiRmIOGyytgITA==",
+      "version": "3.3.6",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.6.tgz",
+      "integrity": "sha512-BGcqMMJuToF7i1rt+2PWSNVnWIkGCU78jBG3RxO/bZlnZPK2Cmi2QaffxGO/2RvWi9sL+FAiRiXMgsyxQ1DIDA==",
       "dev": true
     },
     "nanomatch": {
@@ -10449,12 +10449,12 @@
       "dev": true
     },
     "postcss": {
-      "version": "8.4.12",
-      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.4.12.tgz",
-      "integrity": "sha512-lg6eITwYe9v6Hr5CncVbK70SoioNQIq81nsaG86ev5hAidQvmOeETBqs7jm43K2F5/Ley3ytDtriImV6TpNiSg==",
+      "version": "8.4.31",
+      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.4.31.tgz",
+      "integrity": "sha512-PS08Iboia9mts/2ygV3eLpY5ghnUcfLV/EXTOW1E2qYxJKGGBUtNjN76FYHnMs36RmARn41bC0AZmn+rR0OVpQ==",
       "dev": true,
       "requires": {
-        "nanoid": "^3.3.1",
+        "nanoid": "^3.3.6",
         "picocolors": "^1.0.0",
         "source-map-js": "^1.0.2"
       }
```

---

### Incident Patch 5: `38587f0f` (2023-08-04)
**Commit Message**: Fixed typo

**File**: `docs/web.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ Complete documentation of the installation and usage of Keen-Slider. For the doc
 
 ## Getting started
 
-The usage of this library is really simple and is explained in many [code examples](https://keen-slider.io/examples). You can add it to any JavaScript or Typescript project you are working on in several way.
+The usage of this library is really simple and is explained in many [code examples](https://keen-slider.io/examples). You can add it to any JavaScript or Typescript project you are working on in several ways.
 
 ### Installation
 
```

---

### Incident Patch 6: `1c046b25` (2023-07-31)
**Commit Message**: Merge pull request #356 from Komeyl94/fix-css-warnings

Fix css issues

**File**: `src/keen-slider.scss` (modified, +2/-1)
```diff
@@ -3,9 +3,10 @@
   display: flex;
   overflow: hidden;
   position: relative;
-  user-select: none;
+  -webkit-user-select: none;
   -webkit-touch-callout: none;
   -khtml-user-select: none;
+  user-select: none;
   -ms-touch-action: pan-y;
   touch-action: pan-y;
   -webkit-tap-highlight-color: transparent;
```

---

### Incident Patch 7: `ed0e30d5` (2023-07-05)
**Commit Message**: Merge pull request #337 from kmorales13/fix-range-values

fix: range should accept 0 as valid value

**File**: `src/core/track.ts` (modified, +2/-2)
```diff
@@ -39,8 +39,8 @@ export default function Track(
     loopMax = maxIdx = loop ? getProp(loop, 'max', infinity) : maxRelativeIdx
     const dragMin = getProp(rangeOption, 'min', null)
     const dragMax = getProp(rangeOption, 'max', null)
-    if (dragMin) minIdx = dragMin
-    if (dragMax) maxIdx = dragMax
+    if (dragMin !== null) minIdx = dragMin
+    if (dragMax !== null) maxIdx = dragMax
     min =
       minIdx === -infinity
         ? minIdx
```

---

### Incident Patch 8: `15200180` (2023-07-05)
**Commit Message**: Merge pull request #346 from wajeshubham/fix/types-typo

Fix type name and docs typos

**File**: `docs/react-native.md` (modified, +2/-2)
```diff
@@ -106,7 +106,7 @@ Specifies the configuration of the slides. Every time there is an update, resize
 - **function** - Specifies the slides configuration with a function that returns an array of slide configurations. A slide configuration has the following optional properties:
 
   - `origin`: **number** - Determines where the origin of a slide is within the viewport. Default is **0**.
-  - `size`: **number** - Determines the relativ size of the slide in relation to the viewport. Default is **1**.
+  - `size`: **number** - Determines the relative size of the slide in relation to the viewport. Default is **1**.
   - `spacing`: **number** - Defines the space to the next slide in relation to the viewport. Default is **0**.
 
   The function receives as first argument the container size.
@@ -228,7 +228,7 @@ Changes the currently active slide to the previous one when called. If exists.
 
 ### `size`: **number**
 
-The size of the container/viewport, width or height, depending on the verical option.
+The size of the container/viewport, width or height, depending on the vertical option.
 
 ### `slidesProps`: **object[]**
 
```

**File**: `docs/web.md` (modified, +2/-2)
```diff
@@ -203,7 +203,7 @@ Changes the direction in which the slides are positioned, from left-to-right to
 
 Enables or disables the rubberband behavior for dragging and animation after a drag. Default is **true**.
 
-### `selector`: **string | HTMLElement[] | Nodelist | function | null**
+### `selector`: **string | HTMLElement[] | NodeList | function | null**
 
 Specifies how the slides from the DOM are received. This could be a **css selector string**, an **array of HTMLElement** or a **function** that gets the container and returns an **array** of **HTMLElement**, a **NodeList**, a **HTMLCollection**, a **string** or **null**. If you don't want the slider to position or scale the slides, set this option to **null**. Default is **'.keen-slider\_\_slide'**.
 
@@ -223,7 +223,7 @@ Specifies the configuration of the slides. Every time there is an update, resize
 - **function** - Specifies the slides configuration with a function that returns an array of slide configurations. A slide configuration has the following optional properties:
 
   - `origin`: **number** - Determines where the origin of a slide is within the viewport. Default is **0**.
-  - `size`: **number** - Determines the relativ size of the slide in relation to the viewport. Default is **1**.
+  - `size`: **number** - Determines the relative size of the slide in relation to the viewport. Default is **1**.
   - `spacing`: **number** - Defines the space to the next slide in relation to the viewport. Default is **0**.
 
   The function receives as first argument the container size and the slides as an array of HTML elements as the second argument.
```

**File**: `src/plugins/web/types.ts` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ export interface WebOptions<O> {
   selector?:
     | string
     | HTMLElement[]
-    | Nodelist
+    | NodeList
     | HTMLCollection
     | ((
         container: HTMLElement
```

---

### Incident Patch 9: `d83999ed` (2023-07-05)
**Commit Message**: Fix type name and docs typos

**File**: `docs/react-native.md` (modified, +2/-2)
```diff
@@ -106,7 +106,7 @@ Specifies the configuration of the slides. Every time there is an update, resize
 - **function** - Specifies the slides configuration with a function that returns an array of slide configurations. A slide configuration has the following optional properties:
 
   - `origin`: **number** - Determines where the origin of a slide is within the viewport. Default is **0**.
-  - `size`: **number** - Determines the relativ size of the slide in relation to the viewport. Default is **1**.
+  - `size`: **number** - Determines the relative size of the slide in relation to the viewport. Default is **1**.
   - `spacing`: **number** - Defines the space to the next slide in relation to the viewport. Default is **0**.
 
   The function receives as first argument the container size.
@@ -228,7 +228,7 @@ Changes the currently active slide to the previous one when called. If exists.
 
 ### `size`: **number**
 
-The size of the container/viewport, width or height, depending on the verical option.
+The size of the container/viewport, width or height, depending on the vertical option.
 
 ### `slidesProps`: **object[]**
 
```

**File**: `docs/web.md` (modified, +2/-2)
```diff
@@ -203,7 +203,7 @@ Changes the direction in which the slides are positioned, from left-to-right to
 
 Enables or disables the rubberband behavior for dragging and animation after a drag. Default is **true**.
 
-### `selector`: **string | HTMLElement[] | Nodelist | function | null**
+### `selector`: **string | HTMLElement[] | NodeList | function | null**
 
 Specifies how the slides from the DOM are received. This could be a **css selector string**, an **array of HTMLElement** or a **function** that gets the container and returns an **array** of **HTMLElement**, a **NodeList**, a **HTMLCollection**, a **string** or **null**. If you don't want the slider to position or scale the slides, set this option to **null**. Default is **'.keen-slider\_\_slide'**.
 
@@ -223,7 +223,7 @@ Specifies the configuration of the slides. Every time there is an update, resize
 - **function** - Specifies the slides configuration with a function that returns an array of slide configurations. A slide configuration has the following optional properties:
 
   - `origin`: **number** - Determines where the origin of a slide is within the viewport. Default is **0**.
-  - `size`: **number** - Determines the relativ size of the slide in relation to the viewport. Default is **1**.
+  - `size`: **number** - Determines the relative size of the slide in relation to the viewport. Default is **1**.
   - `spacing`: **number** - Defines the space to the next slide in relation to the viewport. Default is **0**.
 
   The function receives as first argument the container size and the slides as an array of HTML elements as the second argument.
```

**File**: `src/plugins/web/types.ts` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ export interface WebOptions<O> {
   selector?:
     | string
     | HTMLElement[]
-    | Nodelist
+    | NodeList
     | HTMLCollection
     | ((
         container: HTMLElement
```

---

### Incident Patch 10: `70692952` (2023-04-27)
**Commit Message**: fix: range should accept 0 as valid value

**File**: `src/core/track.ts` (modified, +2/-2)
```diff
@@ -39,8 +39,8 @@ export default function Track(
     loopMax = maxIdx = loop ? getProp(loop, 'max', infinity) : maxRelativeIdx
     const dragMin = getProp(rangeOption, 'min', null)
     const dragMax = getProp(rangeOption, 'max', null)
-    if (dragMin) minIdx = dragMin
-    if (dragMax) maxIdx = dragMax
+    if (dragMin !== null) minIdx = dragMin
+    if (dragMax !== null) maxIdx = dragMax
     min =
       minIdx === -infinity
         ? minIdx
```

---

### Incident Patch 11: `a48dc02b` (2023-02-09)
**Commit Message**: Fix typos in the docs

**File**: `docs/react-native.md` (modified, +2/-2)
```diff
@@ -43,7 +43,7 @@ export default () => {
 
 ## Options
 
-To customize keen-slider to your needs there are a lot of options which are listed below. Also the [`Event hooks`](https://keen-slider.io/docs/react-native#event-hooks) are part of these options. If you want to change the options after initialization, you can do that with the update function. See [`Properties`](https://keen-slider.io/docs/react-native#properties).
+To customize keen-slider to your needs there are a lot of options which are listed below. Also, the [`Event hooks`](https://keen-slider.io/docs/react-native#event-hooks) are part of these options. If you want to change the options after initialization, you can do that with the update function. See [`Properties`](https://keen-slider.io/docs/react-native#properties).
 
 ### `defaultAnimation`: **object**
 
@@ -117,7 +117,7 @@ Changes the direction of the slider from horizontal to vertical. Default is **fa
 
 ## Event Hooks
 
-Event hooks are function that the slider calls during its lifecycle. The functions getting the [`Properties`](https://keen-slider.io/docs/react-native#properties) as the only argument. Event hooks are part of the [`Options`](https://keen-slider.io/docs/react-native#options) and can be specified in the same way.
+Event hooks are functions that the slider calls during its lifecycle. The functions getting the [`Properties`](https://keen-slider.io/docs/react-native#properties) as the only argument. Event hooks are part of the [`Options`](https://keen-slider.io/docs/react-native#options) and can be specified in the same way.
 
 Below are the event hooks and when they are triggered:
 
```

**File**: `docs/web.md` (modified, +2/-2)
```diff
@@ -133,7 +133,7 @@ For documentation of how to use it in **React Native** click [here](https://keen
 
 ## Options
 
-To customize keen-slider to your needs there are a lot of options which are listed below. Also the [`Event hooks`](https://keen-slider.io/docs#event-hooks) are part of these options. If you want to change the options after initialization, you can do that with the update function. See [`Properties`](https://keen-slider.io/docs#properties).
+To customize keen-slider to your needs there are a lot of options which are listed below. Also, the [`Event hooks`](https://keen-slider.io/docs#event-hooks) are part of these options. If you want to change the options after initialization, you can do that with the update function. See [`Properties`](https://keen-slider.io/docs#properties).
 
 ### `breakpoints`: **object**
 
@@ -236,7 +236,7 @@ Changes the direction of the slider from horizontal to vertical. (Note: The heig
 
 ## Event Hooks
 
-Event hooks are function that the slider calls during its lifecycle. The functions getting the [`Properties`](https://keen-slider.io/docs#properties) as the only argument. Event hooks are part of the [`Options`](https://keen-slider.io/docs#options) and can be specified in the same way.
+Event hooks are functions that the slider calls during its lifecycle. The functions getting the [`Properties`](https://keen-slider.io/docs#properties) as the only argument. Event hooks are part of the [`Options`](https://keen-slider.io/docs#options) and can be specified in the same way.
 
 Below are the event hooks and when they are triggered:
 
```

---

### Incident Patch 12: `48c8c42e` (2023-01-16)
**Commit Message**: Fix class attribute name in Vue example

**File**: `docs/web.md` (modified, +7/-7)
```diff
@@ -112,13 +112,13 @@ The library comes with a function that uses the composition API of Vue 3. Theref
 </script>
 
 <template>
-  <div ref="container" className="keen-slider">
-    <div className="keen-slider__slide number-slide1">1</div>
-    <div className="keen-slider__slide number-slide2">2</div>
-    <div className="keen-slider__slide number-slide3">3</div>
-    <div className="keen-slider__slide number-slide4">4</div>
-    <div className="keen-slider__slide number-slide5">5</div>
-    <div className="keen-slider__slide number-slide6">6</div>
+  <div ref="container" class="keen-slider">
+    <div class="keen-slider__slide number-slide1">1</div>
+    <div class="keen-slider__slide number-slide2">2</div>
+    <div class="keen-slider__slide number-slide3">3</div>
+    <div class="keen-slider__slide number-slide4">4</div>
+    <div class="keen-slider__slide number-slide5">5</div>
+    <div class="keen-slider__slide number-slide6">6</div>
   </div>
 </template>
 
```

---

### Incident Patch 13: `b5a3ddbc` (2022-12-13)
**Commit Message**: Merge pull request #301 from rasteiner/fix/selector-type

Update type definition for selector option

**File**: `src/plugins/web/types.ts` (modified, +3/-0)
```diff
@@ -4,6 +4,9 @@ export interface WebOptions<O> {
   disabled?: boolean
   selector?:
     | string
+    | HTMLElement[]
+    | Nodelist
+    | HTMLCollection
     | ((
         container: HTMLElement
       ) => HTMLElement[] | NodeList | HTMLCollection | null)
```

---

### Incident Patch 14: `2c801ca9` (2022-11-23)
**Commit Message**: fix: broken animations when using swcminify #2 (#290)

**File**: `src/core/animator.ts` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ function Animator(
     currentKeyframe = 0
     duration = 0
     keyframes = _keyframes.map(keyframe => {
-      const startPosition = 0 + endPosition
+      const startPosition = Number(endPosition)
       const animationDuration = keyframe.earlyExit ?? keyframe.duration
       const easing = keyframe.easing
       const distance =
```

---

### Incident Patch 15: `781229fc` (2022-11-23)
**Commit Message**: fix: broken animations when using swcminify (#290)

**File**: `src/core/animator.ts` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ function Animator(
     currentKeyframe = 0
     duration = 0
     keyframes = _keyframes.map(keyframe => {
-      const startPosition = endPosition
+      const startPosition = 0 + endPosition
       const animationDuration = keyframe.earlyExit ?? keyframe.duration
       const easing = keyframe.easing
       const distance =
```

#### Recent Merged Pull Requests:
- **PR #458** (closed): Bump validator from 13.7.0 to 13.15.20 (@dependabot[bot])
- **PR #451** (closed): Update type (@Tungify)
- **PR #429** (2025-10-06): Bump ws from 6.2.2 to 6.2.3 (@dependabot[bot])
- **PR #425** (2025-10-06): Bump braces from 3.0.2 to 3.0.3 (@dependabot[bot])
- **PR #411** (closed): syncing master into fork (@gratzl-dev)
- **PR #410** (2024-02-24): Bump ip from 1.1.8 to 1.1.9 (@dependabot[bot])
- **PR #382** (2023-10-29): Bump react-devtools-core and react-native (@dependabot[bot])
- **PR #381** (2023-10-29): Bump @babel/traverse from 7.17.9 to 7.23.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
