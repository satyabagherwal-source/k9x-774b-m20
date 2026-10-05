# Forensic Learning Record (Deep Inspection): wix/react-native-navigation

> **Canonical Artifact**: `07_PROJECT_LEARNING/wix-react-native-navigation-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wix/react-native-navigation](https://github.com/wix/react-native-navigation))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:06:13.932Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wix/react-native-navigation`
- **Description**: A complete native navigation solution for React Native
- **Primary Language / Ecosystem**: MDX
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 13175 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/AnimationListener.kt`
```
package com.reactnativenavigation.utils

open class ScreenAnimationListener {
    open fun onStart() {}

    open fun onEnd() {}

    open fun onCancel() {}
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/BorderRadiusOutlineProvider.kt`
```
package com.reactnativenavigation.utils

import android.graphics.Outline
import android.os.Build
import android.view.View
import android.view.ViewOutlineProvider
import android.widget.ImageView
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.LOLLIPOP)
class BorderRadiusOutlineProvider(private val image: ImageView, initialRadius: Float) : ViewOutlineProvider() {
    var radius: Float = initialRadius
        private set

    override fun getOutline(view: View, outline: Outline) = outline.setRoundRect(
            0,
            0,
            image.clipBounds?.width() ?: image.width,
            image.clipBounds?.height() ?: image.height,
            radius
    )

    fun updateRadius(radius: Float) {
        this.radius = radius
        image.invalidateOutline()
    }
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/Context.kt`
```
package com.reactnativenavigation.utils

import android.content.Context
import android.content.res.Configuration
import androidx.appcompat.app.AppCompatDelegate
import com.facebook.react.ReactApplication
import com.reactnativenavigation.NavigationApplication

fun Context.isDebug(): Boolean {
    return (applicationContext as ReactApplication).reactNativeHost.useDeveloperSupport
}
fun isDarkMode() = NavigationApplication.instance.isDarkMode()
fun Context.isDarkMode(): Boolean = when (AppCompatDelegate.getDefaultNightMode()) {
    AppCompatDelegate.MODE_NIGHT_YES -> true
    AppCompatDelegate.MODE_NIGHT_NO -> false
    else -> resources.configuration.isDarkMode()
}
fun Configuration.isDarkMode() =
    (uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/IdFactory.kt`
```
package com.reactnativenavigation.utils


class IdFactory {
    companion object {
        private val stringIdToIntId = HashMap<String, Int>()
        private var count = 0

        fun get(id: String): Int {
            return if (stringIdToIntId.containsKey(id)) {
                stringIdToIntId[id]!!
            } else {
                (++count).apply { stringIdToIntId[id] = count }
            }
        }
    }
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/ImageLoader.kt`
```
package com.reactnativenavigation.utils

import android.app.Activity
import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.StrictMode
import androidx.core.content.ContextCompat
import com.facebook.react.views.imagehelper.ResourceDrawableIdHelper
import com.reactnativenavigation.R
import java.io.FileNotFoundException
import java.io.IOException
import java.io.InputStream
import java.net.URL
import java.util.*

open class ImageLoader {
    interface ImagesLoadingListener {
        fun onComplete(drawable: List<Drawable>)
        fun onComplete(drawable: Drawable)
        fun onError(error: Throwable?)
    }

    open fun getBackButtonIcon(context: Activity): Drawable? {
        val isRTL = context.window.decorView.isRTL()
        return ContextCompat.getDrawable(context, if (isRTL) R.drawable.ic_arrow_back_black_rtl_24dp else R.drawable.ic_arrow_back_black_24dp)
    }

    open fun loadIcon(context: Context, uri: String?): Drawable? {
        if (uri == null) return null
        try {
            return getDrawable(context, uri)
        } catch (e: IOException) {
            e.printStackTrace()
        }
        return null
    }

    open fun loadIcon(context: Context, uri: String, listener: ImagesLoadingListener) {
        try {
            listener.onComplete(getDrawable(context, uri))
        } catch (e: IOException) {
            listener.onError(e)
        }
    }

    open fun loadIcons(context: Context, uris: List<String>, listener: ImagesLoadingListener) {
        try {
            val drawables: MutableList<Drawable> = ArrayList()
            for (uri in uris) {
                val drawable = getDrawable(context, uri)
                drawables.add(drawable)
            }
            listener.onComplete(drawables)
        } catch (e: IOException) {
            listener.onError(e)
        }
    }

    @Throws(IOException::class)
    private fun getDrawable(context: Context, source: String): Drawable {
        var drawable: Drawable?
        if (isLocalFile(Uri.parse(source))) {
            drawable = loadFile(context, source)
        } else {
            drawable = loadResource(context, source)
            if (drawable == null && context.isDebug()) {
                drawable = readJsDevImage(context, source)
            }
        }
        if (drawable == null) throw RuntimeException("Could not load image $source")
        return drawable.mutate()
    }

    @Throws(IOException::class)
    private fun readJsDevImage(context: Context, source: String): Drawable {
        val threadPolicy = adjustThreadPolicyDebug(context)
        val `is` = openStream(context, source)
        val bitmap = BitmapFactory.decodeStream(`is`)
        restoreThreadPolicyDebug(context, threadPolicy)
        return BitmapDrawable(context.resources, bitmap)
    }

    private fun isLocalFile(uri: Uri): Boolean {
        return FILE_SCHEME == uri.scheme
    }

    private fun loadFile(context: Context, uri: String): Drawable {
        val bitmap = BitmapFactory.decodeFile(Uri.parse(uri).path)
        return BitmapDrawable(context.resources, bitmap)
    }

    private fun adjustThreadPolicyDebug(context: Context): StrictMode.ThreadPolicy? {
        var threadPolicy: StrictMode.ThreadPolicy? = null
        if (context.isDebug()) {
            threadPolicy = StrictMode.getThreadPolicy()
            StrictMode.setThreadPolicy(StrictMode.ThreadPolicy.Builder().permitNetwork().build())
        }
        return threadPolicy
    }

    private fun restoreThreadPolicyDebug(context: Context, threadPolicy: StrictMode.ThreadPolicy?) {
        if (context.isDebug() && threadPolicy != null) {
            StrictMode.setThreadPolicy(threadPolicy)
        }
    }

    companion object {
        private const val FILE_SCHEME = "file"
        private fun loadResource(context: Context, iconSource: String): Drawable? {
            return ResourceDrawableIdHelper.getInstance().getResourceDrawable(context, iconSource)
        }

        @Throws(IOException::class)
        private fun openStream(context: Context, uri: String): InputStream? {
            return if (uri.contains("http")) remoteUrl(uri) else localFile(context, uri)
        }

        @Throws(IOException::class)
        private fun remoteUrl(uri: String): InputStream {
            return URL(uri).openStream()
        }

        @Throws(FileNotFoundException::class)
        private fun localFile(context: Context, uri: String): InputStream? {
            return context.contentResolver.openInputStream(Uri.parse(uri))
        }
    }
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/ImageUtils.kt`
```
package com.reactnativenavigation.utils

import android.view.View
import android.view.ViewParent
import com.reactnativenavigation.react.ReactView
import com.reactnativenavigation.viewcontrollers.viewcontroller.overlay.OverlayLayout

fun areDimensionsWithInheritedScaleEqual(a: View, b: View): Boolean {
    val (aScaleX, aScaleY) = computeInheritedScale(a)
    val (bScaleX, bScaleY) = computeInheritedScale(b)
    return a.width * aScaleX == b.width * bScaleX &&
            a.height * aScaleY == b.height * bScaleY
}

fun computeInheritedScale(v: View): Scale {
    return computeInheritedScale(v.parent, Scale(x = v.scaleX, y = v.scaleY))
}

private fun computeInheritedScale(v: ViewParent, childrenScale: Scale): Scale {
    return if (v is ReactView || v is OverlayLayout || v.parent == null) {
        childrenScale
    } else {
        computeInheritedScale(v.parent, Scale(x = childrenScale.x * v.scaleX, y = childrenScale.y * v.scaleY))
    }
}

data class Scale(val x: Float, val y: Float)
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/Log.kt`
```
package com.reactnativenavigation.utils

import android.util.Log
import com.reactnativenavigation.BuildConfig

const val MAIN_LIB_TAG = "RNN";
fun logd(msg: String?, tag: String = MAIN_LIB_TAG) {
    if (BuildConfig.DEBUG) {
        if (msg != null)
            Log.d(tag, msg)
        else
            Log.d(tag, "Cannot log null msg: $msg")
    }
}

fun wran(msg: String?, tag: String = MAIN_LIB_TAG) {
    if (!BuildConfig.DEBUG) {
        if (msg != null)
            Log.w(tag, msg)
        else
            Log.w(tag, "Cannot log null msg: $msg")
    }
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/MotionEvent.kt`
```
package com.reactnativenavigation.utils

import android.graphics.Rect
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import com.reactnativenavigation.BuildConfig

val hitRect = Rect()

fun MotionEvent.coordinatesInsideView(view: View?): Boolean {
    val viewGroup = (view as? ViewGroup)?.getChildAt(0) as? ViewGroup ?: view

    viewGroup?.getHitRect(hitRect)
    return hitRect.contains(x.toInt(), y.toInt())

}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/OutlineProvider.kt`
```
package com.reactnativenavigation.utils

import android.graphics.Outline
import android.os.Build
import android.view.View
import android.view.ViewOutlineProvider
import androidx.annotation.RequiresApi
import com.reactnativenavigation.views.element.animators.ViewOutline
import kotlin.math.roundToInt

@RequiresApi(Build.VERSION_CODES.LOLLIPOP)
class OutlineProvider(
        private val view: View,
        private var outline: ViewOutline
) : ViewOutlineProvider() {
    val radius: Float
        get() = outline.radius

    override fun getOutline(view: View, outline: Outline) {
        outline.setRoundRect(
                0,
                0,
                this.outline.width.roundToInt(),
                this.outline.height.roundToInt(),
                this.outline.radius
        )
    }

    fun update(outline: ViewOutline) {
        this.outline = outline
        view.invalidateOutline()
    }
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/PrimitiveExt.kt`
```
package com.reactnativenavigation.utils

import android.content.res.Resources

val Int.dp: Int
    get() = (this * Resources.getSystem().displayMetrics.density).toInt()

val Float.dp: Int
    get() = (this * Resources.getSystem().displayMetrics.density).toInt()
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/ReactImageView.kt`
```
package com.reactnativenavigation.utils

import com.facebook.react.views.image.ReactImageView

fun ReactImageView.getCornerRadius(): Float {
    return hierarchy.roundingParams!!.cornersRadii!!.first()
}
```

### Core Architecture Module: `android/src/main/java/com/reactnativenavigation/utils/ReactViewGroup.kt`
```
package com.reactnativenavigation.utils

import com.facebook.react.views.view.ReactViewGroup

val ReactViewGroup.borderRadius: Float
    get() = 0f // CSSBackgroundDrawable is no longer available, return 0f as fallback
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8363** (2026-09-09): **iOS: Fix bottom tabs visibility on iOS 18**
  *Symptoms*: Restore bottom-tabs visibility across iOS versions after adopting the iOS 18 API. Resolved visibility now reconciles native state while retaining OS animation semantics.  - reconcile resolved `bottomTabs.visible` on iOS 18+; preserve legacy stack guard - default `bottomTabs.animate` to true; honor explicit and global false - keep initial layout visibility non-animated - avoid UIKit mutations when visibility already matches - add presenter and controller regression coverage - validate 57 native tests and full local iOS Detox: 20 suites, 173 passed
  **Post-Mortem & Fix Analysis**:
  > #rebuild
  > guycamon, it's been 21 days!!1 This is very important for our customer.

- **Issue #8342** (2026-08-12): **Update doc how to setup library with react native >= 0.85**
  *Symptoms*: How to properly setup MainApplication.kt with react native 0.85.2

- **Issue #8338** (2026-10-04): **Update package.json version to 8.8.11**
  *Symptoms*: Automated version bump to 8.8.11 from CI release.

- **Issue #8337** (2026-07-30): **[BottomTabsCustomRow] Fix crash attaching custom row to non-AppCompat activities**
  *Symptoms*: #### Problem  `BottomTabsCustomRowAttacher` is registered as process-wide `Application.ActivityLifecycleCallbacks`, so `tryAttach()` runs for **every** activity in the host app (from `onActivityCreated`, `onActivityStarted`, `onActivityResumed`, `registerOnce` and `rescan`).  `tryAttach()` resolved the overlay host with `Activity.findViewById(android.R.id.content)`. On an AppCompat activity that call routes through `AppCompatDelegateImpl.findViewById()`, which calls `ensureSubDecor()` -> `createSubDecor()`. `createSubDecor()` validates the theme and throws:  ``` java.lang.IllegalStateException: You need to use a Theme.AppCompat theme (or descendant) with this activity.   at androidx.appcompat.app.AppCompatDelegateImpl.createSubDecor(AppCompatDelegateImpl.java:902)   at androidx.appcompat.app.AppCompatActivity.findViewById(AppCompatActivity.java:264)   at com.reactnativenavigation.customrow.BottomTabsCustomRowAttacher.tryAttach(BottomTabsCustomRowAttacher.kt:96)   at com.reactnativenavigation.customrow.BottomTabsCustomRowAttacher.onActivityCreated(BottomTabsCustomRowAttacher.kt:55)   at android.app.Application.dispatchActivityCreated(Application.java:368) ```  The exception escapes `onActivityCreated`, so `performLaunchActivity()` raises a `RuntimeException` and Android force-finishes the activity. There is no `try/catch` on the path.  Any activity in the process that inherits a theme which is not a `Theme.AppCompat` descendant therefore crashes on creation, even though it has

- **Issue #8336** (2026-07-30): **fix(customrow): only attach BottomTabs custom row to NavigationActivity**
  *Symptoms*: ## Problem  Owner (Android) crashes during OAuth login. When AppAuth's `RedirectUriReceiverActivity` (the relay that receives the OAuth redirect) is created, the app dies with:  ``` RuntimeException: Unable to start activity ... RedirectUriReceiverActivity: IllegalStateException: You need to use a Theme.AppCompat theme (or descendant) with this activity.   at BottomTabsCustomRowAttacher.tryAttach(BottomTabsCustomRowAttacher.kt:96)   at BottomTabsCustomRowAttacher.onActivityCreated(BottomTabsCustomRowAttacher.kt:55) ```  **Sentry:** [WIX-ONE-APP-9GFHV](https://wix-o.sentry.io/issues/7535493012/) — ~5.9k events / 1.6k users, Android-only, still active.  ## Root cause  `BottomTabsCustomRowAttacher` is a **global** `Application.ActivityLifecycleCallbacks` and runs `tryAttach()` → `findViewById(android.R.id.content)` on **every** activity in the process. For a foreign, non-AppCompat-themed activity (AppAuth's relay), that `findViewById` forces `AppCompatDelegate` sub-decor inflation, which requires a `Theme.AppCompat` and throws. Any third-party non-AppCompat activity (OAuth relays, SDK login flows, etc.) hits this, not just AppAuth.  ## Fix  Guard the observer to RNN's own `NavigationActivity` — the only place `BottomTabs` (and thus the custom row) ever live. Foreign activities are skipped, so `findViewById` is never called on them.  ```kotlin private fun ensureLayoutObserver(activity: Activity) {     if (activity !is NavigationActivity) return     ... } private fun tryAttach(act

- **Issue #8335** (2026-10-04): **Update package.json version to 8.8.10**
  *Symptoms*: Automated version bump to 8.8.10 from CI release.

- **Issue #8333** (2026-06-23): **playground: regenerate Android buttons navbar snapshot**
  *Symptoms*: ## Summary - Regenerate `playground/e2e/assets/buttons_navbar.android.png` from the current Android `Buttons` screen rendering on `master` - Refresh the snapshot to match the current top-bar layout after the recent Android custom-button measurement changes - Keep the change scoped to the Android PNG asset only  ## Validation - `rtk ./gradlew app:generateCodegenArtifactsFromSchema react-native-webview:generateCodegenArtifactsFromSchema d11_react-native-fast-image:generateCodegenArtifactsFromSchema react-native-community_datetimepicker:generateCodegenArtifactsFromSchema react-native-gesture-handler:generateCodegenArtifactsFromSchema --no-daemon` - `rtk npx detox build --configuration android.emu.release` - `adb exec-out screencap -p` on the Android emulator, cropped to the top-bar bounds (`1080x154` at `y=66`) - SSIM check between the regenerated asset and the fresh crop: `1.000000000000`  ## Not Run - `rtk npx detox test --configuration android.emu.release e2e/Buttons.test.js --testNamePattern "should render top/navigation-bar buttons in the right order" --headless -w 1 --retries 2`   This remained blocked locally by an emulator window-focus issue caused by a system `Bluetooth keeps stopping` dialog, so the snapshot was regenerated from a stable `adb` capture instead.  ## Risks - Low: snapshot-only change with no source-code modifications - The main risk is that local `adb` capture could differ slightly from CI rendering, though it was taken from the current release build on t

- **Issue #8332** (2026-06-23): **android: restore vertical centering for content-hugging custom top-bar buttons**
  *Symptoms*: ## Summary Custom React top-bar buttons (`topBar.leftButtons` / `rightButtons` with `{ component }`) that have **no explicit `height`** render **pinned to the top of the bar** instead of vertically centered on Android. It affects **any content-hugging button — both text (e.g. an Owner-app "Publish" button) and fixed-size images (the profile-picture / avatar left button)** — not just text.  This is the vertical-alignment regression that came back with #8328 (RNN 8.8.9). #8328 correctly fixed the New-Architecture width collapse, but as part of it changed the no-explicit-dimension **height** spec from `AT_MOST` (what #8326 used) to `EXACTLY` the full bar height.  ## Root cause With `EXACTLY` full-bar height, the hosted `ReactSurfaceView` is forced to fill the whole bar. Centering then relies entirely on the **content centering itself** (a flex container with `justifyContent: 'center'`). #8328 was validated only against such a self-centering flex button, so it missed the common case: a content-hugging button (`<View><Text>…</Text></View>`, or a fixed-size avatar image) is laid out at the **top** of the filled box → top-aligned.  The `CENTER_VERTICAL` gravity applied in `onViewAdded()` (added in #8326) is still present but is **moot under a filled height** — the child fills the parent, so there is nothing left to center.  ## Fix Make the no-explicit-dimension **height** bounded (`AT_MOST`) again, keeping #8328's content-hugging **width** (`AT_MOST`) untouched. The surface then siz

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

### Incident Patch 1: `1de39e0d` (2026-09-09)
**Commit Message**: iOS: Fix bottom tabs visibility on iOS 18 (#8363)

* fix(ios): handle bottom tab visibility on iOS 18

* Stop verifying against RN77

* fix(ios): reconcile bottom tabs visibility

* fix(ios): honor default bottom tabs animation

* fix(ios): avoid initial tab bar animation

* fix(ios): centralize initial tab bar visibility

**File**: `.buildkite/jobs/pipeline.android_rn_77.yml` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-  - label: ":android: Android (RN 0.77.3)"
-    env:
-      JAVA_HOME: /opt/openjdk/jdk-17.0.9.jdk/Contents/Home/
-      REACT_NATIVE_VERSION: 0.77.3
-    command:
-    - "nvm install"
-    - "./scripts/ci.android.sh"
-    key: "android_rn_77"
-    timeout_in_minutes: 60
-    artifact_paths: "/Users/builder/uibuilder/work/playground/artifacts/**/*"
-    retry:
-      automatic:
-      - exit_status: [1, -1]
-        limit: 2
-
-
```

**File**: `.buildkite/jobs/pipeline.ios_rn_77.yml` (removed, +0/-15)
```diff
@@ -1,15 +0,0 @@
-  - label: ":ios: iOS (RN 0.77.3)"
-    env:
-      REACT_NATIVE_VERSION: 0.77.3
-    command:
-    - "nvm install"
-    - "./scripts/ci.ios.sh"
-    key: "ios_rn_77"
-    timeout_in_minutes: 60
-    artifact_paths: "/Users/builder/uibuilder/work/playground/artifacts/**/*"
-    retry:
-      automatic:
-      - exit_status: [1, -1]
-        limit: 2
-
-
```

**File**: `.buildkite/pipeline.sh` (modified, +0/-2)
```diff
@@ -3,11 +3,9 @@
 echo "steps:"
 
 cat .buildkite/jobs/pipeline.release.yml
-cat .buildkite/jobs/pipeline.android_rn_77.yml
 cat .buildkite/jobs/pipeline.android_rn_78.yml
 cat .buildkite/jobs/pipeline.android_rn_84.yml
 cat .buildkite/jobs/pipeline.android_rn_85.yml
-cat .buildkite/jobs/pipeline.ios_rn_77.yml
 cat .buildkite/jobs/pipeline.ios_rn_78.yml
 cat .buildkite/jobs/pipeline.ios_rn_84.yml
 cat .buildkite/jobs/pipeline.ios_rn_85.yml
```

**File**: `ios/BottomTabsBasePresenter.mm` (modified, +25/-9)
```diff
@@ -3,12 +3,30 @@
 #import "RNNConvert.h"
 #import "UIImage+utils.h"
 
-@implementation BottomTabsBasePresenter
+@implementation BottomTabsBasePresenter {
+    BOOL _didApplyInitialTabBarVisibility;
+}
+
+- (BOOL)tabBarVisibilityAnimation:(BOOL)animated {
+    if (@available(iOS 18.0, *)) {
+        return animated;
+    }
+    if (_didApplyInitialTabBarVisibility) {
+        return animated;
+    }
+
+    _didApplyInitialTabBarVisibility = YES;
+    return NO;
+}
 
 - (void)applyOptionsOnInit:(RNNNavigationOptions *)options {
     [super applyOptionsOnInit:options];
-    UITabBarController *bottomTabs = self.tabBarController;
+    RNNBottomTabsController *bottomTabs = self.tabBarController;
     RNNNavigationOptions *withDefault = [options withDefault:[self defaultOptions]];
+    if (@available(iOS 18.0, *)) {
+        [bottomTabs setTabBarVisible:[withDefault.bottomTabs.visible withDefault:YES]
+                            animated:NO];
+    }
     [bottomTabs setCurrentTabIndex:[withDefault.bottomTabs.currentTabIndex withDefault:0]];
     if (withDefault.bottomTabs.currentTabId.hasValue) {
         [bottomTabs setCurrentTabID:withDefault.bottomTabs.currentTabId.get];
@@ -24,7 +42,9 @@ - (void)applyOptions:(RNNNavigationOptions *)options {
     RNNNavigationOptions *withDefault = [options withDefault:[self defaultOptions]];
 
     [bottomTabs setTabBarTestID:[withDefault.bottomTabs.testID withDefault:nil]];
-    [bottomTabs setTabBarVisible:[withDefault.bottomTabs.visible withDefault:YES]];
+    [bottomTabs reconcileTabBarVisible:[withDefault.bottomTabs.visible withDefault:YES]
+                              animated:[self tabBarVisibilityAnimation:
+                                                 [withDefault.bottomTabs.animate withDefault:YES]]];
 
     [bottomTabs.view setBackgroundColor:[withDefault.layout.backgroundColor withDefault:nil]];
     [bottomTabs setTabBarHideShadow:[withDefault.bottomTabs.hideShadow withDefault:NO]];
@@ -74,12 +94,8 @@ - (void)mergeOptions:(RNNNavigationOptions *)mergeOptions
     }
 
     if (mergeOptions.bottomTabs.visible.hasValue) {
-        if (mergeOptions.bottomTabs.animate.hasValue) {
-            [bottomTabs setTabBarVisible:mergeOptions.bottomTabs.visible.get
-                                animated:[mergeOptions.bottomTabs.animate withDefault:NO]];
-        } else {
-            [bottomTabs setTabBarVisible:mergeOptions.bottomTabs.visible.get animated:NO];
-        }
+        [bottomTabs setTabBarVisible:mergeOptions.bottomTabs.visible.get
+                            animated:[withDefault.bottomTabs.animate withDefault:YES]];
     }
 
     if (mergeOptions.layout.backgroundColor.hasValue) {
```

**File**: `ios/RNNBottomTabsController.h` (modified, +2/-0)
```diff
@@ -28,6 +28,8 @@
 
 - (void)setTabBarVisible:(BOOL)visible;
 
+- (void)reconcileTabBarVisible:(BOOL)visible animated:(BOOL)animated;
+
 - (void)handleTabBarLongPress:(CGPoint)locationInTabBar;
 
 @end
```

**File**: `ios/RNNBottomTabsController.mm` (modified, +15/-2)
```diff
@@ -290,7 +290,7 @@ - (void)layoutCustomRow {
                                  tabBarInView.size.width, desiredHeight);
 
     _customRow.frame = rowFrame;
-    _customRow.hidden = self.tabBar.hidden;
+    _customRow.hidden = [self rnn_isTabBarHidden];
     [_customRow setSelectedIndex:_currentTabIndex];
 }
 
@@ -414,8 +414,21 @@ - (void)setTabBarVisible:(BOOL)visible animated:(BOOL)animated {
 }
 
 - (void)setTabBarVisible:(BOOL)visible {
+    [self reconcileTabBarVisible:visible animated:NO];
+}
+
+- (void)reconcileTabBarVisible:(BOOL)visible animated:(BOOL)animated {
+    if (@available(iOS 18.0, *)) {
+        BOOL shouldHide = !visible;
+        if (self.tabBarHidden != shouldHide) {
+            [self setTabBarVisible:visible animated:animated];
+        }
+        _tabBarNeedsRestore = NO;
+        return;
+    }
+
     if (_tabBarNeedsRestore || !self.presentedComponentViewController.navigationController) {
-        [self setTabBarVisible:visible animated:NO];
+        [self setTabBarVisible:visible animated:animated];
         _tabBarNeedsRestore = NO;
     }
 }
```

**File**: `ios/RNNComponentViewController.mm` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 #import "RNNComponentViewController.h"
 #import "AnimationObserver.h"
+#import "UITabBarController+RNNOptions.h"
 
 @implementation RNNComponentViewController {
     NSArray *_reactViewConstraints;
@@ -126,7 +127,7 @@ - (void)updateReactViewFrame {
 }
 
 - (BOOL)shouldDrawBehindBottomTabs {
-    return !self.tabBarController.tabBar || self.tabBarController.tabBar.isHidden ||
+    return !self.tabBarController.tabBar || [self.tabBarController rnn_isTabBarHidden] ||
            _drawBehindBottomTabs;
 }
 
```

**File**: `ios/UITabBarController+RNNOptions.h` (modified, +2/-0)
```diff
@@ -20,6 +20,8 @@
 
 - (void)hideTabBar:(BOOL)animated;
 
+- (BOOL)rnn_isTabBarHidden;
+
 - (void)syncTabBarItemTestIDs;
 
 @end
```

---

### Incident Patch 2: `92e3bf13` (2026-07-30)
**Commit Message**: fix(customrow): only attach BottomTabs custom row to NavigationActivity (#8336)

BottomTabsCustomRowAttacher is a global Application.ActivityLifecycleCallbacks
that ran tryAttach()/findViewById() on every activity in the process. On a
foreign, non-AppCompat-themed activity (e.g. AppAuth RedirectUriReceiverActivity
during OAuth login) this forces AppCompat sub-decor inflation and crashes with
'You need to use a Theme.AppCompat theme'. Guard so the observer only touches
RNN's own NavigationActivity, where BottomTabs actually live.

Sentry: WIX-ONE-APP-9GFHV

Co-authored-by: Yedidya Kennard <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `android/src/main/java/com/reactnativenavigation/customrow/BottomTabsCustomRowAttacher.kt` (modified, +9/-0)
```diff
@@ -9,6 +9,7 @@ import android.view.ViewGroup
 import android.view.ViewTreeObserver
 import android.view.WindowInsets
 import android.widget.FrameLayout
+import com.reactnativenavigation.NavigationActivity
 import com.reactnativenavigation.views.bottomtabs.BottomTabs
 
 /**
@@ -77,6 +78,13 @@ internal object BottomTabsCustomRowAttacher : Application.ActivityLifecycleCallb
     }
 
     private fun ensureLayoutObserver(activity: Activity) {
+        // BottomTabs only ever live inside RNN's own NavigationActivity (an
+        // AppCompatActivity). Touching any other activity — e.g. a third-party
+        // relay such as AppAuth's RedirectUriReceiverActivity, whose theme is not
+        // a Theme.AppCompat descendant — forces AppCompat sub-decor inflation and
+        // crashes with "You need to use a Theme.AppCompat theme". Guard here so the
+        // global lifecycle observer never operates on foreign activities.
+        if (activity !is NavigationActivity) return
         val decor = activity.window?.decorView as? ViewGroup ?: return
         if (decor.getTag(TAG_OBSERVING) == true) return
         decor.setTag(TAG_OBSERVING, true)
@@ -90,6 +98,7 @@ internal object BottomTabsCustomRowAttacher : Application.ActivityLifecycleCallb
     }
 
     private fun tryAttach(activity: Activity) {
+        if (activity !is NavigationActivity) return
         val scanRoot = activity.window?.decorView as? ViewGroup ?: return
         // Resolve through the view tree: AppCompatActivity.findViewById() forces
         // createSubDecor(), which throws unless the activity's theme is Theme.AppCompat.
```

---

### Incident Patch 3: `a563e9d7` (2026-07-30)
**Commit Message**: Fix crash attaching custom row to non-AppCompat activities (#8337)

BottomTabsCustomRowAttacher is registered process-wide, so tryAttach() runs
for every activity in the app. It called Activity.findViewById(), which on an
AppCompat activity routes through AppCompatDelegateImpl and forces
createSubDecor() -- that throws IllegalStateException unless the activity's
theme derives from Theme.AppCompat.

Any activity inheriting a non-AppCompat theme therefore crashed on creation.
Resolve android.R.id.content through the decor view instead, which never
engages AppCompatDelegate. Activity.findViewById() already delegates to
getWindow().getDecorView().findViewById(), so behaviour is unchanged for
activities that do have a compatible theme.

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `android/src/main/java/com/reactnativenavigation/customrow/BottomTabsCustomRowAttacher.kt` (modified, +4/-4)
```diff
@@ -90,10 +90,10 @@ internal object BottomTabsCustomRowAttacher : Application.ActivityLifecycleCallb
     }
 
     private fun tryAttach(activity: Activity) {
-        val scanRoot = activity.window?.decorView as? ViewGroup
-            ?: activity.findViewById<View>(android.R.id.content) as? ViewGroup
-            ?: return
-        val overlayHost = activity.findViewById<View>(android.R.id.content) as? ViewGroup
+        val scanRoot = activity.window?.decorView as? ViewGroup ?: return
+        // Resolve through the view tree: AppCompatActivity.findViewById() forces
+        // createSubDecor(), which throws unless the activity's theme is Theme.AppCompat.
+        val overlayHost = scanRoot.findViewById<View>(android.R.id.content) as? ViewGroup
             ?: scanRoot
 
         forEachBottomTabs(scanRoot) { bottomTabs ->
```

---

### Incident Patch 4: `ecbc064f` (2026-06-21)
**Commit Message**: Update package.json version to 8.8.9 [buildkite skip] (#8331)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-navigation",
-  "version": "8.8.7",
+  "version": "8.8.9",
   "description": "React Native Navigation - truly native navigation for iOS and Android",
   "license": "MIT",
   "nativePackage": true,
```

---

### Incident Patch 5: `34ca8b5a` (2026-06-14)
**Commit Message**: android: size custom top-bar component buttons to content (Fabric collapse fix) (#8328)

* android: re-measure custom top bar button when async React content reports its size

On the New Architecture (Fabric), a custom React-component top bar button
without explicit width/height could collapse to ~1px. The hosted React
surface lays out asynchronously, off the native measure pass, so the first
onMeasure often observes a 0-sized child and freezes the button at the ~1px
floor with no subsequent re-measure.

Attach an OnLayoutChangeListener to the hosted child that re-requests layout
when the content's size changes (so onMeasure re-runs and sizes the button to
the content). The size-changed guard makes it converge once the button
matches the content. The explicit-dimensions check is done inside the listener
because onViewAdded fires from the superclass constructor (before `component`
is assigned) for the React surface view we need to observe.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

* chore: re-trigger CI

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

* remove `require-label.yml` workflow (as Yogi suggested 😀)

* test: make collapsed-width a

**File**: `.github/workflows/require-label.yml` (removed, +0/-13)
```diff
@@ -1,13 +0,0 @@
-name: Enforce PR label
-
-on:
-  pull_request:
-    types: [labeled, unlabeled, opened, edited, synchronize]
-
-jobs:
-  enforce-label:
-    runs-on: ubuntu-latest
-    steps:
-    - uses: yogevbd/enforce-label-action@2.2.2
-      with:
-        REQUIRED_LABELS_ANY: "type: accepted/bug,type: accepted/enhancement,Infrastructure,type: documentation"
```

**File**: `android/src/main/java/com/reactnativenavigation/views/stack/topbar/titlebar/TitleBarReactButtonView.java` (modified, +14/-25)
```diff
@@ -18,7 +18,6 @@
 
 @SuppressLint("ViewConstructor")
 public class TitleBarReactButtonView extends ReactView {
-    private static final float FINAL_WIDTH_PADDING_DP = 1f;
     private final ComponentOptions component;
 
     public TitleBarReactButtonView(Context context, ComponentOptions component) {
@@ -45,46 +44,36 @@ protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
             this.setId(View.NO_ID);
         }
 
-        int initialWidthSpec = component.width.hasValue()
+        // Width: bounded (AT_MOST) so the hosted React surface sizes itself to its content. Under
+        // Fabric, ReactSurfaceView reports max-of-children under AT_MOST (the laid-out content width)
+        // and pushes that to the async layout. Crucially we must NOT push a forced EXACTLY *width*:
+        // before the content has laid out that width is collapsed (~1px), Fabric lays the content into
+        // it and the button never recovers (#8320/#8326 did this and regressed under the New Arch).
+        //
+        // Height: EXACTLY the available bar height. Giving the surface a filled height (rather than a
+        // content-hugging AT_MOST height) lets content that centers itself (e.g. a flex container with
+        // justifyContent: 'center') sit vertically centered in the bar, matching the legacy layout.
+        // It does not cause the width collapse — only a forced width does.
+        int widthSpec = component.width.hasValue()
                 ? createExactSpec(component.width)
                 : makeMeasureSpec(resolveAvailableWidth(widthMeasureSpec), AT_MOST);
-        int initialHeightSpec = createHeightSpec(heightMeasureSpec, component.height);
-
-        // First discover the content size without forcing every custom button to actionBarSize.
-        super.onMeasure(initialWidthSpec, initialHeightSpec);
-
-        if (component.width.hasValue() && component.height.hasValue()) {
-            return;
-        }
-
-        // Then give RN/Yoga a stable exact final box for compatibility with centered button layouts.
-        // A small allowance avoids clipping implicit RN padding/subpixel layout while staying content-based.
-        int finalWidth = component.width.hasValue()
-                ? MeasureSpec.getSize(initialWidthSpec)
-                : resolveFinalWidth(getMeasuredWidth());
-        int finalHeight = component.height.hasValue()
-                ? MeasureSpec.getSize(initialHeightSpec)
-                : Math.max(getMeasuredHeight(), 1);
-        super.onMeasure(makeMeasureSpec(finalWidth, EXACTLY), makeMeasureSpec(finalHeight, EXACTLY));
+        int heightSpec = createHeightSpec(heightMeasureSpec, component.height);
+        super.onMeasure(widthSpec, heightSpec);
     }
 
     private int createHeightSpec(int measureSpec, Number dimension) {
         if (dimension.hasValue()) {
             return createExactSpec(dimension);
         }
         int availableSize = MeasureSpec.getSize(measureSpec);
-        return makeMeasureSpec(availableSize > 0 ? availableSize : Math.max(resolveActionBarSize(), 1), AT_MOST);
+        return makeMeasureSpec(availableSize > 0 ? availableSize : Math.max(resolveActionBarSize(), 1), EXACTLY);
     }
 
     private int resolveAvailableWidth(int measureSpec) {
         int availableSize = MeasureSpec.getSize(measureSpec);
         return availableSize > 0 ? availableSize : Math.max(getResources().getDisplayMetrics().widthPixels, 1);
     }
 
-    private int resolveFinalWidth(int measuredContentWidth) {
-        return Math.max(measuredContentWidth + (int) Math.ceil(dpToPx(getContext(), FINAL_WIDTH_PADDING_DP)), 1);
-    }
-
     private int createExactSpec(Number dimension) {
         return makeMeasureSpec(MeasureSpec.getSize(dpToPx(getContext(), dimension.get())), EXACTLY);
     }
```

**File**: `android/src/test/java/com/reactnativenavigation/views/TitleBarReactButtonViewTest.java` (modified, +18/-41)
```diff
@@ -32,26 +32,28 @@ public class TitleBarReactButtonViewTest extends BaseTest {
     private static final int CHILD_WIDTH = 24;
     private static final int CHILD_HEIGHT = 16;
 
+    // Without explicit dimensions the button measures the hosted React surface ONCE:
+    //  - width  AT_MOST  → the surface sizes itself to its content (max-of-children under Fabric).
+    //  - height EXACTLY the available bar height → the surface gets a filled box so content that
+    //    centers itself (flex justifyContent: 'center') stays vertically centered in the bar.
+    // It deliberately does not push a forced EXACTLY *width*; under the New Architecture that re-pushes
+    // a (initially collapsed) width to the async Fabric layout and the button never recovers.
     @Test
-    public void missingDimensionsMeasureToContentThenRemeasureExactForStableAlignment() {
+    public void missingDimensionsSizeWidthToContentAndFillHeight() {
         Activity activity = newActivity();
         TitleBarReactButtonView uut = createView(activity, new ComponentOptions());
         RecordingContentView child = new RecordingContentView(activity);
         setContentView(uut, child);
 
         uut.measure(makeMeasureSpec(PARENT_WIDTH, AT_MOST), makeMeasureSpec(PARENT_HEIGHT, AT_MOST));
 
-        assertThat(uut.getMeasuredWidth()).isEqualTo(finalWidth(activity));
-        assertThat(uut.getMeasuredHeight()).isEqualTo(CHILD_HEIGHT);
-        assertThat(child.widthMeasureSpecs.size()).isEqualTo(2);
+        assertThat(uut.getMeasuredWidth()).isEqualTo(CHILD_WIDTH);
+        assertThat(uut.getMeasuredHeight()).isEqualTo(PARENT_HEIGHT);
+        assertThat(child.widthMeasureSpecs.size()).isEqualTo(1);
         assertThat(getMode(child.widthMeasureSpecs.get(0))).isEqualTo(AT_MOST);
         assertThat(getSize(child.widthMeasureSpecs.get(0))).isEqualTo(PARENT_WIDTH);
-        assertThat(getMode(child.heightMeasureSpecs.get(0))).isEqualTo(AT_MOST);
+        assertThat(getMode(child.heightMeasureSpecs.get(0))).isEqualTo(EXACTLY);
         assertThat(getSize(child.heightMeasureSpecs.get(0))).isEqualTo(PARENT_HEIGHT);
-        assertThat(getMode(child.widthMeasureSpecs.get(1))).isEqualTo(EXACTLY);
-        assertThat(getSize(child.widthMeasureSpecs.get(1))).isEqualTo(finalWidth(activity));
-        assertThat(getMode(child.heightMeasureSpecs.get(1))).isEqualTo(EXACTLY);
-        assertThat(getSize(child.heightMeasureSpecs.get(1))).isEqualTo(CHILD_HEIGHT);
     }
 
     @Test
@@ -76,28 +78,24 @@ public void explicitDimensionsMeasureExactly() {
     }
 
     @Test
-    public void zeroParentSpecsFallbackToBoundedAtMostSpecs() {
+    public void zeroParentSpecsFallBackToScreenWidthAndActionBarHeight() {
         Activity activity = newActivity();
         TitleBarReactButtonView uut = createView(activity, new ComponentOptions());
         RecordingContentView child = new RecordingContentView(activity);
         setContentView(uut, child);
 
         uut.measure(makeMeasureSpec(0, AT_MOST), makeMeasureSpec(0, AT_MOST));
 
-        assertThat(child.widthMeasureSpecs.size()).isEqualTo(2);
+        assertThat(child.widthMeasureSpecs.size()).isEqualTo(1);
         assertThat(getMode(child.widthMeasureSpecs.get(0))).isEqualTo(AT_MOST);
         assertThat(getSize(child.widthMeasureSpecs.get(0)))
                 .isEqualTo(Math.max(activity.getResources().getDisplayMetrics().widthPixels, 1));
-        assertThat(getMode(child.widthMeasureSpecs.get(1))).isEqualTo(EXACTLY);
-        assertThat(getSize(child.widthMeasureSpecs.get(1))).isEqualTo(finalWidth(activity));
-        assertThat(getMode(child.heightMeasureSpecs.get(0))).isEqualTo(AT_MOST);
+        assertThat(getMode(child.heightMeasureSpecs.get(0))).isEqualTo(EXACTLY);
         assertThat(getSize(child.heightMeasureSpecs.get(0))).isEqualTo(Math.max(resolveActionBarSize(activity), 1));
-        assertThat(getMode(child.heightMeasureSpecs.get(1))).isEqualTo(EXACTLY);
-        assertThat(getSize(child.heightMeasureSpecs.get(1))).isEqualTo(CHILD_HEIGHT);
     }
 
     @Test
-    public void rtlMissingDimensionsUseBoundedSpecs() {
+    public void rtlMissingDimensionsUseBoundedWidthAndFilledHeight() {
         Activity activity = newActivity();
         TitleBarReactButtonView uut = createView(activity, new ComponentOptions());
         RecordingContentView child = new RecordingContentView(activity);
@@ -106,28 +104,11 @@ public void rtlMissingDimensionsUseBoundedSpecs() {
 
         uut.measure(makeMeasureSpec(PARENT_WIDTH, AT_MOST), makeMeasureSpec(PARENT_HEIGHT, AT_MOST));
 
-        assertThat(child.widthMeasureSpecs.size()).isEqualTo(2);
+        assertThat(child.widthMeasureSpecs.size()).isEqualTo(1);
         assertThat(getMode(child.widthMeasureSpecs.get(0))).isEqualTo(AT_MOST);
         assertThat(getSize(child.widthMeasureSpecs.get(0))).isEqualTo(PARENT_WIDTH);
-        assertThat(getMode(child.widthMeasureSpecs.get(1))).isEqualTo(EXACTLY);
-        assertThat(getSize(child.widthMeasureSpec
```

---

### Incident Patch 6: `1afec76b` (2026-06-02)
**Commit Message**: Update package.json version to 8.8.7 [buildkite skip] (#8322)

**File**: `package.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-navigation",
-  "version": "8.8.6",
+  "version": "8.8.7",
   "description": "React Native Navigation - truly native navigation for iOS and Android",
   "license": "MIT",
   "nativePackage": true,
@@ -183,4 +183,4 @@
       ]
     ]
   }
-}
+}
\ No newline at end of file
```

---

### Incident Patch 7: `59086389` (2026-06-02)
**Commit Message**: android: fix custom top bar button measurement (#8320)

* android: fix custom top bar button measurement

* android: align custom button measurement snapshot

**File**: `android/src/main/java/com/reactnativenavigation/views/stack/topbar/titlebar/TitleBarReactButtonView.java` (modified, +27/-11)
```diff
@@ -5,11 +5,11 @@
 import android.util.TypedValue;
 import android.view.View;
 
-import com.facebook.react.ReactInstanceManager;
 import com.reactnativenavigation.options.ComponentOptions;
 import com.reactnativenavigation.options.params.Number;
 import com.reactnativenavigation.react.ReactView;
 
+import static android.view.View.MeasureSpec.AT_MOST;
 import static android.view.View.MeasureSpec.EXACTLY;
 import static android.view.View.MeasureSpec.makeMeasureSpec;
 import static com.reactnativenavigation.utils.UiUtils.dpToPx;
@@ -25,28 +25,44 @@ public TitleBarReactButtonView(Context context, ComponentOptions component) {
 
     @Override
     protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
-        
-        //This is a workaround, ReactNative throws exception when views have ids, On android MenuItems 
+        // This is a workaround, ReactNative throws exception when views have ids, On android MenuItems
         // With ActionViews like this got an id, see #7253
         if (!this.isAttachedToWindow()) {
             this.setId(View.NO_ID);
         }
 
-        super.onMeasure(createSpec(widthMeasureSpec, component.width), createSpec(heightMeasureSpec, component.height));
+        super.onMeasure(
+                createWidthSpec(widthMeasureSpec, component.width),
+                createHeightSpec(heightMeasureSpec, component.height)
+        );
     }
 
-    private int createSpec(int measureSpec, Number dimension) {
+    private int createWidthSpec(int measureSpec, Number dimension) {
+        return createSpec(measureSpec, dimension, Math.max(getResources().getDisplayMetrics().widthPixels, 1));
+    }
+
+    private int createHeightSpec(int measureSpec, Number dimension) {
+        if (dimension.hasValue()) {
+            return createExactSpec(dimension);
+        }
+        return makeMeasureSpec(Math.max(resolveActionBarSize(), 1), EXACTLY);
+    }
+
+    private int createSpec(int measureSpec, Number dimension, int fallbackSize) {
         if (dimension.hasValue()) {
-            return makeMeasureSpec(MeasureSpec.getSize(dpToPx(getContext(), dimension.get())), EXACTLY);
+            return createExactSpec(dimension);
         } else {
-            // When JS doesn't pass width/height, default to the theme's actionBarSize (48dp on Material).
-            // Yoga's intrinsic measurement of the React view collapses `paddingHorizontal` on the
-            // trailing edge in RTL (RN/Fabric measurement quirk), so we cannot trust UNSPECIFIED here -
-            // it produces a 0dp visible inset against the screen edge in RTL.
-            return makeMeasureSpec(resolveActionBarSize(), EXACTLY);
+            // Use bounded wrap-content width to avoid RN/Yoga RTL padding issues caused by
+            // UNSPECIFIED, without forcing every custom button to actionBarSize width.
+            int availableSize = MeasureSpec.getSize(measureSpec);
+            return makeMeasureSpec(availableSize > 0 ? availableSize : fallbackSize, AT_MOST);
         }
     }
 
+    private int createExactSpec(Number dimension) {
+        return makeMeasureSpec(MeasureSpec.getSize(dpToPx(getContext(), dimension.get())), EXACTLY);
+    }
+
     private int resolveActionBarSize() {
         TypedValue tv = new TypedValue();
         if (getContext().getTheme().resolveAttribute(android.R.attr.actionBarSize, tv, true)) {
```

**File**: `android/src/test/java/com/reactnativenavigation/views/TitleAndButtonsContainerTest.kt` (modified, +15/-1)
```diff
@@ -294,6 +294,20 @@ class TitleAndButtonsContainerTest : BaseTest() {
         assertThat(uut.getTitleComponent().right).isEqualTo(UUT_WIDTH - rightBarWidth - DEFAULT_LEFT_MARGIN_PX)
     }
 
+    @Test
+    fun `Component - title width shrinks by measured right buttons only`() {
+        val rightButtonsWidth = 48
+        setup(
+                rightBarWidth = rightButtonsWidth,
+                componentWidth = UUT_WIDTH,
+                alignment = Alignment.Default
+        )
+
+        idleMainLooper()
+        assertThat(uut.getTitleComponent().left).isEqualTo(DEFAULT_LEFT_MARGIN_PX)
+        assertThat(uut.getTitleComponent().right).isEqualTo(UUT_WIDTH - rightButtonsWidth - DEFAULT_LEFT_MARGIN_PX)
+    }
+
     @Test
     fun `Component - should place title between the toolbars`() {
         val leftBarWidth = 50
@@ -475,4 +489,4 @@ class TitleAndButtonsContainerTest : BaseTest() {
     }
 
     private fun getTitleSubtitleView() = (uut.getTitleComponent() as TitleSubTitleLayout)
-}
\ No newline at end of file
+}
```

**File**: `android/src/test/java/com/reactnativenavigation/views/TitleBarReactButtonViewTest.java` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+package com.reactnativenavigation.views;
+
+import static android.view.View.MeasureSpec.AT_MOST;
+import static android.view.View.MeasureSpec.EXACTLY;
+import static android.view.View.MeasureSpec.getMode;
+import static android.view.View.MeasureSpec.getSize;
+import static android.view.View.MeasureSpec.makeMeasureSpec;
+import static org.assertj.core.api.Java6Assertions.assertThat;
+
+import android.app.Activity;
+import android.util.TypedValue;
+import android.view.View;
+import android.view.ViewGroup;
+
+import com.reactnativenavigation.BaseTest;
+import com.reactnativenavigation.options.ComponentOptions;
+import com.reactnativenavigation.options.params.Number;
+import com.reactnativenavigation.options.params.Text;
+import com.reactnativenavigation.utils.UiUtils;
+import com.reactnativenavigation.views.stack.topbar.titlebar.TitleBarReactButtonView;
+
+import org.junit.Test;
+
+public class TitleBarReactButtonViewTest extends BaseTest {
+    private static final int PARENT_WIDTH = 200;
+    private static final int PARENT_HEIGHT = 100;
+    private static final int CHILD_WIDTH = 24;
+    private static final int CHILD_HEIGHT = 16;
+
+    @Test
+    public void missingDimensionsMeasureToContentWithinParentBounds() {
+        Activity activity = newActivity();
+        TitleBarReactButtonView uut = createView(activity, new ComponentOptions());
+        uut.addView(new FixedSizeView(activity), new ViewGroup.LayoutParams(CHILD_WIDTH, CHILD_HEIGHT));
+
+        uut.measure(makeMeasureSpec(PARENT_WIDTH, AT_MOST), makeMeasureSpec(PARENT_HEIGHT, AT_MOST));
+
+        assertThat(uut.getMeasuredWidth()).isEqualTo(CHILD_WIDTH);
+        assertThat(uut.getMeasuredHeight()).isEqualTo(resolveActionBarSize(activity));
+    }
+
+    @Test
+    public void explicitDimensionsMeasureExactly() {
+        Activity activity = newActivity();
+        ComponentOptions component = new ComponentOptions();
+        component.width = new Number(72);
+        component.height = new Number(32);
+        TitleBarReactButtonView uut = createView(activity, component);
+        uut.addView(new FixedSizeView(activity), new ViewGroup.LayoutParams(CHILD_WIDTH, CHILD_HEIGHT));
+
+        uut.measure(makeMeasureSpec(PARENT_WIDTH, AT_MOST), makeMeasureSpec(PARENT_HEIGHT, AT_MOST));
+
+        assertThat(uut.getMeasuredWidth()).isEqualTo(UiUtils.dpToPx(activity, 72));
+        assertThat(uut.getMeasuredHeight()).isEqualTo(UiUtils.dpToPx(activity, 32));
+    }
+
+    @Test
+    public void zeroParentWidthFallbacksToBoundedAtMostSpecAndHeightUsesActionBarSize() {
+        Activity activity = newActivity();
+        TitleBarReactButtonView uut = createView(activity, new ComponentOptions());
+        RecordingView child = new RecordingView(activity);
+        uut.addView(child, new ViewGroup.LayoutParams(
+                ViewGroup.LayoutParams.MATCH_PARENT,
+                ViewGroup.LayoutParams.MATCH_PARENT
+        ));
+
+        uut.measure(makeMeasureSpec(0, AT_MOST), makeMeasureSpec(0, AT_MOST));
+
+        assertThat(getMode(child.lastWidthMeasureSpec)).isEqualTo(AT_MOST);
+        assertThat(getSize(child.lastWidthMeasureSpec))
+                .isEqualTo(Math.max(activity.getResources().getDisplayMetrics().widthPixels, 1));
+        assertThat(getMode(child.lastHeightMeasureSpec)).isEqualTo(EXACTLY);
+        assertThat(getSize(child.lastHeightMeasureSpec)).isEqualTo(Math.max(resolveActionBarSize(activity), 1));
+    }
+
+    @Test
+    public void rtlMissingDimensionsUseBoundedSpecs() {
+        Activity activity = newActivity();
+        TitleBarReactButtonView uut = createView(activity, new ComponentOptions());
+        RecordingView child = new RecordingView(activity);
+        uut.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
+        uut.addView(child, new ViewGroup.LayoutParams(
+                ViewGroup.LayoutParams.MATCH_PARENT,
+                ViewGroup.LayoutParams.MATCH_PARENT
+        ));
+
+        uut.measure(makeMeasureSpec(PARENT_WIDTH, AT_MOST), makeMeasureSpec(PARENT_HEIGHT, AT_MOST));
+
+        assertThat(getMode(child.lastWidthMeasureSpec)).isEqualTo(AT_MOST);
+        assertThat(getSize(child.lastWidthMeasureSpec)).isEqualTo(PARENT_WIDTH);
+        assertThat(getMode(child.lastHeightMeasureSpec)).isEqualTo(EXACTLY);
+        assertThat(getSize(child.lastHeightMeasureSpec)).isEqualTo(resolveActionBarSize(activity));
+    }
+
+    private TitleBarReactButtonView createView(Activity activity, ComponentOptions component) {
+        component.name = new Text("ButtonComponent");
+        component.componentId = new Text("ButtonComponentId");
+        return new TitleBarReactButtonView(activity, component);
+    }
+
+    private int resolveActionBarSize(Activity activity) {
+        TypedValue tv = new TypedValue();
+        if (activity.getTheme().resolveAttribute(android.R.attr.actionBarSize, tv, true)) {
+            return TypedValue.complexToDimensionPixelSize(tv.data, activity.getResources().getDi
```

---

### Incident Patch 8: `c1a40d69` (2026-05-27)
**Commit Message**: Update package.json version to 8.8.6 [buildkite skip] (#8316)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-navigation",
-  "version": "8.8.4",
+  "version": "8.8.6",
   "description": "React Native Navigation - truly native navigation for iOS and Android",
   "license": "MIT",
   "nativePackage": true,
```

---

### Incident Patch 9: `8e2fb2f7` (2026-05-26)
**Commit Message**: android: fix system navigation bar overlay color (#8314)

**File**: `android/src/main/java/com/reactnativenavigation/utils/SystemUiUtils.kt` (modified, +17/-7)
```diff
@@ -79,7 +79,7 @@ object SystemUiUtils {
     @JvmStatic
     fun setupSystemBarBackgrounds(activity: Activity, contentLayout: ViewGroup) {
         setupStatusBarBackground(activity)
-        setupNavigationBarBackground(contentLayout)
+        setupNavigationBarBackground(activity.window, contentLayout)
     }
 
     private fun setupStatusBarBackground(activity: Activity) {
@@ -117,10 +117,10 @@ object SystemUiUtils {
         return view
     }
 
-    private fun setupNavigationBarBackground(contentLayout: ViewGroup) {
+    private fun setupNavigationBarBackground(window: Window?, contentLayout: ViewGroup) {
         if (navBarBackgroundView != null) return
         val view = View(contentLayout.context).apply {
-            setBackgroundColor(Color.BLACK)
+            setBackgroundColor(getNavigationBarBackgroundColor(window))
         }
         val params = FrameLayout.LayoutParams(
             FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.BOTTOM
@@ -134,7 +134,7 @@ object SystemUiUtils {
             val wasThreeButton = isThreeButtonNav
             isThreeButtonNav = tappableHeight > 0
             if (isThreeButtonNav != wasThreeButton) {
-                val color = lastExplicitNavBarColor ?: getDefaultNavBarColor()
+                val color = lastExplicitNavBarColor ?: getNavigationBarBackgroundColor(v)
                 v.setBackgroundColor(color)
             }
             val lp = v.layoutParams
@@ -147,6 +147,17 @@ object SystemUiUtils {
         view.requestApplyInsets()
     }
 
+    private fun getNavigationBarBackgroundColor(window: Window?): Int {
+        lastExplicitNavBarColor?.let { return it }
+        @Suppress("DEPRECATION")
+        return window?.navigationBarColor ?: getDefaultNavBarColor()
+    }
+
+    private fun getNavigationBarBackgroundColor(view: View): Int {
+        lastExplicitNavBarColor?.let { return it }
+        return (view.background as? ColorDrawable)?.color ?: getDefaultNavBarColor()
+    }
+
     /**
      * Returns the default navigation bar color, applying 80% opacity for 3-button navigation.
      * Gesture navigation gets a fully opaque color since the bar is minimal.
@@ -321,9 +332,8 @@ object SystemUiUtils {
         window?.let {
             WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightNavigationBars = lightColor
         }
-        if (isEdgeToEdgeActive) {
-            navBarBackgroundView?.setBackgroundColor(color)
-        } else {
+        navBarBackgroundView?.setBackgroundColor(color)
+        if (!isEdgeToEdgeActive) {
             @Suppress("DEPRECATION")
             window?.navigationBarColor = color
         }
```

**File**: `android/src/test/java/com/reactnativenavigation/utils/SystemUiUtilsTest.kt` (modified, +64/-1)
```diff
@@ -1,16 +1,28 @@
 package com.reactnativenavigation.utils
 
 import android.graphics.Color
+import android.graphics.drawable.ColorDrawable
+import android.view.View
 import android.view.Window
+import android.widget.FrameLayout
+import androidx.appcompat.app.AppCompatActivity
 import com.reactnativenavigation.BaseRobolectricTest
 import com.reactnativenavigation.utils.SystemUiUtils.STATUS_BAR_HEIGHT_TRANSLUCENCY
+import org.assertj.core.api.Java6Assertions.assertThat
+import org.junit.After
 import org.junit.Test
 import org.mockito.Mockito
 import org.mockito.kotlin.verify
+import org.robolectric.Robolectric
 import kotlin.math.ceil
 
 class SystemUiUtilsTest : BaseRobolectricTest() {
 
+    @After
+    fun afterEach() {
+        SystemUiUtils.tearDown()
+    }
+
     @Test
     fun `setStatusBarColor - should change color considering alpha`() {
         val window = Mockito.mock(Window::class.java)
@@ -24,4 +36,55 @@ class SystemUiUtilsTest : BaseRobolectricTest() {
 
         verify(window).statusBarColor = Color.argb(ceil(STATUS_BAR_HEIGHT_TRANSLUCENCY*255).toInt(), 22, 255, 255)
     }
-}
\ No newline at end of file
+
+    @Test
+    fun `setupSystemBarBackgrounds - initializes navigation bar background from resolved color`() {
+        val activity = Robolectric.setupActivity(AppCompatActivity::class.java)
+        val contentLayout = FrameLayout(activity)
+        val initialColor = Color.RED
+        SystemUiUtils.setNavigationBarBackgroundColor(activity.window, initialColor, false)
+
+        SystemUiUtils.setupSystemBarBackgrounds(activity, contentLayout)
+
+        assertThat(getBackgroundColor(getNavigationBarBackground(contentLayout))).isEqualTo(initialColor)
+    }
+
+    @Test
+    fun `setNavigationBarBackgroundColor - updates view and window color when edge-to-edge is inactive`() {
+        val activity = Robolectric.setupActivity(AppCompatActivity::class.java)
+        val contentLayout = FrameLayout(activity)
+        @Suppress("DEPRECATION")
+        activity.window.navigationBarColor = Color.BLACK
+        SystemUiUtils.setupSystemBarBackgrounds(activity, contentLayout)
+
+        SystemUiUtils.setNavigationBarBackgroundColor(activity.window, Color.WHITE, true)
+
+        assertThat(getBackgroundColor(getNavigationBarBackground(contentLayout))).isEqualTo(Color.WHITE)
+        assertThat(activity.window.decorView.systemUiVisibility and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
+            .isEqualTo(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
+    }
+
+    @Test
+    fun `setNavigationBarBackgroundColor - updates view and icon appearance when edge-to-edge is active`() {
+        val activity = Robolectric.setupActivity(AppCompatActivity::class.java)
+        val contentLayout = FrameLayout(activity)
+        val initialColor = Color.RED
+        SystemUiUtils.setNavigationBarBackgroundColor(activity.window, initialColor, false)
+        SystemUiUtils.setupSystemBarBackgrounds(activity, contentLayout)
+        SystemUiUtils.activateEdgeToEdge()
+
+        SystemUiUtils.setNavigationBarBackgroundColor(activity.window, Color.WHITE, true)
+
+        assertThat(getBackgroundColor(getNavigationBarBackground(contentLayout))).isEqualTo(Color.WHITE)
+        assertThat(activity.window.decorView.systemUiVisibility and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
+            .isEqualTo(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
+    }
+
+    private fun getNavigationBarBackground(contentLayout: FrameLayout): View {
+        return contentLayout.getChildAt(contentLayout.childCount - 1)
+    }
+
+    private fun getBackgroundColor(view: View): Int {
+        return (view.background as ColorDrawable).color
+    }
+}
```

---

### Incident Patch 10: `5454e40f` (2026-05-25)
**Commit Message**: Update package.json version to 8.8.4 [buildkite skip] (#8311)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-navigation",
-  "version": "8.8.3",
+  "version": "8.8.4",
   "description": "React Native Navigation - truly native navigation for iOS and Android",
   "license": "MIT",
   "nativePackage": true,
```

---

### Incident Patch 11: `48fca784` (2026-05-24)
**Commit Message**: fix for mis-alignment on iOS 26 (#8310)

**File**: `ios/RNNReactTitleView.mm` (modified, +26/-5)
```diff
@@ -1,5 +1,7 @@
 #import "RNNReactTitleView.h"
 
+static const CGFloat kTitleViewDefaultHeight = 44.0;
+
 @implementation RNNReactTitleView {
     BOOL _fillParent;
     CGFloat _expectedHeight;
@@ -11,19 +13,30 @@ - (NSString *)componentType {
 
 - (CGSize)intrinsicContentSize {
     if (_fillParent) {
-        return CGSizeMake(UILayoutFittingExpandedSize.width, _expectedHeight > 0 ? _expectedHeight : 44);
-    } else {
-        return [super intrinsicContentSize];
+        return CGSizeMake(UILayoutFittingExpandedSize.width,
+                          _expectedHeight > 0 ? _expectedHeight : kTitleViewDefaultHeight);
     }
+    return [super intrinsicContentSize];
+}
+
+- (CGSize)sizeThatFits:(CGSize)size {
+    if (_fillParent) {
+        return size;
+    }
+    return [super sizeThatFits:size];
 }
 
 - (void)setAlignment:(NSString *)alignment inFrame:(CGRect)frame {
     if ([alignment isEqualToString:@"fill"]) {
         _fillParent = YES;
-        _expectedHeight = frame.size.height;
-        self.translatesAutoresizingMaskIntoConstraints = NO;
+        _expectedHeight = frame.size.height > 0 ? frame.size.height : kTitleViewDefaultHeight;
+        self.frame = frame;
+        self.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleLeftMargin |
+                                UIViewAutoresizingFlexibleRightMargin | UIViewAutoresizingFlexibleHeight;
         self.sizeFlexibility = RCTRootViewSizeFlexibilityNone;
     } else {
+        _fillParent = NO;
+        self.autoresizingMask = UIViewAutoresizingNone;
         self.sizeFlexibility = RCTRootViewSizeFlexibilityWidthAndHeight;
         __weak RNNReactView *weakSelf = self;
         [self setRootViewDidChangeIntrinsicSize:^(CGSize intrinsicSize) {
@@ -32,6 +45,14 @@ - (void)setAlignment:(NSString *)alignment inFrame:(CGRect)frame {
     }
 }
 
+- (void)layoutSubviews {
+    [super layoutSubviews];
+    if (_fillParent && self.bounds.size.height > 0 && _expectedHeight != self.bounds.size.height) {
+        _expectedHeight = self.bounds.size.height;
+        [self invalidateIntrinsicContentSize];
+    }
+}
+
 - (void)setRootViewDidChangeIntrinsicSize:(void (^)(CGSize))rootViewDidChangeIntrinsicSize {
     _rootViewDidChangeIntrinsicSize = rootViewDidChangeIntrinsicSize;
     self.delegate = self;
```

**File**: `ios/TopBarTitlePresenter.mm` (modified, +16/-2)
```diff
@@ -83,12 +83,26 @@ - (void)setCustomNavigationTitleView:(RNNTopBarOptions *)options
                    reactViewReadyBlock:readyBlock];
         _customTitleView.backgroundColor = UIColor.clearColor;
         NSString *alignment = [options.title.component.alignment withDefault:@""];
-        [_customTitleView setAlignment:alignment
-                               inFrame:viewController.navigationController.navigationBar.frame];
+        UINavigationBar *navigationBar = viewController.navigationController.navigationBar;
+        CGRect barBounds = navigationBar.bounds;
+        [_customTitleView setAlignment:alignment inFrame:barBounds];
         [_customTitleView layoutIfNeeded];
 
         viewController.navigationItem.titleView = nil;
         viewController.navigationItem.titleView = _customTitleView;
+
+        __weak RNNReactTitleView *weakTitleView = _customTitleView;
+        __weak UIViewController *weakViewController = viewController;
+        dispatch_async(dispatch_get_main_queue(), ^{
+            UINavigationController *navigationController = weakViewController.navigationController;
+            if (!navigationController || !weakTitleView) {
+                return;
+            }
+            [weakTitleView setAlignment:alignment inFrame:navigationController.navigationBar.bounds];
+            weakViewController.navigationItem.titleView = weakTitleView;
+            [weakTitleView setNeedsLayout];
+            [weakTitleView layoutIfNeeded];
+        });
         [_customTitleView componentWillAppear];
         [_customTitleView componentDidAppear];
     } else {
```

**File**: `playground/src/screens/CustomTopBar.tsx` (modified, +2/-2)
```diff
@@ -25,10 +25,10 @@ export default class CustomTopBar extends React.Component<Props> {
 
 const styles = StyleSheet.create({
   container: {
-    alignSelf: 'baseline',
+    flex: 1,
+    justifyContent: 'center',
   },
   text: {
-    alignSelf: 'flex-start',
     color: 'black',
     fontSize: 16,
   },
```

**File**: `playground/src/screens/TopBarTitleTestScreen.tsx` (modified, +4/-4)
```diff
@@ -18,8 +18,8 @@ const {
 // TopBar title component WITH subtitle
 function TopBarWithSubtitle() {
     return (
-        <View style={{ flex: 1 }}>
-            <View style={{ flexDirection: 'row' }}>
+        <View style={{ flex: 1, justifyContent: 'center' }}>
+            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                 <View
                     testID={TOPBAR_TITLE_AVATAR}
                     style={{ alignSelf: 'center', marginRight: 20, width: 10, height: 10, backgroundColor: 'red' }}
@@ -38,8 +38,8 @@ function TopBarWithSubtitle() {
 // TopBar title component WITHOUT subtitle - this triggers the bug on Android
 function TopBarWithoutSubtitle() {
     return (
-        <View style={{ flex: 1 }}>
-            <View style={{ flexDirection: 'row' }}>
+        <View style={{ flex: 1, justifyContent: 'center' }}>
+            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                 <View
                     testID={TOPBAR_TITLE_AVATAR}
                     style={{ alignSelf: 'center', marginRight: 20, width: 10, height: 10, backgroundColor: 'red' }}
```

---

### Incident Patch 12: `a25439a9` (2026-05-18)
**Commit Message**: RTL fix for top bar icons (#8306)

**File**: `android/src/main/java/com/reactnativenavigation/views/stack/topbar/titlebar/TitleBarReactButtonView.java` (modified, +14/-2)
```diff
@@ -2,6 +2,7 @@
 
 import android.annotation.SuppressLint;
 import android.content.Context;
+import android.util.TypedValue;
 import android.view.View;
 
 import com.facebook.react.ReactInstanceManager;
@@ -10,7 +11,6 @@
 import com.reactnativenavigation.react.ReactView;
 
 import static android.view.View.MeasureSpec.EXACTLY;
-import static android.view.View.MeasureSpec.UNSPECIFIED;
 import static android.view.View.MeasureSpec.makeMeasureSpec;
 import static com.reactnativenavigation.utils.UiUtils.dpToPx;
 
@@ -39,7 +39,19 @@ private int createSpec(int measureSpec, Number dimension) {
         if (dimension.hasValue()) {
             return makeMeasureSpec(MeasureSpec.getSize(dpToPx(getContext(), dimension.get())), EXACTLY);
         } else {
-            return makeMeasureSpec(MeasureSpec.getSize(measureSpec), UNSPECIFIED);
+            // When JS doesn't pass width/height, default to the theme's actionBarSize (48dp on Material).
+            // Yoga's intrinsic measurement of the React view collapses `paddingHorizontal` on the
+            // trailing edge in RTL (RN/Fabric measurement quirk), so we cannot trust UNSPECIFIED here -
+            // it produces a 0dp visible inset against the screen edge in RTL.
+            return makeMeasureSpec(resolveActionBarSize(), EXACTLY);
         }
     }
+
+    private int resolveActionBarSize() {
+        TypedValue tv = new TypedValue();
+        if (getContext().getTheme().resolveAttribute(android.R.attr.actionBarSize, tv, true)) {
+            return TypedValue.complexToDimensionPixelSize(tv.data, getContext().getResources().getDisplayMetrics());
+        }
+        return (int) dpToPx(getContext(), 48f);
+    }
 }
```

---

### Incident Patch 13: `6e4ad628` (2026-05-17)
**Commit Message**: android test fix (#8305)

**File**: `playground/e2e/Buttons.test.js` (modified, +16/-8)
```diff
@@ -1,3 +1,4 @@
+import { Platform } from 'react-native';
 import Utils from './Utils';
 import TestIDs from '../src/testIDs';
 
@@ -22,14 +23,21 @@ describe('Buttons', () => {
   });
 
   it(':android: should not effect left buttons when hiding back button', async () => {
-    await elementById(TestIDs.TOGGLE_BACK).tap();
-    await expect(elementById(TestIDs.LEFT_BUTTON)).toBeVisible();
-    await expect(elementById(TestIDs.TEXTUAL_LEFT_BUTTON)).toBeVisible();
-    await expect(elementById(TestIDs.BACK_BUTTON)).toBeVisible();
-
-    await elementById(TestIDs.TOGGLE_BACK).tap();
-    await expect(elementById(TestIDs.LEFT_BUTTON)).toBeVisible();
-    await expect(elementById(TestIDs.TEXTUAL_LEFT_BUTTON)).toBeVisible();
+    // Jest mock runs with Platform.OS === 'ios'; this test asserts Android-only topBar behavior.
+    const platform = Platform.OS;
+    Platform.OS = 'android';
+    try {
+      await elementById(TestIDs.TOGGLE_BACK).tap();
+      await expect(elementById(TestIDs.LEFT_BUTTON)).toBeVisible();
+      await expect(elementById(TestIDs.TEXTUAL_LEFT_BUTTON)).toBeVisible();
+      await expect(elementById(TestIDs.BACK_BUTTON)).toBeVisible();
+
+      await elementById(TestIDs.TOGGLE_BACK).tap();
+      await expect(elementById(TestIDs.LEFT_BUTTON)).toBeVisible();
+      await expect(elementById(TestIDs.TEXTUAL_LEFT_BUTTON)).toBeVisible();
+    } finally {
+      Platform.OS = platform;
+    }
   });
   it('sets right buttons', async () => {
     await expect(elementById(TestIDs.BUTTON_ONE)).toBeVisible();
```

---

### Incident Patch 14: `889a74de` (2026-05-14)
**Commit Message**: buttons screen back button fix (#8303)

**File**: `playground/src/screens/ButtonsScreen.tsx` (modified, +17/-10)
```diff
@@ -1,5 +1,6 @@
 /* eslint-disable prettier/prettier */
 import React from 'react';
+import { Platform } from 'react-native';
 import { NavigationComponent, Options, OptionsTopBarButton } from 'react-native-navigation';
 import Root from '../components/Root';
 import Button from '../components/Button';
@@ -139,17 +140,23 @@ export default class ButtonOptions extends NavigationComponent {
     );
   }
 
-  toggleBack= ()=> {
+  toggleBack = () => {
     this.backButtonVisibile = !this.backButtonVisibile;
-    Navigation.mergeOptions(this.props.componentId,{
-      topBar:{
-        backButton:{
-          testID:BACK_BUTTON,
-          visible:this.backButtonVisibile
-        }
-      }
-    })
-  }
+    Navigation.mergeOptions(this.props.componentId, {
+      topBar: {
+        backButton: {
+          testID: BACK_BUTTON,
+          visible: this.backButtonVisibile,
+        },
+        // iOS: leftButtons replace the back chevron slot, so the back button
+        // can't render unless leftButtons are cleared. Android's back
+        // affordance is independent of leftButtons.
+        ...(Platform.OS === 'ios' && this.backButtonVisibile
+          ? { leftButtons: [] }
+          : {}),
+      },
+    });
+  };
 
   setRightButtons = () =>
     Navigation.mergeOptions(this, {
```

---

### Incident Patch 15: `72412dce` (2026-05-14)
**Commit Message**: fix(ios): center RNNReactButtonView inside navigation bar platter (#8300)

* fix(ios): add Auto Layout constraints to RNNReactButtonView on iOS 26

On iOS 26 the Liquid Glass navigation bar wraps custom-view bar button
items in several internal layout containers.  Without explicit size
constraints the wrapper views can collapse to zero height after a
pop → tab-switch → tab-switch → push cycle, making the React button
invisible.

- Guard all new logic behind @available(iOS 26.0, *) AND a runtime
  check for UIDesignRequiresCompatibility (compatibility mode disables
  Liquid Glass and uses the legacy view hierarchy)
- Set translatesAutoresizingMaskIntoConstraints = NO
- Add width/height constraints at UILayoutPriorityDefaultHigh
- Update constraints in didMountComponentsWithRootTag: after sizeToFit

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* fix(ios): center RNNReactButtonView inside navigation bar platter

On iOS 26 the internal _UITAMICAdaptorView wrapper is wider than the
React button content and UIKit pins the custom view to the leading edge.

Apply a one-time horizontal CGAffineTransform in layoutSubviews to
center the view. Guarded by @available(iOS 26.0, *) and
UIDesignRequi

**File**: `ios/RNNReactButtonView.mm` (modified, +59/-2)
```diff
@@ -1,6 +1,11 @@
 #import "RNNReactButtonView.h"
+#import <React/RCTSurface.h>
 
-@implementation RNNReactButtonView
+@implementation RNNReactButtonView {
+    NSLayoutConstraint *_widthConstraint;
+    NSLayoutConstraint *_heightConstraint;
+    BOOL _didCenter;
+}
 
 - (instancetype)initWithHost:(RCTHost *)host
                   moduleName:(NSString *)moduleName
@@ -10,15 +15,67 @@ - (instancetype)initWithHost:(RCTHost *)host
          reactViewReadyBlock:(RNNReactViewReadyCompletionBlock)reactViewReadyBlock {
     self = [super initWithHost:host moduleName:moduleName initialProperties:initialProperties eventEmitter:eventEmitter sizeMeasureMode:convertToSurfaceSizeMeasureMode(RCTRootViewSizeFlexibilityWidthAndHeight) reactViewReadyBlock:reactViewReadyBlock];
     [host.surfacePresenter addObserver:self];
-    self.backgroundColor = UIColor.clearColor;
+    self.backgroundColor = [UIColor clearColor];
+
+    if (@available(iOS 26.0, *)) {
+        if (![self designRequiresCompatibility]) {
+            self.translatesAutoresizingMaskIntoConstraints = NO;
+            _widthConstraint = [self.widthAnchor constraintEqualToConstant:0];
+            _heightConstraint = [self.heightAnchor constraintEqualToConstant:0];
+            _widthConstraint.priority = UILayoutPriorityDefaultHigh;
+            _heightConstraint.priority = UILayoutPriorityDefaultHigh;
+            _widthConstraint.active = YES;
+            _heightConstraint.active = YES;
+            _didCenter = NO;
+        }
+    }
 
     return self;
 }
 
+- (BOOL)designRequiresCompatibility {
+    static BOOL checked = NO;
+    static BOOL result = NO;
+    if (!checked) {
+        checked = YES;
+        result = [[[NSBundle mainBundle] objectForInfoDictionaryKey:@"UIDesignRequiresCompatibility"] boolValue];
+    }
+    return result;
+}
+
 - (void)didMountComponentsWithRootTag:(NSInteger)rootTag {
     if (self.surface.rootTag == rootTag) {
         [super didMountComponentsWithRootTag:rootTag];
         [self sizeToFit];
+        if (@available(iOS 26.0, *)) {
+            if (![self designRequiresCompatibility]) {
+                [self updateConstraintsToFitSize];
+            }
+        }
+    }
+}
+
+- (void)updateConstraintsToFitSize {
+    CGSize size = self.frame.size;
+    if (size.width > 0 && size.height > 0) {
+        _widthConstraint.constant = size.width;
+        _heightConstraint.constant = size.height;
+    }
+}
+
+- (void)layoutSubviews {
+    [super layoutSubviews];
+    if (@available(iOS 26.0, *)) {
+        if ([self designRequiresCompatibility]) return;
+        if (!_didCenter && self.superview && self.frame.size.width > 0) {
+            CGFloat wrapperWidth = self.superview.bounds.size.width;
+            CGFloat selfWidth = self.frame.size.width;
+            if (wrapperWidth > selfWidth) {
+                _didCenter = YES;
+                CGFloat tx = (wrapperWidth - selfWidth) / 2.0;
+                self.layer.affineTransform = CGAffineTransformMakeTranslation(tx, 0);
+            }
+        }
     }
 }
 
```

#### Recent Merged Pull Requests:
- **PR #8363** (2026-09-09): iOS: Fix bottom tabs visibility on iOS 18 (@guyca)
- **PR #8338** (closed): Update package.json version to 8.8.11 (@mobileoss)
- **PR #8337** (2026-07-30): [BottomTabsCustomRow] Fix crash attaching custom row to non-AppCompat activities (@avithalker-wix)
- **PR #8336** (2026-07-30): fix(customrow): only attach BottomTabs custom row to NavigationActivity (@Yoavpagir)
- **PR #8335** (closed): Update package.json version to 8.8.10 (@mobileoss)
- **PR #8333** (2026-06-23): playground: regenerate Android buttons navbar snapshot (@yedidyak)
- **PR #8332** (2026-06-23): android: restore vertical centering for content-hugging custom top-bar buttons (@Yoavpagir)
- **PR #8331** (2026-06-21): Update package.json version to 8.8.9 (@mobileoss)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
