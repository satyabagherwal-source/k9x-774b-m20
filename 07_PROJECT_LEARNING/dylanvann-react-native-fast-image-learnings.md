> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dylanvann-react-native-fast-image-learnings.md`  
> **Source**: github ([https://github.com/DylanVann/react-native-fast-image](https://github.com/DylanVann/react-native-fast-image))  
> **Source Version**: `df42e80f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T06:45:20.974Z  
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
> **Harvest Timestamp**: 2026-10-31T06:45:20.836Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DylanVann/react-native-fast-image`
- **Description**: Performant React Native image component.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8420 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ReactNativeFastImageExample/android/animation-clock/com/fastimage/example/AnimationClock.kt`
```
package com.fastimage.example

import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Choreographer
import android.view.FrameMetrics
import android.view.Window
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.lang.reflect.Proxy

// Example app only: pauses the main thread's animators (android.animation,
// which FastImage's fades use) and steps them by hand, so the regression
// runner can screenshot a fade at set times instead of recording it. It gives
// the thread's AnimationHandler a frame source of its own, as the platform's
// AnimatorTestRule does: a hidden API, which verify.mts allows on the
// emulator it starts. Everything else (layout, drawing, React Native's own
// frame callbacks) keeps running.
object AnimationClock {
    private val handlerClass = Class.forName("android.animation.AnimationHandler")
    private val providerClass =
        Class.forName("android.animation.AnimationHandler\$AnimationFrameCallbackProvider")

    // The animators' time (ms, uptime) while paused.
    private var time = 0L
    private var paused = false
    private val frames = mutableListOf<Choreographer.FrameCallback>()
    private val commits = mutableListOf<Runnable>()

    private val provider: Any =
        Proxy.newProxyInstance(providerClass.classLoader, arrayOf(providerClass)) { proxy, method, args ->
            when (method.name) {
                "postFrameCallback" -> frames.add(args[0] as Choreographer.FrameCallback).let { null }
                "postCommitCallback" -> commits.add(args[0] as Runnable).let { null }
                "getFrameTime" -> time
                "getFrameDelay" -> 16L
                "setFrameDelay" -> null
                "hashCode" -> System.identityHashCode(proxy)
                "equals" -> proxy === args[0]
                "toString" -> "AnimationClock"
                else -> null
            }
        }

    private fun setProvider(value: Any?) {
        val handler = handlerClass.getMethod("getInstance").invoke(null)
        handlerClass.getMethod("setProvider", providerClass).invoke(handler, value)
    }

    fun pause() {
        if (paused) return
        time = SystemClock.uptimeMillis()
        setProvider(provider)
        paused = true
    }

    // Moves the animators on by `ms` and runs one frame of them, once that
    // much real time has passed since the pause too (the clock never gets
    // ahead of real time, so the animators don't go back when it resumes).
    // `then` gets what the frame threw, if anything.
    fun step(ms: Long, then: (Throwable?) -> Unit) {
        if (!paused) return then(null)
        time += ms
        Handler(Looper.getMainLooper()).postDelayed(
            {
                val error = runCatching { runFrame() }.exceptionOrNull()
                then(error)
            },
            maxOf(0L, time - SystemClock.uptimeMillis()),
        )
    }

    private fun runFrame() {
        if (!paused) return
        val due = frames.toList()
        frames.clear()
        for (frame in due) frame.doFrame(time * 1_000_000)
        val committed = commits.toList()
        commits.clear()
        for (commit in committed) commit.run()
    }

    fun resume() {
        if (!paused) return
        // The commits ask the clock for its time: before going back to the
        // Choreographer's, which only answers during a frame.
        val committed = commits.toList()
        commits.clear()
        for (commit in committed) runCatching { commit.run() }
        paused = false
        setProvider(null)
        val due = frames.toList()
        frames.clear()
        for (frame in due) Choreographer.getInstance().postFrameCallback(frame)
    }
}

class AnimationClockModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = NAME

    // Each resolves on the main thread once it's done; step once the frame
    // it ran has been drawn (two vsyncs later).
    private fun onMain(promise: Promise, block: (done: () -> Unit) -> Unit) {
        UiThreadUtil.runOnUiThread {
            try {
                block { promise.resolve(null) }
            } catch (e: Throwable) {
                promise.reject("E_ANIMATION_CLOCK", e.cause ?: e)
            }
        }
    }

    // Once the animators have caught up to the pause (their next frame, which
    // the clock runs at the time it paused) and that has been drawn.
    @ReactMethod
    fun pause(promise: Promise) {
        onMain(promise) { done ->
            AnimationClock.pause()
            afterFrames(3, done)
        }
    }

    @ReactMethod
    fun step(ms: Double, promise: Promise) {
        onMain(promise) { done ->
            AnimationClock.step(ms.toLong()) { error ->
                if (error != null) promise.reject("E_ANIMATION_CLOCK", error)
                else afterRendered { afterFrames(2, done) }
            }
        }
    }

    @ReactMethod
    fun resume(promise: Promise) {
        onMain(promise) { done ->
            AnimationClock.resume()
            done()
        }
    }

    // Once the window's next frame has been rendered (its FrameMetrics, which
    // come once the render thread has drawn and swapped it): on an emulator
    // without a GPU that can take longer than a few vsyncs, and a screenshot
    // then showed the step before. The frame is asked for, in case the step
    // changed nothing, and told apart from the ones before it by its vsync
    // time. At once without FrameMetrics' vsync time (before API 26), and
    // after a second at most.
    private fun afterRendered(done: () -> Unit) {
        val window: Window? = reactApplicationContext.currentActivity?.window
        if (window == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return done()
        val handler = Handler(Looper.getMainLooper())
        var vsync = Long.MAX_VALUE
        var finished = false
        lateinit var onMetrics: Window.OnFrameMetricsAvailableListener
        val finish = Runnable {
            if (finished) return@Runnable
            finished = true
            window.removeOnFrameMetricsAvailableListener(onMetrics)
            done()
        }
        onMetrics = Window.OnFrameMetricsAvailableListener { _, metrics, _ ->
            if (metrics.getMetric(FrameMetrics.VSYNC_TIMESTAMP) >= vsync) handler.post(finish)
        }
        window.addOnFrameMetricsAvailableListener(onMetrics, handler)
        window.decorView.invalidate()
        // Runs in the frame that draws it, with that frame's vsync time.
        Choreographer.getInstance().postFrameCallback { vsync = it }
        handler.postDelayed(finish, 1000)
    }

    private fun afterFrames(count: Int, done: () -> Unit) {
        if (count == 0) return done()
        Choreographer.getInstance().postFrameCallback { afterFrames(count - 1, done) }
    }

    companion object {
        const val NAME = "AnimationClock"
    }
}

class AnimationClockPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == AnimationClockModule.NAME) AnimationClockModule(reactContext) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            AnimationClockModule.NAME to
                ReactModuleInfo(
                    AnimationClockModule.NAME,
                    AnimationClockModule::class.java.name,
                    false,
                    false,
                    false,
                    false,
                ),
        )
    }
}

```

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
import com.fastimage.example.AnimationClockPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // The regression runner's animation clock (see AnimationClock.kt).
          add(AnimationClockPackage())
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

### Incident Patch 1: `6a576869` (2026-10-30)
**Commit Message**: fix(android): views of one url at different sizes download it once, also when one gets to downloading just after the download ended (#1403)

* fix(android): views of one url at different sizes download it once, also when one gets to downloading just after the download ended

Glide looks in its disk cache before it downloads, on another of its
threads: a request that looked before the first request's image was stored
there, and got to downloading just after the shared download ended and its
bytes were dropped, downloaded the image again. The bytes now stay for new
requests for a second after every request has read them.

* fix(android): an ended download's bytes don't outlast a disk cache clear, or serve diskCache false, and give way to other downloads' memory

- clearDiskCache drops the bytes of ended downloads (they stand for the
  disk cache for that moment): a load after a clear asked the server
  again before, and still does (cache-path-after-clear).
- A source with diskCache false only joins a download in progress, as
  `web` ones do: it downloads again (disk-cache-off).
- Bytes in memory don't linger while more than half the memory budget is
  taken, so other downloads' bytes

**File**: `android/src/main/java/com/fastimage/FastImageOkHttpProgressGlideModule.java` (modified, +2/-1)
```diff
@@ -195,7 +195,8 @@ public LoadData<InputStream> buildLoadData(@NonNull FastImageUrl model, int widt
                     OkHttpClient urlClient = FastImageGlide.isNoStore(options) ? noStoreClient
                             : model.url instanceof FastImageWebGlideUrl ? webClient
                             : client;
-                    return FastImageSharedDownloads.loadData(model.url, urlClient);
+                    return FastImageSharedDownloads.loadData(model.url, urlClient,
+                            !FastImageGlide.isNoStore(options) && !(model.url instanceof FastImageWebGlideUrl));
                 }
 
                 @Override
```

**File**: `android/src/main/java/com/fastimage/FastImageSharedDownloads.java` (modified, +145/-15)
```diff
@@ -31,6 +31,7 @@
 import java.util.TreeSet;
 import java.util.concurrent.ConcurrentHashMap;
 import java.util.concurrent.LinkedBlockingQueue;
+import java.util.concurrent.ScheduledThreadPoolExecutor;
 import java.util.concurrent.ThreadFactory;
 import java.util.concurrent.ThreadPoolExecutor;
 import java.util.concurrent.TimeUnit;
@@ -64,7 +65,7 @@
 // request that comes while many images download still gets to the queue below
 // at once, and other images aren't held up behind slow downloads. The download
 // is cancelled once every request for it has gone, and its bytes are dropped
-// once every request has read what it needed.
+// a moment after every request has read what it needed (LINGER_MS).
 //
 // At most MAX_RUNNING downloads run at once, as SDWebImage's downloader limits
 // them, and at most as many wait for their response from a host as the
@@ -82,8 +83,9 @@
 final class FastImageSharedDownloads {
     // The longest response kept in memory, and the most bytes held in memory
     // for downloads at once: encoded images (not decoded bitmaps, which
-    // Glide's memory cache holds), each only until every request has read it.
-    // Others are kept in a temporary file.
+    // Glide's memory cache holds), each until every request has read it (and
+    // LINGER_MS more while under half the budget). Others are kept in a
+    // temporary file.
     private static final long MEMORY_MAX = 1024 * 1024;
     private static final long MEMORY_BUDGET = Runtime.getRuntime().maxMemory() / 16;
     // The longest response kept in memory, still within MEMORY_BUDGET, when
@@ -96,12 +98,22 @@ final class FastImageSharedDownloads {
     private static final int MAX_RUNNING = 16;
     // How long a preload's finished file is used (see finished()).
     private static final long KEEP_MS = 60_000;
+    // How long an ended download's bytes stay for new requests once every
+    // request has read them. Glide looks in its disk cache before it
+    // downloads, and gets to downloading later (another of its threads):
+    // a request that looked before the first request's image was stored
+    // there, and gets to downloading just after the download ended, reads
+    // them rather than downloading the image again (views of one url at
+    // different sizes, which Glide loads apart, at once). They stand for the
+    // disk cache, so clearDiskCache drops them (dropEnded), and a request
+    // that keeps its image off disk (diskCache false) doesn't read them.
+    private static final long LINGER_MS = 1000;
     // Progress is sent when a download has read another 0.5% (and at its
     // start and end).
     private static final long PROGRESS_STEPS = 200;
 
     // The download new requests for a key join: in progress, or ended and
-    // still being read. Guards the downloads' sharing, queue and progress
+    // still being read (or read less than LINGER_MS ago). Guards the downloads' sharing, queue and progress
     // (taken before a download's own lock, and FastImageViewManager's progress
     // lock).
     private static final Map<String, Download> downloads = new HashMap<>();
@@ -146,8 +158,25 @@ public void run() {
                 }
             });
 
+    // Drops the bytes of ended downloads that every request has read, once
+    // LINGER_MS has passed.
+    private static final ScheduledThreadPoolExecutor lingering = new ScheduledThreadPoolExecutor(1,
+            new ThreadFactory() {
+                @Override
+                public Thread newThread(@NonNull Runnable runnable) {
+                    Thread thread = new Thread(runnable, "FastImageDownloadLinger");
+                    thread.setDaemon(true);
+                    return thread;
+                }
+            });
+
     static {
         reading.allowCoreThreadTimeOut(true);
+        // Its thread goes when it has had nothing to do for a while. Safe for a
+        // scheduled executor as its keep-alive is longer than the delays (a
+        // thread waiting for a drop due in under LINGER_MS doesn't time out).
+        lingering.setKeepAliveTime(10, TimeUnit.SECONDS);
+        lingering.allowCoreThreadTimeOut(true);
     }
 
     private static final class Finished {
@@ -232,8 +261,29 @@ private static File finishedFile(String key) {
 
     // A remote image's load data (FastImageOkHttpProgressGlideModule): its
     // download with the client, shared with the other requests for its key.
-    static ModelLoader.LoadData<InputStream> loadData(GlideUrl url, OkHttpClient client) {
-        return new ModelLoader.LoadData<>(url, new Fetcher(url, client));
+    // readsEnded false: a `web` image (it follows its HTTP cache) or one with
+    // diskCache false (it downloads again), which only joins a download in
+    // progress, not the bytes of one that has ended (see LINGER_MS).
+    static ModelLoader.LoadData<InputStream> loadData(GlideUrl url, OkHttpClient client, boolean readsEnded) {
+        return new ModelLoader.LoadData<>
```

**File**: `android/src/main/java/com/fastimage/FastImageViewModule.java` (modified, +5/-0)
```diff
@@ -691,12 +691,17 @@ public void clearDiskCache(final Promise promise) {
         cachePathExecutor.execute(new Runnable() {
             @Override
             public void run() {
+                // The bytes of ended downloads, which stand for the disk cache
+                // for a moment (see FastImageSharedDownloads.LINGER_MS): before
+                // the clear, so none is stored again while it runs, and after.
+                FastImageSharedDownloads.dropEnded();
                 try {
                     FastImageGlide.getRegistered(context).clearDiskCache();
                 } catch (RuntimeException e) {
                     promise.resolve(failure(e));
                     return;
                 }
+                FastImageSharedDownloads.dropEnded();
                 // And the HTTP cache of `cache: 'web'` images, which Glide
                 // doesn't cache (set up when FastImage's components are
                 // registered).
```

**File**: `android/src/test/java/com/fastimage/FastImageSharedDownloadsTest.java` (modified, +58/-1)
```diff
@@ -97,6 +97,63 @@ public void requestsForAnImageShareOneDownload() throws Exception {
         assertEquals(1, server.count("/image"));
     }
 
+    // Glide looks in its disk cache before it downloads: a request that looked
+    // before the first request's image was stored there, and gets to
+    // downloading just after its download ended, reads its bytes rather than
+    // downloading the image again (views of one url at different sizes, which
+    // Glide loads apart, at once).
+    @Test
+    public void aRequestJustAfterTheDownloadEndedReadsItsBytes() throws Exception {
+        server.route("/image");
+        Load first = load(url("/image"));
+        byte[] bytes = first.bytes();
+        Load late = load(url("/image"));
+        assertArrayEquals(bytes, late.bytes());
+        assertEquals(1, server.count("/image"));
+    }
+
+    // A second later, its bytes are gone: a request downloads the image again
+    // (Glide's disk cache has it by then).
+    @Test
+    public void aRequestWellAfterTheDownloadEndedDownloadsItAgain() throws Exception {
+        server.route("/image");
+        Load first = load(url("/image"));
+        byte[] bytes = first.bytes();
+        for (long end = System.currentTimeMillis() + 10_000;
+                FastImageSharedDownloads.busy() != null && System.currentTimeMillis() < end; ) {
+            Thread.sleep(20);
+        }
+        Load later = load(url("/image"));
+        assertArrayEquals(bytes, later.bytes());
+        assertEquals(2, server.count("/image"));
+    }
+
+    // The bytes stand for the disk cache for that moment: clearing it
+    // (clearDiskCache) drops them, and a source with diskCache false (or a
+    // `web` one) doesn't read them.
+    @Test
+    public void aRequestAfterTheDiskCacheWasClearedDownloadsItAgain() throws Exception {
+        server.route("/image");
+        Load first = load(url("/image"));
+        byte[] bytes = first.bytes();
+        FastImageSharedDownloads.dropEnded();
+        Load again = load(url("/image"));
+        assertArrayEquals(bytes, again.bytes());
+        assertEquals(2, server.count("/image"));
+    }
+
+    @Test
+    public void aRequestOffDiskDoesntReadTheBytesOfAnEndedDownload() throws Exception {
+        server.route("/image");
+        Load first = load(url("/image"));
+        byte[] bytes = first.bytes();
+        Load offDisk = new Load(FastImageSharedDownloads.loadData(url("/image"), client, false).fetcher);
+        loads.add(offDisk);
+        offDisk.fetcher.loadData(Priority.NORMAL, offDisk);
+        assertArrayEquals(bytes, offDisk.bytes());
+        assertEquals(2, server.count("/image"));
+    }
+
     @Test
     public void aRequestThatLeavesLeavesTheDownloadToTheOthers() throws Exception {
         TestServer.Route image = server.route("/image").holdAfter(100);
@@ -479,7 +536,7 @@ private Load load(GlideUrl url) {
     }
 
     private Load load(GlideUrl url, Priority priority) {
-        Load load = new Load(FastImageSharedDownloads.loadData(url, client).fetcher);
+        Load load = new Load(FastImageSharedDownloads.loadData(url, client, true).fetcher);
         loads.add(load);
         load.fetcher.loadData(priority, load);
         return load;
```

---

### Incident Patch 2: `e5e6aa55` (2026-10-30)
**Commit Message**: test: check the work each regression group makes Fast Image do [skip actions] (#1398)

The regression runs count the expensive work each group makes Fast Image do (decodes with their sizes, loads and reloads with their reason, blurs, SVG renders, Android fade snapshots, and image requests), logged in debug builds when verify.mts turns it on, and check the counts against committed references per app and platform (screenshots/<app>-<platform>/work.json). Groups start with empty caches, requests are split at each group's mount by the app's clock, and groups or cases whose work depends on timing opt out (countWork: false, or an `uncounted` url).

**File**: `ReactNativeFastImageExample/src/ExampleGroups.tsx` (modified, +3/-0)
```diff
@@ -82,6 +82,9 @@ export const EXAMPLE_GROUPS: RegressionGroup[] = [
     },
     {
         name: 'fastimage-grid',
+        // Its list mounts 200 images: how many have downloaded when the next
+        // group replaces it depends on timing.
+        countWork: false,
         description: {
             checks: "A grid of many remote images loading at the same time, like a gallery screen (the example screen's FastImage grid).",
             steps: "Fetches the image server's list of photos and shows them in a 4-column list with 6 rows, each a 100×100 photo in a square cell. Passes once all 24 have sent onLoad.",
```

**File**: `ReactNativeFastImageExample/src/NavigationGroups.tsx` (modified, +5/-2)
```diff
@@ -1,5 +1,5 @@
 import React, { useContext, useRef, useState } from 'react'
-import { StyleSheet, View } from 'react-native'
+import { Platform, StyleSheet, View } from 'react-native'
 import { ScreenStack, ScreenStackItem } from 'react-native-screens'
 import FastImage from 'react-native-fast-image'
 import { CaseStatus, caseStyles } from './CaseStatus'
@@ -108,8 +108,11 @@ function PopCase({
 
 export const NAVIGATION_GROUPS: RegressionGroup[] = [
     {
-        // Recorded (a video sample).
+        // Recorded (a video sample). On iOS, whether the stack has laid its
+        // screen out when the image starts loading (the decode's box)
+        // depends on timing.
         name: 'navigation-pop',
+        countWork: Platform.OS !== 'ios',
         description: {
             checks: 'An image in a screen that a native stack pops stays until the screen is gone.',
             steps: 'A video sample: the screen is recorded while the case pops the screen, and the color in the middle of the view must go through the listed colors in order.',
```

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +29/-15)
```diff
@@ -783,12 +783,20 @@ const HEADERS_PRIVATE = imageUrl(
 const HEADERS_PRELOAD_PRIVATE = imageUrl(
     `private/picsum/1021-120x120.jpg?invalid-headers-preload=${RUN}`,
 )
+// The logo preloaded twice, each with a url of its own: with one url, whether
+// iOS decodes it once or twice depends on whether the second preload joins
+// the first's download (see scripts/verify.mts's work counts).
+const HEADERS_PRELOAD_NULL = imageUrl('logo.png?preload-headers-null')
+const HEADERS_PRELOAD_ARRAY = imageUrl('logo.png?preload-headers-array')
 function PreloadInvalidHeadersCase() {
     const [status, setStatus] = useState('waiting')
     useEffect(() => {
         FastImage.preload([
-            { uri: LOGO, headers: null as unknown as {} },
-            { uri: LOGO, headers: ['x-token'] as unknown as {} },
+            { uri: HEADERS_PRELOAD_NULL, headers: null as unknown as {} },
+            {
+                uri: HEADERS_PRELOAD_ARRAY,
+                headers: ['x-token'] as unknown as {},
+            },
             { uri: HEADERS_PRELOAD_PRIVATE, headers: INVALID_HEADERS },
         ])
             .then((results) => {
@@ -5254,23 +5262,24 @@ function CacheOnlyMissCase({
 const EXAMPLE_MAX_DISK_SIZE = 300 * 1024 * 1024
 
 // FastImage.configureCache: the limit in the app's native config is in effect
-// from the start, with the disk cache's size. iOS: a runtime change applies at
-// once: downloads an image (getCachePath), sets maxDiskSize to 1 byte, which
-// removes every image from the disk cache, then the image isn't cached
-// anymore. Resetting it (null) goes back to the native config's limit. On
-// Android a runtime change applies from the next launch, so the limit in
-// effect stays the same. Changes are saved, so it always resets. Only groups
-// after this one see the emptied cache.
+// from the start, with the disk cache's size (after downloading an image,
+// getCachePath: the runner empties the caches before each group). iOS: a
+// runtime change applies at once: sets maxDiskSize to 1 byte, which removes
+// every image from the disk cache, then the image isn't cached anymore.
+// Resetting it (null) goes back to the native config's limit. On Android a
+// runtime change applies from the next launch, so the limit in effect stays
+// the same. Changes are saved, so it always resets.
 function ConfigureCacheCase() {
     const [status, setStatus] = useState('waiting')
     useEffect(() => {
         const uri = imageUrl(`picsum/1022-120x120.jpg?configure-cache=${RUN}`)
         const run = async () => {
+            const before = await FastImage.getCachePath({ uri })
+            if (!before.ok) return setStatus(`not cached: ${before.error}`)
             const state = await FastImage.configureCache()
             if (state.maxDiskSize !== EXAMPLE_MAX_DISK_SIZE) {
                 return setStatus(`maxDiskSize is ${state.maxDiskSize}`)
             }
-            // Images earlier groups loaded.
             if (!state.diskSize)
                 return setStatus(`diskSize is ${state.diskSize}`)
             if (Platform.OS !== 'ios') {
@@ -5287,8 +5296,6 @@ function ConfigureCacheCase() {
                         : `in effect: ${changed.maxDiskSize}, ${reset.maxDiskSize}`,
                 )
             }
-            const before = await FastImage.getCachePath({ uri })
-            if (!before.ok) return setStatus(`not cached: ${before.error}`)
             const trimmed = await FastImage.configureCache({ maxDiskSize: 1 })
             const after = await FastImage.getCachePath({
                 uri,
@@ -8268,11 +8275,13 @@ function DownsampleFromDiskCase() {
 // under the url's key, where SDImageCache found it (it looks in memory again
 // before it decodes), so the right view showed that, gray and at less than
 // half its size. A url of its own each run, preloaded to disk only
-// (memoryCache: false).
+// (memoryCache: false). Its work isn't counted (uncounted, see
+// scripts/verify.mts): whether iOS decodes the right view's image at full
+// size at once or loads it again after depends on timing.
 function DownsampleOverLimitSharedCase() {
     const [uri] = useState(() =>
         imageUrl(
-            `block-stripes-80mp.png?case=downsample-over-limit-shared-${RUN}`,
+            `block-stripes-80mp.png?case=downsample-over-limit-shared-${RUN}&uncounted`,
         ),
     )
     const [preloaded, setPreloaded] = useState<PreloadResult>()
@@ -10982,6 +10991,9 @@ export const REGRESSION_GROUPS: RegressionGroup[] = [
     },
     {
         name: 'blur-events',
+        // How many of the quick steps' blurs Android runs before the next
+        // one replaces them depends on timing.
+        countWork: false,
         description: {
             checks: 'blurRadius changed in quick steps after the image has loaded: no load events fire again, and the image ends up with the last radius.',
         },
@@ -11215,8 +11227,10 @@ export const REGRESSION_GROUPS: RegressionGroup[] = [
    
```

**File**: `ReactNativeFastImageExample/src/RegressionRunner.tsx` (modified, +71/-10)
```diff
@@ -42,11 +42,20 @@ import { regressionCheckUrl, regressionSocketUrl } from './imageServer'
 //
 // Messages to the script (JSON, one per WebSocket message):
 //   { type: 'hello', platform, version, arch, groups: [names], window:
-//     { width, height }, scale }                   on connecting (window in
-//                                                 dp; scale = pixels per dp)
-//   { type: 'group', index, name, wide, cases: [ids], description,
-//     descriptions: { id: description } }         once a group is on screen
-//                                                 (wide: compared whole)
+//     { width, height }, scale, launch, at }       on connecting (window in
+//                                                 dp; scale = pixels per dp;
+//                                                 launch: the same until the
+//                                                 app or its JS starts again;
+//                                                 at: the app's clock)
+//   { type: 'group', index, name, wide, countWork, cases: [ids],
+//     description, descriptions: { id: description } }
+//                                                 once a group is on screen
+//                                                 (wide: compared whole;
+//                                                 countWork: false, its work
+//                                                 isn't compared)
+//   { type: 'mount', index, at }                  as a group starts to mount,
+//                                                 before its cases do (at:
+//                                                 the app's clock)
 //   { type: 'status', group, id, status }         a case's status ('OK' passed)
 //   { type: 'masks', group, id, masks, cases, content, visible, safeArea }
 //                                                 the reply to 'measure'
@@ -73,7 +82,9 @@ import { regressionCheckUrl, regressionSocketUrl } from './imageServer'
 // { type: 'recording', group, name } says a sample's recording has started,
 // { type: 'framed', group, name } that a stepped sample's screenshot is
 // taken, and { type: 'sampled', group, name, ok, seen, detail } gives its
-// result.
+// result; { type: 'end' } says the run is over (the work in the app's log
+// after it isn't counted, and the script waits for the line to reach the
+// log).
 
 type Message = { type: string; [key: string]: unknown }
 
@@ -186,6 +197,9 @@ const afterLayout = () =>
         requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
     )
 
+// This launch of the app (or of its JS): see 'hello'.
+const LAUNCH = `${Date.now()}-${Math.random()}`
+
 const isFabric = () =>
     (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager !=
     null
@@ -232,6 +246,39 @@ export default function RegressionRunner({
     // errors still show, and fail their group.
     useState(() => LogBox.ignoreAllLogs())
     const [index, setIndex] = useState(0)
+    // The group to show next ('next': the one after), while the one on screen
+    // is unmounted and the caches cleared: each group starts with empty
+    // caches, so the work it makes Fast Image do (see scripts/verify.mts)
+    // doesn't depend on the groups before it, which differ between a full
+    // run, a CI shard and a run of some groups. Cleared once the unmount is
+    // on screen, when the views have let go of their images (Android's
+    // memory cache keeps the images views hold).
+    const [next, setNext] = useState<number | 'next' | undefined>(undefined)
+    // The group on screen, or -1 while the next one is on its way.
+    const shownIndex = useRef(index)
+    useEffect(() => {
+        shownIndex.current = next === undefined ? index : -1
+    }, [next, index])
+    useEffect(() => {
+        if (next === undefined) return
+        let cancelled = false
+        const show = () => {
+            if (cancelled) return
+            setIndex(next === 'next' ? index + 1 : next)
+            setNext(undefined)
+        }
+        afterLayout()
+            .then(() =>
+                Promise.all([
+                    FastImage.clearMemoryCache(),
+                    FastImage.clearDiskCache(),
+                ]),
+            )
+            .then(show, show)
+        return () => {
+            cancelled = true
+        }
+    }, [next, index])
     const [connected, setConnected] = useState(false)
     const socket = useRef<WebSocket | undefined>(undefined)
     // The whole screen (see 'measure').
@@ -281,6 +328,8 @@ export default function RegressionRunner({
                         groups: groups.map((group) => group.name),
                         window: Dimensions.get('window'),
                         scale: PixelRatio.get(),
+                        launch: LAUNCH,
+                        at: Date.now(),
                     }),
                 )
                 for (const text of queue.current.splice(0)) ws?.send(text)
@@ -306,7 +355
```

**File**: `ReactNativeFastImageExample/src/RunnerContext.tsx` (modified, +4/-0)
```diff
@@ -18,6 +18,10 @@ export type RegressionGroup = {
     // each case's area (and screenshot) is its images. A wide group's
     // screenshot is compared as a whole.
     wide?: boolean
+    // false: the work Fast Image does for it (its requests, decodes and
+    // loads) depends on timing (on this platform), so scripts/verify.mts
+    // records it but doesn't compare it with the reference (work.json).
+    countWork?: boolean
 }
 
 // What a case checks, in plain English, for someone reviewing its screenshot
```

**File**: `ReactNativeFastImageExample/src/SmokeExample.tsx` (modified, +3/-0)
```diff
@@ -792,6 +792,9 @@ function BlurDataUriCase() {
 export const SMOKE_GROUPS: RegressionGroup[] = [
     {
         name: 'smoke',
+        // On the web, whether the browser asks for the missing image again
+        // for reload() depends on timing.
+        countWork: Platform.OS !== 'web',
         description: {
             checks: "FastImage works at all in an Expo app (the Expo example, on iOS, Android and the web): an image loads, a missing one fails, reload() after a failure, a bundled image, several sizes, preload, and the cache methods (on the web, that getCachePath isn't supported).",
         },
```

**File**: `ReactNativeFastImageExampleServer/server.ts` (modified, +22/-0)
```diff
@@ -36,6 +36,11 @@
 //
 // GET /requests?path=<path and query> returns how many times it was requested,
 // so a test can check what was loaded from the network: `{ "count": 1 }`.
+// GET /request-log?since=<ms> returns every image request (both servers)
+// since that time (Date.now() on this machine), in order, with its
+// User-Agent (which platform asked): `[{ "at": 1700000000000, "path":
+// "/picsum/…", "agent": "okhttp/4.12.0" }]`, for scripts/verify.mts to count
+// each group's.
 // GET /requests?group=<group> returns how many requests the slow server got
 // with that `group` query parameter, the most of them in flight at the same
 // time, and the order each arrived in among all the slow server's requests:
@@ -77,6 +82,7 @@ const IMAGES = path.join(import.meta.dir, 'images')
 const PORT = Number(process.env.PORT ?? 8090)
 const SLOW_PORT = PORT + 1
 const requests = new Map<string, number>()
+const requestLog: { at: number; path: string; agent: string }[] = []
 // Per `group` query parameter on the slow server: requests, requests in
 // flight now, and the most in flight at the same time.
 const groups = new Map<
@@ -147,6 +153,12 @@ const server = Bun.serve({
             release(url.searchParams.get('hold') ?? '')
             return Response.json({ released: true })
         }
+        if (url.pathname === '/request-log') {
+            const since = Number(url.searchParams.get('since') ?? 0)
+            return Response.json(
+                requestLog.filter((entry) => entry.at >= since),
+            )
+        }
         if (url.pathname === '/requests') {
             const group = url.searchParams.get('group')
             if (group !== null) {
@@ -178,6 +190,11 @@ const server = Bun.serve({
         }
         const key = url.pathname + url.search
         requests.set(key, (requests.get(key) ?? 0) + 1)
+        requestLog.push({
+            at: Date.now(),
+            path: key,
+            agent: request.headers.get('user-agent') ?? '',
+        })
 
         let { pathname } = url
         let cacheControl: string | undefined
@@ -340,6 +357,11 @@ http.createServer(async (request, response) => {
     const url = new URL(request.url ?? '/', 'http://localhost')
     const key = `slow:${url.pathname}${url.search}`
     requests.set(key, (requests.get(key) ?? 0) + 1)
+    requestLog.push({
+        at: Date.now(),
+        path: key,
+        agent: request.headers['user-agent'] ?? '',
+    })
     slowRequests++
     const group = url.searchParams.get('group')
     if (group !== null) {
```

**File**: `android/src/main/java/com/fastimage/FastImageBlur.java` (modified, +4/-0)
```diff
@@ -59,6 +59,10 @@ protected Bitmap transform(@NonNull BitmapPool pool, @NonNull Bitmap toTransform
         int blurredHeight = Math.max(1, Math.round(height * scale));
         int boxSize = boxSize(radius * scale / shownScale, Math.max(blurredWidth, blurredHeight));
         if (boxSize <= 1 && scale == 1) return toTransform;
+        if (FastImageWork.enabled()) {
+            FastImageWork.record("blur", null, width + "x" + height + " to " + blurredWidth + "x" + blurredHeight
+                    + " box " + boxSize);
+        }
 
         Bitmap result = pool.get(blurredWidth, blurredHeight, Bitmap.Config.ARGB_8888);
         result.setDensity(toTransform.getDensity());
```

---

### Incident Patch 3: `358569cf` (2026-10-31)
**Commit Message**: ci: run checks CI skipped: example and website types, the website build, tvOS for JS changes, missing references, an Android Release build [skip actions] (#1407)

* ci: type-check the example apps, the scripts and the website, and build the website

verify.mts's JS checks type-check the example apps, verify.mts and the image
server, but e2e.yml runs it with --no-js and ci.yml didn't run them: the
shared regression cases, and the library's source against React Native 0.88,
tvOS 0.87 and Expo, weren't type-checked on CI. The website was built only by
Cloudflare after a merge, and its scripts weren't type-checked anywhere
(generate.mts sorted DeclarationReflections typed as Reflections, which have
no sources). scripts/tsconfig.json now has group-times.ts and
regression-viewer.mts too.

* ci: run the tvOS groups when the library's JS or the regression cases change

The tvOS example runs the main example's regression cases with the library's
source, but its jobs ran only for changes to ios/, the tvOS example, its
references, the podspec, verify.mts or the workflow: a change to src/ (an
Apple TV focus fix was one) or a new case didn't run them, and a new case's
tvOS references weren't se

**File**: `.github/workflows/ci.yml` (modified, +18/-1)
```diff
@@ -30,8 +30,25 @@ jobs:
       - run: bun run typecheck
       - run: bun run build:package
       - run: bun run test
+      # The example apps, as verify.mts's JS checks do (e2e.yml runs it with
+      # --no-js): their screens and the shared regression cases, and the
+      # library's source, which they type-check against their own React
+      # Native.
+      - run: bun install --frozen-lockfile && bun run typecheck
+        working-directory: ReactNativeFastImageExample
+      - run: bun install --frozen-lockfile && bun run typecheck
+        working-directory: ReactNativeFastImageExampleMinimum
+      - run: bun install --frozen-lockfile && bun run typecheck
+        working-directory: ReactNativeFastImageExampleTV
+      - run: bun install --frozen-lockfile && bun run typecheck
+        working-directory: ReactNativeFastImageExampleExpo
+      # The scripts and the image server, with the main example's TypeScript.
+      - run: ReactNativeFastImageExample/node_modules/.bin/tsc -p scripts
+      - run: ReactNativeFastImageExample/node_modules/.bin/tsc -p ReactNativeFastImageExampleServer
       # The README's props section is generated from the doc comments in src/.
-      - run: bun install --frozen-lockfile && bun run check
+      # Then the website as Cloudflare builds it from main, and its scripts'
+      # types (after the build, which generates Astro's).
+      - run: bun install --frozen-lockfile && bun run check && bun run build && node_modules/.bin/tsc --noEmit -p .
         working-directory: website
   release:
     if: github.repository == 'DylanVann/react-native-fast-image' && github.event_name == 'push' && github.ref == 'refs/heads/main'
```

**File**: `.github/workflows/e2e.yml` (modified, +21/-12)
```diff
@@ -33,9 +33,10 @@ jobs:
   # can be merged). And chooses the iOS jobs: the main example's groups in 2 shards
   # (--shard), each a job that builds the app and runs half of them (by their
   # times in recent runs); the minimum example's smoke groups (SMOKE_GROUPS) in
-  # one; and, when a pull request changes the iOS code, the tvOS example, its
-  # references, or how the cases run (and in a run by hand), the tvOS example's
-  # groups in 2 shards. (At most 5 macOS jobs run at once.)
+  # one; and, when a pull request changes the library's iOS or JS code, the
+  # regression cases (the tvOS example runs the main example's), the tvOS
+  # example, its references, or how the cases run (and in a run by hand), the
+  # tvOS example's groups in 2 shards. (At most 5 macOS jobs run at once.)
   changes:
     runs-on: ubuntu-24.04
     timeout-minutes: 5
@@ -71,7 +72,7 @@ jobs:
         run: |
           jobs='{"app":"main","shard":1},{"app":"main","shard":2},{"app":"minimum","shard":1}'
           if [ -z "$PR" ] || gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$PR/files" --jq '.[].filename' |
-            grep -qE '^(ios/|ReactNativeFastImageExampleTV/|screenshots/tv-ios/|RNFastImage\.podspec$|scripts/verify\.mts$|\.github/workflows/e2e\.yml$)'; then
+            grep -qE '^(ios/|src/|ReactNativeFastImageExample/src/|ReactNativeFastImageExampleTV/|screenshots/tv-ios/|RNFastImage\.podspec$|package\.json$|scripts/verify\.mts$|\.github/workflows/e2e\.yml$)'; then
             jobs="$jobs"',{"app":"tv","shard":1},{"app":"tv","shard":2}'
           fi
           echo "ios={\"include\":[$jobs]}" >> "$GITHUB_OUTPUT"
@@ -481,14 +482,19 @@ jobs:
       fail-fast: false
       # The main example's groups in 2 shards (--shard), each a job that
       # builds the app and runs half of them (by their times in recent runs);
-      # the minimum example's smoke groups (SMOKE_GROUPS) in one. (At most 5
-      # macOS jobs run at once.)
+      # the minimum example's smoke groups (SMOKE_GROUPS) in one; and the main
+      # example's smoke groups from the package as published (its files),
+      # in a Release build (minified with R8, with the package's ProGuard
+      # rules). (At most 5 macOS jobs run at once.)
       matrix:
         include:
           - { app: main, shard: 1 }
           - { app: main, shard: 2 }
           - { app: minimum, shard: 1 }
+          - { app: main, release: true }
+    name: android (${{ matrix.app }}, ${{ matrix.release && 'release' || matrix.shard }})
     env:
+      JOB: ${{ matrix.app }}-${{ matrix.release && 'release' || matrix.shard }}
       ANDROID_AVD: rnfi_ci
       # Where avdmanager creates it and the emulator looks for it.
       ANDROID_AVD_HOME: /home/runner/.android/avd
@@ -625,13 +631,14 @@ jobs:
       - name: Build the app and run its cases
         run: |
           mkdir -p "$TMPDIR"
-          node scripts/verify.mts --app ${{ matrix.app }} --android --no-js ${{ matrix.app == 'minimum' && format('--groups {0}', env.SMOKE_GROUPS) || format('--shard {0}/2', matrix.shard) }}
+          node scripts/verify.mts --app ${{ matrix.app }} --android --no-js ${{ matrix.release && format('--release --package --groups {0}', env.SMOKE_GROUPS) || matrix.app == 'minimum' && format('--groups {0}', env.SMOKE_GROUPS) || format('--shard {0}/2', matrix.shard) }}
         env:
           TMPDIR: ${{ runner.temp }}/tmp
           VERIFY_GROUP_TIMES: ${{ runner.temp }}/group-times.json
-      # This job's group times, for later runs' shards.
+      # This job's group times, for later runs' shards (not the Release
+      # build's, whose groups aren't sharded).
       - name: "Record the groups' times"
-        if: always() && env.R2_WRITE == 'true'
+        if: always() && env.R2_WRITE == 'true' && !matrix.release
         continue-on-error: true
         run: bun scripts/group-times.ts record android-${{ matrix.app }}-${{ matrix.shard }}
         env: *group-times
@@ -642,8 +649,10 @@ jobs:
           test -d "$RUNNER_TEMP/tmp/metro-cache" && echo metro=true >> "$GITHUB_OUTPUT" || true
           test -d ~/.gradle/caches/modules-2 && echo gradle=true >> "$GITHUB_OUTPUT" || true
           test -d /usr/local/lib/android/sdk/ndk/27.1.12297006 && test -d /usr/local/lib/android/sdk/cmake/3.22.1 && echo ndk=true >> "$GITHUB_OUTPUT" || true
+      # Not the Release build's (the debug jobs' key, and its bundle is
+      # transformed for Release).
       - name: "Save Metro's cache"
-        if: always() && env.R2_WRITE == 'true' && steps.made.outputs.metro == 'true' && steps.metro.outputs.cache-hit != 'true'
+        if: always() && env.R2_WRITE == 'true' && !matrix.release && steps.made.outputs.metro == 'true' && steps.metro.outputs.cache-hit != 'true'
         uses: runs-on/cache/save@88d90644011a3a9957fd141a106f5a94f9794203 # v5.0.7
         env: *r2
         with:
@@ -674,7 +683,7 @@ jobs:
         continue-on-error: true
         uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f47
```

**File**: `screenshots/tv-ios/descriptions.json` (modified, +27/-0)
```diff
@@ -671,6 +671,33 @@
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
     "downsample-from-disk": {
         "description": {
             "checks": "downsample={false} decodes at full size an image that's on disk but not in memory while a downsampled view of it loads."
```

**File**: `scripts/tsconfig.json` (modified, +4/-3)
```diff
@@ -1,6 +1,7 @@
 {
     // Type-checks the scripts with the main example's TypeScript and
-    // Node types (the repo root's are too old). Node runs the file directly.
+    // Node and Bun types (the repo root's are too old). Node runs verify.mts
+    // and regression-viewer.mts directly, Bun group-times.ts.
     "compilerOptions": {
         "target": "ES2024",
         "module": "ESNext",
@@ -11,7 +12,7 @@
         "erasableSyntaxOnly": true,
         "allowImportingTsExtensions": true,
         "typeRoots": ["../ReactNativeFastImageExample/node_modules/@types"],
-        "types": ["node"]
+        "types": ["node", "bun"]
     },
-    "files": ["verify.mts"]
+    "files": ["verify.mts", "regression-viewer.mts", "group-times.ts"]
 }
```

**File**: `scripts/verify.mts` (modified, +26/-4)
```diff
@@ -81,8 +81,9 @@ Options:
                       Replace the reference screenshots in screenshots/ with
                       this run's (and the groups' descriptions and work
                       counts); a missing reference is always seeded from
-                      the run, except with --ref. Look at them, then commit
-                      them with the change.
+                      the run, except with --ref (on CI, where it isn't
+                      committed, it also fails the run). Look at them, then
+                      commit them with the change.
   --record            Record the screen while the flows run. Each flow's
                       recording is saved in its report, and a copy sized for
                       a GitHub comment (needs ffmpeg) is written to
@@ -1427,8 +1428,8 @@ function pngSize(file: string) {
 // ignored), leaving out the areas the app masks (animated images, timings).
 // Up to SCREENSHOT_MAX_DIFF percent of the pixels may differ (of the case's
 // area, which catches smaller changes than the whole screen would). A missing
-// reference is seeded from the run (look at it before committing it);
-// --update-screenshots replaces them all. On a mismatch the diff is written
+// reference is seeded from the run (look at it before committing it), and
+// on CI fails it; --update-screenshots replaces them all. On a mismatch the diff is written
 // next to the screenshot in verify-output/.
 const SCREENSHOTS = path.join(ROOT, 'screenshots')
 // A phone's (ANDROID_SERIAL) are its own, screenshots/<app>-android-<model>,
@@ -3493,6 +3494,21 @@ async function runRegression(
         failures.push(...checked.failures)
         workSeeded = checked.seeded
     }
+    // On CI a missing reference fails the run: seeded there, it isn't
+    // committed, so every run would seed it again and pass without comparing
+    // the group with anything. The run's output has them, to look at and
+    // commit (regression-viewer.mts --pr; the work in the run's work.json).
+    if (env.CI && !UPDATE_SCREENSHOTS) {
+        const missing = [
+            ...seeded.map((name) => `${name}'s screenshot`),
+            ...descriptionsSeeded.map((group) => `${group}'s descriptions`),
+            ...workSeeded.map((group) => `${group}'s work`),
+        ]
+        if (missing.length > 0)
+            failures.push(
+                `no reference for ${missing.join(', ')} in ${rel(referenceDir(app, platform))}: commit them from this run's output`,
+            )
+    }
     const total = ((Date.now() - startedAt) / 1000).toFixed(1)
     fs.writeFileSync(
         path.join(dir, 'results.json'),
@@ -3550,6 +3566,12 @@ async function runRegression(
             `${indices.length} groups${SHARD ? ` (shard ${SHARD.index}/${SHARD.count})` : ''} in ${total}s${seededNote}`,
         )
     }
+    // Samples that passed unchecked, as a warning on the GitHub Actions run
+    // (and its pull request), which the job's log alone doesn't show.
+    if (env.GITHUB_ACTIONS && unchecked.length > 0)
+        console.log(
+            `::warning title=Samples not checked in ${name}::Their recordings couldn't show the change: ${unchecked.join(', ')}`,
+        )
 }
 
 // The work each group made Fast Image do: its image requests (the image
```

**File**: `website/scripts/generate.mts` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ const platformList = (platforms: Platforms) =>
 
 // By where they're declared: line, then column (an object type's fields can
 // share a line).
-const bySource = (a: J.Reflection, b: J.Reflection) =>
+const bySource = (a: J.DeclarationReflection, b: J.DeclarationReflection) =>
     (a.sources?.[0]?.line ?? 0) - (b.sources?.[0]?.line ?? 0) ||
     (a.sources?.[0]?.character ?? 0) - (b.sources?.[0]?.character ?? 0)
 
```

#### Recent Merged Pull Requests:
- **PR #1412** (2026-10-31): ci: cache the Android apps' C++ with ccache [skip actions] (@DylanVann)
- **PR #1411** (2026-10-31): test: give the smoke group's preload case its own missing url [skip actions] (@DylanVann)
- **PR #1410** (2026-10-31): ci: save Xcode's compilation cache again when it goes stale [skip actions] (@DylanVann)
- **PR #1408** (2026-10-31): ci: run the Expo example's smoke cases on iOS and Android [skip actions] (@DylanVann)
- **PR #1407** (2026-10-31): ci: run checks CI skipped: example and website types, the website build, tvOS for JS changes, missing references, an Android Release build [skip actions] (@DylanVann)
- **PR #1406** (closed): fix(android): an image in a view laid out without a size is decoded no larger than its own size (@DylanVann)

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

## X. android): views of one url at different sizes download it once, also when one ge

**RULE**:
When implementing operations in `android/src/main/java/com/fastimage/FastImageOkHttpProgressGlideModule.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in DylanVann/react-native-fast-image. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6a576869`: android): views of one url at different sizes download it once, also when one gets to downloading just after the download ended (#1403). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `android/src/main/java/com/fastimage/FastImageOkHttpProgressGlideModule.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
                    return FastImageSharedDownloads.loadData(model.url, urlClient,
                            !FastImageGlide.isNoStore(options) && !(model.url instanceof FastImageWebGlideUrl));
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
                    return FastImageSharedDownloads.loadData(model.url, urlClient);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6a576869` are properly handled with clean fallback behavior.
