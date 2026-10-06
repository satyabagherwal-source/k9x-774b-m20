# Forensic Learning Record (Deep Inspection): microsoft/flint-chart

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-flint-chart-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/flint-chart](https://github.com/microsoft/flint-chart))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:29:10.779Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/flint-chart`
- **Description**: 🪄 Flint is a visualization language that lets AI agents reliably create expressive, good-looking charts from simple, human-editable chart specs.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4339 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/flint-js/src/chartjs/templates/utils.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Shared helper functions for Chart.js template hooks.
 * Pure logic — no UI dependencies.
 */

import type { ChannelSemantics, InstantiateContext } from '../../core/types';
import { pickChartJsPalette } from '../colormap';

// ---------------------------------------------------------------------------
// Discrete-dimension helpers
// ---------------------------------------------------------------------------

const isDiscrete = (type: string | undefined) => type === 'nominal' || type === 'ordinal';

/**
 * Get the number of unique non-null values for a field in the data table.
 */
export function getFieldCardinality(field: string, table: any[]): number {
    return new Set(table.map((r: any) => r[field]).filter((v: any) => v != null)).size;
}

// ---------------------------------------------------------------------------
// Chart.js-specific helpers
// ---------------------------------------------------------------------------

/**
 * Extract unique category values from data for a given field, preserving order.
 * If `ordinalSortOrder` is provided, returns values sorted in that canonical order.
 */
export function extractCategories(data: any[], field: string, ordinalSortOrder?: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const row of data) {
        const val = row[field];
        if (val != null) {
            const key = String(val);
            if (!seen.has(key)) {
                seen.add(key);
                result.push(key);
            }
        }
    }

    if (ordinalSortOrder && ordinalSortOrder.length > 0) {
        const orderMap = new Map(ordinalSortOrder.map((v, i) => [v, i]));
        result.sort((a, b) => {
            const ia = orderMap.get(a);
            const ib = orderMap.get(b);
            if (ia !== undefined && ib !== undefined) return ia - ib;
            if (ia !== undefined) return -1;
            if (ib !== undefined) return 1;
            return 0;
        });
    }

    return result;
}

/**
 * Resolve the display order of a categorical axis, honoring either a canonical
 * `ordinalSortOrder` or a sort-by-measure request (`sortBy` + `sortOrder` from
 * the shared Sort encoding action).
 */
export function resolveCategoryOrder(
    data: any[],
    catField: string,
    opts?: { ordinalSortOrder?: string[]; sortBy?: string; sortOrder?: 'ascending' | 'descending' },
): string[] {
    const base = extractCategories(data, catField, opts?.ordinalSortOrder);
    if (!opts?.sortBy) return base;
    const agg = new Map<string, number>();
    for (const row of data) {
        const cat = String(row[catField] ?? '');
        const v = Number(row[opts.sortBy]);
        if (Number.isFinite(v)) agg.set(cat, (agg.get(cat) ?? 0) + v);
    }
    const dir = opts.sortOrder === 'ascending' ? 1 : -1;
    return [...base].sort((a, b) => dir * ((agg.get(a) ?? 0) - (agg.get(b) ?? 0)));
}

/**
 * Group data by a categorical field.
 * Returns a map: seriesName → rows[].
 */
export function groupBy(data: any[], field: string): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    for (const row of data) {
        const key = String(row[field] ?? '');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
    }
    return groups;
}

/**
 * Chart.js `linear` scale requires numeric `x` in `{x,y}` points. ISO strings
 * (from temporal conversion) become NaN and nothing renders. Map to Unix ms.
 * Seconds (e.g. ≤1e12) are treated as Unix seconds and multiplied by 1000.
 */
export function coerceUnixMsForChartJs(raw: unknown): number {
    if (raw == null) return NaN;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw < 1e12 ? Math.round(raw * 1000) : raw;
    }
    if (raw instanceof Date) {
        const t = raw.getTime();
        return Number.isFinite(t) ? t : NaN;
    }
    const t = new Date(String(raw)).getTime();
    return Number.isFinite(t) ? t : NaN;
}

/**
 * Default Chart.js color palette (RGBA with alpha for fill).
 */
export const DEFAULT_COLORS = [
    'rgba(54, 162, 235, 1)',    // blue
    'rgba(255, 99, 132, 1)',    // red
    'rgba(255, 206, 86, 1)',    // yellow
    'rgba(75, 192, 192, 1)',    // teal
    'rgba(153, 102, 255, 1)',   // purple
    'rgba(255, 159, 64, 1)',    // orange
    'rgba(46, 204, 113, 1)',    // green
    'rgba(52, 73, 94, 1)',      // dark blue-grey
    'rgba(231, 76, 60, 1)',     // red-orange
    'rgba(149, 165, 166, 1)',   // grey
];

export const DEFAULT_BG_COLORS = [
    'rgba(54, 162, 235, 0.6)',
    'rgba(255, 99, 132, 0.6)',
    'rgba(255, 206, 86, 0.6)',
    'rgba(75, 192, 192, 0.6)',
    'rgba(153, 102, 255, 0.6)',
    'rgba(255, 159, 64, 0.6)',
    'rgba(46, 204, 113, 0.6)',
    'rgba(52, 73, 94, 0.6)',
    'rgba(231, 76, 60, 0.6)',
    'rgba(149, 165, 166, 0.6)',
];

// ---------------------------------------------------------------------------
// Color-decisions integration
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    const intVal = parseInt(m[1], 16);
    return {
        r: (intVal >> 16) & 255,
        g: (intVal >> 8) & 255,
        b: intVal & 255,
    };
}

function rgbaFromHex(hex: string, alpha: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

function applyAlphaToColor(color: string, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha));
    if (color.startsWith('#')) {
        return rgbaFromHex(color, a);
    }
    if (color.startsWith('rgba')) {
        return color.replace(
            /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/,
            (_m, r, g, b) => `rgba(${r}, ${g}, ${b}, ${a})`,
        );
    }
    if (color.startsWith('rgb(')) {
        return color.replace(
            /rgb\((\d+),\s*(\d+),\s*(\d+)\)/,
            (_m, r, g, b) => `rgba(${r}, ${g}, ${b}, ${a})`,
        );
    }
    return color;
}

/**
 * 从 color-decisions 解析调色板；若没有决策则回退到 Chart.js 默认 cat10。
 */
export function getChartJsPalette(ctx: InstantiateContext, preferred: 'color' | 'group' = 'color'): string[] {
    const decisions = ctx.colorDecisions;
    const decision =
        preferred === 'color'
            ? decisions?.color ?? decisions?.group
            : decisions?.group ?? decisions?.color;

    const palette = pickChartJsPalette(decision);
    if (palette.length > 0) {
        return palette;
    }
    return DEFAULT_COLORS;
}

/**
 * 取得第 i 个系列的描边色（优先使用统一调色板）。
 */
export function getSeriesBorderColor(palette: string[], index: number): string {
    if (!palette.length) {
        return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
    }
    return palette[index % palette.length];
}

/**
 * 取得第 i 个系列的填充色，自动按需要设置透明度。
 */
export function getSeriesBackgroundColor(palette: string[], index: number, alpha = 0.6): string {
    const border = getSeriesBorderColor(palette, index);
    return applyAlphaToColor(border, alpha);
}

/**
 * Detect which axis is the category (banded) axis and which is the value axis.
 */
export function detectAxes(
    channelSemantics: Record<string, ChannelSemantics>,
): { categoryAxis: 'x' | 'y'; valueAxis: 'x' | 'y' } {
    const xCS = channelSemantics.x;
    const yCS = channelSemantics.y;

    if (xCS && isDiscrete(xCS.type)) {
        return { categoryAxis: 'x', valueAxis: 'y' };
    }
    if (yCS && isDiscrete(yCS.type)) {
        return { categoryAxis: 'y', valueAxis: 'x' };
    }
    return { categoryAxis: 'x', valueAxis: 'y' };
}

/**
 * Build category-aligned data array for a subset of rows.
 * Returns values indexed by category position (null for missing).
 */
export function buildCategoryAlignedData(
    rows: any[],
    xField: string,
    yField: string,
    categories: string[],
): (number | null)[] {
    const map = new Map<string, number>();
    for (const row of rows) {
        const key = String(row[xField] ?? '');
        const val = row[yField];
        if (val != null && !isNaN(val)) {
            map.set(key, (map.get(key) ?? 0) + Number(val));
        }
    }
    return categories.map(cat => map.get(cat) ?? null);
}

```

### Core Architecture Module: `packages/flint-js/src/core/aggregate.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Optional data aggregation transform.
 *
 * Flint's default contract is "callers own the data" — the host passes in rows
 * that are already shaped for the chart. As a convenience, an encoding may set
 * `aggregate` to ask Flint to collapse the rows itself, mirroring the way
 * Vega-Lite derives an aggregated field:
 *
 *   - Rows are grouped by every channel that has a `field` and no `aggregate`
 *     (the dimensions).
 *   - For each group, each aggregated channel produces a derived column named
 *     `${field}_${op}` (`count` produces `_count`), which the backend assemblers
 *     already reference once `aggregate` is set.
 *
 * The derived column name IS the contract: if a caller has already
 * pre-aggregated, they simply reference that column by name (e.g. `revenue_sum`)
 * and omit `aggregate`, and this transform is a no-op. `average` and `mean` are
 * synonyms (both arithmetic mean) and keep distinct suffixes by design.
 *
 * This is a deliberate, opt-in exception to the no-transform principle — most
 * callers should still aggregate upstream.
 */

import { ChartEncoding } from './types';

interface AggSpec {
    field?: string;
    op: string;
    /** Derived column name the assemblers expect (`${field}_${op}` or `_count`). */
    target: string;
}

/**
 * Apply requested `aggregate` operations to the data, returning grouped rows.
 *
 * Returns the input unchanged when no encoding requests aggregation, or when the
 * derived columns are already present (caller pre-aggregated).
 */
export function applyAggregation(
    encodings: Record<string, ChartEncoding>,
    data: any[],
): any[] {
    if (!data || data.length === 0) return data;

    // Collect aggregate requests from the input encodings.
    const specs: AggSpec[] = [];
    for (const enc of Object.values(encodings)) {
        if (!enc || !enc.aggregate) continue;
        const op = enc.aggregate;
        if (op !== 'count' && !enc.field) continue; // nothing to reduce
        const target = op === 'count' ? '_count' : `${enc.field}_${op}`;
        specs.push({ field: enc.field, op, target });
    }
    if (specs.length === 0) return data;

    // If every derived column already exists, the caller pre-aggregated — trust
    // the supplied data and do nothing.
    const firstRow = data[0];
    const allPresent = specs.every(s =>
        Object.prototype.hasOwnProperty.call(firstRow, s.target),
    );
    if (allPresent) return data;

    // Group-by dimensions: every channel with a field and no aggregate.
    const groupFields: string[] = [];
    const seen = new Set<string>();
    for (const enc of Object.values(encodings)) {
        if (!enc || enc.aggregate || !enc.field) continue;
        if (seen.has(enc.field)) continue;
        seen.add(enc.field);
        groupFields.push(enc.field);
    }

    // Bucket rows by the tuple of group-field values (insertion order preserved).
    const groups = new Map<string, any[]>();
    for (const row of data) {
        const key = JSON.stringify(groupFields.map(f => row[f] ?? null));
        let bucket = groups.get(key);
        if (!bucket) {
            bucket = [];
            groups.set(key, bucket);
        }
        bucket.push(row);
    }

    const toNum = (v: any): number => (typeof v === 'number' ? v : Number(v));
    const reduceOp = (rows: any[], spec: AggSpec): number => {
        if (spec.op === 'count') return rows.length;
        const nums = rows
            .map(r => toNum(r[spec.field as string]))
            .filter(v => Number.isFinite(v));
        if (nums.length === 0) return 0;
        const sum = nums.reduce((a, b) => a + b, 0);
        // 'average' and 'mean' are synonyms (arithmetic mean); 'sum' totals.
        return spec.op === 'sum' ? sum : sum / nums.length;
    };

    const out: any[] = [];
    for (const rows of groups.values()) {
        const head = rows[0];
        const aggregated: Record<string, any> = {};
        for (const f of groupFields) aggregated[f] = head[f];
        for (const spec of specs) {
            const val = reduceOp(rows, spec);
            aggregated[spec.target] = val;
            // Keep the source column populated so semantic/format inference for
            // the measure channel still sees representative numeric values.
            if (spec.op !== 'count' && spec.field) aggregated[spec.field] = val;
        }
        out.push(aggregated);
    }
    return out;
}

```

### Core Architecture Module: `packages/flint-js/src/core/axis-detection.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { ChannelSemantics } from './types';

type EncodingType = 'nominal' | 'ordinal' | 'quantitative' | 'temporal';

type BandedAxisResult = {
    axis: 'x' | 'y';
    resolvedTypes?: Record<string, EncodingType>;
};

const isDiscrete = (type: string | undefined): boolean =>
    type === 'nominal' || type === 'ordinal';

const getFieldCardinality = (field: string, table: any[]): number =>
    new Set(table.map((row: any) => row[field]).filter((value: any) => value != null)).size;

/** Resolve a backend-neutral discrete encoding type for a field. */
export function resolveDiscreteType(
    currentType: string,
    field: string | undefined,
    table: any[],
): 'nominal' | 'ordinal' {
    if (currentType === 'nominal') return 'nominal';
    if (currentType === 'ordinal') return 'ordinal';
    if (currentType === 'temporal') return 'ordinal';
    if (currentType === 'quantitative' && field && table.length > 0) {
        return getFieldCardinality(field, table) <= 20 ? 'ordinal' : 'nominal';
    }
    return 'nominal';
}

/** Choose the position axis that should use banded layout. */
export function detectBandedAxisFromSemantics(
    channelSemantics: Record<string, ChannelSemantics>,
    table: any[],
    options: { preferAxis?: 'x' | 'y' } = {},
): BandedAxisResult | null {
    const xType = channelSemantics.x?.type;
    const yType = channelSemantics.y?.type;

    if (xType && isDiscrete(xType)) return { axis: 'x' };
    if (yType && isDiscrete(yType)) return { axis: 'y' };

    if (xType && yType) {
        if (xType === 'quantitative' && yType !== 'quantitative') {
            return { axis: 'y' };
        }
        if (yType === 'quantitative' && xType !== 'quantitative') {
            return { axis: 'x' };
        }
        return { axis: options.preferAxis || 'x' };
    }

    if (xType) {
        const newType = resolveDiscreteType(xType, channelSemantics.x?.field, table);
        return { axis: 'x', resolvedTypes: { x: newType } };
    }
    if (yType) {
        const newType = resolveDiscreteType(yType, channelSemantics.y?.field, table);
        return { axis: 'y', resolvedTypes: { y: newType } };
    }

    return null;
}

/** Choose a banded axis and force its encoding type to be discrete. */
export function detectBandedAxisForceDiscrete(
    channelSemantics: Record<string, ChannelSemantics>,
    table: any[],
    options: { preferAxis?: 'x' | 'y' } = {},
): BandedAxisResult | null {
    const result = detectBandedAxisFromSemantics(channelSemantics, table, options);
    if (!result) return null;

    const axis = result.axis;
    const semantics = channelSemantics[axis];
    if (!semantics) return result;

    if (!isDiscrete(semantics.type)) {
        const newType = resolveDiscreteType(semantics.type, semantics.field, table);
        return {
            axis,
            resolvedTypes: { ...result.resolvedTypes, [axis]: newType },
        };
    }

    return result;
}
```

### Core Architecture Module: `packages/flint-js/src/core/band-dodge.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Band-dodge decision: does a secondary discrete channel (`color`, or an explicit
 * `group` field) subdivide a categorical axis band into side-by-side sub-lanes
 * ("dodge"), or is it redundant/nested with the axis (render one full-width glyph
 * per band, "nested")?
 *
 * This is the single source of truth shared by the layout engine
 * (`compute-layout.ts`) and every backend template that dodges by color/group
 * (VL boxplot/violin/grouped-bar, ECharts, Chart.js). Keeping the decision here
 * prevents the layout and the templates from drifting apart (the class of bug
 * where the band is budgeted for a different lane count than the glyph is sized
 * for). See `design-docs/boxplot-color-dodge-heuristic.md`.
 *
 * Two independent quantities, deliberately NOT the same number:
 *   - the **gate** (`dodge`): keyed off the max per-band sub-cardinality — "does
 *     any single band actually contain more than one sub-value?"
 *   - the **lane count** (`laneCount`): the *global* distinct sub-value count,
 *     because that is what a global band-offset scale (VL `xOffset`, an ECharts
 *     series-per-group, a Chart.js dataset-per-group) physically reserves per
 *     band. Sizing a glyph by the max-per-band instead would overlap in sparse
 *     cross-products.
 */

/** Default fraction of single-valued bands above which `auto` snaps to `none`
 *  (mostly-1:1 / dirty near-1:1 data). Tunable via `planBandDodge` options. */
export const DEFAULT_NESTED_SNAP_THRESHOLD = 0.9;

/** Resolved dodge mode (what actually renders). */
export type DodgeMode = 'none' | 'local' | 'global';

/** User-facing `dodge` chart-property values (`auto` defers to the compiler). */
export type DodgeOption = 'auto' | DodgeMode;

export interface BandDodgePlan {
    /** Compiler's recommended default mode. */
    mode: DodgeMode;
    /** Back-compat: does the recommendation subdivide the band? (`mode !== 'none'`). */
    dodge: boolean;
    /** Lanes a *global* offset scale reserves per band = global distinct
     *  sub-values (the `global` mode lane count). */
    laneCount: number;
    /** True when local and global dodge can produce different layouts. */
    ambiguous: boolean;
    /** Most distinct sub-values co-occurring within any single band. */
    maxPerBand: number;
    /** Global distinct sub-values. */
    global: number;
    /** Number of distinct axis bands. */
    bandCount: number;
}

export interface PlanBandDodgeOptions {
    /** Fraction of single-valued bands above which `auto` snaps to `none`.
     *  Defaults to {@link DEFAULT_NESTED_SNAP_THRESHOLD}. */
    nestedSnapThreshold?: number;
}

/** Pure recommendation from the per-band statistics. */
function recommendMode(
    maxPerBand: number,
    globalCount: number,
    nestedFraction: number,
    threshold: number,
): DodgeMode {
    // Nothing subdivides any band → full-width.
    if (maxPerBand <= 1) return 'none';
    // Mostly single-valued (a few dirty/outlier multi-color bands) → snap to
    // full-width rather than dodge the whole chart for a couple of rows.
    if (nestedFraction >= threshold) return 'none';
    // Every occupied band spans the full sub-domain → uniform global grid.
    if (maxPerBand >= globalCount) return 'global';
    // Sparse / spiky → compact, centered per-band lanes.
    return 'local';
}

/**
 * Decide whether `subField` dodges `axisField` for the given data.
 *
 * Confident zones (never ambiguous):
 *   - `maxPerBand <= 1`  → nested (redundant/nested with the axis; `color == x`
 *     or a 1:1 different-field pair).
 *   - `maxPerBand === global` → dodge (clean full cross-product).
 * Ambiguous zone (`1 < maxPerBand < global`, e.g. sparse cross-products or dirty
 * near-1:1 data): the `auto` lean is resolved by a configurable threshold on the
 * fraction of single-valued bands, and `ambiguous` is set so a host can surface
 * the toggle.
 */
export function planBandDodge(
    table: ReadonlyArray<Record<string, unknown>>,
    axisField: string,
    subField: string,
    options?: PlanBandDodgeOptions,
): BandDodgePlan {
    const perBand = new Map<unknown, Set<unknown>>();
    const global = new Set<unknown>();
    for (const row of table) {
        global.add(row[subField]);
        const key = row[axisField];
        let bandSet = perBand.get(key);
        if (!bandSet) perBand.set(key, (bandSet = new Set()));
        bandSet.add(row[subField]);
    }

    const globalCount = Math.max(1, global.size);
    const bandCount = perBand.size;
    let maxPerBand = 0;
    let singleValuedBands = 0;
    let completeBands = 0;
    for (const bandSet of perBand.values()) {
        if (bandSet.size > maxPerBand) maxPerBand = bandSet.size;
        if (bandSet.size <= 1) singleValuedBands++;
        if (bandSet.size === globalCount) completeBands++;
    }

    const threshold = options?.nestedSnapThreshold ?? DEFAULT_NESTED_SNAP_THRESHOLD;
    const nestedFraction = bandCount > 0 ? singleValuedBands / bandCount : 1;
    const mode = recommendMode(maxPerBand, globalCount, nestedFraction, threshold);

    return {
        mode,
        dodge: mode !== 'none',
        laneCount: globalCount,
        ambiguous: maxPerBand > 1 && completeBands < bandCount,
        maxPerBand,
        global: globalCount,
        bandCount,
    };
}

/** Number of sub-lanes a resolved mode reserves per band. */
export function laneCountForMode(plan: BandDodgePlan, mode: DodgeMode): number {
    if (mode === 'global') return plan.global;
    if (mode === 'local') return Math.max(1, plan.maxPerBand);
    return 1;
}

/**
 * Apply a user `dodge` override on top of a plan. `none`/`local`/`global` are
 * hard overrides; `auto` (or unset) follows the compiler recommendation. A dodge
 * mode is downgraded to `none` when nothing actually subdivides a band
 * (`maxPerBand <= 1`), so forcing dodge on redundant color can't collapse it.
 */
export function resolveDodge(
    plan: BandDodgePlan,
    override?: string,
): { mode: DodgeMode; laneCount: number } {
    let mode: DodgeMode =
        override === 'none' || override === 'local' || override === 'global'
            ? override
            : plan.mode;
    if (mode !== 'none' && plan.maxPerBand <= 1) mode = 'none';
    return { mode, laneCount: laneCountForMode(plan, mode) };
}

// ---------------------------------------------------------------------------
// Back-compat shim (pre-`local` callers that only need a dodge boolean).
// `local` currently renders via the global offset path, so its lane count is
// the global one until the per-backend `local` renderer lands (Stage 2).
// ---------------------------------------------------------------------------

/** @deprecated user-facing values; prefer {@link DodgeOption}. */
export type ColorLayoutMode = DodgeOption;

/** @deprecated prefer {@link resolveDodge}. Maps the mode to a dodge boolean and
 *  the global lane count (the only lane count the current renderers support). */
export function resolveBandDodge(
    plan: BandDodgePlan,
    override?: string,
): { dodge: boolean; laneCount: number } {
    // Legacy override spellings → new modes.
    const normalized = override === 'dodge' ? 'global' : override === 'nested' ? 'none' : override;
    const { mode } = resolveDodge(plan, normalized);
    return { dodge: mode !== 'none', laneCount: plan.laneCount };
}

```

### Core Architecture Module: `packages/flint-js/src/core/chart-transitions.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Central chart-type **transition registry** — the θ graph.
 *
 * This is the single source of truth for which sibling chart types a given chart
 * can re-render as (Control B / `θ` in the two-control transform model). It
 * replaces the per-template, per-backend inline `transitions` arrays: a chart
 * template no longer declares what it can turn into — the compiler looks the
 * edges up here by chart-type display name.
 *
 * Design notes (design-docs/chart-transform-two-axes.md §4, and the "registry"
 * discussion):
 *   - Edges are keyed by the *authored* chart type's display name.
 *   - Each edge is a CANDIDATE. It is still gated at runtime against the live
 *     encoding + data (route feasibility + the declarative gates on
 *     `PivotTransition`: requireOrderedAxis / requireNonNegative /
 *     maxCategoryCardinality / requireNoSeries / requireDiscreteSource /
 *     maxSourceCardinality) AND against backend availability (an edge is hidden
 *     when the target template does not exist in the active backend's registry).
 *   - So "not all mappings make sense" is handled twice: only sensible edges are
 *     declared here (the §4 catalog), and even a declared edge is withheld when
 *     the data / backend does not support it.
 *   - Edges should be *reversible*: if A → B is declared, B → A generally should
 *     be too (verified by tests), so a transform round-trips home.
 *
 * Grouped by data-signature family (design doc §4).
 */

import { PivotTransition } from './types';

export const CHART_TRANSITIONS: Record<string, PivotTransition[]> = {
    // ── Categorical comparison — D × M (§4.1) ──────────────────────────────
    'Bar Chart': [
        // Ordered-axis bridge into the trend family (§4.9). Only when the domain
        // axis is temporal/ordinal — an unordered nominal bar never sprouts a line.
        // orientDomainAxis:'x' re-orients a horizontal bar so time stays horizontal.
        { to: 'Line Chart', label: 'Line', requireOrderedAxis: true, orientDomainAxis: 'x' },
        { to: 'Area Chart', label: 'Area', requireOrderedAxis: true, requireNonNegative: true, orientDomainAxis: 'x' },
        // Same D×M signature, lighter ink.
        { to: 'Lollipop Chart', label: 'Lollipop' },
    ],
    'Lollipop Chart': [
        { to: 'Bar Chart', label: 'Bar' },
    ],
    'Grouped Bar Chart': [
        {
            to: 'Stacked Bar Chart',
            label: 'Stacked',
            route: { from: 'group', to: 'color', mode: 'move' },
            requireDiscreteSource: true,
        },
        // A 2-sided grouped bar reads as a population pyramid (mirrored).
        {
            to: 'Pyramid Chart',
            label: 'Pyramid',
            route: { from: 'group', to: 'color', mode: 'move' },
            requireDiscreteSource: true,
            maxSourceCardinality: 2,
        },
    ],
    'Stacked Bar Chart': [
        {
            to: 'Grouped Bar Chart',
            label: 'Grouped',
            route: { from: 'color', to: 'group', mode: 'move' },
            requireDiscreteSource: true,
            maxSourceCardinality: 12,
        },
    ],
    // Population pyramid = a 2-sided category × measure; its complement is the
    // side-by-side grouped bar (the 2 sides dodged instead of mirrored).
    'Pyramid Chart': [
        {
            to: 'Grouped Bar Chart',
            label: 'Grouped',
            route: { from: 'color', to: 'group', mode: 'move' },
            requireDiscreteSource: true,
        },
    ],

    // ── Trend over an ordered domain — T × M (§4.2) ────────────────────────
    'Line Chart': [
        { to: 'Area Chart', label: 'Area', requireNonNegative: true },
        // Back to discrete-period comparison; only readable with few ticks.
        { to: 'Bar Chart', label: 'Bar', maxCategoryCardinality: 30 },
        // Small-multiple trend strips (one per series) — needs a series. Route
        // the series onto `color` (from wherever it sits — color OR a column/row
        // facet) so the Sparkline template picks it up as its row series.
        { to: 'Sparkline', label: 'Sparklines', requireSeries: true, route: { from: 'series', to: 'color', mode: 'move' } },
    ],
    'Area Chart': [
        { to: 'Line Chart', label: 'Line' },
        { to: 'Bar Chart', label: 'Bar', maxCategoryCardinality: 30 },
        { to: 'Streamgraph', label: 'Stream', requireSeries: true, requireNonNegative: true, route: { from: 'series', to: 'color', mode: 'move' } },
    ],
    // Small-multiple trend table → a single overlaid multi-series line.
    'Sparkline': [
        { to: 'Line Chart', label: 'Line' },
    ],
    // Flowing composition → back to baseline-anchored trend / area. Both reads
    // are safe; note Streamgraph → Line is intentionally *one-directional* (there
    // is no Line → Streamgraph — see the note above).
    'Streamgraph': [
        { to: 'Area Chart', label: 'Area' },
        { to: 'Line Chart', label: 'Line' },
    ],

    // ── Two-measure relationship — M₁ × M₂ (§4.3) ──────────────────────────
    'Scatter Plot': [
        {
            to: 'Strip Plot',
            label: 'Jitter',
            route: { from: 'series', to: 'x', mode: 'swap', spill: 'color' },
        },
        // Add a fitted trend layer over the same cloud — only a clean
        // two-measure scatter (both axes quantitative, no size bubble).
        { to: 'Regression', label: 'Trend', requireBiaxialMeasure: true, requireNoSize: true },
    ],
    'Regression': [
        { to: 'Scatter Plot', label: 'Scatter' },
    ],
    'Strip Plot': [
        {
            to: 'Scatter Plot',
            label: 'Scatter',
            route: { from: 'color', to: 'x', mode: 'swap', spill: 'color' },
        },
        // A strip plot is a per-category distribution: box (summary) + violin
        // (density) are the same {x:category, y:measure} layout, no route.
        { to: 'Boxplot', label: 'Box' },
        { to: 'Violin Plot', label: 'Violin' },
    ],

    // ── Univariate distribution — M (§4.4) ─────────────────────────────────
    'Histogram': [
        { to: 'Density Plot', label: 'Density' },
        { to: 'ECDF Plot', label: 'ECDF' },
    ],
    'Density Plot': [
        { to: 'Histogram', label: 'Histogram' },
        { to: 'ECDF Plot', label: 'ECDF' },
    ],
    'ECDF Plot': [
        { to: 'Histogram', label: 'Histogram' },
        { to: 'Density Plot', label: 'Density' },
    ],
    'Boxplot': [
        { to: 'Violin Plot', label: 'Violin' },
        { to: 'Strip Plot', label: 'Strip' },
    ],
    'Violin Plot': [
        { to: 'Boxplot', label: 'Box' },
        { to: 'Strip Plot', label: 'Strip' },
    ],
};

/**
 * Look up the candidate θ transitions for a chart type (by display name).
 * Returns an empty array when the chart declares none.
 */
export function getChartTransitions(chart: string | undefined): PivotTransition[] {
    if (!chart) return [];
    return CHART_TRANSITIONS[chart] ?? [];
}

```

### Core Architecture Module: `packages/flint-js/src/core/chart-type-recommendation.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * =============================================================================
 * DATA-DRIVEN CHART *TYPE* RECOMMENDATION
 * =============================================================================
 *
 * `recommendChannels` / `getRecommendation` answer "which fields go on which
 * channels **for a chart type I already picked**". They do not answer the step
 * that sits *in front* of them: **which chart type should I use at all?**
 *
 * This module fills that gap. Given raw rows + semantic-type annotations it
 * builds a deterministic {@link DataProfile} (how many measures / temporals /
 * categoricals / geographic fields the table has, and their cardinalities) and
 * scores a ranked list of candidate chart types.
 *
 * It reuses the same semantic-type classification the encoders use
 * (`isMeasureType`, `isTimeSeriesType`, `isGeoType`, …) so the two stages agree
 * on what a field *is*; it only adds the type-selection heuristic on top.
 *
 * Typical use (e.g. Data Formulator surfacing suggestions without a model call):
 *
 * ```ts
 * const types = recommendChartTypes(rows, semanticTypes); // ["Choropleth", "Line Chart", …]
 * const encodings = vlRecommendEncodings(types[0], rows, semanticTypes);
 * ```
 *
 * Backend wrappers (`vlRecommendChartTypes`, …) pass `supportedTypes` so only
 * chart types that backend can actually render are returned, and pair it with
 * their `…RecommendEncodings` to emit type + channels in one step
 * (`…RecommendCharts`).
 *
 * =============================================================================
 */

import {
    isMeasureType,
    isTimeSeriesType,
    isCategoricalType,
    isOrdinalType,
    isGeoCoordinateType,
    isGeoLocationString,
    isNonMeasureNumeric,
} from './semantic-types';
import { buildTableView, nameMatches, type InternalTableView } from './recommendation';

// ── Field roles ─────────────────────────────────────────────────────────

/**
 * The role a field plays when choosing a chart type. Mutually exclusive:
 * every field is classified into exactly one role (the most specific one).
 */
export type ChartFieldRole =
    | 'measure'      // true quantitative measure (aggregatable)
    | 'temporal'     // date / time-granule — a time axis
    | 'categorical'  // nominal category / entity
    | 'ordinal'      // ordered discrete (Rank, Range, Score, …)
    | 'geoPlace'     // named place: Country, State, City, Region …
    | 'latitude'     // geographic latitude coordinate
    | 'longitude'    // geographic longitude coordinate
    | 'identifier'   // row id / index — not useful as a category or measure
    | 'other';       // unclassified

/** A single field annotated with its data/semantic type, cardinality, and role. */
export interface ProfiledField {
    name: string;
    /** Vega-Lite-style vis category: 'quantitative' | 'temporal' | 'nominal' | 'ordinal'. */
    type: string;
    /** Semantic type annotation (e.g. "Country", "Amount"), or '' if none. */
    semanticType: string;
    /** Number of distinct non-null values. */
    cardinality: number;
    role: ChartFieldRole;
}

/**
 * A deterministic summary of a table's shape, used to rank chart types.
 * The bucketed arrays are views over {@link fields} grouped by role, plus
 * `dimensions` (all category-axis-capable fields: categorical ∪ ordinal ∪
 * geoPlace ∪ temporal).
 */
export interface DataProfile {
    fields: ProfiledField[];
    measures: ProfiledField[];
    temporals: ProfiledField[];
    categoricals: ProfiledField[];
    ordinals: ProfiledField[];
    geoPlaces: ProfiledField[];
    latitudes: ProfiledField[];
    longitudes: ProfiledField[];
    identifiers: ProfiledField[];
    /** Fields usable on a category/discrete axis (categorical ∪ ordinal ∪ geoPlace ∪ temporal). */
    dimensions: ProfiledField[];
    rowCount: number;
}

// Identifier name patterns — strict (exact or `_suffix`) to avoid false hits
// like "grid" / "valid" / "android". `rank` is intentionally excluded so a
// Rank field classifies as ordinal (a usable axis) rather than an identifier.
const ID_NAME_PATTERNS = ['id', 'index', 'idx', 'row', 'order', 'position', 'pos'];

function looksLikeIdentifier(name: string): boolean {
    const lower = name.toLowerCase();
    return ID_NAME_PATTERNS.some(p => lower === p || lower.endsWith('_' + p));
}

/**
 * Classify one field into a single {@link ChartFieldRole}. The order of checks
 * is significant: the most *specific* interpretation wins (geo coordinate →
 * geo place → temporal → identifier → measure → ordinal → categorical).
 */
function classifyRole(name: string, type: string, semanticType: string): ChartFieldRole {
    const st = semanticType;
    // Geographic coordinates (Latitude / Longitude): numeric but not measures.
    if (isGeoCoordinateType(st)) {
        if (st === 'Latitude' || nameMatches(name, ['latitude', 'lat'])) return 'latitude';
        if (st === 'Longitude' || nameMatches(name, ['longitude', 'lon', 'lng', 'long'])) return 'longitude';
        return 'other';
    }
    // Named geographic places (Country / State / City / Region / …).
    if (isGeoLocationString(st)) return 'geoPlace';
    // Time axis.
    if (type === 'temporal' || isTimeSeriesType(st)) return 'temporal';
    // Row identifiers — demoted so they never become a category or measure.
    if (st === 'ID' || looksLikeIdentifier(name)) return 'identifier';
    // True quantitative measure (mirrors isQuantitativeField in the encoders).
    if (type === 'quantitative' && !isNonMeasureNumeric(st) && (isMeasureType(st) || st === '')) {
        return 'measure';
    }
    // Ordered discrete (Rank, Range, Score-as-ordinal, Direction, …).
    if (isOrdinalType(st)) return 'ordinal';
    // Plain category.
    if (type === 'nominal' || isCategoricalType(st)) return 'categorical';
    return 'other';
}

/**
 * Build a {@link DataProfile} from raw rows + semantic-type annotations.
 * Deterministic — no random sampling; classification is per-field and
 * order-independent.
 *
 * @param data           Array of row objects.
 * @param semanticTypes  Field → semantic-type map (e.g. `{ Entity: "Country" }`).
 */
export function profileData(data: any[], semanticTypes: Record<string, string>): DataProfile {
    const tv: InternalTableView = buildTableView(data, semanticTypes);
    const fields: ProfiledField[] = tv.names.map(name => ({
        name,
        type: tv.fieldType[name] ?? 'nominal',
        semanticType: tv.fieldSemanticType[name] ?? '',
        cardinality: tv.fieldLevels[name]?.length ?? 0,
        role: classifyRole(name, tv.fieldType[name] ?? 'nominal', tv.fieldSemanticType[name] ?? ''),
    }));

    const by = (r: ChartFieldRole) => fields.filter(f => f.role === r);
    const categoricals = by('categorical');
    const ordinals = by('ordinal');
    const geoPlaces = by('geoPlace');
    const temporals = by('temporal');

    return {
        fields,
        measures: by('measure'),
        temporals,
        categoricals,
        ordinals,
        geoPlaces,
        latitudes: by('latitude'),
        longitudes: by('longitude'),
        identifiers: by('identifier'),
        dimensions: [...categoricals, ...ordinals, ...geoPlaces, ...temporals],
        rowCount: tv.rows.length,
    };
}

// ── Scoring ─────────────────────────────────────────────────────────────

/** A ranked chart-type candidate with its score and human-readable reasons. */
export interface ChartTypeSuggestion {
    chartType: string;
    /** Higher is a better fit. Scores are relative; only the ordering is meaningful. */
    score: number;
    reasons: string[];
}

/** Options for {@link recommendChartTypes} / {@link recommendChartTypesDetailed}. */
export interface RecommendChartTypesOptions {
    /**
     * Restrict results to these chart-type names (e.g. a backend's template
     * catalog). Types not in the list are dropped. Omit for all shared types.
     */
    supportedTypes?: string[];
    /** Cap the number of suggestions returned (after ranking). */
    max?: number;
}

/**
 * A recommended chart type paired with its recommended channel → field
 * encodings. Returned by the backend one-step recommenders
 * (`vlRecommendCharts`, …) that chain type selection with encoding selection.
 */
export interface RecommendedChart {
    chartType: string;
    encodings: Record<string, string>;
}

// Cardinality thresholds for readability gates.
const LOW_CARD_SERIES = 12;   // a legend/series stays readable up to ~12 colors
const LOW_CARD_AXIS = 25;     // a discrete heatmap axis stays readable up to ~25 bands
const PIE_MAX_SLICES = 8;     // a pie is legible only with a handful of slices

/** Semantic types the choropleth base maps can actually render (see map.ts). */
const CHOROPLETH_SEMANTIC = new Set(['Country', 'State']);
const CHOROPLETH_NAME_HINTS = ['country', 'state', 'province', 'nation'];

/**
 * Score candidate chart types for a data profile. Returns suggestions sorted by
 * descending score; ties keep a stable, priority-ordered arrangement.
 *
 * The rules are curated design heuristics: more *specific* chart types
 * (maps, time series) outrank generic ones (bar) when the data supports them,
 * so a table with a geographic place + a measure surfaces "Choropleth" ahead of
 * "Bar Chart" without a model call.
 */
export function rankChartTypes(profile: DataProfile): ChartTypeSuggestion[] {
    const {
        measures, temporals, categoricals, ordinals, geoPlaces,
        latitudes, longitudes, rowCount,
    } = profile;

    const catLike = [...categoricals, ...ordinals, ...geoPlaces]; // discrete, non-temporal
    const dims = profile.dimensions;
    const lowCardCatLike = catLike.filter(f => f.cardinality >= 2 && f.cardinality <= LOW_CARD_SERIES);
    const lowCardDims = dims.filter(f => f.cardinality >= 2 && f.cardinality <= LOW_CARD_AXIS);
    const hasMeasure = measures.length >= 1;

    // Preserve insertion o
```

### Core Architecture Module: `packages/flint-js/src/core/color-decisions.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
+ * =============================================================================
+ * COLOR DECISIONS (backend-agnostic)
+ * =============================================================================
+ *
+ * Pure decision layer for choosing colormaps based on:
+ *   - Field semantics (FieldSemantics / ColorSchemeHint)
+ *   - Channel semantics (ChannelSemantics)
+ *   - Chart type & encodings
+ *   - Data statistics (distinct count, numeric range)
+ *
+ * This module does NOT know about Vega-Lite / ECharts syntax.
+ * It only returns abstract colormap identifiers and palette needs.
+ * Backends translate these decisions into concrete scale/option config.
+ * =============================================================================
+ */

import type { ChartEncoding, ChannelSemantics } from './types';

// -----------------------------------------------------------------------------
// 公共类型
// -----------------------------------------------------------------------------

export type ColorMapType = 'categorical' | 'sequential' | 'diverging';

export type ColorChannel = 'color' | 'group' | 'fill' | 'stroke';

export interface ColorDecision {
    channel: ColorChannel;
    schemeType: ColorMapType;
    /**
     * 具体 colormap 标识：
     *   - 当用户在 encoding.scheme 中显式指定时，这里会带上该 id（如 'viridis'）。
     *   - 自动决策路径下，core 不再选择具体 id，schemeId 留空，由各后端的 colormap
     *     模块根据 schemeType / categoryCount / backend 主题自行挑选合适的 palette。
     */
    schemeId?: string;
    divergingMidpoint?: number;
    categoryCount?: number;
    /** 是否是主编码（影响后续主题/对比度策略） */
    primary: boolean;
    /** 是否是数据驱动的颜色（而非常量色） */
    dataDriven: boolean;
}

/**
 * 一个后端无关的颜色决策结果：按 channel 存一份。
 */
export interface ColorDecisionResult {
    color?: ColorDecision;
    group?: ColorDecision;
    fill?: ColorDecision;
    stroke?: ColorDecision;
}

// -----------------------------------------------------------------------------
// 通道级颜色决策
// -----------------------------------------------------------------------------

interface DecideColorMapsContext {
    chartType: string;
    encodings: Record<string, ChartEncoding>;
    channelSemantics: Record<string, ChannelSemantics>;
    table: any[];
    // backend: 'vegalite' | 'echarts' | 'chartjs';
    background?: 'light' | 'dark';
}

function inferColorChannelPrimary(channel: ColorChannel, chartType: string): boolean {
    // 目前简单：color / group 视为主色通道
    if (channel === 'color' || channel === 'group') return true;
    return false;
}

/**
 * 从 ChannelSemantics 推断需要的 scheme 类型（categorical / sequential / diverging）。
 */
function decideSchemeTypeFromChannel(
    channel: ColorChannel,
    cs: ChannelSemantics | undefined,
): { schemeType: ColorMapType; divergingMidpoint?: number } {
    const hint = cs?.colorScheme;
    if (hint) {
        // 若语义推荐是 diverging，则直接按发散处理。
        if (hint.type === 'diverging') {
            return {
                schemeType: 'diverging',
                // resolve-semantics 里用 domainMid 表示 diverging 中点
                divergingMidpoint: (hint as any).domainMid,
            };
        }
        // 若推荐为 sequential，则直接按顺序色带处理。
        if (hint.type === 'sequential') {
            return { schemeType: 'sequential' };
        }
        // 语义推荐为 categorical，但编码类型实际是 temporal 时，
        // 对 color 通道优先按连续时间轴处理，使用 sequential colormap，
        // 而不是一条一条离散颜色（防止 Date/Time 被当成类别色盘）。
        if (hint.type === 'categorical') {
            // 若语义为 Rank，则更适合作为连续数轴上的等级映射，
            // 使用 continuous colormap（sequential），否则按普通类别处理。
            const semType = cs?.semanticAnnotation?.semanticType;
            const isRankLike = semType === 'Rank';
            if (isRankLike) {
                return { schemeType: 'sequential' };
            }

            if (cs?.type === 'temporal' && channel === 'color') {
                return { schemeType: 'sequential' };
            }
            return { schemeType: 'categorical' };
        }
    }

    // 没 hint 时，用语义 + encoding type 兜底
    const encType = cs?.type;
    const semType = cs?.semanticAnnotation?.semanticType;

    // 相关系数 [-1,1] 等「双向度量」优先使用发散色带，以 0 为中点。
    if (semType === 'Correlation') {
        return { schemeType: 'diverging', divergingMidpoint: 0 };
    }

    if (encType === 'quantitative' || encType === 'temporal') {
        return { schemeType: 'sequential' };
    }

    return { schemeType: 'categorical' };
}

function countDistinctValues(table: any[], field: string | undefined): number | undefined {
    if (!field) return undefined;
    const set = new Set<any>();
    for (const row of table) {
        if (row == null) continue;
        set.add(row[field]);
    }
    return set.size;
}

function decideColorForChannel(
    channel: ColorChannel,
    ctx: DecideColorMapsContext,
): ColorDecision | undefined {
    const encoding = ctx.encodings[channel as string];
    const cs = ctx.channelSemantics[channel as string];

    // 没字段就不是数据驱动色，不做决策
    if (!encoding || !cs?.field) return undefined;

    const dataDriven = true;
    const primary = inferColorChannelPrimary(channel, ctx.chartType);

    // 1. 显式 scheme 优先
    if (encoding.scheme && encoding.scheme !== 'default') {
        const distinct = countDistinctValues(ctx.table, cs.field);
        // 用户显式指定 scheme 时，core 只透传 id，并根据 ChannelSemantics 推断类型；
        // 真正选择调色板由各后端的 colormap 模块完成。
        const { schemeType } = decideSchemeTypeFromChannel(channel, cs);
        return {
            channel,
            schemeType,
            schemeId: encoding.scheme,
            categoryCount: distinct,
            primary,
            dataDriven,
        };
    }

    // 2. 基于 ChannelSemantics.colorScheme 的 family 决策
    const { schemeType, divergingMidpoint } = decideSchemeTypeFromChannel(channel, cs);
    const distinct = countDistinctValues(ctx.table, cs.field);

    return {
        channel,
        schemeType,
        divergingMidpoint,
        categoryCount: distinct,
        primary,
        dataDriven,
    };
}

/**
 * 主入口：根据 chart / encodings / channelSemantics / data 计算颜色决策。
 */
export function decideColorMaps(ctx: DecideColorMapsContext): ColorDecisionResult {
    const result: ColorDecisionResult = {
        color: undefined,
        group: undefined,
        fill: undefined,
        stroke: undefined,
    };

    // 目前只对 color / group 做决策，fill / stroke 预留
    const channels: ColorChannel[] = ['color', 'group'];
    for (const ch of channels) {
        const decision = decideColorForChannel(ch, ctx);
        if (decision) {
            result[ch] = decision;
        }
    }

    return result;
}
```

### Core Architecture Module: `packages/flint-js/src/core/compute-layout.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * =============================================================================
 * PHASE 1: COMPUTE LAYOUT
 * =============================================================================
 *
 * Determine how big things should be — axis lengths, step sizes,
 * subplot dimensions, label sizing, and overflow truncation — from data
 * density, axis classification, and template-provided tuning knobs.
 *
 * VL dependency: **None**
 *
 * This module reads abstract axis descriptors (AxisLayoutInput) and
 * produces abstract layout numbers (LayoutResult). The same layout
 * engine works regardless of output format.
 *
 * ── Backend Responsibility ──────────────────────────────────────────
 * The LayoutResult is a target-agnostic description of "how big things
 * should be".  Each rendering backend (Vega-Lite, ECharts, etc.) MUST:
 *
 *   1. Call computeLayout() once per chart (facet-aware — it already
 *      divides subplot sizes for the facet grid).
 *
 *   2. Translate the LayoutResult into its own rendering format:
 *      - subplotWidth / subplotHeight → plot area size (before margins)
 *      - xStep / yStep → bar widths, band sizes, category spacing
 *      - stepPadding → inter-category gap (barCategoryGap, paddingInner)
 *      - label sizing → font size, rotation, truncation
 *
 *   3. Add its own margins, padding, and chrome (axis labels, titles,
 *      legends, CANVAS_BUFFER) around the subplot area.
 *
 *   4. Handle facet-specific concerns itself:
 *      - Column wrapping (when user specifies column-only, the backend
 *        decides how many columns per visual row and restructures the
 *        panel grid accordingly).
 *      - Per-panel vs shared axis titles.
 *      - Panel positioning and header labels.
 *
 * The layout engine does NOT know about VL encodings, ECharts grid
 * objects, or any rendering-specific structure.
 * =============================================================================
 */

import type {
    ChannelSemantics,
    LayoutDeclaration,
    LayoutResult,
    AssembleOptions,
    ChannelBudgets,
} from './types';
import {
    computeAxisStep,
    computeGasPressure,
    computeLabelSizing,
    computeFontSizing,
    DEFAULT_GAS_PRESSURE_PARAMS,
    type ElasticStretchParams,
    type GasPressureParams,
} from './decisions';
import { planBandDodge } from './band-dodge';

// ---------------------------------------------------------------------------
// Short discrete axis labels (align with echarts/templates/bar.ts)
// ---------------------------------------------------------------------------

const VL_SHORT_DISCRETE_CATEGORY_COUNT = 4;
const VL_SHORT_DISCRETE_LABEL_MAX_LEN = 8;

/** Approximate width (px) of one label character at the given font size. */
const APPROX_CHAR_WIDTH_RATIO = 0.62;

/**
 * How wide one category may grow when a sparse axis fits itself to the room it
 * has. Past this a "band" stops reading as a mark and starts reading as a
 * panel, however much canvas is going spare.
 */
const SPARSE_FIT_BAND_CEILING = 100;

/** Smallest readable default step for a discrete item before overflow activates. */
export const DEFAULT_MIN_STEP = 8;

/** Distinct label strings for a discrete axis field, plus derived stats. */
interface DiscreteLabelStats {
    count: number;
    maxLen: number;
    /** True when every label parses as a finite number (e.g. years, bins, IDs). */
    allNumeric: boolean;
}

function computeDiscreteLabelStats(
    field: string | undefined,
    table: any[],
): DiscreteLabelStats | null {
    if (!field) return null;
    const uniques = new Set<string>();
    for (const row of table) {
        const v = row[field];
        if (v == null || v === '') continue;
        uniques.add(String(v));
    }
    if (uniques.size === 0) return null;
    const labels = [...uniques];
    return {
        count: labels.length,
        maxLen: Math.max(...labels.map(s => s.length)),
        allNumeric: labels.every(s => s.trim() !== '' && isFinite(Number(s))),
    };
}

/**
 * Few, short category strings → keep axis labels horizontal in Vega-Lite. Used
 * for the Y axis, where banded labels read horizontally in the left margin
 * regardless of band height (so quantitative/numeric labels stay horizontal).
 */
function discreteYAxisShouldUseHorizontalLabels(
    field: string | undefined,
    channelType: string | undefined,
    table: any[],
): boolean {
    if (!field) return false;
    if (channelType === 'quantitative') return true;
    const stats = computeDiscreteLabelStats(field, table);
    if (!stats) return false;
    if (stats.count > VL_SHORT_DISCRETE_CATEGORY_COUNT) return false;
    return stats.maxLen <= VL_SHORT_DISCRETE_LABEL_MAX_LEN;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface AxisLayoutInput {
    /** Spring model (banded) or gas pressure (non-banded) */
    mode: 'banded' | 'non-banded';
    /** Number of discrete positions (for banded) */
    itemCount: number;
    /** Number of sub-items per group (for grouped bars) */
    subItemsPerGroup?: number;
    /** Numeric values along this axis (for gas pressure) */
    values?: number[];
    /** Data extent [min, max] */
    domain?: [number, number];
    /** Number of distinct series (for series-based pressure) */
    seriesCount?: number;
}

// ---------------------------------------------------------------------------
// Stretch caps
// ---------------------------------------------------------------------------

/**
 * Resolve the per-dimension maximum stretch caps (βx, βy) from options.
 *
 * The assembler derives `maxStretchX`/`maxStretchY` from the spec's
 * `canvasSize / baseSize` ratio (the hard ceiling). When neither is set,
 * both fall back to the scalar `maxStretch` (default {@link DEFAULT_MAX_STRETCH})
 * — the symmetric budget used when the spec pins no `canvasSize`. Each cap is
 * clamped to ≥ 1 (a chart never shrinks below its base under "stretch").
 */
export function resolveStretchCaps(options: AssembleOptions): { x: number; y: number } {
    const def = options.maxStretch ?? DEFAULT_MAX_STRETCH;
    return {
        x: Math.max(1, options.maxStretchX ?? def),
        y: Math.max(1, options.maxStretchY ?? def),
    };
}

/** Default base (target) chart size in pixels when the spec omits `baseSize`. */
export const DEFAULT_BASE_SIZE = { width: 400, height: 320 } as const;

/**
 * Default axis stretch cap used when the spec pins no `canvasSize` ceiling.
 *
 * Bounds how far a chart may grow past its base size (per dimension) under
 * layout pressure. 1.5 keeps growth modest; 2× was found to over-stretch
 * charts in the general (no-ceiling) case.
 */
export const DEFAULT_MAX_STRETCH = 1.5;

/**
 * Resolve the effective base (target) size the layout pipeline aims for.
 *
 * Defaults to {@link DEFAULT_BASE_SIZE} when the spec omits `baseSize`, then
 * clamps each dimension to the optional `canvasSize` ceiling. This guarantees
 * the target never exceeds the hard maximum: when a user sets only a (small)
 * `canvasSize` and leaves `baseSize` defaulted — or sets a `baseSize` larger
 * than the ceiling — the chart shrinks to fit the box instead of overflowing
 * it. After clamping, `deriveStretchCaps` yields βx/βy = 1 in any clamped
 * dimension (pure fit-to-box, no growth past the ceiling).
 */
export function resolveBaseSize(
    specBaseSize: { width: number; height: number } | undefined,
    ceiling: { width: number; height: number } | undefined,
): { width: number; height: number } {
    const base = specBaseSize ?? { ...DEFAULT_BASE_SIZE };
    if (!ceiling) return { width: base.width, height: base.height };
    return {
        width: Math.min(base.width, ceiling.width),
        height: Math.min(base.height, ceiling.height),
    };
}

/**
 * Read the user's `facetColumns` chart property (the interactive facet-wrap
 * control) off the RAW chart_spec.chartProperties, returning a clamped integer
 * column count or undefined for auto. Read raw (pre-normalization) because
 * `facetColumns` is a layout-level option, not a per-template mark property, so
 * `normalizeChartProperties` would otherwise drop it as an unknown key.
 */
export function resolveFacetColumnsOption(
    chartProperties: Record<string, any> | undefined,
): number | undefined {
    const raw = chartProperties?.facetColumns;
    if (raw == null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
}

/**
 * Derive per-dimension stretch ceilings (βx, βy) for an assembler.
 *
 * When the spec supplies a hard `canvasSize` ceiling, the caps are the ratio
 * of ceiling to base in each dimension (clamped to ≥ 1). The base passed here
 * is expected to already be clamped to the ceiling (see {@link resolveBaseSize}),
 * so a ceiling smaller than the spec's base resolves to β = 1 (fit-to-box)
 * rather than an overflow. When no ceiling is given, both caps fall back to
 * `options.maxStretch` (or {@link DEFAULT_MAX_STRETCH} when that is unset too),
 * which already reflects any template `paramOverrides`.
 *
 * Assemblers inject the result into `effectiveOptions.maxStretchX/Y` so the
 * whole layout pipeline shares one budget — including faceted grids, whose
 * total size is bounded by the same ceiling.
 */
export function deriveStretchCaps(
    baseSize: { width: number; height: number },
    ceiling: { width: number; height: number } | undefined,
    options: AssembleOptions,
): { maxStretchX: number; maxStretchY: number } {
    const def = options.maxStretch ?? DEFAULT_MAX_STRETCH;
    return {
        maxStretchX: ceiling ? Math.max(1, ceiling.width / baseSize.width) : def,
        maxStretchY: ceiling ? Math.max(1, ceiling.height / baseSize.height) : def,
    };
}

// ---------------------------------------------------------------------
```

### Core Architecture Module: `packages/flint-js/src/core/decisions.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * =============================================================================
 * REUSABLE DECISION LOGIC
 * =============================================================================
 *
 * Pure decision functions that determine chart layout behavior.
 * These functions take data/config inputs and return decision objects —
 * NO Vega-Lite spec mutation happens here.
 *
 * The separation ensures:
 * 1. Decision logic is testable in isolation
 * 2. Same decisions can drive different output formats (VL, SVG, etc.)
 * 3. Templates can call decision functions without coupling to VL
 *
 * Naming conventions:
 *   - `compute*()` — returns a decision/value from inputs
 *   - `resolve*()` — picks from alternatives (type resolution, etc.)
 *   - `classify*()` — categorizes an input
 * =============================================================================
 */

import {
    inferVisCategory,
    type VisCategory,
} from './semantic-types';
import { getRegistryEntry, isRegistered } from './type-registry';

// ---------------------------------------------------------------------------
// Encoding Type Resolution
// ---------------------------------------------------------------------------

/**
 * Result of encoding type resolution.
 * Separates the decision from what gets written into VL.
 */
export interface EncodingTypeDecision {
    /** The resolved VL encoding type */
    vlType: 'quantitative' | 'ordinal' | 'nominal' | 'temporal';
    /** The VisCategory that drove the decision */
    visCategory: VisCategory;
    /** Whether the type was overridden by channel rules */
    channelOverride: boolean;
    /** Whether the type was overridden by cardinality/fraction guard */
    cardinalityGuard: boolean;
}

// ---------------------------------------------------------------------------
// Helpers for encoding type resolution
// ---------------------------------------------------------------------------

/**
 * Map a VisCategory to the corresponding VL encoding type string.
 * Geographic maps to quantitative since VL uses quantitative for coordinates.
 */
function visCategoryToVLType(vc: VisCategory): 'quantitative' | 'ordinal' | 'nominal' | 'temporal' {
    switch (vc) {
        case 'quantitative': return 'quantitative';
        case 'ordinal': return 'ordinal';
        case 'temporal': return 'temporal';
        case 'geographic': return 'quantitative';
        case 'nominal':
        default: return 'nominal';
    }
}

/**
 * Validate that field values actually parse as dates.
 *
 * @param fromRegistry  If true, uses a looser threshold (≥30%) since the
 *                      semantic type explicitly identified the field as temporal.
 *                      If false (data-inferred), requires ≥50%.
 */
function validateTemporalParsing(
    data: any[],
    fieldName: string,
    fromRegistry: boolean,
): boolean {
    // Sample distinct values, not rows. Cartesian data is commonly ordered
    // outer-axis first: in a 60 × 40 heatmap the first StartDate repeats for
    // 40 rows while EndDate changes immediately. Sampling rows therefore
    // declared one date field ordinal and the other temporal solely because of
    // loop order. Walk until we have enough distinct evidence instead.
    const sampleValues: any[] = [];
    const seen = new Set<string>();
    for (const row of data) {
        const value = row[fieldName];
        if (value == null) continue;
        const key = value instanceof Date
            ? `date:${value.getTime()}`
            : `${typeof value}:${String(value)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        sampleValues.push(value);
        if (sampleValues.length >= 15) break;
    }
    if (sampleValues.length === 0) return false;

    // Single unique value → not useful as temporal axis (would show a single point)
    if (sampleValues.length <= 1) return false;

    const looksTemporalValue = (val: any): boolean => {
        if (val instanceof Date) return true;
        if (typeof val === 'number') {
            // Year-like integers (1500–2200)
            if (val >= 1500 && val <= 2200 && val % 1 === 0) return true;
            // Unix-ms timestamps: 86_400_000 (Jan 2, 1970) to ~year 2103
            if (val > 86400000 && val < 4200000000000) return true;
            return false;
        }
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (!trimmed) return false;
            if (/^\d{4}$/.test(trimmed)) return true;
            return !Number.isNaN(Date.parse(trimmed));
        }
        return false;
    };

    const passingCount = sampleValues.filter(looksTemporalValue).length;
    const minFraction = fromRegistry ? 0.3 : 0.5;
    return passingCount / sampleValues.length >= minFraction;
}

/**
 * Apply temporal channel-compatibility adjustments, shared by both
 * registry-driven and data-inferred temporal paths.
 */
function resolveTemporalEncoding(
    visCategory: VisCategory,
    channel: string,
    data: any[],
    fieldName: string,
    fromRegistry: boolean,
): EncodingTypeDecision {
    // Temporal on facet/size channels → ordinal (VL limitation)
    if (['size', 'column', 'row'].includes(channel)) {
        return { vlType: 'ordinal', visCategory, channelOverride: true, cardinalityGuard: false };
    }
    // Temporal on color/group with low cardinality → ordinal for distinct colors
    if (channel === 'color' || channel === 'group') {
        const uniqueCount = new Set(data.map(r => r[fieldName])).size;
        if (uniqueCount <= 12) {
            return { vlType: 'ordinal', visCategory, channelOverride: true, cardinalityGuard: false };
        }
    }
    // Validate temporal parsing
    if (!validateTemporalParsing(data, fieldName, fromRegistry)) {
        return { vlType: 'ordinal', visCategory, channelOverride: false, cardinalityGuard: false };
    }
    return { vlType: 'temporal', visCategory, channelOverride: false, cardinalityGuard: false };
}

/**
 * Apply channel-context guards to an ordinal encoding.
 *
 * Even when the registry says a field is ordinal, channel context may
 * require promoting to quantitative:
 *   - High cardinality on color/group → unreadable legend
 *   - High cardinality on x/y        → bars/lollipops need proportional
 *     spacing and baseline anchoring (y2/x2)
 *   - Fractional values + high cardinality → mis-classified continuous measure
 *
 * @param fromRegistry  Whether the ordinal type came from the registry
 *        (true) or was data-inferred (false). Data-inferred additionally
 *        checks for fractional values (Guard 1).
 */
function applyOrdinalGuards(
    visCategory: VisCategory,
    channel: string,
    data: any[],
    fieldName: string,
    fieldValues: any[],
    fromRegistry: boolean,
): EncodingTypeDecision {
    const numericVals = fieldValues.filter(v => v != null && !isNaN(+v)).map(Number);
    if (numericVals.length > 0) {
        const uniqueCount = new Set(numericVals).size;
        const hasFractions = numericVals.some(v => v % 1 !== 0);

        // Guard 1 (data-inferred only): fractional + high-cardinality →
        // mis-classified continuous measure. Registry types are explicit,
        // so this guard only applies when the type was inferred from data.
        if (!fromRegistry && hasFractions && uniqueCount > 20) {
            return { vlType: 'quantitative', visCategory, channelOverride: false, cardinalityGuard: true };
        }

        // Guard 2: integer ordinal with high cardinality on color/group →
        // a discrete legend with 12+ entries is unreadable; promote to
        // quantitative so VL renders a continuous gradient instead.
        if (!hasFractions && uniqueCount > 12 && ['color', 'group'].includes(channel)) {
            return { vlType: 'quantitative', visCategory, channelOverride: true, cardinalityGuard: true };
        }

        // Guard 3: integer ordinal with high cardinality on position
        // axes (x, y) → charts like bar/lollipop need a quantitative
        // axis for proportional length; treating 12+ unique integers
        // as discrete categories produces an unreadable axis and
        // prevents baseline anchoring (y2/x2).
        if (!hasFractions && uniqueCount > 12 && ['x', 'y'].includes(channel)) {
            return { vlType: 'quantitative', visCategory, channelOverride: true, cardinalityGuard: true };
        }
    }
    return { vlType: 'ordinal', visCategory, channelOverride: false, cardinalityGuard: false };
}

/**
 * Disambiguate when the registry lists multiple visEncodings for a type.
 *
 * Uses channel context and data characteristics to select the most
 * appropriate encoding from the candidates. Each combination of
 * candidate encodings has dedicated logic:
 *
 *   temporal + ordinal  (Year, YearMonth, Decade, …)
 *   quantitative + ordinal  (Score, Rating)
 *   quantitative + geographic  (Latitude, Longitude)
 *   ordinal + nominal  (Direction)
 */
function disambiguateMultiEncoding(
    candidates: VisCategory[],
    channel: string,
    data: any[],
    fieldName: string,
    fieldValues: any[],
): EncodingTypeDecision {
    const has = (vc: VisCategory) => candidates.includes(vc);

    // ── Temporal + Ordinal (Year, YearMonth, Decade, etc.) ────────
    // Time-unit granules. Temporal for continuous time axes (x/y);
    // ordinal for grouping channels (color, facet, size).
    if (has('temporal') && has('ordinal')) {
        return resolveTemporalEncoding('temporal', channel, data, fieldName, true);
    }

    // ── Quantitative + Ordinal (Score, Rating) ────────────────────
    // Bounded discrete numerics. Use ordinal for grouping channels
    // with low cardinality (distinct colors/symbols); quantitative
    // for position axes (proportional spacing, zero-baseline).
    if (has('quantitative') && has('ordinal')) {
        if (['color', 'group'].includes(channel)) {
            co
```

### Core Architecture Module: `packages/flint-js/src/core/encoding-actions.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { ChartEncoding, EncodingActionDef } from './types';

/**
 * Reusable factories for Category-B encoding actions (see EncodingActionDef).
 *
 * These are authored once and attached to many templates, so the per-chart
 * knowledge (which channel is the category axis, which carries the measure)
 * lives in one place instead of being re-implemented per template.
 */

/** The semantic sort choices the Sort control exposes. */
export type SortChoice = 'value-asc' | 'value-desc';

// A measure is a quantitative channel or any aggregated channel.
const isMeasureEnc = (e?: ChartEncoding): boolean =>
    !!e?.field && (!!e.aggregate || e.type === 'quantitative');

// A sortable category axis is discrete (nominal/ordinal). Temporal axes are
// deliberately excluded: reordering a time axis by value scrambles the
// chronology, so Sort should not apply to them.
const isDiscreteCategoryEnc = (e?: ChartEncoding): boolean =>
    !!e?.field && !e.aggregate && e.type !== 'quantitative' && e.type !== 'temporal';

/**
 * Identify the discrete category axis and the measure axis among a pair of
 * position channels, so Sort works under either orientation (vertical or
 * horizontal) and only when a discrete axis actually exists.
 *
 * Returns `null` when there is no discrete category + measure pair to sort —
 * e.g. a temporal-x time series, or two quantitative axes (scatter). Callers
 * use this both to gate visibility and to no-op safely.
 */
function resolveSortChannels(
    encodings: Record<string, ChartEncoding>,
    candidates: [string, string],
): { category: string; measure: string } | null {
    const category = candidates.find(c => isDiscreteCategoryEnc(encodings[c]));
    const measure = candidates.find(c => isMeasureEnc(encodings[c]));
    if (!category || !measure || category === measure) return null;
    return { category, measure };
}

/**
 * Sort the category axis of a bar-like chart by the measure value.
 *
 * Encoding model: a value sort writes `sortBy = <measure channel>` (one of
 * 'x' | 'y', which the assembler understands) on the category channel.
 * "Default" clears the sort so the field's canonical ordering wins — the
 * natural order for ordinal/temporal-like categories, or alphabetic otherwise,
 * as decided by semantic resolution. The action is only applicable — and only
 * visible — when one position channel is a discrete category and the other is
 * a measure.
 *
 * @param channels Position-channel pair (default ['x', 'y']); the orientation
 *                 (which one is the category) is resolved per-encoding at runtime.
 */
export function makeSortAction(options?: {
    key?: string;
    label?: string;
    channels?: [string, string];
}): EncodingActionDef {
    const candidates = options?.channels ?? ['x', 'y'];
    return {
        key: options?.key ?? 'sort',
        label: options?.label ?? 'Sort',
        dependencies: candidates,
        isApplicable: (ctx) => resolveSortChannels(ctx.encodings, candidates) !== null,
        control: {
            type: 'discrete',
            options: [
                { value: undefined, label: 'Default' },
                { value: 'value-desc', label: 'Value ↓' },
                { value: 'value-asc', label: 'Value ↑' },
            ],
        },
        get: (encodings) => {
            const resolved = resolveSortChannels(encodings, candidates);
            if (!resolved) return undefined;
            const { category, measure } = resolved;
            const enc = encodings[category];
            if (enc.sortBy === measure) {
                return enc.sortOrder === 'descending' ? 'value-desc' : 'value-asc';
            }
            // Any other sort (label order, custom value order, sort-by-color)
            // isn't representable by this control → show as Default.
            return undefined;
        },
        set: (encodings, value: SortChoice | undefined) => {
            const resolved = resolveSortChannels(encodings, candidates);
            if (!resolved) return encodings;
            const { category, measure } = resolved;
            const base = encodings[category];
            let next: ChartEncoding;
            switch (value) {
                case 'value-asc':
                    next = { ...base, sortBy: measure, sortOrder: 'ascending' };
                    break;
                case 'value-desc':
                    next = { ...base, sortBy: measure, sortOrder: 'descending' };
                    break;
                default:
                    next = { ...base, sortBy: undefined, sortOrder: undefined };
            }
            return { ...encodings, [category]: next };
        },
    };
}

```

### Core Architecture Module: `packages/flint-js/src/core/encoding-overrides.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { ChartEncoding, ChartTemplateDef } from './types';

/**
 * Compose a template's encoding-action overrides onto the base encodings.
 *
 * Category-B quick options (sort, color scheme, aggregate, orientation, …) are
 * stored by the host as *configuration overrides* keyed by the action's `key`
 * inside `chartProperties` — exactly like a chart property. They are NOT written
 * into the encoding map. This function is where the compiler composes them:
 * for each `encodingAction` whose override is present, it applies the action's
 * `set(encodings, value)` to produce the transformed encodings that feed the
 * rest of assembly.
 *
 * Backends call this once, at the very top of `assemble`, so every downstream
 * phase (semantic resolution → overflow → layout → instantiate) — and the
 * `InstantiateContext.encodings` handed to templates — sees the transformed
 * encodings. The base `encodings` argument is never mutated.
 *
 * An absent override (`undefined`) means "no override" and is skipped, so the
 * base encoding value (whatever the encoding shelf set, if anything) stands.
 * Because the override key matches the action key, charts saved before this
 * mechanism — which stored e.g. `chartProperties.colorScheme` directly — are
 * picked up automatically with no separate legacy fallback.
 */
export function applyEncodingOverrides(
    template: ChartTemplateDef,
    encodings: Record<string, ChartEncoding>,
    chartProperties?: Record<string, any>,
): Record<string, ChartEncoding> {
    const actions = template.encodingActions;
    if (!actions || actions.length === 0 || !chartProperties) return encodings;

    let result = encodings;
    for (const action of actions) {
        const override = chartProperties[action.key];
        if (override !== undefined) {
            result = action.set(result, override);
        }
    }
    return result;
}

```

### Core Architecture Module: `packages/flint-js/src/core/field-semantics.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * =============================================================================
 * FIELD SEMANTICS
 * =============================================================================
 *
 * Resolves what a data field *is* by combining its semantic annotation
 * (from LLM or user) with the actual data values. This resolves the
 * one-to-many ambiguities in the type registry (e.g., Score can be
 * quantitative or ordinal depending on cardinality).
 *
 * The entry point is `resolveFieldSemantics()`. It produces a
 * `FieldSemantics` object that captures the field's identity, format,
 * aggregation role, domain, scale hint, and ordering — everything
 * about *what the data represents*, independent of how it will be
 * visualized on any particular channel.
 *
 * Design doc: docs/design-compilation-context.md
 *
 * VL dependency: **None** — pure TypeScript, no rendering library imports.
 * =============================================================================
 */

import {
    type VisCategory,
    getRegistryEntry,
    isRegistered,
} from './type-registry';

import {
    getZeroClass,
    inferOrdinalSortOrder,
    inferVisCategory,
    type ZeroClass,
} from './semantic-types';

// Re-export for backward compatibility — consumers can import from here or type-registry
export { getRegistryEntry } from './type-registry';
export type { TypeRegistryEntry } from './type-registry';

// =============================================================================
// §1  PUBLIC TYPES
// =============================================================================

/**
 * Enriched semantic annotation from LLM or user.
 */
export interface SemanticAnnotation {
    /** The T2 semantic type string (e.g., "Amount", "Score", "Month") */
    semanticType: string;

    /**
     * Intrinsic domain (value range) of this field's scale.
     * Only for bounded/scaled types — NOT for open-ended measures.
     * E.g., [1, 5] for 5-star rating, [0, 100] for score, [-90, 90] for latitude.
     */
    intrinsicDomain?: [number, number];

    /** Unit or currency code. E.g., "USD", "°C", "kg" */
    unit?: string;

    /**
     * The value a diverging colour scale should pivot on — what the reader is
     * being asked to compare against.
     *
     * This is a judgement, not a fact about the field, which is why it has to
     * be declared rather than inferred. A temperature in °C pivots at 0 if the
     * question is whether it freezes, and at something nearer 18 if the
     * question is whether a city is comfortable to live in; the numbers are
     * identical either way and only the question tells them apart. Declare it
     * when the chart is about the comparison — above and below an average, a
     * target, a baseline period, a comfort line — and leave it out otherwise,
     * in which case the pivot falls back to whatever the type and the data
     * make obvious: a sign change at zero, a bounded domain's centre, or no
     * pivot at all.
     *
     * Declaring one also *asserts* the split: the scale diverges even if every
     * reading happens to land on one side of it.
     */
    divergingMidpoint?: number;

    /** Explicit ordinal ordering. E.g., ["Low", "Medium", "High"] */
    sortOrder?: string[];
}

/** d3-compatible format specification */
export interface FormatSpec {
    /** d3-format pattern: ",.2f", ".1%", "+.2f", etc. */
    pattern?: string;
    /** Prefix before the number: "$", "€", "£" */
    prefix?: string;
    /** Suffix after the number: "°C", "%", " kg" */
    suffix?: string;
    /** Whether large values should be abbreviated (1K, 1M, 1B) */
    abbreviate?: boolean;
}

/** Domain bounds constraint */
export interface DomainConstraint {
    min?: number;
    max?: number;
    /** Whether to hard-clamp values outside the domain */
    clamp?: boolean;
}

/** Tick mark constraint */
export interface TickConstraint {
    /** Only show integer tick values */
    integersOnly?: boolean;
    /** Exact tick values to show (for small domains like 1–5 rating) */
    exactTicks?: number[];
    /** Minimum step between ticks */
    minStep?: number;
}

/** Color scheme recommendation from semantic analysis */
export interface ColorSchemeHint {
    /** Whether the field is best shown with sequential, diverging, or categorical colors */
    type: 'sequential' | 'diverging' | 'categorical';
    /** For diverging: the midpoint value */
    divergingMidpoint?: number;
    /** Whether the field is inherently diverging (always show diverging) vs conditional */
    inherentlyDiverging?: boolean;
}

/** Result of diverging midpoint analysis */
export interface DivergingInfo {
    /** The midpoint value where the diverging center sits */
    midpoint: number;
    /** Whether this type is always diverging or only when data spans both sides */
    inherent: boolean;
    /** Source of the midpoint determination */
    source: 'annotation' | 'unit' | 'type-intrinsic' | 'domain' | 'data';
}

/**
 * Resolved field semantics — what the data field *is*.
 *
 * Derived from a `SemanticAnnotation` (semantic type + optional metadata)
 * plus actual data values. Resolves the one-to-many ambiguities in the
 * type registry by inspecting the concrete data representation.
 *
 * This is purely about the field’s identity and intrinsic properties —
 * NOT about how it will be visualized on a particular channel.
 * Channel-specific decisions (color scheme, axis reversal, interpolation,
 * tick strategy, stacking, etc.) belong in `ChannelSemantics`.
 *
 * Built once per field per dataset by `resolveFieldSemantics()`.
 */
export interface FieldSemantics {
    // --- Identity ---
    /** The semantic annotation (normalized from string or object input) */
    semanticAnnotation: SemanticAnnotation;

    // --- Encoding ---
    /** Preferred encoding type, disambiguated from registry using data */
    defaultVisType: VisCategory;

    // --- Formatting ---
    /** Number format derived from data type and unit (only set when confident) */
    format?: FormatSpec;
    /** Tooltip format (typically higher precision than axis format) */
    tooltipFormat?: FormatSpec;

    // --- Aggregation ---
    /** Default aggregate function — intrinsic to the field (additive vs intensive) */
    aggregationDefault?: 'sum' | 'average';

    // --- Scale ---
    /** Zero-baseline classification (meaningful / arbitrary / bipolar) */
    zeroClass: ZeroClass | 'unknown';
    /** Recommended scale type based on data distribution */
    scaleType?: 'linear' | 'log' | 'sqrt' | 'symlog';

    // --- Domain ---
    /** Intrinsic domain bounds (from annotation, type-intrinsic, or data-inferred) */
    domainConstraint?: DomainConstraint;

    // --- Ordering ---
    /** Canonical ordinal sort order (months, days, etc.) */
    canonicalOrder?: string[];
    /** Whether the canonical order is cyclic (wraps around) */
    cyclic: boolean;
    /** Default sort direction */
    sortDirection: 'ascending' | 'descending';

    // --- Histogram ---
    /** Whether this field’s data distribution benefits from binning */
    binningSuggested: boolean;
}

// =============================================================================
// §2  TYPE REGISTRY  →  see ./type-registry.ts (single source of truth)
// =============================================================================

/**
 * Extract the semantic type string from a bare string or annotation object.
 * Used when downstream code only needs the type string, not the full annotation.
 */
export function toTypeString(input: string | SemanticAnnotation | undefined): string {
    if (!input) return '';
    if (typeof input === 'string') return input;
    return input.semanticType || '';
}

// =============================================================================
// §3  ANNOTATION NORMALIZATION
// =============================================================================

/**
 * Normalize a bare string or enriched annotation object into a
 * consistent SemanticAnnotation.
 *
 * Accepts:
 *   "Amount"                                          → { semanticType: "Amount" }
 *   { semanticType: "Score", intrinsicDomain: [1,5] }  → as-is
 *   undefined / ""                                     → { semanticType: "Unknown" }
 */
export function normalizeAnnotation(
    input: string | SemanticAnnotation | undefined,
): SemanticAnnotation {
    if (!input) return { semanticType: 'Unknown' };
    if (typeof input === 'string') return { semanticType: input || 'Unknown' };
    return { ...input, semanticType: input.semanticType || 'Unknown' };
}

// =============================================================================
// §4  FORMAT RESOLUTION
// =============================================================================

/** Map currency codes to display symbols */
export const CURRENCY_MAP: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥',
    KRW: '₩', INR: '₹', BRL: 'R$', CAD: 'CA$', AUD: 'A$',
    CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr',
};

/**
 * Map common unit strings to suffix display.
 *
 * Limited to a small set of well-known, universally understood units.
 * Unknown/arbitrary annotation.unit values are intentionally excluded
 * to keep axis labels clean and avoid displaying obscure or verbose
 * unit strings on tick marks.
 */
const UNIT_SUFFIX_MAP: Record<string, string> = {
    // Temperature
    '°C': '°C', '°F': '°F', C: '°C', F: '°F',
    // Mass
    kg: ' kg', lb: ' lb',
    // Distance
    km: ' km', mi: ' mi', m: ' m', ft: ' ft',
    // Speed
    'km/h': ' km/h', mph: ' mph',
    // Time
    sec: ' s', min: ' min', hr: ' hr',
    seconds: ' s', minutes: ' min', hours: ' hr',
    // Percentage (handled by formatClass, but allow explicit suffix)
    '%': '%',
};

export interface DisplayUnit {
    /** Normalized display text, e.g. `USD` becomes `$` and `hours` becomes `hr`. */
   
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #134** (2026-09-29): **feat(echarts): chart_spec.echarts, a native option escape hatch**
  *Symptoms*: ## What  `chart_spec.echarts` — a native ECharts option patch that is merged onto the compiled option, plus column binding for series added through it.  This closes the gap where a chart needs something the semantic layer does not model. A second value axis, a bar and a line in one chart, `markLine` / `markArea`, `dataZoom`, axis or tooltip formatters, per-series `areaStyle`, custom `grid`s — today a caller who needs one of those has to leave Flint and hand-write the option, losing the layer they came for.  ```jsonc {   "chartType": "Line Chart",   "encodings": { "x": { "field": "month" }, "y": { "field": "revenue" } },   "echarts": {     "legend": { "show": true, "top": 6 },     "yAxis": [{ "name": "Revenue" }, { "name": "Margin", "position": "right" }],     "series": [       { "name": "Revenue", "lineStyle": { "width": 2 } },       { "type": "line", "field": "margin", "name": "Margin rate", "axis": "right" }     ]   } } ```  Applied last, so it is authoritative over what Flint decided above it: objects merge recursively, arrays of plain objects (`series`, `xAxis`, `yAxis`) merge element-wise by index with entries past the end appended, any other array replaces, and `_`-prefixed keys are dropped with an `info` warning. A series entry that binds a column is added (and `axis: "right"` puts it on a right-hand value axis that Flint creates if missing); one that does not patches the series at its own index. Backend-scoped: the other assemblers ignore the key, as Vega-Lite ignores
  **Post-Mortem & Fix Analysis**:
  > @microsoft-github-policy-service agree 

- **Issue #127** (2026-09-20): **feat(interactions): admission per chart type, one owner per trigger**
  *Symptoms*: Stacked on #124. Design doc: `docs/design-interactions.md` (en, zh-CN).  ## Summary  **Interaction admission:** Each chart type now declares the interaction capabilities it supports, and each preset declares the capabilities it requires. Admission matches the two. `validateChart()`, the MCP tools, and the docs read the same declaration. The MCP chart view, the site editor, and the gallery mount from `interaction_spec`.  **Interaction comfliction:** Two interactions that share a trigger now get one owner. `affordances` is a map from hit kind to cursor and hover, and it is the only dispatch gate. For each shared trigger, admission either narrows one entry with an `info` warning or drops the later entry.  ## Why  The old rules admitted every preset on every chart type, even the KPI card and the pie chart. The "element semantics" check was always true, and the registry's `requires` was never read.  A legend click could also reach both `click-highlight` and `legend-toggle`: the series hid and the other bars dimmed. Target checks lived in three places, and four dispatch paths read none of them.  ## What changed  - Core: eight capabilities, `ChartInteractionSupport`, `INTERACTION_PRESET_REQUIREMENTS`, `supportedInteractionPresets()`. - Templates: all 36 chart types declare `interactionSupport`. `navigation`, `reorder`, and `supportedRegionGestures` move into it. - Admission: one match rule with messages that name the chart type and the missing capability. One inter

- **Issue #124** (2026-09-20): **feat(interactions): interaction_spec for chart interactions**
  *Symptoms*: ## Summary  A chart spec can now request interactions. The new top-level field `interaction_spec` lists presets by name with their options. Each name maps to the factory that code already calls, so a spec entry and a factory call produce the same interaction. When a chart cannot support an entry, the mount drops it with a warning and the chart still renders.  ```json "interaction_spec": {   "interactions": [     { "type": "legend-toggle" },     { "type": "click-highlight", "options": { "dimOpacity": 0.2 } },     { "type": "navigate", "options": { "axes": "x", "pan": false, "reset": ["double-click", "escape"] } }   ] } ```  Design notes: `docs/design-interaction-spec.md`.  ## What changed  - `core/interaction-spec.ts`: the `InteractionSpec` type and `interaction_spec` on `ChartAssemblyInput`. - A preset registry and `resolveInteractionSpec()`. The resolver rejects unknown types, options outside `options`, missing required options, and duplicate ids. - `admitInteractions()`, extracted from `addVegaLiteInteractions()`. Code definitions throw as before. Spec entries drop with a `ChartWarning`. - `composeInteractiveOptions()` merges spec and code entries. Code wins on shared keys. A shared id is an error. - `reset`: every stateful preset accepts a list of `click-none`, `double-click`, `escape`. One dispatcher in the Vega runtime replaces the global dismiss policy. - Site: a **Spec test cases** tab that mounts every Test cases card from `interaction_spec`. 
  **Post-Mortem & Fix Analysis**:
  > Let's move update / dismiss out of the interaction API?
  > The `update` and `dismiss` are out of the API spec now.  `updates` left the spec in a8747bc. State arrives from the host through `applyUpdate`, `setUpdates`, `dispatch`, or `options.updates`. The spec describes behavior only.  `dismiss` left the spec and the code options in 1d5927c. Each interaction now owns a reset list (`click-none`, `double-click`, `escape`), so a gesture clears only the interactions that list it. The resolver rejects a spec that still carries either field.

- **Issue #122** (2026-09-10): **demo: add timebox bespoke interaction**
  *Symptoms*: Introduce a discrete timebox prototype in the bespoke interaction lab so stock series can be filtered by dragging a data-space box. Keep unmatched series muted instead of removing them so repeated selections preserve context.

- **Issue #120** (2026-09-09): **fix(tests): repair type errors in map test files**
  *Symptoms*: ## Summary - `tests/map-levels.test.ts`: replace `toBe(true === false)` with `toBe(false)` (TS2367) - `tests/map-navigation.test.ts`: use `phase: 'preview'` for the in-progress pan; `'move'` is not a member of `InteractionPhase` (TS2322)  The `typecheck:js` step on dev failed after #119 (run 34274379837). Vitest does not check types, so the 30 tests in these files passed at runtime.  ## Test plan - [x] `npm run typecheck -w packages/flint-js` passes locally - [x] `vitest run tests/map-navigation.test.ts tests/map-levels.test.ts` — 30 passed

- **Issue #119** (2026-09-08): **Map navigation: pan and zoom, semantic zoom levels, and a click-to-fly demo**
  *Symptoms*: ## Summary  Pan and zoom on Vega-Lite maps, a two-level semantic zoom that never rebuilds the chart, and a click that flies into a state. Six commits, in order:  - **Pan and zoom on maps.** Map and Choropleth declare geo navigation. The adapter drives the projection's fitted extent through a signal, so the base map refits while marks keep their pixel size. `set-viewport` reports the visible longitude and latitude ranges. - **County-level choropleth and a semantic zoom demo.** The Choropleth gains a `level` property and navigation events carry the visible domain. - **Cheap navigation frames.** A viewport-only update skips the scene scan, and frames that arrive mid-render merge. - **Level swap in place.** `level: 'auto'` draws a state layer and a county layer over one shared join table, each gated by a filter on a level signal. The geo controller flips the signal with hysteresis; the projection fits the coarsest level alone, so a swap never shifts the map. Events carry the level and the coarsest-level region under the plot centre. The newest stored `set-viewport` retires every other retained viewport op, so a host reset no longer blocks later gestures. - **Level-gated bubble maps with a custom base map.** The Map template reads `baseMapUrl`, `levelField`, and `levels`, and pins the colour domain across levels. The China demo from the dimpvis candidates is rebuilt on real navigation, with its province GeoJSON rewound for d3. - **Fly to a region, and a pre-projected US a

- **Issue #117** (2026-09-07): **You draw it: freehand bespoke interaction demo and runtime fixes**
  *Symptoms*: ## Summary  Adds Case 05 "You draw it" to the advanced prototypes page, plus the interaction-runtime changes it needed. The line chart shows a line to 2012; the user draws the rest with a lasso stroke under a pen cursor, and a **Finish drawing** button reveals the real line and displays the score.  Four commits, in order:  1. **feat(interactions): report data-space coordinates for point, drag, and polygon gestures.** `domainForPlotGeometry` now inverts point, drag, and polygon geometry (not only rectangle brushes) and falls back to the overlay scales when no axis navigates. `DomainGeometry` gains `points`. Bespoke demos no longer have to measure the plot and fit their own scales. 2. **fix(interactions): path segment, per-key style, overlay.** Three bugs surfaced by hiding a line by selector and drawing overlays on a temporal axis: a hidden line left its terminal vertex as a stub; per-key `opacity`/`stroke` styles on a line never reached the first vertex (Vega paints a whole line from it), so they silently did nothing; overlay rows with Date order fields sorted as strings. 3. **fix(interactions): let the dismiss policy govern Escape in the region gesture.** With `dismiss: false`, Escape no longer clears the region gesture's retained selection. Default charts keep their behaviour. 4. **demo: you draw it bespoke interaction.** The stage, model, data, and styles; a `draw` affordance cursor (inline pen, exported as `DRAW_CURSOR`). Drawing rule: one value per whole year, t

- **Issue #116** (2026-09-05): **add interactive data report demo to the interaction lab**
  *Symptoms*: Adds **Demo: interactive data report** (`#/playground/interactive-data-report`), which consists of following sections:  1. **Report.** Paragraphs beside the chart, with editable presets on the chart. 2. **Slides.** The same sentences one at a time, in a horizontal snapping scroller. 3. **Agent.** The selection goes with the question as context; answers come back as bound sentences. 4. **Story.** Sentences kept from the chat or written from a selection; editable, reorderable, readable as a paragraph or as slides.  **Structure.**  `interactive-data-report-model.ts` holds the logic with no React: sentence and preset types and builders, the row matching (a sentence and the chart state both reduce to data rows), the preset catalog, and the agent wire format.  `interactive-data-report-content.ts` holds what the sections say.  `interactive-data-report-ui.tsx` holds the binding engine `useReportChart` and the shared components.  `InteractiveDataReportLab.tsx` composes the sections. The model has unit tests.  **Library fix included.** Region and navigation gestures captured the pointer on `pointerdown`, so a plain click never reached a mark while select, lasso, brush, or pan was mounted. They now capture once a real drag begins. The demo mounts click highlight and select together and needs this.  **Verified.** `tsc` passes for `site` and `flint-js`; the `flint-js` suite (1486 tests) and the new model test pass; headless browser runs cover hover, pin, slides, the agent tu

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

### Incident Patch 1: `4e8328d2` (2026-09-18)
**Commit Message**: fix(interactions): an axis label click emphasises the category's marks

The render loop sent an axis target to the label painter only and skipped
the render keys the axis resolver attached to its element, so a click on a
discrete axis label through click-highlight or axis-highlight changed
nothing. The element now also falls through to the mark key loop: the
category's marks emphasise, the rest mute, and click-none clears it.

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -62,6 +62,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - A legend click with both `click-highlight` and `legend-toggle` mounted hid the
   series and dimmed every other bar, because both presets answered the click.
   `click-highlight` now yields the legend click at admission.
+- A click on a discrete axis label through `click-highlight` or
+  `axis-highlight` changed nothing on the chart. The renderer routed an axis
+  target to the label painter only and skipped the render keys of its marks.
+  The category's marks now emphasise and the rest mute, like a mark click.
 - Keyboard targeting now navigates and emits `focus-element` through the
   `keyboard-targeting` interaction ID without requiring a click preset. Enter
   and Space still invoke configured click presets when present.
```

**File**: `packages/flint-js/src/vegalite/interactions/runtime.ts` (modified, +2/-1)
```diff
@@ -1042,14 +1042,15 @@ export function mountVegaInteractions(
                     }
                     for (const target of op.targets) {
                         if ('select' in target) continue;
+                        // An axis element styles its label, and its marks below, through the
+                        // render keys the axis resolver attached to it.
                         if (target.visual.kind === 'axis') {
                             for (const element of target.elements) {
                                 axisStyles.push({
                                     value: element.value as AxisTargetValue,
                                     style: op.value,
                                 });
                             }
-                            continue;
                         }
                         for (const element of target.elements) {
                             for (const key of semanticElementRenderKeys(element)) {
```

---

### Incident Patch 2: `16bc6431` (2026-09-18)
**Commit Message**: fix(interactions): mount the admitted copy, matched by id

The mount filtered the authored list through an identity set of the
admitted definitions. A definition that admission replaced with a narrower
copy was neither in the set nor in the authored list, so it was never
mounted: click-highlight vanished from every chart where it yielded a
trigger. The mounted list is now the admitted one, in the author's order,
matched by id, with external definitions passed through.

**File**: `packages/flint-js/src/vegalite/interactive.ts` (modified, +18/-4)
```diff
@@ -15,6 +15,23 @@ import {
     withoutSemanticInteractionField,
 } from './interactions/compile';
 import { mountVegaInteractions } from './interactions/runtime';
+
+/**
+ * The runtime mounts what admission kept, in the author's order. Admission may replace a
+ * definition with a copy that affords less, so a canvas definition is matched by id, not
+ * by identity; external definitions pass through untouched.
+ */
+export function mountedInteractionList(
+    interactions: readonly InteractionDef[],
+    admitted: readonly InteractionDef[],
+): InteractionDef[] {
+    const byId = new Map(admitted.map((interaction) => [interaction.id, interaction]));
+    return interactions.flatMap((interaction) => {
+        if (!isCanvasInteraction(interaction)) return [interaction];
+        const kept = byId.get(interaction.id);
+        return kept ? [kept] : [];
+    });
+}
 import { INTERACTION_STORES } from './interactions/stores';
 import { compile } from 'vega-lite';
 import { Error as VegaError, parse, View } from 'vega';
@@ -138,10 +155,7 @@ export function createVegaInteractiveRenderer(
                 tooltip.call(handler, event, item, withoutSemanticInteractionField(value));
             });
             await view.runAsync();
-            // The runtime mounts what admission kept; external definitions pass through untouched.
-            const admittedCanvas = new Set<InteractionDef>(interactionPlan?.interactions ?? canvasInteractions);
-            const mountedInteractions = interactions.filter((interaction) =>
-                !isCanvasInteraction(interaction) || admittedCanvas.has(interaction));
+            const mountedInteractions = mountedInteractionList(interactions, interactionPlan?.interactions ?? canvasInteractions);
             const interactionController = interactionPlan
                 ? mountVegaInteractions(
                     view,
```

**File**: `packages/flint-js/tests/interaction-admission.test.ts` (modified, +15/-0)
```diff
@@ -195,6 +195,21 @@ describe('admitInteractions', () => {
     });
 });
 
+describe('mountedInteractionList', () => {
+    it('mounts the admitted copy in the author\'s place, drops what admission dropped, and passes externals through', async () => {
+        const { mountedInteractionList } = await import('../src/vegalite/interactive');
+        const { externalInteraction } = await import('../src/interactive/interactions');
+        const highlight = clickHighlight();
+        const narrowed = highlight.withoutAffordances!(['legend-item'])!;
+        const external = externalInteraction({ id: 'host', handle: () => null });
+        const authored = [highlight, external, brushX(), ...fromSpec([{ type: 'legend-toggle' }])];
+        const admitted = [narrowed, authored[3]];
+        const mounted = mountedInteractionList(authored, admitted);
+        expect(mounted.map((interaction) => interaction.id)).toEqual(['click-highlight', 'host', 'legend-toggle']);
+        expect(mounted[0]).toBe(narrowed);
+    });
+});
+
 describe('addVegaLiteInteractions with spec interactions', () => {
     const assembled = (): any => assembleVegaLite({
         data: { values: [{ category: 'A', value: 1 }, { category: 'B', value: 2 }] },
```

---

### Incident Patch 3: `4b09ad73` (2026-09-15)
**Commit Message**: code review fix

Review of Stages A to C with the maintainer:
- the template block is interactionSupport, not interactions
- the drag-region capability is cartesian-region, and the four polar templates declare both
  regions, because a rectangle or lasso resolves their arcs and brush-x is honoured as a sector
- the assembler is the one authority on a chart's capabilities: it derives the confirmed list
  from declaredInteractionCapabilities and the bound encodings, writes _interactionSemantics
  for every Vega-Lite chart, and capabilities is a required field of the admission plan; the
  gates that replayed the old inferred rules are gone, a definition made by hand needs nothing
- preset requirements live in INTERACTION_PRESET_REQUIREMENTS only; the registry entries and
  the definition type no longer carry a copy, and admission no longer imports the registry
- one phrase table for the capabilities, one generator pass shared by the two lab tabs, no
  wrapper around the preview sizing, no dedupe of disjoint warning lists
- the coverage tab pins its header, marks unsupported cells with a cross, and slants the
  preset names
- docs: stages B and C, this review, the future steps set asid

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -13,6 +13,16 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Added
 
+- `interaction_spec`, a third document beside `chart_spec` and `theme_spec`: a
+  list of interaction presets by `type`, each with its `options`.
+  `buildInteractiveChart()`, the MCP chart view, and the site editor mount from
+  it. Guide: `docs/interaction-spec.md`.
+- Admission per chart type. Each Vega-Lite template declares its capabilities
+  in `ChartTemplateDef.interactionSupport`; each preset declares its needs in
+  `INTERACTION_PRESET_REQUIREMENTS`. A spec entry the chart cannot honour is
+  dropped with an `unsupported_interaction` warning; a code definition throws.
+  `validateChart()` and the MCP `validate_chart` report the same warnings;
+  `list_chart_types` and the Vega-Lite reference list the supported presets.
 - Chart validation is now part of the core package. `validateChart(input,
   backend)` returns `{ valid, warnings, errors, computedSize }` without
   throwing, alongside `validateChartInput`, `validateSemanticTypes`,
```

**File**: `docs/adding-a-chart-template.md` (modified, +2/-2)
```diff
@@ -44,7 +44,7 @@ export const dotPlotDef: ChartTemplateDef = {
     chart: 'Dot Plot',
     template: { mark: 'circle', encoding: {} },
     channels: ['x', 'y', 'color', 'size', 'column', 'row'],
-    interactions: {
+    interactionSupport: {
         elements: true,            // marks resolve to data rows
         region: ['cartesian'],     // rectangle and lasso drags resolve marks
         navigation: {},            // continuous x and y pan and zoom
@@ -75,7 +75,7 @@ export const dotPlotDef: ChartTemplateDef = {
 2. **`markCognitiveChannel`** — tells the compiler how readers decode value (affects zero baseline and [Auto Layout Algorithm](/documentation/layout-model) compression).
 3. **`instantiate`** — receives a **deep clone** of `template` plus `InstantiateContext` (resolved encodings, `ChannelSemantics`, `LayoutResult`, data table, canvas size).
 4. **No semantic branching** — read `ctx.channelSemantics[channel].format`, `.type`, `.zero`, etc.; do not switch on raw field names or storage types.
-5. **`interactions`** — what the chart type offers to interaction presets (`ChartInteractionSupport` in `core/interaction-spec.ts`). Declare only what the chart can honour: `elements`, `region`, `navigation`, `reorder`, `legend`, `discreteAxis`, `index`. An absent key means "never"; the assembler confirms the data-dependent ones against the bound encodings. Admission drops or rejects a preset whose `requires` list names a capability the chart lacks, and `list_chart_types` reports the supported presets from the same block.
+5. **`interactionSupport`** — what the chart type offers to interaction presets (`ChartInteractionSupport` in `core/interaction-spec.ts`). Declare only what the chart can honour: `elements`, `region`, `navigation`, `reorder`, `legend`, `discreteAxis`, `index`. An absent key means "never"; the assembler confirms the data-dependent ones against the bound encodings. Admission drops or rejects a preset whose `requires` list names a capability the chart lacks, and `list_chart_types` reports the supported presets from the same block.
 
 Optional hooks: `postProcess` (after layout), `encodingActions` (shelf quick actions).
 
```

**File**: `docs/api-reference.md` (modified, +1/-1)
```diff
@@ -173,7 +173,7 @@ interface InteractionSpec {
 
 `buildInteractiveChart()` reads it; the assemblers ignore it. An entry the chart type
 cannot honour is dropped with an `unsupported_interaction` warning, and `validateChart`
-reports the same warnings before anything renders. `supportedInteractionPresets(def.interactions)`
+reports the same warnings before anything renders. `supportedInteractionPresets(def.interactionSupport)`
 lists the presets a template supports by declaration. See [Using interactions](/documentation/interaction-spec).
 
 ### `chart_spec`
```

**File**: `docs/design-interaction-spec.md` (modified, +60/-9)
```diff
@@ -555,18 +555,19 @@ The registry's `requires` was written but never read.
 Three parts, each in one place:
 
 1. **A vocabulary of chart capabilities** (`InteractionCapability`, core): a fact some preset
-   reads at runtime. `elements` (marks resolve to data), `region` (any drag region the plot
-   resolves marks in), `angular-region` (the polar kind), `navigation`, `reorder`, `legend`,
-   `discrete-axis`, `index` (one x position reads every series). `brush-x` on a polar chart is
-   honoured as an angular brush, which is why the brushes need a region of either kind and only
-   `brush-angle` needs the angular one.
-2. **Per preset, `requires`** in the registry, now a list: the smallest set without which the
+   reads at runtime. `elements` (marks resolve to data), `cartesian-region` (a rectangle,
+   interval, or lasso drag the plot resolves marks in), `angular-region` (a sector drag),
+   `navigation`, `reorder`, `legend`, `discrete-axis`, `index` (one x position reads every
+   series). A polar chart declares both regions: a rectangle or lasso resolves its arcs by
+   pixel bounds, and `brush-x` on it is honoured as an angular brush. Only `brush-angle` needs
+   the angular one.
+2. **Per preset, `INTERACTION_PRESET_REQUIREMENTS`** in core, one list per preset: the smallest set without which the
    preset does nothing. Brushes need `elements` and a region; `brush-zoom` and `navigate` need
    `navigation`; `legend-toggle` needs `legend`; `axis-highlight` needs `discrete-axis`;
    `drag-reorder` needs `reorder`; `inspect-index` needs `index`; the click, hover, and inspect
    presets need `elements`. Each wrapper stamps `preset` on its definition so a code-made
-   definition is checked the same way; a custom definition may state `requires` itself.
-3. **Per template, `interactions`** on `ChartTemplateDef`: one block that absorbed the former
+   definition is checked the same way; a definition made by hand needs nothing.
+3. **Per template, `interactionSupport`** on `ChartTemplateDef`: one block that absorbed the former
    `navigation` and `reorder` fields and the `supportedRegionGestures` entry of
    `semanticInteractions`. An absent key means never. The assembler confirms the
    data-dependent capabilities against the bound encodings and writes the active list into
@@ -599,7 +600,7 @@ mark geometry), **P** = the probe over the shipped test cases, **J** = judgment,
 | Line Chart | ✓ | cartesian | x, y | ✓ | ✓ | | ✓ | T, P, J |
 | Area Chart, Streamgraph, Range Area Chart | ✓ | cartesian | x, y | | ✓ | | ✓ | T, J |
 | Bump Chart, Slope Chart | ✓ | cartesian | x, y | ✓ | ✓ | ✓ | ✓ | T, P, J |
-| Pie Chart, Donut Chart, Rose Chart, Radar Chart | ✓ | angular | | | ✓ | | | T |
+| Pie Chart, Donut Chart, Rose Chart, Radar Chart | ✓ | cartesian, angular | | | ✓ | | | T |
 | KPI Card | ✓ | | | | | | | T, J |
 | Map, Choropleth | ✓ | cartesian | geo | | ✓ | | | T, J |
 
@@ -643,3 +644,53 @@ where the chart type supports it but this case's data lacks a property, and a sm
 the chart type never offers what the preset needs. `list_chart_types` and the generated chart
 reference report the same list, so the list an agent reads and the list the mount enforces come
 from one block.
+
+## 12. Stages B and C (landed 2026-09-12), and what waits
+
+**Stage B, validation and discovery.** `validateChart()` checks `interaction_spec` the way
+the mount does (`validateInteractionSpec`): a malformed spec is an `invalid_interaction_spec`
+error, a dropped entry is the same `unsupported_interaction` warning the surface reports, and
+a static backend reports the spec as ignored. The MCP tool schema carries `interaction_spec`
+with the preset names as an enum; `validate_chart` reports the drops; `list_chart_types`
+returns `interactions` per chart type from the template declaration. Docs: `interaction-spec.md`
+(en, zh-CN), the API reference, the chart-author skill, and an **Interactions** line per chart
+type in the generated Vega-Lite reference.
+
+**Stage C, hosts.** The MCP chart view mounts `buildInteractiveChart()` with the CSP-safe
+expression interpreter when the input lists interactions, on the same preview input the
+static render sizes; the static render keeps running for the PNG export. The site gained one
+spec-aware component, `InteractiveVegaLiteView`, used by the editor and by `TripleChart`
+whenever the input carries interaction entries; a `TestCase` may carry an `interactionSpec`.
+The index chart stage and the chart-to-external lab, the two demos that used presets only,
+now ask for them in `interaction_spec`. Demos with custom definitions stay in code.
+
+**Review of Stage A (2026-09-14 to 15).** The template block is `interactionSupport`; the
+drag-region capability is `cartesian-region`, and the polar templates declare both regions;
+the assembler is the one authority on a chart's capabilities, and the gates that replayed the
+old inferred rules are gone; `capabilities` is a required field of the admiss
```

**File**: `docs/interaction-spec.md` (modified, +4/-4)
```diff
@@ -45,11 +45,11 @@ An entry has no string shorthand: `"click-highlight"` alone is rejected, `{ "typ
 | `double-activate` | Double-clicks a mark to activate it. | elements | click-none, escape |
 | `inspect` | Moves over the plot to read the nearest mark's values. | elements | none |
 | `inspect-index` | Moves over the plot to read every series at one x position (`seriesBy` for a single series). | index axis | escape |
-| `select` | Drags a rectangle to emphasise the marks inside. | elements, region | click-none, escape |
-| `lasso-select` | Draws a freehand region to emphasise the marks inside. | elements, region | click-none, escape |
-| `brush-x`, `brush-y` | Drags an interval along one axis; on a polar chart the x brush is an angular sector. | elements, region | click-none, escape |
+| `select` | Drags a rectangle to emphasise the marks inside. | elements, cartesian region | click-none, escape |
+| `lasso-select` | Draws a freehand region to emphasise the marks inside. | elements, cartesian region | click-none, escape |
+| `brush-x`, `brush-y` | Drags an interval along one axis; on a polar chart the x brush is an angular sector. | elements, cartesian region | click-none, escape |
 | `brush-angle` | Drags an angular sector on a pie, donut, rose, or radar chart. | elements, angular region | click-none, escape |
-| `linked-brush` | Brushes marks to highlight the same groups elsewhere (`groupBy` required). | elements, region | click-none, escape |
+| `linked-brush` | Brushes marks to highlight the same groups elsewhere (`groupBy` required). | elements, cartesian region | click-none, escape |
 | `brush-zoom` | Drags a rectangle to zoom into it. | navigation | double-click, escape |
 | `navigate` | Drags to pan and scrolls or pinches to zoom continuous axes (`axes`, `pan`, `domainGuard`). | navigation | double-click |
 | `legend-toggle` | Clicks a legend item to hide or restore its series. | discrete legend | none |
```

**File**: `docs/zh-CN/api-reference.md` (modified, +1/-1)
```diff
@@ -145,7 +145,7 @@ interface InteractionSpec {
 }
 ```
 
-`buildInteractiveChart()` 读取它，装配器忽略它。图表类型无法支持的条目会以 `unsupported_interaction` 警告被丢弃；`validateChart` 在渲染前报告同样的警告。`supportedInteractionPresets(def.interactions)` 列出模板按声明支持的预设。参见[使用交互](/documentation/interaction-spec)。
+`buildInteractiveChart()` 读取它，装配器忽略它。图表类型无法支持的条目会以 `unsupported_interaction` 警告被丢弃；`validateChart` 在渲染前报告同样的警告。`supportedInteractionPresets(def.interactionSupport)` 列出模板按声明支持的预设。参见[使用交互](/documentation/interaction-spec)。
 
 ### `chart_spec`
 
```

**File**: `docs/zh-CN/interaction-spec.md` (modified, +4/-4)
```diff
@@ -45,11 +45,11 @@
 | `double-activate` | 双击标记以激活。 | 元素 | click-none, escape |
 | `inspect` | 在绘图区移动，读取最近标记的值。 | 元素 | 无 |
 | `inspect-index` | 在绘图区移动，读取同一 x 位置上所有系列的值（`seriesBy` 指定单个系列）。 | 索引轴 | escape |
-| `select` | 拖出矩形以强调其中的标记。 | 元素、区域 | click-none, escape |
-| `lasso-select` | 自由绘制区域以强调其中的标记。 | 元素、区域 | click-none, escape |
-| `brush-x`、`brush-y` | 沿一条轴拖出区间；在极坐标图上，x 刷选是一个角度扇区。 | 元素、区域 | click-none, escape |
+| `select` | 拖出矩形以强调其中的标记。 | 元素、直角坐标区域 | click-none, escape |
+| `lasso-select` | 自由绘制区域以强调其中的标记。 | 元素、直角坐标区域 | click-none, escape |
+| `brush-x`、`brush-y` | 沿一条轴拖出区间；在极坐标图上，x 刷选是一个角度扇区。 | 元素、直角坐标区域 | click-none, escape |
 | `brush-angle` | 在饼图、环图、玫瑰图或雷达图上拖出角度扇区。 | 元素、角度区域 | click-none, escape |
-| `linked-brush` | 刷选标记，在其他视图中高亮相同的组（必须提供 `groupBy`）。 | 元素、区域 | click-none, escape |
+| `linked-brush` | 刷选标记，在其他视图中高亮相同的组（必须提供 `groupBy`）。 | 元素、直角坐标区域 | click-none, escape |
 | `brush-zoom` | 拖出矩形并放大到该范围。 | 导航 | double-click, escape |
 | `navigate` | 拖动平移、滚轮或双指缩放连续坐标轴（`axes`、`pan`、`domainGuard`）。 | 导航 | double-click |
 | `legend-toggle` | 点击图例项以隐藏或恢复其系列。 | 离散图例 | 无 |
```

**File**: `packages/flint-js/src/core/index.ts` (modified, +1/-0)
```diff
@@ -202,6 +202,7 @@ export { isRegistered, getRegisteredTypes } from './type-registry';
 export {
     INTERACTION_PRESET_TYPES,
     INTERACTION_CAPABILITIES,
+    INTERACTION_CAPABILITY_DESCRIPTIONS,
     INTERACTION_PRESET_REQUIREMENTS,
     declaredInteractionCapabilities,
     supportedInteractionPresets,
```

---

### Incident Patch 4: `7025d531` (2026-09-13)
**Commit Message**: docs(interactions): a guide to interaction_spec, and the presets each chart type supports

A new Using interactions page (docs/interaction-spec.md, with a zh-CN mirror, registered in
the site catalog) explains the spec shape, the twenty presets with what each needs and its
default reset, the reset gestures, how a chart type declares support, the warnings and where
to read them, and the equivalence of a spec entry and a factory call. The API reference gains
interaction_spec on ChartAssemblyInput with a section of its own. The chart-author skill gains
an Interactions section with the authoring rules. The generated Vega-Lite reference prints an
Interactions line per chart type from the same declaration the mount enforces.

**File**: `agent-skills/flint-chart-author/SKILL.md` (modified, +48/-0)
```diff
@@ -16,6 +16,9 @@ or `assembleChartjs` to get a backend spec.
 
 - **DO** emit `chart_spec` (chart type, channel→field mapping, properties)
   and `semantic_types` (field → semantic type).
+- **DO** add `interaction_spec` when the user asks for behaviour (highlight,
+  legend toggle, pan and zoom, brush). List presets by name; see
+  "Interactions".
 - **Reference columns by name.** How `data` itself gets bound depends on
   the situation — a URL, a host-side variable, or embedded rows (see "How
   data gets bound"). Embedding is fine for small tables; just don't
@@ -242,6 +245,51 @@ chart input. ThemeSpec currently affects Vega-Lite only.
 Full reference:
 https://microsoft.github.io/flint-chart/#/documentation/theme-spec
 
+## Interactions (`interaction_spec`)
+
+Add `interaction_spec` beside `chart_spec` only when the user asks for
+behaviour: highlight on click, a legend that hides series, pan and zoom, a
+brush, an annotation on click. A static image never needs it.
+
+```json
+{
+  "chart_spec": { "chartType": "Bar Chart", "encodings": { "x": "country", "y": "gdp", "color": "region" } },
+  "interaction_spec": {
+    "interactions": [
+      { "type": "click-highlight" },
+      { "type": "legend-toggle" },
+      { "type": "navigate", "options": { "axes": "y", "pan": false, "reset": ["double-click", "escape"] } }
+    ]
+  }
+}
+```
+
+Rules:
+
+- **Presets only.** Every entry is `{ "type": <preset>, "options": { ... } }`.
+  Take the preset names for the chosen chart type from `list_chart_types`
+  (`chartTypes[].interactions`); a KPI card supports no brush, a pie chart no
+  `navigate`. Never invent a type.
+- **Options nest under `options`.** An option beside `type` is rejected.
+  `id` is optional and sits on the entry, never inside `options`.
+- **`reset`** is a list of `"click-none"`, `"double-click"`, `"escape"` on any
+  preset that keeps state. Leave it out to accept the preset's default.
+- **The data decides too.** `legend-toggle` needs a colour field with a
+  discrete legend; `navigate` needs a continuous axis; `drag-reorder` needs a
+  discrete axis. An entry the chart cannot honour is dropped with a warning
+  and the chart still renders. Run `validate_chart` to read those warnings
+  before you show the chart.
+- **Vega-Lite only.** Other backends ignore the spec.
+
+Common presets: `click-highlight` (focus a mark), `click-group-focus`
+(focus its group, `groupBy`), `legend-toggle`, `navigate` (`axes`, `pan`),
+`brush-x` / `brush-y` / `select` (drag to focus an interval or area),
+`click-annotate`, `inspect` and `inspect-index` (read values on hover),
+`drag-reorder` (reorder categories).
+
+Full guide:
+https://microsoft.github.io/flint-chart/#/documentation/interaction-spec
+
 ## Step 1 — pick `chartType`
 
 Use one of the registered names **exactly**. Vega-Lite is the default and
```

**File**: `docs/api-reference.md` (modified, +20/-0)
```diff
@@ -123,6 +123,8 @@ interface ChartAssemblyInput {
     canvasSize?: { width: number; height: number };    // optional hard ceiling on stretch
     chartProperties?: Record<string, unknown>;
   };
+  theme_spec?: ThemeSpec | string;                     // presentation, Vega-Lite only
+  interaction_spec?: InteractionSpec;                  // behaviour, Vega-Lite interactive surface only
   options?: AssembleOptions;
   field_display_names?: Record<string, string>;
 }
@@ -156,6 +158,24 @@ legend headers. Keep encodings bound to the original field names:
 }
 ```
 
+### `interaction_spec`
+
+How the chart behaves. Lists interaction presets by `type`, each with its own
+`options`, plus the surface policies `assistedTargeting` and `keyboardTargeting`:
+
+```ts
+interface InteractionSpec {
+  interactions: { type: InteractionPresetType; id?: string; options?: Record<string, any> }[];
+  assistedTargeting?: boolean | AssistedTargetingOptions;
+  keyboardTargeting?: boolean;
+}
+```
+
+`buildInteractiveChart()` reads it; the assemblers ignore it. An entry the chart type
+cannot honour is dropped with an `unsupported_interaction` warning, and `validateChart`
+reports the same warnings before anything renders. `supportedInteractionPresets(def.interactions)`
+lists the presets a template supports by declaration. See [Using interactions](/documentation/interaction-spec).
+
 ### `chart_spec`
 
 | Field | Description |
```

**File**: `docs/interaction-spec.md` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+# Using interactions
+
+`interaction_spec` sits beside `chart_spec` and `theme_spec` in a `ChartAssemblyInput`. The chart spec says **what the chart means**. The theme spec says **how it looks**. The interaction spec says **how it behaves** when a reader clicks, hovers, drags, or presses a key.
+
+Every behaviour comes from a **preset**: a named interaction Flint ships, such as `click-highlight` or `navigate`. You list the presets you want, each with its own options. Flint mounts the ones the chart can honour and tells you about the ones it cannot.
+
+> `interaction_spec` affects the Vega-Lite interactive surface only. The assemblers and the static backends leave it untouched, and `validateChart` reports it as ignored for those backends.
+
+## Shape
+
+```json
+{
+  "chart_spec": { "chartType": "Bar Chart", "encodings": { "x": "country", "y": "gdp", "color": "region" } },
+  "interaction_spec": {
+    "interactions": [
+      { "type": "click-highlight" },
+      { "type": "legend-toggle" },
+      { "type": "navigate", "options": { "axes": "y", "pan": false, "reset": ["double-click", "escape"] } }
+    ]
+  }
+}
+```
+
+| Key | Meaning |
+|---|---|
+| `interactions` | One entry per interaction, in the order they are mounted. |
+| `interactions[].type` | The preset that makes the interaction. It is also the interaction's default `id`. |
+| `interactions[].id` | Optional. Names the interaction when a chart uses the same preset twice, and names it in the `flint-interaction` event. |
+| `interactions[].options` | The preset's own options, always nested under `options`. Never put an option beside `type`. |
+| `assistedTargeting` | Optional. Pointer acquisition that snaps to a nearby mark. `false` requires direct hits; an object sets `maxDistance`, `indicator`, `details`. |
+| `keyboardTargeting` | Optional. Lets a reader move between marks with the keyboard. |
+
+An entry has no string shorthand: `"click-highlight"` alone is rejected, `{ "type": "click-highlight" }` is the smallest form.
+
+## The presets
+
+| Type | What the reader does | Needs from the chart | Default reset |
+|---|---|---|---|
+| `click-highlight` | Clicks a mark, legend item, or axis label to emphasise it and mute the rest. | elements | click-none, escape |
+| `click-group-focus` | Clicks a mark to emphasise every mark in its group (`groupBy`). | elements | click-none, escape |
+| `hover-group-focus` | Hovers a mark to preview its group (`groupBy` required). | elements | none |
+| `click-annotate` | Clicks a mark to pin an annotation with its value. | elements | click-none, escape |
+| `context-activate` | Right-clicks or long-presses to hand the host a context target. | elements | none |
+| `long-press` | Holds a mark to activate it. | elements | click-none, escape |
+| `double-activate` | Double-clicks a mark to activate it. | elements | click-none, escape |
+| `inspect` | Moves over the plot to read the nearest mark's values. | elements | none |
+| `inspect-index` | Moves over the plot to read every series at one x position (`seriesBy` for a single series). | index axis | escape |
+| `select` | Drags a rectangle to emphasise the marks inside. | elements, region | click-none, escape |
+| `lasso-select` | Draws a freehand region to emphasise the marks inside. | elements, region | click-none, escape |
+| `brush-x`, `brush-y` | Drags an interval along one axis; on a polar chart the x brush is an angular sector. | elements, region | click-none, escape |
+| `brush-angle` | Drags an angular sector on a pie, donut, rose, or radar chart. | elements, angular region | click-none, escape |
+| `linked-brush` | Brushes marks to highlight the same groups elsewhere (`groupBy` required). | elements, region | click-none, escape |
+| `brush-zoom` | Drags a rectangle to zoom into it. | navigation | double-click, escape |
+| `navigate` | Drags to pan and scrolls or pinches to zoom continuous axes (`axes`, `pan`, `domainGuard`). | navigation | double-click |
+| `legend-toggle` | Clicks a legend item to hide or restore its series. | discrete legend | none |
+| `axis-highlight` | Clicks a discrete axis label to emphasise its category. | discrete axis | click-none, escape |
+| `drag-reorder` | Drags a discrete axis label to change the category order. | reorderable axis | none |
+
+The option names are the ones the matching factory in `flint-chart/interactive` accepts. `InteractionPresetSpec` in that entry gives the precise shape per type for TypeScript callers.
+
+## Reset gestures
+
+Every preset that keeps state accepts `reset`, a list of the gestures that return it to neutral:
+
+| Gesture | Meaning |
+|---|---|
+| `click-none` | A click whose hit resolves to no chart element: empty plot, margin, background. |
+| `double-click` | A double-click anywhere on the chart. |
+| `escape` | The Escape key, while the chart has focus. A chart with an `escape` reset takes focus when the reader presses on it, so Escape reaches the last chart touched an
```

**File**: `docs/reference-vegalite.md` (modified, +73/-0)
```diff
@@ -10,6 +10,7 @@ This reference lists the 36 chart types currently supported by the Vega-Lite bac
 
 - **Encoding channels** — the visual roles accepted in `chart_spec.encodings`, such as `x`, `y`, `color`, `size`, `column`, or `row`.
 - **Options** — template-specific `chart_spec.chartProperties` keys, including control type, domain, default, availability, and description.
+- **Interactions** — the presets the chart type supports in `interaction_spec`. The data can still remove one at mount: a legend needs a bound discrete legend channel, navigation needs a continuous axis. See the [interaction guide](/documentation/interaction-spec).
 
 Use the chart type name exactly as shown in `chart_spec.chartType`.
 
@@ -33,6 +34,8 @@ The **Availability** column shows whether a parameter is `always` available or `
 
 **Encoding channels:** `x`, `y`, `color`, `size`, `shape`, `detail`, `opacity`, `column`, `row`
 
+**Interactions:** `click-highlight`, `click-group-focus`, `hover-group-focus`, `click-annotate`, `select`, `lasso-select`, `brush-x`, `brush-y`, `brush-zoom`, `linked-brush`, `legend-toggle`, `context-activate`, `long-press`, `double-activate`, `inspect`, `inspect-index`, `navigate`
+
 | Parameter | Control | Domain | Default | Availability | Description |
 |---|---|---|---|---|---|
 | `opacity` | number | 0.1 – 1 (step 0.1) | `1` | always | Mark opacity. |
@@ -46,6 +49,8 @@ The **Availability** column shows whether a parameter is `always` available or `
 
 **Encoding channels:** `x`, `y`, `size`, `color`, `column`, `row`
 
+**Interactions:** `click-highlight`, `click-group-focus`, `hover-group-focus`, `click-annotate`, `select`, `lasso-select`, `brush-x`, `brush-y`, `brush-zoom`, `linked-brush`, `legend-toggle`, `context-activate`, `long-press`, `double-activate`, `inspect`, `inspect-index`, `navigate`
+
 | Parameter | Control | Domain | Default | Availability | Description |
 |---|---|---|---|---|---|
 | `regressionMethod` | choice | `linear` (Linear), `log` (Logarithmic), `exp` (Exponential), `pow` (Power), `quad` (Quadratic), `poly` (Polynomial) | `linear` | always | Regression fit method. |
@@ -60,6 +65,8 @@ The **Availability** column shows whether a parameter is `always` available or `
 
 **Encoding channels:** `x`, `y`, `order`, `color`, `detail`, `column`, `row`
 
+**Interactions:** `click-highlight`, `click-group-focus`, `hover-group-focus`, `click-annotate`, `select`, `lasso-select`, `brush-x`, `brush-y`, `brush-zoom`, `linked-brush`, `legend-toggle`, `context-activate`, `long-press`, `double-activate`, `inspect`, `navigate`
+
 | Parameter | Control | Domain | Default | Availability | Description |
 |---|---|---|---|---|---|
 | `independentYAxis` | toggle | on / off | `false` | conditional | Use independent y-scales for facets. |
@@ -72,6 +79,8 @@ The **Availability** column shows whether a parameter is `always` available or `
 
 **Encoding channels:** `x`, `y`, `color`
 
+**Interactions:** `click-highlight`, `axis-highlight`, `click-group-focus`, `hover-group-focus`, `click-annotate`, `select`, `lasso-select`, `brush-x`, `brush-y`, `brush-zoom`, `linked-brush`, `legend-toggle`, `context-activate`, `long-press`, `double-activate`, `inspect`, `navigate`, `drag-reorder`
+
 | Parameter | Control | Domain | Default | Availability | Description |
 |---|---|---|---|---|---|
 | `logScale_x` | toggle | on / off | `false` | conditional | Use a log/symlog scale on the x-axis. |
@@ -83,6 +92,8 @@ The **Availability** column shows whether a parameter is `always` available or `
 
 **Encoding channels:** `x`, `y`, `color`, `size`, `column`, `row`
 
+**Interactions:** `click-highlight`, `axis-highlight`, `click-group-focus`, `hover-group-focus`, `click-annotate`, `select`, `lasso-select`, `brush-x`, `brush-y`, `brush-zoom`, `linked-brush`, `legend-toggle`, `context-activate`, `long-press`, `double-activate`, `inspect`, `navigate`, `drag-reorder`
+
 | Parameter | Control | Domain | Default | Availability | Description |
 |---|---|---|---|---|---|
 | `stepWidth` | number | 10 – 100 (step 5) | `20` | always | Jitter spread width. |
@@ -100,6 +111,8 @@ The **Availability** column shows whether a parameter is `always` available or `
 
 **Encoding channels:** `x`, `y`, `color`, `opacity`, `column`, `row`
 
+**Interactions:** `click-highlight`, `axis-highlight`, `click-group-focus`, `hover-group-focus`, `click-annotate`, `select`, `lasso-select`, `brush-x`, `brush-y`, `brush-zoom`, `linked-brush`, `legend-toggle`, `context-activate`, `long-press`, `double-activate`, `inspect`, `navigate`, `drag-reorder`
+
 | Parameter | Control | Domain | Default | Availability | Description |
 |---|---|---|---|---|---|
 | `cornerRadius` | number | 0 – 15 (step 1) | `0` | always | Corner radius for supported marks. |
@@ -112,6 +125,8 @@ The **Availability** column shows whether a parameter is `always` available or `
 
 **Encoding channels:** `x`, `y`, `group`, `color`, `column`, `row`
 
+**Interactions:** `click-highlight`, `axis-hig
```

**File**: `docs/zh-CN/api-reference.md` (modified, +16/-0)
```diff
@@ -116,6 +116,8 @@ interface ChartAssemblyInput {
     chartProperties?: Record<string, unknown>;
   };
   options?: AssembleOptions;
+  theme_spec?: ThemeSpec | string;                     // 呈现，仅 Vega-Lite
+  interaction_spec?: InteractionSpec;                  // 行为，仅 Vega-Lite 交互层
   field_display_names?: Record<string, string>;
 }
 ```
@@ -131,6 +133,20 @@ interface ChartAssemblyInput {
 
 将列名映射到语义类型。这驱动编码类型、格式化、聚合默认值、颜色类与布局。见[语义类型](/documentation/semantic-types)。
 
+### `interaction_spec`
+
+图表的行为。按 `type` 列出交互预设，每项带自己的 `options`，另有 `assistedTargeting` 与 `keyboardTargeting` 两个交互层策略：
+
+```ts
+interface InteractionSpec {
+  interactions: { type: InteractionPresetType; id?: string; options?: Record<string, any> }[];
+  assistedTargeting?: boolean | AssistedTargetingOptions;
+  keyboardTargeting?: boolean;
+}
+```
+
+`buildInteractiveChart()` 读取它，装配器忽略它。图表类型无法支持的条目会以 `unsupported_interaction` 警告被丢弃；`validateChart` 在渲染前报告同样的警告。`supportedInteractionPresets(def.interactions)` 列出模板按声明支持的预设。参见[使用交互](/documentation/interaction-spec)。
+
 ### `chart_spec`
 
 | 字段 | 说明 |
```

**File**: `docs/zh-CN/interaction-spec.md` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+# 使用交互
+
+`interaction_spec` 与 `chart_spec`、`theme_spec` 并列位于 `ChartAssemblyInput` 中。chart spec 说明图表**表达什么**，theme spec 说明图表**长什么样**，interaction spec 说明读者点击、悬停、拖动或按键时图表**如何响应**。
+
+每种行为都来自一个**预设（preset）**：Flint 内置的、有名字的交互，例如 `click-highlight` 或 `navigate`。你列出想要的预设和各自的选项，Flint 挂载图表能够支持的那些，并告诉你哪些无法支持。
+
+> `interaction_spec` 只影响 Vega-Lite 交互层。装配器和静态后端不会读取它；对这些后端，`validateChart` 会报告该字段被忽略。
+
+## 结构
+
+```json
+{
+  "chart_spec": { "chartType": "Bar Chart", "encodings": { "x": "country", "y": "gdp", "color": "region" } },
+  "interaction_spec": {
+    "interactions": [
+      { "type": "click-highlight" },
+      { "type": "legend-toggle" },
+      { "type": "navigate", "options": { "axes": "y", "pan": false, "reset": ["double-click", "escape"] } }
+    ]
+  }
+}
+```
+
+| 键 | 含义 |
+|---|---|
+| `interactions` | 每个交互一项，按挂载顺序排列。 |
+| `interactions[].type` | 生成该交互的预设，同时也是交互的默认 `id`。 |
+| `interactions[].id` | 可选。同一图表两次使用同一预设时用来区分，也是 `flint-interaction` 事件中的名字。 |
+| `interactions[].options` | 预设自己的选项，始终嵌套在 `options` 下，不要与 `type` 并列。 |
+| `assistedTargeting` | 可选。指针吸附到附近的标记；`false` 要求精确命中，对象可设置 `maxDistance`、`indicator`、`details`。 |
+| `keyboardTargeting` | 可选。允许读者用键盘在标记间移动。 |
+
+条目没有字符串简写：单独的 `"click-highlight"` 会被拒绝，`{ "type": "click-highlight" }` 是最小形式。
+
+## 预设一览
+
+| 类型 | 读者的操作 | 需要图表提供 | 默认重置 |
+|---|---|---|---|
+| `click-highlight` | 点击标记、图例项或坐标轴标签以强调它并淡化其余。 | 元素 | click-none, escape |
+| `click-group-focus` | 点击标记以强调同组的所有标记（`groupBy`）。 | 元素 | click-none, escape |
+| `hover-group-focus` | 悬停标记以预览其组（必须提供 `groupBy`）。 | 元素 | 无 |
+| `click-annotate` | 点击标记以固定一个带数值的注释。 | 元素 | click-none, escape |
+| `context-activate` | 右键或长按，把上下文目标交给宿主。 | 元素 | 无 |
+| `long-press` | 长按标记以激活。 | 元素 | click-none, escape |
+| `double-activate` | 双击标记以激活。 | 元素 | click-none, escape |
+| `inspect` | 在绘图区移动，读取最近标记的值。 | 元素 | 无 |
+| `inspect-index` | 在绘图区移动，读取同一 x 位置上所有系列的值（`seriesBy` 指定单个系列）。 | 索引轴 | escape |
+| `select` | 拖出矩形以强调其中的标记。 | 元素、区域 | click-none, escape |
+| `lasso-select` | 自由绘制区域以强调其中的标记。 | 元素、区域 | click-none, escape |
+| `brush-x`、`brush-y` | 沿一条轴拖出区间；在极坐标图上，x 刷选是一个角度扇区。 | 元素、区域 | click-none, escape |
+| `brush-angle` | 在饼图、环图、玫瑰图或雷达图上拖出角度扇区。 | 元素、角度区域 | click-none, escape |
+| `linked-brush` | 刷选标记，在其他视图中高亮相同的组（必须提供 `groupBy`）。 | 元素、区域 | click-none, escape |
+| `brush-zoom` | 拖出矩形并放大到该范围。 | 导航 | double-click, escape |
+| `navigate` | 拖动平移、滚轮或双指缩放连续坐标轴（`axes`、`pan`、`domainGuard`）。 | 导航 | double-click |
+| `legend-toggle` | 点击图例项以隐藏或恢复其系列。 | 离散图例 | 无 |
+| `axis-highlight` | 点击离散坐标轴标签以强调该类别。 | 离散坐标轴 | click-none, escape |
+| `drag-reorder` | 拖动离散坐标轴标签以改变类别顺序。 | 可重排坐标轴 | 无 |
+
+选项名与 `flint-chart/interactive` 中对应工厂函数接受的选项一致；TypeScript 调用方可用该入口的 `InteractionPresetSpec` 获得逐类型的精确形状。
+
+## 重置手势
+
+每个保留状态的预设都接受 `reset`，即让它回到中性状态的手势列表：
+
+| 手势 | 含义 |
+|---|---|
+| `click-none` | 一次没有命中任何图表元素的点击：空白绘图区、边距、背景。 |
+| `double-click` | 图表任意位置的双击。 |
+| `escape` | 图表获得焦点时按下 Escape。带 `escape` 重置的图表在读者按下时获取焦点，因此 Escape 只作用于最后触碰的图表。 |
+
+一个手势只重置列表中包含它的交互，各自按 id 处理。通过 surface 施加的宿主更新不会被手势重置。不保留状态的预设（`hover-group-focus`、`inspect`、`context-activate`）没有 `reset`，解析器会拒绝为其设置。
+
+## 图表类型支持什么
+
+每种图表类型声明它提供的属性：可解析为数据的标记、拖动区域、可导航的坐标轴、可重排的坐标轴、离散图例、离散坐标轴标签、索引轴。每个预设声明它需要的属性。图表类型提供了预设所需的全部属性时，该预设即受支持。
+
+三个地方可以查看结果：
+
+- [Vega-Lite 图表参考](/documentation/reference-vegalite) 为每种图表类型打印一行 **交互**。
+- MCP 工具 `list_chart_types` 为每种图表类型返回 `interactions`。
+- 交互实验室的 **Coverage** 页签展示每种图表类型对每个预设的支持情况。
+
+数据仍可能在挂载时移除某个预设。柱状图支持 `legend-toggle`，但没有颜色字段的柱状图没有可切换的图例；`navigate` 需要连续且未分面的坐标轴；`drag-reorder` 需要绑定编码中有离散坐标轴。
+
+## 警告
+
+图表无法支持的条目会**带警告被丢弃**，图表仍然渲染。消息中会写明交互名、所需属性和图表类型：
+
+```
+Interaction "legend-toggle" requires a discrete legend; Bar Chart has none. The interaction was dropped.
+```
+
+两个条目也可能冲突：第二个 `navigate`、平移手势旁的拖动手势、或与 `double-click` 重置并存的 `double-activate`。后面的条目让步。
+
+在哪里读取警告：
+
+- `validateChart(input, 'vegalite')` 在渲染前返回它们，格式错误的 spec 以 `invalid_interaction_spec` 错误报告。
+- `buildInteractiveChart(container, input)` 通过 `surface.warnings` 暴露它们，并在控制台记录一次。
+- MCP 工具 `validate_chart` 返回同一列表。
+
+格式错误的条目是错误而不是丢弃：未知的 `type`、放在 `options` 外的选项、放在 `options` 内的 `id`、缺少 `groupBy` 等必需选项、未知或不支持的 `reset` 手势、重复的 `id`。
+
+## 代码与 spec，同一定义
+
+spec 条目和工厂调用是同一交互的两种写法：
+
+```ts
+import { buildInteractiveChart, clickHighlight } from 'flint-chart/interactive';
+
+// 来自 spec
+buildInteractiveChart(container, { ...input, interaction_spec: { interactions: [{ type: 'click-highlight', options: { dimOpacity: 0.2 } }] } });
+
+// 来自代码
+buildInteractiveChart(container, input, { interactions: [clickHighlight({ dimOpacity: 0.2 })] });
+```
+
+两者可以同时出现在一张图表上；spec 条目先挂载。两边使用同一个 `id` 是错误。图表无法支持的代码定义会抛出异常，因为开发者能看到异常；spec 条目则被丢弃，因为智能体读取的是警告。
+
+## 在哪里生效
+
+`buildInteractiveChart()` 从输入中读取 `interaction_spec`。MCP 工具 `create_chart_view` 挂载同一交互层，因此智能体可以在请求图表的同一份 JSON 中请求行为。站点的编辑器和图库同样从 spec 挂载。
```

**File**: `packages/flint-mcp/assets/flint-chart-author.SKILL.md` (modified, +48/-0)
```diff
@@ -16,6 +16,9 @@ or `assembleChartjs` to get a backend spec.
 
 - **DO** emit `chart_spec` (chart type, channel→field mapping, properties)
   and `semantic_types` (field → semantic type).
+- **DO** add `interaction_spec` when the user asks for behaviour (highlight,
+  legend toggle, pan and zoom, brush). List presets by name; see
+  "Interactions".
 - **Reference columns by name.** How `data` itself gets bound depends on
   the situation — a URL, a host-side variable, or embedded rows (see "How
   data gets bound"). Embedding is fine for small tables; just don't
@@ -242,6 +245,51 @@ chart input. ThemeSpec currently affects Vega-Lite only.
 Full reference:
 https://microsoft.github.io/flint-chart/#/documentation/theme-spec
 
+## Interactions (`interaction_spec`)
+
+Add `interaction_spec` beside `chart_spec` only when the user asks for
+behaviour: highlight on click, a legend that hides series, pan and zoom, a
+brush, an annotation on click. A static image never needs it.
+
+```json
+{
+  "chart_spec": { "chartType": "Bar Chart", "encodings": { "x": "country", "y": "gdp", "color": "region" } },
+  "interaction_spec": {
+    "interactions": [
+      { "type": "click-highlight" },
+      { "type": "legend-toggle" },
+      { "type": "navigate", "options": { "axes": "y", "pan": false, "reset": ["double-click", "escape"] } }
+    ]
+  }
+}
+```
+
+Rules:
+
+- **Presets only.** Every entry is `{ "type": <preset>, "options": { ... } }`.
+  Take the preset names for the chosen chart type from `list_chart_types`
+  (`chartTypes[].interactions`); a KPI card supports no brush, a pie chart no
+  `navigate`. Never invent a type.
+- **Options nest under `options`.** An option beside `type` is rejected.
+  `id` is optional and sits on the entry, never inside `options`.
+- **`reset`** is a list of `"click-none"`, `"double-click"`, `"escape"` on any
+  preset that keeps state. Leave it out to accept the preset's default.
+- **The data decides too.** `legend-toggle` needs a colour field with a
+  discrete legend; `navigate` needs a continuous axis; `drag-reorder` needs a
+  discrete axis. An entry the chart cannot honour is dropped with a warning
+  and the chart still renders. Run `validate_chart` to read those warnings
+  before you show the chart.
+- **Vega-Lite only.** Other backends ignore the spec.
+
+Common presets: `click-highlight` (focus a mark), `click-group-focus`
+(focus its group, `groupBy`), `legend-toggle`, `navigate` (`axes`, `pan`),
+`brush-x` / `brush-y` / `select` (drag to focus an interval or area),
+`click-annotate`, `inspect` and `inspect-index` (read values on hover),
+`drag-reorder` (reorder categories).
+
+Full guide:
+https://microsoft.github.io/flint-chart/#/documentation/interaction-spec
+
 ## Step 1 — pick `chartType`
 
 Use one of the registered names **exactly**. Vega-Lite is the default and
```

**File**: `scripts/gen-chart-reference.ts` (modified, +15/-0)
```diff
@@ -18,6 +18,7 @@ import { fileURLToPath } from 'node:url';
 import { dirname, resolve } from 'node:path';
 
 import type { ChartTemplateDef, ChartPropertyDef } from '../packages/flint-js/src/core/types';
+import { supportedInteractionPresets } from '../packages/flint-js/src/core/interaction-spec';
 import type { ExcelTemplateDef } from '../packages/flint-js/src/excel/templates/types';
 import { vlTemplateDefs } from '../packages/flint-js/src/vegalite/templates/index';
 import { ecTemplateDefs } from '../packages/flint-js/src/echarts/templates/index';
@@ -309,6 +310,11 @@ function renderChart(def: ChartTemplateDef): string {
     const channels = (def.channels ?? []).map((c) => `\`${c}\``).join(', ') || '_none_';
     lines.push(`**Encoding channels:** ${channels}`);
     lines.push('');
+    if (def.interactions) {
+        const presets = supportedInteractionPresets(def.interactions).map((type) => `\`${type}\``).join(', ') || '_none_';
+        lines.push(`**Interactions:** ${presets}`);
+        lines.push('');
+    }
 
     const props = def.properties ?? [];
     if (props.length === 0) {
@@ -357,6 +363,11 @@ function renderBackend(spec: BackendSpec): string {
     out.push(
         '- **Options** — template-specific `chart_spec.chartProperties` keys, including control type, domain, default, availability, and description.',
     );
+    if (spec.name.toLowerCase().includes('vega')) {
+        out.push(
+            '- **Interactions** — the presets the chart type supports in `interaction_spec`. The data can still remove one at mount: a legend needs a bound discrete legend channel, navigation needs a continuous axis. See the [interaction guide](/documentation/interaction-spec).',
+        );
+    }
     out.push('');
     out.push('Use the chart type name exactly as shown in `chart_spec.chartType`.');
     out.push('');
@@ -399,6 +410,10 @@ function renderChartZh(def: ChartTemplateDef): string {
     lines.push(`### ${icon ? `![](${icon}) ` : ''}${def.chart}`, '');
     const channels = (def.channels ?? []).map((channel) => `\`${channel}\``).join(', ') || '_无_';
     lines.push(`**编码通道：** ${channels}`, '');
+    if (def.interactions) {
+        const presets = supportedInteractionPresets(def.interactions).map((type) => `\`${type}\``).join(', ') || '_无_';
+        lines.push(`**交互：** ${presets}`, '');
+    }
     const props = def.properties ?? [];
     if (props.length === 0) return [...lines, '_无模板专用参数。_', ''].join('\n');
     lines.push('| 参数 | 控件 | 取值范围 | 默认值 | 可用性 | 说明 |', '|---|---|---|---|---|---|');
```

---

### Incident Patch 5: `668ac1ec` (2026-09-13)
**Commit Message**: feat(interactions): one requirement table, and a coverage tab of chart types against presets

INTERACTION_PRESET_REQUIREMENTS in core is the single table of what each preset needs;
the registry entries read it. declaredInteractionCapabilities() and
supportedInteractionPresets() turn a template's interactions block into the presets it can
honour by declaration, so hosts and docs can list them without the runtime. The Interactions
lab gains a Coverage tab: all 36 Vega-Lite chart types against all 20 presets, with the
representative test case assembled per row to show which presets are active for that data,
which the chart type supports but the data does not confirm, and which it never offers.

**File**: `docs/design-interaction-spec.md` (modified, +10/-3)
```diff
@@ -633,6 +633,13 @@ on the scatter family above. Every other card kept its status.
 
 ### Discovery
 
-`supportedInteractions(template)` lists the presets whose `requires` sits inside the
-template's declaration. `list_chart_types` and the generated chart reference report it, so
-the list an agent reads and the list the mount enforces come from one block.
+`INTERACTION_PRESET_REQUIREMENTS` (core) is the one table of what each preset needs; the
+registry reads it. `declaredInteractionCapabilities(block)` and
+`supportedInteractionPresets(block)` (core) turn a template's declaration into the list of
+presets it can honour, before the data confirms the data-dependent ones. The Interactions lab
+gained a **Coverage** tab (`playground/interaction-coverage`): every chart type against every
+preset, with a filled dot where the representative test case activates the preset, a hollow dot
+where the chart type supports it but this case's data lacks a property, and a small dot where
+the chart type never offers what the preset needs. `list_chart_types` and the generated chart
+reference report the same list, so the list an agent reads and the list the mount enforces come
+from one block.
```

**File**: `packages/flint-js/src/core/index.ts` (modified, +3/-0)
```diff
@@ -202,6 +202,9 @@ export { isRegistered, getRegisteredTypes } from './type-registry';
 export {
     INTERACTION_PRESET_TYPES,
     INTERACTION_CAPABILITIES,
+    INTERACTION_PRESET_REQUIREMENTS,
+    declaredInteractionCapabilities,
+    supportedInteractionPresets,
     type InteractionPresetType,
     type InteractionCapability,
     type ChartInteractionSupport,
```

**File**: `packages/flint-js/src/core/interaction-spec.ts` (modified, +54/-0)
```diff
@@ -83,6 +83,60 @@ export interface ChartInteractionSupport {
     index?: boolean;
 }
 
+/** The capabilities each preset needs: the smallest set without which it does nothing. */
+export const INTERACTION_PRESET_REQUIREMENTS: Readonly<Record<InteractionPresetType, readonly InteractionCapability[]>> = {
+    'click-highlight': ['elements'],
+    'axis-highlight': ['discrete-axis'],
+    'click-group-focus': ['elements'],
+    'hover-group-focus': ['elements'],
+    'click-annotate': ['elements'],
+    'select': ['elements', 'region'],
+    'lasso-select': ['elements', 'region'],
+    'brush-x': ['elements', 'region'],
+    'brush-y': ['elements', 'region'],
+    'brush-angle': ['elements', 'angular-region'],
+    'brush-zoom': ['navigation'],
+    'linked-brush': ['elements', 'region'],
+    'legend-toggle': ['legend'],
+    'context-activate': ['elements'],
+    'long-press': ['elements'],
+    'double-activate': ['elements'],
+    'inspect': ['elements'],
+    'inspect-index': ['index'],
+    'navigate': ['navigation'],
+    'drag-reorder': ['reorder'],
+};
+
+/** The capabilities a chart type declares, before the assembler confirms the data-dependent ones. */
+export function declaredInteractionCapabilities(
+    support: ChartInteractionSupport | undefined,
+): InteractionCapability[] {
+    if (!support) return [];
+    const list: InteractionCapability[] = [];
+    if (support.elements) list.push('elements');
+    if (support.region?.length) list.push('region');
+    if (support.region?.includes('angular')) list.push('angular-region');
+    if (support.navigation) list.push('navigation');
+    if (support.reorder) list.push('reorder');
+    if (support.legend) list.push('legend');
+    if (support.discreteAxis) list.push('discrete-axis');
+    if (support.index) list.push('index');
+    return list;
+}
+
+/**
+ * The presets a chart type can honour by declaration. The data may still remove
+ * one at assemble time: a legend needs a bound discrete legend channel, and
+ * navigation needs a continuous unfaceted axis.
+ */
+export function supportedInteractionPresets(
+    support: ChartInteractionSupport | undefined,
+): InteractionPresetType[] {
+    const declared = new Set(declaredInteractionCapabilities(support));
+    return INTERACTION_PRESET_TYPES.filter((type) =>
+        INTERACTION_PRESET_REQUIREMENTS[type].every((capability) => declared.has(capability)));
+}
+
 /**
  * One preset as JSON: the type name, an optional id, and that preset's options
  * under `options`, for example
```

**File**: `packages/flint-js/src/interactive/spec/registry.ts` (modified, +21/-21)
```diff
@@ -1,4 +1,4 @@
-import { INTERACTION_PRESET_TYPES, type InteractionCapability, type InteractionPresetType } from '../../core/interaction-spec';
+import { INTERACTION_PRESET_REQUIREMENTS, INTERACTION_PRESET_TYPES, type InteractionCapability, type InteractionPresetType } from '../../core/interaction-spec';
 import {
     axisHighlight,
     brushAngle,
@@ -68,7 +68,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'click-highlight',
         label: 'Click highlight',
         description: 'Click a mark, legend item, or discrete axis label to emphasise it and mute the rest.',
-        requires: ['elements'],
+        requires: INTERACTION_PRESET_REQUIREMENTS['click-highlight'],
         gesture: 'click',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -78,7 +78,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'axis-highlight',
         label: 'Axis highlight',
         description: 'Hover or click a discrete axis label to emphasise its category.',
-        requires: ['discrete-axis'],
+        requires: INTERACTION_PRESET_REQUIREMENTS['axis-highlight'],
         gesture: 'click',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -88,7 +88,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'click-group-focus',
         label: 'Click group focus',
         description: 'Click a mark to emphasise every mark that shares its group.',
-        requires: ['elements'],
+        requires: INTERACTION_PRESET_REQUIREMENTS['click-group-focus'],
         gesture: 'click',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -98,7 +98,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'hover-group-focus',
         label: 'Hover group focus',
         description: 'Hover a mark to preview its group; leaving the mark restores the chart.',
-        requires: ['elements'],
+        requires: INTERACTION_PRESET_REQUIREMENTS['hover-group-focus'],
         gesture: 'hover',
         requiredOptions: ['groupBy'],
         supportedReset: NEVER,
@@ -109,7 +109,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'click-annotate',
         label: 'Click annotate',
         description: 'Click a mark to pin an annotation on it.',
-        requires: ['elements'],
+        requires: INTERACTION_PRESET_REQUIREMENTS['click-annotate'],
         gesture: 'click',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -119,7 +119,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'select',
         label: 'Rectangle select',
         description: 'Drag a rectangle to emphasise the marks inside it.',
-        requires: ['elements', 'region'],
+        requires: INTERACTION_PRESET_REQUIREMENTS['select'],
         gesture: 'drag',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -129,7 +129,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'lasso-select',
         label: 'Lasso select',
         description: 'Draw a freehand region to emphasise the marks inside it.',
-        requires: ['elements', 'region'],
+        requires: INTERACTION_PRESET_REQUIREMENTS['lasso-select'],
         gesture: 'drag',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -139,7 +139,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'brush-x',
         label: 'Brush x',
         description: 'Drag an interval along x; a stateful brush stays editable after the drag.',
-        requires: ['elements', 'region'],
+        requires: INTERACTION_PRESET_REQUIREMENTS['brush-x'],
         gesture: 'drag',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -149,7 +149,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'brush-y',
         label: 'Brush y',
         description: 'Drag an interval along y; a stateful brush stays editable after the drag.',
-        requires: ['elements', 'region'],
+        requires: INTERACTION_PRESET_REQUIREMENTS['brush-y'],
         gesture: 'drag',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -159,7 +159,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'brush-angle',
         label: 'Brush angle',
         description: 'Drag an angular sector on a polar chart such as a pie, donut, rose, or radar.',
-        requires: ['elements', 'angular-region'],
+        requires: INTERACTION_PRESET_REQUIREMENTS['brush-angle'],
         gesture: 'drag',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -1
```

**File**: `packages/flint-js/tests/interaction-support.test.ts` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+import { describe, expect, it } from 'vitest';
+import {
+    INTERACTION_PRESET_REQUIREMENTS,
+    INTERACTION_PRESET_TYPES,
+    declaredInteractionCapabilities,
+    supportedInteractionPresets,
+} from '../src/core/interaction-spec';
+import { INTERACTION_PRESETS } from '../src/interactive/spec/registry';
+import { vlAllTemplateDefs } from '../src/vegalite/templates';
+
+const def = (chart: string) => vlAllTemplateDefs.find((candidate) => candidate.chart === chart)!;
+
+describe('declaredInteractionCapabilities', () => {
+    it('reads the template block key by key and names nothing for an absent block', () => {
+        expect(declaredInteractionCapabilities(undefined)).toEqual([]);
+        expect(declaredInteractionCapabilities(def('KPI Card').interactions)).toEqual(['elements']);
+        expect(declaredInteractionCapabilities(def('Pie Chart').interactions))
+            .toEqual(['elements', 'region', 'angular-region', 'legend']);
+        expect(declaredInteractionCapabilities(def('Bar Chart').interactions))
+            .toEqual(['elements', 'region', 'navigation', 'reorder', 'legend', 'discrete-axis']);
+    });
+});
+
+describe('supportedInteractionPresets', () => {
+    it('lists the presets whose requirements sit inside the declaration', () => {
+        expect(supportedInteractionPresets(def('KPI Card').interactions)).toEqual([
+            'click-highlight', 'click-group-focus', 'hover-group-focus', 'click-annotate',
+            'context-activate', 'long-press', 'double-activate', 'inspect',
+        ]);
+        const pie = supportedInteractionPresets(def('Pie Chart').interactions);
+        expect(pie).toContain('brush-angle');
+        expect(pie).toContain('brush-x');
+        expect(pie).toContain('legend-toggle');
+        expect(pie).not.toContain('navigate');
+        expect(pie).not.toContain('axis-highlight');
+        expect(pie).not.toContain('drag-reorder');
+        const bar = supportedInteractionPresets(def('Bar Chart').interactions);
+        expect(bar).not.toContain('brush-angle');
+        expect(bar).not.toContain('inspect-index');
+        expect(bar).toContain('drag-reorder');
+        expect(supportedInteractionPresets(undefined)).toEqual([]);
+    });
+
+    it('keeps the registry and the core table in step', () => {
+        for (const type of INTERACTION_PRESET_TYPES) {
+            expect(INTERACTION_PRESETS[type].requires, type).toBe(INTERACTION_PRESET_REQUIREMENTS[type]);
+        }
+    });
+
+    it('every preset is supported by at least one chart type, and every chart type supports at least one preset', () => {
+        const union = new Set(vlAllTemplateDefs.flatMap((template) => supportedInteractionPresets(template.interactions)));
+        expect([...INTERACTION_PRESET_TYPES].filter((type) => !union.has(type))).toEqual([]);
+        const empty = vlAllTemplateDefs.filter((template) => supportedInteractionPresets(template.interactions).length === 0);
+        expect(empty.map((template) => template.chart)).toEqual([]);
+    });
+});
```

**File**: `site/src/main.tsx` (modified, +2/-1)
```diff
@@ -26,6 +26,7 @@ import { BandStretchingLab } from './playground/BandStretchingLab';
 import { LabelExperimentLab } from './playground/LabelExperimentLab';
 import { OverflowViewportLab } from './playground/OverflowViewportLab';
 import { ClickFocusLab, SpecTestCasesLab } from './playground/ClickFocusLab';
+import { InteractionCoverageLab } from './playground/InteractionCoverageLab';
 import { AnnotationLab } from './playground/AnnotationLab';
 import { InteractionDashboardLab } from './playground/InteractionDashboardLab';
 import { InteractionCandidates } from './playground/InteractionCandidates';
@@ -88,7 +89,7 @@ function AppRoutes({ locale }: { locale: Locale }) {
           <Route path="click-focus" element={<ClickFocusLab />} />
           <Route path="spec-test-cases" element={<SpecTestCasesLab />} />
           <Route path="annotation-lab" element={<AnnotationLab />} />
-          <Route path="interaction-coverage" element={<Navigate to="../click-focus" replace />} />
+          <Route path="interaction-coverage" element={<InteractionCoverageLab />} />
           <Route path="pan-zoom" element={<Navigate to="../click-focus" replace />} />
           <Route path="interaction-dashboard" element={<InteractionDashboardLab />} />
           <Route path="external-to-chart" element={<ExternalToChartLab />} />
```

**File**: `site/src/playground/InteractionCoverageLab.tsx` (added, +197/-0)
```diff
@@ -0,0 +1,197 @@
+import { useMemo, useState } from 'react';
+import {
+  assembleVegaLite,
+  declaredInteractionCapabilities,
+  INTERACTION_PRESET_REQUIREMENTS,
+  INTERACTION_PRESET_TYPES,
+  supportedInteractionPresets,
+  vlAllTemplateDefs,
+  type ChartTemplateDef,
+  type InteractionCapability,
+  type InteractionPresetType,
+} from 'flint-chart';
+import { TEST_GENERATORS, type TestCase } from 'flint-chart/test-data';
+import { INTERACTION_PRESETS } from 'flint-chart/interactive';
+import { testCaseToAssemblyInput } from '../shared/test-case-utils';
+import './interaction-coverage.css';
+
+type CellStatus = 'active' | 'declared' | 'unsupported';
+
+interface Cell {
+  status: CellStatus;
+  /** The first requirement the chart lacks, for the tooltip. */
+  missing?: InteractionCapability;
+}
+
+interface Row {
+  chartType: string;
+  caseTitle?: string;
+  declared: readonly InteractionCapability[];
+  active: readonly InteractionCapability[];
+  assembleError?: string;
+  cells: Record<InteractionPresetType, Cell>;
+}
+
+const CAPABILITY_LABEL: Record<InteractionCapability, string> = {
+  'elements': 'marks that resolve to data',
+  'region': 'a plot to drag a region on',
+  'angular-region': 'a polar chart with an angular region',
+  'navigation': 'a navigable continuous axis',
+  'reorder': 'a discrete axis whose order can change',
+  'legend': 'a discrete legend',
+  'discrete-axis': 'a discrete axis with category labels',
+  'index': 'an index axis shared by the series',
+};
+
+/** The case the Test cases tab would show first for a chart type: a real, unfaceted one when there is one. */
+function representativeCase(chartType: string): TestCase | undefined {
+  let chosen: TestCase | undefined;
+  for (const generator of Object.values(TEST_GENERATORS)) {
+    let cases: TestCase[];
+    try {
+      cases = generator();
+    } catch {
+      continue;
+    }
+    for (const testCase of cases) {
+      if (testCase.chartType !== chartType) continue;
+      const preferred = testCase.tags?.includes('real')
+        && !testCase.encodingMap.column?.fieldID
+        && !testCase.encodingMap.row?.fieldID;
+      if (!chosen || preferred) chosen = testCase;
+      if (preferred) return chosen;
+    }
+  }
+  return chosen;
+}
+
+function rowFor(def: ChartTemplateDef): Row {
+  const declared = declaredInteractionCapabilities(def.interactions);
+  const testCase = representativeCase(def.chart);
+  let active: readonly InteractionCapability[] = [];
+  let assembleError: string | undefined;
+  if (testCase) {
+    try {
+      const spec = assembleVegaLite(testCaseToAssemblyInput(testCase)) as any;
+      active = spec._interactionSemantics?.capabilities ?? [];
+    } catch (error) {
+      assembleError = error instanceof Error ? error.message : String(error);
+    }
+  }
+  const declaredSet = new Set(declared);
+  const activeSet = new Set(active);
+  const cells = Object.fromEntries(INTERACTION_PRESET_TYPES.map((type) => {
+    const requires = INTERACTION_PRESET_REQUIREMENTS[type];
+    const missingDeclared = requires.find((capability) => !declaredSet.has(capability));
+    if (missingDeclared) return [type, { status: 'unsupported', missing: missingDeclared }];
+    const missingActive = requires.find((capability) => !activeSet.has(capability));
+    if (missingActive) return [type, { status: 'declared', missing: missingActive }];
+    return [type, { status: 'active' }];
+  })) as Record<InteractionPresetType, Cell>;
+  return { chartType: def.chart, caseTitle: testCase?.title, declared, active, assembleError, cells };
+}
+
+const GLYPH: Record<CellStatus, string> = { active: '●', declared: '○', unsupported: '·' };
+
+function cellTitle(row: Row, type: InteractionPresetType, cell: Cell): string {
+  const label = INTERACTION_PRESETS[type].label;
+  if (cell.status === 'active') return `${label} on ${row.chartType}: supported, and active for "${row.caseTitle ?? 'this case'}".`;
+  if (cell.status === 'declared') {
+    return `${label} on ${row.chartType}: supported by the chart type, but "${row.caseTitle ?? 'this case'}" lacks ${CAPABILITY_LABEL[cell.missing!]}. A spec entry is dropped for this data.`;
+  }
+  return `${label} on ${row.chartType}: not supported. The chart type never offers ${CAPABILITY_LABEL[cell.missing!]}.`;
+}
+
+export function InteractionCoverageLab() {
+  const [filter, setFilter] = useState('');
+  const rows = useMemo(() => [...vlAllTemplateDefs]
+    .sort((left, right) => left.chart.localeCompare(right.chart))
+    .map(rowFor), []);
+  const visible = filter.trim()
+    ? rows.filter((row) => row.chartType.toLowerCase().includes(filter.trim().toLowerCase()))
+    : rows;
+  const tally = visible.reduce((counts, row) => {
+    for (const cell of Object.values(row.cells)) counts[cell.status] += 1;
+    return counts;
+  }, { active: 0, declared: 0, unsupported: 0 } as Record<CellStatus, number>);
+  const staticTotal = visible.reduce((sum, row) =>
+    sum + supportedIn
```

**File**: `site/src/playground/PlaygroundShell.tsx` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@ const pages: NavEntry[] = [
     children: [
       { to: 'click-focus', label: 'Test cases' },
       { to: 'spec-test-cases', label: 'Spec test cases' },
+      { to: 'interaction-coverage', label: 'Coverage' },
       { to: 'bespoke-interaction', label: 'Advanced prototypes' },
       { to: 'annotation-lab', label: 'Annotation lab' },
       { to: 'interaction-candidates', label: 'References' },
```

---

### Incident Patch 6: `26291dc0` (2026-09-13)
**Commit Message**: feat(interactions): admission matches a preset's requirements against the chart's capabilities

The assembler confirms the declared capabilities against the bound encodings and writes
the active list, with the chart type, into _interactionSemantics. Admission replaces its
four inferred checks with one rule: every capability in the preset's requires list must be
present, or a spec entry drops with a message that names the chart type and the missing
property, and a code definition throws. A plan the assembler did not annotate is read the
way the compile step read it, so hand-built plans keep their behaviour. The region
capability covers either kind of drag region, because brush-x on a polar chart is honoured
as an angular brush; only brush-angle needs the angular one. A survey of both lab tabs
showed 787 cards with no difference between code and spec; the KPI card lost the region
presets, and the scatter family gained the index declaration its lab cases relied on.

**File**: `docs/design-interaction-spec.md` (modified, +17/-5)
```diff
@@ -555,9 +555,11 @@ The registry's `requires` was written but never read.
 Three parts, each in one place:
 
 1. **A vocabulary of chart capabilities** (`InteractionCapability`, core): a fact some preset
-   reads at runtime. `elements` (marks resolve to data), `cartesian-region`, `angular-region`,
-   `navigation`, `reorder`, `legend`, `discrete-axis`, `index` (one x position reads every
-   series).
+   reads at runtime. `elements` (marks resolve to data), `region` (any drag region the plot
+   resolves marks in), `angular-region` (the polar kind), `navigation`, `reorder`, `legend`,
+   `discrete-axis`, `index` (one x position reads every series). `brush-x` on a polar chart is
+   honoured as an angular brush, which is why the brushes need a region of either kind and only
+   `brush-angle` needs the angular one.
 2. **Per preset, `requires`** in the registry, now a list: the smallest set without which the
    preset does nothing. Brushes need `elements` and a region; `brush-zoom` and `navigate` need
    `navigation`; `legend-toggle` needs `legend`; `axis-highlight` needs `discrete-axis`;
@@ -578,7 +580,8 @@ mark geometry), **P** = the probe over the shipped test cases, **J** = judgment,
 
 | Chart type | elements | region | navigation | reorder | legend | discrete axis | index | Source |
 |---|---|---|---|---|---|---|---|---|
-| Scatter Plot, Regression, Connected Scatter Plot | ✓ | cartesian | x, y | | ✓ | | | T, P |
+| Scatter Plot, Regression | ✓ | cartesian | x, y | | ✓ | | ✓ | T, P, lab |
+| Connected Scatter Plot | ✓ | cartesian | x, y | | ✓ | | | T, P |
 | Ranged Dot Plot | ✓ | cartesian | x, y | connective marks | ✓ | ✓ | | T |
 | Boxplot, Strip Plot | ✓ | cartesian | x, y | ✓ | ✓ | ✓ | | T, P |
 | Bar, Grouped Bar, Stacked Bar, Lollipop | ✓ | cartesian | x, y | ✓ | ✓ | ✓ | | T, P |
@@ -617,7 +620,16 @@ Judgment calls, open for review:
   `axis-highlight` emphasises the marks of one category label; on these charts the x labels are
   periods or bins rather than categories a reader would pick.
 - **`index`** on the charts whose x is a shared index across series: line, area, streamgraph,
-  range area, bump, slope, density, ECDF, candlestick, sparkline.
+  range area, bump, slope, density, ECDF, candlestick, sparkline, and the scatter family, where
+  the lab's curated index-inspection cases (income, year on x) already worked.
+
+### Enforcement, verified
+
+With the match rule in place, a headless survey clicked every mode on both lab tabs: 787
+cards, 0 differences between the code tab and the spec tab. The cards that changed status
+were the KPI Card in every region mode (select, the brushes, lasso), which is the intended
+truth, and two index-inspection cases on scatter plots, which led to the `index` declaration
+on the scatter family above. Every other card kept its status.
 
 ### Discovery
 
```

**File**: `packages/flint-js/src/core/interaction-spec.ts` (modified, +6/-2)
```diff
@@ -37,10 +37,14 @@ export const INTERACTION_PRESET_TYPES = [
 
 export type InteractionPresetType = (typeof INTERACTION_PRESET_TYPES)[number];
 
-/** A fact about a chart that at least one interaction preset reads at runtime. */
+/**
+ * A fact about a chart that at least one interaction preset reads at runtime.
+ * `region` is any drag region the plot resolves marks in; `angular-region` is
+ * the polar kind, which only the angular brush needs.
+ */
 export const INTERACTION_CAPABILITIES = [
     'elements',
-    'cartesian-region',
+    'region',
     'angular-region',
     'navigation',
     'reorder',
```

**File**: `packages/flint-js/src/interactive/spec/admission.ts` (modified, +49/-14)
```diff
@@ -1,9 +1,14 @@
 import type { ChartWarning } from '../../core/types';
+import type { InteractionCapability } from '../../core/interaction-spec';
 import type { CanvasInteractionDef } from '../interactions';
 import type { NavigationAxes } from '../language/events';
+import { INTERACTION_PRESETS } from './registry';
 
 /** What admission reads from the compiled chart: the fields the assembler writes to `_interactionSemantics`. */
 export interface InteractionAdmissionPlan {
+    readonly chartType?: string;
+    /** The capabilities the assembler confirmed for this chart and its data. A plan without them is read from the other fields. */
+    readonly capabilities?: readonly InteractionCapability[];
     readonly fields: readonly string[];
     readonly selectableMarks: readonly string[];
     readonly resolve?: unknown;
@@ -32,6 +37,43 @@ export function navigationAxesFor(
 const PAN_DRAG_CONFLICT = 'Pan navigation cannot share an unmodified drag gesture with a region interaction.';
 const DROPPED = 'The interaction was dropped.';
 
+const NEEDS: Readonly<Record<InteractionCapability, string>> = {
+    'elements': 'marks that resolve to data',
+    'region': 'a plot to drag a region on',
+    'angular-region': 'a polar chart with an angular region',
+    'navigation': 'a navigable continuous axis',
+    'reorder': 'a discrete axis whose order can change',
+    'legend': 'a discrete legend',
+    'discrete-axis': 'a discrete axis with category labels',
+    'index': 'an index axis shared by the series',
+};
+
+/**
+ * A plan the assembler did not annotate is read the way the compile step read it:
+ * element semantics, the angular flag, and the navigable axes decide; the other
+ * capabilities are taken as present.
+ */
+function inferredCapabilities(plan: InteractionAdmissionPlan): readonly InteractionCapability[] {
+    const list: InteractionCapability[] = ['legend', 'reorder', 'discrete-axis', 'index'];
+    if (!!plan.resolve || plan.fields.length > 0 || plan.selectableMarks.length > 0) list.push('elements', 'region');
+    if (plan.supportedRegionGestures?.includes('angular')) list.push('angular-region');
+    if ((plan.navigationAxes ?? []).length > 0) list.push('navigation');
+    return list;
+}
+
+/** A custom definition states its needs; a preset carries them through the registry; anything else is read off the event source. */
+export function interactionRequirements(interaction: CanvasInteractionDef): readonly InteractionCapability[] {
+    if (interaction.requires) return interaction.requires;
+    if (interaction.preset) return INTERACTION_PRESETS[interaction.preset].requires;
+    const source = interaction.eventSource;
+    if (source.type === 'navigation') return ['navigation'];
+    if (source.type === 'region') {
+        return source.regionGeometry === 'angular' ? ['elements', 'angular-region'] : ['elements', 'region'];
+    }
+    if (source.type === 'element') return ['elements'];
+    return [];
+}
+
 /**
  * Decide which interactions a compiled chart can honour.
  *
@@ -54,33 +96,26 @@ export function admitInteractions(
         warnings.push({ severity: 'warning', code, message: `${message} ${DROPPED}` });
         return false;
     };
-    const hasElementSemantics = !!plan.resolve || plan.fields.length > 0 || plan.selectableMarks.length > 0;
+    const capabilities = new Set(plan.capabilities ?? inferredCapabilities(plan));
+    const chart = plan.chartType ?? 'this chart';
     const available = plan.navigationAxes ?? [];
-    const angular = plan.supportedRegionGestures?.includes('angular') ?? false;
 
-    // Capability checks, one interaction at a time.
+    // Every capability the interaction needs must be present on this chart.
     let admitted = interactions.filter((interaction) => {
-        const source = interaction.eventSource;
-        if ((source.type === 'element' || source.type === 'region') && !hasElementSemantics) {
+        const missing = interactionRequirements(interaction).find((capability) => !capabilities.has(capability));
+        if (missing) {
             return reject(interaction, 'unsupported_interaction',
-                `Interaction "${interaction.id}" requires chart element semantics.`);
+                `Interaction "${interaction.id}" requires ${NEEDS[missing]}; ${chart} has none.`);
         }
+        const source = interaction.eventSource;
         if (source.type === 'navigation') {
             const requested = navigationAxesFor(source.axes, available);
-            if (requested.length === 0) {
-                return reject(interaction, 'unsupported_interaction',
-                    `Interaction "${interaction.id}" requires a chart with a navigable continuous axis.`);
-            }
             const unsupported = requested.filter((axis) => !available.includes(axis));
             if (unsupported.length > 0) {
                 return reject(interaction, 'unsupported_interaction',
                     `Interaction "${interaction.id}"
```

**File**: `packages/flint-js/src/interactive/spec/registry.ts` (modified, +5/-5)
```diff
@@ -119,7 +119,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'select',
         label: 'Rectangle select',
         description: 'Drag a rectangle to emphasise the marks inside it.',
-        requires: ['elements', 'cartesian-region'],
+        requires: ['elements', 'region'],
         gesture: 'drag',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -129,7 +129,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'lasso-select',
         label: 'Lasso select',
         description: 'Draw a freehand region to emphasise the marks inside it.',
-        requires: ['elements', 'cartesian-region'],
+        requires: ['elements', 'region'],
         gesture: 'drag',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -139,7 +139,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'brush-x',
         label: 'Brush x',
         description: 'Drag an interval along x; a stateful brush stays editable after the drag.',
-        requires: ['elements', 'cartesian-region'],
+        requires: ['elements', 'region'],
         gesture: 'drag',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -149,7 +149,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'brush-y',
         label: 'Brush y',
         description: 'Drag an interval along y; a stateful brush stays editable after the drag.',
-        requires: ['elements', 'cartesian-region'],
+        requires: ['elements', 'region'],
         gesture: 'drag',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -179,7 +179,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'linked-brush',
         label: 'Linked brush',
         description: 'Brush marks and emphasise every mark that shares their group, across views.',
-        requires: ['elements', 'cartesian-region'],
+        requires: ['elements', 'region'],
         gesture: 'drag',
         requiredOptions: ['groupBy'],
         supportedReset: ANY_RESET,
```

**File**: `packages/flint-js/src/vegalite/assemble.ts` (modified, +21/-0)
```diff
@@ -53,6 +53,7 @@ import {
     InstantiateContext,
 } from '../core/types';
 import type { ChartWarning, ChartOption, OptionEvalContext } from '../core/types';
+import type { InteractionCapability } from '../core/interaction-spec';
 import { applyEncodingOverrides } from '../core/encoding-overrides';
 import { applyAggregation } from '../core/aggregate';
 import { planBandDodge, resolveDodge } from '../core/band-dodge';
@@ -944,8 +945,28 @@ export function assembleVegaLite(input: ChartAssemblyInput): any {
             .filter((candidate, index, candidates) => candidates.findIndex(
                 (axis) => axis.axis === candidate.axis && axis.field === candidate.field,
             ) === index);
+        const discreteLegend = Object.keys(legendFields ?? {})
+            .some((channel) => !rangeLegendChannels.includes(channel));
+        const discreteAxis = (['x', 'y'] as const).some((axis) => {
+            const encoding = resolvedEncodings[axis];
+            return !!encoding?.field && (encoding.type === 'nominal' || encoding.type === 'ordinal');
+        });
+        const hasElements = 'resolve' in templateSemantics
+            || templateSemantics.fields.length > 0
+            || templateSemantics.selectableMarks.length > 0;
+        const capabilities: InteractionCapability[] = [];
+        if (support?.elements && hasElements) capabilities.push('elements');
+        if (support?.region?.length) capabilities.push('region');
+        if (support?.region?.includes('angular')) capabilities.push('angular-region');
+        if (navigationAxes.length > 0) capabilities.push('navigation');
+        if (reorderAxes.length > 0) capabilities.push('reorder');
+        if (support?.legend && discreteLegend) capabilities.push('legend');
+        if (support?.discreteAxis && discreteAxis) capabilities.push('discrete-axis');
+        if (support?.index && resolvedEncodings.x?.field) capabilities.push('index');
         result._interactionSemantics = {
             ...templateSemantics,
+            chartType: chartTemplate.chart,
+            capabilities,
             supportedRegionGestures: support?.region ? [...support.region] : undefined,
             axisFields: Object.fromEntries((['x', 'y'] as const).flatMap((axis) => {
                 const encoding = resolvedEncodings[axis];
```

**File**: `packages/flint-js/src/vegalite/interactions/compile.ts` (modified, +3/-0)
```diff
@@ -1,4 +1,5 @@
 import type { ChartInteractionResolver } from '../../core/interaction-semantics';
+import type { InteractionCapability } from '../../core/interaction-spec';
 import {
     isCanvasInteraction,
     type ChartUpdatePresenter,
@@ -47,6 +48,8 @@ const LEGEND_ENTRY_MARK = '__flint_legend_entry';
 const SUPPORTED_SPEC_MARKS = new Set(['arc', 'area', 'bar', 'boxplot', 'circle', 'geoshape', 'line', 'point', 'rect', 'rule', 'tick']);
 
 interface TemplateInteractionSemantics {
+    chartType?: string;
+    capabilities?: readonly InteractionCapability[];
     fields: string[];
     sourceRecords?: readonly Record<string, unknown>[];
     provenanceFields?: readonly string[];
```

**File**: `packages/flint-js/src/vegalite/templates/scatter.ts` (modified, +2/-0)
```diff
@@ -55,6 +55,7 @@ export const scatterPlotDef: ChartTemplateDef = {
         region: ['cartesian'],
         navigation: {},
         legend: true,
+        index: true,
     },
     markCognitiveChannel: 'position',
     semanticInteractions: ({ resolvedEncodings }) => {
@@ -140,6 +141,7 @@ export const regressionDef: ChartTemplateDef = {
         region: ['cartesian'],
         navigation: {},
         legend: true,
+        index: true,
     },
     markCognitiveChannel: 'position',
     semanticInteractions: ({ resolvedEncodings }) => {
```

**File**: `packages/flint-js/tests/interaction-admission.test.ts` (modified, +84/-6)
```diff
@@ -30,11 +30,11 @@ describe('admitInteractions', () => {
 
     it('throws for a code definition the chart cannot honour, with the message the compile step used', () => {
         expect(() => admitInteractions(CARTESIAN, [brushAngle()]))
-            .toThrow('Interaction "brush-angle" requires a polar chart with angular-region support.');
+            .toThrow('Interaction "brush-angle" requires a polar chart with an angular region; this chart has none.');
         expect(() => admitInteractions(NO_SEMANTICS, [clickHighlight()]))
-            .toThrow('Interaction "click-highlight" requires chart element semantics.');
+            .toThrow('Interaction "click-highlight" requires marks that resolve to data; this chart has none.');
         expect(() => admitInteractions({ ...CARTESIAN, navigationAxes: [] }, [navigate()]))
-            .toThrow('Interaction "navigate" requires a chart with a navigable continuous axis.');
+            .toThrow('Interaction "navigate" requires a navigable continuous axis; this chart has none.');
         expect(() => admitInteractions(CARTESIAN, [navigate({ axes: 'y' })]))
             .toThrow('Interaction "navigate" requested unsupported navigation axis: y.');
     });
@@ -45,14 +45,14 @@ describe('admitInteractions', () => {
         expect(result.warnings).toEqual([{
             severity: 'warning',
             code: 'unsupported_interaction',
-            message: 'Interaction "brush-angle" requires a polar chart with angular-region support. The interaction was dropped.',
+            message: 'Interaction "brush-angle" requires a polar chart with an angular region; this chart has none. The interaction was dropped.',
         }]);
     });
 
     it('drops a spec navigate the chart cannot navigate', () => {
         const none = admitInteractions({ ...CARTESIAN, navigationAxes: [] }, fromSpec([{ type: 'navigate' }]));
         expect(none.admitted).toEqual([]);
-        expect(none.warnings[0].message).toContain('requires a chart with a navigable continuous axis');
+        expect(none.warnings[0].message).toContain('requires a navigable continuous axis');
         const wrongAxis = admitInteractions(CARTESIAN, fromSpec([{ type: 'navigate', options: { axes: 'y' } }]));
         expect(wrongAxis.admitted).toEqual([]);
         expect(wrongAxis.warnings[0].message).toContain('requested unsupported navigation axis: y');
@@ -136,8 +136,86 @@ describe('addVegaLiteInteractions with spec interactions', () => {
 
     it('still throws for the same request made in code', () => {
         expect(() => addVegaLiteInteractions(assembled(), [brushAngle()]))
-            .toThrow('requires a polar chart with angular-region support');
+            .toThrow('requires a polar chart with an angular region; Bar Chart has none');
         expect(() => addVegaLiteInteractions(assembled(), [navigate(), select()]))
             .toThrow('Pan navigation cannot share');
     });
 });
+
+describe('admission against the chart type declaration', () => {
+    const rows = [
+        { region: 'North', category: 'A', value: 1, when: '2024-01-01' },
+        { region: 'South', category: 'B', value: 2, when: '2024-02-01' },
+    ];
+    const semanticsOf = (chartType: string, encodings: Record<string, string>): any =>
+        (assembleVegaLite({
+            data: { values: rows },
+            semantic_types: { value: 'Quantity', when: 'Date' },
+            chart_spec: { chartType, encodings },
+        }) as any)._interactionSemantics;
+    const every = fromSpec([
+        { type: 'click-highlight' }, { type: 'select' }, { type: 'brush-x' }, { type: 'brush-angle' },
+        { type: 'legend-toggle' }, { type: 'drag-reorder' }, { type: 'axis-highlight' },
+        { type: 'inspect-index' }, { type: 'navigate', options: { pan: false } },
+    ]);
+
+    it('writes the confirmed capabilities and the chart type into the compiled semantics', () => {
+        const bar = semanticsOf('Bar Chart', { x: 'category', y: 'value', color: 'region' });
+        expect(bar.chartType).toBe('Bar Chart');
+        expect(bar.capabilities).toEqual(['elements', 'region', 'navigation', 'reorder', 'legend', 'discrete-axis']);
+        const pie = semanticsOf('Pie Chart', { theta: 'value', color: 'category' });
+        expect(pie.capabilities).toEqual(['elements', 'region', 'angular-region', 'legend']);
+        const kpi = semanticsOf('KPI Card', { metric: 'category', value: 'value' });
+        expect(kpi.capabilities).toEqual(['elements']);
+    });
+
+    it('a KPI card keeps the element presets and drops the rest, naming the chart type', () => {
+        const result = admitInteractions(semanticsOf('KPI Card', { metric: 'category', value: 'value' }), every);
+        expect(ids(result.admitted)).toEqual(['click-highlight']);
+        expect(result.warnings.map((warning) => warning.message)).toEqual([
+            'Interaction "select" requires a plot to drag a region on; KPI Card has none. The interaction was dr
```

---

### Incident Patch 7: `33d75755` (2026-09-13)
**Commit Message**: feat(interactions): chart capabilities named once, preset requirements as a list

Eight chart capabilities (elements, cartesian-region, angular-region, navigation,
reorder, legend, discrete-axis, index) move to core as INTERACTION_CAPABILITIES, and
ChartInteractionSupport describes what a chart type offers; ChartTemplateDef gains an
optional interactions block for it. Each registry entry lists the capabilities its preset
needs in requires, and every wrapper stamps preset on the definition it returns so a
definition made in code can be checked against the same list as a spec entry. Nothing
reads the declarations yet.

**File**: `packages/flint-js/src/core/index.ts` (modified, +3/-0)
```diff
@@ -201,7 +201,10 @@ export { isRegistered, getRegisteredTypes } from './type-registry';
 // Declarative interactions: the JSON contract read by flint-chart/interactive
 export {
     INTERACTION_PRESET_TYPES,
+    INTERACTION_CAPABILITIES,
     type InteractionPresetType,
+    type InteractionCapability,
+    type ChartInteractionSupport,
     type InteractionEntry,
     type InteractionSpec,
     type AssistedTargetingOptions,
```

**File**: `packages/flint-js/src/core/interaction-spec.ts` (modified, +42/-0)
```diff
@@ -37,6 +37,48 @@ export const INTERACTION_PRESET_TYPES = [
 
 export type InteractionPresetType = (typeof INTERACTION_PRESET_TYPES)[number];
 
+/** A fact about a chart that at least one interaction preset reads at runtime. */
+export const INTERACTION_CAPABILITIES = [
+    'elements',
+    'cartesian-region',
+    'angular-region',
+    'navigation',
+    'reorder',
+    'legend',
+    'discrete-axis',
+    'index',
+] as const;
+
+export type InteractionCapability = (typeof INTERACTION_CAPABILITIES)[number];
+
+/**
+ * What a chart type offers to interaction presets, declared on
+ * `ChartTemplateDef.interactions`. An absent key means the chart type never
+ * offers that capability. The assembler confirms the data-dependent ones
+ * against the encodings: a legend needs a bound discrete legend channel,
+ * navigation needs a continuous unfaceted axis, reorder needs a discrete axis.
+ */
+export interface ChartInteractionSupport {
+    /** Marks resolve to data elements, so click, hover, annotate, and inspect presets work. */
+    elements?: boolean;
+    /** Drag regions the plot can resolve marks in. */
+    region?: readonly ('cartesian' | 'angular')[];
+    /**
+     * Continuous positional axes whose domains pan and zoom. `geo` marks a
+     * chart that places marks through a projection: pan and zoom then move the
+     * projection's extent, and both axes navigate together.
+     */
+    navigation?: { axes?: readonly ('x' | 'y')[]; geo?: boolean };
+    /** Discrete positional axes whose domain order a drag can change. */
+    reorder?: { axes?: readonly ('x' | 'y')[]; includeConnectiveMarks?: boolean; markTypes?: readonly string[] };
+    /** A discrete legend whose items stand for series or categories. */
+    legend?: boolean;
+    /** Axis labels stand for categories a pointer can target. */
+    discreteAxis?: boolean;
+    /** One position on the index axis reads a value from every series. */
+    index?: boolean;
+}
+
 /**
  * One preset as JSON: the type name, an optional id, and that preset's options
  * under `options`, for example
```

**File**: `packages/flint-js/src/core/types.ts` (modified, +4/-1)
```diff
@@ -6,7 +6,7 @@ import type { LabelSizingDecision } from './decisions';
 import type { SemanticAnnotation, FormatSpec, DomainConstraint, TickConstraint } from './field-semantics';
 import type { ColorDecisionResult } from './color-decisions';
 import type { GeometryKind, ThemeGeometry, ThemeSpec } from './theme/types';
-import type { InteractionSpec } from './interaction-spec';
+import type { ChartInteractionSupport, InteractionSpec } from './interaction-spec';
 
 /**
  * Core types for the chart engine library.
@@ -920,6 +920,9 @@ export interface ChartTemplateDef {
         markTypes?: readonly string[];
     };
 
+    /** What this chart type offers to interaction presets; absent means none. */
+    interactions?: ChartInteractionSupport;
+
     /**
      * How the primary mark encodes its quantitative value.
      * Determines zero-baseline, scale tightness, and compression behavior.
```

**File**: `packages/flint-js/src/interactive/interactions.ts` (modified, +30/-21)
```diff
@@ -8,6 +8,7 @@ import type {
 import type { InteractionEventSource, NavigationResetGesture } from './triggers';
 export type { NavigationResetGesture } from './triggers';
 import { NAVIGATION_RESET, NO_RESET, SELECTION_RESET, normalizeResetGestures, type InteractionResetGesture } from './reset';
+import type { InteractionCapability, InteractionPresetType } from '../core/interaction-spec';
 import type { InspectIndexShow, InspectMode } from './triggers';
 import type { InspectGuideOptions, RegionGuideOptions } from './guides';
 import type { InteractionAffordance } from './affordances';
@@ -103,6 +104,10 @@ export interface CanvasInteractionDef {
     readonly id: string;
     /** Set by the spec resolver. A definition made in code has no origin. */
     readonly origin?: 'spec';
+    /** The preset that made this definition; admission reads its requirements from the registry. */
+    readonly preset?: InteractionPresetType;
+    /** Chart capabilities a custom definition needs; a preset carries them through the registry instead. */
+    readonly requires?: readonly InteractionCapability[];
     /** Gestures that return this interaction to its neutral state, normalised by the factory. Absent on presets that retain nothing. */
     readonly reset?: readonly InteractionResetGesture[];
     /** Drops state the preset keeps outside the chart's retained updates, when a reset gesture fires. */
@@ -301,6 +306,10 @@ export interface DragReorderOptions {
     reset?: readonly InteractionResetGesture[];
 }
 
+function asPreset(type: InteractionPresetType, definition: CanvasInteractionDef): CanvasInteractionDef {
+    return { ...definition, preset: type };
+}
+
 /** Attaches the normalised reset list; presets that retain nothing never pass through here. */
 function withReset(
     definition: CanvasInteractionDef,
@@ -311,90 +320,90 @@ function withReset(
 }
 
 export function clickHighlight(options: ClickHighlightOptions = {}): CanvasInteractionDef {
-    return withReset(createClickHighlightInteraction(options), options.reset, SELECTION_RESET);
+    return asPreset('click-highlight', withReset(createClickHighlightInteraction(options), options.reset, SELECTION_RESET));
 }
 
 export function axisHighlight(options: AxisHighlightOptions = {}): CanvasInteractionDef {
-    return withReset(createAxisHighlightInteraction(options), options.reset, SELECTION_RESET);
+    return asPreset('axis-highlight', withReset(createAxisHighlightInteraction(options), options.reset, SELECTION_RESET));
 }
 
 export function clickGroupFocus(options: ClickGroupFocusOptions = {}): CanvasInteractionDef {
-    return withReset(createClickGroupFocusInteraction({
+    return asPreset('click-group-focus', withReset(createClickGroupFocusInteraction({
         id: options.id ?? 'click-group-focus',
         dimOpacity: options.dimOpacity,
         groupBy: options.groupBy,
-    }), options.reset, SELECTION_RESET);
+    }), options.reset, SELECTION_RESET));
 }
 
 export function clickAnnotate(options: ClickAnnotateOptions = {}): CanvasInteractionDef {
-    return withReset(createClickAnnotateInteraction(options), options.reset, SELECTION_RESET);
+    return asPreset('click-annotate', withReset(createClickAnnotateInteraction(options), options.reset, SELECTION_RESET));
 }
 
 export function linkedBrush(options: LinkedBrushOptions): CanvasInteractionDef {
-    return withReset(createLinkedBrushInteraction(options), options.reset, SELECTION_RESET);
+    return asPreset('linked-brush', withReset(createLinkedBrushInteraction(options), options.reset, SELECTION_RESET));
 }
 
 export function hoverGroupFocus(options: HoverGroupFocusOptions): CanvasInteractionDef {
-    return createHoverGroupFocusInteraction({ ...options, id: options.id ?? 'hover-group-focus' });
+    return asPreset('hover-group-focus', createHoverGroupFocusInteraction({ ...options, id: options.id ?? 'hover-group-focus' }));
 }
 
 export function select(options: SelectOptions = {}): CanvasInteractionDef {
-    return withReset(createSelectInteraction(options), options.reset, SELECTION_RESET);
+    return asPreset('select', withReset(createSelectInteraction(options), options.reset, SELECTION_RESET));
 }
 
 export function lassoSelect(options: LassoSelectOptions = {}): CanvasInteractionDef {
-    return withReset(createLassoSelectInteraction(options), options.reset, SELECTION_RESET);
+    return asPreset('lasso-select', withReset(createLassoSelectInteraction(options), options.reset, SELECTION_RESET));
 }
 
 export function legendToggle(options: LegendToggleOptions = {}): CanvasInteractionDef {
-    return withReset(createLegendToggleInteraction(options), options.reset, NO_RESET);
+    return asPreset('legend-toggle', withReset(createLegendToggleInteraction(options), options.reset, NO_RESET));
 }
 
 export function contextActivate(options: ContextActivateOptions = {}): CanvasInteractionDef {
-    return createContextActivateInteraction(options);
+    return asPreset('context-activate', createC
```

**File**: `packages/flint-js/src/interactive/spec/registry.ts` (modified, +25/-32)
```diff
@@ -1,4 +1,4 @@
-import { INTERACTION_PRESET_TYPES, type InteractionPresetType } from '../../core/interaction-spec';
+import { INTERACTION_PRESET_TYPES, type InteractionCapability, type InteractionPresetType } from '../../core/interaction-spec';
 import {
     axisHighlight,
     brushAngle,
@@ -29,15 +29,7 @@ const ANY_RESET: readonly InteractionResetGesture[] = INTERACTION_RESET_GESTURES
 /** Presets that retain nothing have no reset to speak of. */
 const NEVER: readonly InteractionResetGesture[] = [];
 
-/** What a chart must expose for a preset to work; admission checks it against the compiled chart. */
-export type InteractionCapability =
-    | 'element-semantics'
-    | 'cartesian-region'
-    | 'angular-region'
-    | 'navigation'
-    | 'reorder'
-    | 'legend'
-    | 'discrete-axis';
+export type { InteractionCapability } from '../../core/interaction-spec';
 
 /** The gesture a preset captures; `drag` presets conflict with `navigate` when pan is on. */
 export type InteractionGestureFamily =
@@ -54,7 +46,8 @@ export interface InteractionPresetDefinition<T extends InteractionPresetType = I
     readonly type: T;
     readonly label: string;
     readonly description: string;
-    readonly requires: InteractionCapability;
+    /** Chart capabilities the preset needs; admission drops or throws when the chart lacks one. */
+    readonly requires: readonly InteractionCapability[];
     readonly gesture: InteractionGestureFamily;
     /** Options the factory needs but cannot default; the resolver reports a missing one by name. */
     readonly requiredOptions?: readonly (keyof InteractionPresetOptions[T] & string)[];
@@ -75,7 +68,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'click-highlight',
         label: 'Click highlight',
         description: 'Click a mark, legend item, or discrete axis label to emphasise it and mute the rest.',
-        requires: 'element-semantics',
+        requires: ['elements'],
         gesture: 'click',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -85,7 +78,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'axis-highlight',
         label: 'Axis highlight',
         description: 'Hover or click a discrete axis label to emphasise its category.',
-        requires: 'discrete-axis',
+        requires: ['discrete-axis'],
         gesture: 'click',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -95,7 +88,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'click-group-focus',
         label: 'Click group focus',
         description: 'Click a mark to emphasise every mark that shares its group.',
-        requires: 'element-semantics',
+        requires: ['elements'],
         gesture: 'click',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -105,7 +98,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'hover-group-focus',
         label: 'Hover group focus',
         description: 'Hover a mark to preview its group; leaving the mark restores the chart.',
-        requires: 'element-semantics',
+        requires: ['elements'],
         gesture: 'hover',
         requiredOptions: ['groupBy'],
         supportedReset: NEVER,
@@ -116,7 +109,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'click-annotate',
         label: 'Click annotate',
         description: 'Click a mark to pin an annotation on it.',
-        requires: 'element-semantics',
+        requires: ['elements'],
         gesture: 'click',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -126,7 +119,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'select',
         label: 'Rectangle select',
         description: 'Drag a rectangle to emphasise the marks inside it.',
-        requires: 'cartesian-region',
+        requires: ['elements', 'cartesian-region'],
         gesture: 'drag',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -136,7 +129,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'lasso-select',
         label: 'Lasso select',
         description: 'Draw a freehand region to emphasise the marks inside it.',
-        requires: 'cartesian-region',
+        requires: ['elements', 'cartesian-region'],
         gesture: 'drag',
         supportedReset: ANY_RESET,
         defaultReset: SELECTION_RESET,
@@ -146,7 +139,7 @@ export const INTERACTION_PRESETS: { readonly [T in InteractionPresetType]: Inter
         type: 'brush-x',
         label: 'Brush x',
         description: 'Drag an interval along x; a stateful brush stays editable after the drag.',
-        requires: 'cartesian-region',
+        requir
```

---

### Incident Patch 8: `d0ebb3ad` (2026-09-11)
**Commit Message**: feat(interactions): buildInteractiveChart reads interaction_spec

composeInteractiveOptions merges the spec with the code options: the
spec comes first, an id shared by both sources is an error, the code
wins on the surface policies, and a backend that runs no interactions
ignores the spec with one info warning. The surface exposes
surface.warnings, resolved after ready, and logs the list once.

**File**: `packages/flint-js/src/interactive/index.ts` (modified, +14/-12)
```diff
@@ -1,5 +1,6 @@
 import type { ChartAssemblyInput } from '../core/types';
-import { isCanvasInteraction, normalizeInteractions } from './interactions';
+import { isCanvasInteraction } from './interactions';
+import { composeInteractiveOptions } from './spec/compose';
 import { mountInteractiveChartSurface } from './surface';
 import type { BuildInteractiveChartOptions, InteractiveChartSurface } from './types';
 
@@ -151,20 +152,21 @@ export type {
     InteractionPresetSummary,
 } from './spec/registry';
 export { resolveInteractionSpec } from './spec/resolve';
-export type { ResolvedInteractionSpec } from './spec/resolve';
 export { admitInteractions } from './spec/admission';
+export { composeInteractiveOptions } from './spec/compose';
+export type { ComposedInteractiveOptions } from './spec/compose';
 export type { InteractionAdmission, InteractionAdmissionPlan } from './spec/admission';
+export type { ResolvedInteractionSpec } from './spec/resolve';
 
 export function buildInteractiveChart(
     container: HTMLElement,
     input: ChartAssemblyInput,
     options: BuildInteractiveChartOptions,
 ): InteractiveChartSurface {
-    const {
-        backend, renderer, expressionInterpreter, background,
-        className, ariaLabel, chartId, updates, assistedTargeting, keyboardTargeting, dismiss,
-    } = options;
-    const interactions = normalizeInteractions(options.interactions);
+    const { backend, renderer, expressionInterpreter, background, className, ariaLabel, chartId } = options;
+    // The spec and the code are two sources of one configuration; the spec comes first.
+    const { interactions, updates, assistedTargeting, keyboardTargeting, dismiss, warnings } =
+        composeInteractiveOptions(input, options);
     const canvasInteractions = interactions.filter(isCanvasInteraction);
     const hoverTolerance = Math.max(0, ...canvasInteractions
         .filter((interaction) => interaction.eventSource.gesture === 'hover')
@@ -178,7 +180,7 @@ export function buildInteractiveChart(
                     throw new Error(`Semantic interactions are not supported by backend "${backend}".`);
                 },
             },
-            { className, ariaLabel, chartId, updates },
+            { className, ariaLabel, chartId, updates, warnings },
         );
     }
     switch (backend) {
@@ -211,7 +213,7 @@ export function buildInteractiveChart(
                         }).mount(chartContainer, chartInput);
                     },
                 },
-                { className, ariaLabel, chartId, updates, interactions },
+                { className, ariaLabel, chartId, updates, interactions, warnings },
             );
         case 'echarts':
             return mountInteractiveChartSurface(
@@ -223,7 +225,7 @@ export function buildInteractiveChart(
                         return createEChartsInteractiveRenderer({ renderer }).mount(chartContainer, chartInput);
                     },
                 },
-                { className, ariaLabel, chartId, updates, interactions },
+                { className, ariaLabel, chartId, updates, interactions, warnings },
             );
         case 'chartjs':
             return mountInteractiveChartSurface(
@@ -235,7 +237,7 @@ export function buildInteractiveChart(
                         return createChartjsInteractiveRenderer().mount(chartContainer, chartInput);
                     },
                 },
-                { className, ariaLabel, chartId, updates, interactions },
+                { className, ariaLabel, chartId, updates, interactions, warnings },
             );
         case 'plotly':
             return mountInteractiveChartSurface(
@@ -247,7 +249,7 @@ export function buildInteractiveChart(
                         return createPlotlyInteractiveRenderer().mount(chartContainer, chartInput);
                     },
                 },
-                { className, ariaLabel, chartId, updates, interactions },
+                { className, ariaLabel, chartId, updates, interactions, warnings },
             );
     }
 }
\ No newline at end of file
```

**File**: `packages/flint-js/src/interactive/spec/compose.ts` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+import type { ChartUpdate } from '../../core/interaction-contracts';
+import type { ChartAssemblyInput, ChartWarning } from '../../core/types';
+import { normalizeInteractions, type InteractionDef } from '../interactions';
+import type { BuildInteractiveChartOptions } from '../types';
+import { resolveInteractionSpec } from './resolve';
+
+export interface ComposedInteractiveOptions {
+    /** Spec interactions first, then the code's, with no id shared between the two. */
+    readonly interactions: readonly InteractionDef[];
+    /** Spec updates first, then the code's. */
+    readonly updates: readonly ChartUpdate[];
+    readonly assistedTargeting: BuildInteractiveChartOptions['assistedTargeting'];
+    readonly keyboardTargeting: boolean | undefined;
+    readonly dismiss: BuildInteractiveChartOptions['dismiss'];
+    /** Warnings known before the mount, such as a spec a static backend ignores. */
+    readonly warnings: readonly ChartWarning[];
+}
+
+type ComposeInput = Pick<ChartAssemblyInput, 'interaction_spec'>;
+type ComposeOptions = Pick<
+    BuildInteractiveChartOptions,
+    'backend' | 'interactions' | 'updates' | 'assistedTargeting' | 'keyboardTargeting' | 'dismiss'
+>;
+
+/**
+ * Merge `input.interaction_spec` with what the code passed to `buildInteractiveChart()`.
+ *
+ * The spec comes first in every list. A code definition cannot replace a spec
+ * entry by reusing its id; the collision is an error that names both sources.
+ * The three surface policies come from the code when it sets them, `false`
+ * included, and from the spec otherwise. A backend that runs no interactions
+ * ignores the spec with one `info` warning, unless the code also asked for
+ * interactions, in which case the mount still fails as it does today.
+ */
+export function composeInteractiveOptions(input: ComposeInput, options: ComposeOptions): ComposedInteractiveOptions {
+    const resolved = resolveInteractionSpec(input.interaction_spec);
+    const code = options.interactions ?? [];
+    const warnings: ChartWarning[] = [];
+    let specInteractions = resolved.interactions;
+    let specUpdates = resolved.updates;
+    if (options.backend !== 'vegalite'
+        && code.length === 0
+        && (specInteractions.length > 0 || specUpdates.length > 0)) {
+        warnings.push({
+            severity: 'info',
+            code: 'interactions_ignored',
+            message: `interaction_spec is ignored: backend "${options.backend}" does not run interactions.`,
+        });
+        specInteractions = [];
+        specUpdates = [];
+    }
+    const codeIds = new Set(code.map((interaction) => interaction.id));
+    const shared = specInteractions.find((interaction) => codeIds.has(interaction.id));
+    if (shared) {
+        throw new Error(
+            `Interaction "${shared.id}" is defined in interaction_spec and in options.interactions. Give one of them another id.`,
+        );
+    }
+    return {
+        interactions: normalizeInteractions([...specInteractions, ...code]),
+        updates: [...specUpdates, ...(options.updates ?? [])],
+        assistedTargeting: options.assistedTargeting ?? resolved.surface.assistedTargeting,
+        keyboardTargeting: options.keyboardTargeting ?? resolved.surface.keyboardTargeting,
+        dismiss: options.dismiss ?? resolved.surface.dismiss,
+        warnings,
+    };
+}
```

**File**: `packages/flint-js/src/interactive/surface.ts` (modified, +11/-1)
```diff
@@ -1,4 +1,4 @@
-import type { CategoryViewport, ChartAssemblyInput } from '../core/types';
+import type { CategoryViewport, ChartAssemblyInput, ChartWarning } from '../core/types';
 import type {
     InteractiveChartSurface,
     InteractiveChartSurfaceOptions,
@@ -188,6 +188,7 @@ export function mountInteractiveChartSurface(
     let renderer: InteractiveRenderer | undefined;
     let updateTimer: number | undefined;
     let destroyed = false;
+    const warnings: ChartWarning[] = [...(options.warnings ?? [])];
 
     root.className = options.className ?? 'flint-interactive-surface';
     root.setAttribute('role', 'figure');
@@ -230,6 +231,14 @@ export function mountInteractiveChartSurface(
             return;
         }
         renderer = mounted;
+        warnings.push(...(mounted.warnings ?? []));
+        if (warnings.length > 0) {
+            // A host that never reads `surface.warnings` still learns what the chart dropped.
+            console.warn([
+                `[flint-chart] ${chartId}: ${warnings.length} interaction warning${warnings.length === 1 ? '' : 's'}`,
+                ...warnings.map((warning) => `  - ${warning.code}: ${warning.message}`),
+            ].join('\n'));
+        }
         if ((options.updates?.length ?? 0) > 0) {
             if (!mounted.setUpdates) throw new Error('This interactive backend does not support chart updates.');
             await mounted.setUpdates(options.updates ?? []);
@@ -266,6 +275,7 @@ export function mountInteractiveChartSurface(
         element: root,
         chartId,
         ready,
+        warnings: ready.then(() => warnings as readonly ChartWarning[], () => warnings as readonly ChartWarning[]),
         getViewportState: () => ({ ...state }),
         setViewport,
         dispatch: async (interactionId, payload) => {
```

**File**: `packages/flint-js/src/interactive/types.ts` (modified, +4/-0)
```diff
@@ -61,6 +61,8 @@ export interface InteractiveChartSurfaceOptions {
     keyboardTargeting?: boolean;
     /** How committed presentation and annotation state is cleared. */
     dismiss?: InteractionDismissPolicy | false;
+    /** Warnings known before the mount; the surface reports them with the mount's own. */
+    warnings?: readonly ChartWarning[];
 }
 
 export type InteractiveBackend = 'vegalite' | 'echarts' | 'chartjs' | 'plotly';
@@ -76,6 +78,8 @@ export interface InteractiveChartSurface {
     readonly element: HTMLElement;
     readonly chartId: string;
     readonly ready: Promise<void>;
+    /** Every warning about this chart's interactions, once the mount has settled. Never rejects. */
+    readonly warnings: Promise<readonly ChartWarning[]>;
     getViewportState(): ViewportState;
     setViewport(channel: ViewportChannel, start: number): void;
     dispatch(interactionId: string, payload: unknown): Promise<ChartUpdateResult | null>;
```

**File**: `packages/flint-js/tests/interaction-compose.test.ts` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+import { describe, expect, it } from 'vitest';
+import { composeInteractiveOptions } from '../src/interactive/spec/compose';
+import { clickHighlight, navigate, select, type CanvasInteractionDef } from '../src/interactive/interactions';
+import type { InteractionSpec } from '../src/core/interaction-spec';
+
+const SPEC: InteractionSpec = {
+    interactions: [{ type: 'legend-toggle' }, { type: 'navigate', options: { axes: 'x' } }],
+    updates: [{ id: 'seed', ops: [{ op: 'set-style', targets: [], value: { state: 'normal' } }] }],
+    dismiss: { escape: false },
+    keyboardTargeting: true,
+};
+const ids = (composed: { interactions: readonly { id: string }[] }): string[] =>
+    composed.interactions.map((interaction) => interaction.id);
+
+describe('composeInteractiveOptions', () => {
+    it('leaves a spec-less chart exactly as the code configured it', () => {
+        const composed = composeInteractiveOptions({}, {
+            backend: 'vegalite', interactions: [clickHighlight()], updates: [], dismiss: false,
+        });
+        expect(ids(composed)).toEqual(['click-highlight']);
+        expect(composed.updates).toEqual([]);
+        expect(composed.dismiss).toBe(false);
+        expect(composed.keyboardTargeting).toBeUndefined();
+        expect(composed.warnings).toEqual([]);
+    });
+
+    it('puts the spec before the code, for interactions and for updates', () => {
+        const codeUpdate = { id: 'host', ops: [] };
+        const composed = composeInteractiveOptions({ interaction_spec: SPEC }, {
+            backend: 'vegalite', interactions: [select()], updates: [codeUpdate],
+        });
+        expect(ids(composed)).toEqual(['legend-toggle', 'navigate', 'select']);
+        expect((composed.interactions[0] as CanvasInteractionDef).origin).toBe('spec');
+        expect((composed.interactions[2] as CanvasInteractionDef).origin).toBeUndefined();
+        expect(composed.updates.map((update) => update.id)).toEqual(['seed', 'host']);
+    });
+
+    it('rejects an id shared by the spec and the code, naming both sources', () => {
+        expect(() => composeInteractiveOptions({ interaction_spec: SPEC }, {
+            backend: 'vegalite', interactions: [navigate({ axes: 'y' })],
+        })).toThrow('Interaction "navigate" is defined in interaction_spec and in options.interactions. Give one of them another id.');
+    });
+
+    it('still rejects a duplicate inside the code list', () => {
+        expect(() => composeInteractiveOptions({}, {
+            backend: 'vegalite', interactions: [select(), select()],
+        })).toThrow(/Duplicate interaction id: "select"/);
+    });
+
+    it('lets the code win on the surface policies, false included', () => {
+        const fromSpec = composeInteractiveOptions({ interaction_spec: SPEC }, { backend: 'vegalite' });
+        expect(fromSpec.dismiss).toEqual({ escape: false });
+        expect(fromSpec.keyboardTargeting).toBe(true);
+        expect(fromSpec.assistedTargeting).toBeUndefined();
+        const fromCode = composeInteractiveOptions({ interaction_spec: SPEC }, {
+            backend: 'vegalite', dismiss: false, keyboardTargeting: false, assistedTargeting: { maxDistance: 4 },
+        });
+        expect(fromCode.dismiss).toBe(false);
+        expect(fromCode.keyboardTargeting).toBe(false);
+        expect(fromCode.assistedTargeting).toEqual({ maxDistance: 4 });
+    });
+
+    it('ignores the spec on a backend that runs no interactions, with one info warning', () => {
+        const composed = composeInteractiveOptions({ interaction_spec: SPEC }, { backend: 'echarts' });
+        expect(composed.interactions).toEqual([]);
+        expect(composed.updates).toEqual([]);
+        expect(composed.warnings).toEqual([{
+            severity: 'info',
+            code: 'interactions_ignored',
+            message: 'interaction_spec is ignored: backend "echarts" does not run interactions.',
+        }]);
+    });
+
+    it('keeps the code interactions on such a backend, so the mount fails as it does today', () => {
+        const composed = composeInteractiveOptions({ interaction_spec: SPEC }, {
+            backend: 'echarts', interactions: [clickHighlight()],
+        });
+        expect(ids(composed)).toEqual(['legend-toggle', 'navigate', 'click-highlight']);
+        expect(composed.warnings).toEqual([]);
+    });
+
+    it('does not warn for a backend that runs no interactions when the spec asks for none', () => {
+        const composed = composeInteractiveOptions({ interaction_spec: { interactions: [] } }, { backend: 'chartjs' });
+        expect(composed.interactions).toEqual([]);
+        expect(composed.warnings).toEqual([]);
+    });
+});
```

---

### Incident Patch 9: `9cbef95b` (2026-09-10)
**Commit Message**: fix bespoke demos

**File**: `site/src/playground/BespokeInteractionLab.tsx` (modified, +29/-9)
```diff
@@ -1,12 +1,13 @@
 import { FlintDimpVisStage } from './FlintDimpVisStage';
 import { ClimatePhaseStage } from './ClimatePhaseStage';
 import { FisheyeZoomStage } from './FisheyeZoomStage';
-import { ExplodedDetailStage } from './ExplodedDetailStage';
+import { FreeformExplodedDetailStage } from './ExplodedDetailStage';
 import { IndexChartStage } from './IndexChartStage';
 import { TimeboxStage } from './TimeboxStage';
 import { YouDrawItStage } from './YouDrawItStage';
 import { MapSemanticZoomStage } from './MapSemanticZoomStage';
 import { ChinaSemanticZoomStage } from './ChinaSemanticZoomStage';
+import { RetailDrilldownStage } from './RetailDrilldownStage';
 import './bespoke-interaction-lab.css';
 
 export function BespokeInteractionLab() {
@@ -81,7 +82,7 @@ export function BespokeInteractionLab() {
               </p>
               <div className="bespoke-pattern">
                 <strong>Flint in → custom out</strong>
-                <strong>Rendered SVG → custom out</strong>
+                <strong>Flint in → set-freeform-overlay</strong>
               </div>
             </div>
             <span className="bespoke-status">Case 04</span>
@@ -91,27 +92,28 @@ export function BespokeInteractionLab() {
               <FisheyeZoomStage />
             </section>
             <section className="bespoke-treatment">
-              <ExplodedDetailStage />
+              <FreeformExplodedDetailStage />
             </section>
           </div>
         </article>
 
         <article className="bespoke-case bespoke-case--single">
           <header className="bespoke-case-header">
             <div>
-              <h2>You draw it</h2>
+              <h2>Food basket price navigator</h2>
               <p>
-                Draw the future part of a line chart with a freehand stroke; the chart reveals the real
-                series and scores the guess.
+                Explore how five U.S. average food prices compose a one-unit basket over time. The wheel
+                narrows the month window, and Flint re-lays out the chart for the visible months, so the
+                bar step, the price domain, and the tick labels all follow the data.
               </p>
               <div className="bespoke-pattern">
-                <strong>Flint in → Flint out</strong>
-                <strong>Reveal: external in → Flint out</strong>
+                <strong>DOM wheel → filtered rows</strong>
+                <strong>Semantic zoom by re-layout</strong>
               </div>
             </div>
             <span className="bespoke-status">Case 05</span>
           </header>
-          <YouDrawItStage />
+          <RetailDrilldownStage />
         </article>
 
         <article className="bespoke-case bespoke-case--single">
@@ -170,6 +172,24 @@ export function BespokeInteractionLab() {
           </header>
           <ChinaSemanticZoomStage />
         </article>
+
+        <article className="bespoke-case bespoke-case--single">
+          <header className="bespoke-case-header">
+            <div>
+              <h2>You draw it</h2>
+              <p>
+                Draw the future part of a line chart with a freehand stroke; the chart reveals the real
+                series and scores the guess.
+              </p>
+              <div className="bespoke-pattern">
+                <strong>Flint in → Flint out</strong>
+                <strong>Reveal: external in → Flint out</strong>
+              </div>
+            </div>
+            <span className="bespoke-status">Case 09</span>
+          </header>
+          <YouDrawItStage />
+        </article>
       </div>
     </div>
   );
```

**File**: `site/src/playground/ExplodedDetailStage.tsx` (modified, +1/-194)
```diff
@@ -1,4 +1,4 @@
-import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
+import { useEffect, useRef } from 'react';
 import type { ChartAssemblyInput } from 'flint-chart';
 import {
   buildInteractiveChart,
@@ -16,12 +16,6 @@ const DETAIL_OFFSET = 220;
 const DETAIL_SCALE = DETAIL_RADIUS / FOCUS_RADIUS;
 const DETAIL_MIN_SCALE = 1;
 const DETAIL_MAX_SCALE = 3.4;
-/**
- * The lens radius the slider allows, in plot pixels. The bubble magnifies by
- * `DETAIL_RADIUS / lensRadius`, so the whole lens always fills the bubble:
- * the largest lens shows at 1×, the smallest at 4.5×.
- */
-const LENS_RADIUS_RANGE = { min: 24, max: DETAIL_RADIUS, step: 2 } as const;
 
 const ROWS = CLIMATE_CITIES.flatMap((city) => CLIMATE_MONTHS.map((month, monthIndex) => ({
   City: city.name,
@@ -189,193 +183,6 @@ function explodedGeometry(scene: VectorScene, focus: PlotPoint, scale = DETAIL_S
   return { center, focusRadius, points, labels: eccentricLabels(points, center, focus) };
 }
 
-function recordLatency(
-  samples: { current: number[] },
-  elapsed: number,
-  setLatency: (latency: number) => void,
-) {
-  samples.current.push(elapsed);
-  if (samples.current.length > 20) samples.current.shift();
-  if (samples.current.length % 5 === 0) {
-    setLatency(samples.current.reduce((sum, value) => sum + value, 0) / samples.current.length);
-  }
-}
-
-export function ExplodedDetailStage() {
-  const [active, setActive] = useState(false);
-  const [focus, setFocus] = useState<PlotPoint>({ x: 450, y: 260 });
-  const [lensRadius, setLensRadius] = useState(FOCUS_RADIUS);
-  const detailScale = DETAIL_RADIUS / lensRadius;
-  const [scene, setScene] = useState<VectorScene | null>(null);
-  const mountRef = useRef<HTMLDivElement>(null);
-  const sourceRef = useRef<SVGSVGElement | null>(null);
-  const sceneRef = useRef<VectorScene | null>(null);
-  const presentationStartedRef = useRef<number | null>(null);
-  const latencySamplesRef = useRef<number[]>([]);
-  const [latency, setLatency] = useState<number | null>(null);
-
-  const explosion = useMemo(() => {
-    return scene ? explodedGeometry(scene, focus, detailScale) : null;
-  }, [detailScale, focus, scene]);
-
-  useLayoutEffect(() => {
-    if (presentationStartedRef.current === null) return;
-    const elapsed = performance.now() - presentationStartedRef.current;
-    presentationStartedRef.current = null;
-    recordLatency(latencySamplesRef, elapsed, setLatency);
-  }, [focus]);
-
-  useEffect(() => {
-    const mount = mountRef.current;
-    if (!mount) return undefined;
-    const followPointer = (event: PointerEvent) => {
-      const source = sourceRef.current;
-      if (!source) return;
-      const point = toLocal(source, event.clientX, event.clientY);
-      if (!point) return;
-      presentationStartedRef.current = performance.now();
-      setFocus(point);
-      const plot = sceneRef.current?.plot;
-      setActive(Boolean(plot && point.x >= plot.left && point.x <= plot.right
-        && point.y >= plot.top && point.y <= plot.bottom));
-    };
-    const clear = () => setActive(false);
-    mount.addEventListener('pointermove', followPointer);
-    mount.addEventListener('pointerleave', clear);
-    const surface = buildInteractiveChart(mount, CHART_INPUT, {
-      backend: 'vegalite',
-      renderer: 'svg',
-      ariaLabel: 'Seasonal temperature profiles with exploded neighborhood detail',
-      chartId: 'exploded-detail-lines',
-    });
-    void surface.ready.then(() => {
-      sourceRef.current = mount.querySelector<SVGSVGElement>('figure svg') ?? mount.querySelector<SVGSVGElement>('svg');
-      const captured = captureScene(mount);
-      sceneRef.current = captured;
-      setScene(captured);
-    });
-    return () => {
-      mount.removeEventListener('pointermove', followPointer);
-      mount.removeEventListener('pointerleave', clear);
-      surface.destroy();
-    };
-  }, []);
-
-  return (
-    <div className="ic-flint-dimpvis-shell exploded-detail-shell">
-      <div className="ic-stage-meta">
-        <strong>Exploded neighborhood with eccentric labels</strong>
-        <span>
-          A small focus circle gathers nearby marks. A clipped SVG clone expands that exact local
-          scene in a separate bubble while labels route around the outside.
-        </span>
-      </div>
-      <div className="ic-toolbar">
-        <span className="ic-pill">DOM pointer event</span>
-        <span className="ic-pill">Cloned + clipped SVG</span>
-        <span className="ic-pill">Eccentric labels</span>
-        <span className="ic-pill">0 Flint updates</span>
-        <span className="ic-pill">React commit {latency === null ? '—' : `${latency.toFixed(1)} ms`}</span>
-        <label className="ic-pill exploded-detail-slider">
-          <span>Lens radius</span>
-          <input
-            type="range"
-            min={LENS_RADIUS_RANGE.min}
-            max={LENS_RADIUS_RANGE.max}
-            step={LENS_RADIUS_RANGE.step}

```

**File**: `site/src/playground/RetailDrilldownStage.tsx` (modified, +17/-7)
```diff
@@ -1,6 +1,7 @@
 import { useEffect, useRef, useState } from 'react';
 import type { ChartAssemblyInput } from 'flint-chart';
 import { buildInteractiveChart } from 'flint-chart/interactive';
+import { ScaleToFit } from '../components/ScaleToFit';
 import foodPrices from '../data/cpi-food-prices.json';
 import './retail-drilldown-stage.css';
 
@@ -28,7 +29,6 @@ const MONTH_COUNT = MONTHS.length;
 const MIN_VISIBLE_MONTHS = 6;
 
 function chartInput(rows: DrillRow[]): ChartAssemblyInput {
-
   return {
     data: { values: rows },
     semantic_types: {
@@ -44,12 +44,20 @@ function chartInput(rows: DrillRow[]): ChartAssemblyInput {
       title: 'What is driving the food basket?',
       subtitle: 'Monthly U.S. average prices for one unit of each item · BLS, Aug 2015–Aug 2025',
       encodings: { x: 'Month', y: 'Price', color: 'Food' },
-      baseSize: { width: 560, height: 400 },
-      canvasSize: { width: 560, height: 400 },
+      // Flint adds the title, subtitle, legend, and axes around this canvas; the
+      // rendered SVG lands at about 900 x 520, the size the other stages use.
+      baseSize: { width: 816, height: 416 },
+      canvasSize: { width: 816, height: 416 },
     },
   };
 }
 
+/**
+ * Semantic zoom by re-layout. Each wheel step picks a narrower month window,
+ * and Flint compiles a fresh chart for those rows: the bar step, the y domain,
+ * the tick density, and the label formats all follow the visible data. The new
+ * chart renders in a hidden layer and swaps in once it is ready.
+ */
 export function RetailDrilldownStage() {
   const mountRef = useRef<HTMLDivElement>(null);
   const activeSurfaceRef = useRef<{
@@ -139,10 +147,12 @@ export function RetailDrilldownStage() {
   }, []);
 
   return (
-    <div className="retail-drilldown-stage">
-      <div className="retail-drilldown-chart">
-        <div ref={mountRef} className="retail-drilldown-mount" />
+    <div className="ic-flint-dimpvis-shell retail-drilldown-stage">
+      <div className="ic-flint-dimpvis-panel">
+        <ScaleToFit height={540} minHeight={400} adaptiveHeight padding={8}>
+          <div ref={mountRef} className="ic-flint-dimpvis-mount retail-drilldown-mount" />
+        </ScaleToFit>
       </div>
     </div>
   );
-}
\ No newline at end of file
+}
```

**File**: `site/src/playground/exploded-detail-stage.css` (modified, +1/-33)
```diff
@@ -8,27 +8,14 @@
 
 .exploded-detail-stack {
   position: relative;
-  width: 900px;
+  width: max-content;
   min-height: 520px;
 }
 
 .exploded-detail-mount {
   min-height: 520px;
 }
 
-.exploded-detail-overlay {
-  position: absolute;
-  z-index: 3;
-  opacity: 0;
-  overflow: visible;
-  pointer-events: none;
-  transition: opacity 70ms linear;
-}
-
-.exploded-detail-overlay[data-visible='true'] {
-  opacity: 1;
-}
-
 .exploded-detail-focus {
   fill: none;
   stroke: #65747d;
@@ -77,22 +64,3 @@
   font-size: 10px;
   text-align: right;
 }
-
-.exploded-detail-slider {
-  display: inline-flex;
-  align-items: center;
-  gap: 8px;
-  cursor: default;
-}
-
-.exploded-detail-slider input[type='range'] {
-  width: 120px;
-  margin: 0;
-  accent-color: #2f5f47;
-}
-
-.exploded-detail-slider-value {
-  min-width: 84px;
-  color: #2f5f47;
-  font-variant-numeric: tabular-nums;
-}
```

**File**: `site/src/playground/fisheye-zoom-stage.css` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 .fisheye-chart-stack {
   position: relative;
-  width: 900px;
+  width: max-content;
   min-height: 520px;
 }
 
```

**File**: `site/src/playground/index-chart-stage.css` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 
 .index-chart-stack {
   position: relative;
-  width: 900px;
+  width: max-content;
   min-height: 520px;
 }
 
```

**File**: `site/src/playground/retail-drilldown-stage.css` (modified, +7/-14)
```diff
@@ -1,18 +1,11 @@
-.retail-drilldown-stage {
-  padding: 18px;
-}
-
-.retail-drilldown-chart {
-  overflow: hidden;
-  overscroll-behavior: contain;
-}
-
 .retail-drilldown-mount {
-  position: relative;
-  height: 500px;
+  display: grid;
+  width: max-content;
+  min-height: 520px;
+  overscroll-behavior: contain;
 }
 
+/* Layers stack in one grid cell so the mount follows the chart while a swap is pending. */
 .retail-drilldown-layer {
-  position: absolute;
-  inset: 0 auto auto 0;
-}
\ No newline at end of file
+  grid-area: 1 / 1;
+}
```

---

### Incident Patch 10: `86aeeb34` (2026-09-09)
**Commit Message**: Merge pull request #120 from microsoft/fix/map-test-typecheck

fix(tests): repair type errors in map test files

**File**: `packages/flint-js/tests/map-levels.test.ts` (modified, +1/-1)
```diff
@@ -246,7 +246,7 @@ describe('point in region', () => {
         expect(geometryContainsPoint(withHole, [12, 5])).toBe(false);
         const two = { type: 'MultiPolygon', coordinates: [withHole.coordinates, [[[20, 0], [30, 0], [30, 10], [20, 10], [20, 0]]]] };
         expect(geometryContainsPoint(two, [25, 5])).toBe(true);
-        expect(geometryContainsPoint(two, [15, 5])).toBe(true === false);
+        expect(geometryContainsPoint(two, [15, 5])).toBe(false);
         expect(geometryContainsPoint({ type: 'Point', coordinates: [1, 1] }, [1, 1])).toBe(false);
     });
 
```

**File**: `packages/flint-js/tests/map-navigation.test.ts` (modified, +1/-1)
```diff
@@ -193,7 +193,7 @@ describe('geo navigation controller', () => {
         expect(zoomEast).toBeLessThan(fullLon + 1e-6);
 
         const pan = controller.resolve({
-            type: 'navigation', phase: 'move', operation: 'pan', axes: 'xy',
+            type: 'navigation', phase: 'preview', operation: 'pan', axes: 'xy',
             delta: { x: 0.1, y: 0 },
         }, GUARD)!;
         controller.apply(pan);
```

---

### Incident Patch 11: `46553afd` (2026-09-09)
**Commit Message**: fix(tests): repair type errors in map test files

- map-levels: replace the literal comparison `true === false` with `false`
- map-navigation: use the `preview` phase for the in-progress pan request;
  `move` is not a member of InteractionPhase

The CI typecheck step failed on dev after #119; vitest did not catch these
because it does not check types.

**File**: `packages/flint-js/tests/map-levels.test.ts` (modified, +1/-1)
```diff
@@ -246,7 +246,7 @@ describe('point in region', () => {
         expect(geometryContainsPoint(withHole, [12, 5])).toBe(false);
         const two = { type: 'MultiPolygon', coordinates: [withHole.coordinates, [[[20, 0], [30, 0], [30, 10], [20, 10], [20, 0]]]] };
         expect(geometryContainsPoint(two, [25, 5])).toBe(true);
-        expect(geometryContainsPoint(two, [15, 5])).toBe(true === false);
+        expect(geometryContainsPoint(two, [15, 5])).toBe(false);
         expect(geometryContainsPoint({ type: 'Point', coordinates: [1, 1] }, [1, 1])).toBe(false);
     });
 
```

**File**: `packages/flint-js/tests/map-navigation.test.ts` (modified, +1/-1)
```diff
@@ -193,7 +193,7 @@ describe('geo navigation controller', () => {
         expect(zoomEast).toBeLessThan(fullLon + 1e-6);
 
         const pan = controller.resolve({
-            type: 'navigation', phase: 'move', operation: 'pan', axes: 'xy',
+            type: 'navigation', phase: 'preview', operation: 'pan', axes: 'xy',
             delta: { x: 0.1, y: 0 },
         }, GUARD)!;
         controller.apply(pan);
```

---

### Incident Patch 12: `ae822271` (2026-09-07)
**Commit Message**: fix(interactions): let the dismiss policy govern Escape in the region gesture

Escape outside a drag cleared the region gesture's retained selection
even when the surface was mounted with `dismiss: false`, so a chart that
keeps state in retained set-style ops lost it on that key. The gesture
takes an `escapeClears` option and the runtime passes the dismiss
policy's escape flag. Default charts keep their behaviour.

**File**: `packages/flint-js/src/vegalite/interactions/gestures/region.ts` (modified, +4/-0)
```diff
@@ -55,6 +55,8 @@ export interface VegaRegionGestureOptions {
     setSuppressClick(suppress: boolean): void;
     setDragging(dragging: boolean): void;
     resetViewport?(): void;
+    /** Escape outside a drag clears the retained selection. Defaults to true; the dismiss policy can turn it off. */
+    escapeClears?: boolean;
 }
 
 export interface VegaRegionGestureController {
@@ -604,6 +606,8 @@ export function mountVegaRegionGesture(options: VegaRegionGestureOptions): VegaR
     };
     const keyDown = (event: KeyboardEvent): void => {
         if (event.key !== 'Escape') return;
+        // Outside a drag, Escape is a dismiss gesture; honour a policy that disables it.
+        if (!dragStart && options.escapeClears === false) return;
         if (interaction.eventSource.viewport) resetViewport?.();
         if (dragStart) {
             setSelected(new Set(committed));
```

**File**: `packages/flint-js/src/vegalite/interactions/runtime.ts` (modified, +1/-0)
```diff
@@ -2235,6 +2235,7 @@ export function mountVegaInteractions(
         setSuppressClick: (suppress) => { suppressClick = suppress; },
         setDragging: (dragging) => { regionDragging = dragging; },
         resetViewport: resetViewportRegion,
+        escapeClears: dismissPolicy.escape,
     }) : undefined;
     const navigationGesture = navigationInteraction ? mountVegaNavigationGesture({
         container,
```

---

### Incident Patch 13: `25365780` (2026-09-07)
**Commit Message**: fix(interactions): path segment, per-key style, overlay

Three fixes that surfaced while a line chart hid a series by selector
and drew overlays on a temporal axis:

- A path's terminal vertex only ever appeared as a segment end, so it
  owned no render key and survived a hide as a zero-length stub. The
  last segment now carries that key too.
- A path resolved by selector carries its first vertex under the
  `|__flint_path` key while the rendered item keeps the plain row key,
  and Vega paints a whole line from its first item, so opacity and
  stroke styles on lines never applied. The runtime now writes the
  style under both spellings.
- orderedOverlayRows sorted Date order fields as strings, so a line
  overlay on a temporal axis zigzagged. Dates now order by time.

**File**: `packages/flint-js/src/core/interaction-semantics.ts` (modified, +9/-1)
```diff
@@ -102,17 +102,25 @@ export function sourceRecordsForRenderedRecords(
 
 export function elementsFromHits(hits: readonly RenderHit[], keyField: string): SemanticElement[] {
     const seen = new Set<string>();
+    const startKeys = new Set(hits
+        .map((hit) => hit.datum[keyField])
+        .filter((key): key is string => typeof key === 'string'));
     const elements: SemanticElement[] = [];
     for (const hit of hits) {
         const key = hit.datum[keyField];
         if (typeof key !== 'string' || seen.has(key)) continue;
         seen.add(key);
         const records = (hit.endDatum ? [hit.datum, hit.endDatum] : [hit.datum])
             .map((datum) => withoutRenderIdentity(datum, keyField));
+        // A path's final vertex only ever appears as a segment end, so the
+        // last segment carries its key too; otherwise hiding the path would
+        // strand that vertex as a zero-length stub.
+        const endKey = hit.endDatum?.[keyField];
+        const renderKeys = typeof endKey === 'string' && !startKeys.has(endKey) ? [key, endKey] : [key];
         elements.push(associateSemanticElementRenderKeys({
             value: withoutRenderIdentity(hit.datum, keyField),
             records,
-        }, [key]));
+        }, renderKeys));
     }
     return elements;
 }
```

**File**: `packages/flint-js/src/vegalite/interactions/presentation/data-overlay.ts` (modified, +7/-4)
```diff
@@ -25,11 +25,14 @@ export function orderedOverlayRows(spec: ChartOverlaySpec): readonly Record<stri
     const rows = [...spec.data.values];
     const field = spec.encodings.order?.field;
     if (!field) return rows;
+    // Dates order by time, not by their string form.
+    const ordinal = (value: unknown): number | undefined =>
+        typeof value === 'number' ? value : value instanceof Date ? value.getTime() : undefined;
     return rows.sort((left, right) => {
-        const a = left[field];
-        const b = right[field];
-        if (typeof a === 'number' && typeof b === 'number') return a - b;
-        return String(a ?? '').localeCompare(String(b ?? ''));
+        const a = ordinal(left[field]);
+        const b = ordinal(right[field]);
+        if (a !== undefined && b !== undefined) return a - b;
+        return String(left[field] ?? '').localeCompare(String(right[field] ?? ''));
     });
 }
 
```

**File**: `packages/flint-js/src/vegalite/interactions/runtime.ts` (modified, +9/-2)
```diff
@@ -1029,8 +1029,15 @@ export function mountVegaInteractions(
                                         .filter((channel) => op.value[channel] !== undefined)
                                         .map((channel) => [channel, op.value[channel]]),
                                 );
-                                if (Object.keys(style).length > 0) {
-                                    stylesByKey[key] = { ...stylesByKey[key], ...style };
+                                if (Object.keys(style).length === 0) continue;
+                                // A path's first vertex resolves under the path key, but the
+                                // rendered item keeps the plain row key, and Vega styles a
+                                // whole line from that first item. Style both spellings.
+                                const styleKeys = key.endsWith(PATH_KEY_SUFFIX)
+                                    ? [key, key.slice(0, -PATH_KEY_SUFFIX.length)]
+                                    : [key];
+                                for (const styleKey of styleKeys) {
+                                    stylesByKey[styleKey] = { ...stylesByKey[styleKey], ...style };
                                 }
                             }
                         }
```

**File**: `packages/flint-js/tests/data-overlay.test.ts` (modified, +16/-0)
```diff
@@ -6,6 +6,22 @@ import type { ChartOverlaySpec } from '../src/interactive/language/updates';
 import { orderedOverlayRows, projectPointToPath } from '../src/vegalite/interactions/presentation/data-overlay';
 
 describe('retained data overlays', () => {
+    it('orders a path by time when the order field holds dates', () => {
+        const values = [
+            { Year: new Date(Date.UTC(2016, 0, 1)), x: 3, y: 4 },
+            { Year: new Date(Date.UTC(2013, 6, 1)), x: 1, y: 2 },
+            { Year: new Date(Date.UTC(2014, 0, 1)), x: 2, y: 3 },
+        ];
+        const spec: ChartOverlaySpec = {
+            mark: 'line',
+            data: { values },
+            encodings: { x: { field: 'x' }, y: { field: 'y' }, order: { field: 'Year' } },
+            role: 'drawn-line',
+        };
+
+        expect(orderedOverlayRows(spec).map((row) => row.x)).toEqual([1, 2, 3]);
+    });
+
     it('orders a path without mutating application rows', () => {
         const values = [
             { Year: 2000, x: 3, y: 4 },
```

**File**: `packages/flint-js/tests/semantic-interactions.test.ts` (modified, +28/-0)
```diff
@@ -7,6 +7,7 @@ import type { CanvasInteractionDef, ClickHighlightOptions, RenderHit, SemanticEl
 import { dragTrigger } from '../src/interactive/triggers';
 import {
     associateSemanticElementRenderKeys,
+    elementsFromHits,
     MUTED_HOVER_FILL,
     MUTED_HOVER_STROKE,
     legendMatchedHits,
@@ -4187,3 +4188,30 @@ describe('set-style visibility', () => {
         view.finalize();
     });
 });
+
+describe('elementsFromHits', () => {
+    const key = '__flint_interaction_key';
+    const row = (year: number, id: string) => ({ Year: year, Share: year - 2000, Segment: 'Hidden', [key]: id });
+
+    it('gives the terminal vertex of a path to the last segment', () => {
+        const hits: RenderHit[] = [
+            { datum: row(2012, 'a'), endDatum: row(2013, 'b'), source: 'mark', markType: 'line' },
+            { datum: row(2013, 'b'), endDatum: row(2014, 'c'), source: 'mark', markType: 'line' },
+        ];
+        const elements = elementsFromHits(hits, key);
+        expect(elements).toHaveLength(2);
+        expect(semanticElementRenderKeys(elements[0])).toEqual(['a']);
+        expect(semanticElementRenderKeys(elements[1])).toEqual(['b', 'c']);
+        expect(elements[1].value).toEqual({ Year: 2013, Share: 13, Segment: 'Hidden' });
+    });
+
+    it('keeps one key per element when every vertex starts a segment', () => {
+        const hits: RenderHit[] = [
+            { datum: row(2012, 'a'), endDatum: row(2013, 'b'), source: 'mark', markType: 'line' },
+            { datum: row(2013, 'b'), endDatum: row(2012, 'a'), source: 'mark', markType: 'line' },
+            { datum: row(2020, 'z'), source: 'mark', markType: 'symbol' },
+        ];
+        const elements = elementsFromHits(hits, key);
+        expect(elements.map((element) => semanticElementRenderKeys(element))).toEqual([['a'], ['b'], ['z']]);
+    });
+});
```

---

### Incident Patch 14: `8f15a48c` (2026-09-05)
**Commit Message**: fix(interactions): capture the pointer only once a drag begins

Region and navigation gestures captured the pointer on pointerdown, which
redirected the following click to the container. A plain click on a mark,
a legend entry, or an axis label then never reached the renderer whenever a
select, lasso, brush, or pan gesture was mounted on the same chart. Both
gestures now capture once the pointer has moved into a real drag.

**File**: `packages/flint-js/src/vegalite/interactions/gestures/navigation.ts` (modified, +8/-1)
```diff
@@ -107,7 +107,6 @@ export function mountVegaNavigationGesture(
         dragged = false;
         setDragging(true);
         container.style.cursor = 'grabbing';
-        container.setPointerCapture(event.pointerId);
         emit({
             type: 'navigation', phase: 'start', operation: 'pan', axes,
             modifiers: interactionModifiers(event),
@@ -132,6 +131,14 @@ export function mountVegaNavigationGesture(
         const delta = session.move(localPoint(event));
         pendingDelta = { x: pendingDelta.x + delta.x, y: pendingDelta.y + delta.y };
         if (session.dragDistance() < 4) return;
+        if (!dragged && !container.hasPointerCapture(event.pointerId)) {
+            // Capture only once this is a real pan, so a plain click still reaches the marks.
+            try {
+                container.setPointerCapture(event.pointerId);
+            } catch {
+                // Synthetic pointer events have no active pointer to capture.
+            }
+        }
         dragged = true;
         setSuppressClick(true);
         emit({
```

**File**: `packages/flint-js/src/vegalite/interactions/gestures/region.ts` (modified, +17/-5)
```diff
@@ -425,7 +425,19 @@ export function mountVegaRegionGesture(options: VegaRegionGestureOptions): VegaR
         pointerId = event.pointerId;
         committed = new Set(getSelected());
         setDragging(true);
-        container.setPointerCapture(event.pointerId);
+    };
+    // Capture only once the pointer has actually moved into a drag. Capturing on
+    // pointerdown would redirect the following click to the container, so a plain
+    // click on a mark, legend entry, or axis label would never reach the renderer.
+    const beginDragCapture = (event: PointerEvent): void => {
+        setSuppressClick(true);
+        if (!container.hasPointerCapture(event.pointerId)) {
+            try {
+                container.setPointerCapture(event.pointerId);
+            } catch {
+                // Synthetic pointer events have no active pointer to capture.
+            }
+        }
     };
     const pointerMove = (event: PointerEvent): void => {
         if (!dragStart || pointerId !== event.pointerId) {
@@ -458,7 +470,7 @@ export function mountVegaRegionGesture(options: VegaRegionGestureOptions): VegaR
             if (last && Math.hypot(point.x - last.x, point.y - last.y) < 2) return;
             lassoPoints.push(point);
             if (lassoPoints.length < 3) return;
-            setSuppressClick(true);
+            beginDragCapture(event);
             showLasso(lassoPoints);
             dispatchLasso('preview', lassoPoints, event);
             return;
@@ -467,21 +479,21 @@ export function mountVegaRegionGesture(options: VegaRegionGestureOptions): VegaR
             if (initialSector && angularSession) {
                 const edited = sectorForEdit(polarPointerAngle(point, angularSession.frame));
                 if (!edited) return;
-                setSuppressClick(true);
+                beginDragCapture(event);
                 showAngularSector(edited);
                 dispatchAngularRegion('preview', edited, event, angularAction);
                 return;
             }
             angularSession?.move(point);
             if (!angularSession || angularSession.dragDistance() < 4) return;
-            setSuppressClick(true);
+            beginDragCapture(event);
             const sector = angularSession.sector();
             showAngularSector(sector);
             dispatchAngularRegion('preview', sector, event);
             return;
         }
         if (cartesianDragDistance(dragStart, point, regionAxis) < 4) return;
-        setSuppressClick(true);
+        beginDragCapture(event);
         const interval = regionAxis === 'xy' ? undefined : intervalForDrag(point);
         const points = interval ? intervalPoints(interval, intervalAxis()) : { start: dragStart, end: point };
         if (interval) showInterval(interval);
```

---

### Incident Patch 15: `fe73f759` (2026-09-04)
**Commit Message**: Merge pull request #115 from microsoft/fix/powerbi-histogram-bars

Fix/powerbi histogram bars

**File**: `packages/flint-js/src/vegalite/theme.ts` (modified, +8/-0)
```diff
@@ -2010,6 +2010,14 @@ function applyMarks(spec: any, d: DesignDecisions, table: any[], say: (p: string
             if (isLiteralMark(node)) return;
             const enc = node.encoding ?? {};
             if (isGridCell(node, enc)) return;
+            if (enc.x2 != null || enc.y2 != null) {
+                // Ranged bars such as histogram bins are authored with a start
+                // and end position. Rounding only the value end can collapse
+                // them into zero-width paths once interactive instrumentation
+                // wraps the marks, so keep these bars square.
+                node.mark = { ...normalizeMark(node.mark), cornerRadiusEnd: 0 };
+                return;
+            }
             const barW = estimateBarExtent(node, enc, table, plotWidth, plotHeight);
             const capped = Math.round(barW * MAX_CORNER_FRACTION * 10) / 10;
             if (capped >= m.cornerRadius!) return;
```

**File**: `packages/flint-js/tests/semantic-interactions.test.ts` (modified, +23/-0)
```diff
@@ -327,6 +327,29 @@ describe('Vega-Lite semantic interactions', () => {
         view.finalize();
     });
 
+    it('keeps interactive Power BI histogram bins non-zero in width', async () => {
+        const spec = assembleVegaLite({
+            data: {
+                values: [1.7, 1.9, 2.1, 2.4, 3.1, 3.4, 3.8, 4.2, 4.6].map((duration) => ({
+                    'Duration (min)': duration,
+                })),
+            },
+            semantic_types: { 'Duration (min)': 'Quantity' },
+            chart_spec: { chartType: 'Histogram', encodings: { x: 'Duration (min)' } },
+            theme_spec: 'powerbi',
+        } as never) as any;
+        const { compiled } = instrument(spec, [clickMark()]);
+        const view = new View(parse(compiled), { renderer: 'none' });
+        await view.runAsync();
+        const bars = sceneItems(view)
+            .filter((item) => item.mark.marktype === 'rect' && item.datum[INTERACTION_KEY]);
+        expect(bars.length).toBeGreaterThan(1);
+        for (const bar of bars) {
+            expect(bar.bounds.x2).toBeGreaterThan(bar.bounds.x1);
+        }
+        view.finalize();
+    });
+
     it('inspect-x chooses one stacked category and returns all of its segments', async () => {
         const spec = assembleVegaLite({
             data: { values: [
```

**File**: `packages/flint-js/tests/theme-presets.test.ts` (modified, +17/-0)
```diff
@@ -317,6 +317,23 @@ describe('cartoon mark character', () => {
         expect(JSON.stringify(thin._theme?.report ?? [])).toContain('round the bar away');
     });
 
+    it('keeps ranged histogram bars square under Power BI', () => {
+        const spec = assembleVegaLite({
+            data: {
+                values: [1.7, 1.9, 2.1, 2.4, 3.1, 3.4, 3.8, 4.2, 4.6].map((duration) => ({
+                    'Duration (min)': duration,
+                })),
+            },
+            semantic_types: { 'Duration (min)': 'Quantity' },
+            chart_spec: { chartType: 'Histogram', encodings: { x: 'Duration (min)' } },
+            theme_spec: THEME_PRESETS.powerbi.spec,
+        } as any) as any;
+
+        const barMark = (spec.layer ?? [spec]).find((l: any) => markTypeOf(l.mark) === 'bar')?.mark;
+        expect(spec.config.bar.cornerRadiusEnd).toBe(3);
+        expect(barMark?.cornerRadiusEnd).toBe(0);
+    });
+
     it('keeps a crowded trajectory in the lab dot-to-line proportion', () => {
         const diameter = (size: number) => 2 * Math.sqrt(size / Math.PI);
         const ratioOf = (spec: any) => {
```

**File**: `site/src/data/index-chart-stocks.ts` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+export interface IndexChartStockRow {
+  Symbol: 'AAPL' | 'AMZN' | 'GOOG' | 'IBM' | 'MSFT';
+  Date: string;
+  Close: number;
+}
+
+// Sampled from the D3/Vega index chart reference dataset.
+// A few rows are intentionally omitted so the prototype exercises
+// nearest-date fallback when a symbol lacks the active reference date.
+export const INDEX_CHART_STOCKS: IndexChartStockRow[] = [
+  { Symbol: 'AAPL', Date: '2013-05-13', Close: 64.9629 },
+  { Symbol: 'AAPL', Date: '2013-11-08', Close: 74.3657 },
+  { Symbol: 'AAPL', Date: '2014-05-13', Close: 84.8229 },
+  { Symbol: 'AAPL', Date: '2014-11-10', Close: 108.83 },
+  { Symbol: 'AAPL', Date: '2015-05-13', Close: 126.01 },
+  { Symbol: 'AAPL', Date: '2015-11-10', Close: 116.77 },
+  { Symbol: 'AAPL', Date: '2016-05-12', Close: 90.34 },
+  { Symbol: 'AAPL', Date: '2016-11-09', Close: 110.88 },
+  { Symbol: 'AAPL', Date: '2017-05-12', Close: 156.1 },
+  { Symbol: 'AAPL', Date: '2017-11-09', Close: 175.88 },
+
+  { Symbol: 'AMZN', Date: '2013-05-13', Close: 264.51 },
+  { Symbol: 'AMZN', Date: '2013-11-08', Close: 350.31 },
+  { Symbol: 'AMZN', Date: '2014-05-13', Close: 304.64 },
+  { Symbol: 'AMZN', Date: '2014-11-10', Close: 305.11 },
+  { Symbol: 'AMZN', Date: '2015-05-13', Close: 426.87 },
+  { Symbol: 'AMZN', Date: '2015-11-10', Close: 659.68 },
+  { Symbol: 'AMZN', Date: '2016-05-12', Close: 717.93 },
+  { Symbol: 'AMZN', Date: '2016-11-09', Close: 771.88 },
+  { Symbol: 'AMZN', Date: '2017-05-12', Close: 961.35 },
+  { Symbol: 'AMZN', Date: '2017-11-09', Close: 1129.13 },
+
+  { Symbol: 'GOOG', Date: '2013-05-13', Close: 435.9297 },
+  { Symbol: 'GOOG', Date: '2013-11-08', Close: 504.7322 },
+  { Symbol: 'GOOG', Date: '2014-05-13', Close: 530.1748 },
+  { Symbol: 'GOOG', Date: '2014-11-10', Close: 544.4961 },
+  { Symbol: 'GOOG', Date: '2015-11-10', Close: 728.32 },
+  { Symbol: 'GOOG', Date: '2016-05-12', Close: 713.31 },
+  { Symbol: 'GOOG', Date: '2016-11-09', Close: 785.31 },
+  { Symbol: 'GOOG', Date: '2017-05-12', Close: 932.22 },
+  { Symbol: 'GOOG', Date: '2017-11-09', Close: 1031.26 },
+
+  { Symbol: 'IBM', Date: '2013-05-13', Close: 202.47 },
+  { Symbol: 'IBM', Date: '2013-11-08', Close: 179.99 },
+  { Symbol: 'IBM', Date: '2014-05-13', Close: 192.19 },
+  { Symbol: 'IBM', Date: '2014-11-10', Close: 163.49 },
+  { Symbol: 'IBM', Date: '2015-05-13', Close: 172.28 },
+  { Symbol: 'IBM', Date: '2015-11-10', Close: 135.47 },
+  { Symbol: 'IBM', Date: '2016-05-12', Close: 148.84 },
+  { Symbol: 'IBM', Date: '2017-05-12', Close: 150.37 },
+  { Symbol: 'IBM', Date: '2017-11-09', Close: 150.3 },
+
+  { Symbol: 'MSFT', Date: '2013-05-13', Close: 33.03 },
+  { Symbol: 'MSFT', Date: '2013-11-08', Close: 37.78 },
+  { Symbol: 'MSFT', Date: '2014-05-13', Close: 40.42 },
+  { Symbol: 'MSFT', Date: '2014-11-10', Close: 48.89 },
+  { Symbol: 'MSFT', Date: '2015-05-13', Close: 47.63 },
+  { Symbol: 'MSFT', Date: '2015-11-10', Close: 53.51 },
+  { Symbol: 'MSFT', Date: '2016-05-12', Close: 51.51 },
+  { Symbol: 'MSFT', Date: '2016-11-09', Close: 60.17 },
+  { Symbol: 'MSFT', Date: '2017-05-12', Close: 68.38 },
+  { Symbol: 'MSFT', Date: '2017-11-09', Close: 84.09 },
+];
```

**File**: `site/src/playground/BespokeInteractionLab.tsx` (modified, +23/-19)
```diff
@@ -1,8 +1,8 @@
 import { FlintDimpVisStage } from './FlintDimpVisStage';
 import { ClimatePhaseStage } from './ClimatePhaseStage';
 import { FisheyeZoomStage } from './FisheyeZoomStage';
-import { ExplodedDetailStage, FreeformExplodedDetailStage } from './ExplodedDetailStage';
-import { RetailDrilldownStage } from './RetailDrilldownStage';
+import { ExplodedDetailStage } from './ExplodedDetailStage';
+import { IndexChartStage } from './IndexChartStage';
 import './bespoke-interaction-lab.css';
 
 export function BespokeInteractionLab() {
@@ -28,6 +28,7 @@ export function BespokeInteractionLab() {
                 <strong>Flint in → Flint out</strong>
               </div>
             </div>
+            <span className="bespoke-status">Case 01</span>
           </header>
           <FlintDimpVisStage large />
         </article>
@@ -44,10 +45,29 @@ export function BespokeInteractionLab() {
                 <strong>Animation: external in → Flint out</strong>
               </div>
             </div>
+            <span className="bespoke-status">Case 02</span>
           </header>
           <ClimatePhaseStage />
         </article>
 
+        <article className="bespoke-case bespoke-case--single">
+          <header className="bespoke-case-header">
+            <div>
+              <h2>Index chart with host-owned reference cursor</h2>
+              <p>
+                Re-index the same stock series against a movable date while the overlay owns pointer acquisition
+                and the active reference marker.
+              </p>
+              <div className="bespoke-pattern">
+                <strong>Flint in → Flint out</strong>
+                <strong>Host overlay → custom out</strong>
+              </div>
+            </div>
+            <span className="bespoke-status">Case 03</span>
+          </header>
+          <IndexChartStage />
+        </article>
+
         <article className="bespoke-case">
           <header className="bespoke-case-header">
             <div>
@@ -60,6 +80,7 @@ export function BespokeInteractionLab() {
                 <strong>Rendered SVG → custom out</strong>
               </div>
             </div>
+            <span className="bespoke-status">Case 04</span>
           </header>
           <div className="bespoke-treatment-stack">
             <section className="bespoke-treatment">
@@ -68,26 +89,9 @@ export function BespokeInteractionLab() {
             <section className="bespoke-treatment">
               <ExplodedDetailStage />
             </section>
-            <section className="bespoke-treatment">
-              <FreeformExplodedDetailStage />
-            </section>
           </div>
         </article>
 
-        <article className="bespoke-case bespoke-case--single">
-          <header className="bespoke-case-header">
-            <div>
-              <h2>Food basket price navigator</h2>
-              <p>
-                Explore how five U.S. average food prices compose a one-unit basket over time.
-              </p>
-              <div className="bespoke-pattern">
-                <strong>Flint in → temporal window</strong>
-              </div>
-            </div>
-          </header>
-          <RetailDrilldownStage />
-        </article>
       </div>
     </div>
   );
```

**File**: `site/src/playground/IndexChartStage.tsx` (added, +263/-0)
```diff
@@ -0,0 +1,263 @@
+import { useEffect, useMemo, useRef, useState } from 'react';
+import { scaleLinear, scaleUtc } from 'd3';
+import type { ChartAssemblyInput } from 'flint-chart';
+import {
+  buildInteractiveChart,
+  inspectIndex,
+  type FlintInteractionEventDetail,
+  type InteractiveChartSurface,
+} from 'flint-chart/interactive';
+import { ScaleToFit } from '../components/ScaleToFit';
+import { INDEX_CHART_STOCKS } from '../data/index-chart-stocks';
+import {
+  deriveIndexChartState,
+  clampDateToPreparedDomain,
+  prepareIndexChartData,
+} from './index-chart-model';
+import './index-chart-stage.css';
+
+const VIEW_WIDTH = 900;
+const VIEW_HEIGHT = 520;
+const FALLBACK_PLOT_BOUNDS = { left: 63, right: 760, top: 26, bottom: 474 };
+const DATA_UPDATE_ID = 'index-chart-data';
+const INSPECT_INTERACTION_ID = 'index-chart-inspect';
+const PREPARED = prepareIndexChartData(INDEX_CHART_STOCKS);
+const INITIAL_ACTIVE_DATE = new Date('2015-05-13T00:00:00Z');
+
+function xScaleForBounds(bounds: { left: number; right: number }) {
+  return scaleUtc()
+    .domain([PREPARED.minDate, PREPARED.maxDate])
+    .range([bounds.left, bounds.right])
+    .clamp(true);
+}
+
+function chartInput(rows: ReturnType<typeof deriveIndexChartState>['indexedRows']): ChartAssemblyInput {
+  return {
+    data: { values: rows },
+    semantic_types: {
+      Date: 'Date',
+      Symbol: 'Category',
+      IndexedReturn: {
+        semanticType: 'Quantity',
+        intrinsicDomain: PREPARED.returnDomain,
+      },
+    },
+    field_display_names: {
+      IndexedReturn: 'Return vs. reference date',
+      Symbol: 'Ticker',
+    },
+    theme_spec: {
+      extends: 'datawrapper',
+      legend: {
+        show: 'always',
+        placement: ['seriesEnd', 'right'],
+      },
+    },
+    options: { addTooltips: false },
+    chart_spec: {
+      chartType: 'Line Chart',
+      title: 'Index chart (Flint + D3 reference)',
+      subtitle: 'Flint redraws the return lines; the host overlay supplies the movable reference cursor.',
+      encodings: { x: 'Date', y: 'IndexedReturn', color: 'Symbol' },
+      baseSize: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
+      canvasSize: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
+      chartProperties: {
+        includeZero_y: true,
+        showPoints: false,
+      },
+    },
+  };
+}
+
+function measurePlotBounds(mount: HTMLDivElement) {
+  const frame = mount.querySelector<SVGGraphicsElement>('.mark-group.role-frame.root');
+  if (!frame) return FALLBACK_PLOT_BOUNDS;
+  const background = [...frame.children]
+    .find((child): child is SVGGraphicsElement => child instanceof SVGGraphicsElement
+      && child.classList.contains('background'));
+  const box = (background ?? frame).getBBox();
+  const lineBoxes = [...mount.querySelectorAll<SVGGraphicsElement>('g.mark-line.role-mark path')]
+    .map((path) => path.getBBox())
+    .filter((candidate) =>
+      Number.isFinite(candidate.x)
+      && Number.isFinite(candidate.width)
+      && candidate.width > 2);
+  const matrix = frame.getCTM();
+  const scaleX = matrix?.a || 1;
+  const scaleY = matrix?.d || scaleX;
+  const plotX = lineBoxes.length > 0 ? Math.min(...lineBoxes.map((candidate) => candidate.x)) : box.x;
+  const plotRight = lineBoxes.length > 0
+    ? Math.max(...lineBoxes.map((candidate) => candidate.x + candidate.width))
+    : box.x + box.width;
+  const left = ((matrix?.e ?? 0) / scaleX) + plotX;
+  const top = ((matrix?.f ?? 0) / scaleY) + box.y;
+  const width = plotRight - plotX;
+  if (!Number.isFinite(width) || !Number.isFinite(box.height) || width < 2 || box.height < 2) {
+    return FALLBACK_PLOT_BOUNDS;
+  }
+  return {
+    left,
+    right: left + width,
+    top,
+    bottom: top + box.height,
+  };
+}
+
+function formatMonth(date: Date) {
+  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
+}
+
+export function IndexChartStage() {
+  const initialState = useMemo(() => deriveIndexChartState(PREPARED, INITIAL_ACTIVE_DATE), []);
+  const [activeDate, setActiveDate] = useState(initialState.activeDate);
+  const derived = useMemo(() => deriveIndexChartState(PREPARED, activeDate), [activeDate]);
+  const [plotBounds, setPlotBounds] = useState(FALLBACK_PLOT_BOUNDS);
+  const [cursorX, setCursorX] = useState(() => xScaleForBounds(FALLBACK_PLOT_BOUNDS)(initialState.activeDate));
+  const mountRef = useRef<HTMLDivElement>(null);
+  const surfaceRef = useRef<InteractiveChartSurface | null>(null);
+  const inspectInteraction = useMemo(() => inspectIndex({
+    id: INSPECT_INTERACTION_ID,
+    axis: 'x',
+    show: 'all',
+  }), []);
+  const plotWidth = Math.max(1, plotBounds.right - plotBounds.left);
+  const plotXScale = useMemo(() => (
+    scaleUtc()
+      .domain([PREPARED.minDate, PREPARED.maxDate])
+      .range([0, plotWidth])
+      .clamp(true)
+  ), [plotWidth]);
+  const plotBoundsRef = useRef(plotBounds);
+  const plotWidthRef = useRef(plotWidth);
+ 
```

**File**: `site/src/playground/index-chart-model.ts` (added, +197/-0)
```diff
@@ -0,0 +1,197 @@
+import type { IndexChartStockRow } from '../data/index-chart-stocks';
+
+export interface PreparedIndexPoint {
+  date: Date;
+  dateMs: number;
+  close: number;
+}
+
+export interface PreparedIndexSeries {
+  symbol: IndexChartStockRow['Symbol'];
+  points: PreparedIndexPoint[];
+}
+
+export interface PreparedIndexChartData {
+  series: PreparedIndexSeries[];
+  availableDates: Date[];
+  minDate: Date;
+  maxDate: Date;
+  returnDomain: [number, number];
+}
+
+export interface IndexedReturnRow {
+  Symbol: IndexChartStockRow['Symbol'];
+  Date: string;
+  IndexedReturn: number;
+  Close: number;
+  ReferenceDate: string;
+  ReferenceClose: number;
+}
+
+export interface BaselineResolution {
+  Symbol: IndexChartStockRow['Symbol'];
+  requestedDate: string;
+  resolvedDate: string;
+  referenceClose: number;
+}
+
+export interface SeriesEndLabel {
+  Symbol: IndexChartStockRow['Symbol'];
+  Date: string;
+  IndexedReturn: number;
+}
+
+export interface IndexChartState {
+  activeDate: Date;
+  indexedRows: IndexedReturnRow[];
+  baselines: BaselineResolution[];
+  endLabels: SeriesEndLabel[];
+}
+
+function toUtcDate(value: string | Date): Date {
+  if (value instanceof Date) {
+    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
+  }
+  return new Date(`${value}T00:00:00Z`);
+}
+
+function toIsoDate(value: Date): string {
+  return value.toISOString().slice(0, 10);
+}
+
+function clampDate(value: Date, min: Date, max: Date): Date {
+  const time = Math.min(Math.max(value.getTime(), min.getTime()), max.getTime());
+  return new Date(time);
+}
+
+function nearestPoint(points: readonly PreparedIndexPoint[], targetMs: number): PreparedIndexPoint {
+  if (points.length === 1) return points[0];
+  let low = 0;
+  let high = points.length - 1;
+  while (low < high) {
+    const mid = Math.floor((low + high) / 2);
+    if (points[mid].dateMs < targetMs) {
+      low = mid + 1;
+    } else {
+      high = mid;
+    }
+  }
+  const right = points[low];
+  const left = points[Math.max(0, low - 1)];
+  return Math.abs(right.dateMs - targetMs) < Math.abs(left.dateMs - targetMs) ? right : left;
+}
+
+function interpolatedClose(points: readonly PreparedIndexPoint[], targetMs: number): number {
+  if (points.length === 1) return points[0].close;
+  if (targetMs <= points[0].dateMs) return points[0].close;
+  if (targetMs >= points[points.length - 1].dateMs) return points[points.length - 1].close;
+
+  let low = 0;
+  let high = points.length - 1;
+  while (low < high) {
+    const mid = Math.floor((low + high) / 2);
+    if (points[mid].dateMs < targetMs) {
+      low = mid + 1;
+    } else {
+      high = mid;
+    }
+  }
+
+  const right = points[low];
+  if (right.dateMs === targetMs) return right.close;
+  const left = points[Math.max(0, low - 1)];
+  const span = right.dateMs - left.dateMs;
+  if (span <= 0) return right.close;
+  const t = (targetMs - left.dateMs) / span;
+  return left.close + ((right.close - left.close) * t);
+}
+
+export function snapDateToAvailableDate(availableDates: readonly Date[], candidate: string | Date): Date {
+  const target = toUtcDate(candidate);
+  const available = availableDates.map((date) => ({ date, dateMs: date.getTime() }));
+  return nearestPoint(available.map(({ date, dateMs }) => ({ date, dateMs, close: 0 })), target.getTime()).date;
+}
+
+export function clampDateToPreparedDomain(
+  prepared: Pick<PreparedIndexChartData, 'minDate' | 'maxDate'>,
+  candidate: string | Date,
+): Date {
+  return clampDate(toUtcDate(candidate), prepared.minDate, prepared.maxDate);
+}
+
+export function prepareIndexChartData(rows: readonly IndexChartStockRow[]): PreparedIndexChartData {
+  const grouped = new Map<IndexChartStockRow['Symbol'], PreparedIndexPoint[]>();
+  const allDates = new Map<number, Date>();
+  let maxReturn = 0;
+  let minReturn = 0;
+
+  for (const row of rows) {
+    const date = toUtcDate(row.Date);
+    const dateMs = date.getTime();
+    allDates.set(dateMs, date);
+    const points = grouped.get(row.Symbol) ?? [];
+    points.push({ date, dateMs, close: row.Close });
+    grouped.set(row.Symbol, points);
+  }
+
+  const series = [...grouped.entries()]
+    .sort(([left], [right]) => left.localeCompare(right))
+    .map(([symbol, points]) => {
+      const sorted = [...points].sort((left, right) => left.dateMs - right.dateMs);
+      const closes = sorted.map((point) => point.close);
+      const minClose = Math.min(...closes);
+      const maxClose = Math.max(...closes);
+      maxReturn = Math.max(maxReturn, (maxClose / minClose) - 1);
+      minReturn = Math.min(minReturn, (minClose / maxClose) - 1);
+      return { symbol, points: sorted };
+    });
+
+  const availableDates = [...allDates.entries()]
+    .sort(([left], [right]) => left - right)
+    .map(([, date]) => date);
+  const padding = Math.max(0.06, (maxReturn - minReturn) * 0.08);
+
+  return {
+    series,
+    availableDates,
+    minDat
```

**File**: `site/src/playground/index-chart-stage.css` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+.index-chart-shell {
+  padding: 12px 12px 14px;
+}
+
+.index-chart-stack {
+  position: relative;
+  width: 900px;
+  min-height: 520px;
+}
+
+.index-chart-mount {
+  min-height: 520px;
+}
+
+.index-chart-overlay {
+  position: absolute;
+  inset: 0;
+  z-index: 3;
+  width: 900px;
+  height: 520px;
+  overflow: visible;
+  pointer-events: none;
+}
+
+.index-chart-baseline {
+  stroke: #cad2d8;
+  stroke-dasharray: 4 4;
+  stroke-width: 1px;
+}
+
+.index-chart-rule {
+  stroke: #9a3f3f;
+  stroke-width: 1.4px;
+  stroke-dasharray: 3 2;
+}
+
+.index-chart-badge rect {
+  fill: rgba(255, 255, 255, 0.94);
+  stroke: #aeb8bf;
+  stroke-width: 1px;
+}
+
+.index-chart-badge text {
+  fill: #3a434a;
+  font-size: 10px;
+  font-weight: 700;
+}
+
+.index-chart-footer {
+  display: flex;
+  justify-content: flex-start;
+  padding-top: 2px;
+}
```

#### Recent Merged Pull Requests:
- **PR #134** (closed): feat(echarts): chart_spec.echarts, a native option escape hatch (@windylcx)
- **PR #127** (2026-09-20): feat(interactions): admission per chart type, one owner per trigger (@xavier-shaw)
- **PR #124** (2026-09-20): feat(interactions): interaction_spec for chart interactions (@xavier-shaw)
- **PR #122** (2026-09-10): demo: add timebox bespoke interaction (@lx9days)
- **PR #120** (2026-09-09): fix(tests): repair type errors in map test files (@xavier-shaw)
- **PR #119** (2026-09-08): Map navigation: pan and zoom, semantic zoom levels, and a click-to-fly demo (@xavier-shaw)
- **PR #117** (2026-09-07): You draw it: freehand bespoke interaction demo and runtime fixes (@xavier-shaw)
- **PR #116** (2026-09-05): add interactive data report demo to the interaction lab (@xavier-shaw)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
