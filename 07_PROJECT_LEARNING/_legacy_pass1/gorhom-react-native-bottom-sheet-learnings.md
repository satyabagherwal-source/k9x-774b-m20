# Forensic Learning Record (Deep Inspection): gorhom/react-native-bottom-sheet

> **Canonical Artifact**: `07_PROJECT_LEARNING/gorhom-react-native-bottom-sheet-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gorhom/react-native-bottom-sheet](https://github.com/gorhom/react-native-bottom-sheet))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:42:52.459Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gorhom/react-native-bottom-sheet`
- **Description**: A performant interactive bottom sheet with fully configurable options 🚀
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9105 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};

```

### Core Architecture Module: `commitlint.config.js`
```
module.exports = {
  extends: ['@commitlint/config-conventional'],
};

```

### Core Architecture Module: `example/App.tsx`
```
import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Main from './src/Main';

import { enableScreens } from 'react-native-screens';
enableScreens(true);

// @ts-ignore
import { enableLogging } from '@gorhom/bottom-sheet';
enableLogging();

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <Main />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

```

### Core Architecture Module: `example/babel.config.js`
```
const path = require('node:path');
const pak = require('../package.json');

module.exports = api => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          extensions: ['.tsx', '.ts', '.js', '.json'],
          alias: {
            [pak.name]: path.join(__dirname, '..', pak.source),
          },
        },
      ],
      '@babel/plugin-proposal-export-namespace-from',
      'react-native-worklets/plugin',
    ],
  };
};

```

### Core Architecture Module: `example/metro.config.js`
```
// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const {
  wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config');

// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
const workspaceRoot = path.resolve(projectRoot, '..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

config.resolver.disableHierarchicalLookup = true;

module.exports = wrapWithReanimatedMetroConfig(config);

```

### Core Architecture Module: `example/src/Dev.tsx`
```
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useMemo, useRef } from 'react';
import {
  Button,
  type FlatList,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const DATA = new Array(50).fill(0).map((_, index) => ({
  id: `item-${index}`,
}));

const SNAP_POINTS = [300, 600];

const renderItem = ({ item }) => (
  <View style={styles.itemContainer}>
    <Text>{item.id}</Text>
  </View>
);

const App = () => {
  //#region ref
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [mount, setMount] = React.useState(false);
  //#endregion

  //#region hooks
  const { bottom: bottomSafeArea, top: topSafeArea } = useSafeAreaInsets();
  const { height } = useSafeAreaFrame();
  //#endregion

  //#region callbacks
  const handleOnLayout = useCallback(
    ({ nativeEvent: layout }: LayoutChangeEvent) => {
      // eslint-disable-next-line no-console
      console.log('BottomSheetFlatList::handleOnLayout', layout);
    },
    []
  );
  //#endregion

  //#region styles
  const contentContainerStyle = useMemo(
    () => ({
      paddingBottom: bottomSafeArea,
    }),
    [bottomSafeArea]
  );
  //#endregion

  // renders
  const ref = useRef<FlatList>(null);
  // ref.current?.getNativeScrollRef()
  return (
    <View style={styles.container}>
      <Button
        title="Mount"
        onPress={() => {
          setMount(prev => !prev);
        }}
      />
      {/* {<BottomSheetFlatList
            data={DATA}
            style={styles.itemList}
            contentContainerStyle={contentContainerStyle}
            renderItem={renderItem}
            onLayout={handleOnLayout}
          />} */}
      {mount ? (
        <BottomSheet
          ref={bottomSheetRef}
          topInset={topSafeArea}
          snapPoints={SNAP_POINTS}
          enableDynamicSizing={false}
        >
          <BottomSheetView>
            <Text>Hello World!</Text>
          </BottomSheetView>
        </BottomSheet>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'grey',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  itemList: {
    flex: 1,
  },
  itemContainer: {
    padding: 6,
  },
});

export default () => (
  <SafeAreaProvider>
    <App />
  </SafeAreaProvider>
);

```

### Core Architecture Module: `example/src/Main.tsx`
```
import { ShowcaseApp } from '@gorhom/showcase-template';
import React from 'react';
import { description, version } from '../../package.json';
import { screens } from './screens';

const author = {
  username: 'Mo Gorhom',
  url: 'https://gorhom.dev',
};

export default () => (
  <ShowcaseApp
    name="Bottom Sheet"
    description={description}
    version={version}
    author={author}
    data={screens}
  />
);

```

### Core Architecture Module: `example/src/components/button/Button.tsx`
```
import React, { memo } from 'react';
import { ViewStyle, TextStyle } from 'react-native';
import { ShowcaseButton, ShowcaseLabel } from '@gorhom/showcase-template';

interface ButtonProps {
  label: string;
  labelStyle?: TextStyle;
  style?: ViewStyle;
  onPress: () => void;
}

const ButtonComponent = ({
  label,
  labelStyle,
  style,
  onPress,
}: ButtonProps) => (
  <ShowcaseButton containerStyle={style} onPress={onPress}>
    <ShowcaseLabel style={labelStyle}>{label}</ShowcaseLabel>
  </ShowcaseButton>
);

export const Button = memo(ButtonComponent);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #2712** (2026-08-06): **[Bug]: Wrong calculation of the footer position on IOS in window mode**
  *Symptoms*: ### Version  v5  ### Reanimated Version  v3  ### Gesture Handler Version  v2  ### Platforms  iOS  ### What happened?  On IOS , specifically on window mode (Stage Manager) when the native IOS keyboard overlaps the app window the footer jumps unnecessary leaving a huge gap of empty space between the keyboard and the footer and hiding parts of the interface Here is the exact version of the library for reference :  - "@gorhom/bottom-sheet": "^5.2.6",  - "react-native-reanimated": "^4.2.1",  - "react-native-gesture-handler": "^2.28.0",  Note: It is worth mentioning that the issue do not happen outside window mode on IOS and do not happen on android in window mode.   <img width="2880" height="3840" alt="Image" src="https://github.com/user-attachments/assets/7c7ac4db-c336-4ec8-bce6-a79730086445" /> <img width="2880" height="3840" alt="Image" src="https://github.com/user-attachments/assets/9d40bcf4-b5cc-4e9d-bea0-26a02dfa90f7" />  ### Reproduction steps  - you should be using the gorhom footer and have BottomSheetTextInput  - you should be on IOS and in window mode (using an Ipad for ex)  - you should make sure the window running your app is overlapping the native IOS keyboard  - when the input is focused the native keyboard opens and the footer jumps upward   ### Reproduction sample  https://snack.expo.dev/@mohamed-ghassen-elarbi/bottom-sheet---issue-reproduction-template  ### Relevant log output  ```shell  ```
  **Post-Mortem & Fix Analysis**:
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
+   
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
@@ -1613,7 +1612,7 @@ co
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

#### Recent Merged Pull Requests:
- **PR #2738** (closed): fix: keep a sheet presented when snapToPosition targets a temporary position (@KurnosovNikita)
- **PR #2735** (closed): fix: restore BottomSheetModal generic default to any (@Ge0ffreyS)
- **PR #2726** (closed): Feat/reanimated 4 support (@misaku)
- **PR #2720** (closed): fix: evaluate mount position from JS when animated reactions never fire (@icantcodefyi)
- **PR #2717** (closed): fix: prevent unbounded scroll-event recursion while scrollable is locked (@OxMarco)
- **PR #2711** (closed): fix(modal): make dismiss idempotent when modal is not presented (@janicduplessis)
- **PR #2704** (closed): fix(BottomSheetModal): don't fire onDismiss when sheet was never presented (@olivier-bouillet)
- **PR #2697** (closed): fix: use screen height as initial position on native platforms (@balintant)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
