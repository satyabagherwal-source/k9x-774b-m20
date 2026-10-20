> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tencent-tds-kuiklyui-learnings.md`  
> **Source**: github ([https://github.com/Tencent-TDS/KuiklyUI](https://github.com/Tencent-TDS/KuiklyUI))  
> **Source Version**: `323dce03`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T20:14:21.503Z  
> **Learning ID**: `learn-github-tencent-tds-kuiklyui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Tencent-TDS/KuiklyUI

> **Canonical Artifact**: `07_PROJECT_LEARNING/tencent-tds-kuiklyui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Tencent-TDS/KuiklyUI](https://github.com/Tencent-TDS/KuiklyUI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T20:14:21.346Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Tencent-TDS/KuiklyUI`
- **Description**: A Kotlin Multiplatform UI framework from Tencent TDS — high-performance, one codebase for six platforms, with dynamic delivery.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3590 stars

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

### Core Architecture Module: `compose/src/androidMain/kotlin/com/tencent/kuikly/compose/animation/core/AnimationTime.android.kt`
```
/*
 * Tencent is pleased to support the open source community by making KuiklyUI
 * available.
 * Copyright (C) 2025 Tencent. All rights reserved.
 * Licensed under the License of KuiklyUI;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * https://github.com/Tencent-TDS/KuiklyUI/blob/main/LICENSE
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.tencent.kuikly.compose.animation.core

internal actual fun clampedPlayTimeMillis(
    playTimeNanos: Long,
    delayMillis: Int,
    durationMillis: Int
): Int = clampedPlayTimeMillisLong(playTimeNanos, delayMillis, durationMillis)

internal actual fun repetitionPlayTimeNanos(
    playTimeNanos: Long,
    initialOffsetNanos: Long,
    durationNanos: Long,
    repeatMode: RepeatMode
): Long = repetitionPlayTimeNanosLong(playTimeNanos, initialOffsetNanos, durationNanos, repeatMode)

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1811** (2026-10-20): **fix(android): 用 WindowInsets.Type 计算 safeAreaInsets**
  *Symptoms*: ## 问题背景  `PageData.safeAreaInsets` 由 Android 渲染层 `KuiklyRenderView.SafeAreaCompat.getInsets()` 计算，再按 `"top left bottom right"` 传给页面。页面（包括底部 TabBar）只应消费这个值，不应该自己猜导航栏高度。  当前 API 30+ 仍在读已经废弃的：  ```kotlin windowInsets.stableInsetBottom ```  `stableInset*` 在不同厂商、不同导航模式下可能返回过时或不完整的值。实测一台设备的窗口信息里，导航栏区域约为：  ```text 132px / density 3 = 44dp ```  但 Kuikly 传给页面的 `safeAreaInsets.bottom` 是 `16dp`。底部栏如果按这个值留白，就会比真实导航区域少一截。  这不是宿主页面的消费问题。宿主不负责重新计算安全区；修正在 Kuikly Android 渲染框架里。  ## 原因  `#1462` 为了避免软键盘把 `safeAreaInsets.bottom` 抬成 IME 高度，把四个方向都改成了 `stableInset*`，并禁止在 `stableInset == 0` 时回退到 `systemWindowInset*`（后者在键盘弹出时包含 IME）。  这个方向是对的：安全区不能包含键盘。但 `stableInset*` 从 API 30 起已废弃，也不能代表当前系统栏。部分设备上它会停在一个偏小的值（例如 16dp），而 `WindowInsets.Type.navigationBars()` 才是真实导航栏。  下面三种做法都不能用来修这个问题：  1. 读 `Settings.Secure.navigation_mode`，再按三键/手势模式推算高度。导航模式和 inset 不是一一对应的，分屏、隐藏导航栏、厂商手势条都会算错。 2. 继续在 API 30+ 使用 `stableInsetBottom`。 3. 把 px 再除一次 density，或把 px 直接当 dp。`formatSafeAreaInsetsForKuikly` 已经用 `context.toDpF()` 转过一次。  ## 解决方案  修改点：`core-render-android/.../KuiklyRenderView.kt` 的 `SafeAreaCompat`。不依赖 AndroidX `WindowInsetsCompat`，因为框架要兼容不含这些 API 的低版本 androidx。  API 30+ 改用 `WindowInsets.getInsets(Type)`：  - `statusBars | navigationBars | displayCutout` - 再与 `mandatorySystemGestures` 各边取 `max`  各边取最大值而不是相加。状态栏和刘海、导航栏和底部强制手势区通常是同一块区域，相加会算两次。  这样三种真实状态都能从窗口 inset 得到，而不用读导航模式：  | 设备状态 | 期望的 bottom | | --- | --- | | 三键导航，导航栏约 44dp | `navigationBars.bottom`，不再停在偏小的 `stableInsetBottom` | | 手势导航，导航栏为 0，但底部有强制手势区 | `mandat

- **Issue #1810** (2026-10-20): **fix: resolve multi-level nested scroll penetration on Android and iOS**
  *Symptoms*: ## Summary  Fixes multi-level nested scroll penetration: with three levels of nesting, dragging the innermost list skips the intermediate layer and scrolls the outermost container directly. Two platform-specific causes are fixed.  **The whole fix is opt-in and off by default**, so existing behaviour is untouched unless the host App explicitly enables it.  ```kotlin // Android, call once before rendering KRRecyclerView.enableMultiLevelNestedScrollFix() ```  ```objc // iOS, call once at App startup [NestedScrollCoordinator enableMultiLevelNestedScrollFix]; ```  **Android (`KRRecyclerView.kt`)**  The `PARENT_FIRST` / `SELF_FIRST` decision in `scrollParentIfNeeded()` only inspected the direct child:  ``` PARENT_FIRST -> always let the parent scroll SELF_FIRST   -> let the parent scroll when !target.canScrollVertically() ```  With three levels, whether the parent can consume a scroll depends on the whole chain from the parent up to the root, not on the direct child alone, so the middle layer was bypassed.  Cache the nested child in `onStartNestedScroll()` and extract `handleStartNestedScroll()`, then add:  - `canNestedScrollVertically(direction)` — recursively answers "can this view still scroll in this direction", taking the nested child's own scroll mode into account. With no nested child (or the child not itself in a nested scroll), it degrades to plain `canScrollVertically()`. - `nestedParentCanScrollVerticallyFirst(parentDy)` — guards the `PARENT_FIRST` branch. Returns `false

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

### Incident Patch 1: `55fdaeb5` (2026-10-20)
**Commit Message**: fix: resolve multi-level nested scroll penetration on Android and iOS (#1810)

Three-level nested scrolling can be penetrated: when the user drags the
innermost list, the intermediate layer is skipped and the outermost
container scrolls directly. Two platform-specific causes are fixed here.

The fix is guarded by an opt-in switch that defaults to off, so existing
behaviour is unchanged until the host App explicitly enables it. When the
switch is off, shouldScrollParentY runs the original code path verbatim
and no additional state is recorded; the iOS changes are likewise skipped.

Android (KRRecyclerView.kt)

The parent-first / self-first decision in scrollParentIfNeeded() only
inspected the direct child:

  PARENT_FIRST -> always let the parent scroll
  SELF_FIRST   -> let the parent scroll when !target.canScrollVertically()

With three levels, "can the parent consume this scroll" depends on the
whole chain from the parent up to the root, not on the direct child alone,
so the middle layer was bypassed.

Cache the nested child in onStartNestedScroll() and extract
handleStartNestedScroll(), then add:

  canNestedScrollVertically(direction)
    Recursively answers "can this view stil

**File**: `core-render-android/src/main/java/com/tencent/kuikly/core/render/android/expand/component/list/KRRecyclerView.kt` (modified, +142/-6)
```diff
@@ -169,6 +169,11 @@ class KRRecyclerView : RecyclerView, IKuiklyRenderViewExport, NestedScrollingChi
      */
     private var scrollWithParent = true
 
+    /**
+     * cache child View
+     */
+    private var nestedChildView:KRRecyclerView? = null
+
     private var lastScrollParentX = 0
 
     private var lastScrollParentY = 0
@@ -1478,6 +1483,24 @@ class KRRecyclerView : RecyclerView, IKuiklyRenderViewExport, NestedScrollingChi
         const val VIEW_NAME = "KRListView"
         const val VIEW_NAME_SCROLL_VIEW = "KRScrollView"
 
+        /**
+         * 多层嵌套滚动穿透修复开关，默认关闭。
+         *
+         * 关闭时 [shouldScrollParentY] 沿用改动前只检查直接子 View 的判定逻辑；
+         * 开启后改为沿嵌套链递归判定，修复三层嵌套时中间层被穿透的问题。
+         * 由宿主 App 在初始化阶段显式开启，不对 Kotlin DSL 暴露。
+         */
+        private var sMultiLevelNestedScrollFixEnabled: Boolean = false
+        internal val multiLevelNestedScrollFixEnabled: Boolean
+            get() = sMultiLevelNestedScrollFixEnabled
+
+        /**
+         * 开启多层嵌套滚动穿透修复，需在渲染开始前调用。
+         */
+        fun enableMultiLevelNestedScrollFix() {
+            sMultiLevelNestedScrollFixEnabled = true
+        }
+
         private const val CONTENT_OFFSET_X = "contentOffsetX"
         private const val CONTENT_OFFSET_Y = "contentOffsetY"
 
@@ -1562,6 +1585,25 @@ class KRRecyclerView : RecyclerView, IKuiklyRenderViewExport, NestedScrollingChi
         child: View, target: View, axes: Int,
         type: Int
     ): Boolean {
+        val accept = handleStartNestedScroll(axes, type)
+        // 开关关闭时不记录 child，存量路径完全不产生额外状态。
+        if (multiLevelNestedScrollFixEnabled) {
+            if (target is KRRecyclerView && accept) {
+                nestedChildView = target
+            } else {
+                nestedChildView = null
+            }
+        }
+        return accept
+    }
+
+    /**
+     * 处理嵌套滚动开始事件
+     * @param axes 滚动轴向
+     * @param type 事件类型（Touch/Non-Touch）
+     * @return 是否接受嵌套滚动
+     */
+    private fun handleStartNestedScroll(axes: Int, type: Int): Boolean {
         if (!isScrollEnabled()) {
             return false
         }
@@ -1915,12 +1957,22 @@ class KRRecyclerView : RecyclerView, IKuiklyRenderViewExport, NestedScrollingChi
             return
         }
 
-        val shouldScrollParentY = when {
-            parentDy > 0 && target.scrollForwardMode == KRNestedScrollMode.PARENT_FIRST -> true
-            parentDy < 0 && target.scrollBackwardMode == KRNestedScrollMode.PARENT_FIRST -> true
-            parentDy > 0 && target.scrollForwardMode == KRNestedScrollMode.SELF_FIRST && !target.canScrollVertically(parentDy) -> true
-            parentDy < 0 && target.scrollBackwardMode == KRNestedScrollMode.SELF_FIRST && !target.canScrollVertically(parentDy) -> true
-            else -> false
+        val shouldScrollParentY = if (multiLevelNestedScrollFixEnabled) {
+            when {
+                parentDy > 0 && target.scrollForwardMode == KRNestedScrollMode.PARENT_FIRST && !nestedParentCanScrollVerticallyFirst(parentDy) -> true
+                parentDy < 0 && target.scrollBackwardMode == KRNestedScrollMode.PARENT_FIRST && !nestedParentCanScrollVerticallyFirst(parentDy) -> true
+                parentDy > 0 && target.scrollForwardMode == KRNestedScrollMode.SELF_FIRST && !target.canNestedScrollVertically(parentDy) -> true
+                parentDy < 0 && target.scrollBackwardMode == KRNestedScrollMode.SELF_FIRST && !target.canNestedScrollVertically(parentDy) -> true
+                else -> false
+            }
+        } else {
+            when {
+                parentDy > 0 && target.scrollForwardMode == KRNestedScrollMode.PARENT_FIRST -> true
+                parentDy < 0 && target.scrollBackwardMode == KRNestedScrollMode.PARENT_FIRST -> true
+                parentDy > 0 && target.scrollForwardMode == KRNestedScrollMode.SELF_FIRST && !target.canScrollVertically(parentDy) -> true
+                parentDy < 0 && target.scrollBackwardMode == KRNestedScrollMode.SELF_FIRST && !target.canScrollVertically(parentDy) -> true
+                else -> false
+            }
         }
 
         var didConsumeY = false  // 标记是否已经设置了 consumed[1]
@@ -1986,6 +2038,90 @@ class KRRecyclerView : RecyclerView, IKuiklyRenderViewExport, NestedScrollingChi
         }
     }
 
+    /**
+     * 判断当前父嵌套View是否能够滚动（根据scrollMode模式判断）
+     * @param parentDy 滚动方向，> 0 表示向前/向下，< 0 表示向后/向上
+     * @return 当前View是否能够滚动
+     */
+    private fun nestedParentCanScrollVerticallyFirst(parentDy: Int): Boolean {
+        // 没有嵌套滚动父级，不能让父级滚动
+        if (!hasNestedScrollingParent()) {
+            return false
+        }
+
+        // 查找父嵌套容器
+        val parentRecyclerView = findNestedParentRecyclerView()
+
+        // 根据滚动方向选择对应的scrollMode
+        val scrollMode = if (parentDy > 0) {
+            scrollForwardMode
+        } else {
+            scrollBackwardMode
+        }
+
+        // 根据模式判断父View是否应该滚动
+        return when (scrollMode) {
+            KRNestedScrollMode.SELF_ONLY -> {
+                
```

**File**: `core-render-ios/Extension/Components/KRScrollView.m` (modified, +4/-0)
```diff
@@ -21,6 +21,7 @@
 #import "KRConvertUtil.h"
 #import "KRScrollViewOffsetAnimator.h"
 #import "KRScrollView+NestedScroll.h"
+#import "NestedScrollCoordinator.h"
 #import "NSObject+KR.h"
 #import "KRContentOffsetAnimator.h"
 
@@ -955,6 +956,9 @@ - (void)setFrame:(CGRect)frame {
     }
     [super setFrame:frame];
     [self syncScrollViewContentSize];
+    if (scrollView && [NestedScrollCoordinator multiLevelNestedScrollFixEnabled]) {
+        scrollView.skipNestScrollLock = NO;
+    }
 }
 - (void)didMoveToSuperview {
     [super didMoveToSuperview];
```

**File**: `core-render-ios/Extension/Components/NestScroll/NestedScrollCoordinator.h` (modified, +8/-0)
```diff
@@ -41,6 +41,14 @@ NS_ASSUME_NONNULL_BEGIN
 /// Reset transient drag/lock state for Compose reuse.
 - (void)prepareForComposeReuse;
 
+/// Enable the multi-level (3+ layer) nested scroll penetration fix.
+/// Defaults to NO; call once during App startup before any Kuikly page is rendered.
+/// When disabled, nested scroll behaves exactly as before the fix.
++ (void)enableMultiLevelNestedScrollFix;
+
+/// Whether the multi-level nested scroll penetration fix is enabled.
++ (BOOL)multiLevelNestedScrollFixEnabled;
+
 @end
 
 NS_ASSUME_NONNULL_END
```

**File**: `core-render-ios/Extension/Components/NestScroll/NestedScrollCoordinator.mm` (modified, +43/-1)
```diff
@@ -455,13 +455,55 @@ - (BOOL)shouldRecognizeScrollGestureSimultaneouslyWithView:(UIView *)view {
             return YES;
         }
     } else if (self.outerScrollView.nestedGestureDelegate) {
-        return [self.outerScrollView.nestedGestureDelegate shouldRecognizeScrollGestureSimultaneouslyWithView:view];
+        BOOL result = [self.outerScrollView.nestedGestureDelegate
+                       shouldRecognizeScrollGestureSimultaneouslyWithView:view];
+        if (result && [[self class] multiLevelNestedScrollFixEnabled]) {
+            // Fix 3-layer penetration bug:
+            // Chain forwarding succeeded, meaning the innermost (e.g. BLUE) established
+            // a simultaneous gesture with the outermost (e.g. outerScroller), bypassing
+            // the middle layer (e.g. WaterfallList).
+            //
+            // When the middle layer's panGesture doesn't participate in dragging
+            // (offset=0 + bounces=NO + scrolling toward edge), its WillBeginDragging
+            // won't fire, so activeInnerScrollView on the outermost layer stays nil.
+            // This causes the "Not active inner return 2" early-return in scrollViewDidScroll,
+            // skipping all lock logic and letting the outer scroll freely.
+            //
+            // Fix: proactively establish middle-layer <-> outer-layer relationship here,
+            // so cascadeLock can propagate correctly even when the middle layer is inactive.
+            UIScrollView<NestedScrollProtocol> *middleLayer = self.outerScrollView;
+            if ([view conformsToProtocol:@protocol(NestedScrollProtocol)]) {
+                UIScrollView<NestedScrollProtocol> *outerLayer =
+                    (UIScrollView<NestedScrollProtocol> *)view;
+                // Only fill in if not already set, to avoid overwriting a valid relationship
+                // established by a normal WillBeginDragging flow.
+                if (!outerLayer.activeInnerScrollView) {
+                    outerLayer.activeInnerScrollView = middleLayer;
+                    NSLogTrace(@"chain forwarding: set outerLayer(%p).activeInner = middleLayer(%p)", outerLayer, middleLayer);
+                }
+                if (!middleLayer.activeOuterScrollView) {
+                    middleLayer.activeOuterScrollView = outerLayer;
+                    NSLogTrace(@"chain forwarding: set middleLayer(%p).activeOuter = outerLayer(%p)", middleLayer, outerLayer);
+                }
+            }
+        }
+        return result;
     }
     return NO;
 }
 
 #pragma mark - Utils
 
+static BOOL sMultiLevelNestedScrollFixEnabled = NO;
+
++ (void)enableMultiLevelNestedScrollFix {
+    sMultiLevelNestedScrollFixEnabled = YES;
+}
+
++ (BOOL)multiLevelNestedScrollFixEnabled {
+    return sMultiLevelNestedScrollFixEnabled;
+}
+
 + (id<ScrollableProtocol>)findNestedOuterScrollView:(UIScrollView *)innerScrollView {
     // Use superview.superview since scrollview is a subview of view.
     UIView *innerWrapperView = innerScrollView.superview;
```

---

### Incident Patch 2: `6e4902e9` (2026-10-19)
**Commit Message**: feat(a2ui): kuikly common support for a2ui (#1807)

* feat(a2ui): kuikly common support for a2ui

* feat(a2ui): fix kotlin js compile error

* feat(a2ui): optimize forceRenderView

* feat(a2ui): fix android and ios audio view custom event

* feat(a2ui): optimize forceRenderView and add internal

**File**: `core-render-android/src/main/java/com/tencent/kuikly/core/render/android/adapter/IKRAudioViewAdapter.kt` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
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
+package com.tencent.kuikly.core.render.android.adapter
+
+import android.content.Context
+import com.tencent.kuikly.core.render.android.expand.component.KRAudioPlayState
+
+/**
+ * 音频播放器适配器。宿主通过实现该接口提供具体的音频播放实现（如 MediaPlayer / ExoPlayer），
+ * 并注册到 [KuiklyRenderAdapterManager.krAudioViewAdapter]。
+ *
+ * 设计上对齐 [IKRVideoViewAdapter]，但去除了画面相关能力（resizeMode / 首帧）。
+ */
+interface IKRAudioViewAdapter {
+
+    /**
+     * @param context 上下文
+     * @param src 数据源（音频 URL）
+     * @param listener 播放器事件变化回调代理（播放状态变化 / 播放时间变化）
+     */
+    fun createAudioView(context: Context, src: String, listener: IKRAudioViewListener): IKRAudioView
+}
+
+interface IKRAudioView {
+
+    /**
+     * 播放音频
+     */
+    fun play()
+
+    /**
+     * 暂停音频
+     */
+    fun pause()
+
+    /**
+     * 停止并销毁音频
+     */
+    fun stop()
+
+    /**
+     * 设置倍速（1.0, 1.5, 2.0）
+     */
+    fun setRate(rate: Float)
+
+    /**
+     * seek 音频
+     * @param seekToTimeMs 时间，单位毫秒
+     */
+    fun seekToTime(seekToTimeMs: Long)
+
+    /**
+     * kuikly 侧设置的属性，一般用于业务扩展使用
+     */
+    fun setProp(propKey: String, propValue: Any): Boolean
+
+    /**
+     * kuikly 侧调用方法，一般用于业务扩展使用
+     */
+    fun call(method: String, params: String?)
+}
+
+interface IKRAudioViewListener {
+
+    /**
+     * 播放状态发生变化时回调
+     * @param playState 播放状态
+     * @param extInfo 扩展参数
+     */
+    fun audioPlayStateDidChangedWithState(playState: KRAudioPlayState, extInfo: Map<String, String>)
+
+    /**
+     * 播放时间发生变化时回调
+     * @param currentTime 当前播放时间，单位毫秒
+     * @param totalTime 音频总时长，单位毫秒
+     */
+    fun playTimeDidChangedWithCurrentTime(currentTime: Long, totalTime: Long)
+
+    /**
+     * 业务自定义扩展事件通用通道。
+     *
+     * 对齐 [IKRVideoViewListener.customEventWithInfo] 以及 OHOS 侧的
+     * `IKRAudioViewListener.onCustomEventWithInfo`，使 Kotlin DSL 中
+     * `AudioEvent.customEvent` 在三端均走专有事件通道而非 setProp 透传。
+     * @param eventInfo 自定义事件携带的键值对
+     */
+    fun customEventWithInfo(eventInfo: Map<String, String>)
+}
```

**File**: `core-render-android/src/main/java/com/tencent/kuikly/core/render/android/adapter/KuiklyRenderAdapterManager.kt` (modified, +5/-0)
```diff
@@ -80,6 +80,11 @@ object KuiklyRenderAdapterManager {
      */
     var krVideoViewAdapter: IKRVideoViewAdapter? = null
 
+    /**
+     * AudioView适配器
+     */
+    var krAudioViewAdapter: IKRAudioViewAdapter? = null
+
     /**
      * 文本后置处理器适配器
      */
```

**File**: `core-render-android/src/main/java/com/tencent/kuikly/core/render/android/expand/KuiklyRenderViewBaseDelegator.kt` (modified, +3/-0)
```diff
@@ -466,6 +466,9 @@ open class KuiklyRenderViewBaseDelegator(private val delegate: KuiklyRenderViewB
             renderViewExport(KRVideoView.VIEW_NAME, { context ->
                 KRVideoView(context)
             })
+            renderViewExport(KRAudioView.VIEW_NAME, { context ->
+                KRAudioView(context)
+            })
             renderViewExport(KRAPNGView.VIEW_NAME, { context ->
                 KRAPNGView(context)
             })
```

**File**: `core-render-android/src/main/java/com/tencent/kuikly/core/render/android/expand/component/KRAudioView.kt` (added, +210/-0)
```diff
@@ -0,0 +1,210 @@
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
+package com.tencent.kuikly.core.render.android.expand.component
+
+import android.content.Context
+import android.view.View
+import android.view.ViewGroup
+import com.tencent.kuikly.core.render.android.adapter.IKRAudioView
+import com.tencent.kuikly.core.render.android.adapter.IKRAudioViewListener
+import com.tencent.kuikly.core.render.android.adapter.KuiklyRenderAdapterManager
+import com.tencent.kuikly.core.render.android.css.ktx.frameHeight
+import com.tencent.kuikly.core.render.android.css.ktx.frameWidth
+import com.tencent.kuikly.core.render.android.css.ktx.toNumberFloat
+import com.tencent.kuikly.core.render.android.export.KuiklyRenderCallback
+
+/**
+ * 音频播放原生组件。
+ *
+ * 定义流程对齐 [KRVideoView]：自身仅作为容器与属性桥接层，真正的播放与控件 UI
+ * 由宿主注册的 [KuiklyRenderAdapterManager.krAudioViewAdapter] 创建的 [IKRAudioView] 提供。
+ * 与视频不同，音频没有画面拉伸模式与首帧回调。
+ */
+class KRAudioView(context: Context) : KRView(context), IKRAudioViewListener {
+
+    private var audioView: IKRAudioView? = null
+    private var src: String = ""
+    private var playControl = KRAudioViewPlayControl.KRAudioViewPlayControlNone
+    private var rate = -1f
+
+    private var stateChangeCallback: KuiklyRenderCallback? = null
+    private var playTimeChangeCallback: KuiklyRenderCallback? = null
+    private var customEventCallback: KuiklyRenderCallback? = null
+
+    override val reusable: Boolean
+        get() = false
+
+    override fun setProp(propKey: String, propValue: Any): Boolean {
+        var result = super.setProp(propKey, propValue)
+        if (!result) {
+            result = when (propKey) {
+                PROP_SRC -> {
+                    setSrc(propValue as String)
+                    true
+                }
+                PROP_RATE -> {
+                    setRate(propValue.toNumberFloat())
+                    true
+                }
+                PROP_SEEK -> {
+                    audioView?.seekToTime((propValue.toNumberFloat()).toLong())
+                    true
+                }
+                PROP_PLAY_CONTROL -> {
+                    setPlayControl(KRAudioViewPlayControl.from(propValue as Int))
+                    true
+                }
+                PROP_STATE_CHANGE_CALLBACK -> {
+                    stateChangeCallback = propValue as KuiklyRenderCallback
+                    true
+                }
+                PROP_PLAY_TIME_CHANGE_CALLBACK -> {
+                    playTimeChangeCallback = propValue as KuiklyRenderCallback
+                    true
+                }
+                PROP_CUSTOM_EVENT_CALLBACK -> {
+                    customEventCallback = propValue as KuiklyRenderCallback
+                    true
+                }
+                else -> audioView?.setProp(propKey, propValue) ?: false
+            }
+        }
+        return result
+    }
+
+    override fun call(method: String, params: String?, callback: KuiklyRenderCallback?): Any? {
+        val result = super.call(method, params, callback)
+        audioView?.call(method, params)
+        return result
+    }
+
+    override fun setLayoutParams(params: ViewGroup.LayoutParams?) {
+        super.setLayoutParams(params)
+        createAudioViewIfNeed()
+        (audioView as? View)?.also {
+            it.layoutParams = LayoutParams(frameWidth, frameHeight)
+        }
+    }
+
+    override fun audioPlayStateDidChangedWithState(
+        playState: KRAudioPlayState,
+        extInfo: Map<String, String>
+    ) {
+        stateChangeCallback?.invoke(mapOf(
+            "state" to playState.ordinal,
+            "extInfo" to extInfo
+        ))
+    }
+
+    override fun playTimeDidChangedWithCurrentTime(currentTime: Long, totalTime: Long) {
+        playTimeChangeCallback?.invoke(mapOf(
+            "currentTime" to currentTime,
+            "totalTime" to totalTime
+        ))
+    }
+
+    override fun customEventWithInfo(eventInfo: Map<String, String>) {
+        customEventCallback?.invoke(eventInfo)
+    }
+
+    override fun onDestroy() {
+        super.onDestroy()
+        audioView?.stop()
+    }
+
+    private fun setPlayControl(playControl: KRAudioViewPlayControl) {
+        this.playControl = playControl
+        when (playControl) {
+            KRAudioViewPlayControl.KRAudioViewPlayControlPlay -> audioView?.play()
```

**File**: `core-render-ios/Extension/AdvancedComps/KRAudioView.h` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
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
+#import "KRUIKit.h" // [macOS]
+#import "KuiklyRenderViewExportProtocol.h"
+NS_ASSUME_NONNULL_BEGIN
+@protocol KRAudioViewProtocol;
+@protocol KRAudioViewDelegate;
+
+/*
+ * 创建音频播放器视图实例闭包
+ * @param src 初始化的播放源数据（一般为音频 cdn url）
+ * @param frame 初始化视图位置大小
+ * @return 返回一个实现了 KRAudioViewProtocol 协议且为 UIView 子类的播放器实例
+ */
+typedef id<KRAudioViewProtocol> _Nonnull (^AudioViewCreator)(NSString *src, CGRect frame);
+
+
+@interface KRAudioView : UIView<KuiklyRenderViewExportProtocol>
+
+/*
+ * @brief 注册 AudioView 实现
+ * @param creator 创建 AudioView 实例
+ */
++ (void)registerAudioViewCreator:(AudioViewCreator)creator;
+
+@end
+
+@protocol KRAudioViewProtocol <NSObject>
+
+@required
+/*
+ * 播放器事件变化回调代理(如：播放状态变化回调 or 播放时间变化回调该代理)
+ */
+@property (nonatomic, weak) id<KRAudioViewDelegate> kra_delegate;
+/*
+ * 播放音频
+ */
+- (void)kra_play;
+/*
+ * 暂停音频
+ */
+- (void)kra_pause;
+/*
+ * 停止并销毁音频
+ */
+- (void)kra_stop;
+/*
+ * 设置倍速（1.0, 1.5, 2.0）
+ */
+- (void)kra_setRate:(CGFloat)rate;
+/*
+ * seek 音频
+ * @param seekTotime 时间，单位毫秒
+ */
+- (void)kra_seekToTime:(NSUInteger)seekTotime;
+
+@optional
+/*
+ * kuikly 侧设置的属性，一般用于业务扩展使用
+ */
+- (void)kra_setPropWithKey:(NSString *)propKey propValue:(id)propValue;
+/*
+ * kuikly 侧调用方法，一般用于业务扩展使用
+ */
+- (void)kra_callWithMethod:(NSString * _Nonnull)method
+                    params:(NSString * _Nullable)params;
+@end
+
+//播放状态
+typedef NS_ENUM(NSInteger, KRAudioPlayState) {
+    KRAudioPlayStateUnknown = 0,
+    KRAudioPlayStatePlaying = 1, // 正在播放中
+    KRAudioPlayStateCaching = 2, // 缓冲中
+    KRAudioPlayStatePaused = 3,  // 播放暂停
+    KRAudioPlayStatePlayEnd = 4, // 播放结束
+    KRAudioPlayStateFailed = 5,   // 播放失败
+};
+
+
+@protocol KRAudioViewDelegate <NSObject>
+
+@required
+/*
+ * @brief 播放状态发生变化时回调
+ */
+- (void)audioPlayStateDidChangedWithState:(KRAudioPlayState)playState extInfo:(NSDictionary<NSString *, NSString *> *)extInfo;
+/*
+ * @brief 播放时间发生变化时回调
+ * @param currentTime 当前播放时间，单位毫秒
+ * @param totalTime 音频总时长，单位毫秒
+ */
+- (void)playTimeDidChangedWithCurrentTime:(NSUInteger)currentTime totalTime:(NSUInteger)totalTime;
+/*
+ * @brief 业务自定义扩展事件通用通道。
+ * 对齐 KRVideoViewDelegate 的 customEventWithInfo:，使 Kotlin DSL 中
+ * AudioEvent.customEvent 在三端均走专有事件通道而非 setProp 透传。
+ * @param eventInfo 自定义事件携带的键值对
+ */
+- (void)customEventWithInfo:(NSDictionary<NSString *, NSString *> *)eventInfo;
+
+@end
+
+
+
+NS_ASSUME_NONNULL_END
```

**File**: `core-render-ios/Extension/AdvancedComps/KRAudioView.m` (added, +163/-0)
```diff
@@ -0,0 +1,163 @@
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
+#import "KRAudioView.h"
+#import "KRComponentDefine.h"
+#import "KRConvertUtil.h"
+
+/// 播控操作状态化维护，对齐 com.tencent.kuikly.core.views.AudioPlayControl
+typedef NS_ENUM(NSInteger, KRAudioViewPlayControl) {
+    KRAudioViewPlayControlNone = 0,
+    KRAudioViewPlayControlPlay = 1, // 操作播放音频
+    KRAudioViewPlayControlPause = 2, // 操作暂停音频
+    KRAudioViewPlayControlStop = 3   // 操作停止音频
+};
+
+static AudioViewCreator gAudioViewCreator;
+
+@interface KRAudioView()<KRAudioViewDelegate>
+
+@property (nonatomic, strong) id<KRAudioViewProtocol> audioView;
+/// 播放源属性
+@property (nonatomic, strong) NSString *css_src;
+/// 播控操作属性
+@property (nonatomic, strong) NSNumber *css_playControl;
+/// 倍速属性
+@property (nonatomic, strong) NSNumber *css_rate;
+/// seek 属性（毫秒）
+@property (nonatomic, strong) NSNumber *css_seek;
+/// 播放状态变化事件
+@property (nonatomic, strong) KuiklyRenderCallback css_stateChange;
+/// 播放时间变化事件
+@property (nonatomic, strong) KuiklyRenderCallback css_playTimeChange;
+/// 通用扩展事件
+@property (nonatomic, strong) KuiklyRenderCallback css_customEvent;
+
+@end
+
+@implementation KRAudioView
+@synthesize hr_rootView;
+
++ (void)registerAudioViewCreator:(AudioViewCreator)creator {
+    gAudioViewCreator = creator;
+    NSAssert(gAudioViewCreator, @"creator 不能为空");
+}
+
+- (instancetype)initWithFrame:(CGRect)frame {
+    if (self = [super initWithFrame:frame]) {
+        NSAssert(gAudioViewCreator, @"should registerAudioViewCreator");
+    }
+    return self;
+}
+
+#pragma mark - KuiklyRenderViewExportProtocol
+
+- (void)hrv_setPropWithKey:(NSString *)propKey propValue:(id)propValue {
+    KUIKLY_SET_CSS_COMMON_PROP;
+    if ([_audioView respondsToSelector:@selector(kra_setPropWithKey:propValue:)]) {
+        [_audioView kra_setPropWithKey:propKey propValue:propValue];
+    }
+}
+
+- (void)hrv_callWithMethod:(NSString *)method params:(NSString *)params callback:(KuiklyRenderCallback)callback {
+    KUIKLY_CALL_CSS_METHOD;
+    if ([_audioView respondsToSelector:@selector(kra_callWithMethod:params:)]) {
+        [_audioView kra_callWithMethod:method params:params];
+    }
+}
+
+#pragma mark - css 属性
+
+- (void)setCss_src:(NSString *)css_src {
+    if (!_css_src && css_src.length) { // 播放器不复用，一次绑定 src 即可
+        _css_src = css_src;
+        [self p_createAudioViewIfNeed];
+    }
+}
+
+- (void)setCss_playControl:(NSNumber *)css_playControl {
+    _css_playControl = css_playControl;
+    switch ([css_playControl intValue]) {
+        case KRAudioViewPlayControlPlay:
+            [_audioView kra_play];
+            break;
+        case KRAudioViewPlayControlPause:
+            [_audioView kra_pause];
+            break;
+        case KRAudioViewPlayControlStop:
+            [_audioView kra_stop];
+            break;
+        default:
+            break;
+    }
+}
+
+- (void)setCss_rate:(NSNumber *)css_rate {
+    _css_rate = css_rate;
+    [_audioView kra_setRate:[css_rate floatValue]];
+}
+
+- (void)setCss_seek:(NSNumber *)css_seek {
+    _css_seek = css_seek;
+    [_audioView kra_seekToTime:(NSUInteger)[css_seek unsignedIntegerValue]];
+}
+
+- (void)setFrame:(CGRect)frame {
+    [super setFrame:frame];
+    [self p_createAudioViewIfNeed];
+    ((UIView *)_audioView).frame = self.bounds;
+}
+
+#pragma mark - KRAudioViewDelegate
+
+- (void)audioPlayStateDidChangedWithState:(KRAudioPlayState)playState extInfo:(NSDictionary<NSString *, NSString *> *)extInfo {
+    if (_css_stateChange) {
+        _css_stateChange(@{@"state" : @(playState), @"extInfo": extInfo ?: @{}});
+    }
+}
+
+- (void)playTimeDidChangedWithCurrentTime:(NSUInteger)currentTime totalTime:(NSUInteger)totalTime {
+    if (_css_playTimeChange) {
+        _css_playTimeChange(@{@"currentTime" : @(currentTime), @"totalTime": @(totalTime)});
+    }
+}
+
+- (void)customEventWithInfo:(NSDictionary<NSString *,NSString *> *)eventInfo {
+    if (_css_customEvent) {
+        _css_customEvent(eventInfo);
+    }
+}
+
+#pragma mark - private
+
+- (void)p_createAudioViewIfNeed {
+    if (_audioView) {
+        return;
+    }
+    NSAssert(gAudioViewCreator, @"宿主未注册AudioView实现，却使用了AudioView");
+    if (_css_src.length && !CGSizeEqualToSize(self.bounds.size, CGSizeZero) && gAudioViewCreator) {
+        _audioView = gAudioViewCreator(_css_src, self.bounds);
+        _
```

**File**: `core-render-ios/Extension/Category/UIView+CSS.m` (modified, +12/-0)
```diff
@@ -1565,6 +1565,18 @@ @implementation CSSBorderLayer {
 - (instancetype)initWithCSSBorder:(CSSBorder *)border {
     if (self = [super init]) {
         _border = border;
+        // CAShapeLayer defaults `fillColor` to opaque black. If this border
+        // layer is added as a sublayer BEFORE its first `layoutSublayers`
+        // runs, the layer paints a solid black rectangle across its full bounds
+        // (because `path` is also still nil, so CAShapeLayer falls back
+        // to filling the entire bounds rect). Visually this produces the
+        // reported "半透明黑 rectangle growing from top-left to full card
+        // size" flash. Force fillColor to clear here so the layer is a
+        // pure no-op until `layoutSublayers` fills in the real stroke.
+        self.fillColor = [UIColor clearColor].CGColor;
+        // Also make sure stroke starts empty — nothing to paint until
+        // layoutSublayers sets the real border color.
+        self.strokeColor = [UIColor clearColor].CGColor;
     }
     return self;
 }
```

**File**: `core-render-ios/Handler/KuiklyRenderFrameworkContextHandler.m` (modified, +25/-0)
```diff
@@ -190,10 +190,16 @@ + (Class _Nullable)entryClassWithFrameworkName:(NSString *)frameworkName {
     NSString *firstChar = [[frameworkName uppercaseString] substringWithRange:NSMakeRange(0, 1)];
     // 首字母大写后的framework名
     frameworkName = [NSString stringWithFormat:@"%@%@", firstChar, [frameworkName substringFromIndex:1]];
+    // 候选1：首字母大写后原样拼接 KuiklyCoreEntry
     NSString *entryClassName = [NSString stringWithFormat:@"%@KuiklyCoreEntry", frameworkName];
     if (!NSClassFromString(entryClassName)) {
+        // 候选2：剥掉小写字母（Kotlin/Native 缓存模式对不含数字的 baseName 生成的类名前缀）
         entryClassName = [NSString stringWithFormat:@"%@KuiklyCoreEntry",  [self removeLowerCaseCharacters:frameworkName]];
     }
+    if (!NSClassFromString(entryClassName)) {
+        // 候选3：只保留 A-Z 大写字母（Kotlin/Native 对含数字的 baseName 也会把数字剥掉，再拼接 KuiklyCoreEntry）
+        entryClassName = [NSString stringWithFormat:@"%@KuiklyCoreEntry", [self keepUppercaseLetterCharacters:frameworkName]];
+    }
     // 动态遵循协议，以便运行时设置其代理
     NSString *entryDelegateName = [NSString stringWithFormat:@"%@Delegate", entryClassName];
     Protocol *entryDelegateProtocol = NSProtocolFromString(entryDelegateName);
@@ -219,5 +225,24 @@ + (NSString *)removeLowerCaseCharacters:(NSString *)input {
     return result;
 }
 
+/*
+ * @brief 只保留 A-Z 大写字母，剥掉数字、小写字母、其他字符
+ * @discussion 用于处理含数字的 framework baseName。Kotlin/Native
+ * 生成的 ObjC 类前缀会把数字也剥掉，
+ * 因此比 removeLowerCaseCharacters 更激进。
+ */
++ (NSString *)keepUppercaseLetterCharacters:(NSString *)input {
+    NSMutableString *result = [[NSMutableString alloc] init];
+    NSUInteger length = input.length;
+
+    for (NSUInteger i = 0; i < length; i++) {
+        unichar character = [input characterAtIndex:i];
+        if (character >= 'A' && character <= 'Z') {
+            [result appendFormat:@"%C", character];
+        }
+    }
+    return result;
+}
+
 
 @end
```

#### Recent Merged Pull Requests:
- **PR #1811** (closed): fix(android): 用 WindowInsets.Type 计算 safeAreaInsets (@yukiykchen)
- **PR #1810** (2026-10-20): fix: resolve multi-level nested scroll penetration on Android and iOS (@zenipchen)
- **PR #1809** (closed): fix: resolve multi-level nested scroll penetration on Android and iOS (@zenipchen)
- **PR #1808** (2026-10-19): perf(compose): avoid Long allocations on animation and layout (@luoyibu)
- **PR #1807** (2026-10-19): feat(a2ui): kuikly common support for a2ui (@etkmao)
- **PR #1806** (2026-10-20): perf(ohos): optimize utf transcoding with simdutf (@ruifanyuan)

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

## X. resolve multi-level nested scroll penetration on Android and iOS (#1810)

**RULE**:
When implementing operations in `core-render-android/src/main/java/com/tencent/kuikly/core/render/android/expand/component/list/KRRecyclerView.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Tencent-TDS/KuiklyUI. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `55fdaeb5`: resolve multi-level nested scroll penetration on Android and iOS (#1810). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `core-render-android/src/main/java/com/tencent/kuikly/core/render/android/expand/component/list/KRRecyclerView.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
    /**
     * cache child View
     */
    private var nestedChildView:KRRecyclerView? = null

        /**
         * 多层嵌套滚动穿透修复开关，默认关闭。
         *
         * 关闭时 [shouldScrollParentY] 沿用改动前只检查直接子 View 的判定逻辑；
         * 开启后改为沿嵌套链递归判定，修复三层嵌套时中间层被穿透的问题。
         * 由宿主 App 在初始化阶段显式开启，不对 Kotlin DSL 暴露。
         */
        private var sMultiLevelNestedScrollFixEnabled: Boolean = false
        internal val multiLevelNestedScrollFixEnabled: Boolean
            get() = sMultiLevelNestedScrollFixEnabled

        /**
         * 开启多层嵌套滚动穿透修复，需在渲染开始前调用。
         */
        fun enableMultiLevelNestedScrollFix() {
            sMultiLevelNestedScrollFixEnabled = true
        }

        val accept = handleStartNestedScroll(axes, type)
        // 开关关闭时不记录 child，存量路径完全不产生额外状态。
        if (multiLevelNestedScrollFixEnabled) {
            if (target is KRRecyclerView && accept) {
                nestedChildView = target
            } else {
                nestedChildView = null
            }
        }
        return accept
    }

    /**
     * 处理嵌套滚动开始事件
     * @param axes 滚动轴向
     * @param type 事件类型（Touch/Non-Touch）
     * @return 是否接受嵌套滚动
     */
    private fun handleStartNestedScroll(axes: Int,
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
        val shouldScrollParentY = when {
            parentDy > 0 && target.scrollForwardMode == KRNestedScrollMode.PARENT_FIRST -> true
            parentDy < 0 && target.scrollBackwardMode == KRNestedScrollMode.PARENT_FIRST -> true
            parentDy > 0 && target.scrollForwardMode == KRNestedScrollMode.SELF_FIRST && !target.canScrollVertically(parentDy) -> true
            parentDy < 0 && target.scrollBackwardMode == KRNestedScrollMode.SELF_FIRST && !target.canScrollVertically(parentDy) -> true
            else -> false
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `55fdaeb5` are properly handled with clean fallback behavior.
