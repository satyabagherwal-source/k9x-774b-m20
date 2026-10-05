# Forensic Learning Record (Deep Inspection): microsoft/fluentui

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-fluentui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/fluentui](https://github.com/microsoft/fluentui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:28:25.395Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/fluentui`
- **Description**: Fluent UI web represents a collection of utilities, React components, and web components for building web applications.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 20312 stars

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
import { PlotlySchema } from './PlotlySchema';
import { isArrayOrTypedArray } from './PlotlySchemaConverter';

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

// Helper to reshape a flat array into the given shape (e.g., [rows, cols])
export function reshapeArray(data: number[], shape: number[]): number[] | number[][] | number[][][] {
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
    result.push(reshapeArray(data.slice(i * step, (i + 1) * step), rest) as number[][]);
  }
  return result;
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
      return reshapeArray(decodedBdata, shape as number[]);
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

### Core Architecture Module: `packages/charts/chart-utilities/webpack.serve.config.js`
```
const { resources } = require('@fluentui/scripts-webpack');

module.exports = resources.createLegacyDemoAppConfig();

```

### Core Architecture Module: `packages/charts/chart-web-components/src/utils/benchmark-wrapper.ts`
```
// eslint-disable-next-line
// @ts-nocheck
import { tests } from '@tensile-perf/web-components';
import { webLightTheme } from '@fluentui/tokens';
import { setTheme } from '@fluentui/web-components';

const testWrapper = (test: any, args: any) => {
  setTheme(webLightTheme);
  return test(args);
};

const wrappedTests = {};

for (const testName of Object.keys(tests)) {
  const test = tests[testName];

  wrappedTests[testName] = (args: any) => {
    return testWrapper(test, args);
  };
}

export { wrappedTests as tests };

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #36835** (2026-10-05): **fix(positioning): keep popups aligned during ancestor motion**
  *Symptoms*: <!-- Thank you for submitting a pull request!  Please verify that: * [ ] Code is up-to-date with the `master` branch * [x] Your changes are covered by tests (if possible) * [x] You've run `yarn change` locally   PR flow tips: * [x] Try to start with a Draft PR * [ ] Once you're ready (ideally the pipeline is passing) promote your PR to Ready for Review. This step will auto-assign reviewers for your PR. -->  ## Previous Behavior  <!-- This is the behavior we have today -->  Immediately open positioned content inside Dialog could retain coordinates calculated during DialogSurface's entry animation. This caused TagPicker dropdowns to become misaligned when suggestions were already available on reopening.  The browser regression reproduced approximately 21px of drift before the fix.  ## New Behavior  <!-- This is the behavior we should expect with the changes in this PR -->  The shared positioning manager detects finite, running native animations on the target/container and their composed DOM ancestors. It updates positioning on animation frames while that motion is active, performs a final correction after completion or cancellation, and stops scheduling frames when motion has settled. A generation guard prevents older asynchronous positioning results from overwriting newer coordinates, and disposal cancels pending frames.  The implementation is localized to `createPositionManager.ts`. It adds **no public props, options, context exports, dependencies, or motion-system changes**.
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  | Package & Exports | Baseline (minified/GZIP) | PR    | Change     | | :---------------- | -----------------------: | ----: | ---------: | | <samp>react-charts</samp> <br /> <abbr title='bundle-size/AreaChart.fixture.js'>AreaChart</abbr>  | `408.522 kB`<br />`127.732 kB` | `409.189 kB`<br />`127.941 kB` | `667 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />`209 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" />| | <samp>react-charts</samp> <br /> <abbr title='bundle-size/DeclarativeChart.fixture.js'>DeclarativeChart</abbr>  | `761.462 kB`<br />`223.49 kB` | `762.129 kB`<br />`223.709 kB` | `667 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />`219 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" />| | <samp>react-charts</samp> <br /> <abbr title='bundle-size/DonutChart.fixture.js
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36835/) <!-- Sticky Pull Request Commentdeploy-pr-site -->

- **Issue #36831** (2026-10-05): **fix(workspace-plugin): support .storybook/main.cjs in split-library-in-two and storybook target inference**
  *Symptoms*: ## Previous Behavior  Since the ESM-first change (#36327), the `react-library` template ships `.storybook/main.cjs`, but the tooling still only looks at `main.js`:  - `split-library-in-two` only rewrote `.storybook/main.js`. In a generated package, `main.cjs` kept the paths from before the split: the root config resolved to `packages/.storybook/main`, and the story globs pointed to `stories/stories`. - The workspace plugin only inferred `storybook`/`start` targets from `.storybook/main.js`, so the generated stories project had no Storybook target and the library's `start` forwarded to a target that didn't exist. - `.storybook/tsconfig.json` only included `*.js`, so `main.cjs` wasn't type-checked.  ## New Behavior  - `split-library-in-two` updates paths in `main.js` or `main.cjs`, whichever exists, and includes `*.cjs` in `.storybook/tsconfig.json`. - The workspace plugin infers the `storybook` target from either file. - Specs cover all three: the split generator, plugin target inference, and the full `react-library` output.  I ran the generator end to end: the generated stories project now has `storybook` and `start` targets, and `main.cjs` resolves the root config. Targets of the existing `main.cjs` projects (`web-components`, `chart-web-components`, `vr-tests-web-components`) are unchanged.  Found in review of #36811, which is stacked on this PR 
  **Post-Mortem & Fix Analysis**:
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36831/) <!-- Sticky Pull Request Commentdeploy-pr-site -->
  > ## 📊 Bundle size report  ✅ No changes found  <!-- Sticky Pull Request Commentbundle-size-report -->
  > probably not best idea to have this fix as part of the stack as it is completely unrelated

- **Issue #36822** (2026-10-04): **fix(react-swatch-picker): default ImageSwatch and EmptySwatch to type="button"**
  *Symptoms*: ## Previous Behavior  `ImageSwatch` and `EmptySwatch` render a `<button>` without a `type`, so the browser treats it as `type="submit"`. Inside a `<form>`, clicking a swatch submits the form. `ColorSwatch` doesn't have this problem because it already sets `type="button"`.  ## New Behavior  `ImageSwatch` and `EmptySwatch` default to `type="button"`, like `ColorSwatch`. The default is set before the props spread, so a `type` prop still overrides it.  The fix is in the `@fluentui/react-swatch-picker` base hooks, so both the styled v9 components and `@fluentui/react-headless-components-preview` get it
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  | Package & Exports | Baseline (minified/GZIP) | PR    | Change     | | :---------------- | -----------------------: | ----: | ---------: | | <samp>react-components</samp> <br /> <abbr title='bundle-size/BaseHooks.fixture.js'>react-components: all base hooks</abbr>  | `217.423 kB`<br />`68.185 kB` | `218.199 kB`<br />`68.412 kB` | `776 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />`227 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" />| | <samp>react-components</samp> <br /> <abbr title='bundle-size/ButtonProviderAndTheme.fixture.js'>react-components: Button, FluentProvider & webLightTheme</abbr>  | `67.471 kB`<br />`19.465 kB` | `67.731 kB`<br />`19.588 kB` | `260 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />`123 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" />| | <samp>r
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36822/) <!-- Sticky Pull Request Commentdeploy-pr-site -->

- **Issue #36821** (2026-10-05): **fix(react-headless-components-preview): enter SwatchPicker on the selected swatch**
  *Symptoms*: ## Previous Behavior  With `focusMode="arrow"`, Tab always enters `SwatchPicker` on the first swatch, and coming back in returns focus to whichever swatch was focused last, not the selected one. For example: select Blue, press ArrowRight to Purple, Tab out, Shift+Tab back. Focus lands on Purple.  This doesn't match the [radio group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/): when a radio is checked, focus should move to the checked one.  ## New Behavior  Focus enters the picker on the selected swatch, the same way `TabList` and `Tab` already work:  - Selected `ColorSwatch` and `ImageSwatch` roots get `focusgroupstart`. - While a value is selected, `SwatchPicker` adds `nomemory` to `focusgroup`. With no selection it keeps focus memory, so focus still returns to the last focused swatch.  Components built on the headless package get this by default and don't have to set `focusgroupstart` themselves.  Note: this matches the keyboard behavior the Fluent design spec defines for SwatchPicker:  > **Tab / Shift+Tab** — moves focus into or out of SwatchPicker as one composite tab stop. Entry lands on the selected Swatch, or the first enabled Swatch when no value is selected. > > When focus leaves and later returns, it returns to the selected Swatch; when no value is selected, it returns to the most recently focused enabled Swatch. > > **Focus lifecycle:** SwatchPicker is one page-level tab stop. Focus enters on the selected or first enabled Swatch, remains on the committ
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  | Package & Exports | Baseline (minified/GZIP) | PR    | Change     | | :---------------- | -----------------------: | ----: | ---------: | | <samp>react-headless-components-preview</samp> <br /> <abbr title='bundle-size/AllComponents.fixture.js'>react-headless-components-preview: entire library</abbr>  | `242.149 kB`<br />`68.258 kB` | `242.268 kB`<br />`68.28 kB` | `119 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />`22 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" />|  <details> <summary>Unchanged fixtures</summary>  | Package & Exports | Size (minified/GZIP) | | ----------------- | -------------------: | | <samp>react-headless-components-preview</samp> <br /> <abbr title='bundle-size/TagPicker.fixture.js'>@fluentui/react-headless-components-preview/tag-picker</abbr> | `54.012 kB`<br />`17.756 kB` | | <samp>react-headless-components-preview</samp> <br /> <abbr tit
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36821/) <!-- Sticky Pull Request Commentdeploy-pr-site -->
  > The previous behavior mentioned in the PR is exactly the same we have in v9 currently:  https://github.com/user-attachments/assets/5f50a296-1c44-459b-a604-3860fb00e633  So eitherwe should change it everywhere or don't change it in headless as well. 

- **Issue #36820** (2026-10-01): **ci: invoke v8 site manifest generator directly**
  *Symptoms*: ## Previous Behavior  The v8 release pipeline runs `yarn create-site-manifests ./packages/react` from the repository root. Yarn 4 fails with `Couldn't find a script named "create-site-manifests"` because the command is a binary declared by `@fluentui/public-docsite-setup`, not a root script or a binary supplied by a root dependency.  ## New Behavior  Invoke the existing generator directly with Node:  ```sh node ./packages/public-docsite-setup/bin/create-site-manifests.js ./packages/react ```  This retains the repository-root working directory, so `site-manifests/v8-prod.js` and `site-manifests/v8-df.js` are written to the existing artifact location. The package's compiled exports are produced by the preceding v8 build step.  Validation on Node 22: - Reproduced the original Yarn resolution failure. - Built `public-docsite-setup` through Nx. - Executed the command extracted from the pipeline YAML and verified both manifest filenames, package version, matching contents, valid creation date, and build-specific CDN URL. - Verified custom CDN URLs and rejection of missing arguments, nonexistent package paths, and unsupported URLs. - Passed Nx formatting, YAML parsing, and `git diff --check`; reran formatting and artifact checks after rebasing onto current master.  Node 24 and the full Azure release pipeline were not verified locally. No beachball change file is required because this changes only pipeline configuration.  ## Related Issue(s)  Fixes the v8 release CI failure reported 
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  ✅ No changes found  <!-- Sticky Pull Request Commentbundle-size-report -->
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36820/) <!-- Sticky Pull Request Commentdeploy-pr-site -->

- **Issue #36818** (2026-10-01): **fixed tooltip value cut off at the bottom in HorizontalBarChartWithAxis**
  *Symptoms*: fixed tooltip value cut off at the bottom in HorizontalBarChartWithAxis
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  | Package & Exports | Baseline (minified/GZIP) | PR    | Change     | | :---------------- | -----------------------: | ----: | ---------: | | <samp>react-charts</samp> <br /> <abbr title='bundle-size/AreaChart.fixture.js'>AreaChart</abbr>  | `408.247 kB`<br />`127.652 kB` | `408.291 kB`<br />`127.652 kB` | `44 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />| | <samp>react-charts</samp> <br /> <abbr title='bundle-size/DeclarativeChart.fixture.js'>DeclarativeChart</abbr>  | `760.746 kB`<br />`223.259 kB` | `760.777 kB`<br />`223.267 kB` | `31 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />`8 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" />| | <samp>react-charts</samp> <br /> <abbr title='bundle-size/DonutChart.fixture.js'>DonutChart</abbr>  | `318.704 kB`<br />`98.375 kB` | `318.748 kB`<br />`98.387 kB` | `44 B` <img a
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36818/) <!-- Sticky Pull Request Commentdeploy-pr-site -->

- **Issue #36816** (2026-10-01): **chore: retire cxe-red and individual CODEOWNERS assignments**
  *Symptoms*: <!-- Thank you for submitting a pull request!  Please verify that: * [x] Code is up-to-date with the `master` branch * [ ] Your changes are covered by tests (if possible) * [ ] You've run `yarn change` locally   PR flow tips: * [x] Try to start with a Draft PR * [x] Once you're ready (ideally the pipeline is passing) promote your PR to Ready for Review. This step will auto-assign reviewers for your PR. -->  ## Previous Behavior  <!-- This is the behavior we have today -->  The CODEOWNERS file names `@microsoft/cxe-red` on 75 rules, two entries for `@jahnp` that GitHub reports as unknown owners, and individuals alongside team owners throughout the file. Active review guidance lists `@microsoft/cxe-coastal`, though it has no CODEOWNERS entries.  ## New Behavior  <!-- This is the behavior we should expect with the changes in this PR -->  - Replace `cxe-red` with `@microsoft/cxe-prg` on 72 rules and remove it from three rules already owned by other teams. - Remove all individual owners from CODEOWNERS, including the two invalid `jahnp` entries. Assign `@microsoft/cxe-prg` to Azure themes, the only rule previously owned solely by a person. Every active ownership rule retains team coverage; the rule granularity is unchanged. - Update active routing docs and generator choices. Leave v8 and charting issue-form `assignees` empty because [GitHub only assigns issues to people](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  ✅ No changes found  <!-- Sticky Pull Request Commentbundle-size-report -->
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36816/) <!-- Sticky Pull Request Commentdeploy-pr-site -->

- **Issue #36810** (2026-10-02): **fix(web-components): persist dropdown anchor name for tooltip positioning**
  *Symptoms*: ## Previous Behavior Anchor name was setup dynamically late in runtime causing tooltip positioning to break.  ## New Behavior Moves anchor naming earlier in the cycle.  ## Related Issue(s) - Fixes #36740 
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  ✅ No changes found  <!-- Sticky Pull Request Commentbundle-size-report -->
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36810/) <!-- Sticky Pull Request Commentdeploy-pr-site -->
  > @radium-v thanks for the thoughts, took a simplification pass...seems to work locally but want to ensure all your comments are taken into consideration.

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

### Incident Patch 1: `0b989603` (2026-10-05)
**Commit Message**: fix(workspace-plugin): support .storybook/main.cjs in split-library-in-two and storybook target inference (#36831)

**File**: `tools/workspace-plugin/src/generators/react-library/index.spec.ts` (modified, +6/-0)
```diff
@@ -209,6 +209,12 @@ describe('react-library generator', () => {
       "
     `);
 
+    const storybookMain = tree.read(`${stories.root}/.storybook/main.cjs`, 'utf-8');
+    expect(storybookMain).toContain(`require('../../../../../.storybook/main')`);
+    expect(storybookMain).toContain(`'../src/**/index.stories.@(ts|tsx)'`);
+    expect(storybookMain).not.toContain('../stories/');
+    expect(readJson(tree, `${stories.root}/.storybook/tsconfig.json`).include).toEqual(['*.js', '*.cjs']);
+
     const eslintConfig = tree.read(`${stories.root}/eslint.config.js`, 'utf-8');
     expect(eslintConfig).toMatchInlineSnapshot(`
       "// @ts-check
```

**File**: `tools/workspace-plugin/src/generators/split-library-in-two/generator.spec.ts` (modified, +17/-0)
```diff
@@ -278,6 +278,7 @@ describe('split-library-in-two generator', () => {
         "extends": "../tsconfig.json",
         "include": Array [
           "*.js",
+          "*.cjs",
         ],
       }
     `);
@@ -317,6 +318,22 @@ describe('split-library-in-two generator', () => {
     `);
     // Test was sometimes timing out in CI
   }, 10_000);
+
+  it('should update storybook main.cjs paths', async () => {
+    const oldConfig = readProjectConfiguration(tree, options.project);
+    tree.rename(`${oldConfig.root}/.storybook/main.js`, `${oldConfig.root}/.storybook/main.cjs`);
+
+    await splitLibraryInTwoGenerator(tree, options);
+
+    const storiesConfig = readProjectConfiguration(tree, `${options.project}-stories`);
+    const storybookMain = tree.read(`${storiesConfig.root}/.storybook/main.cjs`, 'utf-8');
+
+    expect(tree.exists(`${storiesConfig.root}/.storybook/main.js`)).toBe(false);
+    expect(storybookMain).toContain(`require('../../../../../.storybook/main')`);
+    expect(storybookMain).toContain(`'../src/**/*.mdx'`);
+    expect(storybookMain).toContain(`'../src/**/index.stories.@(ts|tsx)'`);
+    expect(storybookMain).not.toContain('../stories/');
+  }, 10_000);
 });
 
 function setup(tree: Tree) {
```

**File**: `tools/workspace-plugin/src/generators/split-library-in-two/generator.ts` (modified, +9/-7)
```diff
@@ -368,16 +368,18 @@ module.exports = [
   writeJson(tree, joinPathFragments(newProjectRoot, 'tsconfig.lib.json'), templates.tsconfig.lib);
   writeJson(tree, joinPathFragments(newProjectRoot, 'package.json'), templates.packageJson);
   updateJson(tree, joinPathFragments(newProjectRoot, '.storybook/tsconfig.json'), (json: TsConfig) => {
-    json.include = ['*.js'];
+    json.include = ['*.js', '*.cjs'];
     return json;
   });
-  updateFileContent(tree, joinPathFragments(newProjectRoot, '.storybook/main.js'), content => {
-    content = content
-      .replace(/\.\.\/stories\//g, '../src/')
-      .replace(new RegExp(options.projectOffsetFromRoot.old, 'g'), options.projectOffsetFromRoot.updated);
+  for (const storybookMain of ['.storybook/main.js', '.storybook/main.cjs']) {
+    updateFileContent(tree, joinPathFragments(newProjectRoot, storybookMain), content => {
+      content = content
+        .replace(/\.\.\/stories\//g, '../src/')
+        .replace(new RegExp(options.projectOffsetFromRoot.old, 'g'), options.projectOffsetFromRoot.updated);
 
-    return content;
-  });
+      return content;
+    });
+  }
   updateFileContent(tree, joinPathFragments(newProjectRoot, '.storybook/preview.js'), content => {
     content = content.replace(
       new RegExp(options.projectOffsetFromRoot.old, 'g'),
```

**File**: `tools/workspace-plugin/src/plugins/workspace-plugin.spec.ts` (modified, +18/-0)
```diff
@@ -875,6 +875,24 @@ describe(`workspace-plugin`, () => {
       `);
     });
 
+    it('should create storybook targets for v9 stories project with .storybook/main.cjs', async () => {
+      await tempFs.createFiles({
+        'proj/stories/.storybook/main.cjs': '',
+        'proj/stories/project.json': serializeJson({
+          root: 'proj/stories',
+          projectType: 'library',
+          tags: ['vNext', 'type:stories'],
+        } satisfies ProjectConfiguration),
+        'proj/stories/package.json': serializeJson({
+          name: '@proj/proj-stories',
+          private: true,
+        } satisfies Partial<PackageJson>),
+      });
+      const results = await createNodesFunction(['proj/stories/project.json'], options, context);
+
+      expect(getTargetsNames(results, 'proj/stories')).toEqual(expect.arrayContaining(['storybook', 'start']));
+    });
+
     it('should create default nodes for v9 stories project', async () => {
       await tempFs.createFiles({
         'proj/stories/.storybook/main.js': '',
```

**File**: `tools/workspace-plugin/src/plugins/workspace-plugin.ts` (modified, +4/-1)
```diff
@@ -734,7 +734,10 @@ function buildStorybookTarget(
   context: CreateNodesContextV2,
   config: TaskBuilderConfig,
 ): TargetConfiguration | null {
-  if (!existsSync(join(projectRoot, '.storybook/main.js'))) {
+  const hasStorybookMain = ['.storybook/main.js', '.storybook/main.cjs'].some(file =>
+    existsSync(join(projectRoot, file)),
+  );
+  if (!hasStorybookMain) {
     return null;
   }
 
```

---

### Incident Patch 2: `9f88a917` (2026-10-05)
**Commit Message**: fix(react-utilities): handle special native prop names (#36806)

Co-authored-by: Paolo Aliprandi <[REDACTED_EMAIL]>
Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `change/@fluentui-react-utilities-98768ced-77df-4ff0-942d-db5a851f8745.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "fix: handle special property names when filtering native props",
+  "packageName": "@fluentui/react-utilities",
+  "email": "paliprandi@microsoft.com"
+}
```

**File**: `packages/react-components/react-utilities/src/utils/getNativeElementProps.test.ts` (modified, +6/-0)
```diff
@@ -19,4 +19,10 @@ describe('getNativeElementProps', () => {
     // eslint-disable-next-line @typescript-eslint/no-deprecated
     expect(getNativeElementProps('div', { as: 'span' }, ['as'])).toEqual({});
   });
+
+  it('handles prototype-chain tag names without side effects', () => {
+    // eslint-disable-next-line @typescript-eslint/no-deprecated
+    expect(getNativeElementProps('__proto__', { as: 'span' })).toEqual({ as: 'span' });
+    expect(Object.prototype).not.toHaveProperty('as');
+  });
 });
```

**File**: `packages/react-components/react-utilities/src/utils/getNativeElementProps.ts` (modified, +4/-1)
```diff
@@ -69,7 +69,10 @@ export function getNativeElementProps<TAttributes extends React.HTMLAttributes<a
   props: {},
   excludedPropNames?: string[],
 ): TAttributes {
-  const allowedPropNames = (tagName && nativeElementMap[tagName]) || htmlElementProperties;
+  const allowedPropNames =
+    tagName && Object.prototype.hasOwnProperty.call(nativeElementMap, tagName)
+      ? nativeElementMap[tagName]
+      : htmlElementProperties;
   allowedPropNames.as = 1;
 
   return getNativeProps(props, allowedPropNames, excludedPropNames);
```

**File**: `packages/react-components/react-utilities/src/utils/properties.test.ts` (modified, +14/-0)
```diff
@@ -97,6 +97,20 @@ describe('getNativeProps', () => {
     expect(result.b).toBeUndefined();
   });
 
+  it('only allows own properties from a record allow-list', () => {
+    const allowedPropNames = Object.create({ inherited: 1 }) as Record<string, number>;
+    allowedPropNames.allowed = 1;
+
+    expect(getNativeProps({ allowed: 'safe', inherited: 'unsafe' }, allowedPropNames)).toEqual({ allowed: 'safe' });
+  });
+
+  it('rejects __proto__ even when it is explicitly allowed', () => {
+    const props = JSON.parse('{"__proto__":{"inherited":true}}') as Record<string, unknown>;
+    const result = getNativeProps<Record<string, unknown>>(props, ['__proto__']);
+
+    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
+  });
+
   it('can pass through anchor props including referrerPolicy', () => {
     const result = getNativeProps<React.AnchorHTMLAttributes<HTMLAnchorElement>>(
       {
```

**File**: `packages/react-components/react-utilities/src/utils/properties.ts` (modified, +3/-3)
```diff
@@ -472,14 +472,14 @@ export function getNativeProps<T extends Record<string, any>>(
 
   for (const key of keys) {
     const isNativeProp =
-      (!isArray && (allowedPropNames as Record<string, number>)[key]) ||
+      (!isArray && Object.prototype.hasOwnProperty.call(allowedPropNames, key)) ||
       (isArray && (allowedPropNames as string[]).indexOf(key) >= 0) ||
       key.indexOf('data-') === 0 ||
       key.indexOf('aria-') === 0;
 
-    if (isNativeProp && (!excludedPropNames || excludedPropNames?.indexOf(key) === -1)) {
+    if (key !== '__proto__' && isNativeProp && (!excludedPropNames || excludedPropNames?.indexOf(key) === -1)) {
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
-      result[key] = props![key] as any;
+      result[key] = props[key] as any;
     }
   }
 
```

---

### Incident Patch 3: `8bc156e9` (2026-10-05)
**Commit Message**: fix(merge-styles): contain server-rendered CSS output (#36709)

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `change/@fluentui-merge-styles-6233b26c-88b5-4e77-b69c-cf9baf7d76dd.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "fix(merge-styles): contain serialized CSS output for server rendering.",
+  "packageName": "@fluentui/merge-styles",
+  "email": "paulmardling@microsoft.com"
+}
```

**File**: `packages/merge-styles/README.md` (modified, +3/-3)
```diff
@@ -485,11 +485,11 @@ renderStatic(() => ReactDOM.renderToString(<App/>);
 
 - Rehydration on the client may result in mismatched rules. You can apply a namespace on the server side to ensure there aren't name collisions.
 
-### Untrusted data in style values
+### Untrusted style data
 
-The `css` returned by `renderStatic` (and by `Stylesheet.getRules`) is raw CSS text that is normally written into a `<style>` element. A `<style>` element is HTML raw text, so a declaration value containing `</style>` would otherwise terminate it and inject markup.
+The `css` returned by `renderStatic` (and by `Stylesheet.getRules`) is raw CSS text that is normally written into a `<style>` element. A `<style>` element is HTML raw text, so a case-insensitive `</style` sequence would otherwise terminate it and inject markup.
 
-To prevent that, `merge-styles` emits `<` and `>` inside declaration values as the CSS code point escapes `\3C ` and `\3E `. This is semantics-preserving - the escapes decode back to the same characters, including inside quoted strings and `url()`. Likewise, `Stylesheet.serialize` emits `<` as `\u003C` so its output can be embedded in an inline `<script>` for rehydration.
+To prevent that, `merge-styles` escapes these sequences at the CSS serialization boundary. Declaration values also emit `<` and `>` as the CSS code point escapes `\3C ` and `\3E `. These escapes are semantics-preserving and decode back to the same characters without changing selectors, combinators, at-rules, custom properties, or keyframe syntax. Likewise, `Stylesheet.serialize` emits `<` as `\u003C` so its output can be embedded in an inline `<script>` for rehydration.
 
 This escaping is defense in depth, not a substitute for validating input. Applications remain responsible for:
 
```

**File**: `packages/merge-styles/src/Stylesheet.ts` (modified, +6/-4)
```diff
@@ -4,6 +4,7 @@
 import { IStyle } from './IStyle';
 import { GLOBAL_STYLESHEET_KEY, SHADOW_DOM_STYLESHEET_SETTING } from './shadowConfig';
 import type { ShadowConfig } from './shadowConfig';
+import { escapeStyleTagTerminator } from './escapeForStyleTag';
 
 export const InjectionMode = {
   /**
@@ -374,12 +375,13 @@ export class Stylesheet {
    * Gets all rules registered with the stylesheet; only valid when
    * using InsertionMode.none.
    *
-   * The return value is raw CSS text intended for a `<style>` element. Values that went through
-   * `mergeStyles`, `fontFace` or `keyframes` have `<` and `>` escaped as CSS code points so they
-   * cannot terminate that element, but rules added via {@link Stylesheet.insertRule} are unescaped.
+   * The return value is raw CSS text intended for a `<style>` element. Any case-insensitive
+   * `</style` sequence is escaped at this serialization boundary without changing other CSS syntax.
    */
   public getRules(includePreservedRules?: boolean): string {
-    return (includePreservedRules ? this._preservedRules.join('') : '') + this._rules.join('');
+    const rules = (includePreservedRules ? this._preservedRules.join('') : '') + this._rules.join('');
+
+    return escapeStyleTagTerminator(rules);
   }
 
   /**
```

**File**: `packages/merge-styles/src/escapeForStyleTag.test.ts` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+import { escapeForStyleTag, escapeStyleTagTerminator } from './escapeForStyleTag';
+
+describe('style tag escaping', () => {
+  const backslash = '\\';
+  const longRunLength = 20000;
+
+  it('preserves a long nonmatching backslash run', () => {
+    const value = new Array(longRunLength + 1).join(backslash) + 'x';
+
+    expect(escapeForStyleTag(value)).toBe(value);
+    expect(escapeStyleTagTerminator(value)).toBe(value);
+  });
+
+  it('escapes a terminator after a long backslash run', () => {
+    const backslashes = new Array(longRunLength + 1).join(backslash);
+
+    expect(escapeForStyleTag(`${backslashes}</style>`)).toBe(`${backslashes}${backslash}3C /style${backslash}3E `);
+    expect(escapeStyleTagTerminator(`${backslashes}</StYlE>`)).toBe(`${backslashes}${backslash}3C /StYlE>`);
+  });
+
+  it('preserves odd and even runs around mixed characters', () => {
+    expect(escapeForStyleTag(`a${backslash}<b${backslash}${backslash}>c`)).toBe(
+      `a${backslash}3C b${backslash}${backslash}${backslash}3E c`,
+    );
+    expect(escapeStyleTagTerminator(`a${backslash}</STYLE>b${backslash}${backslash}</style>c`)).toBe(
+      `a${backslash}3C /STYLE>b${backslash}${backslash}${backslash}3C /style>c`,
+    );
+  });
+});
```

**File**: `packages/merge-styles/src/escapeForStyleTag.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+const CSS_ESCAPE_MAP: Record<string, string> = {
+  '<': '\\3C ',
+  '>': '\\3E ',
+};
+
+type EscapeMode = 'all-angle-brackets' | 'style-terminator';
+
+function escapeCssCharacters(value: string, mode: EscapeMode): string {
+  let backslashCount = 0;
+  let chunkStart = 0;
+  let result: string[] | undefined;
+
+  for (let i = 0; i < value.length; i++) {
+    const character = value.charAt(i);
+
+    if (character === '\\') {
+      backslashCount++;
+      continue;
+    }
+
+    const shouldEscape =
+      mode === 'all-angle-brackets'
+        ? character === '<' || character === '>'
+        : character === '<' && value.slice(i + 1, i + 7).toLowerCase() === '/style';
+
+    if (shouldEscape) {
+      result = result || [];
+      // An odd final backslash already escapes this character, so omit that backslash before
+      // emitting the equivalent code-point escape. Even runs represent literal backslashes.
+      result.push(value.slice(chunkStart, i - (backslashCount % 2)), CSS_ESCAPE_MAP[character]);
+      chunkStart = i + 1;
+    }
+
+    backslashCount = 0;
+  }
+
+  if (!result) {
+    return value;
+  }
+
+  result.push(value.slice(chunkStart));
+  return result.join('');
+}
+
+export function escapeForStyleTag(value: string): string {
+  return escapeCssCharacters(value, 'all-angle-brackets');
+}
+
+export function escapeStyleTagTerminator(css: string): string {
+  return escapeCssCharacters(css, 'style-terminator');
+}
```

**File**: `packages/merge-styles/src/server.test.ts` (modified, +84/-0)
```diff
@@ -1,5 +1,7 @@
 import { renderStatic } from './server';
 import { mergeCssSets } from './mergeStyleSets';
+import { keyframes } from './keyframes';
+import { Stylesheet } from './Stylesheet';
 
 describe('staticRender', () => {
   it('can render content', () => {
@@ -52,4 +54,86 @@ describe('staticRender', () => {
     expect(css).not.toContain('</style');
     expect(css).not.toContain('<script');
   });
+
+  it('contains style element terminators in structural CSS positions', () => {
+    const { css } = renderStatic(() => {
+      mergeCssSets([
+        {
+          root: {
+            selectors: {
+              '&</STYLE>.selector-sentinel': { color: 'red' },
+            },
+            'color</style>-property-sentinel': 'red',
+            '--custom</StYlE>-property-sentinel': 'value',
+          },
+        },
+      ]);
+      keyframes({
+        '50%</sTyLe>.keyframe-sentinel': { opacity: 0.5 },
+      });
+
+      return '';
+    });
+
+    expect(css).not.toMatch(/<\/style/i);
+    expect(css).toMatchInlineSnapshot(
+      `"@keyframes css-1{50%\\\\3C /sTyLe>.keyframe-sentinel{opacity:0.5;}}.root-0{color\\\\3C /style>-property-sentinel:red;--custom\\\\3C /StYlE>-property-sentinel:value;}.root-0\\\\3C /STYLE>.selector-sentinel{color:red;}@keyframes css-1{50%\\\\3C /sTyLe>.keyframe-sentinel{opacity:0.5;}}"`,
+    );
+  });
+
+  it('preserves valid structural CSS syntax', () => {
+    const { css } = renderStatic(() => {
+      mergeCssSets([
+        {
+          root: {
+            '--custom-property': 'value',
+            selectors: {
+              '& > .child': { color: 'red' },
+              '@media (width < 1000px)': { color: 'blue' },
+            },
+          },
+        },
+      ]);
+      keyframes({
+        from: { opacity: 0 },
+        '50%': { opacity: 0.5 },
+        to: { opacity: 1 },
+      });
+
+      return '';
+    });
+
+    expect(css).toContain(' > .child');
+    expect(css).toContain('@media (width < 1000px)');
+    expect(css).toContain('--custom-property:value;');
+    expect(css).toContain('from{opacity:0;}50%{opacity:0.5;}to{opacity:1;}');
+  });
+
+  it('preserves odd and even backslash escape parity in raw server-rendered rules', () => {
+    const stylesheet = Stylesheet.getInstance();
+    const backslash = '\\';
+
+    stylesheet.insertRule(`.odd{content:"${backslash}</StYlE>"}`);
+    stylesheet.insertRule(`.even{content:"${backslash}${backslash}</style>"}`);
+
+    const css = stylesheet.getRules();
+
+    expect(css).not.toMatch(/<\/style/i);
+    expect(css).toContain(`.odd{content:"${backslash}3C /StYlE>"}`);
+    expect(css).toContain(`.even{content:"${backslash}${backslash}${backslash}3C /style>"}`);
+  });
+
+  it('contains a terminator after a long backslash run in raw server-rendered rules', () => {
+    const stylesheet = Stylesheet.getInstance();
+    const backslashes = new Array(20001).join('\\');
+
+    stylesheet.insertRule(`.nonmatching{content:"${backslashes}x"}`);
+    stylesheet.insertRule(`.matching{content:"${backslashes}</style>"}`);
+
+    const css = stylesheet.getRules();
+
+    expect(css).toContain(`.nonmatching{content:"${backslashes}x"}`);
+    expect(css).toContain(`.matching{content:"${backslashes}\\3C /style>"}`);
+    expect(css).not.toMatch(/<\/style/i);
+  });
 });
```

**File**: `packages/merge-styles/src/server.ts` (modified, +3/-3)
```diff
@@ -3,9 +3,9 @@ import { InjectionMode, Stylesheet } from './Stylesheet';
 /**
  * Renders a given string and returns both html and css needed for the html.
  *
- * The returned `css` is raw CSS text meant to be placed in a `<style>` element. Declaration values
- * have `<` and `>` escaped as CSS code points so they cannot terminate that element, but callers
- * remain responsible for validating untrusted data used in style values.
+ * The returned `css` is raw CSS text meant to be placed in a `<style>` element. Sequences that
+ * could terminate that element are escaped as CSS code points, but callers remain responsible for
+ * validating untrusted style data.
  *
  * @param onRender - Function that returns a string.
  * @param namespace - Optional namespace to prepend to css classnames to avoid collisions.
```

**File**: `packages/merge-styles/src/styleToClassName.test.ts` (modified, +64/-1)
```diff
@@ -1,5 +1,5 @@
 import { InjectionMode, Stylesheet } from './Stylesheet';
-import { styleToClassName } from './styleToClassName';
+import { serializeRuleEntries, styleToClassName } from './styleToClassName';
 import { IStyleOptions } from './IStyleOptions';
 
 const _stylesheet: Stylesheet = Stylesheet.getInstance();
@@ -607,6 +607,36 @@ describe('styleToClassName with specificityMultiplier', () => {
   describe('style tag escaping', () => {
     const payload = 'red;}</style><script>alert(1)</script><style>.x{color:red';
 
+    it('preserves supported string and number serialization', () => {
+      expect(
+        serializeRuleEntries(
+          {},
+          {
+            color: 'red',
+            marginTop: 2,
+            opacity: 0.5,
+            '--scale': 3,
+          },
+        ),
+      ).toEqual('color:red;margin-top:2px;opacity:0.5;--scale:3;');
+    });
+
+    it('escapes angle brackets after array values are coerced', () => {
+      const entries = { fontFamily: ['Arial', '<fallback>'] } as unknown as Record<string, string | number>;
+
+      expect(serializeRuleEntries({}, entries)).toEqual('font-family:Arial,\\3C fallback\\3E ;');
+    });
+
+    it('escapes angle brackets after custom string coercion', () => {
+      const value = {
+        toString: jest.fn(() => '<custom>'),
+      };
+      const entries = { color: value } as unknown as Record<string, string | number>;
+
+      expect(serializeRuleEntries({}, entries)).toEqual('color:\\3C custom\\3E ;');
+      expect(value.toString).toHaveBeenCalledTimes(1);
+    });
+
     it.each(['fill', 'background', 'color', 'content', 'fontFamily', 'backgroundImage'] as const)(
       'escapes a value that would terminate the style element in %s',
       property => {
@@ -627,6 +657,39 @@ describe('styleToClassName with specificityMultiplier', () => {
       expect(_stylesheet.getRules()).toEqual('.css-0{content:"a\\3C b\\3E c";}');
     });
 
+    it('preserves odd backslash escape parity in declaration values', () => {
+      const backslash = '\\';
+
+      expect(serializeRuleEntries({}, { content: `"${backslash}</style${backslash}>"` })).toEqual(
+        `content:"${backslash}3C /style${backslash}3E ";`,
+      );
+    });
+
+    it('preserves even backslash escape parity in declaration values', () => {
+      const backslash = '\\';
+
+      expect(
+        serializeRuleEntries({}, { content: `"${backslash}${backslash}</style${backslash}${backslash}>"` }),
+      ).toEqual(`content:"${backslash}${backslash}${backslash}3C /style${backslash}${backslash}${backslash}3E ";`);
+    });
+
+    it('preserves backslash escape parity in URLs', () => {
+      const backslash = '\\';
+
+      expect(serializeRuleEntries({}, { backgroundImage: `url("${backslash}</style${backslash}>")` })).toEqual(
+        `background-image:url("${backslash}3C /style${backslash}3E ");`,
+      );
+    });
+
+    it('serializes a long backslash run with and without a following terminator', () => {
+      const backslashes = new Array(20001).join('\\');
+
+      expect(serializeRuleEntries({}, { content: `${backslashes}x` })).toBe(`content:${backslashes}x;`);
+      expect(serializeRuleEntries({}, { content: `${backslashes}</style>` })).toBe(
+        `content:${backslashes}\\3C /style\\3E ;`,
+      );
+    });
+
     it('does not escape selectors, so combinators keep working', () => {
       styleToClassName(
         {},
```

---

### Incident Patch 4: `6d396f03` (2026-10-05)
**Commit Message**: fix(workspace-plugin): epic generator command injection (#36702)

Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `tools/workspace-plugin/src/generators/epic-generator/index.spec.ts` (modified, +180/-62)
```diff
@@ -1,10 +1,11 @@
 import { addProjectConfiguration, ProjectType, stripIndents, writeJson } from '@nx/devkit';
 import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
-import { execSync, spawnSync, SpawnSyncReturns } from 'child_process';
+import { execFileSync, execSync, spawnSync, SpawnSyncReturns } from 'child_process';
 import { workspacePaths } from '../../utils';
 import epicGenerator from './index';
 
 jest.mock('child_process');
+const execFileSyncMock = execFileSync as unknown as jest.Mock<string>;
 const execSyncMock = execSync as unknown as jest.Mock<string>;
 const spawnSyncMock = spawnSync as unknown as jest.Mock<Partial<SpawnSyncReturns<string[]>>>;
 
@@ -49,7 +50,7 @@ function setupTest(packages: Package[]) {
   });
 
   // response to epic creation
-  execSyncMock.mockReturnValueOnce('epicUrl');
+  execFileSyncMock.mockReturnValueOnce('epicUrl');
 
   /**
    * Responses for each of the packages created
@@ -68,11 +69,11 @@ function setupTest(packages: Package[]) {
       return acc;
     }, [])
     .forEach(owner => {
-      execSyncMock.mockReturnValueOnce(`issueUrl-${owner}`);
+      execFileSyncMock.mockReturnValueOnce(`issueUrl-${owner}`);
     });
 
   // response to editing the epic
-  execSyncMock.mockReturnValueOnce('epicUrl');
+  execFileSyncMock.mockReturnValueOnce('epicUrl');
 
   return tree;
 }
@@ -103,6 +104,33 @@ describe('epic-generator', () => {
         Please follow the format {owner}/{repositoryName}."
       `);
     });
+
+    it.each(['microsoft/fluentui;malicious-command', 'microsoft/fluentui/extra', 'microsoft/'])(
+      'rejects a repository containing extra characters: %s',
+      repository => {
+        const tree = createTreeWithEmptyWorkspace();
+
+        expect(() => epicGenerator(tree, { title: 'test title', repository })).toThrow(/invalid repository name/);
+      },
+    );
+
+    it('accepts an Enterprise Managed User repository owner', () => {
+      const tree = setupTest([]);
+      const repository = 'mona-cat_octo/migration-tracker';
+
+      epicGenerator(tree, { title: 'test title', repository })();
+
+      expect(execFileSyncMock).toHaveBeenNthCalledWith(1, 'gh', [
+        'issue',
+        'create',
+        '--repo',
+        repository,
+        '--title',
+        'test title',
+        '--body',
+        '*Description to be added*',
+      ]);
+    });
   });
 
   describe('authentication', () => {
@@ -204,73 +232,163 @@ describe('epic-generator', () => {
       });
       effectsCall();
 
-      expect(execSyncMock).toHaveBeenNthCalledWith(
-        1,
-        stripIndents`gh issue create --repo "cool-company/repository" --title "test title" --body "*Description to be added*"`,
-      );
+      expect(execFileSyncMock).toHaveBeenNthCalledWith(1, 'gh', [
+        'issue',
+        'create',
+        '--repo',
+        'cool-company/repository',
+        '--title',
+        'test title',
+        '--body',
+        '*Description to be added*',
+      ]);
 
       // @microsoft/cxe-red issue creation
-      expect(execSyncMock).toHaveBeenNthCalledWith(
-        2,
-        stripIndents`gh issue create --repo "cool-company/repository" --title "test title - @microsoft/cxe-red" --body "🚧 This is an auto-generated issue to individually track migration progress.
-
-        ### Packages to migrate:
-        - react-link
-        - react-button"`,
-      );
+      expect(execFileSyncMock).toHaveBeenNthCalledWith(2, 'gh', [
+        'issue',
+        'create',
+        '--repo',
+        'cool-company/repository',
+        '--title',
+        'test title - @microsoft/cxe-red',
+        '--body',
+        stripIndents`🚧 This is an auto-generated issue to individually track migration progress.
+
+          ### Packages to migrate:
+          - react-link
+          - react-button`,
+      ]);
       // @microsoft/cxe-prg issue creation
-      expect(execSyncMock).toHaveBeenNthCalledWith(
-        3,
-        stripIndents`gh issue create --repo "cool-company/repository" --title "test title - @microsoft/cxe-prg" --body "🚧 This is an auto-generated issue to individually track migration progress.
-
-        ### Packages to migrate:
-        - react-card"`,
-      );
+      expect(execFileSyncMock).toHaveBeenNthCalledWith(3, 'gh', [
+        'issue',
+        'create',
+        '--repo',
+        'cool-company/repository',
+        '--title',
+        'test title - @microsoft/cxe-prg',
+        '--body',
+        stripIndents`🚧 This is an auto-generated issue to individually track migration progress.
+
+          ### Packages to migrate:
+          - react-card`,
+      ]);
       // @microsoft/teams-prg issue creation
-      expect(execSyncMock).toHaveBeenNthCalledWith(
-        4,
-        stripIndents`gh issue create --repo "cool-company/repository" --title "test title - @microsoft/teams-prg" --body "🚧 This is an auto-generated issue to individually track migration progress.
-
-        ### Packages to migrate:
-        - react-menu
- 
```

**File**: `tools/workspace-plugin/src/generators/epic-generator/index.ts` (modified, +17/-9)
```diff
@@ -1,12 +1,13 @@
 import { getProjects, stripIndents, Tree } from '@nx/devkit';
-import { execSync, spawnSync } from 'child_process';
+import { execFileSync, spawnSync } from 'child_process';
 import { EpicGenerator } from './schema';
 import { isPackageConverged, workspacePaths } from '../../utils';
 
 const placeholderMessage = '*Description to be added*';
+const repositoryNamePattern = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/;
 
 function validateSchema(schema: EpicGenerator): Required<EpicGenerator> {
-  if (schema.repository !== undefined && !schema.repository.match(/[A-z-]+\/[A-z-]+/)) {
+  if (schema.repository !== undefined && !repositoryNamePattern.test(schema.repository)) {
     throw new Error(stripIndents`
      You provided "${schema.repository}", which is an invalid repository name.
      Please follow the format {owner}/{repositoryName}.
@@ -108,7 +109,16 @@ function getPackages(tree: Tree) {
 }
 
 function createEpic(repo: string, title: string) {
-  const issueUrl = execSync(`gh issue create --repo "${repo}" --title "${title}" --body "${placeholderMessage}"`)
+  const issueUrl = execFileSync('gh', [
+    'issue',
+    'create',
+    '--repo',
+    repo,
+    '--title',
+    title,
+    '--body',
+    placeholderMessage,
+  ])
     .toString()
     .trim();
 
@@ -124,9 +134,9 @@ function createIssue(repo: string, issue: MigrationIssue, templateTitle: string)
     ${issue.packages.map(pkg => `- ${pkg.name}`).join('\n')}
   `;
 
-  const command = `gh issue create --repo "${repo}" --title "${title}" --body "${message}"`;
-
-  const issueUrl = execSync(command).toString().trim();
+  const issueUrl = execFileSync('gh', ['issue', 'create', '--repo', repo, '--title', title, '--body', message])
+    .toString()
+    .trim();
 
   return issueUrl;
 }
@@ -173,9 +183,7 @@ function updateEpicWithIssues(epicUrl: string, issueMap: MigrationIssues) {
   ${packageList}
 `;
 
-  const command = `gh issue edit ${epicUrl} --body "${updatedMessage}"`;
-
-  execSync(command);
+  execFileSync('gh', ['issue', 'edit', epicUrl, '--body', updatedMessage]);
 }
 
 export default function (tree: Tree, schema: EpicGenerator) {
```

---

### Incident Patch 5: `5737bd74` (2026-10-05)
**Commit Message**: fix(react-headless-components-preview): enter SwatchPicker on the selected swatch (#36821)

**File**: `change/@fluentui-react-headless-components-preview-93e46c48-b926-4a1c-93ad-8497a0992422.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "fix: focus enters SwatchPicker on the selected swatch",
+  "packageName": "@fluentui/react-headless-components-preview",
+  "email": "vgenaev@gmail.com"
+}
```

**File**: `packages/react-components/react-headless-components-preview/library/src/components/SwatchPicker/ColorSwatch/ColorSwatch.test.tsx` (modified, +12/-0)
```diff
@@ -30,4 +30,16 @@ describe('ColorSwatch', () => {
     expect(swatch).toHaveAttribute('data-selected');
     expect(swatch).toHaveAttribute('data-disabled');
   });
+
+  it('marks only the selected swatch as the focusgroup entry point', () => {
+    const { getByLabelText } = render(
+      <SwatchPicker aria-label="Colors" selectedValue="pink">
+        <ColorSwatch color="#f09" value="pink" aria-label="Pink" />
+        <ColorSwatch color="#00f" value="blue" aria-label="Blue" />
+      </SwatchPicker>,
+    );
+
+    expect(getByLabelText('Pink')).toHaveAttribute('focusgroupstart');
+    expect(getByLabelText('Blue')).not.toHaveAttribute('focusgroupstart');
+  });
 });
```

**File**: `packages/react-components/react-headless-components-preview/library/src/components/SwatchPicker/ColorSwatch/useColorSwatch.ts` (modified, +2/-0)
```diff
@@ -8,6 +8,8 @@ import type { ColorSwatchProps, ColorSwatchState } from './ColorSwatch.types';
 export const useColorSwatch = (props: ColorSwatchProps, ref: React.Ref<HTMLButtonElement>): ColorSwatchState => {
   const state: ColorSwatchState = useColorSwatchBase_unstable(props, ref);
 
+  // eslint-disable-next-line react-hooks/immutability
+  state.root.focusgroupstart = toDataAttributeValue(state.selected);
   // eslint-disable-next-line react-hooks/immutability
   state.root['data-selected'] = toDataAttributeValue(state.selected);
   // eslint-disable-next-line react-hooks/immutability
```

**File**: `packages/react-components/react-headless-components-preview/library/src/components/SwatchPicker/ImageSwatch/ImageSwatch.test.tsx` (modified, +12/-0)
```diff
@@ -23,4 +23,16 @@ describe('ImageSwatch', () => {
 
     expect(getByRole('radio')).toHaveAttribute('data-selected');
   });
+
+  it('marks only the selected swatch as the focusgroup entry point', () => {
+    const { getByLabelText } = render(
+      <SwatchPicker aria-label="Images" selectedValue="image">
+        <ImageSwatch src="image.png" value="image" aria-label="Image" />
+        <ImageSwatch src="other.png" value="other" aria-label="Other" />
+      </SwatchPicker>,
+    );
+
+    expect(getByLabelText('Image')).toHaveAttribute('focusgroupstart');
+    expect(getByLabelText('Other')).not.toHaveAttribute('focusgroupstart');
+  });
 });
```

**File**: `packages/react-components/react-headless-components-preview/library/src/components/SwatchPicker/ImageSwatch/useImageSwatch.ts` (modified, +2/-0)
```diff
@@ -8,6 +8,8 @@ import type { ImageSwatchProps, ImageSwatchState } from './ImageSwatch.types';
 export const useImageSwatch = (props: ImageSwatchProps, ref: React.Ref<HTMLButtonElement>): ImageSwatchState => {
   const state: ImageSwatchState = useImageSwatchBase_unstable(props, ref);
 
+  // eslint-disable-next-line react-hooks/immutability
+  state.root.focusgroupstart = toDataAttributeValue(state.selected);
   // eslint-disable-next-line react-hooks/immutability
   state.root['data-selected'] = toDataAttributeValue(state.selected);
 
```

**File**: `packages/react-components/react-headless-components-preview/library/src/components/SwatchPicker/SwatchPicker.cy.tsx` (modified, +40/-0)
```diff
@@ -13,6 +13,46 @@ polyfillBodyAndObserve();
 const mount = (element: JSXElement) => mountBase(<Provider>{element}</Provider>);
 
 describe('SwatchPicker', () => {
+  it('returns focus to the last focused swatch when no swatch is selected', () => {
+    mount(
+      <>
+        <button>Before</button>
+        <SwatchPicker aria-label="Colors">
+          <ColorSwatch color="#f00" value="red" aria-label="Red" />
+          <ColorSwatch color="#0f0" value="green" aria-label="Green" />
+          <ColorSwatch color="#00f" value="blue" aria-label="Blue" />
+        </SwatchPicker>
+        <button>After</button>
+      </>,
+    );
+
+    cy.contains('button', 'Before').focus().realPress('Tab');
+    cy.get('[aria-label="Red"]').should('be.focused').realPress('ArrowRight');
+    cy.get('[aria-label="Green"]').should('be.focused').realPress('Tab');
+    cy.contains('button', 'After').should('be.focused').realPress(['Shift', 'Tab']);
+    cy.get('[aria-label="Green"]').should('be.focused');
+  });
+
+  it('returns focus to the selected swatch after leaving and re-entering', () => {
+    mount(
+      <>
+        <button>Before</button>
+        <SwatchPicker aria-label="Colors" defaultSelectedValue="green">
+          <ColorSwatch color="#f00" value="red" aria-label="Red" />
+          <ColorSwatch color="#0f0" value="green" aria-label="Green" />
+          <ColorSwatch color="#00f" value="blue" aria-label="Blue" />
+        </SwatchPicker>
+        <button>After</button>
+      </>,
+    );
+
+    cy.contains('button', 'Before').focus().realPress('Tab');
+    cy.get('[aria-label="Green"]').should('be.focused').realPress('ArrowRight');
+    cy.get('[aria-label="Blue"]').should('be.focused').realPress('Tab');
+    cy.contains('button', 'After').should('be.focused').realPress(['Shift', 'Tab']);
+    cy.get('[aria-label="Green"]').should('be.focused');
+  });
+
   // TODO: Enable this test once the focusgroup-polyfill is updated to support the new arrow key navigation behavior
   it.skip('moves focus through a grid with arrow keys and wraps', () => {
     mount(
```

**File**: `packages/react-components/react-headless-components-preview/library/src/components/SwatchPicker/SwatchPicker.test.tsx` (modified, +37/-0)
```diff
@@ -39,6 +39,43 @@ describe('SwatchPicker', () => {
     expect(getByRole(role)).toHaveAttribute('focusgroup', focusgroup);
   });
 
+  it.each([
+    ['row', 'radiogroup', 'radiogroup nomemory'],
+    ['grid', 'grid', 'grid manual rowflow nomemory'],
+  ] as const)('disables focus memory in a %s while a value is selected', (layout, role, focusgroup) => {
+    const { getByRole } = render(
+      <SwatchPicker aria-label="Colors" layout={layout} defaultSelectedValue="pink">
+        <ColorSwatch color="#f09" value="pink" aria-label="Pink" />
+      </SwatchPicker>,
+    );
+
+    expect(getByRole(role)).toHaveAttribute('focusgroup', focusgroup);
+  });
+
+  it('moves the focusgroup entry point to the newly selected swatch', async () => {
+    const { getByRole, getByLabelText } = render(
+      <SwatchPicker aria-label="Colors">
+        <ColorSwatch color="#f00" value="red" aria-label="Red" />
+        <ColorSwatch color="#0f0" value="green" aria-label="Green" />
+      </SwatchPicker>,
+    );
+
+    expect(getByRole('radiogroup')).toHaveAttribute('focusgroup', 'radiogroup');
+    expect(getByLabelText('Red')).not.toHaveAttribute('focusgroupstart');
+    expect(getByLabelText('Green')).not.toHaveAttribute('focusgroupstart');
+
+    await userEvent.click(getByLabelText('Green'));
+
+    expect(getByRole('radiogroup')).toHaveAttribute('focusgroup', 'radiogroup nomemory');
+    expect(getByLabelText('Green')).toHaveAttribute('focusgroupstart');
+    expect(getByLabelText('Red')).not.toHaveAttribute('focusgroupstart');
+
+    await userEvent.click(getByLabelText('Red'));
+
+    expect(getByLabelText('Red')).toHaveAttribute('focusgroupstart');
+    expect(getByLabelText('Green')).not.toHaveAttribute('focusgroupstart');
+  });
+
   it('does not add grid arrow navigation in tab mode', async () => {
     const onKeyDown = jest.fn((event: React.KeyboardEvent) => event.preventDefault());
     const { getByLabelText } = render(
```

**File**: `packages/react-components/react-headless-components-preview/library/src/components/SwatchPicker/useSwatchPicker.ts` (modified, +3/-1)
```diff
@@ -18,8 +18,10 @@ export const useSwatchPicker = (props: SwatchPickerProps, ref: React.Ref<HTMLDiv
   baseState.root['data-layout'] = layout;
 
   if (focusMode === 'arrow') {
+    const behavior = baseState.isGrid ? 'grid manual rowflow' : 'radiogroup';
+
     // eslint-disable-next-line react-hooks/immutability
-    baseState.root.focusgroup = baseState.isGrid ? 'grid manual rowflow' : 'radiogroup';
+    baseState.root.focusgroup = baseState.selectedValue ? `${behavior} nomemory` : behavior;
   }
 
   return baseState;
```

---

### Incident Patch 6: `c201bc9b` (2026-10-04)
**Commit Message**: fix(react-swatch-picker): default ImageSwatch and EmptySwatch to type="button" (#36822)

**File**: `change/@fluentui-react-swatch-picker-bbbf4871-8b49-409c-a1a3-8195dccceb62.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "fix: prevent ImageSwatch and EmptySwatch from submitting forms",
+  "packageName": "@fluentui/react-swatch-picker",
+  "email": "vgenaev@gmail.com"
+}
```

**File**: `packages/react-components/react-swatch-picker/library/src/components/EmptySwatch/EmptySwatch.test.tsx` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ describe('EmptySwatch', () => {
           aria-checked="false"
           class="fui-EmptySwatch"
           role="radio"
+          type="button"
         />
       </div>
     `);
```

**File**: `packages/react-components/react-swatch-picker/library/src/components/EmptySwatch/useEmptySwatch.ts` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ export const useEmptySwatchBase_unstable = (
         ref,
         role,
         ...a11yProps,
+        type: 'button',
         ...props,
       }),
       { elementType: 'button' },
```

**File**: `packages/react-components/react-swatch-picker/library/src/components/ImageSwatch/ImageSwatch.test.tsx` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ describe('ImageSwatch', () => {
           class="fui-ImageSwatch"
           role="radio"
           style="background-image: url(\\"path/img.png\\");"
+          type="button"
         />
       </div>
     `);
```

**File**: `packages/react-components/react-swatch-picker/library/src/components/ImageSwatch/useImageSwatch.ts` (modified, +1/-0)
```diff
@@ -54,6 +54,7 @@ export const useImageSwatchBase_unstable = (
         role,
         ...ariaSelected,
         onClick: onImageSwatchClick,
+        type: 'button',
         ...rest,
         style: {
           backgroundImage: `url(${src})`,
```

**File**: `packages/react-components/react-swatch-picker/library/src/components/SwatchPicker/SwatchPicker.test.tsx` (modified, +2/-0)
```diff
@@ -68,11 +68,13 @@ describe('SwatchPicker', () => {
             class="fui-ImageSwatch"
             role="radio"
             style="background-image: url(\\"path/img.png\\");"
+            type="button"
           />
           <button
             aria-checked="false"
             class="fui-EmptySwatch"
             role="radio"
+            type="button"
           />
         </div>
       </div>
```

**File**: `packages/react-components/react-swatch-picker/library/src/utils/__snapshots__/renderUtils.test.tsx.snap` (modified, +6/-0)
```diff
@@ -76,20 +76,23 @@ exports[`Render utils of SwatchPicker renders custom row 1`] = `
         class="fui-ImageSwatch"
         role="gridcell"
         style="background-image: url(\\"https://fabricweb.azureedge.net/fabric-website/assets/images/swatch-picker/sea-swatch.jpg\\");"
+        type="button"
       />
       <button
         aria-label="bridge"
         aria-selected="false"
         class="fui-ImageSwatch"
         role="gridcell"
         style="background-image: url(\\"https://fabricweb.azureedge.net/fabric-website/assets/images/swatch-picker/bridge-swatch.jpg\\");"
+        type="button"
       />
       <button
         aria-label="park"
         aria-selected="false"
         class="fui-ImageSwatch"
         role="gridcell"
         style="background-image: url(\\"https://fabricweb.azureedge.net/fabric-website/assets/images/swatch-picker/park-swatch.jpg\\");"
+        type="button"
       />
     </div>
   </div>
@@ -242,20 +245,23 @@ exports[`Render utils of SwatchPicker renders default grid layout 1`] = `
         class="fui-ImageSwatch"
         role="gridcell"
         style="background-image: url(\\"https://fabricweb.azureedge.net/fabric-website/assets/images/swatch-picker/sea-swatch.jpg\\");"
+        type="button"
       />
       <button
         aria-label="bridge"
         aria-selected="false"
         class="fui-ImageSwatch"
         role="gridcell"
         style="background-image: url(\\"https://fabricweb.azureedge.net/fabric-website/assets/images/swatch-picker/bridge-swatch.jpg\\");"
+        type="button"
       />
       <button
         aria-label="park"
         aria-selected="false"
         class="fui-ImageSwatch"
         role="gridcell"
         style="background-image: url(\\"https://fabricweb.azureedge.net/fabric-website/assets/images/swatch-picker/park-swatch.jpg\\");"
+        type="button"
       />
     </div>
   </div>
```

---

### Incident Patch 7: `6fdc7bd4` (2026-10-02)
**Commit Message**: fix(web-components): persist dropdown anchor name for tooltip positioning and fix broken implementation (#36810)

**File**: `change/@fluentui-web-components-59d96bfe-18ca-49de-a337-9f1222afa67f.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "fix(web-components): fix broken tooltip positioning API",
+  "packageName": "@fluentui/web-components",
+  "email": "13071055+chrisdholt@users.noreply.github.com"
+}
```

**File**: `change/@fluentui-web-components-7fd518e0-c17c-4a60-8719-c2850556e9f0.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "fix: keep dropdown anchor stable for tooltips",
+  "packageName": "@fluentui/web-components",
+  "email": "13071055+chrisdholt@users.noreply.github.com"
+}
```

**File**: `packages/web-components/docs/web-components.api.md` (modified, +12/-12)
```diff
@@ -4376,18 +4376,18 @@ export const TooltipDefinition: PartialFASTElementDefinition;
 
 // @public
 export const TooltipPositioningOption: {
-    readonly 'above-start': "block-start span-inline-end";
-    readonly above: "block-start";
-    readonly 'above-end': "block-start span-inline-start";
-    readonly 'below-start': "block-end span-inline-end";
-    readonly below: "block-end";
-    readonly 'below-end': "block-end span-inline-start";
-    readonly 'before-top': "inline-start span-block-end";
-    readonly before: "inline-start";
-    readonly 'before-bottom': "inline-start span-block-start";
-    readonly 'after-top': "inline-end span-block-end";
-    readonly after: "inline-end";
-    readonly 'after-bottom': "inline-end span-block-start";
+    readonly 'above-start': "above-start";
+    readonly above: "above";
+    readonly 'above-end': "above-end";
+    readonly 'below-start': "below-start";
+    readonly below: "below";
+    readonly 'below-end': "below-end";
+    readonly 'before-top': "before-top";
+    readonly before: "before";
+    readonly 'before-bottom': "before-bottom";
+    readonly 'after-top': "after-top";
+    readonly after: "after";
+    readonly 'after-bottom': "after-bottom";
 };
 
 // @public
```

**File**: `packages/web-components/src/dropdown/dropdown.base.ts` (modified, +1/-1)
```diff
@@ -253,7 +253,7 @@ export class BaseDropdown extends FASTElement {
       if (AnchorPositioningCSSSupported) {
         // The `anchor-name` property seems to not be isolated between instances in Safari Technology Preview 220 (18.4).
         // It's unclear if the spec requires the `anchor-name` to be unique when styled on the `:host`.
-        const anchorName = uniqueId('--dropdown-anchor-');
+        const anchorName = this.style.getPropertyValue('anchor-name') || uniqueId('--dropdown-anchor-');
         this.style.setProperty('anchor-name', anchorName);
         this.listbox.style.setProperty('position-anchor', anchorName);
       }
```

**File**: `packages/web-components/src/dropdown/dropdown.spec.ts` (modified, +29/-0)
```diff
@@ -55,6 +55,35 @@ test.describe('Dropdown', () => {
     await expect(options).toHaveCount(8);
   });
 
+  test.describe('anchor positioning', () => {
+    test.beforeEach(async ({ page }) => {
+      const supported = await page.evaluate(() => CSS.supports('anchor-name', '--a'));
+      test.skip(!supported, 'CSS anchor positioning is not supported');
+    });
+
+    test('should preserve an anchor name set before the listbox connects', async ({ fastPage }) => {
+      const { element } = fastPage;
+      const listbox = element.locator(ListboxTagName);
+
+      await fastPage.setTemplate({ attributes: { style: 'anchor-name: --consumer-anchor' } });
+
+      await expect(element).toHaveCSS('anchor-name', '--consumer-anchor');
+      await expect(listbox).toHaveCSS('position-anchor', '--consumer-anchor');
+    });
+
+    test('should generate a shared anchor name when the dropdown has no anchor name', async ({ fastPage }) => {
+      const { element } = fastPage;
+      const listbox = element.locator(ListboxTagName);
+
+      await fastPage.setTemplate();
+
+      await expect(element).toHaveCSS('anchor-name', /^--dropdown-anchor-/);
+
+      const anchorName = await element.evaluate(el => getComputedStyle(el).getPropertyValue('anchor-name'));
+      await expect(listbox).toHaveCSS('position-anchor', anchorName);
+    });
+  });
+
   test('should render a dropdown with a button when the type is not specified', async ({ fastPage }) => {
     const { element } = fastPage;
     const button = element.locator('button');
```

**File**: `packages/web-components/src/dropdown/dropdown.stories.ts` (modified, +45/-0)
```diff
@@ -528,6 +528,51 @@ export const InsideDialogWithScrollingContent: Story = {
   args: { ...Default.args },
 };
 
+export const Tooltip: Story = {
+  render: renderComponent(html<StoryArgs<FluentDropdown>>`
+    <fluent-dropdown id="dropdown-tooltip-target" placeholder="Select a fruit"> </fluent-dropdown>
+    <fluent-tooltip anchor="dropdown-tooltip-target" positioning="below-start">
+      Tooltip anchored to the dropdown
+    </fluent-tooltip>
+  `),
+  decorators: [
+    Story => {
+      const story = Story() as DocumentFragment;
+      const dropdown = story.querySelector<FluentDropdown>('fluent-dropdown');
+      const tooltip = story.querySelector('fluent-tooltip');
+
+      // Append the listbox only after the sibling tooltip connects, matching the order in the original report.
+      const appendListboxWhenTooltipConnects = () => {
+        if (!dropdown || !tooltip) {
+          return;
+        }
+
+        if (!tooltip.isConnected) {
+          requestAnimationFrame(appendListboxWhenTooltipConnects);
+          return;
+        }
+
+        const listbox = dropdown.ownerDocument.createElement('fluent-listbox');
+        [
+          { value: 'apple', text: 'Apple' },
+          { value: 'banana', text: 'Banana' },
+          { value: 'orange', text: 'Orange' },
+        ].forEach(({ value, text }) => {
+          const option = dropdown.ownerDocument.createElement('fluent-option');
+          option.setAttribute('value', value);
+          option.textContent = text;
+          listbox.append(option);
+        });
+        dropdown.append(listbox);
+      };
+
+      requestAnimationFrame(appendListboxWhenTooltipConnects);
+
+      return story;
+    },
+  ],
+};
+
 export const InsideNonModalDialog: Story = {
   render: renderComponent(html<StoryArgs<FluentDropdown>>`
     <div style="min-block-size: 20rem;">
```

**File**: `packages/web-components/src/tooltip/tooltip.options.ts` (modified, +13/-13)
```diff
@@ -2,22 +2,22 @@ import { FluentDesignSystem } from '../fluent-design-system.js';
 import type { ValuesOf } from '../utils/typings.js';
 
 /**
- * The TooltipPositioning options and their corresponding CSS values
+ * The TooltipPositioning options
  * @public
  */
 export const TooltipPositioningOption = {
-  'above-start': 'block-start span-inline-end',
-  above: 'block-start',
-  'above-end': 'block-start span-inline-start',
-  'below-start': 'block-end span-inline-end',
-  below: 'block-end',
-  'below-end': 'block-end span-inline-start',
-  'before-top': 'inline-start span-block-end',
-  before: 'inline-start',
-  'before-bottom': 'inline-start span-block-start',
-  'after-top': 'inline-end span-block-end',
-  after: 'inline-end',
-  'after-bottom': 'inline-end span-block-start',
+  'above-start': 'above-start',
+  above: 'above',
+  'above-end': 'above-end',
+  'below-start': 'below-start',
+  below: 'below',
+  'below-end': 'below-end',
+  'before-top': 'before-top',
+  before: 'before',
+  'before-bottom': 'before-bottom',
+  'after-top': 'after-top',
+  after: 'after',
+  'after-bottom': 'after-bottom',
 } as const;
 
 /**
```

**File**: `packages/web-components/src/tooltip/tooltip.spec.ts` (modified, +1/-2)
```diff
@@ -1,6 +1,5 @@
 import { expect, test } from '../../test/playwright/index.js';
 import type { Tooltip } from './tooltip.js';
-import type { TooltipPositioningOption } from './tooltip.options.js';
 import { tagName } from './tooltip.options.js';
 
 test.describe('Tooltip', () => {
@@ -192,7 +191,7 @@ test.describe('Tooltip', () => {
     `);
 
     await element.evaluate((node: Tooltip) => {
-      node.positioning = 'above' as TooltipPositioningOption;
+      node.positioning = 'above';
     });
 
     await expect(element).toHaveAttribute('positioning', 'above');
```

---

### Incident Patch 8: `df2032d8` (2026-10-01)
**Commit Message**: fix(ci): invoke v8 site manifest generator directly (#36820)

**File**: `azure-pipelines.release.yml` (modified, +2/-2)
```diff
@@ -100,10 +100,10 @@ extends:
                         BEACHBALL_NPM_TOKEN: $(npmToken)
                       displayName: Publish changes and bump versions
 
-                    # create-site-manifests is a script defined in @fluentui/public-docsite-setup.
+                    # create-site-manifests is a binary defined in @fluentui/public-docsite-setup.
                     # It generates manifest files used to load the current version on developer.microsoft.com/fluentui.
                     - script: |
-                        yarn create-site-manifests ./packages/react
+                        node ./packages/public-docsite-setup/bin/create-site-manifests.js ./packages/react
                       displayName: 'Generate website manifests'
 
                     # Generate the homepage.htm file used to load developer.microsoft.com/fluentui. Note that the
```

---

### Incident Patch 9: `541b165e` (2026-10-01)
**Commit Message**: fix(react-charts): improve LineChart and GaugeChart callout bug fixes (#36739)

Co-authored-by: Atishay Jain <[REDACTED_EMAIL]>

**File**: `change/@fluentui-react-charts-44bddcc6-c2b6-4612-b1cc-b5872295c51a.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "patch",
+  "comment": "fix: improve LineChart and GaugeChart callout behavior and formatting",
+  "packageName": "@fluentui/react-charts",
+  "email": "atisjai@microsoft.com",
+  "dependentChangeType": "none"
+}
\ No newline at end of file
```

**File**: `packages/charts/react-charts/library/etc/react-charts.api.md` (modified, +10/-3)
```diff
@@ -795,11 +795,9 @@ export interface EventsAnnotationProps {
     strokeColor?: string;
 }
 
-// @public (undocumented)
+// @public
 export interface ExtendedSegment extends GaugeChartSegment {
-    // (undocumented)
     end: number;
-    // (undocumented)
     start: number;
 }
 
@@ -897,14 +895,19 @@ export const GaugeChart: React_2.FunctionComponent<GaugeChartProps>;
 
 // @public
 export interface GaugeChartCalloutData {
+    chartTitle?: string;
     chartValue: number;
     chartValueLabel: string;
     legend: string;
     maxValue: number;
     minValue: number;
+    segments?: GaugeChartCalloutSegment[];
     segmentValues: YValueHover[];
 }
 
+// @public @deprecated
+export type GaugeChartCalloutSegment = ExtendedSegment;
+
 // @public
 export interface GaugeChartProps {
     calloutProps?: Partial<ChartPopoverProps>;
@@ -984,6 +987,9 @@ export const getColorFromToken: (token: string, isDarkTheme?: boolean) => string
 // @public (undocumented)
 export function getContrastTextColor(backgroundColor: string, isDarkTheme?: boolean): string;
 
+// @public
+export const getGaugeChartSegmentLabel: (segment: ExtendedSegment, minValue: number, maxValue: number, variant: GaugeChartVariant | undefined, chartValueFormat: GaugeChartProps["chartValueFormat"], isAriaLabel?: boolean) => string;
+
 // @public (undocumented)
 export const getInvertedTextColor: (color: string, isDarkTheme?: boolean) => string;
 
@@ -1499,6 +1505,7 @@ export interface ModifiedCartesianChartProps extends CartesianChartProps {
     isCalloutForStack?: boolean;
     legendBars: JSXElement | null;
     maxOfYVal?: number;
+    onChartBlur?: () => void;
     onChartMouseLeave?: () => void;
     points: any;
     showRoundOffXTickValues?: boolean;
```

**File**: `packages/charts/react-charts/library/src/components/AreaChart/AreaChart.tsx` (modified, +1/-0)
```diff
@@ -1145,6 +1145,7 @@ export const AreaChart: React.FunctionComponent<AreaChartProps> = React.forwardR
           createStringYAxis={createStringYAxis}
           getmargins={_getMargins}
           onChartMouseLeave={_handleChartMouseLeave}
+          onChartBlur={_handleChartMouseLeave}
           getMinMaxOfYAxis={_getMinMaxOfYAxis}
           enableFirstRenderOptimization={props.enablePerfOptimization && _firstRenderOptimization}
           componentRef={cartesianChartRef}
```

**File**: `packages/charts/react-charts/library/src/components/CommonComponents/CartesianChart.test.tsx` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import { fireEvent, render } from '@testing-library/react';
+import * as React from 'react';
+import { ChartTypes, createNumericYAxis, createStringYAxis, XAxisTypes } from '../../utilities/index';
+import { CartesianChart } from './CartesianChart';
+
+describe('CartesianChart events', () => {
+  it('separates keyboard blur from mouse leave', () => {
+    const onChartBlur = jest.fn();
+    const onChartMouseLeave = jest.fn();
+    const { container } = render(
+      <CartesianChart
+        points={[]}
+        chartType={ChartTypes.LineChart}
+        xAxisType={XAxisTypes.NumericAxis}
+        width={300}
+        height={200}
+        legendBars={null}
+        hideLegend
+        hideTooltip
+        tickParams={{}}
+        getDomainNRangeValues={() => ({ dStartValue: 0, dEndValue: 1, rStartValue: 0, rEndValue: 100 })}
+        getMinMaxOfYAxis={() => ({ startValue: 0, endValue: 1 })}
+        createYAxis={createNumericYAxis}
+        createStringYAxis={createStringYAxis}
+        onChartBlur={onChartBlur}
+        onChartMouseLeave={onChartMouseLeave}
+      >
+        {() => null}
+      </CartesianChart>,
+    );
+    const chart = container.querySelector<HTMLDivElement>('[role="presentation"]');
+
+    expect(chart).not.toBeNull();
+    fireEvent.blur(chart!);
+    expect(onChartBlur).toHaveBeenCalledTimes(1);
+    expect(onChartMouseLeave).not.toHaveBeenCalled();
+
+    fireEvent.mouseLeave(chart!);
+    expect(onChartMouseLeave).toHaveBeenCalledTimes(1);
+    expect(onChartBlur).toHaveBeenCalledTimes(1);
+  });
+});
```

**File**: `packages/charts/react-charts/library/src/components/CommonComponents/CartesianChart.tsx` (modified, +7/-0)
```diff
@@ -531,6 +531,12 @@ export const CartesianChart: React.FunctionComponent<ModifiedCartesianChartProps
     props.onChartMouseLeave && props.onChartMouseLeave();
   }
 
+  function _onChartBlur(event: React.FocusEvent<HTMLDivElement>): void {
+    if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) {
+      props.onChartBlur && props.onChartBlur();
+    }
+  }
+
   function _calculateChartMinWidth(): number {
     // Adding 10px for padding on both sides
     const labelWidth = _calcMaxLabelWidthWithTransform(_tickLabels) + 10;
@@ -746,6 +752,7 @@ export const CartesianChart: React.FunctionComponent<ModifiedCartesianChartProps
       ref={(rootElem: HTMLDivElement) => {
         chartContainer.current = rootElem;
       }}
+      onBlur={_onChartBlur}
       onMouseLeave={_onChartLeave}
     >
       <div className={classes.chartWrapper} {...focusAttributes} {...arrowAttributes}>
```

**File**: `packages/charts/react-charts/library/src/components/CommonComponents/CartesianChart.types.ts` (modified, +5/-0)
```diff
@@ -702,6 +702,11 @@ export interface ModifiedCartesianChartProps extends CartesianChartProps {
    */
   onChartMouseLeave?: () => void;
 
+  /**
+   * Callback method used when focus leaves the chart boundary.
+   */
+  onChartBlur?: () => void;
+
   /** Callback method to get extra margins for domain */
   getDomainMargins?: (containerWidth: number) => Margins;
 
```

**File**: `packages/charts/react-charts/library/src/components/GanttChart/GanttChart.tsx` (modified, +1/-0)
```diff
@@ -605,6 +605,7 @@ export const GanttChart: React.FunctionComponent<GanttChartProps> = React.forwar
           getmargins={_getMargins}
           getYDomainMargins={_getYDomainMargins}
           onChartMouseLeave={_handleChartMouseLeave}
+          onChartBlur={_handleChartMouseLeave}
           useUTC={useUTC}
           children={_createBars}
         />
```

**File**: `packages/charts/react-charts/library/src/components/GaugeChart/GaugeChart.test.tsx` (modified, +111/-19)
```diff
@@ -392,19 +392,27 @@ describe('GaugeChart custom callout', () => {
     {
       segments,
       chartValue: 30,
+      chartTitle: 'Server tick time',
       minValue: 10,
-      maxValue: 110,
-      onRenderCallout: (calloutData?: GaugeChartCalloutData) => (
-        <div data-testid="custom-gauge-callout">
-          {calloutData?.legend}: {calloutData?.chartValue} blocks ({calloutData?.minValue}-{calloutData?.maxValue})
-        </div>
-      ),
+      maxValue: 120,
+      onRenderCallout: (calloutData?: GaugeChartCalloutData) => {
+        const lastSegment = calloutData?.segments?.at(-1);
+        return (
+          <div data-testid="custom-gauge-callout">
+            {calloutData?.chartTitle}: {calloutData?.legend}: {calloutData?.chartValue} blocks ({calloutData?.minValue}-
+            {calloutData?.maxValue}); last range {lastSegment?.start}-{lastSegment?.end}
+          </div>
+        );
+      },
     },
     () => {
       const chartSegments = screen.getAllByText((content, element) => element!.tagName.toLowerCase() === 'path');
       fireEvent.mouseOver(chartSegments[0]);
 
-      expect(screen.getByTestId('custom-gauge-callout')).toHaveTextContent('Low Risk: 30 blocks (10-110)');
+      expect(screen.getByTestId('custom-gauge-callout')).toHaveTextContent(
+        'Server tick time: Low Risk: 30 blocks (10-120); last range 77-110',
+      );
+      expect(screen.getByTestId('custom-gauge-callout')).not.toHaveTextContent('Unknown');
     },
   );
 
@@ -414,16 +422,74 @@ describe('GaugeChart custom callout', () => {
     {
       segments,
       chartValue: 30,
+      chartValueFormat: ([value]: [number, number]) => `${value}ms`,
       onRenderCallout: renderDefaultCallout,
     },
     () => {
       const chartSegments = screen.getAllByText((content, element) => element!.tagName.toLowerCase() === 'path');
       fireEvent.mouseOver(chartSegments[0]);
 
-      expect(screen.getByTestId('wrapped-gauge-callout')).toHaveTextContent('Current value is 30/100');
+      expect(screen.getByTestId('wrapped-gauge-callout')).toHaveTextContent('Current value is 30ms');
       expect(screen.getByTestId('wrapped-gauge-callout')).toHaveTextContent('Low Risk');
     },
   );
+
+  testWithoutWait(
+    'Should use actual values for default percentage formatting with a nonzero minimum',
+    GaugeChart,
+    {
+      segments,
+      chartValue: 125,
+      minValue: 100,
+      maxValue: 200,
+    },
+    () => {
+      const chartSegments = screen.getAllByText((content, element) => element!.tagName.toLowerCase() === 'path');
+      fireEvent.mouseOver(chartSegments[0]);
+
+      expect(screen.getByText('Current value is 63%')).toBeInTheDocument();
+      expect(screen.getByText('50% - 67%')).toBeInTheDocument();
+      expect(screen.getByRole('option', { name: 'Low Risk, 50% to 67%' })).toBeInTheDocument();
+    },
+  );
+
+  testWithoutWait(
+    'Should use actual values for fraction formatting with a nonzero minimum',
+    GaugeChart,
+    {
+      segments,
+      chartValue: 125,
+      minValue: 100,
+      maxValue: 200,
+      chartValueFormat: GaugeValueFormat.Fraction,
+    },
+    () => {
+      const chartSegments = screen.getAllByText((content, element) => element!.tagName.toLowerCase() === 'path');
+      fireEvent.mouseOver(chartSegments[0]);
+
+      expect(screen.getByText('Current value is 125/200')).toBeInTheDocument();
+      expect(screen.getByText('100 - 133')).toBeInTheDocument();
+      expect(screen.getByRole('option', { name: 'Low Risk, 100 to 133' })).toBeInTheDocument();
+    },
+  );
+
+  testWithoutWait(
+    'Should preserve single-segment labels in the callout and accessible name',
+    GaugeChart,
+    {
+      segments: [segments[0]],
+      chartValue: 25,
+      maxValue: 100,
+      variant: GaugeChartVariant.SingleSegment,
+    },
+    () => {
+      const chartSegments = screen.getAllByText((content, element) => element!.tagName.toLowerCase() === 'path');
+      fireEvent.mouseOver(chartSegments[0]);
+
+      expect(screen.getByText('33 (33%)')).toBeInTheDocument();
+      expect(screen.getByRole('option', { name: 'Low Risk, 33 out of 100 or 33%' })).toBeInTheDocument();
+    },
+  );
 });
 
 describe('GaugeChart rendering and behavior tests', () => {
@@ -504,30 +570,33 @@ describe('GaugeChart rendering and behavior tests', () => {
 
   it('should render the chart value correctly', () => {
     const customChartValue = 'Custom chart value';
+    const formatMilliseconds = ([value]: [number, number]) => (value === 0 ? 'offline' : `${value}ms`);
 
     expect(getChartValueLabel(25, 0, 100)).toBe('25%');
-    expect(getChartValueLabel(25, 0, 100, undefined, true)).toBe('25/100');
+    expect(getChartValueLabel(25, 0, 100, undefined, true)).toBe('25%');
 
     expect(getChartValueLabel(25, 0, 100, GaugeValueFormat.Percentage)).toBe('25%');
-    expect(getChartValueLabel(25, 0, 100, GaugeValueFormat.Percentage, true)).toBe('25/100');
+    expect(getChartValueLabel(25
```

---

### Incident Patch 10: `4666954b` (2026-10-01)
**Commit Message**: fixed tooltip value cut off at the bottom in HorizontalBarChartWithAxis (#36818)

**File**: `change/@fluentui-react-charts-877a7acc-394c-4f72-a73d-0ae78e3099c6.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "fixed tooltip value cut off at the bottom in HorizontalBarChartWithAxis",
+  "packageName": "@fluentui/react-charts",
+  "email": "v-baambati@microsoft.com"
+}
```

**File**: `packages/charts/react-charts/library/src/components/CommonComponents/ChartPopover.tsx` (modified, +1/-0)
```diff
@@ -84,6 +84,7 @@ export const ChartPopover: React.FunctionComponent<ChartPopoverProps> = React.fo
                     style={{
                       color: props.color ? props.color : tokens.colorNeutralForeground1,
                       fontSize: tokens.fontSizeHero700,
+                      lineHeight: tokens.lineHeightHero700,
                     }}
                   >
                     {formatToLocaleString(YValue, props.culture) as React.ReactNode}
```

**File**: `packages/charts/react-charts/library/src/components/DonutChart/__snapshots__/DonutChart.test.tsx.snap` (modified, +4/-4)
```diff
@@ -493,7 +493,7 @@ Object {
                   </div>
                   <div
                     class="fui-cart__calloutContentY"
-                    style="color: rgb(229, 229, 229); font-size: var(--fontSizeHero700);"
+                    style="color: rgb(229, 229, 229); font-size: var(--fontSizeHero700); line-height: var(--lineHeightHero700);"
                   >
                     20,000
                   </div>
@@ -731,7 +731,7 @@ Object {
                 </div>
                 <div
                   class="fui-cart__calloutContentY"
-                  style="color: rgb(229, 229, 229); font-size: var(--fontSizeHero700);"
+                  style="color: rgb(229, 229, 229); font-size: var(--fontSizeHero700); line-height: var(--lineHeightHero700);"
                 >
                   20,000
                 </div>
@@ -1009,7 +1009,7 @@ Object {
                   </div>
                   <div
                     class="fui-cart__calloutContentY"
-                    style="color: rgb(229, 229, 229); font-size: var(--fontSizeHero700);"
+                    style="color: rgb(229, 229, 229); font-size: var(--fontSizeHero700); line-height: var(--lineHeightHero700);"
                   >
                     20,000
                   </div>
@@ -1247,7 +1247,7 @@ Object {
                 </div>
                 <div
                   class="fui-cart__calloutContentY"
-                  style="color: rgb(229, 229, 229); font-size: var(--fontSizeHero700);"
+                  style="color: rgb(229, 229, 229); font-size: var(--fontSizeHero700); line-height: var(--lineHeightHero700);"
                 >
                   20,000
                 </div>
```

**File**: `packages/charts/react-charts/library/src/components/GanttChart/__snapshots__/GanttChart.test.tsx.snap` (modified, +2/-2)
```diff
@@ -472,7 +472,7 @@ exports[`GanttChart interaction and accessibility tests should render custom cal
               </div>
               <div
                 class="fui-cart__calloutContentY"
-                style="color: rgb(16, 124, 16); font-size: var(--fontSizeHero700);"
+                style="color: rgb(16, 124, 16); font-size: var(--fontSizeHero700); line-height: var(--lineHeightHero700);"
               >
                 01/01/2017 - 02/02/2017
               </div>
@@ -4964,7 +4964,7 @@ exports[`GanttChart rendering and behavior tests should render callout correctly
               </div>
               <div
                 class="fui-cart__calloutContentY"
-                style="color: rgb(16, 124, 16); font-size: var(--fontSizeHero700);"
+                style="color: rgb(16, 124, 16); font-size: var(--fontSizeHero700); line-height: var(--lineHeightHero700);"
               >
                 01/01/2017 - 02/02/2017
               </div>
```

**File**: `packages/charts/react-charts/library/src/components/GroupedVerticalBarChart/__snapshots__/GroupedVerticalBarChart.test.tsx.snap` (modified, +1/-1)
```diff
@@ -1363,7 +1363,7 @@ exports[`GroupedVerticalBarChart - mouse events Should render callout correctly
               </div>
               <div
                 class="fui-cart__calloutContentY"
-                style="color: rgb(0, 188, 242); font-size: var(--fontSizeHero700);"
+                style="color: rgb(0, 188, 242); font-size: var(--fontSizeHero700); line-height: var(--lineHeightHero700);"
               >
                 33%
               </div>
```

**File**: `packages/charts/react-charts/library/src/components/HorizontalBarChartWithAxis/HorizontalBarChartWithAxis.test.tsx` (modified, +2/-0)
```diff
@@ -4,6 +4,7 @@ import { HorizontalBarChartWithAxis } from './HorizontalBarChartWithAxis';
 import { toHaveNoViolations } from 'jest-axe';
 import type { HorizontalBarChartWithAxisDataPoint } from '../../HorizontalBarChart';
 import { render } from '@testing-library/react';
+import { tokens } from '@fluentui/react-theme';
 import * as React from 'react';
 expect.extend(toHaveNoViolations);
 
@@ -465,6 +466,7 @@ describe('Horizontal bar chart with axis - Subcomponent Labels', () => {
     const yAxisCallOutData = getByClass(container, /calloutContentY/i);
     expect(yAxisCallOutData).toBeDefined();
     expect(yAxisCallOutData[0].textContent).toEqual('1000');
+    expect((yAxisCallOutData[0] as HTMLElement).style.lineHeight).toEqual(tokens.lineHeightHero700);
   });
 
   it('Should show the callout with string yaxis tooltip data', async () => {
```

**File**: `packages/charts/react-charts/library/src/components/SankeyChart/__snapshots__/SankeyChart.test.tsx.snap` (modified, +1/-1)
```diff
@@ -12256,7 +12256,7 @@ exports[`SankeyChart - mouse events Should render callout correctly on mouseover
               />
               <div
                 class="fui-cart__calloutContentY"
-                style="color: rgb(135, 100, 184); font-size: var(--fontSizeHero700);"
+                style="color: rgb(135, 100, 184); font-size: var(--fontSizeHero700); line-height: var(--lineHeightHero700);"
               >
                 14
               </div>
```

**File**: `packages/charts/react-charts/library/src/components/VerticalBarChart/__snapshots__/VerticalBarChart.test.tsx.snap` (modified, +1/-1)
```diff
@@ -5147,7 +5147,7 @@ exports[`VerticalBarChart - mouse events Should render callout correctly on mous
               </div>
               <div
                 class="fui-cart__calloutContentY"
-                style="color: blue; font-size: var(--fontSizeHero700);"
+                style="color: blue; font-size: var(--fontSizeHero700); line-height: var(--lineHeightHero700);"
               >
                 50,000
               </div>
```

---

### Incident Patch 11: `45af0379` (2026-09-28)
**Commit Message**: fix(web-components): keep switch indicator visible in forced-colors mode (#36742)

Co-authored-by: Chris Holt <[REDACTED_EMAIL]>

**File**: `change/@fluentui-web-components-8f3c2a1d-5e6b-4c7d-9a0e-1b2c3d4e5f60.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "patch",
+  "comment": "fix(switch): keep the indicator visible in forced-colors mode",
+  "packageName": "@fluentui/web-components",
+  "email": "jiayin.3zh@gmail.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `packages/web-components/src/switch/switch.styles.ts` (modified, +2/-2)
```diff
@@ -137,12 +137,12 @@ export const styles = css`
     .checked-indicator,
     :host(:hover) .checked-indicator,
     :host(:active) .checked-indicator {
-      background-color: ActiveCaption;
+      background-color: CanvasText;
     }
     :host(${checkedState}) .checked-indicator,
     :host(${checkedState}:hover) .checked-indicator,
     :host(${checkedState}:active) .checked-indicator {
-      background-color: ButtonFace;
+      background-color: HighlightText;
     }
     :host(${nativeDisabledState}) .checked-indicator,
     :host(${checkedState}${nativeDisabledState}) .checked-indicator {
```

---

### Incident Patch 12: `8add8c87` (2026-09-25)
**Commit Message**: feat: add build-time icon variants to public Storybooks (#36797)

**File**: `.storybook/react-icons-font.css` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+/* Prevent inherited text weight from synthetically bolding font icons.
+ * TODO: Remove when https://github.com/microsoft/fluentui-system-icons/issues/1235 is fixed.
+ */
+[data-fui-icon] {
+  font-weight: normal;
+}
```

**File**: `.storybook/react-icons-webpack.js` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+// @ts-check
+
+const FluentUIReactIconsFontSubsettingPlugin = require('@fluentui/react-icons-font-subsetting-webpack-plugin').default;
+
+const FONT_ICON_VARIANT = 'fonts';
+const iconLoader = require.resolve('@fluentui/react-icons-atomic-webpack-loader');
+const headlessBaseStyles = require.resolve('@fluentui/react-icons/headless/styles.css');
+const headlessFontStyles = require.resolve('@fluentui/react-icons/headless/fonts/styles.css');
+const fontIconStyles = require.resolve('./react-icons-font.css');
+
+/** @typedef {string | string[] | import('webpack').EntryObject} ResolvedEntry */
+
+/**
+ * @param {ResolvedEntry} entry
+ * @param {string[]} imports
+ * @returns {ResolvedEntry}
+ */
+function prependEntryImports(entry, imports) {
+  if (typeof entry === 'string') {
+    return [...imports, entry];
+  }
+
+  if (Array.isArray(entry)) {
+    return [...imports, ...entry];
+  }
+
+  if (entry && typeof entry === 'object') {
+    return Object.fromEntries(
+      Object.entries(entry).map(([name, value]) => {
+        if (typeof value === 'string' || Array.isArray(value)) {
+          return [name, prependEntryImports(value, imports)];
+        }
+
+        if (value && typeof value === 'object') {
+          return [name, { ...value, import: prependEntryImports(value.import ?? [], imports) }];
+        }
+
+        return [name, value];
+      }),
+    );
+  }
+
+  return entry;
+}
+
+/**
+ * Configures atomic Fluent icon imports for Storybook.
+ * Set FLUENTUI_ICON_VARIANT=fonts to use subsetted font icons; SVG atoms are the default.
+ *
+ * @see https://github.com/microsoft/fluentui-system-icons/blob/main/packages/react-icons-atomic-webpack-loader/README.md
+ * @see https://github.com/microsoft/fluentui-system-icons/tree/main/packages/react-icons-font-subsetting-webpack-plugin
+ *
+ * @param {{ config: import('webpack').Configuration; headless?: boolean }} options
+ */
+function configureReactIcons(options) {
+  const { config, headless = false } = options;
+  const useFontIcons = process.env.FLUENTUI_ICON_VARIANT === FONT_ICON_VARIANT;
+
+  config.module ??= {};
+  config.module.rules ??= [];
+  config.module.rules.push({
+    test: /\.[mc]?[jt]sx?$/,
+    enforce: 'pre',
+    use: [
+      {
+        loader: iconLoader,
+        options: {
+          iconVariant: useFontIcons ? 'fonts' : 'svg',
+          fallbackVariant: 'svg',
+          headless,
+        },
+      },
+    ],
+  });
+
+  if (useFontIcons) {
+    config.module.rules.push({
+      test: /\.(ttf|woff2?)$/,
+      type: 'asset',
+    });
+    config.plugins ??= [];
+    config.plugins.push(new FluentUIReactIconsFontSubsettingPlugin());
+  }
+
+  /** @type {string[]} */
+  const styleImports = [];
+  if (headless) {
+    styleImports.push(headlessBaseStyles);
+  }
+  if (useFontIcons) {
+    if (headless) {
+      styleImports.push(headlessFontStyles);
+    }
+    styleImports.push(fontIconStyles);
+  }
+
+  if (styleImports.length > 0) {
+    const originalEntry = config.entry;
+
+    config.entry = async () => {
+      const entry = typeof originalEntry === 'function' ? await originalEntry() : originalEntry;
+      return prependEntryImports(entry ?? [], styleImports);
+    };
+  }
+
+  return config;
+}
+
+module.exports = { configureReactIcons };
```

**File**: `apps/public-docsite-v9-headless/.storybook/main.js` (modified, +2/-0)
```diff
@@ -1,5 +1,6 @@
 const headlessMain = require('../../../packages/react-components/react-headless-components-preview/stories/.storybook/main');
 const { registerRules, rules } = require('@fluentui/scripts-storybook');
+const { configureReactIcons } = require('../../../.storybook/react-icons-webpack');
 
 module.exports = /** @type {Omit<import('../../../.storybook/main'), 'typescript'|'babel'>} */ ({
   ...headlessMain,
@@ -18,6 +19,7 @@ module.exports = /** @type {Omit<import('../../../.storybook/main'), 'typescript
     if (process.env.REACT_COMPILER) {
       registerRules({ rules: rules.reactCompilerRule, config: localConfig });
     }
+    configureReactIcons({ config: localConfig, headless: true });
 
     return localConfig;
   },
```

**File**: `apps/public-docsite-v9-headless/project.json` (modified, +12/-1)
```diff
@@ -6,6 +6,12 @@
   "tags": ["platform:web", "vNext"],
   "targets": {
     "build-storybook": {
+      "inputs": [
+        "default",
+        "{workspaceRoot}/.storybook/**",
+        "{projectRoot}/.storybook/**",
+        { "env": "FLUENTUI_ICON_VARIANT" }
+      ],
       "dependsOn": [
         {
           "projects": ["react-storybook-addon", "react-storybook-addon-export-to-sandbox", "storybook-llms-extractor"],
@@ -20,7 +26,12 @@
           "target": "build"
         }
       ],
-      "inputs": ["default", "{workspaceRoot}/.storybook/**", "{projectRoot}/.storybook/**"]
+      "inputs": [
+        "default",
+        "{workspaceRoot}/.storybook/**",
+        "{projectRoot}/.storybook/**",
+        { "env": "FLUENTUI_ICON_VARIANT" }
+      ]
     }
   }
 }
```

**File**: `apps/public-docsite-v9/.storybook/main.js` (modified, +2/-0)
```diff
@@ -2,6 +2,7 @@ const path = require('path');
 const { getPackageStoriesGlob, registerTsPaths, rules, registerRules } = require('@fluentui/scripts-storybook');
 
 const rootMain = require('../../../.storybook/main');
+const { configureReactIcons } = require('../../../.storybook/react-icons-webpack');
 
 const tsConfigAllPath = path.join(__dirname, '../../../tsconfig.base.all.json');
 
@@ -59,6 +60,7 @@ module.exports = /** @type {Omit<import('../../../.storybook/main'), 'typescript
       rules: [rules.scssRule, ...(process.env.REACT_COMPILER ? rules.reactCompilerRule : [])],
       config: localConfig,
     });
+    configureReactIcons({ config: localConfig });
 
     return localConfig;
   },
```

**File**: `apps/public-docsite-v9/project.json` (modified, +12/-1)
```diff
@@ -6,6 +6,12 @@
   "tags": ["platform:web", "vNext"],
   "targets": {
     "build-storybook": {
+      "inputs": [
+        "default",
+        "{workspaceRoot}/.storybook/**",
+        "{projectRoot}/.storybook/**",
+        { "env": "FLUENTUI_ICON_VARIANT" }
+      ],
       "dependsOn": [
         {
           "projects": [
@@ -21,7 +27,12 @@
       ]
     },
     "build-storybook:docsite": {
-      "inputs": ["default", "{workspaceRoot}/.storybook/**", "{projectRoot}/.storybook/**"],
+      "inputs": [
+        "default",
+        "{workspaceRoot}/.storybook/**",
+        "{projectRoot}/.storybook/**",
+        { "env": "FLUENTUI_ICON_VARIANT" }
+      ],
       "outputs": ["{projectRoot}/dist/react"],
       "executor": "nx:noop",
       "dependsOn": [
```

**File**: `change/@fluentui-react-migration-v0-v9-48d6835c-7638-436a-a618-cfeeb96de643.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "none",
+  "comment": "docs: refresh generated API report after icon dependency update",
+  "packageName": "@fluentui/react-migration-v0-v9",
+  "email": "martinhochel@microsoft.com",
+  "dependentChangeType": "none"
+}
\ No newline at end of file
```

**File**: `package.json` (modified, +3/-1)
```diff
@@ -59,7 +59,9 @@
     "@eslint/js": "9.26.0",
     "@floating-ui/dom": "1.6.12",
     "@fluentui/react-compiler-analyzer": "0.0.0-experimental.rc-analyzer.20260526-7c5862ce36.0",
-    "@fluentui/react-icons": "^2.0.306",
+    "@fluentui/react-icons": "^2.0.339",
+    "@fluentui/react-icons-atomic-webpack-loader": "0.0.6",
+    "@fluentui/react-icons-font-subsetting-webpack-plugin": "2.0.339",
     "@fluentui/react-integration-tester": "*",
     "@fluentui/scripts-test-ssr": "*",
     "@fluentui/storybook-llms-extractor": "*",
```

---

### Incident Patch 13: `a1d67784` (2026-09-25)
**Commit Message**: fix(react-tooltip): preserve virtual target tooltips (#36794)

Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `change/@fluentui-react-tooltip-f9eda5e9-9f5b-4117-b6a4-eb3c882eba45.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "fix: preserve virtual target tooltips",
+  "packageName": "@fluentui/react-tooltip",
+  "email": "paulmardling@microsoft.com"
+}
```

**File**: `packages/react-components/react-tooltip/library/src/components/Tooltip/Tooltip.test.tsx` (modified, +50/-0)
```diff
@@ -2,6 +2,7 @@ import * as React from 'react';
 import { Tooltip } from './Tooltip';
 import { isConformant } from '../../testing/isConformant';
 import type { IsConformantOptions } from '@fluentui/react-conformance';
+import type { PositioningVirtualElement } from '@fluentui/react-positioning';
 import type { RenderResult } from '@testing-library/react';
 import { act, fireEvent, render, waitFor } from '@testing-library/react';
 import { resetIdsForTests } from '@fluentui/react-utilities';
@@ -225,4 +226,53 @@ describe('Tooltip', () => {
     expect(onPositioningEnd).toHaveBeenCalledTimes(2);
     expect(onPositioningEnd).toHaveBeenLastCalledWith(visibleEvent);
   });
+
+  it('hides when positioning reports an explicit DOM target as hidden', () => {
+    const onPositioningEnd = jest.fn();
+    const result = render(
+      <Tooltip
+        content="Tooltip content"
+        relationship="label"
+        visible
+        positioning={{ target: document.body, onPositioningEnd }}
+      >
+        <button />
+      </Tooltip>,
+    );
+    const tooltip = getByRoleTooltip(result);
+    const positioningEvent = new CustomEvent('fui-positioningend', {
+      detail: { placement: 'top', escaped: false, referenceHidden: true },
+    });
+
+    act(() => tooltip.dispatchEvent(positioningEvent));
+
+    expect(getComputedStyle(tooltip).visibility).toBe('hidden');
+    expect(onPositioningEnd).toHaveBeenLastCalledWith(positioningEvent);
+  });
+
+  it('remains visible when positioning reports a virtual target as hidden', () => {
+    const onPositioningEnd = jest.fn();
+    const virtualTarget: PositioningVirtualElement = {
+      getBoundingClientRect: () => new DOMRect(),
+    };
+    const result = render(
+      <Tooltip
+        content="Tooltip content"
+        relationship="label"
+        visible
+        positioning={{ target: virtualTarget, onPositioningEnd }}
+      >
+        <button />
+      </Tooltip>,
+    );
+    const tooltip = getByRoleTooltip(result);
+    const positioningEvent = new CustomEvent('fui-positioningend', {
+      detail: { placement: 'top', escaped: false, referenceHidden: true },
+    });
+
+    act(() => tooltip.dispatchEvent(positioningEvent));
+
+    expect(getComputedStyle(tooltip).visibility).not.toBe('hidden');
+    expect(onPositioningEnd).toHaveBeenLastCalledWith(positioningEvent);
+  });
 });
```

**File**: `packages/react-components/react-tooltip/library/src/components/Tooltip/useTooltipBase.tsx` (modified, +4/-1)
```diff
@@ -21,6 +21,7 @@ import {
   useEventCallback,
   slot,
   getReactElementRef,
+  isHTMLElement,
 } from '@fluentui/react-utilities';
 import type { TooltipBaseProps, TooltipBaseState, TooltipChildProps, OnVisibleChangeData } from './Tooltip.types';
 import { arrowHeight, tooltipBorderRadius } from './private/constants';
@@ -82,9 +83,11 @@ export const useTooltipBase_unstable = (props: TooltipBaseProps): TooltipBaseSta
   state.content.id = useId('tooltip-', state.content.id);
 
   const resolvedPositioning = resolvePositioningShorthand(state.positioning);
+  const isVirtualTarget = resolvedPositioning.target !== undefined && !isHTMLElement(resolvedPositioning.target);
   const onPositioningEnd = useEventCallback((event: OnPositioningEndEvent) => {
     // Portaled tooltips can escape the trigger's clipping ancestors while the trigger is still visible.
-    setHidden(event.detail.referenceHidden);
+    // Virtual targets can be reported as hidden based on synthetic geometry.
+    setHidden(!isVirtualTarget && event.detail.referenceHidden);
     resolvedPositioning.onPositioningEnd?.(event);
   });
 
```

---

### Incident Patch 14: `5f32665b` (2026-09-25)
**Commit Message**: fixed line&Area chart voice control access issue (#36703)

**File**: `change/@fluentui-react-charts-c03f5c14-f431-4232-af89-3fed5653212d.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "Fixed voice control accessibility issue for the chart line and area charts",
+  "packageName": "@fluentui/react-charts",
+  "email": "v-baambati@microsoft.com"
+}
```

**File**: `packages/charts/react-charts/library/src/components/AreaChart/AreaChart.tsx` (modified, +31/-3)
```diff
@@ -759,7 +759,7 @@ export const AreaChart: React.FunctionComponent<AreaChartProps> = React.forwardR
             <g
               key={`${index}-dots-${_uniqueIdForGraph}`}
               clipPath="url(#clip)"
-              role="region"
+              role="listbox"
               aria-label={`${points[index].legend}, series ${index + 1} of ${points.length} with ${
                 points[index].data.length
               } data points.`}
@@ -769,6 +769,12 @@ export const AreaChart: React.FunctionComponent<AreaChartProps> = React.forwardR
                 const xDataPoint = singlePoint.xVal instanceof Date ? singlePoint.xVal.getTime() : singlePoint.xVal;
                 lineColor = points[index]!.color!;
                 const legend = points[index]!.legend;
+                const { opacity: circleOpacity, radius: circleRadiusValue } = _getCircleOpacityAndRadius(
+                  xDataPoint,
+                  circleRadius,
+                  circleId,
+                  legend,
+                );
                 return (
                   <circle
                     key={circleId}
@@ -779,14 +785,16 @@ export const AreaChart: React.FunctionComponent<AreaChartProps> = React.forwardR
                     stroke={lineColor}
                     strokeWidth={3}
                     fill={_updateCircleFillColor(xDataPoint, lineColor, circleId)}
+                    // Elements with visibility: hidden cannot receive focus, so use opacity: 0 instead to hide them.
+                    opacity={circleOpacity}
                     onMouseOut={_onRectMouseOut}
                     onMouseOver={event => _onRectMouseMove(event)}
                     {..._getOnClickHandler(points, index, pointIndex)}
                     onFocus={event => _handleFocus(event, index, pointIndex, circleId)}
                     onBlur={_handleBlur}
                     {...getSecureProps(pointOptions)}
-                    r={_getCircleRadius(xDataPoint, circleRadius, circleId, legend)}
-                    role="img"
+                    r={circleRadiusValue}
+                    role="option"
                     aria-label={
                       (!_hasDuplicateXValues && !_hasMissingXValues && _getAriaLabel(index, pointIndex)) || undefined
                     }
@@ -867,6 +875,26 @@ export const AreaChart: React.FunctionComponent<AreaChartProps> = React.forwardR
       }
     }
 
+    function _getCircleOpacityAndRadius(
+      xDataPoint: number,
+      circleRadius: number,
+      circleId: string,
+      legend: string,
+    ): { opacity: number; radius: number } {
+      // Hide points whose legend isn't highlighted.
+      if (!_noLegendHighlighted() && !_legendHighlighted(legend)) {
+        return { opacity: 0, radius: 0 };
+      }
+      if (isCircleClicked && nearestCircleToHighlight === xDataPoint) {
+        return { opacity: 1, radius: 1 };
+      } else if (nearestCircleToHighlight === xDataPoint || activePoint === circleId) {
+        return { opacity: 1, radius: circleRadius };
+      }
+      // Keep focusable points full-size but transparent (opacity:0, not visibility:hidden) so Voice Control
+      // can target them while they stay visually hidden and remain focusable.
+      return { opacity: 0, radius: circleRadius };
+    }
+
     /**
      * This function checks if the given legend is highlighted or not.
      * A legend can be highlighted in 2 ways:
```

**File**: `packages/charts/react-charts/library/src/components/LineChart/LineChart.test.tsx` (modified, +7/-0)
```diff
@@ -788,6 +788,13 @@ describe('LineChart snapShot testing', () => {
     expect(wrapper).toMatchSnapshot();
   });
 
+  it('exposes optimized large-data lines as labeled options', () => {
+    render(<LineChart data={basicChartPoints} optimizeLargeData />);
+
+    expect(screen.getByRole('listbox', { name: 'metaData1 data series' })).toBeInTheDocument();
+    expect(screen.getByRole('option', { name: 'metaData1, line 1 of 3 with 2 data points.' })).toBeInTheDocument();
+  });
+
   it('Should render with default colors when line color is not provided', async () => {
     const points: LineChartPoints[] = [
       {
```

**File**: `packages/charts/react-charts/library/src/components/LineChart/LineChart.tsx` (modified, +13/-8)
```diff
@@ -538,6 +538,9 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
         const pointsForLine: JSXElement[] = [];
 
         const legendVal: string = _points[i].legend;
+        const seriesAriaLabel = `${legendVal}, line ${i + 1} of ${_points.length} with ${
+          _points[i].data.length
+        } data points.`;
         const lineColor: string = _points[i].color!;
         const verticaLineHeight = containerHeight - margins.bottom! + 6;
         const useSecondaryYScale = !!(_points[i].useSecondaryYScale && _yScaleSecondary);
@@ -623,7 +626,7 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                     onMouseOut={_handleMouseOut}
                     strokeWidth={activePoint === circleId ? DEFAULT_LINE_STROKE_SIZE : 0}
                     stroke={activePoint === circleId ? lineColor : ''}
-                    role="img"
+                    role="option"
                     aria-label={_points[i].data[0].text ?? _getAriaLabel(i, 0)}
                     ref={(e: SVGCircleElement | null) => {
                       _refCallback(e!, circleId);
@@ -731,6 +734,8 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                 {..._getClickHandler(_points[i].onLineClick)}
                 opacity={1}
                 tabIndex={isLegendSelected ? 0 : undefined}
+                role={props.optimizeLargeData ? 'option' : undefined}
+                aria-label={props.optimizeLargeData ? seriesAriaLabel : undefined}
               />,
             );
           } else if (shouldDrawLines) {
@@ -806,7 +811,7 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                     onMouseOver={event => _onMouseOverLargeDataset(i, verticaLineHeight, event, yScale)}
                     onFocus={event => _onFocusLargeDataset(i, verticaLineHeight, event, yScale, k)}
                     onMouseOut={_handleMouseOut}
-                    role="img"
+                    role="option"
                     aria-label={_points[i].data[k].text ?? _getAriaLabel(i, k)}
                   />,
                 );
@@ -910,7 +915,7 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                       fill={_points[i].data[j - 1]?.markerColor || _getPointFill(lineColor, circleId, j, false)}
                       stroke={_points[i].data[j - 1]?.markerColor || lineColor}
                       strokeWidth={strokeWidth}
-                      role="img"
+                      role="option"
                       aria-label={_points[i].data[j - 1].text ?? _getAriaLabel(i, j - 1)}
                     />
                     {!_isScatterPolar && supportsTextMode && text && (
@@ -988,7 +993,7 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                     fill={_points[i].data[j - 1]?.markerColor || _getPointFill(lineColor, circleId, j, false)}
                     stroke={_points[i].data[j - 1]?.markerColor || lineColor}
                     strokeWidth={strokeWidth}
-                    role="img"
+                    role="option"
                     aria-label={_getAriaLabel(i, j - 1)}
                     tabIndex={isLegendSelected ? 0 : undefined}
                   />
@@ -1076,7 +1081,7 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                           fill={_getPointFill(lineColor, lastCircleId, j, true)}
                           stroke={lineColor}
                           strokeWidth={strokeWidth}
-                          role="img"
+                          role="option"
                           aria-label={_points[i].data[j].text ?? _getAriaLabel(i, j)}
                         />
                         {!_isScatterPolar && lastSupportsTextMode && lastText && (
@@ -1153,7 +1158,7 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                         fill={_points[i].data[j]?.markerColor || _getPointFill(lineColor, lastCircleId, j, true)}
                         stroke={_points[i].data[j]?.markerColor || lineColor}
                         strokeWidth={strokeWidth}
-                        role="img"
+                        role="option"
                         aria-label={_getAriaLabel(i, j)}
                         tabIndex={isLegendSelected ? 0 : undefined}
                       />
@@ -1357,8 +1362,8 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
         lines.push(
           <g
             key={`line_${i}`}
-            role="region"
-            aria-label={`${legendVal}, line ${i + 1} of ${_points.length} with ${_points[i].data.length} data points.`}
+            role="listbox"
+            aria-label={props.optimizeLargeData ? `${legendVal} data series` : seriesAriaLabel}
           >
             {bordersForLine}
             {linesForLine}
```

**File**: `packages/charts/react-charts/library/src/components/LineChart/__snapshots__/LineChart.test.tsx.snap` (modified, +243/-243)
```diff
@@ -367,7 +367,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
           <g>
             <g
               aria-label="metaData3, line 3 of 3 with 2 data points."
-              role="region"
+              role="listbox"
             >
               <line
                 id="lineID_r_1__2_1"
@@ -390,7 +390,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
                 fill="yellow"
                 id="circle_r_0__2_1"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="yellow"
                 stroke-width="4"
                 tabindex="0"
@@ -405,7 +405,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
                 fill="yellow"
                 id="circle_r_0__2_11L"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="yellow"
                 stroke-width="4"
                 tabindex="0"
@@ -423,7 +423,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
             </g>
             <g
               aria-label="metaData2, line 2 of 3 with 2 data points."
-              role="region"
+              role="listbox"
             >
               <line
                 id="lineID_r_1__1_1"
@@ -446,7 +446,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
                 fill="green"
                 id="circle_r_0__1_1"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="green"
                 stroke-width="4"
                 tabindex="0"
@@ -461,7 +461,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
                 fill="green"
                 id="circle_r_0__1_11L"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="green"
                 stroke-width="4"
                 tabindex="0"
@@ -479,7 +479,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
             </g>
             <g
               aria-label="metaData1, line 1 of 3 with 2 data points."
-              role="region"
+              role="listbox"
             >
               <line
                 id="lineID_r_1__0_1"
@@ -502,7 +502,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
                 fill="red"
                 id="circle_r_0__0_1"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="red"
                 stroke-width="4"
                 tabindex="0"
@@ -517,7 +517,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
                 fill="red"
                 id="circle_r_0__0_11L"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="red"
                 stroke-width="4"
                 tabindex="0"
@@ -992,7 +992,7 @@ exports[`Line chart rendering Should render the Line chart with points in multip
           <g>
             <g
               aria-label="metaData3, line 3 of 3 with 2 data points."
-              role="region"
+              role="listbox"
             >
               <line
                 id="lineID_r_c__2_1"
@@ -1013,7 +1013,7 @@ exports[`Line chart rendering Should render the Line chart with points in multip
                 fill="yellow"
                 id="circle_r_b__2_1"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="yellow"
                 stroke-width="4"
                 tabindex="0"
@@ -1026,7 +1026,7 @@ exports[`Line chart rendering Should render the Line chart with points in multip
                 fill="yellow"
                 id="circle_r_b__2_11L"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="yellow"
                 stroke-width="4"
                 tabindex="0"
@@ -1044,7 +1044,7 @@ exports[`Line chart rendering Should render the Line chart with points in multip
             </g>
             <g
               aria-label="metaData2, line 2 of 3 with 2 data points."
-              role="region"
+              role="listbox"
             >
               <line
                 id="lineID_r_c__1_1"
@@ -1067,7 +1067,7 @@ exports[`Line chart rendering Should render the Line chart with points in multip
                 fill="green"
                 id="circle_r_b__1_1"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="green"
                 stroke-width="4"
                 tabindex="0"
@@ -1082,7 +1082,7 @@ exports[`Line chart rendering Should render the Line chart with points in multip
               
```

**File**: `packages/charts/react-charts/stories/src/AreaChart/AreaChartLargeData.stories.tsx` (modified, +35/-132)
```diff
@@ -2,6 +2,31 @@ import * as React from 'react';
 import type { JSXElement } from '@fluentui/react-components';
 import { AreaChart, DataVizPalette } from '@fluentui/react-charts';
 
+type IChartPoint = {
+  x: number;
+  y: number;
+};
+
+const createLargeDataSet = (count: number, phaseOffset: number, amplitude: number, baseline: number): IChartPoint[] => {
+  const points: IChartPoint[] = [];
+
+  for (let i = 0; i < count; i++) {
+    const trend = i * 0.015;
+    const wave1 = Math.sin((i + phaseOffset) * 0.08) * amplitude;
+    const wave2 = Math.cos((i + phaseOffset) * 0.03) * (amplitude * 0.35);
+    const y = Math.max(0, Math.round(baseline + trend + wave1 + wave2));
+
+    points.push({
+      x: i,
+      y,
+    });
+  }
+
+  return points;
+};
+
+const DATA_POINT_COUNT = 5000;
+
 export const AreaChartLargeData = (): JSXElement => {
   const [width, setWidth] = React.useState<number>(700);
   const [height, setHeight] = React.useState<number>(300);
@@ -13,134 +38,9 @@ export const AreaChartLargeData = (): JSXElement => {
     setHeight(parseInt(e.target.value, 10));
   };
 
-  const chart1Points = [
-    {
-      x: 20,
-      y: 9,
-    },
-    {
-      x: 25,
-      y: 14,
-    },
-    {
-      x: 30,
-      y: 14,
-    },
-    {
-      x: 35,
-      y: 23,
-    },
-    {
-      x: 40,
-      y: 20,
-    },
-    {
-      x: 45,
-      y: 31,
-    },
-    {
-      x: 50,
-      y: 29,
-    },
-    {
-      x: 55,
-      y: 27,
-    },
-    {
-      x: 60,
-      y: 37,
-    },
-    {
-      x: 65,
-      y: 51,
-    },
-  ];
-
-  const chart2Points = [
-    {
-      x: 20,
-      y: 21,
-    },
-    {
-      x: 25,
-      y: 25,
-    },
-    {
-      x: 30,
-      y: 10,
-    },
-    {
-      x: 35,
-      y: 10,
-    },
-    {
-      x: 40,
-      y: 14,
-    },
-    {
-      x: 45,
-      y: 18,
-    },
-    {
-      x: 50,
-      y: 9,
-    },
-    {
-      x: 55,
-      y: 23,
-    },
-    {
-      x: 60,
-      y: 7,
-    },
-    {
-      x: 65,
-      y: 55,
-    },
-  ];
-
-  const chart3Points = [
-    {
-      x: 20,
-      y: 30,
-    },
-    {
-      x: 25,
-      y: 35,
-    },
-    {
-      x: 30,
-      y: 33,
-    },
-    {
-      x: 35,
-      y: 40,
-    },
-    {
-      x: 40,
-      y: 10,
-    },
-    {
-      x: 45,
-      y: 40,
-    },
-    {
-      x: 50,
-      y: 34,
-    },
-    {
-      x: 55,
-      y: 40,
-    },
-    {
-      x: 60,
-      y: 60,
-    },
-    {
-      x: 65,
-      y: 40,
-    },
-  ];
+  const chart1Points = React.useMemo(() => createLargeDataSet(DATA_POINT_COUNT, 0, 26, 60), []);
+  const chart2Points = React.useMemo(() => createLargeDataSet(DATA_POINT_COUNT, 17, 22, 48), []);
+  const chart3Points = React.useMemo(() => createLargeDataSet(DATA_POINT_COUNT, 41, 30, 56), []);
 
   const chartPoints = [
     {
@@ -161,7 +61,7 @@ export const AreaChartLargeData = (): JSXElement => {
   ];
 
   const chartData = {
-    chartTitle: 'Area chart large data example',
+    chartTitle: `Area chart large data example (${DATA_POINT_COUNT} points per series)`,
     lineChartData: chartPoints,
   };
   const rootStyle = { width: `${width}px`, height: `${height}px` };
@@ -178,7 +78,7 @@ export const AreaChartLargeData = (): JSXElement => {
           id="changeWidth_Large"
           onChange={_onWidthChange}
           aria-label="Change Width"
-          aria-valuetext={`current value ${width}', Minimum 200 and Maximum 1000`}
+          aria-valuetext={`current value ${width}, Minimum 200 and Maximum 1000`}
         />
         <label htmlFor="changeHeight_Large">Change Height:</label>
         <input
@@ -189,7 +89,7 @@ export const AreaChartLargeData = (): JSXElement => {
           id="changeHeight_Large"
           onChange={_onHeightChange}
           aria-label="Change Height"
-          aria-valuetext={`current value ${height}', Minimum 200 and Maximum 1000`}
+          aria-valuetext={`current value ${height}, Minimum 200 and Maximum 1000`}
         />
       </div>
       <div style={rootStyle}>
@@ -209,6 +109,9 @@ export const AreaChartLargeData = (): JSXElement => {
 };
 AreaChartLargeData.parameters = {
   docs: {
-    description: {},
+    description: {
+      story:
+        'This story demonstrates an AreaChart with a large dataset, allowing dynamic resizing of the chart container.',
+    },
   },
 };
```

---

### Incident Patch 15: `aa2f85a0` (2026-09-24)
**Commit Message**: fix(react-avatar): make enclosure cleanup linear (#36738)

Co-authored-by: Copilot <[REDACTED_EMAIL]>
Co-authored-by: Dmytro Kirpa <[REDACTED_EMAIL]>

**File**: `change/@fluentui-react-avatar-43a7ed01-2573-4a4a-9a5b-6b56387b4e86.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "patch",
+  "comment": "fix: avoid repeated scanning of unmatched name enclosures when generating initials",
+  "packageName": "@fluentui/react-avatar",
+  "email": "223556219+Copilot@users.noreply.github.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `packages/react-components/react-avatar/library/src/utils/getInitials.enclosures.test.tsx` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+import * as React from 'react';
+import { performance } from 'node:perf_hooks';
+import { runInNewContext } from 'node:vm';
+import { render, screen } from '@testing-library/react';
+import { Avatar } from '../components/Avatar/Avatar';
+import { getInitials } from './getInitials';
+
+describe('Avatar name enclosure cleanup', () => {
+  it('preserves enclosure, initials, and Unicode behavior', () => {
+    for (const name of [
+      'Ada Lovelace',
+      'Ada (Team) Lovelace',
+      'Ada [Team] Lovelace',
+      'Ada {Team} Lovelace',
+      'Ada [Team) Lovelace',
+      'Ada [[Team] Lovelace',
+      'Ada [[[ Lovelace',
+    ]) {
+      expect(getInitials(name, false)).toBe('AL');
+      expect(getInitials(name, true)).toBe('LA');
+      expect(getInitials(name, false, { firstInitialOnly: true })).toBe('A');
+    }
+
+    expect(getInitials('\u00cdrissa \u00de\u00f3r\u00f0ard\u00f3ttir', false)).toBe('\u00cd\u00de');
+    expect(getInitials('\u{20000} [Team]', false)).toBe('\u{20000}');
+    expect(getInitials('\u6842\u82f1', false)).toBe('');
+    expect(getInitials('\uac15\ud604', false)).toBe('');
+    expect(getInitials('\u062e\u0633\u0631\u0648', true)).toBe('');
+    expect(getInitials('+1 (555) 123-4567 ext.4567', false)).toBe('');
+  });
+
+  it('derives initials from a public name containing unmatched brackets', () => {
+    // A Jest timeout alone cannot interrupt synchronous regex execution.
+    runInNewContext(
+      'renderAvatar()',
+      {
+        renderAvatar: () => {
+          const name = `Ada ${'['.repeat(128)} Lovelace`;
+          render(<Avatar name={name} />);
+          expect(screen.getByText('AL')).toBeTruthy();
+          expect(screen.getByRole('img').getAttribute('aria-label')).toBe(name);
+        },
+      },
+      { timeout: 1000 },
+    );
+  });
+
+  it('avoids superlinear growth when opening brackets have no closing enclosure', () => {
+    const samples: {
+      length: number;
+      squareMs: number;
+      parenthesisMs: number;
+      braceMs: number;
+      balancedMs: number;
+      nonBracketMs: number;
+      extendedNameMs: number;
+    }[] = [];
+    let ordinaryNameMs = 0;
+
+    const measureName = (name: string, expected: string): number => {
+      for (let warmup = 0; warmup < 2; warmup++) {
+        expect(getInitials(name, false)).toBe(expected);
+      }
+
+      const durations: number[] = [];
+      for (let sample = 0; sample < 5; sample++) {
+        let initials = '';
+        const start = performance.now();
+        for (let call = 0; call < 3; call++) {
+          initials = getInitials(name, false);
+        }
+        durations.push((performance.now() - start) / 3);
+        expect(initials).toBe(expected);
+      }
+      return durations.sort((a, b) => a - b)[2];
+    };
+
+    // These are experiment bounds, not an application name-length policy.
+    runInNewContext(
+      'measure()',
+      {
+        measure: () => {
+          ordinaryNameMs = measureName('Ada Lovelace', 'AL');
+          for (const length of [64, 128, 256, 512, 1024, 2048, 4096]) {
+            samples.push({
+              length,
+              squareMs: measureName('['.repeat(length), ''),
+              parenthesisMs: measureName('('.repeat(length), ''),
+              braceMs: measureName('{'.repeat(length), ''),
+              balancedMs: measureName('['.repeat(length / 2) + ']'.repeat(length / 2), ''),
+              nonBracketMs: measureName('A'.repeat(length), 'A'),
+              extendedNameMs: measureName('A'.repeat(length - 9) + ' Lovelace', 'AL'),
+            });
+          }
+        },
+      },
+      { timeout: 2500 },
+    );
+
+    console.info(
+      'Avatar enclosure measurements (milliseconds per call):',
+      JSON.stringify({ ordinaryNameMs, sampleCount: 5, callsPerSample: 3, maxNameLength: 4096, samples }),
+    );
+
+    const small = samples.find(sample => sample.length === 1024);
+    const large = samples.find(sample => sample.length === 4096);
+    if (!small || !large) {
+      throw new Error('The bounded scaling measurement did not produce both required input lengths.');
+    }
+
+    // Allow twice linear growth for a fourfold input increase, with a timer-noise floor.
+    expect(large.squareMs).toBeLessThanOrEqual(8 * Math.max(small.squareMs, 0.1));
+    expect(large.parenthesisMs).toBeLessThanOrEqual(8 * Math.max(small.parenthesisMs, 0.1));
+    expect(large.braceMs).toBeLessThanOrEqual(8 * Math.max(small.braceMs, 0.1));
+  });
+});
```

**File**: `packages/react-components/react-avatar/library/src/utils/getInitials.test.ts` (modified, +60/-0)
```diff
@@ -60,6 +60,66 @@ describe('getInitials', () => {
     expect(result).toEqual('DG');
   });
 
+  it.each([
+    ['(', ')'],
+    ['(', ']'],
+    ['(', '}'],
+    ['[', ')'],
+    ['[', ']'],
+    ['[', '}'],
+    ['{', ')'],
+    ['{', ']'],
+    ['{', '}'],
+  ])('ends an enclosure opened with %s at the first %s', (opening, closing) => {
+    const name = `${opening}Team ${opening}Inner${closing} Grace${closing} Hopper`;
+    expect(getInitials(name, false)).toBe('GH');
+    expect(getInitials(name, true)).toBe('HG');
+  });
+
+  it.each([
+    ['(Team)Ada[Role]Lovelace', 'A'],
+    ['Ada (Team) []{}(Role) Lovelace', 'AL'],
+    ['Ada (Team [Inner] Hopper)', 'AH'],
+    ['[Team {Inner) Grace] Hopper', 'GH'],
+    ['[Ada [Grace] Hopper', 'H'],
+    ['Ada (Grace [Hopper', 'AH'],
+    ['[Team] Ada [Grace Hopper', 'AH'],
+    ['Ada )Grace] Hopper}', 'AH'],
+    ['Ada [Team\n[Inner] Hopper]', 'AH'],
+    ['Ada [Team\u2028Role] Lovelace', 'AL'],
+    ['Ada [Grace\n', 'AG'],
+    [' \tAda\u00a0[Team]\u2003Lovelace \n', 'AL'],
+    ['[Team] \u{20000} \u{20001}', '\u{20000}\u{20001}'],
+    ['\ud800[Team]\udc00 Lovelace', '\u{10000}L'],
+    ['[Team] \u6842\u82f1', ''],
+    ['[Team] \uac15\ud604', ''],
+    ['[Team] \u062e\u0633\u0631\u0648', ''],
+  ])('preserves initials and direction after cleaning %s', (name, expected) => {
+    expect(getInitials(name, false)).toBe(expected);
+    expect(getInitials(name, true)).toBe([...expected].reverse().join(''));
+    expect(getInitials(name, false, { firstInitialOnly: true })).toBe([...expected][0] ?? '');
+    expect(getInitials(name, true, { firstInitialOnly: true })).toBe([...expected][0] ?? '');
+  });
+
+  it('matches the original enclosure semantics for all short delimiter combinations', () => {
+    const tokens = ['(', '[', '{', ')', ']', '}', 'A', 'B', ' '];
+    const compare = (name: string, remaining: number): void => {
+      // Bound the original regex to at most four characters, then remove leftover delimiters
+      // so the reference initials do not depend on the new enclosure implementation.
+      const cleanedName = name.replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '').replace(/[\(\)\[\]\{\}]/g, '');
+      expect(getInitials(name, false)).toBe(getInitials(cleanedName, false));
+      expect(getInitials(name, true)).toBe(getInitials(cleanedName, true));
+
+      if (remaining > 0) {
+        for (const token of tokens) {
+          compare(name + token, remaining - 1);
+        }
+      }
+    };
+
+    compare('', 4);
+  });
+
   it('calculates an expected initials in RTL if one was not specified', () => {
     const result = getInitials('Kat Larrson', true);
     expect(result).toEqual('LK');
```

**File**: `packages/react-components/react-avatar/library/src/utils/getInitials.ts` (modified, +3/-8)
```diff
@@ -1,12 +1,7 @@
 /**
- * Regular expressions matching characters to ignore when calculating the initials.
+ * Regular expression matching complete enclosures or an unmatched enclosure tail.
  */
-
-/**
- * Regular expression matching characters within various types of enclosures, including the enclosures themselves
- *  so for example, (xyz) [xyz] {xyz} all would be ignored
- */
-const UNWANTED_ENCLOSURES_REGEX: RegExp = /[\(\[\{][^\)\]\}]*[\)\]\}]/g;
+const UNWANTED_ENCLOSURES_REGEX: RegExp = /[\(\[\{][^\)\]\}]*([\)\]\}]|$)/g;
 
 /**
  * Regular expression matching special ASCII characters except space, plus some unicode special characters.
@@ -73,7 +68,7 @@ function getInitialsLatin(displayName: string, isRtl: boolean, firstInitialOnly?
 }
 
 function cleanupDisplayName(displayName: string): string {
-  displayName = displayName.replace(UNWANTED_ENCLOSURES_REGEX, '');
+  displayName = displayName.replace(UNWANTED_ENCLOSURES_REGEX, (match, closing: string) => (closing ? '' : match));
   displayName = displayName.replace(UNWANTED_CHARS_REGEX, '');
   displayName = displayName.replace(MULTIPLE_WHITESPACES_REGEX, ' ');
   displayName = displayName.trim();
```

#### Recent Merged Pull Requests:
- **PR #36835** (closed): fix(positioning): keep popups aligned during ancestor motion (@PaulGMardling)
- **PR #36831** (2026-10-05): fix(workspace-plugin): support .storybook/main.cjs in split-library-in-two and storybook target inference (@mainframev)
- **PR #36822** (2026-10-04): fix(react-swatch-picker): default ImageSwatch and EmptySwatch to type="button" (@mainframev)
- **PR #36821** (2026-10-05): fix(react-headless-components-preview): enter SwatchPicker on the selected swatch (@mainframev)
- **PR #36820** (2026-10-01): ci: invoke v8 site manifest generator directly (@Hotell)
- **PR #36818** (2026-10-01): fixed tooltip value cut off at the bottom in HorizontalBarChartWithAxis (@v-baambati)
- **PR #36816** (2026-10-01): chore: retire cxe-red and individual CODEOWNERS assignments (@tudorpopams)
- **PR #36810** (2026-10-02): fix(web-components): persist dropdown anchor name for tooltip positioning (@chrisdholt)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
