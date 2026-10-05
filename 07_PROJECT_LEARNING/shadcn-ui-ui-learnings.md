# Forensic Learning Record (Deep Inspection): shadcn-ui/ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/shadcn-ui-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/shadcn-ui/ui](https://github.com/shadcn-ui/ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:16:36.206Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `shadcn-ui/ui`
- **Description**: Composable, accessible components with thoughtful defaults. Build your own component library with code you can customize, extend, and make your own.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 125150 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/v4/app/(app)/(create)/hooks/use-action-menu.ts`
```
"use client"

import * as React from "react"
import { type RegistryItem } from "shadcn/schema"
import useSWR from "swr"

import { useDesignSystemSearchParams } from "@/app/(app)/(create)/lib/search-params"
import { groupItemsByType } from "@/app/(app)/(create)/lib/utils"

const ACTION_MENU_OPEN_KEY = "create:action-menu-open"

type ActionMenuItem = {
  id: string
  type: string
  label: string
  registryName: string
}

type ActionMenuGroup = {
  type: string
  title: string
  items: ActionMenuItem[]
}

type ActionMenuSourceItem = Pick<RegistryItem, "name" | "title" | "type">

const SEARCH_KEYWORDS: Record<string, string> = {
  "registry:block": "block blocks component components",
  "registry:item": "item items component components",
}

function sortRegistryGroups(groups: ReturnType<typeof groupItemsByType>) {
  return [...groups].sort((a, b) => {
    if (a.type === b.type) {
      return a.title.localeCompare(b.title)
    }
    if (a.type === "registry:block") {
      return -1
    }
    if (b.type === "registry:block") {
      return 1
    }
    return a.title.localeCompare(b.title)
  })
}

export function useActionMenu(
  itemsByBase: Record<string, ActionMenuSourceItem[]>
) {
  const [params, setParams] = useDesignSystemSearchParams()
  const { data: open = false, mutate: setOpenData } = useSWR<boolean>(
    ACTION_MENU_OPEN_KEY,
    {
      fallbackData: false,
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
    }
  )

  const groups = React.useMemo<ActionMenuGroup[]>(() => {
    const currentBaseItems = itemsByBase?.[params.base] ?? []
    const sortedRegistryGroups = sortRegistryGroups(
      groupItemsByType(currentBaseItems)
    )

    return sortedRegistryGroups.map((group) => ({
      type: group.type,
      title: group.title,
      items: group.items.map((item) => ({
        id: `${group.type}:${item.name}`,
        type: group.type,
        label: item.title ?? item.name,
        registryName: item.name,
      })),
    }))
  }, [itemsByBase, params.base])

  const activeRegistryName = params.item

  const handleSelect = React.useCallback(
    (registryName: string) => {
      setParams({ item: registryName })
      void setOpenData(false, { revalidate: false })
    },
    [setOpenData, setParams]
  )

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      void setOpenData(nextOpen, { revalidate: false })
    },
    [setOpenData]
  )

  const getCommandValue = React.useCallback((item: ActionMenuItem) => {
    const keywords = SEARCH_KEYWORDS[item.type] ?? item.type.replace(":", " ")
    return `${item.label ?? ""} ${keywords}`.trim()
  }, [])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "p" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        void setOpenData((currentOpen = false) => !currentOpen, {
          revalidate: false,
        })
      }
    }

    document.addEventListener("keydown", down)
    return () => {
      document.removeEventListener("keydown", down)
    }
  }, [setOpenData])

  return {
    activeRegistryName,
    getCommandValue,
    groups,
    handleSelect,
    open,
    setOpen: handleOpenChange,
  }
}

export function useActionMenuTrigger() {
  const { mutate: setOpenData } = useSWR<boolean>(ACTION_MENU_OPEN_KEY, {
    fallbackData: false,
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
  })

  const openActionMenu = React.useCallback(() => {
    void setOpenData(true, { revalidate: false })
  }, [setOpenData])

  return {
    openActionMenu,
  }
}

```

### Core Architecture Module: `apps/v4/app/(app)/(create)/hooks/use-design-system.ts`
```
"use client"

import { getPresetCode } from "@/app/(app)/(create)/lib/preset-code"
import { useDesignSystemSearchParams } from "@/app/(app)/(create)/lib/search-params"

// Returns the canonical preset code derived from the current search params.
export function usePresetCode() {
  const [params] = useDesignSystemSearchParams()

  return getPresetCode(params)
}

```

### Core Architecture Module: `apps/v4/app/(app)/(create)/hooks/use-history.tsx`
```
"use client"

import * as React from "react"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import {
  useDesignSystemSearchParams,
  type DesignSystemSearchParams,
} from "@/app/(app)/(create)/lib/search-params"

type HistoryContextValue = {
  canGoBack: boolean
  canGoForward: boolean
  goBack: () => void
  goForward: () => void
}

const HistoryContext = React.createContext<HistoryContextValue | null>(null)

// Reads useSearchParams() in its own Suspense boundary so the
// provider never blanks out children while search params resolve.
// useSearchParams reflects the *settled* preset, which coalesces the
// transient values nuqs emits mid-update — reading nuqs state directly
// here would record those transients as phantom history entries.
function PresetSync({
  onPresetChange,
}: {
  onPresetChange: (preset: string) => void
}) {
  const searchParams = useSearchParams()
  const preset = searchParams.get("preset") ?? ""

  React.useEffect(() => {
    onPresetChange(preset)
  }, [preset, onPresetChange])

  return null
}

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  // Write through the shared search-params hook (shallow) instead of
  // router.replace. router.replace triggers a full server navigation that
  // resets the preset on prod — the same failure the customizer avoids by
  // going shallow (#11060).
  const [, setParams] = useDesignSystemSearchParams()

  const [preset, setPreset] = React.useState("")

  const entriesRef = React.useRef<string[]>([preset])
  const indexRef = React.useRef(0)
  const maxIndexRef = React.useRef(0)
  const isNavigatingRef = React.useRef(false)

  const [index, setIndex] = React.useState(0)
  const [maxIndex, setMaxIndex] = React.useState(0)

  const onPresetChange = React.useCallback((nextPreset: string) => {
    setPreset(nextPreset)
  }, [])

  React.useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false
      return
    }

    if (preset === entriesRef.current[indexRef.current]) {
      return
    }

    const nextEntries = entriesRef.current.slice(0, indexRef.current + 1)
    nextEntries.push(preset)
    entriesRef.current = nextEntries

    const nextIndex = nextEntries.length - 1
    indexRef.current = nextIndex
    maxIndexRef.current = nextIndex
    setIndex(nextIndex)
    setMaxIndex(nextIndex)
  }, [preset])

  const canGoBack = index > 0
  const canGoForward = index < maxIndex

  const goBack = React.useCallback(() => {
    if (indexRef.current <= 0) {
      return
    }

    isNavigatingRef.current = true
    const nextIndex = indexRef.current - 1
    indexRef.current = nextIndex
    setIndex(nextIndex)

    // The first history entry is "" (no preset in the URL); null clears the
    // param to restore that state. nuqs accepts null to clear a key, which the
    // wrapper's input type does not model.
    setParams(
      {
        preset: entriesRef.current[nextIndex] || null,
      } as Partial<DesignSystemSearchParams>,
      { history: "replace" }
    )
  }, [setParams])

  const goForward = React.useCallback(() => {
    if (indexRef.current >= maxIndexRef.current) {
      return
    }

    isNavigatingRef.current = true
    const nextIndex = indexRef.current + 1
    indexRef.current = nextIndex
    setIndex(nextIndex)

    // The first history entry is "" (no preset in the URL); null clears the
    // param to restore that state. nuqs accepts null to clear a key, which the
    // wrapper's input type does not model.
    setParams(
      {
        preset: entriesRef.current[nextIndex] || null,
      } as Partial<DesignSystemSearchParams>,
      { history: "replace" }
    )
  }, [setParams])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) {
        return
      }

      if (
        (e.target instanceof HTMLElement && e.target.isContentEditable) ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      const key = e.key.toLowerCase()

      if ((key === "z" && e.shiftKey) || (key === "y" && e.ctrlKey)) {
        e.preventDefault()
        goForward()
        return
      }

      if (key === "z") {
        e.preventDefault()
        goBack()
      }
    }

    document.addEventListener("keydown", down)

    return () => {
      document.removeEventListener("keydown", down)
    }
  }, [goBack, goForward])

  const value = React.useMemo(
    () => ({ canGoBack, canGoForward, goBack, goForward }),
    [canGoBack, canGoForward, goBack, goForward]
  )

  return (
    <HistoryContext value={value}>
      <Suspense>
        <PresetSync onPresetChange={onPresetChange} />
      </Suspense>
      {children}
    </HistoryContext>
  )
}

export function useHistory() {
  const context = React.useContext(HistoryContext)
  if (!context) {
    throw new Error("useHistory must be used within HistoryProvider")
  }
  return context
}

```

### Core Architecture Module: `apps/v4/app/(app)/(create)/hooks/use-iframe-sync.tsx`
```
"use client"

import * as React from "react"

import type { DesignSystemSearchParams } from "@/app/(app)/(create)/lib/search-params"

type ParentToIframeMessage = {
  type: "design-system-params"
  data: DesignSystemSearchParams
}

export const isInIframe = () => {
  if (typeof window === "undefined") {
    return false
  }
  return window.self !== window.top
}

export function useIframeMessageListener<
  Message extends ParentToIframeMessage,
  MessageType extends Message["type"],
>(
  messageType: MessageType,
  onMessage: (data: Extract<Message, { type: MessageType }>["data"]) => void
) {
  const onMessageRef = React.useRef(onMessage)

  React.useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  React.useEffect(() => {
    if (!isInIframe()) {
      return
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === messageType) {
        onMessageRef.current(event.data.data)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [messageType])
}

export function sendToIframe<
  Message extends ParentToIframeMessage,
  MessageType extends Message["type"],
>(
  iframe: HTMLIFrameElement | null,
  messageType: MessageType,
  data: Extract<Message, { type: MessageType }>["data"]
) {
  if (!iframe?.contentWindow) {
    return
  }

  iframe.contentWindow.postMessage(
    {
      type: messageType,
      data,
    },
    "*"
  )
}

```

### Core Architecture Module: `apps/v4/app/(app)/(create)/hooks/use-locks.tsx`
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

### Core Architecture Module: `apps/v4/app/(app)/(create)/hooks/use-open-preset.tsx`
```
"use client"

import * as React from "react"
import useSWR from "swr"

const OPEN_PRESET_KEY = "create:open-preset-open"
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
  const { data: open = false, mutate: setOpenData } = useSWR<boolean>(
    OPEN_PRESET_KEY,
    {
      fallbackData: false,
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
    }
  )

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      void setOpenData(nextOpen, { revalidate: false })
    },
    [setOpenData]
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
        if (isEditableTarget(e.target)) {
          return
        }

        e.preventDefault()
        void setOpenData(true, { revalidate: false })
      }
    }

    document.addEventListener("keydown", down)
    return () => {
      document.removeEventListener("keydown", down)
    }
  }, [setOpenData])

  return {
    open,
    setOpen: handleOpenChange,
  }
}

export function useOpenPresetTrigger() {
  const { mutate: setOpenData } = useSWR<boolean>(OPEN_PRESET_KEY, {
    fallbackData: false,
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
  })

  const openPreset = React.useCallback(() => {
    void setOpenData(true, { revalidate: false })
  }, [setOpenData])

  return {
    openPreset,
  }
}

```

### Core Architecture Module: `apps/v4/app/(app)/(create)/hooks/use-random.tsx`
```
"use client"

import * as React from "react"
import { decodePreset } from "shadcn/preset"

import {
  BASE_COLORS,
  getThemesForBaseColor,
  iconLibraries,
  MENU_ACCENTS,
  MENU_COLORS,
  RADII,
  STYLES,
  type BaseColorName,
  type ChartColorName,
  type FontHeadingValue,
  type FontValue,
  type IconLibraryName,
  type MenuAccentValue,
  type MenuColorValue,
  type RadiusValue,
  type StyleName,
  type ThemeName,
} from "@/registry/config"
import { useLocks } from "@/app/(app)/(create)/hooks/use-locks"
import { FONTS } from "@/app/(app)/(create)/lib/fonts"
import { getPresetCode } from "@/app/(app)/(create)/lib/preset-code"
import {
  applyBias,
  RANDOMIZE_BIASES,
  type RandomizeContext,
} from "@/app/(app)/(create)/lib/randomize-biases"
import {
  isTranslucentMenuColor,
  useDesignSystemSearchParams,
} from "@/app/(app)/(create)/lib/search-params"
import { SHUFFLE_PRESETS } from "@/app/(app)/(create)/lib/shuffle-presets"

function randomItem<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

export function useRandom() {
  const { locks } = useLocks()
  const [params, setParams] = useDesignSystemSearchParams()

  const paramsRef = React.useRef(params)
  React.useEffect(() => {
    paramsRef.current = params
  }, [params])

  // True-random implementation. Kept, but shuffle is now wired to the
  // curated preset list below.
  const randomizeTrueRandom = React.useCallback(() => {
    const selectedStyle = locks.has("style")
      ? paramsRef.current.style
      : randomItem(STYLES).name

    const context: RandomizeContext = {
      style: selectedStyle,
    }

    const availableBaseColors = applyBias(
      BASE_COLORS,
      context,
      RANDOMIZE_BIASES.baseColors
    )
    const baseColor = locks.has("baseColor")
      ? paramsRef.current.baseColor
      : randomItem(availableBaseColors).name
    context.baseColor = baseColor

    const availableThemes = getThemesForBaseColor(baseColor)
    const availableFonts = applyBias(FONTS, context, RANDOMIZE_BIASES.fonts)
    const availableRadii = applyBias(RADII, context, RANDOMIZE_BIASES.radius)

    const selectedTheme = locks.has("theme")
      ? paramsRef.current.theme
      : randomItem(availableThemes).name
    context.theme = selectedTheme

    const availableChartColors = applyBias(
      getThemesForBaseColor(baseColor),
      context,
      RANDOMIZE_BIASES.chartColors
    )
    const selectedChartColor = locks.has("chartColor")
      ? paramsRef.current.chartColor
      : randomItem(availableChartColors).name
    context.chartColor = selectedChartColor
    const selectedFont = locks.has("font")
      ? paramsRef.current.font
      : randomItem(availableFonts).value
    context.font = selectedFont

    // Pick heading font: ~70% inherit, ~30% distinct with cross-category contrast.
    let selectedFontHeading: FontHeadingValue
    if (locks.has("fontHeading")) {
      selectedFontHeading = paramsRef.current.fontHeading
    } else if (Math.random() < 0.7) {
      selectedFontHeading = "inherit"
    } else {
      const bodyType = availableFonts.find(
        (f) => f.value === selectedFont
      )?.type
      const contrastFonts = availableFonts.filter(
        (f) => f.type !== bodyType && f.value !== selectedFont
      )
      selectedFontHeading = (
        contrastFonts.length > 0
          ? randomItem(contrastFonts)
          : randomItem(availableFonts)
      ).value as FontHeadingValue
    }
    const selectedRadius = locks.has("radius")
      ? paramsRef.current.radius
      : randomItem(availableRadii).name
    const selectedIconLibrary = locks.has("iconLibrary")
      ? paramsRef.current.iconLibrary
      : randomItem(Object.values(iconLibraries)).name
    const lockedMenuAccent = locks.has("menuAccent")
      ? paramsRef.current.menuAccent
      : undefined
    const availableMenuColors =
      !locks.has("menuColor") && lockedMenuAccent === "bold"
        ? MENU_COLORS.filter((menuColor) => {
            return !isTranslucentMenuColor(menuColor.value)
          })
        : MENU_COLORS
    const selectedMenuColor = locks.has("menuColor")
      ? paramsRef.current.menuColor
      : randomItem(availableMenuColors).value
    const selectedMenuAccent =
      locks.has("menuAccent") || isTranslucentMenuColor(selectedMenuColor)
        ? paramsRef.current.menuAccent === "bold" &&
          isTranslucentMenuColor(selectedMenuColor)
          ? "subtle"
          : paramsRef.current.menuAccent
        : randomItem(MENU_ACCENTS).value

    context.radius = selectedRadius

    const nextParams = {
      style: selectedStyle,
      baseColor,
      theme: selectedTheme,
      chartColor: selectedChartColor,
      iconLibrary: selectedIconLibrary,
      font: selectedFont,
      fontHeading: selectedFontHeading,
      menuAccent: selectedMenuAccent,
      menuColor: selectedMenuColor,
      radius: selectedRadius,
    }

    // Keep the ref in sync so rapid repeats use the latest randomized state
    // even before the URL state finishes committing.
    paramsRef.current = {
      ...paramsRef.current,
      ...nextParams,
    }

    setParams(nextParams)
  }, [setParams, locks])

  // Picks a random preset from the curated list instead of true random.
  // Locked params are preserved over the decoded preset values.
  const randomize = React.useCallback(() => {
    // Avoid re-picking the preset that is currently applied.
    const currentCode = getPresetCode(paramsRef.current)
    const availableCodes = SHUFFLE_PRESETS.filter(
      (code) => code !== currentCode
    )
    const decoded = decodePreset(
      randomItem(availableCodes.length > 0 ? availableCodes : SHUFFLE_PRESETS)
    )

    if (!decoded) {
      return
    }

    const current = paramsRef.current
    const nextParams = {
      style: locks.has("style") ? current.style : (decoded.style as StyleName),
      baseColor: locks.has("baseColor")
        ? current.baseColor
        : (decoded.baseColor as BaseColorName),
      theme: locks.has("theme") ? current.theme : (decoded.theme as ThemeName),
      chartColor: locks.has("chartColor")
        ? current.chartColor
        : ((decoded.chartColor ?? decoded.theme) as ChartColorName),
      iconLibrary: locks.has("iconLibrary")
        ? current.iconLibrary
        : (decoded.iconLibrary as IconLibraryName),
      font: locks.has("font") ? current.font : (decoded.font as FontValue),
      fontHeading: locks.has("fontHeading")
        ? current.fontHeading
        : (decoded.fontHeading as FontHeadingValue),
      menuAccent: locks.has("menuAccent")
        ? current.menuAccent
        : (decoded.menuAccent as MenuAccentValue),
      menuColor: locks.has("menuColor")
        ? current.menuColor
        : (decoded.menuColor as MenuColorValue),
      radius: locks.has("radius")
        ? current.radius
        : (decoded.radius as RadiusValue),
    }

    // Keep the ref in sync so rapid repeats use the latest randomized state
    // even before the URL state finishes committing.
    paramsRef.current = {
      ...paramsRef.current,
      ...nextParams,
    }

    setParams(nextParams)
  }, [setParams, locks])

  const randomizeRef = React.useRef(randomize)
  React.useEffect(() => {
    randomizeRef.current = randomize
  }, [randomize])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "r" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return
        }

        e.preventDefault()
        randomizeRef.current()
      }
    }

    document.addEventListener("keydown", down)
    return () => {
      document.removeEventListener("keydown", down)
    }
  }, [])

  return { randomize, randomizeTrueRandom }
}

```

### Core Architecture Module: `apps/v4/app/(app)/(create)/hooks/use-reset.tsx`
```
"use client"

import * as React from "react"
import useSWR from "swr"

import { DEFAULT_CONFIG, PRESETS } from "@/registry/config"
import { useDesignSystemSearchParams } from "@/app/(app)/(create)/lib/search-params"

const RESET_DIALOG_KEY = "create:reset-dialog-open"
export const RESET_FORWARD_TYPE = "reset-forward"

export function useReset() {
  const [params, setParams] = useDesignSystemSearchParams()
  const { data: showResetDialog = false, mutate: setShowResetDialogData } =
    useSWR<boolean>(RESET_DIALOG_KEY, {
      fallbackData: false,
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
    })

  const reset = React.useCallback(() => {
    const preset =
      PRESETS.find(
        (preset) => preset.base === params.base && preset.style === params.style
      ) ?? DEFAULT_CONFIG

    setParams({
      base: params.base,
      style: params.style,
      baseColor: preset.baseColor,
      theme: preset.theme,
      chartColor: preset.chartColor,
      iconLibrary: preset.iconLibrary,
      font: preset.font,
      fontHeading: preset.fontHeading,
      menuAccent: preset.menuAccent,
      menuColor: preset.menuColor,
      radius: preset.radius,
      template: DEFAULT_CONFIG.template,
      item: params.item,
    })
  }, [setParams, params.base, params.style, params.item])

  const handleShowResetDialogChange = React.useCallback(
    (open: boolean) => {
      void setShowResetDialogData(open, { revalidate: false })
    },
    [setShowResetDialogData]
  )

  const confirmReset = React.useCallback(() => {
    reset()
    void setShowResetDialogData(false, { revalidate: false })
  }, [reset, setShowResetDialogData])

  const showResetDialogRef = React.useRef(showResetDialog)
  React.useEffect(() => {
    showResetDialogRef.current = showResetDialog
  }, [showResetDialog])

  const confirmResetRef = React.useRef(confirmReset)
  React.useEffect(() => {
    confirmResetRef.current = confirmReset
  }, [confirmReset])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "R" && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return
        }

        e.preventDefault()

        // If the dialog is already open, confirm the reset.
        if (showResetDialogRef.current) {
          confirmResetRef.current()
          return
        }

        handleShowResetDialogChange(true)
      }
    }

    document.addEventListener("keydown", down)
    return () => {
      document.removeEventListener("keydown", down)
    }
  }, [handleShowResetDialogChange])

  return {
    reset,
    showResetDialog,
    setShowResetDialog: handleShowResetDialogChange,
    confirmReset,
  }
}

```

### Core Architecture Module: `apps/v4/app/(app)/(create)/hooks/use-theme-toggle.tsx`
```
"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { useMetaColor } from "@/hooks/use-meta-color"

export function useThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const { setMetaColor, metaColor } = useMetaColor()

  React.useEffect(() => {
    setMetaColor(metaColor)
  }, [metaColor, setMetaColor])

  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }, [resolvedTheme, setTheme])

  // Listen for the D key to toggle theme.
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        (e.key === "d" || e.key === "D") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return
        }

        e.preventDefault()
        toggleTheme()
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [toggleTheme])

  return { toggleTheme }
}

```

### Core Architecture Module: `apps/v4/app/(app)/(create)/lib/utils.ts`
```
import { type RegistryItem } from "shadcn/schema"

const mapping = {
  "registry:block": "Blocks",
  "registry:example": "Components",
}

export function groupItemsByType(
  items: Pick<RegistryItem, "name" | "title" | "type">[]
) {
  const grouped = items.reduce(
    (acc, item) => {
      acc[item.type] = [...(acc[item.type] || []), item]
      return acc
    },
    {} as Record<string, Pick<RegistryItem, "name" | "title" | "type">[]>
  )

  return Object.entries(grouped)
    .map(([type, items]) => ({
      type,
      title: mapping[type as keyof typeof mapping] || type,
      items,
    }))
    .sort((a, b) => {
      const aIndex = Object.keys(mapping).indexOf(a.type)
      const bIndex = Object.keys(mapping).indexOf(b.type)

      // If both are in mapping, sort by their order.
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex
      }
      // If only a is in mapping, it comes first.
      if (aIndex !== -1) {
        return -1
      }
      // If only b is in mapping, it comes first.
      if (bIndex !== -1) {
        return 1
      }
      // If neither is in mapping, maintain original order.
      return 0
    })
}

```

### Core Architecture Module: `apps/v4/app/(app)/(styles)/sera/empty-state/components/empty-directory.tsx`
```
import { FileTextIcon, PlusIcon } from "lucide-react"

import { Badge } from "@/styles/base-sera/ui/badge"
import { Button } from "@/styles/base-sera/ui/button"
import { Card, CardContent } from "@/styles/base-sera/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/styles/base-sera/ui/empty"
import { Separator } from "@/styles/base-sera/ui/separator"

type Stage = {
  id: string
  label: string
  description: string
  dotClassName: string
}

const STAGES: Stage[] = [
  {
    id: "drafting",
    label: "Drafting",
    description:
      "Start the writing process. Articles here are works in progress, visible only to editors and authors.",
    dotClassName: "bg-amber-600",
  },
  {
    id: "in-revision",
    label: "In Revision",
    description:
      "Content undergoing editorial review. Track changes and word counts as pieces take shape.",
    dotClassName: "bg-orange-700",
  },
  {
    id: "final-edit",
    label: "Final Edit",
    description:
      "The final polish before publication. Ensure all styling and factual checks are complete.",
    dotClassName: "bg-foreground",
  },
]

export function EmptyDirectory() {
  return (
    <Card className="py-24">
      <CardContent className="flex flex-col items-center gap-10">
        <Empty className="min-h-96">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="size-14 rounded-full bg-muted/70 text-muted-foreground"
            >
              <FileTextIcon className="size-5" />
            </EmptyMedia>
            <EmptyTitle className="font-heading text-2xl tracking-normal normal-case">
              A Blank Canvas
            </EmptyTitle>
            <EmptyDescription>
              Your editorial directory is currently empty. Start building your
              publication&apos;s next issue by drafting the first piece.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button>
              <PlusIcon data-icon="inline-start" />
              Create first article
            </Button>
          </EmptyContent>
        </Empty>
        <Separator className="max-w-2xl" />
        <div className="grid w-full max-w-2xl grid-cols-1 gap-8 sm:grid-cols-3">
          {STAGES.map((stage) => (
            <div key={stage.id} className="flex flex-col gap-2">
              <Badge>
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${stage.dotClassName}`}
                />

                {stage.label}
              </Badge>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {stage.description}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

```

### Core Architecture Module: `apps/v4/app/(app)/(styles)/sera/empty-state/components/preview-header.tsx`
```
import { ArrowLeftIcon, PlusIcon } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/styles/base-sera/ui/breadcrumb"
import { Button } from "@/styles/base-sera/ui/button"

export function PreviewHeader() {
  return (
    <header>
      <div className="container flex flex-col items-center justify-center gap-(--gap) py-(--gap) sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-2 text-center sm:text-left">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#" className="flex items-center gap-1.5">
                  <ArrowLeftIcon className="size-3.5" />
                  Editorial Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="line-clamp-1 font-heading text-3xl tracking-wide uppercase md:text-3xl lg:text-4xl">
            Article Directory
          </h1>
        </div>
        <Button className="sm:ml-auto">
          <PlusIcon data-icon="inline-start" />
          New Article
        </Button>
      </div>
    </header>
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11840** (2026-09-10): **[bug]: CLI rewrites utils import to from "cn" and installs npm package "cn"**
  *Symptoms*: ### Describe the bug  After npx shadcn@latest add <component>, every copied component imports the cn helper from a bare module specifier instead of the utils alias:  `import { cn } from "cn"`  instead of  `import { cn } from "@/lib/utils"`  The CLI then treats cn as an npm dependency and adds the unrelated package cn@0.2.6 to package.json. The generated files do not resolve the project's own utils helper.  Reproduced with shadcn 4.18.0, 4.19.1, 4.20.1 and 4.21.0, on a brand-new Vite project set up per the docs as well as an existing project. Same result with the default @/lib/utils alias and with a custom utils alias.  ### Affected component/components  All components that import cn (Button, Badge, Card, Table, Dialog, Sheet, ...). Sonner is unaffected because it has no cn import.  ### How to reproduce  npm create vite@latest app -- --template react-ts cd app && npm i -D tailwindcss @tailwindcss/vite @types/node Set src/index.css to `@import "tailwindcss";`, add the "@" alias to vite.config.ts and` "paths": { "@/*": ["./src/*"] } `to tsconfig.json (exactly the Vite steps from the installation docs). npx shadcn@latest init --yes --base base --preset vega npx shadcn@latest add button Open src/components/ui/button.tsx: line 3 is` import { cn } from "cn"`. package.json now contains` "cn": "^0.2.6"`.  ### Codesandbox/StackBlitz link  https://github.com/BernadetteStraub/shadcn-cn-import-repro  ### Logs  ```bash  ```  ### System Info  ```bash Windows 11 Pro 10.0.26200 Shell: Git Bas
  **Post-Mortem & Fix Analysis**:
  > I think this is from the September release ([https://ui.shadcn.com/docs/changelog](https://ui.shadcn.com/docs/changelog))  > **Every shadcn component now imports cn from the cn package.** > > ... > > We have moved that into a package. cn is a drop-in replacement for `twMerge(clsx(...))`. It is smaller, faster and ships the same API, so nothing changes at the call site.
  > You are right, this is the September `cn` change and not a bug. I tested the day after it landed and missed the changelog entry. `migrate cn` fixed our project. Thanks for the quick reply and sorry for the noise. Closing.

- **Issue #11749** (2026-09-03): **[bug]: dest already exists.**
  *Symptoms*: ### Describe the bug  pnpm dlx shadcn@latest init --monorepo Packages: +310 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ Progress: resolved 310, reused 287, downloaded 23, added 310, done √ Select a template » Next.js √ Select a component library » Base UI (Recommended) √ Which preset would you like to use? » Luma √ What is your project named? ... . × Something went wrong creating a new Next.js project.  Something went wrong. Please check the error below for more details. If the problem persists, please open an issue on GitHub.  dest already exists.  You can also try a previous version to see if that works: pnpm dlx shadcn@4.19.0 init --monorepo  ### Affected component/components  None  ### How to reproduce  pnpm dlx shadcn@latest init --monorepo  ### Codesandbox/StackBlitz link  _No response_  ### Logs  ```bash  ```  ### System Info  ```bash cmd windows ```  ### Before submitting  - [x] I've made research efforts and searched the documentation - [x] I've searched for existing issues

- **Issue #11435** (2026-08-18): **[bug]: Questionnaire vs Rich Radio/Checkbox/Switch - Inconsistent styling**
  *Symptoms*: ### Describe the bug  The Questionnaire component internally uses a sort of “Rich Radio” component, but its styles deviate from the actual Rich Radio component.  This is Luma, the rich radio has a white background and there is no hover style:  <img width="930" height="742" alt="Image" src="https://github.com/user-attachments/assets/88756b22-c3bc-47df-8855-db3977dba392" />  This is Luma too, the rich radio in questionnaire has a light gray background and a hover style, while the pattern is exactly the same.  <img width="1152" height="846" alt="Image" src="https://github.com/user-attachments/assets/5306a923-2ec9-4df3-845e-4cf6878d562a" />  Additionally, the focus style sits on the checkbox or radio within the rich radio, whereas in the questionnaire, it sits on the outside border.  <img width="798" height="576" alt="Image" src="https://github.com/user-attachments/assets/269009fb-3157-414c-9031-dca73477ace0" />  <img width="1112" height="756" alt="Image" src="https://github.com/user-attachments/assets/bc570aab-701a-4681-af81-c03f646f0f36" />  The same thing applies to Checkbox. Switch is not used in Questionnaire, but has inter-related issues if a decision would be made to make a change here.  My suggestion would be to be consistent across the board:  1. Either no hover states in both components or hover in all (I believe hover yes is better - so adding the hover state from Questionnaire to Rich Radio, Rich Checkbox and Rich Switch) 2. No color changes for the base background be

- **Issue #11422** (2026-08-06): **[bug]: when there is no desc in QuestionnaireChoice the checkbox is not centered**
  *Symptoms*: ### Describe the bug  ### Expected behavior  The checkbox should remain vertically centered regardless of whether a `QuestionnaireChoice` includes a description.  ### Actual behavior  When a `QuestionnaireChoice` does not have a description, the checkbox is aligned to the top instead of being vertically centered with the label.  <img width="613" height="346" alt="Image" src="https://github.com/user-attachments/assets/4653d559-3bcc-4285-aeb4-c15819181f6a" />  ### Affected component/components  Questionnaire  ### How to reproduce  1. Go to https://ui.shadcn.com/docs/components/base/questionnaire 2. Scroll to the example after the installation section. 3. Find the `QuestionnaireChoice` example without a description.  ### Codesandbox/StackBlitz link  _No response_  ### Logs  ```bash  ```  ### System Info  ```bash Arc, MacOS 26 ```  ### Before submitting  - [x] I've made research efforts and searched the documentation - [x] I've searched for existing issues
  **Post-Mortem & Fix Analysis**:
  > closing, alr a pull is there

- **Issue #11415** (2026-08-06): **[bug]: The new Questionnaire component has some alignment issues**
  *Symptoms*: ### Describe the bug  <img width="1204" height="806" alt="Image" src="https://github.com/user-attachments/assets/e0a7db8c-4987-4754-8569-e1fe6c60594c" />  <img width="1020" height="742" alt="Image" src="https://github.com/user-attachments/assets/8bdc6776-a90a-48ed-91ff-62d8283900d5" />  Generally, radio buttons and checkboxes don't align with the baseline of the first line of text in the Nova style.  <img width="1778" height="1268" alt="Image" src="https://github.com/user-attachments/assets/d2674384-cf63-4e33-ae08-97f3e2cbfaa4" />  Vega, Luma and Rhea have a similar problem.  Sera has it ever so slightly (1px off or even half a pixel)  Only the small styles (Lyra, Mira) don't have it.  ### Affected component/components  Accordion  ### How to reproduce  1. Go to https://ui.shadcn.com/create?item=questionnaire-example&preset=bbVJxYW 2. Draw a vertical line from the middle of the first line of text to the center of the radio button  They should align - but they don't.  ### Codesandbox/StackBlitz link  _No response_  ### Logs  ```bash / ```  ### System Info  ```bash / ```  ### Before submitting  - [x] I've made research efforts and searched the documentation - [x] I've searched for existing issues
  **Post-Mortem & Fix Analysis**:
  > Fixed now. I introduced this last minute. Should be okay now.
  > Solid! Thanks @shadcn .
  > <img width="1170" height="538" alt="Image" src="https://github.com/user-attachments/assets/f91484c7-6497-4654-b069-d542f7a58425" />  There's still some problems in both Lyra and Sera. I'll see if I can make a PR. 

- **Issue #11358** (2026-08-01): **[bug]: asChild in SidebarMenuButton not accepted**
  *Symptoms*: ### Describe the bug  SidebarMenuButton dosent accept asChild   ### Affected component/components  SidebarMenuButton  ### How to reproduce  "use client" import {   Sidebar,   SidebarContent,   SidebarGroup,   SidebarGroupContent,   SidebarGroupLabel,   SidebarHeader,   SidebarMenu,   SidebarMenuButton,   SidebarMenuItem,   SidebarRail, } from "@workspace/ui/components/sidebar" import type React from "react" import {   CreditCardIcon,   InboxIcon,   LayoutDashboardIcon,   LibraryBigIcon,   Mic,   Mic2,   Palette,   PaletteIcon, } from "lucide-react" import { OrganizationSwitcher } from "@clerk/nextjs" import { usePathname } from "next/navigation" import Link from "next/link" const customerSupportItems = [   {     title: "Conversations",     url: "/conversations",     icon: InboxIcon,   },   {     title: "Knowledge Base",     url: "/knowledge-base",     icon: LibraryBigIcon,   },   { title: "Conversations", url: "/conversations", icon: InboxIcon }, ] const configurationsItems = [   {     title: "Widget Customization",     url: "/customization",     icon: PaletteIcon,   },   {     title: "Widget Customization",     url: "/customization",     icon: PaletteIcon,   },   {     title: "Integrations",     url: "/integrations",     icon: LayoutDashboardIcon,   },   {     title: "voice assistant ",     url: "/plugins/vapi",     icon: Mic2,   }, ] export const AppSideBar = ({   ...props }: React.ComponentProps<typeof Sidebar>) => {   const pathName = usePathname()   const isActiveUrl = (

- **Issue #11351** (2026-07-31): **[bug]: createSelectorCreator is not defined**
  *Symptoms*: ### Describe the bug  I've been trying repeatedly to get Storybook's chromatic to work in my project to allow for ui testing. After a lot of poking around, it seems like the error (show below) stems from the `Dialog` component.   Many of my stories, using various shadcn components work just fine in storybook `dev` and `build` environments; but any component in my _storybook build_ that uses `Dialog` explodes and those stories fail like so:  `ReferenceError: createSelectorCreator is not defined`  <img width="1373" height="564" alt="Image" src="https://github.com/user-attachments/assets/5bf0c685-cec3-4996-b50f-986712d14a05" />   I think it has something to do with `reselect` (there are some 10 year old nextjs/reselect issues that I found) and how its bundled, when i pass it my problem into the claude sausage maker it insists its somehow tied to `reselect` and how its bundled, and then proceeds to make a bunch of proposed 'solutions' that never resolve the issue.  Not sure if its related, but I'm using the latest NextJS app with Vite. Unfortunately, I am unable to integrate chromatic until I resolve this issue and my build environments work.  - dev: storybook stories with `Dialog` work. - build: storybook stories with `Dialog` fail. - pipelines that rely on storybook builds will fail.  ### Affected component/components  Dialog  ### How to reproduce  1. create latest NextJS application with Vite. 2. install and setup a component that uses `Dialog` component. 3. install and setup 
  **Post-Mortem & Fix Analysis**:
  > I wasnt able to recreate it with a fresh nextjs project, closing.

- **Issue #11277** (2026-07-26): **[bug]: `defaultScrollPosition` doesn't work properly when mounting. component first time**
  *Symptoms*: ### Describe the bug  When you try to use `defaultScrollPosition` it scrolls to unexpected position. I narrowed down the issue to `content-visibilty: auto` in `MessageScrollerItem`. If I remove that it works properly.  I think `content-visibility` is making scroller calculate wrong height of viewport.  ### Affected component/components  MessageScroller  ### How to reproduce  Load the page with existing messages and you will see the issue on first mount.  ### Codesandbox/StackBlitz link  _No response_  ### Logs  ```bash  ```  ### System Info  ```bash Chrome 145.0.7632.45, MacOS ```  ### Before submitting  - [x] I've made research efforts and searched the documentation - [x] I've searched for existing issues
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this. I'll add a focused browser regression for the first-mount position with content-visibility: auto, then fix the initial measurement while preserving the long-transcript optimization if possible.
  > I can reproduce the CSS setup in the package's real-browser suite, but Chromium 149/150 settles at the correct position for both end and last-anchor. Which defaultScrollPosition value are you using, and could you share a minimal component or the item height/content pattern that still drifts? That will let me lock the exact failure without removing the performance optimization speculatively.
  > Actually it was local only bug. Works fine in production.

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

### Incident Patch 1: `8c2bf388` (2026-10-05)
**Commit Message**: fix(registry): accept a byte order mark in components.json and package.json (#12143)

Windows editors, including PowerShell 5.1's Set-Content and Out-File, save
UTF-8 JSON with a byte order mark. JSON.parse rejects it, so the CLI
reported the project as having an invalid configuration. Strip a leading
BOM before parsing. UTF-16 files still fail.

**File**: `.changeset/accept-json-bom.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@shadcn/registry": patch
+"shadcn": patch
+---
+
+Accept `components.json` and `package.json` files that start with a UTF-8 byte order mark.
```

**File**: `packages/registry/src/registry/api.test.ts` (modified, +14/-5)
```diff
@@ -2410,19 +2410,28 @@ describe("getPackageJsonRegistries", () => {
     })
   })
 
-  it.each([
-    ["invalid JSON", "{ invalid }"],
-    ["a byte order mark", '\uFEFF{ "registries": {} }'],
-  ])("throws on %s, naming the file", async (_, contents) => {
+  it("throws on invalid JSON, naming the file", async () => {
     await withTempDir(async (dir) => {
-      await writeFiles(dir, { "package.json": contents })
+      await writeFiles(dir, { "package.json": "{ invalid }" })
 
       await expect(getPackageJsonRegistries(dir)).rejects.toThrow(
         `JSON Error in ${path.join(dir, "package.json")}:\n`
       )
     })
   })
 
+  it("reads a package.json that starts with a byte order mark", async () => {
+    const registries = { "@acme": "https://acme.com/{name}.json" }
+
+    await withTempDir(async (dir) => {
+      await writeFiles(dir, {
+        "package.json": `\uFEFF${JSON.stringify({ registries })}`,
+      })
+
+      expect(await getPackageJsonRegistries(dir)).toEqual(registries)
+    })
+  })
+
   it.each(["false", "0", '""', "[]", '"@acme"'])(
     "rejects registries: %s",
     async (value) => {
```

**File**: `packages/registry/src/utils/get-config.test.ts` (modified, +11/-1)
```diff
@@ -103,7 +103,6 @@ describe("explorer", () => {
       ["invalid JSON", "{ invalid }"],
       ["a trailing comma", '{ "style": "new-york", }'],
       ["a comment", '// shadcn\n{ "style": "new-york" }'],
-      ["a byte order mark", '\uFEFF{ "style": "new-york" }'],
       ["UTF-16", Buffer.from('\uFEFF{ "style": "new-york" }', "utf16le")],
     ])("throws on %s, naming the file", async (_, contents) => {
       const dir = await createTempDir({ "components.json": contents })
@@ -113,6 +112,17 @@ describe("explorer", () => {
       )
     })
 
+    it("reads a file that starts with a byte order mark", async () => {
+      const dir = await createTempDir({
+        "components.json": '\uFEFF{ "style": "new-york" }',
+      })
+
+      expect(await explorer.search(dir)).toEqual({
+        config: { style: "new-york" },
+        filepath: path.join(dir, "components.json"),
+      })
+    })
+
     it("resolves a relative directory from the working directory", async () => {
       const dir = await createTempDir({
         "components.json": JSON.stringify({ style: "new-york" }),
```

**File**: `packages/registry/src/utils/json-config.ts` (modified, +2/-1)
```diff
@@ -55,7 +55,8 @@ async function readJsonConfig(
   filepath: string,
   property?: string
 ): Promise<JsonConfigResult> {
-  const contents = await readFile(filepath, "utf8")
+  // Editors on Windows can save JSON with a byte order mark.
+  const contents = (await readFile(filepath, "utf8")).replace(/^\uFEFF/, "")
   if (contents.trim() === "") {
     return null
   }
```

---

### Incident Patch 2: `95efb5cd` (2026-10-05)
**Commit Message**: fix(registry): read components.json and package.json without cosmiconfig (#12142)

* test(registry): pin config file reading before replacing cosmiconfig

Pin how components.json and package.json are read today: search and load
results, caching of hits, misses and failures, empty, BOM, UTF-16 and
invalid files, unreadable files, and invalid top-level or registries
values. Two tests pin cosmiconfig features that the next commit drops:
$import merging and meta config files in the working directory.

* fix(registry): read components.json and package.json without cosmiconfig

cosmiconfig's TypeScript loader pulls an extra copy of TypeScript (about
3.6 MB) into every bundle that includes @shadcn/registry. Replace it with
a small JSON reader that keeps the behavior callers rely on.

$import in components.json and cosmiconfig meta config files are no
longer read, and an invalid package.json in the working directory no
longer crashes the CLI on startup.

* chore: shorten changeset

* chore: changeset

**File**: `.changeset/lean-config-reader.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@shadcn/registry": patch
+"shadcn": patch
+---
+
+replace cosmiconfig with a smaller custom reader.
```

**File**: `packages/registry/package.json` (modified, +0/-1)
```diff
@@ -70,7 +70,6 @@
     "@babel/preset-typescript": "^7.27.1",
     "@dotenvx/dotenvx": "^1.48.4",
     "cn": "^0.2.4",
-    "cosmiconfig": "^9.0.0",
     "deepmerge": "^4.3.1",
     "execa": "^9.6.0",
     "fast-glob": "^3.3.3",
```

**File**: `packages/registry/src/registry/api.test.ts` (modified, +85/-3)
```diff
@@ -15,7 +15,7 @@ import {
   RegistryUnauthorizedError,
   RegistryValidationError,
 } from "@/src/registry/errors"
-import { getFixturesDir } from "@/src/test-helpers"
+import { getFixturesDir, withTempDir, writeFiles } from "@/src/test-helpers"
 import { getConfig } from "@/src/utils/get-config"
 import { http, HttpResponse } from "msw"
 import { setupServer } from "msw/node"
@@ -32,6 +32,7 @@ import { z } from "zod"
 
 import {
   getItemTargetPath,
+  getPackageJsonRegistries,
   getRegistries,
   getRegistriesConfig,
   getRegistriesIndex,
@@ -1861,11 +1862,9 @@ describe("getRegistriesConfig", () => {
     await fs.writeFile(configFile, "{ invalid json }")
 
     try {
-      // Malformed JSON should throw an error from cosmiconfig
       await getRegistriesConfig(tempDir)
       expect.fail("Should have thrown an error")
     } catch (error) {
-      // cosmiconfig throws a JSONError for malformed JSON
       expect((error as Error).message).toContain("JSON Error")
     } finally {
       await fs.unlink(configFile)
@@ -1954,6 +1953,30 @@ describe("getRegistriesConfig", () => {
     }
   })
 
+  it("rejects an empty components.json", async () => {
+    await withTempDir(async (dir) => {
+      await writeFiles(dir, { "components.json": "" })
+
+      await expect(getRegistriesConfig(dir)).rejects.toBeInstanceOf(
+        ConfigParseError
+      )
+    })
+  })
+
+  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
+    "throws when components.json is unreadable",
+    async () => {
+      await withTempDir(async (dir) => {
+        await writeFiles(dir, { "components.json": "{}" })
+        await fs.chmod(path.join(dir, "components.json"), 0o000)
+
+        await expect(getRegistriesConfig(dir)).rejects.toMatchObject({
+          code: "EACCES",
+        })
+      })
+    }
+  )
+
   describe("caching behavior", () => {
     it("should cache package.json registries and clear them when requested", async () => {
       const tempDir = await fs.mkdtemp(path.join(tmpdir(), "shadcn-test-"))
@@ -2369,6 +2392,65 @@ describe("getRegistriesConfig", () => {
   })
 })
 
+describe("getPackageJsonRegistries", () => {
+  it.each([
+    ["there is no package.json", {}],
+    ["package.json is empty", { "package.json": "" }],
+    [
+      "package.json is a byte order mark and CRLF",
+      { "package.json": "\uFEFF\r\n" },
+    ],
+    ["there is no registries key", { "package.json": '{ "name": "app" }' }],
+    ["registries is null", { "package.json": '{ "registries": null }' }],
+  ])("returns no registries when %s", async (_, files) => {
+    await withTempDir(async (dir) => {
+      await writeFiles(dir, files)
+
+      expect(await getPackageJsonRegistries(dir)).toEqual({})
+    })
+  })
+
+  it.each([
+    ["invalid JSON", "{ invalid }"],
+    ["a byte order mark", '\uFEFF{ "registries": {} }'],
+  ])("throws on %s, naming the file", async (_, contents) => {
+    await withTempDir(async (dir) => {
+      await writeFiles(dir, { "package.json": contents })
+
+      await expect(getPackageJsonRegistries(dir)).rejects.toThrow(
+        `JSON Error in ${path.join(dir, "package.json")}:\n`
+      )
+    })
+  })
+
+  it.each(["false", "0", '""', "[]", '"@acme"'])(
+    "rejects registries: %s",
+    async (value) => {
+      await withTempDir(async (dir) => {
+        await writeFiles(dir, { "package.json": `{ "registries": ${value} }` })
+
+        await expect(getPackageJsonRegistries(dir)).rejects.toBeInstanceOf(
+          ConfigParseError
+        )
+      })
+    }
+  )
+
+  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
+    "throws when package.json is unreadable",
+    async () => {
+      await withTempDir(async (dir) => {
+        await writeFiles(dir, { "package.json": "{}" })
+        await fs.chmod(path.join(dir, "package.json"), 0o000)
+
+        await expect(getPackageJsonRegistries(dir)).rejects.toMatchObject({
+          code: "EACCES",
+        })
+      })
+    }
+  )
+})
+
 describe("resolveTree", () => {
   it("resolve tree", async () => {
     const index = [
```

**File**: `packages/registry/src/registry/api.ts` (modified, +4/-4)
```diff
@@ -35,12 +35,12 @@ import {
   registrySchema,
 } from "@/src/schema"
 import { Config, explorer } from "@/src/utils/get-config"
-import { cosmiconfig } from "cosmiconfig"
+import { createJsonConfigExplorer } from "@/src/utils/json-config"
 import { z } from "zod"
 
-const packageRegistriesExplorer = cosmiconfig("registries", {
-  packageProp: "registries",
-  searchPlaces: ["package.json"],
+const packageRegistriesExplorer = createJsonConfigExplorer({
+  filename: "package.json",
+  property: "registries",
 })
 
 const registriesConfigFileSchema = z.object({
```

**File**: `packages/registry/src/test-helpers/index.ts` (modified, +10/-0)
```diff
@@ -9,6 +9,16 @@ export function getFixturesDir(...segments: string[]) {
   return path.resolve(__dirname, "../../test/fixtures", ...segments)
 }
 
+// Writes each file, creating parent directories.
+export async function writeFiles(
+  dir: string,
+  files: Record<string, string | Buffer>
+) {
+  for (const [file, contents] of Object.entries(files)) {
+    await fs.outputFile(path.join(dir, file), contents)
+  }
+}
+
 // Temp dir with guaranteed cleanup. Returns the callback's result.
 export async function withTempDir<T>(
   fn: (dir: string) => Promise<T>,
```

**File**: `packages/registry/src/utils/get-config.test.ts` (modified, +265/-2)
```diff
@@ -1,18 +1,256 @@
 import os from "os"
 import path from "path"
-import { getFixturesDir } from "@/src/test-helpers"
+import { getFixturesDir, writeFiles } from "@/src/test-helpers"
 import { getProjectConfig } from "@/src/utils/get-project-info"
 import fs from "fs-extra"
-import { describe, expect, it } from "vitest"
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
 
 import {
   createConfig,
+  explorer,
   getBase,
   getConfig,
   getRawConfig,
   getWorkspaceConfig,
 } from "./get-config"
 
+const tempDirs: string[] = []
+
+async function createTempDir(files: Record<string, string | Buffer> = {}) {
+  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shadcn-config-"))
+  tempDirs.push(dir)
+  await writeFiles(dir, files)
+  return dir
+}
+
+afterEach(async () => {
+  await Promise.all(tempDirs.splice(0).map((dir) => fs.remove(dir)))
+})
+
+describe("explorer", () => {
+  beforeEach(() => {
+    explorer.clearCaches()
+  })
+
+  describe("search", () => {
+    it("returns the components.json in the directory", async () => {
+      const dir = await createTempDir({
+        "components.json": JSON.stringify({ style: "new-york" }),
+      })
+
+      expect(await explorer.search(dir)).toEqual({
+        config: { style: "new-york" },
+        filepath: path.join(dir, "components.json"),
+      })
+    })
+
+    it("only looks in the given directory", async () => {
+      const dir = await createTempDir({
+        "components.json": JSON.stringify({ style: "new-york" }),
+        "child/.gitkeep": "",
+      })
+
+      expect(await explorer.search(path.join(dir, "child"))).toBeNull()
+    })
+
+    it("returns null when the directory does not exist", async () => {
+      const dir = await createTempDir()
+
+      expect(await explorer.search(path.join(dir, "missing"))).toBeNull()
+    })
+
+    it.each([
+      ["is missing", {}],
+      ["is empty", { "components.json": "" }],
+      ["is whitespace", { "components.json": " \n\t\n" }],
+      ["is a byte order mark and CRLF", { "components.json": "\uFEFF\r\n" }],
+      ["is JSON null", { "components.json": "null" }],
+      ["is a directory", { "components.json/.gitkeep": "" }],
+    ])("returns null when components.json %s", async (_, files) => {
+      const dir = await createTempDir(files)
+
+      expect(await explorer.search(dir)).toBeNull()
+    })
+
+    it("caches a null result until clearCaches()", async () => {
+      const dir = await createTempDir()
+
+      expect(await explorer.search(dir)).toBeNull()
+      await fs.writeJson(path.join(dir, "components.json"), {
+        style: "new-york",
+      })
+      expect(await explorer.search(dir)).toBeNull()
+
+      explorer.clearCaches()
+      expect(await explorer.search(dir)).toMatchObject({
+        config: { style: "new-york" },
+      })
+    })
+
+    it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
+      "returns null when components.json is unreadable",
+      async () => {
+        const dir = await createTempDir({
+          "components.json": JSON.stringify({ style: "new-york" }),
+        })
+        await fs.chmod(path.join(dir, "components.json"), 0o000)
+
+        expect(await explorer.search(dir)).toBeNull()
+      }
+    )
+
+    it.each([
+      ["invalid JSON", "{ invalid }"],
+      ["a trailing comma", '{ "style": "new-york", }'],
+      ["a comment", '// shadcn\n{ "style": "new-york" }'],
+      ["a byte order mark", '\uFEFF{ "style": "new-york" }'],
+      ["UTF-16", Buffer.from('\uFEFF{ "style": "new-york" }', "utf16le")],
+    ])("throws on %s, naming the file", async (_, contents) => {
+      const dir = await createTempDir({ "components.json": contents })
+
+      await expect(explorer.search(dir)).rejects.toThrow(
+        `JSON Error in ${path.join(dir, "components.json")}:\n`
+      )
+    })
+
+    it("resolves a relative directory from the working directory", async () => {
+      const dir = await createTempDir({
+        "components.json": JSON.stringify({ style: "new-york" }),
+      })
+
+      expect(await explorer.search(path.relative(process.cwd(), dir))).toEqual({
+        config: { style: "new-york" },
+        filepath: path.join(dir, "components.json"),
+      })
+    })
+
+    it("caches results until clearCaches()", async () => {
+      const dir = await createTempDir({
+        "components.json": JSON.stringify({ style: "new-york" }),
+      })
+
+      const first = await explorer.search(dir)
+      await fs.writeJson(path.join(dir, "components.json"), {
+        style: "default",
+      })
+      expect(await explorer.search(dir)).toBe(first)
+
+      explorer.clearCaches()
+      expect(await explorer.search(dir)).toMatchObject({
+        config: { style: "default" },
+      })
+    })
+
+    it("caches a failed read until clearCaches()", async () => {
+      const dir = await createTempDir({ "components.json": "{ invalid }" })
+
+      await expect(explorer.search(dir)).rejects.toThrow("JSON E
```

**File**: `packages/registry/src/utils/get-config.ts` (modified, +3/-5)
```diff
@@ -8,8 +8,8 @@ import {
 } from "@/src/schema"
 import { getProjectInfo } from "@/src/utils/get-project-info"
 import { highlighter } from "@/src/utils/highlighter"
+import { createJsonConfigExplorer } from "@/src/utils/json-config"
 import { resolveImportWithMetadata } from "@/src/utils/resolve-import"
-import { cosmiconfig } from "cosmiconfig"
 import fg from "fast-glob"
 import { loadConfig, type ConfigLoaderSuccessResult } from "tsconfig-paths"
 import { z } from "zod"
@@ -21,10 +21,8 @@ export const DEFAULT_TAILWIND_CSS = "app/globals.css"
 export const DEFAULT_TAILWIND_CONFIG = "tailwind.config.js"
 export const DEFAULT_TAILWIND_BASE_COLOR = "slate"
 
-// TODO: Figure out if we want to support all cosmiconfig formats.
-// A simple components.json file would be nice.
-export const explorer = cosmiconfig("components", {
-  searchPlaces: ["components.json"],
+export const explorer = createJsonConfigExplorer({
+  filename: "components.json",
 })
 
 export type Config = z.infer<typeof configSchema>
```

**File**: `packages/registry/src/utils/json-config.ts` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import { readFile } from "fs/promises"
+import path from "path"
+
+// Reads JSON config files the way our cosmiconfig setup did, without
+// cosmiconfig's TypeScript loader, which bundlers pull in with it.
+
+export type JsonConfigResult = { config: unknown; filepath: string } | null
+
+// search() treats a file it cannot read as missing.
+const UNREADABLE = new Set(["ENOENT", "EISDIR", "ENOTDIR", "EACCES"])
+
+export function createJsonConfigExplorer(options: {
+  filename: string
+  // Return this key of the file instead of the whole file.
+  property?: string
+}) {
+  // Caching promises means concurrent calls share a read, and a failed read
+  // keeps failing until clearCaches().
+  const searchCache = new Map<string, Promise<JsonConfigResult>>()
+  const loadCache = new Map<string, Promise<JsonConfigResult>>()
+
+  return {
+    // Reads the file in `dir` only, not in parent directories. Returns null
+    // when the file is missing, unreadable or empty.
+    search(dir: string) {
+      dir = path.resolve(dir)
+      return cached(searchCache, dir, async () => {
+        try {
+          return await readJsonConfig(
+            path.join(dir, options.filename),
+            options.property
+          )
+        } catch (error) {
+          if (UNREADABLE.has((error as NodeJS.ErrnoException).code ?? "")) {
+            return null
+          }
+          throw error
+        }
+      })
+    },
+    load(filepath: string) {
+      filepath = path.resolve(filepath)
+      return cached(loadCache, filepath, () =>
+        readJsonConfig(filepath, options.property)
+      )
+    },
+    clearCaches() {
+      searchCache.clear()
+      loadCache.clear()
+    },
+  }
+}
+
+async function readJsonConfig(
+  filepath: string,
+  property?: string
+): Promise<JsonConfigResult> {
+  const contents = await readFile(filepath, "utf8")
+  if (contents.trim() === "") {
+    return null
+  }
+
+  let config: unknown
+  try {
+    config = JSON.parse(contents)
+  } catch (error) {
+    throw new SyntaxError(
+      `JSON Error in ${filepath}:\n${(error as Error).message}`
+    )
+  }
+
+  if (property) {
+    config = (config as Record<string, unknown>)[property] ?? null
+  }
+
+  return config === null ? null : { config, filepath }
+}
+
+function cached<T>(
+  cache: Map<string, Promise<T>>,
+  key: string,
+  read: () => Promise<T>
+) {
+  let result = cache.get(key)
+  if (!result) {
+    result = read()
+    cache.set(key, result)
+  }
+  return result
+}
```

---

### Incident Patch 3: `3b1ae6e4` (2026-10-05)
**Commit Message**: fix(registry): skip npm audit and fund when installing dependencies (#12140)

* fix(registry): skip npm audit and fund when installing dependencies

npm runs `npm audit` and a funding check after every install and
uninstall. The CLI captures npm's output and never shows it, so the
report is thrown away, but the audit can dominate the install: for each
vulnerable package npm fetches the full packument of it and of every
dependent to look for a fixed version.

GHSA-vfj7-8cjw-p6xm (braces, reviewed 2026-10-02) reaches the
next-app-init test fixture through eslint-config-next and marks ~10
dependents as vulnerable. With a cold cache, `npm install -- cn radix-ui`
there went from ~18s to 51-68s, which put the "should install cn for a
pre-existing project" e2e test over the CLI's 60s timeout on every run.

Pass --no-audit --no-fund to npm install and npm uninstall.

* test: report CLI timeouts as failures in runCommand

execa returns no exit code for a command killed by its timeout, and
runCommand mapped that to 0, so expectCommandSuccess passed for a hung
command and the failure surfaced later as a missing file. Return exit
code 1 with "Command timed out after <n>ms." in stderr instead.


**File**: `.changeset/quiet-npm-installs.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@shadcn/registry": patch
+"shadcn": patch
+---
+
+Skip `npm audit` and the funding check when installing or removing dependencies, or creating a project, with npm.
```

**File**: `packages/registry/src/utils/updaters/update-dependencies.test.ts` (modified, +87/-9)
```diff
@@ -32,8 +32,23 @@ describe("updateDependencies", () => {
         },
       },
       expectedPackageManager: "npm",
-      expectedArgs: ["install", "--", "first", "second", "third"],
-      expectedDevArgs: ["install", "-D", "--", "fourth"],
+      expectedArgs: [
+        "install",
+        "--no-audit",
+        "--no-fund",
+        "--",
+        "first",
+        "second",
+        "third",
+      ],
+      expectedDevArgs: [
+        "install",
+        "--no-audit",
+        "--no-fund",
+        "-D",
+        "--",
+        "fourth",
+      ],
     },
     {
       description:
@@ -47,8 +62,25 @@ describe("updateDependencies", () => {
         },
       },
       expectedPackageManager: "npm",
-      expectedArgs: ["install", "--force", "--", "first", "second", "third"],
-      expectedDevArgs: ["install", "--force", "-D", "--", "fourth"],
+      expectedArgs: [
+        "install",
+        "--no-audit",
+        "--no-fund",
+        "--force",
+        "--",
+        "first",
+        "second",
+        "third",
+      ],
+      expectedDevArgs: [
+        "install",
+        "--no-audit",
+        "--no-fund",
+        "--force",
+        "-D",
+        "--",
+        "fourth",
+      ],
     },
     {
       description:
@@ -62,8 +94,25 @@ describe("updateDependencies", () => {
         },
       },
       expectedPackageManager: "npm",
-      expectedArgs: ["install", "--force", "--", "first", "second", "third"],
-      expectedDevArgs: ["install", "--force", "-D", "--", "fourth"],
+      expectedArgs: [
+        "install",
+        "--no-audit",
+        "--no-fund",
+        "--force",
+        "--",
+        "first",
+        "second",
+        "third",
+      ],
+      expectedDevArgs: [
+        "install",
+        "--no-audit",
+        "--no-fund",
+        "--force",
+        "-D",
+        "--",
+        "fourth",
+      ],
     },
     {
       description:
@@ -79,13 +128,23 @@ describe("updateDependencies", () => {
       expectedPackageManager: "npm",
       expectedArgs: [
         "install",
+        "--no-audit",
+        "--no-fund",
         "--legacy-peer-deps",
         "--",
         "first",
         "second",
         "third",
       ],
-      expectedDevArgs: ["install", "--legacy-peer-deps", "-D", "--", "fourth"],
+      expectedDevArgs: [
+        "install",
+        "--no-audit",
+        "--no-fund",
+        "--legacy-peer-deps",
+        "-D",
+        "--",
+        "fourth",
+      ],
     },
     {
       description: "deno uses npm: package prefix",
@@ -137,8 +196,15 @@ describe("updateDependencies", () => {
         },
       },
       expectedPackageManager: "npm",
-      expectedArgs: ["install", "--", "first"],
-      expectedDevArgs: ["install", "-D", "--", "second"],
+      expectedArgs: ["install", "--no-audit", "--no-fund", "--", "first"],
+      expectedDevArgs: [
+        "install",
+        "--no-audit",
+        "--no-fund",
+        "-D",
+        "--",
+        "second",
+      ],
     },
   ])(
     "$description",
@@ -311,4 +377,16 @@ describe("dependency commands", () => {
       cwd,
     })
   })
+
+  it("uninstalls with npm without running audit or fund", async () => {
+    const cwd = getFixturesDir("project-npm-react19")
+
+    await removeDependencies(cwd, ["react-day-picker"])
+
+    expect(execa).toHaveBeenCalledWith(
+      "npm",
+      ["uninstall", "--no-audit", "--no-fund", "--", "react-day-picker"],
+      { cwd }
+    )
+  })
 })
```

**File**: `packages/registry/src/utils/updaters/update-dependencies.ts` (modified, +16/-2)
```diff
@@ -10,6 +10,11 @@ import { execa } from "execa"
 import fsExtra from "fs-extra"
 import prompts from "prompts"
 
+// npm runs an audit and a funding check after every install and uninstall.
+// We never show npm's output, and the audit can take most of the install
+// time, so skip both.
+const NPM_FLAGS = ["--no-audit", "--no-fund"]
+
 export async function updateDependencies(
   dependencies: RegistryItem["dependencies"],
   devDependencies: RegistryItem["devDependencies"],
@@ -122,7 +127,9 @@ export async function removeDependencies(cwd: string, dependencies: string[]) {
 
   const packageManager = await getPackageManager(cwd)
   if (packageManager === "npm") {
-    await execa("npm", ["uninstall", "--", ...dependencies], { cwd })
+    await execa("npm", ["uninstall", ...NPM_FLAGS, "--", ...dependencies], {
+      cwd,
+    })
     return
   }
 
@@ -336,7 +343,13 @@ async function installWithNpm(
   if (dependencies.length) {
     await execa(
       "npm",
-      ["install", ...(flag ? [`--${flag}`] : []), "--", ...dependencies],
+      [
+        "install",
+        ...NPM_FLAGS,
+        ...(flag ? [`--${flag}`] : []),
+        "--",
+        ...dependencies,
+      ],
       { cwd }
     )
   }
@@ -346,6 +359,7 @@ async function installWithNpm(
       "npm",
       [
         "install",
+        ...NPM_FLAGS,
         ...(flag ? [`--${flag}`] : []),
         "-D",
         "--",
```

**File**: `packages/shadcn/src/templates/create-template.test.ts` (modified, +2/-2)
```diff
@@ -23,8 +23,8 @@ describe("getInstallArgs", () => {
     expect(getInstallArgs("yarn")).toEqual(["--no-immutable"])
   })
 
-  it("returns an empty array for npm", () => {
-    expect(getInstallArgs("npm")).toEqual([])
+  it("skips audit and fund for npm", () => {
+    expect(getInstallArgs("npm")).toEqual(["--no-audit", "--no-fund"])
   })
 
   it("returns an empty array for bun", () => {
```

**File**: `packages/shadcn/src/templates/create-template.ts` (modified, +3/-0)
```diff
@@ -104,6 +104,9 @@ export function getInstallArgs(packageManager: string): string[] {
       // Yarn enables immutable installs in CI by default.
       // New template projects need to create their lockfile on first install.
       return ["--no-immutable"]
+    case "npm":
+      // The output is not shown, and npm's audit can take most of the install time.
+      return ["--no-audit", "--no-fund"]
     default:
       return []
   }
```

**File**: `packages/tests/src/utils/helpers.ts` (modified, +17/-2)
```diff
@@ -36,6 +36,8 @@ export async function runCommand(
     timeout?: number
   }
 ) {
+  const timeout = options?.timeout ?? 60000
+
   try {
     const childProcess = execa("node", [SHADCN_CLI_PATH, ...args], {
       cwd,
@@ -47,15 +49,28 @@ export async function runCommand(
       },
       input: options?.input,
       reject: false,
-      timeout: options?.timeout ?? 60000,
+      timeout,
     })
 
     const result = await childProcess
 
+    // A command killed by the timeout has no exit code. Report it as a
+    // failure, with the reason, instead of letting it pass as exit 0.
+    if (result.timedOut) {
+      return {
+        stdout: result.stdout || "",
+        stderr: [`Command timed out after ${timeout}ms.`, result.stderr]
+          .filter(Boolean)
+          .join("\n"),
+        exitCode: 1,
+      }
+    }
+
     return {
       stdout: result.stdout || "",
       stderr: result.stderr || "",
-      exitCode: result.exitCode ?? 0,
+      // No exit code means the process was killed, e.g. by a signal.
+      exitCode: result.exitCode ?? 1,
     }
   } catch (error: any) {
     return {
```

---

### Incident Patch 4: `0aa29200` (2026-10-05)
**Commit Message**: chore(deps): bump brace-expansion in /templates/vite-monorepo (#12070)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 5.0.9 to 5.0.12.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v5.0.9...v5.0.12)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 5.0.12
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `templates/vite-monorepo/pnpm-lock.yaml` (modified, +4/-4)
```diff
@@ -929,8 +929,8 @@ packages:
     engines: {node: '>=6.0.0'}
     hasBin: true
 
-  brace-expansion@5.0.9:
-    resolution: {integrity: sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==}
+  brace-expansion@5.0.12:
+    resolution: {integrity: sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==}
     engines: {node: 20 || >=22}
 
   browserslist@4.28.2:
@@ -2326,7 +2326,7 @@ snapshots:
 
   baseline-browser-mapping@2.10.32: {}
 
-  brace-expansion@5.0.9:
+  brace-expansion@5.0.12:
     dependencies:
       balanced-match: 4.0.4
 
@@ -2706,7 +2706,7 @@ snapshots:
 
   minimatch@10.2.6:
     dependencies:
-      brace-expansion: 5.0.9
+      brace-expansion: 5.0.12
 
   ms@2.1.3: {}
 
```

---

### Incident Patch 5: `6108ac45` (2026-10-05)
**Commit Message**: chore(deps): bump brace-expansion in /templates/start-monorepo (#12071)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 5.0.6 to 5.0.12.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v5.0.6...v5.0.12)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 5.0.12
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `templates/start-monorepo/pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -1645,9 +1645,9 @@ packages:
     engines: {node: '>=6.0.0'}
     hasBin: true
 
-  brace-expansion@5.0.6:
-    resolution: {integrity: sha512-kLpxurY4Z4r9sgMsyG0Z9uzsBlgiU/EFKhj/h91/8yHu0edo7XuixOIH3VcJ8kkxs6/jPzoI6U9Vj3WqbMQ94g==}
-    engines: {node: 18 || 20 || >=22}
+  brace-expansion@5.0.12:
+    resolution: {integrity: sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==}
+    engines: {node: 20 || >=22}
 
   browserslist@4.28.2:
     resolution: {integrity: sha512-48xSriZYYg+8qXna9kwqjIVzuQxi+KYWp2+5nCYnYKPTr0LvD89Jqk2Or5ogxz0NUMfIjhh2lIUX/LyX9B4oIg==}
@@ -4027,7 +4027,7 @@ snapshots:
 
   baseline-browser-mapping@2.10.32: {}
 
-  brace-expansion@5.0.6:
+  brace-expansion@5.0.12:
     dependencies:
       balanced-match: 4.0.4
 
@@ -4544,7 +4544,7 @@ snapshots:
 
   minimatch@10.2.5:
     dependencies:
-      brace-expansion: 5.0.6
+      brace-expansion: 5.0.12
 
   ms@2.1.3: {}
 
```

---

### Incident Patch 6: `a9c1da49` (2026-09-30)
**Commit Message**: fix(shadcn): apply shimmer reduced motion to variants (#12061)

**File**: `.changeset/calm-shimmer-variants.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"shadcn": patch
+---
+
+fix shimmer reduced motion handling when used with a variant
```

**File**: `packages/shadcn/src/tailwind.css` (modified, +8/-0)
```diff
@@ -583,6 +583,12 @@
   &:where([dir="rtl"], [dir="rtl"] *) {
     animation-direction: reverse;
   }
+
+  @media (prefers-reduced-motion: reduce) {
+    animation: none;
+    background-image: none;
+    -webkit-text-fill-color: currentColor;
+  }
 }
 
 @utility shimmer-once {
@@ -620,6 +626,8 @@
   --shimmer-angle: calc(--value(integer) * 1deg);
 }
 
+/* Kept for backwards compatibility. Unlayered, so it still wins over other
+   utilities on a plain .shimmer element. Variants are handled in the utility. */
 @media (prefers-reduced-motion: reduce) {
   .shimmer {
     animation: none;
```

---

### Incident Patch 7: `71f0e497` (2026-09-30)
**Commit Message**: fix(registry): move @sekei to sekei.design (#12044)

Claude-Session: https://claude.ai/code/session_01Wc1EvLdV7wHDbX2LzLKxcg

Co-authored-by: Claude <[REDACTED_EMAIL]>
Co-authored-by: shadcn <[REDACTED_EMAIL]>

**File**: `apps/v4/registry/directory.json` (modified, +2/-2)
```diff
@@ -1936,8 +1936,8 @@
   },
   {
     "name": "@sekei",
-    "homepage": "https://www.sekei.xyz/shad-fx",
-    "url": "https://www.sekei.xyz/registry/{name}.json",
+    "homepage": "https://www.sekei.design/shad-fx",
+    "url": "https://www.sekei.design/registry/{name}.json",
     "description": "Canvas effects for React, copied into your project as source. Starts with ordered dither: fire, lightning, sonar rings, a light beam, a sloshing fluid, rain and snow.",
     "author": "Piergiorgio Gonni",
     "logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='var(--foreground)'><path d='M18 12H26V14H28V16H26V18H24V20H22V22H20V24H18V26H16V28H14V20H6V18H4V16H6V14H8V12H10V10H12V8H14V6H16V4H18V12Z'/></svg>"
```

---

### Incident Patch 8: `c9b28b61` (2026-09-30)
**Commit Message**: fix(registry): keep @voraui logo arcs unfilled in the directory (#12034)

The directory applies fill-foreground to the logo's root svg, which overrides its fill='none' attribute and fills the stroke-only arcs into a solid dome. Set fill='none' on each path so the arcs stay outlined, and use a square viewBox so the logo is centered at the same size as other entries.

Co-authored-by: shadcn <[REDACTED_EMAIL]>

**File**: `apps/v4/registry/directory.json` (modified, +1/-1)
```diff
@@ -2735,7 +2735,7 @@
     "homepage": "https://voraui.vercel.app",
     "url": "https://voraui.vercel.app/r/{name}.json",
     "description": "Open source crypto market analytics components for shadcn/ui - candlestick trading charts, BTC rainbow chart, Fear & Greed and Altseason gauges, live from free public APIs.",
-    "logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 275 144' fill='none'><path d='M10 133.625C10 100.838 23.433 69.3931 47.3439 46.2089C71.2548 23.0247 103.685 10 137.5 10C171.315 10 203.745 23.0247 227.656 46.2089C251.567 69.3931 265 100.838 265 133.625' stroke='var(--foreground)' stroke-width='20' stroke-linecap='round'/><path d='M41.875 133.625C41.875 109.034 51.9497 85.4511 69.8829 68.063C87.8161 50.6748 112.139 40.9063 137.5 40.9062C162.861 40.9063 187.184 50.6748 205.117 68.063C223.05 85.4511 233.125 109.034 233.125 133.625' stroke='var(--foreground)' stroke-width='20' stroke-linecap='round'/><path d='M73.75 133.625C73.75 117.231 80.4665 101.509 92.4219 89.917C104.377 78.3249 120.592 71.8125 137.5 71.8125C154.408 71.8125 170.623 78.3249 182.578 89.917C194.534 101.509 201.25 117.231 201.25 133.625' stroke='var(--foreground)' stroke-width='20' stroke-linecap='round'/></svg>"
+    "logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -65.5 275 275' fill='none'><path fill='none' d='M10 133.625C10 100.838 23.433 69.3931 47.3439 46.2089C71.2548 23.0247 103.685 10 137.5 10C171.315 10 203.745 23.0247 227.656 46.2089C251.567 69.3931 265 100.838 265 133.625' stroke='var(--foreground)' stroke-width='20' stroke-linecap='round'/><path fill='none' d='M41.875 133.625C41.875 109.034 51.9497 85.4511 69.8829 68.063C87.8161 50.6748 112.139 40.9063 137.5 40.9062C162.861 40.9063 187.184 50.6748 205.117 68.063C223.05 85.4511 233.125 109.034 233.125 133.625' stroke='var(--foreground)' stroke-width='20' stroke-linecap='round'/><path fill='none' d='M73.75 133.625C73.75 117.231 80.4665 101.509 92.4219 89.917C104.377 78.3249 120.592 71.8125 137.5 71.8125C154.408 71.8125 170.623 78.3249 182.578 89.917C194.534 101.509 201.25 117.231 201.25 133.625' stroke='var(--foreground)' stroke-width='20' stroke-linecap='round'/></svg>"
   },
   {
     "name": "@grainly-icons",
```

---

### Incident Patch 9: `2b75a3fa` (2026-09-30)
**Commit Message**: fix(registry): keep @notra logo stroke unfilled (#12054)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

**File**: `apps/v4/registry/directory.json` (modified, +1/-1)
```diff
@@ -1511,7 +1511,7 @@
     "homepage": "https://ui.usenotra.com",
     "url": "https://ui.usenotra.com/r/{name}.json",
     "description": "Components and blocks for building modern dashboards, straight from the design system behind Notra.",
-    "logo": "<svg width='800' height='800' viewBox='0 0 800 800' fill='none' xmlns='http://www.w3.org/2000/svg' role='img'><title>Notra Logo</title><rect width='800' height='800' rx='160' fill='#f6f3f1'/><g transform='translate(120 120) scale(0.7)'><path d='M572.881 462.223c-12.712 43.22-290.678 105.932-394.068 83.898l-48.305-10.169 48.305-78.814 68.644-104.237 73.729-106.78 251.695-127.119 78.814-22.881 17.796 17.796h10.17c17.796 35.593 3.945 147.458-12.712 195.763-25.424 73.729-124.576 96.61-177.966 114.407-4.064 1.355 96.61-5.085 83.898 38.136Z' fill='#c8b2ee' stroke='#1e1e1e' stroke-width='35' stroke-linecap='round'/><path d='M700 96.111c-162.712-4.237-510.508 111.356-600 607.627' stroke='#1e1e1e' stroke-width='75' stroke-linecap='round'/></g></svg>"
+    "logo": "<svg width='800' height='800' viewBox='0 0 800 800' fill='none' xmlns='http://www.w3.org/2000/svg' role='img'><title>Notra Logo</title><rect width='800' height='800' rx='160' fill='#f6f3f1'/><g transform='translate(120 120) scale(0.7)'><path d='M572.881 462.223c-12.712 43.22-290.678 105.932-394.068 83.898l-48.305-10.169 48.305-78.814 68.644-104.237 73.729-106.78 251.695-127.119 78.814-22.881 17.796 17.796h10.17c17.796 35.593 3.945 147.458-12.712 195.763-25.424 73.729-124.576 96.61-177.966 114.407-4.064 1.355 96.61-5.085 83.898 38.136Z' fill='#c8b2ee' stroke='#1e1e1e' stroke-width='35' stroke-linecap='round'/><path d='M700 96.111c-162.712-4.237-510.508 111.356-600 607.627' fill='none' stroke='#1e1e1e' stroke-width='75' stroke-linecap='round'/></g></svg>"
   },
   {
     "name": "@ns-ui",
```

---

### Incident Patch 10: `10cd7f01` (2026-09-30)
**Commit Message**: fix(v4): chat component registry and docs drift (#12057)

**File**: `apps/v4/content/docs/components/aria/message-scroller.mdx` (modified, +6/-1)
```diff
@@ -93,7 +93,7 @@ npm install @shadcn/react
 <ComponentSource
   name="message-scroller"
   title="components/ui/message-scroller.tsx"
-  styleName="aria-nova"
+  styleName="aria-rhea"
 />
 
 <Step>Update the import paths to match your project setup.</Step>
@@ -273,6 +273,11 @@ Scrolling away from the live edge releases the view, whether by wheel, touch,
 keyboard scroll keys, or dragging the scrollbar. An explicit message jump
 releases it too. New chunks can then arrive without moving the reader.
 
+`autoScroll` composes with turn anchoring. When a new turn anchors near the
+top, the view stays put while the reply streams into the room below it. Once
+the reply fills the viewport, the reader is back at the live edge and
+follow-output takes over from the anchor.
+
 ```tsx
 <MessageScrollerProvider autoScroll>
   <MessageScroller>{/* streamed turns */}</MessageScroller>
```

**File**: `apps/v4/content/docs/components/base/message-scroller.mdx` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ npm install @shadcn/react
 <ComponentSource
   name="message-scroller"
   title="components/ui/message-scroller.tsx"
-  styleName="base-nova"
+  styleName="base-rhea"
 />
 
 <Step>Update the import paths to match your project setup.</Step>
```

**File**: `apps/v4/content/docs/components/radix/message-scroller.mdx` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ npm install @shadcn/react
 <ComponentSource
   name="message-scroller"
   title="components/ui/message-scroller.tsx"
-  styleName="radix-nova"
+  styleName="radix-rhea"
 />
 
 <Step>Update the import paths to match your project setup.</Step>
```

**File**: `apps/v4/examples/README.md` (modified, +8/-3)
```diff
@@ -11,12 +11,15 @@ examples
 │   └── ...
 ├── radix
 │   └── ...
+├── aria
+│   └── ...
+├── __components__   # Auto-generated by registry:build
 └── __index__.tsx    # Auto-generated by registry:build
 ```
 
 ## Adding a New Example
 
-1. Create a new `.tsx` file in `examples/base` or `examples/radix`:
+1. Create a new `.tsx` file in `examples/base`, `examples/radix` or `examples/aria`:
 
 ```tsx
 // examples/base/button-loading.tsx
@@ -41,7 +44,9 @@ pnpm --filter=v4 registry:build
 
 ## Notes
 
-- Example files should be placed directly in `examples/base` or `examples/radix`, not in subdirectories.
-- Base examples should import from `@/styles/base-nova/*`. Radix examples should import from `@/styles/radix-nova/*`.
+- Example files should be placed directly in `examples/base`, `examples/radix` or `examples/aria`, not in subdirectories.
+- Examples import from `@/styles/<base>-nova/*`, where `<base>` is `base`, `radix` or `aria`. For example, radix examples import from `@/styles/radix-nova/*`.
+- Chat component examples (attachment, bubble, marker, message, message-scroller) import from `@/styles/<base>-rhea/*` instead.
+- The import style must match the `styleName` used in the MDX. Every style of a base resolves to the same `examples/<base>` file, so the imports decide what the preview renders while `styleName` decides which source `ComponentSource` shows. An example imported from `@/styles/base-rhea/*` must be referenced with `styleName="base-rhea"`.
 - Both named exports and default exports are supported.
 - After adding or removing examples, run `pnpm --filter=v4 registry:build` to update the index.
```

**File**: `apps/v4/lib/components.ts` (modified, +6/-0)
```diff
@@ -4,9 +4,11 @@ export const UI_COMPONENTS = [
   "alert",
   "alert-dialog",
   "aspect-ratio",
+  "attachment",
   "avatar",
   "badge",
   "breadcrumb",
+  "bubble",
   "button",
   "button-group",
   "calendar",
@@ -34,12 +36,16 @@ export const UI_COMPONENTS = [
   "item",
   "kbd",
   "label",
+  "marker",
   "menubar",
+  "message",
+  "message-scroller",
   "native-select",
   "navigation-menu",
   "pagination",
   "popover",
   "progress",
+  "questionnaire",
   "radio-group",
   "resizable",
   "scroll-area",
```

**File**: `apps/v4/next.config.mjs` (modified, +16/-11)
```diff
@@ -1,20 +1,25 @@
-import { existsSync, readFileSync } from "fs"
+import { existsSync, readdirSync, readFileSync } from "fs"
 import path from "path"
 import { createMDX } from "fumadocs-mdx/next"
 
 // The generated styles under styles/ are gitignored (see styles/README.md),
-// but registry/__components__.tsx (tracked in git) dynamically imports from
-// them. If a tracked map references styles that were never generated locally
-// (e.g. after pulling a commit that adds a new base), Turbopack hits hundreds
-// of module-not-found errors compiling /docs and the dev server grinds to a
-// halt. Fail fast with instructions instead.
+// but the per-style shards in registry/__components__/ (tracked in git)
+// dynamically import from them. If a tracked shard references styles that were
+// never generated locally (e.g. after pulling a commit that adds a new base),
+// Turbopack hits hundreds of module-not-found errors compiling /docs and the
+// dev server grinds to a halt. Fail fast with instructions instead.
 if (process.env.NODE_ENV === "development") {
-  const componentsMap = path.join(process.cwd(), "registry/__components__.tsx")
-  const referencedStyles = existsSync(componentsMap)
+  const componentsDir = path.join(process.cwd(), "registry/__components__")
+  const referencedStyles = existsSync(componentsDir)
     ? new Set(
-        [...readFileSync(componentsMap, "utf-8").matchAll(/@\/styles\/([\w-]+)\//g)].map(
-          (match) => match[1]
-        )
+        readdirSync(componentsDir)
+          .filter((file) => file.endsWith(".tsx"))
+          .flatMap((file) => [
+            ...readFileSync(path.join(componentsDir, file), "utf-8").matchAll(
+              /@\/styles\/([\w-]+)\//g
+            ),
+          ])
+          .map((match) => match[1])
       )
     : new Set(["base-nova"])
   const missingStyles = [...referencedStyles].filter(
```

**File**: `apps/v4/registry/bases/__index__.tsx` (modified, +45/-6)
```diff
@@ -2547,7 +2547,13 @@ export const Index: Record<string, Record<string, any>> = {
       title: "Attachment",
       description: "",
       type: "registry:example",
-      registryDependencies: ["attachment"],
+      registryDependencies: [
+        "attachment",
+        "button",
+        "dialog",
+        "example",
+        "spinner",
+      ],
       files: [
         {
           path: "registry/bases/base/examples/attachment-example.tsx",
@@ -2563,7 +2569,14 @@ export const Index: Record<string, Record<string, any>> = {
       title: "Bubble",
       description: "",
       type: "registry:example",
-      registryDependencies: ["bubble", "button", "collapsible", "example"],
+      registryDependencies: [
+        "bubble",
+        "button",
+        "collapsible",
+        "example",
+        "marker",
+        "sonner",
+      ],
       files: [
         {
           path: "registry/bases/base/examples/bubble-example.tsx",
@@ -6197,7 +6210,13 @@ export const Index: Record<string, Record<string, any>> = {
       title: "Attachment",
       description: "",
       type: "registry:example",
-      registryDependencies: ["attachment"],
+      registryDependencies: [
+        "attachment",
+        "button",
+        "dialog",
+        "example",
+        "spinner",
+      ],
       files: [
         {
           path: "registry/bases/aria/examples/attachment-example.tsx",
@@ -6213,7 +6232,14 @@ export const Index: Record<string, Record<string, any>> = {
       title: "Bubble",
       description: "",
       type: "registry:example",
-      registryDependencies: ["bubble", "button", "collapsible", "example"],
+      registryDependencies: [
+        "bubble",
+        "button",
+        "collapsible",
+        "example",
+        "marker",
+        "sonner",
+      ],
       files: [
         {
           path: "registry/bases/aria/examples/bubble-example.tsx",
@@ -9891,7 +9917,13 @@ export const Index: Record<string, Record<string, any>> = {
       title: "Attachment",
       description: "",
       type: "registry:example",
-      registryDependencies: ["attachment"],
+      registryDependencies: [
+        "attachment",
+        "button",
+        "dialog",
+        "example",
+        "spinner",
+      ],
       files: [
         {
           path: "registry/bases/radix/examples/attachment-example.tsx",
@@ -9907,7 +9939,14 @@ export const Index: Record<string, Record<string, any>> = {
       title: "Bubble",
       description: "",
       type: "registry:example",
-      registryDependencies: ["bubble", "button", "collapsible", "example"],
+      registryDependencies: [
+        "bubble",
+        "button",
+        "collapsible",
+        "example",
+        "marker",
+        "sonner",
+      ],
       files: [
         {
           path: "registry/bases/radix/examples/bubble-example.tsx",
```

**File**: `apps/v4/registry/bases/aria/examples/_registry.ts` (modified, +15/-2)
```diff
@@ -885,7 +885,13 @@ export const examples: Registry["items"] = [
     name: "attachment-example",
     title: "Attachment",
     type: "registry:example",
-    registryDependencies: ["attachment"],
+    registryDependencies: [
+      "attachment",
+      "button",
+      "dialog",
+      "example",
+      "spinner",
+    ],
     files: [
       {
         path: "examples/attachment-example.tsx",
@@ -897,7 +903,14 @@ export const examples: Registry["items"] = [
     name: "bubble-example",
     title: "Bubble",
     type: "registry:example",
-    registryDependencies: ["bubble", "button", "collapsible", "example"],
+    registryDependencies: [
+      "bubble",
+      "button",
+      "collapsible",
+      "example",
+      "marker",
+      "sonner",
+    ],
     files: [
       {
         path: "examples/bubble-example.tsx",
```

---

### Incident Patch 11: `db2db460` (2026-09-28)
**Commit Message**: feat(registry): add @corsair-ui (#12033)

* feat(registry): add @corsair

* feat(registry): rename @corsair to @corsair-ui

**File**: `apps/v4/registry/directory.json` (modified, +8/-0)
```diff
@@ -2747,5 +2747,13 @@
     "url": "https://quiz-ui-phi.vercel.app/r/{name}.json",
     "description": "Headless, Radix-based components for building quiz funnels — shadcn-style distribution, style entirely via className.",
     "logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' fill='none'><rect width='200' height='200' fill='white'/><path d='M46.375 124.797H39.1094V110.805H38.8984C38.5703 111.523 38.0938 112.242 37.4688 112.961C36.8438 113.664 36.0391 114.25 35.0547 114.719C34.0859 115.188 32.8984 115.422 31.4922 115.422C29.4922 115.422 27.6875 114.906 26.0781 113.875C24.4688 112.844 23.1953 111.328 22.2578 109.328C21.3203 107.312 20.8516 104.852 20.8516 101.945C20.8516 98.9453 21.3359 96.4453 22.3047 94.4453C23.2734 92.4453 24.5625 90.9531 26.1719 89.9688C27.7812 88.9688 29.5391 88.4688 31.4453 88.4688C32.9141 88.4688 34.1406 88.7188 35.125 89.2188C36.1094 89.7031 36.9062 90.3125 37.5156 91.0469C38.125 91.7812 38.5859 92.5078 38.8984 93.2266H39.2266V88.7969H46.375V124.797ZM39.2734 101.922C39.2734 99.5781 38.7969 97.7109 37.8438 96.3203C36.8906 94.9297 35.5312 94.2344 33.7656 94.2344C31.9688 94.2344 30.6016 94.9453 29.6641 96.3672C28.7422 97.7891 28.2812 99.6406 28.2812 101.922C28.2812 104.188 28.75 106.047 29.6875 107.5C30.625 108.938 31.9844 109.656 33.7656 109.656C35.5156 109.656 36.8672 108.945 37.8203 107.523C38.7891 106.102 39.2734 104.234 39.2734 101.922ZM68.9688 103.867V88.7969H76.2344V115H69.25V110.242H68.9688C68.3906 111.773 67.4141 113.008 66.0391 113.945C64.6797 114.883 63.0156 115.344 61.0469 115.328C58.4062 115.344 56.2656 114.477 54.625 112.727C53 110.961 52.1875 108.547 52.1875 105.484V88.7969H59.4531V104.219C59.4531 105.75 59.8672 106.969 60.6953 107.875C61.5234 108.766 62.625 109.203 64 109.188C65.2969 109.203 66.4453 108.758 67.4453 107.852C68.4609 106.945 68.9688 105.617 68.9688 103.867ZM82.0469 115V88.7969H89.3125V115H82.0469ZM85.6797 85.4453C84.6016 85.4453 83.6719 85.0859 82.8906 84.3672C82.125 83.6484 81.7422 82.7812 81.7422 81.7656C81.7422 80.75 82.125 79.8906 82.8906 79.1875C83.6719 78.4688 84.6016 78.1094 85.6797 78.1094C86.7578 78.1094 87.6797 78.4688 88.4453 79.1875C89.2266 79.8906 89.6172 80.75 89.6172 81.7656C89.6172 82.7812 89.2266 83.6484 88.4453 84.3672C87.6797 85.0859 86.7578 85.4453 85.6797 85.4453ZM95.0078 115V110.664L107.805 94.7969V94.6094H95.4062V88.7969H116.547V93.5547L104.523 109V109.188H116.969V115H95.0078ZM137.805 78.4375L126.555 120.25H120.297L131.547 78.4375H137.805ZM158.078 103.867V88.7969H165.344V115H158.359V110.242H158.078C157.5 111.773 156.523 113.008 155.148 113.945C153.789 114.883 152.125 115.344 150.156 115.328C147.516 115.344 145.375 114.477 143.734 112.727C142.109 110.961 141.297 108.547 141.297 105.484V88.7969H148.562V104.219C148.562 105.75 148.977 106.969 149.805 107.875C150.633 108.766 151.734 109.203 153.109 109.188C154.406 109.203 155.555 108.758 156.555 107.852C157.57 106.945 158.078 105.617 158.078 103.867ZM171.156 115V88.7969H178.422V115H171.156ZM174.789 85.4453C173.711 85.4453 172.781 85.0859 172 84.3672C171.234 83.6484 170.852 82.7812 170.852 81.7656C170.852 80.75 171.234 79.8906 172 79.1875C172.781 78.4688 173.711 78.1094 174.789 78.1094C175.867 78.1094 176.789 78.4688 177.555 79.1875C178.336 79.8906 178.727 80.75 178.727 81.7656C178.727 82.7812 178.336 83.6484 177.555 84.3672C176.789 85.0859 175.867 85.4453 174.789 85.4453Z' fill='black'/></svg>"
+  },
+  {
+    "name": "@corsair-ui",
+    "homepage": "https://corsairui.vercel.app",
+    "url": "https://kevingirelli.github.io/corsair-ui/r/{name}.json",
+    "description": "Copy-and-own React components for Tailwind CSS 3 and 4: forms, overlays, site chrome, motion, animated text and backgrounds.",
+    "author": "Kevin Girelli",
+    "logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' fill='var(--foreground)'><path fill-rule='evenodd' d='M60.9 124.6C58 121.1 55.6 117 56.3 116.4C56.5 116.2 58.2 117.9 60 120.1C63.3 124.3 63.3 124.3 64.6 121.9C66.2 119 66.4 117.7 65 118.5C63.1 119.7 64 117.4 67.6 112C70.6 107.4 71.1 107 70.6 109.5C70.2 111.2 69.7 114.3 69.3 116.5C69 118.7 67.5 122.1 66.1 124.1L63.5 127.6L60.9 124.6ZM48.4 112.8C46.2 110.4 43.7 107.4 42.8 106C41.3 103.8 41.2 103.7 41.7 105.6C41.9 106.8 41.7 108.1 41.1 108.4C40.4 108.9 40 108.2 40 106.8C39.9 105.5 39.3 103.4 38.5 102C37.7 100.6 37.1 97.9 37.1 96L37.2 92.5L38.1 95.8C39.1 99.1 41 99.3 41 96.1C41 95.2 41.6 93.6 42.2 92.7C43.3 91.2 43.4 91.9 43.2 96.9C42.9 101.9 43.2 103.4 45.6 107.1C48.2 111.2 48.4 111.4 48.9 109.2C49.4 107.1 49.8 107.4 51.7 111.9C54.3 118.1 53.5 118.3 48.4 112.8ZM75 115.4C75 114.8 76.6 112.9 78.5 111C82.7 107 85.5 99.3 84.7 94.1C84.1 90.5 84.1 90.5 86.1 93C88.1 95.5 88.1 95.5 87.7 89.8C87.5 86.6 87.5 84 87.7 84C89.1 84 92 91.2 91.9 94.5C91.8 97.2 91.6 97.7 91.3 96C90.6 92.1 89 91.2 89 94.6C89 98.8 85.9 107.5 85 106C84.5 105.2 83.6 106 82.2 108.2C79.8 112 75 116.8 75 115.4ZM54.2 107.7C49 101.7 48.8 101.4 49.2 96.3C49.6 92 49.4 91.2 48.3 92.1C47.5 92.9 47 92.9 47 92.2C47 91.6 4
```

---

### Incident Patch 12: `7bc56048` (2026-09-12)
**Commit Message**: chore(deps): bump next, astro, postcss, undici, postcss-selector-parser, baseline-browser-mapping (#11862)

**File**: `apps/v4/package.json` (modified, +4/-4)
```diff
@@ -77,10 +77,10 @@
     "lru-cache": "^11.2.4",
     "lucide-react": "0.474.0",
     "motion": "^12.12.1",
-    "next": "16.3.0-canary.97",
+    "next": "16.3.3",
     "next-themes": "0.4.6",
     "nuqs": "^2.8.9",
-    "postcss": "^8.5.1",
+    "postcss": "^8.5.23",
     "radix-ui": "^1.4.3",
     "react": "19.2.3",
     "react-aria-components": "1.20.0",
@@ -115,7 +115,7 @@
     "@typescript-eslint/parser": "^8.31.0",
     "@vercel/blob": "^2.8.0",
     "agentation": "^2.2.1",
-    "baseline-browser-mapping": "^2.10.0",
+    "baseline-browser-mapping": "^2.11.0",
     "eslint": "^9",
     "eslint-config-next": "16.0.0",
     "prettier": "^3.4.2",
@@ -124,7 +124,7 @@
     "tw-animate-css": "^1.4.0",
     "typescript": "^5",
     "typescript-eslint": "^8.46.2",
-    "undici": "^7.27.2",
+    "undici": "^7.29.0",
     "unist-builder": "3.0.0",
     "unist-util-visit": "^4.1.2",
     "vitest": "^3.2.6"
```

**File**: `packages/shadcn/package.json` (modified, +3/-3)
```diff
@@ -107,15 +107,15 @@
     "kleur": "^4.1.5",
     "open": "^11.0.0",
     "ora": "^8.2.0",
-    "postcss": "^8.5.6",
-    "postcss-selector-parser": "^7.1.0",
+    "postcss": "^8.5.23",
+    "postcss-selector-parser": "^7.1.3",
     "prompts": "^2.4.2",
     "recast": "^0.23.11",
     "socks": "^2.8.8",
     "stringify-object": "^5.0.0",
     "ts-morph": "^26.0.0",
     "tsconfig-paths": "^4.2.0",
-    "undici": "^7.27.2",
+    "undici": "^7.29.0",
     "validate-npm-package-name": "^7.0.1",
     "zod": "^3.24.1",
     "zod-to-json-schema": "^3.24.6"
```

**File**: `packages/shadcn/src/utils/updaters/update-css-vars.test.ts` (modified, +2/-2)
```diff
@@ -247,7 +247,7 @@ describe("transformCssVarsV4", () => {
                 --primary: oklch(0.72 0.11 178);
               }
 
-              @theme inline {
+      @theme inline {
                 --color-background: var(--background);
                 --color-foreground: var(--foreground);
                 --color-primary: var(--primary);
@@ -865,7 +865,7 @@ describe("transformCssVarsV4", () => {
       @custom-variant dark (&:is(.dark *));
               @plugin "tailwindcss-animate";
 
-              @plugin "@tailwindcss/typography";
+      @plugin "@tailwindcss/typography";
               "
     `)
   })
```

**File**: `packages/shadcn/src/utils/updaters/update-css.test.ts` (modified, +3/-4)
```diff
@@ -409,9 +409,8 @@ describe("transformCss", () => {
     expect(result).toMatchInlineSnapshot(`
       "@import "tailwindcss";
 
-      @plugin \"foo\";
-
-      @plugin \"bar\";
+      @plugin "foo";
+      @plugin "bar";
 
       @layer base {
         body {
@@ -503,7 +502,7 @@ describe("transformCss", () => {
 
     expect(result).toMatchInlineSnapshot(`
       "
-      @plugin \"foo\""
+      @plugin "foo";"
     `)
   })
 
```

**File**: `pnpm-lock.yaml` (modified, +286/-288)
```diff
@@ -43,7 +43,7 @@ importers:
         version: 8.54.0(eslint@9.26.0(hono@4.12.23)(jiti@1.21.7))(typescript@5.9.2)
       autoprefixer:
         specifier: ^10.4.14
-        version: 10.4.21(postcss@8.5.15)
+        version: 10.4.21(postcss@8.5.28)
       chokidar:
         specifier: ^4.0.3
         version: 4.0.3
@@ -209,7 +209,7 @@ importers:
         version: 9.0.0(react-dom@19.2.3(react@19.2.3))(react@19.2.3)
       '@vercel/analytics':
         specifier: ^1.4.1
-        version: 1.5.0(next@16.3.0-canary.97(@babel/core@7.28.0)(@opentelemetry/api@1.9.0)(@types/node@20.19.10)(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react@19.2.3)
+        version: 1.5.0(next@16.3.3(@babel/core@7.28.0)(@opentelemetry/api@1.9.0)(@types/node@20.19.10)(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react@19.2.3)
       ai:
         specifier: canary
         version: 7.0.0-canary.159(zod@3.25.76)
@@ -245,16 +245,16 @@ importers:
         version: 4.0.2
       fumadocs-core:
         specifier: 16.10.5
-        version: 16.10.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.2)(lucide-react@0.474.0(react@19.2.3))(next@16.3.0-canary.97(@babel/core@7.28.0)(@opentelemetry/api@1.9.0)(@types/node@20.19.10)(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react-dom@19.2.3(react@19.2.3))(react@19.2.3)(zod@3.25.76)
+        version: 16.10.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.2)(lucide-react@0.474.0(react@19.2.3))(next@16.3.3(@babel/core@7.28.0)(@opentelemetry/api@1.9.0)(@types/node@20.19.10)(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react-dom@19.2.3(react@19.2.3))(react@19.2.3)(zod@3.25.76)
       fumadocs-docgen:
         specifier: 3.0.10
-        version: 3.0.10(@emnapi/core@1.4.5)(@emnapi/runtime@1.11.3)(@types/estree@1.0.9)(@types/hast@3.0.4)(@types/mdast@4.0.4)(fumadocs-core@16.10.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.2)(lucide-react@0.474.0(react@19.2.3))(next@16.3.0-canary.97(@babel/core@7.28.0)(@opentelemetry/api@1.9.0)(@types/node@20.19.10)(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react-dom@19.2.3(react@19.2.3))(react@19.2.3)(zod@3.25.76))(mdast-util-mdx@3.0.0)
+        version: 3.0.10(@emnapi/core@1.4.5)(@emnapi/runtime@1.11.3)(@types/estree@1.0.9)(@types/hast@3.0.4)(@types/mdast@4.0.4)(fumadocs-core@16.10.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.2)(lucide-react@0.474.0(react@19.2.3))(next@16.3.3(@babel/core@7.28.0)(@opentelemetry/api@1.9.0)(@types/node@20.19.10)(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react-dom@19.2.3(react@19.2.3))(react@19.2.3)(zod@3.25.76))(mdast-util-mdx@3.0.0)
       fumadocs-mdx:
         specifier: 15.0.12
-        version: 15.0.12(@types/mdast@4.0.4)(@types/mdx@2.0.13)(@types/react@19.2.2)(fumadocs-core@16.10.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.2)(lucide-react@0.474.0(react@19.2.3))(next@16.3.0-canary.97(@babel/core@7.28.0)(@opentelemetry/api@1.9.0)(@types/node@20.19.10)(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react-dom@19.2.3(react@19.2.3))(react@19.2.3)(zod@3.25.76))(next@16.3.0-canary.97(@babel/core@7.28.0)(@opentelemetry/api@1.9.0)(@types/node@20.19.10)(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react@19.2.3)(vite@7.3.5(@types/node@20.19.10)(jiti@2.7.0)(lightningcss@1.32.0)(tsx@4.20.3)(yaml@2.8.1))
+        version: 15.0.12(@types/mdast@4.0.4)(@types/mdx@2.0.13)(@types/react@19.2.2)(fumadocs-core@16.10.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.2)(lucide-react@0.474.0(react@19.2.3))(next@16.3.3(@babel/core@7.28.0)(@opentelemetry/api@1.9.0)(@types/node@20.19.10)(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react-dom@19.2.3(react@19.2.3))(react@19.2.3)(zod@3.25.76))(next@16.3.3(@babel/core@7.28.0)(@opentelemetry/api@1.9.0)(@types/node@20.19.10)(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react@19.2.3)(vite@7.3.5(@types/node@20.19.10)(jiti@2.7.0)(lightningcss@1.32.0)(tsx@4.20.3)(yaml@2.8.1))
       fumadocs-ui:
         specifier: 16.10.5
-        version: 16.10.5(@emotion/is-prop-valid@1.3.1)(@tailwindcss/oxide@4.3.0)(@types/mdx@2.0.13)(@types/react-dom@19.2.2(@types/react@19.2.2))(@types/react@19.2.2)(fumadocs-core@16.10.5(@mdx-js/mdx@3.1.1)(@types/estree-jsx@1.0.5)(@types/hast@3.0.4)(@types/mdast@4.0.4)(@types/react@19.2.2)(lucide-react@0.474.0(react@19.2.3))(next@16.3.0-canary.97(@babel/core@7.28.0)(@opentelemetry/api@1.9.0)(@types/node@20.19.10)(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react-dom@19.2.3(react@19.2.3))(react@19.2.3)(zod@3.25.76))(next@16.3.0-canary.97(@babel/core@7.28.0)(@opentelemetry/api@1.9.0)(@types/node@20.19.10)(react-dom@19.2.3(react@19.2.3))(react@19.2.3))(react-dom@19.2.3(react@19.2.3))(react@19.2.3)(tailwindcss@4.3.0)
+        version: 16.10.5(@emotion/is-pr
```

**File**: `templates/astro-app/package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "@tailwindcss/vite": "^4",
     "@types/react": "^19",
     "@types/react-dom": "^19",
-    "astro": "^7",
+    "astro": "^7.2.8",
     "react": "^19.2.6",
     "react-dom": "^19.2.6",
     "tailwindcss": "^4"
```

**File**: `templates/astro-monorepo/apps/web/package.json` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     "@types/react": "^19",
     "@types/react-dom": "^19",
     "@workspace/ui": "workspace:*",
-    "astro": "^7",
+    "astro": "^7.2.8",
     "react": "^19.2.6",
     "react-dom": "^19.2.6"
   },
```

**File**: `templates/next-app/package.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
     "typecheck": "tsc --noEmit"
   },
   "dependencies": {
-    "next": "16.2.6",
+    "next": "16.3.3",
     "next-themes": "^0.4.6",
     "react": "19.2.4",
     "react-dom": "19.2.4"
```

---

### Incident Patch 13: `3ba91b1c` (2026-09-08)
**Commit Message**: fix: serve OIDC home RSC payloads via forwarded headers

**File**: `apps/v4/next.config.mjs` (modified, +8/-6)
```diff
@@ -226,24 +226,26 @@ const nextConfig = {
       },
       // The OIDC registry (shadcn-ui/oidc-ui) is a separate Vercel project
       // served under /oidc. It sets basePath: "/oidc", so the prefix is
-      // forwarded as-is. The zone's home page serves its RSC payloads at
-      // /oidc.rsc, /oidc.prefetch.rsc and /oidc.segments/* (dot, not
-      // slash), which /oidc/:path* does not match.
+      // forwarded as-is. RSC requests for the zone's HOME page get
+      // normalized to /oidc.rsc, /oidc.prefetch.rsc and /oidc.segments/*
+      // (dot, not slash) before rewrites run, and the oidc deployment has
+      // no literal outputs at those paths — so send them to /oidc and let
+      // the forwarded RSC headers select the payload there.
       {
         source: "/oidc",
         destination: "https://oidc.shadcn.com/oidc",
       },
       {
         source: "/oidc.rsc",
-        destination: "https://oidc.shadcn.com/oidc.rsc",
+        destination: "https://oidc.shadcn.com/oidc",
       },
       {
         source: "/oidc.prefetch.rsc",
-        destination: "https://oidc.shadcn.com/oidc.prefetch.rsc",
+        destination: "https://oidc.shadcn.com/oidc",
       },
       {
         source: "/oidc.segments/:path*",
-        destination: "https://oidc.shadcn.com/oidc.segments/:path*",
+        destination: "https://oidc.shadcn.com/oidc",
       },
       {
         source: "/oidc/:path*",
```

---

### Incident Patch 14: `5c7072da` (2026-09-06)
**Commit Message**: fix(registry): correct logo quoting in directory JSON (#11807)

* fix(registry): correct logo quoting in directory JSON

* style(cli): format updater imports

**File**: `apps/v4/registry/directory.json` (modified, +2/-2)
```diff
@@ -109,7 +109,7 @@
     "homepage": "https://designali.com",
     "url": "https://designali.com/r/{name}.json",
     "description": "Where thoughtful design meets production-ready code. I design and build digital experiences that look great, feel intuitive, and work beautifully.",
-    "logo": "<svg width='658' height='376' viewBox="0 0 658 376" xmlns='http://www.w3.org/2000/svg'><path d='M326.063 0L376.777 137.054L513.831 187.768L376.777 238.482L326.063 375.536L275.349 238.482L138.295 187.768L275.349 137.054L326.063 0Z' fill='#00A8FF'/> <path d='M420.049 321.622V277.733L627.998 184.731V189.956L420.049 96.9536V53.0649L657.257 159.652V215.035L420.049 321.622Z' fill='#00A8FF'/> <path d='M237.208 321.622L0 215.035V159.652L237.208 53.0649V96.9536L29.2591 189.956V184.731L237.208 277.733V321.622Z' fill='#00A8FF'/></svg>"
+    "logo": "<svg width='658' height='376' viewBox='0 0 658 376' xmlns='http://www.w3.org/2000/svg'><path d='M326.063 0L376.777 137.054L513.831 187.768L376.777 238.482L326.063 375.536L275.349 238.482L138.295 187.768L275.349 137.054L326.063 0Z' fill='#00A8FF'/> <path d='M420.049 321.622V277.733L627.998 184.731V189.956L420.049 96.9536V53.0649L657.257 159.652V215.035L420.049 321.622Z' fill='#00A8FF'/> <path d='M237.208 321.622L0 215.035V159.652L237.208 53.0649V96.9536L29.2591 189.956V184.731L237.208 277.733V321.622Z' fill='#00A8FF'/></svg>"
   },
   {
     "name": "@amicro",
@@ -2053,4 +2053,4 @@
     "description": "Headless, Radix-based components for building quiz funnels — shadcn-style distribution, style entirely via className.",
     "logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' fill='none'><rect width='200' height='200' fill='white'/><path d='M46.375 124.797H39.1094V110.805H38.8984C38.5703 111.523 38.0938 112.242 37.4688 112.961C36.8438 113.664 36.0391 114.25 35.0547 114.719C34.0859 115.188 32.8984 115.422 31.4922 115.422C29.4922 115.422 27.6875 114.906 26.0781 113.875C24.4688 112.844 23.1953 111.328 22.2578 109.328C21.3203 107.312 20.8516 104.852 20.8516 101.945C20.8516 98.9453 21.3359 96.4453 22.3047 94.4453C23.2734 92.4453 24.5625 90.9531 26.1719 89.9688C27.7812 88.9688 29.5391 88.4688 31.4453 88.4688C32.9141 88.4688 34.1406 88.7188 35.125 89.2188C36.1094 89.7031 36.9062 90.3125 37.5156 91.0469C38.125 91.7812 38.5859 92.5078 38.8984 93.2266H39.2266V88.7969H46.375V124.797ZM39.2734 101.922C39.2734 99.5781 38.7969 97.7109 37.8438 96.3203C36.8906 94.9297 35.5312 94.2344 33.7656 94.2344C31.9688 94.2344 30.6016 94.9453 29.6641 96.3672C28.7422 97.7891 28.2812 99.6406 28.2812 101.922C28.2812 104.188 28.75 106.047 29.6875 107.5C30.625 108.938 31.9844 109.656 33.7656 109.656C35.5156 109.656 36.8672 108.945 37.8203 107.523C38.7891 106.102 39.2734 104.234 39.2734 101.922ZM68.9688 103.867V88.7969H76.2344V115H69.25V110.242H68.9688C68.3906 111.773 67.4141 113.008 66.0391 113.945C64.6797 114.883 63.0156 115.344 61.0469 115.328C58.4062 115.344 56.2656 114.477 54.625 112.727C53 110.961 52.1875 108.547 52.1875 105.484V88.7969H59.4531V104.219C59.4531 105.75 59.8672 106.969 60.6953 107.875C61.5234 108.766 62.625 109.203 64 109.188C65.2969 109.203 66.4453 108.758 67.4453 107.852C68.4609 106.945 68.9688 105.617 68.9688 103.867ZM82.0469 115V88.7969H89.3125V115H82.0469ZM85.6797 85.4453C84.6016 85.4453 83.6719 85.0859 82.8906 84.3672C82.125 83.6484 81.7422 82.7812 81.7422 81.7656C81.7422 80.75 82.125 79.8906 82.8906 79.1875C83.6719 78.4688 84.6016 78.1094 85.6797 78.1094C86.7578 78.1094 87.6797 78.4688 88.4453 79.1875C89.2266 79.8906 89.6172 80.75 89.6172 81.7656C89.6172 82.7812 89.2266 83.6484 88.4453 84.3672C87.6797 85.0859 86.7578 85.4453 85.6797 85.4453ZM95.0078 115V110.664L107.805 94.7969V94.6094H95.4062V88.7969H116.547V93.5547L104.523 109V109.188H116.969V115H95.0078ZM137.805 78.4375L126.555 120.25H120.297L131.547 78.4375H137.805ZM158.078 103.867V88.7969H165.344V115H158.359V110.242H158.078C157.5 111.773 156.523 113.008 155.148 113.945C153.789 114.883 152.125 115.344 150.156 115.328C147.516 115.344 145.375 114.477 143.734 112.727C142.109 110.961 141.297 108.547 141.297 105.484V88.7969H148.562V104.219C148.562 105.75 148.977 106.969 149.805 107.875C150.633 108.766 151.734 109.203 153.109 109.188C154.406 109.203 155.555 108.758 156.555 107.852C157.57 106.945 158.078 105.617 158.078 103.867ZM171.156 115V88.7969H178.422V115H171.156ZM174.789 85.4453C173.711 85.4453 172.781 85.0859 172 84.3672C171.234 83.6484 170.852 82.7812 170.852 81.7656C170.852 80.75 171.234 79.8906 172 79.1875C172.781 78.4688 173.711 78.1094 174.789 78.1094C175.867 78.1094 176.789 78.4688 177.555 79.1875C178.336 79.8906 178.727 80.75 178.727 81.7656C178.727 82.7812 178.336 83.6484 177.555 84.3672C176.789 85.0859 175.867 85.4453 174.789 85.4453Z' fill='black'/></svg>"
   }
-]
\ No newline at end of file
+]
```

**File**: `packages/shadcn/src/utils/updaters/update-css.ts` (modified, +1/-1)
```diff
@@ -10,12 +10,12 @@ import { TailwindVersion } from "@/src/utils/get-project-info"
 import { highlighter } from "@/src/utils/highlighter"
 import { spinner } from "@/src/utils/spinner"
 import { transformCssVars } from "@/src/utils/updaters/update-css-vars"
+import { twMerge } from "cn"
 import postcss from "postcss"
 import AtRule from "postcss/lib/at-rule"
 import Declaration from "postcss/lib/declaration"
 import Root from "postcss/lib/root"
 import Rule from "postcss/lib/rule"
-import { twMerge } from "cn"
 import { z } from "zod"
 
 export async function updateCss(
```

---

### Incident Patch 15: `4dbe0729` (2026-09-06)
**Commit Message**: feat: add quiz-ui registry to directory json (#11753)

**File**: `apps/v4/registry/directory.json` (modified, +8/-1)
```diff
@@ -2045,5 +2045,12 @@
     "url": "https://afterglow.thebuilder.dk/r/{name}.json",
     "description": "A complete terminal UI system for shadcn with Base UI components, terminal-specific building blocks, and eight phosphor color themes.",
     "logo": "<svg viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' fill='currentColor'><path d='M6.45 5.9L18.23 16L6.45 26.1L3 22.07L10.09 16L3 9.93Z'/><path d='M18.4 20.24H29V24.48H18.4Z'/></svg>"
+  },
+  {
+    "name": "@quiz-ui",
+    "homepage": "https://quiz-ui-phi.vercel.app",
+    "url": "https://quiz-ui-phi.vercel.app/r/{name}.json",
+    "description": "Headless, Radix-based components for building quiz funnels — shadcn-style distribution, style entirely via className.",
+    "logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' fill='none'><rect width='200' height='200' fill='white'/><path d='M46.375 124.797H39.1094V110.805H38.8984C38.5703 111.523 38.0938 112.242 37.4688 112.961C36.8438 113.664 36.0391 114.25 35.0547 114.719C34.0859 115.188 32.8984 115.422 31.4922 115.422C29.4922 115.422 27.6875 114.906 26.0781 113.875C24.4688 112.844 23.1953 111.328 22.2578 109.328C21.3203 107.312 20.8516 104.852 20.8516 101.945C20.8516 98.9453 21.3359 96.4453 22.3047 94.4453C23.2734 92.4453 24.5625 90.9531 26.1719 89.9688C27.7812 88.9688 29.5391 88.4688 31.4453 88.4688C32.9141 88.4688 34.1406 88.7188 35.125 89.2188C36.1094 89.7031 36.9062 90.3125 37.5156 91.0469C38.125 91.7812 38.5859 92.5078 38.8984 93.2266H39.2266V88.7969H46.375V124.797ZM39.2734 101.922C39.2734 99.5781 38.7969 97.7109 37.8438 96.3203C36.8906 94.9297 35.5312 94.2344 33.7656 94.2344C31.9688 94.2344 30.6016 94.9453 29.6641 96.3672C28.7422 97.7891 28.2812 99.6406 28.2812 101.922C28.2812 104.188 28.75 106.047 29.6875 107.5C30.625 108.938 31.9844 109.656 33.7656 109.656C35.5156 109.656 36.8672 108.945 37.8203 107.523C38.7891 106.102 39.2734 104.234 39.2734 101.922ZM68.9688 103.867V88.7969H76.2344V115H69.25V110.242H68.9688C68.3906 111.773 67.4141 113.008 66.0391 113.945C64.6797 114.883 63.0156 115.344 61.0469 115.328C58.4062 115.344 56.2656 114.477 54.625 112.727C53 110.961 52.1875 108.547 52.1875 105.484V88.7969H59.4531V104.219C59.4531 105.75 59.8672 106.969 60.6953 107.875C61.5234 108.766 62.625 109.203 64 109.188C65.2969 109.203 66.4453 108.758 67.4453 107.852C68.4609 106.945 68.9688 105.617 68.9688 103.867ZM82.0469 115V88.7969H89.3125V115H82.0469ZM85.6797 85.4453C84.6016 85.4453 83.6719 85.0859 82.8906 84.3672C82.125 83.6484 81.7422 82.7812 81.7422 81.7656C81.7422 80.75 82.125 79.8906 82.8906 79.1875C83.6719 78.4688 84.6016 78.1094 85.6797 78.1094C86.7578 78.1094 87.6797 78.4688 88.4453 79.1875C89.2266 79.8906 89.6172 80.75 89.6172 81.7656C89.6172 82.7812 89.2266 83.6484 88.4453 84.3672C87.6797 85.0859 86.7578 85.4453 85.6797 85.4453ZM95.0078 115V110.664L107.805 94.7969V94.6094H95.4062V88.7969H116.547V93.5547L104.523 109V109.188H116.969V115H95.0078ZM137.805 78.4375L126.555 120.25H120.297L131.547 78.4375H137.805ZM158.078 103.867V88.7969H165.344V115H158.359V110.242H158.078C157.5 111.773 156.523 113.008 155.148 113.945C153.789 114.883 152.125 115.344 150.156 115.328C147.516 115.344 145.375 114.477 143.734 112.727C142.109 110.961 141.297 108.547 141.297 105.484V88.7969H148.562V104.219C148.562 105.75 148.977 106.969 149.805 107.875C150.633 108.766 151.734 109.203 153.109 109.188C154.406 109.203 155.555 108.758 156.555 107.852C157.57 106.945 158.078 105.617 158.078 103.867ZM171.156 115V88.7969H178.422V115H171.156ZM174.789 85.4453C173.711 85.4453 172.781 85.0859 172 84.3672C171.234 83.6484 170.852 82.7812 170.852 81.7656C170.852 80.75 171.234 79.8906 172 79.1875C172.781 78.4688 173.711 78.1094 174.789 78.1094C175.867 78.1094 176.789 78.4688 177.555 79.1875C178.336 79.8906 178.727 80.75 178.727 81.7656C178.727 82.7812 178.336 83.6484 177.555 84.3672C176.789 85.0859 175.867 85.4453 174.789 85.4453Z' fill='black'/></svg>"
   }
-]
+]
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #12145** (2026-10-05): chore: remove .cursor rules (@shadcn)
- **PR #12143** (2026-10-05): fix(registry): accept a byte order mark in components.json and package.json (@shadcn)
- **PR #12142** (2026-10-05): fix(registry): read components.json and package.json without cosmiconfig (@shadcn)
- **PR #12141** (2026-10-05): chore(release): version packages (@github-actions[bot])
- **PR #12140** (2026-10-05): fix(registry): skip npm audit and fund when installing dependencies (@shadcn)
- **PR #12139** (2026-10-05): test(registry): pin transformer and updater output before replacing ts-morph (@shadcn)
- **PR #12131** (2026-10-05): feat(registry): add community registries (@shadcn)
- **PR #12130** (closed): feat(registry): add `@colorshot` to directory (@rishimohan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
