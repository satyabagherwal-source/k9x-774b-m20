# Forensic Learning Record (Deep Inspection): react-native-maps/react-native-maps

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-native-maps-react-native-maps-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-native-maps/react-native-maps](https://github.com/react-native-maps/react-native-maps))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:31:56.754Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-native-maps/react-native-maps`
- **Description**: React Native Mapview component for iOS + Android
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 16005 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ios/AirMaps/AIRMapOverlayRenderer.h`
```
#import <MapKit/MapKit.h>

@interface AIRMapOverlayRenderer : MKOverlayRenderer

@property (nonatomic, assign) NSInteger rotation;
@property (nonatomic, assign) CGFloat transparency;

@end

```

### Core Architecture Module: `ios/AirMaps/AIRMapPolylineRenderer.h`
```
//
//  AIRMapPolylineRenderer.h
//  mapDemo
//
//  Created by IjzerenHein on 13-11-21.
//  Copyright (c) 2017 IjzerenHein. All rights reserved.
//

#import <MapKit/MapKit.h>

@interface AIRMapPolylineRenderer : MKOverlayPathRenderer

-(id)initWithOverlay:(id<MKOverlay>)overlay polyline:(MKPolyline*)polyline;
-(id)initWithSnapshot:(MKMapSnapshot*)snapshot overlay:(id<MKOverlay>)overlay polyline:(MKPolyline*)polyline;
-(void)drawWithZoomScale:(MKZoomScale)zoomScale inContext:(CGContextRef)context;

@property (nonatomic, strong) NSArray<UIColor *> *strokeColors;

@end

```

### Core Architecture Module: `ios/generated/RCTUnstableModulesRequiringMainQueueSetupProvider.h`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#import <Foundation/Foundation.h>

@interface RCTUnstableModulesRequiringMainQueueSetupProvider: NSObject

+(NSArray<NSString *> *)modules;

@end

```

### Core Architecture Module: `.detoxrc.js`
```
/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath:
        'example/ios/build/Build/Products/Debug-iphonesimulator/example.app',
      build:
        'xcodebuild -workspace example/ios/example.xcworkspace -scheme example -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath:
        'example/ios/build/Build/Products/Release-iphonesimulator/example.app',
      build:
        'xcodebuild -workspace example/ios/example.xcworkspace -scheme example -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'example/android/app/build/outputs/apk/debug/app-debug.apk',
      build:
        'cd example/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [8081],
    },
    'android.release': {
      type: 'android.apk',
      binaryPath:
        'example/android/app/build/outputs/apk/release/app-release.apk',
      build:
        'cd example/android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 14',
      },
    },
    attached: {
      type: 'android.attached',
      device: {
        adbName: '.*',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_3a_API_30_x86',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'android.att.debug': {
      device: 'attached',
      app: 'android.debug',
    },
    'android.att.release': {
      device: 'attached',
      app: 'android.release',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release',
    },
  },
};

```

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native',
  settings: {
    react: {
      version: '18.3.1',
    },
  },
};

```

### Core Architecture Module: `android/src/main/RCTAppDependencyProvider.h`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


#import <Foundation/Foundation.h>

#if __has_include(<React-RCTAppDelegate/RCTDependencyProvider.h>)
#import <React-RCTAppDelegate/RCTDependencyProvider.h>
#elif __has_include(<React_RCTAppDelegate/RCTDependencyProvider.h>)
#import <React_RCTAppDelegate/RCTDependencyProvider.h>
#else
#import "RCTDependencyProvider.h"
#endif

NS_ASSUME_NONNULL_BEGIN

@interface RCTAppDependencyProvider : NSObject <RCTDependencyProvider>

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `android/src/main/RCTModulesConformingToProtocolsProvider.h`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#import <Foundation/Foundation.h>

@interface RCTModulesConformingToProtocolsProvider: NSObject

+(NSArray<NSString *> *)imageURLLoaderClassNames;

+(NSArray<NSString *> *)imageDataDecoderClassNames;

+(NSArray<NSString *> *)URLRequestHandlerClassNames;

@end

```

### Core Architecture Module: `android/src/main/RCTThirdPartyComponentsProvider.h`
```
/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#import <Foundation/Foundation.h>

@protocol RCTComponentViewProtocol;

@interface RCTThirdPartyComponentsProvider: NSObject

+ (NSDictionary<NSString *, Class<RCTComponentViewProtocol>> *)thirdPartyFabricComponents;

@end

```

### Core Architecture Module: `app.plugin.js`
```
module.exports = require('./plugin/build');

```

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: ['module:@react-native/babel-preset'],
};

```

### Core Architecture Module: `e2e/jest.config.js`
```
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: 'react-native',
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.js'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
};

```

### Core Architecture Module: `example/android/app/src/main/java/com/rnmshowcase/MainActivity.kt`
```
package com.rnmshowcase

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "rnmshowcase"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5927** (2026-10-01): **Config plugin fails on Expo SDK 56: Cannot find module '@expo/config-plugins/build/plugins/ios-plugins'**
  *Symptoms*: ### Summary  When using the built-in Expo config plugin with Expo SDK 56, `npx expo prebuild` fails because the plugin imports from `@expo/config-plugins` internal paths directly. The package is not hoisted to the project root `node_modules`, so module resolution fails.  ### Reproducible sample code  ```TSX npx expo prebuild --clean ```  ### Steps to reproduce  1. Create an Expo SDK 56 project (or upgrade an existing one) 2. Install react-native-maps:   ```bash   npx expo install react-native-maps   ``` 3. Enable the config plugin in `app.config.ts`:   ```ts   import type { ExpoConfig } from 'expo/config';        export default (): ExpoConfig => ({     name: 'repro',     slug: 'repro',     plugins: [       [         'react-native-maps',         {           androidGoogleMapsApiKey: 'test-key',         },       ],     ],     });   ``` 5. Run:      ```bash   npx expo prebuild --clean   ```  ### Expected result  Prebuild should succeed without requiring @expo/config-plugins as a direct project dependency.  ### Actual result  Prebuild fails immediately with: ``` PluginError: Cannot find module '@expo/config-plugins/build/plugins/ios-plugins' Require stack: - node_modules/react-native-maps/plugin/build/ios.js - node_modules/react-native-maps/plugin/build/index.js - node_modules/react-native-maps/app.plugin.js ```  ### React Native Maps Version  1.27.2  ### What platforms are you seeing the problem on?  Android, iOS (Google Maps)  ### React Native Version  0.85.3  ### What version o
  **Post-Mortem & Fix Analysis**:
  > Looking at the `@expo/config-plugins` v56 exports map:  ``` './build/*': './build/*.js' ```  The `*` wildcard in newer Node.js versions should match `./build/plugins/ios-plugins`, so this works with Node ≥ 16 bundled resolvers. The issue is likely specific to how Expo SDK 56's auto-linking resolves transitive dependencies — `@expo/config-plugins` may not be hoisted to the project root.  **Two practical fixes:**  **Option 1 — Use the explicitly-exported subpath (preferred):** The `withAppDelegate`, `withInfoPlist`, and `withPodfile` functions are available from `@expo/config-plugins/build/ios-plugins` (note: `@expo/config-plugins/build/ios-plugins`, NOT `build/plugins/ios-plugins`). Wait — actually checking the tarball, they're still at `build/plugins/ios-plugins`. So the issue must be resolution-order related.  **Option 2 — Use a local wrapper that defers resolution:** Wrap the imports in a try/catch `createRequire` to resolve at the right scope:  ```ts function loadIosPlugins() {   tr
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. If the issue remains relevant, simply comment `Still relevant` and the issue will remain open. Thank you for your contributions.

- **Issue #5926** (2026-09-16): **UrlTile local caching with Google Maps on iOS**
  *Symptoms*: ### Summary  Hi, I’m using `UrlTile` with `provider={PROVIDER_GOOGLE}` on iOS for a custom weather overlay.  On Android, `UrlTile` supports `tileCachePath` and `tileCacheMaxAge`, and those props allow us to cache custom tile images locally.  On iOS with Google Maps, these props seem to be ignored. Looking at the native implementation, `AirGoogleMaps/AIRGoogleMapUrlTileManager.m` appears to export only `urlTemplate`, `zIndex`, `maximumZ`, `minimumZ`, and `flipY`.  Is there currently any supported way to achieve local caching for `UrlTile` when using Google Maps on iOS? For example, is there another prop, configuration, or recommended approach that I might be missing?  If this is not currently supported, would adding support for `tileCachePath` / `tileCacheMaxAge` for Google Maps on iOS be something that fits the direction of the library?  ### Example  ``` import RNFS from "react-native-fs"; import MapView, { PROVIDER_GOOGLE, UrlTile } from "react-native-maps";  const WEATHER_TILE_CACHE_MAX_AGE_SECONDS = 60 * 10;  <MapView provider={PROVIDER_GOOGLE}>   <UrlTile     urlTemplate="https://example.com/api/weather/overlays/now/{z}/{x}/{y}?region=eu"     tileCachePath={`${RNFS.CachesDirectoryPath}/weather-tiles/eu/now`}     tileCacheMaxAge={WEATHER_TILE_CACHE_MAX_AGE_SECONDS}     minimumZ={1}     maximumZ={12}     flipY={false}   /> </MapView> ```  ### Reproducible sample code  ```TSX import React from "react"; import { StyleSheet } from "react-native"; import RNFS from "react-native
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. If the issue remains relevant, simply comment `Still relevant` and the issue will remain open. Thank you for your contributions.

- **Issue #5925** (2026-09-16): **When showsIndoorLevelPicker is set to false, floor picker still shows**
  *Symptoms*: ### Summary  When showsIndoorLevelPicker is set to false, floor picker still shows. similar issue might also be with showsIndoors  ### Reproducible sample code  ```TSX <MapView         ref={mapRef}         showsCompass={false}         showsIndoorLevelPicker={false}         showsIndoors={false}         region={{           latitude: addAddressStore.address?.latitude ?? 0,           longitude: addAddressStore.address?.longitude ?? 0,           latitudeDelta: 0.001,           longitudeDelta: 0.001,         }}         initialRegion={{           latitude: addAddressStore.address?.latitude ?? 0,           longitude: addAddressStore.address?.longitude ?? 0,           latitudeDelta: 0.001,           longitudeDelta: 0.001,         }}         provider={PROVIDER_GOOGLE}         style={style.mapView}         onRegionChangeStart={onStartMapMove}         onRegionChangeComplete={onLand}>         {/* Show a single circle with a very light background around the coordinates */}         <Circle           center={{             latitude: addAddressStore.address.latitude,             longitude: addAddressStore.address.longitude,           }}           radius={FINAL_LIMIT}           fillColor={Colors.buttonBlue + '08'}           strokeColor={Colors.buttonBlue + '80'}           strokeWidth={2}         />       </MapView> ```  ### Steps to reproduce  Set showsIndoorLevelPicker to false and observe floor picker still visible  ### Expected result  The floor picker not showing  ### Actual result  Floor p
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. If the issue remains relevant, simply comment `Still relevant` and the issue will remain open. Thank you for your contributions.

- **Issue #5921** (2026-07-21): **[Android] map type regresses after map loses/regains focus**
  *Symptoms*: ### Summary  On Android, when a view that contains a MapView is hidden from view, the `mapType` reverts to the original type.  It does not matter which map type you switch from and to; the map always regresses to the type that was used on the first render.  This bug may be related to #5901         ### Reproducible sample code  ```TSX import { useState } from "react"; import { Button, Text, View } from "react-native"; import MapView from "react-native-maps"; import {   createStaticNavigation,   useNavigation, } from "@react-navigation/native"; import { createNativeStackNavigator } from "@react-navigation/native-stack";  const MapScreen = () => {   const [mapType, setMapType] = useState("standard");    const navigation = useNavigation();    const _changeMapType = () => {     setMapType(aCurrentType => {       if ("standard" === aCurrentType)         return "hybrid";        return "standard";     });   };    const _pushYellowScreen = () => {     navigation.navigate("Yellow");   };    return (     <View style={{flex: 1, backgroundColor: "white"}}>       <MapView         style={{flex: 1}}         mapType={mapType}         initialRegion={{latitude: 44.8, longitude: -85.6,                         latitudeDelta: 0.2, longitudeDelta: 0.2}}/>         <View style={{flexDirection: "column", alignItems: "center",                       paddingVertical: 20}}>           <Text>Requested Type: {mapType}</Text>           <View style={{height: 10}}/>           <Button title="Change Map Type" onP
  **Post-Mortem & Fix Analysis**:
  > I have the same problem!
  > Hi, this should have been fixed by https://github.com/react-native-maps/react-native-maps/pull/5879 and released in 1.28.2. Can you please try it?
  > > Hi, this should have been fixed by [#5879](https://github.com/react-native-maps/react-native-maps/pull/5879) and released in 1.28.2. Can you please try it?  My tests confirm that this issue is fixed in 1.28.2.  Thank you!

- **Issue #5917** (2026-09-05): **[Fabric] showCallout and hideCallout crash on google map ios**
  *Symptoms*: ### Summary  [Fabric] showCallout and hideCallout crash on google map ios when enable new arch, latest version 1.27.2, worked for apple map / android  ### Reproducible sample code  ```TSX markerRef.current?.showCallout(); ```  ### Steps to reproduce  using markerRef.current?.showCallout();  ### Expected result  working for google map when enable new arch  ### Actual result  crash  ### React Native Maps Version  1.27.2  ### What platforms are you seeing the problem on?  iOS (Google Maps)  ### React Native Version  0.79.6  ### What version of Expo are you using?  Not using Expo  ### Device(s)  iphone  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. If the issue remains relevant, simply comment `Still relevant` and the issue will remain open. Thank you for your contributions.

- **Issue #5915** (2026-09-04): **CocoaPods fails with “No podspec found for react-native-google-maps”**
  *Symptoms*: ### Summary  ## Description  While installing iOS dependencies for a React Native project using react-native-maps, the CocoaPods installation fails with the following error:  ⚠️ Something went wrong running `pod install` in the `ios` directory.  Command `pod install` failed. └─ Cause: No podspec found for `react-native-google-maps` in `node_modules/react-native-maps`  pod install --repo-update --ansi exited with non-zero code: 1  This prevents the iOS build from completing successfully.  ## Environment  React Native version: 0.83.2 react-native-maps version: 1.72.2 iOS version: 26 CocoaPods version: 1.16.2 Node version: 20  ## Steps to Reproduce  Install project dependencies using npm install or yarn install  Navigate to the iOS directory:  `cd ios`  Run CocoaPods install:  `pod install` Installation fails with the above error Expected Behavior  CocoaPods should successfully install all dependencies for react-native-maps, including Google Maps support if enabled.  ## Actual Behavior  CocoaPods fails with:  No podspec found for `react-native-google-maps` in node_modules/react-native-maps  As a result, iOS dependencies are not installed and the project cannot be built.  ## Additional Context  - The issue persists even after running pod install --repo-update - node_modules contains react-native-maps, but the expected Google Maps podspec is not found - This appears to be related to pod configuration or missing integration for Google Maps on iOS  ### Reproducible sample code  ```T
  **Post-Mortem & Fix Analysis**:
  > I tried an solution and this is also not working for me    ## Under app.json   ``` plugins: [           "react-native-maps", ] ```  this is also installing old pods 
  > > I tried an solution and this is also not working for me >  > ## Under app.json > ``` > plugins: [ >           "react-native-maps", > ] > ``` >  > this is also installing old pods  Strange, that worked for me (and others in related issues). Just checking, you added this under `"expo": {"plugins": [...]}`, not top-level `"plugins"` key in `app.json`? And then reinstalled packages, cleared `ios`/`android` and `.expo` directories and rebuilt?
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. If the issue remains relevant, simply comment `Still relevant` and the issue will remain open. Thank you for your contributions.

- **Issue #5914** (2026-08-27): **[iOS][PROVIDER_GOOGLE] showsUserLocation dot drifts from map center during pinch-to-zoom when scrollDuringRotateOrZoomEnabled={false}**
  *Symptoms*: ### Summary  When `scrollDuringRotateOrZoomEnabled={false}` is set on a Google Maps view, the expectation is that zoom is always anchored to the map's geographic center. The custom overlay (an absolutely-positioned pin) correctly stays at the visual center because it's a React Native view. However, the `showsUserLocation` blue dot drifts away from the visual center during the pinch-to-zoom gesture, revealing that the native zoom anchor is not perfectly locked to the map center.  https://github.com/user-attachments/assets/46b3fc09-b361-4417-94f7-3dc5ac3422bc  ### Reproducible sample code  ```TSX import React, { useRef } from 'react'; import { View, StyleSheet } from 'react-native'; import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';  const INITIAL_REGION = {   latitude: 14.5995,   longitude: 120.9842,   latitudeDelta: 0.009,   longitudeDelta: 0.009, };  export default function App() {   const mapRef = useRef(null);    return (     <View style={styles.container}>       {/* Absolutely-positioned pin overlay — stays at visual center always */}       <View style={styles.pin} />        <MapView         ref={mapRef}         style={StyleSheet.absoluteFillObject}         provider={PROVIDER_GOOGLE}         initialRegion={INITIAL_REGION}         showsUserLocation         showsMyLocationButton={false}         rotateEnabled={false}         pitchEnabled={false}         scrollDuringRotateOrZoomEnabled={false}       />     </View>   ); }  const styles = StyleSheet.create({   contai
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. If the issue remains relevant, simply comment `Still relevant` and the issue will remain open. Thank you for your contributions.

- **Issue #5906** (2026-08-19): **Android Custom Map Marker / Thumbnail Pin**
  *Symptoms*: ### Summary  **Android Custom Map Marker / Thumbnail Pin — Investigation Summary**  **Environment**  - React Native / Expo (JavaScript) - react-native-maps@1.26.18 - react-native-map-clustering - Android New Architecture (Fabric renderer) - Physical Pixel device (~3x density)  **Core Problem**  Custom marker views containing remote images (<Image source={{ uri: ... }}>) inside <Marker> children do not render on Android with React Native New Architecture. Android's Fabric renderer rasterises the custom marker view into a bitmap before async image data has finished painting, resulting in blank/empty pins. The same code works correctly on iOS.  **What Was Tried (All Failed or Caused New Issues)**  **1. tracksViewChanges toggling** Setting tracksViewChanges={true} until image loads, then flipping to false. Theoretically forces a re-snapshot after image paints. In practice caused addViewAt: failed to insert view crashes on Android physical devices at scale (100+ markers). Unreliable.  **2. onLoad-based preloading with hidden preloader views** Rendering hidden <Image> components off-screen to warm the cache before mounting markers. Did not reliably solve the timing issue — images cached to disk but not yet decoded into memory at snapshot time.  **3. expo-image with cachePolicy="memory-disk"** Swapping <Image> for <Image> from expo-image inside the custom marker view. Keeps decoded bitmaps in memory rather than just disk. Partial improvement but did not fully solve blank pins on clu
  **Post-Mortem & Fix Analysis**:
  > # Solving Android Maps Marker Rendering Issues with ViewShot  ## The Problem  React Native Maps on Android has a **canvas bitmap rendering limitation** where complex JSX components rendered as marker children can appear clipped, distorted, or fail to render entirely. This is especially problematic when markers contain:  - Overlapping UI elements - Multiple images or avatars - Text labels with custom styling - Layered or absolutely-positioned components  The issue stems from how Android's native canvas handles React Native's rendering model when content exceeds certain complexity thresholds.  ## The Solution: Offscreen Capture & Image-Based Rendering  Instead of fighting the canvas limitations, bypass them entirely by converting marker content to images:  1. **Render content offscreen** - Render marker JSX in an invisible view outside the map 2. **Capture as PNG** - Use `react-native-view-shot` to snapshot the rendered content 3. **Use as marker image** - Replace JSX children with the c
  > Thanks for your suggestion.  We attempted to implement the react-native-view-shot offscreen capture approach suggested above in a production app  **Implementation:**  - MarkerCaptureLayer component renders each custom marker view offscreen at -9999, -9999 with opacity: 0.01 - ViewShot captures each rendered view to a PNG URI after onImageLoad fires + 300ms delay - Captured URI passed to image prop on <Marker> — bypassing the custom view rendering entirely - Fallback dot pin shown until capture completes  **Results:**  - Partially working — some pins rendered correctly with styled images - Unreliable at scale (300+ markers) — race conditions between capture timing and image load meant a significant percentage of pins consistently failed to capture and remained as fallback dot pins or briefly showed the default Google Maps red teardrop pin - opacity: 0 caused Android to skip image loading entirely — required opacity: 0.01 workaround - On navigation return (tab switch), captured URIs had 
  > Manually fetching the image, and then saving it locally before rendering the map marker that has a custom image component with the image source set as the local image URI and styling also seems to work as a workaround.

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

### Incident Patch 1: `b16c1af6` (2026-09-27)
**Commit Message**: fix(ios): keep google marker icon when the marker is re-added to the map (#5950)

**File**: `ios/AirGoogleMaps/AIRGoogleMapMarker.m` (modified, +10/-0)
```diff
@@ -34,6 +34,7 @@ @implementation AIRGoogleMapMarker {
     RCTDirectEventBlock _onSelect;
     RCTDirectEventBlock _onDeselect;
     __weak UIImageView *_iconImageView;
+    UIImage *_iconImage;
     UIView *_iconView;
     UIColor *_pinColor;
     CLLocationCoordinate2D _coordinates;
@@ -130,6 +131,13 @@ - (void) didInsertInMap:(AIRGoogleMap *) map
     if (_pinColor){
         _realMarker.icon = [GMSMarker markerImageWithColor:_pinColor];
     }
+    if (_iconSrc){
+        if (_iconImage){
+            _realMarker.icon = _iconImage;
+        } else {
+            [self setIconSrc:_iconSrc];
+        }
+    }
     if (_opacity != 1.0){
         [_realMarker setOpacity:_opacity];
     }
@@ -420,6 +428,7 @@ - (void)setImageSrc:(NSString *)imageSrc
 - (void)setIconSrc:(NSString *)iconSrc
 {
     _iconSrc = iconSrc;
+    _iconImage = nil;
 
     if (_reloadImageCancellationBlock) {
         _reloadImageCancellationBlock();
@@ -446,6 +455,7 @@ - (void)setIconSrc:(NSString *)iconSrc
             NSLog(@"%@", error);
         }
         dispatch_async(dispatch_get_main_queue(), ^{
+            self->_iconImage = image;
             self->_realMarker.icon = image;
         });
     }];
```

---

### Incident Patch 2: `28dac452` (2026-09-27)
**Commit Message**: fix(android): re-attach the marker container after Google's MapView removes it (#6013)


Re-add the group when it has no parent, in onMapReady (markers added before the
map was ready) and in addFeature (markers added afterwards). Both are no-ops
when the group is attached.

**File**: `android/src/main/java/com/rnmaps/maps/MapView.java` (modified, +12/-0)
```diff
@@ -709,6 +709,14 @@ public void onGroundOverlayClick(@NonNull GroundOverlay groundOverlay) {
 
 
         isMapReady = true;
+        // Google's MapView removes every child when its map delegate is created
+        // (MapView.zza.onCreate -> removeAllViews). That takes the attacher group added
+        // in our constructor with it, so custom marker views added before the first
+        // detach/re-attach cycle never reach the window and Fresco never loads their
+        // images. Put the group back as soon as the map is ready.
+        if (attacherGroup != null && attacherGroup.getParent() == null) {
+            addView(attacherGroup);
+        }
         if (kmlSrc != null) {
             setKmlSrc(kmlSrc);
             kmlSrc = null;
@@ -1225,6 +1233,10 @@ public void addFeature(View child, int index) {
             // Ensure attacherGroup is not null before using it
             if (attacherGroup == null) {
                 prepareAttacherView();
+            } else if (attacherGroup.getParent() == null) {
+                // Orphaned by Google's removeAllViews (see onMapReady); re-add it so the
+                // marker view below actually attaches and its images load.
+                addView(attacherGroup);
             }
             // Add to the parent group
             attacherGroup.addView(annotation);
```

---

### Incident Patch 3: `56b79a65` (2026-09-27)
**Commit Message**: fix(ios): size Google marker icon view from Fabric layout metrics (#6011)

**File**: `ios/AirGoogleMaps/RNMapsGoogleMarkerView.mm` (modified, +17/-0)
```diff
@@ -270,6 +270,23 @@ - (instancetype)initWithFrame:(CGRect)frame
     return self;
 }
 
+// The legacy AIRGoogleMapMarker is never added to a view hierarchy under Fabric, so its
+// layoutSubviews never runs and the iconView it hands to GMSMarker stays 0x0 — custom-view
+// markers render blank. Size it from Fabric's layout (the marker is position:absolute, so
+// this is the size of its children) and ask GMS to re-snapshot the icon.
+- (void)updateLayoutMetrics:(LayoutMetrics const &)layoutMetrics
+           oldLayoutMetrics:(LayoutMetrics const &)oldLayoutMetrics
+{
+    [super updateLayoutMetrics:layoutMetrics oldLayoutMetrics:oldLayoutMetrics];
+    CGRect bounds = CGRectMake(0, 0, layoutMetrics.frame.size.width, layoutMetrics.frame.size.height);
+    if (CGRectIsEmpty(bounds) || CGRectEqualToRect(_view.iconView.frame, bounds)) {
+        return;
+    }
+    _view.frame = bounds;
+    _view.iconView.frame = bounds;
+    [_view redraw];
+}
+
 - (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
 {
     [self prepareMarkerView];
```

---

### Incident Patch 4: `2302fdf1` (2026-09-20)
**Commit Message**: fix: added the flat prop to the native marker component (#5947)

* fix: added the flat prop to the native marker component in order for it to be detected

* fix(android): apply the flat prop after mount

**File**: `android/src/main/java/com/facebook/react/viewmanagers/RNMapsMarkerManagerDelegate.java` (modified, +3/-0)
```diff
@@ -53,6 +53,9 @@ public void setProperty(T view, String propName, @Nullable Object value) {
       case "draggable":
         mViewManager.setDraggable(view, value == null ? false : (boolean) value);
         break;
+      case "flat":
+        mViewManager.setFlat(view, value == null ? false : (boolean) value);
+        break;
       case "title":
         mViewManager.setTitle(view, value == null ? null : (String) value);
         break;
```

**File**: `android/src/main/java/com/facebook/react/viewmanagers/RNMapsMarkerManagerInterface.java` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@ public interface RNMapsMarkerManagerInterface<T extends View> extends ViewManage
   void setCoordinate(T view, @Nullable ReadableMap value);
   void setDescription(T view, @Nullable String value);
   void setDraggable(T view, boolean value);
+  void setFlat(T view, boolean value);
   void setTitle(T view, @Nullable String value);
   void setTracksViewChanges(T view, boolean value);
   void setIdentifier(T view, @Nullable String value);
```

**File**: `android/src/main/java/com/rnmaps/fabric/MarkerManager.java` (modified, +6/-0)
```diff
@@ -190,6 +190,12 @@ public void setDraggable(MapMarker view, boolean value) {
         view.setUpdated(true);
     }
 
+    @Override
+    public void setFlat(MapMarker view, boolean value) {
+        view.setFlat(value);
+        view.setUpdated(true);
+    }
+
     @Override
     public void setTitle(MapMarker view, @Nullable String value) {
         view.setTitle(value);
```

**File**: `android/src/main/jni/react/renderer/components/RNMapsSpecs/Props.cpp` (modified, +5/-0)
```diff
@@ -758,6 +758,7 @@ RNMapsMarkerProps::RNMapsMarkerProps(
     coordinate(convertRawProp(context, rawProps, "coordinate", sourceProps.coordinate, {})),
     description(convertRawProp(context, rawProps, "description", sourceProps.description, {})),
     draggable(convertRawProp(context, rawProps, "draggable", sourceProps.draggable, {false})),
+    flat(convertRawProp(context, rawProps, "flat", sourceProps.flat, {false})),
     title(convertRawProp(context, rawProps, "title", sourceProps.title, {})),
     tracksViewChanges(convertRawProp(context, rawProps, "tracksViewChanges", sourceProps.tracksViewChanges, {true})),
     identifier(convertRawProp(context, rawProps, "identifier", sourceProps.identifier, {})),
@@ -820,6 +821,10 @@ folly::dynamic RNMapsMarkerProps::getDiffProps(
     result["draggable"] = draggable;
   }
     
+  if (flat != oldProps->flat) {
+    result["flat"] = flat;
+  }
+    
   if (title != oldProps->title) {
     result["title"] = title;
   }
```

**File**: `android/src/main/jni/react/renderer/components/RNMapsSpecs/Props.h` (modified, +1/-0)
```diff
@@ -1904,6 +1904,7 @@ class RNMapsMarkerProps final : public ViewProps {
   RNMapsMarkerCoordinateStruct coordinate{};
   std::string description{};
   bool draggable{false};
+  bool flat{false};
   std::string title{};
   bool tracksViewChanges{true};
   std::string identifier{};
```

**File**: `ios/generated/RNMapsSpecs/Props.cpp` (modified, +5/-0)
```diff
@@ -758,6 +758,7 @@ RNMapsMarkerProps::RNMapsMarkerProps(
     coordinate(convertRawProp(context, rawProps, "coordinate", sourceProps.coordinate, {})),
     description(convertRawProp(context, rawProps, "description", sourceProps.description, {})),
     draggable(convertRawProp(context, rawProps, "draggable", sourceProps.draggable, {false})),
+    flat(convertRawProp(context, rawProps, "flat", sourceProps.flat, {false})),
     title(convertRawProp(context, rawProps, "title", sourceProps.title, {})),
     tracksViewChanges(convertRawProp(context, rawProps, "tracksViewChanges", sourceProps.tracksViewChanges, {true})),
     identifier(convertRawProp(context, rawProps, "identifier", sourceProps.identifier, {})),
@@ -820,6 +821,10 @@ folly::dynamic RNMapsMarkerProps::getDiffProps(
     result["draggable"] = draggable;
   }
     
+  if (flat != oldProps->flat) {
+    result["flat"] = flat;
+  }
+    
   if (title != oldProps->title) {
     result["title"] = title;
   }
```

**File**: `ios/generated/RNMapsSpecs/Props.h` (modified, +1/-0)
```diff
@@ -1904,6 +1904,7 @@ class RNMapsMarkerProps final : public ViewProps {
   RNMapsMarkerCoordinateStruct coordinate{};
   std::string description{};
   bool draggable{false};
+  bool flat{false};
   std::string title{};
   bool tracksViewChanges{true};
   std::string identifier{};
```

**File**: `src/specs/NativeComponentMarker.ts` (modified, +9/-0)
```diff
@@ -174,6 +174,15 @@ export interface MarkerFabricNativeProps extends ViewProps {
    */
   draggable?: boolean;
 
+  /**
+   * Sets whether this marker should be flat against the map true or a billboard facing the camera.
+   *
+   * @default false
+   * @platform iOS: Google Maps only
+   * @platform Android: Supported
+   */
+  flat?: boolean;
+
   /**
    * The title of the marker.
    * This is only used if the <Marker /> component has no `<Callout />` children.
```

---

### Incident Patch 5: `4758d5ad` (2026-09-19)
**Commit Message**: fix(iOS): update polygon path when a coordinate value changes (not only on count change) (#5934)

fix(ios): update polygon path when a coordinate value changes, not only its count

RNMapsGooglePolygonView updateProps: rebuilt the GMSPath only when the
coordinate count changed, so moving an existing vertex (same point count,
new lat/lng) never updated the rendered shape. Compare coordinates
element-wise (count or value) before rebuilding the path.

**File**: `ios/AirGoogleMaps/RNMapsGooglePolygonView.mm` (modified, +14/-1)
```diff
@@ -168,7 +168,20 @@ - (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &
     if(newViewProps.zIndex.has_value()){
         _view.zIndex = newViewProps.zIndex.value();
     }
-    if (newViewProps.coordinates.size() != oldViewProps.coordinates.size()){
+    // Rebuild the path when the coordinates change in count OR value. Comparing
+    // only the count means moving an existing vertex (same point count, new
+    // lat/lng) never updates the rendered shape.
+    bool coordsChanged = newViewProps.coordinates.size() != oldViewProps.coordinates.size();
+    if (!coordsChanged) {
+        for (size_t i = 0; i < newViewProps.coordinates.size(); i++) {
+            if (newViewProps.coordinates.at(i).latitude  != oldViewProps.coordinates.at(i).latitude ||
+                newViewProps.coordinates.at(i).longitude != oldViewProps.coordinates.at(i).longitude) {
+                coordsChanged = true;
+                break;
+            }
+        }
+    }
+    if (coordsChanged){
         GMSMutablePath *path = [GMSMutablePath path];
         for(int i = 0; i < newViewProps.coordinates.size(); i++)
         {
```

---

### Incident Patch 6: `bdf84a87` (2026-09-19)
**Commit Message**: fix(android): guard GoogleMap access when mapPadding is set before onMapReady (#5983)

**File**: `android/src/main/java/com/rnmaps/maps/MapManager.java` (modified, +3/-1)
```diff
@@ -193,7 +193,9 @@ public void setMapPadding(MapView view, @Nullable ReadableMap padding) {
         }
 
         view.applyBaseMapPadding(left, top, right, bottom);
-        view.map.setPadding(left, top, right, bottom);
+        if (view.map != null) {
+            view.map.setPadding(left, top, right, bottom);
+        }
     }
 
     @ReactProp(name = "showsUserLocation", defaultBoolean = false)
```

**File**: `android/src/main/java/com/rnmaps/maps/MapView.java` (modified, +4/-3)
```diff
@@ -1363,7 +1363,7 @@ public WritableMap makeClickEventData(LatLng point) {
     }
 
     public void updateExtraData(Object extraData) {
-        if (setPaddingDeferred && super.getHeight() > 0 && super.getWidth() > 0) {
+        if (setPaddingDeferred && map != null && super.getHeight() > 0 && super.getWidth() > 0) {
             CameraUpdate cu = CameraUpdateFactory.newCameraPosition(map.getCameraPosition());
 
             map.setPadding(edgeLeftPadding + baseLeftMapPadding,
@@ -1530,8 +1530,9 @@ public void fitToSuppliedMarkers(ReadableArray markerIDsArray, ReadableMap edgeP
     int edgeBottomPadding;
 
     public void applyBaseMapPadding(int left, int top, int right, int bottom) {
-        if (super.getHeight() <= 0 || super.getWidth() <= 0) {
-            // the map is not laid out yet and calling setPadding() now has no effect
+        if (map == null || super.getHeight() <= 0 || super.getWidth() <= 0) {
+            // the map is not ready or not laid out yet and calling setPadding() now
+            // has no effect, or crashes when the GoogleMap instance does not exist
             baseLeftMapPadding = left;
             baseRightMapPadding = right;
             baseTopMapPadding = top;
```

---

### Incident Patch 7: `57d85cce` (2026-09-19)
**Commit Message**: fix(android): custom Marker views clipped due to undersized bitmap (#5913)

fix(android): custom Marker views clipped on Fabric due to undersized bitmap (#1)

On Fabric, the Yoga layout box for a MapMarker can be smaller than its
laid-out React subtree, causing createDrawable() to produce a bitmap
that clips custom marker content.

Add expandSnapshotSizeFromSubtree() which walks the custom marker's view
hierarchy and computes the union of descendant bounds (offset + size) to
determine the minimum bitmap dimensions. Uses only getWidth/getHeight
(falling back to getMeasuredWidth/getMeasuredHeight) — never calls
View#measure(), which would trigger Fabric's ReactViewGroup assertion.

**File**: `android/src/main/java/com/rnmaps/maps/MapMarker.java` (modified, +38/-0)
```diff
@@ -9,6 +9,7 @@
 import android.graphics.drawable.Drawable;
 import android.net.Uri;
 import android.view.View;
+import android.view.ViewGroup;
 import android.widget.LinearLayout;
 import android.animation.ObjectAnimator;
 import android.util.Property;
@@ -658,6 +659,22 @@ public void run() {
 
     private Bitmap mLastBitmapCreated = null;
 
+    // Walks the subtree to find the union of descendant bounds for bitmap sizing.
+    // Uses only laid-out dimensions — do NOT call View#measure() here (Fabric assertion).
+    private void expandSnapshotSizeFromSubtree(View view, int offsetX, int offsetY, int[] outWh) {
+        int w = view.getWidth() > 0 ? view.getWidth() : view.getMeasuredWidth();
+        int h = view.getHeight() > 0 ? view.getHeight() : view.getMeasuredHeight();
+        outWh[0] = Math.max(outWh[0], offsetX + w);
+        outWh[1] = Math.max(outWh[1], offsetY + h);
+        if (view instanceof ViewGroup) {
+            ViewGroup group = (ViewGroup) view;
+            for (int i = 0; i < group.getChildCount(); i++) {
+                View child = group.getChildAt(i);
+                expandSnapshotSizeFromSubtree(child, offsetX + child.getLeft(), offsetY + child.getTop(), outWh);
+            }
+        }
+    }
+
     private void clearDrawableCache() {
         mLastBitmapCreated = null;
     }
@@ -666,6 +683,27 @@ private Bitmap createDrawable() {
         int width = this.width <= 0 ? 100 : this.width;
         int height = this.height <= 0 ? 100 : this.height;
 
+        // Bitmap must cover laid-out custom-marker subtree; Yoga box alone can be too small (Fabric).
+        if (hasCustomMarkerView) {
+            int[] expanded = new int[] { width, height };
+            for (int i = 0; i < getChildCount(); i++) {
+                View child = getChildAt(i);
+                if (child instanceof MapCallout) {
+                    continue;
+                }
+                expandSnapshotSizeFromSubtree(child, child.getLeft(), child.getTop(), expanded);
+            }
+            width = expanded[0];
+            height = expanded[1];
+        }
+
+        if (width <= 0) {
+            width = 100;
+        }
+        if (height <= 0) {
+            height = 100;
+        }
+
         // Do not create the doublebuffer-bitmap each time. reuse it to save memory.
         Bitmap bitmap = mLastBitmapCreated;
 
```

---

### Incident Patch 8: `a7afe9e8` (2026-09-19)
**Commit Message**: fix(ios): guard Google Maps subview insertion (#5940)

**File**: `ios/AirGoogleMaps/AIRGoogleMap.mm` (modified, +7/-1)
```diff
@@ -245,6 +245,10 @@ - (void) fitToSuppliedMarkers:(NSArray*) markers withEdgePadding:(NSDictionary*)
 #pragma clang diagnostic push
 #pragma clang diagnostic ignored "-Wobjc-missing-super-calls"
 - (void)insertReactSubview:(id<RCTComponent>)subview atIndex:(NSInteger)atIndex {
+  if (subview == nil) {
+    return;
+  }
+
   // Our desired API is to pass up markers/overlays as children to the mapview component.
   // This is where we intercept them and do the appropriate underlying mapview action.
   if ([subview isKindOfClass:[AIRGoogleMapMarker class]]) {
@@ -290,7 +294,9 @@ - (void)insertReactSubview:(id<RCTComponent>)subview atIndex:(NSInteger)atIndex
       [self insertReactSubview:(UIView *)childSubviews[i] atIndex:atIndex];
     }
   }
-  [_reactSubviews insertObject:(UIView *)subview atIndex:(NSUInteger) atIndex];
+  NSUInteger safeIndex = atIndex < 0 ? 0 : (NSUInteger)atIndex;
+  safeIndex = MIN(safeIndex, _reactSubviews.count);
+  [_reactSubviews insertObject:(UIView *)subview atIndex:safeIndex];
 }
 #pragma clang diagnostic pop
 
```

---

### Incident Patch 9: `5cc4a258` (2026-09-19)
**Commit Message**: fix(ios): add nil check for subview insertion in Apple Maps (#5871)

**File**: `ios/AirMaps/AIRMap.mm` (modified, +4/-1)
```diff
@@ -157,7 +157,10 @@ - (void)insertReactSubview:(id<RCTComponent>)subview atIndex:(NSInteger)atIndex
             [self insertReactSubview:(UIView *)childSubviews[i] atIndex:atIndex];
         }
     }
-    [_reactSubviews insertObject:(UIView *)subview atIndex:(NSUInteger) atIndex];
+    if (subview != nil) {
+        NSUInteger safeIndex = MIN((NSUInteger)atIndex, _reactSubviews.count);
+        [_reactSubviews insertObject:(UIView *)subview atIndex:safeIndex];
+    }
 }
 #pragma clang diagnostic pop
 
```

---

### Incident Patch 10: `bab94e73` (2026-09-13)
**Commit Message**: fix(ios): keep the marker anchored to its coordinate when its content is transformed (#6001)

* fix(ios): keep the marker anchored to its coordinate when its content is transformed

**File**: `ios/AirMaps/AIRMapMarker.m` (modified, +3/-3)
```diff
@@ -425,9 +425,9 @@ - (void)layoutSubviews
     CGRect reactFrame = self.frame;
 
     UIView *firstSubView = self.subviews.firstObject;
-    if (firstSubView && (CGRectGetWidth(firstSubView.frame) > CGRectGetWidth(reactFrame) ||
-                         CGRectGetHeight(firstSubView.frame) > CGRectGetHeight(reactFrame))) {
-        reactFrame = firstSubView.frame;
+    if (firstSubView && (CGRectGetWidth(firstSubView.bounds) > CGRectGetWidth(reactFrame) ||
+                         CGRectGetHeight(firstSubView.bounds) > CGRectGetHeight(reactFrame))) {
+        reactFrame.size = firstSubView.bounds.size;
     }
     [self reactSetFrame:reactFrame];
 }
```

---

### Incident Patch 11: `5e1f3cd6` (2026-09-13)
**Commit Message**: fix(android): guard removeFromMap against a null overlay (#5976)

**File**: `android/src/main/java/com/rnmaps/maps/MapGradientPolyline.java` (modified, +4/-0)
```diff
@@ -328,7 +328,11 @@ public void addToMap(Object map) {
 
   @Override
   public void removeFromMap(Object map) {
+    if (tileOverlay == null) {
+      return;
+    }
     tileOverlay.remove();
+    tileOverlay = null;
   }
 
   public static class MutPoint {
```

**File**: `android/src/main/java/com/rnmaps/maps/MapHeatmap.java` (modified, +4/-0)
```diff
@@ -107,7 +107,11 @@ public void addToMap(Object map) {
 
     @Override
     public void removeFromMap(Object map) {
+        if (heatmap == null) {
+            return;
+        }
         heatmap.remove();
+        heatmap = null;
     }
 
 }
\ No newline at end of file
```

**File**: `android/src/main/java/com/rnmaps/maps/MapLocalTile.java` (modified, +4/-0)
```diff
@@ -146,6 +146,10 @@ public void addToMap(Object map) {
 
     @Override
     public void removeFromMap(Object map) {
+        if (tileOverlay == null) {
+            return;
+        }
         tileOverlay.remove();
+        tileOverlay = null;
     }
 }
```

**File**: `android/src/main/java/com/rnmaps/maps/MapUrlTile.java` (modified, +4/-0)
```diff
@@ -202,6 +202,10 @@ public void addToMap(Object map) {
 
   @Override
   public void removeFromMap(Object map) {
+    if (tileOverlay == null) {
+      return;
+    }
     tileOverlay.remove();
+    tileOverlay = null;
   }
 }
```

---

### Incident Patch 12: `67e83a2c` (2026-09-13)
**Commit Message**: docs: fix satellite typo (#5848)

**File**: `docs/mapview.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
 | `paddingAdjustmentBehavior`       | 'always' \| 'automatic' \| 'never'   | 'never'      | Indicates how/when to affect padding with safe area insets (`GoogleMaps` in iOS only)                                                                                                                                                                                                                                                                                                                                                                                                                                            |
 | `liteMode`                        | `Boolean`                            | `false`      | Enable [lite mode](https://developers.google.com/maps/documentation/android-sdk/lite#overview_of_lite_mode). **Note**: Android only.                                                                                                                                                                                                                                                                                                                                                                                             |
 | `googleMapId`                     | `String`                             |              | Google Map ID (only for Provider "google") [google map id](https://developers.google.com/maps/documentation/get-map-id)                                                                                                                                                                                                                                                                                                                                                                                                          |
-| `mapType`                         | `String`                             | `"standard"` | The map type to be displayed. <br/><br/> - standard: standard road map (default)<br/> - none: no map **Note** Not available on MapKit<br/> - satellite: satellite view<br/> - hybrid: satellite view with roads and points of interest overlayed<br/> - terrain: topographic view<br/> - mutedStandard: more subtle, makes markers/lines pop more (iOS 11.0+ only)<br/> - satelliteFlyover: 3D globe with sattelite view (iOS 13.0+ Apple Maps only)<br/> - hybridFlyover: 3D globe with hybrid view (iOS 13.0+ Apple Maps only) |
+| `mapType`                         | `String`                             | `"standard"` | The map type to be displayed. <br/><br/> - standard: standard road map (default)<br/> - none: no map **Note** Not available on MapKit<br/> - satellite: satellite view<br/> - hybrid: satellite view with roads and points of interest overlayed<br/> - terrain: topographic view<br/> - mutedStandard: more subtle, makes markers/lines pop more (iOS 11.0+ only)<br/> - satelliteFlyover: 3D globe with satellite view (iOS 13.0+ Apple Maps only)<br/> - hybridFlyover: 3D globe with hybrid view (iOS 13.0+ Apple Maps only) |
 | `customMapStyle`                  | `Array`                              |              | Adds custom styling to the map component. See [README](https://github.com/react-native-maps/react-native-maps#customizing-the-map-style) for more information.                                                                                                                                                                                                                                                                                                                                                                   |
 | `userInterfaceStyle`              | 'light' \| 'dark'                    |              | Sets the map to the style selected. Default is whatever the system settings is.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
 | `showsUserLocation`               | `Boolean`                            | `false`      | If `true` the users location will be shown on the map. **NOTE**: You need runtime location permissions prior to setting this to true, otherwise it is going to _fail silently_! Checkout the excellent [react-native-permissions](https://github.com/zoontek/react-native-permissions) for this.                                                                                                                                                                                                                                 |
```

---

### Incident Patch 13: `d7f58ae2` (2026-06-28)
**Commit Message**: fix(android): remember selected mapType (#5879)

* fix(android): remember selected mapType

* fix(android): only replay mapType when set and route paper arch through view setter

**File**: `android/src/main/java/com/rnmaps/maps/MapManager.java` (modified, +1/-1)
```diff
@@ -158,7 +158,7 @@ public void setInitialCamera(MapView view, ReadableMap initialCamera) {
     @ReactProp(name = "mapType")
     public void setMapType(MapView view, @Nullable String mapType) {
         int typeId = MAP_TYPES.get(mapType);
-        view.map.setMapType(typeId);
+        view.setMapType(typeId);
     }
 
     @ReactProp(name = "customMapStyleString")
```

**File**: `android/src/main/java/com/rnmaps/maps/MapView.java` (modified, +5/-0)
```diff
@@ -159,6 +159,7 @@ public class MapView extends com.google.android.gms.maps.MapView implements Goog
     private LatLng tapLocation;
     private Float maxZoomLevel;
     private Float minZoomLevel;
+    private Integer mapType;
     private Boolean pitchEnabled;
     private Boolean showsCompass;
     private Boolean rotateEnabled;
@@ -479,6 +480,9 @@ public void onMapReady(@NonNull final GoogleMap map) {
             return;
         }
         this.map = map;
+        if (mapType != null) {
+            setMapType(mapType);
+        }
         if (maxZoomLevel != null) {
             setMaxZoomLevel(maxZoomLevel);
         }
@@ -1025,6 +1029,7 @@ public void setToolbarEnabled(boolean toolbarEnabled) {
     }
 
     public void setMapType(int mapType) {
+        this.mapType = mapType;
         if (map != null) {
             map.setMapType(mapType);
         }
```

---

### Incident Patch 14: `b874b0ff` (2026-06-28)
**Commit Message**: fix(android): fix ghost features on MapView (#5859)

* fix(android): fix ghost features on MapView

* refactor pause handling

* fix issue with removeFeatureAt not properly handling cleanup when savedFeatures is not null

**File**: `android/src/main/java/com/rnmaps/maps/MapView.java` (modified, +53/-20)
```diff
@@ -228,8 +228,7 @@ public void onResume(LifecycleOwner owner) {
     }
 
 
-    @Override
-    public void onPause(LifecycleOwner owner) {
+    public void pauseSafely() {
         if (hasPermissions() && map != null) {
             //noinspection MissingPermission
             map.setMyLocationEnabled(false);
@@ -243,6 +242,11 @@ public void onPause(LifecycleOwner owner) {
         }
     }
 
+    @Override
+    public void onPause(LifecycleOwner owner) {
+        pauseSafely();
+    }
+
     @Override
     public void onStop(LifecycleOwner owner) {
         super.onStop();
@@ -334,14 +338,18 @@ protected void onAttachedToWindow() {
             getMapAsync((map)->{
                 onMapReady(map);
                 if (savedFeatures != null && !savedFeatures.isEmpty()) {
-                    for (int i = 0; i < savedFeatures.size(); i++) {
-                        MapFeature savedFeature = savedFeatures.get(i);
+                    features.clear();
+                    ArrayList<MapFeature> toRestore = savedFeatures;
+                    savedFeatures = null;
+                    for (int i = 0; i < toRestore.size(); i++) {
+                        MapFeature savedFeature = toRestore.get(i);
                         if (savedFeature != null) {
                             addFeature(savedFeature, i);
                         }
                     }
+                } else {
+                    savedFeatures = null;
                 }
-                savedFeatures = null;
             });
         }
     }
@@ -365,8 +373,7 @@ protected void onDetachedFromWindow() {
 
             // Pause safely if not already paused
             if (!paused) {
-                onPause();
-                paused = true;
+                pauseSafely();
             }
         }
 
@@ -789,8 +796,7 @@ public synchronized void doDestroy() {
         savedFeatures = null;
         try {
             if (!paused) {
-                onPause();
-                paused = true;
+                pauseSafely();
             }
             onDestroy();
             detachLifecycleObserver();
@@ -1166,27 +1172,36 @@ public void setHandlePanDrag(boolean handlePanDrag) {
     }
 
     private void safeAddFeature(int index, MapFeature mapFeature){
-        if(paused || features.size() < index){
-            if (savedFeatures == null) {
-                savedFeatures = new ArrayList<>();
-            }
-
+        if(savedFeatures != null){
             // Ensure the list is large enough to set at the given index
-            while(savedFeatures.size() <= index){
+            while(savedFeatures.size() < index){
                 savedFeatures.add(null);
             }
-            savedFeatures.set(index, mapFeature);
+            savedFeatures.add(index, mapFeature);
             return;
         }
 
         // Ensure the list is large enough to set at the given index
-        while(features.size() <= index){
+        while(features.size() < index){
             features.add(null);
         }
-        features.set(index, mapFeature);
+        features.add(index, mapFeature);
     }
 
     public void addFeature(View child, int index) {
+        // When detached, skip addToMap calls and just track in savedFeatures
+        if (savedFeatures != null) {
+            if (child instanceof MapFeature) {
+                safeAddFeature(index, (MapFeature) child);
+            } else if (child instanceof ViewGroup) {
+                ViewGroup children = (ViewGroup) child;
+                for (int i = 0; i < children.getChildCount(); i++) {
+                    addFeature(children.getChildAt(i), index);
+                }
+            }
+            return;
+        }
+
         // Our desired API is to pass up annotations/overlays as children to the mapview component.
         // This is where we intercept them and do the appropriate underlying mapview action.
         if (child instanceof MapMarker) {
@@ -1273,18 +1288,36 @@ public void addFeature(View child, int index) {
     }
 
     public int getFeatureCount() {
+        if (savedFeatures != null) {
+            return savedFeatures.size();
+        }
         return features.size();
     }
 
     public View getFeatureAt(int index) {
+        if (savedFeatures != null) {
+            if (index < savedFeatures.size()) {
+                return savedFeatures.get(index);
+            }
+            return null;
+        }
         if (index < features.size()) {
             return features.get(index);
         }
         return null;
     }
 
     public void removeFeatureAt(int index) {
-        MapFeature feature = features.remove(index);
+        MapFeature feature;
+        if (savedFeatures != null) {
+            if (index < savedFeatures.size()) {
+                feature = savedFeatures.remove(index);
+            } else {
+                return;
+            }
+        } else {
+            feature = features.remove(index);
+        }
         if (feature instanceof MapMarker) 
```

---

### Incident Patch 15: `7ef397df` (2026-03-11)
**Commit Message**: fix(ios): expo plug-in to match @main in react-native-maps-import (#5844)

expo plug-in match @main in react-native-maps-import

**File**: `plugin/src/ios.ts` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ export function addGoogleMapsAppDelegateImport(src: string): MergeResults {
     tag: 'react-native-maps-import',
     src,
     newSrc: newSrc.join('\n'),
-    anchor: /@UIApplicationMain/,
+    anchor: /(@main|@UIApplicationMain)/,
     offset: 0,
     comment: '//',
   });
```

#### Recent Merged Pull Requests:
- **PR #6013** (2026-09-27): fix(android): re-attach the marker container after Google's MapView removes it (@vagvalas)
- **PR #6011** (2026-09-27): fix(ios): size Google marker icon view from Fabric layout metrics (@janciesielczyk)
- **PR #6009** (2026-09-20): chore(codegen): regenerate artifacts with React Native 0.83 (@salah-ghanim)
- **PR #6001** (2026-09-13): fix(ios): keep the marker anchored to its coordinate when its content is transformed (@ivan-kolesov)
- **PR #5983** (2026-09-19): fix(android): guard GoogleMap access when mapPadding is set before onMapReady (@escapingyouth)
- **PR #5976** (2026-09-13): fix(android): guard removeFromMap against a null overlay (@cthulhu-bot)
- **PR #5972** (2026-09-13): docs(installation): update Google Maps setup instructions for iOS to include Swift support (@seyedmostafahasani)
- **PR #5968** (closed): chore(deps): bump fast-uri from 3.1.0 to 3.1.5 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
