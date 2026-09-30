# Forensic Learning Record (Deep Inspection): akveo/kittenTricks

> **Canonical Artifact**: `07_PROJECT_LEARNING/akveo-kittentricks-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/akveo/kittenTricks](https://github.com/akveo/kittenTricks))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:12.962Z  
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

### Incident Patch 1: `f22a28a5` (2021-03-05)
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

### Incident Patch 2: `de0cd124` (2021-02-13)
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

### Incident Patch 3: `325125bc` (2021-02-13)
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

### Incident Patch 4: `8eabc166` (2020-01-22)
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

### Incident Patch 5: `e34a1ad1` (2020-01-16)
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

### Incident Patch 6: `a80fd934` (2019-10-17)
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

---

### Incident Patch 7: `44d1d834` (2019-10-17)
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

### Incident Patch 8: `2944e3e1` (2019-10-16)
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

### Incident Patch 9: `2f1706a9` (2019-09-30)
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

### Incident Patch 10: `23500388` (2019-06-25)
**Commit Message**: fix(navigation): navigation issues fix

**File**: `package-lock.json` (modified, +11/-30)
```diff
@@ -3585,8 +3585,7 @@
         },
         "ansi-regex": {
           "version": "2.1.1",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "aproba": {
           "version": "1.2.0",
@@ -3604,13 +3603,11 @@
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
@@ -3623,18 +3620,15 @@
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
@@ -3737,8 +3731,7 @@
         },
         "inherits": {
           "version": "2.0.3",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "ini": {
           "version": "1.3.5",
@@ -3748,7 +3741,6 @@
         "is-fullwidth-code-point": {
           "version": "1.0.0",
           "bundled": true,
-          "optional": true,
           "requires": {
             "number-is-nan": "^1.0.0"
           }
@@ -3761,20 +3753,17 @@
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
@@ -3791,7 +3780,6 @@
         "mkdirp": {
           "version": "0.5.1",
           "bundled": true,
-          "optional": true,
           "requires": {
             "minimist": "0.0.8"
           }
@@ -3864,8 +3852,7 @@
         },
         "number-is-nan": {
           "version": "1.0.1",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "object-assign": {
           "version": "4.1.1",
@@ -3875,7 +3862,6 @@
         "once": {
           "version": "1.4.0",
           "bundled": true,
-          "optional": true,
           "requires": {
             "wrappy": "1"
           }
@@ -3951,8 +3937,7 @@
         },
         "safe-buffer": {
           "version": "5.1.2",
-          "bundled": true,
-          "optional": true
+          "bundled": true
         },
         "safer-buffer": {
           "version": "2.1.2",
@@ -3982,7 +3967,6 @@
         "string-width": {
           "version": "1.0.2",
           "bundled": true,
-          "optional": true,
           "requires": {
             "code-point-at": "^1.0.0",
             "is-fullwidth-code-point": "^1.0.0",
@@ -4000,7 +3984,6 @@
         "strip-ansi": {
           "version": "3.0.1",
           "bundled": true,
-          "optional": true,
           "requires": {
             "ansi-regex": "^2.0.0"
           }
@@ -4039,13 +4022,11 @@
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

**File**: `src/containers/layouts/articles/container/articles.container.tsx` (modified, +5/-2)
```diff
@@ -2,7 +2,6 @@ import React from 'react';
 import { NavigationScreenProps } from 'react-navigation';
 import { Articles } from './articles.component';
 import { routes } from './routes';
-import { navigateAction } from '@src/core/navigation';
 
 interface State {
   selectedLayoutIndex: number;
@@ -15,6 +14,7 @@ export class ArticlesContainer extends React.Component<NavigationScreenProps, St
   };
 
   private data = routes;
+  private navigationKey: string = 'ArticlesContainer';
 
   private onCategorySelect = (selectedLayoutIndex: number) => {
     this.setState({ selectedLayoutIndex });
@@ -23,7 +23,10 @@ export class ArticlesContainer extends React.Component<NavigationScreenProps, St
   private onItemSelect = (index: number) => {
     const { [index]: selectedItem } = this.data;
 
-    this.props.navigation.dispatch(navigateAction(selectedItem.route));
+    this.props.navigation.navigate({
+      key: this.navigationKey,
+      routeName: selectedItem.route,
+    });
   };
 
   public render(): React.ReactNode {
```

**File**: `src/containers/layouts/auth/container/auth.container.tsx` (modified, +5/-2)
```diff
@@ -2,7 +2,6 @@ import React from 'react';
 import { NavigationScreenProps } from 'react-navigation';
 import { Auth } from './auth.component';
 import { routes } from './routes';
-import { navigateAction } from '@src/core/navigation';
 
 interface State {
   selectedLayoutIndex: number;
@@ -15,6 +14,7 @@ export class AuthContainer extends React.Component<NavigationScreenProps, State>
   };
 
   private data = routes;
+  private navigationKey: string = 'AuthContainer';
 
   private onCategorySelect = (selectedLayoutIndex: number) => {
     this.setState({ selectedLayoutIndex });
@@ -23,7 +23,10 @@ export class AuthContainer extends React.Component<NavigationScreenProps, State>
   private onItemSelect = (index: number) => {
     const { [index]: selectedItem } = this.data;
 
-    this.props.navigation.dispatch(navigateAction(selectedItem.route));
+    this.props.navigation.navigate({
+      key: this.navigationKey,
+      routeName: selectedItem.route,
+    });
   };
 
   public render(): React.ReactNode {
```

**File**: `src/containers/layouts/auth/signIn1/signIn1.container.tsx` (modified, +6/-2)
```diff
@@ -2,16 +2,20 @@ import React from 'react';
 import { NavigationScreenProps } from 'react-navigation';
 import { SignInForm1Data } from '@src/components/auth';
 import { SignIn1 } from './signIn1.component';
-import { navigateAction } from '@src/core/navigation';
 
 export class SignIn1Container extends React.Component<NavigationScreenProps> {
 
+  private navigationKey: string = 'SignIn1Container';
+
   private onSignInPress = (data: SignInForm1Data) => {
     this.props.navigation.goBack();
   };
 
   private onSignUpPress = () => {
-    this.props.navigation.dispatch(navigateAction('Sign Up 1'));
+    this.props.navigation.navigate({
+      routeName: 'Sign Up 1',
+      key: this.navigationKey,
+    });
   };
 
   private onGooglePress = () => {
```

**File**: `src/containers/layouts/auth/signIn2/signIn2.container.tsx` (modified, +10/-3)
```diff
@@ -2,20 +2,27 @@ import React from 'react';
 import { NavigationScreenProps } from 'react-navigation';
 import { SignInForm2Data } from '@src/components/auth';
 import { SignIn2 } from './signIn2.component';
-import { navigateAction } from '@src/core/navigation';
 
 export class SignIn2Container extends React.Component<NavigationScreenProps> {
 
+  private navigationKey: string = 'SignIn2Container';
+
   private onSignInPress = (data: SignInForm2Data) => {
     this.props.navigation.goBack();
   };
 
   private onSignUpPress = () => {
-    this.props.navigation.dispatch(navigateAction('Sign Up 2'));
+    this.props.navigation.navigate({
+      key: this.navigationKey,
+      routeName: 'Sign Up 2',
+    });
   };
 
   private onForgotPasswordPress = () => {
-    this.props.navigation.dispatch(navigateAction('Forgot Password'));
+    this.props.navigation.navigate({
+      key: this.navigationKey,
+      routeName: 'Forgot Password',
+    });
   };
 
   public render(): React.ReactNode {
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
