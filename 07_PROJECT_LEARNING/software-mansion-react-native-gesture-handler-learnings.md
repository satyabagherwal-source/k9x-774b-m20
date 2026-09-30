# Forensic Learning Record (Deep Inspection): software-mansion/react-native-gesture-handler

> **Canonical Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-gesture-handler-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/software-mansion/react-native-gesture-handler](https://github.com/software-mansion/react-native-gesture-handler))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:14:41.377Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `software-mansion/react-native-gesture-handler`
- **Description**: Declarative API exposing platform native touch and gesture system to React Native.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6786 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/basic-example/babel.config.js`
```
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets/plugin'],
};

```

### Core Architecture Module: `apps/basic-example/index.js`
```
/**
 * @format
 */

import { AppRegistry } from 'react-native';

import { name as appName } from './app.json';
import App from './src/App';

AppRegistry.registerComponent(appName, () => App);

```

### Core Architecture Module: `apps/basic-example/jest.config.js`
```
module.exports = {
  preset: '@react-native/jest-preset',
};

```

### Core Architecture Module: `apps/basic-example/metro.config.js`
```
const { getDefaultConfig } = require('@react-native/metro-config');
const { mergeConfig } = require('metro-config');

const path = require('path');
const exclusionList =
  require('metro-config/private/defaults/exclusionList').default;
const escape = require('escape-string-regexp');

const modulesBlacklist = [];

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(__dirname);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

config.resolver.blacklistRE = exclusionList(
  modulesBlacklist.map(
    (m) =>
      new RegExp(`^${escape(path.join(monorepoRoot, 'node_modules', m))}\\/.*$`)
  )
);

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

```

### Core Architecture Module: `apps/basic-example/src/App.tsx`
```
import * as React from 'react';
import { Platform, SafeAreaView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import ContentsButton from './ContentsButton';
import NativeDetector from './NativeDetector';
import Navigator from './Navigator';
import RuntimeDecoration from './RuntimeDecoration';
import Text from './Text';

const EXAMPLES = [
  {
    name: 'Text',
    component: Text,
  },
  {
    name: 'Runtime Decoration',
    component: RuntimeDecoration,
  },
  {
    name: 'Native Detector',
    component: NativeDetector,
  },
  {
    name: 'Contents Button',
    component: ContentsButton,
  },
];

const Stack = Navigator.create();
Stack.setRoutes(
  Object.fromEntries(
    EXAMPLES.map((example, index) => [
      example.name.toLowerCase().replace(/\s+/g, ''),
      {
        component: example.component,
        title: example.name,
        rightButtonAction:
          index === EXAMPLES.length - 1
            ? undefined
            : () => {
                Stack.navigateTo(
                  EXAMPLES[index + 1].name.toLowerCase().replace(/\s+/g, '')
                );
              },
      },
    ])
  )
);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        style={[{ flex: 1 }, Platform.OS === 'android' && { paddingTop: 50 }]}>
        <Stack.Navigator />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

```

### Core Architecture Module: `apps/basic-example/src/ContentsButton.tsx`
```
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import {
  GestureHandlerRootView,
  RectButton,
  ScrollView,
} from 'react-native-gesture-handler';

export default function ComplexUI() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Avatars />
          <View style={styles.paddedContainer}>
            <Gallery />
            <SizeConstraints />
            <FlexboxTests />
            <PositioningTests />
            <SpacingTests />
            <VisualEffects />
            <ComplexCombinations />
            <Transforms />
          </View>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const colors = ['#782AEB', '#38ACDD', '#57B495', '#FF6259', '#FFD61E'];

function Avatars() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {colors.map((color) => (
        <RectButton
          key={color}
          style={[styles.avatars, { backgroundColor: color }]}>
          <Text style={styles.avatarLabel}>{color.slice(1, 3)}</Text>
        </RectButton>
      ))}
    </ScrollView>
  );
}

function Gallery() {
  return (
    <View style={[styles.section]}>
      <Text style={styles.sectionTitle}>Basic Gallery</Text>
      <View style={[styles.gap]}>
        <RectButton style={styles.fullWidthButton} />
        <View style={[styles.row, styles.gap]}>
          <RectButton style={styles.leftButton} />
          <RectButton style={styles.rightButton} />
        </View>
        <RectButton style={[styles.fullWidthButton, { borderRadius: 20 }]} />
      </View>
    </View>
  );
}

function SizeConstraints() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Size Constraints</Text>
      <View style={[styles.row, styles.gap]}>
        <RectButton style={styles.minMaxButton}>
          <Text style={styles.buttonText}>Min/Max</Text>
        </RectButton>
        <RectButton style={styles.aspectRatioButton}>
          <Text style={styles.buttonText}>1:1</Text>
        </RectButton>
        <RectButton style={styles.flexGrowButton}>
          <Text style={styles.buttonText}>Flex</Text>
        </RectButton>
      </View>
    </View>
  );
}

function FlexboxTests() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Flexbox Layouts</Text>
      <View style={styles.flexContainer}>
        <RectButton style={styles.flexStart}>
          <Text style={styles.buttonText}>Start</Text>
        </RectButton>
        <RectButton style={styles.flexCenter}>
          <Text style={styles.buttonText}>Center</Text>
        </RectButton>
        <RectButton style={styles.flexEnd}>
          <Text style={styles.buttonText}>End</Text>
        </RectButton>
      </View>
      <View style={styles.flexWrapContainer}>
        <RectButton style={styles.wrapItem}>
          <Text style={styles.buttonText}>Wrap 1</Text>
        </RectButton>
        <RectButton style={styles.wrapItem}>
          <Text style={styles.buttonText}>Wrap 2</Text>
        </RectButton>
        <RectButton style={styles.wrapItem}>
          <Text style={styles.buttonText}>Wrap 3</Text>
        </RectButton>
        <RectButton style={styles.wrapItem}>
          <Text style={styles.buttonText}>Wrap 4</Text>
        </RectButton>
      </View>
    </View>
  );
}

function PositioningTests() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Positioning</Text>
      <View style={styles.positionContainer}>
        <RectButton style={styles.zIndexButton}>
          <Text style={styles.buttonText}>Z-Index</Text>
        </RectButton>
        <RectButton style={styles.absoluteButton}>
          <Text style={styles.buttonText}>Absolute</Text>
        </RectButton>
        <RectButton style={styles.relativeButton}>
          <Text style={styles.buttonText}>Relative</Text>
        </RectButton>
      </View>
    </View>
  );
}

function SpacingTests() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Spacing & Overflow</Text>
      <View style={[styles.row, styles.gap]}>
        <RectButton style={styles.paddingButton}>
          <Text style={styles.buttonText}>Padding</Text>
        </RectButton>
        <RectButton style={styles.marginButton}>
          <Text style={styles.buttonText}>Margin</Text>
        </RectButton>
        <RectButton style={styles.overflowButton}>
          <Text style={styles.longText}>Overflow Hidden Test</Text>
        </RectButton>
      </View>
    </View>
  );
}

function VisualEffects() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Visual Effects</Text>
      <View style={[styles.row, styles.gap]}>
        <RectButton style={styles.shadowButton}>
          <Text style={styles.buttonText}>Shadow</Text>
        </RectButton>
        <RectButton style={styles.opacityButton}>
          <Text style={styles.buttonText}>Opacity</Text>
        </RectButton>
      </View>
    </View>
  );
}

function ComplexCombinations() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Complex Combinations</Text>
      <View style={styles.complexGrid}>
        <RectButton style={styles.complexButton1}>
          <Text style={styles.buttonText}>Complex 1</Text>
        </RectButton>
        <RectButton style={styles.complexButton2}>
          <Text style={styles.buttonText}>Complex 2</Text>
        </RectButton>
        <RectButton style={styles.complexButton3}>
          <Text style={styles.buttonText}>Complex 3</Text>
        </RectButton>
        <RectButton style={styles.complexButton4}>
          <Text style={styles.buttonText}>Complex 4</Text>
        </RectButton>
      </View>
    </View>
  );
}

function Transforms() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Transform</Text>
      <View style={styles.complexGrid}>
        <RectButton style={styles.transformButton}>
          <Text style={styles.buttonText}>Transform</Text>
        </RectButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingBottom: 50,
  },
  paddedContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  gap: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
  },

  // Avatar styles
  avatars: {
    width: 90,
    height: 90,
    borderWidth: 2,
    borderColor: '#001A72',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 30,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    color: '#F8F9FF',
    fontSize: 24,
    fontWeight: 'bold',
  },

  // Gallery styles
  fullWidthButton: {
    width: '100%',
    height: 160,
    backgroundColor: '#FF6259',
    borderTopRightRadius: 30,
    borderTopLeftRadius: 30,
    borderWidth: 1,
    borderColor: '#000',
  },
  leftButton: {
    flex: 1,
    height: 160,
    backgroundColor: '#FFD61E',
    borderBottomLeftRadius: 30,
    borderWidth: 5,
    borderColor: '#000',
  },
  rightButton: {
    flex: 1,
    backgroundColor: '#782AEB',
    height: 160,
    borderBottomRightRadius: 30,
    borderWidth: 8,
    borderColor: '#000',
  },

  // Size constraint styles
  minMaxButton: {
    minWidth: 80,
    maxWidth: 120,
    minHeight: 40,
    maxHeight: 80,
    backgroundColor: '#38ACDD',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aspectRatioButton: {
    width: 80,
    aspectRatio: 1,
    backgroundColor: '#57B495',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems
```

### Core Architecture Module: `apps/basic-example/src/NativeDetector.tsx`
```
import * as React from 'react';
import { Animated, Button, useAnimatedValue } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';

export default function App() {
  const [visible, setVisible] = React.useState(true);

  const value = useAnimatedValue(0);
  const event = Animated.event(
    [{ nativeEvent: { handlerData: { translationX: value } } }],
    {
      useNativeDriver: true,
    }
  );

  const gesture = usePanGesture({
    onUpdate: event,
  });

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: 'white', paddingTop: 8 }}>
      <Button
        title="Toggle visibility"
        onPress={() => {
          setVisible(!visible);
        }}
      />

      {visible && (
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[
              {
                width: 150,
                height: 150,
                backgroundColor: 'blue',
                opacity: 0.5,
                borderWidth: 10,
                borderColor: 'green',
                marginTop: 20,
                marginLeft: 40,
              },
              { transform: [{ translateX: value }] },
            ]}
          />
        </GestureDetector>
      )}
    </GestureHandlerRootView>
  );
}

```

### Core Architecture Module: `apps/basic-example/src/Navigator.tsx`
```
import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';

export interface RouteInfo {
  component: React.ComponentType;
  title?: string;
  rightButtonAction?: () => void;
}

export type NavigatorRoutes = Record<string, RouteInfo>;

export interface NavigatorProps {
  initialRouteName?: string;
}

export interface ButtonProps {
  title: string;
  onPress: () => void;
}

const Button = (props: ButtonProps) => {
  return (
    <Pressable
      style={{
        width: 48,
        height: 48,
        justifyContent: 'center',
      }}
      onPress={() => {
        props.onPress();
      }}>
      <Text style={{ textAlign: 'center', fontSize: 24 }}>{props.title}</Text>
    </Pressable>
  );
};

export default class Navigator {
  private routes: NavigatorRoutes = {};
  private history: string[] = [];
  private setCurrentRoute!: (route: string) => void;

  static create() {
    return new Navigator();
  }

  setRoutes(routes: NavigatorRoutes) {
    this.routes = routes;
  }

  navigateTo(route: string) {
    this.history.push(route);
    this.setCurrentRoute(route);
  }

  goBack() {
    if (this.history.length === 1) {
      throw new Error("Can't go back, no history");
    }
    this.history.pop();
    this.setCurrentRoute(this.history[this.history.length - 1]);
  }

  canGoBack() {
    return this.history.length > 1;
  }

  backHandler = () => {
    if (this.canGoBack()) {
      this.goBack();
      return true;
    }

    return false;
  };

  Navigator = (props: NavigatorProps) => {
    const [currentRoute, setCurrentRoute] = useState(
      props.initialRouteName ?? Object.keys(this.routes)[0]
    );
    this.setCurrentRoute = setCurrentRoute;

    useEffect(() => {
      // eslint-disable-next-line @eslint-react/web-api/no-leaked-event-listener
      return BackHandler.addEventListener('hardwareBackPress', this.backHandler)
        .remove;
    }, []);

    useEffect(() => {
      if (this.history.length === 0) {
        this.history.push(currentRoute);
      }
    }, [currentRoute]);

    const route = this.routes[currentRoute];
    return (
      <View style={{ flex: 1 }}>
        <View
          style={{
            height: 48,
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            borderBottomColor: '#ccc',
            borderBottomWidth: 1,
          }}>
          <Button
            title={this.canGoBack() ? '<' : ''}
            onPress={() => {
              this.canGoBack() ? this.goBack() : null;
            }}
          />

          <Text style={{ alignSelf: 'center', fontSize: 20 }}>
            {route.title ?? ''}
          </Text>
          <Button
            title={route.rightButtonAction ? '>' : ''}
            onPress={() => {
              route.rightButtonAction?.();
            }}
          />
        </View>
        <route.component />
      </View>
    );
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1246** (2021-08-15): **java.lang.ArrayIndexOutOfBoundsException**
  *Symptoms*: ## Description  11-27 09:56:06.323 E/VOS|App (31135): -----Crash Log Begin----- 11-27 09:56:06.323 E/VOS|App (31135): length=12; index=12 11-27 09:56:06.323 W/System.err(31135): java.lang.ArrayIndexOutOfBoundsException: length=12; index=12 11-27 09:56:06.323 W/System.err(31135): 	at com.swmansion.gesturehandler.GestureHandler.startTrackingPointer(GestureHandler.java:219) 11-27 09:56:06.324 W/System.err(31135): 	at com.swmansion.gesturehandler.GestureHandlerOrchestrator.recordViewHandlersForPointer(GestureHandlerOrchestrator.java:390) 11-27 09:56:06.324 W/System.err(31135): 	at com.swmansion.gesturehandler.GestureHandlerOrchestrator.traverseWithPointerEvents(GestureHandlerOrchestrator.java:466) 11-27 09:56:06.324 W/System.err(31135): 	at com.swmansion.gesturehandler.GestureHandlerOrchestrator.extractGestureHandlers(GestureHandlerOrchestrator.java:403) 11-27 09:56:06.324 W/System.err(31135): 	at com.swmansion.gesturehandler.GestureHandlerOrchestrator.onTouchEvent(GestureHandlerOrchestrator.java:97) 11-27 09:56:06.324 W/System.err(31135): 	at com.swmansion.gesturehandler.react.RNGestureHandlerRootHelper.dispatchTouchEvent(RNGestureHandlerRootHelper.java:126) 11-27 09:56:06.324 W/System.err(31135): 	at com.swmansion.gesturehandler.react.RNGestureHandlerRootView.dispatchTouchEvent(RNGestureHandlerRootView.java:63) 11-27 09:56:06.324 W/System.err(31135): 	at android.view.ViewGroup.dispatchTransformedTouchEvent(ViewGroup.java:2405) 11-27 09:56:06.324 W/System.err(31135)
  **Post-Mortem & Fix Analysis**:
  > Could you describe what device are you using and do you interact with it? Seems like you have more than 12 pointers (which is the internal limit of active pointers in gesture handler).
  > > Could you describe what device are you using and do you interact with it? Seems like you have more than 12 pointers (which is the internal limit of active pointers in gesture handler).  my device is RK3288 Android 5.1  how to get device info what you need? I can cooperate  55' screen with Infrared touch
  > I don't really need much more info about the device, was just curious how do you use it. Is it a screen intended for many people to use it simultaneously?  In the meantime, you can patch RNGH via [patch-package](https://www.npmjs.com/package/patch-package) by increasing `MAX_POINTERS_COUNT`, like in [this PR](https://github.com/software-mansion/react-native-gesture-handler/pull/1175/files).

- **Issue #1213** (2021-01-30): **Double tap don't works anymore with only one finger (now requires at least two fingers)**
  *Symptoms*: ## Description  The `TapGestureHandler` seems to have a bug with multitap.  It is now impossible to do a double tap with only one finger, it now requires two fingers to be detected.  ## Steps To Reproduce  1. Open the `multitap` demo from Example project. 2. Try to do a double tap (it won't works, considered as a single tap). 3. Try to do the second tap with a new finger (it will works and it is detected at the average position between the two fingers).  ### Expected behavior  Double tap with only one finger.   ### Actual behavior  Double tap is only possible with two fingers.  ## Snack or minimal code example  Can be reproduce in the `react-native-gesture-handler` demo :  [https://snack.expo.io/@adamgrzybowski/react-native-gesture-handler-demo](https://snack.expo.io/@adamgrzybowski/react-native-gesture-handler-demo)  
  **Post-Mortem & Fix Analysis**:
  > Does anyone have a similar problem, of a minimalist example of a working double tap gesture ?
  > I got the same problem.  I have two scrollviews nested under a pageviewer. Two scrollviews are almost identical except the image attached to the scrollview are different. I use double to enlarge the image to the location where users tap. A few days ago, it worked completely fine. While I revisited the code and do some modifications today, it completely failed.  I move back to the first step and try the simple code in the documentation. It works at first. Once I swipe to another scrollview and move back to the first scrollview, it can only detect single tap. Magically, the second scrollview works completely fine with double tap. If I restart expo client and reload the app, it seems to work at first and the same problem appears again after I swipe to other scrollviews.  I also tried a long list of scrollviews. The double tap only works on the last scrollviews.  Tried on both iphone and ipad, same problem happened.
  > A workaround can be to compare the a time threshold between 2 single taps.. but it defeats the purpose of using this library for double tap gestures.  Does anyone have similar problem or a solution ?

- **Issue #1212** (2021-11-08): **No discrimination of onHandlerStateChange in nested Pan- and PinchGestureHandler components in Android emulator**
  *Symptoms*: ## Description / Actual behaviour  On Android emulator, all onHandlerStateChange functions are called when performing either pan or pinch gestures using nested handler components. Not tested on a physical device.  ### Expected behaviour  Only onHandlerStateChange functions relevant to corresponding gestures should fire.  ## Snack or minimal code example  Both console logs fire when either panning or pinching with the below code:  ``` import React from "react"; import { PanGestureHandler, PinchGestureHandler } from "react-native-gesture-handler"; import Animated from "react-native-reanimated";   const App = () => {   const onPanHandlerStateChange = () => console.log("pan gesture state change");   const onPinchHandlerStateChange = () => console.log("pinch gesture state change");    return (     <PanGestureHandler       onHandlerStateChange={onPanHandlerStateChange}       minPointers={1}       maxPointers={1}     >       <Animated.View style={{flex: 1}}>         <PinchGestureHandler           onHandlerStateChange={onPinchHandlerStateChange}           minPointers={2}           maxPointers={2}         >           <Animated.View style={{ width: "100%", height: "100%" }} />         </PinchGestureHandler>       </Animated.View>     </PanGestureHandler>   ); }  export default App; ```  ## Package versions ``` "react": "16.13.1", "react-native": "0.63.3", "react-native-gesture-handler": "^1.8.0", "react-native-reanimated": "^1.13.1" ```
  **Post-Mortem & Fix Analysis**:
  > This is working as intended. When you place the first finger on the screen we cannot yet determine whether you will pan or pinch, so we assume it could be both and both handlers move to the `BEGAN` state where pan waits for the finger to move and the pinch waits for another finger to be placed. Then you can either move your finger activating pan gesture which will in turn cancel pinch, or you can place the second finger on the screen which will cause the pan to fail as it has `maxPointers` set to 1.

- **Issue #1210** (2021-02-13): **PlatformConstants no longer a member of NativeModules (breaks ForceTouchGestureHandler)**
  *Symptoms*: ## Description  ForceTouchGestureHandler was not working on my iPhone XS Max (claiming it was unavailable on the platform which is untrue) and after digging into it I can see that in PlatformConstants.js, `PlatformConstants` is no longer a member of react-native's `NativeModules` export. Because we're querying `PlatformConstants.forceTouchAvailable` in Gestures.js, this results in `<ForceTouchFallback />` being rendered rather than the actual gesture handler.  I wasn't easily able to see which RN version broke this, but since Gestures.js is the only file that imports PlatformConstants.js, I think we could just `import { Platform } from 'react-native'` here and query `Platform.constants.forceTouchAvailable` rather than conditionally import `NativeModules` if on RN v0.60.x, and from `Platform` if on newer RN versions. That being said, I imagine for future development it's nice to have a centralized PlatformConstants file. I just don't know how the software mansion team would approach this issue while maintaining backwards compatibility.  ### Screenshots  ## Steps To Reproduce Rather than upgrading the entire react-native-gesture-library to support the latest react-native v0.63.3, I just used the reanimated v2 playground repo. 1. `git clone https://github.com/software-mansion-labs/reanimated-2-playground` 2. npm install, pod install 3. Paste the example code below. 4. To fix, replace `import PlatformConstants from './PlatformConstants';` with `import { Platform } fr
  **Post-Mortem & Fix Analysis**:
  > Hey! I'll try to look into this. Seems like it should be fairly easy to fix 😄 
  > But if you also know how to go around it, Pull Requests are welcome, we can always correct things when the PR is open 😄 
  > @jkadamczyk thanks for the speedy response -- I've opened #1211.

- **Issue #1207** (2020-11-26): **RNGestureHandlerManager's _rootViews causes memory leak**
  *Symptoms*: ## Description  In `RNGestureHandlerManager.m`, `_rootViews` is a `NSMutableSet` which will retain the elements.  ``` NSMutableSet<UIView*> *_rootViews; ```  In fact, the element in _rootViews is `RCTRootContentView`.  When a `RCTRootView` is created, the `RCTRootContentView` will be pushed into the `_rootViews`.  In my case, `RCTBridge` is cached after remove a `RCTRootView`.  `RCTRootView` will dealloc, but `RCTRootContentView` will not dealloc.  Then I allocate a new `RCTRootView` which is inited by my cached `RCTBridge`, a new `RCTRootContentView` will be allocated and it will also be retained by `RNGestureHandlerManager`. At present, the `_rootViews` has two `RCTRootContentView` element, the old and the new.   I think that the `_rootViews` should not strong retain the element.  In my opinion, the solution is that using `NSHashTable` instead of `NSMutableSet`  ``` NSHashTable<UIView *> *_rootViews; _rootViews = [NSHashTable hashTableWithOptions:NSPointerFunctionsWeakMemory]; ```   ### Screenshots  ## Steps To Reproduce  1.  ### Expected behavior  When a `RCTRootView` is removed, during the `RCTBridge` is cached, the `RCTRootContentView` should be dealloced  ### Actual behavior  When a `RCTRootView` is removed, during the `RCTBridge` is cached, the `RCTRootContentView` did not be dealloced  ## Snack or minimal code example  <!-- Please provide a Snack ([https://snack.expo.io/](https://snack.expo.io/)) or provide a minimal code exa
  **Post-Mortem & Fix Analysis**:
  > Finally found the culprit of the memory leak, you are great
  > Hi! Thanks for the issue! Would it be possible for you to test the HashSet solution and submit a pull request? That would be a great help, but nevertheless, we will try to look into this.
  > > Hi! Thanks for the issue! > Would it be possible for you to test the HashSet solution and submit a pull request? That would be a great help, but nevertheless, we will try to look into this.  HaseSet? Do you mean NSHashTable? I will submit a PR later.

- **Issue #1178** (2022-04-20): **RectButton & TouchableOpacity (from react-native-gesture-handler) are pressable through overlay in a transparent modal**
  *Symptoms*: **Current Behavior** -  I am using a transparent modal in my application [link](https://reactnavigation.org/docs/stack-navigator/#transparent-modals). The button components from `react-native-gesture-handler` are pressable through the overlay. Working fine with the Button components from `react-native`.  **Expected Behavior**  - They should not be pressable through the overlay.  **How to reproduce**  https://snack.expo.io/@kailash23/react-navigation-v5-modal-bug  I had also filed the same issue on react-navigation [link](https://github.com/react-navigation/react-navigation/issues/8706)   **Your Environment**  | software                       | version | | ------------------------------ | ------- | | iOS or Android                 | Android | @react-navigation/native       | 5.6.1 | react-native                   | 0.62.2 | expo                           | 38.0.0 |react-native-gesture-handler | 1.6.0 | node                           | | npm or yarn                    | 
  **Post-Mortem & Fix Analysis**:
  > Can reproduce only on Android 🤖 
  > CC @jakub-gonet Maybe you recall if we had something similar it seems quite obvious and weird
  > This is still a problem with 1.9.0 version.  Looks like its a problem with most of the routing libraries, I'm using `react-router-native`  There is an old issue with similar problem:  https://github.com/software-mansion/react-native-gesture-handler/issues/514

- **Issue #1176** (2022-03-31): **It's not possible to set border radius of single corner of RectButton**
  *Symptoms*: ## Description  I want to set border radius just of top left and bottom right corners of `RectButton`. To do this, I use `borderTopLeftRadius` and `borderBottomRightRadius`, but it looks like they're ignored. Using `borderRadius` on all corners works like a charm. I am working on managed Expo project. And I develop only for Android device, so I don't know if that's an issue on iOS.  ### Screenshots These are screenshots from code you can find below. And this is how it looks like on my device. First I press button that should have only two corners rounded and both in pressed and idle state no corners are rounded. Then, I press button that has all corners rounded by using `borderRadius` and everything looks and works fine.  ![image](https://user-images.githubusercontent.com/11396814/91092641-9f290e80-e658-11ea-9b68-4bbacb73fd83.png) ![image](https://user-images.githubusercontent.com/11396814/91092681-abad6700-e658-11ea-8a7b-dc27dd44f777.png)  ## Steps To Reproduce  Tap buttons in example below  ### Expected behavior  First two buttons have rounded two corners (top left and bottom right) in idle state and, when pressed, ripple fills them correctly.  ### Actual behavior  First two buttons don't have any corners rounded.  ## Snack or minimal code example  ``` import React from 'react'; import { View } from 'react-native'; import Text from 'components/Text'; import { RectButton } from 'react-native-gesture-handler';  function App() {   return (     <
  **Post-Mortem & Fix Analysis**:
  > FYI, you can achieve this by wrapping the RectButton into a view with "overflow": "hidden" and setting the borderRadius props there. I had a lot of weird behaviors setting borderRadius directly on the RectButton.
  > See [this comment](https://github.com/software-mansion/react-native-gesture-handler/issues/477#issuecomment-680017127) in #477

- **Issue #1170** (2020-09-08): **Web link for "Getting Started" is broken**
  *Symptoms*: ## Description  "Page not found" for Getting Started link  https://docs.swmansion.com/react-native-gesture-handler/docs/next/getting-started  First found it on npm page: https://www.npmjs.com/package/react-native-gesture-handler#installation  Then by clicking on "Getting Started" on: https://docs.swmansion.com/react-native-gesture-handler/docs/next/ ![image](https://user-images.githubusercontent.com/10219697/90678762-cc944780-e267-11ea-92c1-bf517286c5ee.png)    
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, we are aware of this issue.
  > Fixed by #1185

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

### Incident Patch 1: `186eb6bf` (2026-09-16)
**Commit Message**: [iOS] Fix `manualActivation` being ignored after a config update mid-gesture (#4520)

## Description

On iOS a handler with `manualActivation: true` activates on its own if
its config is updated mid-gesture. Any re-render during the gesture
triggers that, since the config is re-sent on every render.

`setConfig:` runs `resetConfig` before `updateConfig:`, and
`resetConfig` went through the `manualActivation` setter, which removed
the `RNManualActivationRecognizer` from the view. `UIKit` cancels a
recognizer removed mid-touch, so the failure requirement it imposed on
the handler was lost and the new blocker created by `updateConfig:`
never saw the touch.

`resetConfig` now only clears the flag and the blocker is reconciled
once after the config is applied, only when its presence no longer
matches the flag. Android and web already reset values only.

## Test plan

<details>
<summary>Repro</summary>

```tsx
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector,
  GestureStateManager,
  usePanGesture,
} from 'react-native-gesture-handler';

const ACTIVATION_THRESHOLD = 20;

type Phase = 'idle' | 'began' | 'act

**File**: `packages/react-native-gesture-handler/apple/RNGestureHandler.mm` (modified, +14/-3)
```diff
@@ -116,7 +116,7 @@ - (void)resetConfig
 {
   self.enabled = YES;
   self.testID = nil;
-  self.manualActivation = NO;
+  _manualActivation = NO;
   _shouldCancelWhenOutside = NO;
   _cancelsJSResponder = YES;
   _hitSlop = RNGHHitSlopEmpty;
@@ -132,6 +132,7 @@ - (void)setConfig:(NSDictionary *)config
 {
   [self resetConfig];
   [self updateConfig:config];
+  [self syncManualActivationRecognizer];
 }
 
 - (void)updateConfig:(NSDictionary *)config
@@ -665,14 +666,24 @@ - (void)stopActivationBlocker
 - (void)setManualActivation:(BOOL)manualActivation
 {
   _manualActivation = manualActivation;
+  [self syncManualActivationRecognizer];
+}
+
+- (void)syncManualActivationRecognizer
+{
+  BOOL hasRecognizer = _manualActivationRecognizer != nil;
 
-  if (manualActivation) {
+  if (hasRecognizer == _manualActivation) {
+    return;
+  }
+
+  if (_manualActivation) {
     _manualActivationRecognizer = [[RNManualActivationRecognizer alloc] initWithGestureHandler:self];
 
     if (_recognizer.view != nil) {
       [_recognizer.view addGestureRecognizer:_manualActivationRecognizer];
     }
-  } else if (_manualActivationRecognizer != nil) {
+  } else {
     [_manualActivationRecognizer.view removeGestureRecognizer:_manualActivationRecognizer];
     _manualActivationRecognizer = nil;
   }
```

---

### Incident Patch 2: `1c8af365` (2026-09-11)
**Commit Message**: fix: stop circular GestureStateManagerType import on web (#4508)

## Description

`moduleSuffixes: [".web", ""]` makes `import type {
GestureStateManagerType } from './gestureStateManager'` in
`gestureStateManager.web.ts` resolve to this file itself. That circular
self-import left the type unresolvable (`any`), so every `on*` gesture
callback's `stateManager` parameter was untyped. Consumers (e.g.
Expensify App) then hit `@typescript-eslint/no-unsafe-call` on
`state.activate()` / `state.fail()`.

A `./gestureStateManager.ts` extension import would skip the suffix, but
this package's tsconfig does not set `allowImportingTsExtensions`, so
the type is declared locally in the web file to match the native
`GestureStateManagerType`.

Related consumer patch: https://github.com/Expensify/App/pull/99495

## Test plan

1. Type-only change — no runtime behavior change.
2. `tsc` with `moduleSuffixes: [".web", ""]` should resolve
`GestureStateManagerType` from the web file instead of collapsing it to
`any`.
3. Gesture `on*` callbacks should type `state.activate()` /
`state.fail()` / `state.begin()` / `state.end()` without
`no-unsafe-call`.

---------

Co-authored-by: Jakub Piasecki <jakub.piase

**File**: `packages/react-native-gesture-handler/src/handlers/gestures/gestureStateManager.web.ts` (modified, +12/-1)
```diff
@@ -1,6 +1,17 @@
 import { State } from '../../State';
 import NodeManager from '../../web/tools/NodeManager';
-import type { GestureStateManagerType } from './gestureStateManager';
+
+/**
+ * @deprecated `LegacyGestureStateManagerType` is deprecated and will be removed in the future. Please use the new, hook-based API instead.
+ */
+export interface GestureStateManagerType {
+  begin: () => void;
+  activate: () => void;
+  fail: () => void;
+  end: () => void;
+  /** @internal */
+  handlerTag: number;
+}
 
 export const GestureStateManager = {
   create(handlerTag: number): GestureStateManagerType {
```

**File**: `packages/react-native-gesture-handler/src/v3/gestureStateManager.ts` (modified, +1/-6)
```diff
@@ -1,11 +1,6 @@
 import { State } from '../State';
 import { tagMessage } from '../utils';
-
-export type GestureStateManagerType = {
-  activate(handlerTag: number): void;
-  fail(handlerTag: number): void;
-  deactivate(handlerTag: number): void;
-};
+import type { GestureStateManagerType } from './types/GestureStateManagerTypes';
 
 const setGestureState = (handlerTag: number, state: State) => {
   'worklet';
```

**File**: `packages/react-native-gesture-handler/src/v3/gestureStateManager.web.ts` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ import { tagMessage } from '../utils';
 import type IGestureHandler from '../web/handlers/IGestureHandler';
 import GestureHandlerOrchestrator from '../web/tools/GestureHandlerOrchestrator';
 import NodeManager from '../web/tools/NodeManager';
-import type { GestureStateManagerType } from './gestureStateManager';
+import type { GestureStateManagerType } from './types/GestureStateManagerTypes';
 
 function ensureHandlerAttached(handler: IGestureHandler) {
   if (!handler.attached) {
```

**File**: `packages/react-native-gesture-handler/src/v3/types/GestureStateManagerTypes.ts` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+export type GestureStateManagerType = {
+  activate(handlerTag: number): void;
+  fail(handlerTag: number): void;
+  deactivate(handlerTag: number): void;
+};
```

---

### Incident Patch 3: `e9ff66f5` (2026-09-08)
**Commit Message**: chore: fix typos in web GestureHandler comments (#4490)

## Description

Fixes two typos in code comments in `GestureHandler.ts` (`previuos` →
`previous`, `overriden` → `overridden`). Comment-only change, no runtime
impact.

## Test plan

Not applicable — comment-only change.

**File**: `packages/react-native-gesture-handler/src/web/handlers/GestureHandler.ts` (modified, +2/-2)
```diff
@@ -222,7 +222,7 @@ export default abstract class GestureHandler implements IGestureHandler {
   public fail(sendIfDisabled?: boolean): void {
     if (this.state === State.ACTIVE || this.state === State.BEGAN) {
       // Here the order of calling the delegate and moveToState is important.
-      // At this point we can use currentState as previuos state, because immediately after changing cursor we call moveToState method.
+      // At this point we can use currentState as previous state, because immediately after changing cursor we call moveToState method.
       this.delegate.onFail();
 
       this.moveToState(State.FAILED, sendIfDisabled);
@@ -754,7 +754,7 @@ export default abstract class GestureHandler implements IGestureHandler {
   }
 
   protected transformNativeEvent(): Record<string, unknown> {
-    // Those properties are shared by most handlers and if not this method will be overriden
+    // Those properties are shared by most handlers and if not this method will be overridden
     const lastCoords = this.tracker.getAbsoluteCoordsAverage();
     const lastRelativeCoords = this.tracker.getRelativeCoordsAverage();
 
```

---

### Incident Patch 4: `ed9410d3` (2026-08-27)
**Commit Message**: Fix ReanimatedDrawerLayout animation speed after rerender (#4470)

## Description

Fixes #4469.

`ReanimatedDrawerLayout` memoized `animateDrawer` without
`animationSpeedProp`, so changing the prop did not affect later
programmatic `openDrawer()` or `closeDrawer()` calls. The callback now
tracks the prop and the imperative methods receive the latest default
spring speed after a rerender.

## Test plan

- `yarn workspace react-native-gesture-handler test --runInBand` — 159
tests passed
- `yarn workspace react-native-gesture-handler ts-check`
- `yarn workspace react-native-gesture-handler lint-js` — no errors
(existing warnings remain)
- `yarn workspace react-native-gesture-handler build`

**File**: `packages/react-native-gesture-handler/src/components/ReanimatedDrawerLayout.tsx` (modified, +1/-0)
```diff
@@ -441,6 +441,7 @@ const DrawerLayout = function DrawerLayout(
       );
     },
     [
+      animationSpeedProp,
       openValue,
       emitStateChanged,
       isDrawerOpen,
```

---

### Incident Patch 5: `0d25288c` (2026-08-26)
**Commit Message**: [Android] Fix native handlers attaching to a nested button instead of the detector's child (#4464)

## Description

`tryFindGestureHandlerButton` was added in #3634 to find the button
inside the wrapper `View` of the `display: contents` sandwich. #4044
replaced that structure with a single-view button, so the correct target
is the detector's direct child again - but the search was left in and
still fired whenever the child's first child happened to be a bare
`ButtonViewGroup` (e.g. `Pressable` or `Touchable` as the first child of
a button or of a view under a native-gesture detector), attaching the
handler to that inner button instead.

Before this change, the outer button in the test screen did not react to
presses anywhere except over the inner pressable, and pressing the inner
pressable fired the outer handler's callbacks alongside the inner ones
(with a doubled `pressIn` on the inner pressable).

This PR removes the search so native handlers always attach to the
detector's child, with the existing exception of `RefreshControl`
unwrapping.

## Test plan

Compared builds from this branch and its base commit on the Android
emulator using the test screen below:

<details>
<summary>

**File**: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerDetectorView.kt` (modified, +0/-16)
```diff
@@ -2,8 +2,6 @@ package com.swmansion.gesturehandler.react
 
 import android.content.Context
 import android.view.View
-import android.view.ViewGroup
-import androidx.core.view.isNotEmpty
 import com.facebook.react.bridge.ReadableArray
 import com.facebook.react.uimanager.ThemedReactContext
 import com.facebook.react.uimanager.UIManagerHelper
@@ -210,9 +208,6 @@ class RNGestureHandlerDetectorView(context: Context) : ReactViewGroup(context) {
     // Note: RefreshControl is wrapped with a VirtualDetector, and native gestures for it are attached in `attachVirtualChildren`.
     val id = if (child is ReactSwipeRefreshLayout) {
       child.getChildAt(0).id
-      // TODO: figure out how to do it correctly
-    } else if (child is ViewGroup && child.isNotEmpty()) {
-      child.tryFindGestureHandlerButton()?.id ?: child.id
     } else {
       child.id
     }
@@ -272,15 +267,4 @@ class RNGestureHandlerDetectorView(context: Context) : ReactViewGroup(context) {
   }.filterNotNull()
 
   private fun ReadableArray.toIntList(): List<Int> = List(size()) { getInt(it) }
-
-  private fun ViewGroup.tryFindGestureHandlerButton(): RNGestureHandlerButtonViewManager.ButtonViewGroup? {
-    if (isNotEmpty()) {
-      val child = getChildAt(0)
-      if (child is RNGestureHandlerButtonViewManager.ButtonViewGroup) {
-        return child
-      }
-    }
-
-    return null
-  }
 }
```

---

### Incident Patch 6: `d3547acd` (2026-08-26)
**Commit Message**: [Android] Fix buttons firing press events when a scroll takes over the touch (#4441)

## Description

`Pressable` without relation props presses natively through
`ButtonViewGroup`, whose managed `NativeViewGestureHandler` is attached
with `ACTION_TYPE_NONE`. RNGH delivers touches through the orchestrator
regardless of what happens in the native dispatch, so when a native
`ScrollView` takes the gesture over, nothing stops the handler - it
reaches `STATE_END` on lift and fires a press. This shows up in three
ways:

- fling catch: the `ScrollView` intercepts `DOWN` while decelerating,
the button never sees any native event, yet `onPress` fires on lift
(#4432)
- drag: the `ScrollView` intercepts on `MOVE` when the finger starts
scrolling from a row, and `onPress` still fires on lift
([comment](https://github.com/software-mansion/react-native-gesture-handler/issues/4432#issuecomment-5315039272))
- long press while scrolling: the content moves with the finger, so the
pointer never leaves the row and the long-press timer posted on `BEGAN`
fires mid-scroll (same comment)

In all three the `ScrollView` calls
`requestDisallowInterceptTouchEvent(true)`, but the existing sweep
(`cancelAllLegac

**File**: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/GestureHandlerOrchestrator.kt` (modified, +16/-9)
```diff
@@ -365,20 +365,13 @@ class GestureHandlerOrchestrator(
     event.recycle()
   }
 
-  /**
-   * Cancels all handlers created using API v1 and v2
-   */
-  fun cancelAllLegacyHandlers() {
+  private inline fun cancelHandlersMatching(predicate: (GestureHandler) -> Boolean) {
     val handlersToProcess = obtainHandlerList()
     handlersToProcess.addAll(gestureHandlers)
 
     try {
       handlersToProcess.forEach {
-        if (it.actionType == GestureHandler.ACTION_TYPE_JS_FUNCTION_OLD_API ||
-          it.actionType == GestureHandler.ACTION_TYPE_JS_FUNCTION_NEW_API ||
-          it.actionType == GestureHandler.ACTION_TYPE_REANIMATED_WORKLET ||
-          it.actionType == GestureHandler.ACTION_TYPE_NATIVE_ANIMATED_EVENT
-        ) {
+        if (predicate(it)) {
           it.cancel()
         }
       }
@@ -389,6 +382,20 @@ class GestureHandlerOrchestrator(
     }
   }
 
+  fun cancelAllLegacyHandlers() = cancelHandlersMatching {
+    it.actionType == GestureHandler.ACTION_TYPE_JS_FUNCTION_OLD_API ||
+      it.actionType == GestureHandler.ACTION_TYPE_JS_FUNCTION_NEW_API ||
+      it.actionType == GestureHandler.ACTION_TYPE_REANIMATED_WORKLET ||
+      it.actionType == GestureHandler.ACTION_TYPE_NATIVE_ANIMATED_EVENT
+  }
+
+  /**
+   * Cancels handlers whose view opted out of surviving a native view taking over the touch stream.
+   */
+  fun cancelHandlersOnNativeTouchGrab(grabbedMidGesture: Boolean) = cancelHandlersMatching {
+    it is NativeViewGestureHandler && it.shouldCancelOnNativeTouchGrab(grabbedMidGesture)
+  }
+
   /**
    * isViewAttachedUnderWrapper checks whether all of parents for view related to handler
    * view are attached. Since there might be an issue rarely observed when view
```

**File**: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/NativeViewGestureHandler.kt` (modified, +8/-0)
```diff
@@ -241,6 +241,9 @@ class NativeViewGestureHandler : GestureHandler() {
 
   override fun wantsToAttachDirectlyToView() = true
 
+  fun shouldCancelOnNativeTouchGrab(grabbedMidGesture: Boolean): Boolean =
+    hook.shouldCancelOnNativeTouchGrab(grabbedMidGesture)
+
   data class HitSlop(
     val left: Float = HIT_SLOP_NONE,
     val top: Float = HIT_SLOP_NONE,
@@ -361,6 +364,11 @@ class NativeViewGestureHandler : GestureHandler() {
      */
     fun shouldRecognizeSimultaneously(handler: GestureHandler): Boolean? = null
 
+    /**
+     * Called after a native view grabbed the touch lock; return true to cancel the handler.
+     */
+    fun shouldCancelOnNativeTouchGrab(grabbedMidGesture: Boolean) = false
+
     /**
      * shouldActivateOnStart and tryIntercept have priority over this method
      *
```

**File**: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerButtonViewManager.kt` (modified, +19/-0)
```diff
@@ -717,6 +717,10 @@ class RNGestureHandlerButtonViewManager :
     // event).
     private var lastEventWasInside = false
 
+    // Whether the native dispatch delivered DOWN for the current gesture. False when a native
+    // ancestor intercepted it — the orchestrator still delivers events then.
+    private var receivedNativeDown = false
+
     override fun onHandlerUpdate(handler: NativeViewGestureHandler) {
       if (managedHandlerTag == null || handler.isWithinBounds == lastEventWasInside) {
         return
@@ -744,6 +748,11 @@ class RNGestureHandlerButtonViewManager :
       val localLastEventWasInside = lastEventWasInside
 
       if (newState == GestureHandler.STATE_BEGAN) {
+        // Reset here, not on gesture end: the native DOWN sets the flag even when the orchestrator
+        // never tracks the handler (disabled button, alpha below the traversal threshold), so a
+        // terminal state may never come and the stale value would survive. BEGAN precedes both the
+        // native dispatch of the same DOWN and the sweep that reads the flag.
+        receivedNativeDown = false
         dispatchJSEvent(EventType.PressIn, handler)
         longPressDetected = false
 
@@ -815,6 +824,16 @@ class RNGestureHandlerButtonViewManager :
       }
     }
 
+    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
+      if (event.actionMasked == MotionEvent.ACTION_DOWN) {
+        receivedNativeDown = true
+      }
+
+      return super.dispatchTouchEvent(event)
+    }
+
+    override fun shouldCancelOnNativeTouchGrab(grabbedMidGesture: Boolean) = grabbedMidGesture || !receivedNativeDown
+
     override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
       if (super.onInterceptTouchEvent(event)) {
         return true
```

**File**: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerRootHelper.kt` (modified, +35/-1)
```diff
@@ -22,6 +22,8 @@ class RNGestureHandlerRootHelper(private val context: ReactContext, wrappedView:
   private var shouldIntercept = false
   private var wasIntercepting = false
   private var passingTouch = false
+  private var passingNativeTouch = false
+  private var nativeTouchGrabRequested = false
 
   init {
     val registry =
@@ -116,14 +118,46 @@ class RNGestureHandlerRootHelper(private val context: ReactContext, wrappedView:
 
   fun requestDisallowInterceptTouchEvent() {
     // If this method gets called it means that some native view is attempting to grab lock for
-    // touch event delivery. In that case we cancel all gesture recognizers
+    // touch event delivery. Legacy handlers are cancelled right away; handlers opting into
+    // native-touch-grab cancellation are deferred to `onNativeDispatchEnd`.
     if (orchestrator != null && !passingTouch) {
       // if we are in the process of delivering touch events via GH orchestrator, we don't want to
       // treat it as a native gesture capturing the lock
+      if (passingNativeTouch) {
+        // Requests may also arrive outside any dispatch pass (e.g. RN's JS responder). Those have
+        // no pass to classify against and must not arm the sweep for a future gesture.
+        nativeTouchGrabRequested = true
+      }
       orchestrator.cancelAllLegacyHandlers()
     }
   }
 
+  fun onNativeDispatchStart() {
+    passingNativeTouch = true
+  }
+
+  /**
+   * Deferred handling of a disallow-intercept request recorded during this dispatch pass. The
+   * request alone doesn't say what the caller did with the event: a scrollable calls it when it
+   * takes over the touch, but e.g. a nested pager calls it already on DOWN, just to keep its
+   * ancestors from stealing a swipe it may recognize later, and the event still reaches the
+   * button - at request time both calls look identical. They only become
+   * distinguishable once the native dispatch completes (did the button receive the DOWN?), which
+   * is why cancellation runs here instead of in `requestDisallowInterceptTouchEvent`.
+   */
+  fun onNativeDispatchEnd(event: MotionEvent) {
+    passingNativeTouch = false
+
+    if (nativeTouchGrabRequested) {
+      nativeTouchGrabRequested = false
+
+      val grabbedMidGesture = event.actionMasked != MotionEvent.ACTION_DOWN &&
+        event.actionMasked != MotionEvent.ACTION_POINTER_DOWN
+
+      orchestrator?.cancelHandlersOnNativeTouchGrab(grabbedMidGesture)
+    }
+  }
+
   fun dispatchTouchEvent(event: MotionEvent): Boolean {
     // We mark `mPassingTouch` before we get into `mOrchestrator.onTouchEvent` so that we can tell
     // if `requestDisallow` has been called as a result of a normal gesture handling process or
```

**File**: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerRootView.kt` (modified, +4/-1)
```diff
@@ -62,7 +62,10 @@ class RNGestureHandlerRootView(context: Context?) : ReactViewGroup(context) {
     return if (rootViewEnabled && rootHelper!!.dispatchTouchEvent(event)) {
       true
     } else {
-      super.dispatchTouchEvent(event)
+      rootHelper?.onNativeDispatchStart()
+      val handled = super.dispatchTouchEvent(event)
+      rootHelper?.onNativeDispatchEnd(event)
+      handled
     }
   }
 
```

---

### Incident Patch 7: `8819ea62` (2026-08-26)
**Commit Message**: Fix Errors.test.tsx failing with Reanimated 4.6.0 (#4474)

## Description

Since Reanimated 4.6.0 (software-mansion/react-native-reanimated#10107),
importing `react-native-reanimated` under Jest throws during module
evaluation:

```
    [Reanimated] `setCSSEventHandler` is not available in JSReanimated.
      at initializeReanimatedModule (src/initializers.native.ts:22)
      at Object.<anonymous> (src/index.ts:11)
```

Under `Jest`, `Reanimated` selects its `JSReanimated` module (`IS_JEST`
check in `reanimatedModuleInstance.native.ts`), whose
`setCSSEventHandler` stub throws, and `initializers.native.ts` calls it
unconditionally as an import side effect. Our `reanimatedWrapper`
catches the error and silently falls back to `Reanimated = undefined`.



This PR mocks `reanimatedWrapper` in `Errors.test.tsx` (same pattern as
`runOnJSReanimatedHandlers.test.tsx`), which makes the suite independent
of whether the real Reanimated can be imported under Jest. The mock
additionally provides `useComposedEventHandler`, which
`InterceptingGestureDetector` calls.

## Test plan

- yarn test — 19/19 suites, 159/159 tests pass (Errors.test.tsx was
failing on main before this change)

**File**: `packages/react-native-gesture-handler/src/__tests__/Errors.test.tsx` (modified, +22/-0)
```diff
@@ -15,6 +15,28 @@ jest.mock('react-native-worklets', () =>
   require('react-native-worklets/src/mock')
 );
 
+// Reanimated 4.6.0 throws on import under Jest (`setCSSEventHandler` is not
+// available in JSReanimated), which reanimatedWrapper silently turns into
+// `Reanimated = undefined`. Mock the wrapper so gestures with worklet
+// callbacks still take the Reanimated detector path these tests rely on.
+//
+// TODO: Remove after fixed in Reanimated
+jest.mock('../handlers/gestures/reanimatedWrapper', () => ({
+  Reanimated: {
+    useHandler: jest.fn(() => ({
+      doDependenciesDiffer: false,
+      context: { lastUpdateEvent: undefined },
+    })),
+    useEvent: jest.fn(() => jest.fn()),
+    useComposedEventHandler: jest.fn(() => jest.fn()),
+    isSharedValue: (value: unknown): boolean =>
+      value !== null && typeof value === 'object' && 'value' in value,
+    useSharedValue: <T,>(value: T) => ({ value }),
+    setGestureState: jest.fn(),
+  },
+  Worklets: undefined,
+}));
+
 beforeEach(() => cleanup());
 jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
   findNodeHandle: jest.fn(),
```

---

### Incident Patch 8: `80cfa6f9` (2026-08-26)
**Commit Message**: [Web] Fix `delayTimeout` type `FlingGestureHandler` (#4471)

## Description

Leftover from #4381: the web handlers' timeout fields were changed to `ReturnType<typeof setTimeout>`. `FlingGestureHandler` was the one that PR missed.

## Test plan

`yarn ts-check` passes

**File**: `packages/react-native-gesture-handler/src/web/handlers/FlingGestureHandler.ts` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ export default class FlingGestureHandler extends GestureHandler {
 
   private maxDurationMs = DEFAULT_MAX_DURATION_MS;
   private minVelocity = DEFAULT_MIN_VELOCITY;
-  private delayTimeout!: number;
+  private delayTimeout: ReturnType<typeof setTimeout> | undefined;
 
   private maxNumberOfPointersSimultaneously = 0;
   private keyPointer = NaN;
```

---

### Incident Patch 9: `6f73a7e1` (2026-08-24)
**Commit Message**: Fix v3 CI path filter case and remove stale files entry (#4465)

## Description

Two small cleanups:

- The path filter in `rngh-api-v3.yml` pointed at `API_V3.test.tsx`, but
the file is `api_v3.test.tsx` and GitHub path filters are
case-sensitive, so a PR touching only the v3 test suite never triggered
the workflow. The mismatch has been there since the workflow was added
in #3838. Also lowercased the pattern in the `yarn test` step to match
the file literally (it worked before only because jest matches patterns
case-insensitively).
- Removed `android/common/src/main/java/` from `files` in `package.json`
- the directory was deleted in #3544, npm silently ignores the unmatched
entry.

## Test plan

- `npx jest --listTests RelationsTraversal api_v3` still selects both
test files.

**File**: `.github/workflows/rngh-api-v3.yml` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@ on:
     paths:
       - packages/react-native-gesture-handler/src/v3/**
       - packages/react-native-gesture-handler/src/__tests__/RelationsTraversal.test.tsx
-      - packages/react-native-gesture-handler/src/__tests__/API_V3.test.tsx
+      - packages/react-native-gesture-handler/src/__tests__/api_v3.test.tsx
   push:
     branches:
       - main
@@ -35,4 +35,4 @@ jobs:
 
       - name: Run tests
         working-directory: packages/react-native-gesture-handler
-        run: yarn test RelationsTraversal API_V3
+        run: yarn test RelationsTraversal api_v3
```

**File**: `packages/react-native-gesture-handler/package.json` (modified, +0/-1)
```diff
@@ -35,7 +35,6 @@
     "android/src/main/AndroidManifest.xml",
     "android/src/main/java/",
     "android/src/main/jni/",
-    "android/common/src/main/java/",
     "android/reanimated/src/main/java/",
     "android/noreanimated/src/main/java/",
     "android/svg",
```

---

### Incident Patch 10: `33c4f28b` (2026-08-19)
**Commit Message**: Fix dead presses in `"never"` mode when the keyboard belongs to a native field (#4439)

## Description

With a Gesture Handler `ScrollView` in the default (`never`)
`keyboardShouldPersistTaps` mode, a keyboard opened by a native field
(e.g. a native-stack `headerSearchBarOptions` search bar) made every
RNGH `Pressable`/`Touchable` inside dead, with no way to dismiss the
keyboard by tapping. The keyboard-dismissing tap drop (#992) checks only
keyboard visibility, but the dismissal blurs
`TextInput.State.currentlyFocusedInput()`, which is `null` for native
fields - the tap was consumed while nothing could be dismissed.

Now the tap is dropped only when an RN `TextInput` is focused, mirroring
RN ScrollView's `_keyboardIsDismissible`. Focus is snapshotted when the
keyboard shows, since the dismissal blurs the input at touch-down,
before the press events are checked; a live check is OR-ed in for focus
moving to an RN input while the keyboard is already up. With a
native-field keyboard, presses now behave like RN's `Pressable`: they
fire and the keyboard stays.


## Test plan

- `yarn test` — added cases: no drop when the keyboard is up without a
focused RN input; the drop verdict surviv

**File**: `packages/react-native-gesture-handler/src/__tests__/api_v3.test.tsx` (modified, +47/-1)
```diff
@@ -5,7 +5,7 @@ import {
   screen,
 } from '@testing-library/react-native';
 import { act } from 'react';
-import { Keyboard, View } from 'react-native';
+import { Keyboard, TextInput, View } from 'react-native';
 
 import GestureHandlerRootView from '../components/GestureHandlerRootView';
 import { fireGestureHandler, getByGestureTestId } from '../jestUtils';
@@ -454,8 +454,17 @@ describe('[API v3] Components', () => {
       keyboardShouldPersistTaps,
     });
 
+    // The drop requires a focused RN TextInput to blur.
+    const focusInput = () =>
+      jest
+        .spyOn(TextInput.State, 'currentlyFocusedInput')
+        .mockReturnValue(
+          {} as ReturnType<typeof TextInput.State.currentlyFocusedInput>
+        );
+
     test('isKeyboardDismissingTap is true only in never mode while the keyboard is visible', async () => {
       const addListenerSpy = jest.spyOn(Keyboard, 'addListener');
+      const focusSpy = focusInput();
 
       render(
         <GestureHandlerRootView>
@@ -477,7 +486,38 @@ describe('[API v3] Components', () => {
       // Outside an RNGH ScrollView there is no context, so nothing is dropped.
       expect(isKeyboardDismissingTap(null)).toBe(false);
 
+      // The verdict must survive the dismissal blurring the input mid-tap.
+      focusSpy.mockReturnValue(undefined);
+      expect(isKeyboardDismissingTap(makeContext('never'))).toBe(true);
+
       addListenerSpy.mockRestore();
+      focusSpy.mockRestore();
+    });
+
+    test('isKeyboardDismissingTap is false when no RN TextInput is focused (native field keyboard)', async () => {
+      const addListenerSpy = jest.spyOn(Keyboard, 'addListener');
+
+      render(
+        <GestureHandlerRootView>
+          <ScrollView keyboardShouldPersistTaps="never" />
+        </GestureHandlerRootView>
+      );
+      await act(flushImmediate);
+
+      // Keyboard up for a native field (e.g. a native-stack search bar) -
+      // no RN TextInput to blur, so the tap must not be dropped.
+      showKeyboard(addListenerSpy);
+
+      expect(TextInput.State.currentlyFocusedInput()).toBeNull();
+      expect(isKeyboardDismissingTap(makeContext('never'))).toBe(false);
+
+      // Focus moving to an RN input while the keyboard stays up makes the
+      // tap dismissible again.
+      const focusSpy = focusInput();
+      expect(isKeyboardDismissingTap(makeContext('never'))).toBe(true);
+
+      addListenerSpy.mockRestore();
+      focusSpy.mockRestore();
     });
 
     test('isKeyboardDismissingTap is false for a detached (height 0) keyboard', async () => {
@@ -500,6 +540,7 @@ describe('[API v3] Components', () => {
 
     test('Touchable does NOT fire any press callback on the keyboard-dismissing tap (never)', async () => {
       const addListenerSpy = jest.spyOn(Keyboard, 'addListener');
+      const focusSpy = focusInput();
       const onPress = jest.fn();
       const onPressIn = jest.fn();
       const onPressOut = jest.fn();
@@ -519,6 +560,10 @@ describe('[API v3] Components', () => {
       await act(flushImmediate);
       showKeyboard(addListenerSpy);
 
+      // The 'never' responder blurs the input at touch-down, before the
+      // press events arrive - mirror that ordering.
+      focusSpy.mockReturnValue(undefined);
+
       // Includes a re-entry PressIn (finger dragged out and back in) so the
       // capture-once verdict path is exercised too.
       const button = screen.getByTestId('touchable');
@@ -535,6 +580,7 @@ describe('[API v3] Components', () => {
       expect(onPressIn).not.toHaveBeenCalled();
       expect(onPressOut).not.toHaveBeenCalled();
       addListenerSpy.mockRestore();
+      focusSpy.mockRestore();
     });
 
     test('Touchable fires onPress in never mode when the keyboard is not visible', async () => {
```

**File**: `packages/react-native-gesture-handler/src/v3/scrollViewInterop.ts` (modified, +17/-1)
```diff
@@ -1,4 +1,5 @@
 import * as React from 'react';
+import { TextInput } from 'react-native';
 
 export type KeyboardShouldPersistTaps =
   | boolean
@@ -27,9 +28,15 @@ export function updateResponderEventValue(
 }
 
 let isKeyboardVisible = false;
+let keyboardOpenedForRNInput = false;
 
 export function setKeyboardVisibility(visible: boolean) {
   isKeyboardVisible = visible;
+
+  // Snapshotted at show-time: the dismissal blurs the input at touch-down,
+  // before the press events get checked
+  keyboardOpenedForRNInput =
+    visible && TextInput.State.currentlyFocusedInput?.() != null;
 }
 
 export function isKeyboardDismissingTap(
@@ -42,5 +49,14 @@ export function isKeyboardDismissingTap(
   const mode = jsResponderContext.keyboardShouldPersistTaps;
   const keyboardNeverPersistTaps = !mode || mode === 'never';
 
-  return keyboardNeverPersistTaps && isKeyboardVisible;
+  // Drop only taps that can dismiss the keyboard, i.e. an RN TextInput is (or
+  // was at show-time) focused - mirrors RN ScrollView's `_keyboardIsDismissible`.
+  // A native field's keyboard (e.g. a native-stack search bar) can't be
+  // blurred, so dropping there would leave presses permanently dead
+  return (
+    keyboardNeverPersistTaps &&
+    isKeyboardVisible &&
+    (keyboardOpenedForRNInput ||
+      TextInput.State.currentlyFocusedInput?.() != null)
+  );
 }
```

#### Recent Merged Pull Requests:
- **PR #4550** (2026-09-29): [CI] Retry failed e2e flows before failing the job (@j-piasecki)
- **PR #4548** (2026-09-30): [Android] Prevent Touchable presses when stopping ScrollView flings (@janicduplessis)
- **PR #4544** (2026-09-28): [CI] Add the Argent Cloud issue reproduction workflow (@j-piasecki)
- **PR #4543** (2026-09-28): [GitHub] Remove `Architecture` from the issue template (@j-piasecki)
- **PR #4542** (2026-09-28): [CI] Read the Node version from `.nvmrc` (@j-piasecki)
- **PR #4537** (2026-09-28): [Web] Allow `GestureStateManager.activate` from the first `onTouchesDown` (@m-bert)
- **PR #4535** (2026-09-28): [iOS] Allow `GestureStateManager.activate` from the first `onTouchesDown` (@m-bert)
- **PR #4534** (2026-09-28): [Android] Allow `GestureStateManager.activate` from the first `onTouchesDown` (@m-bert)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
