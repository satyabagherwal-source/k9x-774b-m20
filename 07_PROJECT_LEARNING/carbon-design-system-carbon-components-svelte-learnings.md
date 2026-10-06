# Forensic Learning Record (Deep Inspection): carbon-design-system/carbon-components-svelte

> **Canonical Artifact**: `07_PROJECT_LEARNING/carbon-design-system-carbon-components-svelte-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/carbon-design-system/carbon-components-svelte](https://github.com/carbon-design-system/carbon-components-svelte))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:19:30.775Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `carbon-design-system/carbon-components-svelte`
- **Description**: Svelte implementation of the Carbon Design System
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2913 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bench/treeCheckboxState.bench.ts`
```
// Pure-logic benchmark: no jsdom, no Svelte, run directly via bun (`bunx ostia bench bench/<this file>.bench.ts`, optionally filtered — see CONTRIBUTING.md).
// resolveCheckboxState walks the whole tree on every checkedIds change (see its
// docstring), so it's the hottest path for a large TreeView with checkboxes.
import { group, range, task } from "ostia";
import {
  resolveCheckboxState,
  toggleCheckboxNode,
} from "../src/utils/tree-checkbox-state.js";

type Node = {
  id: number;
  nodes?: Node[];
};

// Single-root, branching-factor-4 tree with `totalNodes` nodes total —
// roughly the shape of a deep file-tree explorer.
function buildTree(totalNodes: number, branching = 4): Node[] {
  let created = 0;

  function makeNode(): Node {
    created += 1;
    return { id: created, nodes: [] };
  }

  const root = makeNode();
  const queue: Node[] = [root];

  while (created < totalNodes && queue.length > 0) {
    const parent = queue.shift();
    if (!parent) break;
    for (let i = 0; i < branching && created < totalNodes; i++) {
      const child = makeNode();
      parent.nodes?.push(child);
      queue.push(child);
    }
  }

  return [root];
}

// ~1/3 of nodes checked, spread through the tree so resolve exercises a mix
// of fully-checked, indeterminate, and unchecked branches.
function pickCheckedIds(totalNodes: number): number[] {
  const ids: number[] = [];
  for (let id = 1; id <= totalNodes; id++) {
    if (id % 3 === 0) ids.push(id);
  }
  return ids;
}

group("resolveCheckboxState (cascade)", () => {
  for (const size of range(100, 10_000)) {
    const nodes = buildTree(size);
    const checkedIds = pickCheckedIds(size);
    task(`${size} nodes`, () => resolveCheckboxState(nodes, checkedIds));
  }
});

group("resolveCheckboxState (no cascade)", () => {
  for (const size of range(100, 10_000)) {
    const nodes = buildTree(size);
    const checkedIds = pickCheckedIds(size);
    task(`${size} nodes`, () =>
      resolveCheckboxState(nodes, checkedIds, { cascade: false }),
    );
  }
});

group("toggleCheckboxNode (cascade check)", () => {
  for (const size of range(100, 10_000)) {
    const nodes = buildTree(size);
    const checkedIds = pickCheckedIds(size);
    const targetId = Math.floor(size / 2);
    task(`${size} nodes`, () =>
      toggleCheckboxNode(nodes, checkedIds, targetId, true),
    );
  }
});

// Unchecking walks the target's subtree plus every ancestor (a different
// code path than checking — see toggleCheckboxNode's docstring), so it gets
// its own case rather than assuming symmetric cost with the check above.
group("toggleCheckboxNode (cascade uncheck)", () => {
  for (const size of range(100, 10_000)) {
    const nodes = buildTree(size);
    const checkedIds = pickCheckedIds(size);
    const targetId = Math.floor(size / 2);
    task(`${size} nodes`, () =>
      toggleCheckboxNode(nodes, checkedIds, targetId, false),
    );
  }
});

// Every case above uses a bushy tree (branching=4). walk/findPath/cascadableIds/
// subtreeIds are all recursive, so cost could in principle track *depth* rather
// than node count — a shape the bushy tree never stresses. These two shapes
// isolate that: a chain (branching=1, depth == node count) and a flat tree
// (branching == node count, depth 2). Confirmed safe to 20k depth with no
// stack overflow (see stack-check probe) before picking this range.
group("resolveCheckboxState (cascade) — deep/narrow (chain)", () => {
  for (const size of range(100, 10_000)) {
    const nodes = buildTree(size, 1);
    const checkedIds = pickCheckedIds(size);
    task(`${size} nodes`, () => resolveCheckboxState(nodes, checkedIds));
  }
});

group("resolveCheckboxState (cascade) — wide/shallow (flat)", () => {
  for (const size of range(100, 10_000)) {
    const nodes = buildTree(size, size);
    const checkedIds = pickCheckedIds(size);
    task(`${size} nodes`, () => resolveCheckboxState(nodes, checkedIds));
  }
});

// findPath walks root-to-target, so a chain forces it to scan the full depth
// to reach a mid-chain target — the shape most likely to expose a cost
// difference from the bushy case's shallow findPath.
group("toggleCheckboxNode (cascade check) — deep/narrow (chain)", () => {
  for (const size of range(100, 10_000)) {
    const nodes = buildTree(size, 1);
    const checkedIds = pickCheckedIds(size);
    const targetId = Math.floor(size / 2);
    task(`${size} nodes`, () =>
      toggleCheckboxNode(nodes, checkedIds, targetId, true),
    );
  }
});

```

### Core Architecture Module: `e2e/fixtures/notification-queue.ts`
```
import { mount } from "./mount";
import NotificationQueueFixture from "./NotificationQueueFixture.svelte";

mount(NotificationQueueFixture);

```

### Core Architecture Module: `src/DataTable/data-table-utils.d.ts`
```
/**
 * Lightweight deep equality check optimized for DataTable rows.
 * Compares arrays of row objects by first checking IDs (fast path),
 * then falling back to deep object comparison to handle nested structures.
 */
export function rowsEqual<T>(
  a: ReadonlyArray<T> | null,
  b: ReadonlyArray<T> | null,
): boolean;

/**
 * Returns true if the element's class list indicates the click target
 * is an overflow menu, checkbox, or radio button (row click should be ignored).
 */
export function shouldIgnoreRowClick(target: EventTarget | null): boolean;

/**
 * Resolves a nested property path in an object.
 * Supports both direct property access and nested paths like "contact.company".
 */
export function resolvePath<T extends Record<string, unknown>>(
  object: T,
  path: string,
): unknown;

/**
 * Paginates an array of rows based on page number and page size.
 */
export function getDisplayedRows<Row extends Record<string, unknown>>(
  rows: ReadonlyArray<Row>,
  page: number,
  pageSize: number,
): ReadonlyArray<Row>;

/**
 * Formats header width styles for table headers.
 * Combines width and minWidth into a CSS style string.
 */
export function formatHeaderWidth<
  Header extends {
    width?: string | null | number;
    minWidth?: string | null | number;
    [key: string]: unknown;
  } = {
    width?: string | null | number;
    minWidth?: string | null | number;
    [key: string]: unknown;
  },
>(header: Header): string | undefined;

/**
 * Compares two values for sorting in a data table.
 * Handles numbers, strings, null/undefined values, and custom sort functions.
 * @returns {number} Negative if a < b (ascending) or a > b (descending), positive if a > b (ascending) or a < b (descending), 0 if equal
 */
export function compareValues<T = unknown>(
  itemA: T,
  itemB: T,
  ascending: boolean,
  customSort?: ((a: T, b: T) => number) | false | undefined,
): number;

export type ToCsvHeader<Row> = {
  /** Column key. Supports nested paths like `"contact.company"`. */
  key: string;
  /** Column label written to the header row. Falls back to `key`. */
  value?: unknown;
  /** Whether the column renders no data. Empty columns are skipped. */
  empty?: boolean;
  /** Whether the column is hidden. Hidden columns are skipped. */
  columnHidden?: boolean;
  /** Formats the cell value, matching the rendered table. */
  display?: (item: unknown, row: Row) => unknown;
};

export type ToCsvOptions = {
  /**
   * Field delimiter. Set to `"\t"` for TSV or `";"` for locales where
   * Excel expects it.
   * @default ","
   */
  delimiter?: string;
  /**
   * Emit the header row.
   * @default true
   */
  includeHeaders?: boolean;
  /**
   * Prefix a field starting with `=`, `+`, `-`, `@`, tab, or carriage return
   * with a single quote so spreadsheets do not evaluate it as a formula.
   * @default true
   */
  escapeFormulas?: boolean;
  /**
   * Line ending. RFC 4180 specifies `"\r\n"`, which is what Excel expects.
   * @default "\r\n"
   */
  newline?: string;
};

/**
 * Serializes data table headers and rows to a CSV string.
 * Skips empty and hidden columns, resolves nested keys, and applies `display`
 * formatting so the export matches the rendered table.
 */
export function toCsv<Row extends Record<string, unknown>>(
  headers: ReadonlyArray<ToCsvHeader<Row>>,
  rows: ReadonlyArray<Row>,
  options?: ToCsvOptions,
): string;

type PathDepth = [never, 0, 1, 2, ...0[]];

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${"" extends P ? "" : "."}${P}`
    : never
  : never;

/**
 * Drops string/number index signatures so `keyof` is only declared keys.
 * Used for paths on `DataTableRow` and subtypes, whose index signature would
 * otherwise widen `PropertyPath` to plain `string`.
 */
export type KeysWithoutIndexSignature<T> = {
  [K in keyof T as string extends K
    ? never
    : number extends K
      ? never
      : K]: T[K];
};

// For performance, the maximum traversal depth is 3.
export type PropertyPath<T, D extends number = 3> = [D] extends [never]
  ? never
  : T extends object
    ? {
        [K in keyof T]-?: K extends string | number
          ? `${K}` | Join<K, PropertyPath<T[K], PathDepth[D]>>
          : never;
      }[keyof T]
    : "";

/**
 * Like {@link PropertyPath}, but ignores string/number index signatures at
 * each object level so declared keys stay as literal unions (for `DataTableRow` subtypes).
 */
export type PropertyPathIgnoringIndexSignatures<T, D extends number = 3> = [
  D,
] extends [never]
  ? never
  : T extends object
    ? {
        [K in keyof KeysWithoutIndexSignature<T>]-?: K extends string | number
          ?
              | `${K}`
              | Join<
                  K,
                  PropertyPathIgnoringIndexSignatures<
                    KeysWithoutIndexSignature<T>[K],
                    PathDepth[D]
                  >
                >
          : never;
      }[keyof KeysWithoutIndexSignature<T>]
    : "";

/**
 * Cell value type at a column path (e.g. `"port"` or `"contact.company"`).
 */
export type DataTableValueAtPath<Row, Path extends string> = Row extends object
  ? Path extends keyof Row & string
    ? Row[Path]
    : Path extends `${infer Head}.${infer Rest}`
      ? Head extends keyof Row
        ? DataTableValueAtPath<NonNullable<Row[Head]>, Rest>
        : unknown
      : unknown
  : unknown;

/**
 * Union of cell value types for all column paths on `Row`.
 * Used for default and per-column `sort` comparators.
 *
 * `Row` is unconstrained so generated `DataTableSortValue<Row = DataTableRow>` aliases stay valid;
 * non-object `Row` resolves to `never`.
 */
export type DataTableSortValue<Row> = Row extends object
  ? PropertyPath<Row> extends infer K
    ? K extends string
      ? DataTableValueAtPath<Row, K>
      : never
    : never
  : never;

```

### Core Architecture Module: `src/DataTable/data-table-utils.js`
```
// @ts-check
import { BoundedFifoCache } from "../utils/bounded-fifo-cache.js";
import { deepEqual } from "../utils/deep-equal.js";

/**
 * Lightweight deep equality check optimized for DataTable rows.
 * Compares arrays of row objects by first checking IDs (fast path),
 * then falling back to deep object comparison to handle nested structures.
 * @template T
 * @param {ReadonlyArray<T> | null} a - First array of rows to compare
 * @param {ReadonlyArray<T> | null} b - Second array of rows to compare
 * @returns {boolean} True if row arrays are deeply equal, false otherwise
 */
export function rowsEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;

  if (a.length !== b.length) return false;

  // Fast path: compare by row IDs first, assuming rows have stable IDs.
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.id !== b[i]?.id) return false;
  }

  // If IDs match, do deep comparison of row objects
  // This catches cases where row data changed but ID stayed the same,
  // including changes in nested objects (e.g., "contact.company")
  for (let i = 0; i < a.length; i++) {
    const rowA = a[i];
    const rowB = b[i];

    // Fast path: same reference
    if (rowA === rowB) continue;

    // Deep comparison to handle nested objects and arrays
    if (!deepEqual(rowA, rowB)) return false;
  }

  return true;
}

const RE_IGNORE_ROW_CLICK = /^bx--(overflow-menu|checkbox|radio-button)/;

/**
 * Returns true if the element's class list indicates the click target
 * is an overflow menu, checkbox, or radio button (row click should be ignored).
 * @param {EventTarget | null} target - The event target (e.g., from a click event)
 * @returns {boolean}
 */
export function shouldIgnoreRowClick(target) {
  if (!target || !("classList" in target)) return false;
  const element = /** @type {HTMLElement} */ (target);
  return [...element.classList].some((name) => RE_IGNORE_ROW_CLICK.test(name));
}

const PATH_SPLIT_REGEX = /[.[\]'"]/;
const MAX_PATH_CACHE_SIZE = 1000;
/** @type {BoundedFifoCache<string, string[]>} */
const pathCache = new BoundedFifoCache(MAX_PATH_CACHE_SIZE);

/**
 * Resolves a nested property path in an object.
 * Supports both direct property access and nested paths like "contact.company".
 * @template {Record<string, unknown>} T
 * @param {T} object - The object to resolve the path from
 * @param {string} path - The property path (e.g., "name" or "contact.company")
 * @returns {unknown} The resolved value, or undefined if the path doesn't exist
 */
export function resolvePath(object, path) {
  if (path in object) return object[path];

  let segments = pathCache.get(path);
  if (!segments) {
    segments = path.split(PATH_SPLIT_REGEX).filter((p) => p);
    if (segments.length > 1) {
      pathCache.set(path, segments);
    }
  }

  return (segments ?? []).reduce(
    /**
     * @param {unknown} acc
     * @param {string} p
     * @returns {unknown}
     */
    (acc, p) =>
      acc && typeof acc === "object"
        ? /** @type {Record<string, unknown>} */ (acc)[p]
        : acc,
    object,
  );
}

/**
 * Paginates an array of rows based on page number and page size.
 * @template {Record<string, unknown>} Row
 * @param {ReadonlyArray<Row>} rows - The rows to paginate
 * @param {number} page - The current page number (1-indexed)
 * @param {number} pageSize - The number of items per page
 * @returns {ReadonlyArray<Row>} The paginated rows, or all rows if pagination is disabled
 */
export function getDisplayedRows(rows, page, pageSize) {
  if (page && pageSize) {
    return rows.slice((page - 1) * pageSize, page * pageSize);
  }
  return rows;
}

/**
 * Formats header width styles for table headers.
 * Combines width and minWidth into a CSS style string.
 * @template {object} Header
 * @param {Header & { width?: string | null | number; minWidth?: string | null | number; [key: string]: unknown }} header - The header object
 * @returns {string | undefined} The formatted style string, or undefined if no width styles
 */
export function formatHeaderWidth(header) {
  const styles = [
    header.width && `width: ${header.width}`,
    header.minWidth && `min-width: ${header.minWidth}`,
  ].filter(Boolean);
  if (styles.length === 0) return undefined;
  return styles.join(";");
}

// Cached collator for compareValues' string fast path. localeCompare(str,
// locale, options) rebuilds the full ICU collator on every call when an
// options object is passed — reusing one Intl.Collator's .compare() instead
// is ~30x faster at scale. Locale is undefined so it defaults to the user's
// locale, matching localeCompare's prior behavior.
const collator = new Intl.Collator(undefined, {
  // Enable numeric sorting for strings that look like numbers
  // E.g., "10" should come after "2"
  numeric: true,
  // Comparison is case- and accent-insensitive
  // E.g., "apple" == "Apple", "café" == "cafe"
  sensitivity: "base",
});

/**
 * Compares two values for sorting in a data table.
 * Handles numbers, strings, null/undefined values, and custom sort functions.
 * @template T
 * @param {T} itemA - First value to compare
 * @param {T} itemB - Second value to compare
 * @param {boolean} ascending - Whether to sort in ascending order
 * @param {((a: T, b: T) => number) | false | undefined} customSort - Optional custom sort function
 * @returns {number} Negative if a < b (ascending) or a > b (descending), positive if a > b (ascending) or a < b (descending), 0 if equal
 */
export function compareValues(itemA, itemB, ascending, customSort) {
  if (customSort) {
    const result = customSort(itemA, itemB);
    return ascending ? result : -result;
  }

  let result;

  // Fast path: numeric comparison
  if (typeof itemA === "number" && typeof itemB === "number") {
    result = itemA - itemB;
  } else {
    // Handle null/undefined values
    if ([itemA, itemB].every((item) => !item && item !== 0)) {
      result = 0;
    } else if (!itemA && itemA !== 0) {
      result = 1;
    } else if (!itemB && itemB !== 0) {
      result = -1;
    } else {
      result = collator.compare(String(itemA), String(itemB));
    }
  }

  // Reverse result for descending order
  return ascending ? result : -result;
}

// Leading characters a spreadsheet interprets as the start of a formula.
const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/;

/**
 * Stringifies a cell value for CSV output.
 * @param {unknown} value - The resolved cell value
 * @returns {string} The value as a string; empty for null and undefined
 */
function stringifyCsvValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Quotes and escapes a single CSV field per RFC 4180.
 * @param {string} field - The stringified field value
 * @param {string} delimiter - The field delimiter
 * @param {boolean} escapeFormulas - Whether to neutralize spreadsheet formulas
 * @returns {string} The escaped field
 */
function escapeCsvField(field, delimiter, escapeFormulas) {
  const value =
    escapeFormulas && FORMULA_PREFIX_REGEX.test(field) ? `'${field}` : field;

  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\r") ||
    value.includes("\n")
  ) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

/**
 * @typedef {object} ToCsvHeader
 * @property {string} key - Column key; supports nested paths like "contact.company"
 * @property {unknown} [value] - Column label; falls back to the key
 * @property {boolean} [empty] - Whether the column renders no data
 * @property {boolean} [columnHidden] - Whether the column is hidden; hidden columns are skipped
 * @property {(item: unknown, row: Record<string, unknown>) => unknown} [display] - Formats the cell value
 */

/**
 * @typedef {object} ToCsvOptions
 * @property {string} [delimiter] - Field delimiter. Defaults to ","
 * @property {boolean} [includeHeaders] - Whether to emit the header row. Defaults to true
 * @property {boolean} [escapeFormulas] - Whether to prefix fields starting with "=", "+", "-", "@", tab, or carriage return with a single quote. Defaults to true
 * @property {string} [newline] - Line ending. Defaults to "\r\n"
 */

/**
 * Serializes data table headers and rows to a CSV string.
 * Skips empty and hidden columns, resolves nested keys, and applies `display`
 * formatting so the export matches the rendered table.
 * @template {Record<string, unknown>} Row
 * @param {ReadonlyArray<ToCsvHeader>} headers - The data table headers
 * @param {ReadonlyArray<Row>} rows - The rows to serialize
 * @param {ToCsvOptions} [options] - Serialization options
 * @returns {string} The CSV string
 */
export function toCsv(headers, rows, options = {}) {
  const {
    delimiter = ",",
    includeHeaders = true,
    escapeFormulas = true,
    newline = "\r\n",
  } = options;

  const columns = headers.filter(
    (header) => !header.empty && !header.columnHidden,
  );
  /** @type {string[]} */
  const lines = [];

  if (includeHeaders) {
    lines.push(
      columns
        .map((header) =>
          escapeCsvField(
            stringifyCsvValue(header.value ?? header.key),
            delimiter,
            escapeFormulas,
          ),
        )
        .join(delimiter),
    );
  }

  for (const row of rows) {
    lines.push(
      columns
        .map((header) => {
          const value = resolvePath(row, header.key);
          return escapeCsvField(
            stringifyCsvValue(
              header.display ? header.display(value, row) : value,
            ),
            delimiter,
            escapeFormulas,
          );
        })
        .join(delimiter),
    );
  }

  return lines.join(newline);
}

```

### Core Architecture Module: `src/ListBox/list-box-utils.d.ts`
```
/** Options that PageUp/PageDown move the highlight by in an open menu */
export declare const MENU_PAGE_STEP: number;

/** Max height values for listbox/dropdown menus by size */
export declare const MENU_MAX_HEIGHT: Readonly<{
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}>;

/**
 * Get the max height for a listbox/dropdown menu based on size.
 * @param size - The size variant (defaults to "md" when undefined)
 * @returns The max height in rem units
 */
export declare function getMenuMaxHeight(
  size?: "xs" | "sm" | "md" | "lg" | "xl",
): string;

/** Menu item heights (px) by size */
export declare const MENU_ITEM_HEIGHT: Readonly<{
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}>;

/** Fluid menu item height (px). Same height for every size. */
export declare const FLUID_MENU_ITEM_HEIGHT: number;

/**
 * Get the menu item height in pixels for a listbox/dropdown size.
 * @param size - The size variant (defaults to "md" when undefined)
 * @param options - Pass `fluid: true` for FLUID_MENU_ITEM_HEIGHT
 * @returns The item height in pixels
 */
export declare function getMenuItemHeight(
  size?: "xs" | "sm" | "md" | "lg" | "xl",
  options?: { fluid?: boolean },
): number;

/**
 * Whether a listbox menu's options should be windowed.
 */
export declare function shouldVirtualizeMenu(options: {
  /** The consumer's own items, not the filtered subset. */
  items: ArrayLike<unknown>;
  virtualize: boolean | object | undefined;
}): boolean;

```

### Core Architecture Module: `src/ListBox/list-box-utils.js`
```
// @ts-check
import { DEFAULT_VIRTUAL_LIST_CONFIG } from "../utils/virtualize.js";

/**
 * Options that PageUp/PageDown move the highlight by in an open menu
 * (APG combobox/listbox: "about 10 options").
 */
export const MENU_PAGE_STEP = 10;

/**
 * Max height values for listbox/dropdown menus by size.
 * @type {Readonly<{ xs: string; sm: string; md: string; lg: string; xl: string }>}
 */
export const MENU_MAX_HEIGHT = Object.freeze({
  xs: "8.25rem",
  sm: "11rem",
  md: "13.75rem",
  lg: "16.5rem",
  xl: "16.5rem",
});

/**
 * Get the max height for a listbox/dropdown menu based on size.
 * @param {"xs" | "sm" | "md" | "lg" | "xl"} [size] - The size variant
 * @returns {string} The max height in rem units
 */
export function getMenuMaxHeight(size = "md") {
  return MENU_MAX_HEIGHT[size];
}

/**
 * Menu item heights (px) by size. Matches `.bx--list-box__menu-item` in
 * carbon-components (xs 1.5rem, sm 2rem, md 2.5rem, lg/xl 3rem).
 * @type {Readonly<{ xs: number; sm: number; md: number; lg: number; xl: number }>}
 */
export const MENU_ITEM_HEIGHT = Object.freeze({
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 48,
});

/**
 * Fluid menu item height (px). Matches `$spacing-10` (4rem) on
 * `.bx--list-box__menu-item` in css/_fluid-list-box.scss. Same height for every
 * size; condensed fluid uses the size-based heights in MENU_ITEM_HEIGHT.
 */
export const FLUID_MENU_ITEM_HEIGHT = 64;

/**
 * Get the menu item height in pixels for a listbox/dropdown.
 * @param {"xs" | "sm" | "md" | "lg" | "xl"} [size] - The size variant
 * @param {{ fluid?: boolean }} [options] - Pass `fluid: true` for FLUID_MENU_ITEM_HEIGHT
 * @returns {number} The item height in pixels
 */
export function getMenuItemHeight(size = "md", { fluid = false } = {}) {
  if (fluid) return FLUID_MENU_ITEM_HEIGHT;
  return MENU_ITEM_HEIGHT[size] ?? MENU_ITEM_HEIGHT.md;
}

/**
 * Whether a listbox menu's options should be windowed. `virtualize={false}`
 * refuses however long the list runs, supplying the prop at all asks for it,
 * and with no prop a long enough list opts itself in.
 *
 * Separate from the windowing update because `ComboBox` needs the answer before
 * it can work out which options that update receives.
 *
 * @param {Object} options
 * @param {ArrayLike<unknown>} options.items The consumer's own items rather
 * than the filtered subset, windowing being a property of the collection
 * supplied and not of what a keystroke narrows it to.
 * @param {boolean | object | undefined} options.virtualize
 * @returns {boolean}
 */
export function shouldVirtualizeMenu({ items, virtualize }) {
  if (virtualize === false) return false;
  return (
    virtualize !== undefined ||
    items.length > DEFAULT_VIRTUAL_LIST_CONFIG.threshold
  );
}

```

### Core Architecture Module: `src/Portal/portal-utils.d.ts`
```
/**
 * Observe the closest modal ancestor for close events.
 * Calls `onClose` when the modal loses the "is-visible" class.
 * Returns a cleanup function to disconnect the observer.
 */
export declare function observeModalClose(
  node: HTMLElement,
  onClose: () => void,
): () => void;

```

### Core Architecture Module: `src/Portal/portal-utils.js`
```
// @ts-check
/**
 * Observe the closest modal ancestor for close events.
 * Calls `onClose` when the modal loses the "is-visible" class.
 * Returns a cleanup function to disconnect the observer.
 * @param {HTMLElement} node
 * @param {() => void} onClose
 * @returns {() => void}
 */
export function observeModalClose(node, onClose) {
  const modal = node.closest(".bx--modal");
  if (!modal) return () => {};

  const observer = new MutationObserver(() => {
    if (!modal.classList.contains("is-visible")) {
      onClose();
    }
  });

  observer.observe(modal, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => observer.disconnect();
}

```

### Core Architecture Module: `src/utils/array-set-ops.d.ts`
```
/** Toggle membership of `item` in `array`, returning a new array. */
export function toggleArrayItem<T>(
  array: ReadonlyArray<T>,
  item: T,
): ReadonlyArray<T>;

/**
 * Add `item` to `array` if not already present, returning a new array
 * (or the same array reference when no change is needed).
 */
export function addUniqueArrayItem<T>(
  array: ReadonlyArray<T>,
  item: T,
): ReadonlyArray<T>;

```

### Core Architecture Module: `src/utils/array-set-ops.js`
```
// @ts-check

/**
 * Toggle membership of `item` in `array`, returning a new array.
 *
 * @template T
 * @param {ReadonlyArray<T>} array
 * @param {T} item
 * @returns {ReadonlyArray<T>}
 */
export function toggleArrayItem(array, item) {
  return array.includes(item)
    ? array.filter((_) => _ !== item)
    : [...array, item];
}

/**
 * Add `item` to `array` if not already present, returning a new array
 * (or the same array reference when no change is needed).
 *
 * @template T
 * @param {ReadonlyArray<T>} array
 * @param {T} item
 * @returns {ReadonlyArray<T>}
 */
export function addUniqueArrayItem(array, item) {
  return array.includes(item) ? array : [...array, item];
}

```

### Core Architecture Module: `src/utils/avatar-color.d.ts`
```
/**
 * Chromatic `UserAvatar` background colors for auto mode. Grays are left out.
 */
export const AVATAR_BACKGROUND_COLORS: ReadonlyArray<
  "red" | "magenta" | "purple" | "blue" | "cyan" | "teal" | "green"
>;

/**
 * Hash a string to a non-negative 32-bit integer (djb2). Same string in, same hash out.
 */
export function hashString(value: string): number;

/**
 * Pick a stable avatar background color from a string. Empty or falsy input
 * returns the first palette entry.
 */
export function getAvatarBackgroundColor<
  T extends string = (typeof AVATAR_BACKGROUND_COLORS)[number],
>(value: string | null | undefined, palette?: ReadonlyArray<T>): T;

```

### Core Architecture Module: `src/utils/avatar-color.js`
```
// @ts-check
// Pick a stable avatar background color from a name or id. Same string, same color.

/**
 * Chromatic `UserAvatar` background colors for auto mode. Grays are left out.
 * Each entry is a valid `UserAvatar` `backgroundColor` value.
 * @type {ReadonlyArray<"red" | "magenta" | "purple" | "blue" | "cyan" | "teal" | "green">}
 */
export const AVATAR_BACKGROUND_COLORS = [
  "red",
  "magenta",
  "purple",
  "blue",
  "cyan",
  "teal",
  "green",
];

/**
 * Hash a string to a non-negative 32-bit integer (djb2). Same string in, same hash out.
 *
 * @param {string} value
 * @returns {number}
 */
export function hashString(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    // hash * 33 + charCode, kept within 32-bit range via `| 0`.
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  // Coerce to an unsigned 32-bit integer.
  return hash >>> 0;
}

/**
 * Pick a stable avatar background color from a string. Empty or falsy input
 * returns the first palette entry. An empty `palette` falls back to the
 * default palette so a `T` is always returned.
 *
 * @template {string} [T=(typeof AVATAR_BACKGROUND_COLORS)[number]]
 * @param {string | null | undefined} value
 * @param {ReadonlyArray<T>} [palette]
 * @returns {T}
 */
export function getAvatarBackgroundColor(
  value,
  palette = /** @type {ReadonlyArray<T>} */ (AVATAR_BACKGROUND_COLORS),
) {
  const effectivePalette =
    palette.length === 0
      ? /** @type {ReadonlyArray<T>} */ (AVATAR_BACKGROUND_COLORS)
      : palette;
  if (!value) return effectivePalette[0];
  return effectivePalette[hashString(value) % effectivePalette.length];
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3782** (2026-09-10): **Dropdown width scales with the selected text but does not take into account the clear button.**
  *Symptoms*:  No selection:  <img width="1692" height="108" alt="Image" src="https://github.com/user-attachments/assets/bb62f61e-247a-4c2b-8702-114d13f8f880" />   The Dropdown is scaled to accomodated a long text:  <img width="1690" height="92" alt="Image" src="https://github.com/user-attachments/assets/5fcb9378-a6d6-4823-aa8d-77c5f9b0d0e4" />   When the Dropdown is declared as `clearable`, the clear button is over the text:  <img width="1690" height="100" alt="Image" src="https://github.com/user-attachments/assets/f6b7d675-e03c-4605-a692-2c03304ee852" />  # To reproduce  ```html <script>   import { Grid, Column, Row, Dropdown } from "carbon-components-svelte"; </script>  <svelte:head><link rel="stylesheet" href="https://unpkg.com/carbon-components-svelte@0.107.1/css/g100.css" /></svelte:head>  <Grid> 	<Row> 		<Column> 			<Dropdown 				clearable                 items={[ 					{ id: 1, text:"short"}, 					{ id: 2, text:"a very long name"}				 				]} 	    /> 		</Column> 		<Column/> 		<Column/> 		<Column/> 		<Column/> 	</Row> </Grid> ```
  **Post-Mortem & Fix Analysis**:
  > Fixed in [v0.112.0](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.112.0)

- **Issue #3778** (2026-09-09): **Toolbar Buttons other than primary are not resized when in a "short" Datatable**
  *Symptoms*: Using `size="short"`:  <img width="1708" height="300" alt="Image" src="https://github.com/user-attachments/assets/478685ee-9a89-41ce-bb7a-fa13b03a370c" />  Note that other sizes have no effect on the tollbar height.   # To reproduce  ```html <script>   import { DataTable, Toolbar, ToolbarContent, Button } from "carbon-components-svelte"; </script>  <svelte:head><link rel="stylesheet" href="https://unpkg.com/carbon-components-svelte@0.107.1/css/g100.css" /></svelte:head>  <DataTable   size="short"    headers={[     { key: "name", value: "Name" },     { key: "protocol", value: "Protocol" },     { key: "port", value: "Port", width: "72px" },     { key: "rule", value: "Rule" },   ]}   rows={[     {       id: "a",       name: "Load Balancer 3",       protocol: "HTTP",       port: 3000,       rule: "Round robin",     },   ]} >   <Toolbar>     <ToolbarContent>       <Button kind="primary">Primary</Button>       <Button kind="secondary">Secondary</Button>       <Button kind="tertiary">Tertiary</Button>     </ToolbarContent>   </Toolbar>  </DataTable> ```` 
  **Post-Mortem & Fix Analysis**:
  > Fixed in [v0.112.0](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.112.0)

- **Issue #3777** (2026-09-09): **Datatable default expandIcon is smaller when a header has a width.**
  *Symptoms*: The usual look of the chevron of an expandable Datatable:  <img width="1708" height="316" alt="Image" src="https://github.com/user-attachments/assets/f423029f-57e8-4b53-a3a2-3b21df2f9891" />  The look of the chevron when a header has a width:  <img width="1700" height="322" alt="Image" src="https://github.com/user-attachments/assets/2d3763c4-8658-4633-b11e-cec60bfee5d5" />  # To reproduce  Take the "Expandable rows" example from the Datatable documentation: https://svelte.carbondesignsystem.com/components/DataTable#expandable-rows  Add a `width` to any of the header:  ```ts   headers={[     { key: "name", value: "Name" },     { key: "protocol", value: "Protocol" },  -   { key: "port", value: "Port" },  +   { key: "port", value: "Port", width: "72px" },     { key: "rule", value: "Rule" },   ]} ```  # Notes  Tested on version 0.111.1 
  **Post-Mortem & Fix Analysis**:
  > Fixed in [v0.112.0](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.112.0)

- **Issue #3710** (2026-08-20): **Bug: Select in modals triggers a click outside when selecting a value**
  *Symptoms*: When having a Select component in a Modal, clicking an item will close the modal (cause "clickoutisde"), the issue doesn't occur when using a Dropdown component I've just found out that the issue is present since 105.1 after [this PR ](https://github.com/carbon-design-system/carbon-components-svelte/pull/2808) (it's ok in 105.0) Issue still exists in 0.111.0  Reproduction (change the versions in the imports) https://svelte.dev/playground/37dcec10caaf4254961a43e528d3da89?version=5.56.9 
  **Post-Mortem & Fix Analysis**:
  > Fixed in [v0.111.1](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.111.1)

- **Issue #3709** (2026-08-29): **[a11y]: ListBox menu options (ComboBox / Dropdown / MultiSelect) truncate at 400% zoom, WCAG 1.4.10 Reflow**
  *Symptoms*: @metonym I'm wondering if you have any thoughts on doing something to handle this here since it doesn't seem to have gotten much traction from the carbon team?: https://github.com/carbon-design-system/carbon/issues/22462  `.bx--list-box__menu-item__option` is fixed at 2.5rem with `white-space: nowrap` / `text-overflow: ellipsis`. At 1280×1024 and 400% zoom, any label longer than the (now very narrow) field is cut off.   Wrapping with css when they aren't virtualized isn't a problem, but once the virtualizer kicks in with lists over 100 it assumes a fixed `itemHeight` (`offsetY = startIndex * itemHeight, totalHeight = length * itemHeight`).  Since wrapping deviates from Carbon's design, I'm thinking an opt-in prop on Dropdown / ComboBox / MultiSelect (e.g. wrapItems) that:  1. Applies wrap styles to the option (`height: auto; white-space: normal; overflow-wrap: anywhere`), including the checkbox label in MultiSelect. 2. Switches virtualization to measured row heights: something like a per-index height cache with a running-average estimate for unmeasured rows, prefix sums for offsets, binary search in getVisibleRange, and scrollTop correction when a row above the viewport is measured. The existing fixed-height path stays the default, so nothing changes for current consumers.  I could work on a PR if that approach sounds workable or maybe you've got other ideas?
  **Post-Mortem & Fix Analysis**:
  > Hello Brian, thank you for raising this issue. Agreed that this should be solved.  The opt-in approach sounds great, a PR is welcome. LMK how I can help.

- **Issue #3444** (2026-07-29): **DatePicker: portalMenu reverted to static:true on reactive re-run inside Modal**
  *Symptoms*:  When DatePicker is inside a ComposedModal (or any container with overflow: hidden) and portalMenu is true, the calendar is correctly appended to body on first creation. However, on any subsequent re-evaluation of the reactive statement calling initCalendar, the flatpickrProps loop applies calendar.set("static", true) (from the default { static: true }), which moves the calendar back inside the date picker container where it gets clipped.    Root cause: In initCalendar, when calendar already exists:     ```js     for (const [option, value] of Object.entries(flatpickrProps)) {       applyOptionIfChanged(option, value);     }   ```     This applies static: true from the default flatpickrProps, overriding the static: false that was set during   initial creation when portalMenu was true.     Workaround: Explicitly set flatpickrProps={{ static: false }} alongside portalMenu={true}.     Expected fix: The flatpickrProps loop should skip static when effectivePortalMenu is true, or the initial   static: false should be tracked in lastAppliedOptions so it isn't overwritten.
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting.  Fixed in [v0.110.2](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.110.2)

- **Issue #3434** (2026-07-17): **Wrong import of CheckmarkFilled in StructuredList and StructuredListRow**
  *Symptoms*: [StructuredList](https://github.com/carbon-design-system/carbon-components-svelte/blob/9cd2c8db09ce6e9c3d01783c3605a26fc1f61241/src/StructuredList/StructuredList.svelte#L36) and [StructuredListRow](https://github.com/carbon-design-system/carbon-components-svelte/blob/9cd2c8db09ce6e9c3d01783c3605a26fc1f61241/src/StructuredList/StructuredListRow.svelte#L17) import `CheckmarkFilled.svelte` from `carbon-icons-svelte` instead of [src/icons/CheckmarkFilled.svelte](https://github.com/carbon-design-system/carbon-components-svelte/blob/master/src/icons/CheckmarkFilled.svelte).  Both imports were added recently in #3368.
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this. Fixed in [v0.110.1](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.110.1)  
  > Thanks!

- **Issue #3170** (2026-06-07): **Multiselect won't work inside a modal**
  *Symptoms*: See the comparison below for outside modal and inside modal.  https://github.com/user-attachments/assets/ea5125a0-76fd-4e7b-a944-7f99c538ffff  Code ```svelte <script lang="ts"> 	import { 		Button, 		DatePicker, 		DatePickerInput, 		Form, 		Heading, 		Modal, 		MultiSelect, 		Stack, 		TextInput 	} from "carbon-components-svelte"; 	import { Add } from "carbon-icons-svelte"; 	let open = $state(false); </script>  <Heading>Album</Heading> <Button 	kind="ghost" 	size="small" 	icon={Add} 	on:click={() => { 		open = false; 		open = true; 	}} > 	Add </Button> <Modal 	preventCloseOnClickOutside 	bind:open 	modalHeading=" album" 	primaryButtonText="Submit" 	secondaryButtonText="Cancel" 	hasForm 	formId="sdfsedfsdf" 	on:click:button--secondary={() => (open = false)} > 	<Form 		id="sdfsedfsdf" 		class="form" 		on:submit={(e) => { 			e.preventDefault(); 			// submit(); 		}} 		><Stack gap={5}> 			<TextInput labelText="Name" name="name" placeholder="Name..." required={true} /> 			<DatePicker datePickerType="single" on:change dateFormat="d/m/Y"> 				<DatePickerInput labelText="Published Date" placeholder="dd/mm/yyyy" /> 			</DatePicker> 			<MultiSelect 				name="genres-multiselect" 				id="genres-multiselect-{Math.floor(Math.random() * 1000)}" 				labelText="Genres" 				items={[ 					{ id: "0", text: "Metal" }, 					{ id: "1", text: "Rock" }, 					{ id: "2", text: "Acoustic" }, 					{ id: "3", text: "Pop" } 				]} 			/> 		</Stack> 	</Form> </Modal> ```  NPM Packages ``` ├── @sveltejs/adapter-a
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting.  Fixed in [v0.108.1](https://github.com/carbon-design-system/carbon-components-svelte/releases/tag/v0.108.1).

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

### Incident Patch 1: `29db7c43` (2026-10-06)
**Commit Message**: fix(header-search): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup.
Opening the search from its button focuses the input without a click
on it, but after tabbing away, clicking back into the still-open
input selected nothing in Safari. Attach `preserveFocusSelection`,
which cancels that mouseup.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +16/-1)
```diff
@@ -4,6 +4,9 @@
     CopyInput,
     DatePicker,
     DatePickerInput,
+    Header,
+    HeaderSearch,
+    HeaderUtilities,
     MultiSelect,
     NumberInput,
     PasswordInput,
@@ -21,7 +24,19 @@
   } from "carbon-components-svelte";
 </script>
 
-<div style="display: grid; gap: 1rem; max-width: 24rem; padding: 1rem">
+<Header company="IBM" platformName="Carbon">
+  <HeaderUtilities>
+    <HeaderSearch
+      data-testid="header-search"
+      selectTextOnFocus
+      value="abcdef"
+    />
+  </HeaderUtilities>
+</Header>
+
+<div
+  style="display: grid; gap: 1rem; max-width: 24rem; padding: 4rem 1rem 1rem"
+>
   <CopyInput
     data-testid="copy-input"
     labelText="Copy input"
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +19/-3)
```diff
@@ -1,11 +1,15 @@
-import { expect, type Locator, test } from "@playwright/test";
+import { expect, type Locator, type Page, test } from "@playwright/test";
 
 // WebKit collapses a focus-time `select()` on the click's mouseup, so each
 // case clicks into the field and checks the whole value is still selected.
 // jsdom can't show this, and CI runs Chromium only: run WebKit locally.
 // `number` inputs expose no selection API, so those cases type a digit and
 // expect it to replace the value.
-const cases: { testId: string; check?: "replace" }[] = [
+const cases: {
+  testId: string;
+  check?: "replace";
+  setup?: (page: Page) => Promise<void>;
+}[] = [
   { testId: "copy-input" },
   { testId: "text-input" },
   { testId: "password-input" },
@@ -21,6 +25,17 @@ const cases: { testId: string; check?: "replace" }[] = [
   { testId: "combo-box" },
   { testId: "multi-select" },
   { testId: "pin-code-input" },
+  {
+    testId: "header-search",
+    // Open the search, then tab away so the click below focuses it again.
+    setup: async (page) => {
+      await page
+        .locator("header")
+        .getByRole("button", { name: "Search" })
+        .click();
+      await page.keyboard.press("Tab");
+    },
+  },
 ];
 
 async function expectFullSelection(input: Locator) {
@@ -39,10 +54,11 @@ test.describe("selectTextOnFocus", () => {
     await page.goto("/select-text-on-focus.html");
   });
 
-  for (const { testId, check } of cases) {
+  for (const { testId, check, setup } of cases) {
     test(`${testId} keeps the full value selected after a click`, async ({
       page,
     }) => {
+      await setup?.(page);
       // `data-testid` lands on the wrapper for some components.
       const target = page.getByTestId(testId);
       const input = (await target.evaluate((el) =>
```

**File**: `src/UIShell/HeaderSearch.svelte` (modified, +2/-0)
```diff
@@ -132,6 +132,7 @@
   import { isOutsideClick } from "../utils/is-outside-click.js";
   import { moveIndex } from "../utils/move-index.js";
   import { createOptionListNavigator } from "../utils/option-list-navigator.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { uniqueId } from "../utils/unique-id.js";
 
   const dispatch = createEventDispatcher();
@@ -378,6 +379,7 @@
     </button>
     <input
       bind:this={ref}
+      use:preserveFocusSelection={selectTextOnFocus}
       type="text"
       autocomplete="off"
       {placeholder}
```

**File**: `tests/UIShell/HeaderSearch.test.ts` (modified, +14/-0)
```diff
@@ -3,6 +3,7 @@ import type HeaderSearchComponent from "carbon-components-svelte/UIShell/HeaderS
 import type { HeaderSearchResult } from "carbon-components-svelte/UIShell/HeaderSearch.svelte";
 import type { ComponentProps } from "svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { flushDismiss } from "../utils/flush-dismiss";
 import { flushMacrotask } from "../utils/flush-macrotask";
 import { user } from "../utils/user";
@@ -67,6 +68,19 @@ describe("HeaderSearch", () => {
       expect(input.selectionEnd).toBe("clusters".length);
     });
 
+    it("keeps the selected value through the click's mouseup", async () => {
+      render(HeaderSearchTest, {
+        props: { selectTextOnFocus: true, value: "clusters" },
+      });
+
+      await user.click(screen.getByRole("button", { name: "Search" }));
+      const input = screen.getByRole("textbox");
+      input.blur();
+
+      const mouseup = await clickToFocus(input);
+      expect(mouseup.defaultPrevented).toBe(true);
+    });
+
     it("does not select all text on focus when selectTextOnFocus is false (default)", async () => {
       render(HeaderSearchTest, { props: { value: "clusters" } });
 
```

---

### Incident Patch 2: `e2efa85d` (2026-10-06)
**Commit Message**: fix(pin-code-input): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup,
so clicking a segment left its character unselected in Safari.
Keyboard focus worked. Attach `preserveFocusSelection` to each
segment.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +7/-0)
```diff
@@ -7,6 +7,7 @@
     MultiSelect,
     NumberInput,
     PasswordInput,
+    PinCodeInput,
     RangeSlider,
     Search,
     SearchMenu,
@@ -125,4 +126,10 @@
     ]}
     value="abcdef"
   />
+  <PinCodeInput
+    data-testid="pin-code-input"
+    labelText="Pin code"
+    selectTextOnFocus
+    value="1234"
+  />
 </div>
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ const cases: { testId: string; check?: "replace" }[] = [
   { testId: "range-slider", check: "replace" },
   { testId: "combo-box" },
   { testId: "multi-select" },
+  { testId: "pin-code-input" },
 ];
 
 async function expectFullSelection(input: Locator) {
```

**File**: `src/PinCodeInput/PinCodeInput.svelte` (modified, +2/-0)
```diff
@@ -192,6 +192,7 @@
     resolveValidationVisibility,
   } from "../utils/field-status.js";
   import { formReset } from "../utils/form-reset.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { uniqueId } from "../utils/unique-id.js";
 
   const dispatch = createEventDispatcher();
@@ -553,6 +554,7 @@
         {#each code as char, index (index)}
           <input
             bind:this={inputs[index]}
+            use:preserveFocusSelection={selectTextOnFocus}
             type="text"
             inputmode={type === "numeric" ? "numeric" : "text"}
             autocomplete={index === 0 ? "one-time-code" : "off"}
```

**File**: `tests/PinCodeInput/PinCodeInput.test.ts` (modified, +10/-0)
```diff
@@ -1,5 +1,6 @@
 import { fireEvent, render, screen } from "@testing-library/svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { user } from "../utils/user";
 import { getPinCodeInputs as getInputs } from "./helpers";
 import PinCodeInputFluidForm from "./PinCodeInput.fluidForm.test.svelte";
@@ -646,6 +647,15 @@ describe("PinCodeInput", () => {
     select.mockRestore();
   });
 
+  it("keeps the selected value through the click's mouseup", async () => {
+    render(PinCodeInput, {
+      props: { selectTextOnFocus: true, value: "0182" },
+    });
+
+    const mouseup = await clickToFocus(getInputs()[2]);
+    expect(mouseup.defaultPrevented).toBe(true);
+  });
+
   it("should set aria-errormessage (not aria-describedby) to the error id on each segment when invalid", () => {
     const { container } = render(PinCodeInput, {
       props: { id: "test-pin", invalid: true, invalidText: "Incorrect code" },
```

---

### Incident Patch 3: `178d6a03` (2026-10-06)
**Commit Message**: fix(multi-select): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup,
so clicking the filter input selected nothing in Safari and typing
appended to the filter text. Keyboard focus worked. Attach
`preserveFocusSelection`, which cancels that mouseup.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +12/-0)
```diff
@@ -4,6 +4,7 @@
     CopyInput,
     DatePicker,
     DatePickerInput,
+    MultiSelect,
     NumberInput,
     PasswordInput,
     RangeSlider,
@@ -113,4 +114,15 @@
     ]}
     selectedId="0"
   />
+  <MultiSelect
+    data-testid="multi-select"
+    titleText="Multi select"
+    filterable
+    selectTextOnFocus
+    items={[
+      { id: "0", text: "Slack" },
+      { id: "1", text: "Email" },
+    ]}
+    value="abcdef"
+  />
 </div>
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ const cases: { testId: string; check?: "replace" }[] = [
   { testId: "slider", check: "replace" },
   { testId: "range-slider", check: "replace" },
   { testId: "combo-box" },
+  { testId: "multi-select" },
 ];
 
 async function expectFullSelection(input: Locator) {
```

**File**: `src/MultiSelect/MultiSelect.svelte` (modified, +2/-0)
```diff
@@ -445,6 +445,7 @@
   import { isOutsideClick } from "../utils/is-outside-click.js";
   import { createScrollEndTracker } from "../utils/is-scroll-near-end.js";
   import { moveIndex } from "../utils/move-index.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { rangeSlice } from "../utils/range-slice.js";
   import {
     createTypeaheadBuffer,
@@ -1388,6 +1389,7 @@
           {/if}
           <input
             bind:this={inputRef}
+            use:preserveFocusSelection={selectTextOnFocus && !disabled}
             bind:value
             {...$$restProps}
             role="combobox"
```

**File**: `tests/MultiSelect/MultiSelect.test.ts` (modified, +15/-0)
```diff
@@ -4,6 +4,7 @@ import type { MultiSelectItem } from "carbon-components-svelte/MultiSelect/Multi
 import MultiSelectReal from "carbon-components-svelte/MultiSelect/MultiSelect.svelte";
 import type { ComponentEvents, ComponentProps } from "svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { user } from "../utils/user";
 import { closeMenu, openMenu, toggleOption } from "./helpers";
 import MultiSelectFluidForm from "./MultiSelect.fluidForm.test.svelte";
@@ -61,6 +62,20 @@ describe("MultiSelect", () => {
     expect(input.selectionEnd).toBe("Slack".length);
   });
 
+  it("keeps the selected value through the click's mouseup", async () => {
+    render(MultiSelectReal, {
+      props: {
+        items: [],
+        filterable: true,
+        selectTextOnFocus: true,
+        value: "Slack",
+      },
+    });
+
+    const mouseup = await clickToFocus(screen.getByRole("combobox"));
+    expect(mouseup.defaultPrevented).toBe(true);
+  });
+
   it("does not select all filter text on focus when selectTextOnFocus is false (default)", async () => {
     render(MultiSelectReal, {
       props: { items: [], filterable: true, value: "Slack" },
```

---

### Incident Patch 4: `24e0a5e9` (2026-10-06)
**Commit Message**: fix(combo-box): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup,
so clicking the field selected nothing in Safari and typing appended
to the selected item's text. Keyboard focus worked. Attach
`preserveFocusSelection`, which cancels that mouseup.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +11/-0)
```diff
@@ -1,5 +1,6 @@
 <script>
   import {
+    ComboBox,
     CopyInput,
     DatePicker,
     DatePickerInput,
@@ -102,4 +103,14 @@
     value={123456}
     valueUpper={234567}
   />
+  <ComboBox
+    data-testid="combo-box"
+    titleText="Combo box"
+    selectTextOnFocus
+    items={[
+      { id: "0", text: "Slack" },
+      { id: "1", text: "Email" },
+    ]}
+    selectedId="0"
+  />
 </div>
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ const cases: { testId: string; check?: "replace" }[] = [
   { testId: "toolbar-search" },
   { testId: "slider", check: "replace" },
   { testId: "range-slider", check: "replace" },
+  { testId: "combo-box" },
 ];
 
 async function expectFullSelection(input: Locator) {
```

**File**: `src/ComboBox/ComboBox.svelte` (modified, +2/-0)
```diff
@@ -342,6 +342,7 @@
   import { isOutsideClick } from "../utils/is-outside-click.js";
   import { createScrollEndTracker } from "../utils/is-scroll-near-end.js";
   import { moveIndex } from "../utils/move-index.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { uniqueId } from "../utils/unique-id.js";
   import { resetVirtualScrollOnClose } from "../utils/virtualize.js";
 
@@ -927,6 +928,7 @@
       <div bind:this={fieldRef} class:bx--list-box__field={true}>
         <input
           bind:this={ref}
+          use:preserveFocusSelection={selectTextOnFocus && !disabled}
           bind:value
           use:formReset={handleFormReset}
           type="text"
```

**File**: `tests/ComboBox/ComboBox.test.ts` (modified, +10/-0)
```diff
@@ -5,6 +5,7 @@ import ComboBoxReal from "carbon-components-svelte/ComboBox/ComboBox.svelte";
 import { fuzzyMatch } from "carbon-components-svelte/utils/fuzzy-match";
 import type { ComponentEvents, ComponentProps } from "svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { user } from "../utils/user";
 import ComboBoxFluidForm from "./ComboBox.fluidForm.test.svelte";
 import ComboBoxFluidSkeleton from "./ComboBox.fluidSkeleton.test.svelte";
@@ -1462,6 +1463,15 @@ describe("ComboBox", () => {
     expect(input.selectionEnd).toBe(5);
   });
 
+  it("keeps the selected value through the click's mouseup", async () => {
+    render(ComboBox, {
+      props: { selectedId: "1", value: "Email", selectTextOnFocus: true },
+    });
+
+    const mouseup = await clickToFocus(getInput());
+    expect(mouseup.defaultPrevented).toBe(true);
+  });
+
   it("should not select all text on focus when selectTextOnFocus is false (default)", async () => {
     render(ComboBox, {
       props: {
```

---

### Incident Patch 5: `6c5f374d` (2026-10-06)
**Commit Message**: fix(range-slider): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup,
so clicking either text input selected nothing in Safari and typing
appended to the value. Keyboard focus worked. Attach
`preserveFocusSelection` to both inputs.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +9/-0)
```diff
@@ -5,6 +5,7 @@
     DatePickerInput,
     NumberInput,
     PasswordInput,
+    RangeSlider,
     Search,
     SearchMenu,
     Slider,
@@ -93,4 +94,12 @@
     max={999999}
     value={123456}
   />
+  <RangeSlider
+    data-testid="range-slider"
+    labelText="Range slider"
+    selectTextOnFocus
+    max={999999}
+    value={123456}
+    valueUpper={234567}
+  />
 </div>
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ const cases: { testId: string; check?: "replace" }[] = [
   { testId: "search-menu" },
   { testId: "toolbar-search" },
   { testId: "slider", check: "replace" },
+  { testId: "range-slider", check: "replace" },
 ];
 
 async function expectFullSelection(input: Locator) {
```

**File**: `src/Slider/RangeSlider.svelte` (modified, +3/-0)
```diff
@@ -158,6 +158,7 @@
     resolveValidationVisibility,
   } from "../utils/field-status.js";
   import { clamp } from "../utils/numeric-format.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { reflectDefaultValue } from "../utils/reflect-default-value.js";
   import { resolveSliderMarks } from "../utils/resolve-slider-marks.js";
   import {
@@ -460,6 +461,7 @@
     >
       <input
         bind:this={lowerInputRef}
+        use:preserveFocusSelection={selectTextOnFocus && !disabled}
         use:reflectDefaultValue={value}
         type={hideTextInput ? "hidden" : inputType}
         id={lowerInputId}
@@ -693,6 +695,7 @@
     >
       <input
         bind:this={upperInputRef}
+        use:preserveFocusSelection={selectTextOnFocus && !disabled}
         use:reflectDefaultValue={valueUpper}
         type={hideTextInput ? "hidden" : inputType}
         id={upperInputId}
```

**File**: `tests/Slider/RangeSlider.test.ts` (modified, +11/-0)
```diff
@@ -1,6 +1,7 @@
 import { fireEvent, render, screen } from "@testing-library/svelte";
 import RangeSliderComponent from "carbon-components-svelte/Slider/RangeSlider.svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { flushDismiss } from "../utils/flush-dismiss";
 import { user } from "../utils/user";
 import RangeSlider from "./RangeSlider.test.svelte";
@@ -80,6 +81,16 @@ describe("RangeSlider", () => {
     expect(selectUpper).toHaveBeenCalled();
   });
 
+  it("keeps each selected value through the click's mouseup", async () => {
+    render(RangeSlider, {
+      props: { selectTextOnFocus: true, value: 10, valueUpper: 90 },
+    });
+
+    const [lower, upper] = screen.getAllByRole("spinbutton");
+    expect((await clickToFocus(lower)).defaultPrevented).toBe(true);
+    expect((await clickToFocus(upper)).defaultPrevented).toBe(true);
+  });
+
   it("does not select all text on focus when selectTextOnFocus is false (default)", async () => {
     render(RangeSlider, { props: { value: 10, valueUpper: 90 } });
 
```

---

### Incident Patch 6: `f0f1cb4a` (2026-10-06)
**Commit Message**: fix(slider): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup,
so clicking the text input selected nothing in Safari and typing
appended to the value. Keyboard focus worked. Attach
`preserveFocusSelection`, which cancels that mouseup.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +8/-0)
```diff
@@ -7,6 +7,7 @@
     PasswordInput,
     Search,
     SearchMenu,
+    Slider,
     TextArea,
     TextInput,
     TimePicker,
@@ -85,4 +86,11 @@
       />
     </ToolbarContent>
   </Toolbar>
+  <Slider
+    data-testid="slider"
+    labelText="Slider"
+    selectTextOnFocus
+    max={999999}
+    value={123456}
+  />
 </div>
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +8/-1)
```diff
@@ -16,6 +16,7 @@ const cases: { testId: string; check?: "replace" }[] = [
   { testId: "search" },
   { testId: "search-menu" },
   { testId: "toolbar-search" },
+  { testId: "slider", check: "replace" },
 ];
 
 async function expectFullSelection(input: Locator) {
@@ -38,7 +39,13 @@ test.describe("selectTextOnFocus", () => {
     test(`${testId} keeps the full value selected after a click`, async ({
       page,
     }) => {
-      const input = page.getByTestId(testId);
+      // `data-testid` lands on the wrapper for some components.
+      const target = page.getByTestId(testId);
+      const input = (await target.evaluate((el) =>
+        el.matches("input, textarea"),
+      ))
+        ? target
+        : target.locator("input:not([type=hidden]), textarea").first();
       await input.click();
 
       if (check === "replace") {
```

**File**: `src/Slider/Slider.svelte` (modified, +2/-0)
```diff
@@ -143,6 +143,7 @@
     resolveValidationVisibility,
   } from "../utils/field-status.js";
   import { clamp } from "../utils/numeric-format.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { reflectDefaultValue } from "../utils/reflect-default-value.js";
   import {
     nearestMark,
@@ -426,6 +427,7 @@
       {/if}
       <input
         bind:this={textInputRef}
+        use:preserveFocusSelection={selectTextOnFocus && !disabled}
         use:reflectDefaultValue={value}
         type={hideTextInput ? "hidden" : inputType}
         id={inputId}
```

**File**: `tests/Slider/Slider.test.ts` (modified, +8/-0)
```diff
@@ -1,5 +1,6 @@
 import { fireEvent, render, screen } from "@testing-library/svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { flushMacrotask } from "../utils/flush-macrotask";
 import { user } from "../utils/user";
 import Slider from "./Slider.test.svelte";
@@ -178,6 +179,13 @@ describe("Slider", () => {
     expect(select).toHaveBeenCalled();
   });
 
+  it("keeps the selected value through the click's mouseup", async () => {
+    render(Slider, { props: { selectTextOnFocus: true, value: 42 } });
+
+    const mouseup = await clickToFocus(screen.getByRole("spinbutton"));
+    expect(mouseup.defaultPrevented).toBe(true);
+  });
+
   it("does not select all text on focus when selectTextOnFocus is false (default)", async () => {
     render(Slider, { props: { value: 42 } });
 
```

---

### Incident Patch 7: `79122e1d` (2026-10-06)
**Commit Message**: fix(search): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup,
so clicking the field selected nothing in Safari. Keyboard focus
worked. Attach `preserveFocusSelection`, which cancels that mouseup.
SearchMenu and ToolbarSearch forward the prop to Search and are fixed
with it.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +29/-0)
```diff
@@ -5,9 +5,14 @@
     DatePickerInput,
     NumberInput,
     PasswordInput,
+    Search,
+    SearchMenu,
     TextArea,
     TextInput,
     TimePicker,
+    Toolbar,
+    ToolbarContent,
+    ToolbarSearch,
   } from "carbon-components-svelte";
 </script>
 
@@ -56,4 +61,28 @@
       selectTextOnFocus
     />
   </DatePicker>
+
+  <Search
+    data-testid="search"
+    labelText="Search"
+    selectTextOnFocus
+    value="abcdef"
+  />
+  <SearchMenu
+    data-testid="search-menu"
+    labelText="Search menu"
+    selectTextOnFocus
+    value="abcdef"
+    items={["abcdef"]}
+  />
+  <Toolbar>
+    <ToolbarContent>
+      <ToolbarSearch
+        data-testid="toolbar-search"
+        persistent
+        selectTextOnFocus
+        value="abcdef"
+      />
+    </ToolbarContent>
+  </Toolbar>
 </div>
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +3/-0)
```diff
@@ -13,6 +13,9 @@ const cases: { testId: string; check?: "replace" }[] = [
   { testId: "time-picker" },
   { testId: "number-input", check: "replace" },
   { testId: "date-picker-input" },
+  { testId: "search" },
+  { testId: "search-menu" },
+  { testId: "toolbar-search" },
 ];
 
 async function expectFullSelection(input: Locator) {
```

**File**: `src/Search/Search.svelte` (modified, +2/-0)
```diff
@@ -140,6 +140,7 @@
     resolveValidationVisibility,
   } from "../utils/field-status.js";
   import { formReset } from "../utils/form-reset.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { uniqueId } from "../utils/unique-id.js";
   import SearchSkeleton from "./SearchSkeleton.svelte";
 
@@ -289,6 +290,7 @@
     <!-- svelte-ignore a11y-autofocus -->
     <input
       bind:this={ref}
+      use:preserveFocusSelection={selectTextOnFocus && !disabled}
       use:formReset={handleFormReset}
       bind:value
       type="search"
```

**File**: `tests/Search/Search.test.ts` (modified, +10/-0)
```diff
@@ -2,6 +2,7 @@ import { render, screen } from "@testing-library/svelte";
 import type SearchComponent from "carbon-components-svelte/Search/Search.svelte";
 import type { ComponentProps } from "svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { user } from "../utils/user";
 import SearchFluidForm from "./Search.fluidForm.test.svelte";
 import SearchFluidSkeleton from "./Search.fluidSkeleton.test.svelte";
@@ -50,6 +51,15 @@ describe("Search", () => {
     expect(search.selectionEnd).toBe("Cloud functions".length);
   });
 
+  it("keeps the selected value through the click's mouseup", async () => {
+    render(Search, {
+      props: { selectTextOnFocus: true, value: "Cloud functions" },
+    });
+
+    const mouseup = await clickToFocus(getSearchInput("Default search"));
+    expect(mouseup.defaultPrevented).toBe(true);
+  });
+
   it("does not select all text on focus when selectTextOnFocus is false (default)", async () => {
     render(Search, { props: { value: "Cloud functions" } });
 
```

---

### Incident Patch 8: `c8522338` (2026-10-06)
**Commit Message**: fix(date-picker): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup,
so clicking DatePickerInput selected nothing in Safari. Keyboard focus
worked. Attach `preserveFocusSelection`, which cancels that mouseup.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +10/-0)
```diff
@@ -1,6 +1,8 @@
 <script>
   import {
     CopyInput,
+    DatePicker,
+    DatePickerInput,
     NumberInput,
     PasswordInput,
     TextArea,
@@ -46,4 +48,12 @@
     selectTextOnFocus
     value={123456}
   />
+  <DatePicker datePickerType="single" value="01/02/2026">
+    <DatePickerInput
+      data-testid="date-picker-input"
+      labelText="Date picker"
+      placeholder="mm/dd/yyyy"
+      selectTextOnFocus
+    />
+  </DatePicker>
 </div>
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ const cases: { testId: string; check?: "replace" }[] = [
   { testId: "text-area" },
   { testId: "time-picker" },
   { testId: "number-input", check: "replace" },
+  { testId: "date-picker-input" },
 ];
 
 async function expectFullSelection(input: Locator) {
```

**File**: `src/DatePicker/DatePickerInput.svelte` (modified, +2/-0)
```diff
@@ -120,6 +120,7 @@
     resolveValidationVisibility,
   } from "../utils/field-status.js";
   import { formReset } from "../utils/form-reset.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { uniqueId } from "../utils/unique-id.js";
 
   const {
@@ -251,6 +252,7 @@
   >
     <input
       bind:this={ref}
+      use:preserveFocusSelection={selectTextOnFocus && !disabled && !$multiple}
       use:attachFormReset={handleFormReset}
       data-invalid={showInvalid || undefined}
       aria-invalid={showInvalid || undefined}
```

**File**: `tests/DatePicker/DatePicker.test.ts` (modified, +8/-0)
```diff
@@ -4,6 +4,7 @@ import { english } from "flatpickr/dist/l10n/default";
 import type { Instance } from "flatpickr/dist/types/instance";
 import type { ComponentProps } from "svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { flushMacrotask } from "../utils/flush-macrotask";
 import { user } from "../utils/user";
 import DatePickerFluidForm from "./DatePicker.fluidForm.test.svelte";
@@ -47,6 +48,13 @@ describe("DatePicker", () => {
     expect(input.selectionEnd).toBe("01/01/2023".length);
   });
 
+  it("keeps the selected value through the click's mouseup", async () => {
+    render(DatePicker, { selectTextOnFocus: true, value: "01/01/2023" });
+
+    const mouseup = await clickToFocus(screen.getByLabelText("Date"));
+    expect(mouseup.defaultPrevented).toBe(true);
+  });
+
   it("does not select all text on focus when selectTextOnFocus is false (default)", async () => {
     render(DatePicker, { value: "01/01/2023" });
 
```

---

### Incident Patch 9: `b62ccf42` (2026-10-06)
**Commit Message**: fix(number-input): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup,
so clicking the field selected nothing in Safari and typing appended
to the value. Keyboard focus worked. Attach `preserveFocusSelection`
to both the number and text-mode inputs.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +7/-0)
```diff
@@ -1,6 +1,7 @@
 <script>
   import {
     CopyInput,
+    NumberInput,
     PasswordInput,
     TextArea,
     TextInput,
@@ -39,4 +40,10 @@
     selectTextOnFocus
     value="12:34"
   />
+  <NumberInput
+    data-testid="number-input"
+    label="Number input"
+    selectTextOnFocus
+    value={123456}
+  />
 </div>
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ const cases: { testId: string; check?: "replace" }[] = [
   { testId: "password-input" },
   { testId: "text-area" },
   { testId: "time-picker" },
+  { testId: "number-input", check: "replace" },
 ];
 
 async function expectFullSelection(input: Locator) {
```

**File**: `src/NumberInput/NumberInput.svelte` (modified, +3/-0)
```diff
@@ -216,6 +216,7 @@
     parseLocaleValue,
     roundToStep,
   } from "../utils/numeric-format.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { reflectDefaultValue } from "../utils/reflect-default-value.js";
   import { uniqueId } from "../utils/unique-id.js";
 
@@ -524,6 +525,7 @@
         {/if}
         <input
           bind:this={ref}
+          use:preserveFocusSelection={selectTextOnFocus && !disabled}
           use:formReset={handleFormReset}
           use:reflectDefaultValue={allowEmpty ? undefined : inputValue}
           value={inputValue}
@@ -567,6 +569,7 @@
       {:else}
         <input
           bind:this={ref}
+          use:preserveFocusSelection={selectTextOnFocus && !disabled}
           use:formReset={handleFormReset}
           use:reflectDefaultValue={allowEmpty ? undefined : value}
           type="number"
```

**File**: `tests/NumberInput/NumberInput.test.ts` (modified, +17/-0)
```diff
@@ -1,6 +1,7 @@
 import { fireEvent, render, screen } from "@testing-library/svelte";
 import type { ComponentProps } from "svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { isSvelte5 } from "../utils/svelte-version";
 import { user } from "../utils/user";
 import NumberInputFluidForm from "./NumberInput.fluidForm.test.svelte";
@@ -29,6 +30,22 @@ describe("NumberInput", () => {
     expect(select).toHaveBeenCalled();
   });
 
+  it("keeps the selected value through the click's mouseup", async () => {
+    render(NumberInput, { props: { selectTextOnFocus: true, value: 42 } });
+
+    const mouseup = await clickToFocus(screen.getByRole("spinbutton"));
+    expect(mouseup.defaultPrevented).toBe(true);
+  });
+
+  it("keeps the selected value through the click's mouseup in text mode", async () => {
+    render(NumberInput, {
+      props: { selectTextOnFocus: true, value: 4.2, allowDecimal: true },
+    });
+
+    const mouseup = await clickToFocus(screen.getByRole("textbox"));
+    expect(mouseup.defaultPrevented).toBe(true);
+  });
+
   it("does not select all text on focus when selectTextOnFocus is false (default)", async () => {
     render(NumberInput, { props: { value: 42 } });
 
```

---

### Incident Patch 10: `ad950931` (2026-10-06)
**Commit Message**: fix(time-picker): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup,
so clicking the field selected nothing in Safari. Keyboard focus
worked. Attach `preserveFocusSelection`, which cancels that mouseup.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +7/-0)
```diff
@@ -4,6 +4,7 @@
     PasswordInput,
     TextArea,
     TextInput,
+    TimePicker,
   } from "carbon-components-svelte";
 </script>
 
@@ -32,4 +33,10 @@
     selectTextOnFocus
     value="abcdef"
   />
+  <TimePicker
+    data-testid="time-picker"
+    labelText="Time picker"
+    selectTextOnFocus
+    value="12:34"
+  />
 </div>
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ const cases: { testId: string; check?: "replace" }[] = [
   { testId: "text-input" },
   { testId: "password-input" },
   { testId: "text-area" },
+  { testId: "time-picker" },
 ];
 
 async function expectFullSelection(input: Locator) {
```

**File**: `src/TimePicker/TimePicker.svelte` (modified, +3/-0)
```diff
@@ -89,6 +89,7 @@
     resolveValidationVisibility,
   } from "../utils/field-status.js";
   import { formReset } from "../utils/form-reset.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { uniqueId } from "../utils/unique-id.js";
 
   const formContext = getContext(FORM_CONTEXT_KEY);
@@ -185,6 +186,7 @@
               <div class:bx--text-input__field-wrapper={true}>
                 <input
                   bind:this={ref}
+                  use:preserveFocusSelection={selectTextOnFocus && !disabled}
                   use:formReset={handleFormReset}
                   bind:value
                   type="text"
@@ -282,6 +284,7 @@
             {/if}
             <input
               bind:this={ref}
+              use:preserveFocusSelection={selectTextOnFocus && !disabled}
               use:formReset={handleFormReset}
               bind:value
               type="text"
```

**File**: `tests/TimePicker/TimePicker.test.ts` (modified, +17/-0)
```diff
@@ -1,5 +1,6 @@
 import { fireEvent, render, screen } from "@testing-library/svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { user } from "../utils/user";
 import TimePickerFluidForm from "./TimePicker.fluidForm.test.svelte";
 import TimePickerFluidSkeleton from "./TimePicker.fluidSkeleton.test.svelte";
@@ -41,6 +42,22 @@ describe("TimePicker", () => {
     expect(input.selectionEnd).toBe("12:00".length);
   });
 
+  it("keeps the selected value through the click's mouseup", async () => {
+    render(TimePicker, { props: { selectTextOnFocus: true, value: "12:00" } });
+
+    const mouseup = await clickToFocus(screen.getByRole("textbox"));
+    expect(mouseup.defaultPrevented).toBe(true);
+  });
+
+  it("keeps the selected value through the click's mouseup when fluid", async () => {
+    render(TimePicker, {
+      props: { selectTextOnFocus: true, value: "12:00", fluid: true },
+    });
+
+    const mouseup = await clickToFocus(screen.getByRole("textbox"));
+    expect(mouseup.defaultPrevented).toBe(true);
+  });
+
   it("does not select all text on focus when selectTextOnFocus is false (default)", async () => {
     render(TimePicker, { props: { value: "12:00" } });
 
```

---

### Incident Patch 11: `faef3cb0` (2026-10-06)
**Commit Message**: fix(text-area): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup,
so clicking the field selected nothing in Safari. Keyboard focus
worked. Attach `preserveFocusSelection`, which cancels that mouseup.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +7/-0)
```diff
@@ -2,6 +2,7 @@
   import {
     CopyInput,
     PasswordInput,
+    TextArea,
     TextInput,
   } from "carbon-components-svelte";
 </script>
@@ -25,4 +26,10 @@
     selectTextOnFocus
     value="abcdef"
   />
+  <TextArea
+    data-testid="text-area"
+    labelText="Text area"
+    selectTextOnFocus
+    value="abcdef"
+  />
 </div>
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ const cases: { testId: string; check?: "replace" }[] = [
   { testId: "copy-input" },
   { testId: "text-input" },
   { testId: "password-input" },
+  { testId: "text-area" },
 ];
 
 async function expectFullSelection(input: Locator) {
```

**File**: `src/TextArea/TextArea.svelte` (modified, +2/-0)
```diff
@@ -117,6 +117,7 @@
   } from "../utils/field-status.js";
   import { formReset } from "../utils/form-reset.js";
   import { graphemeCount, truncateGraphemes } from "../utils/grapheme-count.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { rafThrottle } from "../utils/raf-throttle.js";
   import { uniqueId } from "../utils/unique-id.js";
 
@@ -356,6 +357,7 @@
     {/if}
     <textarea
       bind:this={ref}
+      use:preserveFocusSelection={selectTextOnFocus && !disabled}
       use:formReset={handleFormReset}
       bind:value
       aria-invalid={showInvalid || overCount || undefined}
```

**File**: `tests/TextArea/TextArea.test.ts` (modified, +10/-0)
```diff
@@ -1,5 +1,6 @@
 import { fireEvent, render, screen } from "@testing-library/svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { user } from "../utils/user";
 import TextAreaFluidForm from "./TextArea.fluidForm.test.svelte";
 import TextAreaFluidSkeleton from "./TextArea.fluidSkeleton.test.svelte";
@@ -30,6 +31,15 @@ describe("TextArea", () => {
     expect(textarea.selectionEnd).toBe("hello world".length);
   });
 
+  it("keeps the selected value through the click's mouseup", async () => {
+    render(TextArea, {
+      props: { selectTextOnFocus: true, value: "hello world" },
+    });
+
+    const mouseup = await clickToFocus(screen.getByRole("textbox"));
+    expect(mouseup.defaultPrevented).toBe(true);
+  });
+
   it("does not select all text on focus when selectTextOnFocus is false (default)", async () => {
     render(TextArea, { props: { value: "hello world" } });
 
```

---

### Incident Patch 12: `f1417298` (2026-10-06)
**Commit Message**: fix(password-input): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup,
so clicking the field selected nothing in Safari. Keyboard focus
worked. Attach `preserveFocusSelection`, which cancels that mouseup.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +11/-1)
```diff
@@ -1,5 +1,9 @@
 <script>
-  import { CopyInput, TextInput } from "carbon-components-svelte";
+  import {
+    CopyInput,
+    PasswordInput,
+    TextInput,
+  } from "carbon-components-svelte";
 </script>
 
 <div style="display: grid; gap: 1rem; max-width: 24rem; padding: 1rem">
@@ -15,4 +19,10 @@
     selectTextOnFocus
     value="abcdef"
   />
+  <PasswordInput
+    data-testid="password-input"
+    labelText="Password input"
+    selectTextOnFocus
+    value="abcdef"
+  />
 </div>
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ import { expect, type Locator, test } from "@playwright/test";
 const cases: { testId: string; check?: "replace" }[] = [
   { testId: "copy-input" },
   { testId: "text-input" },
+  { testId: "password-input" },
 ];
 
 async function expectFullSelection(input: Locator) {
```

**File**: `src/TextInput/PasswordInput.svelte` (modified, +2/-0)
```diff
@@ -125,6 +125,7 @@
     resolveValidationVisibility,
   } from "../utils/field-status.js";
   import { formReset } from "../utils/form-reset.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { uniqueId } from "../utils/unique-id.js";
 
   const ctx = getContext(FORM_CONTEXT_KEY);
@@ -243,6 +244,7 @@
       {/if}
       <input
         bind:this={ref}
+        use:preserveFocusSelection={selectTextOnFocus && !disabled}
         use:formReset={handleFormReset}
         data-invalid={showInvalid || undefined}
         aria-invalid={showInvalid || undefined}
```

**File**: `tests/PasswordInput/PasswordInput.test.ts` (modified, +12/-0)
```diff
@@ -1,5 +1,6 @@
 import { fireEvent, render, screen } from "@testing-library/svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { user } from "../utils/user";
 import PasswordInputFluidForm from "./PasswordInput.fluidForm.test.svelte";
 import PasswordInputFluidSlot from "./PasswordInput.fluidSlot.test.svelte";
@@ -38,6 +39,17 @@ describe("PasswordInput", () => {
       expect(input.selectionEnd).toBe("secret123".length);
     });
 
+    it("keeps the selected value through the click's mouseup", async () => {
+      render(PasswordInput, {
+        labelText: "Password",
+        value: "secret123",
+        selectTextOnFocus: true,
+      });
+
+      const mouseup = await clickToFocus(screen.getByLabelText("Password"));
+      expect(mouseup.defaultPrevented).toBe(true);
+    });
+
     it("does not select all text on focus when selectTextOnFocus is false (default)", async () => {
       render(PasswordInput, {
         labelText: "Password",
```

---

### Incident Patch 13: `e22eca41` (2026-10-06)
**Commit Message**: fix(text-input): keep `selectTextOnFocus` selection after a click in Safari

WebKit collapses the select-on-focus selection on the click's mouseup,
so clicking the field selected nothing in Safari. Keyboard focus
worked. Attach `preserveFocusSelection`, which cancels that mouseup.

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (modified, +7/-1)
```diff
@@ -1,5 +1,5 @@
 <script>
-  import { CopyInput } from "carbon-components-svelte";
+  import { CopyInput, TextInput } from "carbon-components-svelte";
 </script>
 
 <div style="display: grid; gap: 1rem; max-width: 24rem; padding: 1rem">
@@ -9,4 +9,10 @@
     selectTextOnFocus
     value="abcdef"
   />
+  <TextInput
+    data-testid="text-input"
+    labelText="Text input"
+    selectTextOnFocus
+    value="abcdef"
+  />
 </div>
```

**File**: `e2e/select-text-on-focus.test.ts` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ import { expect, type Locator, test } from "@playwright/test";
 // expect it to replace the value.
 const cases: { testId: string; check?: "replace" }[] = [
   { testId: "copy-input" },
+  { testId: "text-input" },
 ];
 
 async function expectFullSelection(input: Locator) {
```

**File**: `src/TextInput/TextInput.svelte` (modified, +2/-0)
```diff
@@ -104,6 +104,7 @@
   } from "../utils/field-status.js";
   import { formReset } from "../utils/form-reset.js";
   import { graphemeCount } from "../utils/grapheme-count.js";
+  import { preserveFocusSelection } from "../utils/preserve-focus-selection.js";
   import { uniqueId } from "../utils/unique-id.js";
 
   const ctx = getContext(FORM_CONTEXT_KEY);
@@ -250,6 +251,7 @@
       {/if}
       <input
         bind:this={ref}
+        use:preserveFocusSelection={selectTextOnFocus && !disabled}
         use:formReset={handleFormReset}
         data-invalid={showInvalid || undefined}
         aria-invalid={showInvalid || undefined}
```

**File**: `tests/TextInput/TextInput.test.ts` (modified, +10/-0)
```diff
@@ -1,5 +1,6 @@
 import { fireEvent, render, screen } from "@testing-library/svelte";
 import { tick } from "svelte";
+import { clickToFocus } from "../utils/click-to-focus";
 import { isSvelte5 } from "../utils/svelte-version";
 import { user } from "../utils/user";
 import TextInputFluidForm from "./TextInput.fluidForm.test.svelte";
@@ -68,6 +69,15 @@ describe("TextInput", () => {
     expect(input.selectionEnd).toBe("hello world".length);
   });
 
+  it("keeps the selected value through the click's mouseup", async () => {
+    render(TextInput, {
+      props: { selectTextOnFocus: true, value: "hello world" },
+    });
+
+    const mouseup = await clickToFocus(screen.getByLabelText("User name"));
+    expect(mouseup.defaultPrevented).toBe(true);
+  });
+
   it("does not select all text on focus when selectTextOnFocus is false (default)", async () => {
     render(TextInput, { props: { value: "hello world" } });
 
```

**File**: `tests/utils/click-to-focus.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import { tick } from "svelte";
+
+/**
+ * Mimics a click that focuses `input`: mousedown, focus, then a cancelable
+ * mouseup once the component's select-on-focus has run. Returns the mouseup.
+ * jsdom never collapses the selection the way WebKit does, so assert that the
+ * mouseup was cancelled (`defaultPrevented`); the e2e suite covers WebKit.
+ */
+export async function clickToFocus(input: HTMLElement) {
+  input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
+  input.focus();
+  await tick();
+  const mouseup = new MouseEvent("mouseup", {
+    bubbles: true,
+    cancelable: true,
+  });
+  input.dispatchEvent(mouseup);
+  return mouseup;
+}
```

---

### Incident Patch 14: `f7eee752` (2026-10-06)
**Commit Message**: test(e2e): move the CopyInput select-on-focus check to a shared fixture

Every input with `selectTextOnFocus` hits the same WebKit mouseup
collapse, so give them one fixture page and one case table instead
of a page per component. CopyInput is the first case.

**File**: `e2e/copy-input.test.ts` (removed, +0/-24)
```diff
@@ -1,24 +0,0 @@
-import { expect, test } from "@playwright/test";
-
-test.describe("CopyInput", () => {
-  test.beforeEach(async ({ page }) => {
-    await page.goto("/copy-input.html");
-  });
-
-  // WebKit collapses a focus-time `select()` on mouseup; jsdom can't show it.
-  test("selectTextOnFocus keeps the full value selected after a click", async ({
-    page,
-  }) => {
-    const input = page.getByTestId("copy-input-select");
-    await input.click();
-
-    await expect
-      .poll(() =>
-        input.evaluate((el: HTMLInputElement) => [
-          el.selectionStart,
-          el.selectionEnd,
-        ]),
-      )
-      .toEqual([0, "https://api.acme.io/v1".length]);
-  });
-});
```

**File**: `e2e/fixtures/CopyInputFixture.svelte` (removed, +0/-10)
```diff
@@ -1,10 +0,0 @@
-<script>
-  import { CopyInput } from "carbon-components-svelte";
-</script>
-
-<CopyInput
-  data-testid="copy-input-select"
-  labelText="API endpoint"
-  selectTextOnFocus
-  value="https://api.acme.io/v1"
-/>
```

**File**: `e2e/fixtures/SelectTextOnFocusFixture.svelte` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+<script>
+  import { CopyInput } from "carbon-components-svelte";
+</script>
+
+<div style="display: grid; gap: 1rem; max-width: 24rem; padding: 1rem">
+  <CopyInput
+    data-testid="copy-input"
+    labelText="Copy input"
+    selectTextOnFocus
+    value="abcdef"
+  />
+</div>
```

**File**: `e2e/fixtures/copy-input.ts` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-import CopyInputFixture from "./CopyInputFixture.svelte";
-import { mount } from "./mount";
-
-mount(CopyInputFixture);
```

**File**: `e2e/fixtures/select-text-on-focus.html` (renamed, +2/-2)
```diff
@@ -3,10 +3,10 @@
   <head>
     <meta charset="UTF-8">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
-    <title>CopyInput Test</title>
+    <title>selectTextOnFocus Test</title>
   </head>
   <body>
     <div id="app"></div>
-    <script type="module" src="./copy-input.ts"></script>
+    <script type="module" src="./select-text-on-focus.ts"></script>
   </body>
 </html>
```

**File**: `e2e/fixtures/select-text-on-focus.ts` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+import { mount } from "./mount";
+import SelectTextOnFocusFixture from "./SelectTextOnFocusFixture.svelte";
+
+mount(SelectTextOnFocusFixture);
```

**File**: `e2e/select-text-on-focus.test.ts` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import { expect, type Locator, test } from "@playwright/test";
+
+// WebKit collapses a focus-time `select()` on the click's mouseup, so each
+// case clicks into the field and checks the whole value is still selected.
+// jsdom can't show this, and CI runs Chromium only: run WebKit locally.
+// `number` inputs expose no selection API, so those cases type a digit and
+// expect it to replace the value.
+const cases: { testId: string; check?: "replace" }[] = [
+  { testId: "copy-input" },
+];
+
+async function expectFullSelection(input: Locator) {
+  await expect
+    .poll(() =>
+      input.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => ({
+        start: el.selectionStart,
+        wholeValue: el.value.length > 0 && el.selectionEnd === el.value.length,
+      })),
+    )
+    .toEqual({ start: 0, wholeValue: true });
+}
+
+test.describe("selectTextOnFocus", () => {
+  test.beforeEach(async ({ page }) => {
+    await page.goto("/select-text-on-focus.html");
+  });
+
+  for (const { testId, check } of cases) {
+    test(`${testId} keeps the full value selected after a click`, async ({
+      page,
+    }) => {
+      const input = page.getByTestId(testId);
+      await input.click();
+
+      if (check === "replace") {
+        await page.keyboard.type("9");
+        await expect(input).toHaveValue("9");
+      } else {
+        await expectFullSelection(input);
+      }
+    });
+  }
+});
```

---

### Incident Patch 15: `8d1f321a` (2026-10-04)
**Commit Message**: fix(copy-input): keep a hover-revealed value visible over the copy button

`revealMode="hover-focus"` tracked hover on the input alone. The copy
button overlaps the input's right edge, so moving toward it fired
mouseleave and re-obscured the value just before the click in
Chromium and Firefox, while WebKit kept it revealed. Track hover on
the field wrapper, which contains both, so every engine agrees.

**File**: `src/CopyInput/CopyInput.svelte` (modified, +5/-2)
```diff
@@ -231,9 +231,14 @@
     class:bx--text-input__field-outer-wrapper={true}
     class:bx--text-input__field-outer-wrapper--inline={inline}
   >
+    <!-- Hover spans the copy button, which overlaps the input's right edge,
+         so reaching for it does not re-obscure the value. -->
+    <!-- svelte-ignore a11y-no-static-element-interactions -->
     <div
       class:bx--text-input__field-wrapper={true}
       class:bx--copy-input__field-wrapper={true}
+      on:mouseenter={() => (hovered = true)}
+      on:mouseleave={() => (hovered = false)}
     >
       <input
         bind:this={ref}
@@ -254,8 +259,6 @@
         on:focus={handleFocus}
         on:blur
         on:blur={handleBlur}
-        on:mouseenter={() => (hovered = true)}
-        on:mouseleave={() => (hovered = false)}
       >
       {#if isFluid}
         <hr class:bx--text-input__divider={true}>
```

**File**: `tests/CopyInput/CopyInput.test.ts` (modified, +28/-9)
```diff
@@ -10,6 +10,12 @@ import CopyInputAsyncDoubleClick from "./CopyInputAsyncDoubleClick.test.svelte";
 import CopyInputMouseEnter from "./CopyInputMouseEnter.test.svelte";
 import CopyInputMultiple from "./CopyInputMultiple.test.svelte";
 
+const getFieldWrapper = (input: HTMLElement) => {
+  const fieldWrapper = input.closest(".bx--copy-input__field-wrapper");
+  assert(fieldWrapper);
+  return fieldWrapper;
+};
+
 describe("CopyInput", () => {
   beforeEach(() => {
     Object.defineProperty(navigator, "clipboard", {
@@ -109,7 +115,7 @@ describe("CopyInput", () => {
 
     const input = screen.getByLabelText("API token");
 
-    await fireEvent.mouseEnter(input);
+    await fireEvent.mouseEnter(getFieldWrapper(input));
     expect(input).toHaveAttribute("type", "password");
   });
 
@@ -121,10 +127,10 @@ describe("CopyInput", () => {
     const input = screen.getByLabelText("API token");
     expect(input).toHaveAttribute("type", "password");
 
-    await fireEvent.mouseEnter(input);
+    await fireEvent.mouseEnter(getFieldWrapper(input));
     expect(input).toHaveAttribute("type", "text");
 
-    await fireEvent.mouseLeave(input);
+    await fireEvent.mouseLeave(getFieldWrapper(input));
     expect(input).toHaveAttribute("type", "password");
 
     await fireEvent.focus(input);
@@ -140,20 +146,33 @@ describe("CopyInput", () => {
     });
 
     const input = screen.getByLabelText("API token");
-    await fireEvent.mouseEnter(input);
+    await fireEvent.mouseEnter(getFieldWrapper(input));
+    expect(input).toHaveAttribute("type", "password");
+  });
+
+  it("keeps a hover-revealed value visible over the copy button", async () => {
+    render(CopyInput, {
+      props: { type: "password", revealMode: "hover-focus" },
+    });
+
+    const input = screen.getByLabelText("API token");
+    await user.hover(input);
+    expect(input).toHaveAttribute("type", "text");
+
+    const button = screen.getByRole("button", { name: "Copy to clipboard" });
+    await user.hover(button);
+    expect(input).toHaveAttribute("type", "text");
+
+    await user.unhover(button);
     expect(input).toHaveAttribute("type", "password");
   });
 
   it("does not reveal the obscured value on hover when revealMode is unset", async () => {
     render(CopyInput, { props: { type: "password" } });
 
     const input = screen.getByLabelText("API token");
-    const fieldWrapper = input.closest(".bx--copy-input__field-wrapper");
-    assert(fieldWrapper);
-    expect(fieldWrapper).toBeInTheDocument();
 
-    await fireEvent.mouseEnter(input);
-    await fireEvent.mouseEnter(fieldWrapper);
+    await fireEvent.mouseEnter(getFieldWrapper(input));
     expect(input).toHaveAttribute("type", "password");
   });
 
```

#### Recent Merged Pull Requests:
- **PR #4177** (2026-10-06): test: run DOM tests in the vmThreads pool (@metonym)
- **PR #4176** (2026-10-06): fix(copy-button): announce copy feedback to screen readers (@metonym)
- **PR #4173** (2026-10-06): fix(tabs): sync TabsVertical keyboard orientation with its layout (@metonym)
- **PR #4170** (2026-10-04): fix(expandable-tile): forward focus and blur from the chevron button (@metonym)
- **PR #4169** (2026-10-06): fix(radio-tile): let Space reach the native radio (@metonym)
- **PR #4167** (2026-10-05): fix(list-box): let Escape reach a parent Modal when the menu is closed (@metonym)
- **PR #4165** (2026-10-02): fix(date-picker): close the gap above an inline calendar (@metonym)
- **PR #4163** (2026-10-02): fix(date-picker): keep arrow keys off days blocked by range limits (@metonym)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
