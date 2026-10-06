# Forensic Learning Record (Deep Inspection): zoontek/react-native-permissions

> **Canonical Artifact**: `07_PROJECT_LEARNING/zoontek-react-native-permissions-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zoontek/react-native-permissions](https://github.com/zoontek/react-native-permissions))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:03:13.981Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zoontek/react-native-permissions`
- **Description**: An unified permissions API for React Native on iOS, Android and Windows.
- **Primary Language / Ecosystem**: Objective-C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4374 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/utils.ts`
```
export const proxifyPermissions = <T extends Record<string, string>>(
  platform: 'android' | 'ios' | 'windows',
): T =>
  new Proxy({} as T, {
    get: (_, prop): string | symbol =>
      typeof prop === 'string' ? `${platform}.permission.${prop}` : prop,
  });

export const uniq = <T>(array: T[]): T[] => {
  return array.filter((item, index) => item != null && array.indexOf(item) === index);
};

```

### Core Architecture Module: `android/src/main/java/com/zoontek/rnpermissions/RNPermissionsModuleImpl.kt`
```
package com.zoontek.rnpermissions

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.SparseArray

import androidx.core.app.NotificationManagerCompat

import com.facebook.common.logging.FLog
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

object RNPermissionsModuleImpl {
  const val NAME = "RNPermissions"

  private var requestCode = 0

  private const val ERROR_INVALID_ACTIVITY = "E_INVALID_ACTIVITY"
  private const val GRANTED = "granted"
  private const val DENIED = "denied"
  private const val UNAVAILABLE = "unavailable"
  private const val BLOCKED = "blocked"

  // Based on https://developer.android.com/reference/android/Manifest.permission
  // Permissions not explicitly listed are considered available (API < 21)
  private val minimumApi = mapOf(
    "android.permission.ACCEPT_HANDOVER" to 28,
    "android.permission.ACCESS_BACKGROUND_LOCATION" to 29,
    "android.permission.ACCESS_MEDIA_LOCATION" to 29,
    "android.permission.ACTIVITY_RECOGNITION" to 29,
    "android.permission.ANSWER_PHONE_CALLS" to 26,
    "android.permission.BLUETOOTH_ADVERTISE" to 31,
    "android.permission.BLUETOOTH_CONNECT" to 31,
    "android.permission.BLUETOOTH_SCAN" to 31,
    "android.permission.BODY_SENSORS_BACKGROUND" to 33,
    "android.permission.NEARBY_WIFI_DEVICES" to 33,
    "android.permission.READ_MEDIA_AUDIO" to 33,
    "android.permission.READ_MEDIA_IMAGES" to 33,
    "android.permission.READ_MEDIA_VIDEO" to 33,
    "android.permission.READ_MEDIA_VISUAL_USER_SELECTED" to 34,
    "android.permission.READ_PHONE_NUMBERS" to 26,
    "android.permission.UWB_RANGING" to 31
  )

  private fun isPermissionAvailable(permission: String): Boolean =
    (permission.startsWith("android.") || permission.startsWith("com.android")) &&
      Build.VERSION.SDK_INT >= (minimumApi[permission] ?: Build.VERSION_CODES.BASE)

  fun openSettings(reactContext: ReactApplicationContext, type: String?, promise: Promise) {
    try {
      val packageName = reactContext.packageName

      val intent = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && type == "alarms" -> Intent().apply {
          setAction(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
          setData(Uri.parse("package:${packageName}"))
        }
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE && type == "fullscreen" -> Intent().apply {
          setAction(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
          setData(Uri.parse("package:${packageName}"))
        }
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && type == "notifications" -> Intent().apply {
          setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        }
        else -> Intent().apply {
          setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
          setData(Uri.parse("package:${packageName}"))
        }
      }.apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject(ERROR_INVALID_ACTIVITY, e)
    }
  }

  fun canScheduleExactAlarms(reactContext: ReactApplicationContext, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return promise.resolve(true)
    }

    val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
    val canScheduleExactAlarms: Boolean = alarmManager?.canScheduleExactAlarms() ?: false

    promise.resolve(canScheduleExactAlarms)
  }

  fun canUseFullScreenIntent(reactContext: ReactApplicationContext, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      return promise.resolve(true)
    }

    val notificationManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val canUseFullScreenIntent = notificationManager.canUseFullScreenIntent()

    promise.resolve(canUseFullScreenIntent)
  }

  fun check(reactContext: ReactApplicationContext, permission: String, promise: Promise) {
    if (!isPermissionAvailable(permission)) {
      return promise.resolve(UNAVAILABLE)
    }

    val context = reactContext.baseContext

    if (context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) {
      promise.resolve(GRANTED)
    } else {
      promise.resolve(DENIED)
    }
  }

  // Only used on Android < 13 (the POST_NOTIFICATIONS runtime permission isn't available)
  fun checkNotifications(reactContext: ReactApplicationContext, promise: Promise) {
    val enabled = NotificationManagerCompat.from(reactContext).areNotificationsEnabled()

    val output = Arguments.createMap().apply {
      putString("status", if (enabled) GRANTED else DENIED)
      putMap("settings", Arguments.createMap())
    }

    promise.resolve(output)
  }

  fun checkMultiple(reactContext: ReactApplicationContext, permissions: ReadableArray, promise: Promise) {
    val output: WritableMap = WritableNativeMap()
    val context = reactContext.baseContext

    for (i in 0 until permissions.size()) {
      val permission = permissions.getString(i)

      if (permission.isNullOrBlank()) {
        continue;
      }

      output.putString(
        permission,
        when {
          !isPermissionAvailable(permission) -> UNAVAILABLE
          context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED -> GRANTED
          else -> DENIED
        }
      )
    }

    promise.resolve(output)
  }

  fun request(
    reactContext: ReactApplicationContext,
    listener: PermissionListener,
    callbacks: SparseArray<Callback>,
    permission: String,
    promise: Promise
  ) {
    if (!isPermissionAvailable(permission)) {
      return promise.resolve(UNAVAILABLE)
    }

    val context = reactContext.baseContext

    if (context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) {
      return promise.resolve(GRANTED)
    }

    try {
      val activity = getPermissionAwareActivity(reactContext)

      callbacks.put(
        requestCode,
        Callback { args ->
          val results = args[0] as IntArray
          val callbackActivity = args[1] as PermissionAwareActivity

          promise.resolve(
            when {
              results.getOrNull(0) == PackageManager.PERMISSION_GRANTED -> GRANTED
              callbackActivity.shouldShowRequestPermissionRationale(permission) -> DENIED
              else -> BLOCKED
            }
          )
        })

      activity.requestPermissions(arrayOf(permission), requestCode, listener)
      requestCode++
    } catch (e: IllegalStateException) {
      promise.reject(ERROR_INVALID_ACTIVITY, e)
    }
  }

  // Only used on Android < 13 (the POST_NOTIFICATIONS runtime permission isn't available)
  fun requestNotifications(reactContext: ReactApplicationContext, promise: Promise) {
    val enabled = NotificationManagerCompat.from(reactContext).areNotificationsEnabled()

    val output = Arguments.createMap().apply {
      putString("status", if (enabled) GRANTED else BLOCKED)
      putMap("settings", Arguments.createMap())
    }

    promise.resolve(output)
  }

  fun requestMultiple(
    reactContext: ReactApplicationContext,
    listener: PermissionListener,
    callbacks: SparseArray<Callback>,
    permissions: ReadableArray,
    promise: Promise
  ) {
    val output: WritableMap = WritableNativeMap()
    val permissionsToCheck = ArrayList<String>()
    var checkedPermissionsCount = 0
    val context = reactContext.baseContext

    for (i in 0 until permissions.size()) {
      val permission = permissions.getString(i)

      if (permission.isNullOrBlank()) {
        continue;
      }

      if (!isPermissionAvailable(permission)) {
        output.putString(permission, UNAVAILABLE)
        checkedPermissionsCount++
      } else if (context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) {
        output.putString(permission, GRANTED)
        checkedPermissionsCount++
      } else {
        permissionsToCheck.add(permission)
      }
    }

    if (permissions.size() == checkedPermissionsCount) {
      return promise.resolve(output)
    }

    try {
      val activity = getPermissionAwareActivity(reactContext)

      callbacks.put(
        requestCode,
        Callback { args ->
          val results = args[0] as IntArray
          val callbackActivity = args[1] as PermissionAwareActivity

          permissionsToCheck.forEachIndexed { index, permission ->
            output.putString(
              permission,
              when {
                results.getOrNull(index) == PackageManager.PERMISSION_GRANTED -> GRANTED
                callbackActivity.shouldShowRequestPermissionRationale(permission) -> DENIED
                else -> BLOCKED
              }
            )

          }

          promise.resolve(output)
        })

      activity.requestPermissions(permissionsToCheck.toTypedArray<String>(), requestCode, listener)
      requestCode++
    } catch (e: IllegalStateException) {
      promise.reject(ERROR_INVALID_ACTIVITY, e)
    }
  }

  fun shouldShowRequestRationale(reactContext: ReactApplicationContext, permission: String, promise: Promise) {
    try {
      promise.resolve(getPermissionAwareActivity(reactContext).shouldShowRequestPermissionRationale(permission))
    } catch (e: IllegalStateException) {
   
```

### Core Architecture Module: `android/src/main/java/com/zoontek/rnpermissions/RNPermissionsPackage.kt`
```
package com.zoontek.rnpermissions

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class RNPermissionsPackage : TurboReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      RNPermissionsModuleImpl.NAME -> RNPermissionsModule(reactContext)
      else -> null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      val isTurboModule = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED

      val moduleInfo = ReactModuleInfo(
        RNPermissionsModuleImpl.NAME,
        RNPermissionsModuleImpl.NAME,
        false,
        true,
        false,
        isTurboModule
      )

      moduleInfos[RNPermissionsModuleImpl.NAME] = moduleInfo
      moduleInfos
    }
  }
}

```

### Core Architecture Module: `android/src/newarch/com/zoontek/rnpermissions/RNPermissionsModule.kt`
```
package com.zoontek.rnpermissions

import android.util.SparseArray

import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.PermissionListener

@ReactModule(name = RNPermissionsModuleImpl.NAME)
class RNPermissionsModule(reactContext: ReactApplicationContext?) :
  NativeRNPermissionsSpec(reactContext), PermissionListener {

  private val callbacks = SparseArray<Callback>()

  override fun getName(): String {
    return RNPermissionsModuleImpl.NAME
  }

  override fun openSettings(type: String?, promise: Promise) {
    RNPermissionsModuleImpl.openSettings(reactApplicationContext, type, promise)
  }

  override fun canScheduleExactAlarms(promise: Promise) {
    RNPermissionsModuleImpl.canScheduleExactAlarms(reactApplicationContext, promise)
  }

  override fun canUseFullScreenIntent(promise: Promise) {
    RNPermissionsModuleImpl.canUseFullScreenIntent(reactApplicationContext, promise)
  }

  override fun check(permission: String, promise: Promise) {
    RNPermissionsModuleImpl.check(reactApplicationContext, permission, promise)
  }

  override fun checkNotifications(promise: Promise) {
    RNPermissionsModuleImpl.checkNotifications(reactApplicationContext, promise)
  }

  override fun checkMultiple(permissions: ReadableArray, promise: Promise) {
    RNPermissionsModuleImpl.checkMultiple(reactApplicationContext, permissions, promise)
  }

  override fun request(permission: String, promise: Promise) {
    RNPermissionsModuleImpl.request(reactApplicationContext, this, callbacks, permission, promise)
  }

  override fun requestNotifications(options: ReadableArray, promise: Promise) {
    RNPermissionsModuleImpl.requestNotifications(reactApplicationContext, promise)
  }

  override fun requestMultiple(permissions: ReadableArray, promise: Promise) {
    RNPermissionsModuleImpl.requestMultiple(reactApplicationContext, this, callbacks, permissions, promise)
  }

  override fun shouldShowRequestRationale(permission: String, promise: Promise) {
    RNPermissionsModuleImpl.shouldShowRequestRationale(reactApplicationContext, permission, promise)
  }

  override fun checkLocationAccuracy(promise: Promise) {
    RNPermissionsModuleImpl.checkLocationAccuracy(promise)
  }

  override fun requestLocationAccuracy(purposeKey: String, promise: Promise) {
    RNPermissionsModuleImpl.requestLocationAccuracy(promise)
  }

  override fun openContactPicker(promise: Promise) {
    RNPermissionsModuleImpl.openContactPicker(promise)
  }

  override fun openPhotoPicker(promise: Promise) {
    RNPermissionsModuleImpl.openPhotoPicker(promise)
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray): Boolean {
    return RNPermissionsModuleImpl.onRequestPermissionsResult(reactApplicationContext, callbacks, requestCode, grantResults)
  }
}

```

### Core Architecture Module: `android/src/oldarch/com/zoontek/rnpermissions/RNPermissionsModule.kt`
```
package com.zoontek.rnpermissions

import android.util.SparseArray

import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.PermissionListener

@ReactModule(name = RNPermissionsModuleImpl.NAME)
class RNPermissionsModule(reactContext: ReactApplicationContext?) :
  ReactContextBaseJavaModule(reactContext), PermissionListener {

  private val callbacks = SparseArray<Callback>()

  override fun getName(): String {
    return RNPermissionsModuleImpl.NAME
  }

  @ReactMethod
  fun openSettings(type: String?, promise: Promise) {
    RNPermissionsModuleImpl.openSettings(reactApplicationContext, type, promise)
  }

  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    RNPermissionsModuleImpl.canScheduleExactAlarms(reactApplicationContext, promise)
  }

  @ReactMethod
  fun canUseFullScreenIntent(promise: Promise) {
    RNPermissionsModuleImpl.canUseFullScreenIntent(reactApplicationContext, promise)
  }

  @ReactMethod
  fun check(permission: String, promise: Promise) {
    RNPermissionsModuleImpl.check(reactApplicationContext, permission, promise)
  }

  @ReactMethod
  fun checkNotifications(promise: Promise) {
    RNPermissionsModuleImpl.checkNotifications(reactApplicationContext, promise)
  }

  @ReactMethod
  fun checkMultiple(permissions: ReadableArray, promise: Promise) {
    RNPermissionsModuleImpl.checkMultiple(reactApplicationContext, permissions, promise)
  }

  @ReactMethod
  fun request(permission: String, promise: Promise) {
    RNPermissionsModuleImpl.request(reactApplicationContext, this, callbacks, permission, promise)
  }

  @ReactMethod
  fun requestNotifications(options: ReadableArray, promise: Promise) {
    RNPermissionsModuleImpl.requestNotifications(reactApplicationContext, promise)
  }

  @ReactMethod
  fun requestMultiple(permissions: ReadableArray, promise: Promise) {
    RNPermissionsModuleImpl.requestMultiple(reactApplicationContext, this, callbacks, permissions, promise)
  }

  @ReactMethod
  fun shouldShowRequestRationale(permission: String, promise: Promise) {
    RNPermissionsModuleImpl.shouldShowRequestRationale(reactApplicationContext, permission, promise)
  }

  @ReactMethod
  fun checkLocationAccuracy(promise: Promise) {
    RNPermissionsModuleImpl.checkLocationAccuracy(promise)
  }

  @ReactMethod
  fun requestLocationAccuracy(purposeKey: String, promise: Promise) {
    RNPermissionsModuleImpl.requestLocationAccuracy(promise)
  }

  @ReactMethod
  fun openContactPicker(promise: Promise) {
    RNPermissionsModuleImpl.openContactPicker(promise)
  }

  @ReactMethod
  fun openPhotoPicker(promise: Promise) {
    RNPermissionsModuleImpl.openPhotoPicker(promise)
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray): Boolean {
    return RNPermissionsModuleImpl.onRequestPermissionsResult(reactApplicationContext, callbacks, requestCode, grantResults)
  }
}

```

### Core Architecture Module: `app.plugin.js`
```
const {withPermissions} = require('./dist/commonjs/extras/expo');
module.exports = withPermissions;

```

### Core Architecture Module: `example/android/app/src/main/java/com/rnpermissionsexample/MainActivity.kt`
```
package com.rnpermissionsexample

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "RNPermissionsExample"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

```

### Core Architecture Module: `example/android/app/src/main/java/com/rnpermissionsexample/MainApplication.kt`
```
package com.rnpermissionsexample

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}

```

### Core Architecture Module: `example/babel.config.js`
```
const path = require('path');
const pkg = require('../package.json');

const resolverConfig = {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  alias: {[pkg.name]: path.resolve(__dirname, '../src')},
};

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [['module-resolver', resolverConfig]],
};

```

### Core Architecture Module: `example/index.js`
```
import {AppRegistry} from 'react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import {name as appName} from './app.json';
import {App} from './src/App';

let Main = () => (
  <PaperProvider>
    <App />
  </PaperProvider>
);

AppRegistry.registerComponent(appName, () => Main);

```

### Core Architecture Module: `example/ios/RNPermissionsExample/AppDelegate.swift`
```
import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "RNPermissionsExample",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

```

### Core Architecture Module: `example/metro.config.js`
```
const path = require('path');
const pkg = require('../package.json');

const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const escape = require('escape-string-regexp');

const peerDependencies = Object.keys(pkg.peerDependencies);
const root = path.resolve(__dirname, '..');
const projectNodeModules = path.join(__dirname, 'node_modules');
const rootNodeModules = path.join(root, 'node_modules');

// We need to make sure that only one version is loaded for peerDependencies
// So we block them at the root, and alias them to the versions in example's node_modules
const blockList = peerDependencies.map(
  (name) => new RegExp(`^${escape(path.join(rootNodeModules, name))}\\/.*$`),
);

const extraNodeModules = peerDependencies.reduce((acc, name) => {
  return {...acc, [name]: path.join(projectNodeModules, name)};
}, {});

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  projectRoot: __dirname,
  watchFolders: [root],
  resolver: {blockList, extraNodeModules},
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #984** (2026-06-09): **Check(IOS.LOCATION_ALWAYS) returns "blocked" instead of denied when IOS.LOCATION_WHEN_IN_USE is "granted"**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  When asking somewhere in your app for the `PERMISSIONS.IOS.LOCATION_WHEN_IN_USE` and if the user selects "Allow while in use", afterwards every check on `PERMISSIONS.IOS.LOCATION_ALWAYS` will resolve to "blocked". However we are STILL able to request for `PERMISSIONS.IOS.LOCATION_ALWAYS` and it then resolves properly to "granted".  The issue being that in our case, it makes the app displays an "error" state because the check wrongly displays the permission as blocked. Especially, when needing only WHEN_IN_USE in some part of our app and want to ask for ALWAYS later, we wrongly believe that the permission is not requestable.  Similar to fixed #924 but the workaround is not working because the issue is in the check() function.  ### Library version  5.5.2  ### Environment info  ```shell expo 54.0.34 react-native 0.81.5 ```  ### Steps to reproduce  1. Request PERMISSIONS.IOS.LOCATION_WHEN_IN_USE permission, grant the permission. 2. Check PERMISSIONS.IOS.LOCATION_ALWAYS (3. Request PERMISSIONS.IOS.LOCATION_ALWAYS)   ### Reproducible sample code  ```js const whenInUse = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE); // Accept from U
  **Post-Mortem & Fix Analysis**:
  > Fixed in [5.5.3](https://github.com/zoontek/react-native-permissions/releases/tag/5.5.3). Note that as the fix uses `flagAsRequested`, the "always" permission needs to be requested first for `check` to return `blocked`
  > Wow thank you for this super fast fix!

- **Issue #983** (2026-04-23): **Issue: checkNotifications() returns denied on iOS simulator even on fresh install (no prompt shown)**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  Description  On iOS simulator, checkNotifications() from react-native-permissions always returns RESULTS.DENIED, even on a fresh install where the notification permission has never been requested.  Additionally:  The system permission prompt is not shown The app does not appear in iOS Settings → Notifications Resetting simulator / uninstalling app does not fix the state Environment Library: react-native-permissions (latest) Platform: iOS Simulator  Workaround  Currently evaluating switching to Firebase Messaging permission APIs (messaging().requestPermission()) for more reliable behavior.  ### Library version  5.5.1  ### Environment info  ```shell System:   OS: macOS 15.1.1   CPU: (8) arm64 Apple M2   Memory: 176.48 MB / 8.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 22.12.0     path: /Users/amals/.nvm/versions/node/v22.12.0/bin/node   Yarn:     version: 1.22.22     path: /Users/amals/.nvm/versions/node/v22.12.0/bin/yarn   npm:     version: 10.9.0     path: /Users/amals/.nvm/versions/node/v22.12.0/bin/npm   Watchman:     version: 2024.12.02.00     path: /opt/homebrew/bin/watchman Managers:   Co
  **Post-Mortem & Fix Analysis**:
  > Documentation: https://github.com/zoontek/react-native-permissions#understanding-permission-flow

- **Issue #980** (2026-04-08): **[iOS] check(PERMISSIONS.IOS.FACE_ID) always returns denied even if it is granted when requested with another library**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  **This happens on iOS** I'm using a library to handle the biometrics `@sbaiahmed1/react-native-biometrics` I use it to request the faceID permission and to authenticate the user  I have a case where I need to know if the permission prompt was shown to the user before or not the library doesn't provide this info, so I used `react-native-permissions` library to check on the permission status   ## Having two scenarios:  **1. Permission is granted:** Steps: 1. Request permission using `@sbaiahmed1/react-native-biometrics` library then grant permission 2. Log the result of `check(PERMISSIONS.IOS.FACE_ID)`  Expected: It should log `granted`  Actual: It logs `denied`, even if in the app device settings the faceID permission toggle is on   **2. Permission is denied:** Steps: 1. Request permission using `@sbaiahmed1/react-native-biometrics` library then reject permission 2. Log the result of `check(PERMISSIONS.IOS.FACE_ID)`  Expected: It should log `blocked`  Actual: It logs `blocked`  <br/>  ## Conclusion: Scenario 1 is not working as expected ❌ Scenario 2 is working as expected ✅  My issue: Why is it does not reflect the correct status whe
  **Post-Mortem & Fix Analysis**:
  > @DaliaElhefny This is a platform limitation for Face ID: this permission cannot be requested natively (and that's probably why `@sbaiahmed1/react-native-biometrics` don't give you a function for that), so the trick this library achieve is to request a Face ID prompt and cancel it immediately to only show the permissions request modal (when calling `request`).  Once it's done, it's flagged as ["requested once"](https://github.com/zoontek/react-native-permissions/blob/b18d7cc85c97f618de84ca7472b30f46c6eaa82f/ios/FaceID/RNPermissionHandlerFaceID.mm#L103). This requested status is [used in check](https://github.com/zoontek/react-native-permissions/blob/b18d7cc85c97f618de84ca7472b30f46c6eaa82f/ios/FaceID/RNPermissionHandlerFaceID.mm#L45).  If another library perform the permission request, `check` can't know that it has been requested once since nothing has been written in the app storage. So there's no way to properly fix this.

- **Issue #979** (2026-03-25): **v5.5.0 (and v5.5.1) breaks projects not using `bundler` module resolution**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  5.5.0 added an "exports" map with separate ESM/CJS entry points as well as emitting a `package.json` file to the folders in dist with either `{"type":"commonjs"}` or `{"type":"module"}` respectively.  This means that if the consumer is using `"type": "module"` the files are now resolved in an ESM context where extensionless relative imports aren't allowed , unless `"moduleResolution": "bundler"` (or a legacy setting that ignores the `exports` map completely) is used in the tsconfig. The emitted code (in dist) however includes a lot of extensionless relative imports in both the .js and .d.ts files, meaning it breaks.  ### Library version  5.1.1  ### Environment info  ```shell Irrelevant ```  ### Steps to reproduce  I've added a minimal, reproducible example here: https://github.com/monholm/rnp-repro with simple steps to reproduce in the readme.  I'm aware that all projects that are making use of react-native-permissions will eventually end up being bundled with metro (and because of that could/should make use of `"moduleResolution": "bundler"` in tsconfig.json), so I understand if this is a use case that you don't wanna support. I'm 
  **Post-Mortem & Fix Analysis**:
  > @monholm This is a tough issue, as I would gladly add file extensions everywhere, but metro is not able to pick the correct `.(android|ios|windows).js` file when doing so, breaking the current codebase.  - `require("./methods")` ➡ require `methods.ios.js` on iOS - `require("./methods.js")` ➡ require `methods.js` on all platforms  For libraries to be able to properly support ESM, metro should be updated to fix this issue (`require("./methods.js")` ➡ require `methods.ios.js` on iOS)
  > @zoontek Thanks for the quick response - I've run into the same platform-specific resolution myself, so I completely understand.  As mentioned in the issue description, I fully understand if this isn't something you want to address on your end. The main reason for filing this was awareness, since the change in 5.5.0 can be a bit surprising for consumers that aren't using "moduleResolution": "bundler".  If you think it's worth it, a small note in the 5.5.0 release notes mentioning that consumers may need "moduleResolution": "bundler" in their tsconfig could help others avoid the same confusion - but I'll leave that entirely up to you.  Thanks for maintaining the library!
  > @monholm You right, I added a note: https://github.com/zoontek/react-native-permissions/releases/tag/5.5.0

- **Issue #977** (2026-03-04): **PERMISSIONS in react-native-permissions/mock is double-nested in v5.5.0**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  ### Description  The `PERMISSIONS` export from `react-native-permissions/mock` has an incorrect structure in v5.5.0. Accessing `PERMISSIONS.ANDROID.CAMERA` (or any permission key) returns `undefined`, breaking any test that relies on permission constants.  ### Root cause  In `src/extras/mock.ts`, the permissions are composed as:  ```ts import {PERMISSIONS as PERMISSIONS_ANDROID} from '../permissions.android'; // PERMISSIONS_ANDROID = { ANDROID: { CAMERA: '...', ... }, IOS: proxy, WINDOWS: proxy }  const PERMISSIONS = {   ANDROID: PERMISSIONS_ANDROID,   // ❌ should be PERMISSIONS_ANDROID.ANDROID   IOS: PERMISSIONS_IOS,           // ❌ should be PERMISSIONS_IOS.IOS   WINDOWS: PERMISSIONS_WINDOWS,   // ❌ should be PERMISSIONS_WINDOWS.WINDOWS }; ```  Each platform file exports the full cross-platform `PERMISSIONS` object (not just its own keys), so `PERMISSIONS.ANDROID` ends up being `{ ANDROID: {...}, IOS: proxy, WINDOWS: proxy }` instead of the flat `{ CAMERA: 'android.permission.CAMERA', ... }`.  ### Fix  ```ts const PERMISSIONS = {   ANDROID: PERMISSIONS_ANDROID.ANDROID,   IOS: PERMISSIONS_IOS.IOS,   WINDOWS: PERMISSIONS_WINDOWS.WIND
  **Post-Mortem & Fix Analysis**:
  > @rarenatoe This is fixed in [v5.5.1](https://github.com/zoontek/react-native-permissions/releases/tag/5.5.1)

- **Issue #976** (2026-02-23): **`requestMultiple` returns incorrect `BLOCKED` status due to permission result index mismatch**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  # Bug: `READ_MEDIA_IMAGES` returns `BLOCKED` immediately after user grants permission  ## Summary  `READ_MEDIA_IMAGES` permission returns `BLOCKED` immediately after user grants it in the permission dialog, while `READ_MEDIA_VIDEO` and other permissions work correctly. This happens consistently on Android 13+ devices (API 33+).  ## Library version  5.4.4  ## Environment info  ``` Library Version: 5.4.2+ React Native: 0.82.1 Android Target SDK: 36 Android Min SDK: 24 Test Device: Physical Android device (API 33) ```  ## Steps to Reproduce  1. Fresh app install on Android 13+ device (API 33+) 2. Call `request()` or `requestMultiple()` with `READ_MEDIA_IMAGES` 3. Grant the permission when prompted (tap "Allow" or "Allow all") 4. Observe the result - `READ_MEDIA_IMAGES` returns `BLOCKED` 5. Check Android Settings → Apps → [Your App] → Permissions → Shows "Allowed"  ## Expected Behavior  All permissions should return `GRANTED` after user approval:  ``` ACCESS_FINE_LOCATION: granted ✅ READ_MEDIA_IMAGES: granted ✅ (EXPECTED) READ_MEDIA_VIDEO: granted ✅ CAMERA: granted ✅ ```  ## Actual Behavior  Only `READ_MEDIA_IMAGES` incorrectly returns 
  **Post-Mortem & Fix Analysis**:
  > @sahildocgrow Hi 👋 I tried to understand your AI slop, but not sure I got it.  > ## Steps to Reproduce >  > 1. Fresh app install on Android 13+ device (API 33+) > 2. Call `request()` or `requestMultiple()` with `READ_MEDIA_IMAGES` > 3. Grant the permission when prompted (tap "Allow" or "Allow all") > 4. Observe the result - `READ_MEDIA_IMAGES` returns `BLOCKED` > 5. Check Android Settings → Apps → [Your App] → Permissions → Shows "Allowed"  Let's try with a minimal amount of code:  ```ts import {Button, PermissionsAndroid, View} from 'react-native'; import {check, PERMISSIONS, request} from 'react-native-permissions';  export const App = () => (   <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>     <Button       title="Try to reproduce"       onPress={async () => {         console.log('request', await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES));         console.log('check', await check(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES));          console.log(         

- **Issue #975** (2026-02-23): **Bug: requestMultiple intermittently does not return callback after repeated calls (Android)**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  We are observing inconsistent callback behavior when calling requestMultiple multiple times on Android. After a few repeated button presses, the permission request neither shows a system dialog nor returns a callback, making the app appear stuck.  Observed sequence when pressing the same button multiple times:  - 1st press → Permission dialog shown → callback received - 2nd press → Permission dialog shown → callback received - 3rd press → ❌ No dialog, no callback - 4th press → Callback received - 5th+ press → Callback received  On the 3rd attempt, the promise neither resolves nor rejects.  ### Library version  5.4.4  ### Environment info  ```shell prod, dev ```  ### Steps to reproduce  **STR (Steps to Reproduce)**  Add a button that triggers requestMultiple(...) Press the same button multiple times sequentially  **Observed sequence:**  1st press → Permission dialog shown → callback received 2nd press → Permission dialog shown → callback received 3rd press → ❌ No dialog, no callback 4th press → Callback received 5th+ press → Callback received  On the 3rd attempt, the promise neither resolves nor rejects.  ### Reproducible sample code
  **Post-Mortem & Fix Analysis**:
  > @amitkumar-source Looks like a duplicate of #966 to me, can you confirm?
  > @zoontek no, it's different; I can face this in all android versions
  > @amitkumar-source Could you provide a proper reproduction?

- **Issue #974** (2026-01-16): **openSettings doesn't open the App Settings page on iOS**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  I try to open the App settings by using openSettings on iOS, but I can't access the app specific settings using this method.  On iOS 26.2 simulator: lands on the root page of the Settings app On iOS 18.6 simulator: lands on the list of Apps under Settings/Apps, but not directly under my specific app (which is in the list)  Looking at the simulator logs, it looks like iOS is not handling the app settings the same way between these 2 versions, but still, it doesn't really work on both OS versions, as I expect to be redirected to my app settings and not at any root level.  Have you already experienced this issue ? Is it related to the simulator (I don't have a physical device to test unfortunately) ?  ### Library version  5.4.4  ### Environment info  ```shell System:   OS: macOS 26.2   CPU: (14) arm64 Apple M4 Pro   Memory: 166.20 MB / 48.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 24.12.0     path: /private/var/folders/sr/t1yqhl_x2zbfqn7zdpvym9gr0000gn/T/xfs-44fe4f97/node   Yarn:     version: 4.12.0     path: /private/var/folders/sr/t1yqhl_x2zbfqn7zdpvym9gr0000gn/T/xfs-44fe4f97/yarn   npm:     v
  **Post-Mortem & Fix Analysis**:
  > It only happens in simulators (and cannot be fixed), not on physical devices.

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

### Incident Patch 1: `52096076` (2026-09-14)
**Commit Message**: fix(android): skip explicit Kotlin plugin when AGP registers the kotlin extension (#987)

* fix(android): skip explicit Kotlin plugin when AGP provides built-in Kotlin

AGP 9 enables built-in Kotlin by default and applies the Kotlin plugin
itself. Applying it again fails configuration with "Cannot add extension
with name 'kotlin'". Guard the explicit apply so it only runs when AGP is
not providing Kotlin: AGP 8 and older, or AGP 9 with
android.builtInKotlin=false. AGP 10 removes that opt-out, so built-in
Kotlin is always active there and the explicit apply must never run.

* fix(android): check the kotlin extension instead of the AGP version

Replace the AGP version / android.builtInKotlin check with a direct test for
the registered kotlin extension. The version check reads
com.android.Version.ANDROID_GRADLE_PLUGIN_VERSION, which can resolve to a
different classpath entry than the AGP actually in use, and the global
android.builtInKotlin property can be overridden per module by the
com.android.built-in-kotlin plugin -- so both inputs can disagree with
reality. Asking whether the kotlin extension exists tests the condition that
actually fails, needs no AGP version table, and covers 

**File**: `android/build.gradle` (modified, +9/-1)
```diff
@@ -17,7 +17,15 @@ def isNewArchitectureEnabled() {
 }
 
 apply plugin: "com.android.library"
-apply plugin: "kotlin-android"
+// AGP 9 ships built-in Kotlin support and registers the `kotlin` extension
+// itself. Applying the Kotlin plugin on top of it fails configuration with
+// "Cannot add extension with name 'kotlin'". Asking for the extension covers
+// every way built-in Kotlin can be turned on -- the global default, the
+// android.builtInKotlin property, and the per-module com.android.built-in-kotlin
+// plugin -- without reading an AGP version number.
+if (project.extensions.findByName('kotlin') == null) {
+    apply plugin: "kotlin-android"
+}
 
 if (isNewArchitectureEnabled()) {
     apply plugin: "com.facebook.react"
```

---

### Incident Patch 2: `d9199905` (2026-07-23)
**Commit Message**: Fix stale iOS calendar/reminders status by reusing a single EKEventStore

**File**: `example/ios/Podfile.lock` (modified, +2/-2)
```diff
@@ -1892,7 +1892,7 @@ PODS:
     - React-utils (= 0.86.0)
     - ReactNativeDependencies
   - ReactNativeDependencies (0.86.0)
-  - RNPermissions (5.6.0):
+  - RNPermissions (5.6.1):
     - hermes-engine
     - RCTRequired
     - RCTTypeSafety
@@ -2254,7 +2254,7 @@ SPEC CHECKSUMS:
   ReactCodegen: afe0d436ee089d7bea6418429d8312b1d23a6801
   ReactCommon: d5c1bb4427bf51c443de5926aac332c89ddd9363
   ReactNativeDependencies: fa0a54b3f5319ae0e3b9aff32bfee7a424b88e66
-  RNPermissions: 5c723d3888b93d7d011394887b422e1fd298bcd8
+  RNPermissions: b08eeae169b509e1eff3647da636b7f12d8c9855
   RNVectorIcons: 97f26211c07d69e45b189f9dd0dbbe5e2d2b0b92
   Yoga: fe50ab299e578f397fef753cf309c6703a4db29b
 
```

**File**: `ios/Calendars/RNPermissionHandlerCalendars.mm` (modified, +6/-1)
```diff
@@ -62,7 +62,12 @@ - (void)requestWithResolver:(void (^ _Nonnull)(RNPermissionStatus))resolve
     }
   };
 
-  EKEventStore *store = [EKEventStore new];
+  static EKEventStore *store = nil;
+  static dispatch_once_t onceToken;
+
+  dispatch_once(&onceToken, ^{
+    store = [EKEventStore new];
+  });
 
   if (@available(iOS 17.0, *)) {
     [store requestFullAccessToEventsWithCompletion:completion];
```

**File**: `ios/CalendarsWriteOnly/RNPermissionHandlerCalendarsWriteOnly.mm` (modified, +6/-1)
```diff
@@ -45,7 +45,12 @@ - (void)requestWithResolver:(void (^ _Nonnull)(RNPermissionStatus))resolve
     }
   };
 
-  EKEventStore *store = [EKEventStore new];
+  static EKEventStore *store = nil;
+  static dispatch_once_t onceToken;
+
+  dispatch_once(&onceToken, ^{
+    store = [EKEventStore new];
+  });
 
   if (@available(iOS 17.0, *)) {
     [store requestWriteOnlyAccessToEventsWithCompletion:completion];
```

**File**: `ios/Reminders/RNPermissionHandlerReminders.mm` (modified, +6/-1)
```diff
@@ -45,7 +45,12 @@ - (void)requestWithResolver:(void (^ _Nonnull)(RNPermissionStatus))resolve
     }
   };
 
-  EKEventStore *store = [EKEventStore new];
+  static EKEventStore *store = nil;
+  static dispatch_once_t onceToken;
+
+  dispatch_once(&onceToken, ^{
+    store = [EKEventStore new];
+  });
 
   if (@available(iOS 17.0, *)) {
     [store requestFullAccessToRemindersWithCompletion:completion];
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-permissions",
-  "version": "5.6.0",
+  "version": "5.6.1",
   "license": "MIT",
   "description": "An unified permissions API for React Native on iOS, Android and Windows",
   "author": "Mathieu Acthernoene <zoontek@gmail.com>",
```

---

### Incident Patch 3: `98cab0dc` (2026-06-16)
**Commit Message**: Fix errors messages

**File**: `ios/Contacts/RNPermissionsContactPicker.swift` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@ public class RNPermissionsContactPicker: NSObject {
 
     controller.modalPresentationStyle = .overFullScreen
     controller.view.backgroundColor = .clear
+
     host = controller
 
     viewController.present(controller, animated: false)
```

**File**: `ios/RNPermissions.mm` (modified, +6/-6)
```diff
@@ -382,7 +382,7 @@ + (bool)isFlaggedAsRequested:(NSString * _Nonnull)handlerId {
     [self unlockHandler:lockId];
   }];
 #else
-  reject(@"notifications_pod_missing", @"Notifications permission pod is missing", nil);
+  reject(@"notifications_handler_not_set_up", @"Notifications permission handler is not set up", nil);
 #endif
 }
 
@@ -403,7 +403,7 @@ + (bool)isFlaggedAsRequested:(NSString * _Nonnull)handlerId {
     [self unlockHandler:lockId];
   }];
 #else
-  reject(@"notifications_pod_missing", @"Notifications permission pod is missing", nil);
+  reject(@"notifications_handler_not_set_up", @"Notifications permission handler is not set up", nil);
 #endif
 }
 
@@ -413,7 +413,7 @@ + (bool)isFlaggedAsRequested:(NSString * _Nonnull)handlerId {
   RNPermissionHandlerContacts *handler = [RNPermissionHandlerContacts new];
   [handler openContactPickerWithResolver:resolve rejecter:reject];
 #else
-  reject(@"contacts_pod_missing", @"Contacts permission pod is missing", nil);
+  reject(@"contacts_handler_not_set_up", @"Contacts permission handler is not set up", nil);
 #endif
 }
 
@@ -423,7 +423,7 @@ + (bool)isFlaggedAsRequested:(NSString * _Nonnull)handlerId {
   RNPermissionHandlerPhotoLibrary *handler = [RNPermissionHandlerPhotoLibrary new];
   [handler openPhotoPickerWithResolver:resolve rejecter:reject];
 #else
-  reject(@"photo_library_pod_missing", @"PhotoLibrary permission pod is missing", nil);
+  reject(@"photo_library_handler_not_set_up", @"PhotoLibrary permission handler is not set up", nil);
 #endif
 }
 
@@ -435,7 +435,7 @@ + (bool)isFlaggedAsRequested:(NSString * _Nonnull)handlerId {
   RNPermissionHandlerLocationAccuracy *handler = [RNPermissionHandlerLocationAccuracy new];
   [handler checkWithResolver:resolve rejecter:reject];
 #else
-  reject(@"location_accuracy_pod_missing", @"LocationAccuracy permission pod is missing", nil);
+  reject(@"location_accuracy_handler_not_set_up", @"LocationAccuracy permission handler is not set up", nil);
 #endif
 }
 
@@ -448,7 +448,7 @@ + (bool)isFlaggedAsRequested:(NSString * _Nonnull)handlerId {
   RNPermissionHandlerLocationAccuracy *handler = [RNPermissionHandlerLocationAccuracy new];
   [handler requestWithPurposeKey:purposeKey resolver:resolve rejecter:reject];
 #else
-  reject(@"location_accuracy_pod_missing", @"LocationAccuracy permission pod is missing", nil);
+  reject(@"location_accuracy_handler_not_set_up", @"LocationAccuracy permission handler is not set up", nil);
 #endif
 }
 
```

---

### Incident Patch 4: `c6d94391` (2026-06-09)
**Commit Message**: Fix #984

**File**: `ios/LocationAlways/RNPermissionHandlerLocationAlways.mm` (modified, +3/-0)
```diff
@@ -35,6 +35,7 @@ - (RNPermissionStatus)convertStatus:(CLAuthorizationStatus)status {
     case kCLAuthorizationStatusRestricted:
       return RNPermissionStatusRestricted;
     case kCLAuthorizationStatusAuthorizedWhenInUse:
+      return [RNPermissions isFlaggedAsRequested:[[self class] handlerUniqueId]] ? RNPermissionStatusDenied : RNPermissionStatusNotDetermined;
     case kCLAuthorizationStatusDenied:
       return RNPermissionStatusDenied;
     case kCLAuthorizationStatusAuthorizedAlways:
@@ -138,6 +139,8 @@ - (void)resolveStatus {
     [_locationManager setDelegate:nil];
     _locationManager = nil;
 
+    [RNPermissions flagAsRequested:[[self class] handlerUniqueId]];
+
     _resolve([self convertStatus:status]);
     _resolve = nil;
   }
```

---

### Incident Patch 5: `4691a9a8` (2026-05-28)
**Commit Message**: Fix #885

**File**: `ios/RNPermissions.mm` (modified, +12/-7)
```diff
@@ -279,19 +279,24 @@ - (NSString *)stringForStatus:(RNPermissionStatus)status {
 }
 
 - (NSString *)lockHandler:(id<RNPermissionHandler>)handler {
-  if (_handlers == nil) {
-    _handlers = [NSMutableDictionary new];
-  }
-
   NSString *lockId = [[NSUUID UUID] UUIDString];
-  [_handlers setObject:handler forKey:lockId];
+
+  @synchronized (self) {
+    if (_handlers == nil) {
+      _handlers = [NSMutableDictionary new];
+    }
+
+    [_handlers setObject:handler forKey:lockId];
+  }
 
   return lockId;
 }
 
 - (void)unlockHandler:(NSString * _Nonnull)lockId {
-  if (_handlers != nil) {
-    [_handlers removeObjectForKey:lockId];
+  @synchronized (self) {
+    if (_handlers != nil) {
+      [_handlers removeObjectForKey:lockId];
+    }
   }
 }
 
```

---

### Incident Patch 6: `36ce0d9a` (2026-04-08)
**Commit Message**: fix license link (#981)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 An unified permissions API for React Native on iOS, Android and Windows.<br>
 (For Windows only builds 18362 and later are supported)
 
-[![mit licence](https://img.shields.io/dub/l/vibe-d.svg?style=for-the-badge)](https://github.com/zoontek/react-native-permissions/blob/main/LICENSE)
+[![mit licence](https://img.shields.io/dub/l/vibe-d.svg?style=for-the-badge)](https://github.com/zoontek/react-native-permissions/blob/master/LICENSE)
 [![npm version](https://img.shields.io/npm/v/react-native-permissions?style=for-the-badge)](https://www.npmjs.org/package/react-native-permissions)
 [![npm downloads](https://img.shields.io/npm/dt/react-native-permissions.svg?label=downloads&style=for-the-badge)](https://www.npmjs.org/package/react-native-permissions)
 <br />
```

---

### Incident Patch 7: `0a640ae8` (2026-03-04)
**Commit Message**: Fix PERMISSIONS mock export

**File**: `src/extras/mock.ts` (modified, +6/-6)
```diff
@@ -5,13 +5,13 @@ import {PERMISSIONS as PERMISSIONS_WINDOWS} from '../permissions.windows';
 import {RESULTS} from '../results';
 import type {PermissionStatus} from '../types';
 
-const PERMISSIONS = {
-  ANDROID: PERMISSIONS_ANDROID,
-  IOS: PERMISSIONS_IOS,
-  WINDOWS: PERMISSIONS_WINDOWS,
-};
+export {RESULTS} from '../results';
 
-export {PERMISSIONS, RESULTS};
+export const PERMISSIONS = {
+  ANDROID: PERMISSIONS_ANDROID.ANDROID,
+  IOS: PERMISSIONS_IOS.IOS,
+  WINDOWS: PERMISSIONS_WINDOWS.WINDOWS,
+};
 
 export const canScheduleExactAlarms = jest.fn(async () => true);
 export const canUseFullScreenIntent = jest.fn(async () => true);
```

---

### Incident Patch 8: `4f059fe5` (2026-02-26)
**Commit Message**: Remove peerDeps versions requirement

**File**: `package.json` (modified, +3/-3)
```diff
@@ -107,9 +107,9 @@
     }
   },
   "peerDependencies": {
-    "react": ">=18.3.1",
-    "react-native": ">=0.76.0",
-    "react-native-windows": ">=0.76.0"
+    "react": "*",
+    "react-native": "*",
+    "react-native-windows": "*"
   },
   "peerDependenciesMeta": {
     "react-native-windows": {
```

---

### Incident Patch 9: `acd555eb` (2026-02-18)
**Commit Message**: Fix bundle issue

**File**: `example/Gemfile` (modified, +4/-0)
```diff
@@ -14,3 +14,7 @@ gem 'bigdecimal'
 gem 'logger'
 gem 'benchmark'
 gem 'mutex_m'
+
+# Fix https://github.com/CocoaPods/CocoaPods/issues/12805
+gem 'nkf'
+gem 'base64'
```

**File**: `example/Gemfile.lock` (modified, +16/-14)
```diff
@@ -1,11 +1,8 @@
 GEM
   remote: https://rubygems.org/
   specs:
-    CFPropertyList (3.0.7)
-      base64
-      nkf
-      rexml
-    activesupport (7.2.2.2)
+    CFPropertyList (3.0.8)
+    activesupport (7.2.3)
       base64
       benchmark (>= 0.3)
       bigdecimal
@@ -17,15 +14,15 @@ GEM
       minitest (>= 5.1)
       securerandom (>= 0.3)
       tzinfo (~> 2.0, >= 2.0.5)
-    addressable (2.8.7)
-      public_suffix (>= 2.0.2, < 7.0)
+    addressable (2.8.8)
+      public_suffix (>= 2.0.2, < 8.0)
     algoliasearch (1.27.5)
       httpclient (~> 2.8, >= 2.8.3)
       json (>= 1.5.1)
     atomos (0.1.3)
     base64 (0.3.0)
     benchmark (0.5.0)
-    bigdecimal (3.3.1)
+    bigdecimal (4.0.1)
     claide (1.1.0)
     cocoapods (1.15.2)
       addressable (~> 2.8)
@@ -66,28 +63,31 @@ GEM
     cocoapods-try (1.2.0)
     colored2 (3.1.2)
     concurrent-ruby (1.3.3)
-    connection_pool (2.5.4)
+    connection_pool (3.0.2)
     drb (2.2.3)
     escape (0.0.4)
-    ethon (0.17.0)
+    ethon (0.18.0)
       ffi (>= 1.15.0)
-    ffi (1.17.2)
+      logger
+    ffi (1.17.3)
     fourflusher (2.3.1)
     fuzzy_match (2.0.4)
     gh_inspector (1.1.3)
     httpclient (2.9.0)
       mutex_m
-    i18n (1.14.7)
+    i18n (1.14.8)
       concurrent-ruby (~> 1.0)
-    json (2.15.2)
+    json (2.18.1)
     logger (1.7.0)
-    minitest (5.26.0)
+    minitest (6.0.1)
+      prism (~> 1.5)
     molinillo (0.8.0)
     mutex_m (0.3.0)
     nanaimo (0.3.0)
     nap (1.1.0)
     netrc (0.11.0)
     nkf (0.2.0)
+    prism (1.9.0)
     public_suffix (4.0.7)
     rexml (3.4.4)
     ruby-macho (2.5.1)
@@ -109,12 +109,14 @@ PLATFORMS
 
 DEPENDENCIES
   activesupport (>= 6.1.7.5, != 7.1.0)
+  base64
   benchmark
   bigdecimal
   cocoapods (>= 1.13, != 1.15.1, != 1.15.0)
   concurrent-ruby (< 1.3.4)
   logger
   mutex_m
+  nkf
   xcodeproj (< 1.26.0)
 
 RUBY VERSION
```

---

### Incident Patch 10: `451385f7` (2025-10-31)
**Commit Message**: Fix #970

**File**: `RNPermissions.podspec` (modified, +2/-2)
```diff
@@ -17,8 +17,8 @@ Pod::Spec.new do |s|
   s.source           = { :git => package["repository"]["url"], :tag => s.version }
   s.resource_bundles = { 'RNPermissionsPrivacyInfo' => 'ios/PrivacyInfo.xcprivacy' }
 
-  s.source_files = "ios/*.{h,mm}", "ios/StoreKit/*.{h,mm}", "ios/FaceID/*.{h,mm}", "ios/Calendars/*.{h,mm}", "ios/LocationAlways/*.{h,mm}", "ios/PhotoLibraryAddOnly/*.{h,mm}", "ios/Microphone/*.{h,mm}", "ios/SpeechRecognition/*.{h,mm}", "ios/LocationWhenInUse/*.{h,mm}", "ios/PhotoLibrary/*.{h,mm}", "ios/Camera/*.{h,mm}", "ios/Contacts/*.{h,mm}", "ios/Motion/*.{h,mm}", "ios/CalendarsWriteOnly/*.{h,mm}", "ios/AppTrackingTransparency/*.{h,mm}", "ios/LocationAccuracy/*.{h,mm}", "ios/Bluetooth/*.{h,mm}", "ios/MediaLibrary/*.{h,mm}", "ios/Notifications/*.{h,mm}", "ios/Reminders/*.{h,mm}"
-  s.frameworks = "StoreKit", "LocalAuthentication", "EventKit", "CoreLocation", "Photos", "AVFoundation", "Speech", "PhotosUI", "Contacts", "CoreMotion", "AdSupport", "AppTrackingTransparency", "CoreBluetooth", "MediaPlayer", "UserNotifications"
+  s.source_files = "ios/*.{h,mm}"
+  # s.frameworks = <frameworks>
 
   if ENV['RCT_NEW_ARCH_ENABLED'] == "1" then
     install_modules_dependencies(s)
```

**File**: `example/ios/Podfile.lock` (modified, +2/-2)
```diff
@@ -2408,7 +2408,7 @@ PODS:
     - React-perflogger (= 0.82.1)
     - React-utils (= 0.82.1)
     - SocketRocket
-  - RNPermissions (5.4.3):
+  - RNPermissions (5.4.4):
     - boost
     - DoubleConversion
     - fast_float
@@ -2780,7 +2780,7 @@ SPEC CHECKSUMS:
   ReactAppDependencyProvider: a45ef34bb22dc1c9b2ac1f74167d9a28af961176
   ReactCodegen: 878add6c7d8ff8cea87697c44d29c03b79b6f2d9
   ReactCommon: 804dc80944fa90b86800b43c871742ec005ca424
-  RNPermissions: f6b3e41e29e5c4994cc90257c3093ae6fdcb1f98
+  RNPermissions: f490a4e2576c03ee18d853d62faeb6514a72f2c7
   RNVectorIcons: 791f13226ec4a3fd13062eda9e892159f0981fae
   SocketRocket: d4aabe649be1e368d1318fdf28a022d714d65748
   Yoga: 689c8e04277f3ad631e60fe2a08e41d411daf8eb
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-permissions",
-  "version": "5.4.3",
+  "version": "5.4.4",
   "license": "MIT",
   "description": "An unified permissions API for React Native on iOS, Android and Windows",
   "author": "Mathieu Acthernoene <zoontek@gmail.com>",
```

---

### Incident Patch 11: `a0d78900` (2025-10-28)
**Commit Message**: Fix android build issue

react-native-windows dependencies are lagging behind

**File**: `example/package.json` (modified, +1/-2)
```diff
@@ -24,8 +24,7 @@
     "react-native-paper": "^5.14.5",
     "react-native-permissions": "link:../",
     "react-native-safe-area-context": "^5.6.1",
-    "react-native-vector-icons": "^10.3.0",
-    "react-native-windows": "0.79.4"
+    "react-native-vector-icons": "^10.3.0"
   },
   "devDependencies": {
     "@babel/core": "^7.25.2",
```

**File**: `example/yarn.lock` (modified, +23/-1232)
```diff
@@ -957,7 +957,7 @@
     "@babel/types" "^7.4.4"
     esutils "^2.0.2"
 
-"@babel/runtime@^7.0.0", "@babel/runtime@^7.25.0":
+"@babel/runtime@^7.25.0":
   version "7.28.4"
   resolved "https://registry.yarnpkg.com/@babel/runtime/-/runtime-7.28.4.tgz#a70226016fabe25c5783b2f22d3e1c9bc5ca3326"
   integrity sha512-Q/N6JNWvIvPnLDvjlE1OUBLPQHH6l3CltCEsHIujp45zQUSSh8K+gHnaEX45yAT1nyngnINhvWtzN+Nb9D8RAQ==
@@ -1103,17 +1103,6 @@
     slash "^3.0.0"
     write-file-atomic "^4.0.2"
 
-"@jest/types@^26.6.2":
-  version "26.6.2"
-  resolved "https://registry.yarnpkg.com/@jest/types/-/types-26.6.2.tgz#bef5a532030e1d88a2f5a6d933f84e97226ed48e"
-  integrity sha512-fC6QCp7Sc5sX6g8Tvbmj4XUTbyrik0akgRy03yjXbQaBWWNWGE7SGtJk98m0N8nzegD/7SggrUlivxo5ax4KWQ==
-  dependencies:
-    "@types/istanbul-lib-coverage" "^2.0.0"
-    "@types/istanbul-reports" "^3.0.0"
-    "@types/node" "*"
-    "@types/yargs" "^15.0.0"
-    chalk "^4.0.0"
-
 "@jest/types@^29.6.3":
   version "29.6.3"
   resolved "https://registry.yarnpkg.com/@jest/types/-/types-29.6.3.tgz#1131f8cf634e7e84c5e77bab12f052af585fba59"
@@ -1168,64 +1157,6 @@
     "@jridgewell/resolve-uri" "^3.1.0"
     "@jridgewell/sourcemap-codec" "^1.4.14"
 
-"@microsoft/1ds-core-js@4.3.10", "@microsoft/1ds-core-js@^4.3.0":
-  version "4.3.10"
-  resolved "https://registry.yarnpkg.com/@microsoft/1ds-core-js/-/1ds-core-js-4.3.10.tgz#d8aeccd14a6a836106dbc487ee978b20f6193f00"
-  integrity sha512-5fSZmkGwWkH+mrIA5M1GYPZdPM+SjXwCCl2Am7VhFoVwOBJNhRnwvIpAdzw6sFjiebN/rz+/YH0NdxztGZSa9Q==
-  dependencies:
-    "@microsoft/applicationinsights-core-js" "3.3.10"
-    "@microsoft/applicationinsights-shims" "3.0.1"
-    "@microsoft/dynamicproto-js" "^2.0.3"
-    "@nevware21/ts-async" ">= 0.5.4 < 2.x"
-    "@nevware21/ts-utils" ">= 0.11.8 < 2.x"
-
-"@microsoft/1ds-post-js@^4.3.0":
-  version "4.3.10"
-  resolved "https://registry.yarnpkg.com/@microsoft/1ds-post-js/-/1ds-post-js-4.3.10.tgz#737730421a5aa1578c66b253225582baefc87cd3"
-  integrity sha512-VSLjc9cT+Y+eTiSfYltJHJCejn8oYr0E6Pq2BMhOEO7F6IyLGYIxzKKvo78ze9x+iHX7KPTATcZ+PFgjGXuNqg==
-  dependencies:
-    "@microsoft/1ds-core-js" "4.3.10"
-    "@microsoft/applicationinsights-shims" "3.0.1"
-    "@microsoft/dynamicproto-js" "^2.0.3"
-    "@nevware21/ts-async" ">= 0.5.4 < 2.x"
-    "@nevware21/ts-utils" ">= 0.11.8 < 2.x"
-
-"@microsoft/applicationinsights-core-js@3.3.10":
-  version "3.3.10"
-  resolved "https://registry.yarnpkg.com/@microsoft/applicationinsights-core-js/-/applicationinsights-core-js-3.3.10.tgz#a30ab61c1b33c82226479b9adfbaf3bc4c85cff9"
-  integrity sha512-5yKeyassZTq2l+SAO4npu6LPnbS++UD+M+Ghjm9uRzoBwD8tumFx0/F8AkSVqbniSREd+ztH/2q2foewa2RZyg==
-  dependencies:
-    "@microsoft/applicationinsights-shims" "3.0.1"
-    "@microsoft/dynamicproto-js" "^2.0.3"
-    "@nevware21/ts-async" ">= 0.5.4 < 2.x"
-    "@nevware21/ts-utils" ">= 0.11.8 < 2.x"
-
-"@microsoft/applicationinsights-shims@3.0.1":
-  version "3.0.1"
-  resolved "https://registry.yarnpkg.com/@microsoft/applicationinsights-shims/-/applicationinsights-shims-3.0.1.tgz#3865b73ace8405b9c4618cc5c571f2fe3876f06f"
-  integrity sha512-DKwboF47H1nb33rSUfjqI6ryX29v+2QWcTrRvcQDA32AZr5Ilkr7whOOSsD1aBzwqX0RJEIP1Z81jfE3NBm/Lg==
-  dependencies:
-    "@nevware21/ts-utils" ">= 0.9.4 < 2.x"
-
-"@microsoft/dynamicproto-js@^2.0.3":
-  version "2.0.3"
-  resolved "https://registry.yarnpkg.com/@microsoft/dynamicproto-js/-/dynamicproto-js-2.0.3.tgz#ae2b408061e3ff01a97078429fc768331e239256"
-  integrity sha512-JTWTU80rMy3mdxOjjpaiDQsTLZ6YSGGqsjURsY6AUQtIj0udlF/jYmhdLZu8693ZIC0T1IwYnFa0+QeiMnziBA==
-  dependencies:
-    "@nevware21/ts-utils" ">= 0.10.4 < 2.x"
-
-"@nevware21/ts-async@>= 0.5.4 < 2.x":
-  version "0.5.4"
-  resolved "https://registry.yarnpkg.com/@nevware21/ts-async/-/ts-async-0.5.4.tgz#52f8449dd0b3b16aa317a18b4662f6fb13a135f1"
-  integrity sha512-IBTyj29GwGlxfzXw2NPnzty+w0Adx61Eze1/lknH/XIVdxtF9UnOpk76tnrHXWa6j84a1RR9hsOcHQPFv9qJjA==
-  dependencies:
-    "@nevware21/ts-utils" ">= 0.11.6 < 2.x"
-
-"@nevware21/ts-utils@>= 0.10.4 < 2.x", "@nevware21/ts-utils@>= 0.11.6 < 2.x", "@nevware21/ts-utils@>= 0.11.8 < 2.x", "@nevware21/ts-utils@>= 0.9.4 < 2.x":
-  version "0.12.5"
-  resolved "https://registry.yarnpkg.com/@nevware21/ts-utils/-/ts-utils-0.12.5.tgz#fe33c10d11ae8b724ccaaa31d2d0109d18601da6"
-  integrity sha512-JPQZWPKQJjj7kAftdEZL0XDFfbMgXCGiUAZe0d7EhLC3QlXTlZdSckGqqRIQ2QNl0VTEZyZUvRBw6Ednw089Fw==
-
 "@nodelib/fs.scandir@2.1.5":
   version "2.1.5"
   resolved "https://registry.yarnpkg.com/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz#7619c2eb21b25483f6d167548b4cfd5a7488c3d5"
@@ -1247,16 +1178,6 @@
     "@nodelib/fs.scandir" "2.1.5"
     fastq "^1.6.0"
 
-"@react-native-community/cli-clean@15.1.3":
-  version "15.1.3"
-  resolved "https://registry.yarnpkg.com/@react-native-community/cli-clean/-/cli-clean-15.1.3.tgz#cc177378d9c903737fbc1f22d7aa712a61d562be"
-  integrity sha512-3s9NGapIkONFoCUN2s77NYI987GPSCdr74rTf0TWyGIDf4vTYgKoWKKR+Ml3VTa1BCj51r4cYuHEKE1pjUSc0w==
-  dependencies:
-    "@react-nat
```

**File**: `package.json` (modified, +0/-1)
```diff
@@ -84,7 +84,6 @@
     "react": "19.1.1",
     "react-native": "0.82.1",
     "react-native-builder-bob": "^0.40.14",
-    "react-native-windows": "0.79.4",
     "typescript": "^5.9.3"
   },
   "react-native-windows": {
```

---

### Incident Patch 12: `fae0b42e` (2025-07-22)
**Commit Message**: Fix isPermissionAvailable

**File**: `android/src/main/java/com/zoontek/rnpermissions/RNPermissionsModuleImpl.kt` (modified, +2/-1)
```diff
@@ -56,7 +56,8 @@ object RNPermissionsModuleImpl {
   )
 
   private fun isPermissionAvailable(permission: String): Boolean =
-    Build.VERSION.SDK_INT >= (minimumApi[permission] ?: Build.VERSION_CODES.BASE)
+    (permission.startsWith("android.") || permission.startsWith("com.android")) &&
+      Build.VERSION.SDK_INT >= (minimumApi[permission] ?: Build.VERSION_CODES.BASE)
 
   fun openSettings(reactContext: ReactApplicationContext, type: String?, promise: Promise) {
     try {
```

---

### Incident Patch 13: `1a93a670` (2025-01-21)
**Commit Message**: check permission for null values to fix build issues in RN 0.77 (#922)

**File**: `android/src/main/java/com/zoontek/rnpermissions/RNPermissionsModuleImpl.kt` (modified, +6/-2)
```diff
@@ -128,7 +128,9 @@ object RNPermissionsModuleImpl {
 
     for (i in 0 until permissions.size()) {
       val permission = permissions.getString(i)
-
+      if (permission.isNullOrBlank()) {
+        continue;
+      }
       output.putString(
         permission,
         when {
@@ -210,7 +212,9 @@ object RNPermissionsModuleImpl {
 
     for (i in 0 until permissions.size()) {
       val permission = permissions.getString(i)
-
+      if (permission.isNullOrBlank()) {
+        continue;
+      }
       if (!isPermissionAvailable(permission)) {
         output.putString(permission, UNAVAILABLE)
         checkedPermissionsCount++
```

---

### Incident Patch 14: `73aeb4d1` (2024-10-29)
**Commit Message**: Fix namespace

**File**: `example/ios/RNPermissionsExample.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -280,7 +280,7 @@
 					"-ObjC",
 					"-lc++",
 				);
-				PRODUCT_BUNDLE_IDENTIFIER = com.zoontek.rnpermissionsexampl;
+				PRODUCT_BUNDLE_IDENTIFIER = com.zoontek.rnpermissionsexample;
 				PRODUCT_NAME = RNPermissionsExample;
 				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
 				SWIFT_VERSION = 5.0;
@@ -308,7 +308,7 @@
 					"-ObjC",
 					"-lc++",
 				);
-				PRODUCT_BUNDLE_IDENTIFIER = com.zoontek.rnpermissionsexampl;
+				PRODUCT_BUNDLE_IDENTIFIER = com.zoontek.rnpermissionsexample;
 				PRODUCT_NAME = RNPermissionsExample;
 				SWIFT_VERSION = 5.0;
 				VERSIONING_SYSTEM = "apple-generic";
```

---

### Incident Patch 15: `bb36c5dd` (2024-10-24)
**Commit Message**: Fix #903

**File**: `example/ios/Podfile.lock` (modified, +2/-2)
```diff
@@ -1499,7 +1499,7 @@ PODS:
     - React-logger (= 0.75.4)
     - React-perflogger (= 0.75.4)
     - React-utils (= 0.75.4)
-  - RNPermissions (5.0.1):
+  - RNPermissions (5.0.2):
     - React-Core
   - RNVectorIcons (10.2.0):
     - DoubleConversion
@@ -1794,7 +1794,7 @@ SPEC CHECKSUMS:
   React-utils: cbe8b8b3d7b2ac282e018e46f0e7b25cdc87c5a0
   ReactCodegen: 4bcb34e6b5ebf6eef5cee34f55aa39991ea1c1f1
   ReactCommon: 6a952e50c2a4b694731d7682aaa6c79bc156e4ad
-  RNPermissions: ed7216b9f49ed98b6cf56b8030de68b9a10b2423
+  RNPermissions: f72d5bf895c8d73e4d627700f183e217598b8264
   RNVectorIcons: 6382277afab3c54658e9d555ee0faa7a37827136
   SocketRocket: abac6f5de4d4d62d24e11868d7a2f427e0ef940d
   Yoga: 055f92ad73f8c8600a93f0e25ac0b2344c3b07e6
```

**File**: `ios/FaceID/RNPermissionHandlerFaceID.mm` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ - (RNPermissionStatus)currentStatus {
       return RNPermissionStatusNotAvailable;
   }
 
-  if ([RNPermissions isFlaggedAsRequested:[[self class] handlerUniqueId]]) {
+  if (![RNPermissions isFlaggedAsRequested:[[self class] handlerUniqueId]]) {
     return RNPermissionStatusNotDetermined;
   }
 
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-permissions",
-  "version": "5.0.1",
+  "version": "5.0.2",
   "license": "MIT",
   "description": "An unified permissions API for React Native on iOS, Android and Windows",
   "author": "Mathieu Acthernoene <zoontek@gmail.com>",
```

#### Recent Merged Pull Requests:
- **PR #987** (2026-09-14): fix(android): skip explicit Kotlin plugin when AGP registers the kotlin extension (@gabrieldonadel)
- **PR #986** (closed): Fix stale iOS calendar/reminders status by sharing a single EKEventStore (@flochtililoch)
- **PR #985** (2026-06-16): Add openContactsPicker to edit the limited contacts selection on iOS 18+ (@pablogdcr)
- **PR #981** (2026-04-08): fix license link (@gadhiyamanan)
- **PR #978** (closed): refactor(ios): resolve permission handlers at runtime (@zhfwch)
- **PR #971** (2025-11-04): Update documentation with one-time permission info for Android (@hryhoriiK97)
- **PR #952** (2025-05-31): Proxify other platforms permissions (@zoontek)
- **PR #944** (2025-04-27): Add use fullscreen intent (#943) (@danilvalov)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
