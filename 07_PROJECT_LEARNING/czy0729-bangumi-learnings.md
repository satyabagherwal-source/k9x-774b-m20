> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/czy0729-bangumi-learnings.md`  
> **Source**: github ([https://github.com/czy0729/Bangumi](https://github.com/czy0729/Bangumi))  
> **Source Version**: `c4e2dcf8`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T04:56:58.551Z  
> **Learning ID**: `learn-github-czy0729-bangumi`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): czy0729/Bangumi

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Mission & Domain Constraints
`czy0729/Bangumi` is an enterprise-scale, cross-platform mobile client for the Bangumi community platform (an ACG tracker, forum, and social network). The repository targets React Native (0.86+) on Expo (57+) with React 19, Reanimated 4, and MobX 6. Unlike standard wrapper applications, this client operates in extreme environments characterized by:
- Incomplete/unstable upstream APIs requiring transparent HTML DOM scraping (`htmlparser2`, custom AST generation) as a fallback data provider.
- Network censorship and DNS pollution mitigated at the native layer via customized Android OkHttp clients providing DNS-over-HTTPS (DoH) and Encrypted Client Hello (ECH) proxy capabilities (`android/app/src/main/java/com/czy0729/bangumi/doh/`).
- Thousands of concurrent dynamic items in complex forum hierarchies, necessitating zero-cost MobX reactive styling, virtualization memory caps, and hybrid Reanimated worklet-to-JS bridge coordination.

```
+---------------------------------------------------------------------------------------+
|                                    UI Layer (React 19)                                |
|  Screens (Rakuen / Subject / Tinygrail) <---> Components (ListView, Accordion, Sheet) |
+---------------------------------------------------------------------------------------+
           |                                                      ^
    (Observable Sync)                                      (Observer Derivation)
           v                                                      |
+------------------------------------+          +---------------------------------------+
|        MobX 6 Store Engine         |          |       Theme & Style Engine (_)        |
|  - AppStore / RakuenStore / User   |          |  - COMPUTED_PROPS / COMPUTED_FNS      |
|  - Dynamic KV snapshot store (OTA) |          |  - Dynamic memoStyles with cache keys |
+------------------------------------+          +---------------------------------------+
           |                                                      ^
     (Async Fetch)                                                |
           v                                                      |
+---------------------------------------------------------------------------------------+
|                            Data Ingestion & Parsing Subsystem                         |
|  - Official REST API (JSON)                                                           |
|  - Forked HTML Parser (react-native-render-html AST Engine -> RNElements)             |
|  - KV Snapshot Cloud Cache (7-day staleness invalidation)                             |
+---------------------------------------------------------------------------------------+
           |
   (Native Network Core)
           v
+---------------------------------------------------------------------------------------+
|                 Platform & Native Interop (Android / iOS)                             |
|  - BangumiOkHttpClientFactory (DoHDNS, ECH Proxy Engine, TLS Fingerprint spoofing)    |
|  - DayNight, Squircle, HardwareBackHandler (Android Navigation Bridge)                |
+---------------------------------------------------------------------------------------+
```

### 1.2 Subsystem Decomposition & State Ownership

1. **Reactive State Core (`mobx` + `mobx-react`)**:
   - State stores inherit from a unified base `store` wrapper. State transitions are strictly mediated through observable class properties and action methods.
   - Screen-level stores decouple domain entities into: local ephemeral UI state (`this.state = observable(STATE)`), global shared domain state (`rakuenStore`), and remote cloud snapshots (`ota` KV store).
   - Component consumption relies on `observer` wrapping and the `useStore<Ctx>(COMPONENT)` hook, binding MobX dependency tracking directly to individual sub-components to prevent root screen re-renders.

2. **Style & Theming Decoupling (`_` Global Token Engine)**:
   - Styles are partitioned into static styles (created once via React Native's `StyleSheet.create`) and dynamic reactive styles (wrapped in `memoStyles(() => ({...}))`).
   - The theme token dictionary `_` maintains dynamic properties (`COMPUTED_PROPS`: e.g., `_colorBg`, `isDark`) and dynamic dimension calculations (`COMPUTED_FNS`: `select`, `grid`, `num`). A custom AST ESLint engine enforces zero-leakage of computed theme tokens into static `StyleSheet.create` calls.

3. **Virtualization & AST Document Rendering**:
   - The application forks `react-native-render-html` directly inside the repository (`src/components/@/react-native-render-html`), modifying the DOM handler to sanitize arbitrary nested HTML from forum posts and comments into native `<Text>` and `<View>` hierarchies.
   - Text styling addresses low-level Android layout bugs (such as clipping and font-padding offsets) via explicit typography stabilization (`textBreakStrategy='simple'`, `androidTextFixedStyle`, and lineHeight clamping).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Finite Numerical Validation for Animation Worklets
**RULE**:
All numerical inputs deriving from UI layout events (`onLayout`, `LayoutChangeEvent`) or unvalidated remote network payloads MUST pass through `Number.isFinite()` validation and minimum boundary clamping before being assigned to UI shared values or passed into animation interpolation functions (`withTiming`, `withSpring`, `interpolate`). Raw, un-sanitized values MUST NOT reach the Reanimated/native UI thread.

**WHY**:
In React Native and Reanimated worklets, passing `NaN`, `null`, `undefined`, or `Infinity` into native transform drivers (`translateY`, `scale`, `opacity`) results in silent hard crashes on iOS (CoreGraphics transform matrix invalidation) or catastrophic layout engine exceptions on Android (Yoga engine layout overflow). During view mounting and unmounting cycles, initial layout passes frequently return unmeasured dimensions (`height: undefined` or `0`), which, when subjected to arithmetic (e.g., `height + bottom`), propagate `NaN` directly to the C++ animation bridge.

**WHEN TO APPLY**:
- Reanimated 2/3/4 shared values (`useSharedValue`).
- Any dynamic component measuring its own dimensions via `onLayout` (e.g., accordions, bottom sheets, sticky headers).
- Any numeric interpolation where bounds are calculated dynamically.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Production pattern verified in src/components/accordion/utils.ts
export const MIN_HEIGHT = 0.5

/**
 * Hardens layout heights against NaN, Infinity, and non-finite values.
 * Bounds lower threshold to ensure layout engine stability.
 */
export function getMeasuredHeight(height: number): number {
  return Number.isFinite(height) ? Math.max(height, MIN_HEIGHT) : MIN_HEIGHT
}

/**
 * Bounds dynamic translation values; protects native transform matrices
 */
export function getHiddenTranslateY(height: number, bottom: number): number {
  const h = Number.isFinite(height) ? Math.max(height, 0) : 0
  const b = Number.isFinite(bottom) ? Math.max(bottom, 0) : 0
  return h + b
}

// In React Hook:
const handleLayout = useCallback((evt: LayoutChangeEvent) => {
  const raw = evt?.nativeEvent?.layout?.height
  if (!Number.isFinite(raw)) return

  const newHeight = getMeasuredHeight(raw)
  // Jitter guard: suppress layout thrashing for micro-subpixel movements (< 1px)
  if (Math.abs(heightRef.current - newHeight) < 1) return

  heightRef.current = newHeight
}, [])
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: NEVER allow unchecked layout values into animation drivers
const handleLayout = (evt: LayoutChangeEvent) => {
  const height = evt.nativeEvent.layout.height // Can be undefined or NaN on unmount
  translateY.value = withTiming(height + safeAreaBottom) // CRASH: Native transform matrix failure
}
```

**VERIFICATION METHOD**:
Enforce via unit tests verifying that `getHiddenTranslateY(NaN, undefined)` returns `0`. Add a static ESLint/TypeScript rule enforcing that values assigned to `.value` of a `SharedValue<number>` inside layout callbacks originate from an explicit sanitization function.

---

### 2. Symmetrical Interrupt Protection for Reanimated-to-JS State Bridges
**RULE**:
When an asynchronous native animation coordinates with React state (e.g., toggling `show` or unmounting subtrees upon animation completion via `scheduleOnRN`), the hook MUST maintain an explicit mutable interruption flag (`closingRef` / `expandRef`) and an unmount guard (`unmountedRef`). The completion callback MUST verify that the component is still mounted and that the transition intention has not been reversed before invoking state setters.

**WHY**:
Reanimated animations execute on the UI thread, while React state updates occur on the JavaScript thread. If a user rapidly triggers open -> close -> open within the animation window (e.g., tapping a backdrop or toggling a dropdown), the UI animation for "close" can finish *after* the user has initiated the "open" command. If the UI completion callback unconditionally sets `setShow(false)`, it unmounts the view immediately after the user requested it to open, leaving the UI permanently broken or locked in a desynchronized visual state.

**WHEN TO APPLY**:
- Collapsible accordions, ActionSheets, Modals, and Drawers where rendering is deferred or unmounted when hidden (`lazy = true`).
- Any animation pattern using `runOnJS` or `scheduleOnRN` in `withTiming(..., (finished) => { ... })`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Production pattern verified in src/components/action-sheet/hooks.ts & accordion/hooks.ts
const closingRef = useRef(false)
const unmountedRef = useRef(false)
const [showValue, setShow] = useState(initialShow)

const handleShow = useCallback(() => {
  // If a closing animation is in flight, interrupt it and reverse direction
  if (closingRef.current) {
    closingRef.current = false
    animateTo(1)
    return
  }

  if (showValue) return
  setShow(true)
  requestAnimationFrame(() => animateTo(1))
}, [animateTo, showValue])

const handleClose = useCallback(() => {
  if (!showValue || closingRef.current) return

  closingRef.current = true
  animateTo(0, () => {
    // CRITICAL: Verify interruption flag and unmounted flag before tearing down React state
    if (unmountedRef.current || !closingRef.current) return

    closingRef.current = false
    setShow(false)
    onClose?.()
  })
}, [animateTo, onClose, showValue])

useEffect(() => {
  unmountedRef.current = false
  return () => {
    unmountedRef.current = true
  }
}, [])
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly executing JS state updates from worklet completion callbacks
const handleClose = () => {
  translateY.value = withTiming(400, { duration: 200 }, (finished) => {
    if (finished) {
      runOnJS(setShow)(false) // BUG: Destroys view even if user re-opened it mid-animation!
      runOnJS(onClose)()
    }
  })
}
```

**VERIFICATION METHOD**:
Write integration tests using `@testing-library/react-native` where a close trigger is fired at $t=0$, followed by an open trigger at $t=50\text{ms}$ (with animation duration set to $200\text{ms}$). Assert that at $t=250\text{ms}$, `showValue` remains `true` and `onClose` was never called.

---

### 3. Screen-Focused Global Hardware Back-Handler Isolation
**RULE**:
Global event listeners with stack-priority semantics (such as Android's `BackHandler` or platform hardware back actions) registered within ephemeral UI components (ActionSheets, Popovers, Modals) MUST verify that their parent navigation container is currently focused (`navigation.isFocused() === true`) and MUST use a stable ref for the handler to prevent subscription ordering corruption.

**WHY**:
In React Native Android, `BackHandler.addEventListener('hardwareBackPress', handler)` operates as a global LIFO (last-in, first-out) priority stack. If an inactive screen or background tab re-renders while the user is on a completely different screen, an inline back handler registration removes and re-inserts the callback at the top of the global LIFO stack. Consequently, pressing the hardware back button on the active foreground screen intercepts and closes a hidden ActionSheet or executes an action on the background screen.

**WHEN TO APPLY**:
- Any React Native screen, modal, or overlay subscribing to Android `BackHandler`.
- Floating menus, bottom sheets, or nested tab screens in `@react-navigation`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Production pattern verified in src/components/action-sheet/hooks.ts
const navigation = useContext(NavigationContext)
const backHandlerRef = useRef<() => boolean>(() => false)

// Always update ref with current closures without triggering re-subscription
backHandlerRef.current = () => {
  // Guard 1: Verify this specific screen is actually active and focused
  if (!showValue || !navigation?.isFocused()) return false

  // Guard 2: If currently animating out, do not consume the event; let screen navigate back
  if (closingRef.current) return false

  handleClose()
  return true // Consumed
}

// Stable callback identity guarantees the subscription is NOT constantly re-added
const handleBack = useCallback(() => backHandlerRef.current(), [])

useBackHandler(handleBack)
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Inline closure re-registers on every render and ignores navigation focus
useEffect(() => {
  const sub = BackHandler.addEventListener('hardwareBackPress', () => {
    if (show) { // BUG: Global listener catches back press even when another screen is pushed on top!
      setShow(false)
      return true
    }
    return false
  })
  return () => sub.remove() // Constant churn changes LIFO priority order
}, [show])
```

**VERIFICATION METHOD**:
Inspect all occurrences of `BackHandler.addEventListener` or `useBackHandler`. Verify that every callback contains a precondition checking `navigation?.isFocused()`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Reply Count Historic String Parsing Type Hazard (BUG-RAKUEN-01)
- **Context**: `src/screens/rakuen/board/component/item/index.tsx`
- **What Was Expected**: Tapping on forum posts with high reply counts should redirect to WebBrowser when reply count exceeds `LIMIT_TOPIC_PUSH`. For normal topics, it should record read history and navigate internally.
- **What Actually Happened**: The raw data for `replies` historically arrived either as a numeric string (`"42"`), a formatted suffix (`"42 replies"`), or empty/undefined strings depending on API vs HTML scraping sources. The expression `Number(replies)` evaluated to `NaN` when formatted strings were supplied, causing the conditional `Number(replies) > LIMIT_TOPIC_PUSH` to silently fail (since `NaN > limit` is `false`). Read history was saved with corrupt/dirty strings.
- **Evidence in Repo**: Commit `c4e2dcf8`
- **Root Cause**: Reliance on implicit `Number(...)` casting across dirty heterogeneous backend data formats without string sanitization.
- **Remediation Code Diff**:
```diff
--- a/src/screens/rakuen/board/component/item/index.tsx
+++ b/src/screens/rakuen/board/component/item/index.tsx
@@ -13,6 +14,7 @@ import { _, rakuenStore, useStore } from '@stores'
 import { appNavigate, getIsBlockedUser, HTMLDecode, info, open, stl } from '@utils'
 import { t } from '@utils/fetch'
 import { HOST, LIMIT_TOPIC_PUSH } from '@constants'
+import { parseReplies } from '@screens/rakuen/utils'
 import { COMPONENT } from './ds'
 import { memoStyles } from './styles'
 
@@ -29,6 +31,7 @@ function Item({ title, href, replies, time, userId, userName }: BoardItem) {
   const topicId = href.replace('/subject/topic/', 'subject/') as TopicId
   const readed = $.readed(topicId)
   const isReaded = !!readed.time
+  const repliesCount = parseReplies(replies)
   const replyText = `+${replies.replace(' replies', '')}`
 
   return (
@@ -37,7 +40,7 @@ function Item({ title, href, replies, time, userId, userName }: BoardItem) {
       style={stl(styles.item, isReaded && styles.readed)}
       animate
       onPress={() => {
-        if (Number(replies) > LIMIT_TOPIC_PUSH) {
+        if (repliesCount !== undefined && repliesCount > LIMIT_TOPIC_PUSH) {
           const url = `${HOST}${href}`
           t('讨论版.跳转', {\n             to: 'WebBrowser',
@@ -50,7 +53,7 @@ function Item({ title, href, replies, time, userId, userName }: BoardItem) {
           }, 1600)
         } else {
           // 记录帖子查看历史详情
-          $.onItemPress(topicId, replies)
+          if (repliesCount !== undefined) $.onItemPress(topicId, repliesCount)
           appNavigate(
             href,
             navigation,
```
- **Lesson**: Data parsed from disparate web scraper pipelines must be strictly transformed via canonical domain utility parsers (`parseReplies`) returning bounded types (`number | undefined`) before numerical comparisons or persistence calls.

---

### Incident 2: Long Comment List Scrolling Lock & Infinite Retry Storm (BUG-BLOG-02)
- **Context**: `src/screens/rakuen/blog/component/list/index.tsx` & `hooks.tsx`
- **What Was Expected**: When navigating to a specific post comment (via push notification or direct link containing `postId`), the list should scroll to the target comment floor index immediately after initial fetch.
- **What Actually Happened**: In large blog threads (hundreds of posts), calling `scrollToIndex` on an unmeasured FlatList/ListView caused `onScrollToIndexFailed`. The fallback handler repeatedly attempted to scroll to the index every 100ms without a termination guarantee, saturating the JS event loop and creating visual flashing. Furthermore, re-renders caused by parent components recreated the `ListHeaderComponent` element, resetting scroll offset measurements.
- **Evidence in Repo**: Commit `11ff26bf`
- **Root Cause**: Lack of retry boundary limits on `onScrollToIndexFailed`, dynamic identity changes on `ListHeaderComponent`, and missing item height hints (`estimatedItemHeight`).
- **Remediation Code Diff**:
```diff
--- a/src/screens/rakuen/blog/component/list/index.tsx
+++ b/src/screens/rakuen/blog/component/list/hooks.tsx
@@ -0,0 +1,45 @@
+/** 滚动失败后进行保守重试 */
+const handleScrollToIndexFailed = useCallback<HandleScrollToIndexFailed>(
+  ({ highestMeasuredFrameIndex, index }) => {
+    // 1. 先安全滚动到已测量的最高帧，触发后续元素测量
+    handleScrollTo(highestMeasuredFrameIndex)
+    scrollTimer.current = setTimeout(() => {
+      // 2. 严格熔断限制：最多重试 10 次，彻底杜绝死循环
+      if (scrollFailCount.current > 10) return
+      scrollFailCount.current += 1
+      handleScrollTo(index)
+    }, 100)
+  },
+  [handleScrollTo]
+)
--- a/src/screens/rakuen/blog/component/list/index.tsx
+++ b/src/screens/rakuen/blog/component/list/index.tsx
@@ -10,6 +10,9 @@ function List() {
+  // estimatedItemHeight 要求头部为稳定引用，避免重复挂载导致测量失效
+  const elListHeaderComponent = useMemo(() => <Top />, [])
+
   return (
     <ListView
       ref={handleListViewRef}
+      skipEnteringExitingAnimations={4}
+      estimatedItemHeight={ITEM_POST_HEIGHT}
+      ListHeaderComponent={elListHeaderComponent}
```
- **Lesson**: Virtualized list index jumps must employ a double-buffered failover: scroll to `highestMeasuredFrameIndex` first, enforce an upper bound on retry counters ($\le 10$), and freeze list header component references with `useMemo`.

---

### Incident 3: Fatal Crash in Friend Ratings Rendering (BUG-RATING-03)
- **Context**: User profile and subject rating breakdown screens
- **What Was Expected**: Viewing subject rating distributions where friends have rated the title should render their avatars, scores, and tags safely.
- **What Actually Happened**: Triggering the friend ratings modal or section in release `8.39.2` resulted in a fatal crash (`TypeError: Cannot read property of undefined` / RedScreen crash in production).
- **Evidence in Repo**: Issue #414 ("新版8.39.2的bug: 点好友评分的那里会稳定触发致命错误")
- **Root Cause**: When a subject has zero friend ratings or when the upstream API returns an empty object `{}` instead of an initialized collection structure, the property access `.list` or `.counts` crashed without optional chaining or MobX store initialization defaults.
- **Remediation**: Replaced raw access with MobX store level initialization contracts, ensuring return values are defaulted to `LIST_EMPTY = { list: [], pagination: { page: 1, pageTotal: 0 }, _loaded: 0 }`.
- **Lesson**: Store selectors (`computed` getters) querying external network entities must guarantee identity stability and non-null object structures (`LIST_EMPTY`) even when upstream endpoints return non-conforming or empty payloads.

---

### Incident 4: Seasonal Anime Sort Order Logic Inversion (BUG-TIMELINE-04)
- **Context**: Subject release calendar and auto-sinking algorithm
- **What Was Expected**: When "App Sort" and "Auto Sink" are enabled, unreleased anime scheduled for the upcoming season (e.g., October Autumn anime viewed during September Summer) must not rank above currently broadcasting shows.
- **What Actually Happened**: The auto-sink comparator evaluated broadcast dates using relative distance from the current timestamp, erroneously treating future unreleased shows as higher priority than currently airing shows with stale episode dates, placing unreleased titles at the top of the feed.
- **Evidence in Repo**: Issue #415 ("下沉逻辑修改")
- **Root Cause**: Incomplete partitioning in the timeline comparator function. The sort comparator grouped items purely by last update timestamp instead of creating a tripartite partition: (1) Airing, (2) Unreleased / Future Season, and (3) Completed / Dropped.
- **Remediation**: Implemented an explicit partitioning rule: if the title release date is in the upcoming quarter and today's date has not reached the broadcast threshold, sink the entire upcoming cluster below the active broadcast group.
- **Lesson**: Sinking and sorting algorithms dealing with temporal metadata must partition entities into categorical life-cycle states before applying continuous timestamp math.

---

### Incident 5: Static vs Computed Style Sheet Contamination
- **Context**: `eslint-rules/utils.js` & `eslint-rules/forbid-computed-in-create`
- **What Was Expected**: UI components should reactively switch between light, dark, and deep dark theme palettes instantly without app restarts or layout rebuilds.
- **What Actually Happened**: Developers frequently referenced theme values (e.g., `_.colorBg`, `_.fontSize14`, `_.isDark`) inside top-level `StyleSheet.create({...})` definitions. Because `StyleSheet.create` runs once when the module file is evaluated, theme changes failed to update these properties, leading to unreadable black-text-on-black-background artifacts during dynamic theme switching.
- **Evidence in Repo**: `eslint-rules/utils.js` (explicit token declaration lists `COMPUTED_PROPS` and `COMPUTED_FNS`).
- **Root Cause**: Architectural ambiguity between static layout styles and dynamic theme tokens in React Native codebases.
- **Remediation**: Custom ESLint rule AST visitor that inspects all `StyleSheet.create` call arguments; any reference to properties inside `COMPUTED_PROPS` or invocations of `COMPUTED_FNS` throws a build-halting lint error. Dynamic styles are forced into `memoStyles(() => ({...}))`.
- **Lesson**: Visual theme dynamics cannot rely on developer discipline; they must be mechanically enforced through AST-level lint rules prohibiting theme token references in static allocation scopes.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision

#### 1. Falsy Zero Hazard in UI Pagination and Counter Flags
In React Native, returning `0` inside a JSX expression evaluates to rendering a raw native text node containing `"0"`. Outside of a `<Text>` wrapper, this throws an immediate native crash: `Invariant Violation: Text strings must be rendered within a <Text> component`.
```typescript
// INVARIANT RULE: Never use numeric flags directly in JSX logical AND conditions.
// BUGGY:
{$.comments.list.length && <CommentList data={$.comments.list} />}
// If length is 0, React Native attempts to render native node with '0', crashing the view.

// SAFE:
{!!$.comments.list.length && <CommentList data={$.comments.list} />}
// Or:
{$.comments.list.length > 0 && <CommentList data={$.comments.list} />}
```

#### 2. Shallow vs Deep State Cloning in MobX Action Setters
When updating local store state using `this.setState({ ...storageData, ota: {} })`, nested objects can lose MobX observable proxies or retain stale inner references.
```typescript
// Observed in src/screens/rakuen/board/store.ts
// WRONG: Mutating an inner observed map directly without observable re-assignment
this.state.ota[key] = data // Fails to trigger computed updates if key was not pre-declared

// CORRECT PATTERN: Atomic observable replacement
this.setState({
  ota: {
    ...this.state.ota,
    [this.thirdPartyKey]: {
      ...data,
      _loaded: getTimestamp()
    }
  }
})
```

#### 3. Optional String Slicing and Type Coercion Hazards
When transforming URLs or route parameters:
```typescript
// Observed in src/screens/rakuen/board/component/item/index.tsx
// TopicId extraction from href:
const topicId = href.replace('/subject/topic/', 'subject/') as TopicId

// VULNERABILITY: If href is undefined or malformed (empty string), replace fails or yields invalid TopicId
// SAFE CONTRACT:
const topicId = (href ? href.replace('/subject/topic/', 'subject/') : '') as TopicId
```

---

### 4.2 Infinite Loop & Recursion Guards

#### 1. Recursive AST Normalization Depth Caps
The HTML AST parser recursively traverses arbitrary DOM node trees. Malicious or deeply nested forum signatures can trigger call-stack exhaustion (JavaScript maximum call stack exceeded).
```typescript
// In AST text spacing format (src/components/@/react-native-render-html/src/utils.ts):
export function formatSpacing(
  children: SpacingChild | SpacingChild[],
  depth = 0
): SpacingChild | SpacingChild[] {
  // DEPTH CAP GUARD: Terminate recursion at depth 20
  if (depth > 20) return children

  if (typeof children === 'string') return syncSpacing(children)
  if (Array.isArray(children)) {
    return children.map(child => formatSpacing(child, depth + 1))
  }
  return children
}
```

#### 2. Virtual List Scroll Retry Bounded Loop
```typescript
// Termination Invariant Proof for onScrollToIndexFailed:
// Loop condition: scrollFailCount.current <= 10
// Progress: scrollFailCount.current increments monotonically by 1 on every timer execution
// Base case: When scrollFailCount.current > 10, execution halts permanently.
if (scrollFailCount.current > 10) return
scrollFailCount.current += 1
```

---

### 4.3 UI & UX Micro-Mechanics

#### 1. Subpixel Layout Thrashing Suppression
Dynamic component layout listeners often report micro-jitter (e.g., $48.2\text{px} \to 48.6\text{px}$) during keyboard appearance or scroll operations due to floating-point display scaling.
```typescript
// src/components/accordion/utils.ts
export function shouldUpdateHeight(prev: number, next: number): boolean {
  // Suppress updates below 1 pixel threshold to prevent layout re-render loops
  return Math.abs(prev - next) >= 1
}
```

#### 2. Android Font Clipping and Line Height Compression
On Android devices with custom system fonts, text can be clipped vertically if `lineHeight` equals `fontSize`.
```typescript
// src/components/@/react-native-render-html/src/utils.ts
export function optimizeComputeTextStyles(styles: TextStyle) {
  if (styles?.fontSize && styles?.lineHeight && styles.fontSize >= styles.lineHeight) {
    // Invariant: lineHeight MUST be at least 1.5x fontSize on custom typography
    styles.lineHeight = Math.floor(styles.fontSize * 1.5)
  }
  return styles
}
```
Furthermore, all native `<Text>` components handling rich web input MUST apply `textBreakStrategy="simple"` on Android to prevent catastrophic text measurement stalls during native view calculation.

---

### 4.4 Backend Concurrency & Memory Safety

#### 1. Cloud Pre-fetch (OTA) KV Stale-While-Revalidate Guard
To reduce server load, topic metadata is cached in a cloud KV store. Writing to KV must be strictly debounced and guarded against concurrent update loops.
```typescript
// src/screens/rakuen/board/store.ts
const THIRD_PARTY_UPDATED: string[] = [] // In-memory write lock

updateThirdParty = async () => {
  // Guard 1: Concurrency deduping across session
  if (THIRD_PARTY_UPDATED.includes(this.thirdPartyKey)) return

  setTimeout(() => {
    update(this.thirdPartyKey, {
      list: this.board.list
    })
    THIRD_PARTY_UPDATED.push(this.thirdPartyKey)
  }, 0)
}
```

#### 2. Unmounted React Native Reanimated Worklet Execution
Worklet callbacks scheduled to execute on the JS thread via `scheduleOnRN` or `runOnJS` can resolve after the host React component has unmounted. Accessing React state setters in this window leaks memory and triggers React warning logs.
```typescript
// Mandatory hook lifecycle invariant:
const unmountedRef = useRef(false)

useEffect(() => {
  unmountedRef.current = false
  return () => {
    unmountedRef.current = true
  }
}, [])

const handleAnimationEnd = useCallback(() => {
  if (unmountedRef.current) return // Memory leak guard
  onAnimationEndRef.current?.()
}, [])