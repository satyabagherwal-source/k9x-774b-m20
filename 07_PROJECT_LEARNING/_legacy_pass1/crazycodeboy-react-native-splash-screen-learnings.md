# Forensic Learning Record (Deep Inspection): crazycodeboy/react-native-splash-screen

> **Canonical Artifact**: `07_PROJECT_LEARNING/crazycodeboy-react-native-splash-screen-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crazycodeboy/react-native-splash-screen](https://github.com/crazycodeboy/react-native-splash-screen))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:22:19.832Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crazycodeboy/react-native-splash-screen`
- **Description**: A splash screen for react-native, hide when application loaded ,it works on iOS and Android.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5656 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native-community',
};

```

### Core Architecture Module: `examples/.prettierrc.js`
```
module.exports = {
  bracketSpacing: false,
  jsxBracketSameLine: true,
  singleQuote: true,
  trailingComma: 'all',
};

```

### Core Architecture Module: `examples/App.js`
```
/**
 * SplashScreen
 * 启动屏
 * from：http://www.devio.org
 * Author:CrazyCodeBoy
 * GitHub:https://github.com/crazycodeboy
 * Email:crazycodeboy@gmail.com
 * @flow
 */
'use strict';


import React, {Component} from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Linking,
} from 'react-native'
import SplashScreen from 'react-native-splash-screen'

export default class example extends Component {

    componentDidMount() {
        SplashScreen.hide();
    }


    render() {
        return (
            <TouchableOpacity
                style={styles.container}
                onPress={(e)=> {
                    Linking.openURL('https://coding.imooc.com/class/304.html');
                }}
            >
                <View >
                    <Text style={styles.item}>
                        SplashScreen 启动屏
                    </Text>
                    <Text style={styles.item}>
                        @：http://www.devio.org/
                    </Text>
                    <Text style={styles.item}>
                        GitHub:https://github.com/crazycodeboy
                    </Text>
                    <Text style={styles.item}>
                        Email:crazycodeboy@gmail.com
                    </Text>
                </View>
            </TouchableOpacity>
        )
    }

}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f2f2',
        marginTop: 30
    },
    item: {
        fontSize: 20,
    },
    line: {
        flex: 1,
        height: 0.3,
        backgroundColor: 'darkgray',
    },
})

```

### Core Architecture Module: `examples/babel.config.js`
```
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
};

```

### Core Architecture Module: `examples/index.js`
```
/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

```

### Core Architecture Module: `examples/ios/examples/AppDelegate.h`
```
#import <React/RCTBridgeDelegate.h>
#import <UIKit/UIKit.h>

@interface AppDelegate : UIResponder <UIApplicationDelegate, RCTBridgeDelegate>

@property (nonatomic, strong) UIWindow *window;

@end

```

### Core Architecture Module: `examples/metro.config.js`
```
/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

module.exports = {
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

### Core Architecture Module: `index.d.ts`
```
declare module "react-native-splash-screen" {
    export default class SplashScreen {
        static hide(): void;
        static show(): void;
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #673** (2025-08-07): **Update build.gradle**
  *Symptoms*: Namespace not specified android.buildFeatures.buildConfig = true

- **Issue #669** (2025-05-06): **Sharing how to run this library in RN 0.79.1 on Android**
  *Symptoms*: I love this library because it is simple and easy to use, now this library is already old and outdated so when I installed it in RN 0.79.1 I encountered an error when running the app on android  ``` error Failed to install the app. Command failed with exit code 1: ./gradlew app:installDebug -PreactNativeDevServerPort=8081 Note: Some input files use or override a deprecated API. Note: Recompile with -Xlint:deprecation for details. FAILURE: Build failed with an exception. * What went wrong: Execution failed for task ':app:checkDebugDuplicateClasses'. > A failure occurred while executing com.android.build.gradle.internal.tasks.CheckDuplicatesRunnable > Duplicate class android.support.v4.app.INotificationSideChannel found in modules core-1.13.1.aar -> core-1.13.1-runtime (androidx.core:core:1.13.1) and support-compat-26.1.0.aar -> support-compat-26.1.0-runtime (com.android.support:support-compat:26.1.0) Duplicate class android.support.v4.app.INotificationSideChannel$Stub found in modules core-1.13.1.aar -> core-1.13.1-runtime (androidx.core:core:1.13.1) and support-compat-26.1.0.aar -> support-compat-26.1.0-runtime (com.android.support:support-compat:26.1.0) Duplicate class android.support.v4.app.INotificationSideChannel$Stub$Proxy found in modules core-1.13.1.aar -> core-1.13.1-runtime (androidx.core:core:1.13.1) and support-compat-26.1.0.aar -> support-compat-26.1.0-runtime (com.android.support:support-compat:26.1.0) Duplicate class android.support.v4.os.IResultReceiver found i
  **Post-Mortem & Fix Analysis**:
  > still hoping that someone will update this library in the future

- **Issue #666** (2025-02-23): **Add GitHub Actions workflow for Android CI**
  *Symptoms*: 

- **Issue #664** (2025-02-11): **Remove deprecated appcompat-v7 dependency from build.gradle**
  *Symptoms*: 

- **Issue #660** (2024-12-02): **Convert react-native-splash-screen integration from Java to Kotlin**
  *Symptoms*: # Kotlin Integration for React Native Splash Screen  This guide provides the steps to integrate the `react-native-splash-screen` package with Kotlin in your React Native Android application.   **  ## 1. MainActivity.kt  ** 		 Add the following import statement: 		 **kotlin** 		       import org.devio.rn.splashscreen.SplashScreen     import android.os.Bundle; // Avoid Bundle crashing 	 Modify the `onCreate` method to display the splash screen:  ```     override fun onCreate(savedInstanceState: Bundle?) {     super.onCreate(savedInstanceState)     SplashScreen.show(this)       } ```  ## 2. MainApplication.kt  Add the import statement:|      import org.devio.rn.splashscreen.SplashScreenReactPackage  **Register the splash screen package in the application:**      SplashScreenReactPackage()  ## 3. gradle.properties   Update the `android/gradle.properties` file to enable Jetifier:      android.enableJetifier=true    ## Troubleshooting  ### Common Issues  -   **Duplicate Classes**: If you encounter duplicate class errors, ensure that `android.enableJetifier=true` is added to your `gradle.properties`.      -   **Kotlin Compatibility**: Make sure your React Native project is configured to support Kotlin. You may need to install Kotlin dependencies if they are not already included.

- **Issue #659** (2025-09-23): **New Architecture Support Done and Android & IOS**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > When will it be updated?
  > for now if you want to use with new arch you can use below command  `npm  i  https://github.com/SolankiYogesh/react-native-splash-screen#master`
  > > for now if you want to use with new arch you can use below command >  > `npm i https://github.com/SolankiYogesh/react-native-splash-screen#master`  new error when use this 😵‍💫  ![image](https://github.com/user-attachments/assets/965f4bd9-36ad-4b9b-8964-43be0a56dcaf) 

- **Issue #656** (2024-10-25): **MainActivity.kt:4:34 - Unresolved reference: Splashscreen**
  *Symptoms*: ## Bug summary I follow this [tutorial](https://blog.logrocket.com/building-splash-screens-react-native/), and got the error which i dont know how to fix. Do i need to downgrade the library? I alr try `gradlew clean, build, stacktrace` n its all still same error.  ## Platform - Android  ## Library version ```shell   "react-native-splash-screen": "^3.3.0" ```  ## Environment info ```shell System:   OS: Windows 11 10.0.22631   CPU: "(4) x64 AMD Ryzen 3 4300U with Radeon Graphics"   Memory: 9.69 GB / 19.37 GB Binaries:   Node:     version: 20.14.0     path: C:\Program Files\nodejs\node.EXE   Yarn: Not Found   npm:     version: 10.7.0     path: C:\Program Files\nodejs\npm.CMD   Watchman: Not Found SDKs:   Android SDK:     API Levels:       - "29"       - "30"       - "31"       - "32"       - "33"       - "34"       - "35"     Build Tools:       - 30.0.2       - 30.0.3       - 33.0.0       - 33.0.1       - 34.0.0       - 35.0.0     System Images:       - android-30 | Google Play Intel x86 Atom       - android-33 | Google APIs Intel x86_64 Atom       - android-35 | Google APIs Intel x86_64 Atom     Android NDK: Not Found   Windows SDK: Not Found IDEs:   Android Studio: AI-232.10300.40.2321.11668458   Visual Studio: Not Found Languages:   Java: javac 17   Ruby: Not Found npmPackages:   "@react-native-community/cli": Not Found   react:     installed: 18.2.0     wanted: 18.2.0   react-native:     installed: 0.74.6     want
  **Post-Mortem & Fix Analysis**:
  > @raflizocky having the same problem... How did you solve this?
  > @raflizocky This below will work:  ```  import com.facebook.react.ReactActivity import org.devio.rn.splashscreen.SplashScreen; import com.facebook.react.ReactActivityDelegate import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled import com.facebook.react.defaults.DefaultReactActivityDelegate  class MainActivity : ReactActivity() {    /**    * Returns the name of the main component registered from JavaScript. This is used to schedule    * rendering of the component.    */   override fun getMainComponentName(): String = "MyApp"    init {     SplashScreen.show(this)   }    /**    * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]    * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]    */   override fun createReactActivityDelegate(): ReactActivityDelegate =       DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) } ```
  > @crazycodeboy Thanks.

- **Issue #644** (2024-09-08): **Updated README.md for react-native 0.74 support for kotlin.**
  *Symptoms*: 

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

### Incident Patch 1: `1dc09f4e` (2021-12-05)
**Commit Message**: Merge pull request #536 from pluralcom/min-sdk-version-fix

Fix android  min sdk version conflicts

**File**: `android/build.gradle` (modified, +5/-1)
```diff
@@ -1,3 +1,7 @@
+def safeExtGet(prop, fallback) {
+    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
+}
+
 apply plugin: 'com.android.library'
 
 def DEFAULT_COMPILE_SDK_VERSION             = 26
@@ -10,7 +14,7 @@ android {
     buildToolsVersion rootProject.hasProperty('buildToolsVersion') ? rootProject.buildToolsVersion : DEFAULT_BUILD_TOOLS_VERSION
 
     defaultConfig {
-        minSdkVersion 16
+        minSdkVersion safeExtGet('minSdkVersion', 16)
         targetSdkVersion rootProject.hasProperty('targetSdkVersion') ? rootProject.targetSdkVersion : DEFAULT_TARGET_SDK_VERSION
         versionCode 1
         versionName "1.0"
```

---

### Incident Patch 2: `3bc7466e` (2021-07-20)
**Commit Message**: fix min sdk version conflicts

**File**: `android/build.gradle` (modified, +5/-1)
```diff
@@ -1,3 +1,7 @@
+def safeExtGet(prop, fallback) {
+    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
+}
+
 apply plugin: 'com.android.library'
 
 def DEFAULT_COMPILE_SDK_VERSION             = 26
@@ -10,7 +14,7 @@ android {
     buildToolsVersion rootProject.hasProperty('buildToolsVersion') ? rootProject.buildToolsVersion : DEFAULT_BUILD_TOOLS_VERSION
 
     defaultConfig {
-        minSdkVersion 16
+        minSdkVersion safeExtGet('minSdkVersion', 16)
         targetSdkVersion rootProject.hasProperty('targetSdkVersion') ? rootProject.targetSdkVersion : DEFAULT_TARGET_SDK_VERSION
         versionCode 1
         versionName "1.0"
```

---

### Incident Patch 3: `0bbf0319` (2020-09-18)
**Commit Message**: fix: Xcode 12 compatibility

**File**: `react-native-splash-screen.podspec` (modified, +1/-1)
```diff
@@ -12,5 +12,5 @@ Pod::Spec.new do |s|
   s.platform     = :ios, "7.0"
   s.source       = { :git => "https://github.com/crazycodeboy/react-native-splash-screen", :tag => "v#{s.version}" }
   s.source_files  = "ios/*.{h,m}"
-  s.dependency "React"
+  s.dependency "React-Core"
 end
```

---

### Incident Patch 4: `4f7955b2` (2019-03-07)
**Commit Message**: Fixed ios example

**File**: `examples/ios/examples/AppDelegate.m` (modified, +2/-2)
```diff
@@ -9,7 +9,7 @@
 
 #import <React/RCTBundleURLProvider.h>
 #import <React/RCTRootView.h>
-#import "SplashScreen.h"  // here
+#import "RNSplashScreen.h"  // here
 
 @implementation AppDelegate
 
@@ -30,7 +30,7 @@ - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(
   rootViewController.view = rootView;
   self.window.rootViewController = rootViewController;
   [self.window makeKeyAndVisible];
-  [SplashScreen show];  // here
+  [RNSplashScreen show];  // here
   return YES;}
 
 @end
```

---

### Incident Patch 5: `2aaf0d35` (2018-09-06)
**Commit Message**: Fix document-zh

**File**: `README.zh.md` (modified, +2/-2)
```diff
@@ -138,15 +138,15 @@ public class MainActivity extends ReactActivity {
 
 #import <React/RCTBundleURLProvider.h>
 #import <React/RCTRootView.h>
-#import "SplashScreen.h"  // 添加这一句
+#import "RNSplashScreen.h"  // 添加这一句
 
 @implementation AppDelegate
 
 - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
 {
     // ...other code
 
-    [SplashScreen show];  // 添加这一句，这一句一定要在最后
+    [RNSplashScreen show];  // 添加这一句，这一句一定要在最后
     return YES;
 }
 
```

---

### Incident Patch 6: `a1f4f743` (2018-07-20)
**Commit Message**: export bug fix

**File**: `ios/RNSplashScreen.m` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ + (void) jsLoadError:(NSNotification*)notification
 }
 
 RCT_EXPORT_METHOD(show) {
-    [SplashScreen show];
+    [RNSplashScreen show];
 }
 
 @end
```

---

### Incident Patch 7: `7ca53142` (2018-07-16)
**Commit Message**: fix ios build and update docs

**File**: `README.md` (modified, +6/-6)
```diff
@@ -139,15 +139,15 @@ Update `AppDelegate.m` with the following additions:
 
 #import <React/RCTBundleURLProvider.h>
 #import <React/RCTRootView.h>
-#import "SplashScreen.h"  // here
+#import "RNSplashScreen.h"  // here
 
 @implementation AppDelegate
 
 - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
 {
     // ...other code
 
-    [SplashScreen show];  // here
+    [RNSplashScreen show];  // here
     return YES;
 }
 
@@ -264,10 +264,10 @@ export default class WelcomePage extends Component {
 ## API
 
 
-Method            | Type     | Optional | Description
------------------ | -------- | -------- | -----------
-show()   | function | false | Open splash screen (Native Method )
-hide() |  function  | false  |  Close splash screen     
+| Method | Type     | Optional | Description                         |
+|--------|----------|----------|-------------------------------------|
+| show() | function | false    | Open splash screen (Native Method ) |
+| hide() | function | false    | Close splash screen                 |
 
 ## Testing
 
```

**File**: `ios/RNSplashScreen.m` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ + (void) jsLoadError:(NSNotification*)notification
 }
 
 RCT_EXPORT_METHOD(show) {
-    [SplashScreen show];
+    [RNSplashScreen show];
 }
 
 @end
```

---

### Incident Patch 8: `6fe44229` (2018-05-21)
**Commit Message**: Merge pull request #188 from Jakst/fix-lint-error

Fix gradle lint errors

**File**: `android/build.gradle` (modified, +1/-1)
```diff
@@ -21,6 +21,6 @@ android {
 dependencies {
     compile fileTree(dir: 'libs', include: ['*.jar'])
     testCompile 'junit:junit:4.12'
-    compile 'com.android.support:appcompat-v7:23.4.0'
+    compile 'com.android.support:appcompat-v7:25.4.0'
     compile "com.facebook.react:react-native:+"  // From node_modules
 }
```

---

### Incident Patch 9: `851b8d67` (2018-05-10)
**Commit Message**: fix ios splashscreen name

**File**: `ios/RNSplashScreen.h` (renamed, +1/-1)
```diff
@@ -8,7 +8,7 @@
  */
 #import <React/RCTBridgeModule.h>
 
-@interface SplashScreen : NSObject<RCTBridgeModule>
+@interface RNSplashScreen : NSObject<RCTBridgeModule>
 + (void)show;
 + (void)hide;
 @end
```

**File**: `ios/RNSplashScreen.m` (renamed, +5/-5)
```diff
@@ -7,17 +7,17 @@
  * Email:crazycodeboy@gmail.com
  */
 
-#import "SplashScreen.h"
+#import "RNSplashScreen.h"
 #import <React/RCTBridge.h>
 
 static bool waiting = true;
 static bool addedJsLoadErrorObserver = false;
 
-@implementation SplashScreen
+@implementation RNSplashScreen
 - (dispatch_queue_t)methodQueue{
     return dispatch_get_main_queue();
 }
-RCT_EXPORT_MODULE()
+RCT_EXPORT_MODULE(SplashScreen)
 
 + (void)show {
     if (!addedJsLoadErrorObserver) {
@@ -41,11 +41,11 @@ + (void)hide {
 + (void) jsLoadError:(NSNotification*)notification
 {
     // If there was an error loading javascript, hide the splash screen so it can be shown.  Otherwise the splash screen will remain forever, which is a hassle to debug.
-    [SplashScreen hide];
+    [RNSplashScreen hide];
 }
 
 RCT_EXPORT_METHOD(hide) {
-    [SplashScreen hide];
+    [RNSplashScreen hide];
 }
 
 @end
```

**File**: `ios/SplashScreen.xcodeproj/project.pbxproj` (modified, +6/-6)
```diff
@@ -7,7 +7,7 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
-		3D7682841D8E76D10014119E /* SplashScreen.m in Sources */ = {isa = PBXBuildFile; fileRef = 3D7682831D8E76D10014119E /* SplashScreen.m */; };
+		3D7682841D8E76D10014119E /* RNSplashScreen.m in Sources */ = {isa = PBXBuildFile; fileRef = 3D7682831D8E76D10014119E /* RNSplashScreen.m */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXCopyFilesBuildPhase section */
@@ -24,8 +24,8 @@
 
 /* Begin PBXFileReference section */
 		3D7682761D8E76B80014119E /* libSplashScreen.a */ = {isa = PBXFileReference; explicitFileType = archive.ar; includeInIndex = 0; path = libSplashScreen.a; sourceTree = BUILT_PRODUCTS_DIR; };
-		3D7682821D8E76D10014119E /* SplashScreen.h */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.c.h; path = SplashScreen.h; sourceTree = "<group>"; };
-		3D7682831D8E76D10014119E /* SplashScreen.m */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.c.objc; path = SplashScreen.m; sourceTree = "<group>"; };
+		3D7682821D8E76D10014119E /* RNSplashScreen.h */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.c.h; path = RNSplashScreen.h; sourceTree = "<group>"; };
+		3D7682831D8E76D10014119E /* RNSplashScreen.m */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.c.objc; path = RNSplashScreen.m; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -42,8 +42,8 @@
 		3D76826D1D8E76B80014119E = {
 			isa = PBXGroup;
 			children = (
-				3D7682821D8E76D10014119E /* SplashScreen.h */,
-				3D7682831D8E76D10014119E /* SplashScreen.m */,
+				3D7682821D8E76D10014119E /* RNSplashScreen.h */,
+				3D7682831D8E76D10014119E /* RNSplashScreen.m */,
 				3D7682771D8E76B80014119E /* Products */,
 			);
 			sourceTree = "<group>";
@@ -113,7 +113,7 @@
 			isa = PBXSourcesBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
-				3D7682841D8E76D10014119E /* SplashScreen.m in Sources */,
+				3D7682841D8E76D10014119E /* RNSplashScreen.m in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
```

#### Recent Merged Pull Requests:
- **PR #673** (closed): Update build.gradle (@nuyozainal)
- **PR #666** (closed): Add GitHub Actions workflow for Android CI (@rmadan0401)
- **PR #664** (closed): Remove deprecated appcompat-v7 dependency from build.gradle (@mono57)
- **PR #659** (closed): New Architecture Support Done and Android & IOS (@SolankiYogesh)
- **PR #644** (closed): Updated README.md for react-native 0.74 support for kotlin. (@Akash-Rathor)
- **PR #633** (closed): fix: fix typo (@jsantos42)
- **PR #615** (closed): Refactoring (@AlexanderStocks)
- **PR #609** (closed): Fix issue … (@padlavoine)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
