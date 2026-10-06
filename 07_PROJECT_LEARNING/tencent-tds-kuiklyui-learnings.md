# Forensic Learning Record (Deep Inspection): Tencent-TDS/KuiklyUI

> **Canonical Artifact**: `07_PROJECT_LEARNING/tencent-tds-kuiklyui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Tencent-TDS/KuiklyUI](https://github.com/Tencent-TDS/KuiklyUI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:11:27.633Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Tencent-TDS/KuiklyUI`
- **Description**: A Kotlin Multiplatform UI framework from Tencent TDS — high-performance, one codebase for six platforms, with dynamic delivery.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3554 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `androidApp/src/main/java/com/tencent/kuikly/android/demo/KuiklyRenderActivity.kt`
```
/*
 * Tencent is pleased to support the open source community by making KuiklyUI
 * available.
 * Copyright (C) 2025 Tencent. All rights reserved.
 * Licensed under the License of KuiklyUI;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.tencent.kuikly.android.demo

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowInsetsController
import android.view.WindowManager
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.tencent.kuikly.android.demo.adapter.KRAPNGViewAdapter
import com.tencent.kuikly.android.demo.adapter.KRColorParserAdapter
import com.tencent.kuikly.android.demo.adapter.KRFontAdapter
import com.tencent.kuikly.android.demo.adapter.KRImageAdapter
import com.tencent.kuikly.android.demo.adapter.KRLogAdapter
import com.tencent.kuikly.android.demo.adapter.KRRouterAdapter
import com.tencent.kuikly.android.demo.adapter.KRTextPostProcessorAdapter
import com.tencent.kuikly.android.demo.adapter.KRThreadAdapter
import com.tencent.kuikly.android.demo.adapter.KRUncaughtExceptionHandlerAdapter
import com.tencent.kuikly.android.demo.adapter.PAGViewAdapter
import com.tencent.kuikly.android.demo.adapter.VideoViewAdapter
import com.tencent.kuikly.core.render.android.KuiklyRenderView
import com.tencent.kuikly.core.render.android.adapter.KuiklyRenderAdapterManager
import com.tencent.kuikly.core.render.android.css.ktx.toMap
import com.tencent.kuikly.core.render.android.expand.KuiklyRenderViewBaseDelegator
import org.json.JSONObject

/**
 * Created by kam on 2022/7/27.
 */
class KuiklyRenderActivity : AppCompatActivity() {

    private lateinit var hrContainerView: ViewGroup
    private lateinit var loadingView: View
    private lateinit var errorView: View

    private lateinit var kuiklyRenderViewDelegator: KuiklyRenderViewBaseDelegator

    private val pageName: String
        get() {
            val pn = intent.getStringExtra(KEY_PAGE_NAME) ?: ""
            return pn.ifEmpty { "router" }
        }
    private lateinit var contextCodeHandler: ContextCodeHandler

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (intent.getBooleanExtra(KEY_FORCE_LANDSCAPE, false)) {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_USER_LANDSCAPE
        }
        // 优化重绘范围的实验性开关，谨慎开启
        KuiklyRenderView.enableLazyClipChildren()
        // 1. 创建一个Kuikly页面打开的封装处理器
        contextCodeHandler = ContextCodeHandler(this, pageName)
        // 2. 实例化Kuikly委托者类
        kuiklyRenderViewDelegator = contextCodeHandler.initContextHandler()
        setContentView(R.layout.activity_hr)
        setupAdapterManager()
        setupImmersiveMode()
        // 3. 获取用于承载Kuikly的容器View
        hrContainerView = findViewById(R.id.hr_container)
        loadingView = findViewById(R.id.hr_loading)
        errorView = findViewById(R.id.hr_error)
        // 横竖屏 Demo 转屏间隙需要宿主容器黑底兜底；其他页面保持默认，避免全局变黑。
        if (pageName == "ComposeVideoOrientationDemo" || pageName == "ComposeOrientationOverlayDemo") {
            findViewById<View>(android.R.id.content).setBackgroundColor(Color.BLACK)
            hrContainerView.setBackgroundColor(Color.BLACK)
        }
        // 4. 触发Kuikly View实例化
        // hrContainerView：承载Kuikly的容器View
        // contextCode: jvm模式下传递""
        // pageName: 传递想要打开的Kuikly侧的Page名字
        // pageData: 传递给Kuikly页面的参数
        contextCodeHandler.openPage(hrContainerView, pageName, createPageData())

        if (pageName.startsWith("OverNativeClickDemo")) {
            val nativeBtn: View = findViewById(R.id.nativeBtn)
            nativeBtn.visibility = View.VISIBLE
            val nativeTouch: View = findViewById(R.id.nativeTouchView)
            nativeTouch.visibility = View.VISIBLE
            @SuppressLint("ClickableViewAccessibility")
            nativeTouch.setOnTouchListener { v, event ->
                when (event.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        Toast.makeText(this, "成功触发TouchDown", Toast.LENGTH_SHORT).show()
                    }
                    MotionEvent.ACTION_UP -> {
                        Toast.makeText(this, "成功触发TouchUp", Toast.LENGTH_SHORT).show()
                    }
                }
                true
            }
        }
    }

    override fun onResume() {  // 5.通知Kuikly页面触发onResume
        super.onResume()
        kuiklyRenderViewDelegator.onResume()
    }

    override fun onPause() {  // 6. 通知Kuikly页面触发onStop
        super.onPause()
        kuiklyRenderViewDelegator.onPause()
    }
    override fun onDestroy() {  // 7. 通知Kuikly页面触发onDestroy
        super.onDestroy()
        kuiklyRenderViewDelegator.onDetach()
    }

    private fun createPageData(): Map<String, Any> {
        val param = argsToMap()
        param["appId"] = 1
        param["sysLang"] = resources.configuration.locale.language
        param["debug"] = if (BuildConfig.DEBUG) 1 else 0
        return param
    }

    private fun argsToMap(): MutableMap<String, Any> {
        val jsonStr = intent.getStringExtra(KEY_PAGE_DATA) ?: return mutableMapOf()
        return JSONObject(jsonStr).toMap()
    }

    private fun setupAdapterManager() {
        if (KuiklyRenderAdapterManager.krImageAdapter == null) {
            KuiklyRenderAdapterManager.krImageAdapter = KRImageAdapter(applicationContext)
        }
        if (KuiklyRenderAdapterManager.krLogAdapter == null) {
            KuiklyRenderAdapterManager.krLogAdapter = KRLogAdapter
        }
        if (KuiklyRenderAdapterManager.krUncaughtExceptionHandlerAdapter == null) {
            KuiklyRenderAdapterManager.krUncaughtExceptionHandlerAdapter =
                KRUncaughtExceptionHandlerAdapter
        }
        if (KuiklyRenderAdapterManager.krFontAdapter == null) {
            KuiklyRenderAdapterManager.krFontAdapter = KRFontAdapter
        }
        if (KuiklyRenderAdapterManager.krColorParseAdapter == null) {
            KuiklyRenderAdapterManager.krColorParseAdapter =
                KRColorParserAdapter(KRApplication.application)
        }
        if (KuiklyRenderAdapterManager.krRouterAdapter == null) {
            KuiklyRenderAdapterManager.krRouterAdapter = KRRouterAdapter()
        }
        if (KuiklyRenderAdapterManager.krThreadAdapter == null) {
            KuiklyRenderAdapterManager.krThreadAdapter = KRThreadAdapter()
        }
        if (KuiklyRenderAdapterManager.krPagViewAdapter == null) {
            KuiklyRenderAdapterManager.krPagViewAdapter = PAGViewAdapter()
        }
        if (KuiklyRenderAdapterManager.krAPNGViewAdapter == null) {
            KuiklyRenderAdapterManager.krAPNGViewAdapter = KRAPNGViewAdapter()
        }
        if (KuiklyRenderAdapterManager.krVideoViewAdapter == null) {
            KuiklyRenderAdapterManager.krVideoViewAdapter = VideoViewAdapter()
        }
        if (KuiklyRenderAdapterManager.krTextPostProcessorAdapter == null) {
            KuiklyRenderAdapterManager.krTextPostProcessorAdapter = KRTextPostProcessorAdapter(this)
        }
    }

    private fun setupImmersiveMode() {
        setDecorFitsSystemWindows(window)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = if (Build.VERSION.SDK_INT >= 26) Color.TRANSPARENT else 0x66000000
        if (Build.VERSION.SDK_INT >= 28) {
            val newMode = if (Build.VERSION.SDK_INT >= 30) {
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            } else {
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
            val attrs = window.attributes
            if (attrs.layoutInDisplayCutoutMode != newMode) {
                attrs.layoutInDisplayCutoutMode = newMode
                window.attributes = attrs
            }
        }
        if (Build.VERSION.SDK_INT >= 29) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }

        setAppearanceLightStatusBars(window)
        setAppearanceLightNavigationBars(window)
    }

    private fun setAppearanceLightStatusBars(window: Window) {
        if (Build.VERSION.SDK_INT >= 30) {
            window.decorView.apply {
                systemUiVisibility = systemUiVisibility or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            }
            window.insetsController?.setSystemBarsAppearance(
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
            )
        } else if (Build.VERSION.SDK_INT >= 23) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
            window.decorView.apply {
                systemUiVisibility = systemUiVisibility or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            }
        }
    }

    private fun setAppearanceLightNavigationBars(window: Window) {
        if (Build.VERSION.SDK_INT >= 30) {
            window.decorView.apply {
                systemUiVisibility = systemUiVisibility or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            }
            window.insetsController?.setSystemB
```

### Core Architecture Module: `androidApp/src/main/java/com/tencent/kuikly/android/demo/KuiklyRenderView.kt`
```
/*
 * Tencent is pleased to support the open source community by making KuiklyUI
 * available.
 * Copyright (C) 2025 Tencent. All rights reserved.
 * Licensed under the License of KuiklyUI;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.tencent.kuikly.android.demo

import android.content.Context
import com.tencent.kuikly.android.demo.module.KRBridgeModule
import com.tencent.kuikly.android.demo.module.KRInteropPerfTestModule
import com.tencent.kuikly.android.demo.module.KRMyModule
import com.tencent.kuikly.android.demo.module.KRShareModule
import com.tencent.kuikly.core.render.android.IKuiklyRenderExport
import com.tencent.kuikly.core.render.android.expand.KuiklyRenderViewBaseDelegatorDelegate
import com.tencent.kuikly.core.render.android.expand.KuiklyBaseView

class KuiklyRenderView(context: Context, delegate: KuiklyRenderViewBaseDelegatorDelegate? = null) : KuiklyBaseView(context, delegate) {

    override fun registerExternalModule(kuiklyRenderExport: IKuiklyRenderExport) {
        super.registerExternalModule(kuiklyRenderExport)
        with(kuiklyRenderExport) {
            moduleExport(KRBridgeModule.MODULE_NAME) {
                KRBridgeModule()
            }
            moduleExport(KRMyModule.MODULE_NAME) {
                KRMyModule()
            }
            moduleExport(KRShareModule.MODULE_NAME) {
                KRShareModule()
            }
            moduleExport(KRInteropPerfTestModule.MODULE_NAME) {
                KRInteropPerfTestModule()
            }
        }
    }

}

```

### Core Architecture Module: `compose/src/androidMain/kotlin/com/tencent/kuikly/compose/ui/input/pointer/util/VelocityTracker.android.kt`
```
/*
 * Copyright 2023 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.tencent.kuikly.compose.ui.input.pointer.util

internal actual val AssumePointerMoveStoppedMilliseconds: Int
    get() = 40
internal actual val HistorySize: Int
    get() = 20
```

### Core Architecture Module: `compose/src/androidMain/kotlin/com/tencent/kuikly/compose/ui/platform/DebugUtils.android.kt`
```
/*
 * Copyright 2020 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.tencent.kuikly.compose.ui.platform

internal actual fun simpleIdentityToString(obj: Any, name: String?): String {
    val className = name ?: if (obj::class.java.isAnonymousClass) {
        obj::class.java.name
    } else {
        obj::class.java.simpleName
    }

    return className + "@" + String.format("%07x", System.identityHashCode(obj))
}

//internal actual fun Any.nativeClass(): Any = this.javaClass


```

### Core Architecture Module: `compose/src/androidMain/kotlin/com/tencent/kuikly/compose/ui/util/InlineClassHelper.android.kt`
```
/*
 * Copyright 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

package com.tencent.kuikly.compose.ui.util

actual fun packFloatsP(val1: Float, val2: Float): PackedFloats {
    val v1 = val1.toRawBits().toLong()
    val v2 = val2.toRawBits().toLong()
    return v1.shl(32) or (v2 and 0xFFFFFFFFL)
}

actual fun unpackFloat1P(value: PackedFloats): Float =
    Float.fromBits(value.shr(32).toInt())

actual fun unpackFloat2P(value: PackedFloats): Float =
    Float.fromBits(value.and(0xFFFFFFFFL).toInt())

actual fun packedFloatsBitEquals(a: PackedFloats, b: PackedFloats): Boolean = a == b

actual fun packIntsP(val1: Int, val2: Int): PackedInts =
    val1.toLong().shl(32) or (val2.toLong() and 0xFFFFFFFFL)

actual fun unpackInt1P(value: PackedInts): Int = value.shr(32).toInt()

actual fun unpackInt2P(value: PackedInts): Int = value.and(0xFFFFFFFFL).toInt()

actual fun packedIntsBitEquals(a: PackedInts, b: PackedInts): Boolean = a == b

```

### Core Architecture Module: `compose/src/androidMain/kotlin/com/tencent/kuikly/compose/ui/util/PackedValue.android.kt`
```
/*
 * Copyright (C) Tencent. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

package com.tencent.kuikly.compose.ui.util

actual typealias PackedFloats = Long
actual typealias PackedInts = Long
actual typealias PackedTextUnit = Long

```

### Core Architecture Module: `compose/src/androidMain/kotlin/com/tencent/kuikly/lifecycle/WeakReference.android.kt`
```
/*
 * Tencent is pleased to support the open source community by making KuiklyUI
 * available.
 * Copyright (C) 2025 Tencent. All rights reserved.
 * Licensed under the License of KuiklyUI;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.tencent.kuikly.lifecycle

actual typealias WeakReference<T> = java.lang.ref.WeakReference<T>

```

### Core Architecture Module: `compose/src/androidMain/kotlin/com/tencent/kuikly/lifecycle/viewmodel/internal/ViewModelProviders.android.kt`
```
/*
 * Copyright 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.tencent.kuikly.lifecycle.viewmodel.internal

import kotlin.reflect.KClass

internal actual val <T : Any> KClass<T>.canonicalName: String?
    get() = qualifiedName
```

### Core Architecture Module: `compose/src/commonMain/kotlin/com/tencent/kuikly/compose/animation/core/Animatable.kt`
```
/*
 * Copyright 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.tencent.kuikly.compose.animation.core

import com.tencent.kuikly.compose.animation.core.AnimationEndReason.BoundReached
import com.tencent.kuikly.compose.animation.core.AnimationEndReason.Finished
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CancellationException

/**
 * [Animatable] is a value holder that automatically animates its value when the value is
 * changed via [animateTo]. If [animateTo] is invoked during an ongoing value change animation,
 * a new animation will transition [Animatable] from its current value (i.e. value at the point of
 * interruption) to the new [targetValue]. This ensures that the value change is __always__
 * continuous using [animateTo]. If a [spring] animation (e.g. default animation) is used with
 * [animateTo], the velocity change will guarantee to be continuous as well.
 *
 * Unlike [AnimationState], [Animatable] ensures *mutual exclusiveness* on its animations. To
 * achieve this, when a new animation is started via [animateTo] (or [animateDecay]), any ongoing
 * animation will be canceled via a [CancellationException].
 *
 * @sample androidx.compose.animation.core.samples.AnimatableAnimateToGenericsType
 *
 * @param initialValue initial value of the animatable value holder
 * @param typeConverter A two-way converter that converts the given type [T] from and to
 *                      [AnimationVector]
 * @param visibilityThreshold Threshold at which the animation may round off to its target value.
 *
 * @param label An optional label for differentiating this animation from others in android studio.
 *
 * @see animateTo
 * @see animateDecay
 */
@Suppress("NotCloseable")
class Animatable<T, V : AnimationVector>(
    initialValue: T,
    val typeConverter: TwoWayConverter<T, V>,
    private val visibilityThreshold: T? = null,
    val label: String = "Animatable"
) {

    @Deprecated(
        "Maintained for binary compatibility",
        replaceWith = ReplaceWith(
            "Animatable(initialValue, typeConverter, visibilityThreshold, \"Animatable\")"
        ),
        DeprecationLevel.HIDDEN
    )
    constructor(
        initialValue: T,
        typeConverter: TwoWayConverter<T, V>,
        visibilityThreshold: T? = null
    ) : this(initialValue, typeConverter, visibilityThreshold, "Animatable")

    internal val internalState = AnimationState(
        typeConverter = typeConverter,
        initialValue = initialValue
    )

    /**
     * Current value of the animation.
     */
    val value: T
        get() = internalState.value

    /**
     * Velocity vector of the animation (in the form of [AnimationVector].
     */
    val velocityVector: V
        get() = internalState.velocityVector

    /**
     * Returns the velocity, converted from [velocityVector].
     */
    val velocity: T
        get() = typeConverter.convertFromVector(velocityVector)

    /**
     * Indicates whether the animation is running.
     */
    var isRunning: Boolean by mutableStateOf(false)
        private set

    /**
     * The target of the current animation. If the animation finishes un-interrupted, it will
     * reach this target value.
     */
    var targetValue: T by mutableStateOf(initialValue)
        private set

    /**
     * Lower bound of the animation, null by default (meaning no lower bound). Bounds can be
     * changed using [updateBounds].
     *
     * Animation will stop as soon as *any* dimension specified in [lowerBound] is reached. For
     * example: For an Animatable<Offset> with an [lowerBound] set to Offset(100f, 200f), when
     * the [value].x drops below 100f *or* [value].y drops below 200f, the animation will stop.
     */
    var lowerBound: T? = null
        private set

    /**
     * Upper bound of the animation, null by default (meaning no upper bound). Bounds can be
     * changed using [updateBounds].
     *
     * Animation will stop as soon as *any* dimension specified in [upperBound] is reached. For
     * example: For an Animatable<Offset> with an [upperBound] set to Offset(100f, 200f), when
     * the [value].x exceeds 100f *or* [value].y exceeds 200f, the animation will stop.
     */
    var upperBound: T? = null
        private set

    private val mutatorMutex = MutatorMutex()
    private var nativeAnimationReplacementRequested = false
    internal val defaultSpringSpec: SpringSpec<T> =
        SpringSpec(visibilityThreshold = visibilityThreshold)

    @Suppress("UNCHECKED_CAST")
    private val negativeInfinityBounds: V = when (velocityVector) {
        is AnimationVector1D -> negativeInfinityBounds1D
        is AnimationVector2D -> negativeInfinityBounds2D
        is AnimationVector3D -> negativeInfinityBounds3D
        else -> negativeInfinityBounds4D
    } as V

    @Suppress("UNCHECKED_CAST")
    private val positiveInfinityBounds = when (velocityVector) {
        is AnimationVector1D -> positiveInfinityBounds1D
        is AnimationVector2D -> positiveInfinityBounds2D
        is AnimationVector3D -> positiveInfinityBounds3D
        else -> positiveInfinityBounds4D
    } as V

    private var lowerBoundVector: V = negativeInfinityBounds
    private var upperBoundVector: V = positiveInfinityBounds
    private var hasExplicitBounds = false

    /**
     * Updates either [lowerBound] or [upperBound], or both. This will update
     * [Animatable.lowerBound] and/or [Animatable.upperBound] accordingly after a check to ensure
     * the provided [lowerBound] is no greater than [upperBound] in any dimension.
     *
     * Setting the bounds will immediate clamp the [value], only if the animation isn't running.
     * For the on-going animation, the value at the next frame update will be checked against the
     * bounds. If the value reaches the bound, then the animation will end with [BoundReached]
     * end reason.
     *
     * @param lowerBound lower bound of the animation. Defaults to the [Animatable.lowerBound]
     *                   that is currently set.
     * @param upperBound upper bound of the animation. Defaults to the [Animatable.upperBound]
     *                   that is currently set.
     * @throws [IllegalStateException] if the [lowerBound] is greater than [upperBound] in any
     *                                 dimension.
     */
    fun updateBounds(lowerBound: T? = this.lowerBound, upperBound: T? = this.upperBound) {
        val lowerBoundVector = lowerBound?.run { typeConverter.convertToVector(this) }
            ?: negativeInfinityBounds

        val upperBoundVector = upperBound?.run { typeConverter.convertToVector(this) }
            ?: positiveInfinityBounds

        for (i in 0 until lowerBoundVector.size) {
            // TODO: is this check too aggressive?
            checkPrecondition(lowerBoundVector[i] <= upperBoundVector[i]) {
                "Lower bound must be no greater than upper bound on *all* dimensions. The " +
                    "provided lower bound: $lowerBoundVector is greater than upper bound " +
                    "$upperBoundVector on index $i"
            }
        }
        // After the correctness check:
        this.lowerBoundVector = lowerBoundVector
        this.upperBoundVector = upperBoundVector

        this.upperBound = upperBound
        this.lowerBound = lowerBound
        hasExplicitBounds = lowerBound != null || upperBound != null
        if (!isRunning) {
            val clampedValue = clampToBounds(value)
            if (clampedValue != value) {
                this.internalState.value = clampedValue
            }
        }
    }

    /**
     * Starts an animation to animate from [value] to the provided [targetValue]. If there is
     * already an animation in-flight, this method will cancel the ongoing animation before
     * starting a new animation continuing the current [value] and [velocity]. It's recommended to
     * set the optional [initialVelocity] only when [animateTo] is used immediately after a fling.
     * In most of the other cases, altering velocity would result in visual discontinuity.
     *
     * The animation will use the provided [animationSpec] to animate the value towards the
     * [targetValue]. When no [animationSpec] is specified, a [spring] will be used.  [block] will
     * be invoked on each animation frame.
     *
     * Returns an [AnimationResult] object. It contains: 1) the reason for ending the animation,
     * and 2) an end state of the animation. The reason for ending the animation can be either of
     * the following two:
     * -  [Finished], when the animation finishes successfully without any interruption,
     * -  [BoundReached] If the animation reaches the either [lowerBound] or [upperBound] in any
     *    dimension, the animation will end with [BoundReached] being the end reason.
     *
     * If the animation gets interrupted by 1) another call to start an animation
     * (i.e. [animateTo]/[animateDecay]), 2) [Animatable.stop], or 3)[Animatable.snapTo], the
     * canceled animation will throw a [CancellationException] as the job gets canceled. As a
     * result, all the subsequent work in the caller's coroutine will be canceled. This is often
     * the desired behavior. If there's any cleanup that needs to be done when an animation gets
     * canceled, con
```

### Core Architecture Module: `compose/src/commonMain/kotlin/com/tencent/kuikly/compose/animation/core/AnimateAsState.kt`
```
/*
 * Copyright 2020 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.tencent.kuikly.compose.animation.core

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import com.tencent.kuikly.compose.ui.geometry.Offset
import com.tencent.kuikly.compose.ui.geometry.Rect
import com.tencent.kuikly.compose.ui.geometry.Size
import com.tencent.kuikly.compose.ui.unit.Dp
import com.tencent.kuikly.compose.ui.unit.IntOffset
import com.tencent.kuikly.compose.ui.unit.IntSize
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch

private val defaultAnimation = spring<Float>()

/**
 * Fire-and-forget animation function for [Float]. This Composable function is overloaded for
 * different parameter types such as [Dp], [Color][androidx.compose.ui.graphics.Color], [Offset],
 * etc. When the provided [targetValue] is changed, the animation will run automatically. If there
 * is already an animation in-flight when [targetValue] changes, the on-going animation will adjust
 * course to animate towards the new target value.
 *
 * [animateFloatAsState] returns a [State] object. The value of the state object will continuously
 * be updated by the animation until the animation finishes.
 *
 * Note, [animateFloatAsState] cannot be canceled/stopped without removing this composable function
 * from the tree. See [Animatable] for cancelable animations.
 *
 * @sample androidx.compose.animation.core.samples.AlphaAnimationSample
 *
 * @param targetValue Target value of the animation
 * @param animationSpec The animation that will be used to change the value through time. [spring]
 *                      will be used by default.
 * @param visibilityThreshold An optional threshold for deciding when the animation value is
 *                            considered close enough to the targetValue.
 * @param label An optional label to differentiate from other animations in Android Studio.
 * @param finishedListener An optional end listener to get notified when the animation is finished.
 * @return A [State] object, the value of which is updated by animation.
 */
@Composable
fun animateFloatAsState(
    targetValue: Float,
    animationSpec: AnimationSpec<Float> = defaultAnimation,
    visibilityThreshold: Float = 0.01f,
    label: String = "FloatAnimation",
    finishedListener: ((Float) -> Unit)? = null
): State<Float> {
    val resolvedAnimSpec =
        if (animationSpec === defaultAnimation) {
            remember(visibilityThreshold) { spring(visibilityThreshold = visibilityThreshold) }
        } else {
            animationSpec
        }
    return animateValueAsState(
        targetValue,
        Float.VectorConverter,
        resolvedAnimSpec,
        visibilityThreshold,
        label,
        finishedListener
    )
}

/**
 * Fire-and-forget animation function for [Dp]. This Composable function is overloaded for
 * different parameter types such as [Float], [Color][androidx.compose.ui.graphics.Color], [Offset],
 * etc. When the provided [targetValue] is changed, the animation will run automatically. If there
 * is already an animation in-flight when [targetValue] changes, the on-going animation will adjust
 * course to animate towards the new target value.
 *
 * [animateDpAsState] returns a [State] object. The value of the state object will continuously be
 * updated by the animation until the animation finishes.
 *
 * Note, [animateDpAsState] cannot be canceled/stopped without removing this composable function
 * from the tree. See [Animatable] for cancelable animations.
 *
 * @sample androidx.compose.animation.core.samples.DpAnimationSample
 *
 * @param targetValue Target value of the animation
 * @param animationSpec The animation that will be used to change the value through time. Physics
 *                    animation will be used by default.
 * @param label An optional label to differentiate from other animations in Android Studio.
 * @param finishedListener An optional end listener to get notified when the animation is finished.
 * @return A [State] object, the value of which is updated by animation.
 */
@Composable
fun animateDpAsState(
    targetValue: Dp,
    animationSpec: AnimationSpec<Dp> = dpDefaultSpring,
    label: String = "DpAnimation",
    finishedListener: ((Dp) -> Unit)? = null
): State<Dp> {
    return animateValueAsState(
        targetValue,
        Dp.VectorConverter,
        animationSpec,
        label = label,
        finishedListener = finishedListener
    )
}

private val dpDefaultSpring = spring<Dp>(visibilityThreshold = Dp.VisibilityThreshold)

/**
 * Fire-and-forget animation function for [Size]. This Composable function is overloaded for
 * different parameter types such as [Dp], [Color][androidx.compose.ui.graphics.Color], [Offset],
 * etc. When the provided [targetValue] is changed, the animation will run automatically. If there
 * is already an animation in-flight when [targetValue] changes, the on-going animation will adjust
 * course to animate towards the new target value.
 *
 * [animateSizeAsState] returns a [State] object. The value of the state object will continuously be
 * updated by the animation until the animation finishes.
 *
 * Note, [animateSizeAsState] cannot be canceled/stopped without removing this composable function
 * from the tree. See [Animatable] for cancelable animations.
 *
 *     val size: Size by animateSizeAsState(
 *         if (selected) Size(20f, 20f) else Size(10f, 10f))
 *
 * @param targetValue Target value of the animation
 * @param animationSpec The animation that will be used to change the value through time. Physics
 *                    animation will be used by default.
 * @param label An optional label to differentiate from other animations in Android Studio.
 * @param finishedListener An optional end listener to get notified when the animation is finished.
 * @return A [State] object, the value of which is updated by animation.
 */
@Composable
fun animateSizeAsState(
    targetValue: Size,
    animationSpec: AnimationSpec<Size> = sizeDefaultSpring,
    label: String = "SizeAnimation",
    finishedListener: ((Size) -> Unit)? = null
): State<Size> {
    return animateValueAsState(
        targetValue,
        Size.VectorConverter,
        animationSpec,
        label = label,
        finishedListener = finishedListener
    )
}

private val sizeDefaultSpring = spring(visibilityThreshold = Size.VisibilityThreshold)

/**
 * Fire-and-forget animation function for [Offset]. This Composable function is overloaded for
 * different parameter types such as [Dp], [Color][androidx.compose.ui.graphics.Color], [Float],
 * etc. When the provided [targetValue] is changed, the animation will run automatically. If there
 * is already an animation in-flight when [targetValue] changes, the on-going animation will adjust
 * course to animate towards the new target value.
 *
 * [animateOffsetAsState] returns a [State] object. The value of the state object will
 * continuously be updated by the animation until the animation finishes.
 *
 * Note, [animateOffsetAsState] cannot be canceled/stopped without removing this composable function
 * from the tree. See [Animatable] for cancelable animations.
 *
 * @sample androidx.compose.animation.core.samples.AnimateOffsetSample
 *
 * @param targetValue Target value of the animation
 * @param animationSpec The animation that will be used to change the value through time. Physics
 *                    animation will be used by default.
 * @param label An optional label to differentiate from other animations in Android Studio.
 * @param finishedListener An optional end listener to get notified when the animation is finished.
 * @return A [State] object, the value of which is updated by animation.
 */
@Composable
fun animateOffsetAsState(
    targetValue: Offset,
    animationSpec: AnimationSpec<Offset> = offsetDefaultSpring,
    label: String = "OffsetAnimation",
    finishedListener: ((Offset) -> Unit)? = null
): State<Offset> {
    return animateValueAsState(
        targetValue,
        Offset.VectorConverter,
        animationSpec,
        label = label,
        finishedListener = finishedListener
    )
}

private val offsetDefaultSpring = spring(visibilityThreshold = Offset.VisibilityThreshold)

/**
 * Fire-and-forget animation function for [Rect]. This Composable function is overloaded for
 * different parameter types such as [Dp], [Color][androidx.compose.ui.graphics.Color], [Offset],
 * etc. When the provided [targetValue] is changed, the animation will run automatically. If there
 * is already an animation in-flight when [targetValue] changes, the on-going animation will adjust
 * course to animate towards the new target value.
 *
 * [animateRectAsState] returns a [State] object. The value of the state object will continuously be
 * updated by the animation until the animation finishes.
 *
 * Note, [animateRectAsState] cannot be canceled/stopped without removing this composable function
 * from the tree. See [Animatable] for cancelable animations.
 *
 *    val bounds: Rect by animateRectAsState(
 *        if (enabled) Rect(0f, 0f, 100f, 100f) else Rect(8f, 8f, 80f, 80f))
 *
 * @
```

### Core Architecture Module: `compose/src/commonMain/kotlin/com/tencent/kuikly/compose/animation/core/Animation.kt`
```
/*
 * Copyright 2020 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.tencent.kuikly.compose.animation.core

import kotlin.math.roundToLong
import androidx.annotation.RestrictTo

/**
 * This interface provides a convenient way to query from an [VectorizedAnimationSpec] or
 * [FloatDecayAnimationSpec]: It spares the need to pass the starting conditions and in some cases
 * ending condition for each value or velocity query, and instead only requires the play time to be
 * passed for such queries.
 *
 * The implementation of this interface should cache the starting conditions and ending
 * conditions of animations as needed.
 *
 * __Note__: [Animation] does not track the lifecycle of an animation. It merely reacts to play time
 * change and returns the new value/velocity as a result. It can be used as a building block for
 * more lifecycle aware animations. In contrast, [Animatable] and [Transition] are
 * stateful and manage their own lifecycles.
 *
 * @see [Animatable]
 * @see [rememberTransition]
 * @see [updateTransition]
 */

interface Animation<T, V : AnimationVector> {
    /**
     * This amount of time in nanoseconds that the animation will run before it finishes
     */
    @get:Suppress("MethodNameUnits")
    val durationNanos: Long

    /**
     * The [TwoWayConverter] that will be used to convert value/velocity from any arbitrary data
     * type to [AnimationVector]. This makes it possible to animate different dimensions of the
     * data object independently (e.g. x/y dimensions of the position data).
     */
    val typeConverter: TwoWayConverter<T, V>

    /**
     * This is the value that the [Animation] will reach when it finishes uninterrupted.
     */
    val targetValue: T

    /**
     * Whether or not the [Animation] represents an infinite animation. That is, one that will
     * not finish by itself, one that needs an external action to stop. For examples, an
     * indeterminate progress bar, which will only stop when it is removed from the composition.
     */
    val isInfinite: Boolean

    /**
     * Returns the value of the animation at the given play time.
     *
     * @param playTimeNanos the play time that is used to determine the value of the animation.
     */
    fun getValueFromNanos(playTimeNanos: Long): T

    /**
     * Returns the velocity (in [AnimationVector] form) of the animation at the given play time.
     *
     * @param playTimeNanos the play time that is used to calculate the velocity of the animation.
     */
    fun getVelocityVectorFromNanos(playTimeNanos: Long): V

    /**
     * Returns whether the animation is finished at the given play time.
     *
     * @param playTimeNanos the play time used to determine whether the animation is finished.
     */
    fun isFinishedFromNanos(playTimeNanos: Long): Boolean {
        return playTimeNanos >= durationNanos
    }
}

internal val Animation<*, *>.durationMillis: Long
    get() = durationNanos / MillisToNanos

internal const val MillisToNanos: Long = 1_000_000L
internal const val SecondsToNanos: Long = 1_000_000_000L

internal fun convertSecondsToNanos(seconds: Float): Long =
    (seconds.toDouble() * SecondsToNanos).roundToLong()

internal fun convertNanosToSeconds(nanos: Long): Double =
    nanos.toDouble() / SecondsToNanos

internal const val SecondsToMillis: Long = 1_000L

/**
 * Returns the velocity of the animation at the given play time.
 *
 * @param playTimeNanos the play time that is used to calculate the velocity of the animation.
 */
fun <T, V : AnimationVector> Animation<T, V>.getVelocityFromNanos(playTimeNanos: Long): T =
    typeConverter.convertFromVector(getVelocityVectorFromNanos(playTimeNanos))
/**
 * Creates a [TargetBasedAnimation] from a given [VectorizedAnimationSpec] of [AnimationVector] type. This
 * convenient method is intended for when the value being animated (i.e. start value, end value,
 * etc) is of [AnimationVector] type.
 *
 * @param initialValue the value that the animation will start from
 * @param targetValue the value that the animation will end at
 * @param initialVelocity the initial velocity to start the animation at
 */
@RestrictTo(RestrictTo.Scope.LIBRARY)
fun <V : AnimationVector> VectorizedAnimationSpec<V>.createAnimation(
    initialValue: V,
    targetValue: V,
    initialVelocity: V
): TargetBasedAnimation<V, V> =
    TargetBasedAnimation(
        animationSpec = this,
        initialValue = initialValue,
        targetValue = targetValue,
        initialVelocityVector = initialVelocity,
        typeConverter = TwoWayConverter({ it }, { it })
    )

/**
 * Creates a [TargetBasedAnimation] with the given start/end conditions of the animation, and
 * the provided [animationSpec].
 *
 * The resulting [Animation] assumes that the start value and velocity, as well as end value do
 * not change throughout the animation, and cache these values. This caching enables much more
 * convenient query for animation value and velocity (where only playtime needs to be passed
 * into the methods).
 *
 * __Note__: When interruptions happen to the [TargetBasedAnimation], a new instance should
 * be created that use the current value and velocity as the starting conditions. This type of
 * interruption handling is the default behavior for both [Animatable] and
 * [Transition]. Consider using those APIs for the interruption handling, as well as
 * built-in animation lifecycle management.
 *
 * @param animationSpec the [AnimationSpec] that will be used to calculate value/velocity
 * @param initialValue the start value of the animation
 * @param targetValue the end value of the animation
 * @param initialVelocity the start velocity (of type [T] of the animation
 * @param typeConverter the [TwoWayConverter] that is used to convert animation type [T] from/to [V]
 */
fun <T, V : AnimationVector> TargetBasedAnimation(
    animationSpec: AnimationSpec<T>,
    typeConverter: TwoWayConverter<T, V>,
    initialValue: T,
    targetValue: T,
    initialVelocity: T
) = TargetBasedAnimation(
    animationSpec,
    typeConverter,
    initialValue,
    targetValue,
    typeConverter.convertToVector(initialVelocity)
)

/**
 * This is a convenient animation wrapper class that works for all target based animations, i.e.
 * animations that has a pre-defined end value, unlike decay.
 *
 * It assumes that the starting value and velocity, as well as ending value do not change throughout
 * the animation, and cache these values. This caching enables much more convenient query for
 * animation value and velocity (where only playtime needs to be passed into the methods).
 *
 * __Note__: When interruptions happen to the [TargetBasedAnimation], a new instance should
 * be created that use the current value and velocity as the starting conditions. This type of
 * interruption handling is the default behavior for both [Animatable] and
 * [Transition]. Consider using those APIs for the interruption handling, as well as
 * built-in animation lifecycle management.
 *
 * @param animationSpec the [VectorizedAnimationSpec] that will be used to calculate value/velocity
 * @param initialValue the start value of the animation
 * @param targetValue the end value of the animation
 * @param typeConverter the [TwoWayConverter] that is used to convert animation type [T] from/to [V]
 * @param initialVelocityVector the start velocity of the animation in the form of [AnimationVector]
 *
 * @see [Transition]
 * @see [rememberTransition]
 * @see [updateTransition]
 * @see [Animatable]
 */
class TargetBasedAnimation<T, V : AnimationVector> internal constructor(
    internal val animationSpec: VectorizedAnimationSpec<V>,
    override val typeConverter: TwoWayConverter<T, V>,
    initialValue: T,
    targetValue: T,
    initialVelocityVector: V? = null
) : Animation<T, V> {
    internal var mutableTargetValue: T = targetValue
        set(value) {
            if (field != value) {
                field = value
                targetValueVector = typeConverter.convertToVector(value)
                _endVelocity = null
                _durationNanos = -1L
            }
        }

    internal var mutableInitialValue: T = initialValue
        set(value) {
            if (value != field) {
                field = value
                initialValueVector = typeConverter.convertToVector(value)
                _endVelocity = null
                _durationNanos = -1L
            }
        }

    val initialValue: T
        get() = mutableInitialValue

    override val targetValue: T
        get() = mutableTargetValue

    /**
     * Creates a [TargetBasedAnimation] with the given start/end conditions of the animation, and
     * the provided [animationSpec].
     *
     * The resulting [Animation] assumes that the start value and velocity, as well as end value do
     * not change throughout the animation, and cache these values. This caching enables much more
     * convenient query for animation value and velocity (where only playtime needs to be passed
     * into the methods).
     *
     * __Note__: When interruptions happen to the [TargetBasedAnimation], a new instance should
     * be created that use the current value and velocity as the starting conditions. This type of
     * interruption handling is the default behavior for both [Animatable] and
     * [Transition]. Consider using those APIs for the interruption handling, as well as
     * built-in animation lifecycle management.
     *
```

### Core Architecture Module: `compose/src/commonMain/kotlin/com/tencent/kuikly/compose/animation/core/AnimationEndReason.kt`
```
/*
 * Copyright 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.tencent.kuikly.compose.animation.core

/**
 * Possible reasons for [Animatable]s to end.
 */
enum class AnimationEndReason {
    /**
     * Animation will be forced to end when its value reaches upper/lower bound (if they have
     * been defined, e.g. via [Animatable.updateBounds])
     *
     * Unlike [Finished], when an animation ends due to [BoundReached], it often falls short
     * from its initial target, and the remaining velocity is often non-zero. Both the end value
     * and the remaining velocity can be obtained via [AnimationResult].
     */
    BoundReached,
    /**
     * Animation has finished successfully without any interruption.
     */
    Finished
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1773** (2026-09-30): **fix(android): center rich text line height on font ascent/descent**
  *Symptoms*:  ## Problem  On Android, text with an explicit `lineHeight` sits lower in its line box than the same text on iOS, OHOS or in a browser, and the offset differs per font. Fonts with asymmetric font padding (many custom/brand fonts) are most affected: the glyphs appear pushed down and multi-font rich text does not share a consistent baseline for the same `lineHeight`.  ## Root cause  `HRLineHeightSpan.chooseHeight` distributed the extra leading around `FontMetricsInt.top` / `bottom`:  ```kotlin val additional = height - (-fm.top + fm.bottom) fm.top -= ceil(additional / 2f); fm.bottom += floor(additional / 2f) fm.ascent = fm.top; fm.descent = fm.bottom ```  `top`/`bottom` include the font padding extents even when `includeFontPadding` is disabled, so the "centre" is biased by whatever extra padding the font declares above vs below. CSS (and the iOS/OHOS renderers) apply half-leading around ascent/descent instead.  ## Fix  Distribute the extra leading around `ascent` / `descent` and derive `top` / `bottom` from them (CSS half-leading). Odd leftovers go to the descent side, and the resulting box is always exactly `height` tall.  The computation stays purely metrics based (no glyph-bounds measurement): `HRLineHeightSpan` is shared by `KRRichTextView` and `KRTextFieldView`, and a content-dependent placement would make an editable line jump when a taller glyph is typed.  Two now-unused `kotlin.math` imports are removed.  ## Tests  `core-render-android/src/test/.../expand/component/tex
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/signed)](https://cla.opensource.tencent.com/Tencent-TDS/KuiklyUI?pullRequest=1773) <br/>All committers have signed the CLA.
  > Superseded by a re-submitted PR with the contributor's own authorship (same change); closing this one.

- **Issue #1772** (2026-09-30): **fix(compose): serialize SpanStyle.fontFamily on rich text spans**
  *Symptoms*:  ## Problem  1. In Compose, a `fontFamily` set through `SpanStyle` on part of an `AnnotatedString` (for example a monospace face on one word, or a brand font on a heading fragment) is ignored. The whole paragraph renders with the `Text`'s `TextStyle.fontFamily`. 2. Once span families are forwarded, a `LinkAnnotation` that has no `styles` (a plain `Clickable` over a range) would erase the family inherited from enclosing spans over the link range. This most often shows up as a whole-paragraph click annotation resetting the paragraph's custom font.  ## Root cause  `TextSpan.applySpanStyle` in `KuiklyTextExtension.kt` forwards font size, weight, style, shadow, colour, decoration and letter spacing, but never calls `applyFontFamily`, so the span is lowered without `fontFamily`.  The link path lowers a style-less `LinkAnnotation` by applying `SpanStyle()`; `applyFontFamily(null)` then writes an empty `fontFamily` onto a span that already had one from an enclosing `SpanStyle`.  ## Fix  - `applySpanStyle` now calls `applyFontFamily(spanStyle.fontFamily)` alongside the other font props (same helper `TextAttr.applyTextStyle` already uses). - A `LinkAnnotation` without `styles` only contributes its click handler; links with styles are lowered exactly as before.  Both parts are in one PR because the second is a direct consequence of the first.  ## Tests  `compose/src/commonTest/.../foundation/text/AnnotatedStringSpanStyleTest.kt`:  - `spanStyleFontFamilyIsSerializedOnTheSpan`: a `Serif` 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/signed)](https://cla.opensource.tencent.com/Tencent-TDS/KuiklyUI?pullRequest=1772) <br/>All committers have signed the CLA.
  > Superseded by a re-submitted PR with the contributor's own authorship (same change); closing this one.

- **Issue #1771** (2026-09-30): **fix: render rich text span backgroundColor on Android, iOS and OHOS**
  *Symptoms*:  ## Problem  Setting a background colour on a single span of a rich text has no visible effect on any platform:  - Compose: `SpanStyle(background = ...)` inside an `AnnotatedString`. - Kuikly DSL: `TextSpan { backgroundColor(...) }` (available through `Attr`, since `TextSpan` extends `TextAttr`).  The whole-view `backgroundColor` on `Text` / `RichText` keeps working; only the per-span colour is lost.  ## Root cause  The span prop is already produced on the Kotlin side: `TextSpan.applySpanStyle` calls `applyStyleColor`, which writes `SpanStyle.background` to the span as the `backgroundColor` prop, and the DSL writes the same key. None of the three native rich text renderers ever read `backgroundColor` from a span entry in `values`, so the value is dropped at paint time.  ## Fix  Each renderer now reads the span's own `backgroundColor` and paints it behind the glyphs of that span:  - **Android** (`KRRichTextBuilder.kt`): `TextSpanProps` parses `backgroundColor`; a `BackgroundColorSpan` is added when the colour is not transparent. - **iOS** (`KRRichTextView.h/.m`): the parsed span attributes carry a `backgroundColor`; `NSBackgroundColorAttributeName` is applied over the span's range. - **OHOS** (`KRRichTextShadow.cpp`): a background brush is set on the span's `OH_Drawing_TextStyle` and destroyed after the typography is built.  Only the span's own props are consulted (no fallback to the text view's props). Core already excludes `backgroundColor` from the shadow props for `Text`/`
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/signed)](https://cla.opensource.tencent.com/Tencent-TDS/KuiklyUI?pullRequest=1771) <br/>All committers have signed the CLA.
  > Superseded by a re-submitted PR with the contributor's own authorship (same change); closing this one.

- **Issue #1770** (2026-09-29): **fix(miniapp): remove root transform to keep canvas same-layer rendering alive**
  *Symptoms*: ## Problem  On the WeChat miniapp target, any Canvas inside a scrollable container (LazyColumn) visually detaches from its card when the user scrolls: the Kuikly content layer scrolls away but the canvas drawing stays fixed at its pre-scroll viewport position. Screenshots from a real project (habit tracker with a score ring + 6 chart cards inside a LazyColumn):  - Score-ring arc drawn on top of unrelated cards after scrolling - Line charts rendered over neighboring cards  Layout is correct at initial render — the detach only happens on scroll.  ## Root cause  Kuikly's LazyColumn scrolls by applying a view transform to the content layer (self-drawn scrolling), not via a native scroll-view. WeChat canvas **same-layer rendering** makes the native canvas layer follow the WebView content — **but same-layer rendering is disabled when any ancestor of the canvas has a transform** (known WeChat behavior; it silently falls back to native-overlay mode where the canvas floats above the viewport and never follows content movement).  `MiniDocument.createRootContainer` unconditionally sets `transform: translate(0, 0)` on the root container (plus a transition on iOS):  ```kotlin // Need to set transform and transition to ensure drop-shadow and other content settings take effect root.firstElementChild?.style?.transform = "translate(0, 0)" ```  This puts a transform on the ancestor chain of every canvas, disabling same-layer rendering for all canvases on the page.  ## Fix  Remove the root tran
  **Post-Mortem & Fix Analysis**:
  > Correction: further testing shows removing the root transform does **not** fix the detach — scrolling still leaves canvas drawings at their pre-scroll viewport position. The real mechanism: Kuikly LazyColumn scrolls by transforming the content layer, and the native canvas layer never follows transform-based movement regardless of same-layer rendering. I'll close this PR and open an issue documenting the deeper incompatibility.
  > Closing — see correction above. Will open an issue with the full analysis.

- **Issue #1764** (2026-09-27): **fix(compose): skip orphan canvas reset when the view owns its draw loop (Compose 混用裸 reset 致画布空白)**
  *Symptoms*: ## 问题 / Problem  `KuiklyCanvas.view` setter 在 Compose 绘制遍历给 view 赋值时**无条件**下发 `callMethod("reset", "")`。 当 `CanvasView` 经由 `MakeKuiklyComposeNode` 混用且注册了 `drawCallback` 时，绘制指令由该 callback 自行管理（reset+重填在其自身 draw 流程内同批完成）；Compose 遍历随后补发的**裸 reset**（本遍历内无任何绘制指令跟随）会把其已入队的指令清掉——下一次原生重绘消费空队列，画布空白。  The `view` setter unconditionally emits a bare `reset` when the Compose draw traversal assigns the view. For a `CanvasView` driven through `MakeKuiklyComposeNode` with a registered `drawCallback` (which manages its own reset+refill inside its draw pass), that orphan reset wipes already-queued ops; the next native redraw consumes an empty queue and the canvas blanks.  ## 复现 / Reproduction  真实设备时序（两端探针）：`reset → 重填 → 又一次 reset（无重填） → onDraw 消费 0 条指令`。 - Android：mermaid 图 HOME 退后台→暖回前台，canvas 内容 ink 从非 0 归 0；产生新指令（如缩放）后立即恢复——「无新指令的系统重绘必空」。 - iOS：带「drawRect 不清队列」行为但**无本护栏**的构建上，同路径同样复现 ops=0 空白（反向实证护栏必要性）。 纯 Kuikly DSL 不触发：`reset` 与重填经 uiScheduler 同时间片执行（上游 review #1759 时的判断正确）；触发条件是 Compose 混用（`MakeKuiklyComposeNode<CanvasView>` + `drawCallback`）。  ## 修法 / Fix  `drawCallback != null` 时跳过这次裸 reset；无 `drawCallback` 的纯 Compose Canvas（其指令会在同一 Draw 遍历内随即重填）行为不变。  ## 验证范围（如实声明） / Validation scope  - **Android 真机运行时 PASS**（含本护栏的发布候选）：mermaid 首渲 ✔、HOME 退后台→暖回前台 ink 不变 ✔、静态 canvas 徽标切 tab 往返 ink 不变 ✔。 - **iOS**：render 层（`drawRect:` 不再清队列）已二进制核验；**带护栏的 iOS 运行时未验证**（构建环境受限），仅有「有 revert 无护栏必空」的反向实证。护栏位于 commonMain，机理与平台无关。  ## 关联 / Links  - 撤回并取代 #1759（那个 PR 用「消费后清空」掩盖了本洞，同时把 CanvasView 变成单次消费视图，引入系统重绘空
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla.opensource.tencent.com/pull/badge/not_signed)](https://cla.opensource.tencent.com/Tencent-TDS/KuiklyUI?pullRequest=1764) <br/>Thank you for your submission, we really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla.opensource.tencent.com/Tencent-TDS/KuiklyUI?pullRequest=1764) before we can accept your contribution.<br/><hr/>**BiSheng** seems not to be a GitHub user. You need a GitHub account to be able to sign the CLA. If you have already a GitHub account, please [add the email address used for this commit to your account](https://help.github.com/articles/why-are-my-commits-linked-to-the-wrong-user/#commits-are-not-linked-to-any-user).<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla.opensource.tencent.com/check/Tencent-TDS/KuiklyUI?pullRequest=1764) it.</sub>
  > Superseded by #1766（同一 diff，提交人已改为 Jiacheng 以通过 CLA 检查）。

- **Issue #1760** (2026-09-24): **fix: preserve Android shadows beyond view bounds**
  *Symptoms*: 

- **Issue #1759** (2026-09-24): **fix(canvas): consume-then-clear draw op queue to fix reset white screen**
  *Symptoms*: ## Problem  Since PR #1268 batched canvas draw ops into a single flush, each platform's `reset()` clears the pending op queue **immediately** when the JS/KMP side calls `context.reset()`. If a display/draw tick lands between `reset()` and the next refill of the op list, the render thread consumes an **empty queue** and the canvas flashes white (all previously issued ops are discarded without ever being drawn).  Observed on a real app: reset sequences dropped ~101 pending ops per frame, `onDraw` consumed `ops=0`, canvas rendered blank.  ## Fix  Defer clearing the op queue to the point where the queue is actually consumed, on all platforms:  - **Android** (`KRCanvasView.kt`): `reset()` no longer clears `drawOperationList`; `performDrawOperationList` clears it after replaying the ops. - **iOS** (`KRCanvasView.m`): `css_reset` no longer nils `renderActions`; `drawRect` copies the array, `removeAllObjects`, then replays the snapshot (same consume-then-clear semantics). - **OHOS** (`KRCanvasView.cpp`): `Reset()` no longer clears `ops_`; `OnDraw` clears it after the `for_each` replay. - **KMP** (`CanvasView.kt`):   - new `redraw()` API so callers that set `drawCallback` dynamically can trigger a draw outside `createRenderView`/`setFrameToRenderView`;   - `draw()` falls back to `lastRenderFrame` when flex `layoutFrame` is still default, so a reset+refill is not silently skipped due to missing size (`isLayoutFrameDefault()` exposed for callers).  ## Test  Verified on iOS (iPhone 17 Pr
  **Post-Mortem & Fix Analysis**:
  > 补充一个最小代码示例，说明这个白屏 bug 的触发机制（以 Android 为例，三端同构）。  PR #1268 之后，JS 侧的 canvas 绘制不是立即执行，而是先排入原生队列，由下一次 draw 回调统一回放：  ```kotlin // JS 调 reset() → 原生立即清空队列（#1268 之后的行为） private fun reset() {     drawOperationList.clear()          // ← 问题点：上一帧排好的指令被直接丢弃     currentDrawStyle = DrawStyle(...) }  // draw tick 到达时回放队列 private fun performDrawOperationList(canvas: Canvas) {     for (op in drawOperationList) {         op.draw(paint, canvas)         // 队列里有几条就画几条     } } ```  触发时序（连续布局测算 / 未挂窗连续重绘下稳定复现）：  ``` t1  JS: 画指令 op1..op101 入队        → 队列 = [op1..op101] t2  JS: reset()                      → 队列 = []        ← 101 条指令被丢 t3  VSYNC/display tick 到达          → onDraw 回放空队列 → 画出一帧纯空白 t4  JS: 重填新指令                    → 队列 = [op'1..]   ← 太晚，白帧已上屏 ```  只要 t3 落在 t2 和 t4 之间，画布就会闪白；在"上一轮指令未消费就 reset"的场景下是 100% 空白。  本 PR 的修法是把"清空"挪到消费点：reset 只重置样式不动队列，`performDrawOperationList` 回放完才 `clear()`，保证队列要么被完整消费、要么继续等下一次 draw，永远不会在 draw tick 上消费到空队列。  实际验证（iPhone 17 Pro 模拟器）：修复前 reset 序列丢弃约 101 条待回放指令、onDraw 消费 ops
  > @bytemain 你好，感谢PR！关于reset导致白屏，能否提供一个复现demo？跨端层的reset虽然单独通过callMethod发送，但render侧的指令调度uiScheduler会在同一个时间片执行，理论上不会被onDraw截断。
  > 感谢 review 与质疑——你们是对的，这个 PR 撤回。  **你们的判断成立**：在纯 Kuikly DSL 下，`reset` 与重填经 uiScheduler 在同一时间片执行，`onDraw` 截不进来。我们两端探针后来抓到的真实时序是「reset → 重填 → **又一次 reset 但没有重填** → onDraw」，即存在第三个孤儿 reset 调用点，而它不在渲染层。  **根因在我们 Compose 混用侧**：`KuiklyCanvas`（compose 模块）的 `view` setter 在 Compose 绘制遍历中无条件补发一次 `callMethod("reset", "")`。当 `CanvasView` 由 `MakeKuiklyComposeNode` 混用且自注册 `drawCallback` 时，绘制指令由 drawCallback 自行管理（reset+重填同批），Compose 的裸 reset 把已下发队列清掉 → 空白。本 PR 的「消费后清空」把该洞盖住，但同时把 CanvasView 变成单次消费视图，引入系统重绘（切 tab/HOME 暖回）空白的新回归。  **我们的落地修复**（fork 内，已验证链路上）：revert 本 PR 同型改动 + `KuiklyCanvas.view` setter 在 `drawCallback != null` 时跳过裸 reset。  **给上游的一个真问题**：上游主干 `KuiklyCanvas.kt` 的 setter 同样无条件发裸 reset（约 L79），任何 `MakeKuiklyComposeNode<CanvasView>` + drawCallback 的混用场景都会踩中。我们验证通过后会给上游提一个只含 setter 护栏的 PR，附两端时序日志。 

- **Issue #1758** (2026-09-23): **feat(demo): add chat bubble demo(左滑删除)**
  *Symptoms*: 

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

### Incident Patch 1: `18252bca` (2026-09-24)
**Commit Message**: fix: preserve Android shadows beyond view bounds (#1760)

**File**: `core-render-android/src/main/java/com/tencent/kuikly/core/render/android/css/ktx/KRCSSViewExtension.kt` (modified, +6/-0)
```diff
@@ -552,6 +552,12 @@ private var View.boxShadow: String?
         val viewDecorator = obtainViewDecorator()
         viewDecorator.boxShadow = value ?: KRCssConst.EMPTY_STRING
         if (KuiklyRenderView.lazyClipChildren && viewDecorator.hasBoxShadow) {
+            // View 已挂载时，若直接父容器不需要裁剪内容，则立即关闭其 clipChildren。
+            (parent as? ViewGroup)?.also { parentView ->
+                if (parentView.clipChildren && !parentView.shouldClipContent) {
+                    parentView.clipChildren = false
+                }
+            }
             parent?.setContentOverBounds()
         }
     }
```

---

### Incident Patch 2: `81faec34` (2026-09-22)
**Commit Message**: fix: adapt iOS and macOS builds for Xcode 27 minimum deployment targets (#1753)

* fix: adapt iOS and macOS builds for Xcode 27 minimum deployment targets

Signed-off-by: valoxbwang <[REDACTED_EMAIL]>

* fix: rollback update in podfile and improve docs description

Signed-off-by: valoxbwang <[REDACTED_EMAIL]>

* docs: restore pod install step and refine Xcode 27 notes

- restore the pod install --repo-update step in the CocoaPods guide, which was replaced by the Xcode 27 warning block
- note the MD5 to SHA256 output length change (32 to 64 chars) in TODO comments to avoid silent truncation when migrating

Signed-off-by: valoxbwang <[REDACTED_EMAIL]>

* docs: update Xcode 27 notes

Signed-off-by: valoxbwang <[REDACTED_EMAIL]>

* docs: fix dangling step reference and stale cross-link title

- clarify step 2 wording after the Xcode 27 warning block was moved below it
- update the cross-reference to match the renamed warning section

Signed-off-by: valoxbwang <[REDACTED_EMAIL]>

---------

Signed-off-by: valoxbwang <[REDACTED_EMAIL]>

**File**: `core-render-ios/Extension/AdvancedComps/KRActivityIndicatorView.m` (modified, +8/-0)
```diff
@@ -29,7 +29,11 @@ - (instancetype)initWithFrame:(CGRect)frame {
     if ([super initWithFrame:frame]) {
         self.backgroundColor = [UIColor clearColor];
 #if !TARGET_OS_OSX // [macOS]
+        // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIActivityIndicatorViewStyleWhite/Gray → StyleMedium + color
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
         self.activityIndicatorViewStyle = UIActivityIndicatorViewStyleWhite;
+#pragma clang diagnostic pop
 #else // [macOS
         self.activityIndicatorViewStyle = UIActivityIndicatorViewStyleMedium;
         self.color = [UIColor whiteColor];
@@ -52,11 +56,15 @@ - (void)hrv_setPropWithKey:(NSString * _Nonnull)propKey propValue:(id _Nonnull)p
 - (void)setCss_style:(NSString *)css_style {
     _css_style = css_style;
 #if !TARGET_OS_OSX // [macOS]
+    // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIActivityIndicatorViewStyleWhite/Gray → StyleMedium + color
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
     if ([css_style isEqualToString:@"white"]) {
         self.activityIndicatorViewStyle = UIActivityIndicatorViewStyleWhite;
     } else {
         self.activityIndicatorViewStyle = UIActivityIndicatorViewStyleGray;
     }
+#pragma clang diagnostic pop
 #else // [macOS
     // macOS: Use color property instead of style to set white/gray appearance
     if ([css_style isEqualToString:@"white"]) {
```

**File**: `core-render-ios/Extension/AdvancedComps/KRModalView.m` (modified, +4/-0)
```diff
@@ -42,7 +42,11 @@ - (void)didMoveToSuperview {
 #if !TARGET_OS_OSX // [macOS]
     if (self.superview && ![self.superview isKindOfClass:[UIWindow class]]) {
        
+        // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIApplication.keyWindow → UIWindowScene.windows 取 isKeyWindow
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
         UIWindow *keyWindow = [UIApplication sharedApplication].keyWindow;
+#pragma clang diagnostic pop
         if (keyWindow) {
             [self removeFromSuperview];
             
```

**File**: `core-render-ios/Extension/Category/KRConvertUtil.m` (modified, +12/-1)
```diff
@@ -665,7 +665,11 @@ + (void)hr_alertWithTitle:(NSString *)title message:(NSString *)message {
 + (NSString *)hr_md5StringWithString:(NSString *)string {
     const char *cstr = [string UTF8String];
     unsigned char result[16];
+    // XCODE27-TODO(deprecated): [临时规避，后续迁移] CC_MD5 → CC_SHA256（输出 32→64 字符，需核对按长度解析的调用方；需同步处理 PAG / APNG 缓存文件兼容）
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
     CC_MD5(cstr, (CC_LONG)strlen(cstr), result);
+#pragma clang diagnostic pop
     
     return [NSString stringWithFormat:@"%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X",
             result[0], result[1], result[2], result[3],
@@ -688,7 +692,11 @@ + (CGFloat)statusBarHeight {
             }
         }
         if (!statusBarHeight) {
+            // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIApplication.statusBarFrame → UIWindowScene.statusBarManager.statusBarFrame
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
             statusBarHeight = UIApplication.sharedApplication.statusBarFrame.size.height;
+#pragma clang diagnostic pop
         }
     }
     if (@available(iOS 16.0, *)) {
@@ -807,8 +815,11 @@ + (UIWindow *)keyWindow {
         }
 
     } else {
-        // iOS 13 以下使用旧的 API
+        // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIApplication.keyWindow → UIWindowScene.windows 取 isKeyWindow
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
         keyWindow = UIApplication.sharedApplication.keyWindow;
+#pragma clang diagnostic pop
     }
     // 未获取到交互scene 或者 未找到Keywindow，则直接返回nil，准备使用全零的safeAreaInsets
     return keyWindow;
```

**File**: `core-render-ios/Extension/Category/NSObject+KR.m` (modified, +8/-0)
```diff
@@ -275,7 +275,11 @@ - (NSString *)kr_appendUrlEncodeWithParam:(NSDictionary *)param {
 - (NSString *)kr_md5String {
     const char *cstr = [self UTF8String];
     unsigned char result[16];
+    // XCODE27-TODO(deprecated): [临时规避，后续迁移] CC_MD5 → CC_SHA256（输出 32→64 字符，kr_md5String32 等按 32 字符解析处需一并核对；需同步处理缓存 / 签名兼容）
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
     CC_MD5(cstr, (CC_LONG)strlen(cstr), result);
+#pragma clang diagnostic pop
     
     return [NSString stringWithFormat:@"%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X%02X",
             result[0], result[1], result[2], result[3],
@@ -288,7 +292,11 @@ - (NSString *)kr_md5String {
 - (NSString *)kr_md5String32 {
     const char *cstr = [self UTF8String];
     unsigned char result[16];
+    // XCODE27-TODO(deprecated): [临时规避，后续迁移] CC_MD5 → CC_SHA256（输出 32→64 字符，kr_md5String32 等按 32 字符解析处需一并核对；需同步处理缓存 / 签名兼容）
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
     CC_MD5(cstr, (CC_LONG)strlen(cstr), result);
+#pragma clang diagnostic pop
     
     return [NSString stringWithFormat:@"%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x",
             result[0], result[1], result[2], result[3],
```

**File**: `core-render-ios/Extension/Category/UIView+CSS.m` (modified, +4/-0)
```diff
@@ -1973,7 +1973,11 @@ - (BOOL)performKeyFrameAnimationsWithCompletion:(void (^)(BOOL finished))complet
             [animations enumerateObjectsUsingBlock:^(id  _Nonnull obj, NSUInteger idx, BOOL * _Nonnull stop) {
                 dispatch_block_t block = obj;
                 if (!self.isNativeV2) {
+                    // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIView.setAnimationCurve: → block-based animation API
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
                     [UIView setAnimationCurve:animationCurve]; // 设置动画曲线
+#pragma clang diagnostic pop
                 }
                 block();
             }];
```

**File**: `docs/QuickStart/iOS.md` (modified, +10/-1)
```diff
@@ -36,7 +36,12 @@ end
 * 版本号需要和[KMP跨端工程](common.md)保持一致
 :::
 
-2. 执行``pod install --repo-update``安装依赖
+2. 完成第 1 步后，执行``pod install --repo-update``安装依赖
+
+:::: warning Xcode 27 之后的版本pod后需要额外关注SDK的配置
+- 从 Xcode 27 起，iOS SDK 支持的最低部署目标提升为 **15.0**，因此运行前需要调整所有库的 iOS Deployment Target 字段。
+- Macos 也在 Xcode 27 有了 SDK 版本限制，同 iOS 的操作，需要在运行前将所有库的 Macos Deployment Target 字段调整为 **12.0**。
+::::
 
 ---
 
@@ -588,6 +593,10 @@ end
 
 ```
 
+:::: tip 提示
+若使用 Xcode 27 及以上版本，请参照上文「Xcode 27 之后的版本pod后需要额外关注SDK的配置」一节，将宿主 App target 与 Pods 中各 target 的 iOS Deployment Target 均设为 15.0 或更高。
+::::
+
 重新执行``pod install``安装依赖
 
 ## 编写TestPage验证
```

**File**: `iosApp/iosApp/KuiklyRenderExpand/Controller/NativeAppWaterfallViewController.m` (modified, +8/-0)
```diff
@@ -437,7 +437,11 @@ - (void)setupSearchBar {
         UIWindowScene *scene = (UIWindowScene *)UIApplication.sharedApplication.connectedScenes.allObjects.firstObject;
         statusBarHeight = scene.statusBarManager.statusBarFrame.size.height;
     } else {
+        // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIApplication.statusBarFrame → UIWindowScene.statusBarManager.statusBarFrame
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
         statusBarHeight = UIApplication.sharedApplication.statusBarFrame.size.height;
+#pragma clang diagnostic pop
     }
     CGFloat navHeight = self.navigationController.navigationBar.frame.size.height;
     CGFloat topOffset = statusBarHeight + navHeight;
@@ -465,7 +469,11 @@ - (void)setupCollectionView {
         UIWindowScene *scene = (UIWindowScene *)UIApplication.sharedApplication.connectedScenes.allObjects.firstObject;
         statusBarHeight = scene.statusBarManager.statusBarFrame.size.height;
     } else {
+        // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIApplication.statusBarFrame → UIWindowScene.statusBarManager.statusBarFrame
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
         statusBarHeight = UIApplication.sharedApplication.statusBarFrame.size.height;
+#pragma clang diagnostic pop
     }
     CGFloat navHeight = self.navigationController.navigationBar.frame.size.height;
     CGFloat topOffset = statusBarHeight + navHeight + kSearchBarHeight;
```

**File**: `iosApp/iosApp/KuiklyRenderExpand/Controller/RootViewController.m` (modified, +4/-0)
```diff
@@ -55,7 +55,11 @@ - (void)gotoxx {
 }
 
 - (void)dismiss {
+    // XCODE27-TODO(deprecated): [临时规避，后续迁移] UIApplication.keyWindow → UIWindowScene.windows 取 isKeyWindow
+#pragma clang diagnostic push
+#pragma clang diagnostic ignored "-Wdeprecated-declarations"
     id rootVC = [[[UIApplication sharedApplication] keyWindow] rootViewController];
+#pragma clang diagnostic pop
     [rootVC dismissViewControllerAnimated:YES completion:nil];
 }
 
```

---

### Incident Patch 3: `78b11da6` (2026-09-21)
**Commit Message**: fix(h5): fix h5 jsValueToKotlin outlinedJsCode error for kotlin 1.9.22

**File**: `core-render-web/h5/src/jsMain/kotlin/com/tencent/kuikly/core/render/web/runtime/web/expand/JSHelper.kt` (modified, +38/-14)
```diff
@@ -34,6 +34,34 @@ fun createSizeI(width: Int, height: Int): SizeI = Pair(width, height)
 @JsName("emptyList")
 fun emptyListForJs(): List<Any> = emptyList()
 
+/**
+ * Internal helpers wrapping raw `js(...)` calls.
+ *
+ * IMPORTANT: Do NOT inline `js(...)` blocks inside functions annotated with
+ * `@JsExport`. Kotlin/JS 1.9.22 has a known code-gen bug: when an exported
+ * function body contains multiple `js(...)` blocks, the compiler outlines
+ * them into a helper (e.g. `jsValueToKotlin$outlinedJsCode$`) but sometimes
+ * DCE's the helper definition while still emitting the module-level export
+ * assignment referencing it, producing runtime `ReferenceError:
+ * jsValueToKotlin$outlinedJsCode$ is not defined` when the bundle loads.
+ *
+ * Wrapping each `js(...)` block in a private, non-`@JsExport` function keeps
+ * exported function bodies free of raw `js(...)` and avoids the outlining
+ * path entirely.
+ */
+private fun newEmptyJsObject(): dynamic = js("({})")
+
+private fun isJsArray(value: dynamic): Boolean = js("Array.isArray(value)").unsafeCast<Boolean>()
+
+private fun jsObjectOwnKeys(value: dynamic): Array<String> =
+    js("Object.keys(value)").unsafeCast<Array<String>>()
+
+private fun hasImageProcessorRequiredMethods(jsProcessor: dynamic): Boolean {
+    return jsTypeOf(jsProcessor.getImageAssetsSource) == "function" &&
+        jsTypeOf(jsProcessor.isSVGFilterSupported) == "function" &&
+        jsTypeOf(jsProcessor.applyTintColor) == "function"
+}
+
 /**
  * Convert a JS object to a Kotlin Map.
  *
@@ -49,7 +77,7 @@ fun jsObjectToMap(jsObject: Any?, keys: Array<String> = emptyArray()): MutableMa
     return if (converted is MutableMap<*, *>) {
         converted.unsafeCast<MutableMap<String, Any?>>()
     } else {
-        FastMutableMap<String, Any?>(js("({})"))
+        FastMutableMap<String, Any?>(newEmptyJsObject())
     }
 }
 
@@ -69,6 +97,10 @@ fun jsArrayToList(jsArray: Array<Any?>): List<Any?> {
  * - JS Object => Kotlin MutableMap<String, Any?>
  * - JS Array  => Kotlin List<Any?>
  * - Primitive => unchanged
+ *
+ * NOTE: All `js(...)` blocks are intentionally delegated to the private
+ * helpers above to avoid a Kotlin/JS 1.9.22 code-gen bug on `@JsExport`
+ * functions (see comment on `newEmptyJsObject`).
  */
 @JsExport
 @JsName("jsValueToKotlin")
@@ -78,19 +110,17 @@ fun jsValueToKotlin(value: Any?): Any? {
     }
 
     val dynamicValue = value.asDynamic()
-    val jsType = js("typeof dynamicValue") as String
-    if (jsType != "object") {
+    if (jsTypeOf(dynamicValue) != "object") {
         return value
     }
 
-    val isArray = js("Array.isArray(dynamicValue)") as Boolean
-    if (isArray) {
+    if (isJsArray(dynamicValue)) {
         val arrayValue = dynamicValue.unsafeCast<Array<Any?>>()
         return jsArrayToList(arrayValue)
     }
 
-    val map = FastMutableMap<String, Any?>(js("({})"))
-    val keys = js("Object.keys(dynamicValue)").unsafeCast<Array<String>>()
+    val map = FastMutableMap<String, Any?>(newEmptyJsObject())
+    val keys = jsObjectOwnKeys(dynamicValue)
     keys.forEach { key ->
         map[key] = jsValueToKotlin(dynamicValue[key])
     }
@@ -135,13 +165,7 @@ fun setImageProcessor(imageProcessor: Any?): Boolean {
     }
 
     val jsProcessor = imageProcessor.asDynamic()
-    val hasRequiredMethods = js(
-        "typeof jsProcessor.getImageAssetsSource === 'function'" +
-            " && typeof jsProcessor.isSVGFilterSupported === 'function'" +
-            " && typeof jsProcessor.applyTintColor === 'function'"
-    ) as Boolean
-
-    if (!hasRequiredMethods) {
+    if (!hasImageProcessorRequiredMethods(jsProcessor)) {
         return false
     }
 
```

---

### Incident Patch 4: `914e194c` (2026-09-20)
**Commit Message**: fix(h5): fix expand anim auto collapse bug

**File**: `core-render-web/base/src/jsMain/kotlin/com/tencent/kuikly/core/render/web/css/animation/KRCSSPlainAnimationHandler.kt` (modified, +15/-7)
```diff
@@ -6,6 +6,7 @@ import com.tencent.kuikly.core.render.web.collection.map.set
 import com.tencent.kuikly.core.render.web.ktx.Frame
 import com.tencent.kuikly.core.render.web.const.KRCssConst
 import com.tencent.kuikly.core.render.web.ktx.kuiklyAnimation
+import com.tencent.kuikly.core.render.web.ktx.kuiklyWindow
 import com.tencent.kuikly.core.render.web.ktx.toPercentage
 import com.tencent.kuikly.core.render.web.ktx.toRgbColor
 import org.w3c.dom.HTMLElement
@@ -90,18 +91,25 @@ class KRCSSPlainAnimationHandler(
                 KRCssConst.FRAME -> {
                     val frameValue = value.unsafeCast<Frame>()
                     // Guard against stale animation entries: if the animation transitioned normally,
-                    // by the time transitionend fires the style.left/top/width/height already equal
+                    // by the time transitionend fires the effective left/top/width/height already equal
                     // the finalValue. If they differ by more than a small threshold, this handler is
                     // a stale residue (e.g. its element was off-screen so transitionend never fired
                     // for this animation, and a later transitionend consumed the wrong queue entry).
                     // Writing the outdated finalValue would clobber the correct current style set by
                     // a newer animation. Skip in that case.
-                    val style = target?.style
-                    if (style != null) {
-                        val curLeft = style.left.removeSuffix("px").toDoubleOrNull()
-                        val curTop = style.top.removeSuffix("px").toDoubleOrNull()
-                        val curWidth = style.width.removeSuffix("px").toDoubleOrNull()
-                        val curHeight = style.height.removeSuffix("px").toDoubleOrNull()
+                    val currentTarget = target
+                    val style = currentTarget?.style
+                    if (style != null && currentTarget != null) {
+                        val computed = kuiklyWindow.getComputedStyle(currentTarget)
+                        fun readPx(primary: String?, fallback: String?): Double? {
+                            return primary?.removeSuffix("px")?.toDoubleOrNull()
+                                ?: fallback?.removeSuffix("px")?.toDoubleOrNull()
+                        }
+
+                        val curLeft = readPx(computed.left, style.left)
+                        val curTop = readPx(computed.top, style.top)
+                        val curWidth = readPx(computed.width, style.width)
+                        val curHeight = readPx(computed.height, style.height)
                         val threshold = 1.0
                         val isStale = (curLeft != null && kotlin.math.abs(curLeft - frameValue.x) > threshold) ||
                             (curTop != null && kotlin.math.abs(curTop - frameValue.y) > threshold) ||
```

**File**: `demo/src/commonMain/kotlin/com/tencent/kuikly/demo/pages/demo/FrameStaleDropdownPage.kt` (added, +192/-0)
```diff
@@ -0,0 +1,192 @@
+/*
+ * Tencent is pleased to support the open source community by making KuiklyUI
+ * available.
+ * Copyright (C) 2025 Tencent. All rights reserved.
+ * Licensed under the License of KuiklyUI;
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package com.tencent.kuikly.demo.pages.demo
+
+import com.tencent.kuikly.core.annotations.Page
+import com.tencent.kuikly.core.base.Animation
+import com.tencent.kuikly.core.base.Color
+import com.tencent.kuikly.core.base.ViewBuilder
+import com.tencent.kuikly.core.reactive.handler.observable
+import com.tencent.kuikly.core.views.Text
+import com.tencent.kuikly.core.views.View
+import com.tencent.kuikly.demo.pages.base.BasePager
+import com.tencent.kuikly.demo.pages.demo.base.NavBar
+
+@Page("FrameStaleDropdownPage")
+internal class FrameStaleDropdownPage : BasePager() {
+
+    private var expanded by observable(false)
+    private var toggleSeq by observable(0)
+    private var statusText by observable("Ready. Tap button to expand from 0px to 212px.")
+
+    override fun body(): ViewBuilder {
+        val ctx = this
+        return {
+            NavBar {
+                attr {
+                    title = "Frame Stale Repro"
+                }
+            }
+
+            View {
+                attr {
+                    flex(1f)
+                    backgroundColor(Color(0xFFF5F6FA))
+                    padding(16f)
+                }
+
+                Text {
+                    attr {
+                        text("Repro target: dropdown height animation 0px -> 212px")
+                        fontSize(14f)
+                        color(Color(0xFF333333))
+                    }
+                }
+
+                Text {
+                    attr {
+                        marginTop(8f)
+                        text("In H5 with stale-check enabled, first expand may flash and collapse after transitionend.")
+                        fontSize(12f)
+                        color(Color(0xFF666666))
+                    }
+                }
+
+                View {
+                    attr {
+                        marginTop(16f)
+                        padding(left = 12f, top = 10f, right = 12f, bottom = 10f)
+                        backgroundColor(Color(0xFF1677FF))
+                        borderRadius(8f)
+                    }
+                    event {
+                        click {
+                            ctx.expanded = !ctx.expanded
+                            ctx.toggleSeq++
+                            ctx.statusText = if (ctx.expanded) {
+                                "Expanding to 212px (toggle #${ctx.toggleSeq})"
+                            } else {
+                                "Collapsing to 0px (toggle #${ctx.toggleSeq})"
+                            }
+                        }
+                    }
+
+                    Text {
+                        attr {
+                            text(if (ctx.expanded) "Collapse" else "Expand")
+                            color(Color.WHITE)
+                            fontSize(14f)
+                        }
+                    }
+                }
+
+                View {
+                    attr {
+                        marginTop(12f)
+                        width(320f)
+                        height(if (ctx.expanded) 212f else 0f)
+                        backgroundColor(Color.WHITE)
+                        borderRadius(10f)
+                        overflow(true)
+                        animate(
+                            animation = Animation.linear(durationS = 0.35f, key = "dropdown-height"),
+                            value = ctx.expanded
+                        )
+                    }
+                    event {
+                        animationCompletion {
+                            if (it.animationKey == "dropdown-height") {
+                                ctx.statusText = "Animation finished. Expected inline height=212px when expanded."
+                            }
+                        }
+                    }
+
+                    Text {
+                        attr {
+                            margin(left = 12f, top = 12f)
+                            text("Dropdown content")
+                            color(Color(0xFF222222))
+                            fontSize(15f)
+                        }
+                    }
+
+                    Text {
+                        attr {
+                            margin(left = 12f, top = 40f)
+                            t
```

---

### Incident Patch 5: `b132ea70` (2026-09-20)
**Commit Message**: fix(ios): implicit animation issue during border scaling (#1749)

fix(ios): implicit animation issue during border scaling (#1749)

**File**: `core-render-ios/Extension/Category/UIView+CSS.m` (modified, +11/-0)
```diff
@@ -837,6 +837,10 @@ - (void)setCss_frame:(NSValue *)css_frame {
 }
 
 - (void)p_boundsDidChanged {
+    // 圆角 / clipPath mask 也是手动挂上去的独立 CAShapeLayer（CSSShapeLayer 在 setFrame: 里同步重算 path），
+    // 同样不享受 UIView backing layer 的隐式动画屏蔽，属性变更会走 CA 默认的 0.25s，这里统一禁掉
+    [CATransaction begin];
+    [CATransaction setDisableActions:YES];
     [self.layer.mask setFrame:self.bounds];
     if (self.layer.shadowPath) {
         // 如果存在 clipPath，shadowPath 应该使用 clipPath 的路径
@@ -861,6 +865,7 @@ - (void)p_boundsDidChanged {
             #endif // [macOS]
         }
     }
+    [CATransaction commit];
 }
 
 /// 对齐安卓圆角最大为半圆
@@ -1575,6 +1580,10 @@ - (void)setNeedsRedraw {
  */
 - (void)layoutSublayers {
     [super layoutSublayers];
+    // 边框 layer 是手动 addSublayer 的独立 CAShapeLayer，属性变更默认会带 0.25s 的隐式动画，
+    // 这里统一禁用，让边框与内容在同一帧到位
+    [CATransaction begin];
+    [CATransaction setDisableActions:YES];
     
     // 0. macOS: 确保边框在最顶层（NSScrollView/NSTextView 内部 sublayer 可能覆盖边框）
 #if TARGET_OS_OSX
@@ -1596,6 +1605,7 @@ - (void)layoutSublayers {
     // 2. 尺寸未变化时跳过重绘（性能优化）或者重绘标志位为false
     // 仅在 clipPath 变化时为 YES）
     if (CGSizeEqualToSize(self.bounds.size, _lastSize) && !_needsRedraw) {
+        [CATransaction commit];
         return ;
     }
     _lastSize = self.bounds.size;
@@ -1661,6 +1671,7 @@ - (void)layoutSublayers {
     #else
     self.path = path.CGPath;
     #endif
+    [CATransaction commit];
 }
 
 @end
```

**File**: `demo/src/commonMain/kotlin/com/tencent/kuikly/demo/pages/debug/BugReproBorderImplicitAnimationPage.kt` (added, +327/-0)
```diff
@@ -0,0 +1,327 @@
+/*
+ * Tencent is pleased to support the open source community by making KuiklyUI
+ * available.
+ * Copyright (C) 2025 Tencent. All rights reserved.
+ * Licensed under the License of KuiklyUI;
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package com.tencent.kuikly.demo.pages.debug
+
+import com.tencent.kuikly.core.annotations.Page
+import com.tencent.kuikly.core.base.Border
+import com.tencent.kuikly.core.base.BorderStyle
+import com.tencent.kuikly.core.base.Color
+import com.tencent.kuikly.core.base.ViewBuilder
+import com.tencent.kuikly.core.base.ViewContainer
+import com.tencent.kuikly.core.reactive.handler.observable
+import com.tencent.kuikly.core.timer.setTimeout
+import com.tencent.kuikly.core.views.List
+import com.tencent.kuikly.core.views.Text
+import com.tencent.kuikly.core.views.View
+import com.tencent.kuikly.demo.pages.base.BasePager
+import com.tencent.kuikly.demo.pages.demo.base.NavBar
+
+/**
+ * iOS 边框隐式动画复现页（border + 变更 frame）
+ *
+ * 现象：同一个 View 实例声明 border 后，只要改变它的 frame（size），iOS 上背景/内容与边框不同帧跳变，
+ *      边框会带着一段约 0.25s 的隐式动画"滑"到新位置；胶囊形态下上下边框的粗细会在过程中不一致，
+ *      看起来像边框在蠕动（业务截图即该现象）。
+ *
+ * 框架侧可疑点（core-render-ios/Extension/Category/UIView+CSS.m）：
+ * 1. CSSBorderLayer.layoutSublayers(:1576) 中同步 frame(:1593)、重设 path(:1662)、
+ *    lineWidth(:1634) 全部没有 CATransaction 保护；同文件的 CSSGradientLayer.layoutSublayers(:1439)
+ *    与 CSSBorderLayer 的 macOS 分支(:1582) 都有 [CATransaction setDisableActions:YES]。
+ * 2. CSSBorderLayer 是手动 addSublayer 到 view.layer 上的独立 CAShapeLayer(:447)，
+ *    不享受 UIView backing layer（backing layer 的隐式动画被 UIKit 屏蔽）的待遇。
+ * 3. setCss_frame(:801) 只在「已有 animationKeys 且 transform 非 identity」分支里用
+ *    performWithoutAnimation / setDisableActions，普通路径(:834) 直接 setFrameBlock()。
+ *
+ * 观测方法（本页 4 个 case 共用同一个 expanded 状态，方便一次切换同时对比）：
+ * - Case 1 圆角矩形：看边框是否与白色背景同帧跳变（正常应为瞬变，异常为 0.25s 缓动滑移）。
+ * - Case 2 胶囊：圆角随高度变化，最接近业务截图，重点看上下边框粗细中途是否不对称。
+ * - Case 3 业务同款：胶囊 + 小幅纵向变化 + 1pt 级边框，重点看上下粗细蠕动。
+ * - Case 4 对照组：不使用 border 属性，用嵌套 View 模拟描边，应始终与背景同帧跳变。
+ *
+ * 说明：本页只覆盖「无动画直接改 frame」的隐式动画场景；业务声明 animate 的显式动画场景
+ *      属于另一条链路，暂不在本页验证。
+ */
+@Page("BugReproBorderImplicitAnimationPage")
+internal class BugReproBorderImplicitAnimationPage : BasePager() {
+
+    /** false = 收起态，true = 展开态 */
+    private var expanded by observable(false)
+
+    /** 自动循环切换，便于肉眼/录屏观察；进入页面即开启，可用「重置」停止 */
+    private var autoLoop by observable(true)
+
+    /** 循环是否真的切换过至少一次（用于判断 pageDidAppear 是否需要补调度） */
+    private var loopToggled = false
+
+    override fun created() {
+        super.created()
+        scheduleAutoLoop()
+    }
+
+    override fun pageDidAppear() {
+        super.pageDidAppear()
+        // Android 上 created 阶段 setTimeout 尚未生效，页面出现后若循环还没跑起来则补一次调度
+        if (autoLoop && !loopToggled) {
+            scheduleAutoLoop()
+        }
+    }
+
+    override fun pageDidDisappear() {
+        super.pageDidDisappear()
+        autoLoop = false
+    }
+
+    override fun body(): ViewBuilder {
+        val ctx = this
+        return {
+            attr {
+                flexDirectionColumn()
+                backgroundColor(Color(0xFFF2F3F5L))
+            }
+            NavBar {
+                attr {
+                    title = "iOS Border 隐式动画复现"
+                }
+            }
+            List {
+                attr {
+                    flex(1f)
+                }
+
+                View {
+                    attr {
+                        padding(all = 12f)
+                        flexDirectionColumn()
+                    }
+                    title("现象与判定标准")
+                    hint("同一个 View 声明 border 后只改 size，背景色块会立刻跳变，而边框会带约 0.25s 缓动滑过去。")
+                    hint("判定：切换尺寸时边框与背景「不同帧到位」= 异常；上下边框粗细中途不一致 = 异常。")
+                    hint("Android / OHOS 无此现象，可与 iOS 直接对比。")
+                }
+
+                View {
+                    attr {
+                        margin(left = 12f, right = 12f)
+                        padding(all = 10f)
+                        borderRadius(8f)
+                        backgroundColor(Color.WHITE)
+                        flexDirectionColumn()
+                    }
+                    title("操作")
+                    hint("当前状态：${if (ctx.expanded) "展开态" else "收起态"}    自动循环：${if (ctx.autoLoop) "开" else "关"}")
+                    View {
+                        attr {
+                            marginTop(8f)
+                            flexDirectionRow()
+                        }
+                        actionButton("切换尺寸", Color(0xFF0F62FEL)) {
+         
```

---

### Incident Patch 6: `93ab53a3` (2026-09-19)
**Commit Message**: fix(web): 修复单行 textOverFlowTail 不显示省略号

KRRichTextView.setLineBreakMode 在 numberOfLines > 0 时提前返回，lines(1) + textOverFlowTail() 不会设置 overflow hidden，text-overflow: ellipsis 在 overflow 为 visible 时不生效，文本直接溢出。改为 > 1 后单行走 tail 分支设置 overflow/nowrap/ellipsis，多行仍由 -webkit-line-clamp 处理。

**File**: `core-render-web/base/src/jsMain/kotlin/com/tencent/kuikly/core/render/web/expand/components/KRRichTextView.kt` (modified, +1/-1)
```diff
@@ -424,7 +424,7 @@ class KRRichTextView : IKuiklyRenderViewExport, IKuiklyRenderShadowExport {
      * Set text wrapping mode
      */
     private fun setLineBreakMode(lineBreakMode: String) {
-        if (this.numberOfLines > 0) {
+        if (this.numberOfLines > 1) {
             return
         }
         when (lineBreakMode) {
```

---

### Incident Patch 7: `c985faa0` (2026-09-18)
**Commit Message**: fix(iOS): keep text alignment when rebuilding attributedText in KRTextAreaView (#1745)

* fix(iOS): keep text alignment when rebuilding attributedText in KRTextAreaView

- Reapply paragraph style at all attributedText rebuild paths (textInputState, paste, textPostProcessor, lineHeight)
- Sync typingAttributes so newly typed text keeps the current alignment
- Add TextAreaTextAlignBugDemo covering Left/Center/Right alignment

* fix(iOS): avoid rebuilding attributedText during IME composition in KRTextAreaView

Signed-off-by: valoxbwang <[REDACTED_EMAIL]>

---------

Signed-off-by: valoxbwang <[REDACTED_EMAIL]>

**File**: `core-render-ios/Extension/Components/KRTextAreaView.m` (modified, +53/-5)
```diff
@@ -201,10 +201,7 @@ - (void)updateLineHeightIfApplicable {
     UIFont* font = self.font ?: [UIFont systemFontOfSize:16];
     NSMutableAttributedString *attrStr = [[NSMutableAttributedString alloc] initWithAttributedString:self.attributedText ?:
                                          [[NSAttributedString alloc] initWithString:self.text ?: @""]];
-    NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
-    paragraphStyle.minimumLineHeight = [_css_lineHeight floatValue];
-    paragraphStyle.maximumLineHeight = [_css_lineHeight floatValue];
-    paragraphStyle.lineSpacing = ceil(0.2 * _css_fontSize.floatValue);
+    NSMutableParagraphStyle *paragraphStyle = [self p_buildCurrentParagraphStyle];
 
     NSRange range = NSMakeRange(0, attrStr.length);
     [attrStr addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:range];
@@ -219,6 +216,36 @@ - (void)updateLineHeightIfApplicable {
     self.typingAttributes = typingAttrs;
 }
 
+/// 构造反映当前 textAlignment（及已设置 lineHeight）的 paragraph style，供重建路径复用。
+- (NSMutableParagraphStyle *)p_buildCurrentParagraphStyle {
+    NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
+    paragraphStyle.alignment = self.textAlignment;
+    if (_css_lineHeight.floatValue > FLT_EPSILON) {
+        paragraphStyle.minimumLineHeight = [_css_lineHeight floatValue];
+        paragraphStyle.maximumLineHeight = [_css_lineHeight floatValue];
+        paragraphStyle.lineSpacing = ceil(0.2 * _css_fontSize.floatValue);
+    }
+    return paragraphStyle;
+}
+
+/// 将当前段落样式整段应用到 attrStr，并同步 typingAttributes；后续新增任何重建
+/// attributedText 的路径都必须调用本方法，否则对齐会丢失。
+- (void)p_applyCurrentParagraphStyleToAttributedString:(NSMutableAttributedString *)attrStr {
+    NSMutableParagraphStyle *paragraphStyle = [self p_buildCurrentParagraphStyle];
+    if (attrStr.length > 0) {
+        [attrStr addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:NSMakeRange(0, attrStr.length)];
+    }
+    [self p_applyParagraphStyleToTypingAttributes:paragraphStyle];
+}
+
+/// 仅把段落样式写入 typingAttributes（不改内容）；仅覆盖 NSParagraphStyleAttributeName，
+/// 其余字段（如 lineHeight 路径写入的 font/baseline）保持不变。
+- (void)p_applyParagraphStyleToTypingAttributes:(NSParagraphStyle *)paragraphStyle {
+    NSMutableDictionary *typingAttrs = [self.typingAttributes mutableCopy] ?: [NSMutableDictionary dictionary];
+    typingAttrs[NSParagraphStyleAttributeName] = paragraphStyle;
+    self.typingAttributes = typingAttrs;
+}
+
 - (void)setCss_enablesReturnKeyAutomatically:(NSNumber *)flag{
     self.enablesReturnKeyAutomatically = [flag boolValue];
 }
@@ -282,6 +309,20 @@ - (void)setCss_editable:(NSNumber *)css_editable {
 
 - (void)setCss_textAlign:(NSString *)css_textAlign {
     self.textAlignment = [KRConvertUtil NSTextAlignment:css_textAlign];
+    // 空文本或拼音组词态：不整段重建，仅同步 typingAttributes，组词提交后自然生效。
+    if (self.attributedText.length == 0 || self.markedTextRange != nil) {
+        [self p_applyParagraphStyleToTypingAttributes:[self p_buildCurrentParagraphStyle]];
+        return;
+    }
+    // 对已有文本重新套用对齐，避免残留旧段落样式导致显示与当前设置不一致。
+    NSRange savedSelection = self.selectedRange;
+    NSMutableAttributedString *attrStr = [self.attributedText mutableCopy];
+    [self p_applyCurrentParagraphStyleToAttributedString:attrStr];
+    BOOL savedIgnore = _ignoreTextDidChanged;
+    _ignoreTextDidChanged = YES;
+    self.attributedText = attrStr;
+    self.selectedRange = savedSelection;
+    _ignoreTextDidChanged = savedIgnore;
 }
 
 - (void)setCss_fontSize:(NSNumber *)css_fontSize {
@@ -422,6 +463,7 @@ - (void)css_setTextInputState:(NSDictionary *)args {
         if (textColor) {
             [rawAttr addAttribute:NSForegroundColorAttributeName value:textColor range:NSMakeRange(0, rawAttr.length)];
         }
+        [self p_applyCurrentParagraphStyleToAttributedString:rawAttr];
         self.attributedText = rawAttr;
         [self p_updatePlaceholder];
     }
@@ -773,6 +815,7 @@ - (void)paste:(id)sender {
     if (textColor) {
         [rawAttr addAttribute:NSForegroundColorAttributeName value:textColor range:NSMakeRange(0, rawAttr.length)];
     }
+    [self p_applyCurrentParagraphStyleToAttributedString:rawAttr];
     self.attributedText = rawAttr;
     [self p_applyTextPostProcessorIfNeed];
     NSUInteger inputCursor = [self p_getInputCursorIndexWithIndex:outputCursor];
@@ -1513,11 +1556,16 @@ - (void)p_applyTextPostProcessorIfNeed {
         [processedAttr attribute:NSFontAttributeName atIndex:0 effectiveRange:&fontRange2];
     }
 
+    // processor 返回的字符串可能不带 paragraph style，重套对齐避免 emoji 输入后对齐丢失；
+    // 如未来 processor 需按段返回不同对齐，此处整段覆盖需改为按段处理。
+    NSMutableAttributedString *processedMutableAttr = [processedAttr mutableCopy];
+    [self p_applyCurrentParagraphStyleToAttributedString:processedMutableAttr];
+
     // 保存当前光标的原始文本位置
     NSUInteger outputCursor = [self p_getOutputCursorIndex];
     BOOL savedIgnore = _ignoreTextDidChanged;
     _ignoreTextDidCha
```

**File**: `demo/src/commonMain/kotlin/com/tencent/kuikly/demo/pages/compose/ComposeAllSample.kt` (modified, +1/-0)
```diff
@@ -178,6 +178,7 @@ internal class ComposeAllSample : ComposeContainer() {
             DemoItem("TextFieldEmoji", "TextField 自定义表情示例（暂不支持鸿蒙）", "TextFieldEmojiDemo"),
             DemoItem("MoveableDrawer", "侧边栏组件示例（全屏/非全屏）", "MoveableDrawerDemo"),
             DemoItem("iOS键盘InputTextField", "业务侧 InputTextField iOS 键盘复现", "IosKeyboardInputTextFieldDemo"),
+            DemoItem("TextArea对齐Bug", "iOS BasicTextField 右/居中对齐点击输入后失效复现", "TextAreaTextAlignBugDemo"),
         )
 
     @Composable
```

**File**: `demo/src/commonMain/kotlin/com/tencent/kuikly/demo/pages/compose/TextAreaTextAlignBugDemo.kt` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+/*
+ * Tencent is pleased to support the open source community by making KuiklyUI
+ * available.
+ * Copyright (C) 2025 Tencent. All rights reserved.
+ * Licensed under the License of KuiklyUI;
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package com.tencent.kuikly.demo.pages.compose
+
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.setValue
+import com.tencent.kuikly.compose.ComposeContainer
+import com.tencent.kuikly.compose.foundation.border
+import com.tencent.kuikly.compose.foundation.layout.Column
+import com.tencent.kuikly.compose.foundation.layout.fillMaxWidth
+import com.tencent.kuikly.compose.foundation.layout.height
+import com.tencent.kuikly.compose.foundation.layout.padding
+import com.tencent.kuikly.compose.foundation.text.BasicTextField
+import com.tencent.kuikly.compose.material3.Text
+import com.tencent.kuikly.compose.setContent
+import com.tencent.kuikly.compose.ui.Modifier
+import com.tencent.kuikly.compose.ui.graphics.Color
+import com.tencent.kuikly.compose.ui.text.TextStyle
+import com.tencent.kuikly.compose.ui.text.style.TextAlign
+import com.tencent.kuikly.compose.ui.unit.dp
+import com.tencent.kuikly.compose.ui.unit.sp
+import com.tencent.kuikly.core.annotations.Page
+
+/**
+ * 回归验证 iOS BasicTextField 设置 TextAlign.Right/Center 后，获焦或输入内容时对齐仍保持的能力。
+ * 验证：打开页面，点击「居中」「右对齐」输入框并输入，对齐应始终保持不回退左对齐。
+ */
+@Page("TextAreaTextAlignBugDemo")
+class TextAreaTextAlignBugDemo : ComposeContainer() {
+
+    override fun willInit() {
+        super.willInit()
+        setContent {
+            ComposeNavigationBar {
+                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
+                    Text("Left 对齐（预期：点击/输入后始终左对齐）")
+                    var textLeft by remember { mutableStateOf("Left 123456") }
+                    BasicTextField(
+                        value = textLeft,
+                        onValueChange = { textLeft = it },
+                        textStyle = TextStyle(fontSize = 18.sp, textAlign = TextAlign.Left),
+                        modifier = Modifier.fillMaxWidth().height(44.dp)
+                            .border(1.dp, Color.Black).padding(8.dp),
+                    )
+
+                    Text("Center 对齐（预期：点击/输入后始终居中）")
+                    var textCenter by remember { mutableStateOf("Center 123456") }
+                    BasicTextField(
+                        value = textCenter,
+                        onValueChange = { textCenter = it },
+                        textStyle = TextStyle(fontSize = 18.sp, textAlign = TextAlign.Center),
+                        modifier = Modifier.fillMaxWidth().height(44.dp)
+                            .border(1.dp, Color.Black).padding(8.dp),
+                    )
+
+                    Text("Right 对齐（预期：修复后点击/输入始终保持右对齐）")
+                    var textRight by remember { mutableStateOf("Right 123456") }
+                    BasicTextField(
+                        value = textRight,
+                        onValueChange = { textRight = it },
+                        textStyle = TextStyle(fontSize = 18.sp, textAlign = TextAlign.Right),
+                        modifier = Modifier.fillMaxWidth().height(44.dp)
+                            .border(1.dp, Color.Black).padding(8.dp),
+                    )
+                }
+            }
+        }
+    }
+}
```

---

### Incident Patch 8: `9a442a6c` (2026-09-14)
**Commit Message**: fix(ohos): resolve safeArea/deviceWidth data mismatch and freeze on rotation (#1721)

* fix(ohos): fix safeArea/deviceWidth data mismatch and freeze on rotation

- Sync windowRect on windowSizeChange and deliver deviceWidth/Height with
  rotation, fixing Compose screenWidthDp/screenHeightDp frozen at initial
  orientation
- Make safeArea ready synchronously without notify in windowSizeChange,
  eliminating the setTimeout(0) race against onAreaChange
- Add resolveSafeAreaInsets correction: rotation mode subtracts axis delta,
  split-screen mode drops injected side by 25% threshold, zero-bottom
  frames fall back to last reliable value
- Pre-update viewRect in onSizeChange (layout-before callback) to close
  the mismatch window
- One-line rationale log per fix (Rotation tag), zero noise on correct
  frames

Backport of ComposeOnKuikly a094be7c1

* fix(ohos): replace ratio-based safeArea correction with deterministic checks

- Replace the 25% fraction heuristic with an orientation-consistency check
  (core): when viewRect and windowRect axes mismatch, the viewRect-safeArea
  subtraction carries the axis delta by construction, so reuse the last
  trusted insets instead of guessing from

**File**: `core-render-ohos/src/main/ets/KRNativeRenderController.ets` (modified, +154/-13)
```diff
@@ -100,6 +100,11 @@ enum KRBackPressConsumedState {
   NotConsumed
 }
 
+/** safeArea 纠偏：浮点尺寸比较容差（dp） */
+const KRSafeAreaMatchToleranceDp = 1.0;
+/** safeArea 纠偏：变化量等式判定容差（dp） */
+const KRSafeAreaDeltaEps = 0.1;
+
 /** 全局递增实例ID */
 let gGlobalInstanceId = 0;
 
@@ -140,6 +145,16 @@ export class KRNativeRenderController {
    * SizeChanged 执行时机是否需提前至 onSizeChanged 而非 onAreaChanged，以避免页面 Size 变化时出现白屏
    */
   private sizeChangeHandledByOnSizeChange: boolean = false;
+  /** 上一帧窗口尺寸：突变帧注入检测（判据B）需要窗口变化量 */
+  private prevWindowRect: KRRect | null = null;
+  /** 上一帧 safeAreaRect：判据B的还原基准（稳态帧不会被注入，天然可靠） */
+  private lastSafeAreaRect: KRRect | null = null;
+  /** lastSafeAreaRect 入库时的窗口尺寸：rect 是绝对坐标，解构侧值必须用它自己同朝向的窗口，否则产生假侧值 */
+  private lastSafeAreaWinRect: KRRect | null = null;
+  /** 最近一次「viewRect 与 windowRect 同朝向」时换算出的 insets（判据A兜底值） */
+  private lastTrustedInsets: string | null = null;
+  /** viewRect 是否已跟随当前窗口重新测量：false = 窗口已变而页面未量完（判据A的拦截条件） */
+  private viewSyncedByWindow: boolean = true;
 
   private lifecycleCallbacks: Array<IKuiklyRenderViewLifecycleCallback> = [];
 
@@ -178,8 +193,16 @@ export class KRNativeRenderController {
     const w = params.width / density;
     const h = params.height / density;
 
+    // windowRect 是 deviceWidth/Height 唯一数据源，必须跟随窗口更新，否则旋转后 Compose 屏幕尺寸冻结；
+    // prevWindowRect 保留旧值，供判据B计算窗口变化量
+    this.prevWindowRect = this.windowRect;
+    this.windowRect = new KRRect(0, 0, w, h);
+    // 窗口已变而页面尚未重新测量，viewRect 旧尺寸作废（判据A拦截条件），等布局回调重新确认
+    this.viewSyncedByWindow = false;
+
     this.notifyWindowSizeChanged(w, h);
-    this.doUpdateSafeArea();
+    // 同步刷新 safeArea（不走 setTimeout），避免与布局回调竞争产生「旧 viewRect − 新 safeAreaRect」错配
+    this.refreshSafeAreaSync();
   };
   private avoidAreaListener: Callback<AvoidAreaChangeParams> = (params: AvoidAreaChangeParams) => {
     if (this.imeMode) {
@@ -192,6 +215,90 @@ export class KRNativeRenderController {
     }
   };
 
+  /**
+   * 同步刷新 safeAreaRect 但不下发：让 safeAreaRect 与 windowRect 同帧就绪，
+   * 消除 setTimeout(0) 与布局回调的时序竞争，等 viewRect 同朝向后由布局链路统一下发。
+   */
+  private refreshSafeAreaSync(): void {
+    if (this.imeMode || this.windowClass == null) {
+      return;
+    }
+    // 同步已取到最新值，取消排队中的去抖任务，避免稍后重复赋值
+    if (this.updateSafeInsetsHandler > 0) {
+      clearTimeout(this.updateSafeInsetsHandler);
+      this.updateSafeInsetsHandler = 0;
+    }
+    try {
+      const synced = this.getSafeAreaRect(this.windowClass);
+      // 判据B已下沉到 onSafeAreaInsetsChanged 入库口统一验货，此处不再单独调用
+      this.onSafeAreaInsetsChanged(synced, false, 'windowSizeChange');
+    } catch (e) {
+      KRRenderLog.e('Window', `Error obtaining safearea, code:${e.code}`);
+    }
+  }
+
+  /** 将 safeAreaRect（x/y/width/height）按给定窗口尺寸换算为 [top,left,bottom,right] 侧值 */
+  private sideInsetsOf(rect: KRRect, winW: number, winH: number): number[] {
+    const sides: number[] = [0, 0, 0, 0];
+    sides[0] = rect.y;
+    sides[1] = rect.x;
+    sides[2] = winH - rect.y - rect.height;
+    sides[3] = winW - rect.x - rect.width;
+    return sides;
+  }
+
+  /**
+   * 判据B（兜底）：注入的机理是系统把「窗口尺寸变化量」错塞进 safeArea，故注入侧必满足
+   * |本帧侧值−上帧侧值| == |本帧窗口−上帧窗口|（同轴，0.1dp）——基于 bug 机理而非数值分布判定，无比例假设。
+   * 注意：prevWindowRect 只在窗口突变帧轮换，故一次旋转后到下次旋转前本判据持续处于激活态；
+   * 稳态帧依靠 oldSides/newSides 同坐标系比较（sideDelta≈0）放行，不会误伤。
+   * 已知边界：真实避让变化量与窗口变化量恰好精确等值（±0.1dp）的巧合会被误退一帧，概率极低，作为机理层残留风险保留。
+   */
+  private correctInjectedSafeArea(newRect: KRRect, source: string): KRRect {
+    const prevWin = this.prevWindowRect;
+    const curWin = this.windowRect;
+    const prevSafe = this.lastSafeAreaRect;
+    const prevSafeWin = this.lastSafeAreaWinRect;
+    if (prevWin == null || curWin == null || prevSafe == null || prevSafeWin == null) {
+      // 首帧无从比较，直接入库并登记其所属窗口尺寸
+      this.lastSafeAreaRect = newRect;
+      this.lastSafeAreaWinRect = curWin != null
+        ? new KRRect(curWin.x, curWin.y, curWin.width, curWin.height) : null;
+      return newRect;
+    }
+    const deltaW = Math.abs(curWin.width - prevWin.width);
+    const deltaH = Math.abs(curWin.height - prevWin.height);
+    // 上帧侧值必须用「上帧 safeAreaRect 自己入库时的窗口」解构——rect 是绝对坐标，
+    // 若借用 prevWindowRect（可能仍是上一朝向）解构新朝向矩形，会解出假侧值，
+    // 使干净值与窗口变化量「精确等值」而被误判成注入（avoidAreaChange 帧误修正的根因）
+    const oldSides = this.sideInsetsOf(prevSafe, prevSafeWin.width, prevSafeWin.height);
+    const newSides = this.sideInsetsOf(newRect, curWin.width, curWin.height);
+    // top/left/bottom/right 分别锚定窗口高/宽轴
+    const windowDeltas = [deltaH, deltaW, deltaH, deltaW];
+    let corrected = false;
+    const sideDeltas: number[] = [0, 0, 0, 0];
+    for (let i = 0; i < 4; i++) {
+      if (windowDeltas[i] < KRSafeAreaMatchToleranceDp) {
+        continue; // 该轴窗口没变化，不存在注入，也不该动真实值
+      }
+      const sideDelta = Math.abs(newSides[i] - oldSides[i]);
+      sideDeltas[i] = sideDelta;
+      if (Math.abs(sideDelta - windowDeltas[i]) < KRSafeAreaDeltaEps) {
+        newSides[i] = oldSides[i];
+        corrected = true;
+      }
+    }
+    // 统一以最终入库值登记，供下一帧做同坐标系比较
+    cons
```

---

### Incident Patch 9: `acffe1be` (2026-09-14)
**Commit Message**: fix(compose): release Lazy exact contentSize pin after programmatic jump (#1741)

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `compose/src/commonMain/kotlin/com/tencent/kuikly/compose/scroller/ContentSizeExtensions.kt` (modified, +6/-1)
```diff
@@ -67,8 +67,13 @@ internal fun ScrollableState.calculateContentSize(): Int {
         // lastItem.offset is viewport-relative. After a fling reaches the last item,
         // a stale offset can inflate contentSize and skip native bounce.
         // Measure clears the pin when layout actually changes.
+        // After a programmatic jump, composeOffset can already exceed the pinned size;
+        // that pin is stale and must be released. At the true end, composeOffset is
+        // clamped to exact-viewport, so it never exceeds previousExact and the pin holds.
         if (previousExact != null && exact > previousExact && this.isLazyListOrGrid()) {
-            exact = previousExact
+            if (kuiklyInfo.composeOffset.toInt() <= previousExact) {
+                exact = previousExact
+            }
         }
         kuiklyInfo.realContentSize = exact
         return exact
```

---

### Incident Patch 10: `9197b070` (2026-09-12)
**Commit Message**: fix(h5): fix conflict of parent drag and child click (#1739)

* fix(h5): fix conflict of parent drag and child click

* fix(h5): only support single-pointer mode

**File**: `core-render-web/base/src/jsMain/kotlin/com/tencent/kuikly/core/render/web/expand/components/KRView.kt` (modified, +70/-10)
```diff
@@ -98,6 +98,13 @@ open class KRView : IKuiklyRenderViewExport {
     private var isBindTouchEvent = false
     // Whether mouse is currently pressed (for PC browser support)
     private var isMouseDown = false
+    // Pointer drag start position (relative to current element)
+    private var pointerDownX = 0f
+    private var pointerDownY = 0f
+    // Pointer currently tracked by this view
+    private var activePointerId: Int? = null
+    // Whether current pointer has been captured
+    private var isPointerCaptured = false
     // Current device type (detected once and cached)
     private val deviceType: DeviceType by lazy { DeviceUtils.detectDeviceType() }
     // Pan event callback
@@ -663,19 +670,15 @@ open class KRView : IKuiklyRenderViewExport {
     private fun bindPointerEvents() {
         // Pointer down
         ele.addEventListener("pointerdown", { rawEvent ->
+            // Single-pointer mode: ignore any additional fingers/pointers while one is active.
+            if (isMouseDown) return@addEventListener
+
             val mouseLike = rawEvent.unsafeCast<MouseEvent>()
-            // Capture pointer so we keep receiving move/up even if the finger /
-            // cursor leaves the element bounds during a drag.
-            val pointerId = rawEvent.asDynamic().pointerId
-            if (pointerId != null) {
-                try {
-                    ele.asDynamic().setPointerCapture(pointerId)
-                } catch (_: Throwable) {
-                    // Some environments may throw if pointerId is invalid; ignore.
-                }
-            }
 
             isMouseDown = true
+            isPointerCaptured = false
+            activePointerId = rawEvent.asDynamic().pointerId.unsafeCast<Int?>()
+
             val eventParams = mouseLike.toPanEventParams()
             val position = ele.getBoundingClientRect()
             eleX = position.left.toFloat()
@@ -685,6 +688,9 @@ open class KRView : IKuiklyRenderViewExport {
                 fastMutableMapOf<String, Any>().apply { putAll(eventParams) },
                 KRStateConst.START
             )
+            // Record pointer down position and defer pointer capture until drag confirmed.
+            pointerDownX = x
+            pointerDownY = y
             params = setSuperTouchEventParams(
                 params, rawEvent.timeStamp.toLong(), KRActionConst.TOUCH_DOWN
             )
@@ -696,12 +702,34 @@ open class KRView : IKuiklyRenderViewExport {
         // Pointer move
         ele.addEventListener("pointermove", { rawEvent ->
             if (!isMouseDown) return@addEventListener
+            val pointerId = rawEvent.asDynamic().pointerId.unsafeCast<Int?>()
+            if (pointerId != activePointerId) {
+                return@addEventListener
+            }
+
             val mouseLike = rawEvent.unsafeCast<MouseEvent>()
             val eventParams = mouseLike.toPanEventParams()
             var params = getPanEventParams(
                 fastMutableMapOf<String, Any>().apply { putAll(eventParams) },
                 KRStateConst.MOVE
             )
+
+            // Defer pointer capture until movement exceeds drag threshold.
+            if (!isPointerCaptured && pointerId != null) {
+                val dx = x - pointerDownX
+                val dy = y - pointerDownY
+                val thresholdSq = POINTER_CAPTURE_DRAG_THRESHOLD_PX * POINTER_CAPTURE_DRAG_THRESHOLD_PX
+                val distanceSq = dx * dx + dy * dy
+                if (distanceSq >= thresholdSq) {
+                    try {
+                        ele.asDynamic().setPointerCapture(pointerId)
+                        isPointerCaptured = true
+                    } catch (_: Throwable) {
+                        // Some environments may throw if pointerId is invalid; ignore.
+                    }
+                }
+            }
+
             params = setSuperTouchEventParams(
                 params, rawEvent.timeStamp.toLong(), KRActionConst.TOUCH_MOVE
             )
@@ -713,7 +741,22 @@ open class KRView : IKuiklyRenderViewExport {
         // Pointer up
         ele.addEventListener("pointerup", { rawEvent ->
             if (!isMouseDown) return@addEventListener
+            val pointerId = rawEvent.asDynamic().pointerId.unsafeCast<Int?>()
+            if (pointerId != activePointerId) {
+                return@addEventListener
+            }
+
+            if (isPointerCaptured && pointerId != null) {
+                try {
+                    ele.asDynamic().releasePointerCapture(pointerId)
+                } catch (_: Throwable) {
+                    // Some environments may throw if pointerId is invalid; ignore.
+                }
+            }
             isMouseDown = false
+            isPointerCaptured = false
+            activePointerId = null
+
             var params = fastMutableMapOf<String, Any>().apply {
                 put(KRParamConst.X, x)
                 put(KRParamConst.Y, y)
@@ -732,7 +775,22 @@ open cla
```

---

### Incident Patch 11: `6c922ac1` (2026-09-09)
**Commit Message**: fix(compose): pin Lazy exact contentSize after last item is visible (#1734)

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `compose/src/commonMain/kotlin/com/tencent/kuikly/compose/foundation/lazy/LazyList.kt` (modified, +15/-2)
```diff
@@ -271,7 +271,7 @@ private fun rememberLazyListMeasurePolicy(
             if (itemsCount < state.kuiklyInfo.cachedTotalItems) {
                 state.kuiklyInfo.offsetDirty = true
             } else if (itemsCount > state.kuiklyInfo.cachedTotalItems) {
-                state.kuiklyInfo.realContentSize = null
+                state.kuiklyInfo.clearExactContentSize()
                 state.tryExpandStartSizeNoScroll()
             }
         }
@@ -283,6 +283,19 @@ private fun rememberLazyListMeasurePolicy(
         } else {
             containerConstraints.maxWidth - totalHorizontalPadding
         }
+        val prevViewport = if (isVertical) {
+            state.layoutInfo.viewportSize.height
+        } else {
+            state.layoutInfo.viewportSize.width
+        }
+        val newViewport = if (isVertical) {
+            containerConstraints.maxHeight
+        } else {
+            containerConstraints.maxWidth
+        }
+        if (prevViewport > 0 && prevViewport != newViewport) {
+            state.kuiklyInfo.clearExactContentSize()
+        }
         val visualItemOffset = if (!reverseLayout || mainAxisAvailableSize > 0) {
             IntOffset(startPadding, topPadding)
         } else {
@@ -332,7 +345,7 @@ private fun rememberLazyListMeasurePolicy(
                 val oldHeight = state.kuiklyInfo.itemMainSpaceCache[itemResult.key]
                 // 高度扩大了
                 if ((oldHeight ?: 0) < itemResult.mainAxisSizeWithSpacings && !state.isScrollInProgress ) {
-                    state.kuiklyInfo.realContentSize = null
+                    state.kuiklyInfo.clearExactContentSize()
                     state.tryExpandStartSizeNoScroll()
                 }
                 state.kuiklyInfo.itemMainSpaceCache[itemResult.key] = itemResult.mainAxisSizeWithSpacings
```

**File**: `compose/src/commonMain/kotlin/com/tencent/kuikly/compose/foundation/lazy/grid/LazyGrid.kt` (modified, +18/-2)
```diff
@@ -230,13 +230,16 @@ private fun rememberLazyGridMeasurePolicy(
             }.spacing
         }
         val spaceBetweenLines = spaceBetweenLinesDp.roundToPx()
+        if (state.slotsPerLine > 0 && state.slotsPerLine != slotsPerLine) {
+            state.kuiklyInfo.clearExactContentSize()
+        }
         val itemsCount = itemProvider.itemCount
 
         if (state.kuiklyInfo.cachedTotalItems > 0) {
             if (itemsCount < state.kuiklyInfo.cachedTotalItems) {
                 state.kuiklyInfo.offsetDirty = true
             } else if (itemsCount > state.kuiklyInfo.cachedTotalItems) {
-                state.kuiklyInfo.realContentSize = null
+                state.kuiklyInfo.clearExactContentSize()
                 state.tryExpandStartSizeNoScroll()
             }
         }
@@ -248,6 +251,19 @@ private fun rememberLazyGridMeasurePolicy(
         } else {
             containerConstraints.maxWidth - totalHorizontalPadding
         }
+        val prevViewport = if (isVertical) {
+            state.layoutInfo.viewportSize.height
+        } else {
+            state.layoutInfo.viewportSize.width
+        }
+        val newViewport = if (isVertical) {
+            containerConstraints.maxHeight
+        } else {
+            containerConstraints.maxWidth
+        }
+        if (prevViewport > 0 && prevViewport != newViewport) {
+            state.kuiklyInfo.clearExactContentSize()
+        }
         val visualItemOffset = if (!reverseLayout || mainAxisAvailableSize > 0) {
             IntOffset(startPadding, topPadding)
         } else {
@@ -322,7 +338,7 @@ private fun rememberLazyGridMeasurePolicy(
                 val oldLineHeight = state.kuiklyInfo.itemMainSpaceCache[lineKey]
                 // 行高度扩大了
                 if ((oldLineHeight ?: 0) < lineResult.mainAxisSizeWithSpacings && !state.isScrollInProgress) {
-                    state.kuiklyInfo.realContentSize = null
+                    state.kuiklyInfo.clearExactContentSize()
                     state.tryExpandStartSizeNoScroll()
                 }
                 state.kuiklyInfo.itemMainSpaceCache[lineKey] = lineResult.mainAxisSizeWithSpacings
```

**File**: `compose/src/commonMain/kotlin/com/tencent/kuikly/compose/foundation/lazy/staggeredgrid/LazyStaggeredGridMeasure.kt` (modified, +8/-2)
```diff
@@ -239,7 +239,7 @@ internal class LazyStaggeredGridMeasureContext(
             val oldItemHeight = state.kuiklyInfo.itemMainSpaceCache[itemKey]
             // Item height has expanded
             if ((oldItemHeight ?: 0) < itemResult.mainAxisSizeWithSpacings && !state.isScrollInProgress) {
-                state.kuiklyInfo.realContentSize = null
+                state.kuiklyInfo.clearExactContentSize()
                 state.tryExpandStartSizeNoScroll()
             }
             state.kuiklyInfo.itemMainSpaceCache[itemKey] = itemResult.mainAxisSizeWithSpacings
@@ -252,6 +252,12 @@ internal class LazyStaggeredGridMeasureContext(
 
     val laneCount = resolvedSlots.sizes.size
 
+    init {
+        if (state.laneCount > 0 && state.laneCount != laneCount) {
+            state.kuiklyInfo.clearExactContentSize()
+        }
+    }
+
     fun LazyStaggeredGridItemProvider.isFullSpan(itemIndex: Int): Boolean =
         spanProvider.isFullSpan(itemIndex)
 
@@ -284,7 +290,7 @@ private fun LazyStaggeredGridMeasureContext.measure(
             if (itemCount < state.kuiklyInfo.cachedTotalItems) {
                 state.kuiklyInfo.offsetDirty = true
             } else if (itemCount > state.kuiklyInfo.cachedTotalItems) {
-                state.kuiklyInfo.realContentSize = null
+                state.kuiklyInfo.clearExactContentSize()
                 state.tryExpandStartSizeNoScroll()
             }
         }
```

**File**: `compose/src/commonMain/kotlin/com/tencent/kuikly/compose/gestures/KuiklyScrollInfo.kt` (modified, +8/-0)
```diff
@@ -84,6 +84,14 @@ class KuiklyScrollInfo {
      */
     var realContentSize: Int? = null
 
+    /**
+     * Clear the pinned exact size so the next scroll can recompute it
+     * after a real layout change.
+     */
+    internal fun clearExactContentSize() {
+        realContentSize = null
+    }
+
     /**
      * Whether the offset has deviation
      */
```

**File**: `compose/src/commonMain/kotlin/com/tencent/kuikly/compose/scroller/ContentSizeExtensions.kt` (modified, +14/-2)
```diff
@@ -40,6 +40,7 @@ import kotlin.math.roundToInt
  * Calculate content size
  */
 internal fun ScrollableState.calculateContentSize(): Int {
+    val previousExact = kuiklyInfo.realContentSize
     kuiklyInfo.realContentSize = null
     val density = kuiklyInfo.getDensity()
     val minSize = (ScrollableStateConstants.DEFAULT_CONTENT_SIZE * density).toInt()
@@ -62,8 +63,15 @@ internal fun ScrollableState.calculateContentSize(): Int {
         val viewportDelta = viewportSize - composeViewport
         // Compensate for contentPadding which does not affect viewportSize but is excluded from totalContentSize
         val contentPaddingCompensation = (contentPadding.totalPadding(kuiklyInfo.orientation).value * density).roundToInt()
-        kuiklyInfo.realContentSize = realContentSize + viewportDelta + contentPaddingCompensation
-        return kuiklyInfo.realContentSize!!
+        var exact = realContentSize + viewportDelta + contentPaddingCompensation
+        // lastItem.offset is viewport-relative. After a fling reaches the last item,
+        // a stale offset can inflate contentSize and skip native bounce.
+        // Measure clears the pin when layout actually changes.
+        if (previousExact != null && exact > previousExact && this.isLazyListOrGrid()) {
+            exact = previousExact
+        }
+        kuiklyInfo.realContentSize = exact
+        return exact
     }
 
     val bottomOffset = kuiklyInfo.composeOffset.toInt() + viewportSize
@@ -348,3 +356,7 @@ internal fun ScrollableState.tryExpandStartSizeNoScroll(forceExpand: Boolean = f
         }
     }
 }
+
+private fun ScrollableState.isLazyListOrGrid(): Boolean {
+    return this is LazyListState || this is LazyGridState || this is LazyStaggeredGridState
+}
```

---

### Incident Patch 12: `2b4cf770` (2026-09-09)
**Commit Message**: feat(ohos): isolate render extras behind compile-time factories (#1731)

Replace runtime execute-mode registration with Default factories and pass contextCode/executeMode as NAPI args so shared OHOS files stay feature-agnostic.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `core-render-ohos/src/main/cpp/CMakeLists.txt` (modified, +3/-1)
```diff
@@ -26,11 +26,11 @@ set(SOURCE_SET
         libohos_render/context/DefaultRenderNativeContextHandler.cpp
         libohos_render/context/KRRenderExecuteMode.cpp
         libohos_render/context/KRRenderNativeMode.cpp
-        libohos_render/context/KRRenderExecuteModeWrapper.cpp
         libohos_render/adapter/KRRenderAdapterManager.cpp
         libohos_render/manager/KRArkTSManager.cpp
         libohos_render/manager/KRSnapshotManager.cpp
         libohos_render/core/KRRenderCore.cpp
+        libohos_render/core/KRRenderFactoriesDefault.cpp
         libohos_render/expand/modules/network/KRNetworkModule.cpp
         libohos_render/expand/components/apng/KRApngView.cpp
         libohos_render/expand/components/apng/ApngParser.cpp
@@ -117,6 +117,8 @@ set(SOURCE_SET
         libohos_render/expand/modules/preferences/KROhPreferences.cpp
 )
 
+include("${CMAKE_CURRENT_SOURCE_DIR}/extra.cmake" OPTIONAL)
+
 add_library(kuikly SHARED ${SOURCE_SET})
 target_compile_options(kuikly PRIVATE
         $<$<COMPILE_LANGUAGE:CXX>:-Wconstexpr-not-const>
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/context/IKRRenderNativeContextHandler.cpp` (modified, +0/-4)
```diff
@@ -18,10 +18,6 @@
 #include "libohos_render/context/KRRenderNativeContextHandlerManager.h"
 #include "libohos_render/foundation/thread/KRMainThread.h"
 
-void IKRRenderNativeContextHandler::SetContextHandlerCreator(const KRRenderContextHandlerCreator &creator) {
-    KRRenderNativeContextHandlerManager::GetInstance().SetContextHandlerCreator(creator);
-}
-
 std::shared_ptr<IKRRenderNativeContextHandler>
 IKRRenderNativeContextHandler::CreateContextHandler(const std::shared_ptr<KRRenderContextParams> &context_params) {
     return KRRenderNativeContextHandlerManager::GetInstance().CreateContextHandler(context_params);
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/context/IKRRenderNativeContextHandler.h` (modified, +0/-5)
```diff
@@ -57,9 +57,6 @@ enum class KuiklyRenderNativeMethod {
 class IKRRenderNativeContextHandler;
 class KRRenderContextParams;
 
-using KRRenderContextHandlerCreator =
-    std::function<std::shared_ptr<IKRRenderNativeContextHandler>(const std::shared_ptr<KRRenderContextParams> &)>;
-
 class ICallNativeCallback {
  public:
     ICallNativeCallback() {}
@@ -97,8 +94,6 @@ class IKRRenderNativeContextHandler : public std::enable_shared_from_this<IKRRen
                                              const KRRenderCValue &arg3, const KRRenderCValue &arg4,
                                              const KRRenderCValue &arg5);
     
-    static void SetContextHandlerCreator(const KRRenderContextHandlerCreator &creator);
-
     static std::shared_ptr<IKRRenderNativeContextHandler>
     CreateContextHandler(const std::shared_ptr<KRRenderContextParams> &context_params);
 
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/context/KRRenderContextParams.h` (modified, +6/-17)
```diff
@@ -17,7 +17,8 @@
 #define CORE_RENDER_OHOS_KRRENDERCONTEXTPARAMS_H
 
 #include <string>
-#include "libohos_render/context/KRRenderNativeMode.h"
+#include "libohos_render/context/KRRenderExecuteMode.h"
+#include "libohos_render/core/KRRenderFactories.h"
 #include "libohos_render/foundation/KRConfig.h"
 #include "libohos_render/foundation/type/KRRenderValue.h"
 
@@ -27,26 +28,14 @@
 class KRRenderContextParams {
  public:
     KRRenderContextParams(const std::string &page_name, const std::shared_ptr<KRRenderValue> &page_data,
-                          const std::string &instance_id, const std::string &configJsonStr) {
+                          const std::string &instance_id, const std::string &configJsonStr,
+                          const std::string &context_code, int execute_mode) {
         this->page_name_ = page_name;
         this->instance_id_ = instance_id;
         this->page_data_ = page_data;
         this->config_ = std::make_shared<KRConfig>(configJsonStr);
-
-        auto page_data_map = this->page_data_->toMap();
-        int page_data_mode = page_data_map["executeMode"]->toInt();
-        std::unordered_map<int, KRRenderExecuteModeCreator> mode_creator_register =
-            KRRenderExecuteMode::GetExecuteModeCreatorRegister();
-        if (mode_creator_register.find(page_data_mode) != mode_creator_register.end()) {
-            auto creator = mode_creator_register[page_data_mode];
-            execute_mode_ = creator();
-        } else {
-            std::shared_ptr<KRRenderExecuteMode> defaultMode = std::make_shared<KRRenderNativeMode>();
-            if (defaultMode->GetMode() == page_data_mode) {
-                execute_mode_ = defaultMode;
-            }
-        }
-        context_code_ = page_data_map["contextCode"]->toString();
+        this->context_code_ = context_code;
+        this->execute_mode_ = kuikly::ExecuteModeFactory::Create(execute_mode);
     }
     const std::string &PageName() const {
         return page_name_;
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/context/KRRenderExecuteMode.h` (modified, +0/-13)
```diff
@@ -16,26 +16,13 @@
 #ifndef CORE_RENDER_OHOS_KRRENDEREXECUTEMODE_H
 #define CORE_RENDER_OHOS_KRRENDEREXECUTEMODE_H
 
-#include <functional>
-class KRRenderExecuteMode;
-using KRRenderExecuteModeCreator = std::function<std::shared_ptr<KRRenderExecuteMode>()>;
-
 class KRRenderExecuteMode {
  public:
     explicit KRRenderExecuteMode(int mode);
     virtual bool IsContextSyncInit() = 0;  // ContextHandler是否同步初始化
     virtual int ModeToCoreValue() = 0;     //  render mode映射到Core的对应值
     int GetMode();
 
-    //  注册自定义ExecuteMode创建器
-    static void RegisterExecuteModeCreator(const int &mode, const KRRenderExecuteModeCreator &creator) {
-        GetExecuteModeCreatorRegister()[mode] = creator;
-    }
-    static std::unordered_map<int, KRRenderExecuteModeCreator> &GetExecuteModeCreatorRegister() {
-        static std::unordered_map<int, KRRenderExecuteModeCreator> gRegisterExecuteModeCreator;
-        return gRegisterExecuteModeCreator;
-    }
-
  private:
     int mode_ = 0;  //  运行模式
 };
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/context/KRRenderExecuteModeWrapper.cpp` (removed, +0/-33)
```diff
@@ -1,33 +0,0 @@
-/*
- * Tencent is pleased to support the open source community by making KuiklyUI
- * available.
- * Copyright (C) 2025 Tencent. All rights reserved.
- * Licensed under the License of KuiklyUI;
- * you may not use this file except in compliance with the License.
- * You may obtain a copy of the License at
- * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
- * Unless required by applicable law or agreed to in writing, software
- * distributed under the License is distributed on an "AS IS" BASIS,
- * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
- * See the License for the specific language governing permissions and
- * limitations under the License.
- */
-
-#include "KRRenderExecuteModeWrapper.h"
-
-KRRenderExecuteModeWrapper::KRRenderExecuteModeWrapper(const int mode, const KRRenderExecuteModeCreator &mode_creator,
-                                                       const KRRenderContextHandlerCreator &context_creator) {
-    mode_ = mode;
-    execute_mode_creator_ = mode_creator;
-    context_handler_creator_ = context_creator;
-}
-int KRRenderExecuteModeWrapper::GetMode() {
-    return mode_;
-}
-KRRenderExecuteModeCreator KRRenderExecuteModeWrapper::GetExecuteModeCreator() {
-    return execute_mode_creator_;
-}
-
-KRRenderContextHandlerCreator KRRenderExecuteModeWrapper::GetContextHandlerCreator() {
-    return context_handler_creator_;
-}
\ No newline at end of file
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/context/KRRenderExecuteModeWrapper.h` (removed, +0/-36)
```diff
@@ -1,36 +0,0 @@
-/*
- * Tencent is pleased to support the open source community by making KuiklyUI
- * available.
- * Copyright (C) 2025 Tencent. All rights reserved.
- * Licensed under the License of KuiklyUI;
- * you may not use this file except in compliance with the License.
- * You may obtain a copy of the License at
- * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
- * Unless required by applicable law or agreed to in writing, software
- * distributed under the License is distributed on an "AS IS" BASIS,
- * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
- * See the License for the specific language governing permissions and
- * limitations under the License.
- */
-
-#ifndef CORE_RENDER_OHOS_KRRENDEREXECUTEMODEWRAPPER_H
-#define CORE_RENDER_OHOS_KRRENDEREXECUTEMODEWRAPPER_H
-
-#include "libohos_render/context/IKRRenderNativeContextHandler.h"
-#include "libohos_render/context/KRRenderExecuteMode.h"
-
-class KRRenderExecuteModeWrapper {
- public:
-    KRRenderExecuteModeWrapper(const int mode, const KRRenderExecuteModeCreator &mode_creator,
-                               const KRRenderContextHandlerCreator &context_creator);
-    int GetMode();
-    KRRenderExecuteModeCreator GetExecuteModeCreator();
-    KRRenderContextHandlerCreator GetContextHandlerCreator();
-
- private:
-    int mode_ = 0;
-    KRRenderExecuteModeCreator execute_mode_creator_;
-    KRRenderContextHandlerCreator context_handler_creator_;
-};
-
-#endif  // CORE_RENDER_OHOS_KRRENDEREXECUTEMODEWRAPPER_H
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/context/KRRenderNativeContextHandlerManager.cpp` (modified, +2/-25)
```diff
@@ -15,37 +15,14 @@
 
 #include "libohos_render/context/KRRenderNativeContextHandlerManager.h"
 
-#include "libohos_render/context/DefaultRenderNativeContextHandler.h"
+#include "libohos_render/core/KRRenderFactories.h"
 #include "libohos_render/scheduler/KRContextScheduler.h"
 
 extern CallKotlin callKotlin_;
 
-void KRRenderNativeContextHandlerManager::SetContextHandlerCreator(const KRRenderContextHandlerCreator &creator) {
-    creator_ = creator;
-}
-
 std::shared_ptr<IKRRenderNativeContextHandler> KRRenderNativeContextHandlerManager::CreateContextHandler(
     const std::shared_ptr<KRRenderContextParams> &context_params) {
-    KRRenderContextHandlerCreator creator_;
-    if (context_params->ExecuteMode()) {
-        std::unordered_map<int, KRRenderContextHandlerCreator> context_creator_register =
-            GetContextHandlerCreatorRegister();
-        int param_mode = context_params->ExecuteMode()->GetMode();
-        if (context_creator_register.find(param_mode) != context_creator_register.end()) {
-            creator_ = context_creator_register[param_mode];  //  优先使用自定义注册的创建器
-        } else if (auto native_mode = dynamic_cast<KRRenderNativeMode *>(context_params->ExecuteMode().get())) {
-            auto context_handler_register = [](const std::shared_ptr<KRRenderContextParams> &context_params)
-                -> std::shared_ptr<IKRRenderNativeContextHandler> {
-                return std::make_shared<DefaultRenderNativeContextHandler>();
-            };
-            creator_ = context_handler_register;
-        }
-    }
-    if (creator_) {
-        return creator_(context_params);
-    } else {
-        throw std::runtime_error("Custom execute mode, contextHandler must be registered");
-    }
+    return kuikly::ContextHandlerFactory::CreateContextHandler(context_params);
 }
 
 void KRRenderNativeContextHandlerManager::RegisterContextHandler(
```

---

### Incident Patch 13: `aae01be2` (2026-09-03)
**Commit Message**: fix(ios): TurboDisplay refresh to respect node-level auto-update disable filter (#1723)

* fix(ios): TurboDisplay refresh to respect node-level auto-update disable filter

Signed-off-by: valoxbwang <[REDACTED_EMAIL]>

* fix(ios): resolve TurboDisplay snapshot after gesture to keep manual refresh filtered

Signed-off-by: valoxbwang <[REDACTED_EMAIL]>

* fix(ios): make clearCurrentPageCache only wipe stored cache, keeping collection running

---------

Signed-off-by: valoxbwang <[REDACTED_EMAIL]>
Co-authored-by: RoeKun <>

**File**: `core-render-ios/Handler/KuiklyTurboDisplay/KuiklyTurboDisplayRenderLayerHandler.m` (modified, +23/-7)
```diff
@@ -436,7 +436,10 @@ - (void)didHitTest {
         _closeAutoUpdateTurboDisplay = YES;
         [_config closeAutoUpdateTurboDisplay];
         
-        _nextTurboDisplayRootNode = nil;
+        // 【修复】不再丢弃快照树：保留基础状态参照，使手势后的手动刷新
+        // setCurrentUIAsFirstScreenForNextLaunch 仍走受 turboDisplayAutoUpdateEnable
+        // 节点级过滤的 diff 路径（此前置 nil 会使手动刷新落入全量缓存真实树的兜底分支，过滤失效）。
+        // 自动更新已由 _closeAutoUpdateTurboDisplay 关闭，保留快照树不会触发额外写盘。
     }
 }
 
@@ -456,6 +459,20 @@ - (void)onReceiveSetCurrentUINotification:(NSNotification *)notification {
     if (![_config isPersistentRealTreeEnabled]) {
         return;
     }
+    // 【修复】先基于快照树做一次 diff-DOM（受 turboDisplayAutoUpdateEnable 节点级过滤）：
+    // 未被禁用采集的子树同步到最新状态，被禁用的子树保持基础状态。
+    // 直接调用 DiffPatch，绕过 updateNextTurboDisplayRootNodeIfNeed 的
+    // _closeAutoUpdateTurboDisplay 守卫与 _needUpdateNextTurboDisplayRootNode 标志位守卫（手动刷新需无条件 diff）
+    if (_nextTurboDisplayRootNode) {
+        [KRTurboDisplayDiffPatch onlyUpdateWithTargetNodeTree:_nextTurboDisplayRootNode
+                                                 fromNodeTree:_realRootNode
+                                                       config:_config];
+    } else {
+        // 兜底：快照树尚未初始化（viewDidLoad 前 diffPatchToRenderLayer 未执行时极早期调用），
+        // 无基础状态参照，以当前真实树为快照（保持原手动采集当前 UI 语义）
+        _nextTurboDisplayRootNode = [_realRootNode deepCopy];
+    }
+
     // 业务手动强制刷新，与自动刷新相斥，因此默认执行自动刷新关闭
     _closeAutoUpdateTurboDisplay = YES;
     [_config closeAutoUpdateTurboDisplay];
@@ -473,7 +490,8 @@ - (void)onReceiveSetCurrentUINotification:(NSNotification *)notification {
         }
     }
 
-    [[KRTurboDisplayCacheManager sharedInstance] cacheWithViewNode:[_realRootNode deepCopy]
+    // 【修复】缓存快照树而非真实树
+    [[KRTurboDisplayCacheManager sharedInstance] cacheWithViewNode:[_nextTurboDisplayRootNode deepCopy]
                                                           cacheKey:self.turboDisplayCacheKey
                                                  extraCacheContent:extraCacheContent];
     
@@ -493,13 +511,11 @@ - (void)onReceiveClearCurrentPageCacheNotification:(NSNotification *)notificatio
     if (notification.object != _rootView) {
         return;
     }
+    // 【修复】清除缓存 = 仅抹除已存在的缓存（磁盘文件 + 内存副本），不改采集机制状态：
+    // 快照树与自动更新保持运行，后续状态变化由自动采集重建新缓存，
+    // 使业务可将 clearCurrentPageCache 作为"重新开始存储"的先行处理手段。
     [[KRTurboDisplayCacheManager sharedInstance] removeCacheWithKey:self.turboDisplayCacheKey];
     self.turboDisplayCacheData = nil;
-    _nextTurboDisplayRootNode = nil;
-    
-    // 缓存清除后，可开启自动更新
-    _closeAutoUpdateTurboDisplay = YES;
-    [_config closeAutoUpdateTurboDisplay];
 }
 
 #pragma mark - TurboDisplay rendering
```

---

### Incident Patch 14: `11314a0f` (2026-09-01)
**Commit Message**: fix(ohos): 修复双击手势 250ms 延迟任务访问悬空对象导致的崩溃 (#1714)

* fix(ohos): 修复双击手势 250ms 延迟任务访问悬空对象导致的崩溃

## 原因 (Root Cause)
在 core-render-ohos 手势处理中，存在两处悬空指针（use-after-free）隐患，
崩溃栈来自 KRTapGestureEventHandler::OnGestureEvent 的 250ms 延迟 lambda：

1. 延迟任务裸捕获 this
   KRTapGestureEventHandler::OnGestureEvent 双击分支用
   `KRMainThread::RunOnMainThread([this, event]{...}, 250)` 投递一个 250ms
   延迟任务，闭包直接捕获了 `this`（KRTapGestureEventHandler）与 `event`。
   当该 250ms 窗口内 view 被卸载 / 节点回收，`KRGestureGroupHandler` 析构会
   将 gesture_event_handlers_ 清空，handler 引用计数归零被销毁；但已排队的
   延迟任务没有任何取消机制，到点仍会在主线程执行并访问已释放的 this
   （current_tap_count_ / node_ / tap_event_data_ / Reset()），触发 UAF。
   栈顶 #00 的 std::function::__value_func::operator() 即目标对象内存已被回收。

2. KRGestureEventData 持有悬空的 ArkUI_GestureEvent*
   KRGestureEventData 仅以 `gesture_event_(event)` 保存原始事件裸指针，不拷贝。
   ArkUI 的 ArkUI_GestureEvent 由系统管理，手势回调返回后即可能被回收/复用。
   下游客体 KRBaseEventHandler::FireOnLongPress/Pan/PinchCallback 直接
   `GetArkUIGestureActionState/Type/PinchScale(gesture_event_data->gesture_event_)`
   解引用该裸指针，延迟场景下同样踩野指针。

## 修复方案 (Fix)
1. 延迟任务改用弱引用：250ms lambda 以 weak_from_this() 捕获，执行时
   lock() 失败（对象已销毁）直接 return，不再访问悬空 this。同时移除未使用的
   `[event]` 裸捕获。基类 KRGestur

**File**: `core-render-ohos/src/main/cpp/libohos_render/expand/events/KRBaseEventHandler.cpp` (modified, +6/-6)
```diff
@@ -172,7 +172,7 @@ bool KRBaseEventHandler::FireOnLongPressCallback(const std::shared_ptr<KRGesture
     if (!long_press_callback_) {
         return false;
     }
-    std::string state = kuikly::util::GetArkUIGestureActionState(gesture_event_data->gesture_event_);
+    std::string state = gesture_event_data->GetActionState();
     if ((is_long_press_happening && state == kStartState) || (!is_long_press_happening && state == kEndState)) {
         return false;
     }
@@ -182,8 +182,8 @@ bool KRBaseEventHandler::FireOnLongPressCallback(const std::shared_ptr<KRGesture
     params[kParamKeyY] = NewKRRenderValue(kr_config_->Px2Vp(gesture_event_data->gesture_event_point_.y));
     params[kParamKeyPageX] = NewKRRenderValue(kr_config_->Px2Vp(gesture_event_data->gesture_event_window_point_.x));
     params[kParamKeyPageY] = NewKRRenderValue(kr_config_->Px2Vp(gesture_event_data->gesture_event_window_point_.y));
-    params[kParamKeyState] = NewKRRenderValue(kuikly::util::GetArkUIGestureActionState(gesture_event_data->gesture_event_));
-    params[kParamKeyIsCancel] = NewKRRenderValue(kuikly::util::GetArkUIGestureActionType(gesture_event_data->gesture_event_) == GESTURE_EVENT_ACTION_CANCEL);
+    params[kParamKeyState] = NewKRRenderValue(gesture_event_data->GetActionState());
+    params[kParamKeyIsCancel] = NewKRRenderValue(gesture_event_data->GetActionType() == GESTURE_EVENT_ACTION_CANCEL);
     long_press_callback_(NewKRRenderValue(params));
     return true;
 }
@@ -205,7 +205,7 @@ bool KRBaseEventHandler::FireOnPanCallback(const std::shared_ptr<KRGestureEventD
     params[kParamKeyY] = NewKRRenderValue(kr_config_->Px2Vp(gesture_event_data->gesture_event_point_.y));
     params[kParamKeyPageX] = NewKRRenderValue(kr_config_->Px2Vp(gesture_event_data->gesture_event_window_point_.x));
     params[kParamKeyPageY] = NewKRRenderValue(kr_config_->Px2Vp(gesture_event_data->gesture_event_window_point_.y));
-    params[kParamKeyState] = NewKRRenderValue(kuikly::util::GetArkUIGestureActionState(gesture_event_data->gesture_event_));
+    params[kParamKeyState] = NewKRRenderValue(gesture_event_data->GetActionState());
     pan_event_callback_(NewKRRenderValue(params));
     return true;
 }
@@ -227,8 +227,8 @@ bool KRBaseEventHandler::FireOnPinchCallback(const std::shared_ptr<KRGestureEven
     params[kParamKeyY] = NewKRRenderValue(kr_config_->Px2Vp(gesture_event_data->gesture_event_point_.y));
     params[kParamKeyPageX] = NewKRRenderValue(kr_config_->Px2Vp(gesture_event_data->gesture_event_window_point_.x));
     params[kParamKeyPageY] = NewKRRenderValue(kr_config_->Px2Vp(gesture_event_data->gesture_event_window_point_.y));
-    params[kParamKeyScale] = NewKRRenderValue(kuikly::util::GetArkUIGesturePinchScale(gesture_event_data->gesture_event_));
-    params[kParamKeyState] = NewKRRenderValue(kuikly::util::GetArkUIGestureActionState(gesture_event_data->gesture_event_));
+    params[kParamKeyScale] = NewKRRenderValue(gesture_event_data->GetScale());
+    params[kParamKeyState] = NewKRRenderValue(gesture_event_data->GetActionState());
     pinch_event_callback_(NewKRRenderValue(params));
     return true;
 }
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/expand/events/gesture/KRGestueEventType.h` (modified, +27/-4)
```diff
@@ -19,6 +19,7 @@
 #include <arkui/native_gesture.h>
 #include <arkui/native_type.h>
 #include <functional>
+#include <string>
 #include "libohos_render/foundation/KRPoint.h"
 #include "libohos_render/utils/KREventUtil.h"
 
@@ -33,15 +34,37 @@ enum class KRGestureEventType {
 
 struct KRGestureEventData {
  public:
-    explicit KRGestureEventData(ArkUI_GestureEvent *event) : gesture_event_(event) {
-        gesture_event_point_ = kuikly::util::GetArkUIGestureEventPoint(event);
-        gesture_event_window_point_ = kuikly::util::GetArkUIGestureEventWindowPoint(event);
+    explicit KRGestureEventData(ArkUI_GestureEvent *event) {
+        if (event) {
+            // 在手势回调当帧把所有需要的字段深拷贝出来，之后不再依赖
+            // event 指针。ArkUI 的 ArkUI_GestureEvent 由系统管理，回调返回后
+            // 即可能被回收/复用，跨生命周期持有裸指针会在延迟任务中踩野指针。
+            gesture_event_point_ = kuikly::util::GetArkUIGestureEventPoint(event);
+            gesture_event_window_point_ = kuikly::util::GetArkUIGestureEventWindowPoint(event);
+            action_type_ = kuikly::util::GetArkUIGestureActionType(event);
+            scale_ = kuikly::util::GetArkUIGesturePinchScale(event);
+        }
+    }
+
+    // 以下访问器均读构造时深拷贝的字段，不触碰任何悬空指针。
+    ArkUI_GestureEventActionType GetActionType() const { return action_type_; }
+
+    float GetScale() const { return scale_; }
+
+    std::string GetActionState() const {
+        if (action_type_ == GESTURE_EVENT_ACTION_ACCEPT) {
+            return "start";
+        } else if (action_type_ == GESTURE_EVENT_ACTION_UPDATE) {
+            return "move";
+        }
+        return "end";
     }
 
  public:
     KRPoint gesture_event_point_;
     KRPoint gesture_event_window_point_;
-    ArkUI_GestureEvent *gesture_event_;
+    ArkUI_GestureEventActionType action_type_ = GESTURE_EVENT_ACTION_CANCEL;
+    float scale_ = 1.0f;
 };
 
 using KRGestureEventCallback = std::function<void(const ArkUI_NodeHandle node_handle,
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/expand/events/gesture/KRGestureEventHandler.cpp` (modified, +15/-4)
```diff
@@ -163,16 +163,27 @@ void KRTapGestureEventHandler::OnGestureEvent(ArkUI_GestureEvent *event) {
     auto action_type = kuikly::util::GetArkUIGestureActionType(event);
     if (register_double_tap_event_) {
         if (action_type == GESTURE_EVENT_ACTION_ACCEPT) {
+            // 当帧深拷贝事件数据，之后不再依赖悬空的 ArkUI_GestureEvent*。
             tap_event_data_ = std::make_shared<KRGestureEventData>(event);
             current_tap_count_++;
             if (current_tap_count_ == 1) {
                 last_tap_down_time_stamp_ = CurrentTimeStamp();
+                // 用 weak_from_this 取代裸 this 捕获：250ms 延迟任务可能在 view 卸载、
+                // handler 已销毁后才执行，弱引用 lock 失败即直接丢弃，避免访问悬空 this。
+                auto weak_self = weak_from_this();
                 KRMainThread::RunOnMainThread(
-                    [this, event] {
-                        if (current_tap_count_ == 1) {
-                            gesture_callback_(node_, tap_event_data_, KRGestureEventType::kClick);
+                    [weak_self] {
+                        // weak_from_this() 返回基类 weak_ptr，需 downcast 到派生类才能访问
+                        // current_tap_count_ / tap_event_data_ / Reset() 及 protected 成员 node_ / gesture_callback_；
+                        // 此处 lambda 位于 KRTapGestureEventHandler 成员函数作用域内，对派生类对象拥有访问权限。
+                        auto self = std::dynamic_pointer_cast<KRTapGestureEventHandler>(weak_self.lock());
+                        if (!self) {
+                            return;
                         }
-                        Reset();
+                        if (self->current_tap_count_ == 1) {
+                            self->gesture_callback_(self->node_, self->tap_event_data_, KRGestureEventType::kClick);
+                        }
+                        self->Reset();
                     },
                     250);
             } else if (current_tap_count_ == 2) {
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/export/IKRRenderViewExport.h` (modified, +1/-1)
```diff
@@ -280,7 +280,7 @@ class IKRRenderViewExport : public std::enable_shared_from_this<IKRRenderViewExp
 
         base_event_handler_->OnGestureEvent(gesture_event_data, event_type);
         if (base_event_handler_->HasCaptureRule()) {
-            auto action_type = kuikly::util::GetArkUIGestureActionType(gesture_event_data->gesture_event_);
+            auto action_type = gesture_event_data->GetActionType();
             handling_capture_event_ =
                 action_type == GESTURE_EVENT_ACTION_ACCEPT || action_type == GESTURE_EVENT_ACTION_UPDATE;
         }
```

---

### Incident Patch 15: `9682e4b5` (2026-09-01)
**Commit Message**: fix(h5): h5 add toImageScaled method

**File**: `core-render-web/base/src/jsMain/kotlin/com/tencent/kuikly/core/render/web/expand/components/KRView.kt` (modified, +36/-9)
```diff
@@ -158,6 +158,10 @@ open class KRView : IKuiklyRenderViewExport {
                 toImage(params, callback)
                 null
             }
+            TO_IMAGE_SCALED -> {
+                toImageScaled(params, callback)
+                null
+            }
             else -> super.call(method, params, callback)
         }
     }
@@ -166,10 +170,33 @@ open class KRView : IKuiklyRenderViewExport {
         val json = JSONObject(params ?: "{}")
         val type = json.optString(TO_IMAGE_PARAM_TYPE).ifEmpty { TO_IMAGE_TYPE_DATA_URI }
         val sampleSize = max(1, json.optInt(TO_IMAGE_PARAM_SAMPLE_SIZE, 1))
-        // H5-only extension: additional upscale factor on top of DPR / sampleSize.
-        // Other platforms simply ignore this field.
+        // Convert sampleSize (down-sample) into an equivalent scale factor and
+        // reuse the same rasterization pipeline as toImageScaled.
+        val scale = 1.0 / sampleSize.toDouble()
+        renderToImage(type, scale, callback)
+    }
+
+    /**
+     * H5-only entry that takes a caller-requested upscale factor instead of
+     * sampleSize. Larger scale => higher-resolution snapshot, bounded by
+     * [MAX_CANVAS_SIDE] internally.
+     */
+    private fun toImageScaled(params: String?, callback: KuiklyRenderCallback?) {
+        val json = JSONObject(params ?: "{}")
+        val type = json.optString(TO_IMAGE_PARAM_TYPE).ifEmpty { TO_IMAGE_TYPE_DATA_URI }
         val scale = max(MIN_TO_IMAGE_SCALE, json.optDouble(TO_IMAGE_PARAM_SCALE, 1.0))
+        renderToImage(type, scale, callback)
+    }
 
+    /**
+     * Core rasterization used by both [toImage] and [toImageScaled].
+     *
+     * @param type   one of [TO_IMAGE_TYPE_CACHE_KEY] / [TO_IMAGE_TYPE_DATA_URI] / [TO_IMAGE_TYPE_FILE]
+     * @param scale  extra size factor applied on top of devicePixelRatio.
+     *               `1.0` = same visual density as the screen; `2.0` = 2x larger bitmap; etc.
+     *               For the sampleSize semantics used by [toImage], pass `1 / sampleSize`.
+     */
+    private fun renderToImage(type: String, scale: Double, callback: KuiklyRenderCallback?) {
         if (type == TO_IMAGE_TYPE_FILE) {
             callback?.invoke(toImageError("FILE is not supported on H5"))
             return
@@ -184,18 +211,17 @@ open class KRView : IKuiklyRenderViewExport {
         //   3) Keep sub-pixel size as float to avoid rounding-induced re-layout.
         //   4) Snapshot each <canvas> backing store into an <img data:...> replacement
         //      inside the clone, otherwise cloneNode(true) loses the pixel content.
-        //   5) Scale output bitmap by devicePixelRatio (divided by sampleSize) so the
-        //      snapshot stays crisp on Retina/HiDPI screens. Cap final canvas side to
-        //      MAX_CANVAS_SIDE to avoid hitting browser canvas size limits.
+        //   5) Scale output bitmap by devicePixelRatio (multiplied by the caller-
+        //      requested scale factor) so the snapshot stays crisp on Retina/HiDPI
+        //      screens. Cap final canvas side to MAX_CANVAS_SIDE to avoid hitting
+        //      browser canvas size limits.
         val rect = ele.getBoundingClientRect()
         val widthF = if (rect.width > 0.0) rect.width else 1.0
         val heightF = if (rect.height > 0.0) rect.height else 1.0
         val dprRaw = kuiklyWindow.asDynamic().devicePixelRatio.unsafeCast<Double?>() ?: 1.0
         val dpr = if (dprRaw > 0.0) dprRaw else 1.0
-        // sampleSize keeps its "down-sample" semantics: 1 = full quality, 2 = half, etc.
-        // scale is an H5-only extra upscale factor requested by the caller (default 1.0).
-        // Total zoom combines DPR upscale, caller-requested scale, and sampleSize downscale.
-        val zoom = max(dpr * scale / sampleSize.toDouble(), MIN_TO_IMAGE_ZOOM)
+        // Total zoom = DPR upscale x caller-requested scale.
+        val zoom = max(dpr * scale, MIN_TO_IMAGE_ZOOM)
         val rawOutW = widthF * zoom
         val rawOutH = heightF * zoom
         val sideFit = min(1.0, min(MAX_CANVAS_SIDE / rawOutW, MAX_CANVAS_SIDE / rawOutH))
@@ -996,6 +1022,7 @@ open class KRView : IKuiklyRenderViewExport {
         private const val SCREEN_FRAME_PAUSE = "screenFramePause"
         private const val BRING_TO_FRONT = "bringToFront"
         private const val TO_IMAGE = "toImage"
+        private const val TO_IMAGE_SCALED = "toImageScaled"
 
         private const val TO_IMAGE_PARAM_TYPE = "type"
         private const val TO_IMAGE_PARAM_SAMPLE_SIZE = "sampleSize"
```

**File**: `core/src/commonMain/kotlin/com/tencent/kuikly/core/base/DeclarativeBaseView.kt` (modified, +27/-9)
```diff
@@ -293,28 +293,46 @@ abstract class DeclarativeBaseView<A : Attr, E : Event> : AbstractBaseView<A, E>
      *
      * @param type 截图类型
      * @param sampleSize 采样率，取值大于或等于1，默认1
-     * @param scale 输出放大倍数，默认1.0；仅H5平台生效，其它平台会忽略该参数。
-     *              取值范围建议 (0, 3.0]，超过浏览器 Canvas 极限时会被内部兜底约束。
      * @param callback 格式：{ code: Int, data: String?, message: String? }，
      * code：0成功，非0失败；
      * data：缓存key（可用于Image的src）或base64串或文件path，仅成功有该字段；
      * message：错误信息，仅失败有该字段。
      */
-    fun toImage(
-        type: ImageType,
-        sampleSize: Int = 1,
-        scale: Float = 1.0f,
-        callback: CallbackFn
-    ) {
+    fun toImage(type: ImageType, sampleSize: Int = 1, callback: CallbackFn) {
         performTaskWhenRenderViewDidLoad {
             val params = JSONObject()
                 .put("type", type.value)
                 .put("sampleSize", max(1, sampleSize))
-                .put("scale", max(0.01f, scale).toDouble())
                 .toString()
             renderView?.callMethod("toImage", params, callback)
         }
     }
+
+    /**
+     * 获取View截图（带输出放大倍数）
+     * 注：目前仅 H5 平台实现。业务希望截图分辨率更大时可使用此方法。
+     *
+     * 与 [toImage] 的区别：
+     *  - 没有 `sampleSize` 参数（不做下采样）。
+     *  - 新增 `scale` 参数，表示在原始 CSS 尺寸基础上的放大倍数，值越大截图越大越清晰。
+     *  - 实际输出边长会被 H5 端的 Canvas 上限（4096px）兜底约束。
+     *
+     * @param type 截图类型
+     * @param scale 输出放大倍数，默认1.0，取值建议 (0, 3.0]
+     * @param callback 格式：{ code: Int, data: String?, message: String? }，
+     * code：0成功，非0失败；
+     * data：缓存key（可用于Image的src）或base64串或文件path，仅成功有该字段；
+     * message：错误信息，仅失败有该字段。
+     */
+    fun toImageScaled(type: ImageType, scale: Float = 1.0f, callback: CallbackFn) {
+        performTaskWhenRenderViewDidLoad {
+            val params = JSONObject()
+                .put("type", type.value)
+                .put("scale", max(0.01f, scale).toDouble())
+                .toString()
+            renderView?.callMethod("toImageScaled", params, callback)
+        }
+    }
 }
 
 class ViewRef<T : DeclarativeBaseView<*, *>>(
```

**File**: `demo/src/commonMain/kotlin/com/tencent/kuikly/demo/pages/demo/ToImageExamplePage.kt` (modified, +39/-19)
```diff
@@ -45,25 +45,46 @@ internal class ToImageExamplePage : BasePager() {
     private var snapshotResultSrc by observable("")
     private var alternating by observable(false)
 
-    private fun runToImageTest(
+    private fun runToImageTest(type: DeclarativeBaseView.ImageType, sampleSize: Int, label: String) {
+        alternating = !alternating
+        viewRef?.view?.toImage(type, sampleSize) {
+            val code = it?.optInt("code") ?: -1
+            val data = it?.optString("data") ?: ""
+            val message = it?.optString("message") ?: ""
+            val success = code == 0 && data.isNotEmpty()
+
+            KLog.d(
+                TAG,
+                "toImage[$label], success: $success, code: $code, sampleSize: $sampleSize, data: $data, message: $message"
+            )
+
+            snapshotInfo = "[$label] code=$code, sampleSize=$sampleSize, message=$message"
+            if (success) {
+                snapshotResultSrc = data
+            }
+        }
+    }
+
+    // H5-only: verify the new toImageScaled API which supports an output
+    // upscale factor instead of sampleSize.
+    private fun runToImageScaledTest(
         type: DeclarativeBaseView.ImageType,
-        sampleSize: Int,
-        label: String,
-        scale: Float = 1.0f
+        scale: Float,
+        label: String
     ) {
         alternating = !alternating
-        viewRef?.view?.toImage(type, sampleSize, scale) {
+        viewRef?.view?.toImageScaled(type, scale) {
             val code = it?.optInt("code") ?: -1
             val data = it?.optString("data") ?: ""
             val message = it?.optString("message") ?: ""
             val success = code == 0 && data.isNotEmpty()
 
             KLog.d(
                 TAG,
-                "toImage[$label], success: $success, code: $code, sampleSize: $sampleSize, scale: $scale, data: $data, message: $message"
+                "toImageScaled[$label], success: $success, code: $code, scale: $scale, data: $data, message: $message"
             )
 
-            snapshotInfo = "[$label] code=$code, sampleSize=$sampleSize, scale=$scale, message=$message"
+            snapshotInfo = "[$label] code=$code, scale=$scale, message=$message"
             if (success) {
                 snapshotResultSrc = data
             }
@@ -284,8 +305,9 @@ internal class ToImageExamplePage : BasePager() {
                         }
                     }
 
-                    // H5-only: caller-requested upscale factor. Default 1.0 keeps behavior
-                    // identical to before. Larger values yield a higher-resolution snapshot
+                    // H5-only: caller-requested upscale factor via the new
+                    // toImageScaled API. Default 1.0 keeps behavior identical to
+                    // toImage. Larger values yield a higher-resolution snapshot
                     // (bounded internally by MAX_CANVAS_SIDE).
                     View {
                         attr {
@@ -299,16 +321,15 @@ internal class ToImageExamplePage : BasePager() {
                             attr {
                                 fontSize(14.0f)
                                 color(Color.WHITE)
-                                text("DATA_URI (scale=2.0)")
+                                text("toImageScaled DATA_URI (scale=2.0)")
                             }
                         }
                         event {
                             click {
-                                ctx.runToImageTest(
+                                ctx.runToImageScaledTest(
                                     DeclarativeBaseView.ImageType.DATA_URI,
-                                    1,
-                                    "DATA_URI-scale2",
-                                    2.0f
+                                    2.0f,
+                                    "Scaled-DATA_URI-2x"
                                 )
                             }
                         }
@@ -326,16 +347,15 @@ internal class ToImageExamplePage : BasePager() {
                             attr {
                                 fontSize(14.0f)
                                 color(Color.WHITE)
-                                text("DATA_URI (scale=3.0)")
+                                text("toImageScaled DATA_URI (scale=3.0)")
                             }
                         }
                         event {
                             click {
-                                ctx.runToImageTest(
+                                ctx.runToImageScaledTest(
                                     DeclarativeBaseView.ImageType.DATA_URI,
-                                    1,
-                                    "DATA_URI-scale3",
-                                    3.0f
+                                    3.0f,
+                                    "Scaled-DATA_URI-3x"
                                 )
                             }
                         }
```

**File**: `docs/API/components/basic-attr-event.md` (modified, +34/-2)
```diff
@@ -1616,7 +1616,6 @@ internal class AppearPercentageEventPage : BasePager() {
 |:----------|:-------------------------|:------| 
 | type        | 截图类型 | ImageType |
 | sampleSize | 采样率，取值大于或等于1，默认1 | Int |
-| scale | 输出放大倍数，默认1.0，取值建议 (0, 3.0]。**仅 H5 平台生效**，其它平台会忽略此参数。用于在原有 DPR/采样率基础上再放大输出图片分辨率；实际输出边长会被浏览器 Canvas 上限（4096px）兜底 | Float |
 | callback | 回调函数，格式：{ code: Int, data: String?, message: String? } | CallbackFn |
 
 </div>
@@ -1715,9 +1714,42 @@ internal class ToImageExamplePage : BasePager() {
 
 - 使用 `ref` 获取View引用，然后调用 `toImage` 方法
 - `sampleSize` 参数用于控制图片质量，值越大图片越小但处理更快
-- `scale` 参数（仅 H5 生效）用于**放大**输出图片分辨率，默认 1.0；例如业务需要更清晰的截图可以传 2.0 或 3.0。像素数会随 `scale²` 增长，请按需使用
 - 回调函数中需要检查 `code` 字段判断是否成功
 - 成功时，`data` 字段包含图片数据（根据 `type` 参数不同，可能是缓存key、base64字符串或文件路径）
 - **重要：** 使用 `CACHE_KEY` 模式时，缓存生命周期跟随页面，多次调用 `toImage` 会产生多个缓存，建议在不再需要时清理以避免内存泄漏 
 
 :::
+
+### toImageScaled方法<Badge text="仅 H5" type="warn"/>
+
+获取View截图，与 [toImage](#toimage方法) 相似，但使用**输出放大倍数**代替采样率。适用于业务需要得到更高分辨率截图的场景。
+
+> 目前仅 H5 平台实现；其它平台调用会回调失败。
+
+<div class="table-01">
+
+| 参数        | 描述 | 类型    |
+|:----------|:-------------------------|:------| 
+| type        | 截图类型，同 [toImage](#toimage方法) | ImageType |
+| scale | 输出放大倍数，默认 1.0，取值建议 (0, 3.0]。值越大输出图片越大、越清晰；实际输出边长会被浏览器 Canvas 上限（4096px）兜底 | Float |
+| callback | 回调函数，格式：{ code: Int, data: String?, message: String? } | CallbackFn |
+
+</div>
+
+**示例：**
+
+```kotlin
+ctx.viewRef?.view?.toImageScaled(DeclarativeBaseView.ImageType.DATA_URI, 2.0f) {
+    val success = it?.optInt("code") == 0
+    val imageSrc = it?.optString("data")
+    if (success && imageSrc != null) {
+        ctx.src = imageSrc
+    }
+}
+```
+
+**说明：**
+
+- `scale` 参数在当前屏幕 DPR 基础上额外放大，例如 `scale=2.0` 会得到 2× 于屏幕密度的位图；像素数会随 `scale²` 增长，请按需使用
+- 当 `scale` 过大导致输出边长超过 4096px 时，H5 内部会自动等比例收敛，不会抛错
+- `CACHE_KEY` 模式的缓存管理规则与 [toImage](#toimage方法) 一致
```

#### Recent Merged Pull Requests:
- **PR #1773** (closed): fix(android): center rich text line height on font ascent/descent (@bytemain)
- **PR #1772** (closed): fix(compose): serialize SpanStyle.fontFamily on rich text spans (@bytemain)
- **PR #1771** (closed): fix: render rich text span backgroundColor on Android, iOS and OHOS (@bytemain)
- **PR #1770** (closed): fix(miniapp): remove root transform to keep canvas same-layer rendering alive (@gclm)
- **PR #1764** (closed): fix(compose): skip orphan canvas reset when the view owns its draw loop (Compose 混用裸 reset 致画布空白) (@bytemain)
- **PR #1760** (2026-09-24): fix: preserve Android shadows beyond view bounds (@iPel)
- **PR #1759** (closed): fix(canvas): consume-then-clear draw op queue to fix reset white screen (@bytemain)
- **PR #1758** (2026-09-23): feat(demo): add chat bubble demo(左滑删除) (@elixxli)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
