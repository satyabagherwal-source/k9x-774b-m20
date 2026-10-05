# Forensic Learning Record (Deep Inspection): emilkowalski/vaul

> **Canonical Artifact**: `07_PROJECT_LEARNING/emilkowalski-vaul-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/emilkowalski/vaul](https://github.com/emilkowalski/vaul))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T17:46:23.042Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `emilkowalski/vaul`
- **Description**: A drawer component for React.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8629 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/use-controllable-state.ts`
```
// This code comes from https://github.com/radix-ui/primitives/blob/main/packages/react/use-controllable-state/src/useControllableState.tsx

import React from 'react';

type UseControllableStateParams<T> = {
  prop?: T | undefined;
  defaultProp?: T | undefined;
  onChange?: (state: T) => void;
};

type SetStateFn<T> = (prevState?: T) => T;

function useCallbackRef<T extends (...args: any[]) => any>(callback: T | undefined): T {
  const callbackRef = React.useRef(callback);

  React.useEffect(() => {
    callbackRef.current = callback;
  });

  // https://github.com/facebook/react/issues/19240
  return React.useMemo(() => ((...args) => callbackRef.current?.(...args)) as T, []);
}

function useUncontrolledState<T>({ defaultProp, onChange }: Omit<UseControllableStateParams<T>, 'prop'>) {
  const uncontrolledState = React.useState<T | undefined>(defaultProp);
  const [value] = uncontrolledState;
  const prevValueRef = React.useRef(value);
  const handleChange = useCallbackRef(onChange);

  React.useEffect(() => {
    if (prevValueRef.current !== value) {
      handleChange(value as T);
      prevValueRef.current = value;
    }
  }, [value, prevValueRef, handleChange]);

  return uncontrolledState;
}
export function useControllableState<T>({ prop, defaultProp, onChange = () => {} }: UseControllableStateParams<T>) {
  const [uncontrolledProp, setUncontrolledProp] = useUncontrolledState({ defaultProp, onChange });
  const isControlled = prop !== undefined;
  const value = isControlled ? prop : uncontrolledProp;
  const handleChange = useCallbackRef(onChange);

  const setValue: React.Dispatch<React.SetStateAction<T | undefined>> = React.useCallback(
    (nextValue) => {
      if (isControlled) {
        const setter = nextValue as SetStateFn<T>;
        const value = typeof nextValue === 'function' ? setter(prop) : nextValue;
        if (value !== prop) handleChange(value as T);
      } else {
        setUncontrolledProp(nextValue);
      }
    },
    [isControlled, prop, setUncontrolledProp, handleChange],
  );

  return [value, setValue] as const;
}

```

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  root: true,
  // This tells ESLint to load the config from the package `eslint-config-custom`
  extends: ['custom'],
  settings: {
    next: {
      rootDir: ['apps/*/'],
    },
  },
};

```

### Core Architecture Module: `.prettierrc.js`
```
module.exports = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  printWidth: 120,
};

```

### Core Architecture Module: `playwright.config.ts`
```
import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './test',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    trace: 'on-first-retry',
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    cwd: './test',
    reuseExistingServer: !process.env.CI,
  },
  /* Configure projects for major browsers */
  projects: [
    {
      name: 'iPhone',
      use: { ...devices['iPhone 13 Pro'] },
    },
    {
      name: 'Pixel',
      use: { ...devices['Pixel 5'] },
    },
  ],
});

```

### Core Architecture Module: `src/browser.ts`
```
export function isMobileFirefox(): boolean | undefined {
  const userAgent = navigator.userAgent;
  return (
    typeof window !== 'undefined' &&
    ((/Firefox/.test(userAgent) && /Mobile/.test(userAgent)) || // Android Firefox
      /FxiOS/.test(userAgent)) // iOS Firefox
  );
}

export function isMac(): boolean | undefined {
  return testPlatform(/^Mac/);
}

export function isIPhone(): boolean | undefined {
  return testPlatform(/^iPhone/);
}

export function isSafari(): boolean | undefined {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function isIPad(): boolean | undefined {
  return (
    testPlatform(/^iPad/) ||
    // iPadOS 13 lies and says it's a Mac, but we can distinguish by detecting touch support.
    (isMac() && navigator.maxTouchPoints > 1)
  );
}

export function isIOS(): boolean | undefined {
  return isIPhone() || isIPad();
}

export function testPlatform(re: RegExp): boolean | undefined {
  return typeof window !== 'undefined' && window.navigator != null ? re.test(window.navigator.platform) : undefined;
}

```

### Core Architecture Module: `src/constants.ts`
```
export const TRANSITIONS = {
  DURATION: 0.5,
  EASE: [0.32, 0.72, 0, 1],
};

export const VELOCITY_THRESHOLD = 0.4;

export const CLOSE_THRESHOLD = 0.25;

export const SCROLL_LOCK_TIMEOUT = 100;

export const BORDER_RADIUS = 8;

export const NESTED_DISPLACEMENT = 16;

export const WINDOW_TOP_OFFSET = 26;

export const DRAG_CLASS = 'vaul-dragging';

```

### Core Architecture Module: `src/context.ts`
```
import React from 'react';
import { DrawerDirection } from './types';

interface DrawerContextValue {
  drawerRef: React.RefObject<HTMLDivElement>;
  overlayRef: React.RefObject<HTMLDivElement>;
  onPress: (event: React.PointerEvent<HTMLDivElement>) => void;
  onRelease: (event: React.PointerEvent<HTMLDivElement> | null) => void;
  onDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  onNestedDrag: (event: React.PointerEvent<HTMLDivElement>, percentageDragged: number) => void;
  onNestedOpenChange: (o: boolean) => void;
  onNestedRelease: (event: React.PointerEvent<HTMLDivElement>, open: boolean) => void;
  dismissible: boolean;
  isOpen: boolean;
  isDragging: boolean;
  keyboardIsOpen: React.MutableRefObject<boolean>;
  snapPointsOffset: number[] | null;
  snapPoints?: (number | string)[] | null;
  activeSnapPointIndex?: number | null;
  modal: boolean;
  shouldFade: boolean;
  activeSnapPoint?: number | string | null;
  setActiveSnapPoint: (o: number | string | null) => void;
  closeDrawer: () => void;
  openProp?: boolean;
  onOpenChange?: (o: boolean) => void;
  direction: DrawerDirection;
  shouldScaleBackground: boolean;
  setBackgroundColorOnScale: boolean;
  noBodyStyles: boolean;
  handleOnly?: boolean;
  container?: HTMLElement | null;
  autoFocus?: boolean;
  shouldAnimate?: React.RefObject<boolean>;
}

export const DrawerContext = React.createContext<DrawerContextValue>({
  drawerRef: { current: null },
  overlayRef: { current: null },
  onPress: () => {},
  onRelease: () => {},
  onDrag: () => {},
  onNestedDrag: () => {},
  onNestedOpenChange: () => {},
  onNestedRelease: () => {},
  openProp: undefined,
  dismissible: false,
  isOpen: false,
  isDragging: false,
  keyboardIsOpen: { current: false },
  snapPointsOffset: null,
  snapPoints: null,
  handleOnly: false,
  modal: false,
  shouldFade: false,
  activeSnapPoint: null,
  onOpenChange: () => {},
  setActiveSnapPoint: () => {},
  closeDrawer: () => {},
  direction: 'bottom',
  shouldAnimate: { current: true },
  shouldScaleBackground: false,
  setBackgroundColorOnScale: true,
  noBodyStyles: false,
  container: null,
  autoFocus: false,
});

export const useDrawerContext = () => {
  const context = React.useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawerContext must be used within a Drawer.Root');
  }
  return context;
};

```

### Core Architecture Module: `src/helpers.ts`
```
import { AnyFunction, DrawerDirection } from './types';

interface Style {
  [key: string]: string;
}

const cache = new WeakMap();

export function isInView(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();

  if (!window.visualViewport) return false;

  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    // Need + 40 for safari detection
    rect.bottom <= window.visualViewport.height - 40 &&
    rect.right <= window.visualViewport.width
  );
}

export function set(el: Element | HTMLElement | null | undefined, styles: Style, ignoreCache = false) {
  if (!el || !(el instanceof HTMLElement)) return;
  let originalStyles: Style = {};

  Object.entries(styles).forEach(([key, value]: [string, string]) => {
    if (key.startsWith('--')) {
      el.style.setProperty(key, value);
      return;
    }

    originalStyles[key] = (el.style as any)[key];
    (el.style as any)[key] = value;
  });

  if (ignoreCache) return;

  cache.set(el, originalStyles);
}

export function reset(el: Element | HTMLElement | null, prop?: string) {
  if (!el || !(el instanceof HTMLElement)) return;
  let originalStyles = cache.get(el);

  if (!originalStyles) {
    return;
  }

  if (prop) {
    (el.style as any)[prop] = originalStyles[prop];
  } else {
    Object.entries(originalStyles).forEach(([key, value]) => {
      (el.style as any)[key] = value;
    });
  }
}

export const isVertical = (direction: DrawerDirection) => {
  switch (direction) {
    case 'top':
    case 'bottom':
      return true;
    case 'left':
    case 'right':
      return false;
    default:
      return direction satisfies never;
  }
};

export function getTranslate(element: HTMLElement, direction: DrawerDirection): number | null {
  if (!element) {
    return null;
  }
  const style = window.getComputedStyle(element);
  const transform =
    // @ts-ignore
    style.transform || style.webkitTransform || style.mozTransform;
  let mat = transform.match(/^matrix3d\((.+)\)$/);
  if (mat) {
    // https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix3d
    return parseFloat(mat[1].split(', ')[isVertical(direction) ? 13 : 12]);
  }
  // https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix
  mat = transform.match(/^matrix\((.+)\)$/);
  return mat ? parseFloat(mat[1].split(', ')[isVertical(direction) ? 5 : 4]) : null;
}

export function dampenValue(v: number) {
  return 8 * (Math.log(v + 1) - 2);
}

export function assignStyle(element: HTMLElement | null | undefined, style: Partial<CSSStyleDeclaration>) {
  if (!element) return () => {};

  const prevStyle = element.style.cssText;
  Object.assign(element.style, style);

  return () => {
    element.style.cssText = prevStyle;
  };
}

/**
 * Receives functions as arguments and returns a new function that calls all.
 */
export function chain<T>(...fns: T[]) {
  return (...args: T extends AnyFunction ? Parameters<T> : never) => {
    for (const fn of fns) {
      if (typeof fn === 'function') {
        // @ts-ignore
        fn(...args);
      }
    }
  };
}

```

### Core Architecture Module: `src/index.tsx`
```
'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import React from 'react';
import { DrawerContext, useDrawerContext } from './context';
import './style.css';
import { usePreventScroll, isInput } from './use-prevent-scroll';
import { useComposedRefs } from './use-composed-refs';
import { useSnapPoints } from './use-snap-points';
import { set, getTranslate, dampenValue, isVertical, reset } from './helpers';
import {
  TRANSITIONS,
  VELOCITY_THRESHOLD,
  CLOSE_THRESHOLD,
  SCROLL_LOCK_TIMEOUT,
  BORDER_RADIUS,
  NESTED_DISPLACEMENT,
  WINDOW_TOP_OFFSET,
  DRAG_CLASS,
} from './constants';
import { DrawerDirection } from './types';
import { useControllableState } from './use-controllable-state';
import { useScaleBackground } from './use-scale-background';
import { usePositionFixed } from './use-position-fixed';
import { isIOS, isMobileFirefox } from './browser';

export interface WithFadeFromProps {
  /**
   * Array of numbers from 0 to 100 that corresponds to % of the screen a given snap point should take up.
   * Should go from least visible. Example `[0.2, 0.5, 0.8]`.
   * You can also use px values, which doesn't take screen height into account.
   */
  snapPoints: (number | string)[];
  /**
   * Index of a `snapPoint` from which the overlay fade should be applied. Defaults to the last snap point.
   */
  fadeFromIndex: number;
}

export interface WithoutFadeFromProps {
  /**
   * Array of numbers from 0 to 100 that corresponds to % of the screen a given snap point should take up.
   * Should go from least visible. Example `[0.2, 0.5, 0.8]`.
   * You can also use px values, which doesn't take screen height into account.
   */
  snapPoints?: (number | string)[];
  fadeFromIndex?: never;
}

export type DialogProps = {
  activeSnapPoint?: number | string | null;
  setActiveSnapPoint?: (snapPoint: number | string | null) => void;
  children?: React.ReactNode;
  open?: boolean;
  /**
   * Number between 0 and 1 that determines when the drawer should be closed.
   * Example: threshold of 0.5 would close the drawer if the user swiped for 50% of the height of the drawer or more.
   * @default 0.25
   */
  closeThreshold?: number;
  /**
   * When `true` the `body` doesn't get any styles assigned from Vaul
   */
  noBodyStyles?: boolean;
  onOpenChange?: (open: boolean) => void;
  shouldScaleBackground?: boolean;
  /**
   * When `false` we don't change body's background color when the drawer is open.
   * @default true
   */
  setBackgroundColorOnScale?: boolean;
  /**
   * Duration for which the drawer is not draggable after scrolling content inside of the drawer.
   * @default 500ms
   */
  scrollLockTimeout?: number;
  /**
   * When `true`, don't move the drawer upwards if there's space, but rather only change it's height so it's fully scrollable when the keyboard is open
   */
  fixed?: boolean;
  /**
   * When `true` only allows the drawer to be dragged by the `<Drawer.Handle />` component.
   * @default false
   */
  handleOnly?: boolean;
  /**
   * When `false` dragging, clicking outside, pressing esc, etc. will not close the drawer.
   * Use this in comination with the `open` prop, otherwise you won't be able to open/close the drawer.
   * @default true
   */
  dismissible?: boolean;
  onDrag?: (event: React.PointerEvent<HTMLDivElement>, percentageDragged: number) => void;
  onRelease?: (event: React.PointerEvent<HTMLDivElement>, open: boolean) => void;
  /**
   * When `false` it allows to interact with elements outside of the drawer without closing it.
   * @default true
   */
  modal?: boolean;
  nested?: boolean;
  onClose?: () => void;
  /**
   * Direction of the drawer. Can be `top` or `bottom`, `left`, `right`.
   * @default 'bottom'
   */
  direction?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Opened by default, skips initial enter animation. Still reacts to `open` state changes
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * When set to `true` prevents scrolling on the document body on mount, and restores it on unmount.
   * @default false
   */
  disablePreventScroll?: boolean;
  /**
   * When `true` Vaul will reposition inputs rather than scroll then into view if the keyboard is in the way.
   * Setting it to `false` will fall back to the default browser behavior.
   * @default true when {@link snapPoints} is defined
   */
  repositionInputs?: boolean;
  /**
   * Disabled velocity based swiping for snap points.
   * This means that a snap point won't be skipped even if the velocity is high enough.
   * Useful if each snap point in a drawer is equally important.
   * @default false
   */
  snapToSequentialPoint?: boolean;
  container?: HTMLElement | null;
  /**
   * Gets triggered after the open or close animation ends, it receives an `open` argument with the `open` state of the drawer by the time the function was triggered.
   * Useful to revert any state changes for example.
   */
  onAnimationEnd?: (open: boolean) => void;
  preventScrollRestoration?: boolean;
  autoFocus?: boolean;
} & (WithFadeFromProps | WithoutFadeFromProps);

export function Root({
  open: openProp,
  onOpenChange,
  children,
  onDrag: onDragProp,
  onRelease: onReleaseProp,
  snapPoints,
  shouldScaleBackground = false,
  setBackgroundColorOnScale = true,
  closeThreshold = CLOSE_THRESHOLD,
  scrollLockTimeout = SCROLL_LOCK_TIMEOUT,
  dismissible = true,
  handleOnly = false,
  fadeFromIndex = snapPoints && snapPoints.length - 1,
  activeSnapPoint: activeSnapPointProp,
  setActiveSnapPoint: setActiveSnapPointProp,
  fixed,
  modal = true,
  onClose,
  nested,
  noBodyStyles = false,
  direction = 'bottom',
  defaultOpen = false,
  disablePreventScroll = true,
  snapToSequentialPoint = false,
  preventScrollRestoration = false,
  repositionInputs = true,
  onAnimationEnd,
  container,
  autoFocus = false,
}: DialogProps) {
  const [isOpen = false, setIsOpen] = useControllableState({
    defaultProp: defaultOpen,
    prop: openProp,
    onChange: (o: boolean) => {
      onOpenChange?.(o);

      if (!o && !nested) {
        restorePositionSetting();
      }

      setTimeout(() => {
        onAnimationEnd?.(o);
      }, TRANSITIONS.DURATION * 1000);

      if (o && !modal) {
        if (typeof window !== 'undefined') {
          window.requestAnimationFrame(() => {
            document.body.style.pointerEvents = 'auto';
          });
        }
      }

      if (!o) {
        // This will be removed when the exit animation ends (`500ms`)
        document.body.style.pointerEvents = 'auto';
      }
    },
  });
  const [hasBeenOpened, setHasBeenOpened] = React.useState<boolean>(false);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [justReleased, setJustReleased] = React.useState<boolean>(false);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const openTime = React.useRef<Date | null>(null);
  const dragStartTime = React.useRef<Date | null>(null);
  const dragEndTime = React.useRef<Date | null>(null);
  const lastTimeDragPrevented = React.useRef<Date | null>(null);
  const isAllowedToDrag = React.useRef<boolean>(false);
  const nestedOpenChangeTimer = React.useRef<NodeJS.Timeout | null>(null);
  const pointerStart = React.useRef(0);
  const keyboardIsOpen = React.useRef(false);
  const shouldAnimate = React.useRef(!defaultOpen);
  const previousDiffFromInitial = React.useRef(0);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const drawerHeightRef = React.useRef(drawerRef.current?.getBoundingClientRect().height || 0);
  const drawerWidthRef = React.useRef(drawerRef.current?.getBoundingClientRect().width || 0);
  const initialDrawerHeight = React.useRef(0);

  const onSnapPointChange = React.useCallback((activeSnapPointIndex: number) => {
    // Change openTime ref when we reach the last snap point to prevent dragging for 500ms incase it's scrollable.
    if (snapPoints && activeSnapPointIndex === snapPointsOffset.length - 1) openTime.current = new Date();
  }, []);

  const {
    activeSnapPoint,
    activeSnapPointIndex,
    setActiveSnapPoint,
    onRelease: onReleaseSnapPoints,
    snapPointsOffset,
    onDrag: onDragSnapPoints,
    shouldFade,
    getPercentageDragged: getSnapPointsPercentageDragged,
  } = useSnapPoints({
    snapPoints,
    activeSnapPointProp,
    setActiveSnapPointProp,
    drawerRef,
    fadeFromIndex,
    overlayRef,
    onSnapPointChange,
    direction,
    container,
    snapToSequentialPoint,
  });

  usePreventScroll({
    isDisabled:
      !isOpen || isDragging || !modal || justReleased || !hasBeenOpened || !repositionInputs || !disablePreventScroll,
  });

  const { restorePositionSetting } = usePositionFixed({
    isOpen,
    modal,
    nested: nested ?? false,
    hasBeenOpened,
    preventScrollRestoration,
    noBodyStyles,
  });

  function getScale() {
    return (window.innerWidth - WINDOW_TOP_OFFSET) / window.innerWidth;
  }

  function onPress(event: React.PointerEvent<HTMLDivElement>) {
    if (!dismissible && !snapPoints) return;
    if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) return;

    drawerHeightRef.current = drawerRef.current?.getBoundingClientRect().height || 0;
    drawerWidthRef.current = drawerRef.current?.getBoundingClientRect().width || 0;
    setIsDragging(true);
    dragStartTime.current = new Date();

    // iOS doesn't trigger mouseUp after scrolling so we need to listen to touched in order to disallow dragging
    if (isIOS()) {
      window.addEventListener('touchend', () => (isAllowedToDrag.current = false), { once: true });
    }
    // Ensure we maintain correct pointer capture even when going outside of the drawer
    (event.target as HTMLElement).setPointerCapture(event.pointerId);

    pointerStart.current = isVertical(direction) ? event.pageY : event.pageX;
  }

  function shouldDrag(el: EventTarget, isDraggingInDirection: boolean) {
    let element = el as HTMLElement;
    const highlightedText = window.getSelection()?.toString();

```

### Core Architecture Module: `src/types.ts`
```
export type DrawerDirection = 'top' | 'bottom' | 'left' | 'right';
export interface SnapPoint {
  fraction: number;
  height: number;
}

export type AnyFunction = (...args: any) => any;

```

### Core Architecture Module: `src/use-composed-refs.ts`
```
// This code comes from https://github.com/radix-ui/primitives/tree/main/packages/react/compose-refs

import * as React from 'react';

type PossibleRef<T> = React.Ref<T> | undefined;

/**
 * Set a given ref to a given value
 * This utility takes care of different types of refs: callback refs and RefObject(s)
 */
function setRef<T>(ref: PossibleRef<T>, value: T) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref !== null && ref !== undefined) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

/**
 * A utility to compose multiple refs together
 * Accepts callback refs and RefObject(s)
 */
function composeRefs<T>(...refs: PossibleRef<T>[]) {
  return (node: T) => refs.forEach((ref) => setRef(ref, node));
}

/**
 * A custom hook that composes multiple refs
 * Accepts callback refs and RefObject(s)
 */
function useComposedRefs<T>(...refs: PossibleRef<T>[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useCallback(composeRefs(...refs), refs);
}

export { composeRefs, useComposedRefs };

```

### Core Architecture Module: `src/use-position-fixed.ts`
```
import React from 'react';
import { isSafari } from './browser';

let previousBodyPosition: Record<string, string> | null = null;

/**
 * This hook is necessary to prevent buggy behavior on iOS devices (need to test on Android).
 * I won't get into too much detail about what bugs it solves, but so far I've found that setting the body to `position: fixed` is the most reliable way to prevent those bugs.
 * Issues that this hook solves:
 * https://github.com/emilkowalski/vaul/issues/435
 * https://github.com/emilkowalski/vaul/issues/433
 * And more that I discovered, but were just not reported.
 */

export function usePositionFixed({
  isOpen,
  modal,
  nested,
  hasBeenOpened,
  preventScrollRestoration,
  noBodyStyles,
}: {
  isOpen: boolean;
  modal: boolean;
  nested: boolean;
  hasBeenOpened: boolean;
  preventScrollRestoration: boolean;
  noBodyStyles: boolean;
}) {
  const [activeUrl, setActiveUrl] = React.useState(() => (typeof window !== 'undefined' ? window.location.href : ''));
  const scrollPos = React.useRef(0);

  const setPositionFixed = React.useCallback(() => {
    // All browsers on iOS will return true here.
    if (!isSafari()) return;

    // If previousBodyPosition is already set, don't set it again.
    if (previousBodyPosition === null && isOpen && !noBodyStyles) {
      previousBodyPosition = {
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        height: document.body.style.height,
        right: 'unset',
      };

      // Update the dom inside an animation frame
      const { scrollX, innerHeight } = window;

      document.body.style.setProperty('position', 'fixed', 'important');
      Object.assign(document.body.style, {
        top: `${-scrollPos.current}px`,
        left: `${-scrollX}px`,
        right: '0px',
        height: 'auto',
      });

      window.setTimeout(
        () =>
          window.requestAnimationFrame(() => {
            // Attempt to check if the bottom bar appeared due to the position change
            const bottomBarHeight = innerHeight - window.innerHeight;
            if (bottomBarHeight && scrollPos.current >= innerHeight) {
              // Move the content further up so that the bottom bar doesn't hide it
              document.body.style.top = `${-(scrollPos.current + bottomBarHeight)}px`;
            }
          }),
        300,
      );
    }
  }, [isOpen]);

  const restorePositionSetting = React.useCallback(() => {
    // All browsers on iOS will return true here.
    if (!isSafari()) return;

    if (previousBodyPosition !== null && !noBodyStyles) {
      // Convert the position from "px" to Int
      const y = -parseInt(document.body.style.top, 10);
      const x = -parseInt(document.body.style.left, 10);

      // Restore styles
      Object.assign(document.body.style, previousBodyPosition);

      window.requestAnimationFrame(() => {
        if (preventScrollRestoration && activeUrl !== window.location.href) {
          setActiveUrl(window.location.href);
          return;
        }

        window.scrollTo(x, y);
      });

      previousBodyPosition = null;
    }
  }, [activeUrl]);

  React.useEffect(() => {
    function onScroll() {
      scrollPos.current = window.scrollY;
    }

    onScroll();

    window.addEventListener('scroll', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  React.useEffect(() => {
    if (!modal) return;

    return () => {
      if (typeof document === 'undefined') return;

      // Another drawer is opened, safe to ignore the execution
      const hasDrawerOpened = !!document.querySelector('[data-vaul-drawer]');
      if (hasDrawerOpened) return;

      restorePositionSetting();
    };
  }, [modal, restorePositionSetting]);

  React.useEffect(() => {
    if (nested || !hasBeenOpened) return;
    // This is needed to force Safari toolbar to show **before** the drawer starts animating to prevent a gnarly shift from happening
    if (isOpen) {
      // avoid for standalone mode (PWA)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      !isStandalone && setPositionFixed();

      if (!modal) {
        window.setTimeout(() => {
          restorePositionSetting();
        }, 500);
      }
    } else {
      restorePositionSetting();
    }
  }, [isOpen, hasBeenOpened, activeUrl, modal, nested, setPositionFixed, restorePositionSetting]);

  return { restorePositionSetting };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #661** (2026-09-28): **Responsive presentation**
  *Symptoms*: 

- **Issue #650** (2026-06-02): **Mobile keyboard dismiss: panel height not reset when blur fires before visualViewport resize**
  *Symptoms*: ## Environment  - vaul: 1.1.2 - Browsers: iOS Safari, Chrome for Android - Direction: bottom sheet with `repositionInputs` enabled (default)  ## Bug description  When a text input inside the drawer is focused (soft keyboard opens), vaul's `onVisualViewportChange` handler correctly reduces the drawer height and repositions it above the keyboard. However, when the keyboard is dismissed by **tapping outside the input** (which blurs the input first, then fires `visualViewport` resize), the panel stays at the reduced height indefinitely.  ### Root cause  The reset path inside `onVisualViewportChange` (vaul 1.1.2, line ~1117) is gated by:  ```js if (isInput(focusedElement) || keyboardIsOpen.current) { ```  When the user taps outside the drawer to dismiss the keyboard: 1. The blur event fires, clearing `document.activeElement` → `body` 2. The `onPointerDownOutside` handler runs and explicitly sets `keyboardIsOpen.current = false` 3. `visualViewport` fires the `resize` event  At step 3, both conditions are now false: - `isInput(document.activeElement)` → false (active element is `body`) - `keyboardIsOpen.current` → false (just cleared by `onPointerDownOutside`)  So the entire block is skipped and `drawerRef.current.style.height` is never reset to `initialDrawerHeight.current`.  ## Companion bug: overlay appears enlarged  When the keyboard opens, vaul repositions the drawer panel upward (`style.bottom = keyboardHeight + "px"`). The `Drawer.Overlay` remains `position: fixed; inset: 0` 

- **Issue #639** (2026-01-11): **iOS 26 Chrome (mobile) - Issue due to URL shrinking on scroll**
  *Symptoms*: Since updating to iOS 26, the shrinkage of the URL when you scroll down is causing any full screen components to break i.e. Gap at the bottom and now I found that the drawer interaction is broken also. Anyone able to solve this or is this something we should just wait for Chrome to fix (Seems to be fixed on Safari)?  Issue: When you scroll down the browser, the URL shrinks causing the view height to change. When opening the drawer with a shrunk URL, the drawer content is automatically zoomed in due to this view height change. Upon closing the drawer, scroll position is automatically back to the top.  https://github.com/user-attachments/assets/7e1f2469-7320-481c-b864-eaaf0c158451   Solutions attempted: - Applying height dvh and overflow: hidden to the body. The scrolling is then applied on the container of the children instead. Doing so makes the URL not shrink for the entire application. This solves the zoom in issue but the scroll position does not persists after drawer close which is also as important.
  **Post-Mortem & Fix Analysis**:
  > okay I seem to have fixed it by adding a min-h-dvh on the DrawerOverlay component instead.

- **Issue #637** (2025-12-19): **Fix playwright action**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Sorry, this was meant to be a pull request on the fork 🤦🏼 Late night coding is not conductive to good git workflows

- **Issue #622** (2025-10-20): **Scrolls to top on dismissal (Interact with background example code)**
  *Symptoms*: Upon drawer dismissal the webpage always scrolls to top. During debugging, I tried to create a minimal example. Turns out you can just copy the example code from the docs to get this issue.   Copy the example code for [Interact with background](https://vaul.emilkowal.ski/snap-points#interact-with-background) and paste it into a brand new nextjs project page. Add a div that is 300vh long to test it.  Open the drawer, scroll down and then dismiss the drawer, the webpage always scrolls to top.  Tested in Brave and Safari.  Doesn't behave that way in the example on the docs website.  Any ideas?   Update:  Upon further investigating: This only happens when dismissing by dragging the drawer out of view. When clicking the toggle it doesn't scroll to top. 
  **Post-Mortem & Fix Analysis**:
  > Here is the CodeSandbox: https://codesandbox.io/p/github/bigxalx/test-vaul-dismissal/main
  > @bigxalx I couldn't access your codesandox due to permissions, but I believe it's due to the autofocus on trigger on close.  Try using `onOpenAutoFocus={event => event.preventDefault()}` in `<Drawer.Content />`
  > Hey thanks for the reply.  Sandbox should be publicly accessible, tested in incognito tab.  Tried your suggestion, but it didn't fix it. 

- **Issue #621** (2025-09-11): **Create Patch for 1.1.2 Vaul to Support Plaid Keyboard Interactions**
  *Symptoms*: 

- **Issue #618** (2025-08-18): **Integrate luizcieslak**
  *Symptoms*: 

- **Issue #614** (2026-05-18): **issue: exit animation**
  *Symptoms*:  i have no idea to remove this data.images error while i want the exit animation to work at the same time by removing  {data && (//)}    ```    const open = data !== null;    console.log(open);     return (       <Drawer.Root open={open} onOpenChange={handleClose}>          <Drawer.Portal>             <Drawer.Overlay className="back fixed inset-0 z-20 bg-black/40 backdrop-blur-md" />             {data && (                <Drawer.Content                   aria-describedby={undefined}                   className="fixed right-0 bottom-0 left-0 z-20 mt-24 flex h-fit flex-col rounded-t-[10px] bg-gray-100 outline-none"                >                   <div className="flex-1 rounded-t-[10px] bg-white p-4">                      <div className="mx-auto mb-8 h-1.5 w-12 flex-shrink-0 rounded-full bg-gray-300" />                      <div className="mx-auto max-w-md">                         <Drawer.Title className="mb-4 font-medium text-gray-900">                            A controlled drawer.                         </Drawer.Title>                         <div className="relative size-full bg-black">                            <Image                               src={data.images[0]}                               alt=""                               className="size-full object-contain"                               height={720}                               width={1280}                            />                         </div>                      </div>                   </div> 
  **Post-Mortem & Fix Analysis**:
  > @MuhammadAlim7  It's because you are unmount `Drawer.Content`. Try move `{data && ...` to the div wrapping `Image`
  > done using this onAnimationEnd={(isOpen) => {             if (!isOpen) {                setSelectedItem(null);             }          }}

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

### Incident Patch 1: `ca8ca474` (2025-07-25)
**Commit Message**: fix: Added missing modal prop to Drawer.Root (#580)

* Added missing modal prop for Radix Dialog Root

* Deleted accidental package lock file

**File**: `src/index.tsx` (modified, +1/-0)
```diff
@@ -759,6 +759,7 @@ export function Root({
         setIsOpen(open);
       }}
       open={isOpen}
+      modal={modal}
     >
       <DrawerContext.Provider
         value={{
```

---

### Incident Patch 2: `54b099cf` (2025-03-17)
**Commit Message**: Fix `useCallback` to not be conditionally rendered (#542)

**File**: `src/index.tsx` (modified, +1/-2)
```diff
@@ -804,14 +804,13 @@ export const Overlay = React.forwardRef<HTMLDivElement, React.ComponentPropsWith
     const { overlayRef, snapPoints, onRelease, shouldFade, isOpen, modal, shouldAnimate } = useDrawerContext();
     const composedRef = useComposedRefs(ref, overlayRef);
     const hasSnapPoints = snapPoints && snapPoints.length > 0;
+    const onMouseUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => onRelease(event), [onRelease]);
 
     // Overlay is the component that is locking scroll, removing it will unlock the scroll without having to dig into Radix's Dialog library
     if (!modal) {
       return null;
     }
 
-    const onMouseUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => onRelease(event), [onRelease]);
-
     return (
       <DialogPrimitive.Overlay
         onMouseUp={onMouseUp}
```

---

### Incident Patch 3: `6ba4c44a` (2024-12-13)
**Commit Message**: fix: nested drawer onOpenChange issue (#516)

* fix: nested drawer onOpenChange issue

* Removed useEffect

**File**: `src/index.tsx` (modified, +6/-2)
```diff
@@ -688,7 +688,9 @@ export function Root({
 
     set(drawerRef.current, {
       transition: `transform ${TRANSITIONS.DURATION}s cubic-bezier(${TRANSITIONS.EASE.join(',')})`,
-      transform: isVertical(direction) ? `scale(${scale}) translate3d(0, ${initialTranslate}px, 0)` : `scale(${scale}) translate3d(${initialTranslate}, 0, 0)`,
+      transform: isVertical(direction)
+        ? `scale(${scale}) translate3d(0, ${initialTranslate}px, 0)`
+        : `scale(${scale}) translate3d(${initialTranslate}px, 0, 0)`,
     });
 
     if (!o && drawerRef.current) {
@@ -1093,7 +1095,7 @@ export const Handle = React.forwardRef<HTMLDivElement, HandleProps>(function (
 
 Handle.displayName = 'Drawer.Handle';
 
-export function NestedRoot({ onDrag, onOpenChange, ...rest }: DialogProps) {
+export function NestedRoot({ onDrag, onOpenChange, open: nestedIsOpen, ...rest }: DialogProps) {
   const { onNestedDrag, onNestedOpenChange, onNestedRelease } = useDrawerContext();
 
   if (!onNestedDrag) {
@@ -1103,6 +1105,7 @@ export function NestedRoot({ onDrag, onOpenChange, ...rest }: DialogProps) {
   return (
     <Root
       nested
+      open={nestedIsOpen}
       onClose={() => {
         onNestedOpenChange(false);
       }}
@@ -1114,6 +1117,7 @@ export function NestedRoot({ onDrag, onOpenChange, ...rest }: DialogProps) {
         if (o) {
           onNestedOpenChange(o);
         }
+        onOpenChange?.(o);
       }}
       onRelease={onNestedRelease}
       {...rest}
```

---

### Incident Patch 4: `17a60c59` (2024-11-04)
**Commit Message**: fix: update peer deps for react and react-dom (#504)

**File**: `package.json` (modified, +2/-2)
```diff
@@ -59,8 +59,8 @@
     "typescript": "5.2.2"
   },
   "peerDependencies": {
-    "react": "^16.8 || ^17.0 || ^18.0 || ^19.0",
-    "react-dom": "^16.8 || ^17.0 || ^18.0 || ^19.0"
+    "react": "^16.8 || ^17.0 || ^18.0 || ^19.0.0 || ^19.0.0-rc",
+    "react-dom": "^16.8 || ^17.0 || ^18.0 || ^19.0.0 || ^19.0.0-rc"
   },
   "packageManager": "pnpm@8.8.0",
   "dependencies": {
```

---

### Incident Patch 5: `5bccd2c9` (2024-10-29)
**Commit Message**: fix: initial nested transform (#491)

**File**: `src/index.tsx` (modified, +2/-2)
```diff
@@ -680,15 +680,15 @@ export function Root({
   function onNestedOpenChange(o: boolean) {
     const scale = o ? (window.innerWidth - NESTED_DISPLACEMENT) / window.innerWidth : 1;
 
-    const y = o ? -NESTED_DISPLACEMENT : 0;
+    const initialTranslate = o ? -NESTED_DISPLACEMENT : 0;
 
     if (nestedOpenChangeTimer.current) {
       window.clearTimeout(nestedOpenChangeTimer.current);
     }
 
     set(drawerRef.current, {
       transition: `transform ${TRANSITIONS.DURATION}s cubic-bezier(${TRANSITIONS.EASE.join(',')})`,
-      transform: `scale(${scale}) translate3d(0, ${y}px, 0)`,
+      transform: isVertical(direction) ? `scale(${scale}) translate3d(0, ${initialTranslate}px, 0)` : `scale(${scale}) translate3d(${initialTranslate}, 0, 0)`,
     });
 
     if (!o && drawerRef.current) {
```

---

### Incident Patch 6: `636195cb` (2024-10-13)
**Commit Message**: fix: mobile firefox inputs (#489)

* Fix mobile firefox inputs

* cleanup imports

* remove console log

**File**: `src/browser.ts` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+export function isMobileFirefox(): boolean | undefined {
+  const userAgent = navigator.userAgent;
+  return (
+    typeof window !== 'undefined' &&
+    ((/Firefox/.test(userAgent) && /Mobile/.test(userAgent)) || // Android Firefox
+      /FxiOS/.test(userAgent)) // iOS Firefox
+  );
+}
+
+export function isMac(): boolean | undefined {
+  return testPlatform(/^Mac/);
+}
+
+export function isIPhone(): boolean | undefined {
+  return testPlatform(/^iPhone/);
+}
+
+export function isSafari(): boolean | undefined {
+  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
+}
+
+export function isIPad(): boolean | undefined {
+  return (
+    testPlatform(/^iPad/) ||
+    // iPadOS 13 lies and says it's a Mac, but we can distinguish by detecting touch support.
+    (isMac() && navigator.maxTouchPoints > 1)
+  );
+}
+
+export function isIOS(): boolean | undefined {
+  return isIPhone() || isIPad();
+}
+
+export function testPlatform(re: RegExp): boolean | undefined {
+  return typeof window !== 'undefined' && window.navigator != null ? re.test(window.navigator.platform) : undefined;
+}
```

**File**: `src/index.tsx` (modified, +3/-3)
```diff
@@ -4,7 +4,7 @@ import * as DialogPrimitive from '@radix-ui/react-dialog';
 import React from 'react';
 import { DrawerContext, useDrawerContext } from './context';
 import './style.css';
-import { usePreventScroll, isInput, isIOS } from './use-prevent-scroll';
+import { usePreventScroll, isInput } from './use-prevent-scroll';
 import { useComposedRefs } from './use-composed-refs';
 import { useSnapPoints } from './use-snap-points';
 import { set, getTranslate, dampenValue, isVertical, reset } from './helpers';
@@ -22,6 +22,7 @@ import { DrawerDirection } from './types';
 import { useControllableState } from './use-controllable-state';
 import { useScaleBackground } from './use-scale-background';
 import { usePositionFixed } from './use-position-fixed';
+import { isIOS, isMobileFirefox } from './browser';
 
 export interface WithFadeFromProps {
   /**
@@ -500,7 +501,6 @@ export function Root({
           const activeSnapPointHeight = snapPointsOffset[activeSnapPointIndex] || 0;
           diffFromInitial += activeSnapPointHeight;
         }
-
         previousDiffFromInitial.current = diffFromInitial;
         // We don't have to change the height if the input is in view, when we are here we are in the opened keyboard state so we can correctly check if the input is in view
         if (drawerHeight > visualViewportHeight || keyboardIsOpen.current) {
@@ -516,7 +516,7 @@ export function Root({
           } else {
             drawerRef.current.style.height = `${Math.max(newDrawerHeight, visualViewportHeight - offsetFromTop)}px`;
           }
-        } else {
+        } else if (!isMobileFirefox()) {
           drawerRef.current.style.height = `${initialDrawerHeight.current}px`;
         }
 
```

**File**: `src/use-position-fixed.ts` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 import React from 'react';
-import { isSafari } from './use-prevent-scroll';
+import { isSafari } from './browser';
 
 let previousBodyPosition: Record<string, string> | null = null;
 
```

**File**: `src/use-prevent-scroll.ts` (modified, +1/-28)
```diff
@@ -1,6 +1,7 @@
 // This code comes from https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/overlays/src/usePreventScroll.ts
 
 import { useEffect, useLayoutEffect } from 'react';
+import { isIOS } from './browser';
 
 const KEYBOARD_BUFFER = 24;
 
@@ -22,34 +23,6 @@ function chain(...callbacks: any[]): (...args: any[]) => void {
   };
 }
 
-function isMac(): boolean | undefined {
-  return testPlatform(/^Mac/);
-}
-
-function isIPhone(): boolean | undefined {
-  return testPlatform(/^iPhone/);
-}
-
-export function isSafari(): boolean | undefined {
-  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
-}
-
-function isIPad(): boolean | undefined {
-  return (
-    testPlatform(/^iPad/) ||
-    // iPadOS 13 lies and says it's a Mac, but we can distinguish by detecting touch support.
-    (isMac() && navigator.maxTouchPoints > 1)
-  );
-}
-
-export function isIOS(): boolean | undefined {
-  return isIPhone() || isIPad();
-}
-
-function testPlatform(re: RegExp): boolean | undefined {
-  return typeof window !== 'undefined' && window.navigator != null ? re.test(window.navigator.platform) : undefined;
-}
-
 // @ts-ignore
 const visualViewport = typeof document !== 'undefined' && window.visualViewport;
 
```

---

### Incident Patch 7: `777c19e7` (2024-10-13)
**Commit Message**: fix: don't animate initially if defaultOpen is set to true (#488)

**File**: `src/context.ts` (modified, +2/-0)
```diff
@@ -31,6 +31,7 @@ interface DrawerContextValue {
   handleOnly?: boolean;
   container?: HTMLElement | null;
   autoFocus?: boolean;
+  shouldAnimate?: React.RefObject<boolean>;
 }
 
 export const DrawerContext = React.createContext<DrawerContextValue>({
@@ -57,6 +58,7 @@ export const DrawerContext = React.createContext<DrawerContextValue>({
   setActiveSnapPoint: () => {},
   closeDrawer: () => {},
   direction: 'bottom',
+  shouldAnimate: { current: true },
   shouldScaleBackground: false,
   setBackgroundColorOnScale: true,
   noBodyStyles: false,
```

**File**: `src/index.tsx` (modified, +13/-2)
```diff
@@ -103,7 +103,7 @@ export type DialogProps = {
    */
   direction?: 'top' | 'bottom' | 'left' | 'right';
   /**
-   * Opened by default, still reacts to `open` state changes
+   * Opened by default, skips initial enter animation. Still reacts to `open` state changes
    * @default false
    */
   defaultOpen?: boolean;
@@ -206,6 +206,7 @@ export function Root({
   const nestedOpenChangeTimer = React.useRef<NodeJS.Timeout | null>(null);
   const pointerStart = React.useRef(0);
   const keyboardIsOpen = React.useRef(false);
+  const shouldAnimate = React.useRef(!defaultOpen);
   const previousDiffFromInitial = React.useRef(0);
   const drawerRef = React.useRef<HTMLDivElement>(null);
   const drawerHeightRef = React.useRef(drawerRef.current?.getBoundingClientRect().height || 0);
@@ -465,6 +466,12 @@ export function Root({
     }
   }
 
+  React.useEffect(() => {
+    window.requestAnimationFrame(() => {
+      shouldAnimate.current = true;
+    });
+  }, []);
+
   React.useEffect(() => {
     function onVisualViewportChange() {
       if (!drawerRef.current || !repositionInputs) return;
@@ -763,6 +770,7 @@ export function Root({
           onRelease,
           onDrag,
           dismissible,
+          shouldAnimate,
           handleOnly,
           isOpen,
           isDragging,
@@ -791,7 +799,7 @@ export function Root({
 
 export const Overlay = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
   function ({ ...rest }, ref) {
-    const { overlayRef, snapPoints, onRelease, shouldFade, isOpen, modal } = useDrawerContext();
+    const { overlayRef, snapPoints, onRelease, shouldFade, isOpen, modal, shouldAnimate } = useDrawerContext();
     const composedRef = useComposedRefs(ref, overlayRef);
     const hasSnapPoints = snapPoints && snapPoints.length > 0;
 
@@ -809,6 +817,7 @@ export const Overlay = React.forwardRef<HTMLDivElement, React.ComponentPropsWith
         data-vaul-overlay=""
         data-vaul-snap-points={isOpen && hasSnapPoints ? 'true' : 'false'}
         data-vaul-snap-points-overlay={isOpen && shouldFade ? 'true' : 'false'}
+        data-vaul-animate={shouldAnimate?.current ? 'true' : 'false'}
         {...rest}
       />
     );
@@ -837,6 +846,7 @@ export const Content = React.forwardRef<HTMLDivElement, ContentProps>(function (
     snapPoints,
     container,
     handleOnly,
+    shouldAnimate,
     autoFocus,
   } = useDrawerContext();
   // Needed to use transition instead of animations
@@ -893,6 +903,7 @@ export const Content = React.forwardRef<HTMLDivElement, ContentProps>(function (
       data-vaul-delayed-snap-points={delayedSnapPoints ? 'true' : 'false'}
       data-vaul-snap-points={isOpen && hasSnapPoints ? 'true' : 'false'}
       data-vaul-custom-container={container ? 'true' : 'false'}
+      data-vaul-animate={shouldAnimate?.current ? 'true' : 'false'}
       {...rest}
       ref={composedRef}
       style={
```

**File**: `src/style.css` (modified, +5/-1)
```diff
@@ -47,7 +47,7 @@
 }
 
 [data-vaul-drawer][data-vaul-snap-points='true'][data-vaul-drawer-direction='right'] {
-  transform: translate3d(var(--initial-transform, 100%) %, 0, 0);
+  transform: translate3d(var(--initial-transform, 100%), 0, 0);
 }
 
 [data-vaul-drawer][data-vaul-delayed-snap-points='true'][data-vaul-drawer-direction='top'] {
@@ -77,6 +77,10 @@
   animation-name: fadeOut;
 }
 
+[data-vaul-animate='false'] {
+  animation: none !important;
+}
+
 [data-vaul-overlay][data-vaul-snap-points='true'] {
   opacity: 0;
   transition: opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1);
```

---

### Incident Patch 8: `b5f77dee` (2024-10-13)
**Commit Message**: fix: drawer stuck when changing a <select> option on Desktop Safari (#487)

* Fix drawer stuck on select

* Remove unnecessary test page

**File**: `src/index.tsx` (modified, +5/-0)
```diff
@@ -282,6 +282,11 @@ export function Root({
     const swipeAmount = drawerRef.current ? getTranslate(drawerRef.current, direction) : null;
     const date = new Date();
 
+    // Fixes https://github.com/emilkowalski/vaul/issues/483
+    if (element.tagName === 'SELECT') {
+      return false;
+    }
+
     if (element.hasAttribute('data-vaul-no-drag') || element.closest('[data-vaul-no-drag]')) {
       return false;
     }
```

---

### Incident Patch 9: `56fc33f3` (2024-10-13)
**Commit Message**: feat: add initial transform css variable (#486)

**File**: `src/style.css` (modified, +12/-20)
```diff
@@ -35,19 +35,19 @@
 }
 
 [data-vaul-drawer][data-vaul-snap-points='true'][data-vaul-drawer-direction='bottom'] {
-  transform: translate3d(0, 100%, 0);
+  transform: translate3d(0, var(--initial-transform, 100%), 0);
 }
 
 [data-vaul-drawer][data-vaul-snap-points='true'][data-vaul-drawer-direction='top'] {
-  transform: translate3d(0, -100%, 0);
+  transform: translate3d(0, calc(var(--initial-transform, 100%) * -1), 0);
 }
 
 [data-vaul-drawer][data-vaul-snap-points='true'][data-vaul-drawer-direction='left'] {
-  transform: translate3d(-100%, 0, 0);
+  transform: translate3d(calc(var(--initial-transform, 100%) * -1), 0, 0);
 }
 
 [data-vaul-drawer][data-vaul-snap-points='true'][data-vaul-drawer-direction='right'] {
-  transform: translate3d(100%, 0, 0);
+  transform: translate3d(var(--initial-transform, 100%) %, 0, 0);
 }
 
 [data-vaul-drawer][data-vaul-delayed-snap-points='true'][data-vaul-drawer-direction='top'] {
@@ -176,14 +176,6 @@
   }
 }
 
-/* This will allow us to not animate via animation, but still benefit from delaying unmount via Radix. */
-@keyframes fake-animation {
-  from {
-  }
-  to {
-  }
-}
-
 @keyframes fadeIn {
   from {
     opacity: 0;
@@ -201,7 +193,7 @@
 
 @keyframes slideFromBottom {
   from {
-    transform: translate3d(0, 100%, 0);
+    transform: translate3d(0, var(--initial-transform, 100%), 0);
   }
   to {
     transform: translate3d(0, 0, 0);
@@ -210,13 +202,13 @@
 
 @keyframes slideToBottom {
   to {
-    transform: translate3d(0, 100%, 0);
+    transform: translate3d(0, var(--initial-transform, 100%), 0);
   }
 }
 
 @keyframes slideFromTop {
   from {
-    transform: translate3d(0, -100%, 0);
+    transform: translate3d(0, calc(var(--initial-transform, 100%) * -1), 0);
   }
   to {
     transform: translate3d(0, 0, 0);
@@ -225,13 +217,13 @@
 
 @keyframes slideToTop {
   to {
-    transform: translate3d(0, -100%, 0);
+    transform: translate3d(0, calc(var(--initial-transform, 100%) * -1), 0);
   }
 }
 
 @keyframes slideFromLeft {
   from {
-    transform: translate3d(-100%, 0, 0);
+    transform: translate3d(calc(var(--initial-transform, 100%) * -1), 0, 0);
   }
   to {
     transform: translate3d(0, 0, 0);
@@ -240,13 +232,13 @@
 
 @keyframes slideToLeft {
   to {
-    transform: translate3d(-100%, 0, 0);
+    transform: translate3d(calc(var(--initial-transform, 100%) * -1), 0, 0);
   }
 }
 
 @keyframes slideFromRight {
   from {
-    transform: translate3d(100%, 0, 0);
+    transform: translate3d(var(--initial-transform, 100%), 0, 0);
   }
   to {
     transform: translate3d(0, 0, 0);
@@ -255,6 +247,6 @@
 
 @keyframes slideToRight {
   to {
-    transform: translate3d(100%, 0, 0);
+    transform: translate3d(var(--initial-transform, 100%), 0, 0);
   }
 }
```

**File**: `test/src/app/different-directions/page.tsx` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+'use client';
+
+import clsx from 'clsx';
+import { Drawer, DialogProps } from 'vaul';
+
+function DirectionalDrawer({
+  direction,
+  children,
+}: {
+  direction: DialogProps['direction'];
+  children: React.ReactNode;
+}) {
+  return (
+    <Drawer.Root direction={direction}>
+      <Drawer.Trigger asChild>
+        <button data-testid="trigger" className="text-2xl">
+          {children}
+        </button>
+      </Drawer.Trigger>
+      <Drawer.Portal>
+        <Drawer.Overlay data-testid="overlay" className="fixed inset-0 bg-black/40" />
+        <Drawer.Content
+          data-testid="content"
+          className={clsx('bg-zinc-100 flex flex-col rounded-t-[10px] fixed ', {
+            'bottom-0 mt-24 left-0 right-0 h-[96%]': direction === 'bottom',
+            'top-0 mb-24 left-0 right-0 h-[96%]': direction === 'top',
+            'left-0 top-0 bottom-0 w-[300px] h-full': direction === 'left',
+            'right-0 top-0 bottom-0 w-[300px] h-full': direction === 'right',
+          })}
+        >
+          <Drawer.Close data-testid="drawer-close">Close</Drawer.Close>
+          <button data-testid="controlled-close" className="text-2xl">
+            Close
+          </button>
+          <div className="p-4 bg-white rounded-t-[10px] flex-1">
+            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-300 mb-8" />
+            <div className="max-w-md mx-auto">
+              <Drawer.Title className="font-medium mb-4">Unstyled drawer for React.</Drawer.Title>
+              <p className="text-zinc-600 mb-2">
+                This component can be used as a replacement for a Dialog on mobile and tablet devices.
+              </p>
+              <p className="text-zinc-600 mb-8">
+                It uses{' '}
+                <a
+                  href="https://www.radix-ui.com/docs/primitives/components/dialog"
+                  className="underline"
+                  target="_blank"
+                >
+                  Radix&apos;s Dialog primitive
+                </a>{' '}
+                under the hood and is inspired by{' '}
+                <a
+                  href="https://twitter.com/devongovett/status/1674470185783402496"
+                  className="underline"
+                  target="_blank"
+                >
+                  this tweet.
+                </a>
+              </p>
+            </div>
+          </div>
+          <div className="p-4 bg-zinc-100 border-t border-zinc-200 mt-auto">
+            <div className="flex gap-6 justify-end max-w-md mx-auto">
+              <a
+                className="text-xs text-zinc-600 flex items-center gap-0.25"
+                href="https://github.com/emilkowalski/vaul"
+                target="_blank"
+              >
+                GitHub
+                <svg
+                  fill="none"
+                  height="16"
+                  stroke="currentColor"
+                  strokeLinecap="round"
+                  strokeLinejoin="round"
+                  strokeWidth="2"
+                  viewBox="0 0 24 24"
+                  width="16"
+                  aria-hidden="true"
+                  className="w-3 h-3 ml-1"
+                >
+                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path>
+                  <path d="M15 3h6v6"></path>
+                  <path d="M10 14L21 3"></path>
+                </svg>
+              </a>
+              <a
+                className="text-xs text-zinc-600 flex items-center gap-0.25"
+                href="https://twitter.com/emilkowalski_"
+                target="_blank"
+              >
+                Twitter
+                <svg
+                  fill="none"
+                  height="16"
+                  stroke="currentColor"
+                  strokeLinecap="round"
+                  strokeLinejoin="round"
+                  strokeWidth="2"
+                  viewBox="0 0 24 24"
+                  width="16"
+                  aria-hidden="true"
+                  className="w-3 h-3 ml-1"
+                >
+                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path>
+                  <path d="M15 3h6v6"></path>
+                  <path d="M10 14L21 3"></path>
+                </svg>
+              </a>
+            </div>
+          </div>
+        </Drawer.Content>
+      </Drawer.Portal>
+    </Drawer.Root>
+  );
+}
+
+export default function Page() {
+  return (
+    <div className="w-screen h-screen bg-white p-8 flex justify-center items-center flex-col gap-4">
+      <DirectionalDrawer direction="top">Top</DirectionalDrawer>
+      <DirectionalDrawer direction="right">Right</DirectionalDrawer>
+      <DirectionalDrawer direction="bottom">Bottom</DirectionalDrawer>
+      <DirectionalDrawer direction="left">Left</DirectionalDrawer>
+    </div>
+  );
+}
```

**File**: `test/src/app/page.tsx` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ export default function Page() {
       <Link href="/controlled">Controlled</Link>
       <Link href="/default-open">Default open</Link>
       <Link href="/with-redirect">With redirect</Link>
+      <Link href="/different-directions">Different directions</Link>
     </div>
   );
 }
```

---

### Incident Patch 10: `0261f3dd` (2024-10-13)
**Commit Message**: fix: long press (#485)

* fix long press error

* types

**File**: `src/context.ts` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ interface DrawerContextValue {
   keyboardIsOpen: React.MutableRefObject<boolean>;
   snapPointsOffset: number[] | null;
   snapPoints?: (number | string)[] | null;
-  activeSnapPointIndex?: number;
+  activeSnapPointIndex?: number | null;
   modal: boolean;
   shouldFade: boolean;
   activeSnapPoint?: number | string | null;
```

**File**: `src/index.tsx` (modified, +18/-16)
```diff
@@ -25,8 +25,8 @@ import { usePositionFixed } from './use-position-fixed';
 
 export interface WithFadeFromProps {
   /**
-   * Array of numbers from 0 to 100 that corresponds to % of the screen a given snap point should take up. 
-   * Should go from least visible. Example `[0.2, 0.5, 0.8]`. 
+   * Array of numbers from 0 to 100 that corresponds to % of the screen a given snap point should take up.
+   * Should go from least visible. Example `[0.2, 0.5, 0.8]`.
    * You can also use px values, which doesn't take screen height into account.
    */
   snapPoints: (number | string)[];
@@ -38,8 +38,8 @@ export interface WithFadeFromProps {
 
 export interface WithoutFadeFromProps {
   /**
-   * Array of numbers from 0 to 100 that corresponds to % of the screen a given snap point should take up. 
-   * Should go from least visible. Example `[0.2, 0.5, 0.8]`. 
+   * Array of numbers from 0 to 100 that corresponds to % of the screen a given snap point should take up.
+   * Should go from least visible. Example `[0.2, 0.5, 0.8]`.
    * You can also use px values, which doesn't take screen height into account.
    */
   snapPoints?: (number | string)[];
@@ -52,7 +52,7 @@ export type DialogProps = {
   children?: React.ReactNode;
   open?: boolean;
   /**
-   * Number between 0 and 1 that determines when the drawer should be closed. 
+   * Number between 0 and 1 that determines when the drawer should be closed.
    * Example: threshold of 0.5 would close the drawer if the user swiped for 50% of the height of the drawer or more.
    * @default 0.25
    */
@@ -64,12 +64,12 @@ export type DialogProps = {
   onOpenChange?: (open: boolean) => void;
   shouldScaleBackground?: boolean;
   /**
-   * When `false` we don't change body's background color when the drawer is open. 
+   * When `false` we don't change body's background color when the drawer is open.
    * @default true
    */
   setBackgroundColorOnScale?: boolean;
   /**
-   * Duration for which the drawer is not draggable after scrolling content inside of the drawer. 
+   * Duration for which the drawer is not draggable after scrolling content inside of the drawer.
    * @default 500ms
    */
   scrollLockTimeout?: number;
@@ -78,27 +78,27 @@ export type DialogProps = {
    */
   fixed?: boolean;
   /**
-   * When `true` only allows the drawer to be dragged by the `<Drawer.Handle />` component. 
+   * When `true` only allows the drawer to be dragged by the `<Drawer.Handle />` component.
    * @default false
    */
   handleOnly?: boolean;
   /**
-   * When `false` dragging, clicking outside, pressing esc, etc. will not close the drawer. 
+   * When `false` dragging, clicking outside, pressing esc, etc. will not close the drawer.
    * Use this in comination with the `open` prop, otherwise you won't be able to open/close the drawer.
    * @default true
    */
   dismissible?: boolean;
   onDrag?: (event: React.PointerEvent<HTMLDivElement>, percentageDragged: number) => void;
   onRelease?: (event: React.PointerEvent<HTMLDivElement>, open: boolean) => void;
   /**
-   * When `false` it allows to interact with elements outside of the drawer without closing it. 
+   * When `false` it allows to interact with elements outside of the drawer without closing it.
    * @default true
    */
   modal?: boolean;
   nested?: boolean;
   onClose?: () => void;
   /**
-   * Direction of the drawer. Can be `top` or `bottom`, `left`, `right`. 
+   * Direction of the drawer. Can be `top` or `bottom`, `left`, `right`.
    * @default 'bottom'
    */
   direction?: 'top' | 'bottom' | 'left' | 'right';
@@ -113,21 +113,21 @@ export type DialogProps = {
    */
   disablePreventScroll?: boolean;
   /**
-   * When `true` Vaul will reposition inputs rather than scroll then into view if the keyboard is in the way. 
+   * When `true` Vaul will reposition inputs rather than scroll then into view if the keyboard is in the way.
    * Setting it to `false` will fall back to the default browser behavior.
    * @default true when {@link snapPoints} is defined
    */
   repositionInputs?: boolean;
   /**
-   * Disabled velocity based swiping for snap points. 
-   * This means that a snap point won't be skipped even if the velocity is high enough. 
+   * Disabled velocity based swiping for snap points.
+   * This means that a snap point won't be skipped even if the velocity is high enough.
    * Useful if each snap point in a drawer is equally important.
    * @default false
    */
   snapToSequentialPoint?: boolean;
   container?: HTMLElement | null;
   /**
-   * Gets triggered after the open or close animation ends, it receives an `open` argument with the `open` state of the drawer by the time the function was triggered. 
+   * Gets triggered after the open or close animation ends, it receives an `open` argument with the `open` state of the drawer by the time the function was triggered.
    * Useful to revert any state changes for example.
    */
   onAnimationEnd?: (open: boolean) => void;
@@ -958
```

---

### Incident Patch 11: `e3ba34d6` (2024-10-13)
**Commit Message**: Fix: Ensure drawer opens at the specified active snap point on initial render (#473)

* add activeSnapPointIndex to context type

* passing activeSnapPointIndex to context

* getting and using activeSnapPointIndex from context

* Added back spaces

* added back space

* activeSnapPointIndex fallback

**File**: `src/context.ts` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ interface DrawerContextValue {
   keyboardIsOpen: React.MutableRefObject<boolean>;
   snapPointsOffset: number[] | null;
   snapPoints?: (number | string)[] | null;
+  activeSnapPointIndex?: number;
   modal: boolean;
   shouldFade: boolean;
   activeSnapPoint?: number | string | null;
```

**File**: `src/index.tsx` (modified, +3/-1)
```diff
@@ -769,6 +769,7 @@ export function Root({
           keyboardIsOpen,
           modal,
           snapPointsOffset,
+          activeSnapPointIndex,
           direction,
           shouldScaleBackground,
           setBackgroundColorOnScale,
@@ -824,6 +825,7 @@ export const Content = React.forwardRef<HTMLDivElement, ContentProps>(function (
     onDrag,
     keyboardIsOpen,
     snapPointsOffset,
+    activeSnapPointIndex,
     modal,
     isOpen,
     direction,
@@ -891,7 +893,7 @@ export const Content = React.forwardRef<HTMLDivElement, ContentProps>(function (
       style={
         snapPointsOffset && snapPointsOffset.length > 0
           ? ({
-              '--snap-point-height': `${snapPointsOffset[0]!}px`,
+              '--snap-point-height': `${snapPointsOffset[activeSnapPointIndex ?? 0]!}px`,
               ...style,
             } as React.CSSProperties)
           : style
```

---

### Incident Patch 12: `1a8d000a` (2024-10-13)
**Commit Message**: fix: typescript strict on to prevent null calls (#477)

* fix: typescript strict on to prevent null calls

* fix: restore original code

* fix: restore original code

* fix: onRelease event nullable

**File**: `src/context.ts` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@ interface DrawerContextValue {
   drawerRef: React.RefObject<HTMLDivElement>;
   overlayRef: React.RefObject<HTMLDivElement>;
   onPress: (event: React.PointerEvent<HTMLDivElement>) => void;
-  onRelease: (event: React.PointerEvent<HTMLDivElement>) => void;
+  onRelease: (event: React.PointerEvent<HTMLDivElement> | null) => void;
   onDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
   onNestedDrag: (event: React.PointerEvent<HTMLDivElement>, percentageDragged: number) => void;
   onNestedOpenChange: (o: boolean) => void;
@@ -23,7 +23,7 @@ interface DrawerContextValue {
   closeDrawer: () => void;
   openProp?: boolean;
   onOpenChange?: (o: boolean) => void;
-  direction?: DrawerDirection;
+  direction: DrawerDirection;
   shouldScaleBackground: boolean;
   setBackgroundColorOnScale: boolean;
   noBodyStyles: boolean;
```

**File**: `src/index.tsx` (modified, +20/-10)
```diff
@@ -155,7 +155,7 @@ export function Root({
   modal = true,
   onClose,
   nested,
-  noBodyStyles,
+  noBodyStyles = false,
   direction = 'bottom',
   defaultOpen = false,
   disablePreventScroll = true,
@@ -247,7 +247,7 @@ export function Root({
   const { restorePositionSetting } = usePositionFixed({
     isOpen,
     modal,
-    nested,
+    nested: nested ?? false,
     hasBeenOpened,
     preventScrollRestoration,
     noBodyStyles,
@@ -307,7 +307,11 @@ export function Root({
     }
 
     // Disallow dragging if drawer was scrolled within `scrollLockTimeout`
-    if (date.getTime() - lastTimeDragPrevented.current?.getTime() < scrollLockTimeout && swipeAmount === 0) {
+    if (
+      lastTimeDragPrevented.current &&
+      date.getTime() - lastTimeDragPrevented.current.getTime() < scrollLockTimeout &&
+      swipeAmount === 0
+    ) {
       lastTimeDragPrevented.current = date;
       return false;
     }
@@ -581,7 +585,7 @@ export function Root({
     dragEndTime.current = new Date();
   }
 
-  function onRelease(event: React.PointerEvent<HTMLDivElement>) {
+  function onRelease(event: React.PointerEvent<HTMLDivElement> | null) {
     if (!isDragging || !drawerRef.current) return;
 
     drawerRef.current.classList.remove(DRAG_CLASS);
@@ -590,7 +594,7 @@ export function Root({
     dragEndTime.current = new Date();
     const swipeAmount = getTranslate(drawerRef.current, direction);
 
-    if (!shouldDrag(event.target, false) || !swipeAmount || Number.isNaN(swipeAmount)) return;
+    if (!event || !shouldDrag(event.target, false) || !swipeAmount || Number.isNaN(swipeAmount)) return;
 
     if (dragStartTime.current === null) return;
 
@@ -790,9 +794,11 @@ export const Overlay = React.forwardRef<HTMLDivElement, React.ComponentPropsWith
       return null;
     }
 
+    const onMouseUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => onRelease(event), [onRelease]);
+
     return (
       <DialogPrimitive.Overlay
-        onMouseUp={onRelease}
+        onMouseUp={onMouseUp}
         ref={composedRef}
         data-vaul-overlay=""
         data-vaul-snap-points={isOpen && hasSnapPoints ? 'true' : 'false'}
@@ -867,7 +873,7 @@ export const Content = React.forwardRef<HTMLDivElement, ContentProps>(function (
     }
   }, []);
 
-  function handleOnPointerUp(event: React.PointerEvent<HTMLDivElement>) {
+  function handleOnPointerUp(event: React.PointerEvent<HTMLDivElement> | null) {
     pointerStartRef.current = null;
     wasBeyondThePointRef.current = false;
     onRelease(event);
@@ -1005,8 +1011,10 @@ export const Handle = React.forwardRef<HTMLDivElement, HandleProps>(function (
     // Make sure to clear the timeout id if the user releases the handle before the cancel timeout
     handleCancelInteraction();
 
-    if ((!snapPoints || snapPoints.length === 0) && dismissible) {
-      closeDrawer();
+    if (!snapPoints || snapPoints.length === 0) {
+      if (!dismissible) {
+        closeDrawer();
+      }
       return;
     }
 
@@ -1031,7 +1039,9 @@ export const Handle = React.forwardRef<HTMLDivElement, HandleProps>(function (
   }
 
   function handleCancelInteraction() {
-    window.clearTimeout(closeTimeoutIdRef.current);
+    if (closeTimeoutIdRef.current) {
+      window.clearTimeout(closeTimeoutIdRef.current);
+    }
     shouldCancelInteractionRef.current = false;
   }
 
```

**File**: `src/use-prevent-scroll.ts` (modified, +5/-1)
```diff
@@ -267,11 +267,15 @@ function preventScrollMobileSafari() {
 }
 
 // Sets a CSS property on an element, and returns a function to revert it to the previous value.
-function setStyle(element: HTMLElement, style: string, value: string) {
+function setStyle(element: HTMLElement, style: keyof React.CSSProperties, value: string) {
+  // https://github.com/microsoft/TypeScript/issues/17827#issuecomment-391663310
+  // @ts-ignore
   let cur = element.style[style];
+  // @ts-ignore
   element.style[style] = value;
 
   return () => {
+    // @ts-ignore
     element.style[style] = cur;
   };
 }
```

**File**: `src/use-snap-points.ts` (modified, +3/-2)
```diff
@@ -60,7 +60,7 @@ export function useSnapPoints({
   );
 
   const activeSnapPointIndex = React.useMemo(
-    () => snapPoints?.findIndex((snapPoint) => snapPoint === activeSnapPoint),
+    () => snapPoints?.findIndex((snapPoint) => snapPoint === activeSnapPoint) ?? null,
     [snapPoints, activeSnapPoint],
   );
 
@@ -126,6 +126,7 @@ export function useSnapPoints({
       if (
         snapPointsOffset &&
         newSnapPointIndex !== snapPointsOffset.length - 1 &&
+        fadeFromIndex !== undefined &&
         newSnapPointIndex !== fadeFromIndex &&
         newSnapPointIndex < fadeFromIndex
       ) {
@@ -205,7 +206,7 @@ export function useSnapPoints({
       const dragDirection = hasDraggedUp ? 1 : -1; // 1 = up, -1 = down
 
       // Don't do anything if we swipe upwards while being on the last snap point
-      if (dragDirection > 0 && isLastSnapPoint) {
+      if (dragDirection > 0 && isLastSnapPoint && snapPoints) {
         snapToPoint(snapPointsOffset[snapPoints.length - 1]);
         return;
       }
```

**File**: `tsconfig.json` (modified, +2/-1)
```diff
@@ -4,7 +4,8 @@
     "target": "es2018",
     "moduleResolution": "node",
     "esModuleInterop": true,
-    "lib": ["es2015", "dom"]
+    "lib": ["es2015", "dom"],
+    "strict": true
   },
   "include": ["src"],
 }
```

---

### Incident Patch 13: `2d12d851` (2024-10-05)
**Commit Message**: fix(docs): readme jsx tag (#474)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ function MyComponent() {
       <Drawer.Trigger>Open</Drawer.Trigger>
       <Drawer.Portal>
         <Drawer.Content>
-          <Drawer.Title>Title</p>
+          <Drawer.Title>Title</Drawer.Title>
         </Drawer.Content>
         <Drawer.Overlay />
       </Drawer.Portal>
```

---

### Incident Patch 14: `1142f66e` (2024-10-01)
**Commit Message**: fix: restore position settings on drawer unmount (#462)

* fix: restore position settings on drawer destroy

* fix: typo

* fix: unused att

**File**: `src/use-position-fixed.ts` (modified, +14/-0)
```diff
@@ -109,6 +109,20 @@ export function usePositionFixed({
     };
   }, []);
 
+  React.useEffect(() => {
+    if (!modal) return;
+
+    return () => {
+      if (typeof document === 'undefined') return;
+
+      // Another drawer is opened, safe to ignore the execution
+      const hasDrawerOpened = !!document.querySelector('[data-vaul-drawer]');
+      if (hasDrawerOpened) return;
+
+      restorePositionSetting();
+    };
+  }, [modal, restorePositionSetting]);
+
   React.useEffect(() => {
     if (nested || !hasBeenOpened) return;
     // This is needed to force Safari toolbar to show **before** the drawer starts animating to prevent a gnarly shift from happening
```

**File**: `test/src/app/page.tsx` (modified, +2/-1)
```diff
@@ -14,7 +14,8 @@ export default function Page() {
       <Link href="/non-dismissible">Non-dismissible</Link>
       <Link href="/initial-snap">Initial snap</Link>
       <Link href="/controlled">Controlled</Link>
-      <Link href="/default-open">Controlled</Link>
+      <Link href="/default-open">Default open</Link>
+      <Link href="/with-redirect">With redirect</Link>
     </div>
   );
 }
```

**File**: `test/src/app/with-redirect/long-page/page.tsx` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+'use client';
+
+export default function Page() {
+  return (
+    <div className="bg-zinc-100 space-y-10">
+      <p className="pb-[120vh] bg-zinc-600 text-white font-bold">scroll down</p>
+      <p data-testid="content" className="py-32 bg-zinc-800 text-white">content only visible after scroll</p>
+    </div>
+  );
+}
```

**File**: `test/src/app/with-redirect/page.tsx` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+'use client';
+
+import Link from 'next/link';
+import { Drawer } from 'vaul';
+
+export default function Page() {
+  return (
+    <div className="w-screen h-screen bg-white p-8 flex justify-center items-center">
+      <Drawer.Root>
+        <Drawer.Trigger asChild>
+          <button data-testid="trigger" className="text-2xl">
+            Open Drawer
+          </button>
+        </Drawer.Trigger>
+        <Drawer.Portal>
+          <Drawer.Overlay data-testid="overlay" className="fixed inset-0 bg-black/40" />
+          <Drawer.Content
+            data-testid="content"
+            className="bg-zinc-100 flex flex-col rounded-t-[10px] h-[96%] mt-24 fixed bottom-0 left-0 right-0"
+          >
+            <Drawer.Close data-testid="drawer-close">Close</Drawer.Close>
+            <div className="p-4 bg-white rounded-t-[10px] flex-1">
+              <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-300 mb-8" />
+              <div className="max-w-md mx-auto">
+                <Drawer.Title className="font-medium mb-4">Redirect to another route.</Drawer.Title>
+                <p className="text-zinc-600 mb-2">This route is only used to test the body reset position.</p>
+                <p className="text-zinc-600 mb-8">
+                  Go to{' '}
+                  <Link href="/with-redirect/long-page" data-testid="link" className="underline">
+                    another route
+                  </Link>{' '}
+                </p>
+              </div>
+            </div>
+          </Drawer.Content>
+        </Drawer.Portal>
+      </Drawer.Root>
+    </div>
+  );
+}
```

**File**: `test/tests/with-redirect.spec.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import { test, expect } from '@playwright/test';
+import { openDrawer } from './helpers';
+
+test.beforeEach(async ({ page }) => {
+  await page.goto('/with-redirect');
+});
+
+test.describe('With redirect', () => {
+  test('should restore body position settings', async ({ page }) => {
+    await openDrawer(page);
+    await page.getByTestId('link').click();
+
+    await page.waitForURL('**/with-redirect/long-page');
+
+    const content = page.getByTestId('content');
+
+    // safe check
+    await expect(content).toBeVisible();
+
+    content.scrollIntoViewIfNeeded();
+
+    await expect(page.getByTestId('content')).toBeInViewport();
+  });
+});
```

---

### Incident Patch 15: `995e36a9` (2024-10-01)
**Commit Message**: fix: Fix non-modal drawers without overlay to properly set body pointer events (#460)

* fix: Fix non-modal drawers without overlay to properly set body pointer events

* Remove window check inside useEffect

**File**: `src/index.tsx` (modified, +9/-7)
```diff
@@ -718,6 +718,15 @@ export function Root({
     }
   }
 
+  React.useEffect(() => {
+    if (!modal) {
+      // Need to do this manually unfortunately
+      window.requestAnimationFrame(() => {
+        document.body.style.pointerEvents = 'auto';
+      });
+    }
+  }, [modal]);
+
   return (
     <DialogPrimitive.Root
       defaultOpen={defaultOpen}
@@ -778,13 +787,6 @@ export const Overlay = React.forwardRef<HTMLDivElement, React.ComponentPropsWith
 
     // Overlay is the component that is locking scroll, removing it will unlock the scroll without having to dig into Radix's Dialog library
     if (!modal) {
-      // Need to do this manually unfortunately
-      if (typeof window !== 'undefined') {
-        window.requestAnimationFrame(() => {
-          document.body.style.pointerEvents = 'auto';
-        });
-      }
-	  
       return null;
     }
 
```

#### Recent Merged Pull Requests:
- **PR #661** (closed): Responsive presentation (@arvidnilber)
- **PR #637** (closed): Fix playwright action (@timothyis)
- **PR #621** (closed): Create Patch for 1.1.2 Vaul to Support Plaid Keyboard Interactions (@amontoyaplaid)
- **PR #618** (closed): Integrate luizcieslak (@entity)
- **PR #609** (closed): Add Emil Contact Info to README.md (@dzhousing)
- **PR #599** (closed): Fix drawer height (@cervantes-x)
- **PR #587** (2025-07-25): Update playwright.yml (@sglza)
- **PR #580** (2025-07-25): fix: Added missing modal prop to Drawer.Root (@asos-myronscerri)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
