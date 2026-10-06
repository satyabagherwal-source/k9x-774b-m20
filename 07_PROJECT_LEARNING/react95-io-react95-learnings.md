# Forensic Learning Record (Deep Inspection): react95-io/React95

> **Canonical Artifact**: `07_PROJECT_LEARNING/react95-io-react95-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react95-io/React95](https://github.com/react95-io/React95))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:59:37.157Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react95-io/React95`
- **Description**: 🌈🕹  Windows 95 style UI component library for React
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7273 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/Select/useSelectState.ts`
```
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { KEYBOARD_KEY_CODES } from '../common/constants';
import useControlledOrUncontrolled from '../common/hooks/useControlledOrUncontrolled';
import { clamp } from '../common/utils';

import { SelectOption, SelectInnerProps } from './Select.types';

const TYPING_RESET_DELAY = 1000;

export const useSelectState = <T>({
  onBlur,
  onChange,
  onClose,
  onFocus,
  onKeyDown,
  onMouseDown,
  onOpen,
  open: openProp,
  options,
  readOnly,
  value,
  selectRef,
  setValue,
  wrapperRef
}: Omit<SelectInnerProps<T>, 'options' | 'value'> & {
  options: SelectOption<T>[];
  selectRef: React.MutableRefObject<HTMLDivElement | null>;
  setValue: (newValue: React.SetStateAction<T>) => void;
  value: T;
  wrapperRef: React.MutableRefObject<HTMLDivElement | null>;
}) => {
  // Element references for scrolling to the active option
  const dropdownRef = useRef<HTMLUListElement | null>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  // State references so callbacks are not reset on every change
  const selectedIndex = useRef<number>(0);
  const activeIndex = useRef(0);

  // Buffer to focus option after it is rendered and the reference becomes known
  const focusIndexWhenSet = useRef<number>();

  // Typing state references so callbacks are not reset on every change
  const typingMode = useRef<'search' | 'cycleFirstLetter'>('search');
  const typedString = useRef<string>('');
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  // Open state
  const [open, setOpen] = useControlledOrUncontrolled({
    defaultValue: false,
    onChange: onOpen,
    onChangePropName: 'onOpen',
    readOnly,
    value: openProp,
    valuePropName: 'open'
  });

  // Exposed selected option
  const selectedOption = useMemo(() => {
    const index = options.findIndex(option => option.value === value);
    selectedIndex.current = clamp(index, 0, null);
    return options[index];
  }, [options, value]);

  // Exposed active option
  const [activeOption, setActiveOption] = useState(options[0]);

  // Focuses and scrolls to the option, pinning it to the top or bottom of the
  // scroll area. The default focus behavior scrolls inconsistently.
  const focusOption = useCallback(
    (index: number) => {
      const dropdownEl = dropdownRef.current;
      const optionEl = optionRefs.current[index];
      if (!optionEl || !dropdownEl) {
        focusIndexWhenSet.current = index;
        return;
      }
      focusIndexWhenSet.current = undefined;

      const dropdownHeight = dropdownEl.clientHeight;
      const dropdownScrollTop = dropdownEl.scrollTop;
      const dropdownScrollEnd = dropdownEl.scrollTop + dropdownHeight;
      const optionTop = optionEl.offsetTop;
      const optionHeight = optionEl.offsetHeight;
      const optionBottom = optionEl.offsetTop + optionEl.offsetHeight;

      if (optionTop < dropdownScrollTop) {
        dropdownEl.scrollTo(0, optionTop);
      }
      if (optionBottom > dropdownScrollEnd) {
        dropdownEl.scrollTo(0, optionTop - dropdownHeight + optionHeight);
      }
      optionEl.focus({ preventScroll: true });
    },
    [dropdownRef]
  );

  // Activates an option relatively or absolutely
  const activateOption = useCallback(
    (
      indexOrOption:
        | number
        | 'first'
        | 'last'
        | 'next'
        | 'previous'
        | 'selected',
      { scroll }: { scroll?: boolean } = {}
    ) => {
      const lastIndex = options.length - 1;
      let index;
      switch (indexOrOption) {
        case 'first': {
          index = 0;
          break;
        }
        case 'last': {
          index = lastIndex;
          break;
        }
        case 'next': {
          index = clamp(activeIndex.current + 1, 0, lastIndex);
          break;
        }
        case 'previous': {
          index = clamp(activeIndex.current - 1, 0, lastIndex);
          break;
        }
        case 'selected': {
          index = clamp(selectedIndex.current ?? 0, 0, lastIndex);
          break;
        }
        default:
          index = indexOrOption;
      }

      activeIndex.current = index;
      setActiveOption(options[index]);

      if (scroll) {
        focusOption(index);
      }
    },
    [activeIndex, options, focusOption]
  );

  // Opens the dropdown and activates the selected option
  const openDropdown = useCallback(
    ({ fromEvent }: { fromEvent: React.SyntheticEvent }) => {
      setOpen(true);
      activateOption('selected', { scroll: true });
      onOpen?.({ fromEvent });
    },
    [activateOption, onOpen, setOpen]
  );

  // Resets the typing states and clears timers
  const clearSearchFromTyping = useCallback(() => {
    typingMode.current = 'search';
    typedString.current = '';
    clearTimeout(typingTimer.current);
  }, []);

  // Closes the dropdown and resets its state
  const closeDropdown = useCallback(
    ({
      focusSelect,
      fromEvent
    }: {
      focusSelect: boolean;
      fromEvent: Event | React.SyntheticEvent;
    }) => {
      onClose?.({ fromEvent });
      setOpen(false);
      setActiveOption(options[0]);
      clearSearchFromTyping();
      focusIndexWhenSet.current = undefined;
      if (focusSelect) {
        selectRef.current?.focus();
      }
    },
    [clearSearchFromTyping, onClose, options, selectRef, setOpen]
  );

  // Toggles the dropdown open state
  const toggleDropdown = useCallback(
    ({ fromEvent }: { fromEvent: React.SyntheticEvent }) => {
      if (open) {
        closeDropdown({ focusSelect: false, fromEvent });
      } else {
        openDropdown({ fromEvent });
      }
    },
    [closeDropdown, openDropdown, open]
  );

  // Selects an option and updates the exposed state
  const selectOptionIndex = useCallback(
    (
      optionIndex: number,
      { fromEvent }: { fromEvent: Event | React.SyntheticEvent }
    ) => {
      if (selectedIndex.current === optionIndex) {
        return;
      }

      selectedIndex.current = optionIndex;
      setValue(options[optionIndex].value);
      onChange?.(options[optionIndex], { fromEvent });
    },
    [onChange, options, setValue]
  );

  // Selects the active option and close the dropdown
  const selectActiveOptionAndClose = useCallback(
    ({
      focusSelect,
      fromEvent
    }: {
      focusSelect: boolean;
      fromEvent: Event | React.SyntheticEvent;
    }) => {
      selectOptionIndex(activeIndex.current, { fromEvent });
      closeDropdown({ focusSelect, fromEvent });
    },
    [closeDropdown, selectOptionIndex]
  );

  // Searches options for the typed letter and activates it (if open) or selects
  // it (if closed)
  const searchFromTyping = useCallback(
    (
      letter: string,
      {
        fromEvent,
        select
      }: { fromEvent: React.SyntheticEvent; select: boolean }
    ) => {
      if (
        typingMode.current === 'cycleFirstLetter' &&
        letter !== typedString.current
      ) {
        typingMode.current = 'search';
      }

      if (letter === typedString.current) {
        typingMode.current = 'cycleFirstLetter';
      } else {
        typedString.current += letter;
      }

      switch (typingMode.current) {
        case 'search': {
          let foundOptionIndex = options.findIndex(
            option =>
              option.label?.toLocaleUpperCase().indexOf(typedString.current) ===
              0
          );
          if (foundOptionIndex < 0) {
            foundOptionIndex = options.findIndex(
              option => option.label?.toLocaleUpperCase().indexOf(letter) === 0
            );
            typedString.current = letter;
          }
          if (foundOptionIndex >= 0) {
            if (select) {
              selectOptionIndex(foundOptionIndex, { fromEvent });
            } else {
              activateOption(foundOptionIndex, { scroll: true });
            }
          }
          break;
        }
        case 'cycleFirstLetter': {
          const currentOptionIndex = select
            ? selectedIndex.current ?? -1
            : activeIndex.current;
          let foundOptionIndex = options.findIndex(
            (option, index) =>
              index > currentOptionIndex &&
              option.label?.toLocaleUpperCase().indexOf(letter) === 0
          );
          if (foundOptionIndex < 0) {
            foundOptionIndex = options.findIndex(
              option => option.label?.toLocaleUpperCase().indexOf(letter) === 0
            );
          }
          if (foundOptionIndex >= 0) {
            if (select) {
              selectOptionIndex(foundOptionIndex, { fromEvent });
            } else {
              activateOption(foundOptionIndex, { scroll: true });
            }
          }

          break;
        }
        default:
      }

      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        if (typingMode.current === 'search') {
          typedString.current = '';
        }
      }, TYPING_RESET_DELAY);
    },
    [activateOption, options, selectOptionIndex]
  );

  // MouseDown handler for the select button
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // ignore everything but left-click
      if (event.button !== 0) {
        return;
      }

      // hijack the default focus behavior.
      event.preventDefault();
      selectRef.current?.focus();

      toggleDropdown({ fromEvent: event });

      onMouseDown?.(event);
    },
    [onMouseDown, selectRef, toggleDropdown]
  );

  // Click handler for every option
  const handleOptionClick = useCallback(
    (event: React.MouseEvent<HTMLLIElement>) => {
      selectActiveOptionAndClose({ focusSelect: true, fromEvent: event });
    },
    [selectActiveOptionAndClose]
  );

  // KeyDown handler for select button and dropdown menu, implementing
  // recommended keyboard interactions from [ARIA's document][1] as well as some
  // common practices for listboxes on 
```

### Core Architecture Module: `src/common/hooks/useControlledOrUncontrolled.ts`
```
import React, { useState, useCallback } from 'react';

export default function useControlledOrUncontrolled<T>({
  defaultValue,
  onChange,
  onChangePropName = 'onChange',
  readOnly,
  value,
  valuePropName = 'value'
}: {
  defaultValue: T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange?: (...args: any[]) => void;
  onChangePropName?: string;
  readOnly?: boolean;
  value: T | undefined;
  valuePropName?: string;
}): [T, (newValue: React.SetStateAction<T>) => void] {
  const isControlled = value !== undefined;
  const [controlledValue, setControlledValue] = useState(defaultValue);
  const handleChangeIfUncontrolled = useCallback(
    (newValue: React.SetStateAction<T>) => {
      if (!isControlled) {
        setControlledValue(newValue);
      }
    },
    [isControlled]
  );

  // Because we provide `onChange` even to uncontrolled components, React's
  // default uncontrolled warning must be reimplemented. This also deals with
  // props that are different from `value`.
  if (isControlled && typeof onChange !== 'function' && !readOnly) {
    const message = `Warning: You provided a \`${valuePropName}\` prop to a component without an \`${onChangePropName}\` handler.${
      valuePropName === 'value'
        ? `This will render a read-only field. If the field should be mutable use \`defaultValue\`. Otherwise, set either \`${onChangePropName}\` or \`readOnly\`.`
        : `This breaks the component state. You must provide an \`${onChangePropName}\` function that updates \`${valuePropName}\`.`
    }`;

    // eslint-disable-next-line no-console
    console.warn(message);
  }

  return [isControlled ? value : controlledValue, handleChangeIfUncontrolled];
}

```

### Core Architecture Module: `src/common/hooks/useEventCallback.ts`
```
import * as React from 'react';

const useEnhancedEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

/**
 * https://github.com/facebook/react/issues/14099#issuecomment-440013892
 */
export default function useEventCallback<Args extends unknown[], Return>(
  fn: (...args: Args) => Return
): (...args: Args) => Return {
  const ref = React.useRef(fn);
  useEnhancedEffect(() => {
    ref.current = fn;
  });
  return React.useCallback(
    (...args: Args) =>
      // @ts-expect-error hide `this`
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      (0, ref.current!)(...args),
    []
  );
}

```

### Core Architecture Module: `src/common/hooks/useForkRef.ts`
```
// Straight out copied from https://github.com/mui-org/material-ui 😂

import { useMemo } from 'react';

function setRef<T>(
  ref: React.RefCallback<T> | React.MutableRefObject<T> | null,
  value: T
) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    // eslint-disable-next-line no-param-reassign
    ref.current = value;
  }
}

export default function useForkRef<T>(
  refA: React.RefCallback<T> | React.MutableRefObject<T> | null,
  refB: React.RefCallback<T> | React.MutableRefObject<T> | null
): React.RefCallback<T> | null {
  /**
   * This will create a new function if the ref props change and are defined.
   * This means react will call the old forkRef with `null` and the new forkRef
   * with the ref. Cleanup naturally emerges from this behavior
   */
  return useMemo(() => {
    if (refA == null && refB == null) {
      return null;
    }
    return refValue => {
      setRef(refA, refValue);
      setRef(refB, refValue);
    };
  }, [refA, refB]);
}

```

### Core Architecture Module: `src/common/hooks/useId.ts`
```
import { useMemo } from 'react';

function makeId() {
  const chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let id = '';
  for (let i = 0; i < 10; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export const useId = (id?: string) => {
  return useMemo(() => id ?? makeId(), [id]);
};

```

### Core Architecture Module: `src/common/hooks/useIsFocusVisible.ts`
```
// Straight out copied from https://github.com/mui-org/material-ui 😂
// based on https://github.com/WICG/focus-visible/blob/v4.1.5/src/focus-visible.js

import { useCallback } from 'react';
import { findDOMNode } from 'react-dom';

let hadKeyboardEvent = true;
let hadFocusVisibleRecently = false;
let hadFocusVisibleRecentlyTimeout: number;

const inputTypesWhitelist: Record<string, boolean> = {
  text: true,
  search: true,
  url: true,
  tel: true,
  email: true,
  password: true,
  number: true,
  date: true,
  month: true,
  week: true,
  time: true,
  datetime: true,
  'datetime-local': true
};

/**
 * Computes whether the given element should automatically trigger the
 * `focus-visible` class being added, i.e. whether it should always match
 * `:focus-visible` when focused.
 * @param {Element} node
 * @return {boolean}
 */
function focusTriggersKeyboardModality(
  node: Element | HTMLElement | HTMLInputElement
) {
  if ('type' in node) {
    const { type, tagName } = node;

    if (tagName === 'INPUT' && inputTypesWhitelist[type] && !node.readOnly) {
      return true;
    }

    if (tagName === 'TEXTAREA' && !node.readOnly) {
      return true;
    }
  }

  if ('isContentEditable' in node && node.isContentEditable) {
    return true;
  }

  return false;
}

/**
 * Keep track of our keyboard modality state with `hadKeyboardEvent`.
 * If the most recent user interaction was via the keyboard;
 * and the key press did not include a meta, alt/option, or control key;
 * then the modality is keyboard. Otherwise, the modality is not keyboard.
 * @param {KeyboardEvent} event
 */
function handleKeyDown(event: KeyboardEvent) {
  if (event.metaKey || event.altKey || event.ctrlKey) {
    return;
  }
  hadKeyboardEvent = true;
}

/**
 * If at any point a user clicks with a pointing device, ensure that we change
 * the modality away from keyboard.
 * This avoids the situation where a user presses a key on an already focused
 * element, and then clicks on a different element, focusing it with a
 * pointing device, while we still think we're in keyboard modality.
 */
function handlePointerDown() {
  hadKeyboardEvent = false;
}

function handleVisibilityChange(this: Document) {
  if (this.visibilityState === 'hidden') {
    // If the tab becomes active again, the browser will handle calling focus
    // on the element (Safari actually calls it twice).
    // If this tab change caused a blur on an element with focus-visible,
    // re-apply the class when the user switches back to the tab.
    if (hadFocusVisibleRecently) {
      hadKeyboardEvent = true;
    }
  }
}

function prepare(doc: Document) {
  doc.addEventListener('keydown', handleKeyDown, true);
  doc.addEventListener('mousedown', handlePointerDown, true);
  doc.addEventListener('pointerdown', handlePointerDown, true);
  doc.addEventListener('touchstart', handlePointerDown, true);
  doc.addEventListener('visibilitychange', handleVisibilityChange, true);
}

export function teardown(doc: Document) {
  doc.removeEventListener('keydown', handleKeyDown, true);
  doc.removeEventListener('mousedown', handlePointerDown, true);
  doc.removeEventListener('pointerdown', handlePointerDown, true);
  doc.removeEventListener('touchstart', handlePointerDown, true);
  doc.removeEventListener('visibilitychange', handleVisibilityChange, true);
}

function isFocusVisible(event: React.FocusEvent) {
  const { target } = event;
  try {
    return target.matches(':focus-visible');
  } catch (error) {
    // browsers not implementing :focus-visible will throw a SyntaxError
    // we use our own heuristic for those browsers
    // rethrow might be better if it's not the expected error but do we really
    // want to crash if focus-visible malfunctioned?
  }

  // no need for validFocusTarget check. the user does that by attaching it to
  // focusable events only
  return hadKeyboardEvent || focusTriggersKeyboardModality(target);
}

/**
 * Should be called if a blur event is fired on a focus-visible element
 */
function handleBlurVisible() {
  // To detect a tab/window switch, we look for a blur event followed
  // rapidly by a visibility change.
  // If we don't see a visibility change within 100ms, it's probably a
  // regular focus change.
  hadFocusVisibleRecently = true;
  window.clearTimeout(hadFocusVisibleRecentlyTimeout);
  hadFocusVisibleRecentlyTimeout = window.setTimeout(() => {
    hadFocusVisibleRecently = false;
  }, 100);
}

export function useIsFocusVisible<T extends Element = HTMLElement>() {
  const ref = useCallback((instance: T) => {
    // eslint-disable-next-line react/no-find-dom-node
    const node = findDOMNode(instance);
    if (node != null) {
      prepare(node.ownerDocument);
    }
  }, []);

  return { isFocusVisible, onBlurVisible: handleBlurVisible, ref };
}

```

### Core Architecture Module: `src/common/utils/events.ts`
```
import React from 'react';

export const focusEventTypes = ['blur', 'focus'];

export const keyboardEventTypes = ['keydown', 'keypress', 'keyup'];

export const mouseEventTypes = [
  'click',
  'contextmenu',
  'doubleclick',
  'drag',
  'dragend',
  'dragenter',
  'dragexit',
  'dragleave',
  'dragover',
  'dragstart',
  'drop',
  'mousedown',
  'mouseenter',
  'mouseleave',
  'mousemove',
  'mouseout',
  'mouseover',
  'mouseup'
];

export function isReactFocusEvent<T>(
  event: React.SyntheticEvent<T> | Event
): event is React.FocusEvent<T> {
  return 'nativeEvent' in event && focusEventTypes.includes(event.type);
}

export function isReactKeyboardEvent<T>(
  event: React.SyntheticEvent<T> | Event
): event is React.KeyboardEvent<T> {
  return 'nativeEvent' in event && keyboardEventTypes.includes(event.type);
}

export function isReactMouseEvent<T>(
  event: React.SyntheticEvent<T> | Event
): event is React.MouseEvent<T> {
  return 'nativeEvent' in event && mouseEventTypes.includes(event.type);
}

```

### Core Architecture Module: `src/common/utils/index.ts`
```
import { WindowsTheme } from '../../types';

export const noOp = () => {};

export function clamp(value: number, min: number | null, max: number | null) {
  if (max !== null && value > max) {
    return max;
  }
  if (min !== null && value < min) {
    return min;
  }
  return value;
}

function linearGradient(left: string, right: string) {
  return `linear-gradient(to right, ${left}, ${right})`;
}

export function mapFromWindowsTheme(
  name: string,
  windowsTheme: WindowsTheme,
  useGradients: boolean
) {
  const {
    ButtonDkShadow,
    ButtonFace,
    ButtonHilight,
    ButtonLight,
    ButtonShadow,
    ButtonText,
    Background,
    Window,
    WindowText,
    ActiveTitle,
    GradientActiveTitle,
    GradientInactiveTitle,
    InactiveTitle,
    InactiveTitleText,
    TitleText,
    GrayText,
    Hilight,
    HilightText,
    HotTrackingColor,
    InfoWindow
  } = windowsTheme;

  return {
    name,

    anchor: HotTrackingColor,
    anchorVisited: HotTrackingColor,
    borderDark: ButtonShadow,
    borderDarkest: ButtonDkShadow,
    borderLight: ButtonLight,
    borderLightest: ButtonHilight,
    canvas: Window,
    canvasText: WindowText,
    canvasTextDisabled: ButtonShadow,
    canvasTextDisabledShadow: ButtonHilight,
    canvasTextInvert: HilightText,
    checkmark: WindowText,
    checkmarkDisabled: GrayText,
    desktopBackground: Background,
    flatDark: ButtonShadow,
    flatLight: ButtonLight,
    focusSecondary: ButtonHilight, // should be Hilight inverted
    headerBackground: useGradients
      ? linearGradient(ActiveTitle, GradientActiveTitle)
      : ActiveTitle,
    headerNotActiveBackground: useGradients
      ? linearGradient(InactiveTitle, GradientInactiveTitle)
      : InactiveTitle,
    headerNotActiveText: InactiveTitleText,
    headerText: TitleText,
    hoverBackground: Hilight,
    material: ButtonFace,
    materialDark: InactiveTitle,
    materialText: ButtonText,
    materialTextDisabled: ButtonShadow,
    materialTextDisabledShadow: ButtonHilight,
    materialTextInvert: HilightText,
    progress: Hilight,
    tooltip: InfoWindow
  };
}

// helper functions below are from Material UI (https://github.com/mui-org/material-ui)
export function getDecimalPrecision(num: number) {
  if (Math.abs(num) < 1) {
    const parts = num.toExponential().split('e-');
    const matissaDecimalPart = parts[0].split('.')[1];
    return (
      (matissaDecimalPart ? matissaDecimalPart.length : 0) +
      parseInt(parts[1], 10)
    );
  }

  const decimalPart = num.toString().split('.')[1];
  return decimalPart ? decimalPart.length : 0;
}

export function roundValueToStep(value: number, step: number, min: number) {
  const nearest = Math.round((value - min) / step) * step + min;
  return Number(nearest.toFixed(getDecimalPrecision(step)));
}

export function getSize(value: string | number) {
  return typeof value === 'number' ? `${value}px` : value;
}

```

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  extends: [
    'plugin:@typescript-eslint/recommended',
    'airbnb',
    'plugin:prettier/recommended',
    'plugin:react-hooks/recommended'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react', 'prettier'],
  env: {
    browser: true,
    es6: true,
    jest: true
  },
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_\\d*$'
      }
    ],
    'import/extensions': ['error', { js: 'never', ts: 'never', tsx: 'never' }],
    'import/no-unresolved': [
      'error',
      // TODO: Remove ../../test/utils when TypeScript migration is complete
      { ignore: ['react95', '../../test/utils'] }
    ],
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'import/prefer-default-export': 'off',
    'jsx-a11y/label-has-associated-control': ['error', { assert: 'either' }],
    'jsx-a11y/label-has-for': 'off',
    'no-nested-ternary': 'off',
    'prettier/prettier': 'error',
    'react/forbid-prop-types': 'off',
    'react/jsx-filename-extension': [
      'warn',
      { extensions: ['.js', '.jsx', '.tsx'] }
    ],
    'react/jsx-props-no-spreading': 'off',
    'react/no-array-index-key': 'off',
    'react/prop-types': 'off',
    'react/require-default-props': 'off',
    'react/static-property-placement': ['error', 'static public field']
  },
  overrides: [
    {
      files: ['*.spec.@(js|jsx|ts|tsx)', '*.stories.@(js|jsx|ts|tsx)'],
      rules: {
        'no-console': 'off'
      }
    },
    {
      files: ['*.@(ts|tsx)'],
      rules: {
        // This is handled by @typescript-eslint/no-unused-vars
        'no-undef': 'off'
      }
    }
  ],
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx']
    },
    'import/resolver': {
      typescript: {}
    }
  }
};

```

### Core Architecture Module: `.storybook/decorators/withGlobalStyle.tsx`
```
import { DecoratorFn } from '@storybook/react';
import React from 'react';
import { createGlobalStyle } from 'styled-components';

import ms_sans_serif from '../../src/assets/fonts/dist/ms_sans_serif.woff2';
import ms_sans_serif_bold from '../../src/assets/fonts/dist/ms_sans_serif_bold.woff2';
import styleReset from '../../src/common/styleReset';

const GlobalStyle = createGlobalStyle`
  ${styleReset}
  @font-face {
    font-family: 'ms_sans_serif';
    src: url('${ms_sans_serif}') format('woff2');
    font-weight: 400;
    font-style: normal
  }
  @font-face {
    font-family: 'ms_sans_serif';
    src: url('${ms_sans_serif_bold}') format("woff2");
    font-weight: bold;
    font-style: normal
  }
  html, body, #root {
   height: 100%;
  }
  #root > * {
    height: 100%;
    box-sizing: border-box;
  }
  body {
    font-family: 'ms_sans_serif', 'sans-serif';
  }
`;

export const withGlobalStyle: DecoratorFn = story => (
  <>
    <GlobalStyle />
    {story()}
  </>
);

```

### Core Architecture Module: `.storybook/main.ts`
```
import type { StorybookConfig } from '@storybook/react/types';
import type { PropItem } from 'react-docgen-typescript';

const path = require('path');

const storybookConfig: StorybookConfig = {
  stories: ['../@(docs|src)/**/*.stories.@(tsx|mdx)'],
  addons: [
    {
      name: '@storybook/addon-docs',
      options: {
        sourceLoaderOptions: {
          injectStoryParameters: false
        }
      }
    },
    '@storybook/addon-storysource',
    './theme-picker/register.ts'
  ],
  core: {
    builder: 'webpack5'
  },
  features: {
    babelModeV7: true,
    storyStoreV7: true,
    modernInlineRender: true,
    postcss: false
  },
  typescript: {
    check: false,
    checkOptions: {},
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop: PropItem) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true
    }
  },
  webpackFinal: config => {
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        react95: path.resolve(__dirname, '../src/index')
      }
    };

    return config;
  }
};

module.exports = storybookConfig;

```

### Core Architecture Module: `.storybook/manager.ts`
```
import './manager.css';

import { addons } from '@storybook/addons';
import theme from './theme';

addons.setConfig({
  theme
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #383** (2023-04-24): **"Active" button not getting focused state (dashed inner border)**
  *Symptoms*: "Active" button not getting focused state (dashed inner border):  <img width="62" alt="Screenshot 2023-04-08 at 14 59 09" src="https://user-images.githubusercontent.com/28541613/230722457-c34dd73c-41ec-4af0-a79f-f1e290ae6578.png"> 
  **Post-Mortem & Fix Analysis**:
  > Please assign this issue to me for working on it. Thanks
  > @afzalzbr awesome. Thank you and good luck!
  > The `focusOutline` was not including any case for active === true.  I've made changes in the file: `src\Button\Button.tsx`: ![image](https://user-images.githubusercontent.com/49808043/230751214-4c4bb5e6-7284-4563-aabc-6a9c24f7aec4.png)  Following is the working example of the fix for the 'Active' button, followed by a picture showing no other buttons' styles are being compromised: ![image](https://user-images.githubusercontent.com/49808043/230751259-83238241-9786-4669-b4f6-23327495f802.png)  ![image](https://user-images.githubusercontent.com/49808043/230751296-63440370-85d7-429c-84b4-4c110eddb07b.png)  I hope this helps!  @arturbien, Lemme know if anything else needs to be done. 

- **Issue #351** (2022-09-10): **fix(coverage): fix Jest coverage not properly referencing code points correctly**
  *Symptoms*: Code coverage depends on TypeScript sourceMap, which we disabled for builds.
  **Post-Mortem & Fix Analysis**:
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arturbien/React95/pr/351/builds/280519) or the icon next to each commit SHA.  Latest deployment of this branch, based on commit 4bdb91370e6c24f26d093d2269cc771ab0f76b46:  |Sandbox| Source | |--|--| |[React95 template](https://codesandbox.io/s/react95-template-f5he5v)| Configuration | 
  > **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated | | :--- | :----- | :------ | :------ | | **react95** | ✅ Ready ([Inspect](https://vercel.com/arturbien/react95/9LjirTgca7ctn83bgWXWZiJw86C5)) | [Visit Preview](https://react95-git-fix-wesjest-coverage-arturbien.vercel.app) | Aug 10, 2022 at 11:05PM (UTC) |  

- **Issue #349** (2022-08-06): **build: remove babel-plugin-polyfill-corejs3 to avoid Babel issue building Storybook**
  *Symptoms*: The build error happens inside that plugin, which shouldn't be necessary in modern browsers.
  **Post-Mortem & Fix Analysis**:
  > **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated | | :--- | :----- | :------ | :------ | | **react95** | ✅ Ready ([Inspect](https://vercel.com/arturbien/react95/EmmZZ7WZrgAYYhFFixsgnnfkC8Zh)) | [Visit Preview](https://react95-git-build-wesremove-corejs3-arturbien.vercel.app) | Aug 6, 2022 at 4:36PM (UTC) |  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arturbien/React95/pr/349/builds/278924) or the icon next to each commit SHA.  Latest deployment of this branch, based on commit ac1599028e1e63fd0dbe1f89c0a066fe0c176fe0:  |Sandbox| Source | |--|--| |[React95 template](https://codesandbox.io/s/react95-template-xo5e88)| Configuration | 
  > :tada: This PR is included in version 4.0.0-beta.13 :tada:  The release is available on: - [npm package (@beta dist-tag)](https://www.npmjs.com/package/react95/v/4.0.0-beta.13) - [GitHub release](https://github.com/arturbien/React95/releases/tag/v4.0.0-beta.13)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #347** (2022-08-07): **build: fix TypeScript export for themes**
  *Symptoms*: Currently, Rollup configures themes as a `dir` output type, with `preserveModules` enabled, but the types are not exported accordingly, so importing modules directly fails type checking:  ```js import original from 'react95/dist/themes/original'; ```

- **Issue #338** (2022-08-05): **build: configure rollup-plugin-dts to use special compilerOptions**
  *Symptoms*: An alternative to #329, passing specific TypeScript `compilerOptions` to `rollup-plugin-dts`.
  **Post-Mortem & Fix Analysis**:
  > **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated | | :--- | :----- | :------ | :------ | | **react95** | ✅ Ready ([Inspect](https://vercel.com/arturbien/react95/45912yGQv1v3c2YMiddt6wFuxEyH)) | [Visit Preview](https://react95-git-build-wesdts-config-arturbien.vercel.app) | Aug 4, 2022 at 8:58PM (UTC) |  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arturbien/React95/pr/338/builds/278363) or the icon next to each commit SHA.  Latest deployment of this branch, based on commit 4724175b335b636f3bc6e7162ccc3223392f7de5:  |Sandbox| Source | |--|--| |[React95 template](https://codesandbox.io/s/react95-template-pu2l5t)| Configuration | 
  > @arturbien @luizbaldi although this exported files on the correct locations, it still didn't generate one file per theme as expected.  Any objection to either: - Export one bundle with all themes in one object - Export the themes together with `react95` and only have one entry

- **Issue #336** (2022-08-05): **chore: restore React 16 support**
  *Symptoms*: This restores importing React and the ESLint rule react/react-in-jsx-scope to preserve React 16 compatibility.  This also moves some types around so themes can be exported as a standalone with its own TypeScript config.
  **Post-Mortem & Fix Analysis**:
  > **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated | | :--- | :----- | :------ | :------ | | **react95** | ✅ Ready ([Inspect](https://vercel.com/arturbien/react95/CFqrKyCN19dWJmVB5xgo8vgHy63j)) | [Visit Preview](https://react95-git-fork-wessouza-chore-wesjsx-react-arturbien.vercel.app) | Aug 4, 2022 at 8:26PM (UTC) |  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arturbien/React95/pr/336/builds/278349) or the icon next to each commit SHA.  Latest deployment of this branch, based on commit b1ea0b33426628865a58242aac8ec7e96449b7bb:  |Sandbox| Source | |--|--| |[React95 template](https://codesandbox.io/s/react95-template-26thr9)| Configuration | 
  > :tada: This PR is included in version 4.0.0-beta.12 :tada:  The release is available on: - [npm package (@beta dist-tag)](https://www.npmjs.com/package/react95/v/4.0.0-beta.12) - [GitHub release](https://github.com/arturbien/React95/releases/tag/v4.0.0-beta.12)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #329** (2022-08-07): **build: update build to preserve modules and use @rollup/plugin-typescript**
  *Symptoms*: This changes the main output to also preserve modules, allowing tree shaking when users build their projects.  This also replaces rollup-plugin-dts with the more traditional @rollup/plugin-typescript, which exports type declarations for individual files fixing issues with themes imports.  It also adds missing `displayName` to `Select`, `Toolbar`, `TreeView` and `WindowHeader`, as well as improves the return type generics of `Select` and `TreeView`.  Closes #346, #347.
  **Post-Mortem & Fix Analysis**:
  > **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated | | :--- | :----- | :------ | :------ | | **react95** | ✅ Ready ([Inspect](https://vercel.com/arturbien/react95/C2PF6wHoGYnjG19r3QwTnreFUpeV)) | [Visit Preview](https://react95-git-fork-wessouza-build-plugin-typescript-arturbien.vercel.app) | Aug 6, 2022 at 3:23PM (UTC) |  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arturbien/React95/pr/329/builds/278922) or the icon next to each commit SHA.  Latest deployment of this branch, based on commit 841f273f04f6f1c8bc6893b004a78844dc0cdde2:  |Sandbox| Source | |--|--| |[React95 template](https://codesandbox.io/s/react95-template-jdfqxg)| Configuration | 
  > :tada: This PR is included in version 4.0.0-beta.13 :tada:  The release is available on: - [npm package (@beta dist-tag)](https://www.npmjs.com/package/react95/v/4.0.0-beta.13) - [GitHub release](https://github.com/arturbien/React95/releases/tag/v4.0.0-beta.13)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #192** (2020-10-31): **Cutout component not looking good on the docs **
  *Symptoms*: The `Cutout` component is not looking exactly like we want, this is probably related to styling and might be a good opportunity for a first contribution.  Current looking: <img width="350" alt="Screen Shot 2020-10-06 at 09 53 09" src="https://user-images.githubusercontent.com/17226904/95204153-14d8dc00-07ba-11eb-95c7-22507beda989.png">  Expected looking (you can check [storybook](https://storybook.react95.io/?path=/story/cutout--default)): <img width="396" alt="Screen Shot 2020-10-06 at 09 52 45" src="https://user-images.githubusercontent.com/17226904/95204112-07235680-07ba-11eb-990c-a1badc12e705.png">  ### How to reproduce: 1. Fork and clone the repo 2. Install the necessary dependêncies using npm (run `npm i` on the root folder)  3. Start docs locally by running `npm run docs:dev`, this will start a local server running the documentation on `http://localhost:3000/` 4. Navigate to the `Cutout` component through the Menu (Components > Cutout)  ### Aditional information This documentation was written using [Docz](https://www.docz.site) and we structured it following the [colocation](https://kentcdodds.com/blog/colocation) idea, so every component folder has its own documentation file, and everything generally related to the documentation can be found at the `docs/` folder _or_ (this is a known problem) `src/gatsby-theme-docz` that has some Docz only related files used to extend the documentation behavior.  ---   Before start working on this bug leave a comme
  **Post-Mortem & Fix Analysis**:
  > Hello, can I work on it?
  > @branopuzder Of course, thank you! Feel free to drop questions/comments here if you need anything 🚀 
  > Hey there. I've found the problem and fixed it. Should I run `npm run docs:build` before creating a PR or will it be done on Github? Sorry for asking such a question, I'm quite new into it.

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

### Incident Patch 1: `871d5335` (2023-04-09)
**Commit Message**: fix(Button): active button focus outline

bug fix: active button focus issue resolved

removed !active flag from line 167.

bug fix: "Active" button not getting focused state

**File**: `src/Button/Button.tsx` (modified, +1/-1)
```diff
@@ -164,7 +164,7 @@ export const StyledButton = styled.button<StyledButtonProps>`
           }
           &:focus:after,
           &:active:after {
-            ${!active && !disabled && focusOutline}
+            ${!disabled && focusOutline}
             outline-offset: -8px;
           }
           &:active:focus:after,
```

---

### Incident Patch 2: `8d8a376a` (2023-03-01)
**Commit Message**: docs(storybook): fix styling order

Fixed styling order in Getting Started docs

**File**: `docs/Getting-Started.stories.mdx` (modified, +1/-1)
```diff
@@ -40,6 +40,7 @@ import ms_sans_serif from 'react95/dist/fonts/ms_sans_serif.woff2';
 import ms_sans_serif_bold from 'react95/dist/fonts/ms_sans_serif_bold.woff2';
 
 const GlobalStyles = createGlobalStyle`
+  ${styleReset}
   @font-face {
     font-family: 'ms_sans_serif';
     src: url('${ms_sans_serif}') format('woff2');
@@ -55,7 +56,6 @@ const GlobalStyles = createGlobalStyle`
   body, input, select, textarea {
     font-family: 'ms_sans_serif';
   }
-  ${styleReset}
 `;
 
 const App = () => (
```

---

### Incident Patch 3: `17973d56` (2023-01-09)
**Commit Message**: build(deps): bump loader-utils from 1.4.0 to 1.4.2

Bumps [loader-utils](https://github.com/webpack/loader-utils) from 1.4.0 to 1.4.2.
- [Release notes](https://github.com/webpack/loader-utils/releases)
- [Changelog](https://github.com/webpack/loader-utils/blob/v1.4.2/CHANGELOG.md)
- [Commits](https://github.com/webpack/loader-utils/compare/v1.4.0...v1.4.2)

---
updated-dependencies:
- dependency-name: loader-utils
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `yarn.lock` (modified, +3/-3)
```diff
@@ -11154,9 +11154,9 @@ loader-runner@^4.2.0:
   integrity sha512-3R/1M+yS3j5ou80Me59j7F9IMs4PXs3VqRrm0TU3AbKPxlmpoY1TNscJV/oGJXo8qCatFGTfDbY6W6ipGOYXfg==
 
 loader-utils@^1.2.3:
-  version "1.4.0"
-  resolved "https://registry.yarnpkg.com/loader-utils/-/loader-utils-1.4.0.tgz#c579b5e34cb34b1a74edc6c1fb36bfa371d5a613"
-  integrity sha512-qH0WSMBtn/oHuwjy/NucEgbx5dbxxnxup9s4PVXJUDHZBQY+s0NWA9rJf53RBnQZxfch7euUui7hpoAPvALZdA==
+  version "1.4.2"
+  resolved "https://registry.yarnpkg.com/loader-utils/-/loader-utils-1.4.2.tgz#29a957f3a63973883eb684f10ffd3d151fec01a3"
+  integrity sha512-I5d00Pd/jwMD2QCduo657+YM/6L3KZu++pmX9VFncxaxvHcru9jx1lBaFft+r4Mt2jK0Yhp41XlRAihzPxHNCg==
   dependencies:
     big.js "^5.2.2"
     emojis-list "^3.0.0"
```

---

### Incident Patch 4: `0598172b` (2023-01-09)
**Commit Message**: build(deps): bump vm2 from 3.9.10 to 3.9.11

Bumps [vm2](https://github.com/patriksimek/vm2) from 3.9.10 to 3.9.11.
- [Release notes](https://github.com/patriksimek/vm2/releases)
- [Changelog](https://github.com/patriksimek/vm2/blob/master/CHANGELOG.md)
- [Commits](https://github.com/patriksimek/vm2/compare/3.9.10...3.9.11)

---
updated-dependencies:
- dependency-name: vm2
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `yarn.lock` (modified, +6/-6)
```diff
@@ -3922,9 +3922,9 @@ acorn@^7.1.1, acorn@^7.4.1:
   integrity sha512-nQyp0o1/mNdbTO1PO6kHkwSrmgZ0MT/jCCpNiwbUjGoRN4dlBhqJtoQuCnEOKzgTVwg0ZWiCoQy6SxMebQVh8A==
 
 acorn@^8.4.1, acorn@^8.5.0, acorn@^8.7.0, acorn@^8.7.1, acorn@^8.8.0:
-  version "8.8.0"
-  resolved "https://registry.yarnpkg.com/acorn/-/acorn-8.8.0.tgz#88c0187620435c7f6015803f5539dae05a9dbea8"
-  integrity sha512-QOxyigPVrpZ2GXT+PFyZTl6TtOFc5egxHIP9IlQ+RbupQuX4RkT/Bee4/kQuC02Xkzg84JcT7oLYtDIQxp+v7w==
+  version "8.8.1"
+  resolved "https://registry.yarnpkg.com/acorn/-/acorn-8.8.1.tgz#0a3f9cbecc4ec3bea6f0a80b66ae8dd2da250b73"
+  integrity sha512-7zFpHzhnqYKrkYdUjF1HI1bzd0VygEGX8lFk4k5zVMqHEoES+P+7TKI+EvLO9WVMJ8eekdO0aDEK044xTXwPPA==
 
 address@^1.0.1:
   version "1.2.0"
@@ -16540,9 +16540,9 @@ vm-browserify@^1.0.1:
   integrity sha512-2ham8XPWTONajOR0ohOKOHXkm3+gaBmGut3SRuu75xLd/RRaY6vqgh8NBYYk7+RW3u5AtzPQZG8F10LHkl0lAQ==
 
 vm2@^3.9.8:
-  version "3.9.10"
-  resolved "https://registry.yarnpkg.com/vm2/-/vm2-3.9.10.tgz#c66543096b5c44c8861a6465805c23c7cc996a44"
-  integrity sha512-AuECTSvwu2OHLAZYhG716YzwodKCIJxB6u1zG7PgSQwIgAlEaoXH52bxdcvT8GkGjnYK7r7yWDW0m0sOsPuBjQ==
+  version "3.9.13"
+  resolved "https://registry.yarnpkg.com/vm2/-/vm2-3.9.13.tgz#774a1a3d73b9b90b1aa45bcc5f25e349f2eef649"
+  integrity sha512-0rvxpB8P8Shm4wX2EKOiMp7H2zq+HUE/UwodY0pCZXs9IffIKZq6vUti5OgkVCTakKo9e/fgO4X1fkwfjWxE3Q==
   dependencies:
     acorn "^8.7.0"
     acorn-walk "^8.2.0"
```

---

### Incident Patch 5: `dad0e7bb` (2023-01-09)
**Commit Message**: build(deps): bump json5 from 1.0.1 to 1.0.2

Bumps [json5](https://github.com/json5/json5) from 1.0.1 to 1.0.2.
- [Release notes](https://github.com/json5/json5/releases)
- [Changelog](https://github.com/json5/json5/blob/main/CHANGELOG.md)
- [Commits](https://github.com/json5/json5/compare/v1.0.1...v1.0.2)

---
updated-dependencies:
- dependency-name: json5
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `yarn.lock` (modified, +9/-4)
```diff
@@ -10711,9 +10711,9 @@ json-stringify-safe@^5.0.1, json-stringify-safe@~5.0.1:
   integrity sha512-ZClg6AaYvamvYEE82d3Iyd3vSSIjQ+odgjaTzRuO3s7toCdFKczob2i0zCh7JE8kWn17yvAWhUVxvqGwUalsRA==
 
 json5@^1.0.1:
-  version "1.0.1"
-  resolved "https://registry.yarnpkg.com/json5/-/json5-1.0.1.tgz#779fb0018604fa854eacbf6252180d83543e3dbe"
-  integrity sha512-aKS4WQjPenRxiQsC93MNfjx+nbF4PAdYzmd/1JIj8HYzqfbu86beTuNgXDzPknWk0n0uARlyewZo4s++ES36Ow==
+  version "1.0.2"
+  resolved "https://registry.yarnpkg.com/json5/-/json5-1.0.2.tgz#63d98d60f21b313b77c4d6da18bfa69d80e1d593"
+  integrity sha512-g1MWMLBiz8FKi1e4w0UyVL3w+iJceWAFBAaBnnGKOpNa5f8TLktkbre1+s6oICydWAm+HRUGTmI+//xv2hvXYA==
   dependencies:
     minimist "^1.2.0"
 
@@ -11865,11 +11865,16 @@ minimist-options@4.1.0:
     is-plain-obj "^1.1.0"
     kind-of "^6.0.3"
 
-minimist@1.2.6, minimist@^1.1.1, minimist@^1.1.3, minimist@^1.2.0, minimist@^1.2.5, minimist@^1.2.6:
+minimist@1.2.6:
   version "1.2.6"
   resolved "https://registry.yarnpkg.com/minimist/-/minimist-1.2.6.tgz#8637a5b759ea0d6e98702cfb3a9283323c93af44"
   integrity sha512-Jsjnk4bw3YJqYzbdyBiNsPWHPfO++UGG749Cxs6peCu5Xg4nrena6OVxOYxrQTqww0Jmwt+Ref8rggumkTLz9Q==
 
+minimist@^1.1.1, minimist@^1.1.3, minimist@^1.2.0, minimist@^1.2.5, minimist@^1.2.6:
+  version "1.2.7"
+  resolved "https://registry.yarnpkg.com/minimist/-/minimist-1.2.7.tgz#daa1c4d91f507390437c6a8bc01078e7000c4d18"
+  integrity sha512-bzfL1YUZsP41gmu/qjrEk0Q6i2ix/cVeAhbCbqH9u3zYutS1cLg00qhrD0M2MVdCcx4Sc0UpP2eBWo9rotpq6g==
+
 minipass-collect@^1.0.2:
   version "1.0.2"
   resolved "https://registry.yarnpkg.com/minipass-collect/-/minipass-collect-1.0.2.tgz#22b813bf745dc6edba2576b940022ad6edc8c617"
```

---

### Incident Patch 6: `c76f191e` (2022-11-10)
**Commit Message**: fix(radio): remove 'menu' variant

BREAKING CHANGE: remove 'menu' variant of Radio component

**File**: `src/Radio/Radio.stories.tsx` (modified, +2/-74)
```diff
@@ -1,15 +1,6 @@
 import { ComponentMeta } from '@storybook/react';
 import React, { useState } from 'react';
-import {
-  GroupBox,
-  MenuList,
-  MenuListItem,
-  Radio,
-  ScrollView,
-  Separator,
-  Window,
-  WindowContent
-} from 'react95';
+import { GroupBox, Radio, ScrollView, Window, WindowContent } from 'react95';
 import styled from 'styled-components';
 
 const Wrapper = styled.div`
@@ -25,6 +16,7 @@ const Wrapper = styled.div`
     }
   }
 `;
+
 export default {
   title: 'Controls/Radio',
   component: Radio,
@@ -143,67 +135,3 @@ export function Flat() {
 Flat.story = {
   name: 'flat'
 };
-
-export function Menu() {
-  const [state, setState] = useState({
-    tool: 'Brush',
-    color: 'Black'
-  });
-  const handleToolChange = (e: React.ChangeEvent<HTMLInputElement>) =>
-    setState({ ...state, tool: e.target.value });
-  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) =>
-    setState({ ...state, color: e.target.value });
-
-  const { tool, color } = state;
-
-  return (
-    <MenuList>
-      <MenuListItem size='sm'>
-        <Radio
-          variant='menu'
-          checked={tool === 'Brush'}
-          onChange={handleToolChange}
-          value='Brush'
-          label='Brush'
-          name='tool'
-        />
-      </MenuListItem>
-      <MenuListItem size='sm'>
-        <Radio
-          variant='menu'
-          checked={tool === 'Pencil'}
-          onChange={handleToolChange}
-          value='Pencil'
-          label='Pencil'
-          name='tool'
-        />
-      </MenuListItem>
-      <Separator />
-      <MenuListItem size='sm' disabled>
-        <Radio
-          disabled
-          variant='menu'
-          checked={color === 'Black'}
-          onChange={handleColorChange}
-          value='Black'
-          label='Black'
-          name='color'
-        />
-      </MenuListItem>
-      <MenuListItem size='sm' disabled>
-        <Radio
-          disabled
-          variant='menu'
-          checked={color === 'Red'}
-          onChange={handleColorChange}
-          value='Red'
-          label='Red'
-          name='color'
-        />
-      </MenuListItem>
-    </MenuList>
-  );
-}
-Menu.story = {
-  name: 'menu'
-};
```

**File**: `src/Radio/Radio.tsx` (modified, +4/-35)
```diff
@@ -8,11 +8,10 @@ import {
   StyledInput,
   StyledLabel
 } from '../common/SwitchBase';
-import { StyledMenuListItem } from '../MenuList/MenuList';
 import { StyledScrollView } from '../ScrollView/ScrollView';
 import { CommonStyledProps } from '../types';
 
-type RadioVariant = 'default' | 'flat' | 'menu';
+type RadioVariant = 'default' | 'flat';
 
 type RadioProps = {
   checked?: boolean;
@@ -78,15 +77,6 @@ const StyledFlatCheckbox = styled.div<StyledCheckboxProps>`
     border-radius: 50%;
   }
 `;
-const StyledMenuCheckbox = styled.div`
-  ${sharedCheckboxStyles}
-  position: relative;
-  display: inline-block;
-  box-sizing: border-box;
-  border: none;
-  outline: none;
-  background: none;
-`;
 
 type IconProps = {
   'data-testid': 'checkmarkIcon';
@@ -106,34 +96,13 @@ const Icon = styled.span.attrs(() => ({
   height: 6px;
   transform: translate(-50%, -50%);
   border-radius: 50%;
-  ${({ $disabled, theme, variant }) =>
-    variant === 'menu'
-      ? css`
-          background: ${$disabled
-            ? theme.materialTextDisabled
-            : theme.materialText};
-          filter: drop-shadow(
-            1px 1px 0px
-              ${$disabled ? theme.materialTextDisabledShadow : 'transparent'}
-          );
-        `
-      : css`
-          background: ${$disabled ? theme.checkmarkDisabled : theme.checkmark};
-        `}
-  ${StyledMenuListItem}:hover & {
-    ${({ $disabled, theme, variant }) =>
-      !$disabled &&
-      variant === 'menu' &&
-      css`
-        background: ${theme.materialTextInvert};
-      `};
-  }
+  background: ${p =>
+    p.$disabled ? p.theme.checkmarkDisabled : p.theme.checkmark};
 `;
 
 const CheckboxComponents = {
   flat: StyledFlatCheckbox,
-  default: StyledCheckbox,
-  menu: StyledMenuCheckbox
+  default: StyledCheckbox
 };
 
 const Radio = forwardRef<HTMLInputElement, RadioProps>(
```

---

### Incident Patch 7: `17eec67f` (2022-11-10)
**Commit Message**: fix(checkbox): remove 'menu' variant

Remove 'menu' variant, as this should be a part of MenuList component

BREAKING CHANGE: Removal of 'menu' Checkbox variant

**File**: `src/Checkbox/Checkbox.stories.tsx` (modified, +1/-49)
```diff
@@ -2,14 +2,7 @@ import React, { useState } from 'react';
 import styled from 'styled-components';
 
 import { ComponentMeta } from '@storybook/react';
-import {
-  Checkbox,
-  GroupBox,
-  MenuList,
-  MenuListItem,
-  ScrollView,
-  Separator
-} from 'react95';
+import { Checkbox, GroupBox, ScrollView } from 'react95';
 
 const Wrapper = styled.div`
   background: ${({ theme }) => theme.material};
@@ -237,44 +230,3 @@ export function Flat() {
 Flat.story = {
   name: 'flat'
 };
-
-export function Menu() {
-  return (
-    <MenuList>
-      <MenuListItem size='md'>
-        <Checkbox
-          name='useGradient'
-          variant='menu'
-          value='useGradient'
-          label='Use gradient'
-          defaultChecked
-        />
-      </MenuListItem>
-      <MenuListItem size='md'>
-        <Checkbox
-          name='thickBrush'
-          variant='menu'
-          defaultChecked={false}
-          value='thickBrush'
-          label='Thick brush'
-          indeterminate
-        />
-      </MenuListItem>
-      <Separator />
-      <MenuListItem size='md' disabled>
-        <Checkbox
-          name='autoSave'
-          variant='menu'
-          value='autoSave'
-          checked
-          label='Auto-save'
-          disabled
-        />
-      </MenuListItem>
-    </MenuList>
-  );
-}
-
-Menu.story = {
-  name: 'menu'
-};
```

**File**: `src/Checkbox/Checkbox.tsx` (modified, +8/-67)
```diff
@@ -10,7 +10,6 @@ import {
   StyledLabel
 } from '../common/SwitchBase';
 import { noOp } from '../common/utils';
-import { StyledMenuListItem } from '../MenuList/MenuList';
 import { StyledScrollView } from '../ScrollView/ScrollView';
 import { CommonThemeProps } from '../types';
 
@@ -25,7 +24,7 @@ type CheckboxProps = {
   onChange?: React.ChangeEventHandler<HTMLInputElement>;
   style?: React.CSSProperties;
   value?: number | string;
-  variant?: 'default' | 'flat' | 'menu';
+  variant?: 'default' | 'flat';
 } & Omit<
   React.InputHTMLAttributes<HTMLInputElement>,
   | 'checked'
@@ -41,7 +40,7 @@ type CheckboxProps = {
 
 type CheckmarkProps = {
   $disabled: boolean;
-  variant: 'default' | 'flat' | 'menu';
+  variant: 'default' | 'flat';
 };
 
 const sharedCheckboxStyles = css`
@@ -77,20 +76,6 @@ const StyledFlatCheckbox = styled.div<CommonThemeProps>`
     $disabled ? theme.flatLight : theme.canvas};
 `;
 
-const StyledMenuCheckbox = styled.div<CommonThemeProps>`
-  position: relative;
-  box-sizing: border-box;
-  display: inline-block;
-  background: ${({ $disabled, theme }) =>
-    $disabled ? theme.flatLight : theme.canvas};
-  ${sharedCheckboxStyles}
-  width: ${size - 4}px;
-  height: ${size - 4}px;
-  background: none;
-  border: none;
-  outline: none;
-`;
-
 const CheckmarkIcon = styled.span.attrs(() => ({
   'data-testid': 'checkmarkIcon'
 }))<CheckmarkProps>`
@@ -113,30 +98,8 @@ const CheckmarkIcon = styled.span.attrs(() => ({
     border-width: 0 3px 3px 0;
     transform: translate(-50%, -50%) rotate(45deg);
 
-    ${({ $disabled, theme, variant }) =>
-      variant === 'menu'
-        ? css`
-            border-color: ${$disabled
-              ? theme.materialTextDisabled
-              : theme.materialText};
-            filter: drop-shadow(
-              1px 1px 0px
-                ${$disabled ? theme.materialTextDisabledShadow : 'transparent'}
-            );
-          `
-        : css`
-            border-color: ${$disabled
-              ? theme.checkmarkDisabled
-              : theme.checkmark};
-          `}
-    ${StyledMenuListItem}:hover & {
-      ${({ $disabled, theme, variant }) =>
-        !$disabled &&
-        variant === 'menu' &&
-        css`
-          border-color: ${theme.materialTextInvert};
-        `};
-    }
+    border-color: ${p =>
+      p.$disabled ? p.theme.checkmarkDisabled : p.theme.checkmark};
   }
 `;
 const IndeterminateIcon = styled.span.attrs(() => ({
@@ -145,16 +108,9 @@ const IndeterminateIcon = styled.span.attrs(() => ({
   display: inline-block;
   position: relative;
 
-  ${({ variant }) =>
-    variant === 'menu'
-      ? css`
-          height: calc(100% - 4px);
-          width: calc(100% - 4px);
-        `
-      : css`
-          width: 100%;
-          height: 100%;
-        `}
+  width: 100%;
+  height: 100%;
+
   &:after {
     content: '';
     display: block;
@@ -167,27 +123,12 @@ const IndeterminateIcon = styled.span.attrs(() => ({
         mainColor: $disabled ? theme.checkmarkDisabled : theme.checkmark
       })}
     background-position: 0px 0px, 2px 2px;
-
-    ${({ $disabled, theme, variant }) =>
-      variant === 'menu' &&
-      css`
-        ${StyledMenuListItem}:hover & {
-          ${createHatchedBackground({
-            mainColor: theme.materialTextInvert
-          })}
-        }
-        filter: drop-shadow(
-          1px 1px 0px
-            ${$disabled ? theme.materialTextDisabledShadow : 'transparent'}
-        );
-      `};
   }
 `;
 
 const CheckboxComponents = {
   flat: StyledFlatCheckbox,
-  default: StyledCheckbox,
-  menu: StyledMenuCheckbox
+  default: StyledCheckbox
 };
 
 const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
```

---

### Incident Patch 8: `f5047a01` (2022-11-10)
**Commit Message**: style(textinput.stories): fix typo in file name



---

### Incident Patch 9: `ec6f3924` (2022-11-10)
**Commit Message**: fix(numberinput): pass otherProps down to the wrapper

**File**: `src/NumberInput/NumberInput.tsx` (modified, +3/-1)
```diff
@@ -104,7 +104,8 @@ const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
       style,
       value,
       variant = 'default',
-      width
+      width,
+      ...otherProps
     },
     ref
   ) => {
@@ -160,6 +161,7 @@ const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
           ...style,
           width: width !== undefined ? getSize(width) : 'auto'
         }}
+        {...otherProps}
       >
         <TextInput
           value={valueDerived}
```

---

### Incident Patch 10: `390edd87` (2022-11-09)
**Commit Message**: fix(tabs): pass 'value' as first argument in 'onChange'

**File**: `src/Tabs/Tab.tsx` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ import { CommonStyledProps } from '../types';
 type TabProps = {
   children?: React.ReactNode;
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
-  onClick?: (event: React.MouseEvent<HTMLButtonElement>, value: any) => void;
+  onClick?: (value: any, event: React.MouseEvent<HTMLButtonElement>) => void;
   selected?: boolean;
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   value?: any;
@@ -76,7 +76,7 @@ const Tab = forwardRef<HTMLButtonElement, TabProps>(
         aria-selected={selected}
         selected={selected}
         onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
-          onClick?.(e, value)
+          onClick?.(value, e)
         }
         ref={ref}
         role='tab'
```

**File**: `src/Tabs/Tabs.spec.tsx` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ describe('<Tabs />', () => {
 
       fireEvent.click(getAllByRole('tab')[1]);
       expect(handleChange).toBeCalledTimes(1);
-      expect(handleChange.mock.calls[0][1]).toBe(1);
+      expect(handleChange.mock.calls[0][0]).toBe(1);
     });
   });
 
```

**File**: `src/Tabs/Tabs.stories.tsx` (modified, +7/-7)
```diff
@@ -32,9 +32,12 @@ export function Default() {
   });
 
   const handleChange = (
-    _: React.MouseEvent<HTMLButtonElement>,
-    value: number
-  ) => setState({ activeTab: value });
+    value: number,
+    event: React.MouseEvent<HTMLButtonElement>
+  ) => {
+    console.log({ value, event });
+    setState({ activeTab: value });
+  };
 
   const { activeTab } = state;
   return (
@@ -88,10 +91,7 @@ export function MultiRow() {
     activeTab: 'Shoes'
   });
 
-  const handleChange = (
-    _: React.MouseEvent<HTMLButtonElement>,
-    value: string
-  ) => setState({ activeTab: value });
+  const handleChange = (value: string) => setState({ activeTab: value });
 
   const { activeTab } = state;
   return (
```

---

### Incident Patch 11: `0471ccba` (2022-11-09)
**Commit Message**: fix(checkbox): add missing semicolon in styles

**File**: `src/Checkbox/Checkbox.tsx` (modified, +9/-8)
```diff
@@ -22,7 +22,7 @@ type CheckboxProps = {
   indeterminate?: boolean;
   label?: number | string;
   name?: string;
-  onChange?: React.InputHTMLAttributes<HTMLInputElement>['onChange'];
+  onChange?: React.ChangeEventHandler<HTMLInputElement>;
   style?: React.CSSProperties;
   value?: number | string;
   variant?: 'default' | 'flat' | 'menu';
@@ -129,13 +129,14 @@ const CheckmarkIcon = styled.span.attrs(() => ({
               ? theme.checkmarkDisabled
               : theme.checkmark};
           `}
-  ${StyledMenuListItem}:hover & {
-    ${({ $disabled, theme, variant }) =>
-      !$disabled &&
-      variant === 'menu' &&
-      css`
-        border-color: ${theme.materialTextInvert};
-      `};
+    ${StyledMenuListItem}:hover & {
+      ${({ $disabled, theme, variant }) =>
+        !$disabled &&
+        variant === 'menu' &&
+        css`
+          border-color: ${theme.materialTextInvert};
+        `};
+    }
   }
 `;
 const IndeterminateIcon = styled.span.attrs(() => ({
```

---

### Incident Patch 12: `2c6e1413` (2022-11-09)
**Commit Message**: fix(slider): do not pass event to onChange handlers

**File**: `src/Slider/Slider.spec.tsx` (modified, +2/-2)
```diff
@@ -343,8 +343,8 @@ describe('<Slider />', () => {
       );
 
       expect(handleChange).toHaveBeenCalledTimes(2);
-      expect(handleChange.mock.calls[0][1]).toBe(80);
-      expect(handleChange.mock.calls[1][1]).toBe(78);
+      expect(handleChange.mock.calls[0][0]).toBe(80);
+      expect(handleChange.mock.calls[1][0]).toBe(78);
     });
   });
 
```

**File**: `src/Slider/Slider.stories.tsx` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ export default {
 export function Default() {
   const [state, setState] = React.useState(0);
 
-  const onChange: SliderOnChangeHandler = (_, newValue) => setState(newValue);
+  const onChange: SliderOnChangeHandler = newValue => setState(newValue);
 
   return (
     <div className='row'>
```

**File**: `src/Slider/Slider.tsx` (modified, +7/-14)
```diff
@@ -24,14 +24,7 @@ import { clamp, getSize, roundValueToStep } from '../common/utils';
 import { StyledScrollView } from '../ScrollView/ScrollView';
 import { CommonStyledProps } from '../types';
 
-export type SliderOnChangeHandler = (
-  event:
-    | MouseEvent
-    | React.KeyboardEvent<HTMLSpanElement>
-    | React.MouseEvent<HTMLDivElement>
-    | TouchEvent,
-  value: number
-) => void;
+export type SliderOnChangeHandler = (value: number) => void;
 
 type SliderProps = {
   defaultValue?: number;
@@ -419,8 +412,8 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
         setValueState(newValue);
         setFocusVisible(true);
 
-        onChange?.(event, newValue);
-        onChangeCommitted?.(event, newValue);
+        onChange?.(newValue);
+        onChangeCommitted?.(newValue);
       }
     );
 
@@ -466,7 +459,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
         setValueState(newValue);
         setFocusVisible(true);
 
-        onChange?.(event, newValue);
+        onChange?.(newValue);
       }
     );
 
@@ -480,7 +473,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
 
         const newValue = getNewValue(finger);
 
-        onChangeCommitted?.(event, newValue);
+        onChangeCommitted?.(newValue);
 
         touchId.current = undefined;
 
@@ -505,7 +498,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
         if (finger) {
           const newValue = getNewValue(finger);
           setValueState(newValue);
-          onChange?.(event, newValue);
+          onChange?.(newValue);
         }
 
         const doc = ownerDocument(sliderRef.current);
@@ -530,7 +523,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
       if (finger) {
         const newValue = getNewValue(finger);
         setValueState(newValue);
-        onChange?.(event, newValue);
+        onChange?.(newValue);
       }
 
       const doc = ownerDocument(sliderRef.current);
```

---

### Incident Patch 13: `acaacd8c` (2022-10-30)
**Commit Message**: fix(slider): fix thumb not draggable

fix #357

**File**: `src/Slider/Slider.stories.tsx` (modified, +7/-2)
```diff
@@ -1,6 +1,6 @@
 import { ComponentMeta } from '@storybook/react';
 import React from 'react';
-import { ScrollView, Slider } from 'react95';
+import { ScrollView, Slider, SliderOnChangeHandler } from 'react95';
 import styled from 'styled-components';
 
 const Wrapper = styled.div`
@@ -41,6 +41,10 @@ export default {
 } as ComponentMeta<typeof Slider>;
 
 export function Default() {
+  const [state, setState] = React.useState(0);
+
+  const onChange: SliderOnChangeHandler = (_, newValue) => setState(newValue);
+
   return (
     <div className='row'>
       <div className='col'>
@@ -66,7 +70,8 @@ export function Default() {
           min={0}
           max={6}
           step={1}
-          defaultValue={0}
+          value={state}
+          onChange={onChange}
           marks={[
             { value: 0, label: '0°C' },
             { value: 2, label: '2°C' },
```

**File**: `src/Slider/Slider.tsx` (modified, +44/-68)
```diff
@@ -17,31 +17,31 @@ import {
   createHatchedBackground
 } from '../common';
 import useControlledOrUncontrolled from '../common/hooks/useControlledOrUncontrolled';
+import useEventCallback from '../common/hooks/useEventCallback';
 import useForkRef from '../common/hooks/useForkRef';
 import { useIsFocusVisible } from '../common/hooks/useIsFocusVisible';
 import { clamp, getSize, roundValueToStep } from '../common/utils';
 import { StyledScrollView } from '../ScrollView/ScrollView';
 import { CommonStyledProps } from '../types';
 
+export type SliderOnChangeHandler = (
+  event:
+    | MouseEvent
+    | React.KeyboardEvent<HTMLSpanElement>
+    | React.MouseEvent<HTMLDivElement>
+    | TouchEvent,
+  value: number
+) => void;
+
 type SliderProps = {
   defaultValue?: number;
   disabled?: boolean;
   marks?: boolean | { label?: string; value: number }[];
   max?: number;
   min?: number;
   name?: string;
-  onChange?: (
-    event:
-      | MouseEvent
-      | React.KeyboardEvent<HTMLSpanElement>
-      | React.MouseEvent<HTMLDivElement>
-      | TouchEvent,
-    value: number
-  ) => void;
-  onChangeCommitted?: (
-    event: MouseEvent | React.KeyboardEvent<HTMLSpanElement> | TouchEvent,
-    value: number
-  ) => void;
+  onChange?: SliderOnChangeHandler;
+  onChangeCommitted?: SliderOnChangeHandler;
   onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
   orientation?: 'horizontal' | 'vertical';
   size?: string | number;
@@ -330,21 +330,20 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
     const handleFocusRef = useForkRef(focusVisibleRef, sliderRef);
     const handleRef = useForkRef(ref, handleFocusRef);
 
-    const handleFocus = useCallback(
+    const handleFocus = useEventCallback(
       (event: React.FocusEvent<HTMLSpanElement>) => {
         if (isFocusVisible(event)) {
           setFocusVisible(true);
         }
-      },
-      [isFocusVisible]
+      }
     );
 
-    const handleBlur = useCallback(() => {
+    const handleBlur = useEventCallback(() => {
       if (focusVisible !== false) {
         setFocusVisible(false);
         onBlurVisible();
       }
-    }, [focusVisible, onBlurVisible]);
+    });
 
     const touchId = useRef<number>();
 
@@ -363,7 +362,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
       [marksProp, max, min, step]
     );
 
-    const handleKeyDown = useCallback(
+    const handleKeyDown = useEventCallback(
       (event: React.KeyboardEvent<HTMLSpanElement>) => {
         const tenPercents = (max - min) / 10;
         const marksValues = marks.map(mark => mark.value);
@@ -422,17 +421,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
 
         onChange?.(event, newValue);
         onChangeCommitted?.(event, newValue);
-      },
-      [
-        marks,
-        max,
-        min,
-        onChange,
-        onChangeCommitted,
-        setValueState,
-        step,
-        valueDerived
-      ]
+      }
     );
 
     const getNewValue = useCallback(
@@ -464,7 +453,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
       [marks, max, min, step, vertical]
     );
 
-    const handleTouchMove = useCallback(
+    const handleTouchMove = useEventCallback(
       (event: MouseEvent | TouchEvent) => {
         const finger = trackFinger(event, touchId.current);
 
@@ -478,11 +467,10 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
         setFocusVisible(true);
 
         onChange?.(event, newValue);
-      },
-      [getNewValue, onChange, setValueState]
+      }
     );
 
-    const handleTouchEnd = useCallback(
+    const handleTouchEnd = useEventCallback(
       (event: MouseEvent | TouchEvent) => {
         const finger = trackFinger(event, touchId.current);
 
@@ -501,11 +489,10 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
         doc.removeEventListener('mouseup', handleTouchEnd);
         doc.removeEventListener('touchmove', handleTouchMove);
         doc.removeEventListener('touchend', handleTouchEnd);
-      },
-      [getNewValue, handleTouchMove, onChangeCommitted]
+      }
     );
 
-    const handleMouseDown = useCallback(
+    const handleMouseDown = useEventCallback(
       (event: React.MouseEvent<HTMLDivElement>) => {
         // TODO should we also pass event together with new value to callbacks? (same thing with other input components)
         onMouseDown?.(event);
@@ -524,43 +511,32 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
         const doc = ownerDocument(sliderRef.current);
         doc.addEventListener('mousemove', handleTouchMove);
         doc.addEventListener('mouseup', handleTouchEnd);
-      },
-      [
-        getNewValue,
-        handleTouchEnd,
-        handleTouchMove,
-        onChange,
-        onMouseDown,
-        setValueState
-      ]
+      }
     );
 
-    const handleTouchStart = useCallback(
-      (event: TouchEvent) => {
-        // Workaround as Safari has partial support for touchAction: 'none'.
-        event.pr
```

**File**: `src/common/hooks/useEventCallback.ts` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+import * as React from 'react';
+
+const useEnhancedEffect =
+  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;
+
+/**
+ * https://github.com/facebook/react/issues/14099#issuecomment-440013892
+ */
+export default function useEventCallback<Args extends unknown[], Return>(
+  fn: (...args: Args) => Return
+): (...args: Args) => Return {
+  const ref = React.useRef(fn);
+  useEnhancedEffect(() => {
+    ref.current = fn;
+  });
+  return React.useCallback(
+    (...args: Args) =>
+      // @ts-expect-error hide `this`
+      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
+      (0, ref.current!)(...args),
+    []
+  );
+}
```

---

### Incident Patch 14: `b0517dd7` (2022-10-28)
**Commit Message**: fix(hourglass): accept style prop

**File**: `src/Hourglass/Hourglass.stories.tsx` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ export default {
 } as ComponentMeta<typeof Hourglass>;
 
 export function Default() {
-  return <Hourglass size={32} />;
+  return <Hourglass size={32} style={{ margin: 20 }} />;
 }
 
 Default.story = {
```

**File**: `src/Hourglass/Hourglass.tsx` (modified, +4/-2)
```diff
@@ -1,13 +1,15 @@
 import React, { forwardRef } from 'react';
 import styled from 'styled-components';
 import { getSize } from '../common/utils';
+import { CommonStyledProps } from '../types';
 import base64hourglass from './base64hourglass';
 
 type HourglassProps = {
   size?: string | number;
-};
+} & React.HTMLAttributes<HTMLDivElement> &
+  CommonStyledProps;
 
-const StyledContainer = styled.span<Required<Pick<HourglassProps, 'size'>>>`
+const StyledContainer = styled.div<Required<Pick<HourglassProps, 'size'>>>`
   display: inline-block;
   height: ${({ size }) => getSize(size)};
   width: ${({ size }) => getSize(size)};
```

---

### Incident Patch 15: `2177c67e` (2022-08-10)
**Commit Message**: fix(coverage): fix Jest coverage not properly referencing code points correctly

Code coverage depends on TypeScript sourceMap, which we disabled for builds.

**File**: `jest.config.js` (modified, +3/-4)
```diff
@@ -1,13 +1,12 @@
 module.exports = {
   globals: {
-    extensionsToTreatAsEsm: ['.js'],
     'ts-jest': {
       diagnostics: false,
-      isolatedModules: true,
-      useESM: true
+      isolatedModules: true
     }
   },
-  preset: 'ts-jest/presets/js-with-ts-esm',
+  coverageReporters: ['text', 'html'],
+  preset: 'ts-jest/presets/default-esm',
   setupFilesAfterEnv: ['<rootDir>/test/setup-test.ts'],
   testEnvironment: 'jsdom'
 };
```

**File**: `tsconfig.build.index.json` (modified, +2/-1)
```diff
@@ -3,7 +3,8 @@
   "compilerOptions": {
     "emitDeclarationOnly": true,
     "outDir": "./dist",
-    "rootDir": "./src"
+    "rootDir": "./src",
+    "sourceMap": false
   },
   "include": [
     "types/global.d.ts",
```

**File**: `tsconfig.build.themes.json` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
     "emitDeclarationOnly": true,
     "outDir": "./dist/themes",
     "rootDir": "./src/common/themes",
+    "sourceMap": false
   },
   "include": [
     "src/common/themes/*.ts",
```

**File**: `tsconfig.json` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@
     "resolveJsonModule": true,
     "rootDir": "./",
     "skipLibCheck": true,
-    "sourceMap": false,
+    "sourceMap": true,
     "strict": true,
     "strictFunctionTypes": true,
     "strictNullChecks": true,
```

#### Recent Merged Pull Requests:
- **PR #400** (closed): Phase 1 scaffold 2421418690062196697 (@yethranayeh)
- **PR #385** (closed): build(deps): bump vm2 from 3.9.13 to 3.9.16 (@dependabot[bot])
- **PR #384** (2023-04-24): bug fix: "Active" button not getting focused state (@afzalzbr)
- **PR #382** (closed): build(deps): bump vm2 from 3.9.13 to 3.9.15 (@dependabot[bot])
- **PR #380** (2023-03-02): docs(storybook): fix styling order (@xsu1010)
- **PR #378** (2023-01-09): build(deps): bump json5 from 1.0.1 to 1.0.2 (@dependabot[bot])
- **PR #372** (2023-01-09): build(deps): bump loader-utils from 1.4.0 to 1.4.2 (@dependabot[bot])
- **PR #369** (2022-11-13): Beta (@arturbien)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
