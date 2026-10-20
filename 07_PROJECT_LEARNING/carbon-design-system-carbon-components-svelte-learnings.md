> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/carbon-design-system-carbon-components-svelte-learnings.md`  
> **Source**: github ([https://github.com/carbon-design-system/carbon-components-svelte](https://github.com/carbon-design-system/carbon-components-svelte))  
> **Source Version**: `ea62be52`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T16:27:43.252Z  
> **Learning ID**: `learn-github-carbon-design-system-carbon-components-svelte`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): carbon-design-system/carbon-components-svelte

> **Canonical Artifact**: `07_PROJECT_LEARNING/carbon-design-system-carbon-components-svelte-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/carbon-design-system/carbon-components-svelte](https://github.com/carbon-design-system/carbon-components-svelte))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T16:27:42.298Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `carbon-design-system/carbon-components-svelte`
- **Description**: Svelte implementation of the Carbon Design System
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2918 stars

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

/**
 * Handle the `invalid` event of a required list box's validated input.
 * Returns whether the field should show its invalid state: after a submit
 * attempt, not when code calls `checkValidity()`. On a submit attempt, the
 * field is focused if it's the first invalid control in the form.
 */
export declare function handleRequiredInvalid(
  event: Event,
  options: {
    focusTarget: HTMLElement | null | undefined;
    /** Cancel the event even when no state shows, for a hidden proxy input. */
    proxy?: boolean;
  },
): boolean;

```

### Core Architecture Module: `src/ListBox/list-box-utils.js`
```
// @ts-check

import { isSubmitAttempt } from "../utils/submit-attempt.js";
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

/**
 * Whether `control` is invalid in a way the user should see: during a
 * submit attempt, or once the browser has flagged it `:user-invalid` (after
 * any submit attempt, including `requestSubmit()`, or an edit). A plain
 * `checkValidity()` call fires `invalid` too, and must not show errors.
 *
 * @param {HTMLInputElement} control
 * @returns {boolean}
 */
function isUserInvalid(control) {
  if (isSubmitAttempt(control.form)) return true;
  try {
    return control.matches(":user-invalid");
  } catch {
    return false;
  }
}

/**
 * Handle the `invalid` event of a required list box's validated input.
 *
 * Returns whether the field should show its invalid state: after a submit
 * attempt, not when code calls `checkValidity()`. In that case the
 * browser's error bubble is cancelled, since the field shows Carbon's state
 * instead. On a submit attempt, the field is also focused if it's the
 * first invalid control in the form, after the browser has focused any
 * other invalid control whose bubble wasn't cancelled.
 *
 * A `proxy` input (hidden, validating for a list box) is cancelled even
 * when no state shows, so the browser never focuses or anchors a bubble
 * to it.
 *
 * @param {Event} event The `invalid` event.
 * @param {{ focusTarget: HTMLElement | null | undefined; proxy?: boolean }} options
 * @returns {boolean}
 */
export function handleRequiredInvalid(event, { focusTarget, proxy = false }) {
  const input = /** @type {HTMLInputElement} */ (event.target);
  const show = isUserInvalid(input);
  if (show || proxy) event.preventDefault();
  if (!show) return false;

  if (isSubmitAttempt(input.form)) {
    const firstInvalid = input.form
      ? Array.from(input.form.elements).find(
          (element) =>
            /** @type {HTMLInputElement} */ (element).willValidate &&
            !(/** @type {HTMLInputElement} */ (element).validity.valid),
        )
      : input;
    if (firstInvalid === input) {
      setTimeout(() => {
        if (focusTarget?.isConnected) focusTarget.focus();
      });
    }
  }
  return true;
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

### Core Architecture Module: `src/utils/active-section.d.ts`
```
/**
 * The id of the last section whose top has crossed the activation line:
 * `offset` pixels (default: the container's `scroll-padding-top`) from the
 * top of the scroll container, then `line` (0–1, default 0) of the way down
 * the rest of its visible height. The first before any cross, the last once
 * the container is scrolled to its end.
 */
export function getActiveSectionId(
  ids: ReadonlyArray<string>,
  options?: { container?: HTMLElement | null; offset?: number; line?: number },
): string | undefined;

/**
 * Scroll only `container` (or the window) so `target`'s top sits below the
 * scroller's `scroll-padding-top` plus its own `scroll-margin-top`, as a
 * native hash jump does, or `offset` pixels below the top if larger.
 */
export function scrollToSection(
  target: HTMLElement,
  options?: { container?: HTMLElement | null; offset?: number },
): void;

/**
 * Focus `target` without scrolling, as a native hash jump does, adding
 * `tabindex="-1"` until it loses focus if it isn't focusable.
 */
export function focusSection(target: HTMLElement): void;

/**
 * Scroll `item` into view within its nearest scrollable ancestor that
 * doesn't also contain `section`. Never scrolls the page.
 */
export function revealItem(item: HTMLElement, section: HTMLElement): void;

```

### Core Architecture Module: `src/utils/active-section.js`
```
// @ts-check

/**
 * The element that scrolls for `container`, or the document's when `null`.
 *
 * @param {HTMLElement | null} container
 * @returns {Element}
 */
function getScroller(container) {
  return container ?? document.scrollingElement ?? document.documentElement;
}

/**
 * A computed `scroll-padding-top` or `scroll-margin-top` in pixels.
 * Percentages resolve against `height`; `auto` is 0.
 *
 * @param {string} value
 * @param {number} height
 * @returns {number}
 */
function toPixels(value, height) {
  const number = Number.parseFloat(value);
  if (Number.isNaN(number)) return 0;
  return value.endsWith("%") ? (number / 100) * height : number;
}

/**
 * The `scroll-padding-top` of `container`, or of the document when `null`,
 * in pixels.
 *
 * @param {HTMLElement | null} container
 * @returns {number}
 */
function getScrollPaddingTop(container) {
  const scroller = getScroller(container);
  return toPixels(
    getComputedStyle(scroller).scrollPaddingTop,
    scroller.clientHeight,
  );
}

/**
 * Whether `container` (or the document, when `null`) is scrolled to its end.
 * A container that cannot scroll is never at its end, so a short page keeps
 * the first section active instead of jumping to the last.
 *
 * @param {HTMLElement | null} container
 * @returns {boolean}
 */
function isScrolledToEnd(container) {
  const element = getScroller(container);
  const max = element.scrollHeight - element.clientHeight;
  return max > 0 && element.scrollTop >= max - 1;
}

/**
 * The id of the section a reader is looking at: the last target, in the
 * order given, whose top has crossed the activation line. The line sits
 * `offset` pixels from the top of the scroll container, then `line` of the
 * way down the rest of its visible height: `0` (the default) at the offset,
 * `0.5` halfway down, `1` at the bottom edge, so a section counts as soon as
 * it scrolls into view. `offset` defaults to the container's
 * `scroll-padding-top`, where a native hash jump lands a section. Before the
 * first target crosses, the first is active; once the container is scrolled
 * to its end, the last is, since short trailing sections can never reach the
 * line. Ids with no element are skipped.
 *
 * @param {ReadonlyArray<string>} ids Section ids in document order
 * @param {{ container?: HTMLElement | null; offset?: number; line?: number }} [options]
 * @returns {string | undefined}
 */
export function getActiveSectionId(
  ids,
  { container = null, offset = getScrollPaddingTop(container), line = 0 } = {},
) {
  /** @type {Array<{ id: string; element: HTMLElement }>} */
  const targets = [];
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element) targets.push({ id, element });
  }
  if (targets.length === 0) return undefined;
  if (isScrolledToEnd(container)) return targets[targets.length - 1].id;

  const rootTop = container ? container.getBoundingClientRect().top : 0;
  const height = getScroller(container).clientHeight;
  const fraction = Math.min(Math.max(line, 0), 1);
  const lineTop = offset + fraction * Math.max(height - offset, 0);
  let active = targets[0].id;
  for (const { id, element } of targets) {
    // 1px of slack: anchor jumps can land a fraction of a pixel short.
    if (element.getBoundingClientRect().top - rootTop > lineTop + 1) break;
    active = id;
  }
  return active;
}

/**
 * Scroll `container` (or the window, when `null`) so `target`'s top sits
 * where a native hash jump would put it: below the scroller's
 * `scroll-padding-top` plus the target's `scroll-margin-top`, or `offset`
 * pixels below the container's top when that is larger. Only that one
 * scroller moves; the smoothness follows its CSS `scroll-behavior`, as a
 * native hash jump does.
 *
 * @param {HTMLElement} target
 * @param {{ container?: HTMLElement | null; offset?: number }} [options]
 */
export function scrollToSection(target, { container = null, offset = 0 } = {}) {
  const padding = getScrollPaddingTop(container);
  const margin = toPixels(
    getComputedStyle(target).scrollMarginTop,
    getScroller(container).clientHeight,
  );
  const inset = Math.max(offset, padding + margin);
  const targetTop = target.getBoundingClientRect().top;

  if (container) {
    const rootTop = container.getBoundingClientRect().top;
    container.scrollTo({
      top: container.scrollTop + targetTop - rootTop - inset,
    });
  } else {
    window.scrollTo({ top: window.scrollY + targetTop - inset });
  }
}

/**
 * Focus `target` without scrolling, as a native hash jump moves the
 * sequential focus navigation starting point, so the next Tab continues from
 * the section. A section that isn't focusable gets `tabindex="-1"` until it
 * loses focus.
 *
 * @param {HTMLElement} target
 */
export function focusSection(target) {
  const added = target.tabIndex < 0 && !target.hasAttribute("tabindex");
  if (added) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  if (!added) return;
  if (document.activeElement === target) {
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), {
      once: true,
    });
  } else {
    target.removeAttribute("tabindex");
  }
}

const SCROLLABLE_OVERFLOW = /(auto|scroll)/;

/**
 * Scroll `item` into view, as `block: "nearest"` would, within its nearest
 * scrollable ancestor that doesn't also contain `section`, such as a sticky
 * sidebar that overflows. An ancestor that contains the section scrolls the
 * page, so the search stops there and the page never moves.
 *
 * @param {HTMLElement} item
 * @param {HTMLElement} section
 */
export function revealItem(item, section) {
  for (
    let element = item.parentElement;
    element && element !== document.body && !element.contains(section);
    element = element.parentElement
  ) {
    if (element.scrollHeight <= element.clientHeight) continue;
    if (!SCROLLABLE_OVERFLOW.test(getComputedStyle(element).overflowY)) {
      continue;
    }
    const itemRect = item.getBoundingClientRect();
    const rootRect = element.getBoundingClientRect();
    if (itemRect.top < rootRect.top) {
      element.scrollTop -= rootRect.top - itemRect.top;
    } else if (itemRect.bottom > rootRect.bottom) {
      element.scrollTop += itemRect.bottom - rootRect.bottom;
    }
    return;
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4774** (2026-10-20): **fix(toast-notification): omit the title heading when there is no title**
  *Symptoms*: A toast with no `title` still rendered an empty `<h3>`, which screen readers can announce as a blank heading. InlineNotification and Carbon v11 already render the title only when it is set.  Render the heading only for a `title` or `titleChildren` slot. The empty heading supplied the details' top margin, so a subtitle or caption that comes first now takes that margin itself.   Stacked on #4773. 

- **Issue #4773** (2026-10-20): **fix(notification): return focus when the queue removes a focused toast**
  *Symptoms*: 76c03d386 returns focus after closing a focused notification, but only on the close path. A programmatic `remove(id)` or `clear()` unmounted the toast without that step, so focus dropped to `<body>` and the next Tab could escape a surrounding Modal.  Track whether focus is inside and restore it on unmount. The root may already be detached by then, so a `contains(activeElement)` check is too late. Chrome also fires `focusout` while removing the focused node, before the unmount cleanup, so the flag settles in a microtask.   Stacked on #4772. 

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

### Incident Patch 1: `e1521d5e` (2026-10-20)
**Commit Message**: fix(local-storage, session-storage): stop writing back remote values

When another tab wrote valid JSON in a non-canonical form, such as
`{ "a": 1 }`, the component wrote it back as `{"a":1}` and dispatched
`update` a second time. The handler kept the raw event string as the
last-written form, so the write block saw the re-serialized value as a
local change and persisted it, rewriting the other tab's data.

Track the re-serialized value instead, as the removal branch does.

**File**: `src/LocalStorage/StorageBinding.svelte` (modified, +3/-1)
```diff
@@ -57,7 +57,9 @@
       prevSerialized = serializeStoredValue(value);
     } else {
       value = parseStoredValue(event.newValue);
-      prevSerialized = event.newValue;
+      // Not `event.newValue`: non-canonical JSON (e.g. `{ "a": 1 }`) would
+      // differ from the re-serialized value and get written back.
+      prevSerialized = serializeStoredValue(value);
     }
 
     dispatch("update", { prevValue, value });
```

**File**: `tests/LocalStorage/StorageBinding.test.ts` (modified, +24/-0)
```diff
@@ -65,4 +65,28 @@ describe("StorageBinding", () => {
       expect(component.value).toBeUndefined();
     },
   );
+
+  it.each(cases)(
+    "$name does not write back a remote value",
+    async ({ Component, area }) => {
+      const onUpdate = vi.fn();
+      render(StorageBinding, {
+        props: { Component, key: "k", value: "initial", onUpdate },
+      });
+      await tick();
+
+      // Valid JSON that re-serializes differently ('{"a":1}').
+      window[area].setItem("k", '{ "a": 1 }');
+      fireStorageEvent({
+        key: "k",
+        newValue: '{ "a": 1 }',
+        storageArea: window[area],
+      });
+      await tick();
+      await tick();
+
+      expect(window[area].getItem("k")).toBe('{ "a": 1 }');
+      expect(onUpdate).toHaveBeenCalledTimes(1);
+    },
+  );
 });
```

---

### Incident Patch 2: `d575a9eb` (2026-10-20)
**Commit Message**: fix(notification): return focus when the queue removes a focused toast

76c03d386 returns focus after closing a focused notification, but only
on the close path. A programmatic `remove(id)` or `clear()` unmounted
the toast without that step, so focus dropped to `<body>` and the next
Tab could escape a surrounding Modal.

Track whether focus is inside and restore it on unmount. The root may
already be detached by then, so a `contains(activeElement)` check is
too late. Chrome also fires `focusout` while removing the focused node,
before the unmount cleanup, so the flag settles in a microtask.

**File**: `e2e/fixtures/NotificationQueueFixture.svelte` (modified, +6/-0)
```diff
@@ -4,6 +4,12 @@
   let queue;
 </script>
 
+<svelte:window
+  on:keydown={(e) => {
+    if (e.key === "Delete") queue?.clear();
+  }}
+/>
+
 <div data-testid="notification-queue-root">
   <NotificationQueue bind:this={queue} maxNotifications={2} />
   <Button
```

**File**: `e2e/notification-queue.test.ts` (modified, +9/-0)
```diff
@@ -43,4 +43,13 @@ test.describe("NotificationQueue", () => {
     await toast.getByRole("button", { name: "Close notification" }).click();
     await expect(toast).toHaveCount(0);
   });
+
+  test("clear returns focus from a focused toast", async ({ page }) => {
+    const add = page.getByTestId("nq-add");
+    await add.click();
+    await page.getByRole("button", { name: "Close notification" }).focus();
+    await page.keyboard.press("Delete");
+    await expect(page.locator(".bx--toast-notification")).toHaveCount(0);
+    await expect(add).toBeFocused();
+  });
 });
```

**File**: `src/utils/dismissible-notification.js` (modified, +24/-2)
```diff
@@ -49,6 +49,7 @@ export function createDismissibleNotification({
   /** @type {Element | null} */
   let root = null;
   let wasOpen = false;
+  let focusInside = false;
 
   /**
    * Remember where focus came from when it enters from outside, so closing
@@ -57,6 +58,7 @@ export function createDismissibleNotification({
    */
   function trackFocusIn(event) {
     handleFocusIn();
+    focusInside = true;
     const current = event.currentTarget;
     if (!(current instanceof Element)) return;
     root = current;
@@ -66,6 +68,20 @@ export function createDismissibleNotification({
     }
   }
 
+  /**
+   * @param {FocusEvent} event
+   */
+  function trackFocusOut(event) {
+    handleFocusOut(event);
+    const next = event.relatedTarget;
+    if (next instanceof Node && root?.contains(next)) return;
+    // Chrome also fires `focusout` while removing the focused node, before
+    // `dispose()` runs, so only settle the flag once the unmount is done.
+    queueMicrotask(() => {
+      focusInside = !!root?.contains(document.activeElement);
+    });
+  }
+
   function restoreFocus() {
     returnFocus(prevFocus, root);
     prevFocus = null;
@@ -115,7 +131,13 @@ export function createDismissibleNotification({
     handleMouseenter,
     handleMouseleave,
     handleFocusIn: trackFocusIn,
-    handleFocusOut,
-    dispose: dismiss.clear,
+    handleFocusOut: trackFocusOut,
+    // Unmounting while focused (e.g. a queue `remove()`/`clear()`) drops
+    // focus to `<body>`; by now the root may already be detached, so rely on
+    // the tracked flag rather than `root.contains(document.activeElement)`.
+    dispose() {
+      dismiss.clear();
+      if (focusInside) restoreFocus();
+    },
   };
 }
```

**File**: `tests/Notification/NotificationQueue.test.ts` (modified, +26/-0)
```diff
@@ -300,6 +300,32 @@ describe("NotificationQueue", () => {
     expect(screen.queryByText("Second notification")).not.toBeInTheDocument();
   });
 
+  it.each([
+    [
+      "remove",
+      (queue: NotificationQueueComponent, id: string) => queue.remove(id),
+    ],
+    ["clear", (queue: NotificationQueueComponent) => queue.clear()],
+  ] as const)(
+    "should return focus when %s unmounts a focused toast",
+    async (_, dismiss) => {
+      const { component } = render(NotificationQueueTest);
+      const before = document.createElement("button");
+      document.body.append(before);
+      onTestFinished(() => before.remove());
+
+      const id = getQueue(component.queue).add({ title: "Saved" });
+      await tick();
+      before.focus();
+      screen.getByRole("button", { name: "Close notification" }).focus();
+
+      dismiss(getQueue(component.queue), id);
+      await tick();
+
+      expect(before).toHaveFocus();
+    },
+  );
+
   it("should limit notifications to maxNotifications (top-right)", async () => {
     const { component } = render(NotificationQueueTest, {
       props: { maxNotifications: 2 },
```

---

### Incident Patch 3: `300313b8` (2026-10-20)
**Commit Message**: fix(notification): keep the timeout paused while hovered or focused

With `pauseOnHover`, hover and focus shared one paused flag, so tabbing
out while the pointer still rested on the toast resumed the timer.
Turning `pauseOnHover` off while paused left the toast open forever,
since the resume path bailed out once the prop was false. And a queue
`update(id, { timeout })` while hovered restarted the timer unpaused.

Track hover and focus separately and pause while either holds; resume
whenever neither does (or `pauseOnHover` is off). Re-apply that state
after the timer is resynced, and forget it when the notification
closes.

**File**: `src/utils/dismissible-notification.js` (modified, +15/-3)
```diff
@@ -35,8 +35,14 @@ export function createDismissibleNotification({
 }) {
   const dismiss = createTimeoutDismiss();
 
-  const { handleMouseenter, handleMouseleave, handleFocusIn, handleFocusOut } =
-    createHoverFocusPause(dismiss, getPauseOnHover);
+  const {
+    handleMouseenter,
+    handleMouseleave,
+    handleFocusIn,
+    handleFocusOut,
+    refresh,
+    reset,
+  } = createHoverFocusPause(dismiss, getPauseOnHover);
 
   /** @type {HTMLElement | null} */
   let prevFocus = null;
@@ -92,9 +98,15 @@ export function createDismissibleNotification({
   function sync(open, timeout) {
     // Also covers a consumer setting `open` to false (e.g. from an action
     // button), which skips `close()`.
-    if (wasOpen && !open) restoreFocus();
+    if (wasOpen && !open) {
+      restoreFocus();
+      reset();
+    }
     wasOpen = open;
     dismiss.sync(open, timeout, () => close(true));
+    // `dismiss.sync()` restarts the timer unpaused; keep it paused while
+    // the pointer or focus is still inside (e.g. a queue `update()`).
+    if (open) refresh();
   }
 
   return {
```

**File**: `src/utils/pause-on-hover-focus.d.ts` (modified, +4/-0)
```diff
@@ -3,6 +3,10 @@ export type HoverFocusPause = {
   handleMouseleave: (event: MouseEvent) => void;
   handleFocusIn: () => void;
   handleFocusOut: (event: FocusEvent) => void;
+  /** Re-applies the hover/focus state, e.g. after the timer restarts. */
+  refresh: () => void;
+  /** Forgets the hover/focus state, e.g. when the root unmounts. */
+  reset: () => void;
 };
 
 export function createHoverFocusPause(
```

**File**: `src/utils/pause-on-hover-focus.js` (modified, +41/-21)
```diff
@@ -6,11 +6,15 @@
  * `InlineNotification`, whose `pauseOnHover` mouse/focus handling was
  * previously duplicated verbatim.
  *
- * `focusout`/`mouseleave` only resume the timer once focus has actually left
- * the root: a `relatedTarget` still inside the root (tabbing, or the pointer
- * moving between two focusables) and the root still containing
- * `document.activeElement` (pointer leaving while a child keeps focus) both
- * block the resume.
+ * Hover and focus are tracked separately, so the timer stays paused until
+ * both the pointer and focus have left the root. A `relatedTarget` still
+ * inside the root (tabbing, or the pointer moving between two focusables)
+ * keeps focus inside, as does the root still containing
+ * `document.activeElement` when the pointer leaves.
+ *
+ * `refresh()` re-applies the current state, e.g. after `dismiss.sync()`
+ * restarted the timer unpaused. `reset()` forgets it when the root unmounts,
+ * which fires no `mouseleave`/`focusout`.
  *
  * @param {{ pause: () => void, resume: () => void }} dismiss
  * @param {() => boolean} getPauseOnHover
@@ -19,9 +23,14 @@
  *   handleMouseleave: (event: MouseEvent) => void,
  *   handleFocusIn: () => void,
  *   handleFocusOut: (event: FocusEvent) => void,
+ *   refresh: () => void,
+ *   reset: () => void,
  * }}
  */
 export function createHoverFocusPause(dismiss, getPauseOnHover) {
+  let hovered = false;
+  let focused = false;
+
   /**
    * @param {MouseEvent | FocusEvent} event
    */
@@ -33,28 +42,39 @@ export function createHoverFocusPause(dismiss, getPauseOnHover) {
     );
   }
 
-  /**
-   * @param {MouseEvent | FocusEvent} event
-   */
-  function resumeUnlessStillInside(event) {
-    if (!getPauseOnHover() || pointerInside(event)) return;
-    if (
-      event.currentTarget instanceof Node &&
-      event.currentTarget.contains(document.activeElement)
-    ) {
-      return;
-    }
-    dismiss.resume();
+  // Also resumes when `pauseOnHover` was turned off while paused.
+  function apply() {
+    if (getPauseOnHover() && (hovered || focused)) dismiss.pause();
+    else dismiss.resume();
   }
 
   return {
     handleMouseenter() {
-      if (getPauseOnHover()) dismiss.pause();
+      hovered = true;
+      apply();
+    },
+    handleMouseleave(event) {
+      hovered = false;
+      if (
+        event.currentTarget instanceof Node &&
+        event.currentTarget.contains(document.activeElement)
+      ) {
+        focused = true;
+      }
+      apply();
     },
-    handleMouseleave: resumeUnlessStillInside,
     handleFocusIn() {
-      if (getPauseOnHover()) dismiss.pause();
+      focused = true;
+      apply();
+    },
+    handleFocusOut(event) {
+      focused = pointerInside(event);
+      apply();
+    },
+    refresh: apply,
+    reset() {
+      hovered = false;
+      focused = false;
     },
-    handleFocusOut: resumeUnlessStillInside,
   };
 }
```

**File**: `tests/Notification/NotificationQueue.test.ts` (modified, +20/-1)
```diff
@@ -1,4 +1,4 @@
-import { render, screen } from "@testing-library/svelte";
+import { fireEvent, render, screen } from "@testing-library/svelte";
 import type NotificationButtonComponent from "carbon-components-svelte/Notification/NotificationButton.svelte";
 import type NotificationQueueComponent from "carbon-components-svelte/Notification/NotificationQueue.svelte";
 import type { ComponentProps } from "svelte";
@@ -504,6 +504,25 @@ describe("NotificationQueue", () => {
     expect(screen.queryByText("Test notification")).not.toBeInTheDocument();
   });
 
+  it("should stay paused when the timeout is updated while hovered", async () => {
+    const { component } = render(NotificationQueueTest);
+
+    const id = getQueue(component.queue).add({
+      title: "Uploading",
+      timeout: 1000,
+      pauseOnHover: true,
+    });
+    await tick();
+
+    await fireEvent.mouseEnter(screen.getByRole("alert"));
+    getQueue(component.queue).update(id, { timeout: 2000 });
+    await tick();
+    vi.advanceTimersByTime(3000);
+    await tick();
+
+    expect(screen.getByText("Uploading")).toBeInTheDocument();
+  });
+
   it("should handle persistent notifications without timeout", async () => {
     const { component } = render(NotificationQueueTest);
 
```

**File**: `tests/utils/pause-on-hover-focus.test.ts` (modified, +35/-0)
```diff
@@ -56,6 +56,41 @@ describe("createHoverFocusPause", () => {
     expect(dismiss.resume).not.toHaveBeenCalled();
   });
 
+  it("resumes on mouseleave after pauseOnHover is turned off while paused", () => {
+    const dismiss = fakeDismiss();
+    let pauseOnHover = true;
+    const { handleMouseenter, handleMouseleave } = createHoverFocusPause(
+      dismiss,
+      () => pauseOnHover,
+    );
+    const root = document.createElement("div");
+
+    handleMouseenter();
+    pauseOnHover = false;
+    const event = new MouseEvent("mouseleave", {
+      relatedTarget: document.body,
+    });
+    Object.defineProperty(event, "currentTarget", { value: root });
+    handleMouseleave(event);
+
+    expect(dismiss.resume).toHaveBeenCalledTimes(1);
+  });
+
+  it("does not resume when focus leaves while the pointer is still over the root", () => {
+    const dismiss = fakeDismiss();
+    const { handleMouseenter, handleFocusIn, handleFocusOut } =
+      createHoverFocusPause(dismiss, () => true);
+    const root = document.createElement("div");
+
+    handleMouseenter();
+    handleFocusIn();
+    const event = new FocusEvent("focusout", { relatedTarget: document.body });
+    Object.defineProperty(event, "currentTarget", { value: root });
+    handleFocusOut(event);
+
+    expect(dismiss.resume).not.toHaveBeenCalled();
+  });
+
   it("does not resume when the root still contains document.activeElement", () => {
     const dismiss = fakeDismiss();
     const { handleMouseleave } = createHoverFocusPause(dismiss, () => true);
```

#### Recent Merged Pull Requests:
- **PR #4782** (2026-10-20): test(pagination-nav): shrink the window-size sweep (@metonym)
- **PR #4781** (2026-10-20): test: cover notification, tooltip, storage and tag gaps (@metonym)
- **PR #4780** (2026-10-20): chore(tests): share notification, tooltip and storage test suites (@metonym)
- **PR #4779** (2026-10-20): test: prune duplicate notification, tooltip, storage and tag tests (@metonym)
- **PR #4778** (2026-10-20): test: make notification, tooltip, storage and tag tests fail when broken (@metonym)
- **PR #4775** (2026-10-20): docs(toast-notification): note that the title is optional too (@metonym)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. local-storage, session-storage): stop writing back remote values

**RULE**:
When implementing operations in `src/LocalStorage/StorageBinding.svelte`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in carbon-design-system/carbon-components-svelte. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e1521d5e`: local-storage, session-storage): stop writing back remote values. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/LocalStorage/StorageBinding.svelte`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      // Not `event.newValue`: non-canonical JSON (e.g. `{ "a": 1 }`) would
      // differ from the re-serialized value and get written back.
      prevSerialized = serializeStoredValue(value);
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
      prevSerialized = event.newValue;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e1521d5e` are properly handled with clean fallback behavior.
