# Forensic Learning Record (Deep Inspection): alibaba-fusion/next

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-fusion-next-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba-fusion/next](https://github.com/alibaba-fusion/next))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:08:25.876Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba-fusion/next`
- **Description**: 🦍 A configurable component library for web built on React. 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4679 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `components/affix/util.ts`
```
export function getScroll(node: Window | Element, isVertical?: boolean) {
    if (typeof window === 'undefined') {
        return 0;
    }
    const windowProp = isVertical ? 'pageYOffset' : 'pageXOffset';
    const elementProp = isVertical ? 'scrollTop' : 'scrollLeft';
    return node === window ? node[windowProp] : (node as Element)[elementProp];
}

export function getRect(node: Window | Element) {
    return node !== window
        ? (node as Element).getBoundingClientRect()
        : { top: 0, left: 0, bottom: 0 };
}

export function getNodeHeight(node: Window | Element) {
    if (!node) {
        return 0;
    }
    if (node === window) {
        return window.innerHeight;
    }
    return (node as Element).clientHeight;
}

```

### Core Architecture Module: `components/balloon/util.tsx`
```
import React, { type ReactElement } from 'react';

export function getDisabledCompatibleTrigger(
    element: ReactElement & { type: { displayName: string } }
) {
    if (element.type.displayName === 'Config(Button)' && element.props.disabled) {
        const displayStyle =
            element.props.style && element.props.style.display
                ? element.props.style.display
                : 'inline-block';
        const child = React.cloneElement(element, {
            style: {
                ...element.props.style,
                pointerEvents: 'none',
            },
        });
        return (
            // eslint-disable-next-line
            <span style={{ display: displayStyle, cursor: 'not-allowed' }}>{child}</span>
        );
    }
    return element;
}

```

### Core Architecture Module: `components/calendar/utils/index.ts`
```
import moment, {
    type MomentInput,
    type Moment,
    type MomentFormatSpecification,
    type Locale as MomentLocale,
} from 'moment';
import { type CalendarMode, type MomentLocaleLike } from '../types';

export const DAYS_OF_WEEK = 7;

export const CALENDAR_TABLE_COL_COUNT = 7;

export const CALENDAR_TABLE_ROW_COUNT = 6;

export const MONTH_TABLE_ROW_COUNT = 4;

export const MONTH_TABLE_COL_COUNT = 3;

export const YEAR_TABLE_ROW_COUNT = 4;

export const YEAR_TABLE_COL_COUNT = 3;

export const CALENDAR_MODE_YEAR = 'year';

export const CALENDAR_MODE_MONTH = 'month';

export const CALENDAR_MODE_DATE = 'date';

export const CALENDAR_MODES = [
    CALENDAR_MODE_DATE,
    CALENDAR_MODE_MONTH,
    CALENDAR_MODE_YEAR,
] as CalendarMode[];

export function isDisabledDate(date: unknown, fn: unknown, view: unknown) {
    if (typeof fn === 'function' && fn(date, view)) {
        return true;
    }
    return false;
}

export function checkMomentObj(
    props: Record<string, unknown>,
    propName: string,
    componentName: string
) {
    if (props[propName] && !moment.isMoment(props[propName])) {
        return new Error(
            `Invalid prop ${propName} supplied to ${componentName}. Required a moment object`
        );
    }
}

export function formatDateValue(value: unknown, reservedValue = null) {
    if (value && moment.isMoment(value)) {
        return value;
    }
    return reservedValue;
}

export function getVisibleMonth(defaultVisibleMonth: () => Moment, value: unknown): Moment;
export function getVisibleMonth<V>(defaultVisibleMonth: unknown, value: V): Moment | NonNullable<V>;
export function getVisibleMonth<V>(
    defaultVisibleMonth: unknown,
    value: V
): Moment | NonNullable<V> {
    let getVM = defaultVisibleMonth;
    if (typeof getVM !== 'function' || !moment.isMoment(getVM())) {
        getVM = () => {
            if (value) {
                return value;
            }
            return moment();
        };
    }
    return (getVM as () => Moment | NonNullable<V>)();
}

export function isSameYearMonth(dateA: Moment, dateB: Moment) {
    return dateA.month() === dateB.month() && dateA.year() === dateB.year();
}

export function preFormatDateValue(value: MomentInput | Moment, format: MomentFormatSpecification) {
    const val = typeof value === 'string' ? moment(value, format, false) : value;
    if (val && moment.isMoment(val) && val.isValid()) {
        return val;
    }

    return null;
}

export function getLocaleData(
    {
        months,
        shortMonths,
        firstDayOfWeek,
        weekdays,
        shortWeekdays,
        veryShortWeekdays,
    }: {
        months?: string[];
        shortMonths?: string[];
        firstDayOfWeek?: number;
        weekdays?: string[];
        shortWeekdays?: string[];
        veryShortWeekdays?: string[];
    },
    localeData: MomentLocale
): MomentLocaleLike {
    return {
        ...localeData,
        monthsShort: () => shortMonths || localeData.monthsShort(),
        months: () => months || localeData.months(),
        firstDayOfWeek: () => firstDayOfWeek || localeData.firstDayOfWeek(),
        weekdays: () => weekdays || localeData.weekdays(),
        weekdaysShort: () => shortWeekdays || localeData.weekdaysShort(),
        weekdaysMin: () => veryShortWeekdays || localeData.weekdaysMin(),
    };
}

export function getYears(yearRange: [number?, number?], yearRangeOffset: number, year: number) {
    const options = [];
    let [startYear, endYear] = yearRange;
    if (!startYear || !endYear) {
        startYear = year - yearRangeOffset;
        endYear = year + yearRangeOffset;
    }

    for (let i = startYear; i <= endYear; i++) {
        options.push({
            label: i,
            value: i,
        });
    }
    return options;
}

export function getMonths(momentLocale: MomentLocaleLike) {
    const localeMonths = momentLocale.monthsShort();
    const options = [];
    for (let i = 0; i < 12; i++) {
        options.push({
            value: i,
            label: localeMonths[i],
        });
    }
    return options;
}

```

### Core Architecture Module: `components/cascader/utils.ts`
```
import type {
    CascaderDataItem,
    CascaderDataItemWithPosInfo,
    NormalizeValueReturns,
    P2n,
    V2n,
} from './types';

/**
 * 将 values 正规化为数组形式
 * @param values - 要被正规化的值
 * @returns 正规化为数组形式的值
 */
export function normalizeToArray<T>(values: T): NormalizeValueReturns<T> {
    if (values !== undefined && values !== null) {
        if (Array.isArray(values)) {
            return [...values] as NormalizeValueReturns<T>;
        }

        return [values] as NormalizeValueReturns<T>;
    }
    return [] as NormalizeValueReturns<T>;
}

/**
 * 判断子节点是否是选中状态，如果 checkable=false 则向下递归，
 * @param child - 子节点
 * @param checkedValues - 选中的值
 */
export function isNodeChecked(node: CascaderDataItem, checkedValues: string[]): boolean {
    if (node.disabled || node.checkboxDisabled) return true;
    if (node.checkable === false) {
        return (
            !node.children ||
            node.children.length === 0 ||
            node.children.every(c => isNodeChecked(c, checkedValues))
        );
    }
    return checkedValues.indexOf(node.value) > -1;
}

/**
 * 遍历所有可用的子节点
 * @param node - 子节点
 * @param callback - 遍历的回调
 */
export function forEachEnableNode(
    node: CascaderDataItem,
    callback: (node: CascaderDataItem) => void = () => {}
) {
    if (node.disabled || node.checkboxDisabled) return;
    callback(node);
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => forEachEnableNode(child, callback));
    }
}
/**
 * 判断节点是否禁用 checked
 * @param node - 节点
 */
export function isNodeDisabledChecked(node: CascaderDataItem): boolean {
    if (node.disabled || node.checkboxDisabled) return true;
    if (node.checkable === false) {
        return (
            !node.children ||
            node.children.length === 0 ||
            node.children.every(isNodeDisabledChecked)
        );
    }

    return false;
}

/**
 * 递归获取一个 checkable=true 的父节点，当 checkable=false 时继续往上查找
 * @param node - 子节点
 * @param _p2n - 位置信息
 * @returns checkable=true 的父节点
 */
export function getCheckableParentNode(node: CascaderDataItemWithPosInfo, _p2n: P2n) {
    let parentPos: string | string[] = node.pos.split('-');
    if (parentPos.length === 2) return node;
    parentPos.splice(parentPos.length - 1, 1);
    parentPos = parentPos.join('-');
    const parentNode = _p2n[parentPos];
    if (parentNode.disabled || parentNode.checkboxDisabled) return false;
    if (parentNode.checkable === false) {
        return getCheckableParentNode(parentNode, _p2n);
    }

    return parentNode;
}
/**
 * 过滤子节点的值
 * @param values - 子节点的值
 * @param _v2n - 节点信息
 * @param _p2n - 位置信息
 */
export function filterChildValue(values: string[], _v2n: V2n, _p2n: P2n) {
    const newValues: string[] = [];
    values.forEach(value => {
        const node = getCheckableParentNode(_v2n[value], _p2n);
        if (
            !node ||
            node.checkable === false ||
            node === _v2n[value] ||
            values.indexOf(node.value) === -1
        ) {
            newValues.push(value);
        }
    });
    return newValues;
}

export function filterParentValue(values: string[], _v2n: V2n) {
    const newValues = [];

    for (let i = 0; i < values.length; i++) {
        const node = _v2n[values[i]];
        if (
            !node.children ||
            node.children.length === 0 ||
            node.children.every(isNodeDisabledChecked)
        ) {
            newValues.push(values[i]);
        }
    }

    return newValues;
}
/**
 * 判断当前节点是否是目标节点的子孙节点
 * @param currentPos - 当前节点的位置
 * @param targetPos - 目标节点的位置
 */
export function isDescendantOrSelf(currentPos: string, targetPos: string) {
    if (!currentPos || !targetPos) {
        return false;
    }

    const currentNums = currentPos.split('-');
    const targetNums = targetPos.split('-');

    return (
        currentNums.length <= targetNums.length &&
        currentNums.every((num, index) => {
            return num === targetNums[index];
        })
    );
}

/**
 * 判断当前节点是否是目标节点的兄弟节点
 * @param currentPos - 当前节点的位置
 * @param targetPos - 目标节点的位置
 */
export function isSiblingOrSelf(currentPos: string, targetPos: string) {
    const currentNums = currentPos.split('-').slice(0, -1);
    const targetNums = targetPos.split('-').slice(0, -1);

    return (
        currentNums.length === targetNums.length &&
        currentNums.every((num, index) => {
            return num === targetNums[index];
        })
    );
}

/**
 * 获取所有选中的值
 * @param checkedValues - 候选值
 * @param _v2n - 节点信息
 * @param _p2n - 位置信息
 * @returns 所有选中的值
 */
export function getAllCheckedValues(checkedValues: string[], _v2n: V2n, _p2n: P2n) {
    checkedValues = normalizeToArray(checkedValues);
    const filteredValues = checkedValues.filter(value => !!_v2n[value]);
    const flatValues = [
        ...filterChildValue(filteredValues, _v2n, _p2n),
        ...filteredValues.filter(value => _v2n[value].disabled || _v2n[value].checkboxDisabled),
    ];
    const removeValue = (child: V2n[keyof V2n]) => {
        if (child.disabled || child.checkboxDisabled) return;
        if (child.checkable === false && child.children && child.children.length > 0) {
            return child.children.forEach(removeValue);
        }
        flatValues.splice(flatValues.indexOf(child.value), 1);
    };

    const addParentValue = (i: number, parent: V2n[keyof V2n]) =>
        flatValues.splice(i, 0, parent.value);

    const values = [...flatValues];
    for (let i = 0; i < values.length; i++) {
        const pos = _v2n[values[i]].pos;
        const nums = pos.split('-');
        if (nums.length === 2) {
            break;
        }
        for (let j = nums.length - 2; j > 0; j--) {
            const parentPos = nums.slice(0, j + 1).join('-');
            const parent = _p2n[parentPos];
            if (parent.checkable === false || parent.disabled || parent.checkboxDisabled) continue;
            const parentChecked = parent.children!.every(child => isNodeChecked(child, flatValues));
            if (parentChecked) {
                parent.children!.forEach(removeValue);
                addParentValue(i, parent);
            } else {
                break;
            }
        }
    }

    const newValues: string[] = [];
    flatValues.forEach(value => {
        if (_v2n[value].disabled || _v2n[value].checkboxDisabled) {
            newValues.push(value);
            return;
        }
        forEachEnableNode(_v2n[value], node => {
            if (node.checkable === false) return;
            newValues.push(node.value);
        });
    });

    return newValues;
}

```

### Core Architecture Module: `components/date-picker/util/index.ts`
```
import moment, { type MomentFormatSpecification, type Moment } from 'moment';
import { type KeyboardEvent } from 'react';
import { KEYCODE } from '../../util';
import { type TimePickerProps } from '../../time-picker';
import { type RangePickerProps } from '../types';

export const PANEL = {
    TIME: 'time-panel',
    DATE: 'date-panel',
} as const;

export const DEFAULT_TIME_FORMAT = 'HH:mm:ss';

export function isFunction(obj: unknown) {
    // @ts-expect-error 目前的写法 ts 不友好，其实可以写成更简洁的 typeof 判断
    return !!(obj && obj.constructor && obj.call && obj.apply);
}

type ResetValueTimeReturn<T, S> = T extends Moment ? (S extends Moment ? Moment : T) : T;

/**
 * 将 source 的 time 替换为 target 的 time
 * @param source - 输入值
 * @param target - 目标值
 */
export function resetValueTime<T, S>(source: T, target: S): ResetValueTimeReturn<T, S> {
    if (!moment.isMoment(source) || !moment.isMoment(target)) {
        return source as ResetValueTimeReturn<T, S>;
    }
    return source
        .clone()
        .hour(target.hour())
        .minute(target.minute())
        .second(target.second()) as ResetValueTimeReturn<T, S>;
}

export function formatDateValue(
    value: string | Moment | undefined | null,
    format?: MomentFormatSpecification
) {
    const val = typeof value === 'string' ? moment(value, format, false) : value;
    if (val && moment.isMoment(val) && val.isValid()) {
        return val;
    }

    return null;
}

export function checkDateValue(
    props: Record<string, unknown>,
    propName: string,
    componentName: string
) {
    // 支持传入 moment 对象或字符串，字符串不检测是否为日期字符串
    if (
        props[propName] &&
        !moment.isMoment(props[propName]) &&
        typeof props[propName] !== 'string'
    ) {
        return new Error(
            `Invalid prop ${propName} supplied to ${componentName}. Required a moment object or format date string!`
        );
    }
}

export function getDateTimeFormat(
    format: string | undefined,
    showTime: RangePickerProps['showTime'],
    type?: 'date' | 'month' | 'year' | 'time'
) {
    if (!format && type) {
        format = {
            date: 'YYYY-MM-DD',
            month: 'YYYY-MM',
            year: 'YYYY',
            time: '',
        }[type];
    }
    const timeFormat = showTime ? (showTime as TimePickerProps).format || DEFAULT_TIME_FORMAT : '';
    const dateTimeFormat = timeFormat ? `${format} ${timeFormat}` : format;
    return {
        format,
        timeFormat,
        dateTimeFormat,
    };
}

export function extend<S extends Record<string, unknown>, T extends Record<string, unknown>>(
    source: S,
    target: T
): S & T {
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            (target as Record<string, unknown>)[key] = source[key];
        }
    }
    return target as S & T;
}

/**
 * 监听键盘事件，操作日期字符串
 * @param e - 事件对象
 * @param param1 - 参数
 * @param type - 类型 year month day
 */
export function onDateKeydown(
    e: KeyboardEvent,
    {
        format,
        dateInputStr,
        value,
    }: { format?: string; dateInputStr: string; value?: Moment | null },
    type: 'year' | 'month' | 'day'
) {
    if ([KEYCODE.UP, KEYCODE.DOWN, KEYCODE.PAGE_UP, KEYCODE.PAGE_DOWN].indexOf(e.keyCode) === -1) {
        return;
    }

    if (
        (e.altKey && [KEYCODE.PAGE_UP, KEYCODE.PAGE_DOWN].indexOf(e.keyCode) === -1) ||
        e.ctrlKey ||
        e.shiftKey
    ) {
        return;
    }

    let date = moment(dateInputStr, format, true);

    if (date.isValid()) {
        const stepUnit = e.altKey ? 'year' : 'month';
        switch (e.keyCode) {
            case KEYCODE.UP:
                date.subtract(1, type);
                break;
            case KEYCODE.DOWN:
                date.add(1, type);
                break;
            case KEYCODE.PAGE_UP:
                date.subtract(1, stepUnit);
                break;
            case KEYCODE.PAGE_DOWN:
                date.add(1, stepUnit);
                break;
        }
    } else if (value) {
        date = value.clone();
    } else {
        date = moment();
    }

    e.preventDefault();
    return date.format(format);
}

/**
 * 监听键盘事件，操作时间
 * @param e - 事件对象
 * @param param1 - 参数
 * @param type - second hour minute
 */
export function onTimeKeydown(
    e: KeyboardEvent,
    {
        format,
        timeInputStr,
        steps,
        value,
    }: {
        format: string;
        timeInputStr: string;
        steps: Record<string, number>;
        value?: Moment | null;
    },
    type: 'second' | 'minute' | 'hour'
) {
    if ([KEYCODE.UP, KEYCODE.DOWN, KEYCODE.PAGE_UP, KEYCODE.PAGE_DOWN].indexOf(e.keyCode) === -1)
        return;
    if (
        (e.altKey && [KEYCODE.PAGE_UP, KEYCODE.PAGE_DOWN].indexOf(e.keyCode) === -1) ||
        e.ctrlKey ||
        e.shiftKey
    )
        return;

    let time = moment(timeInputStr, format, true);

    if (time.isValid()) {
        const stepUnit = e.altKey ? 'hour' : 'minute';
        switch (e.keyCode) {
            case KEYCODE.UP:
                time.subtract(steps[type], type);
                break;
            case KEYCODE.DOWN:
                time.add(steps[type], type);
                break;
            case KEYCODE.PAGE_UP:
                time.subtract(steps[stepUnit], stepUnit);
                break;
            case KEYCODE.PAGE_DOWN:
                time.add(steps[stepUnit], stepUnit);
                break;
        }
    } else if (value) {
        time = value.clone();
    } else {
        time = moment().hours(0).minutes(0).seconds(0);
    }

    e.preventDefault();
    return time.format(format);
}

```

### Core Architecture Module: `components/date-picker2/util.js`
```
import { datejs } from '../util';
import { DATE_INPUT_TYPE } from './constant';

export function setTime(targetVal, sourceVal) {
    if (sourceVal && targetVal) {
        return targetVal
            .hour(sourceVal.hour())
            .minute(sourceVal.minute())
            .second(sourceVal.second())
            .millisecond(sourceVal.millisecond());
    }
    return targetVal;
}

export function switchInputType(inputType) {
    const { BEGIN, END } = DATE_INPUT_TYPE;
    return inputType === BEGIN ? END : BEGIN;
}

export function mode2unit(mode) {
    return mode === 'date' ? 'day' : mode;
}

/**
 * 获取输入框值
 * @param {*} value 日期值
 * @param {string | funtion} format 日期格式
 * @returns {string | string[]}
 */
export function fmtValue(value, fmt) {
    const formater = (v, idx) => {
        let _fmt = fmt;

        if (Array.isArray(fmt)) {
            _fmt = fmt[idx];
        }

        return v ? (typeof _fmt === 'function' ? _fmt(v) : v.format(_fmt)) : '';
    };

    return Array.isArray(value) ? value.map((v, idx) => formater(v, idx)) : formater(value);
}

/**
 * 判断值是否改变
 * @param {dayjs.ConfigType}} newValue
 * @param {dayjs.ConfigType} oldValue
 * @returns {boolean}
 */
export function isValueChanged(newValue, oldValue) {
    return Array.isArray(newValue)
        ? isValueChanged(newValue[0], oldValue && oldValue[0]) || isValueChanged(newValue[1], oldValue && oldValue[1])
        : newValue !== oldValue && !datejs(newValue).isSame(oldValue);
}

```

### Core Architecture Module: `components/field/utils.ts`
```
import { isValidElement, cloneElement, type ReactElement, type ReactInstance } from 'react';
import ReactDOM from 'react-dom';
import { type ScrollToFirstErrorOption } from './types';

export function cloneAndAddKey(element: ReactElement) {
    if (element && isValidElement(element)) {
        const key = element.key || 'error';
        return cloneElement(element, { key });
    }
    return element;
}

export function scrollToFirstError({ errorsGroup, options, instance }: ScrollToFirstErrorOption) {
    if (errorsGroup && options.scrollToFirstError) {
        let firstNode: HTMLElement | undefined;
        let firstTop: number | undefined;
        for (const i in errorsGroup) {
            if (errorsGroup.hasOwnProperty(i)) {
                const node = ReactDOM.findDOMNode(instance[i] as ReactInstance) as HTMLElement;
                if (!node) {
                    return;
                }
                const top = node.offsetTop;
                if (firstTop === undefined || firstTop > top) {
                    firstTop = top;
                    firstNode = node;
                }
            }
        }

        if (firstNode) {
            if (
                typeof options.scrollToFirstError === 'number' &&
                window &&
                typeof window.scrollTo === 'function'
            ) {
                const offsetLeft =
                    document && document.body && document.body.offsetLeft
                        ? document.body.offsetLeft
                        : 0;
                window.scrollTo(offsetLeft, firstTop! + options.scrollToFirstError);
            } else if (
                'scrollIntoViewIfNeeded' in firstNode &&
                typeof firstNode.scrollIntoViewIfNeeded === 'function'
            ) {
                firstNode.scrollIntoViewIfNeeded(true);
            } else {
                firstNode.scrollIntoView({ block: 'center' });
            }
        }
    }
}

```

### Core Architecture Module: `components/menu/view/util.ts`
```
import type { K2N, P2N } from '../types';

export const getWidth = (elem: Element | undefined | null) => {
    let width =
        elem &&
        typeof elem.getBoundingClientRect === 'function' &&
        elem.getBoundingClientRect().width;
    if (width) {
        width = +width.toFixed(6);
    }
    return width || 0;
};

export const normalizeToArray = <T>(items: T | T[] | undefined | null) => {
    if (items) {
        if (Array.isArray(items)) {
            return items;
        }
        return [items];
    }

    return [];
};

export const isSibling = (currentPos: string, targetPos: string) => {
    const currentNums = currentPos.split('-').slice(0, -1);
    const targetNums = targetPos.split('-').slice(0, -1);

    return (
        currentNums.length === targetNums.length &&
        currentNums.every((num, index) => {
            return num === targetNums[index];
        })
    );
};

export const isAncestor = (currentPos: string, targetPos: string) => {
    const currentNums = currentPos.split('-');
    const targetNums = targetPos.split('-');

    return (
        currentNums.length > targetNums.length &&
        targetNums.every((num, index) => {
            return num === currentNums[index];
        })
    );
};

export const isAvailablePos = (refPos: string, targetPos: string, _p2n: P2N) => {
    const { type, disabled } = _p2n[targetPos];

    return isSibling(refPos, targetPos) && ((type === 'item' && !disabled) || type === 'submenu');
};

export const getFirstAvaliablelChildKey = (parentPos: string, _p2n: P2N) => {
    const pos = Object.keys(_p2n).find(p => isAvailablePos(`${parentPos}-0`, p, _p2n));
    return pos ? _p2n[pos].key : null;
};

/**
 * 如果 key 在 SelectedKeys 的选中链上（例如 SelectedKeys 是 ['0-1-2'],  key 是 0-1），那么返回 true
 *
 * selectMode?: string; 当前的选择模式，一般为 multiple single
 * selectedKeys?: string[]; 选中的 key 值
 * k2n?: object[] mapping;
 * _key?: string; 待测试的 key 值
 *
 * @returns bool 当前元素是否有孩子被选中
 */
export const getChildSelected = ({
    selectMode,
    selectedKeys,
    _k2n,
    _key,
}: {
    _k2n?: K2N;
    _key: string;
    selectedKeys: string[];
    selectMode?: 'single' | 'multiple';
}) => {
    if (!_k2n) {
        return false;
    }

    const _keyPos = `${_k2n[_key] && _k2n[_key].pos}-`;

    return (
        !!selectMode && selectedKeys.some(key => _k2n[key] && _k2n[key].pos.indexOf(_keyPos) === 0)
    );
};

```

### Core Architecture Module: `components/mixin-ui-state/index.tsx`
```
import React, {
    Component,
    type HTMLAttributes,
    type DetailedReactHTMLElement,
    type ReactHTMLElement,
    type ReactSVGElement,
    type DOMElement,
    type DOMAttributes,
    type FunctionComponentElement,
    type CElement,
    type ComponentState,
    type ReactElement,
} from 'react';
import classnames from 'classnames';
import { func } from '../util';

const { makeChain } = func;

type ClonableElement<P = unknown> =
    | DetailedReactHTMLElement<HTMLAttributes<HTMLElement>, HTMLElement>
    | ReactHTMLElement<HTMLElement>
    | ReactSVGElement
    | DOMElement<DOMAttributes<Element>, Element>
    | FunctionComponentElement<P>
    | CElement<P, Component<P, ComponentState>>
    | ReactElement<P>;

export interface UIStateProps {
    onFocus?: (...rest: unknown[]) => unknown;
    onBlur?: (...rest: unknown[]) => unknown;
}

export interface UIStateState {
    focused?: boolean;
}

/**
 * UIState 为一些特殊元素的状态响应提供了标准的方式，
 * 尤其适合 CSS 无法完全定制的控件，比如 checkbox，radio 等。
 * 若组件 disable 则自行判断是否需要绑定状态管理。
 * 注意：disable 不会触发事件，请使用 resetUIState 还原状态
 */
class UIState<
    P extends UIStateProps = UIStateProps,
    S extends UIStateState = UIStateState,
> extends Component<P, S> {
    constructor(props: P & UIStateProps) {
        super(props);
        this.state = {} as S & UIStateState;
        (['_onUIFocus', '_onUIBlur'] as const).forEach(item => {
            this[item] = this[item].bind(this);
        });
    }
    // base 事件绑定的元素
    getStateElement(base: ClonableElement<P & UIStateProps>) {
        const { onFocus, onBlur } = this.props;
        return React.cloneElement(base, {
            onFocus: makeChain(this._onUIFocus, onFocus),
            onBlur: makeChain(this._onUIBlur, onBlur),
        });
    }
    // 获取状态 classname
    getStateClassName() {
        const { focused } = this.state;
        return classnames({
            focused,
        });
    }
    // 复原状态
    resetUIState() {
        this.setState({
            focused: false,
        });
    }
    _onUIFocus() {
        this.setState({
            focused: true,
        });
    }
    _onUIBlur() {
        this.setState({
            focused: false,
        });
    }
}

export default UIState;

```

### Core Architecture Module: `components/mixin-ui-state/mobile/index.tsx`
```
// @ts-expect-error meet 未导出 MixinUiState
import { MixinUiState as MeetMixinUiState } from '@alifd/meet-react';
import NextMixinUiState from '../index';

const MixinUiState = MeetMixinUiState ? MeetMixinUiState : NextMixinUiState;

export default MixinUiState;

```

### Core Architecture Module: `components/overlay/utils/find-node.ts`
```
import { findDOMNode } from 'react-dom';
import type { Target } from '../types';

export default function findNode<T>(target?: Target<T>, param?: T): Element | Text | null {
    let realTarget: typeof target | void = target;
    if (!realTarget) {
        return null;
    }

    if (typeof realTarget === 'string') {
        return document.getElementById(realTarget);
    }

    if (typeof realTarget === 'function') {
        try {
            realTarget = realTarget(param);
        } catch (err) {
            realTarget = null;
        }
    }

    if (!realTarget) {
        return null;
    }

    try {
        // @ts-expect-error realTarget需要判断是否是ReactInstance，还会存在Element Node Text的情况
        return findDOMNode(realTarget);
    } catch (err) {
        // @ts-expect-error 这个兜底逻辑十分破坏类型完备
        return realTarget;
    }
}

```

### Core Architecture Module: `components/overlay/utils/position.ts`
```
import { type ReactElement } from 'react';
import { dom } from '../../util';
import findNode from './find-node';
import type { PositionProps, PointsType } from '../types';

const VIEWPORT = 'viewport' as const;

// IE8 not support pageXOffset
const getPageX = () => window.pageXOffset || document.documentElement.scrollLeft;
const getPageY = () => window.pageYOffset || document.documentElement.scrollTop;

/**
 * @internal get element size
 */
function _getSize(element: SVGElement | HTMLElement) {
    // element like `svg` do not have offsetWidth and offsetHeight prop
    // then getBoundingClientRect
    if ('offsetWidth' in element && 'offsetHeight' in element) {
        return {
            width: element.offsetWidth,
            height: element.offsetHeight,
        };
    } else {
        const { width, height } = element.getBoundingClientRect();

        return {
            width,
            height,
        };
    }
}

/**
 * @internal get element rect
 */
function _getElementRect(elem: HTMLElement, container?: HTMLElement | ReactElement) {
    let offsetTop = 0,
        offsetLeft = 0,
        scrollTop = 0,
        scrollLeft = 0;

    const { width, height } = _getSize(elem);

    do {
        if (!isNaN(elem.offsetTop)) {
            offsetTop += elem.offsetTop;
        }
        if (!isNaN(elem.offsetLeft)) {
            offsetLeft += elem.offsetLeft;
        }
        if (elem && elem.offsetParent) {
            if (!isNaN(elem.offsetParent.scrollLeft) && elem.offsetParent !== document.body) {
                scrollLeft += elem.offsetParent.scrollLeft;
            }

            if (!isNaN(elem.offsetParent.scrollTop) && elem.offsetParent !== document.body) {
                scrollTop += elem.offsetParent.scrollTop;
            }
        }

        elem = elem.offsetParent as HTMLElement;
    } while (elem !== null && elem !== container);

    // if container is body or invalid, treat as window, use client width & height
    const treatAsWindow = !container || container === document.body;

    return {
        top:
            offsetTop -
            scrollTop -
            (treatAsWindow ? document.documentElement.scrollTop || document.body.scrollTop : 0),
        left:
            offsetLeft -
            scrollLeft -
            (treatAsWindow ? document.documentElement.scrollLeft || document.body.scrollLeft : 0),
        width,
        height,
    };
}

/**
 * @internal get viewport size
 */
function _getViewportSize(container: HTMLElement | SVGElement) {
    if (!container || container === document.body) {
        return {
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight,
        };
    }

    const { width, height } = container.getBoundingClientRect();

    return {
        width,
        height,
    };
}

const getContainer = ({ container, baseElement }: PositionProps) => {
    // SSR下会有副作用
    if (typeof document === 'undefined') {
        return container;
    }

    let calcContainer = findNode(container, baseElement) as HTMLElement;

    if (!calcContainer) {
        calcContainer = document.body;
    }

    while (dom.getStyle(calcContainer, 'position') === 'static') {
        if (!calcContainer || calcContainer === document.body) {
            return document.body;
        }
        calcContainer = calcContainer.parentNode as HTMLElement;
    }

    return calcContainer;
};

export default class Position {
    pinElement: HTMLElement | 'viewport' | undefined;
    baseElement: HTMLElement | 'viewport' | undefined;
    pinFollowBaseElementWhenFixed: boolean | undefined;
    container: HTMLElement;
    autoFit: boolean;
    align: string | boolean;
    offset: Array<number>;
    needAdjust: boolean;
    isRtl: boolean;
    constructor(props: PositionProps) {
        this.pinElement = props.pinElement;
        this.baseElement = props.baseElement;
        this.pinFollowBaseElementWhenFixed = props.pinFollowBaseElementWhenFixed;
        this.container = getContainer(props) as HTMLElement;
        this.autoFit = props.autoFit || false;
        this.align = props.align || 'tl tl';
        this.offset = props.offset || [0, 0];
        this.needAdjust = props.needAdjust || false;
        this.isRtl = props.isRtl || false;
    }

    static VIEWPORT = VIEWPORT;

    static place = (props: PositionProps) => new Position(props).setPosition();

    setPosition() {
        const pinElement = this.pinElement;
        const baseElement = this.baseElement;
        const pinFollowBaseElementWhenFixed = this.pinFollowBaseElementWhenFixed;
        const expectedAlign = this._getExpectedAlign();
        let isPinFixed, isBaseFixed, firstPositionResult;
        if (pinElement === VIEWPORT) {
            return;
        }
        if (dom.getStyle(pinElement!, 'position') !== 'fixed') {
            dom.setStyle(pinElement!, 'position', 'absolute');
            isPinFixed = false;
        } else {
            isPinFixed = true;
        }
        if (baseElement === VIEWPORT || dom.getStyle(baseElement!, 'position') !== 'fixed') {
            isBaseFixed = false;
        } else {
            isBaseFixed = true;
        }

        // 根据期望的定位
        for (let i = 0; i < expectedAlign.length; i++) {
            const align = expectedAlign[i];
            const pinElementPoints = this._normalizePosition(
                pinElement!,
                align.split(' ')[0],
                isPinFixed
            );
            const baseElementPoints = this._normalizePosition(
                baseElement!,
                align.split(' ')[1],
                // 忽略元素位置，发生在类似dialog的场景下
                isPinFixed && !pinFollowBaseElementWhenFixed
            );

            const pinElementParentOffset = this._getParentOffset(pinElement!);
            const pinElementParentScrollOffset = this._getParentScrollOffset(pinElement!);

            const baseElementOffset =
                isPinFixed && isBaseFixed
                    ? // @ts-expect-error _getLeftTop 不支持"viewport" 需要对baseElement做非"viewport"处理
                      this._getLeftTop(baseElement!)
                    : // 在 pin 是 fixed 布局，并且又需要根据 base 计算位置时，计算 base 的 offset 需要忽略页面滚动
                      baseElementPoints.offset(isPinFixed && pinFollowBaseElementWhenFixed!);
            const top =
                baseElementOffset.top +
                baseElementPoints.y -
                pinElementParentOffset.top -
                pinElementPoints.y +
                pinElementParentScrollOffset.top;
            const left =
                baseElementOffset.left +
                baseElementPoints.x -
                pinElementParentOffset.left -
                pinElementPoints.x +
                pinElementParentScrollOffset.left;

            // 此处若真实改变元素位置可能为导致布局发生变化，从而导致 container 发生 resize，进而重复触发 postion 和 componentUpdate，导致崩溃
            // 需要根据新的 left、top 进行模拟计算 isInViewport
            const xOffset = Math.round(
                left + this.offset[0] - (dom.getStyle(pinElement!, 'left') as number)
            );
            const yOffset = Math.round(
                top + this.offset[1] - (dom.getStyle(pinElement!, 'top') as number)
            );

            if (this._isInViewport(pinElement!, align, [xOffset, yOffset])) {
                // 如果在视区内，则设置 pin 位置，并中断 postion 返回设置的位置
                this._setPinElementPostion(pinElement!, { left, top }, this.offset);
                return align;
            } else if (!firstPositionResult) {
                if (this.needAdjust && !this.autoFit) {
                    const { right } = this._getViewportOffset(pinElement!, align);
                    firstPositionResult = {
                        left: right < 0 ? left + right : left,
                        top,
                    };
                } else {
                    firstPositionResult = { left, top };
                }
            }
        }

        // This will only execute if `pinElement` could not be placed entirely in the Viewport
        const inViewportLeft = this._makeElementInViewport(
            pinElement!,
            firstPositionResult!.left,
            'Left',
            isPinFixed
        );
        const inViewportTop = this._makeElementInViewport(
            pinElement!,
            firstPositionResult!.top,
            'Top',
            isPinFixed
        );

        this._setPinElementPostion(
            pinElement!,
            { left: inViewportLeft, top: inViewportTop },
            this._calPinOffset(expectedAlign[0])
        );

        return expectedAlign[0];
    }

    _calPinOffset = (align: string) => {
        const offset = [...this.offset];

        if (this.autoFit && align && this.container && this.container !== document.body) {
            const baseElementRect = _getElementRect(
                // @ts-expect-error _getElementRect baseElement不支持"viewport" 需要对baseElement做非"viewport"处理
                this.baseElement,
                this.container
            );
            // @ts-expect-error _getElementRect pinElement不支持"viewport" 需要对pinElement做非"viewport"处理
            const pinElementRect = _getElementRect(this.pinElement, this.container);
            const viewportSize = _getViewportSize(this.container);
            const pinAlign = align.split(' ')[0];
            const y = pinAlign.charAt(0);

            if (
                pinElementRect.top < 0 ||
                pinElementRect.top + pinElementRect.height > viewportSize.height
            ) {
                offset[1] = -baseElementRect.top - (y === 't' ? baseElementRect.height : 0);
            }
        }
        return offset;
    };

    _getParentOffset(element: HTMLElement) {
        const parent = (element.offsetParent as HTMLElement) || document.documentElement;
        let offset: { top: number; left: number; offsetParent?: HTMLElement };
        if (parent === document.body && dom.getStyle(parent, 'position')! === 'static') {
            offset = {
             
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5110** (2026-10-01): **chore(deps-dev): bump urllib from 2.41.0 to 2.44.1**
  *Symptoms*: Bumps [urllib](https://github.com/node-modules/urllib) from 2.41.0 to 2.44.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/node-modules/urllib/releases">urllib's releases</a>.</em></p> <blockquote> <h2>v2.44.1</h2> <h2>What's Changed</h2> <h3>Security</h3> <ul> <li>Do not forward credential headers (<code>Authorization</code>, <code>Cookie</code>, <code>Proxy-Authorization</code>) on cross-origin redirect, and clear <code>auth</code>/<code>digestAuth</code> before following. Same-origin redirects are unchanged and the caller's headers object is never mutated (<a href="https://redirect.github.com/node-modules/urllib/issues/813">#813</a>).</li> </ul> <h3>Internal</h3> <ul> <li>Two-stage release workflow with manual approval, publishing the 2.x line to the <code>latest-2</code> npm dist-tag (<a href="https://redirect.github.com/node-modules/urllib/issues/815">#815</a>).</li> <li>Use Node 24 in the release workflow for npm 11 OIDC trusted publishing.</li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/node-modules/urllib/compare/v2.44.0...v2.44.1">https://github.com/node-modules/urllib/compare/v2.44.0...v2.44.1</a></p> <h2>v2.44.0</h2> <h2><a href="https://github.com/node-modules/urllib/compare/v2.43.0...v2.44.0">2.44.0</a> (2024-07-08)</h2> <h3>Features</h3> <ul> <li>add hostname for checkAddress (<a href="https://redirect.github.com/node-modules/urllib/issues/526">#526</a>) (<a href="https://github.com/node-mo
  **Post-Mortem & Fix Analysis**:
  > 你好，该 pr 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 pr 将被自动关闭
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #5109** (2026-09-13): **chore(deps-dev): bump postcss from 7.0.39 to 8.5.23**
  *Symptoms*: Bumps [postcss](https://github.com/postcss/postcss) from 7.0.39 to 8.5.23. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/postcss/postcss/releases">postcss's releases</a>.</em></p> <blockquote> <h2>8.5.23</h2> <ul> <li>Do not load source map without <code>opts.from</code> for security reasons.</li> </ul> <h2>8.5.22</h2> <ul> <li>Fixed custom property losing semicolon before a comment (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> </ul> <h2>8.5.21</h2> <ul> <li>Fixed childless at-rule losing semicolon before comment (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> <li>Fixed docs (by <a href="https://github.com/isker"><code>@​isker</code></a>).</li> </ul> <h2>8.5.20</h2> <ul> <li>Fixed missing space if <code>AtRule#params</code> is set after (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> <li>Fixed mixing AST error on warnings (by <a href="https://github.com/MahinAnowar"><code>@​MahinAnowar</code></a>).</li> </ul> <h2>8.5.19</h2> <ul> <li>Fixed cleaning <code>before</code> for new nodes inserted to <code>Root</code> (by <a href="https://github.com/MahinAnowar"><code>@​MahinAnowar</code></a>).</li> </ul> <h2>8.5.18</h2> <ul> <li>Restricted loading previous source maps file to the <code>opts.from</code> folder for security reasons (use <code>unsafeMap: true</code> to disable the check).</li> </ul> <h2>8.5.17</
  **Post-Mortem & Fix Analysis**:
  > 你好，该 pr 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 pr 将被自动关闭
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #5108** (2026-09-11): **chore(deps): bump socket.io-parser and karma**
  *Symptoms*: Bumps [socket.io-parser](https://github.com/socketio/socket.io) to 4.2.7 and updates ancestor dependency [karma](https://github.com/karma-runner/karma). These dependencies need to be updated together.  Updates `socket.io-parser` from 3.2.0 to 4.2.7 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/socketio/socket.io/releases">socket.io-parser's releases</a>.</em></p> <blockquote> <h2>socket.io-parser@4.2.7</h2> <h3>Bug Fixes</h3> <ul> <li>honor toJSON() when deconstructing a binary packet (<a href="https://redirect.github.com/socketio/socket.io/issues/5518">#5518</a>) (<a href="https://github.com/socketio/socket.io/commit/57f111439513809c633f2554be2f3104e4ad432c">57f1114</a>)</li> <li>reject binary packets with zero attachments (<a href="https://github.com/socketio/socket.io/commit/7c6ef571a00656718e9e05e3b948fd1758b2a7b4">7c6ef57</a>)</li> </ul> <h2>New Contributors</h2> <ul> <li><a href="https://github.com/spokodev"><code>@​spokodev</code></a> made their first contribution in <a href="https://redirect.github.com/socketio/socket.io/pull/5518">socketio/socket.io#5518</a></li> </ul> <h2>socket.io-parser@3.4.4</h2> <p>This release includes a fix for <a href="https://github.com/socketio/socket.io/security/advisories/GHSA-677m-j7p3-52f9">CVE-2026-33151</a>. Please upgrade as soon as possible.</p> <h3>Bug Fixes</h3> <ul> <li>add a limit to the number of binary attachments (<a href="https://github.com/socketio/socket.io/commit/719f9ebab0772f
  **Post-Mortem & Fix Analysis**:
  > 你好，该 pr 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 pr 将被自动关闭
  > OK, I won't notify you again about this release, but will get in touch when a new version is available.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #5107** (2026-08-07): **chore(deps-dev): bump postcss from 7.0.39 to 8.5.18**
  *Symptoms*: Bumps [postcss](https://github.com/postcss/postcss) from 7.0.39 to 8.5.18. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/postcss/postcss/releases">postcss's releases</a>.</em></p> <blockquote> <h2>8.5.18</h2> <ul> <li>Restricted loading previous source maps file to the <code>opts.from</code> folder for security reasons (use <code>unsafeMap: true</code> to disable the check).</li> </ul> <h2>8.5.17</h2> <ul> <li>Fixed <code>Maximum call stack size exceeded</code> error.</li> <li>Fixed Prototype hijacking for <code>postcss.fromJSON()</code>.</li> <li>Fixed <code>Input#origin()</code> for unmapped end position (by <a href="https://github.com/chatman-media"><code>@​chatman-media</code></a>).</li> </ul> <h2>8.5.16</h2> <ul> <li>Fixed <code>Input#origin()</code> position (by <a href="https://github.com/mizdra"><code>@​mizdra</code></a>).</li> <li>Fixed <code>raws</code> after rehydrating a JSON AST (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> <li>Fixed putting parent-less node in <code>nodes</code> of new node (by <a href="https://github.com/MahinAnowar"><code>@​MahinAnowar</code></a>).</li> <li>Fixed computing <code>offset</code> in <code>positionBy()</code> (by <a href="https://github.com/greymoth-jp"><code>@​greymoth-jp</code></a>).</li> <li>Fixed <code>rangeBy()</code> on <code>index: 0</code> (by <a href="https://github.com/sarathfrancis90"><code>@​sarathfrancis90</code></a>).</li> </ul> 
  **Post-Mortem & Fix Analysis**:
  > Superseded by #5109.

- **Issue #5106** (2026-08-31): **chore(deps): bump shell-quote and react-dev-utils**
  *Symptoms*: Bumps [shell-quote](https://github.com/ljharb/shell-quote) to 1.10.0 and updates ancestor dependency [react-dev-utils](https://github.com/facebook/create-react-app/tree/HEAD/packages/react-dev-utils). These dependencies need to be updated together.  Updates `shell-quote` from 1.6.1 to 1.10.0 <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/ljharb/shell-quote/blob/main/CHANGELOG.md">shell-quote's changelog</a>.</em></p> <blockquote> <h2><a href="https://github.com/ljharb/shell-quote/compare/v1.9.0...v1.10.0">v1.10.0</a> - 2026-07-10</h2> <h3>Merged</h3> <ul> <li>[New] <code>parse</code>: add opt-in <code>splitUnquoted</code> option for shell field-splitting of unquoted expansions <a href="https://redirect.github.com/ljharb/shell-quote/pull/1"><code>[#1](https://github.com/ljharb/shell-quote/issues/1)</code></a></li> </ul> <h3>Commits</h3> <ul> <li>[Fix] <code>parse</code>: match nested <code>${...}</code> braces so nested parameter expansion is consumed as one substitution <a href="https://github.com/ljharb/shell-quote/commit/c0842c8a7a034066da2496a75e91cbe500ff736c"><code>c0842c8</code></a></li> <li>[Tests] <code>parse</code>: pin single-quote literalness and unmatched-quote handling <a href="https://github.com/ljharb/shell-quote/commit/a0d03e35c8ede24016502c4433b8f5d6b3100a62"><code>a0d03e3</code></a></li> <li>[readme] remove the space in js code fences so evalmd evaluates them <a href="https://github.com/ljharb/shell-quote/commit/2116fa
  **Post-Mortem & Fix Analysis**:
  > 你好，该 pr 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 pr 将被自动关闭
  > OK, I won't notify you again about this release, but will get in touch when a new version is available.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #5105** (2026-08-30): **chore(deps): bump linkify-it and markdown-it**
  *Symptoms*: Bumps [linkify-it](https://github.com/markdown-it/linkify-it) to 5.0.2 and updates ancestor dependency [markdown-it](https://github.com/markdown-it/markdown-it). These dependencies need to be updated together.  Updates `linkify-it` from 2.2.0 to 5.0.2 <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/markdown-it/linkify-it/blob/master/CHANGELOG.md">linkify-it's changelog</a>.</em></p> <blockquote> <h2>5.0.2 / 2026-07-02</h2> <ul> <li>Fixed DoS in <code>mailto:</code> links (restrict user name to 64 chars).</li> <li>Restricted user/pass part length in links.</li> </ul> <h2>5.0.1 / 2026-05-23</h2> <ul> <li>Fixed DoS in fuzzy links/emails search.</li> <li>Reworked search logic - check each pattern separate, use <code>g</code> regexes instead of slice.</li> <li>Removed internal cache - useless overcomplication.</li> </ul> <h2>5.0.0 / 2023-12-01</h2> <ul> <li>Rewrite to ESM.</li> </ul> <h2>4.0.1 / 2022-05-02</h2> <ul> <li>Fix <code>http://</code> incorrectly returned as a link by matchStart.</li> </ul> <h2>4.0.0 / 2022-04-22</h2> <ul> <li>Add <code>matchAtStart</code> method to match full URLs at the start of the string.</li> <li>Fixed paired symbols (<code>()</code>, <code>{}</code>, <code>&quot;&quot;</code>, etc.) after punctuation.</li> <li><code>---</code> option now affects parsing of emails  (e.g. <code>user@example.com---</code>)</li> </ul> <h2>3.0.3 / 2021-10-01</h2> <ul> <li>Fixed <a href="https://redirect.github.com/markdown-it/linki
  **Post-Mortem & Fix Analysis**:
  > 你好，该 pr 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 pr 将被自动关闭
  > OK, I won't notify you again about this release, but will get in touch when a new version is available.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #5104** (2026-08-30): **chore(deps): bump immutable from 4.3.4 to 4.3.9**
  *Symptoms*: Bumps [immutable](https://github.com/immutable-js/immutable-js) from 4.3.4 to 4.3.9. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/immutable-js/immutable-js/releases">immutable's releases</a>.</em></p> <blockquote> <h2>v4.3.9</h2> <h1>What's changed</h1> <ul> <li>fix(List): guard oversized bounds in setListBounds. Fixes CVE <a href="https://github.com/immutable-js/immutable-js/security/advisories/GHSA-v56q-mh7h-f735">https://github.com/immutable-js/immutable-js/security/advisories/GHSA-v56q-mh7h-f735</a></li> <li>perf(Map): index large hash-collision buckets for faster lookups. Fixes CVE <a href="https://github.com/immutable-js/immutable-js/security/advisories/GHSA-xvcm-6775-5m9r">https://github.com/immutable-js/immutable-js/security/advisories/GHSA-xvcm-6775-5m9r</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/immutable-js/immutable-js/compare/v4.3.8...v4.3.9">https://github.com/immutable-js/immutable-js/compare/v4.3.8...v4.3.9</a></p> <h2>v4.3.8</h2> <p>Fix Improperly Controlled Modification of Object Prototype Attributes ('Prototype Pollution') in immutable</p> <h2>v4.3.7</h2> <h2>What's Changed</h2> <ul> <li>Fix issue with slice negative of filtered sequence by <a href="https://github.com/jdeniau"><code>@​jdeniau</code></a> in <a href="https://redirect.github.com/immutable-js/immutable-js/pull/2006">immutable-js/immutable-js#2006</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://
  **Post-Mortem & Fix Analysis**:
  > 你好，该 pr 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 pr 将被自动关闭
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #5103** (2026-08-29): **定义了主题变量发布成功后装新的依赖，包里找不到**
  *Symptoms*: ### Reproduction link  [https://fusion.design/32495/design/style/color?type=theme&themeid=25469](https://fusion.design/32495/design/style/color?type=theme&themeid=25469)  ### Steps to reproduce 定义了主题变量发布成功装新的依赖包里找不到  <!-- generated by alibaba-fusion-issue-helper. DO NOT REMOVE --> <!-- platform: main -->
  **Post-Mortem & Fix Analysis**:
  > 这是您为 Fusion/Next 提的第一个 issue，感谢您对 Fusion 的信任和支持，我们会尽快进行处理。
  > 你好，该 issue 已 30 天没有活动，因此被标记为 stale，如果之后的 7 天仍然没有活动，该 issue 将被自动关闭

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

### Incident Patch 1: `b40dfa77` (2026-03-31)
**Commit Message**: test(DatePicker): update keyboard input tests to use fixed date for consistent expected values

**File**: `components/date-picker/__tests__/index-spec.tsx` (modified, +50/-20)
```diff
@@ -266,28 +266,40 @@ describe('DatePicker', () => {
         });
 
         it('should keyboard date input', () => {
-            cy.mount(<DatePicker defaultVisible />);
+            const fixedDate = moment('2026-02-15');
+            const expectedDate = fixedDate.clone().add(1, 'day');
+            cy.mount(<DatePicker defaultVisible defaultValue={fixedDate} />);
             cy.get('.next-date-picker-panel-input input').eq(0).as('input');
+            cy.get('@input').type('{downArrow}'); // 因为第一次默认不会触发变动
             cy.get('@input').type('{downArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{leftArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{alt}{downArrow}');
             cy.get('@input').type('{shift}{downArrow}');
             cy.get('@input').type('{ctrl}{downArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{downArrow}');
-            cy.get('@input').should('have.value', moment().add(1, 'day').format('YYYY-MM-DD'));
+            cy.get('@input').should(
+                'have.value',
+                expectedDate.clone().add(1, 'day').format('YYYY-MM-DD')
+            );
             cy.get('@input').type('{upArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{pageDown}');
-            cy.get('@input').should('have.value', moment().add(1, 'month').format('YYYY-MM-DD'));
+            cy.get('@input').should(
+                'have.value',
+                expectedDate.clone().add(1, 'month').format('YYYY-MM-DD')
+            );
             cy.get('@input').type('{pageUp}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{alt}{pageDown}');
-            cy.get('@input').should('have.value', moment().add(1, 'year').format('YYYY-MM-DD'));
+            cy.get('@input').should(
+                'have.value',
+                expectedDate.clone().add(1, 'year').format('YYYY-MM-DD')
+            );
             cy.get('@input').type('{alt}{pageUp}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
         });
 
         it('should keyboard date time input', () => {
@@ -1508,28 +1520,46 @@ describe('RangePicker', () => {
         });
 
         it('should keyboard date input', () => {
-            cy.mount(<RangePicker defaultVisible popupProps={{ animation: false }} />);
+            const fixedDate = moment('2026-02-15');
+            const expectedDate = fixedDate.clone().add(1, 'day');
+            cy.mount(
+                <RangePicker
+                    defaultVisible
+                    defaultValue={[fixedDate, fixedDate]}
+                    popupProps={{ animation: false }}
+                />
+            );
             cy.get('.next-range-picker-panel-input-start-date input').eq(0).as('input');
             cy.get('@input').type('{downArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').type('{downArrow}');
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{leftArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{alt}{downArrow}');
             cy.get('@input').type('{shift}{downArrow}');
             cy.get('@input').type('{ctrl}{downArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('have.value', expectedDate.clone().format('YYYY-MM-DD'));
             cy.get('@input').type('{downArrow}');
-            cy.get('@input').should('have.value', moment().add(1, 'day').format('YYYY-MM-DD'));
+            cy.get('@input').should(
+                'have.value',
+                expectedDate.clone().add(1, 'day').format('YYYY-MM-DD')
+            );
             cy.get('@input').type('{upArrow}');
-            cy.get('@input').should('have.value', moment().format('YYYY-MM-DD'));
+            cy.get('@input').should('ha
```

---

### Incident Patch 2: `65ecdf57` (2026-03-31)
**Commit Message**: fix(Select): fix the issue where the group key conflicts with the item value in the grouped dataSource scenario

**File**: `components/select/__tests__/index-spec.tsx` (modified, +84/-0)
```diff
@@ -835,6 +835,90 @@ describe('Select', () => {
     });
 });
 
+describe('Select Group Key Collision', () => {
+    it('should render both group and item when group index collides with item value', () => {
+        const dataSource = [
+            {
+                label: 'Group A',
+                children: [
+                    { label: 'Child 1', value: 'c1' },
+                    { label: 'Child 2', value: 'c2' },
+                ],
+            },
+            { label: 'Item 0', value: 0 },
+            { label: 'Item 1', value: 1 },
+        ];
+        cy.mount(<Select dataSource={dataSource} visible />);
+        cy.get('.next-menu-group-label').should('have.length', 1);
+        cy.get('.next-select-menu-item').should('have.length', 4);
+    });
+
+    it('should render correctly when item value is a numeric string matching group index', () => {
+        const dataSource = [
+            {
+                label: 'Group',
+                children: [{ label: 'Child A', value: 'ca' }],
+            },
+            { label: 'Item "0"', value: '0' },
+        ];
+        cy.mount(<Select dataSource={dataSource} visible />);
+        cy.get('.next-menu-group-label').should('have.length', 1);
+        cy.get('.next-select-menu-item').should('have.length', 2);
+    });
+
+    it('should support selection when group index collides with item value', () => {
+        const dataSource = [
+            {
+                label: 'Group',
+                children: [
+                    { label: 'Child 1', value: 'c1' },
+                    { label: 'Child 2', value: 'c2' },
+                ],
+            },
+            { label: 'Item 0', value: 0 },
+        ];
+        const onChange = cy.spy().as('onChange');
+        cy.mount(<Select dataSource={dataSource} visible onChange={onChange} />);
+        cy.get('.next-select-menu-item').last().click();
+        cy.get('@onChange').should('be.calledWith', 0);
+        cy.get('.next-select em').should('have.text', 'Item 0');
+    });
+
+    it('should support multiple selection with group key collision', () => {
+        const dataSource = [
+            {
+                label: 'Group',
+                children: [{ label: 'Child 1', value: 'c1' }],
+            },
+            { label: 'Item 0', value: 0 },
+            { label: 'Item 1', value: 1 },
+        ];
+        const onChange = cy.spy().as('onChange');
+        cy.mount(<Select dataSource={dataSource} visible mode="multiple" onChange={onChange} />);
+        cy.get('.next-select-menu-item').eq(0).click();
+        cy.get('@onChange').should('be.calledWith', ['c1']);
+        cy.get('.next-select-menu-item').eq(1).click();
+        cy.get<SinonSpy>('@onChange').then($spy => {
+            const [v] = $spy.args[1] as Parameters<NonNullable<SelectProps['onChange']>>;
+            cy.wrap(v).should('deep.equal', ['c1', 0]);
+        });
+    });
+
+    it('should render correctly when no key collision exists', () => {
+        const dataSource = [
+            {
+                label: 'Group',
+                children: [{ label: 'Child 1', value: 'c1' }],
+            },
+            { label: 'Item A', value: 'a' },
+            { label: 'Item B', value: 'b' },
+        ];
+        cy.mount(<Select dataSource={dataSource} visible />);
+        cy.get('.next-menu-group-label').should('have.length', 1);
+        cy.get('.next-select-menu-item').should('have.length', 3);
+    });
+});
+
 describe('Select Controlled', () => {
     beforeEach(() => {
         cy.mount(
```

**File**: `components/select/base.tsx` (modified, +17/-2)
```diff
@@ -16,7 +16,14 @@ import Input from '../input';
 import zhCN from '../locale/zh-cn';
 import DataStore from './data-store';
 import VirtualList from '../virtual-list';
-import { isSingle, filter, isNull, valueToSelectKey, getValueDataSource } from './util';
+import {
+    isSingle,
+    filter,
+    isNull,
+    valueToSelectKey,
+    getValueDataSource,
+    generateGroupKey,
+} from './util';
 import type {
     BaseProps,
     DataSourceItem,
@@ -519,13 +526,21 @@ export default class Base<
             searchKey = this.state.searchValue;
         }
 
+        const itemValueSet = new Set<string>();
+        for (const item of dataSource) {
+            if (item && !(Array.isArray(item.children) && showDataSourceChildren)) {
+                itemValueSet.add(`${item.value}`);
+            }
+        }
+
         return dataSource.map((item, index) => {
             if (!item) {
                 return null;
             }
             if (Array.isArray(item.children) && showDataSourceChildren) {
+                const groupKey = generateGroupKey(index, itemValueSet);
                 return (
-                    <MenuGroup key={index} label={item.label}>
+                    <MenuGroup key={groupKey} label={item.label}>
                         {this.renderMenuItem(item.children)}
                     </MenuGroup>
                 );
```

**File**: `components/select/util.ts` (modified, +20/-0)
```diff
@@ -347,3 +347,23 @@ export function valueToSelectKey(value: DataSourceItem): ObjectItem['value'] {
     }
     return `${val}`;
 }
+
+/**
+ * Generate group key
+ * @param index - index
+ * @param itemValueSet - item value set
+ * @returns group key
+ */
+export function generateGroupKey(index: number, itemValueSet: Set<string>) {
+    const targetKey = `select-group-${index}`;
+    if (!itemValueSet.has(targetKey)) {
+        return targetKey;
+    }
+    let suffix = 0;
+    let key = `${targetKey}-repeat-${suffix}`;
+    while (itemValueSet.has(key)) {
+        suffix++;
+        key = `${targetKey}-repeat-${suffix}`;
+    }
+    return key;
+}
```

---

### Incident Patch 3: `a1b986ff` (2025-12-11)
**Commit Message**: fix(TreeSelect): fix options collapse after select when treeCheckable,treeDefaultExpandAll and showSearch is true

**File**: `components/tree-select/__tests__/index-spec.tsx` (modified, +19/-0)
```diff
@@ -951,6 +951,25 @@ describe('TreeSelect', () => {
         cy.get('.next-tree-node').should('have.length', 6);
     });
 
+    it('should expandedAll when select by searchValue is empty and treeDefaultExpandAll is true and showSearch is true', () => {
+        const handleSearch = cy.spy();
+        cy.mount(
+            <TreeSelect
+                defaultVisible
+                treeDefaultExpandAll
+                treeCheckable
+                dataSource={dataSource}
+                showSearch
+                onSearch={debounce(handleSearch, 20)} // Debounce for simulate Cypress action type below
+            />
+        );
+        cy.get('.next-tree-node[value="4"]').click();
+        cy.get('.next-tree-node').then($el => {
+            const list = $el.filter('[style!="display: none;"]');
+            cy.wrap(list).should('have.length', 6);
+        });
+    });
+
     describe('should support useDetailValue', () => {
         it('Support dataSource mode', () => {
             const handleChange = cy.spy();
```

**File**: `components/tree-select/tree-select.tsx` (modified, +4/-1)
```diff
@@ -776,7 +776,10 @@ class TreeSelect extends Component<TreeSelectProps, TreeSelectState> {
         } else {
             // 如过 filterLocal 并且 showSearch 但是没有 searchedValue 的时候，也需要设置 expandedKeys
             if (filterLocal && showSearch) {
-                treeProps.expandedKeys = expandedKeys;
+                // 当 expandedKeys 有值的时候再设置，否则报纸原状，否则会导致选择后展开的节点丢失
+                if (Array.isArray(expandedKeys) && expandedKeys.length) {
+                    treeProps.expandedKeys = expandedKeys;
+                }
                 treeProps.autoExpandParent = autoExpandParent;
                 treeProps.onExpand = this.handleExpand;
             }
```

---

### Incident Patch 4: `872eaf1c` (2025-05-12)
**Commit Message**: fix(TreeSelect): fix expandedKeys bug when search by searchValue is empty and treeDefaultExpandAll is true

**File**: `components/tree-select/__tests__/index-spec.tsx` (modified, +22/-0)
```diff
@@ -929,6 +929,28 @@ describe('TreeSelect', () => {
         cy.contains('.next-select-values', '服装/男装');
     });
 
+    it('should expandedAll when search by searchValue is empty and treeDefaultExpandAll is true', () => {
+        const searchedValue = '外套';
+        const handleSearch = cy.spy();
+
+        cy.mount(
+            <TreeSelect
+                defaultVisible
+                treeDefaultExpandAll
+                dataSource={dataSource}
+                showSearch
+                onSearch={debounce(handleSearch, 20)} // Debounce for simulate Cypress action type below
+            />
+        );
+        cy.get('.next-select-trigger-search input').type(searchedValue);
+        cy.get('.next-tree-node').then($el => {
+            const list = $el.filter('[style!="display: none;"]');
+            cy.wrap(list).should('have.length', 3);
+        });
+        cy.get('.next-select-trigger-search input').clear();
+        cy.get('.next-tree-node').should('have.length', 6);
+    });
+
     describe('should support useDetailValue', () => {
         it('Support dataSource mode', () => {
             const handleChange = cy.spy();
```

**File**: `components/tree-select/tree-select.tsx` (modified, +6/-0)
```diff
@@ -774,6 +774,12 @@ class TreeSelect extends Component<TreeSelectProps, TreeSelectState> {
                 notFound = true;
             }
         } else {
+            // 如过 filterLocal 并且 showSearch 但是没有 searchedValue 的时候，也需要设置 expandedKeys
+            if (filterLocal && showSearch) {
+                treeProps.expandedKeys = expandedKeys;
+                treeProps.autoExpandParent = autoExpandParent;
+                treeProps.onExpand = this.handleExpand;
+            }
             // eslint-disable-next-line
             if (dataSource) {
                 if (dataSource.length) {
```

---

### Incident Patch 5: `ae24d96f` (2025-11-12)
**Commit Message**: fix(Drawer): ensure correct padding-right is applied to body when Drawer is opened with scroll

**File**: `components/drawer/__tests__/index-v2-spec.tsx` (modified, +42/-0)
```diff
@@ -105,4 +105,46 @@ describe('Drawer v2', () => {
             hide();
         });
     });
+    it('should add paddingRight to body when body is scroll on open Drawer', () => {
+        let tallDiv: HTMLDivElement;
+
+        // 创建一个高元素使 body 产生滚动条
+        cy.document().then(doc => {
+            tallDiv = doc.createElement('div');
+            tallDiv.style.height = '110vh';
+            tallDiv.setAttribute('data-test-element', 'scroll-trigger'); // 添加标识方便查找
+            doc.body.appendChild(tallDiv);
+        });
+
+        // 设置初始 padding-right
+        cy.get('body').invoke('css', 'padding-right', '10px');
+        cy.get('body').invoke('css', 'overflow', 'auto');
+
+        cy.mount(
+            <Drawer v2 visible title="test" closeMode={[]}>
+                body
+            </Drawer>
+        );
+
+        cy.then(() => {
+            const scrollDiv = document.createElement('div');
+            scrollDiv.className = 'just-to-get-scrollbar-size';
+            scrollDiv.style.width = '100px';
+            scrollDiv.style.height = '100px';
+            scrollDiv.style.overflow = 'scroll';
+            scrollDiv.style.position = 'absolute';
+            scrollDiv.style.top = '-9999px';
+            document.body.appendChild(scrollDiv);
+            const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
+            document.body.removeChild(scrollDiv);
+            cy.get('body').should('have.css', 'padding-right', `${10 + scrollbarWidth}px`);
+        });
+
+        // 清理添加的元素
+        cy.then(() => {
+            if (tallDiv && tallDiv.parentNode) {
+                tallDiv.parentNode.removeChild(tallDiv);
+            }
+        });
+    });
 });
```

**File**: `components/drawer/drawer-v2.tsx` (modified, +1/-1)
```diff
@@ -145,7 +145,7 @@ const Drawer = (props: DrawerV2Props) => {
                 const scrollWidth = dom.scrollbar().width;
                 if (scrollWidth) {
                     style.paddingRight = `${
-                        dom.getStyle(document.body, 'paddingRight').toString() +
+                        (dom.getStyle(document.body, 'paddingRight') as number) +
                         dom.scrollbar().width
                     }px`;
                 }
```

---

### Incident Patch 6: `86b98cfc` (2025-03-10)
**Commit Message**: fix(*): fix the type inference error on the consumer side (#5030)

**File**: `components/breadcrumb/index.tsx` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ interface Child {
     };
 }
 
-interface BreadcrumbState {
+export interface BreadcrumbState {
     maxNode: number;
     prevMaxNode?: BreadcrumbProps['maxNode'];
 }
```

**File**: `components/split-button/index.tsx` (modified, +2/-2)
```diff
@@ -85,8 +85,8 @@ class SplitButton extends React.Component<SplitButtonProps> {
         visible: this.props.defaultVisible,
     };
 
-    private wrapper: HTMLDivElement | null = null;
-    private menu: HTMLUListElement | null = null;
+    wrapper: HTMLDivElement | null = null;
+    menu: HTMLUListElement | null = null;
 
     componentDidMount() {
         // 由于定位目标是 wrapper，如果弹层默认展开，wrapper 还未渲染，didMount 后强制再渲染一次，弹层重新定位
```

---

### Incident Patch 7: `bb46a4d9` (2025-01-21)
**Commit Message**: fix(Nav): the icon is not centered when the width of Nav in iconOnly mode is less than the default width

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -90,3 +90,4 @@ src/core-temp
 
 # tests snapshots diff
 components/**/__tests__/snapshots/__diff__/**
+cypress/screenshots/**
```

**File**: `components/nav/__docs__/demo/auto-width/index.css` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+.demo-ctl {
+    background-color: #f1f1f1;
+    border-left: 4px solid #0d599a;
+    color: #0a7ac3;
+    margin-bottom: 20px;
+    padding: 5px;
+}
+.demo-ctl .next-radio-group {
+    margin: 5px;
+}
```

**File**: `components/nav/__docs__/demo/auto-width/index.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# zh-CN order=2
+
+# 只显示图标-宽度自适应
+
+Nav 可设置 iconOnly 属性，只显示图标，以减少占用空间。通过设定 iconOnlyWidth 为 100%，可以实现 iconOnly 场景下 icon 自适应居中展示，需要注意的是这种情况下需要 Nav 外部容器有具体宽度。
+
+# en-US order=2
+
+# Only show icon - width adaptive
+
+The Nav component can be configured with the iconOnly property to display only icons, minimizing occupied space‌12. By setting iconOnlyWidth to 100%, the icons will auto-center adaptively in iconOnly mode‌2. Note that this requires the external container of Nav to have a specific width‌.
```

**File**: `components/nav/__docs__/demo/auto-width/index.tsx` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+import React from 'react';
+import ReactDOM from 'react-dom';
+import { Nav, Radio } from '@alifd/next';
+import type { NavProps } from '@alifd/next/types/nav';
+
+type AppState = Pick<
+    NavProps,
+    'iconOnly' | 'hasTooltip' | 'hasArrow' | 'iconOnlyWidth' | 'iconTextOnly'
+> & {
+    width?: number;
+};
+
+const { Item, SubNav } = Nav;
+
+class App extends React.Component {
+    state: AppState = {
+        iconOnly: false,
+        hasTooltip: true,
+        hasArrow: true,
+        iconOnlyWidth: '100%',
+        iconTextOnly: false,
+        width: 200,
+    };
+
+    setValue(name: keyof AppState, value: string) {
+        this.setState({
+            [name]: value === 'true',
+        });
+    }
+
+    iconfontChange(value: string) {
+        const props: AppState = {};
+        props.iconOnly = value === 'true';
+        if (props.iconOnly) {
+            props.width = 40;
+        } else {
+            props.width = 200;
+        }
+        this.setState(props);
+    }
+
+    render() {
+        const { iconOnly, hasTooltip, hasArrow, iconTextOnly } = this.state;
+        return (
+            <div>
+                <div className="demo-ctl">
+                    <Radio.Group
+                        shape="button"
+                        size="medium"
+                        value={iconOnly && iconTextOnly ? 'trueText' : iconOnly ? 'true' : 'false'}
+                        onChange={this.iconfontChange.bind(this)}
+                    >
+                        <Radio value="true">iconOnly=true</Radio>
+                        <Radio value="false">iconOnly=false</Radio>
+                    </Radio.Group>
+                </div>
+                <div style={{ width: this.state.width }}>
+                    <Nav
+                        iconOnlyWidth={this.state.iconOnlyWidth}
+                        iconOnly={iconOnly}
+                        iconTextOnly={iconTextOnly}
+                        hasArrow={hasArrow}
+                        hasTooltip={hasTooltip}
+                        hozInLine
+                    >
+                        <Item icon="account">三个字</Item>
+                        <Item icon="account">四个字的</Item>
+                        <Item icon="account">五个字导航</Item>
+                        <Item icon={'atm'}>六个字的导航</Item>
+                        <Item icon={<span>QAQ</span>}>七个字的长导航</Item>
+                        <SubNav icon="account" label="Sub Nav">
+                            <Item icon="account">Item 1</Item>
+                            <Item icon="account">Item 2</Item>
+                            <Item icon="account">Item 3</Item>
+                            <Item icon="account">Item 4</Item>
+                        </SubNav>
+                    </Nav>
+                </div>
+            </div>
+        );
+    }
+}
+
+ReactDOM.render(<App />, mountNode);
```

**File**: `components/nav/__tests__/index-spec.tsx` (modified, +30/-0)
```diff
@@ -442,6 +442,36 @@ describe('Nav', () => {
             cy.get('#icononly-switch-item-2').should('have.css', 'padding-left', '40px');
         });
 
+        it('should align center when iconOnly and width < 58', () => {
+            cy.mount(
+                <div style={{ width: 40 }}>
+                    <Nav iconOnlyWidth="100%" iconOnly hasArrow hasTooltip>
+                        <Item icon="account">三个字</Item>
+                        <Item icon="account">四个字的</Item>
+                        <Item icon="account">五个字导航</Item>
+                        <Item icon={'atm'}>六个字的导航</Item>
+                        <Item icon={<span>QAQ</span>}>七个字的长导航</Item>
+                        <SubNav icon="account" label="Sub Nav">
+                            <Item icon="account">Item 1</Item>
+                            <Item icon="account">Item 2</Item>
+                            <Item icon="account">Item 3</Item>
+                            <Item icon="account">Item 4</Item>
+                        </SubNav>
+                    </Nav>
+                </div>
+            );
+            cy.get('.next-nav').then($el => {
+                const { width: navWidth, left: navLeft } = $el[0].getBoundingClientRect();
+                const { width, left } = document
+                    .querySelector('.next-menu-item.next-nav-item')!
+                    .getBoundingClientRect();
+                const target = Math.round(Math.abs(left - navLeft));
+                const expected = (navWidth - width) >> 1;
+                expect(width).not.equal(0);
+                expect(target).equal(expected);
+            });
+        });
+
         it('should support fixed', () => {
             cy.mount(
                 <Nav
```

**File**: `components/nav/main.scss` (modified, +6/-0)
```diff
@@ -381,6 +381,12 @@ $nav-icononly-width: 58px;
             text-overflow: clip;
         }
 
+        #{$menu-prefix}-item#{$nav-prefix}-item {
+            padding: 0;
+            display: flex;
+            align-items: center;
+            justify-content: center;
+        }
         // #{$menu-prefix}-item-text > span,
         // #{$nav-prefix}-group-label > #{$menu-prefix}-item-inner > span {
         //     opacity: 0;
```

**File**: `components/shell/__docs__/demo/complicated/index.tsx` (modified, +6/-1)
```diff
@@ -74,7 +74,12 @@ class App extends React.Component {
                         collapse={this.state.navcollapse}
                         onCollapseChange={this.onCollapseChange}
                     >
-                        <Nav embeddable aria-label="global navigation">
+                        <Nav
+                            embeddable
+                            aria-label="global navigation"
+                            iconOnlyWidth="100%"
+                            hozInLine
+                        >
                             <Nav.Item icon="account">Nav Item 1</Nav.Item>
                             <Nav.Item icon="calendar">Nav Item 2</Nav.Item>
                             <Nav.Item icon="atm">Nav Item 3</Nav.Item>
```

**File**: `components/shell/__docs__/demo/header-global-local/index.tsx` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ class App extends React.Component {
                     </Shell.Action>
 
                     <Shell.Navigation>
-                        <Nav embeddable aria-label="global navigation">
+                        <Nav embeddable aria-label="global navigation" iconOnlyWidth="100%">
                             <Nav.Item icon="account">Nav Item 1</Nav.Item>
                             <Nav.Item icon="calendar">Nav Item 2</Nav.Item>
                             <Nav.Item icon="atm">Nav Item 3</Nav.Item>
```

---

### Incident Patch 8: `3f402b63` (2025-03-03)
**Commit Message**: fix(Field): fix use setError on uninitialized field caused incorrect values configuration

**File**: `components/field/__tests__/index-spec.tsx` (modified, +29/-0)
```diff
@@ -476,6 +476,35 @@ describe('field', () => {
             assert.deepEqual(field.init('list').value, [{ text: '2' }]);
             assert.equal(field.init('list[0].text').value, '2');
         });
+        it('Ensure data accuracy when using setError before init', () => {
+            const field = new Field(
+                {},
+                {
+                    values: {
+                        embed: {
+                            a: [],
+                            b: [],
+                        },
+                    },
+                    parseName: true,
+                }
+            );
+            assert.deepEqual(field.getValues(), {
+                embed: {
+                    a: [],
+                    b: [],
+                },
+            });
+            field.setValue('embed.b', [1, 2, 3]);
+            field.setError('embed.b', undefined);
+            field.init('embed.b');
+            assert.deepEqual(field.getValues(), {
+                embed: {
+                    a: [],
+                    b: [1, 2, 3],
+                },
+            });
+        });
     });
 
     describe('behaviour', () => {
```

**File**: `package-lock.json` (modified, +40/-8)
```diff
@@ -9,7 +9,7 @@
       "version": "1.27.31",
       "license": "MIT",
       "dependencies": {
-        "@alifd/field": "~2.0.3",
+        "@alifd/field": "^2.0.4",
         "@alifd/overlay": "^0.3.3",
         "@alifd/validate": "~2.0.3",
         "@types/react-transition-group": "^4.4.6",
@@ -341,9 +341,9 @@
       }
     },
     "node_modules/@alifd/field": {
-      "version": "2.0.3",
-      "resolved": "https://registry.npmjs.org/@alifd/field/-/field-2.0.3.tgz",
-      "integrity": "sha512-Bq7lPT6lyjO+2A/9iZLt09Ix6IJruqmd/KYiJW1fbPecIokLQ0cgwCoU4fTxGBS2trR9n/o3kIhWt731PDERdg==",
+      "version": "2.0.4",
+      "resolved": "https://registry.npmjs.org/@alifd/field/-/field-2.0.4.tgz",
+      "integrity": "sha512-CE+WsMmxuCYgJ6dlRnNexQA7pl172OF6SyaHXTs+cO3ITM3UgmFvl+G8urRjWFxCFGigzLv0IpPu8KeP07VZAA==",
       "dependencies": {
         "@alifd/validate": "^2.0.2",
         "tslib": "^2.6.2"
@@ -400,6 +400,22 @@
         "react-dom": "^16.13.1"
       }
     },
+    "node_modules/@alifd/meet-react/node_modules/@alifd/field": {
+      "version": "1.7.0",
+      "resolved": "https://registry.npmjs.org/@alifd/field/-/field-1.7.0.tgz",
+      "integrity": "sha512-rXqtuJudWaSl+1EOjUqr1OHUh8PWnzvyMmm6sKev9uTbctrt+pHEkRh3fbXebJhtEXgZbqhh/UM2afqy1nIIeA==",
+      "dev": true,
+      "dependencies": {
+        "@alifd/validate": "^1.2.0",
+        "prop-types": "^15.5.8"
+      }
+    },
+    "node_modules/@alifd/meet-react/node_modules/@alifd/validate": {
+      "version": "1.4.0",
+      "resolved": "https://registry.npmjs.org/@alifd/validate/-/validate-1.4.0.tgz",
+      "integrity": "sha512-RNayg1HVrJBhP5wOmjRq9x0xCC/2H1isDy038V69ggPyAP0k+3JAzIZKNkDoCLJlF4dWPCcsSwXaJafr0A60Wg==",
+      "dev": true
+    },
     "node_modules/@alifd/meet-react/node_modules/classnames": {
       "version": "2.2.6",
       "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.2.6.tgz",
@@ -36443,9 +36459,9 @@
       "dev": true
     },
     "@alifd/field": {
-      "version": "2.0.3",
-      "resolved": "https://registry.npmjs.org/@alifd/field/-/field-2.0.3.tgz",
-      "integrity": "sha512-Bq7lPT6lyjO+2A/9iZLt09Ix6IJruqmd/KYiJW1fbPecIokLQ0cgwCoU4fTxGBS2trR9n/o3kIhWt731PDERdg==",
+      "version": "2.0.4",
+      "resolved": "https://registry.npmjs.org/@alifd/field/-/field-2.0.4.tgz",
+      "integrity": "sha512-CE+WsMmxuCYgJ6dlRnNexQA7pl172OF6SyaHXTs+cO3ITM3UgmFvl+G8urRjWFxCFGigzLv0IpPu8KeP07VZAA==",
       "requires": {
         "@alifd/validate": "^2.0.2",
         "tslib": "^2.6.2"
@@ -36457,7 +36473,7 @@
       "integrity": "sha512-rGzn1rXbMRhEEcs9Le6ZCYK6PPWtdmbMfIFx2M4P2JwH8erIfV95i7x24djHrMD4FxI45SO8aCxcVUrZoN/1SQ==",
       "dev": true,
       "requires": {
-        "@alifd/field": "~2.0.3",
+        "@alifd/field": "^1.4.3",
         "@alifd/meet-react-component-one": "^1.3.0",
         "@uni/clipboard": "^1.0.6",
         "@uni/env": "^1.0.7",
@@ -36476,6 +36492,22 @@
         "universal-element": "^0.0.6"
       },
       "dependencies": {
+        "@alifd/field": {
+          "version": "1.7.0",
+          "resolved": "https://registry.npmjs.org/@alifd/field/-/field-1.7.0.tgz",
+          "integrity": "sha512-rXqtuJudWaSl+1EOjUqr1OHUh8PWnzvyMmm6sKev9uTbctrt+pHEkRh3fbXebJhtEXgZbqhh/UM2afqy1nIIeA==",
+          "dev": true,
+          "requires": {
+            "@alifd/validate": "^1.2.0",
+            "prop-types": "^15.5.8"
+          }
+        },
+        "@alifd/validate": {
+          "version": "1.4.0",
+          "resolved": "https://registry.npmjs.org/@alifd/validate/-/validate-1.4.0.tgz",
+          "integrity": "sha512-RNayg1HVrJBhP5wOmjRq9x0xCC/2H1isDy038V69ggPyAP0k+3JAzIZKNkDoCLJlF4dWPCcsSwXaJafr0A60Wg==",
+          "dev": true
+        },
         "classnames": {
           "version": "2.2.6",
           "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.2.6.tgz",
```

**File**: `package.json` (modified, +3/-3)
```diff
@@ -104,7 +104,7 @@
     ]
   },
   "dependencies": {
-    "@alifd/field": "~2.0.3",
+    "@alifd/field": "~2.0.4",
     "@alifd/overlay": "^0.3.3",
     "@alifd/validate": "~2.0.3",
     "@types/react-transition-group": "^4.4.6",
@@ -309,11 +309,11 @@
     "registry": "https://registry.npmjs.org"
   },
   "overrides": {
-    "@alifd/field": "~2.0.3",
+    "@alifd/field": "~2.0.4",
     "cheerio": "1.0.0-rc.3"
   },
   "resolutions": {
-    "@alifd/field": "~2.0.3",
+    "@alifd/field": "~2.0.4",
     "cheerio": "1.0.0-rc.3"
   }
 }
```

---

### Incident Patch 9: `cfa01a42` (2025-01-13)
**Commit Message**: chore(Tools): change components mian.scss import order when run the command npm run start

**File**: `tools/serve/index.ts` (modified, +21/-2)
```diff
@@ -17,6 +17,7 @@ import { glob } from 'glob';
 import {
     ARGV,
     SRC_DIR_PATH,
+    CWD,
     TARGETS,
     findFile,
     logger,
@@ -25,6 +26,7 @@ import {
 } from '../utils';
 import { marked } from '../build/docs/utils';
 import { parseDemoMd } from '../build/docs/generate-docs';
+import postcssSass from 'postcss-scss';
 
 type Lang = 'zh' | 'en';
 
@@ -99,6 +101,20 @@ const demoPlugin = (dirName: string): VitePlugin => {
                 return !!t.jsEntry;
             });
     }
+    // 加载components.scss 文件
+    function loadComponentScss() {
+        // 加载顺序处理，按照component.scss中的顺序加载，避免导致样式覆盖
+        const filePath = readFileSync(resolve(CWD, './components.scss'), 'utf-8');
+        const list: string[] = [];
+        postcssSass.parse(filePath).walkAtRules('import', rule => {
+            const targetPath = rule.params.replace(/^"|"$/g, '');
+            if (targetPath) {
+                list.push(resolve(CWD, targetPath));
+            }
+        });
+        return list;
+    }
+
     const SCSS_REG = /^__scss/;
     const SCSS_VIRTUAL_REG = /^\0__scss\.scss/;
     const DOC_REG = /^__doc/;
@@ -140,8 +156,11 @@ const demoPlugin = (dirName: string): VitePlugin => {
         },
         load(id) {
             if (SCSS_VIRTUAL_REG.test(id)) {
-                const fixedFiles: string[] = [resolve(SRC_DIR_PATH, 'core/reset.scss')];
-                const mainFiles = glob.sync('*/main.scss', { cwd: SRC_DIR_PATH, absolute: true });
+                const fixedFiles: string[] = [
+                    resolve(SRC_DIR_PATH, 'core/reset.scss'),
+                    resolve(SRC_DIR_PATH, 'demo-helper/main.scss'),
+                ];
+                const mainFiles = loadComponentScss();
                 return fixedFiles
                     .concat(mainFiles)
                     .map(f => `@import "${f}";`)
```

---

### Incident Patch 10: `a5e1284c` (2025-03-03)
**Commit Message**: fix(TimePicker2):  support set locale by ConfigProvider

**File**: `components/time-picker2/__tests__/index-spec.tsx` (modified, +12/-0)
```diff
@@ -1,6 +1,8 @@
 import React from 'react';
 import dayjs, { type Dayjs } from 'dayjs';
 import TimePicker2, { type TimePickerProps } from '../index';
+import ConfigProvider from '../../config-provider';
+import enUS from '../../locale/en-us';
 import '../../time-picker/style';
 
 const defaultValue = dayjs('11:12:13', 'HH:mm:ss', true);
@@ -283,6 +285,16 @@ describe('TimePicker2', () => {
             cy.get(timeInput).type('{ctrl+downarrow}', { force: true });
             cy.get(timeInput).should('have.value', '00:00:00');
         });
+
+        it('should can set locale by ConfigProvider', () => {
+            cy.mount(
+                <ConfigProvider locale={enUS}>
+                    <TimePicker2 />
+                </ConfigProvider>
+            );
+            const timeInput = '.next-time-picker2-input input';
+            cy.get(timeInput).should('have.attr', 'placeholder', enUS.TimePicker.placeholder);
+        });
     });
 
     describe('range', () => {
```

**File**: `components/time-picker2/index.tsx` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ import type { TimePickerProps, ValueType, RangePickerProps, PresetType } from '.
 
 const ConfigTimePicker = ConfigProvider.config(TimePicker);
 
-const TimePickerWithSub = assignSubComponent(TimePicker, {
+const TimePickerWithSub = assignSubComponent(ConfigTimePicker, {
     RangePicker: React.forwardRef(
         (props: TimePickerProps, ref: LegacyRef<ComponentRef<typeof ConfigTimePicker>>) => (
             <ConfigTimePicker ref={ref} {...props} type="range" />
```

---

### Incident Patch 11: `7758e221` (2025-01-06)
**Commit Message**: chore(Tools): fix some tools error

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@alifd/next",
-  "version": "1.27.29",
+  "version": "1.27.30",
   "lockfileVersion": 2,
   "requires": true,
   "packages": {
     "": {
       "name": "@alifd/next",
-      "version": "1.27.29",
+      "version": "1.27.30",
       "license": "MIT",
       "dependencies": {
         "@alifd/field": "~2.0.3",
```

**File**: `tools/build/dist.ts` (modified, +3/-3)
```diff
@@ -15,11 +15,11 @@ const distPath = resolve(CWD, 'dist');
 
 export function registryDist(file = __filename) {
     return registryTask(file, 'dist', async function () {
-        registryTask(file, 'dist:clean', () => {
+        await registryTask(file, 'dist:clean', () => {
             removeSync(distPath);
         });
-        registryTask(file, 'dist:next', pack);
-        registryTask(file, 'dist:next:minify', pack.bind(undefined, true));
+        await registryTask(file, 'dist:next', pack);
+        await registryTask(file, 'dist:next:minify', pack.bind(undefined, true));
         await registryTask(file, 'dist:adaptor', packAdaptor.run, packAdaptor.rollback);
     });
 }
```

**File**: `tsconfig.json` (modified, +1/-1)
```diff
@@ -23,5 +23,5 @@
             "@alifd/next/types/*": ["./components/*"]
         }
     },
-    "include": ["global.d.ts", "cypress/**/*.ts", "./components/**/*.ts", "./components/**/*.tsx", "tools"]
+    "include": ["*.ts", "cypress/**/*.ts", "./components/**/*.ts", "./components/**/*.tsx", "tools"]
 }
```

---

### Incident Patch 12: `5cb27419` (2024-12-26)
**Commit Message**: fix(Core): Fix the varMap configuration values are being repeatedly overridden when building with the CSS variable mode

**File**: `components/core/util/_varMap.scss` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-$varMap: ();
+$varMap: () !default;
 @function get-compiling-value($cssVarRepresentation) {
     @if map-has-key($varMap, $cssVarRepresentation) {
         @return map-get($varMap, $cssVarRepresentation);
```

---

### Incident Patch 13: `97602785` (2024-12-06)
**Commit Message**: fix(DatePicker2): support defaultValue & value for quarter, close #3006

**File**: `components/date-picker2/__tests__/index-spec.js` (modified, +57/-0)
```diff
@@ -1257,6 +1257,63 @@ describe('Picker', () => {
             findInput().simulate('keydown', { keyCode: KEYCODE.ENTER });
             assert(getStrValue(wrapper) === '12/02/2020');
         });
+
+        // fix https://github.com/alibaba-fusion/next/issues/3006
+        it('Support defaultValue & value for quarter', () => {
+            let defaultValueList = [
+                [
+                    { in: '2021-Q2', out: '2021-Q2' },
+                    { in: '2021-Q3', out: '2021-Q3' },
+                ],
+                [
+                    { in: '2021-4-1', out: '2021-Q2' },
+                    { in: '2021-8-1', out: '2021-Q3' },
+                ],
+            ];
+            defaultValueList.forEach(defaultValue => {
+                const inValue = defaultValue.map(item => item.in);
+                const outValue = defaultValue.map(item => item.out);
+                wrapper = mount(<RangePicker defaultValue={inValue} mode="quarter" />);
+                assert.deepEqual(getStrValue(), outValue);
+            });
+
+            defaultValueList = [
+                { in: '2021-Q3', out: '2021-Q3' },
+                { in: '2021-7-1', out: '2021-Q3' },
+            ];
+            defaultValueList.forEach(defaultValue => {
+                const { in: inValue, out: outValue } = defaultValue;
+                wrapper = mount(<QuarterPicker defaultValue={inValue} />);
+                assert(getStrValue() === outValue);
+            });
+
+            let valueList = [
+                [
+                    { in: '2021-Q2', out: '2021-Q2' },
+                    { in: '2021-Q3', out: '2021-Q3' },
+                ],
+                [
+                    { in: '2021-4-1', out: '2021-Q2' },
+                    { in: '2021-8-1', out: '2021-Q3' },
+                ],
+            ];
+            valueList.forEach(value => {
+                const inValue = value.map(item => item.in);
+                const outValue = value.map(item => item.out);
+                wrapper = mount(<RangePicker value={inValue} mode="quarter" />);
+                assert.deepEqual(getStrValue(), outValue);
+            });
+
+            valueList = [
+                { in: '2021-Q3', out: '2021-Q3' },
+                { in: '2021-7-1', out: '2021-Q3' },
+            ];
+            valueList.forEach(value => {
+                const { in: inValue, out: outValue } = value;
+                wrapper = mount(<QuarterPicker value={inValue} />);
+                assert(getStrValue() === outValue);
+            });
+        });
     });
 });
 
```

**File**: `components/date-picker2/picker.jsx` (modified, +7/-2)
```diff
@@ -14,6 +14,7 @@ import DateInput from './panels/date-input';
 import DatePanel from './panels/date-panel';
 import RangePanel from './panels/range-panel';
 import FooterPanel from './panels/footer-panel';
+import { getValueWithDayjs } from '../util/func';
 
 const { Popup } = Overlay;
 const { pickProps, pickOthers } = obj;
@@ -175,7 +176,9 @@ class Picker extends React.Component {
         }
 
         if ('value' in props) {
-            const value = isRange ? checkRangeDate(props.value, state.inputType, disabled) : checkDate(props.value);
+            let value = getValueWithDayjs(props.value, format);
+
+            value = isRange ? checkRangeDate(value, state.inputType, disabled) : checkDate(value);
 
             if (isValueChanged(value, state.preValue)) {
                 newState = {
@@ -220,12 +223,14 @@ class Picker extends React.Component {
      */
     getInitValue = () => {
         const { props } = this;
-        const { type, value, defaultValue } = props;
+        const { type, value, defaultValue, format } = props;
 
         let val = type === DATE_PICKER_TYPE.RANGE ? [null, null] : null;
 
         val = 'value' in props ? value : 'defaultValue' in props ? defaultValue : val;
 
+        val = getValueWithDayjs(val, format);
+
         return this.checkValue(val);
     };
 
```

**File**: `components/util/func.ts` (modified, +30/-1)
```diff
@@ -1,7 +1,6 @@
 import type { ConfigType, OptionType, Dayjs } from 'dayjs';
 import { isPromise } from './object';
 import datejs from './date';
-
 export interface AnyFunction<Result = unknown> {
     (...args: unknown[]): Result;
 }
@@ -198,3 +197,33 @@ export function checkRangeDate(
 
     return [begin, end];
 }
+
+/**
+ * 字符型日期转为dayjs类型
+ */
+export function getValueWithDayjs(
+    val: ConfigType | ConfigType[],
+    format: OptionType
+): Array<Dayjs | null> | Dayjs | null {
+    let date;
+
+    if (Array.isArray(val)) {
+        date = val.map(v => {
+            return checkValueWithDayjs(v, format);
+        });
+    } else {
+        date = checkValueWithDayjs(val, format);
+    }
+    return date;
+}
+
+/**
+ * 将字符型转为dayjs类型，dayjs(x)解析无效时使用dayjs(x,format)再次解析。兼容YYYY-[Q]Q 季度类字符串
+ */
+export function checkValueWithDayjs(val: ConfigType, format: OptionType): Dayjs | null {
+    let date = checkDate(val);
+    if (!date) {
+        date = checkDate(val, format);
+    }
+    return date;
+}
```

**File**: `package-lock.json` (modified, +6/-6)
```diff
@@ -11184,9 +11184,9 @@
       }
     },
     "node_modules/dayjs": {
-      "version": "1.11.10",
-      "resolved": "https://registry.npmjs.org/dayjs/-/dayjs-1.11.10.tgz",
-      "integrity": "sha512-vjAczensTgRcqDERK0SR2XMwsF/tSvnvlv6VcF2GIhg6Sx4yOIt/irsr1RDJsKiIyBzJDpCoXiWWq28MqH2cnQ=="
+      "version": "1.11.13",
+      "resolved": "https://registry.npmjs.org/dayjs/-/dayjs-1.11.13.tgz",
+      "integrity": "sha512-oaMBel6gjolK862uaPQOVTA7q3TZhuSvuMQAAglQDOWYO9A91IrAOUJEyKVlqJlHE0vq5p5UXxzdPfMH/x6xNg=="
     },
     "node_modules/debug": {
       "version": "4.3.4",
@@ -45181,9 +45181,9 @@
       "dev": true
     },
     "dayjs": {
-      "version": "1.11.10",
-      "resolved": "https://registry.npmjs.org/dayjs/-/dayjs-1.11.10.tgz",
-      "integrity": "sha512-vjAczensTgRcqDERK0SR2XMwsF/tSvnvlv6VcF2GIhg6Sx4yOIt/irsr1RDJsKiIyBzJDpCoXiWWq28MqH2cnQ=="
+      "version": "1.11.13",
+      "resolved": "https://registry.npmjs.org/dayjs/-/dayjs-1.11.13.tgz",
+      "integrity": "sha512-oaMBel6gjolK862uaPQOVTA7q3TZhuSvuMQAAglQDOWYO9A91IrAOUJEyKVlqJlHE0vq5p5UXxzdPfMH/x6xNg=="
     },
     "debug": {
       "version": "4.3.4",
```

---

### Incident Patch 14: `af1c2e79` (2024-12-06)
**Commit Message**: fix(Select): Fix select doc

**File**: `components/select/__docs__/index.en-us.md` (modified, +55/-52)
```diff
@@ -64,7 +64,7 @@ This is because the layer's animation of the overlay is implemented by `classNam
 | Param                  | Description                                                                                                                                                                  | Type                                                                                                                             | Default Value                         | Required | Supported Version |
 | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------- | ----------------- |
 | size                   | Size                                                                                                                                                                         | 'small' \| 'medium' \| 'large'                                                                                                   | 'medium'                              |          | -                 |
-| children               | Child elements, reference the demo for details                                                                                                                               | ReactElementWithTypeMark \| ReactElementWithTypeMark[]                                                                           | -                                     |          | -                 |
+| children               | Child elements, reference the demo for details                                                                                                                               | React.ReactNode                                                                                                                  | -                                     |          | -                 |
 | name                   | Name                                                                                                                                                                         | string                                                                                                                           | -                                     |          | -                 |
 | value                  | Current value, for controlled mode                                                                                                                                           | DataSourceItem \| DataSourceItem[]                                                                                               | -                                     |          | -                 |
 | defaultValue           | Initial default value                                                                                                                                                        | DataSourceItem \| DataSourceItem[]                                                                                               | -                                     |          | -                 |
@@ -81,13 +81,13 @@ This is because the layer's animation of the overlay is implemented by `classNam
 | popupContainer         | Popup mounting container                                                                                                                                                     | string \| HTMLElement \| ((target: HTMLElement) => HTMLElement)                                                                  | -                                     |          | -                 |
 | popupClassName         | Popup class name                                                                                                                                                             | string                                                                                                                           | -                                     |          | -                 |
 | popupStyle             | Popup inline style                                                                                                                                                           | React.CSSProperties                                                                                                              | -                                     |          | -                 |
-| popupProps             | Props added to the popup                                                                                                                                                     | PopupProps                                                                                                                       | -          
```

**File**: `components/select/__docs__/index.md` (modified, +55/-52)
```diff
@@ -28,7 +28,7 @@
 | 参数                   | 说明                                                                                                                                                                                                    | 类型                                                                                                                             | 默认值                                | 是否必填 | 支持版本 |
 | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------- | -------- |
 | size                   | 选择器尺寸                                                                                                                                                                                              | 'small' \| 'medium' \| 'large'                                                                                                   | 'medium'                              |          | -        |
-| children               | 子元素，详细使用方法参考 demo                                                                                                                                                                           | ReactElementWithTypeMark \| ReactElementWithTypeMark[]                                                                           | -                                     |          | -        |
+| children               | 子元素，详细使用方法参考 demo                                                                                                                                                                           | React.ReactNode                                                                                                                  | -                                     |          | -        |
 | name                   | name                                                                                                                                                                                                    | string                                                                                                                           | -                                     |          | -        |
 | value                  | 当前值，用于受控模式                                                                                                                                                                                    | DataSourceItem \| DataSourceItem[]                                                                                               | -                                     |          | -        |
 | defaultValue           | 初始的默认值                                                                                                                                                                                            | DataSourceItem \| DataSourceItem[]                                                                                               | -                                     |          | -        |
@@ -45,13 +45,13 @@
 | popupContainer         | 弹层挂载的容器节点                                                                                                                                                                                      | string \| HTMLElement \| ((target: HTMLElement) => HTMLElement)                                                                  | -                                     |          | -        |
 | popupClassName         | 弹层的 className                                                                                                                                                                                        | string                                                                                                                           | -                                     |          | -        |
 | popupStyle             | 弹层的内联样式                                                                                                                                                                                          | React.CSSProperties                                                                                                              | -                                     |          | -        |
-| popupProps             | 添加到弹层上的属性                                                                                                                                                                                      | PopupProps                                                                                                                       | -                                     
```

---

### Incident Patch 15: `fbda649d` (2024-12-06)
**Commit Message**: fix(Badge): set alignment by use transform

**File**: `components/badge/__tests__/index-spec.tsx` (modified, +33/-0)
```diff
@@ -116,4 +116,37 @@ describe('Badge', () => {
         cy.mount(<Badge count={0} showZero />);
         cy.get('.next-badge-count.next-badge-scroll-number');
     });
+
+    it('should on right when children is block', () => {
+        cy.mount(
+            <Badge count={1}>
+                <div
+                    style={{
+                        width: '200px',
+                        height: '40px',
+                        display: 'block',
+                        background: 'blue',
+                    }}
+                ></div>
+            </Badge>
+        );
+        cy.get('.next-badge-count').then($el => {
+            $el.css({
+                transition: 'none',
+                animation: 'none',
+            });
+        });
+        cy.get('.next-badge-count').then($el => {
+            const targetRect = $el[0].getBoundingClientRect();
+            const badgeRect = document.querySelector('.next-badge')!.getBoundingClientRect();
+            const position = {
+                left: Math.round(targetRect.left),
+                top: Math.round(targetRect.top),
+            };
+            expect(position).to.deep.equal({
+                left: Math.round(badgeRect.left + badgeRect.width - targetRect.width / 2),
+                top: Math.round(badgeRect.top - 4),
+            });
+        });
+    });
 });
```

**File**: `components/badge/main.scss` (modified, +2/-0)
```diff
@@ -77,6 +77,8 @@
             z-index: 10;
             overflow: hidden;
             transform-origin: left center;
+            transform: translateX(50%);
+            right: 0;
         }
 
         &-scroll-number-only {
```

#### Recent Merged Pull Requests:
- **PR #5110** (closed): chore(deps-dev): bump urllib from 2.41.0 to 2.44.1 (@dependabot[bot])
- **PR #5109** (closed): chore(deps-dev): bump postcss from 7.0.39 to 8.5.23 (@dependabot[bot])
- **PR #5108** (closed): chore(deps): bump socket.io-parser and karma (@dependabot[bot])
- **PR #5107** (closed): chore(deps-dev): bump postcss from 7.0.39 to 8.5.18 (@dependabot[bot])
- **PR #5106** (closed): chore(deps): bump shell-quote and react-dev-utils (@dependabot[bot])
- **PR #5105** (closed): chore(deps): bump linkify-it and markdown-it (@dependabot[bot])
- **PR #5104** (closed): chore(deps): bump immutable from 4.3.4 to 4.3.9 (@dependabot[bot])
- **PR #5102** (closed): chore(deps): bump websocket-driver from 0.7.4 to 0.7.5 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
