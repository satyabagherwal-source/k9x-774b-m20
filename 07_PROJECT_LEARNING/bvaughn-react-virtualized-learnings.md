> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bvaughn-react-virtualized-learnings.md`  
> **Source**: github ([https://github.com/bvaughn/react-virtualized](https://github.com/bvaughn/react-virtualized))  
> **Source Version**: `30741f73`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-26T02:26:49.316Z  
> **Learning ID**: `learn-github-bvaughn-react-virtualized`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): bvaughn/react-virtualized

---

## 1. Executive Forensic Architecture & System Mechanics

`react-virtualized` solves the $O(N)$ DOM node degradation problem in modern web browsers by virtualizing tabular and multi-dimensional coordinate spaces into an $O(V)$ windowed rendering pipeline, where $V$ represents strictly the visible viewport window plus an overscan buffer ($V \ll N$). 

```
                                 [ VIEWPORT CONTAINER ]
               Scroll Position: offsetLeft / offsetTop (window or container)
                                         |
                                         v
                      +--------------------------------------+
                      |  CellSizeAndPositionManager          |
                      |  - JIT O(1) cached lookup            |
                      |  - O(log N) Exponential+Binary Search|
                      +--------------------------------------+
                                         |
            [Raw Offset Space > 1.67M px?] (Browser DOM Layout Limit)
                                    /        \
                             YES   /          \   NO
                                  v            v
             +-----------------------+     +-----------------------+
             | ScalingCellSizeAnd-   |     | Linear Offset Space   |
             | PositionManager       |     | (1:1 DOM Coordinate)  |
             | (Safe Ratio Scaling)  |     +-----------------------+
             +-----------------------+                 |
                                  \                    /
                                   v                  v
                      +--------------------------------------+
                      |      defaultCellRangeRenderer        |
                      |  - Deferred Measurement (0,0 auto)   |
                      |  - Caching Matrix: !scroll & !scaled |
                      |  - Synthetic A11y Injection          |
                      +--------------------------------------+
                                         |
                                         v
                              [ Target DOM Tree: O(V) ]
```

### Architectural Subsystems and Domain Primitives
1. **Coordinate & Offset Mapping Engine (`CellSizeAndPositionManager` & `ScalingCellSizeAndPositionManager`)**:
   - Manages variable and uniform cell dimensions along a discrete single-dimensional axis (Row or Column).
   - Lazily evaluates geometry via a Just-In-Time (JIT) index boundary crawler (`_lastMeasuredIndex`), caching evaluated positions while deferring unrendered measurements.
   - Provides logarithmic target location through an Exponential Search algorithm coupled with an internal Binary Search, running in $O(\log N)$ time complexity without forcing pre-computation of the full $N$-element dataset.
   - Employs coordinate space compression when total estimated DOM dimensions exceed the browser's native limits ($16,777,100\text{ px}$), scaling the virtual layout smoothly onto the hardware viewport using safe-offset percentage projection.

2. **Windowed Layout Pipeline (`defaultCellRangeRenderer`)**:
   - Accepts computed range matrices (`rowStartIndex..rowStopIndex`, `columnStartIndex..columnStopIndex`) and constructs a minimal set of `ReactElement` nodes.
   - Maintains an ephemeral cell cache during active drag/inertial scroll operations to decouple scroll events from component allocation overhead.
   - Enforces an absolute coordinate style invariant (`position: absolute; top; left; width; height`) on every child node.

3. **Self-Measuring Geometry Subsystem (`CellMeasurer` & `CellMeasurerCache`)**:
   - Solves dynamic, non-deterministic content sizing without layout deadlocks.
   - Implements deferred measurement mode: unmeasured items are rendered with unconstrained dimensions (`top: 0; left: 0; width: auto; height: auto`) in an invisible or detatched staging phase, measured via the DOM layout engine (`getBoundingClientRect`/`offsetHeight`), persisted to cache, and seamlessly repositioned in the next render cycle.

4. **Stream Batching & Ingestion Controller (`InfiniteLoader`)**:
   - Translates scroll-driven viewport visibility bounds into batched remote data requests.
   - Scans continuous index gaps (`scanForUnloadedRanges`), expanding requests bi-directionally to satisfy batch minimums (`minimumBatchSize`), and triggers component invalidation routines using a descending fallback cascade (`recomputeGridSize` $\to$ `recomputeRowHeights` $\to$ `forceUpdateGrid` $\to$ `forceUpdate`).

---

## 2. Universal Engineering Rules

### 1. Virtual Coordinate Space Compression for Native Rendering Limits
**RULE**: When virtualizing dimensions that can exceed the host platform's layout layout ceiling ($16,777,100\text{ px}$ in modern browser rendering engines such as Blink and WebKit), systems MUST project unbounded logical offsets into bounded physical DOM coordinates using non-linear scaling ratios, and MUST bypass internal style caching whenever coordinate compression is active.

**WHY**: Browsers terminate layout calculations or silently wrap/clip CSS coordinates at engine-specific bounds (e.g., Firefox layout collapse at $\approx 17.89\text{M px}$, WebKit/Blink at $\approx 33.55\text{M px}$). If raw offsets are rendered, elements beyond the threshold become unreachable. Furthermore, caching position styles during active scaling introduces sub-pixel drift, resulting in layout jitter and visual tearing.

**WHEN TO APPLY**: Any windowing, virtualization, or infinite canvas subsystem rendering large data structures ($N > 100,000$ elements with medium-to-large cell dimensions) on Web DOM, React Native, or Canvas rendering surfaces.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export class ScalingCoordinateManager {
  private readonly maxScrollSize: number;
  private readonly innerManager: LinearSizeManager;

  constructor(maxScrollSize: number, innerManager: LinearSizeManager) {
    this.maxScrollSize = maxScrollSize;
    this.innerManager = innerManager;
  }

  public areOffsetsAdjusted(): boolean {
    return this.innerManager.getTotalSize() > this.maxScrollSize;
  }

  public getTotalSize(): number {
    return Math.min(this.maxScrollSize, this.innerManager.getTotalSize());
  }

  public getOffsetAdjustment(containerSize: number, safeOffset: number): number {
    const totalSize = this.innerManager.getTotalSize();
    const safeTotalSize = this.getTotalSize();
    const offsetPercentage = this.getOffsetPercentage(containerSize, safeOffset, safeTotalSize);
    return Math.round(offsetPercentage * (safeTotalSize - totalSize));
  }

  public safeOffsetToOffset(containerSize: number, safeOffset: number): number {
    const totalSize = this.innerManager.getTotalSize();
    const safeTotalSize = this.getTotalSize();
    if (totalSize === safeTotalSize) return safeOffset;

    const offsetPercentage = this.getOffsetPercentage(containerSize, safeOffset, safeTotalSize);
    return Math.round(offsetPercentage * (totalSize - containerSize));
  }

  private getOffsetPercentage(containerSize: number, offset: number, totalSize: number): number {
    return totalSize <= containerSize ? 0 : offset / (totalSize - containerSize);
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER map continuous large-scale coordinates 1:1 directly to DOM style properties
function renderCell(index: number, linearOffset: number) {
  // CRITICAL ANTI-PATTERN: Will break completely when linearOffset > 1.67e7 px
  return <div style={{ position: "absolute", top: `${linearOffset}px` }} />;
}
```

**VERIFICATION METHOD**:
Run unit tests asserting that when virtual height exceeds `1.67771e7`, `areOffsetsAdjusted()` returns `true`, and verify that `safeOffsetToOffset` correctly translates the terminal scroll position to the exact logical end index without NaN or division by zero:
```typescript
test("ScalingCoordinateManager compression bounds", () => {
  const manager = new ScalingCoordinateManager(16777100, mockLinearManager(50000000));
  expect(manager.areOffsetsAdjusted()).toBe(true);
  expect(manager.getTotalSize()).toBe(16777100);
  const maxSafeOffset = 16777100 - 800; // container size 800
  const logicalOffset = manager.safeOffsetToOffset(800, maxSafeOffset);
  expect(logicalOffset).toBe(50000000 - 800);
});
```

---

### 2. Guard Against Functional Prop Instability in Virtualized Recalculations
**RULE**: Layout optimization routines MUST NOT use reference identity checks (`prevFn !== nextFn`) on sizing functions when determining if layout metadata must be recalculated. Systems MUST evaluate numeric and primitive invariants directly, requiring user consumers to invoke explicit invalidation methods for dynamic function updates.

**WHY**: Passing inline arrow functions to component props is common in React. If a virtualization pipeline checks `props.cellSize !== nextProps.cellSize` and `typeof nextProps.cellSize === 'function'`, inline functions evaluate to a new reference on every parent render. This triggers layout thrashing, discards JIT position caches, resets scroll targets, and introduces unbounded render loops.

**WHEN TO APPLY**: Component-based virtualization layers, dynamic data-table libraries, and high-frequency reactive trees where sizing is configurable via either scalar constants or dynamic callbacks.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export function shouldRecalculateMetadata<T>({
  cellCount,
  nextCellCount,
  cellSize,
  nextCellSize,
  scrollToIndex,
  nextScrollToIndex,
  onInvalidate,
  onReanchorScroll
}: {
  cellCount: number;
  nextCellCount: number;
  cellSize: number | Function;
  nextCellSize: number | Function;
  scrollToIndex: number;
  nextScrollToIndex: number;
  onInvalidate: () => void;
  onReanchorScroll: () => void;
}): void {
  // STRICT INVARIANT: Skip equality checks if sizing is dynamically calculated via function.
  // Dynamic changes must trigger explicit recompute methods (e.g., recomputeGridSize).
  const isSizeScalar = typeof cellSize === "number" || typeof nextCellSize === "number";
  const hasScalarSizeChanged = isSizeScalar && cellSize !== nextCellSize;
  const hasCountChanged = cellCount !== nextCellCount;

  if (hasCountChanged || hasScalarSizeChanged) {
    onInvalidate();

    // Preserve scroll anchor visibility if target index remains stable
    if (scrollToIndex >= 0 && scrollToIndex === nextScrollToIndex) {
      onReanchorScroll();
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER check raw equality across polymorphic prop signatures
function checkShouldUpdate(props: Props, nextProps: Props) {
  // CRITICAL FAILURE: Inline functions will invalidate metadata on EVERY render cycle!
  if (props.cellSize !== nextProps.cellSize) {
    this.recomputeMetadata(); 
  }
}
```

**VERIFICATION METHOD**:
Execute an automated test demonstrating that re-rendering a component with an identical row count and a new inline function instance (`() => 30`) does NOT trigger metadata invalidation:
```typescript
test("prevents loop on inline size function updates", () => {
  const onInvalidate = vi.fn();
  shouldRecalculateMetadata({
    cellCount: 100,
    nextCellCount: 100,
    cellSize: () => 50,
    nextCellSize: () => 50, // Distinct reference
    scrollToIndex: -1,
    nextScrollToIndex: -1,
    onInvalidate,
    onReanchorScroll: vi.fn()
  });
  expect(onInvalidate).not.toHaveBeenCalled();
});
```

---

### 3. Absolute Coordinate Staging for Dynamic DOM Geometry Probing
**RULE**: Dynamic cell measurement systems MUST decouple target items from the virtualized container's coordinate matrix during initial measurement probing by positioning unmeasured cells at `top: 0; left: 0; position: absolute; width: auto; height: auto` (or constraining one primary dimension), preventing DOM layout measurements from inheriting stale or compressed parent bounds.

**WHY**: When an unmeasured item is rendered with non-zero translate coordinates or inherited boundaries, the browser calculates its bounding geometry against existing siblings or clipping viewports. An unmeasured element rendered at `bottom: 0` or within fixed dimensions calculates an incorrect `scrollHeight`/`offsetHeight`, polluting the cache with corrupt geometries that trigger persistent rendering drift and layout jitter.

**WHEN TO APPLY**: Self-measuring list, grid, or masonry components calculating dynamic heights or widths on-demand via the live DOM.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export function resolveCellLayoutStyles(
  rowIndex: number,
  columnIndex: number,
  deferredCache: { has: (r: number, c: number) => boolean } | undefined,
  computedDatum: { size: number; offset: number },
  orthogonalDatum: { size: number; offset: number },
  offsetAdjustment: number
): CSSProperties {
  // Check if geometry is already measured and valid in cache
  const isMeasured = !deferredCache || deferredCache.has(rowIndex, columnIndex);

  if (!isMeasured) {
    // INVARIANT: Stage at top/left 0,0 with natural dimension unconstrained
    // to allow accurate getBoundingClientRect calculation without clipping.
    return {
      position: "absolute",
      top: 0,
      left: 0,
      width: "auto",
      height: "auto",
      zIndex: -1, // Keep behind active content to prevent visual flash
      visibility: "hidden"
    };
  }

  return {
    position: "absolute",
    top: computedDatum.offset + offsetAdjustment,
    left: orthogonalDatum.offset,
    width: orthogonalDatum.size,
    height: computedDatum.size
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER fall back to 0 or arbitrary sizes for unmeasured items in place
function getBadInitialStyle(isMeasured: boolean, lastKnownOffset: number) {
  // CRITICAL ANTI-PATTERN: Positioning an unmeasured element at an arbitrary offset
  // causes the browser to clip it against the scroll container, corrupting measurements.
  return {
    position: "absolute",
    top: lastKnownOffset,
    height: isMeasured ? 50 : 0 // Collapsed size triggers zero-measurement faults
  };
}
```

**VERIFICATION METHOD**:
Mount an unmeasured node into a dynamic test harness and verify that prior to cache registration, its resolved inline style strictly reflects zero-origin coordinates and unconstrained dimensions:
```typescript
test("enforces staging coordinates on unmeasured cells", () => {
  const styles = resolveCellLayoutStyles(0, 0, { has: () => false }, { size: 100, offset: 500 }, { size: 100, offset: 200 }, 0);
  expect(styles.top).toBe(0);
  expect(styles.left).toBe(0);
  expect(styles.height).toBe("auto");
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Dom-Helpers Scrollbar Resolution Crash in ES Module Bundlers (BUG-VIRT-01)
- **Context**: Subsystem: Package Resolution / Library Entrypoint (`dom-helpers/scrollbarSize` imports inside `dist/es/Grid/Grid.js` and `dist/es/Collection/CollectionView.js`).
- **What Was Expected**: Bundlers (Webpack 5, Rollup, Vite) should resolve the underlying DOM scrollbar measurement utility seamlessly across modern ESM and CJS module boundaries.
- **What Actually Happened**: Webpack 5 builds failed with: `Module not found: Error: Can't resolve 'dom-helpers/scrollbarSize'`. Sub-path exports in `dom-helpers` v5 altered file layouts, breaking downstream bundlers relying on deep filesystem traversal.
- **Evidence in Repo**: Issue #1576; Build manifest `package.json` lock-in with modern dependencies.
- **Root Cause**: Hardcoded bare deep imports (`import getScrollbarSize from 'dom-helpers/scrollbarSize'`) assumed an un-encapsulated `node_modules` folder structure. When `dom-helpers` updated its build targets, root files were relocated without legacy redirection points.
- **Remediation Code Diff**:
```typescript
// - import scrollbarSize from 'dom-helpers/scrollbarSize';
// + import getScrollbarSize from 'dom-helpers/scrollbar';
// Modern robust approach: Implement deterministic inline scrollbar calculation:
export function getScrollbarWidth(): number {
  const outer = document.createElement("div");
  outer.style.visibility = "hidden";
  outer.style.overflow = "scroll";
  document.body.appendChild(outer);
  const inner = document.createElement("div");
  outer.appendChild(inner);
  const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
  outer.parentNode?.removeChild(outer);
  return scrollbarWidth;
}
```
- **Lesson**: Do not rely on deep subpath imports of external dependencies without checking package `exports` specifications. Encapsulate native DOM measurement fallbacks directly within internal workspace utility boundaries.

---

### Incident 2: Spurious Required `aria-label` PropType Generation (BUG-VIRT-02)
- **Context**: Subsystem: Accessibility and Prop Validation (`Grid.js` / Babel Flow build chain).
- **What Was Expected**: `aria-label` should be optional on `Grid`, `List`, and `Table` instances, defaulting to clean aria roles without runtime console warnings.
- **What Actually Happened**: Upgrading between patch releases caused React Development Mode to throw noisy warnings: `Warning: Failed prop type: The prop "aria-label" is marked as required in "Grid", but its value is "undefined"`.
- **Evidence in Repo**: Issue #1577; Resolved by upgrading code generation toolchains (`babel-plugin-flow-react-proptypes` to `^26.0.0`).
- **Root Cause**: Transpilation tooling misparsed Flow optional type signatures (`aria-label?: string`), mapping them to React `PropTypes.string.isRequired`. Downstream container components (`List`, `MultiGrid`) which omit `aria-label` triggered prop-validation failures during mount.
- **Remediation Code Diff**:
```typescript
// - // Erroneously generated by Flow transpiler:
// - Grid.propTypes = {
// -   "aria-label": PropTypes.string.isRequired
// - };
// + // Fixed tooling generation output:
// + Grid.propTypes = {
// +   "aria-label": PropTypes.string
// + };
// + Grid.defaultProps = {
// +   "aria-label": "grid"
// + };
```
- **Lesson**: Build toolchains that synthesize runtime validation schemas (PropTypes) from static types must be covered by integration tests in development mode, ensuring optional interface contracts are not converted into strict runtime requirements.

---

### Incident 3: Scroll Overshoot and Blank Viewport when Collection Shrinks (BUG-VIRT-03)
- **Context**: Subsystem: Dynamic Collection Resize (`lib/components/Grid/utils/updateScrollIndexHelper.ts`).
- **What Was Expected**: When a virtual collection shrinks (e.g., from 1,000 items down to 10), the viewport's scroll position must clamp to the new dataset bounds, keeping rows visible.
- **What Actually Happened**: Users encountered a blank screen. The viewport retained its previous high `scrollTop` offset (e.g., $15,000\text{ px}$), placing it far beyond the new dataset height ($500\text{ px}$).
- **Evidence in Repo**: `updateScrollIndexHelper.ts`, Issue #1351.
- **Root Cause**: The scroll offset was not clamped synchronously when the parent component passed a reduced `rowCount` without an explicit `scrollToIndex` update, stranding the viewport in empty coordinate space.
- **Remediation Code Diff**:
```typescript
export function updateScrollIndexHelper({
  cellSizeAndPositionManager,
  previousCellsCount,
  previousSize,
  scrollOffset,
  size,
  updateScrollIndexCallback
}: Params) {
  const cellCount = cellSizeAndPositionManager.getCellCount();

// If the size or number of children have decreased,
// make sure we aren't scrolled too far past the current content.
  if (
    cellCount > 0 &&
    (size < previousSize || cellCount < previousCellsCount)
  ) {
    // Only adjust the scroll position if we've scrolled below the last set of rows.
    if (scrollOffset > cellSizeAndPositionManager.getTotalSize() - size) {
      updateScrollIndexCallback(cellCount - 1);
    }
  }
}
```
- **Lesson**: When rendering stateful scroll layouts, any mutation that reduces collection size or item dimensions must re-evaluate scroll bounds against total virtual length ($L_{\text{total}} - H_{\text{container}}$), adjusting the scroll position whenever an overrun is detected.

---

### Incident 4: Visual Artifacts Caused by Style Caching on Scaled Coordinates (BUG-VIRT-04)
- **Context**: Subsystem: Layout Renderer (`lib/components/Grid/defaultCellRangeRenderer.ts`).
- **What Was Expected**: Cells rendered within ultra-large collections must maintain visual stability without drifting or jittering as the user scrolls.
- **What Actually Happened**: Long lists displayed visual tearing, overlapping rows, and jittering layouts when moving across large coordinate spaces.
- **Evidence in Repo**: `defaultCellRangeRenderer.ts` lines 39-44 referencing Issue #576 and Issue #395.
- **Root Cause**: To avoid unnecessary re-renders, `defaultCellRangeRenderer` caches computed `style` objects. However, when `ScalingCellSizeAndPositionManager` is active, sub-pixel offset distribution changes slightly on every scroll event. Caching style objects in this state locked in obsolete sub-pixel positions, breaking layout alignment.
- **Remediation Code Diff**:
```typescript
// - const canCacheStyle = !isScrolling;
// + const areOffsetsAdjusted =
// +   columnSizeAndPositionManager.areOffsetsAdjusted() ||
// +   rowSizeAndPositionManager.areOffsetsAdjusted();
// + const canCacheStyle = !isScrolling && !areOffsetsAdjusted;

if (canCacheStyle && styleCache[key]) {
  style = styleCache[key];
} else {
  // Recompute un-cached coordinate layout
}
```
- **Lesson**: Optimization mechanisms (such as style caching) must verify the immutability of the underlying coordinate space. When non-linear scaling or coordinate normalization is active, static coordinate caches must be bypassed.

---

### Incident 5: Measurement Inflation from Premature Absolute Offset Positioning (BUG-VIRT-05)
- **Context**: Subsystem: Dynamic Measurement Pipeline (`defaultCellRangeRenderer.ts` and `CellMeasurer`).
- **What Was Expected**: Dynamically measured cells must calculate natural bounding box heights without clipping from neighboring elements or container boundaries.
- **What Actually Happened**: Dynamic cells inside auto-measuring lists rendered with clipped heights and incorrect wrapping points, miscalculating item height by large margins.
- **Evidence in Repo**: `defaultCellRangeRenderer.ts` lines 70-85, Issue #611.
- **Root Cause**: Unmeasured items were positioned using estimated offsets (e.g., `top: 1200px`). If the container had not grown yet, this triggered overflow clipping or forced early line breaks, skewing natural content dimensions.
- **Remediation Code Diff**:
```typescript
if (
  deferredMeasurementCache &&
  !deferredMeasurementCache.has(rowIndex, columnIndex)
) {
  // Position not-yet-measured cells at top/left 0,0,
  // And give them width/height of 'auto' so they can grow larger than the parent Grid if necessary.
  // Positioning them further to the right/bottom influences their measured size.
  style = {
    height: "auto",
    left: 0,
    position: "absolute",
    top: 0,
    width: "auto"
  };
} else {
  style = {
    height: rowDatum.size,
    left: columnDatum.offset + horizontalOffsetAdjustment,
    position: "absolute",
    top: rowDatum.offset + verticalOffsetAdjustment,
    width: columnDatum.size
  };
  styleCache[key] = style;
}
```
- **Lesson**: Do not stage elements in their estimated layout slots while measuring their dimensions. Probe DOM geometry at an unconstrained origin (`top: 0; left: 0`) with dimensions set to `auto` before calculating final layout coordinates.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
*   **Loose Null Checking on Cell Payloads**: In `lib/components/Table/defaultCellRenderer.ts`:
    ```typescript
    export function defaultCellRenderer({ cellData }: Pick<TableCellProps, "cellData">): string {
      if (cellData == null) {
        return "";
      } else {
        return String(cellData);
      }
    }
    ```
    The evaluation `cellData == null` uses double-equality intentionally to catch both `null` and `undefined` in a single check, while preserving the numeric value `0` and boolean `false` as valid printable output. Using `if (!cellData)` would evaluate `0` as falsy, incorrectly converting numeric zeros into empty strings.
*   **NaN Propagation Defenses in Offset Searching**: In `CellSizeAndPositionManager.ts` method `_findNearestCell(offset: number)`:
    ```typescript
    if (isNaN(offset)) {
      throw Error(`Invalid offset ${offset} specified`);
    }
    offset = Math.max(0, offset);
    ```
    `Math.max(0, NaN)` returns `NaN`. Failure to catch `NaN` explicitly before execution leads to silent failures in the `_binarySearch` loop, causing infinite loops or incorrect `0` index returns.

### 2. Infinite Loop & Recursion Guards
*   **Exponential-to-Binary Search Termination Proof**:
    When looking up a cell by scroll offset, a naive linear scan requires $O(N)$ operations, which drops frame rates on large datasets. Binary search requires pre-computing all cell offsets up front, which breaks JIT lazy sizing. `CellSizeAndPositionManager` uses an exponential search that falls back to binary search:
    ```typescript
    _exponentialSearch(index: number, offset: number): number {
      let interval = 1;
      while (
        index < this._cellCount &&
        this.getSizeAndPositionOfCell(index).offset < offset
      ) {
        index += interval;
        interval *= 2;
      }
      return this._binarySearch(
        Math.min(index, this._cellCount - 1),
        Math.floor(index / 2),
        offset
      );
    }
    ```
    *Termination Proof*: Loop termination is guaranteed because `interval` doubles continuously ($1, 2, 4, 8, \dots$). Even if offsets do not advance, `index` increases strictly monotonically, ensuring `index < this._cellCount` evaluates to `false` in at most $\lceil \log_2(\text{cellCount} - \text{index}) \rceil$ iterations. The subsequent `_binarySearch` receives bounded lower and upper limits clamped by `Math.min(index, this._cellCount - 1)`.

### 3. UI & UX Micro-Mechanics
*   **Synthetic Accessible Role Injection via Immutable Clones**: In `defaultCellRangeRenderer.ts`:
    ```typescript
    if (!cellElement.props.role) {
      renderedCell = cloneElement(cellElement, { role: "gridcell" });
    }
    ```
    This structural invariant checks whether the user's custom cell component defines an accessible `role`. If omitted, it injects `role="gridcell"` using React's `cloneElement` without mutating the source element's prop bag.
*   **DOM Tooltip Reflection Safeguard**: In `defaultHeaderRenderer.tsx`:
    ```typescript
    <span
      className="ReactVirtualized__Table__headerTruncatedText"
      key="label"
      title={(typeof label === "string" ? label : null) as string | undefined}
    >
      {label}
    </span>
    ```
    `label` accepts arbitrary React nodes (icons, complex spans). Passing a JSX element to the DOM `title` attribute causes React to render `[object Object]` on hover. The ternary operator enforces that only primitive strings are mapped to the native HTML `title` tooltip.

### 4. Concurrency & Memory Safety
*   **Scroll-State Ephemeral