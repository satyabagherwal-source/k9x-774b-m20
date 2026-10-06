# Forensic Learning Record (Deep Inspection): react-component/slider

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-component-slider-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-component/slider](https://github.com/react-component/slider))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:51:16.587Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-component/slider`
- **Description**: 🎚️ Accessible React slider for single values, ranges, marks, and editable handles.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3083 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/hooks/useDisabled.ts`
```
import * as React from 'react';

const useDisabled = (
  rawDisabled: boolean | boolean[],
): [
  isHandleDisabled: (index: number) => boolean,
  getDisabledState: (rawValues: number[]) => [disabled: boolean, hasDisabledHandle: boolean],
] => {
  const isHandleDisabled = React.useCallback(
    (index: number) => {
      if (typeof rawDisabled === 'boolean') {
        return rawDisabled;
      }

      return rawDisabled[index] ?? false;
    },
    [rawDisabled],
  );

  const getDisabledState = React.useCallback(
    (rawValues: number[]): [disabled: boolean, hasDisabledHandle: boolean] => {
      if (typeof rawDisabled === 'boolean') {
        return [rawDisabled, rawDisabled && rawValues.length > 0];
      }

      return [
        rawValues.length > 0 && rawValues.every((_, index) => isHandleDisabled(index)),
        rawValues.some((_, index) => isHandleDisabled(index)),
      ];
    },
    [rawDisabled, isHandleDisabled],
  );

  return React.useMemo(() => [isHandleDisabled, getDisabledState], [
    isHandleDisabled,
    getDisabledState,
  ]);
};

export default useDisabled;

```

### Core Architecture Module: `src/hooks/useDrag.ts`
```
import * as React from 'react';
import { useEvent, useLayoutEffect } from '@rc-component/util';
import { UnstableContext } from '../context';
import type { Direction, OnStartMove } from '../interface';
import type { OffsetValues } from './useOffset';

/** Drag to delete offset. It's a user experience number for dragging out */
const REMOVE_DIST = 130;

function getPosition(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) {
  const obj = 'targetTouches' in e ? e.targetTouches[0] : e;

  return { pageX: obj.pageX, pageY: obj.pageY };
}

function useDrag(
  containerRef: React.RefObject<HTMLDivElement | null>,
  direction: Direction,
  rawValues: number[],
  min: number,
  max: number,
  formatValue: (value: number) => number,
  triggerChange: (values: number[]) => void,
  finishChange: (draggingDelete: boolean) => void,
  offsetValues: OffsetValues,
  editable: boolean,
  minCount: number,
  isHandleDisabled: (index: number) => boolean,
): [
  draggingIndex: number,
  draggingValue: number,
  draggingDelete: boolean,
  returnValues: number[],
  onStartMove: OnStartMove,
] {
  const [draggingValue, setDraggingValue] = React.useState<number>(null!);
  const [draggingIndex, setDraggingIndex] = React.useState(-1);
  const [draggingDelete, setDraggingDelete] = React.useState(false);
  const [cacheValues, setCacheValues] = React.useState(rawValues);
  const [originValues, setOriginValues] = React.useState(rawValues);

  const mouseMoveEventRef = React.useRef<EventListener | null>(null);
  const mouseUpEventRef = React.useRef<EventListener | null>(null);
  const touchEventTargetRef = React.useRef<EventTarget | null>(null);

  const { onDragStart, onDragChange } = React.useContext(UnstableContext);

  useLayoutEffect(() => {
    if (draggingIndex === -1) {
      setCacheValues(rawValues);
    }
  }, [rawValues, draggingIndex]);

  // Clean up event
  React.useEffect(
    () => () => {
      if (mouseMoveEventRef.current) {
        document.removeEventListener('mousemove', mouseMoveEventRef.current);
      }
      if (mouseUpEventRef.current) {
        document.removeEventListener('mouseup', mouseUpEventRef.current, true);
      }
      if (touchEventTargetRef.current) {
        if (mouseMoveEventRef.current) {
          touchEventTargetRef.current.removeEventListener('touchmove', mouseMoveEventRef.current);
        }
        if (mouseUpEventRef.current) {
          touchEventTargetRef.current.removeEventListener('touchend', mouseUpEventRef.current);
        }
      }
    },
    [],
  );

  const flushValues = (nextValues: number[], nextValue?: number, deleteMark?: boolean) => {
    // Perf: Only update state when value changed
    if (nextValue !== undefined) {
      setDraggingValue(nextValue);
    }
    setCacheValues(nextValues);

    let changeValues = nextValues;
    if (deleteMark) {
      changeValues = nextValues.filter((_, i) => i !== draggingIndex);
    }
    triggerChange(changeValues);

    // Optional callback for drag change (not used in current implementation)
    if (onDragChange) {
      onDragChange({
        rawValues: nextValues,
        deleteIndex: deleteMark ? draggingIndex : -1,
        draggingIndex,
        draggingValue: nextValue as number,
      });
    }
  };

  const updateCacheValue = useEvent(
    (valueIndex: number, offsetPercent: number, deleteMark: boolean) => {
      if (valueIndex === -1) {
        // >>>> Dragging on the track
        // Defensive: should not happen as Tracks/index.tsx blocks this when any handle is disabled
        if (originValues.some((_, index) => isHandleDisabled(index))) {
          return;
        }

        const startValue = originValues[0];
        const endValue = originValues[originValues.length - 1];
        const maxStartOffset = min - startValue;
        const maxEndOffset = max - endValue;

        // Get valid offset
        let offset = offsetPercent * (max - min);
        offset = Math.max(offset, maxStartOffset);
        offset = Math.min(offset, maxEndOffset);

        // Use first value to revert back of valid offset (like steps marks)
        const formatStartValue = formatValue(startValue + offset);
        offset = formatStartValue - startValue;
        const cloneCacheValues = originValues.map<number>((val) => val + offset);
        flushValues(cloneCacheValues);
      } else {
        // >>>> Dragging on the handle
        const offsetDist = (max - min) * offsetPercent;

        // Always start with the valueIndex origin value
        const cloneValues = [...cacheValues];
        cloneValues[valueIndex] = originValues[valueIndex];

        const next = offsetValues(cloneValues, offsetDist, valueIndex, 'dist');

        flushValues(next.values, next.value, deleteMark);
      }
    },
  );

  const onStartMove: OnStartMove = (e, valueIndex, startValues?: number[]) => {
    e.stopPropagation();

    const initialValues = startValues || rawValues;
    // Defensive: should not happen as Handle.tsx blocks this when handle is disabled
    if (isHandleDisabled(valueIndex)) {
      return;
    }

    const originValue = initialValues[valueIndex];

    setDraggingIndex(valueIndex);
    setDraggingValue(originValue);
    setOriginValues(initialValues);
    setCacheValues(initialValues);
    setDraggingDelete(false);

    const { pageX: startX, pageY: startY } = getPosition(e);

    // We declare it here since closure can't get outer latest value
    let deleteMark = false;

    // Optional callback for drag start (not used in current implementation)
    if (onDragStart) {
      onDragStart({
        rawValues: initialValues,
        draggingIndex: valueIndex,
        draggingValue: originValue,
      });
    }

    // Moving
    const onMouseMove: EventListener = (event) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      event.preventDefault();

      const { pageX: moveX, pageY: moveY } = getPosition(event as MouseEvent | TouchEvent);
      const offsetX = moveX - startX;
      const offsetY = moveY - startY;

      const { width, height } = container.getBoundingClientRect();

      let offSetPercent: number;
      let removeDist: number;

      switch (direction) {
        case 'btt':
          offSetPercent = -offsetY / height;
          removeDist = offsetX;
          break;

        case 'ttb':
          offSetPercent = offsetY / height;
          removeDist = offsetX;
          break;

        case 'rtl':
          offSetPercent = -offsetX / width;
          removeDist = offsetY;
          break;

        default:
          offSetPercent = offsetX / width;
          removeDist = offsetY;
      }

      // Check if need mark remove
      deleteMark = editable
        ? Math.abs(removeDist) > REMOVE_DIST && minCount < cacheValues.length
        : false;
      setDraggingDelete(deleteMark);

      updateCacheValue(valueIndex, offSetPercent, deleteMark);
    };

    // End
    const onMouseUp: EventListener = (event) => {
      if (event.type === 'touchend') {
        event.preventDefault();
      }

      document.removeEventListener('mouseup', onMouseUp, true);
      document.removeEventListener('mousemove', onMouseMove);
      if (touchEventTargetRef.current) {
        if (mouseMoveEventRef.current) {
          touchEventTargetRef.current.removeEventListener('touchmove', mouseMoveEventRef.current);
        }
        if (mouseUpEventRef.current) {
          touchEventTargetRef.current.removeEventListener('touchend', mouseUpEventRef.current);
        }
      }
      mouseMoveEventRef.current = null;
      mouseUpEventRef.current = null;
      touchEventTargetRef.current = null;

      finishChange(deleteMark);

      setDraggingIndex(-1);
      setDraggingDelete(false);
    };

    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('mousemove', onMouseMove);
    e.currentTarget.addEventListener('touchend', onMouseUp);
    e.currentTarget.addEventListener('touchmove', onMouseMove);
    mouseMoveEventRef.current = onMouseMove;
    mouseUpEventRef.current = onMouseUp;
    touchEventTargetRef.current = e.currentTarget;
  };

  // Only return cache value when it mapping with rawValues
  const returnValues = React.useMemo(() => {
    const sourceValues = [...rawValues].sort((a, b) => a - b);
    const targetValues = [...cacheValues].sort((a, b) => a - b);

    const counts: Record<number, number> = {};
    targetValues.forEach((val) => {
      counts[val] = (counts[val] || 0) + 1;
    });
    sourceValues.forEach((val) => {
      counts[val] = (counts[val] || 0) - 1;
    });

    const maxDiffCount = editable ? 1 : 0;
    const diffCount: number = Object.values(counts).reduce(
      (prev, next) => prev + Math.abs(next),
      0,
    );

    return diffCount <= maxDiffCount ? cacheValues : rawValues;
  }, [rawValues, cacheValues, editable]);

  return [draggingIndex, draggingValue, draggingDelete, returnValues, onStartMove];
}

export default useDrag;

```

### Core Architecture Module: `src/hooks/useOffset.ts`
```
import * as React from 'react';
import type { InternalMarkObj } from '../Marks';

/** Format the value in the range of [min, max] */
type FormatRangeValue = (value: number) => number;

/** Format value align with step */
type FormatStepValue = (value: number) => number;

/** Format value align with step & marks */
type FormatValue = (value: number) => number;

type OffsetMode = 'unit' | 'dist';
type IsHandleDisabled = (index: number) => boolean;

type OffsetValue = (
  values: number[],
  offset: number | 'min' | 'max',
  valueIndex: number,
  mode?: OffsetMode,
) => number;

export type OffsetValues = (
  values: number[],
  offset: number | 'min' | 'max',
  valueIndex: number,
  mode?: OffsetMode,
) => {
  value: number;
  values: number[];
};

/**
 * Get the effective moving range for a handle.
 * Disabled handles are treated as fixed anchors, and `pushable` is applied as the gap
 * that enabled handles must keep away from those anchors.
 */
export const getDisabledBoundaryValues = (
  values: number[],
  valueIndex: number,
  min: number,
  max: number,
  pushable: false | number,
  isHandleDisabled: IsHandleDisabled,
): [number, number] => {
  const pushGap = typeof pushable === 'number' ? pushable : 0;
  let minBound = min;
  let maxBound = max;

  for (let i = valueIndex - 1; i >= 0; i -= 1) {
    if (isHandleDisabled(i)) {
      minBound = values[i] + pushGap;
      break;
    }
  }

  for (let i = valueIndex + 1; i < values.length; i += 1) {
    if (isHandleDisabled(i)) {
      maxBound = values[i] - pushGap;
      break;
    }
  }

  return [minBound, maxBound];
};

/**
 * Find the nearest enabled handle that can accept the target value.
 * A handle is only considered when the target value falls inside its disabled-anchor
 * boundaries, so clicking outside an enabled segment becomes a no-op.
 */
export const getClosestEnabledHandleIndex = (
  values: number[],
  targetValue: number,
  min: number,
  max: number,
  pushable: false | number,
  isHandleDisabled: IsHandleDisabled,
) => {
  let closestIndex = -1;
  let closestDist = max - min;

  values.forEach((value, index) => {
    if (isHandleDisabled(index)) {
      return;
    }

    const [minBound, maxBound] = getDisabledBoundaryValues(
      values,
      index,
      min,
      max,
      pushable,
      isHandleDisabled,
    );

    if (minBound <= targetValue && targetValue <= maxBound) {
      const dist = Math.abs(targetValue - value);
      if (dist <= closestDist) {
        closestDist = dist;
        closestIndex = index;
      }
    }
  });

  return closestIndex;
};

export default function useOffset(
  min: number,
  max: number,
  step: number,
  markList: InternalMarkObj[],
  allowCross: boolean,
  pushable: false | number,
  isHandleDisabled: IsHandleDisabled,
): [FormatValue, OffsetValues] {
  const formatRangeValue: FormatRangeValue = React.useCallback(
    (val) => Math.max(min, Math.min(max, val)),
    [min, max],
  );

  const formatStepValue: FormatStepValue = React.useCallback(
    (val) => {
      if (step !== null) {
        const stepValue = min + Math.round((formatRangeValue(val) - min) / step) * step;

        // Cut number in case to be like 0.30000000000000004
        const getDecimal = (num: number) => (String(num).split('.')[1] || '').length;
        const maxDecimal = Math.max(getDecimal(step), getDecimal(max), getDecimal(min));
        const fixedValue = Number(stepValue.toFixed(maxDecimal));

        return min <= fixedValue && fixedValue <= max ? fixedValue : null!;
      }
      return null!;
    },
    [step, min, max, formatRangeValue],
  );

  const formatValue = React.useCallback<FormatValue>(
    (val) => {
      const formatNextValue = formatRangeValue(val);

      // List align values
      const alignValues = markList.map<number>((mark) => mark.value);
      if (step !== null) {
        alignValues.push(formatStepValue(val));
      }

      // min & max
      alignValues.push(min, max);

      // Align with marks
      let closeValue = alignValues[0];
      let closeDist = max - min;

      alignValues.forEach((alignValue) => {
        const dist = Math.abs(formatNextValue - alignValue);
        if (dist <= closeDist) {
          closeValue = alignValue;
          closeDist = dist;
        }
      });

      return closeValue;
    },
    [min, max, markList, step, formatRangeValue, formatStepValue],
  );

  // ========================== Offset ==========================
  // Single Value
  const offsetValue: OffsetValue = (values, offset, valueIndex, mode = 'unit') => {
    if (typeof offset === 'number') {
      let nextValue: number;
      const originValue = values[valueIndex];

      // Only used for `dist` mode
      const targetDistValue = originValue + offset;

      // Compare next step value & mark value which is best match
      let potentialValues: number[] = [];
      markList.forEach((mark) => {
        potentialValues.push(mark.value);
      });

      // Min & Max
      potentialValues.push(min, max);

      // In case origin value is align with mark but not with step
      potentialValues.push(formatStepValue(originValue));

      // Put offset step value also
      const sign = offset > 0 ? 1 : -1;

      if (mode === 'unit') {
        potentialValues.push(formatStepValue(originValue + sign * step));
      } else {
        potentialValues.push(formatStepValue(targetDistValue));
      }

      // Find close one
      potentialValues = potentialValues
        .filter((val) => val !== null)
        // Remove reverse value
        .filter((val) => (offset < 0 ? val <= originValue : val >= originValue));

      if (mode === 'unit') {
        // `unit` mode can not contain itself
        potentialValues = potentialValues.filter((val) => val !== originValue);
      }

      const compareValue = mode === 'unit' ? originValue : targetDistValue;

      nextValue = potentialValues[0];
      let valueDist = Math.abs(nextValue - compareValue);

      potentialValues.forEach((potentialValue) => {
        const dist = Math.abs(potentialValue - compareValue);
        if (dist < valueDist) {
          nextValue = potentialValue;
          valueDist = dist;
        }
      });

      // Out of range will back to range
      if (nextValue === undefined) {
        return offset < 0 ? min : max;
      }

      // `dist` mode
      if (mode === 'dist') {
        return nextValue;
      }

      // `unit` mode may need another round
      if (Math.abs(offset) > 1) {
        const cloneValues = [...values];
        cloneValues[valueIndex] = nextValue;

        return offsetValue(cloneValues, offset - sign, valueIndex, mode);
      }

      return nextValue;
    } else if (offset === 'min') {
      return min;
    } else if (offset === 'max') {
      return max;
    }

    // Unreachable since `offset` is typed as number | 'min' | 'max'.
    return max;
  };

  /** Same as `offsetValue` but return `changed` mark to tell value changed */
  const offsetChangedValue = (
    values: number[],
    offset: number,
    valueIndex: number,
    mode: OffsetMode = 'unit',
  ) => {
    const originValue = values[valueIndex];
    const nextValue = offsetValue(values, offset, valueIndex, mode);
    return {
      value: nextValue,
      changed: nextValue !== originValue,
    };
  };

  const needPush = (startValue: number, endValue: number) => {
    const dist = endValue - startValue;
    // Aligned decimal values can subtract to just below the configured gap.
    const tolerance =
      Number.EPSILON *
      Math.max(Math.abs(startValue), Math.abs(endValue), Math.abs(Number(pushable)));

    return (
      (pushable === null && dist === 0) ||
      (typeof pushable === 'number' && dist < pushable - tolerance)
    );
  };

  // Values
  const offsetValues: OffsetValues = (values, offset, valueIndex, mode = 'unit') => {
    const nextValues = values.map<number>(formatValue);
    const originValue = nextValues[valueIndex];

    const [minBound, maxBound] = getDisabledBoundaryValues(
      nextValues,
      valueIndex,
      min,
      max,
      pushable,
      isHandleDisabled,
    );

    const nextValue = offsetValue(nextValues, offset, valueIndex, mode);
    nextValues[valueIndex] = nextValue;

    if (minBound <= maxBound) {
      nextValues[valueIndex] = Math.max(minBound, Math.min(maxBound, nextValues[valueIndex]));
    } else {
      nextValues[valueIndex] = originValue;
    }

    if (allowCross === false) {
      // >>>>> Allow Cross
      const pushNum = pushable || 0;

      // ============ AllowCross ===============
      if (valueIndex > 0 && nextValues[valueIndex - 1] !== originValue) {
        nextValues[valueIndex] = Math.max(
          nextValues[valueIndex],
          nextValues[valueIndex - 1] + pushNum,
        );
      }

      if (valueIndex < nextValues.length - 1 && nextValues[valueIndex + 1] !== originValue) {
        nextValues[valueIndex] = Math.min(
          nextValues[valueIndex],
          nextValues[valueIndex + 1] - pushNum,
        );
      }
    } else if (typeof pushable === 'number' || pushable === null) {
      // >>>>> Pushable
      // =============== Push ==================

      // >>>>>> Basic push
      // End values
      for (let i = valueIndex + 1; i < nextValues.length; i += 1) {
        if (isHandleDisabled(i)) {
          break;
        }
        let changed = true;
        while (needPush(nextValues[i - 1], nextValues[i]) && changed) {
          ({ value: nextValues[i], changed } = offsetChangedValue(nextValues, 1, i));
        }
        const [, itemMaxBound] = getDisabledBoundaryValues(
          nextValues,
          i,
          min,
          max,
          pushable,
          isHandleDisabled,
        );
        nextValues[i] = Math.min(nextValues[i], itemMaxBound);
      }

      // Start values
      for (let i = valueIndex; i > 0; i -= 1) {
        if (isHandleDisabled(i - 1)) {
          break;
        }
        let changed = true;
        while (needPush(nextVa
```

### Core Architecture Module: `src/hooks/useRange.ts`
```
import { warning } from '@rc-component/util';
import { useMemo } from 'react';
import type { SliderProps } from '../Slider';

export default function useRange(
  range?: SliderProps['range'],
): [
  range: boolean,
  rangeEditable: boolean,
  rangeDraggableTrack: boolean,
  minCount: number,
  maxCount?: number,
] {
  return useMemo(() => {
    if (range === true || !range) {
      return [!!range, false, false, 0];
    }

    const { editable, draggableTrack, minCount, maxCount } = range;

    if (process.env.NODE_ENV !== 'production') {
      warning(!editable || !draggableTrack, '`editable` can not work with `draggableTrack`.');
    }

    return [true, !!editable, !editable && !!draggableTrack, minCount || 0, maxCount];
  }, [range]);
}

```

### Core Architecture Module: `src/util.ts`
```
import type { Direction } from './interface';

export function getOffset(value: number, min: number, max: number) {
  return (value - min) / (max - min);
}

export function getDirectionStyle(direction: Direction, value: number, min: number, max: number) {
  const offset = getOffset(value, min, max);

  const positionStyle: React.CSSProperties = {};

  switch (direction) {
    case 'rtl':
      positionStyle.right = `${offset * 100}%`;
      positionStyle.transform = 'translateX(50%)';
      break;

    case 'btt':
      positionStyle.bottom = `${offset * 100}%`;
      positionStyle.transform = 'translateY(50%)';
      break;

    case 'ttb':
      positionStyle.top = `${offset * 100}%`;
      positionStyle.transform = 'translateY(-50%)';
      break;

    default:
      positionStyle.left = `${offset * 100}%`;
      positionStyle.transform = 'translateX(-50%)';
      break;
  }

  return positionStyle;
}

/** Return index value if is list or return value directly */
export function getIndex<T>(value: T | T[], index: number) {
  return Array.isArray(value) ? value[index] : value;
}

```

### Core Architecture Module: `.dumirc.ts`
```
import { defineConfig } from 'dumi';
import path from 'path';

const basePath = process.env.GH_PAGES ? '/slider/' : '/';
const publicPath = basePath;

export default defineConfig({
  alias: {
    '@rc-component/slider$': path.resolve('src'),
    '@rc-component/slider/es': path.resolve('src'),
    '@rc-component/slider/assets': path.resolve('assets'),
  },
  mfsu: false,
  favicons: ['https://avatars0.githubusercontent.com/u/9441414?s=200&v=4'],
  themeConfig: {
    name: 'Slider',
    logo: 'https://avatars0.githubusercontent.com/u/9441414?s=200&v=4',
  },
  outputPath: 'docs-dist',
  base: basePath,
  publicPath,
  styles: [``],
});

```

### Core Architecture Module: `.fatherrc.js`
```
import { defineConfig } from 'father';

export default defineConfig({
  plugins: ['@rc-component/father-plugin'],
});
```

### Core Architecture Module: `.fatherrc.ts`
```
import { defineConfig } from 'father';

export default defineConfig({
  plugins: ['@rc-component/father-plugin'],
});

```

### Core Architecture Module: `eslint.config.mjs`
```
import js from '@eslint/js';
import { fixupConfigRules } from '@eslint/compat';
import { defineConfig } from 'eslint/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'eslint-config-prettier';
import jest from 'eslint-plugin-jest';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
  },
  {
    ignores: [
      'node_modules/',
      'coverage/',
      'es/',
      'lib/',
      'dist/',
      'docs-dist/',
      '.docs-dist/',
      '**/.umi/',
      '.dumi/',
      '.doc/',
      '.vercel/',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...fixupConfigRules(react.configs.flat.recommended),
      ...fixupConfigRules(react.configs.flat['jsx-runtime']),
      prettier,
    ],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'no-async-promise-executor': 'off',
      'no-empty-pattern': 'off',
      'no-irregular-whitespace': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'off',
      'no-extra-boolean-cast': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'react/no-find-dom-node': 'off',
      'react/display-name': 'off',
      'react/no-unknown-property': 'off',
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unnecessary-type-constraint': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
  },
  {
    files: ['tests/**/*.{js,jsx,ts,tsx}', '**/*.{test,spec}.{js,jsx,ts,tsx}'],
    extends: [jest.configs['flat/recommended']],
    rules: {
      'jest/no-disabled-tests': 'off',
      'jest/no-done-callback': 'off',
      'jest/no-identical-title': 'off',
      'jest/expect-expect': 'off',
      'jest/no-alias-methods': 'off',
      'jest/no-conditional-expect': 'off',
      'jest/no-export': 'off',
      'jest/no-standalone-expect': 'off',
      'jest/valid-expect': 'off',
      'jest/valid-title': 'off',
    },
  },
]);

```

### Core Architecture Module: `global.d.ts`
```
/// <reference types="jest" />
/// <reference types="node" />
/// <reference types="react" />
/// <reference types="react-dom" />
/// <reference types="@testing-library/jest-dom" />

declare module '*.css';
declare module '*.less';
declare module 'jsonp';


declare module 'moment/locale/zh-cn';

```

### Core Architecture Module: `index.js`
```
module.exports = require('./src/');

```

### Core Architecture Module: `jest.config.js`
```
module.exports = {
  setupFiles: ["./tests/setup.js"],
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #693** (2020-10-30): **Tooltip does not follow handle**
  *Symptoms*: In the current [demos](http://react-component.github.io/slider/?path=/story/rc-slider--slider) the tooltips do not follow the handle movement--dragging the handle does not drag the tooltip:    ![handle](https://user-images.githubusercontent.com/4801116/95146605-4024e200-074c-11eb-9214-e696de24e01e.png)  In earlier versions of this repo, the tooltips did follow handle movement--have the default settings changed? Is there a way to ensure the tooltips stay with the handles?
  **Post-Mortem & Fix Analysis**:
  > @duhaime Which version is correct?
  > I last used this project on `^8.5.0`, and I know the tooltip was great then, but that's likely not much help.   I wish I had time to help figure out this hitch but I'm under a deadline so I switched to MaterialUI. Long live `rc-slider`!

- **Issue #348** (2017-10-26): **tooltip do not hide while mouse leave**
  *Symptoms*: after I drag the slider, the tooltip don't hide, this issue is also happened on your demo:  [http://react-component.github.io/slider/examples/handle.html](http://react-component.github.io/slider/examples/handle.html)  chorme version:  61.0.3163.100
  **Post-Mortem & Fix Analysis**:
  > Works fine in my osx chrome 61.  Please notice that the tooltip will hide after you cursor leave slider.
  > @a1528zhang  Sorry, i confirmed it's a bug which introduced in https://github.com/react-component/slider/pull/306,  and it's been fixed by https://github.com/react-component/slider/commit/18d4fa33319618795f7c9cbe5045dc0d0ed33299. Please reinstall your node_modules.  cc @Robin-front 

- **Issue #347** (2018-03-07): **Controlled Range with allowCross=false has issues**
  *Symptoms*: Here is a demo: https://codepen.io/anon/pen/LzwzEW  Specifically, with 3 ranges or more, when cursor i is moved, cursors from i+2 and beyond are set to the value of i+1. Cursors from i-2 and before are set to i-1 value.  
  **Post-Mortem & Fix Analysis**:
  > @benjycui   Seems  [ensureValueNotConflict](https://github.com/react-component/slider/blob/master/src/Range.jsx#L275) logic is wrong when there is over 3 handle.  Right now it haven't consider about the beeing processed value index in the whole bounds array, which cause all  satisfy `index > curHandle && value > curValue` condition's handle got set to current handle value.  And it may need to handle `pushable` situation at the same time.
  > @paranoidjk  agree. I think I had fixed at #304 , I add `index` to `ensureValueNotConflict`, please check.

- **Issue #339** (2017-10-26): **React 16 ES6 Classes Needs Upgrade**
  *Symptoms*: I am trying to upgrade to React 16, and it seems like rc-slider has a dependency on rc-tooltip, which in turn has the same error as shown in this [issue](https://github.com/react-component/tooltip/issues/106). When rc-tooltip's rc-trigger dependency is upgraded, rc-slider should also be upgrade.
  **Post-Mortem & Fix Analysis**:
  > Fixed in https://github.com/react-component/tooltip/pull/105. Please reinstall your node_modules.

- **Issue #304** (2018-02-27): **Bugfix/keep pushable**
  *Symptoms*: trace: #159  when check the values in `componentWillReceiveProps`  function, you use `map` but no index or Corresponding handle. The handle will be always what you are move.   Then it invoke `ensureValueNotConflict ` function, but `ensureValueNotConflict ` just return prev or next handle value. (I think it should in consideration of `thershold`)  So the gap of pushable not work when [`allowCross=false`](https://github.com/react-component/slider/issues/159#issuecomment-263282912) and [set the value props (to update the display at each state)](https://github.com/react-component/slider/issues/159#issue-181678834)  I just do it. but maybe someone has more elegant code. Many places invoke `trimAlignValue ` func, so it may not `index` and `nextProps` args sometimes.   base issue #159  , after fixed, I make some examples：  all examples I set `pushable={10}` and `allowCross={false}`  ![pushable](https://user-images.githubusercontent.com/6723674/29153527-985a3d58-7dc0-11e7-8457-03ed77122cfc.gif)  ![pushable2](https://user-images.githubusercontent.com/6723674/29153545-a5406506-7dc0-11e7-9f19-e0b76d277ec2.gif)  
  **Post-Mortem & Fix Analysis**:
  >  [![Coverage Status](https://coveralls.io/builds/12772236/badge)](https://coveralls.io/builds/12772236)  Coverage increased (+0.3%) to 62.069% when pulling **dd6c61a67bf835aa2743cebf002b1711764505c9 on Robin-front:bugfix/keep-pushable** into **caf5866a774924dc09a2282bd5b173d2ba33e86c on react-component:master**. 
  > @Robin-front Could you add some test case about the problem you want to fix?
  >  [![Coverage Status](https://coveralls.io/builds/13310905/badge)](https://coveralls.io/builds/13310905)  Coverage increased (+2.05%) to 63.793% when pulling **2f3e18ae8836c087dd9134cb4bb47ab9fdcfc82b on Robin-front:bugfix/keep-pushable** into **caf5866a774924dc09a2282bd5b173d2ba33e86c on react-component:master**. 

- **Issue #286** (2018-03-07): **Clicking outside mark moves handle**
  *Symptoms*:  ![issue with mark](https://user-images.githubusercontent.com/1034890/27273787-efd5578c-5513-11e7-98c0-c074121b94b7.gif)  The mark shouldn't be 90% width. I'll try and come up with another way of positioning it. We just need to set the `left` 

- **Issue #258** (2017-06-09): **Google Chrome: preventDefault inside passive event listener**
  *Symptoms*: Using this component in latest Chrome (mobile device emulation) causes following warning: ``` Unable to preventDefault inside passive event listener due to target being treated as passive. See https://www.chromestatus.com/features/5093566007214080 ```  One of possible solutions is using appropriate [CSS property](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action), which I believe should be either `none` or `pan-x` / `pan-y` depending on orientation;  Please consider these options and I'll send a PR
  **Post-Mortem & Fix Analysis**:
  > Please provide a re-producible demo: http://codepen.io/benjycui/pen/aJooRE?editors=0011
  > I am not familiar with mobile browsers, cc @paranoidjk 
  > @delorge maybe because of chrome 56 break change ? https://github.com/facebook/react/issues/8968

- **Issue #244** (2017-10-25): **Slider gets stuck to mouse**
  *Symptoms*: Hi, Sometimes the slider gets stuck to mouse and the slider just follows the movement of the cursor.  Its hard to reproduce the issue and only way to resolve is to reload the page.
  **Post-Mortem & Fix Analysis**:
  > Please provide a re-producible demo: http://codepen.io/benjycui/pen/aJooRE?editors=0011  And steps to re-produce it..
  > Can confirm it's happening to me as well. Hard to reproduce. It seems it happens at random.
  > @benjycui Steps to reproduce on your codepen link - http://codepen.io/benjycui/pen/aJooRE?editors=0011:  1. Click on handle 2. While holding click, move cursor over codepen JS panel 3. Keep holding click, move cursor to opposite side of page 4. Release click and return to slider window 5. Cursor will be stuck. 6. Click on handle, if it becomes unstuck - repeat step 1 - 5

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

### Incident Patch 1: `93eb24bb` (2026-09-16)
**Commit Message**: fix: ignore generated umi files during compile

**File**: `eslint.config.mjs` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ export default defineConfig([
       'dist/',
       'docs-dist/',
       '.docs-dist/',
+      '**/.umi/',
       '.dumi/',
       '.doc/',
       '.vercel/',
```

---

### Incident Patch 2: `afed329b` (2026-09-16)
**Commit Message**: fix: guard drag movement without container (#1087)

**File**: `src/hooks/useDrag.ts` (modified, +6/-1)
```diff
@@ -168,13 +168,18 @@ function useDrag(
 
     // Moving
     const onMouseMove: EventListener = (event) => {
+      const container = containerRef.current;
+      if (!container) {
+        return;
+      }
+
       event.preventDefault();
 
       const { pageX: moveX, pageY: moveY } = getPosition(event as MouseEvent | TouchEvent);
       const offsetX = moveX - startX;
       const offsetY = moveY - startY;
 
-      const { width, height } = containerRef.current!.getBoundingClientRect();
+      const { width, height } = container.getBoundingClientRect();
 
       let offSetPercent: number;
       let removeDist: number;
```

**File**: `tests/useDrag.test.tsx` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+import { act, createEvent, fireEvent, renderHook } from '@testing-library/react';
+import type React from 'react';
+import useDrag from '../src/hooks/useDrag';
+
+describe('useDrag', () => {
+  it('should ignore mouse movement when the container is no longer available', () => {
+    const containerRef: React.RefObject<HTMLDivElement | null> = {
+      current: document.createElement('div'),
+    };
+    const rawValues = [50];
+    const triggerChange = jest.fn();
+    const finishChange = jest.fn();
+
+    const { result } = renderHook(() =>
+      useDrag(
+        containerRef,
+        'ltr',
+        rawValues,
+        0,
+        100,
+        (value) => value,
+        triggerChange,
+        finishChange,
+        (values, offset, valueIndex) => {
+          const value = values[valueIndex] + Number(offset);
+          return { value, values: [value] };
+        },
+        false,
+        0,
+        () => false,
+      ),
+    );
+
+    const eventTarget = document.createElement('div');
+    act(() => {
+      result.current[4](
+        {
+          currentTarget: eventTarget,
+          pageX: 0,
+          pageY: 0,
+          stopPropagation: jest.fn(),
+        } as unknown as React.MouseEvent,
+        0,
+      );
+    });
+
+    containerRef.current = null;
+    const mouseMove = createEvent.mouseMove(document);
+    Object.defineProperties(mouseMove, {
+      pageX: { value: 20 },
+      pageY: { value: 0 },
+    });
+
+    expect(() => fireEvent(document, mouseMove)).not.toThrow();
+    expect(triggerChange).not.toHaveBeenCalled();
+
+    fireEvent.mouseUp(document);
+    expect(finishChange).toHaveBeenCalledWith(false);
+    expect(finishChange).toHaveBeenCalledTimes(1);
+    expect(result.current[0]).toBe(-1);
+
+    fireEvent.mouseUp(document);
+    expect(finishChange).toHaveBeenCalledTimes(1);
+  });
+});
```

---

### Incident Patch 3: `792f28c1` (2026-09-16)
**Commit Message**: fix: preserve pushable gaps on track clicks (#1092)

**File**: `src/Slider.tsx` (modified, +21/-2)
```diff
@@ -401,15 +401,34 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
       });
 
       let focusIndex: number;
+      let valueOffset = 0;
 
-      if (effectiveRangeEditable && valueDist !== 0 && (!maxCount || rawValues.length < maxCount)) {
+      if (!rawValues.length) {
+        cloneNextValues.push(newValue);
+        focusIndex = 0;
+      } else if (
+        effectiveRangeEditable &&
+        valueDist !== 0 &&
+        (!maxCount || rawValues.length < maxCount)
+      ) {
         cloneNextValues.splice(valueBeforeIndex + 1, 0, newValue);
         focusIndex = valueBeforeIndex + 1;
       } else {
-        cloneNextValues[valueIndex] = newValue;
+        valueOffset = newValue - rawValues[valueIndex];
         focusIndex = valueIndex;
       }
 
+      if (rawValues.length) {
+        // Keep track clicks consistent with drag and keyboard constraints.
+        const { values: nextValues } = offsetValues(
+          cloneNextValues,
+          valueOffset,
+          focusIndex,
+          'dist',
+        );
+        cloneNextValues.splice(0, cloneNextValues.length, ...nextValues);
+      }
+
       // Fill value to match default 2 (only when `rawValues` is empty)
       if (rangeEnabled && !rawValues.length && count === undefined) {
         cloneNextValues.push(newValue);
```

**File**: `tests/Range.test.tsx` (modified, +29/-0)
```diff
@@ -898,6 +898,35 @@ describe('Range', () => {
     });
   });
 
+  it('keeps pushable when clicking the track', () => {
+    const onChange = jest.fn();
+    const { container } = render(
+      <Slider range defaultValue={[20, 40]} pushable={20} onChange={onChange} />,
+    );
+
+    doMouseDown(container, 30, 'rc-slider', true);
+    fireEvent.mouseUp(document);
+
+    expect(onChange).toHaveBeenLastCalledWith([10, 30]);
+  });
+
+  it('keeps pushable when inserting an editable handle', () => {
+    const onChange = jest.fn();
+    const { container } = render(
+      <Slider
+        range={{ editable: true }}
+        defaultValue={[20, 40]}
+        pushable={20}
+        onChange={onChange}
+      />,
+    );
+
+    doMouseDown(container, 30, 'rc-slider', true);
+    fireEvent.mouseUp(document);
+
+    expect(onChange).toHaveBeenLastCalledWith([10, 30, 50]);
+  });
+
   describe('disabled as array', () => {
     const getHandle = (container: HTMLElement, index = 0) =>
       container.getElementsByClassName('rc-slider-handle')[index] as HTMLElement;
```

---

### Incident Patch 4: `b93b016f` (2026-09-16)
**Commit Message**: fix: preserve decimal pushable gaps (#1091)

* fix: preserve decimal pushable gaps

* test: keep push tolerance coverage focused

* test: keep decimal pushable patch fully covered

**File**: `src/hooks/useOffset.ts` (modified, +15/-6)
```diff
@@ -266,8 +266,17 @@ export default function useOffset(
     };
   };
 
-  const needPush = (dist: number) => {
-    return (pushable === null && dist === 0) || (typeof pushable === 'number' && dist < pushable);
+  const needPush = (startValue: number, endValue: number) => {
+    const dist = endValue - startValue;
+    // Aligned decimal values can subtract to just below the configured gap.
+    const tolerance =
+      Number.EPSILON *
+      Math.max(Math.abs(startValue), Math.abs(endValue), Math.abs(Number(pushable)));
+
+    return (
+      (pushable === null && dist === 0) ||
+      (typeof pushable === 'number' && dist < pushable - tolerance)
+    );
   };
 
   // Values
@@ -322,7 +331,7 @@ export default function useOffset(
           break;
         }
         let changed = true;
-        while (needPush(nextValues[i] - nextValues[i - 1]) && changed) {
+        while (needPush(nextValues[i - 1], nextValues[i]) && changed) {
           ({ value: nextValues[i], changed } = offsetChangedValue(nextValues, 1, i));
         }
         const [, itemMaxBound] = getDisabledBoundaryValues(
@@ -342,7 +351,7 @@ export default function useOffset(
           break;
         }
         let changed = true;
-        while (needPush(nextValues[i] - nextValues[i - 1]) && changed) {
+        while (needPush(nextValues[i - 1], nextValues[i]) && changed) {
           ({ value: nextValues[i - 1], changed } = offsetChangedValue(nextValues, -1, i - 1));
         }
         const [itemMinBound] = getDisabledBoundaryValues(
@@ -363,7 +372,7 @@ export default function useOffset(
           continue;
         }
         let changed = true;
-        while (needPush(nextValues[i] - nextValues[i - 1]) && changed) {
+        while (needPush(nextValues[i - 1], nextValues[i]) && changed) {
           ({ value: nextValues[i - 1], changed } = offsetChangedValue(nextValues, -1, i - 1));
         }
         const [itemMinBound] = getDisabledBoundaryValues(
@@ -383,7 +392,7 @@ export default function useOffset(
           continue;
         }
         let changed = true;
-        while (needPush(nextValues[i + 1] - nextValues[i]) && changed) {
+        while (needPush(nextValues[i], nextValues[i + 1]) && changed) {
           ({ value: nextValues[i + 1], changed } = offsetChangedValue(nextValues, 1, i + 1));
         }
         const [, itemMaxBound] = getDisabledBoundaryValues(
```

**File**: `tests/Range.test.tsx` (modified, +22/-0)
```diff
@@ -348,6 +348,28 @@ describe('Range', () => {
     expect(onChange).toHaveBeenCalledWith([0, 90, 100]);
   });
 
+  it('pushes decimal handles in both directions', () => {
+    const onChange = jest.fn();
+    const { container } = render(
+      <Slider
+        range
+        min={0}
+        max={1}
+        step={0.1}
+        pushable={0.1}
+        defaultValue={[0.5, 0.6, 0.7]}
+        onChange={onChange}
+      />,
+    );
+    doMouseMove(container, 50, 60, 'rc-slider-handle', 0);
+    fireEvent.mouseUp(document);
+    expect(onChange).toHaveBeenLastCalledWith([0.6, 0.7, 0.8]);
+
+    doMouseMove(container, 80, 70, 'rc-slider-handle', 2);
+    fireEvent.mouseUp(document);
+    expect(onChange).toHaveBeenLastCalledWith([0.5, 0.6, 0.7]);
+  });
+
   describe('should render correctly when allowCross', () => {
     function testLTR(name, func) {
       it(name, () => {
```

---

### Incident Patch 5: `17c3e13e` (2026-09-16)
**Commit Message**: fix: finish drag when mouseup propagation stops (#1089)

* fix: finish drag when mouseup propagation stops

* fix: preserve mouseup default behavior

* test: cover touch drag completion

---------

Co-authored-by: Amumu <[REDACTED_EMAIL]>

**File**: `src/hooks/useDrag.ts` (modified, +6/-4)
```diff
@@ -58,7 +58,7 @@ function useDrag(
         document.removeEventListener('mousemove', mouseMoveEventRef.current);
       }
       if (mouseUpEventRef.current) {
-        document.removeEventListener('mouseup', mouseUpEventRef.current);
+        document.removeEventListener('mouseup', mouseUpEventRef.current, true);
       }
       if (touchEventTargetRef.current) {
         if (mouseMoveEventRef.current) {
@@ -211,9 +211,11 @@ function useDrag(
 
     // End
     const onMouseUp: EventListener = (event) => {
-      event.preventDefault();
+      if (event.type === 'touchend') {
+        event.preventDefault();
+      }
 
-      document.removeEventListener('mouseup', onMouseUp);
+      document.removeEventListener('mouseup', onMouseUp, true);
       document.removeEventListener('mousemove', onMouseMove);
       if (touchEventTargetRef.current) {
         if (mouseMoveEventRef.current) {
@@ -233,7 +235,7 @@ function useDrag(
       setDraggingDelete(false);
     };
 
-    document.addEventListener('mouseup', onMouseUp);
+    document.addEventListener('mouseup', onMouseUp, true);
     document.addEventListener('mousemove', onMouseMove);
     e.currentTarget.addEventListener('touchend', onMouseUp);
     e.currentTarget.addEventListener('touchmove', onMouseMove);
```

**File**: `tests/Range.test.tsx` (modified, +79/-13)
```diff
@@ -94,6 +94,28 @@ describe('Range', () => {
     fireEvent(container.getElementsByClassName(element)[0], touchMove);
   }
 
+  it('prevents the native default action when a touch drag ends', () => {
+    const onChangeComplete = jest.fn();
+    const { container } = render(
+      <Slider range defaultValue={[20, 40]} onChangeComplete={onChangeComplete} />,
+    );
+    const handle = container.getElementsByClassName('rc-slider-handle')[0];
+    const touchStart = createEvent.touchStart(handle, {
+      touches: [{}],
+      targetTouches: [{}],
+    });
+    (touchStart as any).targetTouches[0].pageX = 20;
+    fireEvent(handle, touchStart);
+
+    const touchEnd = createEvent.touchEnd(handle);
+    const preventDefault = jest.fn();
+    Object.defineProperty(touchEnd, 'preventDefault', { value: preventDefault });
+    fireEvent(handle, touchEnd);
+
+    expect(preventDefault).toHaveBeenCalledTimes(1);
+    expect(onChangeComplete).toHaveBeenCalledWith([20, 40]);
+  });
+
   it('should render Range with correct DOM structure', () => {
     const { asFragment } = render(<Slider range />);
     expect(asFragment().firstChild).toMatchSnapshot();
@@ -140,9 +162,7 @@ describe('Range', () => {
   });
 
   it('should render Range without tabIndex (equal null) correctly', () => {
-    const { container } = render(
-      <Slider range tabIndex={[null, null] as any} />,
-    );
+    const { container } = render(<Slider range tabIndex={[null, null] as any} />);
     expect(container.getElementsByClassName('rc-slider-handle')[0]).not.toHaveAttribute('tabIndex');
     expect(container.getElementsByClassName('rc-slider-handle')[1]).not.toHaveAttribute('tabIndex');
   });
@@ -872,7 +892,12 @@ describe('Range', () => {
     it('respects handle disabled state and boolean disabled fallback', () => {
       const onChange = jest.fn();
       const { container, rerender } = render(
-        <Slider range defaultValue={[0, 50, 100]} disabled={[true, false, true]} onChange={onChange} />,
+        <Slider
+          range
+          defaultValue={[0, 50, 100]}
+          disabled={[true, false, true]}
+          onChange={onChange}
+        />,
       );
 
       const disabledHandle = getHandle(container, 0);
@@ -909,17 +934,23 @@ describe('Range', () => {
       expect(onChange).toHaveBeenCalledWith([0, 10, 100]);
 
       onChange.mockClear();
-      rerender(<Slider range value={[20, 50, 80]} disabled={[true, false, false]} onChange={onChange} />);
+      rerender(
+        <Slider range value={[20, 50, 80]} disabled={[true, false, false]} onChange={onChange} />,
+      );
       doMouseDown(container, 10, 'rc-slider', true);
       fireEvent.mouseUp(document);
       expect(onChange).not.toHaveBeenCalled();
 
-      rerender(<Slider range value={[20, 50, 80]} disabled={[false, false, true]} onChange={onChange} />);
+      rerender(
+        <Slider range value={[20, 50, 80]} disabled={[false, false, true]} onChange={onChange} />,
+      );
       doMouseDown(container, 90, 'rc-slider', true);
       fireEvent.mouseUp(document);
       expect(onChange).not.toHaveBeenCalled();
 
-      rerender(<Slider range value={[0, 50, 100]} disabled={[true, true, true]} onChange={onChange} />);
+      rerender(
+        <Slider range value={[0, 50, 100]} disabled={[true, true, true]} onChange={onChange} />,
+      );
       doMouseDown(container, 10, 'rc-slider', true);
       fireEvent.mouseUp(document);
       expect(onChange).not.toHaveBeenCalled();
@@ -963,7 +994,12 @@ describe('Range', () => {
     it('disables draggableTrack only when rendered handles are disabled', () => {
       const onChange = jest.fn();
       const { container, unmount } = render(
-        <Slider range={{ draggableTrack: true }} defaultValue={[0, 50]} disabled={[false, true]} onChange={onChange} />,
+        <Slider
+          range={{ draggableTrack: true }}
+          defaultValue={[0, 50]}
+          disabled={[false, true]}
+          onChange={onChange}
+        />,
       );
 
       const track = container.getElementsByClassName('rc-slider-track')[0];
@@ -1002,7 +1038,12 @@ describe('Range', () => {
     it('keeps keyboard movement inside disabled handle boundaries', () => {
       const onChange = jest.fn();
       const { container, unmount } = render(
-        <Slider range defaultValue={[20, 50, 80]} disabled={[false, true, false]} onChange={onChange} />,
+        <Slider
+          range
+          defaultValue={[20, 50, 80]}
+          disabled={[false, true, false]}
+          onChange={onChange}
+        />,
       );
 
       repeatKeyDown(getHandle(container, 0), keyCode.RIGHT, 50);
@@ -1012,7 +1053,12 @@ describe('Range', () => {
       onChange.mockClear();
 
       const { container: boundaryContainer } = render(
-        <Slider range defaultValue={[20, 50, 80]} disabled={[true, false, true]} onChange={onChange} />,
+        <Slider
+          range
+          defaultValue={[20, 50, 80]}
+          disabled={[true, false, true]}
+     
```

**File**: `tests/Slider.test.js` (modified, +29/-0)
```diff
@@ -659,6 +659,35 @@ describe('Slider', () => {
     expect(onAfterChange).toHaveBeenCalledWith(20);
   });
 
+  it('should finish dragging when a parent stops mouseup propagation', () => {
+    const onChange = jest.fn();
+    const onChangeComplete = jest.fn();
+    const onParentMouseUp = jest.fn((event) => event.stopPropagation());
+    const { container, getByTestId } = render(
+      <div data-testid="parent" onMouseUp={onParentMouseUp}>
+        <Slider defaultValue={50} onChange={onChange} onChangeComplete={onChangeComplete} />
+      </div>,
+    );
+    const handle = container.querySelector('.rc-slider-handle');
+
+    fireEvent.mouseDown(handle, { pageX: 50 });
+    const firstMove = createEvent.mouseMove(document);
+    firstMove.pageX = 60;
+    fireEvent(document, firstMove);
+    expect(onChange).toHaveBeenCalled();
+    const lastDraggedValue = onChange.mock.calls[onChange.mock.calls.length - 1][0];
+
+    onChange.mockClear();
+    fireEvent.mouseUp(getByTestId('parent'));
+    expect(onParentMouseUp.mock.calls[0][0].defaultPrevented).toBe(false);
+    expect(onChangeComplete).toHaveBeenCalledWith(lastDraggedValue);
+
+    const moveAfterRelease = createEvent.mouseMove(document);
+    moveAfterRelease.pageX = 70;
+    fireEvent(document, moveAfterRelease);
+    expect(onChange).not.toHaveBeenCalled();
+  });
+
   // https://github.com/react-component/slider/pull/948
   it('could drag handler after click tracker', () => {
     const onChange = jest.fn();
```

---

### Incident Patch 6: `0a05f30d` (2026-09-03)
**Commit Message**: refactor: use renderable guard for marks (#1094)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@
     "prepare": "husky"
   },
   "dependencies": {
-    "@rc-component/util": "^1.11.1",
+    "@rc-component/util": "^1.13.0",
     "clsx": "^2.1.1"
   },
   "devDependencies": {
```

**File**: `src/Slider.tsx` (modified, +8/-2)
```diff
@@ -1,4 +1,10 @@
-import { isEqual, useControlledState, useEvent, warning } from '@rc-component/util';
+import {
+  isEqual,
+  isReactRenderable,
+  useControlledState,
+  useEvent,
+  warning,
+} from '@rc-component/util';
 import { clsx } from 'clsx';
 import * as React from 'react';
 import Handles, { type HandlesProps, type HandlesRef } from './Handles';
@@ -234,7 +240,7 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
 
         return markObj;
       })
-      .filter(({ label }) => label || typeof label === 'number')
+      .filter(({ label }) => isReactRenderable(label))
       .sort((a, b) => a.value - b.value);
   }, [marks]);
 
```

---

### Incident Patch 7: `9982e48c` (2026-07-31)
**Commit Message**: ci: fix React Doctor workflow (#1085)

**File**: `.github/workflows/react-doctor.yml` (modified, +1/-1)
```diff
@@ -24,4 +24,4 @@ jobs:
         with:
           fetch-depth: 0
           persist-credentials: false
-      - uses: millionco/react-doctor@0b4f4f4bd248a154e64eb508a48347f71154b3f3
+      - uses: millionco/react-doctor@01820bb4fd4d0a4aebcd8df2b2a143a098649cb2
```

---

### Incident Patch 8: `c455f732` (2026-05-12)
**Commit Message**: fix slider lint issues (#1070)

**File**: `docs/examples/components/TooltipSlider.tsx` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ interface HandleTooltipProps {
 const HandleTooltip: React.FC<HandleTooltipProps> = (props) => {
   const { value, children, visible, tipFormatter = (val) => `${val} %`, ...restProps } = props;
 
-  const tooltipRef = React.useRef<TooltipRef>();
+  const tooltipRef = React.useRef<TooltipRef>(null);
   const rafRef = React.useRef<number | null>(null);
 
   function cancelKeepAlign() {
```

**File**: `docs/examples/slider.tsx` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ class NullableSlider extends React.Component<any, any> {
 }
 
 const NullableRangeSlider = () => {
-  const [value, setValue] = React.useState(null);
+  const [value, setValue] = React.useState<any>(null);
 
   return (
     <div>
```

**File**: `src/Handles/Handle.tsx` (modified, +3/-3)
```diff
@@ -87,7 +87,7 @@ const Handle = React.forwardRef<HTMLDivElement, HandleProps>((props, ref) => {
   // =========================== Keyboard ===========================
   const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
     if (!disabled && keyboard) {
-      let offset: number | 'min' | 'max' = null;
+      let offset: number | 'min' | 'max' | undefined;
 
       // Change the value
       switch (e.which || e.keyCode) {
@@ -131,7 +131,7 @@ const Handle = React.forwardRef<HTMLDivElement, HandleProps>((props, ref) => {
           break;
       }
 
-      if (offset !== null) {
+      if (offset !== undefined) {
         e.preventDefault();
         onOffsetChange(offset, valueIndex);
       }
@@ -161,7 +161,7 @@ const Handle = React.forwardRef<HTMLDivElement, HandleProps>((props, ref) => {
 
   if (valueIndex !== null) {
     divProps = {
-      tabIndex: disabled ? null : getIndex(tabIndex, valueIndex),
+      tabIndex: disabled ? undefined : getIndex(tabIndex, valueIndex) ?? undefined,
       role: 'slider',
       'aria-valuemin': min,
       'aria-valuemax': max,
```

**File**: `src/Handles/index.tsx` (modified, +2/-2)
```diff
@@ -120,12 +120,12 @@ const Handles = React.forwardRef<HandlesRef, HandlesProps>((props, ref) => {
           key="a11y"
           {...handleProps}
           value={values[activeIndex]}
-          valueIndex={null}
+          valueIndex={null!}
           dragging={draggingIndex !== -1}
           draggingDelete={draggingDelete}
           render={activeHandleRender}
           style={{ pointerEvents: 'none' }}
-          tabIndex={null}
+          tabIndex={undefined}
           aria-hidden
         />
       )}
```

**File**: `src/Marks/index.tsx` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ export interface MarksProps {
 }
 
 const Marks: React.FC<MarksProps> = (props) => {
-  const { prefixCls, marks, onClick } = props;
+  const { prefixCls, marks = [], onClick } = props;
 
   const markPrefixCls = `${prefixCls}-mark`;
 
```

**File**: `src/Slider.tsx` (modified, +24/-19)
```diff
@@ -185,8 +185,8 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
     ariaValueTextFormatterForHandle,
   } = props;
 
-  const handlesRef = React.useRef<HandlesRef>(null);
-  const containerRef = React.useRef<HTMLDivElement>(null);
+  const handlesRef = React.useRef<HandlesRef | null>(null);
+  const containerRef = React.useRef<HTMLDivElement | null>(null);
 
   const direction = React.useMemo<Direction>(() => {
     if (vertical) {
@@ -214,9 +214,11 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
 
   // ============================ Marks =============================
   const markList = React.useMemo<InternalMarkObj[]>(() => {
-    return Object.keys(marks || {})
+    const markRecord = marks || {};
+
+    return Object.keys(markRecord)
       .map<InternalMarkObj>((key) => {
-        const mark = marks[key];
+        const mark = markRecord[key];
         const markObj: InternalMarkObj = {
           value: Number(key),
         };
@@ -243,10 +245,10 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
   const [formatValue, offsetValues] = useOffset(
     mergedMin,
     mergedMax,
-    mergedStep,
+    mergedStep as number,
     markList,
     allowCross,
-    mergedPush,
+    mergedPush as false | number,
   );
 
   // ============================ Values ============================
@@ -269,7 +271,7 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
 
       // When count provided or value is `undefined`, we fill values
       if (count || mergedValue === undefined) {
-        const pointCount = count >= 0 ? count + 1 : 2;
+        const pointCount = count !== undefined && count >= 0 ? count + 1 : 2;
         returnValues = returnValues.slice(0, pointCount);
 
         // Fill with count
@@ -308,7 +310,7 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
   const finishChange = useEvent((draggingDelete?: boolean) => {
     // Trigger from `useDrag` will tell if it's a delete action
     if (draggingDelete) {
-      handlesRef.current.hideHelp();
+      handlesRef.current!.hideHelp();
     }
 
     const finishValue = getTriggerValue(rawValues);
@@ -332,8 +334,8 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
     triggerChange(cloneNextValues);
 
     const nextFocusIndex = Math.max(0, index - 1);
-    handlesRef.current.hideHelp();
-    handlesRef.current.focus(nextFocusIndex);
+    handlesRef.current!.hideHelp();
+    handlesRef.current!.focus(nextFocusIndex);
   };
 
   const [draggingIndex, draggingValue, draggingDelete, cacheValues, onStartDrag] = useDrag(
@@ -395,7 +397,7 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
 
       if (e) {
         (document.activeElement as HTMLElement)?.blur?.();
-        handlesRef.current.focus(focusIndex);
+        handlesRef.current!.focus(focusIndex);
         onStartDrag(e, focusIndex, cloneNextValues);
       } else {
         // https://github.com/ant-design/ant-design/issues/49997
@@ -414,7 +416,7 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
     e.preventDefault();
 
     const { width, height, left, top, bottom, right } =
-      containerRef.current.getBoundingClientRect();
+      containerRef.current!.getBoundingClientRect();
     const { clientX, clientY } = e;
 
     let percent: number;
@@ -440,7 +442,7 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
   };
 
   // =========================== Keyboard ===========================
-  const [keyboardValue, setKeyboardValue] = React.useState<number>(null);
+  const [keyboardValue, setKeyboardValue] = React.useState<number>(null!);
 
   const onHandleOffsetChange = (offset: number | 'min' | 'max', valueIndex: number) => {
     if (!disabled) {
@@ -457,11 +459,12 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
     if (keyboardValue !== null) {
       const valueIndex = rawValues.indexOf(keyboardValue);
       if (valueIndex >= 0) {
-        handlesRef.current.focus(valueIndex);
+        handlesRef.current!.focus(valueIndex);
       }
     }
 
-    setKeyboardValue(null);
+    setKeyboardValue(null!);
+    // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [keyboardValue]);
 
   // ============================= Drag =============================
@@ -486,8 +489,9 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
   React.useEffect(() => {
     if (!dragging) {
       const valueIndex = rawValues.lastIndexOf(draggingValue);
-      handlesRef.current.focus(valueIndex);
+      handlesRef.current!.focus(valueIndex);
     }
+    // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [dragging]);
 
   // =========================== Included ===========================
@@ -509,7 +513,7 @@ const Slider = React.forwar
```

**File**: `src/Tracks/index.tsx` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ const Tracks: React.FC<TrackProps> = (props) => {
   const tracksNode =
     trackList?.length && (classNames.tracks || styles.tracks) ? (
       <Track
-        index={null}
+        index={null!}
         prefixCls={prefixCls}
         start={trackList[0].start}
         end={trackList[trackList.length - 1].end}
```

**File**: `src/hooks/useDrag.ts` (modified, +28/-16)
```diff
@@ -15,7 +15,7 @@ function getPosition(e: React.MouseEvent | React.TouchEvent | MouseEvent | Touch
 }
 
 function useDrag(
-  containerRef: React.RefObject<HTMLDivElement>,
+  containerRef: React.RefObject<HTMLDivElement | null>,
   direction: Direction,
   rawValues: number[],
   min: number,
@@ -33,15 +33,15 @@ function useDrag(
   returnValues: number[],
   onStartMove: OnStartMove,
 ] {
-  const [draggingValue, setDraggingValue] = React.useState(null);
+  const [draggingValue, setDraggingValue] = React.useState<number>(null!);
   const [draggingIndex, setDraggingIndex] = React.useState(-1);
   const [draggingDelete, setDraggingDelete] = React.useState(false);
   const [cacheValues, setCacheValues] = React.useState(rawValues);
   const [originValues, setOriginValues] = React.useState(rawValues);
 
-  const mouseMoveEventRef = React.useRef<(event: MouseEvent) => void>(null);
-  const mouseUpEventRef = React.useRef<(event: MouseEvent) => void>(null);
-  const touchEventTargetRef = React.useRef<EventTarget>(null);
+  const mouseMoveEventRef = React.useRef<EventListener | null>(null);
+  const mouseUpEventRef = React.useRef<EventListener | null>(null);
+  const touchEventTargetRef = React.useRef<EventTarget | null>(null);
 
   const { onDragStart, onDragChange } = React.useContext(UnstableContext);
 
@@ -54,11 +54,19 @@ function useDrag(
   // Clean up event
   React.useEffect(
     () => () => {
-      document.removeEventListener('mousemove', mouseMoveEventRef.current);
-      document.removeEventListener('mouseup', mouseUpEventRef.current);
+      if (mouseMoveEventRef.current) {
+        document.removeEventListener('mousemove', mouseMoveEventRef.current);
+      }
+      if (mouseUpEventRef.current) {
+        document.removeEventListener('mouseup', mouseUpEventRef.current);
+      }
       if (touchEventTargetRef.current) {
-        touchEventTargetRef.current.removeEventListener('touchmove', mouseMoveEventRef.current);
-        touchEventTargetRef.current.removeEventListener('touchend', mouseUpEventRef.current);
+        if (mouseMoveEventRef.current) {
+          touchEventTargetRef.current.removeEventListener('touchmove', mouseMoveEventRef.current);
+        }
+        if (mouseUpEventRef.current) {
+          touchEventTargetRef.current.removeEventListener('touchend', mouseUpEventRef.current);
+        }
       }
     },
     [],
@@ -82,7 +90,7 @@ function useDrag(
         rawValues: nextValues,
         deleteIndex: deleteMark ? draggingIndex : -1,
         draggingIndex,
-        draggingValue: nextValue,
+        draggingValue: nextValue as number,
       });
     }
   };
@@ -149,14 +157,14 @@ function useDrag(
     }
 
     // Moving
-    const onMouseMove = (event: MouseEvent | TouchEvent) => {
+    const onMouseMove: EventListener = (event) => {
       event.preventDefault();
 
-      const { pageX: moveX, pageY: moveY } = getPosition(event);
+      const { pageX: moveX, pageY: moveY } = getPosition(event as MouseEvent | TouchEvent);
       const offsetX = moveX - startX;
       const offsetY = moveY - startY;
 
-      const { width, height } = containerRef.current.getBoundingClientRect();
+      const { width, height } = containerRef.current!.getBoundingClientRect();
 
       let offSetPercent: number;
       let removeDist: number;
@@ -192,14 +200,18 @@ function useDrag(
     };
 
     // End
-    const onMouseUp = (event: MouseEvent | TouchEvent) => {
+    const onMouseUp: EventListener = (event) => {
       event.preventDefault();
 
       document.removeEventListener('mouseup', onMouseUp);
       document.removeEventListener('mousemove', onMouseMove);
       if (touchEventTargetRef.current) {
-        touchEventTargetRef.current.removeEventListener('touchmove', mouseMoveEventRef.current);
-        touchEventTargetRef.current.removeEventListener('touchend', mouseUpEventRef.current);
+        if (mouseMoveEventRef.current) {
+          touchEventTargetRef.current.removeEventListener('touchmove', mouseMoveEventRef.current);
+        }
+        if (mouseUpEventRef.current) {
+          touchEventTargetRef.current.removeEventListener('touchend', mouseUpEventRef.current);
+        }
       }
       mouseMoveEventRef.current = null;
       mouseUpEventRef.current = null;
```

---

### Incident Patch 9: `874875a8` (2025-03-26)
**Commit Message**: fix: onDelete is not a function (#1059)

* fix: onDelete is not a function

* chore: update types

**File**: `src/Handles/Handle.tsx` (modified, +2/-2)
```diff
@@ -22,7 +22,7 @@ export interface HandleProps
   dragging: boolean;
   draggingDelete: boolean;
   onStartMove: OnStartMove;
-  onDelete: (index: number) => void;
+  onDelete?: (index: number) => void;
   onOffsetChange: (value: number | 'min' | 'max', valueIndex: number) => void;
   onFocus: (e: React.FocusEvent<HTMLDivElement>, index: number) => void;
   onMouseEnter: (e: React.MouseEvent<HTMLDivElement>, index: number) => void;
@@ -127,7 +127,7 @@ const Handle = React.forwardRef<HTMLDivElement, HandleProps>((props, ref) => {
 
         case KeyCode.BACKSPACE:
         case KeyCode.DELETE:
-          onDelete(valueIndex);
+          onDelete?.(valueIndex);
           break;
       }
 
```

**File**: `src/Handles/index.tsx` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ export interface HandlesProps {
   onOffsetChange: (value: number | 'min' | 'max', valueIndex: number) => void;
   onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
   onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
-  onDelete: (index: number) => void;
+  onDelete?: (index: number) => void;
   handleRender?: HandleProps['render'];
   /**
    * When config `activeHandleRender`,
```

---

### Incident Patch 10: `678403cd` (2024-12-31)
**Commit Message**: fix: tipFormatter should not crash with undefined value (#1053)

* fix: tipFormatter should not crash with undefined value

* fix

* fix: tacks crash

* Update tests/Slider.test.js

---------

Co-authored-by: afc163 <[REDACTED_EMAIL]>

**File**: `src/Tracks/index.tsx` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ const Tracks: React.FC<TrackProps> = (props) => {
 
   // ========================== Render ==========================
   const tracksNode =
-    classNames.tracks || styles.tracks ? (
+      trackList?.length && (classNames.tracks || styles.tracks) ? (
       <Track
         index={null}
         prefixCls={prefixCls}
```

**File**: `tests/Slider.test.js` (modified, +6/-0)
```diff
@@ -662,4 +662,10 @@ describe('Slider', () => {
     const { asFragment } = render(<Slider included={false} />);
     expect(asFragment().firstChild).toMatchSnapshot();
   });
+
+  it('tipFormatter should not crash with undefined value', () => {
+    [undefined, null].forEach((value) => {
+      render(<Slider value={value} tooltip={{ open: true }} styles={{ tracks: {} }}/>);
+    });
+  });
 });
```

---

### Incident Patch 11: `29c18509` (2024-11-28)
**Commit Message**: feat: add aria required prop to slider (#1051)

Co-authored-by: afc163 <[REDACTED_EMAIL]>
Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

**File**: `README.md` (modified, +1/-0)
```diff
@@ -132,6 +132,7 @@ The following APIs are shared by Slider and Range.
 | tabIndex | number | `0` | Set the tabIndex of the slider handle. |
 | ariaLabelForHandle | string | - | Set the `aria-label` attribute on the slider handle.  |
 | ariaLabelledByForHandle | string | - | Set the `aria-labelledby` attribute on the slider handle. |
+| ariaRequired | boolean | - | Set the `aria-required` attribute on the slider handle. |
 | ariaValueTextFormatterForHandle | (value) => string | - | A function to set the `aria-valuetext` attribute on the slider handle. It receives the current value of the slider and returns a formatted string describing the value. See [WAI-ARIA Authoring Practices 1.1](https://www.w3.org/TR/wai-aria-practices-1.1/#slider) for more information. |
 
 ### Range
```

**File**: `src/Handles/Handle.tsx` (modified, +2/-0)
```diff
@@ -61,6 +61,7 @@ const Handle = React.forwardRef<HTMLDivElement, HandleProps>((props, ref) => {
     tabIndex,
     ariaLabelForHandle,
     ariaLabelledByForHandle,
+    ariaRequired,
     ariaValueTextFormatterForHandle,
     styles,
     classNames,
@@ -168,6 +169,7 @@ const Handle = React.forwardRef<HTMLDivElement, HandleProps>((props, ref) => {
       'aria-disabled': disabled,
       'aria-label': getIndex(ariaLabelForHandle, valueIndex),
       'aria-labelledby': getIndex(ariaLabelledByForHandle, valueIndex),
+      'aria-required': getIndex(ariaRequired, valueIndex),
       'aria-valuetext': getIndex(ariaValueTextFormatterForHandle, valueIndex)?.(value),
       'aria-orientation': direction === 'ltr' || direction === 'rtl' ? 'horizontal' : 'vertical',
       onMouseDown: onInternalStartMove,
```

**File**: `src/Slider.tsx` (modified, +4/-0)
```diff
@@ -112,6 +112,7 @@ export interface SliderProps<ValueType = number | number[]> {
   tabIndex?: number | number[];
   ariaLabelForHandle?: string | string[];
   ariaLabelledByForHandle?: string | string[];
+  ariaRequired?: boolean;
   ariaValueTextFormatterForHandle?: AriaValueFormat | AriaValueFormat[];
 }
 
@@ -180,6 +181,7 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
     tabIndex = 0,
     ariaLabelForHandle,
     ariaLabelledByForHandle,
+    ariaRequired,
     ariaValueTextFormatterForHandle,
   } = props;
 
@@ -542,6 +544,7 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
       tabIndex,
       ariaLabelForHandle,
       ariaLabelledByForHandle,
+      ariaRequired,
       ariaValueTextFormatterForHandle,
       styles: styles || {},
       classNames: classNames || {},
@@ -560,6 +563,7 @@ const Slider = React.forwardRef<SliderRef, SliderProps<number | number[]>>((prop
       tabIndex,
       ariaLabelForHandle,
       ariaLabelledByForHandle,
+      ariaRequired,
       ariaValueTextFormatterForHandle,
       styles,
       classNames,
```

**File**: `src/context.ts` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ export interface SliderContextProps {
   tabIndex: number | number[];
   ariaLabelForHandle?: string | string[];
   ariaLabelledByForHandle?: string | string[];
+  ariaRequired?: boolean;
   ariaValueTextFormatterForHandle?: AriaValueFormat | AriaValueFormat[];
   classNames: SliderClassNames;
   styles: SliderStyles;
```

**File**: `tests/Slider.test.js` (modified, +8/-0)
```diff
@@ -441,6 +441,14 @@ describe('Slider', () => {
     );
   });
 
+  it('sets aria-required on the handle', () => {
+    const { container } = render(<Slider ariaRequired={true} />);
+    expect(container.getElementsByClassName('rc-slider-handle')[0]).toHaveAttribute(
+      'aria-required',
+      'true',
+    );
+  });
+
   it('sets aria-valuetext on the handle', () => {
     const { container } = render(
       <Slider
```

---

### Incident Patch 12: `79e4d400` (2024-10-08)
**Commit Message**: fix: fix useLayoutEffect warning (#1045)

**File**: `src/Slider.tsx` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 import cls from 'classnames';
-import { useEvent } from 'rc-util';
+import useEvent from 'rc-util/lib/hooks/useEvent';
 import useMergedState from 'rc-util/lib/hooks/useMergedState';
 import isEqual from 'rc-util/lib/isEqual';
 import warning from 'rc-util/lib/warning';
```

**File**: `src/hooks/useDrag.ts` (modified, +3/-2)
```diff
@@ -1,5 +1,6 @@
-import { useEvent } from 'rc-util';
 import * as React from 'react';
+import useEvent from 'rc-util/lib/hooks/useEvent';
+import useLayoutEffect from 'rc-util/lib/hooks/useLayoutEffect';
 import { UnstableContext } from '../context';
 import type { Direction, OnStartMove } from '../interface';
 import type { OffsetValues } from './useOffset';
@@ -44,7 +45,7 @@ function useDrag(
 
   const { onDragStart, onDragChange } = React.useContext(UnstableContext);
 
-  React.useLayoutEffect(() => {
+  useLayoutEffect(() => {
     if (draggingIndex === -1) {
       setCacheValues(rawValues);
     }
```

---

### Incident Patch 13: `622c6b6b` (2024-09-17)
**Commit Message**: fix: When touch the slider while touching another area, the slider will move with the first touch (#1037)

**File**: `src/hooks/useDrag.ts` (modified, +14/-7)
```diff
@@ -8,7 +8,7 @@ import type { OffsetValues } from './useOffset';
 const REMOVE_DIST = 130;
 
 function getPosition(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) {
-  const obj = 'touches' in e ? e.touches[0] : e;
+  const obj = 'targetTouches' in e ? e.targetTouches[0] : e;
 
   return { pageX: obj.pageX, pageY: obj.pageY };
 }
@@ -40,6 +40,7 @@ function useDrag(
 
   const mouseMoveEventRef = React.useRef<(event: MouseEvent) => void>(null);
   const mouseUpEventRef = React.useRef<(event: MouseEvent) => void>(null);
+  const touchEventTargetRef = React.useRef<EventTarget>(null);
 
   const { onDragStart, onDragChange } = React.useContext(UnstableContext);
 
@@ -54,8 +55,10 @@ function useDrag(
     () => () => {
       document.removeEventListener('mousemove', mouseMoveEventRef.current);
       document.removeEventListener('mouseup', mouseUpEventRef.current);
-      document.removeEventListener('touchmove', mouseMoveEventRef.current);
-      document.removeEventListener('touchend', mouseUpEventRef.current);
+      if (touchEventTargetRef.current) {
+        touchEventTargetRef.current.removeEventListener('touchmove', mouseMoveEventRef.current);
+        touchEventTargetRef.current.removeEventListener('touchend', mouseUpEventRef.current);
+      }
     },
     [],
   );
@@ -193,10 +196,13 @@ function useDrag(
 
       document.removeEventListener('mouseup', onMouseUp);
       document.removeEventListener('mousemove', onMouseMove);
-      document.removeEventListener('touchend', onMouseUp);
-      document.removeEventListener('touchmove', onMouseMove);
+      if (touchEventTargetRef.current) {
+        touchEventTargetRef.current.removeEventListener('touchmove', mouseMoveEventRef.current);
+        touchEventTargetRef.current.removeEventListener('touchend', mouseUpEventRef.current);
+      }
       mouseMoveEventRef.current = null;
       mouseUpEventRef.current = null;
+      touchEventTargetRef.current = null;
 
       finishChange(deleteMark);
 
@@ -206,10 +212,11 @@ function useDrag(
 
     document.addEventListener('mouseup', onMouseUp);
     document.addEventListener('mousemove', onMouseMove);
-    document.addEventListener('touchend', onMouseUp);
-    document.addEventListener('touchmove', onMouseMove);
+    e.currentTarget.addEventListener('touchend', onMouseUp);
+    e.currentTarget.addEventListener('touchmove', onMouseMove);
     mouseMoveEventRef.current = onMouseMove;
     mouseUpEventRef.current = onMouseUp;
+    touchEventTargetRef.current = e.currentTarget;
   };
 
   // Only return cache value when it mapping with rawValues
```

**File**: `tests/Range.test.tsx` (modified, +6/-4)
```diff
@@ -80,16 +80,18 @@ describe('Range', () => {
   ) {
     const touchStart = createEvent.touchStart(container.getElementsByClassName(element)[0], {
       touches: [{}],
+      targetTouches: [{}],
     });
-    (touchStart as any).touches[0].pageX = start;
+    (touchStart as any).targetTouches[0].pageX = start;
     fireEvent(container.getElementsByClassName(element)[0], touchStart);
 
     // Drag
-    const touchMove = createEvent.touchMove(document, {
+    const touchMove = createEvent.touchMove(container.getElementsByClassName(element)[0], {
       touches: [{}],
+      targetTouches: [{}],
     });
-    (touchMove as any).touches[0].pageX = end;
-    fireEvent(document, touchMove);
+    (touchMove as any).targetTouches[0].pageX = end;
+    fireEvent(container.getElementsByClassName(element)[0], touchMove);
   }
 
   it('should render Range with correct DOM structure', () => {
```

---

### Incident Patch 14: `b9298bd9` (2024-08-23)
**Commit Message**: fix tsc errors

**File**: `docs/examples/vertical.tsx` (modified, +2/-4)
```diff
@@ -93,8 +93,7 @@ export default () => (
     <div style={style}>
       <p>Range with marks and draggableTrack</p>
       <Slider
-        range
-        draggableTrack
+        range={{ draggableTrack: true }}
         vertical
         min={-10}
         marks={marks}
@@ -105,8 +104,7 @@ export default () => (
     <div style={style}>
       <p>Range with marks and draggableTrack(reverse)</p>
       <Slider
-        range
-        draggableTrack
+        range={{ draggableTrack: true }}
         vertical
         reverse
         min={-10}
```

---

### Incident Patch 15: `75d5334f` (2024-08-23)
**Commit Message**: fix tsc errors

**File**: `docs/examples/range.tsx` (modified, +3/-5)
```diff
@@ -245,26 +245,24 @@ export default () => (
     </div>
     <div style={style}>
       <p>draggableTrack two points</p>
-      <Slider range allowCross={false} defaultValue={[0, 40]} draggableTrack onChange={log} />
+      <Slider range={{ draggableTrack: true }} allowCross={false} defaultValue={[0, 40]} onChange={log} />
     </div>
     <div style={style}>
       <p>draggableTrack two points(reverse)</p>
       <Slider
-        range
+        range={{ draggableTrack: true }}
         allowCross={false}
         reverse
         defaultValue={[0, 40]}
-        draggableTrack
         onChange={log}
       />
     </div>
     <div style={style}>
       <p>draggableTrack multiple points</p>
       <Slider
-        range
+        range={{ draggableTrack: true }}
         allowCross={false}
         defaultValue={[0, 20, 30, 40, 50]}
-        draggableTrack
         onChange={log}
       />
     </div>
```

#### Recent Merged Pull Requests:
- **PR #1094** (2026-09-03): refactor: use renderable guard for marks (@QDyanbing)
- **PR #1092** (2026-09-16): fix: preserve pushable gaps on track clicks (@nrps9909)
- **PR #1091** (2026-09-16): fix: preserve decimal pushable gaps (@nrps9909)
- **PR #1089** (2026-09-16): fix: finish drag when mouseup propagation stops (@nrps9909)
- **PR #1088** (2026-08-27): feat: support aria-describedby on handles (@nrps9909)
- **PR #1087** (2026-09-16): fix: guard drag movement without container (@nrps9909)
- **PR #1086** (closed): chore(deps): bump the github-actions group across 1 directory with 3 updates (@dependabot[bot])
- **PR #1085** (2026-07-31): ci: fix React Doctor workflow (@yoyo837)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
