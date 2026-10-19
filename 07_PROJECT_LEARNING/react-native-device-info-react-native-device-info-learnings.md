> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/react-native-device-info-react-native-device-info-learnings.md`  
> **Source**: github ([https://github.com/react-native-device-info/react-native-device-info](https://github.com/react-native-device-info/react-native-device-info))  
> **Source Version**: `06a9ed6d`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T02:18:24.648Z  
> **Learning ID**: `learn-github-react-native-device-info-react-native-device-info`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): react-native-device-info/react-native-device-info

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-native-device-info-react-native-device-info-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-native-device-info/react-native-device-info](https://github.com/react-native-device-info/react-native-device-info))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T02:18:24.644Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-native-device-info/react-native-device-info`
- **Description**: Device Information for React Native iOS and Android
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6686 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ios/RNDeviceInfo/EnvironmentUtil.h`
```
//
//  EnvironmentUtil.h
//  RNDeviceInfo
//
//  Created by Dima Portenko on 10.04.2021.
//  Copyright © 2021 Learnium. All rights reserved.
//

#import <Foundation/Foundation.h>

/**
 *  App environment
 */
typedef NS_ENUM(NSInteger, MSACEnvironment) {

  /**
   *  App has been downloaded from the AppStore.
   */
  MSACEnvironmentAppStore = 0,

  /**
   *  App has been downloaded from TestFlight.
   */
  MSACEnvironmentTestFlight = 1,

  /**
   *  App has been installed by some other mechanism.
   *  This could be Ad-Hoc, Enterprise, etc.
   */
  MSACEnvironmentOther = 2
};

#define EnvironmentValues [NSArray arrayWithObjects: @"AppStore", @"TestFlight", @"Other", nil]

@interface EnvironmentUtil : NSObject

+ (MSACEnvironment)currentAppEnvironment;

@end

```

### Core Architecture Module: `src/internal/asyncHookWrappers.ts`
```
import { useState, useEffect, useMemo } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import type { AsyncHookResult } from './types';

/**
 * simple hook wrapper for async functions for 'on-mount / componentDidMount' that only need to fired once
 * @param asyncGetter async function that 'gets' something
 * @param initialResult -1 | false | 'unknown'
 */
export function useOnMount<T>(asyncGetter: () => Promise<T>, initialResult: T): AsyncHookResult<T> {
  const [response, setResponse] = useState<AsyncHookResult<T>>({
    loading: true,
    result: initialResult,
  });

  useEffect(() => {
    // async function cuz react complains if useEffect's effect param is an async function
    const getAsync = async () => {
      const result = await asyncGetter();
      setResponse({ loading: false, result });
    };

    getAsync();
  }, [asyncGetter]);

  return response;
}

export const deviceInfoEmitter = new NativeEventEmitter(NativeModules.RNDeviceInfo);

/**
 * simple hook wrapper for handling events
 * @param eventName
 * @param initialValueAsyncGetter
 * @param defaultValue
 */
export function useOnEvent<T>(
  eventName: string,
  initialValueAsyncGetter: () => Promise<T>,
  defaultValue: T
): AsyncHookResult<T> {
  const { loading, result: initialResult } = useOnMount(initialValueAsyncGetter, defaultValue);
  const [result, setResult] = useState<T>(defaultValue);

  // sets the result to what the intial value is on mount
  useEffect(() => {
    setResult(initialResult);
  }, [initialResult]);

  // - set up the event listener to set the result
  // - set up the clean up function to remove subscription on unmount
  useEffect(() => {
    const subscription = deviceInfoEmitter.addListener(eventName, setResult);
    return () => subscription.remove();
  }, [eventName]);

  // loading will only be true while getting the inital value. After that, it will always be false, but a new result may occur
  return useMemo(() => ({ loading, result }), [loading, result]);
}

```

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
};

```

### Core Architecture Module: `example/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native-community',
};

```

### Core Architecture Module: `example/.prettierrc.js`
```
module.exports = {
  bracketSpacing: false,
  jsxBracketSameLine: true,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'avoid',
};

```

### Core Architecture Module: `example/App.js`
```
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 * @lint-ignore-every XPLATJSCOPYRIGHT1
 */

import React, {Component, useCallback, memo} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  SafeAreaView,
  View,
  TouchableOpacity,
  NativeModules,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {
  getManufacturer,
  getManufacturerSync,
  syncUniqueId,
  getUniqueId,
  getUniqueIdSync,
  getAppSetId,
  useBatteryLevel,
  useBatteryLevelIsLow,
  usePowerState,
  useFirstInstallTime,
  useDeviceName,
  useManufacturer,
  useHasSystemFeature,
  useIsEmulator,
  useIsHeadphonesConnected,
  useIsWiredHeadphonesConnected,
  useIsBluetoothHeadphonesConnected,
  useBrightness,
} from 'react-native-device-info';

const FunctionalComponent = () => {
  const batteryLevel = useBatteryLevel();
  const batteryLevelIsLow = useBatteryLevelIsLow();
  const powerState = usePowerState();
  const firstInstallTime = useFirstInstallTime();
  const deviceName = useDeviceName();
  const manufacturer = useManufacturer();
  const hasSystemFeature = useHasSystemFeature('amazon.hardware.fire_tv');
  const isEmulator = useIsEmulator();
  const isHeadphonesConnected = useIsHeadphonesConnected();
  const isWiredHeadphonesConnected = useIsWiredHeadphonesConnected();
  const isBluetoothHeadphonesConnected = useIsBluetoothHeadphonesConnected();
  const brightness = useBrightness();
  const deviceJSON = {
    batteryLevel,
    batteryLevelIsLow,
    powerState,
    firstInstallTime,
    deviceName,
    manufacturer,
    hasSystemFeature,
    isEmulator,
    isHeadphonesConnected,
    isWiredHeadphonesConnected,
    isBluetoothHeadphonesConnected,
    brightness,
  };

  return (
    <ScrollView>
      <Text style={styles.instructions} testID="hooks tab contents">
        {JSON.stringify(deviceJSON, null, '  ')}
      </Text>
    </ScrollView>
  );
};

const ActionExtensionHeader = memo(({isActionExtension}) => {
  const onDonePress = useCallback(() => {
    NativeModules.ActionExtension.done();
  }, []);
  return isActionExtension ? (
    <View style={{minHeight: 50, flexDirection: 'row', margin: 10}}>
      <TouchableOpacity onPress={onDonePress}>
        <View
          style={{
            backgroundColor: 'red',
            borderRadius: 20,
            minWidth: 80,
            minHeight: 40,
            alignContent: 'center',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <Text>Done</Text>
        </View>
      </TouchableOpacity>
    </View>
  ) : (
    <View />
  );
});

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      activeTab: 'constant',
      constantdeviceinfo: this.getConstantDeviceInfo(),
      asyncdeviceinfo: {},
      syncdeviceinfo: this.getSyncDeviceInfo(),
    };
  }

  getConstantDeviceInfo() {
    let deviceJSON = {};

    deviceJSON.deviceId = DeviceInfo.getDeviceId();
    deviceJSON.bundleId = DeviceInfo.getBundleId();
    deviceJSON.systemName = DeviceInfo.getSystemName();
    deviceJSON.systemVersion = DeviceInfo.getSystemVersion();
    deviceJSON.version = DeviceInfo.getVersion();
    deviceJSON.readableVersion = DeviceInfo.getReadableVersion();
    deviceJSON.buildNumber = DeviceInfo.getBuildNumber();
    deviceJSON.isTablet = DeviceInfo.isTablet();
    deviceJSON.isLowRamDevice = DeviceInfo.isLowRamDevice();
    deviceJSON.isDisplayZoomed = DeviceInfo.isDisplayZoomed();
    deviceJSON.appName = DeviceInfo.getApplicationName();
    deviceJSON.brand = DeviceInfo.getBrand();
    deviceJSON.model = DeviceInfo.getModel();
    deviceJSON.deviceType = DeviceInfo.getDeviceType();

    return deviceJSON;
  }

  getSyncDeviceInfo() {
    let deviceJSON = {};

    deviceJSON.uniqueId = getUniqueIdSync();
    deviceJSON.manufacturer = getManufacturerSync();
    deviceJSON.buildId = DeviceInfo.getBuildIdSync();
    deviceJSON.isCameraPresent = DeviceInfo.isCameraPresentSync();
    deviceJSON.deviceName = DeviceInfo.getDeviceNameSync();
    deviceJSON.usedMemory = DeviceInfo.getUsedMemorySync();
    deviceJSON.instanceId = DeviceInfo.getInstanceIdSync();
    deviceJSON.installReferrer = DeviceInfo.getInstallReferrerSync();
    deviceJSON.installerPackageName = DeviceInfo.getInstallerPackageNameSync();
    deviceJSON.isEmulator = DeviceInfo.isEmulatorSync();
    deviceJSON.fontScale = DeviceInfo.getFontScaleSync();
    deviceJSON.hasNotch = DeviceInfo.hasNotch();
    deviceJSON.hasDynamicIsland = DeviceInfo.hasDynamicIsland();
    deviceJSON.firstInstallTime = DeviceInfo.getFirstInstallTimeSync();
    deviceJSON.lastUpdateTime = DeviceInfo.getLastUpdateTimeSync();
    deviceJSON.startupTime = DeviceInfo.getStartupTimeSync();
    deviceJSON.serialNumber = DeviceInfo.getSerialNumberSync();
    deviceJSON.androidId = DeviceInfo.getAndroidIdSync();
    deviceJSON.IpAddress = DeviceInfo.getIpAddressSync();
    deviceJSON.MacAddress = DeviceInfo.getMacAddressSync(); // needs android.permission.ACCESS_WIFI_STATE
    deviceJSON.ApiLevel = DeviceInfo.getApiLevelSync();
    deviceJSON.carrier = DeviceInfo.getCarrierSync();
    deviceJSON.totalMemory = DeviceInfo.getTotalMemorySync();
    deviceJSON.maxMemory = DeviceInfo.getMaxMemorySync();
    deviceJSON.totalDiskCapacity = DeviceInfo.getTotalDiskCapacitySync();
    deviceJSON.totalDiskCapacityOld = DeviceInfo.getTotalDiskCapacityOldSync();
    deviceJSON.freeDiskStorage = {
      default: DeviceInfo.getFreeDiskStorageSync(),
      total: DeviceInfo.getFreeDiskStorageSync('total'),
      important: DeviceInfo.getFreeDiskStorageSync('important'),
      opportunistic: DeviceInfo.getFreeDiskStorageSync('opportunistic'),
    };
    deviceJSON.freeDiskStorageOld = DeviceInfo.getFreeDiskStorageOldSync();
    deviceJSON.batteryLevel = DeviceInfo.getBatteryLevelSync();
    deviceJSON.isLandscape = DeviceInfo.isLandscapeSync();
    deviceJSON.isAirplaneMode = DeviceInfo.isAirplaneModeSync();
    deviceJSON.isBatteryCharging = DeviceInfo.isBatteryChargingSync();
    deviceJSON.isPinOrFingerprintSet = DeviceInfo.isPinOrFingerprintSetSync();
    deviceJSON.supportedAbis = DeviceInfo.supportedAbisSync();
    deviceJSON.hasSystemFeature = DeviceInfo.hasSystemFeatureSync(
      'android.software.webview',
    );
    deviceJSON.getSystemAvailableFeatures = DeviceInfo.getSystemAvailableFeaturesSync();
    deviceJSON.powerState = DeviceInfo.getPowerStateSync();
    deviceJSON.isLocationEnabled = DeviceInfo.isLocationEnabledSync();
    deviceJSON.headphones = DeviceInfo.isHeadphonesConnectedSync();
    deviceJSON.headphonesWired = DeviceInfo.isWiredHeadphonesConnectedSync();
    deviceJSON.headphonesBluetooth = DeviceInfo.isBluetoothHeadphonesConnectedSync();
    deviceJSON.getAvailableLocationProviders = DeviceInfo.getAvailableLocationProvidersSync();
    deviceJSON.bootloader = DeviceInfo.getBootloaderSync();
    deviceJSON.device = DeviceInfo.getDeviceSync();
    deviceJSON.display = DeviceInfo.getDisplaySync();
    deviceJSON.fingerprint = DeviceInfo.getFingerprintSync();
    deviceJSON.hardware = DeviceInfo.getHardwareSync();
    deviceJSON.host = DeviceInfo.getHostSync();
    deviceJSON.hostNames = DeviceInfo.getHostNamesSync();
    deviceJSON.product = DeviceInfo.getProductSync();
    deviceJSON.tags = DeviceInfo.getTagsSync();
    deviceJSON.type = DeviceInfo.getTypeSync();
    deviceJSON.baseOS = DeviceInfo.getBaseOsSync();
    deviceJSON.previewSdkInt = DeviceInfo.getPreviewSdkIntSync();
    deviceJSON.securityPatch = DeviceInfo.getSecurityPatchSync();
    deviceJSON.codename = DeviceInfo.getCodenameSync();
    deviceJSON.incremental = DeviceInfo.getIncrementalSync();
    deviceJSON.brightness = DeviceInfo.getBrightnessSync();
    deviceJSON.supported32BitAbis = DeviceInfo.supported32BitAbisSync();
    deviceJSON.supported64BitAbis = DeviceInfo.supported64BitAbisSync();
    deviceJSON.hasGms = DeviceInfo.hasGmsSync();
    deviceJSON.hasHms = DeviceInfo.hasHmsSync();
    deviceJSON.isMouseConnected = DeviceInfo.isMouseConnectedSync();
    deviceJSON.isKeyboardConnected = DeviceInfo.isKeyboardConnectedSync();
    deviceJSON.getSupportedMediaTypeListSync = DeviceInfo.getSupportedMediaTypeListSync();

    return deviceJSON;
  }

  async componentDidMount() {
    let deviceJSON = {};

    try {
      deviceJSON.uniqueId = await getUniqueId();
      deviceJSON.syncUniqueId = await syncUniqueId();
      deviceJSON.manufacturer = await getManufacturer();
      deviceJSON.buildId = await DeviceInfo.getBuildId();
      deviceJSON.isCameraPresent = await DeviceInfo.isCameraPresent();
      deviceJSON.deviceName = await DeviceInfo.getDeviceName();
      deviceJSON.usedMemory = await DeviceInfo.getUsedMemory();
      deviceJSON.userAgent = await DeviceInfo.getUserAgent();
      deviceJSON.instanceId = await DeviceInfo.getInstanceId();
      deviceJSON.installReferrer = await DeviceInfo.getInstallReferrer();
      deviceJSON.installerPackageName = await DeviceInfo.getInstallerPackageName();
      deviceJSON.isEmulator = await DeviceInfo.isEmulator();
      deviceJSON.fontScale = await DeviceInfo.getFontScale();
      deviceJSON.hasNotch = await DeviceInfo.hasNotch();
      deviceJSON.hasDynamicIsland = await DeviceInfo.hasDynamicIsland();
      deviceJSON.firstInstallTime = await DeviceInfo.getFirstInstallTime();
      deviceJSON.lastUpdateTime = await DeviceInfo.getLastUpdateTime();
      deviceJSON.startupTime = await DeviceInfo.getStartupTime();
      deviceJSON.serialNumber = await DeviceInfo.getSerialNumber();
      deviceJSON.androidId = await DeviceInfo.getAndroidId();
      deviceJSON.appSetId = await getAppSetId();
      deviceJSON.IpAddress = await DeviceInfo.getIpAddress();
      deviceJSON.MacAddress = await DeviceInfo.getMacAddress(); // needs android.permission.ACCESS_WIFI_STATE
      deviceJSON.ApiLevel = await DeviceInfo.getApiLevel();
      deviceJSON.carrier = await DeviceInfo.getCarrier()
```

### Core Architecture Module: `example/babel.config.js`
```
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
};

```

### Core Architecture Module: `example/index.js`
```
/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

```

### Core Architecture Module: `example/ios/example-app-extension/ActionViewController.h`
```
//
//  ActionViewController.h
//  example-app-extension
//
//  Created by Dustin Schie on 10/13/20.
//

#import <UIKit/UIKit.h>

@interface ActionViewController : UIViewController
- (void) done;

extern ActionViewController * actionViewController;
@end

```

### Core Architecture Module: `example/ios/example/ActionExtension.h`
```
//
//  ActionExtension.h
//  example
//
//  Created by Dustin Schie on 10/13/20.
//

#import <Foundation/Foundation.h>
#import <React/RCTBridge.h>
NS_ASSUME_NONNULL_BEGIN

@interface ActionExtension : NSObject<RCTBridgeModule>

@end

NS_ASSUME_NONNULL_END

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1463** (2022-10-05): **DeviceInfo.getDeviceName() returns 'unknown' on Android**
  *Symptoms*: <!-- Hi there and thank you for reporting a bug! 🐛🐛🐛  If you want to submit a feature request, use this link instead:   https://github.com/react-native-device-info/react-native-device-info/issues/new?template=feature_request.md -->  ## Summary  We just upgraded from DeviceInfo v8.3.2 to v10.1.2 and noticed that `DeviceInfo.getDeviceName()` is always returning 'unknown' on Android.  |             |     | | ----------- | --- | | Version     | 10.1.2   | | Affected OS | Android   | | OS Version  | 12, 13   |  ## Current behavior  <!-- Describe the issue you are facing, including any available error message, logs, stack trace .. --> `DeviceInfo.getDeviceName()` always returns 'unknown' as the device name.  ## Expected behavior  <!-- What should have happened instead of this bug --> `DeviceInfo.getDeviceName()` should return the actual device name. 
  **Post-Mortem & Fix Analysis**:
  > Hi there! I just pulled the repo and ran the example. I can't reproduce  https://github.com/react-native-device-info/react-native-device-info/blob/7387a623a4f9a4445b81a73172fb54a9c5ef5f37/example/App.js#L207  If you can reproduce this using the example please let me know. Note that the example needs a refresh but I removed `example/yarn.lock` and re-ran `yarn example:install` to make sure it pulled fresh / updated code here from master, and it works like this  ![Screenshot from 2022-09-17 13-15-46](https://user-images.githubusercontent.com/782704/190871107-90b8ab22-e558-401f-a9a3-1e1152cd212e.png)   
  > I should mention - execution environment, I ran that test against an API33 / android 13 emulator

- **Issue #1351** (2021-12-01): **getUserAgent on Galaxy devices / Android 12 causes crash in production**
  *Symptoms*: ## Summary Hi,  Noticed a lot of weird crashes in our bug monitoring tool, it appears to stem by a ResourceNotFound exception thrown while running the getUserAgent flow, apparently because an error thrown by chromoium which I suppose is used to mount a WebView to extract the user agent from.  | Version     | 8.1.3   | | Affected OS | Android   | | OS Version  | 12  |  ## Current behavior  I'm fairly certain getUserAgent causes a crash, once I removed it's use the crash went away.  Stack trace:  ``` android.content.res.Resources$NotFoundException: Resource ID #0x20c0025         at android.content.res.ResourcesImpl.getValue(ResourcesImpl.java:240)          at android.content.res.Resources.getInteger(Resources.java:1275)          at org.chromium.ui.base.DeviceFormFactor.isTablet(Unknown:8)          at cs.a(Unknown:4)          at org.chromium.content.browser.BrowserStartupControllerImpl.e(Unknown:25)          at org.chromium.content.browser.BrowserStartupControllerImpl.g(Unknown:26)          at E8.run(Unknown:127)          at org.chromium.base.ThreadUtils.f(Unknown:6)          at EB0.g(Unknown:209)          at DB0.run(Unknown:7)          at android.os.Handler.handleCallback(Handler.java:938)          at android.os.Handler.dispatchMessage(Handler.java:99)          at android.os.Looper.loopOnce(Looper.java:226)          at android.os.Looper.loop(Looper.java:313)          at android.app.ActivityThread.main(ActivityThread.java:8582) ```   ## Expected

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

### Incident Patch 1: `67bc2cdc` (2025-08-28)
**Commit Message**: fix(android): Resolve NullPointerException in hasKeyboard function

Change `hasKeyboard` to use empty strings for comparison when `getServiceName()` or `getId()` are null.
In the case that `inputMethodInfo` has no service name or id, `hasKeyboard` throws a `NullPointerException`.

Fixes react-native-device-info/react-native-device-info#1722

**File**: `android/src/main/java/com/learnium/RNDeviceInfo/RNDeviceModule.java` (modified, +3/-3)
```diff
@@ -127,7 +127,7 @@ public void onReceive(Context context, Intent intent) {
           updatedPowerState.putString(BATTERY_STATE, batteryState);
           updatedPowerState.putDouble(BATTERY_LEVEL, batteryLevel);
           updatedPowerState.putBoolean(LOW_POWER_MODE, powerSaveState);
-          
+
           sendEvent(getReactApplicationContext(), "RNDeviceInfo_powerStateDidChange", updatedPowerState);
           mLastBatteryState = batteryState;
           mLastPowerSaveState = powerSaveState;
@@ -1113,8 +1113,8 @@ private boolean hasKeyboard(String name) {
     List<InputMethodInfo> inputMethodList = this.inputMethodManager.getEnabledInputMethodList();
     if (inputMethodList != null && !inputMethodList.isEmpty()) {
       for (InputMethodInfo inputMethodInfo : inputMethodList) {
-        String serviceName = inputMethodInfo.getServiceName().toLowerCase();
-        String id = inputMethodInfo.getId().toLowerCase();
+        String serviceName = inputMethodInfo.getServiceName() != null ? inputMethodInfo.getServiceName().toLowerCase() : "";
+        String id = inputMethodInfo.getId() != null ? inputMethodInfo.getId().toLowerCase() : "";
         if (serviceName.contains(name.toLowerCase()) || id.contains(name.toLowerCase())) {
           return true;
         }
```

---

### Incident Patch 2: `b41fa6fa` (2025-11-12)
**Commit Message**: build: workaround obscure types issue for transitive relesae-it dep

tsc cannot find the types for parse-path, but they the are in the
package itself. stackoverflow recommends just overriding typeRoots
and moving on with life

if you do that, then ts-jest blows up though, so we need a separate config
for building (bob, tsc) and for jest.

Finally, jest doesn't like to find custom tsconfigs easily, but tsc and bob do,
so:

1- default tsconfig has the config needed for jest - which is the original one
2- new "build"-only tsconfig just extends the original one with typeroots
3- tsc and bob are pointed to the new one

No, I do not like any of this, but...it works

**File**: `__tests__/supported-platform-info.test.ts` (modified, +2/-2)
```diff
@@ -178,13 +178,13 @@ describe('supported platform info', () => {
 
     it('should have first getter be an async function that returns expected object', async () => {
       const resp = await generatedFns[0]();
-      expect(getter).toBeCalled();
+      expect(getter).toHaveBeenCalled();
       expect(resp).toEqual(getterResponse);
     });
 
     it('should have second getter be a sync function that returns expected object', () => {
       const resp = generatedFns[1]();
-      expect(syncGetter).toBeCalled();
+      expect(syncGetter).toHaveBeenCalled();
       expect(resp).toEqual(getterResponse);
     });
   });
```

**File**: `package.json` (modified, +9/-3)
```diff
@@ -28,7 +28,7 @@
   "scripts": {
     "analyze": "yarn ts-check && yarn flow-check",
     "flow-check": "npx flow-bin check-contents < src/index.js.flow",
-    "ts-check": "npx tsc --noEmit",
+    "ts-check": "npx tsc -p tsconfig.build.json --noEmit",
     "clean": "cd example && npx react-native-clean-project --keep-node-modules --remove-iOS-build --remove-iOS-pods --remove-android-build --clean-android-project --keep-brew --keep-pods && \\rm -fr ios/Pods",
     "dev-sync": "yarn build && cp -r package.json *podspec lib windows android ios src jest example/node_modules/react-native-device-info/",
     "dev-sync-windows": "for %x in (lib windows android src jest) do xcopy \"%x\" .\\example\\node_modules\\react-native-device-info\\%x /S /E /R /H /I /Y",
@@ -94,10 +94,11 @@
     "react-native": "*"
   },
   "devDependencies": {
+    "@jest/globals": "^30.2.0",
     "@react-native-community/eslint-config": "^3.0.1",
     "@release-it/conventional-changelog": "^10.0.1",
     "@testing-library/react-hooks": "^7.0.2",
-    "@types/jest": "^27.4.1",
+    "@types/jest": "^30.0.0",
     "@types/react": "17.0.39",
     "@types/react-native": "^0.67.2",
     "eslint": "^7",
@@ -127,7 +128,12 @@
     "targets": [
       "commonjs",
       "module",
-      "typescript"
+      [
+        "typescript",
+        {
+          "project": "tsconfig.build.json"
+        }
+      ]
     ]
   }
 }
```

**File**: `tsconfig.build.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "extends": "./tsconfig.json", // extend setting from main config
+  "compilerOptions": {
+    "typeRoots": []
+  }
+}
```

**File**: `yarn.lock` (modified, +753/-21)
```diff
@@ -23,7 +23,7 @@
   dependencies:
     "@babel/highlight" "^7.16.7"
 
-"@babel/code-frame@^7.26.2":
+"@babel/code-frame@^7.26.2", "@babel/code-frame@^7.27.1":
   version "7.27.1"
   resolved "https://registry.yarnpkg.com/@babel/code-frame/-/code-frame-7.27.1.tgz#200f715e66d52a23b221a9435534a91cc13ad5be"
   integrity sha512-cjQ7ZlQ0Mv3b47hABuTevyTuYN4i+loJKGeV9flcCgIK37cCXRh+L1bd3iBHlynerhQ7BhCkn2BPbQUL+rGqFg==
@@ -42,6 +42,11 @@
   resolved "https://registry.yarnpkg.com/@babel/compat-data/-/compat-data-7.17.0.tgz#86850b8597ea6962089770952075dcaabb8dba34"
   integrity sha512-392byTlpGWXMv4FbyWw3sAZ/FrW/DrwqLGXpy0mbyNe9Taqv1mg9yON5/o0cnr8XYCkFTZbC1eV+c+LAROgrng==
 
+"@babel/compat-data@^7.27.2":
+  version "7.28.5"
+  resolved "https://registry.yarnpkg.com/@babel/compat-data/-/compat-data-7.28.5.tgz#a8a4962e1567121ac0b3b487f52107443b455c7f"
+  integrity sha512-6uFXyCayocRbqhZOB+6XcuZbkMNimwfVGFji8CTZnCzOHVGvDqzvitu1re2AU5LROliz7eQPhB8CpAMvnx9EjA==
+
 "@babel/core@^7.1.0":
   version "7.12.3"
   resolved "https://registry.yarnpkg.com/@babel/core/-/core-7.12.3.tgz#1b436884e1e3bff6fb1328dc02b208759de92ad8"
@@ -106,6 +111,27 @@
     semver "^5.4.1"
     source-map "^0.5.0"
 
+"@babel/core@^7.23.9", "@babel/core@^7.27.4":
+  version "7.28.5"
+  resolved "https://registry.yarnpkg.com/@babel/core/-/core-7.28.5.tgz#4c81b35e51e1b734f510c99b07dfbc7bbbb48f7e"
+  integrity sha512-e7jT4DxYvIDLk1ZHmU/m/mB19rex9sv0c2ftBtjSBv+kVM/902eh0fINUzD7UwLLNR+jU585GxUJ8/EBfAM5fw==
+  dependencies:
+    "@babel/code-frame" "^7.27.1"
+    "@babel/generator" "^7.28.5"
+    "@babel/helper-compilation-targets" "^7.27.2"
+    "@babel/helper-module-transforms" "^7.28.3"
+    "@babel/helpers" "^7.28.4"
+    "@babel/parser" "^7.28.5"
+    "@babel/template" "^7.27.2"
+    "@babel/traverse" "^7.28.5"
+    "@babel/types" "^7.28.5"
+    "@jridgewell/remapping" "^2.3.5"
+    convert-source-map "^2.0.0"
+    debug "^4.1.0"
+    gensync "^1.0.0-beta.2"
+    json5 "^2.2.3"
+    semver "^6.3.1"
+
 "@babel/generator@^7.11.5", "@babel/generator@^7.12.10", "@babel/generator@^7.12.11":
   version "7.12.11"
   resolved "https://registry.yarnpkg.com/@babel/generator/-/generator-7.12.11.tgz#98a7df7b8c358c9a37ab07a24056853016aba3af"
@@ -133,6 +159,17 @@
     jsesc "^2.5.1"
     source-map "^0.5.0"
 
+"@babel/generator@^7.27.5", "@babel/generator@^7.28.5":
+  version "7.28.5"
+  resolved "https://registry.yarnpkg.com/@babel/generator/-/generator-7.28.5.tgz#712722d5e50f44d07bc7ac9fe84438742dd61298"
+  integrity sha512-3EwLFhZ38J4VyIP6WNtt2kUdW9dokXA9Cr4IVIFHuCpZ3H8/YFOl5JjZHisrn1fATPBmKKqXzDFvh9fUwHz6CQ==
+  dependencies:
+    "@babel/parser" "^7.28.5"
+    "@babel/types" "^7.28.5"
+    "@jridgewell/gen-mapping" "^0.3.12"
+    "@jridgewell/trace-mapping" "^0.3.28"
+    jsesc "^3.0.2"
+
 "@babel/helper-annotate-as-pure@^7.10.4", "@babel/helper-annotate-as-pure@^7.12.10":
   version "7.12.10"
   resolved "https://registry.yarnpkg.com/@babel/helper-annotate-as-pure/-/helper-annotate-as-pure-7.12.10.tgz#54ab9b000e60a93644ce17b3f37d313aaf1d115d"
@@ -175,6 +212,17 @@
     browserslist "^4.17.5"
     semver "^6.3.0"
 
+"@babel/helper-compilation-targets@^7.27.2":
+  version "7.27.2"
+  resolved "https://registry.yarnpkg.com/@babel/helper-compilation-targets/-/helper-compilation-targets-7.27.2.tgz#46a0f6efab808d51d29ce96858dd10ce8732733d"
+  integrity sha512-2+1thGUUWWjLTYTHZWK1n8Yga0ijBz1XAhUXcKy81rd5g6yh7hGqMp45v7cadSbEHc9G3OTv45SyneRN3ps4DQ==
+  dependencies:
+    "@babel/compat-data" "^7.27.2"
+    "@babel/helper-validator-option" "^7.27.1"
+    browserslist "^4.24.0"
+    lru-cache "^5.1.1"
+    semver "^6.3.1"
+
 "@babel/helper-create-class-features-plugin@^7.10.5":
   version "7.10.5"
   resolved "https://registry.yarnpkg.com/@babel/helper-create-class-features-plugin/-/helper-create-class-features-plugin-7.10.5.tgz#9f61446ba80e8240b0a5c85c6fdac8459d6f259d"
@@ -283,6 +331,11 @@
   dependencies:
     "@babel/types" "^7.16.7"
 
+"@babel/helper-globals@^7.28.0":
+  version "7.28.0"
+  resolved "https://registry.yarnpkg.com/@babel/helper-globals/-/helper-globals-7.28.0.tgz#b9430df2aa4e17bc28665eadeae8aa1d985e6674"
+  integrity sha512-+W6cISkXFa1jXsDEdYA8HeevQT/FULhxzR99pxphltZcVaugps53THCeiWA8SguxxpSp3gKPiuYfSWopkLQ4hw==
+
 "@babel/helper-hoist-variables@^7.10.4":
   version "7.10.4"
   resolved "https://registry.yarnpkg.com/@babel/helper-hoist-variables/-/helper-hoist-variables-7.10.4.tgz#d49b001d1d5a68ca5e6604dda01a6297f7c9381e"
@@ -332,6 +385,14 @@
   dependencies:
     "@babel/types" "^7.16.7"
 
+"@babel/helper-module-imports@^7.27.1":
+  version "7.27.1"
+  resolved "https://registry.yarnpkg.com/@babel/helper-module-imports/-/helper-module-imports-7.27.1.tgz#7ef769a323e2655e126673bb6d2d6913bbead204"
+  integrity sha512-0gSFWUPNXNopqtIPQvlD5WgXYI5GY2kP2cCvoT8kczjbfcfuIljTbcWrulD1CIPIX2gt1wghbDy08yE1p+/r3w==
+  dependencies:
+    "@babel/traverse" "^7.27.1"
+    "@babel/types" "^7.27.1"
+
 "@babel/helper-module-transforms@^7.12.1":
   version "7.12.1"
   resolved
```

---

### Incident Patch 3: `04a6f5a8` (2025-02-03)
**Commit Message**: build(deps, ios): new lockfile from pod install

**File**: `example/ios/Podfile.lock` (modified, +10/-10)
```diff
@@ -274,7 +274,7 @@ PODS:
     - React-jsi (= 0.67.3)
     - React-logger (= 0.67.3)
     - React-perflogger (= 0.67.3)
-  - RNDeviceInfo (11.1.0):
+  - RNDeviceInfo (14.0.2):
     - React-Core
   - Yoga (1.14.0)
 
@@ -388,18 +388,18 @@ SPEC CHECKSUMS:
   FBReactNativeSpec: 94473205b8741b61402e8c51716dea34aa3f5b2f
   fmt: ff9d55029c625d3757ed641535fd4a75fedc7ce9
   glog: 85ecdd10ee8d8ec362ef519a6a45ff9aa27b2e85
-  RCT-Folly: 803a9cfd78114b2ec0f140cfa6fa2a6bafb2d685
+  RCT-Folly: 96e860489a846babd2d615e2d2887d5f45c1ae31
   RCTRequired: 3c77b683474faf23920fbefc71c4e13af21470c0
   RCTTypeSafety: 720b1841260dac692444c2822b27403178da8b28
   React: 25970dd74abbdac449ca66dec4107652cacc606d
   React-callinvoker: 2d158700bc27b3d49c3c95721d288ed6c1a489ef
-  React-Core: 306cfdc1393bcf9481cc5de9807608db7661817b
+  React-Core: f87728c12adb5e67f4e72eea805fdfde5aaf0f28
   React-CoreModules: 2576a88d630899f3fcdf2cb79fcc0454d7b2a8bb
-  React-cxxreact: a492f0de07d875419dcb9f463c63c22fe51c433b
-  React-jsi: bca092b0c38d5e3fd60bb491d4994ab4a8ac2ad3
-  React-jsiexecutor: 15ea57ead631a11fad57634ff69f78e797113a39
+  React-cxxreact: f1b7b603da531a3b15211efadb2c5aa91ecfb970
+  React-jsi: afadd89c4c07ce2f5f7287a347a41b0ccdcfce29
+  React-jsiexecutor: 80ea691d7891ac048291b7586a29fbd8987c6a64
   React-jsinspector: 1e1e03345cf6d47779e2061d679d0a87d9ae73d8
-  React-logger: 1e10789cb84f99288479ba5f20822ce43ced6ffe
+  React-logger: d29109d51b25a9fb76e867950001b321bad2d70b
   React-perflogger: 93d3f142d6d9a46e635f09ba0518027215a41098
   React-RCTActionSheet: 87327c3722203cc79cf79d02fb83e7332aeedd18
   React-RCTAnimation: 009c87c018d50e0b38692699405ebe631ff4872d
@@ -411,10 +411,10 @@ SPEC CHECKSUMS:
   React-RCTText: 6d09140f514e1f60aff255e0acdf16e3b486ba4c
   React-RCTVibration: d0361f15ea978958fab7ffb6960f475b5063d83f
   React-runtimeexecutor: af1946623656f9c5fd64ca6f36f3863516193446
-  ReactCommon: 650e33cde4fb7d36781cd3143f5276da0abb2f96
-  RNDeviceInfo: b899ce37a403a4dea52b7cb85e16e49c04a5b88e
+  ReactCommon: 4324b64a75cd7f084cb5297e85dd0e847ff73b15
+  RNDeviceInfo: 801c18d0525e86580900e7b5f562dca0c8c05021
   Yoga: 90dcd029e45d8a7c1ff059e8b3c6612ff409061a
 
 PODFILE CHECKSUM: bdf45547a4661149d5f0f9e028297666a4cdab29
 
-COCOAPODS: 1.15.2
+COCOAPODS: 1.16.2
```

#### Recent Merged Pull Requests:
- **PR #1822** (closed): Add Swift Package Manager manifest (React Native 0.87 SwiftPM) (@serpixel)
- **PR #1808** (closed): build(deps): bump morgan from 1.10.0 to 1.12.0 in /example (@dependabot[bot])
- **PR #1796** (closed): build(deps): bump js-yaml from 3.14.0 to 3.15.1 (@dependabot[bot])
- **PR #1795** (closed): build(deps): bump js-yaml from 3.14.1 to 3.15.1 in /example (@dependabot[bot])
- **PR #1794** (closed): feat(android): expose fold state via androidx.window (@RayKay91)
- **PR #1793** (closed): build(deps): bump ip-address from 10.1.0 to 10.4.0 (@dependabot[bot])

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

## X. android): Resolve NullPointerException in hasKeyboard function

**RULE**:
When implementing operations in `android/src/main/java/com/learnium/RNDeviceInfo/RNDeviceModule.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react-native-device-info/react-native-device-info. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `67bc2cdc`: android): Resolve NullPointerException in hasKeyboard function. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `android/src/main/java/com/learnium/RNDeviceInfo/RNDeviceModule.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:

        String serviceName = inputMethodInfo.getServiceName() != null ? inputMethodInfo.getServiceName().toLowerCase() : "";
        String id = inputMethodInfo.getId() != null ? inputMethodInfo.getId().toLowerCase() : "";
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
          
        String serviceName = inputMethodInfo.getServiceName().toLowerCase();
        String id = inputMethodInfo.getId().toLowerCase();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `67bc2cdc` are properly handled with clean fallback behavior.
