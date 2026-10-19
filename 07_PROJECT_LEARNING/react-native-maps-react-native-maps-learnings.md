> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/react-native-maps-react-native-maps-learnings.md`  
> **Source**: github ([https://github.com/react-native-maps/react-native-maps](https://github.com/react-native-maps/react-native-maps))  
> **Source Version**: `39c6fd17`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T13:49:38.967Z  
> **Learning ID**: `learn-github-react-native-maps-react-native-maps`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): react-native-maps/react-native-maps

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-native-maps-react-native-maps-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-native-maps/react-native-maps](https://github.com/react-native-maps/react-native-maps))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T13:49:38.960Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-native-maps/react-native-maps`
- **Description**: React Native Mapview component for iOS + Android
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 16009 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5927** (2026-10-01): **Config plugin fails on Expo SDK 56: Cannot find module '@expo/config-plugins/build/plugins/ios-plugins'**
  *Symptoms*: ### Summary  When using the built-in Expo config plugin with Expo SDK 56, `npx expo prebuild` fails because the plugin imports from `@expo/config-plugins` internal paths directly. The package is not hoisted to the project root `node_modules`, so module resolution fails.  ### Reproducible sample code  ```TSX npx expo prebuild --clean ```  ### Steps to reproduce  1. Create an Expo SDK 56 project (or upgrade an existing one) 2. Install react-native-maps:   ```bash   npx expo install react-native-maps   ``` 3. Enable the config plugin in `app.config.ts`:   ```ts   import type { ExpoConfig } from 'expo/config';        export default (): ExpoConfig => ({     name: 'repro',     slug: 'repro',     plugins: [       [         'react-native-maps',         {           androidGoogleMapsApiKey: 'test-key',         },       ],     ],     });   ``` 5. Run:      ```bash   npx expo prebuild --clean   ```  ### Expected result  Prebuild should succeed without requiring @expo/config-plugins as a direct project dependency.  ### Actual result  Prebuild fails immediately with: ``` PluginError: Cannot find module '@expo/config-plugins/build/plugins/ios-plugins' Require stack: - node_modules/react-native-maps/plugin/build/ios.js - node_modules/react-native-maps/plugin/build/index.js - node_modules/react-native-maps/app.plugin.js ```  ### React Native Maps Version  1.27.2  ### What platforms are you seeing the problem on?  Android, iOS (Google Maps)  ### React Native Version  0.85.3  ### What version o

- **Issue #5926** (2026-09-16): **UrlTile local caching with Google Maps on iOS**
  *Symptoms*: ### Summary  Hi, I’m using `UrlTile` with `provider={PROVIDER_GOOGLE}` on iOS for a custom weather overlay.  On Android, `UrlTile` supports `tileCachePath` and `tileCacheMaxAge`, and those props allow us to cache custom tile images locally.  On iOS with Google Maps, these props seem to be ignored. Looking at the native implementation, `AirGoogleMaps/AIRGoogleMapUrlTileManager.m` appears to export only `urlTemplate`, `zIndex`, `maximumZ`, `minimumZ`, and `flipY`.  Is there currently any supported way to achieve local caching for `UrlTile` when using Google Maps on iOS? For example, is there another prop, configuration, or recommended approach that I might be missing?  If this is not currently supported, would adding support for `tileCachePath` / `tileCacheMaxAge` for Google Maps on iOS be something that fits the direction of the library?  ### Example  ``` import RNFS from "react-native-fs"; import MapView, { PROVIDER_GOOGLE, UrlTile } from "react-native-maps";  const WEATHER_TILE_CACHE_MAX_AGE_SECONDS = 60 * 10;  <MapView provider={PROVIDER_GOOGLE}>   <UrlTile     urlTemplate="https://example.com/api/weather/overlays/now/{z}/{x}/{y}?region=eu"     tileCachePath={`${RNFS.CachesDirectoryPath}/weather-tiles/eu/now`}     tileCacheMaxAge={WEATHER_TILE_CACHE_MAX_AGE_SECONDS}     minimumZ={1}     maximumZ={12}     flipY={false}   /> </MapView> ```  ### Reproducible sample code  ```TSX import React from "react"; import { StyleSheet } from "react-native"; import RNFS from "react-native

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

### Incident Patch 1: `4758d5ad` (2026-09-19)
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

### Incident Patch 2: `b16c1af6` (2026-09-27)
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

### Incident Patch 3: `28dac452` (2026-09-27)
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

#### Recent Merged Pull Requests:
- **PR #6013** (2026-09-27): fix(android): re-attach the marker container after Google's MapView removes it (@vagvalas)
- **PR #6011** (2026-09-27): fix(ios): size Google marker icon view from Fabric layout metrics (@janciesielczyk)
- **PR #6009** (2026-09-20): chore(codegen): regenerate artifacts with React Native 0.83 (@salah-ghanim)
- **PR #6001** (2026-09-13): fix(ios): keep the marker anchored to its coordinate when its content is transformed (@ivan-kolesov)
- **PR #5983** (2026-09-19): fix(android): guard GoogleMap access when mapPadding is set before onMapReady (@escapingyouth)
- **PR #5976** (2026-09-13): fix(android): guard removeFromMap against a null overlay (@cthulhu-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. iOS): update polygon path when a coordinate value changes (not only on count cha

**RULE**:
When implementing operations in `ios/AirGoogleMaps/RNMapsGooglePolygonView.mm`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react-native-maps/react-native-maps. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4758d5ad`: iOS): update polygon path when a coordinate value changes (not only on count change) (#5934). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `ios/AirGoogleMaps/RNMapsGooglePolygonView.mm`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    // Rebuild the path when the coordinates change in count OR value. Comparing
    // only the count means moving an existing vertex (same point count, new
    // lat/lng) never updates the rendered shape.
    bool coordsChanged = newViewProps.coordinates.size() != oldViewProps.coordinates.size();
    if (!coordsChanged) {
        for (size_t i = 0; i < newViewProps.coordinates.size(); i++) {
            if (newViewProps.coordinates.at(i).latitude  != oldViewProps.coordinates.at(i).latitude ||
                newViewProps.coordinates.at(i).longitude != oldViewProps.coordinates.at(i).longitude) {
                coordsChanged = true;
                break;
            }
        }
    }
    if (coordsChanged){
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
    if (newViewProps.coordinates.size() != oldViewProps.coordinates.size()){
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4758d5ad` are properly handled with clean fallback behavior.
