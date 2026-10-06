# Forensic Learning Record (Deep Inspection): akveo/kittenTricks

> **Canonical Artifact**: `07_PROJECT_LEARNING/akveo-kittentricks-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/akveo/kittenTricks](https://github.com/akveo/kittenTricks))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:17:21.824Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `akveo/kittenTricks`
- **Description**: React Native starter kit with over 40 screens and modern Light and Dark theme for creating stunning cross-platform mobile applications.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7262 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `App.ts`
```
import App from './src/app/app.component';

export default App;

```

### Core Architecture Module: `babel.config.js`
```
const path = require('path');
const env = require('./env');

const frameworkAlias = {
  '@eva-design/dss': path.resolve(env.EVA_PACKAGES_PATH, 'dss'),
  '@eva-design/eva': path.resolve(env.EVA_PACKAGES_PATH, 'eva'),
  '@eva-design/material': path.resolve(env.EVA_PACKAGES_PATH, 'material'),
  '@eva-design/processor': path.resolve(env.EVA_PACKAGES_PATH, 'processor'),
  '@ui-kitten/components': path.resolve(env.UI_KITTEN_PACKAGES_PATH, 'components'),
  '@ui-kitten/date-fns': path.resolve(env.UI_KITTEN_PACKAGES_PATH, 'date-fns'),
  '@ui-kitten/eva-icons': path.resolve(env.UI_KITTEN_PACKAGES_PATH, 'eva-icons'),
  '@ui-kitten/moment': path.resolve(env.UI_KITTEN_PACKAGES_PATH, 'moment'),
};

const frameworkInternalAlias = {
  '@kitten/theme': path.resolve(env.UI_KITTEN_PACKAGES_PATH, 'components/theme'),
  '@kitten/ui': path.resolve(env.UI_KITTEN_PACKAGES_PATH, 'components/ui'),
};

const moduleResolverConfig = {
  root: path.resolve('./'),
  alias: {
    ...frameworkAlias,
    ...frameworkInternalAlias,
  },
};

module.exports = function (api) {
  api.cache(true);

  const presets = [
    'babel-preset-expo',
  ];

  const plugins = [
    ['module-resolver', moduleResolverConfig],
  ];

  return { presets, plugins };
};

```

### Core Architecture Module: `env/env.ci-ui-kitten.js`
```
const path = require('path');

/**
 * Runs on UI Kitten CI
 * https://github.com/akveo/react-native-ui-kitten/blob/master/.github/workflows/publish-kitten-tricks.yml
 */
module.exports = {
  ENV: 'ci-ui-kitten',
  UI_KITTEN_PACKAGES_PATH: path.resolve(__dirname, '../../../src'),
  EVA_PACKAGES_PATH: path.resolve(__dirname, '../../eva/packages'),
};

```

### Core Architecture Module: `env/env.ci.js`
```
const path = require('path');

/**
 * Runs on Kitten Tricks CI
 * https://github.com/akveo/kittenTricks/blob/master/.github/workflows/publish-pr.yml
 */
module.exports = {
  ENV: 'ci',
  UI_KITTEN_PACKAGES_PATH: path.resolve(__dirname, '../packages-ci/react-native-ui-kitten/src'),
  EVA_PACKAGES_PATH: path.resolve(__dirname, '../packages-ci/eva/packages'),
};

```

### Core Architecture Module: `env/env.dev.js`
```
const path = require('path');

module.exports = {
  ENV: 'dev',
  UI_KITTEN_PACKAGES_PATH: path.resolve(__dirname, '../../react-native-ui-kitten/src'),
  EVA_PACKAGES_PATH: path.resolve(__dirname, '../../eva/packages'),
};

```

### Core Architecture Module: `env/env.prod.js`
```
const path = require('path');

module.exports = {
  ENV: 'prod',
  UI_KITTEN_PACKAGES_PATH: path.resolve(__dirname, '../node_modules/@ui-kitten'),
  EVA_PACKAGES_PATH: path.resolve(__dirname, '../node_modules/@eva-design'),
};

```

### Core Architecture Module: `env/set-env.js`
```
const path = require('path');
const fs = require('fs');

const scriptArguments = process.argv.splice(2);
const { [0]: envArgument } = scriptArguments;

const envConfigFile = path.resolve(__dirname, `../env/env.${envArgument}.js`);
const envConfigMainFile = path.resolve(__dirname, `../env/index.js`);

const envTsConfigFile = path.resolve(__dirname, `../env/tsconfig.${envArgument}.json`);
const envTsConfigMainFile = path.resolve(__dirname, `../tsconfig.json`);

fs.copyFileSync(envConfigFile, envConfigMainFile);
fs.copyFileSync(envTsConfigFile, envTsConfigMainFile);


```

### Core Architecture Module: `index.js`
```
import { AppRegistry, Platform } from 'react-native';
import App from './src/app/app.component';

AppRegistry.registerComponent('KittenTricks', () => App);

if (Platform.OS === 'web') {
  const rootTag = document.getElementById('root') || document.getElementById('main');
  AppRegistry.runApplication('KittenTricks', { rootTag });
}

```

### Core Architecture Module: `ios/KittenTricks/AppDelegate.h`
```
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#import <React/RCTBridgeDelegate.h>
#import <UIKit/UIKit.h>

@interface AppDelegate : UIResponder <UIApplicationDelegate, RCTBridgeDelegate>

@property (nonatomic, strong) UIWindow *window;

@end

```

### Core Architecture Module: `ios/Modules/Splash/SplashScreen.h`
```
#import <React/RCTBridgeModule.h>
#import <React/RCTRootView.h>

@interface SplashScreen : NSObject <RCTBridgeModule>

typedef NS_ENUM(NSInteger, RCTCameraAspect) {
  UIAnimationNone = 0,
  UIAnimationFade = 1,
  UIAnimationScale = 2
};

+ (void)open:(RCTRootView *)v;

@end

```

### Core Architecture Module: `metro.config.js`
```
const path = require('path');
const env = require('./env');
const MetroConfig = require('@expo/metro-config');

const defaultConfig = MetroConfig.getDefaultConfig(__dirname);

const appModules = [
  path.resolve(env.EVA_PACKAGES_PATH, 'dss'),
  path.resolve(env.EVA_PACKAGES_PATH, 'eva'),
  path.resolve(env.EVA_PACKAGES_PATH, 'material'),
  path.resolve(env.EVA_PACKAGES_PATH, 'processor'),
  path.resolve(env.UI_KITTEN_PACKAGES_PATH, 'components'),
  path.resolve(env.UI_KITTEN_PACKAGES_PATH, 'date-fns'),
  path.resolve(env.UI_KITTEN_PACKAGES_PATH, 'eva-icons'),
  path.resolve(env.UI_KITTEN_PACKAGES_PATH, 'moment'),
];

const extraNodeModules = {
  '@babel/runtime': path.resolve(__dirname, './node_modules/@babel/runtime'),
  'react': path.resolve(__dirname, './node_modules/react'),
  'react-native': path.resolve(__dirname, './node_modules/react-native'),

  // @ui-kitten/components
  'fecha': path.resolve(__dirname, './node_modules/fecha'),
  'hoist-non-react-statics': path.resolve(__dirname, './node_modules/hoist-non-react-statics'),
  'lodash.merge': path.resolve(__dirname, './node_modules/lodash.merge'),
  'react-native-svg': path.resolve(__dirname, './node_modules/react-native-svg'),

  // @ui-kitten/date-fns
  'date-fns': path.resolve(__dirname, './node_modules/date-fns'),

  // @ui-kitten/eva-icons
  'react-native-eva-icons': path.resolve(__dirname, './node_modules/react-native-eva-icons'),

  // @ui-kitten/moment
  'moment': path.resolve(__dirname, './node_modules/moment'),
  'react-is': path.resolve(__dirname, './node_modules/react-is'),
};

module.exports = {
  ...defaultConfig,
  projectRoot: path.resolve(__dirname),
  resolver: {
    ...defaultConfig.resolver,
    extraNodeModules: {
      ...defaultConfig.extraNodeModules,
      ...extraNodeModules,
    }
  },
  watchFolders: [
    ...defaultConfig.watchFolders,
    ...appModules,
  ],
};

```

### Core Architecture Module: `react-native.config.js`
```
/**
 * https://github.com/react-native-community/cli/blob/master/docs/configuration.md
 */
module.exports = {
  assets: [
    "src/assets/images/*",
    "src/assets/fonts",
    "src/layouts/**/assets/*",
  ],
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #246** (2019-10-16): **Strange behaviour for Button element in ProfilePhoto component**
  *Symptoms*: Hi there!  So far, everything has worked like a charm using this nice starter template! However, I've stumbled upon a strange bug in the ProfilePhoto component that is included in the src/components/social directory. Here, the edit button element that is defined as a prop when using the <ProfilePhoto /> component, is cloned via React.cloneElement(), overridden with style props from within the component class, and then added to the avatar.  **Expected behaviour:**  Button with onPress functionality that works consistently.  **Actual behaviour:**  The button gets rendered, has the styles included and onPress is triggered when pressed. However, after being pressed a first time, it will act in a different way. I've noticed that long-pressing the button, does not keep the color in dark blue anymore. Somehow the press-functionality gets altered. I'm wondering why that is! The consequence: after a first time press, pressing the button does not trigger onPress anymore.  Any suggestions would be of great help!!  All the best,  Pieter
  **Post-Mortem & Fix Analysis**:
  > @pnoyens thanks for reporting this. I've resolved this by changing styles of Button with simply replacing transform styles. This fix will be available soon  ```js photoButton: {     top: 82,     width: 48,     height: 48,     borderRadius: 24, } ```

- **Issue #196** (2019-07-09): **Crashing on fresh install**
  *Symptoms*: <!-- We will close this issue if you don't provide the needed information.  Please remember, the github issues is __NOT__ for support requests and general questions. It is for bugs and feature requests only. Please read https://github.com/akveo/kittenTricks/blob/master/CONTRIBUTING.md and search existing issues (both open and closed) prior to opening any new issue and ensure you follow the instructions therein. -->  ### Issue type  **I'm submitting a ...**  * [x] bug report * [ ] feature request  ### Issue description  **Current behavior:** After installing the dependencies with yarn and then doing a ```yarn start```, the app crashes immediately with the stated error in [this picture](https://imgur.com/vkEHVwX). Apparently, there's a component named 'Themes' that is not being exported correctly.  **Expected behavior:** To be able to see the kittenTricks demo app.  **Steps to reproduce:** Clone the [kittenTricks repository](https://github.com/akveo/kittenTricks); install dependencies; run the project.  
  **Post-Mortem & Fix Analysis**:
  > Experiencing exactly the same behavior over here.
  > Got it reproduced. Thanks for report
  > Version https://github.com/akveo/kittenTricks/commit/50c89c8cedd30cf872620b45c4cc79dd6259ce6e run ok 

- **Issue #183** (2019-06-19): **Layout: fix auth containers**
  *Symptoms*: Prevent container bounces on Auth layouts

- **Issue #182** (2020-01-13): **Fix text font on Android**
  *Symptoms*: Reported in #181
  **Post-Mortem & Fix Analysis**:
  > Maybe, this is react native issue and I have some information about this, why this is happing..  If Text component has bold CSS property without any default font family and view flex direction row then this is happy because some Android phones forcefully applying your phone UI default theme like OOPO and Vivo. I have to face the same issue with my app.  Check this time 53:06 [link](https://youtu.be/TItz1PZo7Fs)
  > Thank you for the video @IAmAbhishekTomar 👍 
  > Same issue with Facebook market place. ![C615C07D-E13B-4903-9231-5534646B2DDC](https://user-images.githubusercontent.com/6933841/59761534-ab347600-92c7-11e9-8f81-cf574ea6d732.jpeg) ![3687619A-F262-4F3C-9BF7-90D39E3DFBD8](https://user-images.githubusercontent.com/6933841/59761537-abcd0c80-92c7-11e9-9a8a-934749e8189c.jpeg) 

- **Issue #181** (2019-06-18): **80% of elements position isn't right !!**
  *Symptoms*: ### Issue type  **I'm submitting a ...**  (check one with "x")  * [x] bug report * [ ] feature request  ### Issue description  **Current behavior:** Text are getting padding-bottom so it's go up  **Expected behavior:** Text should be viewed correctly  ### Other information:  **OS, device, application version ** ``` Resolution: 2340x1080 OS: Android 9 Device: huawei p30 pro ```  ScreenShots:  ![Screenshot_20190614_195910_com akveo kittenTricks](https://user-images.githubusercontent.com/17798647/59525551-51a30480-8edf-11e9-8dc0-af3a7354bd78.jpg) ![Screenshot_20190614_195921](https://user-images.githubusercontent.com/17798647/59525553-51a30480-8edf-11e9-9d28-ebefeb5089c0.jpg) ![Screenshot_20190614_195146](https://user-images.githubusercontent.com/17798647/59525555-51a30480-8edf-11e9-8ad3-bf91c67c0376.jpg) ![Screenshot_20190614_195209](https://user-images.githubusercontent.com/17798647/59525556-523b9b00-8edf-11e9-927e-3bdf73a8465f.jpg) ![Screenshot_20190614_195658](https://user-images.githubusercontent.com/17798647/59525558-523b9b00-8edf-11e9-87a3-cfbf3dbf34f5.jpg) ![Screenshot_20190614_195712_com akveo kittenTricks](https://user-images.githubusercontent.com/17798647/59525559-523b9b00-8edf-11e9-9f88-306d0f9104f1.jpg) ![Screenshot_20190614_195723](https://user-images.githubusercontent.com/17798647/59525560-52d43180-8edf-11e9-9f63-9f4d1154174c.jpg) ![Screenshot_20190614_195736_com akveo kittenTricks](https://user-images.githubusercontent.com/1779864
  **Post-Mortem & Fix Analysis**:
  > omg thanks for the report @deounix   Looks like this is a custom behavior on Huawei phones because of custom fonts used to style Text elements. We'll fix this soon  Give it a try running on Google devices like Pixel or Nexus. We were able to debug it mostly on these  devices
  > @artyorsh well after spending 2 days 😪 trying to fix this issue I found the hole problem from react-native itself 🤬  Trying to create empty project with react-native >=0.58 u ll see the text and views goes up and down 🤕, now I'm working with react-native@0.57.8 which working good with the old version of ui kitten. not tested yet the newest kitten version.  Please consider this. Thnx.
  > Hello @deounix ! After some workaround, we've found an issue with applying custom fonts for Android OS. The font silently reverts back to the system font if "fontStyle" or "fontWeight" styles are applied with a custom "fontFamily". I guess that this's the react-native issue. You can read more about this in the article: https://medium.com/@lewie9021/custom-fonts-in-react-native-85d814ca084.  If you will find some interesting solution, welcome to create the PR.

- **Issue #70** (2018-09-12): **Realm ( false advertising ) ?**
  *Symptoms*: Hi do you think having `realm`, on the README.md is misguiding people looking for project boilerplate with realm ?
  **Post-Mortem & Fix Analysis**:
  > Hi @sahanatroam ,  Thanks for report. The reason of your issue is that we just forgot update readme file after some changes. [Take a look.](https://github.com/akveo/kittenTricks/commit/1b0f4f0553f4facc489832686fccf2f8c0a367cb)
  > @artyorsh thanks, amazing work overall on this project tho :)

- **Issue #65** (2018-09-26): **fix(navigation): unable to go back when navigated from side menu**
  *Symptoms*: <!-- We will close this issue if you don't provide the needed information.  Please remember, the github issues is __NOT__ for support requests and general questions. It is for bugs and feature requests only. Please read https://github.com/akveo/kittenTricks/blob/master/CONTRIBUTING.md and search existing issues (both open and closed) prior to opening any new issue and ensure you follow the instructions therein. -->  ### Issue type  **I'm submitting a ...**  (check one with "x")  * [+] bug report * [ ] feature request  ### Issue description  **Current behavior:** <!-- Describe how the bug manifests. --> When opened any screen from side-menu, menu icon is displayed in navigation-bar.  **Expected behavior:** <!-- Describe what the behavior would be without the bug. --> Navigation bar should display back button.  **Steps to reproduce:** <!--  Please explain the steps required to duplicate the issue, especially if you are able to provide a sample application. --> 1. Load app 2. From Home Screen tap side-menu icon 3. Tap any menu item to perform drawer navigation  ### Other information:  **OS, device, application version ** ``` v1.0.9 ``` 

- **Issue #49** (2019-03-26): **SetInterval created but never cleared!**
  *Symptoms*: ### Development trouble  **I'm submitting a ...**  (check one with "x")  * [ X ] bug report * [ ] feature request  ### Issue description  **Current behavior:**  If i change the way to use SplashScreen, i got a warning (but it is crticical).  In SplashScreen.js, you call a setInternval() on 'DidMount' component event. But the execution is never stoped. In this case, we need do stop that when component will unmount.  **Expected behavior:** You need to call clearInterval() method, parsing the return of setInterval() method (this.timer).  font.  You can to this with this instruction:  ``` componentWillUnmount() {     if(this.timer){       clearInterval(this.timer);     }   } ```  **Steps to reproduce:** <!--  Please explain the steps required to duplicate the issue, especially if you are able to provide a sample application. -->  **Related code:**   ``` import React from 'react'; import {   StyleSheet,   Image,   View,   Dimensions,   StatusBar } from 'react-native'; import {   RkText,   RkTheme } from 'react-native-ui-kitten' import {ProgressBar} from '../../components'; import {   KittenTheme } from '../../config/theme'; import {NavigationActions} from 'react-navigation'; import {scale, scaleModerate, scaleVertical} from '../../utils/scale';  let timeFrame = 500;  export class SplashScreen extends React.Component {    constructor(props) {     super(props);     this.state = {       progress: 0     }   }    compone
  **Post-Mortem & Fix Analysis**:
  > Hi @waldandrade  Thanks for report and sorry for late reply. This issue is fixed and will be available in future release

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

### Incident Patch 1: `07e32d3e` (2021-04-20)
**Commit Message**: chore(lib):update ui-kitten to v5.1.0

**File**: `package.json` (modified, +6/-6)
```diff
@@ -31,19 +31,19 @@
     "postinstall": "jetify"
   },
   "dependencies": {
-    "@eva-design/eva": "^2.0.0",
-    "@eva-design/material": "^2.0.0",
+    "@eva-design/eva": "^2.1.0",
+    "@eva-design/material": "^2.1.0",
     "@react-native-async-storage/async-storage": "^1.13.4",
     "@react-native-community/masked-view": "0.1.10",
     "@react-navigation/bottom-tabs": "^5.11.7",
     "@react-navigation/drawer": "^5.12.3",
     "@react-navigation/material-top-tabs": "^5.3.13",
     "@react-navigation/native": "^5.9.2",
     "@react-navigation/stack": "^5.14.2",
-    "@ui-kitten/components": "5.0.0",
-    "@ui-kitten/date-fns": "5.0.0",
-    "@ui-kitten/eva-icons": "5.0.0",
-    "@ui-kitten/moment": "5.0.0",
+    "@ui-kitten/components": "5.1.0",
+    "@ui-kitten/date-fns": "5.1.0",
+    "@ui-kitten/eva-icons": "5.1.0",
+    "@ui-kitten/moment": "5.1.0",
     "date-fns": "^1.30.1",
     "expo": "^40.0.0",
     "expo-app-loading": "^1.0.1",
```

**File**: `yarn.lock` (modified, +28/-28)
```diff
@@ -1129,15 +1129,15 @@
   resolved "https://registry.yarnpkg.com/@eva-design/dss/-/dss-2.0.0.tgz#d0038b43dfa3bcb925bc3ab4433e55d10bd92ea1"
   integrity sha512-jHMSLG9w/uhu92Oi8pViwYL5kbUxDolTpAoS28DSl9SAgGSLpdlyX1vtDKC7+nx1Ay5J5OWhNIcsMML3IGSbZg==
 
-"@eva-design/eva@^2.0.0":
-  version "2.0.0"
-  resolved "https://registry.yarnpkg.com/@eva-design/eva/-/eva-2.0.0.tgz#6a6265322f66441a8765307f5197fd8117506d1e"
-  integrity sha512-6cf3PPAZOHGl59Wx8QmPW/BZgGxOSjiLZctErBlFezsAdMNtoduUfoAE/SRaPFt25bTTpbPFL8o2FrxrQvvFeA==
+"@eva-design/eva@^2.1.0":
+  version "2.1.0"
+  resolved "https://registry.yarnpkg.com/@eva-design/eva/-/eva-2.1.0.tgz#210561abd37a6a894203420a727b1184d66e809a"
+  integrity sha512-n/8sUkjo0GWrO9dhsjijkqg+nlste2p8/3mOWT18wymm03hQXoT4kg31IhawjdWgzubjNzSjqPh+Pov5ShtsHQ==
 
-"@eva-design/material@^2.0.0":
-  version "2.0.0"
-  resolved "https://registry.yarnpkg.com/@eva-design/material/-/material-2.0.0.tgz#b24402ad140fa5b0d707811875b66542bf5ef1a1"
-  integrity sha512-Pm/FQ6qiJlbP6a7e1vc0wt9FA2VIA87uzWNyJQTeGhagd3rsvNuh4sCn0dl3aupeZ278cQ7nbh14KNjQoaZ2Gw==
+"@eva-design/material@^2.1.0":
+  version "2.1.0"
+  resolved "https://registry.yarnpkg.com/@eva-design/material/-/material-2.1.0.tgz#69617f6d78756ac4e450f07f30bb9b828e0d2d51"
+  integrity sha512-/U5LFq+4qEafXCrsYSP0daB0cnC7MrLFCZ6oQq6OW+gZlhdnfKoMrcVE8UQPjI+s/FVr7nD35Yl4I7yYKHLCew==
 
 "@eva-design/processor@^2.0.0":
   version "2.0.0"
@@ -2485,33 +2485,33 @@
   dependencies:
     "@types/yargs-parser" "*"
 
-"@ui-kitten/components@5.0.0":
-  version "5.0.0"
-  resolved "https://registry.yarnpkg.com/@ui-kitten/components/-/components-5.0.0.tgz#6a41719220f1c98afc3721abc19659f7e3a129ed"
-  integrity sha512-XYcXYju7yPDGvg7TAxfTSlxWbxGL/p2R1Y9rSroIpylnSlow7KGlfq0R1MOxeKCf3tZDxSNvuVzaSlFgvJK7fQ==
+"@ui-kitten/components@5.1.0":
+  version "5.1.0"
+  resolved "https://registry.yarnpkg.com/@ui-kitten/components/-/components-5.1.0.tgz#fc83ffd00686a210bc59e5c8d0f0c7b3a99e63f3"
+  integrity sha512-jn8Q+SOIt0+VIIoNv6fkVwFcaE3+AxfENLZh9PGO+Sq+6fZsphntKlJI1q+AGjxxtsMbfhS+h6Pxtakw8/vMsg==
   dependencies:
     "@eva-design/dss" "^2.0.0"
     "@eva-design/processor" "^2.0.0"
     fecha "3.0.3"
     hoist-non-react-statics "^3.2.1"
     lodash.merge "^4.6.1"
 
-"@ui-kitten/date-fns@5.0.0":
-  version "5.0.0"
-  resolved "https://registry.yarnpkg.com/@ui-kitten/date-fns/-/date-fns-5.0.0.tgz#b8e74ce84dbbe34d0e831e5231c88d114ee7d408"
-  integrity sha512-kauhX2f3E192pqTmdclAXRjhkgZ/9HYi5tjY1Fum6V8KqwfP14W7prhNpS5PKP3bCAZk1SHaLRde6v8qLKRQFg==
+"@ui-kitten/date-fns@5.1.0":
+  version "5.1.0"
+  resolved "https://registry.yarnpkg.com/@ui-kitten/date-fns/-/date-fns-5.1.0.tgz#9b922640dcd3dccd5e2f199e1837a0de71d8442b"
+  integrity sha512-f23wU/tLl7DNXCMrUx2z7mCVsaDGykqiWUfIurPX3/lwOni+0/xCJ7hkdGfvsrXDybGNbE8p3US0OUtby0CBCA==
 
-"@ui-kitten/eva-icons@5.0.0":
-  version "5.0.0"
-  resolved "https://registry.yarnpkg.com/@ui-kitten/eva-icons/-/eva-icons-5.0.0.tgz#b8ab2fea3dafcb9f914534ef66a5dfd1badfeb1d"
-  integrity sha512-Iae3FtnNQKC0PnRnFDUpaCFhvUFaN+NkRxag6LstEjNqAMcVnsQbPTqPQFx18j920Z5S7f5/oZqaJ8NxZtPaNA==
+"@ui-kitten/eva-icons@5.1.0":
+  version "5.1.0"
+  resolved "https://registry.yarnpkg.com/@ui-kitten/eva-icons/-/eva-icons-5.1.0.tgz#0c9c3c1de303c05937f955808a3effd3c517e432"
+  integrity sha512-f96QGp4w61FM1tRfCzW5N2l+a0ToR0wdTU79yY3rMaO9sf0whTNn0+ciz4BFK1cTSn14BtshPLxtphzkhwCfGg==
   dependencies:
     react-native-eva-icons "^1.3.1"
 
-"@ui-kitten/moment@5.0.0":
-  version "5.0.0"
-  resolved "https://registry.yarnpkg.com/@ui-kitten/moment/-/moment-5.0.0.tgz#b4dd043c649321b7b1316aa0c82e588d82a5b9eb"
-  integrity sha512-yM9nozxtD8bup5FXp5/CiA4ioDry8xlNX3WCved8GTrAeXiDkNuPomrmO8LC+3xYvJ+5gpNmXUkr7qKHiMkzEA==
+"@ui-kitten/moment@5.1.0":
+  version "5.1.0"
+  resolved "https://registry.yarnpkg.com/@ui-kitten/moment/-/moment-5.1.0.tgz#ca07ec59acd8419b3b11a36e7eaf311c2b0eebd0"
+  integrity sha512-tKWHtrfKYOsqvfMQT1lb2bzqXtZPj/T3TH56GtNBkMV9mYDbmD2mGJKZovs6VY5kUwo0GIzcBKa4u8O3JbR1xQ==
 
 "@unimodules/core@~6.0.0":
   version "6.0.0"
@@ -11381,10 +11381,10 @@ react-native-safari-view@naoufal/react-native-safari-view#master:
   version "2.1.0"
   resolved "https://codeload.github.com/naoufal/react-native-safari-view/tar.gz/fc343b037ed5b91c85cfae5d9adac32839a9b04b"
 
-react-native-safe-area-context@0.6.0:
-  version "0.6.0"
-  resolved "https://registry.yarnpkg.com/react-native-safe-area-context/-/react-native-safe-area-context-0.6.0.tgz#f53f5a5bcafb462a8798a26b145e68946389ad60"
-  integrity sha512-blY0akr3ZLTuZFdUotmjV+7LVXpBnd5CGFlNhTiarNNGJoHu79K42IJpUpmtg75iC9aWbSW7QHstlP0xz11V0A==
+react-native-safe-area-context@3.1.9:
+  version "3.1.9"
+  resolved "https://registry.yarnpkg.com/react-native-safe-area-context/-/react-native-safe-area-context-3.1.9.tgz#48864ea976b0fa57142a2cc523e1fd3314e7247e"
+  integrity sha512-wmcGbdyE/vBSL5IjDPReoJUEqxkZsywZw5gPwsVUV1NBpw5eTIdnL6Y0uNKHE25Z661moxPHQz6kwAkYQyorxA==
 
 react-native-screens@~2.15.2:
   version "2.15.2"
```

---

### Incident Patch 2: `f22a28a5` (2021-03-05)
**Commit Message**: fix(app): decrease safeArea version

**File**: `package.json` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@
     "react-native-keyboard-aware-scroll-view": "^0.9.1",
     "react-native-reanimated": "~1.4.0",
     "react-native-safari-view": "^2.1.0",
-    "react-native-safe-area-context": "3.1.9",
+    "react-native-safe-area-context": "0.6.0",
     "react-native-screens": "2.0.0-alpha.12",
     "react-native-svg": "9.13.3",
     "react-native-tab-view": "^2.13.0",
```

**File**: `src/components/safe-area-layout.component.tsx` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 import React from 'react';
 import {
-  useSafeAreaInsets,
+  useSafeArea,
 } from 'react-native-safe-area-context';
 import {
   StyledComponentProps,
@@ -21,7 +21,7 @@ export const SafeAreaLayout: React.FC<SafeAreaLayoutProps> = ({
   ...props
 }) => {
   const theme = useTheme();
-  const insetsConfig = useSafeAreaInsets();
+  const insetsConfig = useSafeArea();
 
   const backgroundColor: string = theme[`background-basic-color-${props.level}`];
 
```

**File**: `yarn.lock` (modified, +6/-6)
```diff
@@ -7715,9 +7715,9 @@ gzip-size@5.1.1, gzip-size@^5.0.0:
     duplexer "^0.1.1"
     pify "^4.0.1"
 
-"hammerjs@git+https://github.com/naver/hammer.js.git":
+"hammerjs@https://github.com/naver/hammer.js.git":
   version "2.0.17-snapshot"
-  resolved "git+https://github.com/naver/hammer.js.git#54bc698b25edd6e1b76ca975ebaced5ce0467d51"
+  resolved "https://github.com/naver/hammer.js.git#54bc698b25edd6e1b76ca975ebaced5ce0467d51"
   dependencies:
     "@types/hammerjs" "^2.0.36"
 
@@ -12825,10 +12825,10 @@ react-native-safari-view@^2.1.0:
   resolved "https://registry.yarnpkg.com/react-native-safari-view/-/react-native-safari-view-2.1.0.tgz#1e0cd12c62bce79bc1759c7e281646b08b61c959"
   integrity sha1-HgzRLGK855vBdZx+KBZGsIthyVk=
 
-react-native-safe-area-context@3.1.9:
-  version "3.1.9"
-  resolved "https://registry.yarnpkg.com/react-native-safe-area-context/-/react-native-safe-area-context-3.1.9.tgz#48864ea976b0fa57142a2cc523e1fd3314e7247e"
-  integrity sha512-wmcGbdyE/vBSL5IjDPReoJUEqxkZsywZw5gPwsVUV1NBpw5eTIdnL6Y0uNKHE25Z661moxPHQz6kwAkYQyorxA==
+react-native-safe-area-context@0.6.0:
+  version "0.6.0"
+  resolved "https://registry.yarnpkg.com/react-native-safe-area-context/-/react-native-safe-area-context-0.6.0.tgz#f53f5a5bcafb462a8798a26b145e68946389ad60"
+  integrity sha512-blY0akr3ZLTuZFdUotmjV+7LVXpBnd5CGFlNhTiarNNGJoHu79K42IJpUpmtg75iC9aWbSW7QHstlP0xz11V0A==
 
 react-native-screens@2.0.0-alpha.12:
   version "2.0.0-alpha.12"
```

---

### Incident Patch 3: `de0cd124` (2021-02-13)
**Commit Message**: fix(layouts): ListHeaderComponent onChangeText re-render issue

**File**: `src/layouts/articles/article-3/index.tsx` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ export default (): React.ReactElement => {
       <CommentList
         style={styles.list}
         data={data.comments}
-        ListHeaderComponent={renderHeader}
+        ListHeaderComponent={renderHeader()}
       />
     </KeyboardAvoidingView>
   );
```

**File**: `src/layouts/ecommerce/product-details-1/index.tsx` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ export default ({ navigation }): React.ReactElement => {
       <CommentList
         style={styles.commentList}
         data={product.comments}
-        ListHeaderComponent={renderHeader}
+        ListHeaderComponent={renderHeader()}
       />
     </KeyboardAvoidingView>
   );
```

**File**: `src/layouts/ecommerce/product-details-3/index.tsx` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ export default ({ navigation }): React.ReactElement => {
       <CommentList
         style={styles.commentList}
         data={product.comments}
-        ListHeaderComponent={renderHeader}
+        ListHeaderComponent={renderHeader()}
       />
     </KeyboardAvoidingView>
   );
```

---

### Incident Patch 4: `325125bc` (2021-02-13)
**Commit Message**: fix: build error due to misnamed .app file

**File**: `ios/KittenTricks.xcodeproj/project.pbxproj` (modified, +3/-3)
```diff
@@ -19,7 +19,7 @@
 
 /* Begin PBXFileReference section */
 		008F07F21AC5B25A0029DE68 /* main.jsbundle */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text; path = main.jsbundle; sourceTree = "<group>"; };
-		13B07F961A680F5B00A75B9A /* kittentricks.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = kittentricks.app; sourceTree = BUILT_PRODUCTS_DIR; };
+		13B07F961A680F5B00A75B9A /* KittenTricks.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = KittenTricks.app; sourceTree = BUILT_PRODUCTS_DIR; };
 		13B07FAF1A68108700A75B9A /* AppDelegate.h */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.c.h; name = AppDelegate.h; path = KittenTricks/AppDelegate.h; sourceTree = "<group>"; };
 		13B07FB01A68108700A75B9A /* AppDelegate.m */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.c.objc; name = AppDelegate.m; path = KittenTricks/AppDelegate.m; sourceTree = "<group>"; };
 		13B07FB21A68108700A75B9A /* Base */ = {isa = PBXFileReference; lastKnownFileType = file.xib; name = Base; path = Base.lproj/LaunchScreen.xib; sourceTree = "<group>"; };
@@ -127,7 +127,7 @@
 		83CBBA001A601CBA00E9B192 /* Products */ = {
 			isa = PBXGroup;
 			children = (
-				13B07F961A680F5B00A75B9A /* kittentricks.app */,
+				13B07F961A680F5B00A75B9A /* KittenTricks.app */,
 			);
 			name = Products;
 			sourceTree = "<group>";
@@ -161,7 +161,7 @@
 			);
 			name = KittenTricks;
 			productName = "Hello World";
-			productReference = 13B07F961A680F5B00A75B9A /* kittentricks.app */;
+			productReference = 13B07F961A680F5B00A75B9A /* KittenTricks.app */;
 			productType = "com.apple.product-type.application";
 		};
 /* End PBXNativeTarget section */
```

**File**: `ios/KittenTricks.xcodeproj/xcshareddata/xcschemes/KittenTricks.xcscheme` (modified, +4/-4)
```diff
@@ -29,7 +29,7 @@
             <BuildableReference
                BuildableIdentifier = "primary"
                BlueprintIdentifier = "13B07F861A680F5B00A75B9A"
-               BuildableName = "kittentricks.app"
+               BuildableName = "KittenTricks.app"
                BlueprintName = "KittenTricks"
                ReferencedContainer = "container:KittenTricks.xcodeproj">
             </BuildableReference>
@@ -59,7 +59,7 @@
          <BuildableReference
             BuildableIdentifier = "primary"
             BlueprintIdentifier = "13B07F861A680F5B00A75B9A"
-            BuildableName = "kittentricks.app"
+            BuildableName = "KittenTricks.app"
             BlueprintName = "KittenTricks"
             ReferencedContainer = "container:KittenTricks.xcodeproj">
          </BuildableReference>
@@ -92,7 +92,7 @@
          <BuildableReference
             BuildableIdentifier = "primary"
             BlueprintIdentifier = "13B07F861A680F5B00A75B9A"
-            BuildableName = "kittentricks.app"
+            BuildableName = "KittenTricks.app"
             BlueprintName = "KittenTricks"
             ReferencedContainer = "container:KittenTricks.xcodeproj">
          </BuildableReference>
@@ -109,7 +109,7 @@
          <BuildableReference
             BuildableIdentifier = "primary"
             BlueprintIdentifier = "13B07F861A680F5B00A75B9A"
-            BuildableName = "kittentricks.app"
+            BuildableName = "KittenTricks.app"
             BlueprintName = "KittenTricks"
             ReferencedContainer = "container:KittenTricks.xcodeproj">
          </BuildableReference>
```

---

### Incident Patch 5: `7d748c9f` (2021-02-13)
**Commit Message**: chore: bump ui-kitten to v5

**File**: `ios/Podfile.lock` (modified, +8/-8)
```diff
@@ -182,7 +182,7 @@ PODS:
     - React-cxxreact (= 0.61.5)
     - React-jsi (= 0.61.5)
   - React-jsinspector (0.61.5)
-  - react-native-appearance (0.3.2):
+  - react-native-appearance (0.3.4):
     - React
   - react-native-safari-view (1.0.0):
     - React
@@ -223,9 +223,9 @@ PODS:
     - React-cxxreact (= 0.61.5)
     - React-jsi (= 0.61.5)
     - ReactCommon/jscallinvoker (= 0.61.5)
-  - RNCMaskedView (0.1.6):
+  - RNCMaskedView (0.1.10):
     - React
-  - RNDeviceInfo (5.5.1):
+  - RNDeviceInfo (5.6.5):
     - React
   - RNGestureHandler (1.5.6):
     - React
@@ -277,7 +277,7 @@ DEPENDENCIES:
   - Yoga (from `../node_modules/react-native/ReactCommon/yoga`)
 
 SPEC REPOS:
-  https://github.com/CocoaPods/Specs.git:
+  trunk:
     - boost-for-react-native
 
 EXTERNAL SOURCES:
@@ -366,7 +366,7 @@ SPEC CHECKSUMS:
   React-jsi: cb2cd74d7ccf4cffb071a46833613edc79cdf8f7
   React-jsiexecutor: d5525f9ed5f782fdbacb64b9b01a43a9323d2386
   React-jsinspector: fa0ecc501688c3c4c34f28834a76302233e29dc0
-  react-native-appearance: c2e0666225d999f7f0e7d9a9cb6c627c6e4c4b92
+  react-native-appearance: 0f0e5fc2fcef70e03d48c8fe6b00b9158c2ba8aa
   react-native-safari-view: 955d7160d159241b8e9395d12d10ea0ef863dcdd
   react-native-safe-area-context: d288138da2c800caa111f9352e9333f186a06ead
   React-RCTActionSheet: 600b4d10e3aea0913b5a92256d2719c0cdd26d76
@@ -379,8 +379,8 @@ SPEC CHECKSUMS:
   React-RCTText: 9ccc88273e9a3aacff5094d2175a605efa854dbe
   React-RCTVibration: a49a1f42bf8f5acf1c3e297097517c6b3af377ad
   ReactCommon: 198c7c8d3591f975e5431bec1b0b3b581aa1c5dd
-  RNCMaskedView: a88953beefbd347a29072d9eba90e42945fe291e
-  RNDeviceInfo: 017aa2fd29a437fba26807cbe2fa51a149da70cd
+  RNCMaskedView: 5a8ec07677aa885546a0d98da336457e2bea557f
+  RNDeviceInfo: c5f8f3a456adcbba405ace475254b08febc4c095
   RNGestureHandler: 911d3b110a7a233a34c4f800e7188a84b75319c6
   RNReanimated: b2ab0b693dddd2339bd2f300e770f6302d2e960c
   RNScreens: 254da4b84f25971cbb30ed3ddc84131f23cac812
@@ -389,4 +389,4 @@ SPEC CHECKSUMS:
 
 PODFILE CHECKSUM: 283d79fe9f997cb2e4e5c3b30b4cfe5de474678b
 
-COCOAPODS: 1.8.4
+COCOAPODS: 1.10.0
```

**File**: `package.json` (modified, +5/-4)
```diff
@@ -39,15 +39,16 @@
     "@react-navigation/material-top-tabs": "^5.0.0",
     "@react-navigation/native": "^5.0.0",
     "@react-navigation/stack": "^5.0.0",
-    "@ui-kitten/components": "^4.4.0",
-    "@ui-kitten/date-fns": "^4.4.0",
-    "@ui-kitten/eva-icons": "^4.4.0",
-    "@ui-kitten/moment": "^4.4.0",
+    "@ui-kitten/components": "5.0.0",
+    "@ui-kitten/date-fns": "5.0.0",
+    "@ui-kitten/eva-icons": "5.0.0",
+    "@ui-kitten/moment": "5.0.0",
     "date-fns": "^1.30.1",
     "expo": "^36.0.2",
     "expo-constants": "^8.0.0",
     "expo-web-browser": "~8.0.0",
     "moment": "^2.24.0",
+    "patch-package": "^6.2.2",
     "react": "~16.9.0",
     "react-dom": "~16.9.0",
     "react-native": "~0.61.5",
```

**File**: `src/components/layout-grid-list.component.tsx` (modified, +24/-22)
```diff
@@ -1,13 +1,18 @@
 import React from 'react';
-import { Dimensions, Image, ListRenderItemInfo, StyleSheet } from 'react-native';
+import {
+  Dimensions,
+  Image,
+  ListRenderItemInfo,
+  StyleSheet,
+} from 'react-native';
 import {
   Card,
   CardElement,
-  CardHeader,
-  CardHeaderElement,
   List,
   ListElement,
   ListProps,
+  Layout,
+  Text,
 } from '@ui-kitten/components';
 import { LayoutItem } from '../model/layout-item.model';
 
@@ -19,28 +24,25 @@ export interface LayoutGridListProps extends Omit<ListProps, 'renderItem'> {
 export type LayoutGridListElement = React.ReactElement<LayoutGridListProps>;
 
 export const LayoutGridList = (props: LayoutGridListProps): ListElement => {
-
   const { contentContainerStyle, onItemPress, ...listProps } = props;
 
-  const renderItemHeader = (info: ListRenderItemInfo<LayoutItem>): CardHeaderElement => (
-    <CardHeader
-      style={styles.itemHeader}
-      title={info.item.title}
-      description={info.item.description}
-    />
-  );
+  const renderItem = (info: ListRenderItemInfo<LayoutItem>): CardElement => {
+    const renderItemHeader = (evaProps): React.ReactElement => (
+      <Layout {...evaProps}>
+        <Text category='h6'>{info.item.title}</Text>
+        <Text category='s1'>{info.item.description}</Text>
+      </Layout>
+    );
 
-  const renderItem = (info: ListRenderItemInfo<LayoutItem>): CardElement => (
-    <Card
-      style={styles.itemContainer}
-      header={() => renderItemHeader(info)}
-      onPress={() => onItemPress(info.index)}>
-      <Image
-        style={styles.itemImage}
-        source={info.item.image}
-      />
-    </Card>
-  );
+    return (
+      <Card
+        style={styles.itemContainer}
+        header={renderItemHeader}
+        onPress={() => onItemPress(info.index)}>
+        <Image style={styles.itemImage} source={info.item.image} />
+      </Card>
+    );
+  };
 
   return (
     <List
```

**File**: `src/components/safe-area-layout.component.tsx` (modified, +24/-23)
```diff
@@ -1,22 +1,20 @@
 import React from 'react';
-import { FlexStyle, View, ViewProps } from 'react-native';
+import { FlexStyle, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
 import { EdgeInsets, SafeAreaConsumer } from 'react-native-safe-area-context';
 import { styled, StyledComponentProps } from '@ui-kitten/components';
 
 interface InsetProvider {
-  toStyle: (insets: EdgeInsets, styles) => FlexStyle;
+  toStyle: (insets: EdgeInsets) => FlexStyle;
 }
 
 const INSETS: Record<string, InsetProvider> = {
   top: {
-    toStyle: (insets: EdgeInsets, styles): FlexStyle => ({
-      ...styles,
+    toStyle: (insets: EdgeInsets): FlexStyle => ({
       paddingTop: insets.top,
     }),
   },
   bottom: {
-    toStyle: (insets: EdgeInsets, styles): FlexStyle => ({
-      ...styles,
+    toStyle: (insets: EdgeInsets): FlexStyle => ({
       paddingBottom: insets.bottom,
     }),
   },
@@ -27,37 +25,40 @@ type Inset = 'top' | 'bottom';
 export interface SafeAreaLayoutProps extends ViewProps, StyledComponentProps {
   insets?: Inset;
   children?: React.ReactNode;
+  backgroundColor?: string;
 }
 
+@styled('SafeAreaLayout')
 export class SafeAreaLayoutComponent extends React.Component<SafeAreaLayoutProps> {
-
-  static styledComponentName: string = 'SafeAreaLayout';
-
   public render(): React.ReactElement<ViewProps> {
-    return (
-      <SafeAreaConsumer>
-        {this.renderComponent}
-      </SafeAreaConsumer>
-    );
+    return <SafeAreaConsumer>{this.renderComponent}</SafeAreaConsumer>;
   }
 
-  private createInsets = (insets: Inset | Inset[],
-                          safeAreaInsets: EdgeInsets,
-                          style): FlexStyle[] => {
-    return React.Children.map(insets, inset => INSETS[inset].toStyle(safeAreaInsets, style));
+  private createInsets = (
+    insets: Inset | Inset[],
+    safeAreaInsets: EdgeInsets,
+  ): FlexStyle[] => {
+    return React.Children.map(insets, (inset) =>
+      INSETS[inset].toStyle(safeAreaInsets),
+    );
   };
 
-  private renderComponent = (safeAreaInsets: EdgeInsets): React.ReactElement<ViewProps> => {
-    const { style, insets, themedStyle, ...viewProps } = this.props;
+  private renderComponent = (
+    safeAreaInsets: EdgeInsets,
+  ): React.ReactElement<ViewProps> => {
+    const { style, insets, eva, backgroundColor, ...viewProps } = this.props;
 
     return (
       <View
         {...viewProps}
-        style={[this.createInsets(insets, safeAreaInsets, themedStyle), style]}
+        style={[
+          this.createInsets(insets, safeAreaInsets),
+          style,
+          { backgroundColor: eva.theme[backgroundColor || 'background-basic-color-1'] },
+        ]}
       />
     );
   };
 }
 
-export const SafeAreaLayout = styled(SafeAreaLayoutComponent);
-
+export const SafeAreaLayout = SafeAreaLayoutComponent;
```

**File**: `src/components/showcase-container.component.tsx` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ export const ShowcaseContainer = (props: ShowcaseContainerProps): React.ReactEle
       insets='top'>
       <TopNavigation
         title={showcase.title}
-        leftControl={renderBackAction()}
+        accessoryLeft={renderBackAction}
       />
       <Divider/>
       <ShowcaseSettings
```

**File**: `src/components/showcase-settings.component.tsx` (modified, +59/-44)
```diff
@@ -1,11 +1,13 @@
-import React from 'react';
+import React, { ReactElement } from 'react';
 import { I18nManager, Platform, StyleSheet, ViewProps } from 'react-native';
 import {
   Button,
+  ButtonElement,
   CheckBox,
+  IndexPath,
   Layout,
   OverflowMenu,
-  OverflowMenuItemType,
+  MenuItem,
 } from '@ui-kitten/components';
 import { ColorPaletteIcon, SettingsIcon, TrashIcon } from './icons';
 import { ComponentShowcaseSetting } from '../model/showcase.model';
@@ -21,31 +23,38 @@ export interface ShowcaseSettingsProps extends ViewProps {
 }
 
 export const ShowcaseSettings = (props: ShowcaseSettingsProps): React.ReactElement => {
+  const [themesMenuVisible, setThemesMenuVisible] = React.useState<boolean>(
+    false,
+  );
+  const [settingsMenuVisible, setSettingsMenuVisible] = React.useState<boolean>(
+    false,
+  );
 
-  const [themesMenuVisible, setThemesMenuVisible] = React.useState<boolean>(false);
-  const [settingsMenuVisible, setSettingsMenuVisible] = React.useState<boolean>(false);
-
-  const createSettingMenuItem = (setting: ComponentShowcaseSetting): OverflowMenuItemType => {
-    return {
-      title: setting.description || `${setting.propertyName}: ${setting.value}`,
-    };
-  };
+  const createSettingMenuItem = (setting: ComponentShowcaseSetting, index: number): React.ReactElement => (
+    <MenuItem
+      key={index}
+      title={setting.description || `${setting.propertyName}: ${setting.value}`}
+    />
+  );
 
-  const createThemeMenuItem = (title: string): OverflowMenuItemType => {
-    return { title };
-  };
+  const createThemeMenuItem = (title: string, index: number): ReactElement => (
+    <MenuItem
+      key={index}
+      title={title}
+     />
+  );
 
-  const onThemeSelect = (index: number): void => {
-    props.onThemeSelect(props.themes[index]);
+  const onThemeSelect = (index: IndexPath): void => {
+    props.onThemeSelect(props.themes[index.row]);
     setThemesMenuVisible(false);
   };
 
   const onResetButtonPress = (): void => {
     props.onReset();
   };
 
-  const onSettingSelect = (index: number): void => {
-    const { [index]: setting } = props.settings;
+  const onSettingSelect = (index: IndexPath): void => {
+    const { [index.row]: setting } = props.settings;
 
     props.onSettingSelect({
       [setting.propertyName]: setting.value,
@@ -54,11 +63,11 @@ export const ShowcaseSettings = (props: ShowcaseSettingsProps): React.ReactEleme
     setSettingsMenuVisible(false);
   };
 
-  const createThemesMenuItems = (): OverflowMenuItemType[] => {
+  const createThemesMenuItems = (): React.ReactElement[] => {
     return props.themes && props.themes.map(createThemeMenuItem);
   };
 
-  const createSettingsMenuItems = (): OverflowMenuItemType[] => {
+  const createSettingsMenuItems = (): React.ReactElement[] => {
     const settings = props.settings && props.settings.map(createSettingMenuItem);
     return settings || [];
   };
@@ -80,45 +89,51 @@ export const ShowcaseSettings = (props: ShowcaseSettingsProps): React.ReactEleme
   const renderRTLToggle = (): React.ReactElement => (
     <CheckBox
       checked={I18nManager.isRTL}
-      onChange={toggleRtl}
-      text='RTL'
-    />
+      onChange={toggleRtl}>
+      RTL
+    </CheckBox>
+  );
+
+  const renderButtonThemes = (): ButtonElement => (
+    <Button
+      size='tiny'
+      accessoryLeft={ColorPaletteIcon}
+      disabled={!props.themes}
+      onPress={toggleThemesMenu}>
+      THEMES
+    </Button>
+  );
+
+  const renderButtonSettings = (): ButtonElement => (
+    <Button
+      size='tiny'
+      accessoryLeft={SettingsIcon}
+      disabled={!props.settings}
+      onPress={toggleSettingsMenu}>
+      SETTINGS
+    </Button>
   );
 
   return (
-    <Layout
-      style={[styles.container, props.style]}
-      level='1'>
+    <Layout style={styles.container} level='1'>
       <OverflowMenu
         visible={themesMenuVisible}
         onSelect={onThemeSelect}
-        data={createThemesMenuItems()}
-        onBackdropPress={toggleThemesMenu}>
-        <Button
-          size='tiny'
-          icon={ColorPaletteIcon}
-          disabled={!props.themes}
-          onPress={toggleThemesMenu}>
-          THEMES
-        </Button>
+        onBackdropPress={toggleThemesMenu}
+        anchor={renderButtonThemes}>
+        {createThemesMenuItems()}
       </OverflowMenu>
       <OverflowMenu
         visible={settingsMenuVisible}
         onSelect={onSettingSelect}
-        data={createSettingsMenuItems()}
-        onBackdropPress={toggleSettingsMenu}>
-        <Button
-          size='tiny'
-          icon={SettingsIcon}
-          disabled={!props.settings}
-          onPress={toggleSettingsMenu}>
-          SETTINGS
-        </Button>
+        onBackdropPress={toggleSettingsMenu}
+        anchor={renderButtonSettings}>
+        {createSettingsMenuItems()}
       </OverflowMenu>
       <Button
         size='tiny'
         status='danger'
-        icon={TrashIcon}
+        accessoryLeft={Trash
```

**File**: `src/components/status-bar.component.tsx` (modified, +7/-11)
```diff
@@ -8,20 +8,16 @@ import { styled, StyledComponentProps } from '@ui-kitten/components';
 
 export type StatusBarProps = RNStatusBarProps & StyledComponentProps;
 
+@styled('StatusBar')
 class StatusBarComponent extends React.Component<StatusBarProps> {
-
-  static styledComponentName: string = 'StatusBar';
-
   public render(): React.ReactElement<ViewProps> {
-    const { themedStyle, ...statusBarProps } = this.props;
+    const { eva, ...statusBarProps } = this.props;
 
-    return (
-      <RNStatusBar
-        {...themedStyle}
-        {...statusBarProps}
-      />
-    );
+    return <RNStatusBar
+      {...eva?.style}
+      {...statusBarProps}
+    />;
   }
 }
 
-export const StatusBar = styled(StatusBarComponent);
+export const StatusBar = StatusBarComponent;
```

**File**: `src/layouts/articles/article-1/index.tsx` (modified, +2/-2)
```diff
@@ -49,14 +49,14 @@ export default (): React.ReactElement => (
         style={styles.iconButton}
         appearance='ghost'
         status='basic'
-        icon={MessageCircleIcon}>
+        accessoryLeft={MessageCircleIcon}>
         {`${data.comments.length}`}
       </Button>
       <Button
         style={styles.iconButton}
         appearance='ghost'
         status='danger'
-        icon={HeartIcon}>
+        accessoryLeft={HeartIcon}>
         {`${data.likes.length}`}
       </Button>
     </View>
```

---

### Incident Patch 6: `8eabc166` (2020-01-22)
**Commit Message**: fix: theme switch using system appearance

**File**: `src/app/app-provider.component.tsx` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import React from 'react';
+import { AppearanceProvider } from 'react-native-appearance';
+import { SafeAreaProvider } from 'react-native-safe-area-context';
+import { mapping } from '@eva-design/eva';
+import { ApplicationProvider } from '@ui-kitten/components';
+import { appThemes } from './app-themes';
+import { default as appMapping } from './app-mapping.json';
+import { Theme, Theming } from '../services/theme.service';
+
+export interface AppProviderProps {
+  initialTheme?: Theme;
+  children?: React.ReactNode;
+}
+
+const DEFAULT_PROPS: AppProviderProps = {
+  initialTheme: 'light',
+};
+
+export const AppProvider = (props: AppProviderProps): React.ReactElement => {
+
+  const { initialTheme, children } = { ...DEFAULT_PROPS, ...props };
+  const [themeContext, theme] = Theming.useTheming(appThemes, initialTheme);
+
+  return (
+    <AppearanceProvider>
+      <Theming.Context.Provider value={themeContext}>
+        <ApplicationProvider
+          mapping={mapping}
+          theme={theme}
+          // @ts-ignore
+          customMapping={appMapping}>
+          <SafeAreaProvider>
+            {children}
+          </SafeAreaProvider>
+        </ApplicationProvider>
+      </Theming.Context.Provider>
+    </AppearanceProvider>
+  );
+};
```

**File**: `src/app/app.component.tsx` (modified, +13/-33)
```diff
@@ -1,46 +1,26 @@
 import React from 'react';
-import { SafeAreaProvider } from 'react-native-safe-area-context';
-import { mapping } from '@eva-design/eva';
-import { ApplicationProvider, ApplicationProviderProps, IconRegistry } from '@ui-kitten/components';
+import { IconRegistry } from '@ui-kitten/components';
 import { EvaIconsPack } from '@ui-kitten/eva-icons';
 import { ApplicationLoader, Assets } from './app-loader.component';
-import { default as appMapping } from './app-mapping.json';
-import { appThemes } from './app-themes';
 import { AppIconsPack } from './app-icons-pack';
+import { AppProvider } from './app-provider.component';
 import { StatusBar } from '../components/status-bar.component';
 import { AppNavigator } from '../navigation/app.navigator';
-import { Theming } from '../services/theme.service';
 
 const assets: Assets = {
   fonts: {
     'opensans-regular': require('../assets/fonts/opensans-regular.ttf'),
   },
 };
 
-export default (): React.ReactElement => {
-
-  const [themeContext, theme] = Theming.useTheming(appThemes, 'light');
-
-  const appConfig: ApplicationProviderProps = {
-    mapping: mapping,
-    theme: theme,
-    // @ts-ignore
-    customMapping: appMapping,
-  };
-
-  return (
-    <ApplicationLoader
-      assets={assets}
-      splash={require('../assets/images/image-splash.png')}>
-      <IconRegistry icons={[EvaIconsPack, AppIconsPack]}/>
-      <Theming.Context.Provider value={themeContext}>
-        <ApplicationProvider {...appConfig}>
-          <SafeAreaProvider>
-            <StatusBar/>
-            <AppNavigator/>
-          </SafeAreaProvider>
-        </ApplicationProvider>
-      </Theming.Context.Provider>
-    </ApplicationLoader>
-  );
-};
+export default (): React.ReactElement => (
+  <ApplicationLoader
+    assets={assets}
+    splash={require('../assets/images/image-splash.png')}>
+    <IconRegistry icons={[EvaIconsPack, AppIconsPack]}/>
+    <AppProvider initialTheme='light'>
+      <StatusBar/>
+      <AppNavigator/>
+    </AppProvider>
+  </ApplicationLoader>
+);
```

---

### Incident Patch 7: `e34a1ad1` (2020-01-16)
**Commit Message**: chore: update github-actions workflow name to fix readme badge

**File**: `.github/workflows/continuous-integration-workflow.yml` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-name: Node CI
+name: Build
 on:
   push:
     branches:
@@ -10,7 +10,7 @@ on:
 
 jobs:
   build:
-    name: Running TypeScript compiler, TSLint and Jest
+    name: Running TypeScript compiler and TSLint
     runs-on: macos-latest
     steps:
       - uses: actions/checkout@v1
```

---

### Incident Patch 8: `a80fd934` (2019-10-17)
**Commit Message**: fix(containers): update containers to fit ui-kitten 4.2

**File**: `src/components/social/feed/feedActivityBar.component.tsx` (modified, +1/-1)
```diff
@@ -67,8 +67,8 @@ class FeedActivityBarComponent extends React.Component<FeedActivityBarProps> {
         <Button
           style={themedStyle.addButton}
           textStyle={textStyle.button}
+          appearance='ghost'
           size='giant'
-          status='white'
           icon={this.renderAddIcon}
           onPress={this.onAddButtonPress}>
           Add Training
```

**File**: `src/containers/components/button/button.container.tsx` (modified, +3/-3)
```diff
@@ -5,6 +5,7 @@ import { Showcase } from '../common/showcase.component';
 import { ShowcaseSection } from '../common/showcaseSection.component';
 import { ShowcaseItem } from '../common/showcaseItem.component';
 import {
+  BasicButton,
   DangerButton,
   DefaultButton,
   DisabledButton,
@@ -22,7 +23,6 @@ import {
   SuccessButton,
   TinyButton,
   WarningButton,
-  WhiteButton,
 } from './showcase';
 
 export class ButtonContainer extends React.Component<NavigationStackScreenProps> {
@@ -90,8 +90,8 @@ export class ButtonContainer extends React.Component<NavigationStackScreenProps>
           <ShowcaseItem title='Danger'>
             <DangerButton style={styles.component}/>
           </ShowcaseItem>
-          <ShowcaseItem title='White'>
-            <WhiteButton style={styles.component}/>
+          <ShowcaseItem title='Basic'>
+            <BasicButton style={styles.component}/>
           </ShowcaseItem>
         </ShowcaseSection>
       </Showcase>
```

**File**: `src/containers/components/button/showcase/basicButton.component.tsx` (renamed, +2/-2)
```diff
@@ -6,10 +6,10 @@ import {
 
 type ButtonElement = React.ReactElement<ButtonProps>;
 
-export const WhiteButton = (props?: ButtonProps): ButtonElement => {
+export const BasicButton = (props?: ButtonProps): ButtonElement => {
   return (
     <Button
-      status='white'
+      status='basic'
       {...props}>
       BUTTON
     </Button>
```

**File**: `src/containers/components/button/showcase/index.ts` (modified, +1/-1)
```diff
@@ -15,4 +15,4 @@ export { SuccessButton } from './successButton.component';
 export { InfoButton } from './infoButton.component';
 export { WarningButton } from './warningButton.component';
 export { DangerButton } from './dangerButton.component';
-export { WhiteButton } from './whiteButton.component';
+export { BasicButton } from './basicButton.component';
```

**File**: `src/containers/layouts/articles/articleList4/articleList4.component.tsx` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@ class ArticleList4Component extends React.Component<ArticleList4Props> {
           <Button
             style={themedStyle.readButton}
             textStyle={textStyle.button}
-            status='white'
+            status='control'
             onPress={this.onReadButtonPress}>
             READ
           </Button>
```

**File**: `src/containers/layouts/auth/signIn5/signIn5.component.tsx` (modified, +1/-2)
```diff
@@ -117,7 +117,6 @@ class SignIn5Component extends React.Component<SignIn5Props, State> {
             </Text>
           </View>
           <TabView
-            style={themedStyle.tabView}
             tabBarStyle={themedStyle.tabBar}
             indicatorStyle={themedStyle.tabViewIndicator}
             selectedIndex={this.state.selectedTabIndex}
@@ -181,10 +180,10 @@ export const SignIn5 = withStyles(SignIn5Component, (theme: ThemeType) => ({
   },
   tabContentContainer: {
     marginVertical: 8,
+    paddingHorizontal: 16,
   },
   tabView: {
     flex: 1,
-    paddingHorizontal: 16,
   },
   tabBar: {
     backgroundColor: 'transparent',
```

**File**: `src/containers/layouts/social/profile7/profile7.component.tsx` (modified, +1/-1)
```diff
@@ -112,7 +112,7 @@ class Profile7Component extends React.Component<Profile7Props> {
             <Button
               style={themedStyle.messageButton}
               textStyle={textStyle.button}
-              status='white'
+              status='control'
               icon={MessageCircleIconFill}
               onPress={this.onMessagePress}>
               MESSAGE
```

---

### Incident Patch 9: `44d1d834` (2019-10-17)
**Commit Message**: fix(router): var-name typo fix

**File**: `package-lock.json` (modified, +11/-30)
```diff
@@ -3317,8 +3317,7 @@
         },
         "ansi-regex": {
           "version": "2.1.1",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "aproba": {
           "version": "1.2.0",
@@ -3336,13 +3335,11 @@
         },
         "balanced-match": {
           "version": "1.0.0",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "brace-expansion": {
           "version": "1.1.11",
           "bundled": true,
-          "optional": true,
           "requires": {
             "balanced-match": "^1.0.0",
             "concat-map": "0.0.1"
@@ -3355,18 +3352,15 @@
         },
         "code-point-at": {
           "version": "1.1.0",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "concat-map": {
           "version": "0.0.1",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "console-control-strings": {
           "version": "1.1.0",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "core-util-is": {
           "version": "1.0.2",
@@ -3469,8 +3463,7 @@
         },
         "inherits": {
           "version": "2.0.3",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "ini": {
           "version": "1.3.5",
@@ -3480,7 +3473,6 @@
         "is-fullwidth-code-point": {
           "version": "1.0.0",
           "bundled": true,
-          "optional": true,
           "requires": {
             "number-is-nan": "^1.0.0"
           }
@@ -3493,20 +3485,17 @@
         "minimatch": {
           "version": "3.0.4",
           "bundled": true,
-          "optional": true,
           "requires": {
             "brace-expansion": "^1.1.7"
           }
         },
         "minimist": {
           "version": "0.0.8",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "minipass": {
           "version": "2.3.5",
           "bundled": true,
-          "optional": true,
           "requires": {
             "safe-buffer": "^5.1.2",
             "yallist": "^3.0.0"
@@ -3523,7 +3512,6 @@
         "mkdirp": {
           "version": "0.5.1",
           "bundled": true,
-          "optional": true,
           "requires": {
             "minimist": "0.0.8"
           }
@@ -3596,8 +3584,7 @@
         },
         "number-is-nan": {
           "version": "1.0.1",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "object-assign": {
           "version": "4.1.1",
@@ -3607,7 +3594,6 @@
         "once": {
           "version": "1.4.0",
           "bundled": true,
-          "optional": true,
           "requires": {
             "wrappy": "1"
           }
@@ -3683,8 +3669,7 @@
         },
         "safe-buffer": {
           "version": "5.1.2",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "safer-buffer": {
           "version": "2.1.2",
@@ -3714,7 +3699,6 @@
         "string-width": {
           "version": "1.0.2",
           "bundled": true,
-          "optional": true,
           "requires": {
             "code-point-at": "^1.0.0",
             "is-fullwidth-code-point": "^1.0.0",
@@ -3732,7 +3716,6 @@
         "strip-ansi": {
           "version": "3.0.1",
           "bundled": true,
-          "optional": true,
           "requires": {
             "ansi-regex": "^2.0.0"
           }
@@ -3771,13 +3754,11 @@
         },
         "wrappy": {
           "version": "1.0.2",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "yallist": {
           "version": "3.0.3",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         }
       }
     },
```

**File**: `src/core/navigation/routes.tsx` (modified, +2/-2)
```diff
@@ -139,7 +139,7 @@ const EcommerceNavigationMap: NavigationRouteConfigMap<any, NavigationStackProp>
   },
 };
 
-const DarhboardsNavigationMap: NavigationRouteConfigMap<any, NavigationStackProp> = {
+const DashboardsNavigationMap: NavigationRouteConfigMap<any, NavigationStackProp> = {
   ['Trainings 1']: {
     screen: Trainings1Container,
     navigationOptions: DashboardNavigationOptions,
@@ -321,7 +321,7 @@ const AppNavigator: NavigationContainer = createStackNavigator({
   ...SocialNavigationMap,
   ...ArticlesNavigationMap,
   ...MessagingNavigationMap,
-  ...DarhboardsNavigationMap,
+  ...DashboardsNavigationMap,
   ...EcommerceNavigationMap,
 }, {
   headerMode: 'screen',
```

---

### Incident Patch 10: `2944e3e1` (2019-10-16)
**Commit Message**: fix(components): validationInput fails if onChangeText is undefined

**File**: `src/components/auth/signUpForm2/signUpForm2.component.tsx` (modified, +5/-0)
```diff
@@ -52,6 +52,11 @@ class SignUpForm2Component extends React.Component<SignUpForm2Props, State> {
   };
 
   public componentDidUpdate(prevProps: SignUpForm2Props, prevState: State) {
+    
+    if (!this.props.onDataChange) {
+      return;
+    }
+    
     const oldFormValid: boolean = this.isValid(prevState);
     const newFormValid: boolean = this.isValid(this.state);
 
```

---

### Incident Patch 11: `63d3f0c1` (2019-10-16)
**Commit Message**: build(common): update dependencies

**File**: `app.json` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
     "icon": "./src/assets/icons/icon.png",
     "version": "2.0.1",
     "slug": "kittenTricks",
-    "sdkVersion": "33.0.0",
+    "sdkVersion": "35.0.0",
     "privacy": "public",
     "orientation": "portrait",
     "githubUrl": "https://github.com/akveo/kittenTricks",
```

**File**: `package.json` (modified, +33/-20)
```diff
@@ -1,11 +1,16 @@
 {
-  "name": "kittenTricks",
+  "name": "kitten-tricks",
   "version": "2.0.1",
   "private": true,
-  "author": "akveo",
+  "license": "MIT",
+  "author": "akveo <contact@akveo.com>",
+  "repository": "git+https://github.com/akveo/kittenTricks.git",
+  "bugs": {
+    "url": "https://github.com/akveo/kittenTricks/issues"
+  },
   "main": "node_modules/expo/AppEntry.js",
   "scripts": {
-    "start": "expo start",
+    "start": "expo start -c",
     "start:dev": "npm run env:set -- dev && npm start -- -c",
     "start:prod": "npm run env:set -- prod && npm start -- -c",
     "env:set": "./scripts/environment/set-env.sh",
@@ -20,31 +25,39 @@
     "version:changelog": "npm run conventional-changelog -- -i ./CHANGELOG.md -s"
   },
   "dependencies": {
-    "@eva-design/eva": "^1.0.1",
-    "expo": "^33.0.6",
-    "expo-analytics": "^1.0.8",
-    "expo-camera": "^5.0.1",
-    "expo-constants": "^5.0.1",
-    "expo-media-library": "^5.0.1",
-    "expo-permissions": "^5.0.1",
-    "react": "^16.8.3",
-    "react-native": "https://github.com/expo/react-native/archive/sdk-33.0.0.tar.gz",
+    "@eva-design/eva": "^1.2.0",
+    "@ui-kitten/eva-icons": "^4.2.0",
+    "expo": "^35.0.0",
+    "expo-analytics": "^1.0.11",
+    "expo-camera": "^7.0.0",
+    "expo-constants": "^7.0.0",
+    "expo-media-library": "^7.0.0",
+    "expo-permissions": "^7.0.0",
+    "react": "^16.8.6",
+    "react-native": "https://github.com/expo/react-native/archive/sdk-35.0.0.tar.gz",
+    "react-native-gesture-handler": "^1.3.0",
     "react-native-keyboard-aware-scroll-view": "^0.8.0",
-    "react-native-ui-kitten": "^4.1.0",
-    "react-navigation": "^3.11.0"
+    "react-native-reanimated": "^1.2.0",
+    "react-native-screens": "^1.0.0-alpha.23",
+    "react-native-svg": "^9.9.4",
+    "react-native-ui-kitten": "^4.2.0",
+    "react-navigation": "^4.0.10",
+    "react-navigation-stack": "^1.9.4",
+    "react-navigation-tabs": "^2.5.6"
   },
   "devDependencies": {
-    "@babel/core": "^7.1.2",
-    "@babel/runtime": "^7.1.2",
-    "@types/react": "^16.8.19",
-    "@types/react-native": "^0.57.60",
-    "@types/react-navigation": "^3.0.7",
+    "@babel/core": "^7.6.0",
+    "@babel/runtime": "^7.6.0",
+    "@types/react": "^16.9.2",
+    "@types/react-native": "^0.60.15",
+    "@types/react-navigation": "^3.0.8",
     "babel-core": "^7.0.0-bridge.0",
     "babel-plugin-module-resolver": "^3.2.0",
     "conventional-changelog-cli": "^2.0.21",
     "husky": "^1.1.2",
     "rimraf": "^2.6.2",
+    "scheduler": "^0.16.2",
     "tslint": "^5.12.1",
-    "typescript": "^3.5.1"
+    "typescript": "^3.6.3"
   }
 }
```

**File**: `src/app.component.tsx` (modified, +8/-3)
```diff
@@ -1,6 +1,5 @@
 import React from 'react';
 import { ImageRequireSource } from 'react-native';
-import { NavigationState } from 'react-navigation';
 import { mapping } from '@eva-design/eva';
 import { ApplicationProvider } from '@kitten/theme';
 import { DynamicStatusBar } from '@src/components/common';
@@ -10,14 +9,19 @@ import {
 } from './core/appLoader/applicationLoader.component';
 import { Router } from './core/navigation/routes';
 import { trackScreenTransition } from './core/utils/analytics';
-import { getCurrentStateName } from './core/navigation/util';
+import {
+  getCurrentStateName,
+  RouteState,
+} from './core/navigation/util';
 import {
   ThemeContext,
   ThemeContextType,
   ThemeKey,
   themes,
   ThemeStore,
 } from '@src/core/themes';
+import { IconRegistry } from '@kitten/ui';
+import { EvaIconsPack } from '@ui-kitten/eva-icons';
 
 const images: ImageRequireSource[] = [
   require('./assets/images/source/image-profile-1.jpg'),
@@ -59,7 +63,7 @@ export default class App extends React.Component<{}, State> {
     console.warn('Analytics error: ', error.message);
   };
 
-  private onNavigationStateChange = (prevState: NavigationState, currentState: NavigationState) => {
+  private onNavigationStateChange = (prevState: RouteState, currentState: RouteState) => {
     const prevStateName: string = getCurrentStateName(prevState);
     const currentStateName: string = getCurrentStateName(currentState);
 
@@ -83,6 +87,7 @@ export default class App extends React.Component<{}, State> {
 
     return (
       <ApplicationLoader assets={assets}>
+        <IconRegistry icons={EvaIconsPack}/>
         <ThemeContext.Provider value={contextValue}>
           <ApplicationProvider
             mapping={mapping}
```

**File**: `src/assets/icons/icon.component.tsx` (modified, +2/-2)
```diff
@@ -23,9 +23,9 @@ export class RemoteIcon implements IconSource {
   }
 }
 
-export type IconElement = React.ReactElement<ImageProps>;
+export type AssetIconElement = React.ReactElement<ImageProps>;
 
-export const Icon = (source: IconSource, style: StyleProp<ImageStyle>): React.ReactElement<ImageProps> => {
+export const AssetIcon = (source: IconSource, style: StyleProp<ImageStyle>): React.ReactElement<ImageProps> => {
   return (
     <Image
       style={style}
```

**File**: `src/assets/icons/index.ts` (removed, +0/-736)
```diff
@@ -1,736 +0,0 @@
-import {
-  ImageStyle,
-  StyleProp,
-} from 'react-native';
-import {
-  Icon,
-  IconElement,
-  IconSource,
-  RemoteIcon,
-} from './icon.component';
-
-export const MenuIconAuth = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-auth.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const MenuIconAuthDark = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-auth-dark.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const MenuIconSocial = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-social.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const MenuIconSocialDark = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-social-dark.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const MenuIconArticles = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-articles.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const MenuIconArticlesDark = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-articles-dark.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const MenuIconMessaging = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-messaging.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const MenuIconMessagingDark = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-messaging-dark.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const MenuIconDashboards = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-dashboards.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const MenuIconDashboardsDark = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-dashboards-dark.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const MenuIconEcommerce = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-ecommerce.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const MenuIconEcommerceDark = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-ecommerce-dark.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const ComponentsIconAvatar = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-avatar.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const ComponentsIconAvatarDark = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-avatar-dark.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const ComponentsIconButton = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-button.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const ComponentsIconButtonDark = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-button-dark.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const ComponentsIconButtonGroup = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-button-group.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const ComponentsIconButtonGroupDark = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-button-group-dark.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const ComponentsIconCheckBox = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-checkbox.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const ComponentsIconCheckBoxDark = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-checkbox-dark.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const ComponentsIconInput = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-input.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const ComponentsIconInputDark = (style: StyleProp<ImageStyle>): IconElement => {
-  const source: IconSource = {
-    imageSource: require('./icon-input-dark.png'),
-  };
-
-  return Icon(source, style);
-};
-
-export const ComponentsIconList = (style: StyleProp<ImageStyle>): IconElement => {
-  co
```

**File**: `src/assets/icons/index.tsx` (added, +650/-0)
```diff
@@ -0,0 +1,650 @@
+import React from 'react';
+import {
+  ImageProps,
+  ImageStyle,
+  StyleProp,
+} from 'react-native';
+import {
+  AssetIcon,
+  AssetIconElement,
+  IconSource,
+  RemoteIcon,
+} from './icon.component';
+import {
+  Icon,
+  IconElement,
+} from '@kitten/ui';
+
+export const MenuIconAuth = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-auth.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const MenuIconAuthDark = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-auth-dark.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const MenuIconSocial = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-social.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const MenuIconSocialDark = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-social-dark.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const MenuIconArticles = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-articles.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const MenuIconArticlesDark = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-articles-dark.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const MenuIconMessaging = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-messaging.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const MenuIconMessagingDark = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-messaging-dark.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const MenuIconDashboards = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-dashboards.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const MenuIconDashboardsDark = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-dashboards-dark.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const MenuIconEcommerce = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-ecommerce.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const MenuIconEcommerceDark = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-ecommerce-dark.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const ComponentsIconAvatar = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-avatar.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const ComponentsIconAvatarDark = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-avatar-dark.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const ComponentsIconButton = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-button.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const ComponentsIconButtonDark = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-button-dark.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const ComponentsIconButtonGroup = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-button-group.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const ComponentsIconButtonGroupDark = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-button-group-dark.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const ComponentsIconCheckBox = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-checkbox.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const ComponentsIconCheckBoxDark = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-checkbox-dark.png'),
+  };
+
+  return AssetIcon(source, style);
+};
+
+export const ComponentsIconInput = (style: StyleProp<ImageStyle>): AssetIconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-input.png'),
+  };
+
+  return AssetIcon(source, s
```

**File**: `src/components/messaging/chat.header.tsx` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 import React from 'react';
-import { NavigationScreenProps } from 'react-navigation';
+import { NavigationStackScreenProps } from 'react-navigation-stack';
 import {
   ThemedComponentProps,
   ThemeType,
@@ -31,7 +31,7 @@ export interface ChatHeaderNavigationStateParams {
   onProfile: (profile: Profile) => void;
 }
 
-export type ChatHeaderProps = ThemedComponentProps & ComponentProps & NavigationScreenProps;
+export type ChatHeaderProps = ThemedComponentProps & ComponentProps & NavigationStackScreenProps;
 
 class ChatHeaderComponent extends React.Component<ChatHeaderProps> {
 
```

**File**: `src/components/messaging/messageIcon.component.tsx` (modified, +4/-4)
```diff
@@ -1,10 +1,10 @@
 import React from 'react';
 import { ImageProps } from 'react-native';
 import {
+  StyleType,
+  ThemedComponentProps,
   ThemeType,
   withStyles,
-  ThemedComponentProps,
-  StyleType,
 } from '@kitten/theme';
 import { DoneAllIconOutline } from '@src/assets/icons';
 import { Message } from '@src/core/model';
@@ -21,12 +21,12 @@ export enum MessageIcons {
 const messageIcons: { [key in MessageIcons]: MessageIconProvider } = {
   [MessageIcons.READ]: {
     icon(style: StyleType): React.ReactElement<ImageProps> {
-      return DoneAllIconOutline([style.messageIndicatorIcon, style.messageIndicatorIconRead]);
+      return DoneAllIconOutline({ ...style.messageIndicatorIcon, ...style.messageIndicatorIconRead });
     },
   },
   [MessageIcons.DELIVERED]: {
     icon(style: StyleType): React.ReactElement<ImageProps> {
-      return DoneAllIconOutline([style.messageIndicatorIcon, style.messageIndicatorIconDelivered]);
+      return DoneAllIconOutline({ ...style.messageIndicatorIcon, ...style.messageIndicatorIconDelivered });
     },
   },
 };
```

---

### Incident Patch 12: `2f1706a9` (2019-09-30)
**Commit Message**: fix(components): validation-input - crash if onChangeText is undefined

**File**: `src/components/common/validationInput.component.tsx` (modified, +2/-2)
```diff
@@ -41,9 +41,9 @@ class ValidationInputComponent extends React.Component<ValidationInputProps, Sta
     const becomeValid: boolean = !this.isValid(oldValue) && this.isValid(newValue);
     const becomeInvalid: boolean = !this.isValid(newValue) && this.isValid(oldValue);
 
-    if (becomeValid) {
+    if (becomeValid && this.props.onChangeText) {
       this.props.onChangeText(newValue);
-    } else if (becomeInvalid) {
+    } else if (becomeInvalid && this.props.onChangeText) {
       this.props.onChangeText(undefined);
     }
   }
```

---

### Incident Patch 13: `0b03acb9` (2019-07-10)
**Commit Message**: feat(app): react-native-ui-kitten version update

**File**: `package-lock.json` (modified, +260/-250)
```diff
@@ -13,17 +13,17 @@
       }
     },
     "@babel/core": {
-      "version": "7.4.5",
-      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.4.5.tgz",
-      "integrity": "sha512-OvjIh6aqXtlsA8ujtGKfC7LYWksYSX8yQcM8Ay3LuvVeQ63lcOKgoZWVqcpFwkd29aYU9rVx7jxhfhiEDV9MZA==",
+      "version": "7.5.4",
+      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.5.4.tgz",
+      "integrity": "sha512-+DaeBEpYq6b2+ZmHx3tHspC+ZRflrvLqwfv8E3hNr5LVQoyBnL8RPKSBCg+rK2W2My9PWlujBiqd0ZPsR9Q6zQ==",
       "requires": {
         "@babel/code-frame": "^7.0.0",
-        "@babel/generator": "^7.4.4",
-        "@babel/helpers": "^7.4.4",
-        "@babel/parser": "^7.4.5",
+        "@babel/generator": "^7.5.0",
+        "@babel/helpers": "^7.5.4",
+        "@babel/parser": "^7.5.0",
         "@babel/template": "^7.4.4",
-        "@babel/traverse": "^7.4.5",
-        "@babel/types": "^7.4.4",
+        "@babel/traverse": "^7.5.0",
+        "@babel/types": "^7.5.0",
         "convert-source-map": "^1.1.0",
         "debug": "^4.1.0",
         "json5": "^2.1.0",
@@ -34,11 +34,11 @@
       }
     },
     "@babel/generator": {
-      "version": "7.4.4",
-      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.4.4.tgz",
-      "integrity": "sha512-53UOLK6TVNqKxf7RUh8NE851EHRxOOeVXKbK2bivdb+iziMyk03Sr4eaE9OELCbyZAAafAKPDwF2TPUES5QbxQ==",
+      "version": "7.5.0",
+      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.5.0.tgz",
+      "integrity": "sha512-1TTVrt7J9rcG5PMjvO7VEG3FrEoEJNHxumRq66GemPmzboLWtIjjcJgk8rokuAS7IiRSpgVSu5Vb9lc99iJkOA==",
       "requires": {
-        "@babel/types": "^7.4.4",
+        "@babel/types": "^7.5.0",
         "jsesc": "^2.5.1",
         "lodash": "^4.17.11",
         "source-map": "^0.5.0",
@@ -82,9 +82,9 @@
       }
     },
     "@babel/helper-create-class-features-plugin": {
-      "version": "7.4.4",
-      "resolved": "https://registry.npmjs.org/@babel/helper-create-class-features-plugin/-/helper-create-class-features-plugin-7.4.4.tgz",
-      "integrity": "sha512-UbBHIa2qeAGgyiNR9RszVF7bUHEdgS4JAUNT8SiqrAN6YJVxlOxeLr5pBzb5kan302dejJ9nla4RyKcR1XT6XA==",
+      "version": "7.5.0",
+      "resolved": "https://registry.npmjs.org/@babel/helper-create-class-features-plugin/-/helper-create-class-features-plugin-7.5.0.tgz",
+      "integrity": "sha512-EAoMc3hE5vE5LNhMqDOwB1usHvmRjCDAnH8CD4PVkX9/Yr3W/tcz8xE8QvdZxfsFBDICwZnF2UTHIqslRpvxmA==",
       "requires": {
         "@babel/helper-function-name": "^7.1.0",
         "@babel/helper-member-expression-to-functions": "^7.0.0",
@@ -241,29 +241,29 @@
       }
     },
     "@babel/helpers": {
-      "version": "7.4.4",
-      "resolved": "https://registry.npmjs.org/@babel/helpers/-/helpers-7.4.4.tgz",
-      "integrity": "sha512-igczbR/0SeuPR8RFfC7tGrbdTbFL3QTvH6D+Z6zNxnTe//GyqmtHmDkzrqDmyZ3eSwPqB/LhyKoU5DXsp+Vp2A==",
+      "version": "7.5.4",
+      "resolved": "https://registry.npmjs.org/@babel/helpers/-/helpers-7.5.4.tgz",
+      "integrity": "sha512-6LJ6xwUEJP51w0sIgKyfvFMJvIb9mWAfohJp0+m6eHJigkFdcH8duZ1sfhn0ltJRzwUIT/yqqhdSfRpCpL7oow==",
       "requires": {
         "@babel/template": "^7.4.4",
-        "@babel/traverse": "^7.4.4",
-        "@babel/types": "^7.4.4"
+        "@babel/traverse": "^7.5.0",
+        "@babel/types": "^7.5.0"
       }
     },
     "@babel/highlight": {
-      "version": "7.0.0",
-      "resolved": "https://registry.npmjs.org/@babel/highlight/-/highlight-7.0.0.tgz",
-      "integrity": "sha512-UFMC4ZeFC48Tpvj7C8UgLvtkaUuovQX+5xNWrsIoMG8o2z+XFKjKaN9iVmS84dPwVN00W4wPmqvYoZF3EGAsfw==",
+      "version": "7.5.0",
+      "resolved": "https://registry.npmjs.org/@babel/highlight/-/highlight-7.5.0.tgz",
+      "integrity": "sha512-7dV4eu9gBxoM0dAnj/BCFDW9LFU0zvTrkq0ugM7pnHEgguOEeOz1so2ZghEdzviYzQEED0r4EAgpsBChKy1TRQ==",
       "requires": {
         "chalk": "^2.0.0",
         "esutils": "^2.0.2",
         "js-tokens": "^4.0.0"
       }
     },
     "@babel/parser": {
-      "version": "7.4.5",
-      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.4.5.tgz",
-      "integrity": "sha512-9mUqkL1FF5T7f0WDFfAoDdiMVPWsdD1gZYzSnaXsxUCUqzuch/8of9G3VUSNiZmMBoRxT3neyVsqeiL/ZPcjew=="
+      "version": "7.5.0",
+      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.5.0.tgz",
+      "integrity": "sha512-I5nW8AhGpOXGCCNYGc+p7ExQIBxRFnS2fd/d862bNOKvmoEPjYPcfIjsfdy0ujagYOIYPczKgD9l3FsgTkAzKA=="
     },
     "@babel/plugin-external-helpers": {
       "version": "7.2.0",
@@ -284,11 +284,11 @@
       }
     },
     "@babel/plugin-proposal-class-properties": {
-      "version": "7.4.4",
-      "resolved": "https://registry.npmjs.org/@babel/plugin-proposal-class-properties/-/plugin-proposal-class-properties-7.4.4.tgz",
-      "integrity": "sha512-WjKTI8g8d5w1Bc9zgwSz2nfrsNQsXcCf9J9cdCvrJV6RF56yztwm4TmJC0MgJ9tvwO9gUA/mcYe89bLdGfiXFg==",
+      "version": "7.5.0",
+      "resolved": "https://registry.npmjs.org/@babel/plugin-proposal-class-properties/-/plugin-pr
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@
     "react": "^16.8.3",
     "react-native": "https://github.com/expo/react-native/archive/sdk-33.0.0.tar.gz",
     "react-native-keyboard-aware-scroll-view": "^0.8.0",
-    "react-native-ui-kitten": "^4.0.5",
+    "react-native-ui-kitten": "^4.1.0",
     "react-navigation": "^3.11.0"
   },
   "devDependencies": {
```

**File**: `src/assets/icons/index.ts` (modified, +16/-0)
```diff
@@ -345,6 +345,22 @@ export const ComponentsIconBottomNavigationDark = (style: StyleProp<ImageStyle>)
   return Icon(source, style);
 };
 
+export const ComponentsIconModal = (style: StyleProp<ImageStyle>): IconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-modal.png'),
+  };
+
+  return Icon(source, style);
+};
+
+export const ComponentsIconModalDark = (style: StyleProp<ImageStyle>): IconElement => {
+  const source: IconSource = {
+    imageSource: require('./icon-modal-dark.png'),
+  };
+
+  return Icon(source, style);
+};
+
 export const ArrowHeadDownIconFill = (style: StyleProp<ImageStyle>): IconElement => {
   const source: IconSource = {
     imageSource: require('./eva/arrowhead-down.png'),
```

**File**: `src/components/auth/socialAuth/socialAuthButton.component.tsx` (modified, +3/-3)
```diff
@@ -3,9 +3,9 @@ import {
   ImageProps,
   ImageStyle,
   StyleProp,
+  StyleSheet,
 } from 'react-native';
 import {
-  StyleType,
   ThemedComponentProps,
   ThemeType,
   withStyles,
@@ -23,10 +23,10 @@ export type SocialButtonProps = ThemedComponentProps & ButtonProps & ComponentPr
 
 class SocialAuthButtonComponent extends React.Component<SocialButtonProps> {
 
-  private renderIcon = (style: StyleType): React.ReactElement<ImageProps> => {
+  private renderIcon = (style: ImageStyle): React.ReactElement<ImageProps> => {
     const { icon, iconStyle } = this.props;
 
-    return icon([style, iconStyle]);
+    return icon({ ...style, ...StyleSheet.flatten(iconStyle) });
   };
 
   public render(): React.ReactNode {
```

**File**: `src/components/common/layoutMenu/layoutMenu.component.tsx` (modified, +0/-5)
```diff
@@ -72,15 +72,13 @@ class LayoutMenuComponent extends React.Component<LayoutMenuProps> {
           {...restProps}>
           <Tab icon={GridIconOutline}>
             <LayoutGridList
-              style={themedStyle.listContainer}
               contentContainerStyle={themedStyle.listContentContainer}
               data={data}
               onItemPress={this.onItemPress}
             />
           </Tab>
           <Tab icon={ListIconFill}>
             <LayoutList
-              style={themedStyle.listContainer}
               contentContainerStyle={themedStyle.listContentContainer}
               data={data}
               onItemPress={this.onItemPress}
@@ -93,9 +91,6 @@ class LayoutMenuComponent extends React.Component<LayoutMenuProps> {
 }
 
 export const LayoutMenu = withStyles(LayoutMenuComponent, (theme: ThemeType) => ({
-  listContainer: {
-    flex: 1,
-  },
   listContentContainer: {
     paddingHorizontal: 16,
     paddingVertical: 16,
```

**File**: `src/components/common/rateBar.component.tsx` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ class RateBarComponent extends React.Component<RateBarProps> {
 
     const isEnabled: boolean = index < value;
     const stateStyle: StyleType = isEnabled ? style.iconEnabled : style.iconDisabled;
-    const derivedStateStyle: StyleType = isEnabled ? iconStyle : iconDisabledStyle;
+    const derivedStateStyle: StyleProp<ImageStyle> = isEnabled ? iconStyle : iconDisabledStyle;
 
     return React.cloneElement(iconElement, {
       style: [style.icon, iconElement.props.style, stateStyle, derivedStateStyle],
```

**File**: `src/components/common/textIcon.component.tsx` (modified, +4/-3)
```diff
@@ -6,17 +6,17 @@ import {
   TextStyle,
   View,
   ViewProps,
+  StyleSheet,
 } from 'react-native';
 import {
-  StyleType,
   ThemedComponentProps,
   ThemeType,
   withStyles,
 } from '@kitten/theme';
 import { Text } from '@kitten/ui';
 import { textStyle } from './style';
 
-type IconProp = (style: StyleType) => React.ReactElement<ImageProps>;
+type IconProp = (style: StyleProp<ImageStyle>) => React.ReactElement<ImageProps>;
 
 interface ComponentProps {
   textStyle?: StyleProp<TextStyle>;
@@ -40,7 +40,8 @@ class TextIconComponent extends React.Component<TextIconProps> {
   public render(): React.ReactNode {
     const { style, themedStyle, textStyle: derivedTextStyle, iconStyle, icon, children } = this.props;
 
-    const iconElement = icon ? this.renderIconElement(icon, [themedStyle.icon, iconStyle]) : null;
+    const iconElement = icon ?
+      this.renderIconElement(icon, { ...themedStyle.icon, ...StyleSheet.flatten(iconStyle) }) : null;
 
     return (
       <View style={[themedStyle.container, style]}>
```

**File**: `src/containers/components/index.ts` (modified, +1/-0)
```diff
@@ -13,3 +13,4 @@ export { OverflowMenuContainer } from './overflowMenu/overflowMenu.container';
 export { ListContainer } from './list/list.container';
 export { TopNavigationContainer } from './topNavigation/topNavigation.container';
 export { BottomNavigationContainer } from './bottomNavigation/bottomNavigation.container';
+export { ModalContainer } from './modal/modal.container';
```

---

### Incident Patch 14: `22ba1b05` (2019-06-28)
**Commit Message**: build: update ui-kitten and eva versions

**File**: `package-lock.json` (modified, +14/-14)
```diff
@@ -928,19 +928,19 @@
       }
     },
     "@eva-design/dss": {
-      "version": "1.0.0",
-      "resolved": "https://registry.npmjs.org/@eva-design/dss/-/dss-1.0.0.tgz",
-      "integrity": "sha512-E5xdwYueY1HqVLmNBbwU9ZrsexglvSgpXSvhv+Nk9dHmHCrUl0ppdR1tGZ55Bk8NuF26Ev0WPRZFn3YSnwuXqQ=="
+      "version": "1.0.1",
+      "resolved": "https://registry.npmjs.org/@eva-design/dss/-/dss-1.0.1.tgz",
+      "integrity": "sha512-RSwSjZzirB8izDhDKod9kwinoB7p/Gq8JyMZeEGfHVZJH0DqmahdI2tNLQPd8igPgpP0AkHS4YFGVV1mF34RzQ=="
     },
     "@eva-design/eva": {
-      "version": "1.0.0",
-      "resolved": "https://registry.npmjs.org/@eva-design/eva/-/eva-1.0.0.tgz",
-      "integrity": "sha512-rcRCLTXEMCuflsUg8jcXWXzpGW+WmMqKit8OIY38K5EgJ9UhbdKScZz1GhtWW9PRaXcivbtYpvzFbuNfYBjTDQ=="
+      "version": "1.0.1",
+      "resolved": "https://registry.npmjs.org/@eva-design/eva/-/eva-1.0.1.tgz",
+      "integrity": "sha512-puz8ejPWvZMTZ0CjzCOASYdW6w9rP8CZ3C4uBqqyerdvIcTKZDoSJ71/DE3WiwSI735gIhZeVANo63lrWfqcUA=="
     },
     "@eva-design/processor": {
-      "version": "1.0.0",
-      "resolved": "https://registry.npmjs.org/@eva-design/processor/-/processor-1.0.0.tgz",
-      "integrity": "sha512-cibYxsnFuhwqBC92OJ2XVuykRCzSOAoI2FBSzZVHlyrYwojXzkdt9Sj7ftEUF+cLRc+3TCMGZEndi+A5XjS3jw=="
+      "version": "1.0.1",
+      "resolved": "https://registry.npmjs.org/@eva-design/processor/-/processor-1.0.1.tgz",
+      "integrity": "sha512-/eoR5QnqeR4eKE90jCnOABOtHsyhrpfKe34GYKe2P+GfiJhByz597QDqkG0oCUHJJud9TtauO6fNJnG+UXDEKg=="
     },
     "@expo/vector-icons": {
       "version": "10.0.2",
@@ -6779,12 +6779,12 @@
       }
     },
     "react-native-ui-kitten": {
-      "version": "4.0.4",
-      "resolved": "https://registry.npmjs.org/react-native-ui-kitten/-/react-native-ui-kitten-4.0.4.tgz",
-      "integrity": "sha512-MqZvk/aT8i8fsMLAum7OhCGmCTTCvcBZbVa5NFiYMTjeCbo3ehkaCYY1xoTX0y4C2hWDZqyeggJp/BCG63kK2A==",
+      "version": "4.0.5",
+      "resolved": "https://registry.npmjs.org/react-native-ui-kitten/-/react-native-ui-kitten-4.0.5.tgz",
+      "integrity": "sha512-0/5ss6bexFHcvLJJ5OId7eTbnqz3SOjzPY+UuGa4AW3I01b0Llx6Xp6SriRtpo8LmMB78XpawOCg6t4tutv5nA==",
       "requires": {
-        "@eva-design/dss": "1.0.0",
-        "@eva-design/processor": "1.0.0",
+        "@eva-design/dss": "^1.0.1",
+        "@eva-design/processor": "^1.0.1",
         "hoist-non-react-statics": "^3.2.1",
         "lodash.merge": "^4.6.1"
       },
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -20,7 +20,7 @@
     "version:changelog": "npm run conventional-changelog -- -i ./CHANGELOG.md -s"
   },
   "dependencies": {
-    "@eva-design/eva": "1.0.0",
+    "@eva-design/eva": "^1.0.1",
     "expo": "^33.0.6",
     "expo-analytics": "^1.0.8",
     "expo-camera": "^5.0.1",
@@ -30,7 +30,7 @@
     "react": "^16.8.3",
     "react-native": "https://github.com/expo/react-native/archive/sdk-33.0.0.tar.gz",
     "react-native-keyboard-aware-scroll-view": "^0.8.0",
-    "react-native-ui-kitten": "^4.0.4",
+    "react-native-ui-kitten": "^4.0.5",
     "react-navigation": "^3.11.0"
   },
   "devDependencies": {
```

---

### Incident Patch 15: `e6e6a5a4` (2019-06-28)
**Commit Message**: build(app): update ui-kitten version

**File**: `package-lock.json` (modified, +33/-14)
```diff
@@ -3585,7 +3585,8 @@
         },
         "ansi-regex": {
           "version": "2.1.1",
-          "bundled": true
+          "bundled": true,
+          "optional": true
         },
         "aproba": {
           "version": "1.2.0",
@@ -3603,11 +3604,13 @@
         },
         "balanced-match": {
           "version": "1.0.0",
-          "bundled": true
+          "bundled": true,
+          "optional": true
         },
         "brace-expansion": {
           "version": "1.1.11",
           "bundled": true,
+          "optional": true,
           "requires": {
             "balanced-match": "^1.0.0",
             "concat-map": "0.0.1"
@@ -3620,15 +3623,18 @@
         },
         "code-point-at": {
           "version": "1.1.0",
-          "bundled": true
+          "bundled": true,
+          "optional": true
         },
         "concat-map": {
           "version": "0.0.1",
-          "bundled": true
+          "bundled": true,
+          "optional": true
         },
         "console-control-strings": {
           "version": "1.1.0",
-          "bundled": true
+          "bundled": true,
+          "optional": true
         },
         "core-util-is": {
           "version": "1.0.2",
@@ -3731,7 +3737,8 @@
         },
         "inherits": {
           "version": "2.0.3",
-          "bundled": true
+          "bundled": true,
+          "optional": true
         },
         "ini": {
           "version": "1.3.5",
@@ -3741,6 +3748,7 @@
         "is-fullwidth-code-point": {
           "version": "1.0.0",
           "bundled": true,
+          "optional": true,
           "requires": {
             "number-is-nan": "^1.0.0"
           }
@@ -3753,17 +3761,20 @@
         "minimatch": {
           "version": "3.0.4",
           "bundled": true,
+          "optional": true,
           "requires": {
             "brace-expansion": "^1.1.7"
           }
         },
         "minimist": {
           "version": "0.0.8",
-          "bundled": true
+          "bundled": true,
+          "optional": true
         },
         "minipass": {
           "version": "2.3.5",
           "bundled": true,
+          "optional": true,
           "requires": {
             "safe-buffer": "^5.1.2",
             "yallist": "^3.0.0"
@@ -3780,6 +3791,7 @@
         "mkdirp": {
           "version": "0.5.1",
           "bundled": true,
+          "optional": true,
           "requires": {
             "minimist": "0.0.8"
           }
@@ -3852,7 +3864,8 @@
         },
         "number-is-nan": {
           "version": "1.0.1",
-          "bundled": true
+          "bundled": true,
+          "optional": true
         },
         "object-assign": {
           "version": "4.1.1",
@@ -3862,6 +3875,7 @@
         "once": {
           "version": "1.4.0",
           "bundled": true,
+          "optional": true,
           "requires": {
             "wrappy": "1"
           }
@@ -3937,7 +3951,8 @@
         },
         "safe-buffer": {
           "version": "5.1.2",
-          "bundled": true
+          "bundled": true,
+          "optional": true
         },
         "safer-buffer": {
           "version": "2.1.2",
@@ -3967,6 +3982,7 @@
         "string-width": {
           "version": "1.0.2",
           "bundled": true,
+          "optional": true,
           "requires": {
             "code-point-at": "^1.0.0",
             "is-fullwidth-code-point": "^1.0.0",
@@ -3984,6 +4000,7 @@
         "strip-ansi": {
           "version": "3.0.1",
           "bundled": true,
+          "optional": true,
           "requires": {
             "ansi-regex": "^2.0.0"
           }
@@ -4022,11 +4039,13 @@
         },
         "wrappy": {
           "version": "1.0.2",
-          "bundled": true
+          "bundled": true,
+          "optional": true
         },
         "yallist": {
           "version": "3.0.3",
-          "bundled": true
+          "bundled": true,
+          "optional": true
         }
       }
     },
@@ -6760,9 +6779,9 @@
       }
     },
     "react-native-ui-kitten": {
-      "version": "4.0.3",
-      "resolved": "https://registry.npmjs.org/react-native-ui-kitten/-/react-native-ui-kitten-4.0.3.tgz",
-      "integrity": "sha512-SbJnAuv5xAkGuZ9jvf4hdHxg8W2hQmClds2tlDNqI8cRtki1yZMrnaWMG2HL1fO4ukY+ilRMHBQh6AhZ/F9aqw==",
+      "version": "4.0.4",
+      "resolved": "https://registry.npmjs.org/react-native-ui-kitten/-/react-native-ui-kitten-4.0.4.tgz",
+      "integrity": "sha512-MqZvk/aT8i8fsMLAum7OhCGmCTTCvcBZbVa5NFiYMTjeCbo3ehkaCYY1xoTX0y4C2hWDZqyeggJp/BCG63kK2A==",
       "requires": {
         "@eva-design/dss": "1.0.0",
         "@eva-design/processor": "1.0.0",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@
     "react": "^16.8.3",
     "react-native": "https://github.com/expo/react-native/archive/sdk-33.0.0.tar.gz",
     "react-native-keyboard-aware-scroll-view": "^0.8.0",
-    "react-native-ui-kitten": "^4.0.3",
+    "react-native-ui-kitten": "^4.0.4",
     "react-navigation": "^3.11.0"
   },
   "devDependencies": {
```

#### Recent Merged Pull Requests:
- **PR #335** (closed): Update ui-kittten (@VladSt90)
- **PR #319** (2021-03-23): update: structure/captions (@whitestranger7)
- **PR #318** (closed): fix: remove warnings (@whitestranger7)
- **PR #317** (2021-03-02): update: bump Safe Area component to 3.1.9 (@whitestranger7)
- **PR #316** (2021-03-18): Bump Dependencies. Expo SDK 40 / React Native 0.63 (@artyorsh)
- **PR #315** (2021-02-13): fix: resolved build error due to misnamed .app file. (@johntimothybailey)
- **PR #314** (closed): refactor: update safeArea component (@whitestranger7)
- **PR #311** (2021-02-13): refactor: migration to ui-kitten v5 (@whitestranger7)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
