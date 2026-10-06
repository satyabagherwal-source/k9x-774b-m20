# Forensic Learning Record (Deep Inspection): gorhom/react-native-bottom-sheet

> **Canonical Artifact**: `07_PROJECT_LEARNING/gorhom-react-native-bottom-sheet-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gorhom/react-native-bottom-sheet](https://github.com/gorhom/react-native-bottom-sheet))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:04:08.788Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gorhom/react-native-bottom-sheet`
- **Description**: A performant interactive bottom sheet with fully configurable options 🚀
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9106 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `example/src/screens/integrations/legendlist/renderItem.tsx`
```
import type { LegendListRenderItemProps } from '@legendapp/list';
import Faker from 'faker';
import { memo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { RectButton } from 'react-native-gesture-handler';

export interface Item {
  id: string;
}

// Generate random metadata
const randomAvatars = Array.from(
  { length: 20 },
  (_, i) => `https://i.pravatar.cc/150?img=${i + 1}`
);

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export const ItemCard = memo(({ item }: LegendListRenderItemProps<Item>) => {
  const indexForData = item.id.includes('new')
    ? 100 + +item.id.replace('new', '')
    : +item.id;

  const randomText = Faker.lorem.sentences(10);
  const avatarUrl = randomAvatars[indexForData % randomAvatars.length];
  const authorName = Faker.name.firstName();
  const timestamp = `${Math.max(1, indexForData % 24)}h ago`;

  return (
    <View style={styles.itemOuterContainer}>
      <View style={styles.itemContainer}>
        <View style={styles.headerContainer}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          <View style={styles.headerText}>
            <Text style={styles.authorName}>
              {authorName} {item.id}
            </Text>
            <Text style={styles.timestamp}>{timestamp}</Text>
          </View>
        </View>

        <Text style={styles.itemTitle}>Item #{item.id}</Text>
        <Text style={styles.itemBody}>{randomText}</Text>
        <View style={styles.itemFooter}>
          <Text style={styles.footerText}>❤️ 42</Text>
          <Text style={styles.footerText}>💬 12</Text>
          <Text style={styles.footerText}>🔄 8</Text>
        </View>
      </View>
    </View>
  );
});

export const renderItem = (props: LegendListRenderItemProps<Item>) => (
  <ItemCard {...props} />
);

const styles = StyleSheet.create({
  itemOuterContainer: {
    padding: 12,
  },
  itemContainer: {
    overflow: 'hidden',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  itemBody: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    // flex: 1,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  footerText: {
    fontSize: 14,
    color: '#888888',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  timestamp: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
});

export default renderItem;

```

### Core Architecture Module: `example/src/utilities/createMockData.ts`
```
import Faker from 'faker';
import { Dimensions } from 'react-native';
import type { Contact, Location } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('screen');

export const createContactListMockData = (count: number = 20): Contact[] => {
  return new Array(count).fill(0).map(() => ({
    name: `${Faker.name.firstName()} ${Faker.name.lastName()}`,
    address: `${Faker.address.city()}, ${Faker.address.country()}`,
    jobTitle: Faker.name.jobTitle(),
  }));
};

export const createContactSectionsMockData = (count: number = 20) => {
  return new Array(Math.round(count / 4)).fill(0).map(() => ({
    title: Faker.address.country(),
    data: new Array(Math.round(count / 4)).fill(0).map(() => ({
      name: `${Faker.name.firstName()} ${Faker.name.lastName()}`,
      address: `${Faker.address.city()}, ${Faker.address.country()}`,
      jobTitle: Faker.name.jobTitle(),
    })),
  }));
};

export const createLocationListMockData = (count: number = 50): Location[] => {
  return [
    {
      id: 'ams',
      name: 'Amsterdam',
      address: 'North Holland, Netherlands',
      photos: [
        'https://www.infocusclinical.com/wp-content/uploads/2020/02/summer-amsterdam-FP.jpg',
        'https://images.theconversation.com/files/162459/original/image-20170325-12162-1tfrmbb.jpg?ixlib=rb-1.1.0&q=45&auto=format&w=200&fit=clip',
        'https://www.kevinandamanda.com/wp-content/uploads/2014/09/amsterdam-2014-03.jpg',
        'https://specials-images.forbesimg.com/imageserve/5de4a1db755ebf0006fbea42/960x0.jpg?cropX1=0&cropX2=2121&cropY1=0&cropY2=1414',
      ],
    },
    ...new Array(count).fill(0).map((_, index) => ({
      id: Faker.random.alphaNumeric(6),
      name: `${Faker.address.city()}`,
      address: `${Faker.address.state()}, ${Faker.address.country()}`,
      photos: Array(5)
        .fill(0)
        .map((__, _index) => Faker.image.city(SCREEN_WIDTH + index + _index)),
    })),
  ];
};

```

### Core Architecture Module: `example/src/utilities/transformOrigin.ts`
```
// @ts-ignore
export const transformOrigin = ({ x, y }, ...transformations) => {
  'worklet';
  return [
    { translateX: x },
    { translateY: y },
    ...transformations,
    { translateX: x * -1 },
    { translateY: y * -1 },
  ];
};

```

### Core Architecture Module: `src/hooks/index.ts`
```
export { useBottomSheet } from './useBottomSheet';
export { useBottomSheetInternal } from './useBottomSheetInternal';

// modal
export { useBottomSheetModal } from './useBottomSheetModal';
export { useBottomSheetModalInternal } from './useBottomSheetModalInternal';

// scrollable
export { useScrollable } from './useScrollable';
export { useScrollableSetter } from './useScrollableSetter';
export { useScrollHandler } from './useScrollHandler';

// gestures
export { useGestureHandler } from './useGestureHandler';
export { useGestureEventsHandlersDefault } from './useGestureEventsHandlersDefault';
export { useBottomSheetGestureHandlers } from './useBottomSheetGestureHandlers';

// utilities
export { useAnimatedLayout } from './useAnimatedLayout';
export { useAnimatedKeyboard } from './useAnimatedKeyboard';
export { useStableCallback } from './useStableCallback';
export { usePropsValidator } from './usePropsValidator';
export { useAnimatedDetents } from './useAnimatedDetents';
export { useReactiveSharedValue } from './useReactiveSharedValue';
export {
  useBoundingClientRect,
  type BoundingClientRect,
} from './useBoundingClientRect';
export { useBottomSheetContentContainerStyle } from './useBottomSheetContentContainerStyle';

```

### Core Architecture Module: `src/hooks/useAnimatedDetents.ts`
```
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';
import type { BottomSheetProps } from '../components/bottomSheet';
import { INITIAL_LAYOUT_VALUE } from '../constants';
import type { DetentsState, LayoutState } from '../types';
import { normalizeSnapPoint } from '../utilities';

/**
 * A custom hook that computes and returns the animated detent positions for a bottom sheet component.
 *
 * This hook normalizes the provided snap points (detents), optionally adds a dynamic detent based on content size,
 * and calculates key positions such as the highest detent and the closed position. It supports both static and dynamic
 * sizing, and adapts to modal and detached sheet modes.
 *
 * @param detents - The snap points for the bottom sheet, which can be an array or an object with a `value` property.
 * @param layoutState - A shared animated value containing the current layout state (container, handle, and content heights).
 * @param enableDynamicSizing - Whether dynamic sizing based on content height is enabled.
 * @param maxDynamicContentSize - The maximum allowed content size for dynamic sizing.
 * @param detached - Whether the bottom sheet is in detached mode.
 * @param $modal - Whether the bottom sheet is presented as a modal.
 * @param bottomInset - The bottom inset to apply when the sheet is modal or detached (default is 0).
 */
export const useAnimatedDetents = (
  detents: BottomSheetProps['snapPoints'],
  layoutState: SharedValue<LayoutState>,
  enableDynamicSizing: BottomSheetProps['enableDynamicSizing'],
  maxDynamicContentSize: BottomSheetProps['maxDynamicContentSize'],
  detached: BottomSheetProps['detached'],
  $modal: BottomSheetProps['$modal'],
  bottomInset: BottomSheetProps['bottomInset'] = 0
) => {
  const state = useDerivedValue<DetentsState>(() => {
    const { containerHeight, handleHeight, contentHeight } = layoutState.get();

    // early exit, if container layout is not ready
    if (containerHeight === INITIAL_LAYOUT_VALUE) {
      return {};
    }

    // extract detents from provided props
    const _detents = detents
      ? 'value' in detents
        ? detents.value
        : detents
      : [];

    // normalized all provided detents, converting percentage
    // values into absolute values.
    let _normalizedDetents = _detents.map(snapPoint =>
      normalizeSnapPoint(snapPoint, containerHeight)
    ) as number[];

    let highestDetentPosition =
      _normalizedDetents[_normalizedDetents.length - 1];
    let closedDetentPosition = containerHeight;
    if ($modal || detached) {
      closedDetentPosition = containerHeight + bottomInset;
    }

    if (!enableDynamicSizing) {
      return {
        detents: _normalizedDetents,
        highestDetentPosition,
        closedDetentPosition,
      };
    }

    // early exit, if dynamic sizing is enabled and
    // content height is not calculated yet.
    if (contentHeight === INITIAL_LAYOUT_VALUE) {
      return {};
    }

    // early exit, if handle height is not calculated yet.
    if (handleHeight === INITIAL_LAYOUT_VALUE) {
      return {};
    }

    // calculate a new detents based on content height.
    const dynamicSnapPoint =
      containerHeight -
      Math.min(
        contentHeight + handleHeight,
        maxDynamicContentSize !== undefined
          ? maxDynamicContentSize
          : containerHeight
      );

    // push dynamic detent into the normalized detents,
    // only if it does not exists in the provided list already.
    if (!_normalizedDetents.includes(dynamicSnapPoint)) {
      _normalizedDetents.push(dynamicSnapPoint);
    }

    // sort all detents.
    _normalizedDetents = _normalizedDetents.sort((a, b) => b - a);

    // update the highest detent position.
    highestDetentPosition = _normalizedDetents[_normalizedDetents.length - 1];

    // locate the dynamic detent index.
    const dynamicDetentIndex = _normalizedDetents.indexOf(dynamicSnapPoint);

    return {
      detents: _normalizedDetents,
      dynamicDetentIndex,
      highestDetentPosition,
      closedDetentPosition,
    };
  }, [
    detents,
    layoutState,
    enableDynamicSizing,
    maxDynamicContentSize,
    detached,
    $modal,
    bottomInset,
  ]);
  return state;
};

```

### Core Architecture Module: `src/hooks/useAnimatedKeyboard.ts`
```
import { useCallback, useEffect, useRef } from 'react';
import {
  Dimensions,
  Keyboard,
  type KeyboardEvent,
  type KeyboardEventEasing,
  type KeyboardEventName,
  Platform,
} from 'react-native';
import {
  runOnUI,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';
import { KEYBOARD_STATUS } from '../constants';
import type { KeyboardState } from '../types';

const KEYBOARD_EVENT_MAPPER = {
  KEYBOARD_SHOW: Platform.select({
    ios: 'keyboardWillShow',
    android: 'keyboardDidShow',
    default: '',
  }) as KeyboardEventName,
  KEYBOARD_HIDE: Platform.select({
    ios: 'keyboardWillHide',
    android: 'keyboardDidHide',
    default: '',
  }) as KeyboardEventName,
};

const INITIAL_STATE: KeyboardState = {
  status: KEYBOARD_STATUS.UNDETERMINED,
  height: 0,
  heightWithinContainer: 0,
  easing: 'keyboard',
  duration: 500,
};

export const useAnimatedKeyboard = () => {
  //#region variables
  const textInputNodesRef = useRef(new Set<number>());
  const state = useSharedValue(INITIAL_STATE);
  const temporaryCachedState = useSharedValue<Omit<
    KeyboardState,
    'heightWithinContainer' | 'target'
  > | null>(null);
  //#endregion

  //#region worklets
  const handleKeyboardEvent = useCallback(
    (
      status: KEYBOARD_STATUS,
      height: number,
      duration: number,
      easing: KeyboardEventEasing,
      bottomOffset?: number
    ) => {
      'worklet';
      const currentState = state.get();

      /**
       * if the keyboard event was fired before the `onFocus` on TextInput,
       * then we cache the event, and wait till the `target` is been set
       * to be updated then fire this function again.
       */
      if (status === KEYBOARD_STATUS.SHOWN && !currentState.target) {
        temporaryCachedState.set({
          status,
          height,
          duration,
          easing,
        });
        return;
      }

      /**
       * clear temporary cached state.
       */
      temporaryCachedState.set(null);

      /**
       * if keyboard status is hidden, then we keep old height.
       */
      let adjustedHeight =
        status === KEYBOARD_STATUS.SHOWN ? height : currentState.height;

      /**
       * if keyboard had an bottom offset -android bottom bar-, then
       * we add that offset to the keyboard height.
       */
      if (bottomOffset) {
        adjustedHeight = adjustedHeight + bottomOffset;
      }

      state.set(state => ({
        status,
        easing,
        duration,
        height: adjustedHeight,
        target: state.target,
        heightWithinContainer: state.heightWithinContainer,
      }));
    },
    [state, temporaryCachedState]
  );
  //#endregion

  //#region effects
  useEffect(() => {
    const SCREEN_HEIGHT = Dimensions.get('screen').height;
    const handleOnKeyboardShow = (event: KeyboardEvent) => {
      runOnUI(handleKeyboardEvent)(
        KEYBOARD_STATUS.SHOWN,
        event.endCoordinates.height,
        event.duration,
        event.easing,
        SCREEN_HEIGHT -
          event.endCoordinates.height -
          event.endCoordinates.screenY
      );
    };
    const handleOnKeyboardHide = (event: KeyboardEvent) => {
      runOnUI(handleKeyboardEvent)(
        KEYBOARD_STATUS.HIDDEN,
        event.endCoordinates.height,
        event.duration,
        event.easing
      );
    };

    const showSubscription = Keyboard.addListener(
      KEYBOARD_EVENT_MAPPER.KEYBOARD_SHOW,
      handleOnKeyboardShow
    );

    const hideSubscription = Keyboard.addListener(
      KEYBOARD_EVENT_MAPPER.KEYBOARD_HIDE,
      handleOnKeyboardHide
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [handleKeyboardEvent]);

  /**
   * This reaction is needed to handle the issue with multiline text input.
   *
   * @link https://github.com/gorhom/react-native-bottom-sheet/issues/411
   */
  useAnimatedReaction(
    () => state.value.target,
    (result, previous) => {
      if (!result || result === previous) {
        return;
      }

      const cachedState = temporaryCachedState.get();
      if (!cachedState) {
        return;
      }

      handleKeyboardEvent(
        cachedState.status,
        cachedState.height,
        cachedState.duration,
        cachedState.easing
      );
    },
    [temporaryCachedState, handleKeyboardEvent]
  );
  //#endregion

  return { state, textInputNodesRef };
};

```

### Core Architecture Module: `src/hooks/useAnimatedLayout.ts`
```
import { useEffect, useMemo, useState } from 'react';
import { Dimensions } from 'react-native';
import {
  makeMutable,
  type SharedValue,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { INITIAL_CONTAINER_LAYOUT, INITIAL_LAYOUT_VALUE } from '../constants';
import type { ContainerLayoutState, LayoutState } from '../types';

const INITIAL_STATE: LayoutState = {
  window: Dimensions.get('window'),
  rawContainerHeight: INITIAL_LAYOUT_VALUE,
  containerHeight: INITIAL_LAYOUT_VALUE,
  containerOffset: INITIAL_CONTAINER_LAYOUT.offset,
  handleHeight: INITIAL_LAYOUT_VALUE,
  footerHeight: INITIAL_LAYOUT_VALUE,
  contentHeight: INITIAL_LAYOUT_VALUE,
};

/**
 * A custom hook that manages and animates the layout state of a container,
 * typically used in bottom sheet components. It calculates the effective
 * container height by considering top and bottom insets, and updates the
 * animated state in response to layout changes. The hook supports both modal
 * and non-modal modes, and ensures the container's animated layout state
 * remains in sync with the actual layout measurements.
 *
 * @param containerLayoutState - A shared value representing the current container layout state.
 * @param topInset - The top inset value to be subtracted from the container height.
 * @param bottomInset - The bottom inset value to be subtracted from the container height.
 * @param modal - Optional flag indicating if the layout is in modal mode.
 * @param shouldOverrideHandleHeight - Optional flag to override the handle height in the layout state, only when handle is set to null.
 * @returns An object containing the animated layout state.
 */
export function useAnimatedLayout(
  containerLayoutState: SharedValue<ContainerLayoutState> | undefined,
  topInset: number,
  bottomInset: number,
  modal?: boolean,
  shouldOverrideHandleHeight?: boolean
) {
  //#region  variables
  const verticalInset = useMemo(
    () => topInset + bottomInset,
    [topInset, bottomInset]
  );
  const initialState = useMemo(() => {
    const _state = { ...INITIAL_STATE };

    if (containerLayoutState) {
      const containerLayout = containerLayoutState.get();
      _state.containerHeight = modal
        ? containerLayout.height - verticalInset
        : containerLayout.height;
      _state.containerOffset = containerLayout.offset;
    }

    if (shouldOverrideHandleHeight) {
      _state.handleHeight = 0;
    }

    return _state;
  }, [containerLayoutState, modal, shouldOverrideHandleHeight, verticalInset]);
  //#endregion

  //#region state
  const [state] = useState(() => makeMutable(initialState));
  //#endregion

  //#region effects
  useAnimatedReaction(
    () => state.value.rawContainerHeight,
    (result, previous) => {
      if (result === previous) {
        return;
      }
      if (result === INITIAL_LAYOUT_VALUE) {
        return;
      }

      state.modify(_state => {
        'worklet';
        _state.containerHeight = modal ? result - verticalInset : result;
        return _state;
      });
    },
    [state, verticalInset, modal]
  );
  useAnimatedReaction(
    () => containerLayoutState?.get().height,
    (result, previous) => {
      if (!result || result === previous) {
        return;
      }
      if (result === INITIAL_LAYOUT_VALUE) {
        return;
      }

      state.modify(_state => {
        'worklet';
        _state.containerHeight = modal ? result - verticalInset : result;
        return _state;
      });
    },
    [state, verticalInset, modal]
  );
  useEffect(() => {
    Dimensions.addEventListener('change', ({ window }) => {
      state.modify(_state => {
        'worklet';
        _state.window = window;
        return _state;
      });
    });
  }, [state]);
  //#endregion

  return state;
}

```

### Core Architecture Module: `src/hooks/useBottomSheet.ts`
```
import { useContext } from 'react';
import { BottomSheetContext } from '../contexts/external';

export const useBottomSheet = () => {
  const context = useContext(BottomSheetContext);

  if (context === null) {
    throw "'useBottomSheet' cannot be used out of the BottomSheet!";
  }

  return context;
};

```

### Core Architecture Module: `src/hooks/useBottomSheetContentContainerStyle.ts`
```
import { useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { useBottomSheetInternal } from './useBottomSheetInternal';

export function useBottomSheetContentContainerStyle(
  enableFooterMarginAdjustment: boolean,
  _style?: ViewProps['style']
) {
  const [footerHeight, setFooterHeight] = useState(0);
  //#region hooks
  const { animatedLayoutState } = useBottomSheetInternal();
  //#endregion

  //#region styles
  const flattenStyle = useMemo<ViewStyle>(() => {
    return !_style
      ? {}
      : Array.isArray(_style)
        ? // @ts-ignore
          (StyleSheet.compose(..._style) as ViewStyle)
        : (_style as ViewStyle);
  }, [_style]);
  const style = useMemo<ViewProps['style']>(() => {
    if (!enableFooterMarginAdjustment) {
      return flattenStyle;
    }

    let currentBottomPadding = 0;
    if (flattenStyle && typeof flattenStyle === 'object') {
      const { paddingBottom, padding, paddingVertical } = flattenStyle;
      if (paddingBottom !== undefined && typeof paddingBottom === 'number') {
        currentBottomPadding = paddingBottom;
      } else if (
        paddingVertical !== undefined &&
        typeof paddingVertical === 'number'
      ) {
        currentBottomPadding = paddingVertical;
      } else if (padding !== undefined && typeof padding === 'number') {
        currentBottomPadding = padding;
      }
    }

    return [
      flattenStyle,
      {
        paddingBottom: currentBottomPadding + footerHeight,
        overflow: 'visible',
      },
    ];
  }, [footerHeight, enableFooterMarginAdjustment, flattenStyle]);
  //#endregion

  //#region effects
  useAnimatedReaction(
    () => animatedLayoutState.get().footerHeight,
    (result, previousFooterHeight) => {
      if (!enableFooterMarginAdjustment) {
        return;
      }
      runOnJS(setFooterHeight)(result);

      if (Platform.OS === 'web') {
        /**
         * a reaction that will append the footer height to the content
         * height if margin adjustment is true.
         *
         * This is needed due to the web layout the footer after the content.
         */
        if (result && !previousFooterHeight) {
          animatedLayoutState.modify(state => {
            'worklet';
            state.contentHeight = state.contentHeight + result;
            return state;
          });
        }
      }
    },
    [animatedLayoutState, enableFooterMarginAdjustment]
  );
  //#endregion
  return style;
}

```

### Core Architecture Module: `src/hooks/useBottomSheetGestureHandlers.ts`
```
import { useContext } from 'react';
import { BottomSheetGestureHandlersContext } from '../contexts/gesture';

export const useBottomSheetGestureHandlers = () => {
  const context = useContext(BottomSheetGestureHandlersContext);

  if (context === null) {
    throw "'useBottomSheetGestureHandlers' cannot be used out of the BottomSheet!";
  }

  return context;
};

```

### Core Architecture Module: `src/hooks/useBottomSheetInternal.ts`
```
import { useContext } from 'react';
import {
  BottomSheetInternalContext,
  type BottomSheetInternalContextType,
} from '../contexts/internal';

export function useBottomSheetInternal(
  unsafe?: false
): BottomSheetInternalContextType;

export function useBottomSheetInternal(
  unsafe: true
): BottomSheetInternalContextType | null;

export function useBottomSheetInternal(
  unsafe?: boolean
): BottomSheetInternalContextType | null {
  const context = useContext(BottomSheetInternalContext);

  if (unsafe !== true && context === null) {
    throw "'useBottomSheetInternal' cannot be used out of the BottomSheet!";
  }

  return context;
}

```

### Core Architecture Module: `src/hooks/useBottomSheetModal.ts`
```
import { useContext } from 'react';
import { BottomSheetModalContext } from '../contexts';

export const useBottomSheetModal = () => {
  const context = useContext(BottomSheetModalContext);

  if (context === null) {
    throw "'BottomSheetModalContext' cannot be null!";
  }

  return context;
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2758** (2026-10-05): **[Bug]: BottomSheetScrollView triggers Reanimated 4.6.0 native dependency warning**
  *Symptoms*: ### Version  v5  ### Reanimated Version  v3  ### Gesture Handler Version  v2  ### Platforms  Android  ### What happened?  After upgrading `react-native-reanimated` to 4.6.0, mounting `BottomSheetScrollView` produces the following warning in native development builds:  ```text [Reanimated] dependencies should only be used in web implementation. ```  The bottom sheet remains functional, but the warning is emitted whenever the scrollable component mounts.  ## Environment  | Library | Version | | --- | --- | | `@gorhom/bottom-sheet` | 5.2.14 | | `react-native` | 0.86.3 | | `react` | 19.2.3 | | `react-native-reanimated` | 4.6.0 | | `react-native-worklets` | 0.12.1 | | `react-native-gesture-handler` | 3.2.1 |  Platform: native (Android / iOS).  ## Steps to reproduce  1. Install the versions listed above. 2. Render a `BottomSheet` containing `BottomSheetScrollView`. 3. Start a native development build. 4. Open the screen containing the bottom sheet. 5. Observe the Reanimated warning.  ### Reproduction steps  ## Reproduction  ```tsx import React from 'react'; import { Text } from 'react-native'; import BottomSheet, {   BottomSheetScrollView, } from '@gorhom/bottom-sheet';  export function Example() {   return (     <BottomSheet index={0} snapPoints={['50%']}>       <BottomSheetScrollView>         <Text>Content</Text>       </BottomSheetScrollView>     </BottomSheet>   ); } ```  ## Actual behavior  The following warning is logged:  ```text [Reanimated] dependencies should only be used
  **Post-Mortem & Fix Analysis**:
  > Implemented in #2759.  The repository already has a separate `useScrollHandler.web.ts`, so the generic `.ts` implementation is native-only. The PR removes the web-only dependency-array argument from native `useAnimatedScrollHandler` without changing the handler closures or web behavior.  Regression evidence: an AST contract test failed before the patch with argument count 2 and passes afterward with argument count 1. TypeScript, Bob build, changed-file Biome checks, and the built CommonJS/module output also pass.
  > This issue is stale because it has been open 30 days with no activity. Remove stale label or comment or this will be closed in 5 days.
  > This issue was closed because it has been stalled for 5 days with no activity.

- **Issue #2757** (2026-08-29): **[Bug]: BottomSheetScrollView triggers Reanimated 4.6.0 native dependency warning**
  *Symptoms*: ### Version  v5  ### Reanimated Version  v3  ### Gesture Handler Version  v2  ### Platforms  Android  ### What happened?  ## Description  After upgrading `react-native-reanimated` to 4.6.0, mounting `BottomSheetScrollView` produces the following warning in native development builds:  ```text [Reanimated] dependencies should only be used in web implementation. ```  The bottom sheet remains functional, but the warning is emitted whenever the scrollable component mounts.  ## Environment  | Library | Version | | --- | --- | | `@gorhom/bottom-sheet` | 5.2.14 | | `react-native` | 0.86.3 | | `react` | 19.2.3 | | `react-native-reanimated` | 4.6.0 | | `react-native-worklets` | 0.12.1 | | `react-native-gesture-handler` | 3.2.1 |  Platform: native (Android / iOS).  ### Reproduction steps  1. Install the versions listed above. 2. Render a `BottomSheet` containing `BottomSheetScrollView`. 3. Start a native development build. 4. Open the screen containing the bottom sheet. 5. Observe the Reanimated warning.  ## Reproduction  ```tsx import React from 'react'; import { Text } from 'react-native'; import BottomSheet, {   BottomSheetScrollView, } from '@gorhom/bottom-sheet';  export function Example() {   return (     <BottomSheet index={0} snapPoints={['50%']}>       <BottomSheetScrollView>         <Text>Content</Text>       </BottomSheetScrollView>     </BottomSheet>   ); } ```  ## Actual behavior  The following warning is logged:  ```text [Reanimated] dependencies should only be used in web
  **Post-Mortem & Fix Analysis**:
  > Hello @bulkinav :wave:, this issue is being automatically closed and locked because it does not follow the issue template.

- **Issue #2753** (2026-09-29): **[Bug]:  `@react-navigation/stack` header draws over an open sheet on iOS**
  *Symptoms*: ### Version  v5  ### Reanimated Version  v3  ### Gesture Handler Version  v2  ### Platforms  iOS  ### What happened?  I render a `BottomSheetModal` next to `NavigationContainer` and open it at `snapPoints={['90%']}`, so it reaches the top of the screen. The `@react-navigation/stack` header keeps drawing on top of the sheet. Everything else on the screen goes under it.  The header in the reproduction is semi-transparent and borderless, so you can see the sheet's list items through it. The sheet reaches that area and gets painted underneath, instead of stopping short of the header.  Android renders the same build correctly, with the sheet above the header.  ![iOS: the stack header keeps drawing over the sheet once it is open](https://raw.githubusercontent.com/kilarsky/gorhom-bottom-sheet-stack-header-above-sheet-repro/refs/heads/main/docs/ios-stack-header.gif)  ### Reproduction steps  https://github.com/kilarsky/GorhomStackHeaderReanimated3  The sheet is a sibling of the navigator rather than a child of a screen, so it spans the window and its top edge passes the header:  ```tsx <BottomSheetModalProvider>   <NavigationContainer>     <Stack.Navigator>…</Stack.Navigator>   </NavigationContainer>    <BottomSheetModal ref={sheetRef} snapPoints={['90%']}>     <BottomSheetFlatList data={DATA} … />   </BottomSheetModal> </BottomSheetModalProvider> ```  The content is a `BottomSheetFlatList` of 30 items. No extra props, no wrapper.  1. Launch the app. 2. Tap **Open sheet**. 3. Look at 
  **Post-Mortem & Fix Analysis**:
  > Changing the headerMode of the navigator to `screen` should solve your problem. Don't ask me why, I spent a long time on this issue last time 😂 See https://reactnavigation.org/docs/8.x/stack-navigator/#headermode
  > This issue is stale because it has been open 30 days with no activity. Remove stale label or comment or this will be closed in 5 days.
  > This issue was closed because it has been stalled for 5 days with no activity.

- **Issue #2745** (2026-08-18): **[Bug]: BottomSheetModal declared inside BottomSheet causes parent BottomSheet to become invisible after presentation (not closed or unmounted)**
  *Symptoms*: ### Version  v5  ### Reanimated Version  v3  ### Gesture Handler Version  v2  ### Platforms  iOS  ### What happened?  ### Excuse - I am very sorry to raise this issue. I am a complete beginner who is learning while building the app—without any prior formal study—so there may be many problems with the code. Please mention me if there is anything that needs to be added to resolve the issue.  ### Environment - @gorhom/bottom-sheet@5.2.14 - react-native-reanimated@4.5.1 - react-native-gesture-handler@2.32.0 - react-native-screens: 4.26.0 - Expo SDK 57 - react: 19.2.3 - react-native@0.86.2 - New Architecture (Fabric): enabled  ### Bug Description  Presenting a `BottomSheetModal` causes a **persistent `BottomSheet` to become invisible**. The sheet is **not closed and not unmounted** — it stays logically at its current index but disappears from screen, i.e. a container/layout (measurement) collapse, not a dismiss.  Notably this happens for **one** of our `BottomSheet`s but **not** for another, structurally similar one. Modal *nesting* is NOT the factor: moving the modal inside the unaffected sheet's content still does not break it.  ### Two failure modes (both on the affected sheet)  - **A — same screen:** open the affected screen, then `present()` a `BottomSheetModal`   → the underlying `BottomSheet` becomes invisible. (Confirmed with logs, below.) - **B — across navigation:** from the affected screen, push another screen, `present()` a   `BottomSheetModal` there, then go back → th
  **Post-Mortem & Fix Analysis**:
  > Hello @kwangHo00 :wave:, this issue is being automatically closed and locked because it does not follow the issue template.

- **Issue #2743** (2026-08-17): **[Bug]: Sheet snaps back to the highest snap point when dragging the content after the scrollable was scrolled**
  *Symptoms*: ### Version  v5  ### Reanimated Version  v3  ### Gesture Handler Version  v2  ### Platforms  iOS, Android  ### What happened?  On a sheet with two snap points (`['50%', '100%']`) and a scrollable inside, once you've scrolled that content while the sheet was expanded, every swipe starting on the content snaps the sheet back to 100%  https://github.com/user-attachments/assets/111fff34-c052-4518-a311-6f95b646fee3  ### Reproduction steps  1. Render a `BottomSheet` with `snapPoints={['50%', '100%']}` and a lot of items -> FlatListExample can be used from example app 2. Expand the sheet to 100% 3. Scroll the content down 4. Drag the handle back down to 50% 5. Do a small swipe anywhere in the content — it snaps to 100%   ### Reproduction sample  https://github.com/gorhom/react-native-bottom-sheet/tree/master/example  ### Relevant log output  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Hello @KarolCoder :wave:, this issue is being automatically closed and locked because it does not follow the issue template.

- **Issue #2733** (2026-09-28): **[Bug]: Dynamic enableContentPanningGesture causes BottomSheet content remount**
  *Symptoms*: ### Version  v5  ### Reanimated Version  v3  ### Gesture Handler Version  v2  ### Platforms  Android  ### What happened?  When `enableContentPanningGesture` is changed dynamically, the Bottom Sheet content subtree gets remounted.  This happens because internally the library switches the wrapper component based on `enableContentPanningGesture`:  ```tsx const DraggableView = enableContentPanningGesture   ? BottomSheetDraggableView   : Animated.View; ```  Changing this value causes React to replace the underlying component type, resulting in the existing content being unmounted and mounted again.  In our use case, we load history data in batches. The value of `enableContentPanningGesture` changes when the data availability changes:  ```tsx enableContentPanningGesture={!isDataEmpty} ```  As data arrives, the Bottom Sheet switches between different wrapper components, causing unnecessary content remounts and potential state resets.  A workaround is to keep `enableContentPanningGesture` constant and use `enableHandlePanningGesture` for dynamic behavior:  ```tsx <BottomSheet   enableContentPanningGesture={true}   enableHandlePanningGesture={!isDataEmpty} >   {renderContent()} </BottomSheet> ```  This keeps the content wrapper stable while still allowing the sheet gesture behavior to be controlled.   ### Reproduction steps  - ## Reproduction steps  1. Create a Bottom Sheet with `enableContentPanningGesture` controlled by a state value.  2. Toggle `enableContentPanningGesture` after t
  **Post-Mortem & Fix Analysis**:
  > I traced the remount to `BottomSheetContent` switching its wrapper component type when `enableContentPanningGesture` changes. I opened #2752 to keep `BottomSheetDraggableView` stable and rely on its existing `.enabled(enableContentPanningGesture)` configuration. A React identity regression harness confirms the content mount count remains 1 across the toggle; TypeScript, build, and the focused Biome check pass.
  > This issue is stale because it has been open 30 days with no activity. Remove stale label or comment or this will be closed in 5 days.
  > This issue was closed because it has been stalled for 5 days with no activity.

- **Issue #2729** (2026-09-04): **[Bug]:  BottomSheetModalProvider instances share one layout-state object — sheets dismiss short of the screen bottom after a nested provider re-measures**
  *Symptoms*: ### Version  v5  ### Reanimated Version  v3  ### Gesture Handler Version  v2  ### Platforms  iOS  ### What happened?  Exact versions: `@gorhom/bottom-sheet` 5.2.14, `react-native-reanimated` 4.1.6, `react-native-gesture-handler` 2.28.0, RN 0.81.5 (new architecture).  Since the 5.2.0 "optimise layout state" refactor, `BottomSheetModalProviderWrapper` initializes its layout state with the module-level constant directly (`src/components/bottomSheetModalProvider/BottomSheetModalProvider.tsx`, lines 29-31):  ```ts const animatedContainerLayoutState = useSharedValue<ContainerLayoutState>(   INITIAL_CONTAINER_LAYOUT ); ```  `useSharedValue` keeps a reference to `INITIAL_CONTAINER_LAYOUT`, and the hosting container updates it via `.modify()`, which mutates the object **in place** — so every `BottomSheetModalProvider` instance in the app effectively shares a single layout-state object. The last hosting container to run `onLayout` overwrites the container height/offset for all providers.  Concrete failure: a root provider plus a second provider inside a `react-native-screens` `presentation: 'modal'` screen (a workaround for #2322). Opening the modal screen makes its hosting container measure the pageSheet height (884pt on an iPhone 16 Pro Max; window = 956pt) and write it into the shared object. After the modal screen closes, any `BottomSheetModal` presented from the **root** provider mounts reading `containerHeight = 884` (`useAnimatedLayout` snapshots the provider state at mount), so
  **Post-Mortem & Fix Analysis**:
  > This issue is stale because it has been open 30 days with no activity. Remove stale label or comment or this will be closed in 5 days.
  > This issue was closed because it has been stalled for 5 days with no activity.

- **Issue #2713** (2026-08-12): **[Bug]: dismiss() on a never-presented BottomSheetModal permanently prevents all future present() (5.2.11+)**
  *Symptoms*: ### Version  v5  ### Reanimated Version  v3  ### Gesture Handler Version  v2  ### Platforms  iOS, Android  ### What happened?  Since 5.2.11 (modal status rewrite, #2632), calling `dismiss()` on a BottomSheetModal that has never been presented permanently wedges the modal: every subsequent `present()` mounts state but renders nothing. No error, no warning. The same call was a safe no-op on <= 5.2.10.  Root cause (from diffing 5.2.10 vs 5.2.14 source):  1. `handleDismiss` early-exits only for `CLOSED`, `MINIMIZED`, and `DISMISSING` at index -1 — `MODAL_STATUS.INITIAL` is NOT covered. So a dismiss on a never-presented modal falls through to:    `statusRef.current = MODAL_STATUS.DISMISSING` + `bottomSheetRef.current?.forceClose()` — but the ref is null (never mounted), so forceClose is a silent no-op and no callback ever transitions the status again. The modal is stuck in DISMISSING.  2. `handlePortalRender` returns early while status is DISMISSING, so every later `present()` sets `mount: true` but the portal content is never rendered.  `handlePresent` never resets the status (it only sets ANIMATING when the sheet was already mounted), so there is no recovery path.  Common real-world trigger: a `visible`-prop wrapper component whose effect runs its else-branch on first mount:    useEffect(() => {     if (visible) modalRef.current?.present();     else modalRef.current?.dismiss();   // runs once at mount, visible=false   }, [visible]);  This pattern worked for years on <= 5.2.10. L
  **Post-Mortem & Fix Analysis**:
  > This is also related to https://github.com/gorhom/react-native-bottom-sheet/issues/2669 i think, if not a duplication
  > This issue is stale because it has been open 30 days with no activity. Remove stale label or comment or this will be closed in 5 days.
  > This issue was closed because it has been stalled for 5 days with no activity.

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

### Incident Patch 1: `5853f117` (2026-05-09)
**Commit Message**: fix: read window height from a shared value on ui thread

**File**: `src/hooks/useAnimatedLayout.ts` (modified, +12/-1)
```diff
@@ -1,4 +1,5 @@
-import { useMemo, useState } from 'react';
+import { useEffect, useMemo, useState } from 'react';
+import { Dimensions } from 'react-native';
 import {
   makeMutable,
   type SharedValue,
@@ -8,6 +9,7 @@ import { INITIAL_CONTAINER_LAYOUT, INITIAL_LAYOUT_VALUE } from '../constants';
 import type { ContainerLayoutState, LayoutState } from '../types';
 
 const INITIAL_STATE: LayoutState = {
+  window: Dimensions.get('window'),
   rawContainerHeight: INITIAL_LAYOUT_VALUE,
   containerHeight: INITIAL_LAYOUT_VALUE,
   containerOffset: INITIAL_CONTAINER_LAYOUT.offset,
@@ -103,6 +105,15 @@ export function useAnimatedLayout(
     },
     [state, verticalInset, modal]
   );
+  useEffect(() => {
+    Dimensions.addEventListener('change', ({ window }) => {
+      state.modify(_state => {
+        'worklet';
+        _state.window = window;
+        return _state;
+      });
+    });
+  }, [state]);
   //#endregion
 
   return state;
```

**File**: `src/hooks/useGestureEventsHandlersDefault.tsx` (modified, +4/-3)
```diff
@@ -1,5 +1,5 @@
 import { useCallback } from 'react';
-import { Dimensions, Keyboard, Platform } from 'react-native';
+import { Keyboard, Platform } from 'react-native';
 import { runOnJS, useSharedValue } from 'react-native-reanimated';
 import {
   ANIMATION_SOURCE,
@@ -345,13 +345,13 @@ export const useGestureEventsHandlersDefault: GestureEventsHandlersHookType =
            *
            * because the the keyboard dismiss is interactive in iOS.
            */
-          const WINDOW_HEIGHT = Dimensions.get('window').height;
+          const { window } = animatedLayoutState.get();
           if (
             !(
               Platform.OS === 'ios' &&
               isScrollable &&
               absoluteY >
-                WINDOW_HEIGHT -
+                window.height -
                   animatedKeyboardState.get().heightWithinContainer
             )
           ) {
@@ -419,6 +419,7 @@ export const useGestureEventsHandlersDefault: GestureEventsHandlersHookType =
         enablePanDownToClose,
         isInTemporaryPosition,
         animatedScrollableState,
+        animatedLayoutState,
         animatedDetentsState,
         animatedKeyboardState,
         animatedPosition,
```

**File**: `src/hooks/useGestureEventsHandlersDefault.web.tsx` (modified, +4/-3)
```diff
@@ -1,5 +1,5 @@
 import { useCallback } from 'react';
-import { Dimensions, Keyboard, Platform } from 'react-native';
+import { Keyboard, Platform } from 'react-native';
 import { runOnJS, useSharedValue } from 'react-native-reanimated';
 import {
   ANIMATION_SOURCE,
@@ -328,13 +328,13 @@ export const useGestureEventsHandlersDefault = () => {
          *
          * because the the keyboard dismiss is interactive in iOS.
          */
-        const WINDOW_HEIGHT = Dimensions.get('window').height;
+        const { window } = animatedLayoutState.get();
         if (
           !(
             Platform.OS === 'ios' &&
             isScrollable &&
             absoluteY >
-              WINDOW_HEIGHT - animatedKeyboardState.get().heightWithinContainer
+              window.height - animatedKeyboardState.get().heightWithinContainer
           )
         ) {
           dismissKeyboardOnJs();
@@ -396,6 +396,7 @@ export const useGestureEventsHandlersDefault = () => {
       animatedDetentsState,
       animatedKeyboardState,
       animatedPosition,
+      animatedLayoutState,
       animateToPosition,
       context,
     ]
```

**File**: `src/types.d.ts` (modified, +7/-0)
```diff
@@ -300,6 +300,13 @@ export type ContainerLayoutState = {
  * Represents the layout state of the bottom sheet components.
  */
 export type LayoutState = {
+  /**
+   * Getting latest window layout on a shared value
+   */
+  window: {
+    height: number;
+    width: number;
+  };
   /**
    * The original height of the container before any adjustments.
    */
```

---

### Incident Patch 2: `782e00c9` (2026-05-09)
**Commit Message**: fix: allow mount animation alongside keyboard during initial open (#2661) (#2665)(by @huextrat)

The #2655 guard skipped any RUNNING animation before didAnimateOnMount,
which includes keyboard repositioning when TextInput autoFocus opens the
keyboard immediately. Only skip mount when a close is in progress
(isForcedClosing or nextIndex === -1).

**File**: `src/components/bottomSheet/BottomSheet.tsx` (modified, +8/-3)
```diff
@@ -967,10 +967,15 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
          */
         if (!didAnimateOnMount.value) {
           /**
-           * if there's a running animation (like force close), respect it and don't
-           * override with mount animation
+           * If a *close* animation is already running, do not override it with the mount
+           * animation (#2655). Keyboard-driven animations can also be RUNNING during this
+           * phase (e.g. TextInput autoFocus); those must not block mount or the sheet stays
+           * misaligned with the keyboard (#2661).
            */
-          if (animationStatus === ANIMATION_STATUS.RUNNING) {
+          if (
+            animationStatus === ANIMATION_STATUS.RUNNING &&
+            (isForcedClosing || nextIndex === -1)
+          ) {
             return;
           }
           /**
```

---

### Incident Patch 3: `03a215c9` (2026-04-30)
**Commit Message**: fix(modal): restore React mount reset after unmount (#2664)(by @huextrat)

unmount() must call setState(INITIAL_STATE) when the portal was
mounted. v5.2.11 checked statusRef after resetVariables(), which
always left status INITIAL, so the condition never matched and
mount stayed true—later present() could snap the sheet open again.

Made-with: Cursor

**File**: `src/components/bottomSheetModal/BottomSheetModal.tsx` (modified, +6/-6)
```diff
@@ -64,6 +64,8 @@ function BottomSheetModalComponent<T = never>(
   //#region state
   const [{ mount, data }, setState] =
     useState<BottomSheetModalState<T>>(INITIAL_STATE);
+  const mountRef = useRef(mount);
+  mountRef.current = mount;
   //#endregion
 
   //#region hooks
@@ -109,19 +111,17 @@ function BottomSheetModalComponent<T = never>(
           method: unmount.name,
         });
       }
+      const hadReactMount = mountRef.current;
+
       // reset variables
       resetVariables();
 
       // unmount sheet and portal
       unmountSheet(key);
       unmountPortal(key);
 
-      // unmount the node, if sheet is still mounted
-      if (
-        [MODAL_STATUS.PRESENTED, MODAL_STATUS.ANIMATING].includes(
-          statusRef.current
-        )
-      ) {
+      // unmount the node, if sheet is still mounted in React state
+      if (hadReactMount) {
         setState(INITIAL_STATE);
       }
 
```

---

### Incident Patch 4: `5e4f00d6` (2026-04-29)
**Commit Message**: fix: updated getting scrollable ref for BottomSheetSectionList on Web 5.2.10 (#2662) (by @rozhkovs)

**File**: `src/utilities/findNodeHandle.web.ts` (modified, +10/-0)
```diff
@@ -12,6 +12,7 @@ import {
 interface ScrollComponentInternals {
   /** Available on ScrollView, FlatList, etc. to get the underlying native scroll ref */
   getNativeScrollRef?: () => NodeHandle | null;
+  getScrollableNode?: () => NodeHandle | null;
   /** Internal property on VirtualizedList storing the scroll ref */
   _scrollRef?: NodeHandle | null;
 }
@@ -45,6 +46,15 @@ export function findNodeHandle(
     }
   } catch {}
 
+  try {
+    if (typeof scrollable.getScrollableNode === 'function') {
+      nodeHandle = scrollable.getScrollableNode();
+      if (nodeHandle) {
+        return nodeHandle;
+      }
+    }
+  } catch {}
+
   if (scrollable._scrollRef != null) {
     return scrollable._scrollRef;
   }
```

---

### Incident Patch 5: `17ee2217` (2026-04-28)
**Commit Message**: fix(#2639): use window height as initial position

**File**: `src/components/bottomSheet/BottomSheet.tsx` (modified, +1/-1)
```diff
@@ -215,7 +215,7 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
     const animatedCurrentIndex = useReactiveSharedValue(
       animateOnMount ? -1 : _providedIndex
     );
-    const animatedPosition = useSharedValue(Dimensions.get('screen').height);
+    const animatedPosition = useSharedValue(Dimensions.get('window').height);
 
     // conditional
     const didAnimateOnMount = useSharedValue(
```

---

### Incident Patch 6: `2b4a338e` (2026-04-28)
**Commit Message**: fix(#2632): rewrote the modal status logic to prevent getting out of sync

**File**: `example/src/screens/modal/StackExample.tsx` (modified, +3/-3)
```diff
@@ -63,7 +63,7 @@ const StackExample = () => {
   // renders
   const renderHeaderHandle = useCallback(
     (title: string) => (props: BottomSheetHandleProps) => (
-      <HeaderHandle {...props} children={title} />
+      <HeaderHandle {...props}>{title}</HeaderHandle>
     ),
     []
   );
@@ -101,8 +101,8 @@ const StackExample = () => {
           <Button label="Dismiss Modal C" onPress={handleDismissCPress} />
         </View>
       </View>
-      <Button label="Dismiss All Modals" onPress={handleDismissAllPress} />
-      <Button label="Dismiss All By Hook" onPress={handleDismissByHookPress} />
+      <Button label="Dismiss All Modal 'A' By Hook" onPress={handleDismissByHookPress} />
+      <Button label="Dismiss All Modals by Hook" onPress={handleDismissAllPress} />
 
       <BottomSheetModal
         name="A"
```

**File**: `src/components/bottomSheetModal/BottomSheetModal.tsx` (modified, +190/-89)
```diff
@@ -19,6 +19,7 @@ import BottomSheet from '../bottomSheet';
 import {
   DEFAULT_ENABLE_DISMISS_ON_CLOSE,
   DEFAULT_STACK_BEHAVIOR,
+  MODAL_STATUS,
 } from './constants';
 import type {
   BottomSheetModalPrivateMethods,
@@ -78,13 +79,10 @@ function BottomSheetModalComponent<T = never>(
 
   //#region refs
   const bottomSheetRef = useRef<BottomSheet>(null);
+  const statusRef = useRef<MODAL_STATUS>(MODAL_STATUS.INITIAL);
   const currentIndexRef = useRef(!animateOnMount ? index : -1);
   const nextIndexRef = useRef<number | null>(null);
   const restoreIndexRef = useRef(-1);
-  const minimized = useRef(false);
-  const forcedDismissed = useRef(false);
-  const mounted = useRef(false);
-  mounted.current = mount;
   //#endregion
 
   //#region variables
@@ -93,26 +91,24 @@ function BottomSheetModalComponent<T = never>(
 
   //#region private methods
   const resetVariables = useCallback(function resetVariables() {
-    print({
-      component: BottomSheetModal.name,
-      method: resetVariables.name,
-    });
+    if (__DEV__) {
+      print({
+        component: 'BottomSheetModal',
+        method: resetVariables.name,
+      });
+    }
     currentIndexRef.current = -1;
     restoreIndexRef.current = -1;
-    minimized.current = false;
-    mounted.current = false;
-    forcedDismissed.current = false;
+    statusRef.current = MODAL_STATUS.INITIAL;
   }, []);
   const unmount = useCallback(
     function unmount() {
       if (__DEV__) {
         print({
-          component: BottomSheetModal.name,
+          component: 'BottomSheetModal',
           method: unmount.name,
         });
       }
-      const _mounted = mounted.current;
-
       // reset variables
       resetVariables();
 
@@ -121,7 +117,11 @@ function BottomSheetModalComponent<T = never>(
       unmountPortal(key);
 
       // unmount the node, if sheet is still mounted
-      if (_mounted) {
+      if (
+        [MODAL_STATUS.PRESENTED, MODAL_STATUS.ANIMATING].includes(
+          statusRef.current
+        )
+      ) {
         setState(INITIAL_STATE);
       }
 
@@ -137,7 +137,10 @@ function BottomSheetModalComponent<T = never>(
   //#region bottom sheet methods
   const handleSnapToIndex = useCallback<BottomSheetMethods['snapToIndex']>(
     (...args) => {
-      if (minimized.current) {
+      if (
+        statusRef.current === MODAL_STATUS.MINIMIZED ||
+        statusRef.current === MODAL_STATUS.MINIMIZING
+      ) {
         return;
       }
       bottomSheetRef.current?.snapToIndex(...args);
@@ -147,35 +150,72 @@ function BottomSheetModalComponent<T = never>(
   const handleSnapToPosition = useCallback<
     BottomSheetMethods['snapToPosition']
   >((...args) => {
-    if (minimized.current) {
+    if (
+      [
+        MODAL_STATUS.MINIMIZED,
+        MODAL_STATUS.MINIMIZING,
+        MODAL_STATUS.DISMISSED,
+        MODAL_STATUS.DISMISSING,
+      ].includes(statusRef.current)
+    ) {
       return;
     }
     bottomSheetRef.current?.snapToPosition(...args);
   }, []);
   const handleExpand: BottomSheetMethods['expand'] = useCallback((...args) => {
-    if (minimized.current) {
+    if (
+      [
+        MODAL_STATUS.MINIMIZED,
+        MODAL_STATUS.MINIMIZING,
+        MODAL_STATUS.DISMISSED,
+        MODAL_STATUS.DISMISSING,
+      ].includes(statusRef.current)
+    ) {
       return;
     }
     bottomSheetRef.current?.expand(...args);
   }, []);
   const handleCollapse: BottomSheetMethods['collapse'] = useCallback(
     (...args) => {
-      if (minimized.current) {
+      if (
+        [
+          MODAL_STATUS.MINIMIZED,
+          MODAL_STATUS.MINIMIZING,
+          MODAL_STATUS.DISMISSED,
+          MODAL_STATUS.DISMISSING,
+        ].includes(statusRef.current)
+      ) {
         return;
       }
       bottomSheetRef.current?.collapse(...args);
     },
     []
   );
   const handleClose: BottomSheetMethods['close'] = useCallback((...args) => {
-    if (minimized.current) {
+    if (
+      [
+        MODAL_STATUS.MINIMIZED,
+        MODAL_STATUS.MINIMIZING,
+        MODAL_STATUS.DISMISSED,
+        MODAL_STATUS.DISMISSING,
+        MODAL_STATUS.CLOSED,
+      ].includes(statusRef.current)
+    ) {
       return;
     }
     bottomSheetRef.current?.close(...args);
   }, []);
   const handleForceClose: BottomSheetMethods['forceClose'] = useCallback(
     (...args) => {
-      if (minimized.current) {
+      if (
+        [
+          MODAL_STATUS.MINIMIZED,
+          MODAL_STATUS.MINIMIZING,
+          MODAL_STATUS.DISMISSED,
+          MODAL_STATUS.DISMISSING,
+          MODAL_STATUS.CLOSED,
+        ].includes(statusRef.current)
+      ) {
         return;
       }
       bottomSheetRef.current?.forceClose(...args);
@@ -188,91 +228,96 @@ function BottomSheetModalComponent<T = never>(
   // biome-ignore lint/correctness/useExhaustiveDependencies(ref): ref is a stable object
   const handlePresent = useCallback(
     function handlePresent(_data?: T) {
+      if (__DEV__) {
+        print({
+          componen
```

**File**: `src/components/bottomSheetModal/constants.ts` (modified, +16/-1)
```diff
@@ -1,4 +1,19 @@
 const DEFAULT_STACK_BEHAVIOR = 'switch';
 const DEFAULT_ENABLE_DISMISS_ON_CLOSE = true;
 
-export { DEFAULT_ENABLE_DISMISS_ON_CLOSE, DEFAULT_STACK_BEHAVIOR };
+enum MODAL_STATUS {
+  INITIAL,
+  PRESENTED,
+  CLOSED,
+  MINIMIZED,
+  MINIMIZING,
+  ANIMATING,
+  DISMISSING,
+  DISMISSED,
+}
+
+export {
+  DEFAULT_ENABLE_DISMISS_ON_CLOSE,
+  DEFAULT_STACK_BEHAVIOR,
+  MODAL_STATUS,
+};
```

**File**: `src/components/bottomSheetModal/types.d.ts` (modified, +2/-0)
```diff
@@ -1,11 +1,13 @@
 import type React from 'react';
 import type { MODAL_STACK_BEHAVIOR } from '../../constants';
 import type { BottomSheetProps } from '../bottomSheet';
+import type { MODAL_STATUS } from './constants';
 
 export interface BottomSheetModalPrivateMethods {
   dismiss: (force?: boolean) => void;
   minimize: () => void;
   restore: () => void;
+  status: React.MutableRefObject<MODAL_STATUS>;
 }
 
 export type BottomSheetModalStackBehavior = keyof typeof MODAL_STACK_BEHAVIOR;
```

**File**: `src/components/bottomSheetModalProvider/BottomSheetModalProvider.tsx` (modified, +15/-13)
```diff
@@ -16,6 +16,7 @@ import type {
   BottomSheetModalPrivateMethods,
   BottomSheetModalStackBehavior,
 } from '../bottomSheetModal';
+import { MODAL_STATUS } from '../bottomSheetModal/constants';
 import type {
   BottomSheetModalProviderProps,
   BottomSheetModalRef,
@@ -67,7 +68,13 @@ const BottomSheetModalProviderWrapper = ({
        * - it is not unmounting
        */
       const currentMountedSheet = _sheetsQueue[_sheetsQueue.length - 1];
-      if (currentMountedSheet && !currentMountedSheet.willUnmount) {
+      const currentMountedSheetStatus =
+        currentMountedSheet?.ref.current?.status.current;
+      const currentMountedSheetWillUnmount =
+        currentMountedSheetStatus !== undefined &&
+        currentMountedSheetStatus === MODAL_STATUS.DISMISSING;
+
+      if (currentMountedSheet && !currentMountedSheetWillUnmount) {
         if (stackBehavior === MODAL_STACK_BEHAVIOR.replace) {
           currentMountedSheet.ref?.current?.dismiss();
         } else if (stackBehavior === MODAL_STACK_BEHAVIOR.switch) {
@@ -76,8 +83,7 @@ const BottomSheetModalProviderWrapper = ({
       }
 
       /**
-       * Restore and remove incoming sheet from the queue,
-       * if it was registered.
+       * Restore and remove incoming sheet from the queue, if it was registered.
        */
       if (sheetIndex !== -1) {
         _sheetsQueue.splice(sheetIndex, 1);
@@ -87,7 +93,6 @@ const BottomSheetModalProviderWrapper = ({
       _sheetsQueue.push({
         key,
         ref,
-        willUnmount: false,
       });
       sheetsQueueRef.current = _sheetsQueue;
     },
@@ -115,11 +120,16 @@ const BottomSheetModalProviderWrapper = ({
     const hasMinimizedSheet = sheetsQueueRef.current.length > 0;
     const minimizedSheet =
       sheetsQueueRef.current[sheetsQueueRef.current.length - 1];
+    const minimizedSheetStatus = minimizedSheet?.ref.current?.status.current;
+    const minimizedSheetWillUnmount =
+      minimizedSheetStatus !== undefined &&
+      minimizedSheetStatus === MODAL_STATUS.DISMISSING;
+
     if (
       sheetOnTop &&
       hasMinimizedSheet &&
       minimizedSheet &&
-      !minimizedSheet.willUnmount
+      !minimizedSheetWillUnmount
     ) {
       sheetsQueueRef.current[
         sheetsQueueRef.current.length - 1
@@ -131,14 +141,6 @@ const BottomSheetModalProviderWrapper = ({
     const sheetIndex = _sheetsQueue.findIndex(item => item.key === key);
     const sheetOnTop = sheetIndex === _sheetsQueue.length - 1;
 
-    /**
-     * Here we mark the sheet that will unmount,
-     * so it won't be restored.
-     */
-    if (sheetIndex !== -1) {
-      _sheetsQueue[sheetIndex].willUnmount = true;
-    }
-
     /**
      * Here we try to restore previous sheet position,
      * This is needed when user dismiss the modal by fire the dismiss action.
```

**File**: `src/components/bottomSheetModalProvider/types.d.ts` (modified, +0/-1)
```diff
@@ -4,7 +4,6 @@ import type { BottomSheetModalPrivateMethods } from '../bottomSheetModal';
 export interface BottomSheetModalRef {
   key: string;
   ref: RefObject<BottomSheetModalPrivateMethods>;
-  willUnmount: boolean;
 }
 
 export interface BottomSheetModalProviderProps {
```

**File**: `src/types.d.ts` (modified, +0/-1)
```diff
@@ -30,7 +30,6 @@ import type {
   ANIMATION_STATUS,
   GESTURE_SOURCE,
   KEYBOARD_STATUS,
-  SCROLLABLE_STATUS,
   SCROLLABLE_TYPE,
 } from './constants';
 
```

---

### Incident Patch 7: `325ade63` (2026-04-28)
**Commit Message**: fix(#2639): removed screen and window layout constants

**File**: `src/components/bottomSheet/BottomSheet.tsx` (modified, +14/-15)
```diff
@@ -7,7 +7,7 @@ import React, {
   useImperativeHandle,
   useMemo,
 } from 'react';
-import { Platform, StyleSheet } from 'react-native';
+import { Dimensions, Platform, StyleSheet } from 'react-native';
 import { State } from 'react-native-gesture-handler';
 import Animated, {
   cancelAnimation,
@@ -80,7 +80,6 @@ import {
   DEFAULT_KEYBOARD_INDEX,
   DEFAULT_KEYBOARD_INPUT_MODE,
   DEFAULT_OVER_DRAG_RESISTANCE_FACTOR,
-  INITIAL_POSITION,
   INITIAL_VALUE,
 } from './constants';
 import type { AnimateToPositionType, BottomSheetProps } from './types';
@@ -216,10 +215,10 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
     const animatedCurrentIndex = useReactiveSharedValue(
       animateOnMount ? -1 : _providedIndex
     );
-    const animatedPosition = useSharedValue(INITIAL_POSITION);
+    const animatedPosition = useSharedValue(Dimensions.get('screen').height);
 
     // conditional
-    const isAnimatedOnMount = useSharedValue(
+    const didAnimateOnMount = useSharedValue(
       !animateOnMount || _providedIndex === -1
     );
     const isLayoutCalculated = useDerivedValue(() => {
@@ -566,7 +565,7 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
 
         // reset values
         animatedContainerHeightDidChange.set(false);
-        isAnimatedOnMount.set(true);
+        didAnimateOnMount.set(true);
         animatedAnimationState.set({
           status: ANIMATION_STATUS.STOPPED,
           source: ANIMATION_SOURCE.NONE,
@@ -581,7 +580,7 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
         animatedCurrentIndex,
         animatedAnimationState,
         animatedContainerHeightDidChange,
-        isAnimatedOnMount,
+        didAnimateOnMount,
       ]
     );
     const animateToPosition: AnimateToPositionType = useCallback(
@@ -872,7 +871,7 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
          * if the bottom sheet did not animate on mount,
          * then we return the provided index or the closed position.
          */
-        if (!isAnimatedOnMount.value) {
+        if (!didAnimateOnMount.value) {
           return _providedIndex === -1
             ? closedDetentPosition
             : detents[_providedIndex];
@@ -912,7 +911,7 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
         animatedPosition,
         animatedDetentsState,
         isInTemporaryPosition,
-        isAnimatedOnMount,
+        didAnimateOnMount,
         keyboardBehavior,
         keyboardBlurBehavior,
         _providedIndex,
@@ -966,7 +965,7 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
          * when evaluating the position while the mount animation not been handled,
          * then we evaluate on mount use cases.
          */
-        if (!isAnimatedOnMount.value) {
+        if (!didAnimateOnMount.value) {
           /**
            * if there's a running animation (like force close), respect it and don't
            * override with mount animation
@@ -987,7 +986,7 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
             );
           } else {
             setToPosition(proposedPosition);
-            isAnimatedOnMount.value = true;
+            didAnimateOnMount.value = true;
           }
           return;
         }
@@ -1075,7 +1074,7 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
         animatedIndex,
         animatedPosition,
         animatedDetentsState,
-        isAnimatedOnMount,
+        didAnimateOnMount,
         isInTemporaryPosition,
         isLayoutCalculated,
       ]
@@ -1588,7 +1587,7 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
          */
         if (
           JSON.stringify(result) === JSON.stringify(previous) &&
-          isAnimatedOnMount.value
+          didAnimateOnMount.value
         ) {
           return;
         }
@@ -1613,7 +1612,7 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
 
         evaluatePosition(ANIMATION_SOURCE.SNAP_POINT_CHANGE);
       },
-      [isLayoutCalculated, isAnimatedOnMount, animatedDetentsState]
+      [isLayoutCalculated, didAnimateOnMount, animatedDetentsState]
     );
 
     /**
@@ -1778,12 +1777,12 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
      */
     useEffect(() => {
       // early exit, if animate on mount is set and it did not animate yet.
-      if (animateOnMount && !isAnimatedOnMount.value) {
+      if (animateOnMount && !didAnimateOnMount.value) {
         return;
       }
 
       handleSnapToIndex(_providedIndex);
-    }, [animateOnMount, _providedIndex, isAnimatedOnMount, handleSnapToIndex]);
+    }, [animateOnMount, _providedIndex, didAnimateOnMount, handleSnapToIndex]);
     //#endregion
 
     // render
```

**File**: `src/components/bottomSheet/constants.ts` (modified, +9/-15)
```diff
@@ -2,7 +2,6 @@ import {
   KEYBOARD_BEHAVIOR,
   KEYBOARD_BLUR_BEHAVIOR,
   KEYBOARD_INPUT_MODE,
-  SCREEN_HEIGHT,
 } from '../../constants';
 
 // default values
@@ -25,34 +24,29 @@ const DEFAULT_KEYBOARD_INDEX = -998;
 // initial values
 const INITIAL_VALUE = Number.NEGATIVE_INFINITY;
 const INITIAL_SNAP_POINT = -999;
-const INITIAL_POSITION = SCREEN_HEIGHT;
 
 // accessibility
 const DEFAULT_ACCESSIBLE = true;
 const DEFAULT_ACCESSIBILITY_LABEL = 'Bottom Sheet';
 const DEFAULT_ACCESSIBILITY_ROLE = 'adjustable';
 
 export {
-  DEFAULT_HANDLE_HEIGHT,
-  DEFAULT_OVER_DRAG_RESISTANCE_FACTOR,
+  DEFAULT_ACCESSIBILITY_LABEL,
+  DEFAULT_ACCESSIBILITY_ROLE,
+  DEFAULT_ACCESSIBLE,
+  DEFAULT_ANIMATE_ON_MOUNT,
+  DEFAULT_DYNAMIC_SIZING,
+  DEFAULT_ENABLE_BLUR_KEYBOARD_ON_GESTURE,
   DEFAULT_ENABLE_CONTENT_PANNING_GESTURE,
   DEFAULT_ENABLE_HANDLE_PANNING_GESTURE,
   DEFAULT_ENABLE_OVER_DRAG,
   DEFAULT_ENABLE_PAN_DOWN_TO_CLOSE,
-  DEFAULT_DYNAMIC_SIZING,
-  DEFAULT_ANIMATE_ON_MOUNT,
-  // keyboard
+  DEFAULT_HANDLE_HEIGHT,
   DEFAULT_KEYBOARD_BEHAVIOR,
   DEFAULT_KEYBOARD_BLUR_BEHAVIOR,
-  DEFAULT_KEYBOARD_INPUT_MODE,
-  DEFAULT_ENABLE_BLUR_KEYBOARD_ON_GESTURE,
   DEFAULT_KEYBOARD_INDEX,
-  // layout
-  INITIAL_POSITION,
+  DEFAULT_KEYBOARD_INPUT_MODE,
+  DEFAULT_OVER_DRAG_RESISTANCE_FACTOR,
   INITIAL_SNAP_POINT,
   INITIAL_VALUE,
-  // accessibility
-  DEFAULT_ACCESSIBLE,
-  DEFAULT_ACCESSIBILITY_LABEL,
-  DEFAULT_ACCESSIBILITY_ROLE,
 };
```

**File**: `src/components/bottomSheetHandle/styles.ts` (modified, +2/-3)
```diff
@@ -1,5 +1,4 @@
-import { Platform, StyleSheet } from 'react-native';
-import { WINDOW_WIDTH } from '../../constants';
+import { Dimensions, Platform, StyleSheet } from 'react-native';
 
 export const styles = StyleSheet.create({
   container: {
@@ -14,7 +13,7 @@ export const styles = StyleSheet.create({
 
   indicator: {
     alignSelf: 'center',
-    width: (7.5 * WINDOW_WIDTH) / 100,
+    width: (7.5 * Dimensions.get('window').width) / 100,
     height: 4,
     borderRadius: 4,
     backgroundColor: 'rgba(0, 0, 0, 0.75)',
```

**File**: `src/components/bottomSheetHostingContainer/BottomSheetHostingContainer.tsx` (modified, +2/-1)
```diff
@@ -1,13 +1,13 @@
 import React, { memo, useCallback, useMemo, useRef } from 'react';
 import {
+  Dimensions,
   type LayoutChangeEvent,
   StatusBar,
   type StyleProp,
   StyleSheet,
   View,
   type ViewStyle,
 } from 'react-native';
-import { WINDOW_HEIGHT } from '../../constants';
 import { print } from '../../utilities';
 import { styles } from './styles';
 import type { BottomSheetHostingContainerProps } from './types';
@@ -65,6 +65,7 @@ function BottomSheetHostingContainerComponent({
         });
       }
 
+      const WINDOW_HEIGHT = Dimensions.get('window').height;
       containerRef.current?.measure(
         (_x, _y, _width, _height, _pageX, pageY) => {
           const offset = {
```

**File**: `src/constants.ts` (modified, +1/-8)
```diff
@@ -1,10 +1,7 @@
-import { Dimensions, Platform } from 'react-native';
+import { Platform } from 'react-native';
 import { Easing } from 'react-native-reanimated';
 import type { SpringConfig, TimingConfig } from './types';
 
-const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');
-const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('screen');
-
 enum GESTURE_SOURCE {
   UNDETERMINED = 0,
   SCROLLABLE = 1,
@@ -147,13 +144,9 @@ export {
   KEYBOARD_INPUT_MODE,
   KEYBOARD_STATUS,
   MODAL_STACK_BEHAVIOR,
-  SCREEN_HEIGHT,
-  SCREEN_WIDTH,
   SCROLLABLE_DECELERATION_RATE_MAPPER,
   SCROLLABLE_STATUS,
   SCROLLABLE_TYPE,
   SHEET_STATE,
   SNAP_POINT_TYPE,
-  WINDOW_HEIGHT,
-  WINDOW_WIDTH,
 };
```

**File**: `src/hooks/useAnimatedKeyboard.ts` (modified, +3/-1)
```diff
@@ -1,5 +1,6 @@
 import { useCallback, useEffect, useRef } from 'react';
 import {
+  Dimensions,
   Keyboard,
   type KeyboardEvent,
   type KeyboardEventEasing,
@@ -11,7 +12,7 @@ import {
   useAnimatedReaction,
   useSharedValue,
 } from 'react-native-reanimated';
-import { KEYBOARD_STATUS, SCREEN_HEIGHT } from '../constants';
+import { KEYBOARD_STATUS } from '../constants';
 import type { KeyboardState } from '../types';
 
 const KEYBOARD_EVENT_MAPPER = {
@@ -106,6 +107,7 @@ export const useAnimatedKeyboard = () => {
 
   //#region effects
   useEffect(() => {
+    const SCREEN_HEIGHT = Dimensions.get('screen').height;
     const handleOnKeyboardShow = (event: KeyboardEvent) => {
       runOnUI(handleKeyboardEvent)(
         KEYBOARD_STATUS.SHOWN,
```

**File**: `src/hooks/useGestureEventsHandlersDefault.tsx` (modified, +2/-2)
```diff
@@ -1,12 +1,11 @@
 import { useCallback } from 'react';
-import { Keyboard, Platform } from 'react-native';
+import { Dimensions, Keyboard, Platform } from 'react-native';
 import { runOnJS, useSharedValue } from 'react-native-reanimated';
 import {
   ANIMATION_SOURCE,
   GESTURE_SOURCE,
   KEYBOARD_STATUS,
   SCROLLABLE_TYPE,
-  WINDOW_HEIGHT,
 } from '../constants';
 import type {
   GestureEventHandlerCallbackType,
@@ -346,6 +345,7 @@ export const useGestureEventsHandlersDefault: GestureEventsHandlersHookType =
            *
            * because the the keyboard dismiss is interactive in iOS.
            */
+          const WINDOW_HEIGHT = Dimensions.get('window').height;
           if (
             !(
               Platform.OS === 'ios' &&
```

**File**: `src/hooks/useGestureEventsHandlersDefault.web.tsx` (modified, +2/-2)
```diff
@@ -1,12 +1,11 @@
 import { useCallback } from 'react';
-import { Keyboard, Platform } from 'react-native';
+import { Dimensions, Keyboard, Platform } from 'react-native';
 import { runOnJS, useSharedValue } from 'react-native-reanimated';
 import {
   ANIMATION_SOURCE,
   GESTURE_SOURCE,
   KEYBOARD_STATUS,
   SCROLLABLE_TYPE,
-  WINDOW_HEIGHT,
 } from '../constants';
 import type { GestureEventHandlerCallbackType } from '../types';
 import { clamp } from '../utilities/clamp';
@@ -329,6 +328,7 @@ export const useGestureEventsHandlersDefault = () => {
          *
          * because the the keyboard dismiss is interactive in iOS.
          */
+        const WINDOW_HEIGHT = Dimensions.get('window').height;
         if (
           !(
             Platform.OS === 'ios' &&
```

---

### Incident Patch 8: `ad41447b` (2026-04-21)
**Commit Message**: fix: prevent rapid present/close from freezing BottomSheetModal (#2655)(by @adam-sajko)

**File**: `src/components/bottomSheet/BottomSheet.tsx` (modified, +7/-0)
```diff
@@ -967,6 +967,13 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
          * then we evaluate on mount use cases.
          */
         if (!isAnimatedOnMount.value) {
+          /**
+           * if there's a running animation (like force close), respect it and don't
+           * override with mount animation
+           */
+          if (animationStatus === ANIMATION_STATUS.RUNNING) {
+            return;
+          }
           /**
            * if animate on mount is set to true, then we animate to the propose position,
            * else, we set the position with out animation.
```

**File**: `src/components/bottomSheetModal/BottomSheetModal.tsx` (modified, +5/-1)
```diff
@@ -189,6 +189,10 @@ function BottomSheetModalComponent<T = never>(
   const handlePresent = useCallback(
     function handlePresent(_data?: T) {
       requestAnimationFrame(() => {
+        if (mounted.current && bottomSheetRef.current) {
+          forcedDismissed.current = false;
+          bottomSheetRef.current.snapToIndex(index);
+        }
         setState({
           mount: true,
           data: _data,
@@ -209,7 +213,7 @@ function BottomSheetModalComponent<T = never>(
       });
     },
     // eslint-disable-next-line react-hooks/exhaustive-deps
-    [key, stackBehavior, mountSheet]
+    [key, stackBehavior, mountSheet, index]
   );
   const handleDismiss = useCallback<BottomSheetModalMethods['dismiss']>(
     function handleDismiss(animationConfigs) {
```

---

### Incident Patch 9: `8cf9d1be` (2026-04-21)
**Commit Message**: fix: invoke render function children instead of rendering as JSX component (#2636)(by @linkeryoon)

This reverts the regression introduced during the v5 migration,
where Content({ data }) was changed back to <Content data={data} />.

Originally fixed in #1750 but lost during the v5 codebase migration.

**File**: `src/components/bottomSheetModal/BottomSheetModal.tsx` (modified, +1/-1)
```diff
@@ -452,7 +452,7 @@ function BottomSheetModalComponent<T = never>(
           onAnimate={handleBottomSheetOnAnimate}
           $modal={true}
         >
-          {typeof Content === 'function' ? <Content data={data} /> : Content}
+          {typeof Content === 'function' ? Content({ data }) : Content}
         </BottomSheet>
       </ContainerComponent>
     </Portal>
```

---

### Incident Patch 10: `727eb03f` (2026-04-21)
**Commit Message**: fix: add typeof guard for getBoundingClientRect in useBoundingClientRect (#2626)(by @magrinj)

**File**: `src/hooks/useBoundingClientRect.ts` (modified, +6/-2)
```diff
@@ -67,8 +67,12 @@ export function useBoundingClientRect(
       return;
     }
 
-    // @ts-expect-error once it `unstable_getBoundingClientRect` gets stable 🤞.
-    if (ref.current.getBoundingClientRect !== null) {
+    if (
+      // @ts-expect-error once it `unstable_getBoundingClientRect` gets stable 🤞.
+      ref.current.getBoundingClientRect !== null &&
+      // @ts-expect-error once it `unstable_getBoundingClientRect` gets stable 🤞.
+      typeof ref.current.getBoundingClientRect === 'function'
+    ) {
       // @ts-expect-error once it `unstable_getBoundingClientRect` gets stable.
       const layout = ref.current.getBoundingClientRect();
       handler(layout);
```

---

### Incident Patch 11: `377d2de0` (2026-04-21)
**Commit Message**: fix: inline FlashListProps to remove @shopify/flash-list type dependency (#2620)(by @YevheniiKotyrlo)

The published BottomSheetFlashList.d.ts unconditionally imports from
@shopify/flash-list, but flash-list is not declared in any dependency
field. Consumers who don't install flash-list get TS2307 because
TypeScript strips @ts-ignore from emitted .d.ts files (by design,
confirmed in TypeScript #38628).

Replace the external type import with a minimal local interface
extending FlatListProps<T> from react-native. The runtime try/catch
require('@shopify/flash-list') is unchanged -- only types are affected.

Fixes #2390

**File**: `src/components/bottomSheetScrollable/BottomSheetFlashList.tsx` (modified, +10/-3)
```diff
@@ -1,14 +1,21 @@
-// @ts-expect-error
-import type { FlashListProps } from '@shopify/flash-list';
 import React, { forwardRef, memo, type Ref, useMemo } from 'react';
-import type { ScrollViewProps } from 'react-native';
+import type { FlatListProps, ScrollViewProps } from 'react-native';
 import type { AnimatedProps } from 'react-native-reanimated';
 import BottomSheetScrollView from './BottomSheetScrollView';
 import type {
   BottomSheetScrollableProps,
   BottomSheetScrollViewMethods,
 } from './types';
 
+/**
+ * Minimal subset of FlashListProps needed for BottomSheetFlashList.
+ * Defined locally to avoid requiring @shopify/flash-list as a dependency,
+ * since the runtime import is optional (try/catch require).
+ */
+interface FlashListProps<T> extends FlatListProps<T> {
+  estimatedItemSize?: number;
+}
+
 let FlashList: {
   FlashList: React.FC;
 };
```

---

### Incident Patch 12: `a5f5cf21` (2026-04-08)
**Commit Message**: fix: take into account scrollable content offset y for panning gesture (#2533) (by @doanhtu07)

* fix: take into account scrollable content offset y for panning gesture

* fix: use already declared variable for content offset y

**File**: `src/hooks/useGestureEventsHandlersDefault.tsx` (modified, +11/-3)
```diff
@@ -375,11 +375,21 @@ export const useGestureEventsHandlersDefault: GestureEventsHandlersHookType =
           snapPoints.unshift(closedDetentPosition);
         }
 
+        const wasGestureHandledByScrollView =
+          source === GESTURE_SOURCE.CONTENT && scrollableContentOffsetY > 0;
+
+        let rawDestinationPosition =
+          translationY + context.value.initialPosition;
+
+        if (wasGestureHandledByScrollView) {
+          rawDestinationPosition -= scrollableContentOffsetY;
+        }
+
         /**
          * calculate the destination point, using redash.
          */
         const destinationPoint = snapPoint(
-          translationY + context.value.initialPosition,
+          rawDestinationPosition,
           velocityY,
           snapPoints
         );
@@ -392,8 +402,6 @@ export const useGestureEventsHandlersDefault: GestureEventsHandlersHookType =
           return;
         }
 
-        const wasGestureHandledByScrollView =
-          source === GESTURE_SOURCE.CONTENT && scrollableContentOffsetY > 0;
         /**
          * prevents snapping from top to middle / bottom with repeated interrupted scrolls
          */
```

---

### Incident Patch 13: `3d6c2da1` (2026-04-08)
**Commit Message**: fix(web): React 19 compatibility and type safety for findNodeHandle (#2595)(by @YevheniiKotyrlo)

- Add early null check for componentOrHandle (React 19 fix)
- Replace @ts-ignore with proper TypeScript interface for scroll internals
- Add explicit return type annotation
- Use runtime type checking instead of relying on try/catch for flow control

Fixes #2366, #2237

**File**: `src/utilities/findNodeHandle.web.ts` (modified, +31/-10)
```diff
@@ -3,29 +3,50 @@ import {
   type NodeHandle,
 } from 'react-native';
 
+/**
+ * Type bridge for accessing undocumented React Native scroll component internals.
+ * These properties exist at runtime but aren't exposed in RN's public type definitions.
+ *
+ * @see https://github.com/facebook/react-native/blob/main/packages/virtualized-lists/Lists/VirtualizedList.js#L1252
+ */
+interface ScrollComponentInternals {
+  /** Available on ScrollView, FlatList, etc. to get the underlying native scroll ref */
+  getNativeScrollRef?: () => NodeHandle | null;
+  /** Internal property on VirtualizedList storing the scroll ref */
+  _scrollRef?: NodeHandle | null;
+}
+
 export function findNodeHandle(
   componentOrHandle: Parameters<typeof _findNodeHandle>['0']
-) {
-  let nodeHandle: NodeHandle | null;
+): NodeHandle | null | typeof componentOrHandle {
+  // Early return for null/undefined (React 19 fix)
+  if (componentOrHandle == null) {
+    return null;
+  }
+
+  let nodeHandle: NodeHandle | null = null;
+
   try {
     nodeHandle = _findNodeHandle(componentOrHandle);
     if (nodeHandle) {
       return nodeHandle;
     }
   } catch {}
 
+  // Type bridge: componentOrHandle may have scroll internals at runtime
+  const scrollable = componentOrHandle as unknown as ScrollComponentInternals;
+
   try {
-    // @ts-expect-error
-    nodeHandle = componentOrHandle.getNativeScrollRef();
-    if (nodeHandle) {
-      return nodeHandle;
+    if (typeof scrollable.getNativeScrollRef === 'function') {
+      nodeHandle = scrollable.getNativeScrollRef();
+      if (nodeHandle) {
+        return nodeHandle;
+      }
     }
   } catch {}
 
-  // @ts-expect-error https://github.com/facebook/react-native/blob/a314e34d6ee875830d36e4df1789a897c7262056/packages/virtualized-lists/Lists/VirtualizedList.js#L1252
-  nodeHandle = componentOrHandle._scrollRef;
-  if (nodeHandle) {
-    return nodeHandle;
+  if (scrollable._scrollRef != null) {
+    return scrollable._scrollRef;
   }
 
   console.warn('could not find scrollable ref!');
```

---

### Incident Patch 14: `cf2443d9` (2026-04-08)
**Commit Message**: doc: fix a typo and improve variable naming in hooks.md (#2615)(by @Chinteyley)

Corrected a typo in the hook description and updated variable name for clarity.

**File**: `website/docs/hooks.md` (modified, +2/-2)
```diff
@@ -90,15 +90,15 @@ const SheetContent = () => {
 
 ## useBottomSheetScrollableCreator
 
-A custom hook that creates a scrollable component for third-party libraries like `LegendList` or `FlashList` to integrate the interaction and scrolling behaviors with th BottomSheet component.
+A custom hook that creates a scrollable component for third-party libraries like `LegendList` or `FlashList` to integrate the interaction and scrolling behaviors with the BottomSheet component.
 
 ```tsx
 import React from 'react';
 import BottomSheet, { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
 import { LegendList } from '@legendapp/list';
 
 const SheetContent = () => {
-  const BottomSheetScrollable = useBottomSheetScrollableCreator();
+  const BottomSheetLegendListScrollable = useBottomSheetScrollableCreator();
   return (
     <BottomSheet>
       <LegendList
```

---

### Incident Patch 15: `eccd8237` (2026-04-08)
**Commit Message**: fix(layout): correct isLayoutCalculated always returning true (#2642)(by @spsaucier)

* fix(layout): correct isLayoutCalculated always returning true

The `isLayoutCalculated` derived value uses an OR condition to check
whether `containerHeight` has been provided:

    if (containerHeight !== null || containerHeight !== undefined)

This expression is always true for any value — if containerHeight is
null, the `!== undefined` branch is true, and vice versa. The intended
check should use AND:

    if (containerHeight !== null && containerHeight !== undefined)

Without this fix, `isLayoutCalculated` returns true before layout
measurements complete, allowing `evaluatePosition` to run with
`containerHeight = INITIAL_LAYOUT_VALUE (-999)`. This produces
incorrect detent positions and can cause the sheet's content panel to
animate to an off-screen position while the backdrop renders correctly
(since both are derived from the same animatedPosition, but the
incorrect initial animation target can leave the body off-screen after
the "completed" callback fires and the snap-point-change correction
races with the mount animation).

The second condition (`!== INITIAL_LAYOUT_VALUE`) still serves as

**File**: `src/components/bottomSheet/BottomSheet.tsx` (modified, +6/-6)
```diff
@@ -225,12 +225,12 @@ const BottomSheetComponent = forwardRef<BottomSheet, BottomSheetProps>(
     const isLayoutCalculated = useDerivedValue(() => {
       let isContainerHeightCalculated = false;
       const { containerHeight, handleHeight } = animatedLayoutState.get();
-      //container height was provided.
-      if (containerHeight !== null || containerHeight !== undefined) {
-        isContainerHeightCalculated = true;
-      }
-      // container height did set.
-      if (containerHeight !== INITIAL_LAYOUT_VALUE) {
+      //container height was provided and set not to initial value
+      if (
+        containerHeight !== null &&
+        containerHeight !== undefined &&
+        containerHeight !== INITIAL_LAYOUT_VALUE
+      ) {
         isContainerHeightCalculated = true;
       }
 
```

#### Recent Merged Pull Requests:
- **PR #2755** (closed): fix: isolate modal provider layout state (@huytdps13400)
- **PR #2754** (closed): fix: hide closed sheets below edge-to-edge containers (@huytdps13400)
- **PR #2752** (closed): fix: preserve content when toggling panning gesture (@huytdps13400)
- **PR #2738** (closed): fix: keep a sheet presented when snapToPosition targets a temporary position (@KurnosovNikita)
- **PR #2735** (closed): fix: restore BottomSheetModal generic default to any (@Ge0ffreyS)
- **PR #2726** (closed): Feat/reanimated 4 support (@misaku)
- **PR #2720** (closed): fix: evaluate mount position from JS when animated reactions never fire (@icantcodefyi)
- **PR #2717** (closed): fix: prevent unbounded scroll-event recursion while scrollable is locked (@OxMarco)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
