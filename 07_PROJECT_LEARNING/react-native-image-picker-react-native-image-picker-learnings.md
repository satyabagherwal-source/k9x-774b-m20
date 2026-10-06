# Forensic Learning Record (Deep Inspection): react-native-image-picker/react-native-image-picker

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-native-image-picker-react-native-image-picker-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-native-image-picker/react-native-image-picker](https://github.com/react-native-image-picker/react-native-image-picker))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:08:39.010Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-native-image-picker/react-native-image-picker`
- **Description**: :sunrise_over_mountains: A React Native module that allows you to use native UI to select media from the device library or directly from the camera.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8634 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ios/ImagePickerUtils.h`
```
#import "ImagePickerManager.h"
#import <Photos/Photos.h>

@class PHPickerConfiguration;

@interface ImagePickerUtils : NSObject

+ (BOOL)isSimulator;

+ (void)setupPickerFromOptions:(UIImagePickerController *)picker options:(NSDictionary *)options target:(RNImagePickerTarget)target;

+ (PHPickerConfiguration *)makeConfigurationFromOptions:(NSDictionary *)options target:(RNImagePickerTarget)target API_AVAILABLE(ios(14));

+ (NSString*)getFileType:(NSData*)imageData;

+ (UIImage*)resizeImage:(UIImage*)image maxWidth:(float)maxWidth maxHeight:(float)maxHeight;

+ (CGSize)getVideoDimensionsFromUrl:(NSURL *)url;

+ (NSString *) getFileTypeFromUrl:(NSURL *)url;

+ (NSString *) getFileSizeFromUrl:(NSURL *)url;

+ (PHAsset *)fetchPHAssetOnIOS13:(NSDictionary<NSString *,id> *)info;
    
@end

```

### Core Architecture Module: `example/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native',
};

```

### Core Architecture Module: `example/.prettierrc.js`
```
module.exports = {
  arrowParens: 'avoid',
  bracketSameLine: true,
  bracketSpacing: false,
  singleQuote: true,
  trailingComma: 'all',
};

```

### Core Architecture Module: `example/android/app/src/main/java/com/example/MainActivity.kt`
```
package com.example

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "example"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

```

### Core Architecture Module: `example/android/app/src/main/java/com/example/MainApplication.kt`
```
package com.example

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
  }
}

```

### Core Architecture Module: `example/babel.config.js`
```
module.exports = {
  presets: ['module:@react-native/babel-preset'],
};

```

### Core Architecture Module: `example/index.js`
```
/**
 * @format
 */

import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import App from './src/App';

AppRegistry.registerComponent(appName, () => App);

```

### Core Architecture Module: `example/index.web.ts`
```
import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

AppRegistry.runApplication(appName, {
  initialProps: {},
  rootTag: document.getElementById('app-root'),
});

```

### Core Architecture Module: `example/ios/example/AppDelegate.h`
```
#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>

@interface AppDelegate : RCTAppDelegate

@end

```

### Core Architecture Module: `example/jest.config.js`
```
module.exports = {
  preset: 'react-native',
};

```

### Core Architecture Module: `example/metro.config.js`
```
const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    extraNodeModules: new Proxy(
      {},
      {get: (_, name) => path.resolve('.', 'node_modules', name)},
    ),
  },
  watchFolders: [path.resolve('.'), path.resolve('..')],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

```

### Core Architecture Module: `example/src/App.tsx`
```
import * as React from 'react';
import {
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  TextInput,
  Text,
} from 'react-native';
import {DemoButton, DemoResponse, DemoTitle} from './components';

import * as ImagePicker from 'react-native-image-picker';

/* toggle includeExtra */
const includeExtra = true;

export default function App() {
  const [response, setResponse] = React.useState<any>(null);
  const [cameraPackage, setCameraPackage] = React.useState('');

  const onButtonPress = React.useCallback(
    (
      type: 'capture' | 'library',
      options: ImagePicker.ImageLibraryOptions | ImagePicker.CameraOptions,
    ) => {
      const finalOptions = {
        ...options,
        ...(Platform.OS === 'android' &&
          cameraPackage && {
            androidCameraPackage: cameraPackage,
          }),
      };

      if (type === 'capture') {
        ImagePicker.launchCamera(finalOptions, setResponse);
      } else {
        ImagePicker.launchImageLibrary(finalOptions, setResponse);
      }
    },
    [cameraPackage],
  );

  return (
    <SafeAreaView style={styles.container}>
      <DemoTitle>🌄 React Native Image Picker</DemoTitle>
      <ScrollView>
        <View style={styles.buttonContainer}>
          {actions.map(({title, type, options}) => (
            <DemoButton
              key={title}
              onPress={() => onButtonPress(type, options)}>
              {title}
            </DemoButton>
          ))}
        </View>

        {Platform.OS === 'android' && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Android Camera Package Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. net.sourceforge.opencamera"
              value={cameraPackage}
              onChangeText={setCameraPackage}
            />
          </View>
        )}

        <DemoResponse>{response}</DemoResponse>

        {response?.assets?.map(({uri}: {uri: string}) => (
          <View key={uri} style={styles.imageContainer}>
            <Image
              resizeMode="cover"
              resizeMethod="scale"
              style={styles.image}
              source={{uri}}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'aliceblue',
  },
  inputContainer: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  imageContainer: {
    marginVertical: 24,
    alignItems: 'center',
  },
  image: {
    width: 200,
    height: 200,
  },
});

interface Action {
  title: string;
  type: 'capture' | 'library';
  options: ImagePicker.CameraOptions | ImagePicker.ImageLibraryOptions;
}

const actions: Action[] = [
  {
    title: 'Take Image',
    type: 'capture',
    options: {
      saveToPhotos: true,
      mediaType: 'photo',
      includeBase64: false,
      includeExtra,
    },
  },
  {
    title: 'Select Image',
    type: 'library',
    options: {
      selectionLimit: 0,
      mediaType: 'photo',
      includeBase64: false,
      includeExtra,
    },
  },
  {
    title: 'Take Video',
    type: 'capture',
    options: {
      saveToPhotos: true,
      formatAsMp4: true,
      mediaType: 'video',
      includeExtra,
    },
  },
  {
    title: 'Select Video',
    type: 'library',
    options: {
      selectionLimit: 0,
      mediaType: 'video',
      formatAsMp4: true,
      includeExtra,
    },
  },
  {
    title: 'Select Image or Video\n(mixed)',
    type: 'library',
    options: {
      selectionLimit: 0,
      mediaType: 'mixed',
      includeExtra,
    },
  },
];

if (Platform.OS === 'ios') {
  actions.push({
    title: 'Take Image or Video\n(mixed)',
    type: 'capture',
    options: {
      saveToPhotos: true,
      mediaType: 'mixed',
      includeExtra,
      presentationStyle: 'fullScreen',
    },
  });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2405** (2026-05-23): **Android: SecurityException when picking from Google Photos with ACTION_GET_CONTENT due to setRequireOriginal URI permission mismatch**
  *Symptoms*: ## Description  When using `launchImageLibrary` on Android with `ACTION_GET_CONTENT` + `CATEGORY_OPENABLE`, selecting a photo from the **Google Photos** app fails silently. The picker closes and returns to the calling app with no image and no error surfaced to JavaScript.  ## Root Cause  In `Utils.getAppSpecificStorageUri`, `MediaStore.setRequireOriginal()` is called on the URI returned by Google Photos. Unlike standard MediaStore URIs, Google Photos content provider URIs (`content://com.google.android.apps.photos.contentprovider/...`) **do not throw** from `setRequireOriginal()` — instead they silently accept the call and return a modified URI with `?requireOriginal=1` appended.  When `ContentResolver.openInputStream()` is subsequently called on this modified URI, Android throws:  ``` java.lang.SecurityException: Permission Denial: reading com.google.android.apps.photos.contentprovider.impl.MediaContentProvider uri content://com.google.android.apps.photos.contentprovider/.../...?requireOriginal=1 from pid=..., uid=... requires the provider be exported, or grantUriPermission() ```  This happens because the `FLAG_GRANT_READ_URI_PERMISSION` granted by `ACTION_GET_CONTENT` is scoped to the **base URI** only. The `?requireOriginal=1` variant is treated as a different URI and does not inherit the permission grant.  The `SecurityException` is not caught in `copyUri` (which only catches `IOException`) and propagates up to the `RuntimeException` catch in `onAssetsObtained`, which inv
  **Post-Mortem & Fix Analysis**:
  > Filed in wrong repo by mistake, closing.

- **Issue #2400** (2026-07-05): **feat: add fileName to asset on web platform**
  *Symptoms*: ## Motivation (required)  On web this package does not provide `fileName` field in assets, this created problem in project I'm working on so I created a patch and decided to share it.  ## Test Plan (required)  That's the smallest possible fix, what kind of test plan are we talking about? `Blob` that was passed to `readFile` was actually a `File` and it has `name` property well supported in all major browsers https://developer.mozilla.org/en-US/docs/Web/API/File/name

- **Issue #2392** (2025-11-20): **[🐛] Photo gallery not opening on certain Android versions after PR #2304 (≥ 7.1.4)**
  *Symptoms*: ### Description  After implementing the changes from PR #2304 (AndroidX Photo Picker), the photo gallery is not opening at all on certain Android versions when calling launchImageLibrary.  ### How to repeat issue and example  - Install the library version that includes PR #2304 - Call launchImageLibrary on an affected Android device - The photo gallery does not open  Expected Behavior The photo gallery/picker should open, allowing users to select photos.  Workarounds that currently work : Downgrade to 7.1.3 or any version before the Photo Picker migration   ### Additional Information  - Image Picker version: ≥ 7.1.4 - React Native version: 0.77.2 - Platform: Android - Development Operating System: MACOS  

- **Issue #2383** (2026-01-25): **fix(ci): restrict permissions in ci workflow**
  *Symptoms*: Thanks for submitting a PR! Please read these instructions carefully:  - [x] Explain the **motivation** for making this change. - [x] Provide a **test plan** demonstrating that the code is solid. - [x] Match the **code formatting** of the rest of the codebase. - [x] Target the `main` branch, NOT a "stable" branch.  ## Motivation (required)  This change sets the `contents: read` permission in the GitHub Actions workflow file. By explicitly declaring this permission, the workflow aligns with [GitHub's least-privilege principle](https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/security-hardening-for-github-actions) and security best practices. It ensures that the CI pipeline only has read access to the repository contents, which is sufficient for most use cases and reduces the risk of accidental write access.  ## Test Plan (required)  - Verified that the GitHub Actions workflow still runs successfully after setting `permissions: contents: read`. - No functional change was introduced to the workflow logic.  [1]: https://medium.com/@martinkonicek/what-is-a-test-plan-8bfc840ec171#.y9lcuqqi9 

- **Issue #2377** (2025-05-23): **Support iCloud Photos**
  *Symptoms*: ## Motivation (required)  - Removed conditional compilation for PHPicker support and added API availability for iOS 14. - Updated permission checks for photo library access to include limited access. - Refactored image fetching methods to handle iCloud assets more effectively. - Introduced new utility methods for fetching image data and handling iCloud scenarios.  ## Test Plan (required) Select iCloud offload photos

- **Issue #2376** (2026-03-17): **feat(android): add support for specifying custom camera package**
  *Symptoms*: - [x] Explain the **motivation** for making this change. - [x] Provide a **test plan** demonstrating that the code is solid. - [x] Match the **code formatting** of the rest of the codebase. - [x] Target the `main` branch, NOT a "stable" branch.  ## Motivation  Added `androidCameraPackage` option to launchCamera to allow specifying a third-party camera app package (e.g., net.sourceforge.opencamera) for photo capture on Android. This addresses user requests in my app for using preferred camera apps. No package name validation is included to avoid requiring [additional permissions on android 11+](https://developer.android.com/training/package-visibility). Instead, developers can implement additional logic in their apps outside this library that allows the user to select an app from a list of installed apps.  ## Test Plan  1. Custom Camera App:     - Added input field for package name in example app.     - Entered `net.sourceforge.opencamera` and tapped the `Take Image` button     - Result: Open Camera launched, photo captured successfully. 2. Invalid Package:     - Entered invalid package name and tapped the `Take Image` button     - Result: Failed gracefully with errorCode: 'others'. 3. Default Camera:     - Left input field blank and tapped the `Take Image` button     - Result: Default camera launched successfully.  https://github.com/user-attachments/assets/4b80b654-57ae-4690-8d99-6eed9ffc2251 

- **Issue #2374** (2025-05-04): **fix(web): add stopCamera function to properly release media stream re…**
  *Symptoms*: …sources  Thanks for submitting a PR! Please read these instructions carefully:  - [x] Explain the **motivation** for making this change. - [x] Provide a **test plan** demonstrating that the code is solid. - [x] Match the **code formatting** of the rest of the codebase. - [x] Target the `main` branch, NOT a "stable" branch.  ## Motivation (required)  In the web camera still works even after closing the camera modal window. So we need to stop it every time when it is unused.  ## Test Plan (required)  Check that camera stops when you close the camera modal window and starts again when you opened it again. The camera status may be shown in your browser or like a light near your physical web camera. 
  **Post-Mortem & Fix Analysis**:
  > :tada: This PR is included in version 8.2.1 :tada:  The release is available on: - [npm package (@latest dist-tag)](https://www.npmjs.com/package/react-native-image-picker/v/8.2.1) - [GitHub release](https://github.com/react-native-image-picker/react-native-image-picker/releases/tag/v8.2.1)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #2373** (2025-05-02): **WEB fix: stop web camera after closing**
  *Symptoms*: Thanks for submitting a PR! Please read these instructions carefully:  - [x] Explain the **motivation** for making this change. - [x] Provide a **test plan** demonstrating that the code is solid. - [ ] Match the **code formatting** of the rest of the codebase. - [x] Target the `main` branch, NOT a "stable" branch.  ## Motivation (required)  In web camera still works even after closing the camera modal window. So we need to stop it every time when it is unused.   ## Test Plan (required)  Check that camera stops when you close the camera modal window and starts again when you opened it again. 

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

### Incident Patch 1: `d1e41a0d` (2025-05-04)
**Commit Message**: fix(web): add stopCamera function to properly release media stream resources (#2374)

**File**: `src/platforms/web.ts` (modified, +17/-2)
```diff
@@ -43,9 +43,12 @@ export function camera(
   const video = document.createElement('video');
   const canvas = document.createElement('canvas');
 
+  let currentMediaStream: MediaStream | null = null;
+
   // init video
   navigator.mediaDevices.getUserMedia({ audio: false, video: true })
     .then(stream => {
+      currentMediaStream = stream;
       video.srcObject = stream;
       video.play();
     }).catch(err => {
@@ -153,6 +156,18 @@ export function camera(
 
   handleButtons();
 
+  function stopCamera() {
+    document.body.removeChild(container);
+
+    if (!currentMediaStream) return;
+  
+    currentMediaStream.getTracks().forEach((track) => {
+      track.stop();
+    });
+    video.srcObject = null;
+    currentMediaStream = null;
+  }
+
   return new Promise((resolve) => {
     btnCapture.addEventListener('click', async () => {
       canvas.width = video.videoWidth;
@@ -176,7 +191,7 @@ export function camera(
       if (callback) callback(result);
       resolve(result);
 
-      document.body.removeChild(container);
+      stopCamera();
     })
     
     btnCancel.addEventListener('click', async () => {
@@ -188,7 +203,7 @@ export function camera(
       if (callback) callback(result);
       resolve(result);
 
-      document.body.removeChild(container);
+      stopCamera();
     })
   })
 }
```

---

### Incident Patch 2: `3454307d` (2024-12-09)
**Commit Message**: fix: video quality setting not working in mixed mode (#2339)

**File**: `ios/ImagePickerUtils.mm` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ @implementation ImagePickerUtils
 
 + (void) setupPickerFromOptions:(UIImagePickerController *)picker options:(NSDictionary *)options target:(RNImagePickerTarget)target
 {
-    if ([[options objectForKey:@"mediaType"] isEqualToString:@"video"]) {
+    if ([options[@"mediaType"] isEqualToString:@"video"] || [options[@"mediaType"] isEqualToString:@"mixed"]) {
 
         if ([[options objectForKey:@"videoQuality"] isEqualToString:@"high"]) {
             picker.videoQuality = UIImagePickerControllerQualityTypeHigh;
```

---

### Incident Patch 3: `9c22ee80` (2024-11-29)
**Commit Message**: fix(ios): add privacy manifest (#2292)

* chore(ios): add privacy manifest

add privacy manifest time stamp apis usage

* chore(ios): update podspec

add resource bundles to include PrivacyInfo as resource

---------

Co-authored-by: Johan du Toit <[REDACTED_EMAIL]>

**File**: `ios/PrivacyInfo.xcprivacy` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+	<key>NSPrivacyAccessedAPITypes</key>
+	<array>
+		<dict>
+			<key>NSPrivacyAccessedAPITypeReasons</key>
+			<array>
+				<string>3B52.1</string>
+			</array>
+			<key>NSPrivacyAccessedAPIType</key>
+			<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
+		</dict>
+	</array>
+	<key>NSPrivacyCollectedDataTypes</key>
+	<array>
+		<dict>
+			<key>NSPrivacyCollectedDataType</key>
+			<string>NSPrivacyCollectedDataTypePhotosorVideos</string>
+			<key>NSPrivacyCollectedDataTypeLinked</key>
+			<false/>
+			<key>NSPrivacyCollectedDataTypeTracking</key>
+			<false/>
+			<key>NSPrivacyCollectedDataTypePurposes</key>
+			<array>
+				<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
+			</array>
+		</dict>
+	</array>
+</dict>
+</plist>
```

**File**: `ios/RNImagePicker.xcodeproj/project.pbxproj` (modified, +2/-0)
```diff
@@ -28,6 +28,7 @@
 		014A3B691C6CF34500B6D375 /* ImagePickerManager.mm */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.cpp.objcpp; path = ImagePickerManager.mm; sourceTree = "<group>"; };
 		C1D0CF202509FCCD00304E19 /* ImagePickerUtils.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = ImagePickerUtils.h; sourceTree = "<group>"; };
 		C1D0CF212509FD5E00304E19 /* ImagePickerUtils.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; path = ImagePickerUtils.m; sourceTree = "<group>"; };
+		F25B96302BCE5E01004F10C5 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -48,6 +49,7 @@
 				C1D0CF202509FCCD00304E19 /* ImagePickerUtils.h */,
 				014A3B681C6CF34500B6D375 /* ImagePickerManager.h */,
 				014A3B691C6CF34500B6D375 /* ImagePickerManager.mm */,
+				F25B96302BCE5E01004F10C5 /* PrivacyInfo.xcprivacy */,
 				014A3B5D1C6CF33500B6D375 /* Products */,
 			);
 			sourceTree = "<group>";
```

**File**: `react-native-image-picker.podspec` (modified, +4/-0)
```diff
@@ -15,6 +15,10 @@ Pod::Spec.new do |s|
   s.source       = { :git => "https://github.com/react-native-image-picker/react-native-image-picker.git", :tag => "v#{s.version}" }
   s.source_files  = "ios/*.{h,m,mm}"
 
+  s.resource_bundles = {
+    'RNImagePickerPrivacyInfo' => ['ios/PrivacyInfo.xcprivacy'],
+  }
+
   s.frameworks   = 'Photos','PhotosUI', 'AVFoundation', 'CoreMedia'
 
   if defined?(install_modules_dependencies) != nil
```

---

### Incident Patch 4: `cccce566` (2024-11-28)
**Commit Message**: fix(2330): Update compileSdkVersion and targetSdkVersion (#2336)

**File**: `android/build.gradle` (modified, +3/-3)
```diff
@@ -8,7 +8,7 @@ if (isNewArchitectureEnabled()) {
 }
 
 android {
-    compileSdkVersion 33
+    compileSdkVersion 35
 
     def agpVersion = com.android.Version.ANDROID_GRADLE_PLUGIN_VERSION
     if (agpVersion.tokenize('.')[0].toInteger() >= 7) {
@@ -25,8 +25,8 @@ android {
     }
 
     defaultConfig {
-        minSdkVersion safeExtGet('minSdkVersion', 21)
-        targetSdkVersion 33
+        minSdkVersion safeExtGet('minSdkVersion', 24)
+        targetSdkVersion 34
         versionCode 1
         versionName "1.0"
         buildConfigField "boolean", "IS_NEW_ARCHITECTURE_ENABLED", isNewArchitectureEnabled().toString()
```

**File**: `android/gradle.properties` (modified, +0/-5)
```diff
@@ -1,9 +1,4 @@
 POWERMOCK_VERSION=1.6.6
 
-ReactNativeImagePicker_compileSdkVersion=28
-ReactNativeImagePicker_buildToolsVersion=28.0.3
-ReactNativeImagePicker_targetSdkVersion=27
-ReactNativeImagePicker_minSdkVersion=16
-
 android.useAndroidX=true
 android.enableJetifier=true
```

---

### Incident Patch 5: `82275dbb` (2024-11-28)
**Commit Message**: fix(web): Cancelling image picker does not resolve the promise (#2319)

The `cancel` input event is not handled, so if the user attempts to
cancel the picking process, the promise that the library returns will
never be resolved. Most likely this will result in app code that is
stuck waiting for the user to make a selection.

**File**: `src/platforms/web.ts` (modified, +16/-2)
```diff
@@ -61,7 +61,7 @@ export function imageLibrary(
   document.body.appendChild(input);
 
   return new Promise((resolve) => {
-    input.addEventListener('change', async () => {
+    const inputChangeHandler = async () => {
       if (input.files) {
         if (options.selectionLimit! <= 1) {
           const img = await readFile(input.files[0], {
@@ -90,8 +90,22 @@ export function imageLibrary(
           resolve(result);
         }
       }
+      cleanup();
+    };
+
+    const inputCancelHandler = async () => {
+      resolve({didCancel: true});
+      cleanup();
+    };
+
+    const cleanup = () => {
+      input.removeEventListener('change', inputChangeHandler);
+      input.removeEventListener('cancel', inputCancelHandler);
       document.body.removeChild(input);
-    });
+    };
+
+    input.addEventListener('change', inputChangeHandler);
+    input.addEventListener('cancel', inputCancelHandler);
 
     const event = new MouseEvent('click');
     input.dispatchEvent(event);
```

---

### Incident Patch 6: `20c3d925` (2024-11-28)
**Commit Message**: fix(ios): missing required frameworks (#2320)

**File**: `react-native-image-picker.podspec` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ Pod::Spec.new do |s|
   s.source       = { :git => "https://github.com/react-native-image-picker/react-native-image-picker.git", :tag => "v#{s.version}" }
   s.source_files  = "ios/*.{h,m,mm}"
 
-  s.frameworks   = 'Photos','PhotosUI'
+  s.frameworks   = 'Photos','PhotosUI', 'AVFoundation', 'CoreMedia'
 
   if defined?(install_modules_dependencies) != nil
     install_modules_dependencies(s)
```

---

### Incident Patch 7: `ff808fed` (2024-11-28)
**Commit Message**: fix(android): video timestamps have the wrong timzone (#2333)

The code previously dropped the timzone information (which was always GMT from my testing), but did not include it in the string date when parsing it, resulting in this GMT date being parsed with the current timezone.

With this fix, it is now correctly parsed as a GMT date.

I also updated the format to avoid having to replace the `T` as this can be processed correctly by the date parser.

**File**: `android/src/main/java/com/imagepicker/VideoMetadata.java` (modified, +3/-3)
```diff
@@ -41,9 +41,9 @@ public VideoMetadata(Uri uri, Context context) {
 
             if (datetime != null) {
                 // METADATA_KEY_DATE gives us the following format: "20211214T102646.000Z"
-                // This format is very hard to parse, so we convert it to "20211214 102646" ("yyyyMMdd HHmmss")
-                String datetimeToFormat = datetime.substring(0, datetime.indexOf(".")).replace("T", " ");
-                this.datetime = getDateTimeInUTC(datetimeToFormat, "yyyyMMdd HHmmss");
+                // This date is always returned in UTC, so we strip the ending that `SimpleDateFormat` can't parse, and append `+GMT`
+                String datetimeToFormat = datetime.substring(0, datetime.indexOf(".")) + "+GMT";
+                this.datetime = getDateTimeInUTC(datetimeToFormat, "yyyyMMdd'T'HHmmss+zzz");
             }
 
             String width = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH);
```

---

### Incident Patch 8: `e7140269` (2024-09-30)
**Commit Message**: fix: change minSdkVersion for RN 0.74.1 (#2302)

**File**: `android/build.gradle` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ android {
     }
 
     defaultConfig {
-        minSdkVersion 21
+        minSdkVersion safeExtGet('minSdkVersion', 21)
         targetSdkVersion 33
         versionCode 1
         versionName "1.0"
```

---

### Incident Patch 9: `6859d230` (2024-03-20)
**Commit Message**: fix(ios): Fix support for react-native 0.74 (#2284)

**File**: `ios/ImagePickerUtils.mm` (renamed, +1/-1)
```diff
@@ -22,7 +22,7 @@ + (void) setupPickerFromOptions:(UIImagePickerController *)picker options:(NSDic
     if (target == camera) {
         picker.sourceType = UIImagePickerControllerSourceTypeCamera;
 
-        if (options[@"durationLimit"] > 0) {
+        if ([options[@"durationLimit"] doubleValue] > 0) {
             picker.videoMaximumDuration = [options[@"durationLimit"] doubleValue];
         }
 
```

**File**: `react-native-image-picker.podspec` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ Pod::Spec.new do |s|
   s.source       = { :git => "https://github.com/react-native-image-picker/react-native-image-picker.git", :tag => "v#{s.version}" }
   s.source_files  = "ios/*.{h,m,mm}"
 
-  s.frameworks             = "MobileCoreServices"
+  s.frameworks   = 'Photos','PhotosUI'
 
   if defined?(install_modules_dependencies) != nil
     install_modules_dependencies(s)
```

---

### Incident Patch 10: `df78b9a6` (2024-03-13)
**Commit Message**: fix(ios): fix spec name when new architecture is enabled (#2252)

**File**: `ios/ImagePickerManager.h` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ RCT_ENUM_CONVERTER(
 #ifdef RCT_NEW_ARCH_ENABLED
 
 #import "RNImagePickerSpec.h"
-@interface ImagePickerManager : NSObject <RNImagePickerSpec>
+@interface ImagePickerManager : NSObject <NativeImagePickerSpec>
 @end
 
 #else
```

---

### Incident Patch 11: `ae2cdd7a` (2023-11-22)
**Commit Message**: fix: correct typo in variable name nativeImagePicler (#2240)

**File**: `src/platforms/native.ts` (modified, +3/-3)
```diff
@@ -26,7 +26,7 @@ const DEFAULT_OPTIONS: ImageLibraryOptions & CameraOptions = {
 // @ts-ignore We want to check whether __turboModuleProxy exitst, it may not
 const isTurboModuleEnabled = global.__turboModuleProxy != null;
 
-const nativeImagePicler = isTurboModuleEnabled ?
+const nativeImagePicker = isTurboModuleEnabled ?
   require("./NativeImagePicker").default :
   NativeModules.ImagePicker;
 
@@ -35,7 +35,7 @@ export function camera(
   callback?: Callback,
 ): Promise<ImagePickerResponse> {
   return new Promise((resolve) => {
-    nativeImagePicler.launchCamera(
+    nativeImagePicker.launchCamera(
       {...DEFAULT_OPTIONS, ...options},
       (result: ImagePickerResponse) => {
         if (callback) callback(result);
@@ -50,7 +50,7 @@ export function imageLibrary(
   callback?: Callback,
 ): Promise<ImagePickerResponse> {
   return new Promise((resolve) => {
-    nativeImagePicler.launchImageLibrary(
+    nativeImagePicker.launchImageLibrary(
       {...DEFAULT_OPTIONS, ...options},
       (result: ImagePickerResponse) => {
         if (callback) callback(result);
```

---

### Incident Patch 12: `13cdc7c1` (2023-10-23)
**Commit Message**: fix: correctly handle orientation on android (#2058)

* fix: android: use image orientation when computing the image width/height
* android: swap dimension also when doing the resize

**File**: `android/src/main/java/com/imagepicker/Utils.java` (modified, +21/-4)
```diff
@@ -156,10 +156,18 @@ public static void setFrontCamera(Intent intent) {
 
     public static int[] getImageDimensions(Uri uri, Context reactContext) {
         try (InputStream inputStream = reactContext.getContentResolver().openInputStream(uri)) {
+
+            String orientation = getOrientation(uri,reactContext);
+
             BitmapFactory.Options options = new BitmapFactory.Options();
             options.inJustDecodeBounds = true;
             BitmapFactory.decodeStream(inputStream, null, options);
-            return new int[]{options.outWidth, options.outHeight};
+            if (needToSwapDimension(orientation)) {
+                return new int[]{options.outHeight, options.outWidth};
+            }else {
+                return new int[]{options.outWidth, options.outHeight};
+            }
+
         } catch (IOException e) {
             e.printStackTrace();
             return new int[]{0, 0};
@@ -168,7 +176,7 @@ public static int[] getImageDimensions(Uri uri, Context reactContext) {
 
     static boolean hasPermission(final Activity activity) {
         final int writePermission = ActivityCompat.checkSelfPermission(activity, Manifest.permission.WRITE_EXTERNAL_STORAGE);
-        return writePermission == PackageManager.PERMISSION_GRANTED ? true : false;
+        return writePermission == PackageManager.PERMISSION_GRANTED;
     }
 
     static String getBase64String(Uri uri, Context reactContext) {
@@ -189,6 +197,11 @@ static String getBase64String(Uri uri, Context reactContext) {
         }
     }
 
+    private static boolean needToSwapDimension(String orientation){
+        return orientation.equals(String.valueOf(ExifInterface.ORIENTATION_ROTATE_90))
+                || orientation.equals(String.valueOf(ExifInterface.ORIENTATION_ROTATE_270));
+    }
+
     // Resize image
     // When decoding a jpg to bitmap all exif meta data will be lost, so make sure to copy orientation exif to new file else image might have wrong orientations
     public static Uri resizeImage(Uri uri, Context context, Options options) {
@@ -204,10 +217,14 @@ public static Uri resizeImage(Uri uri, Context context, Options options) {
             try (InputStream imageStream = context.getContentResolver().openInputStream(uri)) {
                 String mimeType = getMimeType(uri, context);
                 Bitmap b = BitmapFactory.decodeStream(imageStream);
-
-                b = Bitmap.createScaledBitmap(b, newDimens[0], newDimens[1], true);
                 String originalOrientation = getOrientation(uri, context);
 
+                if (needToSwapDimension(originalOrientation)) {
+                    b = Bitmap.createScaledBitmap(b, newDimens[1], newDimens[0], true);
+                }else {
+                    b = Bitmap.createScaledBitmap(b, newDimens[0], newDimens[1], true);
+                }
+
                 File file = createFile(context, getFileTypeFromMime(mimeType));
 
                 try (OutputStream os = context.getContentResolver().openOutputStream(Uri.fromFile(file))) {
```

---

### Incident Patch 13: `80e6e112` (2023-10-11)
**Commit Message**: fix(types): add missing attribute (#2222)

**File**: `src/types.ts` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@ export interface Asset {
   uri?: string;
   width?: number;
   height?: number;
+  originalPath?: string;
   fileSize?: number;
   type?: string;
   fileName?: string;
```

---

### Incident Patch 14: `444a10fd` (2023-09-07)
**Commit Message**: chore(formatting): fix on android (#2208)

**File**: `android/src/main/java/com/imagepicker/ImageMetadata.java` (modified, +29/-19)
```diff
@@ -3,30 +3,40 @@
 import android.content.Context;
 import android.net.Uri;
 import android.util.Log;
+
 import androidx.exifinterface.media.ExifInterface;
+
 import java.io.InputStream;
 
 public class ImageMetadata extends Metadata {
-  public ImageMetadata(Uri uri, Context context) {
-    try(InputStream inputStream = context.getContentResolver().openInputStream(uri)) {
-      ExifInterface exif = new ExifInterface(inputStream);
-      String datetimeTag = exif.getAttribute(ExifInterface.TAG_DATETIME);
-
-      // Extract anymore metadata here...
-      if(datetimeTag != null) this.datetime = getDateTimeInUTC(datetimeTag, "yyyy:MM:dd HH:mm:ss");
-    } catch (Exception e) {
-      // This error does not bubble up to RN as we don't want failed datetime retrieval to prevent selection
-      Log.e("RNIP", "Could not load image metadata: " + e.getMessage());
+    public ImageMetadata(Uri uri, Context context) {
+        try (InputStream inputStream = context.getContentResolver().openInputStream(uri)) {
+            ExifInterface exif = new ExifInterface(inputStream);
+            String datetimeTag = exif.getAttribute(ExifInterface.TAG_DATETIME);
+
+            // Extract anymore metadata here...
+            if (datetimeTag != null)
+                this.datetime = getDateTimeInUTC(datetimeTag, "yyyy:MM:dd HH:mm:ss");
+        } catch (Exception e) {
+            // This error does not bubble up to RN as we don't want failed datetime retrieval to prevent selection
+            Log.e("RNIP", "Could not load image metadata: " + e.getMessage());
+        }
     }
-  }
 
-  @Override
-  public String getDateTime() { return datetime; }
+    @Override
+    public String getDateTime() {
+        return datetime;
+    }
 
-  // At the moment we are not using the ImageMetadata class to get width/height
-  // TODO: to use this class for extracting image width and height in the future
-  @Override
-  public int getWidth() { return 0; }
-  @Override
-  public int getHeight() { return 0; }
+    // At the moment we are not using the ImageMetadata class to get width/height
+    // TODO: to use this class for extracting image width and height in the future
+    @Override
+    public int getWidth() {
+        return 0;
+    }
+
+    @Override
+    public int getHeight() {
+        return 0;
+    }
 }
```

**File**: `android/src/main/java/com/imagepicker/ImagePickerModuleImpl.java` (modified, +6/-5)
```diff
@@ -192,12 +192,12 @@ public void onActivityResult(Activity activity, int requestCode, int resultCode,
                 deleteFile(fileUri);
             }
             try {
-              callback.invoke(getCancelMap());
-              return;
+                callback.invoke(getCancelMap());
+                return;
             } catch (RuntimeException exception) {
-              callback.invoke(getErrorMap(errOthers, exception.getMessage()));
+                callback.invoke(getErrorMap(errOthers, exception.getMessage()));
             } finally {
-              callback = null;
+                callback = null;
             }
         }
 
@@ -225,5 +225,6 @@ public void onActivityResult(Activity activity, int requestCode, int resultCode,
     }
 
     @Override
-    public void onNewIntent(Intent intent) { }
+    public void onNewIntent(Intent intent) {
+    }
 }
```

**File**: `android/src/main/java/com/imagepicker/ImagePickerPackage.java` (modified, +2/-1)
```diff
@@ -1,6 +1,7 @@
 package com.imagepicker;
 
 import androidx.annotation.Nullable;
+
 import com.facebook.react.bridge.NativeModule;
 import com.facebook.react.bridge.ReactApplicationContext;
 import com.facebook.react.module.model.ReactModuleInfo;
@@ -37,7 +38,7 @@ public ReactModuleInfoProvider getReactModuleInfoProvider() {
                             true, // hasConstants
                             false, // isCxxModule
                             isTurboModule // isTurboModule
-            ));
+                    ));
             return moduleInfos;
         };
     }
```

**File**: `android/src/main/java/com/imagepicker/Metadata.java` (modified, +33/-31)
```diff
@@ -9,36 +9,38 @@
 import java.util.Locale;
 
 abstract class Metadata {
-  protected String datetime;
-  protected int height;
-  protected int width;
-
-  abstract public String getDateTime();
-  abstract public int getWidth();
-  abstract public int getHeight();
-
-  /**
-   * Converts a timestamp to a UTC timestamp
-   *
-   * @param value - timestamp
-   * @param format - input format
-   * @return formatted timestamp
-   */
-  protected @Nullable
-  String getDateTimeInUTC(String value, String format) {
-    try {
-      Date datetime = new SimpleDateFormat(format, Locale.US).parse(value);
-      SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", Locale.US);
-
-      if (datetime != null) {
-        return formatter.format(datetime);
-      }
-
-      return null;
-    } catch (Exception e) {
-      // This error does not bubble up to RN as we don't want failed datetime parsing to prevent selection
-      Log.e("RNIP", "Could not parse image datetime to UTC: " + e.getMessage());
-      return null;
+    protected String datetime;
+    protected int height;
+    protected int width;
+
+    abstract public String getDateTime();
+
+    abstract public int getWidth();
+
+    abstract public int getHeight();
+
+    /**
+     * Converts a timestamp to a UTC timestamp
+     *
+     * @param value  - timestamp
+     * @param format - input format
+     * @return formatted timestamp
+     */
+    protected @Nullable
+    String getDateTimeInUTC(String value, String format) {
+        try {
+            Date datetime = new SimpleDateFormat(format, Locale.US).parse(value);
+            SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", Locale.US);
+
+            if (datetime != null) {
+                return formatter.format(datetime);
+            }
+
+            return null;
+        } catch (Exception e) {
+            // This error does not bubble up to RN as we don't want failed datetime parsing to prevent selection
+            Log.e("RNIP", "Could not parse image datetime to UTC: " + e.getMessage());
+            return null;
+        }
     }
-  }
 }
```

**File**: `android/src/main/java/com/imagepicker/Options.java` (modified, +2/-1)
```diff
@@ -1,6 +1,7 @@
 package com.imagepicker;
 
 import com.facebook.react.bridge.ReadableMap;
+
 import android.text.TextUtils;
 
 public class Options {
@@ -24,7 +25,7 @@ public class Options {
         includeExtra = options.getBoolean("includeExtra");
 
         String videoQualityString = options.getString("videoQuality");
-        if(!TextUtils.isEmpty(videoQualityString) && !videoQualityString.toLowerCase().equals("high")) {
+        if (!TextUtils.isEmpty(videoQualityString) && !videoQualityString.toLowerCase().equals("high")) {
             videoQuality = 0;
         }
 
```

**File**: `android/src/main/java/com/imagepicker/Utils.java` (modified, +56/-49)
```diff
@@ -58,7 +58,7 @@ public class Utils {
 
     public static File createFile(Context reactContext, String fileType) {
         try {
-            String filename = fileNamePrefix  + UUID.randomUUID() + "." + fileType;
+            String filename = fileNamePrefix + UUID.randomUUID() + "." + fileType;
 
             // getCacheDir will auto-clean according to android docs
             File fileDir = reactContext.getCacheDir();
@@ -97,8 +97,8 @@ public static void saveToPublicDirectory(Uri uri, Context context, String mediaT
     }
 
     public static void copyUri(Uri fromUri, Uri toUri, ContentResolver resolver) {
-        try(OutputStream os = resolver.openOutputStream(toUri);
-            InputStream is = resolver.openInputStream(fromUri)) {
+        try (OutputStream os = resolver.openOutputStream(toUri);
+             InputStream is = resolver.openInputStream(fromUri)) {
 
             byte[] buffer = new byte[8192];
             int bytesRead;
@@ -133,7 +133,7 @@ public static Uri getAppSpecificStorageUri(Uri sharedStorageUri, Context context
             }
         }
 
-        Uri toUri =  Uri.fromFile(createFile(context, fileType));
+        Uri toUri = Uri.fromFile(createFile(context, fileType));
         copyUri(sharedStorageUri, toUri, contentResolver);
         return toUri;
     }
@@ -156,10 +156,10 @@ public static void setFrontCamera(Intent intent) {
     }
 
     public static int[] getImageDimensions(Uri uri, Context reactContext) {
-        try(InputStream inputStream = reactContext.getContentResolver().openInputStream(uri)) {
+        try (InputStream inputStream = reactContext.getContentResolver().openInputStream(uri)) {
             BitmapFactory.Options options = new BitmapFactory.Options();
             options.inJustDecodeBounds = true;
-            BitmapFactory.decodeStream(inputStream,null, options);
+            BitmapFactory.decodeStream(inputStream, null, options);
             return new int[]{options.outWidth, options.outHeight};
         } catch (IOException e) {
             e.printStackTrace();
@@ -173,8 +173,8 @@ static boolean hasPermission(final Activity activity) {
     }
 
     static String getBase64String(Uri uri, Context reactContext) {
-        try(InputStream inputStream = reactContext.getContentResolver().openInputStream(uri);
-            ByteArrayOutputStream output = new ByteArrayOutputStream()) {
+        try (InputStream inputStream = reactContext.getContentResolver().openInputStream(uri);
+             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
             byte[] bytes;
             byte[] buffer = new byte[8192];
             int bytesRead;
@@ -202,16 +202,16 @@ public static Uri resizeImage(Uri uri, Context context, Options options) {
 
             int[] newDimens = getImageDimensBasedOnConstraints(origDimens[0], origDimens[1], options);
 
-            try(InputStream imageStream = context.getContentResolver().openInputStream(uri)) {
-                String mimeType =  getMimeType(uri, context);
+            try (InputStream imageStream = context.getContentResolver().openInputStream(uri)) {
+                String mimeType = getMimeType(uri, context);
                 Bitmap b = BitmapFactory.decodeStream(imageStream);
 
                 b = Bitmap.createScaledBitmap(b, newDimens[0], newDimens[1], true);
                 String originalOrientation = getOrientation(uri, context);
 
                 File file = createFile(context, getFileTypeFromMime(mimeType));
 
-                try(OutputStream os = context.getContentResolver().openOutputStream(Uri.fromFile(file))) {
+                try (OutputStream os = context.getContentResolver().openOutputStream(Uri.fromFile(file))) {
                     b.compress(getBitmapCompressFormat(mimeType), options.quality, os);
                 }
 
@@ -265,7 +265,7 @@ static int[] getImageDimensBasedOnConstraints(int origWidth, int origHeight, Opt
     }
 
     static double getFileSize(Uri uri, Context context) {
-        try(ParcelFileDescriptor f = context.getContentResolver().openFileDescriptor(uri, "r")) {
+        try (ParcelFileDescriptor f = context.getContentResolver().openFileDescriptor(uri, "r")) {
             return f.getStatSize();
         } catch (Exception e) {
             e.printStackTrace();
@@ -287,8 +287,10 @@ static boolean shouldResizeImage(int origWidth, int origHeight, Options options)
 
     static Bitmap.CompressFormat getBitmapCompressFormat(String mimeType) {
         switch (mimeType) {
-            case "image/jpeg": return Bitmap.CompressFormat.JPEG;
-            case "image/png": return Bitmap.CompressFormat.PNG;
+            case "image/jpeg":
+                return Bitmap.CompressFormat.JPEG;
+            case "image/png":
+                return Bitmap.CompressFormat.PNG;
         }
         return Bitmap.CompressFormat.JPEG;
     }
@@ -298,9 +300,12 @@ static String getFileTypeFromMime(String mimeType) {
             return "jpg";
         }
         switch (mim
```

**File**: `android/src/main/java/com/imagepicker/VideoMetadata.java` (modified, +70/-60)
```diff
@@ -13,69 +13,79 @@
 // So let's use our own wrapper for it
 // See https://stackoverflow.com/a/74808462/1377358
 class CustomMediaMetadataRetriever extends MediaMetadataRetriever implements AutoCloseable {
-   public CustomMediaMetadataRetriever() {
-      super();
-   }
-
-   @Override
-   public void close() throws IOException {
-      release();
-   }
+    public CustomMediaMetadataRetriever() {
+        super();
+    }
+
+    @Override
+    public void close() throws IOException {
+        release();
+    }
 }
 
 public class VideoMetadata extends Metadata {
-  private int duration;
-  private int bitrate;
-
-  public VideoMetadata(Uri uri, Context context) {
-    try(CustomMediaMetadataRetriever metadataRetriever = new CustomMediaMetadataRetriever()) {
-      metadataRetriever.setDataSource(context, uri);
-
-      String duration = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
-      String bitrate = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE);
-      String datetime = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE);
-
-      // Extract anymore metadata here...
-      if(duration != null) this.duration = Math.round(Float.parseFloat(duration)) / 1000;
-      if(bitrate != null) this.bitrate = parseInt(bitrate);
-
-      if(datetime != null) {
-        // METADATA_KEY_DATE gives us the following format: "20211214T102646.000Z"
-        // This format is very hard to parse, so we convert it to "20211214 102646" ("yyyyMMdd HHmmss")
-        String datetimeToFormat = datetime.substring(0, datetime.indexOf(".")).replace("T", " ");
-        this.datetime = getDateTimeInUTC(datetimeToFormat, "yyyyMMdd HHmmss");
-      }
-
-      String width = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH);
-      String height = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT);
-
-      if(height != null && width != null) {
-        String rotation = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);
-        int rotationI = rotation == null ? 0 : Integer.parseInt(rotation);
-
-        if(rotationI == 90 || rotationI == 270) {
-          this.width = Integer.parseInt(height);
-          this.height = Integer.parseInt(width);
-        } else {
-          this.width = Integer.parseInt(width);
-          this.height = Integer.parseInt(height);
+    private int duration;
+    private int bitrate;
+
+    public VideoMetadata(Uri uri, Context context) {
+        try (CustomMediaMetadataRetriever metadataRetriever = new CustomMediaMetadataRetriever()) {
+            metadataRetriever.setDataSource(context, uri);
+
+            String duration = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
+            String bitrate = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE);
+            String datetime = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE);
+
+            // Extract anymore metadata here...
+            if (duration != null) this.duration = Math.round(Float.parseFloat(duration)) / 1000;
+            if (bitrate != null) this.bitrate = parseInt(bitrate);
+
+            if (datetime != null) {
+                // METADATA_KEY_DATE gives us the following format: "20211214T102646.000Z"
+                // This format is very hard to parse, so we convert it to "20211214 102646" ("yyyyMMdd HHmmss")
+                String datetimeToFormat = datetime.substring(0, datetime.indexOf(".")).replace("T", " ");
+                this.datetime = getDateTimeInUTC(datetimeToFormat, "yyyyMMdd HHmmss");
+            }
+
+            String width = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH);
+            String height = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT);
+
+            if (height != null && width != null) {
+                String rotation = metadataRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);
+                int rotationI = rotation == null ? 0 : Integer.parseInt(rotation);
+
+                if (rotationI == 90 || rotationI == 270) {
+                    this.width = Integer.parseInt(height);
+                    this.height = Integer.parseInt(width);
+                } else {
+                    this.width = Integer.parseInt(width);
+                    this.height = Integer.parseInt(height);
+                }
+            }
+        } catch (IOException e) {
+            e.printStackTrace();
         }
-      }
-    } catch (IOException e) {
-      e.printStackTrace();
     }
-  }
-
-  public int getBitrate() {
-    return bitrate;
-  }
-  public int getDuration() {
-    return duration;
-  }
-  @Override
-  public String getDateTime() { return datetime; }
-  @Override
-  public int getWidth() { return width; }
-  @Override
- 
```

---

### Incident Patch 15: `58aeb067` (2023-08-16)
**Commit Message**: fix(android): support rn version 0.68 (#2193)

Upgrading react-native-image-picker from 5.4.2 to 5.5.0 resulted in my app no longer building because of the following issue: `error: cannot find symbol new ImagePickerPackage()`

This issue was introduced here: 
https://github.com/react-native-image-picker/react-native-image-picker/commit/4584d7b0df4b859a73fc70aa2f17ba643885427f

My stack: 
Using react-native 0.68.2
Gradle 7.3.1
buildToolsVersion 33
compileSdkVersion 33
targetSdkVersion 33
minSdkVersion 24
kotlinVersion 1.7.0

**File**: `android/src/main/AndroidManifest.xml` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 <?xml version="1.0" encoding="utf-8"?>
 <manifest
   xmlns:android="http://schemas.android.com/apk/res/android"
+  package="com.imagepicker"
   >
     <application>
       <provider
```

#### Recent Merged Pull Requests:
- **PR #2400** (closed): feat: add fileName to asset on web platform (@anion155)
- **PR #2383** (closed): fix(ci): restrict permissions in ci workflow (@gcanlin)
- **PR #2377** (closed): Support iCloud Photos (@thanhcuong1990)
- **PR #2376** (2026-03-17): feat(android): add support for specifying custom camera package (@solokhind)
- **PR #2374** (2025-05-04): fix(web): add stopCamera function to properly release media stream re… (@Egor-Kozlov)
- **PR #2373** (closed): WEB fix: stop web camera after closing (@Egor-Kozlov)
- **PR #2357** (2025-02-16): feat: add support for converting image/heif to jpeg relates to #2264 (@andidev)
- **PR #2339** (2024-12-09): fix: video quality setting not working in mixed mode on iOS (@zhu-xiaowei)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
