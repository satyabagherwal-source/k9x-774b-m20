# Forensic Learning Record (Deep Inspection): react-native-modal/react-native-modal

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-native-modal-react-native-modal-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-native-modal/react-native-modal](https://github.com/react-native-modal/react-native-modal))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:22:26.588Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-native-modal/react-native-modal`
- **Description**: An enhanced, animated, customizable Modal for React Native.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5651 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/bare/App.tsx`
```
import React, {useState} from 'react';
import {Button, Text, View} from 'react-native';
import ReactNativeModal from 'react-native-modal';

function App(): React.JSX.Element {
  const [visible, setVisible] = useState<boolean>(false);

  return (
    <View>
      <View style={{marginTop: 40, paddingInline: 40}}>
        <Button title={'Open Modal !'} onPress={() => setVisible(true)} />
      </View>
      <ReactNativeModal isVisible={visible}>
        <View style={{flex: 1, backgroundColor: 'red'}}>
          <Text>Hello!</Text>
          <Button title="Hide modal" onPress={() => setVisible(false)} />
        </View>
      </ReactNativeModal>
    </View>
  );
}

export default App;

```

### Core Architecture Module: `examples/bare/babel.config.js`
```
module.exports = {
  presets: ['module:@react-native/babel-preset'],
};

```

### Core Architecture Module: `examples/bare/index.js`
```
/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

```

### Core Architecture Module: `examples/bare/jest.config.js`
```
module.exports = {
  preset: 'react-native',
};

```

### Core Architecture Module: `examples/bare/metro.config.js`
```
const path = require('path');
const {makeMetroConfig} = require('@rnx-kit/metro-config');

module.exports = makeMetroConfig({
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
  resolver: {
    enableSymlinks: true,
    extraNodeModules: {
      'react-native-modal': path.resolve(__dirname, '../../dist/'),
    },
  },
  watchFolders: [
    path.join(__dirname, 'node_modules', 'react-native-modal'),
    path.resolve(__dirname, '../..'),
  ],
});

```

### Core Architecture Module: `src/back-handler.ts`
```
import {
  BackHandlerStatic,
  BackPressEventName,
  NativeEventSubscription,
  Platform,
} from 'react-native';

const noopBackHandler: BackHandlerStatic = {
  exitApp() {},
  addEventListener(
    eventName: BackPressEventName,
    handler: () => boolean | null | undefined,
  ): NativeEventSubscription {
    return { remove: () => {} };
  },
  removeEventListener: () => {},
};

export const BackHandler: BackHandlerStatic =
  Platform.OS === 'web' ? noopBackHandler : require('react-native').BackHandler;

```

### Core Architecture Module: `src/index.ts`
```
import {ReactNativeModal} from './modal';

export {ModalProps, ReactNativeModal, OnSwipeCompleteParams} from './modal';
export {
  AnimationEvent,
  Animations,
  SupportedAnimation,
  Orientation,
  Direction,
  PresentationStyle,
  OnOrientationChange,
  GestureResponderEvent,
} from './types';

export default ReactNativeModal;

```

### Core Architecture Module: `src/modal.style.ts`
```
import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0,
    backgroundColor: 'black',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  containerBox: {
    zIndex: 2,
    opacity: 1,
    backgroundColor: 'transparent',
  },
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #804** (2025-04-30): **BackHandler error**
  *Symptoms*: <!-- NOTE: - Under the hood react-native-modal uses react-native's built-in Modal. - Before reporting a bug, try swapping react-native-modal with react-native's built-in Modal to check if the problem persists. If it does please report the issue in the react-native repo instead. - Please notice that WE WON'T SUPPORT ISSUE IF YOU HAVEN'T TRIED USING THE BUILT-IN MODAL COMPONENT ALONE.  - For QUESTIONS and FEEDBACK, please use the [discussions](https://github.com/react-native-modal/react-native-modal/discussions) section.   -->  ## Environment  <!-- Run `react-native info` in your terminal and paste its contents here. -->  System:   OS: macOS 15.4.1   CPU: (8) arm64 Apple M2   Memory: 129.73 MB / 16.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 22.14.0     path: /usr/local/bin/node   Yarn:     version: 1.22.22     path: /usr/local/bin/yarn   npm:     version: 10.9.2     path: /usr/local/bin/npm   Watchman:     version: 2025.04.14.00     path: /opt/homebrew/bin/watchman Managers:   CocoaPods:     version: 1.15.2     path: /Users/unbegrenzt/.rbenv/shims/pod SDKs:   iOS SDK:     Platforms:       - DriverKit 24.4       - iOS 18.4       - macOS 15.4       - tvOS 18.4       - visionOS 2.4       - watchOS 11.4   Android SDK:     API Levels:       - "33"       - "34"       - "35"     Build Tools:       - 30.0.3       - 33.0.0       - 33.0.1       - 34.0.0       - 35.0.0     System Images:       - android-28 | Google ARM64-V8a Play ARM 64 v8a       -
  **Post-Mortem & Fix Analysis**:
  > any luck with this one? the change log says is supposed to be fixed but still happening and is being used here. when is the new version scheduled to be released??  <img width="932" alt="Image" src="https://github.com/user-attachments/assets/81b09772-9c0c-4b16-9a2a-0ca713534daa" />
  > > any luck with this one? the change log says is supposed to be fixed but still happening and is being used here. when is the new version scheduled to be released?? >  > <img alt="Image" width="932" src="https://private-user-images.githubusercontent.com/102162328/439343121-81b09772-9c0c-4b16-9a2a-0ca713534daa.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NDYwNDQzNjAsIm5iZiI6MTc0NjA0NDA2MCwicGF0aCI6Ii8xMDIxNjIzMjgvNDM5MzQzMTIxLTgxYjA5NzcyLTljMGMtNGIxNi05YTJhLTBjYTcxMzUzNGRhYS5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjUwNDMwJTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI1MDQzMFQyMDE0MjBaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT1hZDM4YmFiZTI2ZDg1ZGEyYmUxYmI4MTdkYmUyNWU4NDU2OGMzNDVjYzFhNDBiNjRhNWYzOTI3MzdmYzZjMzVmJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.kFYqB8FLOPwLCpPahmmAd_R_CVt89cvJs1ILOqFDHOc">  react native

- **Issue #781** (2025-03-15): **BackHandler.removeEventListener is not a function in React Native 0.77**
  *Symptoms*: 🐛 Bug Report Since updating to React Native 0.77, BackHandler.removeEventListener is no longer available. The new API uses BackHandler.remove(), which causes an error in react-native-modal when attempting to remove the event listener.  ⚠️ Error Message: `TypeError: _reactNative.BackHandler.removeEventListener is not a function (it is undefined)`  📍 Affected Version: React Native: 0.77+ react-native-modal: 13.0.1  💡 Steps to Reproduce: Install react-native-modal in a React Native 0.77 project. Open a modal that listens for the back button. Close the modal or navigate away. The app crashes with the error.  🔍 Expected Behavior: The modal should correctly remove the BackHandler event listener without crashing.  🛠️ Suggested Fix: Replace: `BackHandler.removeEventListener("hardwareBackPress", this.handleBackButton);`  With: `BackHandler.remove("hardwareBackPress", this.handleBackButton);`  A similar fix was applied in [PR #761 ](https://github.com/react-native-modal/react-native-modal/pull/761) after React Native removed removeEventListener.  📎 References: [React Native 0.77 Breaking Changes](https://react-native.dev/) [GitHub PR with Fix](https://github.com/react-native-modal/react-native-modal/pull/761) Would appreciate a fix or official workaround. Thanks! 🙏  ![Image](https://github.com/user-attachments/assets/86bdcae1-1f39-4ea6-aa9a-5b2748ecf76e)  CC: @ancyrweb @mmazzarolo 
  **Post-Mortem & Fix Analysis**:
  > Same error
  > [react-native-modal+13.0.1.patch](https://github.com/user-attachments/files/18556726/react-native-modal%2B13.0.1.patch)
  > @maksymhcode-care Just saw this the minute you posted it, tested it now and it works like a charm! Thank you!

- **Issue #777** (2025-03-08): **Using UNSAFE_componentWillReceiveProps**
  *Symptoms*:  ## Environment  System:   OS: Windows 11 10.0.22631   CPU: "(8) x64 AMD Ryzen 5 3450U with Radeon Vega Mobile Gfx  "   Memory: 325.29 MB / 7.45 GB Binaries:   Node:     version: 20.18.0     path: C:\Program Files\nodejs\node.EXE   Yarn:     version: 4.1.0     path: C:\Program Files\nodejs\yarn.CMD   npm:     version: 10.8.2     path: C:\Program Files\nodejs\npm.CMD   Watchman: Not Found SDKs:   Android SDK: Not Found   Windows SDK: Not Found IDEs:   Android Studio: AI-241.18034.62.2411.12169540   Visual Studio: Not Found Languages:   Java: 17.0.12   Ruby: Not Found npmPackages:   "@react-native-community/cli": Not Found   react:     installed: 18.2.0     wanted: 18.2.0   react-native:     installed: 0.73.5     wanted: 0.73.5   react-native-windows: Not Found npmGlobalPackages:   "*react-native*": Not Found Android:   hermesEnabled: true   newArchEnabled: false iOS:   hermesEnabled: Not found   newArchEnabled: Not found  info React Native v0.76.2 is now available (your project is running on v0.73.5). info Changelog: https://github.com/facebook/react-native/releases/tag/v0.76.2 info Diff: https://react-native-community.github.io/upgrade-helper/?from=0.76.2 info For more info, check out "https://reactnative.dev/docs/upgrading?os=windows".  ## Platforms  Android  ## Versions  - Android: 15 - iOS: - react-native-modal:  "react-native-modal": "^13.0.1", - react-native: 0.73.5 - react:  ## Description  <!-- Describe yo

- **Issue #752** (2025-03-08): **Loading the modal on first render of screen means backdrop doesn't show**
  *Symptoms*: ## Environment  ``` System:     OS: macOS 12.5.1     CPU: (8) x64 Apple M1 Pro     Memory: 22.05 MB / 16.00 GB     Shell: 5.8.1 - /bin/zsh   Binaries:     Node: 16.19.0 - ~/.nvm/versions/node/v16.19.0/bin/node     Yarn: 1.17.3 - ~/.yarn/bin/yarn     npm: 8.19.3 - ~/.nvm/versions/node/v16.19.0/bin/npm     Watchman: 2023.08.14.00 - /usr/local/bin/watchman   Managers:     CocoaPods: 1.12.0 - /Users/me/.rvm/rubies/ruby-2.7.0/bin/pod   SDKs:     iOS SDK:       Platforms: DriverKit 22.2, iOS 16.2, macOS 13.1, tvOS 16.1, watchOS 9.1     Android SDK: Not Found   IDEs:     Android Studio: 2021.2 AI-212.5712.43.2112.8609683     Xcode: 14.2/14C18 - /usr/bin/xcodebuild   Languages:     Java: 11.0.15 - /usr/bin/javac   npmPackages:     @react-native-community/cli: Not Found     react: 17.0.2 => 17.0.2      react-native: 0.68.5 => 0.68.5      react-native-macos: Not Found   npmGlobalPackages:     *react-native*: Not Found ```  ## Platforms  Android  ## Versions  - Android: 13 - react-native-modal: 13.0.1 - react-native: 0.68.5 - react: 17.0.2  ## Description I have a screen with a Modal on it, which is set to appear immediately (i.e. isVisible is true on the first render)  The problem can be summarised as (on Android): * If I reload my app, the backdrop correctly appears * If I navigate to the screen from somewhere else, the backdrop doesn't appear (or at least you can't see it)  _Works (backdrop shows)_ ![Screenshot 2023-10-18 at 18 12 3

- **Issue #749** (2023-09-20): **Jest test cases not working with react-native-modal**
  *Symptoms*: its working with core Modal component  ![image](https://github.com/react-native-modal/react-native-modal/assets/70507671/2776b8dd-b23e-4fa2-8d45-f56d99eb46ea)  Issue:-https://github.com/callstack/react-native-testing-library/issues/1472   ##CODE import React, {forwardRef, useCallback, useImperativeHandle, useMemo, useState} from 'react' import {Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View} from 'react-native' import ReactNativeModal from 'react-native-modal' import _ from 'lodash'  import English from '../Resources/Locales/English' import {Colors} from '../Theme' import {CommonStyles} from '../Theme/CommonStyles' import {Fonts} from '../Theme/Fonts' import {moderateScale, scale, verticalScale} from '../Theme/Responsive'  export interface ButtonType {   title: string   style?: 'cancel' | 'default'   onPress?: () => void } export interface AlertModalRef {   showLoader: (massage: string, buttons: ButtonType[], title?: string) => void }  const AlertModal = forwardRef<AlertModalRef, any>((props, ref) => {   const [isVisible, setISVisible] = useState(false)   const [massage, setMessage] = useState('')   const [button, setButtons] = useState<ButtonType[]>([])   const [title, setTitle] = useState('')   const {height} = Dimensions.get('screen')   const onPressClose = useCallback(() => setISVisible(false), [])    const defaultButtons: ButtonType[] = useMemo(     () => [       {         title: 'OK',         style: 'cancel',        
  **Post-Mortem & Fix Analysis**:
  > https://github.com/callstack/react-native-testing-library/issues/1472#issuecomment-1727343511

- **Issue #745** (2025-03-08): **Samsung One Ui is blocking modal when requested for android permission at same time.**
  *Symptoms*: ## Platforms  Android  Samsung (one ui)  ## Versions   - Android:13   ## Description  The bottom modal is not getting activated when asking for Android permissions at same time on app start.  ## Reproducible Demo 1) Run the app on samsung's latest one ui 2) Activiate the bottom modal and ask for notification permission on app start. 

- **Issue #743** (2025-03-08): **Android: Modal Pops up even if you're on a different screen**
  *Symptoms*: Repro: I have a timer that is running on a Screen A, then when the timer reaches 0 I open the react-native-modal. However if I'm  on Screen B, I STILL see the modal. This is confusing because I only want to see the modal launched from its screen.   This is not the case on iOS. On iOS, you only see the modal once you navigate back to Screen A. This is the expected behavior.   ## Platforms  Android  ## Versions  <!-- Please add the used versions/branches -->  - Android: - iOS: - react-native-modal: 13.0.0 - react-native: 0.71.8 - react: 18.2.0 

- **Issue #742** (2025-03-08): **TypeError: _reactNative.InteractionManager.clearInteractionHandle is not a function**
  *Symptoms*: I got that TypeError at node_modules/react-native-modal/dist/modal.js:332:45 Can anyone help me,please Thanks every one
  **Post-Mortem & Fix Analysis**:
  > Anyone know... 
  > Maybe not relevant, but....  I get a similar error when I use npm run test.  I found a test that tests a component that uses import Modal from 'react-native-modal';  I refactored the unit-test for the component that uses 'react-native-modal'  changed this library: import renderer from 'react-test-renderer';  to this: import { render } from '@testing-library/react-native';  This is a bugfix

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

### Incident Patch 1: `3cd1614a` (2025-03-15)
**Commit Message**: fix: back-handler

**File**: `package.json` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@
     "prettier": "^1.18.2",
     "pretty-quick": "^2.0.0",
     "react": "19.0.0",
-    "react-native": "0.78.0",
+    "react-native": "0.76.7",
     "typescript": "5.8.2"
   },
   "peerDependencies": {
```

**File**: `src/back-handler.ts` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ const noopBackHandler: BackHandlerStatic = {
   ): NativeEventSubscription {
     return { remove: () => {} };
   },
+  removeEventListener: () => {},
 };
 
 export const BackHandler: BackHandlerStatic =
```

**File**: `yarn.lock` (modified, +470/-168)
```diff
@@ -42,7 +42,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/core@npm:^7.11.6, @babel/core@npm:^7.12.3, @babel/core@npm:^7.24.7, @babel/core@npm:^7.25.2":
+"@babel/core@npm:^7.11.6, @babel/core@npm:^7.12.3, @babel/core@npm:^7.25.2":
   version: 7.26.9
   resolution: "@babel/core@npm:7.26.9"
   dependencies:
@@ -65,6 +65,29 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@babel/core@npm:^7.13.16":
+  version: 7.26.10
+  resolution: "@babel/core@npm:7.26.10"
+  dependencies:
+    "@ampproject/remapping": "npm:^2.2.0"
+    "@babel/code-frame": "npm:^7.26.2"
+    "@babel/generator": "npm:^7.26.10"
+    "@babel/helper-compilation-targets": "npm:^7.26.5"
+    "@babel/helper-module-transforms": "npm:^7.26.0"
+    "@babel/helpers": "npm:^7.26.10"
+    "@babel/parser": "npm:^7.26.10"
+    "@babel/template": "npm:^7.26.9"
+    "@babel/traverse": "npm:^7.26.10"
+    "@babel/types": "npm:^7.26.10"
+    convert-source-map: "npm:^2.0.0"
+    debug: "npm:^4.1.0"
+    gensync: "npm:^1.0.0-beta.2"
+    json5: "npm:^2.2.3"
+    semver: "npm:^6.3.1"
+  checksum: 10c0/e046e0e988ab53841b512ee9d263ca409f6c46e2a999fe53024688b92db394346fa3aeae5ea0866331f62133982eee05a675d22922a4603c3f603aa09a581d62
+  languageName: node
+  linkType: hard
+
 "@babel/generator@npm:^7.25.0, @babel/generator@npm:^7.26.9":
   version: 7.26.9
   resolution: "@babel/generator@npm:7.26.9"
@@ -78,6 +101,19 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@babel/generator@npm:^7.26.10":
+  version: 7.26.10
+  resolution: "@babel/generator@npm:7.26.10"
+  dependencies:
+    "@babel/parser": "npm:^7.26.10"
+    "@babel/types": "npm:^7.26.10"
+    "@jridgewell/gen-mapping": "npm:^0.3.5"
+    "@jridgewell/trace-mapping": "npm:^0.3.25"
+    jsesc: "npm:^3.0.2"
+  checksum: 10c0/88b3b3ea80592fc89349c4e1a145e1386e4042866d2507298adf452bf972f68d13bf699a845e6ab8c028bd52c2247013eb1221b86e1db5c9779faacba9c4b10e
+  languageName: node
+  linkType: hard
+
 "@babel/helper-annotate-as-pure@npm:^7.25.9":
   version: 7.25.9
   resolution: "@babel/helper-annotate-as-pure@npm:7.25.9"
@@ -100,7 +136,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/helper-create-class-features-plugin@npm:^7.25.9":
+"@babel/helper-create-class-features-plugin@npm:^7.18.6, @babel/helper-create-class-features-plugin@npm:^7.25.9":
   version: 7.26.9
   resolution: "@babel/helper-create-class-features-plugin@npm:7.26.9"
   dependencies:
@@ -194,7 +230,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/helper-plugin-utils@npm:^7.10.4, @babel/helper-plugin-utils@npm:^7.12.13, @babel/helper-plugin-utils@npm:^7.14.5, @babel/helper-plugin-utils@npm:^7.22.5, @babel/helper-plugin-utils@npm:^7.25.9, @babel/helper-plugin-utils@npm:^7.26.5, @babel/helper-plugin-utils@npm:^7.8.0":
+"@babel/helper-plugin-utils@npm:^7.10.4, @babel/helper-plugin-utils@npm:^7.12.13, @babel/helper-plugin-utils@npm:^7.14.5, @babel/helper-plugin-utils@npm:^7.18.6, @babel/helper-plugin-utils@npm:^7.20.2, @babel/helper-plugin-utils@npm:^7.22.5, @babel/helper-plugin-utils@npm:^7.25.9, @babel/helper-plugin-utils@npm:^7.26.5, @babel/helper-plugin-utils@npm:^7.8.0":
   version: 7.26.5
   resolution: "@babel/helper-plugin-utils@npm:7.26.5"
   checksum: 10c0/cdaba71d4b891aa6a8dfbe5bac2f94effb13e5fa4c2c487667fdbaa04eae059b78b28d85a885071f45f7205aeb56d16759e1bed9c118b94b16e4720ef1ab0f65
@@ -227,7 +263,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/helper-skip-transparent-expression-wrappers@npm:^7.25.9":
+"@babel/helper-skip-transparent-expression-wrappers@npm:^7.20.0, @babel/helper-skip-transparent-expression-wrappers@npm:^7.25.9":
   version: 7.25.9
   resolution: "@babel/helper-skip-transparent-expression-wrappers@npm:7.25.9"
   dependencies:
@@ -269,6 +305,16 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@babel/helpers@npm:^7.26.10":
+  version: 7.26.10
+  resolution: "@babel/helpers@npm:7.26.10"
+  dependencies:
+    "@babel/template": "npm:^7.26.9"
+
```

---

### Incident Patch 2: `46063b72` (2025-03-08)
**Commit Message**: fix: partial types causing ts errors

**File**: `src/modal.tsx` (modified, +1/-1)
```diff
@@ -117,7 +117,7 @@ export type ModalProps = ViewProps & {
 
   // Default ModalProps Provided
   useNativeDriverForBackdrop?: boolean;
-} & Partial<typeof defaultProps>;
+} & typeof defaultProps;
 
 const extractAnimationFromProps = (props: ModalProps) => ({
   animationIn: props.animationIn,
```

---

### Incident Patch 3: `8e1a21fe` (2025-03-08)
**Commit Message**: fix: workflows

**File**: `.github/workflows/deploy.yml` (removed, +0/-45)
```diff
@@ -1,45 +0,0 @@
-name: Deployment
-
-on:
-  push:
-    branches:
-      - master
-  pull_request:
-    branches:
-      - master
-
-jobs:
-  tests:
-    runs-on: ubuntu-latest
-    name: Install
-    steps:
-      - uses: actions/checkout@v4
-      - uses: actions/setup-node@v4
-        with:
-          node-version: '22.x'
-      - run: |
-          corepack enable
-          yarn --immutable
-      - name: Build the project
-        run: yarn build
-  release:
-    name: Release
-    runs-on: ubuntu-latest
-    needs: tests
-    steps:
-      - uses: actions/checkout@v4
-      - uses: actions/setup-node@v4
-        with:
-          node-version: '22.x'
-      - run: |
-          corepack enable
-          yarn --immutable
-      - name: Build the project
-        run: yarn build
-      - name: Release
-        env:
-          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
-        run: |
-          npm ci
-          npm publish --provenance --access public
```

**File**: `.github/workflows/tests.yml` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+name: Tests
+
+on:
+  push:
+    branches:
+      - master
+  pull_request:
+    branches:
+      - master
+
+jobs:
+  tests:
+    runs-on: ubuntu-latest
+    name: Install
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '22.x'
+      - run: |
+          corepack enable
+          yarn --immutable
+      - name: Build the project
+        run: yarn build
```

---

### Incident Patch 4: `2a8cba6e` (2025-03-08)
**Commit Message**: fix: workflows

**File**: `.github/workflows/deploy.yml` (modified, +5/-6)
```diff
@@ -20,11 +20,8 @@ jobs:
       - run: |
           corepack enable
           yarn --immutable
-      - uses: actions/cache@v4
-        id: cache-build
-        with:
-          path: '.'
-          key: ${{ github.sha }}
+      - name: Build the project
+        run: yarn build
   release:
     name: Release
     runs-on: ubuntu-latest
@@ -43,4 +40,6 @@ jobs:
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
           NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
-        run: npm publish --provenance --access public
+        run: |
+          npm ci
+          npm publish --provenance --access public
```

---

### Incident Patch 5: `c562cf93` (2025-03-08)
**Commit Message**: fix: semantic release & publish

**File**: `.github/CONTRIBUTING.md` (modified, +0/-4)
```diff
@@ -52,10 +52,6 @@ We prefix our commit messages with one of the following to signify the kind of c
 - **style**: Changes that do not affect the meaning of the code.
 - **test**: Adding missing tests or correcting existing tests.
 
-## Release process
-
-We use [Semantic Release](http://semantic-release.org) to automatically release new versions of the library when changes are merged into master. Using the commit message convention described above, it will detect if we need to release a patch, minor, or major version of the library.
-
 ## Reporting issues
 
 You can report issues on our [bug tracker](https://github.com/react-native-community/react-native-modal/issues). Please search for existing issues and follow the issue template when opening an issue.
```

**File**: `.github/workflows/deploy.yml` (modified, +1/-1)
```diff
@@ -43,4 +43,4 @@ jobs:
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
           NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
-        run: npx semantic-release
+        run: npm publish --provenance --access public
```

**File**: `.releaserc` (removed, +0/-9)
```diff
@@ -1,9 +0,0 @@
-{
-  "plugins": [
-    "@semantic-release/commit-analyzer",
-    "@semantic-release/release-notes-generator",
-    "@semantic-release/npm",
-    "@semantic-release/github",
-    "@semantic-release/git"
-  ]
-}
\ No newline at end of file
```

**File**: `package.json` (modified, +1/-4)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-modal",
-  "version": "13.0.2",
+  "version": "14.0.0-rc.0",
   "description": "An enhanced React Native modal",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
@@ -9,7 +9,6 @@
   ],
   "scripts": {
     "test": "yarn run lint",
-    "release": "yarn semantic-release",
     "build": "tsc",
     "dev": "tsc --watch",
     "test:ts": "tsc --noEmit"
@@ -44,15 +43,13 @@
     "react-native-animatable": "1.4.0"
   },
   "devDependencies": {
-    "@semantic-release/git": "^10.0.1",
     "@types/react": "^19.0.10",
     "husky": "^3.0.9",
     "postinstall": "^0.5.1",
     "prettier": "^1.18.2",
     "pretty-quick": "^2.0.0",
     "react": "19.0.0",
     "react-native": "0.78.0",
-    "semantic-release": "24.2.3",
     "typescript": "5.8.2"
   },
   "peerDependencies": {
```

---

### Incident Patch 6: `7e581c70` (2025-03-08)
**Commit Message**: fix: workflows

**File**: `.github/workflows/deploy.yml` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-name: Lint & Test
+name: Deployment
 
 on:
   push:
```

**File**: `yarn.lock` (modified, +1/-1)
```diff
@@ -7069,7 +7069,7 @@ __metadata:
     typescript: "npm:5.8.2"
   peerDependencies:
     react: "*"
-    react-native: ">=0.65.0"
+    react-native: ">=0.70.0"
   languageName: unknown
   linkType: soft
 
```

---

### Incident Patch 7: `31b90532` (2025-03-08)
**Commit Message**: fix: workflows

**File**: `.github/workflows/deploy.yml` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+name: Lint & Test
+
+on:
+  push:
+    branches:
+      - master
+  pull_request:
+    branches:
+      - master
+
+jobs:
+  tests:
+    runs-on: ubuntu-latest
+    name: Install
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '22.x'
+      - run: |
+          corepack enable
+          yarn --immutable
+      - uses: actions/cache@v4
+        id: cache-build
+        with:
+          path: '.'
+          key: ${{ github.sha }}
+  release:
+    name: Release
+    runs-on: ubuntu-latest
+    needs: tests
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '22.x'
+      - run: |
+          corepack enable
+          yarn --immutable
+      - name: Build the project
+        run: yarn build
+      - name: Release
+        env:
+          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
+        run: npx semantic-release
```

**File**: `.github/workflows/release.yml` (removed, +0/-25)
```diff
@@ -1,25 +0,0 @@
-name: Release
-on:
-  push:
-    branches:
-      - master
-jobs:
-  release:
-    name: Release
-    runs-on: ubuntu-latest
-    steps:
-      - name: Checkout
-        uses: actions/checkout@v4
-      - name: Setup Node.js
-        uses: actions/setup-node@v4
-        with:
-          node-version: '22.x'
-      - name: Install dependencies
-        run: yarn --pure-lockfile
-      - name: Build the project
-        run: yarn build
-      - name: Release
-        env:
-          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
-        run: npx semantic-release
```

**File**: `.github/workflows/test.yml` (removed, +0/-27)
```diff
@@ -1,27 +0,0 @@
-name: Lint & Test
-
-on:
-  push:
-    branches:
-      - master
-  pull_request:
-    branches:
-      - master
-
-jobs:
-  install:
-    runs-on: ubuntu-latest
-    name: Install
-    steps:
-      - uses: actions/checkout@v4
-      - uses: actions/setup-node@v4
-        with:
-          node-version: '22.x'
-      - run: |
-          corepack enable
-          yarn --immutable
-      - uses: actions/cache@v4
-        id: cache-build
-        with:
-          path: '.'
-          key: ${{ github.sha }}
```

---

### Incident Patch 8: `d48d155a` (2025-03-08)
**Commit Message**: fix: workflows & deps

**File**: `.github/workflows/test.yml` (modified, +3/-1)
```diff
@@ -17,7 +17,9 @@ jobs:
       - uses: actions/setup-node@v4
         with:
           node-version: '22.x'
-      - run: yarn --pure-lockfile
+      - run: |
+          corepack enable
+          yarn --immutable
       - uses: actions/cache@v4
         id: cache-build
         with:
```

**File**: `package.json` (modified, +1/-4)
```diff
@@ -57,10 +57,7 @@
   },
   "peerDependencies": {
     "react": "*",
-    "react-native": ">=0.65.0"
-  },
-  "jest": {
-    "preset": "react-native"
+    "react-native": ">=0.70.0"
   },
   "packageManager": "yarn@4.7.0"
 }
```

---

### Incident Patch 9: `287c5fbf` (2025-03-08)
**Commit Message**: fix: workflows

**File**: `.github/CODEOWNERS` (modified, +1/-1)
```diff
@@ -1 +1 @@
-* @mmazzarolo @rewieer
+* @mmazzarolo @ancyrweb
```

**File**: `.github/workflows/release.yml` (modified, +3/-3)
```diff
@@ -9,11 +9,11 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Checkout
-        uses: actions/checkout@v2
+        uses: actions/checkout@v4
       - name: Setup Node.js
-        uses: actions/setup-node@v1
+        uses: actions/setup-node@v4
         with:
-          node-version: '13.x'
+          node-version: '22.x'
       - name: Install dependencies
         run: yarn --pure-lockfile
       - name: Build the project
```

**File**: `.github/workflows/test.yml` (modified, +3/-15)
```diff
@@ -13,25 +13,13 @@ jobs:
     runs-on: ubuntu-latest
     name: Install
     steps:
-      - uses: actions/checkout@v2
-      - uses: actions/setup-node@v1
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
         with:
           node-version: '22.x'
       - run: yarn --pure-lockfile
-      - uses: actions/cache@v1
+      - uses: actions/cache@v4
         id: cache-build
         with:
           path: '.'
           key: ${{ github.sha }}
-
-  test:
-    runs-on: ubuntu-latest
-    name: Test
-    needs: install
-    steps:
-      - uses: actions/cache@v1
-        id: restore-build
-        with:
-          path: '.'
-          key: ${{ github.sha }}
-      - run: yarn test
```

---

### Incident Patch 10: `ebd7a501` (2025-03-08)
**Commit Message**: fix: outdated readme.md

**File**: `README.md` (modified, +29/-32)
```diff
@@ -1,6 +1,6 @@
-### Announcements 
+### Announcements
+
 - 📣 We're looking for maintainers and contributors! See [#598](https://github.com/react-native-modal/react-native-modal/discussions/598)
-- 💡 We're brainstorming if/how we can make a JavaScript-only version of `react-native-modal`. See [#597](https://github.com/react-native-modal/react-native-modal/discussions/597)
 - 🙏 If you have a question, please [start a new discussion](https://github.com/react-native-modal/react-native-modal/discussions) instead of opening a new issue.
 
 # react-native-modal
@@ -39,7 +39,7 @@ Since `react-native-modal` is an extension of the [original React Native modal](
 1.  Import `react-native-modal`:
 
 ```javascript
-import Modal from "react-native-modal";
+import Modal from 'react-native-modal';
 ```
 
 2.  Create a `<Modal>` component and nest its content inside of it:
@@ -49,7 +49,7 @@ function WrapperComponent() {
   return (
     <View>
       <Modal>
-        <View style={{ flex: 1 }}>
+        <View style={{flex: 1}}>
           <Text>I am the modal content!</Text>
         </View>
       </Modal>
@@ -65,7 +65,7 @@ function WrapperComponent() {
   return (
     <View>
       <Modal isVisible={true}>
-        <View style={{ flex: 1 }}>
+        <View style={{flex: 1}}>
           <Text>I am the modal content!</Text>
         </View>
       </Modal>
@@ -84,9 +84,9 @@ Pressing the button sets `isModalVisible` to true, making the modal visible.
 Inside the modal there is another button that, when pressed, sets `isModalVisible` to false, hiding the modal.
 
 ```javascript
-import React, { useState } from "react";
-import { Button, Text, View } from "react-native";
-import Modal from "react-native-modal";
+import React, {useState} from 'react';
+import {Button, Text, View} from 'react-native';
+import Modal from 'react-native-modal';
 
 function ModalTester() {
   const [isModalVisible, setModalVisible] = useState(false);
@@ -96,11 +96,11 @@ function ModalTester() {
   };
 
   return (
-    <View style={{ flex: 1 }}>
+    <View style={{flex: 1}}>
       <Button title="Show modal" onPress={toggleModal} />
 
       <Modal isVisible={isModalVisible}>
-        <View style={{ flex: 1 }}>
+        <View style={{flex: 1}}>
           <Text>Hello!</Text>
 
           <Button title="Hide modal" onPress={toggleModal} />
@@ -117,8 +117,8 @@ For a more complex example take a look at the `/example` directory.
 
 ## Available props
 
-| Name                             | Type                 | Default                        | Description                                                                                                                                |
-| -------------------------------- | -------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
+| Name                             | Type                 | Default                          | Description                                                                                                                                |
+| -------------------------------- | -------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
 | `animationIn`                    | `string` or `object` | `"slideInUp"`                    | Modal show animation                                                                                                                       |
 | `animationInTiming`              | `number`             | `300`                            | Timing for the modal show animation (in ms)                                                                                                |
 | `animationOut`                   | `string` or `object` | `"slideOutDown"`                 | Modal hide animation            
```

#### Recent Merged Pull Requests:
- **PR #841** (closed): chore(deps): bump tar from 7.4.3 to 7.5.6 (@dependabot[bot])
- **PR #833** (closed): chore(deps-dev): bump @react-native-community/cli from 15.1.3 to 20.0.0 in /examples/bare (@dependabot[bot])
- **PR #800** (2025-04-05): chore(deps): bump image-size from 1.2.0 to 1.2.1 in /examples/bare (@dependabot[bot])
- **PR #796** (2025-03-15): chore(deps): bump @babel/helpers from 7.26.9 to 7.26.10 in /examples/bare (@dependabot[bot])
- **PR #795** (closed): chore(deps-dev): bump @babel/runtime from 7.26.9 to 7.26.10 in /examples/bare (@dependabot[bot])
- **PR #794** (2025-03-15): chore(deps): bump json from 2.10.1 to 2.10.2 in /examples/bare (@dependabot[bot])
- **PR #790** (closed): chore(deps): bump braces from 3.0.2 to 3.0.3 (@dependabot[bot])
- **PR #789** (closed): chore(deps): bump minimist from 1.2.0 to 1.2.8 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
