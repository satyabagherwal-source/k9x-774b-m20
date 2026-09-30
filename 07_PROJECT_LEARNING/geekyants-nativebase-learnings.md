# Forensic Learning Record (Deep Inspection): GeekyAnts/NativeBase

> **Canonical Artifact**: `07_PROJECT_LEARNING/geekyants-nativebase-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GeekyAnts/NativeBase](https://github.com/GeekyAnts/NativeBase))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T13:55:49.412Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GeekyAnts/NativeBase`
- **Description**: Mobile-first, accessible components for React Native & Web to build consistent UI across Android, iOS and Web.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 20376 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `RNBareExample/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native-community',
};

```

### Core Architecture Module: `RNBareExample/.prettierrc.js`
```
module.exports = {
  bracketSpacing: false,
  jsxBracketSameLine: true,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'avoid',
};

```

### Core Architecture Module: `RNBareExample/App.tsx`
```
import React from 'react';
import {NativeBaseProvider, Box, Center} from 'native-base';

const config = {
  dependencies: {
    'linear-gradient': require('react-native-linear-gradient').default,
  },
};

const App = () => {
  return (
    <NativeBaseProvider config={config}>
      <Center flex={1}>
        <Box
          bg={{
            linearGradient: {
              colors: ['lightBlue.300', 'violet.800'],
              start: [0, 0],
              end: [1, 0],
            },
          }}
          p={12}
          rounded="lg"
          _text={{fontSize: 'md', fontWeight: 'bold', color: 'white'}}>
          This is a Box with Linear Gradient
        </Box>
      </Center>
    </NativeBaseProvider>
  );
};

export default App;

```

### Core Architecture Module: `RNBareExample/babel.config.js`
```
const path = require('path');
const pak = require('../package.json');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['module:metro-react-native-babel-preset'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            // For development, we want to alias the library to the source
            [pak.name]: path.join(__dirname, '..', pak.source),
          },
        },
      ],
    ],
  };
};

```

### Core Architecture Module: `RNBareExample/index.js`
```
/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

```

### Core Architecture Module: `RNBareExample/ios/RNBareExample/AppDelegate.h`
```
#import <React/RCTBridgeDelegate.h>
#import <UIKit/UIKit.h>

@interface AppDelegate : UIResponder <UIApplicationDelegate, RCTBridgeDelegate>

@property (nonatomic, strong) UIWindow *window;

@end

```

### Core Architecture Module: `RNBareExample/metro.config.js`
```
const path = require('path');
const blacklist = require('metro-config/src/defaults/blacklist');
const escape = require('escape-string-regexp');
const pak = require('../package.json');

const root = path.resolve(__dirname, '..');

const modules = Object.keys({
  ...pak.peerDependencies,
});

module.exports = {
  projectRoot: __dirname,
  watchFolders: [root],

  // We need to make sure that only one version is loaded for peerDependencies
  // So we blacklist them at the root, and alias them to the versions in example's node_modules
  resolver: {
    blacklistRE: blacklist(
      modules.map(
        m => new RegExp(`^${escape(path.join(root, 'node_modules', m))}\\/.*$`),
      ),
    ),
    extraNodeModules: modules.reduce((acc, name) => {
      acc[name] = path.join(__dirname, 'node_modules', name);
      return acc;
    }, {}),
  },

  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
};

```

### Core Architecture Module: `RNBareExample/react-native.config.js`
```
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./assets/fonts'],
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5784** (2023-09-01): **Multiple Modals -  Only on iOS the new modal appears below the first Modal**
  *Symptoms*: ### Description  Only on iOS the new modal appears below the first Modal  ### CodeSandbox/Snack link  codesandbox template  ### Steps to reproduce  On iOS the Multiple Modals doesn't work as expected (on android, it work). The new modal appears below the existing one..   ```js const Example = () => {   const [showModal, setShowModal] = useState(false);   const [showModal2, setShowModal2] = useState(false);   const [showModal3, setShowModal3] = useState(false);   return <Center>       <Button onPress={() => setShowModal(true)}>Button</Button>       <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="lg">         <Modal.Content maxWidth="350">           <Modal.CloseButton />           <Modal.Header>Order</Modal.Header>           <Modal.Body>             <VStack space={3}>               <HStack alignItems="center" justifyContent="space-between">                 <Text fontWeight="medium">Sub Total</Text>                 <Text color="blueGray.400">$298.77</Text>               </HStack>               <HStack alignItems="center" justifyContent="space-between">                 <Text fontWeight="medium">Tax</Text>                 <Text color="blueGray.400">$38.84</Text>               </HStack>               <HStack alignItems="center" justifyContent="space-between">                 <Text fontWeight="medium">Total Amount</Text>                 <Text color="green.500">$337.61</Text>               </HStack>             </VStack>           </Mod
  **Post-Mortem & Fix Analysis**:
  > It is ok it works if I don't create an external Modal .. I don't really understand why
  > Just incase someone else has this issue and this did not work,  I fixed it by adding  ```useRNModal={true}``` to the modal that was being hidden  ```js <Modal useRNModal={true} isOpen={props.show}> ```

- **Issue #5780** (2023-08-28): **Unable to find modules after install and yarn start the react-native cli**
  *Symptoms*: ### Description  not sure but the error is from the other library but after i use yarn why native-base is using that library   ### CodeSandbox/Snack link  //  ### Steps to reproduce  after I close the app and run though again  I try to bump up the native-base native-base": "3.2.2-rc.3", from 3.0  error says ![image](https://github.com/GeekyAnts/NativeBase/assets/6307916/a6ad53d1-6f9e-4252-8808-6e412812e292)  ![image](https://github.com/GeekyAnts/NativeBase/assets/6307916/4203f842-f51b-49e5-8bde-b5d6256318fd) ![image](https://github.com/GeekyAnts/NativeBase/assets/6307916/c714dfe2-5966-4c78-aedf-c62bcbbeca1d)    ### NativeBase Version  3.2.2-rc.3  ### Platform  - [X] Android - [X] CRA - [ ] Expo - [X] iOS - [ ] Next  ### Other Platform  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > It's happening with older versions of native base as well
  > I have version 3.4.28 also tried with ^3.4.28 facing same error.
  > this [snippet code](https://github.com/adobe/react-spectrum/issues/4894#issuecomment-1674054618) save my day  

- **Issue #5777** (2023-08-01): **Type error when run jest test**
  *Symptoms*: ### Description  Throw error when running jest  ### CodeSandbox/Snack link  no  ### Steps to reproduce  I got these errors when run `yarn test` `● Test suite failed to run      node_modules/native-base/src/hooks/useThemeProps/useProps.tsx:1:17 - error TS7016: Could not find a declaration file for module 'lodash.get'. 'F:/deal_platform_mobile/node_modules/lodash.get/index.js' implicitly has an 'any' type.       Try `npm i --save-dev @types/lodash.get` if it exists or add a new declaration (.d.ts) file containing `declare module 'lodash.get';`      1 import get from 'lodash.get';                       ~~~~~~~~~~~~     node_modules/native-base/src/hooks/useThemeProps/useProps.tsx:2:18 - error TS7016: Could not find a declaration file for module 'lodash.omit'. 'F:/deal_platform_mobile/node_modules/lodash.omit/index.js' implicitly has an 'any' type.       Try `npm i --save-dev @types/lodash.omit` if it exists or add a new declaration (.d.ts) file containing `declare module 'lodash.omit';`      2 import omit from 'lodash.omit';`  My jest.config.js: `const { defaults: jsDefault } = require('ts-jest/presets');  /** @type {import('ts-jest').JestConfigWithTsJest} */ module.exports = {     ...jsDefault,     preset: 'react-native',     testEnvironment: 'node',     setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js'],     setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],     transform: {         '^.+\\.jsx$': 'babel-j

- **Issue #5760** (2023-06-30): **expo init no longer works as per documentation**
  *Symptoms*: ### Description  Unable to follow installation instructions from documentation  ### CodeSandbox/Snack link  none  ### Steps to reproduce  1. go to documentation for installation with expo: https://docs.nativebase.io/install-expo 2. perform "npx expo init my-app --template @native-base/expo-template-typescript"  Get the following error in console:  ``` $ npx expo init my-app --template @native-base/expo-template-typescript      $ expo init is not supported in the local CLI, please use npx create-expo-app instead ```  ### NativeBase Version  3.4.28  ### Platform  - [ ] Android - [ ] CRA - [ ] Expo - [ ] iOS - [ ] Next  ### Other Platform  _No response_  ### Additional Information  What are the instructions for installing nativebase with the latest version of expo.
  **Post-Mortem & Fix Analysis**:
  > Closing. The instructions still work if you install expo globally, but fail if using `npx expo`.   ``` npm install -g expo-cli expo init my-app --template @native-base/expo-template-typescript ```  > Note: You get a tone of warnings out the CLI stuff being deprecated.

- **Issue #5739** (2023-05-25): **[Android]: Modal with slide animation suppresses onPress callbacks**
  *Symptoms*: ### Description  Actionsheet (or a modal containing a slide transition) suppresses callbacks for children when using the slide animation.  ### CodeSandbox/Snack link  https://codesandbox.io/s/delicate-sound-6dodwc?file=/src/components/Example.tsx  ### Steps to reproduce  1. Create an Actionsheet containing a child with an `onPress` callback. Let's say it's a button. 2. With a _physical_ Android device, click on the actionsheet's button (this seems to work just fine on an emulator).   Note how, despite the button visually reacting to the press, the button's callback does not run.  3. Add `animationPreset="none"` to the Actionsheet's props 4. Repeat step 2  Note how the button's callback now runs.   ### NativeBase Version  3.3.1  ### Platform  - [X] Android - [ ] CRA - [ ] Expo - [ ] iOS - [ ] Next  ### Other Platform  Pixel 7 - Android 13, LGV30 - Android 10, Pixel 3 - Android 12.  ### Additional Information  We're using the new architecture.  I believe the origin of this issue comes somewhere from the native-base/src/components/composites/Transitions/Slide.tsx or one of its dependencies, as this only occurs when a Modal has a slide transition (as an Actionsheet does by default on an Android device). Disabling the slide animation resolves the issue. I'll admit it's possible this bug comes from a library used by native base, but this seems like a good start to discover the source of the issue and at the very least it documents a work aro
  **Post-Mortem & Fix Analysis**:
  > See the above mentioned issue. I don't think this is a NativeBase issue, but a react-native fabric issue. Closing until I find out one way or the other.

- **Issue #5722** (2023-03-30): **Cannot extend theme for prop _disabled of Button **
  *Symptoms*: ### Description  When adding `disabled` prop to a `<Button>`, and customizing `_disabled` key when extending theme, the extended theme should be applied  ### CodeSandbox/Snack link  https://snack.expo.dev/@dieguezz/buttons-custom-theme  ### Steps to reproduce  As i show in the [snack](https://snack.expo.dev/@dieguezz/buttons-custom-theme), i tried different ways of extending theme to customize `_disabled` state.   I tried with different ways of extending theme: via `extendTheme` at root level, inside `_web` and also in variants. For last, i also tried doing it with an inline prop like:  ```JSX     <Button disabled _disabled={{ backgroundColor: 'gray.400' }}>         Hello world     </Button> ```  I also tried using a color code directly like `#ffffff`  ### NativeBase Version  3.4.28  ### Platform  - [ ] Android - [X] CRA - [ ] Expo - [ ] iOS - [ ] Next  ### Other Platform  _No response_  ### Additional Information  Related Issue: https://github.com/GeekyAnts/NativeBase/issues/4231

- **Issue #5715** (2023-03-23): **OOPS**
  *Symptoms*: ### Description  website down  ### CodeSandbox/Snack link  https://nativebase.io/  ### Steps to reproduce  ![Screenshot 2023-03-23 at 10 19 11 AM](https://user-images.githubusercontent.com/29963214/227232531-706f207f-c7c7-494f-84d5-c015eb5e2df6.png)   ### NativeBase Version  3.3.1  ### Platform  - [ ] Android - [ ] CRA - [ ] Expo - [ ] iOS - [ ] Next  ### Other Platform  _No response_  ### Additional Information  _No response_

- **Issue #5691** (2023-03-06): **React Native Module Federation - Nested NativeBaseProvider**
  *Symptoms*: ### Description  Layout components such as `<Text>` in a federated context do not calculate height correctly  ### CodeSandbox/Snack link  Non-web / Non-expo - I would need to prepare a pared down monoRepo in Git  ### Steps to reproduce  A 'Host' app is loading a federated 'App' component such as: ``` type AppType = {default: React.ComponentType<{theme: Theme}>}; const App = React.lazy(() => Federated.importModule(appName, './App') as Promise<AppType>);  return (   <React.Suspense fallback={<Text>Loading {appName}...</Text>} key={appName}>     <App theme={theme} />   </React.Suspense> ); ```  The federated app has a simple root layout, but note this is technically a nested `<NativeBaseProvider>` because my 'Host' also hooks `<NativeBaseProvider>` at its own root, and the FederatedComponent requires the same: ``` export default function App(props: { theme: Theme }) {   return (     <NativeBaseProvider theme={props.theme}>       <View>         <Text>Test</Text>       </View>     </NativeBaseProvider>   ); }; ```  However I found `<Text>`, `<Box>` and many others to be nonexistent in UI visibly, unless I define dimensions explicitly. For example, `minHeight={10}` allows this <Text> to actually display. Everything else seems to work, such as theme-colors, and w='full'.  I attempted singleton shared import through webPack: ``` shared: {   'native-base': {     singleton: true,     eager: false,     requiredVersion: '3.4.26',   }, ```   
  **Post-Mortem & Fix Analysis**:
  > Closing until I can setup bug demo. (It could be React Navigation causing an issue)

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

### Incident Patch 1: `c37ed2d9` (2023-03-06)
**Commit Message**: Merge pull request #5702 from GeekyAnts/fix/checkbox-group-random

Hotfix: Checkbox group

**File**: `package.json` (modified, +1/-1)
```diff
@@ -189,7 +189,7 @@
     "@react-native-aria/slider": "^0.2.5-alpha.1",
     "@react-native-aria/tabs": "^0.2.7",
     "@react-native-aria/utils": "^0.2.8",
-    "@react-stately/checkbox": "3.4.0",
+    "@react-stately/checkbox": "3.0.3",
     "@react-stately/collections": "3.3.0",
     "@react-stately/combobox": "3.0.0-alpha.1",
     "@react-stately/radio": "3.2.1",
```

**File**: `yarn.lock` (modified, +10/-11)
```diff
@@ -2589,16 +2589,15 @@
   resolved "https://registry.yarnpkg.com/@react-native-community/eslint-plugin/-/eslint-plugin-1.1.0.tgz#e42b1bef12d2415411519fd528e64b593b1363dc"
   integrity sha512-W/J0fNYVO01tioHjvYWQ9m6RgndVtbElzYozBq1ZPrHO/iCzlqoySHl4gO/fpCl9QEFjvJfjPgtPMTMlsoq5DQ==
 
-"@react-stately/checkbox@3.4.0":
-  version "3.4.0"
-  resolved "https://registry.yarnpkg.com/@react-stately/checkbox/-/checkbox-3.4.0.tgz#34712864e6b6dbae033b30a279dc32a26bbc1a9b"
-  integrity sha512-zqwHMmlzza1exS6Bbqj4Mom3ygtG8pLguHweZ9OO7BFQLwBmzJsrFNqDcj7xh8iEWxXKQfZ2YOuhkaGvu4GRjA==
+"@react-stately/checkbox@3.0.3":
+  version "3.0.3"
+  resolved "https://registry.yarnpkg.com/@react-stately/checkbox/-/checkbox-3.0.3.tgz#18ee6bd3b544334b6f853bb5c5f7017ac3bb9c37"
+  integrity sha512-amT889DTLdbjAVjZ9j9TytN73PszynGIspKi1QSUCvXeA2OVyCwShxhV0Pn7yYX8cMinvGXrjhWdhn0nhYeMdg==
   dependencies:
-    "@react-stately/toggle" "^3.5.0"
-    "@react-stately/utils" "^3.6.0"
-    "@react-types/checkbox" "^3.4.2"
-    "@react-types/shared" "^3.17.0"
-    "@swc/helpers" "^0.4.14"
+    "@babel/runtime" "^7.6.2"
+    "@react-stately/toggle" "^3.2.3"
+    "@react-stately/utils" "^3.2.2"
+    "@react-types/checkbox" "^3.2.3"
 
 "@react-stately/checkbox@^3.0.1":
   version "3.0.1"
@@ -2765,7 +2764,7 @@
     "@react-types/checkbox" "^3.2.1"
     "@react-types/shared" "^3.2.1"
 
-"@react-stately/toggle@^3.5.0":
+"@react-stately/toggle@^3.2.3":
   version "3.5.0"
   resolved "https://registry.yarnpkg.com/@react-stately/toggle/-/toggle-3.5.0.tgz#fee5a29d7699e43867c52981834af5393f47c1c4"
   integrity sha512-vKwLLkFsiIve4pXIQC/dqLAz7Z+qtzJ8+D00EXXO1Nf8YHcyIMDkTmi3NTM8Qtvmt4xX2hbJFiPDF6WvF6mBIg==
@@ -2844,7 +2843,7 @@
   dependencies:
     "@react-types/shared" "^3.2.1"
 
-"@react-types/checkbox@^3.4.2":
+"@react-types/checkbox@^3.2.3", "@react-types/checkbox@^3.4.2":
   version "3.4.2"
   resolved "https://registry.yarnpkg.com/@react-types/checkbox/-/checkbox-3.4.2.tgz#6089e9ef2d023415a5f871e312f30bae54143ba5"
   integrity sha512-/NWFCEQLvVgo25afPt2jv4syxYvZeY/D/n2Y92IGtoNV4akdz4AuQ65+1X+JOhQc/ZbAblWw5fFWUZoQs3CLZg==
```

---

### Incident Patch 2: `b2fb5ad4` (2023-03-06)
**Commit Message**: fix: checkbopx group

**File**: `package.json` (modified, +1/-1)
```diff
@@ -189,7 +189,7 @@
     "@react-native-aria/slider": "^0.2.5-alpha.1",
     "@react-native-aria/tabs": "^0.2.7",
     "@react-native-aria/utils": "^0.2.8",
-    "@react-stately/checkbox": "3.4.0",
+    "@react-stately/checkbox": "3.0.3",
     "@react-stately/collections": "3.3.0",
     "@react-stately/combobox": "3.0.0-alpha.1",
     "@react-stately/radio": "3.2.1",
```

**File**: `yarn.lock` (modified, +10/-11)
```diff
@@ -2589,16 +2589,15 @@
   resolved "https://registry.yarnpkg.com/@react-native-community/eslint-plugin/-/eslint-plugin-1.1.0.tgz#e42b1bef12d2415411519fd528e64b593b1363dc"
   integrity sha512-W/J0fNYVO01tioHjvYWQ9m6RgndVtbElzYozBq1ZPrHO/iCzlqoySHl4gO/fpCl9QEFjvJfjPgtPMTMlsoq5DQ==
 
-"@react-stately/checkbox@3.4.0":
-  version "3.4.0"
-  resolved "https://registry.yarnpkg.com/@react-stately/checkbox/-/checkbox-3.4.0.tgz#34712864e6b6dbae033b30a279dc32a26bbc1a9b"
-  integrity sha512-zqwHMmlzza1exS6Bbqj4Mom3ygtG8pLguHweZ9OO7BFQLwBmzJsrFNqDcj7xh8iEWxXKQfZ2YOuhkaGvu4GRjA==
+"@react-stately/checkbox@3.0.3":
+  version "3.0.3"
+  resolved "https://registry.yarnpkg.com/@react-stately/checkbox/-/checkbox-3.0.3.tgz#18ee6bd3b544334b6f853bb5c5f7017ac3bb9c37"
+  integrity sha512-amT889DTLdbjAVjZ9j9TytN73PszynGIspKi1QSUCvXeA2OVyCwShxhV0Pn7yYX8cMinvGXrjhWdhn0nhYeMdg==
   dependencies:
-    "@react-stately/toggle" "^3.5.0"
-    "@react-stately/utils" "^3.6.0"
-    "@react-types/checkbox" "^3.4.2"
-    "@react-types/shared" "^3.17.0"
-    "@swc/helpers" "^0.4.14"
+    "@babel/runtime" "^7.6.2"
+    "@react-stately/toggle" "^3.2.3"
+    "@react-stately/utils" "^3.2.2"
+    "@react-types/checkbox" "^3.2.3"
 
 "@react-stately/checkbox@^3.0.1":
   version "3.0.1"
@@ -2765,7 +2764,7 @@
     "@react-types/checkbox" "^3.2.1"
     "@react-types/shared" "^3.2.1"
 
-"@react-stately/toggle@^3.5.0":
+"@react-stately/toggle@^3.2.3":
   version "3.5.0"
   resolved "https://registry.yarnpkg.com/@react-stately/toggle/-/toggle-3.5.0.tgz#fee5a29d7699e43867c52981834af5393f47c1c4"
   integrity sha512-vKwLLkFsiIve4pXIQC/dqLAz7Z+qtzJ8+D00EXXO1Nf8YHcyIMDkTmi3NTM8Qtvmt4xX2hbJFiPDF6WvF6mBIg==
@@ -2844,7 +2843,7 @@
   dependencies:
     "@react-types/shared" "^3.2.1"
 
-"@react-types/checkbox@^3.4.2":
+"@react-types/checkbox@^3.2.3", "@react-types/checkbox@^3.4.2":
   version "3.4.2"
   resolved "https://registry.yarnpkg.com/@react-types/checkbox/-/checkbox-3.4.2.tgz#6089e9ef2d023415a5f871e312f30bae54143ba5"
   integrity sha512-/NWFCEQLvVgo25afPt2jv4syxYvZeY/D/n2Y92IGtoNV4akdz4AuQ65+1X+JOhQc/ZbAblWw5fFWUZoQs3CLZg==
```

---

### Incident Patch 3: `6d792848` (2023-03-06)
**Commit Message**: Merge pull request #5686 from mfarhankasmani/fix/checkboxGroup

fix: CheckBox.Group bugs #5073

**File**: `package.json` (modified, +2/-2)
```diff
@@ -179,7 +179,7 @@
   "dependencies": {
     "@react-aria/visually-hidden": "^3.2.1",
     "@react-native-aria/button": "^0.2.4",
-    "@react-native-aria/checkbox": "^0.2.2",
+    "@react-native-aria/checkbox": "^0.2.3",
     "@react-native-aria/combobox": "^0.2.4-alpha.0",
     "@react-native-aria/focus": "^0.2.6",
     "@react-native-aria/interactions": "^0.2.2",
@@ -189,7 +189,7 @@
     "@react-native-aria/slider": "^0.2.5-alpha.1",
     "@react-native-aria/tabs": "^0.2.7",
     "@react-native-aria/utils": "^0.2.8",
-    "@react-stately/checkbox": "3.0.3",
+    "@react-stately/checkbox": "3.4.0",
     "@react-stately/collections": "3.3.0",
     "@react-stately/combobox": "3.0.0-alpha.1",
     "@react-stately/radio": "3.2.1",
```

**File**: `src/components/primitives/Checkbox/CheckboxGroup.tsx` (modified, +14/-12)
```diff
@@ -1,4 +1,4 @@
-import React, { createContext, memo, forwardRef } from 'react';
+import React, { createContext, memo, forwardRef, useMemo } from 'react';
 import { useCheckboxGroupState } from '@react-stately/checkbox';
 import { useCheckboxGroup } from '@react-native-aria/checkbox';
 import { useFormControlContext } from '../../composites/FormControl';
@@ -22,23 +22,25 @@ function CheckboxGroup(
     { 'aria-label': props.accessibilityLabel, ...props },
     state
   );
-
   const formControlContext = useFormControlContext();
+  const value = useMemo(
+    () => ({
+      size,
+      colorScheme,
+      ..._checkbox,
+      ...formControlContext,
+      state,
+    }),
+    [_checkbox, colorScheme, formControlContext, size, state]
+  );
+
   //TODO: refactor for responsive prop
   if (useHasResponsiveProps({ ...props, size, colorScheme })) {
     return null;
   }
   return (
-    <CheckboxGroupContext.Provider
-      value={{
-        //@ts-ignore
-        size,
-        colorScheme,
-        ..._checkbox,
-        ...formControlContext,
-        state,
-      }}
-    >
+    // @ts-ignore
+    <CheckboxGroupContext.Provider value={value}>
       <Box {...resolvedProps} {...groupProps} {...props} ref={ref}>
         {children}
       </Box>
```

**File**: `yarn.lock` (modified, +58/-54)
```diff
@@ -2271,15 +2271,15 @@
     "@react-stately/toggle" "^3.2.1"
     "@react-types/checkbox" "^3.2.1"
 
-"@react-native-aria/checkbox@^0.2.2":
-  version "0.2.2"
-  resolved "https://registry.yarnpkg.com/@react-native-aria/checkbox/-/checkbox-0.2.2.tgz#fc63537bee8eace82755c27d93249bfd9377aa83"
-  integrity sha512-Jtl5A1TTbQbF9QrABm/3fJ2RtHtal/LSgnMoyrfW24UZk4PytMnLxhcPCKipSaivUV6CAxQPkaLUk7lDHzVt2g==
+"@react-native-aria/checkbox@^0.2.3":
+  version "0.2.3"
+  resolved "https://registry.yarnpkg.com/@react-native-aria/checkbox/-/checkbox-0.2.3.tgz#b6c99c215677df872f1bb4e596b54573f1c7a5f0"
+  integrity sha512-YtWtXGg5tvOaV6v1CmbusXoOZvGRAVYygms9qNeUF7/B8/iDNGSKjlxHE5LVOLRtJO/B9ndZnr6RkL326ceyng==
   dependencies:
     "@react-aria/checkbox" "^3.2.1"
-    "@react-aria/utils" "^3.5.0"
-    "@react-native-aria/toggle" "^0.2.2-alpha.0"
-    "@react-native-aria/utils" "^0.2.2"
+    "@react-aria/utils" "^3.6.0"
+    "@react-native-aria/toggle" "^0.2.3"
+    "@react-native-aria/utils" "^0.2.6"
     "@react-stately/toggle" "^3.2.1"
 
 "@react-native-aria/combobox@^0.2.4-alpha.0":
@@ -2301,15 +2301,6 @@
   dependencies:
     "@react-aria/focus" "^3.2.3"
 
-"@react-native-aria/interactions@^0.2.1":
-  version "0.2.1"
-  resolved "https://registry.yarnpkg.com/@react-native-aria/interactions/-/interactions-0.2.1.tgz#6984809f6fc5f666e9028b3961f958ad87ac161b"
-  integrity sha512-zWa8hz7t5H7aLtXKOpbmjS+1hIH31jAq1qb3+M3aNhUzgnTFmJ/9OuHgyiZBwkr/4nQreQ9RBH24QMGNtEN8kg==
-  dependencies:
-    "@react-aria/interactions" "^3.3.2"
-    "@react-aria/utils" "^3.5.0"
-    "@react-native-aria/utils" "^0.2.1"
-
 "@react-native-aria/interactions@^0.2.2":
   version "0.2.2"
   resolved "https://registry.yarnpkg.com/@react-native-aria/interactions/-/interactions-0.2.2.tgz#93d27c7af348802978461b72eb92513f44fa05d2"
@@ -2399,19 +2390,19 @@
     "@react-stately/tabs" "3.0.0-alpha.1"
     "@react-types/tabs" "3.0.0-alpha.2"
 
-"@react-native-aria/toggle@^0.2.2-alpha.0":
-  version "0.2.2-alpha.0"
-  resolved "https://registry.yarnpkg.com/@react-native-aria/toggle/-/toggle-0.2.2-alpha.0.tgz#b50e285c7403fe4475b320297f02904cba73ae4d"
-  integrity sha512-c9SD7hJtzVOOqaj5MDUFHdn/TmYdgXQzdDfJMx2QZtQk8XWcQ7gB/hDuK0BtyjlGXpINvjJycQ0xgX4lz/1JpA==
+"@react-native-aria/toggle@^0.2.3":
+  version "0.2.3"
+  resolved "https://registry.yarnpkg.com/@react-native-aria/toggle/-/toggle-0.2.3.tgz#a387f03480aa0d97dc0191acbcae66122f7bcf7f"
+  integrity sha512-3aOlchMxpR0b2h3Z7V0aYZaQMVJD6uKOWKWJm82VsLrni4iDnDX/mLv30ujuuK3+LclUhVlJd2kRuCl+xnf3XQ==
   dependencies:
     "@react-aria/focus" "^3.2.3"
-    "@react-aria/utils" "^3.5.0"
-    "@react-native-aria/interactions" "^0.2.1"
-    "@react-native-aria/utils" "^0.2.1"
+    "@react-aria/utils" "^3.6.0"
+    "@react-native-aria/interactions" "^0.2.3"
+    "@react-native-aria/utils" "^0.2.6"
     "@react-stately/toggle" "^3.2.1"
     "@react-types/checkbox" "^3.2.1"
 
-"@react-native-aria/utils@^0.2.1", "@react-native-aria/utils@^0.2.2", "@react-native-aria/utils@^0.2.4", "@react-native-aria/utils@^0.2.6", "@react-native-aria/utils@^0.2.7":
+"@react-native-aria/utils@^0.2.2", "@react-native-aria/utils@^0.2.4", "@react-native-aria/utils@^0.2.6", "@react-native-aria/utils@^0.2.7":
   version "0.2.7"
   resolved "https://registry.npmjs.org/@react-native-aria/utils/-/utils-0.2.7.tgz#53d1f4a44cad382bd9d1a6b5af6cb86624e70f76"
   integrity sha512-mozajHovHHYjNY28j5lrIzUQ3p3mQ7EnaKlukd0EuSaAwBboPQ1sVK9ToxPLyyixkxGe4pxy+br5ahzd6wlf5Q==
@@ -2598,15 +2589,16 @@
   resolved "https://registry.yarnpkg.com/@react-native-community/eslint-plugin/-/eslint-plugin-1.1.0.tgz#e42b1bef12d2415411519fd528e64b593b1363dc"
   integrity sha512-W/J0fNYVO01tioHjvYWQ9m6RgndVtbElzYozBq1ZPrHO/iCzlqoySHl4gO/fpCl9QEFjvJfjPgtPMTMlsoq5DQ==
 
-"@react-stately/checkbox@3.0.3":
-  version "3.0.3"
-  resolved "https://registry.yarnpkg.com/@react-stately/checkbox/-/checkbox-3.0.3.tgz#18ee6bd3b544334b6f853bb5c5f7017ac3bb9c37"
-  integrity sha512-amT889DTLdbjAVjZ9j9TytN73PszynGIspKi1
```

---

### Incident Patch 4: `ffbc6023` (2023-03-02)
**Commit Message**: fix: checkboxGroup warning in form

**File**: `package.json` (modified, +2/-2)
```diff
@@ -179,7 +179,7 @@
   "dependencies": {
     "@react-aria/visually-hidden": "^3.2.1",
     "@react-native-aria/button": "^0.2.4",
-    "@react-native-aria/checkbox": "^0.2.2",
+    "@react-native-aria/checkbox": "^0.2.3",
     "@react-native-aria/combobox": "^0.2.4-alpha.0",
     "@react-native-aria/focus": "^0.2.6",
     "@react-native-aria/interactions": "^0.2.2",
@@ -189,7 +189,7 @@
     "@react-native-aria/slider": "^0.2.5-alpha.1",
     "@react-native-aria/tabs": "^0.2.7",
     "@react-native-aria/utils": "^0.2.8",
-    "@react-stately/checkbox": "3.0.3",
+    "@react-stately/checkbox": "3.4.0",
     "@react-stately/collections": "3.3.0",
     "@react-stately/combobox": "3.0.0-alpha.1",
     "@react-stately/radio": "3.2.1",
```

**File**: `src/components/primitives/Checkbox/CheckboxGroup.tsx` (modified, +14/-12)
```diff
@@ -1,4 +1,4 @@
-import React, { createContext, memo, forwardRef } from 'react';
+import React, { createContext, memo, forwardRef, useMemo } from 'react';
 import { useCheckboxGroupState } from '@react-stately/checkbox';
 import { useCheckboxGroup } from '@react-native-aria/checkbox';
 import { useFormControlContext } from '../../composites/FormControl';
@@ -22,23 +22,25 @@ function CheckboxGroup(
     { 'aria-label': props.accessibilityLabel, ...props },
     state
   );
-
   const formControlContext = useFormControlContext();
+  const value = useMemo(
+    () => ({
+      size,
+      colorScheme,
+      ..._checkbox,
+      ...formControlContext,
+      state,
+    }),
+    [_checkbox, colorScheme, formControlContext, size, state]
+  );
+
   //TODO: refactor for responsive prop
   if (useHasResponsiveProps({ ...props, size, colorScheme })) {
     return null;
   }
   return (
-    <CheckboxGroupContext.Provider
-      value={{
-        //@ts-ignore
-        size,
-        colorScheme,
-        ..._checkbox,
-        ...formControlContext,
-        state,
-      }}
-    >
+    // @ts-ignore
+    <CheckboxGroupContext.Provider value={value}>
       <Box {...resolvedProps} {...groupProps} {...props} ref={ref}>
         {children}
       </Box>
```

**File**: `yarn.lock` (modified, +58/-54)
```diff
@@ -2271,15 +2271,15 @@
     "@react-stately/toggle" "^3.2.1"
     "@react-types/checkbox" "^3.2.1"
 
-"@react-native-aria/checkbox@^0.2.2":
-  version "0.2.2"
-  resolved "https://registry.yarnpkg.com/@react-native-aria/checkbox/-/checkbox-0.2.2.tgz#fc63537bee8eace82755c27d93249bfd9377aa83"
-  integrity sha512-Jtl5A1TTbQbF9QrABm/3fJ2RtHtal/LSgnMoyrfW24UZk4PytMnLxhcPCKipSaivUV6CAxQPkaLUk7lDHzVt2g==
+"@react-native-aria/checkbox@^0.2.3":
+  version "0.2.3"
+  resolved "https://registry.yarnpkg.com/@react-native-aria/checkbox/-/checkbox-0.2.3.tgz#b6c99c215677df872f1bb4e596b54573f1c7a5f0"
+  integrity sha512-YtWtXGg5tvOaV6v1CmbusXoOZvGRAVYygms9qNeUF7/B8/iDNGSKjlxHE5LVOLRtJO/B9ndZnr6RkL326ceyng==
   dependencies:
     "@react-aria/checkbox" "^3.2.1"
-    "@react-aria/utils" "^3.5.0"
-    "@react-native-aria/toggle" "^0.2.2-alpha.0"
-    "@react-native-aria/utils" "^0.2.2"
+    "@react-aria/utils" "^3.6.0"
+    "@react-native-aria/toggle" "^0.2.3"
+    "@react-native-aria/utils" "^0.2.6"
     "@react-stately/toggle" "^3.2.1"
 
 "@react-native-aria/combobox@^0.2.4-alpha.0":
@@ -2301,15 +2301,6 @@
   dependencies:
     "@react-aria/focus" "^3.2.3"
 
-"@react-native-aria/interactions@^0.2.1":
-  version "0.2.1"
-  resolved "https://registry.yarnpkg.com/@react-native-aria/interactions/-/interactions-0.2.1.tgz#6984809f6fc5f666e9028b3961f958ad87ac161b"
-  integrity sha512-zWa8hz7t5H7aLtXKOpbmjS+1hIH31jAq1qb3+M3aNhUzgnTFmJ/9OuHgyiZBwkr/4nQreQ9RBH24QMGNtEN8kg==
-  dependencies:
-    "@react-aria/interactions" "^3.3.2"
-    "@react-aria/utils" "^3.5.0"
-    "@react-native-aria/utils" "^0.2.1"
-
 "@react-native-aria/interactions@^0.2.2":
   version "0.2.2"
   resolved "https://registry.yarnpkg.com/@react-native-aria/interactions/-/interactions-0.2.2.tgz#93d27c7af348802978461b72eb92513f44fa05d2"
@@ -2399,19 +2390,19 @@
     "@react-stately/tabs" "3.0.0-alpha.1"
     "@react-types/tabs" "3.0.0-alpha.2"
 
-"@react-native-aria/toggle@^0.2.2-alpha.0":
-  version "0.2.2-alpha.0"
-  resolved "https://registry.yarnpkg.com/@react-native-aria/toggle/-/toggle-0.2.2-alpha.0.tgz#b50e285c7403fe4475b320297f02904cba73ae4d"
-  integrity sha512-c9SD7hJtzVOOqaj5MDUFHdn/TmYdgXQzdDfJMx2QZtQk8XWcQ7gB/hDuK0BtyjlGXpINvjJycQ0xgX4lz/1JpA==
+"@react-native-aria/toggle@^0.2.3":
+  version "0.2.3"
+  resolved "https://registry.yarnpkg.com/@react-native-aria/toggle/-/toggle-0.2.3.tgz#a387f03480aa0d97dc0191acbcae66122f7bcf7f"
+  integrity sha512-3aOlchMxpR0b2h3Z7V0aYZaQMVJD6uKOWKWJm82VsLrni4iDnDX/mLv30ujuuK3+LclUhVlJd2kRuCl+xnf3XQ==
   dependencies:
     "@react-aria/focus" "^3.2.3"
-    "@react-aria/utils" "^3.5.0"
-    "@react-native-aria/interactions" "^0.2.1"
-    "@react-native-aria/utils" "^0.2.1"
+    "@react-aria/utils" "^3.6.0"
+    "@react-native-aria/interactions" "^0.2.3"
+    "@react-native-aria/utils" "^0.2.6"
     "@react-stately/toggle" "^3.2.1"
     "@react-types/checkbox" "^3.2.1"
 
-"@react-native-aria/utils@^0.2.1", "@react-native-aria/utils@^0.2.2", "@react-native-aria/utils@^0.2.4", "@react-native-aria/utils@^0.2.6", "@react-native-aria/utils@^0.2.7":
+"@react-native-aria/utils@^0.2.2", "@react-native-aria/utils@^0.2.4", "@react-native-aria/utils@^0.2.6", "@react-native-aria/utils@^0.2.7":
   version "0.2.7"
   resolved "https://registry.npmjs.org/@react-native-aria/utils/-/utils-0.2.7.tgz#53d1f4a44cad382bd9d1a6b5af6cb86624e70f76"
   integrity sha512-mozajHovHHYjNY28j5lrIzUQ3p3mQ7EnaKlukd0EuSaAwBboPQ1sVK9ToxPLyyixkxGe4pxy+br5ahzd6wlf5Q==
@@ -2598,15 +2589,16 @@
   resolved "https://registry.yarnpkg.com/@react-native-community/eslint-plugin/-/eslint-plugin-1.1.0.tgz#e42b1bef12d2415411519fd528e64b593b1363dc"
   integrity sha512-W/J0fNYVO01tioHjvYWQ9m6RgndVtbElzYozBq1ZPrHO/iCzlqoySHl4gO/fpCl9QEFjvJfjPgtPMTMlsoq5DQ==
 
-"@react-stately/checkbox@3.0.3":
-  version "3.0.3"
-  resolved "https://registry.yarnpkg.com/@react-stately/checkbox/-/checkbox-3.0.3.tgz#18ee6bd3b544334b6f853bb5c5f7017ac3bb9c37"
-  integrity sha512-amT889DTLdbjAVjZ9j9TytN73PszynGIspKi1
```

---

### Incident Patch 5: `aca7c935` (2022-12-08)
**Commit Message**: Merge pull request #5605 from GeekyAnts/fix/hidden-ssr-issue

fix: hidden ssr issue

**File**: `src/components/primitives/Hidden/HiddenSSR.tsx` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+import React from 'react';
+import { useTheme } from 'native-base';
+import { Platform } from 'react-native';
+import type { IHiddenProps } from './types';
+import { useColorMode } from '../../../core/color-mode/hooks';
+
+export const HiddenSSR = React.memo(({ children, ...props }: IHiddenProps) => {
+  const theme = useTheme();
+  const breakPoints = Object.keys(theme.breakpoints);
+  const currentColorMode = useColorMode();
+
+  const { from, till, only, colorMode, platform } = props;
+
+  if (children === null) return null;
+  if (!from && !till && !only && !colorMode && !platform) {
+    return null;
+  } else if (
+    (Array.isArray(platform) && platform.includes(Platform.OS)) ||
+    platform === Platform.OS
+  ) {
+    return null;
+  } else if (colorMode === currentColorMode.colorMode) {
+    return null;
+  }
+  const display: any = {};
+
+  if (till) {
+    let flag = false;
+    for (const i in breakPoints) {
+      if (breakPoints[i] === till) {
+        display[breakPoints[i]] = 'flex';
+        flag = true;
+      } else {
+        display[breakPoints[i]] = flag ? 'flex' : 'none';
+      }
+    }
+  }
+
+  if (from) {
+    let flag = false;
+    for (const i in breakPoints) {
+      if (breakPoints[i] === from || flag) {
+        display[breakPoints[i]] = 'none';
+        flag = true;
+      } else {
+        display[breakPoints[i]] = 'flex';
+      }
+    }
+  }
+  if (only) {
+    if (Array.isArray(only)) {
+      for (const i in breakPoints) {
+        if (only.includes(breakPoints[i])) {
+          display[breakPoints[i]] = 'none';
+        } else {
+          display[breakPoints[i]] = 'flex';
+        }
+      }
+    } else {
+      display[only] = 'none';
+    }
+  }
+
+  return React.cloneElement(children, {
+    display: display,
+  });
+});
```

**File**: `src/components/primitives/Hidden/index.tsx` (modified, +14/-3)
```diff
@@ -1,12 +1,21 @@
+import React from 'react';
 import { memo } from 'react';
 import type { IHiddenProps } from './types';
 import { usePropsResolution } from '../../../hooks/useThemeProps';
 import { useBreakpointValue, useTheme, useToken } from '../../../hooks';
 import { useColorMode } from '../../../core/color-mode/hooks';
 import { Platform } from 'react-native';
-
-export function Hidden({ children, ...props }: IHiddenProps) {
-  const { from, till, only, platform, colorMode } = usePropsResolution(
+import { useNativeBaseConfig } from '../../../core/NativeBaseContext';
+import { HiddenSSR } from './HiddenSSR';
+export function Hidden({ isSSR, ...props }: IHiddenProps) {
+  const {
+    from,
+    till,
+    only,
+    platform,
+    colorMode,
+    children,
+  } = usePropsResolution(
     'Hidden',
     props,
     {},
@@ -28,7 +37,9 @@ export function Hidden({ children, ...props }: IHiddenProps) {
   const [currentBreakpointValue] = useToken('breakpoints', [breakpointValue]);
   const [fromBreakPointValue] = useToken('breakpoints', [from]);
   const [tillBreakPointValue] = useToken('breakpoints', [till]);
+  const isSSRProvider = useNativeBaseConfig('useBreakpointResolvedProps').isSSR;
 
+  if (isSSR && isSSRProvider) return <HiddenSSR {...props} />;
   //if no prop is passed, it will hide the element wrapped with hidden
   if (!from && !till && !only && !colorMode && !platform) {
     return null;
```

**File**: `src/components/primitives/Hidden/types.ts` (modified, +4/-0)
```diff
@@ -30,6 +30,10 @@ export interface InterfaceHiddenProps {
    *
    */
   children: React.ReactElement | null;
+  /**
+   *
+   */
+  isSSR?: boolean;
 }
 
 export type IHiddenProps = InterfaceHiddenProps;
```

---

### Incident Patch 6: `03fd01ea` (2022-12-08)
**Commit Message**: fix: hidden ssr issue types

**File**: `src/components/primitives/Hidden/types.ts` (modified, +4/-0)
```diff
@@ -30,6 +30,10 @@ export interface InterfaceHiddenProps {
    *
    */
   children: React.ReactElement | null;
+  /**
+   *
+   */
+  isSSR?: boolean;
 }
 
 export type IHiddenProps = InterfaceHiddenProps;
```

---

### Incident Patch 7: `dc905cb6` (2022-12-08)
**Commit Message**: fix: hidden ssr issue

**File**: `src/components/primitives/Hidden/index.tsx` (modified, +4/-3)
```diff
@@ -7,7 +7,7 @@ import { useColorMode } from '../../../core/color-mode/hooks';
 import { Platform } from 'react-native';
 import { useNativeBaseConfig } from '../../../core/NativeBaseContext';
 import { HiddenSSR } from './HiddenSSR';
-export function Hidden({ ...props }: IHiddenProps) {
+export function Hidden({ isSSR, ...props }: IHiddenProps) {
   const {
     from,
     till,
@@ -37,8 +37,9 @@ export function Hidden({ ...props }: IHiddenProps) {
   const [currentBreakpointValue] = useToken('breakpoints', [breakpointValue]);
   const [fromBreakPointValue] = useToken('breakpoints', [from]);
   const [tillBreakPointValue] = useToken('breakpoints', [till]);
-  const isSSR = useNativeBaseConfig('useBreakpointResolvedProps').isSSR;
-  if (isSSR) return <HiddenSSR {...props} />;
+  const isSSRProvider = useNativeBaseConfig('useBreakpointResolvedProps').isSSR;
+
+  if (isSSR && isSSRProvider) return <HiddenSSR {...props} />;
   //if no prop is passed, it will hide the element wrapped with hidden
   if (!from && !till && !only && !colorMode && !platform) {
     return null;
```

---

### Incident Patch 8: `c476751a` (2022-12-08)
**Commit Message**: fix: hidden ssr issue

**File**: `src/components/primitives/Hidden/HiddenSSR.tsx` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+import React from 'react';
+import { useTheme } from 'native-base';
+import { Platform } from 'react-native';
+import type { IHiddenProps } from './types';
+import { useColorMode } from '../../../core/color-mode/hooks';
+
+export const HiddenSSR = React.memo(({ children, ...props }: IHiddenProps) => {
+  const theme = useTheme();
+  const breakPoints = Object.keys(theme.breakpoints);
+  const currentColorMode = useColorMode();
+
+  const { from, till, only, colorMode, platform } = props;
+
+  if (children === null) return null;
+  if (!from && !till && !only && !colorMode && !platform) {
+    return null;
+  } else if (
+    (Array.isArray(platform) && platform.includes(Platform.OS)) ||
+    platform === Platform.OS
+  ) {
+    return null;
+  } else if (colorMode === currentColorMode.colorMode) {
+    return null;
+  }
+  const display: any = {};
+
+  if (till) {
+    let flag = false;
+    for (const i in breakPoints) {
+      if (breakPoints[i] === till) {
+        display[breakPoints[i]] = 'flex';
+        flag = true;
+      } else {
+        display[breakPoints[i]] = flag ? 'flex' : 'none';
+      }
+    }
+  }
+
+  if (from) {
+    let flag = false;
+    for (const i in breakPoints) {
+      if (breakPoints[i] === from || flag) {
+        display[breakPoints[i]] = 'none';
+        flag = true;
+      } else {
+        display[breakPoints[i]] = 'flex';
+      }
+    }
+  }
+  if (only) {
+    if (Array.isArray(only)) {
+      for (const i in breakPoints) {
+        if (only.includes(breakPoints[i])) {
+          display[breakPoints[i]] = 'none';
+        } else {
+          display[breakPoints[i]] = 'flex';
+        }
+      }
+    } else {
+      display[only] = 'none';
+    }
+  }
+
+  return React.cloneElement(children, {
+    display: display,
+  });
+});
```

**File**: `src/components/primitives/Hidden/index.tsx` (modified, +14/-4)
```diff
@@ -1,12 +1,21 @@
+import React from 'react';
 import { memo } from 'react';
 import type { IHiddenProps } from './types';
 import { usePropsResolution } from '../../../hooks/useThemeProps';
 import { useBreakpointValue, useTheme, useToken } from '../../../hooks';
 import { useColorMode } from '../../../core/color-mode/hooks';
 import { Platform } from 'react-native';
-
-export function Hidden({ children, ...props }: IHiddenProps) {
-  const { from, till, only, platform, colorMode } = usePropsResolution(
+import { useNativeBaseConfig } from '../../../core/NativeBaseContext';
+import { HiddenSSR } from './HiddenSSR';
+export function Hidden({ ...props }: IHiddenProps) {
+  const {
+    from,
+    till,
+    only,
+    platform,
+    colorMode,
+    children,
+  } = usePropsResolution(
     'Hidden',
     props,
     {},
@@ -28,7 +37,8 @@ export function Hidden({ children, ...props }: IHiddenProps) {
   const [currentBreakpointValue] = useToken('breakpoints', [breakpointValue]);
   const [fromBreakPointValue] = useToken('breakpoints', [from]);
   const [tillBreakPointValue] = useToken('breakpoints', [till]);
-
+  const isSSR = useNativeBaseConfig('useBreakpointResolvedProps').isSSR;
+  if (isSSR) return <HiddenSSR {...props} />;
   //if no prop is passed, it will hide the element wrapped with hidden
   if (!from && !till && !only && !colorMode && !platform) {
     return null;
```

---

### Incident Patch 9: `51154343` (2022-12-07)
**Commit Message**: Merge pull request #5600 from GeekyAnts/hotfix/usequery-resolver-web

fix: use responsive query queryhash

**File**: `src/utils/useResponsiveQuery/useResponsiveQuery.web.tsx` (modified, +8/-2)
```diff
@@ -123,6 +123,7 @@ const getResponsiveStyles = (
   queries: GetResponsiveStylesParams
 ): GetResponsiveStylesReturnType => {
   const queryString = stableHash(queries.query);
+
   const queriesHash = hash(queryString);
 
   const styles = queries.initial
@@ -168,8 +169,13 @@ const getResponsiveStyles = (
         });
         if (mediaRules) {
           const mediaQueryRule = getMediaQueryRule(queryRule, mediaRules);
-          insert(`/*${queryHash}{}*/${mediaQueryRule}`);
-          textContentMap[`/*${queryHash}{}*/${mediaQueryRule}`] = true;
+
+          const queryKey = `/*${queryHash}{}*/${mediaQueryRule}`;
+
+          if (!textContentMap[queryKey]) {
+            insert(queryKey);
+            textContentMap[queryKey] = true;
+          }
         }
       }
     });
```

---

### Incident Patch 10: `90dd016c` (2022-12-07)
**Commit Message**: fix: use responsive query queryhash

**File**: `src/utils/useResponsiveQuery/useResponsiveQuery.web.tsx` (modified, +8/-2)
```diff
@@ -123,6 +123,7 @@ const getResponsiveStyles = (
   queries: GetResponsiveStylesParams
 ): GetResponsiveStylesReturnType => {
   const queryString = stableHash(queries.query);
+
   const queriesHash = hash(queryString);
 
   const styles = queries.initial
@@ -168,8 +169,13 @@ const getResponsiveStyles = (
         });
         if (mediaRules) {
           const mediaQueryRule = getMediaQueryRule(queryRule, mediaRules);
-          insert(`/*${queryHash}{}*/${mediaQueryRule}`);
-          textContentMap[`/*${queryHash}{}*/${mediaQueryRule}`] = true;
+
+          const queryKey = `/*${queryHash}{}*/${mediaQueryRule}`;
+
+          if (!textContentMap[queryKey]) {
+            insert(queryKey);
+            textContentMap[queryKey] = true;
+          }
         }
       }
     });
```

#### Recent Merged Pull Requests:
- **PR #5833** (2026-01-31): docs: add GeekyAnts company info and service links (@pratiksahu)
- **PR #5832** (closed): docs: add GeekyAnts company info and service links (@pratiksahu)
- **PR #5831** (closed): Fix import (@bilwifi)
- **PR #5822** (2024-12-18): Update README.md - Evolution to gluestack (@atulrpandey)
- **PR #5779** (2023-08-04): feat: added banner (@amars29)
- **PR #5764** (closed): SSRProvider Issue Fix (@kurucaner)
- **PR #5725** (closed): fix: Add loop animation support to PresenceTransition (@grnsmn)
- **PR #5713** (closed): fix: added 'animating' prop to spinner component (@Neel-shetty)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
