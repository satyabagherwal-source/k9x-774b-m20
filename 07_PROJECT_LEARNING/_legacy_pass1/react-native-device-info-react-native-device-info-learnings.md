# Forensic Learning Record (Deep Inspection): react-native-device-info/react-native-device-info

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-native-device-info-react-native-device-info-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-native-device-info/react-native-device-info](https://github.com/react-native-device-info/react-native-device-info))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:14:42.797Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-native-device-info/react-native-device-info`
- **Description**: Device Information for React Native iOS and Android
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6682 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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
    deviceJSON
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
  > Okay, I finally got some time to dig into this and I realized it's due to the fact that our app is targeting API 33. That causes the `Settings.Secure.getString(getReactApplicationContext().getContentResolver(), "bluetooth_name");` call to throw an exception: `Settings key: <bluetooth_name> is only readable to apps with targetSdkVersion lower than or equal to: 31`.  That exception causes us to get thrown into the exception block so we don't even get the chance to try the `Settings.Global.getString(getReactApplicationContext().getContentResolver(), Settings.Global.DEVICE_NAME);` alternative.  My plan is to patch this for our use by wrapping the 'bluetooth_name' call in a version check. Curious if that makes the most sense to you or if there are other plans for API 31+?

- **Issue #1351** (2021-12-01): **getUserAgent on Galaxy devices / Android 12 causes crash in production**
  *Symptoms*: ## Summary Hi,  Noticed a lot of weird crashes in our bug monitoring tool, it appears to stem by a ResourceNotFound exception thrown while running the getUserAgent flow, apparently because an error thrown by chromoium which I suppose is used to mount a WebView to extract the user agent from.  | Version     | 8.1.3   | | Affected OS | Android   | | OS Version  | 12  |  ## Current behavior  I'm fairly certain getUserAgent causes a crash, once I removed it's use the crash went away.  Stack trace:  ``` android.content.res.Resources$NotFoundException: Resource ID #0x20c0025         at android.content.res.ResourcesImpl.getValue(ResourcesImpl.java:240)          at android.content.res.Resources.getInteger(Resources.java:1275)          at org.chromium.ui.base.DeviceFormFactor.isTablet(Unknown:8)          at cs.a(Unknown:4)          at org.chromium.content.browser.BrowserStartupControllerImpl.e(Unknown:25)          at org.chromium.content.browser.BrowserStartupControllerImpl.g(Unknown:26)          at E8.run(Unknown:127)          at org.chromium.base.ThreadUtils.f(Unknown:6)          at EB0.g(Unknown:209)          at DB0.run(Unknown:7)          at android.os.Handler.handleCallback(Handler.java:938)          at android.os.Handler.dispatchMessage(Handler.java:99)          at android.os.Looper.loopOnce(Looper.java:226)          at android.os.Looper.loop(Looper.java:313)          at android.app.ActivityThread.main(ActivityThread.java:8582) ```   ## Expected
  **Post-Mortem & Fix Analysis**:
  > I fixed the formatting on your issue (triple-backticks are a great markdown trick) so the stack is readable This is a shame, we're not doing anything non-standard here.  https://github.com/react-native-device-info/react-native-device-info/blob/1a10a875c840bbe1ea0cb00fed592974d32d5f32/android/src/main/java/com/learnium/RNDeviceInfo/RNDeviceModule.java#L875  We are even catching RuntimeException which is the base of the android.content.res.Resource.NotFoundException https://developer.android.com/reference/android/content/res/Resources.NotFoundException so we should be catching this  Turns out it's an upstream issue. It's a real issue but there is nothing we can do about it. Go star the issue here so you may follow along: https://bugs.chromium.org/p/chromium/issues/detail?id=1271617  Closing as not actionable but I do hate crash bugs, sorry this is happening. Disable use of that on samsung android 12 for now I guess, although it appears other versions may be affected as well 

- **Issue #1330** (2021-10-25): **iOS 15 crash on calling isLowPowerModeEnabled**
  *Symptoms*: <!-- Hi there and thank you for reporting a bug! 🐛🐛🐛  If you want to submit a feature request, use this link instead:   https://github.com/react-native-community/react-native-device-info/issues/new?template=feature_request.md -->  ## Summary  |             |     | | ----------- | --- | | Version     |  7.2.1  | | Affected OS | iOS   | | OS Version  | 15   |  ## Current behavior  <!-- Describe the issue you are facing, including any available error message, logs, stack trace .. -->  There seems to be a deadlock when calling isLowPowerModeEnabled in iOS 15, causing a crash.  https://github.com/DataDog/dd-sdk-ios/pull/613 I think this same problem is happening with device-info. It might be helpful to fix the crash. I found this crash in v7.2.1, but the process of getting isLowPowerModeEnabled has not changed, so I expect it to happen in the latest v8.4.1.  This is the stack trace we got from firebase. ``` Crashed: com.apple.main-thread 0  libsystem_platform.dylib       0x8e4c _os_unfair_lock_recursive_abort + 36 1  libsystem_platform.dylib       0x17e4 _os_unfair_lock_lock_slow + 324 2  Foundation                     0x27b08 -[NSProcessInfo(NSProcessInfoHardwareState) isLowPowerModeEnabled] + 64 3  {my_project_name}              0x38d154 -[RNDeviceInfo powerState] + 632 (RNDeviceInfo.m:632) 4  {my_project_name}              0x38cf18 -[RNDeviceInfo powerStateDidChange:] + 601 (RNDeviceInfo.m:601) 5  CoreFoundation                 0x28c5c __CFN
  **Post-Mortem & Fix Analysis**:
  > Oh my, that does look serious. The related issue link (to DataDog SDK) is very helpful, thank you - as is their pull request commentary: https://github.com/DataDog/dd-sdk-ios/pull/613/files  So it looks like:  1- we receive a system notification that the battery state changed 2- that causes us to attempt a rebuild of all power state information (including low power mode) 3- while rebuilding low power mode state the system emits a notice about power state changing (perhaps user goes into low power mode that moment? perhaps it *is* the battery state change that switches automatically to low power mode :thinking: ) 4- that causes us to check low power mode again and we deadlock  But...that's not right - there are not 2 threads here, we're all on one thread (main) and just recursively locking for some reason. Perhaps adding some state in to the mix where low power mode is remembered as we go in to this call stack and reused instead of re-queried would be the fix  I'm not sure I
  > @kitoko552 would love your take on this specific commit: https://github.com/react-native-device-info/react-native-device-info/pull/1331/commits/1bf9d2b09e4f8a8d9283fe4426db554577b825ea
  > :tada: This issue has been resolved in version 8.4.2 :tada:  The release is available on: - [npm package (@latest dist-tag)](https://www.npmjs.com/package/react-native-device-info/v/8.4.2) - [GitHub release](https://github.com/react-native-device-info/react-native-device-info/releases/tag/v8.4.2)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1300** (2022-01-20): **hasGms returns as false on Huawei devices which have GMS pre-installed**
  *Symptoms*: ## Summary  |             |     | | ----------- | --- | | Device     | Huawei Mate 10 | | Version     | 8.0.0   | | Affected OS | Android   | | OS Version  | 10 |  ## Current behavior hasGms returned as false  ## Expected behavior hasGms should return true for one of my user's Huawei device as it does have gms pre-installed.  ## Additional notes The user's device Play Store services version is 21.30.16  An investigation into this would be much appreciated!
  **Post-Mortem & Fix Analysis**:
  > Please dig into the code here:  https://github.com/react-native-device-info/react-native-device-info/blob/b7b3a668e2f7b62127a224015e58e77a023c1342/android/src/main/java/com/learnium/RNDeviceInfo/RNDeviceModule.java#L530-L541  Add some `System.err.println("something useful about which line exactly you are on, and the arguments to / return value from the API being exercised");` all over the place and re-test  If the test is failing for some reason there could be an incorrect assumption in the test but devices like yours (Huawei with google services these days? :thinking: ) so we need someone with the actual device to test on device and ideally repair the logic
  > Hi, I currently do not have access to a Huawei phone with GMS pre-installed.  Also, regarding Huawei devices which do have GMS pre-installed. These are devices which were released before the Huawei ban in 2019. We have many users who bought a Huawei device before that ban and are experiencing strange issues these days.  I do have a Huawei Nova 7 SE (Android 10). Unfortunately, this device does not have GMS pre-installed.   I did find something strange though. I have tried running the following code on Android Studio out of curiosity `int avail_int = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(this);`  I have found that the value returned was, surprisingly, 9 aka SERVICE_INVALID. I would have expected it to be 1 aka SERVICE_MISSING.   This leads me to suspect the issue might be on the isGooglePlayServicesAvailable() function itself.  I will update further on this issue if possible. I would like to try and get one of my users to run this function and se
  > Anything you can do to get to the bottom of it is hugely appreciated! Never time pressure or any pressure, it's open source, so long as there is the mirror-image expectation that in the absence of you doing any work, nothing may happen :-) - in the general "you" sense, that is myself included. Cheers

- **Issue #1290** (2021-10-03): **Windows CI build broken - expired certificate - needs windows builder to help**
  *Symptoms*:  ## Summary  |             |     | | ----------- | --- | | Version     |  current master commit from github  | | Affected OS | windows  | | OS Version  | whatever is in the github actions hosted runner  |  ## Current behavior  ``` Build failed with message      9>C:\Program Files (x86)\Microsoft Visual Studio\2019\Enterprise\MSBuild\Microsoft\VisualStudio\v16.0\AppxPackage\Microsoft.AppXPackage.Targets(3468,5): error APPX0108: The certificate specified has expired. For more information about renewing certificates, see http://go.microsoft.com/fwlink/?LinkID=241478. [D:\a\react-native-device-info\react-native-device-info\example\windows\example\example.vcxproj]. Check your build configuration. ```  ## Expected behavior  CI should successfully build windows here  I don't have a valid windows build environment at the moment, I'll need someone to help fix this. :pray:  
  **Post-Mortem & Fix Analysis**:
  > @namrog84 nailed this one

- **Issue #1178** (2021-03-17): **Unable to compile with Mac Catalyst  13**
  *Symptoms*: https://github.com/react-native-device-info/react-native-device-info/blob/c50b1b93621e6241331e5422c28ec774845a304a/ios/RNDeviceInfo/RNDeviceInfo.m#L116  This UIIdiom is only available in native macOS and Mac Catalyst 14. This breaks the ability to compile with Mac Catalyst 13.
  **Post-Mortem & Fix Analysis**:
  > PRs happily merged!
  > Hi there - after some investigation and testing on #1181 it appears that Xcode 12, which is the minimum for react-native these days (a reasonable stance, it's needed for new APIs) won't let you target catalyst 13 anymore, so requiring catalyst 14 seems reasonable

- **Issue #1038** (2020-07-11): **iOS does not detect low battery correctly**
  *Symptoms*: # Bug report  ## Summary  when iOS devices go above the low battery threshold, they continue emitting low power events  if you listen to battery changed events in the module, you will get one every time the battery moves a whole percentage of charge.  If you also listen to low battery events, you'll notice that you always get low power events even when above the threshold  It's actually an expectations issue (percentage as 0-100 or as 0.00 to 1.00) in the iOS code so the math check always has the wrong result, PR coming up

- **Issue #955** (2020-02-11): **[5.5.0] getInstallReferrer reqiure READ_PHONE_STATE and WRITE_EXTERNAL_STORAGE**
  *Symptoms*: # Question Hello my app was to require `READ_PHONE_STATE` and `WRITE_EXTERNAL_STORAGE` permissions on Android after update to `5.5.0`.  I checked in [this commit](https://github.com/react-native-community/react-native-device-info/commit/ce8a85196990e2739410a5c9752eaf8190421ab8) extra permissions not required. Then can't build [this commit](https://github.com/react-native-community/react-native-device-info/commit/be42ff860b47c5f8899d8075e03c682ba7db2f9b) and after build [next commit](https://github.com/react-native-community/react-native-device-info/commit/d63f18a47247b98e9cc4cdad9b43c3270acba459) in my `android/app/build/intermediates/bundle_manifest/debug/processDebugManifest/bundle-manifest/AndroidManifest.xml` added: ``` <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" /> <uses-permission android:name="android.permission.READ_PHONE_STATE" /> ```  I don't use `getInstallReferrer` and don't want request extra permissions form user. Can it be excluded?
  **Post-Mortem & Fix Analysis**:
  > So you want something like this in your AndroidManifest:  ``` <manifest xmlns:android="http://schemas.android.com/apk/res/android"    xmlns:tools="http://schemas.android.com/tools" package="com.kullki.kscore">    <uses-permission tools:node="remove" android:name="android.permission.READ_EXTERNAL_STORAGE" />   <uses-permission tools:node="remove" android:name="android.permission.WRITE_EXTERNAL_STORAGE" />  ```
  > (for the permissions you care about though of course - that's just the "how" to do it)
  > Yea, I'm just trying to use `tools:node="remove"`.  Is it good solution enough? And will not cut permissions if other dependencies are required this permissions? So no ideas to remove these permissions from `react-native-device-info` by default?  Thank you.

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

### Incident Patch 1: `84017707` (2026-02-21)
**Commit Message**: fix(android): add optional gradle dependency for appSetId to work (#1750)


it is a play services library, and is required to make the appSetId functionality work, but the APIs are accessed reflexively so this shouldn't affect anyone that distributes to devices that don't have Play Services on them, or for various reasons cannot accept the licensing of the Play Services dependencies

**File**: `.github/workflows/windows-app-test.yml` (modified, +3/-0)
```diff
@@ -9,6 +9,9 @@ jobs:
   run-windows-tests:
     name: Build & run tests
     runs-on: windows-2019
+    env:
+      # Node 17+ uses OpenSSL 3.0; Metro/RN bundler needs legacy provider for hashing
+      NODE_OPTIONS: --openssl-legacy-provider
 
     steps:
     - uses: actions/checkout@v5
```

**File**: `README.md` (modified, +4/-3)
```diff
@@ -73,7 +73,8 @@ This module defaults to AndroidX you should configure your library versions simi
     googlePlayServicesIidVersion = "17.0.0" // default: "17.0.0" - AndroidX
     //Option 3 (legacy GooglePlay dependency before AndroidX):
     googlePlayServicesIidVersion = "16.0.1"
-
+    // getAppSetId() - optional: set to include play-services-appset (e.g. "16.1.0")
+    // playServicesAppSetVersion = "16.1.0"
 
     //include as needed:
     compileSdkVersion = "28" // default: 28 (28 is required for AndroidX)
@@ -245,7 +246,7 @@ DeviceInfo.getAndroidId().then((androidId) => {
 
 ### getAppSetId()
 
-Gets the AppSetId for Android devices. AppSetId is part of Android's Privacy Sandbox and provides a privacy-preserving identifier for advertising and analytics purposes. This API is only available on Android 14 (API level 34) and above.
+Gets the App Set ID for Android devices via Google Play services. App Set ID provides a privacy-preserving identifier for correlating usage across apps from the same developer (e.g. analytics, fraud prevention). **Optional**: set `playServicesAppSetVersion` in your app's `android/build.gradle` ext to include the dependency; otherwise returns `{ id: 'unknown', scope: -1 }`.
 
 The returned object contains:
 - `id`: The AppSetId string value (returns "unknown" if not available)
@@ -273,7 +274,7 @@ if (appSetIdInfo.id === 'unknown') {
 }
 ```
 
-**Note**: AppSetId requires Android 14 (API level 34) or higher. On older Android versions or when the service is unavailable, the function will return `{ id: 'unknown', scope: -1 }`.
+**Note**: To use `getAppSetId()` on Android you must add the optional dependency by setting `playServicesAppSetVersion` in your app's `android/build.gradle` ext block (e.g. `playServicesAppSetVersion = "16.1.0"`). If the dependency is not included or the service is unavailable, the function returns `{ id: 'unknown', scope: -1 }`.
 
 ---
 
```

**File**: `android/build.gradle` (modified, +5/-0)
```diff
@@ -60,6 +60,7 @@ dependencies {
   def firebaseBomVersion = safeExtGet("firebaseBomVersion", null)
   def firebaseIidVersion = safeExtGet('firebaseIidVersion', null)
   def googlePlayServicesIidVersion = safeExtGet('googlePlayServicesIidVersion', null)
+  def playServicesAppSetVersion = safeExtGet('playServicesAppSetVersion', null)
 
   if (firebaseBomVersion) {
       implementation platform("com.google.firebase:firebase-bom:${firebaseBomVersion}")
@@ -69,6 +70,10 @@ dependencies {
   } else if(googlePlayServicesIidVersion){
       implementation "com.google.android.gms:play-services-iid:$googlePlayServicesIidVersion"
   }
+  // Needed for getAppSetId() to work - optional: set playServicesAppSetVersion in app's ext to include
+  if (playServicesAppSetVersion) {
+    implementation "com.google.android.gms:play-services-appset:$playServicesAppSetVersion"
+  }
 
   testImplementation 'org.junit.jupiter:junit-jupiter-api:5.7.0'
   testImplementation "org.mockito:mockito-core:3.6.28"
```

**File**: `android/src/main/java/com/learnium/RNDeviceInfo/RNDeviceModule.java` (modified, +53/-34)
```diff
@@ -2,8 +2,6 @@
 
 import android.Manifest;
 import android.annotation.SuppressLint;
-import android.adservices.appsetid.AppSetId;
-import android.adservices.appsetid.AppSetIdManager;
 import android.app.KeyguardManager;
 import android.content.BroadcastReceiver;
 import android.content.Context;
@@ -21,7 +19,6 @@
 import android.net.wifi.WifiInfo;
 import android.os.Build;
 import android.os.Environment;
-import android.os.OutcomeReceiver;
 import android.os.PowerManager;
 import android.os.StatFs;
 import android.os.BatteryManager;
@@ -66,6 +63,9 @@
 import java.math.BigInteger;
 import java.util.Locale;
 import java.util.Map;
+import java.lang.reflect.InvocationHandler;
+import java.lang.reflect.Method;
+import java.lang.reflect.Proxy;
 
 import javax.annotation.Nonnull;
 
@@ -1128,43 +1128,62 @@ private boolean hasKeyboard(String name) {
 
   @ReactMethod
   public void getAppSetId(Promise promise) {
-    System.err.println("RNDI: getAppSetId starting");
-    if (Build.VERSION.SDK_INT >= 34) { // Android 14 (API level 34)
-      try {
-        AppSetIdManager appSetIdManager = AppSetIdManager.get(getReactApplicationContext());
-        appSetIdManager.getAppSetId(
-          getReactApplicationContext().getMainExecutor(), 
-          new OutcomeReceiver<AppSetId, Exception>() {
-            public void onResult(AppSetId appSetId) {
-              System.err.println("RNDI: AppSetId success.");
+    try {
+      // Optionally load App Set classes via reflection (only when play-services-appset is included)
+      Class<?> appSetClass = Class.forName("com.google.android.gms.appset.AppSet");
+      ClassLoader loader = appSetClass.getClassLoader();
+      Method getClientMethod = appSetClass.getMethod("getClient", Context.class);
+      Object client = getClientMethod.invoke(null, getReactApplicationContext());
+      Method getAppSetIdInfoMethod = client.getClass().getMethod("getAppSetIdInfo");
+      Object task = getAppSetIdInfoMethod.invoke(client);
+
+      Class<?> onSuccessListenerClass =
+          Class.forName("com.google.android.gms.tasks.OnSuccessListener", true, loader);
+      InvocationHandler successHandler =
+          (proxy, method, args) -> {
+            if ("onSuccess".equals(method.getName()) && args != null && args.length == 1) {
+              Object appSetIdInfo = args[0];
+              String id = (String) appSetIdInfo.getClass().getMethod("getId").invoke(appSetIdInfo);
+              Object scopeObj = appSetIdInfo.getClass().getMethod("getScope").invoke(appSetIdInfo);
+              int scope = scopeObj instanceof Number ? ((Number) scopeObj).intValue() : -1;
               WritableMap result = Arguments.createMap();
-              result.putString("id", appSetId.getId());
-              result.putInt("scope", appSetId.getScope());
+              result.putString("id", id != null ? id : "unknown");
+              result.putInt("scope", scope);
               promise.resolve(result);
-            };
-            public void onError(Exception exception) {
-              System.err.println("RNDI: AppSetId was a failure: " + exception);
-              exception.printStackTrace(System.err);
-              // Return default values instead of rejecting the promise
+            }
+            return null;
+          };
+      Object successListener =
+          Proxy.newProxyInstance(loader, new Class<?>[] {onSuccessListenerClass}, successHandler);
+
+      Class<?> onFailureListenerClass =
+          Class.forName("com.google.android.gms.tasks.OnFailureListener", true, loader);
+      InvocationHandler failureHandler =
+          (proxy, method, args) -> {
+            if ("onFailure".equals(method.getName()) && args != null && args.length == 1) {
+              Exception e = (Exception) args[0];
+              System.err.println("RNDI: AppSetId was a failure: " + e);
+              e.printStackTrace(System.err);
               WritableMap result = Arguments.createMap();
               result.putString("id"
```

**File**: `src/internal/types.ts` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ export type AvailableCapacityType = 'total' | 'important' | 'opportunistic';
 
 /**
  * Google Play Services App Set ID payload describing identifier and scope.
+ * When the API is unavailable, id is "unknown" and scope is -1.
  */
 export interface AppSetIdInfo {
   id: string;
```

---

### Incident Patch 2: `67e1e7b3` (2025-11-13)
**Commit Message**: fix(ci): require a manual trigger for release

the auto release wasn't behaving the way I like, and I prefer to control
releases anyway, as I usually batch changes

**File**: `.github/workflows/release.yml` (modified, +0/-4)
```diff
@@ -1,9 +1,5 @@
 name: Release
 on:
-  # Triggers the workflow on push or pull request events but only for the master branch
-  push:
-    branches:
-      - master
   # Allows you to run this workflow manually from the Actions tab
   workflow_dispatch:
 
```

---

### Incident Patch 3: `410e130d` (2025-11-12)
**Commit Message**: build(ci): set a publishConfig in attempt to fix new publish style

OIDC still rejecting with ENEEDAUTH

**File**: `package.json` (modified, +4/-0)
```diff
@@ -135,5 +135,9 @@
         }
       ]
     ]
+  },
+  "publishConfig": {
+    "access": "public",
+    "registry": "https://registry.npmjs.org/"
   }
 }
```

---

### Incident Patch 4: `b41fa6fa` (2025-11-12)
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
+ 
```

---

### Incident Patch 5: `67bc2cdc` (2025-08-28)
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

### Incident Patch 6: `07017cbf` (2025-02-03)
**Commit Message**: fix(android): quiet a build warning for users

we already handle the onCatalystInstanceDestroy method
deprecation pretty well, but we get build warnings
for even keeping the old API, though we do that
on purpose for backwards-compatibility

So suppress those build warnings since they look
worrisome but are not actionable

**File**: `android/src/main/java/com/learnium/RNDeviceInfo/RNDeviceModule.java` (modified, +1/-0)
```diff
@@ -197,6 +197,7 @@ public void onReceive(Context context, Intent intent) {
   // the upstream method was removed in react-native 0.74
   // this stub remains for backwards compatibility so that react-native < 0.74
   // (which will still call onCatalystInstanceDestroy) will continue to function
+  @SuppressWarnings({"deprecation", "removal"})
   public void onCatalystInstanceDestroy() {
     invalidate();
   }
```

---

### Incident Patch 7: `75ea74ec` (2025-02-03)
**Commit Message**: fix(android): restore compatibility for Android <= 23

the minSdk for supported versions of react-native will be 24 once
react-native 0.78 ships, but there is no reason not to maintain
compatibility with 23 right now

however, the API the process uptime feature depends on doesn't exist
before then so just return our "undefined" numeric value of -1

**File**: `android/src/main/java/com/learnium/RNDeviceInfo/RNDeviceModule.java` (modified, +13/-9)
```diff
@@ -772,15 +772,19 @@ public double getLastUpdateTimeSync() {
 
   @ReactMethod(isBlockingSynchronousMethod = true)
   public double getStartupTimeSync() {
-    // Get time in milliseconds since unix epoch
-    long currentTime = System.currentTimeMillis();
-    // Get the time when the process started in milliseconds since system boot
-    long processStartTime = Process.getStartUptimeMillis();
-    // Get the milliseconds since system boot time
-    long currentUptime = SystemClock.uptimeMillis();
-    // Calculate the process startup time in milliseconds since unix epoch
-    long startupTime = currentTime - currentUptime + processStartTime;
-    return BigInteger.valueOf(startupTime).doubleValue();
+    if (Build.VERSION.SDK_INT >= 24) {
+      // Get time in milliseconds since unix epoch
+      long currentTime = System.currentTimeMillis();
+      // Get the time when the process started in milliseconds since system boot
+      long processStartTime = Process.getStartUptimeMillis();
+      // Get the milliseconds since system boot time
+      long currentUptime = SystemClock.uptimeMillis();
+      // Calculate the process startup time in milliseconds since unix epoch
+      long startupTime = currentTime - currentUptime + processStartTime;
+      return BigInteger.valueOf(startupTime).doubleValue();
+    }
+
+    return -1;
   }
 
   @ReactMethod
```

---

### Incident Patch 8: `f750f263` (2024-12-17)
**Commit Message**: fix(tvos): fix build errors for tvos (#1670) (#1684)

**File**: `ios/RNDeviceInfo/RNDeviceInfo.m` (modified, +4/-2)
```diff
@@ -37,9 +37,7 @@ typedef NS_ENUM(NSInteger, DeviceType) {
 @import CoreTelephony;
 #endif
 
-#if !TARGET_OS_TV
 @import Darwin.sys.sysctl;
-#endif
 
 @implementation RNDeviceInfo
 {
@@ -637,13 +635,17 @@ - (double)getFreeDiskStorage:(NSString *)storageType {
 }
 
 - (NSString *)keyForStorageType:(NSString *)storageType {
+#if TARGET_OS_TV
+    return NSURLVolumeAvailableCapacityKey;
+#else
     if ([storageType isEqualToString:@"important"]) {
         return NSURLVolumeAvailableCapacityForImportantUsageKey;
     } else if ([storageType isEqualToString:@"opportunistic"]) {
         return NSURLVolumeAvailableCapacityForOpportunisticUsageKey;
     } else {
         return NSURLVolumeAvailableCapacityKey;
     }
+#endif
 }
 
 RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getFreeDiskStorageSync:(NSString *)storageType) {
```

---

### Incident Patch 9: `b2c7c4fd` (2024-11-23)
**Commit Message**: fix(windows): Update RNDeviceInfoCPP.h for windows on ARM CPU arch on windows (#1679)

* Update RNDeviceInfoCPP.h for windows on ARM CPU arch on windows
* Update README.md

**File**: `README.md` (modified, +1/-2)
```diff
@@ -1412,8 +1412,7 @@ Returns a list of supported processor architecture version
 
 ```js
 DeviceInfo.supportedAbis().then((abis) => {
-  // [ "arm64 v8", "Intel x86-64h Haswell", "arm64-v8a", "armeabi-v7a", "armeabi", "win_x86", "win_arm", "win_x64" ]
-});
+  // [ "arm64 v8", "Intel x86-64h Haswell", "arm64-v8a", "armeabi-v7a", "armeabi", "win_x86", "win_arm", "win_x64", "win_arm64", "win_x86onarm64" ]});
 ```
 
 ---
```

**File**: `windows/code/RNDeviceInfoCPP.h` (modified, +6/-0)
```diff
@@ -109,6 +109,12 @@ namespace winrt::RNDeviceInfoCPP
             break;
         case Windows::System::ProcessorArchitecture::Neutral:
             arch = "neutral";
+	    break;
+        case Windows::System::ProcessorArchitecture::Arm64:
+            arch = "win_arm64";
+	    break;
+        case Windows::System::ProcessorArchitecture::X86OnArm64:
+            arch = "win_x86onarm64";
             break;
         default:
             arch = "unknown";
```

---

### Incident Patch 10: `50091152` (2024-10-26)
**Commit Message**: fix(android)!: remove AD_ID permission by removing auto-addition of play-services-iid (#1673)

BREAKING CHANGE: removed default fallback getDeviceId via play-services-iid dependency

This dependency has the unfortunate side effect of including AD_ID permission, which is
not permissible for many types of applications.

If you relied on this functionality, you will need to define googlePlayServicesIidVersion in your
android gradle build files ext version block. We previously used version 17.0.0 but there may be
newer versions you could use if they work for

**File**: `android/build.gradle` (modified, +4/-3)
```diff
@@ -59,14 +59,15 @@ dependencies {
   implementation "com.android.installreferrer:installreferrer:${safeExtGet('installReferrerVersion', '1.1.2')}"
   def firebaseBomVersion = safeExtGet("firebaseBomVersion", null)
   def firebaseIidVersion = safeExtGet('firebaseIidVersion', null)
+  def googlePlayServicesIidVersion = safeExtGet('googlePlayServicesIidVersion', null)
+
   if (firebaseBomVersion) {
       implementation platform("com.google.firebase:firebase-bom:${firebaseBomVersion}")
       implementation "com.google.firebase:firebase-iid"
   } else if(firebaseIidVersion){
       implementation "com.google.firebase:firebase-iid:${firebaseIidVersion}"
-  }else{
-      def iidVersion = safeExtGet('googlePlayServicesIidVersion', safeExtGet('googlePlayServicesVersion', '17.0.0'))
-      implementation "com.google.android.gms:play-services-iid:$iidVersion"
+  } else if(googlePlayServicesIidVersion){
+      implementation "com.google.android.gms:play-services-iid:$googlePlayServicesIidVersion"
   }
 
   testImplementation 'org.junit.jupiter:junit-jupiter-api:5.7.0'
```

**File**: `android/src/main/java/com/learnium/RNDeviceInfo/resolver/DeviceIdResolver.java` (modified, +1/-0)
```diff
@@ -84,4 +84,5 @@ String getFirebaseInstanceId() throws ClassNotFoundException, NoSuchMethodExcept
     Method method1 = obj.getClass().getMethod("getId");
     return (String) method1.invoke(obj);
   }
+
 }
```

#### Recent Merged Pull Requests:
- **PR #1808** (closed): build(deps): bump morgan from 1.10.0 to 1.12.0 in /example (@dependabot[bot])
- **PR #1796** (closed): build(deps): bump js-yaml from 3.14.0 to 3.15.1 (@dependabot[bot])
- **PR #1795** (closed): build(deps): bump js-yaml from 3.14.1 to 3.15.1 in /example (@dependabot[bot])
- **PR #1793** (closed): build(deps): bump ip-address from 10.1.0 to 10.4.0 (@dependabot[bot])
- **PR #1791** (closed): build(deps): bump brace-expansion from 1.1.11 to 1.1.16 (@dependabot[bot])
- **PR #1790** (closed): build(deps): bump morgan from 1.10.0 to 1.11.0 in /example (@dependabot[bot])
- **PR #1789** (closed): build(deps): bump js-yaml from 3.14.0 to 3.15.0 (@dependabot[bot])
- **PR #1788** (closed): build(deps): bump js-yaml from 3.14.1 to 3.15.0 in /example (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
