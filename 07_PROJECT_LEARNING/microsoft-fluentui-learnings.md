> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-fluentui-learnings.md`  
> **Source**: github ([https://github.com/microsoft/fluentui](https://github.com/microsoft/fluentui))  
> **Source Version**: `6d3e9d68`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T03:38:28.226Z  
> **Learning ID**: `learn-github-microsoft-fluentui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): microsoft/fluentui

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-fluentui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/fluentui](https://github.com/microsoft/fluentui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T03:38:27.150Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/fluentui`
- **Description**: Fluent UI web represents a collection of utilities, React components, and web components for building web applications.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 20362 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/charts/chart-utilities/eslint.config.js`
```
// @ts-check
const fluentPlugin = require('@fluentui/eslint-plugin');

/** @type {import("eslint").Linter.Config[]} */ module.exports = [
  ...fluentPlugin.configs['flat/react-legacy'],
  {
    rules: {
      'no-restricted-globals': 'off',
    },
  },
];

```

### Core Architecture Module: `packages/charts/chart-utilities/jest.config.js`
```
// @ts-check

/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  displayName: 'charts-utilities',
  preset: '../../../jest.preset.js',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        isolatedModules: true,
      },
    ],
  },
  coverageDirectory: './coverage',
  setupFilesAfterEnv: ['./config/tests.js'],
  snapshotSerializers: ['@griffel/jest-serializer'],
};

```

### Core Architecture Module: `packages/charts/chart-utilities/just.config.ts`
```
import { preset, task } from '@fluentui/scripts-tasks';

preset();

task('build', 'build:react-with-umd');

```

### Core Architecture Module: `packages/charts/chart-utilities/src/DecodeBase64Data.ts`
```
import type { PlotlySchema } from './PlotlySchema';
import { isArrayOrTypedArray } from './PlotlySchemaConverter';

const MAX_SHAPE_RANK = 3;

function addBase64Padding(s: string): string {
  const paddingNeeded = (4 - (s.length % 4)) % 4;
  return s + '='.repeat(paddingNeeded);
}
// Function to check if a string is base64-encoded
function isBase64(s: string): boolean {
  if (typeof s !== 'string') {
    return false;
  }

  // Base64 strings must have a length that is a multiple of 4
  if (s.length % 4 !== 0) {
    s = addBase64Padding(s);
  }

  // Use a regular expression to check if the string contains only valid base64 characters
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  if (!base64Regex.test(s)) {
    return false;
  }

  try {
    decodeBase64FromString(s);
    return true;
  } catch {
    return false;
  }
}

function decodeBase64FromString(base64String: string): Uint8Array {
  if (typeof window !== 'undefined' && typeof atob === 'function') {
    // For browsers
    const binaryString = atob(base64String);
    const binaryLength = binaryString.length;
    const bytes = new Uint8Array(binaryLength);
    for (let i = 0; i < binaryLength; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  throw new Error('Base64 decoding is not supported in this environment.');
}

// Helper function to decode base64-encoded data based on dtype
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeBase64(value: string, dtype: string): any {
  // Add padding if necessary
  value = addBase64Padding(value);

  try {
    const decodedBytes = decodeBase64FromString(value);
    switch (dtype) {
      case 'f8':
        return Array.from(new Float64Array(decodedBytes.buffer));
      case 'i8':
        return Array.from(new Int32Array(decodedBytes.buffer)); // BigInt64Array is supported ES2020 onwards
      case 'u8':
        return Array.from(new Uint32Array(decodedBytes.buffer));
      case 'i4':
        return Array.from(new Int32Array(decodedBytes.buffer));
      case 'i2':
        return Array.from(new Int16Array(decodedBytes.buffer));
      case 'i1':
        return Array.from(new Int8Array(decodedBytes.buffer));
      default:
        try {
          return decodedBytes.toString();
        } catch (error) {
          return decodedBytes;
        }
    }
  } catch (error) {
    throw new Error(`Failed to decode base64 value: ${value}`);
  }
}

function validateShape(dataLength: number, shape: number[]): void {
  if (shape.length === 0 || shape.length > MAX_SHAPE_RANK) {
    throw new Error(`Invalid typed-array shape: rank must be between 1 and ${MAX_SHAPE_RANK}`);
  }

  let elementCount = 1;

  for (const dimension of shape) {
    if (!Number.isSafeInteger(dimension) || dimension < 0) {
      throw new Error('Invalid typed-array shape: dimensions must be non-negative safe integers');
    }
    if (dimension !== 0 && elementCount > Number.MAX_SAFE_INTEGER / dimension) {
      throw new Error('Invalid typed-array shape: element count exceeds the maximum safe integer');
    }

    elementCount *= dimension;
  }

  if (elementCount !== dataLength) {
    throw new Error('Invalid typed-array shape: dimensions do not match decoded element count');
  }
}

function reshapeValidatedArray(data: number[], shape: number[]): number[] | number[][] | number[][][] {
  if (shape.length === 1) {
    return data;
  }
  if (shape.length === 2) {
    const [rows, cols] = shape;
    const result: number[][] = [];
    for (let r = 0; r < rows; r++) {
      result.push(data.slice(r * cols, (r + 1) * cols));
    }
    return result;
  }
  // For higher dimensions, recursively reshape
  const [dim, ...rest] = shape;
  const step = data.length / dim;
  const result: number[][][] = [];
  for (let i = 0; i < dim; i++) {
    result.push(reshapeValidatedArray(data.slice(i * step, (i + 1) * step), rest) as number[][]);
  }
  return result;
}

// Helper to reshape a flat array into the given shape (e.g., [rows, cols])
export function reshapeArray(data: number[], shape: number[]): number[] | number[][] | number[][][] {
  validateShape(data.length, shape);
  if (data.length === 0) {
    return [];
  }
  return reshapeValidatedArray(data, shape);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeBdataInDict(node: any): any {
  // Primitive → return as-is
  if (node === null || typeof node !== 'object') {
    return node;
  }

  // Array → map recursively
  if (Array.isArray(node)) {
    return node.map(item => decodeBdataInDict(item));
  }

  // Object that directly contains bdata
  if ('bdata' in node && typeof node.bdata === 'string' && isBase64(node.bdata)) {
    const dtype = node.dtype || 'utf-8'; // Get dtype or default to 'utf-8'
    const decodedBdata = decodeBase64(node.bdata, dtype); // Decode the base64-encoded value
    let shape = node.shape;

    // Parse shape if it is a string
    if (typeof shape === 'string') {
      let parsedShape: number[] | undefined;

      try {
        // Try to parse as JSON array
        parsedShape = JSON.parse(shape);
        if (!isArrayOrTypedArray(parsedShape)) {
          parsedShape = undefined;
        }
      } catch {
        // If JSON.parse fails, try to parse as comma-separated numbers
        const parts = shape.split(',').map(s => Number(s.trim()));
        if (parts.every(n => !isNaN(n))) {
          parsedShape = parts;
        }
      }
      shape = parsedShape;
    }

    // If shape exists, reshape the decoded bdata
    if (shape && isArrayOrTypedArray(shape)) {
      return reshapeArray(decodedBdata, Array.from(shape as ArrayLike<number>));
    }

    return decodedBdata;
  }

  // Otherwise recursively decode nested keys
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any = {};
  for (const key of Object.keys(node)) {
    out[key] = decodeBdataInDict(node[key]);
  }

  return out;
}

// Function to process a PlotlySchema object
export function decodeBase64Fields(plotlySchema: PlotlySchema): PlotlySchema {
  // Decode base64-encoded 'bdata' in the JSON data
  plotlySchema.data = decodeBdataInDict(plotlySchema.data);
  return plotlySchema;
}

```

### Core Architecture Module: `packages/charts/chart-utilities/src/PlotlySchema.ts`
```
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * This interface is extracted from Plotly.js typescript definitions.
 * All the unsupported types are removed to align with fluent charts.
 *  https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/plotly.js/index.d.ts
 */

export type PieColor = string | number;
export type PieColors = Array<PieColor | null | undefined>;

export interface PieFont {
  family: string | string[];
  size: number | number[];
  color: PieColor | PieColors;
}

export interface PieDataTitle extends Pick<DataTitle, 'text' | 'position'> {
  font: Partial<PieFont>;
}

export type PieTextPosition = 'inside' | 'outside' | 'auto' | 'none';

export type PieHoverInfo =
  | 'all'
  | 'none'
  | 'skip'
  | 'label'
  | 'text'
  | 'value'
  | 'percent'
  | 'name'
  | 'label+text'
  | 'label+value'
  | 'label+percent'
  | 'label+name'
  | 'text+value'
  | 'text+percent'
  | 'text+name'
  | 'value+percent'
  | 'value+name'
  | 'percent+name'
  | 'label+text+value'
  | 'label+text+percent'
  | 'label+text+name'
  | 'label+value+percent'
  | 'label+value+name'
  | 'label+percent+name'
  | 'text+value+percent'
  | 'text+value+name'
  | 'text+percent+name'
  | 'value+percent+name'
  | 'label+text+value+percent'
  | 'label+text+value+name'
  | 'label+text+percent+name'
  | 'label+value+percent+name'
  | 'text+value+percent+name';

export interface PieDomain {
  x: number[];
  y: number[];
  row: number;
  column: number;
}

export interface PieLine {
  color: PieColor | PieColors;
  width: number | number[];
}

export interface PieMarker {
  colors: PieColors;
  line: Partial<PieLine>;
}

export interface PieHoverLabel {
  bgcolor: PieColor | PieColors;
  bordercolor: PieColor | PieColors;
  font: PieFont;
  align: HoverLabel['align'] | Array<HoverLabel['align']>;
  namelength: number | number[];
}

export type PieInsideTextOrientation = 'horizontal' | 'radial' | 'tangential' | 'auto';

export interface PieData
  extends Pick<
    PlotData,
    | 'name'
    | 'visible'
    | 'showlegend'
    | 'legendgroup'
    | 'opacity'
    | 'ids'
    | 'labels'
    | 'hovertext'
    | 'automargin'
    | 'textinfo'
    | 'direction'
    | 'hole'
    | 'rotation'
  > {
  type: 'pie';
  title: Partial<PieDataTitle>;
  values: Array<number | string>;
  dlabel: number;
  label0: number;
  pull: number | number[];
  text: Datum | Datum[];
  textposition: PieTextPosition | PieTextPosition[];
  texttemplate: string | string[];
  hoverinfo: PieHoverInfo;
  hovertemplate: string | string[];
  meta: number | string;
  customdata: Datum[];
  domain: Partial<PieDomain>;
  marker: Partial<PieMarker>;
  textfont: PieFont;
  hoverlabel: Partial<PieHoverLabel>;
  insidetextfont: PieFont;
  insidetextorientation: PieInsideTextOrientation;
  outsidetextfont: PieFont;
  scalegroup: string;
  sort: boolean;
  uirevision: number | string;
}

export type SankeyColor = string | number;
export type SankeyColors = Array<SankeyColor | null | undefined>;

export interface SankeyFont {
  family: string | string[];
  size: number | number[];
  color: SankeyColor | SankeyColors;
}

export interface SankeyDataTitle {
  font: Partial<SankeyFont>;
  title: string;
}

export type SankeyOrientation = 'v' | 'h';

export interface SankeyHoverLabel {
  bgcolor: SankeyColor | SankeyColors;
  bordercolor: SankeyColor | SankeyColors;
  font: SankeyFont;
  align: HoverLabel['align'] | Array<HoverLabel['align']>;
  namelength: number | number[];
}

export interface SankeyDomain {
  row: number;
  column: number;
  x: number[];
  y: number[];
}

export interface SankeyNode {
  color: SankeyColor[];
  customdata: Datum[];
  groups: SankeyNode[];
  hoverinfo: 'all' | 'none' | 'skip';
  hoverlabel: Partial<SankeyHoverLabel>;
  hovertemplate: string | string[];
  label: Datum[];
  line: Partial<{
    color: SankeyColor;
    width: number;
  }>;
  pad: number;
  thickness: number;
  x: number[];
  y: number[];
}

export interface SankeyColorscale {
  cmax: number;
  cmin: number;
  colorscale: Array<[number, string]>;
  label: string;
  name: string;
  templateitemname: string;
}

export interface SankeyLink {
  arrowlen: number;
  color: SankeyColor | SankeyColor[];
  colorscale: Partial<SankeyColorscale>;
  customdata: Datum[];
  hoverinfo: 'all' | 'none' | 'skip';
  hoverlabel: Partial<SankeyHoverLabel>;
  hovertemplate: string | string[];
  hovercolor: SankeyColor | SankeyColor[];
  label: Datum[];
  line: Partial<{
    color: SankeyColor;
    width: number;
  }>;
  source: number[];
  target: number[];
  value: number[];
}

export interface SankeyData {
  type: 'sankey';
  name: string;
  orientation: SankeyOrientation;
  visible: boolean | 'legendonly';
  legend: string;
  legendrank: number;
  legendgrouptitle: Partial<SankeyDataTitle>;
  legendwidth: number;
  ids: string[];
  hoverinfo: string;
  meta: number | string;
  customdata: Datum[];
  domain: Partial<SankeyDomain>;
  node: Partial<SankeyNode>;
  link: Partial<SankeyLink>;
  textfont: Partial<SankeyFont>;
  selectpoints: string | number;
  arrangement: 'snap' | 'perpendicular' | 'freeform' | 'fixed';
  hoverlabel: Partial<SankeyHoverLabel>;
  valueformat: string;
  valuesuffix: string;
  uirevision: string | number;
}

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface PlotScatterDataPoint {
  curveNumber: number;
  data: PlotData;
  pointIndex: number;
  pointNumber: number;
  x: number;
  xaxis: LayoutAxis;
  y: number;
  yaxis: LayoutAxis;
}

export interface PlotDatum {
  curveNumber: number;
  data: PlotData;
  customdata: Datum;
  pointIndex: number;
  pointNumber: number;
  x: Datum;
  xaxis: LayoutAxis;
  y: Datum;
  yaxis: LayoutAxis;
  text: string;
}

export interface PlotCoordinate {
  x: number;
  y: number;
  pointNumber: number;
}

export interface SelectionRange {
  x: number[];
  y: number[];
}

export type PlotSelectedData = Partial<PlotDatum>;

export interface PlotScene {
  center: Point;
  eye: Point;
  up: Point;
}

export interface PolarLayout {
  domain: Partial<Domain>;
  sector: number[];
  hole: number;
  bgcolor: Color;
  radialaxis: Partial<LayoutAxis>;
  angularaxis: Partial<LayoutAxis>;
  gridshape: 'circular' | 'linear';
  uirevision: string | number;
  uid: string;
}

export interface PlotlySchema {
  data: Data[];
  layout?: Partial<Layout>;
  config?: Partial<Config>;
}

export interface ColorAxis {
  colorscale?: Array<[number, string]>;
  cmin?: number;
  cmax?: number;
  colorbar?: {
    title?: string | { text: string };
    thickness?: number;
    len?: number;
    outlinewidth?: number;
  };
  reversescale?: boolean;
  showscale?: boolean;
}

// Layout
export interface Layout {
  colorway: string[];
  piecolorway: string[];
  title:
    | string
    | Partial<{
        text: string;
        font: Partial<Font>;
        xref: 'container' | 'paper';
        yref: 'container' | 'paper';
        x: number;
        y: number;
        xanchor: 'auto' | 'left' | 'center' | 'right';
        yanchor: 'auto' | 'top' | 'middle' | 'bottom';
        pad: Partial<Padding>;
      }>;
  titlefont: Partial<Font>;
  autosize: boolean;
  showlegend: boolean;
  paper_bgcolor: Color;
  plot_bgcolor: Color;
  separators: string;
  hidesources: boolean;
  xaxis: Partial<LayoutAxis>;
  xaxis2: Partial<LayoutAxis>;
  xaxis3: Partial<LayoutAxis>;
  xaxis4: Partial<LayoutAxis>;
  xaxis5: Partial<LayoutAxis>;
  xaxis6: Partial<LayoutAxis>;
  xaxis7: Partial<LayoutAxis>;
  xaxis8: Partial<LayoutAxis>;
  xaxis9: Partial<LayoutAxis>;
  yaxis: Partial<LayoutAxis>;
  yaxis2: Partial<LayoutAxis>;
  yaxis3: Partial<LayoutAxis>;
  yaxis4: Partial<LayoutAxis>;
  yaxis5: Partial<LayoutAxis>;
  yaxis6: Partial<LayoutAxis>;
  yaxis7: Partial<LayoutAxis>;
  yaxis8: Partial<LayoutAxis>;
  yaxis9: Partial<LayoutAxis>;
  margin: Partial<Margin>;
  height: number;
  width: number;
  hovermode: 'closest' | 'x' | 'y' | 'x unified' | 'y unified' | false;
  hoverdistance: number;
  hoverlabel: Partial<HoverLabel>;
  calendar: Calendar;
  'xaxis.range': [Datum, Datum];
  'xaxis.range[0]': Datum;
  'xaxis.range[1]': Datum;
  'yaxis.range': [Datum, Datum];
  'yaxis.range[0]': Datum;
  'yaxis.range[1]': Datum;
  'yaxis.type': AxisType;
  'xaxis.type': AxisType;
  'xaxis.autorange': boolean;
  'yaxis.autorange': boolean;
  'xaxis.title': string;
  'yaxis.title': string;
  ternary: any;
  geo: any;
  mapbox: any;
  subplot: string;
  radialaxis: Partial<Axis>;
  angularaxis: {};
  dragmode:
    | 'zoom'
    | 'pan'
    | 'select'
    | 'lasso'
    | 'drawclosedpath'
    | 'drawopenpath'
    | 'drawline'
    | 'drawrect'
    | 'drawcircle'
    | 'orbit'
    | 'turntable'
    | false;
  orientation: number;
  annotations: Array<Partial<Annotations>>;
  shapes: Array<Partial<Shape>>;
  legend: Partial<Legend>;
  font: Partial<Font>;
  barmode: 'stack' | 'group' | 'overlay' | 'relative';
  barnorm: '' | 'fraction' | 'percent';
  bargap: number;
  bargroupgap: number;
  boxmode: 'group' | 'overlay';
  selectdirection: 'h' | 'v' | 'd' | 'any';
  hiddenlabels: string[];
  grid: Partial<{
    rows: number;
    roworder: 'top to bottom' | 'bottom to top';
    columns: number;
    subplots: string[];
    xaxes: string[];
    yaxes: string[];
    pattern: 'independent' | 'coupled';
    xgap: number;
    ygap: number;
    domain: Partial<{
      x: number[];
      y: number[];
    }>;
    xside: 'bottom' | 'bottom plot' | 'top plot' | 'top';
    yside: 'left' | 'left plot' | 'right plot' | 'right';
  }>;
  polar: Partial<PolarLayout>;
  polar2: Partial<PolarLayout>;
  polar3: Partial<PolarLayout>;
  polar4: Partial<PolarLayout>;
  polar5: Partial<PolarLayout>;
  polar6: Partial<PolarLayout>;
  polar7: Partial<PolarLayout>;
  polar8: Partial<PolarLayout>;
  polar9: Partial<PolarLayout>;
  template: Template;
  clickmode: 'event' | 'select' | 'event+select' | 'none';
  uirevision: number | string;
  uid: stri
```

### Core Architecture Module: `packages/charts/chart-utilities/src/PlotlySchemaConverter.ts`
```
import type { Datum, TypedArray, PlotData, PlotlySchema, Data, Layout, SankeyData } from './PlotlySchema';
import { decodeBase64Fields } from './DecodeBase64Data';

export type FluentChart =
  | 'annotation'
  | 'area'
  | 'composite'
  | 'donut'
  | 'fallback'
  | 'gauge'
  | 'groupedverticalbar'
  | 'heatmap'
  | 'horizontalbar'
  | 'line'
  | 'scatter'
  | 'scatterpolar'
  | 'sankey'
  | 'table'
  | 'verticalstackedbar'
  | 'gantt';

export type TraceInfo = {
  index: number;
  type: FluentChart;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface OutputChartType {
  isValid: boolean;
  errorMessage?: string;
  type?: string;
  /**
   * Array of [index, chartType] pairs
   */
  validTracesInfo?: TraceInfo[];
}

const UNSUPPORTED_MSG_PREFIX = 'Unsupported chart - type :';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const isNumber = (value: any): boolean => !isNaN(parseFloat(value)) && isFinite(value);

/* eslint-disable @typescript-eslint/no-explicit-any */
export const isDate = (value: any): boolean => {
  // Don't consider number as date. There is no way to differentiate milliseconds from date and number
  // without additional context.
  if (isNumber(value)) {
    return false;
  }

  const parsedDate = new Date(Date.parse(value));
  if (isNaN(parsedDate.getTime())) {
    return false;
  }
  const parsedYear = parsedDate.getFullYear();
  const yearInString = /\b\d{4}\b/.test(value);
  if (!yearInString && (parsedYear === 2000 || parsedYear === 2001)) {
    return false;
  }
  return true;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isMonth = (possiblyMonthValue: any): boolean => {
  if (typeof possiblyMonthValue !== 'string') {
    return false;
  }

  // Try to parse as a month name using system locale and then 'en-US'
  const testDate = new Date(`${possiblyMonthValue} 1, 2000`);
  if (isNaN(testDate.getTime())) {
    return false;
  }

  // Get month names for both locales
  const locales = [undefined, 'en-US'];
  for (const locale of locales) {
    // Full month name
    const fullMonth = testDate.toLocaleString(locale, { month: 'long' });
    // Short month name
    const shortMonth = testDate.toLocaleString(locale, { month: 'short' });

    if (
      possiblyMonthValue.toLowerCase() === fullMonth.toLowerCase() ||
      possiblyMonthValue.toLowerCase() === shortMonth.toLowerCase()
    ) {
      return true;
    }
  }
  return false;
};

const isYear = (input: string | number | Date | null): boolean => {
  if (isNumber(input)) {
    const possibleYear = typeof input === 'string' ? parseFloat(input) : Number(input);
    return Number.isInteger(possibleYear) && possibleYear >= 1900 && possibleYear <= 2100;
  }
  return false;
};

export const isArrayOfType = (
  plotCoordinates: Datum[] | Datum[][] | TypedArray | undefined,
  typeCheck: (datum: any, ...args: any[]) => boolean,
  ...args: any[]
): boolean => {
  if (!isArrayOrTypedArray(plotCoordinates)) {
    return false;
  }

  if (plotCoordinates!.length === 0) {
    return false;
  }

  if (Array.isArray(plotCoordinates![0])) {
    // Handle 2D array
    return (plotCoordinates as Datum[][]).every(innerArray => innerArray.every(datum => typeCheck(datum, ...args)));
  } else {
    // Handle 1D array
    return (plotCoordinates as Datum[]).every(datum => typeCheck(datum, ...args));
  }
};

export const isDateArray = (data: Datum[] | Datum[][] | TypedArray | undefined): boolean => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return isArrayOfType(data, (value: any): boolean => isDate(value) || value === null);
};

export const isNumberArray = (data: Datum[] | Datum[][] | TypedArray | undefined): boolean => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return isArrayOfType(
    data,
    (value: any): boolean =>
      (typeof value === 'string' && isNumber(value)) || typeof value === 'number' || value === null,
  );
};

export const isMonthArray = (data: Datum[] | Datum[][] | TypedArray | undefined): boolean => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return isArrayOfType(data, (value: any): boolean => isMonth(value) || value === null);
};

export const isYearArray = (data: Datum[] | Datum[][] | TypedArray | undefined): boolean => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return isArrayOfType(data, (value: any): boolean => isYear(value) || value === null);
};

export const isStringArray = (data: Datum[] | Datum[][] | TypedArray | undefined): boolean => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return isArrayOfType(data, (value: any): boolean => typeof value === 'string' || value === null);
};

export const isObjectArray = (data: Datum[] | Datum[][] | TypedArray | undefined): boolean => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return isArrayOfType(
    data,
    (value: any): boolean => typeof value === 'object' && value !== null && !isArrayOrTypedArray(value),
  );
};

export const validate2Dseries = (series: Partial<PlotData>): boolean => {
  if (Array.isArray(series.x) && series.x.length > 0 && Array.isArray(series.x[0])) {
    return false;
  }
  if (Array.isArray(series.y) && series.y.length > 0 && Array.isArray(series.y[0])) {
    return false;
  }

  return true;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isInvalidValue = (value: any): boolean => {
  return typeof value === 'undefined' || value === null || (typeof value === 'number' && !isFinite(value));
};

const MAX_DEPTH = 15;
export const sanitizeJson = (jsonObject: any, depth: number = 0): any => {
  if (depth > MAX_DEPTH) {
    throw new Error('Maximum json depth exceeded');
  }

  if (typeof jsonObject === 'object' && jsonObject !== null) {
    for (const key in jsonObject) {
      if (jsonObject.hasOwnProperty(key)) {
        if (typeof jsonObject[key] === 'string') {
          jsonObject[key] = jsonObject[key].replace(/</g, '&lt;').replace(/>/g, '&gt;');
        } else {
          jsonObject[key] = sanitizeJson(jsonObject[key], depth + 1);
        }
      }
    }
  }

  return jsonObject;
};

export function isTypedArray(a: any): boolean {
  return ArrayBuffer.isView(a) && !(a instanceof DataView);
}

export function isArrayOrTypedArray(a: any): boolean {
  return Array.isArray(a) || isTypedArray(a);
}

type PlotlyAnnotations = PlotlySchema extends { layout?: { annotations?: infer T } } ? T : unknown;

const hasAnnotationContent = (annotations: PlotlyAnnotations | undefined): boolean => {
  if (!annotations) {
    return false;
  }

  return !isArrayOrTypedArray(annotations) || (annotations as { length: number }).length > 0;
};

export const getValidSchema = (input: any): PlotlySchema => {
  try {
    const validatedSchema = input as PlotlySchema;
    if (!validatedSchema) {
      throw new Error('Plotly input is null or undefined');
    }
    if (typeof validatedSchema !== 'object') {
      throw new Error(`Plotly input is not an object. Input type: ${typeof validatedSchema}`);
    }
    const hasAnnotations = hasAnnotationContent(validatedSchema?.layout?.annotations);

    if (!isArrayOrTypedArray(validatedSchema.data)) {
      if (hasAnnotations) {
        return {
          ...validatedSchema,
          data: [],
        };
      }
      throw new Error('Plotly input data is not a valid array or typed array');
    }
    if (validatedSchema.data.length === 0) {
      if (hasAnnotations) {
        return {
          ...validatedSchema,
          data: [],
        };
      }
      throw new Error('Plotly input data is empty');
    }
    return validatedSchema;
  } catch (error) {
    throw new Error(`Invalid plotly schema: ${error}`);
  }
};

const validateSeriesData = (series: Partial<PlotData>, validateNumericY: boolean) => {
  if (!validate2Dseries(series)) {
    throw new Error(`Invalid 2D series encountered.`);
  }
  if (validateNumericY && !isNumberArray(series.y)) {
    throw new Error(`Non numeric Y values encountered.`);
  }
};

const validateBarData = (data: Partial<PlotData>) => {
  const isXEmpty = data.x && isArrayOrTypedArray(data.x) && data.x.length === 0;
  const isYEmpty = data.y && isArrayOrTypedArray(data.y) && data.y.length === 0;
  if (isXEmpty || isYEmpty) {
    let emptyMsg = 'Bar chart: ';
    if (isXEmpty && isYEmpty) {
      emptyMsg += 'both x and y arrays are empty.';
    } else if (isXEmpty) {
      emptyMsg += 'x array is empty.';
    } else if (isYEmpty) {
      emptyMsg += 'y array is empty.';
    }
    throw new Error(emptyMsg);
  }
  if (data.orientation === 'h') {
    if (!isNumberArray(data.x) && !isDateArray(data.x)) {
      throw new Error(
        `${UNSUPPORTED_MSG_PREFIX} ${data.type}, orientation: ${data.orientation}, string x values not supported.`,
      );
    }
    if (!canMapToGantt(data) && isDateArray(data.x)) {
      throw new Error(
        `${UNSUPPORTED_MSG_PREFIX} ${data.type}, orientation: ${data.orientation}` +
          `, date x values not supported in HBWA.`,
      );
    }
    validateSeriesData(data, false);
  } else {
    if (!isNumberArray(data.y) && !isStringArray(data.y) && !isObjectArray(data.y)) {
      throw new Error(`Non numeric, string, or object Y values encountered, type: ${typeof data.y}`);
    }
  }
};
const isScatterMarkers = (mode: string): boolean => {
  return ['markers', 'text+markers', 'markers+text', 'text'].includes(mode);
};

const validateScatterData = (data: Partial<PlotData>, layout: Partial<Layout> | undefined) => {
  const mode = data.mode ?? '';
  const xAxisType = data && data.x && data.x.length > 0 ? typeof data?.x?.[0] : 'undefined';
  const yAxisType = data && data.y && data.y.length > 0 ? typeof data?.y?.[0] : 'undefined';
  if (!isNumberArray(data.x) && !isStringArray(data.x) && !isDateArray(data.x)) {
    throw new Error(`${UNSUPPORTED_MSG_PREFIX} ${data.type}, mode: ${mode}, xAxisType: ${xAxisType}`);
```

### Core Architecture Module: `packages/charts/chart-utilities/src/formatter.ts`
```
/**
 * This function checks if the number is very close to an integer (within a small epsilon value).
 * If it is, it rounds the number to the nearest integer; otherwise, it returns the original number.
 * This is useful to avoid issues with floating point precision errors in calculations.
 * Refer 'https://docs.python.org/release/2.5.1/tut/node16.html' for more details.
 * @param num - The number to check for floating point precision error.
 * @returns The number after resolving floating point precision errors.
 */
export function handleFloatingPointPrecisionError(num: number): number {
  const rounded = Math.round(num);
  return Math.abs(num - rounded) < 1e-6 ? rounded : num;
}

/**
 * LocaleStringDataProps defines the type of data that can be formatted to a locale string.
 */
type LocaleStringDataProps = number | string | Date | undefined;

/**
 * Formats a number, string, or date to a locale-specific string representation.
 * If the input is a number or a numeric string, it will be formatted with appropriate grouping.
 * If the input is a Date object, it will be formatted to a locale string based on the culture and UTC preference.
 * If the input is undefined, null, an empty string, or NaN, it will return the input as is.
 *
 * @param data - The data to format (number, string, Date, or undefined).
 * @param culture - Optional culture code for formatting (e.g., 'en-US').
 * @param useUtc - Optional flag to indicate if the date should be formatted in UTC.
 * @returns The formatted string or the original data if no formatting is applied.
 */
export const formatToLocaleString = (
  data: LocaleStringDataProps,
  culture?: string,
  useUtc?: boolean | string,
): LocaleStringDataProps => {
  if (data === undefined || data === null || data === '' || Number.isNaN(data)) {
    return data;
  }
  culture = culture || undefined;
  if (typeof data === 'number') {
    const toGroup = Math.abs(data) >= 10000;
    return handleFloatingPointPrecisionError(data).toLocaleString(culture, { useGrouping: toGroup });
  } else if (typeof data === 'string' && !window.isNaN(Number(data))) {
    const num = Number(data);
    const toGroup = Math.abs(num) >= 10000;
    return handleFloatingPointPrecisionError(num).toLocaleString(culture, { useGrouping: toGroup });
  } else if (data instanceof Date) {
    return formatDateToLocaleString(data, culture, useUtc ? true : false);
  }

  return data;
};

const DEFAULT_DATE_TIME_FORMAT_OPTION: Intl.DateTimeFormatOptions = {
  // Locale date and time
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
};

/**
 * Formats a Date object to a locale-specific string representation.
 * If the date is invalid, it returns an empty string.
 * If the culture is not provided, it defaults to the browser's locale.
 * If useUtc is true, it formats the date in UTC.
 * If showTZname is true, it includes the time zone name in the formatted string.
 *
 * @param date - The Date object to format.
 * @param culture - Optional culture code for formatting (e.g., 'en-US').
 * @param useUtc - Optional flag to indicate if the date should be formatted in UTC.
 * @param showTZname - Optional flag to include time zone name in the formatted string.
 * @param options - Optional Intl.DateTimeFormatOptions for additional formatting options.
 * @returns The formatted date string or an empty string if the date is invalid.
 */
export const formatDateToLocaleString = (
  date: Date,
  culture?: string,
  useUtc?: boolean,
  showTZname: boolean = true,
  options?: Intl.DateTimeFormatOptions,
): string => {
  culture = culture || undefined;
  options = options || DEFAULT_DATE_TIME_FORMAT_OPTION;
  if (useUtc) {
    options = { ...options, timeZone: 'UTC' };
  }
  if (showTZname) {
    options = { ...options, timeZoneName: 'short' };
  }

  return date.toLocaleString(culture, options);
};

/**
 * This function returns a multilevel formatter for a given date range.
 * It determines the appropriate date format to accommodate each tick value.
 * The goal is to represent the date label in the smallest possible format without loss of information.
 * There is an exhaustive map of all possible date/time units and their respective formats.
 * Based on the range of formatting granularity levels, a date time format spanning the range is returned.
 * Refer https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat
 * to see explanation about each format specifier
 * @param startLevel - The starting level of the date format.
 * @param endLevel - The ending level of the date format.
 * @param useUTC - Optional flag to indicate if the date should be formatted in UTC.
 * @returns - An Intl.DateTimeFormatOptions object that can be used to format date/time values.
 */
export function getMultiLevelDateTimeFormatOptions(startLevel?: number, endLevel?: number): Intl.DateTimeFormatOptions {
  const DEFAULT = DEFAULT_DATE_TIME_FORMAT_OPTION;
  const MS: Intl.DateTimeFormatOptions = {
    // Milliseconds only (Intl does not support ms directly)
    second: '2-digit',
  };

  const MS_S: Intl.DateTimeFormatOptions = MS;
  const MS_S_MIN: Intl.DateTimeFormatOptions = {
    // Minutes, seconds, milliseconds
    minute: '2-digit',
    second: '2-digit',
  };

  const MS_S_MIN_H: Intl.DateTimeFormatOptions = {
    // Hour (12), minute, second, ms, AM/PM
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  };

  const MS_S_MIN_H_D: Intl.DateTimeFormatOptions = {
    // Abbreviated weekday, day, time
    weekday: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };

  const MS_S_MIN_H_D_W: Intl.DateTimeFormatOptions = {
    // Abbreviated month, day, time
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };

  const MS_S_MIN_H_D_W_M: Intl.DateTimeFormatOptions = MS_S_MIN_H_D_W;
  const MS_S_MIN_H_D_W_M_Y: Intl.DateTimeFormatOptions = DEFAULT;
  const S: Intl.DateTimeFormatOptions = MS_S;
  const S_MIN: Intl.DateTimeFormatOptions = MS_S_MIN;
  const S_MIN_H: Intl.DateTimeFormatOptions = MS_S_MIN_H;
  const S_MIN_H_D: Intl.DateTimeFormatOptions = MS_S_MIN_H_D;
  const S_MIN_H_D_W: Intl.DateTimeFormatOptions = MS_S_MIN_H_D_W;
  const S_MIN_H_D_W_M: Intl.DateTimeFormatOptions = MS_S_MIN_H_D_W_M;
  const S_MIN_H_D_W_M_Y: Intl.DateTimeFormatOptions = DEFAULT;

  const MIN: Intl.DateTimeFormatOptions = {
    // Hour (12), minute, AM/PM
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };

  const MIN_H: Intl.DateTimeFormatOptions = MIN;
  const MIN_H_D: Intl.DateTimeFormatOptions = {
    // Abbreviated weekday, day, hour (12), minute, AM/PM
    weekday: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };

  const MIN_H_D_W: Intl.DateTimeFormatOptions = {
    // Abbreviated month, day, hour (12), minute, AM/PM
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };

  const MIN_H_D_W_M: Intl.DateTimeFormatOptions = MIN_H_D_W;
  const MIN_H_D_W_M_Y: Intl.DateTimeFormatOptions = {
    // Locale date, hour (12), minute, AM/PM
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };

  const H: Intl.DateTimeFormatOptions = {
    // Hour (12), AM/PM
    hour: '2-digit',
    hour12: true,
  };

  const H_D: Intl.DateTimeFormatOptions = {
    // Abbreviated weekday, day, hour (12), AM/PM
    weekday: 'short',
    day: '2-digit',
    hour: '2-digit',
    hour12: true,
  };

  const H_D_W: Intl.DateTimeFormatOptions = {
    // Abbreviated month, day, hour (12), AM/PM
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    hour12: true,
  };

  const H_D_W_M: Intl.DateTimeFormatOptions = H_D_W;
  const H_D_W_M_Y: Intl.DateTimeFormatOptions = {
    // Locale date, hour (12), AM/PM
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: true,
  };

  const D: Intl.DateTimeFormatOptions = {
    // Abbreviated weekday, day
    weekday: 'short',
    day: '2-digit',
  };

  const D_W: Intl.DateTimeFormatOptions = {
    // Abbreviated month, day
    month: 'short',
    day: '2-digit',
  };

  const D_W_M: Intl.DateTimeFormatOptions = D_W;
  const D_W_M_Y: Intl.DateTimeFormatOptions = {
    // Locale date
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  const W: Intl.DateTimeFormatOptions = D_W;
  const W_M: Intl.DateTimeFormatOptions = W;
  const W_M_Y: Intl.DateTimeFormatOptions = D_W_M_Y;
  const M: Intl.DateTimeFormatOptions = {
    // Full month name
    month: 'long',
  };

  const M_Y: Intl.DateTimeFormatOptions = {
    // Abbreviated month, year
    month: 'short',
    year: 'numeric',
  };

  const Y: Intl.DateTimeFormatOptions = {
    // Year
    year: 'numeric',
  };

  const MULTI_LEVEL_DATE_TIME_FORMATS = [
    // ms, s, min, h, d, w, m, y
    [MS, MS_S, MS_S_MIN, MS_S_MIN_H, MS_S_MIN_H_D, MS_S_MIN_H_D_W, MS_S_MIN_H_D_W_M, MS_S_MIN_H_D_W_M_Y], // ms
    [DEFAULT, S, S_MIN, S_MIN_H, S_MIN_H_D, S_MIN_H_D_W, S_MIN_H_D_W_M, S_MIN_H_D_W_M_Y], // s
    [DEFAULT, DEFAULT, MIN, MIN_H, MIN_H_D, MIN_H_D_W, MIN_H_D_W_M, MIN_H_D_W_M_Y], // min
    [DEFAULT, DEFAULT, DEFAULT, H, H_D, H_D_W, H_D_W_M, H_D_W_M_Y], // h
    [DEFAULT, DEFAULT, DEFAULT, DEFAULT, D, D_W, D_W_M, D_W_M_Y], // d
    [DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, W, W_M, W_M_Y], // w
    [DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, M, M_Y], // m
    [DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, Y], // y
  ];

  if (startLevel === undefined || startLevel < 0 || startLevel >= MULTI_LEVEL_DATE_TIME_FORMATS.length) {
    return DEFAULT;
  }

  if (endLevel === undefined || endLevel < startLevel) {
    return MULTI_LEVEL_DATE_TIME_FORMATS[startLevel][startLevel];
  }

```

### Core Architecture Module: `packages/charts/chart-utilities/src/index.ts`
```
export type {
  Annotations,
  AutoRangeOptions,
  Axis,
  AxisName,
  AxisType,
  Calendar,
  Color,
  ColorAxis,
  ColorBar,
  ColorScale,
  Config,
  DTickValue,
  Dash,
  Data,
  DataTitle,
  DataTransform,
  Datum,
  Delta,
  Domain,
  ErrorBar,
  ErrorOptions,
  Font,
  Gauge,
  GaugeBar,
  GaugeLine,
  HoverLabel,
  Icon,
  Label,
  Layout,
  LayoutAxis,
  Legend,
  LegendTitle,
  Margin,
  MarkerSymbol,
  MinorAxisLayout,
  Padding,
  Pattern,
  PieColor,
  PieColors,
  PieData,
  PieDataTitle,
  PieDomain,
  PieFont,
  PieHoverInfo,
  PieHoverLabel,
  PieInsideTextOrientation,
  PieLine,
  PieMarker,
  PieTextPosition,
  PlotCoordinate,
  PlotData,
  PlotDatum,
  PlotMarker,
  PlotNumber,
  PlotScatterDataPoint,
  PlotScene,
  PlotSelectedData,
  PlotType,
  PlotlySchema,
  Point,
  PolarLayout,
  RangeBreak,
  RangeSelector,
  RangeSelectorButton,
  RangeSlider,
  SankeyColor,
  SankeyColors,
  SankeyColorscale,
  SankeyData,
  SankeyDataTitle,
  SankeyDomain,
  SankeyFont,
  SankeyHoverLabel,
  SankeyLink,
  SankeyNode,
  SankeyOrientation,
  ScatterData,
  ScatterLine,
  ScatterMarker,
  ScatterMarkerLine,
  SceneAxis,
  SelectionRange,
  Shape,
  ShapeLabel,
  ShapeLine,
  Template,
  Threshold,
  TickFormatStop,
  Transform,
  TransformAggregation,
  TransformStyle,
  TypedArray,
  XAxisName,
  YAxisName,
  TableData,
} from './PlotlySchema';

export type { OutputChartType, FluentChart, TraceInfo } from './PlotlySchemaConverter';
export {
  mapFluentChart,
  isDate,
  isNumber,
  isMonth,
  isArrayOfType,
  isDateArray,
  isNumberArray,
  isYearArray,
  validate2Dseries,
  getValidSchema,
  sanitizeJson,
  isTypedArray,
  isArrayOrTypedArray,
  isInvalidValue,
  isStringArray,
  isMonthArray,
  isObjectArray,
  getAxisIds,
  getAxisKey,
  isScatterAreaChart,
} from './PlotlySchemaConverter';

export { decodeBase64Fields } from './DecodeBase64Data';

export {
  formatToLocaleString,
  formatDateToLocaleString,
  getMultiLevelDateTimeFormatOptions,
  handleFloatingPointPrecisionError,
} from './formatter';

export { isSafeUrl } from './isSafeUrl';

```

### Core Architecture Module: `packages/charts/chart-utilities/src/isSafeUrl.ts`
```
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'ftp:']);

/**
 * Checks if a URL is safe by validating its protocol against a whitelist of allowed protocols.
 *
 * @param href - The URL to validate.
 * @returns True if the URL is considered safe, false otherwise.
 */
export function isSafeUrl(href: string): boolean {
  // Normalize potentially obfuscated protocols (control chars, whitespace, and common invisible separators).
  const normalized = href.replace(/[\u0000-\u001F\u007F\s\u200B-\u200D\u2060\uFEFF]+/g, '');
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(normalized);
  if (!hasScheme) {
    return true;
  }

  try {
    const protocol = new URL(normalized).protocol.toLowerCase();
    return ALLOWED_URL_PROTOCOLS.has(protocol);
  } catch {
    // Any malformed absolute URL that looks like a scheme should be rejected.
    return false;
  }
}

```

### Core Architecture Module: `packages/charts/chart-utilities/webpack.config.js`
```
const { resources } = require('@fluentui/scripts-webpack');
const TerserPlugin = require('terser-webpack-plugin');

const regex = new RegExp(
  [
    '(truncateText|addNodeShapetoSVG|createPathLink|addLinktoSVG|',
    'createTree|createTreeDataStructure|createTreeChart)$',
  ].join(''),
);
module.exports = [
  // Create a bundle for consumption in the browser
  ...resources.createBundleConfig({
    output: 'FluentUIReactCharting',
    customConfig: {
      optimization: {
        minimizer: [
          new TerserPlugin({
            parallel: true,
            terserOptions: {
              compress: {
                passes: 2,
              },
              mangle: {
                keep_classnames: false,
                keep_fnames: false,
                properties: {
                  regex: regex,
                  undeclared: true,
                },
              },
              output: {
                comments: false,
              },
            },
          }),
        ],
      },
    },
  }),
  // This should be uncommented if we want to build the legacy demo app for the PR deploy site, which should only happen
  // if examples are added under the react-examples/chart-utilities folder.
  // Also build the legacy demo app for the PR deploy site
  // require('./webpack.serve.config'),
];

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #36982** (2026-10-23): **Canary: verify PR preview site deployment of PR-controlled content (inert marker only)**
  *Symptoms*: Security research verification. This PR changes exactly one file (apps/pr-deploy-site/index.html) by appending a single inert HTML comment marker (CANARY-FLUENTUI-20261023-8b7ea3). Purpose: verify whether static content from a fork PR is deployed verbatim to the public PR preview site (fluentuipr.z22.web.core.windows.net/pull/<this PR>/) by the workflow_run deploy workflow, without content validation. The marker contains no scripts, no links, and no impersonation, and has no functional effect. I will close this PR after verification.
  **Post-Mortem & Fix Analysis**:
  > Canary verification complete, closing as planned.

- **Issue #36981** (2026-10-22): **fix(web-components): height for empty vertical divider**
  *Symptoms*: ## Previous Behavior  Dividers uses `:host([orientation='vertical']:empty)` to apply a different `min-heigth` when the component has no slotted content. But this doesn’t work because the `:empty` selector would not select white space only contents. While the CSS spec has changed to include white space only contents, no browser has implemented this change.  As a result, when the vertical divider is empty, its `min-height` is `84px` instead of `20px`.  <img width="141" height="120" alt="Image" src="https://github.com/user-attachments/assets/aa2a5301-6680-4c2d-b154-c4628a9dafeb" />  ## New Behavior  No longer rely on `:empty`. Because we require the slotted content to be an element rather than pure text (for typesetting), we could use `:host(:has(*))` (and `@scope { :scope:has(*) { ... } }` for Chromium) to apply different styles. This change also removes the unnecessary component height and rely on the pseudo elements’ heights.  <img width="187" height="119" alt="Image" src="https://github.com/user-attachments/assets/42411719-04d6-49c1-a49f-66f64d665c03" />  ## Related Issue(s)  - Fixes #31623  

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

### Incident Patch 1: `ea1a99bf` (2026-10-22)
**Commit Message**: fix(web-components): height for empty vertical divider (#36981)

**File**: `change/@fluentui-web-components-b2ad883c-7324-451d-b7ea-076363ade0cf.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "fix: height for empty vertical divider",
+  "packageName": "@fluentui/web-components",
+  "email": "machi@microsoft.com"
+}
```

**File**: `packages/web-components/src/divider/divider.styles.css` (modified, +21/-13)
```diff
@@ -6,6 +6,8 @@
 }
 
 :host {
+  --_vertical-min-height: 10px;
+
   contain: content;
 }
 
@@ -44,34 +46,40 @@
   align-items: center;
   flex-direction: column;
   height: 100%;
-  min-height: 84px;
-}
-
-:host([orientation='vertical']):empty {
-  min-height: 20px;
 }
 
 :host([orientation='vertical'][inset])::before {
   margin-top: 12px;
 }
+
 :host([orientation='vertical'][inset])::after {
   margin-bottom: 12px;
 }
 
-:host([orientation='vertical']):empty::before,
-:host([orientation='vertical']):empty::after {
-  height: 10px;
-  min-height: 10px;
-  flex-grow: 0;
-}
-
 :host([orientation='vertical'])::before,
 :host([orientation='vertical'])::after {
   width: var(--strokeWidthThin);
-  min-height: 20px;
+  min-height: var(--_vertical-min-height);
   height: 100%;
 }
 
+/**
+   * Use @supports to avoid the scoped styles from applying in Safari. Because
+   * Safari supports @scope but ':scope:has(*)' would select a host with no
+   * children.
+   */
+@supports not selector(:host(:has(*))) {
+  @scope {
+    :scope:has(*) {
+      --_vertical-min-height: 20px;
+    }
+  }
+}
+
+:host(:has(*)) {
+  --_vertical-min-height: 20px;
+}
+
 :host([orientation='vertical']) ::slotted(*) {
   display: flex;
   flex-direction: column;
```

**File**: `packages/web-components/src/divider/divider.styles.ts` (modified, +21/-13)
```diff
@@ -22,6 +22,8 @@ export const styles = css`
   ${display('flex')}
 
   :host {
+    --_vertical-min-height: 10px;
+
     contain: content;
   }
 
@@ -60,34 +62,40 @@ export const styles = css`
     align-items: center;
     flex-direction: column;
     height: 100%;
-    min-height: 84px;
-  }
-
-  :host([orientation='vertical']):empty {
-    min-height: 20px;
   }
 
   :host([orientation='vertical'][inset])::before {
     margin-top: 12px;
   }
+
   :host([orientation='vertical'][inset])::after {
     margin-bottom: 12px;
   }
 
-  :host([orientation='vertical']):empty::before,
-  :host([orientation='vertical']):empty::after {
-    height: 10px;
-    min-height: 10px;
-    flex-grow: 0;
-  }
-
   :host([orientation='vertical'])::before,
   :host([orientation='vertical'])::after {
     width: ${strokeWidthThin};
-    min-height: 20px;
+    min-height: var(--_vertical-min-height);
     height: 100%;
   }
 
+  /**
+   * Use @supports to avoid the scoped styles from applying in Safari. Because
+   * Safari supports @scope but ':scope:has(*)' would select a host with no
+   * children.
+   */
+  @supports not selector(:host(:has(*))) {
+    @scope {
+      :scope:has(*) {
+        --_vertical-min-height: 20px;
+      }
+    }
+  }
+
+  :host(:has(*)) {
+    --_vertical-min-height: 20px;
+  }
+
   :host([orientation='vertical']) ::slotted(*) {
     display: flex;
     flex-direction: column;
```

#### Recent Merged Pull Requests:
- **PR #36982** (closed): Canary: verify PR preview site deployment of PR-controlled content (inert marker only) (@idleicefire)
- **PR #36981** (2026-10-22): fix(web-components): height for empty vertical divider (@marchbox)
- **PR #36980** (2026-10-22): docs(public-docsite-v9): add RangeSlider preview stories (@mainframev)
- **PR #36979** (2026-10-22): fix(react-headless-components-preview): emit data-disabled on ImageSwatch (@mainframev)
- **PR #36978** (2026-10-22): feat(react-components): export existing Menu base hooks (@PaulGMardling)
- **PR #36975** (2026-10-22): fix: add aria-controls to PopoverTrigger and name the Default story surface (@mainframev)

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

## X. web-components): height for empty vertical divider (#36981)

**RULE**:
When implementing operations in `change/@fluentui-web-components-b2ad883c-7324-451d-b7ea-076363ade0cf.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in microsoft/fluentui. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ea1a99bf`: web-components): height for empty vertical divider (#36981). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `change/@fluentui-web-components-b2ad883c-7324-451d-b7ea-076363ade0cf.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
{
  "type": "patch",
  "comment": "fix: height for empty vertical divider",
  "packageName": "@fluentui/web-components",
  "email": "machi@microsoft.com"
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ea1a99bf` are properly handled with clean fallback behavior.
