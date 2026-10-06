# Forensic Learning Record (Deep Inspection): oblador/react-native-animatable

> **Canonical Artifact**: `07_PROJECT_LEARNING/oblador-react-native-animatable-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oblador/react-native-animatable](https://github.com/oblador/react-native-animatable))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:55:30.046Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oblador/react-native-animatable`
- **Description**: Standard set of easy to use animations and declarative transitions for React Native
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9929 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  extends: ['airbnb', 'prettier'],
  plugins: ['prettier'],
  parser: '@babel/eslint-parser',
  rules: {
    'react/sort-comp': [0],
    'react/jsx-filename-extension': [1, { extensions: ['.js', '.jsx'] }],
    'react/static-property-placement': [0],
    'react/destructuring-assignment': [0],
    'react/jsx-props-no-spreading': [0],
    'import/no-extraneous-dependencies': [0],
    'import/no-unresolved': [2, { ignore: ['^react(-native)?$'] }],
    'import/extensions': [2, { js: 'never', json: 'always' }],
    'prefer-object-spread': [0],
    'default-param-last': [0],
  },
};

```

### Core Architecture Module: `Examples/AnimatableExplorer/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native',
};

```

### Core Architecture Module: `Examples/AnimatableExplorer/.prettierrc.js`
```
module.exports = {
  arrowParens: 'avoid',
  bracketSameLine: true,
  bracketSpacing: false,
  singleQuote: true,
  trailingComma: 'all',
};

```

### Core Architecture Module: `Examples/AnimatableExplorer/AnimationCell.tsx`
```
import React, {memo, useCallback, useRef} from 'react';
import {StyleSheet, Text, TouchableWithoutFeedback} from 'react-native';
import {Animation, View} from 'react-native-animatable';

const styles = StyleSheet.create({
  cell: {
    padding: 16,
    marginBottom: 10,
    marginHorizontal: 10,
  },
  name: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
});

interface AnimationCellProps {
  animationType: Animation;
  color: string;
  onPress: (view: View, animationType: Animation) => void;
  useNativeDriver: boolean;
}

export default memo(function AnimationCell({
  useNativeDriver,
  color,
  onPress,
  animationType,
}: AnimationCellProps) {
  const ref = useRef<View>(null);
  const handlePress = useCallback(() => {
    if (ref.current && onPress) {
      onPress(ref.current, animationType);
    }
  }, [ref, onPress, animationType]);

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View
        ref={ref}
        style={[{backgroundColor: color}, styles.cell]}
        useNativeDriver={useNativeDriver}>
        <Text style={styles.name}>{animationType}</Text>
      </View>
    </TouchableWithoutFeedback>
  );
});

```

### Core Architecture Module: `Examples/AnimatableExplorer/App.tsx`
```
import React, {useCallback} from 'react';
import {
  SafeAreaView,
  SectionList,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import {View, Text, Animation} from 'react-native-animatable';
import Slider from '@react-native-community/slider';
import AnimationCell from './AnimationCell';
import {animationTypes} from './groupedAnimationTypes';

const COLORS = [
  '#65b237', // green
  '#346ca5', // blue
  '#a0a0a0', // light grey
  '#ffc508', // yellow
  '#217983', // cobolt
  '#435056', // grey
  '#b23751', // red
  '#333333', // dark
  '#ff6821', // orange
  '#e3a09e', // pink
  '#1abc9c', // turquoise
  '#302614', // brown
];

const NATIVE_INCOMPATIBLE_ANIMATIONS = [
  'jello',
  'lightSpeedIn',
  'lightSpeedOut',
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FCFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '300',
    textAlign: 'center',
    margin: 20,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  slider: {
    height: 30,
    margin: 10,
  },
  toggle: {
    width: 120,
    backgroundColor: '#333',
    borderRadius: 3,
    padding: 5,
    fontSize: 14,
    alignSelf: 'center',
    textAlign: 'center',
    margin: 10,
    color: 'rgba(255, 255, 255, 1)',
  },
  toggledOn: {
    color: 'rgba(255, 33, 33, 1)',
    fontSize: 16,
    transform: [
      {
        rotate: '8deg',
      },
      {
        translateY: -20,
      },
    ],
  },
  sectionHeader: {
    backgroundColor: '#F5FCFF',
    padding: 15,
  },
  sectionHeaderText: {
    textAlign: 'center',
    fontSize: 18,
  },
});

export default function App() {
  const [duration, setDuration] = React.useState(1000);
  const [toggledOn, setToggledOn] = React.useState(false);
  const textRef = React.useRef<Text>(null);

  const handleRowPressed = useCallback(
    (componentRef: typeof View, animationType: Animation) => {
      componentRef.animate(animationType, duration);
      textRef.current?.animate(animationType, duration);
    },
    [duration],
  );

  return (
    <View animation="fadeIn" style={styles.container} useNativeDriver>
      <SafeAreaView>
        <Text ref={textRef} style={styles.title}>
          Animatable Explorer
        </Text>
      </SafeAreaView>

      <View animation="tada" delay={3000}>
        <Slider
          style={styles.slider}
          value={1000}
          onSlidingComplete={value => setDuration(Math.round(value))}
          maximumValue={2000}
        />
      </View>
      <TouchableWithoutFeedback onPress={() => setToggledOn(prev => !prev)}>
        <Text
          style={[styles.toggle, toggledOn && styles.toggledOn]}
          transition={['color', 'rotate', 'fontSize']}>
          Toggle me!
        </Text>
      </TouchableWithoutFeedback>
      <Text animation="zoomInDown" delay={700} style={styles.instructions}>
        Tap one of the following to animate for {duration} ms
      </Text>
      <View
        animation="bounceInUp"
        duration={1100}
        delay={1400}
        style={styles.container}>
        <SectionList
          contentInsetAdjustmentBehavior="automatic"
          keyExtractor={item => item}
          sections={animationTypes}
          removeClippedSubviews={false}
          renderSectionHeader={({section}) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          renderItem={({item, index}) => (
            <AnimationCell
              animationType={item}
              color={COLORS[index % COLORS.length]}
              onPress={handleRowPressed}
              useNativeDriver={
                NATIVE_INCOMPATIBLE_ANIMATIONS.indexOf(item) === -1
              }
            />
          )}
        />
      </View>
    </View>
  );
}

```

### Core Architecture Module: `Examples/AnimatableExplorer/babel.config.js`
```
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
};

```

### Core Architecture Module: `Examples/AnimatableExplorer/groupedAnimationTypes.ts`
```
import {Animation} from 'react-native-animatable';

interface GroupedAnimationType {
  title: string;
  data: Animation[];
}
export const animationTypes: GroupedAnimationType[] = [
  {
    title: 'Attention Seekers',
    data: [
      'bounce',
      'flash',
      'jello',
      'pulse',
      'rotate',
      'rubberBand',
      'shake',
      'swing',
      'tada',
      'wobble',
    ],
  },
  {
    title: 'Bouncing Entrances',
    data: [
      'bounceIn',
      'bounceInDown',
      'bounceInUp',
      'bounceInLeft',
      'bounceInRight',
    ],
  },
  {
    title: 'Bouncing Exits',
    data: [
      'bounceOut',
      'bounceOutDown',
      'bounceOutUp',
      'bounceOutLeft',
      'bounceOutRight',
    ],
  },
  {
    title: 'Fading Entrances',
    data: [
      'fadeIn',
      'fadeInDown',
      'fadeInDownBig',
      'fadeInUp',
      'fadeInUpBig',
      'fadeInLeft',
      'fadeInLeftBig',
      'fadeInRight',
      'fadeInRightBig',
    ],
  },
  {
    title: 'Fading Exits',
    data: [
      'fadeOut',
      'fadeOutDown',
      'fadeOutDownBig',
      'fadeOutUp',
      'fadeOutUpBig',
      'fadeOutLeft',
      'fadeOutLeftBig',
      'fadeOutRight',
      'fadeOutRightBig',
    ],
  },
  {
    title: 'Flippers',
    data: ['flipInX', 'flipInY', 'flipOutX', 'flipOutY'],
  },
  {
    title: 'Lightspeed',
    data: ['lightSpeedIn', 'lightSpeedOut'],
  },
  {
    title: 'Sliding Entrances',
    data: ['slideInDown', 'slideInUp', 'slideInLeft', 'slideInRight'],
  },
  {
    title: 'Sliding Exits',
    data: ['slideOutDown', 'slideOutUp', 'slideOutLeft', 'slideOutRight'],
  },
  {
    title: 'Zooming Entrances',
    data: ['zoomIn', 'zoomInDown', 'zoomInUp', 'zoomInLeft', 'zoomInRight'],
  },
  {
    title: 'Zooming Exits',
    data: [
      'zoomOut',
      'zoomOutDown',
      'zoomOutUp',
      'zoomOutLeft',
      'zoomOutRight',
    ],
  },
];

```

### Core Architecture Module: `Examples/AnimatableExplorer/index.js`
```
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

```

### Core Architecture Module: `Examples/AnimatableExplorer/ios/AnimatableExplorer/AppDelegate.h`
```
#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>

@interface AppDelegate : RCTAppDelegate

@end

```

### Core Architecture Module: `Examples/AnimatableExplorer/jest.config.js`
```
module.exports = {
  preset: 'react-native',
};

```

### Core Architecture Module: `Examples/AnimatableExplorer/metro.config.js`
```
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

```

### Core Architecture Module: `Examples/MakeItRain/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native',
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #410** (2024-07-16): **React Native TabView "Cannot read property 'setPage' of undefined" error on Android**
  *Symptoms*: .

- **Issue #408** (2024-02-28): **Slide down and push other elements**
  *Symptoms*: I have a flat list and a button to create a new item for that FlatList.  When I click it, I want the flat list to slide down and the new item to fade in.  I have this above the flat list:  ``` <Animatable.View           animation={newSheet ? "fadeIn" : "fadeOut"}           style={{ width: "100%" }}         >           {renderNewItem()} </Animatable.View> ```  which works to fade the new text input in and out, but it leaves a large blank spot at the top of the list.  How can I first get the list to slide down and then fade in when the button is clicked?  You can see the large blank spot at the top in this image:  ![simulator_screenshot_536AC519-2E0D-46A8-A03F-2E82D560C79E](https://github.com/oblador/react-native-animatable/assets/78850/c5b92b7e-59ea-4049-9771-1a4bd6566b8a) 
  **Post-Mortem & Fix Analysis**:
  > Figured it out.  There was an element with a defined height inside the Animated View.  Removed that and setup a custom animation to change the height and all good.

- **Issue #406** (2023-10-26): **Configure Github actions for tests and deployment**
  *Symptoms*: 

- **Issue #405** (2023-10-26): **Bump dependencies and examples to React Native 0.72**
  *Symptoms*: Also fixes some TS issues.

- **Issue #400** (2023-05-17): **Drop usage of deprecated React TypeScript types**
  *Symptoms*: `StatelessComponent` is deprecated in favor of `FunctionComponent` and was removed in `@types/react@18.0.0`

- **Issue #397** (2022-09-13): **Cannot read property 'flushOperations' of null, js engine: hermes**
  *Symptoms*:  Using the latest version with React Native. This error happens when adding the 'react-native-gesture-handler' import  Has anyone managed to fix it?

- **Issue #395** (2023-10-26): **Bump plist from 3.0.1 to 3.0.4 in /Examples/AnimatableExplorer**
  *Symptoms*: Bumps [plist](https://github.com/TooTallNate/node-plist) from 3.0.1 to 3.0.4. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/TooTallNate/plist.js/blob/master/History.md">plist's changelog</a>.</em></p> <blockquote> <h1>3.0.4 / 2021-08-27</h1> <ul> <li>inline xmldom@0.6.0 to eliminate security warning false positive (Mike Reinstein)</li> </ul> <h1>3.0.3 / 2021-08-04</h1> <ul> <li>update xmldom to 0.6.0 to patch critical vulnerability (Mike Reinstein)</li> <li>remove flaky saucelabs teseting badge (Mike Reinstein)</li> </ul> <h1>3.0.2 / 2021-03-25</h1> <ul> <li>update xmldom to 0.5.0 to patch critical vulnerability (Mike Reinstein)</li> <li>update saucelab credentials to point at mreinstein's saucelabs account (Mike Reinstein)</li> <li>remove a bunch of test versions from the matrix because they weren't working in zuul + sauce (Mike Reinstein)</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li>See full diff in <a href="https://github.com/TooTallNate/node-plist/commits">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=plist&package-manager=npm_and_yarn&previous-version=3.0.1&new-version=3.0.4)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  You can trigger a rebase of this PR by commenting `@dependabot rebase`. 
  **Post-Mortem & Fix Analysis**:
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #394** (2023-10-26): **Bump plist from 3.0.1 to 3.0.4**
  *Symptoms*: Bumps [plist](https://github.com/TooTallNate/node-plist) from 3.0.1 to 3.0.4. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/TooTallNate/plist.js/blob/master/History.md">plist's changelog</a>.</em></p> <blockquote> <h1>3.0.4 / 2021-08-27</h1> <ul> <li>inline xmldom@0.6.0 to eliminate security warning false positive (Mike Reinstein)</li> </ul> <h1>3.0.3 / 2021-08-04</h1> <ul> <li>update xmldom to 0.6.0 to patch critical vulnerability (Mike Reinstein)</li> <li>remove flaky saucelabs teseting badge (Mike Reinstein)</li> </ul> <h1>3.0.2 / 2021-03-25</h1> <ul> <li>update xmldom to 0.5.0 to patch critical vulnerability (Mike Reinstein)</li> <li>update saucelab credentials to point at mreinstein's saucelabs account (Mike Reinstein)</li> <li>remove a bunch of test versions from the matrix because they weren't working in zuul + sauce (Mike Reinstein)</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li>See full diff in <a href="https://github.com/TooTallNate/node-plist/commits">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=plist&package-manager=npm_and_yarn&previous-version=3.0.1&new-version=3.0.4)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  You can trigger a rebase of this PR by commenting `@dependabot rebase`. 
  **Post-Mortem & Fix Analysis**:
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

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

### Incident Patch 1: `ccafe141` (2021-04-30)
**Commit Message**: fix: typing (#301)

**File**: `typings/react-native-animatable.d.ts` (modified, +7/-1)
```diff
@@ -10,7 +10,8 @@ import {
 import {
     StatelessComponent,
     ComponentClass,
-    ClassicComponentClass
+    ClassicComponentClass,
+    Component
 } from 'react';
 
 export type EasingFunction ={(t: number) :number};
@@ -139,8 +140,13 @@ type AnimatableAnimationMethods =
 interface AnimatableComponent<P extends {}, S extends {}> extends
     NativeMethodsMixin,
     AnimatableAnimationMethods,
+    Component,
     ClassicComponentClass<AnimatableProperties<S> & P> {
 
+    refs: {
+        [key: string]: Component<P, S>
+    }
+
     stopAnimation(): void;
 
     transition<T extends S>(
```

---

### Incident Patch 2: `2a5f8732` (2019-08-20)
**Commit Message**: Fix typing of AnimatableProperties.animation (#256)

* Fix typing of AnimatableProperties.animation

* Add custom animation usage examples in Readme

**File**: `README.md` (modified, +6/-0)
```diff
@@ -149,6 +149,9 @@ const fadeIn = {
   },
 };
 ```
+```html
+<Animatable.Text animation={fadeIn} >Fade me in</Animatable.Text>
+```
 
 Combining multiple styles to create a zoom out animation: 
 
@@ -168,6 +171,9 @@ const zoomOut = {
   },
 };
 ```
+```html
+<Animatable.Text animation={zoomOut} >Zoom me out</Animatable.Text>
+```
 
 To make your animations globally available by referring to them by a name, you can register them with `initializeRegistryWithDefinitions`. This function can also be used to replace built in animations in case you want to tweak some value. 
 
```

**File**: `typings/react-native-animatable.d.ts` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ export type Animation =
     'zoomOutRight';
 
 interface AnimatableProperties<S extends {}> {
-    animation?: Animation | string;
+    animation?: Animation | string | CustomAnimation;
     duration?: number;
     delay?: number;
     direction?: 'normal' | 'reverse' | 'alternate'| 'alternate-reverse';
```

---

### Incident Patch 3: `386dd3f2` (2018-05-31)
**Commit Message**: Fix bug where old onAnimationEnd handler would be called

**File**: `createAnimatableComponent.js` (modified, +12/-5)
```diff
@@ -301,13 +301,14 @@ export default function createAnimatableComponent(WrappedComponent) {
         duration,
         delay,
         onAnimationBegin,
-        onAnimationEnd,
         iterationDelay,
       } = this.props;
       if (animation) {
         const startAnimation = () => {
           onAnimationBegin();
-          this.startAnimation(duration, 0, iterationDelay, onAnimationEnd);
+          this.startAnimation(duration, 0, iterationDelay, endState =>
+            this.props.onAnimationEnd(endState),
+          );
           this.delayTimer = null;
         };
         if (delay) {
@@ -326,7 +327,6 @@ export default function createAnimatableComponent(WrappedComponent) {
         easing,
         transition,
         onAnimationBegin,
-        onAnimationEnd,
       } = props;
 
       if (transition) {
@@ -338,7 +338,9 @@ export default function createAnimatableComponent(WrappedComponent) {
             this.setAnimation(animation);
           } else {
             onAnimationBegin();
-            this.animate(animation, duration).then(onAnimationEnd);
+            this.animate(animation, duration).then(endState =>
+              this.props.onAnimationEnd(endState),
+            );
           }
         } else {
           this.stopAnimation();
@@ -417,7 +419,12 @@ export default function createAnimatableComponent(WrappedComponent) {
           this.props.animation &&
           (iterationCount === 'infinite' || currentIteration < iterationCount)
         ) {
-          this.startAnimation(duration, currentIteration, iterationDelay, callback);
+          this.startAnimation(
+            duration,
+            currentIteration,
+            iterationDelay,
+            callback,
+          );
         } else if (callback) {
           callback(endState);
         }
```

---

### Incident Patch 4: `40d7a117` (2018-05-31)
**Commit Message**: Bump jest and fix linting configuration

**File**: `.eslintrc` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@
   ],
   "parser": "babel-eslint",
   "rules": {
+    "react/sort-comp": [0],
     "react/jsx-filename-extension": [1, { "extensions": [".js", ".jsx"] }],
     "import/no-extraneous-dependencies": [0],
     "import/no-unresolved": [2, { ignore: ['^react(-native)?$'] }],
```

**File**: `package.json` (modified, +9/-12)
```diff
@@ -41,29 +41,26 @@
   },
   "license": "MIT",
   "jest": {
-    "preset": "jest-react-native",
-    "modulePathIgnorePatterns": [
-      "<rootDir>/Example/"
-    ]
+    "preset": "react-native",
+    "modulePathIgnorePatterns": ["<rootDir>/Examples/"],
+    "testPathIgnorePatterns": ["<rootDir>/Examples/"]
   },
   "devDependencies": {
-    "babel": "^6.5.2",
     "babel-eslint": "^7.0.0",
-    "babel-jest": "^20.0.3",
-    "babel-preset-react-native": "^1.9.0",
+    "babel-jest": "23.0.1",
+    "babel-preset-react-native": "4.0.0",
     "eslint": "^3.7.1",
     "eslint-config-airbnb": "^15.0.1",
     "eslint-config-prettier": "^2.9.0",
     "eslint-plugin-import": "^2.3.0",
     "eslint-plugin-jsx-a11y": "^5.0.3",
     "eslint-plugin-prettier": "^2.6.0",
     "eslint-plugin-react": "^7.0.1",
-    "jest": "20.0.4",
-    "jest-cli": "20.0.4",
-    "jest-react-native": "18.0.0",
+    "jest": "23.1.0",
+    "jest-cli": "23.1.0",
     "prettier": "^1.13.3",
-    "react": "*",
-    "react-native": "*",
+    "react": "16.3.1",
+    "react-native": "0.55.4",
     "react-test-renderer": "15.5.4"
   },
   "dependencies": {
```

**File**: `yarn.lock` (modified, +515/-421)
```diff
@@ -2,7 +2,7 @@
 # yarn lockfile v1
 
 
-"@babel/code-frame@7.0.0-beta.49":
+"@babel/code-frame@7.0.0-beta.49", "@babel/code-frame@^7.0.0-beta.35":
   version "7.0.0-beta.49"
   resolved "https://registry.yarnpkg.com/@babel/code-frame/-/code-frame-7.0.0-beta.49.tgz#becd805482734440c9d137e46d77340e64d7f51b"
   dependencies:
@@ -434,7 +434,7 @@
     lodash "^4.17.5"
     to-fast-properties "^2.0.0"
 
-abab@^1.0.3:
+abab@^1.0.4:
   version "1.0.4"
   resolved "https://registry.yarnpkg.com/abab/-/abab-1.0.4.tgz#5faad9c2c07f60dd76770f71cf025b62a63cfd4e"
 
@@ -453,11 +453,11 @@ accepts@~1.3.3, accepts@~1.3.4:
     mime-types "~2.1.18"
     negotiator "0.6.1"
 
-acorn-globals@^3.1.0:
-  version "3.1.0"
-  resolved "https://registry.yarnpkg.com/acorn-globals/-/acorn-globals-3.1.0.tgz#fd8270f71fbb4996b004fa880ee5d46573a731bf"
+acorn-globals@^4.1.0:
+  version "4.1.0"
+  resolved "https://registry.yarnpkg.com/acorn-globals/-/acorn-globals-4.1.0.tgz#ab716025dbe17c54d3ef81d32ece2b2d99fe2538"
   dependencies:
-    acorn "^4.0.4"
+    acorn "^5.0.0"
 
 acorn-jsx@^3.0.0:
   version "3.0.1"
@@ -469,11 +469,7 @@ acorn@^3.0.4:
   version "3.3.0"
   resolved "https://registry.yarnpkg.com/acorn/-/acorn-3.3.0.tgz#45e37fb39e8da3f25baee3ff5369e2bb5f22017a"
 
-acorn@^4.0.4:
-  version "4.0.13"
-  resolved "https://registry.yarnpkg.com/acorn/-/acorn-4.0.13.tgz#105495ae5361d697bd195c825192e1ad7f253787"
-
-acorn@^5.5.0:
+acorn@^5.0.0, acorn@^5.3.0, acorn@^5.5.0:
   version "5.6.0"
   resolved "https://registry.yarnpkg.com/acorn/-/acorn-5.6.0.tgz#572bedb377a1c61b7a289e72b8c5cfeb7baaf0bf"
 
@@ -521,7 +517,7 @@ ansi-cyan@^0.1.1:
   dependencies:
     ansi-wrap "0.1.0"
 
-ansi-escapes@^1.1.0, ansi-escapes@^1.4.0:
+ansi-escapes@^1.1.0:
   version "1.4.0"
   resolved "https://registry.yarnpkg.com/ansi-escapes/-/ansi-escapes-1.4.0.tgz#d3a8a83b319aa67793662b13e761c7911422306e"
 
@@ -541,7 +537,7 @@ ansi-red@^0.1.1:
   dependencies:
     ansi-wrap "0.1.0"
 
-ansi-regex@^2.0.0, ansi-regex@^2.1.1:
+ansi-regex@^2.0.0:
   version "2.1.1"
   resolved "https://registry.yarnpkg.com/ansi-regex/-/ansi-regex-2.1.1.tgz#c3b33ab5ee360d86e0e628f0468ae7ef27d654df"
 
@@ -553,7 +549,7 @@ ansi-styles@^2.2.1:
   version "2.2.1"
   resolved "https://registry.yarnpkg.com/ansi-styles/-/ansi-styles-2.2.1.tgz#b432dd3358b634cf75e1e4664368240533c1ddbe"
 
-ansi-styles@^3.0.0, ansi-styles@^3.2.1:
+ansi-styles@^3.2.0, ansi-styles@^3.2.1:
   version "3.2.1"
   resolved "https://registry.yarnpkg.com/ansi-styles/-/ansi-styles-3.2.1.tgz#41fbb20243e50b12be0f04b8dedbf07520ce841d"
   dependencies:
@@ -567,13 +563,6 @@ ansi@^0.3.0, ansi@~0.3.1:
   version "0.3.1"
   resolved "https://registry.yarnpkg.com/ansi/-/ansi-0.3.1.tgz#0c42d4fb17160d5a9af1e484bace1c66922c1b21"
 
-anymatch@^1.3.0:
-  version "1.3.2"
-  resolved "https://registry.yarnpkg.com/anymatch/-/anymatch-1.3.2.tgz#553dcb8f91e3c889845dfdba34c77721b90b9d7a"
-  dependencies:
-    micromatch "^2.1.5"
-    normalize-path "^2.0.0"
-
 anymatch@^2.0.0:
   version "2.0.0"
   resolved "https://registry.yarnpkg.com/anymatch/-/anymatch-2.0.0.tgz#bcb24b4f37934d9aa7ac17b4adaf89e7c76ef2eb"
@@ -717,6 +706,14 @@ ast-types-flow@0.0.7:
   version "0.0.7"
   resolved "https://registry.yarnpkg.com/ast-types-flow/-/ast-types-flow-0.0.7.tgz#f70b735c6bca1a5c9c22d982c3e39e7feba3bdad"
 
+astral-regex@^1.0.0:
+  version "1.0.0"
+  resolved "https://registry.yarnpkg.com/astral-regex/-/astral-regex-1.0.0.tgz#6c8c3fb827dd43ee3918f27b82782ab7658a6fd9"
+
+async-limiter@~1.0.0:
+  version "1.0.0"
+  resolved "https://registry.yarnpkg.com/async-limiter/-/async-limiter-1.0.0.tgz#78faed8c3d074ab81f22b4e985d79e8738f720f8"
+
 async@^1.4.0:
   version "1.5.2"
   resolved "https://registry.yarnpkg.com/async/-/async-1.5.2.tgz#ec6a61ae56480c0c3cb241c95618e20892f9672a"
@@ -912,13 +909,12 @@ babel-helpers@^6.24.1:
     babel-runtime "^6.22.0"
     babel-template "^6.24.1"
 
-babel-jest@^20.0.3:
-  version "20.0.3"
-  resolved "https://registry.yarnpkg.com/babel-jest/-/babel-jest-20.0.3.tgz#e4a03b13dc10389e140fc645d09ffc4ced301671"
+babel-jest@23.0.1, babel-jest@^23.0.1:
+  version "23.0.1"
+  resolved "https://registry.yarnpkg.com/babel-jest/-/babel-jest-23.0.1.tgz#bbad3bf523fb202da05ed0a6540b48c84eed13a6"
   dependencies:
-    babel-core "^6.0.0"
-    babel-plugin-istanbul "^4.0.0"
-    babel-preset-jest "^20.0.3"
+    babel-plugin-istanbul "^4.1.6"
+    babel-preset-jest "^23.0.1"
 
 babel-messages@^6.23.0:
   version "6.23.0"
@@ -938,7 +934,7 @@ babel-plugin-external-helpers@^6.22.0:
   dependencies:
     babel-runtime "^6.22.0"
 
-babel-plugin-istanbul@^4.0.0:
+babel-plugin-istanbul@^4.1.6:
   version "4.1.6"
   resolved "https://registry.yarnpkg.com/babel-plugin-istanbul/-/babel-plugin-istanbul-4.1.6.tgz#36c59b2192efce81c5b378321b74175add1c9a45"
   dependencies:
@@ -947,15 +943,9 @@ babel-plugin-istanbul@^4.0.0:
     istanbul-lib-instrument "^1.10.1"
     test-exclude "^4.2.1"
 
-babel-plugin-jest-hoist@^20.0.3:
-  version "20.0.3"
-  resolved "https://re
```

---

### Incident Patch 5: `4076b872` (2018-05-31)
**Commit Message**: Fix transition typings (#190)

Allows assigning multiple transition prooperties now. `keyof S[]`
is the keys of an array of the generic property which is `length`,
etc.

**File**: `typings/react-native-animatable.d.ts` (modified, +1/-1)
```diff
@@ -117,7 +117,7 @@ interface AnimatableProperties<S extends {}> {
     direction?: 'normal' | 'reverse' | 'alternate'| 'alternate-reverse';
     easing?: Easing;
     iterationCount?: number | 'infinite';
-    transition?: keyof S | keyof S[];
+    transition?: keyof S | Array<keyof S>;
     useNativeDriver?: boolean;
     onAnimationBegin?: Function;
     onAnimationEnd?: Function;
```

---

### Incident Patch 6: `707486ff` (2017-10-29)
**Commit Message**: Fix code example typo in README (#158)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ import * as Animatable from 'react-native-animatable';
 class ExampleView extends Component {
   render() {
     return (
-      <TouchableWithoutFeedback onPress={() => this.refs.view.bounce(800).then((endState) => console.log(endState.finished ? 'bounce finished' : 'bounce cancelled');}>
+      <TouchableWithoutFeedback onPress={() => this.refs.view.bounce(800).then((endState) => console.log(endState.finished ? 'bounce finished' : 'bounce cancelled'));}>
         <Animatable.View ref="view">
           <Text>Bounce me!</Text>
         </Animatable.View>
```

---

### Incident Patch 7: `0f209ad5` (2017-09-18)
**Commit Message**: Fixed typos and errors in TypeScript definition (#153)

* fix(Types): fixed typos & TS errors

* fix(Types): direction was written as 'directin'

**File**: `typings/react-native-animatable.d.ts` (modified, +4/-4)
```diff
@@ -15,7 +15,7 @@ import {
 
 type EasingFunction ={(t: number) :number};
 type Easing =
-    'inear' |
+    'linear' |
     'ease' |
     'ease-in' |
     'ease-out' |
@@ -114,7 +114,7 @@ interface AnimatableProperties<S extends {}> {
     animation?: Animation | string;
     duration?: number;
     delay?: number;
-    directin?: 'normal' | 'reverse' | 'alternate'| 'alternate-reverse';
+    direction?: 'normal' | 'reverse' | 'alternate'| 'alternate-reverse';
     easing?: Easing;
     iterationCount?: number | 'infinite';
     transition?: keyof S | keyof S[];
@@ -138,13 +138,13 @@ interface AnimatableComponent<P extends {}, S extends {}> extends
         toValues: T,
         duration?: number,
         easing?: Easing
-    );
+    ): void;
 
     transitionTo<T extends S>(
         toValues: T,
         duration?: number,
         easing?: Easing
-    );
+    ): void;
 }
 
 interface CustomAnimation<T = TextStyle & ViewStyle & ImageStyle> {
```

---

### Incident Patch 8: `5e21dcea` (2017-06-11)
**Commit Message**: Cap negative width/height values to 0 to avoid yoga layout bug #122

**File**: `createAnimatableComponent.js` (modified, +17/-1)
```diff
@@ -32,6 +32,8 @@ const INTERPOLATION_STYLE_PROPERTIES = [
   'tintColor',
 ];
 
+const ZERO_CLAMPED_STYLE_PROPERTIES = ['width', 'height'];
+
 // Create a copy of `source` without `keys`
 function omit(keys, source) {
   const filtered = {};
@@ -424,9 +426,10 @@ export default function createAnimatableComponent(WrappedComponent) {
         if (!transitionValue) {
           transitionValue = new Animated.Value(0);
         }
-        transitionStyle[property] = transitionValue;
         const needsInterpolation =
           INTERPOLATION_STYLE_PROPERTIES.indexOf(property) !== -1;
+        const needsZeroClamping =
+          ZERO_CLAMPED_STYLE_PROPERTIES.indexOf(property) !== -1;
         if (needsInterpolation) {
           transitionValue.setValue(0);
           transitionStyle[property] = transitionValue.interpolate({
@@ -436,6 +439,16 @@ export default function createAnimatableComponent(WrappedComponent) {
           currentTransitionValues[property] = toValue;
           toValuesFlat[property] = 1;
         } else {
+          if (needsZeroClamping) {
+            transitionStyle[property] = transitionValue.interpolate({
+              inputRange: [0, 1],
+              outputRange: [0, 1],
+              extrapolateLeft: 'clamp',
+            });
+            currentTransitionValues[property] = toValue;
+          } else {
+            transitionStyle[property] = transitionValue;
+          }
           transitionValue.setValue(fromValue);
         }
       });
@@ -464,10 +477,13 @@ export default function createAnimatableComponent(WrappedComponent) {
         const toValue = toValuesFlat[property];
         const needsInterpolation =
           INTERPOLATION_STYLE_PROPERTIES.indexOf(property) !== -1;
+        const needsZeroClamping =
+          ZERO_CLAMPED_STYLE_PROPERTIES.indexOf(property) !== -1;
         const transitionStyle = this.state.transitionStyle[property];
         const transitionValue = this.state.transitionValues[property];
         if (
           !needsInterpolation &&
+          !needsZeroClamping &&
           transitionStyle &&
           transitionStyle === transitionValue
         ) {
```

---

### Incident Patch 9: `05203af7` (2017-06-03)
**Commit Message**: Bump test/lint tools/style guides and fix new warnings

**File**: `createAnimatableComponent.js` (modified, +21/-13)
```diff
@@ -97,7 +97,7 @@ function transitionToValue(
   duration,
   easing,
   useNativeDriver = false,
-  delay
+  delay,
 ) {
   if (duration || easing || delay) {
     Animated.timing(transitionValue, {
@@ -142,7 +142,7 @@ export default function createAnimatableComponent(WrappedComponent) {
         const val = props[propName];
         if (val !== 'infinite' && !(typeof val === 'number' && val >= 1)) {
           return new Error(
-            'iterationCount must be a positive number or "infinite"'
+            'iterationCount must be a positive number or "infinite"',
           );
         }
         return null;
@@ -162,26 +162,32 @@ export default function createAnimatableComponent(WrappedComponent) {
     };
 
     static defaultProps = {
+      animation: undefined,
       delay: 0,
+      direction: 'normal',
+      duration: undefined,
+      easing: undefined,
       iterationCount: 1,
       onAnimationBegin() {},
       onAnimationEnd() {},
+      style: undefined,
+      transition: undefined,
       useNativeDriver: false,
     };
 
     constructor(props) {
       super(props);
 
       const animationValue = new Animated.Value(
-        getAnimationOrigin(0, this.props.direction)
+        getAnimationOrigin(0, this.props.direction),
       );
       let animationStyle = {};
       let compiledAnimation = {};
       if (props.animation) {
         compiledAnimation = getCompiledAnimation(props.animation);
         animationStyle = makeInterpolatedStyle(
           compiledAnimation,
-          animationValue
+          animationValue,
         );
       }
       this.state = {
@@ -215,15 +221,17 @@ export default function createAnimatableComponent(WrappedComponent) {
 
       const currentTransitionValues = getStyleValues(
         transitionKeys,
-        this.props.style
+        this.props.style,
       );
       Object.keys(currentTransitionValues).forEach(key => {
         const value = currentTransitionValues[key];
         if (INTERPOLATION_STYLE_PROPERTIES.indexOf(key) !== -1) {
           transitionValues[key] = new Animated.Value(0);
           styleValues[key] = value;
         } else {
-          transitionValues[key] = styleValues[key] = new Animated.Value(value);
+          const animationValue = new Animated.Value(value);
+          transitionValues[key] = animationValue;
+          styleValues[key] = animationValue;
         }
       });
 
@@ -242,7 +250,7 @@ export default function createAnimatableComponent(WrappedComponent) {
         transitionStyle,
       } = this.state;
       const missingKeys = transitionKeys.filter(
-        key => !this.state.transitionValues[key]
+        key => !this.state.transitionValues[key],
       );
       if (missingKeys.length) {
         const transitionState = this.initializeTransitionState(missingKeys);
@@ -333,7 +341,7 @@ export default function createAnimatableComponent(WrappedComponent) {
       const compiledAnimation = getCompiledAnimation(animation);
       const animationStyle = makeInterpolatedStyle(
         compiledAnimation,
-        this.state.animationValue
+        this.state.animationValue,
       );
       this.setState({ animationStyle, compiledAnimation }, callback);
     }
@@ -438,9 +446,9 @@ export default function createAnimatableComponent(WrappedComponent) {
             toValuesFlat,
             duration || this.props.duration,
             easing,
-            this.props.delay
+            this.props.delay,
           );
-        }
+        },
       );
     }
 
@@ -469,7 +477,7 @@ export default function createAnimatableComponent(WrappedComponent) {
             duration,
             easing,
             this.props.useNativeDriver,
-            delay
+            delay,
           );
         } else {
           let currentTransitionValue = currentTransitionValues[property];
@@ -500,7 +508,7 @@ export default function createAnimatableComponent(WrappedComponent) {
           duration,
           easing,
           this.props.useNativeDriver,
-          delay
+          delay,
         );
       });
     }
@@ -512,7 +520,7 @@ export default function createAnimatableComponent(WrappedComponent) {
       }
       const restProps = omit(
         Object.keys(AnimatableComponent.propTypes),
-        this.props
+        this.props,
       );
 
       return (
```

**File**: `createAnimation.js` (modified, +2/-1)
```diff
@@ -44,7 +44,8 @@ export default function createAnimation(definition) {
     compiled.style = definition.style;
   }
 
-  for (const position of positions) {
+  for (let i = 0; i < positions.length; i += 1) {
+    const position = positions[i];
     let keyframe = definition[position];
     if (!keyframe) {
       if (position === 0) {
```

**File**: `definitions/zooming-entrances.js` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import { Easing } from 'react-native';
 function makeZoomInTranslation(translationType, pivotPoint) {
   const modifier = Math.min(1, Math.max(-1, pivotPoint));
   return {
-    easing: Easing.bezier(0.175, 0.885, 0.320, 1),
+    easing: Easing.bezier(0.175, 0.885, 0.32, 1),
     0: {
       opacity: 0,
       scale: 0.1,
```

**File**: `definitions/zooming-exits.js` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import { Easing } from 'react-native';
 function makeZoomOutTranslation(translationType, pivotPoint) {
   const modifier = Math.min(1, Math.max(-1, pivotPoint));
   return {
-    easing: Easing.bezier(0.175, 0.885, 0.320, 1),
+    easing: Easing.bezier(0.175, 0.885, 0.32, 1),
     0: {
       opacity: 1,
       scale: 1,
```

**File**: `easing.js` (modified, +24/-24)
```diff
@@ -11,37 +11,37 @@ const EASING_FUNCTIONS = {
 
   // Penner Equations - http://matthewlein.com/ceaser/ & http://easings.net
 
-  'ease-in-cubic': Easing.bezier(0.550, 0.055, 0.675, 0.190),
-  'ease-out-cubic': Easing.bezier(0.215, 0.610, 0.355, 1.000),
-  'ease-in-out-cubic': Easing.bezier(0.645, 0.045, 0.355, 1.000),
+  'ease-in-cubic': Easing.bezier(0.55, 0.055, 0.675, 0.19),
+  'ease-out-cubic': Easing.bezier(0.215, 0.61, 0.355, 1.0),
+  'ease-in-out-cubic': Easing.bezier(0.645, 0.045, 0.355, 1.0),
 
-  'ease-in-circ': Easing.bezier(0.600, 0.040, 0.980, 0.335),
-  'ease-out-circ': Easing.bezier(0.075, 0.820, 0.165, 1.000),
-  'ease-in-out-circ': Easing.bezier(0.785, 0.135, 0.150, 0.860),
+  'ease-in-circ': Easing.bezier(0.6, 0.04, 0.98, 0.335),
+  'ease-out-circ': Easing.bezier(0.075, 0.82, 0.165, 1.0),
+  'ease-in-out-circ': Easing.bezier(0.785, 0.135, 0.15, 0.86),
 
-  'ease-in-expo': Easing.bezier(0.950, 0.050, 0.795, 0.035),
-  'ease-out-expo': Easing.bezier(0.190, 1.000, 0.220, 1.000),
-  'ease-in-out-expo': Easing.bezier(1.000, 0.000, 0.000, 1.000),
+  'ease-in-expo': Easing.bezier(0.95, 0.05, 0.795, 0.035),
+  'ease-out-expo': Easing.bezier(0.19, 1.0, 0.22, 1.0),
+  'ease-in-out-expo': Easing.bezier(1.0, 0.0, 0.0, 1.0),
 
-  'ease-in-quad': Easing.bezier(0.550, 0.085, 0.680, 0.530),
-  'ease-out-quad': Easing.bezier(0.250, 0.460, 0.450, 0.940),
-  'ease-in-out-quad': Easing.bezier(0.455, 0.030, 0.515, 0.955),
+  'ease-in-quad': Easing.bezier(0.55, 0.085, 0.68, 0.53),
+  'ease-out-quad': Easing.bezier(0.25, 0.46, 0.45, 0.94),
+  'ease-in-out-quad': Easing.bezier(0.455, 0.03, 0.515, 0.955),
 
-  'ease-in-quart': Easing.bezier(0.895, 0.030, 0.685, 0.220),
-  'ease-out-quart': Easing.bezier(0.165, 0.840, 0.440, 1.000),
-  'ease-in-out-quart': Easing.bezier(0.770, 0.000, 0.175, 1.000),
+  'ease-in-quart': Easing.bezier(0.895, 0.03, 0.685, 0.22),
+  'ease-out-quart': Easing.bezier(0.165, 0.84, 0.44, 1.0),
+  'ease-in-out-quart': Easing.bezier(0.77, 0.0, 0.175, 1.0),
 
-  'ease-in-quint': Easing.bezier(0.755, 0.050, 0.855, 0.060),
-  'ease-out-quint': Easing.bezier(0.230, 1.000, 0.320, 1.000),
-  'ease-in-out-quint': Easing.bezier(0.860, 0.000, 0.070, 1.000),
+  'ease-in-quint': Easing.bezier(0.755, 0.05, 0.855, 0.06),
+  'ease-out-quint': Easing.bezier(0.23, 1.0, 0.32, 1.0),
+  'ease-in-out-quint': Easing.bezier(0.86, 0.0, 0.07, 1.0),
 
-  'ease-in-sine': Easing.bezier(0.470, 0.000, 0.745, 0.715),
-  'ease-out-sine': Easing.bezier(0.390, 0.575, 0.565, 1.000),
-  'ease-in-out-sine': Easing.bezier(0.445, 0.050, 0.550, 0.950),
+  'ease-in-sine': Easing.bezier(0.47, 0.0, 0.745, 0.715),
+  'ease-out-sine': Easing.bezier(0.39, 0.575, 0.565, 1.0),
+  'ease-in-out-sine': Easing.bezier(0.445, 0.05, 0.55, 0.95),
 
-  'ease-in-back': Easing.bezier(0.600, -0.280, 0.735, 0.045),
-  'ease-out-back': Easing.bezier(0.175, 0.885, 0.320, 1.275),
-  'ease-in-out-back': Easing.bezier(0.680, -0.550, 0.265, 1.550),
+  'ease-in-back': Easing.bezier(0.6, -0.28, 0.735, 0.045),
+  'ease-out-back': Easing.bezier(0.175, 0.885, 0.32, 1.275),
+  'ease-in-out-back': Easing.bezier(0.68, -0.55, 0.265, 1.55),
 };
 
 export default EASING_FUNCTIONS;
```

**File**: `package.json` (modified, +13/-15)
```diff
@@ -8,7 +8,7 @@
     "jest:watch": "npm run jest -- --watch",
     "lint": "./node_modules/.bin/eslint ./*.js",
     "test": "npm run lint && npm run jest",
-    "format": "./node_modules/.bin/prettier --single-quote --trailing-comma es5 --write {,definitions/,__tests__}*.js"
+    "format": "./node_modules/.bin/prettier --single-quote --trailing-comma all --write {,definitions/,__tests__}*.js"
   },
   "keywords": [
     "react-native",
@@ -42,27 +42,25 @@
   "jest": {
     "preset": "jest-react-native",
     "modulePathIgnorePatterns": [
-      "<rootDir>/Example/",
-      "<rootDir>/node_modules/react-native/Libraries/react-native/",
-      "<rootDir>/node_modules/react-native/packager/"
+      "<rootDir>/Example/"
     ]
   },
   "devDependencies": {
     "babel": "^6.5.2",
     "babel-eslint": "^7.0.0",
-    "babel-jest": "^16.0.0",
+    "babel-jest": "^20.0.3",
     "babel-preset-react-native": "^1.9.0",
     "eslint": "^3.7.1",
-    "eslint-config-airbnb": "^12.0.0",
-    "eslint-plugin-import": "^1.16.0",
-    "eslint-plugin-jsx-a11y": "^2.2.3",
-    "eslint-plugin-react": "^6.4.1",
-    "jest": "17.0.2",
-    "jest-cli": "17.0.2",
-    "jest-react-native": "17.0.3",
+    "eslint-config-airbnb": "^15.0.1",
+    "eslint-plugin-import": "^2.3.0",
+    "eslint-plugin-jsx-a11y": "^5.0.3",
+    "eslint-plugin-react": "^7.0.1",
+    "jest": "20.0.4",
+    "jest-cli": "20.0.4",
+    "jest-react-native": "18.0.0",
     "prettier": "^1.3.1",
-    "react": "~15.3.2",
-    "react-native": "^0.36.1",
-    "react-test-renderer": "15.3.2"
+    "react": "*",
+    "react-native": "*",
+    "react-test-renderer": "15.5.4"
   }
 }
```

**File**: `registry.js` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ export function initializeRegistryWithDefinitions(definitions) {
   Object.keys(definitions).forEach(animationName => {
     registerAnimation(
       animationName,
-      createAnimation(definitions[animationName])
+      createAnimation(definitions[animationName]),
     );
   });
 }
```

---

### Incident Patch 10: `02006e6e` (2017-06-03)
**Commit Message**: Fix native animation driver support for swing, tada and wobble

**File**: `Example/app.js` (modified, +0/-4)
```diff
@@ -116,9 +116,6 @@ const ANIMATION_TYPES = {
 
 const NATIVE_INCOMPATIBLE_ANIMATIONS = [
   'jello',
-  'swing',
-  'tada',
-  'wobble',
   'lightSpeedIn',
   'lightSpeedOut',
 ];
@@ -235,7 +232,6 @@ export default class ExampleView extends Component {
           <Text
             style={[styles.toggle, toggledOn && styles.toggledOn]}
             transition={['color', 'rotate', 'fontSize']}
-            useNativeDriver
           >
             Toggle me!
           </Text>
```

**File**: `definitions/attention-seekers.js` (modified, +24/-24)
```diff
@@ -157,22 +157,22 @@ export const shake = {
 
 export const swing = {
   0: {
-    rotateZ: '0deg',
+    rotate: '0deg',
   },
   0.2: {
-    rotateZ: '15deg',
+    rotate: '15deg',
   },
   0.4: {
-    rotateZ: '-10deg',
+    rotate: '-10deg',
   },
   0.6: {
-    rotateZ: '5deg',
+    rotate: '5deg',
   },
   0.8: {
-    rotateZ: '-5deg',
+    rotate: '-5deg',
   },
   1: {
-    rotateZ: '0deg',
+    rotate: '0deg',
   },
 };
 
@@ -210,72 +210,72 @@ export const rubberBand = {
 export const tada = {
   0: {
     scale: 1,
-    rotateZ: '0deg',
+    rotate: '0deg',
   },
   0.1: {
     scale: 0.9,
-    rotateZ: '-3deg',
+    rotate: '-3deg',
   },
   0.2: {
     scale: 0.9,
-    rotateZ: '-3deg',
+    rotate: '-3deg',
   },
   0.3: {
     scale: 1.1,
-    rotateZ: '-3deg',
+    rotate: '-3deg',
   },
   0.4: {
-    rotateZ: '3deg',
+    rotate: '3deg',
   },
   0.5: {
-    rotateZ: '-3deg',
+    rotate: '-3deg',
   },
   0.6: {
-    rotateZ: '3deg',
+    rotate: '3deg',
   },
   0.7: {
-    rotateZ: '-3deg',
+    rotate: '-3deg',
   },
   0.8: {
-    rotateZ: '3deg',
+    rotate: '3deg',
   },
   0.9: {
     scale: 1.1,
-    rotateZ: '3deg',
+    rotate: '3deg',
   },
   1: {
     scale: 1,
-    rotateZ: '0deg',
+    rotate: '0deg',
   },
 };
 
 export const wobble = {
   0: {
     translateX: 0,
-    rotateZ: '0deg',
+    rotate: '0deg',
   },
   0.15: {
     translateX: -25,
-    rotateZ: '-5deg',
+    rotate: '-5deg',
   },
   0.3: {
     translateX: 20,
-    rotateZ: '3deg',
+    rotate: '3deg',
   },
   0.45: {
     translateX: -15,
-    rotateZ: '-3deg',
+    rotate: '-3deg',
   },
   0.6: {
     translateX: 10,
-    rotateZ: '2deg',
+    rotate: '2deg',
   },
   0.75: {
     translateX: -5,
-    rotateZ: '-1deg',
+    rotate: '-1deg',
   },
   1: {
     translateX: 0,
-    rotateZ: '0deg',
+    rotate: '0deg',
   },
 };
```

---

### Incident Patch 11: `22c76ba8` (2017-03-18)
**Commit Message**: Fall back to generic margins and paddings for transitions. Fixes #103

**File**: `__tests__/getDefaultStyleValue.js` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+/* eslint-env jest */
+
+import getDefaultStyleValue from '../getDefaultStyleValue';
+
+describe('getDefaultStyleValue', () => {
+  it('should return 0deg for skew and rotate keys', () => {
+    expect(getDefaultStyleValue('skewX')).toEqual('0deg');
+    expect(getDefaultStyleValue('skewY')).toEqual('0deg');
+    expect(getDefaultStyleValue('rotateX')).toEqual('0deg');
+    expect(getDefaultStyleValue('rotateY')).toEqual('0deg');
+  });
+
+  it('should fallback to general margins', () => {
+    expect(getDefaultStyleValue('marginTop', { margin: 10 })).toEqual(10);
+    expect(getDefaultStyleValue('marginTop', { marginVertical: 10 })).toEqual(10);
+    expect(getDefaultStyleValue('marginLeft', { margin: 10 })).toEqual(10);
+    expect(getDefaultStyleValue('marginLeft', { marginVertical: 10 })).toEqual(0);
+    expect(getDefaultStyleValue('marginHorizontal', { margin: 10 })).toEqual(10);
+  });
+
+  it('should fallback to general paddings', () => {
+    expect(getDefaultStyleValue('paddingTop', { padding: 10 })).toEqual(10);
+    expect(getDefaultStyleValue('paddingTop', { paddingVertical: 10 })).toEqual(10);
+    expect(getDefaultStyleValue('paddingLeft', { padding: 10 })).toEqual(10);
+    expect(getDefaultStyleValue('paddingLeft', { paddingVertical: 10 })).toEqual(0);
+    expect(getDefaultStyleValue('paddingHorizontal', { padding: 10 })).toEqual(10);
+  });
+});
```

**File**: `getDefaultStyleValue.js` (modified, +31/-5)
```diff
@@ -1,21 +1,47 @@
-export default function getDefaultStyleValue(key) {
+/* eslint-disable no-plusplus */
+
+const DIRECTIONAL_FALLBACKS = {
+  Top: ['Vertical', ''],
+  Bottom: ['Vertical', ''],
+  Vertical: [''],
+  Left: ['Horizontal', ''],
+  Right: ['Horizontal', ''],
+  Horizontal: [''],
+};
+
+const DIRECTIONAL_SUFFICES = Object.keys(DIRECTIONAL_FALLBACKS);
+
+export default function getDefaultStyleValue(key, flatStyle) {
   if (key === 'backgroundColor') {
     return 'rgba(0,0,0,0)';
   }
   if (key === 'color' || key.indexOf('Color') !== -1) {
     return 'rgba(0,0,0,1)';
   }
-  if (key.indexOf('rotate') !== -1 || key.indexOf('skew') !== -1) {
+  if (key.indexOf('rotate') === 0 || key.indexOf('skew') === 0) {
     return '0deg';
   }
-  if (key.indexOf('scale') !== -1) {
+  if (key === 'opacity' || key.indexOf('scale') === 0) {
     return 1;
   }
   if (key === 'fontSize') {
     return 14;
   }
-  if (key === 'opacity') {
-    return 1;
+  if (key.indexOf('margin') === 0 || key.indexOf('padding') === 0) {
+    for (let suffix, i = 0; i < DIRECTIONAL_SUFFICES.length; i++) {
+      suffix = DIRECTIONAL_SUFFICES[i];
+      if (key.substr(-suffix.length) === suffix) {
+        const prefix = key.substr(0, key.length - suffix.length);
+        const fallbacks = DIRECTIONAL_FALLBACKS[suffix];
+        for (let fallback, j = 0; j < fallbacks.length; j++) {
+          fallback = prefix + fallbacks[j];
+          if (fallback in flatStyle) {
+            return flatStyle[fallback];
+          }
+        }
+        break;
+      }
+    }
   }
   return 0;
 }
```

**File**: `getStyleValues.js` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ export default function getStyleValues(keys, style) {
   const flatStyle = flattenStyle(style);
 
   (typeof keys === 'string' ? [keys] : keys).forEach((key) => {
-    values[key] = (key in flatStyle ? flatStyle[key] : getDefaultStyleValue(key));
+    values[key] = (key in flatStyle ? flatStyle[key] : getDefaultStyleValue(key, flatStyle));
   });
   return values;
 }
```

---

### Incident Patch 12: `4cf04543` (2017-03-18)
**Commit Message**: Fix bug where regular animations would not create interaction handle

**File**: `createAnimatableComponent.js` (modified, +1/-1)
```diff
@@ -329,7 +329,7 @@ export default function createAnimatableComponent(WrappedComponent) {
       Animated.timing(animationValue, {
         toValue,
         easing,
-        isInteraction: !iterationCount,
+        isInteraction: iterationCount <= 1,
         duration: duration || this.props.duration || 1000,
         useNativeDriver,
       }).start((endState) => {
```

---

### Incident Patch 13: `9536b4b2` (2017-03-07)
**Commit Message**: Fix default scale style (#101)

**File**: `getDefaultStyleValue.js` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@ export default function getDefaultStyleValue(key) {
   if (key.indexOf('rotate') !== -1 || key.indexOf('skew') !== -1) {
     return '0deg';
   }
+  if (key.indexOf('scale') !== -1) {
+    return 1;
+  }
   if (key === 'fontSize') {
     return 14;
   }
```

---

### Incident Patch 14: `e6ce809d` (2016-11-30)
**Commit Message**: Expand built in easing functions with penner equations #77

**File**: `README.md` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ You can create your own simple transitions of a style property of your own choos
 |**`duration`**|For how long the animation will run (milliseconds). |`1000`|
 |**`delay`**|Optionally delay animation (milliseconds). |`0`|
 |**`direction`**|Direction of animation, especially useful for repeating animations. Valid values: `normal`, `reverse`, `alternate`, `alternate-reverse`. |`normal`|
-|**`easing`**|Timing function for the animation. Valid values: custom function or `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`. |`ease`|
+|**`easing`**|Timing function for the animation. Valid values: custom function or `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, `ease-in-cubic`, `ease-out-cubic`, `ease-in-out-cubic`, `ease-in-circ`, `ease-out-circ`, `ease-in-out-circ`, `ease-in-expo`, `ease-out-expo`, `ease-in-out-expo`, `ease-in-quad`, `ease-out-quad`, `ease-in-out-quad`, `ease-in-quart`, `ease-out-quart`, `ease-in-out-quart`, `ease-in-quint`, `ease-out-quint`, `ease-in-out-quint`, `ease-in-sine`, `ease-out-sine`, `ease-in-out-sine`, `ease-in-back`, `ease-out-back`, `ease-in-out-back`. |`ease`|
 |**`iterationCount`**|How many times to run the animation, use `infinite` for looped animations. |`1`|
 |**`transition`**|What `style` property to transition, for example `opacity`, `rotate` or `fontSize`. Use array for multiple properties.  |*None*|
 |**`onAnimationBegin`**|A function that is called when the animation has been started. |*None*|
```

**File**: `createAnimatableComponent.js` (modified, +1/-8)
```diff
@@ -5,6 +5,7 @@ import getStyleValues from './getStyleValues';
 import flattenStyle from './flattenStyle';
 import createAnimation from './createAnimation';
 import { getAnimationByName, getAnimationNames } from './registry';
+import EASING_FUNCTIONS from './easing';
 
 // These styles are not number based and thus needs to be interpolated
 const INTERPOLATION_STYLE_PROPERTIES = [
@@ -29,14 +30,6 @@ const INTERPOLATION_STYLE_PROPERTIES = [
   'textDecorationColor',
 ];
 
-const EASING_FUNCTIONS = {
-  linear: Easing.linear,
-  ease: Easing.bezier(0.25, 0.1, 0.25, 1),
-  'ease-in': Easing.bezier(0.42, 0, 1, 1),
-  'ease-out': Easing.bezier(0, 0, 0.58, 1),
-  'ease-in-out': Easing.bezier(0.42, 0, 0.58, 1),
-};
-
 // Create a copy of `source` without `keys`
 function omit(keys, source) {
   const filtered = {};
```

**File**: `easing.js` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+import { Easing } from 'react-native';
+
+const EASING_FUNCTIONS = {
+
+  // Standard CSS easings
+
+  linear: Easing.linear,
+  ease: Easing.bezier(0.25, 0.1, 0.25, 1),
+  'ease-in': Easing.bezier(0.42, 0, 1, 1),
+  'ease-out': Easing.bezier(0, 0, 0.58, 1),
+  'ease-in-out': Easing.bezier(0.42, 0, 0.58, 1),
+
+  // Penner Equations - http://matthewlein.com/ceaser/ & http://easings.net
+
+  'ease-in-cubic': Easing.bezier(0.550, 0.055, 0.675, 0.190),
+  'ease-out-cubic': Easing.bezier(0.215, 0.610, 0.355, 1.000),
+  'ease-in-out-cubic': Easing.bezier(0.645, 0.045, 0.355, 1.000),
+
+  'ease-in-circ': Easing.bezier(0.600, 0.040, 0.980, 0.335),
+  'ease-out-circ': Easing.bezier(0.075, 0.820, 0.165, 1.000),
+  'ease-in-out-circ': Easing.bezier(0.785, 0.135, 0.150, 0.860),
+
+  'ease-in-expo': Easing.bezier(0.950, 0.050, 0.795, 0.035),
+  'ease-out-expo': Easing.bezier(0.190, 1.000, 0.220, 1.000),
+  'ease-in-out-expo': Easing.bezier(1.000, 0.000, 0.000, 1.000),
+
+  'ease-in-quad': Easing.bezier(0.550, 0.085, 0.680, 0.530),
+  'ease-out-quad': Easing.bezier(0.250, 0.460, 0.450, 0.940),
+  'ease-in-out-quad': Easing.bezier(0.455, 0.030, 0.515, 0.955),
+
+  'ease-in-quart': Easing.bezier(0.895, 0.030, 0.685, 0.220),
+  'ease-out-quart': Easing.bezier(0.165, 0.840, 0.440, 1.000),
+  'ease-in-out-quart': Easing.bezier(0.770, 0.000, 0.175, 1.000),
+
+  'ease-in-quint': Easing.bezier(0.755, 0.050, 0.855, 0.060),
+  'ease-out-quint': Easing.bezier(0.230, 1.000, 0.320, 1.000),
+  'ease-in-out-quint': Easing.bezier(0.860, 0.000, 0.070, 1.000),
+
+  'ease-in-sine': Easing.bezier(0.470, 0.000, 0.745, 0.715),
+  'ease-out-sine': Easing.bezier(0.390, 0.575, 0.565, 1.000),
+  'ease-in-out-sine': Easing.bezier(0.445, 0.050, 0.550, 0.950),
+
+  'ease-in-back': Easing.bezier(0.600, -0.280, 0.735, 0.045),
+  'ease-out-back': Easing.bezier(0.175, 0.885, 0.320, 1.275),
+  'ease-in-out-back': Easing.bezier(0.680, -0.550, 0.265, 1.550),
+};
+
+export default EASING_FUNCTIONS;
```

---

### Incident Patch 15: `75e97f05` (2016-11-30)
**Commit Message**: Fix easing on animations via prop #78

**File**: `createAnimatableComponent.js` (modified, +1/-1)
```diff
@@ -309,7 +309,7 @@ export default function createAnimatableComponent(WrappedComponent) {
     startAnimation(duration, iteration, callback) {
       const { animationValue, compiledAnimation } = this.state;
       const { direction, iterationCount, useNativeDriver } = this.props;
-      let easing = compiledAnimation.easing || 'ease';
+      let easing = this.props.easing || compiledAnimation.easing || 'ease';
       let currentIteration = iteration || 0;
       const fromValue = getAnimationOrigin(currentIteration, direction);
       const toValue = getAnimationTarget(currentIteration, direction);
```

#### Recent Merged Pull Requests:
- **PR #406** (2023-10-26): Configure Github actions for tests and deployment (@oblador)
- **PR #405** (2023-10-26): Bump dependencies and examples to React Native 0.72 (@oblador)
- **PR #400** (2023-05-17): Drop usage of deprecated React TypeScript types (@eps1lon)
- **PR #395** (closed): Bump plist from 3.0.1 to 3.0.4 in /Examples/AnimatableExplorer (@dependabot[bot])
- **PR #394** (closed): Bump plist from 3.0.1 to 3.0.4 (@dependabot[bot])
- **PR #393** (closed): Bump plist from 3.0.1 to 3.0.4 in /Examples/MakeItRain (@dependabot[bot])
- **PR #392** (closed): Bump ajv from 6.10.2 to 6.12.6 (@dependabot[bot])
- **PR #391** (closed): Bump ajv from 6.10.2 to 6.12.6 in /Examples/AnimatableExplorer (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
