# Forensic Learning Record (Deep Inspection): pinterest/gestalt

> **Canonical Artifact**: `07_PROJECT_LEARNING/pinterest-gestalt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pinterest/gestalt](https://github.com/pinterest/gestalt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:10:37.776Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pinterest/gestalt`
- **Description**: A set of React UI components that supports Pinterest’s design language
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4377 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/gestalt-charts/src/ChartGraph/renderAxis.tsx`
```
import { Fragment } from 'react';
import { XAxis, YAxis } from 'recharts';
import {
  TOKEN_COLOR_TEXT_SUBTLE,
  TOKEN_FONT_FAMILY_DEFAULT_LATIN,
  TOKEN_FONT_SIZE_100,
  TOKEN_FONT_WEIGHT_NORMAL,
} from 'gestalt-design-tokens';

export default function renderAxis({
  isHorizontalLayout,
  isHorizontalBiaxialLayout,
  isVerticalLayout,
  isTimeSeries,
  isVerticalBiaxialLayout,
  range,
  tickFormatter,
  labelMap,
  tickCount,
}: {
  isHorizontalLayout: boolean;
  isHorizontalBiaxialLayout: boolean;
  isVerticalLayout: boolean;
  isVerticalBiaxialLayout: boolean;
  isTimeSeries: boolean;
  range:
    | [
        number | 'auto' | 'dataMin' | 'dataMax' | ((arg1: number) => number),
        number | 'auto' | 'dataMin' | 'dataMax' | ((arg1: number) => number),
      ]
    | {
        xAxisBottom?: [
          number | 'auto' | 'dataMin' | 'dataMax' | ((arg1: number) => number),
          number | 'auto' | 'dataMin' | 'dataMax' | ((arg1: number) => number),
        ];
        xAxisTop?: [
          number | 'auto' | 'dataMin' | 'dataMax' | ((arg1: number) => number),
          number | 'auto' | 'dataMin' | 'dataMax' | ((arg1: number) => number),
        ];
        yAxisLeft?: [
          number | 'auto' | 'dataMin' | 'dataMax' | ((arg1: number) => number),
          number | 'auto' | 'dataMin' | 'dataMax' | ((arg1: number) => number),
        ];
        yAxisRight?: [
          number | 'auto' | 'dataMin' | 'dataMax' | ((arg1: number) => number),
          number | 'auto' | 'dataMin' | 'dataMax' | ((arg1: number) => number),
        ];
      };
  tickFormatter?: {
    timeseries?: (arg1: number) => string | number;
    xAxisTop?: (arg1: number, arg2: number) => string | number;
    xAxisBottom?: (arg1: number, arg2: number) => string | number;
    yAxisRight?: (arg1: number, arg2: number) => string | number;
    yAxisLeft?: (arg1: number, arg2: number) => string | number;
  };
  labelMap?: {
    [key: string]: string;
  };
  tickCount: 5 | 3;
}) {
  const FONT_STYLE_CATEGORIES = {
    fontSize: TOKEN_FONT_SIZE_100,
    fontFamily: TOKEN_FONT_FAMILY_DEFAULT_LATIN,
    fontWeight: TOKEN_FONT_WEIGHT_NORMAL,
  } as const;

  const FONT_STYLE_VALUES = {
    color: TOKEN_COLOR_TEXT_SUBTLE,
    fontSize: TOKEN_FONT_SIZE_100,
    fontFamily: TOKEN_FONT_FAMILY_DEFAULT_LATIN,
    fontWeight: TOKEN_FONT_WEIGHT_NORMAL,
  } as const;

  const isRtl = typeof document === 'undefined' ? false : document?.dir === 'rtl';

  return (
    <Fragment>
      {isHorizontalLayout && (
        <Fragment>
          {/* @ts-expect-error - TS2769 - No overload matches this call. */}
          <XAxis
            axisLine={false}
            dataKey="name"
            domain={isTimeSeries ? !Array.isArray(range) && range?.xAxisBottom : undefined}
            interval={0}
            orientation="bottom"
            reversed={isRtl}
            scale={isTimeSeries ? 'time' : undefined}
            style={FONT_STYLE_CATEGORIES}
            tickFormatter={
              isTimeSeries
                ? tickFormatter?.xAxisBottom || tickFormatter?.timeseries
                : (value: string) => labelMap?.[value] || value
            }
            tickLine={false}
            type={isTimeSeries ? 'number' : 'category'}
            // DO NOT SET xAxisId here (it breaks the component, opaque behavior from Recharts)
          />
          {/* @ts-expect-error - TS2769 - No overload matches this call. */}
          <YAxis
            axisLine={false}
            domain={Array.isArray(range) ? range : range?.yAxisLeft}
            orientation={isRtl ? 'right' : 'left'}
            style={FONT_STYLE_VALUES}
            tickCount={tickCount}
            tickFormatter={tickFormatter?.yAxisLeft}
            tickLine={false}
            yAxisId="left"
          />
        </Fragment>
      )}
      {isHorizontalBiaxialLayout && (
        // @ts-expect-error - TS2769 - No overload matches this call.
        <YAxis
          axisLine={false}
          domain={Array.isArray(range) ? range : range?.yAxisLeft}
          orientation={isRtl ? 'left' : 'right'}
          style={FONT_STYLE_VALUES}
          tickCount={tickCount}
          tickFormatter={tickFormatter?.yAxisRight}
          tickLine={false}
          yAxisId="right"
        />
      )}
      {isVerticalLayout && (
        <Fragment>
          {/* @ts-expect-error - TS2769 - No overload matches this call. */}
          <XAxis
            axisLine={false}
            domain={range}
            orientation="bottom"
            reversed={isRtl}
            style={FONT_STYLE_VALUES}
            tickCount={tickCount}
            tickFormatter={tickFormatter?.xAxisBottom}
            tickLine={false}
            type="number"
            xAxisId="bottom"
          />
          <YAxis
            axisLine={false}
            dataKey="name"
            orientation={isRtl ? 'right' : 'left'}
            // @ts-expect-error - TS2322
            style={FONT_STYLE_CATEGORIES}
            tickFormatter={(value: string) => labelMap?.[value] || value}
            tickLine={false}
            type="category"
            // DO NOT SET yAxisId here
          />
        </Fragment>
      )}
      {isVerticalBiaxialLayout && (
        // @ts-expect-error - TS2769 - No overload matches this call.
        <XAxis
          axisLine={false}
          domain={range}
          orientation="top"
          reversed={isRtl}
          style={FONT_STYLE_VALUES}
          tickCount={tickCount}
          tickFormatter={tickFormatter?.xAxisTop}
          tickLine={false}
          type="number"
          xAxisId="top"
        />
      )}
    </Fragment>
  );
}

```

### Core Architecture Module: `packages/gestalt-charts/src/ChartGraph/renderElements.tsx`
```
import { ReactNode } from 'react';
import { Bar as RechartsBar, LabelList, Line as RechartsLine, Rectangle } from 'recharts';
import BarLabel from './BarLabel';
import renderGraphPoint from './renderGraphPoint';
import { DataVisualizationColors } from './types';

const colorMap = {
  '0': '01',
  '1': '02',
  '2': '03',
  '3': '04',
  '4': '05',
  '5': '06',
  '6': '07',
  '7': '08',
  '8': '09',
  '9': '10',
  '10': '11',
  '11': '12',
} as const;

type Props = {
  stacked: boolean | null | undefined;
  elements: ReadonlyArray<{
    type: 'line' | 'bar';
    axis?: 'left' | 'right' | 'bottom' | 'top';
    id: string;
    color?:
      | '01'
      | '02'
      | '03'
      | '04'
      | '05'
      | '06'
      | '07'
      | '08'
      | '09'
      | '10'
      | '11'
      | '12'
      | 'neutral';
    precision?: 'exact' | 'estimate';
  }>;
  layout: 'horizontal' | 'vertical' | 'horizontalBiaxial' | 'verticalBiaxial';
  hexColor: (arg1: DataVisualizationColors) => string;
  visualPatternSelected: 'visualPattern' | 'default' | 'disabled';
  isHorizontalLayout: boolean;
  isBarRounded: boolean;
  isDarkMode: boolean;
  renderLabel?:
    | 'auto'
    | 'none'
    | ((arg1: {
        x: number;
        y: number;
        value: string;
        width: number;
        height: number;
        name: string;
        index: number;
      }) => ReactNode);
};

export default function renderElements({
  elements = [],
  layout,
  stacked,
  hexColor,
  visualPatternSelected,
  isHorizontalLayout,
  isBarRounded,
  isDarkMode,
  renderLabel,
}: Props): ReadonlyArray<ReactNode> {
  const { length } = elements;
  const lastElementPos = length > 1 ? length - 1 : 1;
  const squaredRadius: [number, number, number, number] = [0, 0, 0, 0];
  const roundedRadius: [number, number, number, number] = ['vertical', 'verticalBiaxial'].includes(
    layout,
  )
    ? [0, 4, 4, 0]
    : [4, 4, 0, 0];

  return elements.map((values, idx) => {
    // @ts-expect-error - TS7053
    const defaultColor = colorMap[idx];
    const isBarElement = values.type === 'bar';
    const isLineElement = values.type === 'line';

    const opacityValue = isDarkMode ? 0.6 : 0.4;

    const renderCustomizedLabel = ({
      x,
      y,
      width,
      value,
      height,
      name,
      index,
    }: {
      x: number;
      y: number;
      value: string;
      width: number;
      height: number;
      name: string;
      index: number;
    }) =>
      renderLabel !== 'none' &&
      renderLabel !== 'auto' &&
      renderLabel?.({ x, y, width, value, height, name, index });

    const renderDefaultLabel = (props: {
      x: number;
      y: number;
      value: string;
      width: number;
      height: number;
    }) => (
      <BarLabel
        height={props.height}
        layout={isHorizontalLayout ? 'vertical' : 'horizontal'}
        value={props.value}
        width={props.width}
        x={props.x}
        y={props.y}
      />
    );

    // Recharts doesn't recognize wrappers on their components, therefore, needs to be build within ChartGraph
    if (isBarElement) {
      return (
        <RechartsBar
          key={values.id}
          barSize="50%"
          dataKey={values.id}
          fill={
            visualPatternSelected === 'visualPattern'
              ? `url(#pattern-${values.color || defaultColor})`
              : hexColor(values.color || defaultColor)
          }
          isAnimationActive={false}
          // @ts-expect-error - TS2769 - No overload matches this call.
          // eslint-disable-next-line react/no-unstable-nested-components
          shape={({ height, ...props }) => (
            <Rectangle
              {...props}
              height={stacked && idx !== 0 && height > 0 ? height - 2 : height}
              opacity={props.payload.opacity === 0.4 ? opacityValue : undefined}
              radius={
                (lastElementPos !== idx && stacked) || !isBarRounded ? squaredRadius : roundedRadius
              }
            />
          )}
          stackId={stacked ? 'stacked' : undefined}
          {...(isHorizontalLayout
            ? { yAxisId: values.axis || 'left' }
            : { xAxisId: values.axis || 'bottom' })}
          stroke={hexColor(values.color || defaultColor)}
        >
          {renderLabel === 'none' ? undefined : (
            <LabelList
              // @ts-expect-error - TS2769
              content={renderLabel === 'auto' ? renderDefaultLabel : renderCustomizedLabel}
              dataKey={values.id}
              position={isHorizontalLayout ? 'top' : 'right'}
            />
          )}
        </RechartsBar>
      );
    }

    // Recharts doesn't recognize wrappers on their components, therefore, needs to be build within ChartGraph
    if (isLineElement) {
      let strokeDasharray: string | number;

      if (visualPatternSelected === 'visualPattern' && values.precision !== 'estimate') {
        strokeDasharray = 0; // '0' is necessary to communicate in the payload
      }
      if (values.precision === 'estimate') {
        strokeDasharray = '8 8';
      }

      const graphPoint = renderGraphPoint({
        color: values.color || defaultColor,
        active: false,
      });

      return (
        <RechartsLine
          key={values.id}
          activeDot={false}
          dataKey={values.id}
          // @ts-expect-error - TS2769
          dot={visualPatternSelected === 'visualPattern' ? graphPoint : false}
          isAnimationActive={false}
          legendType="line"
          stroke={hexColor(values.color || defaultColor)}
          // @ts-expect-error - TS2454
          strokeDasharray={strokeDasharray}
          strokeWidth={values.precision === 'estimate' ? 2 : 3}
          type={values.precision === 'estimate' ? 'monotone' : undefined}
          {...(isHorizontalLayout
            ? { yAxisId: values.axis || 'left' }
            : { xAxisId: values.axis || 'bottom' })}
        />
      );
    }

    return null;
  });
}

```

### Core Architecture Module: `packages/gestalt-charts/src/ChartGraph/renderGraphPoint.tsx`
```
import { ReactNode } from 'react';
import { TOKEN_COLOR_WHITE_MOCHIMALIST_0 } from 'gestalt-design-tokens';
import { DataVisualizationColors } from './types';
import { useHexColor } from './usePatterns';

type Props = {
  noReposition?: boolean;
  color: DataVisualizationColors;
  cx: number;
  cy: number;
};

export function GraphPoint({ color, cx, cy, noReposition = false }: Props) {
  const hexColor = useHexColor();

  const decalDotCoordCorrection = {
    'neutral': { coordinate: [4, 4] },
    '01': { coordinate: [4, 4] },
    '02': { coordinate: [0, 4], fill: 'empty' },
    '03': { coordinate: [4, 4] },
    '04': { coordinate: [5.5, 5.5], fill: 'empty', stroke: 'bold' },
    '05': { coordinate: [0, 4.5] },
    '06': { coordinate: [4, 4], fill: 'empty' },
    '07': { coordinate: [0, 4] },
    '08': { coordinate: [5.5, 5.5], fill: 'empty', stroke: 'bold' },
    '09': { coordinate: [5.5, 5.5] },
    '10': { coordinate: [0, 4.5], fill: 'empty' },
    '11': { coordinate: [5.5, 5.5] },
    '12': { coordinate: [4, 4], fill: 'empty' },
  } as const;

  const cxCorrection = noReposition ? 0 : decalDotCoordCorrection[color].coordinate[0];
  const cyCorrection = noReposition ? 0 : decalDotCoordCorrection[color].coordinate[1];

  return cy === null ? null : (
    <use
      fill={
        // @ts-expect-error - TS2339
        decalDotCoordCorrection[color].fill === 'empty'
          ? TOKEN_COLOR_WHITE_MOCHIMALIST_0
          : hexColor(color)
      }
      href={`#points-${color}`}
      stroke={hexColor(color)}
      // @ts-expect-error - TS2339
      strokeWidth={decalDotCoordCorrection[color].stroke === 'bold' ? '6' : '1.5'}
      x={cx - cxCorrection}
      y={cy - cyCorrection}
    />
  );
}

const renderGraphPoint: (options: {
  color: DataVisualizationColors;
  active: boolean;
}) => (props: { cx: number; cy: number }) => ReactNode = (options) => {
  function RenderPoint({ cx, cy }: { cx: number; cy: number }) {
    return <GraphPoint key={options.color + cy + cx} color={options.color} cx={cx} cy={cy} />;
  }

  return RenderPoint;
};

export default renderGraphPoint;

```

### Core Architecture Module: `packages/gestalt-charts/src/ChartGraph/renderReferenceAreas.tsx`
```
import { ReactNode } from 'react';
import { Rectangle, ReferenceArea as RechartsReferenceArea } from 'recharts';

export default function renderReferenceAreas({
  referenceAreas,
}: {
  referenceAreas: ReadonlyArray<{
    id: string;
    label: string;
    x1: string | number;
    x2: string | number;
    y1: string | number;
    y2: string | number;
    yAxisId: string;
    style?: 'default';
  }>;
}): ReadonlyArray<ReactNode> {
  return referenceAreas.map((values) => (
    // Recharts doesn't recognize wrappers on their components, therefore, needs to be build within ChartGraph
    <RechartsReferenceArea
      key={values.id}
      isFront
      shape={(props) => <Rectangle {...props} fill="url(#pattern-referencearea-01)" />}
      strokeOpacity={0.3}
      x1={values.x1}
      x2={values.x2}
      y1={values.y1}
      y2={values.y2}
      yAxisId={values.yAxisId}
    />
  ));
}

```

### Core Architecture Module: `packages/gestalt-codemods/generic-codemods/utils.ts`
```
import { NodePath } from 'ast-types/lib/node-path';
import { API, ASTPath, Collection, FileInfo, JSCodeshift } from 'jscodeshift/src/core';

/**
 *
 * IMPORTANT
 *
 * BEFORE YOU START DEVELOPING CODEMODS READ THE FOLLOWING DOCUMENTATION
 *
 * packages/gestalt-codemods/generic-codemods/README.md
 *
 */

/**
 * initialize: Sets the boilerplate required to work with jscodeshift.
 j: the jscodeshift library API access
 src: a collection of one node-path, which wraps the root AST node
 */
const initialize = ({
  api,
  fileInfo,
}: {
  api: API;
  fileInfo: FileInfo;
}): { j: JSCodeshift; src: Collection & { modified?: boolean } } => {
  const j = api.jscodeshift;
  const src = j(fileInfo.source);
  return { j, src };
};

/**
 * isNullOrUndefined: Checks for values that are undefined or null
 */
const isNullOrUndefined = (value?: string | boolean | number): boolean =>
  value === undefined || value === null;

/**
 * getComponentIdentifierByName: Returns a collection containing the component specifier from the Gestalt import declaration collection that matches the componentName value
 */
const getComponentIdentifierByName = ({
  j,
  gestaltImportCollection,
  componentName,
}: {
  j: JSCodeshift;
  gestaltImportCollection: Collection;
  componentName: string;
}): Collection =>
  gestaltImportCollection.find(j.ImportSpecifier, {
    imported: {
      type: 'Identifier',
      name: componentName,
    },
  });

/**
 * getGestaltImport: Returns a collection containing the Gestalt import declaration node-path
 */
const getGestaltImport = ({ src, j }: { src: Collection; j: JSCodeshift }): Collection =>
  src.find(j.ImportDeclaration, {
    source: {
      value: (value: string) => value.includes('gestalt'),
    },
  });

/**
 * getLocalImportedName: Returns the local named import for a Gestalt component
 * E.g. import { Box } from 'gestalt // Box
 * E.g. import { Box as RenamedBox } from 'gestalt // RenamedBox
 */
const getLocalImportedName = ({
  importSpecifierCollection,
}: {
  importSpecifierCollection: Collection;
}): string => importSpecifierCollection.get(0).node.local?.name;

/**
 * filterJSXByTargetLocalName: Returns a collection containing the Gestalt JSX component matching the targetLocalName value
 */
const filterJSXByTargetLocalName = ({
  src,
  j,
  targetLocalName,
  subcomponent,
}: {
  src: Collection;
  j: JSCodeshift;
  targetLocalName: string;
  subcomponent?: string | null;
}): Collection =>
  subcomponent
    ? src.find(j.JSXElement, {
        openingElement: {
          name: {
            object: { name: targetLocalName },
            property: { name: subcomponent },
          },
        },
      })
    : src.find(j.JSXElement, {
        openingElement: { name: { name: targetLocalName } },
      });

/**
 * checkComponentName: Checks if the name of the opening element of the parent node of the attribute node, which is the JSX element itself matches the componenent and subcomponent names.
 */
const checkComponentName = ({
  nodepath,
  componentName,
  subcomponentName,
}: {
  nodepath: NodePath;
  componentName: string;
  subcomponentName?: string;
}) =>
  subcomponentName
    ? nodepath.parentPath.parentPath.value.name?.object?.name === componentName &&
      nodepath.parentPath.parentPath.value.name?.property?.name === subcomponentName
    : nodepath.parentPath.parentPath.value.name?.name === componentName;

const getNumericString = (value: string) => {
  let newValue = value;

  if (value.startsWith('_')) {
    newValue = value.replace('_', '');
  }

  return newValue;
};

/**
 * filterJSXByAttribute: Returns a collection containing the Gestalt JSX components with matching prop/value attributes
 */
const filterJSXByAttribute = ({
  j,
  jSXCollection,
  componentName,
  subcomponentName,
  prop,
  value,
}: {
  j: JSCodeshift;
  jSXCollection: Collection;
  componentName: string;
  subcomponentName?: string;
  prop: string;
  value?: string | number | boolean;
}): Collection => {
  if (typeof value === 'string') {
    const newValue = getNumericString(value);

    return jSXCollection
      .find(j.JSXAttribute, { name: { name: prop }, value: { value: newValue } })
      .filter((nodepath) => checkComponentName({ nodepath, componentName, subcomponentName }));
  }

  if (typeof value === 'number') {
    return jSXCollection
      .find(j.JSXAttribute, {
        value: {
          type: 'JSXExpressionContainer',
          expression: {
            type: 'NumericLiteral',
            value,
          },
        },
      })
      .filter((nodepath) => checkComponentName({ nodepath, componentName, subcomponentName }));
  }

  if (typeof value === 'boolean') {
    return value
      ? jSXCollection
          .find(j.JSXAttribute, {
            value: null,
          })
          .filter((nodepath) => checkComponentName({ nodepath, componentName, subcomponentName }))
      : jSXCollection
          .find(j.JSXAttribute, {
            name: { name: prop },
            value: {
              type: 'JSXExpressionContainer',
              expression: {
                type: 'BooleanLiteral',
                value,
              },
            },
          })
          .filter((nodepath) => checkComponentName({ nodepath, componentName, subcomponentName }));
  }

  if (!value)
    return jSXCollection
      .find(j.JSXAttribute, { name: { name: prop } })
      .filter((nodepath) => checkComponentName({ nodepath, componentName, subcomponentName }));

  return jSXCollection;
};

/**
 * buildAttributeFromValue: Returns a collection containing the Gestalt import declaration node-path
 */
const buildAttributeFromValue = ({
  j,
  prop,
  value,
}: {
  j: JSCodeshift;
  prop: string;
  value?: string | boolean | number;
}) => {
  switch (typeof value) {
    case 'string':
      return j.jsxAttribute(j.jsxIdentifier(prop), j.stringLiteral(getNumericString(value)));
    case 'number':
      return j.jsxAttribute(
        j.jsxIdentifier(prop),
        j.jsxExpressionContainer(j.numericLiteral(value)),
      );
    case 'boolean':
      return value
        ? j.jsxAttribute(j.jsxIdentifier(prop))
        : j.jsxAttribute(j.jsxIdentifier(prop), j.jsxExpressionContainer(j.booleanLiteral(value)));
    default:
      return null;
  }
};

/**
 * buildReplaceWithRenamedComponent: Returns a collection containing the Gestalt import declaration node-path
 */
const buildReplaceWithRenamedComponent =
  ({
    nextComponentName,
  }: {
    nextComponentName: string;
  }): ((nodepath: ASTPath, i: number) => Collection) =>
  (nodepath: ASTPath) => {
    const { node } = nodepath.get();
    node.openingElement.name.name = nextComponentName;
    if (!node.openingElement.selfClosing) {
      node.closingElement.name.name = nextComponentName;
    }
    return node;
  };

/**
 * buildReplaceWithRenamedImport: Returns a callback for collection.replaceWith() that renames imported components
 */
const buildReplaceWithRenamedImport =
  ({ j, nextComponentName }: { j: JSCodeshift; nextComponentName: string }) =>
  () =>
    j.importSpecifier(j.identifier(nextComponentName));

/**
 * buildReplaceWithModifiedAttributes: Returns a collection containing the Gestalt import declaration node-path
 */
const buildReplaceWithModifiedAttributes = ({
  j,
  previousProp,
  nextProp,
  nextValue,
}: {
  j: JSCodeshift;
  previousProp: string;
  nextProp?: string;
  nextValue?: string;
}) => {
  const replaceWithModifiedAttributes = (nodepath: Collection) => {
    // In the absence of nextProp & nextValue, we REMOVE prop and values
    if (!nextProp && isNullOrUndefined(nextValue)) return null;
    let { node } = nodepath.get();

    // In the absence of just nextValue, we rename the prop if both prop and value match.
    if (nextProp && isNullOrUndefined(nextValue)) node.name.name = nextProp;

    // In the presence of just nextProp, we change the value if there's a match.
    if (!nextProp && !isNullOrUndefined(nextValue)) {
      node = buildAttributeFromValue({
        j,
        prop: previousProp,
        value: nextValue,
      });
    }

    // In the presence of both nextProp and nextValue, we change both nextProp and nextValue if there's a match.
    if (nextProp && !isNullOrUndefined(nextValue)) {
      node = buildAttributeFromValue({
        j,
        prop: nextProp,
        value: nextValue,
      });
    }

    return node;
  };

  return replaceWithModifiedAttributes;
};

/**
 * throwErrorIfSpreadProps: Throws an error message if component contains spread props which are opaque to codemods
 * E.g. <Box {...props} /> // error!
 */
const throwErrorIfSpreadProps = ({
  fileInfo,
  j,
  jSXCollection,
  componentName,
  subcomponentName,
}: {
  fileInfo: FileInfo;
  j: JSCodeshift;
  jSXCollection: Collection;
  componentName: string;
  subcomponentName?: string;
}): void => {
  const spreadPropsCollection = jSXCollection
    .find(j.JSXSpreadAttribute)
    .filter((nodepath) => checkComponentName({ nodepath, componentName, subcomponentName }));
  if (spreadPropsCollection.size() > 0) {
    throw new Error(
      `Remove dynamic properties and rerun codemod.\n${spreadPropsCollection
        .nodes()
        .map((node) => `Location: ${fileInfo.path} @line: ${node.loc?.start.line}`)
        .join('\n')}`,
    );
  }
};

/**
 * throwErrorMessageWithNodesData: Throws an error message if collection isn't empty
 */
const throwErrorMessageWithNodesData = ({
  fileInfo,
  jSXCollection,
}: {
  fileInfo: FileInfo;
  jSXCollection: Collection;
}): void => {
  if (jSXCollection.size() > 0) {
    throw new Error(
      `This file requires manual attention. Follow the PR's instructions in the following code locations\n${jSXCollection
        .nodes()
        .map((node) => `Location: ${fileInfo.path} @line: ${node.loc.start.line}`)
        .join('\n')}`,
    );
  }
};

/**
 * saveToSource: Saves the changes in the file  if the src object contains the 'modified: true' key-value
 */
const saveToSource = ({ src }: { src: Collection & { modified?: bool
```

### Core Architecture Module: `packages/gestalt-design-tokens/src/utils/getFilter.js`
```
const {
  filterColor,
  filterRounding,
  filterOpacity,
  filterSpace,
  filterElevation,
  filterLineHeight,
  filterFontFamily,
  filterFontSize,
  filterFontWeight,
  filterMotionDuration,
  filterMotionEasing,
} = require('../filters');

const filterList = [
  filterColor,
  filterRounding,
  filterOpacity,
  filterSpace,
  filterElevation,
  filterLineHeight,
  filterFontFamily,
  filterFontSize,
  filterFontWeight,
  filterMotionDuration,
  filterMotionEasing,
];

const getFilter = (category, type) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const item of filterList) {
    // eslint-disable-next-line no-underscore-dangle
    if (item._filter_comment === 'Custom') {
      if (
        typeof item.filter === 'string' &&
        item.filter.toLowerCase() === `filter${category}${type}`
      ) {
        return item;
      }

      // eslint-disable-next-line no-continue
      continue;
    }

    if (type === undefined) {
      if (item.filter.attributes.category === category) {
        return item;
      }
    } else if (
      item.filter.attributes.category === category &&
      item.filter.attributes.type === type
    ) {
      return item;
    }
  }
  return undefined;
};

module.exports = { getFilter };

```

### Core Architecture Module: `packages/gestalt-design-tokens/src/utils/hexToRgba.js`
```
const tinycolor = require('tinycolor2');

/**
 * FROM:
 * https://github.com/tokens-studio/sd-transforms/blob/ae759783c7f92be6572c29f4f3270459ce7d93d0/src/css/transformHEXRGBa.ts#L9
 *
 * Helper: Transforms hex rgba colors used in figma tokens:
 * rgba(#ffffff, 0.5) =? rgba(255, 255, 255, 0.5).
 * This is kind of like an alpha() function.
 */
function transformHEXRGBaForCSS(token) {
  const val = token.$value ?? token.value;
  const type = token.$type ?? token.type;
  if (val === undefined) return undefined;

  const transformHEXRGBa = (tokVal) => {
    const regex = /rgba\(\s*(?<hex>#.+?)\s*,\s*(?<alpha>\d*(\.\d*|%)*)\s*\)/g;
    return tokVal.replace(regex, (match, hex, alpha) => {
      try {
        const { r, g, b } = tinycolor(hex).toRgb();
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`Tried parsing "${hex}" as a hex value, but failed.`);
        return match;
      }
    });
  };

  const transformProp = (tokVal, prop) => {
    if (tokVal[prop] !== undefined) {
      // eslint-disable-next-line no-param-reassign
      tokVal[prop] = transformHEXRGBa(val[prop]);
    }
    return val;
  };

  let transformed = val;

  switch (type) {
    case 'border':
    case 'shadow': {
      if (Array.isArray(transformed)) {
        transformed = transformed.map((item) => transformProp(item, 'color'));
      } else {
        transformed = transformProp(transformed, 'color');
      }
      break;
    }
    default:
      transformed = transformHEXRGBa(val);
  }

  return transformed;
}

module.exports = { transformHEXRGBaForCSS };

```

### Core Architecture Module: `packages/gestalt/src/Masonry/dynamicHeightsUtils.ts`
```
/**
 * Util functions used to update positions when an item changes the height dynamically
 */
import { Cache } from './Cache';
import { Position } from './types';

function isBelowArea(area: { left: number; right: number }, position: Position) {
  return position.left < area.right && position.left + position.width > area.left;
}

function recalcHeights<T>({
  items,
  changedItem,
  newHeight,
  positionStore,
  measurementStore,
}: {
  items: ReadonlyArray<T>;
  changedItem: T;
  newHeight: number;
  positionStore: Cache<T, Position>;
  measurementStore: Cache<T, number>;
}): boolean {
  const changedItemPosition = positionStore.get(changedItem);

  if (
    !changedItemPosition ||
    newHeight === 0 ||
    Math.floor(changedItemPosition.height) === Math.floor(newHeight)
  ) {
    return false;
  }

  const { top, left, width, height } = changedItemPosition;
  const heightDelta = newHeight - height;

  items
    .map((item) => {
      const position = positionStore.get(item);
      return position && position.top >= changedItemPosition.top + changedItemPosition.height
        ? { item, position }
        : undefined;
    })
    .filter((itemPosition) => !!itemPosition)
    .sort((a, b) => a.position.top - b.position.top)
    .reduce(
      (area, { item, position }) => {
        if (isBelowArea(area, position)) {
          positionStore.set(item, { ...position, top: position.top + heightDelta });
          return {
            left: Math.min(area.left, position.left),
            right: Math.max(area.right, position.left + position.width),
          };
        }
        return area;
      },
      { left, right: left + width } as { left: number; right: number },
    );

  measurementStore.set(changedItem, newHeight);
  positionStore.set(changedItem, { top, left, width, height: newHeight });

  return true;
}

export default recalcHeights;

```

### Core Architecture Module: `packages/gestalt/src/Masonry/dynamicHeightsV2Utils.ts`
```
/**
 * Util functions used to update positions when an item changes the height dynamically
 */
import { Cache } from './Cache';
import { Position } from './types';
import Masonry from '../Masonry';

function isBelowArea(area: { left: number; right: number }, position: Position) {
  return position.left < area.right && position.left + position.width > area.left;
}

/*
 * getColumnWidth
 * This is a naive form of knowing the width of a column, so we can use it to know and item is
 * multicolumn (has a bigger width than columnWidth). We can't use columnWidth prop because
 * of flexible layouts (and that's an optional param)-
 * TODO: We could standardize this by using _getColumnSpan, as in multicolumn modules
 */
function getColumnWidth<T>(items: ReadonlyArray<T>, positionStore: Cache<T, Position>): number {
  let columnWidth = Infinity;
  items.forEach((item) => {
    const position = positionStore.get(item);
    if (position) {
      columnWidth = Math.min(columnWidth, position.width);
    }
  });
  return columnWidth;
}

function getDelta(
  deltasStack: Array<{
    left: number;
    right: number;
    delta: number;
  }>,
  position: Position,
): number {
  for (let i = deltasStack.length - 1; i >= 0; i -= 1) {
    const { left, right, delta } = deltasStack[i]!;
    if (isBelowArea({ left, right }, position)) {
      return delta;
    }
  }

  return 0;
}

function getNewDelta<T>({
  multicolumCurrentPosition,
  allPreviousItems,
  gutter,
}: {
  multicolumCurrentPosition: Position;
  allPreviousItems: ReadonlyArray<{ item: T; position: Position }>;
  gutter: number;
}): number {
  let closestItem: { item: T; position: Position };
  allPreviousItems.forEach(({ item, position }) => {
    const multiColumnLeftLimit = multicolumCurrentPosition.left;
    const multiColumnRightLimit = multicolumCurrentPosition.left + multicolumCurrentPosition.width;
    const currentItemLeftLimit = position.left;
    const currentItemRightLimit = position.left + position.width;
    const itemIsAboveMulticolumn =
      (multiColumnLeftLimit <= currentItemLeftLimit &&
        multiColumnRightLimit > currentItemLeftLimit) ||
      (multiColumnLeftLimit < currentItemRightLimit &&
        multiColumnRightLimit >= currentItemRightLimit);

    if (itemIsAboveMulticolumn) {
      if (
        (closestItem &&
          position.top + position.height >
            closestItem!.position.top + closestItem!.position.height) ||
        !closestItem
      ) {
        closestItem = { item, position };
      }
    }

    return itemIsAboveMulticolumn;
  });
  const actualDelta =
    closestItem!.position.top +
    closestItem!.position.height -
    multicolumCurrentPosition.top +
    gutter;
  return actualDelta;
}

function recalcHeights<T>({
  items,
  changedItem,
  newHeight,
  positionStore,
  measurementStore,
  gutter,
}: {
  items: ReadonlyArray<T>;
  changedItem: T;
  newHeight: number;
  positionStore: Cache<T, Position>;
  measurementStore: Cache<T, number>;
  gutter: number;
}): boolean {
  const changedItemPosition = positionStore.get(changedItem);
  const positionStoreOriginal: Cache<T, Position> = Masonry.createMeasurementStore();
  items.forEach((item) => {
    const position = positionStore.get(item);
    positionStoreOriginal.set(item, { ...position } as Position);
  });

  if (
    !changedItemPosition ||
    newHeight === 0 ||
    Math.floor(changedItemPosition.height) === Math.floor(newHeight)
  ) {
    return false;
  }

  const { top, left, width, height } = changedItemPosition;
  const oneColumnWidth = getColumnWidth(items.slice(0, 10), positionStore); // We don't need much items to know the column width

  // We use a stack in case we found multicolumn items that changes the deltas for their columns below
  const deltasStack = [
    {
      left,
      right: left + width,
      delta: newHeight - height,
    },
  ];

  const itemsFilteredAndSorted = items
    .map((item) => {
      const position = positionStore.get(item);
      return position && position.top >= changedItemPosition.top + changedItemPosition.height
        ? { item, position }
        : undefined;
    })
    .filter((itemPosition) => !!itemPosition)
    .sort((a, b) => a.position.top - b.position.top);

  measurementStore.set(changedItem, newHeight);
  positionStore.set(changedItem, { top, left, width, height: newHeight });

  itemsFilteredAndSorted.reduce(
    (area, { item, position }) => {
      if (isBelowArea(area, position)) {
        const itemIsMulticolumn = position.width > oneColumnWidth;
        if (itemIsMulticolumn) {
          // If it's a multicolumn module, we don't always use the same delta, because items above
          // can limit the movement of the multicolumn module. We need to find the correct delta.
          const multicolumCurrentPosition = position;

          // Check all items above to check if movement is necessary
          const allPreviousItems = items
            .map((i) => {
              const originalPosition = positionStoreOriginal.get(i);
              const newPosition = positionStore.get(i);
              return originalPosition &&
                newPosition &&
                originalPosition.top < multicolumCurrentPosition.top
                ? { item: i, position: newPosition }
                : undefined;
            })
            .filter((itemPosition) => !!itemPosition)
            .sort((a, b) => a.position.top - b.position.top);

          const newDelta = getNewDelta({
            multicolumCurrentPosition,
            allPreviousItems,
            gutter,
          });
          deltasStack.push({
            left: position.left,
            right: position.left + position.width,
            delta: newDelta,
          });
        }

        const currentDelta = getDelta(deltasStack, position);
        positionStore.set(item, { ...position, top: position.top + currentDelta });
        return {
          left: Math.min(area.left, position.left),
          right: Math.max(area.right, position.left + position.width),
        };
      }
      return area;
    },
    { left, right: left + width } as { left: number; right: number },
  );

  return true;
}

export default recalcHeights;

```

### Core Architecture Module: `packages/gestalt/src/Masonry/scrollUtils.ts`
```
/**
 * Measuring scroll positions, element heights, etc is different between
 * different browsers and the window object vs other DOM nodes. These
 * utils abstract away these differences.
 */

export function getElementHeight(element: HTMLElement | Window): number {
  return element instanceof Window ? window.innerHeight : element.clientHeight;
}

export function getWindowScrollPos(): number {
  if (window.scrollY !== undefined) {
    // Modern browser
    return window.scrollY;
  }
  if (document.documentElement && document.documentElement.scrollTop !== undefined) {
    // IE support.
    return document.documentElement.scrollTop;
  }
  return 0;
}

export function getRelativeScrollTop(element: HTMLElement | Window): number {
  return element === window || element instanceof Window
    ? getWindowScrollPos()
    : element.scrollTop - element.getBoundingClientRect().top;
}

export function getScrollHeight(element: HTMLElement): number {
  // @ts-expect-error - TS2367 - This condition will always return 'false' since the types 'HTMLElement' and 'Window & typeof globalThis' have no overlap.
  return element === window && document.documentElement
    ? document.documentElement.scrollHeight
    : element.scrollHeight;
}

export function getScrollPos(element: HTMLElement | Window): number {
  return element === window || element instanceof Window ? getWindowScrollPos() : element.scrollTop;
}

```

### Core Architecture Module: `packages/gestalt/src/SideNavigation/navigationChildrenUtils.tsx`
```
import { ReactNode } from 'react';
import classnames from 'classnames';
import ItemsEllipsis, { Props as EllipsisProps } from './ItemsEllipsis';
import styles from '../SideNavigation.css';
import flattenChildren, { ReactChildArray } from '../utils/flattenChildren';

export const ALLOWED_CHILDREN_MAP = {
  main: ['SideNavigation.Section', 'SideNavigation.TopItem', 'SideNavigation.Group'],
  nested: ['SideNavigation.NestedItem', 'SideNavigation.NestedGroup'],
} as const;

export function validateChildren({
  children,
  filterLevel,
}: {
  children: ReactChildArray;
  filterLevel: 'main' | 'nested';
}) {
  children.forEach((child) => {
    const isTopLevel = filterLevel === 'main';

    // @ts-expect-error - TS2345 - Argument of type 'any' is not assignable to parameter of type 'never'. | TS2339 - Property 'type' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
    if (!ALLOWED_CHILDREN_MAP[filterLevel].includes(child.type.displayName)) {
      throw new Error(
        // @ts-expect-error - TS2339 - Property 'type' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
        `Gestalt ${child.type.displayName} cannot be used at ${
          isTopLevel ? 'the top' : 'a nested'
        } level`,
      );
    }
  });
}

export function countItemsWithIcon(children: ReactChildArray): number {
  // @ts-expect-error - TS2322 - Type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal' is not assignable to type 'number'.
  return flattenChildren(children).reduce(
    (count, child) =>
      // @ts-expect-error - TS2339 - Property 'type' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
      child.type.displayName === 'SideNavigation.Section'
        ? // @ts-expect-error - TS2365 - Operator '+' cannot be applied to types 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal' and 'number'. | TS2339 - Property 'props' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
          count + countItemsWithIcon(child.props.children)
        : // @ts-expect-error - TS2365 - Operator '+' cannot be applied to types 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal' and 'number'. | TS2339 - Property 'props' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
          count + Number(Boolean(child.props.icon)),
    0,
  );
}

export function getChildrenActiveProp(children: ReactChildArray): EllipsisProps['active'] {
  if (children.length === 0) return undefined;

  // @ts-expect-error - TS2339 - Property 'props' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
  const activeChild = children.find((child) => !!child.props?.active);

  // @ts-expect-error - TS2339 - Property 'props' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'. | TS2339 - Property 'props' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
  if (activeChild?.props?.active) return activeChild.props.active;

  const grandChildren = children
    .filter(
      (child) =>
        // @ts-expect-error - TS2339 - Property 'type' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
        child?.type?.displayName === 'SideNavigation.Group' ||
        // @ts-expect-error - TS2339 - Property 'type' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
        child?.type?.displayName === 'SideNavigation.NestedGroup',
    )
    // @ts-expect-error - TS2339 - Property 'props' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
    .map((child) => flattenChildren(child?.props?.children))
    .flat();

  return getChildrenActiveProp(grandChildren);
}

function renderEllipses(
  items: ReadonlyArray<React.ReactElement<React.ComponentProps<never>> | EllipsisProps>,
) {
  return items.map((item, i) => {
    // @ts-expect-error - TS2339 - Property 'props' does not exist on type 'Props | ReactElement<never, string | JSXElementConstructor<any>>'.
    if (item.props) return item;

    return (
      // eslint-disable-next-line react/no-array-index-key
      <li key={i} className={classnames(styles.liItem)}>
        <ItemsEllipsis {...item} />
      </li>
    );
  });
}

/**
 * Reduces `TopItem` and `Group` items into ellipsis if they have no icons.
 * This is for items that are not inside `Section`.
 * If there are `TopItem` or `Group` items before and after `Section`s,
 * each portion will have separate ellipses for iconless items.
 * Ellipses are added as props object, not a component, during the process,
 * so it is easier to update.
 */
export function reduceIconlessChildrenIntoEllipsis(
  children: ReactChildArray,
): ReadonlyArray<ReactNode> {
  // @ts-expect-error - TS7034 - Variable 'lastEllipsisIndex' implicitly has type 'any' in some locations where its type cannot be determined.
  let lastEllipsisIndex;
  // @ts-expect-error - TS7034 - Variable 'lastSectionIndex' implicitly has type 'any' in some locations where its type cannot be determined.
  let lastSectionIndex;

  const items = children.reduce<Array<any>>((acc, child, index) => {
    // @ts-expect-error - TS2339 - Property 'type' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
    const isSection = child.type.displayName === 'SideNavigation.Section';
    // @ts-expect-error - TS2339 - Property 'props' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
    const shouldSkip = isSection || !!child.props.icon;

    // Keep track of last section index
    if (isSection) lastSectionIndex = index;
    // Sections or items with icons are skipped and just added to the items list.
    if (shouldSkip) return acc.concat(child);

    // @ts-expect-error - TS2339 - Property 'props' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
    const { notificationAccessibilityLabel, active } = child.props;

    // Create new ellipsis if there are no ellipses
    // or after the last ellipsis there is a section.
    // @ts-expect-error - TS7005 - Variable 'lastEllipsisIndex' implicitly has an 'any' type. | TS7005 - Variable 'lastEllipsisIndex' implicitly has an 'any' type. | TS7005 - Variable 'lastSectionIndex' implicitly has an 'any' type.
    if (lastEllipsisIndex === undefined || lastEllipsisIndex < lastSectionIndex) {
      const ellipsis: EllipsisProps = {};
      lastEllipsisIndex = index;
      acc.push(ellipsis);
    }

    // Take the last ellipsis from the resulting list of items.
    // @ts-expect-error - TS2339 - Property 'at' does not exist on type 'any[]'. | TS7005 - Variable 'lastEllipsisIndex' implicitly has an 'any' type.
    const lastEllipsis = acc.at(lastEllipsisIndex);

    if (lastEllipsis) {
      // Set notification label of the current child to the last ellipsis
      // unless the ellipsis already has a notification label.
      lastEllipsis.notificationAccessibilityLabel ||= notificationAccessibilityLabel;

      // Set ellipsis active prop if the current child or
      // one of its nested children is active.
      if (active) {
        lastEllipsis.active ||= active;
        // @ts-expect-error - TS2339 - Property 'type' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
      } else if (child.type.displayName === 'SideNavigation.Group') {
        // @ts-expect-error - TS2339 - Property 'props' does not exist on type 'string | number | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal'.
        lastEllipsis.active ||= getChildrenActiveProp(flattenChildren(child.props.children));
      }
    }

    return acc;
  }, []);

  // @ts-expect-error - TS2322 - Type '(Element | Props)[]' is not assignable to type 'readonly ReactNode[]'.
  return renderEllipses(items);
}

```

### Core Architecture Module: `packages/gestalt/src/utils/datavizcolors/getCheckboxColor.ts`
```
import {
  TOKEN_COLOR_BACKGROUND_FORMFIELD_PRIMARY,
  TOKEN_COLOR_BORDER_DEFAULT,
  TOKEN_COLOR_GRAY_ROBOFLOW_300,
  TOKEN_COLOR_TRANSPARENT,
} from 'gestalt-design-tokens';

export type InteractionStates = {
  disabled: boolean;
  hovered: boolean;
  selected: boolean;
};

/**
 *
 * Given an interactions state for a checkbox, returns the relevant bg and border color
 * */
export default function getCheckboxColor({
  state,
  colorStyles,
  opts,
}: {
  state: InteractionStates;
  colorStyles: {
    borderColor?: string;
    backgroundColor?: string;
  };
  opts?: {
    showByDefault?: boolean;
  };
}): {
  borderColor?: string;
  backgroundColor?: string;
} {
  const defaultBackgroundColor = TOKEN_COLOR_TRANSPARENT;
  const defaultBorderColor = TOKEN_COLOR_TRANSPARENT;

  if (state.disabled) {
    return {
      backgroundColor: TOKEN_COLOR_GRAY_ROBOFLOW_300,
      borderColor: defaultBorderColor,
    };
  }

  if (state.hovered && !state.selected) {
    return {
      backgroundColor: TOKEN_COLOR_BACKGROUND_FORMFIELD_PRIMARY,
      borderColor: TOKEN_COLOR_BORDER_DEFAULT,
    };
  }

  if (state.selected) {
    return {
      backgroundColor: colorStyles.borderColor,
      borderColor: defaultBorderColor,
    };
  }

  if (opts?.showByDefault) {
    return {
      backgroundColor: TOKEN_COLOR_BACKGROUND_FORMFIELD_PRIMARY,
      borderColor: TOKEN_COLOR_BORDER_DEFAULT,
    };
  }

  return {
    backgroundColor: defaultBackgroundColor,
    borderColor: defaultBorderColor,
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4094** (2025-11-21): **[Gestalt web][patch] Pog: Changed path for the Focus.css file**
  *Symptoms*: ## Pull Request Template  ### Summary  #### What changed?  This PR fixes the import path for `Focus.css` in Gestalt Web tests. The path has been updated from `./Focus.css` to `../Focus.css` to correctly reference the file location.  #### Why?  Tests in Gestalt Web were failing with an error indicating that `./Focus.css` cannot be found. This was due to an incorrect relative path that didn't account for the actual file structure. The file is located one directory level up from where the import statement was looking.  ``` [Error: ENOENT: no such file or directory, open 'gestalt/packages/gestalt/src/Pog/Focus.css'] {   errno: -2,   code: 'ENOENT',   syscall: 'open',   path: '/gestalt/packages/gestalt/src/Pog/Focus.css' } ```  By correcting this path to `../Focus.css`, the tests can now properly locate and import the Focus styles, resolving the test failures and ensuring the test suite runs successfully. This is a simple path correction that aligns the import with the actual project structure.  ### Links  - [Jira](https://pinterest.atlassian.net/browse/UXE-42)
  **Post-Mortem & Fix Analysis**:
  > @Kostya92 is attempting to deploy a commit to the **Pinterest - Subsites** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Pinterest%20-%20Subsites&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22dcd633b55e0c6deab062fe8603f9581773f9e5e4%22%7D%2C%22id%22%3A%22QmQzKYBWKoiYVauyhRXg6q1RXUQQd69MuXAqGHZAcar1oB%22%2C%22org%22%3A%22pinterest%22%2C%22prId%22%3A4094%2C%22repo%22%3A%22gestalt%22%7D).  
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *gestalt* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | dcd633b55e0c6deab062fe8603f9581773f9e5e4 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/gestalt/deploys/6915b9c75ab5fe00081b57c9 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-4094--gestalt.netlify.app](https://deploy-preview-4094--gestalt.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTQwOTQtLWdlc3RhbHQubmV0bGlmeS5hcHAifQ.tA46ivcpr9fLsCNZiZ46glDwi-f2bJVDjT2mezNPEg4)<br /><br />_Use your smartphone cam

- **Issue #3146** (2023-08-22): **Masonry: Allow positionStore to be externally managed**
  *Symptoms*: ### Summary  #### What changed?  This PR adds an optional `positionStore` prop to Masonry in order to allow its position cache to be externally persisted (similar to measurementStore).  #### Why?  For the two column experiment in Pinboard, it was reported that navigating _away_ from a grid and then navigating back would result in the browser freezing. I was able to repro the issue and, while I was not able to get a profile due to the browser hanging, Chrome did point to this line before crashing: https://github.com/pinterest/gestalt/blob/master/packages/gestalt/src/Masonry/defaultTwoColumnModuleLayout.js#L75  Our original thought when building out the graph was that, because we already had the measurements cached, re-generating the actual graph per render should be cheap. However, it seems this is not the case.    ### Links  - [Jira](https://jira.pinadmin.com/browse/SSP-208)  ### Checklist - Tested this by patching gestalt locally and updating Pinboard code to use an external positionStore. Verified that the issue no longer happens 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *gestalt* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | af8b3c4db99da84cfcc26207648f41aeb219f9b8 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/sites/gestalt/deploys/64e471dbf81ff300089c50b5 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-3146--gestalt.netlify.app](https://deploy-preview-3146--gestalt.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTMxNDYtLWdlc3RhbHQubmV0bGlmeS5hcHAifQ.rNbrA99OYTnkhr3mD8rvukSoxnSMAOwxwhsd8hdOu1Q)<br /><br />_Use your smartphone camera

- **Issue #2615** (2023-01-20): **Revert "Masonry: deprecate Item prop in favor of renderItem prop"**
  *Symptoms*: This reverts commit d41bdf7e37c38b8f4de8125880f0016033a8f450, which was accidentally merged without CI and code review 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *gestalt* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |---------------------------------|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 7d4e8a61571fd440486152f6beedd8eac095f8b5 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/sites/gestalt/deploys/63ca0d560964c60009f63104 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-2615--gestalt.netlify.app](https://deploy-preview-2615--gestalt.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTI2MTUtLWdlc3RhbHQubmV0bGlmeS5hcHAifQ.5-7-tl0uSkcgaTqBnSGtGRwh9VZRa0586_5Fe7cFptk)<br /><br

- **Issue #2400** (2022-09-19): **Revert "Popover: Add support to handle content that overflows the viewport height"**
  *Symptoms*: This reverts commit [Popover: Add support to handle content that overflows the viewport height ([#2384](https://github.com/pinterest/gestalt/pull/2384))]  This was motivated by: - https://pinterest.slack.com/archives/GG6T5UG3X/p1663601895689729 - https://pinterest.slack.com/archives/G01GN7CE99S/p1663265961230629  Bug repro: https://www.loom.com/share/50731be953b34c4e82521fc3c18d7f00 & https://www.loom.com/share/dfef5d196be5411caff4eb1b3f7b4f03
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *gestalt* ready!   |  Name | Link | |---------------------------------|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 6c416124acbfe2ed1280c7fa1a23cac4990681a3 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/sites/gestalt/deploys/6328a608ef5d41000be11e61 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-2400--gestalt.netlify.app](https://deploy-preview-2400--gestalt.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTI0MDAtLWdlc3RhbHQubmV0bGlmeS5hcHAifQ.nA62MFJpvHvGb0DrHuuo-rCSSR-fIZCd6s4Fr04jLfE)<br /><br />_Use your smartphone camera to open QR code link._</details> | ---  _To edit notification comments on pull requests, go to your [Netlify

- **Issue #1557** (2021-06-15): **Button: fix incorrect styling for disabled buttons on Safari / iOS**
  *Symptoms*: This fixes #1556 by changing the `key` value every time `disabled` is changed  Before: ![Screen Shot 2021-06-15 at 10 57 27 AM](https://user-images.githubusercontent.com/5341184/122105431-9ebb5900-cdcd-11eb-9d3d-1706631781de.png)  After: ![Screen Shot 2021-06-15 at 11 34 05 AM](https://user-images.githubusercontent.com/5341184/122105448-a4b13a00-cdcd-11eb-940f-e77d32706bdb.png) 
  **Post-Mortem & Fix Analysis**:
  > :heavy_check_mark: Deploy Preview for *gestalt* ready!   :hammer: Explore the source changes: 2ed4c649675b3efa679f782795cd64a186c2cd2c  :mag: Inspect the deploy log: [https://app.netlify.com/sites/gestalt/deploys/60c8f2c28af4bf0007a0ec40](https://app.netlify.com/sites/gestalt/deploys/60c8f2c28af4bf0007a0ec40?utm_source=github&utm_campaign=bot_dl)  :sunglasses: Browse the preview: [https://deploy-preview-1557--gestalt.netlify.app/](https://deploy-preview-1557--gestalt.netlify.app/?utm_source=github&utm_campaign=bot_dp) 
  > Taking on this bug

- **Issue #1327** (2021-01-08): **Layer: fix a bug where Layer ummounts children on rerender when zIndex changes**
  *Symptoms*: This fixes #1326.  When we pass `zIndex` indexable object and the reference is changed, the cleanup routine of `useEffect` hook, which depends on `zIndex` would be fired and would replace the entire children tree with a new one. I believe this is an oversight when we added `zIndex` support in #1223. I am fixing this bug by:  1. make sure the `useEffect` hook which appends/removes a div element only runs on mount/unmount. 2. the zIndex is handled by a separate `useEffect` after the `useEffect` hook above so that it (1) initiailizes the zIndex after the div has been created on mount, and (2) updates zIndex-related attributes of the div element whenever the value of the zIndex prop changes.  I also removed the documentation where we encourage people to avoid rerendering. Avoid rerendering should only be a perf optimization and should not be used as a semantic guarentee.
  **Post-Mortem & Fix Analysis**:
  > :heavy_check_mark: Deploy preview for *gestalt* ready!   :hammer: Explore the source changes: 89354de9c310de704cda88d0e6b140b4fe337f97  :mag: Inspect the deploy logs: [https://app.netlify.com/sites/gestalt/deploys/5ff8d09b878f3b0008f2897a](https://app.netlify.com/sites/gestalt/deploys/5ff8d09b878f3b0008f2897a?utm_source=github&utm_campaign=bot_dl)  :sunglasses: Browse the preview: [https://deploy-preview-1327--gestalt.netlify.app](https://deploy-preview-1327--gestalt.netlify.app?utm_source=github&utm_campaign=bot_dp) 
  > @chrislloyd I addressed the comments. can you please take another look?

- **Issue #1322** (2020-12-22): **Modal: fix bad flow types**
  *Symptoms*: Fix flow errors for Modal introduced in https://github.com/pinterest/gestalt/pull/1316
  **Post-Mortem & Fix Analysis**:
  > :heavy_check_mark: Deploy preview for *gestalt* ready!   :hammer: Explore the source changes: 3f74fa57f8f345cd4515dc36430ffdd9bef9b16b  :mag: Inspect the deploy logs: [https://app.netlify.com/sites/gestalt/deploys/5fe27fa9115cf800070d7b54](https://app.netlify.com/sites/gestalt/deploys/5fe27fa9115cf800070d7b54?utm_source=github&utm_campaign=bot_dl)  :sunglasses: Browse the preview: [https://deploy-preview-1322--gestalt.netlify.app](https://deploy-preview-1322--gestalt.netlify.app?utm_source=github&utm_campaign=bot_dp) 

- **Issue #1066** (2020-07-21): **Docs: fix broken CodeSandbox links**
  *Symptoms*: This PR fixes CodeSandbox links in docs, which do not work since #1058  before ![Screenshot 2020-07-21 13 37 06](https://user-images.githubusercontent.com/5341184/88104865-ed2d8c80-cb57-11ea-89bf-ba3c051fa86e.png)  after ![Screenshot 2020-07-21 13 38 05](https://user-images.githubusercontent.com/5341184/88104880-f28ad700-cb57-11ea-9dca-284a9fd4796f.png)  ## Test Plan  manually tested on localhost 
  **Post-Mortem & Fix Analysis**:
  > Deploy preview for *gestalt* ready!  Built with commit d2a38f1e95992ea51a290ebab8c0c44e3e56420d  https://deploy-preview-1066--gestalt.netlify.app

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

### Incident Patch 1: `7fb14f86` (2025-11-21)
**Commit Message**: Docs: Re-enable legacy banner button for Gestalt 2.0 [UXE-229] (#4095)

**File**: `docs/docs-components/AppLayout.tsx` (modified, +13/-7)
```diff
@@ -1,6 +1,16 @@
 import { Fragment, ReactNode, useEffect, useState } from 'react';
 import { useRouter } from 'next/router';
-import { Box, DeviceTypeProvider, Divider, FixedZIndex, Flex, Icon, Sticky, Text } from 'gestalt';
+import {
+  Box,
+  ButtonLink,
+  DeviceTypeProvider,
+  Divider,
+  FixedZIndex,
+  Flex,
+  Icon,
+  Sticky,
+  Text,
+} from 'gestalt';
 import {
   TOKEN_COLOR_GRAY_ROBOFLOW_700,
   TOKEN_COLOR_ORANGE_FIRETINI_0,
@@ -61,15 +71,12 @@ function Banner() {
           </Text>
 
           <Text size={isSMBreakpoint ? '200' : '300'}>
-            Information might be outdated. Stay tuned for Gestalt’s new documentation website coming
-            soon.
+            Information might be outdated. For the latest documentation and support, visit Gestalt’s
+            new documentation website.
           </Text>
         </Flex>
       </Flex>
 
-      {/*
-      Enable when the new documentation website is ready:
-
       <Box marginTop={4} smMarginTop={0}>
         <ButtonLink
           color="red"
@@ -78,7 +85,6 @@ function Banner() {
           text="Explore Gestalt 2.0"
         />
       </Box>
-      */}
     </Box>
   );
 }
```

---

### Incident Patch 2: `d559fa35` (2025-11-03)
**Commit Message**: Docs: Update legacy banner content; hide button [UXE-202] (#4093)

**File**: `docs/docs-components/AppLayout.tsx` (modified, +7/-13)
```diff
@@ -1,16 +1,6 @@
 import { Fragment, ReactNode, useEffect, useState } from 'react';
 import { useRouter } from 'next/router';
-import {
-  Box,
-  ButtonLink,
-  DeviceTypeProvider,
-  Divider,
-  FixedZIndex,
-  Flex,
-  Icon,
-  Sticky,
-  Text,
-} from 'gestalt';
+import { Box, DeviceTypeProvider, Divider, FixedZIndex, Flex, Icon, Sticky, Text } from 'gestalt';
 import {
   TOKEN_COLOR_GRAY_ROBOFLOW_700,
   TOKEN_COLOR_ORANGE_FIRETINI_0,
@@ -71,12 +61,15 @@ function Banner() {
           </Text>
 
           <Text size={isSMBreakpoint ? '200' : '300'}>
-            Information might be outdated. For the latest documentation and support, visit Gestalt’s
-            new documentation website.
+            Information might be outdated. Stay tuned for Gestalt’s new documentation website coming
+            soon.
           </Text>
         </Flex>
       </Flex>
 
+      {/*
+      Enable when the new documentation website is ready:
+
       <Box marginTop={4} smMarginTop={0}>
         <ButtonLink
           color="red"
@@ -85,6 +78,7 @@ function Banner() {
           text="Explore Gestalt 2.0"
         />
       </Box>
+      */}
     </Box>
   );
 }
```

---

### Incident Patch 3: `8be1e847` (2025-04-07)
**Commit Message**: Docs: fix in redirect (#4071)

**File**: `docs/pages/foundations/international_design/icon_localization.tsx` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ Some icons might need to be removed because they don’t apply to an RTL languag
         />
         <MainSection.Subsection
           description={`
-          **[Iconography guidelines](https://gestalt.pinterest.systems/foundations/iconography/library)**
+          **[Iconography guidelines](http://pinch.pinadmin.com/iconLibrary)**
           Usage guidelines and best practices for our product icon library
           `}
         />
```

**File**: `docs/pages/foundations/international_design/rtl_guidelines/iconography.tsx` (modified, +1/-1)
```diff
@@ -415,7 +415,7 @@ representations of time. In RTL, decide whether to show circular or horizontal d
           />
           <MainSection.Subsection
             description={`
-          **[Iconography guidelines](https://gestalt.pinterest.systems/foundations/iconography/library)**
+          **[Iconography guidelines](http://pinch.pinadmin.com/iconLibrary)**
           Usage guidelines and best practices for our product icon library
           `}
           />
```

**File**: `docs/redirects.js` (modified, +1/-0)
```diff
@@ -238,6 +238,7 @@ const misc = [
   {
     source: '/foundations/iconography/library',
     destination: 'http://pinch.pinadmin.com/iconLibrary',
+    basePath: false,
     permanent: true,
   },
   {
```

**File**: `packages/gestalt/src/Accordion.tsx` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ type Props = {
    */
   dataTestId?: string;
   /**
-   * Name of icon to display in front of title. Will not be displayed if `title` is not provided. Not to be used with `badge` or `iconButton`. For a full list of icons, see [Iconography and SVGs](https://gestalt.pinterest.systems/foundations/iconography/library#Search-icon-library). See the [icon variant](https://gestalt.pinterest.systems/web/accordion#Static-Icon) for more details.
+   * Name of icon to display in front of title. Will not be displayed if `title` is not provided. Not to be used with `badge` or `iconButton`. For a full list of icons, see [Iconography and SVGs](http://pinch.pinadmin.com/iconLibrary#Search-icon-library). See the [icon variant](https://gestalt.pinterest.systems/web/accordion#Static-Icon) for more details.
    */
   icon?: keyof typeof icons;
   /**
```

**File**: `packages/gestalt/src/Icon.tsx` (modified, +2/-2)
```diff
@@ -36,7 +36,7 @@ type Props = {
   /**
    * SVG icon from the Gestalt icon library to use within Icon.
    *
-   * See the [icon library](https://gestalt.pinterest.systems/foundations/iconography/library) to explore available options.
+   * See the [icon library](http://pinch.pinadmin.com/iconLibrary) to explore available options.
    */
   icon?: keyof typeof icons;
   /**
@@ -65,7 +65,7 @@ const IconNames: ReadonlyArray<keyof typeof icons> = Object.keys(icons);
 /**
  * [Icons](https://gestalt.pinterest.systems/web/icon) are the symbolic representation of an action or information, providing visual context and improving usability.
  *
- * See the [Iconography and SVG guidelines](https://gestalt.pinterest.systems/foundations/iconography/library) to explore the full icon library.
+ * See the [Iconography and SVG guidelines](http://pinch.pinadmin.com/iconLibrary) to explore the full icon library.
  *
  * ![Icon light mode](https://raw.githubusercontent.com/pinterest/gestalt/master/playwright/visual-test/Icon-list.spec.ts-snapshots/Icon-list-chromium-darwin.png)
  * ![Icon dark mode](https://raw.githubusercontent.com/pinterest/gestalt/master/playwright/visual-test/Icon-list-dark.spec.ts-snapshots/Icon-list-dark-chromium-darwin.png)
```

**File**: `packages/gestalt/src/IconButtonFloating.tsx` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ type Props = {
    */
   disabled?: boolean;
   /**
-   * Icon displayed in IconButtonFloating to convey the behavior of the component. Refer to our [iconography library](https://gestalt.pinterest.systems/foundations/iconography/library) to see available icons.
+   * Icon displayed in IconButtonFloating to convey the behavior of the component. Refer to our [iconography library](http://pinch.pinadmin.com/iconLibrary) to see available icons.
    */
   icon: keyof typeof icons;
   /**
```

**File**: `packages/gestalt/src/IconButtonLink.tsx` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ type Props = {
   /**
    * SVG icon from the Gestalt icon library to use within Icon.
    *
-   * See the [icon library](https://gestalt.pinterest.systems/foundations/iconography/library) to explore available options.
+   * See the [icon library](http://pinch.pinadmin.com/iconLibrary) to explore available options.
    */
   icon?: keyof typeof icons;
   /**
```

**File**: `packages/gestalt/src/IconCompact.tsx` (modified, +2/-2)
```diff
@@ -36,7 +36,7 @@ type Props = {
   /**
    * SVG icon from the Gestalt icon library to use within Icon.
    *
-   * See the [icon library](https://gestalt.pinterest.systems/foundations/iconography/library) to explore available options.
+   * See the [icon library](http://pinch.pinadmin.com/iconLibrary) to explore available options.
    */
   icon?: keyof typeof compactIconsVR;
   /**
@@ -66,7 +66,7 @@ const IconNames: ReadonlyArray<keyof typeof compactIconsVR> = Object.keys(compac
  * [Icons](https://gestalt.pinterest.systems/web/icon) are the symbolic representation of an action or information, providing visual context and improving usability. These icons have a 16x16 viewboxes and are used in places where space is limited. Refer to your designer for guidance on when to use Compact Icons.
 
  *
- * See the [Iconography and SVG guidelines](https://gestalt.pinterest.systems/foundations/iconography/library) to explore the full icon library.
+ * See the [Iconography and SVG guidelines](http://pinch.pinadmin.com/iconLibrary) to explore the full icon library.
  *
  * ![Icon light mode](https://raw.githubusercontent.com/pinterest/gestalt/master/playwright/visual-test/Icon-list.spec.ts-snapshots/IconCompact-list-chromium-darwin.png)
  * ![Icon dark mode](https://raw.githubusercontent.com/pinterest/gestalt/master/playwright/visual-test/Icon-list-dark.spec.ts-snapshots/IconCompact-list-dark-chromium-darwin.png)
```

---

### Incident Patch 4: `ad2f2212` (2025-04-02)
**Commit Message**: Button: Fixing docs (#4065)

**File**: `docs/pages/web/buttonsocial.tsx` (modified, +3/-0)
```diff
@@ -2,6 +2,7 @@ import { ButtonSocial } from 'gestalt';
 import AccessibilitySection from '../../docs-components/AccessibilitySection';
 import CombinationNew from '../../docs-components/CombinationNew';
 import docGen, { type DocGen } from '../../docs-components/docgen';
+import GeneratedPropTable from '../../docs-components/GeneratedPropTable';
 import MainSection from '../../docs-components/MainSection';
 import Page from '../../docs-components/Page';
 import PageHeader from '../../docs-components/PageHeader';
@@ -16,6 +17,8 @@ export default function DocsPage({ generatedDocGen }: { generatedDocGen: DocGen
         <SandpackExample code={main} hideEditor name="Main ButtonSocial example" />
       </PageHeader>
 
+      <GeneratedPropTable generatedDocGen={generatedDocGen} />
+
       <AccessibilitySection name={generatedDocGen?.displayName} />
 
       <MainSection name="Localization" />
```

**File**: `packages/gestalt/src/ButtonSocial.tsx` (modified, +3/-3)
```diff
@@ -16,7 +16,7 @@ import Text from './Text';
 import useFocusVisible from './useFocusVisible';
 import useExperimentalTheme from './utils/useExperimentalTheme';
 
-type ButtonProps = {
+type Props = {
   /**
    * Available for testing purposes, if needed. Consider [better queries](https://testing-library.com/docs/queries/about/#priority) before using this prop.
    */
@@ -44,8 +44,8 @@ type ButtonProps = {
  * ![ButtonSocial dark mode](https://raw.githubusercontent.com/pinterest/gestalt/master/playwright/visual-test/ButtonSocial-dark.spec.ts-snapshots/ButtonSocial-dark-chromium-darwin.png)
  */
 
-const ButtonSocialWithForwardRef = forwardRef<HTMLButtonElement, ButtonProps>(function ButtonSocial(
-  { dataTestId, onClick, type, service },
+const ButtonSocialWithForwardRef = forwardRef<HTMLButtonElement, Props>(function ButtonSocial(
+  { dataTestId, onClick, type, service }: Props,
   ref,
 ) {
   const innerRef = useRef<null | HTMLButtonElement>(null);
```

---

### Incident Patch 5: `dde572ba` (2025-04-01)
**Commit Message**: Masonry: Add unit test to verify the overlap bug on dynamic heights v2 is fixed (#4017)

**File**: `packages/gestalt/src/Masonry/dynamicHeightsUtils.test.ts` (modified, +101/-0)
```diff
@@ -494,4 +494,105 @@ describe('dynamic heights on masonry', () => {
       expect(newPos).toEqual(expectedPos[index]);
     });
   });
+
+  test('item height increases more than next item height, should not cause an overlap when there is a multi-column affected', () => {
+    const measurementStore = new MeasurementStore<Record<any, any>, number>();
+    const positionCache = new MeasurementStore<Record<any, any>, Position>();
+    const items: readonly [Item, Item, ...Item[]] = [
+      { 'name': 'Pin 0', 'height': 250, 'color': '#EAE6CA' },
+      { 'name': 'Pin 1', 'height': 150, 'color': '#AEA04B' },
+      { 'name': 'Pin 2', 'height': 400, 'color': '#C51D34' },
+      { 'name': 'Pin 3', 'height': 200, 'color': '#063971' },
+      { 'name': 'Pin 4', 'height': 250, 'color': '#7F7679' },
+      { 'name': 'Pin 5', 'height': 250, 'color': '#CDA434' },
+      { 'name': 'Pin 6', 'height': 200, 'color': '#FF2301' },
+      { 'name': 'Pin 7', 'height': 400, 'color': '#F44611' },
+      { 'name': 'Pin 8', 'height': 450, 'color': '#D0D0D0' },
+      { 'name': 'Pin 9', 'height': 150, 'color': '#A52019', columnSpan: 3 },
+      { 'name': 'Pin 10', 'height': 350, 'color': '#CF3476' },
+      { 'name': 'Pin 11', 'height': 400, 'color': '#474B4E' },
+      { 'name': 'Pin 12', 'height': 250, 'color': '#F6F6F6' },
+      { 'name': 'Pin 13', 'height': 315, 'color': '#2F4538' },
+      { 'name': 'Pin 14', 'height': 255, 'color': '#D84B20' },
+    ];
+    items.forEach((item: any) => {
+      measurementStore.set(item, item.height);
+    });
+
+    const layout = defaultLayout({
+      gutter,
+      columnWidth: 236,
+      align: 'start',
+      measurementCache: measurementStore,
+      positionCache,
+      layout: 'basic',
+      minCols: 5,
+      rawItemCount: items.length,
+      width: 236 * 5,
+      _getColumnSpanConfig: getColumnSpanConfig,
+      originalItems: items,
+    });
+
+    const positions = layout(items);
+
+    const expectedOriginalPos = [
+      { top: 0, left: 0, width: 236, height: 250 },
+      { top: 0, left: 236, width: 236, height: 150 },
+      { top: 0, left: 472, width: 236, height: 400 },
+      { top: 0, left: 708, width: 236, height: 200 },
+      { top: 0, left: 944, width: 236, height: 250 },
+      { top: 150, left: 236, width: 236, height: 250 },
+      { top: 200, left: 708, width: 236, height: 200 },
+      { top: 250, left: 0, width: 236, height: 400 },
+      { top: 250, left: 944, width: 236, height: 450 },
+      { top: 400, left: 236, width: 708, height: 150 },
+      { top: 550, left: 236, width: 236, height: 350 },
+      { top: 550, left: 472, width: 236, height: 400 },
+      { top: 550, left: 708, width: 236, height: 250 },
+      { top: 650, left: 0, width: 236, height: 315 },
+      { top: 700, left: 944, width: 236, height: 255 },
+    ];
+
+    items.forEach((_, index) => {
+      const originalPos = positions[index]!;
+      expect(originalPos).toEqual(expectedOriginalPos[index]);
+    });
+
+    const changedItemIndex = 3; // Pin 3
+    const heightDelta = 400;
+    const itemHeight = items[changedItemIndex]!.height;
+    const changedItemIndexNewHeight = itemHeight + heightDelta;
+
+    recalcHeights({
+      items,
+      changedItem: items[changedItemIndex],
+      newHeight: changedItemIndexNewHeight,
+      positionStore: positionCache,
+      measurementStore,
+      gutter,
+    });
+
+    const expectedPos = [
+      { top: 0, left: 0, width: 236, height: 250 },
+      { top: 0, left: 236, width: 236, height: 150 },
+      { top: 0, left: 472, width: 236, height: 400 },
+      { top: 0, left: 708, width: 236, height: 600 },
+      { top: 0, left: 944, width: 236, height: 250 },
+      { top: 150, left: 236, width: 236, height: 250 },
+      { top: 600, left: 708, width: 236, height: 200 },
+      { top: 250, left: 0, width: 236, height: 400 },
+      { top: 250, left: 944, width: 236, height: 450 },
+      { top: 800, left: 236, width: 708, height: 150 },
+      { top: 950, left: 236, width: 236, height: 350 },
+      { top: 950, left: 472, width: 236, height: 400 },
+      { top: 950, left: 708, width: 236, height: 250 },
+      { top: 650, left: 0, width: 236, height: 315 },
+      { top: 700, left: 944, width: 236, height: 255 },
+    ];
+
+    items.forEach((item, index) => {
+      const newPos = positionCache.get(item);
+      expect(newPos).toEqual(expectedPos[index]);
+    });
+  });
 });
```

---

### Incident Patch 6: `58400b7b` (2025-04-01)
**Commit Message**: Internal: fixing codemods (#4061)

**File**: `package.json` (modified, +3/-2)
```diff
@@ -74,7 +74,8 @@
     "jest": "28.0.3",
     "jest-environment-jsdom": "^28.0.2",
     "jest-fail-on-console": "^2.4.2",
-    "jscodeshift": "^0.11.0",
+    "jscodeshift": "^17.3.0",
+    "jscodeshift-helper": "^1.0.0",
     "lint-staged": "^10.4.0",
     "lottie-react": "^2.3.1",
     "netlify-cli": "^7.1.0",
@@ -103,7 +104,7 @@
   "resolutions": {
     "ansi-regex": "5.0.1",
     "bl": "4.0.3",
-    "browserslist": "4.16.5",
+    "browserslist": "4.24.4",
     "cssnano": "6.0.3",
     "css-select": "4.1.3",
     "glob-parent": "5.1.2",
```

**File**: `packages/gestalt-codemods/generic-codemods/entry.sh` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ if [[ $# -eq 0 ]]; then
   exit 0
 fi
 
-yarn jscodeshift --ignore-pattern=**/node_modules/** --ignore-pattern=build/** --parser=tsx -t="${DIR}"/"${1}".ts "${@:2}"
+yarn jscodeshift --ignore-pattern=**/node_modules/** --ignore-pattern=build/** --extensions=tsx --parser=tsx -t="${DIR}"/"${1}".ts "${@:2}"
 modified_files=$(git diff --relative --name-only -- '**/*.tsx' | xargs)
 if [ -n "${modified_files}" ]; then
   yarn prettier --write "$(git diff --relative --name-only -- '**/*.tsx' | xargs)"
```

**File**: `packages/gestalt-codemods/generic-codemods/utils.ts` (modified, +14/-2)
```diff
@@ -118,6 +118,16 @@ const checkComponentName = ({
       nodepath.parentPath.parentPath.value.name?.property?.name === subcomponentName
     : nodepath.parentPath.parentPath.value.name?.name === componentName;
 
+const getNumericString = (value: string) => {
+  let newValue = value;
+
+  if (value.startsWith('_')) {
+    newValue = value.replace('_', '');
+  }
+
+  return newValue;
+};
+
 /**
  * filterJSXByAttribute: Returns a collection containing the Gestalt JSX components with matching prop/value attributes
  */
@@ -137,8 +147,10 @@ const filterJSXByAttribute = ({
   value?: string | number | boolean;
 }): Collection => {
   if (typeof value === 'string') {
+    const newValue = getNumericString(value);
+
     return jSXCollection
-      .find(j.JSXAttribute, { name: { name: prop }, value: { value } })
+      .find(j.JSXAttribute, { name: { name: prop }, value: { value: newValue } })
       .filter((nodepath) => checkComponentName({ nodepath, componentName, subcomponentName }));
   }
 
@@ -199,7 +211,7 @@ const buildAttributeFromValue = ({
 }) => {
   switch (typeof value) {
     case 'string':
-      return j.jsxAttribute(j.jsxIdentifier(prop), j.stringLiteral(value));
+      return j.jsxAttribute(j.jsxIdentifier(prop), j.stringLiteral(getNumericString(value)));
     case 'number':
       return j.jsxAttribute(
         j.jsxIdentifier(prop),
```

**File**: `yarn.lock` (modified, +320/-350)
```diff
@@ -107,14 +107,6 @@
     "@babel/highlight" "^7.24.7"
     picocolors "^1.0.0"
 
-"@babel/code-frame@^7.25.7":
-  version "7.25.7"
-  resolved "https://registry.yarnpkg.com/@babel/code-frame/-/code-frame-7.25.7.tgz#438f2c524071531d643c6f0188e1e28f130cebc7"
-  integrity sha512-0xZJFNE5XMpENsgfHYTw8FbX4kv53mFLn2i3XPoq69LyhYSCBJtitaHx9QnsVTrsogI4Z3+HtEfZ2/GFPOtf5g==
-  dependencies:
-    "@babel/highlight" "^7.25.7"
-    picocolors "^1.0.0"
-
 "@babel/code-frame@^7.26.2":
   version "7.26.2"
   resolved "https://registry.yarnpkg.com/@babel/code-frame/-/code-frame-7.26.2.tgz#4b5fab97d33338eff916235055f0ebc21e573a85"
@@ -158,31 +150,10 @@
   resolved "https://registry.yarnpkg.com/@babel/compat-data/-/compat-data-7.24.7.tgz#d23bbea508c3883ba8251fb4164982c36ea577ed"
   integrity sha512-qJzAIcv03PyaWqxRgO4mSU3lihncDT296vnyuE2O8uA4w3UHWI4S3hgeZd1L8W1Bft40w9JxJ2b412iDUFFRhw==
 
-"@babel/compat-data@^7.25.7":
-  version "7.25.7"
-  resolved "https://registry.yarnpkg.com/@babel/compat-data/-/compat-data-7.25.7.tgz#b8479fe0018ef0ac87b6b7a5c6916fcd67ae2c9c"
-  integrity sha512-9ickoLz+hcXCeh7jrcin+/SLWm+GkxE2kTvoYyp38p4WkdFXfQJxDFGWp/YHjiKLPx06z2A7W8XKuqbReXDzsw==
-
-"@babel/core@^7.1.6":
-  version "7.25.7"
-  resolved "https://registry.yarnpkg.com/@babel/core/-/core-7.25.7.tgz#1b3d144157575daf132a3bc80b2b18e6e3ca6ece"
-  integrity sha512-yJ474Zv3cwiSOO9nXJuqzvwEeM+chDuQ8GJirw+pZ91sCGCyOZ3dJkVE09fTV0VEVzXyLWhh3G/AolYTPX7Mow==
-  dependencies:
-    "@ampproject/remapping" "^2.2.0"
-    "@babel/code-frame" "^7.25.7"
-    "@babel/generator" "^7.25.7"
-    "@babel/helper-compilation-targets" "^7.25.7"
-    "@babel/helper-module-transforms" "^7.25.7"
-    "@babel/helpers" "^7.25.7"
-    "@babel/parser" "^7.25.7"
-    "@babel/template" "^7.25.7"
-    "@babel/traverse" "^7.25.7"
-    "@babel/types" "^7.25.7"
-    convert-source-map "^2.0.0"
-    debug "^4.1.0"
-    gensync "^1.0.0-beta.2"
-    json5 "^2.2.3"
-    semver "^6.3.1"
+"@babel/compat-data@^7.26.8":
+  version "7.26.8"
+  resolved "https://registry.yarnpkg.com/@babel/compat-data/-/compat-data-7.26.8.tgz#821c1d35641c355284d4a870b8a4a7b0c141e367"
+  integrity sha512-oH5UPLMWR3L2wEFLnFJ1TZXqHufiTKAiLfqw5zkhS4dKXLJ10yVztfil/twG8EDTA4F/tvVNw9nOl4ZMslB8rQ==
 
 "@babel/core@^7.11.4":
   version "7.11.6"
@@ -311,6 +282,27 @@
     json5 "^2.2.3"
     semver "^6.3.1"
 
+"@babel/core@^7.24.7":
+  version "7.26.10"
+  resolved "https://registry.yarnpkg.com/@babel/core/-/core-7.26.10.tgz#5c876f83c8c4dcb233ee4b670c0606f2ac3000f9"
+  integrity sha512-vMqyb7XCDMPvJFFOaT9kxtiRh42GwlZEg1/uIgtZshS5a/8OaduUfCi7kynKgc3Tw/6Uo2D+db9qBttghhmxwQ==
+  dependencies:
+    "@ampproject/remapping" "^2.2.0"
+    "@babel/code-frame" "^7.26.2"
+    "@babel/generator" "^7.26.10"
+    "@babel/helper-compilation-targets" "^7.26.5"
+    "@babel/helper-module-transforms" "^7.26.0"
+    "@babel/helpers" "^7.26.10"
+    "@babel/parser" "^7.26.10"
+    "@babel/template" "^7.26.9"
+    "@babel/traverse" "^7.26.10"
+    "@babel/types" "^7.26.10"
+    convert-source-map "^2.0.0"
+    debug "^4.1.0"
+    gensync "^1.0.0-beta.2"
+    json5 "^2.2.3"
+    semver "^6.3.1"
+
 "@babel/eslint-parser@^7.17.0":
   version "7.17.0"
   resolved "https://registry.npmjs.org/@babel/eslint-parser/-/eslint-parser-7.17.0.tgz"
@@ -386,12 +378,13 @@
     "@jridgewell/trace-mapping" "^0.3.25"
     jsesc "^2.5.1"
 
-"@babel/generator@^7.25.7":
-  version "7.25.7"
-  resolved "https://registry.yarnpkg.com/@babel/generator/-/generator-7.25.7.tgz#de86acbeb975a3e11ee92dd52223e6b03b479c56"
-  integrity sha512-5Dqpl5fyV9pIAD62yK9P7fcA768uVPUyrQmqpqstHWgMma4feF1x/oFysBCVZLY5wJ2GkMUCdsNDnGZrPoR6rA==
+"@babel/generator@^7.26.10", "@babel/generator@^7.27.0":
+  version "7.27.0"
+  resolved "https://registry.yarnpkg.com/@babel/generator/-/generator-7.27.0.tgz#764382b5392e5b9aff93cadb190d0745866cbc2c"
+  integrity sha512-VybsKvpiN1gU1sdMZIp7FcqphVVKEwcuj02x73uvcHE0PTihx1nlBcowYWhDwjpoAXRv43+gDzyggGnn1XZhVw==
   dependencies:
-    "@babel/types" "^7.25.7"
+    "@babel/parser" "^7.27.0"
+    "@babel/types" "^7.27.0"
     "@jridgewell/gen-mapping" "^0.3.5"
     "@jridgewell/trace-mapping" "^0.3.25"
     jsesc "^3.0.2"
@@ -426,12 +419,12 @@
   dependencies:
     "@babel/types" "^7.24.7"
 
-"@babel/helper-annotate-as-pure@^7.25.7":
-  version "7.25.7"
-  resolved "https://registry.yarnpkg.com/@babel/helper-annotate-as-pure/-/helper-annotate-as-pure-7.25.7.tgz#63f02dbfa1f7cb75a9bdb832f300582f30bb8972"
-  integrity sha512-4xwU8StnqnlIhhioZf1tqnVWeQ9pvH/ujS8hRfw/WOza+/a+1qv69BWNy+oY231maTCWgKWhfBU7kDpsds6zAA==
+"@babel/helper-annotate-as-pure@^7.25.9":
+  version "7.25.9"
+  resolved "https://registry.yarnpkg.com/@babel/helper-annotate-as-pure/-/helper-annotate-as-pure-7.25.9.tgz#d8eac4d2dc0d7b6e11fa6e535332e0d3184f06b4"
+  integrity sha512-gv7320KBUFJz1RnylIg5WWYPRXKZ884AGkYpgpWW02TH66Dl+HaC1t1CKd0z3R4b6hdYEcmrNZHUmfCP+1u3/g==
   dependencies:
-    "@babel/types" "^7.25.7"
+    "@babel/types" "^7.25.9"
 
 "@babel/helper-annotate-as-pure@^7.8.3":
   
```

---

### Incident Patch 7: `75563fea` (2025-03-31)
**Commit Message**: Internal: fixes dark mode adding DesignTokensProvider (#4059)

**File**: `docs/pages/integration-test/masonry.tsx` (modified, +29/-27)
```diff
@@ -1,7 +1,7 @@
 import { ReactElement, useEffect, useState } from 'react';
 import LazyHydrate from 'react-lazy-hydration';
 import { useRouter } from 'next/router';
-import { ColorSchemeProvider, Masonry, MasonryV2 } from 'gestalt';
+import { ColorSchemeProvider, DesignTokensProvider, Masonry, MasonryV2 } from 'gestalt';
 import generateExampleItems from '../../integration-test-helpers/masonry/items-utils/generateExampleItems';
 import generateMultiColumnExampleItems from '../../integration-test-helpers/masonry/items-utils/generateMultiColumnExampleItems';
 import generateRealisticExampleItems from '../../integration-test-helpers/masonry/items-utils/generateRealisticExampleItems';
@@ -146,32 +146,34 @@ export default function TestPage({
 
   return (
     <ColorSchemeProvider colorScheme={darkModeValue ? 'dark' : 'light'}>
-      <MaybeLazyHydrate ssrOnly={ssrOnly}>
-        <MasonryContainer
-          constrained={constrainedValue}
-          dynamicHeights={dynamicHeightsValue}
-          dynamicHeightsV2={dynamicHeightsV2Value}
-          externalCache={externalCacheValue}
-          finiteLength={finiteLengthValue}
-          flexible={flexibleValue}
-          initialItems={getInitialItems()}
-          logWhitespace={logWhitespaceValue}
-          manualFetch={manualFetchValue}
-          MasonryComponent={experimentalValue ? MasonryV2 : Masonry}
-          measurementStore={measurementStore}
-          multiColPositionAlgoV2={multiColPositionAlgoV2Value}
-          multiColTest={multiColTestValue}
-          noScroll={noScrollValue}
-          offsetTop={offsetTopValue}
-          pinHeightsSample={realisticPinHeightsValue ? pinHeightsSample : undefined}
-          positionStore={positionStore}
-          scrollContainer={scrollContainerValue}
-          twoColItems={twoColItemsValue}
-          virtualBoundsBottom={virtualBoundsBottomValue}
-          virtualBoundsTop={virtualBoundsTopValue}
-          virtualize={virtualizeValue}
-        />
-      </MaybeLazyHydrate>
+      <DesignTokensProvider>
+        <MaybeLazyHydrate ssrOnly={ssrOnly}>
+          <MasonryContainer
+            constrained={constrainedValue}
+            dynamicHeights={dynamicHeightsValue}
+            dynamicHeightsV2={dynamicHeightsV2Value}
+            externalCache={externalCacheValue}
+            finiteLength={finiteLengthValue}
+            flexible={flexibleValue}
+            initialItems={getInitialItems()}
+            logWhitespace={logWhitespaceValue}
+            manualFetch={manualFetchValue}
+            MasonryComponent={experimentalValue ? MasonryV2 : Masonry}
+            measurementStore={measurementStore}
+            multiColPositionAlgoV2={multiColPositionAlgoV2Value}
+            multiColTest={multiColTestValue}
+            noScroll={noScrollValue}
+            offsetTop={offsetTopValue}
+            pinHeightsSample={realisticPinHeightsValue ? pinHeightsSample : undefined}
+            positionStore={positionStore}
+            scrollContainer={scrollContainerValue}
+            twoColItems={twoColItemsValue}
+            virtualBoundsBottom={virtualBoundsBottomValue}
+            virtualBoundsTop={virtualBoundsTopValue}
+            virtualize={virtualizeValue}
+          />
+        </MaybeLazyHydrate>
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

**File**: `docs/pages/visual-test/Accordion-dark.tsx` (modified, +4/-2)
```diff
@@ -1,10 +1,12 @@
-import { ColorSchemeProvider } from 'gestalt';
+import { ColorSchemeProvider, DesignTokensProvider } from 'gestalt';
 import ModuleVisualTest from './Accordion';
 
 export default function Screenshot() {
   return (
     <ColorSchemeProvider colorScheme="dark">
-      <ModuleVisualTest />
+      <DesignTokensProvider>
+        <ModuleVisualTest />
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

**File**: `docs/pages/visual-test/ActivationCard-dark.tsx` (modified, +33/-31)
```diff
@@ -1,39 +1,41 @@
-import { ActivationCard, Box, ColorSchemeProvider, Flex } from 'gestalt';
+import { ActivationCard, Box, ColorSchemeProvider, DesignTokensProvider, Flex } from 'gestalt';
 
 export default function Snapshot() {
   return (
     <ColorSchemeProvider colorScheme="dark">
-      <Box color="default" display="inlineBlock" padding={1}>
-        <Flex
-          direction="column"
-          gap={{
-            row: 0,
-            column: 2,
-          }}
-        >
-          <ActivationCard
-            dismissButton={{
-              accessibilityLabel: 'Dismiss card',
-              onDismiss: () => {},
+      <DesignTokensProvider>
+        <Box color="default" display="inlineBlock" padding={1}>
+          <Flex
+            direction="column"
+            gap={{
+              row: 0,
+              column: 2,
             }}
-            link={{
-              accessibilityLabel: 'Learn more about tag health',
-              href: 'https://pinterest.com',
-              label: 'Learn more',
-            }}
-            message="Oops! Your tag must be healthy to continue."
-            status="needsAttention"
-            statusMessage="Needs attention"
-            title="Tag is unhealthy"
-          />
-          <ActivationCard
-            message="Tag is installed and healthy"
-            status="complete"
-            statusMessage="Completed"
-            title="Nice work"
-          />
-        </Flex>
-      </Box>
+          >
+            <ActivationCard
+              dismissButton={{
+                accessibilityLabel: 'Dismiss card',
+                onDismiss: () => {},
+              }}
+              link={{
+                accessibilityLabel: 'Learn more about tag health',
+                href: 'https://pinterest.com',
+                label: 'Learn more',
+              }}
+              message="Oops! Your tag must be healthy to continue."
+              status="needsAttention"
+              statusMessage="Needs attention"
+              title="Tag is unhealthy"
+            />
+            <ActivationCard
+              message="Tag is installed and healthy"
+              status="complete"
+              statusMessage="Completed"
+              title="Nice work"
+            />
+          </Flex>
+        </Box>
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

**File**: `docs/pages/visual-test/Avatar-dark.tsx` (modified, +11/-9)
```diff
@@ -1,16 +1,18 @@
-import { Avatar, Box, ColorSchemeProvider } from 'gestalt';
+import { Avatar, Box, ColorSchemeProvider, DesignTokensProvider } from 'gestalt';
 
 export default function Snapshot() {
   return (
     <ColorSchemeProvider colorScheme="dark">
-      <Box color="default" display="inlineBlock" padding={1}>
-        <Avatar
-          name="Keerthi"
-          size="xl"
-          src="https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg"
-          verified
-        />
-      </Box>
+      <DesignTokensProvider>
+        <Box color="default" display="inlineBlock" padding={1}>
+          <Avatar
+            name="Keerthi"
+            size="xl"
+            src="https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg"
+            verified
+          />
+        </Box>
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

**File**: `docs/pages/visual-test/AvatarGroup-dark.tsx` (modified, +23/-21)
```diff
@@ -1,28 +1,30 @@
-import { AvatarGroup, Box, ColorSchemeProvider } from 'gestalt';
+import { AvatarGroup, Box, ColorSchemeProvider, DesignTokensProvider } from 'gestalt';
 
 export default function Snapshot() {
   return (
     <ColorSchemeProvider colorScheme="dark">
-      <Box color="default" display="inlineBlock" padding={1}>
-        <AvatarGroup
-          accessibilityLabel="Collaborators: Keerthi, Alberto, Shanice."
-          collaborators={[
-            {
-              name: 'Keerthi',
-              src: 'https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg',
-            },
-            {
-              name: 'Alberto',
-              src: 'https://i.pinimg.com/originals/c5/5c/ac/c55caca43a7c16766215ec165b649c1c.jpg',
-            },
-            {
-              name: 'Shanice',
-              src: 'https://i.pinimg.com/originals/ab/c5/4a/abc54abd85df131e90ca6b372368b738.jpg',
-            },
-          ]}
-          size="md"
-        />
-      </Box>
+      <DesignTokensProvider>
+        <Box color="default" display="inlineBlock" padding={1}>
+          <AvatarGroup
+            accessibilityLabel="Collaborators: Keerthi, Alberto, Shanice."
+            collaborators={[
+              {
+                name: 'Keerthi',
+                src: 'https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg',
+              },
+              {
+                name: 'Alberto',
+                src: 'https://i.pinimg.com/originals/c5/5c/ac/c55caca43a7c16766215ec165b649c1c.jpg',
+              },
+              {
+                name: 'Shanice',
+                src: 'https://i.pinimg.com/originals/ab/c5/4a/abc54abd85df131e90ca6b372368b738.jpg',
+              },
+            ]}
+            size="md"
+          />
+        </Box>
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

**File**: `docs/pages/visual-test/AvatarGroupCluster-dark.tsx` (modified, +55/-53)
```diff
@@ -1,60 +1,62 @@
-import { AvatarGroupCluster, Box, ColorSchemeProvider, Flex } from 'gestalt';
+import { AvatarGroupCluster, Box, ColorSchemeProvider, DesignTokensProvider, Flex } from 'gestalt';
 
 export default function Snapshot() {
   return (
     <ColorSchemeProvider colorScheme="dark">
-      <Box color="default" display="inlineBlock" padding={1}>
-        <Flex alignContent="center" gap={4} height="100%" justifyContent="center" wrap>
-          <AvatarGroupCluster
-            collaborators={[
-              {
-                name: 'Fatima',
-                src: 'https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg',
-              },
-              {
-                name: 'Sora',
-                src: 'https://i.pinimg.com/originals/ab/c5/4a/abc54abd85df131e90ca6b372368b738.jpg',
-              },
-            ]}
-          />
-          <AvatarGroupCluster
-            collaborators={[
-              {
-                name: 'Fatima',
-                src: 'https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg',
-              },
-              {
-                name: 'Sora',
-                src: 'https://i.pinimg.com/originals/ab/c5/4a/abc54abd85df131e90ca6b372368b738.jpg',
-              },
-              {
-                name: 'Ayesha',
-                src: 'https://i.pinimg.com/originals/c5/5c/ac/c55caca43a7c16766215ec165b649c1c.jpg',
-              },
-            ]}
-          />
-          <AvatarGroupCluster
-            collaborators={[
-              {
-                name: 'Fatima',
-                src: 'https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg',
-              },
-              {
-                name: 'Sora',
-                src: 'https://i.pinimg.com/originals/ab/c5/4a/abc54abd85df131e90ca6b372368b738.jpg',
-              },
-              {
-                name: 'Ayesha',
-                src: 'https://i.pinimg.com/originals/c5/5c/ac/c55caca43a7c16766215ec165b649c1c.jpg',
-              },
-              {
-                name: 'Katie',
-                src: 'https://i.ibb.co/NsK2w5y/Alberto.jpg',
-              },
-            ]}
-          />
-        </Flex>
-      </Box>
+      <DesignTokensProvider>
+        <Box color="default" display="inlineBlock" padding={1}>
+          <Flex alignContent="center" gap={4} height="100%" justifyContent="center" wrap>
+            <AvatarGroupCluster
+              collaborators={[
+                {
+                  name: 'Fatima',
+                  src: 'https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg',
+                },
+                {
+                  name: 'Sora',
+                  src: 'https://i.pinimg.com/originals/ab/c5/4a/abc54abd85df131e90ca6b372368b738.jpg',
+                },
+              ]}
+            />
+            <AvatarGroupCluster
+              collaborators={[
+                {
+                  name: 'Fatima',
+                  src: 'https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg',
+                },
+                {
+                  name: 'Sora',
+                  src: 'https://i.pinimg.com/originals/ab/c5/4a/abc54abd85df131e90ca6b372368b738.jpg',
+                },
+                {
+                  name: 'Ayesha',
+                  src: 'https://i.pinimg.com/originals/c5/5c/ac/c55caca43a7c16766215ec165b649c1c.jpg',
+                },
+              ]}
+            />
+            <AvatarGroupCluster
+              collaborators={[
+                {
+                  name: 'Fatima',
+                  src: 'https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg',
+                },
+                {
+                  name: 'Sora',
+                  src: 'https://i.pinimg.com/originals/ab/c5/4a/abc54abd85df131e90ca6b372368b738.jpg',
+                },
+                {
+                  name: 'Ayesha',
+                  src: 'https://i.pinimg.com/originals/c5/5c/ac/c55caca43a7c16766215ec165b649c1c.jpg',
+                },
+                {
+                  name: 'Katie',
+                  src: 'https://i.ibb.co/NsK2w5y/Alberto.jpg',
+                },
+              ]}
+            />
+          </Flex>
+        </Box>
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

**File**: `docs/pages/visual-test/Badge-dark.tsx` (modified, +21/-19)
```diff
@@ -1,26 +1,28 @@
-import { Badge, Box, ColorSchemeProvider, Flex } from 'gestalt';
+import { Badge, Box, ColorSchemeProvider, DesignTokensProvider, Flex } from 'gestalt';
 
 export default function Snapshot() {
   return (
     <ColorSchemeProvider colorScheme="dark">
-      <Box color="default" padding={1}>
-        <Flex gap={{ row: 4, column: 2 }} width={400} wrap>
-          <Badge text="Success badge" type="success" />
-          <Badge text="Error badge" type="error" />
-          <Badge text="Warning badge" type="warning" />
-          <Badge text="Neutral badge" type="neutral" />
-          <Badge text="LightWash badge" type="lightWash" />
-          <Badge text="DarkWash badge" type="darkWash" />
-          <Badge text="Info badge" />
-          <Badge text="ช่วยพูดอีกครั้งได้ไหม" />
-          <Box display="flex" height={80} justifyContent="center" width={350}>
-            <Badge text="Info badge with tooltip" tooltip={{ text: 'Tooltip' }} />
-          </Box>
-          <Box display="flex" height={80} justifyContent="center" width={350}>
-            <Badge text="ช่วยพูดอีกครั้งได้ไหม" tooltip={{ text: 'ช่วยพูดอีกครั้งได้ไหม' }} />
-          </Box>
-        </Flex>
-      </Box>
+      <DesignTokensProvider>
+        <Box color="default" padding={1}>
+          <Flex gap={{ row: 4, column: 2 }} width={400} wrap>
+            <Badge text="Success badge" type="success" />
+            <Badge text="Error badge" type="error" />
+            <Badge text="Warning badge" type="warning" />
+            <Badge text="Neutral badge" type="neutral" />
+            <Badge text="LightWash badge" type="lightWash" />
+            <Badge text="DarkWash badge" type="darkWash" />
+            <Badge text="Info badge" />
+            <Badge text="ช่วยพูดอีกครั้งได้ไหม" />
+            <Box display="flex" height={80} justifyContent="center" width={350}>
+              <Badge text="Info badge with tooltip" tooltip={{ text: 'Tooltip' }} />
+            </Box>
+            <Box display="flex" height={80} justifyContent="center" width={350}>
+              <Badge text="ช่วยพูดอีกครั้งได้ไหม" tooltip={{ text: 'ช่วยพูดอีกครั้งได้ไหม' }} />
+            </Box>
+          </Flex>
+        </Box>
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

**File**: `docs/pages/visual-test/BannerCallout-dark.tsx` (modified, +49/-47)
```diff
@@ -1,55 +1,57 @@
-import { BannerCallout, Box, ColorSchemeProvider, Flex } from 'gestalt';
+import { BannerCallout, Box, ColorSchemeProvider, DesignTokensProvider, Flex } from 'gestalt';
 
 export default function Snapshot() {
   return (
     <ColorSchemeProvider colorScheme="dark">
-      <Box color="default" display="inlineBlock" padding={1}>
-        <Flex
-          direction="column"
-          gap={{
-            row: 0,
-            column: 2,
-          }}
-        >
-          <BannerCallout
-            dismissButton={{
-              accessibilityLabel: 'Dismiss this banner',
-              onDismiss: () => {},
+      <DesignTokensProvider>
+        <Box color="default" display="inlineBlock" padding={1}>
+          <Flex
+            direction="column"
+            gap={{
+              row: 0,
+              column: 2,
             }}
-            iconAccessibilityLabel="Info"
-            message="Apply to the Verified Merchant Program"
-            primaryAction={{
-              accessibilityLabel: 'Get started: Verified Merchant Program',
-              href: 'https://pinterest.com',
-              label: 'Get started',
-              target: 'blank',
-              role: 'link',
-            }}
-            secondaryAction={{
-              accessibilityLabel: 'Learn more: Verified Merchant Program',
-              href: 'https://pinterest.com',
-              label: 'Learn more',
-              target: 'blank',
-              role: 'link',
-            }}
-            title="Your business account was created!"
-            type="info"
-          />
-          <BannerCallout
-            iconAccessibilityLabel="Error"
-            message="Your tag has errors, so information may be outdated. Fix your tag for the most accurate metrics."
-            primaryAction={{
-              accessibilityLabel: 'Fix Pinterest tag',
-              href: 'https://pinterest.com',
-              label: 'Fix tag',
-              target: 'blank',
-              role: 'link',
-            }}
-            title="Pinterest tag needs attention"
-            type="error"
-          />
-        </Flex>
-      </Box>
+          >
+            <BannerCallout
+              dismissButton={{
+                accessibilityLabel: 'Dismiss this banner',
+                onDismiss: () => {},
+              }}
+              iconAccessibilityLabel="Info"
+              message="Apply to the Verified Merchant Program"
+              primaryAction={{
+                accessibilityLabel: 'Get started: Verified Merchant Program',
+                href: 'https://pinterest.com',
+                label: 'Get started',
+                target: 'blank',
+                role: 'link',
+              }}
+              secondaryAction={{
+                accessibilityLabel: 'Learn more: Verified Merchant Program',
+                href: 'https://pinterest.com',
+                label: 'Learn more',
+                target: 'blank',
+                role: 'link',
+              }}
+              title="Your business account was created!"
+              type="info"
+            />
+            <BannerCallout
+              iconAccessibilityLabel="Error"
+              message="Your tag has errors, so information may be outdated. Fix your tag for the most accurate metrics."
+              primaryAction={{
+                accessibilityLabel: 'Fix Pinterest tag',
+                href: 'https://pinterest.com',
+                label: 'Fix tag',
+                target: 'blank',
+                role: 'link',
+              }}
+              title="Pinterest tag needs attention"
+              type="error"
+            />
+          </Flex>
+        </Box>
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

---

### Incident Patch 8: `2a389c7d` (2025-03-27)
**Commit Message**: Masonry: Fix the props on Masonry V2 (#4052)

**File**: `packages/gestalt/src/MasonryV2.tsx` (modified, +6/-0)
```diff
@@ -176,6 +176,10 @@ type Props<T> = {
    * This is an experimental prop and may be removed or changed in the future
    */
   _earlyBailout?: (columnSpan: number) => number;
+  /**
+   * Experimental flag to enable new multi column position layout algorithm
+   */
+  _multiColPositionAlgoV2?: boolean;
 };
 
 type MasonryRef = {
@@ -674,6 +678,7 @@ function Masonry<T>(
     _dynamicHeights,
     _dynamicHeightsV2Experiment,
     _earlyBailout,
+    _multiColPositionAlgoV2,
   }: Props<T>,
   ref:
     | {
@@ -826,6 +831,7 @@ function Masonry<T>(
     _getColumnSpanConfig,
     _getResponsiveModuleConfigForSecondItem,
     _earlyBailout,
+    _multiColPositionAlgoV2,
   });
   useEffect(() => {
     maxHeightRef.current = height;
```

---

### Incident Patch 9: `efc68546` (2025-03-26)
**Commit Message**: SearchGuide: (mWeb) update color variant "11" to match figma in dark mode (#4050)

**File**: `packages/gestalt-design-tokens/tokens/vr-theme-web-mapping/comp-web-color-dark.json` (modified, +1/-1)
```diff
@@ -398,7 +398,7 @@
             "value": "{base.color.purple.500.value}"
           },
           "11": {
-            "value": "{base.color.grayscale.500.value}"
+            "value": "{base.color.grayscale.250.value}"
           }
         },
         "hover": {
```

**File**: `packages/gestalt/src/contexts/__snapshots__/ColorSchemeProvider.jsdom.test.tsx.snap` (modified, +1/-1)
```diff
@@ -3466,7 +3466,7 @@ exports[`visual refresh tokens uses visual refresh dark mode theme when specifie
   --color-background-popover-primary: #2e2e2d;
   --color-background-popover-education: #7cbede;
   --color-background-searchguide-default-10: #6d4270;
-  --color-background-searchguide-default-11: #000000;
+  --color-background-searchguide-default-11: #757570;
   --color-background-searchguide-default-01: #007db8;
   --color-background-searchguide-default-02: #517d3b;
   --color-background-searchguide-default-03: #f06d22;
```

---

### Incident Patch 10: `1470d23e` (2025-03-24)
**Commit Message**: Masonry: Fix scroll position glitch on load (#4045)

**File**: `packages/gestalt/src/Masonry.tsx` (modified, +4/-1)
```diff
@@ -296,6 +296,8 @@ export default class Masonry<T> extends ReactComponent<Props<T>, State<T>> {
 
   scrollContainer: ScrollContainer | null | undefined;
 
+  maxHeight: number = 0;
+
   /**
    * Delays resize handling in case the scroll container is still being resized.
    */
@@ -691,8 +693,9 @@ export default class Masonry<T> extends ReactComponent<Props<T>, State<T>> {
       const measuringPositions = getPositions(itemsToMeasure);
       // Math.max() === -Infinity when there are no positions
       const height = positions.length
-        ? Math.max(...positions.map((pos) => pos.top + pos.height))
+        ? Math.max(...positions.map((pos) => pos.top + pos.height), this.maxHeight)
         : 0;
+      if (height > this.maxHeight || !positions.length) this.maxHeight = height;
 
       gridBody = (
         <div ref={this.setGridWrapperRef} style={{ width: '100%' }}>
```

**File**: `packages/gestalt/src/MasonryV2.tsx` (modified, +12/-1)
```diff
@@ -381,6 +381,7 @@ function useLayout<T>({
   minCols,
   positionStore,
   width,
+  maxHeight,
   heightUpdateTrigger,
   _logTwoColWhitespace,
   _measureAll,
@@ -398,6 +399,7 @@ function useLayout<T>({
   minCols: number;
   positionStore: Cache<T, Position>;
   width: number | null | undefined;
+  maxHeight: number;
   heightUpdateTrigger: number;
   _logTwoColWhitespace?: (
     additionalWhitespace: ReadonlyArray<number>,
@@ -505,7 +507,10 @@ function useLayout<T>({
 
   // Math.max() === -Infinity when there are no positions
   const height = positions.length
-    ? Math.max(...positions.map((pos) => (pos && pos.top >= 0 ? pos.top + pos.height : 0)))
+    ? Math.max(
+        ...positions.map((pos) => (pos && pos.top >= 0 ? pos.top + pos.height : 0)),
+        maxHeight,
+      )
     : 0;
 
   return {
@@ -798,6 +803,8 @@ function Masonry<T>(
     ],
   );
 
+  const maxHeightRef = useRef(0);
+
   const { hasPendingMeasurements, height, positions, updateMeasurement } = useLayout<T>({
     align,
     columnWidth,
@@ -808,6 +815,7 @@ function Masonry<T>(
     minCols,
     positionStore,
     width,
+    maxHeight: maxHeightRef.current,
     heightUpdateTrigger,
     _logTwoColWhitespace,
     _measureAll,
@@ -816,6 +824,9 @@ function Masonry<T>(
     _getResponsiveModuleConfigForSecondItem,
     _earlyBailout,
   });
+  useEffect(() => {
+    maxHeightRef.current = height;
+  }, [height]);
 
   useFetchOnScroll({
     containerHeight,
```

---

### Incident Patch 11: `3cae45f5` (2025-03-21)
**Commit Message**: SearchField: fix rtl in VR bug (#4047)

**File**: `packages/gestalt/src/SearchField/VRSearchField.css` (modified, +3/-3)
```diff
@@ -116,7 +116,7 @@
 }
 
 html[dir="rtl"] .md_inputStartPadding {
-  padding-left: calc(
+  padding-right: calc(
     var(--sema-space-300) + var(--sema-space-200) + var(--sema-space-400) -
       var(--sema-space-25)
   );
@@ -190,7 +190,7 @@ html:not([dir="rtl"]) .md_endClearButtonWrapper {
   right: calc(var(--sema-space-300) - var(--sema-space-150));
 }
 
-html[dir="rtl"] .md_ClearButtonWrapper {
+html[dir="rtl"] .md_endClearButtonWrapper {
   left: calc(var(--sema-space-300) - var(--sema-space-150));
 }
 
@@ -298,6 +298,6 @@ html:not([dir="rtl"]) .lg_endClearButtonWrapper {
   right: calc(var(--sema-space-400) - var(--sema-space-150));
 }
 
-html[dir="rtl"] .lg_ClearButtonWrapper {
+html[dir="rtl"] .lg_endClearButtonWrapper {
   left: calc(var(--sema-space-400) - var(--sema-space-150));
 }
```

---

### Incident Patch 12: `68fcd7ac` (2025-03-19)
**Commit Message**: RadioGroup: fix in CSS file for width (#4046)

**File**: `packages/gestalt/src/RadioGroupButton.css` (modified, +2/-2)
```diff
@@ -41,11 +41,11 @@
 }
 
 .BorderCheckedSm {
-  border-width: "6px";
+  border-width: 6px;
 }
 
 .BorderCheckedMd {
-  border-width: "8px";
+  border-width: 8px;
 }
 
 .BorderSelected {
```

---

### Incident Patch 13: `f4446ccb` (2025-03-19)
**Commit Message**: Internal: [Snyk] Security upgrade react-cookie from 4.1.1 to 8.0.1 (#4044)

Co-authored-by: snyk-bot <[REDACTED_EMAIL]>

**File**: `docs/package.json` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
     "next": "^12.3.0",
     "next-mdx-remote": "^4.0.2",
     "react": "^18.1.0",
-    "react-cookie": "^4.1.1",
+    "react-cookie": "^8.0.1",
     "react-dom": "^18.1.0",
     "react-live": "^3.0.0",
     "remark-breaks": "^3.0.2",
```

#### Recent Merged Pull Requests:
- **PR #4109** (2026-08-06): Docs: Remove Google Analytics [SUB-14846] (@SandroAugusto)
- **PR #4101** (2026-01-07): Docs: Add DocSearch transformData prop (@Tlcardoso2)
- **PR #4100** (2025-12-09): Docs: Update Banner component styling with design tokens (@kostya-gromov)
- **PR #4099** (closed): Bump node-forge from 1.3.1 to 1.3.2 (@dependabot[bot])
- **PR #4098** (2025-11-22): Docs: GlobalEventsHandlerProvider work around (@jroeckle)
- **PR #4097** (2025-11-21): Docs: Remove root to home redirect (@jroeckle)
- **PR #4096** (closed): Docs: Enabled legacy banner content [UXE-229] (@jroeckle)
- **PR #4095** (2025-11-21): Docs: Re-enable legacy banner button for Gestalt 2.0 [UXE-229] (@rondevera)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
