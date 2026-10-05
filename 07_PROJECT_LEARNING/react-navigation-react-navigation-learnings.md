# Forensic Learning Record (Deep Inspection): react-navigation/react-navigation

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-navigation-react-navigation-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-navigation/react-navigation](https://github.com/react-navigation/react-navigation))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:45:22.227Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-navigation/react-navigation`
- **Description**: Routing and navigation for React Native and Web apps
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 24510 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `example/src/utilities.tsx`
```
export const entries = Object.entries as <K extends string, V>(
  obj: Record<K, V>
) => [K, V][];

export const fromEntries = Object.fromEntries as <K extends string, V>(
  entries: readonly (readonly [K, V])[]
) => Record<K, V>;

```

### Core Architecture Module: `packages/bottom-tabs/src/utils/BottomTabAnimationContext.tsx`
```
import * as React from 'react';

import type { BottomTabSceneInterpolationProps } from '../types';

export const BottomTabAnimationContext = React.createContext<
  BottomTabSceneInterpolationProps | undefined
>(undefined);

```

### Core Architecture Module: `packages/bottom-tabs/src/utils/BottomTabBarHeightCallbackContext.tsx`
```
import * as React from 'react';

export const BottomTabBarHeightCallbackContext = React.createContext<
  ((height: number) => void) | undefined
>(undefined);

```

### Core Architecture Module: `packages/bottom-tabs/src/utils/BottomTabBarHeightContext.tsx`
```
import * as React from 'react';

export const BottomTabBarHeightContext = React.createContext<
  number | undefined
>(undefined);

```

### Core Architecture Module: `packages/bottom-tabs/src/utils/useAnimatedHashMap.tsx`
```
import type { NavigationState } from '@react-navigation/native';
import * as React from 'react';
import { Animated } from 'react-native';

export function useAnimatedHashMap({ routes, index }: NavigationState) {
  const refs = React.useRef<Record<string, Animated.Value>>({});
  const previous = refs.current;
  const routeKeys = Object.keys(previous);

  if (
    routes.length === routeKeys.length &&
    routes.every((route) => routeKeys.includes(route.key))
  ) {
    return previous;
  }
  refs.current = {};

  routes.forEach(({ key }, i) => {
    refs.current[key] =
      previous[key] ??
      new Animated.Value(i === index ? 0 : i >= index ? 1 : -1);
  });

  return refs.current;
}

```

### Core Architecture Module: `packages/bottom-tabs/src/utils/useBottomTabAnimation.tsx`
```
import * as React from 'react';

import { BottomTabAnimationContext } from './BottomTabAnimationContext';

export function useBottomTabAnimation() {
  const animation = React.use(BottomTabAnimationContext);

  if (animation === undefined) {
    throw new Error(
      "Couldn't find values for tab animation. Are you inside a screen in a Bottom Tab navigator?"
    );
  }

  return animation;
}

```

### Core Architecture Module: `packages/bottom-tabs/src/utils/useBottomTabBarHeight.tsx`
```
import * as React from 'react';

import { BottomTabBarHeightContext } from './BottomTabBarHeightContext';

export function useBottomTabBarHeight() {
  const height = React.use(BottomTabBarHeightContext);

  if (height === undefined) {
    throw new Error(
      "Couldn't find the bottom tab bar height. Are you inside a screen in Bottom Tab Navigator?"
    );
  }

  return height;
}

```

### Core Architecture Module: `packages/bottom-tabs/src/utils/useIsKeyboardShown.tsx`
```
import * as React from 'react';
import { Keyboard, Platform } from 'react-native';

export function useIsKeyboardShown() {
  const [isKeyboardShown, setIsKeyboardShown] = React.useState(false);

  React.useEffect(() => {
    const handleKeyboardShow = () => setIsKeyboardShown(true);
    const handleKeyboardHide = () => setIsKeyboardShown(false);

    let subscriptions: ReturnType<typeof Keyboard.addListener>[];

    if (Platform.OS === 'ios') {
      subscriptions = [
        Keyboard.addListener('keyboardWillShow', handleKeyboardShow),
        Keyboard.addListener('keyboardWillHide', handleKeyboardHide),
      ];
    } else {
      subscriptions = [
        Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
        Keyboard.addListener('keyboardDidHide', handleKeyboardHide),
      ];
    }

    return () => {
      subscriptions.forEach((s) => s.remove());
    };
  }, []);

  return isKeyboardShown;
}

```

### Core Architecture Module: `packages/bottom-tabs/src/utils/useTabBarPosition.tsx`
```
import { useLocale } from '@react-navigation/native';

import type { BottomTabNavigationOptions } from '../types';

export function useTabBarPosition({
  tabBarPosition: customTabBarPosition,
  tabBarControllerMode,
}: BottomTabNavigationOptions) {
  const { direction } = useLocale();

  let tabBarPosition: 'left' | 'right' | 'top' | 'bottom';

  if (tabBarControllerMode != null) {
    if (tabBarControllerMode === 'tabSidebar') {
      if (customTabBarPosition === 'left' || customTabBarPosition === 'right') {
        tabBarPosition = customTabBarPosition;
      } else {
        tabBarPosition = direction === 'rtl' ? 'right' : 'left';
      }
    } else {
      if (customTabBarPosition === 'top' || customTabBarPosition === 'bottom') {
        tabBarPosition = customTabBarPosition;
      } else {
        tabBarPosition = 'bottom';
      }
    }

    if (
      customTabBarPosition != null &&
      customTabBarPosition !== tabBarPosition
    ) {
      throw new Error(
        `The '${customTabBarPosition}' position for the tab bar is not supported when 'tabBarControllerMode' is set to '${tabBarControllerMode}'.`
      );
    }
  } else {
    tabBarPosition = customTabBarPosition ?? 'bottom';
  }

  return tabBarPosition;
}

```

### Core Architecture Module: `packages/core/src/BaseNavigationContainer.tsx`
```
import {
  CommonActions,
  type InitialState,
  type NavigationAction,
  type NavigationState,
  type ParamListBase,
  type PartialState,
  type Route,
} from '@react-navigation/routers';
import * as React from 'react';
import useLatestCallback from 'use-latest-callback';
import warnOnce from 'warn-once';

import { checkDuplicateRouteNames } from './checkDuplicateRouteNames';
import { ConsumedParamsContext } from './ConsumedParamsContext';
import { NOT_INITIALIZED_ERROR } from './createNavigationContainerRef';
import { EnsureSingleNavigator } from './EnsureSingleNavigator';
import { findFocusedRoute } from './findFocusedRoute';
import {
  NavigationBuilderContext,
  type WithStackTrace,
} from './NavigationBuilderContext';
import { NavigationContainerRefContext } from './NavigationContainerRefContext';
import { NavigationIndependentTreeContext } from './NavigationIndependentTreeContext';
import { NavigationRootContext } from './NavigationRootContext';
import { NavigationStateContext } from './NavigationStateContext';
import { ThemeProvider } from './theming/ThemeProvider';
import type {
  EventListenerCallback,
  GenericNavigation,
  NavigationContainerEventMap,
  NavigationContainerProps,
  NavigationContainerRef,
  RootParamList,
} from './types';
import { UnhandledActionContext } from './UnhandledActionContext';
import { useChildListeners } from './useChildListeners';
import { useEventEmitter } from './useEventEmitter';
import { useKeyedChildListeners } from './useKeyedChildListeners';
import { useLazyValue } from './useLazyValue';
import { useNavigationIndependentTree } from './useNavigationIndependentTree';
import { useOptionsGetters } from './useOptionsGetters';
import { useSyncState } from './useSyncState';

type State = NavigationState | PartialState<NavigationState> | undefined;

type Props<ParamList extends {}> = NavigationContainerProps & {
  ref?: React.Ref<NavigationContainerRef<ParamList>> | undefined;
};

/**
 * Remove `key` and `routeNames` from the state objects recursively to get partial state.
 *
 * @param state Initial state object.
 */
const getPartialState = (
  state: InitialState | undefined
): PartialState<NavigationState> | undefined => {
  if (state === undefined) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key, routeNames, ...partialState } = state;

  return {
    ...partialState,
    stale: true,
    routes: state.routes.map((route) => {
      if (route.state === undefined) {
        return route as Route<string> & {
          state?: PartialState<NavigationState>;
        };
      }

      return { ...route, state: getPartialState(route.state) };
    }),
  };
};

/**
 * Container component which holds the navigation state.
 * This should be rendered at the root wrapping the whole app.
 *
 * @param props.initialState Initial state object for the navigation tree.
 * @param props.onReady Callback which is called after the navigation tree mounts.
 * @param props.onStateChange Callback which is called with the latest navigation state when it changes.
 * @param props.onUnhandledAction Callback which is called when an action is not handled.
 * @param props.theme Theme object for the UI elements.
 * @param props.children Child elements to render the content.
 * @param props.ref Ref object which refers to the navigation object containing helper methods.
 */
export function BaseNavigationContainer<ParamList extends {} = RootParamList>({
  initialState,
  onStateChange,
  onReady,
  onUnhandledAction,
  theme,
  children,
  ref,
}: Props<ParamList>) {
  const parent = React.use(NavigationStateContext);
  const independent = useNavigationIndependentTree();

  if (!parent.isDefault && !independent) {
    throw new Error(
      "Looks like you have nested a 'NavigationContainer' inside another. Normally you need only one container at the root of the app, so this was probably an error. If this was intentional, wrap the container in 'NavigationIndependentTree' explicitly. Note that this will make the child navigators disconnected from the parent and you won't be able to navigate between them."
    );
  }

  const { state, getState, setState, subscribe, scheduleUpdate, flushUpdates } =
    useSyncState<State>(() =>
      getPartialState(initialState == null ? undefined : initialState)
    );

  const consumedParams = useLazyValue(() => new WeakMap<object, true>());

  const isFirstMountRef = React.useRef<boolean>(true);

  const navigatorKeyRef = React.useRef<string | undefined>(undefined);

  const getKey = React.useCallback(() => navigatorKeyRef.current, []);

  const setKey = React.useCallback((key: string) => {
    navigatorKeyRef.current = key;
  }, []);

  const { listeners, addListener } = useChildListeners();

  const { keyedListeners, addKeyedListener } = useKeyedChildListeners();

  const stackRef = React.useRef<string | undefined>(undefined);

  const withStackTrace = React.useCallback<WithStackTrace>(
    (entry, callback) => {
      if (process.env.NODE_ENV === 'production' || stackRef.current != null) {
        callback();
        return;
      }

      const error = new Error();

      if (Error.captureStackTrace) {
        // Available on V8 and Hermes, omits the frames of `entry` and what it called
        Error.captureStackTrace(error, entry);

        stackRef.current = error.stack;
      } else {
        // Other engines always include them, so we drop the frames up to `entry` ourselves
        const frames = error.stack?.split('\n') ?? [];
        const index = frames.findIndex((frame) =>
          frame.includes(`${entry.name}@`)
        );

        stackRef.current = frames.slice(index + 1).join('\n');
      }

      try {
        callback();
      } finally {
        stackRef.current = undefined;
      }
    },
    []
  );

  const dispatch = useLatestCallback(
    (
      action: NavigationAction | ((state: NavigationState) => NavigationAction)
    ) => {
      const listener = listeners.focus[0];

      if (listener == null) {
        console.error(NOT_INITIALIZED_ERROR);
      } else {
        withStackTrace(dispatch, () => {
          listener((navigation) =>
            React.startTransition(() => {
              navigation.dispatch(action);
            })
          );
        });
      }
    }
  );

  const canGoBack = useLatestCallback(() => {
    if (listeners.focus[0] == null) {
      return false;
    }

    const { result, handled } = listeners.focus[0]((navigation) =>
      navigation.canGoBack()
    );

    if (handled) {
      return result;
    } else {
      return false;
    }
  });

  const resetRoot = useLatestCallback(
    (state: PartialState<NavigationState> | NavigationState) => {
      const target = keyedListeners.getState.root?.().key;
      const listener = listeners.focus[0];

      if (target == null || listener == null) {
        console.error(NOT_INITIALIZED_ERROR);
      } else {
        listener((navigation) =>
          navigation.dispatch({
            ...CommonActions.reset(state),
            target,
          })
        );
      }
    }
  );

  const getRootState = useLatestCallback(() => {
    return keyedListeners.getState.root?.();
  });

  const getCurrentRoute = useLatestCallback(() => {
    const state = getRootState();

    if (state == null) {
      return undefined;
    }

    const route = findFocusedRoute(state);

    return route as Route<string> | undefined;
  });

  const isReady = useLatestCallback(() => listeners.focus[0] != null);

  const emitter = useEventEmitter<NavigationContainerEventMap>();

  const { addOptionsGetter, getCurrentOptions } = useOptionsGetters({});

  const container: NavigationContainerRef<ParamList> = React.useMemo(
    () => ({
      ...Object.keys(CommonActions).reduce<any>((acc, name) => {
        const helper = (...args: any[]) =>
          withStackTrace(helper, () =>
            // @ts-expect-error: this is ok
            dispatch(CommonActions[name](...args))
          );

        acc[name] = helper;

        return acc;
      }, {}),
      ...emitter.create('root'),
      dispatch,
      resetRoot,
      canGoBack,
      getState,
      getRootState,
      getCurrentRoute,
      getCurrentOptions,
      isReady,
    }),
    [
      canGoBack,
      dispatch,
      emitter,
      getCurrentOptions,
      getCurrentRoute,
      getRootState,
      getState,
      isReady,
      resetRoot,
      withStackTrace,
    ]
  );

  const navigation: GenericNavigation<ParamListBase> = React.useMemo(() => {
    const events = emitter.create('root');

    const dispatch = (
      thunk: NavigationAction | ((state: NavigationState) => NavigationAction)
    ) => {
      const root = keyedListeners.getNavigation.root?.();

      if (root == null) {
        console.error(NOT_INITIALIZED_ERROR);
        return;
      }

      withStackTrace(dispatch, () => {
        React.startTransition(() => {
          root.dispatch(thunk);
        });
      });
    };

    const helpers = Object.keys(CommonActions).reduce<any>((acc, name) => {
      const helper = (...args: any) => {
        if (
          name === 'setParams' ||
          name === 'replaceParams' ||
          name === 'pushParams'
        ) {
          throw new Error(`Cannot call ${name} outside a screen`);
        }

        withStackTrace(helper, () =>
          // @ts-expect-error name is a valid key, but TypeScript cannot infer it.
          dispatch(CommonActions[name](...args))
        );
      };

      acc[name] = helper;

      return acc;
    }, {});

    const listeners = new WeakMap<
      (...args: never[]) => void,
      EventListenerCallback<NavigationContainerEventMap, 'state'>
    >();

    return {
      ...helpers,
      dispatch,
      addListener: (type, callback) => {
        if (type === 'state') {
          let listener = listeners.get(callback);

          if (listener === undefined) {
            // Root's state change events can contain stale and undefined state
           
```

### Core Architecture Module: `packages/core/src/ConsumedParamsContext.tsx`
```
import * as React from 'react';

export const ConsumedParamsContext = React.createContext<
  WeakMap<object, true> | undefined
>(undefined);

```

### Core Architecture Module: `packages/core/src/DataLoading.tsx`
```
import type { NavigationState, PartialState } from '@react-navigation/routers';

import { getStateFromRouteParams } from './getStateFromRouteParams';
import type { TreeForPathConfig } from './StaticNavigation';

function findScreenInConfig(config: TreeForPathConfig['config'], name: string) {
  const screens = config.screens;

  if (screens?.[name] != null) {
    return screens[name];
  }

  if (config.groups) {
    for (const group of Object.values(config.groups)) {
      if (group.screens[name] != null) {
        return group.screens[name];
      }
    }
  }

  return undefined;
}

function findInitialRouteName(
  config: TreeForPathConfig['config']
): string | undefined {
  if (config.initialRouteName != null) {
    return config.initialRouteName;
  }

  for (const key in config) {
    if (key === 'screens' && config.screens) {
      const name = Object.keys(config.screens)[0];

      if (name != null) {
        return name;
      }
    }

    if (key === 'groups' && config.groups) {
      for (const group of Object.values(config.groups)) {
        const name = Object.keys(group.screens)[0];

        if (name != null) {
          return name;
        }
      }
    }
  }

  return undefined;
}

/**
 * Get loader for the focused route in a static config tree with given navigation state.
 *
 * @param tree The static navigation config.
 * @param state The navigation state to extract the focused route path from.
 * @returns A function that returns a `Promise<void>`, or `undefined` if no loaders are found.
 *
 * @example
 * ```js
 * const loader = getLoaderForState(RootStack, {
 *   index: 0,
 *   routes: [{ name: 'Home' }],
 * });
 * await loader?.();
 * ```
 */
export function getLoaderForState(
  tree: TreeForPathConfig,
  state: PartialState<NavigationState> | NavigationState | undefined
): (() => Promise<void>) | undefined {
  return getLoaderForStateChange(tree, state, undefined, undefined);
}

export function getLoaderForStateChange(
  tree: TreeForPathConfig,
  state: PartialState<NavigationState> | NavigationState | undefined,
  previousState: PartialState<NavigationState> | NavigationState | undefined,
  consumedParams: WeakMap<object, true> | undefined
): (() => Promise<void>) | undefined {
  const focusedRoute = state?.routes[state.index ?? state.routes.length - 1];
  const previousFocusedRoute =
    previousState?.routes[
      previousState.index ?? previousState.routes.length - 1
    ];

  if (!focusedRoute) {
    return undefined;
  }

  const isNewlyFocused =
    previousState === undefined ||
    previousFocusedRoute == null ||
    focusedRoute.name !== previousFocusedRoute.name ||
    (focusedRoute.key != null &&
      previousFocusedRoute.key != null &&
      focusedRoute.key !== previousFocusedRoute.key);

  const item = findScreenInConfig(tree.config, focusedRoute.name);

  if (item == null) {
    return undefined;
  }

  const initialParams =
    typeof item === 'object' && 'initialParams' in item
      ? item.initialParams
      : undefined;

  const params =
    initialParams != null || focusedRoute.params != null
      ? { ...initialParams, ...focusedRoute.params }
      : undefined;

  const loaders: (() => Promise<void>)[] = [];

  if (
    isNewlyFocused &&
    'UNSTABLE_loader' in item &&
    typeof item.UNSTABLE_loader === 'function'
  ) {
    const loader = item.UNSTABLE_loader;

    loaders.push(() =>
      loader({
        name: focusedRoute.name,
        params,
      })
    );
  }

  const nested =
    'config' in item
      ? item
      : 'screen' in item &&
          // Nested navigators cannot be defined as a getter
          Object.getOwnPropertyDescriptor(item, 'screen')?.get == null &&
          'config' in item.screen
        ? item.screen
        : undefined;

  if (nested) {
    const initialRouteName = findInitialRouteName(nested.config);

    const stateFromParams =
      focusedRoute.params != null && consumedParams?.has(focusedRoute.params)
        ? undefined
        : getStateFromRouteParams(params);

    let childState =
      previousState !== undefined && stateFromParams != null
        ? stateFromParams
        : (focusedRoute.state ?? stateFromParams);

    if (childState == null && initialRouteName != null) {
      childState = { routes: [{ name: initialRouteName }] };
    }

    let previousChildState:
      | PartialState<NavigationState>
      | NavigationState
      | undefined;

    if (!isNewlyFocused) {
      const previousRouteParams = previousFocusedRoute?.params;
      const previousParams =
        initialParams != null || previousRouteParams != null
          ? { ...initialParams, ...previousRouteParams }
          : undefined;
      const previousStateFromParams =
        previousRouteParams != null && consumedParams?.has(previousRouteParams)
          ? undefined
          : getStateFromRouteParams(previousParams);

      previousChildState =
        previousFocusedRoute?.state ?? previousStateFromParams;

      if (previousChildState == null && initialRouteName != null) {
        previousChildState = { routes: [{ name: initialRouteName }] };
      }
    }

    const childLoader = getLoaderForStateChange(
      nested,
      childState,
      previousState === undefined
        ? undefined
        : (previousChildState ?? { routes: [] }),
      consumedParams
    );

    if (childLoader) {
      loaders.push(childLoader);
    }
  }

  if (loaders.length === 0) {
    return undefined;
  }

  return async () => {
    await Promise.all(loaders.map((l) => l()));
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13254** (2026-09-17): **[Web] Stacked card drop shadow is clipped — inactive CardA11yWrapper overflow: hidden has no opt-out**
  *Symptoms*: ### Current behavior  On web, I style each card as a floating panel with cardStyle: rounded corners, a border and a boxShadow. While a card is on top this looks right. As soon as I push another screen over it, the shadow on the card underneath is cut off. Only its 1px border stays. When I go back, the shadow shows again.  The cause is that the stack wraps every screen that is not on top in a View with overflow: 'hidden'. In 7.11.1 this is in CardA11yWrapper (overflow: active ? undefined : 'hidden'), on main the same rule sits on ActivityView in CardStack.tsx. It was added in 522fa47a so a taller inactive page does not make the document scroll.  There is no option to turn this off. Returning containerStyle: {overflow: 'visible'} from cardStyleInterpolator does not help, that style lands inside the wrapper that clips. cardOverlayEnabled, cardShadowEnabled, detachPreviousScreen and presentation: 'transparentModal' do not change it either. My page has overflow: hidden on body and the stack sits in a fixed-size container, so the scroll problem the clip was meant to fix cannot happen here. The clip only removes visuals.   ### Expected behavior  A card that is no longer on top should keep looking the same as when it was on top, shadow included. Or an option to skip the clip, in the style of cardOverlayEnabled or cardShadowEnabled, for layouts where the page cannot scroll anyway.  ### Reproduction  https://snack.expo.dev/@bartekholinice/stacked-card-drop-shadow  The packages in the S
  **Post-Mortem & Fix Analysis**:
  > The versions mentioned in the issue for the following packages differ from the latest versions on npm: - `@react-navigation/native` (found: `7.1.33`, latest: `7.4.1`) - `@react-navigation/bottom-tabs` (found: `7.15.5`, latest: `7.19.1`) - `@react-navigation/material-top-tabs` (found: `7.4.19`, latest: `7.7.1`) - `@react-navigation/stack` (found: `7.8.5`, latest: `7.11.1`) - `react-native-tab-view` (found: `4.3.0`, latest: `4.3.2`)  Can you verify that the issue still exists after upgrading to the latest versions of these packages?
  > Hey @BartekObudzinski! Thanks for opening the issue. It seems that the issue doesn't contain a link to a repro, or the provided repro is not valid (e.g. broken link, private repo, code doesn't run etc.).    **The best way to get attention to your issue is to provide an easy way for a developer to reproduce the issue.**    You can provide a repro using any of the following:    - Public GitHub repo under your username   - [TypeScript Playground](https://www.typescriptlang.org/play)    Try to keep the repro as small as possible by narrowing down the minimal amount of code needed to reproduce the issue. See ["How to create a Minimal, Reproducible Example"](https://stackoverflow.com/help/minimal-reproducible-example) for more information.    **Don't:**    - Link to your entire project or a project containing code unrelated to the issue.   - Link to a specific file in a GitHub repo, as it won't be detected.    You can edit your original issue to include a link to the repro, or leave it as a 

- **Issue #13226** (2026-10-04): **iOS 27 Beta 7 - Native header press scrolls list up**
  *Symptoms*: ### Current behavior  When pressing into the header and the screen has a scrollview inside, than the header button press always triggers a scroll up. Normally this should only happen when clicking in the status bar not when clicking in the header.  I have set headerTransparent to true.  ### Expected behavior  When pressing into the header there should be no scroll up, only when pressing the status bar.  ### Reproduction  -  ### Platform  - [ ] Android - [x] iOS - [ ] Web - [ ] Windows - [ ] MacOS  ### Packages  - [ ] @react-navigation/bottom-tabs - [ ] @react-navigation/drawer - [ ] @react-navigation/material-top-tabs - [ ] @react-navigation/stack - [x] @react-navigation/native-stack - [ ] react-native-drawer-layout - [ ] react-native-tab-view  ### Environment  "@react-navigation/bottom-tabs": "8.0.0-alpha.49", "@react-navigation/drawer": "8.0.0-alpha.50", "@react-navigation/elements": "3.0.0-alpha.47", "@react-navigation/native": "8.0.0-alpha.43", "@react-navigation/native-stack": "8.0.0-alpha.51", "react-native-screens": "4.27.0", "react-native": "0.85.3",
  **Post-Mortem & Fix Analysis**:
  > Hey @Brma1048! Thanks for opening the issue. It seems that the issue doesn't contain a link to a repro, or the provided repro is not valid (e.g. broken link, private repo, code doesn't run etc.).    **The best way to get attention to your issue is to provide an easy way for a developer to reproduce the issue.**    You can provide a repro using any of the following:    - Public GitHub repo under your username   - [TypeScript Playground](https://www.typescriptlang.org/play)    Try to keep the repro as small as possible by narrowing down the minimal amount of code needed to reproduce the issue. See ["How to create a Minimal, Reproducible Example"](https://stackoverflow.com/help/minimal-reproducible-example) for more information.    **Don't:**    - Link to your entire project or a project containing code unrelated to the issue.   - Link to a specific file in a GitHub repo, as it won't be detected.    You can edit your original issue to include a link to the repro, or leave it as a comment.
  > The versions mentioned in the issue for the following packages differ from the latest versions on npm: - `@react-navigation/bottom-tabs` (found: `8.0.0-alpha.49`, latest: `7.18.18`) - `@react-navigation/drawer` (found: `8.0.0-alpha.50`, latest: `7.13.10`) - `@react-navigation/native` (found: `8.0.0-alpha.43`, latest: `7.3.18`)  Can you verify that the issue still exists after upgrading to the latest versions of these packages?
  > I found out that something similar is happening on the apple notes app, but there it just happens when clicking in the white area, when pressing the buttons it does not scroll up. With React navigation it scrolls also up when pressing the buttons  https://github.com/user-attachments/assets/a8b22bf6-0380-43a1-8dde-e1e782ac567d

- **Issue #13223** (2026-08-30): **Nested TopTabNavigator inside a BottomTabNavigator will only render the TopTabs the first time the Bottom Tab is selected**
  *Symptoms*: ### Current behavior  **Description:** When using a nested MaterialTopTabNavigator inside a BottomTabNavigator, the Top Tabs of the MaterialTopTab Screen are only displayed the first time the Bottom Tab is selected. Sequential access to the MaterialTopTab Screen will not display  the Top Tabs.  **Video:** https://github.com/user-attachments/assets/6833155d-0028-4ee5-94bd-5b5e5353190e  ### Expected behavior  When switching the Bottom Tabs, the Top Tabs screen should always be rendered  ### Reproduction  https://github.com/davilavillalobosa/react-navigation-material-top-tabs-bug  ### Platform  - [x] Android - [ ] iOS - [ ] Web - [ ] Windows - [ ] MacOS  ### Packages  - [x] @react-navigation/bottom-tabs - [ ] @react-navigation/drawer - [x] @react-navigation/material-top-tabs - [ ] @react-navigation/stack - [ ] @react-navigation/native-stack - [ ] react-native-drawer-layout - [ ] react-native-tab-view  ### Environment  - [x] I've removed the packages that I don't use  | package                                | version | | -------------------------------------- | ------- | | @react-navigation/native               | ^7.3.17 | | @react-navigation/bottom-tabs               | ^7.18.17 | | @react-navigation/material-top-tabs    | ^7.6.16 | | react-native-screens                   | ^4.27.0 | | react-native-safe-area-context         | ^5.9.1 | | react-native-pager-view                | ^9.0.2 | | react-native                           | 0.86.2 | | node                                   
  **Post-Mortem & Fix Analysis**:
  > This looks like a real bug to me. Would it be okay if I try to work on a fix?
  > Yes of course, Everything that you require is in the description of this bug report
  > Thank you @scs0209 for giving it a try. I tested your pull request, but didn't work.  After some tests I realized that the problem is related to the react-native-pager-view library version 9.0.2. If I downgrade the version to 8.0.5 it will Nested TopTabNavigator inside a BottomTabNavigator will render every time. I will open an issue in react-native-paper-view and just suggests to update the documentation so that the working react-native-pager-view version is installed

- **Issue #13220** (2026-08-19): **RN 0.87, TypeScript – `useScrollToTop` no longer accepts `SectionList` refs**
  *Symptoms*: ### Current behavior  Passing a `SectionList` ref (or `SectionListInstance`) to `useScrollToTop` produces a TypeScript error under React Native 0.87. The same code works fine for `ScrollView` and `FlatList`.  ### Minimal repro  ```tsx import { useRef } from 'react'; import { ScrollViewInstance, FlatListInstance, SectionList, SectionListInstance } from 'react-native'; import { useScrollToTop } from '@react-navigation/native';  const App = () => {   const scrollViewRef = useRef<ScrollViewInstance>(null);   useScrollToTop(scrollViewRef); // All good    const flatListRef = useRef<FlatListInstance>(null);   useScrollToTop(flatListRef); // All good    const ref1 = useRef<SectionListInstance>(null);   useScrollToTop(ref1); // Error TS2345    const ref2 = useRef<SectionList>(null);   useScrollToTop(ref2); // Also Error TS2345    return <SectionList ref={ref1} sections={[]} />; }; ```  Error produced:  ``` App.tsx(21,18): error TS2345: Argument of type 'RefObject<SectionListInstance | null>' is not assignable to parameter of type 'RefObject<ScrollableWrapper>'.   Type 'SectionListInstance | null' is not assignable to type 'ScrollableWrapper'.     Type 'SectionListInstance' is not assignable to type 'ScrollableWrapper'.       Type 'SectionList<any, DefaultSectionT>' is not assignable to type '{ getScrollResponder(): ReactNode | (((props: ...) => ReactNode) & Readonly<...>); }'.         The types returned by 'getScrollResponder()' are incompatible between these types.           Type 'Sc

- **Issue #13219** (2026-10-04): **Default background is not rgb(255, 255, 255)**
  *Symptoms*: ### Current behavior  Default background color is `rgb(242, 242, 242)`  ### Expected behavior  Default background color should be transparent or at least a plain white  ### Reproduction  https://github.com/react-navigation/react-navigation/blob/999fc2c914f592618921923bbe6e986a7f78ec9a/packages/native/src/theming/LightTheme.tsx#L9  ### Platform  - [x] Android - [x] iOS - [ ] Web - [ ] Windows - [ ] MacOS  ### Packages  - [ ] @react-navigation/bottom-tabs - [ ] @react-navigation/drawer - [ ] @react-navigation/material-top-tabs - [ ] @react-navigation/stack - [ ] @react-navigation/native-stack - [ ] react-native-drawer-layout - [ ] react-native-tab-view  ### Environment  - [x] I've removed the packages that I don't use  | package                                | version | | -------------------------------------- | ------- | | @react-navigation/native               |  7.2.2  | 
  **Post-Mortem & Fix Analysis**:
  > Hey @y-nk! Thanks for opening the issue. It seems that the issue doesn't contain a link to a repro, or the provided repro is not valid (e.g. broken link, private repo, code doesn't run etc.).    **The best way to get attention to your issue is to provide an easy way for a developer to reproduce the issue.**    You can provide a repro using any of the following:    - Public GitHub repo under your username   - [TypeScript Playground](https://www.typescriptlang.org/play)    Try to keep the repro as small as possible by narrowing down the minimal amount of code needed to reproduce the issue. See ["How to create a Minimal, Reproducible Example"](https://stackoverflow.com/help/minimal-reproducible-example) for more information.    **Don't:**    - Link to your entire project or a project containing code unrelated to the issue.   - Link to a specific file in a GitHub repo, as it won't be detected.    You can edit your original issue to include a link to the repro, or leave it as a comment. **T
  > The versions mentioned in the issue for the following packages differ from the latest versions on npm: - `@react-navigation/native` (found: `7.2.2`, latest: `7.3.16`)  Can you verify that the issue still exists after upgrading to the latest versions of these packages?
  > Issue is verified to be present in latest version ; repro link is directly the related source line.

- **Issue #13208** (2026-08-07): **Back-swipe doesn't work on JS stack screens with transparent background (new arch)**
  *Symptoms*: ### Current behavior  The back-swipe in `@react-navigation/stack` doesn't work on screens that have no background.  https://github.com/user-attachments/assets/a58744e9-7ef5-4f5b-adcd-1050109563bf  Also here: https://snack.expo.dev/@valeriiia/stack-back-swipe-no-background?platform=ios  Regression from v6: the `Animated.View` inside the card's`PanGestureHandler` was `pointerEvents: 'auto'`. Now it's `'box-none'` ([`Card.tsx#L571`](https://github.com/react-navigation/react-navigation/blob/680d8891630ccf512a2b0c44758392ee50318bd0/packages/stack/src/views/Stack/Card.tsx#L571)) and on the new architecture the touch never reaches the pan handler.  ### Expected behavior  Back-swipe works on screens without a background as in v6  ### Reproduction  https://github.com/valeriiamykhalova/rn-stack-swipe-back-repro  ### Platform  - [x] Android - [x] iOS - [ ] Web - [ ] Windows - [ ] MacOS  ### Packages  - [ ] @react-navigation/bottom-tabs - [ ] @react-navigation/drawer - [ ] @react-navigation/material-top-tabs - [x] @react-navigation/stack - [ ] @react-navigation/native-stack - [ ] react-native-drawer-layout - [ ] react-native-tab-view  ### Environment  - [x] I've removed the packages that I don't use    | package                        | version |   | ------------------------------ | ------- |   | @react-navigation/native       | 7.3.15  |   | @react-navigation/stack        | 7.10.20 |   | react-native-screens           | 4.16.0  |   | react-native-safe-area-context | 5.6.0   |   | react-
  **Post-Mortem & Fix Analysis**:
  > The versions mentioned in the issue for the following packages differ from the latest versions on npm: - `@react-navigation/native` (found: `7.3.15`, latest: `7.3.16`) - `@react-navigation/stack` (found: `7.10.20`, latest: `7.10.21`)  Can you verify that the issue still exists after upgrading to the latest versions of these packages?
  > Hey @valeriiamykhalova! Thanks for opening the issue. It seems that the issue doesn't contain a link to a repro, or the provided repro is not valid (e.g. broken link, private repo, code doesn't run etc.).    **The best way to get attention to your issue is to provide an easy way for a developer to reproduce the issue.**    You can provide a repro using any of the following:    - Public GitHub repo under your username   - [TypeScript Playground](https://www.typescriptlang.org/play)    Try to keep the repro as small as possible by narrowing down the minimal amount of code needed to reproduce the issue. See ["How to create a Minimal, Reproducible Example"](https://stackoverflow.com/help/minimal-reproducible-example) for more information.    **Don't:**    - Link to your entire project or a project containing code unrelated to the issue.   - Link to a specific file in a GitHub repo, as it won't be detected.    You can edit your original issue to include a link to the repro, or leave it as a

- **Issue #13204** (2026-08-05): **Some automatic imports from @react-navigation/native stopped working starting with release 7.2.3**
  *Symptoms*: ### Current behavior  Starting with version 7.2.3, some imports from `@react-navigation/native` are no longer being automatically imported in VS Code using exported values. This also affects the latest release, 7.3.14 and may affect other packages other than just `native`.  I'm able to reproduce this reliably in the provided reproducer, an Expo app, but I don't believe it is related to Expo as I am able to reproduce it in a bare React Native app as well. The reproducer is a bare-bones app created using the following steps: 1. `npx create-expo-app@latest --template blank-typescript@sdk-57` 2. `npm i @react-navigation/native@7.2.3`  Installing version 7.2.2, the problem goes away. Here's a short video which demonstrates the problem: https://github.com/user-attachments/assets/c0f03dca-18b1-405e-a095-eb72ec3ccd67  A few notes: - The exported values function as expected once the import is manually added - If something else from the package is already imported in the file, the automatic import works as expected - the problem only occurs when nothing from the package is imported - Not all imports are affected. For example, `useNavigation` does not import automatically, but `useLinkTo` does  ### Expected behavior  Imports should automatically be added when used, and all imports should behave consistently  ### Reproduction  https://github.com/BrandonWade/react-navigation-reproducer  ### Platform  - [ ] Android - [ ] iOS - [ ] Web - [ ] Windows - [ ] MacOS  ### Packages  - [ ] @react-n
  **Post-Mortem & Fix Analysis**:
  > It seems that VSCode breaks with [this module augmentation](https://github.com/react-navigation/react-navigation/blob/cb17c7a0a08e98140445491f0bf900691a3b6c2c/packages/native/src/types.tsx#L9-L11).  Not sure how to fix yet, tho it seems like bug in VSCode.
  > please try `@react-navigation/native@7.3.15`
  > Hey! This issue is closed and isn't watched by the core team. You are welcome to discuss the issue with others in this thread, but if you think this issue is still valid and needs to be tracked, please open a new issue with a repro.

- **Issue #13186** (2026-07-16): **Drawer gets stuck open on Android after closeDrawer + navigate, AppState background, or external intents (RN 0.86 / drawer v7)**
  *Symptoms*: ### Current behavior  After upgrading to React Native 0.86 and React Navigation 7, the drawer can get **stuck open** on Android. The drawer UI remains visible, but `closeDrawer()` / `DrawerActions.closeDrawer()` no longer closes it reliably. This happens especially when: 1. **Close drawer then navigate immediately** (e.g. profile tap → push stack screen, or sign-in flow) 2. **App goes to background** while the drawer is open or closing (Google Sign-In, Contact Us `mailto:` intent, etc.) and returns to foreground 3. **Nested navigation**: drawer is nested inside a parent stack (`DrawerMenu` screen inside `MainStack`, with a nested stack inside the drawer) Typical sequence: - Open drawer - Tap an item that calls `navigation.closeDrawer()` then navigates (or opens an external activity) - Drawer may appear to close, then reopen, or stay stuck open - Close button / back button no longer dismiss the drawer On iOS this is less frequent; **Android is consistently affected**.  ### Expected behavior  - Drawer closes once - Navigation / external intent proceeds - Drawer stays closed after returning from background or SSO - Close button and `closeDrawer()` keep working  ### Reproduction  https://github.com/iam-ank-it/DrawerStuck.git  ### Platform  - [x] Android - [ ] iOS - [ ] Web - [ ] Windows - [ ] MacOS  ### Packages  - [ ] @react-navigation/bottom-tabs - [x] @react-navigation/drawer - [ ] @react-navigation/material-top-tabs - [ ] @react-navigation/stack - [ ] @react-navigation/native
  **Post-Mortem & Fix Analysis**:
  > The versions mentioned in the issue for the following packages differ from the latest versions on npm: - `@react-navigation/native` (found: `7.3.4`, latest: `7.3.8`) - `@react-navigation/drawer` (found: `7.12.3`, latest: `7.12.8`) - `@react-navigation/stack` (found: `7.10.6`, latest: `7.10.11`)  Can you verify that the issue still exists after upgrading to the latest versions of these packages?
  > thanks for the repro @iam-ank-it   can you try this patch and confirm if it fixes the issue? https://github.com/react-navigation/react-navigation/commit/6478873961cc2e3ae010331a25419f30ad732207
  > Hey! This issue is closed and isn't watched by the core team. You are welcome to discuss the issue with others in this thread, but if you think this issue is still valid and needs to be tracked, please open a new issue with a repro.

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

### Incident Patch 1: `bbf432c9` (2026-10-05)
**Commit Message**: fix: add font assets to exports

**File**: `packages/material-symbols/package.json` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@
   },
   "homepage": "https://reactnavigation.org",
   "exports": {
+    "./assets/fonts/*": "./assets/fonts/*",
     "./package.json": "./package.json"
   },
   "files": [
```

---

### Incident Patch 2: `a9f81b8c` (2026-09-29)
**Commit Message**: fix: support `| undefined` to better work with `exactOptionalPropertyTypes`

**File**: `packages/bottom-tabs/src/types.tsx` (modified, +105/-81)
```diff
@@ -110,18 +110,22 @@ export type BottomTabOptionsArgs<
 
 export type TimingKeyboardAnimationConfig = {
   animation: 'timing';
-  config?: Omit<
-    Partial<Animated.TimingAnimationConfig>,
-    'toValue' | 'useNativeDriver'
-  >;
+  config?:
+    | Omit<
+        Partial<Animated.TimingAnimationConfig>,
+        'toValue' | 'useNativeDriver'
+      >
+    | undefined;
 };
 
 export type SpringKeyboardAnimationConfig = {
   animation: 'spring';
-  config?: Omit<
-    Partial<Animated.SpringAnimationConfig>,
-    'toValue' | 'useNativeDriver'
-  >;
+  config?:
+    | Omit<
+        Partial<Animated.SpringAnimationConfig>,
+        'toValue' | 'useNativeDriver'
+      >
+    | undefined;
 };
 
 export type TabBarVisibilityAnimationConfig =
@@ -141,21 +145,21 @@ type BottomTabCustomOptions = {
    *
    * Only supported with `custom` implementation.
    */
-  animation?: TabAnimationName;
+  animation?: TabAnimationName | undefined;
 
   /**
    * Function which specifies interpolated styles for bottom-tab scenes.
    *
    * Only supported with `custom` implementation.
    */
-  sceneStyleInterpolator?: BottomTabSceneStyleInterpolator;
+  sceneStyleInterpolator?: BottomTabSceneStyleInterpolator | undefined;
 
   /**
    * Object which specifies the animation type (timing or spring) and their options (such as duration for timing).
    *
    * Only supported with `custom` implementation.
    */
-  transitionSpec?: TransitionSpec;
+  transitionSpec?: TransitionSpec | undefined;
 
   /**
    * Whether the label is shown below the icon or beside the icon.
@@ -176,7 +180,7 @@ type BottomTabCustomOptions = {
    *
    * Only supported with `custom` implementation.
    */
-  tabBarAllowFontScaling?: boolean;
+  tabBarAllowFontScaling?: boolean | undefined;
 
   /**
    * Style object for the tab item container.
@@ -199,24 +203,26 @@ type BottomTabCustomOptions = {
    *
    * Only supported with `custom` implementation.
    */
-  tabBarHideOnKeyboard?: boolean;
+  tabBarHideOnKeyboard?: boolean | undefined;
 
   /**
    * Animation config for showing and hiding the tab bar when the keyboard is shown/hidden.
    *
    * Only supported with `custom` implementation.
    */
-  tabBarVisibilityAnimationConfig?: {
-    show?: TabBarVisibilityAnimationConfig;
-    hide?: TabBarVisibilityAnimationConfig;
-  };
+  tabBarVisibilityAnimationConfig?:
+    | {
+        show?: TabBarVisibilityAnimationConfig | undefined;
+        hide?: TabBarVisibilityAnimationConfig | undefined;
+      }
+    | undefined;
 
   /**
    * Variant of the tab bar. Defaults to `uikit`.
    *
    * Only supported with `custom` implementation.
    */
-  tabBarVariant?: Variant;
+  tabBarVariant?: Variant | undefined;
 
   /**
    * Style object for the tab bar container.
@@ -234,36 +240,38 @@ type BottomTabCustomOptions = {
    *
    * Only supported with `custom` implementation.
    */
-  tabBarBackground?: () => React.ReactNode;
+  tabBarBackground?: (() => React.ReactNode) | undefined;
 
   /**
    * Position of the tab bar on the screen. Defaults to `bottom`.
    *
    * Only supported with `custom` implementation or if custom tab bar is provided.
    */
-  tabBarPosition?: 'bottom' | 'left' | 'right' | 'top';
+  tabBarPosition?: 'bottom' | 'left' | 'right' | 'top' | undefined;
 
   /**
    * Background color for the active tab.
    *
    * Only supported with `custom` implementation.
    */
-  tabBarActiveBackgroundColor?: ColorValue;
+  tabBarActiveBackgroundColor?: ColorValue | undefined;
 
   /**
    * Background color for the inactive tabs.
    *
    * Only supported with `custom` implementation.
    */
-  tabBarInactiveBackgroundColor?: ColorValue;
+  tabBarInactiveBackgroundColor?: ColorValue | undefined;
 
   /**
    * Function which returns a React element to render as the tab bar button.
    * Renders `PlatformPressable` by default.
    *
    * Only supported with `custom` implementation.
    */
-  tabBarButton?: (props: BottomTabBarButtonProps) => React.ReactNode;
+  tabBarButton?:
+    | ((props: BottomTabBarButtonProps) => React.ReactNode)
+    | undefined;
 };
 
 type BottomTabNativeOptions = {
@@ -277,7 +285,7 @@ type BottomTabNativeOptions = {
    *
    * @platform ios
    */
-  tabBarSystemItem?: TabsScreenSystemItem;
+  tabBarSystemItem?: TabsScreenSystemItem | undefined;
 
   /**
    * Blur effect applied to the tab bar when tab screen is selected.
@@ -299,7 +307,7 @@ type BottomTabNativeOptions = {
    *
    * @platform ios
    */
-  tabBarBlurEffect?: TabsScreenBlurEffect;
+  tabBarBlurEffect?: TabsScreenBlurEffect | undefined;
 
   /**
    * Minimize behavior for the tab bar.
@@ -322,7 +330,12 @@ type BottomTabNativeOptions = {
    *
    * @platform ios
    */
-  tabBarMinimizeBehavior?: 'auto' | 'none' | 'onScrollDown' | 'onScrollUp';
+  tabBarMinimizeBehavior?:
+    | 'auto'
+    | 'none'
+    | 'onScrollDown'
+    | 'onScrollUp'
+    | undefined;
 
   /**
    * Background color of the active indicator.
@@ -331,7 +344,7 @
```

**File**: `packages/core/src/BaseNavigationContainer.tsx` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ import { useSyncState } from './useSyncState';
 type State = NavigationState | PartialState<NavigationState> | undefined;
 
 type Props<ParamList extends {}> = NavigationContainerProps & {
-  ref?: React.Ref<NavigationContainerRef<ParamList>>;
+  ref?: React.Ref<NavigationContainerRef<ParamList>> | undefined;
 };
 
 /**
```

**File**: `packages/core/src/types.tsx` (modified, +1/-1)
```diff
@@ -259,7 +259,7 @@ export type EventEmitter<in out EventMap extends EventMapBase> = {
   emit<EventName extends KeyOf<EventMap>>(
     options: {
       type: EventName;
-      target?: string;
+      target?: string | undefined;
     } & (EventMap[EventName]['canPreventDefault'] extends true
       ? { canPreventDefault: true }
       : {}) &
```

**File**: `packages/core/src/useEventEmitter.tsx` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ export function useEventEmitter<T extends Record<string, any>>(
     }: {
       type: string;
       data?: any;
-      target?: string;
+      target?: string | undefined;
       canPreventDefault?: boolean;
     }) => {
       const items = listeners.current[type];
```

**File**: `packages/drawer/src/types.tsx` (modified, +30/-24)
```diff
@@ -29,31 +29,33 @@ export type DrawerNavigationConfig = {
    * Function that returns React element to render as the content of the drawer, for example, navigation items.
    * Defaults to `DrawerContent`.
    */
-  drawerContent?: (props: DrawerContentComponentProps) => React.ReactNode;
+  drawerContent?:
+    | ((props: DrawerContentComponentProps) => React.ReactNode)
+    | undefined;
 };
 
 export type DrawerNavigationOptions = HeaderOptions & {
   /**
    * Title text for the screen.
    */
-  title?: string;
+  title?: string | undefined;
 
   /**
    * Whether this screens should render the first time it's accessed. Defaults to `true`.
    * Set it to `false` if you want to render the screen on initial render.
    */
-  lazy?: boolean;
+  lazy?: boolean | undefined;
 
   /**
    * Function that returns a React Element to display as a header.
    */
-  header?: (props: DrawerHeaderProps) => React.ReactNode;
+  header?: ((props: DrawerHeaderProps) => React.ReactNode) | undefined;
 
   /**
    * Whether to show the header. Setting this to `false` hides the header.
    * Defaults to `true`.
    */
-  headerShown?: boolean;
+  headerShown?: boolean | undefined;
 
   /**
    * Title string of a screen displayed in the drawer
@@ -62,7 +64,8 @@ export type DrawerNavigationOptions = HeaderOptions & {
    */
   drawerLabel?:
     | string
-    | ((props: { color: ColorValue; focused: boolean }) => React.ReactNode);
+    | ((props: { color: ColorValue; focused: boolean }) => React.ReactNode)
+    | undefined;
 
   /**
    * Icon to display for the drawer item.
@@ -73,32 +76,33 @@ export type DrawerNavigationOptions = HeaderOptions & {
         color: ColorValue;
         size: number;
         focused: boolean;
-      }) => Icon | React.ReactNode);
+      }) => Icon | React.ReactNode)
+    | undefined;
 
   /**
    * Color for the icon and label in the active item in the drawer.
    */
-  drawerActiveTintColor?: ColorValue;
+  drawerActiveTintColor?: ColorValue | undefined;
 
   /**
    * Background color for the active item in the drawer.
    */
-  drawerActiveBackgroundColor?: ColorValue;
+  drawerActiveBackgroundColor?: ColorValue | undefined;
 
   /**
    * Color for the icon and label in the inactive items in the drawer.
    */
-  drawerInactiveTintColor?: ColorValue;
+  drawerInactiveTintColor?: ColorValue | undefined;
 
   /**
    * Background color for the inactive items in the drawer.
    */
-  drawerInactiveBackgroundColor?: ColorValue;
+  drawerInactiveBackgroundColor?: ColorValue | undefined;
 
   /**
    * Whether label font should scale to respect Text Size accessibility settings.
    */
-  drawerAllowFontScaling?: boolean;
+  drawerAllowFontScaling?: boolean | undefined;
 
   /**
    * Style object for the single item, which can contain an icon and/or a label.
@@ -108,7 +112,7 @@ export type DrawerNavigationOptions = HeaderOptions & {
   /**
    * ID to locate this drawer item in tests.
    */
-  drawerItemTestID?: string;
+  drawerItemTestID?: string | undefined;
 
   /**
    * Style object to apply to the `Text` inside content section which renders a label.
@@ -134,7 +138,7 @@ export type DrawerNavigationOptions = HeaderOptions & {
   /**
    * Position of the drawer on the screen. Defaults to `left`.
    */
-  drawerPosition?: 'left' | 'right';
+  drawerPosition?: 'left' | 'right' | undefined;
 
   /**
    * Type of the drawer. It determines how the drawer looks and animates.
@@ -150,12 +154,12 @@ export type DrawerNavigationOptions = HeaderOptions & {
   /**
    * Whether the statusbar should be hidden when the drawer is pulled or opens,
    */
-  drawerHideStatusBarOnOpen?: boolean;
+  drawerHideStatusBarOnOpen?: boolean | undefined;
 
   /**
    * Animation of the statusbar when hiding it. use in combination with `drawerHideStatusBarOnOpen`.
    */
-  drawerStatusBarAnimation?: 'slide' | 'none' | 'fade';
+  drawerStatusBarAnimation?: 'slide' | 'none' | 'fade' | undefined;
 
   /**
    * Color of the overlay to be displayed on top of the content view when drawer gets open.
@@ -167,7 +171,7 @@ export type DrawerNavigationOptions = HeaderOptions & {
    * Accessibility label for the overlay. This is read by the screen reader when the user taps the overlay.
    * Defaults to "Close drawer".
    */
-  overlayAccessibilityLabel?: string;
+  overlayAccessibilityLabel?: string | undefined;
 
   /**
    * Style object for the component wrapping the screen content.
@@ -177,37 +181,39 @@ export type DrawerNavigationOptions = HeaderOptions & {
   /**
    * Function to modify the pan gesture config.
    */
-  configureGestureHandler?: (gesture: PanGestureConfig) => PanGestureConfig;
+  configureGestureHandler?:
+    | ((gesture: PanGestureConfig) => PanGestureConfig)
+    | undefined;
 
   /**
    * Whether you can use swipe gestures to open or close the drawer.
    * Defaults to `true`.
    * Not supported on Web.
    */
-  swipeEnabled?: boolean;
+  swipeEnabled?: boolean | undefined;
 
   /**
    * 
```

**File**: `packages/drawer/src/views/DrawerContentScrollView.tsx` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ import { DrawerPositionContext } from '../utils/DrawerPositionContext';
 
 type Props = ScrollViewProps & {
   children: React.ReactNode;
-  ref?: React.Ref<React.ComponentRef<typeof ScrollView>>;
+  ref?: React.Ref<React.ComponentRef<typeof ScrollView>> | undefined;
 };
 
 const SPACING = 12;
```

**File**: `packages/elements/src/Label/Label.tsx` (modified, +2/-2)
```diff
@@ -9,8 +9,8 @@ import {
 import { Text } from '../Text';
 
 type Props = Omit<TextProps, 'style'> & {
-  tintColor?: ColorValue;
-  children?: string;
+  tintColor?: ColorValue | undefined;
+  children?: string | undefined;
   style?: StyleProp<TextStyle>;
 };
 
```

**File**: `packages/elements/src/PlatformPressable.tsx` (modified, +3/-3)
```diff
@@ -13,9 +13,9 @@ import {
 } from 'react-native';
 
 type HoverEffectProps = {
-  color?: string;
-  hoverOpacity?: number;
-  activeOpacity?: number;
+  color?: string | undefined;
+  hoverOpacity?: number | undefined;
+  activeOpacity?: number | undefined;
 };
 
 export type Props = Omit<PressableProps, 'style' | 'onPress'> & {
```

---

### Incident Patch 3: `1f8cd35e` (2026-09-29)
**Commit Message**: fix: use isRepeated from the native event to check repeated press

**File**: `packages/bottom-tabs/src/views/BottomTabViewNativeImpl.tsx` (modified, +4/-7)
```diff
@@ -209,7 +209,8 @@ export function BottomTabViewNative({
   // JS sends a requested tab with the native provenance it was based on.
   // Native replies with the selected tab and its new provenance.
   const onTabSelected = (event: NativeSyntheticEvent<TabSelectedEvent>) => {
-    const { selectedScreenKey, provenance, actionOrigin } = event.nativeEvent;
+    const { selectedScreenKey, provenance, actionOrigin, isRepeated } =
+      event.nativeEvent;
 
     const confirmed = {
       routeKey: selectedScreenKey,
@@ -230,8 +231,6 @@ export function BottomTabViewNative({
       const { tabBarRepeatedPressBehavior } =
         descriptors[route.key]?.options ?? {};
 
-      const isRepeatedPress = focusedRouteKey === route.key;
-
       const event = navigation.emit({
         type: 'tabPress',
         target: route.key,
@@ -240,11 +239,9 @@ export function BottomTabViewNative({
           origin: 'native',
           behavior: {
             scrollToTop:
-              isRepeatedPress &&
-              tabBarRepeatedPressBehavior?.scrollToTop !== false,
+              isRepeated && tabBarRepeatedPressBehavior?.scrollToTop !== false,
             popToTop:
-              isRepeatedPress &&
-              tabBarRepeatedPressBehavior?.popToTop !== false,
+              isRepeated && tabBarRepeatedPressBehavior?.popToTop !== false,
           },
         },
       });
```

---

### Incident Patch 4: `57d79ba8` (2026-09-28)
**Commit Message**: chore: fix loader test failure on small devices

**File**: `example/e2e/maestro/loaders.yml` (modified, +8/-2)
```diff
@@ -82,7 +82,10 @@ name: Loaders
     file: ../launch.yml
     env:
       LINK: loaders
-      TEXT: 'Make next load fail'
+      TEXT: 'Tyrannosaurus rex'
+- scrollUntilVisible:
+    element:
+      text: 'Make next load fail'
 - tapOn:
     text: 'Make next load fail'
 - tapOn:
@@ -109,7 +112,10 @@ name: Loaders
     file: ../launch.yml
     env:
       LINK: loaders
-      TEXT: 'Make next load fail'
+      TEXT: 'Tyrannosaurus rex'
+- scrollUntilVisible:
+    element:
+      text: 'Make next load fail'
 - tapOn:
     text: 'Make next load fail'
 - tapOn:
```

**File**: `example/e2e/tests/maestro.test.ts` (modified, +12/-0)
```diff
@@ -240,6 +240,18 @@ async function runStep(page: Page, step: any) {
       break;
     }
 
+    case 'scrollUntilVisible': {
+      const locator = query(page, step.scrollUntilVisible.element)
+        .filter({ visible: true })
+        .last();
+
+      await locator.scrollIntoViewIfNeeded({
+        timeout: step.scrollUntilVisible.timeout,
+      });
+
+      break;
+    }
+
     case 'swipe': {
       const duration = step.swipe.duration || 300;
 
```

**File**: `example/src/Screens/Loaders.tsx` (modified, +7/-0)
```diff
@@ -21,6 +21,7 @@ import {
   StyleSheet,
   View,
 } from 'react-native';
+import { SafeAreaView } from 'react-native-screens/experimental';
 
 import iconBookOpen from '../../assets/icons/book-open.png';
 import iconPawPrint from '../../assets/icons/paw-print.png';
@@ -318,6 +319,12 @@ const LoaderTabs = createBottomTabNavigator({
   screens: {
     DinoList: {
       screen: DinoCatalogScreen,
+      layout: ({ children }) =>
+        Platform.OS === 'android' ? (
+          <SafeAreaView edges={{ bottom: true }}>{children}</SafeAreaView>
+        ) : (
+          children
+        ),
       options: {
         title: 'Catalog',
         tabBarIcon: Platform.select<Icon>({
```

---

### Incident Patch 5: `859fb191` (2026-09-28)
**Commit Message**: chore: fix loader test failure on Android and iOS

**File**: `example/src/Screens/Loaders.tsx` (modified, +1/-0)
```diff
@@ -311,6 +311,7 @@ function Provider({ children }: { children: React.ReactNode }) {
 }
 
 const LoaderTabs = createBottomTabNavigator({
+  layout: ({ children }) => <Layout>{children}</Layout>,
   screenOptions: {
     lazy: true,
   },
```

---

### Incident Patch 6: `f3da8cda` (2026-09-28)
**Commit Message**: fix: handle source for navigate and jumpTo in tab and drawer

- navigating from an invalid `source` is no longer handled
- for `history` and `fullHistory`, history entries after `source` are
  now removed
- if `source` is a valid route, but not in history, it's handled as
  normal

**File**: `packages/routers/src/SwitchRouter.tsx` (modified, +33/-0)
```diff
@@ -420,6 +420,39 @@ export function SwitchRouter<Type extends SwitchRouterType>({
             return null;
           }
 
+          if (action.source !== undefined) {
+            const sourceIndex = state.routes.findIndex(
+              (route) => route.key === action.source
+            );
+
+            if (sourceIndex === -1) {
+              return null;
+            }
+
+            if (backBehavior === 'history' || backBehavior === 'fullHistory') {
+              const sourceHistoryIndex = state.history.findLastIndex(
+                (item) => item.type === 'route' && item.key === action.source
+              );
+
+              if (sourceHistoryIndex !== -1) {
+                const history = state.history.filter(
+                  (item, index) =>
+                    item.type !== 'route' || index <= sourceHistoryIndex
+                );
+
+                state = {
+                  ...state,
+                  ...changeIndex<Type>(
+                    { routes: state.routes, history },
+                    sourceIndex,
+                    backBehavior,
+                    initialRouteName
+                  ),
+                };
+              }
+            }
+          }
+
           const route = state.routes[index];
 
           if (route == null) {
```

**File**: `packages/routers/src/__tests__/DrawerRouter.test.tsx` (modified, +188/-0)
```diff
@@ -1211,6 +1211,194 @@ test('go back closes drawer if it is open', () => {
   });
 });
 
+test('closes drawer on navigate from an unfocused source with backBehavior: history', () => {
+  const router = DrawerRouter({ backBehavior: 'history' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: DrawerNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'drawer',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+      { type: 'drawer', status: 'open' },
+    ],
+    preloadedRouteKeys: [],
+    default: 'closed',
+  };
+
+  expect(
+    router.getStateForAction(
+      state,
+      { ...CommonActions.navigate('qux'), source: 'bar' },
+      options
+    )
+  ).toEqual({
+    ...state,
+    index: 3,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'qux' },
+    ],
+  });
+});
+
+test('closes drawer on jump to action from an unfocused source with backBehavior: history', () => {
+  const router = DrawerRouter({ backBehavior: 'history' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: DrawerNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'drawer',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+      { type: 'drawer', status: 'open' },
+    ],
+    preloadedRouteKeys: [],
+    default: 'closed',
+  };
+
+  expect(
+    router.getStateForAction(
+      state,
+      { ...DrawerActions.jumpTo('qux'), source: 'bar' },
+      options
+    )
+  ).toEqual({
+    ...state,
+    index: 3,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'qux' },
+    ],
+  });
+});
+
+test('closes drawer on navigate from an unfocused source with backBehavior: fullHistory', () => {
+  const router = DrawerRouter({ backBehavior: 'fullHistory' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: DrawerNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'drawer',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+      { type: 'drawer', status: 'open' },
+    ],
+    preloadedRouteKeys: [],
+    default: 'closed',
+  };
+
+  expect(
+    router.getStateForAction(
+      state,
+      { ...CommonActions.navigate('qux'), source: 'bar' },
+      options
+    )
+  ).toEqual({
+    ...state,
+    index: 3,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'qux' },
+    ],
+  });
+});
+
+test('closes drawer on jump to action from an unfocused source with backBehavior: fullHistory', () => {
+  const router = DrawerRouter({ backBehavior: 'fullHistory' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: DrawerNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'drawer',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+      { type: 'drawer', status: 'open' },
+    ],
+    preloadedRouteKeys: [],
+    default: 'closed',
+  };
+
+  expect(
+    router.getStateForAction(
+      state,
+      { ...DrawerActions.jumpTo('qux'), source: 'bar' },
+      options
+    )
+  ).toEqual({
+    ...state,
+    index: 3,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'qux' },
+    ],
+  }
```

**File**: `packages/routers/src/__tests__/TabRouter.test.tsx` (modified, +1384/-0)
```diff
@@ -3663,6 +3663,1390 @@ test('goBack falls back to tab history when route history is empty', () => {
   });
 });
 
+test('goes back to the source after navigate from an unfocused route with backBehavior: history', () => {
+  const router = TabRouter({ backBehavior: 'history' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: TabNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'tab',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+    ],
+    preloadedRouteKeys: [],
+  };
+
+  const result = router.getStateForAction(
+    state,
+    { ...CommonActions.navigate('qux'), source: 'bar' },
+    options
+  );
+
+  expect(result).toEqual({
+    ...state,
+    index: 3,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'qux' },
+    ],
+  });
+
+  if (result == null || result.stale !== false) {
+    throw new Error('Expected navigate to return a complete state.');
+  }
+
+  expect(
+    router.getStateForAction(result, CommonActions.goBack(), options)
+  ).toEqual({
+    ...state,
+    index: 1,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+    ],
+  });
+});
+
+test('goes back to the source after jump to action from an unfocused route with backBehavior: history', () => {
+  const router = TabRouter({ backBehavior: 'history' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: TabNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'tab',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+    ],
+    preloadedRouteKeys: [],
+  };
+
+  const result = router.getStateForAction(
+    state,
+    { ...TabActions.jumpTo('qux'), source: 'bar' },
+    options
+  );
+
+  expect(result).toEqual({
+    ...state,
+    index: 3,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'qux' },
+    ],
+  });
+
+  if (result == null || result.stale !== false) {
+    throw new Error('Expected jumpTo to return a complete state.');
+  }
+
+  expect(
+    router.getStateForAction(result, CommonActions.goBack(), options)
+  ).toEqual({
+    ...state,
+    index: 1,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+    ],
+  });
+});
+
+test('goes back to the source after navigate from an unfocused route with backBehavior: fullHistory', () => {
+  const router = TabRouter({ backBehavior: 'fullHistory' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: TabNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'tab',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+    ],
+    preloadedRouteKeys: [],
+  };
+
+  const result = router.getStateForAction(
+    state,
+    { ...CommonActions.navigate('qux'), source: 'bar' },
+    options
+  );
+
+  expect(result).toEqual({
+    ...state,
+    index: 3,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'qux' },
+    ],
+  });
+
+  if (result == null || result.stale !== false) {
+    throw new Error('Expected navigate to return a complete state.');
+  }
+
+  expect(
+    router.getStateForAction(result, CommonActions.goBack(), options)
+  ).toEqual({
+    ...state,
+    index: 1,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+    ],
+  });
+});
+
+test('goes back to the source after jump to action from an unfocused route with backBehavior: fullHistory', () => {
+  const router = TabRouter({ backBehavior: 'fullHistory' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+   
```

---

### Incident Patch 7: `6870eda7` (2026-09-21)
**Commit Message**: fix: handle browser back from committed navigation state

**File**: `packages/native/src/__tests__/useLinking.web.test.tsx` (modified, +1094/-1)
```diff
@@ -10,13 +10,17 @@ import {
   type NavigationState,
   type NavigatorScreenParams,
   type ParamListBase,
+  type RouteProp,
   StackActions,
   StackRouter,
   TabRouter,
+  useIsFocused,
+  useNavigation,
   useNavigationBuilder,
   usePreventRemove,
 } from '@react-navigation/core';
-import { act, render, waitFor } from '@testing-library/react';
+import { act, render, screen, waitFor } from '@testing-library/react';
+import userEvent from '@testing-library/user-event';
 import * as React from 'react';
 import { Text } from 'react-native';
 
@@ -2140,6 +2144,1095 @@ test("doesn't update URL until navigation to a suspending screen commits", async
   await waitFor(() => expect(window.location.pathname).toBe('/profile'));
 });
 
+test('preserves updated params on browser back when navigation suspends', async () => {
+  const Stack = createStackNavigator();
+
+  const linking = {
+    config: {
+      screens: { Home: '', Profile: 'profile', Settings: 'settings' },
+    },
+  };
+
+  const { promise, resolve } = Promise.withResolvers<void>();
+
+  const SettingsScreen = () => {
+    React.use(promise);
+
+    return <Text>Settings</Text>;
+  };
+
+  const navigation = createNavigationContainerRef<ParamListBase>();
+
+  render(
+    <NavigationContainer ref={navigation} linking={linking}>
+      <React.Suspense fallback={<Text>Loading</Text>}>
+        <Stack.Navigator>
+          <Stack.Screen name="Home" component={TestScreen} />
+          <Stack.Screen name="Profile" component={TestScreen} />
+          <Stack.Screen name="Settings" component={SettingsScreen} />
+        </Stack.Navigator>
+      </React.Suspense>
+    </NavigationContainer>
+  );
+
+  const homeKey = navigation.getCurrentRoute()?.key;
+
+  await act(async () => navigation.navigate('Profile'));
+
+  await waitFor(() => expect(window.location.pathname).toBe('/profile'));
+
+  await act(async () =>
+    navigation.dispatch({
+      ...CommonActions.setParams({ updated: true }),
+      source: homeKey,
+    })
+  );
+
+  await act(async () => navigation.navigate('Settings'));
+
+  expect(window.location.pathname).toBe('/profile');
+
+  act(() => window.history.back());
+
+  await waitFor(() => expect(navigation.getCurrentRoute()?.name).toBe('Home'));
+
+  expect(navigation.getRootState()?.routes).toEqual([
+    expect.objectContaining({
+      key: homeKey,
+      name: 'Home',
+      params: { updated: true },
+    }),
+  ]);
+  expect(window.location.pathname).toBe('/');
+
+  await act(async () => {
+    resolve();
+
+    await promise;
+  });
+
+  expect(navigation.getCurrentRoute()?.name).toBe('Home');
+
+  act(() => window.history.forward());
+
+  await waitFor(() =>
+    expect(navigation.getCurrentRoute()?.name).toBe('Profile')
+  );
+
+  expect(window.location.pathname).toBe('/profile');
+});
+
+test('replaces an interrupted destination when navigating again from the visible screen', async () => {
+  const Stack = createStackNavigator();
+
+  const linking = {
+    config: {
+      screens: { Home: '', Profile: 'profile', Settings: 'settings' },
+    },
+  };
+
+  const { promise, resolve } = Promise.withResolvers<void>();
+
+  const HomeScreen = () => {
+    const navigation = useNavigation();
+
+    return (
+      <button
+        type="button"
+        onClick={() => navigation.dispatch(CommonActions.navigate('Settings'))}
+      >
+        Open settings
+      </button>
+    );
+  };
+
+  const ProfileScreen = () => {
+    React.use(promise);
+
+    return <Text>Profile</Text>;
+  };
+
+  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
+
+  const navigation = createNavigationContainerRef<ParamListBase>();
+
+  render(
+    <NavigationContainer ref={navigation} linking={linking}>
+      <React.Suspense fallback={<Text>Loading</Text>}>
+        <Stack.Navigator>
+          <Stack.Screen name="Home" component={HomeScreen} />
+          <Stack.Screen name="Profile" component={ProfileScreen} />
+          <Stack.Screen name="Settings" component={TestScreen} />
+        </Stack.Navigator>
+      </React.Suspense>
+    </NavigationContainer>
+  );
+
+  await act(async () => navigation.navigate('Profile'));
+
+  expect(window.location.pathname).toBe('/');
+
+  await user.click(screen.getByRole('button', { name: 'Open settings' }));
+
+  await waitFor(() => expect(window.location.pathname).toBe('/settings'));
+
+  expect(navigation.getRootState()?.routes.map((route) => route.name)).toEqual([
+    'Home',
+    'Settings',
+  ]);
+
+  await act(async () => {
+    resolve();
+
+    await promise;
+  });
+
+  act(() => window.history.back());
+
+  await waitFor(() => expect(window.location.pathname).toBe('/'));
+
+  expect(navigation.getCurrentRoute()?.name).toBe('Home');
+});
+
+test('preserves updated params on browser back when nested navigation suspends', async () => {
+  const Stack = createStackNavigator();
+
+  const Tab = createTabNavigator();
+
+  const linking = {
+    config: {
+      screens: {
+      
```

**File**: `packages/native/src/useLinking.tsx` (modified, +118/-60)
```diff
@@ -136,6 +136,38 @@ const findMatchingState = <T extends NavigationState>(
   return findMatchingState(aChildState, bChildState);
 };
 
+/**
+ * Calculate the history delta between 2 navigation states.
+ * If no common navigation state is found, only replace the history entry.
+ */
+const getHistoryDelta = (
+  previous: NavigationState | undefined,
+  next: NavigationState | undefined
+): PopStateDelta => {
+  const [previousFocused, nextFocused] = findMatchingState(previous, next);
+
+  return previousFocused && nextFocused
+    ? getTotalHistoryLength(nextFocused) -
+        getTotalHistoryLength(previousFocused)
+    : 'replace';
+};
+
+/**
+ * Check if navigator history matches between committed and latest state.
+ */
+const hasMatchingBackHistory = (
+  current: NavigationState,
+  latest: NavigationState
+): boolean => {
+  if (current.history !== undefined || latest.history !== undefined) {
+    return isEqual(current.history, latest.history);
+  }
+
+  return current.routes
+    .slice(0, Math.min(current.index, latest.index) + 1)
+    .every((route, i) => route.key === latest.routes[i]?.key);
+};
+
 /**
  * Check if the state change is popping the last route or history entry.
  */
@@ -314,9 +346,9 @@ export function useLinking<ParamList extends ParamListBase>(
 
   const previousIndexRef = React.useRef<number | undefined>(undefined);
   const previousStateRef = React.useRef<NavigationState | undefined>(undefined);
-  const pendingPopStateDeltaRef = React.useRef<PopStateDelta | undefined>(
-    undefined
-  );
+  const pendingPopStateRef = React.useRef<
+    { state: NavigationState | undefined; delta: PopStateDelta } | undefined
+  >(undefined);
 
   React.useEffect(() => {
     if (!history) {
@@ -397,7 +429,10 @@ export function useLinking<ParamList extends ParamListBase>(
         if (actionChangedState) {
           // The change may be committed later, e.g. with transitions
           // Remember the delta so it can be subtracted when syncing the commit
-          pendingPopStateDeltaRef.current = pendingDelta;
+          pendingPopStateRef.current = {
+            state: navigation.getRootState(),
+            delta: pendingDelta,
+          };
         } else if (removePrevented) {
           rollbackHistory();
         }
@@ -429,37 +464,73 @@ export function useLinking<ParamList extends ParamListBase>(
       const record = history.get(index);
 
       if (record?.path === path && record?.state) {
-        const currentState = navigation.getRootState();
+        const pending = pendingPopStateRef.current;
+
+        // Use the state synced to browser history or the result of a pending traversal,
+        // since the store may already contain another navigation that hasn't committed yet.
+        const currentState = pending?.state ?? previousStateRef.current;
 
         const [currentFocused, recordFocused] = findMatchingState(
           currentState,
           record.state
         );
 
+        const [latestFocused] = findMatchingState(
+          navigation.getRootState(),
+          record.state
+        );
+
+        const [pendingFocused] = findMatchingState(
+          previousStateRef.current,
+          pending?.state
+        );
+
+        const currentRoute = currentFocused?.routes[currentFocused.index];
+        const latestRoute =
+          latestFocused &&
+          getRoutesUntilIndex(latestFocused).find(
+            (route) => route.key === currentRoute?.key
+          );
+
         if (
           previousIndex - index === 1 &&
           currentFocused &&
           recordFocused &&
+          latestFocused &&
+          currentFocused.key === latestFocused.key &&
+          // Only combine pending browser history deltas within the same navigator,
+          // as history lengths from different navigators aren't comparable.
+          (!pending?.state || pendingFocused?.key === currentFocused.key) &&
+          // We don't want to dispatch `goBack` if route history has grown since,
+          // as we can't specify the entry to go back from.
+          // We can only specify route to go back from with `source`.
+          // Entries removed since are fine, they were already popped by a back action.
+          (latestRoute?.history?.length ?? 0) <=
+            (currentRoute?.history?.length ?? 0) &&
+          hasMatchingBackHistory(currentFocused, latestFocused) &&
           isPoppingLastEntry(currentFocused, recordFocused)
         ) {
-          const pending = pendingPopStateDeltaRef.current;
-
           // If we detect that the state change is popping the last entry
           // Dispatch a back action instead of resetting to the state
           // This makes sure changes to history state since the entry was added don't get lost
           dispatch(
-            CommonActions.goBack(),
+            {
+              ...CommonActions.goBack(),
+              target: currentFocused.key,
+              // If another back action already removed the source, go ba
```

---

### Incident Patch 8: `fa94afe7` (2026-09-21)
**Commit Message**: fix: use the remove action when dismissing stack screens

**File**: `packages/native-stack/src/__tests__/index.test.tsx` (modified, +241/-1)
```diff
@@ -7,8 +7,15 @@ import {
   test,
 } from '@jest/globals';
 import { useHeaderHeight } from '@react-navigation/elements';
-import { NavigationContainer } from '@react-navigation/native';
 import {
+  CommonActions,
+  createNavigationContainerRef,
+  NavigationContainer,
+  StackActions,
+} from '@react-navigation/native';
+import {
+  act,
+  fireEvent,
   isHiddenFromAccessibility,
   render,
   screen,
@@ -40,6 +47,239 @@ afterEach(() => {
   jest.restoreAllMocks();
 });
 
+test('keeps a newly pushed screen when an earlier screen finishes dismissing', async () => {
+  type ParamList = {
+    A: undefined;
+    B: undefined;
+    C: undefined;
+  };
+
+  const Stack = createNativeStackNavigator<ParamList>();
+
+  const navigation = createNavigationContainerRef<ParamList>();
+
+  const Test = ({ route }: NativeStackScreenProps<ParamList>) => (
+    <Text>Screen {route.name}</Text>
+  );
+
+  await render(
+    <NavigationContainer
+      ref={navigation}
+      initialState={{
+        index: 1,
+        routes: [{ name: 'A' }, { name: 'B' }],
+      }}
+    >
+      <Stack.Navigator>
+        <Stack.Screen name="A" component={Test} />
+        <Stack.Screen name="B" component={Test} />
+        <Stack.Screen name="C" component={Test} />
+      </Stack.Navigator>
+    </NavigationContainer>
+  );
+
+  await act(() => navigation.dispatch(StackActions.push('C')));
+
+  await fireEvent(
+    screen.getByText('Screen B', { includeHiddenElements: true }),
+    'dismissed',
+    { nativeEvent: { dismissCount: 1 } }
+  );
+
+  expect(navigation.getRootState()?.routes.map((route) => route.name)).toEqual([
+    'A',
+    'C',
+  ]);
+
+  expect(isHiddenFromAccessibility(screen.getByText('Screen C'))).toBe(false);
+});
+
+test('keeps a newly pushed screen when multiple screens finish dismissing', async () => {
+  type ParamList = {
+    A: undefined;
+    B: undefined;
+    C: { value: number };
+    D: undefined;
+  };
+
+  const Stack = createNativeStackNavigator<ParamList>();
+
+  const navigation = createNavigationContainerRef<ParamList>();
+
+  const Test = ({ route }: NativeStackScreenProps<ParamList>) => (
+    <Text>Screen {route.name}</Text>
+  );
+
+  await render(
+    <NavigationContainer
+      ref={navigation}
+      initialState={{
+        index: 2,
+        routes: [
+          { name: 'A' },
+          { name: 'B' },
+          { name: 'C', params: { value: 1 } },
+        ],
+      }}
+    >
+      <Stack.Navigator>
+        <Stack.Screen name="A" component={Test} />
+        <Stack.Screen name="B" component={Test} />
+        <Stack.Screen name="C" component={Test} />
+        <Stack.Screen name="D" component={Test} />
+      </Stack.Navigator>
+    </NavigationContainer>
+  );
+
+  await act(() => navigation.dispatch(CommonActions.pushParams({ value: 2 })));
+
+  await act(() => navigation.dispatch(StackActions.push('D')));
+
+  await fireEvent(
+    screen.getByText('Screen C', { includeHiddenElements: true }),
+    'dismissed',
+    { nativeEvent: { dismissCount: 2 } }
+  );
+
+  expect(isHiddenFromAccessibility(screen.getByText('Screen D'))).toBe(false);
+  expect(
+    screen.queryByText('Screen B', { includeHiddenElements: true })
+  ).toBeNull();
+  expect(
+    screen.queryByText('Screen C', { includeHiddenElements: true })
+  ).toBeNull();
+
+  await act(() => navigation.goBack());
+
+  expect(isHiddenFromAccessibility(screen.getByText('Screen A'))).toBe(false);
+});
+
+test('preserves retained and preloaded screens when multiple screens are dismissed', async () => {
+  type ParamList = {
+    A: undefined;
+    B: undefined;
+    C: undefined;
+    D: undefined;
+    E: undefined;
+  };
+
+  const Stack = createNativeStackNavigator<ParamList>();
+
+  const navigation = createNavigationContainerRef<ParamList>();
+
+  const Test = ({ route }: NativeStackScreenProps<ParamList>) => (
+    <Text>Screen {route.name}</Text>
+  );
+
+  await render(
+    <NavigationContainer
+      ref={navigation}
+      initialState={{
+        index: 2,
+        routes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
+      }}
+    >
+      <Stack.Navigator>
+        <Stack.Screen name="A" component={Test} />
+        <Stack.Screen name="B" component={Test} />
+        <Stack.Screen name="C" component={Test} />
+        <Stack.Screen name="D" component={Test} />
+        <Stack.Screen name="E" component={Test} />
+      </Stack.Navigator>
+    </NavigationContainer>
+  );
+
+  await act(() => navigation.preload('D'));
+
+  const preloadedRoute = navigation
+    .getRootState()
+    ?.routes.find((route) => route.name === 'D');
+
+  await act(() =>
+    navigation.dispatch({
+      ...StackActions.retain(true),
+      source: preloadedRoute?.key,
+    })
+  );
+
+  await act(() => navigation.preload('E'));
+
+  await fireEvent(screen.getByText('Screen C'), 'dismissed', {
+    nativeEvent: { dismissCount: 2 },
+  });
+
+  expect(isHiddenFromAccessibility(screen.getByText('Screen A'))).toBe(false);
+  expect(
+
```

**File**: `packages/native-stack/src/views/NativeStackView.native.tsx` (modified, +12/-14)
```diff
@@ -570,19 +570,14 @@ export function NativeStackView({ state, navigation, descriptors }: Props) {
                 });
               }}
               onDismissed={(event) => {
-                const currentState = navigation.getState();
-                const currentActiveRoutes = currentState.routes.slice(
-                  0,
-                  currentState.index + 1
-                );
-
-                if (currentActiveRoutes.some((r) => r.key === route.key)) {
-                  navigation.dispatch({
-                    ...StackActions.pop(event.nativeEvent.dismissCount),
-                    source: route.key,
-                    target: currentState.key,
-                  });
-                }
+                navigation.dispatch({
+                  ...StackActions.remove(
+                    route.name,
+                    event.nativeEvent.dismissCount
+                  ),
+                  source: route.key,
+                  target: state.key,
+                });
 
                 setNextDismissedKey(route.key);
               }}
@@ -595,7 +590,10 @@ export function NativeStackView({ state, navigation, descriptors }: Props) {
               }}
               onNativeDismissCancelled={(event) => {
                 navigation.dispatch({
-                  ...StackActions.pop(event.nativeEvent.dismissCount),
+                  ...StackActions.remove(
+                    route.name,
+                    event.nativeEvent.dismissCount
+                  ),
                   source: route.key,
                   target: state.key,
                 });
```

**File**: `packages/stack/src/views/Stack/StackView.tsx` (modified, +5/-3)
```diff
@@ -440,16 +440,18 @@ export class StackView extends React.Component<Props, State> {
   };
 
   private handleCloseRoute = ({ route }: { route: Route<string> }) => {
-    const { state, navigation } = this.props;
+    const { navigation } = this.props;
+
+    const state = navigation.getState();
 
     const activeRoutes = state.routes.slice(0, state.index + 1);
 
     if (activeRoutes.some((r) => r.key === route.key)) {
-      // If a route exists in state, trigger a pop
+      // If a route exists in state, remove it
       // This will happen in when the route was closed from the card component
       // e.g. When the close animation triggered from a gesture ends
       navigation.dispatch({
-        ...StackActions.pop(),
+        ...StackActions.remove(route.name),
         source: route.key,
         target: state.key,
       });
```

---

### Incident Patch 9: `34a10510` (2026-09-21)
**Commit Message**: fix: preserve navigator state types in navigation helpers

**File**: `packages/bottom-tabs/src/types.tsx` (modified, +2/-1)
```diff
@@ -61,6 +61,7 @@ export type LabelPosition = 'beside-icon' | 'below-icon';
 
 export type BottomTabNavigationHelpers = NavigationHelpers<
   ParamListBase,
+  TabNavigationState<ParamListBase>,
   BottomTabNavigationEventMap
 > &
   TabActionHelpers<ParamListBase>;
@@ -685,7 +686,7 @@ export type BottomTabHeaderProps = {
 export type BottomTabBarProps = {
   state: TabNavigationState<ParamListBase>;
   descriptors: BottomTabDescriptorMap;
-  navigation: NavigationHelpers<ParamListBase, BottomTabNavigationEventMap>;
+  navigation: BottomTabNavigationHelpers;
 };
 
 export type BottomTabBarButtonProps = Omit<
```

**File**: `packages/core/src/types.tsx` (modified, +3/-2)
```diff
@@ -81,7 +81,7 @@ export type DefaultNavigatorOptions<
   layout?:
     | ((props: {
         state: State;
-        navigation: NavigationHelpers<ParamList>;
+        navigation: NavigationHelpers<ParamList, State>;
         descriptors: Record<
           string,
           Descriptor<
@@ -470,8 +470,9 @@ type NavigationHelpersRoute<
 
 export type NavigationHelpers<
   ParamList extends ParamListBase,
+  State extends NavigationState = NavigationState<ParamList>,
   EventMap extends EventMapBase = {},
-> = NavigationHelpersCommon<ParamList> &
+> = NavigationHelpersCommon<ParamList, State> &
   EventEmitter<EventMap> &
   NavigationHelpersRoute<ParamList, keyof ParamList> &
   PrivateValueStore<[ParamList, unknown, unknown, unknown]>;
```

**File**: `packages/core/src/useDescriptors.tsx` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ type Options<
     ScreenConfigWithParent<State, ScreenOptions, EventMap>
   >;
   state: State;
-  navigation: NavigationHelpers<ParamListBase>;
+  navigation: NavigationHelpers<ParamListBase, State>;
   screenOptions: ScreenOptionsOrCallback<ScreenOptions> | undefined;
   screenLayout: ScreenLayout<ScreenOptions> | undefined;
   onAction: (action: NavigationAction) => boolean;
```

**File**: `packages/core/src/useNavigationCache.tsx` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ type Options<
 > = {
   routes: State['routes'];
   getState: () => State;
-  navigation: NavigationHelpers<ParamListBase> &
+  navigation: NavigationHelpers<ParamListBase, State> &
     Partial<NavigationProp<ParamListBase, string, any, any, any>>;
   setOptions: (
     cb: (
```

**File**: `packages/core/src/useNavigationHelpers.tsx` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ export function useNavigationHelpers<
         );
       },
       getState,
-    } as NavigationHelpers<ParamListBase, EventMap> & ActionHelpers;
+    } as NavigationHelpers<ParamListBase, State, EventMap> & ActionHelpers;
 
     return navigationHelpers;
   }, [
```

**File**: `packages/drawer/src/types.tsx` (modified, +1/-0)
```diff
@@ -273,6 +273,7 @@ export type DrawerNavigationEventMap = {
 
 export type DrawerNavigationHelpers = NavigationHelpers<
   ParamListBase,
+  DrawerNavigationState<ParamListBase>,
   DrawerNavigationEventMap
 > &
   DrawerActionHelpers<ParamListBase>;
```

**File**: `packages/material-top-tabs/src/types.tsx` (modified, +2/-0)
```diff
@@ -44,6 +44,7 @@ export type MaterialTopTabNavigationEventMap = {
 
 export type MaterialTopTabNavigationHelpers = NavigationHelpers<
   ParamListBase,
+  TabNavigationState<ParamListBase>,
   MaterialTopTabNavigationEventMap
 > &
   TabActionHelpers<ParamListBase>;
@@ -343,6 +344,7 @@ export type MaterialTopTabBarProps = Pick<
   state: TabNavigationState<ParamListBase>;
   navigation: NavigationHelpers<
     ParamListBase,
+    TabNavigationState<ParamListBase>,
     MaterialTopTabNavigationEventMap
   >;
   descriptors: MaterialTopTabDescriptorMap;
```

**File**: `packages/native-stack/src/types.tsx` (modified, +1/-0)
```diff
@@ -74,6 +74,7 @@ export type NativeStackOptionsArgs<
 
 export type NativeStackNavigationHelpers = NavigationHelpers<
   ParamListBase,
+  StackNavigationState<ParamListBase>,
   NativeStackNavigationEventMap
 >;
 
```

---

### Incident Patch 10: `de6e25db` (2026-09-21)
**Commit Message**: test: move focus behavior tests to core integration suite

**File**: `packages/core/src/__tests__/index.test.tsx` (modified, +139/-0)
```diff
@@ -3375,6 +3375,145 @@ test('overrides router with router prop', async () => {
   });
 });
 
+test('returns correct value for isFocused', async () => {
+  const TestNavigator = (props: any) => {
+    const { state, descriptors, render } = useNavigationBuilder(
+      MockRouter,
+      props
+    );
+
+    return render(
+      state.routes.map((route) => descriptors[route.key]?.render())
+    );
+  };
+
+  let navigation: any;
+
+  const TestScreen = (props: any) => {
+    navigation = props.navigation;
+
+    return null;
+  };
+
+  await render(
+    <BaseNavigationContainer>
+      <TestNavigator>
+        <Screen name="first">{() => null}</Screen>
+        <Screen name="second" component={TestScreen} />
+        <Screen name="third">{() => null}</Screen>
+      </TestNavigator>
+    </BaseNavigationContainer>
+  );
+
+  expect(navigation.isFocused()).toBe(false);
+
+  await act(() => navigation.navigate('second'));
+
+  expect(navigation.isFocused()).toBe(true);
+
+  await act(() => navigation.navigate('third'));
+
+  expect(navigation.isFocused()).toBe(false);
+
+  await act(() => navigation.navigate('second'));
+
+  expect(navigation.isFocused()).toBe(true);
+});
+
+test('returns correct value for isFocused after changing screens', async () => {
+  const TestNavigator = (props: any) => {
+    const { state, descriptors, render } = useNavigationBuilder(
+      MockRouter,
+      props
+    );
+
+    return render(
+      state.routes.map((route) => descriptors[route.key]?.render())
+    );
+  };
+
+  const router: NonNullable<
+    Parameters<typeof useNavigationBuilder>[1]['router']
+  > = () => {
+    return {
+      getStateForRouteNamesChange(state, { routeNames }) {
+        const routes = routeNames.map(
+          (name) =>
+            state.routes.find((r) => r.name === name) || {
+              name,
+              key: name,
+            }
+        );
+
+        return {
+          ...state,
+          routeNames,
+          routes,
+          index: routes.length - 1,
+        };
+      },
+    };
+  };
+
+  let navigation: any;
+
+  const TestScreen = (props: any) => {
+    navigation = props.navigation;
+
+    return null;
+  };
+
+  const root = await render(
+    <BaseNavigationContainer>
+      <TestNavigator router={router}>
+        <Screen name="first">{() => null}</Screen>
+        <Screen name="second" component={TestScreen} />
+        <Screen name="third">{() => null}</Screen>
+      </TestNavigator>
+    </BaseNavigationContainer>
+  );
+
+  expect(navigation.isFocused()).toBe(false);
+
+  await root.rerender(
+    <BaseNavigationContainer>
+      <TestNavigator router={router}>
+        <Screen name="first">{() => null}</Screen>
+        <Screen name="third">{() => null}</Screen>
+        <Screen name="second" component={TestScreen} />
+      </TestNavigator>
+    </BaseNavigationContainer>
+  );
+
+  expect(navigation.isFocused()).toBe(true);
+
+  await root.rerender(
+    <BaseNavigationContainer>
+      <TestNavigator router={router}>
+        <Screen name="first">{() => null}</Screen>
+        <Screen name="third">{() => null}</Screen>
+        <Screen name="fourth">{() => null}</Screen>
+        <Screen name="second" component={TestScreen} />
+      </TestNavigator>
+    </BaseNavigationContainer>
+  );
+
+  expect(navigation.isFocused()).toBe(true);
+
+  await root.rerender(
+    <BaseNavigationContainer>
+      <TestNavigator router={router}>
+        <Screen name="first">{() => null}</Screen>
+        <Screen name="third">{() => null}</Screen>
+        <Screen name="second" component={TestScreen} />
+        <Screen name="fourth">{() => null}</Screen>
+      </TestNavigator>
+    </BaseNavigationContainer>
+  );
+
+  expect(navigation.isFocused()).toBe(false);
+});
+
 test('gets immediate parent with getParent()', async () => {
   const TestNavigator = (props: any): any => {
     const { state, descriptors, render } = useNavigationBuilder(
```

**File**: `packages/core/src/__tests__/useNavigationCache.test.tsx` (modified, +0/-117)
```diff
@@ -28,123 +28,6 @@ beforeEach(() => {
   MockRouterKey.current = 0;
 });
 
-test('returns correct value for isFocused', async () => {
-  let navigation: any;
-
-  const Test = (props: any) => {
-    navigation = props.navigation;
-
-    return null;
-  };
-
-  await render(
-    <BaseNavigationContainer>
-      <TestNavigator>
-        <Screen name="first">{() => null}</Screen>
-        <Screen name="second" component={Test} />
-        <Screen name="third">{() => null}</Screen>
-      </TestNavigator>
-    </BaseNavigationContainer>
-  );
-
-  expect(navigation.isFocused()).toBe(false);
-
-  await act(() => navigation.navigate('second'));
-
-  expect(navigation.isFocused()).toBe(true);
-
-  await act(() => navigation.navigate('third'));
-
-  expect(navigation.isFocused()).toBe(false);
-
-  await act(() => navigation.navigate('second'));
-
-  expect(navigation.isFocused()).toBe(true);
-});
-
-test('returns correct value for isFocused after changing screens', async () => {
-  const router: NonNullable<
-    Parameters<typeof useNavigationBuilder>[1]['router']
-  > = () => {
-    return {
-      getStateForRouteNamesChange(state, { routeNames }) {
-        const routes = routeNames.map(
-          (name) =>
-            state.routes.find((r) => r.name === name) || {
-              name,
-              key: name,
-            }
-        );
-
-        return {
-          ...state,
-          routeNames,
-          routes,
-          index: routes.length - 1,
-        };
-      },
-    };
-  };
-
-  let navigation: any;
-
-  const Test = (props: any) => {
-    navigation = props.navigation;
-
-    return null;
-  };
-
-  const root = await render(
-    <BaseNavigationContainer>
-      <TestNavigator router={router}>
-        <Screen name="first">{() => null}</Screen>
-        <Screen name="second" component={Test} />
-        <Screen name="third">{() => null}</Screen>
-      </TestNavigator>
-    </BaseNavigationContainer>
-  );
-
-  expect(navigation.isFocused()).toBe(false);
-
-  await root.rerender(
-    <BaseNavigationContainer>
-      <TestNavigator router={router}>
-        <Screen name="first">{() => null}</Screen>
-        <Screen name="third">{() => null}</Screen>
-        <Screen name="second" component={Test} />
-      </TestNavigator>
-    </BaseNavigationContainer>
-  );
-
-  expect(navigation.isFocused()).toBe(true);
-
-  await root.rerender(
-    <BaseNavigationContainer>
-      <TestNavigator router={router}>
-        <Screen name="first">{() => null}</Screen>
-        <Screen name="third">{() => null}</Screen>
-        <Screen name="fourth">{() => null}</Screen>
-        <Screen name="second" component={Test} />
-      </TestNavigator>
-    </BaseNavigationContainer>
-  );
-
-  expect(navigation.isFocused()).toBe(true);
-
-  await root.rerender(
-    <BaseNavigationContainer>
-      <TestNavigator router={router}>
-        <Screen name="first">{() => null}</Screen>
-        <Screen name="third">{() => null}</Screen>
-        <Screen name="second" component={Test} />
-        <Screen name="fourth">{() => null}</Screen>
-      </TestNavigator>
-    </BaseNavigationContainer>
-  );
-
-  expect(navigation.isFocused()).toBe(false);
-});
-
 test('keeps navigation objects stable across re-renders', async () => {
   const screens: Record<string, ScreenProps> = {};
 
```

---

### Incident Patch 11: `341b9627` (2026-09-22)
**Commit Message**: fix: fix animating state get stuck in bottom tabs in some scenarios

**File**: `packages/bottom-tabs/src/views/BottomTabViewCustom.tsx` (modified, +1/-3)
```diff
@@ -206,9 +206,7 @@ export function BottomTabViewCustom({
           // Delay clearing `animating` state
           // This will give time for `popToTop` to get handled before pause
           timer = setTimeout(() => {
-            setLastUpdate((update) =>
-              update.animating ? { ...update, animating: false } : update
-            );
+            setLastUpdate({ current: focusedRouteKey, animating: false });
           }, 32);
         }
       });
```

---

### Incident Patch 12: `f7fbf6f0` (2026-09-19)
**Commit Message**: fix: improve memoization for material top tabs

**File**: `packages/material-top-tabs/package.json` (modified, +2/-1)
```diff
@@ -47,7 +47,8 @@
   },
   "dependencies": {
     "@react-navigation/elements": "workspace:^",
-    "react-native-tab-view": "workspace:^"
+    "react-native-tab-view": "workspace:^",
+    "use-latest-callback": "^0.3.5"
   },
   "devDependencies": {
     "@jest/globals": "^30.4.1",
```

**File**: `packages/material-top-tabs/src/views/MaterialTopTabBar.tsx` (modified, +109/-57)
```diff
@@ -3,14 +3,25 @@ import { Color } from '@react-navigation/elements/internal';
 import { useLinkBuilder, useLocale, useTheme } from '@react-navigation/native';
 import * as React from 'react';
 import { type ColorValue, StyleSheet } from 'react-native';
-import { type Route, TabBar, type TabDescriptor } from 'react-native-tab-view';
+import {
+  type Route,
+  TabBar,
+  type TabBarProps,
+  type TabDescriptor,
+} from 'react-native-tab-view';
+import useLatestCallback from 'use-latest-callback';
 
 import type { MaterialTopTabBarProps } from '../types';
 
 type MaterialLabelProps = Parameters<
   NonNullable<TabDescriptor<Route>['label']>
 >[0];
 
+type CachedOptions = {
+  deps: readonly unknown[];
+  options: TabDescriptor<Route>;
+};
+
 const MaterialLabel = ({
   color,
   labelText,
@@ -68,10 +79,10 @@ export function MaterialTopTabBar({
       .string() ??
     (dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)');
 
-  const tabBarOptions = Object.fromEntries(
-    state.routes.map((route) => {
-      const options = descriptors[route.key]?.options ?? {};
+  const optionsCache = React.useRef<Record<string, CachedOptions>>({});
 
+  const nextOptions = Object.fromEntries<CachedOptions>(
+    state.routes.map((route) => {
       const {
         title,
         tabBarLabel,
@@ -83,13 +94,41 @@ export function MaterialTopTabBar({
         tabBarIcon,
         tabBarAllowFontScaling,
         tabBarLabelStyle,
-      } = options;
+      } = descriptors[route.key]?.options ?? {};
+
+      const focused = focusedRoute.key === route.key;
+      const href = buildHref(route.name, route.params);
+
+      const previous = optionsCache.current[route.key];
+
+      const deps = [
+        href,
+        route.name,
+        title,
+        tabBarLabel,
+        tabBarButtonTestID,
+        tabBarAccessibilityLabel,
+        tabBarBadge,
+        tabBarShowIcon,
+        tabBarShowLabel,
+        tabBarIcon,
+        tabBarAllowFontScaling,
+        tabBarLabelStyle,
+        typeof tabBarLabel === 'function' && focused,
+      ];
+
+      if (
+        previous &&
+        Object.hasOwn(optionsCache.current, route.key) &&
+        previous.deps.length === deps.length &&
+        deps.every((dep, index) => Object.is(dep, previous.deps[index]))
+      ) {
+        return [route.key, previous];
+      }
 
       let icon;
 
-      if (tabBarShowIcon === false) {
-        icon = undefined;
-      } else if (tabBarIcon) {
+      if (tabBarShowIcon !== false && tabBarIcon) {
         icon = ({
           focused,
           color,
@@ -120,37 +159,63 @@ export function MaterialTopTabBar({
         };
       }
 
-      return [
-        route.key,
-        {
-          href: buildHref(route.name, route.params),
-          testID: tabBarButtonTestID,
-          accessibilityLabel: tabBarAccessibilityLabel,
-          badge: tabBarBadge,
-          icon,
-          label:
-            tabBarShowLabel === false
-              ? undefined
-              : typeof tabBarLabel === 'function'
-                ? ({ labelText, color }: MaterialLabelProps) =>
-                    tabBarLabel({
-                      focused: focusedRoute.key === route.key,
-                      color,
-                      children: labelText ?? route.name,
-                    })
-                : renderLabelDefault,
-          labelAllowFontScaling: tabBarAllowFontScaling,
-          labelStyle: tabBarLabelStyle,
-          labelText:
-            options.tabBarShowLabel === false
-              ? undefined
-              : typeof tabBarLabel === 'string'
-                ? tabBarLabel
-                : title !== undefined
-                  ? title
-                  : route.name,
-        },
-      ];
+      const tabOptions: TabDescriptor<Route> = {
+        href,
+        testID: tabBarButtonTestID,
+        accessibilityLabel: tabBarAccessibilityLabel,
+        badge: tabBarBadge,
+        icon,
+        label:
+          tabBarShowLabel === false
+            ? undefined
+            : typeof tabBarLabel === 'function'
+              ? ({ labelText, color }: MaterialLabelProps) =>
+                  tabBarLabel({
+                    focused,
+                    color,
+                    children: labelText ?? route.name,
+                  })
+              : renderLabelDefault,
+        labelAllowFontScaling: tabBarAllowFontScaling,
+        labelStyle: tabBarLabelStyle,
+        labelText:
+          tabBarShowLabel === false
+            ? undefined
+            : typeof tabBarLabel === 'string'
+              ? tabBarLabel
+              : title !== undefined
+                ? title
+                : route.name,
+      };
+
+      return [route.key, { deps, options: tabOptions }];
+    })
+  );
+
+  React.useInsertionEffect(() => {
+    optionsCache.current = nextOptions;
+  });
+
+  const onTabPress = useLatestCallback<
+    NonNullable<TabBarProps<Route>['onTabPress']>
+  >(({ route, preventDefault }) => {
+    cons
```

**File**: `packages/react-native-tab-view/src/TabView.tsx` (modified, +30/-8)
```diff
@@ -187,20 +187,42 @@ export function TabView<T extends Route>({
     }
   };
 
+  const optionsCache = React.useRef<
+    | {
+        commonOptions: Props<T>['commonOptions'];
+        sceneOptions: Props<T>['options'];
+        options: Record<string, TabDescriptor<T>>;
+      }
+    | undefined
+  >(undefined);
+
   const options = React.useMemo(
     () =>
       Object.fromEntries(
-        navigationState.routes.map((route) => [
-          route.key,
-          {
-            ...commonOptions,
-            ...sceneOptions?.[route.key],
-          },
-        ])
+        navigationState.routes.map((route) => {
+          const previous = optionsCache.current;
+          const routeOptions = sceneOptions?.[route.key];
+          const cachedOptions = previous?.options[route.key];
+
+          return [
+            route.key,
+            previous &&
+            cachedOptions &&
+            Object.hasOwn(previous.options, route.key) &&
+            previous.commonOptions === commonOptions &&
+            previous.sceneOptions?.[route.key] === routeOptions
+              ? cachedOptions
+              : { ...commonOptions, ...routeOptions },
+          ];
+        })
       ),
-    [navigationState.routes, commonOptions, sceneOptions]
+    [navigationState.routes, commonOptions, sceneOptions, optionsCache]
   );
 
+  React.useInsertionEffect(() => {
+    optionsCache.current = { commonOptions, sceneOptions, options };
+  });
+
   const element = renderAdapter({
     navigationState,
     keyboardDismissMode,
```

**File**: `pnpm-lock.yaml` (modified, +3/-0)
```diff
@@ -566,6 +566,9 @@ importers:
       react-native-tab-view:
         specifier: workspace:^
         version: link:../react-native-tab-view
+      use-latest-callback:
+        specifier: ^0.3.5
+        version: 0.3.5(react@19.2.3)
     devDependencies:
       '@jest/globals':
         specifier: ^30.4.1
```

---

### Incident Patch 13: `92e457a0` (2026-09-17)
**Commit Message**: fix: avoid redundant activity mode updates

**File**: `packages/elements/src/ActivityView.native.tsx` (modified, +3/-5)
```diff
@@ -16,25 +16,23 @@ export function ActivityView({
   style,
   children,
 }: Props) {
-  const [delayedMode, setDelayedMode] = useState(mode);
+  const [delayedPaused, setDelayedPaused] = useState(mode === 'paused');
 
   useEffect(() => {
     if (!delay) {
       return;
     }
 
     const timer = setTimeout(() => {
-      setDelayedMode(mode);
+      setDelayedPaused(mode === 'paused');
     }, delay);
 
     return () => clearTimeout(timer);
   }, [delay, mode]);
 
   const display = visible ? 'flex' : 'none';
   const activityMode =
-    mode !== 'paused' || (delay && delayedMode !== 'paused')
-      ? 'visible'
-      : 'hidden';
+    mode !== 'paused' || (delay && !delayedPaused) ? 'visible' : 'hidden';
 
   return (
     <Activity mode={activityMode}>
```

**File**: `packages/elements/src/ActivityView.tsx` (modified, +3/-5)
```diff
@@ -39,25 +39,23 @@ export function ActivityView({
   style,
   children,
 }: Props) {
-  const [delayedMode, setDelayedMode] = useState(mode);
+  const [delayedPaused, setDelayedPaused] = useState(mode === 'paused');
 
   useEffect(() => {
     if (!delay) {
       return;
     }
 
     const timer = setTimeout(() => {
-      setDelayedMode(mode);
+      setDelayedPaused(mode === 'paused');
     }, delay);
 
     return () => clearTimeout(timer);
   }, [delay, mode]);
 
   const display = visible ? 'flex' : 'none';
   const activityMode =
-    mode !== 'paused' || (delay && delayedMode !== 'paused')
-      ? 'visible'
-      : 'hidden';
+    mode !== 'paused' || (delay && !delayedPaused) ? 'visible' : 'hidden';
 
   /**
    * Activity has 2 modes, visible and hidden - hidden unmounts effects
```

---

### Incident Patch 14: `26209d0d` (2026-09-18)
**Commit Message**: fix: avoid loading fonts for cached material symbol images

**File**: `packages/native/android/src/main/java/org/reactnavigation/MaterialSymbolModule.kt` (modified, +5/-1)
```diff
@@ -52,7 +52,7 @@ class MaterialSymbolModule(reactContext: ReactApplicationContext) :
     val density = reactApplicationContext.resources.displayMetrics.density
     val scaledSize = (size * density).roundToInt().coerceAtLeast(1)
 
-    val (resolvedTypeface, typefaceSuffix) = MaterialSymbolTypeface.get(
+    val typefaceSuffix = MaterialSymbolTypeface.getSuffix(
       reactApplicationContext, variant, weight?.toInt()
     )
 
@@ -82,6 +82,10 @@ class MaterialSymbolModule(reactContext: ReactApplicationContext) :
 
     cacheDir.mkdirs()
 
+    val resolvedTypeface = MaterialSymbolTypeface.get(
+      reactApplicationContext, variant, weight?.toInt()
+    ).typeface
+
     val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
       typeface = resolvedTypeface
       textSize = scaledSize.toFloat()
```

**File**: `packages/native/android/src/main/java/org/reactnavigation/MaterialSymbolTypeface.kt` (modified, +17/-13)
```diff
@@ -11,6 +11,22 @@ object MaterialSymbolTypeface {
   private var availableFonts: Map<String, Set<Int>>? = null
 
   fun get(context: Context, variant: String?, weight: Int?): MaterialSymbolTypefaceResult {
+    val suffix = getSuffix(context, variant, weight)
+
+    val typeface = typefaces.getOrPut(suffix) {
+      val path = "fonts/MaterialSymbols${suffix}.ttf"
+
+      try {
+        Typeface.createFromAsset(context.assets, path)
+      } catch (e: Exception) {
+        throw RuntimeException("$path not found.", e)
+      }
+    }
+
+    return MaterialSymbolTypefaceResult(typeface, suffix)
+  }
+
+  fun getSuffix(context: Context, variant: String?, weight: Int?): String {
     val fonts = getAvailableFonts(context)
 
     val resolvedVariant = if (variant != null) {
@@ -25,19 +41,7 @@ object MaterialSymbolTypeface {
 
     val resolvedWeight = weight ?: resolveDefaultWeight(fonts, resolvedVariant)
 
-    val suffix = "${resolvedVariant}_$resolvedWeight"
-
-    val typeface = typefaces.getOrPut(suffix) {
-      val path = "fonts/MaterialSymbols${suffix}.ttf"
-
-      try {
-        Typeface.createFromAsset(context.assets, path)
-      } catch (e: Exception) {
-        throw RuntimeException("$path not found.", e)
-      }
-    }
-
-    return MaterialSymbolTypefaceResult(typeface, suffix)
+    return "${resolvedVariant}_$resolvedWeight"
   }
 
   private fun getAvailableFonts(context: Context): Map<String, Set<Int>> {
```

---

### Incident Patch 15: `69043be6` (2026-09-18)
**Commit Message**: fix: don't build root state unless we have a listener

**File**: `packages/core/src/BaseNavigationContainer.tsx` (modified, +4/-2)
```diff
@@ -513,9 +513,9 @@ export function BaseNavigationContainer<ParamList extends {} = RootParamList>({
   }, [state, isReady, emitter]);
 
   React.useEffect(() => {
-    const hydratedState = getRootState();
-
     if (process.env.NODE_ENV !== 'production') {
+      const hydratedState = getRootState();
+
       if (hydratedState !== undefined) {
         const duplicateRouteNamesResult =
           checkDuplicateRouteNames(hydratedState);
@@ -535,6 +535,8 @@ export function BaseNavigationContainer<ParamList extends {} = RootParamList>({
     emitter.emit({ type: 'state', data: { state } });
 
     if (!isFirstMountRef.current && onStateChangeRef.current) {
+      const hydratedState = getRootState();
+
       onStateChangeRef.current(hydratedState);
     }
 
```

#### Recent Merged Pull Requests:
- **PR #13274** (2026-10-05): feat: add support for filled material symbols and reduce size (@satya164)
- **PR #13263** (2026-09-21): chore: add AI Usage Policy (@satya164)
- **PR #13260** (2026-09-18): fix: fix slow layout on safari on iOS 27 (@satya164)
- **PR #13259** (closed): fix: give drawer onOpen and onClose a stable identity (@ahmdshrif)
- **PR #13255** (2026-09-17): fix(stack): clip inactive cards inside Card so their shadow stays visible (@BartekObudzinski)
- **PR #13253** (2026-09-17): refactor: remove unnecessary nanoid from core (@satya164)
- **PR #13252** (2026-09-17): fix: handle AGP9's built-in kotlin support (@satya164)
- **PR #13251** (2026-09-17): fix: measure frame size in layout effect (@satya164)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
