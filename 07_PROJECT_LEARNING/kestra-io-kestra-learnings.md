# Forensic Learning Record (Deep Inspection): kestra-io/kestra

> **Canonical Artifact**: `07_PROJECT_LEARNING/kestra-io-kestra-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kestra-io/kestra](https://github.com/kestra-io/kestra))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:35:31.871Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kestra-io/kestra`
- **Description**: Event Driven Orchestration & Scheduling Platform for Mission Critical Applications
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 29265 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ui/lint-rules/utils.js`
```
// Globals whose replacement the runtime leak guard (tests/unit/leakGuard.ts) watches.
// Keep the two lists in sync: lint catches the authoring mistake, the guard catches the rest.
export const WATCHED_GLOBALS = new Set([
    "Image", "EventSource", "fetch", "WebSocket", "XMLHttpRequest",
    "IntersectionObserver", "ResizeObserver", "matchMedia", "DOMMatrix",
    "requestAnimationFrame", "navigator", "location", "history",
    "Date", "crypto", "Notification", "localStorage", "sessionStorage",
])

const GLOBAL_OBJECTS = new Set(["window", "globalThis", "global"])

/** True for `vi.<name>(...)`. */
export function isViCall(node, name) {
    return "CallExpression" === node.type
        && "MemberExpression" === node.callee.type
        && !node.callee.computed
        && "Identifier" === node.callee.object.type
        && "vi" === node.callee.object.name
        && "Identifier" === node.callee.property.type
        && name === node.callee.property.name
}

/** For `window.matchMedia` / `globalThis.fetch`, returns the property name. */
export function globalPropertyName(node) {
    if ("MemberExpression" !== node.type || node.computed) return undefined
    if ("Identifier" !== node.object.type || !GLOBAL_OBJECTS.has(node.object.name)) return undefined
    return "Identifier" === node.property.type ? node.property.name : undefined
}

/** True when the node sits at module scope rather than inside any function body. */
export function isModuleScope(sourceCode, node) {
    return !sourceCode.getAncestors(node).some((ancestor) => ancestor.type.includes("Function"))
}

/** True when the file imports `vi` from vitest, so a `vi.*` autofix is safe to apply. */
export function createViImportTracker() {
    let imported = false
    return {
        visitImport(node) {
            if ("vitest" !== node.source.value) return
            if (node.specifiers.some((specifier) => "ImportSpecifier" === specifier.type && "vi" === specifier.imported.name)) {
                imported = true
            }
        },
        isImported: () => imported,
    }
}

```

### Core Architecture Module: `ui/packages/design-system/src/components/Data/KsDataTable/filter/utils/constants.ts`
```
/**
 * Shared constants for filter URL handling. Extracted from inline literals scattered across the
 * filter codebase to keep the magic strings in one place.
 */

/** Route query key for the freeform search input (the `q` chip). */
export const SEARCH_QUERY_KEY = "filters[q][EQUALS]"

/** Filter-key shorthand for the timeRange chip (split into startDate/endDate on the wire). */
export const TIME_RANGE_KEY = "timeRange"

/** Route query key that carries the dateFilter meta selector for timeRange. */
export const DATE_FILTER_KEY = "dateFilter"

/**
 * Maximum number of `[and|or][N]` prefix segments the chip UI can render.
 * The chip UI supports a top-level group plus one wrapper inside it (2 segments).
 * A wrapper containing another wrapper (3+ segments) falls back to the raw editor.
 */
export const MAX_RENDERABLE_NESTING_DEPTH = 2

/** Date-field keys that are encoded separately on the wire from the timeRange chip. */
export const START_DATE_FIELD = "startDate"
export const END_DATE_FIELD = "endDate"

/**
 * Vertical slack within which two elements count as sharing a wrapped row. Their centres
 * coincide on one row and differ by the row pitch across rows, so this only absorbs subpixel
 * noise from zoom and fractional device ratios.
 */
export const SAME_ROW_TOLERANCE_PX = 4

```

### Core Architecture Module: `ui/packages/design-system/src/components/Data/KsDataTable/filter/utils/filterAnalytics.ts`
```
import type {InjectionKey} from "vue"

export type SavedFilterAction = "save" | "apply" | "update" | "delete"

export interface SavedFilterAnalyticsEvent {
    action: SavedFilterAction;
    page: string;
    filtersCount: number;
}

export type SavedFilterAnalyticsTracker = (event: SavedFilterAnalyticsEvent) => void

export const SAVED_FILTER_ANALYTICS_INJECTION_KEY = Symbol("saved-filter-analytics") as InjectionKey<SavedFilterAnalyticsTracker>

```

### Core Architecture Module: `ui/packages/design-system/src/components/Data/KsDataTable/filter/utils/filterChipFactory.ts`
```
import {
    type AppliedFilter,
    type FilterKeyConfig,
    COMPARATOR_LABELS,
    Comparators,
    KV_COMPARATORS,
    RANGE_COMPARATORS,
    TEXT_COMPARATORS,
} from "./filterTypes"
import {type DecodedParam, keyOfComparator} from "./helpers"
import {TIME_RANGE_KEY} from "./constants"
import {normalizeRelativeDate} from "./relativeDates"

export const buildNewFilter = (key: FilterKeyConfig): AppliedFilter | null => {
    const comparator = key.comparators?.[0]
    if (!comparator) return null
    return {
        id: `${key.key}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        key: key.key,
        keyLabel: key.label,
        comparator,
        comparatorLabel: COMPARATOR_LABELS[comparator],
        value: [],
        valueLabel: "",
    }
}

export const createAppliedFilter = (
    key: string,
    config: FilterKeyConfig | undefined,
    comparator: Comparators,
    value: AppliedFilter["value"],
    valueLabel: string,
    idSuffix: string,
    meta?: Record<string, string>,
): AppliedFilter => ({
    id: `${key}-${idSuffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key,
    keyLabel: config?.keyLabelProvider ? config.keyLabelProvider(meta) : (config?.label ?? key),
    comparator,
    comparatorLabel: config?.comparatorLabels?.[comparator] ?? COMPARATOR_LABELS[comparator],
    value,
    valueLabel,
    ...(meta ? {meta} : {}),
})

/**
 * True when a filter value is a date range ({@code {startDate, endDate}}).
 * Range filters render a localized "between" comparator label at display time
 * (see {@code FilterChip.vue}/{@code SaveFilters.vue}) rather than baking an
 * untranslatable English string into the model here.
 */
export const isDateRangeValue = (
    value: AppliedFilter["value"],
): value is {startDate: Date; endDate: Date} =>
    !!value && typeof value === "object" && "startDate" in value && "endDate" in value

export const createTimeRangeFilter = (
    config: FilterKeyConfig,
    startDate: Date,
    endDate: Date,
    comparator = Comparators.EQUALS,
    meta?: Record<string, string>,
): AppliedFilter =>
    createAppliedFilter(
        TIME_RANGE_KEY,
        config,
        comparator,
        {startDate, endDate},
        `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        keyOfComparator(comparator),
        meta,
    )

export const createCustomRangeFilter = (
    key: string,
    config: FilterKeyConfig,
    startDate: Date,
    endDate: Date,
    comparator = Comparators.GREATER_THAN_OR_EQUAL_TO,
    meta?: Record<string, string>,
): AppliedFilter =>
    createAppliedFilter(
        key,
        config,
        comparator,
        {startDate, endDate},
        `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        keyOfComparator(comparator),
        meta,
    )

export const processFieldValue = (
    config: FilterKeyConfig,
    params: DecodedParam[],
    comparator: Comparators,
): {value: AppliedFilter["value"]; valueLabel: string} => {
    const isTextOp = TEXT_COMPARATORS.includes(comparator)
    // Range/threshold comparators (GTE/LTE/…) always target one bound value.
    // Other comparators (IN/NOT_IN) are multi-value.
    const isSingleValueOp = isTextOp || RANGE_COMPARATORS.includes(comparator)

    if (config?.valueType === "key-value" && KV_COMPARATORS.includes(comparator)) {
        const combinedValue = params.flatMap(p => Array.isArray(p?.value) ? p.value : [p?.value as string])
        return {
            value: combinedValue,
            valueLabel: combinedValue.length > 1
                ? `${combinedValue[0]} +${combinedValue.length - 1}`
                : combinedValue[0] ?? "",
        }
    }

    if (config?.valueType === "multi-select" && !isSingleValueOp) {
        const combinedValue = params.flatMap(p =>
            Array.isArray(p?.value) ? p.value : (p?.value as string)?.split(",") ?? [],
        )
        return {
            value: combinedValue,
            valueLabel: combinedValue.join(", "),
        }
    }

    let value: AppliedFilter["value"] = Array.isArray(params[0]?.value)
        ? params[0].value[0]
        : (params[0]?.value as string)

    if (config?.valueType === "date" && typeof value === "string") {
        value = new Date(value)
    } else if (config?.valueType === "time-range" && typeof value === "string") {
        // Predefined relative durations start with "P" and stay durations, normalized to the
        // spelling the option lists and the API use; anything else is a custom absolute date.
        value = /^P/i.test(value) ? normalizeRelativeDate(value) : new Date(value)
    }

    return {
        value,
        valueLabel: value instanceof Date ? value.toLocaleDateString() : String(value),
    }
}

export const resolveDefaultVisibleValue = (key: FilterKeyConfig): AppliedFilter["value"] => {
    const value = typeof key.defaultValue === "function"
        ? key.defaultValue()
        : key.defaultValue
    if (value !== undefined) return value
    return key.valueType === "multi-select" ? [] : ""
}

export const defaultVisibleValueLabel = (value: AppliedFilter["value"]): string => {
    if (Array.isArray(value)) return value.join(", ")
    if (value && typeof value === "object" && "startDate" in value && "endDate" in value) {
        return `${value.startDate.toLocaleDateString()} - ${value.endDate.toLocaleDateString()}`
    }
    if (value instanceof Date) return value.toLocaleDateString()
    return value?.toString?.() ?? ""
}

export const createDefaultVisibleFilters = (
    configKeys: FilterKeyConfig[] | undefined,
    excludedKeys: Set<string>,
    dismissedKeys: Set<string>,
): AppliedFilter[] =>
    configKeys
        ?.filter(key =>
            key.visibleByDefault
            && !excludedKeys.has(key.key)
            && !dismissedKeys.has(key.key),
        )
        .map(key => {
            const comparator = key.comparators[0] ?? Comparators.EQUALS
            const value = resolveDefaultVisibleValue(key)
            const valueLabel = defaultVisibleValueLabel(value)
            return {
                ...createAppliedFilter(key.key, key, comparator, value, valueLabel, "default"),
                isDefaultVisible: true,
            } as AppliedFilter
        }) ?? []

export const pickStarterField = (
    allKeys: FilterKeyConfig[],
    usedFilters: {key: string; comparator: Comparators}[],
): {key: FilterKeyConfig; comparator: Comparators} | null => {
    const groupable = allKeys.filter((k) => k.groupable !== false && k.comparators?.length)
    if (groupable.length === 0) return null

    const usedKeys = new Set(usedFilters.map((f) => f.key))
    const usedPairs = new Set(usedFilters.map((f) => `${f.key}::${f.comparator}`))

    const freshKey = groupable.find((k) => !usedKeys.has(k.key))
    if (freshKey) return {key: freshKey, comparator: freshKey.comparators[0]}

    for (const key of groupable) {
        const comparator = key.comparators.find((c) => !usedPairs.has(`${key.key}::${c}`))
        if (comparator) return {key, comparator}
    }

    return {key: groupable[0], comparator: groupable[0].comparators[0]}
}

```

### Core Architecture Module: `ui/packages/design-system/src/components/Data/KsDataTable/filter/utils/filterInjectionKeys.ts`
```
import type {ComputedRef, InjectionKey, Ref} from "vue"
import type {FilterConfiguration, AppliedFilter, FilterGroup, LogicalOperator, SavedFilter, TableOptions, TableProperties} from "./filterTypes"

export interface FilterContext {
    searchQuery: Ref<string>;
    editingFilter: Ref<SavedFilter | undefined>;

    readOnly: ComputedRef<boolean>;
    chartVisible: ComputedRef<boolean>;
    hasFilterKeys: ComputedRef<boolean>;
    showSearchInput: ComputedRef<boolean>;
    hasAppliedFilters: ComputedRef<boolean>;
    hasDismissedDefaultVisibleKeys: ComputedRef<boolean>;
    tableOptions: ComputedRef<TableOptions>;
    savedFilters: ComputedRef<SavedFilter[]>;
    properties: ComputedRef<TableProperties>;
    searchInputFullWidth: ComputedRef<boolean>;
    appliedFilters: ComputedRef<AppliedFilter[]>;
    groups: ComputedRef<FilterGroup[]>;
    topLogical: ComputedRef<LogicalOperator>;
    hasUnrenderableFilters: ComputedRef<boolean>;
    rawQuery: ComputedRef<string>;
    viewMode: Ref<"chip" | "raw">;
    configuration: ComputedRef<FilterConfiguration>;
    buttons: ComputedRef<{
        savedFilters?: {shown?: boolean};
        tableOptions?: {shown?: boolean};
    }>;

    refreshData: () => void;
    closeEditFilter: () => void;
    removeFilter: (id: string) => void;
    updateChart: (value: boolean) => void;
    addFilter: (filter: AppliedFilter, groupId?: string) => void;
    updateFilter: (filter: AppliedFilter) => void;
    moveFilter: (filterId: string, targetGroupId: string) => void;
    placeFilter: (filterId: string, targetLeafId: string, targetIndex: number) => void;
    wrapGroups: (sourceGroupId: string, targetGroupId: string) => void;
    unwrapGroup: (wrapperId: string) => void;
    setTopLogical: (op: LogicalOperator) => void;
    setWrapperLogical: (wrapperId: string, op: LogicalOperator) => void;
    applyRawQuery: (str: string) => void;
    setViewMode: (mode: "chip" | "raw") => void;
    addGroup: () => void;
    removeGroup: (groupId: string) => void;
    replaceTree: (groups: FilterGroup[], topLogical?: LogicalOperator) => void;
    loadSavedFilter: (filter: SavedFilter) => void;
    editSavedFilter: (filter: SavedFilter) => void;
    updateProperties: (columns: string[]) => void;
    deleteSavedFilter: (filter: SavedFilter) => void;
    resetToDefaults: () => void;
    clearFilters: () => void;
    hasPreApplied: (filterKey: string) => boolean;
    getPreApplied: (filterKey: string) => AppliedFilter | undefined;
    updateSavedFilter: (id: string, name: string, description: string, filters: AppliedFilter[], groups?: FilterGroup[], topLogical?: LogicalOperator) => void;
    saveFilter: (name: string, description: string, filters: AppliedFilter[], groups?: FilterGroup[], topLogical?: LogicalOperator) => void;
}

export const FILTER_CONTEXT_INJECTION_KEY = Symbol("filter-context-injection-key") as InjectionKey<FilterContext>

```

### Core Architecture Module: `ui/packages/design-system/src/components/Data/KsDataTable/filter/utils/filterTypes.ts`
```
import type {ColumnConfig} from "../composables/useTableColumns"

export enum Comparators {
    EQUALS = "=",
    NOT_EQUALS = "!=",
    IN = "IN",
    NOT_IN = "NOT_IN",
    GREATER_THAN = ">",
    LESS_THAN = "<",
    GREATER_THAN_OR_EQUAL_TO = ">=",
    LESS_THAN_OR_EQUAL_TO = "<=",
    STARTS_WITH = "^=",
    ENDS_WITH = "$=",
    CONTAINS = "*=",
    NOT_CONTAINS = "!*=",
    IS_NULL = "IS_NULL",
    IS_NOT_NULL = "IS_NOT_NULL",
    REGEX = "~=",
    PREFIX = "^.=",
}

export const KV_COMPARATORS = [Comparators.EQUALS, Comparators.NOT_EQUALS, Comparators.IN, Comparators.NOT_IN]
export const TEXT_COMPARATORS = [
    Comparators.CONTAINS,
    Comparators.NOT_CONTAINS,
    Comparators.ENDS_WITH,
    Comparators.STARTS_WITH,
]
export const NULL_COMPARATORS = [Comparators.IS_NULL, Comparators.IS_NOT_NULL]
// Range/threshold comparators always target a single bound value
export const RANGE_COMPARATORS = [
    Comparators.GREATER_THAN,
    Comparators.LESS_THAN,
    Comparators.GREATER_THAN_OR_EQUAL_TO,
    Comparators.LESS_THAN_OR_EQUAL_TO,
]

export interface DateFilterOption {
    value: string;
    label: string;
}

/**
 * Extra metadata attached to an applied filter. Currently only carries the value selected from
 * {@link FilterKeyConfig.dateFilterOptions} for timeRange-like filters that target different date
 * fields (e.g. "Last triggered" vs "Next execution"). Add new optional keys here as more
 * meta-driven filters appear.
 */
export interface FilterMeta {
    dateFilter?: string;
}

export interface FilterKeyConfig {
    key: string;
    label: string;
    description?: string;
    searchable?: boolean;
    comparators: [Comparators, ...Comparators[]];
    showComparatorSelection?: boolean;
    /**
     * Returns the dropdown options for a filter.
     * Declare an `options` parameter (any name) to opt into server-side search:
     * the multi-select will call `valueProvider({search})` on user input instead
     * of filtering the loaded list client-side. Server-side support is detected
     * via `valueProvider.length > 0`, so avoid default-valued or rest params.
     */
    valueProvider?: (options?: {search?: string, meta?: FilterMeta}) => Promise<FilterValue[]>;
    valueType: "text" | "select" | "date" | "multi-select" | "key-value" | "radio" | "time-range";
    /**
     * Only meaningful for {@link valueType} === "time-range". Controls the custom (non-predefined)
     * mode of the time-range picker on an arbitrary date field:
     *   - "single" — pick one absolute date (encoded as one comparator on the field key).
     *   - "range"  — pick a start/end range (encoded as GREATER_THAN_OR_EQUAL_TO + LESS_THAN_OR_EQUAL_TO
     *                on the field key, and decoded back into a single range chip).
     * Defaults to "single" when omitted. Note: a time-range field must NOT be keyed "startDate" or
     * "endDate" — those names are reserved for the dedicated `timeRange` filter encoding.
     */
    customDateMode?: "single" | "range";
    visibleByDefault?: boolean;
    defaultValue?: AppliedFilter["value"] | (() => AppliedFilter["value"]);
    /**
     * When `false`, the filter is a global AND scope: it cannot be added to or moved into a
     * conditional group, and is omitted from the "add field" menu. Defaults to `true`.
     */
    groupable?: boolean;
    /** When set, renders an "Apply to" segmented selector inside the timeRange popover. */
    dateFilterOptions?: DateFilterOption[];
    /** Overrides the chip's keyLabel based on the active dateFilter meta value. */
    keyLabelProvider?: (meta?: FilterMeta) => string;
    /**
     * Per-field override for comparator labels. When provided, supersedes
     * the global COMPARATOR_LABELS for this filter only. Useful when the
     * generic label doesn't fit the domain (e.g. "At or Above" for a log
     * level filter rather than "Greater Than or Equal").
     */
    comparatorLabels?: Partial<Record<Comparators, string>>;
    /** When `true`, renders colored status tags in multi-select value display. */
    colored?: boolean;
}

export interface FilterValue {
    label: string;
    value: string;
    color?: string;
    description?: string;
}

export interface AppliedFilter {
    id: string;
    key: string;
    keyLabel: string;
    valueLabel: string;
    isDefaultVisible?: boolean;
    comparator: Comparators;
    comparatorLabel: string;
    value: string | string[] | Date | {startDate: Date; endDate: Date};
    /** Extra metadata (e.g. dateFilter for timeRange filters). See {@link FilterMeta}. */
    meta?: FilterMeta;
}

export type LogicalOperator = "AND" | "OR";

export interface LeafFilterGroup {
    id: string;
    kind?: "leaf";
    filters: AppliedFilter[];
}

export interface WrapperGroup {
    id: string;
    kind: "wrapper";
    logical: LogicalOperator;
    children: LeafFilterGroup[];
}

export type FilterGroup = LeafFilterGroup | WrapperGroup;

export const isWrapperGroup = (g: FilterGroup): g is WrapperGroup =>
    g.kind === "wrapper"

export const isLeafGroup = (g: FilterGroup): g is LeafFilterGroup =>
    g.kind !== "wrapper"

/** Returns the operator opposite to the given one. */
export const flipLogical = (op: LogicalOperator): LogicalOperator =>
    op === "AND" ? "OR" : "AND"

export interface SavedFilter {
    id: string;
    name: string;
    createdAt: Date;
    global?: boolean;
    description?: string;
    filters: AppliedFilter[];
    groups?: FilterGroup[];
    topLogical?: LogicalOperator;
}

export interface FilterConfiguration {
    title: string;
    keys: FilterKeyConfig[];
    searchPlaceholder?: string;
    defaultFilters?: AppliedFilter[];
}

export interface TableProperties {
    shown: boolean;
    columns?: ColumnConfig[];
    storageKey?: string;
    displayColumns?: string[];
}

export interface TableOptions {
    chart?: {
        shown?: boolean;
        value?: boolean;
        callback?: (value: boolean) => void
    };
    columns?: {
        shown?: boolean
    };
    refresh?: {
        shown?: boolean;
        callback?: () => void
    };
}

export const COMPARATOR_LABELS: Record<Comparators, string> = {
    [Comparators.EQUALS]: "Equals",
    [Comparators.NOT_EQUALS]: "Not Equals",
    [Comparators.IN]: "In",
    [Comparators.NOT_IN]: "Not In",
    [Comparators.GREATER_THAN]: "Greater Than",
    [Comparators.LESS_THAN]: "Less Than",
    [Comparators.GREATER_THAN_OR_EQUAL_TO]: "Greater Than or Equal",
    [Comparators.LESS_THAN_OR_EQUAL_TO]: "Less Than or Equal",
    [Comparators.STARTS_WITH]: "Starts With",
    [Comparators.ENDS_WITH]: "Ends With",
    [Comparators.CONTAINS]: "Contains",
    [Comparators.NOT_CONTAINS]: "Does Not Contain",
    [Comparators.IS_NULL]: "Is Not Set",
    [Comparators.IS_NOT_NULL]: "Is Set",
    [Comparators.REGEX]: "Matches Pattern",
    [Comparators.PREFIX]: "Prefix",
}

export const COMPARATOR_DESCRIPTIONS: Record<Comparators, string> = {
    [Comparators.EQUALS]: "filter.comparator_descriptions.EQUALS",
    [Comparators.NOT_EQUALS]: "filter.comparator_descriptions.NOT_EQUALS",
    [Comparators.IN]: "filter.comparator_descriptions.IN",
    [Comparators.NOT_IN]: "filter.comparator_descriptions.NOT_IN",
    [Comparators.GREATER_THAN]: "filter.comparator_descriptions.GREATER_THAN",
    [Comparators.LESS_THAN]: "filter.comparator_descriptions.LESS_THAN",
    [Comparators.GREATER_THAN_OR_EQUAL_TO]: "filter.comparator_descriptions.GREATER_THAN_OR_EQUAL_TO",
    [Comparators.LESS_THAN_OR_EQUAL_TO]: "filter.comparator_descriptions.LESS_THAN_OR_EQUAL_TO",
    [Comparators.STARTS_WITH]: "filter.comparator_descriptions.STARTS_WITH",
    [Comparators.ENDS_WITH]: "filter.comparator_descriptions.ENDS_WITH",
    [Comparators.CONTAINS]: "filter.comparator_descriptions.CONTAINS",
    [Comparators.NOT_CONTAINS]: "filter.comparator_descriptions.NOT_CONTAINS",
    [Comparators.IS_NULL]: "filter.comparator_descriptions.IS_NULL",
    [Comparators.IS_NOT_NULL]: "filter.comparator_descriptions.IS_NOT_NULL",
    [Comparators.REGEX]: "filter.comparator_descriptions.REGEX",
    [Comparators.PREFIX]: "filter.comparator_descriptions.PREFIX",
}

```

### Core Architecture Module: `ui/packages/design-system/src/components/Data/KsDataTable/filter/utils/helpers.ts`
```
import type {LocationQuery, LocationQueryRaw} from "vue-router"
import {type AppliedFilter, type FilterGroup, type LeafFilterGroup, type LogicalOperator, Comparators, isWrapperGroup} from "./filterTypes"
import {DATE_FILTER_KEY, MAX_RENDERABLE_NESTING_DEPTH} from "./constants"

/**
 * Normalizes a `filters[...]` query-param value after vue-router (or
 * {@link parseFiltersFromString}) has already decoded it.
 */
export const decodeFilterValue = (value: string | (string | null)[]): string | string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => item !== null)
        : value

export function getComparator(comparatorKey: keyof typeof Comparators): Comparators {
    return Comparators[comparatorKey]
}

export function keyOfComparator(comparator: Comparators): keyof typeof Comparators {
    return Object.entries(Comparators).find(([_, value]) => value === comparator)![0] as keyof typeof Comparators
}

/**
 * Single unified regex matching every filter URL shape the chip UI supports.
 * Group 1 captures the optional `[and|or][N]` prefix chain (0 to MAX_RENDERABLE_NESTING_DEPTH pairs).
 * Groups 2/3/4 are field / operation / optional subKey.
 *
 * Keys with more prefix pairs than the chip UI can render fail to match and fall through to null;
 * `isUnrenderableFilterKey` flags them separately so the UI can switch to the raw editor.
 */
const FILTER_KEY_PATTERN = new RegExp(
    `^filters((?:\\[(?:and|or)]\\[\\d+]){0,${MAX_RENDERABLE_NESTING_DEPTH}})\\[([^\\]]*?)]\\[([^\\]]*?)](?:\\[(.*?)])?$`,
    "i",
)

const PREFIX_SEGMENT_PATTERN = /\[(and|or)]\[(\d+)]/gi

export interface PrefixSegment {
    logical: LogicalOperator
    index: number
}

const parsePrefixChain = (prefix: string): PrefixSegment[] => {
    if (!prefix) return []
    const result: PrefixSegment[] = []
    let match: RegExpExecArray | null
    PREFIX_SEGMENT_PATTERN.lastIndex = 0
    while ((match = PREFIX_SEGMENT_PATTERN.exec(prefix)) !== null) {
        result.push({logical: match[1].toUpperCase() as LogicalOperator, index: Number(match[2])})
    }
    return result
}

export interface DecodedParam {
    field: string
    value: string | string[]
    operation: string
    groupIndex?: number
    wrapperChildIndex?: number
    topLogical?: LogicalOperator
    wrapperLogical?: LogicalOperator
}

/** One `filters[and|or][N]…[field][OPERATION][subKey]` key, split into its parts. */
export interface ParsedFilterKey {
    /** The `[and|or][N]` grouping chain, outermost first; empty for a root-level filter. */
    chain: PrefixSegment[]
    field: string
    operation: string
    /** Present for keys carrying a sub-key, e.g. the label name in `filters[labels][EQUALS][env]`. */
    subKey?: string
}

/**
 * Parses a filter URL key into its parts, or returns null when the key does not match
 * {@link FILTER_KEY_PATTERN}. Exported so callers that translate the route into a backend request
 * payload read the key format from its owner instead of restating the regex.
 */
export const parseFilterKey = (key: string): ParsedFilterKey | null => {
    const match = key.match(FILTER_KEY_PATTERN)
    if (!match) return null

    const [, prefix, field, operation, subKey] = match
    return {chain: parsePrefixChain(prefix), field, operation, subKey}
}

export const decodeSearchParams = (query: LocationQuery): DecodedParam[] =>
    Object.entries(query)
        .filter(([key]) => key.startsWith("filters[") || key === "q")
        .map(([key, value]): DecodedParam | null => {
            if (!value) return null
            const parsed = parseFilterKey(key)
            if (!parsed) return null

            return buildParam(parsed.field, parsed.operation, parsed.subKey, value, parsed.chain)
        })
        .filter((v): v is DecodedParam => v !== null)

const buildParam = (
    field: string,
    operation: string,
    subKey: string | undefined,
    value: string | (string | null)[],
    chain: PrefixSegment[],
): DecodedParam => {
    const decodedValue = decodeFilterValue(value)
    const decoded = subKey
        ? Array.isArray(decodedValue)
            ? decodedValue.map(item => `${subKey}:${item}`)
            : `${subKey}:${decodedValue}`
        : decodedValue
    return {
        field,
        value: decoded,
        operation,
        ...(chain[0] !== undefined ? {groupIndex: chain[0].index, topLogical: chain[0].logical} : {}),
        ...(chain[1] !== undefined ? {wrapperChildIndex: chain[1].index, wrapperLogical: chain[1].logical} : {}),
    }
}

type Filter = Pick<AppliedFilter, "key" | "comparator" | "value" | "meta">;

type ComparatorKeyResolver = (comparator: Comparators) => string;
type FilterQuery = Record<string, string | string[]>;

export const encodeFiltersToQuery = (filters: Filter[], getComparatorKey: ComparatorKeyResolver) =>
    encodeFilterGroupsToQuery(
        filters.length > 0 ? [{id: "0", filters: filters as AppliedFilter[]}] : [],
        getComparatorKey,
    )

export const encodeFilterGroupsToQuery = (
    groups: FilterGroup[],
    getComparatorKey: ComparatorKeyResolver,
    topLogical: LogicalOperator = "OR",
): FilterQuery => {
    const query: FilterQuery = {}
    const onlyOneLeaf = groups.length === 1 && !isWrapperGroup(groups[0])
    const topOp = topLogical.toLowerCase()

    groups.forEach((unit, unitIdx) => {
        const outerPrefix = onlyOneLeaf ? "filters" : `filters[${topOp}][${unitIdx}]`

        if (isWrapperGroup(unit)) {
            const wrapperOp = unit.logical.toLowerCase()
            unit.children.forEach((child, childIdx) => {
                const innerPrefix = `${outerPrefix}[${wrapperOp}][${childIdx}]`
                child.filters.forEach(filter => writeFilter(query, innerPrefix, filter, getComparatorKey))
            })
        } else {
            (unit as LeafFilterGroup).filters.forEach(filter =>
                writeFilter(query, outerPrefix, filter, getComparatorKey))
        }
    })

    return query
}

const writeFilter = (
    query: FilterQuery,
    prefix: string,
    filter: Filter,
    getComparatorKey: ComparatorKeyResolver,
) => {
    const {key, comparator, value} = filter
    const comparatorKey = getComparatorKey(comparator)

    switch (key) {
        case "timeRange": {
            if (typeof value === "object" && "startDate" in value) {
                query["filters[startDate][GREATER_THAN_OR_EQUAL_TO]"] = value.startDate.toISOString()
                query["filters[endDate][LESS_THAN_OR_EQUAL_TO]"] = value.endDate.toISOString()
            } else {
                query[`filters[${key}][${comparatorKey}]`] = value?.toString() ?? ""
            }
            const dateFilter = filter.meta?.dateFilter
            if (dateFilter) {
                query["dateFilter"] = dateFilter
            }
            return
        }
        default: {
            // A `time-range` field in custom range mode: encode {startDate,endDate} as a GTE/LTE pair
            // on the field's own key (works inside [and|or][N] group prefixes too). The dedicated
            // `timeRange` key keeps its own startDate/endDate encoding via the case above.
            if (value && typeof value === "object" && "startDate" in value && "endDate" in value) {
                const {startDate, endDate} = value as {startDate: Date; endDate: Date}
                query[`${prefix}[${key}][GREATER_THAN_OR_EQUAL_TO]`] = startDate.toISOString()
                query[`${prefix}[${key}][LESS_THAN_OR_EQUAL_TO]`] = endDate.toISOString()
            } else if (Array.isArray(value) && (key === "labels" || value.some(v => typeof v === "string" && v.includes(":")))) {
                value.forEach((item: string) => {
                    const separatorIndex = item.indexOf(":")
                    if (separatorIndex <= 0) return
                    const k = item.slice(0, separatorIndex)
                    const v = item.slice(separatorIndex + 1)
                    if (!k || !v) return
                    const queryKey = `${prefix}[${key}][${comparatorKey}][${k}]`
                    const existing = query[queryKey]
                    if ((comparator === Comparators.IN || comparator === Comparators.NOT_IN) && existing !== undefined) {
                        query[queryKey] = Array.isArray(existing) ? [...existing, v] : [existing, v]
                    } else {
                        query[queryKey] = v
                    }
                })
            } else {
                query[`${prefix}[${key}][${comparatorKey}]`] = Array.isArray(value)
                    ? value.join(",")
                    : value instanceof Date
                        ? value.toISOString()
                        : value?.toString() ?? ""
            }
        }
    }
}

export const isValidFilter = (filter: Filter): boolean => {
    const {value} = filter

    if (value == null || value === "") return false

    switch (true) {
        case Array.isArray(value):
            return value.length > 0
        case typeof value === "object" && "startDate" in value:
            return !!(value.startDate && value.endDate)
        case value instanceof Date:
            return true
        default:
            return true
    }
}

export const validStructureSignature = (groups: FilterGroup[]): string => {
    const leafFilters = (leaf: LeafFilterGroup): string[] =>
        leaf.filters
            .filter(isValidFilter)
            .map((f) => `${f.key} ${f.comparator} ${JSON.stringify(f.value)}`)
            .sort()

    const units = groups
        .map((unit) => {
            if (isWrapperGroup(unit)) {
                const children = unit.children.map(leafFilters).filter((c) => c.length > 0)
                if (children.length === 0) return null
                if (children.length === 1) return {filters: children[0]}
                return {logical: unit.logical, children}
            }
            const filters = leafFilters(unit as LeafFilterGroup)
            return filters.length ? {filters} : null
        })
```

### Core Architecture Module: `ui/packages/design-system/src/components/Data/KsDataTable/filter/utils/icons.ts`
```
import BookmarkCheckOutline from "vue-material-design-icons/BookmarkCheckOutline.vue"
import BookmarkOffOutline from "vue-material-design-icons/BookmarkOffOutline.vue"
import BookmarkOutline from "vue-material-design-icons/BookmarkOutline.vue"
import ChevronDown from "vue-material-design-icons/ChevronDown.vue"
import Close from "vue-material-design-icons/Close.vue"
import CloseCircleOutline from "vue-material-design-icons/CloseCircleOutline.vue"
import CodeBraces from "vue-material-design-icons/CodeBraces.vue"
import CogOutline from "vue-material-design-icons/CogOutline.vue"
import ContentSaveOutline from "vue-material-design-icons/ContentSaveOutline.vue"
import Delete from "vue-material-design-icons/Delete.vue"
import Drag from "vue-material-design-icons/Drag.vue"
import EyeOffOutline from "vue-material-design-icons/EyeOffOutline.vue"
import EyeOutline from "vue-material-design-icons/EyeOutline.vue"
import FilterOutline from "vue-material-design-icons/FilterOutline.vue"
import FilterVariant from "vue-material-design-icons/FilterVariant.vue"
import FormatListBulleted from "vue-material-design-icons/FormatListBulleted.vue"
import InformationOutline from "vue-material-design-icons/InformationOutline.vue"
import Magnify from "vue-material-design-icons/Magnify.vue"
import PencilOutline from "vue-material-design-icons/PencilOutline.vue"
import Plus from "vue-material-design-icons/Plus.vue"
import Refresh from "vue-material-design-icons/Refresh.vue"
import Restore from "vue-material-design-icons/Restore.vue"
import Tune from "vue-material-design-icons/Tune.vue"
import Ungroup from "vue-material-design-icons/Ungroup.vue"

export {
    BookmarkCheckOutline,
    BookmarkOffOutline,
    BookmarkOutline,
    ChevronDown,
    Close,
    CloseCircleOutline,
    CodeBraces,
    CogOutline,
    ContentSaveOutline,
    Delete,
    Drag,
    EyeOffOutline,
    EyeOutline,
    FilterOutline,
    FilterVariant,
    FormatListBulleted,
    InformationOutline,
    Magnify,
    PencilOutline,
    Plus,
    Refresh,
    Restore,
    Tune,
    Ungroup,
}

```

### Core Architecture Module: `ui/packages/design-system/src/components/Data/KsDataTable/filter/utils/logLevelQuery.ts`
```
import type {
    LocationQuery,
    LocationQueryRaw,
    LocationQueryValue,
    LocationQueryValueRaw,
} from "vue-router"
import type {AppliedFilter} from "./filterTypes"
import {Comparators} from "./filterTypes"

const LEVEL_FILTER_PREFIX = "filters[level]["
const LEVEL_GTE_FILTER_KEY = "filters[level][GREATER_THAN_OR_EQUAL_TO]"
const LEVEL_LTE_FILTER_KEY = "filters[level][LESS_THAN_OR_EQUAL_TO]"
const LEVEL_IN_FILTER_KEY = "filters[level][IN]"
const LEVEL_NOT_IN_FILTER_KEY = "filters[level][NOT_IN]"
const LEVEL_EQUALS_FILTER_KEY = "filters[level][EQUALS]"
const LEGACY_LEVEL_FILTER_KEY = "level"

const SUPPORTED_LEVEL_FILTER_KEYS = new Set([
    LEVEL_GTE_FILTER_KEY,
    LEVEL_LTE_FILTER_KEY,
    LEVEL_IN_FILTER_KEY,
    LEVEL_NOT_IN_FILTER_KEY,
    LEVEL_EQUALS_FILTER_KEY,
])

export type LevelFilterDirection = "min" | "max" | "in" | "not_in";

export interface LevelFilterValue {
    value: string;
    direction: LevelFilterDirection;
}

const LEVEL_FILTER_KEY_BY_DIRECTION: Record<LevelFilterDirection, string> = {
    min: LEVEL_GTE_FILTER_KEY,
    max: LEVEL_LTE_FILTER_KEY,
    in: LEVEL_IN_FILTER_KEY,
    not_in: LEVEL_NOT_IN_FILTER_KEY,
}

const firstStringValue = (
    value:
        | LocationQueryValue
        | LocationQueryValueRaw
        | (LocationQueryValue | LocationQueryValueRaw)[]
        | undefined,
) => {
    if (Array.isArray(value)) {
        return typeof value[0] === "string" ? value[0] : undefined
    }

    return typeof value === "string" ? value : undefined
}

const nonEmpty = (value: string | undefined) =>
    value && value.length > 0 ? value : undefined

export const readRouteLevelFilter = (query: LocationQuery | LocationQueryRaw): LevelFilterValue | undefined => {
    const lte = nonEmpty(firstStringValue(query[LEVEL_LTE_FILTER_KEY]))
    if (lte) {
        return {value: lte, direction: "max"}
    }

    const gte = nonEmpty(firstStringValue(query[LEVEL_GTE_FILTER_KEY]))
    if (gte) {
        return {value: gte, direction: "min"}
    }

    const notIn = nonEmpty(firstStringValue(query[LEVEL_NOT_IN_FILTER_KEY]))
    if (notIn) {
        return {value: notIn, direction: "not_in"}
    }

    const inValues = nonEmpty(firstStringValue(query[LEVEL_IN_FILTER_KEY]))
    if (inValues) {
        return {value: inValues, direction: "in"}
    }

    // Legacy: EQUALS (pre-rename) and bare `level` query param both meant "at or above"
    const legacyEquals = nonEmpty(firstStringValue(query[LEVEL_EQUALS_FILTER_KEY]))
    if (legacyEquals) {
        return {value: legacyEquals, direction: "min"}
    }

    const legacyLevel = nonEmpty(firstStringValue(query[LEGACY_LEVEL_FILTER_KEY]))
    if (legacyLevel) {
        return {value: legacyLevel, direction: "min"}
    }

    return undefined
}

export const hasUnsupportedRouteLevelComparator = (query: LocationQuery | LocationQueryRaw) =>
    Object.keys(query).some(
        (key) =>
            key === LEGACY_LEVEL_FILTER_KEY ||
            (key.startsWith(LEVEL_FILTER_PREFIX) && !SUPPORTED_LEVEL_FILTER_KEYS.has(key)),
    )

export const readAppliedLevelFilter = (filters: AppliedFilter[]): LevelFilterValue | undefined => {
    const levelFilter = filters.find((filter) => filter.key === "level")
    if (!levelFilter) {
        return undefined
    }

    const direction: LevelFilterDirection = (() => {
        switch (levelFilter.comparator) {
        case Comparators.LESS_THAN_OR_EQUAL_TO:
            return "max"
        case Comparators.IN:
            return "in"
        case Comparators.NOT_IN:
            return "not_in"
        default:
            return "min"
        }
    })()

    const rawValue = Array.isArray(levelFilter.value)
        ? (direction === "in" || direction === "not_in" ? levelFilter.value.join(",") : levelFilter.value[0])
        : levelFilter.value

    if (typeof rawValue !== "string" || rawValue.length === 0) {
        return undefined
    }

    return {value: rawValue, direction}
}

export const normalizeRouteLevelFilter = (
    query: LocationQueryRaw,
    level: LevelFilterValue | string | undefined,
) => {
    const normalized = {...query}

    Object.keys(normalized).forEach((key) => {
        if (key.startsWith(LEVEL_FILTER_PREFIX)) {
            delete normalized[key]
        }
    })

    delete normalized[LEGACY_LEVEL_FILTER_KEY]

    if (level) {
        // Backward-compat: plain string callers default to min (≥) semantic
        const resolved: LevelFilterValue =
            typeof level === "string" ? {value: level, direction: "min"} : level
        normalized[LEVEL_FILTER_KEY_BY_DIRECTION[resolved.direction]] = resolved.value
    }

    return normalized
}

export const levelToRequestParams = (
    level: LevelFilterValue | undefined,
): Record<string, string> => {
    if (!level) {
        return {}
    }
    return {[LEVEL_FILTER_KEY_BY_DIRECTION[level.direction]]: level.value}
}

```

### Core Architecture Module: `ui/packages/design-system/src/components/Data/KsDataTable/filter/utils/relativeDates.ts`
```
// Equivalent spellings of the predefined relative ranges, normalized to the one the option lists
// and the API use - Java's Duration.parse, which the API applies, rejects the week designator.
const RELATIVE_DATE_ALIASES: Record<string, string> = {
    P1D: "PT24H",
    P2D: "PT48H",
    P7D: "PT168H",
    P1W: "PT168H",
    P30D: "PT720H",
    P365D: "PT8760H",
}

export const normalizeRelativeDate = (value: string): string => RELATIVE_DATE_ALIASES[value] ?? value

```

### Core Architecture Module: `ui/packages/design-system/src/components/Data/KsDataTable/filter/utils/reorderPlacement.ts`
```
export interface FlatPlacement {
    targetLeafId: string;
    targetIndex: number;
}

export function computePlacement(
    orderedIds: string[],
    draggedId: string,
    groupIdOf: (id: string) => string | undefined,
): FlatPlacement | null {
    const idx = orderedIds.indexOf(draggedId)
    if (idx === -1) return null

    const referenceId = idx > 0 ? orderedIds[idx - 1] : orderedIds[idx + 1]
    const targetLeafId = referenceId ? groupIdOf(referenceId) : undefined
    if (!targetLeafId) return null

    let targetIndex = 0
    for (let i = 0; i < idx; i++) {
        if (groupIdOf(orderedIds[i]) === targetLeafId) targetIndex++
    }

    return {targetLeafId, targetIndex}
}

```

### Core Architecture Module: `ui/packages/design-system/src/components/Data/KsDataTable/filter/utils/routeDecoder.ts`
```
/**
 * Pure URL-query → FilterGroup[] decoder. Extracted from useFilters because the pipeline is
 * a closed transformation: input is a vue-router LocationQuery, output is the tree shape the
 * chip UI renders. Nothing here touches Vue refs, the router, or the chip state.
 *
 * Three named passes, in order:
 *   1. `bucketParams`      — sort decoded params by (topIdx, wrapperChildIdx) into Slot maps.
 *   2. `buildLeafFromSlot` — turn one Slot into a LeafFilterGroup.
 *   3. `assembleUnits`     — fold the bucket map into top-level units (leaves or wrappers).
 */
import type {LocationQuery} from "vue-router"
import {
    type FilterConfiguration,
    type FilterGroup,
    type LeafFilterGroup,
    type LogicalOperator,
    type WrapperGroup,
    type AppliedFilter,
    Comparators,
} from "./filterTypes"
import {type DecodedParam, decodeSearchParams} from "./helpers"
import {
    DATE_FILTER_KEY,
    START_DATE_FIELD,
    END_DATE_FIELD,
    TIME_RANGE_KEY,
} from "./constants"
import {newGroupId} from "../composables/useFilterGroups"
import {createAppliedFilter, createCustomRangeFilter, createTimeRangeFilter, processFieldValue} from "./filterChipFactory"

/** A bag of params bucketed into one logical position in the tree. */
type Slot = {
    fieldParams: Map<string, DecodedParam[]>;
    dateFilters: Record<string, {comparatorKey: string; value: string}>;
}

type BucketedParams = {
    perTop: Map<number, {isWrapper: boolean; children: Map<number, Slot>}>;
    observedTopLogical: LogicalOperator | undefined;
    wrapperLogicalByTopIdx: Map<number, LogicalOperator>;
}

const emptySlot = (): Slot => ({fieldParams: new Map(), dateFilters: {}})

/**
 * Sort decoded URL params into buckets keyed by (topIdx, wrapperChildIdx). Tracks the
 * top-level operator and each wrapper's operator as side effects of the first param that
 * specifies them — well-formed URLs are consistent so the first wins.
 */
const bucketParams = (params: DecodedParam[]): BucketedParams => {
    const perTop = new Map<number, {isWrapper: boolean; children: Map<number, Slot>}>()
    let observedTopLogical: LogicalOperator | undefined
    const wrapperLogicalByTopIdx = new Map<number, LogicalOperator>()

    const getSlot = (topIdx: number, wrapperChildIdx?: number): Slot => {
        if (!perTop.has(topIdx)) {
            perTop.set(topIdx, {isWrapper: false, children: new Map()})
        }
        const top = perTop.get(topIdx)!
        if (wrapperChildIdx !== undefined) top.isWrapper = true
        const childKey = wrapperChildIdx ?? -1
        if (!top.children.has(childKey)) top.children.set(childKey, emptySlot())
        return top.children.get(childKey)!
    }

    params.forEach(param => {
        const topIdx = param.groupIndex ?? 0
        if (param.topLogical && observedTopLogical === undefined) {
            observedTopLogical = param.topLogical
        }
        if (param.wrapperLogical && !wrapperLogicalByTopIdx.has(topIdx)) {
            wrapperLogicalByTopIdx.set(topIdx, param.wrapperLogical)
        }
        const slot = getSlot(topIdx, param.wrapperChildIndex)
        if (param.field === START_DATE_FIELD || param.field === END_DATE_FIELD) {
            slot.dateFilters[param.field] = {
                comparatorKey: param.operation ?? "",
                value: param.value as string,
            }
        } else {
            // Bucket by (field, operation) so same-field/different-comparator pairs survive.
            const bucketKey = `${param.field}|${param.operation ?? ""}`
            if (!slot.fieldParams.has(bucketKey)) slot.fieldParams.set(bucketKey, [])
            slot.fieldParams.get(bucketKey)!.push(param)
        }
    })

    return {perTop, observedTopLogical, wrapperLogicalByTopIdx}
}

/** Build a single LeafFilterGroup from one bucketed Slot. */
const buildLeafFromSlot = (
    slot: Slot,
    configuration: FilterConfiguration,
    routeDateFilter: string | undefined,
): LeafFilterGroup => {
    const filtersMap = new Map<string, AppliedFilter>()

    // Pre-pass: a `time-range` field in range mode arrives as two buckets (GTE + LTE) because
    // bucketParams keys by `field|operation`. Merge them into one range chip and mark the buckets
    // consumed so the normal pass below doesn't render them as two separate `>=` / `<=` chips.
    const consumedBuckets = new Set<string>()
    const paramsByField = new Map<string, DecodedParam[]>()
    slot.fieldParams.forEach((params, bucketKey) => {
        const field = params[0]?.field ?? bucketKey.split("|")[0]
        if (!paramsByField.has(field)) paramsByField.set(field, [])
        paramsByField.get(field)!.push(...params)
    })
    paramsByField.forEach((params, field) => {
        const config = configuration.keys?.find(k => k?.key === field)
        if (config?.valueType !== "time-range" || config.customDateMode !== "range") return
        const gte = params.find(p => p.operation === "GREATER_THAN_OR_EQUAL_TO")
        const lte = params.find(p => p.operation === "LESS_THAN_OR_EQUAL_TO")
        if (!gte || !lte) return
        filtersMap.set(
            `${field}|GREATER_THAN_OR_EQUAL_TO`,
            createCustomRangeFilter(
                field,
                config,
                new Date(gte.value as string),
                new Date(lte.value as string),
                Comparators.GREATER_THAN_OR_EQUAL_TO,
                routeDateFilter && config.dateFilterOptions ? {dateFilter: routeDateFilter} : undefined,
            ),
        )
        consumedBuckets.add(`${field}|GREATER_THAN_OR_EQUAL_TO`)
        consumedBuckets.add(`${field}|LESS_THAN_OR_EQUAL_TO`)
    })

    slot.fieldParams.forEach((params, bucketKey) => {
        if (consumedBuckets.has(bucketKey)) return
        const field = params[0]?.field ?? bucketKey.split("|")[0]
        const config = configuration.keys?.find(k => k?.key === field)
        if (!config) return

        const parsedComparator = Comparators[params[0]?.operation as keyof typeof Comparators]
        const comparator = config.comparators?.includes(parsedComparator) ? parsedComparator : undefined
        if (!comparator) return

        const {value, valueLabel} = processFieldValue(config, params, comparator)
        const meta = field === TIME_RANGE_KEY && routeDateFilter && config.dateFilterOptions
            ? {dateFilter: routeDateFilter}
            : undefined
        filtersMap.set(
            `${field}|${params[0]?.operation ?? ""}`,
            createAppliedFilter(field, config, comparator, value, valueLabel, params[0]?.operation, meta),
        )
    })

    const startSlot = slot.dateFilters[START_DATE_FIELD]
    const endSlot = slot.dateFilters[END_DATE_FIELD]
    if (startSlot && endSlot) {
        const timeRangeConfig = configuration.keys?.find(k => k?.key === TIME_RANGE_KEY)
        if (timeRangeConfig) {
            const comparator = Comparators[startSlot.comparatorKey as keyof typeof Comparators]
            const meta = routeDateFilter && timeRangeConfig.dateFilterOptions
                ? {dateFilter: routeDateFilter}
                : undefined
            filtersMap.set(
                TIME_RANGE_KEY,
                createTimeRangeFilter(
                    timeRangeConfig,
                    new Date(startSlot.value),
                    new Date(endSlot.value),
                    comparator,
                    meta,
                ),
            )
        }
    }

    return {id: newGroupId(), kind: "leaf", filters: Array.from(filtersMap.values())}
}

/** Fold the bucket map into a sorted list of top-level FilterGroup units. */
const assembleUnits = (
    bucketed: BucketedParams,
    configuration: FilterConfiguration,
    routeDateFilter: string | undefined,
): FilterGroup[] => {
    const orderedTop = Array.from(bucketed.perTop.entries()).sort(([a], [b]) => a - b)
    return orderedTop.flatMap(([topIdx, top]): FilterGroup[] => {
        if (!top.isWrapper) {
            const slot = top.children.get(-1) ?? emptySlot()
            const leaf = buildLeafFromSlot(slot, configuration, routeDateFilter)
            return leaf.filters.length > 0 ? [leaf] : []
        }
        const orderedChildren = Array.from(top.children.entries())
            .filter(([k]) => k >= 0)
            .sort(([a], [b]) => a - b)
        const childLeaves = orderedChildren
            .map(([, slot]) => buildLeafFromSlot(slot, configuration, routeDateFilter))
            .filter(c => c.filters.length > 0)
        if (childLeaves.length === 0) return []
        if (childLeaves.length === 1) return [childLeaves[0]]
        const wrapper: WrapperGroup = {
            id: newGroupId(),
            kind: "wrapper",
            logical: bucketed.wrapperLogicalByTopIdx.get(topIdx) ?? "AND",
            children: childLeaves,
        }
        return [wrapper]
    })
}

/**
 * Top-level entry: decode a route query into the chip-tree shape plus the observed top-level
 * operator. Returns `{groups, topLogical}` so callers can sync both at once.
 */
export const parseEncodedGroups = (
    routeQuery: LocationQuery,
    configuration: FilterConfiguration,
): {groups: FilterGroup[]; topLogical: LogicalOperator} => {
    const bucketed = bucketParams(decodeSearchParams(routeQuery))
    const routeDateFilter = routeQuery[DATE_FILTER_KEY] as string | undefined
    const groups = assembleUnits(bucketed, configuration, routeDateFilter)
    return {groups, topLogical: bucketed.observedTopLogical ?? "OR"}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14216** (2026-01-20): **ForEach Expression doesn't work with Concat task**
  *Symptoms*: ### Describe the issue  `{{ outputs.start_api_call | jq('.[].outputFiles.generated') }}` works with ForEach with the `values` property but does not work with Concat for `files`.  The expression works in Debug Expressions and returns an array of string paths. However, the flow fails for this task because invalid character `Last error was: Illegal character in scheme name at index 0: [“kestra:///company/team/.......` aka it doesn't like that it's an array. However the next example which is the same works.  ```yaml id: concat_files namespace: company.team  tasks:   - id: foreach     type: io.kestra.plugin.core.flow.ForEach     values: ["value1", "value2", "value3"]     tasks:       - id: start_api_call         type: io.kestra.plugin.scripts.shell.Commands         commands:           - echo {{ taskrun.value }} > generated         outputFiles:           - generated    - id: foreach_example     type: io.kestra.plugin.core.flow.ForEach     values: "{{ outputs.start_api_call | jq('.[].outputFiles.generated') }}"     tasks:       - id: log         type: io.kestra.plugin.core.log.Log         message: "{{ taskrun.value }}"    - id: concat_dynamic_foreach     type: io.kestra.plugin.core.storage.Concat     files:       - "{{ outputs.start_api_call | jq('.[].outputFiles.generated') }}" ```  In this example, we can generate 3 files from the same task. We can access all of these dynamically using `{{ outputs.echo_one.outputFiles | jq('.[]') }}`. This returns an array of string paths, similar
  **Post-Mortem & Fix Analysis**:
  > I think there is just a syntax error in the first example  ```yaml   - id: concat_dynamic_foreach     type: io.kestra.plugin.core.storage.Concat     files:       - "{{ outputs.start_api_call | jq('.[].outputFiles.generated') }}" ```  should be  ```yaml   - id: concat_dynamic_foreach     type: io.kestra.plugin.core.storage.Concat     files: "{{ outputs.start_api_call | jq('.[].outputFiles.generated') }}" ```  <img width="872" height="513" alt="Image" src="https://github.com/user-attachments/assets/f6d329d4-e94c-4d56-82dc-5fb8e87c7c0f" />   ---  while neither is "pretty", this will only be fixed with a rework how forEach outputs work :( 

- **Issue #14214** (2026-01-20): **Preview text file buttons not visible for 1 line files**
  *Symptoms*: ### Describe the issue  <img width="1439" height="424" alt="Image" src="https://github.com/user-attachments/assets/b06a6af6-0978-4608-9662-caf21069cf72" />   Preview 1.txt:  ```yaml id: output_file_example namespace: company.team  tasks:   - id: echo     type: io.kestra.plugin.scripts.shell.Commands     commands:       - echo "Hello John" > {{ workingDir }}/1.txt     outputFiles:       - "*.txt" ```  ### Environment  - Kestra Version: `develop` 
  **Post-Mortem & Fix Analysis**:
  > hi @wrussell1999 @MilosPaunovic  can you assign this issue to me. Thanks !
  > Hey @wrussell1999, could you double check this, as it was amended as part of https://github.com/kestra-io/kestra/issues/13775 few days ago?
  > Seems to be working on OSS and EE `develop` today. Thanks!  <img width="783" height="320" alt="Image" src="https://github.com/user-attachments/assets/566d9f11-54c2-403a-bb97-1d0c5e379503" />

- **Issue #14212** (2026-01-21): **Flows page table doesn't show the correct number per page when filters load**
  *Symptoms*: ### Describe the issue  Seems the number per page doesn't always get added to the URL when the other filters get loaded in.  OSS:  https://github.com/user-attachments/assets/27139b7e-e389-47eb-b740-24a77415099c  EE:  https://github.com/user-attachments/assets/8136a7f4-e534-461a-9626-138072cec26a   ### Environment  - Kestra Version: `develop` 
  **Post-Mortem & Fix Analysis**:
  > Hey @wrussell1999,  Can you check if this is fixed now that the https://github.com/kestra-io/kestra/issues/14171 is closed?
  > Thanks so much! Fixed on OSS and EE.  However it seems that it's not adding `size` to Logs global page on both OSS and EE. Didn't notice it happening on other places when I opened this issue. Will close this and open a new issue: https://github.com/kestra-io/kestra/issues/14257

- **Issue #14209** (2026-01-19): **[UI] Profile icon text is not readable in sidebar on light mode**
  *Symptoms*: ### Describe the issue  In light mode, the profile icon in the sidebar has a dark background and dark user initial text inside the icon. Because of this, the text inside the profile icon is hard to read.  ### Reproducibility and Visuals  <img width="963" height="1077" alt="Image" src="https://github.com/user-attachments/assets/3a47785f-139f-4d90-b969-357ecd8f2646" />  ### Environment  - Kestra Version: 1.0.23 
  **Post-Mortem & Fix Analysis**:
  > Closing this, as this a EE only issue

- **Issue #14201** (2026-01-20): **Irrelevant editor error**
  *Symptoms*: ```yaml  triggers:   - id: every_day     type: io.kestra.plugin.core.trigger.Schedule     cron: "@daily"     conditions:       - type: io.kestra.plugin.core.condition.ExpressionCondition         expression: "{{  globals['trigger-enabled'] is defined }}" ```  The error shows :  ``` Value must be "io.kestra.plugin.core.condition.ExecutionOutputs" | "io.kestra.plugin.core.condition.Expression".yaml-schema: Condition based on the outputs of an upstream execution. | Condition based on variable expression.(1) ```  Totally unrelated and the syntax is valid   <img width="1335" height="231" alt="Image" src="https://github.com/user-attachments/assets/078669b8-fcd3-4f43-952c-3275f65e9c93" />
  **Post-Mortem & Fix Analysis**:
  > Hey can I work on this issue?
  > can you assign this issue i want to work 

- **Issue #14199** (2026-01-20): **Purple is back in tables (regression)**
  *Symptoms*: ### Describe the issue  There is a regression on these two tables. We previously agreed to stop using purple in tables. On hover, only a highlight should indicate the presence of a link, without using the purple color.  <img width="975" height="783" alt="Image" src="https://github.com/user-attachments/assets/d73e6011-5863-4a1d-b3ca-00cff48112e1" /> <img width="1732" height="1031" alt="Image" src="https://github.com/user-attachments/assets/425dd5df-78d0-447a-b537-60c005aa298f" />  For example:   <img width="677" height="432" alt="Image" src="https://github.com/user-attachments/assets/f7756867-4e60-4fc8-9850-4bd4555ad5e6" />  <img width="765" height="976" alt="Image" src="https://github.com/user-attachments/assets/d8e8425e-5b9a-4065-b649-b4d4b7259f4c" />  ### Environment  - Kestra Version: develop 
  **Post-Mortem & Fix Analysis**:
  > hey @MilosPaunovic   I would like to work on this small bug if it is not assigned.
  > Thanks for the contribution @oion, it's much appreciated! 🚀

- **Issue #14176** (2026-01-20): **[UI] Z-Index of Menu icons is wrong**
  *Symptoms*: ### Describe the issue  is <img width="268" height="73" alt="Image" src="https://github.com/user-attachments/assets/8c17293f-f0dc-4431-9304-077eb6a1ce43" />  should <img width="250" height="82" alt="Image" src="https://github.com/user-attachments/assets/b0b23356-55f2-40d2-9b43-5be91153d29b" />  ### Environment  - Kestra Version: develop 
  **Post-Mortem & Fix Analysis**:
  > can i do it ? 
  > Absolutely, go for it @neelamber-mishra, thanks! 🚀
  > Thanks for the contribution @neelamber-mishra, it's much appreciated! 🚀

- **Issue #14171** (2026-01-20): **Filters cleared clicking twice on some left side tabs**
  *Symptoms*: ### Describe the issue  If I click twice on Dashboards, Flows, Executions, or Logs the filters are cleared on that page/view. This appears to be a bug.  https://github.com/user-attachments/assets/0be74624-790b-4aa4-bc4c-8a5eaa58535c  ### Environment  - Kestra Version: develop  (I'm running EE 1.2.0, but it sounds like this is happening in other environments too.) 
  **Post-Mortem & Fix Analysis**:
  > I can work on this issue!
  > Thanks for the contribution @mahadevaperuka, it's much appreciated! 🚀

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

### Incident Patch 1: `f6dbbb49` (2026-10-05)
**Commit Message**: test(ui): cover humanizeDuration edge cases (#20240)

Add cases to filters.spec.ts for humanizeDuration: sub-second
formatting, per-unit rendering (s/m/h), multi-unit spans, zero,
nullish inputs, and negative durations.

Closes #20186

**File**: `ui/tests/unit/utils/filters.spec.ts` (modified, +52/-1)
```diff
@@ -1,6 +1,6 @@
 import {afterEach, beforeEach, describe, expect, it} from "vitest"
 import {dayjs} from "@kestra-io/design-system"
-import {date, humanizeNumber} from "../../../src/utils/filters"
+import {date, humanizeDuration, humanizeNumber} from "../../../src/utils/filters"
 import {storageKeys} from "../../../src/utils/constants"
 
 describe("humanizeNumber", () => {
@@ -69,3 +69,54 @@ describe("date", () => {
         expect(date(INSTANT, "iso")).toBe("2026-07-24 13:16:00.000")
     })
 })
+
+describe("humanizeDuration", () => {
+    // humanDuration reads the unit language from localStorage, so a leftover "lang" from
+    // another test would swap "s"/"m"/"h" for their translations and break these assertions.
+    afterEach(() => {
+        localStorage.removeItem("lang")
+    })
+
+    it("formats a sub-second duration rather than rounding it away", () => {
+        // The trailing-decimal padding (.5s -> .50s) is the branch a single-digit case exercises.
+        expect(humanizeDuration(0.5)).toBe("0.50s")
+    })
+
+    it.each([
+        ["seconds", 5, "5s"],
+        ["minutes", 60, "1m"],
+        ["hours", 3600, "1h"],
+    ])("renders %s with their own unit", (_label, seconds, expected) => {
+        expect(humanizeDuration(seconds)).toBe(expected)
+    })
+
+    it("renders the significant units of a duration that spans several", () => {
+        // largest is capped at 2, so an hour-and-a-bit shows hours and minutes but drops the seconds.
+        expect(humanizeDuration(3661)).toBe("1h, 1m")
+        expect(humanizeDuration(90061)).toBe("1d, 1h")
+    })
+
+    it("renders zero as a real value rather than an empty string", () => {
+        expect(humanizeDuration(0)).toBe("0s")
+    })
+
+    // Durations are read off execution records that can be missing, so a nullish value must
+    // degrade to a label rather than throw on the hot path every execution row goes through.
+    it.each([
+        ["undefined", undefined],
+        ["null", null],
+    ])("does not throw for %s", (_label, value) => {
+        expect(() => humanizeDuration(value as unknown as number)).not.toThrow()
+        expect(humanizeDuration(value as unknown as number)).toBe("0s")
+    })
+
+    it("handles a negative duration rather than producing nonsense", () => {
+        // A clock skew between workers can yield a negative span; it must still format to a
+        // real, non-empty unit label instead of "NaN" or an empty string.
+        const result = humanizeDuration(-5)
+
+        expect(result).not.toBe("")
+        expect(result).not.toMatch(/nan/i)
+        expect(result).toBe("5s")
+    })
+})
```

---

### Incident Patch 2: `f424c081` (2026-10-05)
**Commit Message**: fix(webserver): make bulk flow delete by-ids atomic and validate ids upfront (#19374)

* fix(webserver): make bulk flow delete by-ids atomic and validate ids upfront

* fix(test): add missing ProblemTypes import in FlowControllerTest

**File**: `webserver/src/main/java/io/kestra/webserver/controllers/api/FlowController.java` (modified, +28/-7)
```diff
@@ -55,6 +55,11 @@
 import io.kestra.webserver.services.SourceSearchService;
 import io.kestra.webserver.utils.CSVUtils;
 import io.kestra.webserver.utils.PageableUtils;
+import io.kestra.webserver.errors.ProblemDetail;
+import io.kestra.webserver.errors.ProblemError;
+import io.kestra.webserver.errors.ProblemType;
+import io.kestra.webserver.errors.ProblemTypes;
+import io.kestra.webserver.exceptions.BulkValidationException;
 
 import io.micronaut.core.annotation.Nullable;
 import io.micronaut.data.model.Pageable;
@@ -882,16 +887,28 @@ public HttpResponse<BulkResponse> deleteFlowsByQuery(
         summary = "Delete flows by their IDs."
     )
     @ApiResponse(responseCode = "200", description = "On success", content = { @Content(schema = @Schema(implementation = BulkResponse.class)) })
+    @ApiResponse(responseCode = "400", description = "Validation errors", content = { @Content(schema = @Schema(implementation = ProblemDetail.class)) })
     public HttpResponse<BulkResponse> deleteFlowsByIds(
         @RequestBody(description = "A list of tuple flow ID and namespace as flow identifiers") @Body List<IdWithNamespace> ids) throws QueueException {
-        List<Flow> list = ids
-            .stream()
-            .map(id -> flowRepository.findByIdWithSource(tenantService.resolveTenant(), id.getNamespace(), id.getId()).orElseThrow())
-            .peek(throwConsumer(flow -> flowService.delete(flow)))
-            .collect(Collectors.toList());
+            List<FlowWithSource> flows = new ArrayList<>();
+            List<ProblemError> invalids = new ArrayList<>();
+
+            for (IdWithNamespace id : ids) {
+                Optional<FlowWithSource> flow = flowRepository.findByIdWithSource(tenantService.resolveTenant(), id.getNamespace(), id.getId());
+                if (flow.isPresent()) {
+                    flows.add(flow.get());
+                } else {
+                    invalids.add(flowProblem(id, "flow not found", ProblemTypes.NOT_FOUND));
+                }
+            }
+            if (!invalids.isEmpty()) {
+                throw new BulkValidationException("One or more flows could not be deleted.", invalids);
+            }
 
-        return HttpResponse.ok(BulkResponse.builder().count(list.size()).build());
-    }
+            flows.forEach(throwConsumer(flow -> flowService.delete(flow)));
+
+            return HttpResponse.ok(BulkResponse.builder().count(flows.size()).build());
+        }
 
     @ExecuteOn(TaskExecutors.IO)
     @Post(uri = "/disable/by-query")
@@ -1102,4 +1119,8 @@ public record FlowWithDeprecatedTasks(
         Integer revision,
         List<FlowService.TaskDeprecation> deprecatedTasks) {
     }
+
+        private static ProblemError flowProblem(IdWithNamespace id, String detail, ProblemType type) {
+        return ProblemError.ofItem(detail, "flows[" + id.getNamespace() + "." + id.getId() + "]", type);
+    }
 }
```

**File**: `webserver/src/test/java/io/kestra/webserver/controllers/api/FlowControllerTest.java` (modified, +44/-0)
```diff
@@ -53,6 +53,7 @@
 import io.kestra.webserver.models.flows.SourceSearchResult;
 import io.kestra.webserver.responses.BulkResponse;
 import io.kestra.webserver.responses.PagedResults;
+import io.kestra.webserver.errors.ProblemTypes;
 
 import io.micronaut.core.type.Argument;
 import io.micronaut.http.*;
@@ -1486,6 +1487,49 @@ void deleteFlowFlowsByIds() {
         assertThat(e.getStatus().getCode()).isEqualTo(HttpStatus.NOT_FOUND.getCode());
     }
 
+    @Test
+    void deleteFlowsByIdsShouldDeleteAllGivenFlows() {
+        postFlow("byIdsA", "io.kestra.unittest.deletebyids", "a");
+        postFlow("byIdsB", "io.kestra.unittest.deletebyids", "b");
+
+        List<IdWithNamespace> ids = List.of(
+            new IdWithNamespace("io.kestra.unittest.deletebyids", "byIdsA"),
+            new IdWithNamespace("io.kestra.unittest.deletebyids", "byIdsB")
+        );
+
+        HttpResponse<BulkResponse> response = client
+            .toBlocking()
+            .exchange(DELETE("/api/v1/main/flows/delete/by-ids", ids), BulkResponse.class);
+
+        assertThat(response.getBody().get().getCount()).isEqualTo(2);
+
+        assertThrows(HttpClientResponseException.class, () ->
+            client.toBlocking().retrieve(HttpRequest.GET("/api/v1/main/flows/io.kestra.unittest.deletebyids/byIdsA")));
+        assertThrows(HttpClientResponseException.class, () ->
+            client.toBlocking().retrieve(HttpRequest.GET("/api/v1/main/flows/io.kestra.unittest.deletebyids/byIdsB")));
+    }
+
+    @Test
+    void deleteFlowsByIdsShouldNotDeleteAnyFlowWhenOneIdIsMissing() {
+        postFlow("keepMe", "io.kestra.unittest.deletebyidspartial", "a");
+
+        List<IdWithNamespace> ids = List.of(
+            new IdWithNamespace("io.kestra.unittest.deletebyidspartial", "keepMe"),
+            new IdWithNamespace("io.kestra.unittest.deletebyidspartial", "doesNotExist")
+        );
+
+        HttpClientResponseException e = assertThrows(HttpClientResponseException.class, () ->
+            client.toBlocking().exchange(DELETE("/api/v1/main/flows/delete/by-ids", ids), BulkResponse.class));
+
+        assertThat(e.getStatus().getCode()).isEqualTo(HttpStatus.BAD_REQUEST.getCode());
+        Problems.assertProblem(e, ProblemTypes.BULK_VALIDATION_FAILED);
+
+        // The valid flow must survive: the endpoint validates every id up front and mutates
+        // nothing when any id in the batch does not exist.
+        String flow = client.toBlocking().retrieve(HttpRequest.GET("/api/v1/main/flows/io.kestra.unittest.deletebyidspartial/keepMe"), String.class);
+        assertThat(flow).isNotNull();
+    }
+
     @Test
     void validateFlows() throws IOException {
         URL resource = TestsUtils.class.getClassLoader().getResource("flows/validateMultipleValidFlows.yaml");
```

---

### Incident Patch 3: `0e7d0cc9` (2026-10-05)
**Commit Message**: fix(flows): playground run saves a draft instead of publishing (#20370)

Closes https://github.com/kestra-io/kestra-ee/issues/11369.

Run task in the Playground saves unsaved edits as a draft and runs it,
so production keeps the last published revision. A new flow is saved as
a draft without the confirm dialog, and the playground stays on after the
redirect. Flows created as drafts now report FLOW_CREATED with is_draft.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01TAeCXxAQmk9wJNMeJsazPu

**File**: `ui/scripts/translations/fingerprints.json` (modified, +0/-1)
```diff
@@ -1356,7 +1356,6 @@
   "paused duration": "5a9d6f89cfdd",
   "playground actions": "668e6b6b4fb6",
   "playground|clear_history": "496121494e4a",
-  "playground|confirm_create": "ac4624fdb531",
   "playground|history": "574a1ec72335",
   "playground|play_icon_info": "f3a0e00d687f",
   "playground|run_all_tasks": "c8f20ec2ae48",
```

**File**: `ui/src/stores/flow.ts` (modified, +3/-4)
```diff
@@ -615,9 +615,7 @@ export const useFlowStore = defineStore("flow", () => {
             localStorage.removeItem(`el-fl-creation-${creationId.value}`)
             creationId.value = undefined
 
-            if (!options.draft) {
-                trackFlowCreated(flow.value, options.restore === true)
-            }
+            trackFlowCreated(flow.value, options.restore === true, options.draft === true)
 
             return flow.value
         })
@@ -626,7 +624,7 @@ export const useFlowStore = defineStore("flow", () => {
     // Only on creation: saveFlow() fires on every editor save, which would drown the signal.
     // restoreFlow() also goes through createFlow(), on a flow_id that already reported a creation -
     // flagged rather than dropped so activation can exclude it downstream.
-    function trackFlowCreated(created: Flow, isRestore: boolean) {
+    function trackFlowCreated(created: Flow, isRestore: boolean, isDraft: boolean) {
         const {taskCount, pluginCount} = flowTaskStats(created.tasks)
 
         useApiStore().posthogEvents({
@@ -638,6 +636,7 @@ export const useFlowStore = defineStore("flow", () => {
             trigger_type: primaryTriggerType(created.triggers),
             is_example: isExampleFlow(created.namespace),
             is_restore: isRestore,
+            is_draft: isDraft,
         })
     }
 
```

**File**: `ui/src/stores/playground.ts` (modified, +17/-20)
```diff
@@ -6,9 +6,7 @@ import {Execution, useExecutionsStore} from "./executions"
 import {normalize} from "../utils/inputs"
 import {useRoute, useRouter} from "vue-router"
 import {State, isDeepEqual} from "@kestra-io/design-system"
-import {useToast} from "../utils/toast"
-import {useI18n} from "vue-i18n"
-import {Flow, useFlowStore} from "./flow"
+import {Flow, isSuccessfulFlowSaveOutcome, useFlowStore} from "./flow"
 import type {FlowForExecution} from "@kestra-io/kestra-sdk"
 import {useFileExplorerStore} from "./fileExplorer"
 import type {KestraHttpError} from "../utils/kestraHttp"
@@ -51,7 +49,7 @@ export const usePlaygroundStore = defineStore("playground", () => {
 
     function navigateToEdit(runUntilTaskId?: string, runDownstreamTasks?: boolean) {
         const flowParsed = flowStore.flow
-        router.push({
+        return router.push({
             name: "flows/update/edit",
             params: {
                 id: flowParsed?.id,
@@ -229,8 +227,6 @@ export const usePlaygroundStore = defineStore("playground", () => {
     const showInputPrompt = ref(false)
     const actionOptions = ref<{taskId?: string, runDownstreamTasks?: boolean}>()
 
-    const toast = useToast()
-
     // Ensure Files panel reflects changes after Playground executions (e.g., Namespace/Tenant sync tasks)
     // When an execution transitions from a non-final state to a final state, refresh the files tree
     // @see https://github.com/kestra-io/plugin-git/issues/188
@@ -265,8 +261,6 @@ export const usePlaygroundStore = defineStore("playground", () => {
         }
     }
 
-    const {t} = useI18n()
-
     async function runUntilTask(taskId?: string, runDownstreamTasks = false, customFormData?: Record<string, unknown>) {
         if(readyToStart.value === false) {
             console.warn("Playground is not ready to start, latest execution is still in progress")
@@ -275,6 +269,20 @@ export const usePlaygroundStore = defineStore("playground", () => {
         if (flowStore.haveChange && flowStore.flowErrors) {
             return
         }
+        if (flowStore.isCreating) {
+            starting.value = true
+            let outcome
+            try {
+                outcome = await flowStore.saveAsDraft()
+            } finally {
+                starting.value = false
+            }
+            if (isSuccessfulFlowSaveOutcome(outcome)) {
+                await navigateToEdit(taskId, runDownstreamTasks)
+                enabled.value = true
+            }
+            return
+        }
         starting.value = true
         try {
             await startRun(taskId, runDownstreamTasks, customFormData)
@@ -284,18 +292,7 @@ export const usePlaygroundStore = defineStore("playground", () => {
     }
 
     async function startRun(taskId?: string, runDownstreamTasks = false, customFormData?: Record<string, unknown>) {
-        if(flowStore.isCreating){
-            toast.confirm(
-                t("playground.confirm_create"),
-                async () => {
-                    await flowStore.saveAll()
-                    navigateToEdit(taskId, runDownstreamTasks)
-                },
-            )
-            return
-        }
-
-        await flowStore.saveAll()
+        await flowStore.saveAsDraft()
         // get the next task id to break on. If current task is provided to breakpoint,
         // the task specified by the user will not be executed.
         const {nextTasksIds, graph} = await getNextTaskIds(runDownstreamTasks ? undefined : taskId) ?? {}
```

**File**: `ui/src/translations/de.json` (modified, +0/-1)
```diff
@@ -2221,7 +2221,6 @@
       "run_all_tasks": "Alle Tasks ausführen",
       "history": "Letzte 10 Runs",
       "clear_history": "Verlauf löschen",
-      "confirm_create": "Du kannst den Playground nicht ausführen, während du einen Flow erstellst. Wenn du einen Playground-Run startest, wird der Flow erstellt.",
       "tooltip_persistence": "Wenn du den Playground aus- und wieder einschaltest, bleiben die Informationen erhalten, solange du auf der Seite bleibst."
     },
     "submit": "Absenden",
```

**File**: `ui/src/translations/en.json` (modified, +0/-1)
```diff
@@ -2221,7 +2221,6 @@
       "run_all_tasks": "Run All Tasks",
       "history": "Last 10 runs",
       "clear_history": "Clear history",
-      "confirm_create": "You cannot run the playground while creating a flow. Launching a playground run will create the flow.",
       "tooltip_persistence": "If you turn Playground off and back on, the information remains as long as you stay on the page."
     },
     "submit": "Submit",
```

**File**: `ui/src/translations/es.json` (modified, +0/-1)
```diff
@@ -2221,7 +2221,6 @@
       "run_all_tasks": "Ejecutar Todas las Tasks",
       "history": "Últimas 10 ejecuciones",
       "clear_history": "Borrar historial",
-      "confirm_create": "No puedes ejecutar el playground mientras creas un flow. Iniciar una ejecución de playground creará el flow.",
       "tooltip_persistence": "Si desactivas y vuelves a activar el Playground, la información permanece mientras te mantengas en la página."
     },
     "submit": "Enviar",
```

**File**: `ui/src/translations/fr.json` (modified, +0/-1)
```diff
@@ -2221,7 +2221,6 @@
       "run_all_tasks": "Exécuter toutes les tasks",
       "history": "Dernières 10 exécutions",
       "clear_history": "Effacer l'historique",
-      "confirm_create": "Vous ne pouvez pas exécuter le playground lors de la création d'un flow. Lancer une exécution de playground créera le flow.",
       "tooltip_persistence": "Si vous désactivez et réactivez le Playground, les informations restent tant que vous restez sur la page."
     },
     "submit": "Soumettre",
```

**File**: `ui/src/translations/hi.json` (modified, +0/-1)
```diff
@@ -2221,7 +2221,6 @@
       "run_all_tasks": "सभी Tasks चलाएं",
       "history": "पिछले 10 रन",
       "clear_history": "इतिहास साफ़ करें",
-      "confirm_create": "आप एक flow बनाते समय playground नहीं चला सकते। एक playground रन शुरू करने से flow बन जाएगा।",
       "tooltip_persistence": "यदि आप Playground को बंद करके फिर से चालू करते हैं, तो जानकारी तब तक बनी रहती है जब तक आप पृष्ठ पर रहते हैं।"
     },
     "submit": "प्रस्तुत करें",
```

---

### Incident Patch 4: `7767d411` (2026-10-05)
**Commit Message**: test(ui): add coverage for getRestoredQuery in useRestoreUrl (#20189) (#20389)

**File**: `ui/src/composables/useRestoreUrl.ts` (modified, +8/-1)
```diff
@@ -21,7 +21,14 @@ function getLocalStorageName(route: RouteLocation): string {
 
 function getRestoredUrlValue(route: RouteLocation) {
     const raw = window.sessionStorage.getItem(getLocalStorageName(route))
-    return raw ? JSON.parse(raw) : null
+    if (!raw) return null
+
+    try {
+        return JSON.parse(raw)
+    } catch {
+        // Prevent crashes from malformed sessionStorage data
+        return null
+    }
 }
 
 export function getRestoredQuery(route: RouteLocation) {
```

**File**: `ui/tests/unit/composables/useRestoreUrl.spec.ts` (modified, +49/-2)
```diff
@@ -1,8 +1,8 @@
 import {afterEach, beforeEach, describe, expect, it} from "vitest"
 import {defineComponent, h} from "vue"
 import {mount, VueWrapper} from "@vue/test-utils"
-import {createRouter, createMemoryHistory, type Router} from "vue-router"
-import useRestoreUrl from "../../../src/composables/useRestoreUrl"
+import {createRouter, createMemoryHistory, type Router, type RouteLocation} from "vue-router"
+import useRestoreUrl, {getRestoredQuery} from "../../../src/composables/useRestoreUrl"
 
 const SAVED_QUERY = {"filters[timeRange][EQUALS]": "PT24H"}
 
@@ -27,6 +27,12 @@ function mountRestoreUrl(router: Router) {
 describe("useRestoreUrl", () => {
     let wrapper: VueWrapper
 
+    const mockRoute = {
+        name: "home",
+        params: {tenant: "main"},
+        query: {}
+    } as unknown as RouteLocation
+
     beforeEach(() => {
         window.sessionStorage.clear()
     })
@@ -86,4 +92,45 @@ describe("useRestoreUrl", () => {
 
         expect(router.currentRoute.value.query).toEqual(explicit)
     })
+
+    it("restores a stored query in full via getRestoredQuery", () => {
+        const stored = {filter: "test", sort: "asc"}
+        window.sessionStorage.setItem("home_main_restore_url", JSON.stringify(stored))
+        const result = getRestoredQuery(mockRoute)
+        expect(result.query).toEqual({filter: "test", sort: "asc"})
+        expect(result.change).toBe(true)
+    })
+
+    it("yields an empty query rather than undefined when nothing is stored", () => {
+        const result = getRestoredQuery(mockRoute)
+        expect(result.query).toEqual({})
+        expect(result.change).toBe(false)
+        expect(result.localStorageValue).toBeNull()
+    })
+
+    it("ignores a malformed stored value instead of throwing", () => {
+        window.sessionStorage.setItem("home_main_restore_url", "{ invalid json }")
+        expect(() => getRestoredQuery(mockRoute)).not.toThrow()
+        
+        const result = getRestoredQuery(mockRoute)
+        expect(result.query).toEqual({})
+        expect(result.change).toBe(false)
+        expect(result.localStorageValue).toBeNull()
+    })
+
+    it("ensures array-valued query parameters survive the round trip", () => {
+        const stored = {tags: ["a", "b"]}
+        window.sessionStorage.setItem("home_main_restore_url", JSON.stringify(stored))
+        const result = getRestoredQuery(mockRoute)
+        expect(result.query).toEqual({tags: ["a", "b"]})
+        expect(result.change).toBe(true)
+    })
+
+    it("distinguishes an explicitly empty stored query from nothing stored", () => {
+        window.sessionStorage.setItem("home_main_restore_url", JSON.stringify({}))
+        const result = getRestoredQuery(mockRoute)
+        expect(result.query).toEqual({})
+        expect(result.change).toBe(false)
+        expect(result.localStorageValue).toEqual({})
+    })
 })
```

---

### Incident Patch 5: `9454e3df` (2026-10-05)
**Commit Message**: fix(design-system): replace explicit any in dialog and drawer (#20246)

**File**: `ui/packages/design-system/src/components/Feedback/KsDialog.vue` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
         :width="resolvedWidth"
         :class="{'is-form-layout': formLayout, 'is-fill': fill}"
         :beforeClose="guardedBeforeClose"
-        v-bind="({...filteredProps(), ...$attrs} as any)"
+        v-bind="{...filteredProps(), ...$attrs}"
         @close="emit('close')"
     >
         <template v-if="$slots.default" #default>
```

**File**: `ui/packages/design-system/src/components/Feedback/KsDrawer.vue` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
         :size="resizable ? drawerSize : ''"
         :appendToBody="true"
         :beforeClose="guardedBeforeClose"
-        v-bind="({...filteredProps(), ...$attrs} as any)"
+        v-bind="{...filteredProps(), ...$attrs}"
         :class="{'full-screen': fullScreen && !resizable}"
         @resize-end="onResizeEnd"
         @before-close="emit('before-close', $event)"
```

**File**: `ui/scripts/explicit-any/baseline.json` (modified, +0/-2)
```diff
@@ -7,8 +7,6 @@
   "packages/design-system/src/components/Basic/KsSplitter/KsSplitterPanel.vue": 1,
   "packages/design-system/src/components/Basic/KsText.vue": 1,
   "packages/design-system/src/components/Data/KsDataTable/KsDataTable.vue": 31,
-  "packages/design-system/src/components/Feedback/KsDialog.vue": 1,
-  "packages/design-system/src/components/Feedback/KsDrawer.vue": 1,
   "packages/design-system/src/components/Feedback/KsPopover.vue": 1,
   "packages/design-system/src/components/Feedback/KsTooltip.vue": 1,
   "packages/design-system/src/components/Form/KsAutocomplete.vue": 5,
```

---

### Incident Patch 6: `e06b2730` (2026-10-05)
**Commit Message**: fix(triggers): log an unrenderable Flow trigger `when` on both the execution and the flow (#19913)

* fix(triggers): log an unrenderable Flow trigger `when` on both the execution and the flow

A Flow trigger `when` that could not be rendered was treated as a non-match, so the
trigger silently never fired — the only trace was a WARN on the upstream execution's
log, and nothing at all on the flow that owns the trigger. The failure is now logged in
both places, since the two flows may belong to different teams: a WARN on the evaluated
execution (not its error, but it surfaces that something went wrong) and an ERROR on the
flow that owns the trigger (its own misconfiguration), for both the trigger-level `when`
and each `dependsOn` entry's `when`. A `when` that legitimately renders to a falsy value
stays a silent non-match, and no execution is ever created for an unrenderable one.

Also exposes `execution.namespace`, `execution.flowId` and `execution.hasRetryAttempt`
on the run context (and documents them), the last replacing the `HasRetryAttempt`
condition removed in the 2.0 trigger redesign.

The executor test harness now wires a real FlowTriggerService, so a full executor cycle
exerc

**File**: `core/src/main/java/io/kestra/core/runners/RunVariables.java` (modified, +6/-0)
```diff
@@ -9,6 +9,7 @@
 import io.kestra.core.exceptions.IllegalVariableEvaluationException;
 import io.kestra.core.models.Label;
 import io.kestra.core.models.executions.Execution;
+import io.kestra.core.models.executions.ExecutionMetadata;
 import io.kestra.core.models.executions.LoopRun;
 import io.kestra.core.models.executions.TaskRun;
 import io.kestra.core.models.flows.FlowInterface;
@@ -59,6 +60,7 @@ public final class RunVariables {
         "vars",
         // Execution
         "execution",
+        "execution.attemptNumber",
         "execution.id",
         "execution.originalId",
         "execution.outputs",
@@ -250,6 +252,10 @@ static Map<String, Object> of(Execution execution, Map<String, Object> execution
             executionMap.put("state", execution.getState().getCurrent());
         }
 
+        Optional.ofNullable(execution.getMetadata())
+            .map(ExecutionMetadata::getAttemptNumber)
+            .ifPresent(attemptNumber -> executionMap.put("attemptNumber", attemptNumber));
+
         Optional.ofNullable(execution.getState()).map(State::getStartDate)
             .ifPresent(startDate -> executionMap.put("startDate", startDate));
 
```

**File**: `core/src/main/java/io/kestra/core/services/ConditionService.java` (modified, +24/-0)
```diff
@@ -3,6 +3,7 @@
 import java.util.Optional;
 
 import io.kestra.core.exceptions.IllegalVariableEvaluationException;
+import io.kestra.core.exceptions.InternalException;
 import io.kestra.core.models.conditions.ConditionContext;
 import io.kestra.core.models.executions.Execution;
 import io.kestra.core.models.flows.Flow;
@@ -48,6 +49,29 @@ public boolean isValid(AbstractTrigger trigger, Flow flow, RunContext runContext
         return !isNotValid(flow, runContext, trigger.getWhen());
     }
 
+    /**
+     * Evaluates a trigger <code>when</code> and returns whether it is met, <b>without</b> swallowing a
+     * rendering failure the way {@link #isValid(AbstractTrigger, Flow, RunContext)} does. The caller is
+     * expected to surface the misconfiguration (e.g. by failing the triggered execution) rather than
+     * treating an unrenderable expression as a silent non-match.
+     *
+     * @throws IllegalVariableEvaluationException if the <code>when</code> cannot be rendered
+     */
+    public boolean isTriggerConditionMet(AbstractTrigger trigger, RunContext runContext) throws IllegalVariableEvaluationException {
+        return !TruthUtils.isFalsy(runContext.render(trigger.getWhen()));
+    }
+
+    /**
+     * Evaluates a single condition and returns whether it is met, <b>without</b> swallowing an
+     * evaluation failure the way {@link #isValid(Condition, FlowInterface, Execution, RunContext)} does.
+     * Used to surface an unrenderable <code>dependsOn</code> <code>when</code> instead of dropping it.
+     *
+     * @throws InternalException if the condition cannot be evaluated (e.g. an unrenderable <code>when</code>)
+     */
+    public boolean isConditionMet(Condition condition, FlowInterface flow, Execution execution, RunContext runContext) throws InternalException {
+        return condition.test(this.conditionContext(runContext, flow, execution));
+    }
+
     /**
      * @return true if the multiple condition is valid for the given flow and run context.
      */
```

**File**: `core/src/main/java/io/kestra/plugin/core/trigger/Flow.java` (modified, +2/-0)
```diff
@@ -53,6 +53,8 @@
     description = """
         Fires when upstream Flow executions meet `dependsOn` (required) and optional trigger `when` condition. Lets you chain Flows owned by different teams.
 
+        The trigger `when` and each `dependsOn` `when` are evaluated against the upstream execution: `flow` is the upstream flow (use `flow.namespace` and `flow.id`), `execution` the upstream execution (`execution.state`, `execution.attemptNumber`), `labels` its labels and `outputs` its task outputs; its flow outputs are under `execution.outputs`.
+
         Upstream execution outputs are exposed under `trigger.outputs`; you can also pass `inputs` to the downstream Flow."""
 )
 @Plugin(
```

**File**: `core/src/test/java/io/kestra/core/runners/RunVariablesTest.java` (modified, +20/-0)
```diff
@@ -13,6 +13,7 @@
 
 import io.kestra.core.models.Label;
 import io.kestra.core.models.executions.Execution;
+import io.kestra.core.models.executions.ExecutionMetadata;
 import io.kestra.core.models.executions.ExecutionTrigger;
 import io.kestra.core.models.executions.LoopRun;
 import io.kestra.core.models.executions.TaskRun;
@@ -255,6 +256,25 @@ void shouldBuildVariablesGivenFlowWithLabelsAndNoExecution() {
         assertThat(variables.get("labels")).isEqualTo(Map.of("some", "label"));
     }
 
+    @Test
+    @SuppressWarnings("unchecked")
+    void shouldExposeAttemptNumberOfTheExecution() {
+        Execution execution = Execution.builder()
+            .id("exec-id")
+            .namespace("ns")
+            .flowId("flow")
+            .state(new State())
+            .build()
+            .withMetadata(ExecutionMetadata.builder().attemptNumber(2).build());
+
+        Map<String, Object> variables = new RunVariables.DefaultBuilder()
+            .withExecution(execution)
+            .build(new RunContextLogger(), PropertyContext.create(renderer));
+
+        assertThat((Map<String, Object>) variables.get("execution"))
+            .containsEntry("attemptNumber", 2);
+    }
+
     @Test
     @SuppressWarnings("unchecked")
     void shouldBuildTriggerContextGivenExecutionWithTrigger() {
```

**File**: `executor/src/main/java/io/kestra/executor/FlowTriggerService.java` (modified, +63/-20)
```diff
@@ -3,9 +3,9 @@
 import java.time.ZonedDateTime;
 import java.util.*;
 import java.util.function.Predicate;
-import java.util.stream.Collectors;
 import java.util.stream.Stream;
 
+import io.kestra.core.exceptions.IllegalVariableEvaluationException;
 import io.kestra.core.exceptions.InternalException;
 import io.kestra.core.exceptions.KestraRuntimeException;
 import io.kestra.core.models.executions.Execution;
@@ -14,6 +14,7 @@
 import io.kestra.core.models.flows.FlowWithException;
 import io.kestra.core.models.flows.FlowWithSource;
 import io.kestra.core.models.triggers.AbstractTrigger;
+import io.kestra.core.models.triggers.multipleflows.Condition;
 import io.kestra.core.models.triggers.multipleflows.MultipleCondition;
 import io.kestra.core.models.triggers.multipleflows.MultipleConditionStateStore;
 import io.kestra.core.models.triggers.multipleflows.MultipleConditionWindow;
@@ -181,17 +182,31 @@ private Execution processMultipleConditionWindow(TransactionContext txContext, F
         RunContext runContext = runContextFactory.of(null, execution);
 
         // evaluate multiple conditions and accumulate with previously stored results
-        Map<String, Boolean> results = flowWithMultipleCondition.getMultipleCondition()
-            .getConditions()
-            .entrySet()
-            .stream()
-            .map(
-                e -> new AbstractMap.SimpleEntry<>(
-                    e.getKey(),
-                    conditionService.isValid(e.getValue(), flowWithMultipleCondition.getFlow(), execution, runContext)
-                )
-            )
-            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
+        Map<String, Boolean> results = new HashMap<>();
+        for (Map.Entry<String, Condition> condition : flowWithMultipleCondition.getMultipleCondition().getConditions().entrySet()) {
+            boolean met;
+            try {
+                met = conditionService.isConditionMet(condition.getValue(), flowWithMultipleCondition.getFlow(), execution, runContext);
+            } catch (InternalException e) {
+                // an unrenderable dependsOn `when` is a misconfiguration: log it on both the evaluated execution
+                // and the flow that owns the trigger, and treat the dependency as not matched
+                logUnrenderableWhen(runContext, flowWithMultipleCondition.getFlow(), flowWithMultipleCondition.getTrigger(), e);
+                met = false;
+            } catch (RuntimeException e) {
+                // any other evaluation error is logged and treated as a non-match, never propagated
+                // (which would otherwise fail and retry the whole multiple-condition message)
+                runContext.logger().warn(
+                    "[namespace: {}] [flow: {}] [condition: {}] Evaluate Condition Failed with error '{}'",
+                    flowWithMultipleCondition.getFlow().getNamespace(),
+                    flowWithMultipleCondition.getFlow().getId(),
+                    condition.getKey(),
+                    e.getMessage(),
+                    e
+                );
+                met = false;
+            }
+            results.put(condition.getKey(), met);
+        }
 
         // merge current results into the window (with() preserves previously true results across executions)
         MultipleConditionWindow updatedWindow = multipleConditionWindow.with(results);
@@ -266,14 +281,42 @@ private List<FlowWithFlowTrigger> computeFlowTriggers(Execution execution, Flow
         return flowTriggers(flow).map(trigger -> new FlowWithFlowTrigger(flow, trigger))
             // filter on the execution state the flow listen to
             .filter(flowWithFlowTrigger -> flowWithFlowTrigger.getTrigger().getStates().contains(execution.getState().getCurrent()))
-            // validate flow triggers conditions excluding multiple conditions
-            .filter(
-                flowWithFlowTrigger -> conditionService.isValid(
-                    flowWithFlowTrigger.getTrigger(),
-                    flowWithFlowTrigger.getFlow(),
-                    runContext
-                )
-            ).toList();
+            // validate flow triggers conditions excluding multiple conditions; an unrenderable `when` is a
+            // misconfiguration, so it is logged on both sides and the trigger does not fire
+            .filter(flowWithFlowTrigger -> {
+                try {
+                    return conditionService.isTriggerConditionMet(flowWithFlowTrigger.getTrigger(), runContext);
+                } catch (IllegalVariableEvaluationException e) {
+                    logUnrenderableWhen(runContext, flowWithFlowTrigger.getFlow(), flowWithFlowTrigger.getTrigger(), e);
+                    return false;
+                }
+            })
+            .toList();
+    }
+
+    /**
+     * Logs an unrenderable trigger {@code when} in both places it matters, since the evaluated execution and the
+     * flow that owns the trigger may belon
```

**File**: `executor/src/test/java/io/kestra/executor/FlowTriggerInvalidWhenCycleTest.java` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+package io.kestra.executor;
+
+import java.time.Instant;
+import java.util.List;
+
+import org.junit.jupiter.api.Test;
+import org.slf4j.event.Level;
+
+import io.kestra.core.executor.command.Create;
+import io.kestra.core.models.executions.Execution;
+import io.kestra.core.models.flows.FlowWithSource;
+import io.kestra.core.models.flows.State;
+import io.kestra.executor.testkit.Executions;
+import io.kestra.executor.testkit.ExecutorTestHarness;
+import io.kestra.executor.testkit.Flows;
+import io.kestra.executor.testkit.ScriptedWorker;
+import io.kestra.executor.testkit.Trace;
+
+import static io.kestra.executor.testkit.HarnessAssert.assertThat;
+import static org.assertj.core.api.Assertions.assertThat;
+
+/**
+ * Drives a full executor cycle through the real {@code DefaultExecutor} (with a real
+ * {@link io.kestra.executor.FlowTriggerService}) to prove that a Flow trigger whose {@code when} cannot be
+ * rendered does not fire, but is logged on both the evaluated execution and the flow that owns the trigger —
+ * the regression behind #10857.
+ */
+class FlowTriggerInvalidWhenCycleTest {
+
+    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
+
+    private final ExecutorTestHarness harness = ExecutorTestHarness.create();
+
+    private static FlowWithSource upstream() {
+        return Flows.yaml("""
+            id: invalid-when-upstream
+            namespace: io.kestra.tests
+            tasks:
+              - id: hello
+                type: io.kestra.plugin.core.log.Log
+                message: hi
+            """);
+    }
+
+    @Test
+    void anUnrenderableTriggerWhenIsLoggedOnBothSidesAndDoesNotFire() {
+        // Given an upstream flow and a listener whose trigger-level `when` references `namespace`,
+        // which is not available at trigger time and therefore cannot be rendered
+        FlowWithSource upstream = upstream();
+        FlowWithSource listener = Flows.yaml("""
+            id: invalid-when-listener
+            namespace: io.kestra.tests
+            triggers:
+              - id: on_upstream
+                type: io.kestra.plugin.core.trigger.Flow
+                states: [SUCCESS]
+                when: "{{ namespace }}"
+            tasks:
+              - id: noop
+                type: io.kestra.plugin.core.log.Log
+                message: never reached
+            """);
+        harness.registerFlow(upstream);
+        harness.registerFlow(listener);
+
+        // When the upstream runs to SUCCESS through the whole executor machine
+        Execution created = Executions.created(upstream);
+        Trace trace = harness.run(created, ScriptedWorker.succeeding(T0));
+        assertThat(harness).hasExecutionInState(created, State.Type.SUCCESS);
+
+        // Then the trigger does not fire: no execution is created for the listener
+        List<Execution> triggered = trace.emitted("execution")
+            .map(emission -> emission.as(Execution.class))
+            .filter(execution -> "invalid-when-listener".equals(execution.getFlowId()))
+            .toList();
+        assertThat(triggered).isEmpty();
+
+        // and it is logged on both sides: an ERROR on the flow that owns the trigger (its misconfiguration)
+        assertThat(harness.logs())
+            .anyMatch(log -> log.getLevel() == Level.ERROR && "invalid-when-listener".equals(log.getFlowId()));
+        // and a WARN on the evaluated upstream execution (not its error, but it surfaces something went wrong)
+        assertThat(harness.logs())
+            .anyMatch(log -> log.getLevel() == Level.WARN && "invalid-when-upstream".equals(log.getFlowId()));
+    }
+
+    @Test
+    void anUnrenderableDependsOnWhenIsLoggedAndDoesNotFire() {
+        // Given an upstream flow and a listener whose dependsOn entry has an unrenderable `when`
+        FlowWithSource upstream = upstream();
+        FlowWithSource listener = Flows.yaml("""
+            id: invalid-dependson-when-listener
+            namespace: io.kestra.tests
+            triggers:
+              - id: on_upstream
+                type: io.kestra.plugin.core.trigger.Flow
+                dependsOn:
+                  - namespace: io.kestra.tests
+                    flowId: invalid-when-upstream
+                    states: [SUCCESS]
+                    when: "{{ namespace }}"
+            tasks:
+              - id: noop
+                type: io.kestra.plugin.core.log.Log
+                message: never reached
+            """);
+        harness.registerFlow(upstream);
+        harness.registerFlow(listener);
+
+        // When the upstream runs to SUCCESS, the dependsOn trigger is evaluated through the multiple-condition cycle
+        Execution created = Executions.created(upstream);
+        Trace trace = harness.run(created, ScriptedWorker.succeeding(T0));
+        assertThat(harness).hasExecutionInState(created, State.Type.SUCCESS);
+
+        // Then the trigger does not fire: no execution command
```

**File**: `executor/src/test/java/io/kestra/executor/FlowTriggerServiceTest.java` (modified, +63/-3)
```diff
@@ -19,6 +19,7 @@
 import io.kestra.core.models.flows.FlowWithException;
 import io.kestra.core.models.flows.FlowWithSource;
 import io.kestra.core.models.flows.State;
+import io.kestra.core.models.property.Property;
 import io.kestra.core.models.triggers.multipleflows.MultipleCondition;
 import io.kestra.core.models.triggers.multipleflows.MultipleConditionStateStore;
 import io.kestra.core.models.triggers.multipleflows.MultipleConditionWindow;
@@ -557,14 +558,14 @@ void computeExecutionsFromFlowTriggers_whenExpressionTruthy() {
 
     @Test
     void computeExecutionsFromFlowTriggers_whenInvalidExpression() {
-        // Given - malformed Pebble expression causes IllegalVariableEvaluationException, treated as false
+        // Given - a trigger-level `when` that cannot be rendered (unknown variable)
         var simpleFlow = aSimpleFlow();
         var flowWithFlowTrigger = Flow.builder()
             .id("flow-with-flow-trigger")
             .namespace(TEST_NAMESPACE)
             .tenantId(MAIN_TENANT)
             .tasks(List.of(simpleLogTask()))
-            .triggers(List.of(flowTriggerWithWhen("{{ invalid-pebble-expression() }}")))
+            .triggers(List.of(flowTriggerWithWhen("{{ namespace }}")))
             .build();
         var simpleFlowExecution = Execution.newExecution(simpleFlow, EMPTY_LABELS).withState(State.Type.SUCCESS);
 
@@ -574,7 +575,66 @@ void computeExecutionsFromFlowTriggers_whenInvalidExpression() {
             flowWithFlowTrigger
         );
 
-        // Then
+        // Then the trigger does not fire (the misconfiguration is logged on both the evaluated execution and the
+        // flow that owns the trigger, see FlowTriggerInvalidWhenCycleTest)
+        assertThat(resultingExecutionsToRun).isEmpty();
+    }
+
+    @Test
+    void shouldNotFireWhenDependsOnTriggerLevelWhenCannotBeRendered() {
+        // Given - a dependsOn trigger whose trigger-level `when` references an unknown variable
+        var upstream = aSimpleFlow();
+        var flowWithFlowTrigger = Flow.builder()
+            .id("flow-with-flow-trigger")
+            .namespace(TEST_NAMESPACE)
+            .tenantId(MAIN_TENANT)
+            .tasks(List.of(simpleLogTask()))
+            .triggers(List.of(flowTriggerDependingOn(upstream, "{{ namespace }}")))
+            .build();
+        var simpleFlowExecution = Execution.newExecution(upstream, EMPTY_LABELS).withState(State.Type.SUCCESS);
+
+        // When
+        var resultingExecutionsToRun = flowTriggerService.computeExecutionsFromFlowTriggerDependsOn(
+            simpleFlowExecution,
+            flowWithFlowTrigger,
+            new SatisfiedWindowStateStore()
+        );
+
+        // Then the trigger does not fire (the misconfiguration is logged, not turned into an execution)
+        assertThat(resultingExecutionsToRun).isEmpty();
+    }
+
+    @Test
+    void shouldNotFireWhenDependencyLevelWhenCannotBeRendered() {
+        // Given - a dependsOn entry whose own `when` references an unknown variable
+        var upstream = aSimpleFlow();
+        var dependency = io.kestra.plugin.core.trigger.Flow.Dependency.builder()
+            .namespace(upstream.getNamespace())
+            .flowId(upstream.getId())
+            .when(Property.ofExpression("{{ namespace }}"))
+            .build();
+        var trigger = io.kestra.plugin.core.trigger.Flow.builder()
+            .id("flowTrigger")
+            .type(io.kestra.plugin.core.trigger.Flow.class.getName())
+            .dependsOn(List.of(dependency))
+            .build();
+        var flowWithFlowTrigger = Flow.builder()
+            .id("flow-with-flow-trigger")
+            .namespace(TEST_NAMESPACE)
+            .tenantId(MAIN_TENANT)
+            .tasks(List.of(simpleLogTask()))
+            .triggers(List.of(trigger))
+            .build();
+        var simpleFlowExecution = Execution.newExecution(upstream, EMPTY_LABELS).withState(State.Type.SUCCESS);
+
+        // When
+        var resultingExecutionsToRun = flowTriggerService.computeExecutionsFromFlowTriggerDependsOn(
+            simpleFlowExecution,
+            flowWithFlowTrigger,
+            new SatisfiedWindowStateStore()
+        );
+
+        // Then the trigger does not fire; the unrenderable dependency condition is logged, not fired as an execution
         assertThat(resultingExecutionsToRun).isEmpty();
     }
 
```

**File**: `executor/src/test/java/io/kestra/executor/testkit/ExecutorTestHarness.java` (modified, +16/-2)
```diff
@@ -60,6 +60,8 @@
 import io.kestra.core.services.AsyncOperationWaiter;
 import io.kestra.core.services.ConcurrencyLimitResolver;
 import io.kestra.core.services.ConcurrencyLimitService;
+import io.kestra.core.services.ConditionService;
+import io.kestra.core.services.FlowService;
 import io.kestra.core.services.ExecutionOutputService;
 import io.kestra.core.services.ExecutionService;
 import io.kestra.core.services.FlowParsingService;
@@ -298,8 +300,20 @@ private ExecutorTestHarness() {
         this.concurrencyLimitResolver = Mockito.spy(new ConcurrencyLimitResolver());
         this.quotaService = Mockito.mock(QuotaService.class);
         this.asyncOperationService = Mockito.mock(AsyncOperationService.class);
-        this.flowTriggerService = Mockito.mock(FlowTriggerService.class);
-        this.multipleConditionStateStore = Mockito.mock(MultipleConditionStateStore.class);
+        // a real FlowTriggerService so a full executor cycle actually evaluates flow-trigger `when` conditions
+        // and emits the executions they produce; the only dependency the harness cannot provide for real is
+        // FlowService, and the trigger paths only use removeUnwanted() (recursion guard) — stub it to allow processing
+        FlowService flowService = Mockito.mock(FlowService.class);
+        Mockito.when(flowService.removeUnwanted(Mockito.any(), Mockito.any())).thenReturn(true);
+        this.flowTriggerService = new FlowTriggerService(
+            new ConditionService(),
+            runContextFactory,
+            flowService,
+            flowMetaStore,
+            executionOutputService,
+            new ExecutionDepthConfiguration(100)
+        );
+        this.multipleConditionStateStore = new InMemoryMultipleConditionStateStore();
 
         this.executorService = new ExecutorService(
             runContextFactory,
```

---

### Incident Patch 7: `799c58ec` (2026-10-05)
**Commit Message**: fix(storage-local): create destination parent on move and move/delete companion metadata (#18836)

* fix(storage-local): create destination parent on move and carry companion .metadata

* style(storage-local): remove redundant comments

---------

Co-authored-by: suhanrain <[REDACTED_EMAIL]>
Co-authored-by: Miloš Paunović <[REDACTED_EMAIL]>

**File**: `storage-local/src/main/java/io/kestra/storage/local/LocalStorage.java` (modified, +16/-7)
```diff
@@ -12,9 +12,9 @@
 import java.util.function.Predicate;
 import java.util.stream.Stream;
 
-import io.kestra.core.exceptions.KestraRuntimeException;
 import org.apache.commons.io.FileUtils;
 
+import io.kestra.core.exceptions.KestraRuntimeException;
 import io.kestra.core.models.annotations.Plugin;
 import io.kestra.core.models.annotations.PluginProperty;
 import io.kestra.core.serializers.JacksonMapper;
@@ -319,12 +319,17 @@ private static URI createDirectoryFromPath(Path path, URI uri) {
 
     @Override
     public URI move(String tenantId, @Nullable String namespace, URI from, URI to) throws IOException {
+        Path sourcePath = getLocalPath(tenantId, from);
+        Path destinationPath = getLocalPath(tenantId, to);
+
         try {
-            Files.move(
-                getLocalPath(tenantId, from),
-                getLocalPath(tenantId, to),
-                StandardCopyOption.ATOMIC_MOVE
-            );
+            Files.createDirectories(destinationPath.getParent());
+            Files.move(sourcePath, destinationPath, StandardCopyOption.ATOMIC_MOVE);
+
+            Path sourceMetadataPath = Path.of(sourcePath + ".metadata");
+            if (Files.exists(sourceMetadataPath)) {
+                Files.move(sourceMetadataPath, Path.of(destinationPath + ".metadata"), StandardCopyOption.ATOMIC_MOVE);
+            }
         } catch (NoSuchFileException e) {
             throw newFileNotFound(from, e);
         }
@@ -349,7 +354,11 @@ private static boolean deleteFromPath(Path path) throws IOException {
             return true;
         }
 
-        return Files.deleteIfExists(path);
+        boolean deleted = Files.deleteIfExists(path);
+        if (deleted) {
+            Files.deleteIfExists(Path.of(path + ".metadata"));
+        }
+        return deleted;
     }
 
     @SuppressWarnings("ResultOfMethodCallIgnored")
```

**File**: `storage-local/src/test/java/io/kestra/storage/local/LocalStorageTest.java` (modified, +58/-1)
```diff
@@ -5,17 +5,24 @@
 import java.net.URI;
 import java.net.URISyntaxException;
 import java.nio.file.FileAlreadyExistsException;
+import java.nio.file.Files;
+import java.nio.file.Path;
+import java.util.Map;
 
 import org.apache.commons.lang3.RandomStringUtils;
 import org.junit.jupiter.api.Test;
 
 import io.kestra.core.storage.StorageTestSuite;
+import io.kestra.core.storages.StorageObject;
 import io.kestra.core.utils.IdUtils;
 
 import static org.hamcrest.MatcherAssert.assertThat;
+import static org.hamcrest.Matchers.hasEntry;
 import static org.hamcrest.Matchers.not;
-import static org.junit.jupiter.api.Assertions.assertThrows;
+import static org.hamcrest.Matchers.notNullValue;
 import static org.junit.jupiter.api.Assertions.assertFalse;
+import static org.junit.jupiter.api.Assertions.assertInstanceOf;
+import static org.junit.jupiter.api.Assertions.assertThrows;
 import static org.junit.jupiter.api.Assertions.assertTrue;
 
 class LocalStorageTest extends StorageTestSuite {
@@ -92,4 +99,54 @@ void shouldFailWithDescriptiveErrorWhenParentDirectoryCannotBeCreated() throws U
         );
         assertTrue(exception.getMessage().contains("blocking"));
     }
+
+    @Test
+    void shouldMoveToDestinationWithUncreatedParentDirectory() throws URISyntaxException, IOException {
+        String tenantId = IdUtils.create();
+        storageInterface.put(tenantId, null, new URI("/input.csv"), new ByteArrayInputStream("data".getBytes()));
+
+        storageInterface.move(tenantId, null, new URI("/input.csv"), new URI("/archive/2026/08/input.csv"));
+
+        assertTrue(storageInterface.exists(tenantId, null, new URI("/archive/2026/08/input.csv")));
+        assertFalse(storageInterface.exists(tenantId, null, new URI("/input.csv")));
+    }
+
+    @Test
+    void shouldMoveObjectWithCompanionMetadata() throws URISyntaxException, IOException {
+        String tenantId = IdUtils.create();
+        storageInterface.put(
+            tenantId,
+            null,
+            new URI("/source.csv"),
+            new StorageObject(Map.of("someMetadata", "someValue"), new ByteArrayInputStream("data".getBytes()))
+        );
+
+        storageInterface.move(tenantId, null, new URI("/source.csv"), new URI("/dest.csv"));
+
+        StorageObject moved = storageInterface.getWithMetadata(tenantId, null, new URI("/dest.csv"));
+        assertThat(moved.metadata(), notNullValue());
+        assertThat(moved.metadata(), hasEntry("someMetadata", "someValue"));
+        assertFalse(storageInterface.exists(tenantId, null, new URI("/source.csv")));
+    }
+
+    @Test
+    void shouldDeleteObjectWithCompanionMetadata() throws URISyntaxException, IOException {
+        String tenantId = IdUtils.create();
+        storageInterface.put(
+            tenantId,
+            null,
+            new URI("/file.txt"),
+            new StorageObject(Map.of("someMetadata", "someValue"), new ByteArrayInputStream("data".getBytes()))
+        );
+
+        assertTrue(storageInterface.delete(tenantId, null, new URI("/file.txt")));
+        assertFalse(storageInterface.exists(tenantId, null, new URI("/file.txt")));
+
+        // list() excludes metadata files, so verify the file directly.
+        LocalStorage localStorage = assertInstanceOf(LocalStorage.class, storageInterface);
+        Path orphanMetadataPath = localStorage.getBasePath().toAbsolutePath()
+            .resolve(tenantId)
+            .resolve("file.txt.metadata");
+        assertFalse(Files.exists(orphanMetadataPath));
+    }
 }
```

---

### Incident Patch 8: `056cdc54` (2026-10-05)
**Commit Message**: fix(core): stop retry race from duplicating task runs and ending executions early (#18947)

* fix(core): treat RETRYING task runs as in-flight when resolving next tasks

* fix(core): require per-task terminated coverage before ending an execution

* test(core): RETRYING task runs must not be duplicated or skipped by nexts

* test(core): isTerminated must require per-task coverage, not a matching count

**File**: `core/src/main/java/io/kestra/core/models/executions/Execution.java` (modified, +8/-3)
```diff
@@ -727,13 +727,18 @@ public boolean isTerminated(List<ResolvedTask> resolvedTasks) {
     }
 
     public boolean isTerminated(List<ResolvedTask> resolvedTasks, TaskRun parentTaskRun) {
-        long terminatedCount = this
+        // Per-task coverage: every resolved task must have at least one terminated task run.
+        // A bare count of terminated task runs can be inflated by a duplicated task run
+        // (e.g. a retry race appending a second run for the same task id), letting the
+        // execution report terminated while a task never ran.
+        Set<String> terminatedTaskUids = this
             .findTaskRunByTasks(resolvedTasks, parentTaskRun)
             .stream()
             .filter(taskRun -> taskRun.getState().isTerminated())
-            .count();
+            .map(taskRun -> IdUtils.fromParts(taskRun.getTaskId(), taskRun.getValue()))
+            .collect(Collectors.toSet());
 
-        return terminatedCount == resolvedTasks.size();
+        return resolvedTasks.stream().allMatch(resolvedTask -> terminatedTaskUids.contains(resolvedTask.uid()));
     }
 
     public boolean hasFailed() {
```

**File**: `core/src/main/java/io/kestra/core/runners/FlowableUtils.java` (modified, +2/-2)
```diff
@@ -93,7 +93,7 @@ private static List<NextTaskRun> innerResolveSequentialNexts(
         // if it has any created/submitted or running, we leave
         if (
             taskRuns.stream()
-                .anyMatch(taskRun -> taskRun.getState().isCreated() || taskRun.getState().getCurrent() == State.Type.SUBMITTED || taskRun.getState().isRunning())
+                .anyMatch(taskRun -> taskRun.getState().isCreated() || taskRun.getState().getCurrent() == State.Type.SUBMITTED || taskRun.getState().isRunning() || taskRun.getState().getCurrent() == State.Type.RETRYING)
         ) {
             return Collections.emptyList();
         }
@@ -134,7 +134,7 @@ public static List<NextTaskRun> resolveWaitForNext(
         // if it has any created/submitted or running, we leave
         if (
             taskRuns.stream()
-                .anyMatch(taskRun -> taskRun.getState().isCreated() || taskRun.getState().getCurrent() == State.Type.SUBMITTED || taskRun.getState().isRunning())
+                .anyMatch(taskRun -> taskRun.getState().isCreated() || taskRun.getState().getCurrent() == State.Type.SUBMITTED || taskRun.getState().isRunning() || taskRun.getState().getCurrent() == State.Type.RETRYING)
         ) {
             return Collections.emptyList();
         }
```

**File**: `core/src/test/java/io/kestra/core/models/executions/ExecutionTest.java` (modified, +67/-0)
```diff
@@ -12,6 +12,7 @@
 import io.kestra.core.models.Label;
 import io.kestra.core.models.flows.Flow;
 import io.kestra.core.models.flows.State;
+import io.kestra.core.models.tasks.ResolvedTask;
 import io.kestra.core.utils.IdUtils;
 import io.kestra.plugin.core.debug.Return;
 
@@ -437,4 +438,70 @@ private static Execution executionWithTaskRun(String taskId, State.Type state) {
             )
             .build();
     }
+
+    @Test
+    void isTerminatedShouldRequireEveryTaskNotJustATerminatedCount() {
+        // Regression for #18909: with a duplicated task run (retry race), the terminated
+        // task run COUNT can match the number of tasks while one task never ran - the old
+        // count-based check then reported terminated and the flow ended SUCCESS with its
+        // last task silently skipped.
+        ResolvedTask a = resolvedTask("a");
+        ResolvedTask b = resolvedTask("b");
+        ResolvedTask c = resolvedTask("c");
+
+        Execution.ExecutionBuilder base = Execution.builder()
+            .id("executionId")
+            .state(new State());
+
+        // two terminated runs for task b, none for task c
+        Execution withDuplicate = base
+            .taskRunList(List.of(
+                taskRun(a, State.Type.SUCCESS),
+                taskRun(b, State.Type.SUCCESS),
+                taskRun(b, State.Type.SUCCESS)
+            ))
+            .build();
+        assertThat(withDuplicate.isTerminated(List.of(a, b, c))).isFalse();
+
+        // one terminated run per task: terminated
+        Execution complete = base
+            .taskRunList(List.of(
+                taskRun(a, State.Type.SUCCESS),
+                taskRun(b, State.Type.SUCCESS),
+                taskRun(c, State.Type.SUCCESS)
+            ))
+            .build();
+        assertThat(complete.isTerminated(List.of(a, b, c))).isTrue();
+
+        // one task still running: not terminated
+        Execution inFlight = base
+            .taskRunList(List.of(
+                taskRun(a, State.Type.SUCCESS),
+                taskRun(b, State.Type.RUNNING),
+                taskRun(c, State.Type.SUCCESS)
+            ))
+            .build();
+        assertThat(inFlight.isTerminated(List.of(a, b, c))).isFalse();
+    }
+
+    private static ResolvedTask resolvedTask(String id) {
+        return ResolvedTask.of(
+            Return.builder()
+                .id(id)
+                .type(Return.class.getName())
+                .format(io.kestra.core.models.property.Property.ofValue(id))
+                .build()
+        );
+    }
+
+    private static int taskRunSeq = 0;
+
+    private static TaskRun taskRun(ResolvedTask task, State.Type state) {
+        return TaskRun.builder()
+            .id("taskrun-" + (++taskRunSeq))
+            .taskId(task.getTask().getId())
+            .state(new State().withState(state))
+            .build();
+    }
+
 }
```

**File**: `core/src/test/java/io/kestra/core/runners/FlowableUtilsTest.java` (modified, +73/-0)
```diff
@@ -569,6 +569,79 @@ void readLoopValuesFromUri_withBinaryIon_shouldResumeFromOffset() throws Excepti
         assertThat(result.getRight()).isEqualTo(4L);
     }
 
+
+    @Test
+    void resolveSequentialNexts_shouldNotDuplicateTaskRunWhenTaskIsRetrying() {
+        // Regression for #18909: a task run in RETRYING (task-level retry pending its
+        // ExecutionDelay) is neither created/submitted/running nor terminated, so it used to
+        // slip through the in-flight guard. With a terminated predecessor present, the nexts
+        // engine then resolved "the task after the last terminated one" - the retried task
+        // itself - and appended a SECOND task run for the same task id.
+        Execution base = Execution.builder()
+            .id("test-execution")
+            .namespace("io.kestra.test")
+            .flowId("test-flow")
+            .flowRevision(1)
+            .state(new State().withState(State.Type.RUNNING))
+            .build();
+
+        ResolvedTask setup = resolvedTask("setup");
+        ResolvedTask waiting = resolvedTask("waiting");
+        ResolvedTask last = resolvedTask("last");
+
+        TaskRun setupRun = TaskRun.of(base, setup).withState(State.Type.SUCCESS);
+        TaskRun waitingRun = TaskRun.of(base, waiting).withState(State.Type.RETRYING);
+
+        Execution execution = base.toBuilder()
+            .taskRunList(List.of(setupRun, waitingRun))
+            .build();
+
+        // When
+        List<NextTaskRun> next = FlowableUtils.resolveSequentialNexts(
+            execution,
+            List.of(setup, waiting, last)
+        );
+
+        // Then: the retried task is in-flight, so nothing may be dispatched - no duplicate
+        // task run for "waiting" and no premature dispatch of "last".
+        assertThat(next).isEmpty();
+    }
+
+    @Test
+    void resolveWaitForNext_shouldNotDuplicateTaskRunWhenTaskIsRetrying() {
+        // Same RETRYING in-flight leak as above, on the resolveWaitForNext path used by
+        // LoopUntil children.
+        Execution base = Execution.builder()
+            .id("test-execution")
+            .namespace("io.kestra.test")
+            .flowId("test-flow")
+            .flowRevision(1)
+            .state(new State().withState(State.Type.RUNNING))
+            .build();
+
+        ResolvedTask setup = resolvedTask("setup");
+        ResolvedTask waiting = resolvedTask("waiting");
+        ResolvedTask last = resolvedTask("last");
+
+        TaskRun parentRun = TaskRun.builder().id("parent").taskId("loop").build();
+        TaskRun setupRun = TaskRun.of(base, setup).withState(State.Type.SUCCESS).toBuilder().parentTaskRunId("parent").build();
+        TaskRun waitingRun = TaskRun.of(base, waiting).withState(State.Type.RETRYING).toBuilder().parentTaskRunId("parent").build();
+
+        Execution execution = base.toBuilder()
+            .taskRunList(List.of(setupRun, waitingRun))
+            .build();
+
+        List<NextTaskRun> next = FlowableUtils.resolveWaitForNext(
+            execution,
+            List.of(setup, waiting, last),
+            List.of(),
+            List.of(),
+            parentRun
+        );
+
+        assertThat(next).isEmpty();
+    }
+
     private static ResolvedTask resolvedTask(String id) {
         return ResolvedTask.of(
             Return.builder()
```

---

### Incident Patch 9: `9029b83c` (2026-09-30)
**Commit Message**: fix(executions): bound Subflow retries and keep a killed Subflow killed when its outputs cannot be rendered

When the outputs of a subflow could not be rendered, Subflow.failSubflowDueToOutput replaced the attempts of the
Subflow task run with a single one, so a retry never reached maxAttempts and the parent ran the subflow forever.
It also failed the task run whatever the subflow ended in: the kill of a parent cascades to its subflow, the
killed subflow came back FAILED, and the retry revived the killed parent. The same happened one level down, as a
killed execution whose own outputs cannot be rendered was turned into a FAILED one.

failSubflowDueToOutput now adds an attempt and keeps KILLED for a killed subflow, and the executor no longer
fails a killed execution because its outputs cannot be rendered.

**File**: `core/src/main/java/io/kestra/plugin/core/flow/Subflow.java` (modified, +4/-3)
```diff
@@ -239,15 +239,16 @@ public Optional<SubflowExecutionResult> createSubflowExecutionResult(
 
     private Optional<SubflowExecutionResult> failSubflowDueToOutput(RunContext runContext, TaskRun taskRun, Execution execution, Exception e, Map<String, Object> outputs) {
         runContext.logger().error("Failed to extract outputs with the error: '{}'", e.getLocalizedMessage(), e);
-        var state = State.Type.fail(this);
+        // a killed subflow has no outputs to extract, and failing it instead would let a retry revive a killed execution
+        var state = execution.getState().getCurrent().isKilled() ? State.Type.KILLED : State.Type.fail(this);
         taskRun = taskRun
             .withState(state)
-            .withAttempts(Collections.singletonList(TaskRunAttempt.builder().state(new State().withState(state)).build()));
+            .addAttempt(TaskRunAttempt.builder().state(new State().withState(state)).build());
 
         return Optional.of(
             SubflowExecutionResult.builder()
                 .executionId(execution.getId())
-                .state(State.Type.FAILED)
+                .state(state)
                 .parentTaskRun(taskRun)
                 .outputs(outputs)
                 .build()
```

**File**: `executor/src/main/java/io/kestra/executor/ExecutorService.java` (modified, +4/-1)
```diff
@@ -486,7 +486,10 @@ private ExecutorContext onEnd(ExecutorContext executor) {
                     e
                 );
                 runContext.logger().error("Failed to render output values: {}", e.getMessage(), e);
-                newExecution = newExecution.withState(State.Type.FAILED);
+                // the outputs of a killed execution are expected to be missing, and failing it would turn the kill into a retryable failure
+                if (finalState != State.Type.KILLED) {
+                    newExecution = newExecution.withState(State.Type.FAILED);
+                }
             }
         }
 
```

**File**: `executor/src/test/java/io/kestra/executor/statemachine/SubflowRetryTest.java` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+package io.kestra.executor.statemachine;
+
+import java.time.Instant;
+import java.util.ArrayList;
+import java.util.List;
+import java.util.concurrent.atomic.AtomicReference;
+
+import org.junit.jupiter.api.Test;
+
+import io.kestra.core.models.executions.Execution;
+import io.kestra.core.models.executions.ExecutionKilled;
+import io.kestra.core.models.executions.ExecutionKilledExecution;
+import io.kestra.core.models.flows.FlowWithSource;
+import io.kestra.core.models.flows.State;
+import io.kestra.core.runners.WorkerTask;
+import io.kestra.core.runners.WorkerTaskResult;
+import io.kestra.executor.testkit.Executions;
+import io.kestra.executor.testkit.ExecutorTestHarness;
+import io.kestra.executor.testkit.Flows;
+import io.kestra.executor.testkit.Results;
+import io.kestra.executor.testkit.ScriptedWorker;
+
+import static io.kestra.executor.testkit.HarnessAssert.assertThat;
+import static org.assertj.core.api.Assertions.assertThat;
+
+/**
+ * A Subflow task fails when the outputs of its subflow cannot be rendered, and that failure must neither retry it
+ * forever nor survive a kill of its execution.
+ */
+class SubflowRetryTest {
+
+    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
+    private static final Instant AFTER_ANY_RETRY_DELAY = Instant.parse("2100-01-01T00:00:00Z");
+
+    private final ExecutorTestHarness harness = ExecutorTestHarness.create();
+    private final List<WorkerTask> childTasks = new ArrayList<>();
+    private final FlowWithSource child = Flows.yaml("""
+        id: child
+        namespace: io.kestra.tests
+        outputs:
+          - id: verdict
+            type: STRING
+            value: "{{ outputs.work.value }}"
+        tasks:
+          - id: work
+            type: io.kestra.plugin.core.log.Log
+            message: work
+        """);
+    private final FlowWithSource parent = Flows.yaml("""
+        id: parent
+        namespace: io.kestra.tests
+        tasks:
+          - id: subflow_call
+            type: io.kestra.plugin.core.flow.Subflow
+            namespace: io.kestra.tests
+            flowId: child
+            wait: true
+            transmitFailed: true
+            retry:
+              type: constant
+              interval: PT1S
+              maxAttempts: 2
+        """);
+
+    @Test
+    void shouldStopRetryingWhenTheSubflowOutputsCannotBeRendered() {
+        // Given
+        harness.registerFlow(child);
+        harness.registerFlow(parent);
+        Execution created = Executions.created(parent);
+
+        // When: every run of the subflow ends with outputs that cannot be rendered
+        harness.run(created, recordingWorker(task -> Results.success(task, T0)));
+        for (int i = 0; i < 3; i++) {
+            harness.tickExecutionDelays(AFTER_ANY_RETRY_DELAY);
+            harness.run(List.of(), recordingWorker(task -> Results.success(task, T0)));
+        }
+
+        // Then
+        assertThat(childTasks).hasSize(2);
+        assertThat(harness).hasExecutionInState(created, State.Type.FAILED);
+    }
+
+    @Test
+    void shouldStayKilledWhenTheKilledSubflowOutputsCannotBeRendered() {
+        // Given: the subflow is running
+        harness.registerFlow(child);
+        harness.registerFlow(parent);
+        Execution created = Executions.created(parent);
+        AtomicReference<WorkerTask> running = new AtomicReference<>();
+        harness.run(created, recordingWorker(task ->
+        {
+            running.set(task);
+            return new WorkerTaskResult(task.getTaskRun().withState(State.Type.RUNNING));
+        }));
+
+        // When: the execution is killed, then its subflow, as a kill cascade does, and the running task of the subflow is killed
+        harness.run(List.of(killRequest(created.getId(), created.getTenantId())), recordingWorker(task -> Results.killed(task, T0)));
+        harness.run(List.of(killRequest(running.get().getTaskRun().getExecutionId(), created.getTenantId())), recordingWorker(task -> Results.killed(task, T0)));
+        harness.run(List.of(Results.killed(running.get(), T0)), recordingWorker(task -> Results.killed(task, T0)));
+        harness.tickExecutionDelays(AFTER_ANY_RETRY_DELAY);
+        harness.run(List.of(), recordingWorker(task -> Results.success(task, T0)));
+
+        // Then
+        assertThat(childTasks).hasSize(1);
+        assertThat(harness).hasExecutionInState(created, State.Type.KILLED);
+    }
+
+    private ScriptedWorker recordingWorker(ScriptedWorker worker) {
+        return task ->
+        {
+            childTasks.add(task);
+            return worker.run(task);
+        };
+    }
+
+    private static ExecutionKilledExecution killRequest(String executionId, String tenantId) {
+        return ExecutionKilledExecution.builder()
+            .state(ExecutionKilled.State.REQUESTED)
+            .executionId(executionId)
+            .isOnKillCascade(false)
+            .tenantId(tenantId)
+            .build();
+    }
+}
```

---

### Incident Patch 10: `8d487089` (2026-10-05)
**Commit Message**: fix(system): seed pip into the kestra-base python venv

The venv was created without pip, so pip resolved to the system /usr/bin/pip,
which Ubuntu 24.04 refuses to use (PEP 668, externally-managed-environment).
Python script tasks with pip install in beforeCommands failed on every image
built from the python kestra-base variants.

**File**: `Dockerfile.base` (modified, +1/-1)
```diff
@@ -34,6 +34,6 @@ RUN if [ "$WITH_PYTHON" = "true" ]; then \
         apt-get install -y --no-install-recommends python3 python-is-python3 python3-pip && \
         apt-get clean && \
         rm -rf /var/lib/apt/lists/* && \
-        uv venv /app/.venv && \
+        uv venv --seed /app/.venv && \
         PURE_PYTHON=1 uv pip install --python /app/.venv/bin/python kestra; \
     fi
```

---

### Incident Patch 11: `a5aa7806` (2026-10-05)
**Commit Message**: fix(flows): playground run task stuck disabled when no execution starts (#20369)

* fix(flows): playground Run task stuck disabled when no execution starts

readyToStart was a latch flipped off on click and only restored by a
watcher that never fires if nothing actually runs (cancelled create
dialog, rejected trigger). It is now derived from an in-flight flag
reset in a finally, so the button cannot outlive the request.

Closes https://github.com/kestra-io/kestra-ee/issues/9724.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_012X7H2iEK4GvHrQ7NtJhAFP

* test(flows): pin the playground in-flight guard

Adds the in-flight case so dropping the starting flag goes red, and stops
wrapping the flow store mock in a reactive proxy that Object.assign
unwrapped anyway.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_012X7H2iEK4GvHrQ7NtJhAFP

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `ui/src/stores/playground.ts` (modified, +14/-6)
```diff
@@ -212,17 +212,20 @@ export const usePlaygroundStore = defineStore("playground", () => {
         return executionReady && flowValid
     })
 
-    const readyToStart = ref(readyToStartPure.value)
+    const executionSettled = ref(readyToStartPure.value)
     watch(readyToStartPure, (newValue) => {
         if(newValue) {
             setTimeout(() => {
-                readyToStart.value = newValue
+                executionSettled.value = newValue
             }, 1000)
         } else {
-            readyToStart.value = newValue
+            executionSettled.value = newValue
         }
     })
 
+    const starting = ref(false)
+    const readyToStart = computed(() => !starting.value && readyToStartPure.value && executionSettled.value)
+
     const showInputPrompt = ref(false)
     const actionOptions = ref<{taskId?: string, runDownstreamTasks?: boolean}>()
 
@@ -272,8 +275,15 @@ export const usePlaygroundStore = defineStore("playground", () => {
         if (flowStore.haveChange && flowStore.flowErrors) {
             return
         }
-        readyToStart.value = false
+        starting.value = true
+        try {
+            await startRun(taskId, runDownstreamTasks, customFormData)
+        } finally {
+            starting.value = false
+        }
+    }
 
+    async function startRun(taskId?: string, runDownstreamTasks = false, customFormData?: Record<string, unknown>) {
         if(flowStore.isCreating){
             toast.confirm(
                 t("playground.confirm_create"),
@@ -304,7 +314,6 @@ export const usePlaygroundStore = defineStore("playground", () => {
                 }
             }
             if (hasMissing) {
-                readyToStart.value = true
                 actionOptions.value = {taskId, runDownstreamTasks}
                 executionsStore.flow = forExecution(flowStore.flow)
                 showInputPrompt.value = true
@@ -317,7 +326,6 @@ export const usePlaygroundStore = defineStore("playground", () => {
             execution = await replayOrTriggerExecution(taskId, runDownstreamTasks ? undefined : nextTasksIds, graph, customFormData)
         } catch (error: unknown) {
             if ((error as KestraHttpError | undefined)?.response?.status === 422) {
-                readyToStart.value = true
                 if (!customFormData && flowStore.flow && flowStore.flow.inputs?.length) {
                     actionOptions.value = {taskId, runDownstreamTasks}
                     executionsStore.flow = forExecution(flowStore.flow)
```

**File**: `ui/tests/unit/stores/playgroundReadyToStart.spec.ts` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+import {beforeEach, describe, expect, it, vi} from "vitest"
+import {createPinia, setActivePinia} from "pinia"
+
+vi.mock("vue-router", () => ({
+    useRoute: () => ({query: {}, params: {}}),
+    useRouter: () => ({push: vi.fn(), replace: vi.fn()}),
+}))
+
+vi.mock("vue-i18n", () => ({
+    useI18n: () => ({t: (key: string) => key}),
+}))
+
+const {flowStore, executionsStore, confirmMock} = vi.hoisted(() => ({
+    flowStore: {} as Record<string, unknown>,
+    executionsStore: {} as Record<string, unknown>,
+    confirmMock: vi.fn(),
+}))
+
+vi.mock("../../../src/stores/flow", () => ({useFlowStore: () => flowStore}))
+vi.mock("../../../src/stores/executions", () => ({useExecutionsStore: () => executionsStore}))
+vi.mock("../../../src/stores/fileExplorer", () => ({useFileExplorerStore: () => ({loadNodes: vi.fn()})}))
+vi.mock("../../../src/utils/toast", () => ({useToast: () => ({confirm: confirmMock})}))
+
+const {usePlaygroundStore} = await import("../../../src/stores/playground")
+
+describe("playground readyToStart", () => {
+    beforeEach(() => {
+        setActivePinia(createPinia())
+        confirmMock.mockReset()
+        Object.assign(flowStore, {
+            flow: {id: "f", namespace: "ns", revision: 1, inputs: []},
+            haveChange: false,
+            flowErrors: undefined,
+            isCreating: false,
+            saveAll: vi.fn().mockResolvedValue("saved"),
+            loadGraph: vi.fn().mockResolvedValue(undefined),
+        })
+        Object.assign(executionsStore, {
+            execution: undefined,
+            triggerExecution: vi.fn(),
+        })
+    })
+
+    it("should be ready again when the create confirmation is cancelled", async () => {
+        flowStore.isCreating = true
+        const store = usePlaygroundStore()
+
+        await store.runUntilTask("t1")
+
+        expect(confirmMock).toHaveBeenCalled()
+        expect(store.readyToStart).toBe(true)
+    })
+
+    it("should be ready again when triggering the execution fails", async () => {
+        executionsStore.triggerExecution = vi.fn().mockRejectedValue({response: {status: 409}})
+        const store = usePlaygroundStore()
+
+        await expect(store.runUntilTask("t1")).rejects.toBeDefined()
+
+        expect(store.readyToStart).toBe(true)
+    })
+
+    it("should stay busy while the started execution is running", async () => {
+        executionsStore.triggerExecution = vi.fn().mockResolvedValue({id: "e1", state: {current: "CREATED"}})
+        const store = usePlaygroundStore()
+
+        await store.runUntilTask("t1")
+
+        expect(store.readyToStart).toBe(false)
+    })
+
+    it("should stay busy while the trigger request is in flight", async () => {
+        let resolveTrigger: (execution: undefined) => void = () => {}
+        executionsStore.triggerExecution = vi.fn(() => new Promise((resolve) => {
+            resolveTrigger = resolve
+        }))
+        const store = usePlaygroundStore()
+
+        const run = store.runUntilTask("t1")
+        await vi.waitFor(() => expect(executionsStore.triggerExecution).toHaveBeenCalled())
+
+        expect(store.readyToStart).toBe(false)
+        resolveTrigger(undefined)
+        await run
+        expect(store.readyToStart).toBe(true)
+    })
+})
```

---

### Incident Patch 12: `29f03cfa` (2026-10-05)
**Commit Message**: fix(storage): split writer finalization failures (#20304)

* test(storage): split finalization failure regressions

Cover failed final writes, writer cleanup, exception preservation and worker failure without output publication. Include healthy empty and unmatched-input cases. The desired-contract regression commit intentionally fails 19 cases on the unmodified baseline; the following fix passes all 31.

* fix(storage): split writer finalization failures

Propagate finalization IOExceptions before filtering or uploading split output. Attempt every registered writer close after an IOException, retain any earlier processing failure and suppress distinct cleanup failures. Closes https://github.com/kestra-io/kestra/issues/20282.

**File**: `core/src/main/java/io/kestra/core/services/StorageService.java` (modified, +22/-3)
```diff
@@ -36,6 +36,7 @@
 import io.kestra.core.utils.RegexUtils;
 
 import io.micronaut.core.convert.format.ReadableBytesTypeConverter;
+import jakarta.annotation.Nullable;
 
 import static io.kestra.core.utils.Rethrow.throwFunction;
 
@@ -140,6 +141,7 @@ private static List<Path> splitByPredicate(RunContext runContext, String extensi
     private static List<Path> partition(RunContext runContext, String extension, SplitStrategy strategy, int partition) throws IOException {
         List<Path> files = new ArrayList<>();
         List<RecordWriter> writers = new ArrayList<>();
+        Throwable processingFailure = null;
 
         try {
             for (int i = 0; i < partition; i++) {
@@ -154,8 +156,11 @@ private static List<Path> partition(RunContext runContext, String extension, Spl
                 writers.get(index).write(iterator.next());
                 index = index >= writers.size() - 1 ? 0 : index + 1;
             }
+        } catch (IOException | RuntimeException | Error e) {
+            processingFailure = e;
+            throw e;
         } finally {
-            closeQuietly(runContext, writers);
+            closeWriters(runContext, writers, processingFailure);
         }
 
         return files.stream().filter(p -> p.toFile().length() > 0).toList();
@@ -165,6 +170,7 @@ private static List<Path> splitByRegex(RunContext runContext, String extension,
         List<Path> files = new ArrayList<>();
         Map<String, RecordWriter> writers = new HashMap<>();
         Pattern pattern = Pattern.compile(regexPattern);
+        Throwable processingFailure = null;
 
         try {
             Iterator<Object> iterator = strategy.records();
@@ -186,21 +192,34 @@ private static List<Path> splitByRegex(RunContext runContext, String extension,
                     writer.write(record);
                 }
             }
+        } catch (IOException | RuntimeException | Error e) {
+            processingFailure = e;
+            throw e;
         } finally {
-            closeQuietly(runContext, writers.values());
+            closeWriters(runContext, writers.values(), processingFailure);
         }
 
         return files.stream().filter(p -> p.toFile().length() > 0).toList();
     }
 
-    private static void closeQuietly(RunContext runContext, Iterable<RecordWriter> writers) {
+    private static void closeWriters(RunContext runContext, Iterable<RecordWriter> writers, @Nullable Throwable processingFailure) throws IOException {
+        IOException closeFailure = null;
         for (RecordWriter writer : writers) {
             try {
                 writer.close();
             } catch (IOException e) {
                 runContext.logger().error("Failed to close split writer", e);
+                Throwable failure = processingFailure != null ? processingFailure : closeFailure;
+                if (failure == null) {
+                    closeFailure = e;
+                } else if (failure != e) {
+                    failure.addSuppressed(e);
+                }
             }
         }
+        if (closeFailure != null) {
+            throw closeFailure;
+        }
     }
 
     // endregion
```

**File**: `core/src/test/java/io/kestra/plugin/core/storage/SplitTest.java` (modified, +410/-0)
```diff
@@ -4,39 +4,66 @@
 import java.io.File;
 import java.io.FileInputStream;
 import java.io.FileOutputStream;
+import java.io.FilterInputStream;
 import java.io.IOException;
 import java.io.InputStream;
 import java.io.InputStreamReader;
 import java.io.OutputStream;
+import java.io.UncheckedIOException;
 import java.net.URI;
 import java.net.URISyntaxException;
 import java.nio.file.Files;
+import java.nio.file.Path;
 import java.util.ArrayList;
 import java.util.List;
 import java.util.Map;
+import java.util.function.IntFunction;
 import java.util.stream.Collectors;
 import java.util.stream.IntStream;
+import java.util.stream.Stream;
 
 import org.apache.commons.lang3.StringUtils;
 import org.junit.jupiter.api.Test;
+import org.junit.jupiter.params.ParameterizedTest;
+import org.junit.jupiter.params.provider.Arguments;
+import org.junit.jupiter.params.provider.EnumSource;
+import org.junit.jupiter.params.provider.MethodSource;
+import org.mockito.MockedConstruction;
 
 import com.fasterxml.jackson.core.type.TypeReference;
 import com.fasterxml.jackson.databind.SequenceWriter;
 import com.google.common.io.CharStreams;
 
 import io.kestra.core.context.TestRunContextFactory;
 import io.kestra.core.junit.annotations.KestraTest;
+import io.kestra.core.metrics.MetricRegistry;
+import io.kestra.core.models.executions.TaskRun;
+import io.kestra.core.models.flows.State;
 import io.kestra.core.models.property.Property;
 import io.kestra.core.runners.RunContext;
+import io.kestra.core.runners.WorkerTask;
+import io.kestra.core.runners.WorkingDir;
 import io.kestra.core.serializers.FileSerde;
+import io.kestra.core.storages.Storage;
 import io.kestra.core.storages.StorageInterface;
 import io.kestra.core.utils.IdUtils;
 import io.kestra.core.utils.Rethrow;
+import io.kestra.worker.processors.internals.WorkerTaskCallable;
 
 import jakarta.inject.Inject;
 
 import static io.kestra.core.tenant.TenantService.MAIN_TENANT;
 import static org.assertj.core.api.Assertions.assertThat;
+import static org.assertj.core.api.Assertions.catchThrowable;
+import static org.mockito.ArgumentMatchers.any;
+import static org.mockito.ArgumentMatchers.anyInt;
+import static org.mockito.Mockito.doAnswer;
+import static org.mockito.Mockito.doReturn;
+import static org.mockito.Mockito.mock;
+import static org.mockito.Mockito.mockConstruction;
+import static org.mockito.Mockito.never;
+import static org.mockito.Mockito.spy;
+import static org.mockito.Mockito.verify;
 
 @KestraTest
 class SplitTest {
@@ -200,6 +227,332 @@ void regexPatternIon() throws Exception {
         assertThat(levels).containsOnly("ERROR", "WARN", "INFO");
     }
 
+    @ParameterizedTest
+    @MethodSource("splitCases")
+    void shouldFailWithoutPublishingWhenFinalWriteFails(SplitMode mode, Format format) throws Exception {
+        SplitFixture fixture = splitFixture(mode, format, 9);
+        IOException writeFailure = new IOException("Cannot write the final split records.");
+        List<WriterFault> writers = new ArrayList<>();
+        Throwable failure;
+
+        try (var outputs = mockOutputs(fixture, writers, index -> index == 0 ? writeFailure : null, index -> null)) {
+            failure = catchThrowable(() -> fixture.task().run(fixture.runContext()));
+        }
+
+        assertThat(failure).isInstanceOf(IOException.class);
+        assertThat(writers.getFirst().writes).isPositive();
+        assertWritersClosed(writers, 3);
+        assertNoPublicationAndSourcePreserved(fixture);
+    }
+
+    @ParameterizedTest
+    @EnumSource(SplitMode.class)
+    void shouldCloseAllWritersAndSuppressFailuresWhenMultipleFinalWritesFail(SplitMode mode) throws Exception {
+        SplitFixture fixture = splitFixture(mode, Format.TEXT, 9);
+        List<IOException> failures = IntStream.range(0, 3)
+            .mapToObj(index -> new IOException("Cannot finalize split writer %d.".formatted(index)))
+            .toList();
+        List<WriterFault> writers = new ArrayList<>();
+        Throwable failure;
+
+        try (var outputs = mockOutputs(fixture, writers, failures::get, index -> null)) {
+            failure = catchThrowable(() -> fixture.task().run(fixture.runContext()));
+        }
+
+        assertThat(failure).isInstanceOf(IOException.class).isIn(failures);
+        assertThat(failure.getSuppressed()).containsExactlyInAnyOrderElementsOf(
+            failures.stream().filter(exception -> exception != failure).toList()
+        );
+        assertWritersClosed(writers, 3);
+        assertNoPublicationAndSourcePreserved(fixture);
+    }
+
+    @ParameterizedTest
+    @EnumSource(SplitMode.class)
+    void shouldPreserveFailureWhenWritersThrowTheSameException(SplitMode mode) throws Exception {
+        SplitFixture fixture = splitFixture(mode, Format.TEXT, 9);
+        IOException writeFailure = new IOException("Cannot write the final split records.");
+        List<WriterFault> writers = new ArrayList<>();
+        Throwable failure;
+
+        try (var outputs = mo
```

---

### Incident Patch 13: `7279c055` (2026-10-05)
**Commit Message**: test(tests): cover scroll memory composable (#20250)

Add `ui/tests/unit/composables/useScrollMemory.spec.ts` covering `useScrollMemory`: the scroll position written to `sessionStorage` under the prefixed view key, the stored position restored when the key changes, a missing value restoring to 0, `saveData` and `loadData` round-tripping arbitrary data, suffixed values kept under distinct keys, and `loadData` returning the supplied default when nothing is stored.

Closes https://github.com/kestra-io/kestra/issues/20195.
Related to https://github.com/kestra-io/kestra/issues/19824.

Co-authored-by: MilosPaunovic <[REDACTED_EMAIL]>

**File**: `ui/tests/unit/composables/useScrollMemory.spec.ts` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+import {afterEach, beforeEach, describe, expect, it, vi} from "vitest"
+import {defineComponent, h, nextTick, ref} from "vue"
+import {mount, type VueWrapper} from "@vue/test-utils"
+
+type ScrollHandler = () => void
+
+const scrollMock = vi.hoisted(() => ({handler: undefined as ScrollHandler | undefined}))
+
+vi.mock("@vueuse/core", () => ({
+    useScroll: (_target: unknown, options: {onScroll: ScrollHandler}) => {
+        scrollMock.handler = options.onScroll
+    },
+    useThrottleFn: <Args extends unknown[], Result>(callback: (...args: Args) => Result) => callback,
+    useWindowScroll: () => ({y: {value: 0}}),
+}))
+
+import {useScrollMemory} from "../../../src/composables/useScrollMemory"
+
+const wrappers: VueWrapper[] = []
+
+function mountScrollMemory(initialKey = "view") {
+    const key = ref(initialKey)
+    const element = ref<HTMLElement | null>(document.createElement("div"))
+    const scrollTo = vi.fn()
+    Object.defineProperty(element.value, "scrollTo", {value: scrollTo})
+
+    let api!: ReturnType<typeof useScrollMemory>
+    const Host = defineComponent({
+        setup() {
+            api = useScrollMemory(key, element)
+            return () => h("div")
+        },
+    })
+
+    wrappers.push(mount(Host))
+    return {api, element, key, scrollTo}
+}
+
+async function runPendingTimers() {
+    await nextTick()
+    await nextTick()
+    vi.runAllTimers()
+}
+
+describe("useScrollMemory", () => {
+    beforeEach(() => {
+        vi.useFakeTimers()
+        sessionStorage.clear()
+        scrollMock.handler = undefined
+    })
+
+    afterEach(() => {
+        wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
+        sessionStorage.clear()
+        vi.useRealTimers()
+    })
+
+    it("writes the scroll position under the prefixed view key", async () => {
+        const {element} = mountScrollMemory("flows")
+        await runPendingTimers()
+
+        element.value!.scrollTop = 128
+        scrollMock.handler?.()
+
+        expect(sessionStorage.getItem("scroll-flows")).toBe("128")
+    })
+
+    it("restores the stored position when the key changes", async () => {
+        sessionStorage.setItem("scroll-details", "240")
+        const {key, scrollTo} = mountScrollMemory("list")
+        await runPendingTimers()
+        scrollTo.mockClear()
+
+        key.value = "details"
+        await runPendingTimers()
+
+        expect(scrollTo).toHaveBeenCalledWith({top: 240, behavior: "smooth"})
+    })
+
+    it("restores to zero when no position is stored", async () => {
+        const {scrollTo} = mountScrollMemory("empty")
+
+        await runPendingTimers()
+
+        expect(scrollTo).toHaveBeenCalledWith({top: 0, behavior: "smooth"})
+    })
+
+    it("round-trips arbitrary data", () => {
+        const {api} = mountScrollMemory()
+        const value = {filters: ["running", "failed"], page: 3}
+
+        api.saveData(value)
+
+        expect(api.loadData()).toEqual(value)
+    })
+
+    it("keeps suffixed values under distinct keys", () => {
+        const {api} = mountScrollMemory("executions")
+
+        api.saveData("table", "-table")
+        api.saveData("cards", "-cards")
+
+        expect(sessionStorage.getItem("scroll-executions-table")).toBe(JSON.stringify("table"))
+        expect(sessionStorage.getItem("scroll-executions-cards")).toBe(JSON.stringify("cards"))
+        expect(api.loadData("-table")).toBe("table")
+        expect(api.loadData("-cards")).toBe("cards")
+    })
+
+    it("returns the supplied default when nothing is stored", () => {
+        const {api} = mountScrollMemory()
+        const fallback = {page: 1}
+
+        expect(api.loadData("-missing", fallback)).toBe(fallback)
+    })
+})
```

---

### Incident Patch 14: `cdf4c28c` (2026-10-05)
**Commit Message**: fix(flows): reset reused playground task results when flow variables change (#20371)

checkCanReplay compared only inputs and labels between the last run's revision
and the current one, so a edited variable kept feeding old task outputs to
later tasks.

Part of https://github.com/kestra-io/kestra-ee/issues/11371.


Claude-Session: https://claude.ai/code/session_015Uc73UycNjsMnumLrj5PkQ

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `ui/src/stores/playground.ts` (modified, +2/-1)
```diff
@@ -128,7 +128,8 @@ export const usePlaygroundStore = defineStore("playground", () => {
             })
 
             if(!isDeepEqual(lastExecutionFlow.inputs, flowStore.flow.inputs)
-                || !isDeepEqual(lastExecutionFlow.labels, flowStore.flow.labels)){
+                || !isDeepEqual(lastExecutionFlow.labels, flowStore.flow.labels)
+                || !isDeepEqual(lastExecutionFlow.variables, flowStore.flow.variables)){
                 return false
             };
         }
```

**File**: `ui/tests/unit/stores/playgroundReuse.spec.ts` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+import {beforeEach, afterEach, describe, expect, it, vi} from "vitest"
+import {createPinia, setActivePinia} from "pinia"
+import {nextTick, reactive} from "vue"
+
+const graph = {nodes: [{task: {id: "b"}}], edges: []}
+const previousFlow = {inputs: [], labels: [], variables: {greeting: "hello"}}
+const flowAt = (revision: number, greeting: string) => ({id: "f", namespace: "ns", revision, inputs: [], labels: [], variables: {greeting}})
+
+const flowStore = reactive({
+    flow: {} as Record<string, unknown>,
+    haveChange: false,
+    flowErrors: undefined,
+    isCreating: false,
+    saveAll: vi.fn(() => Promise.resolve()),
+    loadGraph: vi.fn(() => Promise.resolve(graph)),
+    loadFlow: vi.fn(() => Promise.resolve(previousFlow)),
+})
+
+const executionsStore = reactive({
+    execution: undefined as Record<string, unknown> | undefined,
+    flow: undefined,
+    triggerExecution: vi.fn(),
+    replayExecution: vi.fn(),
+})
+
+vi.mock("vue-router", () => ({
+    useRoute: () => ({query: {}, params: {}}),
+    useRouter: () => ({push: vi.fn(), replace: vi.fn()}),
+}))
+vi.mock("vue-i18n", () => ({useI18n: () => ({t: (key: string) => key})}))
+vi.mock("../../../src/stores/flow", () => ({useFlowStore: () => flowStore}))
+vi.mock("../../../src/stores/executions", () => ({useExecutionsStore: () => executionsStore}))
+vi.mock("../../../src/stores/fileExplorer", () => ({useFileExplorerStore: () => ({loadNodes: vi.fn()})}))
+vi.mock("../../../src/utils/toast", () => ({useToast: () => ({confirm: vi.fn(), error: vi.fn()})}))
+vi.mock("@kestra-io/topology/vue-flow-utils", () => ({
+    areTasksIdenticalInGraphUntilTask: () => true,
+    getNextTaskNodes: () => [],
+}))
+
+const runningExecution = {id: "e1", flowRevision: 1, state: {current: "CREATED"}}
+
+async function playgroundAfterFirstRun() {
+    const {usePlaygroundStore} = await import("../../../src/stores/playground")
+    const playground = usePlaygroundStore()
+
+    executionsStore.triggerExecution.mockResolvedValueOnce(runningExecution)
+    flowStore.flow = flowAt(1, "hello")
+    await playground.runUntilTask("b")
+
+    executionsStore.execution = {...runningExecution, state: {current: "SUCCESS"}, taskRunList: [{id: "tr-b", taskId: "b"}]}
+    await nextTick()
+    await vi.advanceTimersByTimeAsync(1000)
+
+    return playground
+}
+
+describe("playground reuse of earlier task results", () => {
+    beforeEach(() => {
+        vi.useFakeTimers()
+        setActivePinia(createPinia())
+        vi.clearAllMocks()
+        executionsStore.execution = undefined
+    })
+
+    afterEach(() => {
+        vi.useRealTimers()
+    })
+
+    it("replays from the reused task run when the flow variables are unchanged", async () => {
+        const playground = await playgroundAfterFirstRun()
+
+        flowStore.flow = flowAt(2, "hello")
+        await playground.runUntilTask("b")
+
+        expect(executionsStore.replayExecution).toHaveBeenCalledTimes(1)
+        expect(executionsStore.triggerExecution).toHaveBeenCalledTimes(1)
+    })
+
+    it("starts a fresh execution when the flow variables changed since the last run", async () => {
+        const playground = await playgroundAfterFirstRun()
+
+        flowStore.flow = flowAt(2, "hi")
+        await playground.runUntilTask("b")
+
+        expect(executionsStore.replayExecution).not.toHaveBeenCalled()
+        expect(executionsStore.triggerExecution).toHaveBeenCalledTimes(2)
+    })
+})
```

---

### Incident Patch 15: `709a557f` (2026-09-30)
**Commit Message**: fix(executions): retry a failed WorkingDirectory child by running its WorkingDirectory again

When a child of a WorkingDirectory failed and had a retry (its own, a parent's or the flow's), the executor
retried the child alone: it was dispatched as a standalone task, outside the working directory, while the
worker had already stopped running the WorkingDirectory at the failure. The children after it were never
created, so the WorkingDirectory, its execution and its concurrency slot stayed RUNNING forever.

The retry now targets the WorkingDirectory: its task run is delayed and marked RETRYING, the attempts are
counted on it, and retryTask drops its children so the next run creates them again.

**File**: `core/src/main/java/io/kestra/core/services/ExecutionService.java` (modified, +7/-2)
```diff
@@ -147,7 +147,12 @@ public Execution getExecution(final String tenant, final @NotNull String executi
      **/
     public Execution retryTask(Execution execution, Flow flow, String taskRunId) throws InternalException {
         TaskRun taskRun = execution.findTaskRunByTaskRunId(taskRunId).withState(State.Type.CREATED);
-        List<TaskRun> taskRunList = execution.getTaskRunList();
+        List<TaskRun> taskRunList = new ArrayList<>(execution.getTaskRunList());
+
+        if (flow.findTaskByTaskId(taskRun.getTaskId()) instanceof WorkingDirectory) {
+            // a retried WorkingDirectory runs all its children again, under new task runs
+            taskRunList.removeIf(child -> taskRun.getId().equals(child.getParentTaskRunId()));
+        }
 
         if (taskRun.getParentTaskRunId() != null) {
             // we need to find the parent to remove any errors or finally tasks already executed
@@ -187,7 +192,7 @@ public Execution retryTask(Execution execution, Flow flow, String taskRunId) thr
             return execution.withTaskRunList(taskRunList).withTaskRun(taskRun).withState(State.Type.RUNNING);
         }
 
-        return execution.withTaskRun(taskRun).withState(State.Type.RUNNING);
+        return execution.withTaskRunList(taskRunList).withTaskRun(taskRun).withState(State.Type.RUNNING);
     }
 
     public Execution retryWaitFor(Execution execution, String flowableTaskRunId) {
```

**File**: `executor/src/main/java/io/kestra/executor/ExecutorService.java` (modified, +18/-7)
```diff
@@ -602,13 +602,15 @@ private ExecutorContext handleFlowableTasks(ExecutorContext executor) throws Exc
             ) {
                 Instant nextRetryDate = null;
                 AbstractRetry.Behavior behavior = null;
+                // the children of a WorkingDirectory only run inside it, on its worker, so retrying one means running the WorkingDirectory again
+                TaskRun retriedTaskRun = parentWorkingDirectory(taskRun, executor).orElse(taskRun);
 
                 try {
                     // Case task has a retry
                     if (task.getRetry() != null) {
                         AbstractRetry retry = task.getRetry();
                         behavior = retry.getBehavior();
-                        nextRetryDate = behavior.equals(AbstractRetry.Behavior.CREATE_NEW_EXECUTION) ? taskRun.nextRetryDate(retry, executor.getExecution()) : taskRun.nextRetryDate(retry);
+                        nextRetryDate = behavior.equals(AbstractRetry.Behavior.CREATE_NEW_EXECUTION) ? taskRun.nextRetryDate(retry, executor.getExecution()) : retriedTaskRun.nextRetryDate(retry);
                     } else {
                         // Case parent task has a retry
                         Task parentTaskWithRetry = searchForParentTaskWithRetry(taskRun, executor);
@@ -617,32 +619,33 @@ private ExecutorContext handleFlowableTasks(ExecutorContext executor) throws Exc
                             // The parent's errors/finally tasks (e.g. AllowFailure.errors) must complete before the retry timer is allowed to fire.
                             if (!isErrorOrFinallyHandlingPending(taskRun, parentTaskWithRetry, executor, nextTaskRuns)) {
                                 behavior = retry.getBehavior();
-                                nextRetryDate = behavior.equals(AbstractRetry.Behavior.CREATE_NEW_EXECUTION) ? taskRun.nextRetryDate(retry, executor.getExecution()) : taskRun.nextRetryDate(retry);
+                                nextRetryDate = behavior.equals(AbstractRetry.Behavior.CREATE_NEW_EXECUTION) ? taskRun.nextRetryDate(retry, executor.getExecution()) : retriedTaskRun.nextRetryDate(retry);
                             }
                         }
                         // Case flow has a retry
                         else if (executor.getFlow().getRetry() != null) {
                             retry = executor.getFlow().getRetry();
                             behavior = retry.getBehavior();
                             nextRetryDate = behavior.equals(AbstractRetry.Behavior.CREATE_NEW_EXECUTION) ? executionService.nextRetryDate(retry, executor.getExecution())
-                                : taskRun.nextRetryDate(retry);
+                                : retriedTaskRun.nextRetryDate(retry);
                         }
                     }
                 } catch (DateTimeException | ArithmeticException e) {
                     throw new InternalException("The retry interval or maxDuration is out of the supported range.", e);
                 }
 
                 if (nextRetryDate != null) {
+                    boolean createNewExecution = behavior.equals(AbstractRetry.Behavior.CREATE_NEW_EXECUTION);
                     ExecutionDelay.ExecutionDelayBuilder executionDelayBuilder = ExecutionDelay.builder()
-                        .taskRunId(taskRun.getId())
+                        .taskRunId(createNewExecution ? taskRun.getId() : retriedTaskRun.getId())
                         .executionId(executor.getExecution().getId())
                         .date(nextRetryDate)
                         .state(State.Type.RUNNING)
-                        .delayType(behavior.equals(AbstractRetry.Behavior.CREATE_NEW_EXECUTION) ? ExecutionDelay.DelayType.RESTART_FAILED_FLOW : ExecutionDelay.DelayType.RESTART_FAILED_TASK);
+                        .delayType(createNewExecution ? ExecutionDelay.DelayType.RESTART_FAILED_FLOW : ExecutionDelay.DelayType.RESTART_FAILED_TASK);
                     executionDelays.add(executionDelayBuilder.build());
                     executor.withExecution(
-                        behavior.equals(AbstractRetry.Behavior.CREATE_NEW_EXECUTION) ? executionService.markWithTaskRunAs(executor.getExecution(), taskRun.getId(), State.Type.RETRIED, true)
-                            : executionService.markWithTaskRunAs(executor.getExecution(), taskRun.getId(), State.Type.RETRYING, false),
+                        createNewExecution ? executionService.markWithTaskRunAs(executor.getExecution(), taskRun.getId(), State.Type.RETRIED, true)
+                            : executionService.markWithTaskRunAs(executor.getExecution(), retriedTaskRun.getId(), State.Type.RETRYING, false),
                         "handleRetryTask"
                     );
                     // Prevent workerTaskResult from flowable tasks to be sent because one of its children is retrying
@@ -965,6 +968,14 @@ private void interruptOnChildFailure(ExecutorContext executor, OnChildFailureInt
         }
     }
 
+   
```

**File**: `executor/src/test/java/io/kestra/executor/statemachine/WorkingDirectoryRetryTest.java` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+package io.kestra.executor.statemachine;
+
+import java.time.Instant;
+import java.util.ArrayList;
+import java.util.List;
+
+import org.junit.jupiter.api.Test;
+
+import io.kestra.core.models.executions.Execution;
+import io.kestra.core.models.executions.TaskRun;
+import io.kestra.core.models.executions.TaskRunAttempt;
+import io.kestra.core.models.flows.FlowWithSource;
+import io.kestra.core.models.flows.State;
+import io.kestra.core.runners.WorkerTask;
+import io.kestra.core.runners.WorkerTaskResult;
+import io.kestra.core.utils.IdUtils;
+import io.kestra.executor.testkit.Executions;
+import io.kestra.executor.testkit.ExecutorTestHarness;
+import io.kestra.executor.testkit.Flows;
+import io.kestra.executor.testkit.ScriptedWorker;
+
+import static io.kestra.executor.testkit.HarnessAssert.assertThat;
+import static org.assertj.core.api.Assertions.assertThat;
+
+/**
+ * The children of a WorkingDirectory only run inside it, on its worker, so retrying a failed child means running the
+ * whole WorkingDirectory again.
+ */
+class WorkingDirectoryRetryTest {
+
+    private static final Instant AFTER_ANY_RETRY_DELAY = Instant.parse("2100-01-01T00:00:00Z");
+
+    private final ExecutorTestHarness harness = ExecutorTestHarness.create();
+    private final List<WorkerTask> dispatched = new ArrayList<>();
+    private final FlowWithSource flow = Flows.yaml("""
+        id: working-directory-retry
+        namespace: io.kestra.tests
+        concurrency:
+          limit: 1
+        retry:
+          type: constant
+          interval: PT1S
+          maxAttempts: 2
+        tasks:
+          - id: working-directory
+            type: io.kestra.plugin.core.flow.WorkingDirectory
+            tasks:
+              - id: generate
+                type: io.kestra.plugin.core.log.Log
+                message: generate
+              - id: ingest
+                type: io.kestra.plugin.core.log.Log
+                message: ingest
+        """);
+
+    @Test
+    void shouldRunTheWorkingDirectoryAgainWhenAChildIsRetried() {
+        // Given: the first child fails, so the worker stops the WorkingDirectory there
+        harness.registerFlow(flow);
+        Execution created = Executions.created(flow);
+        harness.run(created, recordingWorker(State.Type.FAILED));
+
+        // When: the retry fires and the second run of the WorkingDirectory succeeds
+        harness.tickExecutionDelays(AFTER_ANY_RETRY_DELAY);
+        harness.run(List.of(), recordingWorker(State.Type.SUCCESS));
+        harness.run(List.of(childResult(dispatched.getLast(), "ingest", State.Type.SUCCESS)), recordingWorker(State.Type.SUCCESS));
+
+        // Then
+        assertThat(dispatched).extracting(task -> task.getTaskRun().getTaskId()).containsExactly("working-directory", "working-directory");
+        assertThat(harness).hasExecutionInState(created, State.Type.SUCCESS).hasRunning(flow, 0);
+    }
+
+    @Test
+    void shouldFailWhenTheWorkingDirectoryRetriesAreExhausted() {
+        // Given
+        harness.registerFlow(flow);
+        Execution created = Executions.created(flow);
+        harness.run(created, recordingWorker(State.Type.FAILED));
+
+        // When: every run of the WorkingDirectory fails on its first child
+        for (int i = 0; i < 3; i++) {
+            harness.tickExecutionDelays(AFTER_ANY_RETRY_DELAY);
+            harness.run(List.of(), recordingWorker(State.Type.FAILED));
+        }
+
+        // Then
+        assertThat(dispatched).extracting(task -> task.getTaskRun().getTaskId()).containsExactly("working-directory", "working-directory");
+        assertThat(harness).hasExecutionInState(created, State.Type.FAILED).hasRunning(flow, 0);
+    }
+
+    private ScriptedWorker recordingWorker(State.Type generateState) {
+        return task ->
+        {
+            dispatched.add(task);
+            return childResult(task, "generate", generateState);
+        };
+    }
+
+    private static WorkerTaskResult childResult(WorkerTask workingDirectory, String taskId, State.Type state) {
+        TaskRun child = workingDirectory.getTaskRun().toBuilder()
+            .id(IdUtils.create())
+            .taskId(taskId)
+            .parentTaskRunId(workingDirectory.getTaskRun().getId())
+            .attempts(List.of(TaskRunAttempt.builder().workerId("worker").state(new State().withState(state)).build()))
+            .state(new State().withState(state))
+            .build();
+        return new WorkerTaskResult(child);
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #20433** (closed): Replace explicit any with real types in executions store specs (@OGsiji)
- **PR #20431** (closed): test(cli): add unit tests for SubmitQueuedCommand (@harshitsaxena214)
- **PR #20404** (closed): fix(flows): stop flagging a block the moment it is added (@flcarre)
- **PR #20389** (2026-10-05): test(ui): add coverage for getRestoredQuery in useRestoreUrl (#20189) (@flash-source)
- **PR #20380** (closed): fix(ui): replace explicit any in ExecutionRoot (@Pushpen2005)
- **PR #20378** (2026-10-05): fix(executions): retry a failed WorkingDirectory child by running its… (@AcevedoR)
- **PR #20374** (closed): refactor(ui): replace explicit any with real types in no-code injection Keys and types (@AVKeerthan11)
- **PR #20373** (2026-10-05): fix(system): seed pip into the kestra-base python venv (@AcevedoR)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
