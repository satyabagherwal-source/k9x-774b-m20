> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/primer-react-learnings.md`  
> **Source**: github ([https://github.com/primer/react](https://github.com/primer/react))  
> **Source Version**: `190fafd9`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T06:56:51.703Z  
> **Learning ID**: `learn-github-primer-react`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): primer/react

---

## 1. Executive Forensic Architecture & System Mechanics

`primer/react` is GitHub's canonical Design System implementation in React and TypeScript. Its core technical problem is delivering accessible, high-performance UI primitives across dense desktop, mobile, and agentic surfaces while maintaining compile-time type safety, headless slot composability, zero-layout-shift SSR hydration, and automatic memoization compatibility with the React Compiler.

```
                    ┌────────────────────────────────────────────────────────┐
                    │                   Consumer Application                 │
                    └───────────┬────────────────────────────────┬───────────┘
                                │ JSX Composition                │ Slotted Child Injection
                                ▼                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PRIMER REACT RUNTIME CORE                                    │
│                                                                                             │
│  ┌─────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐  │
│  │   Slot Engine / Children│  │     Live Region Engine    │  │    CSS Containment Engine │  │
│  │   - isSlot(child, Type) │  │     - Persistent live     │  │    - paneUtils.ts         │  │
│  │   - Index key stamping  │  │       region node in DOM  │  │    - Direct CSS var write │  │
│  │   - Split slot vs rest  │  │     - Dynamic queueing    │  │    - [data-dragging] attr │  │
│  └───────────┬─────────────┘  └─────────────┬─────────────┘  └─────────────┬─────────────┘  │
│              │                              │                              │                │
│              ▼                              ▼                              ▼                │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                      React Compiler Optimization Invariants                           │  │
│  │  - Zero mutable reassignment in useMemo (indices refactored to object references)    │  │
│  │  - Ref detachment from HTML props (Omit<Props, 'ref'> to avoid React 19 forwardRef   │  │
│  │    type collisions and hook lint errors)                                              │  │
│  │  - Stable effect cleanup references (capture timers.current into local stack ref)     │  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                        ┌──────────────────────┴──────────────────────┐
                        ▼                                             ▼
┌──────────────────────────────────────────────┐  ┌───────────────────────────────────────────┐
│     @primer/doc-gen (Type Engine)            │  │     @primer/mcp (Agentic Subsystem)       │
│  - ts.createProgram & AST Walker             │  │  - Tool dispatch (get_component_*)        │
│  - Call-signature introspection              │  │  - Strict slug matching: kebab-case slugs │
│  - ObjectPaths<T> bounded tuple recursion    │  │    instead of internal catalog IDs        │
└──────────────────────────────────────────────┘  └───────────────────────────────────────────┘
```

### Critical Subsystem Boundaries & Abstractions

1. **Child Introspection & Slot Boundary (`isSlot` / Composite Child Partitioning)**:
   Primer isolates declarative composition from imperative DOM trees. Components such as `UnderlinePanels` and `FormControl` parse incoming `children` using `Children.map` and type markers (`isSlot(child, Component)`). They partition children into slotted structural elements (Labels, Captions, Validation Messages) and raw form inputs, ensuring single-ownership rendering.
2. **Type-Level Safe Path Projection (`ObjectPaths<T>`)**:
   Deep object introspection for components like `DataTable` is constrained at the type level. Primer implements recursion guards using length-indexed tuple expansion (`ArrayOfLength<10>[number]`) to halt infinite TypeScript compiler evaluation on cyclic data graphs.
3. **Imperative Drag Optimization & CSS Variable Containment (`paneUtils.ts`)**:
   Split-pane resizing avoids React state-driven reconciliation loops. It applies inline CSS variable overrides (`--draggable-handle--bg-color`) and element-level data attributes (`data-dragging="true"`) directly to the DOM nodes. This eliminates sub-tree CSS cascade recalculations and layout thrashing during mousemove cycles.
4. **Agentic Knowledge Protocol (`@primer/mcp`)**:
   A Model Context Protocol (MCP) server exposes Primer design guidelines, props definitions, and accessibility invariants to AI coding agents, resolving component names to canonical web slugs (`text-input` vs `text_input`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. React Compiler-Safe Mutable Accumulator Pattern
**RULE**:
Code executing inside React lifecycle hooks, render paths, or memoization hooks (`useMemo`, `useCallback`) MUST NOT reassign bare local variables (`let counter = 0; counter++`) across nested function closures (e.g., `Children.map` or `Array.prototype.forEach`). Developers MUST encapsulate mutable accumulation state within a single heap-allocated object reference (`const indices = { tab: 0, panel: 0 }; indices.tab++`).

**WHY**:
The React Compiler converts components into static single-assignment (SSA) memoization blocks. When a `let` variable declared in an outer memoized scope is reassigned inside a nested callback passed to `Children.map`, the compiler cannot determine if the variable escapes or changes reactivity boundaries. This invalidates compiler memoization guarantees, forces unmemoized deoptimizations, and triggers compiler bailouts.

**WHEN TO APPLY**:
Apply in any React codebase running React Compiler (`babel-plugin-react-compiler`) or strict lint rules (`react-hooks/exhaustive-deps`, `@eslint-react/hooks-extra`), specifically when deriving child keys or counting slotted child types during render.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/react/src/experimental/UnderlinePanels/UnderlinePanels.tsx
const [tabs, tabPanels] = useMemo(() => {
  // CORRECT: Encapsulate mutable counters inside an immutable object binding
  const indices = {
    tab: 0,
    panel: 0,
  }

  const childrenWithProps = Children.map(children, child => {
    if (isValidElement<TabProps & WithValue>(child) && (child.type === Tab || isSlot(child, Tab))) {
      const value = child.props.value ?? `${indices.tab}`
      indices.tab++
      return cloneElement(child, {value})
    }

    if (isValidElement<PanelProps & WithValue>(child) && (child.type === Panel || isSlot(child, Panel))) {
      const value = child.props.value ?? `${indices.panel}`
      indices.panel++
      return cloneElement(child, {value})
    }
    return child
  })

  return [/* ... derived state ... */]
}, [children])
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Bare primitive reassignment across nested closure boundaries
const [tabs, tabPanels] = useMemo(() => {
  let tabIndex = 0     // React Compiler bailout: mutating primitive outer bindings
  let panelIndex = 0

  const childrenWithProps = Children.map(children, child => {
    if (isValidElement(child)) {
      const value = child.props.value ?? `${tabIndex}`
      tabIndex++      // Triggers react-compiler mutation escape analysis failure
      return cloneElement(child, {value})
    }
    return child
  })
  return [/* ... */]
}, [children])
```

**VERIFICATION METHOD**:
Run the React Compiler CLI verification pass:
```bash
npx react-compiler-healthcheck --src="src"
```
Ensure target files pass compilation without appearing in the `unsupportedPatterns` exclusion table in `packages/react/script/react-compiler.mjs`.

---

### 2. Effect Cleanup Local Reference Snapshotting
**RULE**:
When an effect allocates, tracks, or invalidates mutable runtime resources using a React `ref` (such as a `Set` or array of timer IDs, DOM listeners, or AbortControllers), the cleanup callback MUST read from a locally captured variable bound inside the effect execution, rather than dereferencing `ref.current` during cleanup teardown.

**WHY**:
By the time React invokes the unmount cleanup function, `ref.current` may have been mutated, detached, or cleared by concurrent lifecycle updates. Furthermore, reading `.current` in the cleanup function without an exhaustive dependency triggers the `react-hooks/exhaustive-deps` warning and creates race conditions if the ref is concurrently updated before teardown completes.

**WHEN TO APPLY**:
Universal across all React hooks managing imperative external timers, subscriptions, event listeners, or WebSocket handles stored within `useRef`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/react/src/hooks/useSafeTimeout.ts
export default function useSafeTimeout(): {
  safeSetTimeout: SetTimeout
  safeClearTimeout: ClearTimeout
} {
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    // CORRECT: Capture the instance reference into local closure stack immediately
    const timerSet = timers.current
    return () => {
      for (const id of timerSet) {
        clearTimeout(id)
      }
    }
  }, []) // Safe zero-dependency lifecycle hook compliant with React Compiler

  // ...
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Dereferencing .current inside cleanup callback
useEffect(() => {
  return () => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    for (const id of timers.current) { // FAILS: timers.current can be stale or mutated
      clearTimeout(id)
    }
  }
}, [])
```

**VERIFICATION METHOD**:
Enforce ESLint without disabling comments:
```json
{
  "rules": {
    "react-hooks/exhaustive-deps": "error"
  }
}
```
Verification passes when no `// eslint-disable-next-line react-hooks/exhaustive-deps` suppression comment exists above a ref dereference in cleanup blocks.

---

### 3. Slot-Segregated Child Partitioning Invariant
**RULE**:
When an orchestrator component partitions child elements into explicit sub-components (slots) versus default remaining children, it MUST maintain a strict disjoint union. Any element identified, extracted, or cloned for dedicated slot placement MUST be explicitly filtered out from the fallback/remaining children collection across ALL layout and render branches.

**WHY**:
Failing to remove an identified element from the generic children collection causes the element to be rendered twice in the DOM tree (once in the slotted position and once in the generic container). In form components (`FormControl`), this duplicates input controls with identical `id` and `name` attributes, breaking form submission payloads, label associations (`aria-labelledby`), and unique ID accessibility invariants.

**WHEN TO APPLY**:
Any container component utilizing composite declarative children (`SelectPanel`, `FormControl`, `ActionMenu`, `NavList`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Safe child segregation invariant
const expectedInputComponents = [TextInput, Textarea, Select, Checkbox, Radio]

// 1. Identify and extract designated input
const inputChild = childrenWithoutSlots.find(child =>
  isValidElement(child) && expectedInputComponents.some(comp => child.type === comp)
)

// 2. MUST filter out ALL expected input types from remaining render pool
const remainingChildren = childrenWithoutSlots.filter(child => {
  if (!isValidElement(child)) return true
  // Explicitly disallow any component that was handled as an inputChild
  return !expectedInputComponents.some(comp => child.type === comp)
})

return (
  <div className={layout === 'horizontal' ? classes.Horizontal : classes.Vertical}>
    {inputChild && cloneElement(inputChild, { id: inputId, 'aria-describedby': captionId })}
    {remainingChildren}
  </div>
)
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Asymmetric branch filtering causing duplicate inputs
const inputChild = childrenWithoutSlots.find(/* ... */)

// Bug in horizontal layout: only excluding Checkbox and Radio, leaving TextInput
const remainingChildren = layout === 'horizontal'
  ? childrenWithoutSlots.filter(child => child.type !== Checkbox && child.type !== Radio) // TextInput rendered TWICE!
  : childrenWithoutSlots.filter(child => !expectedInputComponents.some(c => child.type === c))
```

**VERIFICATION METHOD**:
Automated Jest/Vitest DOM snapshot and query assertions:
```typescript
it('renders exactly one input element regardless of layout mode', () => {
  const { container } = render(
    <FormControl layout="horizontal">
      <FormControl.Label>Username</FormControl.Label>
      <TextInput name="username" />
    </FormControl>
  )
  expect(container.querySelectorAll('input[name="username"]')).toHaveLength(1)
})
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: React Compiler Deoptimization via Closure Counter Mutation & Ref Forwarding Collisions (BUG-PRIMER-01)
- **Context**: `packages/react/src/experimental/UnderlinePanels/UnderlinePanels.tsx` and `packages/react/src/Token/_RemoveTokenButton.tsx`.
- **What Was Expected**: The React Compiler should automatically memoize `UnderlinePanels` and `Token` components without code bailouts or ESLint ref warnings.
- **What Actually Happened**: The React Compiler compiler script (`packages/react/script/react-compiler.mjs`) had marked these components in the `unsupportedPatterns` blocklist. In `UnderlinePanels`, mutable reassignment of `let tabIndex = 0` inside `Children.map` broke React Compiler's SSA intermediate representation. In `_RemoveTokenButton`, spreading `rest` containing `ref` while explicitly passing `ref={rest.ref}` triggered `react-hooks/refs` lint errors and React 19 forwardRef incompatibilities.
- **Evidence in Repo**: Commit SHA `746d76ae`, PR `#8555`.
- **Root Cause**:
  1. Primitive variables defined in `useMemo` were closed over and mutated across child mapper iterations.
  2. Component types inherited React HTML attributes including `ref`, and then spread those attributes onto a native button alongside an explicit typed ref cast (`ref={rest.ref as React.Ref<HTMLButtonElement>}`), violating compiler invariants.
- **Remediation Code Diff**:
```diff
--- a/packages/react/src/experimental/UnderlinePanels/UnderlinePanels.tsx
+++ b/packages/react/src/experimental/UnderlinePanels/UnderlinePanels.tsx
@@ -147,19 +147,21 @@ const UnderlinePanels: FCWithSlotMarker<UnderlinePanelsProps> = ({
    const [tabs, tabPanels, tabsHaveIcons, selectedFromProps, tabValues, panelValues] = useMemo(() => {
-    let tabIndex = 0
-    let panelIndex = 0
+    const indices = {
+      tab: 0,
+      panel: 0,
+    }
 
     const childrenWithProps = Children.map(children, child => {
       if (isValidElement<TabProps & WithValue>(child) && (child.type === Tab || isSlot(child, Tab))) {
-        const value = child.props.value ?? `${tabIndex}`
-        tabIndex++
+        const value = child.props.value ?? `${indices.tab}`
+        indices.tab++
         return cloneElement(child, {value})
       }
 
--- a/packages/react/src/Token/_RemoveTokenButton.tsx
+++ b/packages/react/src/Token/_RemoveTokenButton.tsx
@@ -12,7 +12,8 @@ interface TokenButtonProps {
    isParentInteractive?: boolean
  }
  
-type RemoveTokenButtonProps = TokenButtonProps & Omit<React.HTMLProps<HTMLSpanElement | HTMLButtonElement>, 'size'>
+type RemoveTokenButtonProps = TokenButtonProps &
+  Omit<React.HTMLProps<HTMLSpanElement | HTMLButtonElement>, 'size' | 'ref'>
 
@@ -43,16 +44,13 @@ const RemoveTokenButton = ({
    return (
      <button
-      // eslint-disable-next-line react-hooks/refs
        {...rest}
        aria-label={'Remove token'}
        data-size={size}
        className={clsx(classes.TokenButton, className)}
        style={{
          transform: `translate(${borderOffset}px, -${borderOffset}px)`,
        }}
-      // eslint-disable-next-line react-hooks/refs
-      ref={rest.ref as React.Ref<HTMLButtonElement>}
        type="button"
      >
```
- **Lesson**: Do not manage refs manually via prop spreading. Omit `ref` from component prop extensions (`Omit<Props, 'ref'>`), and represent mutable closure counters through persistent object properties (`indices.tab++`).

---

### Incident 2: MCP Tool Component URL Routing Slug Mismatch (BUG-PRIMER-02)
- **Context**: `packages/mcp/src/server.ts`
- **What Was Expected**: MCP tools `get_component_examples` and `get_component_accessibility_guidelines` must fetch exact documentation pages from `https://primer.style/product/components/{slug}`.
- **What Actually Happened**: The MCP server requested documentation using internal component catalog identifiers (`match.id`), e.g., `text_input` or `actionbar`. When requested, `primer.style` returned HTTP 302 redirects or degraded to the generic primer homepage (`primer.style/`) instead of the targeted documentation.
- **Evidence in Repo**: Commit SHA `e0524db5`, PR `#8582`, Issue `#8531`.
- **Root Cause**: The catalog schema distinguished between internal identifier `id` (e.g. `text_input`, `confirmationdialog`) and web URL routing slug `slug` (e.g. `text-input`, `confirmation-dialog`). The tool handlers interpolated `${match.id}` instead of `${match.slug}`.
- **Remediation Code Diff**:
```diff
--- a/packages/mcp/src/server.ts
+++ b/packages/mcp/src/server.ts
@@ -253,7 +253,7 @@ export function createMcpServer(...) {
-      const url = new URL(`/product/components/${match.id}`, 'https://primer.style')
+      const url = new URL(`/product/components/${match.slug}`, 'https://primer.style')
       const response = await fetch(url)
       if (!response.ok) {
         throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
@@ -387,7 +387,7 @@ export function createMcpServer(...) {
-      const url = new URL(`/product/components/${match.id}/accessibility`, 'https://primer.style')
+      const url = new URL(`/product/components/${match.slug}/accessibility`, 'https://primer.style')
       const response = await fetch(url)
```
- **Lesson**: Never conflate entity storage keys/identifiers with external resource URL slugs. Enforce URL routing contracts via parameterized unit tests covering all multi-word component slugs.

---

### Incident 3: Duplicate Form Input Rendering in Horizontal FormControl Layout (BUG-PRIMER-03)
- **Context**: `packages/react/src/FormControl/FormControl.tsx`
- **What Was Expected**: Rendering `<FormControl layout="horizontal"><TextInput /></FormControl>` must render exactly one `<input>` element.
- **What Actually Happened**: With `layout="horizontal"`, `TextInput`, `Textarea`, and `Select` components rendered twice. The cloned input was rendered inside the control container, and the original input was rendered a second time in the remaining children container.
- **Evidence in Repo**: Issue `#8487`, Commit `8c0b708fc`.
- **Root Cause**: In the horizontal layout branch, the filter predicate only excluded choice inputs:
  `childrenWithoutSlots.filter(child => child.type !== Checkbox && child.type !== Radio)`.
  Because `TextInput`, `Select`, and `Textarea` are non-choice inputs, they survived the filter and were rendered alongside the cloned input. The vertical layout branch correctly checked against `expectedInputComponents.some(...)`.
- **Remediation Code Diff**:
```diff
--- a/packages/react/src/FormControl/FormControl.tsx
+++ b/packages/react/src/FormControl/FormControl.tsx
@@ -155,5 +155,5 @@ const FormControl = ({children, layout = 'vertical', ...rest}) => {
-      {childrenWithoutSlots.filter(
-        child => isValidElement(child) && child.type !== Checkbox && child.type !== Radio
-      )}
+      {childrenWithoutSlots.filter(
+        child => isValidElement(child) && !expectedInputComponents.some(c => child.type === c)
+      )}
```
- **Lesson**: Symmetric layout branches must share identical filter exclusion sets. Never hardcode ad-hoc type checks in alternate layout rendering branches.

---

### Incident 4: Screen Reader Announcement Dropouts on Dynamic ARIA Live Regions (BUG-PRIMER-04)
- **Context**: `contributor-docs/adrs/adr-020-live-regions.md`
- **What Was Expected**: Programmatic status announcements (such as search result counts or background task completions) must reliably trigger across screen reader and browser combinations (NVDA, JAWS, VoiceOver).
- **What Actually Happened**: Dynamically mounted live regions (`<div aria-live="polite">{message}</div>`) failed to announce. Screen readers do not register live regions injected into the DOM at the exact moment their text content changes.
- **Evidence in Repo**: Commit SHA `fb6001c8`, ADR 020.
- **Root Cause**: Accessibility APIs register an element as an active live region during DOM insertion only if it starts empty. When an element is inserted with text already present, or if its visibility is toggled from `display: none` to `block`, screen readers suppress the announcement to avoid reading off-screen boilerplate.
- **Remediation Code Diff**:
```typescript
// Architecture remediation adopted in ADR 020:
// 1. Maintain a permanent, persistent live region element in the DOM at all times.
// 2. Announce messages by appending text nodes into the pre-existing DOM node.
export function announce(message: string, { politeness = 'polite' }: AnnounceOptions = {}) {
  let container = document.getElementById(`primer-live-region-${politeness}`)
  if (!container) {
    container = document.createElement('div')
    container.id = `primer-live-region-${politeness}`
    container.setAttribute('aria-live', politeness)
    container.setAttribute('aria-atomic', 'true')
    container.className = 'sr-only' // visually hidden
    document.body.appendChild(container)
  }
  // Clear and update textContent in separate tick to force accessibility mutation event
  container.textContent = ''
  requestAnimationFrame(() => {
    container.textContent = message
  })
}
```
- **Lesson**: Never dynamically mount `aria-live` containers on the fly. Persist the live region container in the root DOM, mutating its text contents across animation frames to guarantee accessibility tree dispatch.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Accurate `any` Detection Primitive
In generic TypeScript utilities (`DataTable/utils.ts`), testing for `any` requires handling the rule where `any` acts as a wildcard across intersections. Primer uses the following identity:
```typescript
// packages/react/src/DataTable/utils.ts
export type IsAny<T> = 0 extends 1 & T ? true : false
```
`1 & T` reduces to `any` if `T` is `any`. Because `0 extends any` evaluates to `true`, the condition uniquely identifies `any` while correctly returning `false` for `unknown`, `never`, `void`, or primitive unions.

#### Safe Fallback Index Stamping
When deriving keys from children in React, check for `null` or `undefined` without corrupting index `0`:
```typescript
// Correct: Nullish coalescing preserves 0 as a valid explicit value
const value = child.props.value ?? `${indices.tab}`

// FAILS: Logical OR treats value={0} as falsy and overwrites it with index string
const value = child.props.value || `${indices.tab}`
```

#### Prop Exclusion Collision on Button Wrapping
When typing composite buttons, omitting `size` is insufficient if the native HTML attributes conflict with custom ref forwarding:
```typescript
// Correct: Stripping both 'size' and 'ref' prevents forwardRef collisions in React 19
type RemoveTokenButtonProps = TokenButtonProps &
  Omit<React.HTMLProps<HTMLSpanElement | HTMLButtonElement>, 'size' | 'ref'>
```

---

### 2. Infinite Loop & Recursion Guards

#### Bounded Type-Level Recursion Depth
Unconstrained path resolution on nested structures will crash the TypeScript compiler with `Type instantiation is excessively deep and possibly infinite`. Primer bounds depth using an accumulator tuple:
```typescript
// packages/react/src/DataTable/utils.ts
type ArrayOfLength<Length extends number, SizedArray extends Array<unknown> = []> = 
  SizedArray['length'] extends Length
    ? SizedArray
    : ArrayOfLength<Length, [...SizedArray, SizedArray['length']]>

// Constrain recursion to maximum depth of 10
type MaxLength = ArrayOfLength<10>[number] // 0 | 1 | 2 | ... | 9

type ArrayWithinBounds<T> = T extends ReadonlyArray<any> & {length: infer Length}
  ? Length extends MaxLength
    ? T
    : never
  : never
```
This forces cyclic type-graph navigation to abort with `never`, preserving IDE responsiveness and CI build performance.

#### Safe Effect Timer Evacuation
In `useSafeTimeout`, timer handles are tracked via a `Set`. If clearing a timer triggers a synchronous unmount that re-enters the cleanup hook, iterating over a mutated collection causes race conditions. Capturing the instance locally ensures termination:
```typescript
useEffect(() => {
  const timerSet = timers.current
  return () => {
    for (const id of timerSet) {
      clearTimeout(id)
    }
    timerSet.clear()
  }
}, [])
```

---

### 3. UI & UX Micro-Mechanics

#### Drag Performance via Inline CSS Variables and Containment
```typescript
// packages/react/src/PageLayout/paneUtils.ts
export function setDraggingStyles({handle, pane, contentWrapper}: DraggingStylesParams) {
  // 1. Direct CSS variable manipulation avoids invalidating pseudo-element styles
  handle?.style.setProperty('--draggable-handle--bg-color', 'var(--bgColor-accent-emphasis)')
  handle?.style.setProperty('--draggable-handle--drag-opacity', '1')
  handle?.style.setProperty('--draggable-handle--transition', 'none')

  // 2. Set direct data attribute for CSS containment:
  // CSS: [data-dragging="true"] { pointer-events: none; user-select: none; }
  pane?.setAttribute('data-dragging', 'true')
  contentWrapper?.setAttribute('data-dragging', 'true')
}
```
*Micro-mechanic*: Setting `pointer-events: none` on `contentWrapper` during drag prevents iframes or text nodes inside panes from capturing mouse events, eliminating jerky drag behavior. Writing to CSS variables bypasses the React reconciler entirely during 60fps drag operations.

#### Keyboard Chord Canonical Sorting
Chords must be deterministically sorted before comparison or `aria-label` synthesis to prevent discrepancies between `'Control+Alt+Delete'` and `'Alt+Control+Delete'`:
```typescript
// packages/react/src/KeybindingHint/components/utils.ts
const keySortPriorities: Partial<Record<string, number>> = {
  control: 1,
  meta: 2,
  alt: 3,
  option: 4,
  shift: 5,
  function: 6,
}

const keySortPriority = (priority: string) => keySortPriorities[priority] ?? Infinity
const compareLowercaseKeys = (a: string, b: string) => keySortPriority(a) - keySortPriority(b)

export const splitChord = (chord: string) =>
  chord
    .split('+')
    .map(k => k.toLowerCase())
    .sort(compareLowercaseKeys)
```
Non-modifier characters receive priority `Infinity`, sorting them after modifiers (e.g., `['control', 'shift', 'k']`).

---

### 4. Backend Concurrency & Memory Safety

#### TOCTOU Mitigation in Programmatic AST Resolution
When resolving TypeScript source files from component directories, parallel file system access can fail if paths are modified during compilation.
```typescript
// packages/doc-gen/src/ts-utils.ts
function getFirstMatchingFile(componentPath: string, componentName: string): string | undefined {
  const paths = [
    path.join(componentPath, `index.ts`),
    path.join(componentPath, `index.tsx`),
    path.join(componentPath, `${componentName}.tsx`),
  ]

  for (const p of paths) {
    try {
      fs.accessSync(p, fs.constants.R_OK)
      return p
    } catch {
      // File does not exist or lacks read permission, proceed to next fallback
    }
  }
  return undefined
}
```
*Concurrency Invariant*: Rather than chaining `fs.existsSync` followed by `fs.readFileSync` (a TOCTOU race), `accessSync` immediately checks read permissions against the descriptor, gracefully falling back across expected extensions.

---

### 5. Defect & Error Prevention ("Galti Pakadna")

#### TypeScript AST Declaration Unwrapping
In AST doc-gen tooling (`packages/doc-gen/src/ts-utils.ts`), naive symbol introspection fails on default export re-assignments. Primer handles export redirections using type-narrowed declaration guards:
```typescript
function getComponentNodeForSymbol(checker: ts.TypeChecker, componentSymbol: ts.Symbol): ts.Node {
  const declarations = componentSymbol.getDeclarations()
  if (!declarations || declarations.length === 0) {
    throw new Error(`No declarations found for component ${componentSymbol.getName()}`)
  }

  let declaration = declarations[0]

  // Unwrap `export default Component` redirection
  if (ts.isExportAssignment(declaration)) {
    const exportSymbol = checker.getSymbolAtLocation(declaration.getChildren()[0])
    if (!exportSymbol) {
      throw new Error(`Unable to find export symbol for component ${componentSymbol.getName()}`)
    }
    const exportDeclarations = exportSymbol.getDeclarations()
    if (!exportDeclarations || exportDeclarations.length === 0) {
      throw new Error(`No declarations found for export symbol of component ${componentSymbol.getName()}`)
    }
    declaration = exportDeclarations[0]
  }

  // Unwrap `const Component = ...` variable initializer
  if (ts.isVariableDeclaration(declaration)) {
    return declaration.initializer!
  }

  return declaration
}
```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Primer uses a three-tier architecture:
1. **Core Theme & Token System**: Primitive CSS custom properties distributed via `@primer/primitives`.
2. **Behavioral Headless Hooks**: Stateful primitives (`useControllableState`, `useFocusTrap`, `useFocusZone`, `useAnchoredPosition`).
3. **Presentational & Slotted Components**: View layers wrapping CSS modules (`classes.StateLabel`) with accessibility bindings.
Subsystem boundaries are maintained using monorepo packages (`packages/react`, `packages/mcp`, `packages/doc-gen`).

### 2. Core Abstractions
- **Slots via Marker Interfaces**: Custom React element tagging (`isSlot(child, TargetComponent)`) allows compound components to project child content into distinct markup targets without prop-drilling.
- **Controlled/Uncontrolled Bridge**: `useControllableState` manages external controlled values against internal fallbacks.
- **Accessible State Primitives**: Discriminated union types such as `StateLabelProps` cleanly map octicons to semantic labels (`octiconMap` and `labelMap`).

### 3. Error Handling
- **Prop Type Assertions**: Compile-time failures using `never` projections (`ObjectPaths<T>`).
- **AST Parser Degradation**: Non-crashing falls in `doc-gen` through safe symbol recovery and fallback file resolvers.
- **MCP Network Boundaries**: Status-code-aware error payloads for external requests (`response.status >= 400 && response.status < 500`).

### 4. Testing
- **Multi-Level Harness**: Unit testing with Vitest, visual regression tests via Playwright, and browser interaction testing via Storybook play functions.
- **Coverage Validation**: Custom AST-driven class name coverage tools (`node script/check-classname-tests.mjs`) verify