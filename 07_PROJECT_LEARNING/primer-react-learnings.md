> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/primer-react-learnings.md`  
> **Source**: github ([https://github.com/primer/react](https://github.com/primer/react))  
> **Source Version**: `0d5607c3`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T00:51:47.177Z  
> **Learning ID**: `learn-github-primer-react`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): primer/react

---

## 1. Executive Forensic Architecture & System Mechanics

`primer/react` is GitHub's foundational design system implementation in React and TypeScript. Its core technical mission is providing an accessible, composable, high-performance UI runtime that bridges the gap between design tokens (Primer Primitives), accessibility mandates (W3C WAI-ARIA 1.2), complex layout state (drag-resizing, virtualized data tables, split panes), and headless composite keyboard navigation (treeviews, action menus, command palettes).

```
                      ┌──────────────────────────────────────────────┐
                      │              @primer/primitives              │
                      │         (Tokens, Colors, Spacings)           │
                      └──────────────────────┬───────────────────────┘
                                             │ CSS Variables
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                     @primer/react                                      │
│                                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────┐  ┌────────────────────────┐  │
│  │   Headless Behaviors  │  │   Compound Slot Engine    │  │ High-Frequency Layout  │  │
│  │ (useTypeahead, Focus) │  │ (FormControl, Split-Slots)│  │ (PageLayout, Resizers) │  │
│  └───────────┬───────────┘  └─────────────┬─────────────┘  └───────────┬────────────┘  │
│              │                            │                            │               │
│              ▼                            ▼                            ▼               │
│  ┌───────────────────────┐  ┌───────────────────────────┐  ┌────────────────────────┐  │
│  │ TreeView / Nav List   │  │  TextInput / Checkbox     │  │  Direct DOM Mutation   │  │
│  │ (Event Target Guard)  │  │  (Expected Component Set) │  │  (Bypass VDOM in Drag) │  │
│  └───────────────────────┘  └───────────────────────────┘  └────────────────────────┘  │
└────────────────────────────────────────────┬───────────────────────────────────────────┘
                                             │ Introspection & Tooling
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │       @primer/doc-gen & @primer/mcp          │
                      │   (TypeScript AST Program Introspection,     │
                      │    Slug Normalization, LLM Context Tools)    │
                      └──────────────────────────────────────────────┘
```

### Architectural Subsystems and Decoupling Boundaries

1. **Compound Component Slot Engine (`packages/react/src/FormControl`)**:
   Instead of unstructured prop-drilling or loose child rendering, Primer uses a slot projection architecture. Components inspect incoming children via `isSlot` or structural component type checks, separating recognized input components (`Checkbox`, `Radio`, `TextInput`, `Select`) from auxiliary child slots (labels, captions, validation messages) and unslotted content. Cloned subcomponents receive accessibility linkage (`aria-describedby`, `id`, `aria-labelledby`) automatically.

2. **Direct-DOM Bypass for High-Frequency Frame Budgets (`packages/react/src/PageLayout/paneUtils.ts`)**:
   For 60/120fps operations such as split-pane drag-resizing, Primer completely decouples from React's Virtual DOM reconciliation loop. During pointer movement, custom inline CSS properties (`--draggable-handle--bg-color`, `--draggable-handle--drag-opacity`) and CSS containment attributes (`data-dragging="true"`) are written synchronously via direct DOM manipulation (`element.style.setProperty`). The layout recalculation avoids React batch re-renders and leverages direct CSS selector scoping.

3. **Type-Level Path Navigation Compiler (`packages/react/src/DataTable/utils.ts`)**:
   Primer's `DataTable` features a bounded recursive type engine (`ObjectPaths<T>` and `ObjectPathValue<T, Path>`). To prevent the TypeScript compiler from suffering recursion depth stack overflows on arbitrary deeply nested data contracts, it utilizes a type-level Peano/tuple accumulator (`ArrayOfLength<10>[number]`) to strictly cap recursive property traversal at a maximum depth of 10.

4. **AST Documentation & Schema Reflection Pipeline (`packages/doc-gen/src/ts-utils.ts`)**:
   Component contracts are extracted at build time by invoking the TypeScript compiler program directly (`ts.createProgram`). The tool traverses the AST, unwraps `ts.ExportAssignment` and variable initializers, filters out `node_modules` prop symbols, parses JSDoc `@default` tags, and builds exact prop documentation JSON payloads, which feed into runtime MCP server utilities for agent consumption.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Event Bubble Filter for Composite Keyboard Navigation
**RULE**:
When an event listener is attached to a composite container (such as a TreeView, DataGrid, or Command Menu) to handle container-level keyboard navigation (typeahead, arrow key navigation, roving tabindex), the handler **MUST** verify that `event.target` is the exact composite node owning the navigation state (or matches the specific container item role) before intercepting key events. The handler **MUST NOT** invoke state transitions or prevent default behavior if the event originated inside an interactive descendant control (`<input>`, `<textarea>`, `<button>`, `[contenteditable]`, or an element with a distinct ARIA role).

**WHY**:
Without this guard, keystrokes intended for nested form controls or inline action buttons bubble up to the container. If a user focuses an inline text input or action button inside a TreeView item and types "c" or rapid keys, the container's typeahead buffer captures the keystroke, initiates search string matching, shifts focus away to another tree item, and mutates focus states unexpectedly, breaking native control input.

**WHEN TO APPLY**:
Apply to any composite ARIA widget (`role="tree"`, `role="grid"`, `role="listbox"`, `role="menu"`) where child items can contain secondary action triggers, filter inputs, or nested interactive nodes.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/react/src/TreeView/useTypeahead.ts
export function useTypeahead({containerRef, onFocusChange}: TypeaheadOptions) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onKeyDown(event: KeyboardEvent) {
      // 1. Boundary check: ensure target is an HTMLElement
      if (!(event.target instanceof HTMLElement)) return

      // 2. Strict Invariant: Only process typeahead if the focused target is the treeitem itself,
      // not a nested button, input, or interactive child
      if (event.target.getAttribute('role') !== 'treeitem') {
        return
      }

      // 3. Reject non-printable characters or whitespace delimiters
      if (!event.key || event.key.length > 1 || event.key === ' ') {
        return
      }

      // Process typeahead match and update focus...
    }

    container.addEventListener('keydown', onKeyDown)
    return () => container.removeEventListener('keydown', onKeyDown)
  }, [containerRef, onFocusChange])
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly attaching keydown listener to container and processing keystrokes
function onKeyDown(event: KeyboardEvent) {
  // BUG: Event bubbles up from nested <input> or <button>; steals keystroke, 
  // breaks text input, and jerks focus to another row.
  if (event.key.length === 1 && event.key !== ' ') {
    const match = findItemStartingWith(event.key)
    if (match) match.focus()
  }
}
```

**VERIFICATION METHOD**:
Verify using `@testing-library/react` and `@testing-library/user-event`:
```typescript
it('allows typing in a nested input without moving focus', async () => {
  const user = userEvent.setup()
  render(
    <TreeView aria-label="Test tree">
      <TreeView.Item id="apple">
        Apple <input aria-label="Filter" />
      </TreeView.Item>
      <TreeView.Item id="cherry">Cherry</TreeView.Item>
    </TreeView>
  )
  const input = screen.getByRole('textbox', {name: 'Filter'})
  await user.type(input, 'ch')
  expect(input).toHaveValue('ch')
  expect(input).toHaveFocus() // Focus must NOT jump to 'cherry'
})
```

---

### 2. Slot Deduplication Invariance Across Layout Branches
**RULE**:
When a compound layout component (e.g., `FormControl`) categorizes children into "managed inputs" (which are cloned with injected accessibility props) and "unslotted passthrough children", the exclusion set used to filter unslotted children **MUST** remain identical across all layout variants (horizontal, vertical, compact). The component **MUST NOT** hardcode a subset filter (e.g., checking only choice inputs like `[Checkbox, Radio]`) in alternative layout branches.

**WHY**:
If an alternative layout branch filters against an incomplete subset of managed inputs while cloning the primary input, the primary input (e.g., `TextInput`, `Select`, `Textarea`) is rendered twice: once as the cloned element, and once as an unslotted passthrough child. This creates duplicate DOM elements with duplicate HTML `id` attributes, resulting in invalid accessibility trees, duplicated form submissions, and corrupted input focus state.

**WHEN TO APPLY**:
Apply to any component implementing compound slot projection, React child cloning (`React.cloneElement`), or multi-branch visual layouts that wrap form inputs.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Define single immutable tuple of recognized/managed input components
const expectedInputComponents = [Checkbox, Radio, TextInput, Textarea, Select] as const

// Uniform extraction invariant across ALL branches:
const isManagedInput = (child: React.ReactNode): boolean => {
  if (!React.isValidElement(child)) return false
  return expectedInputComponents.some(
    inputComponent => child.type === inputComponent || isSlot(child, inputComponent)
  )
}

// In render:
<div className={layoutClass}>
  {/* Cloned managed input */}
  {clonedInput}

  {/* Passthrough children MUST exclude all managed inputs */}
  {childrenWithoutSlots.filter(child => !isManagedInput(child))}
</div>
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Vertical layout filters correctly, but horizontal layout hardcodes an arbitrary subset
<div className="horizontal-layout">
  {clonedInput}
  {/* BUG: Only filters Checkbox/Radio. If child is TextInput, it passes through and renders TWICE! */}
  {childrenWithoutSlots.filter(
    child => React.isValidElement(child) && ![Checkbox, Radio].includes(child.type)
  )}
</div>
```

**VERIFICATION METHOD**:
Enforce duplicate-element prevention tests across all layout modes:
```typescript
it.each(['vertical', 'horizontal', 'condensed'] as const)(
  'renders exactly one input element under layout="%s"',
  layout => {
    const {getAllByRole} = render(
      <FormControl layout={layout}>
        <FormControl.Label>Username</FormControl.Label>
        <TextInput />
      </FormControl>
    )
    expect(getAllByRole('textbox')).toHaveLength(1)
  }
)
```

---

### 3. Bounded Recursion Depth in Type-Level Traversal Engines
**RULE**:
Any recursive conditional type that traverses nested object graphs or generates path tuples/strings **MUST** be bounded by an explicit type-level length accumulator. It **MUST NOT** perform unconstrained recursion over arbitrary `any[]`, `object`, or circular reference types.

**WHY**:
TypeScript's type checker (`tsc`) enforces a maximum instantiation depth limit (often 50 or 100). If an unconstrained type encounters an unindexed array (`any[]`), `Date`, `Map`, or self-referential interface, the compiler fails with `TS2589: Type instantiation is excessively deep and possibly infinite`, halting build pipelines and breaking editor language servers.

**WHEN TO APPLY**:
Apply to all type utility libraries, data table path definitions, form path bindings, and deep object getters in TypeScript libraries.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/react/src/DataTable/utils.ts
export type IsAny<T> = 0 extends 1 & T ? true : false

// Type-level counter constructing a tuple of fixed size
type ArrayOfLength<Length extends number, SizedArray extends Array<unknown> = []> = 
  SizedArray['length'] extends Length
    ? SizedArray
    : ArrayOfLength<Length, [...SizedArray, SizedArray['length']]>

// Strictly cap max traversal depth at 10
type MaxLength = ArrayOfLength<10>[number]

type ArrayWithinBounds<T> = T extends ReadonlyArray<any> & {length: infer Length}
  ? Length extends MaxLength
    ? T
    : never
  : never

export type ObjectPaths<T> = T extends readonly any[] & ArrayWithinBounds<T>
  ? `${ArrayIndex<T>}` | PrefixPath<T, ArrayIndex<T>>
  : T extends any[]
    ? never & 'Unable to determine keys of potentially boundless array'
    : T extends Date
      ? never
      : T extends object
        ? Extract<keyof T, string | number> | PrefixPath<T, Extract<keyof T, string | number>>
        : never
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Unbounded recursive path builder
type BadPaths<T> = T extends object
  ? { [K in keyof T]: `${K & string}.${BadPaths<T[K]>}` }[keyof T] // TS2589 infinite recursion on circular or array types
  : ''
```

**VERIFICATION METHOD**:
Compile-time verification test via `tsd` or `tsc --noEmit`:
```typescript
interface CircularNode {
  name: string
  parent: CircularNode
  unboundedArray: string[]
}

// Compile assertion: must resolve to union without triggering TS2589
type TestPaths = ObjectPaths<CircularNode>
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: TreeView Typeahead Hijacking Nested Control Keystrokes (BUG-TREEVIEW-TYPEAHEAD-01)
- **Context**: `packages/react/src/TreeView/useTypeahead.ts` and `packages/react/src/TreeView/TreeView.test.tsx`
- **What Was Expected**: When focus is within a nested interactive element (e.g., an action button or filter text field embedded inside a `TreeView.Item`), typing characters should interact only with that nested element.
- **What Actually Happened**: Keystrokes typed into nested inputs/buttons bubbled to the tree container's `keydown` listener. The `useTypeahead` hook processed these keystrokes, matched adjacent tree items, and called `onFocusChange`, moving focus to unrelated tree items and appending characters to the treeview's ongoing search buffer.
- **Evidence in Repo**: Commit `0d5607c3`, PR #8524, Changeset `treeview-typeahead-nested-controls.md`.
- **Root Cause**: The `onKeyDown` listener attached to the tree container lacked an event origin guard. It assumed any keyboard event reaching the container was intended for roving treeitem focus navigation, ignoring the fact that `event.target` could be a child `<button>` or `<input>`.
- **Remediation Code Diff**:
```typescript
// packages/react/src/TreeView/useTypeahead.ts
     const container = containerRef.current
 
     function onKeyDown(event: KeyboardEvent) {
+      // Leave keyboard interaction on nested controls to the controls themselves.
+      if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'treeitem') return
+
       // Ignore key presses that don't produce a character value
       if (!event.key || event.key.length > 1 || event.key === ' ') return
```
- **Lesson**: Container-level synthetic navigation hooks must assert role ownership: if `event.target.getAttribute('role') !== expectedRole`, the hook must yield execution immediately.

---

### Incident 2: FormControl Horizontal Layout Slot Duplicate Rendering (BUG-FORMCONTROL-DUP-02)
- **Context**: `packages/react/src/FormControl/FormControl.tsx` and `packages/react/src/FormControl/__tests__/FormControl.test.tsx`
- **What Was Expected**: Rendering `<FormControl layout="horizontal"><TextInput /></FormControl>` must render exactly one `<TextInput>` element within the form control wrapper.
- **What Actually Happened**: The horizontal layout rendered two text inputs. The first was the cloned, accessible-linked input; the second was the unslotted input leaking through the child filter.
- **Evidence in Repo**: Commit `f71dce48`, PR #8508, Issue #8487.
- **Root Cause**: In the horizontal rendering branch, the filtering logic excluded only `[Checkbox, Radio]`. Because `TextInput`, `Select`, and `Textarea` were not in that exclusion list, they passed the filter and were rendered alongside the cloned element. The vertical branch correctly referenced `expectedInputComponents`.
- **Remediation Code Diff**:
```typescript
// packages/react/src/FormControl/FormControl.tsx
@@ -155,7 +155,9 @@ const FormControl = React.forwardRef<HTMLDivElement, FormControlProps>(
           {childrenWithoutSlots.filter(
             child =>
               React.isValidElement(child) &&
-              ![Checkbox, Radio].some(inputComponent => child.type === inputComponent || isSlot(child, inputComponent)),
+              !expectedInputComponents.some(
+                inputComponent => child.type === inputComponent || isSlot(child, inputComponent),
+              ),
           )}
         </div>
         {slots.leadingVisual ? (
```
- **Lesson**: Do not duplicate filtering predicate arrays inline across conditional rendering branches; maintain a single canonical predicate function or component list.

---

### Incident 3: Status-Check Fork Action Privilege Escalation & Unfiltered Skip Bypass (BUG-CI-FORK-SKIP-03)
- **Context**: `.github/workflows/status-checks.yml`
- **What Was Expected**: The GitHub Actions override command for status checks must only allow authorized maintainers to bypass required checks, while forks must have explicit boundaries regarding review and CI skips.
- **What Actually Happened**: Pull requests originating from external forks could trigger issue-comment command flows that lacked explicit restrictions on bypassing CI and required reviews.
- **Evidence in Repo**: Commit `8e3f300b`, PR #8547.
- **Root Cause**: The status check workflow configuration permitted `allow_forks: true` without explicitly passing `skip_ci: true` and `skip_reviews: true` to the authorization action step, leading to potential check bypasses.
- **Remediation Code Diff**:
```yaml
// .github/workflows/status-checks.yml
@@ -99,6 +99,8 @@ jobs:
           # Note: this permission step is _critical_ to make sure only maintainers can run the command
           permissions: 'write,admin'
           allow_forks: true
+          skip_ci: true
+          skip_reviews: true
       - name: Override status checks for issue comment
         if: ${{ github.event_name == 'issue_comment' && steps.command.outputs.continue == 'true' }}
         run: |
```
- **Lesson**: When writing automation that triggers on `issue_comment` across fork boundaries, all skip-condition permissions must default to closed (`skip_ci: true`, `skip_reviews: true`).

---

### Incident 4: MCP Tool Documentation Slug Kebab-Casing Mismatch (BUG-MCP-DOC-SLUG-04)
- **Context**: `packages/mcp` component doc URL resolver and issue tracker #8531.
- **What Was Expected**: Agent calls to `get_component_usage_guidelines` with `{"name": "ActionBar"}` or `{"name": "ConfirmationDialog"}` should fetch `action-bar/guidelines` and `confirmation-dialog/llms.txt`.
- **What Actually Happened**: The MCP tool performed raw lowercasing (`name.toLowerCase()`), requesting `actionbar/guidelines` and `confirmationdialog/llms.txt`, returning 404s or redirecting to the Primer homepage.
- **Evidence in Repo**: Issue #8531, resolved by PR #8530 (`@primer/mcp` 1.1.0).
- **Root Cause**: Missing kebab-case transformation (`param-case` / `kebabCase`) on PascalCase component names before querying documentation URLs.
- **Remediation Pattern**:
```typescript
import {kebabCase} from 'change-case'

export function getDocUrl(componentName: string, path: string): string {
  const slug = kebabCase(componentName)
  return `https://primer.style/react/${slug}/${path}`
}
```
- **Lesson**: Machine-to-machine agents consuming human-facing component catalogs must use formal slug transformation functions rather than naive string lowercasing.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Zero vs Null/Undefined in Style Variables**: In CSS-in-JS or direct style injection, falsy checks like `if (width) style.width = width` drop `0px` values. Primer strictly asserts against `undefined`:
```typescript
// Correct: Distinguishes between 0 and undefined/null
if (value !== undefined && value !== null) {
  element.style.setProperty('--dimension', typeof value === 'number' ? `${value}px` : value)
}
```
* **CSS Variable Pseudo-Element Styling**: When styling pseudo-elements (`::before`, `::after`) during high-frequency interactions (e.g., resizer handles), direct inline styles cannot target pseudo-elements. Setting inline CSS custom properties avoids cascade conflicts:
```typescript
// packages/react/src/PageLayout/paneUtils.ts
handle?.style.setProperty('--draggable-handle--bg-color', 'var(--bgColor-accent-emphasis)')
handle?.style.setProperty('--draggable-handle--drag-opacity', '1')
```
* **Shallow Copy vs Direct Mutation**: In slot parsing, never mutate child elements directly. Always clone via `React.cloneElement` while ensuring ref preservation:
```typescript
React.cloneElement(child, {
  id: child.props.id || generatedId,
  'aria-describedby': clsx(child.props['aria-describedby'], validationMessageId),
  ref: (node: HTMLElement) => {
    // Preserve both original child ref and internal slot ref
    assignRef(child.ref, node)
    assignRef(internalRef, node)
  }
})
```

---

### 2. Infinite Loop & Recursion Guards
* **Type-Level Recursion Depth Shield**: When recursing deeply into arbitrary TypeScript object structures, use tuple length matching as a circuit breaker:
```typescript
type DeepKeyOf<T, Depth extends unknown[] = []> = 
  Depth['length'] extends 8
    ? never
    : T extends object
      ? { [K in keyof T]: K & string | `${K & string}.${DeepKeyOf<T[K], [...Depth, unknown]>}` }[keyof T]
      : never
```
* **Event Loop Microtask Starvation during Resize/Drag**: Synchronous pointermove drag listeners must avoid unbounded queueMicrotask loops. Use direct property writes on the target node and remove listeners on `pointerup` / `pointercancel`:
```typescript
function onPointerDown(e: PointerEvent) {
  const onPointerMove = (moveEvent: PointerEvent) => {
    // Synchronous execution, zero microtask scheduling
    pane.style.setProperty('--pane-width', `${moveEvent.clientX}px`)
  }
  const onPointerUp = () => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }
  window.addEventListener('pointermove', onPointerMove, {passive: true})
  window.addEventListener('pointerup', onPointerUp)
}
```

---

### 3. UI & UX Micro-Mechanics
* **Layout Containment via Data Attributes**: To prevent browser layout thrashing during panel resizing, Primer toggles `data-dragging="true"` on parent containers.
```css
/* CSS containment rule activated during drag */
[data-component="PageLayout"][data-dragging="true"] {
  user-select: none;
  pointer-events: none; /* Prevents iframe/child hover thrashing */
}
[data-component="PageLayout"][data-dragging="true"] [data-resizer-handle] {
  pointer-events: auto; /* Handle retains pointer capture */
}
```
* **Keybinding Chord Ordering**: When parsing keyboard sequences, modifier keys must be sorted canonically (`Control` -> `Meta` -> `Alt` -> `Shift`) so that ARIA accessible labels are identical regardless of author registration order:
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
export const splitChord = (chord: string) =>
  chord.split('+').map(k => k.toLowerCase()).sort((a, b) => keySortPriority(a) - keySortPriority(b))
```

---

### 4. Backend Concurrency & Memory Safety
* **AST Program Creation Caching**: Generating a TypeScript program via `ts.createProgram` is memory-intensive. `packages/doc-gen` extracts configuration once via `getTSProgram`, avoiding AST duplicate parsing:
```typescript
export function getTSProgram(rootDir?: string) {
  const configSearchDir = rootDir ? path.resolve(rootDir) : process.cwd()
  const configPath = ts.findConfigFile(configSearchDir, ts.sys.fileExists)
  const config = ts.readConfigFile(configPath ?? path.join(configSearchDir, 'tsconfig.json'), ts.sys.readFile)
  const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath))
  return ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  })
}
```
* **Event Listener Cleanup Invariants**: All keyboard and pointer listeners bound to `window` or DOM elements outside the React root must return explicit unbind cleanup callbacks in `useEffect`:
```typescript
useEffect(() => {
  const target = elementRef.current
  if (!target) return
  const handler = (e: KeyboardEvent) => { /* ... */ }
  target.addEventListener('keydown', handler)
  return () => {
    target.removeEventListener('keydown', handler)
  }
}, [elementRef])
```

---

### 5. Defect & Error Prevention ("Galti Pakadna")
* **Ref Reflection Fallback**: When traversing AST nodes to locate component types, exported symbols may be direct function declarations, forwardRefs, or aliased exports. A node resolver must handle all AST wrappings:
```typescript
function getComponentNodeForSymbol(checker: ts.TypeChecker, componentSymbol: ts.Symbol): ts.Node {
  const declarations = componentSymbol.getDeclarations()
  if (!declarations || declarations.length === 0) {
    throw new Error(`No declarations found for component ${componentSymbol.getName()}`)
  }
  let declaration = declarations[0]
  if (ts.isExportAssignment(declaration)) {
    const exportSymbol = checker.getSymbolAtLocation(declaration.getChildren()[0])
    if (!exportSymbol || !exportSymbol.getDeclarations()?.length) {
      throw new Error(`Unable to find export symbol for component ${componentSymbol.getName()}`)
    }
    declaration = exportSymbol.getDeclarations()![0]
  }
  if (ts.isVariableDeclaration(declaration)) {
    return declaration.initializer!
  }
  return declaration
}
```
* **Icon Presence Normalization**: In `StateLabel`, empty states (such as `open` or `closed` statuses without icons) must skip rendering Octicon primitives cleanly rather than rendering empty SVG elements or throwing errors:
```typescript
const noIconStatus = status === 'open' || status === 'closed'
{!noIconStatus && (
  <Octicon
    icon={octiconMap[status]}
    aria-label={labelMap[status]}
    className={classes.Icon}
  />
)}
```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Primer React separates functional requirements into:
- **Core Primitives**: Low-level building blocks (`Box`, `Text`, `Heading`) acting as pure token bridges.
- **Form System**: Slotted, context-driven validation containers (`FormControl`) managing automatic association of `id`, `aria-labelledby`, `aria-describedby`, and validation text.
- **Composite Navigation**: Focus roving hooks (`useTypeahead`, `useFocusZone`) decoupled from rendering structures.
- **CSS Modules & Containment**: Progressive migration away from runtime CSS-in-JS (styled-components) toward compile-time CSS Modules (`*.module.css`) paired with HTML `data-*` attributes (`data-size`, `data-status`, `data-component`) to enforce clean O(1) attribute styling.

### 2. Core Abstractions
- `Slot Pattern`: `createSlot()` utilities that match incoming children to designated component layout targets without requiring fixed nesting arrangements.
- `ObjectPaths<T>`: Strict compile-time string representation of object navigation paths for tables and forms.
- `AccessibleChord`: Platform-aware keyboard representation mapping `Mod` to `Command` on Apple devices and `Ctrl` on Windows/Linux.

### 3. Error Handling
- **Graceful AST Recovery**: In documentation generation (`ts-utils.ts`), missing docstrings or third-party imported prop types in `node_modules` are silently skipped rather than terminating the whole documentation run.
- **Degraded Navigation**: If typeahead search finds no matching item, keyboard input fails silently without moving user focus or swallowing unhandled character events.

### 4. Testing
- Testing infrastructure uses **Vitest** with `@testing-library/react` and `@testing-library/user-event`.
- Uses `vi.useFakeTimers()` to test typeahead keystroke debounce timers (e.g. 500ms timeout before clearing search buffer).
- Tests assert explicit ARIA accessibility states (`toHaveFocus()`, `toHaveValue()`, `getByRole()`).
- Automated classname test coverage via `node script/check-classname-tests.mjs`.

### 5. Security
- **CI Privilege Boundaries**: Workflows triggering on `issue_comment` require `permissions: 'write,admin'` and must lock down execution paths when PRs originate from forks (`skip_ci: true`, `skip_reviews: true`).
- **JSDoc Sanitization**: When generating documentation strings from TypeScript ASTs, quote stripping (`replace(/^"(.*)"$/, '$1')`) prevents quotation escape injection into markdown and doc files.

### 6. Performance
- **CSS Variable Bypass**: Direct manipulation of inline CSS variables during resizing avoids Virtual DOM re-renders, preventing dropped frames during user interactions.
- **CSS Containment**: Applying `data-dragging="true"` isolates styles, preventing hover computations and expensive reflow cascades on inner elements during drag.

### 7. Deployment
- **Changesets Tooling**: Versioning and releasing managed across monorepo packages (`packages/react`, `packages/mcp`, `packages/rolldown-plugin-import-css`) using `@changesets/cli`.
- **Turborepo Invariants**: Caches build artifacts with strict pipeline dependencies (`turbo run build --filter='!./examples/*'`).
- **Engine Restrictions**: Enforces modern Node versions (`^22.18 || ^24.1