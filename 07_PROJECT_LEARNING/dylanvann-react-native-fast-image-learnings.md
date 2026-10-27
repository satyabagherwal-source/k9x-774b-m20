> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dylanvann-react-native-fast-image-learnings.md`  
> **Source**: github ([https://github.com/DylanVann/react-native-fast-image](https://github.com/DylanVann/react-native-fast-image))  
> **Source Version**: `3eef0244`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T17:16:52.816Z  
> **Learning ID**: `learn-github-dylanvann-react-native-fast-image`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): DylanVann/react-native-fast-image

> **Canonical Artifact**: `07_PROJECT_LEARNING/dylanvann-react-native-fast-image-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DylanVann/react-native-fast-image](https://github.com/DylanVann/react-native-fast-image))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T17:16:52.341Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DylanVann/react-native-fast-image`
- **Description**: Performant React Native image component.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8418 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ReactNativeFastImageExample/android/app/src/main/java/com/reactnativefastimageexample/MainActivity.kt`
```
package com.reactnativefastimageexample

import android.content.Intent
import android.os.Bundle
import android.view.animation.AlphaAnimation
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.devsupport.DefaultDevLoadingViewImplementation
import com.facebook.react.uimanager.util.ReactFindViewUtil

class MainActivity : ReactActivity() {

  // scripts/verify.mts hides React Native's development banner ("Loading
  // from…"), which its screenshots would catch.
  override fun onCreate(savedInstanceState: Bundle?) {
    if (intent?.getBooleanExtra("hideDevLoadingView", false) == true) {
      DefaultDevLoadingViewImplementation.setDevLoadingEnabled(false)
    }
    super.onCreate(savedInstanceState)
    ReactFindViewUtil.addViewsListener(viewAnimation, setOf("regression-view-animation"))
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ReactNativeFastImageExample"

  // The regression runner's fade-placeholder-animation case: a view
  // animation (android.view.animation) with an alpha of 0.5 on the View with
  // this nativeID, as an app's native code can start. It doesn't change the
  // view's alpha.
  private val viewAnimation =
      ReactFindViewUtil.OnMultipleViewsFoundListener { view, _ ->
        view.startAnimation(
            AlphaAnimation(0.5f, 0.5f).apply {
              duration = 600_000
              fillAfter = true
            })
      }

  // maestro/background-no-activity.yaml opens the app's
  // <scheme>://finish-on-leave link: then leaving the app finishes this
  // Activity, as Android may for one in the background, while the app's
  // process and JS keep running.
  private var finishOnLeave = false

  override fun onNewIntent(intent: Intent) {
    if (intent.data?.host == "finish-on-leave") finishOnLeave = true
    super.onNewIntent(intent)
  }

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (finishOnLeave) finish()
  }

  override fun onDestroy() {
    ReactFindViewUtil.removeViewsListener(viewAnimation)
    super.onDestroy()
  }

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

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    true
  }
}

```

### Core Architecture Module: `ReactNativeFastImageExample/ios/ReactNativeFastImageExample/SceneDelegate.swift`
```
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import UIKit

class SceneDelegate: RCTDefaultReactNativeFactoryDelegate, UIWindowSceneDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    // scripts/verify.mts hides React Native's development banner
    // ("Downloading 100%"), which its screenshots would catch.
    if UserDefaults.standard.bool(forKey: "FastImageHideDevLoadingView") {
      RCTDevLoadingViewSetEnabled(false)
    }

    dependencyProvider = RCTAppDependencyProvider()
    reactNativeFactory = RCTReactNativeFactory(delegate: self)
    window = UIWindow(windowScene: windowScene)

    reactNativeFactory?.startReactNative(
      withModuleName: "ReactNativeFastImageExample",
      in: window,
      connectionOptions: connectionOptions
    )
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    RCTLinkingManager.scene(scene, openURLContexts: URLContexts)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.scene(scene, continue: userActivity)
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
    // Every example app's native projects, which its builds write into.
    new RegExp(
        `^${escape(root)}\\/ReactNativeFastImageExample[^/]*\\/(ios|android)\\/.*$`,
    ),
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1385** (2026-10-26): **Android: image swaps to thumbhash during stack screen closing animation**
  *Symptoms*: **Describe the bug** On Android, image that already loaded swaps back to `thumbhash` the moment screen is being popped  **To Reproduce** 1. Push a screen that renders <FastImage source={{uri, thumbhash}} /> and let the image load. 2. Go back. 3. During the closing animation, the image is replaced by the ThumbHash.  **Expected behavior** The image stays during the transition  **Dependency versions**  - React Native version: 0.86.3 - React version: 19.2.3 - React Native Fast Image version: 10.9.4 - react-native-screens: 4.30.0  **Claude-generated suggestions, please verify the correctness & safety:** Likely cause FastImageViewManager.onDropViewInstance → view.drop() → clearView() → requestManager.clear(this) (FastImageViewWithUrl.java:646, :1980). Clearing the Glide request calls the target's onLoadCleared, which puts the placeholder drawable back. With react-native-screens, React Native drops the view at unmount, while the view is still on screen for the exit animation.  Possible fix On drop, wait until the view leaves the window (onDetachedFromWindow) before clearing the request, or clear without putting the placeholder back. Re-setting the last drawable after clearing is risky, since Glide may already have recycled the bitmap.

- **Issue #1077** (2026-09-24): **can anyone add support for React 19, i don't want to ruin my package.json with peer deps**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior if possible, or a link to a reproduction repo: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Expected behavior** A clear and concise description of what you expected to happen.  **Screenshots** If applicable, add screenshots to help explain your problem.  **Dependency versions**  - React Native version: - React version: - React Native Fast Image version:  **Note:** if these are not the latest versions of each I recommend updating as extra effort will not be taken to be backwards compatible, and updating might resolving your issue. 

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

### Incident Patch 1: `d11bb53f` (2026-10-25)
**Commit Message**: fix(android): keep bitmaps for very large views under Android's drawing limit (#1379)

Glide fits or crops an image to its view's size in pixels, scaling it up
when it's smaller, so a very large view got a bitmap its size: a 2400 x 2400
view on a 2.625x phone is 6300 x 6300 px, 159 MB. Android won't draw a bitmap
over 100 MB, and the app crashed ("Canvas: trying to draw too large bitmap").
That's any view over about 26 megapixels: content zoomed out with a
transform, or a long image shown full width.

Images in a view are now decoded for at most 16 megapixels (4096 x 4096,
64 MB), keeping the view's shape, and the view scales the bitmap up as it
draws it. The same goes for placeholder urls, GIFs, and the copy of what the
view showed that a cross-dissolve fades from. Views under the cap are
unchanged.

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +151/-0)
```diff
@@ -7737,6 +7737,134 @@ function DownsampleZoomCase() {
     )
 }
 
+// A view much larger than the screen (2400x2400, about 6300 px square on the
+// Android emulator), drawn 20 times smaller with a transform. Glide fits an
+// image to the view's size, so the bitmap would be about 160 MB, which Android
+// won't draw ("Canvas: trying to draw too large bitmap"): the app crashed.
+function LargeViewCase() {
+    const [status, onLoad] = useLoadedThenOk(1)
+    return (
+        <View style={blurStyles.stacked}>
+            <View style={downsampleStyles.largeViewClip}>
+                <FastImage
+                    style={downsampleStyles.largeView}
+                    source={{ uri: imageUrl('quadrants.png?case=large-view') }}
+                    onLoad={onLoad}
+                />
+            </View>
+            <CaseStatus
+                id="large-view"
+                status={status}
+                description={{
+                    checks: "An image in a view far larger than the screen shows (on Android its bitmap was the view's size, about 160 MB, and the app crashed drawing it).",
+                    steps: 'Loads a 20x20 image of four colored squares into a 2400x2400 view with cover, drawn 20 times smaller with a transform. Passes once it has loaded (and a moment more).',
+                    shows: 'A 120x120 square of four colors: red, green, blue and yellow quadrants. The app closing is a failure.',
+                }}
+            />
+        </View>
+    )
+}
+
+// The same view, cross-dissolving to a new source: the fade drew what the
+// view showed into a bitmap the view's size (about 160 MB), which Android
+// won't draw either.
+function LargeViewFadeCase() {
+    const [second, setSecond] = useState(false)
+    const [status, onLoad] = useLoadedThenOk(2)
+    return (
+        <View style={blurStyles.stacked}>
+            <View style={downsampleStyles.largeViewClip}>
+                <FastImage
+                    style={downsampleStyles.largeView}
+                    source={{
+                        uri: imageUrl(
+                            second
+                                ? 'quadrants.png?case=large-view-fade-2'
+                                : 'quadrants.png?case=large-view-fade',
+                        ),
+                    }}
+                    transition={{ duration: 300, betweenImages: true }}
+                    onLoad={() => {
+                        onLoad()
+                        setSecond(true)
+                    }}
+                />
+            </View>
+            <CaseStatus
+                id="large-view-fade"
+                status={status}
+                description={{
+                    checks: "transition's betweenImages in a view far larger than the screen (on Android the fade copied what the view showed into a bitmap the view's size, about 160 MB, and the app crashed drawing it).",
+                    steps: 'The large-view case, with transition { duration: 300, betweenImages: true }: once the image loads, its source changes to the same image at another url, which cross-dissolves from it. Passes once both have loaded (and a moment more).',
+                    shows: 'A 120x120 square of four colors: red, green, blue and yellow quadrants. The app closing is a failure.',
+                }}
+            />
+        </View>
+    )
+}
+
+// The same view with a GIF: the view's own copy of its animation (see
+// FastImageGif) cropped each frame to the view's size, about 160 MB.
+function LargeViewGifCase() {
+    const [status, onLoad] = useLoadedThenOk(1)
+    return (
+        <View style={blurStyles.stacked}>
+            <View style={downsampleStyles.largeViewClip}>
+                <FastImage
+                    style={downsampleStyles.largeView}
+                    source={{
+                        uri: imageUrl('loop-once.gif?case=large-view-gif'),
+                    }}
+                    onLoad={onLoad}
+                />
+            </View>
+            <CaseStatus
+                id="large-view-gif"
+                status={status}
+                description={{
+                    checks: "A GIF in a view far larger than the screen shows (on Android each frame was cropped to the view's size, about 160 MB, and the app crashed drawing it).",
+                    steps: 'Loads an 80x80 GIF that plays once, magenta then cyan, into a 2400x2400 view with cover, drawn 20 times smaller with a transform. Passes once it has loaded (and a moment more).',
+                    shows: 'A 120x120 cyan square. The app closing is a failure.',
+                }}
+            />
+        </View>
+    )
+}
+
+// The same view with a placeholder url, shown while the image comes from the
+// slow server: the placeholder was loaded at the view's size, about 160 MB.
+function LargeViewPlaceholderCase() {
+    const [status, onLoad] = useLoadedThenOk(1)
+    return (
+        <View style={blurStyles.stacked}>
+           
```

**File**: `android/src/main/java/com/fastimage/FastImageSourceSize.java` (modified, +20/-2)
```diff
@@ -185,11 +185,29 @@ private static DownsampleStrategy strategy(@Nullable ImageView.ScaleType scaleTy
 
     static final float MAX_PIXELS = 4096f * 4096f;
 
+    // The scale that brings this many pixels down to at most MAX_PIXELS, or 1.
+    static float capScale(float pixels) {
+        return pixels > MAX_PIXELS ? (float) Math.sqrt(MAX_PIXELS / pixels) : 1;
+    }
+
+    // The box (in pixels) Glide decodes an image for in a view: the view's
+    // size, or that scaled down to at most MAX_PIXELS pixels, keeping its
+    // shape. Glide crops or fits an image to the box, scaling it up if it's
+    // smaller, so a very large view (e.g. a long image shown full width) would
+    // get a bitmap its size, which Android won't draw over 100 MB ("Canvas:
+    // trying to draw too large bitmap"). The view scales it up as it draws it.
+    static int[] box(int width, int height) {
+        float scale = capScale((float) width * height);
+        if (width <= 0 || height <= 0 || scale == 1) return new int[]{width, height};
+        return new int[]{
+                Math.max(1, (int) Math.floor(width * scale)),
+                Math.max(1, (int) Math.floor(height * scale))};
+    }
+
     private static final class FullSize extends DownsampleStrategy {
         @Override
         public float getScaleFactor(int sourceWidth, int sourceHeight, int requestedWidth, int requestedHeight) {
-            float pixels = (float) sourceWidth * sourceHeight;
-            return pixels > MAX_PIXELS ? (float) Math.sqrt(MAX_PIXELS / pixels) : 1;
+            return capScale((float) sourceWidth * sourceHeight);
         }
 
         @Override
```

**File**: `android/src/main/java/com/fastimage/FastImageSvgRenderer.java` (modified, +2/-4)
```diff
@@ -24,8 +24,6 @@ final class FastImageSvgRenderer {
     // An SVG with neither a size nor a viewBox, as browsers size one.
     private static final float DEFAULT_WIDTH = 300;
     private static final float DEFAULT_HEIGHT = 150;
-    // At most this many pixels (a 4096 x 4096 bitmap), however large the view.
-    private static final float MAX_PIXELS = 4096f * 4096f;
 
     private FastImageSvgRenderer() {
     }
@@ -85,8 +83,8 @@ static Resource<Bitmap> render(byte[] data, int width, int height, Options optio
             }
         }
         if (Float.isNaN(scale) || Float.isInfinite(scale) || scale <= 0) scale = 1f;
-        float pixels = sourceWidth * scale * sourceHeight * scale;
-        if (pixels > MAX_PIXELS) scale *= (float) Math.sqrt(MAX_PIXELS / pixels);
+        // At most FastImageSourceSize.MAX_PIXELS, however large the view.
+        scale *= FastImageSourceSize.capScale(sourceWidth * scale * sourceHeight * scale);
         int bitmapWidth = Math.max(1, Math.round(sourceWidth * scale));
         int bitmapHeight = Math.max(1, Math.round(sourceHeight * scale));
 
```

**File**: `android/src/main/java/com/fastimage/FastImageViewWithUrl.java` (modified, +56/-9)
```diff
@@ -467,7 +467,8 @@ private void startUrlPlaceholderLoad() {
         }
         FastImageSource imageSource = FastImageViewConverter.getImageSource(getContext(), mPlaceholderSource);
         if (imageSource == null) return;
-        CustomTarget<Drawable> target = new CustomTarget<Drawable>(getWidth(), getHeight()) {
+        int[] box = FastImageSourceSize.box(getWidth(), getHeight());
+        CustomTarget<Drawable> target = new CustomTarget<Drawable>(box[0], box[1]) {
             @Override
             public void onResourceReady(@NonNull Drawable resource, @Nullable Transition<? super Drawable> transition) {
                 if (this != mUrlPlaceholderTarget) return;
@@ -743,8 +744,11 @@ private boolean skips(DataSource dataSource) {
     // view after the fade, still drawing (and animating) the previous image.
     @Nullable
     private ValueAnimator mFade;
+    // At most the size Android draws a bitmap at (see
+    // FastImageSourceSize.box), stretched to the view.
     @Nullable
     private Bitmap mFadeFrom;
+    private final Rect mFadeFromBounds = new Rect();
     // Or, instead of a copy, the placeholder prop the view showed, with the
     // matrix it drew it with: FastImage's own drawable, which Glide doesn't
     // recycle, so it's drawn again as it was, rather than copied into a
@@ -777,8 +781,11 @@ private void startFade(int duration) {
             fromMatrix = new Matrix(getImageMatrix());
         } else if (shown != null) {
             try {
-                from = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
-                onDraw(new Canvas(from));
+                int[] box = FastImageSourceSize.box(width, height);
+                from = Bitmap.createBitmap(box[0], box[1], Bitmap.Config.ARGB_8888);
+                Canvas canvas = new Canvas(from);
+                canvas.scale((float) box[0] / width, (float) box[1] / height);
+                onDraw(canvas);
             } catch (OutOfMemoryError | RuntimeException e) {
                 // Out of memory, or a hardware bitmap (Android 8+; an app's
                 // Glide module can enable them), which a software canvas
@@ -902,7 +909,8 @@ private void drawImage(Canvas canvas) {
             drawFadeFrom(canvas, mFadeFromDrawable, 255 - alpha);
         } else {
             mFadeFromPaint.setAlpha(255 - alpha);
-            canvas.drawBitmap(mFadeFrom, 0, 0, mFadeFromPaint);
+            mFadeFromBounds.set(0, 0, getWidth(), getHeight());
+            canvas.drawBitmap(mFadeFrom, null, mFadeFromBounds, mFadeFromPaint);
         }
         mFadeInPaint.setAlpha(alpha);
         canvas.saveLayer(0, 0, width, height, mFadeInPaint);
@@ -932,7 +940,8 @@ private boolean drawFadeWithoutLayers(Canvas canvas, int alpha) {
             drawFadeFrom(canvas, mFadeFromDrawable, 255);
         } else if (mFadeFrom != null) {
             mFadeFromPaint.setAlpha(255);
-            canvas.drawBitmap(mFadeFrom, 0, 0, mFadeFromPaint);
+            mFadeFromBounds.set(0, 0, getWidth(), getHeight());
+            canvas.drawBitmap(mFadeFrom, null, mFadeFromBounds, mFadeFromPaint);
         }
         // Without the drawable asking the view to draw again.
         Drawable.Callback callback = image.getCallback();
@@ -1038,6 +1047,32 @@ public void setPaused(boolean paused) {
     @Nullable
     private Drawable mAnimated;
 
+    // Passes on a size capped by FastImageSourceSize.box. Equal to another
+    // for the same callback, so the target can remove it.
+    private static final class CappedSize implements SizeReadyCallback {
+        private final SizeReadyCallback cb;
+
+        CappedSize(SizeReadyCallback cb) {
+            this.cb = cb;
+        }
+
+        @Override
+        public void onSizeReady(int width, int height) {
+            int[] box = FastImageSourceSize.box(width, height);
+            cb.onSizeReady(box[0], box[1]);
+        }
+
+        @Override
+        public boolean equals(Object o) {
+            return o instanceof CappedSize && ((CappedSize) o).cb.equals(cb);
+        }
+
+        @Override
+        public int hashCode() {
+            return cb.hashCode();
+        }
+    }
+
     // Shows each GIF as this view's own animation. Glide's target also starts
     // and stops it with the Activity, as it does Glide's own GifDrawable.
     private final class OwnGifTarget extends DrawableImageViewTarget {
@@ -1053,6 +1088,17 @@ private final class OwnGifTarget extends DrawableImageViewTarget {
             mMeanwhile = meanwhile;
         }
 
+        // The view's size, capped (FastImageSourceSize.box).
+        @Override
+        public void getSize(@NonNull SizeReadyCallback cb) {
+            super.getSize(new CappedSize(cb));
+        }
+
+        @Override
+        public void removeCallback(@NonNull SizeReadyCallback cb) {
+            super.removeCallback(new CappedSize(cb));
+        }
+
         @Override
         public void onLoadStarted(@Nullable Drawable placeholder) {
             Dr
```

**File**: `docs/comparisons.md` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ Checked: the fork's `main` at `eabb78f` (2026-02-04; its latest release is 8.13.
 Potential issues in the dream-horizon-org fork: [issues/dream-horizon-org-fork-issues.md](issues/dream-horizon-org-fork-issues.md)
 
 - **Architectures.** The fork supports both the legacy architecture and the New Architecture in one package, and declares no minimum React Native version. Fast Image needs React Native 0.83+ with the New Architecture, iOS 15.1+ and Android 7.0+; apps on the legacy architecture or older React Native use Fast Image 9.x, which is maintained. _(Both packages' code and docs.)_
-- **Correctness.** Many issues Fast Image fixed in 8.x–10.0 are still in the fork, among them crashes, a preload's headers sent with every later request on iOS, Android downloads failing when another image of the url mounts, a replaced load reported as `onError` on iOS and reloads with load events on unrelated prop changes. The full list is in the file linked above. _(Code reading; most were reproduced in Fast Image's regression cases while it had the same code, and several are reported in the fork's tracker.)_
+- **Correctness.** Many issues Fast Image fixed in 8.x–10.0 are still in the fork, among them crashes (one with an image in a view much larger than the screen, on Android), a preload's headers sent with every later request on iOS, Android downloads failing when another image of the url mounts, a replaced load reported as `onError` on iOS and reloads with load events on unrelated prop changes. The full list is in the file linked above. _(Code reading; most were reproduced in Fast Image's regression cases while it had the same code, and several are reported in the fork's tracker.)_
 - **Network and memory.** On iOS with the New Architecture the fork loads sources without `cache` as `cache: 'web'`, so cached images are requested again, and it decodes iOS images at full size where Fast Image decodes them at the view's size ([`downsample`](../README.md#downsample)). On Android it downloads an image once per size and has no download timeouts, where Fast Image shares one download per image, queues downloads by `priority` and fails stalled ones. _(Code reading; the fork wasn't in Fast Image's [benchmarks](benchmarks.md).)_
 - **Features only Fast Image has.** `objectFit` and `objectPosition`, per-view `loop` and `paused`, keeping the previous image while a new source loads (`recyclingKey`), several sources picked for the view's size, `source.cacheKey`, `memoryCache` and `diskCache`, `getCachePath`, `writeToCache`, `configureCache`, `setDefaults`, preload results per source, a 0–1 `progress`, `FastImageBackground`, photo library (`ph://`) images, a web version for react-native-web, and an Expo config plugin. The fork's API is Fast Image 8's plus `blurRadius` and `transition="fade"`, which Fast Image also has. _(Both packages' code and docs.)_
 - **AVIF on older OS versions, where the fork does more.** It bundles libavif (with dav1d on iOS) and Glide's AVIF integration, so AVIF decodes on every OS version it supports, while Fast Image uses the system decoders (iOS 16+, and Android devices with an AVIF decoder, required from Android 14). The cost is app size and native libraries to keep updated (the fork's tracker has an open report about its libdav1d version). _(Build files and docs.)_
```

**File**: `docs/issues/dream-horizon-org-fork-issues.md` (modified, +7/-0)
```diff
@@ -97,6 +97,13 @@ Fast Image's maintainers found these while comparing Fast Image with the dream-h
 - **How to reproduce:** Found by reading the code. Fast Image before the fix below, which loaded the same way, showed the image zoomed in about 5 times in a regression case where the view's height grows after it loads.
 - **How Fast Image handles it:** when the view's size changes after the image loaded, the same image loads again at the new size, without events, keeping the current image until then ([#1142](https://github.com/DylanVann/react-native-fast-image/pull/1142)).
 
+## Android crashes with an image in a very large view
+
+- **What happens:** an image in a view of more than about 26 million pixels (a 2400 × 2400 view on a 2.625× phone, or a long image shown full width) crashes the app with "Canvas: trying to draw too large bitmap".
+- **Where:** `FastImageViewWithUrl.onAfterUpdate()` loads with `into(this)`, so Glide crops or fits the image to the view's size (the `CENTER_CROP` and `FIT_CENTER` scale types from `FastImageViewConverter`), scaling a smaller image up. The bitmap is then the view's size at 4 bytes a pixel, and Android throws when drawing a bitmap over 100 MB.
+- **How to reproduce:** Found by reading the code. Fast Image before the fix below, which loaded the same way, crashed in regression cases with a 20 × 20 image, a GIF and a placeholder url in a 2400 × 2400 view.
+- **How Fast Image handles it:** in a very large view, an image is decoded for the view's size scaled down to at most 16 megapixels (4096 × 4096, 64 MB), keeping its shape, and the view scales it up as it draws it. The same goes for placeholder urls, GIFs and the cross-dissolve's copy of the previous image ([#1379](https://github.com/DylanVann/react-native-fast-image/pull/1379)).
+
 ## Android views showing the same animated image share one animation
 
 - **What happens:** GIFs, APNGs and animated WebPs are decoded by APNG4Android's Glide plugin, and every view showing the same image at the same size gets the same drawable. When one of those views loads another source, Glide stops the drawable it showed, so the other views' animations stop too.
```

**File**: `screenshots/main-android/descriptions.json` (modified, +27/-0)
```diff
@@ -641,6 +641,33 @@
             }
         }
     },
+    "large-view": {
+        "description": {
+            "checks": "An image in a view far larger than the screen shows: a still image, one cross-dissolving to a new source, a GIF and a placeholder url."
+        },
+        "cases": {
+            "large-view": {
+                "checks": "An image in a view far larger than the screen shows (on Android its bitmap was the view's size, about 160 MB, and the app crashed drawing it).",
+                "steps": "Loads a 20x20 image of four colored squares into a 2400x2400 view with cover, drawn 20 times smaller with a transform. Passes once it has loaded (and a moment more).",
+                "shows": "A 120x120 square of four colors: red, green, blue and yellow quadrants. The app closing is a failure."
+            },
+            "large-view-fade": {
+                "checks": "transition's betweenImages in a view far larger than the screen (on Android the fade copied what the view showed into a bitmap the view's size, about 160 MB, and the app crashed drawing it).",
+                "steps": "The large-view case, with transition { duration: 300, betweenImages: true }: once the image loads, its source changes to the same image at another url, which cross-dissolves from it. Passes once both have loaded (and a moment more).",
+                "shows": "A 120x120 square of four colors: red, green, blue and yellow quadrants. The app closing is a failure."
+            },
+            "large-view-gif": {
+                "checks": "A GIF in a view far larger than the screen shows (on Android each frame was cropped to the view's size, about 160 MB, and the app crashed drawing it).",
+                "steps": "Loads an 80x80 GIF that plays once, magenta then cyan, into a 2400x2400 view with cover, drawn 20 times smaller with a transform. Passes once it has loaded (and a moment more).",
+                "shows": "A 120x120 cyan square. The app closing is a failure."
+            },
+            "large-view-placeholder": {
+                "checks": "A placeholder url in a view far larger than the screen shows while the image loads (on Android it was loaded at the view's size, about 160 MB, and the app crashed drawing it).",
+                "steps": "The large-view case, with the image from the slow server (about 4 s) and a placeholder url of the logo, which shows meanwhile. Passes once the image has loaded (and a moment more).",
+                "shows": "A 120x120 square of four colors: red, green, blue and yellow quadrants. The app closing is a failure."
+            }
+        }
+    },
     "loading": {
         "description": {
             "checks": "Loading: props that don't reload, source changes, onLoadStart and onProgress, cache: 'web' and cookies."
```

**File**: `screenshots/main-ios/descriptions.json` (modified, +27/-0)
```diff
@@ -641,6 +641,33 @@
             }
         }
     },
+    "large-view": {
+        "description": {
+            "checks": "An image in a view far larger than the screen shows: a still image, one cross-dissolving to a new source, a GIF and a placeholder url."
+        },
+        "cases": {
+            "large-view": {
+                "checks": "An image in a view far larger than the screen shows (on Android its bitmap was the view's size, about 160 MB, and the app crashed drawing it).",
+                "steps": "Loads a 20x20 image of four colored squares into a 2400x2400 view with cover, drawn 20 times smaller with a transform. Passes once it has loaded (and a moment more).",
+                "shows": "A 120x120 square of four colors: red, green, blue and yellow quadrants. The app closing is a failure."
+            },
+            "large-view-fade": {
+                "checks": "transition's betweenImages in a view far larger than the screen (on Android the fade copied what the view showed into a bitmap the view's size, about 160 MB, and the app crashed drawing it).",
+                "steps": "The large-view case, with transition { duration: 300, betweenImages: true }: once the image loads, its source changes to the same image at another url, which cross-dissolves from it. Passes once both have loaded (and a moment more).",
+                "shows": "A 120x120 square of four colors: red, green, blue and yellow quadrants. The app closing is a failure."
+            },
+            "large-view-gif": {
+                "checks": "A GIF in a view far larger than the screen shows (on Android each frame was cropped to the view's size, about 160 MB, and the app crashed drawing it).",
+                "steps": "Loads an 80x80 GIF that plays once, magenta then cyan, into a 2400x2400 view with cover, drawn 20 times smaller with a transform. Passes once it has loaded (and a moment more).",
+                "shows": "A 120x120 cyan square. The app closing is a failure."
+            },
+            "large-view-placeholder": {
+                "checks": "A placeholder url in a view far larger than the screen shows while the image loads (on Android it was loaded at the view's size, about 160 MB, and the app crashed drawing it).",
+                "steps": "The large-view case, with the image from the slow server (about 4 s) and a placeholder url of the logo, which shows meanwhile. Passes once the image has loaded (and a moment more).",
+                "shows": "A 120x120 square of four colors: red, green, blue and yellow quadrants. The app closing is a failure."
+            }
+        }
+    },
     "loading": {
         "description": {
             "checks": "Loading: props that don't reload, source changes, onLoadStart and onProgress, cache: 'web' and cookies."
```

---

### Incident Patch 2: `f669c7c0` (2026-10-27)
**Commit Message**: fix(ios): draw every SVG in the load, at its own size for a full-size load (#1392)

* fix(ios): draw every SVG in the load, at its own size for a full-size load

A full-size load (downsample false, objectFit none, a preload) kept an SVG
as a vector image, which UIKit draws on the main thread at the view's size
whenever the view shows it at a new size: zoomed in on with a transform or
a zoomed ScrollView, it was scaled up from that and soft, which is what
downsample false is for. It's now drawn in the load at its own size (its
full size), at the screen's scale, at most 16 megapixels, so it's sharp
zoomed in on up to its own size, never drawn on the main thread, and a
tint is a template like any bitmap's. A url placeholder, shown as with
contain whatever objectFit is, now loads for the view's size also with
downsample false or objectFit none, so an SVG placeholder fills the view
sharp rather than being drawn at its own size and scaled up.

* test: svg-tint-placeholder, and the zoom cases' references with the SVG sharp

* fix(ios): draw a full-size load's SVG for the view if that's larger than its own size

downsample false drew an SVG at its own size only, so one shown larger
than th

**File**: `README.md` (modified, +1/-1)
```diff
@@ -421,7 +421,7 @@ Downloads, local files (`file://`, `content://`) and bundled images (`require()`
 Decodes a large image at about the size it's shown at, instead of at full size, so it takes much less memory.
 
 - `true`: an image at least twice the size its view needs is decoded at about the view's size (on Android, any image larger than its view), and an SVG is drawn at the size it's shown at. If the view grows, the image is decoded again for its new size (from the disk cache).
-- `false`: images are decoded at full size, e.g. for an image that's zoomed in on with a transform (a pinch-to-zoom viewer), which would otherwise show the smaller copy enlarged. **It uses more memory:** a 12-megapixel photo takes about 48 MB decoded, however small it's shown. On Android, an image over 16 megapixels (4096 × 4096, 64 MB) is decoded at the largest size under that, which Android can still draw. On iOS, an image over 64 megapixels (8192 × 8192) is decoded at 16 megapixels, except with `objectFit="none"`, which shows it at its own size.
+- `false`: images are decoded at full size, e.g. for an image that's zoomed in on with a transform (a pinch-to-zoom viewer), which would otherwise show the smaller copy enlarged. **It uses more memory:** a 12-megapixel photo takes about 48 MB decoded, however small it's shown. On Android, an image over 16 megapixels (4096 × 4096, 64 MB) is decoded at the largest size under that, which Android can still draw. On iOS, an image over 64 megapixels (8192 × 8192) is decoded at 16 megapixels, except with `objectFit="none"`, which shows it at its own size. On iOS, an SVG is drawn at its own size, or the view's if that's larger.
 
 It doesn't change `onLoad`'s width and height (the image's own size) or the cached file. Photo library images are always decoded at about the view's size. Android 16 and later decode animated WebP at full size either way, and scale it as they draw it.
 
```

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +77/-0)
```diff
@@ -3300,6 +3300,81 @@ function ObjectFitSizeCase() {
     )
 }
 
+// An SVG with downsample={false} in a view larger than its own size, once a
+// smaller view of it has loaded: drawn for the larger view, sharp. A full-size
+// load draws an SVG at its own size, or for the view if that's larger, and the
+// second view gets the first one's drawing from the memory cache, so it's
+// drawn again for it.
+function SvgFullSizeLargerCase() {
+    const [first, setFirst] = useState(false)
+    const [status, onLoad] = useLoadedThenOk(1)
+    const source = {
+        uri: imageUrl(`svg-rings.svg?svg-full-size-larger=${RUN}`),
+    }
+    return (
+        <View style={styles.row}>
+            <FastImage
+                style={{ width: 40, height: 40 }}
+                source={source}
+                downsample={false}
+                onLoad={() => setFirst(true)}
+            />
+            {first && (
+                <FastImage
+                    style={[{ width: 160, height: 160 }, styles.gap]}
+                    source={source}
+                    downsample={false}
+                    onLoad={onLoad}
+                />
+            )}
+            <CaseStatus
+                id="svg-full-size-larger"
+                status={first ? status : 'loading'}
+                description={{
+                    checks: 'An SVG with downsample={false} shown larger than its own size is drawn for the view, sharp, also when a smaller view of it loaded first (whose drawing the memory cache has).',
+                    steps: 'A 40 pt view loads a 20×20 SVG (three thin black rings on white) with downsample={false}; once it has loaded, a 160 pt view of the same url mounts. Passes a moment after that one loads; the screenshot checks the sharpness.',
+                    shows: 'The rings at 40 pt, then at 160 pt, both thin and sharp. Blurry or thick rings in the large one would mean it was scaled up from the small drawing.',
+                }}
+            />
+        </View>
+    )
+}
+
+// A tinted SVG as the placeholder, with objectFit none: a url placeholder is
+// shown as with contain, so it's drawn for the view's size, filling it, not
+// at its own size (24 pt) and scaled up as a full-size load would draw it.
+function SvgTintPlaceholderCase() {
+    const { status, setStatus, after } = usePlaceholderUrlStatus()
+    useEffect(() => () => void releaseThumbhashHold('svg-tint-placeholder'), [])
+    return (
+        <View style={styles.row}>
+            <FastImage
+                style={{ width: 160, height: 160 }}
+                source={{
+                    uri: thumbhashHeld('svg-tint-placeholder'),
+                    headers: SLOW_HEADERS,
+                }}
+                placeholder={imageUrl(
+                    `svg-icon.svg?svg-tint-placeholder=${RUN}`,
+                )}
+                objectFit="none"
+                tintColor="green"
+                onLoadStart={after}
+                onLoad={() => setStatus('onLoad: the download should be held')}
+            />
+            <CaseStatus
+                id="svg-tint-placeholder"
+                status={status}
+                description={{
+                    checks: 'A tinted SVG as the placeholder url, with objectFit none, is drawn for the size it fills, sharp (a url placeholder shows as with contain; drawn at its own size, 24 pt, it would be scaled up).',
+                    steps: 'A 160 pt view with objectFit="none" and tintColor green loads a photo the slow server holds, with placeholder set to the url of a 24×24 SVG icon (a black ring). Passes 1 s after onLoadStart; onLoad fails it.',
+                    shows: 'A green ring filling the 160 pt square, with sharp edges.',
+                }}
+            />
+        </View>
+    )
+}
+
 // A zoom viewer: a 30-point image shown 4 times larger, with a transform or
 // a zoomed ScrollView (iOS), as pinch-to-zoom does. downsample={false}
 // decodes the photo (a 1600x1000 page of text) at full size, so it stays
@@ -12763,6 +12838,8 @@ export const REGRESSION_GROUPS: RegressionGroup[] = [
                 }}
             />,
             <SvgSharpCase key="svg-sharp" />,
+            <SvgTintPlaceholderCase key="svg-tint-placeholder" />,
+            <SvgFullSizeLargerCase key="svg-full-size-larger" />,
         ],
     },
     {
```

**File**: `docs/comparisons.md` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ Potential issues in Expo Image: [issues/expo-image-issues.md](issues/expo-image-
 - **blurRadius.** Fast Image's looks the same whatever the file's resolution and platform, and a change sends no load events. Expo Image's depends on the image's resolution on iOS, is capped at 25 on Android, and reloads on Android. _(Code.)_
 - **Events.** Fast Image sends only the events an image has handlers for; Expo Image sends every event for every image, including progress per network chunk on Android. On Android, Expo Image's `onProgress` reaches only the view that started a shared load. _(Code.)_
 - **`alt`.** Both take it as the label after `accessibilityLabel`, and as the image's alt text on the web. Fast Image also makes an image with `alt` an accessibility element on iOS (an explicit `accessible` wins), so VoiceOver reads it (a label alone isn't read there). Expo Image only uses it as the label. _(Code.)_
-- **SVG on iOS.** Fast Image draws an SVG into a bitmap for the view's size in the load, off the main thread, so a cached one shows as fast as a PNG. Expo Image shows it as a vector image, which UIKit draws on the main thread (again on every frame of a size change), and with `tintColor` draws it at three times the pixels needed each way ([issues](issues/expo-image-issues.md#ios-svgs-are-drawn-on-the-main-thread-and-a-tinted-one-at-three-times-its-pixels-each-way)), on several threads at once, where Core Graphics can draw some edges wrong ([issues](issues/expo-image-issues.md#ios-tinted-svgs-drawn-at-the-same-time-can-come-out-with-wrong-pixels)); Fast Image draws one SVG at a time. _(Fast Image's measurements of vector images in its views; Expo Image's code.)_
+- **SVG on iOS.** Fast Image draws an SVG into a bitmap in the load, off the main thread (for the view's size, or with `downsample={false}` at its own size if that's larger, to stay sharp zoomed in on), so a cached one shows as fast as a PNG. Expo Image shows it as a vector image, soft when zoomed in on with a transform, which UIKit draws on the main thread (again on every frame of a size change), and with `tintColor` draws it at three times the pixels needed each way ([issues](issues/expo-image-issues.md#ios-svgs-are-drawn-on-the-main-thread-and-a-tinted-one-at-three-times-its-pixels-each-way)), on several threads at once, where Core Graphics can draw some edges wrong ([issues](issues/expo-image-issues.md#ios-tinted-svgs-drawn-at-the-same-time-can-come-out-with-wrong-pixels)); Fast Image draws one SVG at a time. _(Fast Image's measurements of vector images in its views; Expo Image's code.)_
 - **What Expo Image has that Fast Image doesn't.** SF Symbols (`sf:` sources, with symbol effects), `svgVariables` (CSS variables in SVGs), Live Text (`enableLiveTextInteraction`), `decodeFormat` (16-bit bitmaps on Android), `onDisplay`, `lockResourceAsync`/`reloadAsync`, and an `imageLoaded` event for expo-observe. _(Code.)_
 - **What Fast Image has that Expo Image doesn't.** `cache: 'web'` and `'cacheOnly'`, `loop`, `imageRendering` (`'pixelated'` and `'smooth'`), `onLoadEnd` with the load's result, `onError` with the HTTP status, a global default for fades (`setDefaults`), and cache limits in native config. _(Code.)_
 - **Platforms and install.** Fast Image needs React Native 0.83+ with the New Architecture and iOS/tvOS 15.1+ (Fast Image 9 for older setups); Expo Image 58 needs iOS/tvOS 16.4+ and its Expo SDK. Fast Image accepts any SDWebImage 5.x from 5.21.5, where Expo Image pins 5.21.x, and Expo Image adds libavif and libdav1d for AVIF on iOS, where Fast Image uses the system's decoder. Both can be in one app: Fast Image adds its Glide components to Expo Image's Glide setup on Android ([with expo-image](android-build-settings.md#with-expo-image)). _(Code.)_
```

**File**: `docs/formats.md` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ FastImage loads images with [Glide](https://github.com/bumptech/glide), which de
 
 SVG images (remote, bundled with `require()`, or local files) load with SDWebImageSVGCoder on iOS and AndroidSVG on Android, which FastImage includes. On Android, an app with AndroidSVG's other package (`com.caverock:androidsvg`) leaves FastImage's out: see [duplicate AndroidSVG classes](troubleshooting.md#duplicate-androidsvg-classes).
 
-An SVG is drawn at the size it's shown at, so it's sharp at any size, and then works like any other image: `objectFit`, `tintColor`, `blurRadius`, `transition` and caching. `onLoad` reports the SVG's own size: its `width` and `height`, or its `viewBox`'s (300x150 if it has neither). Animated SVGs (SMIL or CSS animations) show their first state.
+An SVG is drawn at the size it's shown at, so it's sharp at that size (with `downsample={false}`, on iOS at its own size if that's larger, for zooming in on it), and then works like any other image: `objectFit`, `tintColor`, `blurRadius`, `transition` and caching. `onLoad` reports the SVG's own size: its `width` and `height`, or its `viewBox`'s (300x150 if it has neither). Animated SVGs (SMIL or CSS animations) show their first state.
 
 ## Animated PNG (Android)
 
```

**File**: `docs/issues/expo-image-issues.md` (modified, +3/-3)
```diff
@@ -193,10 +193,10 @@ Fast Image's maintainers found these while comparing Fast Image with Expo Image.
 
 ## iOS: SVGs are drawn on the main thread, and a tinted one at three times its pixels each way
 
-- **What happens:** an SVG without `tintColor` is shown as a vector image, which UIKit draws on the main thread when the view shows it, and again on every frame its size changes. Fast Image measured the same vector images in its own views (iPhone 15 Pro Max, Release): 40 cached 24-point icons took 36 ms of the main thread to mount, against 11 ms as PNGs, and 7 illustrations (200 shapes) 112 ms, against 7 ms; one illustration animating its width blocked the main thread for 5–9 ms on every frame. With `tintColor`, the SVG is drawn into a bitmap in SDWebImage's decode, off the main thread, but at the view's size in pixels taken as points, so at three times the pixels needed each way on a 3× screen (a 24-point icon is 216 × 216 px, nine times the memory).
+- **What happens:** an SVG without `tintColor` is shown as a vector image, which UIKit draws on the main thread when the view shows it, and again on every frame its size changes. UIKit draws it at the view's size, so a view zoomed in on with a transform or a zoomed ScrollView (a pinch-to-zoom viewer) shows it scaled up and soft. Fast Image measured the same vector images in its own views (iPhone 15 Pro Max, Release): 40 cached 24-point icons took 36 ms of the main thread to mount, against 11 ms as PNGs, and 7 illustrations (200 shapes) 112 ms, against 7 ms; one illustration animating its width blocked the main thread for 5–9 ms on every frame. With `tintColor`, the SVG is drawn into a bitmap in SDWebImage's decode, off the main thread, but at the view's size in pixels taken as points, so at three times the pixels needed each way on a 3× screen (a 24-point icon is 216 × 216 px, nine times the memory).
 - **Where:** `packages/expo-image/ios/ImageView.swift`, `thumbnailPixelSize(for:)` returns the view's size in pixels only for `tintColor`, `enforceEarlyResizing` or photo library assets, and without it `SDImageSVGCoder` decodes a vector image. With it, `SDImageSVGCoder`'s `createBitmapSVGWithData:targetSize:preserveAspectRatio:` (SDWebImageSVGCoder 1.7.0, which expo-image's podspec pins with `~> 1.7.0`) draws the SVG at `targetSize` with `SDGraphicsBeginImageContextWithOptions(targetRect.size, NO, 0)`, and a scale of 0 is the screen's scale.
-- **How to reproduce:** Found by reading the code, not run; the main-thread times are Fast Image's own measurements of vector images in its views before [#1389](https://github.com/DylanVann/react-native-fast-image/pull/1389). Show a tinted 24-point SVG icon and check the image's `CGImage` size (216 × 216 on a 3× screen); show an SVG whose view animates its size and watch the main thread in Instruments.
-- **How Fast Image handles it:** an SVG is drawn into a bitmap for the view's size in pixels in the load, off the main thread, tinted or not, and kept in the memory cache at that size; it's drawn again when the view grows by a fifth, as other images are decoded again ([#1389](https://github.com/DylanVann/react-native-fast-image/pull/1389)).
+- **How to reproduce:** Found by reading the code, not run; the main-thread times are Fast Image's own measurements of vector images in its views before [#1389](https://github.com/DylanVann/react-native-fast-image/pull/1389), and the zoomed vector is what Fast Image's `zoom` cases showed before [#1392](https://github.com/DylanVann/react-native-fast-image/pull/1392). Show a tinted 24-point SVG icon and check the image's `CGImage` size (216 × 216 on a 3× screen); show an SVG whose view animates its size and watch the main thread in Instruments.
+- **How Fast Image handles it:** an SVG is drawn into a bitmap for the view's size in pixels in the load, off the main thread, tinted or not, and kept in the memory cache at that size; it's drawn again when the view grows by a fifth, as other images are decoded again ([#1389](https://github.com/DylanVann/react-native-fast-image/pull/1389)); with `downsample={false}` at its own size, or the view's if that's larger, so it's sharp zoomed in on up to its own size ([#1392](https://github.com/DylanVann/react-native-fast-image/pull/1392)).
 
 ## iOS: tinted SVGs drawn at the same time can come out with wrong pixels
 
```

**File**: `ios/FastImage/FFFDownsampledImage.h` (modified, +17/-3)
```diff
@@ -20,6 +20,14 @@ FOUNDATION_EXTERN id FFFWithSVGLock(id (^block)(void));
 // cover or fill) rather than fit in it (contain or scale-down). SDWebImage's
 // own thumbnail decoding can only fit, so this class works out the size from
 // the image's header before it decodes, as React Native's Image does.
+// The pixels per point an SVG of this size (in points) is drawn at for scale:
+// at most 16 megapixels.
+FOUNDATION_EXTERN CGFloat FFFDrawnSVGScale(CGSize size, CGFloat scale);
+
+// The scale that fits an image of this size (in points) in a box (in pixels),
+// or covers it, or zero.
+FOUNDATION_EXTERN CGFloat FFFBoxScale(CGSize size, CGSize box, BOOL cover);
+
 @interface FFFDownsampledImage : SDAnimatedImage
 
 // Sets a load's context to decode the image for a box (in pixels) to cover
@@ -29,12 +37,14 @@ FOUNDATION_EXTERN id FFFWithSVGLock(id (^block)(void));
 + (void) addToContext: (SDWebImageMutableContext*)context box: (CGSize)box cover: (BOOL)cover maxScale: (CGFloat)maxScale;
 
 // Sets a load's context to decode the image at full size, through this
-// class: an image over 64 megapixels at 16 megapixels unless `uncapped`.
-// Every FastImage load uses it, so loads of the same url
+// class: an image over 64 megapixels at 16 megapixels unless `uncapped`, and
+// an SVG drawn at its own size at `screenScale` (or kept a vector if it's
+// zero, for a load that only checks the file), or for `vectorBox` (in pixels,
+// to cover or fit) if that's larger. Every FastImage load uses it, so loads of the same url
 // can share a download: SDWebImage's downloader decodes each load of a
 // download with the first load's image class (and each with its own size),
 // and SDWebImage's own thumbnail decoding can't cover a box.
-+ (void) addFullSizeToContext: (SDWebImageMutableContext*)context uncapped: (BOOL)uncapped;
++ (void) addFullSizeToContext: (SDWebImageMutableContext*)context uncapped: (BOOL)uncapped screenScale: (CGFloat)screenScale vectorBox: (CGSize)vectorBox cover: (BOOL)cover;
 
 // The size of the full image (in points, like UIImage's size) that an image
 // loaded this way was decoded from, for onLoad, or zero for other images.
@@ -43,6 +53,10 @@ FOUNDATION_EXTERN id FFFWithSVGLock(id (^block)(void));
 // Whether an image loaded this way is an SVG drawn into a bitmap for the box.
 + (BOOL) isDrawnForBox: (UIImage*)image;
 
+// Whether an image loaded this way is an SVG a full-size load drew into a
+// bitmap (at its own size, or its vectorBox's).
++ (BOOL) isDrawnAtFullSize: (UIImage*)image;
+
 // Whether an image loaded this way is at least the size a full-size load
 // (not uncapped) decodes it at.
 + (BOOL) isFullSizeImage: (UIImage*)image;
```

**File**: `ios/FastImage/FFFDownsampledImage.m` (modified, +81/-26)
```diff
@@ -18,6 +18,13 @@
 // size (objectFit scale-down): the screen's scale, the most pixels per point
 // an SVG is drawn at (see FFFDrawnSVG).
 static SDImageCoderOption const FFFDecodeMaxScale = @"FFFDecodeMaxScale";
+// The decode options for a full-size load: the screen's scale, the pixels per
+// point an SVG is drawn at there (its own size), or zero to keep it a vector;
+// and the box (in pixels) to draw it for if that's larger, and whether it
+// covers it.
+static SDImageCoderOption const FFFDecodeScreenScale = @"FFFDecodeScreenScale";
+static SDImageCoderOption const FFFDecodeVectorBox = @"FFFDecodeVectorBox";
+static SDImageCoderOption const FFFDecodeVectorCover = @"FFFDecodeVectorCover";
 
 // The most pixels a full-size load decodes an image of at least twice that
 // size each way at (each frame, for an animated image): 4096 x 4096, 64 MB
@@ -103,26 +110,27 @@ id FFFWithSVGLock(id (^block)(void)) {
     }
 }
 
-// An SVG (a vector image, its size in points) drawn into a bitmap for a box
-// (in pixels) to fit in or cover, with at most maxScale pixels per point if
-// it's not zero, on SDWebImage's decode queue. Shown as a
-// vector, UIKit draws it on the main thread whenever the view shows it at a
-// new size (on an iPhone 15 Pro Max, mounting 40 cached 24-point icons took
-// 36 ms of the main thread against 11 ms as PNGs). It keeps the SVG's size in
-// points, with the pixels per point the box needs, so objectFit and onLoad
-// treat it as the SVG, and at most FFFMaxPixels (a thin SVG covering a box).
-static UIImage* FFFDrawnSVG(UIImage* image, CGSize box, BOOL cover, CGFloat maxScale) {
+// An SVG (a vector image, its size in points) drawn into a bitmap at scale
+// pixels per point, on SDWebImage's decode queue. Shown as a vector, UIKit
+// draws it on the main thread whenever the view shows it at a new size (on an
+// iPhone 15 Pro Max, mounting 40 cached 24-point icons took 36 ms of the main
+// thread against 11 ms as PNGs), at the view's size, so it's soft when the
+// view is zoomed in on with a transform. It keeps the SVG's size in points,
+// so objectFit and onLoad treat it as the SVG, and at most FFFMaxPixels (a
+// thin SVG covering a box, or a large one at its own size).
+CGFloat FFFDrawnSVGScale(CGSize size, CGFloat scale) {
+    if (size.width <= 0 || size.height <= 0 || scale <= 0) {
+        return 0;
+    }
+    return MIN(scale, sqrt(FFFMaxPixels / (size.width * size.height)));
+}
+
+static UIImage* FFFDrawnSVGAtScale(UIImage* image, CGFloat scale) {
     CGSize size = image.size;
-    if (size.width <= 0 || size.height <= 0 || box.width <= 0 || box.height <= 0) {
+    scale = FFFDrawnSVGScale(size, scale);
+    if (scale <= 0) {
         return nil;
     }
-    CGFloat widthRatio = box.width / size.width;
-    CGFloat heightRatio = box.height / size.height;
-    CGFloat scale = cover ? MAX(widthRatio, heightRatio) : MIN(widthRatio, heightRatio);
-    if (maxScale > 0) {
-        scale = MIN(scale, maxScale);
-    }
-    scale = MIN(scale, sqrt(FFFMaxPixels / (size.width * size.height)));
     UIGraphicsImageRendererFormat* format = [UIGraphicsImageRendererFormat preferredFormat];
     format.scale = scale;
     format.opaque = NO;
@@ -137,6 +145,25 @@ id FFFWithSVGLock(id (^block)(void)) {
     });
 }
 
+CGFloat FFFBoxScale(CGSize size, CGSize box, BOOL cover) {
+    if (size.width <= 0 || size.height <= 0 || box.width <= 0 || box.height <= 0) {
+        return 0;
+    }
+    CGFloat widthRatio = box.width / size.width;
+    CGFloat heightRatio = box.height / size.height;
+    return cover ? MAX(widthRatio, heightRatio) : MIN(widthRatio, heightRatio);
+}
+
+// An SVG drawn for a box (in pixels) to fit in or cover, with at most maxScale
+// pixels per point if it's not zero.
+static UIImage* FFFDrawnSVG(UIImage* image, CGSize box, BOOL cover, CGFloat maxScale) {
+    CGFloat scale = FFFBoxScale(image.size, box, cover);
+    if (maxScale > 0) {
+        scale = MIN(scale, maxScale);
+    }
+    return FFFDrawnSVGAtScale(image, scale);
+}
+
 // Where the decode puts the full image's size, passed in the load's decode
 // options. SDWebImage attaches those options to the image it ends up with
 // (sd_decodeOptions), also when its force decoding replaces the decoded image
@@ -146,6 +173,8 @@ @interface FFFSourceSize : NSObject
 // The image is an SVG drawn into a bitmap for the box (see FFFDrawnSVG): it
 // has no full size to decode at, so it's always smaller than one.
 @property (atomic, assign) BOOL drawnForBox;
+// The image is an SVG drawn into a bitmap by a full-size load.
+@property (atomic, assign) BOOL drawnAtFullSize;
 @end
 
 @implementation FFFSourceSize
@@ -276,11 +305,17 @@ - (void) clearWithCacheType: (SDImageCacheType)cacheType completion: (nullable S
 
 @implementation FFFDownsampledImage
 
-+ (void) addFullSizeToContext: (SDWebImageMutableContext*)context uncapped: (BOOL)uncapped {
++ (void) addFullSizeToContext: (SDWebImageMutableContext*)context uncapped: (B
```

**File**: `ios/FastImage/FFFastImageModule.mm` (modified, +6/-2)
```diff
@@ -2,6 +2,7 @@
 #import "RCTConvert+FFFastImage.h"
 #import "FFFastImageView.h"
 #import "FFFDownsampledImage.h"
+#import <React/RCTUtils.h>
 
 #import <SDWebImage/SDImageCache.h>
 #import <SDWebImage/SDImageCoderHelper.h>
@@ -142,7 +143,7 @@ + (void)initialize
     context[SDWebImageContextDownloadRequestModifier] = source.requestModifier;
     context[SDWebImageContextImageLoader] = source.imageLoader;
     context[SDWebImageContextCacheKeyFilter] = source.cacheKeyFilter;
-    [FFFDownsampledImage addFullSizeToContext:context uncapped:NO];
+    [FFFDownsampledImage addFullSizeToContext:context uncapped:NO screenScale:RCTScreenScale() vectorBox:CGSizeZero cover:NO];
     return context;
 }
 
@@ -311,7 +312,8 @@ - (void)preload:(NSArray *)sourcesJSON
                 // kept in memory, also when it comes from the disk cache. At
                 // full size even if it's over 64 megapixels: ImageIO decodes
                 // a smaller copy at once.
-                [FFFDownsampledImage addFullSizeToContext:context uncapped:YES];
+                // An SVG isn't drawn either (screen scale zero).
+                [FFFDownsampledImage addFullSizeToContext:context uncapped:YES screenScale:0 vectorBox:CGSizeZero cover:NO];
                 context[SDWebImageContextImageForceDecodePolicy] = @(SDImageForceDecodePolicyNever);
                 context[SDWebImageContextStoreCacheType] = @(SDImageCacheTypeDisk);
             }
@@ -382,6 +384,8 @@ - (void)getCachePath:(NSDictionary *)sourceJSON
         // the file is written.
         SDWebImageOptions options = FFFPreloadOptions(source) | SDWebImageWaitStoreCache;
         SDWebImageMutableContext *context = FFFPreloadContext(source);
+        // An SVG isn't drawn either (screen scale zero).
+        [FFFDownsampledImage addFullSizeToContext:context uncapped:NO screenScale:0 vectorBox:CGSizeZero cover:NO];
         context[SDWebImageContextImageForceDecodePolicy] = @(SDImageForceDecodePolicyNever);
         context[SDWebImageContextQueryCacheType] = @(SDImageCacheTypeDisk);
         context[SDWebImageContextStoreCacheType] = @(SDImageCacheTypeDisk);
```

---

### Incident Patch 3: `cc190432` (2026-10-27)
**Commit Message**: fix(ios): draw SVGs for the view's size in the load, off the main thread (#1389)

A downsampled load (the default) kept an SVG as a vector image, which UIKit draws on the main thread whenever the view shows it at a new size, and a tinted one was drawn into a bitmap on the main thread. Now the load draws the SVG into a bitmap for the view's size in pixels on SDWebImage's decode queue, tinted or not, keeping the SVG's size in points (objectFit and onLoad are unchanged). It's kept in the memory cache at that size and drawn again when the view grows by a fifth. With objectFit scale-down it's drawn at no more than the screen's scale, under its own memory cache key, after an app's own SDWebImage transformer. Full-size loads (downsample false, objectFit none) and data uris keep the vector image.

On an iPhone 15 Pro Max (Release), mounting 40 cached 24-point icons took 36 ms of the main thread (11.6 ms now; 11 ms as PNGs), 7 illustrations 112-120 ms (7 ms now), and an illustration animating its size blocked the main thread on every frame (not at all now).

**File**: `README.md` (modified, +1/-1)
```diff
@@ -420,7 +420,7 @@ Downloads, local files (`file://`, `content://`) and bundled images (`require()`
 
 Decodes a large image at about the size it's shown at, instead of at full size, so it takes much less memory.
 
-- `true`: an image at least twice the size its view needs is decoded at about the view's size (on Android, any image larger than its view). If the view grows, the image is decoded again for its new size (from the disk cache).
+- `true`: an image at least twice the size its view needs is decoded at about the view's size (on Android, any image larger than its view), and an SVG is drawn at the size it's shown at. If the view grows, the image is decoded again for its new size (from the disk cache).
 - `false`: images are decoded at full size, e.g. for an image that's zoomed in on with a transform (a pinch-to-zoom viewer), which would otherwise show the smaller copy enlarged. **It uses more memory:** a 12-megapixel photo takes about 48 MB decoded, however small it's shown. On Android, an image over 16 megapixels (4096 × 4096, 64 MB) is decoded at the largest size under that, which Android can still draw. On iOS, an image over 64 megapixels (8192 × 8192) is decoded at 16 megapixels, except with `objectFit="none"`, which shows it at its own size.
 
 It doesn't change `onLoad`'s width and height (the image's own size) or the cached file. Photo library images are always decoded at about the view's size. Android 16 and later decode animated WebP at full size either way, and scale it as they draw it.
```

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +50/-0)
```diff
@@ -3342,6 +3342,55 @@ function ObjectFitSvgCase() {
     )
 }
 
+// An SVG loading with objectFit scale-down, changed to contain before it has
+// loaded: it ends up drawn for contain, as sharp as the contain view next to
+// it. iOS draws an SVG smaller than a scale-down view at no more than its own
+// size, so it's drawn again for contain once it has loaded.
+function ObjectFitSvgChangeCase() {
+    const [contain, setContain] = useState(false)
+    const [status, onLoad] = useLoadedThenOk(2)
+    useEffect(() => {
+        const timer = setTimeout(() => setContain(true), 300)
+        return () => clearTimeout(timer)
+    }, [])
+    return (
+        <View style={objectFitStyles.stacked}>
+            <View style={objectFitStyles.images}>
+                <FastImage
+                    style={objectFitStyles.large}
+                    objectFit={contain ? 'contain' : 'scale-down'}
+                    source={{
+                        uri: slowImageUrl(
+                            'svg-stripes.svg?case=object-fit-svg-change&delay=150',
+                        ),
+                        headers: SLOW_HEADERS,
+                    }}
+                    onLoad={onLoad}
+                />
+                <FastImage
+                    style={[objectFitStyles.large, styles.gap]}
+                    objectFit="contain"
+                    source={{
+                        uri: imageUrl(
+                            'svg-stripes.svg?case=object-fit-svg-change-reference',
+                        ),
+                    }}
+                    onLoad={onLoad}
+                />
+            </View>
+            <CaseStatus
+                id="object-fit-svg-change"
+                status={status}
+                description={{
+                    checks: "An SVG whose objectFit changes from scale-down to contain while it loads is drawn for contain, sharp at the view's size.",
+                    steps: 'An 88-point view loads a 60x60 SVG of black and white stripes, one unit wide, from the slow server (8 parts, 150 ms apart) with scale-down, and changes to contain 300 ms later. An 88-point view next to it shows the same SVG with contain from the start. Passes once both have loaded; the screenshot checks the sharpness.',
+                    shows: 'Black and white stripes filling two squares, both with the same crisp stripes. Soft or gray stripes in the first are a failure.',
+                }}
+            />
+        </View>
+    )
+}
+
 // objectFit changed from cover to scale-down and none after load, while the
 // image for the new fit loads (slowly, from the slow server, with cache
 // 'web' so it isn't on disk): Android keeps the cover image as it was until
@@ -10736,6 +10785,7 @@ export const REGRESSION_GROUPS: RegressionGroup[] = [
             <ObjectFitSizeCase key="object-fit-size" />,
             <ObjectFitBlurCase key="object-fit-blur" />,
             <ObjectFitSvgCase key="object-fit-svg" />,
+            <ObjectFitSvgChangeCase key="object-fit-svg-change" />,
             <ObjectFitFromCoverCase key="object-fit-from-cover" />,
             <ObjectFitStyleCase key="object-fit-style" />,
             <ObjectFitChangeCase key="object-fit-change" />,
```

**File**: `docs/comparisons.md` (modified, +2/-1)
```diff
@@ -39,11 +39,12 @@ Potential issues in Expo Image: [issues/expo-image-issues.md](issues/expo-image-
 - **blurRadius.** Fast Image's looks the same whatever the file's resolution and platform, and a change sends no load events. Expo Image's depends on the image's resolution on iOS, is capped at 25 on Android, and reloads on Android. _(Code.)_
 - **Events.** Fast Image sends only the events an image has handlers for; Expo Image sends every event for every image, including progress per network chunk on Android. On Android, Expo Image's `onProgress` reaches only the view that started a shared load. _(Code.)_
 - **`alt`.** Both take it as the label after `accessibilityLabel`, and as the image's alt text on the web. Fast Image also makes an image with `alt` an accessibility element on iOS (an explicit `accessible` wins), so VoiceOver reads it (a label alone isn't read there). Expo Image only uses it as the label. _(Code.)_
+- **SVG on iOS.** Fast Image draws an SVG into a bitmap for the view's size in the load, off the main thread, so a cached one shows as fast as a PNG. Expo Image shows it as a vector image, which UIKit draws on the main thread (again on every frame of a size change), and with `tintColor` draws it at three times the pixels needed each way ([issues](issues/expo-image-issues.md#ios-svgs-are-drawn-on-the-main-thread-and-a-tinted-one-at-three-times-its-pixels-each-way)). _(Fast Image's measurements of vector images in its views; Expo Image's code.)_
 - **What Expo Image has that Fast Image doesn't.** SF Symbols (`sf:` sources, with symbol effects), `svgVariables` (CSS variables in SVGs), Live Text (`enableLiveTextInteraction`), `decodeFormat` (16-bit bitmaps on Android), `onDisplay`, `lockResourceAsync`/`reloadAsync`, and an `imageLoaded` event for expo-observe. _(Code.)_
 - **What Fast Image has that Expo Image doesn't.** `cache: 'web'` and `'cacheOnly'`, `loop`, `imageRendering` (`'pixelated'` and `'smooth'`), `onLoadEnd` with the load's result, `onError` with the HTTP status, a global default for fades (`setDefaults`), and cache limits in native config. _(Code.)_
 - **Platforms and install.** Fast Image needs React Native 0.83+ with the New Architecture and iOS/tvOS 15.1+ (Fast Image 9 for older setups); Expo Image 58 needs iOS/tvOS 16.4+ and its Expo SDK. Fast Image accepts any SDWebImage 5.x from 5.21.5, where Expo Image pins 5.21.x, and Expo Image adds libavif and libdav1d for AVIF on iOS, where Fast Image uses the system's decoder. Both can be in one app: Fast Image adds its Glide components to Expo Image's Glide setup on Android ([with expo-image](android-build-settings.md#with-expo-image)). _(Code.)_
 - **Background component.** Both have one (`FastImageBackground`, `ImageBackground`): a view the image fills, with the children on top. Fast Image gives View props (accessibility, focus, `testID`, layout, touch) to the view, and its own (`source`, `objectFit`, `onLoad`, …) to the image, with `imageProps` for any prop on the image instead. Expo Image's gives every prop but `style` to the image, so an accessibility label or `focusable` on it is the image's, behind the children. _(Code.)_
-- **At parity:** headers, `cacheKey`, `recyclingKey`, several sizes in `source` picked by the view's size, `tintColor` on still images, SVG, HEIC, `onProgress` with a 0–1 `progress` and no events while the total is unknown, tvOS, and padding (both ignore it). _(Code.)_
+- **At parity:** headers, `cacheKey`, `recyclingKey`, several sizes in `source` picked by the view's size, `tintColor` on still images, HEIC, `onProgress` with a 0–1 `progress` and no events while the total is unknown, tvOS, and padding (both ignore it). _(Code.)_
 
 ## React Native's Image
 
```

**File**: `docs/issues/expo-image-issues.md` (modified, +7/-0)
```diff
@@ -191,6 +191,13 @@ Fast Image's maintainers found these while comparing Fast Image with Expo Image.
 - **How to reproduce:** Found by reading the code (expo repository at `5599fba0d`), not run. Push a screen with an `Image` in a native stack, let it load and go back. Fast Image's regression case `navigation-pop-thumbhash` saw its own image go back to its placeholder there before the fix below.
 - **How Fast Image handles it:** on Android, a view dropped while it's still attached keeps its image, and its request is cleared once it's detached ([#1386](https://github.com/DylanVann/react-native-fast-image/pull/1386)).
 
+## iOS: SVGs are drawn on the main thread, and a tinted one at three times its pixels each way
+
+- **What happens:** an SVG without `tintColor` is shown as a vector image, which UIKit draws on the main thread when the view shows it, and again on every frame its size changes. Fast Image measured the same vector images in its own views (iPhone 15 Pro Max, Release): 40 cached 24-point icons took 36 ms of the main thread to mount, against 11 ms as PNGs, and 7 illustrations (200 shapes) 112 ms, against 7 ms; one illustration animating its width blocked the main thread for 5–9 ms on every frame. With `tintColor`, the SVG is drawn into a bitmap in SDWebImage's decode, off the main thread, but at the view's size in pixels taken as points, so at three times the pixels needed each way on a 3× screen (a 24-point icon is 216 × 216 px, nine times the memory).
+- **Where:** `packages/expo-image/ios/ImageView.swift`, `thumbnailPixelSize(for:)` returns the view's size in pixels only for `tintColor`, `enforceEarlyResizing` or photo library assets, and without it `SDImageSVGCoder` decodes a vector image. With it, `SDImageSVGCoder`'s `createBitmapSVGWithData:targetSize:preserveAspectRatio:` (SDWebImageSVGCoder 1.7.0, which expo-image's podspec pins with `~> 1.7.0`) draws the SVG at `targetSize` with `SDGraphicsBeginImageContextWithOptions(targetRect.size, NO, 0)`, and a scale of 0 is the screen's scale.
+- **How to reproduce:** Found by reading the code, not run; the main-thread times are Fast Image's own measurements of vector images in its views before [#1389](https://github.com/DylanVann/react-native-fast-image/pull/1389). Show a tinted 24-point SVG icon and check the image's `CGImage` size (216 × 216 on a 3× screen); show an SVG whose view animates its size and watch the main thread in Instruments.
+- **How Fast Image handles it:** an SVG is drawn into a bitmap for the view's size in pixels in the load, off the main thread, tinted or not, and kept in the memory cache at that size; it's drawn again when the view grows by a fifth, as other images are decoded again ([#1389](https://github.com/DylanVann/react-native-fast-image/pull/1389)).
+
 ## Other issues
 
 These were found while comparing the two libraries, but Fast Image has no counterpart for them, so there's no fix to point to.
```

**File**: `ios/FastImage/FFFDownsampledImage.h` (modified, +7/-2)
```diff
@@ -11,8 +11,10 @@
 @interface FFFDownsampledImage : SDAnimatedImage
 
 // Sets a load's context to decode the image for a box (in pixels) to cover
-// or fit in.
-+ (void) addToContext: (SDWebImageMutableContext*)context box: (CGSize)box cover: (BOOL)cover;
+// or fit in. An SVG is drawn into a bitmap for it, with at most maxScale
+// pixels per point if it's not zero (objectFit scale-down shows an image no
+// larger than its own size).
++ (void) addToContext: (SDWebImageMutableContext*)context box: (CGSize)box cover: (BOOL)cover maxScale: (CGFloat)maxScale;
 
 // Sets a load's context to decode the image at full size, through this
 // class: an image over 64 megapixels at 16 megapixels unless `uncapped`.
@@ -26,6 +28,9 @@
 // loaded this way was decoded from, for onLoad, or zero for other images.
 + (CGSize) sourceSizeOfImage: (UIImage*)image;
 
+// Whether an image loaded this way is an SVG drawn into a bitmap for the box.
++ (BOOL) isDrawnForBox: (UIImage*)image;
+
 // Whether an image loaded this way is at least the size a full-size load
 // (not uncapped) decodes it at.
 + (BOOL) isFullSizeImage: (UIImage*)image;
```

**File**: `ios/FastImage/FFFDownsampledImage.m` (modified, +99/-10)
```diff
@@ -7,12 +7,17 @@
 #import <SDWebImage/SDImageCodersManager.h>
 #import <SDWebImage/SDImageCache.h>
 #import <SDWebImage/SDWebImageManager.h>
+#import <SDWebImage/SDImageTransformer.h>
 
 // The decode option that carries the full image's size to the view.
 static SDImageCoderOption const FFFDecodeSourceSize = @"FFFDecodeSourceSize";
 // The decode option for a full-size load that decodes an image at its own
 // size however large it is (objectFit none, which shows it at that size).
 static SDImageCoderOption const FFFDecodeUncapped = @"FFFDecodeUncapped";
+// The decode option for a view that shows an image no larger than its own
+// size (objectFit scale-down): the screen's scale, the most pixels per point
+// an SVG is drawn at (see FFFDrawnSVG).
+static SDImageCoderOption const FFFDecodeMaxScale = @"FFFDecodeMaxScale";
 
 // The most pixels a full-size load decodes an image of at least twice that
 // size each way at (each frame, for an animated image): 4096 x 4096, 64 MB
@@ -63,12 +68,47 @@ static CGSize FFFPixelSize(NSData* data) {
     return CGSizeMake(width, height);
 }
 
+// An SVG (a vector image, its size in points) drawn into a bitmap for a box
+// (in pixels) to fit in or cover, with at most maxScale pixels per point if
+// it's not zero, on SDWebImage's decode queue. Shown as a
+// vector, UIKit draws it on the main thread whenever the view shows it at a
+// new size (on an iPhone 15 Pro Max, mounting 40 cached 24-point icons took
+// 36 ms of the main thread against 11 ms as PNGs). It keeps the SVG's size in
+// points, with the pixels per point the box needs, so objectFit and onLoad
+// treat it as the SVG, and at most FFFMaxPixels (a thin SVG covering a box).
+static UIImage* FFFDrawnSVG(UIImage* image, CGSize box, BOOL cover, CGFloat maxScale) {
+    CGSize size = image.size;
+    if (size.width <= 0 || size.height <= 0 || box.width <= 0 || box.height <= 0) {
+        return nil;
+    }
+    CGFloat widthRatio = box.width / size.width;
+    CGFloat heightRatio = box.height / size.height;
+    CGFloat scale = cover ? MAX(widthRatio, heightRatio) : MIN(widthRatio, heightRatio);
+    if (maxScale > 0) {
+        scale = MIN(scale, maxScale);
+    }
+    scale = MIN(scale, sqrt(FFFMaxPixels / (size.width * size.height)));
+    UIGraphicsImageRendererFormat* format = [UIGraphicsImageRendererFormat preferredFormat];
+    format.scale = scale;
+    format.opaque = NO;
+    // 8 bits per channel, as SVG colors are (not the display's extended range,
+    // which takes twice the memory).
+    format.preferredRange = UIGraphicsImageRendererFormatRangeStandard;
+    UIGraphicsImageRenderer* renderer = [[UIGraphicsImageRenderer alloc] initWithSize: size format: format];
+    return [renderer imageWithActions: ^(UIGraphicsImageRendererContext* context) {
+        [image drawInRect: CGRectMake(0, 0, size.width, size.height)];
+    }];
+}
+
 // Where the decode puts the full image's size, passed in the load's decode
 // options. SDWebImage attaches those options to the image it ends up with
 // (sd_decodeOptions), also when its force decoding replaces the decoded image
 // with another one, which drops anything kept on the image itself.
 @interface FFFSourceSize : NSObject
 @property (atomic, assign) CGSize size;
+// The image is an SVG drawn into a bitmap for the box (see FFFDrawnSVG): it
+// has no full size to decode at, so it's always smaller than one.
+@property (atomic, assign) BOOL drawnForBox;
 @end
 
 @implementation FFFSourceSize
@@ -86,6 +126,21 @@ - (NSUInteger) hash {
 
 @end
 
+// Gives a load its own memory cache key, which SDWebImage makes from the url,
+// the box and whether it's covered, not the decode options (see
+// FFFDecodeMaxScale). The image is unchanged.
+@interface FFFKeyTransformer : NSObject <SDImageTransformer>
+@property (nonatomic, copy) NSString* transformerKey;
+@end
+
+@implementation FFFKeyTransformer
+
+- (UIImage*) transformedImageWithImage: (UIImage*)image forKey: (NSString*)key {
+    return image;
+}
+
+@end
+
 // The cache a downsampled load reads the downloaded file from (SDWebImage's
 // original image cache): the manager's, without its memory, except for an
 // image decoded at full size, which full-size loads can use (5.21.5 keeps
@@ -191,24 +246,41 @@ + (void) addFullSizeToContext: (SDWebImageMutableContext*)context uncapped: (BOO
         : @{FFFDecodeSourceSize: [FFFSourceSize new]};
 }
 
-+ (void) addToContext: (SDWebImageMutableContext*)context box: (CGSize)box cover: (BOOL)cover {
++ (void) addToContext: (SDWebImageMutableContext*)context box: (CGSize)box cover: (BOOL)cover maxScale: (CGFloat)maxScale {
     context[SDWebImageContextAnimatedImageClass] = [FFFDownsampledImage class];
     // The memory cache key is the source's key with these (SDWebImage's
     // thumbnail key), so views of other sizes don't get this image. The disk
     // cache keeps the downloaded file under the source's key, for every size.
     context[SDWebImageContextImageThumb
```

**File**: `ios/FastImage/FFFastImageView.m` (modified, +19/-2)
```diff
@@ -56,6 +56,8 @@ @interface FFFastImageView ()
 // whether it covers it; zero for a full-size image.
 @property(nonatomic, assign) CGSize decodedBox;
 @property(nonatomic, assign) BOOL decodedCover;
+// The most pixels per point an SVG was drawn at for it (decodeMaxScale).
+@property(nonatomic, assign) CGFloat decodedMaxScale;
 // Whether it's decoded at full size however large (objectFit none).
 @property(nonatomic, assign) BOOL decodedUncapped;
 // Counts loads, so a quiet reload's completion can tell if it's still current.
@@ -704,6 +706,8 @@ - (void) showImage: (UIImage*)image {
             if (!image.CGImage) {
                 // A vector image (an SVG), which UIKit doesn't draw as a
                 // template: drawn into a bitmap at the size it's shown at.
+                // Only a full-size load's or a data uri's: a downsampled
+                // load draws it in the load (FFFDrawnSVG).
                 image = [self rasterizedImage: image];
             }
             image = [image imageWithRenderingMode: UIImageRenderingModeAlwaysTemplate];
@@ -1282,6 +1286,15 @@ - (CGSize) decodeBox {
     return CGSizeMake(ceil(size.width * scale), ceil(size.height * scale));
 }
 
+// The most pixels per point an SVG is drawn at for the box, or zero: the
+// screen's scale for scale-down, which shows it no larger than its own size.
+- (CGFloat) decodeMaxScale {
+    if (_objectFit != FFFObjectFitScaleDown) {
+        return 0;
+    }
+    return self.window.screen.scale ?: [UIScreen mainScreen].scale;
+}
+
 // Whether the image has to cover the box, rather than fit in it.
 - (BOOL) decodeCovers {
     return _objectFit == FFFObjectFitCover || _objectFit == FFFObjectFitFill;
@@ -1315,7 +1328,10 @@ - (void) reloadIfResized {
             return;
         }
         BOOL grew = box.width > self.decodedBox.width * 1.2 || box.height > self.decodedBox.height * 1.2;
-        if (!grew && (self.decodedCover || !cover)) {
+        // Or an SVG drawn for the box is no longer, or now, drawn at most
+        // at its own size (other images are decoded the same either way).
+        BOOL maxScaleChanged = [self decodeMaxScale] != self.decodedMaxScale && [FFFDownsampledImage isDrawnForBox: image];
+        if (!grew && (self.decodedCover || !cover) && !maxScaleChanged) {
             return;
         }
     }
@@ -1447,6 +1463,7 @@ - (SDWebImageContext*) loadContext {
     CGSize box = [self decodeBox];
     self.decodedBox = box;
     self.decodedCover = [self decodeCovers];
+    self.decodedMaxScale = CGSizeEqualToSize(box, CGSizeZero) ? 0 : [self decodeMaxScale];
     self.decodedUncapped = CGSizeEqualToSize(box, CGSizeZero) && _objectFit == FFFObjectFitNone;
     return [self contextForSource: _source box: box cover: self.decodedCover];
 }
@@ -1490,7 +1507,7 @@ - (SDWebImageContext*) contextForSource: (FFFastImageSource*)source box: (CGSize
         [FFFDownsampledImage forgetUnusableImageForURL: source.url context: context];
         return context;
     }
-    [FFFDownsampledImage addToContext: context box: box cover: cover];
+    [FFFDownsampledImage addToContext: context box: box cover: cover maxScale: [self decodeMaxScale]];
     if ([source isPhotoLibrary]) {
         // Photos makes the photo at the size asked for, with no file
         // downloaded: SDWebImage would keep this smaller copy on disk as the
```

**File**: `screenshots/main-android/descriptions.json` (modified, +5/-0)
```diff
@@ -472,6 +472,11 @@
                 "steps": "Loads an SVG of 60x60 black and white stripes, one unit wide, with scale-down and none in 72-point views, and with contain in a 60-point view (the reference). Passes once all three have loaded; the screenshot checks the sharpness.",
                 "shows": "Black and white stripes three times: centered in a gray 72-point square, again, then on their own at 60 points, all with the same crisp 1-unit stripes. Soft or gray stripes in the first two are a failure."
             },
+            "object-fit-svg-change": {
+                "checks": "An SVG whose objectFit changes from scale-down to contain while it loads is drawn for contain, sharp at the view's size.",
+                "steps": "An 88-point view loads a 60x60 SVG of black and white stripes, one unit wide, from the slow server (8 parts, 150 ms apart) with scale-down, and changes to contain 300 ms later. An 88-point view next to it shows the same SVG with contain from the start. Passes once both have loaded; the screenshot checks the sharpness.",
+                "shows": "Black and white stripes filling two squares, both with the same crisp stripes. Soft or gray stripes in the first are a failure."
+            },
             "object-fit-from-cover": {
                 "checks": "Changing objectFit from cover after load, while the image for the new fit loads: on Android the view keeps showing the cover image as it was until then, and iOS shows the new fit at once (Android stretched the cropped image to its own size, squashed with scale-down and enlarged about 12 times with none; changed twice before the first change loaded, it went blank).",
                 "steps": "Three 88-point views load a 1600x1000 page of text from the slow server with cache: 'web' (so it isn't on disk) and cover. Once all three have loaded, the first changes to scale-down, the second to none, and the third to scale-down and 150 ms later to none. Passes 800 ms after the change, while the new images are still loading, which is when the screenshot is taken.",
```

#### Recent Merged Pull Requests:
- **PR #1392** (2026-10-27): fix(ios): draw every SVG in the load, at its own size for a full-size load (@DylanVann)
- **PR #1391** (2026-10-27): test: zoom cases for downsample false, a transform and a zoomed ScrollView [skip actions] (@DylanVann)
- **PR #1390** (2026-10-27): fix(ios): draw SVGs one at a time (@DylanVann)
- **PR #1389** (2026-10-27): fix(ios): draw SVGs for the view's size in the load, off the main thread (@DylanVann)
- **PR #1388** (2026-10-27): test: run verify.mts on a phone named by ANDROID_SERIAL [skip actions] (@DylanVann)
- **PR #1386** (2026-10-26): fix(android): keep a popped screen's images while it slides away (@DylanVann)

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

## X. android): keep bitmaps for very large views under Android's drawing limit (#1379

**RULE**:
When implementing operations in `ReactNativeFastImageExample/src/RegressionExample.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in DylanVann/react-native-fast-image. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d11bb53f`: android): keep bitmaps for very large views under Android's drawing limit (#1379). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `ReactNativeFastImageExample/src/RegressionExample.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
// A view much larger than the screen (2400x2400, about 6300 px square on the
// Android emulator), drawn 20 times smaller with a transform. Glide fits an
// image to the view's size, so the bitmap would be about 160 MB, which Android
// won't draw ("Canvas: trying to draw too large bitmap"): the app crashed.
function LargeViewCase() {
    const [status, onLoad] = useLoadedThenOk(1)
    return (
        <View style={blurStyles.stacked}>
            <View style={downsampleStyles.largeViewClip}>
                <FastImage
                    style={downsampleStyles.largeView}
                    source={{ uri: imageUrl('quadrants.png?case=large-view') }}
                    onLoad={onLoad}
                />
            </View>
            <CaseStatus
                id="large-view"
                status={status}
                description={{
                    checks: "An image in a view far larger than the screen shows (on Android its bitmap was the view's size, about 160 MB, and the app crashed drawing it).",
                    steps: 'Loads a 20x20 image of four colored squares into a 2400x2400 view with cover, drawn 20 times smaller with a transform. Passes once it has loade
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d11bb53f` are properly handled with clean fallback behavior.
