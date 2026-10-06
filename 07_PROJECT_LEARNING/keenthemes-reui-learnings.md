# Forensic Learning Record (Deep Inspection): keenthemes/reui

> **Canonical Artifact**: `07_PROJECT_LEARNING/keenthemes-reui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/keenthemes/reui](https://github.com/keenthemes/reui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:48:44.654Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `keenthemes/reui`
- **Description**: Design-forward shadcn kit for interfaces that stand out. 1000+ free patterns!
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3621 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/(create)/components/components/components-empty-state.tsx`
```
import { cn } from "cn"

interface ComponentsEmptyStateProps {
  message: string
  className?: string
}

export function ComponentsEmptyState({
  message,
  className,
}: ComponentsEmptyStateProps) {
  return (
    <div className={cn("py-12 text-center", className)}>
      <p className="text-site-muted-foreground">{message}</p>
    </div>
  )
}

```

### Core Architecture Module: `app/(create)/hooks/use-iframe-sync.tsx`
```
"use client"

import * as React from "react"

import type { DesignSystemSearchParams } from "@/app/(create)/lib/search-params"

// Message types for parent to iframe communication
type DesignSystemParamsMessage = {
  type: "design-system-params"
  data: DesignSystemSearchParams
}

type GridColumnsMessage = {
  type: "grid-columns"
  data: { columns: 1 | 2 }
}

type NavigationMessage = {
  type: "navigation"
  data: {
    category: string | null
    searchQuery: string | null
    params: DesignSystemSearchParams
  }
}

type ParentToIframeMessage =
  | DesignSystemParamsMessage
  | GridColumnsMessage
  | NavigationMessage

export const isInIframe = () => {
  if (typeof window === "undefined") {
    return false
  }
  return window.self !== window.top
}

/**
 * True ONLY when this page is embedded in a SAME-ORIGIN parent - i.e. one of
 * reui's own preview iframes, not an arbitrary cross-origin embedder (e.g.
 * shoogle.dev). Reading the parent's origin throws a SecurityError for a
 * cross-origin ancestor, which we treat as "not a same-origin embed".
 *
 * Use this (not `isInIframe`) to gate behavior that must affect ONLY reui's own
 * previews - notably the document scroll lock. `isInIframe` (`self !== top`) is
 * true for ANY embed, so gating a scroll lock on it left external embedders'
 * pages completely unscrollable.
 */
export const isSameOriginEmbed = () => {
  if (typeof window === "undefined") {
    return false
  }
  if (window.self === window.top) {
    return false
  }
  try {
    return window.parent.location.origin === window.location.origin
  } catch {
    return false
  }
}

function getIframeTargetOrigin(iframe: HTMLIFrameElement | null) {
  if (!iframe?.src) {
    return window.location.origin
  }

  try {
    return new URL(iframe.src, window.location.href).origin
  } catch {
    return window.location.origin
  }
}

export function useIframeMessageListener<
  Message extends ParentToIframeMessage,
  MessageType extends Message["type"],
>(
  messageType: MessageType,
  onMessage: (data: Extract<Message, { type: MessageType }>["data"]) => void
) {
  React.useEffect(() => {
    if (!isInIframe()) {
      return
    }

    const handleMessage = (event: MessageEvent) => {
      // Validate origin to prevent cross-origin message injection
      if (event.origin !== window.location.origin) return

      if (event.data.type === messageType) {
        onMessage(event.data.data)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [messageType, onMessage])
}

export function sendToIframe<
  Message extends ParentToIframeMessage,
  MessageType extends Message["type"],
>(
  iframe: HTMLIFrameElement | null,
  messageType: MessageType,
  data: Extract<Message, { type: MessageType }>["data"],
  targetOrigin = getIframeTargetOrigin(iframe)
) {
  if (!iframe?.contentWindow) {
    return
  }

  iframe.contentWindow.postMessage(
    {
      type: messageType,
      data,
    },
    targetOrigin
  )
}

```

### Core Architecture Module: `app/(create)/hooks/use-iframe-watchdog.ts`
```
"use client"

import * as React from "react"

interface UseIframeWatchdogOptions {
  /**
   * True once the iframe has signalled it loaded - either the embedded page
   * posted `iframe-ready` or the iframe element fired `onLoad`. While false the
   * watchdog is armed.
   */
  ready: boolean
  /**
   * Logical identity of the preview being shown (e.g. the block name or the
   * iframe src). Changing it - a user switching block / category - resets the
   * retry budget and the timed-out state, starting a fresh watchdog cycle.
   * It must NOT include `retryNonce`, or each retry would reset the budget and
   * loop forever.
   */
  loadId: string
  /** Per-attempt grace period before the watchdog reloads / gives up. */
  timeoutMs?: number
  /** How many automatic reloads to try before surfacing the failure. */
  maxRetries?: number
}

interface UseIframeWatchdogResult {
  /**
   * Bumped on each automatic retry. Fold it into the iframe `key` (or a
   * cache-bust query) so the element remounts and re-attempts the load. The
   * caller must reset `ready` to false when it changes so the watchdog keeps
   * timing the new attempt.
   */
  retryNonce: number
  /**
   * True once every automatic retry has elapsed without `ready`. The caller
   * should reveal the iframe anyway (the load signal is often just lost, not
   * the content) and show a manual Reload affordance.
   */
  timedOut: boolean
  /** Manual reload, e.g. behind a "Reload" button shown on `timedOut`. */
  retry: () => void
}

/**
 * Availability backstop for iframe-backed preview panels.
 *
 * A preview hides its loading spinner when the embedded page posts
 * `iframe-ready` OR the iframe's `onLoad` fires. If the preview route stalls
 * (dev compile, a 5xx, a dropped connection) neither fires and the spinner
 * spins forever. This watchdog waits `timeoutMs` for `ready`; if it doesn't
 * arrive it reloads the iframe (via `retryNonce`, up to `maxRetries`), and
 * after the final attempt reports `timedOut` so the caller can reveal the frame
 * and offer a manual Reload - so a preview always resolves to *something* and is
 * never stuck spinning.
 *
 * Purely timer-based: no scroll / resize listeners.
 */
export function useIframeWatchdog({
  ready,
  loadId,
  timeoutMs = 8000,
  maxRetries = 2,
}: UseIframeWatchdogOptions): UseIframeWatchdogResult {
  const [retryNonce, setRetryNonce] = React.useState(0)
  const [timedOut, setTimedOut] = React.useState(false)

  // New logical preview -> start over (clear the retry budget + failure state).
  React.useEffect(() => {
    setRetryNonce(0)
    setTimedOut(false)
  }, [loadId])

  // Arm a timer for the current attempt. `retryNonce` is a dep, so each retry
  // (which the caller turns into an iframe remount) starts a fresh timer; once
  // `ready` flips true the effect bails and the cleanup clears the pending timer.
  React.useEffect(() => {
    if (ready || timedOut) return
    const timer = window.setTimeout(() => {
      if (retryNonce < maxRetries) {
        setRetryNonce((n) => n + 1)
      } else {
        setTimedOut(true)
      }
    }, timeoutMs)
    return () => window.clearTimeout(timer)
  }, [ready, timedOut, loadId, retryNonce, timeoutMs, maxRetries])

  const retry = React.useCallback(() => {
    setTimedOut(false)
    setRetryNonce((n) => n + 1)
  }, [])

  return { retryNonce, timedOut, retry }
}

```

### Core Architecture Module: `app/(create)/hooks/use-locks.tsx`
```
"use client"

import * as React from "react"

export type LockableParam =
  | "style"
  | "baseColor"
  | "theme"
  | "chartColor"
  | "iconLibrary"
  | "font"
  | "fontHeading"
  | "menuAccent"
  | "menuColor"
  | "radius"

type LocksContextValue = {
  locks: Set<LockableParam>
  isLocked: (param: LockableParam) => boolean
  toggleLock: (param: LockableParam) => void
}

const LocksContext = React.createContext<LocksContextValue | null>(null)

export function LocksProvider({ children }: { children: React.ReactNode }) {
  const [locks, setLocks] = React.useState<Set<LockableParam>>(new Set())

  const isLocked = React.useCallback(
    (param: LockableParam) => locks.has(param),
    [locks]
  )

  const toggleLock = React.useCallback((param: LockableParam) => {
    setLocks((prev) => {
      const next = new Set(prev)
      if (next.has(param)) {
        next.delete(param)
      } else {
        next.add(param)
      }
      return next
    })
  }, [])

  const value = React.useMemo(
    () => ({ locks, isLocked, toggleLock }),
    [locks, isLocked, toggleLock]
  )

  return <LocksContext value={value}>{children}</LocksContext>
}

export function useLocks() {
  const context = React.useContext(LocksContext)
  if (!context) {
    throw new Error("useLocks must be used within LocksProvider")
  }
  return context
}

```

### Core Architecture Module: `app/(create)/hooks/use-open-preset.ts`
```
"use client"

import * as React from "react"
import { atom, useAtom } from "jotai"

/**
 * Port of the upstream shadcn `use-open-preset` hook.
 *
 * Owns the shared open/close state for the Open-Preset dialog (Jotai
 * atom) and the `O` keyboard shortcut that opens it from anywhere.
 *
 * - `useOpenPreset()` → `{ open, setOpen }` for the dialog itself.
 * - `useOpenPresetTrigger()` → `{ openPreset }` for buttons that only
 *    need to open the dialog (e.g. the customizer footer).
 *
 * Keyboard: a plain `O` keypress opens the dialog (matches upstream).
 * Ignored when focus is inside editable elements.
 */

const openPresetOpenAtom = atom(false)

export const OPEN_PRESET_FORWARD_TYPE = "open-preset-forward"

function isEditableTarget(target: EventTarget | null) {
  return (
    (target instanceof HTMLElement && target.isContentEditable) ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

export function useOpenPreset() {
  const [open, setOpen] = useAtom(openPresetOpenAtom)

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
    },
    [setOpen]
  )

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.key === "o" &&
        !e.shiftKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        if (isEditableTarget(e.target)) return
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [setOpen])

  return {
    open,
    setOpen: handleOpenChange,
  }
}

export function useOpenPresetTrigger() {
  const [, setOpen] = useAtom(openPresetOpenAtom)

  const openPreset = React.useCallback(() => {
    setOpen(true)
  }, [setOpen])

  return { openPreset }
}

```

### Core Architecture Module: `hooks/use-config.ts`
```
import { useAtom } from "jotai"
import { atomWithStorage, createJSONStorage } from "jotai/utils"

import {
  BLOCKS_STATE_STORAGE_KEY,
  COMPONENTS_STATE_STORAGE_KEY,
  CONFIG_STORAGE_KEY,
  DEFAULT_BLOCKS_STATE,
  DEFAULT_COMPONENTS_STATE,
  DEFAULT_CONFIG,
  getPreferenceCookieName,
  PATTERNS_STATE_COOKIE_NAME,
  PATTERNS_STATE_STORAGE_KEY,
  PREFERENCE_COOKIE_MAX_AGE,
  type BlockGridMode,
  type BlocksState,
  type ComponentGridMode,
  type ComponentsLayoutState,
  type Config,
  type IconStyleName,
  type IconTypeName,
} from "@/lib/preferences"

export {
  type BlockGridMode,
  DEFAULT_CONFIG,
  type BlocksState,
  type ComponentsLayoutState,
  type Config,
  type IconStyleName,
  type IconTypeName,
  type ComponentGridMode,
}

export type { PatternGridMode } from "@/lib/preferences"

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null
  }

  const cookiePrefix = `${name}=`

  for (const cookie of document.cookie.split(";")) {
    const normalizedCookie = cookie.trim()

    if (normalizedCookie.startsWith(cookiePrefix)) {
      return decodeURIComponent(normalizedCookie.slice(cookiePrefix.length))
    }
  }

  return null
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") {
    return
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${PREFERENCE_COOKIE_MAX_AGE}; samesite=lax`
}

function getLegacyPatternsValue() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.localStorage.getItem(BLOCKS_STATE_STORAGE_KEY)
  } catch {
    return null
  }
}

const preferenceStringStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") {
      return null
    }

    const cookieName = getPreferenceCookieName(key)
    let cookieValue = readCookie(cookieName)
    if (cookieValue === null && key === COMPONENTS_STATE_STORAGE_KEY) {
      cookieValue = readCookie(PATTERNS_STATE_COOKIE_NAME)
    }

    if (cookieValue !== null) {
      return cookieValue
    }

    try {
      const localValue = window.localStorage.getItem(key)

      if (localValue !== null) {
        writeCookie(cookieName, localValue)
        return localValue
      }
    } catch {
      // Ignore localStorage errors and continue to migration fallback.
    }

    if (key === COMPONENTS_STATE_STORAGE_KEY) {
      const fromLegacyPatterns = window.localStorage.getItem(
        PATTERNS_STATE_STORAGE_KEY
      )
      if (fromLegacyPatterns !== null) {
        try {
          window.localStorage.setItem(key, fromLegacyPatterns)
        } catch {
          // Ignore storage failures during migration.
        }
        writeCookie(cookieName, fromLegacyPatterns)
        return fromLegacyPatterns
      }

      const legacyValue = getLegacyPatternsValue()

      if (legacyValue !== null) {
        try {
          window.localStorage.setItem(key, legacyValue)
        } catch {
          // Ignore storage failures during migration.
        }

        writeCookie(cookieName, legacyValue)
        return legacyValue
      }
    }

    return null
  },
  setItem(key: string, value: string) {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // Ignore storage failures in private or unsupported contexts.
      }
    }

    writeCookie(getPreferenceCookieName(key), value)
  },
  removeItem(key: string) {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key)
      } catch {
        // Ignore storage failures in private or unsupported contexts.
      }
    }

    if (typeof document !== "undefined") {
      document.cookie = `${getPreferenceCookieName(key)}=; path=/; max-age=0; samesite=lax`
    }
  },
  subscribe(key: string, callback: (value: string | null) => void) {
    if (typeof window === "undefined") {
      return undefined
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) {
        callback(event.newValue)
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  },
}

const configStorage = createJSONStorage<Config>(() => preferenceStringStorage)
const componentsLayoutStateStorage = createJSONStorage<ComponentsLayoutState>(
  () => preferenceStringStorage
)
const blocksStateStorage = createJSONStorage<BlocksState>(
  () => preferenceStringStorage
)

export const configAtom = atomWithStorage<Config>(
  CONFIG_STORAGE_KEY,
  DEFAULT_CONFIG,
  configStorage,
  { getOnInit: true }
)

export function useConfig() {
  return useAtom(configAtom)
}

const componentsLayoutStateAtom = atomWithStorage<ComponentsLayoutState>(
  COMPONENTS_STATE_STORAGE_KEY,
  DEFAULT_COMPONENTS_STATE,
  componentsLayoutStateStorage,
  { getOnInit: true }
)

export function useComponentsLayoutState() {
  return useAtom(componentsLayoutStateAtom)
}

const blocksStateAtom = atomWithStorage<BlocksState>(
  BLOCKS_STATE_STORAGE_KEY,
  DEFAULT_BLOCKS_STATE,
  blocksStateStorage,
  { getOnInit: true }
)

export function useBlocksState() {
  return useAtom(blocksStateAtom)
}

const dismissedAnnouncementsAtom = atomWithStorage<string[]>(
  "dismissed-announcements",
  []
)

export function useDismissedAnnouncements() {
  return useAtom(dismissedAnnouncementsAtom)
}

```

### Core Architecture Module: `hooks/use-copy-to-clipboard.ts`
```
"use client"

import * as React from "react"

export function useCopyToClipboard({
  timeout = 2000,
  onCopy,
}: {
  timeout?: number
  onCopy?: () => void
} = {}) {
  const [isCopied, setIsCopied] = React.useState(false)

  const copyToClipboard = (value: string) => {
    if (typeof window === "undefined" || !navigator.clipboard.writeText) {
      return
    }

    if (!value) return

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true)

      if (onCopy) {
        onCopy()
      }

      if (timeout !== 0) {
        setTimeout(() => {
          setIsCopied(false)
        }, timeout)
      }
    }, console.error)
  }

  return { isCopied, copyToClipboard }
}

```

### Core Architecture Module: `hooks/use-intersection-observer.ts`
```
"use client"

import * as React from "react"

interface IntersectionObserverOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean
}

/**
 * A shared intersection observer to manage multiple targets with a single observer instance.
 * Optimized for high-density lists like the components grid.
 */
class SharedObserver {
  private observer: IntersectionObserver | null = null
  private callbacks = new Map<Element, (isIntersecting: boolean) => void>()
  private options: IntersectionObserverInit

  constructor(options: IntersectionObserverInit) {
    this.options = options
  }

  private getObserver() {
    if (!this.observer) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const callback = this.callbacks.get(entry.target)
          if (callback) {
            callback(entry.isIntersecting)
          }
        })
      }, this.options)
    }
    return this.observer
  }

  observe(element: Element, callback: (isIntersecting: boolean) => void) {
    this.callbacks.set(element, callback)
    this.getObserver().observe(element)
  }

  unobserve(element: Element) {
    this.callbacks.delete(element)
    this.observer?.unobserve(element)
  }

  disconnect() {
    this.observer?.disconnect()
    this.callbacks.clear()
    this.observer = null
  }
}

// Singleton instances for common root margins to maximize reuse
const observers = new Map<string, SharedObserver>()

function getSharedObserver(options: IntersectionObserverInit) {
  const key = JSON.stringify(options)
  if (!observers.has(key)) {
    observers.set(key, new SharedObserver(options))
  }
  return observers.get(key)!
}

export function useIntersectionObserver(
  elementRef: React.RefObject<Element | null>,
  {
    threshold = 0,
    root = null,
    rootMargin = "0%",
    freezeOnceVisible = false,
  }: IntersectionObserverOptions = {}
): boolean {
  const [isIntersecting, setIntersecting] = React.useState(false)
  const frozen = React.useRef(false)

  React.useEffect(() => {
    const element = elementRef?.current
    if (!element || (freezeOnceVisible && frozen.current)) return

    const observer = getSharedObserver({ threshold, root, rootMargin })

    observer.observe(element, (intersecting) => {
      setIntersecting(intersecting)
      if (intersecting && freezeOnceVisible) {
        frozen.current = true
        observer.unobserve(element)
      }
    })

    return () => {
      observer.unobserve(element)
    }
  }, [elementRef, threshold, root, rootMargin, freezeOnceVisible])

  return isIntersecting
}

```

### Core Architecture Module: `hooks/use-isomorphic-layout-effect.ts`
```
import * as React from "react"

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

export { useIsomorphicLayoutEffect }

```

### Core Architecture Module: `hooks/use-layout.tsx`
```
"use client"

import * as React from "react"

type Layout = "fixed" | "full"

interface LayoutProviderProps {
  children: React.ReactNode
  defaultLayout?: Layout
  forcedLayout?: Layout
  storageKey?: string
  attribute?: string | string[]
  value?: Record<string, string>
}

interface LayoutProviderState {
  layout: Layout
  setLayout: (layout: Layout | ((prev: Layout) => Layout)) => void
  forcedLayout?: Layout
}

const isServer = typeof window === "undefined"
const LayoutContext = React.createContext<LayoutProviderState | undefined>(
  undefined
)

const saveToLS = (storageKey: string, value: string) => {
  try {
    localStorage.setItem(storageKey, value)
  } catch {
    // Unsupported
  }
}

const useLayout = () => {
  const context = React.useContext(LayoutContext)
  if (context === undefined) {
    throw new Error("useLayout must be used within a LayoutProvider")
  }
  return context
}

const Layout = ({
  forcedLayout,
  storageKey = "layout",
  defaultLayout = "full",
  attribute = "class",
  value,
  children,
}: LayoutProviderProps) => {
  const [layout, setLayoutState] = React.useState<Layout>(() => {
    if (isServer) return defaultLayout
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved === "fixed" || saved === "full") {
        return saved
      }
      return defaultLayout
    } catch {
      return defaultLayout
    }
  })

  const attrs = !value ? ["layout-fixed", "layout-full"] : Object.values(value)

  const applyLayout = React.useCallback(
    (layout: Layout) => {
      if (!layout) return

      const name = value ? value[layout] : `layout-${layout}`
      const d = document.documentElement

      const handleAttribute = (attr: string) => {
        if (attr === "class") {
          d.classList.remove(...attrs)
          if (name) d.classList.add(name)
        } else if (attr.startsWith("data-")) {
          if (name) {
            d.setAttribute(attr, name)
          } else {
            d.removeAttribute(attr)
          }
        }
      }

      if (Array.isArray(attribute)) attribute.forEach(handleAttribute)
      else handleAttribute(attribute)
    },
    [attrs, attribute, value]
  )

  const setLayout = React.useCallback(
    (value: Layout | ((prev: Layout) => Layout)) => {
      if (typeof value === "function") {
        setLayoutState((prevLayout) => {
          const newLayout = value(prevLayout)
          saveToLS(storageKey, newLayout)
          return newLayout
        })
      } else {
        setLayoutState(value)
        saveToLS(storageKey, value)
      }
    },
    [storageKey]
  )

  // localStorage event handling
  React.useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return

      if (!e.newValue) {
        setLayout(defaultLayout)
      } else if (e.newValue === "fixed" || e.newValue === "full") {
        setLayoutState(e.newValue)
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [setLayout, storageKey, defaultLayout])

  // Apply layout on mount and when it changes
  React.useEffect(() => {
    const currentLayout = forcedLayout ?? layout
    applyLayout(currentLayout)
  }, [forcedLayout, layout, applyLayout])

  // Prevent layout changes during hydration
  const [isHydrated, setIsHydrated] = React.useState(false)
  React.useEffect(() => {
    setIsHydrated(true)
  }, [])

  const providerValue = React.useMemo(
    () => ({
      layout: isHydrated ? layout : defaultLayout,
      setLayout,
      forcedLayout,
    }),
    [layout, setLayout, forcedLayout, isHydrated, defaultLayout]
  )

  return (
    <LayoutContext.Provider value={providerValue}>
      {children}
    </LayoutContext.Provider>
  )
}

const LayoutProvider = (props: LayoutProviderProps) => {
  const context = React.useContext(LayoutContext)

  // Ignore nested context providers, just passthrough children
  if (context) return <>{props.children}</>
  return <Layout {...props} />
}

export { useLayout, LayoutProvider }

```

### Core Architecture Module: `hooks/use-media-query.ts`
```
import * as React from "react"

/**
 * Tri-state media query hook: `undefined` until the first client effect
 * resolves (SSR and the very first render), then a live boolean.
 *
 * Unlike `useIsMobile`, the unresolved state is observable on purpose so
 * callers can defer work (e.g. mounting an iframe) until the breakpoint
 * is actually known instead of guessing a default.
 *
 * Prefer rem-based queries (e.g. "(min-width: 64rem)") when matching a
 * Tailwind breakpoint: both CSS media queries and matchMedia resolve rem
 * against the initial 16px font size, so they cannot disagree under
 * browser font scaling the way a hardcoded px query can.
 */
export function useMediaQuery(query: string): boolean | undefined {
  const [matches, setMatches] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => {
      setMatches(mql.matches)
    }
    mql.addEventListener("change", onChange)
    setMatches(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return matches
}

```

### Core Architecture Module: `hooks/use-meta-color.ts`
```
import * as React from "react"
import { useTheme } from "next-themes"

export const META_THEME_COLORS = {
  light: "#ffffff",
  dark: "#0a0a0a",
}

export function useMetaColor() {
  const { resolvedTheme } = useTheme()

  const metaColor = React.useMemo(() => {
    return resolvedTheme !== "dark"
      ? META_THEME_COLORS.light
      : META_THEME_COLORS.dark
  }, [resolvedTheme])

  const setMetaColor = React.useCallback((color: string) => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", color)
  }, [])

  return {
    metaColor,
    setMetaColor,
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #129** (2026-09-16): **Data-Grid i18n behind required authorization**
  *Symptoms*: Hello,  I was looking to update the DataGrid components which is 5-6 months old. But i got an issue about required auth for "data-grid-i18n.json  ``` Something went wrong. Please check the error below for more details. If the problem persists, please open an issue on GitHub.  Error: You are not authorized to access the item at https://reui.io/r/base-vega/data-grid-i18n.json. If this is a remote registry, you may need to authenticate.  Message: [Authentication required] Provide your license key via Authorization header: Bearer YOUR_LICENSE_KEY  Suggestion: Check your authentication credentials and environment variables. ```  Normally this endpoint/json should be accessible, but actually it just block the shadcn cli   Command ran: ```sh npx shadcn add @reui/data-grid --diff ```   Thanks for the help
  **Post-Mortem & Fix Analysis**:
  > It was resolved.

- **Issue #96** (2026-07-18): **Registry endpoint returning 404 — workaround via GitHub raw**
  *Symptoms*: ## Registry endpoint returning 404 — workaround via GitHub raw  **Environment** - `shadcn`: 4.10.0 - Registry config: `components.json` - Style: `base-nova`  ## Problem  The registry URL documented in the ReUI get-started guide (`https://reui.io/r/{style}/{name}.json`) does not serve component JSON. The server redirects to `/r/styles/{style}/{name}.json`, but that endpoint also returns a Next.js HTML 404 page for all component and style names. This breaks both the shadcn CLI (`pnpm dlx shadcn add @reui/<name>`) and any MCP-based tooling that calls the registry.  ## Workaround  Point the `@reui` registry at GitHub raw content, which hosts the same JSON files that the live endpoint should serve:  ```json "registries": {   "@reui": "https://raw.githubusercontent.com/keenthemes/reui/main/public/r/styles/{style}/{name}.json" } ```  With this change, `pnpm dlx shadcn add @reui/<name>` works correctly. Note that the correct style name is `base-nova` (e.g. `base-lyra`, `base-maia`), not the short form (`nova`).  ## Remaining limitation  `list_items` and `search_items` via the shadcn MCP still fail because there is no `registry.json` index file available at the GitHub raw URL. Individual component installs work; browsing the registry programmatically does not.  ## Expected fix  The `/r/styles/{style}/{name}.json` route on reui.io should serve the JSON files that exist in `public/r/styles/` in the repository.   ### NOTE The above was written by Claude Code after I instructed it to find
  **Post-Mortem & Fix Analysis**:
  > @clveranis Is manual CLI setup working in your end ? For example  "shadcn@latest add @reui/c-accordion-1" ?   The below setup should work same way as your workaround.  `"registries": { 		"@reui": { 			"url": "https://reui.io/r/{style}/{name}.json" 		} 	}`  The issue is with MCP mode only ? if you could provide more info i will check further and make sure it will work for manual CLI and MCP mode as well. 
  > Resolved with latest update

- **Issue #83** (2026-03-17): **copy to clipboard button not copying all code unless expanded**
  *Symptoms*: On any code snippet in https://reui.io/docs - if you hit the copy to clipboard button it only copies the lines rendered, so unless you click the "View Code" button you're only getting a few lines copied to your clipboard
  **Post-Mortem & Fix Analysis**:
  > @jrnxf appreciate reporting this, we have fixed it in this today's new release. 

- **Issue #75** (2026-02-19): **fix(components): resolve autocomplete form validation and selection issues**
  *Symptoms*: ## Summary This PR fixes form validation issues in the Autocomplete component that caused: 1. Selection failures when choosing items from the dropdown 2. Immediate validation errors on user input 3. Ability to submit values not in the list  ## Changes - **Remove `itemToStringValue` prop** - Was causing undefined value conversion when items were selected (strings passed to function expecting objects) - **Remove conflicting `value`/`onChange` from `AutocompleteInput`** - Root component already manages input state; duplicates created race conditions - **Fix `data-invalid` attribute** - Changed to `fieldState.invalid || undefined` to prevent `"false"` from rendering as truthy HTML attribute - **Add Zod `.refine()` validation** - Ensures submitted value exists in the items list - **Change validation mode to `onSubmit`** - With `reValidateMode: "onSubmit"` prevents aggressive validation during typing  ## Testing - [ ] Select item from dropdown - should properly populate input - [ ] Type invalid text - should not show error until submit - [ ] Submit with invalid text - should show "Please select a valid item" error - [ ] Select valid item and submit - should succeed  ## Affected Files - `registry-reui/bases/radix/patterns/autocomplete/p-autocomplete-12.tsx` - `registry-reui/bases/base/patterns/autocomplete/p-autocomplete-12.tsx`
  **Post-Mortem & Fix Analysis**:
  > @diogoribeirodev is attempting to deploy a commit to the **Keenthemes** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Keenthemes&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%228efa1c14cd11a8fdd2d518fcf5c1e6f671d5af22%22%7D%2C%22id%22%3A%22QmcqwUGrQg6HidRx1FBstRSw1sJwoBbq6VFmTmDzKbupYA%22%2C%22org%22%3A%22keenthemes%22%2C%22prId%22%3A75%2C%22repo%22%3A%22reui%22%7D).  
  > ## The Problem I Encountered  I was working with the Autocomplete form component and ran into several frustrating validation issues:  ### 1. Selecting an Item Broke Everything When I clicked on an item in the dropdown, the form immediately showed an error and didn't save my selection. The input would clear itself right after I picked something.  I investigated and found that the `itemToStringValue` prop was expecting an Item object but receiving a string. When an item is selected, Base UI calls `itemToStringValue(selectedItemValue)` to fill the input field. Since `AutocompleteItem value={item.value}` passes a string like `"feature"`, the function `(item as Item).value` evaluates `"feature".value` → `undefined` → `""`, which clears the input immediately after selection.  ### 2. Validation Was Way Too Aggressive Every time I typed a single character, the form would flash an error at me. It was impossible to type without seeing "invalid" warnings.  The cause was React Hook For
  > ## Why This PR Includes Formatting Changes  While working on this fix, I noticed the CONTRIBUTING.md guide requires running `npm run format` before submitting changes. When I ran the formatter, it made changes across several files that weren't part of my original fix.  The formatting changes include: - Converting JSON-style quoted keys (`"name":`) to standard JS object keys (`name:`) in registry files - Adding trailing commas to object properties - Wrapping long lines and collapsing single-line JSX - Reordering Tailwind CSS classes  These are purely stylistic changes enforced by the project's formatting configuration. I initially considered separating them into a separate commit, but since the guide instructs contributors to format before submitting, I've included them in this PR to follow the contribution guidelines.  The actual functional changes are isolated to: - `registry-reui/bases/radix/patterns/autocomplete/p-autocomplete-12.tsx` - `registry-reui/bases/base/patter

- **Issue #72** (2026-02-19): **Fix Get Started link**
  *Symptoms*: Fixes https://x.com/abdullahcodes/status/2021891871468101676
  **Post-Mortem & Fix Analysis**:
  > @abdullahtariq1171 is attempting to deploy a commit to the **Keenthemes** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Keenthemes&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%228f6c2cf4524e189d5ea213bf400e92a1833ddec4%22%7D%2C%22id%22%3A%22QmbJfmstXqdBq7ncdHGfGW7nWL4peGnGB7oHTDqCdUzoYh%22%2C%22org%22%3A%22keenthemes%22%2C%22prId%22%3A72%2C%22repo%22%3A%22reui%22%7D).  
  > Thanks for the fix @abdullahtariq1171 

- **Issue #63** (2026-10-01): **[BUG]Kanban: Dragging a card between boards causes client-side crash**
  *Symptoms*: ## Bug Report: Kanban Drag Crash  **Component:** Kanban   **Docs:** https://reui.io/docs/kanban  ---  ### Summary Dragging a card from one board to another causes the application to crash **when the card is held in between the boards** (before dropping).  The error shown: Application error: a client-side exception has occurred while loading reui.io (see the browser console for more information).  ---  ###  Steps to Reproduce  1. Open the Kanban component preview or use the Kanban component in your app. 2. Pick up a card from any board. 3. Drag it towards another board. 4. **Pause/hold the card in the middle area between the boards (not over a drop zone).** 5. The app crashes with a client-side exception.  ---  ### 🎥 Reproduction Video Example:    https://github.com/user-attachments/assets/ea996dbc-70cb-43b1-8d33-bfbe49bf2908  ---  ### ✅ Expected Behavior The drag action should work normally without crashing, even when the card is hovered between boards.  ---  ### ❌ Actual Behavior The application crashes and shows a client-side exception error.  ---  
  **Post-Mortem & Fix Analysis**:
  > This is one of those problems where a dev will typically say to a project manager, it works on my computer, and the project manager will say but it doesn't seem to work on clients computer, from my investigation, this was what i got from Next error log   ## Error Type **Console Error**  ``` ## Error Message Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.  at map ([native code]:null:null) ```  **Next.js version: 15.5.7 (Webpack)**  ## Error Type **Runtime Error**  ``` ## Error Message Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.  Next.js version: 15.5.7 (Webpack) ```  By far, the most difficult thing was even re-creating the error, the error happens in an unpredictable mann
  > Faced similar issue   one workaround is to move cards on onDragEnd (NOT onDragOver)- Not the best btw
  > It seems pretty easy to cause this one:  https://github.com/user-attachments/assets/8dae32b8-a50b-46ee-8e01-07c21fe2b99c

- **Issue #60** (2026-10-01): **[Bug ]DataGrid: Multiple visual bugs in documentation examples**
  *Symptoms*: # DataGrid: Multiple visual bugs in documentation examples  ## Description  I found several visual bugs in the DataGrid component examples that affect both the documentation demos and real-world implementations.  ---  ## Bug 1: Double border in Sub Data Grid example  **Location:** [Sub Data Grid example](https://reui.io/docs/data-grid/sub-data-grid)  **Problem:** The `OrderItemsSubTable` component has two nested containers with borders, causing a visible double border effect.  **Current code:** ```tsx <div className="bg-card rounded-lg border border-muted-foreground/20">     <DataGridContainer>         ...     </DataGridContainer> </div> ```  Both the outer `div` and `DataGridContainer` have borders (DataGridContainer has `border border-border rounded-lg` by default).  **Fix:** ```tsx <DataGridContainer className="bg-card">     ... </DataGridContainer> ```  Or use `<DataGridContainer border={false}>` if you want to keep the outer div.  ---  ## Bug 2: `headerSticky: true` breaks rounded corners  **Problem:** When using `tableLayout={{ headerSticky: true }}`, the table's rounded corners "fade" into transparency with a gradient-like visual glitch.  **Reproduction:** Add `headerSticky: true` to any DataGrid tableLayout prop.  **Workaround:** Don't use `headerSticky: true` until fixed.  ---  ## Bug 3: `columnsResizable: true` causes double border on right edge  **Problem:** When using resizable columns, there's a visible double border on the right edge of the table header.  **Root

- **Issue #19** (2025-08-24): **Error with new component "Kanban"**
  *Symptoms*: Some times when i move the cards it show me this error in the [https://reui.io/docs/kanban](https://reui.io/docs/kanban) page   Console logs -> [REUI Error at new component Kanban.txt](https://github.com/user-attachments/files/21824864/REUI.Error.at.new.component.Kanban.txt)  <img width="1118" height="495" alt="Image" src="https://github.com/user-attachments/assets/87100031-980e-4231-931e-17fe588c8fe6" />  
  **Post-Mortem & Fix Analysis**:
  > Hi,  Could you please share a guide or video to help us reproduce this issue? I’ve tested it multiple times across major browsers but wasn’t able to replicate the problem.  Regards, Sean
  > Here's a demo, letting you know I'm using Brave.  <img width="480" height="149" alt="Image" src="https://github.com/user-attachments/assets/8e844475-0207-4547-bf29-d3d8a8940213" />  ### demo  https://github.com/user-attachments/assets/a9d3bc31-edbb-4b4e-9b16-cbae99bfcd31
  > Hi,  May I know your OS ? Windows or MacOS ?  Tried Brave on MacOS but could not reproduce this issue.   Regards, Sean

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

### Incident Patch 1: `9a28be19` (2026-09-02)
**Commit Message**: bench: data grid benchmark harness (AG Grid Community vs the ReUI Data Grid engine and the live block, 100K rows)

A standalone Vite + Playwright package with the seeded dataset, the runner,
the results of 2026-09-02 and a README that states where AG Grid is better
before any number.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `bench/data-grid/README.md` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+# Data grid benchmark: ReUI Data Grid and AG Grid Community
+
+A reproducible harness, published so the numbers on the comparison page can
+be re-run by anyone. Same machine, same rows, same browser, medians of 3.
+
+## Where AG Grid is better
+
+Written first, because it is true and the comparison is worthless without it:
+
+- Pivoting, aggregation and the Excel-style formula engine: AG Grid Enterprise
+  has them; the ReUI Data Grid does not.
+- Server-side row model, integrated charts and enterprise support contracts:
+  AG Grid.
+- Very large datasets with complex server paging and years of production
+  hardening: AG Grid.
+- A self-contained, themed grid that does not depend on your design system:
+  AG Grid. The ReUI Data Grid is the opposite by design: shadcn/ui components
+  on your tokens.
+
+## What is measured
+
+| Measure | How |
+| --- | --- |
+| First paint | `first-contentful-paint` from the Performance API |
+| Ready | Navigation until the page marks its first rows painted |
+| Scroll p50 / p95 | Frame gaps (requestAnimationFrame deltas) during 40 wheel steps of 600px |
+| Filter latency | Typing "Berlin" into the filter until two frames after the DOM settles |
+| JS bytes | Script bytes transferred on first load |
+
+Three targets:
+
+1. `ag-grid`: AG Grid Community (`ag-grid-react`, all community modules) on
+   100K generated rows, quick filter wired to the input.
+2. `tanstack`: the ReUI Data Grid engine (TanStack Table for the model,
+   TanStack Virtual for rows, sticky header) on the same 100K rows, unstyled.
+   This is the layout the ReUI `DataGridTableVirtual` renders; it measures the
+   engine, not the styled component.
+3. `reui`: the live ReUI virtualization block, by URL, with its own fixture
+   rows. This is the styled component as shipped; its row count is the
+   block's, so compare it with the other two on scroll and filter, not on
+   ready time.
+
+The dataset is seeded (`src/data.ts`), so every run sees the same rows.
+
+## Run it
+
+```bash
+cd bench/data-grid
+pnpm install --ignore-workspace
+pnpm build
+pnpm preview &
+pnpm bench --runs 3 --rows 100000
+# the live block, from a running reui.io dev server or production:
+pnpm bench --reui-url "https://reui.io/preview/base/data-grid-virtualization-1?embed=1"
+```
+
+Playwright needs a Chromium: `npx playwright install chromium` once.
+Results land in `results/<date>.json`; the markdown table prints to stdout
+and is pasted into the comparison page's SSOT (`lib/data/comparisons.ts`)
+with the date and the machine.
+
+## Results, 2026-09-02
+
+Apple Silicon Mac, Chromium headless shell 151 (Playwright 1.58), 120 Hz
+display (so a scroll p50 of 8.3 ms is one frame), 100,000 rows, median of 3.
+Raw numbers in `results/2026-09-02.json` (local) and
+`results/2026-09-02-prod.json` (the live block from reui.io).
+
+| target | first paint | ready | scroll p50 | scroll p95 | scrolled | filter | JS bytes |
+| --- | --- | --- | --- | --- | --- | --- | --- |
+| AG Grid Community 36.1 | 48 ms | 303 ms | 8.3 ms | 9.8 ms | 24,000 px | 76.2 ms | 1,319 KB |
+| ReUI Data Grid engine (TanStack Table 8 + Virtual 3) | 292 ms | 291 ms | 8.3 ms | 12 ms | 24,000 px | 130.1 ms | 267 KB |
+| ReUI virtualization block, live on reui.io | 1340 ms | 2170 ms | 8.3 ms | 48.3 ms | 3,404 px | 32.6 ms | 937 KB |
+
+Reading it honestly:
+
+- AG Grid paints its shell first and fills rows after (first paint 48 ms with 100K rows). The engine page builds the 100K-row model before its first render, so first paint and ready coincide at about 291 ms. That is a render-order choice the ReUI Data Grid does not make today; it is a real AG Grid win on a cold 100K load.
+- Filter latency at 100K rows: AG Grid's quick filter 76.2 ms, the engine's `getFilteredRowModel` 130.1 ms on the main thread. AG Grid wins by about 55 ms; both are under a tenth of a second.
+- Scroll: both the AG Grid page and the engine page hold the 120 Hz cadence (p95 9.8 and 12 ms) through 24,000 px of wheel scrolling. The styled ReUI block does not: p95 48.3 ms live (37 ms on the dev server), over its fixture rows. The styling (many more nodes per row than the bare engine) is the cost, and it is the finding this harness exists to surface; it goes to the data grid backlog, not on a marketing page as a win.
+- JS: the engine is 267 KB against 1,319 KB for AG Grid with all community modules. The live block's 937 KB is the whole reui.io preview page, not the component.
+- The live block's first paint and ready include a network round trip and the Next.js app shell, and its rows are the block fixture (3,404 px of scroll depth, the end of the list), so those two columns are not comparable with the 100K-row pages. Compare it on scroll and filter only.
+
+## Honest limits
+
+- Both bench pages are minimal: no theme, no toolbar, no cell renderers.
+  Production grids on either side will be slower than these numbers.
+- AG Grid Community is measured, not Enterprise; Enterprise feature
```

**File**: `bench/data-grid/ag-grid.html` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="utf-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1" />
+    <title>Bench: ag-grid</title>
+    <style>
+      html, body { margin: 0; font: 14px system-ui, sans-serif; }
+      #controls { display: flex; gap: 8px; padding: 8px; align-items: center; }
+      #grid { height: 640px; }
+    </style>
+  </head>
+  <body>
+    <div id="controls">
+      <label>Filter <input id="filter" type="search" placeholder="type a city" /></label>
+      <span id="status">loading</span>
+    </div>
+    <div id="grid"></div>
+    <script type="module" src="/src/ag-grid.tsx"></script>
+  </body>
+</html>
```

**File**: `bench/data-grid/bench.mts` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+/**
+ * Runs the data grid benchmark and writes results/<date>.json plus a
+ * markdown table to stdout.
+ *
+ *   pnpm build && (pnpm preview &) && pnpm bench
+ *   pnpm bench --reui-url http://localhost:1000/preview/base/data-grid-virtualization-1?embed=1
+ *
+ * Targets:
+ *   ag-grid    AG Grid Community on 100K generated rows (this package)
+ *   tanstack   the ReUI Data Grid engine (TanStack Table + Virtual) on the same rows
+ *   reui       the live ReUI virtualization block, by URL (its own fixture rows)
+ *
+ * Measures, per target, over `--runs` runs (default 3), reporting the median:
+ *   first paint (ms)          performance paint entries after navigation
+ *   ready (ms)                until the page marks its first rows painted
+ *   scroll p50 / p95 (ms)     frame gaps during 40 wheel steps of 600px
+ *   scrolled (px)             proof the target scrolled (0 = wrong scroll element)
+ *   filter latency (ms)       "Berlin" set on the input until the grid DOM changes plus 2 frames,
+ *                             timed in-page (-1 = no DOM change within 3s)
+ *   js bytes                  transferred script bytes on first load
+ */
+import { mkdirSync, writeFileSync } from "node:fs"
+import { chromium } from "playwright"
+
+const arg = (name: string, fallback: string) => {
+  const i = process.argv.indexOf(name)
+  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
+}
+const runs = Number(arg("--runs", "3"))
+const base = arg("--base", "http://localhost:4173")
+const reuiUrl = arg("--reui-url", "")
+const rows = arg("--rows", "100000")
+const label = arg("--label", "")
+
+interface Sample { firstPaint: number; ready: number; scrollP50: number; scrollP95: number; scrolledPx: number; filterMs: number; jsBytes: number }
+const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0 }
+
+async function measure(url: string, live: boolean): Promise<Sample> {
+  const browser = await chromium.launch()
+  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
+  let jsBytes = 0
+  page.on("response", async (res) => {
+    if (/javascript|ecmascript/.test(res.headers()["content-type"] ?? "")) {
+      const len = Number(res.headers()["content-length"] ?? 0)
+      jsBytes += len || (await res.body().catch(() => Buffer.alloc(0))).length
+    }
+  })
+  const started = Date.now()
+  await page.goto(url, { waitUntil: "load" })
+  if (live) {
+    await page.waitForSelector("table, [role=grid], [data-slot=data-grid]", { timeout: 60_000 })
+  } else {
+    await page.waitForFunction(() => (window as unknown as { __benchReady?: boolean }).__benchReady === true, null, { timeout: 120_000 })
+  }
+  const ready = Date.now() - started
+  await page.waitForFunction(() => performance.getEntriesByType("paint").length > 0, null, { timeout: 5_000 }).catch(() => {})
+  const firstPaint = await page.evaluate(() => {
+    const fp = performance.getEntriesByType("paint").find((e) => e.name === "first-contentful-paint")
+    return fp ? Math.round(fp.startTime) : 0
+  })
+  // Scroll: 40 wheel steps, frame gaps sampled with requestAnimationFrame.
+  const scrolled = await page.evaluate(async () => {
+    // The vertical scroller: the deepest element that overflows by more than a
+    // viewport and scrolls; works for AG Grid, the engine page and the ReUI block.
+    const target = [...document.querySelectorAll<HTMLElement>("*")]
+      .filter((el) => el.scrollHeight > el.clientHeight + 100 && /auto|scroll/.test(getComputedStyle(el).overflowY))
+      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? (document.scrollingElement as HTMLElement)
+    const frames: number[] = []
+    let last = performance.now()
+    let running = true
+    const tick = () => { const now = performance.now(); frames.push(now - last); last = now; if (running) requestAnimationFrame(tick) }
+    requestAnimationFrame(tick)
+    for (let i = 0; i < 40; i++) {
+      target.scrollBy(0, 600)
+      target.dispatchEvent(new WheelEvent("wheel", { deltaY: 600, bubbles: true }))
+      await new Promise((r) => setTimeout(r, 32))
+    }
+    running = false
+    return { frames: frames.slice(2), px: target.scrollTop }
+  })
+  const gaps = scrolled.frames
+  const sorted = [...gaps].sort((a, b) => a - b)
+  const scrollP50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0
+  const scrollP95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
+  // Filter latency: type a city, wait for the DOM to settle.
+  let filterMs = 0
+  const filterSelector = live ? 'input[type="search"], input[placeholder*="Search" i]' : "#filter"
+  if ((await page.locator(filterSelector).count()) > 0) {
+    filterMs = await page.evaluate(async (selector) => {
+      const input = document.querySelector(selector) as HTMLInputElement
+      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
+      const t0 = performance.now()
+      set
```

**File**: `bench/data-grid/package.json` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+{
+  "name": "reui-bench-data-grid",
+  "private": true,
+  "version": "0.1.0",
+  "type": "module",
+  "description": "Reproducible data grid benchmark: AG Grid Community against the ReUI Data Grid engine (TanStack Table + TanStack Virtual) on the same 100K rows, plus the live ReUI virtualization block by URL.",
+  "scripts": {
+    "dev": "vite",
+    "build": "vite build",
+    "preview": "vite preview --port 4173 --strictPort",
+    "bench": "node --experimental-strip-types bench.mts"
+  },
+  "dependencies": {
+    "@tanstack/react-table": "^8.21.3",
+    "@tanstack/react-virtual": "^3.13.12",
+    "ag-grid-community": "^36.1.0",
+    "ag-grid-react": "^36.1.0",
+    "react": "^19.1.0",
+    "react-dom": "^19.1.0"
+  },
+  "devDependencies": {
+    "@types/node": "^22",
+    "@types/react": "^19.1.0",
+    "@types/react-dom": "^19.1.0",
+    "@vitejs/plugin-react": "^4.4.1",
+    "playwright": "^1.58.2",
+    "typescript": "^5.8.3",
+    "vite": "^6.3.5"
+  }
+}
```

**File**: `bench/data-grid/pnpm-lock.yaml` (added, +1283/-0)
```diff
@@ -0,0 +1,1283 @@
+lockfileVersion: '9.0'
+
+settings:
+  autoInstallPeers: true
+  excludeLinksFromLockfile: false
+
+importers:
+
+  .:
+    dependencies:
+      '@tanstack/react-table':
+        specifier: ^8.21.3
+        version: 8.21.3(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
+      '@tanstack/react-virtual':
+        specifier: ^3.13.12
+        version: 3.14.10(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
+      ag-grid-community:
+        specifier: ^36.1.0
+        version: 36.1.0
+      ag-grid-react:
+        specifier: ^36.1.0
+        version: 36.1.0(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
+      react:
+        specifier: ^19.1.0
+        version: 19.2.8
+      react-dom:
+        specifier: ^19.1.0
+        version: 19.2.8(react@19.2.8)
+    devDependencies:
+      '@types/node':
+        specifier: ^22
+        version: 22.20.1
+      '@types/react':
+        specifier: ^19.1.0
+        version: 19.2.18
+      '@types/react-dom':
+        specifier: ^19.1.0
+        version: 19.2.5(@types/react@19.2.18)
+      '@vitejs/plugin-react':
+        specifier: ^4.4.1
+        version: 4.7.0(vite@6.4.3(@types/node@22.20.1))
+      playwright:
+        specifier: ^1.58.2
+        version: 1.62.1
+      typescript:
+        specifier: ^5.8.3
+        version: 5.9.3
+      vite:
+        specifier: ^6.3.5
+        version: 6.4.3(@types/node@22.20.1)
+
+packages:
+
+  '@babel/code-frame@7.29.7':
+    resolution: {integrity: sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/compat-data@7.29.7':
+    resolution: {integrity: sha512-locTkQyKvwIEgBzVrn8693ebc97F2U8ZHjbXwDXJ5Fn2TCpNwTlKcaKLkdHop5c/icOFE7qt7Q9JC5hnKNa6Gg==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/core@7.29.7':
+    resolution: {integrity: sha512-RgHBCvtjbOK2gXSNBNIkNoEc9qoVEtau3hj8gEqKQuL3HZAibKarWFEI3Lfm6EYKkLalOh8eSrj9b+ch9H/VBA==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/generator@7.29.8':
+    resolution: {integrity: sha512-gZbepsdh3WDtgZKWL+vTPh71LSBrm/Y4/QDZBVCcYfmeTEEuoOYwlSy+G1StfJg+/Zy550u/3TATbm7qDbbMtg==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/helper-compilation-targets@7.29.7':
+    resolution: {integrity: sha512-wem6WaBj4NaVYVdNhLPPVacES6ZJ+KBBfSkTMD3YZxbP3rm3Di85tJU5ljaUNhaOynt+Aj0xruhYuzQBt8n71g==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/helper-globals@7.29.7':
+    resolution: {integrity: sha512-3nQVUAtvkKH9zahfWgw96Jc/uFOmjACE1kQz82E2lqWmHBgjzbNlsC22nuQTfahmWeQtTq5nQ/4Nnd2A1wj4zA==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/helper-module-imports@7.29.7':
+    resolution: {integrity: sha512-ejHwrQQYcm9xnTivShn2IDOlIzInN34AXskvq9QicvCtEzq1Vzclu/tKF8Jq1Cg8JG2GL6/EmjgsCT7lXepE3g==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/helper-module-transforms@7.29.7':
+    resolution: {integrity: sha512-UPUVSyXbOh627KiCIGQSgwWzGeBKLkaJ9PJEdrngIwMSzxLR4jS4+f1f1jb7VzBbg8nFLaYotvVPFCTqdrmTAg==}
+    engines: {node: '>=6.9.0'}
+    peerDependencies:
+      '@babel/core': ^7.0.0
+
+  '@babel/helper-plugin-utils@7.29.7':
+    resolution: {integrity: sha512-G7sHYigPY17oO5SYWnfD/0MTBwVR781S/JI643e/JhUYgVgWE/61SoW3NH9KWUKyKq5LVh3npif99Wkt6j86Jw==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/helper-string-parser@7.29.7':
+    resolution: {integrity: sha512-Pb5ijPrZ89GDH8223L4UP8i6QApWxs04RbPQJTeWDV0/keR2E36MeKnyr6LYmUUvqRRI+Iv87SuF1W6ErINzYw==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/helper-validator-identifier@7.29.7':
+    resolution: {integrity: sha512-qehxGkRj55h/ff8EMaJ+cYhyaKlHIxqYDn682wQD7RNp9UujOQsHog2uS0r2vzr4pW+sXf90NeeayjcNaX3fFg==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/helper-validator-option@7.29.7':
+    resolution: {integrity: sha512-N9ZErrD+yW5geCDtBqnOoxmR8+tNKiGuxKlDpuJxfsqpa2dFcexaziGAE/qoHLiDDreVNMupxGmSoNlyvsA3gw==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/helpers@7.29.7':
+    resolution: {integrity: sha512-1k2lAGRMfHTcwuNYcCNUmaUffmQv8KWMfh2iJUUeRlwlwH4FdNG7mfPI10NPfLHJFThE4Tyr4mv7kTNZOiPuBg==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/parser@7.29.8':
+    resolution: {integrity: sha512-E8lTAYNB1KW+FH+VGJuZM1ioAx2E6oVlvQFRrf5P8ZZmsiJXYAD9vTFV7yyEURNzgh1dFqMZuO6tUwcARbqFCA==}
+    engines: {node: '>=6.0.0'}
+    hasBin: true
+
+  '@babel/plugin-transform-react-jsx-self@7.29.7':
+    resolution: {integrity: sha512-TL0hMc9xzy86VD31nUiwzd5otRAcyEPcsegCxolO0PvcXuH1v0kECe/UIznYFihpkvU5wg/jk4v0TTEFfm53fw==}
+    engines: {node: '>=6.9.0'}
+    peerDependencies:
+      '@babel/core': ^7.0.0-0
+
+  '@babel/plugin-transform-react-jsx-source@7.29.7':
+    resolution: {integrity: sha512-06IyK09H3wi4cGbhDBwp5gUGo0IKtnYa8tyTiephirPCK6fbobVGiXMMI5zLQ4aKEYP3wZ3ArU44o+8KMrSG/Q==}
+    engines: {node: '>=6.9.0'}
+    peerDependencies:
+      '@babel/core': ^7.0.0-0
+
+  '@babel/template@7.29.7':
+    resolution: {integrity: sha512-puq+Gf35oI24FeN11LkoUQFqv9uwNeWpxXZi/Ji3rRIoKAzKnxRaZ+Gkj0vKS9ZCiTESfng1N9LyOyXvo+m+Gg==}
+    engines: {node: '>=6.9.0'}
+
+  '@babel/traverse@7.29.8':
+    resolution: 
```

**File**: `bench/data-grid/results/2026-09-02-prod.json` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+{
+  "date": "2026-09-02",
+  "rows": 100000,
+  "runs": 3,
+  "results": {
+    "ag-grid": {
+      "firstPaint": 48,
+      "ready": 300,
+      "scrollP50": 8.3,
+      "scrollP95": 9.6,
+      "scrolledPx": 24000,
+      "filterMs": 73.8,
+      "jsBytes": 1350897,
+      "runs": 3,
+      "url": "http://localhost:4173/ag-grid.html?rows=100000"
+    },
+    "tanstack (ReUI Data Grid engine)": {
+      "firstPaint": 288,
+      "ready": 291,
+      "scrollP50": 8.3,
+      "scrollP95": 11,
+      "scrolledPx": 24000,
+      "filterMs": 130,
+      "jsBytes": 273892,
+      "runs": 3,
+      "url": "http://localhost:4173/tanstack.html?rows=100000"
+    },
+    "reui (live block)": {
+      "firstPaint": 1340,
+      "ready": 2170,
+      "scrollP50": 8.3,
+      "scrollP95": 48.3,
+      "scrolledPx": 3404,
+      "filterMs": 32.6,
+      "jsBytes": 959176,
+      "runs": 3,
+      "url": "https://reui.io/preview/base/data-grid-virtualization-1?embed=1"
+    }
+  }
+}
```

**File**: `bench/data-grid/results/2026-09-02.json` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+{
+  "date": "2026-09-02",
+  "rows": 100000,
+  "runs": 3,
+  "results": {
+    "ag-grid": {
+      "firstPaint": 48,
+      "ready": 303,
+      "scrollP50": 8.3,
+      "scrollP95": 9.8,
+      "scrolledPx": 24000,
+      "filterMs": 76.2,
+      "jsBytes": 1350897,
+      "runs": 3,
+      "url": "http://localhost:4173/ag-grid.html?rows=100000"
+    },
+    "tanstack (ReUI Data Grid engine)": {
+      "firstPaint": 292,
+      "ready": 291,
+      "scrollP50": 8.3,
+      "scrollP95": 12,
+      "scrolledPx": 24000,
+      "filterMs": 130.1,
+      "jsBytes": 273892,
+      "runs": 3,
+      "url": "http://localhost:4173/tanstack.html?rows=100000"
+    },
+    "reui (live block)": {
+      "firstPaint": 416,
+      "ready": 1169,
+      "scrollP50": 8.3,
+      "scrollP95": 37,
+      "scrolledPx": 3404,
+      "filterMs": 76.9,
+      "jsBytes": 6543340,
+      "runs": 3,
+      "url": "http://localhost:3210/preview/base/data-grid-virtualization-1?embed=1"
+    }
+  }
+}
```

**File**: `bench/data-grid/src/ag-grid.tsx` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+import { AllCommunityModule, ModuleRegistry, type ColDef, type GridApi } from "ag-grid-community"
+import { AgGridReact } from "ag-grid-react"
+import { StrictMode, useMemo, useRef } from "react"
+import { createRoot } from "react-dom/client"
+
+import { COLUMNS, makeRows, markReady, type Row } from "./data"
+
+ModuleRegistry.registerModules([AllCommunityModule])
+
+function App() {
+  const rows = useMemo(() => makeRows(), [])
+  const api = useRef<GridApi<Row> | null>(null)
+  const columnDefs = useMemo<ColDef<Row>[]>(
+    () => COLUMNS.map((c) => ({ field: c.key, headerName: c.label, width: c.width, sortable: true })),
+    []
+  )
+  return (
+    <div className="ag-theme-quartz" style={{ height: "100%" }}>
+      <AgGridReact<Row>
+        rowData={rows}
+        columnDefs={columnDefs}
+        rowHeight={36}
+        headerHeight={36}
+        onFirstDataRendered={(event) => {
+          api.current = event.api
+          markReady(rows.length)
+          const filter = document.getElementById("filter") as HTMLInputElement
+          filter.addEventListener("input", () => {
+            event.api.setGridOption("quickFilterText", filter.value)
+          })
+        }}
+      />
+    </div>
+  )
+}
+
+createRoot(document.getElementById("grid")!).render(
+  <StrictMode>
+    <App />
+  </StrictMode>
+)
```

---

### Incident Patch 2: `7eb5e9f2` (2026-07-25)
**Commit Message**: Merge pull request #104 from focus0802/codex/fix-data-grid-type-imports

fix(data-grid): use type-only imports

**File**: `public/r/styles/base-luma/data-grid-column-filter.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-column-filter","type":"registry:ui","title":"Data Grid Column Filter","description":"","dependencies":["@tanstack/react-table"],"registryDependencies":["@reui/badge","button","input","popover","separator"],"files":[{"path":"data-grid-column-filter.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport { useMemo, useState } from \"react\"\nimport { Badge } from \"@/components/reui/badge\"\nimport { Column } from \"@tanstack/react-table\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Button } from \"@/components/ui/button\"\nimport { Input } from \"@/components/ui/input\"\nimport {\n  Popover,\n  PopoverContent,\n  PopoverTrigger,\n} from \"@/components/ui/popover\"\nimport { Separator } from \"@/components/ui/separator\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\ninterface DataGridColumnFilterProps<TData, TValue> {\n  column?: Column<TData, TValue>\n  title?: string\n  options: {\n    label: string\n    value: string\n    icon?: React.ComponentType<{ className?: string }>\n  }[]\n}\n\nfunction DataGridColumnFilter<TData, TValue>({\n  column,\n  title,\n  options,\n}: DataGridColumnFilterProps<TData, TValue>) {\n  const facets = column?.getFacetedUniqueValues()\n  const filterValue = column?.getFilterValue()\n  const selectedValues = new Set(\n    Array.isArray(filterValue) ? (filterValue as string[]) : []\n  )\n  const [searchQuery, setSearchQuery] = useState(\"\")\n\n  const filteredOptions = useMemo(() => {\n    if (!searchQuery) return options\n    return options.filter((option) =>\n      option.label.toLowerCase().includes(searchQuery.toLowerCase())\n    )\n  }, [options, searchQuery])\n\n  return (\n    <Popover>\n      <PopoverTrigger\n        render={\n          <Button variant=\"outline\" size=\"sm\">\n            <IconPlaceholder\n              lucide=\"CirclePlusIcon\"\n              tabler=\"IconCirclePlus\"\n              hugeicons=\"AddCircleIcon\"\n              phosphor=\"PlusCircleIcon\"\n              remixicon=\"RiAddCircleLine\"\n              className=\"size-4\"\n            />\n            {title}\n            {selectedValues?.size > 0 && (\n              <>\n                <Separator orientation=\"vertical\" className=\"mx-2 h-4\" />\n                <Badge\n                  variant=\"secondary\"\n                  className=\"px-1 font-normal lg:hidden\"\n                >\n                  {selectedValues.size}\n                </Badge>\n                <div className=\"hidden space-x-1 lg:flex\">\n                  {selectedValues.size > 2 ? (\n                    <Badge variant=\"secondary\" className=\"px-1 font-normal\">\n                      {selectedValues.size} selected\n                    </Badge>\n                  ) : (\n                    options\n                      .filter((option) => selectedValues.has(option.value))\n                      .map((option) => (\n                        <Badge\n                          variant=\"secondary\"\n                          key={option.value}\n                          className=\"px-1 font-normal\"\n                        >\n                          {option.label}\n                        </Badge>\n                      ))\n                  )}\n                </div>\n              </>\n            )}\n          </Button>\n        }\n      />\n      <PopoverContent className=\"w-[200px] p-0\" align=\"start\">\n        <div className=\"p-2\">\n          <Input\n            placeholder={title}\n            value={searchQuery}\n            onChange={(e) => setSearchQuery(e.target.value)}\n            className=\"h-8\"\n          />\n        </div>\n        <div className=\"max-h-[300px] overflow-y-auto\">\n          {filteredOptions.length === 0 ? (\n            <div className=\"text-muted-foreground py-6 text-center text-sm\">\n              No results found.\n            </div>\n          ) : (\n            <div className=\"p-1\">\n              {filteredOptions.map((option) => {\n                const isSelected = selectedValues.has(option.value)\n                const facetCount = facets?.get(option.value)\n                const toggleOption = () => {\n                  if (isSelected) {\n                    selectedValues.delete(option.value)\n                  } else {\n                    selectedValues.add(option.value)\n                  }\n                  const filterValues = Array.from(selectedValues)\n                  column?.setFilterValue(\n                    filterValues.length ? filterValues : undefined\n                  )\n                }\n                return (\n                  <div\n                    key={option.value}\n                    role=\"button\"\n                    tabIndex={0}\n                    aria-pressed={isSelected}\n                    onClick={toggleOption}\n                    onKeyDown={(e) => {\n               
```

**File**: `public/r/styles/base-luma/data-grid-column-header.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-column-header","type":"registry:ui","title":"Data Grid Column Header","description":"","dependencies":["@tanstack/react-table"],"registryDependencies":["button","@reui/data-grid","dropdown-menu"],"files":[{"path":"data-grid-column-header.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport { HTMLAttributes, memo, ReactNode, useMemo } from \"react\"\nimport {\n  getColumnHeaderLabel,\n  useDataGrid,\n} from \"@/components/reui/data-grid/data-grid\"\nimport { Column } from \"@tanstack/react-table\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Button } from \"@/components/ui/button\"\nimport {\n  DropdownMenu,\n  DropdownMenuCheckboxItem,\n  DropdownMenuContent,\n  DropdownMenuGroup,\n  DropdownMenuItem,\n  DropdownMenuLabel,\n  DropdownMenuSeparator,\n  DropdownMenuSub,\n  DropdownMenuSubContent,\n  DropdownMenuSubTrigger,\n  DropdownMenuTrigger,\n} from \"@/components/ui/dropdown-menu\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\ninterface DataGridColumnHeaderProps<\n  TData,\n  TValue,\n> extends HTMLAttributes<HTMLDivElement> {\n  column: Column<TData, TValue>\n  /** When omitted, uses `column.columnDef.meta.headerTitle`, then a string `columnDef.header`, then `column.id`. */\n  title?: string\n  icon?: ReactNode\n  /** Reserved; pin controls are gated by tableLayout.columnsPinnable + column.getCanPin(). */\n  pinnable?: boolean\n  filter?: ReactNode\n  visibility?: boolean\n}\n\nfunction DataGridColumnHeaderInner<TData, TValue>({\n  column,\n  title,\n  icon,\n  className,\n  filter,\n  visibility = false,\n}: DataGridColumnHeaderProps<TData, TValue>) {\n  const { isLoading, table, props } = useDataGrid()\n  const resolvedTitle = title ?? getColumnHeaderLabel(column)\n\n  // TanStack's columnOrder defaults to [] until a consumer seeds it; fall\n  // back to the definition order so Move Left/Right work out of the box.\n  const columnOrderState = table.getState().columnOrder\n  const columnOrder =\n    columnOrderState.length > 0\n      ? columnOrderState\n      : table.getAllLeafColumns().map((leafColumn) => leafColumn.id)\n  const columnVisibilityKey =\n    props.tableLayout?.columnsVisibility && visibility\n      ? JSON.stringify(table.getState().columnVisibility)\n      : \"\"\n  const isSorted = column.getIsSorted()\n  const isPinned = column.getIsPinned()\n  const canSort = column.getCanSort()\n  const canPin = column.getCanPin()\n  const canResize = column.getCanResize()\n\n  const columnIndex = columnOrder.indexOf(column.id)\n  const canMoveLeft = columnIndex > 0\n  const canMoveRight = columnIndex < columnOrder.length - 1\n\n  const handleSort = () => {\n    if (isSorted === \"asc\") {\n      column.toggleSorting(true)\n    } else if (isSorted === \"desc\") {\n      column.clearSorting()\n    } else {\n      column.toggleSorting(false)\n    }\n  }\n\n  const headerLabelClassName = cn(\n    \"text-secondary-foreground/80 inline-flex h-full items-center gap-1.5 font-normal [&_svg]:opacity-60 text-[0.8125rem] leading-[calc(1.125/0.8125)] [&_svg]:size-3.5\",\n    className\n  )\n\n  const headerButtonClassName = cn(\n    \"text-secondary-foreground/80 hover:bg-secondary data-[state=open]:bg-secondary hover:text-foreground data-[state=open]:text-foreground px-2 font-normal h-6 rounded-full\",\n    className\n  )\n\n  const sortIcon =\n    canSort &&\n    (isSorted === \"desc\" ? (\n      <IconPlaceholder\n        lucide=\"ArrowDownIcon\"\n        tabler=\"IconArrowDown\"\n        hugeicons=\"ArrowDown02Icon\"\n        phosphor=\"ArrowDownIcon\"\n        remixicon=\"RiArrowDownLine\"\n        className=\"size-3.25\"\n        aria-hidden=\"true\"\n      />\n    ) : isSorted === \"asc\" ? (\n      <IconPlaceholder\n        lucide=\"ArrowUpIcon\"\n        tabler=\"IconArrowUp\"\n        hugeicons=\"ArrowUp02Icon\"\n        phosphor=\"ArrowUpIcon\"\n        remixicon=\"RiArrowUpLine\"\n        className=\"size-3.25\"\n        aria-hidden=\"true\"\n      />\n    ) : (\n      <IconPlaceholder\n        lucide=\"ChevronsUpDownIcon\"\n        tabler=\"IconSelector\"\n        hugeicons=\"UnfoldMoreIcon\"\n        phosphor=\"CaretUpDownIcon\"\n        remixicon=\"RiExpandUpDownLine\"\n        className=\"mt-px size-3.25\"\n        aria-hidden=\"true\"\n      />\n    ))\n\n  const hasControls =\n    props.tableLayout?.columnsMovable ||\n    (props.tableLayout?.columnsVisibility && visibility) ||\n    (props.tableLayout?.columnsPinnable && canPin) ||\n    filter\n\n  const menuItems = useMemo(() => {\n    const items: ReactNode[] = []\n    let hasPreviousSection = false\n\n    // Filter section\n    if (filter) {\n      items.push(\n        <DropdownMenuGroup key=\"group-filter\">\n          <DropdownMenuLabel key=\"filter\">{filter}</DropdownMenuLabel>\n        </DropdownMenuGroup>\n      )\n      hasPreviousSection = true\n    }\n\n    // Sort section\n    i
```

**File**: `public/r/styles/base-luma/data-grid-column-visibility.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-column-visibility","type":"registry:ui","title":"Data Grid Column Visibility","description":"","dependencies":["@tanstack/react-table"],"registryDependencies":["@reui/data-grid","dropdown-menu"],"files":[{"path":"data-grid-column-visibility.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport { ReactElement } from \"react\"\nimport { getColumnHeaderLabel } from \"@/components/reui/data-grid/data-grid\"\nimport { Table } from \"@tanstack/react-table\"\n\nimport {\n  DropdownMenu,\n  DropdownMenuCheckboxItem,\n  DropdownMenuContent,\n  DropdownMenuGroup,\n  DropdownMenuLabel,\n  DropdownMenuTrigger,\n} from \"@/components/ui/dropdown-menu\"\n\nfunction DataGridColumnVisibility<TData>({\n  table,\n  trigger,\n}: {\n  table: Table<TData>\n  trigger: ReactElement<Record<string, unknown>>\n}) {\n  return (\n    <DropdownMenu>\n      <DropdownMenuTrigger render={trigger} />\n      <DropdownMenuContent align=\"end\" className=\"min-w-[150px]\">\n        <DropdownMenuGroup>\n          <DropdownMenuLabel className=\"font-medium\">\n            Toggle Columns\n          </DropdownMenuLabel>\n          {table\n            .getAllColumns()\n            .filter((column) => column.getCanHide())\n            .map((column) => {\n              return (\n                <DropdownMenuCheckboxItem\n                  key={column.id}\n                  className=\"capitalize\"\n                  checked={column.getIsVisible()}\n                  onSelect={(event) => event.preventDefault()}\n                  onCheckedChange={(value) => column.toggleVisibility(!!value)}\n                >\n                  {getColumnHeaderLabel(column)}\n                </DropdownMenuCheckboxItem>\n              )\n            })}\n        </DropdownMenuGroup>\n      </DropdownMenuContent>\n    </DropdownMenu>\n  )\n}\n\nexport { DataGridColumnVisibility }","target":"components/reui/data-grid/data-grid-column-visibility.tsx"}]}
\ No newline at end of file
+{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-column-visibility","type":"registry:ui","title":"Data Grid Column Visibility","description":"","dependencies":["@tanstack/react-table"],"registryDependencies":["@reui/data-grid","dropdown-menu"],"files":[{"path":"data-grid-column-visibility.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport type { ReactElement } from \"react\"\nimport { getColumnHeaderLabel } from \"@/components/reui/data-grid/data-grid\"\nimport type { Table } from \"@tanstack/react-table\"\n\nimport {\n  DropdownMenu,\n  DropdownMenuCheckboxItem,\n  DropdownMenuContent,\n  DropdownMenuGroup,\n  DropdownMenuLabel,\n  DropdownMenuTrigger,\n} from \"@/components/ui/dropdown-menu\"\n\nfunction DataGridColumnVisibility<TData>({\n  table,\n  trigger,\n}: {\n  table: Table<TData>\n  trigger: ReactElement<Record<string, unknown>>\n}) {\n  return (\n    <DropdownMenu>\n      <DropdownMenuTrigger render={trigger} />\n      <DropdownMenuContent align=\"end\" className=\"min-w-[150px]\">\n        <DropdownMenuGroup>\n          <DropdownMenuLabel className=\"font-medium\">\n            Toggle Columns\n          </DropdownMenuLabel>\n          {table\n            .getAllColumns()\n            .filter((column) => column.getCanHide())\n            .map((column) => {\n              return (\n                <DropdownMenuCheckboxItem\n                  key={column.id}\n                  className=\"capitalize\"\n                  checked={column.getIsVisible()}\n                  onSelect={(event) => event.preventDefault()}\n                  onCheckedChange={(value) => column.toggleVisibility(!!value)}\n                >\n                  {getColumnHeaderLabel(column)}\n                </DropdownMenuCheckboxItem>\n              )\n            })}\n        </DropdownMenuGroup>\n      </DropdownMenuContent>\n    </DropdownMenu>\n  )\n}\n\nexport { DataGridColumnVisibility }","target":"components/reui/data-grid/data-grid-column-visibility.tsx"}]}
\ No newline at end of file
```

**File**: `public/r/styles/base-luma/data-grid-pagination.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-pagination","type":"registry:ui","title":"Data Grid Pagination","description":"","dependencies":[],"registryDependencies":["button","@reui/data-grid","select","skeleton"],"files":[{"path":"data-grid-pagination.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport React, { ReactNode } from \"react\"\nimport { useDataGrid } from \"@/components/reui/data-grid/data-grid\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Button } from \"@/components/ui/button\"\nimport {\n  Select,\n  SelectContent,\n  SelectItem,\n  SelectTrigger,\n  SelectValue,\n} from \"@/components/ui/select\"\nimport { Skeleton } from \"@/components/ui/skeleton\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\ninterface DataGridPaginationProps {\n  sizes?: number[]\n  sizesInfo?: string\n  sizesLabel?: string\n  sizesDescription?: string\n  sizesSkeleton?: ReactNode\n  more?: boolean\n  moreLimit?: number\n  info?: string\n  infoSkeleton?: ReactNode\n  className?: string\n  rowsPerPageLabel?: string\n  previousPageLabel?: string\n  nextPageLabel?: string\n  ellipsisText?: string\n}\n\nfunction DataGridPagination(props: DataGridPaginationProps): React.JSX.Element {\n  const { table, recordCount, isLoading } = useDataGrid()\n\n  const defaultProps: Partial<DataGridPaginationProps> = {\n    sizes: [5, 10, 25, 50, 100],\n    sizesSkeleton: <Skeleton className=\"h-8 w-44\" />,\n    moreLimit: 5,\n    info: \"{from} - {to} of {count}\",\n    infoSkeleton: <Skeleton className=\"h-8 w-60\" />,\n    rowsPerPageLabel: \"Rows per page\",\n    previousPageLabel: \"Go to previous page\",\n    nextPageLabel: \"Go to next page\",\n    ellipsisText: \"...\",\n  }\n\n  const mergedProps: DataGridPaginationProps = { ...defaultProps, ...props }\n\n  const btnBaseClasses = \"p-0 text-sm\"\n  const btnArrowClasses = btnBaseClasses + \" rtl:transform rtl:rotate-180\"\n  const pageIndex = table.getState().pagination.pageIndex\n  const pageSize = table.getState().pagination.pageSize\n  const from = recordCount === 0 ? 0 : pageIndex * pageSize + 1\n  const to = Math.min((pageIndex + 1) * pageSize, recordCount)\n  const pageCount = table.getPageCount()\n\n  // Replace placeholders in paginationInfo\n  const paginationInfo = mergedProps.info\n    ? mergedProps.info\n        .replaceAll(\"{from}\", from.toString())\n        .replaceAll(\"{to}\", to.toString())\n        .replaceAll(\"{count}\", recordCount.toString())\n    : `${from} - ${to} of ${recordCount}`\n\n  // Pagination limit logic\n  const paginationMoreLimit = mergedProps.moreLimit || 5\n\n  // Determine the start and end of the pagination group\n  const currentGroupStart =\n    Math.floor(pageIndex / paginationMoreLimit) * paginationMoreLimit\n  const currentGroupEnd = Math.min(\n    currentGroupStart + paginationMoreLimit,\n    pageCount\n  )\n\n  // Render page buttons based on the current group\n  const renderPageButtons = () => {\n    const buttons = []\n    for (let i = currentGroupStart; i < currentGroupEnd; i++) {\n      buttons.push(\n        <Button\n          key={i}\n          size=\"icon-sm\"\n          variant=\"ghost\"\n          className={cn(btnBaseClasses, \"text-muted-foreground\", {\n            \"bg-accent text-accent-foreground\": pageIndex === i,\n          })}\n          onClick={() => {\n            if (pageIndex !== i) {\n              table.setPageIndex(i)\n            }\n          }}\n        >\n          {i + 1}\n        </Button>\n      )\n    }\n    return buttons\n  }\n\n  // Render a \"previous\" ellipsis button if there are previous pages to show\n  const renderEllipsisPrevButton = () => {\n    if (currentGroupStart > 0) {\n      return (\n        <Button\n          size=\"icon-sm\"\n          className={btnBaseClasses}\n          variant=\"ghost\"\n          onClick={() => table.setPageIndex(currentGroupStart - 1)}\n        >\n          {mergedProps.ellipsisText}\n        </Button>\n      )\n    }\n    return null\n  }\n\n  // Render a \"next\" ellipsis button if there are more pages to show after the current group\n  const renderEllipsisNextButton = () => {\n    if (currentGroupEnd < pageCount) {\n      return (\n        <Button\n          className={btnBaseClasses}\n          variant=\"ghost\"\n          size=\"icon-sm\"\n          onClick={() => table.setPageIndex(currentGroupEnd)}\n        >\n          {mergedProps.ellipsisText}\n        </Button>\n      )\n    }\n    return null\n  }\n\n  return (\n    <div\n      data-slot=\"data-grid-pagination\"\n      className={cn(\n        \"flex grow flex-col flex-wrap items-center justify-between gap-2.5 py-2.5 sm:flex-row sm:py-0\",\n        mergedProps.className\n      )}\n    >\n      <div className=\"order-2 flex flex-wrap items-center space-x-2.5 pb-2.5 sm:order-1 sm:pb-0\">\n        {isLoading ? (\n          mergedProps.sizesSkeleton\n        ) : (\n          <>\n         
```

**File**: `public/r/styles/base-luma/data-grid-scroll-area.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-scroll-area","type":"registry:ui","title":"Data Grid Scroll Area","description":"","dependencies":["@base-ui/react"],"registryDependencies":["@reui/data-grid"],"files":[{"path":"data-grid-scroll-area.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport {\n  PointerEvent,\n  ReactNode,\n  useCallback,\n  useEffect,\n  useRef,\n  useState,\n} from \"react\"\nimport { useDataGrid } from \"@/components/reui/data-grid/data-grid\"\nimport { ScrollArea as ScrollAreaPrimitive } from \"@base-ui/react/scroll-area\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst MIN_THUMB_SIZE = 24\nconst FALLBACK_SCROLLBAR_SIZE = 12\n\nconst INITIAL_METRICS = {\n  hasVerticalOverflow: false,\n  headerHeight: 0,\n  horizontalScrollbarSize: 0,\n  thumbHeight: 0,\n  thumbTop: 0,\n  trackHeight: 0,\n} as const\n\nconst SCROLLBAR_CLASSNAME =\n  \"flex touch-none p-px transition-colors select-none data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:border-t data-[orientation=horizontal]:border-t-transparent data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2 data-[orientation=vertical]:border-s data-[orientation=vertical]:border-s-transparent\"\n\nconst SCROLLBAR_THUMB_CLASSNAME = \"bg-border rounded-full relative flex-1\"\n\ntype DataGridScrollAreaOrientation = \"horizontal\" | \"vertical\" | \"both\"\n\ntype ScrollbarMetrics = {\n  hasVerticalOverflow: boolean\n  headerHeight: number\n  horizontalScrollbarSize: number\n  thumbHeight: number\n  thumbTop: number\n  trackHeight: number\n}\n\ntype ObservedElements = {\n  header: HTMLElement | null\n  horizontalScrollbar: HTMLElement | null\n  table: HTMLElement | null\n  tableViewport: HTMLElement | null\n}\n\ntype DataGridScrollAreaProps = Omit<\n  ScrollAreaPrimitive.Root.Props,\n  \"children\"\n> & {\n  children: ReactNode\n  orientation?: DataGridScrollAreaOrientation\n}\n\nfunction clamp(value: number, min: number, max: number) {\n  return Math.min(max, Math.max(min, value))\n}\n\nfunction areMetricsEqual(next: ScrollbarMetrics, prev: ScrollbarMetrics) {\n  return (\n    next.hasVerticalOverflow === prev.hasVerticalOverflow &&\n    next.headerHeight === prev.headerHeight &&\n    next.horizontalScrollbarSize === prev.horizontalScrollbarSize &&\n    next.thumbHeight === prev.thumbHeight &&\n    next.thumbTop === prev.thumbTop &&\n    next.trackHeight === prev.trackHeight\n  )\n}\n\nfunction applyMetrics(element: HTMLElement, metrics: ScrollbarMetrics) {\n  element.style.setProperty(\n    \"--data-grid-scrollbar-header-height\",\n    `${metrics.headerHeight}px`\n  )\n  element.style.setProperty(\n    \"--data-grid-scrollbar-thumb-height\",\n    `${metrics.thumbHeight}px`\n  )\n  element.style.setProperty(\n    \"--data-grid-scrollbar-thumb-top\",\n    `${metrics.thumbTop}px`\n  )\n  element.style.setProperty(\n    \"--data-grid-scrollbar-track-height\",\n    `${metrics.trackHeight}px`\n  )\n}\n\nfunction DataGridScrollArea({\n  children,\n  className,\n  orientation = \"both\",\n  ...props\n}: DataGridScrollAreaProps) {\n  const { props: dataGridProps, table } = useDataGrid()\n  const containerRef = useRef<HTMLDivElement>(null)\n  const viewportRef = useRef<HTMLDivElement | null>(null)\n  const dragRef = useRef<{\n    pointerId: number\n    startScrollTop: number\n    startY: number\n  } | null>(null)\n  const metricsRef = useRef<ScrollbarMetrics>(INITIAL_METRICS)\n  const observedElementsRef = useRef<ObservedElements>({\n    header: null,\n    horizontalScrollbar: null,\n    table: null,\n    tableViewport: null,\n  })\n\n  const showHorizontal = orientation !== \"vertical\"\n  const showVertical = orientation !== \"horizontal\"\n  const usesCustomVerticalScrollbar =\n    showVertical && !!dataGridProps.tableLayout?.headerSticky\n  // Pinned columns are sticky and never scroll, so the horizontal scrollbar\n  // track is inset to span only the scrollable center region between them.\n  const isColumnsPinnable = !!dataGridProps.tableLayout?.columnsPinnable\n  const scrollbarInsetStart = isColumnsPinnable ? table.getLeftTotalSize() : 0\n  const scrollbarInsetEnd = isColumnsPinnable ? table.getRightTotalSize() : 0\n  const [hasCustomVerticalOverflow, setHasCustomVerticalOverflow] =\n    useState(false)\n\n  const clearDragState = useCallback(() => {\n    dragRef.current = null\n    document.body.style.userSelect = \"\"\n    document.body.style.webkitUserSelect = \"\"\n  }, [])\n\n  const resetMetrics = useCallback(() => {\n    const container = containerRef.current\n\n    if (container && !areMetricsEqual(INITIAL_METRICS, metricsRef.current)) {\n      applyMetrics(container, INITIAL_METRICS)\n      metricsRef.current = INITIAL_METRICS\n    }\n\n    setHasCustomVerticalOverflow((prev) => (prev ? false : prev))\n  }, [])\n\n  const syncCustomVerticalScrollbar = useCallback(() => {\n    const container = container
```

**File**: `public/r/styles/base-luma/data-grid-table-dnd-rows.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-table-dnd-rows","type":"registry:ui","title":"Data Grid Table Dnd Rows","description":"","dependencies":["@dnd-kit/core","@dnd-kit/modifiers","@dnd-kit/sortable","@dnd-kit/utilities","@tanstack/react-table"],"registryDependencies":["button","@reui/data-grid","@reui/data-grid-table"],"files":[{"path":"data-grid-table-dnd-rows.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport {\n  createContext,\n  CSSProperties,\n  memo,\n  ReactNode,\n  useContext,\n  useEffect,\n  useId,\n  useMemo,\n  useRef,\n  useState,\n} from \"react\"\nimport { useDataGrid } from \"@/components/reui/data-grid/data-grid\"\nimport {\n  DataGridTableBase,\n  DataGridTableBody,\n  DataGridTableBodyRow,\n  DataGridTableBodyRowCell,\n  DataGridTableBodyRowExpandded,\n  DataGridTableBodyRowSkeleton,\n  DataGridTableBodyRowSkeletonCell,\n  DataGridTableEmpty,\n  DataGridTableFillBodyCell,\n  DataGridTableFillHeadCell,\n  DataGridTableFoot,\n  DataGridTableHead,\n  DataGridTableHeadRow,\n  DataGridTableHeadRowCell,\n  DataGridTableHeadRowCellResize,\n  DataGridTableRowSpacer,\n  DataGridTableViewport,\n} from \"@/components/reui/data-grid/data-grid-table\"\nimport {\n  closestCenter,\n  DndContext,\n  KeyboardSensor,\n  MouseSensor,\n  TouchSensor,\n  UniqueIdentifier,\n  useSensor,\n  useSensors,\n  type DragEndEvent,\n  type Modifier,\n} from \"@dnd-kit/core\"\nimport { restrictToVerticalAxis } from \"@dnd-kit/modifiers\"\nimport {\n  SortableContext,\n  sortableKeyboardCoordinates,\n  useSortable,\n  verticalListSortingStrategy,\n} from \"@dnd-kit/sortable\"\nimport { CSS } from \"@dnd-kit/utilities\"\nimport {\n  Cell,\n  flexRender,\n  HeaderGroup,\n  Row,\n  Table,\n} from \"@tanstack/react-table\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Button } from \"@/components/ui/button\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\n// Context to share sortable listeners from row to handle\ntype SortableContextValue = ReturnType<typeof useSortable>\nconst SortableRowContext = createContext<Pick<\n  SortableContextValue,\n  \"attributes\" | \"listeners\"\n> | null>(null)\n\nfunction DataGridTableDndRowHandle({ className }: { className?: string }) {\n  const context = useContext(SortableRowContext)\n\n  if (!context) {\n    // Fallback if context is not available (shouldn't happen in normal usage)\n    return (\n      <Button\n        variant=\"ghost\"\n        size=\"icon-sm\"\n        className={cn(\n          \"size-7 cursor-grab opacity-70 hover:bg-transparent hover:opacity-100 active:cursor-grabbing\",\n          className\n        )}\n        aria-label=\"Drag to reorder row\"\n        disabled\n      >\n        <IconPlaceholder\n          lucide=\"GripHorizontalIcon\"\n          tabler=\"IconGripHorizontal\"\n          hugeicons=\"DragDropHorizontalIcon\"\n          phosphor=\"DotsSixIcon\"\n          remixicon=\"RiDraggable\"\n          aria-hidden=\"true\"\n        />\n      </Button>\n    )\n  }\n\n  return (\n    <Button\n      variant=\"ghost\"\n      size=\"icon-sm\"\n      className={cn(\n        \"size-7 cursor-grab opacity-70 hover:bg-transparent hover:opacity-100 active:cursor-grabbing\",\n        className\n      )}\n      aria-label=\"Drag to reorder row\"\n      {...context.attributes}\n      {...context.listeners}\n    >\n      <IconPlaceholder\n        lucide=\"GripHorizontalIcon\"\n        tabler=\"IconGripHorizontal\"\n        hugeicons=\"DragDropHorizontalIcon\"\n        phosphor=\"DotsSixIcon\"\n        remixicon=\"RiDraggable\"\n        aria-hidden=\"true\"\n      />\n    </Button>\n  )\n}\n\nfunction DataGridTableDndRow<TData>({ row }: { row: Row<TData> }) {\n  const {\n    transform,\n    transition,\n    setNodeRef,\n    isDragging,\n    attributes,\n    listeners,\n  } = useSortable({\n    id: row.id,\n  })\n\n  const style: CSSProperties = {\n    transform: CSS.Transform.toString(transform),\n    transition: transition,\n    opacity: isDragging ? 0.8 : 1,\n    zIndex: isDragging ? 1 : 0,\n    position: \"relative\",\n    cursor: isDragging ? \"grabbing\" : undefined,\n  }\n\n  return (\n    <SortableRowContext.Provider value={{ attributes, listeners }}>\n      <DataGridTableBodyRow row={row} dndRef={setNodeRef} dndStyle={style}>\n        {row.getVisibleCells().map((cell: Cell<TData, unknown>) => {\n          return (\n            <DataGridTableBodyRowCell cell={cell} key={cell.id}>\n              {flexRender(cell.column.columnDef.cell, cell.getContext())}\n            </DataGridTableBodyRowCell>\n          )\n        })}\n        <DataGridTableFillBodyCell />\n      </DataGridTableBodyRow>\n      {row.getIsExpanded() && <DataGridTableBodyRowExpandded row={row} />}\n    </SortableRowContext.Provider>\n  )\n}\n\nfunction DataGridTableDndRowsBody<TData>({\n  table,\n  dataIds,\n}: {\n  table: Table<TData>\n  dataIds: UniqueIdentifier[]\n}) {\n  const { isLo
```

**File**: `public/r/styles/base-luma/data-grid-table-dnd.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-table-dnd","type":"registry:ui","title":"Data Grid Table Dnd","description":"","dependencies":["@dnd-kit/core","@dnd-kit/sortable","@dnd-kit/utilities","@tanstack/react-table"],"registryDependencies":["button","@reui/data-grid","@reui/data-grid-table"],"files":[{"path":"data-grid-table-dnd.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport {\n  CSSProperties,\n  Fragment,\n  memo,\n  ReactNode,\n  useEffect,\n  useId,\n  useMemo,\n  useRef,\n  useState,\n} from \"react\"\nimport { useDataGrid } from \"@/components/reui/data-grid/data-grid\"\nimport {\n  DataGridTableBase,\n  DataGridTableBody,\n  DataGridTableBodyRow,\n  DataGridTableBodyRowCell,\n  DataGridTableBodyRowExpandded,\n  DataGridTableBodyRowSkeleton,\n  DataGridTableBodyRowSkeletonCell,\n  DataGridTableEmpty,\n  DataGridTableFillBodyCell,\n  DataGridTableFillHeadCell,\n  DataGridTableFoot,\n  DataGridTableHead,\n  DataGridTableHeadRow,\n  DataGridTableHeadRowCell,\n  DataGridTableHeadRowCellResize,\n  DataGridTableRowSpacer,\n  DataGridTableViewport,\n} from \"@/components/reui/data-grid/data-grid-table\"\nimport {\n  closestCenter,\n  DndContext,\n  KeyboardSensor,\n  Modifier,\n  MouseSensor,\n  TouchSensor,\n  useSensor,\n  useSensors,\n  type DragEndEvent,\n} from \"@dnd-kit/core\"\nimport {\n  horizontalListSortingStrategy,\n  SortableContext,\n  sortableKeyboardCoordinates,\n  useSortable,\n} from \"@dnd-kit/sortable\"\nimport { CSS } from \"@dnd-kit/utilities\"\nimport {\n  Cell,\n  flexRender,\n  Header,\n  HeaderGroup,\n  Row,\n  Table,\n} from \"@tanstack/react-table\"\n\nimport { Button } from \"@/components/ui/button\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nfunction DataGridTableDndHeader<TData>({\n  header,\n}: {\n  header: Header<TData, unknown>\n}) {\n  const { props } = useDataGrid()\n  const { column } = header\n\n  // Check if column ordering is enabled for this column\n  const canOrder =\n    (column.columnDef as { enableColumnOrdering?: boolean })\n      .enableColumnOrdering !== false\n\n  const {\n    attributes,\n    isDragging,\n    listeners,\n    setNodeRef,\n    transform,\n    transition,\n  } = useSortable({\n    id: header.column.id,\n  })\n\n  const style: CSSProperties = {\n    opacity: isDragging ? 0.8 : 1,\n    position: \"relative\",\n    transform: CSS.Translate.toString(transform),\n    transition,\n    cursor: isDragging ? \"grabbing\" : undefined,\n    whiteSpace: \"nowrap\",\n    width: props.tableLayout?.columnsResizable\n      ? `calc(var(--header-${header.id}-size) * 1px)`\n      : header.column.getSize(),\n    zIndex: isDragging ? 1 : 0,\n  }\n\n  return (\n    <DataGridTableHeadRowCell\n      header={header}\n      dndStyle={style}\n      dndRef={setNodeRef}\n    >\n      <div className=\"flex items-center justify-start gap-0.5\">\n        {canOrder && (\n          <Button\n            size=\"icon-sm\"\n            variant=\"ghost\"\n            className={`-ms-2 size-6 ${isDragging ? \"cursor-grabbing\" : \"cursor-grab active:cursor-grabbing\"}`}\n            {...attributes}\n            {...listeners}\n            aria-label=\"Drag to reorder\"\n          >\n            <IconPlaceholder\n              lucide=\"GripVerticalIcon\"\n              tabler=\"IconGripVertical\"\n              hugeicons=\"DragDropVerticalIcon\"\n              phosphor=\"DotsSixVerticalIcon\"\n              remixicon=\"RiDraggable\"\n              className=\"opacity-60 hover:opacity-100\"\n              aria-hidden=\"true\"\n            />\n          </Button>\n        )}\n        <div className=\"grow\">\n          {header.isPlaceholder\n            ? null\n            : flexRender(header.column.columnDef.header, header.getContext())}\n        </div>\n        {props.tableLayout?.columnsResizable && column.getCanResize() && (\n          <DataGridTableHeadRowCellResize header={header} />\n        )}\n      </div>\n    </DataGridTableHeadRowCell>\n  )\n}\n\nfunction DataGridTableDndCell<TData>({ cell }: { cell: Cell<TData, unknown> }) {\n  const { props } = useDataGrid()\n  const { isDragging, setNodeRef, transform, transition } = useSortable({\n    id: cell.column.id,\n  })\n\n  const style: CSSProperties = {\n    opacity: isDragging ? 0.8 : 1,\n    position: \"relative\",\n    transform: CSS.Translate.toString(transform),\n    transition,\n    cursor: isDragging ? \"grabbing\" : undefined,\n    width: props.tableLayout?.columnsResizable\n      ? `calc(var(--col-${cell.column.id}-size) * 1px)`\n      : cell.column.getSize(),\n    zIndex: isDragging ? 1 : 0,\n  }\n\n  return (\n    <DataGridTableBodyRowCell cell={cell} dndStyle={style} dndRef={setNodeRef}>\n      {flexRender(cell.column.columnDef.cell, cell.getContext())}\n    </DataGridTableBodyRowCell>\n  )\n}\n\nfunction DataGridTableDndBodyRows<TData>({ table }: { table: Table<TData> }) {\n  const { isLoading, 
```

**File**: `public/r/styles/base-luma/data-grid-table-virtual.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-table-virtual","type":"registry:ui","title":"Data Grid Table Virtual","description":"","dependencies":["@tanstack/react-table","@tanstack/react-virtual"],"registryDependencies":["@reui/data-grid","@reui/data-grid-table","spinner"],"files":[{"path":"data-grid-table-virtual.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport {\n  CSSProperties,\n  memo,\n  ReactNode,\n  useCallback,\n  useEffect,\n  useRef,\n  useState,\n} from \"react\"\nimport { useDataGrid } from \"@/components/reui/data-grid/data-grid\"\nimport {\n  DataGridTableBase,\n  DataGridTableBody,\n  DataGridTableEmpty,\n  DataGridTableFillBodyCell,\n  DataGridTableFillHeadCell,\n  DataGridTableFoot,\n  DataGridTableHead,\n  DataGridTableHeadRow,\n  DataGridTableHeadRowCell,\n  DataGridTableHeadRowCellResize,\n  DataGridTableRenderedRow,\n  DataGridTableRowSpacer,\n  DataGridTableViewport,\n  getDataGridScrollAreaViewport,\n  getDataGridTableMergedHeaderGroups,\n  getDataGridTableRowSections,\n  getPinningStyles,\n  hasDataGridTableRightPinnedColumns,\n} from \"@/components/reui/data-grid/data-grid-table\"\nimport { Column, flexRender, Row, Table } from \"@tanstack/react-table\"\nimport {\n  useVirtualizer,\n  VirtualItem,\n  Virtualizer,\n  VirtualizerOptions,\n} from \"@tanstack/react-virtual\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Spinner } from \"@/components/ui/spinner\"\n\ntype DataGridTableVirtualScrollElements = {\n  containerElement: HTMLDivElement | null\n  scrollElement: HTMLElement | null\n}\n\ntype DataGridTableVirtualizerInstance = Virtualizer<\n  HTMLElement,\n  HTMLTableRowElement\n>\n\ntype DataGridTableVirtualizerOptions<TData> = Omit<\n  VirtualizerOptions<HTMLElement, HTMLTableRowElement>,\n  \"count\" | \"estimateSize\" | \"getItemKey\" | \"getScrollElement\"\n> & {\n  estimateSize?: (index: number, row: Row<TData>) => number\n  getItemKey?: (index: number, row: Row<TData>) => string | number\n  getScrollElement?: (\n    elements: DataGridTableVirtualScrollElements\n  ) => HTMLElement | null\n}\n\ninterface DataGridTableVirtualProps<TData> {\n  height?: number | string\n  estimateSize?: number\n  overscan?: number\n  footerContent?: ReactNode\n  renderHeader?: boolean\n  onFetchMore?: () => void\n  isFetchingMore?: boolean\n  hasMore?: boolean\n  fetchMoreOffset?: number\n  virtualizerOptions?: DataGridTableVirtualizerOptions<TData>\n}\n\ninterface VirtualBodyProps<TData> {\n  table: Table<TData>\n  topRows: Row<TData>[]\n  centerRows: Row<TData>[]\n  bottomRows: Row<TData>[]\n  virtualItems: VirtualItem[]\n  totalSize: number\n  isVirtualizationEnabled: boolean\n  isInfiniteMode: boolean\n  isFetchingMore: boolean\n  hasMore?: boolean\n  loadingMoreMessage: ReactNode\n  allRowsLoadedMessage: ReactNode\n  measureRowRef?: (element: HTMLTableRowElement | null) => void\n}\n\nfunction DataGridTableVirtualPinnedPlaceholderCell<TData>({\n  column,\n}: {\n  column: Column<TData>\n}) {\n  const { props } = useDataGrid()\n  const isPinned = column.getIsPinned()\n  const isLastLeftPinned = isPinned === \"left\" && column.getIsLastColumn(\"left\")\n  const isFirstRightPinned =\n    isPinned === \"right\" && column.getIsFirstColumn(\"right\")\n\n  return (\n    <td\n      aria-hidden=\"true\"\n      style={{\n        ...(props.tableLayout?.columnsPinnable &&\n          column.getCanPin() &&\n          getPinningStyles(column)),\n        ...(props.tableLayout?.columnsResizable && {\n          width: `calc(var(--col-${column.id}-size) * 1px)`,\n        }),\n      }}\n      data-pinned={isPinned || undefined}\n      data-last-col={\n        isLastLeftPinned ? \"left\" : isFirstRightPinned ? \"right\" : undefined\n      }\n      className={cn(\n        \"p-0\",\n        props.tableLayout?.cellBorder && \"border-e\",\n        props.tableLayout?.columnsPinnable &&\n          column.getCanPin() &&\n          \"data-pinned:bg-background data-pinned:isolate [&[data-pinned=left][data-last-col=left]]:shadow-[inset_-1px_0_0_0_var(--border)] [&[data-pinned=right][data-last-col=right]]:shadow-[inset_1px_0_0_0_var(--border)]\"\n      )}\n    />\n  )\n}\n\nfunction DataGridTableVirtualUtilityRow<TData>({\n  table,\n  children,\n  centerCellClassName,\n  centerCellStyle,\n  rowClassName,\n  ariaHidden,\n}: {\n  table: Table<TData>\n  children: ReactNode\n  centerCellClassName?: string\n  centerCellStyle?: CSSProperties\n  rowClassName?: string\n  ariaHidden?: boolean\n}) {\n  const { props } = useDataGrid()\n  const leftVisibleColumns = table.getLeftVisibleLeafColumns()\n  const centerVisibleColumns = table.getCenterVisibleLeafColumns()\n  const rightVisibleColumns = table.getRightVisibleLeafColumns()\n  const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table)\n\n  return (\n    <tr aria-hidden={ariaHidden || undefined} className={rowClassName}>\n      {leftVisibleColumns.map((column) => (\n        <DataGridTable
```

---

### Incident Patch 3: `1fcd320a` (2026-07-25)
**Commit Message**: fix(data-grid): use type-only imports

**File**: `public/r/styles/base-luma/data-grid-column-filter.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-column-filter","type":"registry:ui","title":"Data Grid Column Filter","description":"","dependencies":["@tanstack/react-table"],"registryDependencies":["@reui/badge","button","input","popover","separator"],"files":[{"path":"data-grid-column-filter.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport { useMemo, useState } from \"react\"\nimport { Badge } from \"@/components/reui/badge\"\nimport { Column } from \"@tanstack/react-table\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Button } from \"@/components/ui/button\"\nimport { Input } from \"@/components/ui/input\"\nimport {\n  Popover,\n  PopoverContent,\n  PopoverTrigger,\n} from \"@/components/ui/popover\"\nimport { Separator } from \"@/components/ui/separator\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\ninterface DataGridColumnFilterProps<TData, TValue> {\n  column?: Column<TData, TValue>\n  title?: string\n  options: {\n    label: string\n    value: string\n    icon?: React.ComponentType<{ className?: string }>\n  }[]\n}\n\nfunction DataGridColumnFilter<TData, TValue>({\n  column,\n  title,\n  options,\n}: DataGridColumnFilterProps<TData, TValue>) {\n  const facets = column?.getFacetedUniqueValues()\n  const filterValue = column?.getFilterValue()\n  const selectedValues = new Set(\n    Array.isArray(filterValue) ? (filterValue as string[]) : []\n  )\n  const [searchQuery, setSearchQuery] = useState(\"\")\n\n  const filteredOptions = useMemo(() => {\n    if (!searchQuery) return options\n    return options.filter((option) =>\n      option.label.toLowerCase().includes(searchQuery.toLowerCase())\n    )\n  }, [options, searchQuery])\n\n  return (\n    <Popover>\n      <PopoverTrigger\n        render={\n          <Button variant=\"outline\" size=\"sm\">\n            <IconPlaceholder\n              lucide=\"CirclePlusIcon\"\n              tabler=\"IconCirclePlus\"\n              hugeicons=\"AddCircleIcon\"\n              phosphor=\"PlusCircleIcon\"\n              remixicon=\"RiAddCircleLine\"\n              className=\"size-4\"\n            />\n            {title}\n            {selectedValues?.size > 0 && (\n              <>\n                <Separator orientation=\"vertical\" className=\"mx-2 h-4\" />\n                <Badge\n                  variant=\"secondary\"\n                  className=\"px-1 font-normal lg:hidden\"\n                >\n                  {selectedValues.size}\n                </Badge>\n                <div className=\"hidden space-x-1 lg:flex\">\n                  {selectedValues.size > 2 ? (\n                    <Badge variant=\"secondary\" className=\"px-1 font-normal\">\n                      {selectedValues.size} selected\n                    </Badge>\n                  ) : (\n                    options\n                      .filter((option) => selectedValues.has(option.value))\n                      .map((option) => (\n                        <Badge\n                          variant=\"secondary\"\n                          key={option.value}\n                          className=\"px-1 font-normal\"\n                        >\n                          {option.label}\n                        </Badge>\n                      ))\n                  )}\n                </div>\n              </>\n            )}\n          </Button>\n        }\n      />\n      <PopoverContent className=\"w-[200px] p-0\" align=\"start\">\n        <div className=\"p-2\">\n          <Input\n            placeholder={title}\n            value={searchQuery}\n            onChange={(e) => setSearchQuery(e.target.value)}\n            className=\"h-8\"\n          />\n        </div>\n        <div className=\"max-h-[300px] overflow-y-auto\">\n          {filteredOptions.length === 0 ? (\n            <div className=\"text-muted-foreground py-6 text-center text-sm\">\n              No results found.\n            </div>\n          ) : (\n            <div className=\"p-1\">\n              {filteredOptions.map((option) => {\n                const isSelected = selectedValues.has(option.value)\n                const facetCount = facets?.get(option.value)\n                const toggleOption = () => {\n                  if (isSelected) {\n                    selectedValues.delete(option.value)\n                  } else {\n                    selectedValues.add(option.value)\n                  }\n                  const filterValues = Array.from(selectedValues)\n                  column?.setFilterValue(\n                    filterValues.length ? filterValues : undefined\n                  )\n                }\n                return (\n                  <div\n                    key={option.value}\n                    role=\"button\"\n                    tabIndex={0}\n                    aria-pressed={isSelected}\n                    onClick={toggleOption}\n                    onKeyDown={(e) => {\n               
```

**File**: `public/r/styles/base-luma/data-grid-column-header.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-column-header","type":"registry:ui","title":"Data Grid Column Header","description":"","dependencies":["@tanstack/react-table"],"registryDependencies":["button","@reui/data-grid","dropdown-menu"],"files":[{"path":"data-grid-column-header.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport { HTMLAttributes, memo, ReactNode, useMemo } from \"react\"\nimport {\n  getColumnHeaderLabel,\n  useDataGrid,\n} from \"@/components/reui/data-grid/data-grid\"\nimport { Column } from \"@tanstack/react-table\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Button } from \"@/components/ui/button\"\nimport {\n  DropdownMenu,\n  DropdownMenuCheckboxItem,\n  DropdownMenuContent,\n  DropdownMenuGroup,\n  DropdownMenuItem,\n  DropdownMenuLabel,\n  DropdownMenuSeparator,\n  DropdownMenuSub,\n  DropdownMenuSubContent,\n  DropdownMenuSubTrigger,\n  DropdownMenuTrigger,\n} from \"@/components/ui/dropdown-menu\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\ninterface DataGridColumnHeaderProps<\n  TData,\n  TValue,\n> extends HTMLAttributes<HTMLDivElement> {\n  column: Column<TData, TValue>\n  /** When omitted, uses `column.columnDef.meta.headerTitle`, then a string `columnDef.header`, then `column.id`. */\n  title?: string\n  icon?: ReactNode\n  /** Reserved; pin controls are gated by tableLayout.columnsPinnable + column.getCanPin(). */\n  pinnable?: boolean\n  filter?: ReactNode\n  visibility?: boolean\n}\n\nfunction DataGridColumnHeaderInner<TData, TValue>({\n  column,\n  title,\n  icon,\n  className,\n  filter,\n  visibility = false,\n}: DataGridColumnHeaderProps<TData, TValue>) {\n  const { isLoading, table, props } = useDataGrid()\n  const resolvedTitle = title ?? getColumnHeaderLabel(column)\n\n  // TanStack's columnOrder defaults to [] until a consumer seeds it; fall\n  // back to the definition order so Move Left/Right work out of the box.\n  const columnOrderState = table.getState().columnOrder\n  const columnOrder =\n    columnOrderState.length > 0\n      ? columnOrderState\n      : table.getAllLeafColumns().map((leafColumn) => leafColumn.id)\n  const columnVisibilityKey =\n    props.tableLayout?.columnsVisibility && visibility\n      ? JSON.stringify(table.getState().columnVisibility)\n      : \"\"\n  const isSorted = column.getIsSorted()\n  const isPinned = column.getIsPinned()\n  const canSort = column.getCanSort()\n  const canPin = column.getCanPin()\n  const canResize = column.getCanResize()\n\n  const columnIndex = columnOrder.indexOf(column.id)\n  const canMoveLeft = columnIndex > 0\n  const canMoveRight = columnIndex < columnOrder.length - 1\n\n  const handleSort = () => {\n    if (isSorted === \"asc\") {\n      column.toggleSorting(true)\n    } else if (isSorted === \"desc\") {\n      column.clearSorting()\n    } else {\n      column.toggleSorting(false)\n    }\n  }\n\n  const headerLabelClassName = cn(\n    \"text-secondary-foreground/80 inline-flex h-full items-center gap-1.5 font-normal [&_svg]:opacity-60 text-[0.8125rem] leading-[calc(1.125/0.8125)] [&_svg]:size-3.5\",\n    className\n  )\n\n  const headerButtonClassName = cn(\n    \"text-secondary-foreground/80 hover:bg-secondary data-[state=open]:bg-secondary hover:text-foreground data-[state=open]:text-foreground px-2 font-normal h-6 rounded-full\",\n    className\n  )\n\n  const sortIcon =\n    canSort &&\n    (isSorted === \"desc\" ? (\n      <IconPlaceholder\n        lucide=\"ArrowDownIcon\"\n        tabler=\"IconArrowDown\"\n        hugeicons=\"ArrowDown02Icon\"\n        phosphor=\"ArrowDownIcon\"\n        remixicon=\"RiArrowDownLine\"\n        className=\"size-3.25\"\n        aria-hidden=\"true\"\n      />\n    ) : isSorted === \"asc\" ? (\n      <IconPlaceholder\n        lucide=\"ArrowUpIcon\"\n        tabler=\"IconArrowUp\"\n        hugeicons=\"ArrowUp02Icon\"\n        phosphor=\"ArrowUpIcon\"\n        remixicon=\"RiArrowUpLine\"\n        className=\"size-3.25\"\n        aria-hidden=\"true\"\n      />\n    ) : (\n      <IconPlaceholder\n        lucide=\"ChevronsUpDownIcon\"\n        tabler=\"IconSelector\"\n        hugeicons=\"UnfoldMoreIcon\"\n        phosphor=\"CaretUpDownIcon\"\n        remixicon=\"RiExpandUpDownLine\"\n        className=\"mt-px size-3.25\"\n        aria-hidden=\"true\"\n      />\n    ))\n\n  const hasControls =\n    props.tableLayout?.columnsMovable ||\n    (props.tableLayout?.columnsVisibility && visibility) ||\n    (props.tableLayout?.columnsPinnable && canPin) ||\n    filter\n\n  const menuItems = useMemo(() => {\n    const items: ReactNode[] = []\n    let hasPreviousSection = false\n\n    // Filter section\n    if (filter) {\n      items.push(\n        <DropdownMenuGroup key=\"group-filter\">\n          <DropdownMenuLabel key=\"filter\">{filter}</DropdownMenuLabel>\n        </DropdownMenuGroup>\n      )\n      hasPreviousSection = true\n    }\n\n    // Sort section\n    i
```

**File**: `public/r/styles/base-luma/data-grid-column-visibility.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-column-visibility","type":"registry:ui","title":"Data Grid Column Visibility","description":"","dependencies":["@tanstack/react-table"],"registryDependencies":["@reui/data-grid","dropdown-menu"],"files":[{"path":"data-grid-column-visibility.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport { ReactElement } from \"react\"\nimport { getColumnHeaderLabel } from \"@/components/reui/data-grid/data-grid\"\nimport { Table } from \"@tanstack/react-table\"\n\nimport {\n  DropdownMenu,\n  DropdownMenuCheckboxItem,\n  DropdownMenuContent,\n  DropdownMenuGroup,\n  DropdownMenuLabel,\n  DropdownMenuTrigger,\n} from \"@/components/ui/dropdown-menu\"\n\nfunction DataGridColumnVisibility<TData>({\n  table,\n  trigger,\n}: {\n  table: Table<TData>\n  trigger: ReactElement<Record<string, unknown>>\n}) {\n  return (\n    <DropdownMenu>\n      <DropdownMenuTrigger render={trigger} />\n      <DropdownMenuContent align=\"end\" className=\"min-w-[150px]\">\n        <DropdownMenuGroup>\n          <DropdownMenuLabel className=\"font-medium\">\n            Toggle Columns\n          </DropdownMenuLabel>\n          {table\n            .getAllColumns()\n            .filter((column) => column.getCanHide())\n            .map((column) => {\n              return (\n                <DropdownMenuCheckboxItem\n                  key={column.id}\n                  className=\"capitalize\"\n                  checked={column.getIsVisible()}\n                  onSelect={(event) => event.preventDefault()}\n                  onCheckedChange={(value) => column.toggleVisibility(!!value)}\n                >\n                  {getColumnHeaderLabel(column)}\n                </DropdownMenuCheckboxItem>\n              )\n            })}\n        </DropdownMenuGroup>\n      </DropdownMenuContent>\n    </DropdownMenu>\n  )\n}\n\nexport { DataGridColumnVisibility }","target":"components/reui/data-grid/data-grid-column-visibility.tsx"}]}
\ No newline at end of file
+{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-column-visibility","type":"registry:ui","title":"Data Grid Column Visibility","description":"","dependencies":["@tanstack/react-table"],"registryDependencies":["@reui/data-grid","dropdown-menu"],"files":[{"path":"data-grid-column-visibility.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport type { ReactElement } from \"react\"\nimport { getColumnHeaderLabel } from \"@/components/reui/data-grid/data-grid\"\nimport type { Table } from \"@tanstack/react-table\"\n\nimport {\n  DropdownMenu,\n  DropdownMenuCheckboxItem,\n  DropdownMenuContent,\n  DropdownMenuGroup,\n  DropdownMenuLabel,\n  DropdownMenuTrigger,\n} from \"@/components/ui/dropdown-menu\"\n\nfunction DataGridColumnVisibility<TData>({\n  table,\n  trigger,\n}: {\n  table: Table<TData>\n  trigger: ReactElement<Record<string, unknown>>\n}) {\n  return (\n    <DropdownMenu>\n      <DropdownMenuTrigger render={trigger} />\n      <DropdownMenuContent align=\"end\" className=\"min-w-[150px]\">\n        <DropdownMenuGroup>\n          <DropdownMenuLabel className=\"font-medium\">\n            Toggle Columns\n          </DropdownMenuLabel>\n          {table\n            .getAllColumns()\n            .filter((column) => column.getCanHide())\n            .map((column) => {\n              return (\n                <DropdownMenuCheckboxItem\n                  key={column.id}\n                  className=\"capitalize\"\n                  checked={column.getIsVisible()}\n                  onSelect={(event) => event.preventDefault()}\n                  onCheckedChange={(value) => column.toggleVisibility(!!value)}\n                >\n                  {getColumnHeaderLabel(column)}\n                </DropdownMenuCheckboxItem>\n              )\n            })}\n        </DropdownMenuGroup>\n      </DropdownMenuContent>\n    </DropdownMenu>\n  )\n}\n\nexport { DataGridColumnVisibility }","target":"components/reui/data-grid/data-grid-column-visibility.tsx"}]}
\ No newline at end of file
```

**File**: `public/r/styles/base-luma/data-grid-pagination.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-pagination","type":"registry:ui","title":"Data Grid Pagination","description":"","dependencies":[],"registryDependencies":["button","@reui/data-grid","select","skeleton"],"files":[{"path":"data-grid-pagination.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport React, { ReactNode } from \"react\"\nimport { useDataGrid } from \"@/components/reui/data-grid/data-grid\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Button } from \"@/components/ui/button\"\nimport {\n  Select,\n  SelectContent,\n  SelectItem,\n  SelectTrigger,\n  SelectValue,\n} from \"@/components/ui/select\"\nimport { Skeleton } from \"@/components/ui/skeleton\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\ninterface DataGridPaginationProps {\n  sizes?: number[]\n  sizesInfo?: string\n  sizesLabel?: string\n  sizesDescription?: string\n  sizesSkeleton?: ReactNode\n  more?: boolean\n  moreLimit?: number\n  info?: string\n  infoSkeleton?: ReactNode\n  className?: string\n  rowsPerPageLabel?: string\n  previousPageLabel?: string\n  nextPageLabel?: string\n  ellipsisText?: string\n}\n\nfunction DataGridPagination(props: DataGridPaginationProps): React.JSX.Element {\n  const { table, recordCount, isLoading } = useDataGrid()\n\n  const defaultProps: Partial<DataGridPaginationProps> = {\n    sizes: [5, 10, 25, 50, 100],\n    sizesSkeleton: <Skeleton className=\"h-8 w-44\" />,\n    moreLimit: 5,\n    info: \"{from} - {to} of {count}\",\n    infoSkeleton: <Skeleton className=\"h-8 w-60\" />,\n    rowsPerPageLabel: \"Rows per page\",\n    previousPageLabel: \"Go to previous page\",\n    nextPageLabel: \"Go to next page\",\n    ellipsisText: \"...\",\n  }\n\n  const mergedProps: DataGridPaginationProps = { ...defaultProps, ...props }\n\n  const btnBaseClasses = \"p-0 text-sm\"\n  const btnArrowClasses = btnBaseClasses + \" rtl:transform rtl:rotate-180\"\n  const pageIndex = table.getState().pagination.pageIndex\n  const pageSize = table.getState().pagination.pageSize\n  const from = recordCount === 0 ? 0 : pageIndex * pageSize + 1\n  const to = Math.min((pageIndex + 1) * pageSize, recordCount)\n  const pageCount = table.getPageCount()\n\n  // Replace placeholders in paginationInfo\n  const paginationInfo = mergedProps.info\n    ? mergedProps.info\n        .replaceAll(\"{from}\", from.toString())\n        .replaceAll(\"{to}\", to.toString())\n        .replaceAll(\"{count}\", recordCount.toString())\n    : `${from} - ${to} of ${recordCount}`\n\n  // Pagination limit logic\n  const paginationMoreLimit = mergedProps.moreLimit || 5\n\n  // Determine the start and end of the pagination group\n  const currentGroupStart =\n    Math.floor(pageIndex / paginationMoreLimit) * paginationMoreLimit\n  const currentGroupEnd = Math.min(\n    currentGroupStart + paginationMoreLimit,\n    pageCount\n  )\n\n  // Render page buttons based on the current group\n  const renderPageButtons = () => {\n    const buttons = []\n    for (let i = currentGroupStart; i < currentGroupEnd; i++) {\n      buttons.push(\n        <Button\n          key={i}\n          size=\"icon-sm\"\n          variant=\"ghost\"\n          className={cn(btnBaseClasses, \"text-muted-foreground\", {\n            \"bg-accent text-accent-foreground\": pageIndex === i,\n          })}\n          onClick={() => {\n            if (pageIndex !== i) {\n              table.setPageIndex(i)\n            }\n          }}\n        >\n          {i + 1}\n        </Button>\n      )\n    }\n    return buttons\n  }\n\n  // Render a \"previous\" ellipsis button if there are previous pages to show\n  const renderEllipsisPrevButton = () => {\n    if (currentGroupStart > 0) {\n      return (\n        <Button\n          size=\"icon-sm\"\n          className={btnBaseClasses}\n          variant=\"ghost\"\n          onClick={() => table.setPageIndex(currentGroupStart - 1)}\n        >\n          {mergedProps.ellipsisText}\n        </Button>\n      )\n    }\n    return null\n  }\n\n  // Render a \"next\" ellipsis button if there are more pages to show after the current group\n  const renderEllipsisNextButton = () => {\n    if (currentGroupEnd < pageCount) {\n      return (\n        <Button\n          className={btnBaseClasses}\n          variant=\"ghost\"\n          size=\"icon-sm\"\n          onClick={() => table.setPageIndex(currentGroupEnd)}\n        >\n          {mergedProps.ellipsisText}\n        </Button>\n      )\n    }\n    return null\n  }\n\n  return (\n    <div\n      data-slot=\"data-grid-pagination\"\n      className={cn(\n        \"flex grow flex-col flex-wrap items-center justify-between gap-2.5 py-2.5 sm:flex-row sm:py-0\",\n        mergedProps.className\n      )}\n    >\n      <div className=\"order-2 flex flex-wrap items-center space-x-2.5 pb-2.5 sm:order-1 sm:pb-0\">\n        {isLoading ? (\n          mergedProps.sizesSkeleton\n        ) : (\n          <>\n         
```

**File**: `public/r/styles/base-luma/data-grid-scroll-area.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-scroll-area","type":"registry:ui","title":"Data Grid Scroll Area","description":"","dependencies":["@base-ui/react"],"registryDependencies":["@reui/data-grid"],"files":[{"path":"data-grid-scroll-area.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport {\n  PointerEvent,\n  ReactNode,\n  useCallback,\n  useEffect,\n  useRef,\n  useState,\n} from \"react\"\nimport { useDataGrid } from \"@/components/reui/data-grid/data-grid\"\nimport { ScrollArea as ScrollAreaPrimitive } from \"@base-ui/react/scroll-area\"\n\nimport { cn } from \"@/lib/utils\"\n\nconst MIN_THUMB_SIZE = 24\nconst FALLBACK_SCROLLBAR_SIZE = 12\n\nconst INITIAL_METRICS = {\n  hasVerticalOverflow: false,\n  headerHeight: 0,\n  horizontalScrollbarSize: 0,\n  thumbHeight: 0,\n  thumbTop: 0,\n  trackHeight: 0,\n} as const\n\nconst SCROLLBAR_CLASSNAME =\n  \"flex touch-none p-px transition-colors select-none data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:border-t data-[orientation=horizontal]:border-t-transparent data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2 data-[orientation=vertical]:border-s data-[orientation=vertical]:border-s-transparent\"\n\nconst SCROLLBAR_THUMB_CLASSNAME = \"bg-border rounded-full relative flex-1\"\n\ntype DataGridScrollAreaOrientation = \"horizontal\" | \"vertical\" | \"both\"\n\ntype ScrollbarMetrics = {\n  hasVerticalOverflow: boolean\n  headerHeight: number\n  horizontalScrollbarSize: number\n  thumbHeight: number\n  thumbTop: number\n  trackHeight: number\n}\n\ntype ObservedElements = {\n  header: HTMLElement | null\n  horizontalScrollbar: HTMLElement | null\n  table: HTMLElement | null\n  tableViewport: HTMLElement | null\n}\n\ntype DataGridScrollAreaProps = Omit<\n  ScrollAreaPrimitive.Root.Props,\n  \"children\"\n> & {\n  children: ReactNode\n  orientation?: DataGridScrollAreaOrientation\n}\n\nfunction clamp(value: number, min: number, max: number) {\n  return Math.min(max, Math.max(min, value))\n}\n\nfunction areMetricsEqual(next: ScrollbarMetrics, prev: ScrollbarMetrics) {\n  return (\n    next.hasVerticalOverflow === prev.hasVerticalOverflow &&\n    next.headerHeight === prev.headerHeight &&\n    next.horizontalScrollbarSize === prev.horizontalScrollbarSize &&\n    next.thumbHeight === prev.thumbHeight &&\n    next.thumbTop === prev.thumbTop &&\n    next.trackHeight === prev.trackHeight\n  )\n}\n\nfunction applyMetrics(element: HTMLElement, metrics: ScrollbarMetrics) {\n  element.style.setProperty(\n    \"--data-grid-scrollbar-header-height\",\n    `${metrics.headerHeight}px`\n  )\n  element.style.setProperty(\n    \"--data-grid-scrollbar-thumb-height\",\n    `${metrics.thumbHeight}px`\n  )\n  element.style.setProperty(\n    \"--data-grid-scrollbar-thumb-top\",\n    `${metrics.thumbTop}px`\n  )\n  element.style.setProperty(\n    \"--data-grid-scrollbar-track-height\",\n    `${metrics.trackHeight}px`\n  )\n}\n\nfunction DataGridScrollArea({\n  children,\n  className,\n  orientation = \"both\",\n  ...props\n}: DataGridScrollAreaProps) {\n  const { props: dataGridProps, table } = useDataGrid()\n  const containerRef = useRef<HTMLDivElement>(null)\n  const viewportRef = useRef<HTMLDivElement | null>(null)\n  const dragRef = useRef<{\n    pointerId: number\n    startScrollTop: number\n    startY: number\n  } | null>(null)\n  const metricsRef = useRef<ScrollbarMetrics>(INITIAL_METRICS)\n  const observedElementsRef = useRef<ObservedElements>({\n    header: null,\n    horizontalScrollbar: null,\n    table: null,\n    tableViewport: null,\n  })\n\n  const showHorizontal = orientation !== \"vertical\"\n  const showVertical = orientation !== \"horizontal\"\n  const usesCustomVerticalScrollbar =\n    showVertical && !!dataGridProps.tableLayout?.headerSticky\n  // Pinned columns are sticky and never scroll, so the horizontal scrollbar\n  // track is inset to span only the scrollable center region between them.\n  const isColumnsPinnable = !!dataGridProps.tableLayout?.columnsPinnable\n  const scrollbarInsetStart = isColumnsPinnable ? table.getLeftTotalSize() : 0\n  const scrollbarInsetEnd = isColumnsPinnable ? table.getRightTotalSize() : 0\n  const [hasCustomVerticalOverflow, setHasCustomVerticalOverflow] =\n    useState(false)\n\n  const clearDragState = useCallback(() => {\n    dragRef.current = null\n    document.body.style.userSelect = \"\"\n    document.body.style.webkitUserSelect = \"\"\n  }, [])\n\n  const resetMetrics = useCallback(() => {\n    const container = containerRef.current\n\n    if (container && !areMetricsEqual(INITIAL_METRICS, metricsRef.current)) {\n      applyMetrics(container, INITIAL_METRICS)\n      metricsRef.current = INITIAL_METRICS\n    }\n\n    setHasCustomVerticalOverflow((prev) => (prev ? false : prev))\n  }, [])\n\n  const syncCustomVerticalScrollbar = useCallback(() => {\n    const container = container
```

**File**: `public/r/styles/base-luma/data-grid-table-dnd-rows.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-table-dnd-rows","type":"registry:ui","title":"Data Grid Table Dnd Rows","description":"","dependencies":["@dnd-kit/core","@dnd-kit/modifiers","@dnd-kit/sortable","@dnd-kit/utilities","@tanstack/react-table"],"registryDependencies":["button","@reui/data-grid","@reui/data-grid-table"],"files":[{"path":"data-grid-table-dnd-rows.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport {\n  createContext,\n  CSSProperties,\n  memo,\n  ReactNode,\n  useContext,\n  useEffect,\n  useId,\n  useMemo,\n  useRef,\n  useState,\n} from \"react\"\nimport { useDataGrid } from \"@/components/reui/data-grid/data-grid\"\nimport {\n  DataGridTableBase,\n  DataGridTableBody,\n  DataGridTableBodyRow,\n  DataGridTableBodyRowCell,\n  DataGridTableBodyRowExpandded,\n  DataGridTableBodyRowSkeleton,\n  DataGridTableBodyRowSkeletonCell,\n  DataGridTableEmpty,\n  DataGridTableFillBodyCell,\n  DataGridTableFillHeadCell,\n  DataGridTableFoot,\n  DataGridTableHead,\n  DataGridTableHeadRow,\n  DataGridTableHeadRowCell,\n  DataGridTableHeadRowCellResize,\n  DataGridTableRowSpacer,\n  DataGridTableViewport,\n} from \"@/components/reui/data-grid/data-grid-table\"\nimport {\n  closestCenter,\n  DndContext,\n  KeyboardSensor,\n  MouseSensor,\n  TouchSensor,\n  UniqueIdentifier,\n  useSensor,\n  useSensors,\n  type DragEndEvent,\n  type Modifier,\n} from \"@dnd-kit/core\"\nimport { restrictToVerticalAxis } from \"@dnd-kit/modifiers\"\nimport {\n  SortableContext,\n  sortableKeyboardCoordinates,\n  useSortable,\n  verticalListSortingStrategy,\n} from \"@dnd-kit/sortable\"\nimport { CSS } from \"@dnd-kit/utilities\"\nimport {\n  Cell,\n  flexRender,\n  HeaderGroup,\n  Row,\n  Table,\n} from \"@tanstack/react-table\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Button } from \"@/components/ui/button\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\n// Context to share sortable listeners from row to handle\ntype SortableContextValue = ReturnType<typeof useSortable>\nconst SortableRowContext = createContext<Pick<\n  SortableContextValue,\n  \"attributes\" | \"listeners\"\n> | null>(null)\n\nfunction DataGridTableDndRowHandle({ className }: { className?: string }) {\n  const context = useContext(SortableRowContext)\n\n  if (!context) {\n    // Fallback if context is not available (shouldn't happen in normal usage)\n    return (\n      <Button\n        variant=\"ghost\"\n        size=\"icon-sm\"\n        className={cn(\n          \"size-7 cursor-grab opacity-70 hover:bg-transparent hover:opacity-100 active:cursor-grabbing\",\n          className\n        )}\n        aria-label=\"Drag to reorder row\"\n        disabled\n      >\n        <IconPlaceholder\n          lucide=\"GripHorizontalIcon\"\n          tabler=\"IconGripHorizontal\"\n          hugeicons=\"DragDropHorizontalIcon\"\n          phosphor=\"DotsSixIcon\"\n          remixicon=\"RiDraggable\"\n          aria-hidden=\"true\"\n        />\n      </Button>\n    )\n  }\n\n  return (\n    <Button\n      variant=\"ghost\"\n      size=\"icon-sm\"\n      className={cn(\n        \"size-7 cursor-grab opacity-70 hover:bg-transparent hover:opacity-100 active:cursor-grabbing\",\n        className\n      )}\n      aria-label=\"Drag to reorder row\"\n      {...context.attributes}\n      {...context.listeners}\n    >\n      <IconPlaceholder\n        lucide=\"GripHorizontalIcon\"\n        tabler=\"IconGripHorizontal\"\n        hugeicons=\"DragDropHorizontalIcon\"\n        phosphor=\"DotsSixIcon\"\n        remixicon=\"RiDraggable\"\n        aria-hidden=\"true\"\n      />\n    </Button>\n  )\n}\n\nfunction DataGridTableDndRow<TData>({ row }: { row: Row<TData> }) {\n  const {\n    transform,\n    transition,\n    setNodeRef,\n    isDragging,\n    attributes,\n    listeners,\n  } = useSortable({\n    id: row.id,\n  })\n\n  const style: CSSProperties = {\n    transform: CSS.Transform.toString(transform),\n    transition: transition,\n    opacity: isDragging ? 0.8 : 1,\n    zIndex: isDragging ? 1 : 0,\n    position: \"relative\",\n    cursor: isDragging ? \"grabbing\" : undefined,\n  }\n\n  return (\n    <SortableRowContext.Provider value={{ attributes, listeners }}>\n      <DataGridTableBodyRow row={row} dndRef={setNodeRef} dndStyle={style}>\n        {row.getVisibleCells().map((cell: Cell<TData, unknown>) => {\n          return (\n            <DataGridTableBodyRowCell cell={cell} key={cell.id}>\n              {flexRender(cell.column.columnDef.cell, cell.getContext())}\n            </DataGridTableBodyRowCell>\n          )\n        })}\n        <DataGridTableFillBodyCell />\n      </DataGridTableBodyRow>\n      {row.getIsExpanded() && <DataGridTableBodyRowExpandded row={row} />}\n    </SortableRowContext.Provider>\n  )\n}\n\nfunction DataGridTableDndRowsBody<TData>({\n  table,\n  dataIds,\n}: {\n  table: Table<TData>\n  dataIds: UniqueIdentifier[]\n}) {\n  const { isLo
```

**File**: `public/r/styles/base-luma/data-grid-table-dnd.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-table-dnd","type":"registry:ui","title":"Data Grid Table Dnd","description":"","dependencies":["@dnd-kit/core","@dnd-kit/sortable","@dnd-kit/utilities","@tanstack/react-table"],"registryDependencies":["button","@reui/data-grid","@reui/data-grid-table"],"files":[{"path":"data-grid-table-dnd.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport {\n  CSSProperties,\n  Fragment,\n  memo,\n  ReactNode,\n  useEffect,\n  useId,\n  useMemo,\n  useRef,\n  useState,\n} from \"react\"\nimport { useDataGrid } from \"@/components/reui/data-grid/data-grid\"\nimport {\n  DataGridTableBase,\n  DataGridTableBody,\n  DataGridTableBodyRow,\n  DataGridTableBodyRowCell,\n  DataGridTableBodyRowExpandded,\n  DataGridTableBodyRowSkeleton,\n  DataGridTableBodyRowSkeletonCell,\n  DataGridTableEmpty,\n  DataGridTableFillBodyCell,\n  DataGridTableFillHeadCell,\n  DataGridTableFoot,\n  DataGridTableHead,\n  DataGridTableHeadRow,\n  DataGridTableHeadRowCell,\n  DataGridTableHeadRowCellResize,\n  DataGridTableRowSpacer,\n  DataGridTableViewport,\n} from \"@/components/reui/data-grid/data-grid-table\"\nimport {\n  closestCenter,\n  DndContext,\n  KeyboardSensor,\n  Modifier,\n  MouseSensor,\n  TouchSensor,\n  useSensor,\n  useSensors,\n  type DragEndEvent,\n} from \"@dnd-kit/core\"\nimport {\n  horizontalListSortingStrategy,\n  SortableContext,\n  sortableKeyboardCoordinates,\n  useSortable,\n} from \"@dnd-kit/sortable\"\nimport { CSS } from \"@dnd-kit/utilities\"\nimport {\n  Cell,\n  flexRender,\n  Header,\n  HeaderGroup,\n  Row,\n  Table,\n} from \"@tanstack/react-table\"\n\nimport { Button } from \"@/components/ui/button\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nfunction DataGridTableDndHeader<TData>({\n  header,\n}: {\n  header: Header<TData, unknown>\n}) {\n  const { props } = useDataGrid()\n  const { column } = header\n\n  // Check if column ordering is enabled for this column\n  const canOrder =\n    (column.columnDef as { enableColumnOrdering?: boolean })\n      .enableColumnOrdering !== false\n\n  const {\n    attributes,\n    isDragging,\n    listeners,\n    setNodeRef,\n    transform,\n    transition,\n  } = useSortable({\n    id: header.column.id,\n  })\n\n  const style: CSSProperties = {\n    opacity: isDragging ? 0.8 : 1,\n    position: \"relative\",\n    transform: CSS.Translate.toString(transform),\n    transition,\n    cursor: isDragging ? \"grabbing\" : undefined,\n    whiteSpace: \"nowrap\",\n    width: props.tableLayout?.columnsResizable\n      ? `calc(var(--header-${header.id}-size) * 1px)`\n      : header.column.getSize(),\n    zIndex: isDragging ? 1 : 0,\n  }\n\n  return (\n    <DataGridTableHeadRowCell\n      header={header}\n      dndStyle={style}\n      dndRef={setNodeRef}\n    >\n      <div className=\"flex items-center justify-start gap-0.5\">\n        {canOrder && (\n          <Button\n            size=\"icon-sm\"\n            variant=\"ghost\"\n            className={`-ms-2 size-6 ${isDragging ? \"cursor-grabbing\" : \"cursor-grab active:cursor-grabbing\"}`}\n            {...attributes}\n            {...listeners}\n            aria-label=\"Drag to reorder\"\n          >\n            <IconPlaceholder\n              lucide=\"GripVerticalIcon\"\n              tabler=\"IconGripVertical\"\n              hugeicons=\"DragDropVerticalIcon\"\n              phosphor=\"DotsSixVerticalIcon\"\n              remixicon=\"RiDraggable\"\n              className=\"opacity-60 hover:opacity-100\"\n              aria-hidden=\"true\"\n            />\n          </Button>\n        )}\n        <div className=\"grow\">\n          {header.isPlaceholder\n            ? null\n            : flexRender(header.column.columnDef.header, header.getContext())}\n        </div>\n        {props.tableLayout?.columnsResizable && column.getCanResize() && (\n          <DataGridTableHeadRowCellResize header={header} />\n        )}\n      </div>\n    </DataGridTableHeadRowCell>\n  )\n}\n\nfunction DataGridTableDndCell<TData>({ cell }: { cell: Cell<TData, unknown> }) {\n  const { props } = useDataGrid()\n  const { isDragging, setNodeRef, transform, transition } = useSortable({\n    id: cell.column.id,\n  })\n\n  const style: CSSProperties = {\n    opacity: isDragging ? 0.8 : 1,\n    position: \"relative\",\n    transform: CSS.Translate.toString(transform),\n    transition,\n    cursor: isDragging ? \"grabbing\" : undefined,\n    width: props.tableLayout?.columnsResizable\n      ? `calc(var(--col-${cell.column.id}-size) * 1px)`\n      : cell.column.getSize(),\n    zIndex: isDragging ? 1 : 0,\n  }\n\n  return (\n    <DataGridTableBodyRowCell cell={cell} dndStyle={style} dndRef={setNodeRef}>\n      {flexRender(cell.column.columnDef.cell, cell.getContext())}\n    </DataGridTableBodyRowCell>\n  )\n}\n\nfunction DataGridTableDndBodyRows<TData>({ table }: { table: Table<TData> }) {\n  const { isLoading, 
```

**File**: `public/r/styles/base-luma/data-grid-table-virtual.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"data-grid-table-virtual","type":"registry:ui","title":"Data Grid Table Virtual","description":"","dependencies":["@tanstack/react-table","@tanstack/react-virtual"],"registryDependencies":["@reui/data-grid","@reui/data-grid-table","spinner"],"files":[{"path":"data-grid-table-virtual.tsx","type":"registry:ui","content":"\"use client\"\n\"use no memo\"\n\nimport {\n  CSSProperties,\n  memo,\n  ReactNode,\n  useCallback,\n  useEffect,\n  useRef,\n  useState,\n} from \"react\"\nimport { useDataGrid } from \"@/components/reui/data-grid/data-grid\"\nimport {\n  DataGridTableBase,\n  DataGridTableBody,\n  DataGridTableEmpty,\n  DataGridTableFillBodyCell,\n  DataGridTableFillHeadCell,\n  DataGridTableFoot,\n  DataGridTableHead,\n  DataGridTableHeadRow,\n  DataGridTableHeadRowCell,\n  DataGridTableHeadRowCellResize,\n  DataGridTableRenderedRow,\n  DataGridTableRowSpacer,\n  DataGridTableViewport,\n  getDataGridScrollAreaViewport,\n  getDataGridTableMergedHeaderGroups,\n  getDataGridTableRowSections,\n  getPinningStyles,\n  hasDataGridTableRightPinnedColumns,\n} from \"@/components/reui/data-grid/data-grid-table\"\nimport { Column, flexRender, Row, Table } from \"@tanstack/react-table\"\nimport {\n  useVirtualizer,\n  VirtualItem,\n  Virtualizer,\n  VirtualizerOptions,\n} from \"@tanstack/react-virtual\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Spinner } from \"@/components/ui/spinner\"\n\ntype DataGridTableVirtualScrollElements = {\n  containerElement: HTMLDivElement | null\n  scrollElement: HTMLElement | null\n}\n\ntype DataGridTableVirtualizerInstance = Virtualizer<\n  HTMLElement,\n  HTMLTableRowElement\n>\n\ntype DataGridTableVirtualizerOptions<TData> = Omit<\n  VirtualizerOptions<HTMLElement, HTMLTableRowElement>,\n  \"count\" | \"estimateSize\" | \"getItemKey\" | \"getScrollElement\"\n> & {\n  estimateSize?: (index: number, row: Row<TData>) => number\n  getItemKey?: (index: number, row: Row<TData>) => string | number\n  getScrollElement?: (\n    elements: DataGridTableVirtualScrollElements\n  ) => HTMLElement | null\n}\n\ninterface DataGridTableVirtualProps<TData> {\n  height?: number | string\n  estimateSize?: number\n  overscan?: number\n  footerContent?: ReactNode\n  renderHeader?: boolean\n  onFetchMore?: () => void\n  isFetchingMore?: boolean\n  hasMore?: boolean\n  fetchMoreOffset?: number\n  virtualizerOptions?: DataGridTableVirtualizerOptions<TData>\n}\n\ninterface VirtualBodyProps<TData> {\n  table: Table<TData>\n  topRows: Row<TData>[]\n  centerRows: Row<TData>[]\n  bottomRows: Row<TData>[]\n  virtualItems: VirtualItem[]\n  totalSize: number\n  isVirtualizationEnabled: boolean\n  isInfiniteMode: boolean\n  isFetchingMore: boolean\n  hasMore?: boolean\n  loadingMoreMessage: ReactNode\n  allRowsLoadedMessage: ReactNode\n  measureRowRef?: (element: HTMLTableRowElement | null) => void\n}\n\nfunction DataGridTableVirtualPinnedPlaceholderCell<TData>({\n  column,\n}: {\n  column: Column<TData>\n}) {\n  const { props } = useDataGrid()\n  const isPinned = column.getIsPinned()\n  const isLastLeftPinned = isPinned === \"left\" && column.getIsLastColumn(\"left\")\n  const isFirstRightPinned =\n    isPinned === \"right\" && column.getIsFirstColumn(\"right\")\n\n  return (\n    <td\n      aria-hidden=\"true\"\n      style={{\n        ...(props.tableLayout?.columnsPinnable &&\n          column.getCanPin() &&\n          getPinningStyles(column)),\n        ...(props.tableLayout?.columnsResizable && {\n          width: `calc(var(--col-${column.id}-size) * 1px)`,\n        }),\n      }}\n      data-pinned={isPinned || undefined}\n      data-last-col={\n        isLastLeftPinned ? \"left\" : isFirstRightPinned ? \"right\" : undefined\n      }\n      className={cn(\n        \"p-0\",\n        props.tableLayout?.cellBorder && \"border-e\",\n        props.tableLayout?.columnsPinnable &&\n          column.getCanPin() &&\n          \"data-pinned:bg-background data-pinned:isolate [&[data-pinned=left][data-last-col=left]]:shadow-[inset_-1px_0_0_0_var(--border)] [&[data-pinned=right][data-last-col=right]]:shadow-[inset_1px_0_0_0_var(--border)]\"\n      )}\n    />\n  )\n}\n\nfunction DataGridTableVirtualUtilityRow<TData>({\n  table,\n  children,\n  centerCellClassName,\n  centerCellStyle,\n  rowClassName,\n  ariaHidden,\n}: {\n  table: Table<TData>\n  children: ReactNode\n  centerCellClassName?: string\n  centerCellStyle?: CSSProperties\n  rowClassName?: string\n  ariaHidden?: boolean\n}) {\n  const { props } = useDataGrid()\n  const leftVisibleColumns = table.getLeftVisibleLeafColumns()\n  const centerVisibleColumns = table.getCenterVisibleLeafColumns()\n  const rightVisibleColumns = table.getRightVisibleLeafColumns()\n  const hasRightPinnedColumns = hasDataGridTableRightPinnedColumns(table)\n\n  return (\n    <tr aria-hidden={ariaHidden || undefined} className={rowClassName}>\n      {leftVisibleColumns.map((column) => (\n        <DataGridTable
```

---

### Incident Patch 4: `93612c95` (2026-07-24)
**Commit Message**: Merge pull request #99 from focus0802/codex/input-otp-mask-render-example

Add masked Input OTP render example

**File**: `public/r/styles/base-nova/c-input-otp-7.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"c-input-otp-7","type":"registry:block","title":"Masked OTP input with render function.","description":"Masked OTP input with render function.","dependencies":["input-otp"],"registryDependencies":["field","input-otp"],"files":[{"path":"c-input-otp-7.tsx","type":"registry:block","content":"\"use client\"\n\nimport type { SlotProps } from \"input-otp\"\n\nimport {\n  Field,\n  FieldDescription,\n  FieldLabel,\n} from \"@/components/ui/field\"\nimport {\n  InputOTP,\n  InputOTPGroup,\n  InputOTPSeparator,\n} from \"@/components/ui/input-otp\"\nimport { cn } from \"@/lib/utils\"\n\nfunction MaskedInputOTPSlot({\n  char,\n  hasFakeCaret,\n  isActive,\n}: SlotProps) {\n  return (\n    <div\n      aria-hidden=\"true\"\n      data-active={isActive}\n      data-slot=\"input-otp-slot\"\n      className={cn(\n        \"cn-input-otp-slot relative flex items-center justify-center data-[active=true]:z-10\"\n      )}\n    >\n      {char ? \"•\" : null}\n      {hasFakeCaret && (\n        <div className=\"cn-input-otp-caret pointer-events-none absolute inset-0 flex items-center justify-center\">\n          <div className=\"cn-input-otp-caret-line\" />\n        </div>\n      )}\n    </div>\n  )\n}\n\nexport function Pattern() {\n  return (\n    <div className=\"flex items-center justify-center\">\n      <Field>\n        <FieldLabel htmlFor=\"masked-render\">Masked OTP</FieldLabel>\n        <FieldDescription>\n          Use the render function to obscure filled slots.\n        </FieldDescription>\n        <InputOTP\n          id=\"masked-render\"\n          maxLength={6}\n          render={({ slots }) => (\n            <>\n              <InputOTPGroup>\n                {slots.slice(0, 3).map((slot, index) => (\n                  <MaskedInputOTPSlot key={index} {...slot} />\n                ))}\n              </InputOTPGroup>\n              <InputOTPSeparator />\n              <InputOTPGroup>\n                {slots.slice(3).map((slot, index) => (\n                  <MaskedInputOTPSlot key={index + 3} {...slot} />\n                ))}\n              </InputOTPGroup>\n            </>\n          )}\n        />\n      </Field>\n    </div>\n  )\n}","target":"components/examples/c-input-otp-7.tsx"}],"meta":{"order":7}}
\ No newline at end of file
```

**File**: `public/r/styles/base-nova/registry.json` (modified, +23/-0)
```diff
@@ -18977,6 +18977,29 @@
         "order": 6
       }
     },
+    {
+      "name": "c-input-otp-7",
+      "type": "registry:block",
+      "title": "Masked OTP input with render function.",
+      "description": "Masked OTP input with render function.",
+      "dependencies": [
+        "input-otp"
+      ],
+      "registryDependencies": [
+        "field",
+        "input-otp"
+      ],
+      "files": [
+        {
+          "path": "c-input-otp-7.tsx",
+          "type": "registry:block",
+          "target": "components/examples/c-input-otp-7.tsx"
+        }
+      ],
+      "meta": {
+        "order": 7
+      }
+    },
     {
       "name": "c-item-1",
       "type": "registry:block",
```

**File**: `public/r/styles/radix-nova/c-input-otp-7.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"c-input-otp-7","type":"registry:block","title":"Masked OTP input with render function.","description":"Masked OTP input with render function.","dependencies":["input-otp"],"registryDependencies":["field","input-otp"],"files":[{"path":"c-input-otp-7.tsx","type":"registry:block","content":"\"use client\"\n\nimport type { SlotProps } from \"input-otp\"\n\nimport {\n  Field,\n  FieldDescription,\n  FieldLabel,\n} from \"@/components/ui/field\"\nimport {\n  InputOTP,\n  InputOTPGroup,\n  InputOTPSeparator,\n} from \"@/components/ui/input-otp\"\nimport { cn } from \"@/lib/utils\"\n\nfunction MaskedInputOTPSlot({\n  char,\n  hasFakeCaret,\n  isActive,\n}: SlotProps) {\n  return (\n    <div\n      aria-hidden=\"true\"\n      data-active={isActive}\n      data-slot=\"input-otp-slot\"\n      className={cn(\n        \"cn-input-otp-slot relative flex items-center justify-center data-[active=true]:z-10\"\n      )}\n    >\n      {char ? \"•\" : null}\n      {hasFakeCaret && (\n        <div className=\"cn-input-otp-caret pointer-events-none absolute inset-0 flex items-center justify-center\">\n          <div className=\"cn-input-otp-caret-line\" />\n        </div>\n      )}\n    </div>\n  )\n}\n\nexport function Pattern() {\n  return (\n    <div className=\"flex items-center justify-center\">\n      <Field>\n        <FieldLabel htmlFor=\"masked-render\">Masked OTP</FieldLabel>\n        <FieldDescription>\n          Use the render function to obscure filled slots.\n        </FieldDescription>\n        <InputOTP\n          id=\"masked-render\"\n          maxLength={6}\n          render={({ slots }) => (\n            <>\n              <InputOTPGroup>\n                {slots.slice(0, 3).map((slot, index) => (\n                  <MaskedInputOTPSlot key={index} {...slot} />\n                ))}\n              </InputOTPGroup>\n              <InputOTPSeparator />\n              <InputOTPGroup>\n                {slots.slice(3).map((slot, index) => (\n                  <MaskedInputOTPSlot key={index + 3} {...slot} />\n                ))}\n              </InputOTPGroup>\n            </>\n          )}\n        />\n      </Field>\n    </div>\n  )\n}","target":"components/examples/c-input-otp-7.tsx"}],"meta":{"order":7}}
\ No newline at end of file
```

**File**: `public/r/styles/radix-nova/registry.json` (modified, +23/-0)
```diff
@@ -18968,6 +18968,29 @@
         "order": 6
       }
     },
+    {
+      "name": "c-input-otp-7",
+      "type": "registry:block",
+      "title": "Masked OTP input with render function.",
+      "description": "Masked OTP input with render function.",
+      "dependencies": [
+        "input-otp"
+      ],
+      "registryDependencies": [
+        "field",
+        "input-otp"
+      ],
+      "files": [
+        {
+          "path": "c-input-otp-7.tsx",
+          "type": "registry:block",
+          "target": "components/examples/c-input-otp-7.tsx"
+        }
+      ],
+      "meta": {
+        "order": 7
+      }
+    },
     {
       "name": "c-item-1",
       "type": "registry:block",
```

**File**: `registry-reui/_meta/components/bases/base/input-otp.json` (modified, +26/-0)
```diff
@@ -151,6 +151,32 @@
       "meta": {
         "order": 6
       }
+    },
+    {
+      "name": "c-input-otp-7",
+      "type": "registry:block",
+      "title": "Masked OTP input with render function.",
+      "categories": [
+        "input-otp"
+      ],
+      "description": "Masked OTP input with render function.",
+      "registryDependencies": [
+        "field",
+        "input-otp"
+      ],
+      "dependencies": [
+        "input-otp"
+      ],
+      "files": [
+        {
+          "path": "components/input-otp/c-input-otp-7.tsx",
+          "type": "registry:block",
+          "target": "components/examples/c-input-otp-7.tsx"
+        }
+      ],
+      "meta": {
+        "order": 7
+      }
     }
   ]
 }
```

**File**: `registry-reui/_meta/components/bases/base/name-index.json` (modified, +1/-0)
```diff
@@ -658,6 +658,7 @@
   "c-input-otp-4": "input-otp",
   "c-input-otp-5": "input-otp",
   "c-input-otp-6": "input-otp",
+  "c-input-otp-7": "input-otp",
   "c-item-1": "item",
   "c-item-2": "item",
   "c-item-3": "item",
```

**File**: `registry-reui/_meta/components/bases/radix/input-otp.json` (modified, +26/-0)
```diff
@@ -151,6 +151,32 @@
       "meta": {
         "order": 6
       }
+    },
+    {
+      "name": "c-input-otp-7",
+      "type": "registry:block",
+      "title": "Masked OTP input with render function.",
+      "categories": [
+        "input-otp"
+      ],
+      "description": "Masked OTP input with render function.",
+      "registryDependencies": [
+        "field",
+        "input-otp"
+      ],
+      "dependencies": [
+        "input-otp"
+      ],
+      "files": [
+        {
+          "path": "components/input-otp/c-input-otp-7.tsx",
+          "type": "registry:block",
+          "target": "components/examples/c-input-otp-7.tsx"
+        }
+      ],
+      "meta": {
+        "order": 7
+      }
     }
   ]
 }
```

**File**: `registry-reui/_meta/components/bases/radix/name-index.json` (modified, +1/-0)
```diff
@@ -658,6 +658,7 @@
   "c-input-otp-4": "input-otp",
   "c-input-otp-5": "input-otp",
   "c-input-otp-6": "input-otp",
+  "c-input-otp-7": "input-otp",
   "c-item-1": "item",
   "c-item-2": "item",
   "c-item-3": "item",
```

---

### Incident Patch 5: `69bb3127` (2026-07-24)
**Commit Message**: Merge branch 'main' into codex/input-otp-mask-render-example

**File**: `README.md` (modified, +69/-63)
```diff
@@ -18,21 +18,21 @@
 
 ## About ReUI
 
-ReUI is a free, open-source component library for the [shadcn/ui](https://ui.shadcn.com/) ecosystem. Explore 1,000+ production-ready components across 68 categories, each shown inside realistic dashboard layouts—not isolated demos—and copy them directly into your React projects.
+ReUI is a free, open-source component library for the [shadcn/ui](https://ui.shadcn.com/) ecosystem. Explore 1,000+ production-ready components across 71 categories, each shown inside realistic dashboard layouts—not isolated demos—and copy them directly into your React projects.
 
 ### Why ReUI?
 
-- **17 In-House component primitives not in default shadcn/ui** — Data Grid, Kanban, Filters, Sortable, Timeline, Stepper, Tree, and more, built for real-world dashboard requirements
+- **19 In-House component primitives not in default shadcn/ui** — Data Grid, Event Calendar, Gantt, Kanban, Filters, Sortable, Timeline, Stepper, Tree, and more, built for real-world dashboard requirements
 - **1000+ registry components** — Reusable examples composed from shadcn/ui primitives into real-world product flows
-- **Dual Component library support** — Radix UI and Base UI versions for all 16 in-house components
+- **Dual Component library support** — Radix UI and Base UI versions for all 19 in-house components
 - **Compatible with Shadcn Create styles and settings** — Vega, Nova, Maia, Lyra & Mira.
 
 ---
 
 ## Key Features
 
 - **1,000+ free examples** — Production-ready, copy-paste layouts for dashboards, forms, tables, and more
-- **17 In-house Components** — Custom in-house components not found in base shadcn/ui
+- **19 In-house Components** — Custom in-house components not found in base shadcn/ui
 - **Copy-and-Own Model** — No npm package, no lock-in. Own the source code in your repo
 - **Dual API** — Radix UI and Base UI versions for all in-house components
 - **Shadcn Compatible** — Built on shadcn primitives and Tailwind CSS
@@ -44,86 +44,92 @@ ReUI is a free, open-source component library for the [shadcn/ui](https://ui.sha
 
 ## Custom In-House Components
 
-ReUI provides in total: **17 custom in-house components** not found in base shadcn/ui.
+ReUI provides in total: **19 custom in-house components** not found in base shadcn/ui.
 
-### In-House Components (17)
+### In-House Components (19)
 
 Custom-built, shadcn-compatible components not available in base shadcn/ui. Each is maintained by the Keenthemes team, ships full component API documentation, props reference, and usage examples, and is available in both Radix UI and Base UI flavors at [reui.io/docs](https://reui.io/docs).
 
 | Component | # | Description | Preview | Radix UI Docs | Base UI Docs |
 |-----------|---|-------------|---------|---------------|--------------|
-| **Alert** | 10 | Contextual notifications with severity variants and dismissible states | [Preview](https://reui.io/components/alert) | [Radix UI](https://reui.io/docs/components/radix/alert) | [Base UI](https://reui.io/docs/components/base/alert) |
-| **Autocomplete** | 8 | Searchable input with async filtering and keyboard navigation | [Preview](https://reui.io/components/autocomplete) | [Radix UI](https://reui.io/docs/components/radix/autocomplete) | [Base UI](https://reui.io/docs/components/base/autocomplete) |
-| **Badge** | 16 | Status indicators with multiple styles, sizes, and dot variants | [Preview](https://reui.io/components/badge) | [Radix UI](https://reui.io/docs/components/radix/badge) | [Base UI](https://reui.io/docs/components/base/badge) |
+| **Alert** | 20 | Contextual notifications with severity variants and dismissible states | [Preview](https://reui.io/components/alert) | [Radix UI](https://reui.io/docs/components/radix/alert) | [Base UI](https://reui.io/docs/components/base/alert) |
+| **Autocomplete** | 12 | Searchable input with async filtering and keyboard navigation | [Preview](https://reui.io/components/autocomplete) | [Radix UI](https://reui.io/docs/components/radix/autocomplete) | [Base UI](https://reui.io/docs/components/base/autocomplete) |
+| **Badge** | 25 | Status indicators with multiple styles, sizes, and dot variants | [Preview](https://reui.io/components/badge) | [Radix UI](https://reui.io/docs/components/radix/badge) | [Base UI](https://reui.io/docs/components/base/badge) |
 | **Data Grid** | 29 | Advanced table powered by TanStack Table + Virtual with DnD, pinning, resizing, and infinite scroll | [Preview](https://reui.io/components/data-grid) | [Radix UI](https://reui.io/docs/components/radix/data-grid) | [Base UI](https://reui.io/docs/components/base/data-grid) |
-| **Date Selector** | 9 | Flexible date range picker with calendar UI and preset ranges | [Preview](https://reui.io/components/date-selector) | [Radix UI](https://reui.io/docs/components/radix/date-selector) | [Base UI](https://reui.io/docs/components/base/date-selector) |
-| **Filters** | 9 | URL-state filter panel with TanStack Table integration, Zod validation, and multi
```

**File**: `app/(create)/components/components/components-category-card.tsx` (modified, +18/-0)
```diff
@@ -23,6 +23,18 @@ export function ComponentsCategoryCard({
   const searchParams = useSearchParams()
   const [loaded, setLoaded] = React.useState(false)
 
+  // Resolve the loading state from the <img> element itself on mount. The
+  // `load` event can fire before React attaches onLoad - a cached or
+  // synchronously-decoded screenshot completes during hydration - which
+  // otherwise leaves the spinner running on top of a fully-loaded thumbnail.
+  // Reading `complete`/`naturalWidth` catches that race.
+  const resolveFromElement = React.useCallback(
+    (img: HTMLImageElement | null) => {
+      if (img?.complete && img.naturalWidth > 0) setLoaded(true)
+    },
+    []
+  )
+
   // Build href with preserved design system params
   const href = React.useMemo(() => {
     const nextParams = new URLSearchParams(searchParams.toString())
@@ -51,24 +63,30 @@ export function ComponentsCategoryCard({
           </div>
         ) : null}
         <Image
+          ref={resolveFromElement}
           src={`/screenshots/components/${slug}-light.png`}
           alt={slug}
           width={600}
           height={400}
           className="w-full object-cover transition-all duration-300 dark:hidden"
           onLoad={() => setLoaded(true)}
           onError={(e) => {
+            // Clear the spinner too: a category with no screenshot yet would
+            // otherwise spin forever behind the fallback image.
+            setLoaded(true)
             e.currentTarget.src = "/screenshots/components/default-light.png"
           }}
         />
         <Image
+          ref={resolveFromElement}
           src={`/screenshots/components/${slug}-dark.png`}
           alt={slug}
           width={600}
           height={400}
           className="hidden w-full object-cover transition-all duration-300 dark:block"
           onLoad={() => setLoaded(true)}
           onError={(e) => {
+            setLoaded(true)
             e.currentTarget.src = "/screenshots/components/default-dark.png"
           }}
         />
```

**File**: `content/docs/(components)/base/alert.mdx` (modified, +0/-72)
```diff
@@ -9,82 +9,10 @@ base: base
 
 ## Installation
 
-<CodeTabs>
-
-<TabsList>
-  <TabsTrigger value="cli">CLI</TabsTrigger>
-  <TabsTrigger value="manual">Manual</TabsTrigger>
-</TabsList>
-
-<TabsContent value="cli">
-
 ```bash component
 npx shadcn@latest add @reui/alert
 ```
 
-</TabsContent>
-
-<TabsContent value="manual">    
-<Steps>
-
-<Step>
-
-Import the following variables into your CSS file
-
-```css
-@theme inline {
-  --color-destructive-foreground: var(--destructive-foreground);
-  --color-info: var(--info);
-  --color-info-foreground: var(--info-foreground);
-  --color-success: var(--success);
-  --color-success-foreground: var(--success-foreground);
-  --color-warning: var(--warning);
-  --color-warning-foreground: var(--warning-foreground);
-  --color-invert: var(--invert);
-  --color-invert-foreground: var(--invert-foreground);
-}
-
-:root {
-  --destructive-foreground: var(--color-red-800);
-  --success: var(--color-emerald-500);
-  --success-foreground: var(--color-emerald-900);
-  --info: var(--color-violet-500);
-  --info-foreground: var(--color-violet-900);
-  --warning: var(--color-yellow-500);
-  --warning-foreground: var(--color-yellow-900);
-  --invert: var(--color-zinc-900);
-  --invert-foreground: var(--color-zinc-50);
-}
-
-.dark {
-  --destructive-foreground: var(--color-red-600);
-  --success: var(--color-emerald-500);
-  --success-foreground: var(--color-emerald-600);
-  --info: var(--color-violet-500);
-  --info-foreground: var(--color-violet-600);
-  --warning: var(--color-yellow-500);
-  --warning-foreground: var(--color-yellow-600);
-  --invert: var(--color-zinc-700);
-  --invert-foreground: var(--color-zinc-50);
-}
-```
-
-</Step>
-
-<Step>Copy and paste the following code into your project.</Step>
-
-<ComponentSource
-  styleName="base-nova"
-  name="alert"
-  title="components/reui/alert.tsx"
-/>
-
-</Steps>
-
-</TabsContent>
-
-</CodeTabs>
-
 ## Usage
 
 ```tsx
```

**File**: `content/docs/(components)/base/autocomplete.mdx` (modified, +0/-37)
```diff
@@ -15,47 +15,10 @@ links:
 
 ## Installation
 
-<CodeTabs>
-
-<TabsList>
-  <TabsTrigger value="cli">CLI</TabsTrigger>
-  <TabsTrigger value="manual">Manual</TabsTrigger>
-</TabsList>
-
-<TabsContent value="cli">
-
 ```bash
 npx shadcn@latest add @reui/autocomplete
 ```
 
-</TabsContent>
-
-<TabsContent value="manual">
-
-<Steps>
-
-<Step>Install the following dependencies:</Step>
-
-```bash
-npm install @base-ui/react
-```
-
-<Step>Copy and paste the following code into your project.</Step>
-
-<ComponentSource
-  styleName="base-nova"
-  name="autocomplete"
-  title="components/reui/autocomplete.tsx"
-/>
-
-<Step>Update the import paths to match your project setup.</Step>
-
-</Steps>
-
-</TabsContent>
-
-</CodeTabs>
-
 ## Usage
 
 ```tsx
```

**File**: `content/docs/(components)/base/badge.mdx` (modified, +0/-80)
```diff
@@ -9,90 +9,10 @@ base: base
 
 ## Installation
 
-<CodeTabs>
-
-<TabsList>
-  <TabsTrigger value="cli">CLI</TabsTrigger>
-  <TabsTrigger value="manual">Manual</TabsTrigger>
-</TabsList>
-
-<TabsContent value="cli">
-
 ```bash
 npx shadcn@latest add @reui/badge
 ```
 
-</TabsContent>
-
-<TabsContent value="manual">
-
-<Steps>
-
-<Step>
-Import the following variables into your CSS file
-
-```css
-@theme inline {
-  --color-destructive-foreground: var(--destructive-foreground);
-  --color-info: var(--info);
-  --color-info-foreground: var(--info-foreground);
-  --color-success: var(--success);
-  --color-success-foreground: var(--success-foreground);
-  --color-warning: var(--warning);
-  --color-warning-foreground: var(--warning-foreground);
-  --color-invert: var(--invert);
-  --color-invert-foreground: var(--invert-foreground);
-}
-
-:root {
-  --destructive-foreground: var(--color-red-800);
-  --success: var(--color-emerald-500);
-  --success-foreground: var(--color-emerald-900);
-  --info: var(--color-violet-500);
-  --info-foreground: var(--color-violet-900);
-  --warning: var(--color-yellow-500);
-  --warning-foreground: var(--color-yellow-900);
-  --invert: var(--color-zinc-900);
-  --invert-foreground: var(--color-zinc-50);
-}
-
-.dark {
-  --destructive-foreground: var(--color-red-600);
-  --success: var(--color-emerald-500);
-  --success-foreground: var(--color-emerald-600);
-  --info: var(--color-violet-500);
-  --info-foreground: var(--color-violet-600);
-  --warning: var(--color-yellow-500);
-  --warning-foreground: var(--color-yellow-600);
-  --invert: var(--color-zinc-700);
-  --invert-foreground: var(--color-zinc-50);
-}
-```
-
-</Step>
-
-<Step>Install the following dependencies:</Step>
-
-```bash enableRadixSwitch
-npm install @base-ui/react
-```
-
-<Step>Copy and paste the following code into your project.</Step>
-
-<ComponentSource
-  styleName="base-nova"
-  name="badge"
-  title="components/reui/badge.tsx"
-/>
-
-<Step>Update the import paths to match your project setup.</Step>
-
-</Steps>
-
-</TabsContent>
-
-</CodeTabs>
-
 ## Usage
 
 ```tsx
```

**File**: `content/docs/(components)/base/data-grid.mdx` (modified, +30/-101)
```diff
@@ -20,122 +20,51 @@ In the base build, `data-grid-scroll-area.tsx` is also included and exports `Dat
 
 ## Installation
 
-<CodeTabs>
-
-<TabsList>
-  <TabsTrigger value="cli">CLI</TabsTrigger>
-  <TabsTrigger value="manual">Manual</TabsTrigger>
-</TabsList>
-
-<TabsContent value="cli">
-
 ```bash
 npx shadcn@latest add @reui/data-grid
 ```
 
-</TabsContent>
+## React Compiler
 
-<TabsContent value="manual">
+<Callout title="React Compiler" variant="warning">
 
-<Steps>
+TanStack Table v8 returns a stable table instance whose state mutates internally (the reference itself never changes). React Compiler memoizes reads against that stable reference, so state updates can be skipped. In practice that shows up as stale row-selection checkboxes, frozen sort arrows, and unresponsive pin or pagination controls. The fix is the `"use no memo"` directive, which opts a file out of the compiler. It is an inert no-op when React Compiler is not enabled, and is the recommended interim until TanStack Table v9's compiler-native API lands.
 
-<Step>Copy the `data-grid*` files you need into your project.</Step>
+**Already handled for you.** Every ReUI data-grid file you install (the primitive and the examples) already ships with `"use no memo"`, so installed ReUI code is safe out of the box.
 
-<Step>Install the shared core dependencies:</Step>
+**What you must do.** If you enable React Compiler, add `"use no memo"` to your own component that calls `useReactTable`, the one file ReUI cannot reach:
 
-```bash
-npm install @tanstack/react-table class-variance-authority
-```
-
-To enable drag-and-drop column or row reordering, install:
+</Callout>
 
-```bash
-npm install @dnd-kit/core @dnd-kit/modifiers @dnd-kit/sortable @dnd-kit/utilities
-```
-
-To enable virtualization and infinite scroll, install:
-
-```bash
-npm install @tanstack/react-virtual
+```tsx
+"use client"
+"use no memo" // required only when React Compiler is enabled
+
+export function MyTable() {
+  const table = useReactTable({
+    data,
+    columns,
+    getCoreRowModel: getCoreRowModel(),
+  })
+
+  return (
+    <DataGrid table={table} recordCount={data.length}>
+      {/* ... */}
+    </DataGrid>
+  )
+}
 ```
 
-To use the dedicated scroll wrapper (`DataGridScrollArea`), install:
+Prefer excluding a whole directory over a per-file directive? Configure it in your compiler setup instead (Vite example):
 
-```bash
-npm install @base-ui/react
+```ts
+babel({
+  presets: [reactCompilerPreset()],
+  exclude: ["**/components/reui/data-grid/**", "**/your-tables/**"],
+})
 ```
 
-<Step>Copy the shipped files you need into your project.</Step>
-
-`data-grid-table.tsx` exports the footer helpers and `DataGridTableRowPin`. `data-grid-table-virtual.tsx` adds virtualization, infinite scroll, and `footerContent` support. `data-grid-scroll-area.tsx` provides the dedicated base scroll wrapper.
-
-<ComponentSource
-  styleName="base-nova"
-  name="data-grid"
-  title="components/reui/data-grid/data-grid.tsx"
-/>
-
-<ComponentSource
-  styleName="base-nova"
-  name="data-grid-table"
-  title="components/reui/data-grid/data-grid-table.tsx"
-/>
-
-<ComponentSource
-  styleName="base-nova"
-  name="data-grid-pagination"
-  title="components/reui/data-grid/data-grid-pagination.tsx"
-/>
-
-<ComponentSource
-  styleName="base-nova"
-  name="data-grid-column-header"
-  title="components/reui/data-grid/data-grid-column-header.tsx"
-/>
-
-<ComponentSource
-  styleName="base-nova"
-  name="data-grid-column-filter"
-  title="components/reui/data-grid/data-grid-column-filter.tsx"
-/>
-
-<ComponentSource
-  styleName="base-nova"
-  name="data-grid-column-visibility"
-  title="components/reui/data-grid/data-grid-column-visibility.tsx"
-/>
-
-<ComponentSource
-  styleName="base-nova"
-  name="data-grid-table-dnd"
-  title="components/reui/data-grid/data-grid-table-dnd.tsx"
-/>
-
-<ComponentSource
-  styleName="base-nova"
-  name="data-grid-table-dnd-rows"
-  title="components/reui/data-grid/data-grid-table-dnd-rows.tsx"
-/>
-
-<ComponentSource
-  styleName="base-nova"
-  name="data-grid-table-virtual"
-  title="components/reui/data-grid/data-grid-table-virtual.tsx"
-/>
-
-<ComponentSource
-  styleName="base-nova"
-  name="data-grid-scroll-area"
-  title="components/reui/data-grid/data-grid-scroll-area.tsx"
-/>
-
-<Step>Update the import paths to match your project setup.</Step>
-
-</Steps>
-
-</TabsContent>
-
-</CodeTabs>
+On Next.js, prefer the per-file `"use no memo"` directive, since its SWC compiler exclusion is more limited.
 
 ## Usage
 
```

**File**: `content/docs/(components)/base/date-selector.mdx` (modified, +0/-35)
```diff
@@ -14,45 +14,10 @@ base: base
 
 ## Installation
 
-<CodeTabs>
-
-<TabsList>
-  <TabsTrigger value="cli">CLI</TabsTrigger>
-  <TabsTrigger value="manual">Manual</TabsTrigger>
-</TabsList>
-
-<TabsContent value="cli">
-
 ```bash
 npx shadcn@latest add @reui/date-selector
 ```
 
-</TabsContent>
-
-<TabsContent value="manual">
-
-<Steps>
-
-<Step>Install the following dependencies:</Step>
-
-```bash switch
-npm install date-fns @base-ui/react date-fns react-day-picker
-```
-
-<Step>Copy and paste the following code into your project.</Step>
-
-<ComponentSource
-  styleName="base-nova"
-  name="date-selector"
-  title="components/reui/date-selector.tsx"
-/>
-
-</Steps>
-
-</TabsContent>
-
-</CodeTabs>
-
 ## Usage
 
 ```tsx
```

**File**: `content/docs/(components)/base/event-calendar.mdx` (added, +640/-0)
```diff
@@ -0,0 +1,640 @@
+---
+title: Event Calendar
+description: A headless-first event calendar with month, week, day, N-day and agenda views, drag-and-drop scheduling, recurring events, time zones, and an external CRUD contract.
+component: true
+base: base
+---
+
+<ComponentPreview
+  styleName="base-nova"
+  name="c-event-calendar-1"
+  align="start"
+  previewClassName="h-auto p-0"
+/>
+
+The demo above is the whole feature surface in one example: every view (month, week, day, N-days, agenda, and the resource time grid), a multi-day all-day bar, custom chips via `renderEvent`, and a tabbed Settings panel driving view settings, time-grid options, and interactions as controlled props - with a reset back to defaults.
+
+The `event-calendar` package separates the calendar engine from the calendar UI. A subscribable store (`useEventCalendarState`) owns events, view, date, selection, and interactions with controlled and uncontrolled modes for every state pair; the shipped view components (month, week, day, N-days, agenda, and a resource day grid) render from that store through fine-grained selector hooks. Events are yours: the calendar never persists anything, it proposes changes through `onEventUpdate` and you accept, adjust, or reject them.
+
+The composition contract is a provider plus slots: `<EventCalendar>` wraps `<EventCalendarNav />`, an optional `<EventCalendarToolbar />`, and `<EventCalendarContent />`. Recurrence (an RFC 5545 subset, structured rules or raw `RRULE` strings), display time zones via `@date-fns/tz`, pointer-based drag, resize, and drag-create, and per-key i18n overrides are built in.
+
+## Installation
+
+```bash
+npx shadcn@latest add @reui/event-calendar
+```
+
+## Usage
+
+```tsx
+import { EventCalendar } from "@/components/reui/event-calendar/event-calendar"
+import { EventCalendarContent } from "@/components/reui/event-calendar/event-calendar-content"
+import { EventCalendarNav } from "@/components/reui/event-calendar/event-calendar-nav"
+import type { CalendarEvent } from "@/components/reui/event-calendar/event-calendar-types"
+```
+
+```tsx
+const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
+
+return (
+  <EventCalendar
+    events={events}
+    onEventsChange={setEvents}
+    defaultView="week"
+    className="h-[600px]"
+  >
+    <EventCalendarNav />
+    <EventCalendarContent />
+  </EventCalendar>
+)
+```
+
+Pass `defaultEvents` for uncontrolled state or `events` + `onEventsChange` for controlled state; the same pairing exists for `view`, `date`, `dayCount`, `selection`, `interactions`, and `viewSettings`. In the default `scrollMode="contained"` the calendar fills its container and scrolls internally, so give the root an explicit height (the examples use `h-[560px]`). Every timing change, whether from a drag, a resize, or `api.updateEvent`, funnels through `onEventUpdate`: return `false` to reject and revert, return nothing (or `true`) to accept, or return `{ start, end, allDay }` to accept with an adjustment, then persist to your backend from `onEventsChange` or inside `onEventUpdate` itself. Use `onRangeChange` to fetch remote events for the visible range, and `apiRef` (or a hoisted `useEventCalendarState` instance passed as `calendar`) for imperative control from outside the tree.
+
+For more variations, browse the [Event Calendar components](/components/event-calendar).
+
+## API Reference
+
+### EventCalendar
+
+The root provider and container. It creates (or adopts) the calendar instance, provides it via context, and renders a flex-column `div` (customizable through `render`). Besides the props below, it accepts every option and callback listed under [State options](#state-options) and [Callbacks](#callbacks), and every display prop listed under [View configuration](#view-configuration).
+
+| Prop        | Type                                         | Default | Description                                                                                                               |
+| :---------- | :------------------------------------------- | :------ | :------------------------------------------------------------------------------------------------------------------------ |
+| `calendar`  | `EventCalendarInstance<TData>`               | -       | Adopt a hoisted `useEventCalendarState` instance; option props are then ignored (a dev warning fires if both are passed). |
+| `apiRef`    | `RefObject<EventCalendarApi<TData> \| null>` | -       | Imperative escape hatch; receives the instance API for use outside the tree.                                              |
+| `children`  | `ReactNode`                                  | -       | Composed slots, typically `EventCalendarNav`, `EventCalendarToolbar`, and `EventCalendarContent`.                         |
+| `className` | `string`                                     | -       | Additional CSS classes for the root element.                                                                              
```

---

### Incident Patch 6: `59610c02` (2026-07-24)
**Commit Message**: Merge pull request #101 from focus0802/codex/fix-number-field-invalid-ring

fix: keep Number Field invalid ring visible when blurred

**File**: `public/r/styles/base-luma/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-3xl bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-3xl border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n     
```

**File**: `public/r/styles/base-lyra/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-none bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-none border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n   
```

**File**: `public/r/styles/base-maia/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-4xl bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-4xl border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n     
```

**File**: `public/r/styles/base-mira/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-md bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-md border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n      {
```

**File**: `public/r/styles/base-nova/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-lg bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-lg border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n      {
```

**File**: `public/r/styles/base-rhea/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-2xl bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-2xl border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n     
```

**File**: `public/r/styles/base-sera/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-none bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-none border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n   
```

**File**: `public/r/styles/base-vega/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-md bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-md border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n      {
```

---

### Incident Patch 7: `72d7c473` (2026-07-24)
**Commit Message**: Rounded border fix

Sorry, I was quite bothered by the curves that didn't look quite right earlier.

**File**: `components/reui/frame.tsx` (modified, +46/-32)
```diff
@@ -1,40 +1,48 @@
-import * as React from "react"
 import { cva, type VariantProps } from "class-variance-authority"
 
 import { cn } from "@/lib/utils"
 
 const frameVariants = cva(
   [
-    "relative flex flex-col gap-(--frame-gap) rounded-(--frame-radius) p-(--frame-padding)",
-    "[--frame-radius:var(--radius-xl)] [--frame-border-radius:calc(var(--frame-radius)-1px)]",
-    "[--frame-gap:--spacing(0.75)] [--frame-padding:--spacing(0.5)]",
-    "[--frame-panel-px:--spacing(6)] [--frame-panel-py:--spacing(6)]",
-    "[--frame-panel-header-px:--spacing(4)] [--frame-panel-header-py:--spacing(3)]",
-    "[--frame-panel-footer-px:--spacing(4)] [--frame-panel-footer-py:--spacing(3)]",
+    "relative flex flex-col bg-muted/50 gap-(--frame-gap) px-(--frame-px) py-(--frame-py) rounded-(--frame-radius)",
+    "(--radius-xl)] [--frame-radius:var(--radius-xl)]",
+    "(--radius-none)] (--radius-2xl)] (--radius-lg)] (--radius-none)]",
+    "[--frame-gap:--spacing(0.75)] [--frame-px:--spacing(0.75)] [--frame-py:--spacing(0.75)] [--frame-panel-header-gap:0rem] [--frame-panel-footer-gap:--spacing(1)]",
+    "[--frame-panel-px-adjust:0px] [--frame-panel-py-adjust:0px] [--frame-panel-header-px-adjust:0px] [--frame-panel-header-py-adjust:0px] [--frame-panel-footer-px-adjust:0px] [--frame-panel-footer-py-adjust:0px]",
+    "[--frame-panel-px:calc(var(--frame-panel-px-base)_+_var(--frame-panel-px-adjust))] [--frame-panel-py:calc(var(--frame-panel-py-base)_+_var(--frame-panel-py-adjust))] [--frame-panel-header-px:calc(var(--frame-panel-header-px-base)_+_var(--frame-panel-header-px-adjust))] [--frame-panel-header-py:calc(var(--frame-panel-header-py-base)_+_var(--frame-panel-header-py-adjust))] [--frame-panel-footer-px:calc(var(--frame-panel-footer-px-base)_+_var(--frame-panel-footer-px-adjust))] [--frame-panel-footer-py:calc(var(--frame-panel-footer-py-base)_+_var(--frame-panel-footer-py-adjust))]",
+    "(1)] (1)] (1.25)] (1.5)] (1.5)] (0.5)] (1)] (1)]",
+    "[--frame-panel-bg:var(--color-card)] [--frame-panel-border-color:var(--color-border)] [--frame-border-color:var(--color-border)]",
   ],
   {
     variants: {
       variant: {
-        default:
-          "border border-site-border/60 bg-site-background/60 dark:bg-site-background/20 [--frame-panel-bg:var(--color-site-background)] [--frame-panel-border-color:var(--color-site-border)]",
+        default: "border border-[var(--frame-border-color)] bg-clip-padding",
         inverse:
-          "border border-site-border/60 bg-site-background dark:bg-site-background/30 [--frame-panel-bg:color-mix(in_oklch,var(--color-site-muted)_45%,transparent)] [--frame-panel-border-color:var(--color-site-border)]",
-        ghost:
-          "bg-transparent p-0 [--frame-panel-bg:transparent] [--frame-panel-border-color:transparent]",
+          "[--frame-panel-bg:color-mix(in_oklch,var(--color-muted)_40%,transparent)] border border-[var(--frame-border-color)] bg-background bg-clip-padding",
+        ghost: "",
       },
       spacing: {
-        xs: "[--frame-padding:--spacing(0.5)] [--frame-gap:--spacing(0.5)] [--frame-panel-px:--spacing(3)] [--frame-panel-py:--spacing(3)] [--frame-panel-header-px:--spacing(3)] [--frame-panel-header-py:--spacing(2)] [--frame-panel-footer-px:--spacing(3)] [--frame-panel-footer-py:--spacing(2)]",
-        sm: "[--frame-padding:--spacing(0.5)] [--frame-gap:--spacing(0.75)] [--frame-panel-px:--spacing(4)] [--frame-panel-py:--spacing(4)] [--frame-panel-header-px:--spacing(4)] [--frame-panel-header-py:--spacing(2.5)] [--frame-panel-footer-px:--spacing(4)] [--frame-panel-footer-py:--spacing(2.5)]",
+        xs: "[--frame-panel-px-base:--spacing(2)] [--frame-panel-py-base:--spacing(2)] [--frame-panel-header-px-base:--spacing(2)] [--frame-panel-header-py-base:--spacing(0.5)] [--frame-panel-footer-px-base:--spacing(2)] [--frame-panel-footer-py-base:--spacing(0.5)]",
+        sm: "[--frame-panel-px-base:--spacing(3)] [--frame-panel-py-base:--spacing(3.5)] [--frame-panel-header-px-base:--spacing(3)] [--frame-panel-header-py-base:--spacing(1.5)] [--frame-panel-footer-px-base:--spacing(3)] [--frame-panel-footer-py-base:--spacing(1.5)]",
         default:
-          "[--frame-padding:--spacing(0.5)] [--frame-gap:--spacing(0.75)] [--frame-panel-px:--spacing(6)] [--frame-panel-py:--spacing(6)] [--frame-panel-header-px:--spacing(4)] [--frame-panel-header-py:--spacing(3)] [--frame-panel-footer-px:--spacing(4)] [--frame-panel-footer-py:--spacing(3)]",
-        lg: "[--frame-padding:--spacing(0.75)] [--frame-gap:--spacing(1)] [--frame-panel-px:--spacing(8)] [--frame-panel-py:--spacing(8)] [--frame-panel-header-px:--spacing(5)] [--frame-panel-header-py:--spacing(4)] [--frame-panel-footer-px:--spacing(5)] [--frame-panel-footer-py:--spacing(4)]",
+          "[--frame-panel-px-base:--spacing(4)] [--frame-panel-py-base:--spacing(4)] [--frame-panel-header-px-base:--spacing(4)] [--frame-panel-header-py-base:--spacing(2)] [--frame-panel-footer-px-base:--spacing(4)] [--frame-pan
```

---

### Incident Patch 8: `5d7e6265` (2026-07-19)
**Commit Message**: fix: keep Number Field invalid ring visible

**File**: `public/r/styles/base-luma/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-3xl bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-3xl border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n     
```

**File**: `public/r/styles/base-lyra/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-none bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-none border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n   
```

**File**: `public/r/styles/base-maia/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-4xl bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-4xl border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n     
```

**File**: `public/r/styles/base-mira/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-md bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-md border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n      {
```

**File**: `public/r/styles/base-nova/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-lg bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-lg border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n      {
```

**File**: `public/r/styles/base-rhea/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-2xl bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-2xl border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n     
```

**File**: `public/r/styles/base-sera/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-none bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-none border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n   
```

**File**: `public/r/styles/base-vega/number-field.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"number-field","type":"registry:ui","title":"Number Field","description":"","dependencies":["@base-ui/react","class-variance-authority"],"registryDependencies":["label"],"files":[{"path":"number-field.tsx","type":"registry:ui","content":"\"use client\"\n\nimport { createContext, ReactNode, useContext, useId } from \"react\"\nimport { NumberField as NumberFieldPrimitive } from \"@base-ui/react/number-field\"\nimport { cva, VariantProps } from \"class-variance-authority\"\n\nimport { cn } from \"@/lib/utils\"\nimport { Label } from \"@/components/ui/label\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\nconst NumberFieldContext = createContext<{\n  fieldId: string\n  size: \"sm\" | \"default\" | \"lg\"\n} | null>(null)\n\nconst numberFieldGroupVariants = cva(\n  \"relative flex w-full justify-between border border-input data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 dark:focus-within:has-aria-invalid:ring-destructive/40 rounded-md bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3\",\n  {\n    variants: {\n      size: {\n        sm: \"h-7 text-sm\",\n        default:\n          \"h-8 text-sm\",\n        lg: \"h-9 text-sm\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldButtonVariants = cva(\n  \"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent\",\n  {\n    variants: {\n      size: {\n        sm: \"px-1.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 [&_svg:not([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-3.5\",\n        default:\n          \"px-2 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n        lg: \"px-2.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-4 [&_svg:not([class*='size-'])]:size-4 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5 ([class*='size-'])]:size-4 ([class*='size-'])]:size-3.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nconst numberFieldInputVariants = cva(\n  \"w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none\",\n  {\n    variants: {\n      size: {\n        sm: \"px-2 py-0.5\",\n        default:\n          \"px-2.5 py-1\",\n        lg: \"px-2.5 py-1.5\",\n      },\n    },\n    defaultVariants: {\n      size: \"default\",\n    },\n  }\n)\n\nfunction NumberField({\n  id,\n  className,\n  size = \"default\",\n  ...props\n}: NumberFieldPrimitive.Root.Props &\n  VariantProps<typeof numberFieldGroupVariants>) {\n  const generatedId = useId()\n  const fieldId = id ?? generatedId\n  const sizeValue = size ?? \"default\"\n\n  return (\n    <NumberFieldContext.Provider value={{ fieldId, size: sizeValue }}>\n      <NumberFieldPrimitive.Root\n        className={cn(\"flex w-full flex-col items-start gap-2\", className)}\n        data-size={sizeValue}\n        data-slot=\"number-field\"\n        id={fieldId}\n        {...props}\n      />\n    </NumberFieldContext.Provider>\n  )\n}\n\nfunction NumberFieldGroup({\n  className,\n  size: sizeProp,\n  ...props\n}: NumberFieldPrimitive.Group.Props &\n  Partial<VariantProps<typeof numberFieldGroupVariants>>) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldGroup must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Group\n      className={cn(numberFieldGroupVariants({ size }), className)}\n      data-slot=\"number-field-group\"\n      {...props}\n    />\n  )\n}\n\nfunction NumberFieldDecrement({\n  className,\n  size: sizeProp,\n  children,\n  ...props\n}: NumberFieldPrimitive.Decrement.Props &\n  Partial<VariantProps<typeof numberFieldButtonVariants>> & {\n    children?: React.ReactNode\n  }) {\n  const context = useContext(NumberFieldContext)\n  if (!context) {\n    throw new Error(\n      \"NumberFieldDecrement must be used within a NumberField component.\"\n    )\n  }\n  const size = sizeProp ?? context.size\n\n  return (\n    <NumberFieldPrimitive.Decrement\n      className={cn(\n        numberFieldButtonVariants({ size }),\n        \"rounded-s-md border-e-0\",\n        className\n      )}\n      data-slot=\"number-field-decrement\"\n      {
```

---

### Incident Patch 9: `e7c90c4b` (2026-07-09)
**Commit Message**: Add masked Input OTP render example

**File**: `public/r/styles/base-nova/c-input-otp-7.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"c-input-otp-7","type":"registry:block","title":"Masked OTP input with render function.","description":"Masked OTP input with render function.","dependencies":["input-otp"],"registryDependencies":["field","input-otp"],"files":[{"path":"c-input-otp-7.tsx","type":"registry:block","content":"\"use client\"\n\nimport type { SlotProps } from \"input-otp\"\n\nimport {\n  Field,\n  FieldDescription,\n  FieldLabel,\n} from \"@/components/ui/field\"\nimport {\n  InputOTP,\n  InputOTPGroup,\n  InputOTPSeparator,\n} from \"@/components/ui/input-otp\"\nimport { cn } from \"@/lib/utils\"\n\nfunction MaskedInputOTPSlot({\n  char,\n  hasFakeCaret,\n  isActive,\n}: SlotProps) {\n  return (\n    <div\n      aria-hidden=\"true\"\n      data-active={isActive}\n      data-slot=\"input-otp-slot\"\n      className={cn(\n        \"cn-input-otp-slot relative flex items-center justify-center data-[active=true]:z-10\"\n      )}\n    >\n      {char ? \"•\" : null}\n      {hasFakeCaret && (\n        <div className=\"cn-input-otp-caret pointer-events-none absolute inset-0 flex items-center justify-center\">\n          <div className=\"cn-input-otp-caret-line\" />\n        </div>\n      )}\n    </div>\n  )\n}\n\nexport function Pattern() {\n  return (\n    <div className=\"flex items-center justify-center\">\n      <Field>\n        <FieldLabel htmlFor=\"masked-render\">Masked OTP</FieldLabel>\n        <FieldDescription>\n          Use the render function to obscure filled slots.\n        </FieldDescription>\n        <InputOTP\n          id=\"masked-render\"\n          maxLength={6}\n          render={({ slots }) => (\n            <>\n              <InputOTPGroup>\n                {slots.slice(0, 3).map((slot, index) => (\n                  <MaskedInputOTPSlot key={index} {...slot} />\n                ))}\n              </InputOTPGroup>\n              <InputOTPSeparator />\n              <InputOTPGroup>\n                {slots.slice(3).map((slot, index) => (\n                  <MaskedInputOTPSlot key={index + 3} {...slot} />\n                ))}\n              </InputOTPGroup>\n            </>\n          )}\n        />\n      </Field>\n    </div>\n  )\n}","target":"components/examples/c-input-otp-7.tsx"}],"meta":{"order":7}}
\ No newline at end of file
```

**File**: `public/r/styles/base-nova/registry.json` (modified, +23/-0)
```diff
@@ -14302,6 +14302,29 @@
         "order": 6
       }
     },
+    {
+      "name": "c-input-otp-7",
+      "type": "registry:block",
+      "title": "Masked OTP input with render function.",
+      "description": "Masked OTP input with render function.",
+      "dependencies": [
+        "input-otp"
+      ],
+      "registryDependencies": [
+        "field",
+        "input-otp"
+      ],
+      "files": [
+        {
+          "path": "c-input-otp-7.tsx",
+          "type": "registry:block",
+          "target": "components/examples/c-input-otp-7.tsx"
+        }
+      ],
+      "meta": {
+        "order": 7
+      }
+    },
     {
       "name": "c-item-1",
       "type": "registry:block",
```

**File**: `public/r/styles/radix-nova/c-input-otp-7.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"c-input-otp-7","type":"registry:block","title":"Masked OTP input with render function.","description":"Masked OTP input with render function.","dependencies":["input-otp"],"registryDependencies":["field","input-otp"],"files":[{"path":"c-input-otp-7.tsx","type":"registry:block","content":"\"use client\"\n\nimport type { SlotProps } from \"input-otp\"\n\nimport {\n  Field,\n  FieldDescription,\n  FieldLabel,\n} from \"@/components/ui/field\"\nimport {\n  InputOTP,\n  InputOTPGroup,\n  InputOTPSeparator,\n} from \"@/components/ui/input-otp\"\nimport { cn } from \"@/lib/utils\"\n\nfunction MaskedInputOTPSlot({\n  char,\n  hasFakeCaret,\n  isActive,\n}: SlotProps) {\n  return (\n    <div\n      aria-hidden=\"true\"\n      data-active={isActive}\n      data-slot=\"input-otp-slot\"\n      className={cn(\n        \"cn-input-otp-slot relative flex items-center justify-center data-[active=true]:z-10\"\n      )}\n    >\n      {char ? \"•\" : null}\n      {hasFakeCaret && (\n        <div className=\"cn-input-otp-caret pointer-events-none absolute inset-0 flex items-center justify-center\">\n          <div className=\"cn-input-otp-caret-line\" />\n        </div>\n      )}\n    </div>\n  )\n}\n\nexport function Pattern() {\n  return (\n    <div className=\"flex items-center justify-center\">\n      <Field>\n        <FieldLabel htmlFor=\"masked-render\">Masked OTP</FieldLabel>\n        <FieldDescription>\n          Use the render function to obscure filled slots.\n        </FieldDescription>\n        <InputOTP\n          id=\"masked-render\"\n          maxLength={6}\n          render={({ slots }) => (\n            <>\n              <InputOTPGroup>\n                {slots.slice(0, 3).map((slot, index) => (\n                  <MaskedInputOTPSlot key={index} {...slot} />\n                ))}\n              </InputOTPGroup>\n              <InputOTPSeparator />\n              <InputOTPGroup>\n                {slots.slice(3).map((slot, index) => (\n                  <MaskedInputOTPSlot key={index + 3} {...slot} />\n                ))}\n              </InputOTPGroup>\n            </>\n          )}\n        />\n      </Field>\n    </div>\n  )\n}","target":"components/examples/c-input-otp-7.tsx"}],"meta":{"order":7}}
\ No newline at end of file
```

**File**: `public/r/styles/radix-nova/registry.json` (modified, +23/-0)
```diff
@@ -14283,6 +14283,29 @@
         "order": 6
       }
     },
+    {
+      "name": "c-input-otp-7",
+      "type": "registry:block",
+      "title": "Masked OTP input with render function.",
+      "description": "Masked OTP input with render function.",
+      "dependencies": [
+        "input-otp"
+      ],
+      "registryDependencies": [
+        "field",
+        "input-otp"
+      ],
+      "files": [
+        {
+          "path": "c-input-otp-7.tsx",
+          "type": "registry:block",
+          "target": "components/examples/c-input-otp-7.tsx"
+        }
+      ],
+      "meta": {
+        "order": 7
+      }
+    },
     {
       "name": "c-item-1",
       "type": "registry:block",
```

**File**: `registry-reui/_meta/components/bases/base/input-otp.json` (modified, +26/-0)
```diff
@@ -151,6 +151,32 @@
       "meta": {
         "order": 6
       }
+    },
+    {
+      "name": "c-input-otp-7",
+      "type": "registry:block",
+      "title": "Masked OTP input with render function.",
+      "categories": [
+        "input-otp"
+      ],
+      "description": "Masked OTP input with render function.",
+      "registryDependencies": [
+        "field",
+        "input-otp"
+      ],
+      "dependencies": [
+        "input-otp"
+      ],
+      "files": [
+        {
+          "path": "components/input-otp/c-input-otp-7.tsx",
+          "type": "registry:block",
+          "target": "components/examples/c-input-otp-7.tsx"
+        }
+      ],
+      "meta": {
+        "order": 7
+      }
     }
   ]
 }
```

**File**: `registry-reui/_meta/components/bases/base/name-index.json` (modified, +1/-0)
```diff
@@ -645,6 +645,7 @@
   "c-input-otp-4": "input-otp",
   "c-input-otp-5": "input-otp",
   "c-input-otp-6": "input-otp",
+  "c-input-otp-7": "input-otp",
   "c-item-1": "item",
   "c-item-2": "item",
   "c-item-3": "item",
```

**File**: `registry-reui/_meta/components/bases/radix/input-otp.json` (modified, +26/-0)
```diff
@@ -151,6 +151,32 @@
       "meta": {
         "order": 6
       }
+    },
+    {
+      "name": "c-input-otp-7",
+      "type": "registry:block",
+      "title": "Masked OTP input with render function.",
+      "categories": [
+        "input-otp"
+      ],
+      "description": "Masked OTP input with render function.",
+      "registryDependencies": [
+        "field",
+        "input-otp"
+      ],
+      "dependencies": [
+        "input-otp"
+      ],
+      "files": [
+        {
+          "path": "components/input-otp/c-input-otp-7.tsx",
+          "type": "registry:block",
+          "target": "components/examples/c-input-otp-7.tsx"
+        }
+      ],
+      "meta": {
+        "order": 7
+      }
     }
   ]
 }
```

**File**: `registry-reui/_meta/components/bases/radix/name-index.json` (modified, +1/-0)
```diff
@@ -645,6 +645,7 @@
   "c-input-otp-4": "input-otp",
   "c-input-otp-5": "input-otp",
   "c-input-otp-6": "input-otp",
+  "c-input-otp-7": "input-otp",
   "c-item-1": "item",
   "c-item-2": "item",
   "c-item-3": "item",
```

---

### Incident Patch 10: `0946f966` (2026-03-30)
**Commit Message**: fix: data-grid component

**File**: `app/(create)/components/[category]/page.tsx` (modified, +3/-19)
```diff
@@ -1,8 +1,6 @@
 import { Suspense } from "react"
 import type { Metadata } from "next"
-import Link from "next/link"
 import { notFound } from "next/navigation"
-import { BookOpenTextIcon } from "lucide-react"
 
 import { siteConfig } from "@/lib/config"
 import {
@@ -11,13 +9,8 @@ import {
   getComponentsByCategory,
 } from "@/lib/registry"
 import { getComponentCategorySeo } from "@/lib/registry-seo-cache"
-import {
-  buildBreadcrumbJsonLd,
-  buildPageMetadata,
-  isCanonicalComponentDoc,
-} from "@/lib/seo"
+import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/seo"
 import { normalizeSlug } from "@/lib/utils"
-import { Button } from "@/components/ui/button"
 import { Spinner } from "@/components/ui/spinner"
 import { JsonLd } from "@/components/json-ld"
 
@@ -26,6 +19,7 @@ import {
   ComponentCategoryHeroIntro,
   ComponentCategorySeoContent,
 } from "../components/component-category-seo-content"
+import { ComponentDocsLink } from "../components/component-docs-link"
 import { CategoryPageContent } from "./category-page-content"
 
 function ComponentPreviewSkeleton() {
@@ -107,9 +101,6 @@ export default async function CategoryComponentsPage({
 
   const seo = getComponentCategorySeo(normalized)
   const catalogItems = getComponentsByCategory(normalized)
-  const docsHref = isCanonicalComponentDoc(normalized)
-    ? `/docs/components/base/${normalized}`
-    : null
   const faqJsonLd = seo.content?.faqs?.length
     ? {
         "@context": "https://schema.org",
@@ -140,14 +131,7 @@ export default async function CategoryComponentsPage({
             <h1 className="text-balanc mt-3 min-w-0 flex-1 text-xl font-bold sm:text-3xl">
               {seo.title}
             </h1>
-            {docsHref ? (
-              <Button variant="outline" size="sm" asChild className="shrink-0">
-                <Link href={docsHref}>
-                  <BookOpenTextIcon className="size-3.5 opacity-60" />
-                  View docs
-                </Link>
-              </Button>
-            ) : null}
+            <ComponentDocsLink slug={normalized} />
           </div>
           {seo.intro ? <ComponentCategoryHeroIntro intro={seo.intro} /> : null}
         </div>
```

**File**: `app/(create)/components/components/component-docs-link.tsx` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+"use client"
+
+import * as React from "react"
+import Link from "next/link"
+import { BookOpenTextIcon } from "lucide-react"
+
+import { isCanonicalComponentDoc } from "@/lib/seo"
+import { useConfig } from "@/hooks/use-config"
+import { Button } from "@/components/ui/button"
+import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params"
+
+export function ComponentDocsLink({ slug }: { slug: string }) {
+  const [mounted, setMounted] = React.useState(false)
+  const [params] = useDesignSystemSearchParams()
+  const [config] = useConfig()
+
+  React.useEffect(() => {
+    setMounted(true)
+  }, [])
+
+  if (!isCanonicalComponentDoc(slug)) {
+    return null
+  }
+
+  const base = mounted
+    ? (params.base ?? config.base ?? "base")
+    : (params.base ?? "base")
+  const docsHref = `/docs/components/${base === "radix" ? "radix" : "base"}/${slug}`
+
+  return (
+    <Button variant="outline" size="sm" asChild className="shrink-0">
+      <Link href={docsHref}>
+        <BookOpenTextIcon className="size-3.5 opacity-60" />
+        View docs
+      </Link>
+    </Button>
+  )
+}
```

**File**: `public/r/styles/base-lyra/c-data-grid-10.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"c-data-grid-10","type":"registry:block","title":"Data grid with column icons","description":"Data grid with column icons","dependencies":["@tanstack/react-table"],"registryDependencies":["avatar","@reui/data-grid","@reui/data-grid-column-header","@reui/data-grid-pagination","@reui/data-grid-scroll-area","@reui/data-grid-table"],"files":[{"path":"c-data-grid-10.tsx","type":"registry:block","content":"\"use client\"\n\nimport { useMemo, useState } from \"react\"\nimport Link from \"next/link\"\nimport {\n  DataGrid,\n  DataGridContainer,\n} from \"@/components/reui/data-grid/data-grid\"\nimport { DataGridColumnHeader } from \"@/components/reui/data-grid/data-grid-column-header\"\nimport { DataGridPagination } from \"@/components/reui/data-grid/data-grid-pagination\"\nimport { DataGridScrollArea } from \"@/components/reui/data-grid/data-grid-scroll-area\"\nimport { DataGridTable } from \"@/components/reui/data-grid/data-grid-table\"\nimport {\n  ColumnDef,\n  getCoreRowModel,\n  getFilteredRowModel,\n  getPaginationRowModel,\n  getSortedRowModel,\n  PaginationState,\n  SortingState,\n  useReactTable,\n} from \"@tanstack/react-table\"\n\nimport {\n  Avatar,\n  AvatarFallback,\n  AvatarImage,\n} from \"@/components/ui/avatar\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\ninterface IData {\n  id: string\n  name: string\n  availability: \"online\" | \"away\" | \"busy\" | \"offline\"\n  avatar: string\n  status: \"active\" | \"inactive\"\n  flag: string // Emoji flags\n  email: string\n  company: string\n  role: string\n  joined: string\n  location: string\n  balance: number\n}\n\nconst demoData: IData[] = [\n  {\n    id: \"1\",\n    name: \"Alex Johnson\",\n    availability: \"online\",\n    avatar:\n      \"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"us\",\n    email: \"alex@apple.com\",\n    company: \"Apple\",\n    role: \"CEO\",\n    joined: \"Jan, 2024\",\n    location: \"United States\",\n    balance: 5143.03,\n  },\n  {\n    id: \"2\",\n    name: \"Sarah Chen\",\n    availability: \"away\",\n    avatar:\n      \"https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"gb\",\n    email: \"sarah@openai.com\",\n    company: \"OpenAI\",\n    role: \"CTO\",\n    joined: \"Mar, 2023\",\n    location: \"United Kingdom\",\n    balance: 4321.87,\n  },\n  {\n    id: \"3\",\n    name: \"Michael Rodriguez\",\n    availability: \"busy\",\n    avatar:\n      \"https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"ca\",\n    email: \"michael@meta.com\",\n    company: \"Meta\",\n    role: \"Designer\",\n    joined: \"Jun, 2022\",\n    location: \"Canada\",\n    balance: 7654.98,\n  },\n  {\n    id: \"4\",\n    name: \"Emma Wilson\",\n    availability: \"offline\",\n    avatar:\n      \"https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"au\",\n    email: \"emma@tesla.com\",\n    company: \"Tesla\",\n    role: \"Developer\",\n    joined: \"Sep, 2024\",\n    location: \"Australia\",\n    balance: 3456.45,\n  },\n  {\n    id: \"5\",\n    name: \"David Kim\",\n    availability: \"online\",\n    avatar:\n      \"https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"de\",\n    email: \"david@sap.com\",\n    company: \"SAP\",\n    role: \"Lawyer\",\n    joined: \"Nov, 2023\",\n    location: \"Germany\",\n    balance: 9876.54,\n  },\n  {\n    id: \"6\",\n    name: \"Aron Thompson\",\n    availability: \"away\",\n    avatar:\n      \"https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"my\",\n    email: \"aron@keenthemes.com\",\n    company: \"Keenthemes\",\n    role: \"Director\",\n    joined: \"Feb, 2022\",\n    location: \"Malaysia\",\n    balance: 6214.22,\n  },\n  {\n    id: \"7\",\n    name: \"James Brown\",\n    availability: \"busy\",\n    avatar:\n      \"https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"es\",\n    email: \"james@bbva.es\",\n    company: \"BBVA\",\n    role: \"Product Manager\",\n    joined: \"Aug, 2024\",\n    location: \"Spain\",\n    balance: 5321.77,\n  },\n  {\n    id: \"8\",\n    name: \"Maria Garcia\",\n    availability: \"offline\",\n    avatar:\n      \"https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"jp\",\n    email: \"maria@sony.jp\",\n    company: \"Sony\",\n    role: \"Marketing Lead\",\n    joined: \"Dec, 2023\",\n    location: \"Japan\",\n    balance: 8452.39,\n  },\n  {\n    id: \"9\",\n    name: \"Nick Johns
```

**File**: `public/r/styles/base-lyra/c-data-grid-14.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"c-data-grid-14","type":"registry:block","title":"Data grid with draggable rows","description":"Data grid with draggable rows","dependencies":["@dnd-kit/core","@dnd-kit/sortable","@tanstack/react-table"],"registryDependencies":["avatar","@reui/data-grid","@reui/data-grid-pagination","@reui/data-grid-scroll-area","@reui/data-grid-table-dnd-rows"],"files":[{"path":"c-data-grid-14.tsx","type":"registry:block","content":"\"use client\"\n\nimport { useMemo, useState } from \"react\"\nimport Link from \"next/link\"\nimport {\n  DataGrid,\n  DataGridContainer,\n} from \"@/components/reui/data-grid/data-grid\"\nimport { DataGridPagination } from \"@/components/reui/data-grid/data-grid-pagination\"\nimport { DataGridScrollArea } from \"@/components/reui/data-grid/data-grid-scroll-area\"\nimport {\n  DataGridTableDndRowHandle,\n  DataGridTableDndRows,\n} from \"@/components/reui/data-grid/data-grid-table-dnd-rows\"\nimport { DragEndEvent, UniqueIdentifier } from \"@dnd-kit/core\"\nimport { arrayMove } from \"@dnd-kit/sortable\"\nimport {\n  ColumnDef,\n  getCoreRowModel,\n  getSortedRowModel,\n  useReactTable,\n} from \"@tanstack/react-table\"\n\nimport {\n  Avatar,\n  AvatarFallback,\n  AvatarImage,\n} from \"@/components/ui/avatar\"\n\ninterface IData {\n  id: string\n  name: string\n  availability: \"online\" | \"away\" | \"busy\" | \"offline\"\n  avatar: string\n  status: \"active\" | \"inactive\"\n  flag: string // Emoji flags\n  email: string\n  company: string\n  role: string\n  joined: string\n  location: string\n  balance: number\n}\n\nconst demoData: IData[] = [\n  {\n    id: \"1\",\n    name: \"Alex Johnson\",\n    availability: \"online\",\n    avatar:\n      \"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"us\",\n    email: \"alex@apple.com\",\n    company: \"Apple\",\n    role: \"CEO\",\n    joined: \"Jan, 2024\",\n    location: \"United States\",\n    balance: 5143.03,\n  },\n  {\n    id: \"2\",\n    name: \"Sarah Chen\",\n    availability: \"away\",\n    avatar:\n      \"https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"gb\",\n    email: \"sarah@openai.com\",\n    company: \"OpenAI\",\n    role: \"CTO\",\n    joined: \"Mar, 2023\",\n    location: \"United Kingdom\",\n    balance: 4321.87,\n  },\n  {\n    id: \"3\",\n    name: \"Michael Rodriguez\",\n    availability: \"busy\",\n    avatar:\n      \"https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"ca\",\n    email: \"michael@meta.com\",\n    company: \"Meta\",\n    role: \"Designer\",\n    joined: \"Jun, 2022\",\n    location: \"Canada\",\n    balance: 7654.98,\n  },\n  {\n    id: \"4\",\n    name: \"Emma Wilson\",\n    availability: \"offline\",\n    avatar:\n      \"https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"au\",\n    email: \"emma@tesla.com\",\n    company: \"Tesla\",\n    role: \"Developer\",\n    joined: \"Sep, 2024\",\n    location: \"Australia\",\n    balance: 3456.45,\n  },\n  {\n    id: \"5\",\n    name: \"David Kim\",\n    availability: \"online\",\n    avatar:\n      \"https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"de\",\n    email: \"david@sap.com\",\n    company: \"SAP\",\n    role: \"Lawyer\",\n    joined: \"Nov, 2023\",\n    location: \"Germany\",\n    balance: 9876.54,\n  },\n  {\n    id: \"6\",\n    name: \"Aron Thompson\",\n    availability: \"away\",\n    avatar:\n      \"https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"my\",\n    email: \"aron@keenthemes.com\",\n    company: \"Keenthemes\",\n    role: \"Director\",\n    joined: \"Feb, 2022\",\n    location: \"Malaysia\",\n    balance: 6214.22,\n  },\n]\n\nexport function Pattern() {\n  const columns = useMemo<ColumnDef<IData>[]>(\n    () => [\n      {\n        id: \"drag\",\n        cell: () => <DataGridTableDndRowHandle />,\n        size: 30,\n      },\n      {\n        accessorKey: \"name\",\n        id: \"name\",\n        header: \"Name\",\n        cell: ({ row }) => {\n          return (\n            <div className=\"flex items-center gap-2\">\n              <Avatar className=\"size-6\">\n                <AvatarImage\n                  src={row.original.avatar}\n                  alt={row.original.name}\n                />\n                <AvatarFallback>\n                  {row.original.name\n                    .split(\" \")\n                    .map((n) => n[0])\n                    .join(\"\")}\n                </AvatarFallback>\n              </Avatar>\n              <Link\n                href=\"#\"\n                className=\"text-foreground
```

**File**: `public/r/styles/base-maia/c-data-grid-10.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"c-data-grid-10","type":"registry:block","title":"Data grid with column icons","description":"Data grid with column icons","dependencies":["@tanstack/react-table"],"registryDependencies":["avatar","@reui/data-grid","@reui/data-grid-column-header","@reui/data-grid-pagination","@reui/data-grid-scroll-area","@reui/data-grid-table"],"files":[{"path":"c-data-grid-10.tsx","type":"registry:block","content":"\"use client\"\n\nimport { useMemo, useState } from \"react\"\nimport Link from \"next/link\"\nimport {\n  DataGrid,\n  DataGridContainer,\n} from \"@/components/reui/data-grid/data-grid\"\nimport { DataGridColumnHeader } from \"@/components/reui/data-grid/data-grid-column-header\"\nimport { DataGridPagination } from \"@/components/reui/data-grid/data-grid-pagination\"\nimport { DataGridScrollArea } from \"@/components/reui/data-grid/data-grid-scroll-area\"\nimport { DataGridTable } from \"@/components/reui/data-grid/data-grid-table\"\nimport {\n  ColumnDef,\n  getCoreRowModel,\n  getFilteredRowModel,\n  getPaginationRowModel,\n  getSortedRowModel,\n  PaginationState,\n  SortingState,\n  useReactTable,\n} from \"@tanstack/react-table\"\n\nimport {\n  Avatar,\n  AvatarFallback,\n  AvatarImage,\n} from \"@/components/ui/avatar\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\ninterface IData {\n  id: string\n  name: string\n  availability: \"online\" | \"away\" | \"busy\" | \"offline\"\n  avatar: string\n  status: \"active\" | \"inactive\"\n  flag: string // Emoji flags\n  email: string\n  company: string\n  role: string\n  joined: string\n  location: string\n  balance: number\n}\n\nconst demoData: IData[] = [\n  {\n    id: \"1\",\n    name: \"Alex Johnson\",\n    availability: \"online\",\n    avatar:\n      \"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"us\",\n    email: \"alex@apple.com\",\n    company: \"Apple\",\n    role: \"CEO\",\n    joined: \"Jan, 2024\",\n    location: \"United States\",\n    balance: 5143.03,\n  },\n  {\n    id: \"2\",\n    name: \"Sarah Chen\",\n    availability: \"away\",\n    avatar:\n      \"https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"gb\",\n    email: \"sarah@openai.com\",\n    company: \"OpenAI\",\n    role: \"CTO\",\n    joined: \"Mar, 2023\",\n    location: \"United Kingdom\",\n    balance: 4321.87,\n  },\n  {\n    id: \"3\",\n    name: \"Michael Rodriguez\",\n    availability: \"busy\",\n    avatar:\n      \"https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"ca\",\n    email: \"michael@meta.com\",\n    company: \"Meta\",\n    role: \"Designer\",\n    joined: \"Jun, 2022\",\n    location: \"Canada\",\n    balance: 7654.98,\n  },\n  {\n    id: \"4\",\n    name: \"Emma Wilson\",\n    availability: \"offline\",\n    avatar:\n      \"https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"au\",\n    email: \"emma@tesla.com\",\n    company: \"Tesla\",\n    role: \"Developer\",\n    joined: \"Sep, 2024\",\n    location: \"Australia\",\n    balance: 3456.45,\n  },\n  {\n    id: \"5\",\n    name: \"David Kim\",\n    availability: \"online\",\n    avatar:\n      \"https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"de\",\n    email: \"david@sap.com\",\n    company: \"SAP\",\n    role: \"Lawyer\",\n    joined: \"Nov, 2023\",\n    location: \"Germany\",\n    balance: 9876.54,\n  },\n  {\n    id: \"6\",\n    name: \"Aron Thompson\",\n    availability: \"away\",\n    avatar:\n      \"https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"my\",\n    email: \"aron@keenthemes.com\",\n    company: \"Keenthemes\",\n    role: \"Director\",\n    joined: \"Feb, 2022\",\n    location: \"Malaysia\",\n    balance: 6214.22,\n  },\n  {\n    id: \"7\",\n    name: \"James Brown\",\n    availability: \"busy\",\n    avatar:\n      \"https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"es\",\n    email: \"james@bbva.es\",\n    company: \"BBVA\",\n    role: \"Product Manager\",\n    joined: \"Aug, 2024\",\n    location: \"Spain\",\n    balance: 5321.77,\n  },\n  {\n    id: \"8\",\n    name: \"Maria Garcia\",\n    availability: \"offline\",\n    avatar:\n      \"https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"jp\",\n    email: \"maria@sony.jp\",\n    company: \"Sony\",\n    role: \"Marketing Lead\",\n    joined: \"Dec, 2023\",\n    location: \"Japan\",\n    balance: 8452.39,\n  },\n  {\n    id: \"9\",\n    name: \"Nick Johns
```

**File**: `public/r/styles/base-maia/c-data-grid-14.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"c-data-grid-14","type":"registry:block","title":"Data grid with draggable rows","description":"Data grid with draggable rows","dependencies":["@dnd-kit/core","@dnd-kit/sortable","@tanstack/react-table"],"registryDependencies":["avatar","@reui/data-grid","@reui/data-grid-pagination","@reui/data-grid-scroll-area","@reui/data-grid-table-dnd-rows"],"files":[{"path":"c-data-grid-14.tsx","type":"registry:block","content":"\"use client\"\n\nimport { useMemo, useState } from \"react\"\nimport Link from \"next/link\"\nimport {\n  DataGrid,\n  DataGridContainer,\n} from \"@/components/reui/data-grid/data-grid\"\nimport { DataGridPagination } from \"@/components/reui/data-grid/data-grid-pagination\"\nimport { DataGridScrollArea } from \"@/components/reui/data-grid/data-grid-scroll-area\"\nimport {\n  DataGridTableDndRowHandle,\n  DataGridTableDndRows,\n} from \"@/components/reui/data-grid/data-grid-table-dnd-rows\"\nimport { DragEndEvent, UniqueIdentifier } from \"@dnd-kit/core\"\nimport { arrayMove } from \"@dnd-kit/sortable\"\nimport {\n  ColumnDef,\n  getCoreRowModel,\n  getSortedRowModel,\n  useReactTable,\n} from \"@tanstack/react-table\"\n\nimport {\n  Avatar,\n  AvatarFallback,\n  AvatarImage,\n} from \"@/components/ui/avatar\"\n\ninterface IData {\n  id: string\n  name: string\n  availability: \"online\" | \"away\" | \"busy\" | \"offline\"\n  avatar: string\n  status: \"active\" | \"inactive\"\n  flag: string // Emoji flags\n  email: string\n  company: string\n  role: string\n  joined: string\n  location: string\n  balance: number\n}\n\nconst demoData: IData[] = [\n  {\n    id: \"1\",\n    name: \"Alex Johnson\",\n    availability: \"online\",\n    avatar:\n      \"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"us\",\n    email: \"alex@apple.com\",\n    company: \"Apple\",\n    role: \"CEO\",\n    joined: \"Jan, 2024\",\n    location: \"United States\",\n    balance: 5143.03,\n  },\n  {\n    id: \"2\",\n    name: \"Sarah Chen\",\n    availability: \"away\",\n    avatar:\n      \"https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"gb\",\n    email: \"sarah@openai.com\",\n    company: \"OpenAI\",\n    role: \"CTO\",\n    joined: \"Mar, 2023\",\n    location: \"United Kingdom\",\n    balance: 4321.87,\n  },\n  {\n    id: \"3\",\n    name: \"Michael Rodriguez\",\n    availability: \"busy\",\n    avatar:\n      \"https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"ca\",\n    email: \"michael@meta.com\",\n    company: \"Meta\",\n    role: \"Designer\",\n    joined: \"Jun, 2022\",\n    location: \"Canada\",\n    balance: 7654.98,\n  },\n  {\n    id: \"4\",\n    name: \"Emma Wilson\",\n    availability: \"offline\",\n    avatar:\n      \"https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"au\",\n    email: \"emma@tesla.com\",\n    company: \"Tesla\",\n    role: \"Developer\",\n    joined: \"Sep, 2024\",\n    location: \"Australia\",\n    balance: 3456.45,\n  },\n  {\n    id: \"5\",\n    name: \"David Kim\",\n    availability: \"online\",\n    avatar:\n      \"https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"de\",\n    email: \"david@sap.com\",\n    company: \"SAP\",\n    role: \"Lawyer\",\n    joined: \"Nov, 2023\",\n    location: \"Germany\",\n    balance: 9876.54,\n  },\n  {\n    id: \"6\",\n    name: \"Aron Thompson\",\n    availability: \"away\",\n    avatar:\n      \"https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"my\",\n    email: \"aron@keenthemes.com\",\n    company: \"Keenthemes\",\n    role: \"Director\",\n    joined: \"Feb, 2022\",\n    location: \"Malaysia\",\n    balance: 6214.22,\n  },\n]\n\nexport function Pattern() {\n  const columns = useMemo<ColumnDef<IData>[]>(\n    () => [\n      {\n        id: \"drag\",\n        cell: () => <DataGridTableDndRowHandle />,\n        size: 30,\n      },\n      {\n        accessorKey: \"name\",\n        id: \"name\",\n        header: \"Name\",\n        cell: ({ row }) => {\n          return (\n            <div className=\"flex items-center gap-2\">\n              <Avatar className=\"size-6\">\n                <AvatarImage\n                  src={row.original.avatar}\n                  alt={row.original.name}\n                />\n                <AvatarFallback>\n                  {row.original.name\n                    .split(\" \")\n                    .map((n) => n[0])\n                    .join(\"\")}\n                </AvatarFallback>\n              </Avatar>\n              <Link\n                href=\"#\"\n                className=\"text-foreground
```

**File**: `public/r/styles/base-mira/c-data-grid-10.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"c-data-grid-10","type":"registry:block","title":"Data grid with column icons","description":"Data grid with column icons","dependencies":["@tanstack/react-table"],"registryDependencies":["avatar","@reui/data-grid","@reui/data-grid-column-header","@reui/data-grid-pagination","@reui/data-grid-scroll-area","@reui/data-grid-table"],"files":[{"path":"c-data-grid-10.tsx","type":"registry:block","content":"\"use client\"\n\nimport { useMemo, useState } from \"react\"\nimport Link from \"next/link\"\nimport {\n  DataGrid,\n  DataGridContainer,\n} from \"@/components/reui/data-grid/data-grid\"\nimport { DataGridColumnHeader } from \"@/components/reui/data-grid/data-grid-column-header\"\nimport { DataGridPagination } from \"@/components/reui/data-grid/data-grid-pagination\"\nimport { DataGridScrollArea } from \"@/components/reui/data-grid/data-grid-scroll-area\"\nimport { DataGridTable } from \"@/components/reui/data-grid/data-grid-table\"\nimport {\n  ColumnDef,\n  getCoreRowModel,\n  getFilteredRowModel,\n  getPaginationRowModel,\n  getSortedRowModel,\n  PaginationState,\n  SortingState,\n  useReactTable,\n} from \"@tanstack/react-table\"\n\nimport {\n  Avatar,\n  AvatarFallback,\n  AvatarImage,\n} from \"@/components/ui/avatar\"\nimport { IconPlaceholder } from \"@/app/(create)/components/icon-placeholder\"\n\ninterface IData {\n  id: string\n  name: string\n  availability: \"online\" | \"away\" | \"busy\" | \"offline\"\n  avatar: string\n  status: \"active\" | \"inactive\"\n  flag: string // Emoji flags\n  email: string\n  company: string\n  role: string\n  joined: string\n  location: string\n  balance: number\n}\n\nconst demoData: IData[] = [\n  {\n    id: \"1\",\n    name: \"Alex Johnson\",\n    availability: \"online\",\n    avatar:\n      \"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"us\",\n    email: \"alex@apple.com\",\n    company: \"Apple\",\n    role: \"CEO\",\n    joined: \"Jan, 2024\",\n    location: \"United States\",\n    balance: 5143.03,\n  },\n  {\n    id: \"2\",\n    name: \"Sarah Chen\",\n    availability: \"away\",\n    avatar:\n      \"https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"gb\",\n    email: \"sarah@openai.com\",\n    company: \"OpenAI\",\n    role: \"CTO\",\n    joined: \"Mar, 2023\",\n    location: \"United Kingdom\",\n    balance: 4321.87,\n  },\n  {\n    id: \"3\",\n    name: \"Michael Rodriguez\",\n    availability: \"busy\",\n    avatar:\n      \"https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"ca\",\n    email: \"michael@meta.com\",\n    company: \"Meta\",\n    role: \"Designer\",\n    joined: \"Jun, 2022\",\n    location: \"Canada\",\n    balance: 7654.98,\n  },\n  {\n    id: \"4\",\n    name: \"Emma Wilson\",\n    availability: \"offline\",\n    avatar:\n      \"https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"au\",\n    email: \"emma@tesla.com\",\n    company: \"Tesla\",\n    role: \"Developer\",\n    joined: \"Sep, 2024\",\n    location: \"Australia\",\n    balance: 3456.45,\n  },\n  {\n    id: \"5\",\n    name: \"David Kim\",\n    availability: \"online\",\n    avatar:\n      \"https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"de\",\n    email: \"david@sap.com\",\n    company: \"SAP\",\n    role: \"Lawyer\",\n    joined: \"Nov, 2023\",\n    location: \"Germany\",\n    balance: 9876.54,\n  },\n  {\n    id: \"6\",\n    name: \"Aron Thompson\",\n    availability: \"away\",\n    avatar:\n      \"https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"my\",\n    email: \"aron@keenthemes.com\",\n    company: \"Keenthemes\",\n    role: \"Director\",\n    joined: \"Feb, 2022\",\n    location: \"Malaysia\",\n    balance: 6214.22,\n  },\n  {\n    id: \"7\",\n    name: \"James Brown\",\n    availability: \"busy\",\n    avatar:\n      \"https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"es\",\n    email: \"james@bbva.es\",\n    company: \"BBVA\",\n    role: \"Product Manager\",\n    joined: \"Aug, 2024\",\n    location: \"Spain\",\n    balance: 5321.77,\n  },\n  {\n    id: \"8\",\n    name: \"Maria Garcia\",\n    availability: \"offline\",\n    avatar:\n      \"https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"jp\",\n    email: \"maria@sony.jp\",\n    company: \"Sony\",\n    role: \"Marketing Lead\",\n    joined: \"Dec, 2023\",\n    location: \"Japan\",\n    balance: 8452.39,\n  },\n  {\n    id: \"9\",\n    name: \"Nick Johns
```

**File**: `public/r/styles/base-mira/c-data-grid-14.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"$schema":"https://ui.shadcn.com/schema/registry-item.json","name":"c-data-grid-14","type":"registry:block","title":"Data grid with draggable rows","description":"Data grid with draggable rows","dependencies":["@dnd-kit/core","@dnd-kit/sortable","@tanstack/react-table"],"registryDependencies":["avatar","@reui/data-grid","@reui/data-grid-pagination","@reui/data-grid-scroll-area","@reui/data-grid-table-dnd-rows"],"files":[{"path":"c-data-grid-14.tsx","type":"registry:block","content":"\"use client\"\n\nimport { useMemo, useState } from \"react\"\nimport Link from \"next/link\"\nimport {\n  DataGrid,\n  DataGridContainer,\n} from \"@/components/reui/data-grid/data-grid\"\nimport { DataGridPagination } from \"@/components/reui/data-grid/data-grid-pagination\"\nimport { DataGridScrollArea } from \"@/components/reui/data-grid/data-grid-scroll-area\"\nimport {\n  DataGridTableDndRowHandle,\n  DataGridTableDndRows,\n} from \"@/components/reui/data-grid/data-grid-table-dnd-rows\"\nimport { DragEndEvent, UniqueIdentifier } from \"@dnd-kit/core\"\nimport { arrayMove } from \"@dnd-kit/sortable\"\nimport {\n  ColumnDef,\n  getCoreRowModel,\n  getSortedRowModel,\n  useReactTable,\n} from \"@tanstack/react-table\"\n\nimport {\n  Avatar,\n  AvatarFallback,\n  AvatarImage,\n} from \"@/components/ui/avatar\"\n\ninterface IData {\n  id: string\n  name: string\n  availability: \"online\" | \"away\" | \"busy\" | \"offline\"\n  avatar: string\n  status: \"active\" | \"inactive\"\n  flag: string // Emoji flags\n  email: string\n  company: string\n  role: string\n  joined: string\n  location: string\n  balance: number\n}\n\nconst demoData: IData[] = [\n  {\n    id: \"1\",\n    name: \"Alex Johnson\",\n    availability: \"online\",\n    avatar:\n      \"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"us\",\n    email: \"alex@apple.com\",\n    company: \"Apple\",\n    role: \"CEO\",\n    joined: \"Jan, 2024\",\n    location: \"United States\",\n    balance: 5143.03,\n  },\n  {\n    id: \"2\",\n    name: \"Sarah Chen\",\n    availability: \"away\",\n    avatar:\n      \"https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"gb\",\n    email: \"sarah@openai.com\",\n    company: \"OpenAI\",\n    role: \"CTO\",\n    joined: \"Mar, 2023\",\n    location: \"United Kingdom\",\n    balance: 4321.87,\n  },\n  {\n    id: \"3\",\n    name: \"Michael Rodriguez\",\n    availability: \"busy\",\n    avatar:\n      \"https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"ca\",\n    email: \"michael@meta.com\",\n    company: \"Meta\",\n    role: \"Designer\",\n    joined: \"Jun, 2022\",\n    location: \"Canada\",\n    balance: 7654.98,\n  },\n  {\n    id: \"4\",\n    name: \"Emma Wilson\",\n    availability: \"offline\",\n    avatar:\n      \"https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80\",\n    status: \"inactive\",\n    flag: \"au\",\n    email: \"emma@tesla.com\",\n    company: \"Tesla\",\n    role: \"Developer\",\n    joined: \"Sep, 2024\",\n    location: \"Australia\",\n    balance: 3456.45,\n  },\n  {\n    id: \"5\",\n    name: \"David Kim\",\n    availability: \"online\",\n    avatar:\n      \"https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"de\",\n    email: \"david@sap.com\",\n    company: \"SAP\",\n    role: \"Lawyer\",\n    joined: \"Nov, 2023\",\n    location: \"Germany\",\n    balance: 9876.54,\n  },\n  {\n    id: \"6\",\n    name: \"Aron Thompson\",\n    availability: \"away\",\n    avatar:\n      \"https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80\",\n    status: \"active\",\n    flag: \"my\",\n    email: \"aron@keenthemes.com\",\n    company: \"Keenthemes\",\n    role: \"Director\",\n    joined: \"Feb, 2022\",\n    location: \"Malaysia\",\n    balance: 6214.22,\n  },\n]\n\nexport function Pattern() {\n  const columns = useMemo<ColumnDef<IData>[]>(\n    () => [\n      {\n        id: \"drag\",\n        cell: () => <DataGridTableDndRowHandle />,\n        size: 30,\n      },\n      {\n        accessorKey: \"name\",\n        id: \"name\",\n        header: \"Name\",\n        cell: ({ row }) => {\n          return (\n            <div className=\"flex items-center gap-2\">\n              <Avatar className=\"size-6\">\n                <AvatarImage\n                  src={row.original.avatar}\n                  alt={row.original.name}\n                />\n                <AvatarFallback>\n                  {row.original.name\n                    .split(\" \")\n                    .map((n) => n[0])\n                    .join(\"\")}\n                </AvatarFallback>\n              </Avatar>\n              <Link\n                href=\"#\"\n                className=\"text-foreground
```

---

### Incident Patch 11: `ea6518ef` (2026-03-21)
**Commit Message**: Merge branch 'main' of https://github.com/keenthemes/reui

**File**: `app/(app)/(root)/page.tsx` (modified, +2/-2)
```diff
@@ -8,9 +8,9 @@ import { Patterns } from "./components/patterns"
 import { Stats } from "./components/stats"
 import { WallOfLove } from "./components/wall-of-love"
 
-const title = "The Foundation for your Design System"
+const title = "Shadcn UI Patterns — 1,000+ Free React Components"
 const description =
-  "A set of beautifully designed components that you can customize, extend, and build on. Start here then make it your own. Open Source. Open Code."
+    "1,000+ free React components and patterns for shadcn/ui. Built with Next.js 15, Tailwind CSS v4, Radix UI and Base UI. Open source."
 
 export const dynamic = "force-static"
 export const revalidate = false
```

---

### Incident Patch 12: `69b6e1c0` (2026-03-19)
**Commit Message**: fix: announcement bar

**File**: `app/layout.tsx` (modified, +5/-4)
```diff
@@ -71,14 +71,15 @@ export const metadata: Metadata = {
   icons: {
     icon: [
       {
-        url: "/brand/logo-icon-dark.svg",
-        type: "image/svg+xml",
+        url: "/favicon.ico",
+        sizes: "any",
+        type: "image/x-icon",
       },
     ],
     shortcut: [
       {
-        url: "/brand/logo-icon-dark.svg",
-        type: "image/svg+xml",
+        url: "/favicon.ico",
+        type: "image/x-icon",
       },
     ],
   },
```

**File**: `app/manifest.ts` (modified, +6/-0)
```diff
@@ -13,6 +13,12 @@ export default function manifest(): MetadataRoute.Manifest {
     background_color: META_THEME_COLORS.light,
     theme_color: META_THEME_COLORS.dark,
     icons: [
+      {
+        src: "/favicon.ico",
+        sizes: "any",
+        type: "image/x-icon",
+        purpose: "any",
+      },
       {
         src: "/brand/logo-icon-dark.svg",
         sizes: "any",
```

**File**: `components/announcement-bar.tsx` (modified, +4/-2)
```diff
@@ -1,5 +1,6 @@
 "use client"
 
+import { ChevronRightIcon } from "lucide-react"
 import Link from "next/link"
 import { usePathname } from "next/navigation"
 
@@ -36,9 +37,10 @@ export function AnnouncementBar({
       {config.linkUrl ? (
         <Link
           href={config.linkUrl}
-          className="shrink-0 text-white underline underline-offset-4 transition-colors hover:text-white/80"
+          className="inline-flex items-center shrink-0 text-white underline underline-offset-4 transition-colors hover:text-white/80"
         >
-          {config.linkText || "Learn more"} &rsaquo;
+          {config.linkText || "Learn more"} 
+          <ChevronRightIcon className="size-3.5 mt-px" />
         </Link>
       ) : null}
     </div>
```

**File**: `components/site-header.tsx` (modified, +6/-6)
```diff
@@ -30,16 +30,16 @@ export function SiteHeader({ sticky = true }: { sticky?: boolean } = {}) {
             <Image
               src="/brand/logo-text-light.svg"
               alt={siteConfig.name}
-              width={75}
-              height={0}
-              className="shrink-0 dark:hidden"
+              width={269}
+              height={100}
+              className="h-auto w-[75px] shrink-0 dark:hidden"
             />
             <Image
               src="/brand/logo-text-dark.svg"
               alt={siteConfig.name}
-              width={75}
-              height={0}
-              className="hidden shrink-0 dark:inline-block"
+              width={269}
+              height={100}
+              className="hidden h-auto w-[75px] shrink-0 dark:inline-block"
             />
             <span className="sr-only">{siteConfig.name}</span>
           </Link>
```

---

### Incident Patch 13: `d6adebd3` (2026-03-19)
**Commit Message**: fix: og route

**File**: `app/layout.tsx` (modified, +17/-7)
```diff
@@ -15,6 +15,7 @@ import "@/styles/globals.css"
 
 const appUrl =
   process.env.NEXT_PUBLIC_APP_URL || siteConfig.url || "https://reui.io"
+const defaultOgImageUrl = `${appUrl}/og?title=${encodeURIComponent(siteConfig.name)}&description=${encodeURIComponent(siteConfig.description)}`
 
 export const metadata: Metadata = {
   title: {
@@ -53,9 +54,9 @@ export const metadata: Metadata = {
     siteName: siteConfig.name,
     images: [
       {
-        url: `${appUrl}/brand/logo-default.png`,
+        url: defaultOgImageUrl,
         width: 1200,
-        height: 630,
+        height: 628,
         alt: siteConfig.name,
       },
     ],
@@ -64,15 +65,24 @@ export const metadata: Metadata = {
     card: "summary_large_image",
     title: siteConfig.name,
     description: siteConfig.description,
-    images: [`${appUrl}/brand/logo-default.png`],
+    images: [defaultOgImageUrl],
     creator: "@reui_io",
   },
   icons: {
-    icon: "/favicon.ico",
-    shortcut: "/brand/logo-default.png",
-    apple: "/brand/logo-default.png",
+    icon: [
+      {
+        url: "/brand/logo-icon-dark.svg",
+        type: "image/svg+xml",
+      },
+    ],
+    shortcut: [
+      {
+        url: "/brand/logo-icon-dark.svg",
+        type: "image/svg+xml",
+      },
+    ],
   },
-  manifest: `${siteConfig.url}/site.webmanifest`,
+  manifest: "/manifest.webmanifest",
 }
 
 export default function RootLayout({
```

**File**: `app/manifest.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import type { MetadataRoute } from "next"
+
+import { META_THEME_COLORS, siteConfig } from "@/lib/config"
+
+export default function manifest(): MetadataRoute.Manifest {
+  return {
+    name: siteConfig.name,
+    short_name: siteConfig.name,
+    description: siteConfig.description,
+    start_url: "/",
+    scope: "/",
+    display: "standalone",
+    background_color: META_THEME_COLORS.light,
+    theme_color: META_THEME_COLORS.dark,
+    icons: [
+      {
+        src: "/brand/logo-icon-dark.svg",
+        sizes: "any",
+        type: "image/svg+xml",
+        purpose: "any",
+      },
+    ],
+  }
+}
```

**File**: `app/og/route.tsx` (modified, +19/-13)
```diff
@@ -1,10 +1,16 @@
 import { ImageResponse } from "next/og"
 
-// Force Node.js runtime to avoid edge function execution billing
-export const runtime = "nodejs"
+import { siteConfig } from "@/lib/config"
+
+export const runtime = "edge"
+
+function decodeBase64Font(base64Font: string) {
+  const binary = atob(base64Font)
+  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
+}
 
 async function loadAssets(): Promise<
-  { name: string; data: Buffer; weight: 400 | 600; style: "normal" }[]
+  { name: string; data: Uint8Array; weight: 400 | 600; style: "normal" }[]
 > {
   const [
     { base64Font: normal },
@@ -19,19 +25,19 @@ async function loadAssets(): Promise<
   return [
     {
       name: "Geist",
-      data: Buffer.from(normal, "base64"),
+      data: decodeBase64Font(normal),
       weight: 400 as const,
       style: "normal" as const,
     },
     {
       name: "Geist Mono",
-      data: Buffer.from(mono, "base64"),
+      data: decodeBase64Font(mono),
       weight: 400 as const,
       style: "normal" as const,
     },
     {
       name: "Geist",
-      data: Buffer.from(semibold, "base64"),
+      data: decodeBase64Font(semibold),
       weight: 600 as const,
       style: "normal" as const,
     },
@@ -40,15 +46,15 @@ async function loadAssets(): Promise<
 
 export async function GET(request: Request) {
   const { searchParams } = new URL(request.url)
-  const title = searchParams.get("title")
-  const description = searchParams.get("description")
+  const title = searchParams.get("title") || siteConfig.name
+  const description = searchParams.get("description") || siteConfig.description
 
   const [fonts] = await Promise.all([loadAssets()])
 
   const response = new ImageResponse(
     <div
       tw="flex h-full w-full bg-black text-white"
-      style={{ fontFamily: "Geist Sans" }}
+      style={{ fontFamily: "Geist" }}
     >
       <div tw="flex border absolute border-stone-700 border-dashed inset-y-0 left-2 w-px" />
       <div tw="flex border absolute border-stone-700 border-dashed inset-y-0 right-2 w-px" />
@@ -64,15 +70,15 @@ export async function GET(request: Request) {
         >
           <path
             opacity="0.2"
-            fill-rule="evenodd"
-            clip-rule="evenodd"
+            fillRule="evenodd"
+            clipRule="evenodd"
             d="M67.1667 3.98153H33.8333C17.548 3.98153 4.34615 17.1834 4.34615 33.4687V66.802C4.34615 83.0874 17.548 96.2892 33.8333 96.2892H67.1667C83.452 96.2892 96.6538 83.0874 96.6538 66.802V33.4687C96.6538 17.1834 83.452 3.98153 67.1667 3.98153ZM33.8333 0.135376C15.4238 0.135376 0.5 15.0592 0.5 33.4687V66.802C0.5 85.2115 15.4238 100.135 33.8333 100.135H67.1667C85.5762 100.135 100.5 85.2115 100.5 66.802V33.4687C100.5 15.0592 85.5762 0.135376 67.1667 0.135376H33.8333Z"
             fill="white"
           />
           <circle cx="70.634" cy="29.8334" r="4.69799" fill="white" />
           <path
-            fill-rule="evenodd"
-            clip-rule="evenodd"
+            fillRule="evenodd"
+            clipRule="evenodd"
             d="M25.668 57.0144V29.8332C25.668 27.2385 27.7713 25.1352 30.366 25.1352V25.1352C32.9606 25.1352 35.0639 27.2385 35.0639 29.8332V57.0144C35.0639 61.833 38.9702 65.7392 43.7888 65.7392H57.2116C62.0302 65.7392 65.9364 61.833 65.9364 57.0144V43.7258C65.9364 41.1312 68.0398 39.0278 70.6344 39.0278V39.0278C73.229 39.0278 75.3324 41.1312 75.3324 43.7258V57.0144C75.3324 67.0222 67.2194 75.1352 57.2116 75.1352H43.7888C33.7809 75.1352 25.668 67.0222 25.668 57.0144Z"
             fill="white"
           />
```

---

### Incident Patch 14: `85541494` (2026-03-17)
**Commit Message**: Merge branch 'main' of https://github.com/keenthemes/reui

**File**: `registry-reui/bases/radix/reui/sortable.tsx` (modified, +22/-15)
```diff
@@ -27,7 +27,8 @@ import {
   KeyboardSensor,
   MeasuringStrategy,
   Modifiers,
-  PointerSensor,
+  MouseSensor,
+  TouchSensor,
   UniqueIdentifier,
   useSensor,
   useSensors,
@@ -124,11 +125,17 @@ function Sortable<T>({
   useLayoutEffect(() => setMounted(true), [])
 
   const sensors = useSensors(
-    useSensor(PointerSensor, {
+    useSensor(MouseSensor, {
       activationConstraint: {
         distance: 10,
       },
     }),
+    useSensor(TouchSensor, {
+      activationConstraint: {
+        delay: 250,
+        tolerance: 5,
+      },
+    }),
     useSensor(KeyboardSensor, {
       coordinateGetter: sortableKeyboardCoordinates,
     })
@@ -268,6 +275,19 @@ function SortableItem({
 }: SortableItemProps) {
   const isOverlay = useContext(IsOverlayContext)
 
+  const {
+    setNodeRef,
+    transform,
+    transition,
+    attributes,
+    listeners,
+    isDragging: isSortableDragging,
+  } = useSortable({
+    id: value,
+    disabled: disabled || isOverlay,
+    animateLayoutChanges,
+  })
+
   if (isOverlay) {
     const Comp = asChild ? Slot.Root : "div"
 
@@ -288,19 +308,6 @@ function SortableItem({
     )
   }
 
-  const {
-    setNodeRef,
-    transform,
-    transition,
-    attributes,
-    listeners,
-    isDragging: isSortableDragging,
-  } = useSortable({
-    id: value,
-    disabled,
-    animateLayoutChanges,
-  })
-
   const style = {
     transition,
     transform: CSS.Transform.toString(transform),
```

---

### Incident Patch 15: `af1e1b5e` (2026-03-17)
**Commit Message**: Merge pull request #82 from Yousran/sortable-fix-branch

fix: improve drag handling on mobile display

**File**: `registry-reui/bases/radix/reui/sortable.tsx` (modified, +22/-15)
```diff
@@ -27,7 +27,8 @@ import {
   KeyboardSensor,
   MeasuringStrategy,
   Modifiers,
-  PointerSensor,
+  MouseSensor,
+  TouchSensor,
   UniqueIdentifier,
   useSensor,
   useSensors,
@@ -124,11 +125,17 @@ function Sortable<T>({
   useLayoutEffect(() => setMounted(true), [])
 
   const sensors = useSensors(
-    useSensor(PointerSensor, {
+    useSensor(MouseSensor, {
       activationConstraint: {
         distance: 10,
       },
     }),
+    useSensor(TouchSensor, {
+      activationConstraint: {
+        delay: 250,
+        tolerance: 5,
+      },
+    }),
     useSensor(KeyboardSensor, {
       coordinateGetter: sortableKeyboardCoordinates,
     })
@@ -268,6 +275,19 @@ function SortableItem({
 }: SortableItemProps) {
   const isOverlay = useContext(IsOverlayContext)
 
+  const {
+    setNodeRef,
+    transform,
+    transition,
+    attributes,
+    listeners,
+    isDragging: isSortableDragging,
+  } = useSortable({
+    id: value,
+    disabled: disabled || isOverlay,
+    animateLayoutChanges,
+  })
+
   if (isOverlay) {
     const Comp = asChild ? Slot.Root : "div"
 
@@ -288,19 +308,6 @@ function SortableItem({
     )
   }
 
-  const {
-    setNodeRef,
-    transform,
-    transition,
-    attributes,
-    listeners,
-    isDragging: isSortableDragging,
-  } = useSortable({
-    id: value,
-    disabled,
-    animateLayoutChanges,
-  })
-
   const style = {
     transition,
     transform: CSS.Transform.toString(transform),
```

#### Recent Merged Pull Requests:
- **PR #145** (closed): feat(time-picker): add composable and accessible TimePicker component (@focus0802)
- **PR #141** (closed): feat(cascader): add searchScope="global" for whole-tree search (@rumeshudash)
- **PR #139** (closed): fix(cascader): show empty state in inline panels (@focus0802)
- **PR #135** (closed): fix(cascader): avoid compiler memoizing virtual rows (@focus0802)
- **PR #133** (closed): fix(event-calendar): add margin for time-grid (@eden-lane)
- **PR #128** (closed): fix(data-grid): support adaptive and wrapped pagination (@focus0802)
- **PR #127** (closed): docs(data-grid): add server-side data example (@LouisDeconinck)
- **PR #125** (closed): fix(data-grid): add adaptive pagination window (@focus0802)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
