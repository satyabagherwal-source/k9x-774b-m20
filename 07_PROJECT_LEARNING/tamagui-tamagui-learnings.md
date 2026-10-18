> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tamagui-tamagui-learnings.md`  
> **Source**: github ([https://github.com/tamagui/tamagui](https://github.com/tamagui/tamagui))  
> **Source Version**: `b35c47e3`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T21:33:23.302Z  
> **Learning ID**: `learn-github-tamagui-tamagui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): tamagui/tamagui

---

## 1. Executive Forensic Architecture & System Mechanics

Tamagui addresses the fundamental tension between cross-platform React/React Native unified primitives and platform-native execution performance. Traditional cross-platform abstractions (such as React Native Web) incur severe runtime overhead by resolving style objects, evaluating dynamic media queries, and generating CSS classes dynamically on the JS thread during render cycles. 

```
                               +------------------------------------+
                               |     Tamagui Component Source       |
                               |    (View, Stack, Sheet, Switch)    |
                               +------------------------------------+
                                                 |
                                  +--------------+--------------+
                                  |                             |
                                  v                             v
                    [ Static Extracting Compiler ]      [ Dynamic Runtime Fallback ]
                    | - Parse AST (Babel / Babel/TS)    | - Props Resolution Engine
                    | - Extract Static CSS Rules        | - Media / Theme Context
                    | - Hoist Atomic ClassNames         | - Responsive Group Observers
                    +--------------+--------------+     +---------------+----------+
                                   |                                    |
                    +--------------+--------------+                     |
                    |                             |                     |
                    v                             v                     v
          [ Web Target: Atomic ]        [ Native Target: Hoisted ]      |
          | - Emit Atomic CSS           | - Hoist StyleSheet Object     |
          | - Flatten to pure <div>     | - Direct Host Props           |
          | - WAAPI / CSS Transitions   | - Reanimated / Direct Push    |
          +-----------------------------+-------------------------------+
                                        |
                                        v
                 +-----------------------------------------------+
                 |        Bypass Subsystems: Fast-Paths          |
                 | - NativeStyleEngine (Bypasses React VDOM diff)|
                 | - Direct rAF Keyframe Queuing (Motion Driver) |
                 | - Lazy Proxy Container Queries (GroupContext) |
                 +-----------------------------------------------+
```

### Architectural Subsystem Decoupling & Invariants

1. **Static Compiler vs. Dynamic Core Runtime (`@tamagui/static` & `@tamagui/core`)**:
   - The compiler analyzes static JSX syntax trees, extracts constant styles, injects atomic CSS class names into HTML/DOM output, and replaces custom React elements with native primitives (`<div>`, `<span>`).
   - If properties depend on runtime state that cannot be statically evaluated (dynamic ternary expressions, inline non-constant variables), the compiler leaves dynamic slots handled by `@tamagui/core`'s runtime engine (`createComponent.tsx`).

2. **Decoupled Animation Abstraction Engine (`@tamagui/animations-*`)**:
   - Animation drivers (`animations-moti`, `animations-react-native`, `animations-motion`, `animations-css`) conform to a unified runtime contract: `AnimatedNumberStrategy`, `setValue(val, { type: 'direct' | 'spring' | 'timing' })`, and transition subscriptions.
   - For web motion engines, direct style writes (`duration: 0` or strategy `direct`) must bypass asynchronous transition queues and write synchronously to the DOM (`assignInlineStyles`) to prevent single-frame layout jumps when subsequent continuous animations start.

3. **High-Performance Native Fast-Path Bypass (`nativeStyleEngine`)**:
   - React Native re-renders trigger costly bridge/JSI traversals across the Yoga layout tree. Tamagui's `nativeStyleEngine` establishes a direct handle (`link(host, {})`) to native views, bypassing React's virtual DOM reconciliation for theme and media query mutations.
   - State ownership is pinned to `TamaguiComponentStateRef` holding `nativePushedKeys: Set<string>` and `nativeResync: () => void`. When native views are hidden by concurrency mechanisms (e.g., `react-freeze`, React 18+ Suspense, or offscreen Activity), refs detach and reconcile offscreen. Upon reconnection, the subsystem re-synchronizes stale pushed styles against the active theme state.

4. **Container & Group Media Queries (`GroupContext` & Lazy Proxy Subscriptions)**:
   - Dynamic layouts observe parent dimensions via `GroupContext` rather than listening to window resize events.
   - To eliminate spurious renders, container query hooks (`useGroupMedia`, `useContainerDim`) wrap the state in an ES6 `Proxy`. The hook lazily registers dependency keys inside a `useRef<Set<string>>` as properties are read during the component render phase, filtering out layout changes that do not cross evaluated breakpoint thresholds.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Viewport Edge Seeding for Parked Off-Screen Elements
**RULE**:
When an off-screen/parked modal element (such as a sheet, drawer, or dialog) transitions from a closed state (`display: none` or parked off-screen) to an open state, the animation driver MUST seed its starting keyframe coordinates from the live visible viewport height (`window.innerHeight` / `document.documentElement.clientHeight` cached via non-forced layout observers) rather than the element’s internal measured dimensions or historical parked offsets.

**WHY**:
Closed elements styled with `display: none` do not trigger layout recalculations when the viewport dimensions change (e.g., mobile browser address bar collapse/expansion or mobile screen orientation shifts). If the open animation seeds its origin from element-local cached geometry or the high-water parking coordinate, the element either renders far below the screen—wasting initial animation frames in dead space—or abruptly teleports into view if the viewport grew while closed.

**WHEN TO APPLY**:
Apply to all bottom sheets, toast drawers, sliding panels, and off-screen canvas elements in hybrid and web engines where elements park off-screen and animate into view upon activation.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// webViewport.ts - Non-reflow layout caching module
let _maxViewportHeight = 0
let _visibleViewportHeight = 0

export function updateCachedViewportGeometry(): void {
  if (typeof document === 'undefined') return
  const clientHeight = document.documentElement?.clientHeight || 0
  const innerHeight = window.innerHeight || 0
  _visibleViewportHeight = clientHeight || innerHeight || 0
  _maxViewportHeight = Math.max(_maxViewportHeight, clientHeight, innerHeight)
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', updateCachedViewportGeometry, { passive: true })
  updateCachedViewportGeometry()
}

export function getVisibleViewportHeight(): number {
  if (_visibleViewportHeight === 0) {
    updateCachedViewportGeometry()
  }
  return _visibleViewportHeight
}

// SheetComponent.tsx - Safe animation launch logic
function triggerSheetOpen(
  isParkedClosed: boolean,
  currentY: number,
  animatedNumber: { setValue: (v: number, opts: { type: 'direct' }) => void }
) {
  if (isParkedClosed) {
    const visibleEdge = getVisibleViewportHeight()
    // Seed origin exactly at visible edge to eliminate off-screen dead frame animation
    if (currentY > visibleEdge) {
      animatedNumber.setValue(visibleEdge, { type: 'direct' })
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Relying on element-local geometry or unmeasured screen bounds
function triggerSheetOpenBuggy(
  sheetRef: React.RefObject<HTMLElement>,
  parkedPosition: number,
  animatedNumber: any
) {
  // CRITICAL BUG: sheetRef.current.getBoundingClientRect() forces layout reflow.
  // If element was display:none, rect returns 0,0,0,0.
  // Seeding from parkedPosition animates across collapsed mobile browser chrome.
  const staleLocalHeight = sheetRef.current?.clientHeight || parkedPosition
  animatedNumber.setValue(staleLocalHeight, { type: 'direct' })
}
```

**VERIFICATION METHOD**:
Verify using a browser automation suite (Playwright/Puppeteer) that alters the viewport size while the sheet is fully parked, triggers open, and samples `getBoundingClientRect().top` on frame 1:
```typescript
test('sheet open origin starts at or below visible edge, never beyond +1px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await page.getByTestId('close-sheet').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="frame"]')?.clientHeight === 0)
  await page.setViewportSize({ width: 390, height: 750 }) // Viewport expanded while hidden
  await page.getByTestId('open-sheet').click()
  const firstFrameTop = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="frame"]')
    return el ? el.getBoundingClientRect().top : 0
  })
  expect(firstFrameTop).toBeLessThanOrEqual(751)
  expect(firstFrameTop).toBeGreaterThanOrEqual(740)
})
```

---

### 2. Synchronization of Native Fast-Path Styles Post Subtree Thaw
**RULE**:
When utilizing a native style engine bypass that manipulates underlying platform host nodes outside the React Virtual DOM lifecycle, components MUST cache their last rendered dynamic styles and re-synchronize them (`resync()`) whenever the host re-attaches (`link`) if previously pushed style keys exist (`pushedKeys.size > 0`).

**WHY**:
Optimization libraries like `react-freeze` or React 18 `<Suspense>` suspend hidden subtrees by detaching host refs and skipping rendering passes. If an inherited context (such as Theme or Media) changes while the subtree is frozen, the context listener fails to push new styles to the detached host. When the component unfreezes, React commits props using its shallow diff against its own prop tree; since React's props did not change during the freeze, React performs zero DOM/host updates. Without explicit engine re-sync, the host permanently displays stale, desynchronized native styles.

**WHEN TO APPLY**:
Applies to any hybrid, React Native, or custom canvas architecture where native styles or GPU transforms are pushed out-of-band via imperative native registry engines or direct C++/JSI handles.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
interface NativeHostHandle {
  unlink: () => void
}

interface ComponentStateRef {
  nativeLink?: NativeHostHandle | null
  nativePushedKeys?: Set<string>
  nativeResync?: () => void
  nativeStyleUpdate?: (theme: string, style: Record<string, unknown>) => void
}

export function updateNativeStyleLink(
  ref: ComponentStateRef,
  host: unknown,
  engine: { link: (host: unknown, config: unknown) => NativeHostHandle } | null
): void {
  // 1. Unlink previous native handle if present
  if (ref.nativeLink) {
    ref.nativeLink.unlink()
    ref.nativeLink = null
  }

  // 2. Re-establish handle if host is mounted and engine is active
  if (host && engine && ref.nativeStyleUpdate) {
    ref.nativeLink = engine.link(host, {})
    
    // 3. INVARIANT: If the component ref preserved identity and already pushed style keys,
    // it returned from a detached/frozen state (e.g., react-freeze).
    // Must re-sync the active render style immediately to clear stale native pushes.
    if (ref.nativePushedKeys && ref.nativePushedKeys.size > 0) {
      ref.nativeResync?.()
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Clearing pushed keys on unbind or omitting the resync trigger
export function updateNativeStyleLinkBuggy(ref: ComponentStateRef, host: unknown, engine: any): void {
  if (ref.nativeLink) {
    ref.nativeLink.unlink()
    ref.nativeLink = null
  }
  // CRITICAL BUG: Wiping tracking keys assumes new native view starts fresh from props.
  // Under react-freeze, host identity returns, native view keeps stale GPU paint,
  // and React does not diff identical props!
  ref.nativePushedKeys = undefined 
  if (host && engine) {
    ref.nativeLink = engine.link(host, {})
  }
}
```

**VERIFICATION METHOD**:
Execute an integration test freezing a subtree via a suspended Promise, mutate the theme provider state while frozen, resolve/unfreeze the subtree, and assert that the underlying host element's background color matches the updated theme rather than the pre-freeze theme:
```typescript
test('frozen subtree resyncs out-of-band styles upon thaw', async () => {
  let freezeToggle: (v: boolean) => void = () => {}
  let themeToggle: (t: string) => void = () => {}
  // Render harness with Freeze/Suspense and Engine Mock...
  await act(async () => themeToggle('blue'))
  await act(async () => freezeToggle(true))  // Subtree suspended
  await act(async () => themeToggle('red'))   // Context updated while detached
  await act(async () => freezeToggle(false)) // Subtree unfreezes
  
  const lastNativePush = mockEngine.getLastPushedStyle(nodeId)
  expect(lastNativePush.backgroundColor).toBe('dark_red')
})
```

---

### 3. Immediate Frame-Origin Inversion for Zero-Duration Writes
**RULE**:
When an animation driver implements an immediate or direct update (`setValue` with duration `0` or `strategy: 'direct'`), the system MUST write the inline styles directly to the target node synchronously AND retain the written properties in a transient cache (e.g. `WeakMap<Node, StyleRecord>`) during that frame. Any subsequent animation starting on the same node within that animation frame MUST consume the pending direct values as its starting keyframes `[directStyle[k], nextStyle[k]]`.

**WHY**:
Under modern browser animation engines (WAAPI, Web Animations API, or Framer Motion/Motion core), applying a zero-duration or direct write is processed asynchronously on the subsequent tick/frame. If a new spring or timing animation is dispatched in the same tick immediately after the direct write, the engine samples the node's current computed style—which has not yet reflected the direct write—causing the animation to start from a stale coordinate, producing a visible single-frame jitter or pop.

**WHEN TO APPLY**:
Universal across all Web Animations API (WAAPI), CSS transition orchestration, and Canvas/DOM rendering bridges that mix imperative property jumping with continuous transitions.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
const pendingDirectStyles = new WeakMap<HTMLElement, Record<string, unknown>>()

export function applyNodeAnimation(
  node: HTMLElement,
  nextStyle: Record<string, unknown>,
  strategy: { type?: 'direct' | 'spring' | 'timing'; duration?: number } | undefined,
  animateFn: (node: HTMLElement, target: any, opts: any) => void
): void {
  const isDirect = strategy?.type === 'direct' || strategy?.duration === 0
  const directStyle = pendingDirectStyles.get(node)
  
  let targetStyle: Record<string, unknown> = nextStyle

  // If a direct write occurred in this frame, inject it as the explicit origin keyframe
  if (directStyle && !isDirect) {
    targetStyle = { ...nextStyle }
    for (const key in directStyle) {
      if (key in nextStyle) {
        targetStyle[key] = [directStyle[key], nextStyle[key]]
      }
    }
  }

  if (isDirect) {
    // 1. Write synchronously to avoid layout lag
    Object.assign(node.style, nextStyle)
    // 2. Cache pending origin for subsequent calls in current tick
    pendingDirectStyles.set(node, nextStyle)
    // 3. Purge cache on the next animation frame
    requestAnimationFrame(() => {
      if (pendingDirectStyles.get(node) === nextStyle) {
        pendingDirectStyles.delete(node)
      }
    })
  }

  animateFn(node, targetStyle, strategy)
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly delegating duration:0 to the animation engine
export function applyNodeAnimationBuggy(node: HTMLElement, nextStyle: any, transition: any) {
  // CRITICAL BUG: animate() registers an asynchronous task in the browser animation worklet.
  // If setValue(500, { duration: 0 }) is followed immediately by animate(100, { duration: 300 }),
  // the engine reads node.style which is still 0, jumping from 0 to 100 instead of 500 to 100!
  animate(node, nextStyle, transition)
}
```

**VERIFICATION METHOD**:
Monitor the WAAPI keyframe inspection list using Playwright to assert that two successive calls (`setValue(edge, direct)` then `animate(snapPoint)`) generate a keyframe list containing `[edge, snapPoint]` rather than `[0, snapPoint]`:
```typescript
test('WAAPI keyframes inherit synchronous direct style origin', async ({ page }) => {
  const sampledOrigins = await page.evaluate(() => {
    // Dispatch direct write followed by spring
    driver.setValue(node, { transform: 'translateY(600px)' }, { type: 'direct' })
    const anim = driver.animate(node, { transform: 'translateY(200px)' }, { type: 'spring' })
    const keyframes = anim.effect.getKeyframes()
    return keyframes.map(k => k.transform)
  })
  expect(sampledOrigins[0]).toContain('600px')
})
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Web Sheet Out-Of-Sight Opening From High-Water Parked Position (BUG-SHEET-OPEN-01)
- **Context**: `code/ui/sheet/src/SheetImplementationCustom.tsx`, `code/core/animations-motion/src/createAnimations.tsx`
- **What Was Expected**: When reopening a fully closed sheet on mobile/desktop browsers, the sheet must start its opening transition visibly sliding upward from the visible bottom edge of the current viewport.
- **What Actually Happened**: The sheet was parked at the high-water close target (calculated from the largest viewport height observed when mobile browser address bars collapse, e.g., 900px on iOS Safari). When reopened at a smaller viewport (e.g., 600px), it began translating from 900px. The initial 300px of movement occurred completely off-screen, creating a perceptible delay (dead frames) before the sheet became visible. Furthermore, zero-duration writes in the motion driver applied keyframes a frame late, causing mid-flight reversals to jump.
- **Evidence in Repo**: Commit `599751b2`.
- **Root Cause**: `SheetImplementationCustom` used a single un-reset position state `at.current` that stayed at the maximum parked target upon closing. When re-triggered, `wasParkedClosed` was not tracked, and the animation driver lacked a mechanism to feed instantaneous origin values into the motion engine without waiting for the next render frame.
- **Remediation Code Diff**:
```diff
--- a/code/ui/sheet/src/SheetImplementationCustom.tsx
+++ b/code/ui/sheet/src/SheetImplementationCustom.tsx
@@ -400,6 +400,11 @@ export const SheetImplementationCustom = createRefComponent<View, SheetProps>(
       }
     )
 
+    // true once a close animation has fully completed, until the next move
+    // starts. a sheet parked past the viewport (the web high-water close target)
+    // can then open from the visible edge; a reversal mid-close never can.
+    const isParkedClosedRef = React.useRef(false)
+
     const syncAnimatedPosition = useEvent((value: number) => {
       at.current = value
       scrollBridge.paneY = value
@@ -518,6 +525,15 @@ export const SheetImplementationCustom = createRefComponent<View, SheetProps>(
 
       stopSpring()
 
+      // web: a fully closed sheet is parked at the high-water close target, past
+      // the visible viewport. opening from there spends its first frames
+      // travelling out of sight, so start at the visible edge instead.
+      const wasParkedClosed = isParkedClosedRef.current
+      isParkedClosedRef.current = false
+      if (isWeb && isOpenAnimation && wasParkedClosed && from > effScreenSize) {
+        animatedNumber.setValue(effScreenSize, { type: 'direct' })
+      }
+
       const animationCompleteCallback = () => {
```
- **Lesson**: Off-screen parking mechanics must maintain an explicit `isParkedClosed` finite state machine latch. Re-entry transitions must reset geometry to visible boundary planes before initiating continuous physics springs.

---

### Incident 2: Stale Edge Popping After Viewport Resize in Hidden Display:None Sheets (BUG-SHEET-RESIZE-02)
- **Context**: `code/ui/sheet/src/webViewport.ts`, `code/ui/sheet/src/SheetImplementationCustom.tsx`, `code/core/animations-motion/src/createAnimations.tsx`
- **What Was Expected**: If the viewport dimensions changed (e.g. mobile device rotated or browser resized) while a bottom sheet was closed, reopening it should slide smoothly from the updated viewport edge.
- **What Actually Happened**: The sheet popped into view abruptly at the old viewport edge. Because the sheet container was styled with `display: none` while closed, its internal layout pass never ran and its `effScreenSize` remained stale. Seeding the direct write from `effScreenSize` snapped the sheet to the obsolete height. Additionally, identifying direct writes via `(transition.duration === 0)` misclassified spring animations configured with 0 duration or omitted duration fields.
- **Evidence in Repo**: Commit `3b5dfa6f`.
- **Root Cause**: `display: none` DOM subtrees do not execute layout recalculations or resize observer callbacks. The component attempted to read geometry from an un-rendered DOM hierarchy instead of the global viewport layout cache.
- **Remediation Code Diff**:
```diff
--- a/code/ui/sheet/src/webViewport.ts
+++ b/code/ui/sheet/src/webViewport.ts
@@ -58,8 +58,10 @@ export function getStableLayoutViewportHeight(): number {
  */
 let _maxViewportHeight = 0
+let _visibleViewportHeight = 0
 function updateMaxViewportHeight(): void {
   const ch = typeof document !== 'undefined' ? document.documentElement?.clientHeight : 0
+  _visibleViewportHeight = ch || window.innerHeight || 0
   _maxViewportHeight = Math.max(
     _maxViewportHeight,
     ch || 0,
@@ -81,6 +83,16 @@ export function getMaxViewportHeight(): number {
   return _maxViewportHeight
 }
 
+/**
+ * the visible layout viewport height as of the last resize, cached with the
+ * high-water mark so reading it never forces layout. a closed sheet is
+ * display:none and never re-measures, so its own screen size goes stale.
+ */
+export function getVisibleViewportHeight(): number {
+  getMaxViewportHeight()
+  return _visibleViewportHeight
+}
+
--- a/code/ui/sheet/src/SheetImplementationCustom.tsx
+++ b/code/ui/sheet/src/SheetImplementationCustom.tsx
@@ -530,8 +531,9 @@ export const SheetImplementationCustom = createRefComponent<View, SheetProps>(
       // travelling out of sight, so start at the visible edge instead.
       const wasParkedClosed = isParkedClosedRef.current
       isParkedClosedRef.current = false
-      if (isWeb && isOpenAnimation && wasParkedClosed && from > effScreenSize) {
-        animatedNumber.setValue(effScreenSize, { type: 'direct' })
+      if (isWeb && isOpenAnimation && wasParkedClosed) {
+        const visibleEdge = getVisibleViewportHeight()
+        if (from > visibleEdge) animatedNumber.setValue(visibleEdge, { type: 'direct' })
       }
--- a/code/core/animations-motion/src/createAnimations.tsx
+++ b/code/core/animations-motion/src/createAnimations.tsx
@@ -1390,7 +1390,7 @@ function createMotionView(defaultTag: string) {
         // the pending direct value as its start keyframe instead.
         const directStyle = pendingDirectStyles.get(node)
-        const isDirect = (transition as { duration?: number }).duration === 0
+        const isDirect = strategy?.type === 'direct'
```
- **Lesson**: Do not query dimensions from unmounted or `display: none` DOM subtrees. Geometry must be cached globally via passive event listeners, and animation dispatchers must branch on explicit strategy type tokens (`type === 'direct'`) rather than inferring intent from numerical duration properties.

---

### Incident 3: Frozen Subtree Desynchronization in React-Freeze / Native Fast-Path Styles (BUG-CORE-FREEZE-03)
- **Context**: `code/core/web/src/helpers/nativeStyleEngine.ts`, `code/core/web/src/createComponent.tsx`
- **What Was Expected**: In React Native apps using `react-freeze` (such as React Navigation / `react-native-screens` with `freezeOnBlur`), when a screen is unfrozen after an application theme change, all native views on that screen must immediately display the active theme colors.
- **What Actually Happened**: The unfrozen screen continued displaying stale theme colors. When a screen was frozen, its host views detached from the tree. When theme changes occurred while hidden, Tamagui's native style engine did not push updates to detached hosts. When the screen became visible again, React committed the component without diffing the props (because React's props had not changed from React's internal perspective), and `updateNativeStyleLink` cleared `ref.nativePushedKeys = undefined`, dropping knowledge of previously pushed styles without forcing a repaint.
- **Evidence in Repo**: Commit `59fbed59`, PR #4333.
- **Root Cause**: `nativeStyleEngine` assumed that every `link` call represented a brand new native host node requiring initialization from committed React props. Under `react-freeze`, however, the host retains native memory identity across unbind/rebind cycles while React skips reconciliations.
- **Remediation Code Diff**:
```diff
--- a/code/core/web/src/createComponent.tsx
+++ b/code/core/web/src/createComponent.tsx
@@ -1020,6 +1020,13 @@ export function createComponent<
           }
         : undefined
 
+      stateRef.current.nativeResync = canNativeUpdate
+        ? () => {
+            const style = splitStyles.style as Record<string, unknown> | undefined
+            if (style) pushViewState!(themeState?.name || '', style)
+          }
+        : undefined
+
       // a real render supersedes everything pushed since. explicitly reset
--- a/code/core/web/src/helpers/nativeStyleEngine.ts
+++ b/code/core/web/src/helpers/nativeStyleEngine.ts
@@ -527,18 +527,21 @@ export function updateNativeStyleLink(
     nativeLink?: NativeStyleEngineLinkHandle | null
     nativeStyleUpdate?: unknown
     nativePushedKeys?: Set<string>
+    nativeResync?: () => void
   },
   host: unknown
 ): void {
   if (ref.nativeLink) {
     ref.nativeLink.unlink()
     ref.nativeLink = null
   }
-  // pushed-key tracking is per-link: a new native view starts from the props
-  // React committed, nothing pushed yet
-  ref.nativePushedKeys = undefined
   if (host && engine && ref.nativeStyleUpdate) {
     ref.nativeLink = engine.link(host, {})
+    // the ref keeps one identity, so a host that links again is the same
+    // native view returning from a hidden subtree (freeze, activity). it still
+    // shows its last push, and react's commit only diffs against react's own
+    // props, so a theme change made while hidden would never reach it
+    if (ref.nativePushedKeys?.size) ref.nativeResync?.()
   }
 }
```
- **Lesson**: When maintaining out-of-band state engines running parallel to React's Virtual DOM, host re-attachments must be treated as potential re-entries from suspension. Preserving tracking sets across unlinks enables detection of returning hosts and triggers explicit style resynchronization.

---

### Incident 4: Switch & Switch.Thumb Animation Bounds Glitch on React Native (BUG-SWITCH-THUMB-04)
- **Context**: Issue #2580 (`Switch` and `Switch.Thumb` animation coordination on React Native).
- **What Was Expected**: Applying an animation property to `Switch.Thumb` should smoothly slide the thumb between active and inactive offsets without breaking the initial checked position or jumping outside the switch boundaries.
- **What Actually Happened**: When `checked` was initialized to `true`, the thumb slipped outside the Switch frame or remained locked at the `0` (left) offset on initial mount.
- **Evidence in Repo**: Issue #2580; resolved via master branch layout measurement synchronization patch.
- **Root Cause**: On React Native, layout dimensions (`width`, `height`, padding) are determined asynchronously during the Yoga native layout pass (`onLayout`). The thumb animation calculation