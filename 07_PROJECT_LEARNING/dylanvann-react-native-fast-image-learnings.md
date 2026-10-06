# Forensic Learning Record (Deep Inspection): DylanVann/react-native-fast-image

> **Canonical Artifact**: `07_PROJECT_LEARNING/dylanvann-react-native-fast-image-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DylanVann/react-native-fast-image](https://github.com/DylanVann/react-native-fast-image))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:13:06.444Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DylanVann/react-native-fast-image`
- **Description**: Performant React Native image component.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8410 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ReactNativeFastImageExampleExpo/plugins/withSceneLifecycle.js`
```
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins')

// iOS 27 stops an app at launch unless it uses the scene life cycle, and
// Expo's SDK 57 project template doesn't (its AppDelegate creates the window).
// This switches the generated project to Expo's own ExpoAppSceneDelegate
// (in the expo package): the Info.plist names it as the scene delegate, and
// the AppDelegate leaves the window and starting React Native to it. Remove it
// once the template does this itself.
module.exports = function withSceneLifecycle(config) {
    config = withInfoPlist(config, (mod) => {
        mod.modResults.UIApplicationSceneManifest = {
            UIApplicationSupportsMultipleScenes: false,
            UISceneConfigurations: {
                UIWindowSceneSessionRoleApplication: [
                    {
                        UISceneConfigurationName: 'Default Configuration',
                        UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
                    },
                ],
            },
        }
        return mod
    })
    return withAppDelegate(config, (mod) => {
        let source = mod.modResults.contents
        const replace = (from, to) => {
            if (!source.includes(from)) {
                throw new Error(
                    `withSceneLifecycle: the AppDelegate no longer has ${JSON.stringify(from)}`,
                )
            }
            source = source.replace(from, to)
        }
        replace(
            'class AppDelegate: ExpoAppDelegate {',
            'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
        )
        // The scene delegate creates the window and starts React Native in it.
        source = source.replace(
            /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/,
            '',
        )
        if (source.includes('factory.startReactNative(')) {
            throw new Error(
                'withSceneLifecycle: the AppDelegate still starts React Native itself',
            )
        }
        mod.modResults.contents = source
        return mod
    })
}

```

### Core Architecture Module: `benchmark/app/plugins/withSceneLifecycle.js`
```
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins')

// iOS 27 stops an app at launch unless it uses the scene life cycle, and
// Expo's SDK 57 project template doesn't (its AppDelegate creates the window).
// This switches the generated project to Expo's own ExpoAppSceneDelegate
// (in the expo package): the Info.plist names it as the scene delegate, and
// the AppDelegate leaves the window and starting React Native to it. Remove it
// once the template does this itself.
module.exports = function withSceneLifecycle(config) {
    config = withInfoPlist(config, (mod) => {
        mod.modResults.UIApplicationSceneManifest = {
            UIApplicationSupportsMultipleScenes: false,
            UISceneConfigurations: {
                UIWindowSceneSessionRoleApplication: [
                    {
                        UISceneConfigurationName: 'Default Configuration',
                        UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
                    },
                ],
            },
        }
        return mod
    })
    return withAppDelegate(config, (mod) => {
        let source = mod.modResults.contents
        const replace = (from, to) => {
            if (!source.includes(from)) {
                throw new Error(
                    `withSceneLifecycle: the AppDelegate no longer has ${JSON.stringify(from)}`,
                )
            }
            source = source.replace(from, to)
        }
        replace(
            'class AppDelegate: ExpoAppDelegate {',
            'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
        )
        // The scene delegate creates the window and starts React Native in it.
        source = source.replace(
            /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/,
            '',
        )
        if (source.includes('factory.startReactNative(')) {
            throw new Error(
                'withSceneLifecycle: the AppDelegate still starts React Native itself',
            )
        }
        mod.modResults.contents = source
        return mod
    })
}

```

### Core Architecture Module: `ReactNativeFastImageExample/android/app/src/main/java/com/reactnativefastimageexample/MainActivity.kt`
```
package com.reactnativefastimageexample

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.devsupport.DefaultDevLoadingViewImplementation

class MainActivity : ReactActivity() {

  // scripts/verify.mts hides React Native's development banner ("Loading
  // from…"), which its screenshots would catch.
  override fun onCreate(savedInstanceState: Bundle?) {
    if (intent?.getBooleanExtra("hideDevLoadingView", false) == true) {
      DefaultDevLoadingViewImplementation.setDevLoadingEnabled(false)
    }
    super.onCreate(savedInstanceState)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ReactNativeFastImageExample"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

```

### Core Architecture Module: `ReactNativeFastImageExample/android/app/src/main/java/com/reactnativefastimageexample/MainApplication.kt`
```
package com.reactnativefastimageexample

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

### Core Architecture Module: `ReactNativeFastImageExample/babel.config.js`
```
module.exports = {
    presets: ['module:@react-native/babel-preset'],
}

```

### Core Architecture Module: `ReactNativeFastImageExample/index.js`
```
/**
 * @format
 */

import { AppRegistry } from 'react-native'
import App from './src'
import { name as appName } from './app.json'

AppRegistry.registerComponent(appName, () => App)

```

### Core Architecture Module: `ReactNativeFastImageExample/ios/ReactNativeFastImageExample/AppDelegate.swift`
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
    // scripts/verify.mts hides React Native's development banner
    // ("Downloading 100%"), which its screenshots would catch.
    if UserDefaults.standard.bool(forKey: "FastImageHideDevLoadingView") {
      RCTDevLoadingViewSetEnabled(false)
    }
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    return true
  }
}

// Apps built with the iOS 27 SDK must adopt the UIScene lifecycle, so React
// Native is started from the scene delegate instead of the app delegate.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate
    else { return }
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "ReactNativeFastImageExample",
      in: window,
      launchOptions: nil
    )
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

### Core Architecture Module: `ReactNativeFastImageExample/metro.config.js`
```
const path = require('path')
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const pkg = require('../package.json')

const root = path.resolve(__dirname, '..')

// The repo root has its own dev copies of the library's peer dependencies
// (react, react-native). Block them so the library source uses this app's.
const peers = Object.keys(pkg.peerDependencies)
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const dir = (p) => new RegExp(`^${escape(p)}\\/.*$`)

// Metro sends the app an update for any change in its watch folders, even a
// file the app doesn't use, and React Native shows "Refreshing..." for it
// (in verify.mts's screenshots too). Leave out what changes while the app
// runs and isn't JavaScript: verify.mts's output and references, local
// notes, and the native projects builds write into.
const notSource = [
    ...[
        'verify-output',
        'screenshots',
        'recordings',
        '.local',
        'android',
        'ios',
    ].map((d) => dir(path.join(root, d))),
    dir(path.join(__dirname, 'android')),
    dir(path.join(__dirname, 'ios')),
    new RegExp(`^${escape(root)}\\/[^/]+\\.md$`),
]

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
    watchFolders: [root],
    resolver: {
        blockList: [
            ...peers.map((m) => dir(path.join(root, 'node_modules', m))),
            ...notSource,
        ],
        extraNodeModules: Object.fromEntries(
            peers.map((m) => [m, path.join(__dirname, 'node_modules', m)]),
        ),
        // Load the library from its source so changes show up without a build
        // (unless `scripts/verify.mts --package` installed the package).
        resolveRequest: (context, moduleName, platform) => {
            if (
                moduleName === pkg.name &&
                !process.env.FAST_IMAGE_FROM_PACKAGE
            ) {
                return {
                    type: 'sourceFile',
                    filePath: path.join(root, 'src', 'index.tsx'),
                }
            }
            return context.resolveRequest(context, moduleName, platform)
        },
    },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)

```

### Core Architecture Module: `ReactNativeFastImageExample/react-native.config.js`
```
const path = require('path')
const pkg = require('../package.json')

// Autolink the library's native code (ios/, android/) from the repo root, or
// from the package that `scripts/verify.mts --package` installs.
module.exports = {
    dependencies: {
        [pkg.name]: {
            root: process.env.FAST_IMAGE_FROM_PACKAGE
                ? path.join(__dirname, 'node_modules', pkg.name)
                : path.join(__dirname, '..'),
        },
    },
}

```

### Core Architecture Module: `ReactNativeFastImageExample/src/AutoSizeExample.tsx`
```
import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import SectionFlex from './SectionFlex'
import FastImage, { FastImageProps } from 'react-native-fast-image'
import Section from './Section'
import FeatureText from './FeatureText'
import { useCacheBust } from './useCacheBust'
import { imageUrl } from './imageServer'
import { useReport } from './RunnerContext'

const IMAGE = imageUrl('picsum/1018-600x300.jpg')

interface AutoSizingImageProps extends FastImageProps {
    onLoad?: (event: any) => void
    defaultHeight?: number
    width: number
    style?: any
}

const AutoSizingImage = (props: AutoSizingImageProps) => {
    const [dimensions, setDimensions] = useState({
        height: 0,
        width: 0,
    })

    const propsOnLoad = props.onLoad
    const onLoad = useCallback(
        (e: any) => {
            const {
                nativeEvent: { width, height },
            } = e
            setDimensions({ width, height })
            if (propsOnLoad) {
                propsOnLoad(e)
            }
        },
        [propsOnLoad],
    )

    const height = useMemo(() => {
        if (!dimensions.height) {
            return props.defaultHeight === undefined ? 300 : props.defaultHeight
        }
        const ratio = dimensions.height / dimensions.width
        return props.width * ratio
    }, [dimensions.height, dimensions.width, props.defaultHeight, props.width])
    return (
        <FastImage
            {...props}
            onLoad={onLoad}
            style={[{ width: props.width, height }, props.style]}
        />
    )
}

export const AutoSizeExample = () => {
    const { bust, url } = useCacheBust(IMAGE)
    const [size, setSize] = useState<string>()
    useReport('auto-size', size === undefined ? 'waiting' : 'OK')
    return (
        <View>
            <Section>
                <FeatureText text="• AutoSize." />
            </Section>
            <SectionFlex onPress={bust}>
                <AutoSizingImage
                    style={styles.image}
                    width={200}
                    source={{ uri: url }}
                    onLoad={(e) =>
                        setSize(
                            `${e.nativeEvent.width}x${e.nativeEvent.height}`,
                        )
                    }
                />
            </SectionFlex>
        </View>
    )
}

const styles = StyleSheet.create({
    image: {
        backgroundColor: '#ddd',
        margin: 20,
        flex: 0,
    },
})

```

### Core Architecture Module: `ReactNativeFastImageExample/src/BorderRadiusExample.tsx`
```
import React from 'react'
import { StyleSheet, View } from 'react-native'
import SectionFlex from './SectionFlex'
import FastImage from 'react-native-fast-image'
import Section from './Section'
import FeatureText from './FeatureText'
import { useCacheBust } from './useCacheBust'
import { imageUrl } from './imageServer'
import { useLoads } from './RunnerContext'

const IMAGE_URL = imageUrl('picsum/1025-200x200.jpg')

export const BorderRadiusExample = () => {
    const { query, bust } = useCacheBust('')
    const onLoad = useLoads('border-radius', 4)
    return (
        <View>
            <Section>
                <FeatureText text="• Border radius." />
            </Section>
            <SectionFlex onPress={bust}>
                <FastImage
                    style={styles.imageSquare}
                    source={{
                        uri: IMAGE_URL + query,
                    }}
                    onLoad={onLoad}
                />
                <FastImage
                    style={styles.imageRectangular}
                    source={{
                        uri: IMAGE_URL + query,
                    }}
                    onLoad={onLoad}
                />
            </SectionFlex>
            {/* A border with a radius (#757), and a radius with a scale
                transform (#870). */}
            <SectionFlex onPress={bust}>
                <FastImage
                    style={styles.imageBorder}
                    source={{
                        uri: IMAGE_URL + query,
                    }}
                    onLoad={onLoad}
                />
                <FastImage
                    style={styles.imageScaled}
                    source={{
                        uri: IMAGE_URL + query,
                    }}
                    onLoad={onLoad}
                />
            </SectionFlex>
        </View>
    )
}

const styles = StyleSheet.create({
    imageSquare: {
        borderRadius: 50,
        height: 100,
        backgroundColor: '#ddd',
        margin: 20,
        width: 100,
        flex: 0,
    },
    imageRectangular: {
        borderRadius: 50,
        borderTopLeftRadius: 10,
        borderBottomRightRadius: 10,
        height: 100,
        backgroundColor: '#ddd',
        margin: 20,
        flex: 1,
    },
    imageBorder: {
        borderRadius: 24,
        borderWidth: 4,
        borderColor: 'red',
        height: 80,
        backgroundColor: '#ddd',
        margin: 20,
        width: 80,
    },
    imageScaled: {
        borderRadius: 40,
        borderWidth: 4,
        borderColor: 'red',
        height: 80,
        backgroundColor: '#ddd',
        margin: 20,
        width: 80,
        transform: [{ scale: 0.9 }],
    },
    plus: {
        width: 30,
        height: 30,
        position: 'absolute',
        bottom: 0,
        right: 0,
    },
})

```

### Core Architecture Module: `ReactNativeFastImageExample/src/BulletText.tsx`
```
import React from 'react'
import FeatureText from './FeatureText'

interface BulletTextProps {
    text?: string
    children?: any
}

const BulletText = ({ text, children }: BulletTextProps) => (
    <FeatureText text={`• ${text || children} •`} />
)

export default BulletText

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1077** (2026-09-24): **can anyone add support for React 19, i don't want to ruin my package.json with peer deps**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior if possible, or a link to a reproduction repo: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Expected behavior** A clear and concise description of what you expected to happen.  **Screenshots** If applicable, add screenshots to help explain your problem.  **Dependency versions**  - React Native version: - React version: - React Native Fast Image version:  **Note:** if these are not the latest versions of each I recommend updating as extra effort will not be taken to be backwards compatible, and updating might resolving your issue. 
  **Post-Mortem & Fix Analysis**:
  > +1
  > I updated my RN version from 0.76.5 to 0.79.0. At the time, we installed React 19 as the default supported React version. From that point on, react-native-fast-image has been triggering issues with peer dependencies.  Steps to reproduce:  Update your RN version to greater than 0.78 You have the react-native-fast-image package. Try to update a third-party SDK or any other dependency   Dependency versions React Native version: 0.79.0 React version: 19 React Native Fast Image version: 8.6.3
  > Ran into the same issue, is there any alternative package you've found for this issue?

- **Issue #1069** (2025-07-21): **Tried to access a JS module before the React instance was fully set up.**
  *Symptoms*: Hi everyone,  I've been trying to fix this issue but nothing work.  Tried to access a JS module before the React instance was fully set up. Calls to ReactContext#getJSModule should only happen once initialize() has been called on your native module. 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at com.facebook.react.bridge.BridgeReactContext.getJSModule(BridgeReactContext.java:106) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at com.mrousavy.camera.react.CameraDevicesManager.sendAvailableDevicesChangedEvent(CameraDevicesManager.kt:102) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at com.mrousavy.camera.react.CameraDevicesManager<span>1.invokeSuspend(CameraDevicesManager.kt:74) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:33) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:101) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1145) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at java.util.concurrent.ThreadPoolExecutor</span>Worker.run(ThreadPoolExecutor.java:644) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at java.lang.Thread.run(Thread.java:1012) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: Suppressed: kotlinx.coroutines.internal.DiagnosticCoroutineContextException: [StandaloneCoroutine{Cancelling}@89dd266, java.util.concurrent.T

- **Issue #1068** (2026-09-25): **Doesn't support asset:/ on Android**
  *Symptoms*: **Describe the bug** On Android, files inside `android/app/src/main/assets` directory are usually accessed via `assets:/` but they don't work with FastImage.  Local images don't show at all for me on release builds so the only way I can access them is by using the assets directory.  To be honest if anyone can help me solve why release versions aren't showing images - that'd be a huge help too. But this is still a bug!  **To Reproduce** Steps to reproduce the behavior if possible, or a link to a reproduction repo: 1. Add a file to `android/app/src/main/assets` 2. Add <FastImage source={{uri: 'assets:/myfile.png'}} /> 3. See no image and logcat error `java.lang.IllegalArgumentException: Expected URL scheme 'http' or 'https' but was 'asset'`  **Expected behavior** It should show the image, like the native image component does  **Screenshots** If applicable, add screenshots to help explain your problem.  **Dependency versions**  - React Native version: 0.76.5 - React version: 18.3.1 - React Native Fast Image version: 8.9.2  **Note:** if these are not the latest versions of each I recommend updating as extra effort will not be taken to be backwards compatible, and updating might resolving your issue. 
  **Post-Mortem & Fix Analysis**:
  > @JamesMahy This repo is not actively maintained, you can try out [@d11/react-native-fast-image](https://github.com/dream-sports-labs/react-native-fast-image) which is actively maintained.
  > :tada: This issue has been resolved in version 8.6.30 :tada:  The release is available on [GitHub release](https://github.com/DylanVann/react-native-fast-image/releases/tag/v8.6.30)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1065** (2026-09-24): **Broken BUILD STATUS badge in README**
  *Symptoms*: SCREENSHOT-  ![Image](https://github.com/user-attachments/assets/49b7365b-3eb9-4274-950c-5bc4b9c68af8)
  **Post-Mortem & Fix Analysis**:
  > :tada: This issue has been resolved in version 8.6.13 :tada:  The release is available on [GitHub release](https://github.com/DylanVann/react-native-fast-image/releases/tag/v8.6.13)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1058** (2025-11-06): **error load image on IOS**
  *Symptoms*: react-native-fast-image 8.6.3.  react-native: 0.70.13 if i exit the app and re-enter it works The problem here is that I was using it normally and then it suddenly got an error even though I didn't update anything.
  **Post-Mortem & Fix Analysis**:
  > is there any update?
  > no. i switched to https://github.com/candlefinance/faster-image. base performance is almost same as fast image  > is there any update?  

- **Issue #1054** (2024-10-24): **Warning: TypeError: Cannot read property 'bubblingEventTypes' of null**
  *Symptoms*: **Describe the bug** Warning: TypeError: Cannot read property 'bubblingEventTypes' of null  **Dependency versions**  - React Native version: 0.75.4 - React version: 18.3.1 - React Native Fast Image version: ^8.6.3  **Note:** if these are not the latest versions of each I recommend updating as extra effort will not be taken to be backwards compatible, and updating might resolving your issue. 
  **Post-Mortem & Fix Analysis**:
  > I also encountered this issue, but reopening my emulators fixed it.Try closing and opening your simulator and android emulator.
  > I encountered same issue with same version, Solution -  1. delete node module and reinstall it 2. cd android && ./gradlew clean 3. npm run android  <-- this is the main step
  > @mlcpro You've closed the issue. How have you solved the problem ?

- **Issue #1052** (2026-09-25): **Error load image in android**
  *Symptoms*: Preview: ![Untitled](https://github.com/user-attachments/assets/1655dc60-78a0-4a56-9f6f-c9962d6b7aa3) Log: ![Untitled](https://github.com/user-attachments/assets/59c68da4-c672-446c-9d0c-5287dfd84df6)     "react-native": "0.70.6",     "react-native-fast-image": "^8.6.3",  Code:   ![image](https://github.com/user-attachments/assets/a07f1d69-a235-44ff-b315-08b2df2f8052) Description: When I download the app for the first time on Android devices with low or average configurations, this issue occurs. Even on the Android Studio emulator, I experience the same problem. It loads for a while but remains the same.""When I download the app for the first time on Android devices with low or average configurations (v9 ,10, 11), this issue occurs. Even on the Android Studio emulator (v12 13 14), I experience the same problem. It loads for a while but remains the same.  Thank you !  
  **Post-Mortem & Fix Analysis**:
  > i have same problem However if I trigger a state update on purpose during the image load ``` onLoadStart={() => {         setReRender(true); }} ``` it draw image well here's my component   ```import {useEffect, useState} from 'react'; import {Image, Platform} from 'react-native'; import FastImage, {FastImageProps} from 'react-native-fast-image'; import etcApiController from '../../api/controller/etc';  const CustomFastImage = (props: FastImageProps) => {   if (!props?.source) {     return;   }   if (Platform.OS === 'ios') {     return <FastImage {...props} />;   }   let source = null;   if (typeof props.source !== 'string') {     source = {       uri: Image.resolveAssetSource(props.source as any).uri,     };   } else {     source = props.source;   }   const _props = {     ...props,     source,   };    const [reRender, setReRender] = useState(false);    return (     <FastImage       onLoadStart={() => {         setReRender(true);       }}       
  > Closing as a duplicate of #974, which tracks remote images in lists not loading on Android.

- **Issue #1044** (2026-09-24): **When fallback is set to true, images cannot be imported using require.**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > There's also a new alternative, Faster Image, https://github.com/candlefinance/faster-image
  > :tada: This issue has been resolved in version 8.6.17 :tada:  The release is available on [GitHub release](https://github.com/DylanVann/react-native-fast-image/releases/tag/v8.6.17)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:
  > Fixed in 8.6.17 (#1101): with `fallback`, a `require()`d source is now passed to `Image` as is, so it loads again. Please open a new issue if you still see this on the latest version.

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

### Incident Patch 1: `8c9121ef` (2026-10-05)
**Commit Message**: fix(types): allow ref on FastImage and FastImageBackground (#1254)

FastImage and FastImageBackground are typed as React.ForwardRefExoticComponent with React.RefAttributes of the view's instance type, React.ElementRef<typeof View>, so TypeScript accepts ref on them, and a ref typed from FastImage (React.ElementRef or ComponentRef<typeof FastImage>) is the view, with its methods. imageRef stays React.Ref<any>.

A regression case calls measure and measureInWindow through both components' refs on device. The main example's tsconfig sets types to [], so its typecheck doesn't need Jest's types.

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +72/-0)
```diff
@@ -162,6 +162,77 @@ function LayoutCase({ id, fallback }: { id: string; fallback?: boolean }) {
     )
 }
 
+// FastImage's and FastImageBackground's refs are the view the image fills
+// (#1254): measure and measureInWindow, called through them once the images
+// have loaded, report those views' sizes (48x48 and 96x48).
+function RefMeasureCase() {
+    const image = useRef<React.ElementRef<typeof FastImage>>(null)
+    const background =
+        useRef<React.ElementRef<typeof FastImageBackground>>(null)
+    const [loads, setLoads] = useState(0)
+    const [status, setStatus] = useState('waiting')
+    useEffect(() => {
+        if (loads < 2) return
+        const size = (width: number, height: number) =>
+            `${Math.round(width)}x${Math.round(height)}`
+        const measure = (ref: {
+            current: React.ElementRef<typeof FastImage> | null
+        }) =>
+            new Promise<string>((resolve) =>
+                ref.current
+                    ? ref.current.measure((_x, _y, width, height) =>
+                          resolve(size(width, height)),
+                      )
+                    : resolve('no ref'),
+            )
+        const measureInWindow = (ref: {
+            current: React.ElementRef<typeof FastImage> | null
+        }) =>
+            new Promise<string>((resolve) =>
+                ref.current
+                    ? ref.current.measureInWindow((_x, _y, width, height) =>
+                          resolve(size(width, height)),
+                      )
+                    : resolve('no ref'),
+            )
+        Promise.all([
+            measure(image),
+            measureInWindow(image),
+            measure(background),
+            measureInWindow(background),
+        ]).then((sizes) => {
+            const expected = ['48x48', '48x48', '96x48', '96x48']
+            setStatus(
+                sizes.every((s, i) => s === expected[i])
+                    ? 'OK'
+                    : `measured ${sizes.join(', ')}, expected ${expected.join(', ')}`,
+            )
+        })
+    }, [loads])
+    const onLoad = () => setLoads((n) => n + 1)
+    return (
+        <View style={styles.row}>
+            <FastImage
+                ref={image}
+                style={styles.image}
+                source={{ uri: LOGO }}
+                onLoad={onLoad}
+            />
+            <FastImageBackground
+                ref={background}
+                style={[styles.image, styles.gap, { width: 96 }]}
+                source={{ uri: LOGO }}
+                onLoad={onLoad}
+            />
+            <CaseStatus
+                id="ref-measure"
+                status={status}
+                description="#1254: measure and measureInWindow through FastImage's and FastImageBackground's refs give their views' sizes"
+            />
+        </View>
+    )
+}
+
 // Loads a green-tinted image, then removes tintColor. The second image should
 // match the untinted first one; this is checked by screenshot, since the flow
 // can't read colors. It stayed tinted on iOS.
@@ -4435,6 +4506,7 @@ export const REGRESSION_GROUPS: RegressionGroup[] = [
         cases: [
             <LayoutCase key="layout" id="layout" />,
             <LayoutCase key="layout-fallback" id="layout-fallback" fallback />,
+            <RefMeasureCase key="ref-measure" />,
             <AppImageNameCase key="app-image-name" />,
             <EventCase
                 key="fallback-require"
```

**File**: `ReactNativeFastImageExample/tsconfig.json` (modified, +2/-0)
```diff
@@ -1,6 +1,8 @@
 {
     "extends": "@react-native/typescript-config",
     "compilerOptions": {
+        // No Jest here (the base config adds its types).
+        "types": [],
         "paths": {
             "react-native-fast-image": ["../src/index"],
             // The library source would otherwise pick up the repo root's
```

**File**: `src/index.test.tsx` (modified, +22/-0)
```diff
@@ -283,6 +283,28 @@ describe('FastImage (iOS)', () => {
     })
 })
 
+describe('ref', () => {
+    it("is FastImage's view", () => {
+        const ref = React.createRef<View>()
+        const tree = renderer.create(
+            <FastImage
+                ref={ref}
+                source={{ uri: 'https://example.com/a.png' }}
+                style={style.image}
+            />,
+            // Host refs are null without a node.
+            { createNodeMock: (element) => ({ type: element.type }) },
+        )
+        expect(tree.toJSON()).not.toBeNull()
+        expect(ref.current).toEqual({ type: 'View' } as any)
+        // Typed as the view, with its methods (a type check: the view here
+        // is a stand-in).
+        const measure = (view: React.ElementRef<typeof FastImage>) =>
+            view.measure(() => {})
+        expect(typeof measure).toBe('function')
+    })
+})
+
 describe('FastImageBackground', () => {
     it('shows the image filling a view, with the children on top', () => {
         const imageRef = React.createRef<any>()
```

**File**: `src/index.tsx` (modified, +43/-39)
```diff
@@ -808,11 +808,17 @@ function FastImageBase({
 
 const FastImageMemo = memo(FastImageBase)
 
-const FastImageComponent: React.ComponentType<FastImageProps> = forwardRef(
-    (props: FastImageProps, ref: React.Ref<any>) => (
-        <FastImageMemo forwardedRef={ref} {...props} />
-    ),
-)
+// What a ref to FastImage or FastImageBackground gets: the view the image
+// fills (FastImage's wrapper, FastImageBackground's view). ElementRef, as
+// React Native's types declare View as a class up to 0.79 and as a function
+// component with a ref after.
+type ViewRef = React.ElementRef<typeof View>
+
+const FastImageComponent: React.ForwardRefExoticComponent<
+    FastImageProps & React.RefAttributes<ViewRef>
+> = forwardRef((props: FastImageProps, ref: React.Ref<ViewRef>) => (
+    <FastImageMemo forwardedRef={ref} {...props} />
+))
 
 FastImageComponent.displayName = 'FastImage'
 
@@ -884,7 +890,9 @@ export interface FastImageStaticProperties {
     configureCache: (limits?: CacheLimits) => Promise<CacheState>
 }
 
-const FastImage: React.ComponentType<FastImageProps> &
+const FastImage: React.ForwardRefExoticComponent<
+    FastImageProps & React.RefAttributes<ViewRef>
+> &
     FastImageStaticProperties = FastImageComponent as any
 
 FastImage.resizeMode = resizeMode
@@ -976,47 +984,43 @@ export interface FastImageBackgroundProps extends Omit<
     children?: React.ReactNode
 }
 
-// FastImage forwards its ref, which its type doesn't say.
-const FastImageWithRef = FastImageComponent as React.ComponentType<
-    FastImageProps & { ref?: React.Ref<any> }
->
-
 /**
  * An image with content on top of it, like React Native's `ImageBackground`: a
  * view that the image fills, with the children on top. Use it rather than
  * giving `FastImage` children, which it won't render in the next major version
  * (the image will be a single native view). The other props go to the image;
  * the ref is the view's.
  */
-export const FastImageBackground: React.ComponentType<FastImageBackgroundProps> =
-    forwardRef(
-        (
-            {
-                style,
-                imageStyle,
-                imageRef,
-                children,
-                importantForAccessibility,
-                ...props
-            }: FastImageBackgroundProps,
-            ref: React.Ref<any>,
-        ) => (
-            <View
-                accessibilityIgnoresInvertColors
+export const FastImageBackground: React.ForwardRefExoticComponent<
+    FastImageBackgroundProps & React.RefAttributes<ViewRef>
+> = forwardRef(
+    (
+        {
+            style,
+            imageStyle,
+            imageRef,
+            children,
+            importantForAccessibility,
+            ...props
+        }: FastImageBackgroundProps,
+        ref: React.Ref<ViewRef>,
+    ) => (
+        <View
+            accessibilityIgnoresInvertColors
+            importantForAccessibility={importantForAccessibility}
+            style={style}
+            ref={ref}
+        >
+            <FastImageComponent
+                {...props}
                 importantForAccessibility={importantForAccessibility}
-                style={style}
-                ref={ref}
-            >
-                <FastImageWithRef
-                    {...props}
-                    importantForAccessibility={importantForAccessibility}
-                    style={[StyleSheet.absoluteFill, imageStyle]}
-                    ref={imageRef}
-                />
-                {children}
-            </View>
-        ),
-    )
+                style={[StyleSheet.absoluteFill, imageStyle]}
+                ref={imageRef}
+            />
+            {children}
+        </View>
+    ),
+)
 
 FastImageBackground.displayName = 'FastImageBackground'
 
```

---

### Incident Patch 2: `e8fdcc1e` (2026-10-05)
**Commit Message**: fix: install with npm next to React Native tvOS and release candidates (#1253)

The react-native peer is now "*". npm only accepts a prerelease (react-native-tvos versions such as 0.87.1-1, and RCs) for a peer of exactly "*", and failed with ERESOLVE against ">=0.65.0". The README states the minimum (React Native 0.65) and now mentions React Native tvOS; docs/development.md explains why the peer is "*".

**File**: `README.md` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ See [Formats](docs/formats.md) for the versions of iOS and Android each format n
 
 ## Installation
 
-Works with React Native 0.65 and later (iOS 13 and later, Android `minSdkVersion` 21 and later), with the New Architecture (through React Native's interop layer) and the legacy architecture, and with Expo. It's tested on React Native 0.87 with the New Architecture, 0.73 with the legacy architecture, and Expo SDK 57. A native New Architecture component is planned for a future major version.
+Works with React Native 0.65 and later (iOS 13 and later, Android `minSdkVersion` 21 and later), with the New Architecture (through React Native's interop layer) and the legacy architecture, with Expo, and on tvOS with [React Native tvOS](https://github.com/react-native-tvos/react-native-tvos). It's tested on React Native 0.87 with the New Architecture, 0.73 with the legacy architecture, Expo SDK 57, and React Native tvOS 0.87. A native New Architecture component is planned for a future major version.
 
 ```bash
 npm install react-native-fast-image
```

**File**: `bun.lock` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
       },
       "peerDependencies": {
         "react": "^17 || ^18 || ^19",
-        "react-native": ">=0.65.0",
+        "react-native": "*",
       },
     },
   },
```

**File**: `docs/development.md` (modified, +4/-0)
```diff
@@ -183,6 +183,10 @@ Notes for maintainers go in `//` comments instead: they aren't in editor hovers,
 
 The website in `website/` ([Starlight](https://starlight.astro.build)) shows the README as its main page and each file in `docs/` as a page (`benchmarks.md` and `development.md` next to it in the sidebar, the others under Guides), each named after its title. `bun run dev` in `website/` generates the pages and serves them; `bun run build` writes the site to `website/dist/` (`bun run build:docs` from the repo's root does the same). The generator runs [TypeDoc](https://typedoc.org), which needs TypeScript 6 (the library uses TypeScript 7, which has no JavaScript API yet), so `website/` has its own dependencies. It warns about links to headings that don't exist in the README or `docs/`.
 
+## The `react-native` peer dependency
+
+`package.json`'s `react-native` peer is `*`, and the README's Installation section says which React Native versions FastImage works with. A range such as `>=0.65.0` would stop npm from installing FastImage next to React Native tvOS (`react-native-tvos`, whose versions, e.g. `0.87.1-1`, are semver prereleases) or a release candidate: npm only accepts a prerelease for a peer of `*`, and fails with `ERESOLVE` otherwise (yarn, pnpm and bun only warn). Most React Native libraries, and the `create-react-native-library` and `create-expo-module` templates, use `*` for this reason. Keep the README's minimum up to date instead.
+
 ## Releasing
 
 Releases are automatic from `main`, with an approval step:
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -69,6 +69,6 @@
     },
     "peerDependencies": {
         "react": "^17 || ^18 || ^19",
-        "react-native": ">=0.65.0"
+        "react-native": "*"
     }
 }
```

---

### Incident Patch 3: `4a170ff5` (2026-10-05)
**Commit Message**: feat(android): require Glide 4.15 or later (#1247)

FastImageAnimated (animated WebP and AVIF, which Glide decodes from 4.15)
moves to src/main, and the stand-in for older Glide versions is gone. An
app that sets an older glideVersion gets a build error saying so. The docs
say FastImage works with Glide 5 (tested with 5.0.9).

BREAKING CHANGE: FastImage needs Glide 4.15 or later: a glideVersion before 4.15 stops the build (the default is 4.16.0).

**File**: `android/build.gradle` (modified, +8/-11)
```diff
@@ -32,15 +32,16 @@ def appHasExpoImage = {
 def excludeAppGlideModule = safeExtGet('excludeAppGlideModule', appHasExpoImage())
 
 // When changing the default, revisit the Glide rules in consumer-rules.pro.
-// 4.15+ animates animated WebP (Android 9+) and AVIF (Android 12+).
+// 4.15+ animates animated WebP (Android 9+) and AVIF (Android 12+), which
+// FastImageAnimated builds on. A version that isn't numbered (e.g. "4.+") is
+// taken to be recent.
 def glideVersion = safeExtGet('glideVersion', '4.16.0')
-// Whether it's 4.15 or later, which FastImageAnimated (src/glide-4.15) builds
-// on; an older one gets a stand-in (src/glide-older). A version that isn't
-// numbered (e.g. "4.+") is taken to be recent.
 def glideVersionParts = glideVersion.toString() =~ /^(\d+)\.(\d+)/
-def glideHasAnimatedDecoder = !glideVersionParts.find() ||
-        glideVersionParts.group(1).toInteger() > 4 ||
-        (glideVersionParts.group(1).toInteger() == 4 && glideVersionParts.group(2).toInteger() >= 15)
+if (glideVersionParts.find() &&
+        (glideVersionParts.group(1).toInteger() < 4 ||
+                (glideVersionParts.group(1).toInteger() == 4 && glideVersionParts.group(2).toInteger() < 15))) {
+    throw new GradleException("react-native-fast-image needs Glide 4.15 or later, but glideVersion is ${glideVersion}.")
+}
 
 // Newer versions of the Android Gradle plugin (7.3+) take the namespace from
 // build.gradle and warn about the package attribute in AndroidManifest.xml;
@@ -67,12 +68,8 @@ android {
                 manifest.srcFile "src/main/AndroidManifestNew.xml"
             }
             java {
-                srcDir glideHasAnimatedDecoder ? "src/glide-4.15/java" : "src/glide-older/java"
                 if (excludeAppGlideModule) {
-                    srcDir "src"
                     exclude "**/FastImageGlideModule.java"
-                    // Only the one chosen above.
-                    exclude "glide-*/**"
                 }
             }
         }
```

**File**: `android/src/glide-older/java/com/dylanvann/fastimage/FastImageAnimated.java` (removed, +0/-36)
```diff
@@ -1,36 +0,0 @@
-package com.dylanvann.fastimage;
-
-import android.content.Context;
-import android.graphics.drawable.Drawable;
-
-import androidx.annotation.NonNull;
-import androidx.annotation.Nullable;
-
-import com.bumptech.glide.Glide;
-import com.bumptech.glide.Registry;
-
-// Built instead of src/glide-4.15's FastImageAnimated with a Glide before
-// 4.15 (build.gradle), which has no decoder for animated WebP or AVIF: they
-// show their first frame, so there's nothing to register, remember or copy.
-final class FastImageAnimated {
-    private FastImageAnimated() {}
-
-    interface CopyCallback {
-        void onCopy(@Nullable Drawable copy);
-    }
-
-    static void register(@NonNull Context context, @NonNull Glide glide, @NonNull Registry registry) {}
-
-    @Nullable
-    static Integer repeatCount(@NonNull Drawable drawable) {
-        return null;
-    }
-
-    static boolean shownElsewhere(@NonNull Drawable drawable, @NonNull Drawable.Callback view) {
-        return false;
-    }
-
-    static void copy(@NonNull Drawable drawable, @NonNull CopyCallback callback) {
-        callback.onCopy(null);
-    }
-}
```

**File**: `android/src/main/java/com/dylanvann/fastimage/FastImageAnimated.java` (renamed, +0/-3)
```diff
@@ -49,9 +49,6 @@
 // Not animated (dontAnimate: blurRadius, resizeMode repeat), they're decoded
 // as their first frame, a bitmap, as GIFs are, and as Glide did before 4.15.
 // Glide's own decoder for them doesn't check that option.
-//
-// Built only with Glide 4.15 or later, which has the decoder this wraps; with
-// an older Glide, src/glide-older's stand-in does nothing (build.gradle).
 final class FastImageAnimated {
     private FastImageAnimated() {}
 
```

**File**: `docs/android-build-settings.md` (modified, +8/-12)
```diff
@@ -13,18 +13,14 @@ buildscript {
 }
 ```
 
-| Property                | Default    | Notes                                                                                                                                                                               |
-| ----------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
-| `compileSdkVersion`     | `28`       | Set by React Native's template, so FastImage builds with your app's versions.                                                                                                       |
-| `targetSdkVersion`      | `28`       |                                                                                                                                                                                     |
-| `minSdkVersion`         | `21`       |                                                                                                                                                                                     |
-| `buildToolsVersion`     | `"28.0.3"` |                                                                                                                                                                                     |
-| `glideVersion`          | `"4.16.0"` | The version of Glide (and its OkHttp integration) that FastImage uses. If your app uses Glide too, set it to your app's version. See [older Glide versions](#older-glide-versions). |
-| `excludeAppGlideModule` | `false`    | Leaves out FastImage's `AppGlideModule`, for an app that has its own (below). `true` by default when the app has [expo-image](#with-expo-image).                                    |
-
-## Older Glide versions
-
-With a `glideVersion` before 4.15, animated WebP and AVIF images show their first frame: 4.15 added Glide's decoder for them, which uses Android's `ImageDecoder`. FastImage's default was 4.12.0 before it was raised to 4.16.0.
+| Property                | Default    | Notes                                                                                                                                                                                   |
+| ----------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| `compileSdkVersion`     | `28`       | Set by React Native's template, so FastImage builds with your app's versions.                                                                                                           |
+| `targetSdkVersion`      | `28`       |                                                                                                                                                                                         |
+| `minSdkVersion`         | `21`       |                                                                                                                                                                                         |
+| `buildToolsVersion`     | `"28.0.3"` |                                                                                                                                                                                         |
+| `glideVersion`          | `"4.16.0"` | The version of Glide (and its OkHttp integration) that FastImage uses. If your app uses Glide too, set it to your app's version. FastImage needs 4.15 or later, and works with Glide 5. |
+| `excludeAppGlideModule` | `false`    | Leaves out FastImage's `AppGlideModule`, for an app that has its own (below). `true` by default when the app has [expo-image](#with-expo-image).                                        |
 
 ## If your app has its own AppGlideModule
 
```

**File**: `docs/formats.md` (modified, +0/-2)
```diff
@@ -46,8 +46,6 @@ FastImage loads images with [Glide](https://github.com/bumptech/glide), which de
 | ICNS   | No                                               |                                                                                      |
 | PSD    | No                                               |                                                                                      |
 
-Animated WebP and AVIF need Glide 4.15 or later (FastImage uses 4.16 unless the app sets an older `glideVersion`, see [Android build settings](android-build-settings.md#older-glide-versions)); with an older Glide they show their first frame.
-
 ## SVG images
 
 SVG images (remote, bundled with `require()`, or local files) load with SDWebImageSVGCoder on iOS and AndroidSVG on Android, which FastImage includes. On Android, an app with AndroidSVG's other package (`com.caverock:androidsvg`) leaves FastImage's out: see [duplicate AndroidSVG classes](troubleshooting.md#duplicate-androidsvg-classes).
```

**File**: `package.json` (modified, +0/-2)
```diff
@@ -28,8 +28,6 @@
         "android/build.gradle",
         "android/consumer-rules.pro",
         "android/src/main",
-        "android/src/glide-4.15",
-        "android/src/glide-older",
         "ios/FastImage",
         "app.plugin.js",
         "dist",
```

---

### Incident Patch 4: `a73e620d` (2026-10-05)
**Commit Message**: test: keep React Native's prebuilt iOS frameworks matching the configuration being built [skip ci]

**File**: `scripts/verify.mts` (modified, +56/-0)
```diff
@@ -1892,11 +1892,67 @@ function trimCompilationCache() {
     }
 }
 
+// React Native's prebuilt iOS frameworks (its core on recent versions, and
+// Hermes) come in a Debug and a Release build, swapped by a build phase that
+// compares the configuration with a marker file in Pods (no marker counts as
+// Debug). `pod install` can leave a framework from the other configuration
+// with a marker that says otherwise: after a --release run, Debug builds then
+// failed to link (react-native-screens) or crashed at launch (Hermes'
+// debugger). So before each build the markers say which build is on disk, read
+// from a symbol only the Debug one has, and the build phase swaps when needed.
+// The marker's path is the app's React Native's own (LAST_BUILD_FILENAME).
+function syncPrebuiltMarkers(dir: string) {
+    const pods = path.join(dir, 'ios/Pods')
+    const rn = path.join(dir, 'node_modules/react-native')
+    const slice = 'ios-arm64_x86_64-simulator'
+    const frameworks = [
+        {
+            script: 'scripts/replace-rncore-version.js',
+            binary: `React-Core-prebuilt/React.xcframework/${slice}/React.framework/React`,
+            debugSymbol: 'DebugStringConvertible',
+        },
+        ...['hermesvm', 'hermes'].map((name) => ({
+            script: 'sdks/hermes-engine/utils/replace_hermes_version.js',
+            binary: `hermes-engine/destroot/Library/Frameworks/universal/${name}.xcframework/${slice}/${name}.framework/${name}`,
+            // hermes::debugger
+            debugSymbol: 'hermes8debugger',
+        })),
+    ]
+    for (const { script, binary, debugSymbol } of frameworks) {
+        const file = path.join(pods, binary)
+        const source = path.join(rn, script)
+        if (!fs.existsSync(file) || !fs.existsSync(source)) continue
+        const marker = fs
+            .readFileSync(source, 'utf8')
+            .match(/LAST_BUILD_FILENAME\s*=\s*'([^']+)'/)?.[1]
+        if (!marker) continue
+        const built =
+            capture(
+                'sh',
+                [
+                    '-c',
+                    'nm -gU "$0" | grep -q "$1" && echo Debug',
+                    file,
+                    debugSymbol,
+                ],
+                { timeout: 60 },
+            ) === 'Debug'
+                ? 'Debug'
+                : 'Release'
+        const markerFile = path.join(pods, marker)
+        const current = fs.existsSync(markerFile)
+            ? fs.readFileSync(markerFile, 'utf8')
+            : 'Debug'
+        if (current !== built) fs.writeFileSync(markerFile, built)
+    }
+}
+
 async function buildIos(app: App) {
     const dir = appDir(app)
     const name = appName(app)
     const log = path.join(OUT, `ios-build-${app}.log`)
     trimCompilationCache()
+    syncPrebuiltMarkers(dir)
     const result = await run(
         'xcodebuild',
         [
```

---

### Incident Patch 5: `d436d419` (2026-10-05)
**Commit Message**: fix(ios): load images in the app by name, e.g. from its asset catalog (#1243)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ When `source` changes, the image that's showing stays until the new one has load
 
 Remote url to load the image from. e.g. `'https://example.com/image.jpg'`.
 
-Also loads local files (`file://`, and on Android `content://`), photo library images on iOS (`ph://`, see [Photo library images](#photo-library-images-ios)) and SVG images (see [SVG images](docs/formats.md#svg-images)).
+Also loads local files (`file://`, and on Android `content://`), images in the app by name (e.g. `'my_image'`: in its asset catalog on iOS, a drawable on Android), photo library images on iOS (`ph://`, see [Photo library images](#photo-library-images-ios)) and SVG images (see [SVG images](docs/formats.md#svg-images)).
 
 ---
 
```

**File**: `ReactNativeFastImageExample/ios/ReactNativeFastImageExample/Images.xcassets/regression_quadrants.imageset/Contents.json` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+{
+  "images" : [
+    {
+      "filename" : "regression_quadrants.png",
+      "idiom" : "universal",
+      "scale" : "1x"
+    }
+  ],
+  "info" : {
+    "author" : "xcode",
+    "version" : 1
+  }
+}
```

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +31/-0)
```diff
@@ -4231,6 +4231,36 @@ function WebCachePathAtStartCase() {
     )
 }
 
+// An image in the app by its name (#410): on iOS in the example apps' asset
+// catalogs, on Android a drawable (regression_quadrants, the 80x80
+// quadrants), as React Native's Image takes. iOS made the name a file in the
+// app's resources, which an asset catalog image isn't, so it didn't load.
+function AppImageNameCase() {
+    const [status, setStatus] = useState('loading')
+    return (
+        <View style={styles.row}>
+            <FastImage
+                style={styles.image}
+                source={{ uri: 'regression_quadrants' }}
+                onLoad={(e) => {
+                    const { width, height } = e.nativeEvent
+                    setStatus(
+                        width === 80 && height === 80
+                            ? 'OK'
+                            : `loaded at ${width}x${height}, expected 80x80`,
+                    )
+                }}
+                onError={(e) => setStatus(`error: ${e.nativeEvent.error}`)}
+            />
+            <CaseStatus
+                id="app-image-name"
+                status={status}
+                description="#410: an image by its name in the app (the asset catalog on iOS, a drawable on Android) loads (the quadrants)"
+            />
+        </View>
+    )
+}
+
 export const REGRESSION_GROUPS: RegressionGroup[] = [
     {
         // First, before any view has loaded an image.
@@ -4404,6 +4434,7 @@ export const REGRESSION_GROUPS: RegressionGroup[] = [
         cases: [
             <LayoutCase key="layout" id="layout" />,
             <LayoutCase key="layout-fallback" id="layout-fallback" fallback />,
+            <AppImageNameCase key="app-image-name" />,
             <EventCase
                 key="fallback-require"
                 id="fallback-require"
```

**File**: `ReactNativeFastImageExampleLegacy/ios/ReactNativeFastImageExampleLegacy/Images.xcassets/regression_quadrants.imageset/Contents.json` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+{
+  "images" : [
+    {
+      "filename" : "regression_quadrants.png",
+      "idiom" : "universal",
+      "scale" : "1x"
+    }
+  ],
+  "info" : {
+    "author" : "xcode",
+    "version" : 1
+  }
+}
```

**File**: `ios/FastImage/FFFastImageSource.m` (modified, +72/-0)
```diff
@@ -62,6 +62,75 @@ static CGSize FFFPhotoPixelSize(NSURL *url)
     return size;
 }
 
+// An image in the app by its name (`uri: 'my_image'`), such as one in the
+// app's asset catalog, as React Native's Image takes: RCTConvert makes a uri
+// without a scheme a file in the app's resources, where such an image isn't a
+// file. The name, or nil if the url is a file that exists or isn't in the
+// app's resources.
+static NSString *FFFBundleAssetName(NSURL *url)
+{
+    if (!url.isFileURL) {
+        return nil;
+    }
+    NSString *resources = [NSBundle.mainBundle.resourcePath stringByAppendingString:@"/"];
+    NSString *path = url.path;
+    if (![path hasPrefix:resources] || path.length == resources.length ||
+        [NSFileManager.defaultManager fileExistsAtPath:path]) {
+        return nil;
+    }
+    return [path substringFromIndex:resources.length];
+}
+
+// Loads images in the app by name (FFFBundleAssetName) with UIImage
+// imageNamed:, which finds them in the asset catalog (and image files in the
+// app's resources, e.g. with @2x and @3x versions), as React Native's Image
+// does.
+@interface FFFBundleAssetLoader : NSObject <SDImageLoader>
+@end
+
+@implementation FFFBundleAssetLoader
+
++ (FFFBundleAssetLoader *)sharedLoader
+{
+    static FFFBundleAssetLoader *loader;
+    static dispatch_once_t once;
+    dispatch_once(&once, ^{
+        loader = [FFFBundleAssetLoader new];
+    });
+    return loader;
+}
+
+- (BOOL)canRequestImageForURL:(NSURL *)url
+{
+    return YES;
+}
+
+- (id<SDWebImageOperation>)requestImageWithURL:(NSURL *)url
+                                        options:(SDWebImageOptions)options
+                                        context:(SDWebImageContext *)context
+                                       progress:(SDImageLoaderProgressBlock)progressBlock
+                                      completed:(SDImageLoaderCompletedBlock)completedBlock
+{
+    NSString *name = FFFBundleAssetName(url);
+    UIImage *image = name ? [UIImage imageNamed:name] : nil;
+    if (completedBlock) {
+        if (image) {
+            completedBlock(image, nil, nil, YES);
+        } else {
+            NSString *message = [NSString stringWithFormat:@"No image named %@ in the app", name ?: url.path];
+            completedBlock(nil, nil, [NSError errorWithDomain:SDWebImageErrorDomain code:SDWebImageErrorInvalidURL userInfo:@{NSLocalizedDescriptionKey: message}], YES);
+        }
+    }
+    return nil;
+}
+
+- (BOOL)shouldBlockFailedURLWithURL:(NSURL *)url error:(NSError *)error
+{
+    return NO;
+}
+
+@end
+
 // Loads photo library images (ph://<localIdentifier>) with
 // SDWebImagePhotosPlugin's loader: a dependency on iOS (the podspec), found
 // at runtime so that tvOS builds without it (an app can add it there). Its
@@ -368,6 +437,9 @@ - (CGSize)photoPixelSize
     if ([_url.scheme isEqualToString:@"assets-library"]) {
         return [FFFPhotosLoader assetsLibraryLoader];
     }
+    if (FFFBundleAssetName(_url)) {
+        return [FFFBundleAssetLoader sharedLoader];
+    }
     if (_cacheControl != FFFCacheControlWeb) {
         return nil;
     }
```

**File**: `src/index.tsx` (modified, +3/-2)
```diff
@@ -33,8 +33,9 @@ export type Source = {
     /**
      * Remote url to load the image from. e.g. `'https://example.com/image.jpg'`.
      *
-     * Also loads local files (`file://`, and on Android `content://`), photo
-     * library images on iOS (`ph://`, see
+     * Also loads local files (`file://`, and on Android `content://`), images
+     * in the app by name (e.g. `'my_image'`: in its asset catalog on iOS, a
+     * drawable on Android), photo library images on iOS (`ph://`, see
      * [Photo library images](#photo-library-images-ios)) and SVG images (see
      * [SVG images](docs/formats.md#svg-images)).
      */
```

---

### Incident Patch 6: `56f2d679` (2026-10-04)
**Commit Message**: fix(android): work in apps that have expo-image (#1241)

* fix(android): work in apps that have expo-image

* fix(android): register FastImage's Glide components before preloads, and not on the main thread when FastImage's module started Glide

* docs: CacheState without a disk size limit in an app with expo-image

* fix(android): load FastImage's urls with their own model instead of replacing Glide's GlideUrl loader

* fix(android): set up the HTTP cache of cache 'web' images for getCachePath and clearDiskCache before the first load

**File**: `README.md` (modified, +3/-3)
```diff
@@ -623,7 +623,7 @@ await FastImage.configureCache({ maxDiskSize: 500 * 1024 * 1024 })
 const { maxDiskSize, diskSize } = await FastImage.configureCache()
 ```
 
-On Android, if your app has its own `AppGlideModule` (see [using FastImage with an AppGlideModule](docs/android-build-settings.md#if-your-app-has-its-own-appglidemodule)), set the disk cache size there instead: `maxDiskSize` isn't applied or reported.
+On Android, if your app has its own `AppGlideModule` (see [using FastImage with an AppGlideModule](docs/android-build-settings.md#if-your-app-has-its-own-appglidemodule)), set the disk cache size there instead: `maxDiskSize` isn't applied or reported. Likewise in an app with [expo-image](docs/android-build-settings.md#with-expo-image), whose Glide setup sets the disk cache.
 
 Images with `cache: 'web'` are kept in their own HTTP cache instead, up to 50 MB on each platform, which these limits don't change.
 
@@ -659,7 +659,7 @@ How fresh an image must be: see [`source.cache`](#sourcecache).
 
 ### `CacheState`
 
-`configureCache`'s result: the limits in effect (0 for no limit), and the bytes the disk cache uses now. Android only has `maxDiskSize` and `diskSize`, and neither if the app has its own `AppGlideModule`.
+`configureCache`'s result: the limits in effect (0 for no limit), and the bytes the disk cache uses now. Android only has `maxDiskSize` and `diskSize`, and neither if the app has its own `AppGlideModule` (or expo-image, which has one).
 
 - `maxDiskSize?` (`number`)
 - `maxDiskAge?` (`number`)
@@ -800,7 +800,7 @@ In `android/app/src/main/AndroidManifest.xml`, inside `<application>`:
 <meta-data android:name="fastimage.MAX_DISK_SIZE" android:value="209715200" />
 ```
 
-If your app has its own `AppGlideModule` (see [using FastImage with an AppGlideModule](docs/android-build-settings.md#if-your-app-has-its-own-appglidemodule)), set the disk cache size there instead.
+If your app has its own `AppGlideModule` (see [using FastImage with an AppGlideModule](docs/android-build-settings.md#if-your-app-has-its-own-appglidemodule)), set the disk cache size there instead. In an app with [expo-image](docs/android-build-settings.md#with-expo-image), expo-image's Glide setup sets it.
 
 [^glide-memory]: Glide's default, which FastImage keeps: room for two screenfuls of decoded images (2 × the screen's width × height × 4 bytes, about 20 MB on a 1080 × 2400 screen), plus a pool of bitmaps to reuse (one screenful on Android 8 and later, four before). Together they're limited to 40% of the memory Android gives the app (33% on low-memory devices), and both shrink to fit.
 
```

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +35/-0)
```diff
@@ -4201,7 +4201,42 @@ function SvgSharpCase() {
     )
 }
 
+// getCachePath for a `cache: 'web'` image as the app's first FastImage call
+// (the runner's first group, without views): on Android the HTTP cache of
+// `web` images is set up when FastImage's Glide components are registered,
+// which Glide 4.15+ does when its registry is first used (by a load), so it
+// failed with "Glide isn't set up".
+const START_WEB_PATH = `/max-age/picsum/1025-200x200.jpg?start-web=${RUN}`
+function WebCachePathAtStartCase() {
+    const [status, setStatus] = useState('waiting')
+    useEffect(() => {
+        FastImage.getCachePath({
+            uri: imageUrl(START_WEB_PATH.slice(1)),
+            cache: FastImage.cacheControl.web,
+        })
+            .then((result) =>
+                setStatus(result.ok ? 'OK' : `error: ${result.error}`),
+            )
+            .catch((e) => setStatus(`error: ${e}`))
+    }, [])
+    return (
+        <View style={styles.row}>
+            <View style={styles.image} />
+            <CaseStatus
+                id="cache-path-web-at-start"
+                status={status}
+                description="getCachePath for a cache 'web' image before any image has loaded: downloads it into the HTTP cache"
+            />
+        </View>
+    )
+}
+
 export const REGRESSION_GROUPS: RegressionGroup[] = [
+    {
+        // First, before any view has loaded an image.
+        name: 'start',
+        cases: [<WebCachePathAtStartCase key="cache-path-web-at-start" />],
+    },
     {
         name: 'load-end',
         cases: [
```

**File**: `ReactNativeFastImageExample/src/SmokeExample.tsx` (modified, +252/-10)
```diff
@@ -1,9 +1,14 @@
-import React, { useEffect, useRef, useState } from 'react'
+import React, { useContext, useEffect, useRef, useState } from 'react'
 import { PixelRatio, Platform, View } from 'react-native'
 import FastImage, { LoadResult } from 'react-native-fast-image'
 import { CaseStatus, caseStyles as styles } from './CaseStatus'
 import { imageUrl } from './imageServer'
-import type { RegressionGroup } from './RunnerContext'
+import {
+    Masked,
+    measureView,
+    SampleContext,
+    type RegressionGroup,
+} from './RunnerContext'
 
 // A few cases that check FastImage works at all in an app (the Expo example,
 // ReactNativeFastImageExampleExpo, on iOS, Android and the web): an image
@@ -181,7 +186,9 @@ function CachePathCase() {
 
 // The cache limits the app's config sets (app.config.js, through FastImage's
 // Expo config plugin), as configureCache reports them. Android only has the
-// disk size limit.
+// disk size limit, which FastImage's AppGlideModule applies: the Expo example
+// has expo-image, whose AppGlideModule the app uses instead (FastImage leaves
+// its own out), so there it reports none.
 export const EXPO_CACHE_LIMITS = {
     maxDiskSize: 150 * 1024 * 1024,
     maxDiskAge: 7 * 24 * 60 * 60,
@@ -192,13 +199,13 @@ function CacheLimitsCase() {
     const [status, setStatus] = useState('loading')
     useEffect(() => {
         FastImage.configureCache().then((state) => {
-            const expected =
+            const ok =
                 Platform.OS === 'ios'
-                    ? EXPO_CACHE_LIMITS
-                    : { maxDiskSize: EXPO_CACHE_LIMITS.maxDiskSize }
-            const ok = Object.entries(expected).every(
-                ([name, value]) => state[name as keyof typeof state] === value,
-            )
+                    ? Object.entries(EXPO_CACHE_LIMITS).every(
+                          ([name, value]) =>
+                              state[name as keyof typeof state] === value,
+                      )
+                    : Object.keys(state).length === 0
             setStatus(ok ? 'OK' : JSON.stringify(state))
         })
     }, [])
@@ -208,7 +215,11 @@ function CacheLimitsCase() {
             <CaseStatus
                 id="smoke-cache-limits"
                 status={status}
-                description="configureCache reports the limits the Expo config plugin set"
+                description={
+                    Platform.OS === 'ios'
+                        ? 'configureCache reports the limits the Expo config plugin set'
+                        : "configureCache reports no disk size limit (the app's AppGlideModule is expo-image's)"
+                }
             />
         </View>
     )
@@ -258,6 +269,222 @@ function SizesCase() {
     )
 }
 
+// FastImage's Glide components, which it registers itself on Android when
+// the app's AppGlideModule isn't its own (expo-image's, in the Expo example):
+// onProgress, `cache: 'web'`, writeToCache and SVG images.
+function ProgressCase() {
+    const [status, setStatus] = useState('loading')
+    const last = useRef<string>(undefined)
+    return (
+        <View style={styles.row}>
+            <FastImage
+                style={styles.image}
+                source={{
+                    uri: imageUrl(
+                        `picsum/1025-200x200.jpg?smoke-progress=${RUN}`,
+                    ),
+                }}
+                onProgress={(e) => {
+                    last.current = `${e.nativeEvent.loaded}/${e.nativeEvent.total}`
+                }}
+                onLoad={() => {
+                    const [loaded, total] = (last.current ?? '').split('/')
+                    setStatus(
+                        last.current && loaded === total
+                            ? 'OK'
+                            : `onProgress ${last.current ?? 'not sent'}`,
+                    )
+                }}
+            />
+            <CaseStatus
+                id="smoke-progress"
+                status={status}
+                description="onProgress comes before onLoad, ending with all of it loaded"
+            />
+        </View>
+    )
+}
+
+// Loaded twice from a url the server marks as cacheable: requested once, if
+// the second load came from the HTTP cache of `cache: 'web'` images.
+const WEB_PATH = `/max-age/picsum/1025-200x200.jpg?smoke-web=${RUN}`
+function WebCacheCase() {
+    const [loads, setLoads] = useState(0)
+    const [status, setStatus] = useState('loading')
+    useEffect(() => {
+        if (loads !== 2) return
+        fetch(imageUrl(`requests?path=${encodeURIComponent(WEB_PATH)}`))
+            .then((response) => response.json())
+            .then((json: { count: number }) =>
+                setStatus(
+                    json.count === 1 ? 'OK' : `requested ${json.count} times`,
+                ),
+            )
+            .catch((e) => setStatus(`error: ${e}`))
+    }, [loads])
+    return (
+        <View style={styles.row}>
+            {loads < 2 
```

**File**: `ReactNativeFastImageExampleExpo/App.tsx` (modified, +45/-5)
```diff
@@ -1,14 +1,54 @@
 import React, { useEffect, useState } from 'react'
-import { ScrollView, StyleSheet, Text } from 'react-native'
+import { ScrollView, StyleSheet, Text, View } from 'react-native'
 import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
 // The runner and cases are shared with the main example app.
 import RegressionRunner, {
     runnerWanted,
 } from '../ReactNativeFastImageExample/src/RegressionRunner'
 import { SMOKE_GROUPS } from '../ReactNativeFastImageExample/src/SmokeExample'
+import {
+    CaseStatus,
+    caseStyles,
+} from '../ReactNativeFastImageExample/src/CaseStatus'
+import { imageUrl } from '../ReactNativeFastImageExample/src/imageServer'
+import type { RegressionGroup } from '../ReactNativeFastImageExample/src/RunnerContext'
+import { Image as ExpoImage } from 'expo-image'
 
-// FastImage in an Expo app (iOS, Android and the web): the smoke cases, run by
-// scripts/verify.mts with `--app expo`, or shown for a look by hand.
+// Busts the image caches between runs.
+const RUN = Date.now()
+
+// expo-image in the same app: on Android, both use Glide, with expo-image's
+// AppGlideModule (FastImage leaves its own out), so its images still load
+// with its own setup.
+function ExpoImageCase() {
+    const [status, setStatus] = useState('loading')
+    return (
+        <View style={caseStyles.row}>
+            <ExpoImage
+                style={caseStyles.image}
+                source={{
+                    uri: imageUrl(`picsum/1020-120x120.jpg?expo-image=${RUN}`),
+                }}
+                onLoad={() => setStatus('OK')}
+                onError={(e) => setStatus(`error: ${e.error}`)}
+            />
+            <CaseStatus
+                id="expo-image"
+                status={status}
+                description="expo-image's Image loads, in the same app as FastImage"
+            />
+        </View>
+    )
+}
+
+const GROUPS: RegressionGroup[] = [
+    ...SMOKE_GROUPS,
+    { name: 'expo-image', cases: [<ExpoImageCase key="expo-image" />] },
+]
+
+// FastImage in an Expo app (iOS, Android and the web), next to expo-image:
+// the smoke cases, run by scripts/verify.mts with `--app expo`, or shown for
+// a look by hand.
 export default function App() {
     // undefined until known, so the cases don't start when the runner is
     // wanted.
@@ -17,13 +57,13 @@ export default function App() {
         runnerWanted().then(setRunner)
     }, [])
     if (runner === undefined) return null
-    if (runner) return <RegressionRunner groups={SMOKE_GROUPS} />
+    if (runner) return <RegressionRunner groups={GROUPS} />
     return (
         <SafeAreaProvider>
             <SafeAreaView style={styles.screen}>
                 <ScrollView contentContainerStyle={styles.content}>
                     <Text style={styles.title}>FastImage in an Expo app</Text>
-                    {SMOKE_GROUPS.flatMap((group) => group.cases)}
+                    {GROUPS.flatMap((group) => group.cases)}
                 </ScrollView>
             </SafeAreaView>
         </SafeAreaProvider>
```

**File**: `ReactNativeFastImageExampleExpo/bun.lock` (modified, +5/-0)
```diff
@@ -7,6 +7,7 @@
       "dependencies": {
         "@expo/metro-runtime": "~57.0.16",
         "expo": "~57.0.26",
+        "expo-image": "~57.0.5",
         "react": "19.2.3",
         "react-dom": "19.2.3",
         "react-native": "0.86.3",
@@ -432,6 +433,8 @@
 
     "expo-font": ["expo-font@57.0.4", "", { "dependencies": { "fontfaceobserver": "^2.1.0" }, "peerDependencies": { "expo": "*", "react": "*", "react-native": "*" } }, "sha512-7WOMC2oA6xCfOm8bbofqWn2bIqyWFm7YLEnpc/gA1MJH0Ll0TfT/3+CqRkoW2eNRWMS8sxrz5WukUmSvmNquHA=="],
 
+    "expo-image": ["expo-image@57.0.5", "", { "dependencies": { "sf-symbols-typescript": "^2.2.0" }, "peerDependencies": { "expo": "*", "react": "*", "react-native": "*", "react-native-web": "*" }, "optionalPeers": ["react-native-web"] }, "sha512-jOm5lofaIKXhQ7i0Hz3I5JuNULw/aghmpIPZXddwQcEtw8+wUhlozq3M7LbsOrcsBEapcG4jFs85DsfuFoz1tQ=="],
+
     "expo-keep-awake": ["expo-keep-awake@57.0.2", "", { "peerDependencies": { "expo": "*", "react": "*" } }, "sha512-GqgH746wtJImmsbyHmCQoi7cOslKuWQBbJHXr53S35Bpf5UvxCAztvnitUEd7D0QvFN2rvkOhylbZpgZZfBLlQ=="],
 
     "expo-modules-autolinking": ["expo-modules-autolinking@57.0.13", "", { "dependencies": { "@expo/require-utils": "^57.0.5", "@expo/spawn-async": "^1.8.0", "chalk": "^4.1.0", "commander": "^7.2.0" }, "bin": { "expo-modules-autolinking": "bin/expo-modules-autolinking.js" } }, "sha512-Hj5NjZRlfccazhKab+wK19leRVUr1Y/PUERaRvegIbUSkq4GVxKq6lU9QHlKQyC16MdD/VS4iwsiLivB4o7lvQ=="],
@@ -756,6 +759,8 @@
 
     "setprototypeof": ["setprototypeof@1.2.0", "", {}, "sha512-E5LDX7Wrp85Kil5bhZv46j8jOeboKq5JMmYM3gVGdGH8xFpPWXUMsNrlODCrkoxMEeNi/XZIwuRvY4XNwYMJpw=="],
 
+    "sf-symbols-typescript": ["sf-symbols-typescript@2.2.0", "", {}, "sha512-TPbeg0b7ylrswdGCji8FRGFAKuqbpQlLbL8SOle3j1iHSs5Ob5mhvMAxWN2UItOjgALAB5Zp3fmMfj8mbWvXKw=="],
+
     "shebang-command": ["shebang-command@2.0.0", "", { "dependencies": { "shebang-regex": "^3.0.0" } }, "sha512-kHxr2zZpYtdmrN1qDjrrX/Z1rR1kG8Dx+gkpK1G4eXmvXswmcE1hTWBWYUzlraYw1/yZp6YuDY77YtvbN0dmDA=="],
 
     "shebang-regex": ["shebang-regex@3.0.0", "", {}, "sha512-7++dFhtcx3353uBaq8DDR4NuxBetBzC7ZQOhmTQInHEd6bSrXdiEyzCvG07Z44UYdLShWUyXt5M/yhz8ekcb1A=="],
```

**File**: `ReactNativeFastImageExampleExpo/package.json` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@
     "dependencies": {
         "@expo/metro-runtime": "~57.0.16",
         "expo": "~57.0.26",
+        "expo-image": "~57.0.5",
         "react": "19.2.3",
         "react-dom": "19.2.3",
         "react-native": "0.86.3",
```

**File**: `android/build.gradle` (modified, +13/-1)
```diff
@@ -19,6 +19,18 @@ buildscript {
 
 apply plugin: 'com.android.library'
 
+// Whether the app has expo-image (in a node_modules folder above the app's
+// android folder, as Node finds it), which ships its own AppGlideModule.
+def appHasExpoImage = {
+    for (def dir = rootProject.projectDir; dir != null; dir = dir.parentFile) {
+        if (new File(dir, "node_modules/expo-image/package.json").isFile()) return true
+    }
+    return false
+}
+// An app has one AppGlideModule: with expo-image, FastImage's is left out,
+// and FastImage registers its Glide components itself (FastImageGlide).
+def excludeAppGlideModule = safeExtGet('excludeAppGlideModule', appHasExpoImage())
+
 // When changing the default, revisit the Glide rules in consumer-rules.pro.
 // 4.15+ animates animated WebP (Android 9+) and AVIF (Android 12+).
 def glideVersion = safeExtGet('glideVersion', '4.16.0')
@@ -56,7 +68,7 @@ android {
             }
             java {
                 srcDir glideHasAnimatedDecoder ? "src/glide-4.15/java" : "src/glide-older/java"
-                if (safeExtGet('excludeAppGlideModule', false)) {
+                if (excludeAppGlideModule) {
                     srcDir "src"
                     exclude "**/FastImageGlideModule.java"
                     // Only the one chosen above.
```

**File**: `android/src/glide-4.15/java/com/dylanvann/fastimage/FastImageAnimated.java` (modified, +2/-2)
```diff
@@ -194,7 +194,7 @@ private static final class ByteBufferDecoder implements ResourceDecoder<ByteBuff
 
         @Override
         public boolean handles(@NonNull ByteBuffer source, @NonNull Options options) throws IOException {
-            return glide.handles(source, options);
+            return FastImageGlide.isRequest(options) && glide.handles(source, options);
         }
 
         @Nullable
@@ -229,7 +229,7 @@ private static final class StreamDecoder implements ResourceDecoder<InputStream,
 
         @Override
         public boolean handles(@NonNull InputStream source, @NonNull Options options) throws IOException {
-            return glide.handles(source, options);
+            return FastImageGlide.isRequest(options) && glide.handles(source, options);
         }
 
         // Read whole, as Glide's own does.
```

---

### Incident Patch 7: `19db3721` (2026-10-04)
**Commit Message**: fix(android): show a paused APNG's first frame (#1237)

Before the first frame has been rendered, setPaused(true) only records the pause, and onStart pauses the decoder right after the first render: APNG4Android's decoder clears its paused flag when it starts, then skips rendering if a pause came in meanwhile, which left a paused APNG blank.

**File**: `android/src/main/java/com/dylanvann/fastimage/FastImageApngRenderer.java` (modified, +12/-1)
```diff
@@ -87,6 +87,8 @@ private static final class ApngDrawable extends APNGDrawable implements FastImag
         // How many times the file says it plays (0: forever).
         private final int plays;
         private volatile boolean paused = false;
+        // Once a frame has been rendered (on the decoder's thread).
+        private volatile boolean rendered = false;
 
         ApngDrawable(Loader loader, int plays) {
             super(loader);
@@ -110,7 +112,10 @@ public void setPaused(boolean paused) {
             // while paused.
             setAutoPlay(!paused);
             if (paused) {
-                pause();
+                // Before the first frame, onStart pauses once it's rendered:
+                // the decoder's start clears a pause, then skips rendering if
+                // one came in meanwhile, which left the view blank.
+                if (rendered) pause();
             } else {
                 resume();
             }
@@ -130,6 +135,12 @@ public void start() {
             super.start();
         }
 
+        @Override
+        public void onRender(ByteBuffer byteBuffer) {
+            super.onRender(byteBuffer);
+            rendered = true;
+        }
+
         // On its decoder thread, once starting has drawn the first frame:
         // starting clears a pause made before it got there, so pause again.
         @Override
```

---

### Incident Patch 8: `66a5f0e3` (2026-10-04)
**Commit Message**: fix(android): download an image once when a view loads it while it's being preloaded (#1231)

* fix(android): download an image once when a view loads it while it's being preloaded

Glide only shares work between requests for the same size, and a
preload loads the original size, so a view mounted during a preload
downloaded the image again. A preload of a remote image now downloads
it to the disk cache first, then decodes it; while it downloads, and
for a minute after, a view's download of the same url waits for it and
reads its file. getCachePath's downloads aren't shared.

* fix(android): wait for a preload's download without holding a thread

A view's fetch returned only once the preload had finished, holding one
of Glide's few network threads meanwhile, which a download doesn't (OkHttp
runs it asynchronously). It now registers and returns, and goes on (off
the main thread) when the preload has finished.

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +20/-5)
```diff
@@ -3362,12 +3362,27 @@ const PRELOADING = {
 function DownsamplePreloadingCase() {
     const [size, setSize] = useState<string>()
     const [requests, setRequests] = useState<number>()
-    // The view loads once the preload has started downloading.
+    // The view loads once the server has the preload's request, so it
+    // mounts while the preload is downloading (a preload that hasn't started
+    // isn't waited for).
     const [shown, setShown] = useState(false)
     useEffect(() => {
+        let cancelled = false
         FastImage.preload([PRELOADING])
-        const t = setTimeout(() => setShown(true), 300)
-        return () => clearTimeout(t)
+        ;(async () => {
+            for (let i = 0; i < 100 && !cancelled; i++) {
+                const response = await fetch(
+                    imageUrl(`requests?group=${PRELOADING_GROUP}`),
+                ).catch(() => undefined)
+                const count = (await response?.json())?.count ?? 0
+                if (count > 0) break
+                await new Promise<void>((r) => setTimeout(r, 50))
+            }
+            if (!cancelled) setShown(true)
+        })()
+        return () => {
+            cancelled = true
+        }
     }, [])
     return (
         <View style={styles.row}>
@@ -3396,11 +3411,11 @@ function DownsamplePreloadingCase() {
                         ? 'waiting'
                         : size !== '1600x1000'
                           ? `${size}, expected 1600x1000`
-                          : Platform.OS === 'ios' && requests !== 1
+                          : requests !== 1
                             ? `requested ${requests} times`
                             : 'OK'
                 }
-                description="downsample: an image that's still being preloaded is downloaded once (iOS), and cropped to cover the view, not stretched; onLoad reports its full size"
+                description="downsample: an image that's still being preloaded is downloaded once, and cropped to cover the view, not stretched; onLoad reports its full size"
             />
         </View>
     )
```

**File**: `android/src/main/java/com/dylanvann/fastimage/FastImageOkHttpProgressGlideModule.java` (modified, +4/-1)
```diff
@@ -158,7 +158,10 @@ public ModelLoader<GlideUrl, InputStream> build(@NonNull MultiModelLoaderFactory
             return new ModelLoader<GlideUrl, InputStream>() {
                 @Override
                 public LoadData<InputStream> buildLoadData(@NonNull GlideUrl model, int width, int height, @NonNull Options options) {
-                    return loader.buildLoadData(model, width, height, options);
+                    LoadData<InputStream> data = loader.buildLoadData(model, width, height, options);
+                    // A view loading an image that's being preloaded waits
+                    // for the preload's download.
+                    return data == null ? null : FastImageSharedDownloads.share(data, model, options);
                 }
 
                 @Override
```

**File**: `android/src/main/java/com/dylanvann/fastimage/FastImageSharedDownloads.java` (added, +292/-0)
```diff
@@ -0,0 +1,292 @@
+package com.dylanvann.fastimage;
+
+import androidx.annotation.NonNull;
+import androidx.annotation.Nullable;
+
+import com.bumptech.glide.Priority;
+import com.bumptech.glide.load.DataSource;
+import com.bumptech.glide.load.Option;
+import com.bumptech.glide.load.Options;
+import com.bumptech.glide.load.data.DataFetcher;
+import com.bumptech.glide.load.model.GlideUrl;
+import com.bumptech.glide.load.model.ModelLoader;
+
+import java.io.File;
+import java.io.FileInputStream;
+import java.io.IOException;
+import java.io.InputStream;
+import java.util.ArrayList;
+import java.util.List;
+import java.util.Map;
+import java.util.concurrent.ConcurrentHashMap;
+import java.util.concurrent.Executors;
+import java.util.concurrent.ScheduledExecutorService;
+import java.util.concurrent.ThreadFactory;
+import java.util.concurrent.TimeUnit;
+import java.util.concurrent.atomic.AtomicBoolean;
+
+// Lets a view load an image that a preload is downloading from the preload's
+// file, instead of downloading it again. Glide only shares a download between
+// requests for the same size (and a preload loads the original size), so a
+// view mounted while its image was being preloaded downloaded it a second
+// time. A preload's download registers here once it has started (not while
+// it's queued); a view's download of the same url then waits for the
+// preload's file and reads it, and downloads as usual if the preload fails.
+// The wait holds no thread: the view's fetch returns, and goes on when the
+// preload has finished, as an OkHttp download does. A finished download stays
+// for a while: a view's request that looked in the disk cache before the
+// preload stored the file, and gets to downloading after, reads it too.
+final class FastImageSharedDownloads {
+    // Set on a preload's request (see FastImageViewModule.loadFile).
+    static final Option<Boolean> PRELOAD = Option.memory("com.dylanvann.fastimage.Preload", false);
+
+    // The longest a view waits for a preload's download, before downloading
+    // the image itself.
+    private static final long WAIT_MS = 30_000;
+    // How long a finished download's file is used.
+    private static final long KEEP_MS = 60_000;
+
+    // Goes on with waiting views (opening the file, or starting their own
+    // download), off the main thread, where preloads finish.
+    private static final ScheduledExecutorService executor =
+            Executors.newSingleThreadScheduledExecutor(new ThreadFactory() {
+                @Override
+                public Thread newThread(@NonNull Runnable runnable) {
+                    Thread thread = new Thread(runnable, "FastImageSharedDownloads");
+                    thread.setDaemon(true);
+                    return thread;
+                }
+            });
+
+    // A view's fetch waiting for a download. It goes on once: with the file,
+    // or without it (the preload failed, or took too long).
+    private static final class Waiter {
+        private final Fetcher fetcher;
+        private final Priority priority;
+        private final DataFetcher.DataCallback<? super InputStream> callback;
+        private final AtomicBoolean went = new AtomicBoolean();
+
+        Waiter(Fetcher fetcher, Priority priority, DataFetcher.DataCallback<? super InputStream> callback) {
+            this.fetcher = fetcher;
+            this.priority = priority;
+            this.callback = callback;
+        }
+
+        void go(@Nullable File file) {
+            if (went.compareAndSet(false, true)) fetcher.resume(file, priority, callback);
+        }
+
+        // Cancelled: never goes on.
+        void drop() {
+            went.set(true);
+        }
+    }
+
+    private static final class Download {
+        // Guarded by this.
+        private boolean done;
+        private final List<Waiter> waiters = new ArrayList<>();
+        @Nullable
+        volatile File file;
+        volatile long finishedAt;
+
+        synchronized boolean isDone() {
+            return done;
+        }
+
+        boolean isStale(long now) {
+            return isDone() && now - finishedAt > KEEP_MS;
+        }
+
+        void await(final Waiter waiter) {
+            synchronized (this) {
+                if (!done) {
+                    waiters.add(waiter);
+                    executor.schedule(new Runnable() {
+                        @Override
+                        public void run() {
+                            remove(waiter);
+                            waiter.go(null);
+                        }
+                    }, WAIT_MS, TimeUnit.MILLISECONDS);
+                    return;
+                }
+            }
+            goOn(waiter, file);
+        }
+
+        synchronized void remove(Waiter waiter) {
+            waiters.remove(waiter);
+        }
+
+        // Returns false if it had finished already.
+        boolean finish(@Nullable File file, long now) {
+            List<Waiter> waiting;
+            synchronized (
```

**File**: `android/src/main/java/com/dylanvann/fastimage/FastImageViewModule.java` (modified, +27/-5)
```diff
@@ -169,7 +169,7 @@ public void run(WritableMap result) {
                         pendingPreloads.add(new Runnable() {
                             @Override
                             public void run() {
-                                loadFile(context, imageSource.getSourceForLoad(), preloadOptions, new FileCallback() {
+                                loadFile(context, imageSource.getSourceForLoad(), preloadOptions, true, new FileCallback() {
                                     @Override
                                     public void run(@Nullable final File file, @Nullable String error) {
                                         if (file == null) {
@@ -196,7 +196,8 @@ public void run() {
                         });
                         continue;
                     }
-                    pendingPreloads.add(new Runnable() {
+                    // Decodes it into the memory cache.
+                    final Runnable decode = new Runnable() {
                         @Override
                         public void run() {
                             Glide
@@ -222,6 +223,22 @@ public boolean onResourceReady(Drawable resource, Object model, Target<Drawable>
                                     })
                                     .preload();
                         }
+                    };
+                    // A remote image is downloaded to the disk cache first,
+                    // so views that load it meanwhile can wait for the file
+                    // (FastImageSharedDownloads), then decoded from there.
+                    final boolean download = !imageSource.isWebCache() && imageSource.isRemote();
+                    pendingPreloads.add(!download ? decode : new Runnable() {
+                        @Override
+                        public void run() {
+                            loadFile(context, imageSource.getSourceForLoad(), preloadOptions, true, new FileCallback() {
+                                @Override
+                                public void run(@Nullable File file, @Nullable String error) {
+                                    if (file == null) done.run(failure(error));
+                                    else decode.run();
+                                }
+                            });
+                        }
                     });
                 }
                 if (count == 0) {
@@ -250,21 +267,26 @@ private interface FileCallback {
 
     // Downloads the image into Glide's disk cache without decoding it (if it
     // isn't there), then calls back with its file or the error, on the UI
-    // thread.
-    private static void loadFile(Context context, Object model, RequestOptions options, final FileCallback callback) {
+    // thread. For a preload (`shared`), views that load the image meanwhile
+    // wait for the download and read its file (FastImageSharedDownloads).
+    private static void loadFile(Context context, Object model, RequestOptions options, boolean shared, final FileCallback callback) {
+        final String key = shared && model instanceof GlideUrl ? ((GlideUrl) model).getCacheKey() : null;
         Glide.with(context)
                 .asFile()
                 .load(model)
                 .apply(options)
+                .set(FastImageSharedDownloads.PRELOAD, shared)
                 .listener(new RequestListener<File>() {
                     @Override
                     public boolean onLoadFailed(@Nullable GlideException e, Object model, Target<File> target, boolean isFirstResource) {
+                        if (key != null) FastImageSharedDownloads.finished(key, null);
                         callback.run(null, FastImageRequestListener.errorMessage(e));
                         return false;
                     }
 
                     @Override
                     public boolean onResourceReady(File file, Object model, Target<File> target, DataSource dataSource, boolean isFirstResource) {
+                        if (key != null) FastImageSharedDownloads.finished(key, file);
                         callback.run(file, null);
                         return false;
                     }
@@ -400,7 +422,7 @@ private static Runnable downloadToDiskCache(
         return new Runnable() {
             @Override
             public void run() {
-                loadFile(context, imageSource.getSourceForLoad(), options, new FileCallback() {
+                loadFile(context, imageSource.getSourceForLoad(), options, false, new FileCallback() {
                     @Override
                     public void run(@Nullable File file, @Nullable String error) {
                         finishDownload(promise, file != null ? pathResult(file) : failure(error));
```

---

### Incident Patch 9: `e16de532` (2026-10-02)
**Commit Message**: test: image format cases in the regression runner (#1221)

A case per image format (JPEG, PNG, GIF, WebP, AVIF, HEIC, BMP, ICO, TIFF):
whether it loads, at its size, with the screenshot showing it drawn right.
And per animated format (GIF, APNG, WebP, AVIF): whether it animates or shows
its first frame, from a video sample. The samples are made by
ReactNativeFastImageExampleServer/formats.sh.

They expect what FastImage does now (on iOS 27 and Android 16, both example
apps): every format loads except TIFF on Android; animated GIF animates, APNG
only on iOS, and animated WebP and AVIF show their first frame.

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +225/-0)
```diff
@@ -3840,6 +3840,130 @@ function SeveralSourcesEdgeCase() {
     )
 }
 
+// Image formats, for the README's table of them. The samples in the image
+// server's images/formats/ are the same picture in each format (red, green,
+// blue and yellow quadrants, 80x80), and the animated ones are red, then blue,
+// 400 ms each, looping. A case passes when the format does what `expected`
+// says on this platform, so a change in what's supported fails it (and the
+// table needs updating). Check the screenshot: four flat quadrants.
+type FormatResult = 'loads' | 'fails'
+function FormatCase({
+    id,
+    file,
+    expected,
+    description,
+}: {
+    id: string
+    file: string
+    expected: FormatResult
+    description: string
+}) {
+    const [status, setStatus] = useState('waiting')
+    return (
+        <View style={styles.row}>
+            <FastImage
+                style={styles.image}
+                resizeMode="contain"
+                source={{ uri: imageUrl(`formats/${file}`) }}
+                onLoad={(e) => {
+                    const { width, height } = e.nativeEvent
+                    setStatus(
+                        expected === 'fails'
+                            ? `loaded (${width}x${height}), expected it to fail`
+                            : width === 80 && height === 80
+                              ? 'OK'
+                              : `loaded at ${width}x${height}, expected 80x80`,
+                    )
+                }}
+                onError={(e) =>
+                    setStatus(
+                        expected === 'fails'
+                            ? 'OK'
+                            : `error: ${e.nativeEvent.error}`,
+                    )
+                }
+            />
+            <CaseStatus id={id} status={status} description={description} />
+        </View>
+    )
+}
+
+// An animated format: it animates (red and blue are both recorded), shows only
+// its first frame (red), or fails to load. It loops, so a recording can start
+// on either frame: what was seen is classified here rather than matched.
+type AnimationResult = 'animates' | 'first frame' | 'fails'
+function FormatAnimationCase({
+    id,
+    file,
+    expected,
+    description,
+}: {
+    id: string
+    file: string
+    expected: AnimationResult
+    description: string
+}) {
+    const sample = useContext(SampleContext)
+    const view = useRef<React.ComponentRef<typeof View>>(null)
+    const [status, setStatus] = useState('waiting')
+    const started = useRef(false)
+    const onLoad = async () => {
+        if (started.current) return
+        started.current = true
+        if (expected === 'fails')
+            return setStatus('loaded, expected it to fail')
+        const area = await measureView(view.current)
+        if (!area) return setStatus('not on screen')
+        setStatus('recording')
+        const result = await sample(
+            {
+                name: id,
+                area,
+                durationMs: 3000,
+                expect: [RED, BLUE],
+                palette: [RED, BLUE, BLANK],
+            },
+            // Two plays (0.8 s each).
+            (done) => setTimeout(done, 1600),
+        )
+        const { seen } = result
+        const got =
+            seen.includes(RED) && seen.includes(BLUE)
+                ? 'animates'
+                : seen.length === 1 && seen[0] === RED
+                  ? 'first frame'
+                  : (result.detail ?? `saw ${seen.join(', ') || 'nothing'}`)
+        setStatus(
+            got === expected
+                ? 'OK'
+                : got === 'animates' || got === 'first frame'
+                  ? `${got === 'animates' ? 'animates' : 'shows its first frame'}, expected: ${expected}`
+                  : got,
+        )
+    }
+    return (
+        <View style={styles.row}>
+            <Masked>
+                <View ref={view} collapsable={false}>
+                    <FastImage
+                        style={styles.image}
+                        source={{ uri: imageUrl(`formats/${file}`) }}
+                        onLoad={onLoad}
+                        onError={(e) =>
+                            setStatus(
+                                expected === 'fails'
+                                    ? 'OK'
+                                    : `error: ${e.nativeEvent.error}`,
+                            )
+                        }
+                    />
+                </View>
+            </Masked>
+            <CaseStatus id={id} status={status} description={description} />
+        </View>
+    )
+}
+
 // SVG images (the example apps have SDWebImageSVGCoder on iOS and AndroidSVG
 // on Android: the main app's androidsvg-aar package, the legacy app's
 // androidsvg). onLoad has the SVG's own size (its width and height, or its
@@ -4669,6 +4793,107 @@ export const REGRESSION_GROUPS: RegressionGroup[] = [
         name: 'image-background',
         cases: [<ImageBackgroundCase 
```

**File**: `ReactNativeFastImageExampleServer/formats.sh` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+#!/usr/bin/env bash
+# Makes the image format samples in images/formats/ (the formats cases in
+# RegressionExample.tsx): the same picture in each format (red, green, blue and
+# yellow quadrants, 80x80), and an animation (red, then blue, 400 ms each,
+# looping) in each animated format. They're committed, so this only needs to
+# run to add a format.
+#
+#   bash ReactNativeFastImageExampleServer/formats.sh
+#
+# Needs ImageMagick, libwebp (cwebp, img2webp), libavif (avifenc) and libheif
+# (heif-enc): `brew install imagemagick webp libavif libheif`.
+set -euo pipefail
+OUT="$(cd "$(dirname "$0")" && pwd)/images/formats"
+TMP="$(mktemp -d)"
+trap 'rm -rf "$TMP"' EXIT
+mkdir -p "$OUT"
+cd "$OUT"
+
+magick -size 40x40 xc:'#ff0000' xc:'#00c000' +append "$TMP/top.png"
+magick -size 40x40 xc:'#0000ff' xc:'#ffd000' +append "$TMP/bottom.png"
+# No timestamps in the files, so they come out the same every time.
+magick "$TMP/top.png" "$TMP/bottom.png" -append -define png:exclude-chunks=date,time "$TMP/quadrants.png"
+cp "$TMP/quadrants.png" quadrants.png
+magick "$TMP/quadrants.png" -quality 92 quadrants.jpg
+magick "$TMP/quadrants.png" quadrants.gif
+cwebp -quiet -q 92 "$TMP/quadrants.png" -o quadrants.webp
+avifenc -q 90 "$TMP/quadrants.png" quadrants.avif > /dev/null
+heif-enc -q 90 "$TMP/quadrants.png" -o quadrants.heic > /dev/null
+magick "$TMP/quadrants.png" BMP3:quadrants.bmp
+magick "$TMP/quadrants.png" quadrants.ico
+magick "$TMP/quadrants.png" -compress none quadrants.tiff
+
+magick -size 80x80 xc:'#ff0000' "$TMP/red.png"
+magick -size 80x80 xc:'#0000ff' "$TMP/blue.png"
+magick -delay 40 "$TMP/red.png" "$TMP/blue.png" -loop 0 animated.gif
+magick -delay 40 "$TMP/red.png" "$TMP/blue.png" -loop 0 APNG:animated.png
+img2webp -loop 0 -lossless -d 400 "$TMP/red.png" "$TMP/blue.png" -o animated.webp > /dev/null 2>&1
+avifenc --timescale 10 --duration 4 --repetition-count infinite -q 90 \
+    --creation-time 1 --modification-time 1 \
+    "$TMP/red.png" "$TMP/blue.png" -o animated.avif > /dev/null
+chmod 644 ./*
```

---

### Incident Patch 10: `5fe7667c` (2026-10-02)
**Commit Message**: fix(android): only send progress events for images with onProgress (#1225)

FastImage sent a progress event to JS for every chunk of every image it
downloaded, and JS dropped those of images without an onProgress. It
now passes an internal trackProgress prop, and the view manager only
sends progress to the views that have it. iOS, which already only
tracked progress with a handler, checks the same prop.

**File**: `android/src/main/java/com/dylanvann/fastimage/FastImageViewManager.java` (modified, +10/-0)
```diff
@@ -131,6 +131,12 @@ public void setPaused(FastImageViewWithUrl view, boolean paused) {
         view.setPaused(paused);
     }
 
+    // Set when the image has an onProgress (see onProgress).
+    @ReactProp(name = "trackProgress")
+    public void setTrackProgress(FastImageViewWithUrl view, boolean trackProgress) {
+        view.trackProgress = trackProgress;
+    }
+
     @ReactProp(name = "resizeMode")
     public void setResizeMode(FastImageViewWithUrl view, String resizeMode) {
         // repeat fills the view with the tiled image (see setImageDrawable).
@@ -163,11 +169,15 @@ public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
                 .build();
     }
 
+    // Sends the progress to the views loading the url that have an onProgress:
+    // the others would send an event to JS for every chunk, for nothing (and
+    // on the New Architecture each would log an unhandled event).
     @Override
     public void onProgress(String key, long bytesRead, long expectedLength) {
         List<FastImageViewWithUrl> viewsForKey = VIEWS_FOR_URLS.get(key);
         if (viewsForKey != null) {
             for (FastImageViewWithUrl view : viewsForKey) {
+                if (!view.trackProgress) continue;
                 WritableMap event = new WritableNativeMap();
                 event.putInt("loaded", (int) bytesRead);
                 event.putInt("total", (int) expectedLength);
```

**File**: `android/src/main/java/com/dylanvann/fastimage/FastImageViewWithUrl.java` (modified, +2/-0)
```diff
@@ -183,6 +183,8 @@ public void setLoopCount(int loopCount) {
 
     // Pauses GIFs on the frame they're showing (the view's own animation).
     private boolean mPaused = false;
+    // Whether to send progress events (the image has an onProgress).
+    boolean trackProgress = false;
 
     // The `transition` prop (from the next load): how long a loaded image
     // takes to fade in, in milliseconds (0 for no fade), whether it also fades
```

**File**: `ios/FastImage/FFFastImageView.h` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@
 
 @property (nonatomic, copy) RCTDirectEventBlock onFastImageLoadStart;
 @property (nonatomic, copy) RCTDirectEventBlock onFastImageProgress;
+// Whether to send progress events (the image has an onProgress).
+@property (nonatomic, assign) BOOL trackProgress;
 @property (nonatomic, copy) RCTDirectEventBlock onFastImageError;
 @property (nonatomic, copy) RCTDirectEventBlock onFastImageLoad;
 @property (nonatomic, copy) RCTDirectEventBlock onFastImageLoadEnd;
```

**File**: `ios/FastImage/FFFastImageView.m` (modified, +1/-1)
```diff
@@ -1036,7 +1036,7 @@ - (void) downloadImage: (FFFastImageSource*)source options: (SDWebImageOptions)o
     // there's a handler as the load starts. A handler added while loading is
     // used from the next load.
     SDImageLoaderProgressBlock progress = nil;
-    if (events && self.onFastImageProgress) {
+    if (events && self.trackProgress && self.onFastImageProgress) {
         progress = ^(NSInteger receivedSize, NSInteger expectedSize, NSURL* _Nullable targetURL) {
             // Without a Content-Length the total is unknown (-1 or 0), and a
             // percentage can't be worked out from it, so don't send those.
```

**File**: `ios/FastImage/FFFastImageViewManager.m` (modified, +1/-0)
```diff
@@ -114,6 +114,7 @@ - (FFFastImageView*)view {
 RCT_EXPORT_VIEW_PROPERTY(transitionSkipOnCacheHit, NSString)
 RCT_EXPORT_VIEW_PROPERTY(downsample, BOOL)
 RCT_EXPORT_VIEW_PROPERTY(blurRadius, CGFloat)
+RCT_EXPORT_VIEW_PROPERTY(trackProgress, BOOL)
 RCT_EXPORT_VIEW_PROPERTY(onFastImageLoadStart, RCTDirectEventBlock)
 RCT_EXPORT_VIEW_PROPERTY(onFastImageProgress, RCTDirectEventBlock)
 RCT_EXPORT_VIEW_PROPERTY(onFastImageError, RCTDirectEventBlock)
```

**File**: `src/__snapshots__/index.test.tsx.snap` (modified, +6/-0)
```diff
@@ -36,6 +36,7 @@ exports[`FastImage (iOS) renders 1`] = `
         "top": 0,
       }
     }
+    trackProgress={false}
     transitionBetweenImages={false}
     transitionDuration={0}
     transitionSkipOnCacheHit="memory"
@@ -75,6 +76,7 @@ exports[`FastImage (iOS) renders a normal Image when not passed a uri 1`] = `
         "top": 0,
       }
     }
+    trackProgress={false}
     transitionBetweenImages={false}
     transitionDuration={0}
     transitionSkipOnCacheHit="memory"
@@ -153,6 +155,7 @@ exports[`FastImage (iOS) renders defaultSource 1`] = `
         "top": 0,
       }
     }
+    trackProgress={false}
     transitionBetweenImages={false}
     transitionDuration={0}
     transitionSkipOnCacheHit="memory"
@@ -187,6 +190,7 @@ exports[`FastImage (Android) renders a normal defaultSource 1`] = `
         "top": 0,
       }
     }
+    trackProgress={false}
     transitionBetweenImages={false}
     transitionDuration={0}
     transitionSkipOnCacheHit="memory"
@@ -225,6 +229,7 @@ exports[`FastImage (Android) renders a normal defaultSource when fails to load s
         "top": 0,
       }
     }
+    trackProgress={false}
     transitionBetweenImages={false}
     transitionDuration={0}
     transitionSkipOnCacheHit="memory"
@@ -260,6 +265,7 @@ exports[`FastImage (Android) renders a non-existing defaultSource 1`] = `
         "top": 0,
       }
     }
+    trackProgress={false}
     transitionBetweenImages={false}
     transitionDuration={0}
     transitionSkipOnCacheHit="memory"
```

**File**: `src/index.test.tsx` (modified, +13/-0)
```diff
@@ -404,6 +404,19 @@ describe('onProgress', () => {
         image.props.onProgress({ nativeEvent: { loaded: 30, total: 40 } })
         expect(progress).toEqual([0, 0.75])
     })
+
+    it('asks the native view for progress events only with onProgress', () => {
+        const trackProgress = (element: React.ReactElement) =>
+            renderer
+                .create(element)
+                .root.findAll(
+                    (node) => node.type === ('FastImageView' as any),
+                )[0].props.trackProgress
+        expect(trackProgress(<FastImage source={source} />)).toBe(false)
+        expect(
+            trackProgress(<FastImage source={source} onProgress={() => {}} />),
+        ).toBe(true)
+    })
 })
 
 describe('source.memoryCache', () => {
```

**File**: `src/index.tsx` (modified, +4/-0)
```diff
@@ -527,6 +527,9 @@ function FastImageBase({
                 defaultSource={resolvedDefaultSource}
                 onFastImageLoadStart={onLoadStart}
                 onFastImageProgress={withProgress(onProgress)}
+                // The native views only send progress events with this, so
+                // images without onProgress don't send one for every chunk.
+                trackProgress={!!onProgress}
                 onFastImageLoad={onLoad}
                 onFastImageError={onError}
                 onFastImageLoadEnd={
@@ -763,6 +766,7 @@ const FastImageView = (requireNativeComponent as any)(
             onFastImageLoad: true,
             onFastImageError: true,
             onFastImageLoadEnd: true,
+            trackProgress: true,
         },
     },
 )
```

---

### Incident Patch 11: `28eafc45` (2026-10-01)
**Commit Message**: fix(ios): share a download between downsampled and full-size loads (#1217)

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +23/-12)
```diff
@@ -3231,16 +3231,21 @@ function DownsampleNoSizeCase() {
 }
 
 // A downsampled view of an image that's still being preloaded (from the slow
-// server, about a second here; the view loads 300 ms after the preload): the view's image is decoded to cover it
-// (cropped, not stretched to the view's shape), and onLoad reports the full
-// size. SDWebImage shares a download between loads of the same url, and
-// decoded the view's image as the preload asked.
+// server, about a second here; the view loads 300 ms after the preload): on
+// iOS it shares the preload's download (one request; it downloaded it again),
+// its image is decoded to cover it (cropped, not stretched to the view's
+// shape), and onLoad reports the full size. SDWebImage decodes each load of a
+// download with the first load's image class. Android (Glide) downloads it
+// again for the view, which has another size, so the requests aren't checked
+// there.
+const PRELOADING_GROUP = `downsample-preloading-${RUN}`
 const PRELOADING = {
-    uri: slowImageUrl(`text-page.png?delay=120&preloading=${RUN}`),
+    uri: slowImageUrl(`text-page.png?delay=120&group=${PRELOADING_GROUP}`),
     headers: { 'x-token': 'fast-image' },
 }
 function DownsamplePreloadingCase() {
     const [size, setSize] = useState<string>()
+    const [requests, setRequests] = useState<number>()
     // The view loads once the preload has started downloading.
     const [shown, setShown] = useState(false)
     useEffect(() => {
@@ -3255,25 +3260,31 @@ function DownsamplePreloadingCase() {
                     style={downsampleStyles.tall}
                     source={PRELOADING}
                     downsample
-                    onLoad={(e) =>
+                    onLoad={(e) => {
                         setSize(
                             `${e.nativeEvent.width}x${e.nativeEvent.height}`,
                         )
-                    }
+                        fetch(imageUrl(`requests?group=${PRELOADING_GROUP}`))
+                            .then((response) => response.json())
+                            .then((json) => setRequests(json.count))
+                            .catch(() => setRequests(-1))
+                    }}
                 />
             ) : (
                 <View style={downsampleStyles.tall} />
             )}
             <CaseStatus
                 id="downsample-preloading"
                 status={
-                    size === undefined
+                    size === undefined || requests === undefined
                         ? 'waiting'
-                        : size === '1600x1000'
-                          ? 'OK'
-                          : `${size}, expected 1600x1000`
+                        : size !== '1600x1000'
+                          ? `${size}, expected 1600x1000`
+                          : Platform.OS === 'ios' && requests !== 1
+                            ? `requested ${requests} times`
+                            : 'OK'
                 }
-                description="downsample: an image that's still being preloaded is cropped to cover the view, not stretched; onLoad reports its full size"
+                description="downsample: an image that's still being preloaded is downloaded once (iOS), and cropped to cover the view, not stretched; onLoad reports its full size"
             />
         </View>
     )
```

**File**: `ios/FastImage/FFFDownsampledImage.h` (modified, +9/-5)
```diff
@@ -10,12 +10,16 @@
 // the image's header before it decodes, as React Native's Image does.
 @interface FFFDownsampledImage : SDAnimatedImage
 
-// The url to load a source's url with, when it's downsampled.
-+ (NSURL*) loadURLForURL: (NSURL*)url;
-
 // Sets a load's context to decode the image for a box (in pixels) to cover
-// or fit in. `key` is the source's cache key (its url, or its cacheKey).
-+ (void) addToContext: (SDWebImageMutableContext*)context forKey: (NSString*)key box: (CGSize)box cover: (BOOL)cover;
+// or fit in.
++ (void) addToContext: (SDWebImageMutableContext*)context box: (CGSize)box cover: (BOOL)cover;
+
+// Sets a load's context to decode the image at full size, through this class
+// when it's supported. Every FastImage load uses it, so loads of the same url
+// can share a download: SDWebImage's downloader decodes each load of a
+// download with the first load's image class (and each with its own size),
+// and SDWebImage's own thumbnail decoding can't cover a box.
++ (void) addFullSizeToContext: (SDWebImageMutableContext*)context;
 
 // The size of the full image (in points, like UIImage's size) that an image
 // loaded this way was decoded from, for onLoad, or zero for other images.
```

**File**: `ios/FastImage/FFFDownsampledImage.m` (modified, +10/-32)
```diff
@@ -2,15 +2,12 @@
 #import <ImageIO/ImageIO.h>
 #import <SDWebImage/SDImageCoder.h>
 #import <SDWebImage/SDImageCacheDefine.h>
-#import <SDWebImage/SDWebImageCacheKeyFilter.h>
 #import <SDWebImage/UIImage+Metadata.h>
 #import <SDWebImage/NSData+ImageContentType.h>
 #import <SDWebImage/SDImageCodersManager.h>
 
 // The decode option that carries the full image's size to the view.
 static SDImageCoderOption const FFFDecodeSourceSize = @"FFFDecodeSourceSize";
-// Added to the url's fragment, which isn't sent to the server.
-static NSString* const FFFDownsampledFragment = @"fastimage-downsampled";
 
 // The image's size in pixels as it's shown (EXIF orientations 5 to 8 turn it
 // sideways), from its header, or zero if ImageIO can't read it.
@@ -85,39 +82,20 @@ + (BOOL) isSupported {
     return supported;
 }
 
-+ (NSURL*) loadURLForURL: (NSURL*)url {
-    // SDWebImage's downloader shares a download between loads of the same
-    // url, and decodes each load's image with the first load's image class.
-    // After a load that isn't downsampled (e.g. a preload), this class
-    // wouldn't be used, and the box would be decoded as SDWebImage does (to
-    // fill it, stretched). With its own url, a downsampled load only shares
-    // downloads with other downsampled ones. Not a photo library url, which
-    // isn't downloaded, and whose loader reads everything after ph:// as the
-    // photo's identifier. No url (a source whose uri isn't one), which fails
-    // as it does without downsample (NSURLComponents throws for nil).
-    if (!url || [url.scheme isEqualToString: @"ph"]) {
-        return url;
++ (void) addFullSizeToContext: (SDWebImageMutableContext*)context {
+    if (![self isSupported]) {
+        context[SDWebImageContextAnimatedImageClass] = [SDAnimatedImage class];
+        return;
     }
-    NSURLComponents* components = [NSURLComponents componentsWithURL: url resolvingAgainstBaseURL: NO];
-    if (!components) {
-        return url;
-    }
-    components.fragment = components.fragment.length > 0
-        ? [components.fragment stringByAppendingFormat: @"-%@", FFFDownsampledFragment]
-        : FFFDownsampledFragment;
-    return components.URL ?: url;
+    context[SDWebImageContextAnimatedImageClass] = [FFFDownsampledImage class];
+    context[SDWebImageContextImageDecodeOptions] = @{FFFDecodeSourceSize: [FFFSourceSize new]};
 }
 
-+ (void) addToContext: (SDWebImageMutableContext*)context forKey: (NSString*)key box: (CGSize)box cover: (BOOL)cover {
++ (void) addToContext: (SDWebImageMutableContext*)context box: (CGSize)box cover: (BOOL)cover {
     context[SDWebImageContextAnimatedImageClass] = [FFFDownsampledImage class];
-    // Cached under the source's own key (not the url from loadURLForURL:),
-    // so the disk cache keeps one download for every size and for loads
-    // that aren't downsampled.
-    context[SDWebImageContextCacheKeyFilter] = [SDWebImageCacheKeyFilter cacheKeyFilterWithBlock: ^NSString* (NSURL* _Nonnull loadURL) {
-        return key;
-    }];
-    // The memory cache key is the url with these (SDWebImage's thumbnail
-    // key), so views of other sizes don't get this image.
+    // The memory cache key is the source's key with these (SDWebImage's
+    // thumbnail key), so views of other sizes don't get this image. The disk
+    // cache keeps the downloaded file under the source's key, for every size.
     context[SDWebImageContextImageThumbnailPixelSize] = [NSValue valueWithCGSize: box];
     context[SDWebImageContextImagePreserveAspectRatio] = @(!cover);
     context[SDWebImageContextImageDecodeOptions] = @{FFFDecodeSourceSize: [FFFSourceSize new]};
```

**File**: `ios/FastImage/FFFastImageView.m` (modified, +4/-6)
```diff
@@ -991,8 +991,7 @@ - (BOOL) loadsDuringLayout {
     }
     CGSize box = [self decodeBox];
     SDWebImageContext* context = [self contextForSource: source box: box cover: [self decodeCovers]];
-    NSURL* url = CGSizeEqualToSize(box, CGSizeZero) ? source.url : [FFFDownsampledImage loadURLForURL: source.url];
-    NSString* key = [manager cacheKeyForURL: url context: context];
+    NSString* key = [manager cacheKeyForURL: source.url context: context];
     return [(SDImageCache*) manager.imageCache imageFromMemoryCacheForKey: key] != nil;
 }
 
@@ -1002,15 +1001,14 @@ - (SDWebImageContext*) contextForSource: (FFFastImageSource*)source box: (CGSize
     context[SDWebImageContextImageLoader] = source.imageLoader;
     context[SDWebImageContextCacheKeyFilter] = source.cacheKeyFilter;
     if (CGSizeEqualToSize(box, CGSizeZero)) {
-        context[SDWebImageContextAnimatedImageClass] = [SDAnimatedImage class];
+        [FFFDownsampledImage addFullSizeToContext: context];
         if (!source.memoryCache) {
             // Only on disk, also when it comes from there.
             context[SDWebImageContextStoreCacheType] = @(SDImageCacheTypeDisk);
         }
         return context;
     }
-    NSString* key = source.cacheKeyFilter ? source.cacheKey : source.url.absoluteString;
-    [FFFDownsampledImage addToContext: context forKey: key box: box cover: cover];
+    [FFFDownsampledImage addToContext: context box: box cover: cover];
     if ([source isPhotoLibrary]) {
         // Photos makes the photo at the size asked for, with no file
         // downloaded: SDWebImage would keep this smaller copy on disk as the
@@ -1058,7 +1056,7 @@ - (void) downloadImage: (FFFastImageSource*)source options: (SDWebImageOptions)o
         };
     }
     CFTimeInterval startedAt = CACurrentMediaTime();
-    NSURL* url = context[SDWebImageContextImageThumbnailPixelSize] ? [FFFDownsampledImage loadURLForURL: source.url] : source.url;
+    NSURL* url = source.url;
     if (!events) {
         // Only this load's image: SDWebImage would clear the view (to the
         // placeholder) if it fails, and a cancelled load can still complete.
```

**File**: `ios/FastImage/FFFastImageViewManager.m` (modified, +5/-1)
```diff
@@ -1,5 +1,6 @@
 #import "FFFastImageViewManager.h"
 #import "FFFastImageView.h"
+#import "FFFDownsampledImage.h"
 
 #import <SDWebImage/SDImageCache.h>
 #import <SDWebImage/SDWebImageManager.h>
@@ -128,13 +129,16 @@ - (FFFastImageView*)view {
 static NSMutableArray<dispatch_block_t> *FFFPendingPreloads;
 static NSUInteger FFFPreloadsInFlight;
 
-// A preload's context: the source's headers and cache key.
+// A preload's context: the source's headers and cache key, and the image
+// class views use, so a view of the same url can share its download (see
+// FFFDownsampledImage).
 static SDWebImageMutableContext *FFFPreloadContext(FFFastImageSource *source)
 {
     SDWebImageMutableContext *context = [NSMutableDictionary dictionary];
     context[SDWebImageContextDownloadRequestModifier] = source.requestModifier;
     context[SDWebImageContextImageLoader] = source.imageLoader;
     context[SDWebImageContextCacheKeyFilter] = source.cacheKeyFilter;
+    [FFFDownsampledImage addFullSizeToContext:context];
     return context;
 }
 
```

---

### Incident Patch 12: `fb6dabd7` (2026-10-01)
**Commit Message**: fix(ios): keep SVGs as vector images when downsampling (#1216)

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +12/-0)
```diff
@@ -3835,6 +3835,7 @@ function SvgCase({
     expected,
     resizeMode,
     tintColor,
+    downsample,
     description,
 }: {
     id: string
@@ -3843,6 +3844,7 @@ function SvgCase({
     expected: [number, number]
     resizeMode?: FastImageProps['resizeMode']
     tintColor?: string
+    downsample?: boolean
     description: string
 }) {
     const [status, setStatus] = useState('loading')
@@ -3853,6 +3855,7 @@ function SvgCase({
                 source={source}
                 resizeMode={resizeMode}
                 tintColor={tintColor}
+                downsample={downsample}
                 onLoad={(e) => {
                     const { width, height } = e.nativeEvent
                     setStatus(
@@ -4702,6 +4705,15 @@ export const REGRESSION_GROUPS: RegressionGroup[] = [
                 tintColor="green"
                 description="tintColor on an SVG icon: a green ring"
             />,
+            <SvgCase
+                key="svg-downsample"
+                id="svg-downsample"
+                source={{ uri: imageUrl('svg-flag.svg') }}
+                style={{ width: 100, height: 50 }}
+                expected={[100, 50]}
+                downsample
+                description="An SVG with downsample stays a vector image (sharp); onLoad has its size (iOS drew it into a bitmap the view's size)"
+            />,
         ],
     },
     {
```

**File**: `ios/FastImage/FFFDownsampledImage.m` (modified, +18/-0)
```diff
@@ -4,6 +4,8 @@
 #import <SDWebImage/SDImageCacheDefine.h>
 #import <SDWebImage/SDWebImageCacheKeyFilter.h>
 #import <SDWebImage/UIImage+Metadata.h>
+#import <SDWebImage/NSData+ImageContentType.h>
+#import <SDWebImage/SDImageCodersManager.h>
 
 // The decode option that carries the full image's size to the view.
 static SDImageCoderOption const FFFDecodeSourceSize = @"FFFDecodeSourceSize";
@@ -130,6 +132,22 @@ + (CGSize) sourceSizeOfImage: (UIImage*)image {
 }
 
 - (instancetype) initWithData: (NSData*)data scale: (CGFloat)scale options: (SDImageCoderOptions*)options {
+    // An SVG isn't decoded smaller: it's a vector image, drawn at any size.
+    // This class can't decode it, and SDWebImage would then give it to the
+    // SVG coder with the box, which draws it into a bitmap that size. Decoded
+    // as without downsample instead (this init can return another image).
+    if ([NSData sd_imageFormatForImageData: data] == SDImageFormatSVG) {
+        NSMutableDictionary* vectorOptions = options ? [options mutableCopy] : [NSMutableDictionary dictionary];
+        [vectorOptions removeObjectForKey: SDImageCoderDecodeThumbnailPixelSize];
+        UIImage* image = [[SDImageCodersManager sharedManager] decodedImageWithData: data options: vectorOptions];
+        FFFSourceSize* sourceSize = options[FFFDecodeSourceSize];
+        if (image && [sourceSize isKindOfClass: [FFFSourceSize class]]) {
+            sourceSize.size = image.size;
+        }
+        self = (id) image;
+        return self;
+    }
+
     NSValue* boxValue = options[SDImageCoderDecodeThumbnailPixelSize];
     CGSize box = boxValue ? boxValue.CGSizeValue : CGSizeZero;
     NSNumber* preserveAspectRatio = options[SDImageCoderDecodePreserveAspectRatio];
```

---

### Incident Patch 13: `f8d24c0c` (2026-10-01)
**Commit Message**: fix(ios): don't crash on a source without a url when downsampling (#1215)

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +8/-0)
```diff
@@ -3990,6 +3990,14 @@ export const REGRESSION_GROUPS: RegressionGroup[] = [
                 source={{ uri: null as unknown as string }}
                 defaultSource={DEFAULT}
             />,
+            <EventCase
+                key="error-null-uri-downsample"
+                id="error-null-uri-downsample"
+                description="a null uri with downsample fires onError (iOS crashed)"
+                event="onError"
+                source={{ uri: null as unknown as string }}
+                downsample
+            />,
             <ErrorMessageCase key="error-message" />,
         ],
     },
```

**File**: `ios/FastImage/FFFDownsampledImage.m` (modified, +3/-2)
```diff
@@ -91,8 +91,9 @@ + (NSURL*) loadURLForURL: (NSURL*)url {
     // fill it, stretched). With its own url, a downsampled load only shares
     // downloads with other downsampled ones. Not a photo library url, which
     // isn't downloaded, and whose loader reads everything after ph:// as the
-    // photo's identifier.
-    if ([url.scheme isEqualToString: @"ph"]) {
+    // photo's identifier. No url (a source whose uri isn't one), which fails
+    // as it does without downsample (NSURLComponents throws for nil).
+    if (!url || [url.scheme isEqualToString: @"ph"]) {
         return url;
     }
     NSURLComponents* components = [NSURLComponents componentsWithURL: url resolvingAgainstBaseURL: NO];
```

---

### Incident Patch 14: `8fadf23b` (2026-10-01)
**Commit Message**: fix(ios): don't keep a page with an inline SVG in the web image cache (#1214)

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +32/-15)
```diff
@@ -1401,26 +1401,43 @@ function CacheKeyCase({
 // succeeds. iOS failed it without a request until the app was relaunched
 // (#394), since views retry failed urls but preloads didn't. Android kept the
 // page in Glide's disk cache (and `web` images' HTTP cache), so every later
-// load failed; iOS kept it in `web` images' HTTP cache.
+// load failed; iOS kept it in `web` images' HTTP cache. With `web`, iOS still
+// stored the page (it has an inline <svg>, and SDWebImage took it for an SVG
+// image) until the failed load removed it, so a preload right after could get
+// it from there: it happened once in tens of urls, so with many.
+const RETRY_TRIES = 40
 function PreloadRetryCase({ id, web }: { id: string; web?: boolean }) {
-    const path = `/bad-once/picsum/1025-200x200.jpg?${id}=${RUN}`
+    const pathFor = (attempt: number) =>
+        `/bad-once/picsum/1025-200x200.jpg?${id}=${RUN}-${attempt}`
+    const sourceFor = (attempt: number) => ({
+        uri: imageUrl(pathFor(attempt).slice(1)),
+        cache: web ? FastImage.cacheControl.web : undefined,
+    })
     const [status, setStatus] = useState('waiting')
     const [shown, setShown] = useState(false)
-    const source = {
-        uri: imageUrl(path.slice(1)),
-        cache: web ? FastImage.cacheControl.web : undefined,
-    }
+    const source = sourceFor(0)
     useEffect(() => {
         const run = async () => {
-            const [first] = await FastImage.preload([source])
-            if (first.ok) return setStatus('the first preload loaded')
-            const [second] = await FastImage.preload([source])
-            const response = await fetch(
-                imageUrl(`requests?path=${encodeURIComponent(path)}`),
-            )
-            const { count } = (await response.json()) as { count: number }
-            if (!second.ok) return setStatus(`retry failed: ${second.error}`)
-            if (count !== 2) return setStatus(`${count} requests`)
+            for (let attempt = 0; attempt < RETRY_TRIES; attempt++) {
+                const tried = sourceFor(attempt)
+                const [first] = await FastImage.preload([tried])
+                if (first.ok) return setStatus('the first preload loaded')
+                const [second] = await FastImage.preload([tried])
+                const response = await fetch(
+                    imageUrl(
+                        `requests?path=${encodeURIComponent(pathFor(attempt))}`,
+                    ),
+                )
+                const { count } = (await response.json()) as { count: number }
+                if (!second.ok) {
+                    return setStatus(
+                        `retry ${attempt + 1} failed (${count} requests): ${second.error}`,
+                    )
+                }
+                if (count !== 2) {
+                    return setStatus(`retry ${attempt + 1}: ${count} requests`)
+                }
+            }
             setShown(true)
         }
         run().catch((e) => setStatus(`error: ${e}`))
```

**File**: `ios/FastImage/FFFastImageSource.m` (modified, +57/-2)
```diff
@@ -157,18 +157,73 @@ - (BOOL)shouldBlockFailedURLWithURL:(NSURL *)url error:(NSError *)error
 // body is an image: a page sent instead (e.g. a captive portal's, with status
 // 200) would be served from there until it expired, and each load would fail.
 // Removing it after a load failed (forgetResponseAfterError:) could still be
-// in progress when the next load started.
+// in progress when the next load started. A page with an inline <svg> isn't
+// an SVG image.
 @interface FFFWebDownloaderOperation : SDWebImageDownloaderOperation
 @end
 
 @implementation FFFWebDownloaderOperation
 
+// Whether data is an SVG document: its first element (after an XML
+// declaration, comments or a doctype) is <svg>, as on Android
+// (FastImageSvg.looksLikeSvg). SDWebImage takes data that starts with '<' and
+// has an <svg> element anywhere for SVG, such as a page with an icon.
+static BOOL FFFHasPrefixAt(NSString *text, NSUInteger i, NSString *prefix)
+{
+    return text.length - i >= prefix.length && [text compare:prefix options:0 range:NSMakeRange(i, prefix.length)] == NSOrderedSame;
+}
+
+// The index after the end marker from i, or NSNotFound if it isn't there.
+static NSUInteger FFFSkipPast(NSString *text, NSUInteger i, NSString *end)
+{
+    NSRange found = [text rangeOfString:end options:0 range:NSMakeRange(i, text.length - i)];
+    return found.location == NSNotFound ? NSNotFound : NSMaxRange(found);
+}
+
+static BOOL FFFLooksLikeSVG(NSData *data)
+{
+    // The markup is ASCII: Latin-1 reads any bytes (a UTF-8 character cut off
+    // at the end too).
+    NSData *head = [data subdataWithRange:NSMakeRange(0, MIN(data.length, (NSUInteger)1024))];
+    NSString *text = [[[NSString alloc] initWithData:head encoding:NSISOLatin1StringEncoding] lowercaseString];
+    NSCharacterSet *space = NSCharacterSet.whitespaceAndNewlineCharacterSet;
+    // A UTF-8 byte order mark, as Latin-1.
+    NSUInteger i = FFFHasPrefixAt(text, 0, @"\u00EF\u00BB\u00BF") ? 3 : 0;
+    while (i < text.length) {
+        if ([space characterIsMember:[text characterAtIndex:i]]) {
+            i++;
+        } else if (FFFHasPrefixAt(text, i, @"<?")) {
+            i = FFFSkipPast(text, i, @"?>");
+        } else if (FFFHasPrefixAt(text, i, @"<!--")) {
+            i = FFFSkipPast(text, i, @"-->");
+        } else if (FFFHasPrefixAt(text, i, @"<!")) {
+            // A doctype, whose internal subset ([...]) can have '>'s.
+            NSRange rest = NSMakeRange(i, text.length - i);
+            NSUInteger subset = [text rangeOfString:@"[" options:0 range:rest].location;
+            NSUInteger close = [text rangeOfString:@">" options:0 range:rest].location;
+            if (subset != NSNotFound && subset < close) {
+                i = FFFSkipPast(text, subset, @"]");
+            }
+            if (i != NSNotFound) {
+                i = FFFSkipPast(text, i, @">");
+            }
+        } else {
+            return FFFHasPrefixAt(text, i, @"<svg");
+        }
+        if (i == NSNotFound) {
+            return NO;
+        }
+    }
+    return NO;
+}
+
 - (void)URLSession:(NSURLSession *)session
           dataTask:(NSURLSessionDataTask *)dataTask
  willCacheResponse:(NSCachedURLResponse *)proposedResponse
  completionHandler:(void (^)(NSCachedURLResponse *cachedResponse))completionHandler
 {
-    if ([NSData sd_imageFormatForImageData:proposedResponse.data] == SDImageFormatUndefined) {
+    SDImageFormat format = [NSData sd_imageFormatForImageData:proposedResponse.data];
+    if (format == SDImageFormatUndefined || (format == SDImageFormatSVG && !FFFLooksLikeSVG(proposedResponse.data))) {
         completionHandler(nil);
         return;
     }
```

---

### Incident Patch 15: `5db1a951` (2026-10-01)
**Commit Message**: fix(ios): load downsampled images in the order they're mounted (#1213)

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +60/-0)
```diff
@@ -3297,10 +3297,69 @@ function DownsampleGifCase() {
     )
 }
 
+// Images that are downsampled (so each view waits for its size) and not
+// cached, mounted together: they start loading in the order the views are
+// (left to right), which is the order they download in. On the New
+// Architecture iOS started them as UIKit laid the views out, last first. Only
+// checked there: on the legacy architecture the views have their size with
+// their props and start loading in the order React Native sets those, and
+// Android (which doesn't wait for the size) loads in another order too; with
+// or without downsample, in both.
+const ORDER_COUNT = 6
+const CHECKS_ORDER =
+    Platform.OS === 'ios' &&
+    (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager !=
+        null
+function DownsampleOrderCase() {
+    const [order, setOrder] = useState<number[]>([])
+    const [loaded, setLoaded] = useState(0)
+    const started = (index: number) => () =>
+        setOrder((o) => (o.includes(index) ? o : [...o, index]))
+    // Once they've all loaded too, so the screenshot shows them.
+    const done = order.length === ORDER_COUNT && loaded === ORDER_COUNT
+    return (
+        <View style={styles.row}>
+            {Array.from({ length: ORDER_COUNT }, (_, index) => (
+                // Each in a cell, as in a grid.
+                <View
+                    key={index}
+                    collapsable={false}
+                    style={[downsampleStyles.small, index > 0 && styles.gap]}
+                >
+                    <FastImage
+                        style={downsampleStyles.fill}
+                        source={{
+                            uri: imageUrl(
+                                `picsum/1016-2048x2048.jpg?order=${RUN}-${index}`,
+                            ),
+                        }}
+                        downsample
+                        onLoadStart={started(index)}
+                        onLoad={() => setLoaded((n) => n + 1)}
+                    />
+                </View>
+            ))}
+            <CaseStatus
+                id="downsample-order"
+                status={
+                    !done
+                        ? 'waiting'
+                        : !CHECKS_ORDER ||
+                            order.every((index, i) => index === i)
+                          ? 'OK'
+                          : `started ${order.join(', ')}`
+                }
+                description="downsample: images mounted together start loading in order, left to right (iOS, New Architecture)"
+            />
+        </View>
+    )
+}
+
 const downsampleStyles = StyleSheet.create({
     large: { width: 96, height: 96, backgroundColor: '#eee' },
     stripes: { width: 48, height: 48 },
     small: { width: 32, height: 32, backgroundColor: '#eee' },
+    fill: { flex: 1 },
     tall: { width: 40, height: 96 },
     rotated: { width: 64, height: 96 },
 })
@@ -4165,6 +4224,7 @@ export const REGRESSION_GROUPS: RegressionGroup[] = [
             <DownsampleNoSizeCase key="downsample-no-size" />,
             <DownsampleGifCase key="downsample-gif" />,
             <DownsamplePreloadingCase key="downsample-preloading" />,
+            <DownsampleOrderCase key="downsample-order" />,
         ],
     },
     {
```

**File**: `ios/FastImage/FFFastImageView.m` (modified, +47/-13)
```diff
@@ -263,7 +263,12 @@ - (void) layoutSubviews {
     [self blurAgainIfResized];
     [self tileAgainIfResized];
     if (self.waitsForSize) {
-        if ([self hasSize]) {
+        // An image in the memory cache shows in this frame. Others start
+        // loading from didSetProps's block, after layout, in the order the
+        // views got their props: UIKit lays views out in its own order (in a
+        // grid, the last one first), and downloads start in the order they're
+        // asked for, so a screen's first images would load last.
+        if ([self hasSize] && [self loadsDuringLayout]) {
             [self reloadImage];
         }
     } else if (![self switchSourceIfResized]) {
@@ -770,9 +775,10 @@ - (void) didSetProps: (NSArray<NSString*>*)changedProps {
         // With downsample on, the image is decoded for the view's size, and
         // with several sources one is picked for it, so a view that hasn't
         // been laid out yet loads once it has. Props and layout are applied
-        // in the same update, so that's before the next frame (in
-        // layoutSubviews). A view that still has no size then (e.g. one sized
-        // from onLoad) loads at full size, or the largest source.
+        // in the same update, so that's here, just after it, or before the
+        // next frame (layoutSubviews) for an image in the memory cache. A
+        // view that still has no size then (e.g. one sized from onLoad) loads
+        // at full size, or the largest source.
         if (([self downsamples] || [self picksSource]) && ![self hasSize]) {
             if (!self.waitsForSize) {
                 self.waitsForSize = YES;
@@ -960,31 +966,59 @@ - (SDWebImageOptions) loadOptions {
 // Headers, and the size to decode at (see FFFDownsampledImage), which it
 // records as decodedBox.
 - (SDWebImageContext*) loadContext {
-    SDWebImageMutableContext* context = [NSMutableDictionary dictionary];
-    context[SDWebImageContextDownloadRequestModifier] = _source.requestModifier;
-    context[SDWebImageContextImageLoader] = _source.imageLoader;
-    context[SDWebImageContextCacheKeyFilter] = _source.cacheKeyFilter;
     CGSize box = [self decodeBox];
     self.decodedBox = box;
     self.decodedCover = [self decodeCovers];
+    return [self contextForSource: _source box: box cover: self.decodedCover];
+}
+
+// Whether the view loads as it's laid out, so its image shows in this frame:
+// one in the memory cache, where SDWebImage finds it as the load starts, or
+// one that isn't downloaded (no source, which shows defaultSource, or a data
+// uri). Also when that can't be told (an app's own image cache, or an
+// SDWebImage without cacheKeyForURL:context:), as before.
+- (BOOL) loadsDuringLayout {
+    FFFastImageSource* source = [self picksSource] ? [self sourceForSize] : _source;
+    if (!source.url || [source.url.scheme isEqualToString: @"data"]) {
+        return YES;
+    }
+    if (!source.memoryCache) {
+        return NO;
+    }
+    SDWebImageManager* manager = [SDWebImageManager sharedManager];
+    if (![manager.imageCache isKindOfClass: [SDImageCache class]] || ![manager respondsToSelector: @selector(cacheKeyForURL:context:)]) {
+        return YES;
+    }
+    CGSize box = [self decodeBox];
+    SDWebImageContext* context = [self contextForSource: source box: box cover: [self decodeCovers]];
+    NSURL* url = CGSizeEqualToSize(box, CGSizeZero) ? source.url : [FFFDownsampledImage loadURLForURL: source.url];
+    NSString* key = [manager cacheKeyForURL: url context: context];
+    return [(SDImageCache*) manager.imageCache imageFromMemoryCacheForKey: key] != nil;
+}
+
+- (SDWebImageContext*) contextForSource: (FFFastImageSource*)source box: (CGSize)box cover: (BOOL)cover {
+    SDWebImageMutableContext* context = [NSMutableDictionary dictionary];
+    context[SDWebImageContextDownloadRequestModifier] = source.requestModifier;
+    context[SDWebImageContextImageLoader] = source.imageLoader;
+    context[SDWebImageContextCacheKeyFilter] = source.cacheKeyFilter;
     if (CGSizeEqualToSize(box, CGSizeZero)) {
         context[SDWebImageContextAnimatedImageClass] = [SDAnimatedImage class];
-        if (!_source.memoryCache) {
+        if (!source.memoryCache) {
             // Only on disk, also when it comes from there.
             context[SDWebImageContextStoreCacheType] = @(SDImageCacheTypeDisk);
         }
         return context;
     }
-    NSString* key = _source.cacheKeyFilter ? _source.cacheKey : _source.url.absoluteString;
-    [FFFDownsampledImage addToContext: context forKey: key box: box cover: self.decodedCover];
-    if ([_source isPhotoLibrary]) {
+    NSString* key = source.cacheKeyFilter ? source.cacheKey : source.url.absoluteString;
+    [FFFDownsampledImage addToContext: context forKey: key box: box cover: cover];
+    if ([source isPhotoLibrary]) {
         // Photos makes the photo at the size asked for, with no file
         // downloaded: SDWebImage would keep this 
```

#### Recent Merged Pull Requests:
- **PR #1254** (2026-10-05): fix(types): allow ref on FastImage and FastImageBackground (@DylanVann)
- **PR #1253** (2026-10-05): fix: install with npm next to React Native tvOS and release candidates (@DylanVann)
- **PR #1252** (2026-10-05): test: regenerate autolinking and reinstall pods when the library's package.json changes [skip ci] (@DylanVann)
- **PR #1250** (2026-10-05): test: add a tvOS example app, run with verify.mts --app tv (@DylanVann)
- **PR #1249** (2026-10-05): feat: deprecate FastImage's children in favor of FastImageBackground (@DylanVann)
- **PR #1248** (2026-10-05): feat(ios): include SDWebImagePhotosPlugin on tvOS too (@DylanVann)
- **PR #1247** (2026-10-05): feat(android): require Glide 4.15 or later (@DylanVann)
- **PR #1246** (2026-10-05): chore(ios): remove the Xcode project for manual linking (@DylanVann)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
