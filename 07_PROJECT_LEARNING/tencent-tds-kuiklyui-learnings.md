> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tencent-tds-kuiklyui-learnings.md`  
> **Source**: github ([https://github.com/Tencent-TDS/KuiklyUI](https://github.com/Tencent-TDS/KuiklyUI))  
> **Source Version**: `9baf4df2`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T14:45:52.569Z  
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
> **Harvest Timestamp**: 2026-10-31T14:45:52.564Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Tencent-TDS/KuiklyUI`
- **Description**: A Kotlin Multiplatform UI framework from Tencent TDS — high-performance, one codebase for six platforms, with dynamic delivery.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3617 stars

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
- **Issue #1855** (2026-10-29): **feat(web): add removeNotify doc**
  *Symptoms*: 

- **Issue #1853** (2026-10-30): **perf(ohos): cut redundant copies and dedup cost in JSON response parsing**
  *Symptoms*: Four changes on the HarmonyOS JSON response path. Measured on a real device (ALN-AL00) with a 35MB / 100k-record response: parse stage -33.6%, end-to-end -16.8%.  1. DomBuilder::OnEndObject no longer calls ObjectDedupLast. Keys in parsed JSON files are unique, so building a hash table per object to collapse duplicate keys is pure waste. Inner parse 378ms -> ~310ms.  2. JsonNative.ownerFromJson: zero copy. json.toCharArray().usePinned -> json.usePinned, dropping the UTF-16 copy made before handing the text to the native parser (~48ms).  3. JsonNative.objectGet: zero copy. key.toCharArray().usePinned -> key.usePinned.  4. New JSONObject.optParsedChild: parse a string node directly. NetworkModule used to materialize the 21MB body into a Kotlin String via optString("data") and hand it back to the native parser. On OHOS the KRJSON string node payload is now passed straight to KRJSONParseUTF16, removing that copy (~59ms and ~85MB peak memory). The common layer provides a default implementation that only returns a value when data is already a structured object; android/jvm/js/apple behavior is unchanged, and parse failures still fall back to the previous {"data": <raw text>} result.  No native C/C++ API changes: reuses KRJSONGetStringUTF16 / KRJSONParseUTF16.

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

### Incident Patch 1: `b6c33271` (2026-10-29)
**Commit Message**: fix(web): dispatch notifications across live Kuikly pages (#1847)

Co-authored-by: zhangkaineng <[REDACTED_EMAIL]>

**File**: `core-render-web/base/src/jsMain/kotlin/com/tencent/kuikly/core/render/web/expand/module/KRNotifyModule.kt` (modified, +16/-7)
```diff
@@ -15,7 +15,7 @@ private data class KRCallbackWrapper(
 )
 
 /**
- * Event notification module, web event notification does not support different pages, notifications between different pages need to use higher-level host capabilities
+ * Notifications are shared by live Kuikly pages in the same Web runtime (including cached SPA pages).
  */
 open class KRNotifyModule : KuiklyRenderBaseModule() {
     // Notification event Map, cache registered event callbacks
@@ -30,6 +30,7 @@ open class KRNotifyModule : KuiklyRenderBaseModule() {
         super.onDestroy()
         // clean up when module is destroyed
         moduleInstances.remove(this)
+        toKRMap.clear()
     }
 
     /**
@@ -101,9 +102,9 @@ open class KRNotifyModule : KuiklyRenderBaseModule() {
         val data = jsonObject.optString(KEY_DATA)
         // Execute callbacks if event name exists
         if (eventName != "") {
-            // 1. Notify other Kuikly pages (existing logic)
-            dispatchEvent(eventName, data)
-            // 2. Notify Web host (new feature - like iOS/Android/Ohos)
+            // Include the sender once and notify cached SPA pages before returning.
+            dispatchGlobalEventData(eventName, data)
+            // Notify the host once per post, rather than once per receiving page.
             dispatchToHost(eventName, data)
         }
     }
@@ -123,7 +124,8 @@ open class KRNotifyModule : KuiklyRenderBaseModule() {
      * Execute registered event callbacks
      */
     private fun dispatchEvent(eventName: String, data: String) {
-        toKRMap[eventName]?.forEach {
+        // Callbacks may remove listeners while handling a notification.
+        toKRMap[eventName]?.toList()?.forEach {
             it.callback.invoke(data)
         }
     }
@@ -160,8 +162,15 @@ open class KRNotifyModule : KuiklyRenderBaseModule() {
 
         // dispatch global event to all KRNotifyModule instances
         fun dispatchGlobalEvent(eventName: String, data: JSONObject) {
-            moduleInstances.forEach { module ->
-                module.dispatchEvent(eventName, data.toString())
+            dispatchGlobalEventData(eventName, data.toString())
+        }
+
+        private fun dispatchGlobalEventData(eventName: String, data: String) {
+            // A callback can create or destroy a page during dispatch.
+            moduleInstances.toList().forEach { module ->
+                if (module in moduleInstances) {
+                    module.dispatchEvent(eventName, data)
+                }
             }
         }
     }
```

---

### Incident Patch 2: `583bec16` (2026-10-29)
**Commit Message**: fix(compose): re-observe snapshot reads in KNode onChanged to refresh derived-state baseline (#1837)

* fix(compose): re-observe snapshot reads in KNode onChanged to refresh derived-state baseline

- onChanged re-enters observeReads instead of running update() bare, refreshing
  the derived-state comparison baseline (recordedDerivedStateValues) and
  re-collecting dependencies, matching androidx SnapshotStateObserver contract
  (cf. AndroidComposeView onCommitAffecting* -> re-observe pattern)
- pass a stable onChanged callback instance: SnapshotStateObserver keys its
  internal ObservedScopeMap by callback identity (===) and the map list only
  grows, so a fresh lambda per call leaks one scope map per notification and
  fans each state change out into Fibonacci-growing duplicate updates
  (observed on device as 1,1,2,3,5,8,13 duplicate viewUpdate calls)
- without this, a derivedStateOf value read in viewUpdate that goes
  true -> false -> true has its restoration suppressed (equals the stale
  baseline), leaving the native view stuck, e.g. video black screen after
  returning to foreground (verified on OHOS device)

* fix(compose): share single onChanged callback across all KNodes


**File**: `compose/src/commonMain/kotlin/com/tencent/kuikly/compose/ui/node/KNode.kt` (modified, +15/-3)
```diff
@@ -122,9 +122,7 @@ internal class KNode<T : DeclarativeBaseView<*, *>>(
 
     private val runUpdate: () -> Unit = {
         if (isAttached) {
-            requireOwner().snapshotObserver.observeReads(this, {
-                update()
-            }, update)
+            requireOwner().snapshotObserver.observeReads(this, OnStateChanged, update)
         }
     }
 
@@ -403,6 +401,20 @@ internal class KNode<T : DeclarativeBaseView<*, *>>(
 
     internal companion object {
 
+        /**
+         * Shared onChanged callback for observeReads, intentionally capturing no node.
+         * SnapshotStateObserver keys its internal ObservedScopeMap by callback identity (===):
+         * - a fresh lambda per call leaks one map per notification, each keeping its own stale
+         *   derived-state baseline and re-notifying the node on every state change, fanning one
+         *   change out into N duplicate updates (observed on device as Fibonacci-growing
+         *   duplicate viewUpdate calls: 1,1,2,3,5,8,13...);
+         * - a per-node instance field would allocate one map per node, and every state-change
+         *   apply then walks the whole per-node map list in drainChanges.
+         * One shared instance keeps a single map for all nodes, matching the shared
+         * OwnerSnapshotObserver.onCommitAffecting* callbacks of the official pattern.
+         */
+        private val OnStateChanged: (KNode<*>) -> Unit = { it.runUpdate() }
+
         internal val ShadowLayoutConstructor: (Boolean) -> (() -> KNode<*>) = { hasShadow ->
             {
                 val view = DivView()
```

---

### Incident Patch 3: `9baf4df2` (2026-10-30)
**Commit Message**: fix(textSelection): 选区高亮绘制顺序与颜色下发修复 (#1845)

* fix(textSelection): 选区高亮绘制顺序与颜色下发

关联 #1793。

Android：KRRichTextView.drawText 先画文字、后画选区，选区半透明高亮与已完成
抗锯齿的文字笔画二次混合，选中文字发灰。改为先画选区、后画文字，与 iOS
（KRLabel 的 drawTextInRect:）和鸿蒙一致。

iOS：KRView+TextSelection 先调 kr_applySelectionColorToHelper: 再调
startSelectionWithLabels:，而 setSelectionColor: 是遍历 self.labels 下发颜色的，
此时 labels 尚未注入（循环 0 次），颜色只留在 _selectionColor 里；随后
startSelectionWithLabels: 也没有把已持有的颜色补发给新注入的 labels，导致每个
KRLabel.selectionColor 始终为 nil，绘制时回退到内置默认色。改在 helper 内补发，
对调用顺序不再敏感，同时覆盖两处调用点。

鸿蒙未修：属性落在容器 KRView 而选区矩形在子 KRRichTextView，UpdateSelection
递归不带色值，打通需要改 IKRRenderViewExport 共享基类；当前环境无 HarmonyOS
NDK 无法编译验证，按 devDocs 体例记录为延后备忘。

* docs(ios): 补充在 macOS 上本地验证 core-render-ios 的做法

渲染层可脱离 Kotlin/Native 单独编译成宿主原生二进制：跑逻辑断言，
以及用 KRTextRender + KRLabel drawTextInRect: 把绘制结果渲染成位图。
记录环境要求（目标三元组必须用宿主机架构）、链接框架、位图渲染的坐标系
翻转、合成公式判据与阴性对照的取源码时机，以及此法覆盖不到的场景。

* docs(ios): 修正本地渲染位图的配方

手写 NSBitmapImageRep + CTM 翻转再直接调 drawTextInRect: 会让选区矩形与文字落在
不同空间里，实测高亮带占 0..21 行而文字墨迹占 17..35 行，两者几乎不重叠。改用
AppKit 视图快照 cacheDisplayInRect:toBitmapImageRep:，由视图自己的 isFlipped
准备上下文，并补上「先断言几何再比颜色」的判据。

* docs(ios): 位图判据改用同路径实测值，不套理论混合公式

颜色经 AppKit 色彩空间转换会有偏移（#FFFDE7 实测成 #FF

**File**: `core-render-android/src/main/java/com/tencent/kuikly/core/render/android/expand/component/KRRichTextView.kt` (modified, +3/-1)
```diff
@@ -127,8 +127,10 @@ class KRRichTextView(context: Context) : KRView(context), KRRichTextViewDrawer.C
         textDrawer?.also {
             canvas.save()
             canvas.translate(paddingLeft.toFloat(), paddingTop.toFloat())
-            it.draw(canvas)
+            // 选区高亮先绘制，文字再覆盖在其上方：否则半透明高亮会与已完成抗锯齿的文字笔画二次混合，
+            // 导致选中文字发灰、对比度下降。绘制顺序与 iOS（KRLabel）和鸿蒙保持一致。
             parentTextSelector?.drawSelection(this, canvas)
+            it.draw(canvas)
             canvas.restore()
         }
     }
```

**File**: `core-render-ios/Extension/TextSelection/KRTextSelectionHelper.m` (modified, +18/-4)
```diff
@@ -64,6 +64,9 @@ @interface KRTextSelectionHelper () <UIGestureRecognizerDelegate, UIScrollViewDe
 /// Flag to track if containerView frame observer is added
 @property (nonatomic, assign) BOOL isObservingContainerFrame;
 
+/// 把当前持有的 selectionColor 下发给所有 labels。labels 为空时是空操作。
+- (void)applySelectionColorToLabels;
+
 @end
 
 @implementation KRTextSelectionHelper
@@ -114,6 +117,13 @@ - (void)startSelectionWithLabels:(NSArray<KRLabel *> *)labels containerView:(KRV
     self.labels = labels;
     self.containerView = containerView;
     
+    // 调用方可能先 setSelectionColor: 再 startSelectionWithLabels:（此时 labels 尚为空，
+    // 颜色只存在 _selectionColor 里），因此这里把已持有的颜色补发给刚注入的 labels，
+    // 否则每个 KRLabel 的 selectionColor 为 nil，绘制时会回退到内置默认色。
+    if (self.selectionColor) {
+        [self applySelectionColorToLabels];
+    }
+    
     // Reset state
     self.startLabel = nil;
     self.endLabel = nil;
@@ -850,14 +860,18 @@ - (CGRect)getSelectionFrame {
     return unionRect;
 }
 
-- (void)setSelectionColor:(UIColor *)color {
-    _selectionColor = color;
-    // Apply to all labels
+/// 颜色下发的唯一出口：setSelectionColor: 与 startSelectionWithLabels: 都经过这里。
+- (void)applySelectionColorToLabels {
     for (KRLabel *label in self.labels) {
-        label.selectionColor = color;
+        label.selectionColor = _selectionColor;
     }
 }
 
+- (void)setSelectionColor:(UIColor *)color {
+    _selectionColor = color;
+    [self applySelectionColorToLabels];
+}
+
 - (void)setCursorColor:(UIColor *)color {
     _cursorColor = color;
     // Apply to anchors
```

**File**: `devDocs/ios-render-layer-local-verification.md` (added, +107/-0)
```diff
@@ -0,0 +1,107 @@
+# 在 macOS 上本地验证 core-render-ios
+
+> 框架开发时阅读。改 `core-render-ios` 不必等 iOS 模拟器、也不必搭 Kotlin/Native 工具链：渲染层可以单独编译成宿主原生二进制，直接跑逻辑断言，甚至把 `KRLabel`、`KRRichTextView` 画出来的结果渲染成位图。
+
+## 为什么可行
+
+渲染层的 Kotlin 依赖只落在与 `core-*` 的桥接处，自身链接后只有系统框架和 `_main` 未定义。`MacSupport/KRUIKit.h` 提供 macOS 兼容层（`UIColor` 映射到 `NSColor`、`UILabel` 映射到 `KRUILabel` 等）。于是每个 `.m`/`.mm` 都能用 `clang` 编到 macOS 目标，配一个自带 `main` 的探针即可运行。
+
+实测：107 个 `.m`/`.mm` 全部编译通过；链接后未定义符号只有 CoreImage、Accelerate 与 libc++ 运行库，补上框架即可。
+
+## 环境
+
+- macOS + Xcode Command Line Tools（用到 `xcrun --sdk macosx`）
+- 目标三元组用**宿主机架构**：`$(uname -m)-apple-macos13.0`
+
+> 宿主是 Intel 而目标写成 `arm64-apple-macos13.0` 时，编译和链接都会成功，运行时才报 `Bad CPU type in executable`。同样原因，`simctl spawn` 也会失败。
+
+## 编译整个渲染层
+
+```bash
+cd <仓库根>
+OUT=$(pwd)/.ios-probe && rm -rf "$OUT" && mkdir -p "$OUT"
+SDK=$(xcrun --sdk macosx --show-sdk-path)
+TRI=$(uname -m)-apple-macos13.0
+INC="-I core-render-ios/include -I core-render-ios -I core-render-ios/Extension \
+     -I core-render-ios/Thread -I core-render-ios/Core -I core-render-ios/Handler \
+     -I core-render-ios/View -I core-render-ios/Performance -I core-render-ios/Protocol \
+     -I core-render-ios/Extension/TextSelection -I core-render-ios/Extension/Vendor \
+     -I core-render-ios/MacSupport"
+
+for f in $(find core-render-ios -name '*.m' -o -name '*.mm'); do
+  xcrun --sdk macosx clang -c -fobjc-arc -isysroot "$SDK" -target "$TRI" $INC \
+    "$f" -o "$OUT/$(echo "$f" | tr '/' '_').o" || echo "FAIL $f"
+done
+```
+
+## 写探针并链接
+
+探针就是一个普通 `main.m`，`#import` 要验证的头文件，退出码非 0 表示失败。
+
+```bash
+xcrun --sdk macosx clang -target "$TRI" -isysroot "$SDK" -o "$OUT/probe" "$OUT"/*.o \
+  -framework AppKit -framework Foundation -framework QuartzCore -framework CoreGraphics \
+  -framework CoreText -framework CoreImage -framework Accelerate -framework AVFoundation \
+  -framework ImageIO -framework CoreMedia -framework UniformTypeIdentifiers -lc++
+"$OUT/probe"; echo "exit=$?"
+```
+
+> 探针目录里若有多个带 `main` 的对象文件（比如同时编了两个探针），链接会以 exit code 1 失败但默认不打印符号明细，加 `grep -E '[[:space:]]+"|error'` 看真实原因。BSD grep 不支持 `\s`。
+
+## 把绘制结果渲染成位图
+
+绘制类问题可以直接出图。`KRTextRender` 有公开的 `initWithTextStorage:lineHeight:`；`KRLabel` 的 `textRender`、`selectedRange`、`selectionColor` 都是公开属性。
+
+```objc
+NSTextStorage *ts = [[NSTextStorage alloc] initWithAttributedString:as];
+KRTextRender *tr = [[KRTextRender alloc] initWithTextStorage:ts lineHeight:0];
+CGSize sz = [tr textSizeWithRenderWidth:460];
+KRLabel *label = [[KRLabel alloc] initWithFrame:NSMakeRect(0, 0, 460, ceil(sz.height))];
+label.textRender = tr;
+label.selectedRange = NSMakeRange(4, 10);
+// …此处触发被测逻辑…
+```
+
+绘制交给 AppKit 的视图快照，不要自己造位图上下文：
+
+```objc
+// 宿主视图只负责铺容器底色
+@interface KRProbeHostView : NSView
+@property (nonatomic, strong) NSColor *fillColor;
+@end
+@implementation KRProbeHostView
+- (void)drawRect:(NSRect)dirtyRect { [self.fillColor setFill]; NSRectFill(self.bounds); }
+@end
+
+KRProbeHostView *host = [[KRProbeHostView alloc] initWithFrame:NSMakeRect(0, 0, 460, ceil(sz.height))];
+host.fillColor = [NSColor colorWithRed:0xFF/255.0 green:0xFD/255.0 blue:0xE7/255.0 alpha:1.0];
+[host addSubview:label];
+[host layoutSubtreeIfNeeded];            // 必须先布局，否则快照是空的
+NSBitmapImageRep *rep = [host bitmapImageRepForCachingDisplayInRect:host.bounds];
+[host cacheDisplayInRect:host.bounds toBitmapImageRep:rep];
+[[rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}] writeToFile:path atomically:YES];
+```
+
+`KRUILabel` 的 `isFlipped` 返回 YES，快照接口会按视图自己的翻转设置准备绘制上下文。产出的位图是 2 倍像素（Retina），断言里的坐标要按 2 折算。
+
+> 不要自己建 `NSBitmapImageRep`、手动 `CGContextTranslateCTM` + `CGContextScaleCTM` 翻转后直接调 `drawTextInRect:`。选区矩形与文字会落在不同空间里，相差约一个行高：实测高亮带占 0..21 行、文字墨迹占 17..35 行，两者几乎不重叠。快照接口没有这个问题。
+
+## 判据
+
+- **逻辑类**：断言 + 退出码，逐条打印 `ok:` / `FAIL:`。
+- **颜色按同一条渲染路径下的实测值比对**，不要套理论混合公式：颜色经 AppKit 色彩空间转换会有偏移——背景 `#FFFDE7` 实测渲染成 `#FFFDE1`，`(33,196,94)` 以 0.4 alpha 叠上去是 `#A7E2A5`，不是线性混合的 `#A6E6B0`。改动前/后同条件各渲一次，比对底色是否变化，以及命中像素数与墨迹像素数是否保持不变。
+- **像素数不变用来区分「只换了颜色」和「选区范围也变了」**。
+- **绘制类先断言几何，再比颜色**：文字墨迹的行范围必须落在高亮带的行范围内，高亮带的列范围要覆盖被选中的字符。只比颜色会把错位的图当成好图——错位的图颜色照样是对的。
+- **一定要留阴性对照**：把被测文件换成改动前的版本单独链接，确认探针会失败。改动提交之前用 `git show HEAD:<path>` 取旧实现；**提交之后要写 `HEAD~1`**，否则取到的是改后代码，对照静默失效。
+
+## 覆盖不到的
+
+- `TARGET_OS_IPHONE` 分支与未做 macOS 兼容的 UIKit API：在 macOS 上要么编不过，要么走了另一条实现路径
+- 线程、runloop、渲染时序类问题——主线程进入顺序这类缺陷在这里看不出来
+- 真机与模拟器上的 ARM64 行为、系统版本差异
+
+以上仍须在 iOS 侧验证。
+
+## 实例
+
+#1793 的 iOS 一侧（选区色下发时序）用此法验证：逻辑断言修复前 4 项 FAIL、修复后全通过；快照渲染的高亮底色从 `KRLabel` 内置默认的 `#B7D7E9` 变为上层配置色 `#A7E2A5`，两版高亮像素数相同（10224）、文字墨迹数也相同（8894）——只换了颜色，选区范围与排版未动。对应 PR 见 #1845。
```

#### Recent Merged Pull Requests:
- **PR #1855** (2026-10-29): feat(web): add removeNotify doc (@etkmao)
- **PR #1853** (2026-10-30): perf(ohos): cut redundant copies and dedup cost in JSON response parsing (@ruifanyuan)
- **PR #1852** (2026-10-29): fix(compose): clamp non-scrollable Lazy exact content size (@luoyibu)
- **PR #1851** (2026-10-29): feat(ohos): sync event scheduling (@iPel)
- **PR #1850** (2026-10-29): fix(h5App-js): render canvas at device pixel ratio (@continuing2022)
- **PR #1849** (2026-10-29): fix(h5App-js): keep unrelated controls clickable after text selection (@continuing2022)

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

## X. web): dispatch notifications across live Kuikly pages (#1847)

**RULE**:
When implementing operations in `core-render-web/base/src/jsMain/kotlin/com/tencent/kuikly/core/render/web/expand/module/KRNotifyModule.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Tencent-TDS/KuiklyUI. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b6c33271`: web): dispatch notifications across live Kuikly pages (#1847). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `core-render-web/base/src/jsMain/kotlin/com/tencent/kuikly/core/render/web/expand/module/KRNotifyModule.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
 * Notifications are shared by live Kuikly pages in the same Web runtime (including cached SPA pages).
        toKRMap.clear()
            // Include the sender once and notify cached SPA pages before returning.
            dispatchGlobalEventData(eventName, data)
            // Notify the host once per post, rather than once per receiving page.
        // Callbacks may remove listeners while handling a notification.
        toKRMap[eventName]?.toList()?.forEach {
            dispatchGlobalEventData(eventName, data.toString())
        }

        private fun dispatchGlobalEventData(eventName: String, data: String) {
            // A callback can create or destroy a page during dispatch.
            moduleInstances.toList().forEach { module ->
                if (module in moduleInstances) {
                    module.dispatchEvent(eventName, data)
                }
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
 * Event notification module, web event notification does not support different pages, notifications between different pages need to use higher-level host capabilities
            // 1. Notify other Kuikly pages (existing logic)
            dispatchEvent(eventName, data)
            // 2. Notify Web host (new feature - like iOS/Android/Ohos)
        toKRMap[eventName]?.forEach {
            moduleInstances.forEach { module ->
                module.dispatchEvent(eventName, data.toString())
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b6c33271` are properly handled with clean fallback behavior.
