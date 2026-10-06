# Forensic Learning Record (Deep Inspection): lottie-react-native/lottie-react-native

> **Canonical Artifact**: `07_PROJECT_LEARNING/lottie-react-native-lottie-react-native-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lottie-react-native/lottie-react-native](https://github.com/lottie-react-native/lottie-react-native))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:31:54.697Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lottie-react-native/lottie-react-native`
- **Description**: Lottie wrapper for React Native.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 17207 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/core/.eslintrc.js`
```
module.exports = {
  extends: ['@react-native-community'],
  plugins: ['@react-native/eslint-plugin-specs'],
  rules: {
    'react-native/no-inline-styles': 'off',
    '@react-native/specs/react-native-modules': 'error',
  },
  overrides: [
    {
      files: ['src/specs/**/*.js'],
      rules: {
        '@react-native/specs/react-native-modules': 'error',
      },
    },
  ],
};

```

### Core Architecture Module: `packages/core/Package.swift`
```
// swift-tools-version: 6.0

import PackageDescription

let reactHeaders: [Target.Dependency] = [
    .product(name: "ReactHeaders", package: "ReactNative"),
    .product(name: "ReactNativeHeaders", package: "ReactNative"),
    .product(name: "ReactNativeDependenciesHeaders", package: "ReactNative"),
    .product(name: "ReactAppHeaders", package: "React-GeneratedCode"),
]

let package = Package(
    name: "LottieReactNative",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "LottieReactNative",
            targets: ["LottieReactNative", "LottieReactNativeObjC"]
        ),
    ],
    dependencies: [
        .package(name: "ReactNative", path: "../../../../xcframeworks"),
        .package(name: "React-GeneratedCode", path: "../../../ios"),
        .package(url: "https://github.com/airbnb/lottie-spm.git", exact: "4.6.0"),
    ],
    targets: [
        .target(
            name: "LottieReactNativeObjC",
            dependencies: reactHeaders,
            path: "ios",
            sources: [
                "Fabric/LottieAnimationViewComponentView.mm",
                "LottieReactNative/LRNAnimationViewManagerObjC.m",
                "LottieReactNative/RCTConvert+Lottie.m",
            ],
            publicHeadersPath: "Fabric",
            cSettings: [
                .headerSearchPath("Fabric"),
                .headerSearchPath("LottieReactNative"),
            ],
            cxxSettings: [
                .headerSearchPath("Fabric"),
                .headerSearchPath("LottieReactNative"),
                .define("DEBUG", .when(configuration: .debug)),
                .define("NDEBUG", .when(configuration: .release)),
            ],
            linkerSettings: [
                .linkedFramework("UIKit"),
                .linkedFramework("Foundation"),
                .linkedFramework("CoreGraphics"),
            ]
        ),
        .target(
            name: "LottieReactNative",
            dependencies: reactHeaders + [
                .product(name: "Lottie", package: "lottie-ios"),
            ],
            path: "ios",
            sources: [
                "LottieReactNative/AnimationViewManagerModule.swift",
                "LottieReactNative/ContainerView.swift",
                "LottieReactNative/PlatformColor.swift",
            ],
            resources: [
                .copy("PrivacyInfo.xcprivacy"),
            ],
            linkerSettings: [
                .linkedFramework("UIKit"),
                .linkedFramework("Foundation"),
                .linkedFramework("CoreGraphics"),
            ]
        ),
    ],
    cxxLanguageStandard: .cxx20
)

```

### Core Architecture Module: `packages/core/android/src/main/java/com/airbnb/android/react/lottie/LottieAnimationViewManagerImpl.kt`
```
package com.airbnb.android.react.lottie

import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.View.OnAttachStateChangeListener
import android.widget.ImageView
import androidx.core.view.ViewCompat
import com.airbnb.lottie.LottieAnimationView
import com.airbnb.lottie.RenderMode
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper

internal object LottieAnimationViewManagerImpl {
    const val REACT_CLASS = "LottieAnimationView"

    @JvmStatic
    val exportedViewConstants: Map<String, Any>
        get() = MapBuilder.builder<String, Any>()
            .put("VERSION", 1)
            .build()

    @JvmStatic
    fun createViewInstance(context: ThemedReactContext): LottieAnimationView {
        return LottieAnimationView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_INSIDE
        }
    }

    @JvmStatic
    fun sendOnAnimationFinishEvent(view: LottieAnimationView, isCancelled: Boolean) {
        val screenContext = view.context as ThemedReactContext
        val eventDispatcher = UIManagerHelper.getEventDispatcherForReactTag(screenContext, view.id)
        eventDispatcher?.dispatchEvent(
            OnAnimationFinishEvent(
                screenContext.surfaceId,
                view.id,
                isCancelled
            )
        )
    }

    @JvmStatic
    fun sendAnimationFailureEvent(view: LottieAnimationView, error: Throwable) {
        val screenContext = view.context as ThemedReactContext
        val eventDispatcher = UIManagerHelper.getEventDispatcherForReactTag(screenContext, view.id)
        eventDispatcher?.dispatchEvent(
            OnAnimationFailureEvent(
                screenContext.surfaceId,
                view.id,
                error
            )
        )
    }

    @JvmStatic
    fun sendAnimationLoadedEvent(view: LottieAnimationView) {
        val screenContext = view.context as ThemedReactContext
        val eventDispatcher = UIManagerHelper.getEventDispatcherForReactTag(screenContext, view.id)
        eventDispatcher?.dispatchEvent(
            OnAnimationLoadedEvent(
                screenContext.surfaceId,
                view.id,
            )
        )
    }

    @JvmStatic
    fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> {
        return MapBuilder.of(
            OnAnimationFinishEvent.EVENT_NAME,
            MapBuilder.of("registrationName", "onAnimationFinish"),
            OnAnimationFailureEvent.EVENT_NAME,
            MapBuilder.of("registrationName", "onAnimationFailure"),
            OnAnimationLoadedEvent.EVENT_NAME,
            MapBuilder.of("registrationName", "onAnimationLoaded"),
        )
    }

    @JvmStatic
    fun play(view: LottieAnimationView, startFrame: Int, endFrame: Int) {
        val withCustomFrames = startFrame != -1 && endFrame != -1
        Handler(Looper.getMainLooper()).post {
            if (withCustomFrames) {
                if (startFrame > endFrame) {
                    view.setMinAndMaxFrame(endFrame, startFrame)
                    if (view.speed > 0) {
                        view.reverseAnimationSpeed()
                    }
                } else {
                    view.setMinAndMaxFrame(startFrame, endFrame)
                    if (view.speed < 0) {
                        view.reverseAnimationSpeed()
                    }
                }
            } else {
                val actualStartFrame = view.composition?.startFrame?.toInt()
                val actualEndFrame = view.composition?.endFrame?.toInt()

                val minFrame = view.minFrame.toInt()
                val maxFrame = view.maxFrame.toInt()
                if (actualStartFrame != null && actualEndFrame != null && (minFrame != actualStartFrame || maxFrame != actualEndFrame)) {
                    view.setMinAndMaxFrame(actualStartFrame, actualEndFrame)
                }
            }
            if (ViewCompat.isAttachedToWindow(view)) {
                if (withCustomFrames) {
                    view.playAnimation()
                } else {
                    view.resumeAnimation()
                }
            } else {
                view.addOnAttachStateChangeListener(object : OnAttachStateChangeListener {
                    override fun onViewAttachedToWindow(v: View) {
                        val listenerView = v as LottieAnimationView
                        if (withCustomFrames) {
                            view.playAnimation()
                        } else {
                            view.resumeAnimation()
                        }
                        listenerView.removeOnAttachStateChangeListener(this)
                    }

                    override fun onViewDetachedFromWindow(v: View) {
                        val listenerView = v as LottieAnimationView
                        listenerView.removeOnAttachStateChangeListener(this)
                    }
                })
            }
        }
    }

    @JvmStatic
    fun reset(view: LottieAnimationView) {
        Handler(Looper.getMainLooper()).post {
            if (ViewCompat.isAttachedToWindow(view)) {
                view.cancelAnimation()
                view.progress = 0f
            }
        }
    }

    @JvmStatic
    fun pause(view: LottieAnimationView) {
        Handler(Looper.getMainLooper()).post {
            if (ViewCompat.isAttachedToWindow(view)) {
                view.pauseAnimation()
            }
        }
    }

    @JvmStatic
    fun resume(view: LottieAnimationView) {
        Handler(Looper.getMainLooper()).post {
            if (ViewCompat.isAttachedToWindow(view)) {
                view.resumeAnimation()
            }
        }
    }

    @JvmStatic
    fun setSourceName(
        name: String?,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        // To match the behaviour on iOS we expect the source name to be
        // extensionless. This means "myAnimation" corresponds to a file
        // named `myAnimation.json` in `main/assets`. To maintain backwards
        // compatibility we only add the .json extension if no extension is
        // passed.
        var resultSourceName = name
        if (resultSourceName?.contains(".") == false) {
            resultSourceName = "$resultSourceName.json"
        }
        viewManager.animationName = resultSourceName
        viewManager.commitChanges()
    }

    @JvmStatic
    fun setSourceJson(
        json: String?,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        viewManager.animationJson = json
        viewManager.commitChanges()
    }

    @JvmStatic
    fun setSourceURL(
        urlString: String?,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        viewManager.animationURL = urlString
        viewManager.commitChanges()
    }

    @JvmStatic
    fun setSourceDotLottieURI(
        uri: String?,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        viewManager.sourceDotLottie = uri
        viewManager.commitChanges()
    }

    @JvmStatic
    fun setCacheComposition(view: LottieAnimationView, cacheComposition: Boolean) {
        view.setCacheComposition(cacheComposition)
    }

    @JvmStatic
    fun setResizeMode(
        resizeMode: String?,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        var mode: ImageView.ScaleType? = null
        when (resizeMode) {
            "cover" -> {
                mode = ImageView.ScaleType.CENTER_CROP
            }

            "contain" -> {
                mode = ImageView.ScaleType.FIT_CENTER
            }

            "center" -> {
                mode = ImageView.ScaleType.CENTER_INSIDE
            }
        }
        viewManager.scaleType = mode
    }

    @JvmStatic
    fun setRenderMode(
        renderMode: String?,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        var mode: RenderMode? = null
        when (renderMode) {
            "AUTOMATIC" -> {
                mode = RenderMode.AUTOMATIC
            }

            "HARDWARE" -> {
                mode = RenderMode.HARDWARE
            }

            "SOFTWARE" -> {
                mode = RenderMode.SOFTWARE
            }
        }
        viewManager.renderMode = mode
    }

    @JvmStatic
    fun setHardwareAcceleration(
        hardwareAccelerationAndroid: Boolean,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        var layerType: Int? = View.LAYER_TYPE_SOFTWARE
        if (hardwareAccelerationAndroid) {
            layerType = View.LAYER_TYPE_HARDWARE
        }
        viewManager.layerType = layerType
    }

    @JvmStatic
    fun setProgress(
        progress: Float,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        viewManager.progress = progress
    }

    @JvmStatic
    fun setSpeed(
        speed: Double,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        viewManager.speed = speed.toFloat()
    }

    @JvmStatic
    fun setLoop(
        loop: Boolean,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        viewManager.loop = loop
    }

    @JvmStatic
    fun setAutoPlay(
        autoPlay: Boolean,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        viewManager.autoPlay = autoPlay
    }

    @JvmStatic
    fun setEnableMergePaths(
        enableMergePaths: Boolean,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        viewManager.enableMergePaths = enableMergePaths
    }

    @JvmStatic
    fun setApplyOpacityToLayers(
        applyOpacityToLayers: Boolean,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        viewManager.applyOpacityToLayers = applyOpacityToLayers
    }

    @JvmStatic
    fun setEnableSafeMode(
        enableSafeMode: Boolean,
        viewManager: LottieAnimationViewPropertyManager
    ) {
        view
```

### Core Architecture Module: `packages/core/android/src/main/java/com/airbnb/android/react/lottie/LottieAnimationViewPropertyManager.kt`
```
package com.airbnb.android.react.lottie

import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Typeface
import android.net.Uri
import android.util.Log
import android.widget.ImageView
import com.airbnb.lottie.LottieAnimationView
import com.airbnb.lottie.LottieDrawable
import com.airbnb.lottie.LottieProperty
import com.airbnb.lottie.RenderMode
import com.airbnb.lottie.SimpleColorFilter
import com.airbnb.lottie.TextDelegate
import com.airbnb.lottie.FontAssetDelegate
import com.airbnb.lottie.model.KeyPath
import com.airbnb.lottie.value.LottieValueCallback
import com.facebook.react.bridge.ColorPropConverter
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.views.text.ReactFontManager
import com.facebook.react.common.ReactConstants.UNSET
import com.facebook.react.util.RNLog
import java.lang.ref.WeakReference
import java.util.regex.Pattern
import java.util.zip.ZipInputStream
import java.io.File
import java.io.FileInputStream

/**
 * Class responsible for applying the properties to the LottieView. The way react-native works makes
 * it impossible to predict in which order properties will be set, also some of the properties of
 * the LottieView needs to be set simultaneously.
 *
 * To solve this, instance of this class accumulates all changes to the view and applies them at the
 * end of react transaction, so it could control how changes are applied.
 */
class LottieAnimationViewPropertyManager(view: LottieAnimationView) {
    private val viewWeakReference: WeakReference<LottieAnimationView>
    private val TAG = "lottie-react-native"


    /**
     * Should be set to true if one of the animationName related parameters has changed as a result
     * of last reconciliation. We need to update the animation in this case.
     */
    private var animationNameDirty = false

    var animationName: String? = null
        set(value) {
            field = value
            this.animationNameDirty = true
        }
    var scaleType: ImageView.ScaleType? = null
    var imageAssetsFolder: String? = null
    var enableMergePaths: Boolean? = null
    var applyOpacityToLayers: Boolean? = null
    var enableSafeMode: Boolean? = null
    var colorFilters: ReadableArray? = null
    var textFilters: ReadableArray? = null
    var renderMode: RenderMode? = null
    var layerType: Int? = null
    var animationJson: String? = null
    var animationURL: String? = null
    var sourceDotLottie: String? = null
    var progress: Float? = null
    var loop: Boolean? = null
    var autoPlay: Boolean? = null
    var speed: Float? = null

    init {
        viewWeakReference = WeakReference(view)

        view.setFontAssetDelegate(object : FontAssetDelegate() {
            override fun fetchFont(fontFamily: String): Typeface {
                return ReactFontManager.getInstance()
                    .getTypeface(fontFamily, UNSET, UNSET, view.context.assets)
            }

            override fun fetchFont(fontFamily: String, fontStyle: String, fontName: String): Typeface {
                val weight = when (fontStyle) {
                    "Thin" -> 100
                    "Light" -> 200
                    "Normal", "Regular" -> 400
                    "Medium" -> 500
                    "Bold" -> 700
                    "Black" -> 900
                    else -> UNSET
                }
                return ReactFontManager.getInstance()
                    .getTypeface(fontName, UNSET, weight, view.context.assets)
            }
        })
    }

    /**
     * Updates the view with changed fields. Majority of the properties here are independent so they
     * are has to be reset to null as soon as view is updated with the value.
     *
     * The only exception from this rule is the group of the properties for the animation. For now
     * this is animationName and cacheStrategy. These two properties are should be set
     * simultaneously if the dirty flag is set.
     */
    fun commitChanges() {
        val view = viewWeakReference.get() ?: return

        textFilters?.let {
            if (it.size() > 0) {
                val textDelegate = TextDelegate(view)
                for (i in 0 until it.size()) {
                    val current = it.getMap(i) ?: continue
                    val searchText = current.getString("find")
                    val replacementText = current.getString("replace")
                    textDelegate.setText(searchText, replacementText)
                }
                view.setTextDelegate(textDelegate)
            }
        }

        animationJson?.let {
            view.setAnimationFromJson(it, it.hashCode().toString())
            animationJson = null
        }

        animationURL?.let {
            var file = File(it)
            if (file.exists()) {
                view.setAnimation(FileInputStream(file), it.hashCode().toString())
            } else {
                view.setAnimationFromUrl(it, it.hashCode().toString())
            }
            animationURL = null
        }

        sourceDotLottie?.let { assetName ->
            var file = File(assetName)
            if (file.exists()) {
                view.setAnimation(
                    ZipInputStream(FileInputStream(file)),
                    assetName.hashCode().toString()
                )
                sourceDotLottie = null
                return
            }

            val scheme = runCatching { Uri.parse(assetName).scheme }.getOrNull()
            if (scheme != null) {
                // if the asset path has file:// prefix, which indicates locally stored file, parse the path to be able to load it properly
                // This is useful for apps, which are using OTA (CodePush, Expo-Updates etc.)
                if (scheme == "file") {
                    val uri = Uri.parse(assetName)
                    uri.path?.let { path ->
                        val fileWithScheme = File(path)
                        view.setAnimation(
                            ZipInputStream(FileInputStream(fileWithScheme)),
                            assetName.hashCode().toString()
                        )
                    } ?: Log.w(TAG, "URI path is null for asset: $assetName")
                } else {
                    view.setAnimationFromUrl(assetName)
                }
                sourceDotLottie = null
                return
            }

            // resource needs to be loaded in release mode: https://github.com/facebook/react-native/issues/24963#issuecomment-532168307
            val resourceId = view.resources.getIdentifier(
                assetName,
                "raw",
                view.context.packageName
            )

            if (resourceId == 0) {
                RNLog.e("Animation for $assetName was not found in raw resources")
                return
            }

            view.setAnimation(resourceId)
            animationNameDirty = false
            sourceDotLottie = null
        }

        if (animationNameDirty) {
            view.setAnimation(animationName)
            animationNameDirty = false
        }

        progress?.let {
            view.progress = it
            progress = null
        }

        loop?.let {
            view.repeatCount = if (it) LottieDrawable.INFINITE else 0
            loop = null
        }

        autoPlay?.let {
            if (it && !view.isAnimating) {
                view.playAnimation()
            }
        }

        speed?.let {
            view.speed = it
            speed = null
        }

        scaleType?.let {
            view.scaleType = it
            scaleType = null
        }

        renderMode?.let {
            view.renderMode = it
            renderMode = null
        }

        layerType?.let { view.setLayerType(it, null) }

        imageAssetsFolder?.let {
            view.imageAssetsFolder = it
            imageAssetsFolder = null
        }

        enableMergePaths?.let {
            view.enableMergePathsForKitKatAndAbove(it)
            enableMergePaths = null
        }

        applyOpacityToLayers?.let {
            view.setApplyingOpacityToLayersEnabled(it)
            applyOpacityToLayers = null
        }

        enableSafeMode?.let {
            view.setSafeMode(it)
            enableSafeMode = null
        }

        colorFilters?.let { colorFilters ->
            if (colorFilters.size() > 0) {
                for (i in 0 until colorFilters.size()) {
                    val current = colorFilters.getMap(i) ?: continue
                    parseColorFilter(current, view)
                }
            }
        }
    }

    private fun parseColorFilter(
        colorFilter: ReadableMap,
        view: LottieAnimationView
    ) {
        val color: Int = if (colorFilter.getType("color") == ReadableType.Map) {
            ColorPropConverter.getColor(colorFilter.getMap("color"), view.context) ?: Color.TRANSPARENT;
        } else {
            colorFilter.getInt("color")
        }

        val path = colorFilter.getString("keypath")
        val pathGlob = "$path.**"
        val keys = pathGlob.split(Pattern.quote(".").toRegex())
            .dropLastWhile { it.isEmpty() }
            .toTypedArray()
        val keyPath = KeyPath(*keys)

        val filter: ColorFilter = SimpleColorFilter(color)
        val colorFilterCallback = LottieValueCallback(filter)

        view.addValueCallback(keyPath, LottieProperty.COLOR_FILTER, colorFilterCallback)
    }
}

```

### Core Architecture Module: `packages/core/android/src/main/java/com/airbnb/android/react/lottie/LottiePackage.kt`
```
package com.airbnb.android.react.lottie

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

@Suppress("unused")
class LottiePackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return emptyList()
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(LottieAnimationViewManager())
    }
}
```

### Core Architecture Module: `packages/core/android/src/main/java/com/airbnb/android/react/lottie/OnAnimationFailureEvent.kt`
```
package com.airbnb.android.react.lottie

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

class OnAnimationFailureEvent
constructor(surfaceId: Int, viewId: Int, private val error: Throwable) :
    Event<OnAnimationFailureEvent>(surfaceId, viewId) {

    override fun getEventName(): String {
        return EVENT_NAME
    }

    override fun getCoalescingKey(): Short = 0

    override fun getEventData(): WritableMap? {
        val event = Arguments.createMap()
        event.putString("error", error.message)
        return event
    }

    companion object {
        const val EVENT_NAME = "topAnimationFailure"
    }
}
```

### Core Architecture Module: `packages/core/android/src/main/java/com/airbnb/android/react/lottie/OnAnimationFinishEvent.kt`
```
package com.airbnb.android.react.lottie

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

class OnAnimationFinishEvent
constructor(surfaceId: Int, viewId: Int, private val isCancelled: Boolean) :
    Event<OnAnimationFinishEvent>(surfaceId, viewId) {

    override fun getEventName(): String {
        return EVENT_NAME
    }

    override fun getCoalescingKey(): Short = 0

    override fun getEventData(): WritableMap? {
        val event = Arguments.createMap()
        event.putBoolean("isCancelled", isCancelled)
        return event
    }

    companion object {
        const val EVENT_NAME = "topAnimationFinish"
    }
}
```

### Core Architecture Module: `packages/core/android/src/main/java/com/airbnb/android/react/lottie/OnAnimationLoadedEvent.kt`
```
package com.airbnb.android.react.lottie

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

class OnAnimationLoadedEvent constructor(surfaceId: Int, viewId: Int) :
    Event<OnAnimationLoadedEvent>(surfaceId, viewId) {

    override fun getEventName(): String {
        return EVENT_NAME
    }

    override fun getEventData(): WritableMap? {
        return Arguments.createMap()
    }

    companion object {
        const val EVENT_NAME = "topAnimationLoaded"
    }
}

```

### Core Architecture Module: `packages/core/android/src/newarch/com/airbnb/android/react/lottie/LottieAnimationViewManager.kt`
```
package com.airbnb.android.react.lottie

import android.animation.Animator
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setApplyOpacityToLayers
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setColorFilters
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setEnableMergePaths
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setEnableSafeMode
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setHardwareAcceleration
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setImageAssetsFolder
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setLoop
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setProgress
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setRenderMode
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setResizeMode
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setSourceJson
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setSourceName
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setSourceURL
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setSpeed
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setTextFilters
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setAutoPlay
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setSourceDotLottieURI
import com.airbnb.lottie.LottieAnimationView
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.LottieAnimationViewManagerDelegate
import com.facebook.react.viewmanagers.LottieAnimationViewManagerInterface
import java.util.*

@ReactModule(name = LottieAnimationViewManagerImpl.REACT_CLASS)
class LottieAnimationViewManager :
    SimpleViewManager<LottieAnimationView>(),
    LottieAnimationViewManagerInterface<LottieAnimationView> {
    private val propManagersMap =
        WeakHashMap<LottieAnimationView, LottieAnimationViewPropertyManager>()
    private val delegate: ViewManagerDelegate<LottieAnimationView>

    init {
        delegate = LottieAnimationViewManagerDelegate(this)
    }

    private fun getOrCreatePropertyManager(view: LottieAnimationView): LottieAnimationViewPropertyManager {
        var result = propManagersMap[view]
        if (result == null) {
            result = LottieAnimationViewPropertyManager(view)
            propManagersMap[view] = result
        }
        return result
    }

    override fun getDelegate(): ViewManagerDelegate<LottieAnimationView> {
        return delegate
    }

    override fun getExportedViewConstants(): Map<String, Any> {
        return LottieAnimationViewManagerImpl.exportedViewConstants
    }

    override fun getName(): String {
        return LottieAnimationViewManagerImpl.REACT_CLASS
    }

    public override fun createViewInstance(context: ThemedReactContext): LottieAnimationView {
        val view = LottieAnimationViewManagerImpl.createViewInstance(context)
         view.setFailureListener {
            LottieAnimationViewManagerImpl.sendAnimationFailureEvent(view, it)
        }
        view.addLottieOnCompositionLoadedListener {
            LottieAnimationViewManagerImpl.sendAnimationLoadedEvent(view)
        }
        view.addAnimatorListener(object : Animator.AnimatorListener {
            override fun onAnimationStart(animation: Animator) {
                //do nothing
            }

            override fun onAnimationEnd(animation: Animator) {
                LottieAnimationViewManagerImpl.sendOnAnimationFinishEvent(view, false)
            }

            override fun onAnimationCancel(animation: Animator) {
                LottieAnimationViewManagerImpl.sendOnAnimationFinishEvent(view, true)
            }

            override fun onAnimationRepeat(animation: Animator) {
                //do nothing
            }
        })
        return view
    }

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any>? {
        return LottieAnimationViewManagerImpl.getExportedCustomDirectEventTypeConstants()
    }

    override fun onAfterUpdateTransaction(view: LottieAnimationView) {
        super.onAfterUpdateTransaction(view)
        getOrCreatePropertyManager(view).commitChanges()
    }

    override fun receiveCommand(
        root: LottieAnimationView,
        commandId: String,
        args: ReadableArray?
    ) {
        delegate.receiveCommand(root, commandId, args)
    }

    override fun play(view: LottieAnimationView, startFrame: Int, endFrame: Int) {
        LottieAnimationViewManagerImpl.play(view, startFrame, endFrame)
    }

    override fun reset(view: LottieAnimationView) {
        LottieAnimationViewManagerImpl.reset(view)
    }

    override fun pause(view: LottieAnimationView) {
        LottieAnimationViewManagerImpl.pause(view)
    }

    override fun resume(view: LottieAnimationView) {
        LottieAnimationViewManagerImpl.resume(view)
    }

    @ReactProp(name = "sourceName")
    override fun setSourceName(view: LottieAnimationView, name: String?) {
        setSourceName(name, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "sourceJson")
    override fun setSourceJson(view: LottieAnimationView, json: String?) {
        setSourceJson(json, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "sourceURL")
    override fun setSourceURL(view: LottieAnimationView, urlString: String?) {
        setSourceURL(urlString, getOrCreatePropertyManager(view))
    }
    
    @ReactProp(name = "sourceDotLottieURI")
    override fun setSourceDotLottieURI(view: LottieAnimationView, urlString: String?) {
        setSourceDotLottieURI(urlString, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "cacheComposition")
    override fun setCacheComposition(view: LottieAnimationView, cacheComposition: Boolean) {
        LottieAnimationViewManagerImpl.setCacheComposition(view, cacheComposition)
    }

    @ReactProp(name = "resizeMode")
    override fun setResizeMode(view: LottieAnimationView, resizeMode: String?) {
        setResizeMode(resizeMode, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "renderMode")
    override fun setRenderMode(view: LottieAnimationView, renderMode: String?) {
        setRenderMode(renderMode, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "progress")
    override fun setProgress(view: LottieAnimationView, progress: Float) {
        setProgress(progress, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "speed")
    override fun setSpeed(view: LottieAnimationView, speed: Double) {
        setSpeed(speed, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "loop")
    override fun setLoop(view: LottieAnimationView, loop: Boolean) {
        setLoop(loop, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "autoPlay")
    override fun setAutoPlay(view: LottieAnimationView, autoPlay: Boolean) {
        setAutoPlay(autoPlay, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "imageAssetsFolder")
    override fun setImageAssetsFolder(view: LottieAnimationView, imageAssetsFolder: String?) {
        setImageAssetsFolder(imageAssetsFolder, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "enableMergePathsAndroidForKitKatAndAbove")
    override fun setEnableMergePathsAndroidForKitKatAndAbove(
        view: LottieAnimationView,
        enableMergePaths: Boolean
    ) {
        setEnableMergePaths(enableMergePaths, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "applyOpacityToLayersAndroid")
    override fun setApplyOpacityToLayersAndroid(
        view: LottieAnimationView,
        applyOpacityToLayers: Boolean
    ) {
        setApplyOpacityToLayers(applyOpacityToLayers, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "enableSafeModeAndroid")
    override fun setEnableSafeModeAndroid(view: LottieAnimationView, enableSafeMode: Boolean) {
        setEnableSafeMode(enableSafeMode, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "hardwareAccelerationAndroid")
    override fun setHardwareAccelerationAndroid(
        view: LottieAnimationView,
        hardwareAccelerationAndroid: Boolean
    ) {
        setHardwareAcceleration(hardwareAccelerationAndroid, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "colorFilters")
    override fun setColorFilters(view: LottieAnimationView, colorFilters: ReadableArray?) {
        setColorFilters(colorFilters, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "textFiltersAndroid")
    override fun setTextFiltersAndroid(view: LottieAnimationView, textFilters: ReadableArray?) {
        setTextFilters(textFilters, getOrCreatePropertyManager(view))
    }

    // this props is not available on Android, however we must override the setter
    override fun setTextFiltersIOS(view: LottieAnimationView?, value: ReadableArray?) {
        //ignore - do nothing here
    }

    // Only here to solve an iOS issue with codegen. Check dummy prop in LottieAnimationViewNativeComponent.ts
    override fun setDummy(view: LottieAnimationView, value: ReadableMap?) {
        //ignore - do nothing here
    }
}

```

### Core Architecture Module: `packages/core/android/src/oldarch/com/airbnb/android/react/lottie/LottieAnimationViewManager.kt`
```
package com.airbnb.android.react.lottie

import android.animation.Animator
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.pause
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.play
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.reset
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.resume
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setAutoPlay
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setApplyOpacityToLayers
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setColorFilters
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setEnableMergePaths
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setEnableSafeMode
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setHardwareAcceleration
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setImageAssetsFolder
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setLoop
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setProgress
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setRenderMode
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setResizeMode
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setSourceDotLottieURI
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setSourceJson
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setSourceName
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setSourceURL
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setSpeed
import com.airbnb.android.react.lottie.LottieAnimationViewManagerImpl.setTextFilters
import com.airbnb.lottie.LottieAnimationView
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import java.util.WeakHashMap

class LottieAnimationViewManager : SimpleViewManager<LottieAnimationView>() {
    private val propManagersMap =
        WeakHashMap<LottieAnimationView, LottieAnimationViewPropertyManager>()

    private fun getOrCreatePropertyManager(
        view: LottieAnimationView
    ): LottieAnimationViewPropertyManager {
        var result = propManagersMap[view]
        if (result == null) {
            result = LottieAnimationViewPropertyManager(view)
            propManagersMap[view] = result
        }
        return result
    }

    override fun getExportedViewConstants(): Map<String, Any> {
        return LottieAnimationViewManagerImpl.exportedViewConstants
    }

    override fun getName(): String {
        return LottieAnimationViewManagerImpl.REACT_CLASS
    }

    public override fun createViewInstance(context: ThemedReactContext): LottieAnimationView {
        val view = LottieAnimationViewManagerImpl.createViewInstance(context)
        view.setFailureListener {
            LottieAnimationViewManagerImpl.sendAnimationFailureEvent(view, it)
        }
        view.addLottieOnCompositionLoadedListener {
            LottieAnimationViewManagerImpl.sendAnimationLoadedEvent(view)
        }
        view.addAnimatorListener(
            object : Animator.AnimatorListener {
                override fun onAnimationStart(animation: Animator) {
                    // do nothing
                }

                override fun onAnimationEnd(animation: Animator) {
                    LottieAnimationViewManagerImpl.sendOnAnimationFinishEvent(view, false)
                }

                override fun onAnimationCancel(animation: Animator) {
                    LottieAnimationViewManagerImpl.sendOnAnimationFinishEvent(view, true)
                }

                override fun onAnimationRepeat(animation: Animator) {
                    // do nothing
                }
            }
        )
        return view
    }

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any>? {
        return LottieAnimationViewManagerImpl.getExportedCustomDirectEventTypeConstants()
    }

    override fun receiveCommand(
        view: LottieAnimationView,
        commandName: String,
        args: ReadableArray?
    ) {
        when (commandName) {
            "play" -> play(view, args?.getInt(0) ?: -1, args?.getInt(1) ?: -1)
            "reset" -> reset(view)
            "pause" -> pause(view)
            "resume" -> resume(view)
            else -> {
                // do nothing
            }
        }
    }

    @ReactProp(name = "sourceName")
    fun setSourceName(view: LottieAnimationView, name: String?) {
        setSourceName(name, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "sourceJson")
    fun setSourceJson(view: LottieAnimationView, json: String?) {
        setSourceJson(json, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "sourceURL")
    fun setSourceURL(view: LottieAnimationView, urlString: String?) {
        setSourceURL(urlString, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "cacheComposition")
    fun setCacheComposition(view: LottieAnimationView?, cacheComposition: Boolean) {
        LottieAnimationViewManagerImpl.setCacheComposition(view!!, cacheComposition)
    }

    @ReactProp(name = "resizeMode")
    fun setResizeMode(view: LottieAnimationView, resizeMode: String?) {
        setResizeMode(resizeMode, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "renderMode")
    fun setRenderMode(view: LottieAnimationView, renderMode: String?) {
        setRenderMode(renderMode, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "hardwareAccelerationAndroid")
    fun setHardwareAccelerationAndroid(
        view: LottieAnimationView,
        hardwareAccelerationAndroid: Boolean?
    ) {
        setHardwareAcceleration(hardwareAccelerationAndroid!!, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "progress")
    fun setProgress(view: LottieAnimationView, progress: Float) {
        setProgress(progress, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "speed")
    fun setSpeed(view: LottieAnimationView, speed: Double) {
        setSpeed(speed, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "loop")
    fun setLoop(view: LottieAnimationView, loop: Boolean) {
        setLoop(loop, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "autoPlay")
    fun setAutoPlay(view: LottieAnimationView, autoPlay: Boolean) {
        setAutoPlay(autoPlay, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "imageAssetsFolder")
    fun setImageAssetsFolder(view: LottieAnimationView, imageAssetsFolder: String?) {
        setImageAssetsFolder(imageAssetsFolder, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "enableMergePathsAndroidForKitKatAndAbove")
    fun setEnableMergePaths(view: LottieAnimationView, enableMergePaths: Boolean) {
        setEnableMergePaths(enableMergePaths, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "applyOpacityToLayersAndroid")
    fun setApplyOpacityToLayersAndroid(
        view: LottieAnimationView,
        applyOpacityToLayers: Boolean
    ) {
        setApplyOpacityToLayers(applyOpacityToLayers, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "enableSafeModeAndroid")
    fun setEnableSafeMode(view: LottieAnimationView, enableSafeMode: Boolean) {
        setEnableSafeMode(enableSafeMode, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "colorFilters")
    fun setColorFilters(view: LottieAnimationView, colorFilters: ReadableArray?) {
        setColorFilters(colorFilters, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "textFiltersAndroid")
    fun setTextFilters(view: LottieAnimationView, textFilters: ReadableArray?) {
        setTextFilters(textFilters, getOrCreatePropertyManager(view))
    }

    @ReactProp(name = "sourceDotLottieURI")
    fun setSourceDotLottie(view: LottieAnimationView, uri: String?) {
        setSourceDotLottieURI(uri, getOrCreatePropertyManager(view))
    }

    override fun onAfterUpdateTransaction(view: LottieAnimationView) {
        super.onAfterUpdateTransaction(view)
        getOrCreatePropertyManager(view).commitChanges()
    }
}

```

### Core Architecture Module: `packages/core/babel.config.js`
```
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
};

```

### Core Architecture Module: `packages/core/ios/Fabric/LottieAnimationViewComponentView.h`
```
#ifdef __cplusplus
#import <React/RCTViewComponentView.h>
#import <react/renderer/components/lottiereactnative/Props.h>
#import "LottieContainerView.h"

NS_ASSUME_NONNULL_BEGIN

@interface LottieAnimationViewComponentView : RCTViewComponentView <LottieContainerViewDelegate>
@end

namespace facebook {
    namespace react {
        // In order to compare these structs we need to add the == operator for each
        // TODO: https://github.com/reactwg/react-native-new-architecture/discussions/91#discussioncomment-4426469
        bool operator==(const LottieAnimationViewColorFiltersStruct& a, const LottieAnimationViewColorFiltersStruct& b)
        {
            return b.keypath == a.keypath && b.color == a.color;
        }

        bool operator==(const LottieAnimationViewTextFiltersIOSStruct& a, const LottieAnimationViewTextFiltersIOSStruct& b)
        {
            return b.keypath == a.keypath && b.text == a.text;
        }
    }
}

NS_ASSUME_NONNULL_END

#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1363** (2025-08-04): **[Android]: borderRadius not respected with backgroundColor**
  *Symptoms*: ### Description  When defining a lottie component with `backgroundColor` and `borderRadius`, On android, the borderRadius is not applied. See screenshots: - on right, ios does correctly apply borderRadius - on left, android doesn't apply borderRadius  <img width="840" height="724" alt="Image" src="https://github.com/user-attachments/assets/bfcbe7cb-9ba3-4d01-bbf9-1fdcc1e092e8" />   ### Steps to reproduce  defined a LottieView ```JS       <LottieView         ref={ref}         source={source}         style={{            width: 400,            height: 400,            borderRadius: 200,            backgroundColor: 'yellow',         }}         enableMergePathsAndroidForKitKatAndAbove         enableSafeModeAndroid       /> ```  I created a reproduction sample directly in the sample app from the repository, here is the patch:  https://github.com/freeboub/bug-lottie-react-native-background-border-radius/commit/e5c62bcb65530f8f7aa44949fa23e5084f39e8ec  ### Snack or a link to a repository  https://github.com/freeboub/bug-lottie-react-native-background-border-radius/commit/e5c62bcb65530f8f7aa44949fa23e5084f39e8ec  ### Lottie React Native version  7.2.4  ### React Native version  0.73.8 (sample) but also reproduced in 0.79.3 (my full integrated app)  ### Platforms  Android  ### Workflow  React Native  ### Architecture  Fabric (New Architecture)  ### Build type  None  ### Device  None  ### Acknowledgements  Yes

- **Issue #1138** (2023-12-21): **Build issue in react-native v0.73 new architecture.**
  *Symptoms*: ### Description The following build commands failed: 	CompileC /Users/niteshrajkhanal/Library/Developer/Xcode/DerivedData/singlecustomerapp-ggsyyaqexacwdkfzzmjannnihwfm/Build/Intermediates.noindex/Pods.build/Debug-iphoneos/lottie-react-native.build/Objects-normal/arm64/LottieAnimationViewComponentView.o /Users/niteshrajkhanal/Desktop/development/sca-mobile-app/node_modules/lottie-react-native/ios/Fabric/LottieAnimationViewComponentView.mm normal arm64 objective-c++ com.apple.compilers.llvm.clang.1_0.compiler (in target 'lottie-react-native' from project 'Pods') (1 failure)  ### Steps to Reproduce  1. Create a new react native application. 2. Package.json  {   "name": "singlecustomerapp",   "version": "0.0.1",   "private": true,   "scripts": {     "android": "react-native run-android",     "ios": "react-native run-ios",     "ios-15": "npx react-native run-ios --simulator='iPhone 15 Pro'",     "lint": "eslint .",     "start": "react-native start",     "test": "jest",     "type-check": "tsc",     "test:report": "jest --collectCoverage --coverageDirectory=\"./coverage\" --ci --reporters=default --reporters=jest-junit --coverage",     "pod-install": "cd ios && RCT_NEW_ARCH_ENABLED=1 bundle exec pod install && cd ..",     "gen-release-apk": "cd android && ./gradlew assembleRelease && cd ..",     "gen-release-bundle": "cd android && ./gradlew bundleRelease && cd ..",     "bundle-android": "react-native bundle --platform android --dev false --entry-file index
  **Post-Mortem & Fix Analysis**:
  > This may be an issue with react-native itself (assuming this is the same problem I am running into).  Here's the actual error output from the failed compilation: ``` In file included from /redacted-path/AwesomeProject/node_modules/lottie-react-native/ios/Fabric/LottieAnimationViewComponentView.mm:1: In file included from /redacted-path/AwesomeProject/node_modules/lottie-react-native/ios/Fabric/LottieAnimationViewComponentView.h:2: In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-RCTFabric/React/RCTViewComponentView.h:15: In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-Fabric/react/renderer/components/view/ViewProps.h:10: In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-Fabric/react/renderer/components/view/HostPlatformViewProps.h:10: In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-Fabric/react/renderer/components/view/BaseViewProps.h:11: /redac
  > > This may be an issue with react-native itself (assuming this is the same problem I am running into). >  > Here's the actual error output from the failed compilation: >  > ``` > In file included from /redacted-path/AwesomeProject/node_modules/lottie-react-native/ios/Fabric/LottieAnimationViewComponentView.mm:1: > In file included from /redacted-path/AwesomeProject/node_modules/lottie-react-native/ios/Fabric/LottieAnimationViewComponentView.h:2: > In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-RCTFabric/React/RCTViewComponentView.h:15: > In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-Fabric/react/renderer/components/view/ViewProps.h:10: > In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-Fabric/react/renderer/components/view/HostPlatformViewProps.h:10: > In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-Fabric/react/renderer/components/view/Bas
  > no not yet.  I did make a repro project though: https://github.com/heath-clink/rn73-lottie-repro  That's just RN0.73 template project with lottie added, and exhibits this build error when using new architecture.

- **Issue #1114** (2023-12-30): **resizeMode cover not working in IOS (Dot Lottie)**
  *Symptoms*: Hey, i am using below version "lottie-ios": "4.3.0", "lottie-react-native": "6.3.0",  passing resizeMode "cover" is not working. Also we have tried downgrading/upgrading both packages, but resizeMode cover is not working.  ![File](https://github.com/lottie-react-native/lottie-react-native/assets/26677033/5ae469e0-8d42-4267-97ca-547cc40e60b1) 
  **Post-Mortem & Fix Analysis**:
  > Also its only happening for IOS. And working fine when we are using .json file. But for .lottie its not working in ios.
  > ![Screenshot 2023-10-05 at 11 52 53 PM](https://github.com/lottie-react-native/lottie-react-native/assets/26677033/01e507ce-69be-45fb-84e7-e0686c982a64)  Although sometime its working as expected, when i save my file.
  > Same issue here (only iOS), it works for the first time, then when getting back to the page it doesn't recognize the `resizeMode`.

- **Issue #1111** (2023-11-02): **Lottie Animations not playing on iOS 17**
  *Symptoms*: On some iOS devices running iOS 17 the lottie animations are not playing and therefore the onAnimationFinish callback is not being called. This issue started manifesting itself quite randomly on devices running iOS 17, and frankly I haven't had a chance to reproduce it yet, but was able to verify that this was the issue after a user reached out to us with a video where the lottie animation was frozen, and this users device it would always happen.  After performing a reset of settings on the device (Settings -> General -> Transfer or Reset iPhone -> Reset -> Reset All Settings) the animations start running normally again, but obviously this is not the ideal scenario.  Starting this as a discussion and a possible bug report in case anyone is facing the same problem.  As a work around, what we've done on our side is to set a timeout on the screens that depend on animation completion to trigger something else
  **Post-Mortem & Fix Analysis**:
  > we are facing the same exact issue. we use a lottie animation for our splash screen and trigger it to hide on the onAnimationFinished event. unfortunately the animation never plays so the splash screen is stuck for those ios17 users affected by the issue. we implemented an alternative animation using RN Animated as a workaround for now.
  > Just ran into this as well. We ended up implementing a timeout like @jeffersontpadua did but it's a poor user experience obviously. :(
  > Hi @jeffersontpadua   We are facing the same issue. On what version did you notice this issue? We are seeing this on 5.1.6; However, since 6.1.0, there is an onAnimationFailure.  Are you using a version >= 6.1.0 and are you using the onAnimationFailure and still getting the mentioned issue? 

- **Issue #1090** (2023-08-16): **6.1.2 DotLottie's not working for Android Release mode**
  *Symptoms*: ### Description  When building a release version of a RN app, the `.lottie` files will not load.  ### Steps to Reproduce  1. react-native run-android --variant=release 2. install release version of app on device  **Expected behavior:** [What you expected to happen]  The lotties should load  **Actual behavior:** [What actually happened]  The lotties will not load, and you get an error in `onAnimationFailure` of `no protocol`  ### Minimal reproduction  <!-- A link to a minimal reproduction of the issue -->  ### React Native Environment ``` System:     OS: macOS 13.3.1     CPU: (10) arm64 Apple M1 Pro     Memory: 84.34 MB / 16.00 GB     Shell: 5.9 - /bin/zsh   Binaries:     Node: 18.16.1 - ~/.nvm/versions/node/v18.16.1/bin/node     Yarn: 1.22.19 - /opt/homebrew/bin/yarn     npm: 9.5.1 - ~/.nvm/versions/node/v18.16.1/bin/npm     Watchman: 2023.07.10.00 - /opt/homebrew/bin/watchman   Managers:     CocoaPods: 1.12.1 - /opt/homebrew/bin/pod   SDKs:     iOS SDK:       Platforms: DriverKit 22.4, iOS 16.4, macOS 13.3, tvOS 16.4, watchOS 9.4     Android SDK: Not Found   IDEs:     Android Studio: 2022.2 AI-222.4459.24.2221.9862592     Xcode: 14.3.1/14E300c - /usr/bin/xcodebuild   Languages:     Java: 11.0.12 - /usr/local/opt/openjdk@11/bin/javac   npmPackages:     @react-native-community/cli: Not Found     react: 18.2.0 => 18.2.0      react-native: 0.71.12 => 0.71.12      react-native-macos: Not Found   npmGlobalPackages:     *react-nativ
  **Post-Mortem & Fix Analysis**:
  > I also just tested out the `paper` example app in the repo, and the local Dot Lottie example is also broken in Release mode on Android
  > @matinzd happy to jump on a call with you to help debug, I spent a lot of time yesterday trying to figure out whats happening, but it seem to be with how the `.lottie` files are getting bundled into the .apk when building for release. Once they are bundled then the `lottie-android` is unable to access them from the bundled assets and returns back the "no protocol" error  For now we have reverted back to using the `.json` files
  > Is it working properly on iOS release? 

- **Issue #1018** (2023-06-22): **Build crashing on React native macos**
  *Symptoms*: ### Description I have installed react-native-macos in my project. Android and IOS are working fine with react-native-lotte. But when i am trying to build the macos project, the build is crashing.   [Description of the bug] The following build commands failed: 	SwiftEmitModule normal arm64 Emitting\ module\ for\ lottie_react_native (in target 'lottie-react-native-macOS' from project 'Pods') (1 failure)  Also when I see my XCODE, getting this error Cannot find type 'UITraitCollection' in scope ### Steps to Reproduce  react-native run-macos  **Expected behavior:** [What you expected to happen] App should work as it is working for android and ios **Actual behavior:** [What actually happened] App is crashing <img width="1181" alt="Screenshot 2023-05-01 at 3 14 17 PM" src="https://user-images.githubusercontent.com/37023744/235439478-0860f6e3-3e66-4ee6-a0da-0e1c583dfa6e.png">  ### Versions react native: 0.71 react native macos: 0.71  You can get this information from executing `npm version`. 
  **Post-Mortem & Fix Analysis**:
  > What version of lottie are you using?
  > @matinzd  > What version of lottie are you using?  "lottie-react-native": "^5.1.5", "react": "18.2.0", "react-native": "0.71.7", "react-native-macos": "^0.71.0-0",
  > React Native macOS maintainer here, if we ifdef out the iOS block for macOS, are there any other issues? I took a quick look at the code and it seems to be implemented cross platform

- **Issue #999** (2023-08-10): **Cannot get any Lottie animations to show in an Expo SDK 48 React Native app.**
  *Symptoms*: ### Description  Cannot get any Lottie animations to show in an Expo SDK 48 React Native app.  ### Steps to Reproduce  1. Install `lottie-react-native` as described by Expo docs [here](https://docs.expo.dev/versions/latest/sdk/lottie/) (we are using the managed workflow) 2. Add LottieView as described within the Expo docs:  `      <LottieView         autoPlay         ref={animation}         style={{           width: 200,           height: 200,           backgroundColor: '#eee',         }}         source={require('./assets/gradientBall.json')}       />` 3. I have tried the various solutions suggested by this [thread](https://github.com/lottie-react-native/lottie-react-native/issues/832) to no luck or avail.  **Expected behavior:** See Lottie Animation on screen. One thing to mention is that we are using [development-client](https://docs.expo.dev/development/create-development-builds/) builds for Expo, so NOT the Expo Go app. We're also using the **hermes** engine if that means anything.  **Actual behavior:** Expect to see Lottie animation on screen but the area is occupied and I can see the background but there is no animation. It never plays and never appears.  ### Versions `  "lottie-react-native": "5.1.4",     "react": "18.2.0",     "react-dom": "18.2.0",     "react-native": "0.71.3",`  
  **Post-Mortem & Fix Analysis**:
  > I am working on releasing v6 and communicating with expo to increase the recommended version and that should fix all the issues for all expo users.  Stay tuned! 
  > > I am working on releasing v6 and communicating with expo to increase the recommended version and that should fix all the issues for all expo users. Stay tuned!  Thanks, man! Appreciate your effort!
  > > I am working on releasing v6 and communicating with expo to increase the recommended version and that should fix all the issues for all expo users.  > Stay tuned!  When can we expect v6 to be released? Can you give us an estimated time frame? 

- **Issue #989** (2023-04-15): **[Windows] Styles with positional attributes are applied twice, resulting in incorrect positioning.**
  *Symptoms*: ### Description LottieView is implemented as:  ``` <View style={[aspectRatioStyle, sizeStyle, style]}>     <AnimatedNativeLottieView style={[             aspectRatioStyle,             sizeStyle || { width: '100%', height: '100%' },             style,           ]}     /> </View> ```  Here we can see the incoming style property is applied twice, once to outer view and again to the native control. This means that if the style contains positional settings, such as `{ left: 50 }`, they first cause the outer View container to be translated relative to its parent, and then the animation itself to be translated further.  ### Steps to Reproduce ``` <View style={{ backgroundColor: "blue"}}>     <LottieView style={ { left: 50, width: 50, height: 50, backgroundColor: "red" } } /> </View> ``` **Expected behavior:** Animation is positioned 50 units way from the left side of the surrounding blue box, and the red color is only behind the animation. ![image](https://user-images.githubusercontent.com/1130900/219801161-876f5a06-42d1-4960-bd42-6f8b78f9608b.png)  **Actual behavior:** Red box is positioned 50 units from the left of the surrounding blue box top-left corner, animation is positioned a further 50 units to the right. ![image](https://user-images.githubusercontent.com/1130900/219801083-72f4281a-8ca1-49c6-8234-fbaca7776d78.png)  ### Versions lottie-react-native: 5.1.5 react: 18.0 react-native: 0.69.3 react-native-windows: 0.69.19  Tested on Windows only
  **Post-Mortem & Fix Analysis**:
  > This should get fixed in v6. I will close this for now.  Feel free to reopen it.
  > same issue here in v6, my code:  ``` <View       style={{         paddingHorizontal: 30,         paddingTop: insets.top ,         flex:1,         paddingBottom: insets.bottom + 10,         backgroundColor: colors.background,       }}     >       <LottieView       source={require("../../../../assets/lottie/error.json")}       style={{width: 100, height: 100, backgroundColor: "blue"}}       autoPlay       loop     /> </View> ```  <img width="434" alt="Screenshot 2023-08-01 alle 11 23 07" src="https://github.com/lottie-react-native/lottie-react-native/assets/56274206/1d24fe70-02c0-42b8-9b2d-418d58bda5c7">  

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

### Incident Patch 1: `3ac0a0cb` (2026-08-22)
**Commit Message**: fix: support static animation sources (#1466)

* fix: support static animation sources

Keep the v7 and v8 source prop types aligned with the existing numeric asset runtime path.

Closes #1403.

* test: remove static source type test

---------

Co-authored-by: Parsa Nasirimehr <[REDACTED_EMAIL]>

**File**: `packages/core/src/types.ts` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ export interface LottieViewProps {
    * animation, obtained (for example) with something like
    * `require('../path/to/animation.json')`
    */
-  source: string | AnimationObject | { uri: string };
+  source: string | AnimationObject | { uri: string } | number;
 
   /**
    * A number between 0 and 1, or an `Animated` number between 0 and 1. This number
```

**File**: `packages/nitro/src/types.ts` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ export interface LottieViewProps {
    * animation, obtained (for example) with something like
    * `require('../path/to/animation.json')`
    */
-  source: string | AnimationObject | { uri: string };
+  source: string | AnimationObject | { uri: string } | number;
 
   /**
    * A number between 0 and 1, or an `Animated` number between 0 and 1. This number
```

---

### Incident Patch 2: `6c265d7d` (2026-08-14)
**Commit Message**: fix(android): skip explicit kotlin-android plugin when AGP 9 built-in Kotlin is enabled (#1463)

* fix(android): skip explicit kotlin-android plugin when AGP 9 built-in Kotlin is enabled

Android Gradle Plugin 9.0 compiles Kotlin sources itself and turns that
built-in support on by default. Applying the standalone Kotlin Android
plugin on top of it fails at configuration time, so every consumer app
that upgrades to AGP 9 cannot build this library unless it opts out of
built-in Kotlin globally.

Apply 'kotlin-android' only when AGP's built-in Kotlin is not in effect,
that is on AGP below 9 or when the consumer sets
'android.builtInKotlin=false'. Behaviour is unchanged on every AGP the
library supported before.

* fix(android): apply the built-in Kotlin guard to the nitro package too

Address review: drop the explanatory comment in `packages/core` and mirror the
same conditional in `packages/nitro`, which applies
`org.jetbrains.kotlin.android` and hits the identical AGP 9 failure.

---------

Co-authored-by: kimchi-developer <[REDACTED_EMAIL]>

**File**: `packages/core/android/build.gradle` (modified, +13/-1)
```diff
@@ -25,8 +25,20 @@ def isNewArchitectureEnabled() {
     return project.hasProperty("newArchEnabled") && project.newArchEnabled == "true"
 }
 
+def isBuiltInKotlinEnabled() {
+    def agpMajorVersion = com.android.Version.ANDROID_GRADLE_PLUGIN_VERSION.tokenize('.')[0].toInteger()
+    if (agpMajorVersion < 9) {
+        return false
+    }
+    def builtInKotlinProperty = project.findProperty('android.builtInKotlin')
+    return builtInKotlinProperty == null || builtInKotlinProperty.toString().toBoolean()
+}
+
 apply plugin: 'com.android.library'
-apply plugin: 'kotlin-android'
+
+if (!isBuiltInKotlinEnabled()) {
+    apply plugin: 'kotlin-android'
+}
 
 if (isNewArchitectureEnabled()) {
     apply plugin: 'com.facebook.react'
```

**File**: `packages/nitro/android/build.gradle` (modified, +13/-1)
```diff
@@ -32,8 +32,20 @@ def getExtOrIntegerDefault(name) {
         : (project.properties["LottieNitro_" + name]).toInteger()
 }
 
+def isBuiltInKotlinEnabled() {
+    def agpMajorVersion = com.android.Version.ANDROID_GRADLE_PLUGIN_VERSION.tokenize(".")[0].toInteger()
+    if (agpMajorVersion < 9) {
+        return false
+    }
+    def builtInKotlinProperty = project.findProperty("android.builtInKotlin")
+    return builtInKotlinProperty == null || builtInKotlinProperty.toString().toBoolean()
+}
+
 apply plugin: "com.android.library"
-apply plugin: "org.jetbrains.kotlin.android"
+
+if (!isBuiltInKotlinEnabled()) {
+    apply plugin: "org.jetbrains.kotlin.android"
+}
 
 // Adds nitrogen/generated/android/kotlin to java.srcDirs. Without this the
 // generated HybridLottieViewSpec, HybridLottieViewManager and LottieNitroOnLoad
```

---

### Incident Patch 3: `03b74c47` (2026-08-13)
**Commit Message**: docs: fix dead links to the Metro and React Native docs (#1462)

Both links point at the retired facebook.github.io domain and return 404:

- The Metro configuration link in the metro.config.js snippet now points at
  metrobundler.dev, matching the URL React Native ships in its own template.
- The View layout props link now points at reactnative.dev.

Both replacements were verified to return 200.

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-2)
```diff
@@ -232,7 +232,7 @@ const defaultConfig = getDefaultConfig(__dirname);
 
 /**
  * Metro configuration
- * https://facebook.github.io/metro/docs/configuration
+ * https://metrobundler.dev/docs/configuration
  *
  * @type {import('metro-config').MetroConfig}
  */
@@ -273,7 +273,7 @@ You can find the full list of props and methods available in our [API document](
 | Prop               | Description                                                                                                                                                                                                                                                                     | Default                                                                                                                         |
 | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
 | **`source`**       | **Mandatory** - The source of animation. Can be referenced as a local asset by a string, or remotely with an object with a `uri` property, or it can be an actual JS object of an animation, obtained (for example) with something like `require('../path/to/animation.json')`. | _None_                                                                                                                          |
-| **`style`**        | Style attributes for the view, as expected in a standard [`View`](https://facebook.github.io/react-native/docs/layout-props.html).                                                                                                                                              | You need to set it manually. Refer to this [pull request](https://github.com/lottie-react-native/lottie-react-native/pull/992). |
+| **`style`**        | Style attributes for the view, as expected in a standard [`View`](https://reactnative.dev/docs/layout-props).                                                                                                                                              | You need to set it manually. Refer to this [pull request](https://github.com/lottie-react-native/lottie-react-native/pull/992). |
 | **`loop`**         | A boolean flag indicating whether or not the animation should loop.                                                                                                                                                                                                             | `true`                                                                                                                          |
 | **`autoPlay`**     | A boolean flag indicating whether or not the animation should start automatically when mounted. This only affects the imperative API.                                                                                                                                           | `false`                                                                                                                         |
 | **`colorFilters`** | An array of objects denoting layers by KeyPath and a new color filter value (as hex string).                                                                                                                                                                                    | `[]`                                                                                                                            |
```

---

### Incident Patch 4: `d24463b1` (2026-08-05)
**Commit Message**: ci: remove the Paper build jobs and scripts (#1454)

* ci: remove the Paper build jobs and scripts

The Paper jobs no longer test anything the Fabric jobs do not. As of React
Native 0.82 the New Architecture can no longer be disabled, and
`react-native-test-app` reflects that directly -- `isNewArchitectureEnabled`
returns `true` unconditionally for 0.82 and above, and warns if a project
still passes `newArchEnabled=false`:

    if (version >= v(0, 82, 0)) {
        if (newArchEnabled == "false") {
            logger.warn("WARNING: As of 0.82, New Architecture can no longer be disabled")
        }
        return true
    }

So `ORG_GRADLE_PROJECT_newArchEnabled=true` and `RCT_NEW_ARCH_ENABLED=1` are
now no-ops, and the Paper and Fabric jobs built byte-identical products.
Running the Fabric Android build straight after the default one confirmed
it: `assembleDebug` came back UP-TO-DATE with 88 of 98 tasks already
current.

Removes:

- `.github/workflows/android-paper-build.yml`
- `.github/workflows/ios-paper-build.yml`
- `paper:build:android` and `paper:build:ios` from the root manifest
- `ci:paper:android` and `ci:paper:ios` from the example app

This halves the iOS CI time, which wa

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ body:
     id: architecture
     attributes:
       label: Architecture
-      description: What React Native architecture your application is running on? Currently, the default architecture on React Native is Paper so if you haven't changed it in your application select this option.
+      description: What React Native architecture your application is running on? The New Architecture is the default from React Native 0.76, and the only option from 0.82 onwards, so select Fabric unless you are reporting against an older React Native version.
       options:
         - Paper (Old Architecture)
         - Fabric (New Architecture)
```

**File**: `.github/workflows/android-paper-build.yml` (removed, +0/-57)
```diff
@@ -1,57 +0,0 @@
-name: Build Android Paper Example
-
-on:
-  pull_request:
-    branches:
-      - master
-
-# Only run on the latest workflow run
-concurrency:
-  group: ${{ github.workflow }}-${{ github.ref }}
-  cancel-in-progress: true
-
-jobs:
-  build-android:
-    runs-on: ubuntu-latest
-
-    steps:
-      - name: Checkout Repository
-        uses: actions/checkout@v3
-
-      - name: Set up Node.js
-        uses: actions/setup-node@v3
-        with:
-          node-version: 22
-
-      - name: Enable corepack
-        run: corepack enable
-
-      - name: Install Dependencies
-        run: yarn install --immutable
-
-      - name: Install JDK
-        uses: actions/setup-java@v3
-        with:
-          distribution: "zulu"
-          java-version: "17"
-
-      - name: Finalize Android SDK
-        run: |
-          /bin/bash -c "yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses > /dev/null"
-
-      - name: Cache Gradle
-        uses: actions/cache@v3
-        with:
-          path: |
-            ~/.gradle/wrapper
-            ~/.gradle/caches
-          key: ${{ runner.os }}-gradle-${{ hashFiles('**/gradle-wrapper.properties') }}
-          restore-keys: |
-            ${{ runner.os }}-gradle-
-
-      - name: Start Packager
-        run: yarn run:bundler &
-
-      - name: Build and Lint Paper Android Example
-        run: |
-          yarn paper:build:android
```

**File**: `.github/workflows/ios-paper-build.yml` (removed, +0/-39)
```diff
@@ -1,39 +0,0 @@
-name: Build iOS Paper Example
-
-on:
-  pull_request:
-    branches:
-      - master
-
-# Only run on the latest workflow run
-concurrency:
-  group: ${{ github.workflow }}-${{ github.ref }}
-  cancel-in-progress: true
-
-jobs:
-  build-example:
-    runs-on: macos-latest
-
-    steps:
-      - name: Checkout Repository
-        uses: actions/checkout@v3
-
-      - name: Set up Node.js
-        uses: actions/setup-node@v3
-        with:
-          node-version: 22
-
-      - name: Enable corepack
-        run: corepack enable
-
-      - name: Install CocoaPods
-        run: sudo gem install cocoapods -v 1.14.3
-
-      - name: Install Dependencies
-        run: yarn install --immutable
-
-      - name: Start Packager
-        run: yarn run:bundler &
-
-      - name: Build Paper iOS Example
-        run: yarn paper:build:ios
```

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ yarn setup
 Finally, you can run the demo. Then you can go to the link printed in the terminal to see the demo.
 
 ```
-yarn paper:web
+yarn run:web
 ```
 
 ### Style & Linting
```

**File**: `example/package.json` (modified, +0/-2)
```diff
@@ -18,9 +18,7 @@
     "test": "jest",
     "web": "webpack serve",
     "visionos": "npx react-native run-visionos",
-    "ci:paper:android": "npx react-native build-android",
     "ci:fabric:android": "ORG_GRADLE_PROJECT_newArchEnabled=true npx react-native build-android",
-    "ci:paper:ios": "pod install --project-directory=ios && npx react-native run-ios --no-packager",
     "ci:fabric:ios": "RCT_NEW_ARCH_ENABLED=1 pod install --project-directory=ios && npx react-native run-ios --no-packager",
     "ci:fabric:ios-static-framework": "USE_FRAMEWORKS=static RCT_NEW_ARCH_ENABLED=1 pod install --project-directory=ios && npx react-native run-ios --no-packager",
     "ci:fabric:ios-dynamic-framework": "USE_FRAMEWORKS=dynamic RCT_NEW_ARCH_ENABLED=1 pod install --project-directory=ios && npx react-native run-ios --no-packager"
```

**File**: `package.json` (modified, +0/-2)
```diff
@@ -13,8 +13,6 @@
     "fabric:build:ios": "yarn workspace example ci:fabric:ios",
     "fabric:build:ios-static-framework": "yarn workspace example ci:fabric:ios-static-framework",
     "fabric:build:ios-dynamic-framework": "yarn workspace example ci:fabric:ios-dynamic-framework",
-    "paper:build:android": "yarn workspace example ci:paper:android",
-    "paper:build:ios": "yarn workspace example ci:paper:ios",
     "run:bundler": "yarn workspace example start",
     "run:web": "yarn workspace example web",
     "lint:swift": "yarn workspace lottie-react-native lint:swift",
```

---

### Incident Patch 5: `815fd4ee` (2026-08-05)
**Commit Message**: feat: require React Native 0.84, upgrade react-native-test-app to 5.4.7 and fix iOS ci (#1453)

* feat!: require React Native 0.84, upgrade react-native-test-app to 5.4.7

Raises the minimum supported React Native version to 0.84, the oldest
release still receiving upstream support (0.86/0.85 are Active, 0.84 is
End of Cycle, 0.83 and earlier are Unsupported), and upgrades
`react-native-test-app` from 4.1.4 to 5.4.7.

These two bumps have to land together. RNTA 5.4.7 pins
`androidx.camera:*` to 1.6.1, which requires compileSdk 36 and AGP
8.9.1+; RNTA derives both from React Native's version catalog, and 0.78
supplies compileSdk 35 / AGP 8.8.0, so the Android build fails in
`checkDebugAarMetadata`. Conversely RNTA 4.1.4 caps `react-native` at
0.78, so neither version can move on its own. RN 0.84 ships compileSdk
36 and AGP 8.12.0, which clears the CameraX floor.

The stale 3.8.7 devDependency is also dropped from the monorepo root;
nothing outside `example/` referenced it, and keeping a second major
around meant yarn installed two copies.

Notable knock-on changes:

- `example/tsconfig.json` extended
  `@react-native/typescript-config/tsconfig.json`, but 0.84 added an
  `exports` ma

**File**: `.github/workflows/android-fabric-build.yml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ jobs:
       - name: Set up Node.js
         uses: actions/setup-node@v3
         with:
-          node-version: 18
+          node-version: 22
 
       - name: Enable corepack
         run: corepack enable
```

**File**: `.github/workflows/android-paper-build.yml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ jobs:
       - name: Set up Node.js
         uses: actions/setup-node@v3
         with:
-          node-version: 18
+          node-version: 22
 
       - name: Enable corepack
         run: corepack enable
```

**File**: `.github/workflows/ios-fabric-build.yml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ jobs:
       - name: Set up Node.js
         uses: actions/setup-node@v3
         with:
-          node-version: 18
+          node-version: 22
 
       - name: Enable corepack
         run: corepack enable
```

**File**: `.github/workflows/ios-paper-build.yml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ jobs:
       - name: Set up Node.js
         uses: actions/setup-node@v3
         with:
-          node-version: 18
+          node-version: 22
 
       - name: Enable corepack
         run: corepack enable
```

**File**: `.github/workflows/lint-test.yml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ jobs:
       - name: Set up Node.js
         uses: actions/setup-node@v3
         with:
-          node-version: 18
+          node-version: 22
 
       - name: Enable corepack
         run: corepack enable
```

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -19,3 +19,4 @@ dist/
 !.yarn/versions
 
 .npmrc
+.idea
\ No newline at end of file
```

**File**: `example/.gitignore` (modified, +1/-0)
```diff
@@ -15,3 +15,4 @@ local.properties
 msbuild.binlog
 node_modules/
 ios/Podfile.lock
+vendor/bundle/
```

**File**: `example/Gemfile` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+source 'https://rubygems.org'
+
+# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
+ruby ">= 2.6.10"
+
+# Exclude problematic versions of cocoapods and activesupport that causes build failures.
+gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
+gem 'activesupport', '>= 6.1.7.5', '!= 7.1.0'
+gem 'xcodeproj', '< 1.26.0'
+gem 'concurrent-ruby', '< 1.3.4'
+
+# Ruby 3.4.0 has removed some libraries from the standard library.
+gem 'bigdecimal'
+gem 'logger'
+gem 'benchmark'
+gem 'mutex_m'
+
+# `kconv` also left the standard library in 3.4, and is provided by `nkf`.
+# CFPropertyList requires it, so CocoaPods fails to even parse the Podfile with
+# "cannot load such file -- kconv". xcodeproj declares this itself from 1.26
+# onwards, but the pin above holds us below that.
+gem 'nkf'
```

---

### Incident Patch 6: `5cb225d8` (2026-08-03)
**Commit Message**: fix(ci): use macos-latest, drop Xcode version matrix and xcode-select (#1448)

* fix: pin iOS CI workflows to macos-15 to fix Xcode 16.4 availability

Co-authored-by: matinzd <[REDACTED_EMAIL]>

* fix: use macos-latest, remove xcode matrix and xcode-select steps

Co-authored-by: matinzd <[REDACTED_EMAIL]>

---------

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: matinzd <[REDACTED_EMAIL]>

**File**: `.github/workflows/ios-fabric-build.yml` (modified, +0/-10)
```diff
@@ -14,17 +14,7 @@ jobs:
   build-example:
     runs-on: macos-latest
 
-    strategy:
-      matrix:
-        xcode-version: [16.4]
-
     steps:
-      - name: List all available XCode versions
-        run: ls -n /Applications/ | grep Xcode*
-
-      - name: Switch XCode Version
-        run: sudo xcode-select -s /Applications/Xcode_${{ matrix.xcode-version }}.app/Contents/Developer
-
       - name: Cache cocoapods
         uses: actions/cache@v3
         with:
```

**File**: `.github/workflows/ios-paper-build.yml` (modified, +0/-10)
```diff
@@ -14,17 +14,7 @@ jobs:
   build-example:
     runs-on: macos-latest
 
-    strategy:
-      matrix:
-        xcode-version: [16.4]
-
     steps:
-      - name: List all available XCode versions
-        run: ls -n /Applications/ | grep Xcode*
-
-      - name: Switch XCode Version
-        run: sudo xcode-select -s /Applications/Xcode_${{ matrix.xcode-version }}.app/Contents/Developer
-
       - name: Checkout Repository
         uses: actions/checkout@v3
 
```

---

### Incident Patch 7: `91f174cf` (2026-08-01)
**Commit Message**: docs: fix stale org clone URL and package name references (#1430)

Co-authored-by: Patrick Wehbe <[REDACTED_EMAIL]>
Co-authored-by: Matin Zadeh Dolatabad <[REDACTED_EMAIL]>

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ After forking to your own github org, do the following steps to get started:
 
 ```bash
 # clone your fork to your local machine
-git clone https://github.com/airbnb/lottie-react-native.git
+git clone https://github.com/lottie-react-native/lottie-react-native.git
 
 # step into local repo
 cd lottie-react-native
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -268,7 +268,7 @@ module.exports = {
 
 ## API
 
-You can find the full list of props and methods available in our [API document](https://github.com/airbnb/lottie-react-native/blob/master/docs/api.md). These are the most common ones:
+You can find the full list of props and methods available in our [API document](https://github.com/lottie-react-native/lottie-react-native/blob/master/docs/api.md). These are the most common ones:
 
 | Prop               | Description                                                                                                                                                                                                                                                                     | Default                                                                                                                         |
 | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
@@ -278,7 +278,7 @@ You can find the full list of props and methods available in our [API document](
 | **`autoPlay`**     | A boolean flag indicating whether or not the animation should start automatically when mounted. This only affects the imperative API.                                                                                                                                           | `false`                                                                                                                         |
 | **`colorFilters`** | An array of objects denoting layers by KeyPath and a new color filter value (as hex string).                                                                                                                                                                                    | `[]`                                                                                                                            |
 
-[More...](https://github.com/airbnb/lottie-react-native/blob/master/docs/api.md)
+[More...](https://github.com/lottie-react-native/lottie-react-native/blob/master/docs/api.md)
 
 ## Troubleshooting
 
```

**File**: `docs/api.md` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ When creating animations using AfterEffects and bodymovin, the exported json may
   ...
 ```
 
-To make `react-native-lottie` use those assets properly, it is necessary to go for the native route: so remember that you need to **fully** rebuild your application if you modify the images / add new ones.
+To make `lottie-react-native` use those assets properly, it is necessary to go for the native route: so remember that you need to **fully** rebuild your application if you modify the images / add new ones.
 
 ### Android
 
```

---

### Incident Patch 8: `6deeab0d` (2026-05-14)
**Commit Message**: fix: CAlayer ambiguous expression on macOS (#1414)

* fix: CAlayer ambiguous expression on macOS

* Add platform check

---------

Co-authored-by: Matin Zadeh Dolatabad <[REDACTED_EMAIL]>

**File**: `packages/core/ios/LottieReactNative/ContainerView.swift` (modified, +6/-2)
```diff
@@ -286,8 +286,12 @@ class ContainerView: RCTView {
         if let current = animationView {
             // Remove from view hierarchy
             current.removeFromSuperview()
-            // Clear layer contents to prevent any rendering artifacts
-            current.layer.contents = nil
+            // Clear layer contents to prevent any rendering artifacts 
+            #if !os(macOS) 
+                current.layer.contents = nil
+            #else
+                current.layer?.contents = nil
+            #endif
             // Clear the reference
             animationView = nil
         }
```

---

### Incident Patch 9: `d556c002` (2026-05-14)
**Commit Message**: fix: audit deps

**File**: `package.json` (modified, +3/-1)
```diff
@@ -34,7 +34,9 @@
   },
   "resolutions": {
     "@types/react": "^18.2.12",
-    "@types/react-native": "^0.70.14"
+    "@types/react-native": "^0.70.14",
+    "lodash": "4.17.12",
+    "fast-xml-parser": "4.5.4"
   },
   "workspaces": [
     "./packages/*",
```

**File**: `packages/core/windows/LottieReactNativeWindows/LottieReactNativeWindows.csproj` (modified, +1/-1)
```diff
@@ -139,7 +139,7 @@
       <Version>2.6.0</Version>
     </PackageReference>
     <PackageReference Include="System.Drawing.Common">
-      <Version>4.7.0</Version>
+      <Version>4.7.2</Version>
     </PackageReference>
   </ItemGroup>
   <ItemGroup>
```

**File**: `yarn.lock` (modified, +93/-1298)
```diff
@@ -114,28 +114,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/code-frame@npm:^7.0.0, @babel/code-frame@npm:^7.12.13, @babel/code-frame@npm:^7.24.7":
-  version: 7.24.7
-  resolution: "@babel/code-frame@npm:7.24.7"
-  dependencies:
-    "@babel/highlight": ^7.24.7
-    picocolors: ^1.0.0
-  checksum: 830e62cd38775fdf84d612544251ce773d544a8e63df667728cc9e0126eeef14c6ebda79be0f0bc307e8318316b7f58c27ce86702e0a1f5c321d842eb38ffda4
-  languageName: node
-  linkType: hard
-
-"@babel/code-frame@npm:^7.26.2, @babel/code-frame@npm:^7.27.1":
-  version: 7.27.1
-  resolution: "@babel/code-frame@npm:7.27.1"
-  dependencies:
-    "@babel/helper-validator-identifier": ^7.27.1
-    js-tokens: ^4.0.0
-    picocolors: ^1.1.1
-  checksum: 5874edc5d37406c4a0bb14cf79c8e51ad412fb0423d176775ac14fc0259831be1bf95bdda9c2aa651126990505e09a9f0ed85deaa99893bc316d2682c5115bdc
-  languageName: node
-  linkType: hard
-
-"@babel/code-frame@npm:^7.28.6, @babel/code-frame@npm:^7.29.0":
+"@babel/code-frame@npm:^7.0.0, @babel/code-frame@npm:^7.12.13, @babel/code-frame@npm:^7.24.7, @babel/code-frame@npm:^7.26.2, @babel/code-frame@npm:^7.27.1, @babel/code-frame@npm:^7.28.6, @babel/code-frame@npm:^7.29.0":
   version: 7.29.0
   resolution: "@babel/code-frame@npm:7.29.0"
   dependencies:
@@ -146,44 +125,14 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/compat-data@npm:^7.20.5, @babel/compat-data@npm:^7.22.6, @babel/compat-data@npm:^7.24.7":
-  version: 7.24.7
-  resolution: "@babel/compat-data@npm:7.24.7"
-  checksum: 1fc276825dd434fe044877367dfac84171328e75a8483a6976aa28bf833b32367e90ee6df25bdd97c287d1aa8019757adcccac9153de70b1932c0d243a978ae9
-  languageName: node
-  linkType: hard
-
-"@babel/compat-data@npm:^7.27.2, @babel/compat-data@npm:^7.27.7":
+"@babel/compat-data@npm:^7.20.5, @babel/compat-data@npm:^7.24.7, @babel/compat-data@npm:^7.27.2, @babel/compat-data@npm:^7.27.7":
   version: 7.28.0
   resolution: "@babel/compat-data@npm:7.28.0"
   checksum: 37a40d4ea10a32783bc24c4ad374200f5db864c8dfa42f82e76f02b8e84e4c65e6a017fc014d165b08833f89333dff4cb635fce30f03c333ea3525ea7e20f0a2
   languageName: node
   linkType: hard
 
-"@babel/core@npm:^7.11.6, @babel/core@npm:^7.12.3, @babel/core@npm:^7.13.16, @babel/core@npm:^7.14.0, @babel/core@npm:^7.18.5, @babel/core@npm:^7.20.0, @babel/core@npm:^7.23.9":
-  version: 7.24.7
-  resolution: "@babel/core@npm:7.24.7"
-  dependencies:
-    "@ampproject/remapping": ^2.2.0
-    "@babel/code-frame": ^7.24.7
-    "@babel/generator": ^7.24.7
-    "@babel/helper-compilation-targets": ^7.24.7
-    "@babel/helper-module-transforms": ^7.24.7
-    "@babel/helpers": ^7.24.7
-    "@babel/parser": ^7.24.7
-    "@babel/template": ^7.24.7
-    "@babel/traverse": ^7.24.7
-    "@babel/types": ^7.24.7
-    convert-source-map: ^2.0.0
-    debug: ^4.1.0
-    gensync: ^1.0.0-beta.2
-    json5: ^2.2.3
-    semver: ^6.3.1
-  checksum: 017497e2a1b4683a885219eef7d2aee83c1c0cf353506b2e180b73540ec28841d8ef1ea1837fa69f8c561574b24ddd72f04764b27b87afedfe0a07299ccef24d
-  languageName: node
-  linkType: hard
-
-"@babel/core@npm:^7.24.7, @babel/core@npm:^7.25.2":
+"@babel/core@npm:^7.11.6, @babel/core@npm:^7.12.3, @babel/core@npm:^7.13.16, @babel/core@npm:^7.14.0, @babel/core@npm:^7.18.5, @babel/core@npm:^7.20.0, @babel/core@npm:^7.23.9, @babel/core@npm:^7.24.7, @babel/core@npm:^7.25.2":
   version: 7.28.0
   resolution: "@babel/core@npm:7.28.0"
   dependencies:
@@ -220,32 +169,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/generator@npm:^7.14.0, @babel/generator@npm:^7.20.0, @babel/generator@npm:^7.24.7, @babel/generator@npm:^7.7.2":
-  version: 7.24.7
-  resolution: "@babel/generator@npm:7.24.7"
-  dependencies:
-    "@babel/types": ^7.24.7
-    "@jridgewell/gen-mapping": ^0.3.5
-    "@jridgewell/trace-mapping": ^0.3.25
-    jsesc: ^2.5.1
-  checksum: 0ff31a73b15429f1287e4d57b439bba4a266f8c673bb445fe313b82f6d110f586776997eb723a777cd7adad9d340edd162aea4973a90112c5d0cfcaf6686844b
-  languageName: node
-  linkType: hard
-
-"@babel/generator@npm:^7.25.0, @babel/generator@npm:^7.28.0":
-  version: 7.28.0
-  resolution: "@babel/generator@npm:7.28.0"
-  dependencies:
-    "@babel/parser": ^7.28.0
-    "@babel/types": ^7.28.0
-    "@jridgewell/gen-mapping": ^0.3.12
-    "@jridgewell/trace-mapping": ^0.3.28
-    jsesc: ^3.0.2
-  checksum: 3fc9ecca7e7a617cf7b7357e11975ddfaba4261f374ab915f5d9f3b1ddc8fd58da9f39492396416eb08cf61972d1aa13c92d4cca206533c553d8651c2740f07f
-  languageName: node
-  linkType: hard
-
-"@babel/generator@npm:^7.29.0":
+"@babel/generator@npm:^7.14.0, @babel/generator@npm:^7.20.0, @babel/generator@npm:^7.25.0, @babel/generator@npm:^7.28.0, @babel/generator@npm:^7.29.0, @babel/generator@npm:^7.7.2":
   version: 7.29.1
   resolution: "@babel/generator@npm:7.29.1"
   dependencies:
@@ -258,16 +182,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/helper-annotate-as-pure@npm:^7.24.7":
-  version: 7.24.7
-  resolution: "@babel/helper-annotate-as-pure@npm
```

---

### Incident Patch 10: `8827c001` (2026-02-12)
**Commit Message**: fix: update native libs (#1398)

* chore: update android deps

* chore: update ios deps

* chore: update android deps to latest

**File**: `packages/core/android/build.gradle` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ dependencies {
     //noinspection GradleDynamicVersion
     implementation 'com.facebook.react:react-native:+' // From node_modules
 
-    implementation "com.airbnb.android:lottie:6.5.2"
+    implementation "com.airbnb.android:lottie:6.7.1"
 }
 
 if (isNewArchitectureEnabled()) {
```

**File**: `packages/core/lottie-react-native.podspec` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ Pod::Spec.new do |s|
     'Lottie_React_Native_Privacy' => ['ios/PrivacyInfo.xcprivacy'],
   }
 
-  s.dependency 'lottie-ios', '4.5.0'
+  s.dependency 'lottie-ios', '4.6.0'
 
   s.swift_version = '5.9'
 
```

---

### Incident Patch 11: `b7a0e3c0` (2026-01-09)
**Commit Message**: fix: improve animation loading by clearing previous view (#1385)

**File**: `packages/core/ios/LottieReactNative/ContainerView.swift` (modified, +19/-1)
```diff
@@ -168,6 +168,9 @@ class ContainerView: RCTView {
             return
         }
 
+        // Immediately clear the previous animation view so the region is blank while loading
+        removeCurrentAnimationView()
+
         _ = LottieAnimationView(
             dotLottieUrl: url,
             configuration: lottieConfiguration,
@@ -196,6 +199,9 @@ class ContainerView: RCTView {
 
         guard let url = url else { return }
 
+        // Immediately clear the previous animation view so the region is blank while loading
+        removeCurrentAnimationView()
+
         self.fetchRemoteAnimation(from: url)
     }
 
@@ -276,8 +282,20 @@ class ContainerView: RCTView {
     }
 
     // MARK: Private
+    private func removeCurrentAnimationView() {
+        if let current = animationView {
+            // Remove from view hierarchy
+            current.removeFromSuperview()
+            // Clear layer contents to prevent any rendering artifacts
+            current.layer.contents = nil
+            // Clear the reference
+            animationView = nil
+        }
+    }
+
     func replaceAnimationView(next: LottieAnimationView) {
-        super.removeReactSubview(animationView)
+        // Ensure any existing view is properly detached from UIKit hierarchy
+        removeCurrentAnimationView()
 
         animationView = next
 
```

---

### Incident Patch 12: `c6729b23` (2025-09-02)
**Commit Message**: fix: RN [0.82] import for `TextAttributeProps.UNSET`

Lottie won't compile with 0.82, that's due to us converting `TextAttributeProps` to Kotlin. 

So the import should either be converted to `import ... TextAttributeProps.Companion.UNSET`

or better to `ReactConstants.UNSET`

**File**: `packages/core/android/src/main/java/com/airbnb/android/react/lottie/LottieAnimationViewPropertyManager.kt` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ import com.facebook.react.bridge.ReadableArray
 import com.facebook.react.bridge.ReadableMap
 import com.facebook.react.bridge.ReadableType
 import com.facebook.react.views.text.ReactFontManager
-import com.facebook.react.views.text.TextAttributeProps.UNSET
+import com.facebook.react.common.ReactConstants.UNSET
 import com.facebook.react.util.RNLog
 import java.lang.ref.WeakReference
 import java.util.regex.Pattern
```

---

### Incident Patch 13: `3e7d8d5c` (2025-08-28)
**Commit Message**: fix: update @lottiefiles/dotlottie-reac to support react 19 (required for RN 0.78 + Expo SDK 53) (#1367)

* chore: update @lottiefiles/dotlottie-react dependency to version 0.13.5

* chore: update yarn.lock

* chore: update xcode versions

---------

Co-authored-by: matinzd <[REDACTED_EMAIL]>

**File**: `.github/workflows/ios-fabric-build.yml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ jobs:
 
     strategy:
       matrix:
-        xcode-version: [15.4.0, 16.2.0]
+        xcode-version: [16.4]
 
     steps:
       - name: List all available XCode versions
```

**File**: `.github/workflows/ios-paper-build.yml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ jobs:
 
     strategy:
       matrix:
-        xcode-version: [15.4.0, 16.2.0]
+        xcode-version: [16.4]
 
     steps:
       - name: List all available XCode versions
```

**File**: `packages/core/package.json` (modified, +2/-2)
```diff
@@ -44,7 +44,7 @@
     "release": "npm publish"
   },
   "peerDependencies": {
-    "@lottiefiles/dotlottie-react": "^0.6.5",
+    "@lottiefiles/dotlottie-react": "^0.13.5",
     "react": "*",
     "react-native": ">=0.46",
     "react-native-windows": ">=0.63.x"
@@ -58,7 +58,7 @@
     }
   },
   "devDependencies": {
-    "@lottiefiles/dotlottie-react": "^0.6.5",
+    "@lottiefiles/dotlottie-react": "^0.13.5",
     "@react-native-community/eslint-config": "^3.1.0",
     "@types/react": "^18.2.12",
     "@types/react-native": "^0.70.14",
```

**File**: `yarn.lock` (modified, +15/-24)
```diff
@@ -3185,16 +3185,14 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@lottiefiles/dotlottie-react@npm:^0.6.5":
-  version: 0.6.5
-  resolution: "@lottiefiles/dotlottie-react@npm:0.6.5"
+"@lottiefiles/dotlottie-react@npm:^0.13.5":
+  version: 0.13.5
+  resolution: "@lottiefiles/dotlottie-react@npm:0.13.5"
   dependencies:
-    "@lottiefiles/dotlottie-web": 0.25.0
-    debounce: ^2.0.0
+    "@lottiefiles/dotlottie-web": 0.44.0
   peerDependencies:
-    react: ^16.8.0 || ^17.0.0 || ^18.0.0
-    react-dom: ^16.8.0 || ^17.0.0 || ^18.0.0
-  checksum: 1d16955690f6725fb98abb317861ce6fc4c271dd610ed79a7f85bac6b9588eef194ae5b1ab745ea13f24ab3d2eac0ff76dd74f22d255dc69fae4729282082620
+    react: ^17 || ^18 || ^19
+  checksum: f1fc478ffc08f0070016edece041bbba57cdaaeab64d68bbee6abe44e17ca23abaec431757d402b6e42cc0b29b3a20bb412f91b2b9dc8d913c47a88c0092b8f0
   languageName: node
   linkType: hard
 
@@ -3210,20 +3208,20 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@lottiefiles/dotlottie-web@npm:0.25.0":
-  version: 0.25.0
-  resolution: "@lottiefiles/dotlottie-web@npm:0.25.0"
-  checksum: d0f9ae2d68c0d38418a76864840333dfcf0619c87b7648489fe3d744ecc4a15587c5fcf7d7b8689f4dc2879075f3c85b01df1d5f75fbc1acad155d34b8f2a7ec
-  languageName: node
-  linkType: hard
-
 "@lottiefiles/dotlottie-web@npm:0.33.0":
   version: 0.33.0
   resolution: "@lottiefiles/dotlottie-web@npm:0.33.0"
   checksum: 2b7e69b67aa247e5f35aa2ef56b456d02eef5d4959a1ce4a112ef5c01a984cf8ae7616d268aaa47c9c0490493ef0cb0976ed576f2a20244dd4f3c36c5700ece8
   languageName: node
   linkType: hard
 
+"@lottiefiles/dotlottie-web@npm:0.44.0":
+  version: 0.44.0
+  resolution: "@lottiefiles/dotlottie-web@npm:0.44.0"
+  checksum: 28172f4d45a7cd41844df6fdb2a17610aa57a899cd0e2b52202b71c2ac4131e58ecdad80b1eaa98ce610e1b8eda820d762837aedec2a67895e1b930bff322222
+  languageName: node
+  linkType: hard
+
 "@microsoft/applicationinsights-web-snippet@npm:1.0.1":
   version: 1.0.1
   resolution: "@microsoft/applicationinsights-web-snippet@npm:1.0.1"
@@ -8475,13 +8473,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"debounce@npm:^2.0.0":
-  version: 2.1.1
-  resolution: "debounce@npm:2.1.1"
-  checksum: 3cf6211ff894894234899494fe9f141795cd22f48f2359a5eb555523b7fc4316954b1bd39cd215127d2b3828953e5a419347a93af66eca2fd5ca148ebd01388e
-  languageName: node
-  linkType: hard
-
 "debug@npm:2.6.9, debug@npm:^2.2.0, debug@npm:^2.6.9":
   version: 2.6.9
   resolution: "debug@npm:2.6.9"
@@ -13939,7 +13930,7 @@ __metadata:
   version: 0.0.0-use.local
   resolution: "lottie-react-native@workspace:packages/core"
   dependencies:
-    "@lottiefiles/dotlottie-react": ^0.6.5
+    "@lottiefiles/dotlottie-react": ^0.13.5
     "@react-native-community/eslint-config": ^3.1.0
     "@types/react": ^18.2.12
     "@types/react-native": ^0.70.14
@@ -13956,7 +13947,7 @@ __metadata:
     react-native-windows: 0.70.20
     typescript: ^5.1.3
   peerDependencies:
-    "@lottiefiles/dotlottie-react": ^0.6.5
+    "@lottiefiles/dotlottie-react": ^0.13.5
     react: "*"
     react-native: ">=0.46"
     react-native-windows: ">=0.63.x"
```

---

### Incident Patch 14: `0efef173` (2025-08-13)
**Commit Message**: fix: bring backward compatibility for containerStyle prop (#1372)

the latest changes are breaking changes because now you are wrapping lottie view with a view

this change make the changes non-breaking for people who didn't use containerProps, so for those people if they was using LottieView normally without containerProps it will keep working as before.

**File**: `packages/core/src/LottieView/index.tsx` (modified, +38/-26)
```diff
@@ -101,7 +101,7 @@ export class LottieView extends React.PureComponent<Props, {}> {
     }
   }
 
-  render(): React.ReactNode {
+  private renderLottieView() {
     const {
       style,
       source,
@@ -114,14 +114,6 @@ export class LottieView extends React.PureComponent<Props, {}> {
       ...rest
     } = this.props;
 
-    if (source == null) {
-      console.warn(
-        'LottieView needs `source` parameter, provided value for source:',
-        source,
-      );
-      return null;
-    }
-
     const sources = parsePossibleSources(source);
 
     const speed =
@@ -137,23 +129,43 @@ export class LottieView extends React.PureComponent<Props, {}> {
     }));
 
     return (
-      <View style={containerStyle} collapsable={false}>
-        <NativeLottieAnimationView
-          ref={this.captureRef}
-          {...rest}
-          colorFilters={colorFilters}
-          textFiltersAndroid={textFiltersAndroid}
-          textFiltersIOS={textFiltersIOS}
-          speed={speed}
-          style={style}
-          onAnimationFinish={this.onAnimationFinish}
-          onAnimationFailure={this.onAnimationFailure}
-          onAnimationLoaded={this.onAnimationLoaded}
-          autoPlay={autoPlay}
-          resizeMode={resizeMode}
-          {...sources}
-        />
-      </View>
+      <NativeLottieAnimationView
+        ref={this.captureRef}
+        {...rest}
+        colorFilters={colorFilters}
+        textFiltersAndroid={textFiltersAndroid}
+        textFiltersIOS={textFiltersIOS}
+        speed={speed}
+        style={style}
+        onAnimationFinish={this.onAnimationFinish}
+        onAnimationFailure={this.onAnimationFailure}
+        onAnimationLoaded={this.onAnimationLoaded}
+        autoPlay={autoPlay}
+        resizeMode={resizeMode}
+        {...sources}
+      />
     );
   }
+
+  render(): React.ReactNode {
+    const { source, containerStyle } = this.props;
+
+    if (source == null) {
+      console.warn(
+        'LottieView needs `source` parameter, provided value for source:',
+        source,
+      );
+      return null;
+    }
+
+    if (containerStyle) {
+      return (
+        <View style={containerStyle} collapsable={false}>
+          {this.renderLottieView()}
+        </View>
+      );
+    }
+
+    return this.renderLottieView();
+  }
 }
```

---

### Incident Patch 15: `35ff35e2` (2025-08-07)
**Commit Message**: README: Remove "will be fixed soon" (#1369)

It has been fixed https://github.com/lottie-react-native/lottie-react-native/pull/1009#discussion_r2254435786

**File**: `README.md` (modified, +0/-2)
```diff
@@ -195,8 +195,6 @@ export default function ControllingAnimationProgress() {
 
 Changing color of layers:
 
-NOTE: This feature may not work properly on Android. We will try fix it soon.
-
 ```jsx
 import React from "react";
 import LottieView from "lottie-react-native";
```

#### Recent Merged Pull Requests:
- **PR #1466** (2026-08-22): fix: support static animation sources (@huytdps13400)
- **PR #1465** (2026-08-22): switch to lottie spm for our SPM support (@TheRogue76)
- **PR #1464** (2026-08-17): feat(core): add Swift Package Manager support for React Native 0.87 (@TheRogue76)
- **PR #1463** (2026-08-14): fix(android): skip explicit kotlin-android plugin when AGP 9 built-in Kotlin is enabled (@kimchi-developer)
- **PR #1462** (2026-08-13): docs: fix dead links to the Metro and React Native docs (@luccasfraga)
- **PR #1461** (2026-08-13): chore(deps): bump concurrent-ruby from 1.3.3 to 1.3.7 in /example-v8 (@dependabot[bot])
- **PR #1460** (2026-08-13): chore(deps): bump concurrent-ruby from 1.3.3 to 1.3.7 in /example (@dependabot[bot])
- **PR #1459** (2026-08-17): feat: implement the imperative commands, add CI, and close out the v8 port (@TheRogue76)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
