# Forensic Learning Record (Deep Inspection): microsoft/flint-chart

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-flint-chart-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/flint-chart](https://github.com/microsoft/flint-chart))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:52:55.020Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/flint-chart`
- **Description**: 🪄 Flint is a visualization language that lets AI agents reliably create expressive, good-looking charts from simple, human-editable chart specs.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4321 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/flint-js/eslint.config.js`
```
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'df-reference/**', 'examples/**/dist/**', 'agents/**/dist/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
    },
  },
);

```

### Core Architecture Module: `packages/flint-js/src/chart-types/gantt.ts`
```
import { SemanticAnnotation, toTypeString } from '../core/field-semantics';
import { isTimeSeriesType } from '../core/semantic-types';
import { ChartPropertyDef } from '../core/types';

export interface GanttRow {
    task: string;
    start: number;
    end: number;
    inputIndex: number;
}

export const GANTT_PROPERTIES: ChartPropertyDef[] = [
    { key: 'taskHeight', label: 'Task height', type: 'continuous', min: 40, max: 90, step: 5, defaultValue: 70 },
    { key: 'cornerRadius', label: 'Corners', type: 'continuous', min: 0, max: 8, step: 1, defaultValue: 2 },
    { key: 'intervalLabels', label: 'Labels', type: 'binary', defaultValue: false },
];

export function sortGanttRows<T extends GanttRow>(rows: T[]): T[] {
    return [...rows].sort((a, b) => (a.start - b.start) || (a.inputIndex - b.inputIndex));
}

export function coerceGanttEndpoint(value: unknown, temporal: boolean): number {
    if (value == null) return NaN;
    if (!temporal) return Number(value);
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return Math.abs(value) < 1e11 ? value * 1000 : value;
    return Date.parse(String(value));
}

export function isGanttTemporal(
    resolvedType: unknown,
    semanticType: string | SemanticAnnotation | undefined,
): boolean {
    if (resolvedType === 'temporal') return true;
    const typeName = toTypeString(semanticType);
    return typeName ? isTimeSeriesType(typeName) : false;
}

function compactNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

const GANTT_DURATION_UNITS = [
    { minimumMs: 86_400_000, divisorMs: 86_400_000, suffix: 'd' },
    { minimumMs: 3_600_000, divisorMs: 3_600_000, suffix: 'h' },
    { minimumMs: 60_000, divisorMs: 60_000, suffix: 'min' },
    { minimumMs: 1_000, divisorMs: 1_000, suffix: 's' },
    { minimumMs: 0, divisorMs: 1, suffix: 'ms' },
] as const;

export function formatGanttDuration(durationMs: number): string {
    const unit = GANTT_DURATION_UNITS.find(({ minimumMs }) => Math.abs(durationMs) >= minimumMs)!;
    return `${compactNumber(durationMs / unit.divisorMs)}${unit.suffix}`;
}

export function ganttDurationLabelExpression(start: string, end: string, temporal: boolean): string {
    const startValue = `datum[${JSON.stringify(start)}]`;
    const endValue = `datum[${JSON.stringify(end)}]`;
    if (!temporal) return `format(${endValue} - ${startValue}, ',.2~f')`;

    const duration = `(toDate(${endValue}) - toDate(${startValue}))`;
    return GANTT_DURATION_UNITS.reduceRight((fallback, unit, index) => {
        const label = `format(${duration} / ${unit.divisorMs}, '.2~f') + '${unit.suffix}'`;
        return index === GANTT_DURATION_UNITS.length - 1
            ? label
            : `(abs(${duration}) >= ${unit.minimumMs} ? ${label} : ${fallback})`;
    }, '');
}

export function formatGanttLabel(
    start: number,
    end: number,
    temporal: boolean,
): string {
    const duration = end - start;
    if (!temporal) return compactNumber(duration);
    return formatGanttDuration(duration);
}

export function ganttLabelReservePx(rows: Pick<GanttRow, 'start' | 'end'>[], temporal: boolean): number {
    const maxCharacters = rows.reduce((max, row) => (
        Math.max(max, formatGanttLabel(row.start, row.end, temporal).length)
    ), 0);
    return Math.max(40, maxCharacters * 7 + 10);
}
```

### Core Architecture Module: `packages/flint-js/src/chart-types/geo.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Geographic gazetteer for choropleth maps — shared across backends.
 *
 * Real-world datasets identify regions by *name* ("California", "United
 * States") or by a familiar short code (USPS "CA", ISO alpha-2 "US", alpha-3
 * "USA") — almost never by the numeric ids that TopoJSON feature geometries
 * actually carry (FIPS state codes, ISO 3166-1 *numeric* country codes). This
 * module crosswalks any of those user-facing forms to whatever key a given
 * backend's geo rendering needs:
 *
 *   - `resolveUsState` / `resolveCountry` — numeric feature id, for the
 *     Vega-Lite backend's TopoJSON join (`us-10m.json` / `world-110m.json`).
 *   - `resolveUsStateCode` / `resolveCountryCode` — USPS / ISO alpha-3 code,
 *     for the Plotly backend's native `choropleth`/`scattergeo` `locations`.
 *
 * Living in `chart-types/` (rather than under one backend's `templates/`)
 * follows the same cross-backend-shared-logic convention as
 * `chart-types/gantt.ts` / `chart-types/waterfall.ts`.
 *
 * Lookups are case- and punctuation-insensitive. A value that is already the
 * numeric id passes through unchanged.
 */

/**
 * Normalise a label for matching: accent-folded, lowercased, alphanumerics
 * only. Accent folding (NFD + strip combining marks) lets "Côte d'Ivoire" and
 * "São Tomé" match their plain-ASCII gazetteer keys.
 */
function norm(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// US states — [FIPS, name, USPS code]
// ---------------------------------------------------------------------------

const US_STATES: Array<[number, string, string]> = [
    [1, 'Alabama', 'AL'], [2, 'Alaska', 'AK'], [4, 'Arizona', 'AZ'], [5, 'Arkansas', 'AR'],
    [6, 'California', 'CA'], [8, 'Colorado', 'CO'], [9, 'Connecticut', 'CT'], [10, 'Delaware', 'DE'],
    [11, 'District of Columbia', 'DC'], [12, 'Florida', 'FL'], [13, 'Georgia', 'GA'], [15, 'Hawaii', 'HI'],
    [16, 'Idaho', 'ID'], [17, 'Illinois', 'IL'], [18, 'Indiana', 'IN'], [19, 'Iowa', 'IA'],
    [20, 'Kansas', 'KS'], [21, 'Kentucky', 'KY'], [22, 'Louisiana', 'LA'], [23, 'Maine', 'ME'],
    [24, 'Maryland', 'MD'], [25, 'Massachusetts', 'MA'], [26, 'Michigan', 'MI'], [27, 'Minnesota', 'MN'],
    [28, 'Mississippi', 'MS'], [29, 'Missouri', 'MO'], [30, 'Montana', 'MT'], [31, 'Nebraska', 'NE'],
    [32, 'Nevada', 'NV'], [33, 'New Hampshire', 'NH'], [34, 'New Jersey', 'NJ'], [35, 'New Mexico', 'NM'],
    [36, 'New York', 'NY'], [37, 'North Carolina', 'NC'], [38, 'North Dakota', 'ND'], [39, 'Ohio', 'OH'],
    [40, 'Oklahoma', 'OK'], [41, 'Oregon', 'OR'], [42, 'Pennsylvania', 'PA'], [44, 'Rhode Island', 'RI'],
    [45, 'South Carolina', 'SC'], [46, 'South Dakota', 'SD'], [47, 'Tennessee', 'TN'], [48, 'Texas', 'TX'],
    [49, 'Utah', 'UT'], [50, 'Vermont', 'VT'], [51, 'Virginia', 'VA'], [53, 'Washington', 'WA'],
    [54, 'West Virginia', 'WV'], [55, 'Wisconsin', 'WI'], [56, 'Wyoming', 'WY'],
];

/**
 * Extra US-state forms: AP-style newspaper abbreviations ("Calif.", "Wash."),
 * directional shorthand ("N. Carolina", "S. Dakota") and common variants. Keys
 * are already `norm`-ed (punctuation/spacing removed), so "N. Carolina" arrives
 * as "ncarolina". None collide with a two-letter USPS code.
 */
const US_STATE_ALIASES: Record<string, number> = {
    // AP-style abbreviations
    ala: 1, ariz: 4, ark: 5, calif: 6, colo: 8, conn: 9, del: 10, fla: 12,
    ill: 17, ind: 18, kan: 20, kans: 20, mass: 25, mich: 26, minn: 27,
    miss: 28, mont: 30, neb: 31, nebr: 31, nev: 32, okla: 40, ore: 41,
    oreg: 41, penn: 42, penna: 42, tenn: 47, tex: 48, wash: 53, wis: 55,
    wisc: 55, wyo: 56,
    // Directional shorthand
    ncarolina: 37, scarolina: 45, ndakota: 38, sdakota: 46, wvirginia: 54,
    nhampshire: 33, njersey: 34, nmexico: 35, nyork: 36,
    // District of Columbia variants
    washingtondc: 11, dcusa: 11,
};

// ---------------------------------------------------------------------------
// Countries — [ISO numeric, name, alpha-2, alpha-3]
// Numeric ids match Vega's world-110m.json `countries` feature ids.
// ---------------------------------------------------------------------------

const COUNTRIES: Array<[number, string, string, string]> = [
    [156, 'China', 'CN', 'CHN'], [356, 'India', 'IN', 'IND'], [840, 'United States', 'US', 'USA'],
    [360, 'Indonesia', 'ID', 'IDN'], [586, 'Pakistan', 'PK', 'PAK'], [566, 'Nigeria', 'NG', 'NGA'],
    [76, 'Brazil', 'BR', 'BRA'], [50, 'Bangladesh', 'BD', 'BGD'], [643, 'Russia', 'RU', 'RUS'],
    [484, 'Mexico', 'MX', 'MEX'], [231, 'Ethiopia', 'ET', 'ETH'], [392, 'Japan', 'JP', 'JPN'],
    [608, 'Philippines', 'PH', 'PHL'], [818, 'Egypt', 'EG', 'EGY'], [180, 'DR Congo', 'CD', 'COD'],
    [704, 'Vietnam', 'VN', 'VNM'], [364, 'Iran', 'IR', 'IRN'], [792, 'Turkey', 'TR', 'TUR'],
    [276, 'Germany', 'DE', 'DEU'], [764, 'Thailand', 'TH', 'THA'], [826, 'United Kingdom', 'GB', 'GBR'],
    [250, 'France', 'FR', 'FRA'], [710, 'South Africa', 'ZA', 'ZAF'], [380, 'Italy', 'IT', 'ITA'],
    [404, 'Kenya', 'KE', 'KEN'], [170, 'Colombia', 'CO', 'COL'], [724, 'Spain', 'ES', 'ESP'],
    [32, 'Argentina', 'AR', 'ARG'], [12, 'Algeria', 'DZ', 'DZA'], [124, 'Canada', 'CA', 'CAN'],
    [616, 'Poland', 'PL', 'POL'], [804, 'Ukraine', 'UA', 'UKR'], [682, 'Saudi Arabia', 'SA', 'SAU'],
    [504, 'Morocco', 'MA', 'MAR'], [604, 'Peru', 'PE', 'PER'], [36, 'Australia', 'AU', 'AUS'],
    [398, 'Kazakhstan', 'KZ', 'KAZ'], [152, 'Chile', 'CL', 'CHL'], [752, 'Sweden', 'SE', 'SWE'],
    [578, 'Norway', 'NO', 'NOR'], [528, 'Netherlands', 'NL', 'NLD'], [56, 'Belgium', 'BE', 'BEL'],
    [756, 'Switzerland', 'CH', 'CHE'], [40, 'Austria', 'AT', 'AUT'], [620, 'Portugal', 'PT', 'PRT'],
    [300, 'Greece', 'GR', 'GRC'], [372, 'Ireland', 'IE', 'IRL'], [246, 'Finland', 'FI', 'FIN'],
    [208, 'Denmark', 'DK', 'DNK'], [554, 'New Zealand', 'NZ', 'NZL'], [410, 'South Korea', 'KR', 'KOR'],
    [458, 'Malaysia', 'MY', 'MYS'], [862, 'Venezuela', 'VE', 'VEN'], [218, 'Ecuador', 'EC', 'ECU'],
    [4, 'Afghanistan', 'AF', 'AFG'], [368, 'Iraq', 'IQ', 'IRQ'], [887, 'Yemen', 'YE', 'YEM'],
    [144, 'Sri Lanka', 'LK', 'LKA'], [104, 'Myanmar', 'MM', 'MMR'], [116, 'Cambodia', 'KH', 'KHM'],
    [24, 'Angola', 'AO', 'AGO'], [834, 'Tanzania', 'TZ', 'TZA'], [800, 'Uganda', 'UG', 'UGA'],
    [716, 'Zimbabwe', 'ZW', 'ZWE'], [288, 'Ghana', 'GH', 'GHA'], [384, 'Ivory Coast', 'CI', 'CIV'],
    [686, 'Senegal', 'SN', 'SEN'],
    // Additional countries — numeric ids verified present in world-110m.json.
    [268, 'Georgia', 'GE', 'GEO'], [524, 'Nepal', 'NP', 'NPL'], [192, 'Cuba', 'CU', 'CUB'],
    [634, 'Qatar', 'QA', 'QAT'], [400, 'Jordan', 'JO', 'JOR'], [422, 'Lebanon', 'LB', 'LBN'],
    [376, 'Israel', 'IL', 'ISR'], [414, 'Kuwait', 'KW', 'KWT'], [512, 'Oman', 'OM', 'OMN'],
    [784, 'United Arab Emirates', 'AE', 'ARE'], [788, 'Tunisia', 'TN', 'TUN'], [434, 'Libya', 'LY', 'LBY'],
    [729, 'Sudan', 'SD', 'SDN'], [120, 'Cameroon', 'CM', 'CMR'], [508, 'Mozambique', 'MZ', 'MOZ'],
    [450, 'Madagascar', 'MG', 'MDG'], [894, 'Zambia', 'ZM', 'ZMB'], [466, 'Mali', 'ML', 'MLI'],
    [854, 'Burkina Faso', 'BF', 'BFA'], [562, 'Niger', 'NE', 'NER'], [148, 'Chad', 'TD', 'TCD'],
    [706, 'Somalia', 'SO', 'SOM'], [68, 'Bolivia', 'BO', 'BOL'], [600, 'Paraguay', 'PY', 'PRY'],
    [858, 'Uruguay', 'UY', 'URY'], [320, 'Guatemala', 'GT', 'GTM'], [340, 'Honduras', 'HN', 'HND'],
    [214, 'Dominican Republic', 'DO', 'DOM'], [591, 'Panama', 'PA', 'PAN'], [188, 'Costa Rica', 'CR', 'CRI'],
    [191, 'Croatia', 'HR', 'HRV'], [688, 'Serbia', 'RS', 'SRB'], [703, 'Slovakia', 'SK', 'SVK'],
    [705, 'Slovenia', 'SI', 'SVN'], [100, 'Bulgaria', 'BG', 'BGR'], [642, 'Romania', 'RO', 'ROU'],
    [348, 'Hungary', 'HU', 'HUN'], [112, 'Belarus', 'BY', 'BLR'], [440, 'Lithuania', 'LT', 'LTU'],
    [428, 'La
```

### Core Architecture Module: `packages/flint-js/src/chart-types/waterfall.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Shared waterfall "totals" semantics, used by every backend template
 * (Vega-Lite / ECharts / Chart.js) and by the `totals` property `check` so the
 * options UI and the rendered chart never disagree on the default.
 *
 * A waterfall bar is either a *delta* (floats off the running cumulative) or a
 * *total* (anchored at zero, "touches down" to the running cumulative). When
 * the data has no explicit type column, Flint infers which ends are totals.
 * The user's `totals` property is purely an *override* of that inference.
 */

export type WaterfallTotalsMode = 'none' | 'first' | 'last' | 'both';

/**
 * True when the final value reconciles with the running cumulative of every
 * prior row — i.e. the last row reads like a genuine grand-total restatement
 * (`last ≈ Σ prior`). Tolerance is relative (0.5% of the cumulative) with a
 * tiny absolute floor for near-zero totals. Non-finite values never reconcile.
 */
export function waterfallLastReconciles(values: number[]): boolean {
    if (values.length < 2) return false;
    let cumPrev = 0;
    for (let i = 0; i < values.length - 1; i++) {
        if (!Number.isFinite(values[i])) return false;
        cumPrev += values[i];
    }
    const last = values[values.length - 1];
    if (!Number.isFinite(last)) return false;
    const tol = Math.max(1e-6, 0.005 * Math.abs(cumPrev));
    return Math.abs(last - cumPrev) <= tol;
}

/**
 * The compiler's inferred default when the user hasn't set `totals` and there
 * is no explicit type column. The first bar is always a reasonable start total;
 * the last bar is only treated as a total when it reconciles with the prior
 * cumulative — otherwise it stays a floating delta.
 */
export function recommendedTotalsMode(values: number[]): 'first' | 'both' {
    return waterfallLastReconciles(values) ? 'both' : 'first';
}

/**
 * Resolve the effective totals mode: a valid explicit user value wins;
 * anything else (undefined, or the UI default 'auto') falls back to the
 * data-aware recommendation.
 */
export function resolveTotalsMode(values: number[], explicit?: unknown): WaterfallTotalsMode {
    if (explicit === 'none' || explicit === 'first' || explicit === 'last' || explicit === 'both') {
        return explicit;
    }
    return recommendedTotalsMode(values);
}
```

### Core Architecture Module: `packages/flint-js/src/chartjs/assemble.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Chart.js chart assembly — Two-Stage Pipeline Coordinator.
 *
 * Reuses the **same core analysis pipeline** as Vega-Lite and ECharts:
 *   Phase 0:  resolveChannelSemantics  → ChannelSemantics
 *   Step 0a:  declareLayoutMode    → LayoutDeclaration
 *   Step 0b:  convertTemporalData  → converted data
 *   Step 0c:  filterOverflow       → filtered data, nominalCounts
 *   Phase 1:  computeLayout        → LayoutResult
 *
 * Then diverges for Phase 2 (Chart.js-specific):
 *   template.instantiate → builds Chart.js config structure
 *   cjsApplyLayoutToSpec → applies layout decisions to config
 *
 * Key structural differences from ECharts / VL output:
 *   VL: { mark, encoding, data: {values}, width, height }
 *   EC: { xAxis, yAxis, series: [{type, data}], tooltip, legend, grid }
 *   CJS: { type, data: { labels, datasets[] }, options: { scales, plugins } }
 *
 * This module has NO React, Redux, or UI framework dependencies.
 */

import {
    ChartEncoding,
    ChartTemplateDef,
    ChartAssemblyInput,
    AssembleOptions,
    LayoutDeclaration,
    InstantiateContext,
} from '../core/types';
import type { ChartWarning } from '../core/types';
import { applyEncodingOverrides } from '../core/encoding-overrides';
import { applyAggregation } from '../core/aggregate';
import { applyPivot, applyTransform, type PivotSurface, type TransformSurface } from '../core/pivot';
import { cjsGetTemplateDef } from './templates';
import { resolveChannelSemantics, convertTemporalData } from '../core/resolve-semantics';
import { computeZeroDecision } from '../core/semantic-types';
import { filterOverflow } from '../core/filter-overflow';
import { computeLayout, computeChannelBudgets, deriveStretchCaps, resolveBaseSize, resolveFacetColumnsOption } from '../core/compute-layout';
import { decideColorMaps } from '../core/color-decisions';
import { cjsApplyLayoutToSpec, cjsApplyTooltips } from './instantiate-spec';
import { normalizeStaticSeries } from '../core/static-series';
import { normalizeChartProperties } from '../core/normalize-properties';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Assemble a Chart.js config object.
 *
 * ```ts
 * const config = assembleChartjs({
 *   data: { values: myRows },
 *   semantic_types: { weight: 'Quantity' },
 *   chart_spec: { chartType: 'Bar Chart', encodings: { x: { field: 'category' }, y: { field: 'value' } } },
 *   options: { addTooltips: true },
 * });
 * ```
 *
 * @returns A Chart.js config object with optional `_warnings` and `_width`/`_height` hints
 */
function applyFieldDisplayNames(config: any, names: Record<string, string> | undefined): void {
    if (!names) return;
    const displayName = (value: unknown) => typeof value === 'string' ? names[value] ?? value : value;
    for (const scale of Object.values(config.options?.scales ?? {}) as any[]) {
        if (scale?.title?.text) scale.title.text = displayName(scale.title.text);
    }
    for (const dataset of config.data?.datasets ?? []) {
        if (dataset?.label) dataset.label = displayName(dataset.label);
    }
}

export function assembleChartjs(input: ChartAssemblyInput): any {
    const chartType = input.chart_spec.chartType;
    const semanticTypes = input.semantic_types ?? {};
    // Internal layout targets the base (target) size; the optional canvasSize
    // ceiling is applied as per-dimension stretch caps once options resolve.
    // The base is clamped to the ceiling so a smaller canvasSize shrinks the
    // chart to fit rather than overflowing it.
    const sizeCeiling = input.chart_spec.canvasSize;
    const baseSize = resolveBaseSize(input.chart_spec.baseSize, sizeCeiling);
    const canvasSize = baseSize;
    const options = input.options ?? {};
    let chartTemplate = cjsGetTemplateDef(chartType) as ChartTemplateDef;
    if (!chartTemplate) {
        throw new Error(`Unknown Chart.js chart type: ${chartType}. Use cjsAllTemplateDefs to see available types.`);
    }

    const warnings: ChartWarning[] = [];

    // Validate discrete property values against the template's options before
    // they reach `instantiate` (map known labels → values, drop unknowns).
    const normalizedProps = normalizeChartProperties(
        chartTemplate.properties, input.chart_spec.chartProperties,
    );
    const chartProperties = normalizedProps.chartProperties;
    warnings.push(...normalizedProps.warnings);

    // ═══════════════════════════════════════════════════════════════════════
    // PRE-PHASE: Static Series Normalization
    // ═══════════════════════════════════════════════════════════════════════
    const rawData = input.data.values ?? [];
    const normalized = normalizeStaticSeries(
        input.chart_spec.encodings, rawData, semanticTypes, chartType,
    );
    let data = normalized.data;
    const staticSeries = normalized.staticSeries;

    const prelimConvertedData = convertTemporalData(data, semanticTypes);
    const prelimSemantics = resolveChannelSemantics(
        normalized.encodings, data, semanticTypes, prelimConvertedData,
    );
    const typedRawEncodings: Record<string, ChartEncoding> = {};
    for (const [ch, enc] of Object.entries(normalized.encodings)) {
        typedRawEncodings[ch] = enc.type
            ? enc
            : { ...enc, type: prelimSemantics[ch]?.type };
    }

    // Transform (derived Category-B operator): same two-control model as VL —
    // chartProperties.chartType (θ) + chartProperties.arrange (τ/σ/γ). Legacy
    // composed `pivot` ids are migrated inside applyTransform. See
    // design-docs/chart-transform-two-axes.md.
    const authoredTemplate = chartTemplate;
    const transformed = applyTransform(chartTemplate, typedRawEncodings, data, chartProperties, cjsGetTemplateDef);
    if (transformed.chartType && transformed.chartType !== chartType) {
        const swapped = cjsGetTemplateDef(transformed.chartType) as ChartTemplateDef | undefined;
        if (swapped) chartTemplate = swapped;
    }

    // Compose Category-B encoding-action overrides (stored by the host in
    // chartProperties, keyed by action key) onto the post-transform encodings
    // before any pipeline phase runs. Flint owns the transform; the host only
    // stores the override value. See applyEncodingOverrides / EncodingActionDef.
    const encodings = applyEncodingOverrides(chartTemplate, transformed.encodings, chartProperties);

    // Optional aggregation transform — see vegalite/assemble for rationale.
    data = applyAggregation(encodings, data);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 0: Resolve Semantics (shared with VL + EC — completely target-agnostic)
    // ═══════════════════════════════════════════════════════════════════════

    const tplMark = chartTemplate.template?.mark;
    const templateMarkType = typeof tplMark === 'string' ? tplMark : tplMark?.type;

    // Convert temporal data once — feeds semantic resolution and all downstream stages
    const convertedData = convertTemporalData(data, semanticTypes);

    const channelSemantics = resolveChannelSemantics(
        encodings, data, semanticTypes, convertedData,
    );

    // Finalize zero-baseline (requires template mark knowledge)
    const effectiveMarkType = templateMarkType || 'point';
    for (const [channel, cs] of Object.entries(channelSemantics)) {
        if ((channel === 'x' || channel === 'y') && cs.type === 'quantitative') {
            const numericValues = data
                .map(r => r[cs.field])
                .filter((v: any) => v != null && typeof v === 'number' && !isNaN(v));
            cs.zero = computeZeroDecision(
                cs.semanticAnnotation.semanticType, channel, effectiveMarkType, numericValues,
            );
        }
    }

    // ══════════════════════════════
```

### Core Architecture Module: `packages/flint-js/src/chartjs/colormap.ts`
```
// Chart.js 专用调色板定义。
// 承接 core/color-decisions.ts 中的抽象 colormap 信息（schemeType / schemeId / categoryCount），
// 但真正的颜色数组与选盘策略完全在 Chart.js backend 本地实现，并尽量贴近 Chart.js 默认配色。

import type { ColorDecision, ColorMapType } from '../core/color-decisions';

export type ChartJsPaletteId = 'cat10' | 'cat20' | 'viridis' | 'RdBu' | string;

export interface ChartJsColorMapDef {
    id: ChartJsPaletteId;
    type: ColorMapType;
    supportsDiscrete: boolean;
    supportsContinuous: boolean;
    background: 'light' | 'dark' | 'any';
    colorblindSafe?: boolean;
    maxCategories?: number;
    diverging?: boolean;
    preferredMidpoint?: number;
    colors: string[]; // 使用 Chart.js 推荐的基础色（不含 alpha）
}

/**
 * Chart.js 常用的基础配色，基于官方文档中推荐的默认颜色集合：
 * https://www.chartjs.org/docs/latest/general/colors.html
 */
const CHARTJS_COLOR_MAPS: ChartJsColorMapDef[] = [
    {
        id: 'cat10',
        type: 'categorical',
        supportsDiscrete: true,
        supportsContinuous: false,
        background: 'any',
        maxCategories: 10,
        colorblindSafe: false,
        colors: [
            '#36a2eb', // blue
            '#ff6384', // red
            '#ffcd56', // yellow
            '#4bc0c0', // teal
            '#9966ff', // purple
            '#ff9f40', // orange
            '#2ecc71', // green
            '#34495e', // dark blue-grey
            '#e74c3c', // red-orange
            '#95a5a6', // grey
        ],
    },
    {
        id: 'cat20',
        type: 'categorical',
        supportsDiscrete: true,
        supportsContinuous: false,
        background: 'any',
        maxCategories: 20,
        colorblindSafe: false,
        colors: [
            '#36a2eb', '#9ad0f5',
            '#ff6384', '#ff99aa',
            '#ffcd56', '#ffe39f',
            '#4bc0c0', '#8fdede',
            '#9966ff', '#c3a3ff',
            '#ff9f40', '#ffc078',
            '#2ecc71', '#7ee2a8',
            '#34495e', '#5d6d7e',
            '#e74c3c', '#f1948a',
            '#95a5a6', '#cfd4d6',
        ],
    },
    {
        id: 'viridis',
        type: 'sequential',
        supportsDiscrete: true,
        supportsContinuous: true,
        background: 'any',
        colorblindSafe: true,
        colors: [
            '#440154', '#46327e', '#365c8d', '#277f8e',
            '#1fa187', '#4ac16d', '#a0da39', '#fde725',
        ],
    },
    {
        id: 'RdBu',
        type: 'diverging',
        supportsDiscrete: true,
        supportsContinuous: true,
        background: 'any',
        diverging: true,
        preferredMidpoint: 0,
        colors: [
            '#b2182b', '#d6604d', '#f4a582', '#fddbc7',
            '#f7f7f7',
            '#d1e5f0', '#92c5de', '#4393c3', '#2166ac',
        ],
    },
];

function getMapById(id: ChartJsPaletteId | undefined): ChartJsColorMapDef | undefined {
    if (!id) return undefined;
    const key = String(id).toLowerCase();
    return CHARTJS_COLOR_MAPS.find(m => m.id.toLowerCase() === key);
}

export function getPaletteForScheme(id: ChartJsPaletteId): string[] | undefined {
    const entry = getMapById(id);
    return entry?.colors;
}

/**
 * Chart.js 侧的「选盘」函数：等价于 backend 版 pickColorMap。
 *
 * 输入：
 *   - ColorDecision：来自 core/color-decisions（已算好 schemeType / categoryCount / schemeId）。
 *
 * 策略：
 *   1）若用户显式指定了 schemeId，则优先按该 id 取 palette。
 *   2）否则根据 schemeType + categoryCount 自动挑选合适的盘：
 *        - categorical：按类别数量在 cat10 / cat20 之间选；
 *        - sequential：优先 viridis；
 *        - diverging ：优先 RdBu。
 *   3）若都无法命中，回退到符合 Chart.js 习惯的默认 categorical palette（cat10）。
 */
export function pickChartJsPalette(decision: ColorDecision | undefined): string[] {
    if (!decision) {
        const fallback = getPaletteForScheme('cat10');
        return fallback && fallback.length ? fallback : [];
    }

    const { schemeType, schemeId, categoryCount } = decision;

    // 1. 显式 schemeId 优先。
    if (schemeId) {
        const fromId = getPaletteForScheme(schemeId);
        if (fromId && fromId.length > 0) {
            return fromId;
        }
    }

    // 2. 自动路径：根据类型 / 类别数挑选本 backend 推荐盘。
    const mapsOfType = CHARTJS_COLOR_MAPS.filter(m => m.type === schemeType);

    if (schemeType === 'categorical') {
        const k = categoryCount ?? 0;
        if (mapsOfType.length) {
            const candidates = mapsOfType.filter(m => m.supportsDiscrete);
            if (candidates.length) {
                const byCapacity = candidates
                    .filter(m => m.maxCategories == null || m.maxCategories >= k)
                    .sort((a, b) => (a.maxCategories ?? Infinity) - (b.maxCategories ?? Infinity));
                const picked = byCapacity[0] ?? candidates[0];
                if (picked.colors.length) {
                    return picked.colors;
                }
            }
        }
        const fallback = getPaletteForScheme('cat10');
        if (fallback && fallback.length) {
            return fallback;
        }
    } else if (schemeType === 'sequential') {
        const seq = mapsOfType.find(m => m.supportsContinuous) ?? getMapById('viridis');
        if (seq && seq.colors.length) {
            return seq.colors;
        }
    } else if (schemeType === 'diverging') {
        const divergingFirst = mapsOfType.find(m => m.diverging) ?? getMapById('RdBu');
        if (divergingFirst && divergingFirst.colors.length) {
            return divergingFirst.colors;
        }
    }

    // 3. 兜底：Chart.js 默认 categorical palette（cat10）。
    const fallback = getPaletteForScheme('cat10');
    return fallback && fallback.length ? fallback : [];
}


```

### Core Architecture Module: `packages/flint-js/src/chartjs/index.ts`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * @module flint-chart/chartjs
 *
 * Chart.js backend for flint-chart.
 *
 * Compiles the core semantic layer into Chart.js configuration objects.
 * Contains CJS-specific assembly, spec instantiation, and chart templates.
 *
 * Architecture contrast with other backends:
 *   VL: encoding-channel-based — { encoding: { x: { field, type }, y: ... } }
 *   EC: series-based           — { series: [{ type, data }], xAxis, yAxis }
 *   CJS: dataset-based         — { type, data: { labels, datasets[] }, options }
 *
 * Same core pipeline (Phase 0 + Phase 1), different Phase 2 output.
 */

// CJS assembly function
export { assembleChartjs, getChartjsPivot, getChartjsTransform } from './assemble';

// CJS spec instantiation (Phase 2)
export { cjsApplyLayoutToSpec, cjsApplyTooltips } from './instantiate-spec';

// CJS template registry
export {
    cjsTemplateDefs,
    cjsAllTemplateDefs,
    cjsGetTemplateDef,
    cjsGetTemplateChannels,
} from './templates';

// CJS recommendation & adaptation
export { cjsAdaptChart, cjsRecommendEncodings, cjsRecommendChartTypes, cjsRecommendCharts } from './recommendation';

```

### Core Architecture Module: `packages/flint-js/src/chartjs/interactive.ts`
```
import { applyCategoryViewports } from '../core/filter-overflow';
import type { CategoryViewport, ChartAssemblyInput } from '../core/types';
import type { InteractiveRendererAdapter, ViewportState } from '../interactive/types';
import { assembleChartjs } from './assemble';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

function windowedInput(
    input: ChartAssemblyInput,
    viewports: CategoryViewport[],
    starts: ViewportState,
): ChartAssemblyInput {
    return {
        ...input,
        data: {
            values: applyCategoryViewports(input.data.values ?? [], viewports, starts),
        },
    };
}

function renderConfig(config: any): any {
    return {
        ...config,
        options: {
            ...(config.options ?? {}),
            responsive: true,
            maintainAspectRatio: false,
        },
    };
}

export function createChartjsInteractiveRenderer(): InteractiveRendererAdapter {
    return {
        async mount(container, input) {
            const plannedConfig = assembleChartjs(input) as any;
            const viewports = (plannedConfig._viewports ?? []) as CategoryViewport[];
            const initialConfig = viewports.length > 0
                ? assembleChartjs(windowedInput(input, viewports, {})) as any
                : plannedConfig;
            const wrapper = document.createElement('div');
            const canvas = document.createElement('canvas');
            wrapper.style.position = 'relative';
            wrapper.style.width = Number.isFinite(initialConfig._width) ? `${initialConfig._width}px` : '100%';
            wrapper.style.height = `${Number.isFinite(initialConfig._height) ? initialConfig._height : 320}px`;
            wrapper.style.maxWidth = '100%';
            wrapper.append(canvas);
            container.append(wrapper);
            const chart = new Chart(canvas, renderConfig(initialConfig));

            let destroyed = false;
            let updateTimer: number | undefined;
            let latestStarts: ViewportState = {};

            const schedule = (): void => {
                if (destroyed || updateTimer !== undefined) return;
                updateTimer = window.setTimeout(() => {
                    updateTimer = undefined;
                    if (destroyed) return;
                    const config = renderConfig(assembleChartjs(windowedInput(input, viewports, latestStarts)));
                    chart.data = config.data;
                    chart.options = config.options;
                    chart.update('none');
                }, 0);
            };

            return {
                viewports,
                getViewportGeometry(channel) {
                    const area = chart.chartArea;
                    return channel === 'x'
                        ? { offset: area.left, extent: area.right - area.left }
                        : { offset: area.top, extent: area.bottom - area.top };
                },
                setViewports(starts) {
                    latestStarts = { ...starts };
                    schedule();
                },
                resize(size) {
                    wrapper.style.width = `${size.width}px`;
                    wrapper.style.height = `${size.height}px`;
                    chart.resize(size.width, size.height);
                },
                destroy() {
                    if (destroyed) return;
                    destroyed = true;
                    if (updateTimer !== undefined) window.clearTimeout(updateTimer);
                    chart.destroy();
                    container.replaceChildren();
                },
            };
        },
    };
}
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
+type in the generated Vega-Lite referen
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

---

### Incident Patch 4: `9cbef95b` (2026-09-10)
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
-    <div className="ic-flint-dimpvis-shell explod
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

---

### Incident Patch 5: `86aeeb34` (2026-09-09)
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

### Incident Patch 6: `46553afd` (2026-09-09)
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

### Incident Patch 7: `ae822271` (2026-09-07)
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

### Incident Patch 8: `25365780` (2026-09-07)
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

### Incident Patch 9: `8f15a48c` (2026-09-05)
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

### Incident Patch 10: `fe73f759` (2026-09-04)
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
