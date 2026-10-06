# Forensic Learning Record (Deep Inspection): arco-design/arco-design

> **Canonical Artifact**: `07_PROJECT_LEARNING/arco-design-arco-design-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arco-design/arco-design](https://github.com/arco-design/arco-design))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:04:00.423Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arco-design/arco-design`
- **Description**: A comprehensive React UI components library based on Arco Design
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5711 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `components/Anchor/utils.ts`
```
import BTween from 'b-tween';
import { isString, isWindow } from '../_util/is';

export function findNode(dom: HTMLElement | Document, selector: string): HTMLElement | null {
  // handle id start with number
  // e.g. id #123
  const s =
    isString(selector) && selector[0] === '#' ? `[id='${selector.replace('#', '')}']` : selector;
  try {
    return dom.querySelector(s);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function slide(el: HTMLElement, top: number, cb: Function) {
  const tween = new BTween({
    from: {
      scrollTop: el.scrollTop,
    },
    to: {
      scrollTop: top,
    },
    easing: 'quartOut',
    duration: 300,
    onUpdate: (keys) => {
      el.scrollTop = keys.scrollTop;
    },
    onFinish: () => {
      cb?.();
    },
  });
  tween.start();
}

export function getContainer(targetContainer?: string | HTMLElement | Window) {
  if (isString(targetContainer)) {
    return findNode(document, targetContainer);
  }
  return targetContainer || window;
}

export function getContainerElement(scrollContainer: HTMLElement | Window) {
  return isWindow(scrollContainer) ? document.documentElement || document.body : scrollContainer;
}

```

### Core Architecture Module: `components/Calendar/hooks/useCellClassName.ts`
```
import { Dayjs } from 'dayjs';
import cs from '../../_util/classNames';
import { isArray } from '../../_util/is';
import { getNow } from '../../_util/dayjs';

function getDateValue(date?: Dayjs[], index?: number) {
  if (!date) {
    return undefined;
  }
  if (isArray(date)) {
    return date[index];
  }
}

export default function useClassName(props) {
  const { prefixCls, mergedValue, rangeValues, hoverRangeValues, panel, isSameTime, innerMode } =
    props;

  function isInRange(current, startDate, endDate) {
    if (!startDate || !endDate) {
      return false;
    }
    return (
      isSameTime(current, startDate) ||
      isSameTime(current, endDate) ||
      current.isBetween(startDate, endDate, null, '[]')
    );
  }

  return function getCellClassName(cellDateObj, disabled) {
    const rangeStart = getDateValue(rangeValues, 0);
    const rangeEnd = getDateValue(rangeValues, 1);

    const hoverRangeStart = getDateValue(hoverRangeValues, 0);
    const hoverRangeEnd = getDateValue(hoverRangeValues, 1);

    const isInView = !cellDateObj.isPrev && !cellDateObj.isNext;

    const rangeAvailable = isInView && panel;

    const isRangeStart = rangeAvailable && rangeStart && isSameTime(cellDateObj.time, rangeStart);
    const isRangeEnd = rangeAvailable && rangeEnd && isSameTime(cellDateObj.time, rangeEnd);

    const nearRangeStart = hoverRangeStart && rangeStart && hoverRangeStart.isBefore(rangeStart);
    const nearRangeEnd = rangeEnd && hoverRangeEnd && hoverRangeEnd.isAfter(rangeEnd);

    const isHoverNearRange = (nearRangeStart && isRangeStart) || (nearRangeEnd && isRangeEnd);

    let isToday = isSameTime(cellDateObj.time, getNow());

    if (!panel && innerMode === 'year') {
      isToday = getNow().isSame(cellDateObj.time, 'date');
    }

    return cs(`${prefixCls}-cell`, {
      [`${prefixCls}-cell-in-view`]: isInView,
      [`${prefixCls}-cell-today`]: isToday,
      [`${prefixCls}-cell-selected`]: mergedValue && isSameTime(cellDateObj.time, mergedValue),
      [`${prefixCls}-cell-range-start`]: isRangeStart,
      [`${prefixCls}-cell-range-end`]: isRangeEnd,
      [`${prefixCls}-cell-in-range`]:
        rangeAvailable && isInRange(cellDateObj.time, rangeStart, rangeEnd),
      [`${prefixCls}-cell-in-range-near-hover`]: isHoverNearRange,
      [`${prefixCls}-cell-hover-range-start`]:
        rangeAvailable && hoverRangeStart && isSameTime(cellDateObj.time, hoverRangeStart),
      [`${prefixCls}-cell-hover-range-end`]:
        rangeAvailable && hoverRangeEnd && isSameTime(cellDateObj.time, hoverRangeEnd),
      [`${prefixCls}-cell-hover-in-range`]:
        rangeAvailable && isInRange(cellDateObj.time, hoverRangeStart, hoverRangeEnd),
      [`${prefixCls}-cell-disabled`]: disabled,
    });
  };
}

```

### Core Architecture Module: `components/Cascader/hook/useRefCurrent.ts`
```
import { DependencyList, useRef } from 'react';
import useForceUpdate from '../../_util/hooks/useForceUpdate';
import useUpdate from '../../_util/hooks/useUpdate';

function useCurrentRef<T>(initFunc: () => T, deps: DependencyList): T {
  const ref = useRef<T>(null);
  const forceUpdate = useForceUpdate();

  if (!ref.current) {
    ref.current = initFunc();
  }

  useUpdate(() => {
    ref.current = initFunc();
    forceUpdate();
  }, [...deps]);

  return ref.current;
}

export default useCurrentRef;

```

### Core Architecture Module: `components/Cascader/util.tsx`
```
import { isArray } from '../_util/is';
import Store from './base/store';
import { CascaderProps } from './interface';

export const ValueSeparator = '__arco_cascader__';

export const SHOW_PARENT = 'parent';
export const SHOW_CHILD = 'child';

export const PANEL_MODE = {
  cascader: 'cascader',
  select: 'select',
};

export function isEmptyValue(value) {
  return !value || (isArray(value) && value.length === 0);
}

export function getConfig(props: CascaderProps) {
  return {
    showEmptyChildren: props.showEmptyChildren,
    changeOnSelect: props.changeOnSelect,
    lazyload: !!props.loadMore,
    fieldNames: props.fieldNames,
    filterOption: props.filterOption,
    showParent:
      props.mode === 'multiple' && !props.changeOnSelect && props.checkedStrategy === SHOW_PARENT,
  };
}

export function getStore(props, value) {
  const tmp = value ? (Array.isArray(value[0]) ? value : [value]) : [];
  return new Store(props.options || [], tmp, getConfig(props));
}

export const transformValuesToSet = (values: string[][]) => {
  const _values = values || [];
  const valuesSet = _values.reduce((set, next) => {
    // 'next' could be a string.
    set.add([].concat(next).join(ValueSeparator));
    return set;
  }, new Set());

  return valuesSet;
};

export const valueInSet = (set, value: string[]) => {
  const _value = value || [];
  return set.has(_value.join(ValueSeparator));
};

export const removeValueFromSet = (set, value: string[]) => {
  const _value = value || [];
  return set.delete(_value.join(ValueSeparator));
};

export const formatValue = (value, isMultiple, store?): string[][] | undefined => {
  let _value = [];
  if (value === undefined) {
    _value = [];
  } else if (isMultiple) {
    _value = value;
  } else {
    _value = [value];
  }

  if (store && store.config.showParent) {
    const checkedNodes = store.getCheckedNodes();
    const valuesSet = transformValuesToSet(checkedNodes.map((node) => node.pathValue));
    const result = [];
    const temp = {};
    _value.map((v) => {
      v.some((_, index, arr) => {
        const curVal = arr.slice(0, index + 1);
        const pass = valueInSet(valuesSet, curVal);
        if (pass && !temp[curVal.join(ValueSeparator)]) {
          result.push(curVal);
          temp[curVal.join(ValueSeparator)] = 1;
        }
        return pass;
      });
    });

    return result;
  }
  return _value;
};

// change check status to false
const deny2Checked = (option) => {
  const deny = (options) => {
    return !Array.isArray(options)
      ? false
      : options.every((item) => {
          if (item._checked || item.disabled) {
            return true;
          }
          return deny(item.children);
        });
  };
  return option._halfChecked && deny(option?.children);
};

export const getMultipleCheckValue = (propsValue, store: Store<any>, option, _checked) => {
  const checked = _checked && deny2Checked(option) ? false : _checked;

  const beforeValueSet = store.getCheckedNodes().reduce((set, node) => {
    set.add(node.pathValue.join(ValueSeparator));
    return set;
  }, new Set());

  option.setCheckedState(checked);
  const checkedNodes = store.getCheckedNodes();
  const currentValue = checkedNodes.map((node) => node.pathValue);
  const currentValueSet = transformValuesToSet(currentValue);

  const newValueSet = new Set();
  return propsValue
    .filter((v) => {
      // v 不在 beforeValueSet 中，说明 v 不包含对应的option。直接返回true，不应该清除掉。
      if (!valueInSet(beforeValueSet, v) || valueInSet(currentValueSet, v)) {
        newValueSet.add(v.join(ValueSeparator));
        return true;
      }
    })
    .concat(
      currentValue.filter((v) => {
        return !valueInSet(newValueSet, v);
      })
    );
};

```

### Core Architecture Module: `components/ColorPicker/hooks/useColorPicker.ts`
```
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ColorPickerMode, GradientColor, HSV, InternalGradientColor } from '../interface';
import { formatInputToHSVA } from '../../_util/color';
import useMergeValue from '../../_util/hooks/useMergeValue';
import useIsFirstRender from '../../_util/hooks/useIsFirstRender';
import { getModeByValue, isGradientMode, isSingleMode } from '../mode';
import {
  getColorFromHsv,
  formatRgba,
  formatHex,
  getRandomId,
  isEqualsColors,
  equalsHsv,
  mapValueToGradientColor,
} from '../utils';

interface UseColorPickerProps {
  mode?: 'single' | 'gradient' | ['single', 'gradient'];
  value?: string | GradientColor[];
  defaultValue?: string | GradientColor[];
  defaultPopupVisible?: boolean;
  disabledAlpha?: boolean;
  popupVisible?: boolean;
  format?: 'hex' | 'rgb';
  onChange?: (value: string | GradientColor[]) => void;
  onVisibleChange?: (visible: boolean) => void;
}

export const useColorPicker = (props: UseColorPickerProps) => {
  const { mode = ColorPickerMode.Single, defaultValue, format, onChange, disabledAlpha } = props;

  const isFirstRender = useIsFirstRender();

  const [popupVisible, setPopupVisible] = useMergeValue(false, {
    defaultValue: props.defaultPopupVisible,
    value: props.popupVisible,
  });

  const [activeMode, setActiveMode] = useState<ColorPickerMode>(
    getModeByValue(props.value, defaultValue, mode as ColorPickerMode | ColorPickerMode[])
  );

  const [value, setValue] = useMergeValue(
    activeMode === ColorPickerMode.Gradient ? undefined : '',
    props
  );

  const [_gradientColors, _setGradientColors] = useState<InternalGradientColor[]>(
    isGradientMode(activeMode) && Array.isArray(value)
      ? mapValueToGradientColor(value as GradientColor[], disabledAlpha)
      : []
  );
  const [_activeColorId, _setActiveColorId] = useState(_gradientColors[0]?.id);
  const gradientColorsRef = useRef(_gradientColors);
  const activeColorIdRef = useRef(_activeColorId);
  const gradientColors = gradientColorsRef.current;
  const activeColorId = activeColorIdRef.current;
  const setGradientColors = (
    newColors:
      | InternalGradientColor[]
      | ((colors: InternalGradientColor[]) => InternalGradientColor[])
  ) => {
    _setGradientColors(newColors);
    gradientColorsRef.current =
      typeof newColors === 'function' ? newColors(gradientColorsRef.current) : newColors;
  };
  const setActiveColorId = (newId: string) => {
    _setActiveColorId(newId);
    activeColorIdRef.current = newId;
  };

  const activeColorIndex = useMemo(() => {
    const activeIndex = gradientColors.findIndex((item) => item.id === activeColorId);
    return activeIndex !== -1 ? activeIndex : 0;
  }, [gradientColors, activeColorId]);

  const formatInput = Array.isArray(value)
    ? formatInputToHSVA((value as GradientColor[])[activeColorIndex].color)
    : formatInputToHSVA(value as string);

  const [hsv, setHsv] = useState<HSV>({
    h: formatInput.h,
    s: formatInput.s,
    v: formatInput.v,
  });
  const [alpha, setAlpha] = useState(formatInput.a);

  const color = useMemo(() => getColorFromHsv(hsv), [hsv]);

  const formatSingleValue = useCallback(
    (r, g, b, alpha) => {
      return format === 'rgb' ? formatRgba(r, g, b, alpha) : formatHex(r, g, b, alpha);
    },
    [format]
  );

  const formatValue = useMemo(() => {
    if (isSingleMode(activeMode)) {
      const { r, g, b } = color.rgb;
      return formatSingleValue(r, g, b, alpha);
    }
    return gradientColors.map((item) => {
      const { r, g, b } = item.color.rgb;
      return {
        color: formatSingleValue(r, g, b, item.alpha),
        percent: item.percent,
      };
    });
  }, [activeMode, gradientColors, color.rgb, formatSingleValue, alpha]);

  useEffect(() => {
    setValue(formatValue);
    if (!isFirstRender && !isEqualsColors(value, formatValue)) {
      onChange?.(formatValue);
    }
  }, [formatValue]);

  const onVisibleChange = useCallback(
    (newVisible) => {
      if (newVisible && value !== formatValue) {
        const { h, s, v, a } = formatInput;
        setHsv({ h, s, v });
        setAlpha(a);
      }

      if (newVisible !== popupVisible) {
        props.onVisibleChange && props.onVisibleChange(newVisible);
        if (!('popupVisible' in props)) {
          setPopupVisible(newVisible);
        }
      }
    },
    [props.onVisibleChange, popupVisible, value]
  );

  const onHsvChange = (_value: HSV) => {
    setHsv(_value);
    if (disabledAlpha && alpha !== 100) {
      setAlpha(100);
    }
  };

  const onAlphaChange = (_value: number) => {
    setAlpha(_value);
  };

  useEffect(() => {
    if (!isGradientMode(activeMode) || !gradientColors.length) return;
    if (equalsHsv(gradientColors[activeColorIndex].color.hsv, hsv)) return;
    const newGradientColors = [...gradientColors];
    newGradientColors[activeColorIndex] = {
      ...newGradientColors[activeColorIndex],
      color: getColorFromHsv(hsv),
    };
    setGradientColors(newGradientColors);
  }, [hsv]);

  useEffect(() => {
    if (!isGradientMode(activeMode) || !gradientColors.length) return;
    if (gradientColors[activeColorIndex].alpha === alpha) return;
    const newGradientColors = [...gradientColors];
    newGradientColors[activeColorIndex] = {
      ...newGradientColors[activeColorIndex],
      alpha: disabledAlpha ? 100 : alpha,
    };
    setGradientColors(newGradientColors);
  }, [alpha]);

  const onActiveModeChange = (newMode: ColorPickerMode) => {
    if (newMode === activeMode) {
      return;
    }
    if (newMode === ColorPickerMode.Single) {
      setActiveColorId(gradientColors[0]?.id);
    } else {
      setGradientColors([
        {
          id: getRandomId(),
          color,
          alpha,
          percent: 0,
        },
        {
          id: getRandomId(),
          color,
          alpha,
          percent: 100,
        },
      ]);
    }
    setActiveMode(newMode);
  };

  return {
    value,
    activeMode,
    gradientColors,
    gradientColorsRef,
    activeColorId,
    activeColorIdRef,
    popupVisible,
    color,
    alpha,
    onHsvChange,
    onAlphaChange,
    onVisibleChange,
    onActiveModeChange,
    onActiveColorIdChange: setActiveColorId,
    onGradientColorsChange: setGradientColors,
  };
};

```

### Core Architecture Module: `components/ColorPicker/hooks/useControlBlock.ts`
```
import { useRef, useState } from 'react';

interface MultiValueItem {
  value: [number, number];
  key: string;
}

interface ControlBlockParams {
  value: [number, number] | MultiValueItem[];
  multiple?: boolean;
  onActive?: (key: string) => void;
  onAdd?: (value: [number, number]) => void;
  onChange: (value: [number, number], key?: string) => void;
}

export const useControlBlock = ({
  value,
  multiple = false,
  onActive,
  onAdd,
  onChange,
}: ControlBlockParams) => {
  const [active, setActive] = useState(false);
  const blockRef = useRef<HTMLDivElement>();
  const handlerRef = useRef<HTMLDivElement>();

  const getPercentNumber = (value: number, max: number) => {
    if (value < 0) {
      return 0;
    }
    if (value > max) {
      return 1;
    }
    return value / max;
  };

  const getNewPosition = (ev: MouseEvent): [number, number] => {
    const { clientX, clientY } = ev;
    const rect = blockRef.current.getBoundingClientRect();
    return [
      getPercentNumber(clientX - rect.x, rect.width),
      getPercentNumber(clientY - rect.y, rect.height),
    ];
  };

  const setCurrentPosition = (ev: MouseEvent) => {
    const newValue = getNewPosition(ev);
    if (multiple || (!multiple && (newValue[0] !== value[0] || newValue[1] !== value[1]))) {
      onChange?.(newValue);
    }
  };

  const removeListener = () => {
    setActive(false);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', removeListener);
    window.removeEventListener('contextmenu', removeListener);
  };

  const onMouseDown = (ev: MouseEvent) => {
    ev.preventDefault();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', removeListener);
    window.addEventListener('contextmenu', removeListener);
    setActive(true);
    if (multiple) {
      if (ev.target === blockRef.current) {
        onAdd(getNewPosition(ev));
      } else if (typeof (ev.target as HTMLDivElement)?.dataset?.key !== 'undefined') {
        const key = (ev.target as HTMLDivElement).dataset.key!;
        onActive(key);
      }
      return;
    }
    setCurrentPosition(ev);
  };

  function onMouseMove(ev: MouseEvent) {
    ev.preventDefault();
    if (ev.buttons > 0) {
      setCurrentPosition(ev);
    } else {
      removeListener();
    }
  }

  return {
    active,
    blockRef,
    handlerRef,
    onMouseDown,
  };
};

```

### Core Architecture Module: `components/ColorPicker/utils.ts`
```
import {
  formatInputToHSVA,
  formatInputToRGBA,
  hsvToRgb,
  rgbToHex,
  rgbToHsv,
  rgbaToHex,
} from '../_util/color';
import { GradientColor, HSV, InternalGradientColor, RGB } from './interface';

interface RGBA extends RGB {
  a: number;
}

export const sortGradientColors = (gradientColors: InternalGradientColor[]) => {
  return gradientColors.sort((a, b) => {
    return a.percent - b.percent;
  });
};

export const mix = (source: RGBA, target: RGBA, progress: number): RGBA =>
  Object.keys(source).reduce(
    (previousObject, currentKey) => ({
      ...previousObject,
      [currentKey]: source[currentKey] + (target[currentKey] - source[currentKey]) * progress,
    }),
    { ...source }
  );

export const getGradientString = (value: GradientColor[]) =>
  value.map(({ color, percent }) => `${color} ${percent}%`).join(', ');

export const renderGradientBackground = (value: GradientColor[]) => {
  return `linear-gradient(to right, ${getGradientString(value)})`;
};
export const renderBackground = (value: GradientColor[] | string) =>
  Array.isArray(value) ? renderGradientBackground(value) : (value as string);

export const formatRgba = (r: number, g: number, b: number, a: number) =>
  a < 1 ? `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})` : `rgb(${r}, ${g}, ${b})`;

export const formatHex = (r: number, g: number, b: number, a: number) =>
  a < 1 ? `#${rgbaToHex(r, g, b, a)}` : `#${rgbToHex(r, g, b)}`;

export const getColorFromHsv = (hsv: HSV) => {
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  return {
    hsv,
    rgb,
    hex,
  };
};

export const getRandomId = () => Math.random().toFixed(10).slice(2);

export const mapValueToGradientColor = (
  value: GradientColor[],
  disabledAlpha: boolean
): InternalGradientColor[] =>
  (value as GradientColor[]).map((item) => {
    const formatInput = formatInputToHSVA(item.color);
    return {
      id: getRandomId(),
      color: getColorFromHsv(formatInput),
      alpha: disabledAlpha ? 100 : formatInput.a,
      percent: item.percent,
    };
  });

export const getColorByGradients = (
  gradientColors: InternalGradientColor[],
  percent: number,
  id?: string
): InternalGradientColor => {
  const index = gradientColors.findIndex((item) => item.percent === percent);
  if (index !== -1) {
    return {
      ...gradientColors[index],
      id: id ?? getRandomId(),
    };
  }
  const latterColorIndex = gradientColors.findIndex((item) => item.percent > percent);
  const previousColorIndex = latterColorIndex - 1;
  const {
    color: previousColor,
    alpha: previousAlpha,
    percent: previousPercent,
  } = gradientColors[previousColorIndex];
  const {
    color: latterColor,
    alpha: latterAlpha,
    percent: latterPercent,
  } = gradientColors[latterColorIndex];
  const interpolatedColor = mix(
    {
      ...previousColor.rgb,
      a: previousAlpha,
    },
    {
      ...latterColor.rgb,
      a: latterAlpha,
    },
    (percent - previousPercent) / (latterPercent - previousPercent)
  );
  const { r, g, b, a } = interpolatedColor;
  return {
    id: id ?? getRandomId(),
    color: getColorFromHsv(rgbToHsv(r, g, b)),
    alpha: a,
    percent,
  };
};

export const equalsHsv = (a: HSV, b: HSV) => {
  return a.h === b.h && a.s === b.s && a.v === b.v;
};
export const equalsRgba = (a: RGBA, b: RGBA) => {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
};

export const isEqualsColors = (
  colorA: string | GradientColor[],
  colorB: string | GradientColor[]
) => {
  if (typeof colorA === 'string' && typeof colorB === 'string') {
    return colorA === colorB;
  }
  if (Array.isArray(colorA) && Array.isArray(colorB)) {
    return (
      colorA.length === colorB.length &&
      colorA.every((itemA, index) => {
        const itemB = colorB[index];
        return (
          equalsRgba(formatInputToRGBA(itemA.color), formatInputToRGBA(itemB.color)) &&
          itemA.percent === itemB.percent
        );
      })
    );
  }
  return false;
};

```

### Core Architecture Module: `components/ConfigProvider/util.ts`
```
// Less lighten

function hexToRgb(hex) {
  const rgb: number[] = [];
  let _hex = hex.substr(1);

  // converts #abc to #aabbcc
  if (hex.length === 3) {
    _hex = hex.replace(/(.)/g, '$1$1');
  }

  _hex.replace(/../g, (color: string) => {
    rgb.push(parseInt(color, 0x10));
  });

  return {
    r: rgb[0],
    g: rgb[1],
    b: rgb[2],
    rgb: `rgb(${rgb.join(',')})`,
  };
}

function getRgb(color: string) {
  const rgb = hexToRgb(color);
  return { r: rgb.r, g: rgb.g, b: rgb.b };
}

function getHsl(color: string) {
  const rgb = getRgb(color);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  return { h: hsl.h, s: hsl.s, l: hsl.l };
}

function rgbToHsl(r: number, g: number, b: number) {
  const _r = r / 255;
  const _g = g / 255;
  const _b = b / 255;
  const max = Math.max(_r, _g, _b);
  const min = Math.min(_r, _g, _b);
  const l = (max + min) / 2;
  let h;
  let s;

  if (max === min) {
    h = 0;
    s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case _r:
        h = (_g - _b) / d + (_g < _b ? 6 : 0);
        break;
      case _g:
        h = (_b - _r) / d + 2;
        break;
      case _b:
        h = (_r - _g) / d + 4;
        break;
      default:
        break;
    }
    h /= 6;
  }

  return {
    h,
    s,
    l,
    hsl: `hsl(${h * 360}, ${s * 100}%, ${l * 100}%)`,
  };
}

export function lighten(color: string, percent: number) {
  const hsl = getHsl(color);
  const h = +hsl.h;
  const s = +hsl.s;
  const l = +hsl.l * 100 + +percent;

  // return `hsl(${h * 360}, ${s * 100}%, ${l}%)`;
  const res = hsltorgb([h * 360, s * 100, l]);
  return res.join(',');
}

// copy from https://github.com/Qix-/color-convert/blob/master/conversions.js
export function hsltorgb(hsl) {
  const h = hsl[0] / 360;
  const s = hsl[1] / 100;
  const l = hsl[2] / 100;
  let t2;
  let t3;
  let val;

  if (s === 0) {
    val = l * 255;
    return [val, val, val];
  }

  if (l < 0.5) {
    t2 = l * (1 + s);
  } else {
    t2 = l + s - l * s;
  }

  const t1 = 2 * l - t2;

  const rgb = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    t3 = h + (1 / 3) * -(i - 1);
    if (t3 < 0) {
      t3++;
    }

    if (t3 > 1) {
      t3--;
    }

    if (6 * t3 < 1) {
      val = t1 + (t2 - t1) * 6 * t3;
    } else if (2 * t3 < 1) {
      val = t2;
    } else if (3 * t3 < 2) {
      val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
    } else {
      val = t1;
    }

    rgb[i] = val * 255;
  }

  return rgb;
}

```

### Core Architecture Module: `components/DatePicker/hooks/useCellClassName.ts`
```
import { Dayjs } from 'dayjs';
import cs from '../../_util/classNames';
import { isArray } from '../../_util/is';
import { getNow, getSortedDayjsArray } from '../../_util/dayjs';
import { getAvailableDayjsLength } from '../util';

function getDateValue(date?: Dayjs[], index?: number) {
  if (!date) {
    return undefined;
  }
  if (isArray(date)) {
    return date[index];
  }
}

export default function useClassName(props) {
  const { prefixCls, value, rangeValues, valueShowHover, isSameTime, mode, hideNotInViewDates } =
    props;

  const selectedLength = getAvailableDayjsLength(rangeValues);
  const hoverLength = getAvailableDayjsLength(valueShowHover);

  const sortedRangeValues =
    selectedLength !== 2 && hoverLength === 2 ? getSortedDayjsArray(valueShowHover) : rangeValues;
  const sortedHoverRangeValues = selectedLength === 2 ? getSortedDayjsArray(valueShowHover) : [];

  function isInRange(current: Dayjs, startDate, endDate): boolean {
    // show placeholder range
    // if (!startDate || !endDate) {
    //   if (startDate) {
    //     return isSameTime(current, startDate) || current.isAfter(startDate);
    //   }
    //   if (endDate) {
    //     return isSameTime(current, endDate) || current.isBefore(endDate);
    //   }
    //   return false;
    // }
    if (startDate && endDate) {
      return (
        isSameTime(current, startDate) ||
        isSameTime(current, endDate) ||
        current.isBetween(startDate, endDate, null)
      );
    }
  }

  return function getCellClassName(cellDateObj, disabled, utcOffset, timezone) {
    const rangeStart = getDateValue(sortedRangeValues, 0);
    const rangeEnd = getDateValue(sortedRangeValues, 1);
    const hoverRangeStart = getDateValue(sortedHoverRangeValues, 0);
    const hoverRangeEnd = getDateValue(sortedHoverRangeValues, 1);

    const isInView = !cellDateObj.isPrev && !cellDateObj.isNext;

    const selected = value && isSameTime(cellDateObj.time, value);

    let isToday = isSameTime(cellDateObj.time, getNow(utcOffset, timezone));

    const checkIsInView = mode !== 'week' ? isInView : true;

    if (mode === 'week') {
      isToday = getNow(utcOffset, timezone).isSame(cellDateObj.time, 'date');
    }

    if (mode === 'quarter') {
      isToday = getNow(utcOffset, timezone).isSame(cellDateObj.time, 'quarter');
    }

    function getIsRangeStartOrEnd(v) {
      return checkIsInView && !disabled && v && isSameTime(cellDateObj.time, v);
    }

    const isRangeStart = getIsRangeStartOrEnd(rangeStart);
    const isRangeEnd = getIsRangeStartOrEnd(rangeEnd);
    const isRangeStartSelected = getIsRangeStartOrEnd(getDateValue(rangeValues, 0));
    const isRangeEndSelected = getIsRangeStartOrEnd(getDateValue(rangeValues, 1));
    const isHoverRangeStart = getIsRangeStartOrEnd(hoverRangeStart);
    const isHoverRangeEnd = getIsRangeStartOrEnd(hoverRangeEnd);

    let isRangeEdgeInHoverRange = false;
    if (isRangeStart) {
      isRangeEdgeInHoverRange =
        hoverRangeStart &&
        rangeStart &&
        hoverRangeStart.isBefore(rangeStart) &&
        isInRange(rangeStart, hoverRangeStart, hoverRangeEnd);
    } else if (isRangeEnd) {
      isRangeEdgeInHoverRange =
        hoverRangeEnd &&
        rangeEnd &&
        hoverRangeEnd.isAfter(rangeEnd) &&
        isInRange(rangeEnd, hoverRangeStart, hoverRangeEnd);
    }

    let isHoverRangeEdgeInRange = false;
    if (isHoverRangeStart) {
      isHoverRangeEdgeInRange =
        hoverRangeStart &&
        rangeStart &&
        rangeStart.isBefore(hoverRangeStart) &&
        isInRange(hoverRangeStart, rangeStart, rangeEnd);
    } else if (isHoverRangeEnd) {
      isHoverRangeEdgeInRange =
        hoverRangeEnd &&
        rangeEnd &&
        rangeEnd.isAfter(hoverRangeEnd) &&
        isInRange(hoverRangeEnd, rangeStart, rangeEnd);
    }

    return cs(`${prefixCls}-cell`, {
      [`${prefixCls}-cell-disabled`]: disabled,
      [`${prefixCls}-cell-hidden`]: hideNotInViewDates && !isInView,
      [`${prefixCls}-cell-in-view`]: isInView,
      [`${prefixCls}-cell-today`]: isToday && isInView,
      [`${prefixCls}-cell-selected`]: selected || isRangeStartSelected || isRangeEndSelected,
      [`${prefixCls}-cell-range-start`]: isRangeStart,
      [`${prefixCls}-cell-range-end`]: isRangeEnd,
      [`${prefixCls}-cell-in-range`]:
        checkIsInView && !disabled && isInRange(cellDateObj.time, rangeStart, rangeEnd),
      [`${prefixCls}-cell-hover-range-start`]: isHoverRangeStart,
      [`${prefixCls}-cell-hover-range-end`]: isHoverRangeEnd,
      [`${prefixCls}-cell-hover-in-range`]:
        checkIsInView && !disabled && isInRange(cellDateObj.time, hoverRangeStart, hoverRangeEnd),
      [`${prefixCls}-cell-range-edge-in-hover-range`]: isRangeEdgeInHoverRange,
      [`${prefixCls}-cell-hover-range-edge-in-range`]: isHoverRangeEdgeInRange,
    });
  };
}

```

### Core Architecture Module: `components/DatePicker/util.ts`
```
import dayjs, { Dayjs } from 'dayjs';
import { isArray, isDayjs } from '../_util/is';
import { methods } from '../_util/dayjs';

function getFormat(time) {
  return isDayjs(time) && time.format('HH:mm:ss');
}

export function isTimeArrayChange(prevTime: Dayjs[], nextTime: Dayjs[]) {
  return (
    getFormat(prevTime[0]) !== getFormat(nextTime[0]) ||
    getFormat(prevTime[1]) !== getFormat(nextTime[1])
  );
}

export function getAvailableDayjsLength(value) {
  if (!value) {
    return 0;
  }
  if (isArray(value)) {
    if (isDayjs(value[0]) && isDayjs(value[1])) {
      return 2;
    }
    if (!isDayjs(value[0]) && !isDayjs(value[1])) {
      return 0;
    }
    return 1;
  }
  return 0;
}

// https://github.com/react-component/picker/blob/master/src/utils/dateUtil.ts#L234
export function isDisabledDate(cellDate, disabledDate, mode): boolean {
  if (typeof disabledDate !== 'function') {
    return false;
  }
  // Whether cellDate is disabled in range
  const getDisabledFromRange = (
    currentMode: 'date' | 'month' | 'year',
    start: number,
    end: number
  ) => {
    let current = start;
    while (current <= end) {
      let date: Dayjs;
      switch (currentMode) {
        case 'date': {
          date = methods.set(cellDate, 'date', current);
          if (!disabledDate(date)) {
            return false;
          }
          break;
        }
        case 'month': {
          date = methods.set(cellDate, 'month', current);
          if (!isDisabledDate(date, disabledDate, 'month')) {
            return false;
          }
          break;
        }
        case 'year': {
          date = methods.set(cellDate, 'year', current);
          if (!isDisabledDate(date, disabledDate, 'year')) {
            return false;
          }
          break;
        }
        default:
          break;
      }
      current += 1;
    }
    return true;
  };
  switch (mode) {
    case 'date':
    case 'week': {
      return disabledDate(cellDate);
    }
    case 'month': {
      const startDate = 1;
      const endDate = cellDate.endOf('month').get('date');
      return getDisabledFromRange('date', startDate, endDate);
    }
    case 'quarter': {
      const startMonth = Math.floor(cellDate.get('month') / 3) * 3;
      const endMonth = startMonth + 2;
      return getDisabledFromRange('month', startMonth, endMonth);
    }
    case 'year': {
      return getDisabledFromRange('month', 0, 11);
    }
    default:
      return false;
  }
}

type WeekStartType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function getDefaultWeekStart(dayjsLocale: string): WeekStartType {
  return (dayjs.Ls?.[dayjsLocale]?.weekStart as WeekStartType) || 0;
}

export function getLocaleDayjsValue(
  date: Dayjs | undefined,
  dayjsLocale: string
): Dayjs | undefined {
  return date ? date.locale(dayjsLocale) : date;
}

export function getFormatByIndex(format: string | string[], index: number) {
  return isArray(format) ? format[index] : format;
}

```

### Core Architecture Module: `components/Form/hooks/useContext.ts`
```
import { useCallback, useContext, useEffect, useRef } from 'react';
import { FormInstance, SubmitStatus } from '../interface';
import { FormContext } from '../context';
import warn from '../../_util/warning';
import useForceUpdate from '../../_util/hooks/useForceUpdate';

/**
 * useFormContext 只会返回一些 Form 全局的状态，避免返回某个表单项的状态
 */
const useFormContext = (): { form: FormInstance; disabled: boolean; isSubmitting: boolean } => {
  const formCtx = useContext(FormContext);
  const formInstance = formCtx.store;
  const isSubmittingRef = useRef(false);

  const forceUpdate = useForceUpdate();

  const setSubmitting = useCallback(() => {
    const { submitStatus } = formInstance?.getInnerMethods(true)?.innerGetStoreStatus?.() || {};
    const newIsSubmitting = submitStatus === SubmitStatus.submitting;

    if (newIsSubmitting !== isSubmittingRef.current) {
      isSubmittingRef.current = newIsSubmitting;
      forceUpdate();
    }
  }, []);

  useEffect(() => {
    if (!formInstance) {
      warn(true, 'formInstance is not available');
      return;
    }

    const { registerFormWatcher } = formInstance?.getInnerMethods(true);

    const update = () => setSubmitting();
    update();

    const cancelWatch = registerFormWatcher && registerFormWatcher(update);

    return () => {
      cancelWatch?.();
    };
  }, []);

  return {
    form: formInstance,
    disabled: formCtx.disabled,
    isSubmitting: isSubmittingRef.current,
  };
};

export default useFormContext;

```

### Core Architecture Module: `components/Form/hooks/useState.ts`
```
import isEqualWith from 'lodash/isEqualWith';
import { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { FormInstance, FieldState, KeyType } from '../interface';
import { FormContext } from '../context';
import warn from '../../_util/warning';

// 获取指定 field 的内部状态，参数必填！！
const useFormState = <
  FormData = any,
  FieldValue = FormData[keyof FormData],
  FieldKey extends KeyType = keyof FormData
>(
  field: FieldKey,
  form?: FormInstance
): FieldState<FieldValue> | undefined => {
  const formCtx = useContext(FormContext);

  const formInstance = form || formCtx.store;

  //  if field change, get the real value from fieldRef.current
  const fieldRef = useRef(field);
  fieldRef.current = field;

  const getFieldStateFromStore = useCallback(() => {
    const field = fieldRef.current;
    const formState = formInstance.getFieldsState([field]);

    return formState?.[field];
  }, []);

  const [formState, setFormState] = useState(getFieldStateFromStore);

  const formStateRef = useRef(formState);

  useEffect(() => {
    if (!formInstance) {
      warn(true, 'formInstance is not available');
      return;
    }
    const { registerStateWatcher } = formInstance?.getInnerMethods(true);

    const updateState = () => {
      const newValue = getFieldStateFromStore();

      if (!isEqualWith(formStateRef.current, newValue)) {
        setFormState(newValue);
        formStateRef.current = newValue;
      }
    };

    updateState();

    const cancelWatch = registerStateWatcher && registerStateWatcher(updateState);

    return () => {
      cancelWatch?.();
    };
  }, []);

  return formState;
};

export default useFormState;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3199** (2026-08-24): **fix: prevent redundant OverflowEllipsis updates**
  *Symptoms*: <!--   非常感谢你的 PR 和贡献。    提交前请确认已阅读贡献指南：https://github.com/arco-design/arco-design/blob/main/CONTRIBUTING.md -->  <!-- 请在对应的 "[ ]" 中填写 "x" -->  ## Types of changes  <!-- 这个 PR 包含哪种类型的变更 --> <!-- 这里只选择一种类型。如果包含多种类型，可以在 Changelog 中增加 Type 列。 -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Documentation change - [ ] Coding style change - [ ] Component style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Typescript definition change - [ ] Breaking change - [ ] Others  ## Background and context  当 `Select` 以多选模式使用响应式 `maxTagCount` 时，已选标签会通过 `InputTag` 和 `OverflowEllipsis` 进行渲染。  ```tsx <Select   mode="multiple"   maxTagCount={{ count: 'responsive', showPopover: true }}   options={options} /> ```  在部分嵌入式页面或微前端宿主环境中，`ResizeObserver` 可能会重复上报相同元素和相同宽度。  此前，`OverflowEllipsis` 每次收到通知后都会生成一个新的 `suffixOverflowItems` 状态对象。同时，即使重新计算出的 `maxCount` 没有变化，也仍然会触发状态更新。  这些更新可能形成“渲染—尺寸监听—状态更新”的循环。用户选择一项内容后，React 最终会报错：  ```text Maximum update depth exceeded ```  该问题与页面的布局和尺寸监听触发时机有关，因此在普通独立页面中不一定能够稳定复现，在嵌入式或微前端宿主环境中更容易出现。  ### 复现步骤  1. 使用多选模式的 `Select`，并设置响应式 `maxTagCount`。 2. 将组件渲染在会重复触发 `ResizeObserver` 的布局环境中。 3. 选择任意一个选项。 4. `OverflowEllipsis` 持续触发状态更新，最终出现 `Maximum update depth exceeded`。  ## Solution  将 `OverflowEllipsis` 中的状态更新改为幂等更新：  - 当重新计算得到的 `maxCount` 与当前值一致时，不再调用 `setMaxCount`。 - 当 `ResizeObserver` 上报的节点和宽度均未发生变化时，直接返回原来的 `suffixOverflowItems` 状态。  这样可以避免无效的重复渲染，打断“渲染—尺寸监听—状态更新”的循
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/yzylin0/arco-design/fix-overflow-ellipsis-update-loop?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=yzylin0&repo=arco-design&branch=fix-overflow-ellipsis-update-loop&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=yzylin0&repo=arco-design&branch=fix-overflow-ellipsis-update-loop&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/yzylin0/arco-design/fix-overflow-ellipsis-update-loop?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > <!-- add-pr-comment:add-pr-comment -->  Prepare preview
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arco-design/arco-design/pr/3199/builds/690900) or the icon next to each commit SHA.

- **Issue #3198** (2026-08-24): **主题包无法发布，请问后续会修复吗？或者后续会下架主题包吗？**
  *Symptoms*: 现状：arco主题包只能预览和编辑，点击发布时提示400无法上传，请问后续规划会下架主题包吗？  <img width="1236" height="1572" alt="Image" src="https://github.com/user-attachments/assets/8b8122fe-f0db-4fce-b0d2-0944ed6608c2" />
  **Post-Mortem & Fix Analysis**:
  > 该问题已修复，目前可以正常发布了

- **Issue #3197** (2026-08-07): **fix(Cascader): 修复级联面板宽度变化导致页面抖动**
  *Symptoms*: <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design/blob/main/CONTRIBUTING.md -->  <!-- Put an x in "[ ]" to check a box) -->  ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the Type column in the Changelog. -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Documentation change - [ ] Coding style change - [ ] Component style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Typescript definition change - [ ] Breaking change - [ ] Others  ## Background and context  Cascader 靠近视口边缘且选项文本较长时，展开、同层切换或选择选项会使弹层宽度发生变化。弹层位置更新晚于浏览器布局，页面会短暂产生横向滚动条并出现抖动。  ## Solution  ### 缺陷摘要  - **问题现象**：Cascader 位于页面右侧时，长文本级联菜单在展开层级、同深度切换和选择叶子项的瞬间出现横向滚动条，导致页面抖动。 - **预期结果**：级联面板内容和宽度变化时，弹层在浏览器绘制前完成定位，页面不产生瞬时横向滚动条，同时保留原有动画和自定义列样式。  ### 复现与验证路径  创建靠右布局且包含多级长文本选项的 Cascader。 1. 打开 Cascader，依次展开不同层级。 2. 在相同深度的父选项间切换。 3. 选择末级叶子项并观察弹层退出动画。 4. 在窄视口下重复展开第一项。 5. **验证点**：逐帧检查弹层 `getBoundingClientRect().right` 不超过视口边界，页面无横向滚动条闪烁，选中值与退出动画正常。  ### 问题诊断  - **根因分析**：Cascader 使用 `margin-left` 执行列进入动画，动画持续改变弹层布局宽度；Trigger 的 ResizeObserver 在布局后一帧才重新定位，产生瞬时越界。 - **详细诊断**：     * 激活项的 `transition: all` 会让 `font-weight` 变化持续改变列宽，导致弹层定位完成后继续扩宽。     * 同深度切换、搜索结果、自定义渲染及退出阶段都可能在列数不变时改变面板宽度，单纯监听列数量无法覆盖。     * Trigger 使用整数 `offsetWidth` 参与定位，在缩放和亚像素布局下可能产生小于 1px 的边界误差。     
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/arco-design/arco-design/sync-arco/fix-cascader-popup-jitter?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=sync-arco/fix-cascader-popup-jitter&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=sync-arco/fix-cascader-popup-jitter&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/arco-design/arco-design/sync-arco/fix-cascader-popup-jitter?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > <!-- add-pr-comment:add-pr-comment -->  Prepare preview
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arco-design/arco-design/pr/3197/builds/690005) or the icon next to each commit SHA.

- **Issue #3194** (2026-07-16): **Form表单setFieldsValue后getFields拿不到最新修改的值**
  *Symptoms*: - [ ] I'm sure this does not appear in [the issue list of the repository](https://github.com/arco-design/arco-design/issues)  ## Basic Info  - **Package Name And Version:** @arco-design/web-react@2.66.15 - **Framework version:** react18 - **Browser:** chrome150.0.0.0  ## What is expected? getFields应该返回所有表单项修改后的最新值  ## Steps to reproduce 场景：更新数据的分步表单 1. 使用setFieldsValue回填表单数据 2. 使用getFields获取所有表单项的值 3. getFields返回的是setFieldsValue时传递的值  <!--- Disclaimer: Submitting offensive issues will result in being blocked from arco-design organization. --> <!-- generated by arco-issue. DO NOT REMOVE -->

- **Issue #3193** (2026-07-14): **fix(Table): 修复操作列左边线判断**
  *Symptoms*: - 表体操作列不再基于写死的索引添加 col-first，避免操作列不在首列时错误绘制左边线 - 表头操作列按真实 colIndex 补充 col-first，与表体列位置判断保持一致  <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design/blob/main/CONTRIBUTING.md -->  <!-- Put an `x` in "[ ]" to check a box) -->  ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the `Type` column in the Changelog. -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Documentation change - [ ] Coding style change - [ ] Component style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Typescript definition change - [ ] Breaking change - [ ] Others   ## Background and context  <!-- Explain what problem does the PR solve --> <!-- Link to related open issues if applicable -->  ## Solution  <!-- Describe how the problem is fixed in detail -->  ## How is the change tested?  <!-- Unit tests should be added/updated for bug fixes and new features, if applicable --> <!-- Please describe how you tested the change. E.g. Creating/updating unit tests or attaching a screenshot of how it works with your change -->  ## Changelog  | Component | Changelog(CN) | Changelog(EN) | Related issues | | --------- | ------------- | ------------- | -------------- | | Table          | 修复操作列左边线判断，帮忙边线缺失或者多余         
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/arco-design/arco-design/fix-table-border?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=fix-table-border&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=fix-table-border&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/arco-design/arco-design/fix-table-border?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > <!-- add-pr-comment:add-pr-comment -->  Prepare preview
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arco-design/arco-design/pr/3193/builds/688128) or the icon next to each commit SHA.

- **Issue #3192** (2026-07-14): **fix(Trigger): 修复弹层横向边界计算**
  *Symptoms*: <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design/blob/main/CONTRIBUTING.md -->  <!-- Put an `x` in "[ ]" to check a box) -->  ## Types of changes  - [x] Bug fix  ## Background and context  When `Trigger` is rendered inside a custom `popupContainer`, the horizontal boundary calculation may use `mountContainer.scrollWidth`. Because the absolutely positioned popup itself can expand the container scroll width, the computed max left value becomes larger than the actual visible area, which causes incorrect popup positioning.  ## Solution  Use the visible parent container width to calculate the horizontal available area instead of directly relying on `mountContainer.scrollWidth`.  Fallback order: 1. parent `clientWidth` 2. mount container `clientWidth` 3. mount container `scrollWidth`  ## How is the change tested?  Code inspection only in current workspace.  Local test was not completed because project dependencies are not installed in this environment (`arco-scripts: command not found`).  ## Changelog  | Component | Changelog(CN) | Changelog(EN) | Related issues | | --------- | ------------- | ------------- | -------------- | | Trigger | 修复 Trigger 在自定义容器中计算横向边界时，因弹层撑大容器宽度导致定位异常的问题。 | Fix a Trigger positioning issue where horizontal bounds inside a custom container could be miscalculated because the popup itself inflated the
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/wsm972774037/arco-design/fix/trigger-popup-visible-area?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=wsm972774037&repo=arco-design&branch=fix/trigger-popup-visible-area&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=wsm972774037&repo=arco-design&branch=fix/trigger-popup-visible-area&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/wsm972774037/arco-design/fix/trigger-popup-visible-area?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > <!-- add-pr-comment:add-pr-comment -->  Prepare preview
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arco-design/arco-design/pr/3192/builds/688114) or the icon next to each commit SHA.

- **Issue #3178** (2026-05-06): **fix(Image): 修复Image.Preview 弹出层关闭按钮点击事件冒泡，导致误触发父元素的click事件的问题**
  *Symptoms*:  <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design/blob/main/CONTRIBUTING.md -->  <!-- Put an x in "[ ]" to check a box) -->  ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the Type column in the Changelog. -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Documentation change - [ ] Coding style change - [ ] Component style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Typescript definition change - [ ] Breaking change - [ ] Others   ## Background and context   <!-- Explain what problem does the PR solve --> <!-- Link to related open issues if applicable -->  ## Solution  ### 缺陷摘要  - **问题现象**：点击 `Image.Preview` 右上角关闭按钮时会冒泡到外层容器，误触发父元素 `onClick`。 - **预期结果**：点击预览关闭按钮只关闭预览，不触发父元素事件。  ### 复现与验证路径  1. 点击“查看图片”按钮打开 `Image.Preview` 2. 点击预览右上角关闭按钮 3. **验证点**：预览关闭且控制台不打印父元素点击日志  ### 问题诊断  - **根因分析**：关闭按钮点击事件未拦截冒泡，Portal 内点击继续冒泡到触发预览的父节点。 - **详细诊断**：     * `components/Image/image-preview.tsx` 中：`onCloseClick` 只调用 `close()`，未执行 `stopPropagation`，关闭按钮事件会继续向上冒泡。     * `components/Image/__test__/preview.test.tsx` 中：现有关闭测试只校验 `onVisibleChange`，未覆盖父元素点击误触发场景。  ### 修复方案  - **解决思路**：在关闭按钮点击链路拦截冒泡，并补充回归测试锁定父元素点击场景。 - **代码变更**：     1. `components/Image/image-preview.tsx`    
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/arco-design/arco-design/sync-arco/fix-preview-0427-065604?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=sync-arco/fix-preview-0427-065604&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=sync-arco/fix-preview-0427-065604&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/arco-design/arco-design/sync-arco/fix-preview-0427-065604?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > <!-- add-pr-comment:add-pr-comment -->  Prepare preview
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arco-design/arco-design/pr/3178/builds/678432) or the icon next to each commit SHA.

- **Issue #3177** (2026-05-06): **fix(Tree): 修复修复 Tree 在 Modal 中使用虚拟列表时，展开/关闭节点或 loadMore 完成后,由于VirtualList 数据变更后的滚动校准过度、旧虚拟窗口状态未及时重算，以及浏览器焦点/scroll anchoring 对虚拟 DOM 重排产生自动滚动补偿导致的滚动条跳动问题**
  *Symptoms*: …List 数据变更后的滚动校准过度、旧虚拟窗口状态未及时重算，以及浏览器焦点/scroll anchoring 对虚拟 DOM 重排产生自动滚动补偿导致的滚动条跳动问题  <!--   Thanks so much for your PR and contribution.    Before submitting, please make sure to follow the Pull Request Guidelines: https://github.com/arco-design/arco-design/blob/main/CONTRIBUTING.md -->  <!-- Put an `x` in "[ ]" to check a box) -->  ## Types of changes  <!-- What types of changes does this PR introduce --> <!-- Only support choose one type, if there are multiple types, you can add the `Type` column in the Changelog. -->  - [ ] New feature - [x] Bug fix - [ ] Enhancement - [ ] Documentation change - [ ] Coding style change - [ ] Component style change - [ ] Refactoring - [ ] Test cases - [ ] Continuous integration - [ ] Typescript definition change - [ ] Breaking change - [ ] Others   ## Background and context  <!-- Explain what problem does the PR solve --> <!-- Link to related open issues if applicable -->  ## Solution ## 复现步骤 1. 创建Modal，内部包含Tree组件，开启虚拟滚动 virtualListProps 2. Tree包含多层级节点，节点数量较多，包含loadMore 3. 滚动Tree到任意位置 4. 展开某个节点，等子节点加载完成 5. 继续滚动，观察到滚动条上下跳动，位置不稳定 6. 向下滚动很长距离，展开某个节点，等子节点加载完成，向上可能滚动很短距离就到顶了  ## 根因 Tree 虚拟滚动底层使用 `components/_class/VirtualList`。节点展开/收起或 `loadMore` 完成后，Tree 的可见节点列表会发生插入/删除，`VirtualList` 会在 `data.length` 变化时主动校准滚动位置。  原逻辑存在以下问题：  1. 校准条件过宽：只要虚拟列表数据长度变化且 diff index 非空，就会调用 `internalScrollTo` 重新设置 `scrollTop`。Tree 展开当前视口内节点时，首屏内容本身没有跳动，只有列表中部的内部定位项受到插入影响；此时继续校准会额外拨动滚动条，所以表现为“元素位置是对的，但滚动条抽搐”。 2. 视口内数据变
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/arco-design/arco-design/fix-tree-virtualist-debonce?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=fix-tree-virtualist-debonce&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=arco-design&repo=arco-design&branch=fix-tree-virtualist-debonce&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/arco-design/arco-design/fix-tree-virtualist-debonce?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > <!-- add-pr-comment:add-pr-comment -->  Prepare preview
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arco-design/arco-design/pr/3177/builds/678429) or the icon next to each commit SHA.

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

### Incident Patch 1: `c2b050d9` (2026-08-24)
**Commit Message**: fix: prevent redundant OverflowEllipsis updates (#3199)

**File**: `components/_class/OverflowEllipsis/__test__/index.test.tsx` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+import React from 'react';
+import { render } from '../../../../tests/util';
+import OverflowEllipsis from '..';
+
+jest.mock('../../../_util/resizeObserver', () => {
+  const ReactModule = require('react') as typeof React;
+
+  return function MockResizeObserver(props: {
+    children: React.ReactNode;
+    onResize?: (entries: ResizeObserverEntry[]) => void;
+  }) {
+    const targetRef = ReactModule.useRef<HTMLDivElement>();
+    const child = props.children as React.ReactElement<{ className?: string }>;
+    const isSuffixItem = child.props.className?.includes('arco-overflow-suffix-item');
+
+    ReactModule.useLayoutEffect(() => {
+      if (targetRef.current && isSuffixItem) {
+        props.onResize?.([{ target: targetRef.current } as unknown as ResizeObserverEntry]);
+      }
+    });
+
+    return ReactModule.createElement('div', { ref: targetRef }, props.children);
+  };
+});
+
+describe('OverflowEllipsis', () => {
+  it('does not loop when the suffix resize observer repeatedly reports the same size', () => {
+    expect(() => {
+      render(
+        <OverflowEllipsis
+          items={[<span key="tag">tag</span>]}
+          suffixItems={[<span key="input">input</span>]}
+        />
+      );
+    }).not.toThrow();
+  });
+});
```

**File**: `components/_class/OverflowEllipsis/index.tsx` (modified, +11/-3)
```diff
@@ -58,8 +58,11 @@ export default function OverflowEllipsis(props: OverflowEllipsisProps) {
       totalWidth += target?.width || 0;
     });
 
-    setMaxCount(Math.max(newMaxCount, 0));
-  }, [overflowItems, containerWidth, suffixOverflowItems]);
+    const nextMaxCount = Math.max(newMaxCount, 0);
+    if (maxCount !== nextMaxCount) {
+      setMaxCount(nextMaxCount);
+    }
+  }, [overflowItems, containerWidth, suffixOverflowItems, maxCount]);
 
   return (
     <ResizeObserver
@@ -102,9 +105,14 @@ export default function OverflowEllipsis(props: OverflowEllipsisProps) {
               className={`${prefixCls}-suffix-item`}
               onResize={(node) => {
                 setSuffixOverflowItems((suffixOverflowItems) => {
+                  const width = node.clientWidth;
+                  const currentItem = suffixOverflowItems[key];
+                  if (currentItem?.node === node && currentItem.width === width) {
+                    return suffixOverflowItems;
+                  }
                   return {
                     ...suffixOverflowItems,
-                    [`${key}`]: { node, width: node.clientWidth },
+                    [`${key}`]: { node, width },
                   };
                 });
               }}
```

---

### Incident Patch 2: `8b3ae75b` (2026-08-07)
**Commit Message**: fix(Cascader): 修复级联面板宽度变化导致页面抖动 (#3197)

在级联面板内容变化和退出动画绘制前同步更新弹层位置，并使用不影响布局宽度的列动画，避免靠近视口边缘时产生瞬时横向滚动条。保留自定义列 transform，并覆盖搜索、同层切换和叶子选择等动态宽度场景。

Co-authored-by: lingyunsong <[REDACTED_EMAIL]>
Co-authored-by: GeniusCode <[REDACTED_EMAIL]>

**File**: `components/Cascader/__test__/index.test.tsx` (modified, +72/-0)
```diff
@@ -3,6 +3,8 @@ import { act } from 'react-test-renderer';
 import mountTest from '../../../tests/mountTest';
 import componentConfigTest from '../../../tests/componentConfigTest';
 import Cascader from '../cascader';
+import CascaderPanel from '../panel/list';
+import Store from '../base/store';
 import { fireEvent, render } from '../../../tests/util';
 
 mountTest(Cascader);
@@ -105,6 +107,76 @@ describe('Cascader basic test', () => {
     );
     expect(wrapper.querySelector('.arco-cascader-view-value')).toHaveTextContent('上海');
   });
+
+  it('preserves custom column transform after enter animation', () => {
+    const store = new Store(options);
+    const wrapper = render(
+      <CascaderPanel
+        store={store}
+        value={[]}
+        prefixCls="arco-cascader"
+        popupVisible
+        dropdownMenuColumnStyle={{ transform: 'scale(0.9)' }}
+        getTriggerElement={() => null}
+        icons={{}}
+      />
+    );
+
+    fireEvent.click(wrapper.find(`${prefixCls}-list-item-label`)[0]);
+    act(() => {
+      jest.runAllTimers();
+    });
+
+    expect(wrapper.find(`${prefixCls}-list-column`)[1]).toHaveStyle({ transform: 'scale(0.9)' });
+  });
+
+  it('updates popup position synchronously when panel content changes', () => {
+    const updatePopupPosition = jest.fn();
+    const store = new Store([
+      ...options,
+      {
+        value: 'beijing',
+        label: '北京',
+        children: [{ value: 'beijingshi', label: '北京市' }],
+      },
+    ]);
+    const wrapper = render(
+      <CascaderPanel
+        store={store}
+        value={[]}
+        prefixCls="arco-cascader"
+        popupVisible
+        updatePopupPosition={updatePopupPosition}
+        getTriggerElement={() => null}
+        icons={{}}
+      />
+    );
+
+    updatePopupPosition.mockClear();
+    fireEvent.click(wrapper.find(`${prefixCls}-list-item-label`)[0]);
+
+    expect(wrapper.find(`${prefixCls}-list-column`)).toHaveLength(2);
+    expect(updatePopupPosition).toHaveBeenCalledTimes(1);
+
+    updatePopupPosition.mockClear();
+    fireEvent.click(wrapper.find(`${prefixCls}-list-item-label`)[1]);
+    expect(wrapper.find(`${prefixCls}-list-column`)).toHaveLength(2);
+    expect(updatePopupPosition).toHaveBeenCalledTimes(1);
+
+    updatePopupPosition.mockClear();
+    wrapper.rerender(
+      <CascaderPanel
+        store={store}
+        value={[]}
+        prefixCls="arco-cascader"
+        popupVisible={false}
+        updatePopupPosition={updatePopupPosition}
+        getTriggerElement={() => null}
+        icons={{}}
+      />
+    );
+    expect(updatePopupPosition).toHaveBeenCalledTimes(1);
+  });
 });
 
 let wrapper;
```

**File**: `components/Cascader/cascader.tsx` (modified, +5/-0)
```diff
@@ -115,6 +115,7 @@ function Cascader<T extends OptionProps>(baseProps: CascaderProps<T>, ref) {
   const refOnInputChangeCallbackReason = useRef<InputValueChangeReason>(null);
 
   const selectRef = useRef(null);
+  const triggerRef = useRef<Trigger>();
   // 暂存被选中的值对应的节点。仅在onSearch的时候用到
   // 避免出现下拉列表改变，之前选中的option找不到对应的节点，展示上会出问题。
   const stashNodes = useRef<Store<T>['nodes']>(store?.getCheckedNodes() || []);
@@ -359,6 +360,7 @@ function Cascader<T extends OptionProps>(baseProps: CascaderProps<T>, ref) {
                 }
                 // TODO 组件重构，解耦面板选择和输入框，面板可独立使用
                 getTriggerElement={() => selectRef.current?.dom}
+                updatePopupPosition={() => triggerRef.current?.updatePopupPositionSync()}
                 value={mergeValue}
                 virtualListProps={props.virtualListProps}
                 defaultActiveFirstOption={props.defaultActiveFirstOption}
@@ -382,6 +384,7 @@ function Cascader<T extends OptionProps>(baseProps: CascaderProps<T>, ref) {
                 prefixCls={prefixCls}
                 rtl={rtl}
                 getTriggerElement={() => selectRef.current?.dom}
+                updatePopupPosition={() => triggerRef.current?.updatePopupPositionSync()}
                 renderEmpty={renderEmptyEle}
                 popupVisible={popupVisible}
                 value={mergeValue}
@@ -410,13 +413,15 @@ function Cascader<T extends OptionProps>(baseProps: CascaderProps<T>, ref) {
   const renderView = (eleView: ReactElement | ReactNode) => {
     return (
       <Trigger
+        ref={triggerRef}
         popup={renderPopup}
         trigger={props.trigger}
         disabled={disabled}
         getPopupContainer={getPopupContainer}
         position={rtl ? 'br' : 'bl'}
         classNames="slideDynamicOrigin"
         popupAlign={triggerPopupAlign}
+        boundaryDistance={rtl ? { left: 1 } : { right: 1 }}
         // 动态加载时，unmountOnExit 默认为false。
         unmountOnExit={'unmountOnExit' in props ? props.unmountOnExit : !isFunction(props.loadMore)}
         popupVisible={popupVisible}
```

**File**: `components/Cascader/interface.ts` (modified, +1/-0)
```diff
@@ -316,6 +316,7 @@ export interface CascaderPanelProps<T> {
   dropdownColumnRender?: CascaderProps<T>['dropdownColumnRender'];
   dropdownMenuColumnStyle?: CascaderProps<T>['dropdownMenuColumnStyle'];
   getTriggerElement: () => HTMLElement;
+  updatePopupPosition?: () => void;
   icons?: {
     loading?: ReactNode;
     checked?: ReactNode;
```

**File**: `components/Cascader/panel/list.tsx` (modified, +10/-3)
```diff
@@ -9,6 +9,7 @@ import useRefs from '../../_util/hooks/useRefs';
 import useForceUpdate from '../../_util/hooks/useForceUpdate';
 import { ArrowDown, Esc, Enter, ArrowUp, ArrowRight, ArrowLeft } from '../../_util/keycode';
 import useUpdate from '../../_util/hooks/useUpdate';
+import useIsomorphicLayoutEffect from '../../_util/hooks/useIsomorphicLayoutEffect';
 import Node from '../base/node';
 import { getMultipleCheckValue } from '../util';
 import VirtualList, { VirtualListHandle } from '../../_class/VirtualList';
@@ -262,6 +263,10 @@ const ListPanel = <T extends OptionProps>(props: CascaderPanelProps<T>) => {
     ? props.dropdownColumnRender
     : (menu) => menu;
 
+  useIsomorphicLayoutEffect(() => {
+    props.updatePopupPosition?.();
+  });
+
   return !menus.length || !menus[0]?.length ? (
     <>{renderEmpty()}</>
   ) : (
@@ -279,15 +284,17 @@ const ListPanel = <T extends OptionProps>(props: CascaderPanelProps<T>) => {
             classNames="cascaderSlide"
             onEnter={(e: HTMLDivElement) => {
               if (!e) return;
-              e.style.marginLeft = `-${e.scrollWidth}px`;
+              const columnTransform = props.dropdownMenuColumnStyle?.transform || '';
+              e.style.transform = `translateX(-${e.scrollWidth}px) ${columnTransform}`.trim();
             }}
             onEntering={(e: HTMLDivElement) => {
               if (!e) return;
-              e.style.marginLeft = `0px`;
+              const columnTransform = props.dropdownMenuColumnStyle?.transform || '';
+              e.style.transform = `translateX(0) ${columnTransform}`.trim();
             }}
             onEntered={(e) => {
               if (!e) return;
-              e.style.marginLeft = '';
+              e.style.transform = props.dropdownMenuColumnStyle?.transform || '';
             }}
           >
             <div
```

**File**: `components/Cascader/panel/search-panel.tsx` (modified, +6/-0)
```diff
@@ -13,6 +13,7 @@ import { isString, isObject, isFunction } from '../../_util/is';
 import { getMultipleCheckValue } from '../util';
 import VirtualList from '../../_class/VirtualList';
 import { on, off } from '../../_util/dom';
+import useIsomorphicLayoutEffect from '../../_util/hooks/useIsomorphicLayoutEffect';
 
 export const getLegalIndex = (currentIndex, maxIndex) => {
   if (currentIndex < 0) {
@@ -39,6 +40,7 @@ export type SearchPanelProps<T> = {
   defaultActiveFirstOption: boolean;
   renderOption?: (inputValue: string, node: NodeProps<T>, options: extraOptions) => ReactNode;
   getTriggerElement: () => HTMLElement;
+  updatePopupPosition?: () => void;
   icons?: {
     loading?: ReactNode;
     checked?: ReactNode;
@@ -186,6 +188,10 @@ const SearchPanel = <T extends OptionProps>(props: SearchPanelProps<T>) => {
 
   refActiveItem.current = null;
 
+  useIsomorphicLayoutEffect(() => {
+    props.updatePopupPosition?.();
+  });
+
   return options.length ? (
     <div className={`${prefixCls}-list-wrapper`}>
       <VirtualList
```

**File**: `components/Cascader/style/index.less` (modified, +3/-2)
```diff
@@ -159,7 +159,8 @@
 
     &-item {
       &-active {
-        transition: all @transition-duration-2 @transition-timing-function-linear;
+        transition: color @transition-duration-2 @transition-timing-function-linear,
+          background-color @transition-duration-2 @transition-timing-function-linear;
         background-color: @cascader-color-item-bg_active;
         color: @cascader-color-item-text_active;
         font-weight: @cascader-font-item-weight_active;
@@ -213,7 +214,7 @@
 
 .cascaderSlide-enter-active,
 .cascaderSlide-appear-active {
-  transition: margin @transition-duration-3 @transition-timing-function-standard;
+  transition: transform @transition-duration-3 @transition-timing-function-standard;
 }
 
 @import './rtl.less';
```

**File**: `components/Trigger/index.tsx` (modified, +17/-9)
```diff
@@ -566,6 +566,20 @@ class Trigger extends PureComponent<TriggerProps, TriggerState> {
     return this.getRootElement();
   };
 
+  updatePopupPositionSync = () => {
+    if (this.unmount) {
+      return;
+    }
+
+    const target = this.triggerRef.current;
+    const popupStyle = this.getPopupStyle();
+    if (target && popupStyle) {
+      const style = this.props.style || {};
+      target.style.top = String(style.top || `${popupStyle.top}px`);
+      target.style.left = String(style.left || `${popupStyle.left}px`);
+    }
+  };
+
   updatePopupPosition = (delay = 0, callback?: () => void) => {
     const currentVisible = this.state.popupVisible;
     if (!currentVisible) {
@@ -1138,15 +1152,9 @@ class Trigger extends PureComponent<TriggerProps, TriggerState> {
       >
         <ResizeObserver
           onResize={() => {
-            const target = this.triggerRef.current;
-            if (target) {
-              // Avoid the flickering problem caused by the size change and positioning not being recalculated in time.
-              // TODO: Consider changing the popup style directly  in the next major version
-              const popupStyle = this.getPopupStyle();
-              const style = this.props.style || {};
-              target.style.top = String(style.top || `${popupStyle.top}px`);
-              target.style.left = String(style.left || `${popupStyle.left}px`);
-            }
+            // Avoid the flickering problem caused by the size change and positioning not being recalculated in time.
+            // TODO: Consider changing the popup style directly  in the next major version
+            this.updatePopupPositionSync();
             this.onResize();
           }}
           getTargetDOMNode={() => this.getPopupElement()}
```

**File**: `stories/Private Components/BugFix.story.tsx` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+/* eslint-disable no-console */
+import React from 'react';
+import { Cascader } from '@self';
+
+const options = [
+  {
+    value: 'beijing',
+    label: 'Beijing Municipality Very Long Option Text',
+    children: [
+      {
+        value: 'Beijing',
+        label: 'Beijing Urban Area Very Long Option Text',
+        children: [
+          {
+            value: 'chaoyang',
+            label: 'Chaoyang District Very Long Option Text',
+            children: [
+              {
+                value: 'datunli',
+                label: 'Datunli Subdistrict Very Long Option Text',
+              },
+            ],
+          },
+        ],
+      },
+    ],
+  },
+  {
+    value: 'shanghai',
+    label: 'Shanghai Municipality Very Long Option Text',
+    children: [
+      {
+        value: 'shanghaishi',
+        label: 'Shanghai Urban Area Very Long Option Text',
+        children: [
+          {
+            value: 'huangpu',
+            label: 'Huangpu District Very Long Option Text',
+          },
+        ],
+      },
+    ],
+  },
+];
+
+const Demo1 = () => {
+  return (
+    <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
+      <Cascader
+        placeholder="Please select ..."
+        style={{ width: 300 }}
+        options={options}
+        onChange={(value, option) => {
+          console.log(value, option);
+        }}
+        allowClear
+      />
+    </div>
+  );
+};
+
+export const Demo = () => <Demo1 />;
+export default {
+  title: 'Private Components/BugFix',
+};
```

---

### Incident Patch 3: `dccbaceb` (2026-07-14)
**Commit Message**: fix(Table): 修复操作列左边线判断

- 表体操作列不再基于写死的索引添加 col-first，避免操作列不在首列时错误绘制左边线
- 表头操作列按真实 colIndex 补充 col-first，与表体列位置判断保持一致

**File**: `components/Table/__test__/__snapshots__/demo.test.ts.snap` (modified, +65/-65)
```diff
@@ -609,7 +609,7 @@ exports[`renders Table/demo/attribution.md correctly 1`] = `
                       class="arco-table-tr"
                     >
                       <th
-                        class="arco-table-th arco-table-operation arco-table-checkbox"
+                        class="arco-table-th arco-table-operation arco-table-checkbox arco-table-col-first"
                       >
                         <div
                           class="arco-table-th-item"
@@ -705,7 +705,7 @@ exports[`renders Table/demo/attribution.md correctly 1`] = `
                       class="arco-table-tr"
                     >
                       <td
-                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                       >
                         <label
                           class="arco-checkbox"
@@ -795,7 +795,7 @@ exports[`renders Table/demo/attribution.md correctly 1`] = `
                       class="arco-table-tr"
                     >
                       <td
-                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                       >
                         <label
                           class="arco-checkbox"
@@ -885,7 +885,7 @@ exports[`renders Table/demo/attribution.md correctly 1`] = `
                       class="arco-table-tr"
                     >
                       <td
-                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                       >
                         <label
                           class="arco-checkbox"
@@ -975,7 +975,7 @@ exports[`renders Table/demo/attribution.md correctly 1`] = `
                       class="arco-table-tr"
                     >
                       <td
-                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                       >
                         <label
                           class="arco-checkbox"
@@ -1065,7 +1065,7 @@ exports[`renders Table/demo/attribution.md correctly 1`] = `
                       class="arco-table-tr"
                     >
                       <td
-                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                        class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                       >
                         <label
                           class="arco-checkbox"
@@ -1714,7 +1714,7 @@ exports[`renders Table/demo/data-children.md correctly 1`] = `
                     class="arco-table-tr"
                   >
                     <th
-                      class="arco-table-th arco-table-operation arco-table-checkbox"
+                      class="arco-table-th arco-table-operation arco-table-checkbox arco-table-col-first"
                     >
                       <div
                         class="arco-table-th-item"
@@ -1810,7 +1810,7 @@ exports[`renders Table/demo/data-children.md correctly 1`] = `
                     class="arco-table-tr"
                   >
                     <td
-                      class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                      class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                     >
                       <label
                         class="arco-checkbox"
@@ -1921,7 +1921,7 @@ exports[`renders Table/demo/data-children.md correctly 1`] = `
                     class="arco-table-tr"
                   >
                     <td
-                      class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                      class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                     >
                       <label
                         class="arco-checkbox"
@@ -2032,7 +2032,7 @@ exports[`renders Table/demo/data-children.md correctly 1`] = `
                     class="arco-table-tr"
                   >
                     <td
-                      class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                      class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
              
```

**File**: `components/Table/__test__/components.test.tsx` (modified, +1/-1)
```diff
@@ -143,7 +143,7 @@ describe('Table components', () => {
     jest.runAllTimers();
 
     expect(component.find('tbody .arco-table-checkbox').item(0).className).toBe(
-      'arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-tooltip-open'
+      'arco-table-td arco-table-operation arco-table-checkbox arco-tooltip-open'
     );
   });
 
```

**File**: `components/Table/__test__/fixed-columns.test.tsx` (modified, +2/-2)
```diff
@@ -87,7 +87,7 @@ describe('Table fixed columns', () => {
     }
 
     expect(getHeadCell(0).className).toBe(
-      'arco-table-th arco-table-operation arco-table-expand arco-table-col-fixed-left'
+      'arco-table-th arco-table-operation arco-table-expand arco-table-col-fixed-left arco-table-col-first'
     );
     expect(getHeadCell(0).getAttribute('style')).toEqual('left: 0px;');
 
@@ -97,7 +97,7 @@ describe('Table fixed columns', () => {
     expect(getHeadCell(1).getAttribute('style')).toEqual('left: 40px;');
 
     expect(getBodyCell(0).className).toBe(
-      'arco-table-td arco-table-operation arco-table-expand-icon-cell arco-table-col-first arco-table-col-fixed-left arco-table-col-first'
+      'arco-table-td arco-table-operation arco-table-expand-icon-cell arco-table-col-fixed-left arco-table-col-first'
     );
     expect(getBodyCell(0).getAttribute('style')).toEqual('left: 0px;');
 
```

**File**: `components/Table/__test__/group-columns.test.tsx` (modified, +3/-1)
```diff
@@ -53,7 +53,9 @@ describe('Table group columns', () => {
     function getRowCell(rowIndex, colIndex) {
       return component.find('tr').item(rowIndex).querySelectorAll('th').item(colIndex);
     }
-    expect(getRowCell(0, 0).className).toBe('arco-table-th arco-table-operation arco-table-expand');
+    expect(getRowCell(0, 0).className).toBe(
+      'arco-table-th arco-table-operation arco-table-expand arco-table-col-first'
+    );
     expect(getRowCell(0, 0).getAttribute('rowSpan')).toBe('2');
 
     expect(getRowCell(0, 1).className).toBe(
```

**File**: `components/Table/tbody/tr.tsx` (modified, +6/-5)
```diff
@@ -75,11 +75,12 @@ function Tr<T>(props: TrType<T>, ref) {
       ? rowSelection.checkboxProps(originRecord)
       : {};
   const operationClassName = cs(`${prefixCls}-td`, `${prefixCls}-operation`);
-  const getPrefixColClassName = (name, index) => {
+  // col-first 由外层 columns.map 中的 cloneElement 按真实 colIndex 统一判定，
+  // 此处不再根据写死的 index 添加，避免操作列不在首列时错误地画出左边线。
+  const getPrefixColClassName = (name) => {
     return cs(operationClassName, `${prefixCls}-${name}`, {
       [`${prefixCls}-selection-col`]: (virtualized && type === 'checkbox') || type === 'radio',
       [`${prefixCls}-expand-icon-col`]: virtualized && expandedRowRender,
-      [`${prefixCls}-col-first`]: index === 0,
     });
   };
 
@@ -146,7 +147,7 @@ function Tr<T>(props: TrType<T>, ref) {
   }
 
   const expandNode = expandedRowRender && (
-    <InnerComponentTd className={getPrefixColClassName('expand-icon-cell', 0)}>
+    <InnerComponentTd className={getPrefixColClassName('expand-icon-cell')}>
       {shouldRenderExpandRow && renderExpandIcon(record, rowK)}
     </InnerComponentTd>
   );
@@ -175,7 +176,7 @@ function Tr<T>(props: TrType<T>, ref) {
 
   if (type === 'checkbox') {
     selectionNode = (
-      <InnerComponentTd className={getPrefixColClassName('checkbox', expandNode ? 1 : 0)}>
+      <InnerComponentTd className={getPrefixColClassName('checkbox')}>
         {renderSelectionCell
           ? renderSelectionCell(checkboxNode, checked, originRecord)
           : checkboxNode}
@@ -184,7 +185,7 @@ function Tr<T>(props: TrType<T>, ref) {
   }
   if (type === 'radio') {
     selectionNode = (
-      <InnerComponentTd className={getPrefixColClassName('radio', expandNode ? 1 : 0)}>
+      <InnerComponentTd className={getPrefixColClassName('radio')}>
         {renderSelectionCell ? renderSelectionCell(radioNode, checked, originRecord) : radioNode}
       </InnerComponentTd>
     );
```

**File**: `components/Table/thead/index.tsx` (modified, +5/-1)
```diff
@@ -127,7 +127,11 @@ function THead<T>(props: TheadProps<T>) {
                   className: cs(
                     isExtraOperation ? operationClassName : '',
                     operationNode?.props?.className,
-                    stickyClassName
+                    stickyClassName,
+                    {
+                      // 与表体保持一致：首列操作单元格需要 col-first 才能画出左边线
+                      [`${prefixCls}-col-first`]: colIndex === 0,
+                    }
                   ),
                   style: {
                     ...operationNode?.props?.style,
```

**File**: `components/Transfer/__test__/__snapshots__/demo.test.ts.snap` (modified, +6/-6)
```diff
@@ -5024,7 +5024,7 @@ exports[`renders Transfer/demo/with-table.md correctly 1`] = `
                         class="arco-table-tr"
                       >
                         <th
-                          class="arco-table-th arco-table-operation arco-table-checkbox"
+                          class="arco-table-th arco-table-operation arco-table-checkbox arco-table-col-first"
                         >
                           <div
                             class="arco-table-th-item"
@@ -5199,7 +5199,7 @@ exports[`renders Transfer/demo/with-table.md correctly 1`] = `
                         class="arco-table-tr"
                       >
                         <td
-                          class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                          class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                         >
                           <label
                             class="arco-checkbox"
@@ -5276,7 +5276,7 @@ exports[`renders Transfer/demo/with-table.md correctly 1`] = `
                         class="arco-table-tr"
                       >
                         <td
-                          class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                          class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                         >
                           <label
                             class="arco-checkbox"
@@ -5353,7 +5353,7 @@ exports[`renders Transfer/demo/with-table.md correctly 1`] = `
                         class="arco-table-tr"
                       >
                         <td
-                          class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                          class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                         >
                           <label
                             class="arco-checkbox"
@@ -5430,7 +5430,7 @@ exports[`renders Transfer/demo/with-table.md correctly 1`] = `
                         class="arco-table-tr"
                       >
                         <td
-                          class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first arco-table-col-first"
+                          class="arco-table-td arco-table-operation arco-table-checkbox arco-table-col-first"
                         >
                           <label
                             class="arco-checkbox"
@@ -5646,7 +5646,7 @@ exports[`renders Transfer/demo/with-table.md correctly 1`] = `
                         class="arco-table-tr"
                       >
                         <th
-                          class="arco-table-th arco-table-operation arco-table-checkbox"
+                          class="arco-table-th arco-table-operation arco-table-checkbox arco-table-col-first"
                         >
                           <div
                             class="arco-table-th-item"
```

---

### Incident Patch 4: `70611973` (2026-07-14)
**Commit Message**: fix(Trigger): 修复弹层横向边界计算

**File**: `components/Trigger/getPopupStyle.ts` (modified, +29/-2)
```diff
@@ -213,6 +213,29 @@ const getViewportSize = (_boundaryDistance: TriggerProps['boundaryDistance']) =>
   };
 };
 
+const getContainerVisibleArea = (
+  mountContainer: Element,
+  viewportWidth: number,
+  boundaryLeft: number
+): { left: number; width: number } => {
+  const parent = mountContainer.parentNode as HTMLElement | null;
+
+  if (!parent || parent === document.body || parent === document.documentElement) {
+    return {
+      left: boundaryLeft,
+      width: viewportWidth,
+    };
+  }
+
+  return {
+    left: 0,
+    width:
+      parent.clientWidth ||
+      (mountContainer as HTMLElement).clientWidth ||
+      mountContainer.scrollWidth,
+  };
+};
+
 export default (
   props: TriggerProps,
   content: HTMLElement,
@@ -359,8 +382,12 @@ export default (
     if (style.left < 0) {
       style.left = 0;
     } else {
-      // 限制在popupContainer中，左侧最大为 mountContainer.scrollWidth - contentSize.width，保证弹出层在container内部
-      const maxLeft = mountContainer.scrollWidth - contentSize.width;
+      // 限制在可见容器中。不能直接使用 mountContainer.scrollWidth，它可能已被绝对定位弹层自身撑大。
+      const visibleArea = getContainerVisibleArea(mountContainer, windowWidth, boundary.left);
+      const maxLeft = Math.max(
+        0,
+        visibleArea.left + visibleArea.width - contentSize.width
+      );
       style.left = Math.min(maxLeft, style.left);
     }
 
```

---

### Incident Patch 5: `a970723b` (2026-05-06)
**Commit Message**: fix(Form): 修复Form组件中form.scrollToField 命中数字开头或含特殊字符的字段 id 时抛出非法选择器错误，滚动失败问题 (#3175)

* fix(Form): 修复 scrollToField 在字段名包含特殊字符时无法工作的问题

Co-authored-by: GeniusAI <[REDACTED_EMAIL]>

* fix: 修复测试用例问题

---------

Co-authored-by: lingyunsong <[REDACTED_EMAIL]>
Co-authored-by: GeniusAI <[REDACTED_EMAIL]>

**File**: `components/Form/__test__/useform.test.tsx` (modified, +44/-0)
```diff
@@ -549,6 +549,50 @@ describe('UseForm', () => {
     expect(form.scrollToField).toBeInstanceOf(Function);
   });
 
+  it('scrollToField should support special character field', async () => {
+    const DemoWithSpecialField = () => {
+      const [specialForm] = Form.useForm();
+      useEffect(() => {
+        expect(() => {
+          specialForm.scrollToField('1-2-3');
+        }).not.toThrow();
+      }, [specialForm]);
+
+      return (
+        <Form form={specialForm} id="special-form" scrollToFirstError>
+          <Form.Item
+            label="字段1"
+            field="1-2-3"
+            rules={[
+              {
+                required: true,
+              },
+            ]}
+          >
+            <Input />
+          </Form.Item>
+          <Button className="submit-button" htmlType="submit">
+            提交
+          </Button>
+        </Form>
+      );
+    };
+
+    const specialWrapper = render(<DemoWithSpecialField />);
+    const specialFormElement = specialWrapper.querySelector('form');
+    const targetId = 'special-form-1-2-3';
+    const targetFieldNode = document.getElementById(targetId);
+
+    expect(targetFieldNode).toBeTruthy();
+    expect(targetFieldNode?.id).toBe(targetId);
+    expect(() => {
+      fireEvent.submit(specialFormElement as Element);
+    }).not.toThrow();
+
+    await sleep(20);
+    specialWrapper.unmount();
+  });
+
   it('getfieldsError', async () => {
     let e;
     try {
```

**File**: `components/Form/form.tsx` (modified, +10/-2)
```diff
@@ -31,6 +31,13 @@ function getFormElementId<FieldKey extends KeyType = string>(
   return prefix ? `${prefix}-${id}` : `${id}`;
 }
 
+function getFieldElement(node: HTMLElement, elementId: string) {
+  const target = document.getElementById(elementId);
+  if (target && node.contains(target)) {
+    return target;
+  }
+}
+
 const defaultProps = {
   layout: 'horizontal' as const,
   labelCol: { span: 5, offset: 0 },
@@ -100,10 +107,11 @@ const Form = <
     if (!node) {
       return;
     }
-    let fieldNode = node.querySelector(`#${getFormElementId(id, field as string)}`);
+    const fieldElementId = getFormElementId(id, field as string);
+    let fieldNode = getFieldElement(node, fieldElementId);
     if (!fieldNode) {
       // 如果设置了nostyle， fieldNode不存在，尝试直接查询表单控件
-      fieldNode = node.querySelector(`#${getFormElementId(id, field as string)}${ID_SUFFIX}`);
+      fieldNode = getFieldElement(node, `${fieldElementId}${ID_SUFFIX}`);
     }
     fieldNode &&
       scrollIntoView(fieldNode, {
```

---

### Incident Patch 6: `5f4cc226` (2026-05-06)
**Commit Message**: fix(Image): 修复关闭预览时触发父元素点击事件的问题 (#3178)

Co-authored-by: lingyunsong <[REDACTED_EMAIL]>
Co-authored-by: GeniusAI <[REDACTED_EMAIL]>

**File**: `components/Image/__test__/preview.test.tsx` (modified, +19/-0)
```diff
@@ -197,6 +197,25 @@ describe('Image', () => {
     expect(mockVisibleChange.mock.calls[0]).toEqual([false, true]);
   });
 
+  it('should not trigger parent click event when click close button', () => {
+    const mockParentClick = jest.fn();
+    const mockVisibleChange = jest.fn();
+    const wrapper = render(
+      <div onClick={mockParentClick}>
+        <Image.Preview src={imgSrc} onVisibleChange={mockVisibleChange} defaultVisible />
+      </div>
+    );
+
+    jest.runAllTimers();
+
+    act(() => {
+      fireEvent.click(wrapper.find('.arco-image-preview-close-btn')[0]);
+    });
+
+    expect(mockVisibleChange.mock.calls[0]).toEqual([false, true]);
+    expect(mockParentClick).toHaveBeenCalledTimes(0);
+  });
+
   it('handle maskClosable prop correctly', () => {
     const mockVisibleChange = jest.fn();
     const wrapper = render(
```

**File**: `components/Image/image-preview.tsx` (modified, +3/-1)
```diff
@@ -8,6 +8,7 @@ import React, {
   useCallback,
   useMemo,
   WheelEvent,
+  MouseEvent,
 } from 'react';
 import ArcoCSSTransition from '../_util/CSSTransition';
 import { findDOMNode } from '../_util/react-dom';
@@ -255,7 +256,8 @@ function Preview(baseProps: ImagePreviewProps, ref) {
   }
 
   // Close button is clicked.
-  function onCloseClick() {
+  function onCloseClick(e: MouseEvent<HTMLDivElement>) {
+    e.stopPropagation();
     close();
   }
 
```

---

### Incident Patch 7: `032b8da1` (2026-05-06)
**Commit Message**: fix(Tree): 修复修复 Tree 在 Modal 中使用虚拟列表时，展开/关闭节点或 loadMore 完成后,由于VirtualList 数据变更后的滚动校准过度、旧虚拟窗口状态未及时重算，以及浏览器焦点/scroll anchoring 对虚拟 DOM 重排产生自动滚动补偿导致的滚动条跳动问题 (#3177)

**File**: `components/List/__test__/__snapshots__/demo.test.ts.snap` (modified, +2/-2)
```diff
@@ -2592,10 +2592,10 @@ Array [
         style="overflow-y:auto;overflow-anchor:none;max-height:560px"
       >
         <div
-          style="height:320000px;position:relative;overflow:hidden;z-index:0"
+          style="height:320000px;position:relative;overflow:hidden;overflow-anchor:none;z-index:0"
         >
           <div
-            style="display:flex;flex-direction:column;transform:translateY(0px);position:absolute;left:0;right:0;top:0"
+            style="display:flex;flex-direction:column;overflow-anchor:none;transform:translateY(0px);position:absolute;left:0;right:0;top:0"
           >
             <div
               class="arco-list-item"
```

**File**: `components/Table/__test__/__snapshots__/demo.test.ts.snap` (modified, +2/-2)
```diff
@@ -16095,10 +16095,10 @@ exports[`renders Table/demo/virtualized.md correctly 1`] = `
                 style="overflow-y:auto;overflow-anchor:none;max-height:500px"
               >
                 <div
-                  style="height:3200000px;position:relative;overflow:visible;z-index:0;width:1000px;min-width:100%"
+                  style="height:3200000px;position:relative;overflow:visible;overflow-anchor:none;z-index:0;width:1000px;min-width:100%"
                 >
                   <div
-                    style="display:flex;flex-direction:column;transform:translateY(0px);position:absolute;left:0;right:auto;top:0;min-width:100%"
+                    style="display:flex;flex-direction:column;overflow-anchor:none;transform:translateY(0px);position:absolute;left:0;right:auto;top:0;min-width:100%"
                   >
                     <div
                       class="arco-table-tr"
```

**File**: `components/Tree/__test__/__snapshots__/demo.test.ts.snap` (modified, +2/-2)
```diff
@@ -7592,10 +7592,10 @@ exports[`renders Tree/demo/virtual.md correctly 1`] = `
     tabindex="0"
   >
     <div
-      style="height:35520px;position:relative;overflow:hidden;z-index:0"
+      style="height:35520px;position:relative;overflow:hidden;overflow-anchor:none;z-index:0"
     >
       <div
-        style="display:flex;flex-direction:column;transform:translateY(0px);position:absolute;left:0;right:0;top:0"
+        style="display:flex;flex-direction:column;overflow-anchor:none;transform:translateY(0px);position:absolute;left:0;right:0;top:0"
       >
         <div
           aria-expanded="true"
```

**File**: `components/Tree/__test__/case.test.tsx` (modified, +7/-0)
```diff
@@ -69,6 +69,13 @@ describe('Tree case', () => {
     expect(firstNode.textContent).toBe('+');
   });
 
+  it('does not focus switcher when clicking by mouse', () => {
+    const wrapper = render(<Tree treeData={TreeData} />);
+    const firstNode = wrapper.find(`.arco-tree-node-switcher-icon`).item(0);
+
+    expect(fireEvent.mouseDown(firstNode)).toBe(false);
+  });
+
   it('show child correctly', async () => {
     const data = [
       {
```

**File**: `components/Tree/node.tsx` (modified, +1/-0)
```diff
@@ -128,6 +128,7 @@ function TreeNode(props: PropsWithChildren<NodeProps>, ref) {
           aria-label={expanded ? 'fold button' : 'expand button'}
           role="button"
           tabIndex={0}
+          onMouseDown={(e) => e.preventDefault()}
           onClick={switchExpandStatus}
         >
           {icon}
```

**File**: `components/_class/VirtualList/Filler.tsx` (modified, +3/-1)
```diff
@@ -25,13 +25,15 @@ const Filler: React.FC<FillerProps> = ({
   let innerStyle: React.CSSProperties = {
     display: 'flex',
     flexDirection: 'column',
+    overflowAnchor: 'none',
   };
 
   if (offset !== undefined) {
     outerStyle = {
       height,
       position: 'relative',
       overflow: 'hidden',
+      overflowAnchor: 'none',
       zIndex: 0,
       ...propsOuterStyle,
     };
@@ -46,7 +48,7 @@ const Filler: React.FC<FillerProps> = ({
       ...propsInnerStyle,
     };
   } else {
-    outerStyle = { ...propsOuterStyle };
+    outerStyle = { overflowAnchor: 'none', ...propsOuterStyle };
     innerStyle = { ...innerStyle, ...propsInnerStyle };
   }
 
```

**File**: `components/_class/VirtualList/__test__/index.test.tsx` (modified, +196/-1)
```diff
@@ -3,12 +3,59 @@ import { fireEvent } from '@testing-library/dom';
 
 import VirtualList from '../index';
 import { requestAnimationFrameMock } from '../../../../tests/mockRAF';
-import { render, sleep } from '../../../../tests/util';
+import { act, render, sleep } from '../../../../tests/util';
 
 function getData(size: number) {
   return new Array(size).fill(null).map((_, index) => ({ content: `Content ${index}` }));
 }
 
+function getKeyedData(size: number) {
+  return new Array(size).fill(null).map((_, index) => ({
+    key: `item-${index}`,
+    content: `Content ${index}`,
+  }));
+}
+
+function mockElementSize() {
+  const descriptors = {
+    clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight'),
+    scrollHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight'),
+    offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
+  };
+
+  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
+    configurable: true,
+    get() {
+      return this.classList?.contains('virtual-list') ? 200 : 20;
+    },
+  });
+  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
+    configurable: true,
+    get() {
+      if (this.classList?.contains('virtual-list')) {
+        return parseInt((this.firstElementChild as HTMLElement)?.style.height, 10) || 0;
+      }
+      return 20;
+    },
+  });
+  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
+    configurable: true,
+    get() {
+      return this.classList?.contains('list-item') ? 20 : 0;
+    },
+  });
+
+  return () => {
+    (Object.keys(descriptors) as Array<keyof typeof descriptors>).forEach((prop) => {
+      if (descriptors[prop]) {
+        Object.defineProperty(HTMLElement.prototype, prop, descriptors[prop]);
+      } else {
+        delete (HTMLElement.prototype as any)[prop];
+      }
+    });
+  };
+}
+
 describe('VirtualList', () => {
   beforeEach(() => {
     requestAnimationFrameMock.resetQueue();
@@ -103,4 +150,152 @@ describe('VirtualList', () => {
     fireEvent.scroll(wrapper.querySelector(`.${className}`));
     expect(onScroll).toBeCalled();
   });
+
+  it('keeps the visible keyed item stable when items are inserted before viewport', async () => {
+    const restoreElementSize = mockElementSize();
+
+    function Demo() {
+      const refList = useRef<any>(null);
+      const [data, setData] = useState(getKeyedData(200));
+      return (
+        <div>
+          <button
+            className="scroll-to-item"
+            onClick={() => {
+              refList.current?.scrollTo({ index: 84, options: { block: 'start' } });
+            }}
+          />
+          <button
+            className="insert-items"
+            onClick={() => {
+              setData([
+                ...data.slice(0, 20),
+                { key: 'insert-1', content: 'Insert 1' },
+                { key: 'insert-2', content: 'Insert 2' },
+                ...data.slice(20),
+              ]);
+            }}
+          />
+          <VirtualList
+            ref={refList}
+            className="virtual-list"
+            data={data}
+            height={200}
+            itemHeight={20}
+            itemKey="key"
+            isStaticItemHeight={false}
+            threshold={0}
+          >
+            {({ content }) => <div className="list-item">{content}</div>}
+          </VirtualList>
+        </div>
+      );
+    }
+
+    try {
+      const wrapper = render(<Demo />);
+      const list = wrapper.container.querySelector('.virtual-list') as HTMLElement;
+
+      await act(async () => {
+        await sleep(0);
+      });
+
+      act(() => {
+        fireEvent.click(wrapper.container.querySelector('.scroll-to-item'));
+        requestAnimationFrameMock.triggerAllAnimationFrames();
+      });
+      await act(async () => {
+        await sleep(100);
+      });
+
+      expect(wrapper.container.querySelector('.list-item')).toHaveTextContent('Content 83');
+      const prevScrollTop = list.scrollTop;
+
+      act(() => {
+        fireEvent.click(wrapper.container.querySelector('.insert-items'));
+      });
+      await act(async () => {
+        await sleep(0);
+      });
+
+      expect(list.scrollTop).toBeGreaterThan(prevScrollTop);
+      expect(wrapper.container.querySelector('.list-item')).toHaveTextContent('Content 83');
+    } finally {
+      restoreElementSize();
+    }
+  });
+
+  it('does not adjust scrollTop when items are inserted inside viewport', async () => {
+    const restoreElementSize = mockElementSize();
+
+    function Demo() {
+      const refList = useRef<any>(null);
+      const [data, setData] = useState(getKeyedData(200));
+      return (
+        <div>
+          <button
+            className="scroll-to-item"
+            onClick={() => {
+              refList.current?.scrollTo({ index: 84, options: { block: 'start' } });
+            }}
+          />
+          <button
+            className="insert-items"
+
```

**File**: `components/_class/VirtualList/index.tsx` (modified, +20/-3)
```diff
@@ -254,6 +254,10 @@ const VirtualList: React.ForwardRefExoticComponent<
     return item !== undefined ? getItemKey(item, index) : null;
   };
 
+  const getItemIndexByKey = (key: Key): number => {
+    return data.findIndex((item, index) => getItemKey(item, index) === key);
+  };
+
   const getCachedItemHeight = (key: Key): number => {
     return refItemHeightMap.current[key] || itemHeight;
   };
@@ -422,6 +426,7 @@ const VirtualList: React.ForwardRefExoticComponent<
     if (!refList.current) return;
 
     let changedItemIndex: number = null;
+    let locatedItemIndex = state.itemIndex;
     const switchTo = refIsVirtual.current !== isVirtual ? (isVirtual ? 'virtual' : 'raw') : '';
 
     refIsVirtual.current = isVirtual;
@@ -431,8 +436,18 @@ const VirtualList: React.ForwardRefExoticComponent<
       changedItemIndex = diff ? diff.index : null;
     }
 
+    const locatedItemKey = getItemKeyByIndex(state.itemIndex, prevData);
+    if (locatedItemKey && locatedItemKey !== GHOST_ITEM_KEY) {
+      const nextIndex = getItemIndexByKey(locatedItemKey);
+      locatedItemIndex = nextIndex > -1 ? nextIndex : Math.min(locatedItemIndex, itemCount - 1);
+    }
+
+    const dataLengthChanged = changedItemIndex !== null;
+    const shouldCorrectScroll =
+      switchTo || (isVirtual && dataLengthChanged && changedItemIndex <= state.startIndex);
+
     // No need to correct the position when the number of elements in the real list changes
-    if (switchTo || (isVirtual && changedItemIndex)) {
+    if (shouldCorrectScroll) {
       const { clientHeight } = refList.current;
       const locatedItemRelativeTop = getItemRelativeTop({
         itemHeight: getCachedItemHeight(getItemKeyByIndex(state.itemIndex, prevData)),
@@ -447,7 +462,7 @@ const VirtualList: React.ForwardRefExoticComponent<
 
       if (switchTo === 'raw') {
         let rawTop = locatedItemRelativeTop;
-        for (let index = 0; index < state.itemIndex; index++) {
+        for (let index = 0; index < locatedItemIndex; index++) {
           rawTop -= getCachedItemHeight(getItemKeyByIndex(index));
         }
 
@@ -458,10 +473,12 @@ const VirtualList: React.ForwardRefExoticComponent<
         });
       } else {
         internalScrollTo({
-          itemIndex: state.itemIndex,
+          itemIndex: locatedItemIndex,
           relativeTop: locatedItemRelativeTop,
         });
       }
+    } else if (isVirtual && dataLengthChanged) {
+      virtualListScrollHandler(null, true);
     }
   }, [data, isVirtual]);
 
```

---

### Incident Patch 8: `6a9ac892` (2026-05-06)
**Commit Message**: fix(Menu):  修复ResizeObserver 回调内同步测量并更新 Menu 溢出状态，触发连续布局抖动，浏览器上报 loop error问题 (#3176)

* perf(Menu): 使用 raf 优化 resize 事件处理性能

Co-authored-by: GeniusAI <[REDACTED_EMAIL]>

* fix: 优化抖动逻辑

---------

Co-authored-by: lingyunsong <[REDACTED_EMAIL]>
Co-authored-by: GeniusAI <[REDACTED_EMAIL]>

**File**: `components/Menu/overflow-wrap.tsx` (modified, +22/-5)
```diff
@@ -1,4 +1,4 @@
-import React, { useState, useRef, useContext, ReactElement, ReactNode } from 'react';
+import React, { useState, useRef, useContext, ReactElement, ReactNode, useCallback } from 'react';
 import SubMenu from './sub-menu';
 import { getStyle } from '../_util/style';
 import MenuContext from './context';
@@ -7,6 +7,7 @@ import type { MenuProps } from './interface';
 import cs from '../_util/classNames';
 
 const OVERFLOW_THRESHOLD = 5;
+const WIDTH_CHANGE_THRESHOLD = 1;
 
 function getNodeWidth(node) {
   // getBoundingClientRect will get a result like 20.45
@@ -30,6 +31,7 @@ const OverflowWrap = (props: OverflowWrapProps) => {
   const { prefixCls } = useContext(MenuContext);
 
   const refUl = useRef(null);
+  const lastMeasuredWidthRef = useRef<number>(0);
   const [lastVisibleIndex, setLastVisibleIndex] = useState(null);
 
   const overflowSubMenuClass = `${prefixCls}-overflow-sub-menu`;
@@ -48,13 +50,24 @@ const OverflowWrap = (props: OverflowWrapProps) => {
     }
   };
 
-  function computeLastVisibleIndex() {
+  const computeLastVisibleIndex = useCallback(() => {
     if (!refUl.current) {
       return;
     }
 
     const ulElement = refUl.current;
-    const maxWidth = getNodeWidth(ulElement) - OVERFLOW_THRESHOLD;
+    const currentWidth = getNodeWidth(ulElement);
+
+    if (
+      lastMeasuredWidthRef.current &&
+      Math.abs(currentWidth - lastMeasuredWidthRef.current) < WIDTH_CHANGE_THRESHOLD
+    ) {
+      return;
+    }
+
+    lastMeasuredWidthRef.current = currentWidth;
+
+    const maxWidth = currentWidth - OVERFLOW_THRESHOLD;
     const childNodeList = [].slice.call(ulElement.children);
 
     let menuItemIndex = 0;
@@ -100,7 +113,7 @@ const OverflowWrap = (props: OverflowWrapProps) => {
 
     // 全部可见
     tryUpdateEllipsisStatus(null);
-  }
+  }, [children, lastVisibleIndex]);
 
   const renderOverflowSubMenu = (children, isMirror = false) => {
     return (
@@ -144,7 +157,11 @@ const OverflowWrap = (props: OverflowWrapProps) => {
   };
 
   return (
-    <ResizeObserver onResize={computeLastVisibleIndex} getTargetDOMNode={() => refUl.current}>
+    <ResizeObserver
+      onResize={computeLastVisibleIndex}
+      delayOnResizeByRaf
+      getTargetDOMNode={() => refUl.current}
+    >
       <div className={`${prefixCls}-overflow-wrap`} ref={refUl}>
         {renderChildren()}
       </div>
```

**File**: `components/_util/resizeObserver.tsx` (modified, +23/-1)
```diff
@@ -9,13 +9,18 @@ export interface ResizeProps {
   onResize?: (entry: ResizeObserverEntry[]) => void;
   children?: React.ReactNode;
   getTargetDOMNode?: () => any;
+  delayOnResizeByRaf?: boolean;
 }
 
 class ResizeObserverComponent extends React.Component<ResizeProps> {
   resizeObserver: ResizeObserver;
 
   rootDOMRef: any;
 
+  resizeFrameId: number;
+
+  latestEntry: ResizeObserverEntry[];
+
   getRootElement = () => {
     const { getTargetDOMNode } = this.props;
     return findDOMNode(getTargetDOMNode?.() || this.rootDOMRef, this);
@@ -40,13 +45,17 @@ class ResizeObserverComponent extends React.Component<ResizeProps> {
   }
 
   componentWillUnmount = () => {
+    if (this.resizeFrameId) {
+      cancelAnimationFrame(this.resizeFrameId);
+      this.resizeFrameId = null;
+    }
     if (this.resizeObserver) {
       this.destroyResizeObserver();
     }
   };
 
   createResizeObserver = () => {
-    const { throttle = true } = this.props;
+    const { throttle = true, delayOnResizeByRaf = false } = this.props;
     const onResize = (entry) => {
       this.props.onResize?.(entry);
     };
@@ -59,6 +68,18 @@ class ResizeObserverComponent extends React.Component<ResizeProps> {
         firstExec = false;
         onResize(entry);
       }
+
+      if (delayOnResizeByRaf) {
+        this.latestEntry = entry;
+        if (!this.resizeFrameId) {
+          this.resizeFrameId = requestAnimationFrame(() => {
+            this.resizeFrameId = null;
+            resizeHandler(this.latestEntry);
+          });
+        }
+        return;
+      }
+
       resizeHandler(entry);
     });
     const targetNode = this.getRootElement();
@@ -68,6 +89,7 @@ class ResizeObserverComponent extends React.Component<ResizeProps> {
   destroyResizeObserver = () => {
     this.resizeObserver && this.resizeObserver.disconnect();
     this.resizeObserver = null;
+    this.latestEntry = null;
   };
 
   render() {
```

---

### Incident Patch 9: `19493ab3` (2026-05-06)
**Commit Message**: fix(InputTag):  修复InputTag组件，当开启拖拽排序能力dragToSort后，在输入时，输入部分还未按enter保存为tag时，就可以拖拽为保存为tag的输入，拖拽完成后会报错问题 (#3174)

* fix(input-tag): 修复拖拽排序时输入框也参与拖拽的问题

Co-authored-by: GeniusAI <[REDACTED_EMAIL]>

* fix: 更新测试用例快照

---------

Co-authored-by: lingyunsong <[REDACTED_EMAIL]>
Co-authored-by: GeniusAI <[REDACTED_EMAIL]>

**File**: `components/Cascader/__test__/__snapshots__/demo.test.ts.snap` (modified, +9/-15)
```diff
@@ -1038,22 +1038,16 @@ exports[`renders Cascader/demo/draggable.md correctly 1`] = `
                 </span>
               </div>
             </li>
-            <li
-              class="arco-draggable-item"
-              draggable="true"
-              style="display:inline-block"
-            >
-              <input
-                autocomplete="off"
-                class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
-                placeholder=""
-                value=""
-              />
-              <span
-                class="arco-input-tag-input-mirror"
-              />
-            </li>
           </div>
+          <input
+            autocomplete="off"
+            class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
+            placeholder=""
+            value=""
+          />
+          <span
+            class="arco-input-tag-input-mirror"
+          />
         </div>
       </div>
     </div>
```

**File**: `components/InputTag/__test__/__snapshots__/demo.test.ts.snap` (modified, +9/-15)
```diff
@@ -323,22 +323,16 @@ exports[`renders InputTag/demo/draggable.md correctly 1`] = `
             </span>
           </div>
         </li>
-        <li
-          class="arco-draggable-item"
-          draggable="true"
-          style="display:inline-block"
-        >
-          <input
-            autocomplete="off"
-            class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
-            placeholder=""
-            value=""
-          />
-          <span
-            class="arco-input-tag-input-mirror"
-          />
-        </li>
       </div>
+      <input
+        autocomplete="off"
+        class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
+        placeholder=""
+        value=""
+      />
+      <span
+        class="arco-input-tag-input-mirror"
+      />
     </div>
     <div
       class="arco-input-tag-suffix"
```

**File**: `components/InputTag/__test__/index.test.tsx` (modified, +10/-0)
```diff
@@ -153,4 +153,14 @@ describe('InputTag', () => {
     expect(wrapper.querySelectorAll('.arco-tag')).toHaveLength(3);
     expect(wrapper.querySelector('input').getAttribute('value')).toBe('');
   });
+
+  it('should not make input area draggable when dragToSort is enabled', async () => {
+    const wrapper = render(<InputTag dragToSort defaultValue={['a', 'b', 'c', 'd']} />);
+    const eleInput = wrapper.querySelector('input') as HTMLElement;
+
+    fireEvent.change(eleInput, { target: { value: 'draft' } });
+    await sleep(10);
+
+    expect(wrapper.querySelectorAll('[draggable="true"]')).toHaveLength(4);
+  });
 });
```

**File**: `components/InputTag/input-tag.tsx` (modified, +10/-1)
```diff
@@ -529,11 +529,20 @@ function InputTag(baseProps: InputTagProps<string | ObjectValueType>, ref) {
                   arr.splice(isMoveLeft ? toIndex : toIndex - 1, 0, item);
                   return arr;
                 };
+                if (
+                  prevIndex < 0 ||
+                  index < 0 ||
+                  prevIndex >= value.length ||
+                  index > value.length
+                ) {
+                  return;
+                }
                 valueChangeHandler(moveItem(value, prevIndex, index), 'sort');
               }}
             >
-              {childrenTagWithAnimation.concat(suffixInput)}
+              {childrenTagWithAnimation}
             </Draggable>
+            {suffixInput}
           </UsedTransitionGroup>
         ) : (
           <UsedTransitionGroup
```

**File**: `components/Select/__test__/__snapshots__/demo.test.ts.snap` (modified, +9/-15)
```diff
@@ -1484,22 +1484,16 @@ exports[`renders Select/demo/darggable.md correctly 1`] = `
                 </span>
               </div>
             </li>
-            <li
-              class="arco-draggable-item"
-              draggable="true"
-              style="display:inline-block"
-            >
-              <input
-                autocomplete="off"
-                class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
-                placeholder=""
-                value=""
-              />
-              <span
-                class="arco-input-tag-input-mirror"
-              />
-            </li>
           </div>
+          <input
+            autocomplete="off"
+            class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
+            placeholder=""
+            value=""
+          />
+          <span
+            class="arco-input-tag-input-mirror"
+          />
         </div>
       </div>
     </div>
```

**File**: `components/TreeSelect/__test__/__snapshots__/demo.test.ts.snap` (modified, +13/-20)
```diff
@@ -641,27 +641,20 @@ exports[`renders TreeSelect/demo/draggable.md correctly 1`] = `
         >
           <div
             class="arco-draggable"
+          />
+          <input
+            autocomplete="off"
+            class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
+            placeholder="请选择..."
+            style="order:-1"
+            value=""
+          />
+          <span
+            class="arco-input-tag-input-mirror"
+            style="order:-1"
           >
-            <li
-              class="arco-draggable-item"
-              draggable="true"
-              style="display:inline-block"
-            >
-              <input
-                autocomplete="off"
-                class="arco-input-tag-input arco-input-tag-input-size-default arco-input-tag-input-autowidth"
-                placeholder="请选择..."
-                style="order:-1"
-                value=""
-              />
-              <span
-                class="arco-input-tag-input-mirror"
-                style="order:-1"
-              >
-                请选择...
-              </span>
-            </li>
-          </div>
+            请选择...
+          </span>
         </div>
       </div>
     </div>
```

---

### Incident Patch 10: `c4e73328` (2026-05-06)
**Commit Message**: fix(Select): 修复 `retainInputValue` 在 `Option` 子节点为 React 节点时无效的问题 (#3173)

Co-authored-by: lingyunsong <[REDACTED_EMAIL]>
Co-authored-by: GeniusAI <[REDACTED_EMAIL]>

**File**: `components/Select/__test__/index.test.tsx` (modified, +37/-0)
```diff
@@ -4,6 +4,7 @@ import { sleep, render } from '../../../tests/util';
 import mountTest from '../../../tests/mountTest';
 import componentConfigTest from '../../../tests/componentConfigTest';
 import Button from '../../Button';
+import Tooltip from '../../Tooltip';
 import Select from '../select';
 import { Enter, Tab } from '../../_util/keycode';
 import { LabeledValue, SelectProps } from '../interface';
@@ -207,6 +208,42 @@ describe('Select', () => {
     expect(onSearch.mock.calls[0][0]).toBe('A');
   });
 
+  it('retainInputValue works with Tooltip wrapped option children', async () => {
+    wrapper = render(
+      <Select showSearch={{ retainInputValue: true }} defaultValue="1">
+        <Option value="1">
+          <Tooltip content="tooltip content">content1</Tooltip>
+        </Option>
+      </Select>
+    );
+
+    const select = wrapper.querySelector('.arco-select');
+    const input = wrapper.querySelector('input') as HTMLInputElement;
+
+    fireEvent.click(select);
+    await sleep(100);
+    expect(input.value).toBe('content1');
+  });
+
+  it('retainInputValue works with div wrapped option children', async () => {
+    wrapper = render(
+      <Select showSearch={{ retainInputValue: true }} defaultValue="1">
+        <Option value="1">
+          <div>content1</div>
+        </Option>
+      </Select>
+    );
+
+    expect(wrapper.querySelector('.arco-select-view-value')).toHaveTextContent('content1');
+
+    const select = wrapper.querySelector('.arco-select');
+    const input = wrapper.querySelector('input') as HTMLInputElement;
+
+    fireEvent.click(select);
+    await sleep(100);
+    expect(input.value).toBe('content1');
+  });
+
   it('popup with correct position', async () => {
     wrapper = render(
       <Select
```

**File**: `components/Select/select.tsx` (modified, +23/-1)
```diff
@@ -45,6 +45,22 @@ import useMergeProps from '../_util/hooks/useMergeProps';
 import { SelectOptionProps } from '../index';
 import useId from '../_util/hooks/useId';
 
+const nodeToText = (node: ReactNode): string => {
+  if (typeof node === 'string' || typeof node === 'number') {
+    return String(node);
+  }
+
+  if (Array.isArray(node)) {
+    return node.map((item) => nodeToText(item)).join('');
+  }
+
+  if (React.isValidElement(node)) {
+    return nodeToText(node.props?.children);
+  }
+
+  return '';
+};
+
 // 用户创建中的option的origin标识
 const USER_CREATING_OPTION_ORIGIN = 'userCreatingOption';
 
@@ -838,13 +854,15 @@ function Select(baseProps: SelectProps, ref) {
           onSort={tryUpdateSelectValue}
           renderText={(value) => {
             const option = getOptionInfoByValue(value);
-            let text = value;
+            let text: ReactNode = value;
+            let textInput = String(value);
             if (isFunction(renderFormat)) {
               const paramsForCallback = getValueAndOptionForCallback(value, false);
               text = renderFormat(
                 (paramsForCallback.option as OptionInfo) || null,
                 paramsForCallback.value as ReactText | LabeledValue
               );
+              textInput = nodeToText(text);
             } else {
               let foundLabelFromProps = false;
               if (labelInValue) {
@@ -855,21 +873,25 @@ function Select(baseProps: SelectProps, ref) {
                   );
                   if (targetLabeledValue) {
                     text = targetLabeledValue.label;
+                    textInput = nodeToText(targetLabeledValue.label);
                     foundLabelFromProps = true;
                   }
                 } else if (isObject(propValue)) {
                   text = (propValue as LabeledValue).label;
+                  textInput = nodeToText((propValue as LabeledValue).label);
                   foundLabelFromProps = true;
                 }
               }
 
               if (!foundLabelFromProps && option && 'children' in option) {
                 text = option.children;
+                textInput = nodeToText(option.children);
               }
             }
 
             return {
               text,
+              textInput,
               disabled: option && option.disabled,
             };
           }}
```

**File**: `components/_class/select-view.tsx` (modified, +8/-4)
```diff
@@ -191,7 +191,7 @@ export interface SelectViewProps extends SelectViewCommonProps {
   prefixCls: string;
   rtl?: boolean;
   ariaControls?: string;
-  renderText: (value) => { text; disabled };
+  renderText: (value) => { text; textInput?: string; disabled };
   renderView?: (eleView: ReactElement) => ReactElement;
   onSort?: (value) => void;
   onRemoveCheckedItem?: (item, index: number, e) => void;
@@ -279,9 +279,13 @@ const CoreSelectView = React.forwardRef(
     const mergedFocused = focused || popupVisible;
     const isRetainInputValueSearch = isObject(showSearch) && showSearch.retainInputValue;
     // the formatted text of value.
-    const renderedValue = !isMultiple && value !== undefined ? renderText(value).text : '';
+    const renderedTextResult = !isMultiple && value !== undefined ? renderText(value) : null;
+    const renderedValue = renderedTextResult?.text ?? '';
+    const renderedValueInput = renderedTextResult?.textInput;
     const renderedValuePlain =
-      typeof renderedValue === 'string' || typeof renderedValue === 'number'
+      renderedValueInput !== undefined
+        ? renderedValueInput
+        : typeof renderedValue === 'string' || typeof renderedValue === 'number'
         ? String(renderedValue)
         : nodeToText(renderedValue);
 
@@ -401,7 +405,7 @@ const CoreSelectView = React.forwardRef(
 
       switch (searchStatus) {
         case SearchStatus.BEFORE:
-          _inputValue = inputValue || (isRetainInputValueSearch ? renderedValue : '');
+          _inputValue = inputValue || (isRetainInputValueSearch ? renderedValuePlain : '');
           break;
         case SearchStatus.EDITING:
           _inputValue = inputValue || '';
```

---

### Incident Patch 11: `5e84185d` (2026-04-16)
**Commit Message**: fix: 修复测试用例报错

**File**: `components/Select/__test__/index.test.tsx` (modified, +18/-8)
```diff
@@ -161,31 +161,41 @@ describe('Select', () => {
   it('showSearch matches string label in options and Option children', async () => {
     wrapper = render(
       <div>
-        <Select showSearch options={[{ label: '中文', value: 'chinese' }]} />
-        <Select showSearch>
+        <Select
+          showSearch
+          dropdownMenuClassName="select-with-options"
+          options={[{ label: '中文', value: 'chinese' }]}
+        />
+        <Select showSearch dropdownMenuClassName="select-with-children">
           <Option value="chinese">中文</Option>
         </Select>
       </div>
     );
 
     const selectList = wrapper.querySelectorAll('.arco-select');
+    const getPopup = (className: string) => {
+      return document.body.querySelector(`.${className}`) as HTMLElement;
+    };
+
     fireEvent.click(selectList[0]);
     await sleep(100);
 
     const inputList = wrapper.querySelectorAll('input');
     fireEvent.change(inputList[0], { target: { value: '中' } });
-    expect(wrapper.find('.arco-select-option')).toHaveLength(1);
-    expect(wrapper.querySelector('.arco-select-option')).toHaveTextContent('中文');
-    expect(wrapper.querySelector('.arco-select-highlight')).toHaveTextContent('中');
+    let popup = getPopup('select-with-options');
+    expect(popup.querySelectorAll('.arco-select-option')).toHaveLength(1);
+    expect(popup.querySelector('.arco-select-option')).toHaveTextContent('中文');
+    expect(popup.querySelector('.arco-select-highlight')).toHaveTextContent('中');
 
     fireEvent.change(inputList[0], { target: { value: '' } });
     fireEvent.click(selectList[1]);
     await sleep(100);
 
     fireEvent.change(inputList[1], { target: { value: '中' } });
-    expect(wrapper.find('.arco-select-option')).toHaveLength(1);
-    expect(wrapper.querySelector('.arco-select-option')).toHaveTextContent('中文');
-    expect(wrapper.querySelector('.arco-select-highlight')).toHaveTextContent('中');
+    popup = getPopup('select-with-children');
+    expect(popup.querySelectorAll('.arco-select-option')).toHaveLength(1);
+    expect(popup.querySelector('.arco-select-option')).toHaveTextContent('中文');
+    expect(popup.querySelector('.arco-select-highlight')).toHaveTextContent('中');
   });
 
   it('showSearch async correctly', async () => {
```

**File**: `components/Select/utils.tsx` (modified, +2/-1)
```diff
@@ -112,14 +112,15 @@ function flatChildren(
     const optionValue = getChildValue(child);
     const optionLabel = get(child, 'props.children');
     const searchValue = inputValue.toLowerCase();
+    const hasExplicitValue = get(child, 'props.value') !== undefined;
 
     let isValidOption = true;
     if (filterOption === true) {
       const isValueMatched =
         optionValue !== undefined && String(optionValue).toLowerCase().indexOf(searchValue) !== -1;
       const isLabelMatched =
         typeof optionLabel === 'string' && optionLabel.toLowerCase().indexOf(searchValue) !== -1;
-      isValidOption = !inputValue || isValueMatched || isLabelMatched;
+      isValidOption = hasExplicitValue && (!inputValue || isValueMatched || isLabelMatched);
     } else if (typeof filterOption === 'function') {
       isValidOption = !inputValue || filterOption(inputValue, child);
     }
```

---

### Incident Patch 12: `35f36a96` (2026-04-16)
**Commit Message**: fix(Input): 为 Input.TextArea 新增字数统计位置配置能力，支持将 showWordLimit 的统计文案显示在输入框下方，解决业务场景下统计文案与输入内容重叠、不易满足预期展示的问题 (#3170)

**File**: `components/Input/README.en-US.md` (modified, +1/-0)
```diff
@@ -61,6 +61,7 @@ The basic form components have been expanded on the basis of native controls and
 |maxLength|The max content length；After setting `errorOnly` to `true`, if `maxLength` is exceeded, the `error` status will be displayed, and user input will not be restricted.|number \| { length: number; errorOnly?: boolean } |`-`|`errorOnly` in 2.23.0|
 |style|Additional style|CSSProperties |`-`|-|
 |wrapperStyle|With `showWordLimit`, a `div` will be outside the `textarea` tag, and `wrapperStyle` is used to configure the style of it.|CSSProperties |`-`|-|
+|wordLimitPosition|The position of the word count|`'inside' \| 'outside'` |`inside`| 2.66.14 |  
 |onChange|Callback when user input|(value: string, e) => void |`-`|-|
 |onClear|Callback when click clear button|() => void |`-`|2.2.0|
 |onPressEnter|Callback when press enter key|(e) => void |`-`|-|
```

**File**: `components/Input/README.zh-CN.md` (modified, +1/-0)
```diff
@@ -61,6 +61,7 @@
 |maxLength|输入框最大输入的长度；设置 `errorOnly`为 `true` 后，超过 `maxLength` 会展示 `error` 状态，并不限制用户输入。|number \| { length: number; errorOnly?: boolean } |`-`|`errorOnly` in 2.23.0|
 |style|节点样式|CSSProperties |`-`|-|
 |wrapperStyle|开启字数统计之后，会在 `textarea` 标签外包一层 `div`，`wrapperStyle` 用来配置这个 `div` 的样式。|CSSProperties |`-`|-|
+|wordLimitPosition|字数统计的位置|`'inside' \| 'outside'` |`inside`| 2.66.14 |
 |onChange|输入时的回调|(value: string, e) => void |`-`|-|
 |onClear|点击清除按钮的回调|() => void |`-`|2.2.0|
 |onPressEnter|按下回车键的回调|(e) => void |`-`|-|
```

**File**: `components/Input/__demo__/max-length.md` (modified, +8/-0)
```diff
@@ -56,6 +56,14 @@ function App() {
           wrapperStyle={{ width: 300 }}
         />
       </Space>
+
+      <Input.TextArea
+        maxLength={50}
+        showWordLimit
+        wordLimitPosition="outside"
+        placeholder="Word count below the textarea"
+        wrapperStyle={{ width: 300 }}
+      />
     </Space>
   );
 }
```

**File**: `components/Input/__test__/__snapshots__/demo.test.ts.snap` (modified, +20/-0)
```diff
@@ -734,6 +734,7 @@ exports[`renders Input/demo/max-length.md correctly 1`] = `
   </div>
   <div
     class="arco-space-item"
+    style="margin-bottom:8px"
   >
     <div
       class="arco-space arco-space-horizontal arco-space-align-start"
@@ -790,6 +791,25 @@ exports[`renders Input/demo/max-length.md correctly 1`] = `
       </div>
     </div>
   </div>
+  <div
+    class="arco-space-item"
+  >
+    <div
+      class="arco-textarea-wrapper arco-textarea-wrapper-word-limit-outside"
+      style="width:300px"
+    >
+      <textarea
+        class="arco-textarea"
+        maxlength="50"
+        placeholder="Word count below the textarea"
+      />
+      <span
+        class="arco-textarea-word-limit arco-textarea-word-limit-outside"
+      >
+        0/50
+      </span>
+    </div>
+  </div>
 </div>
 `;
 
```

**File**: `components/Input/__test__/index.test.tsx` (modified, +17/-0)
```diff
@@ -294,6 +294,23 @@ describe('Test Textarea', () => {
     expect(inputLimitElement()).toHaveLength(0);
   });
 
+  it('test TextArea wordLimitPosition', () => {
+    const textarea = render(
+      <Input.TextArea
+        maxLength={50}
+        defaultValue={getLengthString(20)}
+        showWordLimit
+        wordLimitPosition="outside"
+      />
+    );
+    const textareaWrapperElement = () => textarea.container.querySelector('.arco-textarea-wrapper');
+    const textareaLimitElement = () =>
+      textarea.container.querySelector('.arco-textarea-word-limit');
+    expect(textareaWrapperElement()).toHaveClass('arco-textarea-wrapper-word-limit-outside');
+    expect(textareaLimitElement()).toHaveClass('arco-textarea-word-limit-outside');
+    expect(textareaLimitElement()?.textContent).toEqual('20/50');
+  });
+
   it('test maxLength.errorOnly', () => {
     const input = render(
       <Input
```

**File**: `components/Input/interface.tsx` (modified, +5/-0)
```diff
@@ -222,6 +222,11 @@ export interface TextAreaProps
    */
   maxLength?: number | { length: number; errorOnly?: boolean };
   showWordLimit?: boolean;
+  /**
+   * @zh 字数统计的位置
+   * @en The position of the word count
+   */
+  wordLimitPosition?: 'inside' | 'outside';
   /**
    * @zh 允许清空输入框
    * @en Whether allow clear the content
```

**File**: `components/Input/style/rtl.less` (modified, +6/-0)
```diff
@@ -138,4 +138,10 @@
       left: @textarea-layout-tip-right;
     }
   }
+
+  &.@{textarea-prefix-cls}-wrapper-word-limit-outside {
+    .@{textarea-prefix-cls}-word-limit {
+      align-self: flex-start;
+    }
+  }
 }
```

**File**: `components/Input/style/textarea.less` (modified, +14/-0)
```diff
@@ -6,6 +6,20 @@
   width: 100%;
 }
 
+.@{textarea-prefix-cls}-wrapper-word-limit-outside {
+  display: inline-flex;
+  flex-direction: column;
+  align-items: stretch;
+  vertical-align: top;
+
+  .@{textarea-prefix-cls}-word-limit {
+    position: static;
+    align-self: flex-end;
+    margin-top: @spacing-2;
+    line-height: @line-height-base;
+  }
+}
+
 .@{textarea-prefix-cls}-clear-wrapper {
   &:hover {
     .@{textarea-prefix-cls}-clear-icon {
```

---

### Incident Patch 13: `05324602` (2026-04-16)
**Commit Message**: fix(Tree): 修复Tree组件的Tree.Node内添加Input组件后,在Input组件内输入中文,光标会跳动的问题 (#3169)

**File**: `components/Tree/__test__/index.test.tsx` (modified, +52/-0)
```diff
@@ -2,6 +2,7 @@ import React from 'react';
 import { render, fireEvent, act } from '../../../tests/util';
 import mountTest from '../../../tests/mountTest';
 import Tree from '..';
+import Input from '../../Input';
 import { IconHeartFill } from '../../../icon';
 import componentConfigTest from '../../../tests/componentConfigTest';
 
@@ -109,6 +110,57 @@ describe('Tree', () => {
     const summaryNodeLength = getTreeNodesLength(data);
     expect(wrapper.find(`${prefixCls}-node`)).toHaveLength(summaryNodeLength);
   });
+
+  it('should keep caret position for controlled input rendered in title', () => {
+    function Demo() {
+      const [value, setValue] = React.useState('abc');
+
+      return (
+        <Tree defaultExpandedKeys={['0-0']}>
+          <TreeNode title="Trunk" key="0-0">
+            <TreeNode key="0-0-0" title={<Input value={value} onChange={setValue} />} />
+          </TreeNode>
+        </Tree>
+      );
+    }
+
+    const wrapper = render(<Demo />);
+    const innerInput = wrapper.querySelectorAll('input')[0] as HTMLInputElement;
+
+    act(() => {
+      innerInput.focus();
+      innerInput.setSelectionRange(2, 2);
+    });
+
+    fireEvent.compositionStart(innerInput);
+    fireEvent.compositionUpdate(innerInput, {
+      target: {
+        value: 'ab中c',
+      },
+    });
+    fireEvent.change(innerInput, {
+      target: {
+        value: 'ab中c',
+      },
+    });
+
+    act(() => {
+      innerInput.setSelectionRange(3, 3);
+    });
+
+    fireEvent.compositionEnd(innerInput, {
+      target: {
+        value: 'ab中c',
+      },
+    });
+
+    const updatedInput = wrapper.querySelectorAll('input')[0] as HTMLInputElement;
+    expect(updatedInput.value).toBe('ab中c');
+    expect(document.activeElement).toBe(updatedInput);
+    expect(updatedInput.selectionStart).toBe(3);
+    expect(updatedInput.selectionEnd).toBe(3);
+  });
+
   it('tree render treedata', () => {
     const wrapper = render(<Tree treeData={data} />);
     const wrapper2 = render(<Tree>{generatorTreeNodes(data)}</Tree>);
```

**File**: `components/Tree/index.tsx` (modified, +20/-13)
```diff
@@ -158,16 +158,21 @@ class Tree extends Component<TreeProps, TreeState> {
 
     if (prevProps !== this.props || !isEqualWith(prevMergedProps, mergedProps)) {
       const newState: Partial<TreeState> = {};
-      if (
-        this.needUpdateTreeData(
-          { ...prevMergedProps, ...prevProps },
-          { ...mergedProps, ...this.props }
-        )
-      ) {
+      const shouldUsePropsNodeList = !('treeData' in this.props);
+      let latestTreeData = this.state.treeData;
+      const treeDataChanged = this.needUpdateTreeData(
+        { ...prevMergedProps, ...prevProps },
+        { ...mergedProps, ...this.props }
+      );
+      if (treeDataChanged) {
         const treeData = this.getTreeData();
-        const nodeList = this.getNodeList(treeData);
-        newState.treeData = treeData;
-        newState.nodeList = nodeList;
+        latestTreeData = treeData;
+
+        if (!shouldUsePropsNodeList) {
+          const nodeList = this.getNodeList(treeData);
+          newState.treeData = treeData;
+          newState.nodeList = nodeList;
+        }
 
         if ('expandedKeys' in this.props) {
           const derivedExpandedKeys = this.getInitExpandedKeys(this.props.expandedKeys || []);
@@ -197,7 +202,7 @@ class Tree extends Component<TreeProps, TreeState> {
       }
 
       if (
-        newState.treeData ||
+        treeDataChanged ||
         ('checkedKeys' in this.props && !isEqualWith(prevProps.checkedKeys, this.props.checkedKeys))
       ) {
         // 说明treeData变了，需要比较下内部checkedKeys
@@ -252,9 +257,9 @@ class Tree extends Component<TreeProps, TreeState> {
               });
       }
       const currentExpandKeys = newState.currentExpandKeys || this.state.currentExpandKeys;
-      if (newState.treeData && currentExpandKeys) {
+      if (treeDataChanged && currentExpandKeys) {
         newState.currentExpandKeys = currentExpandKeys.filter((key) => {
-          const item = newState.treeData.find((node) => node.key === key);
+          const item = latestTreeData?.find((node) => node.key === key);
           return item && item.children && item.children.length;
         });
       }
@@ -812,6 +817,8 @@ class Tree extends Component<TreeProps, TreeState> {
     const { getPrefixCls, rtl } = this.context;
 
     const prefixCls = getPrefixCls('tree');
+    const nodeList =
+      'treeData' in this.props ? this.state.nodeList : this.getNodeList(this.getTreeData());
 
     return (
       <TreeContext.Provider
@@ -860,7 +867,7 @@ class Tree extends Component<TreeProps, TreeState> {
           currentExpandKeys={this.state.currentExpandKeys}
           getNodeProps={this.getNodeProps}
           getDataSet={this.getDataSet}
-          nodeList={this.state.nodeList}
+          nodeList={nodeList}
           onMouseDown={this.props.onMouseDown}
           ariaProps={{
             role: 'tree',
```

---

### Incident Patch 14: `5c91cea3` (2026-04-16)
**Commit Message**: fix(DatePicker): [Genius AI] 修复 Modal 组件内首个表单项为 DatePicker 时，首次打开后焦点不会自动聚焦到DatePicker元素输入框上，会回退到 body，ESC 不能关闭弹窗的问题 (#3166)

* feat: 完成了Modal弹窗首个组件为时间选择器导致焦点丢失修复

Co-authored-by: GeniusAI <[REDACTED_EMAIL]>

* test: 修正测试用例

---------

Co-authored-by: lingyunsong <[REDACTED_EMAIL]>
Co-authored-by: GeniusAI <[REDACTED_EMAIL]>

**File**: `components/DatePicker/picker.tsx` (modified, +6/-1)
```diff
@@ -187,6 +187,7 @@ const Picker = (baseProps: InnerPickerProps, ref) => {
   const [hoverPlaceholderValue, setHoverPlaceholderValue] = useState<string>();
 
   const mergedPopupVisible = 'popupVisible' in props ? props.popupVisible : popupVisible;
+  const prevPopupVisibleRef = useRef<boolean>(mergedPopupVisible);
 
   const mergedValue =
     'value' in props ? (getDayjsValue(propsValue, format, utcOffset, timezone) as Dayjs) : value;
@@ -238,6 +239,8 @@ const Picker = (baseProps: InnerPickerProps, ref) => {
   useEffect(() => {
     setInputValue(undefined);
     setHoverPlaceholderValue(undefined);
+    const prevPopupVisible = prevPopupVisibleRef.current;
+    prevPopupVisibleRef.current = mergedPopupVisible;
 
     if (mergedPopupVisible) {
       setPageShowDate(defaultPageShowDate);
@@ -250,7 +253,9 @@ const Picker = (baseProps: InnerPickerProps, ref) => {
       setTimeout(() => {
         setIsTimePanel(false);
         setPanelMode(mode);
-        blurInput();
+        if (prevPopupVisible && document.activeElement === refInput.current?.input) {
+          blurInput();
+        }
       }, 100);
     }
   }, [mergedPopupVisible]);
```

**File**: `components/Modal/__test__/index.test.tsx` (modified, +42/-3)
```diff
@@ -2,6 +2,9 @@ import React, { useState } from 'react';
 import mountTest from '../../../tests/mountTest';
 import Modal from '..';
 import Button from '../../Button';
+import DatePicker from '../../DatePicker';
+import Form from '../../Form';
+import Input from '../../Input';
 import { $, render, fireEvent, cleanup } from '../../../tests/util';
 import { Esc } from '../../_util/keycode';
 
@@ -67,7 +70,7 @@ describe('Modal', () => {
         </Modal>
       </div>
     );
-    expect(component.querySelector('.arco-modal-close-icon').textContent).toBe('xxx');
+    expect(component.querySelector('.arco-modal-close-icon')?.textContent).toBe('xxx');
   });
 
   it('open modal correctly', () => {
@@ -83,7 +86,9 @@ describe('Modal', () => {
 
     expect($('.arco-modal-mask').length).toBe(1);
 
-    fireEvent.click(wrapper.querySelector('.arco-modal-close-icon'));
+    const closeIcon = wrapper.querySelector('.arco-modal-close-icon');
+    expect(closeIcon).toBeTruthy();
+    fireEvent.click(closeIcon as Element);
 
     jest.runAllTimers();
 
@@ -152,7 +157,9 @@ describe('Modal', () => {
     });
     jest.runAllTimers();
     expect(document.querySelectorAll(`.arco-modal-wrapper`)).toHaveLength(2);
-    fireEvent.keyDown(document.querySelectorAll('[data-focus-lock-disabled]')[0], {
+    const focusLockNode = document.querySelectorAll('[data-focus-lock-disabled]')[0];
+    expect(focusLockNode).toBeTruthy();
+    fireEvent.keyDown(focusLockNode, {
       key: Esc.key,
     });
     jest.runAllTimers();
@@ -201,4 +208,36 @@ describe('Modal', () => {
     expect(document.querySelectorAll(`.arco-modal-wrapper`)).toHaveLength(0);
     jest.useRealTimers();
   });
+
+  it('should keep focus on DatePicker input and close modal with esc', () => {
+    const onCancel = jest.fn();
+
+    render(
+      <Modal visible title="Add User" onCancel={onCancel}>
+        <Form>
+          <Form.Item label="Date of Birth" field="birthday">
+            <DatePicker placeholder="" />
+          </Form.Item>
+          <Form.Item label="Name" field="name">
+            <Input placeholder="" />
+          </Form.Item>
+        </Form>
+      </Modal>
+    );
+
+    jest.runAllTimers();
+
+    const focusLockNode = document.querySelector('[data-focus-lock-disabled]');
+    expect(focusLockNode).toBeTruthy();
+
+    const dateInput = document.querySelector('.arco-picker-input input') as HTMLInputElement;
+    expect(dateInput).toBeTruthy();
+    expect(focusLockNode).toContainElement(dateInput);
+
+    fireEvent.keyDown(focusLockNode as HTMLElement, {
+      key: Esc.key,
+    });
+
+    expect(onCancel).toHaveBeenCalledTimes(1);
+  });
 });
```

**File**: `components/_class/picker/input.tsx` (modified, +2/-0)
```diff
@@ -43,6 +43,7 @@ export interface DateInputProps {
 type DateInputHandle = {
   focus: () => void;
   blur: () => void;
+  input: HTMLInputElement | null;
 };
 
 function DateInput(
@@ -85,6 +86,7 @@ function DateInput(
     blur() {
       input.current && input.current.blur && input.current.blur();
     },
+    input: input.current,
     getRootDOMNode: () => inputWrapperRef.current,
   }));
 
```

---

### Incident Patch 15: `617fdb6b` (2026-04-16)
**Commit Message**: fix(Pagination): [Genius AI] 修复Table 分页同时设置 defaultPageSize 与 sizeCanChange 时，分页器初始每页数量显示为 sizeOptions 首项或者默认值10而非 defaultPageSize，导致每页size数值和table实际展示的条目不一致的问题 (#3165)

* feat: 完成了Table Pagination：开启 sizeCanChange 时初始分页大小不符合 defaultPageSize

Co-authored-by: GeniusAI <[REDACTED_EMAIL]>

* test: 修正测试用例

---------

Co-authored-by: lingyunsong <[REDACTED_EMAIL]>
Co-authored-by: GeniusAI <[REDACTED_EMAIL]>

**File**: `components/Pagination/__test__/index.test.tsx` (modified, +8/-0)
```diff
@@ -55,6 +55,14 @@ describe('Pagination', () => {
     expect(component.find('.arco-pagination-item-disabled')).toHaveLength(2);
   });
 
+  it('should display defaultPageSize when sizeCanChange is enabled', () => {
+    const component = render(
+      <Pagination total={200} sizeCanChange pageSize={20} sizeOptions={[10, 30, 40, 50]} />
+    );
+
+    expect(component.find('.arco-select-view-value')[0].innerHTML.startsWith('20')).toBe(true);
+  });
+
   it('trigger onPageSizeChange correctly', () => {
     const mockPageSizeChange = jest.fn();
     const mockChange = jest.fn();
```

**File**: `components/Pagination/page-options.tsx` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ function PageOption(props: PageOptionProps) {
         aria-label={locale.Pagination.pageSize}
       >
         <Select
-          value={sizeOptions.indexOf(pageSize) !== -1 ? pageSize : sizeOptions[0]}
+          value={pageSize}
           onChange={(value) => {
             onPageSizeChange(value);
           }}
```

**File**: `components/Table/__test__/pagination.test.tsx` (modified, +23/-0)
```diff
@@ -96,4 +96,27 @@ describe('Table test', () => {
     expect(component.find('.arco-table-no-data')).toHaveLength(1);
     expect(component.find('.arco-table-pagination')).toHaveLength(1);
   });
+
+  it('table pagination should respect defaultPageSize when sizeCanChange is enabled', () => {
+    const tableData = new Array(40).fill(null).map((_, index) => ({
+      key: `${index}`,
+      name: `name-${index}`,
+      value: `value-${index}`,
+    }));
+    const tableColumns = ['name', 'value'].map((key) => ({ title: key, dataIndex: key }));
+    const component = render(
+      <Table
+        columns={tableColumns}
+        data={tableData}
+        pagination={{
+          defaultPageSize: 20,
+          sizeCanChange: true,
+          sizeOptions: [10, 30, 40, 50],
+        }}
+      />
+    );
+
+    expect(component.find('.arco-select-view-value')[0].innerHTML.startsWith('20')).toBe(true);
+    expect(component.find('tbody tr')).toHaveLength(20);
+  });
 });
```

#### Recent Merged Pull Requests:
- **PR #3199** (2026-08-24): fix: prevent redundant OverflowEllipsis updates (@yzylin0)
- **PR #3197** (2026-08-07): fix(Cascader): 修复级联面板宽度变化导致页面抖动 (@lyspro)
- **PR #3193** (2026-07-14): fix(Table): 修复操作列左边线判断 (@lyspro)
- **PR #3192** (2026-07-14): fix(Trigger): 修复弹层横向边界计算 (@wsm972774037)
- **PR #3178** (2026-05-06): fix(Image): 修复Image.Preview 弹出层关闭按钮点击事件冒泡，导致误触发父元素的click事件的问题 (@lyspro)
- **PR #3177** (2026-05-06): fix(Tree): 修复修复 Tree 在 Modal 中使用虚拟列表时，展开/关闭节点或 loadMore 完成后,由于VirtualList 数据变更后的滚动校准过度、旧虚拟窗口状态未及时重算，以及浏览器焦点/scroll anchoring 对虚拟 DOM 重排产生自动滚动补偿导致的滚动条跳动问题 (@lyspro)
- **PR #3176** (2026-05-06): fix(Menu):  修复ResizeObserver 回调内同步测量并更新 Menu 溢出状态，触发连续布局抖动，浏览器上报 loop error问题 (@lyspro)
- **PR #3175** (2026-05-06): fix(Form): 修复Form组件中form.scrollToField 命中数字开头或含特殊字符的字段 id 时抛出非法选择器错误，滚动失败问题 (@lyspro)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
