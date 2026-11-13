# Verification Protocol: Verification Protocol: Empirical Defect Shield for tencent-tds-kuiklyui-learnings

<!-- PROVENANCE_START
{
  "source_repository": "tencent-tds-kuiklyui-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:45:40.043Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-tencent-tds-kuiklyui-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tencent-tds-kuiklyui-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:45:40.043Z`  
> **Learning ID**: `LEARN-REEXTRACT-tencent-tds-kuiklyui-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `tencent-tds-kuiklyui-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tencent-tds-kuiklyui-learnings.md`  
> **Source**: github ([https://github.com/Tencent-TDS/KuiklyUI](https://github.com/Tencent-TDS/KuiklyUI))  
> **Source Version**: `d54d2ba1`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T14:16:42.571Z  
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
> **Harvest Timestamp**: 2026-11-11T14:16:42.566Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Tencent-TDS/KuiklyUI`
- **Description**: A Kotlin Multiplatform UI framework from Tencent TDS — high-performance, one codebase for six platforms, with dynamic delivery.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3636 stars

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
- **Issue #1888** (2026-11-11): **feat(compose): modifier support attr turboDisplayAutoUpdateEnable**
  *Symptoms*: feat(compose): modifier support attr turboDisplayAutoUpdateEnable

- **Issue #1885** (2026-11-10): **feat(input): 扩展 Input/TextArea 与 Compose 的 keyboardType 映射**
  *Symptoms*: 新增 Ascii/Phone/Uri/NumberPassword/Decimal 的 DSL 与三端渲染映射

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

### Incident Patch 1: `99e03f21` (2026-11-10)
**Commit Message**: fix(ohos): align paste truncation to UTF-8 boundary to avoid renderer… (#1857)

* fix(ohos): align paste truncation to UTF-8 boundary to avoid renderer abort

Pasting text longer than maxTextLength into a TextField crashed the app with
SIGABRT on HarmonyOS. OnPasteText coarsely cut the pasted buffer at
max_length_ * 4 bytes, which splits multi-byte UTF-8 sequences: 18 CJK
characters (54 bytes) cut at 40 bytes end mid-character. The malformed UTF-8
then reached ToUTF32, whose fallback std::wstring_convert throws
std::range_error, and nothing caught it.

Add kuikly::util::utf::TruncateToUTF8Boundary and use it in OnPasteText, plus
the same guard in OnWillInsertText where the framework can cut the insert
buffer at its capacity limit. ToUTF32 keeps its throwing contract, which is
deliberately aligned with Kotlin String(byteArray).

* perf(ohos): scan UTF-8 boundary from the tail

* fix(ohos): preserve insert-buffer truncation state

* refactor(ohos): simplify paste and UTF-8 boundary handling

* perf(ohos): dispatch UTF-8 boundary by trailing bytes

* perf(ohos): scan UTF-8 boundary once with fast and slow pointers

* test(ohos): keep upstream UTF boundary cases intact

**File**: `core-render-ohos/src/main/cpp/libohos_render/expand/components/input/KRTextFieldView.cpp` (modified, +18/-12)
```diff
@@ -22,6 +22,7 @@
 #include <arkui/drag_and_drop.h>
 #include <cstddef>
 #include <cstdint>
+#include <cstring>
 #include <deviceinfo.h>
 #include <regex>
 
@@ -795,11 +796,19 @@ void KRTextFieldView::OnWillInsertText(ArkUI_NodeEvent *event) {
         int32_t size = MAX_INSERT_LENGTH;
         char *pBuffer = buffer;
         OH_ArkUI_NodeEvent_GetStringValue(event, 0, &pBuffer, &size);
+        // ArkUI copies at most MAX_INSERT_LENGTH - 1 bytes, which can leave an incomplete UTF-8
+        // tail. Drop that tail before filter -> CalculateTextLength decodes the buffer.
+        buffer[MAX_INSERT_LENGTH - 1] = '\0';
+        const auto boundary = kuikly::util::utf::ScanUTF8Boundary(buffer);
+        // Trimming the incomplete tail can make the buffer shorter than the cap.
+        // Preserve the full-buffer state so the temporary max-length path still runs.
+        const bool insertBufferTruncated = boundary.length >= MAX_INSERT_LENGTH - 1;
+        buffer[boundary.boundary] = '\0';
         // KR_LOG_DEBUG << "OnWillInsertText: to insert text: " << buffer;
         auto destText = GetContentText();
         auto range = GetInputNodeTextSelectionRange();
         bool filtered = filter(buffer, destText, range.first, range.second);
-        if (filtered || strlen(buffer) >= MAX_INSERT_LENGTH - 1) {
+        if (filtered || insertBufferTruncated) {
             if (filtered) {
                 KR_LOG_DEBUG << "OnWillInsertText beyond limit";
                 // 超过最大输入长度限制
@@ -829,25 +838,22 @@ void KRTextFieldView::OnPasteText(ArkUI_NodeEvent *event) {
         if (!stringAsyncEvent || !stringAsyncEvent->pStr) {
             return;
         }
-        size_t size = std::min(strlen(stringAsyncEvent->pStr), static_cast<size_t>(max_length_) * 4);
-        // 这里只是避免拷贝超大剪贴板的粗估上限，不是语义截断（语义截断由 filter 完成）。
-        // 必须回退到字符边界：buffer 随后进入 filter → CalculateTextLength，CHARACTER /
-        // VISUAL_WIDTH 分支会对它调 ConvertToU32String，残缺序列会让长度计算与截断都失真。
-        size = kuikly::util::utf::UTF8BoundaryLength(stringAsyncEvent->pStr, size);
-        char *buffer = new char[size + 1];
-        strncpy(buffer, stringAsyncEvent->pStr, size);
-        buffer[size] = '\0';
+        // Semantic truncation happens in filter; process the full paste buffer here.
+        std::string pasteText(stringAsyncEvent->pStr);
         auto destText = GetContentText();
         auto range = GetInputNodeTextSelectionRange();
-        if (filter(buffer, destText, range.first, range.second)) {
+        const bool filtered = filter(pasteText.data(), destText, range.first, range.second);
+        if (filtered) {
+            // filter writes a NUL into the writable C++17 string buffer.
+            pasteText.resize(strlen(pasteText.data()));
             KR_LOG_DEBUG << "OnPasteText beyond limit";
             // 超过最大输入长度限制
             NotifyTextLengthBeyondLimit();
-            uint32_t realMaxLength = GetUTF16Length(destText) - (range.second - range.first) + GetUTF16Length(buffer);
+            uint32_t realMaxLength = GetUTF16Length(destText) - (range.second - range.first) +
+                                     GetUTF16Length(pasteText);
             UpdateInputNodeMaxLength(realMaxLength);
             DelayResetMaxLength();
         }
-        delete[] buffer;
     }
 }
 
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/utils/KRUtfUtil.cpp` (modified, +33/-9)
```diff
@@ -162,17 +162,41 @@ size_t UTF16Length(const std::string &input) {
     return simdutf::utf16_length_from_utf8_with_replacement(input.data(), input.size()).count;
 }
 
-size_t UTF8BoundaryLength(const char *input, size_t bytes) {
-    // A UTF-8 sequence is at most 4 bytes, so only the last 3 bytes can hold an incomplete tail.
-    for (size_t back = 1; back <= 3 && back <= bytes; ++back) {
-        const unsigned char lead = static_cast<unsigned char>(input[bytes - back]);
-        if ((lead & 0xC0) == 0x80) {
-            continue;
+UTF8BoundaryInfo ScanUTF8Boundary(const char *input) {
+    if (input == nullptr) {
+        return {0, 0};
+    }
+
+    // fast scans each byte once; slow stays on the last byte that starts a sequence.
+    const char *slow = nullptr;
+    const char *fast = input;
+    size_t leadLength = 0;
+    size_t trailingContinuations = 0;
+    while (*fast != '\0') {
+        const unsigned char byte = static_cast<unsigned char>(*fast);
+        if ((byte & 0xC0) == 0x80) {
+            ++trailingContinuations;
+        } else {
+            slow = fast;
+            leadLength = byte < 0x80 ? 1 : byte < 0xE0 ? 2 : byte < 0xF0 ? 3 : 4;
+            trailingContinuations = 0;
         }
-        const size_t sequenceLength = lead < 0x80 ? 1 : lead < 0xE0 ? 2 : lead < 0xF0 ? 3 : 4;
-        return bytes - back + sequenceLength > bytes ? bytes - back : bytes;
+        ++fast;
     }
-    return bytes;
+
+    const size_t length = static_cast<size_t>(fast - input);
+    if (slow == nullptr) {
+        // A string made only of continuation bytes keeps the existing contract.
+        return {length, length};
+    }
+    const size_t leadOffset = static_cast<size_t>(slow - input);
+    const size_t boundary =
+        trailingContinuations + 1 < leadLength ? leadOffset : length;
+    return {length, boundary};
+}
+
+size_t UTF8BoundaryLength(const char *input) {
+    return ScanUTF8Boundary(input).boundary;
 }
 
 }  // namespace utf
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/utils/KRUtfUtil.h` (modified, +10/-3)
```diff
@@ -30,9 +30,16 @@ std::string ToUTF8(const uint16_t *input, size_t units, bool strict = false);
 std::u32string ToUTF32(const std::string &input);
 std::string ToUTF8(const std::u32string &input);
 
-// Largest prefix length not exceeding bytes that ends on a UTF-8 character boundary. Byte-estimated
-// copy caps use it so a truncated buffer never carries a partial sequence.
-size_t UTF8BoundaryLength(const char *input, size_t bytes);
+// Result of one NUL-terminated UTF-8 scan: bytes before NUL and the longest safe prefix.
+struct UTF8BoundaryInfo {
+    size_t length;
+    size_t boundary;
+};
+
+UTF8BoundaryInfo ScanUTF8Boundary(const char *input);
+
+// Length of a NUL-terminated UTF-8 string after removing any incomplete trailing sequence.
+size_t UTF8BoundaryLength(const char *input);
 
 // UTF-16 unit count after Unicode maximal-subpart replacement.
 size_t UTF16Length(const std::string &input);
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/utils/test/krutfutil_test.cpp` (modified, +43/-0)
```diff
@@ -27,6 +27,20 @@ namespace utf = kuikly::util::utf;
 
 static int g_failures = 0;
 
+namespace kuikly {
+namespace util {
+namespace utf {
+
+// Keeps the original byte-cap test cases intact while the production API takes
+// only a NUL-terminated string.
+static size_t UTF8BoundaryLength(const char *input, size_t bytes) {
+    return UTF8BoundaryLength(std::string(input, bytes).c_str());
+}
+
+}  // namespace utf
+}  // namespace util
+}  // namespace kuikly
+
 #define EXPECT(cond)                                                                    \
     do {                                                                                \
         if (!(cond)) {                                                                  \
@@ -114,13 +128,42 @@ void TestSupplementaryPlaneRoundTrips() {
     EXPECT(utf::ToUTF32(utf::ToUTF8(emoji)) == emoji);
 }
 
+void TestNulTerminatedBoundaryLength() {
+    EXPECT_EQ_SIZE(utf::UTF8BoundaryLength(kCjkText), 24);
+    const char *kEmoji = "\xF0\x9F\x98\x80";  // U+1F600
+    EXPECT_EQ_SIZE(utf::UTF8BoundaryLength(kEmoji), 4);
+    EXPECT_EQ_SIZE(utf::UTF8BoundaryLength("abc"), 3);
+    EXPECT_EQ_SIZE(utf::UTF8BoundaryLength(""), 0);
+    EXPECT_EQ_SIZE(utf::UTF8BoundaryLength(nullptr), 0);
+
+    // ArkUI can truncate a fixed-size insert buffer in the middle of a character.
+    EXPECT_EQ_SIZE(utf::UTF8BoundaryLength("a\xE4\xB8"), 1);
+    EXPECT_EQ_SIZE(utf::UTF8BoundaryLength("a\xF0\x9F\x98"), 1);
+    EXPECT_EQ_SIZE(utf::UTF8BoundaryLength("\xE4\xB8"), 0);
+    EXPECT_EQ_SIZE(utf::UTF8BoundaryLength("\xF0\x9F\x98"), 0);
+
+    const std::string maxInsert = std::string(252, 'a') + "\xF0\x9F\x98";
+    const auto maxInsertInfo = utf::ScanUTF8Boundary(maxInsert.c_str());
+    EXPECT_EQ_SIZE(maxInsertInfo.length, 255);
+    EXPECT_EQ_SIZE(maxInsertInfo.boundary, 252);
+
+    // Ill-formed tails without a start byte keep the existing contract.
+    EXPECT_EQ_SIZE(utf::UTF8BoundaryLength("\x80"), 1);
+    EXPECT_EQ_SIZE(utf::UTF8BoundaryLength("a\x80\x80\x80\x80"), 5);
+
+    const auto info = utf::ScanUTF8Boundary(kCjkText);
+    EXPECT_EQ_SIZE(info.length, 24);
+    EXPECT_EQ_SIZE(info.boundary, 24);
+}
+
 int main() {
     TestByteTruncatedPasteDecodes();
     TestBoundaryLengthFloorsToCharacterBoundary();
     TestValidInputRoundTrips();
     TestIllFormedUTF8DecodesWithReplacement();
     TestIllFormedUTF32EncodesWithReplacement();
     TestSupplementaryPlaneRoundTrips();
+    TestNulTerminatedBoundaryLength();
     if (g_failures != 0) {
         std::fprintf(stderr, "%d failure(s)\n", g_failures);
         return 1;
```

---

### Incident Patch 2: `39a760fb` (2026-11-10)
**Commit Message**: fix(ohos): avoid draw-time typography relayout corruption (#1835)

* fix(ohos): lay out text at its final width during measure

Return that paragraph height from the current measure so parent layout
can place the following siblings without a second pager pass.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* fix(ohos): keep absolute text on its final width

Left/right text was finalized at its natural width, then the frame grew back without another measure. Record the accepted width, remeasure those leaves when the width arrives later, and reuse a left-aligned paragraph when the narrower container does not change line breaks.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* Revert "fix(ohos): keep absolute text on its final width"

This reverts commit e289adadca7beffd402594e0be1a6d52d25d3358.

* fix(ohos): avoid draw-time typography relayout

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* chore: keep text fix PR free of demo assets

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* fix(ohos): narrow typography relayout workaround

Co-authored-by: Cursor <[REDACTED_EMAIL]>

---------

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `core-render-ohos/src/main/cpp/libohos_render/expand/components/richtext/KRRichTextView.cpp` (modified, +3/-18)
```diff
@@ -148,7 +148,6 @@ void KRRichTextView::DidRemoveFromParentView() {
     IKRRenderViewExport::DidRemoveFromParentView();
     shadow_ = nullptr;
     paragraph_ = nullptr;
-    last_draw_frame_width_ = -1.0;
 }
 
 void KRRichTextView::OnForegroundDraw(ArkUI_NodeCustomEvent *event) {
@@ -186,27 +185,13 @@ void KRRichTextView::OnForegroundDraw(ArkUI_NodeCustomEvent *event) {
         return;
     }
     double drawOffsetY = richTextShadow->DrawOffsetY();
-    OH_Drawing_TextAlign textAlign = richTextShadow->TextAlign();
-    auto textTypoSize = richTextShadow->MainMeasureSize();
     // 在容器前景上绘制额外图形，实现图形显示在子组件之上。
     auto *drawContext = OH_ArkUI_NodeCustomEvent_GetDrawContextInDraw(event);
     auto *drawingHandle = reinterpret_cast<OH_Drawing_Canvas *>(OH_ArkUI_DrawContext_GetCanvas(drawContext));
     auto frameWidth = GetFrame().width;
-    bool needReLayout = false;
-    if (last_draw_frame_width_ > 0 && fabs(last_draw_frame_width_ - frameWidth) > 0.01) {
-        needReLayout = true;
-    }
-    if (fabs(textTypoSize.width - frameWidth) > 1 || textAlign != TEXT_ALIGN_LEFT) {
-        needReLayout = true;
-    }
-    if (needReLayout) {
-        auto dpi = KRConfig::GetDpi();
-        OH_Drawing_TypographyLayout(textTypo, frameWidth * dpi);
-        last_draw_frame_width_ = frameWidth;
-        if (textAlign != TEXT_ALIGN_LEFT) {
-            richTextShadow->ResetTextAlign();
-        }
-    }
+    // Do not lay out an already formatted Typography again while drawing.
+    // TypographyLayout is not idempotent on HarmonyOS 6 and may corrupt
+    // multiline Chinese glyphs.
 
     if (!selection_rects_.selection_rects.empty()) {
         double density = KRConfig::GetDpi();
```

**File**: `core-render-ohos/src/main/cpp/libohos_render/expand/components/richtext/KRRichTextView.h` (modified, +0/-1)
```diff
@@ -192,7 +192,6 @@ class KRRichTextView : public IKRRenderViewExport {
  private:
     std::shared_ptr<KRParagraph> paragraph_;
     std::shared_ptr<IKRRenderShadowExport> shadow_;
-    float last_draw_frame_width_ = -1.0;
     float line_break_margin_ = 0;
     KRParagraphSelectionInfo selection_rects_;
     void OnForegroundDraw(ArkUI_NodeCustomEvent *event);
```

---

### Incident Patch 3: `7feb72c2` (2026-11-10)
**Commit Message**: fix(ohos): guard empty HTTP response in KRNetworkModule (#1876)

* fix(ohos): guard empty HTTP response in KRNetworkModule

Avoid calling toString() on undefined response.result/responseCode when the HTTP response has an empty body or is otherwise abnormal.

* fix(ohos): align empty-response failure semantics in KRNetworkModule

Address review feedback: narrow response.result once for binary handling, and mark missing response/statusCode as success=0 with statusCode=-1000 instead of returning a contradictory success.

**File**: `core-render-ohos/src/main/ets/modules/KRNetworkModule.ets` (modified, +15/-6)
```diff
@@ -436,16 +436,25 @@ export class KRNetworkModule extends KuiklyRenderBaseModule {
             resultObject['data'] = '';
             resultObject['errorMsg'] = JSON.stringify(err);
             resultObject['success'] = '0';
-            resultObject['statusCode'] = response ? response.responseCode.toString() : '-1000';
+            resultObject['statusCode'] = response?.responseCode?.toString() ?? '-1000';
+          } else if (response == null || response.responseCode == null) {
+            // 没有有效 HTTP 响应 / 状态码时不能伪装成功：success 与 statusCode 必须一致。
+            resultObject['data'] = '';
+            resultObject['errorMsg'] = 'empty response';
+            resultObject['success'] = '0';
+            resultObject['statusCode'] = '-1000';
           } else {
+            // 先窄化 response.result，binary 分支体不要直接读 response.result，避免依赖 ?. 的类型收窄
+            const result = response.result;
             if (binaryMode) {
-              if (response.result instanceof ArrayBuffer) {
-                bytes = new Int8Array(response.result);
-              } else if (typeof response.result == 'string') {
-                bytes = new Int8Array(buffer.from(response.result).buffer);
+              if (result instanceof ArrayBuffer) {
+                bytes = new Int8Array(result);
+              } else if (typeof result == 'string') {
+                bytes = new Int8Array(buffer.from(result).buffer);
               }
             } else {
-              resultObject['data'] = response.result.toString();
+              // 空 body / 异常响应时 result 可能为 undefined，不能直接 toString()
+              resultObject['data'] = result?.toString() ?? '';
             }
             resultObject['errorMsg'] = '';
             resultObject['success'] = '1';
```

#### Recent Merged Pull Requests:
- **PR #1888** (2026-11-11): feat(compose): modifier support attr turboDisplayAutoUpdateEnable (@RoeKun)
- **PR #1885** (2026-11-10): feat(input): 扩展 Input/TextArea 与 Compose 的 keyboardType 映射 (@elixxli)
- **PR #1880** (2026-11-09): Bugfix/mini app global this (@etkmao)
- **PR #1878** (2026-11-06): fix(ohos): manage snapshot drawable descriptors with shared ownership (@ruifanyuan)
- **PR #1877** (2026-11-06): docs(ohos): document the V2 custom native view registration approach (@ruifanyuan)
- **PR #1876** (2026-11-10): fix(ohos): guard empty HTTP response in KRNetworkModule (@rainbow7)

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

## X. ohos): align paste truncation to UTF-8 boundary to avoid renderer… (#1857)

**RULE**:
When implementing operations in `core-render-ohos/src/main/cpp/libohos_render/expand/components/input/KRTextFieldView.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Tencent-TDS/KuiklyUI. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `99e03f21`: ohos): align paste truncation to UTF-8 boundary to avoid renderer… (#1857). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `core-render-ohos/src/main/cpp/libohos_render/expand/components/input/KRTextFieldView.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
#include <cstring>
        // ArkUI copies at most MAX_INSERT_LENGTH - 1 bytes, which can leave an incomplete UTF-8
        // tail. Drop that tail before filter -> CalculateTextLength decodes the buffer.
        buffer[MAX_INSERT_LENGTH - 1] = '\0';
        const auto boundary = kuikly::util::utf::ScanUTF8Boundary(buffer);
        // Trimming the incomplete tail can make the buffer shorter than the cap.
        // Preserve the full-buffer state so the temporary max-length path still runs.
        const bool insertBufferTruncated = boundary.length >= MAX_INSERT_LENGTH - 1;
        buffer[boundary.boundary] = '\0';
        if (filtered || insertBufferTruncated) {
        // Semantic truncation happens in filter; process the full paste buffer here.
        std::string pasteText(stringAsyncEvent->pStr);
        const bool filtered = filter(pasteText.data(), destText, range.first, range.second);
        if (filtered) {
            // filter writes a NUL into the writable C++17 string buffer.
            pasteText.resize(strlen(pasteText.data()));
            uint32_t realMaxLength = GetUTF16Length(destText) - (range.second - range.first) +
                                     GetUTF16L
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
        if (filtered || strlen(buffer) >= MAX_INSERT_LENGTH - 1) {
        size_t size = std::min(strlen(stringAsyncEvent->pStr), static_cast<size_t>(max_length_) * 4);
        // 这里只是避免拷贝超大剪贴板的粗估上限，不是语义截断（语义截断由 filter 完成）。
        // 必须回退到字符边界：buffer 随后进入 filter → CalculateTextLength，CHARACTER /
        // VISUAL_WIDTH 分支会对它调 ConvertToU32String，残缺序列会让长度计算与截断都失真。
        size = kuikly::util::utf::UTF8BoundaryLength(stringAsyncEvent->pStr, size);
        char *buffer = new char[size + 1];
        strncpy(buffer, stringAsyncEvent->pStr, size);
        buffer[size] = '\0';
        if (filter(buffer, destText, range.first, range.second)) {
            uint32_t realMaxLength = GetUTF16Length(destText) - (range.second - range.first) + GetUTF16Length(buffer);
        delete[] buffer;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `99e03f21` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
