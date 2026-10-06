# Forensic Learning Record (Deep Inspection): danielpetho/fancy

> **Canonical Artifact**: `07_PROJECT_LEARNING/danielpetho-fancy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/danielpetho/fancy](https://github.com/danielpetho/fancy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:02:53.202Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `danielpetho/fancy`
- **Description**: 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3220 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/hooks/use-debounced-dimensions.ts`
```
import { RefObject, useEffect, useState } from "react"

interface Dimensions {
  width: number
  height: number
}

export function useDimensions(
  ref: RefObject<HTMLElement | SVGElement | null>
): Dimensions {
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: 0,
    height: 0,
  })

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const updateDimensions = () => {
      if (ref.current) {
        const { width, height } = ref.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }

    const debouncedUpdateDimensions = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateDimensions, 250) // Wait 250ms after resize ends
    }

    // Initial measurement
    updateDimensions()

    window.addEventListener("resize", debouncedUpdateDimensions)

    return () => {
      window.removeEventListener("resize", debouncedUpdateDimensions)
      clearTimeout(timeoutId)
    }
  }, [ref])

  return dimensions
}

```

### Core Architecture Module: `src/hooks/use-detect-browser.ts`
```
import React from "react"

export default function useDetectBrowser() {
  if (typeof window === "undefined") return null

  let sBrowser,
    sUsrAg = navigator.userAgent
  const [browserName, setBrowserName] = React.useState("")

  React.useEffect(() => {
    if (sUsrAg.indexOf("Firefox") > -1) {
      sBrowser = "Firefox"
      // "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:61.0) Gecko/20100101 Firefox/61.0"
    } else if (sUsrAg.indexOf("SamsungBrowser") > -1) {
      sBrowser = "Samsung Internet"
      // "Mozilla/5.0 (Linux; Android 9; SAMSUNG SM-G955F Build/PPR1.180610.011) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/9.4 Chrome/67.0.3396.87 Mobile Safari/537.36
    } else if (sUsrAg.indexOf("Opera") > -1 || sUsrAg.indexOf("OPR") > -1) {
      sBrowser = "Opera"
      // "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 OPR/57.0.3098.106"
    } else if (sUsrAg.indexOf("Trident") > -1) {
      sBrowser = "IE"
      // "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; Zoom 3.6.0; wbx 1.0.0; rv:11.0) like Gecko"
    } else if (sUsrAg.indexOf("Edge") > -1) {
      sBrowser = "Edge"
      // "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 Edge/16.16299"
    } else if (sUsrAg.indexOf("Chrome") > -1) {
      sBrowser = "Chrome"
      // "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/66.0.3359.181 Chrome/66.0.3359.181 Safari/537.36"
    } else if (sUsrAg.indexOf("Safari") > -1) {
      sBrowser = "Safari"
      // "Mozilla/5.0 (iPhone; CPU iPhone OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15E148 Safari/604.1 980x1306"
    } else {
      sBrowser = "unknown"
    }
    setBrowserName(sBrowser)
  }, [])
  return browserName
}

```

### Core Architecture Module: `src/hooks/use-dimensions.ts`
```
import { RefObject, useEffect, useState } from "react"

interface Dimensions {
  width: number
  height: number
}

export function useDimensions(
  ref: RefObject<HTMLElement | SVGElement | null>
): Dimensions {
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: 0,
    height: 0,
  })

  useEffect(() => {
    const updateDimensions = () => {
      if (ref.current) {
        const { width, height } = ref.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)

    return () => window.removeEventListener("resize", updateDimensions)
  }, [ref])

  return dimensions
}

```

### Core Architecture Module: `src/hooks/use-elastic-line-events.ts`
```
import { useEffect, useState } from "react"

import { useDimensions } from "@/hooks/use-dimensions"
import { useMousePosition } from "@/hooks/use-mouse-position"

interface ElasticLineEvents {
  isGrabbed: boolean
  controlPoint: { x: number; y: number }
}

export function useElasticLineEvents(
  containerRef: React.RefObject<SVGSVGElement | null>,
  isVertical: boolean,
  grabThreshold: number,
  releaseThreshold: number
): ElasticLineEvents {
  const mousePosition = useMousePosition(containerRef)
  const dimensions = useDimensions(containerRef)
  const [isGrabbed, setIsGrabbed] = useState(false)
  const [controlPoint, setControlPoint] = useState({
    x: dimensions.width / 2,
    y: dimensions.height / 2,
  })

  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = dimensions
      const x = mousePosition.x
      const y = mousePosition.y

      // Check if mouse is outside container bounds
      const isOutsideBounds = x < 0 || x > width || y < 0 || y > height

      if (isOutsideBounds) {
        setIsGrabbed(false)
        return
      }

      let distance: number
      let newControlPoint: { x: number; y: number }

      if (isVertical) {
        const midX = width / 2
        distance = Math.abs(x - midX)
        newControlPoint = {
          x: midX + 2.2 * (x - midX),
          y: y,
        }
      } else {
        const midY = height / 2
        distance = Math.abs(y - midY)
        newControlPoint = {
          x: x,
          y: midY + 2.2 * (y - midY),
        }
      }

      setControlPoint(newControlPoint)

      if (!isGrabbed && distance < grabThreshold) {
        setIsGrabbed(true)
      } else if (isGrabbed && distance > releaseThreshold) {
        setIsGrabbed(false)
      }
    }
  }, [mousePosition, isVertical, isGrabbed, grabThreshold, releaseThreshold])

  return { isGrabbed, controlPoint }
}

```

### Core Architecture Module: `src/hooks/use-line-breakdown.ts`
```
import { RefObject, useEffect, useState } from "react"

interface UseLineBreakdownResult {
  lineCount: number
  lines: string[][]
}

export function useLineBreakdown(
  elementRef: RefObject<HTMLElement | null>,
  text: string
): UseLineBreakdownResult {
  const [breakdown, setBreakdown] = useState<UseLineBreakdownResult>({
    lineCount: 0,
    lines: [[]],
  })

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const calculateLines = () => {
      // Get basic measurements
      const style = window.getComputedStyle(element)
      const lineHeight = parseInt(style.lineHeight)
      const elementHeight = element.offsetHeight

      const linesCount = Math.ceil(elementHeight / lineHeight)

      console.log(elementHeight / lineHeight)

      // Create temporary elements to measure text
      const tempSpan = element.appendChild(document.createElement("span"))
      tempSpan.style.visibility = "hidden"
      tempSpan.style.position = "absolute"
      tempSpan.style.whiteSpace = "nowrap"
      element.appendChild(tempSpan)

      // Split text into words
      const words = text.split(" ")
      const lineGroups: string[][] = [[]]
      let currentLine = 0
      let previousTop = 0

      // Group words into lines
      words.forEach((word, index) => {
        tempSpan.textContent = word
        const rect = tempSpan.getBoundingClientRect()

        if (rect.top > previousTop && index > 0) {
          currentLine++
          lineGroups[currentLine] = []
          previousTop = rect.top
        }

        lineGroups[currentLine].push(word)
      })

      element.removeChild(tempSpan)

      setBreakdown({
        lineCount: lineGroups.length,
        lines: lineGroups,
      })
    }

    calculateLines()

    const resizeObserver = new ResizeObserver(calculateLines)
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [elementRef, text])

  return breakdown
}

```

### Core Architecture Module: `src/hooks/use-line-count.ts`
```
import { useEffect, useState } from "react"

export function useLineCount(element: HTMLElement) {
  const [lineCount, setLineCount] = useState(0)

  useEffect(() => {
    const calculateLines = () => {
      if (!element) return
      const elementHeight = element.offsetHeight
      const style = window.getComputedStyle(element)
      const lineHeight = parseInt(style.lineHeight)
      const lines = Math.floor(elementHeight / lineHeight)
      setLineCount(lines)
    }

    calculateLines()

    const resizeObserver = new ResizeObserver(calculateLines)
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [element])

  return lineCount
}

```

### Core Architecture Module: `src/hooks/use-mounted.ts`
```
import * as React from "react"

export function useMounted() {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return mounted
}

```

### Core Architecture Module: `src/hooks/use-mouse-position-ref.ts`
```
import { RefObject, useEffect, useRef } from "react"

export const useMousePositionRef = (
  containerRef?: RefObject<HTMLElement | SVGElement | null>
) => {
  const positionRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const updatePosition = (x: number, y: number) => {
      if (containerRef && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const relativeX = x - rect.left
        const relativeY = y - rect.top

        // Calculate relative position even when outside the container
        positionRef.current = { x: relativeX, y: relativeY }
      } else {
        positionRef.current = { x, y }
      }
    }

    const handleMouseMove = (ev: MouseEvent) => {
      updatePosition(ev.clientX, ev.clientY)
    }

    const handleTouchMove = (ev: TouchEvent) => {
      const touch = ev.touches[0]
      updatePosition(touch.clientX, touch.clientY)
    }

    // Listen for both mouse and touch events
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("touchmove", handleTouchMove)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("touchmove", handleTouchMove)
    }
  }, [containerRef])

  return positionRef
}

```

### Core Architecture Module: `src/hooks/use-mouse-position.ts`
```
import { RefObject, useEffect, useState } from "react"

export const useMousePosition = (
  containerRef?: RefObject<HTMLElement | SVGElement | null>
) => {
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const updatePosition = (x: number, y: number) => {
      if (containerRef && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const relativeX = x - rect.left
        const relativeY = y - rect.top

        // Calculate relative position even when outside the container
        setPosition({ x: relativeX, y: relativeY })
      } else {
        setPosition({ x, y })
      }
    }

    const handleMouseMove = (ev: MouseEvent) => {
      updatePosition(ev.clientX, ev.clientY)
    }

    const handleTouchMove = (ev: TouchEvent) => {
      const touch = ev.touches[0]
      updatePosition(touch.clientX, touch.clientY)
    }

    // Listen for both mouse and touch events
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("touchmove", handleTouchMove)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("touchmove", handleTouchMove)
    }
  }, [containerRef])

  return position
}

```

### Core Architecture Module: `src/hooks/use-mouse-vector.ts`
```
import { RefObject, useEffect, useState } from "react"

export const useMouseVector = (
  containerRef?: RefObject<HTMLElement | SVGElement | null>
) => {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [vector, setVector] = useState({ dx: 0, dy: 0 })

  useEffect(() => {
    let lastPosition = { x: 0, y: 0 }

    const updatePosition = (x: number, y: number) => {
      let newX, newY

      if (containerRef && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        newX = x - rect.left
        newY = y - rect.top
      } else {
        newX = x
        newY = y
      }

      // Calculate the movement vector
      const dx = newX - lastPosition.x
      const dy = newY - lastPosition.y

      setVector({ dx, dy })
      setPosition({ x: newX, y: newY })
      lastPosition = { x: newX, y: newY }
    }

    const handleMouseMove = (ev: MouseEvent) => {
      updatePosition(ev.clientX, ev.clientY)
    }

    const handleTouchMove = (ev: TouchEvent) => {
      const touch = ev.touches[0]
      updatePosition(touch.clientX, touch.clientY)
    }

    // Listen for both mouse and touch events
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("touchmove", handleTouchMove)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("touchmove", handleTouchMove)
    }
  }, [containerRef])

  return { position, vector }
}

```

### Core Architecture Module: `src/hooks/use-screen-size.ts`
```
import { useEffect, useState } from "react"

// Define the possible screen sizes as a const array for better type inference
const SCREEN_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl"] as const

// Create a union type from the array
export type ScreenSize = (typeof SCREEN_SIZES)[number]

// Type-safe size order mapping
const sizeOrder: Record<ScreenSize, number> = {
  xs: 0,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
  "2xl": 5,
} as const

class ComparableScreenSize {
  constructor(private value: ScreenSize) {}

  toString(): ScreenSize {
    return this.value
  }

  valueOf(): number {
    return sizeOrder[this.value]
  }

  // Add type predicate methods for better TypeScript support
  equals(other: ScreenSize): boolean {
    return this.value === other
  }

  lessThan(other: ScreenSize): boolean {
    return this.valueOf() < sizeOrder[other]
  }

  greaterThan(other: ScreenSize): boolean {
    return this.valueOf() > sizeOrder[other]
  }

  lessThanOrEqual(other: ScreenSize): boolean {
    return this.valueOf() <= sizeOrder[other]
  }

  greaterThanOrEqual(other: ScreenSize): boolean {
    return this.valueOf() >= sizeOrder[other]
  }
}

const useScreenSize = (): ComparableScreenSize => {
  const [screenSize, setScreenSize] = useState<ScreenSize>("xs")

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth

      if (width >= 1536) {
        setScreenSize("2xl")
      } else if (width >= 1280) {
        setScreenSize("xl")
      } else if (width >= 1024) {
        setScreenSize("lg")
      } else if (width >= 768) {
        setScreenSize("md")
      } else if (width >= 640) {
        setScreenSize("sm")
      } else {
        setScreenSize("xs")
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return new ComparableScreenSize(screenSize)
}

export default useScreenSize

```

### Core Architecture Module: `src/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function absoluteUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL}${path}`
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #43** (2025-06-09): **fix sitemap.xml**
  *Symptoms*: it returns 404
  **Post-Mortem & Fix Analysis**:
  > should be fixed [37cbceb](https://github.com/danielpetho/fancy/commit/37cbcebdc8f63490e0fda7f35e012a587750da7d)

- **Issue #38** (2025-06-01): **Copy button of install component is wrongly aligned**
  *Symptoms*: It happens when the command is less than 2 lines  ![Image](https://github.com/user-attachments/assets/e0b069b3-51c1-448a-a423-f811be711575)
  **Post-Mortem & Fix Analysis**:
  > should be good w/ #49

- **Issue #37** (2025-06-06): **Mobile Nav bottom unreachable**
  *Symptoms*: especially bad on iOS:  ![Image](https://github.com/user-attachments/assets/5bb4492c-57e1-4247-9fb2-13239743ff04)
  **Post-Mortem & Fix Analysis**:
  > fixed w/ latest merge

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

### Incident Patch 1: `f7e728f9` (2025-11-10)
**Commit Message**: Merge pull request #63 from danielpetho/feat/fix-ui-issues

Add some focus states and remove double nested buttons and links

**File**: `src/app/docs/[[...slug]]/page.tsx` (modified, +1/-1)
```diff
@@ -155,7 +155,7 @@ export default async function DocPage(props: DocPageProps) {
       {doc.toc && (
         <div className="hidden text-base xl:block sticky top-4 pt-0 pb-4 h-[calc(100vh-8rem)] pl-4">
           <div className="bg-background rounded-2xl border">
-            <ScrollArea className="pb-10 p-6">
+            <ScrollArea className="">
               <DashboardTableOfContents toc={toc} />
             </ScrollArea>
           </div>
```

**File**: `src/app/globals.css` (modified, +47/-0)
```diff
@@ -241,6 +241,47 @@
   }
 }
 
+@utility focus-outline {
+  position: relative;
+  
+  &::after {
+    content: '';
+    position: absolute;
+    inset: 0 -0.5rem;
+    inset-block: -0.25rem;
+    border: 2px solid transparent;
+    border-radius: 0.75rem;
+    pointer-events: none;
+    transform: scale(0.95);
+    opacity: 0;
+    /* transition: transform 200ms ease-out, opacity 200ms ease-out, border-color 200ms ease-out; */
+  }
+  
+  &:focus-visible {
+    outline: none;
+    
+    &::after {
+      border-color: var(--focus-outline-color, var(--color-primary-blue));
+      transform: scale(1);
+      opacity: 1;
+    }
+  }
+}
+
+@utility focus-ring {
+  outline: 2px solid transparent;
+  outline-offset: 2px;
+  /* transition: outline-color 200ms ease-out, outline-offset 200ms ease-out; */
+  
+  &:focus-visible {
+    outline-color: var(--focus-ring-color, var(--color-primary-blue));
+  }
+}
+
+@utility focus-primary {
+  @apply focus-outline [--focus-outline-color:var(--color-primary-blue)];
+}
+
 /*
   The default border color has changed to `currentColor` in Tailwind CSS v4,
   so we've added these compatibility styles to make sure everything still
@@ -366,6 +407,12 @@
     @apply border-border;
   }
 
+  *:focus-visible {
+    outline: 2px solid var(--color-primary-blue);
+    border-radius: 0.5rem;
+    outline-offset: 2px;
+  }
+
   body {
     @apply bg-background text-foreground;
   }
```

**File**: `src/components/component-card.tsx` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ export default function ComponentCard({ component }: ComponentCardProps) {
     >
       <Link
         href={`/docs/components/${component.category}/${component.name}`}
-        className="group relative aspect-video rounded-xl overflow-hidden border block"
+        className="group relative aspect-video rounded-xl overflow-hidden border block focus-ring"
       >
         {/* Thumbnail Image */}
         <Image
```

**File**: `src/components/component-preview.tsx` (modified, +5/-5)
```diff
@@ -113,7 +113,7 @@ export function ComponentPreview({
     <div
       data-algolia-ignore
       className={cn(
-        "group relative flex flex-col h-full w-full ",
+        "relative flex flex-col h-full w-full ",
         className
       )}
       {...props}
@@ -123,21 +123,21 @@ export function ComponentPreview({
           <TabsList className="w-full justify-start rounded-none p-0 h-9 bg-transparent space-x-3 px-3">
             <TabsTrigger
               value="preview"
-              className="relative text-base rounded-none border-b-transparent bg-transparent px-0 font-semibold text-muted-foreground shadow-none transition-colors duration-300 ease-out hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent"
+              className="relative text-base border-b-transparent bg-transparent px-0 font-semibold text-muted-foreground shadow-none transition-colors duration-300 ease-out hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue rounded-lg"
             >
               Demo
             </TabsTrigger>
             <TabsTrigger
               value="code"
-              className="relative text-base rounded-none border-b-transparent bg-transparent px-0 font-semibold text-muted-foreground shadow-none transition-colors duration-300 ease-out hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent"
+              className="relative text-base border-b-transparent bg-transparent px-0 font-semibold text-muted-foreground shadow-none transition-colors duration-300 ease-out hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue rounded-lg"
             >
               Code
             </TabsTrigger>
           </TabsList>
         </div>
         <TabsContent
           value="preview"
-          className="border border-black-500 flex rounded-2xl"
+          className="border border-black-500 flex rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
         >
           <div className="w-full flex items-center justify-center rounded-2xl min-h-[530px] overflow-hidden relative max-h-[530px]">
             {/* <div className="absolute top-4 right-4 rounded-full border">
@@ -159,7 +159,7 @@ export function ComponentPreview({
                         <Button
                           variant="outline"
                           size="sm"
-                          className="h-8 items-center flex justify-center"
+                          className="h-8 items-center flex justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
                         >
                           <Repeat className="mr-2 h-4 w-4" />
                           Remix
```

**File**: `src/components/copy-button.tsx` (modified, +4/-2)
```diff
@@ -4,9 +4,11 @@ import React, { useState, useRef } from 'react';
 import { Copy } from 'lucide-react';
 import { Button } from "@/components/ui/button";
 import { motion, TargetAndTransition, Variants } from 'motion/react';
+import { cn } from '@/lib/utils';
 
 interface CopyButtonProps {
   onCopy: () => Promise<void> | void;
+  className?: string;
 }
 
 const copyIconVariants: Variants = {
@@ -65,7 +67,7 @@ const checkPathVariants: Variants = {
 
 const MotionButton = motion.create(Button);
 
-export const CopyButton: React.FC<CopyButtonProps> = ({ onCopy }) => {
+export const CopyButton: React.FC<CopyButtonProps> = ({ onCopy, className }) => {
   const [status, setStatus] = useState<"idle" | "copying" | "copied">("idle");
   const [backgroundState, setBackgroundState] = useState<"hidden" | "entering" | "centered" | "leaving">("hidden");
   const [entryDirection, setEntryDirection] = useState({ x: 0, y: 0 });
@@ -190,7 +192,7 @@ export const CopyButton: React.FC<CopyButtonProps> = ({ onCopy }) => {
         onMouseLeave={handleMouseLeave}
         variant="ghost"
         size="icon"
-        className="relative text-muted-foreground cursor-pointer w-8 h-8 hover:text-white hover:scale-105 duration-300 transition ease-out hover:bg-transparent bg-none"
+        className={cn("relative text-muted-foreground cursor-pointer w-8 h-8 hover:text-white hover:scale-105 duration-300 transition-[scale,color,background-color,opacity] ease-out hover:bg-transparent bg-none focus:outline-none! focus-visible:ring-2! focus-visible:ring-offset-0! focus-visible:ring-white!", className)}
         aria-label="Copy code"
         whileTap={{ scale: 0.9 }}
         transition={{ type: "spring", stiffness: 400, damping: 30 }}
```

**File**: `src/components/copy-page-menu.tsx` (modified, +1/-1)
```diff
@@ -136,7 +136,7 @@ export function CopyPageMenu({ title, content, currentUrl }: CopyPageMenuProps)
     <DropdownMenu>
       <DropdownMenuTrigger asChild>
         <motion.button
-          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm cursor-pointer font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
+          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm cursor-pointer font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
           //whileTap={{ scale: 0.9 }}
           transition={{ type: "spring", stiffness: 400, damping: 30 }}
         >
```

**File**: `src/components/doc-pager.tsx` (modified, +38/-42)
```diff
@@ -7,6 +7,8 @@ import { NavItem, NavItemWithChildren } from "@/types/nav"
 import { Doc } from "@/types/types"
 import { docsConfig } from "@/config/docs"
 
+const MotionLink = motion.create(Link)
+
 interface DocsPagerProps {
   doc: Doc
 }
@@ -23,58 +25,52 @@ export function DocsPager({ doc }: DocsPagerProps) {
       className={`flex flex-row items-center ${pager.prev && pager.next ? "justify-between" : pager.next ? "justify-end" : "justify-start"} text`}
     >
       {pager?.prev?.href && (
-        <motion.div 
+        <MotionLink
+          href={pager.prev.href}
+          className="items-center flex flex-row justify-center bg-muted rounded-xl pl-2 pr-6 py-2 hover:bg-muted/60 duration-300 ease-out transition-[colors,background-color] focus-ring"
           whileHover="hover"
           whileTap={{ scale: 0.97 }}
         >
-          <Link
-            href={pager.prev.href}
-            className="items-center flex flex-row justify-center bg-muted rounded-xl pl-2 pr-6 py-2 hover:bg-muted/60 duration-300 ease-out transition"
-          >
-            <motion.p 
-              className="font-serif sm:mr-2 h-7 w-7 rotate-180"
-              variants={{
-                hover: {
-                  x: 5,
-                  transition: {
-                    duration: 0.3,
-                    ease: "easeOut"
-                  }
+          <motion.p 
+            className="font-serif sm:mr-2 h-7 w-7 rotate-180"
+            variants={{
+              hover: {
+                x: 5,
+                transition: {
+                  duration: 0.3,
+                  ease: "easeOut"
                 }
-              }}
-            >
-              &#8594;
-            </motion.p>
-            <span className="truncate hidden sm:block">{pager.prev.title}</span>
-          </Link>
-        </motion.div>
+              }
+            }}
+          >
+            &#8594;
+          </motion.p>
+          <span className="truncate hidden sm:block">{pager.prev.title}</span>
+        </MotionLink>
       )}
       {pager?.next?.href && (
-        <motion.div 
+        <MotionLink
+          href={pager.next.href}
+          className="flex flex-row hover:bg-muted/60 duration-300 ease-out transition-[colors,background-color] items-center justify-center rounded-xl pr-2 pl-6 py-2 bg-muted focus-ring"
           whileHover="hover"
           whileTap={{ scale: 0.97 }}
         >
-          <Link
-            href={pager.next.href}
-            className="flex flex-row hover:bg-muted/60 duration-300 ease-out transition items-center justify-center rounded-xl pr-2 pl-6 py-2 bg-muted"
-          >
-            <span className="truncate hidden sm:block">{pager.next.title}</span>
-            <motion.span 
-              className="font-serif h-7 w-7 sm:ml-2"
-              variants={{
-                hover: {
-                  x: 5,
-                  transition: {
-                    duration: 0.3,
-                    ease: "easeOut"
-                  }
+          <span className="truncate hidden sm:block">{pager.next.title}</span>
+          <motion.span 
+            className="font-serif h-7 w-7 sm:ml-2"
+            variants={{
+              hover: {
+                x: 5,
+                transition: {
+                  duration: 0.3,
+                  ease: "easeOut"
                 }
-              }}
-            >
-              &#8594;
-            </motion.span>
-          </Link>
-        </motion.div>
+              }
+            }}
+          >
+            &#8594;
+          </motion.span>
+        </MotionLink>
       )}
     </div>
   )
```

**File**: `src/components/footer.tsx` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ export function Footer() {
             built with 💙 by{" "}
             <a
               href="https://twitter.com/nonzeroexitcode"
-              className="cursor-pointer no-underline text-blue hover:text-blue-400 dark:hover:text-blue-300 dark:text-blue-400 duration-300 transition-colors ease-out inline-flex items-center font-medium"
+              className="cursor-pointer no-underline text-blue hover:text-blue-400 dark:hover:text-blue-300 dark:text-blue-400 duration-300 transition-[colors,text-color] ease-out inline-flex items-center font-medium focus-ring rounded-lg"
             >
               nonzeroexitcode
               <ExternalLinkIcon
```

---

### Incident Patch 2: `dc24be84` (2025-10-17)
**Commit Message**: tab fixes

**File**: `src/components/landing/hero-images.tsx` (modified, +26/-11)
```diff
@@ -44,24 +44,30 @@ export function HeroImages({ allComps }: { allComps: Component[] }) {
         depth={0.5}
         className="top-[15%] left-[2%] md:top-[25%] md:left-[5%] "
       >
-        <Link href={`${preLink}/blocks/image-trail`}>
+        <Link 
+          href={`${preLink}/blocks/image-trail`}
+          className="-rotate-[3deg] inline-block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
+        >
           <HoverVideo
             thumbnail={imageTrail.thumbnail.url}
             videoSrc={imageTrail.demo.url}
-            className="w-16 h-12 sm:w-24 sm:h-16 md:w-28 md:h-20 lg:w-32 lg:h-24 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform -rotate-[3deg] shadow-2xl rounded-xl"
+            className="w-16 h-12 sm:w-24 sm:h-16 md:w-28 md:h-20 lg:w-32 lg:h-24 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform shadow-2xl rounded-xl"
             delay={0.5}
           />
         </Link>
       </FloatingElement>
       <FloatingElement
         depth={1}
-        className="top-[0%] left-[8%] md:top-[6%] md:left-[11%] "
+        className="top-[0%] left-[8%] md:top-[6%] md:left-[11%]"
       >
-        <Link href={`${preLink}/text/text-highlighter`}>
+        <Link 
+          href={`${preLink}/text/text-highlighter`}
+          className="inline-block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
+        >
           <HoverVideo
             thumbnail={textHighlighter.thumbnail.url}
             videoSrc={textHighlighter.demo.url}
-            className="w-40 h-28 sm:w-48 sm:h-36 md:w-56 md:h-44 lg:w-60 lg:h-48 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform -rotate-12 shadow-2xl rounded-xl"
+            className="w-40 h-28 sm:w-48 sm:h-36 md:w-56 md:h-44 lg:w-60 lg:h-48 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform shadow-2xl rounded-xl"
             delay={0.7}
           />
         </Link>
@@ -71,11 +77,14 @@ export function HeroImages({ allComps }: { allComps: Component[] }) {
         depth={4}
         className="top-[90%] left-[6%] md:top-[80%] md:left-[8%]"
       >
-        <Link href={`${preLink}/text/gravity`}>
+        <Link 
+          href={`${preLink}/text/gravity`}
+          className="-rotate-[4deg] inline-block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
+        >
           <HoverVideo
             thumbnail={gravity.thumbnail.url}
             videoSrc={gravity.demo.url}
-            className="w-40 h-40 sm:w-48 sm:h-48 md:w-60 md:h-60 lg:w-64 lg:h-64 object-cover -rotate-[4deg] hover:scale-105 duration-200 cursor-pointer transition-transform shadow-2xl rounded-xl"
+            className="w-40 h-40 sm:w-48 sm:h-48 md:w-60 md:h-60 lg:w-64 lg:h-64 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform shadow-2xl rounded-xl"
             delay={0.9}
           />
         </Link>
@@ -84,11 +93,14 @@ export function HeroImages({ allComps }: { allComps: Component[] }) {
         depth={2}
         className="top-[0%] left-[87%] md:top-[2%] md:left-[83%]"
       >
-        <Link href={`${preLink}/blocks/css-box`}>
+        <Link 
+          href={`${preLink}/blocks/css-box`}
+          className="rotate-[6deg] inline-block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
+        >
           <HoverVideo
             thumbnail={cssBox.thumbnail.url}
             videoSrc={cssBox.demo.url}
-            className="w-40 h-36 sm:w-48 sm:h-44 md:w-60 md:h-52 lg:w-64 lg:h-56 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform shadow-2xl rotate-[6deg] rounded-xl"
+            className="w-40 h-36 sm:w-48 sm:h-44 md:w-60 md:h-52 lg:w-64 lg:h-56 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform shadow-2xl rounded-xl"
             delay={1.1}
           />
         </Link>
@@ -97,11 +109,14 @@ export function HeroImages({ allComps }: { allComps: Component[] }) {
         depth={1}
         className="top-[78%] left-[83%] md:top-[68%] md:left-[83%]"
       >
-        <Link href={`${preLink}/blocks/marquee-along-svg-path`}>
+        <Link 
+          href={`${preLink}/blocks/marquee-along-svg-path`}
+          className="rotate-[19deg] inline-block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
+        >
           <HoverVideo
             thumbnail={marqueePath.thumbnail.url}
             videoSrc={marqueePath.demo.url}
-            className="w-44 h-44 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-80 lg:h-80 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform shadow-2xl rotate-[19deg] rounded-xl"
+            className="w-44 h-44 sm:w-64 sm:h-64 md:w-72
```

**File**: `src/components/landing/landing-hero.tsx` (modified, +13/-11)
```diff
@@ -8,9 +8,11 @@ import TextRotate from "@/fancy/components/text/text-rotate"
 
 import { HeroImages } from "./hero-images"
 
+const MotionLink = motion.create(Link)
+
 export function LandingHero({ allComps }: { allComps: Component[] | null }) {
   return (
-    <section className="w-full h-screen overflow-hidden md:overflow-visible flex flex-col items-center justify-center relative">
+    <section className="w-full h-screen overflow-hidden md:overflow-clip overscroll-none flex flex-col items-center justify-center relative">
 
       {allComps && <HeroImages allComps={allComps} />}
 
@@ -68,8 +70,9 @@ export function LandingHero({ allComps }: { allComps: Component[] | null }) {
         </motion.p>
 
         <div className="flex flex-row justify-center space-x-4 items-center mt-10 sm:mt-16 md:mt-20 lg:mt-20 text-xs">
-          <motion.button
-            className="w-28 sm:w-32 md:w-36 lg:w-40 sm:text-base md:text-lg lg:text-xl font-medium tracking-tight text-background bg-foreground px-3 py-1.5 sm:px-4 sm:py-2 md:px-4 md:py-2 lg:px-5 lg:py-2.5 rounded-lg md:rounded-xl z-20 shadow-2xl whitespace-nowrap cursor-pointer"
+          <MotionLink
+            href="/docs/introduction"
+            className="w-28 sm:w-32 md:w-36 lg:w-40 sm:text-base md:text-lg lg:text-xl font-medium tracking-tight text-background bg-foreground px-3 py-1.5 sm:px-4 sm:py-2 md:px-4 md:py-2 lg:px-5 lg:py-2.5 rounded-lg md:rounded-xl z-20 shadow-2xl whitespace-nowrap cursor-pointer inline-block text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground"
             animate={{ opacity: 1, y: 0 }}
             initial={{ opacity: 0, y: 20 }}
             transition={{
@@ -86,12 +89,11 @@ export function LandingHero({ allComps }: { allComps: Component[] | null }) {
               transition: { type: "spring", damping: 30, stiffness: 400 },
             }}
           >
-            <Link href="/docs/introduction">
-              Check docs <span className="font-serif ml-1">→</span>
-            </Link>
-          </motion.button>
-          <motion.button
-            className="w-28 sm:w-32 md:w-36 lg:w-40 sm:text-base md:text-lg lg:text-xl font-medium tracking-tight text-white bg-blue dark:bg-blue-500 px-3 py-1.5 sm:px-4 sm:py-2 md:px-4 md:py-2 lg:px-5 lg:py-2.5 rounded-lg md:rounded-xl z-20 shadow-2xl whitespace-nowrap cursor-pointer" 
+            Check docs <span className="font-serif ml-1">→</span>
+          </MotionLink>
+          <MotionLink
+            href="https://github.com/danielpetho/fancy"
+            className="w-28 sm:w-32 md:w-36 lg:w-40 sm:text-base md:text-lg lg:text-xl font-medium tracking-tight text-white bg-blue dark:bg-blue-500 px-3 py-1.5 sm:px-4 sm:py-2 md:px-4 md:py-2 lg:px-5 lg:py-2.5 rounded-lg md:rounded-xl z-20 shadow-2xl whitespace-nowrap cursor-pointer inline-block text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-blue"
             animate={{ opacity: 1, y: 0 }}
             initial={{ opacity: 0, y: 20 }}
             transition={{
@@ -108,8 +110,8 @@ export function LandingHero({ allComps }: { allComps: Component[] | null }) {
               transition: { type: "spring", damping: 30, stiffness: 400 },
             }}
           >
-            <Link href="https://github.com/danielpetho/fancy">★ on GitHub</Link>
-          </motion.button>
+            ★ on GitHub
+          </MotionLink>
         </div>
       </div>
     </section>
```

**File**: `src/fancy/components/text/letter-3d-swap.tsx` (modified, +21/-10)
```diff
@@ -19,23 +19,34 @@ const splitIntoCharacters = (text: string): string[] => {
   return Array.from(text)
 }
 
-// handy function  to extract text from children
-const extractTextFromChildren = (children: React.ReactNode): string => {
+// handy function to extract text from children
+const extractTextFromChildren = (children: React.ReactNode): string | undefined => {
+  // Handle null/undefined
+  if (children == null) return ""
+
+  // Handle string
   if (typeof children === "string") return children
 
+  // Handle number
+  if (typeof children === "number") return String(children)
+
+  // Handle arrays (including fragments)
+  if (Array.isArray(children)) {
+    return children.map(extractTextFromChildren).join("")
+  }
+
+  // Handle React elements
   if (React.isValidElement(children)) {
     const props = (children as React.ReactElement).props
     const childText = (props as any).children as React.ReactNode
-    if (typeof childText === "string") return childText
-    if (React.isValidElement(childText)) {
+
+    // Recursively extract text from children
+    if (childText != null) {
       return extractTextFromChildren(childText)
     }
-  }
 
-  throw new Error(
-    "Letter3DSwap: Children must be a string or a React element containing a string. " +
-      "Complex nested structures are not supported."
-  )
+    return ""
+  }
 }
 
 /**
@@ -146,7 +157,7 @@ const Letter3DSwap = ({
 
   // Splitting the text into animation segments
   const characters = useMemo(() => {
-    const t = text.split(" ")
+    const t = text?.split(" ") ?? []
     const result = t.map((word: string, i: number) => ({
       characters: splitIntoCharacters(word),
       needsSpace: i !== t.length - 1,
```

**File**: `src/fancy/components/text/scroll-and-swap-text.tsx` (modified, +19/-8)
```diff
@@ -5,22 +5,33 @@ import { motion, useScroll, useTransform, useSpring } from "motion/react"
 import { cn } from "@/lib/utils"
 
 // handy function to extract text from children
-const extractTextFromChildren = (children: React.ReactNode): string => {
+const extractTextFromChildren = (children: React.ReactNode): string | undefined => {
+  // Handle null/undefined
+  if (children == null) return ""
+
+  // Handle string
   if (typeof children === "string") return children
 
+  // Handle number
+  if (typeof children === "number") return String(children)
+
+  // Handle arrays (including fragments)
+  if (Array.isArray(children)) {
+    return children.map(extractTextFromChildren).join("")
+  }
+
+  // Handle React elements
   if (React.isValidElement(children)) {
     const props = (children as React.ReactElement).props
     const childText = (props as any).children as React.ReactNode
-    if (typeof childText === "string") return childText
-    if (React.isValidElement(childText)) {
+
+    // Recursively extract text from children
+    if (childText != null) {
       return extractTextFromChildren(childText)
     }
-  }
 
-  throw new Error(
-    "ScrollAndSwapText: Children must be a string or a React element containing a string. " +
-      "Complex nested structures are not supported."
-  )
+    return ""
+  }
 }
 
 interface ScrollAndSwapTextProps {
```

---

### Incident Patch 3: `8a412bb0` (2025-10-13)
**Commit Message**: fix(registry): update import regex for transform

**File**: `src/scripts/build-registry-sources.ts` (modified, +13/-6)
```diff
@@ -38,19 +38,26 @@ function getSourceContent(filePath: string): string {
   }
 }
 
-  // Transform @/fancy/components imports to @/components/fancy/... 
+  // Transform @/fancy/components and @/fancy/examples imports to @/components/fancy/... 
   // so it will work with open in v0
 function transformImportPaths(content: string): string {
   let newContent = content
   
-  // Match import statements with @/fancy/components
+  // Match import statements with @/fancy/components or @/fancy/examples
   // Handles patterns like:
   // - import Foo from "@/fancy/components/text/bar"
-  // - import { Bar } from '@/fancy/components/blocks/baz'
-  const importRegex = /import\s+([^"'\n]+?)\s+from\s+['"]@\/fancy\/components(\/[^'"]*)?['"]/g
+  // - import { Bar } from '@/fancy/examples/blocks/baz'
+  // - Multi-line imports like:
+  //   import Foo, { 
+  //     Bar, 
+  //     Baz 
+  //   } from "@/fancy/components/something"
+  const importRegex = /import\s+([\s\S]+?)\s+from\s+['"]@\/fancy\/(components|examples)(\/[^'"]*)?['"]/g
   
-  newContent = newContent.replace(importRegex, (match, importPart, subPath) => {
-    // Transform: @/fancy/components/text/something -> @/components/fancy/text/something
+  newContent = newContent.replace(importRegex, (match, importPart, type, subPath) => {
+    // Transform: 
+    // - @/fancy/components/text/something -> @/components/fancy/text/something
+    // - @/fancy/examples/carousel/demo -> @/components/fancy/carousel/demo
     const newPath = subPath ? `@/components/fancy${subPath}` : '@/components/fancy'
     return `import ${importPart} from "${newPath}"`
   })
```

---

### Incident Patch 4: `0b20246e` (2025-10-13)
**Commit Message**: fix(registry): include all deps for demos in registry

**File**: `src/scripts/build-registry-index.ts` (modified, +2/-2)
```diff
@@ -329,8 +329,8 @@ function generateRegistryItem(
             : "registry:ui",
     files,
     author: getAuthor(name, type),
-    ...(componentDeps.length > 0 && {
-      registryDependencies: componentDeps,
+    ...(registryDependencies.length > 0 && {
+      registryDependencies: registryDependencies,
     }),
     ...(externalDeps.size > 0 || additionalConfig?.devDependencies
       ? {
```

**File**: `src/scripts/build-registry-sources.ts` (modified, +15/-3)
```diff
@@ -332,10 +332,22 @@ function processRegistryItem(name: string, item: any): any {
         return
       }
 
-      // Handle local references
+      // Handle local references (hooks, utils, components)
       const possibleName = importPath.split("/").pop() || ""
-      const registry = JSON.parse(fs.readFileSync(registryJsonPath, "utf-8"))
-      if (registry[possibleName] && possibleName !== name) {
+      
+      // Read and parse registry with schema format support
+      const registryData = JSON.parse(fs.readFileSync(registryJsonPath, "utf-8"))
+      let registryMap: any
+      if (registryData.items) {
+        registryMap = {}
+        registryData.items.forEach((item: any) => {
+          registryMap[item.name] = item
+        })
+      } else {
+        registryMap = registryData
+      }
+      
+      if (registryMap[possibleName] && possibleName !== name) {
         registryDeps.add(`https://fancycomponents.dev/r/${possibleName}.json`)
       }
     })
```

---

### Incident Patch 5: `f4e92ce4` (2025-10-13)
**Commit Message**: fix(registry): make iomports work with v0

**File**: `src/scripts/build-registry-sources.ts` (modified, +23/-0)
```diff
@@ -38,6 +38,26 @@ function getSourceContent(filePath: string): string {
   }
 }
 
+  // Transform @/fancy/components imports to @/components/fancy/... 
+  // so it will work with open in v0
+function transformImportPaths(content: string): string {
+  let newContent = content
+  
+  // Match import statements with @/fancy/components
+  // Handles patterns like:
+  // - import Foo from "@/fancy/components/text/bar"
+  // - import { Bar } from '@/fancy/components/blocks/baz'
+  const importRegex = /import\s+([^"'\n]+?)\s+from\s+['"]@\/fancy\/components(\/[^'"]*)?['"]/g
+  
+  newContent = newContent.replace(importRegex, (match, importPart, subPath) => {
+    // Transform: @/fancy/components/text/something -> @/components/fancy/text/something
+    const newPath = subPath ? `@/components/fancy${subPath}` : '@/components/fancy'
+    return `import ${importPart} from "${newPath}"`
+  })
+  
+  return newContent
+}
+
 function resolveColorInContent(content: string): string {
   const colorMappings = {
     "primary-red": "#ff5941",
@@ -134,6 +154,9 @@ function processItemFiles(registryItem: any): any[] {
 
     let content = getSourceContent(sourceFilePath)
 
+    // Apply import path transformations to all content
+    content = transformImportPaths(content)
+
     // Add appropriate extension for the path
     let extension =
       file.type === "registry:ui" || file.type === "registry:block"
```

---

### Incident Patch 6: `e28ede77` (2025-10-13)
**Commit Message**: fix copying

**File**: `src/components/copy-page-menu.tsx` (modified, +11/-3)
```diff
@@ -91,9 +91,16 @@ export function CopyPageMenu({ title, content, currentUrl }: CopyPageMenuProps)
     setStatus("copying")
     
     try {
-      // Create markdown content optimized for LLMs
-      const markdownContent = `# ${title}\n\n${content}\n\n---\n\nSource: ${currentUrl}`
-      await copyToClipboard(markdownContent)
+      const url = new URL(currentUrl)
+      const markdownPath = `${url.pathname}.md`
+      const response = await fetch(markdownPath)
+      
+      if (!response.ok) {
+        throw new Error(`Failed to fetch markdown: ${response.statusText}`)
+      }
+      
+      const fullMarkdownContent = await response.text()
+      await copyToClipboard(fullMarkdownContent)
       
       setTimeout(() => {
         setStatus("copied")
@@ -103,6 +110,7 @@ export function CopyPageMenu({ title, content, currentUrl }: CopyPageMenuProps)
         setStatus("idle")
       }, 2000)
     } catch (error) {
+      console.error("Failed to copy markdown:", error)
       setStatus("idle")
     }
   }
```

---

### Incident Patch 7: `52bdedb8` (2025-10-12)
**Commit Message**: fix(components): more type fix

**File**: `src/fancy/components/text/letter-3d-swap.tsx` (modified, +4/-3)
```diff
@@ -24,7 +24,8 @@ const extractTextFromChildren = (children: React.ReactNode): string => {
   if (typeof children === "string") return children
 
   if (React.isValidElement(children)) {
-    const childText = children.props.children
+    const props = (children as React.ReactElement).props
+    const childText = (props as any).children as React.ReactNode
     if (typeof childText === "string") return childText
     if (React.isValidElement(childText)) {
       return extractTextFromChildren(childText)
@@ -309,7 +310,7 @@ const CharBox = ({
       }}
     >
       {/* Front face */}
-      <div
+      <span
         className={cn("relative backface-hidden h-[1lh]", frontFaceClassName)}
         style={{
           transform: `${
@@ -322,7 +323,7 @@ const CharBox = ({
         }}
       >
         {char}
-      </div>
+      </span>
 
       {/* Second face - positioned based on rotation direction */}
       <span
```

**File**: `src/fancy/components/text/scroll-and-swap-text.tsx` (modified, +2/-1)
```diff
@@ -9,7 +9,8 @@ const extractTextFromChildren = (children: React.ReactNode): string => {
   if (typeof children === "string") return children
 
   if (React.isValidElement(children)) {
-    const childText = children.props.children
+    const props = (children as React.ReactElement).props
+    const childText = (props as any).children as React.ReactNode
     if (typeof childText === "string") return childText
     if (React.isValidElement(childText)) {
       return extractTextFromChildren(childText)
```

---

### Incident Patch 8: `99a99194` (2025-10-12)
**Commit Message**: fix type errors

**File**: `src/app/docs/[[...slug]]/page.tsx` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@ export const runtime = "nodejs"
 export const dynamic = "force-static"
 
 export async function generateMetadata(props: DocPageProps): Promise<Metadata> {
-  const params = await props.params;
+  const params = await props.params
   const doc = await getDocFromParams({ params })
 
   if (!doc) {
@@ -98,7 +98,7 @@ export function generateStaticParams() {
 }
 
 export default async function DocPage(props: DocPageProps) {
-  const params = await props.params;
+  const params = await props.params
   const doc = await getDocFromParams({ params })
 
   const toc = doc.toc
```

**File**: `src/app/not-found.tsx` (modified, +0/-3)
```diff
@@ -2,9 +2,6 @@
 
 import { useRef } from "react"
 import Link from "next/link"
-import { motion } from "motion/react"
-
-import { cn } from "@/lib/utils"
 import Screensaver from "@/fancy/components/blocks/screensaver"
 
 export default function NotFound() {
```

**File**: `src/lib/get-docs.ts` (modified, +2/-2)
```diff
@@ -3,13 +3,13 @@ import path from "node:path"
 import { mdxComponents } from "@/mdx-components"
 import { compileMDX } from "next-mdx-remote/rsc"
 
-import { Doc, DocPageProps } from "@/types/types"
+import { Doc } from "@/types/types"
 
 import { getTableOfContents } from "./toc"
 
 export const CONTENT_DIRECTORY = "/src/content/docs/"
 
-export async function getDocFromParams({ params }: DocPageProps): Promise<Doc> {
+export async function getDocFromParams({ params }: { params: { slug: string[] } }): Promise<Doc> {
   const source = fs.readFileSync(
     path.join(process.cwd(), CONTENT_DIRECTORY, params.slug.join("/")) + ".mdx",
     "utf8"
```

**File**: `src/types/types.ts` (modified, +2/-2)
```diff
@@ -22,9 +22,9 @@ export type NpmCommands = {
 }
 
 export interface DocPageProps {
-  params: {
+  params: Promise<{
     slug: string[]
-  }
+  }>
 }
 
 // CMS data
```

---

### Incident Patch 9: `5de966bd` (2025-10-12)
**Commit Message**: fix: do not use pnpm

**File**: `package-lock.json` (modified, +1/-1)
```diff
@@ -31,8 +31,8 @@
         "lucide-react": "^0.545.0",
         "matter-js": "^0.20.0",
         "mdast-util-toc": "^7.1.0",
-        "next": "15.5.3",
         "motion": "^12.23.24",
+        "next": "15.5.3",
         "next-mdx-remote": "^5.0.0",
         "next-themes": "^0.4.4",
         "poly-decomp": "^0.3.0",
```

---

### Incident Patch 10: `688e9c27` (2025-10-12)
**Commit Message**: fix(components): import

**File**: `src/fancy/examples/physics/elastic-line-demo.tsx` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 "use client"
 
-import { motion } from "motion/react"
+import { motion, Variants } from "motion/react"
 
 import ElasticLine from "@/fancy/components/physics/elastic-line"
 
```

---

### Incident Patch 11: `c5fe1312` (2025-10-12)
**Commit Message**: fix(components): various type fixing for demos

**File**: `src/fancy/examples/physics/elastic-line-demo.tsx` (modified, +3/-3)
```diff
@@ -39,7 +39,7 @@ export default function Preview() {
       <div className="h-full flex flex-col py-6 w-full px-6 sm:px-8 md:px-12 font-light">
         <div className="h-1/2 py-8 w-full items-end flex">
           <motion.p
-            variants={textVariants}
+            variants={textVariants as Variants}
             initial="hidden"
             animate="visible"
             className="uppercase text-4xl sm:text-5xl md:text-6xl font-medium"
@@ -50,7 +50,7 @@ export default function Preview() {
         </div>
         <div className="flex flex-row  pt-8 justify-between items-start gap-x-4">
           <motion.p
-            variants={textVariants}
+            variants={textVariants as Variants}
             initial="hidden"
             animate="visible"
             className="w-1/3 uppercase md:text-7xl hidden md:block text-orange-500"
@@ -59,7 +59,7 @@ export default function Preview() {
             ✽
           </motion.p>
           <motion.p
-            variants={textVariants}
+            variants={textVariants as Variants}
             initial="hidden"
             animate="visible"
             className="w-full md:w-2/3 sm:text-left text-base sm:text-xl md:text-2xl"
```

**File**: `src/fancy/examples/text/text-highlighter-demo.tsx` (modified, +18/-17)
```diff
@@ -4,6 +4,7 @@ import { useEffect, useRef } from "react"
 import Lenis from "lenis"
 
 import { TextHighlighter } from "@/fancy/components/text/text-highlighter"
+import { Transition } from "motion"
 
 export default function TextHighlighterDemo() {
   const containerRef = useRef<HTMLDivElement | null>(null)
@@ -50,7 +51,7 @@ export default function TextHighlighterDemo() {
               disposal.{" "}
               <TextHighlighter
                 className={highlightClass}
-                transition={transition}
+                transition={transition as Transition}
                 highlightColor={highlightColor}
                 useInViewOptions={inViewOptions}
               >
@@ -59,7 +60,7 @@ export default function TextHighlighterDemo() {
               hundreds of different types have been designed and cast in lead.{" "}
               <TextHighlighter
                 className={highlightClass}
-                transition={transition}
+                transition={transition as Transition}
                 highlightColor={highlightColor}
                 useInViewOptions={inViewOptions}
               >
@@ -72,7 +73,7 @@ export default function TextHighlighterDemo() {
             <p>
               <TextHighlighter
                 className={highlightClass}
-                transition={transition}
+                transition={transition as Transition}
                 highlightColor={highlightColor}
                 useInViewOptions={inViewOptions}
               >
@@ -81,7 +82,7 @@ export default function TextHighlighterDemo() {
               It is left to his feeling for form to use{" "}
               <TextHighlighter
                 className={highlightClass}
-                transition={transition}
+                transition={transition as Transition}
                 highlightColor={highlightColor}
                 useInViewOptions={inViewOptions}
               >
@@ -98,7 +99,7 @@ export default function TextHighlighterDemo() {
               importance for the{" "}
               <TextHighlighter
                 className={highlightClass}
-                transition={transition}
+                transition={transition as Transition}
                 highlightColor={highlightColor}
                 useInViewOptions={inViewOptions}
               >
@@ -110,7 +111,7 @@ export default function TextHighlighterDemo() {
               the impression created.{" "}
               <TextHighlighter
                 className={highlightClass}
-                transition={transition}
+                transition={transition as Transition}
                 highlightColor={highlightColor}
                 useInViewOptions={inViewOptions}
               >
@@ -126,7 +127,7 @@ export default function TextHighlighterDemo() {
             <p>
               <TextHighlighter
                 className={highlightClass}
-                transition={transition}
+                transition={transition as Transition}
                 highlightColor={highlightColor}
                 useInViewOptions={inViewOptions}
               >
@@ -135,7 +136,7 @@ export default function TextHighlighterDemo() {
               of{" "}
               <TextHighlighter
                 className={highlightClass}
-                transition={transition}
+                transition={transition as Transition}
                 highlightColor={highlightColor}
                 useInViewOptions={inViewOptions}
               >
@@ -150,7 +151,7 @@ export default function TextHighlighterDemo() {
               The lead type designs of{" "}
               <TextHighlighter
                 className={highlightClass}
-                transition={transition}
+                transition={transition as Transition}
                 highlightColor={highlightColor}
                 useInViewOptions={inViewOptions}
               >
@@ -164,7 +165,7 @@ export default function TextHighlighterDemo() {
             <p>
               <TextHighlighter
                 className={highlightClass}
-                transition={transition}
+                transition={transition as Transition}
                 highlightColor={highlightColor}
                 useInViewOptions={inViewOptions}
               >
@@ -176,7 +177,7 @@ export default function TextHighlighterDemo() {
               few of these have gained acceptance.{" "}
               <TextHighlighter
                 className={highlightClass}
-                transition={transition}
+                transition={transition as Transition}
                 highlightColor={highlightColor}
                 useInViewOptions={inViewOptions}
               >
@@ -193,7 +194,7 @@ export default function TextHighlighterDemo() {
               trouble when creating graphic designs to{" "}
               <TextHighlighter
                 className={highlightClass}
-                transition={transition}
+                transition={transition as Transition}
                 highlightColor={highlightColo
```

**File**: `src/fancy/examples/text/text-highlighter-ref-demo.tsx` (modified, +9/-8)
```diff
@@ -6,6 +6,7 @@ import {
   TextHighlighter,
   TextHighlighterRef,
 } from "@/fancy/components/text/text-highlighter"
+import { Transition } from "motion"
 
 export default function TextHighlighterDemo() {
   const containerRef = useRef<HTMLDivElement | null>(null)
@@ -48,7 +49,7 @@ export default function TextHighlighterDemo() {
                   }}
                   triggerType="ref"
                   className={highlightClass}
-                  transition={transition}
+                  transition={transition as Transition}
                   highlightColor={highlightColor}
                 >
                   Gutenberg
@@ -61,7 +62,7 @@ export default function TextHighlighterDemo() {
                   }}
                   triggerType="ref"
                   className={highlightClass}
-                  transition={transition}
+                  transition={transition as Transition}
                   highlightColor={highlightColor}
                 >
                   most recent technical developments
@@ -81,7 +82,7 @@ export default function TextHighlighterDemo() {
                   }}
                   triggerType="ref"
                   className={highlightClass}
-                  transition={transition}
+                  transition={transition as Transition}
                   highlightColor={highlightColor}
                 >
                   functional, aesthetic and psychological effect
@@ -102,7 +103,7 @@ export default function TextHighlighterDemo() {
                   }}
                   triggerType="ref"
                   className={highlightClass}
-                  transition={transition}
+                  transition={transition as Transition}
                   highlightColor={highlightColor}
                 >
                   Garamond, Caslon, Bodoni, Walbaum
@@ -122,7 +123,7 @@ export default function TextHighlighterDemo() {
                   }}
                   triggerType="ref"
                   className={highlightClass}
-                  transition={transition}
+                  transition={transition as Transition}
                   highlightColor={highlightColor}
                 >
                   Berthold, Helvetica, Folio, Univers
@@ -141,7 +142,7 @@ export default function TextHighlighterDemo() {
                   }}
                   triggerType="ref"
                   className={highlightClass}
-                  transition={transition}
+                  transition={transition as Transition}
                   highlightColor={highlightColor}
                 >
                   The creators of these type designs
@@ -156,7 +157,7 @@ export default function TextHighlighterDemo() {
                   }}
                   triggerType="ref"
                   className={highlightClass}
-                  transition={transition}
+                  transition={transition as Transition}
                   highlightColor={highlightColor}
                 >
                   alphabet of Garamond
@@ -175,7 +176,7 @@ export default function TextHighlighterDemo() {
                   }}
                   triggerType="ref"
                   className={highlightClass}
-                  transition={transition}
+                  transition={transition as Transition}
                   highlightColor={highlightColor}
                 >
                   sketch words and sentences by hand
```

**File**: `src/fancy/examples/text/text-highlighter-scroll-demo.tsx` (modified, +23/-23)
```diff
@@ -1,7 +1,7 @@
 "use client"
 
 import React, { useEffect, useRef, useState } from "react"
-import { motion, useInView } from "motion/react"
+import { motion, Transition, useInView } from "motion/react"
 
 import { TextHighlighter } from "@/fancy/components/text/text-highlighter"
 
@@ -110,7 +110,7 @@ export default function TextHighlighterDemo() {
               highlightColor={HIGHLIGHT_COLOR}
               direction={scrollDirection}
               useInViewOptions={DEMO_USE_IN_VIEW_OPTIONS}
-              transition={DEMO_TRANSITION}
+              transition={DEMO_TRANSITION as Transition}
             >
               object detection systems
             </TextHighlighter>
@@ -119,7 +119,7 @@ export default function TextHighlighterDemo() {
               highlightColor={HIGHLIGHT_COLOR}
               direction={scrollDirection}
               useInViewOptions={DEMO_USE_IN_VIEW_OPTIONS}
-              transition={DEMO_TRANSITION}
+              transition={DEMO_TRANSITION as Transition}
             >
               facial recognition
             </TextHighlighter>
@@ -135,7 +135,7 @@ export default function TextHighlighterDemo() {
               highlightColor={HIGHLIGHT_COLOR}
               direction={scrollDirection}
               useInViewOptions={DEMO_USE_IN_VIEW_OPTIONS}
-              transition={DEMO_TRANSITION}
+              transition={DEMO_TRANSITION as Transition}
             >
               traffic monitoring
             </TextHighlighter>
@@ -144,7 +144,7 @@ export default function TextHighlighterDemo() {
               highlightColor={HIGHLIGHT_COLOR}
               direction={scrollDirection}
               useInViewOptions={DEMO_USE_IN_VIEW_OPTIONS}
-              transition={DEMO_TRANSITION}
+              transition={DEMO_TRANSITION as Transition}
             >
               inventory management
             </TextHighlighter>
@@ -163,7 +163,7 @@ export default function TextHighlighterDemo() {
               highlightColor={HIGHLIGHT_COLOR}
               direction={scrollDirection}
               useInViewOptions={DEMO_USE_IN_VIEW_OPTIONS}
-              transition={DEMO_TRANSITION}
+              transition={DEMO_TRANSITION as Transition}
             >
               video analytics
             </TextHighlighter>
@@ -172,7 +172,7 @@ export default function TextHighlighterDemo() {
               highlightColor={HIGHLIGHT_COLOR}
               direction={scrollDirection}
               useInViewOptions={DEMO_USE_IN_VIEW_OPTIONS}
-              transition={DEMO_TRANSITION}
+              transition={DEMO_TRANSITION as Transition}
             >
               object tracking algorithms
             </TextHighlighter>
@@ -187,7 +187,7 @@ export default function TextHighlighterDemo() {
               highlightColor={HIGHLIGHT_COLOR}
               direction={scrollDirection}
               useInViewOptions={DEMO_USE_IN_VIEW_OPTIONS}
-              transition={DEMO_TRANSITION}
+              transition={DEMO_TRANSITION as Transition}
             >
               Scene understanding
             </TextHighlighter>
@@ -199,7 +199,7 @@ export default function TextHighlighterDemo() {
               highlightColor={HIGHLIGHT_COLOR}
               direction={scrollDirection}
               useInViewOptions={DEMO_USE_IN_VIEW_OPTIONS}
-              transition={DEMO_TRANSITION}
+              transition={DEMO_TRANSITION as Transition}
             >
               sports performance analysis
             </TextHighlighter>
@@ -208,7 +208,7 @@ export default function TextHighlighterDemo() {
               highlightColor={HIGHLIGHT_COLOR}
               direction={scrollDirection}
               useInViewOptions={DEMO_USE_IN_VIEW_OPTIONS}
-              transition={DEMO_TRANSITION}
+              transition={DEMO_TRANSITION as Transition}
             >
               surveillance systems
             </TextHighlighter>
@@ -223,7 +223,7 @@ export default function TextHighlighterDemo() {
               highlightColor={HIGHLIGHT_COLOR}
               direction={scrollDirection}
               useInViewOptions={DEMO_USE_IN_VIEW_OPTIONS}
-              transition={DEMO_TRANSITION}
+              transition={DEMO_TRANSITION as Transition}
             >
               OCR technology
             </TextHighlighter>
@@ -235,7 +235,7 @@ export default function TextHighlighterDemo() {
               highlightColor={HIGHLIGHT_COLOR}
               direction={scrollDirection}
               useInViewOptions={DEMO_USE_IN_VIEW_OPTIONS}
-              transition={DEMO_TRANSITION}
+              transition={DEMO_TRANSITION as Transition}
             >
               Document automation
             </TextHighlighter>
@@ -248,7 +248,7 @@ export default function TextHighlighterDemo() {
               highlightColor={HIGHLIGHT_COLOR}
               direction={scrollDirection}
               useInViewOptions={DEMO_USE_IN_VIEW_OPTIONS}
-              transition={DEMO_TRANSITION}
+              transi
```

---

### Incident Patch 12: `916fcd1c` (2025-10-12)
**Commit Message**: fix(components): ref/state issues

**File**: `src/fancy/components/blocks/simple-marquee.tsx` (modified, +3/-4)
```diff
@@ -61,13 +61,13 @@ const SimpleMarquee = ({
   grabCursor = false,
   easing,
 }: SimpleMarqueeProps) => {
-  const innerContainer = useRef<HTMLDivElement>(null)
   const baseX = useMotionValue(0)
   const baseY = useMotionValue(0)
 
   const { scrollY } = useScroll({
-    container:
-      (scrollContainer as RefObject<HTMLDivElement>) || innerContainer.current,
+    ...(scrollContainer && {
+      container: scrollContainer as RefObject<HTMLDivElement>,
+    }),
   })
 
   const scrollVelocity = useVelocity(scrollY)
@@ -251,7 +251,6 @@ const SimpleMarquee = ({
       onPointerMove={handlePointerMove}
       onPointerUp={handlePointerUp}
       onPointerCancel={handlePointerUp}
-      ref={innerContainer}
     >
       {Array.from({ length: repeat }, (_, i) => i).map((i) => (
         <motion.div
```

**File**: `src/fancy/components/blocks/stacking-cards.tsx` (modified, +3/-3)
```diff
@@ -22,7 +22,7 @@ import { cn } from "@/lib/utils"
 interface StackingCardsProps
   extends PropsWithChildren,
     HTMLAttributes<HTMLDivElement> {
-  scrollOptons?: UseScrollOptions
+  scrollOptions?: UseScrollOptions
   scaleMultiplier?: number
   totalCards: number
 }
@@ -37,15 +37,15 @@ interface StackingCardItemProps
 export default function StackingCards({
   children,
   className,
-  scrollOptons,
+  scrollOptions,
   scaleMultiplier,
   totalCards,
   ...props
 }: StackingCardsProps) {
   const targetRef = useRef<HTMLDivElement>(null)
   const { scrollYProgress } = useScroll({
     offset: ["start start", "end end"],
-    ...scrollOptons,
+    ...scrollOptions,
     target: targetRef,
   })
 
```

**File**: `src/fancy/components/text/text-along-path.tsx` (modified, +1/-2)
```diff
@@ -89,15 +89,14 @@ const AnimatedPathText = ({
   scrollOffset = ["start end", "end end"],
   scrollTransformValues = [0, 100],
 }: AnimatedPathTextProps) => {
-  const container = useRef<HTMLDivElement>(null)
   const textPathRefs = useRef<SVGTextPathElement[]>([])
 
   // naive id for the path. you should rather use yours :)
   const id =
     pathId || `animated-path-${Math.random().toString(36).substring(7)}`
 
   const { scrollYProgress } = useScroll({
-    container: scrollContainer || container,
+    ...(scrollContainer && { container: scrollContainer }),
     offset: scrollOffset,
   })
 
```

**File**: `src/fancy/examples/blocks/simple-marquee-3d-demo.tsx` (modified, +9/-9)
```diff
@@ -1,5 +1,5 @@
-import React, { useEffect, useState } from "react"
-import { motion } from "motion/react"
+import React, { useEffect, useRef, useState } from "react"
+import { motion, Variants } from "motion/react"
 
 import { cn } from "@/lib/utils"
 import SimpleMarquee from "@/fancy/components/blocks/simple-marquee"
@@ -77,7 +77,7 @@ const hardcodedAlbums: Album[] = [
 export default function SimpleMarqueeDemo() {
   const [albums, setAlbums] = useState<Album[]>([])
   const [loading, setLoading] = useState(true)
-  const [container, setContainer] = useState<HTMLElement | null>(null)
+  const container = useRef<HTMLDivElement>(null)
 
   useEffect(() => {
     // Simulate loading time
@@ -156,9 +156,9 @@ export default function SimpleMarqueeDemo() {
         className={containerClasses}
         initial="initial"
         whileHover="hover"
-        variants={variants}
+        variants={variants as Variants}
       >
-        <motion.div className={textContainerClasses} variants={textVariants}>
+        <motion.div className={textContainerClasses} variants={textVariants as Variants}>
           <h3 className="text-white text-sm sm:text-base md:text-lg font-medium z-30">
             {album.title}
           </h3>
@@ -171,7 +171,7 @@ export default function SimpleMarqueeDemo() {
           alt={`${album.title} by ${album.artist}`}
           draggable={false}
           className={imageClasses}
-          variants={imageVariants}
+          variants={imageVariants as Variants}
         />
       </motion.div>
     )
@@ -180,7 +180,7 @@ export default function SimpleMarqueeDemo() {
   return (
     <div
       className="flex w-full h-full relative justify-center items-center flex-col bg-black overflow-y-auto overflow-x-hidden"
-      ref={(node) => setContainer(node)}
+      ref={container}
     >
       <h1 className="absolute text-center text-3xl sm:text-5xl md:text-6xl top-1/4 text-white font-calendas">
         Weekly Mix
@@ -207,7 +207,7 @@ export default function SimpleMarqueeDemo() {
               slowdownOnHover
               slowDownSpringConfig={{ damping: 60, stiffness: 300 }}
               scrollAwareDirection={true}
-              scrollContainer={{ current: container }}
+              scrollContainer={container}
               useScrollVelocity={true}
               direction="left"
             >
@@ -226,7 +226,7 @@ export default function SimpleMarqueeDemo() {
               slowDownFactor={0.2}
               slowDownSpringConfig={{ damping: 60, stiffness: 300 }}
               useScrollVelocity={true}
-              scrollContainer={{ current: container }}
+              scrollContainer={container}
               draggable={false}
               direction="right"
             >
```

**File**: `src/fancy/examples/blocks/simple-marquee-demo.tsx` (modified, +6/-6)
```diff
@@ -1,4 +1,4 @@
-import React, { useState } from "react"
+import React, { useRef } from "react"
 
 import SimpleMarquee from "@/fancy/components/blocks/simple-marquee"
 
@@ -39,12 +39,12 @@ export default function SimpleMarqueeDemo() {
     Math.floor((2 * exampleImages.length) / 3)
   )
 
-  const [container, setContainer] = useState<HTMLElement | null>(null)
+  const container = useRef<HTMLDivElement>(null)
 
   return (
     <div
       className="flex w-full h-full relative justify-center items-center flex-col bg-black overflow-auto"
-      ref={(node) => setContainer(node)}
+      ref={container}
     >
       <h1 className="absolute text-center text-3xl sm:text-5xl md:text-6xl top-1/3 sm:top-1/3 md:top-1/4 text-white font-calendas">
         Weekly Finds
@@ -60,7 +60,7 @@ export default function SimpleMarqueeDemo() {
           slowdownOnHover
           slowDownSpringConfig={{ damping: 60, stiffness: 300 }}
           scrollAwareDirection={true}
-          scrollContainer={{ current: container }}
+          scrollContainer={container}
           useScrollVelocity={true}
           direction="left"
         >
@@ -85,7 +85,7 @@ export default function SimpleMarqueeDemo() {
           slowDownFactor={0.1}
           slowDownSpringConfig={{ damping: 60, stiffness: 300 }}
           useScrollVelocity={true}
-          scrollContainer={{ current: container }}
+          scrollContainer={container}
           draggable={false}
           direction="right"
         >
@@ -110,7 +110,7 @@ export default function SimpleMarqueeDemo() {
           slowdownOnHover
           slowDownSpringConfig={{ damping: 60, stiffness: 300 }}
           scrollAwareDirection={true}
-          scrollContainer={{ current: container }}
+          scrollContainer={container}
           useScrollVelocity={true}
           direction="left"
         >
```

**File**: `src/fancy/examples/blocks/simple-marquee-drag-demo.tsx` (modified, +5/-5)
```diff
@@ -1,4 +1,4 @@
-import React, { useState } from "react"
+import React, { useRef } from "react"
 import { motion } from "motion/react"
 
 import SimpleMarquee from "@/fancy/components/blocks/simple-marquee"
@@ -42,12 +42,12 @@ const MarqueeItem = ({
 )
 
 export default function SimpleMarqueeDemo() {
-  const [container, setContainer] = useState<HTMLElement | null>(null)
+  const container = useRef<HTMLDivElement>(null)
 
   return (
     <div
       className="flex w-full h-full relative justify-center items-center flex-col bg-black overflow-y-auto overflow-x-hidden"
-      ref={(node) => setContainer(node)}
+      ref={container}
     >
       <h1 className="absolute text-center text-3xl sm:text-5xl md:text-6xl top-32 sm:top-1/4 text-white font-calendas">
         <VerticalCutReveal splitBy="characters" staggerDuration={0.04}>
@@ -64,7 +64,7 @@ export default function SimpleMarqueeDemo() {
           useScrollVelocity={true}
           scrollAwareDirection={true}
           scrollSpringConfig={{ damping: 50, stiffness: 400 }}
-          scrollContainer={{ current: container }}
+          scrollContainer={container}
           dragAwareDirection={true}
           grabCursor
           direction="left"
@@ -90,7 +90,7 @@ export default function SimpleMarqueeDemo() {
           useScrollVelocity={true}
           scrollAwareDirection={true}
           scrollSpringConfig={{ damping: 50, stiffness: 400 }}
-          scrollContainer={{ current: container }}
+          scrollContainer={container}
           dragAwareDirection={true}
           grabCursor
           direction="right"
```

**File**: `src/fancy/examples/blocks/stacking-cards-demo.tsx` (modified, +4/-4)
```diff
@@ -2,7 +2,7 @@
 
 "use client"
 
-import { useState } from "react"
+import { useRef } from "react"
 import Image from "next/image"
 
 import { cn } from "@/lib/utils"
@@ -54,16 +54,16 @@ const cards = [
 ]
 
 export default function StackingCardsDemo() {
-  const [container, setContainer] = useState<HTMLElement | null>(null)
+  const container = useRef<HTMLDivElement>(null)
 
   return (
     <div
       className="h-[620px] bg-white overflow-auto text-white"
-      ref={(node) => setContainer(node)}
+      ref={container}
     >
       <StackingCards
         totalCards={cards.length}
-        scrollOptons={{ container: { current: container } }}
+        scrollOptions={{ container: container }}
       >
         <div className="relative font-calendas h-[620px] w-full z-10 text-2xl md:text-7xl font-bold uppercase flex justify-center items-center text-primary-red whitespace-pre">
           Scroll down ↓
```

**File**: `src/fancy/examples/text/text-along-path-scroll-demo.tsx` (modified, +4/-4)
```diff
@@ -1,9 +1,9 @@
-import { useState } from "react"
+import { useRef } from "react"
 
 import AnimatedPathText from "@/fancy/components/text/text-along-path"
 
 export default function Preview() {
-  const [container, setContainer] = useState<HTMLElement | null>(null)
+  const container = useRef<HTMLDivElement>(null)
 
   const paths = [
     "M1 254C177 219 61 -64 269 15C477 94 332 285 214 348C96 411 155 546 331 486C507 426 410 267 667 215C872.6 173.4 951.333 264.333 965 315",
@@ -29,7 +29,7 @@ export default function Preview() {
   return (
     <div
       className="w-full h-full overflow-auto relative font-calendas"
-      ref={(node) => setContainer(node)}
+      ref={container}
     >
       <div className="h-[200%] absolute top-0 left-0 w-full flex flex-col items-center mt-40 text-4xl">
         <p>SCROLL DOWN</p>
@@ -40,7 +40,7 @@ export default function Preview() {
             key={`path-${i}`}
             path={path}
             // showPath
-            scrollContainer={{ current: container }}
+            scrollContainer={container}
             pathId={`flowing-path-${i}`}
             svgClassName={`absolute -left-[100px] top-0 w-[calc(100%+200px)] h-full`}
             viewBox="0 0 900 600"
```

---

### Incident Patch 13: `7771ee11` (2025-10-12)
**Commit Message**: fix(comp): remove layouteffect

**File**: `src/fancy/components/text/scroll-and-swap-text.tsx` (modified, +0/-1)
```diff
@@ -91,7 +91,6 @@ const ScrollAndSwapText = ({
     container: containerRef,
     target: ref,
     offset: offset as any, // framer motion doesnt export the type, so we have to cast it, sorry :/
-    layoutEffect: false,
   })
 
   // Apply spring physics to smooth the scroll-based animation
```

---

### Incident Patch 14: `956ddcd7` (2025-10-12)
**Commit Message**: fix: types;eslint turporepo ref;contributing docs

**File**: `.eslintrc.json` (modified, +0/-1)
```diff
@@ -3,7 +3,6 @@
   "root": true,
   "extends": [
     "next/core-web-vitals",
-    "turbo",
     "prettier",
     "plugin:tailwindcss/recommended"
   ],
```

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ author: johndoe <https://example.com>
 ```
 
 5. The first node after the header should be a `ComponentPreview` component, which will render the main demo of the component.
-6. Then, a header called `Installation`. There should be a `Tabs` component there, with two tabs: `CLI` and `Manual`. The `CLI` tab should contain the command to install the component with `npx shadcn@latest add "https://fancycomponents.dev/r/component-name.json"`. The `Manual` tab should contain the source code of the component referenced in a `ComponentSource` component.
+6. Then, a header called `Installation`. There should be a `Tabs` component there, with two tabs: `CLI` and `Manual`. The `CLI` tab should contain the command to install the component with `shadcn add @fancy/{component-name}"` wrapped in an `InstallTabs` component. The `Manual` tab should contain the source code of the component referenced in a `ComponentSource` component.
 7. If the component uses hooks, or need to add other dependencies, make sure to include them in that section, in a `ComponentSource` component.
 8. Add an `Usage` and/or `Understanding the component` section, if applicable.
 9. Add an `Examples` section, if applicable.
```

**File**: `src/components/copy-button.tsx` (modified, +2/-2)
```diff
@@ -3,7 +3,7 @@
 import React, { useState, useRef } from 'react';
 import { Copy } from 'lucide-react';
 import { Button } from "@/components/ui/button";
-import { motion, Variants } from 'motion/react';
+import { motion, TargetAndTransition, Variants } from 'motion/react';
 
 interface CopyButtonProps {
   onCopy: () => Promise<void> | void;
@@ -180,7 +180,7 @@ export const CopyButton: React.FC<CopyButtonProps> = ({ onCopy }) => {
       {/* animated Background */}
       <motion.div
         className="absolute inset-0 bg-editor-border rounded-md"
-        animate={getBackgroundAnimation()}
+        animate={getBackgroundAnimation() as TargetAndTransition}
       />
       
       <MotionButton
```

---

### Incident Patch 15: `2fba89c1` (2025-08-02)
**Commit Message**: fix: attempt cli install

**File**: `src/scripts/build-registry-sources.ts` (modified, +4/-4)
```diff
@@ -150,14 +150,14 @@ function processItemFiles(registryItem: any): any[] {
     } else if (file.type === "registry:ui") {
       const category = getCategory(file.path.replace("fancy/", ""))
       targetPath = category
-        ? `fancy/components/${category}/${fileName}.tsx`
-        : `fancy/components/${fileName}.tsx`
+        ? `components/fancy/${category}/${fileName}.tsx`
+        : `components/fancy/${fileName}.tsx`
     } else if (file.type === "registry:block") {
       const examplePath = file.path.replace("examples/", "")
       const category = getCategory(examplePath)
       targetPath = category
-        ? `fancy/components/${category}/${fileName}.tsx`
-        : `fancy/components/${fileName}.tsx`
+        ? `components/fancy/${category}/${fileName}.tsx`
+        : `components/fancy/${fileName}.tsx`
     } else if (file.type === "registry:lib") {
       const utilPath = file.path.replace("utils/", "")
       const category = getCategory(utilPath)
```

#### Recent Merged Pull Requests:
- **PR #67** (2026-03-12): docs: Add shadcn init and @fancy registry to installation docs (@TMname1)
- **PR #64** (2026-01-09): Feat: Add responsivity to the Marquee along svg path comp (@danielpetho)
- **PR #63** (2025-11-10): Feat/fix UI issues (@danielpetho)
- **PR #61** (2025-10-12): migrating to nextjs v.15 (@mehrdadrafiee)
- **PR #57** (2025-07-11): Feat/md docs (@danielpetho)
- **PR #56** (2025-07-04): Feat/box carousel (@danielpetho)
- **PR #55** (2025-06-16): Feat/rework demos (@danielpetho)
- **PR #53** (2025-06-12): Add docsearch from algolia (@danielpetho)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
